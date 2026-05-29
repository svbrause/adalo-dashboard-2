#!/usr/bin/env python3
"""Generate per-patient Aura assets after 3D turntable reconstruction.

Outputs under public/demo-3d/{slug}/:
  - {slug}-{angle}-rembg.png       — GrabCut background removal
  - {slug}-{angle}-color.png       — original angle still (when supplied)
  - {slug}-{angle}-texture.png     — clinical grayscale skin map
  - {slug}-{angle}-pigmentation.png — clinical brown pigment map
  - {slug}-{angle}-redness-mask.png — granular red spot mask
  - {slug}-turntable-skin-gray.mp4
  - {slug}-turntable-pigmentation.mp4
  - {slug}-aura-manifest.json
"""

from __future__ import annotations

import importlib.util
import json
from io import BytesIO
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SCRIPT_DIR = Path(__file__).resolve().parent
PUBLIC_3D = ROOT / "public" / "demo-3d"

ANGLES = [
    "profile-left",
    "three-quarter-left",
    "front",
    "three-quarter-right",
    "profile-right",
]

ANGLE_LABELS: dict[str, str] = {
    "profile-left": "Left profile",
    "three-quarter-left": "Left three-quarter",
    "front": "Front",
    "three-quarter-right": "Right three-quarter",
    "profile-right": "Right profile",
}

ANGLE_TIME_RATIOS: dict[str, float] = {
    "profile-left": 0.99,
    "three-quarter-left": 0.76,
    "front": 0.5,
    "three-quarter-right": 0.24,
    "profile-right": 0.0,
}

MODAL_KEY_TO_ANGLE: dict[str, str] = {
    "front": "front",
    "left90": "profile-left",
    "right90": "profile-right",
    "left45": "three-quarter-left",
    "right45": "three-quarter-right",
    "side": "profile-right",
    "left": "profile-left",
    "right": "profile-right",
}


def _load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load module from {path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_cv_assets = _load_module("aura_cv_assets", SCRIPT_DIR / "generate-aura-cv-assets.py")
_turntable = _load_module(
    "turntable_pigment",
    SCRIPT_DIR / "generate-turntable-pigmentation-video.py",
)
segment_person = _cv_assets.segment_person
process_frame = _turntable.process_frame
process_video = _turntable.process_video


def slugify_client_name(name: str) -> str:
    return name.lower().replace(" ", "-").replace("/", "-").replace(".", "")


def modal_key_to_angle(key: str) -> str | None:
    base = key.split("_")[0]
    return MODAL_KEY_TO_ANGLE.get(base)


def decode_photo(data: bytes) -> np.ndarray:
    arr = np.frombuffer(data, dtype=np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        raise ValueError("Could not decode photo bytes")
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)


def estimate_bbox(rgb: np.ndarray) -> tuple[int, int, int, int]:
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    ys, xs = np.where(gray > 25)
    h, w = rgb.shape[:2]
    if xs.size == 0:
        return (w // 4, h // 8, w // 2, h // 2)
    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    return (x0, y0, max(1, x1 - x0), max(1, y1 - y0))


def rembg_rgba(rgb: np.ndarray) -> np.ndarray:
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    alpha = segment_person(bgr, estimate_bbox(rgb))
    return np.dstack([rgb, alpha])


def clinical_still_rgb(rgb: np.ndarray, palette: str, *, angle: str = "front") -> np.ndarray:
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    out_bgr = process_frame(bgr, palette, angle=angle)
    return cv2.cvtColor(out_bgr, cv2.COLOR_BGR2RGB)


def save_rgba_png(rgba: np.ndarray, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, mode="RGBA").save(path, optimize=True)


def save_rgb_png(rgb: np.ndarray, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgb, mode="RGB").save(path, optimize=True)


def extract_frame_at_ratio(video_path: Path, ratio: float) -> np.ndarray:
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise FileNotFoundError(video_path)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    idx = max(0, int(ratio * max(total - 1, 0)))
    cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
    ok, frame = cap.read()
    cap.release()
    if not ok:
        raise RuntimeError(f"Could not read frame {idx} from {video_path}")
    return cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)


def map_photos_to_angles(photo_bytes: dict[str, bytes]) -> dict[str, np.ndarray]:
    """Prefer unsuffixed modal keys (front, left90) over left90_1, etc."""
    ordered_keys = sorted(
        photo_bytes.keys(),
        key=lambda k: (0 if "_" not in k else 1, k),
    )
    out: dict[str, np.ndarray] = {}
    for key in ordered_keys:
        angle = modal_key_to_angle(key)
        if not angle or angle in out:
            continue
        out[angle] = decode_photo(photo_bytes[key])
    return out


def photo_sourced_angles(photo_bytes: dict[str, bytes]) -> list[str]:
    angles: list[str] = []
    seen: set[str] = set()
    ordered_keys = sorted(
        photo_bytes.keys(),
        key=lambda k: (0 if "_" not in k else 1, k),
    )
    for key in ordered_keys:
        angle = modal_key_to_angle(key)
        if angle and angle not in seen:
            seen.add(angle)
            angles.append(angle)
    return [a for a in ANGLES if a in seen]


def face_bbox_from_alpha(alpha: np.ndarray, thresh: int = 40) -> tuple[int, int, int, int]:
    ys, xs = np.where(alpha > thresh)
    if ys.size == 0:
        h, w = alpha.shape
        return 0, 0, w, h
    pad = 8
    return (
        max(0, int(xs.min()) - pad),
        max(0, int(ys.min()) - pad),
        min(alpha.shape[1], int(xs.max()) + pad + 1),
        min(alpha.shape[0], int(ys.max()) + pad + 1),
    )


def redness_face_bbox(rgb: np.ndarray, alpha: np.ndarray, angle: str) -> tuple[int, int, int, int]:
    """Prefer a face crop over the full person matte for redness mask placement."""
    h, w = alpha.shape
    cascade_path = Path(cv2.data.haarcascades) / "haarcascade_frontalface_default.xml"
    if cascade_path.exists() and angle in {"front", "three-quarter-left", "three-quarter-right"}:
        gray = cv2.equalizeHist(cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY))
        cascade = cv2.CascadeClassifier(str(cascade_path))
        faces = cascade.detectMultiScale(
            gray,
            scaleFactor=1.08,
            minNeighbors=4,
            minSize=(max(80, int(w * 0.18)), max(80, int(h * 0.18))),
        )
        plausible_faces = [
            face for face in faces
            if int(face[2]) < int(w * 0.72) and int(face[3]) < int(h * 0.82)
        ]
        if len(plausible_faces) > 0:
            x, y, fw, fh = max(plausible_faces, key=lambda item: int(item[2]) * int(item[3]))
            pad_x = int(fw * 0.03)
            pad_y = int(fh * 0.05)
            return (
                max(0, int(x) - pad_x),
                max(0, int(y) - pad_y),
                min(w, int(x + fw) + pad_x),
                min(h, int(y + fh) + pad_y),
            )

    x0, y0, x1, y1 = face_bbox_from_alpha(alpha)
    fw, fh = max(1, x1 - x0), max(1, y1 - y0)
    if angle == "profile-right":
        return (
            x0 + int(0.42 * fw),
            y0 + int(0.08 * fh),
            x1 - int(0.02 * fw),
            y0 + int(0.78 * fh),
        )
    if angle == "profile-left":
        return (
            x0 + int(0.02 * fw),
            y0 + int(0.08 * fh),
            x0 + int(0.58 * fw),
            y0 + int(0.78 * fh),
        )
    return (
        x0 + int(0.00 * fw),
        y0 + int(0.13 * fh),
        x0 + int(0.82 * fw),
        y0 + int(0.80 * fh),
    )


def px_to_vb(x: float, y: float, bbox: tuple[int, int, int, int]) -> tuple[float, float]:
    x0, y0, x1, y1 = bbox
    fw = max(1, x1 - x0)
    fh = max(1, y1 - y0)
    return ((x - x0) / fw * 100.0, (y - y0) / fh * 100.0)


def cheek_roi_mask(shape: tuple[int, int], bbox: tuple[int, int, int, int]) -> np.ndarray:
    x0, y0, x1, y1 = bbox
    fw, fh = x1 - x0, y1 - y0
    mask = np.zeros(shape, np.uint8)
    cv2.rectangle(
        mask,
        (x0 + int(0.14 * fw), y0 + int(0.26 * fh)),
        (x0 + int(0.86 * fw), y0 + int(0.74 * fh)),
        255,
        -1,
    )
    return mask


def detect_pigment_spots(
    rgb: np.ndarray,
    alpha: np.ndarray,
    *,
    angle: str,
    max_spots: int = 36,
) -> list[dict[str, float]]:
    h, w = rgb.shape[:2]
    bbox = face_bbox_from_alpha(alpha)
    x0, y0, x1, y1 = bbox
    roi = cheek_roi_mask((h, w), bbox)
    skin = ((alpha > 40) & (roi > 0)).astype(np.uint8) * 255

    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    l = lab[:, :, 0].astype(np.float32)
    a = lab[:, :, 1].astype(np.float32)
    local_l = cv2.GaussianBlur(l, (0, 0), 21)
    dark = np.maximum(local_l - l, 0)

    valid = skin > 0
    if valid.sum() < 500:
        return []

    med_l = float(np.median(l[valid]))
    score = dark + np.maximum(a - float(np.median(a[valid])), 0) * 0.35
    score[~valid] = 0
    score[l < med_l - 22] = 0
    score[l > med_l + 55] = 0

    if angle.startswith("profile"):
        # Profile: only annotate the visible cheek (camera-facing half).
        mid_x = x0 + (x1 - x0) // 2
        if angle == "profile-right":
            score[:, :mid_x] = 0
        else:
            score[:, mid_x:] = 0

    thresh = float(np.percentile(score[valid], 90))
    if thresh <= 0.5:
        return []

    peaks = (score >= thresh).astype(np.uint8) * 255
    peaks = cv2.morphologyEx(peaks, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)), 1)
    n, _labels, stats, centroids = cv2.connectedComponentsWithStats(peaks, connectivity=8)
    spots: list[tuple[float, tuple[float, float, float, float]]] = []
    for idx in range(1, n):
        area = stats[idx, cv2.CC_STAT_AREA]
        if area < 8 or area > 2200:
            continue
        cx_px, cy_px = centroids[idx]
        cx, cy = px_to_vb(float(cx_px), float(cy_px), bbox)
        if not (8 <= cx <= 92 and 18 <= cy <= 88):
            continue
        intensity = float(np.clip(score[int(cy_px), int(cx_px)] / max(thresh, 1e-3), 0.55, 1.0))
        radius = float(np.clip(np.sqrt(area) / max(x1 - x0, 1) * 100 * 0.11, 0.22, 1.15))
        spots.append((intensity, (cx, cy, radius, radius)))

    spots.sort(key=lambda item: item[0], reverse=True)
    return [
        {"cx": cx, "cy": cy, "rx": rx, "ry": ry, "intensity": intensity}
        for intensity, (cx, cy, rx, ry) in spots[:max_spots]
    ]


def face_skin_mask(rgb: np.ndarray, alpha: np.ndarray, bbox: tuple[int, int, int, int]) -> np.ndarray:
    """Skin pixels inside an extended face ROI, excluding pink/magenta hair."""
    h, w = rgb.shape[:2]
    x0, y0, x1, y1 = bbox
    fw, fh = x1 - x0, y1 - y0
    roi = np.zeros((h, w), np.uint8)
    cv2.rectangle(
        roi,
        (x0 + int(0.12 * fw), y0 + int(0.22 * fh)),
        (x0 + int(0.88 * fw), y0 + int(0.78 * fh)),
        255,
        -1,
    )

    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    hue, sat, val = cv2.split(hsv)
    red, green, blue = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    magenta_hair = (hue >= 128) & (hue <= 172) & (sat > 55)

    skin = (
        (alpha > 40)
        & (roi > 0)
        & (val > 45)
        & (val < 245)
        & (sat > 8)
        & (sat < 145)
        & ((hue < 25) | (hue > 165))
        & (red.astype(np.int16) >= green.astype(np.int16) - 18)
        & (red.astype(np.int16) > blue.astype(np.int16) - 10)
        & ~magenta_hair
    )
    return skin.astype(np.uint8) * 255


def detect_redness_spots(
    rgb: np.ndarray,
    alpha: np.ndarray,
    *,
    angle: str,
    max_spots: int = 56,
) -> list[dict[str, float]]:
    """Detect discrete erythema / inflammatory red spots on visible facial skin."""
    h, w = rgb.shape[:2]
    bbox = redness_face_bbox(rgb, alpha, angle)
    x0, y0, x1, y1 = bbox
    skin = face_skin_mask(rgb, alpha, bbox)

    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    l = lab[:, :, 0].astype(np.float32)
    a = lab[:, :, 1].astype(np.float32)
    local_a = cv2.GaussianBlur(a, (0, 0), 16)
    local_red = np.maximum(a - local_a, 0)

    valid = skin > 0
    if valid.sum() < 500:
        return []

    med_a = float(np.median(a[valid]))
    med_l = float(np.median(l[valid]))
    global_red = np.maximum(a - med_a, 0)

    red = rgb[:, :, 0].astype(np.float32)
    green = rgb[:, :, 1].astype(np.float32)
    blue = rgb[:, :, 2].astype(np.float32)
    rgb_red = np.maximum(red - np.maximum(green, blue), 0)

    score = 0.32 * local_red + 0.38 * global_red + 0.30 * rgb_red
    score[~valid] = 0
    score[l < med_l - 32] = 0
    score[l > med_l + 48] = 0

    fw, fh = x1 - x0, y1 - y0
    lip_y0 = y0 + int(0.64 * fh)
    lip_x0 = x0 + int(0.32 * fw)
    lip_x1 = x0 + int(0.68 * fw)
    score[lip_y0:, lip_x0:lip_x1] = 0

    if angle.startswith("profile"):
        mid_x = x0 + fw // 2
        if angle == "profile-right":
            score[:, :mid_x] = 0
        else:
            score[:, mid_x:] = 0

    score = cv2.GaussianBlur(score, (0, 0), 0.7)
    thresh = float(np.percentile(score[valid], 74))
    if thresh <= 0.35:
        return []

    peaks = (score >= thresh).astype(np.uint8) * 255
    peaks = cv2.morphologyEx(peaks, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)), 1)
    n, _labels, stats, centroids = cv2.connectedComponentsWithStats(peaks, connectivity=8)
    spots: list[tuple[float, tuple[float, float, float, float]]] = []
    for idx in range(1, n):
        area = stats[idx, cv2.CC_STAT_AREA]
        if area < 4 or area > 2600:
            continue
        cx_px, cy_px = centroids[idx]
        cx, cy = px_to_vb(float(cx_px), float(cy_px), bbox)
        if not (8 <= cx <= 92 and 18 <= cy <= 88):
            continue
        intensity = float(np.clip(score[int(cy_px), int(cx_px)] / max(thresh, 1e-3), 0.55, 1.0))
        radius = float(np.clip(np.sqrt(area) / max(x1 - x0, 1) * 100 * 0.13, 0.28, 1.35))
        spots.append((intensity, (cx, cy, radius, radius)))

    spots.sort(key=lambda item: item[0], reverse=True)
    return [
        {"cx": cx, "cy": cy, "rx": rx, "ry": ry, "intensity": intensity}
        for intensity, (cx, cy, rx, ry) in spots[:max_spots]
    ]


def render_redness_overlay(
    rgb: np.ndarray,
    alpha: np.ndarray,
    spots: list[dict[str, float]],
    *,
    dot_scale: float = 2.0,
) -> np.ndarray:
    """Draw bold red dot markers on the original color photo."""
    if not spots:
        return rgb.copy()

    out = rgb.astype(np.float32).copy()
    h, w = rgb.shape[:2]
    bbox = face_bbox_from_alpha(alpha)
    x0, y0, x1, y1 = bbox
    fw, fh = max(1, x1 - x0), max(1, y1 - y0)
    matte = np.clip(alpha.astype(np.float32) / 255.0, 0, 1)
    halo_rgb = np.array([255, 55, 65], np.float32)
    core_rgb = (255.0, 18.0, 28.0)
    ring_rgb = (255.0, 255.0, 255.0)

    halo = np.zeros((h, w), np.float32)
    for spot in spots:
        cx = x0 + (spot["cx"] / 100.0) * fw
        cy = y0 + (spot["cy"] / 100.0) * fh
        rx = max(4.0, spot["rx"] / 100.0 * fw * dot_scale * 1.55)
        ry = max(4.0, spot["ry"] / 100.0 * fh * dot_scale * 1.55)
        strength = float(0.55 + 0.40 * spot.get("intensity", 0.8))
        cv2.ellipse(halo, (int(round(cx)), int(round(cy))), (int(round(rx)), int(round(ry))), 0, 0, 360, strength, -1)

        dot_r = max(6, int(min(rx, ry) * 0.55))
        ix, iy = int(round(cx)), int(round(cy))
        cv2.circle(out, (ix, iy), dot_r + 3, ring_rgb, 2, lineType=cv2.LINE_AA)
        cv2.circle(out, (ix, iy), dot_r, core_rgb, -1, lineType=cv2.LINE_AA)
        cv2.circle(out, (ix, iy), max(2, dot_r // 2), (255.0, 55.0, 65.0), -1, lineType=cv2.LINE_AA)

    halo = cv2.GaussianBlur(halo, (0, 0), 2.0) * matte
    out = out * (1 - halo[:, :, None] * 0.72) + halo_rgb * halo[:, :, None] * 0.72
    return np.clip(out, 0, 255).astype(np.uint8)


def _smoothstep(edge0: float, edge1: float, x: np.ndarray) -> np.ndarray:
    t = np.clip((x - edge0) / max(edge1 - edge0, 1e-6), 0, 1)
    return t * t * (3 - 2 * t)


def _gaussian_2d(
    x: np.ndarray,
    y: np.ndarray,
    cx: float,
    cy: float,
    sx: float,
    sy: float,
) -> np.ndarray:
    return np.exp(-0.5 * (((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2))


def render_redness_mask(
    rgb: np.ndarray,
    alpha: np.ndarray,
    *,
    angle: str,
    spots: list[dict[str, float]],
) -> np.ndarray:
    """Return a red RGBA mask with broken, reference-style erythema texture."""
    h, w = rgb.shape[:2]
    bbox = redness_face_bbox(rgb, alpha, angle)
    x0, y0, x1, y1 = bbox
    fw, fh = max(1, x1 - x0), max(1, y1 - y0)
    yy, xx = np.mgrid[0:h, 0:w]
    nx = (xx - x0) / fw
    ny = (yy - y0) / fh

    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    hue, sat, val = cv2.split(hsv)
    red = rgb[:, :, 0].astype(np.int16)
    green = rgb[:, :, 1].astype(np.int16)
    blue = rgb[:, :, 2].astype(np.int16)
    chroma_ok = (
        (hue < 18)
        & (sat > 18)
        & (sat < 128)
        & (val > 68)
        & (val < 250)
        & (red >= green - 22)
        & (red >= blue - 16)
    )
    magenta_hair = ((hue > 145) & (sat > 70)) | ((red > green + 38) & (blue > green + 18) & (sat > 110))
    base_skin = (chroma_ok & ~magenta_hair).astype(np.float32)

    if angle == "front":
        surface = 1 - _smoothstep(0.88, 1.10, ((nx - 0.50) / 0.47) ** 2 + ((ny - 0.55) / 0.58) ** 2)
        surface *= _smoothstep(0.13, 0.20, nx) * (1 - _smoothstep(0.80, 0.88, nx))
        surface *= _smoothstep(0.23, 0.31, ny) * (1 - _smoothstep(0.86, 0.96, ny))
        eyes = _gaussian_2d(nx, ny, 0.35, 0.40, 0.13, 0.055) + _gaussian_2d(nx, ny, 0.65, 0.40, 0.13, 0.055)
        lips = _gaussian_2d(nx, ny, 0.50, 0.70, 0.20, 0.050)
        brows = _gaussian_2d(nx, ny, 0.35, 0.33, 0.14, 0.035) + _gaussian_2d(nx, ny, 0.65, 0.33, 0.14, 0.035)
        surface *= 1 - np.clip(0.95 * eyes + 0.88 * lips + 0.55 * brows, 0, 0.95)
    else:
        surface = 1 - _smoothstep(0.88, 1.10, ((nx - 0.66) / 0.40) ** 2 + ((ny - 0.55) / 0.58) ** 2)
        surface *= _smoothstep(0.16, 0.42, nx) * (1 - _smoothstep(0.93, 1.02, nx))
        surface *= _smoothstep(0.25, 0.33, ny) * (1 - _smoothstep(0.86, 0.96, ny))
        eyes = _gaussian_2d(nx, ny, 0.73, 0.40, 0.12, 0.055)
        lips = _gaussian_2d(nx, ny, 0.80, 0.68, 0.15, 0.050)
        surface *= 1 - np.clip(0.95 * eyes + 0.80 * lips, 0, 0.95)

    skin_binary = ((base_skin * surface) > 0.05).astype(np.uint8)
    close_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
    skin_binary = cv2.morphologyEx(skin_binary, cv2.MORPH_CLOSE, close_kernel, 1)
    skin = np.clip(cv2.GaussianBlur(skin_binary.astype(np.float32) * surface, (0, 0), 2.2), 0, 1)
    valid = skin > 0.12
    if int(valid.sum()) < 500:
        return np.zeros((h, w, 4), np.uint8)

    # Threshold LAB "a" at the 75th percentile of skin pixels: only the
    # reddest ~25% of skin is highlighted.  GaussianBlur smooths the edges.
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    a_chan = lab[:, :, 1].astype(np.float32)
    thresh = float(np.percentile(a_chan[valid], 75))
    peak   = float(np.percentile(a_chan[valid], 99))
    heat = np.clip((a_chan - thresh) / max(peak - thresh, 1e-3), 0, 1) * skin
    heat = cv2.GaussianBlur(heat, (0, 0), 4.0)
    mask_alpha = np.clip(heat * 0.55, 0, 0.50)

    rgba = np.zeros((h, w, 4), np.uint8)
    rgba[:, :, 0] = 205
    rgba[:, :, 2] = 12
    rgba[:, :, 3] = np.clip(mask_alpha * 255, 0, 255).astype(np.uint8)
    return rgba


def detect_pores(texture_rgb: np.ndarray, alpha: np.ndarray, *, max_pores: int = 18) -> list[dict[str, float]]:
    h, w = texture_rgb.shape[:2]
    bbox = face_bbox_from_alpha(alpha)
    roi = cheek_roi_mask((h, w), bbox)
    gray = cv2.cvtColor(texture_rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    blur = cv2.GaussianBlur(gray, (0, 0), 2.2)
    high = np.abs(gray - blur)
    high[roi == 0] = 0
    high[alpha <= 40] = 0

    valid = high > 0
    if valid.sum() < 400:
        return []

    thresh = float(np.percentile(high[valid], 93))
    peaks = (high >= thresh).astype(np.uint8) * 255
    peaks = cv2.morphologyEx(peaks, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)), 1)
    n, _labels, stats, centroids = cv2.connectedComponentsWithStats(peaks, connectivity=8)
    pores: list[tuple[float, tuple[float, float, float]]] = []
    for idx in range(1, n):
        area = stats[idx, cv2.CC_STAT_AREA]
        if area < 2 or area > 120:
            continue
        cx_px, cy_px = centroids[idx]
        cx, cy = px_to_vb(float(cx_px), float(cy_px), bbox)
        if not (10 <= cx <= 90 and 22 <= cy <= 86):
            continue
        r = float(np.clip(np.sqrt(area) / max(bbox[2], 1) * 100 * 0.05, 0.18, 0.42))
        pores.append((float(high[int(cy_px), int(cx_px)]), (cx, cy, r)))

    pores.sort(key=lambda item: item[0], reverse=True)
    return [{"cx": cx, "cy": cy, "r": r} for _score, (cx, cy, r) in pores[:max_pores]]


def render_pore_mask(
    rgb: np.ndarray,
    alpha: np.ndarray,
    *,
    angle: str,
) -> np.ndarray:
    """Return a brownish RGBA mask highlighting the darkest ~25% of skin pixels.

    Pores appear as pixels darker than their local surroundings; the signal is
    (local_average - gray) at a scale matched to pore size (~4 px sigma).
    Same skin-mask / surface geometry as render_redness_mask.
    """
    h, w = rgb.shape[:2]
    bbox = redness_face_bbox(rgb, alpha, angle)
    x0, y0, x1, y1 = bbox
    fw, fh = max(1, x1 - x0), max(1, y1 - y0)
    yy, xx = np.mgrid[0:h, 0:w]
    nx = (xx - x0) / fw
    ny = (yy - y0) / fh

    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    hue, sat, val = cv2.split(hsv)
    r_ch = rgb[:, :, 0].astype(np.int16)
    g_ch = rgb[:, :, 1].astype(np.int16)
    b_ch = rgb[:, :, 2].astype(np.int16)
    chroma_ok = (
        (hue < 18) & (sat > 18) & (sat < 128) & (val > 68) & (val < 250)
        & (r_ch >= g_ch - 22) & (r_ch >= b_ch - 16)
    )
    magenta_hair = ((hue > 145) & (sat > 70)) | ((r_ch > g_ch + 38) & (b_ch > g_ch + 18) & (sat > 110))
    base_skin = (chroma_ok & ~magenta_hair).astype(np.float32)

    if angle == "front":
        surface = 1 - _smoothstep(0.88, 1.10, ((nx - 0.50) / 0.47) ** 2 + ((ny - 0.55) / 0.58) ** 2)
        surface *= _smoothstep(0.13, 0.20, nx) * (1 - _smoothstep(0.80, 0.88, nx))
        surface *= _smoothstep(0.23, 0.31, ny) * (1 - _smoothstep(0.86, 0.96, ny))
        eyes = _gaussian_2d(nx, ny, 0.35, 0.40, 0.13, 0.055) + _gaussian_2d(nx, ny, 0.65, 0.40, 0.13, 0.055)
        lips = _gaussian_2d(nx, ny, 0.50, 0.70, 0.20, 0.050)
        brows = _gaussian_2d(nx, ny, 0.35, 0.33, 0.14, 0.035) + _gaussian_2d(nx, ny, 0.65, 0.33, 0.14, 0.035)
        surface *= 1 - np.clip(0.95 * eyes + 0.88 * lips + 0.55 * brows, 0, 0.95)
    else:
        surface = 1 - _smoothstep(0.88, 1.10, ((nx - 0.66) / 0.40) ** 2 + ((ny - 0.55) / 0.58) ** 2)
        surface *= _smoothstep(0.16, 0.42, nx) * (1 - _smoothstep(0.93, 1.02, nx))
        surface *= _smoothstep(0.25, 0.33, ny) * (1 - _smoothstep(0.86, 0.96, ny))
        eyes = _gaussian_2d(nx, ny, 0.73, 0.40, 0.12, 0.055)
        lips = _gaussian_2d(nx, ny, 0.80, 0.68, 0.15, 0.050)
        surface *= 1 - np.clip(0.95 * eyes + 0.80 * lips, 0, 0.95)

    skin_binary = ((base_skin * surface) > 0.05).astype(np.uint8)
    close_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
    skin_binary = cv2.morphologyEx(skin_binary, cv2.MORPH_CLOSE, close_kernel, 1)
    skin = np.clip(cv2.GaussianBlur(skin_binary.astype(np.float32) * surface, (0, 0), 2.2), 0, 1)
    valid = skin > 0.12
    if int(valid.sum()) < 500:
        return np.zeros((h, w, 4), np.uint8)

    # Pore signal: how much darker is each pixel than its local surroundings.
    # sigma=4 matches pore scale (~4-8 px width in typical facial photos).
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    local_avg = cv2.GaussianBlur(gray, (0, 0), 4.0)
    darkness = np.maximum(local_avg - gray, 0.0) * skin

    thresh = float(np.percentile(darkness[valid], 75))
    peak   = float(np.percentile(darkness[valid], 99))
    heat = np.clip((darkness - thresh) / max(peak - thresh, 1e-3), 0, 1) * skin
    # Small blur: keep pores crisp, not smeared like the redness overlay.
    heat = cv2.GaussianBlur(heat, (0, 0), 1.5)
    mask_alpha = np.clip(heat * 0.55, 0, 0.45)

    rgba = np.zeros((h, w, 4), np.uint8)
    rgba[:, :, 0] = 72   # brownish-dark
    rgba[:, :, 1] = 44
    rgba[:, :, 2] = 22
    rgba[:, :, 3] = np.clip(mask_alpha * 255, 0, 255).astype(np.uint8)
    return rgba


def build_cv_annotations(
    angle_images: dict[str, np.ndarray],
    angle_alphas: dict[str, np.ndarray],
    angle_textures: dict[str, np.ndarray],
    *,
    target_dir: Path | None = None,
    slug: str | None = None,
) -> dict[str, Any]:
    dark_spots: dict[str, list[dict[str, float]]] = {}
    red_spots: dict[str, list[dict[str, float]]] = {}
    red_masks: dict[str, str] = {}
    pore_masks: dict[str, str] = {}
    all_pores: list[dict[str, float]] = []
    for angle in ANGLES:
        rgb = angle_images.get(angle)
        alpha = angle_alphas.get(angle)
        texture = angle_textures.get(angle)
        if rgb is None or alpha is None:
            continue
        spots = detect_pigment_spots(rgb, alpha, angle=angle)
        if spots:
            dark_spots[angle] = spots
        red = detect_redness_spots(rgb, alpha, angle=angle)
        if red:
            red_spots[angle] = red
        if target_dir is not None and slug is not None:
            red_mask = render_redness_mask(rgb, alpha, angle=angle, spots=red)
            if int((red_mask[:, :, 3] > 6).sum()) > 100:
                mask_path = target_dir / f"{slug}-{angle}-redness-mask.png"
                save_rgba_png(red_mask, mask_path)
                red_masks[angle] = f"/demo-3d/{slug}/{mask_path.name}"
            pore_mask = render_pore_mask(rgb, alpha, angle=angle)
            if int((pore_mask[:, :, 3] > 6).sum()) > 100:
                pmask_path = target_dir / f"{slug}-{angle}-pore-mask.png"
                save_rgba_png(pore_mask, pmask_path)
                pore_masks[angle] = f"/demo-3d/{slug}/{pmask_path.name}"
        if angle == "front" and texture is not None:
            all_pores = detect_pores(texture, alpha)

    return {
        "wrinkles": [],
        "volume": [],
        "redAreas": [],
        "redMaskByAngle": red_masks,
        "poreMaskByAngle": pore_masks,
        "redSpotsByAngle": red_spots,
        "pores": all_pores,
        "darkSpotsByAngle": dark_spots,
    }


def generate_aura_assets(
    *,
    slug: str,
    turntable_video_path: Path,
    photo_bytes: dict[str, bytes] | None = None,
    turntable_video_url: str | None = None,
    skip_videos: bool = False,
    out_dir: Path | None = None,
) -> dict[str, Any]:
    """Build patient Aura assets and return a manifest dict (camelCase keys)."""
    photo_bytes = photo_bytes or {}
    target_dir = out_dir or (PUBLIC_3D / slug)
    target_dir.mkdir(parents=True, exist_ok=True)

    photo_angles = photo_sourced_angles(photo_bytes)
    angle_images = map_photos_to_angles(photo_bytes)
    for angle in ANGLES:
        if angle not in angle_images:
            angle_images[angle] = extract_frame_at_ratio(
                turntable_video_path,
                ANGLE_TIME_RATIOS[angle],
            )

    angle_alphas: dict[str, np.ndarray] = {}
    angle_textures: dict[str, np.ndarray] = {}
    angles_manifest: dict[str, Any] = {}
    for angle in ANGLES:
        rgb = angle_images[angle]
        rgba = rembg_rgba(rgb)
        alpha = rgba[:, :, 3]
        texture_rgb = clinical_still_rgb(rgb, "gray", angle=angle)
        angle_alphas[angle] = alpha
        angle_textures[angle] = texture_rgb

        color_path = target_dir / f"{slug}-{angle}-color.png"
        rembg_path = target_dir / f"{slug}-{angle}-rembg.png"
        texture_path = target_dir / f"{slug}-{angle}-texture.png"
        pigment_path = target_dir / f"{slug}-{angle}-pigmentation.png"

        save_rgb_png(rgb, color_path)
        save_rgba_png(rgba, rembg_path)
        save_rgb_png(texture_rgb, texture_path)
        save_rgb_png(clinical_still_rgb(rgb, "brown", angle=angle), pigment_path)

        base = f"/demo-3d/{slug}"
        angles_manifest[angle] = {
            "src": f"{base}/{rembg_path.name}",
            "srcOriginal": f"{base}/{color_path.name}",
            "srcTexture": f"{base}/{texture_path.name}",
            "srcPigmentation": f"{base}/{pigment_path.name}",
            "timeRatio": ANGLE_TIME_RATIOS[angle],
            "label": ANGLE_LABELS[angle],
            "fromPhoto": angle in photo_angles,
        }

    cv_annotations = build_cv_annotations(
        angle_images,
        angle_alphas,
        angle_textures,
        target_dir=target_dir,
        slug=slug,
    )
    available_view_angles = photo_angles if photo_angles else ANGLES

    gray_video = target_dir / f"{slug}-turntable-skin-gray.mp4"
    brown_video = target_dir / f"{slug}-turntable-pigmentation.mp4"
    if not skip_videos:
        print(f"[aura] Processing skin-gray turntable for {slug}…", flush=True)
        process_video(turntable_video_path, gray_video, "gray")
        print(f"[aura] Processing pigmentation turntable for {slug}…", flush=True)
        process_video(turntable_video_path, brown_video, "brown")
    elif not gray_video.exists() or not brown_video.exists():
        print(f"[aura] --skip-videos set but derived turntables missing; encoding…", flush=True)
        process_video(turntable_video_path, gray_video, "gray")
        process_video(turntable_video_path, brown_video, "brown")

    base = f"/demo-3d/{slug}"
    manifest: dict[str, Any] = {
        "turntableVideoUrl": turntable_video_url or f"/demo-3d/{turntable_video_path.name}",
        "textureVideoUrl": f"{base}/{gray_video.name}",
        "pigmentationVideoUrl": f"{base}/{brown_video.name}",
        "availableViewAngles": available_view_angles,
        "cvAnnotations": cv_annotations,
        "angles": angles_manifest,
    }

    manifest_path = target_dir / f"{slug}-aura-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"[aura] Wrote manifest → {manifest_path}", flush=True)
    return manifest


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Generate patient Aura assets from turntable + photos.")
    parser.add_argument("--slug", required=True)
    parser.add_argument("--turntable", type=Path, required=True, help="Path to turntable MP4")
    parser.add_argument("--photo", action="append", default=[], metavar="KEY=PATH")
    parser.add_argument(
        "--skip-videos",
        action="store_true",
        help="Skip skin-gray/pigmentation turntable re-encode (faster manifest backfill)",
    )
    parser.add_argument(
        "--videos-only",
        action="store_true",
        help="Only re-encode gray/brown turntable MP4s from --turntable (no stills/manifest)",
    )
    args = parser.parse_args()

    if args.videos_only:
        slug = args.slug
        target_dir = PUBLIC_3D / slug
        target_dir.mkdir(parents=True, exist_ok=True)
        gray_video = target_dir / f"{slug}-turntable-skin-gray.mp4"
        brown_video = target_dir / f"{slug}-turntable-pigmentation.mp4"
        print(f"[aura] Re-encoding skin-gray turntable for {slug}…", flush=True)
        process_video(args.turntable, gray_video, "gray")
        print(f"[aura] Re-encoding pigmentation turntable for {slug}…", flush=True)
        process_video(args.turntable, brown_video, "brown")
        print(f"[aura] Done → {gray_video.name}, {brown_video.name}", flush=True)
        raise SystemExit(0)

    photos: dict[str, bytes] = {}
    for item in args.photo:
        key, _, path = item.partition("=")
        photos[key.strip()] = Path(path.strip()).read_bytes()

    result = generate_aura_assets(
        slug=args.slug,
        turntable_video_path=args.turntable,
        photo_bytes=photos,
        skip_videos=args.skip_videos,
    )
    print(json.dumps(result, indent=2))
