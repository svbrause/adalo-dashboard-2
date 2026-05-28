#!/usr/bin/env python3
"""
Optional Modal batch runner for pigment benchmark (CPU — same heuristics as compare-pigment-detectors).

  modal run scripts/modal_pigment_sam.py --image-path public/demo-3d/tanya-tan-45-left.png

For SAM / U-Net segmentation, deploy a separate app with a trained checkpoint;
Vision API and SAM auto-masks are poor melasma ground truth on studio portraits.
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

import modal

ROOT = Path(__file__).resolve().parents[1]
app = modal.App("ponce-pigment-benchmark")
image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "opencv-python-headless", "numpy", "Pillow", "mediapipe"
)


@app.function(image=image, timeout=300)
def run_lab_tuned(image_bytes: bytes, cheek: str = "left") -> bytes:
  # Import inside worker
    sys.path.insert(0, "/root")
    # Re-use compare script by exec — simpler: inline minimal pipeline
    import cv2
    import numpy as np
    from PIL import Image

    rgb = np.array(Image.open(io.BytesIO(image_bytes)).convert("RGB"))
    # Fixed ROI fallback only on Modal unless model is baked into image
    h, w = rgb.shape[:2]
    roi = np.zeros((h, w), np.uint8)
    if cheek == "left":
        roi[int(0.34 * h) : int(0.70 * h), int(0.50 * w) : int(0.86 * w)] = 255
    else:
        roi[int(0.34 * h) : int(0.70 * h), int(0.14 * w) : int(0.50 * w)] = 255
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    a = lab[:, :, 1].astype(np.float32)
    skin = roi > 0
    med = float(np.median(a[skin]))
    excess = a - med
    melasma = ((excess > 6) & skin).astype(np.uint8) * 255
    melasma = cv2.GaussianBlur(melasma, (0, 0), 6)
    overlay = np.zeros((h, w, 4), np.uint8)
    overlay[melasma > 40] = (118, 82, 52, 55)
    base = Image.fromarray(rgb).convert("RGBA")
    return Image.alpha_composite(base, Image.fromarray(overlay, "RGBA")).convert("RGB").tobytes()


@app.local_entrypoint()
def main(image_path: str = "public/demo-3d/tanya-tan-45-left.png", cheek: str = "left") -> None:
    src = ROOT / image_path
    out = ROOT / "public/demo-3d/pigment-benchmark" / src.stem / f"{src.stem}__modal_lab_tuned__annotated.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    raw = run_lab_tuned.remote(src.read_bytes(), cheek=cheek)
    out.write_bytes(raw)
    print(f"Wrote {out.relative_to(ROOT)}")
