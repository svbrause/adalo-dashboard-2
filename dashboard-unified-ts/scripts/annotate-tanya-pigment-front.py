#!/usr/bin/env python3
"""
Annotate dark spots (small brown macules) and melasma (soft brown patches) on
tanya-tan-front.png. The original photo is left unchanged; markers are drawn
on a separate RGBA layer and composited.

Usage:
  python3 scripts/annotate-tanya-pigment-front.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public/demo-3d/tanya-tan-front.png"
OUT_PNG = ROOT / "public/demo-3d/tanya-tan-front-pigment-annotated.png"
OUT_OVERLAY = ROOT / "public/demo-3d/tanya-tan-front-pigment-overlay.png"
OUT_JSON = ROOT / "public/demo-3d/tanya-tan-front-pigment-spots.json"

# viewBox 0–100 geometry (matches src/deck/analysisFaceAnnotations.ts)
MELASMA_PATHS = [
    "M 46.19 57.03 L 51.22 57.32 L 49.07 53.76 L 48.19 54.15 L 47.75 56.1 Z",
    "M 39.36 57.28 L 39.94 59.38 L 46.63 59.38 L 47.8 55.52 L 44.53 56.84 L 44.58 55.32 L 41.6 55.22 Z",
    "M 59.81 57.47 L 56.4 54.25 L 53.52 55.08 L 55.22 56.64 L 53.32 57.28 L 53.61 59.38 L 59.08 59.38 Z",
    "M 44.7 47.9 L 49.8 43.6 L 55.1 47.9 L 53.85 60.2 L 49.7 64.35 L 45.85 60.2 Z",
    "M 40.25 64.85 Q 49.5 61.9 59.55 64.8 Q 55.55 69.4 44.3 69.2 Z",
]

# Discrete lentigines / freckles (cx, cy, rx, ry in viewBox units, intensity 0–1)
DARK_SPOTS = [
    # Person's left cheek (image right)
    (63.86, 54.7, 0.95, 0.95, 0.72),
    (64.29, 56.31, 1.0, 1.0, 0.76),
    (62.52, 56.25, 1.05, 1.05, 0.78),
    (60.28, 57.58, 1.05, 1.05, 0.74),
    (61.63, 59.08, 1.1, 1.1, 0.8),
    (62.69, 57.64, 0.95, 0.95, 0.7),
    (59.84, 58.52, 1.0, 1.0, 0.82),
    (59.15, 60.2, 0.9, 0.9, 0.75),
    (58.98, 63.31, 0.75, 0.75, 0.68),
    # Person's right cheek (image left)
    (36.14, 54.7, 0.95, 0.95, 0.72),
    (35.71, 56.31, 1.0, 1.0, 0.76),
    (37.48, 56.25, 1.05, 1.05, 0.78),
    (41.41, 57.55, 0.95, 0.95, 0.7),
    (40.98, 59.55, 1.05, 1.05, 0.74),
    (41.49, 62.08, 1.0, 1.0, 0.8),
    (41.8, 63.15, 0.85, 0.85, 0.72),
    # Forehead lentigines
    (43.5, 34.0, 0.65, 0.6, 0.55),
    (50.2, 32.5, 0.7, 0.65, 0.58),
    (56.8, 34.2, 0.65, 0.6, 0.55),
    # Nose bridge
    (48.8, 43.5, 0.45, 0.45, 0.6),
    (51.2, 44.0, 0.4, 0.4, 0.58),
    # Chin
    (46.2, 66.5, 0.55, 0.5, 0.62),
    (53.8, 66.2, 0.5, 0.48, 0.6),
]

# RGBA — warm brown pigment (what you see on real skin), not blue
MELASMA_FILL = (120, 85, 55, 42)
MELASMA_STROKE = (95, 60, 35, 90)
SPOT_CORE = (75, 45, 25, 200)
SPOT_HALO = (140, 95, 55, 0)


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


def vb_to_px(
    cx: float,
    cy: float,
    bbox: tuple[int, int, int, int],
    size: tuple[int, int],
) -> tuple[float, float]:
    x0, y0, x1, y1 = bbox
    w, h = size
    return (x0 + (cx / 100.0) * (x1 - x0), y0 + (cy / 100.0) * (y1 - y0))


def vb_radius_px(rx: float, ry: float, bbox: tuple[int, int, int, int]) -> tuple[float, float]:
    """Map viewBox radii to pixels (deck uses *4.2 on a face-sized SVG; full-res needs ~0.5×)."""
    x0, y0, x1, y1 = bbox
    fw, fh = x1 - x0, y1 - y0
    scale = 0.52
    return (max(3.0, rx / 100.0 * fw * scale), max(3.0, ry / 100.0 * fh * scale))


def parse_simple_path(d: str, bbox: tuple[int, int, int, int], size: tuple[int, int]) -> list[tuple[float, float]]:
    """Parse M/L/Q path commands into pixel polygons (coarse sampling on quads)."""
    tokens = re.findall(r"([MLQZ])|(-?\d+\.?\d*)", d)
    points: list[tuple[float, float]] = []
    i = 0
    cmd = "M"
    current: tuple[float, float] | None = None

    def read_float() -> float:
        nonlocal i
        while i < len(tokens) and tokens[i][0]:
            i += 1
        val = float(tokens[i][1])
        i += 1
        return val

    while i < len(tokens):
        if tokens[i][0]:
            cmd = tokens[i][0]
            i += 1
            if cmd == "Z":
                break
            continue
        if cmd == "M":
            x, y = read_float(), read_float()
            current = vb_to_px(x, y, bbox, size)
            points.append(current)
            cmd = "L"
        elif cmd == "L":
            x, y = read_float(), read_float()
            current = vb_to_px(x, y, bbox, size)
            points.append(current)
        elif cmd == "Q":
            x1, y1 = read_float(), read_float()
            x2, y2 = read_float(), read_float()
            p0 = current or vb_to_px(x1, y1, bbox, size)
            p1 = vb_to_px(x1, y1, bbox, size)
            p2 = vb_to_px(x2, y2, bbox, size)
            for t in np.linspace(0, 1, 8):
                t = float(t)
                px = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t**2 * p2[0]
                py = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t**2 * p2[1]
                points.append((px, py))
            current = p2
    return points


def draw_spot(draw: ImageDraw.ImageDraw, cx: float, cy: float, rx: float, ry: float, intensity: float) -> None:
    """Soft brown lentigo — darker center, soft falloff (not a solid disk)."""
    layers = max(4, int(max(rx, ry) * 0.8))
    for step in range(layers, 0, -1):
        t = step / layers
        rxi = rx * (0.35 + 0.65 * t)
        ryi = ry * (0.35 + 0.65 * t)
        alpha = int(55 + 145 * intensity * (1 - t * 0.85))
        draw.ellipse(
            (cx - rxi, cy - ryi, cx + rxi, cy + ryi),
            fill=(120, 80, 50, alpha),
        )
    draw.ellipse(
        (cx - rx * 0.35, cy - ry * 0.35, cx + rx * 0.35, cy + ry * 0.35),
        fill=(55, 32, 18, int(180 * intensity)),
    )


def build_overlay(size: tuple[int, int], bbox: tuple[int, int, int, int]) -> Image.Image:
    overlay = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")

    for path_d in MELASMA_PATHS:
        poly = parse_simple_path(path_d, bbox, size)
        if len(poly) >= 3:
            draw.polygon(poly, fill=MELASMA_FILL, outline=MELASMA_STROKE)

    for cx, cy, rx, ry, intensity in DARK_SPOTS:
        px, py = vb_to_px(cx, cy, bbox, size)
        prx, pry = vb_radius_px(rx, ry, bbox)
        draw_spot(draw, px, py, prx, pry, intensity)

    return overlay


def main() -> None:
    base = Image.open(SRC).convert("RGBA")
    w, h = base.size
    alpha = np.array(base.split()[-1])
    bbox = face_bbox_from_alpha(alpha)

    overlay = build_overlay((w, h), bbox)
    composed = Image.alpha_composite(base, overlay)

    composed.save(OUT_PNG, format="PNG", optimize=True)
    overlay.save(OUT_OVERLAY, format="PNG", optimize=True)

    spots_json = [
        {
            "cx": cx,
            "cy": cy,
            "rx": rx,
            "ry": ry,
            "intensity": intensity,
        }
        for cx, cy, rx, ry, intensity in DARK_SPOTS
    ]
    OUT_JSON.write_text(
        json.dumps(
            {
                "source": str(SRC.relative_to(ROOT)),
                "output": str(OUT_PNG.relative_to(ROOT)),
                "overlay": str(OUT_OVERLAY.relative_to(ROOT)),
                "imageSize": {"width": w, "height": h},
                "faceBBox": {"x0": bbox[0], "y0": bbox[1], "x1": bbox[2], "y1": bbox[3]},
                "melasmaPathCount": len(MELASMA_PATHS),
                "spotCount": len(DARK_SPOTS),
                "spots": spots_json,
                "melasmaPaths": MELASMA_PATHS,
            },
            indent=2,
        )
        + "\n",
    )

    print(f"Wrote {OUT_PNG.name} ({len(DARK_SPOTS)} spots, {len(MELASMA_PATHS)} melasma regions)", flush=True)
    print(f"Wrote {OUT_OVERLAY.name} (overlay only)", flush=True)


if __name__ == "__main__":
    main()
