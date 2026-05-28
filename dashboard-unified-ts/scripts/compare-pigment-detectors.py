#!/usr/bin/env python3
"""
Run multiple pigment-detection strategies on one portrait and save overlays for comparison.

  python3 scripts/compare-pigment-detectors.py \\
    --image public/demo-3d/tanya-tan-45-left.png --cheek left

  python3 scripts/compare-pigment-detectors.py --image ... --cheek left --gcloud
"""

from __future__ import annotations

import argparse
import base64
import json
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]

# MediaPipe Face Mesh — left cheek hull (person's left)
LEFT_CHEEK_IDX = [
    234, 227, 137, 177, 215, 138, 135, 169, 170, 140, 171, 175, 396, 369, 395, 394, 364, 365, 379, 378, 400, 377,
]
RIGHT_CHEEK_IDX = [
    454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234,
]
# Nose + mouth — subtract from cheek ROI to avoid lip/nostril false positives
NOSE_MOUTH_IDX = [
    1, 2, 4, 5, 6, 19, 20, 94, 95, 96, 97, 98, 99, 100, 101, 102, 164, 165, 167, 168, 197, 326, 327, 328,
    13, 14, 15, 16, 17, 18, 61, 84, 87, 178, 402, 403, 404, 405,
]


@dataclass
class DetectionResult:
    name: str
    melasma_mask: np.ndarray  # uint8 0-255 diffuse
    spot_mask: np.ndarray  # uint8 0-255 compact
    note: str = ""


def load_rgb(path: Path) -> np.ndarray:
    bgr = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if bgr is None:
        raise FileNotFoundError(path)
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)


def skin_mask_hsv(rgb: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    h, s, v = cv2.split(hsv)
    skin = (
        (v > 50)
        & (v < 235)
        & (s > 12)
        & (s < 160)
        & ((h < 28) | (h > 165))
    ).astype(np.uint8) * 255
    skin = cv2.medianBlur(skin, 5)
    return skin


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
        print(f"Downloading MediaPipe model → {cache}", flush=True)
        try:
            subprocess.run(["curl", "-fsSL", url, "-o", str(cache)], check=True, timeout=180)
        except (subprocess.CalledProcessError, OSError):
            raise FileNotFoundError(
                f"Could not download {cache.name}. Run:\n  curl -fsSL '{url}' -o '{cache}'"
            )
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


def mediapipe_cheek_mask(rgb: np.ndarray, cheek: str, landmarks=None) -> np.ndarray | None:
    h, w = rgb.shape[:2]
    lm = landmarks if landmarks is not None else mediapipe_landmarks(rgb)
    if lm is None:
        return None
    idx = LEFT_CHEEK_IDX if cheek == "left" else RIGHT_CHEEK_IDX
    pts = np.array([(int(lm[i].x * w), int(lm[i].y * h)) for i in idx if i < len(lm)], np.int32)
    mask = np.zeros((h, w), np.uint8)
    if len(pts) >= 3:
        cv2.fillConvexPoly(mask, cv2.convexHull(pts), 255)
    mask = cv2.erode(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)), 1)
    mask = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25)), 2)
    # Exclude nose / mouth
    exclude = np.zeros((h, w), np.uint8)
    ex_pts = np.array([(int(lm[i].x * w), int(lm[i].y * h)) for i in NOSE_MOUTH_IDX if i < len(lm)], np.int32)
    if len(ex_pts) >= 3:
        cv2.fillConvexPoly(exclude, cv2.convexHull(ex_pts), 255)
        exclude = cv2.dilate(exclude, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21)), 2)
        mask = cv2.bitwise_and(mask, cv2.bitwise_not(exclude))
    return mask


def fixed_cheek_roi(shape: tuple[int, int], cheek: str) -> np.ndarray:
    """Fallback ROI for 45° left file (person's left cheek ≈ right side of frame)."""
    h, w = shape
    mask = np.zeros((h, w), np.uint8)
    if cheek == "left":
        mask[int(0.34 * h) : int(0.70 * h), int(0.50 * w) : int(0.86 * w)] = 255
    else:
        mask[int(0.34 * h) : int(0.70 * h), int(0.14 * w) : int(0.50 * w)] = 255
    return mask


def gcloud_face_bbox(path: Path) -> tuple[int, int, int, int] | None:
    """Face bounding box via gcloud ml vision detect-faces (uploads image)."""
    small = ROOT / ".cache" / "vision-upload.jpg"
    small.parent.mkdir(parents=True, exist_ok=True)
    img = Image.open(path).convert("RGB")
    img.thumbnail((1280, 1280))
    img.save(small, "JPEG", quality=88)
    try:
        out = subprocess.run(
            ["gcloud", "ml", "vision", "detect-faces", str(small), "--max-results=1", "--format=json"],
            capture_output=True,
            text=True,
            timeout=120,
            check=True,
        )
        data = json.loads(out.stdout)
        faces = data.get("responses", [{}])[0].get("faceAnnotations", [])
        if not faces:
            return None
        poly = faces[0]["boundingPoly"]["vertices"]
        xs = [int(v.get("x", 0)) for v in poly]
        ys = [int(v.get("y", 0)) for v in poly]
        ow, oh = Image.open(path).size
        scale_x = ow / img.size[0]
        scale_y = oh / img.size[1]
        x0, x1 = int(min(xs) * scale_x), int(max(xs) * scale_x)
        y0, y1 = int(min(ys) * scale_y), int(max(ys) * scale_y)
        return x0, y0, x1, y1
    except (subprocess.TimeoutExpired, subprocess.CalledProcessError, json.JSONDecodeError, OSError) as e:
        return None


def cheek_mask_from_gcloud(rgb: np.ndarray, path: Path, cheek: str) -> np.ndarray | None:
    bb = gcloud_face_bbox(path)
    if bb is None:
        return None
    h, w = rgb.shape[:2]
    x0, y0, x1, y1 = bb
    fw, fh = x1 - x0, y1 - y0
    mask = np.zeros((h, w), np.uint8)
    if cheek == "left":
        mask[y0 + int(0.28 * fh) : y0 + int(0.72 * fh), x0 + int(0.48 * fw) : x0 + int(0.95 * fw)] = 255
    else:
        mask[y0 + int(0.28 * fh) : y0 + int(0.72 * fh), x0 + int(0.05 * fw) : x0 + int(0.52 * fw)] = 255
    return cv2.bitwise_and(mask, skin_mask_hsv(rgb))


def detect_lab_relative(rgb: np.ndarray, roi: np.ndarray) -> DetectionResult:
    """LAB a* excess vs cheek median — classic dermatology-ish heuristic."""
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    a = lab[:, :, 1].astype(np.float32)
    skin = roi > 0
    if skin.sum() < 100:
        return DetectionResult("lab_relative", roi * 0, roi * 0, "empty roi")
    med = float(np.median(a[skin]))
    # Melanin: higher a* in OpenCV LAB (0-255)
    excess = a - med
    melasma = ((excess > 4) & skin).astype(np.uint8) * 255
    melasma = cv2.morphologyEx(melasma, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (17, 17)), 2)
    melasma = cv2.GaussianBlur(melasma, (0, 0), 8)

    clahe = cv2.createCLAHE(2.0, (8, 8)).apply(lab[:, :, 0])
    local = cv2.GaussianBlur(clahe.astype(np.float32), (0, 0), 35)
    spot_raw = ((local - clahe) > 6) & (excess > 2) & skin
    spot = spot_raw.astype(np.uint8) * 255
    spot = cv2.morphologyEx(spot, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)), 1)
    return DetectionResult("lab_relative", melasma, spot)


def detect_retinex_log(rgb: np.ndarray, roi: np.ndarray) -> DetectionResult:
    """Illumination-normalized L + log(R/G) on skin."""
    norm = illumination_norm(rgb, 55)
    lab = cv2.cvtColor(norm, cv2.COLOR_RGB2LAB)
    l = lab[:, :, 0].astype(np.float32)
    r = norm[:, :, 0].astype(np.float32) + 1
    g = norm[:, :, 1].astype(np.float32) + 1
    log_rg = np.log(r / g) * 40.0
    skin = roi > 0
    if skin.sum() < 100:
        return DetectionResult("retinex_log", roi * 0, roi * 0)
    med_l = float(np.median(l[skin]))
    dark_l = ((med_l - l) > 8) & skin
    melasma = dark_l.astype(np.uint8) * 255
    melasma = cv2.morphologyEx(melasma, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21)), 2)
    melasma = cv2.GaussianBlur(melasma, (0, 0), 10)

    med_log = float(np.median(log_rg[skin]))
    spots = ((log_rg - med_log) > 3.5) & ((med_l - l) > 4) & skin
    spot = spots.astype(np.uint8) * 255
    spot = cv2.morphologyEx(spot, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (4, 4)), 1)
    return DetectionResult("retinex_log", melasma, spot)


def detect_clahe_blackhat(rgb: np.ndarray, roi: np.ndarray) -> DetectionResult:
    """Wrinkle-style black-hat but tuned for round macules (from generate-aura-cv-assets)."""
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(8, 8)).apply(gray)
    bh = cv2.morphologyEx(clahe, cv2.MORPH_BLACKHAT, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (19, 19)))
    skin = roi > 0
    if skin.sum() < 100:
        return DetectionResult("clahe_blackhat", roi * 0, roi * 0)
    thr = float(np.percentile(bh[skin], 92))
    spot = ((bh > thr) & skin).astype(np.uint8) * 255
    spot = cv2.morphologyEx(spot, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)), 1)

    # Diffuse: lower percentile, larger blur
    thr2 = float(np.percentile(bh[skin], 82))
    melasma = ((bh > thr2) & skin).astype(np.uint8) * 255
    melasma = cv2.morphologyEx(melasma, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25)), 2)
    melasma = cv2.GaussianBlur(melasma, (0, 0), 12)
    return DetectionResult("clahe_blackhat", melasma, spot)


def detect_baseline_lum(rgb: np.ndarray, roi: np.ndarray) -> DetectionResult:
    """What failed before: raw luminance vs local mean (shadow-sensitive)."""
    lum = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    blur = cv2.GaussianBlur(lum, (0, 0), 35)
    dark = (blur - lum) > 10
    skin = roi > 0
    both = (dark & skin).astype(np.uint8) * 255
    return DetectionResult("baseline_luminance", both, both, "shadow-prone — expect false positives")


def composite_overlay(rgb: np.ndarray, res: DetectionResult) -> tuple[np.ndarray, np.ndarray]:
    """Brown clinical overlay; returns (annotated_rgb, overlay_rgba)."""
    h, w = rgb.shape[:2]
    overlay = np.zeros((h, w, 4), np.uint8)
    # Melasma — soft brown
    m = res.melasma_mask > 40
    overlay[m] = (118, 82, 52, 55)
    # Spots — stronger
    s = res.spot_mask > 60
    overlay[s] = (75, 48, 28, 140)
    # Spot edges on top
    spot_only = np.clip(res.spot_mask.astype(np.int16) - res.melasma_mask.astype(np.int16) // 2, 0, 255).astype(np.uint8)
    s2 = spot_only > 50
    overlay[s2] = (55, 32, 18, 180)

    base = Image.fromarray(rgb).convert("RGBA")
    ov = Image.fromarray(overlay, "RGBA")
    out = Image.alpha_composite(base, ov)
    return np.array(out.convert("RGB")), overlay


def run_all(
    image_path: Path,
    cheek: str,
    use_gcloud: bool,
    out_dir: Path,
) -> list[DetectionResult]:
    rgb = load_rgb(image_path)
    lm = mediapipe_landmarks(rgb)
    roi_mp = mediapipe_cheek_mask(rgb, cheek, landmarks=lm) if lm else None
    roi = roi_mp if roi_mp is not None else fixed_cheek_roi(rgb.shape[:2], cheek)
    roi = cv2.bitwise_and(roi, skin_mask_hsv(rgb))
    note_roi = "mediapipe cheek" if roi_mp is not None else "fixed ROI"

    def lab_tuned(r, ro):
        out = detect_lab_relative(r, ro)
        out.name = "lab_relative_tuned"
        out.note = "stricter thresholds + nose/mouth excluded from ROI"
        # Stricter: fewer lip/nose FPs
        lab = cv2.cvtColor(r, cv2.COLOR_RGB2LAB)
        a = lab[:, :, 1].astype(np.float32)
        skin = ro > 0
        med = float(np.median(a[skin]))
        excess = a - med
        melasma = ((excess > 6) & skin).astype(np.uint8) * 255
        melasma = cv2.morphologyEx(melasma, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)), 1)
        melasma = cv2.GaussianBlur(melasma, (0, 0), 6)
        clahe = cv2.createCLAHE(2.0, (8, 8)).apply(lab[:, :, 0])
        local = cv2.GaussianBlur(clahe.astype(np.float32), (0, 0), 28)
        spot = ((local - clahe) > 8) & (excess > 4) & skin
        spot = spot.astype(np.uint8) * 255
        spot = cv2.morphologyEx(spot, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (4, 4)), 1)
        out.melasma_mask = melasma
        out.spot_mask = spot
        return out

    detectors: list[Callable[[np.ndarray, np.ndarray], DetectionResult]] = [
        detect_baseline_lum,
        detect_lab_relative,
        lab_tuned,
        detect_retinex_log,
        detect_clahe_blackhat,
    ]

    results: list[DetectionResult] = []
    for fn in detectors:
        r = fn(rgb, roi)
        r.note = f"{r.note}; roi={note_roi}".strip("; ")
        results.append(r)

    if use_gcloud:
        roi_g = cheek_mask_from_gcloud(rgb, image_path, cheek)
        if roi_g is not None:
            r = detect_lab_relative(rgb, roi_g)
            r.name = "gcloud_roi_lab"
            r.note = "Vision API face box + lab_relative"
            results.append(r)
        else:
            results.append(
                DetectionResult("gcloud_roi_lab", roi * 0, roi * 0, "gcloud face detect failed or timed out"),
            )

    out_dir.mkdir(parents=True, exist_ok=True)
    stem = image_path.stem
    summary = []
    for r in results:
        ann, ov = composite_overlay(rgb, r)
        Image.fromarray(ann).save(out_dir / f"{stem}__{r.name}__annotated.png", optimize=True)
        Image.fromarray(ov).save(out_dir / f"{stem}__{r.name}__mask.png")
        px_m = int((r.melasma_mask > 40).sum())
        px_s = int((r.spot_mask > 60).sum())
        summary.append({"method": r.name, "melasma_px": px_m, "spot_px": px_s, "note": r.note})
        print(f"  {r.name}: melasma={px_m:,} spot={px_s:,} px  ({r.note})", flush=True)

    (out_dir / f"{stem}__summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    # ROI debug
    dbg = rgb.copy()
    dbg[roi > 0] = (dbg[roi > 0] * 0.6 + np.array([80, 200, 120]) * 0.4).astype(np.uint8)
    Image.fromarray(dbg).save(out_dir / f"{stem}__cheek_roi_debug.png")
    return results


def main() -> None:
    ap = argparse.ArgumentParser(description="Compare pigment detectors on one portrait")
    ap.add_argument("--image", type=Path, required=True, help="Input PNG/JPG")
    ap.add_argument("--cheek", choices=("left", "right"), default="left", help="Person's cheek to analyze")
    ap.add_argument("--gcloud", action="store_true", help="Also run GCloud Vision face ROI + LAB")
    ap.add_argument(
        "--out-dir",
        type=Path,
        default=None,
        help="Output folder (default: public/demo-3d/pigment-benchmark/<stem>)",
    )
    args = ap.parse_args()
    image_path = args.image if args.image.is_absolute() else ROOT / args.image
    out_dir = args.out_dir or (ROOT / "public/demo-3d/pigment-benchmark" / image_path.stem)

    print(f"Image: {image_path}", flush=True)
    print(f"Cheek: person-{args.cheek}", flush=True)
    print(f"Output: {out_dir}", flush=True)
    run_all(image_path, args.cheek, args.gcloud, out_dir)
    print(f"\nDone. Open {out_dir} to compare methods.", flush=True)


if __name__ == "__main__":
    main()
