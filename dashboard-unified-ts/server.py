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
import subprocess
import sys
import threading
import time
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

        # Reference the deployed function by name — works from any Python process
        # as long as `modal deploy scripts/modal_facelift.py` has been run once.
        fn = _modal.Function.from_name(_MODAL_APP_NAME, _MODAL_FN_NAME)
        result: dict[str, bytes] = fn.remote(
            photos,
            step_2d=q["step_2d"],
        )

        if "turntable.mp4" not in result:
            raise RuntimeError(
                f"FaceLift did not produce turntable.mp4. Got: {list(result.keys())}"
            )

        safe = (
            client_name.lower()
            .replace(" ", "-")
            .replace("/", "-")
            .replace(".", "")
        )
        out_path = PUBLIC_3D / f"{safe}-turntable.mp4"
        out_path.write_bytes(result["turntable.mp4"])
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


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8787, reload=False)
