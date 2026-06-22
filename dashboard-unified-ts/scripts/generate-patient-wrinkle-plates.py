#!/usr/bin/env python3
"""Bake per-angle transparent wrinkle line cutouts + path JSON for Aura patients."""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path
from typing import Any

import cv2
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
_crease = _load_module("wrinkle_crease_detect", SCRIPT_DIR / "wrinkle_crease_detect.py")
_patient = _load_module("patient_aura", SCRIPT_DIR / "generate_patient_aura_assets.py")

mediapipe_wrinkle_paths = _mp_wr.mediapipe_wrinkle_paths
render_wrinkle_cutout_rgba = _cutout.render_wrinkle_cutout_rgba
redness_face_bbox = _patient.redness_face_bbox
_smoothstep = _patient._smoothstep
_gaussian_2d = _patient._gaussian_2d


def _wrinkle_face_surface(rgb: np.ndarray, alpha: np.ndarray | None, angle: str) -> np.ndarray:
    """Soft facial-skin field used to keep wrinkle heat off hair/beard/background."""
    h, w = rgb.shape[:2]
    matte = alpha if alpha is not None else np.full((h, w), 255, np.uint8)
    x0, y0, x1, y1 = redness_face_bbox(rgb, matte, angle)
    fw, fh = max(1, x1 - x0), max(1, y1 - y0)
    yy, xx = np.mgrid[0:h, 0:w]
    nx = (xx - x0) / fw
    ny = (yy - y0) / fh
    if angle == "front":
        surface = 1 - _smoothstep(0.86, 1.07, ((nx - 0.50) / 0.45) ** 2 + ((ny - 0.55) / 0.56) ** 2)
        surface *= _smoothstep(0.15, 0.23, nx) * (1 - _smoothstep(0.78, 0.86, nx))
        surface *= _smoothstep(0.17, 0.25, ny) * (1 - _smoothstep(0.84, 0.94, ny))
        eyes = _gaussian_2d(nx, ny, 0.35, 0.40, 0.13, 0.055) + _gaussian_2d(nx, ny, 0.65, 0.40, 0.13, 0.055)
        lips = _gaussian_2d(nx, ny, 0.50, 0.70, 0.20, 0.050)
        brows = _gaussian_2d(nx, ny, 0.35, 0.32, 0.14, 0.038) + _gaussian_2d(nx, ny, 0.65, 0.32, 0.14, 0.038)
        surface *= 1 - np.clip(0.95 * eyes + 0.86 * lips + 0.70 * brows, 0, 0.96)
    else:
        surface = 1 - _smoothstep(0.82, 1.04, ((nx - 0.67) / 0.36) ** 2 + ((ny - 0.56) / 0.54) ** 2)
        surface *= _smoothstep(0.24, 0.42, nx) * (1 - _smoothstep(0.86, 0.96, nx))
        surface *= _smoothstep(0.18, 0.28, ny) * (1 - _smoothstep(0.83, 0.94, ny))
        eyes = _gaussian_2d(nx, ny, 0.73, 0.40, 0.12, 0.055)
        lips = _gaussian_2d(nx, ny, 0.80, 0.68, 0.15, 0.050)
        surface *= 1 - np.clip(0.95 * eyes + 0.82 * lips, 0, 0.96)
    return np.clip(surface, 0.0, 1.0).astype(np.float32)


def _clean_wrinkle_skin_mask(
    rgb: np.ndarray,
    alpha: np.ndarray | None,
    *,
    angle: str,
) -> np.ndarray:
    """Face-skin mask for wrinkle heatmaps: excludes hair, beard, background, eyes, lips."""
    h, w = rgb.shape[:2]
    person = alpha if alpha is not None else _cutout.studio_backdrop_mask(rgb)
    skin = _crease._build_skin_mask(rgb, person)
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    hue, sat, val = cv2.split(hsv)
    seed = (skin > 0) & (val > 45) & (sat > 8) & ((hue < 32) | (hue > 164))
    skin_val_floor = 58
    if int(seed.sum()) > 200:
        skin_val_floor = max(45, int(np.percentile(val[seed], 45)) - 55)

    # Hair/beards/brows/eye makeup often have strong blackhat response. Suppress dark
    # or very saturated regions before computing the overlay alpha.
    plausible_skin = (
        (val > skin_val_floor)
        & (val < 246)
        & (sat > 10)
        & (sat < 108)
        & ((hue < 30) | (hue > 166))
        & (gray > skin_val_floor)
    ).astype(np.uint8) * 255
    face_surface = _wrinkle_face_surface(rgb, alpha, angle)
    mask = cv2.bitwise_and(skin, plausible_skin)

    # Keep the largest connected skin component; this removes isolated warm hair/background islands.
    n, labels, stats, _ = cv2.connectedComponentsWithStats((mask > 0).astype(np.uint8), 8)
    if n > 1:
        min_area = max(220, int(h * w * 0.006))
        keep = np.zeros((h, w), np.uint8)
        for idx in np.argsort(stats[1:, cv2.CC_STAT_AREA])[::-1] + 1:
            if int(stats[idx, cv2.CC_STAT_AREA]) < min_area:
                continue
            keep[labels == idx] = 255
            if int(keep.sum() / 255) > h * w * 0.10:
                break
        if int(keep.sum()) > 0:
            mask = keep

    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_CLOSE,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)),
        iterations=1,
    )
    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)),
        iterations=1,
    )
    return cv2.GaussianBlur(mask.astype(np.float32) / 255.0, (0, 0), 2.2) * face_surface


def composite_wrinkle_heatmap_view_rgb(
    rgb: np.ndarray,
    alpha: np.ndarray | None,
    *,
    angle: str,
    paths: list[list[list[float]]],
) -> np.ndarray:
    """Overlay masked crease-response heatmap on the real photo."""
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    response = _crease._crease_response(gray, "any").astype(np.float32)
    skin = _clean_wrinkle_skin_mask(rgb, alpha, angle=angle)
    h, w = gray.shape
    path_gate = np.zeros((h, w), np.float32)
    stroke = max(12, int(min(h, w) * 0.026))
    for path in paths:
        pts = np.array(
            [[round(x / 100.0 * w), round(y / 100.0 * h)] for x, y in path],
            dtype=np.int32,
        )
        if len(pts) >= 2:
            cv2.polylines(path_gate, [pts], False, 1.0, stroke, cv2.LINE_AA)
    if path_gate.max() > 0:
        path_gate = cv2.dilate(
            (path_gate > 0.02).astype(np.uint8),
            cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (stroke, stroke)),
            iterations=1,
        ).astype(np.float32)
        path_gate = cv2.GaussianBlur(path_gate, (0, 0), max(2.0, stroke * 0.45))
        path_gate = np.clip(path_gate, 0.0, 1.0)
    else:
        path_gate = np.ones((h, w), np.float32)

    boost = path_gate
    valid = skin > 0.12
    if int(valid.sum()) < 400:
        return rgb.copy()

    lo = float(np.percentile(response[valid], 32))
    hi = float(np.percentile(response[valid], 98.2))
    heat = np.clip((response - lo) / max(hi - lo, 1.0), 0.0, 1.0)
    heat = np.clip(heat * (0.85 + boost * 0.55), 0.0, 1.0) * skin
    heat = cv2.GaussianBlur(heat, (0, 0), 0.65)
    heat = np.clip(heat * 1.55, 0.0, 1.0)

    magma = cv2.applyColorMap(np.clip(heat * 255, 0, 255).astype(np.uint8), cv2.COLORMAP_MAGMA)
    heat_rgb = cv2.cvtColor(magma, cv2.COLOR_BGR2RGB).astype(np.float32)
    base = rgb.astype(np.float32)
    alpha_map = np.clip((heat ** 0.78) * 0.78, 0.0, 0.72)[..., None]
    out = base * (1.0 - alpha_map) + heat_rgb * alpha_map
    return np.clip(out, 0, 255).astype(np.uint8)



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
    view_rgb = composite_wrinkle_heatmap_view_rgb(
        rgb,
        alpha,
        angle=angle,
        paths=paths,
    )
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
