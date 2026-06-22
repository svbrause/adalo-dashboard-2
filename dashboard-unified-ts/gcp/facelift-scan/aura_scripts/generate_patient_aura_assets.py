#!/usr/bin/env python3
"""Generate per-patient Aura assets after 3D turntable reconstruction.

Outputs under public/demo-3d/{slug}/:
  - {slug}-{angle}-rembg.png       — GrabCut background removal
  - {slug}-{angle}-color.png       — original angle still (when supplied)
  - {slug}-{angle}-texture.png     — clinical grayscale skin map
  - {slug}-{angle}-pigmentation.png — MediaPipe-masked clinical pigment map (Tanya manual pipeline)
  - {slug}-{angle}-redness-mask.png — granular red spot mask
  - {slug}-turntable-skin-gray.mp4
  - {slug}-turntable-pigmentation.mp4
  - {slug}-aura-manifest.json
"""

from __future__ import annotations

import importlib.util
import json
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO
from pathlib import Path
from typing import Any, Callable

import cv2
import numpy as np
from PIL import Image, ImageOps

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
    # Capture labels are anatomical/patient-side. The Aura rail labels are
    # visual directions, so a patient-left profile faces viewer-right.
    "left90": "profile-right",
    "right90": "profile-left",
    "left45": "three-quarter-right",
    "right45": "three-quarter-left",
    "side": "profile-right",
    "left": "profile-right",
    "right": "profile-left",
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
_wrinkle_crease = _load_module(
    "wrinkle_crease_detect",
    SCRIPT_DIR / "wrinkle_crease_detect.py",
)
_pigment_map = _load_module(
    "pigment_map_pipeline",
    SCRIPT_DIR / "generate-tanya-pigmentation-map.py",
)
_mp_wrinkles = _load_module(
    "mediapipe_wrinkle_paths",
    SCRIPT_DIR / "mediapipe_wrinkle_paths.py",
)
segment_person = _cv_assets.segment_person
subject_mask = _turntable.subject_mask
composite_matte = _turntable.composite_matte
process_frame = _turntable.process_frame
process_video = _turntable.process_video
is_flat_studio_backdrop = _turntable.is_flat_studio_backdrop
mediapipe_wrinkle_paths = _mp_wrinkles.mediapipe_wrinkle_paths
mediapipe_structural_fold_paths = _mp_wrinkles.mediapipe_structural_fold_paths
pigment_skin_mask = _pigment_map.skin_mask
pigment_signal = _pigment_map.pigment_signal
pigment_clinical_base = _pigment_map.clinical_base
pigment_build_overlay = _pigment_map.build_overlay


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
    img = ImageOps.exif_transpose(Image.open(BytesIO(data))).convert("RGB")
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


def _rembg_alpha(rgb: np.ndarray) -> np.ndarray | None:
    """Try rembg (deep-learning background removal). Returns alpha or None if unavailable."""
    try:
        import io
        from rembg import remove
        from PIL import Image as _PILImage
        buf = io.BytesIO()
        _PILImage.fromarray(rgb).save(buf, format="PNG")
        result_bytes = remove(buf.getvalue())
        result_rgba = np.array(_PILImage.open(io.BytesIO(result_bytes)).convert("RGBA"))
        alpha = result_rgba[:, :, 3]
        # Close small holes and smooth edges
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        alpha = cv2.morphologyEx(alpha, cv2.MORPH_CLOSE, kernel, iterations=1)
        return cv2.GaussianBlur(alpha, (0, 0), 1.2).astype(np.uint8)
    except Exception:
        return None


def aggressive_cutout_alpha(rgb: np.ndarray, *, turntable_fast: bool = False) -> np.ndarray:
    """Solid matte — uses rembg (deep learning) when available, falls back to GrabCut."""
    if turntable_fast or _is_black_plate(rgb):
        return _luminance_alpha(rgb, fill_holes=True)

    alpha = _rembg_alpha(rgb)
    if alpha is not None:
        return alpha

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


def profile_pigment_boost_overlay(
    rgb: np.ndarray,
    alpha: np.ndarray,
    *,
    angle: str,
) -> Image.Image | None:
    """Add a profile-aware pigment heat layer when the MediaPipe skin mask under-reads side views."""
    if not angle.startswith("profile"):
        return None

    h, w = rgb.shape[:2]
    bbox = redness_face_bbox(rgb, alpha, angle)
    x0, y0, x1, y1 = bbox
    fw, fh = max(1, x1 - x0), max(1, y1 - y0)

    skin = face_skin_mask(rgb, alpha, bbox)
    roi = np.zeros((h, w), np.uint8)
    if angle == "profile-right":
        roi_x0 = x0 + int(0.04 * fw)
        roi_x1 = x0 + int(0.82 * fw)
        brow_exclusion = (
            (x0 + int(0.48 * fw), y0 + int(0.20 * fh)),
            (x1, y0 + int(0.42 * fh)),
        )
    else:
        roi_x0 = x0 + int(0.18 * fw)
        roi_x1 = x0 + int(0.96 * fw)
        brow_exclusion = (
            (x0, y0 + int(0.20 * fh)),
            (x0 + int(0.52 * fw), y0 + int(0.42 * fh)),
        )
    cv2.rectangle(
        roi,
        (roi_x0, y0 + int(0.18 * fh)),
        (roi_x1, y0 + int(0.88 * fh)),
        255,
        -1,
    )
    cv2.rectangle(roi, brow_exclusion[0], brow_exclusion[1], 0, -1)

    edge_px = max(9, int(min(h, w) * 0.008))
    if edge_px % 2 == 0:
        edge_px += 1
    eroded_alpha = cv2.erode(
        (alpha > 40).astype(np.uint8) * 255,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (edge_px, edge_px)),
        iterations=1,
    )
    valid = (skin > 0) & (roi > 0) & (eroded_alpha > 0)
    if int(valid.sum()) < 800:
        return None

    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    lightness = lab[:, :, 0].astype(np.float32)
    a_chan = lab[:, :, 1].astype(np.float32)
    b_chan = lab[:, :, 2].astype(np.float32)
    local_lightness = cv2.GaussianBlur(lightness, (0, 0), 19)
    local_dark = np.maximum(local_lightness - lightness, 0)

    median_lightness = float(np.median(lightness[valid]))
    median_a = float(np.median(a_chan[valid]))
    median_b = float(np.median(b_chan[valid]))
    score = (
        0.78 * local_dark
        + 0.28 * np.maximum(a_chan - median_a, 0)
        + 0.14 * np.maximum(b_chan - median_b, 0)
    )
    score[lightness < median_lightness - 26] = 0
    score[lightness > median_lightness + 60] = 0
    score[~valid] = 0

    valid_scores = score[valid]
    low = float(np.percentile(valid_scores, 76))
    high = float(np.percentile(valid_scores, 96))
    if high <= low + 1e-3:
        return None

    pigment = np.clip((score - low) / (high - low), 0, 1)
    pigment = cv2.morphologyEx(
        np.clip(pigment * 255, 0, 255).astype(np.uint8),
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)),
        iterations=1,
    ).astype(np.float32) / 255.0
    pigment = cv2.GaussianBlur(pigment, (0, 0), 1.15)

    overlay = np.zeros((h, w, 4), np.uint8)
    overlay[:, :, :3] = np.array([80, 48, 92], np.uint8)
    overlay[:, :, 3] = np.clip(pigment * 165, 0, 165).astype(np.uint8)
    if int((overlay[:, :, 3] > 12).sum()) < 80:
        return None
    return Image.fromarray(overlay, "RGBA")


def pigmentation_photo_still_rgb(
    rgb: np.ndarray,
    alpha: np.ndarray,
    *,
    angle: str = "front",
    turntable_fast: bool = False,
) -> np.ndarray:
    """Clinical pigment plate with an added side-view pigment boost for profile photos."""
    mask = pigment_skin_mask(rgb)
    diffuse, flecks = pigment_signal(rgb, mask)
    src = Image.fromarray(rgb)
    base = pigment_clinical_base(src, "gray")
    overlay = pigment_build_overlay(diffuse, flecks, "gray")
    composed_img = Image.alpha_composite(base, overlay)
    profile_overlay = profile_pigment_boost_overlay(rgb, alpha, angle=angle)
    if profile_overlay is not None:
        composed_img = Image.alpha_composite(composed_img, profile_overlay)
    composed = np.array(composed_img.convert("RGB"))

    subj = subject_mask(rgb)
    matte = composite_matte(rgb, subj, turntable_fast=turntable_fast)
    return np.clip(composed.astype(np.float32) * matte[:, :, None], 0, 255).astype(np.uint8)


def wrinkle_view_still_rgb(
    rgb: np.ndarray,
    *,
    angle: str = "front",
    turntable_fast: bool = False,
) -> np.ndarray:
    """Teal wrinkle lens still — same renderer as the turntable wrinkles video."""
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    out_bgr = process_frame(bgr, "wrinkles", angle=angle, turntable_fast=turntable_fast)
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


def _wrinkle_face_surface(rgb: np.ndarray, alpha: np.ndarray | None, angle: str) -> np.ndarray:
    """Soft facial-skin field used to keep wrinkle heat off hair/beard/background."""
    h, w = rgb.shape[:2]
    matte = alpha if alpha is not None else np.full((h, w), 255, np.uint8)
    x0, y0, x1, y1 = redness_face_bbox(rgb, matte, angle)
    fw, fh = max(1, x1 - x0), max(1, y1 - y0)
    yy, xx = np.mgrid[0:h, 0:w]
    nx = (xx - x0) / fw
    ny = (yy - y0) / fh
    if angle == "front":
        surface = 1 - _smoothstep(0.86, 1.07, ((nx - 0.50) / 0.45) ** 2 + ((ny - 0.55) / 0.56) ** 2)
        surface *= _smoothstep(0.15, 0.23, nx) * (1 - _smoothstep(0.78, 0.86, nx))
        surface *= _smoothstep(0.24, 0.31, ny) * (1 - _smoothstep(0.84, 0.94, ny))
        eyes = _gaussian_2d(nx, ny, 0.35, 0.40, 0.13, 0.055) + _gaussian_2d(nx, ny, 0.65, 0.40, 0.13, 0.055)
        lips = _gaussian_2d(nx, ny, 0.50, 0.70, 0.20, 0.050)
        brows = _gaussian_2d(nx, ny, 0.35, 0.32, 0.15, 0.052) + _gaussian_2d(nx, ny, 0.65, 0.32, 0.15, 0.052)
        surface *= 1 - np.clip(0.95 * eyes + 0.86 * lips + 0.92 * brows, 0, 0.97)
    else:
        surface = 1 - _smoothstep(0.82, 1.04, ((nx - 0.67) / 0.36) ** 2 + ((ny - 0.56) / 0.54) ** 2)
        surface *= _smoothstep(0.24, 0.42, nx) * (1 - _smoothstep(0.86, 0.96, nx))
        surface *= _smoothstep(0.18, 0.28, ny) * (1 - _smoothstep(0.83, 0.94, ny))
        eyes = _gaussian_2d(nx, ny, 0.73, 0.40, 0.12, 0.055)
        lips = _gaussian_2d(nx, ny, 0.80, 0.68, 0.15, 0.050)
        surface *= 1 - np.clip(0.95 * eyes + 0.82 * lips, 0, 0.96)
    return np.clip(surface, 0.0, 1.0).astype(np.float32)


def _wrinkle_feature_exclusion_mask(nx: np.ndarray, ny: np.ndarray, angle: str) -> np.ndarray:
    """Small display-only holes for facial features that should not receive wrinkle tint."""
    if angle == "front":
        eyes = _gaussian_2d(nx, ny, 0.35, 0.405, 0.110, 0.030) + _gaussian_2d(nx, ny, 0.65, 0.405, 0.110, 0.030)
        brows = _gaussian_2d(nx, ny, 0.35, 0.323, 0.140, 0.024) + _gaussian_2d(nx, ny, 0.65, 0.323, 0.140, 0.024)
        lips = _gaussian_2d(nx, ny, 0.50, 0.692, 0.225, 0.052) + _gaussian_2d(nx, ny, 0.50, 0.638, 0.180, 0.032)
    else:
        eyes = _gaussian_2d(nx, ny, 0.73, 0.405, 0.105, 0.030)
        brows = _gaussian_2d(nx, ny, 0.73, 0.323, 0.130, 0.024)
        lips = _gaussian_2d(nx, ny, 0.80, 0.688, 0.170, 0.052)
    features = eyes + brows * 0.96 + lips * 0.92
    return np.clip(_smoothstep(0.24, 0.62, features), 0.0, 1.0).astype(np.float32)


_FACE_OVAL_INDICES = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
    397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
    172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
]


def _wrinkle_face_oval_mask(
    rgb: np.ndarray,
    *,
    fallback_bbox: tuple[int, int, int, int],
) -> np.ndarray | None:
    """Soft MediaPipe face-oval mask for the display overlay boundary."""
    lm = _mp_wrinkles._landmarks_on_image(rgb, fallback_bbox)
    if lm is None:
        return None
    h, w = rgb.shape[:2]
    pts = []
    for idx in _FACE_OVAL_INDICES:
        if idx >= len(lm):
            return None
        pts.append([float(lm[idx].x * w), float(lm[idx].y * h)])
    pts_arr = np.asarray(pts, np.float32)
    min_y = float(pts_arr[:, 1].min())
    max_y = float(pts_arr[:, 1].max())
    center_y = float(np.median(pts_arr[:, 1]))
    center_x = float(np.median(pts_arr[:, 0]))
    face_h = max(1.0, max_y - min_y)
    upper_span = max(1.0, center_y - min_y)
    lower_span = max(1.0, max_y - center_y)
    for point in pts_arr:
        top_t = np.clip((center_y - point[1]) / upper_span, 0.0, 1.0)
        bottom_t = np.clip((point[1] - center_y) / lower_span, 0.0, 1.0)
        point[1] -= face_h * 0.055 * (top_t ** 1.7)
        point[1] += face_h * 0.026 * (bottom_t ** 2.2)
        point[0] += (center_x - point[0]) * 0.030 * (bottom_t ** 1.4)
    pts_arr[:, 0] = np.clip(pts_arr[:, 0], 0, w - 1)
    pts_arr[:, 1] = np.clip(pts_arr[:, 1], 0, h - 1)
    mask = np.zeros((h, w), np.uint8)
    cv2.fillPoly(mask, [np.rint(pts_arr).astype(np.int32)], 255)
    dilate_size = max(3, int(min(h, w) * 0.0025))
    if dilate_size % 2 == 0:
        dilate_size += 1
    mask = cv2.dilate(
        mask,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (dilate_size, dilate_size)),
        iterations=1,
    )
    return cv2.GaussianBlur(
        mask.astype(np.float32) / 255.0,
        (0, 0),
        max(1.2, min(h, w) * 0.004),
    )


def _facial_hair_exclusion(
    rgb: np.ndarray,
    alpha: np.ndarray | None,
    *,
    angle: str,
    face_surface: np.ndarray,
    gray: np.ndarray,
    sat: np.ndarray,
    val: np.ndarray,
) -> np.ndarray:
    """Soft mask for mustache/beard texture inside the lower facial-skin field."""
    h, w = rgb.shape[:2]
    person = alpha if alpha is not None else np.full((h, w), 255, np.uint8)
    x0, y0, x1, y1 = redness_face_bbox(rgb, person, angle)
    fw, fh = max(1, x1 - x0), max(1, y1 - y0)
    yy, xx = np.mgrid[0:h, 0:w]
    nx = (xx - x0) / fw
    ny = (yy - y0) / fh
    lower_chin_zone = np.zeros((h, w), np.float32)

    if angle == "front":
        moustache = (
            _smoothstep(0.50, 0.57, ny)
            * (1 - _smoothstep(0.67, 0.76, ny))
            * _smoothstep(0.24, 0.34, nx)
            * (1 - _smoothstep(0.66, 0.76, nx))
        )
        chin = (
            _smoothstep(0.68, 0.75, ny)
            * (1 - _smoothstep(0.89, 0.98, ny))
            * _smoothstep(0.24, 0.35, nx)
            * (1 - _smoothstep(0.65, 0.76, nx))
        )
        lower_chin_zone = (
            _smoothstep(0.80, 0.88, ny)
            * (1 - _smoothstep(1.00, 1.08, ny))
            * _smoothstep(0.26, 0.36, nx)
            * (1 - _smoothstep(0.64, 0.74, nx))
        ).astype(np.float32)
        jaw = (
            _smoothstep(0.66, 0.75, ny)
            * (1 - _smoothstep(0.89, 0.98, ny))
            * (
                _smoothstep(0.10, 0.20, nx) * (1 - _smoothstep(0.34, 0.45, nx))
                + _smoothstep(0.55, 0.66, nx) * (1 - _smoothstep(0.80, 0.90, nx))
            )
        )
        zone = np.clip(moustache + chin + lower_chin_zone * 1.12 + jaw * 0.72, 0.0, 1.0)
        lip_hole = (
            _smoothstep(0.62, 0.68, ny)
            * (1 - _smoothstep(0.75, 0.82, ny))
            * _smoothstep(0.32, 0.40, nx)
            * (1 - _smoothstep(0.60, 0.68, nx))
        )
        zone = np.clip(zone * (1.0 - lip_hole * 0.98), 0.0, 1.0)
    else:
        zone = (
            _smoothstep(0.54, 0.64, ny)
            * (1 - _smoothstep(0.90, 0.99, ny))
            * _smoothstep(0.30, 0.44, nx)
            * (1 - _smoothstep(0.88, 0.98, nx))
        )

    reference = (face_surface > 0.18) & (person > 40) & (sat > 8) & (val > 50)
    dark_cutoff = 124
    if int(reference.sum()) > 300:
        dark_cutoff = int(np.clip(np.percentile(val[reference], 48) - 24, 86, 156))

    hair_binary = (
        (zone > 0.10)
        & (person > 40)
        & (val < dark_cutoff)
        & (gray < dark_cutoff)
        & (sat < 150)
    ).astype(np.uint8)

    if int(hair_binary.sum()) < 12:
        return np.zeros((h, w), np.float32)
    zone_area = max(1, int(((zone > 0.08) & (face_surface > 0.08) & (person > 40)).sum()))
    hair_presence = float(hair_binary.sum()) / float(zone_area)
    lower_chin_area = max(1, int(((lower_chin_zone > 0.08) & (face_surface > 0.08) & (person > 40)).sum()))
    lower_chin_presence = float(((hair_binary > 0) & (lower_chin_zone > 0.08)).sum()) / float(lower_chin_area)

    kernel_size = max(9, int(min(h, w) * 0.014))
    if kernel_size % 2 == 0:
        kernel_size += 1
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
    hair_binary = cv2.morphologyEx(hair_binary, cv2.MORPH_CLOSE, kernel, iterations=1)
    hair_binary = cv2.dilate(hair_binary, kernel, iterations=2)
    soft = cv2.GaussianBlur(hair_binary.astype(np.float32), (0, 0), max(2.4, kernel_size * 1.10))
    broad_zone = zone * float(_smoothstep(0.010, 0.045, np.array(hair_presence, dtype=np.float32)))
    lower_chin_suppress = lower_chin_zone * float(_smoothstep(0.006, 0.022, np.array(lower_chin_presence, dtype=np.float32)))
    return np.clip(
        np.maximum(np.maximum(soft, broad_zone * 0.92), lower_chin_suppress * 0.98)
        * zone
        * face_surface,
        0.0,
        1.0,
    ).astype(np.float32)


def _clean_wrinkle_skin_mask(
    rgb: np.ndarray,
    alpha: np.ndarray | None,
    *,
    angle: str,
) -> np.ndarray:
    """Face-skin mask for wrinkle heatmaps; suppresses hair, beard, dark features, background."""
    h, w = rgb.shape[:2]
    person = alpha if alpha is not None else np.full((h, w), 255, np.uint8)
    skin = _wrinkle_crease._build_skin_mask(rgb, person)
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    hue, sat, val = cv2.split(hsv)
    seed = (skin > 0) & (val > 45) & (sat > 8) & ((hue < 32) | (hue > 164))
    skin_val_floor = 58
    if int(seed.sum()) > 200:
        skin_val_floor = max(45, int(np.percentile(val[seed], 45)) - 55)
    plausible_skin = (
        (val > skin_val_floor)
        & (val < 246)
        & (sat > 10)
        & (sat < 108)
        & ((hue < 30) | (hue > 166))
        & (gray > skin_val_floor)
    ).astype(np.uint8) * 255
    face_surface = _wrinkle_face_surface(rgb, alpha, angle)
    mask = cv2.bitwise_and(skin, plausible_skin)

    n, labels, stats, _ = cv2.connectedComponentsWithStats((mask > 0).astype(np.uint8), 8)
    if n > 1:
        min_area = max(220, int(h * w * 0.006))
        keep = np.zeros((h, w), np.uint8)
        for idx in np.argsort(stats[1:, cv2.CC_STAT_AREA])[::-1] + 1:
            if int(stats[idx, cv2.CC_STAT_AREA]) < min_area:
                continue
            keep[labels == idx] = 255
            if int(keep.sum() / 255) > h * w * 0.10:
                break
        if int(keep.sum()) > 0:
            mask = keep

    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_CLOSE,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)),
        iterations=1,
    )
    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)),
        iterations=1,
    )
    soft_mask = cv2.GaussianBlur(mask.astype(np.float32) / 255.0, (0, 0), 2.2) * face_surface
    facial_hair = _facial_hair_exclusion(
        rgb,
        alpha,
        angle=angle,
        face_surface=face_surface,
        gray=gray,
        sat=sat,
        val=val,
    )
    return np.clip(soft_mask * (1.0 - facial_hair * 0.94), 0.0, 1.0)


def _path_center_viewbox(path: list[list[float]]) -> tuple[float, float]:
    return (
        sum(point[0] for point in path) / max(len(path), 1),
        sum(point[1] for point in path) / max(len(path), 1),
    )


def _path_length_viewbox(path: list[list[float]]) -> float:
    if len(path) < 2:
        return 0.0
    return float(
        sum(
            ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** 0.5
            for a, b in zip(path[:-1], path[1:])
        )
    )


def _upper_face_detected_wrinkle_paths(
    paths: list[list[list[float]]],
    *,
    angle: str,
) -> list[list[list[float]]]:
    """Keep only detected forehead / periocular creases for the baked wrinkle view."""
    kept: list[list[list[float]]] = []
    for path in paths:
        if len(path) < 2:
            continue
        xs = [point[0] for point in path]
        ys = [point[1] for point in path]
        cx, cy = _path_center_viewbox(path)
        length = _path_length_viewbox(path)
        extent = max(max(xs) - min(xs), max(ys) - min(ys))
        if length < 1.15 or extent < 0.75:
            continue
        if cy < 18 or cy > 54:
            continue
        if max(ys) > 60:
            continue
        # Avoid nose / upper-lip texture sneaking into the "upper face" bucket.
        if cy > 50 and 40 <= cx <= 60:
            continue
        if angle.startswith("profile") and cy > 57:
            continue
        kept.append(path)
    return kept[:14]


def _dedupe_wrinkle_paths(
    paths: list[list[list[float]]],
    *,
    min_dist: float = 1.15,
) -> list[list[list[float]]]:
    kept: list[list[list[float]]] = []
    for path in paths:
        if len(path) < 2:
            continue
        cx, cy = _path_center_viewbox(path)
        if any(
            (cx - _path_center_viewbox(other)[0]) ** 2
            + (cy - _path_center_viewbox(other)[1]) ** 2
            < min_dist ** 2
            for other in kept
        ):
            continue
        kept.append(path)
    return kept


def _wrinkle_bake_guides(
    detected_paths: list[list[list[float]]],
    fold_guides: list[list[list[float]]],
    *,
    angle: str,
) -> list[list[list[float]]]:
    upper_detected = _upper_face_detected_wrinkle_paths(detected_paths, angle=angle)
    return _dedupe_wrinkle_paths([*fold_guides, *upper_detected], min_dist=1.05)


def bake_wrinkle_heatmap_image(
    rgb: np.ndarray,
    alpha: np.ndarray | None,
    *,
    angle: str,
    paths: list[list[list[float]]] | None = None,
) -> np.ndarray:
    """Bake a soft wrinkle texture overlay, excluding only eyes, brows, and lips."""
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    response = _wrinkle_crease._crease_response(gray, "any").astype(np.float32)
    h, w = gray.shape

    person = (
        alpha.astype(np.float32) / 255.0
        if alpha is not None
        else np.ones((h, w), np.float32)
    )
    x0, y0, x1, y1 = redness_face_bbox(
        rgb,
        alpha if alpha is not None else np.full((h, w), 255, np.uint8),
        angle,
    )
    fw, fh = max(1, x1 - x0), max(1, y1 - y0)
    yy, xx = np.mgrid[0:h, 0:w]
    nx = (xx - x0) / fw
    ny = (yy - y0) / fh
    if angle == "front":
        half_width = np.interp(
            ny,
            [-0.02, 0.07, 0.22, 0.50, 0.72, 0.90, 1.03],
            [0.22, 0.34, 0.42, 0.46, 0.38, 0.25, 0.10],
        )
        side = 1 - _smoothstep(0.96, 1.08, np.abs(nx - 0.50) / np.maximum(half_width, 0.05))
        vertical = _smoothstep(0.015, 0.075, ny) * (1 - _smoothstep(0.985, 1.060, ny))
        lens_surface = side * vertical
    else:
        center_x = 0.66
        half_width = np.interp(
            ny,
            [-0.02, 0.08, 0.24, 0.52, 0.76, 0.94, 1.04],
            [0.14, 0.25, 0.33, 0.38, 0.31, 0.18, 0.08],
        )
        side = 1 - _smoothstep(0.96, 1.08, np.abs(nx - center_x) / np.maximum(half_width, 0.05))
        vertical = _smoothstep(0.010, 0.075, ny) * (1 - _smoothstep(0.985, 1.060, ny))
        lens_surface = side * vertical
    lens_surface = np.clip(lens_surface * person, 0.0, 1.0).astype(np.float32)

    face_oval = _wrinkle_face_oval_mask(rgb, fallback_bbox=(x0, y0, x1 - x0, y1 - y0))
    if face_oval is None:
        person_u8 = np.clip(person * 255, 0, 255).astype(np.uint8)
        skin_seed = _wrinkle_crease._build_skin_mask(rgb, person_u8)
        skin_seed = ((skin_seed > 0) & (lens_surface > 0.08)).astype(np.uint8) * 255
        close_size = max(11, int(min(h, w) * 0.020))
        if close_size % 2 == 0:
            close_size += 1
        close_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close_size, close_size))
        skin_seed = cv2.morphologyEx(skin_seed, cv2.MORPH_CLOSE, close_kernel, iterations=2)
        contours, _hierarchy = cv2.findContours(skin_seed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        skin_face = np.zeros((h, w), np.uint8)
        if contours:
            largest = max(contours, key=cv2.contourArea)
            if cv2.contourArea(largest) > h * w * 0.006:
                cv2.drawContours(skin_face, [largest], -1, 255, thickness=cv2.FILLED)
        if int(skin_face.sum()) == 0:
            skin_face = skin_seed
        face_oval = cv2.GaussianBlur(
            skin_face.astype(np.float32) / 255.0,
            (0, 0),
            max(1.8, min(h, w) * 0.006),
        )

    face_only = np.minimum(lens_surface, np.clip(face_oval * 1.08, 0.0, 1.0))
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    _hue, sat, val = cv2.split(hsv)
    facial_hair = _facial_hair_exclusion(
        rgb,
        alpha,
        angle=angle,
        face_surface=face_only,
        gray=gray,
        sat=sat,
        val=val,
    )
    feature_exclusion = _wrinkle_feature_exclusion_mask(nx, ny, angle)
    analysis_mask = np.clip(
        face_only * (1.0 - feature_exclusion) * (1.0 - facial_hair * 0.98),
        0.0,
        1.0,
    )

    path_boost = np.zeros((h, w), np.float32)
    boost_stroke = max(14, int(min(h, w) * 0.030))
    path_core = np.zeros((h, w), np.float32)
    core_stroke = max(3, int(min(h, w) * 0.006))
    for path in paths or []:
        xs = [point[0] for point in path]
        ys = [point[1] for point in path]
        extent = max(max(xs) - min(xs), max(ys) - min(ys)) if xs and ys else 0.0
        if _path_length_viewbox(path) < 2.6 or extent < 1.35:
            continue
        pts = np.array(
            [[round(x / 100.0 * w), round(y / 100.0 * h)] for x, y in path],
            dtype=np.int32,
        )
        if len(pts) >= 2:
            cv2.polylines(path_boost, [pts], False, 1.0, boost_stroke, cv2.LINE_AA)
            cv2.polylines(path_core, [pts], False, 1.0, core_stroke, cv2.LINE_AA)
    if path_boost.max() > 0:
        dilate_size = max(7, int(min(h, w) * 0.016))
        if dilate_size % 2 == 0:
            dilate_size += 1
        path_boost = cv2.dilate(
            (path_boost > 0.02).astype(np.uint8),
            cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (dilate_size, dilate_size)),
            iterations=1,
        ).astype(np.float32)
        path_boost = cv2.GaussianBlur(path_boost, (0, 0), max(2.0, boost_stroke * 0.42))
        path_boost = np.clip(path_boost, 0.0, 1.0)
        path_core = cv2.GaussianBlur(path_core, (0, 0), max(0.9, core_stroke * 0.42))
        path_core = np.clip(path_core, 0.0, 1.0)

    valid = analysis_mask > 0.12
    if int(valid.sum()) < 400:
        return np.zeros_like(rgb)

    def normalize_masked(values: np.ndarray, mask: np.ndarray, lo_pct: float, hi_pct: float) -> np.ndarray:
        if int(mask.sum()) < 100:
            return np.zeros_like(values, dtype=np.float32)
        lo = float(np.percentile(values[mask], lo_pct))
        hi = float(np.percentile(values[mask], hi_pct))
        return np.clip((values - lo) / max(hi - lo, 1.0), 0.0, 1.0).astype(np.float32)

    ridge = normalize_masked(response, valid, 18, 99.20)

    smooth = cv2.GaussianBlur(gray, (0, 0), 2.4)
    fine_texture = cv2.absdiff(gray, smooth).astype(np.float32)
    texture = normalize_masked(fine_texture, valid, 42, 99.25)

    ridge_gate = np.clip((ridge - 0.06) / 0.52, 0.0, 1.0)
    soft_texture = cv2.GaussianBlur(texture * analysis_mask, (0, 0), 1.15)
    guide_lift = np.clip(path_boost * 0.20 + path_core * 0.28, 0.0, 0.34) * analysis_mask
    heat = np.clip((ridge ** 0.78) * 1.08 + (soft_texture ** 0.88) * 0.42, 0.0, 1.0)
    heat = np.clip(heat + guide_lift, 0.0, 1.0)
    if path_boost.max() > 0:
        heat = heat * np.clip(analysis_mask * 0.92 + path_boost * analysis_mask * 0.16, 0.0, 1.0)
    else:
        heat = heat * ridge_gate
    heat = np.where(heat > 0.025, heat, 0.0)
    heat = cv2.GaussianBlur(heat * analysis_mask, (0, 0), 0.78)
    heat = np.clip(heat * 1.50, 0.0, 1.0)

    severity = np.clip(heat ** 0.86, 0.0, 1.0)
    visible_signal = _smoothstep(0.42, 0.84, severity)
    heat_rgb = np.array([88.0, 161.0, 147.0], dtype=np.float32)
    base = rgb.astype(np.float32)
    base = base * (1.0 - np.clip(visible_signal * 0.075, 0.0, 0.075)[..., None])
    alpha_map = np.clip((visible_signal ** 0.74) * 0.76, 0.0, 0.76)[..., None]
    out = base * (1.0 - alpha_map) + heat_rgb * alpha_map
    return np.clip(out, 0, 255).astype(np.uint8)


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
    wrinkles_by_angle: dict[str, list[list[list[float]]]] = {}
    wrinkle_guides_by_angle: dict[str, list[list[list[float]]]] = {}
    all_pores: list[dict[str, float]] = []
    for angle in ANGLES:
        rgb = angle_images.get(angle)
        alpha = angle_alphas.get(angle)
        texture = angle_textures.get(angle)
        if rgb is None:
            continue
        alpha_mask = alpha if alpha is not None else np.zeros((rgb.shape[0], rgb.shape[1]), np.uint8)
        ih, iw = rgb.shape[:2]
        bbox = redness_face_bbox(rgb, alpha_mask, angle)
        wrinkle_paths, _wrinkle_source = mediapipe_wrinkle_paths(
            rgb,
            angle,
            iw,
            ih,
            fallback_bbox=bbox,
            alpha=alpha_mask,
        )
        if wrinkle_paths:
            wrinkles_by_angle[angle] = wrinkle_paths
        fold_guides, _fold_source = mediapipe_structural_fold_paths(
            rgb,
            angle,
            iw,
            ih,
            fallback_bbox=bbox,
        )
        bake_guides = _wrinkle_bake_guides(
            wrinkle_paths,
            fold_guides,
            angle=angle,
        )
        if bake_guides:
            wrinkle_guides_by_angle[angle] = bake_guides
        spots = detect_pigment_spots(rgb, alpha_mask, angle=angle)
        if spots:
            dark_spots[angle] = spots
        red = detect_redness_spots(rgb, alpha_mask, angle=angle)
        if red:
            red_spots[angle] = red
        if target_dir is not None and slug is not None and not skip_mask_files:
            # Redness can use full-image skin detection, but pores need the
            # subject matte so profile crops do not use the whole photo bounds.
            red_mask = render_redness_mask(rgb, angle=angle, spots=red)
            if int((red_mask[:, :, 3] > 6).sum()) > 100:
                mask_path = target_dir / f"{slug}-{angle}-redness-mask.png"
                save_rgba_png(red_mask, mask_path)
                red_masks[angle] = f"/demo-3d/{slug}/{mask_path.name}"
            pore_mask = render_pore_mask(rgb, alpha_mask, angle=angle)
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
        "wrinklesByAngle": wrinkles_by_angle,
        "wrinkleGuidesByAngle": wrinkle_guides_by_angle,
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
    turntable_video_path: Path | None,
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
        if angle not in angle_images and turntable_video_path is not None:
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

    report(0.93, "Generating skin maps…")

    def _process_angle_still(angle: str) -> tuple[str, np.ndarray, np.ndarray, dict[str, Any]]:
        rgb = angle_images[angle]
        turntable_sourced = angle not in photo_angles
        cutout_alpha = aggressive_cutout_alpha(rgb, turntable_fast=turntable_sourced)
        detail_alpha = detail_preserving_alpha(rgb, turntable_fast=turntable_sourced)
        rgba = np.dstack([rgb, cutout_alpha])
        texture_rgb = clinical_still_rgb(rgb, "gray", angle=angle, turntable_fast=turntable_sourced)

        color_path = target_dir / f"{slug}-{angle}-color.png"
        rembg_path = target_dir / f"{slug}-{angle}-rembg.png"
        texture_path = target_dir / f"{slug}-{angle}-texture.png"
        texture_cutout_path = target_dir / f"{slug}-{angle}-texture-cutout.png"
        pigment_path = target_dir / f"{slug}-{angle}-pigmentation.png"
        pigment_cutout_path = target_dir / f"{slug}-{angle}-pigmentation-cutout.png"

        save_rgb_png(rgb, color_path)
        save_rgba_png(rgba, rembg_path)
        save_rgb_png(texture_rgb, texture_path)
        save_rgba_png(rgba_from_rgb_alpha(texture_rgb, detail_alpha, fill_holes=False), texture_cutout_path)
        # Static diagnostic photos use the Tanya manual pigment pipeline (MediaPipe
        # skin mask + diffuse/fleck overlay). Turntable video keeps frame-by-frame
        # encode via process_frame.
        pigment_rgb = pigmentation_photo_still_rgb(
            rgb,
            cutout_alpha,
            angle=angle,
            turntable_fast=turntable_sourced,
        )
        save_rgb_png(pigment_rgb, pigment_path)
        save_rgba_png(rgba_from_rgb_alpha(pigment_rgb, cutout_alpha), pigment_cutout_path)

        base = f"/demo-3d/{slug}"
        return angle, cutout_alpha, texture_rgb, {
            "src": f"{base}/{rembg_path.name}",
            "srcCutout": f"{base}/{rembg_path.name}",
            "srcOriginal": f"{base}/{color_path.name}",
            "srcTexture": f"{base}/{texture_cutout_path.name}",
            "srcPigmentation": f"{base}/{pigment_cutout_path.name}",
            "timeRatio": ANGLE_TIME_RATIOS[angle],
            "label": ANGLE_LABELS[angle],
            "fromPhoto": angle in photo_angles,
        }

    angles_to_process = [a for a in ANGLES if a in angle_images]
    with ThreadPoolExecutor(max_workers=max(len(angles_to_process), 1)) as pool:
        for angle, cutout_alpha, texture_rgb, manifest_entry in pool.map(_process_angle_still, angles_to_process):
            angle_alphas[angle] = cutout_alpha
            angle_textures[angle] = texture_rgb
            angles_manifest[angle] = manifest_entry

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

        def _bake_angle_stills(angle: str) -> dict[str, str]:
            rgb = angle_images.get(angle)
            if rgb is None or target_dir is None:
                return {}
            red_mask_path = target_dir / f"{slug}-{angle}-redness-mask.png"
            pore_mask_path = target_dir / f"{slug}-{angle}-pore-mask.png"
            base = f"/demo-3d/{slug}"
            turntable_sourced = angle not in photo_angles
            wrinkle_paths = (
                cv_annotations.get("wrinkleGuidesByAngle", {}).get(angle)
                if isinstance(cv_annotations.get("wrinkleGuidesByAngle"), dict)
                else None
            ) or (
                cv_annotations.get("wrinklesByAngle", {}).get(angle)
                if isinstance(cv_annotations.get("wrinklesByAngle"), dict)
                else []
            )
            baked_w = bake_wrinkle_heatmap_image(
                rgb,
                angle_alphas.get(angle),
                angle=angle,
                paths=wrinkle_paths,
            )
            baked_w_path = target_dir / f"{slug}-{angle}-wrinkles-view.png"
            save_rgba_png(rgba_from_rgb_alpha(baked_w, angle_alphas[angle]), baked_w_path)
            updates: dict[str, str] = {"srcWrinklesView": f"{base}/{baked_w_path.name}"}
            if red_mask_path.exists():
                red_mask = np.array(Image.open(red_mask_path).convert("RGBA"))
                baked_r = bake_redness_image(rgb, red_mask)
                baked_r_path = target_dir / f"{slug}-{angle}-redness-cutout.png"
                save_rgba_png(rgba_from_rgb_alpha(baked_r, angle_alphas[angle]), baked_r_path)
                updates["srcRedness"] = f"{base}/{baked_r_path.name}"
            if pore_mask_path.exists():
                pore_mask = np.array(Image.open(pore_mask_path).convert("RGBA"))
                baked_p = bake_pore_image(rgb, pore_mask)
                baked_p_path = target_dir / f"{slug}-{angle}-pores-cutout.png"
                save_rgba_png(rgba_from_rgb_alpha(baked_p, angle_alphas[angle]), baked_p_path)
                updates["srcPores"] = f"{base}/{baked_p_path.name}"
            return updates

        with ThreadPoolExecutor(max_workers=max(len(angles_to_process), 1)) as pool:
            for angle, updates in zip(angles_to_process, pool.map(_bake_angle_stills, angles_to_process)):
                angles_manifest[angle].update(updates)

    available_view_angles = photo_angles if photo_angles else angles_to_process

    turntable_ref = (
        turntable_video_url
        or (f"/demo-3d/{turntable_video_path.name}" if turntable_video_path is not None else None)
    )
    skip_videos = skip_videos or turntable_video_path is None
    gray_video = target_dir / f"{slug}-turntable-skin-gray.mp4"
    brown_video = target_dir / f"{slug}-turntable-pigmentation.mp4"
    redness_video = target_dir / f"{slug}-turntable-redness.mp4"
    pores_video = target_dir / f"{slug}-turntable-pores.mp4"
    wrinkles_video = target_dir / f"{slug}-turntable-wrinkles.mp4"
    if not skip_videos:
        report(0.975, "Encoding skin map turntables…")
        print(f"[aura] Processing 5 turntable palettes in parallel for {slug}…", flush=True)
        video_tasks = [
            (turntable_video_path, gray_video, "gray"),
            (turntable_video_path, brown_video, "brown"),
            (turntable_video_path, redness_video, "redness"),
            (turntable_video_path, pores_video, "pores"),
            (turntable_video_path, wrinkles_video, "wrinkles"),
        ]
        with ThreadPoolExecutor(max_workers=len(video_tasks)) as pool:
            futures = {
                pool.submit(process_video, src, dst, palette, ping_pong=True): palette
                for src, dst, palette in video_tasks
            }
            for fut in as_completed(futures):
                fut.result()

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
