#!/usr/bin/env python3
"""
Local API server for 3D face scan job submission.

Usage:
  pip install fastapi uvicorn httpx
  python3 server.py

The Vite dev server proxies /api/* here.  The Cloud Run scan worker is invoked
in a background thread so the HTTP response returns immediately with a job ID;
the client polls GET /api/scan/status/{jobId} via Server-Sent Events for
progress.
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import io
import json
import os
import subprocess
import sys
import threading
import time
import uuid
from pathlib import Path
from typing import Any

# Load local scan-server secrets (gitignored). Does not override vars already in the shell.
try:
    from dotenv import load_dotenv

    _scan_env = Path(__file__).parent / ".env.scan-server"
    if _scan_env.is_file():
        load_dotenv(_scan_env, override=False)
except ImportError:
    pass

try:
    import httpx
except ImportError:
    httpx = None  # type: ignore

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

_DEFAULT_DEPLOYED_SCAN_API = "https://facelift-scan-api-rm2sqmm74q-uc.a.run.app"

# Where generated turntable videos land (served by Vite as static assets)
PUBLIC_3D = Path(__file__).parent / "public" / "demo-3d"
PUBLIC_3D.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Quality presets
# ---------------------------------------------------------------------------
QUALITY_PRESETS: dict[str, dict[str, Any]] = {
    "ultra":    {"step_2d": 8,   "estimated": 180},
    "draft":    {"step_2d": 30,  "estimated": 120},
    "standard": {"step_2d": 62,  "estimated": 180},
    "high":     {"step_2d": 100, "estimated": 300},
}

# ---------------------------------------------------------------------------
# In-memory job store
# ---------------------------------------------------------------------------
# job_id -> {status, started_at, quality, video_url, error, auraAssets, ...}
_jobs: dict[str, dict[str, Any]] = {}
_jobs_lock = threading.Lock()


def _progress_message(p: float) -> str:
    if p < 0.05: return "Connecting to scan worker…"
    if p < 0.20: return "Uploading photos…"
    if p < 0.55: return "Generating 3D model…"
    if p < 0.80: return "Refining details…"
    if p < 0.92: return "Rendering turntable…"
    return "Finalising…"


def _make_seek_friendly_turntable(src: Path, dest: Path) -> bool:
    """Create a smaller, all-keyframe MP4 for smooth client-side scrubbing."""
    cmd = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(src),
        "-vf",
        "scale=1024:-2",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "18",
        "-g",
        "1",
        "-keyint_min",
        "1",
        "-sc_threshold",
        "0",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        str(dest),
    ]
    try:
        subprocess.run(cmd, check=True)
        return dest.exists() and dest.stat().st_size > 0
    except Exception as exc:
        print(f"[server] Could not create seek-friendly turntable: {exc}")
        return False


def _set_job(job_id: str, **fields: Any) -> None:
    with _jobs_lock:
        _jobs[job_id].update(fields)


def _set_processing_progress(job_id: str, progress: float, message: str) -> None:
    with _jobs_lock:
        current = _jobs.get(job_id, {})
        analysis_complete = bool(
            current.get("analysisComplete") or current.get("severityScores")
        )
    if analysis_complete:
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


def _load_script_module(module_name: str, script_path: Path):
    import importlib.util

    spec = importlib.util.spec_from_file_location(module_name, script_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load {script_path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _generate_submission_id(*parts: object) -> str:
    seed = "|".join(str(part or "").strip() for part in parts)
    nonce = f"{time.time_ns()}:{uuid.uuid4().hex}:{seed}"
    return f"sub_{hashlib.sha256(nonce.encode('utf-8')).hexdigest()[:20]}"


def _deployed_scan_api_base() -> str:
    # SCAN_API_URL is preferred; MODAL_SCAN_API_URL kept for backwards compat.
    return (
        os.environ.get("SCAN_API_URL")
        or os.environ.get("MODAL_SCAN_API_URL")
        or _DEFAULT_DEPLOYED_SCAN_API
    ).strip().rstrip("/")


def _persist_remote_scan_outputs(
    *,
    record_id: str,
    table_name: str,
    video_url: str | None,
    aura_assets: dict[str, Any] | None,
    severity_doc: dict[str, Any] | None,
    submission_id: str | None = None,
    provider_id: str | None = None,
    patient_name: str | None = None,
    patient_email: str | None = None,
) -> bool:
    if not record_id or not video_url:
        if record_id and severity_doc:
            try:
                airtable_mod = _load_script_module(
                    "scan_airtable",
                    Path(__file__).parent / "scripts" / "scan_airtable.py",
                )
                return airtable_mod.write_severity_scores_to_airtable(
                    record_id,
                    table_name,
                    severity_doc,
                    submission_id=submission_id,
                    provider_id=provider_id,
                    patient_name=patient_name,
                    patient_email=patient_email,
                )
            except Exception as exc:
                print(f"[server] Remote severity-only Airtable write failed: {exc}")
        return False

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

    try:
        airtable_mod = _load_script_module(
            "scan_airtable",
            Path(__file__).parent / "scripts" / "scan_airtable.py",
        )
        return airtable_mod.update_airtable_scan_urls(
            record_id,
            table_name,
            video_url,
            aura_manifest_url,
            aura_gcs_prefix,
            severity_doc if isinstance(severity_doc, dict) else None,
            submission_id=submission_id,
            provider_id=provider_id,
            patient_name=patient_name,
            patient_email=patient_email,
        )
    except Exception as exc:
        print(f"[server] Remote scan output Airtable write failed: {exc}")
        return False


def _run_severity_only_completion(
    job_id: str,
    photos: dict[str, bytes],
    client_name: str,
    patient_age: int | None,
    patient_record_id: str | None,
    patient_table_name: str | None,
    pipeline_error: str,
    submission_id: str | None = None,
) -> None:
    _set_job(
        job_id,
        status="running",
        message="3D scan unavailable — running facial analysis…",
        progress=0.85,
    )
    severity_scores: dict[str, Any] | None = None
    try:
        scripts_dir = Path(__file__).parent / "scripts"
        severity_mod = _load_script_module(
            "scan_severity_api",
            scripts_dir / "scan_severity_api.py",
        )
        safe = (
            client_name.lower()
            .replace(" ", "-")
            .replace("/", "-")
            .replace(".", "")
        )
        severity_scores = severity_mod.fetch_severity_scores_from_photos(
            photos,
            age=patient_age,
            submission_id=submission_id or f"scan-{safe}",
        )
    except Exception as severity_exc:
        print(f"[server] Severity-only fallback failed: {severity_exc}")

    persisted = False
    if patient_record_id and severity_scores:
        try:
            airtable_mod = _load_script_module(
                "scan_airtable",
                Path(__file__).parent / "scripts" / "scan_airtable.py",
            )
            persisted = airtable_mod.write_severity_scores_to_airtable(
                patient_record_id,
                patient_table_name or "Patients",
                severity_scores,
            )
        except Exception as exc:
            print(f"[server] Severity-only Airtable write failed: {exc}")

    _set_job(
        job_id,
        status="partial",
        severityScores=severity_scores,
        progress=1.0,
        pipelineWarning=pipeline_error,
        error=pipeline_error,
        persistedToPatient=persisted,
        message="Saved without 3D model",
    )


def _run_deployed_scan_api_job(
    job_id: str,
    photo_urls: dict[str, str],
    quality: str,
    client_name: str,
    patient_age: int | None,
    patient_record_id: str | None,
    patient_table_name: str | None,
    submission_id: str | None = None,
) -> None:
    if httpx is None:
        raise RuntimeError("httpx not installed — cannot call cloud scan API")

    base = _deployed_scan_api_base()
    _set_job(job_id, status="running", message="Starting cloud 3D scan…", progress=0.12)

    with httpx.Client(timeout=120) as client:
        response = client.post(
            f"{base}/api/scan/submit",
            json={
                "clientName": client_name,
                "quality": quality,
                "photos": photo_urls,
                "patientAge": patient_age,
                "submissionId": submission_id,
                # Worker persists outputs to Airtable itself when a patient is
                # linked, so results survive this process going away.
                "recordId": patient_record_id or "",
                "tableName": patient_table_name or "Patients",
            },
        )
        response.raise_for_status()
        remote_job_id = str(response.json().get("jobId") or "")
    if not remote_job_id:
        raise RuntimeError("Cloud scan API did not return a job ID")

    started = time.time()
    while True:
        time.sleep(1.5)
        try:
            with httpx.Client(timeout=60) as client:
                resp = client.get(f"{base}/api/scan/status/{remote_job_id}")
            if resp.status_code == 429:
                print(f"[server] GCP status endpoint rate limited (429); retrying in 5s")
                time.sleep(5)
                continue
            ct = resp.headers.get("content-type", "")
            if not resp.is_success or "json" not in ct:
                print(f"[server] GCP status non-JSON ({resp.status_code}, {ct}): {resp.text[:200]}; retrying")
                time.sleep(5)
                continue
            status = resp.json()
        except Exception as poll_exc:
            print(f"[server] Status poll error: {poll_exc}; retrying in 5s")
            time.sleep(5)
            continue

        remote_status = str(status.get("status") or "running")
        progress = float(status.get("progress") or 0.2)
        severity_scores = status.get("severityScores")
        if not isinstance(severity_scores, dict):
            severity_scores = None
        analysis_complete = bool(status.get("analysisComplete") or severity_scores)
        video_url = status.get("videoUrl")
        aura_assets = status.get("auraAssets")
        _set_job(
            job_id,
            status="running",
            progress=1.0 if analysis_complete else progress,
            message=status.get("message") or "Cloud 3D scan running…",
            remoteJobId=remote_job_id,
            analysisComplete=analysis_complete,
            analysisMessage=status.get("analysisMessage"),
            assetStatus=status.get("assetStatus"),
            assetProgress=status.get("assetProgress"),
            assetRemaining=status.get("assetRemaining"),
            assetMessage=status.get("assetMessage"),
            video_url=video_url,
            auraAssets=aura_assets if isinstance(aura_assets, dict) else None,
            severityScores=severity_scores,
        )
        with _jobs_lock:
            local_job = _jobs.get(job_id, {})
            severity_persisted = bool(local_job.get("severityPersisted"))
        if (
            analysis_complete
            and severity_scores
            and patient_record_id
            and not severity_persisted
        ):
            persisted = _persist_remote_scan_outputs(
                record_id=patient_record_id,
                table_name=patient_table_name or "Patients",
                video_url=None,
                aura_assets=None,
                severity_doc=severity_scores,
            )
            _set_job(job_id, severityPersisted=persisted)

        if remote_status == "done":
            persisted = False
            if patient_record_id:
                persisted = _persist_remote_scan_outputs(
                    record_id=patient_record_id,
                    table_name=patient_table_name or "Patients",
                    video_url=str(video_url) if video_url else None,
                    aura_assets=aura_assets if isinstance(aura_assets, dict) else None,
                    severity_doc=severity_scores if isinstance(severity_scores, dict) else None,
                )
            _set_job(
                job_id,
                status="done",
                progress=1.0,
                message="Done",
                video_url=video_url,
                auraAssets=aura_assets,
                severityScores=severity_scores,
                analysisComplete=bool(analysis_complete or severity_scores),
                analysisMessage=status.get("analysisMessage") or "Analysis complete",
                assetStatus=status.get("assetStatus") or "ready",
                assetProgress=status.get("assetProgress") or 1.0,
                assetRemaining=status.get("assetRemaining") or 0,
                assetMessage=status.get("assetMessage") or "3D view ready",
                persistedToPatient=persisted,
                remoteJobId=remote_job_id,
            )
            return

        if remote_status == "error":
            raise RuntimeError(status.get("error") or "Cloud scan failed")

        if time.time() - started > 3600:
            raise RuntimeError("Cloud scan timed out after 60 minutes")


def _run_scan_job(
    job_id: str,
    photos: dict[str, bytes],
    quality: str,
    client_name: str,
    patient_age: int | None = None,
    patient_record_id: str | None = None,
    patient_table_name: str | None = None,
    photo_urls: dict[str, str] | None = None,
    submission_id: str | None = None,
) -> None:
    """Background thread: submit to GCP Cloud Run, with severity-only fallback."""
    photo_urls = photo_urls or {}

    if len(photo_urls) >= 2:
        try:
            _run_deployed_scan_api_job(
                job_id,
                photo_urls,
                quality,
                client_name,
                patient_age,
                patient_record_id,
                patient_table_name,
                submission_id,
            )
            return
        except Exception as cloud_exc:
            print(f"[server] GCP scan failed: {cloud_exc}")
            _run_severity_only_completion(
                job_id,
                photos,
                client_name,
                patient_age,
                patient_record_id,
                patient_table_name,
                str(cloud_exc),
                submission_id,
            )
    else:
        _run_severity_only_completion(
            job_id,
            photos,
            client_name,
            patient_age,
            patient_record_id,
            patient_table_name,
            "Insufficient photo URLs to start GCP scan.",
            submission_id,
        )


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(title="3D Face Scan API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(_request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request, exc: Exception):
    print(f"[server] Unhandled error: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
    )


@app.post("/remove-bg")
async def remove_bg(body: dict) -> dict:
    """Background removal for the in-clinic MediaPipe scan (/clinic-scan/)."""
    try:
        from PIL import Image

        try:
            from rembg import remove as rembg_remove
        except ImportError as exc:
            raise HTTPException(
                503,
                "rembg not installed — pip install rembg for server-side background removal",
            ) from exc

        raw = body.get("image") or body.get("base64") or ""
        if not raw:
            raise HTTPException(400, "missing image")
        if isinstance(raw, str) and raw.startswith("data:"):
            raw = raw.split(",", 1)[-1]
        img_bytes = base64.b64decode(raw)
        img = Image.open(io.BytesIO(img_bytes)).convert("RGBA")
        out = rembg_remove(img)
        buf = io.BytesIO()
        out.save(buf, format="PNG")
        buf.seek(0)
        b64 = base64.b64encode(buf.read()).decode("ascii")
        return {"image": f"data:image/png;base64,{b64}"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, str(exc)) from exc


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/api/scan/submit")
async def submit_scan(body: dict) -> dict:
    """Start a GCP scan job.

    Body JSON:
        clientName: str
        quality: "draft" | "standard" | "high"
        photos: {front: URL, left90?: URL, right90?: URL, ...}
    """
    if httpx is None:
        raise HTTPException(503, "httpx not installed — run: pip install httpx")

    quality: str = body.get("quality", "standard")
    client_name: str = body.get("clientName", "client")
    photo_urls: dict[str, str] = body.get("photos", {})
    patient_age_raw = body.get("patientAge")
    patient_age = (
        int(patient_age_raw)
        if patient_age_raw is not None and str(patient_age_raw).strip().isdigit()
        else None
    )
    patient_record_id = str(body.get("recordId") or body.get("patientRecordId") or "").strip()
    patient_table_name = str(body.get("tableName") or body.get("patientTableName") or "Patients").strip()
    submission_id = str(body.get("submissionId") or body.get("submissionID") or "").strip()
    if not submission_id:
        submission_id = _generate_submission_id(client_name, patient_record_id)

    if not photo_urls:
        raise HTTPException(400, "No photos provided")
    if quality not in QUALITY_PRESETS:
        quality = "standard"

    # Prefer handing the job straight to the deployed worker: it persists
    # outputs to Airtable itself, so no client or thread has to stay alive.
    if len(photo_urls) >= 2:
        try:
            base = _deployed_scan_api_base()

            def _submit_remote() -> dict[str, Any]:
                with httpx.Client(timeout=60) as client:
                    response = client.post(
                        f"{base}/api/scan/submit",
                        json={
                            "clientName": client_name,
                            "quality": quality,
                            "photos": photo_urls,
                            "patientAge": patient_age,
                            "submissionId": submission_id,
                            "recordId": patient_record_id or "",
                            "tableName": patient_table_name or "Patients",
                        },
                    )
                    response.raise_for_status()
                    return response.json()

            remote = await asyncio.to_thread(_submit_remote)
            remote_job_id = str(remote.get("jobId") or "")
            if remote_job_id:
                return {
                    "jobId": remote_job_id,
                    "estimatedSeconds": int(
                        remote.get("estimatedSeconds")
                        or QUALITY_PRESETS[quality]["estimated"]
                    ),
                    "submissionId": submission_id,
                }
        except Exception as exc:
            print(f"[server] Direct worker submit failed: {exc}")
            if os.environ.get("VERCEL"):
                raise HTTPException(502, f"Scan worker submit failed: {exc}") from exc

    # Download all photos concurrently
    if httpx is None:
        raise HTTPException(503, "httpx not installed — run: pip install httpx")

    async def _fetch(key: str, url: str) -> tuple[str, bytes]:
        async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
            r = await client.get(url)
            r.raise_for_status()
            return key, r.content

    try:
        pairs = await asyncio.gather(*[_fetch(k, v) for k, v in photo_urls.items()])
    except Exception as exc:
        raise HTTPException(400, f"Failed to fetch photos: {exc}") from exc

    photos: dict[str, bytes] = dict(pairs)

    job_id = str(uuid.uuid4())
    with _jobs_lock:
        _jobs[job_id] = {
            "status": "queued",
            "started_at": time.time(),
            "quality": quality,
            "video_url": None,
            "auraAssets": None,
            "error": None,
            "message": None,
            "progress": 0.0,
            "submissionId": submission_id,
        }

    thread = threading.Thread(
        target=_run_scan_job,
        args=(
            job_id,
            photos,
            quality,
            client_name,
            patient_age,
            patient_record_id or None,
            patient_table_name,
            photo_urls,
            submission_id,
        ),
        daemon=True,
    )
    thread.start()

    return {
        "jobId": job_id,
        "estimatedSeconds": QUALITY_PRESETS[quality]["estimated"],
        "submissionId": submission_id,
    }


def _job_status_payload(job: dict[str, Any]) -> dict[str, Any]:
    status = job.get("status", "queued")
    elapsed = time.time() - job.get("started_at", time.time())
    q = QUALITY_PRESETS.get(job.get("quality", "standard"), QUALITY_PRESETS["standard"])
    estimated: int = q["estimated"]

    if status == "done":
        payload: dict[str, Any] = {
            "status": "done",
            "progress": 1.0,
            "videoUrl": job.get("video_url"),
            "analysisComplete": bool(job.get("analysisComplete") or job.get("severityScores")),
            "analysisMessage": job.get("analysisMessage"),
            "assetStatus": job.get("assetStatus", "ready"),
            "assetProgress": job.get("assetProgress", 1.0),
            "assetRemaining": job.get("assetRemaining", 0),
            "assetMessage": job.get("assetMessage"),
        }
        if job.get("auraAssets"):
            payload["auraAssets"] = job["auraAssets"]
        if job.get("severityScores"):
            payload["severityScores"] = job["severityScores"]
        if job.get("formSubmissionId"):
            payload["formSubmissionId"] = job["formSubmissionId"]
        if job.get("submissionId"):
            payload["submissionId"] = job["submissionId"]
        if job.get("patientRecordId"):
            payload["patientRecordId"] = job["patientRecordId"]
        if job.get("persistedToPatient") is not None:
            payload["persistedToPatient"] = job["persistedToPatient"]
        return payload

    if status == "partial":
        return {
            "status": "partial",
            "progress": 1.0,
            "message": job.get("message") or "Saved without 3D model",
            "warning": job.get("pipelineWarning") or job.get("error"),
            "error": job.get("error"),
            "severityScores": job.get("severityScores"),
            "formSubmissionId": job.get("formSubmissionId"),
            "submissionId": job.get("submissionId"),
            "patientRecordId": job.get("patientRecordId"),
            "persistedToPatient": job.get("persistedToPatient"),
        }

    if status == "error":
        return {"status": "error", "error": job.get("error", "Unknown error")}

    if status == "queued":
        return {"status": "queued", "progress": 0.01, "message": "Queued…"}

    raw = elapsed / max(estimated, 1)
    analysis_complete = bool(job.get("analysisComplete") or job.get("severityScores"))
    progress = round(min(0.95, 1.0 - 1.0 / (1.0 + raw * 2.6)), 3)
    remaining = 0 if analysis_complete else max(0, int(estimated - elapsed))
    return {
        "status": "running",
        "progress": 1.0 if analysis_complete else job.get("progress") or progress,
        "elapsed": int(elapsed),
        "remaining": remaining,
        "estimatedSeconds": estimated,
        "message": job.get("message") or _progress_message(progress),
        "analysisComplete": analysis_complete,
        "analysisMessage": job.get("analysisMessage"),
        "assetStatus": job.get("assetStatus"),
        "assetProgress": job.get("assetProgress"),
        "assetRemaining": job.get("assetRemaining"),
        "assetMessage": job.get("assetMessage"),
        **({"videoUrl": job["video_url"]} if job.get("video_url") else {}),
        **({"auraAssets": job["auraAssets"]} if job.get("auraAssets") else {}),
        **({"severityScores": job["severityScores"]} if job.get("severityScores") else {}),
        **({"submissionId": job["submissionId"]} if job.get("submissionId") else {}),
    }


def _fetch_remote_job_status(job_id: str) -> dict[str, Any] | None:
    """Proxy job status from the deployed scan worker (durable GCS-backed state).

    Lets stateless/serverless instances answer status polls for jobs they did
    not submit themselves.
    """
    if httpx is None:
        return None
    base = _deployed_scan_api_base()
    try:
        with httpx.Client(timeout=30) as client:
            response = client.get(f"{base}/api/scan/status/{job_id}")
        if "json" not in response.headers.get("content-type", ""):
            return None
        data = response.json()
        return data if isinstance(data, dict) else None
    except Exception as exc:
        print(f"[server] Remote status proxy failed for {job_id}: {exc}")
        return None


@app.get("/api/scan/status/{job_id}")
async def scan_status(job_id: str):
    """Job progress: SSE stream for locally tracked jobs, JSON proxy otherwise."""
    with _jobs_lock:
        known_locally = job_id in _jobs

    if not known_locally:
        remote = await asyncio.to_thread(_fetch_remote_job_status, job_id)
        if remote is None:
            remote = {"status": "error", "error": "Job not found"}
        return JSONResponse(remote)

    async def _stream() -> Any:
        while True:
            with _jobs_lock:
                job = _jobs.get(job_id)
            if not job:
                yield f"data: {json.dumps({'status': 'error', 'error': 'Job not found'})}\n\n"
                return

            data = _job_status_payload(job)
            yield f"data: {json.dumps(data)}\n\n"
            if data["status"] in ("done", "error"):
                return
            await asyncio.sleep(1.5)

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/scan/status/{job_id}/json")
async def scan_status_json(job_id: str) -> dict[str, Any]:
    """JSON snapshot of job progress (for simple client polling)."""
    with _jobs_lock:
        job = _jobs.get(job_id)
    if not job:
        remote = await asyncio.to_thread(_fetch_remote_job_status, job_id)
        if remote is not None:
            return remote
        raise HTTPException(404, "Job not found")
    return _job_status_payload(job)


@app.get("/api/scan/jobs")
async def list_jobs() -> dict:
    """Debug endpoint: list all in-memory jobs."""
    return {
        jid: {k: v for k, v in info.items() if k != "photos"}
        for jid, info in _jobs.items()
    }


# ---------------------------------------------------------------------------
# GCS + Airtable helpers for /api/scan/save-video
# ---------------------------------------------------------------------------

def _upload_to_gcs(local_path: Path, blob_name: str) -> str | None:
    """Upload a file to GCS and return its public URL, or None if not configured.

    Required env vars:
        GCS_TURNTABLE_BUCKET  — GCS bucket name (e.g. "my-app-turntables")
        GCS_SERVICE_ACCOUNT_JSON — full service-account JSON string
    """
    bucket_name = os.environ.get("GCS_TURNTABLE_BUCKET", "").strip()
    sa_json_str = os.environ.get("GCS_SERVICE_ACCOUNT_JSON", "").strip()

    if not bucket_name or not sa_json_str:
        print("[server] GCS_TURNTABLE_BUCKET or GCS_SERVICE_ACCOUNT_JSON not set — skipping upload")
        return None

    try:
        from google.cloud import storage as gcs_storage  # type: ignore
        from google.oauth2 import service_account as gcs_sa  # type: ignore

        sa_info = json.loads(sa_json_str)
        creds = gcs_sa.Credentials.from_service_account_info(
            sa_info,
            scopes=["https://www.googleapis.com/auth/cloud-platform"],
        )
        client = gcs_storage.Client(credentials=creds, project=sa_info.get("project_id"))
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        blob.upload_from_filename(str(local_path), content_type="video/mp4")
        blob.make_public()
        url = f"https://storage.googleapis.com/{bucket_name}/{blob_name}"
        print(f"[server] GCS upload OK → {url}")
        return url
    except ImportError:
        print("[server] google-cloud-storage not installed — run: pip install google-cloud-storage google-auth")
        return None
    except Exception as exc:
        print(f"[server] GCS upload failed: {exc}")
        return None


def _update_airtable_scan_urls(
    record_id: str,
    table_name: str,
    video_url: str,
    aura_manifest_url: str | None = None,
    aura_gcs_prefix: str | None = None,
    severity_doc: dict[str, Any] | None = None,
) -> bool:
    """PATCH scan URL fields (and optional severity JSON) on an Airtable record."""
    if httpx is None:
        print("[server] httpx not available — cannot update Airtable")
        return False

    try:
        airtable_mod = _load_script_module(
            "scan_airtable",
            Path(__file__).parent / "scripts" / "scan_airtable.py",
        )
        return airtable_mod.update_airtable_scan_urls(
            record_id,
            table_name,
            video_url,
            aura_manifest_url,
            aura_gcs_prefix,
            severity_doc,
        )
    except Exception as exc:
        print(f"[server] Airtable update failed: {exc}")
        return False


def _persist_scan_outputs_to_patient(
    job_id: str,
    record_id: str,
    table_name: str,
) -> bool:
    """Upload turntable to GCS and write scan outputs onto the patient record."""
    job = _jobs.get(job_id)
    if not job or job.get("status") != "done":
        return False

    local_url: str = job.get("video_url", "")
    if not local_url:
        return False

    local_path = PUBLIC_3D / Path(local_url).name
    if not local_path.exists():
        print(f"[server] Cannot persist scan outputs — missing file {local_path}")
        return False

    blob_name = f"turntables/{local_path.name}"
    gcs_url = _upload_to_gcs(local_path, blob_name)
    if not gcs_url:
        gcs_url = local_url

    aura_assets = job.get("auraAssets")
    aura_manifest_url = None
    aura_gcs_prefix = None
    if aura_assets and isinstance(aura_assets, dict):
        slug = local_path.stem.replace("-turntable-seek", "").replace("-turntable", "")
        aura_dir = PUBLIC_3D / slug
        if aura_dir.exists():
            try:
                gcs_mod = _load_script_module(
                    "scan_aura_gcs",
                    Path(__file__).parent / "scripts" / "scan_aura_gcs.py",
                )
                uploaded = gcs_mod.upload_aura_manifest_to_gcs(
                    slug,
                    aura_dir,
                    aura_assets,
                )
                if uploaded:
                    aura_assets = uploaded
                    aura_assets["turntableVideoUrl"] = gcs_url
                    job["auraAssets"] = aura_assets
                    bucket_name = (
                        os.environ.get("GCS_TURNTABLE_BUCKET", "").strip()
                        or os.environ.get("GCS_BLUEPRINT_BUCKET", "").strip()
                        or os.environ.get("GCS_SCAN_BUCKET", "").strip()
                    )
                    if bucket_name:
                        aura_manifest_url = (
                            f"https://storage.googleapis.com/{bucket_name}/"
                            f"aura/{slug}/{slug}-aura-manifest.json"
                        )
                        aura_gcs_prefix = f"gs://{bucket_name}/aura/{slug}/"
            except Exception as exc:
                print(f"[server] Aura GCS upload on clinic-scan persist failed: {exc}")

    severity_doc = job.get("severityScores")
    if not isinstance(severity_doc, dict):
        severity_doc = None

    persisted = _update_airtable_scan_urls(
        record_id,
        table_name,
        gcs_url,
        aura_manifest_url,
        aura_gcs_prefix,
        severity_doc,
    )
    job["persistedToPatient"] = persisted
    job["video_url"] = gcs_url
    return persisted


def _decode_data_url(value: str) -> tuple[bytes, str]:
    """Return (bytes, content_type) from a data URL or raw base64 string."""
    raw = str(value or "").strip()
    if not raw:
        raise ValueError("empty image payload")
    if raw.startswith("data:"):
        header, encoded = raw.split(",", 1)
        content_type = header.split(";")[0].replace("data:", "") or "image/jpeg"
        return base64.b64decode(encoded), content_type
    return base64.b64decode(raw), "image/jpeg"


def _upload_clinic_photo_to_gcs(
    data: bytes,
    blob_name: str,
    content_type: str = "image/jpeg",
) -> str | None:
    bucket_name = (
        os.environ.get("GCS_TURNTABLE_BUCKET", "").strip()
        or os.environ.get("GCS_BLUEPRINT_BUCKET", "").strip()
        or os.environ.get("GCS_SCAN_BUCKET", "").strip()
    )
    sa_json_str = os.environ.get("GCS_SERVICE_ACCOUNT_JSON", "").strip()
    if not bucket_name or not sa_json_str:
        return None

    try:
        from google.cloud import storage as gcs_storage  # type: ignore
        from google.oauth2 import service_account as gcs_sa  # type: ignore

        sa_info = json.loads(sa_json_str)
        creds = gcs_sa.Credentials.from_service_account_info(
            sa_info,
            scopes=["https://www.googleapis.com/auth/cloud-platform"],
        )
        client = gcs_storage.Client(credentials=creds, project=sa_info.get("project_id"))
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        blob.upload_from_string(data, content_type=content_type)
        blob.make_public()
        return f"https://storage.googleapis.com/{bucket_name}/{blob_name}"
    except Exception as exc:
        print(f"[server] Clinic photo GCS upload failed: {exc}")
        return None


def _map_clinic_photos_for_pipeline(photos: dict[str, bytes]) -> dict[str, bytes]:
    """Normalize clinic scan slot keys to pipeline keys."""
    slot_to_pipeline = {
        "front": "front",
        "left45": "left45",
        "right45": "right45",
        "left90": "left90",
        "right90": "right90",
    }
    mapped: dict[str, bytes] = {}
    for key, data in photos.items():
        pipeline_key = slot_to_pipeline.get(key, key)
        mapped[pipeline_key] = data
    return mapped


@app.post("/api/clinic-scan/submit")
async def submit_clinic_scan(body: dict) -> dict:
    """Create a Form Submissions row, then run 3D + severity pipelines.

    Body JSON:
        providerName, providerId (optional)
        firstName, lastName, email, phone
        whatAreas, faceFocusRegions, skinComplaints
        patientRecordId, patientTableName (optional — linked existing chart)
        photos: { front?: dataUrl, left45?, right45?, left90?, right90? }
        quality: draft | standard | high (optional)
        patientAge: number (optional)
    """
    if httpx is None:
        raise HTTPException(503, "httpx not installed — pip install httpx and run scan-server")

    intake = body.get("intake") if isinstance(body.get("intake"), dict) else body
    provider_name = str(body.get("providerName") or intake.get("providerName") or "").strip()
    provider_id = str(body.get("providerId") or intake.get("providerId") or "").strip()
    first_name = str(intake.get("firstName") or "").strip()
    last_name = str(intake.get("lastName") or "").strip()
    email = str(intake.get("email") or "").strip().lower()
    phone = str(intake.get("phone") or "").strip()
    what_areas = intake.get("whatAreas") or []
    face_regions = intake.get("faceFocusRegions") or []
    skin_complaints = intake.get("skinComplaints") or []
    patient_record_id = str(
        body.get("patientRecordId") or intake.get("patientRecordId") or ""
    ).strip()
    patient_table_name = str(
        body.get("patientTableName") or intake.get("patientTableName") or "Patients"
    ).strip()
    quality = str(body.get("quality") or "standard")
    if quality not in QUALITY_PRESETS:
        quality = "standard"

    patient_age_raw = body.get("patientAge") or intake.get("patientAge")
    patient_age = (
        int(patient_age_raw)
        if patient_age_raw is not None and str(patient_age_raw).strip().isdigit()
        else None
    )

    raw_photos = body.get("photos") or {}
    if not isinstance(raw_photos, dict) or not raw_photos:
        raise HTTPException(400, "No photos provided")

    photos: dict[str, bytes] = {}
    photo_content_types: dict[str, str] = {}
    for key, value in raw_photos.items():
        if not value:
            continue
        try:
            data, content_type = _decode_data_url(str(value))
        except Exception as exc:
            raise HTTPException(400, f"Invalid photo payload for {key}: {exc}") from exc
        if not data:
            continue
        photos[str(key)] = data
        photo_content_types[str(key)] = content_type

    if len(photos) < 2:
        raise HTTPException(400, "At least two photos are required")

    clinic_airtable = None
    try:
        clinic_airtable = _load_script_module(
            "clinic_scan_airtable",
            Path(__file__).parent / "scripts" / "clinic_scan_airtable.py",
        )
    except Exception as exc:
        print(f"[server] Clinic scan Airtable helper unavailable: {exc}")

    patient_match_source: str | None = None
    patient_created = False
    if patient_record_id:
        patient_match_source = "selected"

    client_name = " ".join(x for x in [first_name, last_name] if x).strip() or email or "client"
    slug = (
        client_name.lower()
        .replace(" ", "-")
        .replace("/", "-")
        .replace(".", "")
    )
    submission_id = str(body.get("submissionId") or intake.get("submissionId") or "").strip()
    if not submission_id:
        submission_id = _generate_submission_id(client_name, email, provider_id)
    submission_prefix = f"clinic-scan/{slug}-{submission_id}"

    photo_urls: dict[str, str] = {}
    photo_attachments: dict[str, list[dict[str, str]]] = {}
    attachment_map = {
        "front": "front",
        "right90": "side",
        "left90": "left_side",
    }
    for slot_key, data in photos.items():
        ext = "png" if photo_content_types.get(slot_key, "").endswith("png") else "jpg"
        gcs_url = await asyncio.to_thread(
            _upload_clinic_photo_to_gcs,
            data,
            f"{submission_prefix}/{slot_key}.{ext}",
            photo_content_types.get(slot_key, "image/jpeg"),
        )
        if gcs_url:
            photo_urls[slot_key] = gcs_url
            attachment_key = attachment_map.get(slot_key)
            if attachment_key:
                photo_attachments[attachment_key] = [
                    {"url": gcs_url, "filename": f"{slot_key}.{ext}"}
                ]

    form_submission_id: str | None = None
    if clinic_airtable:
        try:
            form_fields = clinic_airtable.build_form_submission_fields(
                provider_name=provider_name,
                first_name=first_name,
                last_name=last_name,
                email=email,
                phone=phone,
                what_areas=list(what_areas) if isinstance(what_areas, list) else [],
                face_regions=list(face_regions) if isinstance(face_regions, list) else [],
                skin_complaints=list(skin_complaints) if isinstance(skin_complaints, list) else [],
                photo_attachments=photo_attachments or None,
                patient_record_id=patient_record_id or None,
                submission_id=submission_id,
            )
            form_submission_id = await asyncio.to_thread(
                clinic_airtable.create_form_submission_record,
                form_fields,
            )
        except Exception as exc:
            print(f"[server] Form Submissions create failed: {exc}")

    if clinic_airtable and not patient_record_id and form_submission_id and email:
        for _ in range(10):
            try:
                patient_match = await asyncio.to_thread(
                    clinic_airtable.find_patient_record_for_clinic_scan,
                    email,
                    provider_id,
                )
                if patient_match and patient_match.get("id"):
                    patient_record_id = str(patient_match["id"])
                    patient_table_name = str(patient_match.get("tableName") or "Patients")
                    patient_match_source = "form-submission"
                    print(
                        f"[server] Clinic scan matched form-created patient {patient_record_id} by email {email}"
                    )
                    break
            except Exception as exc:
                print(f"[server] Clinic scan patient post-form lookup failed: {exc}")
                break
            await asyncio.sleep(0.75)

    if clinic_airtable and patient_record_id and patient_table_name == "Patients":
        try:
            await asyncio.to_thread(
                clinic_airtable.patch_patient_record_from_clinic_scan,
                patient_record_id,
                provider_id=provider_id or None,
                first_name=first_name,
                last_name=last_name,
                email=email,
                phone=phone,
                photo_attachments=photo_attachments or None,
            )
        except Exception as exc:
            print(f"[server] Clinic scan patient enrichment patch failed: {exc}")
        if form_submission_id:
            try:
                await asyncio.to_thread(
                    clinic_airtable.link_form_submission_to_patient,
                    form_submission_id,
                    patient_record_id,
                )
            except Exception as exc:
                print(f"[server] Clinic scan form-patient link patch failed: {exc}")

    # Submit straight to the deployed scan worker with the Airtable context.
    # The worker owns persistence (patient fields + Analyses row keyed by this
    # submission ID), so results land in Airtable even after the clinic scan
    # window — and this serverless process — are gone.
    remote_job_id = ""
    remote_estimated = QUALITY_PRESETS[quality]["estimated"]
    remote_error: str | None = None
    if len(photo_urls) >= 2:
        try:
            base = _deployed_scan_api_base()
            with httpx.Client(timeout=60) as client:
                response = client.post(
                    f"{base}/api/scan/submit",
                    json={
                        "clientName": client_name,
                        "quality": quality,
                        "photos": photo_urls,
                        "patientAge": patient_age,
                        "submissionId": submission_id,
                        "recordId": patient_record_id or "",
                        "tableName": patient_table_name or "Patients",
                        "providerId": provider_id or "",
                        "formSubmissionId": form_submission_id or "",
                        "patientEmail": email or "",
                    },
                )
                response.raise_for_status()
                remote = response.json()
            remote_job_id = str(remote.get("jobId") or "")
            remote_estimated = int(remote.get("estimatedSeconds") or remote_estimated)
        except Exception as exc:
            remote_error = str(exc)
            print(f"[server] Clinic scan worker submit failed: {remote_error}")
    else:
        remote_error = (
            "Photos could not be uploaded to GCS — set GCS_TURNTABLE_BUCKET/"
            "GCS_BLUEPRINT_BUCKET and GCS_SERVICE_ACCOUNT_JSON."
        )

    if remote_job_id:
        return {
            "jobId": remote_job_id,
            "formSubmissionId": form_submission_id,
            "submissionId": submission_id,
            "estimatedSeconds": remote_estimated,
            "patientRecordId": patient_record_id or None,
            "patientTableName": patient_table_name,
            "patientCreated": patient_created,
            "patientMatchedBy": patient_match_source,
        }

    if os.environ.get("VERCEL"):
        # No background threads survive on serverless; report the failure
        # instead of pretending a local job is running.
        raise HTTPException(
            502,
            f"Photos saved to Form Submissions, but the scan pipeline could not start: {remote_error}",
        )

    # Local development fallback: run the legacy in-process pipeline.
    pipeline_photos = _map_clinic_photos_for_pipeline(photos)
    job_id = str(uuid.uuid4())
    with _jobs_lock:
        _jobs[job_id] = {
            "status": "queued",
            "started_at": time.time(),
            "quality": quality,
            "video_url": None,
            "auraAssets": None,
            "severityScores": None,
            "error": None,
            "message": "Queued",
            "progress": 0.0,
            "formSubmissionId": form_submission_id,
            "submissionId": submission_id,
            "patientRecordId": patient_record_id or None,
            "patientMatchedBy": patient_match_source,
            "photoUrls": photo_urls,
        }

    thread = threading.Thread(
        target=_run_scan_job,
        args=(
            job_id,
            pipeline_photos,
            quality,
            client_name,
            patient_age,
            patient_record_id or None,
            patient_table_name,
            photo_urls,
            submission_id,
        ),
        daemon=True,
    )
    thread.start()

    return {
        "jobId": job_id,
        "formSubmissionId": form_submission_id,
        "submissionId": submission_id,
        "estimatedSeconds": QUALITY_PRESETS[quality]["estimated"],
        "patientRecordId": patient_record_id or None,
        "patientTableName": patient_table_name,
        "patientCreated": patient_created,
        "patientMatchedBy": patient_match_source,
    }


@app.post("/api/scan/save-video")
async def save_video(body: dict) -> dict:
    """Upload the finished turntable to GCS and persist the URL in Airtable.

    Body JSON:
        jobId:     str   — job ID returned by /api/scan/submit
        recordId:  str   — Airtable record ID (recXXX...)
        tableName: str   — Airtable table name (e.g. "Patients")

    Returns:
        { videoUrl: str, persisted: bool }
        videoUrl  — GCS URL if upload succeeded, otherwise the local /demo-3d path
        persisted — true if Airtable was also updated
    """
    job_id: str = body.get("jobId", "")
    record_id: str = body.get("recordId", "")
    table_name: str = body.get("tableName", "Patients")
    include_severity = bool(body.get("includeSeverity"))

    if not job_id or not record_id:
        raise HTTPException(400, "jobId and recordId are required")

    job = _jobs.get(job_id)
    if not job:
        # Job ran on the deployed worker (or on another serverless instance):
        # fetch its durable state and persist from here.
        remote = await asyncio.to_thread(_fetch_remote_job_status, job_id)
        if not remote or (
            remote.get("status") == "error"
            and str(remote.get("error") or "") == "Job not found"
        ):
            raise HTTPException(404, f"Job {job_id!r} not found")
        if remote.get("status") == "error":
            raise HTTPException(502, str(remote.get("error") or "Scan worker failed"))

        remote_severity = remote.get("severityScores")
        if not isinstance(remote_severity, dict):
            remote_severity = None
        remote_video_url = str(remote.get("videoUrl") or "").strip() or None
        remote_aura = remote.get("auraAssets")
        if not isinstance(remote_aura, dict):
            remote_aura = None

        if not remote_severity and not remote_video_url and not remote_aura:
            raise HTTPException(
                409,
                f"No scan outputs ready yet (status: {remote.get('status') or 'unknown'})",
            )

        persisted = await asyncio.to_thread(
            _persist_remote_scan_outputs,
            record_id=record_id,
            table_name=table_name,
            video_url=remote_video_url,
            aura_assets=remote_aura,
            severity_doc=remote_severity if include_severity or remote_video_url else None,
            submission_id=str(
                body.get("submissionId") or remote.get("submissionId") or ""
            ).strip()
            or None,
            provider_id=str(body.get("providerId") or "").strip() or None,
            patient_name=str(body.get("patientName") or "").strip() or None,
            patient_email=str(body.get("patientEmail") or "").strip() or None,
        )
        return {
            "videoUrl": remote_video_url,
            "persisted": persisted,
            "severityPersisted": bool(persisted and remote_severity),
            "auraAssets": remote_aura,
            "severityScores": remote_severity,
            "status": remote.get("status"),
        }
    severity_doc = job.get("severityScores")
    if not isinstance(severity_doc, dict):
        severity_doc = None
    if job.get("status") != "done" and include_severity and severity_doc:
        persisted = await asyncio.to_thread(
            _persist_remote_scan_outputs,
            record_id=record_id,
            table_name=table_name,
            video_url=None,
            aura_assets=None,
            severity_doc=severity_doc,
        )
        job["severityPersisted"] = persisted
        return {
            "videoUrl": job.get("video_url"),
            "persisted": persisted,
            "severityPersisted": persisted,
            "auraAssets": job.get("auraAssets"),
            "severityScores": severity_doc,
        }
    if job.get("status") != "done":
        raise HTTPException(400, f"Job {job_id!r} is not done (status: {job.get('status')!r})")

    local_url: str = job.get("video_url", "")
    if not local_url:
        if include_severity and severity_doc:
            persisted = await asyncio.to_thread(
                _persist_remote_scan_outputs,
                record_id=record_id,
                table_name=table_name,
                video_url=None,
                aura_assets=None,
                severity_doc=severity_doc,
            )
            job["severityPersisted"] = persisted
            return {
                "videoUrl": None,
                "persisted": persisted,
                "severityPersisted": persisted,
                "auraAssets": job.get("auraAssets"),
                "severityScores": severity_doc,
            }
        raise HTTPException(500, "Job has no video_url — reconstruction may have failed")

    # Resolve local filesystem path from the /demo-3d/… URL stored in the job
    local_path = PUBLIC_3D / Path(local_url).name
    if not local_path.exists():
        raise HTTPException(404, f"Video file not found on disk: {local_path}")

    # Derive a stable GCS blob name from the filename so re-runs overwrite rather than accumulate
    blob_name = f"turntables/{local_path.name}"

    gcs_url = await asyncio.to_thread(_upload_to_gcs, local_path, blob_name)

    if not gcs_url:
        # GCS not configured or failed — return the local URL so the viewer still works
        # this session, but Airtable is not updated.
        return {"videoUrl": local_url, "persisted": False}

    aura_assets = job.get("auraAssets")
    aura_manifest_url = None
    aura_gcs_prefix = None
    if aura_assets and isinstance(aura_assets, dict):
        slug = local_path.stem.replace("-turntable-seek", "").replace("-turntable", "")
        aura_dir = PUBLIC_3D / slug
        if aura_dir.exists():
            try:
                import importlib.util

                gcs_spec = importlib.util.spec_from_file_location(
                    "scan_aura_gcs",
                    Path(__file__).parent / "scripts" / "scan_aura_gcs.py",
                )
                if gcs_spec and gcs_spec.loader:
                    gcs_mod = importlib.util.module_from_spec(gcs_spec)
                    gcs_spec.loader.exec_module(gcs_mod)
                    uploaded = gcs_mod.upload_aura_manifest_to_gcs(
                        slug,
                        aura_dir,
                        aura_assets,
                    )
                    if uploaded:
                        aura_assets = uploaded
                        aura_assets["turntableVideoUrl"] = gcs_url
                        job["auraAssets"] = aura_assets
                        bucket_name = (
                            os.environ.get("GCS_TURNTABLE_BUCKET", "").strip()
                            or os.environ.get("GCS_BLUEPRINT_BUCKET", "").strip()
                            or os.environ.get("GCS_SCAN_BUCKET", "").strip()
                        )
                        if bucket_name:
                            aura_manifest_url = f"https://storage.googleapis.com/{bucket_name}/aura/{slug}/{slug}-aura-manifest.json"
                            aura_gcs_prefix = f"gs://{bucket_name}/aura/{slug}/"
            except Exception as exc:
                print(f"[server] Aura GCS upload on save-video failed: {exc}")

    persisted = await asyncio.to_thread(
        _update_airtable_scan_urls,
        record_id,
        table_name,
        gcs_url,
        aura_manifest_url,
        aura_gcs_prefix,
        severity_doc,
    )

    return {
        "videoUrl": gcs_url,
        "persisted": persisted,
        "auraAssets": aura_assets,
        "severityScores": severity_doc,
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8787, reload=False)
