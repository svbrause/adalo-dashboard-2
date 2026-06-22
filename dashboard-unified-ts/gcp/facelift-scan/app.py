from __future__ import annotations

import base64
import hashlib
import io
import json
import math
import os
import queue
import subprocess
import tempfile
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

import httpx
import numpy as np
from fastapi import Body, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from plyfile import PlyData, PlyElement

FACELIFT_DIR = Path(os.environ.get("FACELIFT_DIR", "/opt/FaceLift"))
AURA_SCRIPT_DIR = Path(__file__).resolve().parent / "aura_scripts"

QUALITY_PRESETS: dict[str, dict[str, int]] = {
    "ultra": {"step_2d": 8, "estimated": 180},
    "draft": {"step_2d": 30, "estimated": 120},
    "standard": {"step_2d": 62, "estimated": 180},
    "high": {"step_2d": 100, "estimated": 300},
}

jobs: dict[str, dict[str, Any]] = {}
jobs_lock = threading.Lock()
local_job_queue: queue.Queue[str] = queue.Queue()
local_worker_started = False
local_worker_lock = threading.Lock()

app = FastAPI(title="Ponce FaceLift Scan API on GCP")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() not in {"0", "false", "no", "off"}


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _scan_3d_enabled() -> bool:
    if _env_bool("DISABLE_SCAN_3D", False):
        return False
    return _env_bool("SCAN_3D_ENABLED", True)


def _estimated_seconds(quality: str) -> int:
    estimated = QUALITY_PRESETS.get(quality, QUALITY_PRESETS["standard"])["estimated"]
    if _scan_3d_enabled():
        return estimated
    analysis_estimated = _env_int("SCAN_ANALYSIS_ESTIMATED_SECONDS", 180)
    return min(estimated, analysis_estimated)


def _job_bucket_name() -> str:
    return (
        os.environ.get("GCS_TURNTABLE_BUCKET", "").strip()
        or os.environ.get("GCS_BLUEPRINT_BUCKET", "").strip()
        or os.environ.get("GCS_SCAN_BUCKET", "").strip()
    )


def _job_blob_name(job_id: str) -> str:
    prefix = os.environ.get("SCAN_JOB_STATE_PREFIX", "scan-jobs").strip().strip("/")
    return f"{prefix}/{job_id}.json"


def _persist_job(job_id: str, job: dict[str, Any]) -> None:
    bucket_name = _job_bucket_name()
    if not bucket_name:
        return
    try:
        from google.cloud import storage

        storage.Client().bucket(bucket_name).blob(_job_blob_name(job_id)).upload_from_string(
            json.dumps(job, ensure_ascii=False),
            content_type="application/json",
        )
    except Exception as exc:
        print(f"[scan-queue] Failed to persist job {job_id}: {exc}", flush=True)


def _load_job(job_id: str) -> dict[str, Any] | None:
    with jobs_lock:
        if job_id in jobs:
            return dict(jobs[job_id])

    bucket_name = _job_bucket_name()
    if not bucket_name:
        return None
    try:
        from google.cloud import storage

        blob = storage.Client().bucket(bucket_name).blob(_job_blob_name(job_id))
        if not blob.exists():
            return None
        job = json.loads(blob.download_as_text())
        if isinstance(job, dict):
            with jobs_lock:
                jobs[job_id] = dict(job)
            return dict(job)
    except Exception as exc:
        print(f"[scan-queue] Failed to load job {job_id}: {exc}", flush=True)
    return None


def _set_job(job_id: str, **fields: Any) -> None:
    with jobs_lock:
        current = dict(jobs.get(job_id, {}))
        current.update(fields)
        current["updated_at"] = time.time()
        jobs[job_id] = current
    _persist_job(job_id, current)


def _public_job_payload(job_id: str, job: dict[str, Any]) -> dict[str, Any]:
    status = job.get("status", "queued")
    elapsed = time.time() - float(job.get("started_at", time.time()))
    quality = str(job.get("quality") or "standard")
    estimated = _estimated_seconds(quality)
    progress = float(job.get("progress") or min(0.95, elapsed / max(estimated, 1)))
    payload: dict[str, Any] = {
        "jobId": job_id,
        "status": status,
        "progress": progress,
        "message": job.get("message") or _progress_message(progress),
        "elapsed": int(elapsed),
        "remaining": 0 if status in ("done", "partial", "error") else max(0, int(estimated - elapsed)),
    }
    for key in (
        "videoUrl",
        "videoBase64",
        "auraAssets",
        "severityScores",
        "analysisComplete",
        "analysisMessage",
        "assetStatus",
        "assetProgress",
        "assetRemaining",
        "assetMessage",
        "queueMode",
        "submissionId",
        "formSubmissionId",
        "recordId",
        "tableName",
        "persistedToPatient",
        "severityPersisted",
        "error",
    ):
        if job.get(key) is not None:
            payload[key] = job[key]
    return payload


def _slugify(name: str) -> str:
    return name.lower().replace(" ", "-").replace("/", "-").replace(".", "")


def _progress_message(progress: float) -> str:
    if progress < 0.05:
        return "Starting GCP scan..."
    if progress < 0.20:
        return "Downloading photos..."
    if progress < 0.55:
        return "Generating analysis and annotations..."
    if progress < 0.78:
        return "Generating 3D model..."
    if progress < 0.90:
        return "Rendering turntable..."
    if progress < 0.98:
        return "Uploading 3D preview..."
    return "Finalising..."


def _generate_submission_id(*parts: object) -> str:
    seed = "|".join(str(part or "").strip() for part in parts)
    nonce = f"{time.time_ns()}:{uuid.uuid4().hex}:{seed}"
    return f"sub_{hashlib.sha256(nonce.encode('utf-8')).hexdigest()[:20]}"


def _download_photos(photo_urls: dict[str, str]) -> dict[str, bytes]:
    photos: dict[str, bytes] = {}
    with httpx.Client(follow_redirects=True, timeout=90) as client:
        for key, url in photo_urls.items():
            response = client.get(url)
            response.raise_for_status()
            photos[key] = response.content
    return photos


def _run_facelift(photos: dict[str, bytes], step_2d: int) -> dict[str, bytes]:
    input_dir = Path(tempfile.mkdtemp(prefix="facelift-in-"))
    output_dir = Path(tempfile.mkdtemp(prefix="facelift-out-"))
    order = ["front", "left45", "right45", "left90", "right90"]
    for index, key in enumerate(order):
        if key in photos:
            (input_dir / f"{index:02d}_{key}.jpg").write_bytes(photos[key])

    result = subprocess.run(
        [
            "python3",
            "inference.py",
            "--input_dir",
            str(input_dir),
            "--output_dir",
            str(output_dir),
            "--guidance_scale_2D",
            "4.25",
            "--step_2D",
            str(step_2d),
            "--seed",
            "4",
            "--eta",
            "1.0",
            "--opacity_thres",
            "0.04",
            "--scaling_thres",
            "0.1",
            "--floater_thres",
            "0.52",
            "--auto-crop",
        ],
        cwd=FACELIFT_DIR,
        capture_output=True,
        text=True,
        timeout=60 * 45,
    )
    print(result.stdout[-4000:] if result.stdout else "", flush=True)
    print(result.stderr[-4000:] if result.stderr else "", flush=True)
    if result.returncode != 0:
        raise RuntimeError(f"FaceLift inference failed with exit code {result.returncode}")

    result_dir = output_dir / "00_front"
    if not result_dir.exists():
        dirs = sorted(path for path in output_dir.iterdir() if path.is_dir())
        result_dir = dirs[0] if dirs else output_dir

    files: dict[str, bytes] = {}
    for name in ("input.png", "multiview.png", "output.png", "turntable.mp4", "gaussians.ply"):
        path = result_dir / name
        if path.exists():
            files[name] = path.read_bytes()
    return files


def _crop_ply_for_face(gaussians_ply: bytes) -> bytes:
    def sigmoid(x: np.ndarray) -> np.ndarray:
        return 1.0 / (1.0 + np.exp(-np.clip(x, -20, 20)))

    def logit(p: np.ndarray) -> np.ndarray:
        p = np.clip(p, 1e-7, 1 - 1e-7)
        return np.log(p / (1 - p))

    ply_data = PlyData.read(io.BytesIO(gaussians_ply))
    el = ply_data.elements[0]
    data = el.data
    xyz = np.stack([data["x"], data["y"], data["z"]], axis=1).astype(np.float64)
    opacity_logit = data["opacity"].copy().astype(np.float64)

    x, y, z = xyz[:, 0], xyz[:, 1], xyz[:, 2]
    x_p02, x_p98 = np.percentile(x, 2), np.percentile(x, 98)
    y_p02, y_p98 = np.percentile(y, 2), np.percentile(y, 98)
    x_span = x_p98 - x_p02
    y_span = y_p98 - y_p02
    x_ctr = (x_p02 + x_p98) / 2
    x_dist = np.abs(x - x_ctr)
    z_min, z_max = z.min(), z.max()
    z_span_full = z_max - z_min

    hair_w = np.clip((z_max - 0.12 * z_span_full - z) / (0.06 * z_span_full + 1e-8), 0.0, 1.0) ** 2.5
    back_w = np.clip((y_p02 + 0.60 * y_span - y) / (0.15 * y_span + 1e-8), 0.0, 1.0) ** 2.5
    x_excess = np.clip((x_dist - 0.42 * x_span / 2) / (0.08 * x_span + 1e-8), 0.0, 1.0)
    y_back_factor = np.clip((y - (y_p02 + 0.42 * y_span)) / (0.15 * y_span + 1e-8), 0.0, 1.0)
    side_w = np.clip(1.0 - x_excess * y_back_factor, 0.0, 1.0)
    z_shoulder_w = np.clip((z - (z_min + 0.22 * z_span_full)) / (0.10 * z_span_full + 1e-8), 0.0, 1.0)
    shoulder_w = np.where(x_dist <= 0.36 * x_span / 2, 1.0, z_shoulder_w)
    floor_w = np.clip((z - (z_min + 0.13 * z_span_full)) / (0.05 * z_span_full + 1e-8), 0.0, 1.0) ** 1.5

    alpha_new = sigmoid(opacity_logit) * hair_w * back_w * side_w * shoulder_w * floor_w
    data_new = data.copy()
    data_new["opacity"] = logit(alpha_new).astype(data["opacity"].dtype)

    out = io.BytesIO()
    PlyData(
        [PlyElement.describe(data_new, el.name, comments=el.comments)],
        text=ply_data.text,
        byte_order=ply_data.byte_order,
        comments=ply_data.comments,
        obj_info=ply_data.obj_info,
    ).write(out)
    return out.getvalue()


def _render_turntable_black(
    gaussians_ply: bytes,
    *,
    resolution: int = 1024,
    num_views: int = 90,
    fps: int = 30,
    sweep_deg: int = 130,
) -> bytes:
    import sys

    import torch
    from einops import rearrange

    sys.path.insert(0, str(FACELIFT_DIR))
    os.chdir(FACELIFT_DIR)
    from gslrm.model.gaussians_renderer import GaussianModel, imageseq2video, render_opencv_cam

    device = "cuda:0"
    with tempfile.NamedTemporaryFile(suffix=".ply", delete=False) as f:
        f.write(gaussians_ply)
        ply_path = f.name

    try:
        pc = GaussianModel(sh_degree=3)
        pc.load_ply(ply_path)
        pc = pc.to(device)
    finally:
        os.unlink(ply_path)

    hfov = 50.0
    radius = 2.7
    width = height = resolution
    fx = width / (2 * math.tan(math.radians(hfov) / 2.0))
    cx, cy = width / 2.0, height / 2.0
    up = np.array([0.0, 0.0, 1.0])
    half = sweep_deg / 2
    azimuths = np.linspace(270 - half, 270 + half, num_views, endpoint=True)

    c2ws = []
    for az_deg in azimuths:
        az = math.radians(az_deg)
        cam_pos = np.array([radius * math.cos(az), radius * math.sin(az), 0.0])
        forward = -cam_pos / np.linalg.norm(cam_pos)
        right = np.cross(forward, up)
        right /= np.linalg.norm(right)
        up_vec = np.cross(right, forward)
        rot = np.stack((right, -up_vec, forward), axis=1)
        c2w = np.eye(4)
        c2w[:3, :4] = np.concatenate((rot, cam_pos[:, None]), axis=1)
        c2ws.append(c2w)

    fxfycxcy_t = torch.from_numpy(np.tile(np.array([fx, fx, cx, cy], dtype=np.float32), (num_views, 1))).to(device)
    c2w_t = torch.from_numpy(np.stack(c2ws, axis=0).astype(np.float32)).to(device)

    frames = []
    with torch.no_grad():
        for index in range(num_views):
            frame = render_opencv_cam(
                pc,
                height,
                width,
                c2w_t[index],
                fxfycxcy_t[index],
                bg_color=(0.0, 0.0, 0.0),
            )["render"]
            frames.append((frame.detach().cpu().numpy() * 255).clip(0, 255).astype(np.uint8))
            if index % 30 == 0:
                torch.cuda.empty_cache()

    arr = rearrange(np.stack(frames, axis=0), "v c h w -> v h w c")
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
        out_path = f.name
    try:
        imageseq2video(np.ascontiguousarray(arr), out_path, fps=fps)
        return Path(out_path).read_bytes()
    finally:
        Path(out_path).unlink(missing_ok=True)


def _ffmpeg_seek_and_pingpong(src: Path, dest: Path) -> Path:
    seek = dest.with_name(dest.stem + "-seek.mp4")
    pingpong = dest.with_name(dest.stem + "-seek-pingpong.mp4")
    subprocess.run(
        [
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
            str(seek),
        ],
        check=True,
    )
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(seek),
            "-filter_complex",
            "[0:v]reverse[r];[0:v][r]concat=n=2:v=1[out]",
            "-map",
            "[out]",
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
            str(pingpong),
        ],
        check=True,
    )
    return pingpong if pingpong.exists() else seek


def _upload_file_to_gcs(path: Path, blob_name: str, content_type: str) -> str | None:
    bucket_name = (
        os.environ.get("GCS_TURNTABLE_BUCKET", "").strip()
        or os.environ.get("GCS_BLUEPRINT_BUCKET", "").strip()
        or os.environ.get("GCS_SCAN_BUCKET", "").strip()
    )
    if not bucket_name:
        return None
    from google.cloud import storage

    client = storage.Client()
    blob = client.bucket(bucket_name).blob(blob_name)
    blob.upload_from_filename(str(path), content_type=content_type)
    public_base = os.environ.get("GCS_BLUEPRINT_PUBLIC_BASE_URL", "").strip().rstrip("/")
    return f"{public_base or f'https://storage.googleapis.com/{bucket_name}'}/{blob_name}"


def _upload_aura_dir_to_gcs(slug: str, out_dir: Path, manifest: dict[str, Any]) -> dict[str, Any]:
    bucket_name = (
        os.environ.get("GCS_TURNTABLE_BUCKET", "").strip()
        or os.environ.get("GCS_BLUEPRINT_BUCKET", "").strip()
        or os.environ.get("GCS_SCAN_BUCKET", "").strip()
    )
    if not bucket_name:
        return manifest

    from google.cloud import storage

    client = storage.Client()
    bucket = client.bucket(bucket_name)
    prefix = f"aura/{slug}"
    url_map: dict[str, str] = {}
    for path in sorted(out_dir.iterdir()):
        if not path.is_file():
            continue
        blob_name = f"{prefix}/{path.name}"
        content_type = "application/octet-stream"
        if path.suffix == ".json":
            content_type = "application/json"
        elif path.suffix in {".png", ".jpg", ".jpeg", ".webp"}:
            content_type = f"image/{'jpeg' if path.suffix in {'.jpg', '.jpeg'} else path.suffix[1:]}"
        elif path.suffix == ".mp4":
            content_type = "video/mp4"
        bucket.blob(blob_name).upload_from_filename(str(path), content_type=content_type)
        url_map[path.name] = f"https://storage.googleapis.com/{bucket_name}/{blob_name}"

    def rewrite(value: str | None) -> str | None:
        if not value:
            return value
        return url_map.get(Path(value.split("?")[0]).name, value)

    out = dict(manifest)
    for key in (
        "turntableVideoUrl",
        "textureVideoUrl",
        "pigmentationVideoUrl",
        "rednessVideoUrl",
        "rednessReverseVideoUrl",
        "poresVideoUrl",
        "poresReverseVideoUrl",
        "wrinklesVideoUrl",
    ):
        out[key] = rewrite(out.get(key))
    out["angles"] = {
        angle: {**asset, **{k: rewrite(asset.get(k)) for k in asset if k.startswith("src")}}
        if isinstance(asset, dict)
        else asset
        for angle, asset in (manifest.get("angles") or {}).items()
    }
    cv = manifest.get("cvAnnotations")
    if isinstance(cv, dict):
        cv_out = dict(cv)
        for mask_field in ("redMaskByAngle", "poreMaskByAngle"):
            by_angle = cv.get(mask_field)
            if isinstance(by_angle, dict):
                cv_out[mask_field] = {
                    angle: rewrite(url) for angle, url in by_angle.items()
                }
        out["cvAnnotations"] = cv_out
    public_base = os.environ.get("GCS_BLUEPRINT_PUBLIC_BASE_URL", "").strip().rstrip("/")
    manifest_url = f"{public_base or f'https://storage.googleapis.com/{bucket_name}'}/{prefix}/{slug}-aura-manifest.json"
    out["auraManifestUrl"] = manifest_url
    out["auraGcsPrefix"] = f"gs://{bucket_name}/{prefix}/"
    manifest_blob = bucket.blob(f"{prefix}/{slug}-aura-manifest.json")
    manifest_blob.upload_from_string(json.dumps(out, ensure_ascii=False), content_type="application/json")
    return out


def _upload_aura_manifest_to_gcs(slug: str, manifest: dict[str, Any]) -> dict[str, Any]:
    bucket_name = (
        os.environ.get("GCS_TURNTABLE_BUCKET", "").strip()
        or os.environ.get("GCS_BLUEPRINT_BUCKET", "").strip()
        or os.environ.get("GCS_SCAN_BUCKET", "").strip()
    )
    if not bucket_name:
        return manifest

    from google.cloud import storage

    prefix = f"aura/{slug}"
    public_base = os.environ.get("GCS_BLUEPRINT_PUBLIC_BASE_URL", "").strip().rstrip("/")
    out = dict(manifest)
    out["auraManifestUrl"] = f"{public_base or f'https://storage.googleapis.com/{bucket_name}'}/{prefix}/{slug}-aura-manifest.json"
    out["auraGcsPrefix"] = f"gs://{bucket_name}/{prefix}/"
    storage.Client().bucket(bucket_name).blob(
        f"{prefix}/{slug}-aura-manifest.json",
    ).upload_from_string(json.dumps(out, ensure_ascii=False), content_type="application/json")
    return out


def _cloud_tasks_project_id() -> str:
    return (
        os.environ.get("GOOGLE_CLOUD_PROJECT", "").strip()
        or os.environ.get("GCP_PROJECT_ID", "").strip()
    )


def _cloud_tasks_queue_name() -> str:
    return os.environ.get("CLOUD_TASKS_QUEUE", "").strip()


def _cloud_tasks_location() -> str:
    return os.environ.get("CLOUD_TASKS_LOCATION", "us-central1").strip() or "us-central1"


def _worker_url(request: Request) -> str:
    explicit = os.environ.get("SCAN_WORKER_URL", "").strip().rstrip("/")
    if explicit:
        return f"{explicit}/internal/scan/process"
    host = (
        request.headers.get("x-forwarded-host")
        or request.headers.get("host")
        or ""
    ).strip().rstrip("/")
    if host:
        return f"https://{host}/internal/scan/process"
    return f"{str(request.base_url).replace('http://', 'https://', 1).rstrip('/')}/internal/scan/process"


def _cloud_tasks_enabled() -> bool:
    return bool(_cloud_tasks_project_id() and _cloud_tasks_queue_name())


def _enqueue_cloud_task(job_id: str, request: Request) -> None:
    from google.cloud import tasks_v2

    client = tasks_v2.CloudTasksClient()
    parent = client.queue_path(
        _cloud_tasks_project_id(),
        _cloud_tasks_location(),
        _cloud_tasks_queue_name(),
    )
    headers = {"Content-Type": "application/json"}
    worker_token = os.environ.get("SCAN_WORKER_TOKEN", "").strip()
    if worker_token:
        headers["X-Scan-Worker-Token"] = worker_token
    task = {
        "http_request": {
            "http_method": tasks_v2.HttpMethod.POST,
            "url": _worker_url(request),
            "headers": headers,
            "body": json.dumps({"jobId": job_id}).encode("utf-8"),
        },
    }
    client.create_task(parent=parent, task=task)


def _local_worker_loop() -> None:
    while True:
        job_id = local_job_queue.get()
        try:
            _process_queued_job(job_id)
        finally:
            local_job_queue.task_done()


def _ensure_local_worker_started() -> None:
    global local_worker_started
    with local_worker_lock:
        if local_worker_started:
            return
        thread = threading.Thread(target=_local_worker_loop, daemon=True)
        thread.start()
        local_worker_started = True


def _enqueue_scan_job(job_id: str, request: Request) -> str:
    if _cloud_tasks_enabled():
        _enqueue_cloud_task(job_id, request)
        return "cloud-tasks"
    _ensure_local_worker_started()
    local_job_queue.put(job_id)
    return "local"


def _load_aura_generator() -> Any:
    import importlib.util

    spec = importlib.util.spec_from_file_location(
        "generate_patient_aura_assets",
        AURA_SCRIPT_DIR / "generate_patient_aura_assets.py",
    )
    if spec is None or spec.loader is None:
        raise ImportError("Cannot load generate_patient_aura_assets.py")
    aura_mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(aura_mod)
    return aura_mod


def _load_scan_airtable() -> Any:
    import importlib.util

    spec = importlib.util.spec_from_file_location(
        "scan_airtable",
        AURA_SCRIPT_DIR / "scan_airtable.py",
    )
    if spec is None or spec.loader is None:
        raise ImportError("Cannot load scan_airtable.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _persist_job_outputs_to_airtable(job_id: str) -> None:
    """Write scan outputs onto the linked patient + Analyses row.

    Runs inside the worker so results land in Airtable even when every
    browser (clinic scan page, dashboard) has been closed. Upserts the
    Analyses row by Submission ID, so later save-video calls from the
    dashboard update the same row instead of duplicating it.
    """
    job = _load_job(job_id)
    if not job:
        return
    record_id = str(job.get("recordId") or "").strip()
    if not record_id:
        return
    if not (os.environ.get("AIRTABLE_API_TOKEN", "").strip() and os.environ.get("AIRTABLE_BASE_ID", "").strip()):
        print("[scan] AIRTABLE_API_TOKEN/AIRTABLE_BASE_ID not set — skipping worker-side persistence", flush=True)
        return

    table_name = str(job.get("tableName") or "Patients").strip() or "Patients"
    submission_id = str(job.get("submissionId") or "").strip()
    provider_id = str(job.get("providerId") or "").strip() or None
    patient_name = str(job.get("clientName") or "").strip() or None
    patient_email = str(job.get("patientEmail") or "").strip() or None
    severity_doc = job.get("severityScores")
    if not isinstance(severity_doc, dict):
        severity_doc = None
    video_url = str(job.get("videoUrl") or "").strip() or None

    aura_manifest_url = None
    aura_gcs_prefix = None
    aura_assets = job.get("auraAssets")
    if isinstance(aura_assets, dict):
        slug = str(aura_assets.get("slug") or "").strip()
        bucket_name = _job_bucket_name()
        if slug and bucket_name:
            aura_manifest_url = (
                f"https://storage.googleapis.com/{bucket_name}/aura/{slug}/{slug}-aura-manifest.json"
            )
            aura_gcs_prefix = f"gs://{bucket_name}/aura/{slug}/"

    try:
        airtable = _load_scan_airtable()
        severity_persisted = bool(job.get("severityPersisted"))
        urls_persisted = False
        if video_url:
            urls_persisted = airtable.update_airtable_scan_urls(
                record_id,
                table_name,
                video_url,
                aura_manifest_url,
                aura_gcs_prefix,
                severity_doc,
                submission_id=submission_id or None,
                provider_id=provider_id,
                patient_name=patient_name,
                patient_email=patient_email,
            )
            severity_persisted = severity_persisted or bool(urls_persisted and severity_doc)
        elif severity_doc:
            severity_persisted = airtable.write_severity_scores_to_airtable(
                record_id,
                table_name,
                severity_doc,
                submission_id=submission_id or None,
                provider_id=provider_id,
                patient_name=patient_name,
                patient_email=patient_email,
            )
        _set_job(
            job_id,
            persistedToPatient=bool(urls_persisted or severity_persisted),
            severityPersisted=bool(severity_persisted),
        )
        print(
            f"[scan] Airtable persistence for job {job_id}: urls={urls_persisted} severity={severity_persisted}",
            flush=True,
        )
    except Exception as exc:
        print(f"[scan] Worker-side Airtable persistence failed for {job_id}: {exc}", flush=True)


def _generate_photo_aura_assets(slug: str, photos: dict[str, bytes], out_dir: Path) -> dict[str, Any]:
    aura_mod = _load_aura_generator()
    aura_manifest = aura_mod.generate_aura_assets(
        slug=slug,
        turntable_video_path=None,
        photo_bytes=photos,
        turntable_video_url=None,
        out_dir=out_dir,
        skip_videos=True,
        scan_optimized=False,
    )
    return _upload_aura_dir_to_gcs(slug, out_dir, aura_manifest)


def _fetch_severity(
    photos: dict[str, bytes],
    patient_age: int | None,
    slug: str,
    submission_id: str,
) -> dict[str, Any] | None:
    url = os.environ.get("SEVERITY_PREDICT_URL", "").strip()
    if not url or "front" not in photos:
        return None

    def b64(key: str) -> str | None:
        return base64.b64encode(photos[key]).decode("ascii") if key in photos else None

    payload: dict[str, Any] = {
        "front_image_base64": b64("front"),
        "age": patient_age or 40,
        "include_severity": True,
    }
    for key, field in (
        ("left90", "left_90_image_base64"),
        ("right90", "right_90_image_base64"),
        ("left45", "left_45_image_base64"),
        ("right45", "right_45_image_base64"),
    ):
        value = b64(key)
        if value:
            payload[field] = value
    side = b64("left90") or b64("right90") or b64("left45") or b64("right45")
    if side:
        payload["side_image_base64"] = side

    with httpx.Client(timeout=180) as client:
        response = client.post(url, json=payload)
        if response.status_code == 429:
            print(f"[scan] Severity API rate limited (429) — skipping severity", flush=True)
            return None
        response.raise_for_status()
        ct = response.headers.get("content-type", "")
        if "json" not in ct:
            print(f"[scan] Severity API returned non-JSON ({ct}): {response.text[:200]}", flush=True)
            return None
        data = response.json()
    if isinstance(data.get("issues"), dict):
        return {
            "schema_version": int(os.environ.get("SEVERITY_SCHEMA_VERSION", "4")),
            "detector_type": "multi_region",
            "submission_id": submission_id,
            "input_views": ["front", "left_90", "right_90", "left_45", "right_45"],
            "metadata": data.get("metadata", {}),
            "issues": data["issues"],
        }
    if isinstance(data, dict):
        data["submission_id"] = str(data.get("submission_id") or submission_id)
        return data
    return None


def _run_scan_job(
    job_id: str,
    photo_urls: dict[str, str],
    quality: str,
    client_name: str,
    patient_age: int | None,
    submission_id: str,
) -> None:
    slug = _slugify(client_name or "client")
    try:
        _set_job(job_id, status="running", progress=0.05, message=_progress_message(0.05))
        photos = _download_photos(photo_urls)
        _set_job(job_id, progress=0.20, message="Generating analysis and annotations...")
        with tempfile.TemporaryDirectory(prefix="scan-") as tmp:
            tmp_path = Path(tmp)
            aura_dir = tmp_path / slug
            with ThreadPoolExecutor(max_workers=2) as pool:
                aura_future = pool.submit(_generate_photo_aura_assets, slug, photos, aura_dir)
                severity_future = pool.submit(
                    _fetch_severity,
                    photos,
                    patient_age,
                    slug,
                    submission_id,
                )
                aura_manifest = aura_future.result()
                try:
                    severity_scores = severity_future.result()
                except Exception as sev_exc:
                    print(f"[scan] Severity analysis failed for {slug}: {sev_exc}", flush=True)
                    severity_scores = None

            _set_job(
                job_id,
                status="analysis_done",
                progress=0.62,
                message="Analysis ready — generating 3D preview..."
                if _scan_3d_enabled()
                else "Analysis ready.",
                auraAssets=aura_manifest,
                severityScores=severity_scores,
                analysisComplete=True,
            )
            # Persist severity as soon as it exists so closing every browser
            # cannot lose the analysis (3D may still take minutes or fail).
            if severity_scores:
                _persist_job_outputs_to_airtable(job_id)

            if not _scan_3d_enabled():
                _set_job(
                    job_id,
                    status="done",
                    progress=1.0,
                    message="Analysis ready",
                    auraAssets=aura_manifest,
                    severityScores=severity_scores,
                    analysisComplete=True,
                    assetStatus="ready",
                    assetProgress=1.0,
                    assetRemaining=0,
                    assetMessage="3D preview is temporarily disabled.",
                )
                _persist_job_outputs_to_airtable(job_id)
                return

            try:
                result = _run_facelift(photos, QUALITY_PRESETS[quality]["step_2d"])
                ply_bytes = result.get("gaussians.ply")
                if not ply_bytes:
                    raise RuntimeError(f"FaceLift missing gaussians.ply; outputs={list(result)}")

                _set_job(job_id, status="analysis_done", progress=0.78, message="Rendering 3D preview...")
                cropped_ply = _crop_ply_for_face(ply_bytes)
                video_bytes = _render_turntable_black(cropped_ply)
            except Exception as scan_exc:
                _set_job(
                    job_id,
                    status="partial",
                    progress=1.0,
                    message="Analysis ready; 3D preview could not be generated.",
                    error=str(scan_exc),
                    auraAssets=aura_manifest,
                    severityScores=severity_scores,
                )
                _persist_job_outputs_to_airtable(job_id)
                return

            turntable_path = tmp_path / f"{slug}-turntable.mp4"
            turntable_path.write_bytes(video_bytes)
            _set_job(job_id, progress=0.88, message="Optimizing turntable...")
            video_path = _ffmpeg_seek_and_pingpong(turntable_path, tmp_path / f"{slug}-turntable.mp4")
            video_url = _upload_file_to_gcs(video_path, f"turntables/{slug}-turntable-seek.mp4", "video/mp4")

            _set_job(
                job_id,
                progress=0.92,
                message=_progress_message(0.92),
                **({"videoUrl": video_url} if video_url else {}),
            )

            if video_url:
                aura_manifest["turntableVideoUrl"] = video_url
                aura_manifest = _upload_aura_manifest_to_gcs(slug, aura_manifest)

        payload: dict[str, Any] = {
            "status": "done",
            "progress": 1.0,
            "message": "Done",
            "auraAssets": aura_manifest,
            "severityScores": severity_scores,
        }
        if video_url:
            payload["videoUrl"] = video_url
        else:
            payload["videoBase64"] = base64.b64encode(video_bytes).decode("ascii")
        _set_job(job_id, **payload)
        _persist_job_outputs_to_airtable(job_id)
    except Exception as exc:
        _set_job(job_id, status="error", progress=1.0, error=str(exc), message=str(exc))


def _process_queued_job(job_id: str) -> dict[str, Any]:
    job = _load_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if job.get("status") in {"running", "analysis_done"}:
        return {"ok": True, "jobId": job_id, "status": job.get("status")}
    if job.get("status") in {"done", "partial", "error"}:
        return {"ok": True, "jobId": job_id, "status": job.get("status")}

    photo_urls = job.get("photoUrls") or {}
    if not isinstance(photo_urls, dict) or not photo_urls:
        _set_job(job_id, status="error", progress=1.0, error="No photos provided", message="No photos provided")
        return {"ok": False, "jobId": job_id, "status": "error"}

    _run_scan_job(
        job_id,
        {str(k): str(v) for k, v in photo_urls.items()},
        str(job.get("quality") or "standard"),
        str(job.get("clientName") or "client"),
        int(job["patientAge"]) if str(job.get("patientAge") or "").isdigit() else None,
        str(job.get("submissionId") or _generate_submission_id(job.get("clientName"), job_id)),
    )
    latest = _load_job(job_id) or {}
    return {"ok": True, "jobId": job_id, "status": latest.get("status", "unknown")}


@app.get("/health")
def health() -> dict[str, Any]:
    try:
        import torch

        cuda_available = bool(torch.cuda.is_available())
    except Exception:
        cuda_available = False
    return {
        "status": "ok",
        "runtime": "gcp-cloud-run-gpu",
        "cudaAvailable": cuda_available,
        "faceliftDirExists": FACELIFT_DIR.exists(),
        "severityPredictUrlConfigured": bool(os.environ.get("SEVERITY_PREDICT_URL")),
        "scan3dEnabled": _scan_3d_enabled(),
        "queueMode": "cloud-tasks" if _cloud_tasks_enabled() else "local",
        "cloudTasksQueue": _cloud_tasks_queue_name() or None,
    }


@app.post("/api/scan/submit")
def submit_scan(request: Request, body: dict[str, Any] = Body(...)) -> dict[str, Any]:
    client_name = str(body.get("clientName") or "client")
    quality = str(body.get("quality") or "standard")
    if quality not in QUALITY_PRESETS:
        quality = "standard"
    photo_urls = body.get("photos") or {}
    if not isinstance(photo_urls, dict) or not photo_urls:
        raise HTTPException(400, "No photos provided")
    patient_age_raw = body.get("patientAge")
    patient_age = int(patient_age_raw) if str(patient_age_raw or "").strip().isdigit() else None
    submission_id = str(body.get("submissionId") or body.get("submissionID") or "").strip()
    if not submission_id:
        submission_id = _generate_submission_id(client_name)

    # Optional Airtable persistence context: when present, the worker writes
    # outputs to the patient + Analyses rows itself, so results survive every
    # browser being closed.
    record_id = str(body.get("recordId") or body.get("patientRecordId") or "").strip()
    table_name = str(body.get("tableName") or body.get("patientTableName") or "Patients").strip()
    provider_id = str(body.get("providerId") or "").strip()
    form_submission_id = str(body.get("formSubmissionId") or "").strip()
    patient_email = str(body.get("patientEmail") or "").strip()

    job_id = str(uuid.uuid4())
    job = {
        "jobId": job_id,
        "status": "queued",
        "started_at": time.time(),
        "quality": quality,
        "progress": 0.0,
        "message": "Queued",
        "photoUrls": photo_urls,
        "clientName": client_name,
        "submissionId": submission_id,
        **({"patientAge": patient_age} if patient_age is not None else {}),
        **({"recordId": record_id} if record_id else {}),
        **({"tableName": table_name} if record_id else {}),
        **({"providerId": provider_id} if provider_id else {}),
        **({"formSubmissionId": form_submission_id} if form_submission_id else {}),
        **({"patientEmail": patient_email} if patient_email else {}),
    }
    with jobs_lock:
        jobs[job_id] = job
    _persist_job(job_id, job)
    queue_mode = _enqueue_scan_job(job_id, request)
    _set_job(job_id, queueMode=queue_mode)
    return {
        "jobId": job_id,
        "estimatedSeconds": _estimated_seconds(quality),
        "queueMode": queue_mode,
        "submissionId": submission_id,
    }


@app.post("/submit")
def submit_scan_alias(request: Request, body: dict[str, Any] = Body(...)) -> dict[str, Any]:
    return submit_scan(request, body)


@app.post("/internal/scan/process")
def process_scan_job(request: Request, body: dict[str, Any] = Body(...)) -> dict[str, Any]:
    worker_token = os.environ.get("SCAN_WORKER_TOKEN", "").strip()
    if worker_token and request.headers.get("X-Scan-Worker-Token") != worker_token:
        raise HTTPException(403, "Invalid worker token")
    job_id = str(body.get("jobId") or body.get("job_id") or "").strip()
    if not job_id:
        raise HTTPException(400, "Missing jobId")
    return _process_queued_job(job_id)


def _status_payload(job_id: str) -> dict[str, Any]:
    job = _load_job(job_id)
    if not job:
        return {"status": "error", "error": "Job not found"}
    return _public_job_payload(job_id, job)


@app.get("/api/scan/status/{job_id}")
def scan_status(job_id: str) -> dict[str, Any]:
    return _status_payload(job_id)


@app.get("/status")
def status_alias(job_id: str) -> dict[str, Any]:
    return _status_payload(job_id)
