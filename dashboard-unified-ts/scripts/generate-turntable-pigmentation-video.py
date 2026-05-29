#!/usr/bin/env python3
"""Apply an Aura-style pigmentation texture treatment to the turntable video.

This is a demo visual pass, not a diagnostic detector. It keeps the black
background, converts visible skin into a flattened clinical grayscale/brown
texture, and overlays high-frequency pigment flecks frame by frame.
"""

from __future__ import annotations

import argparse
import importlib.util
import subprocess
import tempfile
from pathlib import Path
from typing import Any

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT = ROOT / "src/assets/images/turntable_2048_black.mp4"
DEFAULT_GRAY = ROOT / "src/assets/images/turntable_2048_black_pigmentation_gray.mp4"
DEFAULT_BROWN = ROOT / "src/assets/images/turntable_2048_black_pigmentation_brown.mp4"

LUMINANCE_VISIBLE_THRESH = 10

_cv_assets_mod: Any | None = None
_aura_assets_mod: Any | None = None


def _cv_assets() -> Any:
    global _cv_assets_mod
    if _cv_assets_mod is None:
        spec = importlib.util.spec_from_file_location(
            "aura_cv_assets",
            SCRIPT_DIR / "generate-aura-cv-assets.py",
        )
        if spec is None or spec.loader is None:
            raise ImportError("Cannot load generate-aura-cv-assets.py")
        _cv_assets_mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(_cv_assets_mod)
    return _cv_assets_mod


def _aura_assets() -> Any:
    global _aura_assets_mod
    if _aura_assets_mod is None:
        spec = importlib.util.spec_from_file_location(
            "aura_patient_assets",
            SCRIPT_DIR / "generate_patient_aura_assets.py",
        )
        if spec is None or spec.loader is None:
            raise ImportError("Cannot load generate_patient_aura_assets.py")
        _aura_assets_mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(_aura_assets_mod)
    return _aura_assets_mod


def estimate_bbox(rgb: np.ndarray) -> tuple[int, int, int, int]:
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    ys, xs = np.where(gray > 25)
    h, w = rgb.shape[:2]
    if xs.size == 0:
        return (w // 4, h // 8, w // 2, h // 2)
    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    return (x0, y0, max(1, x1 - x0), max(1, y1 - y0))


def is_flat_studio_backdrop(gray: np.ndarray, person: np.ndarray) -> bool:
    """Detect mid-gray seamless paper/backdrop using uniform corner regions."""
    h, w = gray.shape
    pad_y, pad_x = max(8, h // 12), max(8, w // 12)
    regions = (
        (slice(0, pad_y), slice(0, pad_x)),
        (slice(0, pad_y), slice(-pad_x, None)),
        (slice(-pad_y, None), slice(0, pad_x)),
        (slice(-pad_y, None), slice(-pad_x, None)),
    )
    flat_corners = 0
    for ys, xs in regions:
        patch_person = person[ys, xs]
        patch_gray = gray[ys, xs]
        if float(patch_person.mean()) > 0.15:
            continue
        if 40 < float(patch_gray.mean()) < 220 and float(patch_gray.std()) < 20:
            flat_corners += 1
    return flat_corners >= 2


def person_alpha(rgb: np.ndarray) -> np.ndarray:
    """GrabCut person matte — removes studio backgrounds from intake photos."""
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    alpha_u8 = _cv_assets().segment_person(bgr, estimate_bbox(rgb))
    # Slight expand so profile nose tips stay inside the matte.
    alpha_u8 = cv2.dilate(
        alpha_u8,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)),
        1,
    )
    return alpha_u8.astype(np.float32) / 255.0


def raw_turntable_visible(gray: np.ndarray) -> np.ndarray:
    """Pixels lit in the source turntable plate (same basis as the raw 3D export)."""
    return (gray > LUMINANCE_VISIBLE_THRESH).astype(np.float32)


def neck_fade_visible(visible: np.ndarray) -> np.ndarray:
    """Fade neck/chest below the face; never trim horizontal profile extremes."""
    ys, xs = np.where(visible > 0.5)
    if xs.size == 0:
        return visible
    y0, y1 = int(ys.min()), int(ys.max())
    bh = max(1, y1 - y0)
    neck_y = y0 + int(0.90 * bh)
    out = visible.copy()
    out[neck_y:, :] *= 0.12
    return out


def composite_matte(rgb: np.ndarray, subject: np.ndarray) -> np.ndarray:
    """Alpha matte for gray/brown encode on pure black."""
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    person = person_alpha(rgb)
    raw = neck_fade_visible(raw_turntable_visible(gray))
    subj = np.clip(subject.astype(np.float32) / 255.0, 0, 1)

    if is_flat_studio_backdrop(gray, person):
        # Intake photo on a gray seamless — drop backdrop via GrabCut matte.
        return np.clip(person, 0, 1)

    # Turntable / dark plate: union person + luminance so profile nose never clips.
    return np.clip(np.maximum(np.maximum(person, subj), raw), 0, 1)


def subject_mask(rgb: np.ndarray, *, exclude_neck: bool = True) -> np.ndarray:
    """Soft silhouette for skin detection / neck cleanup (not the final crop boundary)."""
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    mask = (gray > LUMINANCE_VISIBLE_THRESH).astype(np.uint8) * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)), 1)

    if exclude_neck:
        ys, xs = np.where(mask > 24)
        if xs.size > 0:
            y0, y1 = int(ys.min()), int(ys.max())
            bh = max(1, y1 - y0)
            neck_y = y0 + int(0.90 * bh)
            mask[neck_y:, :] = 0

    return cv2.GaussianBlur(mask, (0, 0), 2.0)


def skin_mask(rgb: np.ndarray, subject: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    h, s, v = cv2.split(hsv)
    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)

    skin = (
        (subject > 20)
        & (v > 58)
        & (v < 242)
        & (s > 12)
        & (s < 135)
        & ((h < 28) | (h > 168))
        & (r > b - 8)
        & (g > b - 38)
    )
    mask = skin.astype(np.uint8) * 255
    ys, xs = np.where(subject > 20)
    if xs.size:
        x0, x1 = int(xs.min()), int(xs.max())
        y0, y1 = int(ys.min()), int(ys.max())
        bw = max(1, x1 - x0)
        bh = max(1, y1 - y0)
        pigment_roi = np.zeros_like(mask)
        # Wider face pigment zone — aligned with detect_pigment_spots cheek ROI.
        cv2.rectangle(
            pigment_roi,
            (x0 + int(0.16 * bw), y0 + int(0.28 * bh)),
            (x0 + int(0.84 * bw), y0 + int(0.72 * bh)),
            255,
            -1,
        )
        mask = cv2.bitwise_and(mask, pigment_roi)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)), 1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21)), 1)
    return cv2.GaussianBlur(mask, (0, 0), 2.5)


def clinical_base(rgb: np.ndarray, matte: np.ndarray, palette: str) -> np.ndarray:
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    blur = cv2.GaussianBlur(gray, (0, 0), 34)
    flat = cv2.divide(gray, np.maximum(blur, 1), scale=136)
    flat = cv2.createCLAHE(clipLimit=1.45, tileGridSize=(8, 8)).apply(flat)
    flat = np.clip(flat.astype(np.float32) * 0.72 + gray.astype(np.float32) * 0.28, 0, 255).astype(np.uint8)

    if palette == "brown":
        low = np.array([42, 32, 27], np.float32)
        high = np.array([226, 206, 188], np.float32)
        base = low + (flat[:, :, None].astype(np.float32) / 255.0) * (high - low)
    else:
        base = np.repeat(flat[:, :, None], 3, axis=2).astype(np.float32)

    alpha = matte[:, :, None]
    out = base * alpha
    return out.astype(np.uint8)


def pigment_overlay(rgb: np.ndarray, skin: np.ndarray, palette: str) -> tuple[np.ndarray, np.ndarray]:
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    l = lab[:, :, 0].astype(np.float32)
    a = lab[:, :, 1].astype(np.float32)
    b = lab[:, :, 2].astype(np.float32)
    local_l = cv2.GaussianBlur(l, (0, 0), 21)
    dark = np.maximum(local_l - l, 0)

    valid = skin > 24
    overlay = np.zeros((*l.shape, 3), np.float32)
    alpha = np.zeros(l.shape, np.float32)
    if valid.sum() < 500:
        return overlay.astype(np.uint8), alpha

    med_l = float(np.median(l[valid]))
    grad_x = cv2.Sobel(l, cv2.CV_32F, 1, 0, ksize=3)
    grad_y = cv2.Sobel(l, cv2.CV_32F, 0, 1, ksize=3)
    edge = cv2.magnitude(grad_x, grad_y)
    valid = valid & (l > med_l - 18) & (l < med_l + 72) & (edge < 42)
    valid = cv2.morphologyEx(valid.astype(np.uint8) * 255, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)), 1) > 0
    if valid.sum() < 500:
        return overlay.astype(np.uint8), alpha

    def scaled(x: np.ndarray) -> np.ndarray:
        med = float(np.median(x[valid]))
        p84 = float(np.percentile(x[valid], 84))
        return np.clip((x - med) / max(p84 - med, 1.0), 0, 4)

    score = 0.54 * scaled(dark) + 0.32 * scaled(a) + 0.14 * scaled(b)
    score[~valid] = 0
    score = cv2.GaussianBlur(score, (0, 0), 0.8)

    if palette == "gray":
        fleck_thresh, fleck_scale = 0.75, 1.35
        diffuse_thresh, diffuse_scale = 0.48, 2.0
        noise_cutoff = 0.35
    else:
        fleck_thresh, fleck_scale = 1.2, 1.75
        diffuse_thresh, diffuse_scale = 0.7, 2.4
        noise_cutoff = 0.47

    flecks = np.clip((score - fleck_thresh) / fleck_scale, 0, 1)
    diffuse = np.clip((score - diffuse_thresh) / diffuse_scale, 0, 1)
    diffuse = cv2.GaussianBlur(diffuse, (0, 0), 4.5)

    # Keep the signal stippled like the Aura reference rather than blob-like.
    noise = cv2.GaussianBlur(np.random.default_rng(42).random(l.shape).astype(np.float32), (0, 0), 0.8)
    flecks = flecks * (noise > noise_cutoff)

    if palette == "brown":
        diffuse_color = np.array([120, 74, 43], np.float32)
        fleck_color = np.array([74, 42, 26], np.float32)
        alpha = np.clip(diffuse * 0.16 + flecks * 0.72, 0, 0.78)
    else:
        diffuse_color = np.array([198, 118, 92], np.float32)
        fleck_color = np.array([42, 24, 58], np.float32)
        alpha = np.clip(diffuse * 0.12 + flecks * 0.88, 0, 0.86)

    overlay[:] = diffuse_color
    strong = flecks > 0.08
    overlay[strong] = fleck_color
    alpha *= skin.astype(np.float32) / 255.0
    return overlay.astype(np.uint8), alpha


def bake_cv_spots(
    out: np.ndarray,
    rgb: np.ndarray,
    matte: np.ndarray,
    *,
    angle: str,
    palette: str,
) -> np.ndarray:
    """Stamp detect_pigment_spots ellipses into the gray texture."""
    if palette != "gray":
        return out

    aura = _aura_assets()
    person_u8 = (person_alpha(rgb) * 255).astype(np.uint8)
    spots = aura.detect_pigment_spots(rgb, person_u8, angle=angle, max_spots=36)
    if not spots:
        return out

    h, w = rgb.shape[:2]
    bbox = aura.face_bbox_from_alpha(person_u8)
    x0, y0, x1, y1 = bbox
    fw = max(1, x1 - x0)
    fh = max(1, y1 - y0)
    fleck_color = np.array([42, 24, 58], np.float32)

    spot_alpha = np.zeros((h, w), np.float32)
    for spot in spots:
        cx = x0 + (spot["cx"] / 100.0) * fw
        cy = y0 + (spot["cy"] / 100.0) * fh
        rx = max(2.0, spot["rx"] / 100.0 * fw * 1.35)
        ry = max(2.0, spot["ry"] / 100.0 * fh * 1.35)
        strength = float(0.42 + 0.38 * spot.get("intensity", 0.8))
        cv2.ellipse(
            spot_alpha,
            (int(round(cx)), int(round(cy))),
            (int(round(rx)), int(round(ry))),
            0,
            0,
            360,
            strength,
            -1,
        )

    spot_alpha = cv2.GaussianBlur(spot_alpha, (0, 0), 1.2)
    spot_alpha = np.clip(spot_alpha * matte, 0, 0.82)
    return out * (1 - spot_alpha[:, :, None]) + fleck_color * spot_alpha[:, :, None]


def infer_turntable_angle(index: int, total: int) -> str:
    if total <= 1:
        return "front"
    ratio = index / max(total - 1, 1)
    if ratio >= 0.92:
        return "profile-left"
    if ratio <= 0.08:
        return "profile-right"
    if ratio >= 0.72:
        return "three-quarter-left"
    if ratio <= 0.28:
        return "three-quarter-right"
    return "front"


def process_frame(bgr: np.ndarray, palette: str, *, angle: str = "front") -> np.ndarray:
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    subj = subject_mask(rgb)
    matte = composite_matte(rgb, subj)
    skin = skin_mask(rgb, subj)
    base = clinical_base(rgb, matte, palette).astype(np.float32)
    overlay, alpha = pigment_overlay(rgb, skin, palette)
    out = base * (1 - alpha[:, :, None]) + overlay.astype(np.float32) * alpha[:, :, None]
    out = bake_cv_spots(out, rgb, matte, angle=angle, palette=palette)
    # Composite on pure black; matte follows raw turntable visibility (profile nose intact).
    out = out * matte[:, :, None]
    return cv2.cvtColor(np.clip(out, 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR)


def process_video(src: Path, out: Path, palette: str) -> None:
    cap = cv2.VideoCapture(str(src))
    if not cap.isOpened():
        raise FileNotFoundError(src)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = Path(tempfile.gettempdir()) / f"{out.stem}.mp4v.tmp.mp4"

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(tmp_path), fourcc, fps, (width, height))
    if not writer.isOpened():
        raise RuntimeError(f"Could not open video writer for {tmp_path}")

    index = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        writer.write(process_frame(frame, palette, angle=infer_turntable_angle(index, total)))
        index += 1
        if total and index % 20 == 0:
            print(f"{palette}: {index}/{total} frames", flush=True)

    cap.release()
    writer.release()
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(tmp_path),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-profile:v",
            "high",
            "-level",
            "5.2",
            "-movflags",
            "+faststart",
            str(out),
        ],
        check=True,
    )
    tmp_path.unlink(missing_ok=True)
    print(f"Wrote {out}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--palette", choices=("gray", "brown", "both"), default="gray")
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()

    src = args.input if args.input.is_absolute() else ROOT / args.input
    if args.palette == "both":
        process_video(src, DEFAULT_GRAY, "gray")
        process_video(src, DEFAULT_BROWN, "brown")
    else:
        default_out = DEFAULT_BROWN if args.palette == "brown" else DEFAULT_GRAY
        out = args.output if args.output else default_out
        out = out if out.is_absolute() else ROOT / out
        process_video(src, out, args.palette)


if __name__ == "__main__":
    main()
