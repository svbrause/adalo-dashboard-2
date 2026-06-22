#!/usr/bin/env python3
"""CV wrinkle annotation for periocular reference crops.

Uses blackhat crease detection (wrinkle_crease_detect.detect_wrinkle_creases_periocular_cv)
— no hand-drawn paths. Eye-local ROIs come from Haar cascade + fan mask toward temple.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import shutil
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_IMG = ROOT / "public" / "demo-3d" / "crows-feet-reference.png"
DEFAULT_OUT = ROOT / "public" / "demo-3d" / "crows-feet-annotation"


def _load(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPT_DIR / filename)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def polyline_to_svg_path(points: list[list[float]]) -> str:
    if len(points) < 2:
        return ""
    x0, y0 = points[0]
    d = f"M {x0} {y0}"
    for x, y in points[1:]:
        d += f" L {x} {y}"
    return d


def annotate_periocular(
    img_path: Path,
    out_dir: Path,
    *,
    copy_source: bool = True,
    stem: str | None = None,
) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    crease_mod = _load("crease", "wrinkle_crease_detect.py")
    cutout_mod = _load("cutout", "wrinkle_cutout_render.py")

    img_path = img_path.resolve()
    if copy_source:
        stored = out_dir / img_path.name
        if img_path.resolve() != stored.resolve():
            shutil.copy2(img_path, stored)
        source_ref = stored.resolve().relative_to(ROOT.resolve())
    else:
        source_ref = (
            img_path.resolve().relative_to(ROOT.resolve())
            if img_path.resolve().is_relative_to(ROOT.resolve())
            else img_path
        )

    stem = stem or out_dir.name
    rgb = np.array(Image.open(img_path).convert("RGB"))
    ih, iw = rgb.shape[:2]
    alpha = cutout_mod.studio_backdrop_mask(rgb)

    paths, meta = crease_mod.detect_wrinkle_creases_periocular_cv(rgb, alpha, iw, ih)
    print(f"Detected {len(paths)} paths ({meta.get('wrinklePathSource')}, roi={meta.get('roiSource')})")

    wrinkle_rgba = cutout_mod.render_wrinkle_cutout_rgba(ih, iw, paths, alpha)
    base = rgb.astype(np.float32)
    ov = wrinkle_rgba.astype(np.float32)
    a = ov[:, :, 3:4] / 255.0
    baked = np.clip(base * (1 - a) + ov[:, :, :3] * a, 0, 255).astype(np.uint8)

    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    response = crease_mod._crease_response(gray, "any")
    heat = cv2.applyColorMap(response, cv2.COLORMAP_MAGMA)
    heat_rgb = cv2.cvtColor(heat, cv2.COLOR_BGR2RGB)
    Image.fromarray(heat_rgb).save(out_dir / f"{stem}-crease-heatmap.png")

    svg_paths = [polyline_to_svg_path(p) for p in paths]
    payload = {
        "label": "CV-detected wrinkle creases (periocular crop)",
        "imageSize": [iw, ih],
        "image": str(source_ref),
        **meta,
        "wrinkles": paths,
        "wrinklesSvg": svg_paths,
    }

    with open(out_dir / f"{stem}-paths.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    Image.fromarray(wrinkle_rgba, "RGBA").save(out_dir / f"{stem}-lines-cutout.png")
    Image.fromarray(baked).save(out_dir / f"{stem}-lines-baked.png")

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">
  <g fill="none" stroke="#4a5e78" stroke-width="0.35" stroke-linecap="round" stroke-linejoin="round" opacity="0.92">
    {chr(10).join(f'    <path d="{d}"/>' for d in svg_paths if d)}
  </g>
</svg>
"""
    (out_dir / f"{stem}-overlay.svg").write_text(svg, encoding="utf-8")
    print(f"Wrote -> {out_dir}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Annotate periocular wrinkle creases with CV.")
    parser.add_argument("--input", type=Path, default=DEFAULT_IMG, help="Source RGB image")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUT, help="Output directory")
    parser.add_argument("--stem", type=str, default=None, help="Output filename stem")
    parser.add_argument("--no-copy", action="store_true", help="Do not copy source image into output dir")
    args = parser.parse_args()
    annotate_periocular(
        args.input,
        args.output_dir,
        copy_source=not args.no_copy,
        stem=args.stem,
    )


if __name__ == "__main__":
    main()
