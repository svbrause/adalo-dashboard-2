#!/usr/bin/env python3
"""Align Tanya Tan cutout PNGs to the turntable frame (size + position per angle)."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
IMAGE_DIR = ROOT / "src" / "assets" / "images"
OUT_SIZE = 1024

# target_bbox from generate-aura-cv-assets.py → center + face height on OUT_SIZE canvas
ANGLE_TARGETS = {
    "tan_front": {"tcx": 506, "tcy": 554, "tfh": 408},
    "tan_90_right": {"tcx": 636, "tcy": 546, "tfh": 384},
    "tan_45_right": {"tcx": 630, "tcy": 546, "tfh": 372},
    "tan_45_left": {"tcx": 410, "tcy": 546, "tfh": 396},
    "tan_90_left": {"tcx": 389, "tcy": 539, "tfh": 394},
}


def subject_bounds(rgb: np.ndarray) -> tuple[float, float, float, float, int, int]:
    """Return cx, cy, width, height, x0, y0 from non-black pixels."""
    mask = rgb.sum(axis=2) > 30
    ys, xs = np.where(mask)
    if len(xs) == 0:
        h, w = rgb.shape[:2]
        return w / 2, h / 2, w * 0.6, h * 0.6, 0, 0
    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    w, h = x1 - x0 + 1, y1 - y0 + 1
    return float(xs.mean()), float(ys.mean()), float(w), float(h), x0, y0


def align_plate(source_name: str, out_name: str, target: dict[str, int]) -> None:
    src_path = IMAGE_DIR / source_name
    if not src_path.is_file():
        raise FileNotFoundError(src_path)
    im = Image.open(src_path).convert("RGBA")
    rgb = np.array(im.convert("RGB"))
    cx, cy, bw, bh, _, _ = subject_bounds(rgb)

    scale = target["tfh"] / bh
    new_w = max(1, round(im.width * scale))
    new_h = max(1, round(im.height * scale))
    resized = im.resize((new_w, new_h), Image.Resampling.LANCZOS)

    new_cx = cx * scale
    new_cy = cy * scale
    off_x = round(target["tcx"] - new_cx)
    off_y = round(target["tcy"] - new_cy)

    canvas = Image.new("RGBA", (OUT_SIZE, OUT_SIZE), (0, 0, 0, 255))
    canvas.paste(resized, (off_x, off_y), resized)
    out_path = IMAGE_DIR / out_name
    canvas.save(out_path, format="WEBP", quality=92, method=6)
    print(f"wrote {out_path.name} scale={scale:.3f} offset=({off_x},{off_y})")


def main() -> None:
    align_plate("tan_front.png", "aura-tan-aligned-front.webp", ANGLE_TARGETS["tan_front"])
    align_plate("tan_90_right.png", "aura-tan-aligned-profile-left.webp", ANGLE_TARGETS["tan_90_right"])
    align_plate("tan_45_right.png", "aura-tan-aligned-three-quarter-left.webp", ANGLE_TARGETS["tan_45_right"])
    align_plate("tan_45_left.png", "aura-tan-aligned-three-quarter-right.webp", ANGLE_TARGETS["tan_45_left"])
    align_plate("tan_90_left.png", "aura-tan-aligned-profile-right.webp", ANGLE_TARGETS["tan_90_left"])


if __name__ == "__main__":
    main()
