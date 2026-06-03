#!/usr/bin/env python3
"""Bake per-angle transparent wrinkle line cutouts + path JSON for Aura patients."""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SCRIPT_DIR = Path(__file__).resolve().parent
PUBLIC_3D = ROOT / "public" / "demo-3d"


def _load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load module from {path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_mp_wr = _load_module("mediapipe_wrinkle_paths", SCRIPT_DIR / "mediapipe_wrinkle_paths.py")
_cutout = _load_module("wrinkle_cutout_render", SCRIPT_DIR / "wrinkle_cutout_render.py")
_patient = _load_module("patient_aura", SCRIPT_DIR / "generate_patient_aura_assets.py")

mediapipe_wrinkle_paths = _mp_wr.mediapipe_wrinkle_paths
render_wrinkle_cutout_rgba = _cutout.render_wrinkle_cutout_rgba
composite_wrinkle_view_rgb = _cutout.composite_wrinkle_view_rgb
redness_face_bbox = _patient.redness_face_bbox



def load_rgb_rgba(color_path: Path, rembg_path: Path) -> tuple[np.ndarray, np.ndarray]:
    rgb = np.array(Image.open(color_path).convert("RGB"))
    if rembg_path.exists():
        rgba = np.array(Image.open(rembg_path).convert("RGBA"))
        alpha = rgba[:, :, 3]
    else:
        alpha = np.full(rgb.shape[:2], 255, np.uint8)
    return rgb, alpha


def process_angle(angle: str, color_path: Path, rembg_path: Path, out_dir: Path, slug: str) -> dict[str, Any]:
    rgb, alpha = load_rgb_rgba(color_path, rembg_path)
    ih, iw = rgb.shape[:2]
    bbox = redness_face_bbox(rgb, alpha, angle)
    paths, source = mediapipe_wrinkle_paths(
        rgb, angle, iw, ih, fallback_bbox=bbox, alpha=alpha
    )
    wrinkle_rgba = render_wrinkle_cutout_rgba(ih, iw, paths, alpha)
    base = f"/demo-3d/{slug}"
    wrinkle_name = f"{slug}-{angle}-wrinkles.webp"
    wrinkle_path = out_dir / wrinkle_name
    Image.fromarray(wrinkle_rgba, "RGBA").save(wrinkle_path, "WEBP", quality=92, method=6)

    view_name = f"{slug}-{angle}-wrinkles-view.webp"
    view_path = out_dir / view_name
    view_rgb = composite_wrinkle_view_rgb(rgb, alpha, wrinkle_rgba)
    Image.fromarray(view_rgb, "RGB").save(view_path, "WEBP", quality=92, method=6)

    return {
        "angle": angle,
        "wrinkleUrl": f"{base}/{wrinkle_name}",
        "wrinkleViewUrl": f"{base}/{view_name}",
        "wrinkles": paths,
        "pathCount": len(paths),
        "pathSource": source,
    }


def update_manifest(
    manifest_path: Path,
    by_angle: dict[str, dict[str, Any]],
    *,
    front_photo_zoom: float | None = None,
    front_css_scale: float | None = None,
) -> None:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    angles = manifest.setdefault("angles", {})
    cv = manifest.setdefault("cvAnnotations", {})
    wrinkles_by_angle: dict[str, list] = cv.setdefault("wrinklesByAngle", {})

    for angle, row in by_angle.items():
        if angle in angles:
            angles[angle]["srcWrinkles"] = row["wrinkleUrl"]
            angles[angle]["srcWrinklesView"] = row["wrinkleViewUrl"]
        wrinkles_by_angle[angle] = row["wrinkles"]
        print(
            f"  {angle}: {row['pathCount']} paths ({row.get('pathSource', '?')}) -> {row['wrinkleUrl']}",
            flush=True,
        )

    if front_photo_zoom is not None and "front" in angles:
        angles["front"]["photoZoom"] = front_photo_zoom
        if front_css_scale is not None:
            angles["front"]["cssTransform"] = f"translate(0px, 6px) scale({front_css_scale})"

    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--slug-dir",
        type=Path,
        default=PUBLIC_3D / "courtney-bellamy-side-photo",
    )
    parser.add_argument("--slug", default="courtney-bellamy-side-photo")
    parser.add_argument("--front-photo-zoom", type=float, default=0.88)
    parser.add_argument("--front-css-scale", type=float, default=0.86)
    args = parser.parse_args()

    out_dir = args.slug_dir.resolve()
    slug = args.slug
    manifest_path = out_dir / f"{slug}-aura-manifest.json"
    if not manifest_path.exists():
        raise SystemExit(f"Missing manifest: {manifest_path}")

    by_angle: dict[str, dict[str, Any]] = {}
    for color_path in sorted(out_dir.glob(f"{slug}-*-color.png")):
        stem = color_path.stem
        angle = stem.removeprefix(f"{slug}-").removesuffix("-color")
        if angle == stem:
            continue
        rembg_path = out_dir / f"{slug}-{angle}-rembg.png"
        print(f"Processing {angle}…", flush=True)
        by_angle[angle] = process_angle(angle, color_path, rembg_path, out_dir, slug)

    annotations_json = out_dir / f"{slug}-wrinkle-annotations.json"
    annotations_json.write_text(json.dumps(by_angle, indent=2) + "\n", encoding="utf-8")
    update_manifest(
        manifest_path,
        by_angle,
        front_photo_zoom=args.front_photo_zoom,
        front_css_scale=args.front_css_scale,
    )
    print(f"Wrote {annotations_json} and updated {manifest_path}", flush=True)


if __name__ == "__main__":
    main()
