#!/usr/bin/env python3
"""CV wrinkle annotation for full-face portrait photos."""

from __future__ import annotations

import argparse
import importlib.util
import json
import shutil
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SCRIPT_DIR = Path(__file__).resolve().parent


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


def estimate_face_bbox(rgb: np.ndarray) -> tuple[int, int, int, int] | None:
    wrinkle_mod = _load("wrinkle_crease_detect", "wrinkle_crease_detect.py")
    cutout_mod = _load("wrinkle_cutout_render", "wrinkle_cutout_render.py")

    person = cutout_mod.studio_backdrop_mask(rgb)
    skin = wrinkle_mod._build_skin_mask(rgb, person)
    h, w = rgb.shape[:2]
    cx0, cx1 = int(w * 0.05), int(w * 0.95)
    skin_roi = skin[:, cx0:cx1]
    ys, xs = np.where(skin_roi > 80)
    if len(xs) < 120:
        ys, xs = np.where(person[:, cx0:cx1] > 80)
    if len(xs) < 120:
        return None
    x0, x1 = int(xs.min() + cx0), int(xs.max() + cx0)
    y0, y1 = int(ys.min()), int(ys.max())
    face_h = int((y1 - y0) * 0.68)
    return x0, y0, x1 - x0, max(face_h, int(h * 0.28))


def resolve_wrinkle_paths(
    rgb: np.ndarray,
    angle: str,
    alpha: np.ndarray,
) -> tuple[list[list[list[float]]], str]:
    mp_mod = _load("mediapipe_wrinkle_paths", "mediapipe_wrinkle_paths.py")
    anat_mod = _load("anatomical_wrinkle_paths", "anatomical_wrinkle_paths.py")
    wrinkle_mod = _load("wrinkle_crease_detect", "wrinkle_crease_detect.py")

    ih, iw = rgb.shape[:2]
    bbox = estimate_face_bbox(rgb)
    paths, tag = mp_mod.mediapipe_wrinkle_paths(
        rgb,
        angle,
        iw,
        ih,
        fallback_bbox=bbox,
        alpha=alpha,
    )

    is_full_portrait = min(ih, iw) >= 640
    if tag.startswith("detected-creases-periocular") and is_full_portrait and bbox is not None:
        lm = mp_mod._landmarks_on_image(rgb, bbox)
        if lm is not None:
            detected = wrinkle_mod.detect_wrinkle_creases_from_landmarks(
                rgb, alpha, lm, angle, iw, ih
            )
            if len(detected) >= 4:
                return detected, "detected-creases"
        anatomical = anat_mod.anatomical_wrinkle_paths(angle, bbox, iw, ih)
        if len(anatomical) > len(paths):
            return anatomical, "anatomical-schematic"

    if len(paths) == 0 and bbox is not None:
        return anat_mod.anatomical_wrinkle_paths(angle, bbox, iw, ih), "anatomical-schematic"

    return paths, tag


def annotate_face(
    img_path: Path,
    out_dir: Path,
    angle: str,
    *,
    copy_source: bool = True,
    stem: str | None = None,
) -> None:
    crease_mod = _load("wrinkle_crease_detect", "wrinkle_crease_detect.py")
    cutout_mod = _load("wrinkle_cutout_render", "wrinkle_cutout_render.py")
    aura_mod = _load("generate_patient_aura_assets", "generate_patient_aura_assets.py")

    out_dir.mkdir(parents=True, exist_ok=True)
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
    rgb = np.array(ImageOps.exif_transpose(Image.open(img_path)).convert("RGB"))
    ih, iw = rgb.shape[:2]
    alpha = cutout_mod.studio_backdrop_mask(rgb)

    paths, tag = resolve_wrinkle_paths(rgb, angle, alpha)
    print(f"Detected {len(paths)} paths ({tag}, angle={angle})")
    bbox = aura_mod.redness_face_bbox(rgb, alpha, angle)
    fold_guides, fold_tag = aura_mod.mediapipe_structural_fold_paths(
        rgb,
        angle,
        iw,
        ih,
        fallback_bbox=bbox,
    )
    bake_paths = aura_mod._wrinkle_bake_guides(paths, fold_guides, angle=angle)
    print(f"Baking {len(bake_paths)} wrinkle guides ({fold_tag} folds)")
    cv_filter = aura_mod.bake_wrinkle_heatmap_image(rgb, alpha, angle=angle, paths=bake_paths)

    wrinkle_rgba = cutout_mod.render_wrinkle_cutout_rgba(ih, iw, paths, alpha)
    base = rgb.astype(np.float32)
    ov = wrinkle_rgba.astype(np.float32)
    blend_a = ov[:, :, 3:4] / 255.0
    baked = np.clip(base * (1 - blend_a) + ov[:, :, :3] * blend_a, 0, 255).astype(np.uint8)

    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    response = crease_mod._crease_response(gray, "any")
    skin = crease_mod._build_skin_mask(rgb, alpha)
    mask = (skin > 40).astype(np.float32)
    resp_masked = (response.astype(np.float32) * mask).astype(np.uint8)
    heat = cv2.applyColorMap(resp_masked, cv2.COLORMAP_MAGMA)
    heat_rgb = cv2.cvtColor(heat, cv2.COLOR_BGR2RGB)
    person_a = (alpha.astype(np.float32) / 255.0)[..., None]
    heat_rgb = (heat_rgb * person_a).astype(np.uint8)

    svg_paths = [polyline_to_svg_path(p) for p in paths]
    payload = {
        "label": "CV-detected wrinkle creases (full-face portrait)",
        "imageSize": [iw, ih],
        "image": str(source_ref),
        "angle": angle,
        "wrinklePathSource": tag,
        "pathCount": len(paths),
        "wrinkles": paths,
        "wrinklesSvg": svg_paths,
    }

    with open(out_dir / f"{stem}-paths.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    Image.fromarray(heat_rgb).save(out_dir / f"{stem}-crease-heatmap.png")
    Image.fromarray(cv_filter).save(out_dir / f"{stem}-cv-filter.png")
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
    parser = argparse.ArgumentParser(description="Annotate full-face wrinkle creases with CV.")
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--angle", required=True, help="front | three-quarter-left | three-quarter-right | profile-left | profile-right")
    parser.add_argument("--stem", type=str, default=None)
    parser.add_argument("--no-copy", action="store_true")
    args = parser.parse_args()
    annotate_face(
        args.input,
        args.output_dir,
        args.angle,
        copy_source=not args.no_copy,
        stem=args.stem,
    )


if __name__ == "__main__":
    main()
