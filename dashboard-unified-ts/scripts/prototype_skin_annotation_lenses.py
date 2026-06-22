#!/usr/bin/env python3
"""Prototype extra skin-analysis overlays on front-facing portraits.

These are exploratory RGB-photo heuristics for comparing possible dashboard
features against the existing pigmentation / redness / pore / wrinkle lenses.
They intentionally write static assets so visual QA is easy.
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]


@dataclass
class LensResult:
    name: str
    label: str
    composite: np.ndarray
    heat: np.ndarray
    score: float


def slugify(path: Path) -> str:
    return re.sub(r"[^a-z0-9]+", "-", path.stem.lower()).strip("-") or "image"


def read_rgb(path: Path) -> np.ndarray:
    img = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if img is None:
        raise FileNotFoundError(path)
    return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)


def save_rgb(path: Path, rgb: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(path), cv2.cvtColor(np.clip(rgb, 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR))


def robust_norm(score: np.ndarray, valid: np.ndarray, lo_p: float = 55, hi_p: float = 98) -> np.ndarray:
    out = np.zeros_like(score, dtype=np.float32)
    vals = score[valid]
    if vals.size < 64:
        return out
    lo, hi = np.percentile(vals, [lo_p, hi_p])
    out = np.clip((score - lo) / max(float(hi - lo), 1e-6), 0, 1).astype(np.float32)
    out[~valid] = 0
    return out


def detect_face_bbox(rgb: np.ndarray) -> tuple[int, int, int, int]:
    h, w = rgb.shape[:2]
    gray = cv2.equalizeHist(cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY))
    cascade_path = Path(cv2.data.haarcascades) / "haarcascade_frontalface_default.xml"
    if cascade_path.exists():
        cascade = cv2.CascadeClassifier(str(cascade_path))
        faces = cascade.detectMultiScale(
            gray,
            scaleFactor=1.08,
            minNeighbors=4,
            minSize=(max(90, int(w * 0.18)), max(90, int(h * 0.18))),
        )
        if len(faces):
            x, y, fw, fh = max(faces, key=lambda f: int(f[2]) * int(f[3]))
            px, py = int(fw * 0.16), int(fh * 0.20)
            return max(0, x - px), max(0, y - py), min(w, x + fw + px), min(h, y + fh + py)
    # Portrait fallback: centered head/face crop.
    return int(w * 0.18), int(h * 0.08), int(w * 0.82), int(h * 0.86)


def face_geometry_masks(rgb: np.ndarray) -> dict[str, np.ndarray | tuple[int, int, int, int]]:
    h, w = rgb.shape[:2]
    x0, y0, x1, y1 = detect_face_bbox(rgb)
    fw, fh = max(1, x1 - x0), max(1, y1 - y0)
    yy, xx = np.mgrid[0:h, 0:w]
    nx = (xx - x0) / fw
    ny = (yy - y0) / fh

    oval = (((nx - 0.50) / 0.48) ** 2 + ((ny - 0.50) / 0.58) ** 2) <= 1.0
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    hue, sat, val = cv2.split(hsv)
    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)
    skin_chroma = (
        (val > 45)
        & (val < 252)
        & (sat > 8)
        & (sat < 150)
        & ((hue < 26) | (hue > 164))
        & (r >= g - 28)
        & (r >= b - 18)
    )
    skin = (oval & skin_chroma).astype(np.uint8) * 255
    skin = cv2.morphologyEx(skin, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (19, 19)), 1)
    skin_f = np.clip(cv2.GaussianBlur(skin.astype(np.float32) / 255.0, (0, 0), 2.2), 0, 1)

    eyes = (
        np.exp(-0.5 * (((nx - 0.34) / 0.13) ** 2 + ((ny - 0.38) / 0.055) ** 2))
        + np.exp(-0.5 * (((nx - 0.66) / 0.13) ** 2 + ((ny - 0.38) / 0.055) ** 2))
    )
    brows = (
        np.exp(-0.5 * (((nx - 0.34) / 0.15) ** 2 + ((ny - 0.30) / 0.040) ** 2))
        + np.exp(-0.5 * (((nx - 0.66) / 0.15) ** 2 + ((ny - 0.30) / 0.040) ** 2))
    )
    lips = np.exp(-0.5 * (((nx - 0.50) / 0.18) ** 2 + ((ny - 0.71) / 0.050) ** 2))
    nostrils = np.exp(-0.5 * (((nx - 0.50) / 0.14) ** 2 + ((ny - 0.55) / 0.045) ** 2))
    feature_excl = np.clip(eyes * 1.0 + brows * 0.75 + lips * 1.0 + nostrils * 0.7, 0, 1)
    skin_allowed = np.clip(skin_f * (1 - feature_excl), 0, 1)
    skin_allowed = cv2.GaussianBlur(skin_allowed, (0, 0), 0.8)

    masks = {
        "bbox": (x0, y0, x1, y1),
        "skin": skin_allowed,
        "skin_raw": skin_f,
        "eyes": np.clip(eyes, 0, 1),
        "lips": np.clip(lips, 0, 1),
        "nx": nx.astype(np.float32),
        "ny": ny.astype(np.float32),
    }
    return masks


def overlay_heat(rgb: np.ndarray, heat: np.ndarray, color: tuple[int, int, int], strength: float = 0.55) -> np.ndarray:
    h = np.clip(heat, 0, 1).astype(np.float32)
    tint = np.zeros_like(rgb, dtype=np.float32)
    tint[:, :] = np.array(color, dtype=np.float32)
    out = rgb.astype(np.float32) * (1 - h[:, :, None] * strength) + tint * (h[:, :, None] * strength)
    return np.clip(out, 0, 255).astype(np.uint8)


def acne_blemish(rgb: np.ndarray, masks: dict[str, object]) -> LensResult:
    skin = masks["skin"] > 0.16
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    l = lab[:, :, 0].astype(np.float32)
    a = lab[:, :, 1].astype(np.float32)
    local_a = cv2.GaussianBlur(a, (0, 0), 9)
    local_l = cv2.GaussianBlur(l, (0, 0), 9)
    red_peak = np.maximum(a - local_a, 0)
    dark_bump = np.maximum(local_l - l, 0) * 0.45
    score = red_peak + dark_bump
    heat = robust_norm(score, skin, 76, 99.2) * masks["skin"]
    heat = cv2.morphologyEx((heat * 255).astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)), 1).astype(np.float32) / 255
    heat = cv2.GaussianBlur(heat, (0, 0), 1.2)
    out = overlay_heat(rgb, heat, (232, 58, 72), 0.62)
    return LensResult("blemishes", "Blemishes / acne-prone spots", out, heat, float(np.mean(heat[skin])) if np.any(skin) else 0)


def dark_circles(rgb: np.ndarray, masks: dict[str, object]) -> LensResult:
    nx = masks["nx"]
    ny = masks["ny"]
    skin = masks["skin_raw"] > 0.12
    under = (
        np.exp(-0.5 * (((nx - 0.34) / 0.18) ** 2 + ((ny - 0.455) / 0.070) ** 2))
        + np.exp(-0.5 * (((nx - 0.66) / 0.18) ** 2 + ((ny - 0.455) / 0.070) ** 2))
    )
    under = np.clip(under * (1 - masks["eyes"] * 0.95) * masks["skin_raw"], 0, 1)
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    l = lab[:, :, 0].astype(np.float32)
    b = lab[:, :, 2].astype(np.float32)
    local_l = cv2.GaussianBlur(l, (0, 0), 28)
    shadow = np.maximum(local_l - l, 0)
    blue_brown = np.maximum(132 - b, 0) * 0.22 + np.maximum(b - 135, 0) * 0.10
    score = (shadow + blue_brown) * under
    heat = robust_norm(score, (under > 0.08) & skin, 42, 98) * under
    heat = cv2.GaussianBlur(heat, (0, 0), 3.0)
    out = overlay_heat(rgb, heat, (62, 91, 152), 0.52)
    return LensResult("dark-circles", "Dark circles / under-eye shadow", out, heat, float(np.mean(heat[under > 0.08])) if np.any(under > 0.08) else 0)


def oiliness_shine(rgb: np.ndarray, masks: dict[str, object]) -> LensResult:
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    sat = hsv[:, :, 1].astype(np.float32)
    val = hsv[:, :, 2].astype(np.float32)
    nx = masks["nx"]
    ny = masks["ny"]
    tzone = (
        np.exp(-0.5 * (((nx - 0.50) / 0.17) ** 2 + ((ny - 0.31) / 0.18) ** 2))
        + np.exp(-0.5 * (((nx - 0.50) / 0.12) ** 2 + ((ny - 0.52) / 0.18) ** 2))
        + np.exp(-0.5 * (((nx - 0.50) / 0.18) ** 2 + ((ny - 0.77) / 0.08) ** 2))
    )
    tzone = np.clip(tzone * masks["skin_raw"] * (1 - masks["eyes"] * 0.9) * (1 - masks["lips"] * 0.9), 0, 1)
    local_v = cv2.GaussianBlur(val, (0, 0), 17)
    shine = np.maximum(val - local_v, 0) * np.clip((85 - sat) / 85, 0, 1)
    heat = robust_norm(shine * tzone, tzone > 0.08, 48, 99) * tzone
    heat = cv2.GaussianBlur(heat, (0, 0), 2.5)
    out = overlay_heat(rgb, heat, (155, 236, 245), 0.58)
    return LensResult("shine-oiliness", "Oiliness / shine", out, heat, float(np.mean(heat[tzone > 0.08])) if np.any(tzone > 0.08) else 0)


def dullness_radiance(rgb: np.ndarray, masks: dict[str, object]) -> LensResult:
    skin = masks["skin"] > 0.16
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    l = lab[:, :, 0].astype(np.float32)
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    sat = hsv[:, :, 1].astype(np.float32)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    local_contrast = cv2.GaussianBlur(np.abs(gray - cv2.GaussianBlur(gray, (0, 0), 8)), (0, 0), 6)
    l_norm = robust_norm(-l, skin, 45, 95)
    sat_norm = robust_norm(-sat, skin, 40, 92)
    contrast_norm = robust_norm(-local_contrast, skin, 35, 90)
    score = (0.50 * l_norm + 0.25 * sat_norm + 0.25 * contrast_norm) * masks["skin"]
    heat = cv2.GaussianBlur(score, (0, 0), 8.0)
    out = overlay_heat(rgb, heat, (83, 105, 128), 0.42)
    return LensResult("dullness", "Dullness / low radiance", out, heat, float(np.mean(heat[skin])) if np.any(skin) else 0)


def laxity_folds(rgb: np.ndarray, masks: dict[str, object]) -> LensResult:
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    nx = masks["nx"]
    ny = masks["ny"]
    zones = (
        np.exp(-0.5 * (((nx - 0.30) / 0.10) ** 2 + ((ny - 0.60) / 0.20) ** 2))
        + np.exp(-0.5 * (((nx - 0.70) / 0.10) ** 2 + ((ny - 0.60) / 0.20) ** 2))
        + np.exp(-0.5 * (((nx - 0.34) / 0.16) ** 2 + ((ny - 0.47) / 0.08) ** 2))
        + np.exp(-0.5 * (((nx - 0.66) / 0.16) ** 2 + ((ny - 0.47) / 0.08) ** 2))
        + np.exp(-0.5 * (((nx - 0.50) / 0.30) ** 2 + ((ny - 0.82) / 0.08) ** 2))
    )
    zones = np.clip(zones * masks["skin_raw"] * (1 - masks["eyes"] * 0.9) * (1 - masks["lips"] * 0.8), 0, 1)
    blackhat = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (19, 9))).astype(np.float32)
    edges = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    score = (blackhat + np.maximum(edges, 0) * 0.16) * zones
    heat = robust_norm(score, zones > 0.08, 55, 99) * zones
    heat = cv2.GaussianBlur(heat, (0, 0), 1.8)
    out = overlay_heat(rgb, heat, (42, 102, 132), 0.58)
    return LensResult("fold-laxity", "Fold / laxity indicators", out, heat, float(np.mean(heat[zones > 0.08])) if np.any(zones > 0.08) else 0)


LENSES = [acne_blemish, dark_circles, oiliness_shine, dullness_radiance, laxity_folds]
LENS_INFO = [
    ("blemishes", "Blemishes"),
    ("dark-circles", "Dark circles"),
    ("shine-oiliness", "Shine"),
    ("dullness", "Dullness"),
    ("fold-laxity", "Folds/laxity"),
]


def make_contact(source: np.ndarray, results: list[LensResult], out: Path, title: str) -> None:
    panels = [("Source", source)] + [(r.label, r.composite) for r in results]
    h, w = source.shape[:2]
    thumb_w = 270
    thumb_h = int(h * thumb_w / w)
    gap = 8
    label_h = 34
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 17)
    except Exception:
        font = ImageFont.load_default()
    sheet = Image.new("RGB", ((thumb_w + gap) * len(panels) - gap, thumb_h + label_h), (238, 238, 238))
    draw = ImageDraw.Draw(sheet)
    for i, (label, img) in enumerate(panels):
        x = i * (thumb_w + gap)
        draw.text((x + 4, 5), label, fill=(18, 22, 30), font=font)
        pil = Image.fromarray(img).resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        sheet.paste(pil, (x, label_h))
    sheet.save(out, quality=94)


def run_image(image_path: Path, out_dir: Path) -> dict[str, object]:
    rgb = read_rgb(image_path)
    slug = slugify(image_path)
    masks = face_geometry_masks(rgb)
    results = [fn(rgb, masks) for fn in LENSES]
    person_dir = out_dir / slug
    person_dir.mkdir(parents=True, exist_ok=True)
    save_rgb(person_dir / f"{slug}-source.png", rgb)
    manifest: dict[str, object] = {"source": str(image_path), "outputs": {}, "scores": {}}
    for result in results:
        comp_path = person_dir / f"{slug}-{result.name}-composite.png"
        heat_path = person_dir / f"{slug}-{result.name}-heat.png"
        save_rgb(comp_path, result.composite)
        Image.fromarray((np.clip(result.heat, 0, 1) * 255).astype(np.uint8), "L").save(heat_path)
        manifest["outputs"][result.name] = str(comp_path)
        manifest["scores"][result.name] = result.score
    contact = person_dir / f"{slug}-skin-lens-comparison.jpg"
    make_contact(rgb, results, contact, slug)
    manifest["comparison"] = str(contact)
    (person_dir / f"{slug}-skin-lens-summary.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def make_batch_sheet(out_dir: Path, manifests: dict[str, dict[str, object]]) -> Path:
    slugs = list(manifests.keys())
    labels = ["Source"] + [label for _name, label in LENS_INFO]
    # First row dimensions.
    first_slug = slugs[0]
    first_dir = out_dir / first_slug
    sample = np.asarray(Image.open(first_dir / f"{first_slug}-source.png").convert("RGB"))
    h, w = sample.shape[:2]
    thumb_w = 210
    thumb_h = int(h * thumb_w / w)
    gap = 6
    label_h = 28
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 14)
    except Exception:
        font = ImageFont.load_default()
    sheet = Image.new("RGB", ((thumb_w + gap) * len(labels) - gap, len(slugs) * (thumb_h + label_h) + (len(slugs) - 1) * gap), (238, 238, 238))
    draw = ImageDraw.Draw(sheet)
    for r, slug in enumerate(slugs):
        y = r * (thumb_h + label_h + gap)
        person_dir = out_dir / slug
        paths = [person_dir / f"{slug}-source.png"] + [
            person_dir / f"{slug}-{name}-composite.png"
            for name, _label in LENS_INFO
        ]
        for c, (label, path) in enumerate(zip(labels, paths)):
            x = c * (thumb_w + gap)
            draw.text((x + 3, y + 4), label, fill=(18, 22, 30), font=font)
            img = Image.open(path).convert("RGB").resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
            sheet.paste(img, (x, y + label_h))
    out = out_dir / "batch-extra-skin-lenses-contact-sheet.jpg"
    sheet.save(out, quality=94)
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Prototype extra skin-analysis annotation lenses.")
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("images", nargs="+", type=Path)
    args = parser.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    manifests: dict[str, dict[str, object]] = {}
    for image in args.images:
        manifest = run_image(image, args.out_dir)
        manifests[slugify(image)] = manifest
    batch = make_batch_sheet(args.out_dir, manifests)
    (args.out_dir / "batch-extra-skin-lenses-summary.json").write_text(json.dumps(manifests, indent=2), encoding="utf-8")
    print(batch)


if __name__ == "__main__":
    main()
