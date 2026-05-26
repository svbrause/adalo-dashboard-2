#!/usr/bin/env python3
"""
Local API server for 3D face scan job submission via Modal.

Usage:
  pip install fastapi uvicorn httpx
  python3 server.py

The Vite dev server proxies /api/* here.  Modal is invoked in a background
thread so the HTTP response returns immediately with a job ID; the client
polls GET /api/scan/status/{jobId} via Server-Sent Events for progress.
"""
from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
import threading
import time
import urllib.parse
import uuid
from pathlib import Path
from typing import Any

try:
    import httpx
except ImportError:
    httpx = None  # type: ignore

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

# ---------------------------------------------------------------------------
# Modal integration
# ---------------------------------------------------------------------------
try:
    import modal as _modal
    MODAL_AVAILABLE = True
except ImportError:
    _modal = None  # type: ignore
    MODAL_AVAILABLE = False
    print("[server] modal package not found; scan jobs will fail. Run: pip install modal")

# App name and function name as defined in modal_facelift.py
_MODAL_APP_NAME = "try3d-facelift"
_MODAL_FN_NAME  = "reconstruct_multi"

# Where generated turntable videos land (served by Vite as static assets)
PUBLIC_3D = Path(__file__).parent / "public" / "demo-3d"
PUBLIC_3D.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Quality presets
# ---------------------------------------------------------------------------
QUALITY_PRESETS: dict[str, dict[str, Any]] = {
    "ultra":    {"step_2d": 8,   "estimated": 55},
    "draft":    {"step_2d": 30,  "estimated": 120},
    "standard": {"step_2d": 62,  "estimated": 210},
    "high":     {"step_2d": 100, "estimated": 330},
}

# ---------------------------------------------------------------------------
# In-memory job store
# ---------------------------------------------------------------------------
# job_id -> {status, started_at, quality, video_url, error}
_jobs: dict[str, dict[str, Any]] = {}


def _progress_message(p: float) -> str:
    if p < 0.05: return "Connecting to Modal…"
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


def _run_modal_job(
    job_id: str,
    photos: dict[str, bytes],
    quality: str,
    client_name: str,
) -> None:
    """Background thread: calls Modal via function lookup, writes turntable.mp4."""
    try:
        q = QUALITY_PRESETS.get(quality, QUALITY_PRESETS["standard"])
        _jobs[job_id]["status"] = "running"

        # Step 1: reconstruct — returns gaussians.ply + raw turntable (white bg)
        fn_reconstruct = _modal.Function.from_name(_MODAL_APP_NAME, _MODAL_FN_NAME)
        result: dict[str, bytes] = fn_reconstruct.remote(photos, step_2d=q["step_2d"])

        # Step 2: if PLY is available, apply face crop + black-background rerender
        # to match the production Modal path (render_turntable_black, 130° sweep).
        ply_bytes = result.get("gaussians.ply")
        if ply_bytes:
            fn_crop   = _modal.Function.from_name(_MODAL_APP_NAME, "_crop_ply")
            fn_render = _modal.Function.from_name(_MODAL_APP_NAME, "render_turntable_black")
            cropped_ply = fn_crop.remote(ply_bytes)
            video_bytes = fn_render.remote(
                cropped_ply, resolution=2048, num_views=120, fps=30, sweep_deg=130,
            )
        elif "turntable.mp4" in result:
            # Fallback: use raw white-bg turntable (crop unavailable)
            video_bytes = result["turntable.mp4"]
        else:
            raise RuntimeError(
                f"FaceLift produced neither gaussians.ply nor turntable.mp4. "
                f"Got: {list(result.keys())}"
            )

        safe = (
            client_name.lower()
            .replace(" ", "-")
            .replace("/", "-")
            .replace(".", "")
        )
        out_path = PUBLIC_3D / f"{safe}-turntable.mp4"
        out_path.write_bytes(video_bytes)
        seek_path = PUBLIC_3D / f"{safe}-turntable-seek.mp4"
        video_path = seek_path if _make_seek_friendly_turntable(out_path, seek_path) else out_path

        _jobs[job_id]["status"] = "done"
        _jobs[job_id]["video_url"] = f"/demo-3d/{video_path.name}"

    except Exception as exc:
        _jobs[job_id]["status"] = "error"
        _jobs[job_id]["error"] = str(exc)
        print(f"[server] Job {job_id} failed: {exc}")


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


@app.post("/api/scan/submit")
async def submit_scan(body: dict) -> dict:
    """Start a Modal reconstruction job.

    Body JSON:
        clientName: str
        quality: "draft" | "standard" | "high"
        photos: {front: URL, left90?: URL, right90?: URL, ...}
    """
    if not MODAL_AVAILABLE:
        raise HTTPException(503, "Modal is not available on this machine")

    quality: str = body.get("quality", "standard")
    client_name: str = body.get("clientName", "client")
    photo_urls: dict[str, str] = body.get("photos", {})

    if not photo_urls:
        raise HTTPException(400, "No photos provided")
    if quality not in QUALITY_PRESETS:
        quality = "standard"

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
    _jobs[job_id] = {
        "status": "queued",
        "started_at": time.time(),
        "quality": quality,
        "video_url": None,
        "error": None,
    }

    thread = threading.Thread(
        target=_run_modal_job,
        args=(job_id, photos, quality, client_name),
        daemon=True,
    )
    thread.start()

    return {
        "jobId": job_id,
        "estimatedSeconds": QUALITY_PRESETS[quality]["estimated"],
    }


@app.get("/api/scan/status/{job_id}")
async def scan_status(job_id: str) -> StreamingResponse:
    """Server-Sent Events stream with progress updates every ~1.5 s."""

    async def _stream() -> Any:
        while True:
            job = _jobs.get(job_id)
            if not job:
                yield f"data: {json.dumps({'status': 'error', 'error': 'Job not found'})}\n\n"
                return

            status = job["status"]
            elapsed = time.time() - job["started_at"]
            q = QUALITY_PRESETS.get(job.get("quality", "standard"), QUALITY_PRESETS["standard"])
            estimated: int = q["estimated"]

            if status == "done":
                yield f"data: {json.dumps({'status': 'done', 'progress': 1.0, 'videoUrl': job['video_url']})}\n\n"
                return

            if status == "error":
                yield f"data: {json.dumps({'status': 'error', 'error': job.get('error', 'Unknown error')})}\n\n"
                return

            if status == "queued":
                data = {"status": "queued", "progress": 0.01, "message": "Queued…"}
            else:  # running
                # Sigmoid-style ramp: approaches 0.95 asymptotically
                raw = elapsed / max(estimated, 1)
                progress = round(min(0.95, 1.0 - 1.0 / (1.0 + raw * 2.6)), 3)
                remaining = max(0, int(estimated - elapsed))
                data = {
                    "status": "running",
                    "progress": progress,
                    "elapsed": int(elapsed),
                    "remaining": remaining,
                    "message": _progress_message(progress),
                }

            yield f"data: {json.dumps(data)}\n\n"
            await asyncio.sleep(1.5)

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


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


def _update_airtable_turntable_url(record_id: str, table_name: str, video_url: str) -> bool:
    """PATCH the 'Turntable Video URL' field on an Airtable record.

    Required env vars:
        AIRTABLE_API_TOKEN  — personal access token (patXXX...)
        AIRTABLE_BASE_ID    — base ID (appXXX...)
    """
    api_token = os.environ.get("AIRTABLE_API_TOKEN", "").strip()
    base_id = os.environ.get("AIRTABLE_BASE_ID", "").strip()

    if not api_token or not base_id:
        print("[server] AIRTABLE_API_TOKEN or AIRTABLE_BASE_ID not set — skipping Airtable update")
        return False

    if httpx is None:
        print("[server] httpx not available — cannot update Airtable")
        return False

    try:
        encoded_table = urllib.parse.quote(table_name, safe="")
        url = f"https://api.airtable.com/v0/{base_id}/{encoded_table}/{record_id}"
        r = httpx.patch(
            url,
            json={"fields": {"Turntable Video URL": video_url}},
            headers={
                "Authorization": f"Bearer {api_token}",
                "Content-Type": "application/json",
            },
            timeout=15,
            follow_redirects=True,
        )
        r.raise_for_status()
        print(f"[server] Airtable record {record_id} updated with turntable URL")
        return True
    except Exception as exc:
        print(f"[server] Airtable update failed: {exc}")
        return False


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

    if not job_id or not record_id:
        raise HTTPException(400, "jobId and recordId are required")

    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(404, f"Job {job_id!r} not found")
    if job.get("status") != "done":
        raise HTTPException(400, f"Job {job_id!r} is not done (status: {job.get('status')!r})")

    local_url: str = job.get("video_url", "")
    if not local_url:
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

    persisted = await asyncio.to_thread(_update_airtable_turntable_url, record_id, table_name, gcs_url)
    return {"videoUrl": gcs_url, "persisted": persisted}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8787, reload=False)
