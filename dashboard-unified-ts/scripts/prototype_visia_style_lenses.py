#!/usr/bin/env python3
"""VISIA-inspired skin-analysis lens prototype.

This intentionally mimics the diagnostic visual grammar from VISIA reports:
turquoise analysis ROI, dot fields for countable findings, lens-specific base
transforms, and short green wrinkle strokes. It is not a true VISIA substitute:
UV spots and porphyrins are RGB-photo proxies unless captured with UV hardware.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont


def slugify(path: Path) -> str:
    return re.sub(r"[^a-z0-9]+", "-", path.stem.lower()).strip("-") or "image"


def read_rgb(path: Path) -> np.ndarray:
    bgr = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if bgr is None:
        raise FileNotFoundError(path)
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)


def save_rgb(path: Path, rgb: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(path), cv2.cvtColor(np.clip(rgb, 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR))


def detect_face_bbox(rgb: np.ndarray) -> tuple[int, int, int, int]:
    h, w = rgb.shape[:2]
    cascade_path = Path(cv2.data.haarcascades) / "haarcascade_frontalface_default.xml"
    if cascade_path.exists():
        gray = cv2.equalizeHist(cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY))
        cascade = cv2.CascadeClassifier(str(cascade_path))
        faces = cascade.detectMultiScale(
            gray,
            scaleFactor=1.08,
            minNeighbors=4,
            minSize=(max(90, int(w * 0.18)), max(90, int(h * 0.18))),
        )
        if len(faces):
            x, y, fw, fh = max(faces, key=lambda face: int(face[2]) * int(face[3]))
            px, py = int(fw * 0.18), int(fh * 0.20)
            return max(0, x - px), max(0, y - py), min(w, x + fw + px), min(h, y + fh + py)
    return int(w * 0.18), int(h * 0.08), int(w * 0.82), int(h * 0.88)


def geometry(rgb: np.ndarray) -> dict[str, np.ndarray | tuple[int, int, int, int]]:
    h, w = rgb.shape[:2]
    x0, y0, x1, y1 = detect_face_bbox(rgb)
    fw, fh = max(1, x1 - x0), max(1, y1 - y0)
    yy, xx = np.mgrid[0:h, 0:w]
    nx = (xx - x0) / fw
    ny = (yy - y0) / fh

    face_oval = (((nx - 0.50) / 0.48) ** 2 + ((ny - 0.51) / 0.59) ** 2) <= 1.0
    # VISIA reports usually show a cheek/nose analysis patch rather than the
    # whole face. On frontal photos, use the visually more legible camera-right
    # cheek/nose patch and a small bridge over the nose.
    cheek_nose = (
        (((nx - 0.66) / 0.26) ** 2 + ((ny - 0.55) / 0.31) ** 2 <= 1.0)
        | (((nx - 0.50) / 0.15) ** 2 + ((ny - 0.50) / 0.30) ** 2 <= 1.0)
        | (((nx - 0.44) / 0.10) ** 2 + ((ny - 0.50) / 0.20) ** 2 <= 1.0)
    )
    roi_shape = face_oval & cheek_nose & (ny > 0.24) & (ny < 0.79)
    roi = roi_shape

    eyes = (
        np.exp(-0.5 * (((nx - 0.34) / 0.13) ** 2 + ((ny - 0.38) / 0.055) ** 2))
        + np.exp(-0.5 * (((nx - 0.66) / 0.13) ** 2 + ((ny - 0.38) / 0.055) ** 2))
    )
    brows = (
        np.exp(-0.5 * (((nx - 0.34) / 0.15) ** 2 + ((ny - 0.30) / 0.040) ** 2))
        + np.exp(-0.5 * (((nx - 0.66) / 0.15) ** 2 + ((ny - 0.30) / 0.040) ** 2))
    )
    lips = np.exp(-0.5 * (((nx - 0.50) / 0.18) ** 2 + ((ny - 0.71) / 0.055) ** 2))
    nostrils = np.exp(-0.5 * (((nx - 0.50) / 0.14) ** 2 + ((ny - 0.55) / 0.045) ** 2))
    excl = np.clip(eyes * 1.0 + brows * 0.65 + lips * 1.0 + nostrils * 0.70, 0, 1)

    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    hue, sat, val = cv2.split(hsv)
    r, g, b = rgb[:, :, 0].astype(np.int16), rgb[:, :, 1].astype(np.int16), rgb[:, :, 2].astype(np.int16)
    skin_chroma = (
        (val > 45)
        & (val < 252)
        & (sat > 8)
        & (sat < 150)
        & ((hue < 28) | (hue > 164))
        & (r >= g - 30)
        & (r >= b - 20)
    )
    mask = (roi & skin_chroma & (excl < 0.55)).astype(np.uint8) * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (17, 17)), 1)
    mask_f = cv2.GaussianBlur(mask.astype(np.float32) / 255.0, (0, 0), 1.5)
    wrinkle_roi = np.clip(
        np.exp(-0.5 * (((nx - 0.66) / 0.20) ** 2 + ((ny - 0.42) / 0.080) ** 2))
        * (1 - eyes * 0.95)
        * (ny > 0.31)
        * (ny < 0.52),
        0,
        1,
    )
    return {
        "bbox": (x0, y0, x1, y1),
        "mask": mask_f,
        "mask_binary": mask > 0,
        "roi_shape": roi_shape.astype(np.uint8) * 255,
        "nx": nx.astype(np.float32),
        "ny": ny.astype(np.float32),
        "eyes": np.clip(eyes, 0, 1),
        "excl": excl,
        "wrinkle_roi": wrinkle_roi.astype(np.float32),
    }


def normalize(score: np.ndarray, valid: np.ndarray, lo: float = 65, hi: float = 98.8) -> np.ndarray:
    out = np.zeros_like(score, dtype=np.float32)
    vals = score[valid]
    if vals.size < 100:
        return out
    p0, p1 = np.percentile(vals, [lo, hi])
    out = np.clip((score - p0) / max(float(p1 - p0), 1e-6), 0, 1)
    out[~valid] = 0
    return out


def dots_from_heat(
    heat: np.ndarray,
    valid: np.ndarray,
    *,
    percentile: float,
    max_dots: int,
    min_area: int = 2,
    max_area: int = 900,
) -> list[tuple[int, int, float, int]]:
    vals = heat[valid]
    if vals.size < 100 or float(vals.max()) <= 0:
        return []
    thr = np.percentile(vals, percentile)
    binary = ((heat >= thr) & valid).astype(np.uint8) * 255
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)), 1)
    n, _labels, stats, cents = cv2.connectedComponentsWithStats(binary, 8)
    dots: list[tuple[float, int, int, int]] = []
    for i in range(1, n):
        area = int(stats[i, cv2.CC_STAT_AREA])
        if area < min_area or area > max_area:
            continue
        cx, cy = int(cents[i][0]), int(cents[i][1])
        strength = float(heat[cy, cx])
        radius = int(np.clip(np.sqrt(area) * 0.55 + 1.0, 1, 5))
        dots.append((strength, cx, cy, radius))
    dots.sort(reverse=True)
    return [(cx, cy, strength, radius) for strength, cx, cy, radius in dots[:max_dots]]


def draw_roi_and_dots(
    base: np.ndarray,
    mask: np.ndarray,
    dots: list[tuple[int, int, float, int]],
    dot_color: tuple[int, int, int],
    *,
    outline: bool = True,
    outline_mask: np.ndarray | None = None,
    dot_alpha: float = 0.90,
) -> np.ndarray:
    out = base.astype(np.float32).copy()
    for cx, cy, strength, radius in dots:
        color = np.array(dot_color, dtype=np.float32)
        a = dot_alpha * (0.45 + 0.55 * strength)
        cv2.circle(out, (cx, cy), max(1, radius), color.tolist(), -1, lineType=cv2.LINE_AA)
        if radius >= 3:
            cv2.circle(out, (cx, cy), radius + 1, (255, 255, 255), 1, lineType=cv2.LINE_AA)
            out[cy, cx] = out[cy, cx] * (1 - a) + color * a
    out = np.clip(out, 0, 255).astype(np.uint8)
    if outline:
        src_mask = outline_mask if outline_mask is not None else mask
        contours, _ = cv2.findContours((src_mask > 0.16).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(out, contours, -1, (60, 224, 224), 3, cv2.LINE_AA)
    return out


def signals(rgb: np.ndarray, g: dict[str, object]) -> dict[str, np.ndarray]:
    mask = g["mask"]
    valid = mask > 0.18
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    l = lab[:, :, 0].astype(np.float32)
    a = lab[:, :, 1].astype(np.float32)
    b = lab[:, :, 2].astype(np.float32)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    sat = hsv[:, :, 1].astype(np.float32)

    local_l = cv2.GaussianBlur(l, (0, 0), 18)
    dark = np.maximum(local_l - l, 0)
    brown = dark + np.maximum(a - np.median(a[valid]) if np.any(valid) else 0, 0) * 0.18 + np.maximum(b - np.median(b[valid]) if np.any(valid) else 0, 0) * 0.24
    brown = normalize(brown * mask, valid, 58, 99)

    local_gray_2 = cv2.GaussianBlur(gray, (0, 0), 2.0)
    local_gray_8 = cv2.GaussianBlur(gray, (0, 0), 8.0)
    pores = normalize(np.maximum(local_gray_2 - gray, 0) * mask, valid, 70, 99.2)
    texture = normalize(np.abs(gray - local_gray_8) * mask, valid, 55, 98.8)

    red = rgb[:, :, 0].astype(np.float32)
    green = rgb[:, :, 1].astype(np.float32)
    redness = np.maximum(a - cv2.GaussianBlur(a, (0, 0), 20), 0) + np.maximum(red - green, 0) * 0.10
    redness = normalize(redness * mask, valid, 55, 98.5)

    # UV/porphyrins are only visual proxies from RGB.
    uv_proxy = normalize((brown * 0.65 + texture * 0.35) * mask, valid, 50, 98.5)
    porphyrin_proxy = normalize((pores * 0.75 + redness * 0.25) * mask, valid, 60, 99)
    spots = normalize((brown * 0.75 + np.maximum(125 - sat, 0) / 125 * 0.12) * mask, valid, 60, 99)

    wrinkle = cv2.morphologyEx(gray.astype(np.uint8), cv2.MORPH_BLACKHAT, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 7))).astype(np.float32)
    peri = (
        np.exp(-0.5 * (((g["nx"] - 0.34) / 0.18) ** 2 + ((g["ny"] - 0.42) / 0.09) ** 2))
        + np.exp(-0.5 * (((g["nx"] - 0.66) / 0.18) ** 2 + ((g["ny"] - 0.42) / 0.09) ** 2))
    )
    wrinkle = normalize(wrinkle * g["wrinkle_roi"], mask > 0.05, 62, 99.1)
    return {
        "spots": spots,
        "texture": texture,
        "pores": pores,
        "redness": redness,
        "brown": brown,
        "uv": uv_proxy,
        "porphyrins": porphyrin_proxy,
        "wrinkles": wrinkle,
    }


def base_grayscale(rgb: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    eq = cv2.equalizeHist(gray)
    return cv2.cvtColor(eq, cv2.COLOR_GRAY2RGB)


def base_sepia(rgb: np.ndarray) -> np.ndarray:
    arr = rgb.astype(np.float32)
    mat = np.array([[0.393, 0.769, 0.189], [0.349, 0.686, 0.168], [0.272, 0.534, 0.131]], dtype=np.float32)
    return np.clip(arr @ mat.T * 1.05, 0, 255).astype(np.uint8)


def base_red(rgb: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    out = np.zeros_like(rgb, dtype=np.float32)
    out[:, :, 0] = np.clip(95 + gray * 0.78, 0, 255)
    out[:, :, 1] = np.clip(18 + gray * 0.30, 0, 255)
    out[:, :, 2] = np.clip(28 + gray * 0.34, 0, 255)
    return out.astype(np.uint8)


def base_blue_black(rgb: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    out = np.zeros_like(rgb, dtype=np.float32)
    out[:, :, 0] = gray * 0.03
    out[:, :, 1] = gray * 0.12
    out[:, :, 2] = np.clip(28 + gray * 0.36, 0, 255)
    return out.astype(np.uint8)


def render_wrinkles(rgb: np.ndarray, sig: np.ndarray, g: dict[str, object]) -> np.ndarray:
    out = rgb.copy()
    valid = sig > max(0.14, np.percentile(sig[sig > 0], 52) if np.any(sig > 0) else 1)
    binary = (valid.astype(np.uint8) * 255)
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (9, 1)), 1)
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    contours = sorted(contours, key=lambda c: cv2.arcLength(c, False), reverse=True)[:28]
    for c in contours:
        if cv2.arcLength(c, False) < 10:
            continue
        cv2.polylines(out, [c], False, (104, 230, 20), 2, cv2.LINE_AA)
    contours_roi, _ = cv2.findContours((g["wrinkle_roi"] > 0.18).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(out, contours_roi, -1, (60, 224, 224), 3, cv2.LINE_AA)
    return out


def render_lenses(rgb: np.ndarray) -> tuple[list[tuple[str, np.ndarray, float]], dict[str, float]]:
    g = geometry(rgb)
    sig = signals(rgb, g)
    mask = g["mask"]
    valid = mask > 0.18
    lenses: list[tuple[str, np.ndarray, float]] = []

    specs = [
        ("Spots", rgb, sig["spots"], (88, 245, 238), 68, 260),
        ("Texture", rgb, sig["texture"], (236, 248, 142), 45, 720),
        ("Pores", rgb, sig["pores"], (96, 38, 150), 64, 520),
        ("UV Spots", base_grayscale(rgb), sig["uv"], (246, 196, 40), 46, 760),
        ("Brown Spots", base_sepia(rgb), sig["brown"], (248, 215, 45), 50, 720),
        ("Red Areas", base_red(rgb), sig["redness"], (55, 225, 230), 62, 260),
        ("Porphyrins", base_blue_black(rgb), sig["porphyrins"], (238, 226, 105), 42, 850),
    ]
    spot_img = None
    for label, base, heat, color, percentile, max_dots in specs:
        dots = dots_from_heat(heat, valid, percentile=percentile, max_dots=max_dots)
        img = draw_roi_and_dots(base, mask, dots, color, outline_mask=g["roi_shape"], dot_alpha=0.88)
        score = float(np.mean(heat[valid])) if np.any(valid) else 0.0
        lenses.append((label, img, score))
    wrinkles = render_wrinkles(rgb, sig["wrinkles"], g)
    wrinkle_score = float(np.mean(sig["wrinkles"][valid])) if np.any(valid) else 0.0
    # Insert wrinkles after spots to match VISIA ordering.
    lenses.insert(1, ("Wrinkles", wrinkles, wrinkle_score))
    scores = {label: score for label, _img, score in lenses}
    return lenses, scores


def make_grid(source: np.ndarray, lenses: list[tuple[str, np.ndarray, float]], out: Path) -> None:
    panels = lenses
    h, w = source.shape[:2]
    tile_w = 300
    tile_h = int(h * tile_w / w)
    label_h = 34
    gap = 8
    cols = 4
    rows = 2
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 18)
    except Exception:
        font = ImageFont.load_default()
    sheet = Image.new("RGB", (cols * tile_w + (cols - 1) * gap, rows * (tile_h + label_h) + (rows - 1) * gap), (255, 255, 255))
    draw = ImageDraw.Draw(sheet)
    for i, (label, img, score) in enumerate(panels):
        r, c = divmod(i, cols)
        x = c * (tile_w + gap)
        y = r * (tile_h + label_h + gap)
        pct = int(round(np.clip(100 - score * 165, 1, 99)))
        draw.text((x + 4, y + tile_h + 7), f"{label} ({pct}%)", fill=(42, 48, 58), font=font)
        pil = Image.fromarray(img).resize((tile_w, tile_h), Image.Resampling.LANCZOS)
        sheet.paste(pil, (x, y))
    sheet.save(out, quality=94)


def make_reference_comparison(refs: list[Path], ours: list[Path], out: Path) -> None:
    images: list[tuple[str, Image.Image]] = []
    for ref in refs:
        if ref.exists():
            images.append((ref.name, Image.open(ref).convert("RGB")))
    for ours_path in ours:
        if ours_path.exists():
            images.append((ours_path.name, Image.open(ours_path).convert("RGB")))
    if not images:
        return
    width = 900
    label_h = 32
    gap = 12
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 18)
    except Exception:
        font = ImageFont.load_default()
    rows = []
    for label, img in images:
        h = int(img.height * width / img.width)
        rows.append((label, img.resize((width, h), Image.Resampling.LANCZOS)))
    total_h = sum(img.height + label_h for _label, img in rows) + gap * (len(rows) - 1)
    sheet = Image.new("RGB", (width, total_h), (238, 238, 238))
    draw = ImageDraw.Draw(sheet)
    y = 0
    for label, img in rows:
        draw.text((6, y + 5), label, fill=(18, 22, 30), font=font)
        sheet.paste(img, (0, y + label_h))
        y += label_h + img.height + gap
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out, quality=94)


def main() -> None:
    parser = argparse.ArgumentParser(description="Create VISIA-style skin-analysis diagnostic grids.")
    parser.add_argument("--out-dir", required=True, type=Path)
    parser.add_argument("--reference", action="append", type=Path, default=[])
    parser.add_argument("images", nargs="+", type=Path)
    args = parser.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    summary = {}
    ours_grids: list[Path] = []
    for image in args.images:
        rgb = read_rgb(image)
        slug = slugify(image)
        lenses, scores = render_lenses(rgb)
        person_dir = args.out_dir / slug
        person_dir.mkdir(parents=True, exist_ok=True)
        grid_path = person_dir / f"{slug}-visia-style-grid.jpg"
        make_grid(rgb, lenses, grid_path)
        ours_grids.append(grid_path)
        for label, img, _score in lenses:
            save_rgb(person_dir / f"{slug}-{slugify(Path(label))}.png", img)
        summary[slug] = {"grid": str(grid_path), "scores": scores}
    (args.out_dir / "visia-style-summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    make_reference_comparison(args.reference, ours_grids[:2], args.out_dir / "visia-reference-vs-ours-contact-sheet.jpg")
    print(args.out_dir / "visia-reference-vs-ours-contact-sheet.jpg")


if __name__ == "__main__":
    main()
