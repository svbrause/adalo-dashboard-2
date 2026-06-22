#!/usr/bin/env python3
"""Render blackhat wrinkle crease response as a MAGMA heatmap PNG."""

from __future__ import annotations

import argparse
import importlib.util
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SCRIPT_DIR = Path(__file__).resolve().parent


def _load(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPT_DIR / filename)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def render_crease_heatmap(
    img_path: Path,
    out_path: Path,
    *,
    skin_only: bool = True,
) -> None:
    wrinkle_mod = _load("wrinkle_crease_detect", "wrinkle_crease_detect.py")
    cutout_mod = _load("wrinkle_cutout_render", "wrinkle_cutout_render.py")

    rgb = np.array(Image.open(img_path).convert("RGB"))
    person = cutout_mod.studio_backdrop_mask(rgb)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    response = wrinkle_mod._crease_response(gray, "any")

    if skin_only:
        skin = wrinkle_mod._build_skin_mask(rgb, person)
        mask = (skin > 40).astype(np.float32)
    else:
        mask = (person > 40).astype(np.float32)

    resp_masked = (response.astype(np.float32) * mask).astype(np.uint8)
    heat = cv2.applyColorMap(resp_masked, cv2.COLORMAP_MAGMA)
    heat_rgb = cv2.cvtColor(heat, cv2.COLOR_BGR2RGB)
    alpha = (person.astype(np.float32) / 255.0)[..., None]
    heat_rgb = (heat_rgb * alpha).astype(np.uint8)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(heat_rgb).save(out_path)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate wrinkle crease heatmap PNG.")
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument(
        "--full-person",
        action="store_true",
        help="Include hair/clothing (person mask) instead of skin-tone mask only",
    )
    args = parser.parse_args()
    render_crease_heatmap(args.input, args.output, skin_only=not args.full_person)
    print(f"Wrote -> {args.output.resolve()}")


if __name__ == "__main__":
    main()
