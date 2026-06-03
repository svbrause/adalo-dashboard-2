#!/usr/bin/env python3
"""Export side-by-side wrinkle evaluation images (color still + baked lines).

Exports preview composites (color + transparent cutout + baked) using the same
MediaPipe wrinkle path pipeline as production asset generation.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SCRIPT_DIR = Path(__file__).resolve().parent
OUT_DIR = ROOT / "public" / "demo-3d" / "wrinkle-evaluation"
IMAGE_DIR = ROOT / "src" / "assets" / "images"
COURTNEY_DIR = ROOT / "public" / "demo-3d" / "courtney-bellamy-side-photo"
COURTNEY_SLUG = "courtney-bellamy-side-photo"

TANYA_ANGLES = {
    "front": "tan_front.png",
    "profile-right": "tan_90_right.png",
    "three-quarter-right": "tan_45_right.png",
    "profile-left": "tan_90_left.png",
    "three-quarter-left": "tan_45_left.png",
}


def _load(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPT_DIR / filename)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_mp_wr = _load("mediapipe_wrinkle_paths", "mediapipe_wrinkle_paths.py")
_cutout = _load("wrinkle_cutout_render", "wrinkle_cutout_render.py")
_patient = _load("patient_aura", "generate_patient_aura_assets.py")
_cv = _load("aura_cv", "generate-aura-cv-assets.py")

mediapipe_wrinkle_paths = _mp_wr.mediapipe_wrinkle_paths
render_wrinkle_cutout_rgba = _cutout.render_wrinkle_cutout_rgba
redness_face_bbox = _patient.redness_face_bbox
segment_person = _cv.segment_person
OUT_SIZE = _cv.OUT_SIZE


def composite_rgba_on_rgb(rgb: np.ndarray, overlay_rgba: np.ndarray) -> np.ndarray:
    base = rgb.astype(np.float32)
    ov = overlay_rgba.astype(np.float32)
    a = ov[:, :, 3:4] / 255.0
    out = base * (1 - a) + ov[:, :, :3] * a
    return np.clip(out, 0, 255).astype(np.uint8)


def label_bar(text: str, w: int) -> Image.Image:
    bar = Image.new("RGB", (w, 36), (24, 24, 28))
    draw = ImageDraw.Draw(bar)
    draw.text((12, 10), text, fill=(230, 230, 235))
    return bar


def save_triptych(
    out_path: Path,
    title: str,
    color_rgb: np.ndarray,
    cutout_rgba: np.ndarray,
    baked_rgb: np.ndarray,
    path_source: str,
) -> None:
    h, w = color_rgb.shape[:2]
    max_w = 720
    if w > max_w:
        scale = max_w / w
        nh, nw = int(h * scale), int(w * scale)
        color_rgb = np.array(Image.fromarray(color_rgb).resize((nw, nh), Image.Resampling.LANCZOS))
        cutout_rgba = np.array(Image.fromarray(cutout_rgba, "RGBA").resize((nw, nh), Image.Resampling.LANCZOS))
        baked_rgb = np.array(Image.fromarray(baked_rgb).resize((nw, nh), Image.Resampling.LANCZOS))
        h, w = nh, nw

    panels = [
        ("Color still", color_rgb),
        ("Wrinkle cutout (transparent)", cutout_rgba),
        ("Baked composite", baked_rgb),
    ]
    gap = 8
    total_w = w * 3 + gap * 2
    canvas = Image.new("RGB", (total_w, h + 72), (18, 18, 20))
    canvas.paste(label_bar(f"{title} — {path_source}", total_w), (0, 0))
    y0 = 36
    x = 0
    for label, img in panels:
        canvas.paste(label_bar(label, w), (x, y0))
        if img.ndim == 3 and img.shape[2] == 4:
            rgba = Image.fromarray(img, "RGBA")
            canvas.paste(rgba, (x, y0 + 36), rgba.split()[3])
        else:
            canvas.paste(Image.fromarray(img), (x, y0 + 36))
        x += w + gap
    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out_path, "PNG", optimize=True)
    print(f"  -> {out_path.relative_to(ROOT)}", flush=True)


def export_courtney(angle: str) -> None:
    color_path = COURTNEY_DIR / f"{COURTNEY_SLUG}-{angle}-color.png"
    rembg_path = COURTNEY_DIR / f"{COURTNEY_SLUG}-{angle}-rembg.png"
    if not color_path.exists():
        return
    rgb = np.array(Image.open(color_path).convert("RGB"))
    alpha = np.array(Image.open(rembg_path).convert("RGBA"))[:, :, 3] if rembg_path.exists() else np.full(rgb.shape[:2], 255, np.uint8)
    ih, iw = rgb.shape[:2]
    bbox = redness_face_bbox(rgb, alpha, angle)
    paths, path_source = mediapipe_wrinkle_paths(
        rgb, angle, iw, ih, fallback_bbox=bbox, alpha=alpha
    )
    cutout = render_wrinkle_cutout_rgba(ih, iw, paths, alpha)
    baked = composite_rgba_on_rgb(rgb, cutout)
    save_triptych(
        OUT_DIR / f"courtney-bellamy_{angle}.png",
        f"Courtney Bellamy · {angle}",
        rgb,
        cutout,
        baked,
        path_source,
    )


def export_tanya(angle: str, source: str) -> None:
    bgr_path = IMAGE_DIR / source
    if not bgr_path.exists():
        return
    import cv2

    bgr = cv2.imread(str(bgr_path), cv2.IMREAD_COLOR)
    if bgr is None:
        return
    spec = _cv.ANGLE_SPECS[angle]
    alpha = segment_person(bgr, spec["source_bbox"])
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    plate = np.zeros((OUT_SIZE, OUT_SIZE, 4), np.uint8)
    # Reuse aligned_plate from cv module
    plate, _, _, _ = _cv.aligned_plate(spec)
    bbox = spec["target_bbox"]
    plate_rgb = plate[:, :, :3]
    paths, path_source = mediapipe_wrinkle_paths(
        plate_rgb,
        angle,
        OUT_SIZE,
        OUT_SIZE,
        fallback_bbox=bbox,
        alpha=plate[:, :, 3],
    )
    cutout = render_wrinkle_cutout_rgba(OUT_SIZE, OUT_SIZE, paths, plate[:, :, 3])
    baked = composite_rgba_on_rgb(plate_rgb, cutout)
    save_triptych(
        OUT_DIR / f"tanya-tan_{angle}.png",
        f"Tanya Tan · {angle}",
        plate_rgb,
        cutout,
        baked,
        path_source,
    )


def main() -> None:
    print(
        "Wrinkle mapping: crease detection in MP zones (scripts/wrinkle_crease_detect.py)\n",
        flush=True,
    )
    for angle in ("front", "three-quarter-right", "profile-right", "three-quarter-left", "profile-left"):
        print(f"Courtney {angle}…", flush=True)
        export_courtney(angle)
    for angle, src in TANYA_ANGLES.items():
        print(f"Tanya {angle}…", flush=True)
        export_tanya(angle, src)
    print(f"\nOpen previews: {OUT_DIR.relative_to(ROOT)}/", flush=True)


if __name__ == "__main__":
    main()
