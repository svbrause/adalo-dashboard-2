#!/usr/bin/env python3
"""Compare erythema / redness detection strategies on color facial photos.

Methods:
  - lab_local:        current LAB a* local excess heuristic
  - hemoglobin_ei:    erythema index (R-G)/(R+G) on illumination-normalized skin
  - log_rg_retinex:   log(R/G) after large-scale illumination flattening
  - robust_a_star:    robust z-score on LAB a* (shadow-resistant)
  - green_residual:   R minus local-green (melanin/vascular separation heuristic)
  - mp_diffuse_peaks: MediaPipe face ROI + diffuse erythema map + local peak picking

Usage:
  python3 scripts/compare-redness-detectors.py \\
    --image path/to/front.jpg --out public/demo-3d/amie-bailey/redness-compare
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]

# MediaPipe face oval (excludes most hair when combined with erosion)
FACE_OVAL_IDX = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378,
    400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21,
    54, 103, 67, 109,
]
# Eyes + lips + brows to subtract from face oval
EXCLUDE_IDX = [
    61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185,
    78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95,
    70, 63, 105, 66, 107, 55, 65, 52, 53, 46,
]


@dataclass
class RednessResult:
    name: str
    score: np.ndarray  # float32 0+
    spots: list[tuple[int, int, float]]  # cx_px, cy_px, intensity
    note: str = ""


def load_rgb(path: Path) -> np.ndarray:
    bgr = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if bgr is None:
        raise FileNotFoundError(path)
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)


def illumination_norm(rgb: np.ndarray, sigma: float = 48.0) -> np.ndarray:
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    l = lab[:, :, 0].astype(np.float32)
    blur = cv2.GaussianBlur(l, (0, 0), sigma)
    norm_l = np.clip((l / np.maximum(blur, 1.0)) * 128.0, 0, 255).astype(np.uint8)
    out = lab.copy()
    out[:, :, 0] = norm_l
    return cv2.cvtColor(out, cv2.COLOR_LAB2RGB)


def _face_landmarker_model() -> Path:
    cache = ROOT / ".cache" / "face_landmarker.task"
    if not cache.exists():
        cache.parent.mkdir(parents=True, exist_ok=True)
        url = (
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/"
            "face_landmarker/float16/1/face_landmarker.task"
        )
        subprocess.run(["curl", "-fsSL", url, "-o", str(cache)], check=True, timeout=180)
    return cache


def mediapipe_landmarks(rgb: np.ndarray):
    try:
        import mediapipe as mp
        from mediapipe.tasks import python as mp_python
        from mediapipe.tasks.python import vision
    except ImportError:
        return None
    opts = vision.FaceLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=str(_face_landmarker_model())),
        running_mode=vision.RunningMode.IMAGE,
        num_faces=1,
    )
    landmarker = vision.FaceLandmarker.create_from_options(opts)
    mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb))
    res = landmarker.detect(mp_img)
    landmarker.close()
    if not res.face_landmarks:
        return None
    return res.face_landmarks[0]


def mediapipe_face_skin_mask(rgb: np.ndarray, landmarks=None) -> np.ndarray | None:
    h, w = rgb.shape[:2]
    lm = landmarks if landmarks is not None else mediapipe_landmarks(rgb)
    if lm is None:
        return None

    def poly(indices: list[int]) -> np.ndarray:
        pts = np.array([(int(lm[i].x * w), int(lm[i].y * h)) for i in indices if i < len(lm)], np.int32)
        return pts

    face = np.zeros((h, w), np.uint8)
    pts = poly(FACE_OVAL_IDX)
    if len(pts) >= 3:
        cv2.fillConvexPoly(face, cv2.convexHull(pts), 255)

    exclude = np.zeros((h, w), np.uint8)
    ex_pts = poly(EXCLUDE_IDX)
    if len(ex_pts) >= 3:
        cv2.fillConvexPoly(exclude, cv2.convexHull(ex_pts), 255)
        exclude = cv2.dilate(exclude, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (17, 17)), 2)
        face = cv2.bitwise_and(face, cv2.bitwise_not(exclude))

    face = cv2.erode(face, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)), 1)
    return face


def fallback_face_mask(rgb: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    mask = (gray > 30).astype(np.uint8) * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)), 2)
    return mask


def skin_mask_hsv(rgb: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    h, s, v = cv2.split(hsv)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    magenta = (h >= 128) & (h <= 172) & (s > 55)
    skin = (
        (v > 45) & (v < 245) & (s > 8) & (s < 145) & ((h < 25) | (h > 165))
        & (r.astype(np.int16) >= g.astype(np.int16) - 18)
        & ~magenta
    )
    return skin.astype(np.uint8) * 255


def build_roi(rgb: np.ndarray) -> tuple[np.ndarray, str]:
    lm = mediapipe_landmarks(rgb)
    mp_mask = mediapipe_face_skin_mask(rgb, landmarks=lm) if lm else None
    if mp_mask is not None:
        roi = cv2.bitwise_and(mp_mask, skin_mask_hsv(rgb))
        return roi, "mediapipe face mesh + HSV skin"
    roi = cv2.bitwise_and(fallback_face_mask(rgb), skin_mask_hsv(rgb))
    return roi, "fallback silhouette + HSV skin"


def robust_z(x: np.ndarray, valid: np.ndarray) -> np.ndarray:
    med = float(np.median(x[valid]))
    p16, p84 = np.percentile(x[valid], [16, 84])
    return (x - med) / max(float(p84 - p16), 1.0)


def pick_spots(score: np.ndarray, roi: np.ndarray, *, max_spots: int = 40, percentile: float = 78) -> list[tuple[int, int, float]]:
    valid = roi > 0
    if valid.sum() < 400:
        return []
    thresh = float(np.percentile(score[valid], percentile))
    if thresh <= 0.05:
        return []

    peaks = (score >= thresh).astype(np.uint8) * 255
    peaks = cv2.morphologyEx(peaks, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)), 1)
    n, _labels, stats, centroids = cv2.connectedComponentsWithStats(peaks, connectivity=8)
    spots: list[tuple[float, int, int]] = []
    for idx in range(1, n):
        area = stats[idx, cv2.CC_STAT_AREA]
        if area < 5 or area > 3200:
            continue
        cx, cy = int(centroids[idx][0]), int(centroids[idx][1])
        if not valid[cy, cx]:
            continue
        intensity = float(score[cy, cx] / max(thresh, 1e-3))
        spots.append((intensity, cx, cy))
    spots.sort(key=lambda t: t[0], reverse=True)
    return [(cx, cy, min(intensity, 1.0)) for intensity, cx, cy in spots[:max_spots]]


def detect_lab_local(rgb: np.ndarray, roi: np.ndarray) -> RednessResult:
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    l = lab[:, :, 0].astype(np.float32)
    a = lab[:, :, 1].astype(np.float32)
    local_a = cv2.GaussianBlur(a, (0, 0), 16)
    valid = roi > 0
    med_a = float(np.median(a[valid]))
    score = 0.5 * np.maximum(a - local_a, 0) + 0.5 * np.maximum(a - med_a, 0)
    score[~valid] = 0
    score = cv2.GaussianBlur(score, (0, 0), 0.8)
    return RednessResult("lab_local", score, pick_spots(score, roi), "current-style LAB a* excess")


def detect_hemoglobin_ei(rgb: np.ndarray, roi: np.ndarray) -> RednessResult:
    """Erythema index (R-G)/(R+G) — common dermatology camera heuristic."""
    norm = illumination_norm(rgb, 52)
    r = norm[:, :, 0].astype(np.float32)
    g = norm[:, :, 1].astype(np.float32)
    ei = (r - g) / np.maximum(r + g, 1.0)
    valid = roi > 0
    score = robust_z(ei, valid)
    score[~valid] = 0
    score = np.clip(score, 0, 6)
    score = cv2.GaussianBlur(score, (0, 0), 1.0)
    return RednessResult("hemoglobin_ei", score, pick_spots(score, roi, percentile=76), "Visia-style erythema index on flat-lit RGB")


def detect_log_rg_retinex(rgb: np.ndarray, roi: np.ndarray) -> RednessResult:
    norm = illumination_norm(rgb, 55)
    r = norm[:, :, 0].astype(np.float32) + 1.0
    g = norm[:, :, 1].astype(np.float32) + 1.0
    log_rg = np.log(r / g) * 40.0
    valid = roi > 0
    score = np.maximum(log_rg - float(np.median(log_rg[valid])), 0)
    score[~valid] = 0
    score = cv2.GaussianBlur(score, (0, 0), 1.1)
    return RednessResult("log_rg_retinex", score, pick_spots(score, roi, percentile=77), "illumination-normalized log(R/G)")


def detect_robust_a_star(rgb: np.ndarray, roi: np.ndarray) -> RednessResult:
    norm = illumination_norm(rgb, 48)
    a = cv2.cvtColor(norm, cv2.COLOR_RGB2LAB)[:, :, 1].astype(np.float32)
    valid = roi > 0
    score = robust_z(a, valid)
    score = np.clip(score, 0, 5)
    score[~valid] = 0
    local = cv2.GaussianBlur(score, (0, 0), 21)
    score = np.maximum(score - local * 0.35, 0)
    score = cv2.GaussianBlur(score, (0, 0), 0.9)
    return RednessResult("robust_a_star", score, pick_spots(score, roi, percentile=75), "robust z-score on normalized a*")


def detect_green_residual(rgb: np.ndarray, roi: np.ndarray) -> RednessResult:
    """R minus local green — vascular signal heuristic used in some RBX approximations."""
    norm = illumination_norm(rgb, 50)
    r = norm[:, :, 0].astype(np.float32)
    g = norm[:, :, 1].astype(np.float32)
    local_g = cv2.GaussianBlur(g, (0, 0), 28)
    residual = r - local_g
    valid = roi > 0
    score = robust_z(residual, valid)
    score = np.clip(score, 0, 5)
    score[~valid] = 0
    score = cv2.GaussianBlur(score, (0, 0), 1.0)
    return RednessResult("green_residual", score, pick_spots(score, roi, percentile=76), "R − local G (vascular emphasis)")


def detect_mp_diffuse_peaks(rgb: np.ndarray, roi: np.ndarray) -> RednessResult:
    """Diffuse erythema map + local peaks — better for blush vs discrete acne."""
    norm = illumination_norm(rgb, 52)
    r = norm[:, :, 0].astype(np.float32)
    g = norm[:, :, 1].astype(np.float32)
    b = norm[:, :, 2].astype(np.float32)
    ei = (r - g) / np.maximum(r + g, 1.0)
    valid = roi > 0
    diffuse = cv2.GaussianBlur(ei, (0, 0), 22)
    med = float(np.median(diffuse[valid]))
    excess = np.maximum(diffuse - med, 0)
    local = cv2.GaussianBlur(ei, (0, 0), 7)
    peaks = np.maximum(local - cv2.GaussianBlur(ei, (0, 0), 18), 0)
    score = 0.55 * excess + 0.45 * peaks
    score[~valid] = 0
    score = cv2.GaussianBlur(score, (0, 0), 0.8)
    return RednessResult(
        "mp_diffuse_peaks",
        score,
        pick_spots(score, roi, percentile=72, max_spots=48),
        "MediaPipe ROI + diffuse flush + local peaks",
    )


DETECTORS = [
    detect_lab_local,
    detect_hemoglobin_ei,
    detect_log_rg_retinex,
    detect_robust_a_star,
    detect_green_residual,
    detect_mp_diffuse_peaks,
]


def render_overlay(rgb: np.ndarray, result: RednessResult, roi: np.ndarray) -> np.ndarray:
    """Heatmap + spot dots on color photo."""
    out = rgb.astype(np.float32).copy()
    valid = roi > 0
    if valid.sum() < 100:
        return rgb

    score = result.score.copy()
    p70 = float(np.percentile(score[valid], 70))
    p90 = max(float(np.percentile(score[valid], 90)), p70 + 1e-3)
    heat = np.clip((score - p70) / (p90 - p70), 0, 1)
    heat[~valid] = 0
    heat = cv2.GaussianBlur(heat, (0, 0), 3.5)

    red_tint = np.zeros_like(out)
    red_tint[:, :, 0] = 255
    red_tint[:, :, 1] = 40
    red_tint[:, :, 2] = 40
    out = out * (1 - heat[:, :, None] * 0.55) + red_tint * heat[:, :, None] * 0.55

    for cx, cy, intensity in result.spots:
        r = max(5, int(6 + intensity * 4))
        cv2.circle(out, (cx, cy), r + 2, (255, 255, 255), 2, lineType=cv2.LINE_AA)
        cv2.circle(out, (cx, cy), r, (255, 20, 30), -1, lineType=cv2.LINE_AA)

    return np.clip(out, 0, 255).astype(np.uint8)


def make_grid(rgb: np.ndarray, results: list[RednessResult], roi: np.ndarray, roi_note: str) -> np.ndarray:
    tiles = []
    for res in results:
        overlay = render_overlay(rgb, res, roi)
        tile = overlay.copy()
        cv2.putText(tile, res.name, (12, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2, cv2.LINE_AA)
        cv2.putText(tile, f"{len(res.spots)} spots", (12, 54), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (220, 220, 220), 1, cv2.LINE_AA)
        tiles.append(tile)

    h, w = rgb.shape[:2]
    cols = 3
    rows = (len(tiles) + cols - 1) // cols
    canvas = np.zeros((rows * h + 60, cols * w, 3), np.uint8)
    canvas[:] = (32, 32, 32)
    cv2.putText(canvas, f"Redness detector comparison — ROI: {roi_note}", (16, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (230, 230, 230), 2, cv2.LINE_AA)
    for i, tile in enumerate(tiles):
        r, c = divmod(i, cols)
        y0 = 60 + r * h
        canvas[y0 : y0 + h, c * w : (c + 1) * w] = tile
    return canvas


def run(image_path: Path, out_dir: Path) -> None:
    rgb = load_rgb(image_path)
    roi, roi_note = build_roi(rgb)
    results = [fn(rgb, roi) for fn in DETECTORS]
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = image_path.stem

    grid = make_grid(rgb, results, roi, roi_note)
    grid_path = out_dir / f"{stem}-redness-methods-grid.jpg"
    cv2.imwrite(str(grid_path), cv2.cvtColor(grid, cv2.COLOR_RGB2BGR), [int(cv2.IMWRITE_JPEG_QUALITY), 90])

    manifest = {
        "image": str(image_path),
        "roi": roi_note,
        "methods": [
            {"name": r.name, "spotCount": len(r.spots), "note": r.note}
            for r in results
        ],
    }
    (out_dir / f"{stem}-redness-methods.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    for res in results:
        overlay = render_overlay(rgb, res, roi)
        cv2.imwrite(
            str(out_dir / f"{stem}-{res.name}.jpg"),
            cv2.cvtColor(overlay, cv2.COLOR_RGB2BGR),
            [int(cv2.IMWRITE_JPEG_QUALITY), 92],
        )

    print(f"ROI: {roi_note}", flush=True)
    for r in results:
        print(f"  {r.name}: {len(r.spots)} spots — {r.note}", flush=True)
    print(f"grid: {grid_path}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Compare redness detection methods.")
    parser.add_argument("--image", type=Path, required=True)
    parser.add_argument("--out", type=Path, default=ROOT / "public/demo-3d/redness-compare")
    args = parser.parse_args()
    run(args.image, args.out)


if __name__ == "__main__":
    main()
