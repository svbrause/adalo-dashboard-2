#!/usr/bin/env python3
"""Modal HTTP API for 3D face scan jobs + patient Aura (gray skin) assets.

Deploy:
  modal deploy scripts/modal_scan_api.py

Requires Modal secret `ponce-gcs` with:
  GCS_SERVICE_ACCOUNT_JSON  — service account JSON string
  GCS_BLUEPRINT_BUCKET      — bucket name (e.g. test-deploy-august25)

Optional:
  GCS_BLUEPRINT_PUBLIC_BASE_URL — CDN base for public URLs

Endpoints (proxied by ponce-patient-backend):
  POST /submit   — start job
  GET  /status   — ?job_id=…
"""

from __future__ import annotations

import base64
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
    "ultra": {"step_2d": 8, "estimated": 55},
    "draft": {"step_2d": 30, "estimated": 120},
    "standard": {"step_2d": 62, "estimated": 210},
    "high": {"step_2d": 100, "estimated": 330},
}

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "libgl1", "libglib2.0-0")
    .pip_install(
        "opencv-python-headless>=4.8",
        "numpy>=1.24",
        "Pillow>=10.0",
        "httpx>=0.27",
        "google-cloud-storage>=2.16",
        "google-auth>=2.29",
        "fastapi[standard]>=0.110",
    )
    .add_local_file(SCRIPTS / "generate_patient_aura_assets.py", "/root/scripts/generate_patient_aura_assets.py")
    .add_local_file(SCRIPTS / "generate-aura-cv-assets.py", "/root/scripts/generate-aura-cv-assets.py")
    .add_local_file(SCRIPTS / "generate-turntable-pigmentation-video.py", "/root/scripts/generate-turntable-pigmentation-video.py")
    .add_local_file(SCRIPTS / "scan_aura_gcs.py", "/root/scripts/scan_aura_gcs.py")
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
    if p < 0.92:
        return "Rendering turntable…"
    if p < 0.97:
        return "Generating skin maps & background removal…"
    return "Finalising…"


def _set_job(job_id: str, **fields: Any) -> None:
    current = dict(jobs.get(job_id, {}))
    current.update(fields)
    jobs[job_id] = current


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
    blob.make_public()
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


def _load_aura_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load {path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


@app.function(
    image=image,
    secrets=[gcs_secret],
    timeout=3600,
    cpu=4,
    memory=8192,
)
def process_scan_job(
    job_id: str,
    client_name: str,
    quality: str,
    photo_urls: dict[str, str],
) -> None:
    started_at = time.time()
    slug = _slugify(client_name)
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

        fn_reconstruct = modal.Function.from_name(FACELIFT_APP, RECONSTRUCT_FN)
        result: dict[str, bytes] = fn_reconstruct.remote(photos, step_2d=q["step_2d"])

        _set_job(job_id, progress=0.72, message=_progress_message(0.72))

        ply_bytes = result.get("gaussians.ply")
        if ply_bytes:
            fn_crop = modal.Function.from_name(FACELIFT_APP, CROP_FN)
            fn_render = modal.Function.from_name(FACELIFT_APP, RENDER_FN)
            cropped_ply = fn_crop.remote(ply_bytes)
            video_bytes = fn_render.remote(
                cropped_ply, resolution=2048, num_views=120, fps=30, sweep_deg=130,
            )
        elif "turntable.mp4" in result:
            video_bytes = result["turntable.mp4"]
        else:
            raise RuntimeError(f"FaceLift missing outputs: {list(result.keys())}")

        _set_job(job_id, progress=0.88, message=_progress_message(0.88))

        with tempfile.TemporaryDirectory(prefix="scan-") as tmp:
            tmp_path = Path(tmp)
            turntable_path = tmp_path / f"{slug}-turntable.mp4"
            seek_path = tmp_path / f"{slug}-turntable-seek.mp4"
            turntable_path.write_bytes(video_bytes)
            video_path = seek_path if _make_seek_friendly_turntable(turntable_path, seek_path) else turntable_path

            video_url = _upload_file_to_gcs(video_path, f"turntables/{slug}-turntable-seek.mp4", "video/mp4")
            if not video_url:
                video_url = _upload_file_to_gcs(turntable_path, f"turntables/{slug}-turntable.mp4", "video/mp4")

            aura_dir = tmp_path / slug
            aura_mod = _load_aura_module("generate_patient_aura_assets", Path("/root/scripts/generate_patient_aura_assets.py"))
            aura_manifest = aura_mod.generate_aura_assets(
                slug=slug,
                turntable_video_path=turntable_path,
                photo_bytes=photos,
                turntable_video_url=video_url or f"/demo-3d/{slug}-turntable.mp4",
                out_dir=aura_dir,
            )

            gcs_mod = _load_aura_module("scan_aura_gcs", Path("/root/scripts/scan_aura_gcs.py"))
            uploaded = gcs_mod.upload_aura_manifest_to_gcs(slug, aura_dir, aura_manifest)
            if uploaded:
                aura_manifest = uploaded
                if video_url:
                    aura_manifest["turntableVideoUrl"] = video_url

            payload: dict[str, Any] = {
                "status": "done",
                "progress": 1.0,
                "message": "Done",
                "videoUrl": video_url,
                "auraAssets": aura_manifest,
            }
            if not video_url:
                payload["videoBase64"] = base64.b64encode(video_bytes).decode("ascii")

            _set_job(job_id, **payload)

    except Exception as exc:
        import traceback
        traceback.print_exc()
        _set_job(job_id, status="error", error=str(exc), progress=1.0)


@app.function(image=image)
@modal.asgi_app()
def web_app():
    from fastapi import FastAPI, HTTPException, Request

    api = FastAPI()

    @api.post("/submit")
    async def submit(request: Request) -> dict[str, Any]:
        body = await request.json()
        client_name: str = body.get("clientName", "client")
        quality: str = body.get("quality", "standard")
        photo_urls: dict[str, str] = body.get("photos") or {}
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
        }
        process_scan_job.spawn(job_id, client_name, quality, photo_urls)
        return {"jobId": job_id, "estimatedSeconds": estimated}

    @api.get("/status")
    def status(job_id: str) -> dict[str, Any]:
        job = jobs.get(job_id)
        if not job:
            return {"status": "error", "error": "Job not found"}

        status_val = job.get("status", "queued")
        if status_val == "done":
            out: dict[str, Any] = {
                "status": "done",
                "progress": 1.0,
                "message": job.get("message", "Done"),
            }
            if job.get("videoUrl"):
                out["videoUrl"] = job["videoUrl"]
            if job.get("videoBase64"):
                out["videoBase64"] = job["videoBase64"]
            if job.get("auraAssets"):
                out["auraAssets"] = job["auraAssets"]
            return out

        if status_val == "error":
            return {"status": "error", "error": job.get("error", "Unknown error")}

        started_at = float(job.get("started_at", time.time()))
        elapsed = time.time() - started_at
        estimated = QUALITY_PRESETS.get(job.get("quality", "standard"), QUALITY_PRESETS["standard"])["estimated"]
        remaining = max(0, int(estimated - elapsed))
        progress = float(job.get("progress", min(0.95, elapsed / max(estimated, 1))))

        return {
            "status": status_val,
            "progress": progress,
            "message": job.get("message") or _progress_message(progress),
            "remaining": remaining,
            "elapsed": int(elapsed),
        }

    return api
