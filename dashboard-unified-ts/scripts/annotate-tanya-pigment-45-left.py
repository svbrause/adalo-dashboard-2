#!/usr/bin/env python3
"""
Highlight melasma + dark spots on Tanya's left cheek in tanya-tan-45-left.png.
Original photo is preserved; warm-brown overlay is composited on top.

Usage:
  python3 scripts/annotate-tanya-pigment-45-left.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public/demo-3d/tanya-tan-45-left.png"
OUT_PNG = ROOT / "public/demo-3d/tanya-tan-45-left-pigment-annotated.png"
OUT_OVERLAY = ROOT / "public/demo-3d/tanya-tan-45-left-pigment-overlay.png"
OUT_JSON = ROOT / "public/demo-3d/tanya-tan-45-left-pigment-spots.json"

# Person's left cheek (prominent in this ¾ view) — viewBox 0–100 over full frame
MELASMA_PATHS = [
    # Upper cheek / zygoma — mottled patch under outer eye toward temple
    "M 65.5 40.2 Q 70.5 38.8 75.2 42.5 Q 77.5 46.8 74.8 50.5 Q 70.2 52.8 66.8 49.5 Q 64.2 44.8 65.5 40.2 Z",
    # Mid cheek — denser lentigines within melasma field
    "M 66.8 49.8 Q 72.5 48.5 76.2 52.8 Q 75.0 57.5 70.5 58.2 Q 65.5 56.5 64.8 52.5 Q 65.2 50.5 66.8 49.8 Z",
    # Lower cheek — softer feathered extension toward jaw
    "M 65.2 55.5 Q 70.8 54.8 73.8 58.5 Q 72.2 62.5 67.5 63.2 Q 63.5 61.0 63.8 57.2 Q 64.5 56.0 65.2 55.5 Z",
    # Temple tie-in (small)
    "M 74.5 41.5 Q 77.8 42.2 78.8 45.0 Q 77.2 47.2 74.8 46.0 Q 73.5 43.5 74.5 41.5 Z",
]

# (cx, cy, rx, ry, intensity) — curated + photo-guided peaks on left cheek
DARK_SPOTS = [
    (70.1, 39.6, 0.75, 0.72, 0.78),
    (68.5, 36.2, 0.7, 0.68, 0.72),
    (75.8, 41.0, 0.8, 0.75, 0.8),
    (78.2, 43.9, 0.72, 0.7, 0.74),
    (74.1, 48.2, 0.85, 0.82, 0.82),
    (72.0, 46.5, 0.7, 0.68, 0.7),
    (76.5, 50.2, 0.78, 0.75, 0.76),
    (75.3, 53.0, 0.82, 0.8, 0.8),
    (71.5, 54.5, 0.88, 0.85, 0.84),
    (79.4, 52.5, 0.75, 0.72, 0.72),
    (71.3, 58.7, 0.85, 0.82, 0.8),
    (75.6, 57.1, 0.8, 0.78, 0.78),
    (69.2, 51.8, 0.72, 0.7, 0.74),
    (67.8, 56.2, 0.7, 0.68, 0.7),
    (73.2, 60.5, 0.68, 0.65, 0.68),
    (66.5, 59.8, 0.65, 0.62, 0.65),
]

MELASMA_FILL = (118, 82, 52, 52)
MELASMA_STROKE = (92, 58, 34, 95)


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


def vb_to_px(cx: float, cy: float, bbox: tuple[int, int, int, int], size: tuple[int, int]) -> tuple[float, float]:
    x0, y0, x1, y1 = bbox
    return (x0 + (cx / 100.0) * (x1 - x0), y0 + (cy / 100.0) * (y1 - y0))


def vb_radius_px(rx: float, ry: float, bbox: tuple[int, int, int, int]) -> tuple[float, float]:
    x0, y0, x1, y1 = bbox
    fw, fh = x1 - x0, y1 - y0
    scale = 0.52
    return (max(3.0, rx / 100.0 * fw * scale), max(3.0, ry / 100.0 * fh * scale))


def parse_simple_path(d: str, bbox: tuple[int, int, int, int], size: tuple[int, int]) -> list[tuple[float, float]]:
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
            for t in np.linspace(0, 1, 10):
                t = float(t)
                px = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t**2 * p2[0]
                py = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t**2 * p2[1]
                points.append((px, py))
            current = p2
    return points


def draw_spot(draw: ImageDraw.ImageDraw, cx: float, cy: float, rx: float, ry: float, intensity: float) -> None:
    layers = max(4, int(max(rx, ry) * 0.8))
    for step in range(layers, 0, -1):
        t = step / layers
        rxi = rx * (0.35 + 0.65 * t)
        ryi = ry * (0.35 + 0.65 * t)
        alpha = int(65 + 155 * intensity * (1 - t * 0.85))
        draw.ellipse((cx - rxi, cy - ryi, cx + rxi, cy + ryi), fill=(118, 78, 48, alpha))
    draw.ellipse(
        (cx - rx * 0.35, cy - ry * 0.35, cx + rx * 0.35, cy + ry * 0.35),
        fill=(52, 30, 16, int(200 * intensity)),
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
    OUT_JSON.write_text(
        json.dumps(
            {
                "source": str(SRC.relative_to(ROOT)),
                "output": str(OUT_PNG.relative_to(ROOT)),
                "overlay": str(OUT_OVERLAY.relative_to(ROOT)),
                "imageSize": {"width": w, "height": h},
                "faceBBox": {"x0": bbox[0], "y0": bbox[1], "x1": bbox[2], "y1": bbox[3]},
                "angle": "45-left",
                "cheek": "person-left",
                "melasmaPathCount": len(MELASMA_PATHS),
                "spotCount": len(DARK_SPOTS),
                "spots": [
                    {"cx": cx, "cy": cy, "rx": rx, "ry": ry, "intensity": intensity}
                    for cx, cy, rx, ry, intensity in DARK_SPOTS
                ],
                "melasmaPaths": MELASMA_PATHS,
            },
            indent=2,
        )
        + "\n",
    )
    print(
        f"Wrote {OUT_PNG.name} ({len(DARK_SPOTS)} spots, {len(MELASMA_PATHS)} melasma regions)",
        flush=True,
    )
    print(f"Wrote {OUT_OVERLAY.name}", flush=True)


if __name__ == "__main__":
    main()
