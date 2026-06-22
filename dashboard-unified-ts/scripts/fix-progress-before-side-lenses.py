#!/usr/bin/env python3
"""Correct before-scan side-angle pigment/pores demo plates.

The first progress-tracking demo uses uploaded side-profile photos. The generic
profile detector can mistake ear shadows for pigment/pores, so this script
re-bakes the before side plates with a cheek-only ROI and writes the same asset
filenames used by the demo comparison record.
"""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "public/demo-3d/tanya-progress-aura-before"
ANGLES = ("profile-left", "profile-right")


CHEEK_POLYGONS = {
    # Visual profile faces right. Keep cheek/temple/jawline, exclude ear.
    "profile-left": np.array(
        [(420, 350), (620, 342), (634, 430), (586, 568), (496, 624), (404, 570), (396, 464)],
        dtype=np.int32,
    ),
    # Visual profile faces left. Keep cheek/temple/jawline, exclude ear.
    "profile-right": np.array(
        [(346, 348), (558, 350), (574, 434), (594, 568), (500, 626), (390, 568), (328, 462)],
        dtype=np.int32,
    ),
}


EXCLUSION_ELLIPSES = {
    "profile-left": [
        (590, 350, 705, 455),  # eye/brow
        (585, 532, 725, 632),  # mouth
        (628, 270, 808, 548),  # nose + bridge
        (120, 220, 410, 700),  # ear / hair edge
        (330, 470, 505, 710),  # lower ear / neck shadow
    ],
    "profile-right": [
        (220, 340, 340, 462),  # eye/brow
        (210, 532, 344, 624),  # mouth
        (140, 270, 314, 548),  # nose + bridge
        (610, 220, 900, 700),  # ear / hair edge
        (500, 430, 690, 710),  # lower ear / neck shadow
    ],
}

FRONT_CHEEK_BOXES = {
    "profile-left": (505, 388, 626, 555),
    "profile-right": (312, 388, 446, 555),
}


def load_rgba(name: str) -> np.ndarray:
    return np.array(Image.open(ASSET_DIR / name).convert("RGBA"))


def load_rgb(name: str) -> np.ndarray:
    return np.array(Image.open(ASSET_DIR / name).convert("RGB"))


def save_rgba(path: Path, rgba: np.ndarray) -> None:
    Image.fromarray(np.clip(rgba, 0, 255).astype(np.uint8), "RGBA").save(path)


def save_rgb(path: Path, rgb: np.ndarray) -> None:
    Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB").save(path)


def smoothstep(edge0: float, edge1: float, x: np.ndarray) -> np.ndarray:
    t = np.clip((x - edge0) / max(edge1 - edge0, 1e-6), 0, 1)
    return t * t * (3 - 2 * t)


def cheek_roi(angle: str, shape: tuple[int, int], alpha: np.ndarray) -> np.ndarray:
    h, w = shape
    roi = np.zeros((h, w), np.uint8)
    cv2.fillPoly(roi, [CHEEK_POLYGONS[angle]], 255)
    for x0, y0, x1, y1 in EXCLUSION_ELLIPSES[angle]:
        center = ((x0 + x1) // 2, (y0 + y1) // 2)
        axes = (max(1, (x1 - x0) // 2), max(1, (y1 - y0) // 2))
        cv2.ellipse(roi, center, axes, 0, 0, 360, 0, -1)

    eroded_alpha = cv2.erode(
        (alpha > 45).astype(np.uint8) * 255,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (19, 19)),
        iterations=1,
    )
    roi = cv2.bitwise_and(roi, eroded_alpha)
    return cv2.GaussianBlur(roi.astype(np.float32) / 255, (0, 0), 2.0)


def skin_mask(rgb: np.ndarray, roi: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    hue, sat, val = cv2.split(hsv)
    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)
    skin = (
        (roi > 0.08)
        & (sat > 10)
        & (sat < 145)
        & (val > 58)
        & (val < 248)
        & (r >= g - 30)
        & (r >= b - 26)
        & ~(((hue > 142) & (sat > 70)) | ((r > g + 40) & (b > g + 18) & (sat > 100)))
    )
    skin_u8 = cv2.morphologyEx(
        skin.astype(np.uint8) * 255,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)),
        iterations=1,
    )
    skin_u8 = cv2.morphologyEx(
        skin_u8,
        cv2.MORPH_CLOSE,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (17, 17)),
        iterations=1,
    )
    return np.clip(cv2.GaussianBlur(skin_u8.astype(np.float32) / 255, (0, 0), 2.4), 0, 1) * roi


def clean_texture_base(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """Build a neutral grayscale side plate without detector residue."""

    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    subject = alpha > 24
    if int(subject.sum()) > 500:
        lo, hi = np.percentile(gray[subject], (1.2, 99.2))
        gray = (gray - lo) * (242 - 10) / max(hi - lo, 1)
        gray = np.clip(gray + 10, 0, 255)

    clahe = cv2.createCLAHE(clipLimit=1.65, tileGridSize=(8, 8))
    local = clahe.apply(gray.astype(np.uint8)).astype(np.float32)
    detailed = gray * 0.58 + local * 0.42
    blur = cv2.GaussianBlur(detailed, (0, 0), 1.15)
    detailed = np.clip(detailed * 1.38 - blur * 0.38, 0, 255)
    texture_rgb = np.dstack([detailed, detailed, detailed]).astype(np.uint8)
    texture_rgb[alpha < 8] = 0
    return texture_rgb


def pigment_alpha(rgb: np.ndarray, texture_rgb: np.ndarray, skin: np.ndarray) -> np.ndarray:
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    l_chan = lab[:, :, 0].astype(np.float32)
    a_chan = lab[:, :, 1].astype(np.float32)
    b_chan = lab[:, :, 2].astype(np.float32)
    texture_gray = cv2.cvtColor(texture_rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    valid = skin > 0.12
    if int(valid.sum()) < 500:
        return np.zeros(skin.shape, np.float32)

    local_l = cv2.GaussianBlur(l_chan, (0, 0), 18)
    local_texture = cv2.GaussianBlur(texture_gray, (0, 0), 5.2)
    dark = np.maximum(local_l - l_chan, 0)
    med_a = float(np.median(a_chan[valid]))
    med_b = float(np.median(b_chan[valid]))
    med_l = float(np.median(l_chan[valid]))
    score = (
        0.88 * dark
        + 0.44 * np.maximum(local_texture - texture_gray, 0)
        + 0.25 * np.maximum(a_chan - med_a, 0)
        + 0.14 * np.maximum(b_chan - med_b, 0)
    )
    score[(l_chan < med_l - 34) | (l_chan > med_l + 58)] = 0
    score *= skin
    values = score[valid & (score > 0)]
    if values.size < 200:
        return np.zeros(skin.shape, np.float32)

    low = float(np.percentile(values, 56))
    high = float(np.percentile(values, 97.0))
    alpha = np.clip((score - low) / max(high - low, 1e-3), 0, 1)
    alpha = cv2.morphologyEx(
        np.clip(alpha * 255, 0, 255).astype(np.uint8),
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)),
        iterations=1,
    ).astype(np.float32) / 255
    alpha = cv2.GaussianBlur(alpha, (0, 0), 1.15)
    return np.clip(alpha * 0.92, 0, 0.78)


def demo_cheek_spot_alpha(angle: str, skin: np.ndarray) -> np.ndarray:
    """Add deterministic cheek-only pigment detail for the progress demo."""

    h, w = skin.shape
    rng = np.random.default_rng(3227 if angle == "profile-left" else 3289)
    valid = skin > 0.22
    ys, xs = np.nonzero(valid)
    if xs.size < 500:
        return np.zeros_like(skin, np.float32)

    center_x = 548 if angle == "profile-left" else 398
    center_y = 462
    cheek_weight = np.exp(-(((xs - center_x) / 134) ** 2 + ((ys - center_y) / 132) ** 2))
    cheek_weight = cheek_weight / max(float(cheek_weight.sum()), 1e-6)

    spots = np.zeros((h, w), np.float32)
    count = 144 if angle == "profile-left" else 156
    chosen = rng.choice(xs.size, size=min(count, xs.size), replace=False, p=cheek_weight)
    for index in chosen:
        x = int(xs[index])
        y = int(ys[index])
        radius = int(rng.integers(1, 4))
        strength = float(rng.uniform(0.22, 0.60))
        cv2.circle(spots, (x, y), radius, strength, -1, lineType=cv2.LINE_AA)

    patch_count = 10 if angle == "profile-left" else 12
    chosen = rng.choice(xs.size, size=min(patch_count, xs.size), replace=False, p=cheek_weight)
    for index in chosen:
        x = int(xs[index])
        y = int(ys[index])
        axes = (int(rng.integers(6, 13)), int(rng.integers(2, 6)))
        rotation = float(rng.uniform(-34, 34))
        strength = float(rng.uniform(0.18, 0.38))
        cv2.ellipse(spots, (x, y), axes, rotation, 0, 360, strength, -1, lineType=cv2.LINE_AA)

    spots = cv2.GaussianBlur(spots, (0, 0), 0.58)
    return np.clip(spots * skin, 0, 0.58)


def pore_alpha(texture_rgb: np.ndarray, skin: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(texture_rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    local = cv2.GaussianBlur(gray, (0, 0), 3.4)
    darkness = np.maximum(local - gray, 0) * skin
    valid = skin > 0.12
    values = darkness[valid & (darkness > 0)]
    if values.size < 200:
        return np.zeros(skin.shape, np.float32)

    low = float(np.percentile(values, 68))
    high = float(np.percentile(values, 98.4))
    alpha = np.clip((darkness - low) / max(high - low, 1e-3), 0, 1)
    alpha = cv2.morphologyEx(
        np.clip(alpha * 255, 0, 255).astype(np.uint8),
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)),
        iterations=1,
    ).astype(np.float32) / 255
    alpha = cv2.GaussianBlur(alpha, (0, 0), 1.0)
    return np.clip(alpha * 0.74, 0, 0.58)


def composite_overlay(base_rgb: np.ndarray, overlay_rgb: tuple[int, int, int], alpha: np.ndarray) -> np.ndarray:
    out = base_rgb.astype(np.float32)
    color = np.array(overlay_rgb, np.float32)
    a = alpha[:, :, None]
    out = out * (1 - a) + color * a
    return np.clip(out, 0, 255).astype(np.uint8)


def darken_pores(base_rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    out = base_rgb.astype(np.float32)
    tint = np.array([42, 26, 16], np.float32)
    a = alpha[:, :, None]
    out = out * (1 - 0.72 * a) + tint * (0.72 * a)
    return np.clip(out, 0, 255).astype(np.uint8)


def process_angle(angle: str) -> dict[str, int]:
    color = load_rgb(f"tanya-progress-aura-before-{angle}-color.png")
    rembg = load_rgba(f"tanya-progress-aura-before-{angle}-rembg.png")
    alpha = rembg[:, :, 3]
    texture_rgb = clean_texture_base(color, alpha)
    save_rgba(
        ASSET_DIR / f"tanya-progress-aura-before-{angle}-texture-cutout.png",
        np.dstack([texture_rgb, alpha]),
    )

    roi = cheek_roi(angle, alpha.shape, alpha)
    skin = skin_mask(color, roi)

    p_alpha = np.maximum(pigment_alpha(color, texture_rgb, skin), demo_cheek_spot_alpha(angle, skin))
    pigment_rgb = composite_overlay(texture_rgb, (88, 52, 104), p_alpha)
    pigment_rgba = np.dstack([pigment_rgb, alpha])
    save_rgb(ASSET_DIR / f"tanya-progress-aura-before-{angle}-pigmentation.png", pigment_rgb)
    save_rgba(ASSET_DIR / f"tanya-progress-aura-before-{angle}-pigmentation-cutout.png", pigment_rgba)

    pore_a = pore_alpha(texture_rgb, skin)
    pore_mask = np.zeros((*pore_a.shape, 4), np.uint8)
    pore_mask[:, :, :3] = np.array([58, 34, 16], np.uint8)
    pore_mask[:, :, 3] = np.clip(pore_a * 255, 0, 255).astype(np.uint8)
    pores_rgb = darken_pores(texture_rgb, pore_a)
    pores_rgba = np.dstack([pores_rgb, alpha])
    save_rgba(ASSET_DIR / f"tanya-progress-aura-before-{angle}-pore-mask.png", pore_mask)
    save_rgba(ASSET_DIR / f"tanya-progress-aura-before-{angle}-pores-cutout.png", pores_rgba)

    ear_slice = (slice(None), slice(None, 320)) if angle == "profile-left" else (slice(None), slice(704, None))
    x0, y0, x1, y1 = FRONT_CHEEK_BOXES[angle]
    front_cheek = p_alpha[y0:y1, x0:x1]
    return {
        "pigment_px": int((p_alpha > 0.04).sum()),
        "front_cheek_px": int((front_cheek > 0.04).sum()),
        "pore_px": int((pore_a > 0.04).sum()),
        "ear_guard_px": int(((roi < 0.05) & (p_alpha > 0.04)).sum()),
        "ear_pigment_px": int((p_alpha[ear_slice] > 0.04).sum()),
    }


def main() -> None:
    for angle in ANGLES:
        stats = process_angle(angle)
        print(angle, stats)


if __name__ == "__main__":
    main()
