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
import subprocess
from io import BytesIO
from pathlib import Path
from typing import Any, Callable

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
is_flat_studio_backdrop = _turntable.is_flat_studio_backdrop


def slugify_client_name(name: str) -> str:
    return name.lower().replace(" ", "-").replace("/", "-").replace(".", "")


def modal_key_to_angle(key: str) -> str | None:
    base = key.split("_")[0]
    return MODAL_KEY_TO_ANGLE.get(base)


def decode_photo(data: bytes) -> np.ndarray:
    # Use PIL so pixel values match what render_redness_mask / render_pore_mask
    # receive when called locally on JPEG files (PIL vs OpenCV differ by 1-3 DN
    # per channel, which shifts percentile thresholds enough to change mask coverage).
    from io import BytesIO
    img = Image.open(BytesIO(data)).convert("RGB")
    return np.array(img)


def estimate_bbox(rgb: np.ndarray) -> tuple[int, int, int, int]:
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    ys, xs = np.where(gray > 25)
    h, w = rgb.shape[:2]
    if xs.size == 0:
        return (w // 4, h // 8, w // 2, h // 2)
    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    return (x0, y0, max(1, x1 - x0), max(1, y1 - y0))


def _is_black_plate(rgb: np.ndarray) -> bool:
    """True for FaceLift turntable frames on a dark background."""
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    h, w = gray.shape
    pad = max(8, min(h, w) // 12)
    corners = (
        gray[:pad, :pad],
        gray[:pad, -pad:],
        gray[-pad:, :pad:],
        gray[-pad:, -pad:],
    )
    return all(float(patch.mean()) < 32 for patch in corners)


def fill_alpha_holes(alpha: np.ndarray, *, threshold: int = 8) -> np.ndarray:
    """Convert a segmentation alpha into one solid subject silhouette.

    The Aura stills should have transparency only outside the person. GrabCut can
    classify bright details such as eye whites, earrings, or makeup highlights as
    background. Build one exterior border, fill all interior holes, then restore
    a small soft edge on the outside of the silhouette.
    """
    binary = (alpha > threshold).astype(np.uint8) * 255
    h, w = binary.shape

    kernel_size = max(9, min(h, w) // 30)
    if kernel_size % 2 == 0:
        kernel_size += 1
    close_kernel = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE,
        (kernel_size, kernel_size),
    )
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, close_kernel, iterations=2)

    contours, _hierarchy = cv2.findContours(
        binary,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE,
    )
    solid = np.zeros_like(binary)
    min_area = max(48.0, h * w * 0.0003)
    for contour in contours:
        if cv2.contourArea(contour) >= min_area:
            cv2.drawContours(solid, [contour], -1, 255, thickness=cv2.FILLED)

    if not np.any(solid):
        return alpha

    soft = cv2.GaussianBlur(solid, (0, 0), 1.6).astype(np.uint8)
    opaque = cv2.erode(
        solid,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)),
        iterations=1,
    )
    soft[opaque > 0] = 255
    return soft


def _luminance_alpha(rgb: np.ndarray, *, fill_holes: bool) -> np.ndarray:
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    alpha = (gray > 25).astype(np.uint8) * 255
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    alpha = cv2.morphologyEx(alpha, cv2.MORPH_CLOSE, kernel, 1)
    alpha = cv2.GaussianBlur(alpha, (0, 0), 2.0).astype(np.uint8)
    return fill_alpha_holes(alpha) if fill_holes else alpha


def refine_studio_alpha(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """Drop gray seamless-backdrop pixels GrabCut often leaves inside the matte."""
    h, w = rgb.shape[:2]
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    h_chan, sat, val = cv2.split(hsv)
    wall = (((val > 95) & (sat < 58) & (h_chan > 18) & (h_chan < 96)) | ((val > 145) & (sat < 36)))
    subject_color = (~wall & (((sat > 16) & (val > 34)) | (val < 92))).astype(np.uint8) * 255
    refined = cv2.bitwise_and(alpha, subject_color)

    x0, y0, x1, y1 = face_bbox_from_alpha(alpha)
    fw, fh = max(1, x1 - x0), max(1, y1 - y0)
    roi = np.zeros_like(alpha)
    cv2.rectangle(
        roi,
        (max(0, x0 - int(0.22 * fw)), max(0, y0 - int(0.28 * fh))),
        (min(w, x1 + int(0.22 * fw)), min(h, y1 + int(0.42 * fh))),
        255,
        -1,
    )
    refined = cv2.bitwise_and(refined, roi)

    close_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (17, 17))
    refined = cv2.morphologyEx(refined, cv2.MORPH_CLOSE, close_kernel, iterations=1)
    refined = cv2.GaussianBlur(refined, (0, 0), 1.2).astype(np.uint8)
    return refined


def _flood_studio_backdrop(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """Remove corner-connected light-gray studio backdrop from an intake photo matte."""
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    h, w = gray.shape
    person = alpha.astype(np.float32) / 255.0
    if not is_flat_studio_backdrop(gray, person):
        return alpha

    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    _h, sat, val = cv2.split(hsv)
    backdrop_seed = (((val > 100) & (sat < 52)) | ((gray > 175) & (sat < 42))).astype(np.uint8) * 255
    flood_mask = np.zeros((h + 2, w + 2), np.uint8)
    flooded = backdrop_seed.copy()
    for sx, sy in (
        (0, 0),
        (w - 1, 0),
        (0, h - 1),
        (w - 1, h - 1),
        (w // 2, 0),
        (w // 2, h - 1),
        (0, h // 2),
        (w - 1, h // 2),
    ):
        if flooded[sy, sx] > 0:
            cv2.floodFill(
                flooded,
                flood_mask,
                (sx, sy),
                255,
                loDiff=(14, 14, 14),
                upDiff=(14, 14, 14),
            )
    return cv2.bitwise_and(alpha, cv2.bitwise_not(flooded))


def detail_preserving_alpha(rgb: np.ndarray, *, turntable_fast: bool = False) -> np.ndarray:
    """Matte for texture plates — keeps sclera, jewelry, and other bright facial detail."""
    if turntable_fast or _is_black_plate(rgb):
        return _luminance_alpha(rgb, fill_holes=False)

    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    alpha = segment_person(bgr, estimate_bbox(rgb))
    alpha = cv2.dilate(
        alpha,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11)),
        iterations=1,
    )

    x0, y0, x1, y1 = face_bbox_from_alpha(alpha)
    h, w = rgb.shape[:2]
    fw, fh = max(1, x1 - x0), max(1, y1 - y0)
    face_roi = np.zeros((h, w), np.uint8)
    cv2.rectangle(
        face_roi,
        (max(0, x0 - int(0.10 * fw)), max(0, y0 - int(0.08 * fh))),
        (min(w, x1 + int(0.14 * fw)), min(h, y1 + int(0.18 * fh))),
        255,
        -1,
    )

    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    hue, sat, val = cv2.split(hsv)
    sclera = ((val > 165) & (sat < 92)).astype(np.uint8) * 255
    jewelry = ((val > 115) & (sat > 22) & (sat < 210)).astype(np.uint8) * 255
    extras = cv2.bitwise_and(cv2.bitwise_or(sclera, jewelry), face_roi)
    alpha = cv2.bitwise_or(alpha, extras)

    close_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    alpha = cv2.morphologyEx(alpha, cv2.MORPH_CLOSE, close_kernel, iterations=1)
    return cv2.GaussianBlur(alpha, (0, 0), 1.4).astype(np.uint8)


def aggressive_cutout_alpha(rgb: np.ndarray, *, turntable_fast: bool = False) -> np.ndarray:
    """Solid matte for rembg / redness / pores — removes studio backdrop aggressively."""
    if turntable_fast or _is_black_plate(rgb):
        return _luminance_alpha(rgb, fill_holes=True)

    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    alpha = fill_alpha_holes(segment_person(bgr, estimate_bbox(rgb)))
    alpha = refine_studio_alpha(rgb, alpha)
    alpha = _flood_studio_backdrop(rgb, alpha)
    alpha = cv2.erode(
        alpha,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)),
        iterations=1,
    )
    return cv2.GaussianBlur(alpha, (0, 0), 1.0).astype(np.uint8)


def rembg_rgba(rgb: np.ndarray, *, fast: bool = False) -> np.ndarray:
    alpha = aggressive_cutout_alpha(rgb, turntable_fast=fast)
    return np.dstack([rgb, alpha])


def clinical_still_rgb(
    rgb: np.ndarray,
    palette: str,
    *,
    angle: str = "front",
    turntable_fast: bool = False,
) -> np.ndarray:
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    out_bgr = process_frame(bgr, palette, angle=angle, turntable_fast=turntable_fast)
    return cv2.cvtColor(out_bgr, cv2.COLOR_BGR2RGB)


def save_rgba_png(rgba: np.ndarray, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, mode="RGBA").save(path, optimize=True)


def rgba_from_rgb_alpha(rgb: np.ndarray, alpha: np.ndarray, *, fill_holes: bool = True) -> np.ndarray:
    """Attach a subject matte to a generated RGB Aura plate."""
    matte = fill_alpha_holes(alpha) if fill_holes else alpha
    return np.dstack([rgb, matte])


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

    thresh = float(np.percentile(score[valid], 80))
    if thresh <= 0.3:
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
    alpha: np.ndarray | None = None,
    *,
    angle: str,
    spots: list[dict[str, float]],
) -> np.ndarray:
    """Return a red RGBA mask highlighting the reddest skin pixels.

    alpha is optional; when omitted a full-image mask is used so that
    background removal is not required.
    """
    h, w = rgb.shape[:2]
    if alpha is None:
        alpha = np.full((h, w), 255, dtype=np.uint8)
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

    # Threshold LAB "a" at the 65th percentile of skin pixels: the reddest
    # ~35% of skin is highlighted.  Lower threshold = more visible coverage.
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    a_chan = lab[:, :, 1].astype(np.float32)
    thresh = float(np.percentile(a_chan[valid], 65))
    peak   = float(np.percentile(a_chan[valid], 99))
    heat = np.clip((a_chan - thresh) / max(peak - thresh, 1e-3), 0, 1) * skin
    heat = cv2.GaussianBlur(heat, (0, 0), 4.0)
    mask_alpha = np.clip(heat * 0.80, 0, 0.70)

    rgba = np.zeros((h, w, 4), np.uint8)
    rgba[:, :, 0] = 220
    rgba[:, :, 2] = 10
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
    alpha: np.ndarray | None = None,
    *,
    angle: str,
) -> np.ndarray:
    """Return a brownish RGBA mask highlighting large visible pores.

    alpha is optional; when omitted a full-image mask is used so that
    background removal is not required.
    """
    h, w = rgb.shape[:2]
    if alpha is None:
        alpha = np.full((h, w), 255, dtype=np.uint8)
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

    thresh = float(np.percentile(darkness[valid], 65))
    peak   = float(np.percentile(darkness[valid], 99))
    heat = np.clip((darkness - thresh) / max(peak - thresh, 1e-3), 0, 1) * skin
    # Small blur: keep pores crisp, not smeared like the redness overlay.
    heat = cv2.GaussianBlur(heat, (0, 0), 1.5)
    mask_alpha = np.clip(heat * 0.80, 0, 0.65)

    rgba = np.zeros((h, w, 4), np.uint8)
    rgba[:, :, 0] = 58   # brownish-dark
    rgba[:, :, 1] = 34
    rgba[:, :, 2] = 16
    rgba[:, :, 3] = np.clip(mask_alpha * 255, 0, 255).astype(np.uint8)
    return rgba


def _make_reverse_video(src: Path, dest: Path) -> bool:
    """Create a time-reversed all-keyframe copy using ffmpeg."""
    cmd = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-i", str(src),
        "-vf", "reverse",
        "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
        "-g", "1", "-keyint_min", "1", "-sc_threshold", "0",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        str(dest),
    ]
    try:
        subprocess.run(cmd, check=True)
        return dest.exists() and dest.stat().st_size > 0
    except Exception as exc:
        print(f"[aura] reverse video failed: {exc}", flush=True)
        return False


def bake_redness_image(rgb: np.ndarray, redness_mask: np.ndarray) -> np.ndarray:
    """Composite redness mask directly into color photo pixels (no CSS needed).

    Produces the same visual result as the Morgan Westmoreland contact sheet:
    vivid pink/red patches clearly visible over natural skin tone.
    """
    alpha = redness_mask[:, :, 3].astype(np.float32) / 255.0
    # Ramp alpha up so even moderate redness reads clearly (max ~85% tint).
    eff = np.clip(alpha * 1.35, 0, 0.85)
    result = rgb.astype(np.float32).copy()
    # Shift skin toward saturated red: boost R slightly, crush G & B strongly.
    # Natural erythema tint: strong R, suppressed G/B, retains a little original colour.
    result[:, :, 0] = np.clip(rgb[:, :, 0] * (1 - eff * 0.08) + 215 * eff * 0.92, 0, 255)
    result[:, :, 1] = np.clip(rgb[:, :, 1] * (1 - eff * 0.66) + 55 * eff * 0.34, 0, 255)
    result[:, :, 2] = np.clip(rgb[:, :, 2] * (1 - eff * 0.62) + 45 * eff * 0.38, 0, 255)
    return result.astype(np.uint8)


def bake_pore_image(rgb: np.ndarray, pore_mask: np.ndarray) -> np.ndarray:
    """Composite pore mask onto a clean greyscale derived from the color photo.

    Converts color → greyscale directly (bypassing the clinical texture pipeline)
    to avoid any colour-processing artifacts, then darkens where pores are detected.
    """
    # Build clean neutral greyscale from the color photo.
    gray_2d = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    gray_rgb = np.stack([gray_2d, gray_2d, gray_2d], axis=-1).astype(np.float32)

    alpha = pore_mask[:, :, 3].astype(np.float32) / 255.0
    eff = np.clip(alpha * 1.40, 0, 0.82)
    lightness = (1 - eff * 0.82)[:, :, None]
    result = gray_rgb * lightness
    return np.clip(result, 0, 255).astype(np.uint8)


def build_cv_annotations(
    angle_images: dict[str, np.ndarray],
    angle_alphas: dict[str, np.ndarray],
    angle_textures: dict[str, np.ndarray],
    *,
    target_dir: Path | None = None,
    slug: str | None = None,
    skip_mask_files: bool = False,
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
        if rgb is None:
            continue
        alpha_mask = alpha if alpha is not None else np.zeros((rgb.shape[0], rgb.shape[1]), np.uint8)
        spots = detect_pigment_spots(rgb, alpha_mask, angle=angle)
        if spots:
            dark_spots[angle] = spots
        red = detect_redness_spots(rgb, alpha_mask, angle=angle)
        if red:
            red_spots[angle] = red
        if target_dir is not None and slug is not None and not skip_mask_files:
            # Masks don't use background removal — pass alpha=None to use full-image skin detection.
            red_mask = render_redness_mask(rgb, angle=angle, spots=red)
            if int((red_mask[:, :, 3] > 6).sum()) > 100:
                mask_path = target_dir / f"{slug}-{angle}-redness-mask.png"
                save_rgba_png(red_mask, mask_path)
                red_masks[angle] = f"/demo-3d/{slug}/{mask_path.name}"
            pore_mask = render_pore_mask(rgb, angle=angle)
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


def _downscale_rgb(rgb: np.ndarray, max_dim: int = 1024) -> np.ndarray:
    h, w = rgb.shape[:2]
    longest = max(h, w)
    if longest <= max_dim:
        return rgb
    scale = max_dim / longest
    return cv2.resize(
        rgb,
        (max(1, int(w * scale)), max(1, int(h * scale))),
        interpolation=cv2.INTER_AREA,
    )


def generate_aura_assets(
    *,
    slug: str,
    turntable_video_path: Path,
    photo_bytes: dict[str, bytes] | None = None,
    turntable_video_url: str | None = None,
    skip_videos: bool = False,
    scan_optimized: bool = False,
    out_dir: Path | None = None,
    on_progress: Callable[[float, str], None] | None = None,
) -> dict[str, Any]:
    """Build patient Aura assets and return a manifest dict (camelCase keys)."""

    def report(progress: float, message: str) -> None:
        if on_progress is not None:
            on_progress(progress, message)

    photo_bytes = photo_bytes or {}
    target_dir = out_dir or (PUBLIC_3D / slug)
    target_dir.mkdir(parents=True, exist_ok=True)

    report(0.925, "Extracting angle stills…")
    photo_angles = photo_sourced_angles(photo_bytes)
    angle_images = map_photos_to_angles(photo_bytes)
    for angle in ANGLES:
        if angle not in angle_images:
            angle_images[angle] = extract_frame_at_ratio(
                turntable_video_path,
                ANGLE_TIME_RATIOS[angle],
            )
    if scan_optimized:
        angle_images = {
            angle: _downscale_rgb(rgb) for angle, rgb in angle_images.items()
        }

    angle_alphas: dict[str, np.ndarray] = {}
    angle_textures: dict[str, np.ndarray] = {}
    angles_manifest: dict[str, Any] = {}
    for index, angle in enumerate(ANGLES):
        report(
            0.93 + 0.03 * (index / max(len(ANGLES), 1)),
            f"Generating skin maps ({ANGLE_LABELS[angle]})…",
        )
        rgb = angle_images[angle]
        turntable_sourced = angle not in photo_angles
        cutout_alpha = aggressive_cutout_alpha(rgb, turntable_fast=turntable_sourced)
        detail_alpha = detail_preserving_alpha(rgb, turntable_fast=turntable_sourced)
        rgba = np.dstack([rgb, cutout_alpha])
        texture_rgb = clinical_still_rgb(
            rgb, "gray", angle=angle, turntable_fast=turntable_sourced
        )
        angle_alphas[angle] = cutout_alpha
        angle_textures[angle] = texture_rgb

        color_path = target_dir / f"{slug}-{angle}-color.png"
        rembg_path = target_dir / f"{slug}-{angle}-rembg.png"
        texture_path = target_dir / f"{slug}-{angle}-texture.png"
        texture_cutout_path = target_dir / f"{slug}-{angle}-texture-cutout.png"
        pigment_path = target_dir / f"{slug}-{angle}-pigmentation.png"
        pigment_cutout_path = target_dir / f"{slug}-{angle}-pigmentation-cutout.png"

        save_rgb_png(rgb, color_path)
        save_rgba_png(rgba, rembg_path)
        save_rgb_png(texture_rgb, texture_path)
        save_rgba_png(
            rgba_from_rgb_alpha(texture_rgb, detail_alpha, fill_holes=False),
            texture_cutout_path,
        )
        pigment_rgb = clinical_still_rgb(
            rgb, "brown", angle=angle, turntable_fast=turntable_sourced
        )
        save_rgb_png(
            pigment_rgb,
            pigment_path,
        )
        save_rgba_png(rgba_from_rgb_alpha(pigment_rgb, cutout_alpha), pigment_cutout_path)

        base = f"/demo-3d/{slug}"
        angles_manifest[angle] = {
            "src": f"{base}/{rembg_path.name}",
            "srcOriginal": f"{base}/{color_path.name}",
            "srcTexture": f"{base}/{texture_cutout_path.name}",
            "srcPigmentation": f"{base}/{pigment_cutout_path.name}",
            "timeRatio": ANGLE_TIME_RATIOS[angle],
            "label": ANGLE_LABELS[angle],
            "fromPhoto": angle in photo_angles,
        }

    report(0.965, "Detecting skin features…")
    cv_annotations = build_cv_annotations(
        angle_images,
        angle_alphas,
        angle_textures,
        target_dir=target_dir,
        slug=slug,
        skip_mask_files=scan_optimized,
    )

    # Bake redness and pore overlays directly into per-angle JPEG stills so the
    # dashboard can display full-quality composites without CSS blend-mode tricks.
    if not scan_optimized:
        report(0.968, "Baking skin analysis stills…")
        for angle in ANGLES:
            rgb = angle_images.get(angle)
            texture = angle_textures.get(angle)
            if rgb is None or target_dir is None:
                continue
            red_mask_path = target_dir / f"{slug}-{angle}-redness-mask.png"
            pore_mask_path = target_dir / f"{slug}-{angle}-pore-mask.png"
            base = f"/demo-3d/{slug}"
            if red_mask_path.exists():
                red_mask = np.array(Image.open(red_mask_path).convert("RGBA"))
                baked_r = bake_redness_image(rgb, red_mask)
                baked_r_path = target_dir / f"{slug}-{angle}-redness-cutout.png"
                save_rgba_png(rgba_from_rgb_alpha(baked_r, angle_alphas[angle]), baked_r_path)
                angles_manifest[angle]["srcRedness"] = f"{base}/{baked_r_path.name}"
            if pore_mask_path.exists():
                pore_mask = np.array(Image.open(pore_mask_path).convert("RGBA"))
                baked_p = bake_pore_image(rgb, pore_mask)
                baked_p_path = target_dir / f"{slug}-{angle}-pores-cutout.png"
                save_rgba_png(rgba_from_rgb_alpha(baked_p, angle_alphas[angle]), baked_p_path)
                angles_manifest[angle]["srcPores"] = f"{base}/{baked_p_path.name}"

    available_view_angles = photo_angles if photo_angles else ANGLES

    turntable_ref = turntable_video_url or f"/demo-3d/{turntable_video_path.name}"
    gray_video = target_dir / f"{slug}-turntable-skin-gray.mp4"
    brown_video = target_dir / f"{slug}-turntable-pigmentation.mp4"
    redness_video = target_dir / f"{slug}-turntable-redness.mp4"
    pores_video = target_dir / f"{slug}-turntable-pores.mp4"
    wrinkles_video = target_dir / f"{slug}-turntable-wrinkles.mp4"
    if not skip_videos:
        report(0.975, "Encoding texture turntable…")
        print(f"[aura] Processing skin-gray turntable for {slug}…", flush=True)
        process_video(turntable_video_path, gray_video, "gray", ping_pong=True)
        report(0.980, "Encoding pigmentation turntable…")
        print(f"[aura] Processing pigmentation turntable for {slug}…", flush=True)
        process_video(turntable_video_path, brown_video, "brown", ping_pong=True)
        report(0.983, "Encoding redness turntable…")
        print(f"[aura] Processing redness turntable for {slug}…", flush=True)
        process_video(turntable_video_path, redness_video, "redness", ping_pong=True)
        report(0.987, "Encoding pores turntable…")
        print(f"[aura] Processing pores turntable for {slug}…", flush=True)
        process_video(turntable_video_path, pores_video, "pores", ping_pong=True)
        report(0.990, "Encoding wrinkles turntable…")
        print(f"[aura] Processing wrinkles turntable for {slug}…", flush=True)
        process_video(turntable_video_path, wrinkles_video, "wrinkles", ping_pong=True)

    base = f"/demo-3d/{slug}"
    manifest: dict[str, Any] = {
        "turntableVideoUrl": turntable_ref,
        "textureVideoUrl": turntable_ref if skip_videos else f"{base}/{gray_video.name}",
        "pigmentationVideoUrl": turntable_ref if skip_videos else f"{base}/{brown_video.name}",
        "rednessVideoUrl": turntable_ref if skip_videos else f"{base}/{redness_video.name}",
        "rednessReverseVideoUrl": None,
        "poresVideoUrl": turntable_ref if skip_videos else f"{base}/{pores_video.name}",
        "poresReverseVideoUrl": None,
        "wrinklesVideoUrl": turntable_ref if skip_videos else f"{base}/{wrinkles_video.name}",
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
