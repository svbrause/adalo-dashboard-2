#!/usr/bin/env python3
"""Apply an Aura-style pigmentation texture treatment to the turntable video.

This is a demo visual pass, not a diagnostic detector. It keeps the black
background, converts visible skin into a flattened clinical grayscale/brown
texture, and overlays high-frequency pigment flecks frame by frame.
"""

from __future__ import annotations

import argparse
import subprocess
import tempfile
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "src/assets/images/turntable_2048_black.mp4"
DEFAULT_GRAY = ROOT / "src/assets/images/turntable_2048_black_pigmentation_gray.mp4"
DEFAULT_BROWN = ROOT / "src/assets/images/turntable_2048_black_pigmentation_brown.mp4"


def subject_mask(rgb: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    mask = (gray > 7).astype(np.uint8) * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (17, 17)), 2)
    mask = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)), 1)
    return cv2.GaussianBlur(mask, (0, 0), 2)


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
        cheek_roi = np.zeros_like(mask)
        # Conservative cheek band: avoids brow/eyes above, lips/neck below, and
        # the profile nose at either horizontal extreme as the head rotates.
        cv2.rectangle(
            cheek_roi,
            (x0 + int(0.24 * bw), y0 + int(0.39 * bh)),
            (x0 + int(0.72 * bw), y0 + int(0.57 * bh)),
            255,
            -1,
        )
        mask = cv2.bitwise_and(mask, cheek_roi)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)), 1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21)), 1)
    return cv2.GaussianBlur(mask, (0, 0), 2.5)


def clinical_base(rgb: np.ndarray, subject: np.ndarray, palette: str) -> np.ndarray:
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

    alpha = np.clip(subject.astype(np.float32) / 255.0, 0, 1)[:, :, None]
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

    flecks = np.clip((score - 1.2) / 1.75, 0, 1)
    diffuse = np.clip((score - 0.7) / 2.4, 0, 1)
    diffuse = cv2.GaussianBlur(diffuse, (0, 0), 4.5)

    # Keep the signal stippled like the Aura reference rather than blob-like.
    noise = cv2.GaussianBlur(np.random.default_rng(42).random(l.shape).astype(np.float32), (0, 0), 0.8)
    flecks = flecks * (noise > 0.47)

    if palette == "brown":
        diffuse_color = np.array([120, 74, 43], np.float32)
        fleck_color = np.array([74, 42, 26], np.float32)
    else:
        diffuse_color = np.array([222, 132, 102], np.float32)
        fleck_color = np.array([78, 49, 93], np.float32)

    overlay[:] = diffuse_color
    alpha = np.clip(diffuse * 0.16 + flecks * 0.72, 0, 0.78)
    strong = flecks > 0.08
    overlay[strong] = fleck_color
    alpha *= skin.astype(np.float32) / 255.0
    return overlay.astype(np.uint8), alpha


def process_frame(bgr: np.ndarray, palette: str) -> np.ndarray:
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    subj = subject_mask(rgb)
    skin = skin_mask(rgb, subj)
    base = clinical_base(rgb, subj, palette).astype(np.float32)
    overlay, alpha = pigment_overlay(rgb, skin, palette)
    out = base * (1 - alpha[:, :, None]) + overlay.astype(np.float32) * alpha[:, :, None]
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
        writer.write(process_frame(frame, palette))
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
    print(f"Wrote {out.relative_to(ROOT)}", flush=True)


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
