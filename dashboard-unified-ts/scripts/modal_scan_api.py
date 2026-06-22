#!/usr/bin/env python3
"""Modal HTTP API for 3D face scan jobs + patient Aura (gray skin) assets.

Deploy:
  modal deploy scripts/modal_scan_api.py

Requires Modal secret `ponce-gcs` with:
  GCS_SERVICE_ACCOUNT_JSON  — service account JSON string
  GCS_BLUEPRINT_BUCKET      — bucket name (e.g. test-deploy-august25)
  AIRTABLE_API_TOKEN        — optional; required for save-video Airtable persistence
  AIRTABLE_BASE_ID          — optional; required for save-video Airtable persistence

Optional:
  GCS_BLUEPRINT_PUBLIC_BASE_URL — CDN base for public URLs

Endpoints (proxied by ponce-patient-backend):
  POST /submit   — start job
  GET  /status   — ?job_id=…
"""

from __future__ import annotations

import base64
import hashlib
import importlib.util
import json
import os
import subprocess
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any

import modal

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"

FACELIFT_APP = "try3d-facelift"
RECONSTRUCT_FN = "reconstruct_multi"
CROP_FN = "_crop_ply"
RENDER_FN = "render_turntable_black"

QUALITY_PRESETS: dict[str, dict[str, int]] = {
    "ultra": {"step_2d": 8, "estimated": 180},
    "draft": {"step_2d": 30, "estimated": 120},
    "standard": {"step_2d": 62, "estimated": 180},
    "high": {"step_2d": 100, "estimated": 300},
}

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "libgl1", "libglib2.0-0", "curl", "libgles2", "libegl1")
    .pip_install(
        "opencv-python-headless>=4.8",
        "numpy>=1.24",
        "Pillow>=10.0",
        "httpx>=0.27",
        "google-cloud-storage>=2.16",
        "google-auth>=2.29",
        "fastapi[standard]>=0.110",
        "mediapipe>=0.10",
    )
    .add_local_dir(str(SCRIPTS), remote_path="/root/scripts", copy=True)
)

app = modal.App("scan-api")
jobs = modal.Dict.from_name("ponce-scan-jobs", create_if_missing=True)

try:
    gcs_secret = modal.Secret.from_name("ponce-gcs")
except Exception:
    gcs_secret = modal.Secret.from_dict({})


def _slugify(name: str) -> str:
    return name.lower().replace(" ", "-").replace("/", "-").replace(".", "")


def _progress_message(p: float) -> str:
    if p < 0.05:
        return "Connecting to Modal…"
    if p < 0.20:
        return "Uploading photos…"
    if p < 0.55:
        return "Generating 3D model…"
    if p < 0.80:
        return "Refining details…"
    if p < 0.90:
        return "Processing turntable video…"
    if p < 0.97:
        return "Generating skin maps & background removal…"
    return "Finalising…"


def _set_job(job_id: str, **fields: Any) -> None:
    current = dict(jobs.get(job_id, {}))
    current.update(fields)
    jobs[job_id] = current


def _set_processing_progress(job_id: str, progress: float, message: str) -> None:
    """Update 3D/background progress without marking analysis incomplete again."""
    current = dict(jobs.get(job_id, {}))
    if current.get("analysisComplete"):
        _set_job(
            job_id,
            progress=1.0,
            message=message,
            assetStatus="running",
            assetProgress=progress,
            assetMessage=message,
        )
        return
    _set_job(job_id, progress=progress, message=message)


def _job_was_cancelled(job_id: str) -> bool:
    job = jobs.get(job_id, {})
    return job.get("status") == "error" and job.get("message") == "Cancelled"


def _upload_file_to_gcs(local_path: Path, blob_name: str, content_type: str) -> str | None:
    bucket_name = (
        os.environ.get("GCS_TURNTABLE_BUCKET", "").strip()
        or os.environ.get("GCS_BLUEPRINT_BUCKET", "").strip()
        or os.environ.get("GCS_SCAN_BUCKET", "").strip()
    )
    sa_json_str = os.environ.get("GCS_SERVICE_ACCOUNT_JSON", "").strip()
    if not bucket_name or not sa_json_str:
        return None

    from google.cloud import storage as gcs_storage
    from google.oauth2 import service_account as gcs_sa

    sa_info = json.loads(sa_json_str)
    creds = gcs_sa.Credentials.from_service_account_info(
        sa_info,
        scopes=["https://www.googleapis.com/auth/cloud-platform"],
    )
    client = gcs_storage.Client(credentials=creds, project=sa_info.get("project_id"))
    blob = client.bucket(bucket_name).blob(blob_name)
    blob.upload_from_filename(str(local_path), content_type=content_type)
    try:
        blob.make_public()
    except Exception as exc:
        # Uniform bucket-level access disables per-object ACLs. The scan bucket
        # is already publicly readable, so keep the public URL and continue.
        print(f"[scan-api] make_public skipped for {blob_name}: {exc}", flush=True)
    public_base = (
        os.environ.get("GCS_BLUEPRINT_PUBLIC_BASE_URL", "").strip().rstrip("/")
        or f"https://storage.googleapis.com/{bucket_name}"
    )
    return f"{public_base}/{blob_name}"


def _make_seek_friendly_turntable(src: Path, dest: Path) -> bool:
    cmd = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-i", str(src),
        "-vf", "scale=1024:-2",
        "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
        "-g", "1", "-keyint_min", "1", "-sc_threshold", "0",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        str(dest),
    ]
    try:
        subprocess.run(cmd, check=True)
        return dest.exists() and dest.stat().st_size > 0
    except Exception as exc:
        print(f"[scan-api] seek turntable failed: {exc}", flush=True)
        return False


def _make_pingpong_turntable(src: Path, dest: Path) -> bool:
    """Stitch forward + reversed frames into a single ping-pong MP4.

    The player loops this video forward; the face oscillates left↔right
    with the backward half at the same quality as the forward half.
    All-keyframes so seeks anywhere in the video are instant.
    """
    cmd = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-i", str(src),
        "-filter_complex", "[0:v]reverse[r];[0:v][r]concat=n=2:v=1[out]",
        "-map", "[out]",
        "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
        "-g", "1", "-keyint_min", "1", "-sc_threshold", "0",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        str(dest),
    ]
    try:
        subprocess.run(cmd, check=True)
        return dest.exists() and dest.stat().st_size > 0
    except Exception as exc:
        print(f"[scan-api] ping-pong turntable failed: {exc}", flush=True)
        return False


def _load_aura_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load {path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _generate_submission_id(*parts: object) -> str:
    seed = "|".join(str(part or "").strip() for part in parts)
    nonce = f"{time.time_ns()}:{uuid.uuid4().hex}:{seed}"
    return f"sub_{hashlib.sha256(nonce.encode('utf-8')).hexdigest()[:20]}"


@app.function(
    image=image,
    secrets=[gcs_secret],
    timeout=3600,
    cpu=8,
    memory=8192,
)
def process_scan_job(
    job_id: str,
    client_name: str,
    quality: str,
    photo_urls: dict[str, str],
    patient_age: int | None = None,
    submission_id: str | None = None,
) -> None:
    started_at = time.time()
    slug = _slugify(client_name)
    submission_id = str(submission_id or "").strip() or _generate_submission_id(client_name, job_id)
    q = QUALITY_PRESETS.get(quality, QUALITY_PRESETS["standard"])

    try:
        _set_job(
            job_id,
            status="running",
            started_at=started_at,
            quality=quality,
            progress=0.05,
            message=_progress_message(0.05),
        )

        import httpx

        photos: dict[str, bytes] = {}
        with httpx.Client(follow_redirects=True, timeout=60) as client:
            for key, url in photo_urls.items():
                r = client.get(url)
                r.raise_for_status()
                photos[key] = r.content

        _set_job(job_id, progress=0.15, message=_progress_message(0.15))

        severity_scores: dict[str, Any] | None = None
        _set_job(
            job_id,
            progress=0.18,
            message="Running facial analysis…",
            analysisComplete=False,
            assetStatus="queued",
        )
        try:
            severity_mod = _load_aura_module(
                "scan_severity_api",
                Path("/root/scripts/scan_severity_api.py"),
            )
            severity_scores = severity_mod.fetch_severity_scores_from_photos(
                photos,
                age=patient_age,
                submission_id=submission_id,
            )
        except Exception as severity_exc:
            print(f"[scan-api] Severity analysis failed for {slug}: {severity_exc}")

        if severity_scores:
            _set_job(
                job_id,
                status="running",
                progress=1.0,
                message="Analysis complete — building 3D view…",
                analysisComplete=True,
                analysisMessage="Analysis complete",
                severityScores=severity_scores,
                assetStatus="running",
                assetProgress=0.02,
                assetMessage="Generating 3D model…",
            )

        # Update message before the blocking reconstruct call so the UI shows
        # meaningful progress (not "Uploading photos…") during GPU processing.
        _set_processing_progress(job_id, 0.20, "Generating 3D model…")

        fn_reconstruct = modal.Function.from_name(FACELIFT_APP, RECONSTRUCT_FN)
        result: dict[str, bytes] = fn_reconstruct.remote(photos, step_2d=q["step_2d"])

        _set_processing_progress(job_id, 0.72, _progress_message(0.72))

        if _job_was_cancelled(job_id):
            return

        ply_bytes = result.get("gaussians.ply")
        if ply_bytes:
            fn_crop = modal.Function.from_name(FACELIFT_APP, CROP_FN)
            fn_render = modal.Function.from_name(FACELIFT_APP, RENDER_FN)
            cropped_ply = fn_crop.remote(ply_bytes)
            video_bytes = fn_render.remote(
                cropped_ply, resolution=1024, num_views=90, fps=30, sweep_deg=130,
            )
        elif "turntable.mp4" in result:
            video_bytes = result["turntable.mp4"]
        else:
            raise RuntimeError(f"FaceLift missing outputs: {list(result.keys())}")

        _set_processing_progress(job_id, 0.88, _progress_message(0.88))

        if _job_was_cancelled(job_id):
            return

        with tempfile.TemporaryDirectory(prefix="scan-") as tmp:
            tmp_path = Path(tmp)
            turntable_path = tmp_path / f"{slug}-turntable.mp4"
            seek_path = tmp_path / f"{slug}-turntable-seek.mp4"
            turntable_path.write_bytes(video_bytes)
            video_path = seek_path if _make_seek_friendly_turntable(turntable_path, seek_path) else turntable_path

            _set_processing_progress(job_id, 0.89, "Generating ping-pong turntable…")
            pingpong_path = tmp_path / f"{slug}-turntable-seek-pingpong.mp4"
            _make_pingpong_turntable(video_path, pingpong_path)
            # Use the ping-pong version as the primary video if it was created successfully.
            if pingpong_path.exists() and pingpong_path.stat().st_size > 0:
                video_path = pingpong_path

            _set_processing_progress(job_id, 0.90, "Uploading turntable…")
            video_url = _upload_file_to_gcs(video_path, f"turntables/{slug}-turntable-seek.mp4", "video/mp4")
            if not video_url:
                video_url = _upload_file_to_gcs(turntable_path, f"turntables/{slug}-turntable.mp4", "video/mp4")

            # Turntable is playable — expose URL before aura stills finish so the UI can preload.
            if video_url:
                _set_job(
                    job_id,
                    status="running",
                    progress=1.0 if severity_scores else 0.91,
                    message="Turntable ready — generating skin maps…",
                    videoUrl=video_url,
                    assetStatus="running",
                    assetProgress=0.91,
                    assetMessage="Turntable ready — generating skin maps…",
                )

            _set_processing_progress(job_id, 0.92, _progress_message(0.92))
            aura_dir = tmp_path / slug
            aura_mod = _load_aura_module("generate_patient_aura_assets", Path("/root/scripts/generate_patient_aura_assets.py"))

            def aura_progress(progress: float, message: str) -> None:
                _set_processing_progress(job_id, progress, message)

            aura_manifest = aura_mod.generate_aura_assets(
                slug=slug,
                turntable_video_path=turntable_path,
                photo_bytes=photos,
                turntable_video_url=video_url or f"/demo-3d/{slug}-turntable.mp4",
                out_dir=aura_dir,
                skip_videos=False,
                scan_optimized=False,
                on_progress=aura_progress,
            )

            _set_processing_progress(job_id, 0.97, _progress_message(0.97))

            gcs_mod = _load_aura_module("scan_aura_gcs", Path("/root/scripts/scan_aura_gcs.py"))
            uploaded = gcs_mod.upload_aura_manifest_to_gcs(slug, aura_dir, aura_manifest)
            if uploaded:
                aura_manifest = uploaded
                if video_url:
                    aura_manifest["turntableVideoUrl"] = video_url

            if severity_scores is None:
                _set_processing_progress(job_id, 0.985, "Running facial analysis severity…")
                try:
                    severity_mod = _load_aura_module(
                        "scan_severity_api",
                        Path("/root/scripts/scan_severity_api.py"),
                    )
                    severity_scores = severity_mod.fetch_severity_scores_from_photos(
                        photos,
                        age=patient_age,
                        submission_id=submission_id,
                    )
                    if severity_scores:
                        _set_job(
                            job_id,
                            analysisComplete=True,
                            analysisMessage="Analysis complete",
                            severityScores=severity_scores,
                        )
                except Exception as severity_exc:
                    print(f"[scan-api] Severity analysis failed for {slug}: {severity_exc}")

            payload: dict[str, Any] = {
                "status": "done",
                "progress": 1.0,
                "message": "Done",
                "analysisComplete": bool(severity_scores),
                "analysisMessage": "Analysis complete" if severity_scores else None,
                "assetStatus": "ready",
                "assetProgress": 1.0,
                "assetRemaining": 0,
                "assetMessage": "3D view ready",
                "videoUrl": video_url,
                "auraAssets": aura_manifest,
                "severityScores": severity_scores,
            }
            if not video_url:
                payload["videoBase64"] = base64.b64encode(video_bytes).decode("ascii")

            _set_job(job_id, **payload)

    except Exception as exc:
        import traceback
        traceback.print_exc()
        _set_job(job_id, status="error", error=str(exc), progress=1.0)


@app.function(image=image, secrets=[gcs_secret])
@modal.asgi_app()
def web_app():
    from fastapi import Body, FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware

    api = FastAPI()
    api.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    async def submit_scan(body: dict[str, Any]) -> dict[str, Any]:
        client_name: str = body.get("clientName", "client")
        quality: str = body.get("quality", "standard")
        photo_urls: dict[str, str] = body.get("photos") or {}
        patient_age_raw = body.get("patientAge")
        patient_age = (
            int(patient_age_raw)
            if patient_age_raw is not None and str(patient_age_raw).strip().isdigit()
            else None
        )
        submission_id = str(body.get("submissionId") or body.get("submissionID") or "").strip()
        if not submission_id:
            submission_id = _generate_submission_id(client_name)
        if not photo_urls:
            raise HTTPException(400, "No photos provided")
        if quality not in QUALITY_PRESETS:
            quality = "standard"

        job_id = str(uuid.uuid4())
        estimated = QUALITY_PRESETS[quality]["estimated"]
        jobs[job_id] = {
            "status": "queued",
            "started_at": time.time(),
            "quality": quality,
            "progress": 0.0,
            "message": "Queued",
            "estimatedSeconds": estimated,
            "submissionId": submission_id,
        }
        call = process_scan_job.spawn(
            job_id,
            client_name,
            quality,
            photo_urls,
            patient_age,
            submission_id,
        )
        jobs[job_id] = {**jobs[job_id], "callId": call.object_id}
        return {"jobId": job_id, "estimatedSeconds": estimated, "submissionId": submission_id}

    @api.post("/submit")
    async def submit(body: dict[str, Any] = Body(...)) -> dict[str, Any]:
        return await submit_scan(body)

    @api.post("/api/scan/submit")
    async def submit_api(body: dict[str, Any] = Body(...)) -> dict[str, Any]:
        return await submit_scan(body)

    def scan_status(job_id: str) -> dict[str, Any]:
        job = jobs.get(job_id)
        if not job:
            return {"status": "error", "error": "Job not found"}

        status_val = job.get("status", "queued")
        if status_val == "done":
            out: dict[str, Any] = {
                "status": "done",
                "progress": 1.0,
                "message": job.get("message", "Done"),
                "analysisComplete": bool(job.get("analysisComplete") or job.get("severityScores")),
                "analysisMessage": job.get("analysisMessage"),
                "assetStatus": job.get("assetStatus", "ready"),
                "assetProgress": job.get("assetProgress", 1.0),
                "assetRemaining": job.get("assetRemaining", 0),
                "assetMessage": job.get("assetMessage"),
            }
            if job.get("videoUrl"):
                out["videoUrl"] = job["videoUrl"]
            if job.get("videoBase64"):
                out["videoBase64"] = job["videoBase64"]
            if job.get("auraAssets"):
                out["auraAssets"] = job["auraAssets"]
            if job.get("severityScores"):
                out["severityScores"] = job["severityScores"]
            if job.get("submissionId"):
                out["submissionId"] = job["submissionId"]
            return out

        if status_val == "error":
            return {"status": "error", "error": job.get("error", "Unknown error")}

        started_at = float(job.get("started_at", time.time()))
        elapsed = time.time() - started_at
        estimated = QUALITY_PRESETS.get(job.get("quality", "standard"), QUALITY_PRESETS["standard"])["estimated"]
        analysis_complete = bool(job.get("analysisComplete") or job.get("severityScores"))
        remaining = 0 if analysis_complete else max(0, int(estimated - elapsed))
        progress = 1.0 if analysis_complete else float(job.get("progress", min(0.95, elapsed / max(estimated, 1))))

        return {
            "status": status_val,
            "progress": progress,
            "message": job.get("message") or _progress_message(progress),
            "remaining": remaining,
            "elapsed": int(elapsed),
            "estimatedSeconds": estimated,
            "analysisComplete": analysis_complete,
            "analysisMessage": job.get("analysisMessage"),
            "assetStatus": job.get("assetStatus"),
            "assetProgress": job.get("assetProgress"),
            "assetRemaining": job.get("assetRemaining"),
            "assetMessage": job.get("assetMessage"),
            **({"videoUrl": job["videoUrl"]} if job.get("videoUrl") else {}),
            **({"auraAssets": job["auraAssets"]} if job.get("auraAssets") else {}),
            **({"severityScores": job["severityScores"]} if job.get("severityScores") else {}),
            **({"submissionId": job["submissionId"]} if job.get("submissionId") else {}),
        }

    @api.get("/status")
    def status(job_id: str) -> dict[str, Any]:
        return scan_status(job_id)

    @api.get("/api/scan/status/{job_id}")
    def status_api(job_id: str) -> dict[str, Any]:
        return scan_status(job_id)

    @api.post("/api/scan/cancel/{job_id}")
    def cancel_api(job_id: str) -> dict[str, Any]:
        job = jobs.get(job_id)
        if not job:
            raise HTTPException(404, "Job not found")
        status_val = job.get("status", "queued")
        if status_val in ("done", "error"):
            return {"ok": True, "status": status_val}

        call_id = job.get("callId")
        if call_id:
            try:
                from modal.functions import FunctionCall

                FunctionCall.from_id(call_id).cancel()
            except Exception as exc:
                print(f"[scan-api] cancel call {call_id}: {exc}", flush=True)

        _set_job(
            job_id,
            status="error",
            error="Cancelled",
            progress=1.0,
            message="Cancelled",
        )
        return {"ok": True, "status": "cancelled"}

    @api.post("/api/scan/save-video")
    async def save_video(body: dict[str, Any] = Body(...)) -> dict[str, Any]:
        job_id = body.get("jobId")
        record_id = body.get("recordId", "")
        table_name = body.get("tableName", "Patients")
        include_severity = bool(body.get("includeSeverity"))
        job = jobs.get(job_id) if job_id else None
        if not job:
            return {"persisted": False}
        severity_doc = job.get("severityScores")
        if not isinstance(severity_doc, dict):
            severity_doc = None
        if job.get("status") != "done" and include_severity and severity_doc:
            persisted = False
            if record_id:
                try:
                    airtable_mod = _load_aura_module(
                        "scan_airtable",
                        Path("/root/scripts/scan_airtable.py"),
                    )
                    persisted = airtable_mod.write_severity_scores_to_airtable(
                        record_id,
                        table_name,
                        severity_doc,
                    )
                except Exception as exc:
                    print(f"[scan-api] save-video severity update failed: {exc}")
            return {
                "persisted": persisted,
                "severityPersisted": persisted,
                "videoUrl": job.get("videoUrl"),
                "auraAssets": job.get("auraAssets"),
                "severityScores": severity_doc,
            }
        if job.get("status") != "done":
            raise HTTPException(400, f"Job {job_id!r} is not done")

        video_url = job.get("videoUrl")
        if not video_url:
            persisted = False
            if include_severity and severity_doc and record_id:
                try:
                    airtable_mod = _load_aura_module(
                        "scan_airtable",
                        Path("/root/scripts/scan_airtable.py"),
                    )
                    persisted = airtable_mod.write_severity_scores_to_airtable(
                        record_id,
                        table_name,
                        severity_doc,
                    )
                except Exception as exc:
                    print(f"[scan-api] save-video done severity update failed: {exc}")
            return {
                "persisted": persisted,
                "severityPersisted": persisted,
                "videoUrl": None,
                "auraAssets": job.get("auraAssets"),
                "severityScores": severity_doc,
            }

        aura_assets = job.get("auraAssets")
        aura_manifest_url = None
        aura_gcs_prefix = None
        if isinstance(aura_assets, dict):
            slug = str(aura_assets.get("slug") or "").strip()
            bucket_name = (
                os.environ.get("GCS_TURNTABLE_BUCKET", "").strip()
                or os.environ.get("GCS_BLUEPRINT_BUCKET", "").strip()
                or os.environ.get("GCS_SCAN_BUCKET", "").strip()
            )
            if slug and bucket_name:
                aura_manifest_url = (
                    f"https://storage.googleapis.com/{bucket_name}/aura/{slug}/{slug}-aura-manifest.json"
                )
                aura_gcs_prefix = f"gs://{bucket_name}/aura/{slug}/"

        persisted = False
        if record_id:
            try:
                airtable_mod = _load_aura_module(
                    "scan_airtable",
                    Path("/root/scripts/scan_airtable.py"),
                )
                persisted = airtable_mod.update_airtable_scan_urls(
                    record_id,
                    table_name,
                    video_url,
                    aura_manifest_url,
                    aura_gcs_prefix,
                    severity_doc,
                )
            except Exception as exc:
                print(f"[scan-api] save-video Airtable update failed: {exc}")

        return {
            "videoUrl": video_url,
            "persisted": persisted,
            "auraAssets": aura_assets,
            "severityScores": severity_doc,
        }

    return api
