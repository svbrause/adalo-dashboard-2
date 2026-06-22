#!/usr/bin/env python3
"""Regenerate the progress-tracking demo annotation plates.

This is intentionally demo-specific. It preserves the existing Tanya progress
asset filenames and framing, then improves the baked per-angle lenses used by
the comparison viewer. Wrinkle paths are requested from Gemini on Vertex AI;
pigmentation/redness/pores are rendered locally from the same stills so the
visual style remains deterministic and fast to iterate.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SCRIPT_DIR = ROOT / "scripts"
PUBLIC_3D = ROOT / "public" / "demo-3d"
ANGLES = ("front", "profile-left", "profile-right")


@dataclass(frozen=True)
class ScanSpec:
    key: str
    slug: str
    pigment_strength: float
    redness_strength: float
    pore_strength: float


SCANS = (
    ScanSpec("before", "tanya-progress-aura-before", 1.14, 1.08, 1.03),
    ScanSpec("after", "tanya-progress-aura-after", 0.52, 0.72, 0.86),
)


SIDE_CHEEK_POLYGONS = {
    "profile-left": np.array(
        [(420, 350), (620, 342), (634, 430), (586, 568), (496, 624), (404, 570), (396, 464)],
        dtype=np.int32,
    ),
    "profile-right": np.array(
        [(346, 348), (558, 350), (574, 434), (594, 568), (500, 626), (390, 568), (328, 462)],
        dtype=np.int32,
    ),
}

SIDE_EXCLUSIONS = {
    "profile-left": [
        (590, 338, 720, 462),
        (552, 505, 728, 654),
        (568, 262, 818, 590),
        (120, 220, 410, 700),
        (330, 470, 505, 710),
    ],
    "profile-right": [
        (205, 338, 340, 462),
        (186, 505, 360, 654),
        (132, 262, 388, 590),
        (610, 220, 900, 700),
        (500, 430, 690, 710),
    ],
}


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load {path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


aura = load_module("generate_patient_aura_assets", SCRIPT_DIR / "generate_patient_aura_assets.py")
gemini_wrinkles = load_module("gemini_wrinkle_annotation", SCRIPT_DIR / "gemini_wrinkle_annotation.py")
gemini_wrinkles.FacialWrinkleAnalysis.model_rebuild(
    _types_namespace={
        "WrinklePath": gemini_wrinkles.WrinklePath,
        "Point": gemini_wrinkles.Point,
        "Category": gemini_wrinkles.Category,
    }
)
gemini_wrinkles.FacialSemanticZones.model_rebuild(
    _types_namespace={
        "PolygonZone": gemini_wrinkles.PolygonZone,
        "Point": gemini_wrinkles.Point,
        "ZoneKind": gemini_wrinkles.ZoneKind,
    }
)


def gcloud_project() -> str:
    out = subprocess.check_output(["gcloud", "config", "get-value", "project"], text=True)
    project = out.strip()
    if not project:
        raise RuntimeError("No gcloud project configured")
    return project


def load_rgb(path: Path) -> np.ndarray:
    return np.array(ImageOps.exif_transpose(Image.open(path)).convert("RGB"))


def load_rgba(path: Path) -> np.ndarray:
    return np.array(ImageOps.exif_transpose(Image.open(path)).convert("RGBA"))


def save_rgb(path: Path, rgb: np.ndarray) -> None:
    Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB").save(path, optimize=True)


def save_rgba(path: Path, rgb: np.ndarray, alpha: np.ndarray) -> None:
    rgba = np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), alpha.astype(np.uint8)])
    Image.fromarray(rgba, "RGBA").save(path, optimize=True)


def smoothstep(edge0: float, edge1: float, x: np.ndarray) -> np.ndarray:
    t = np.clip((x - edge0) / max(edge1 - edge0, 1e-6), 0, 1)
    return t * t * (3 - 2 * t)


def grayscale_base(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    subject = alpha > 24
    if int(subject.sum()) > 500:
        lo, hi = np.percentile(gray[subject], (1.0, 99.3))
        gray = (gray - lo) * 235 / max(hi - lo, 1)
        gray = np.clip(gray + 10, 0, 255)
    local = cv2.createCLAHE(clipLimit=1.55, tileGridSize=(8, 8)).apply(gray.astype(np.uint8)).astype(np.float32)
    detailed = gray * 0.62 + local * 0.38
    blur = cv2.GaussianBlur(detailed, (0, 0), 1.05)
    detailed = np.clip(detailed * 1.32 - blur * 0.32, 0, 255)
    out = np.dstack([detailed, detailed, detailed]).astype(np.uint8)
    out[alpha < 8] = 0
    return out


def front_surface(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    h, w = alpha.shape
    yy, xx = np.mgrid[0:h, 0:w]
    x0, y0, x1, y1 = aura.redness_face_bbox(rgb, alpha, "front")
    fw, fh = max(1, x1 - x0), max(1, y1 - y0)
    nx = (xx - x0) / fw
    ny = (yy - y0) / fh
    cheek_l = gaussian(nx, ny, 0.34, 0.55, 0.15, 0.18)
    cheek_r = gaussian(nx, ny, 0.66, 0.55, 0.15, 0.18)
    nose_bridge = gaussian(nx, ny, 0.50, 0.50, 0.075, 0.14)
    forehead = gaussian(nx, ny, 0.50, 0.26, 0.25, 0.10) * 0.42
    surface = np.clip(cheek_l + cheek_r + nose_bridge * 0.34 + forehead, 0, 1)
    surface *= smoothstep(0.14, 0.21, nx) * (1 - smoothstep(0.79, 0.87, nx))
    surface *= smoothstep(0.18, 0.26, ny) * (1 - smoothstep(0.68, 0.76, ny))
    eyes = gaussian(nx, ny, 0.36, 0.39, 0.13, 0.050) + gaussian(nx, ny, 0.64, 0.39, 0.13, 0.050)
    lips = gaussian(nx, ny, 0.50, 0.70, 0.19, 0.050)
    brows = gaussian(nx, ny, 0.36, 0.32, 0.15, 0.045) + gaussian(nx, ny, 0.64, 0.32, 0.15, 0.045)
    nostrils = gaussian(nx, ny, 0.50, 0.59, 0.10, 0.045)
    surface *= 1 - np.clip(0.96 * eyes + 0.98 * lips + 0.85 * brows + 0.72 * nostrils, 0, 0.98)
    return np.clip(surface * (alpha.astype(np.float32) / 255), 0, 1)


def side_surface(shape: tuple[int, int], alpha: np.ndarray, angle: str) -> np.ndarray:
    h, w = shape
    mask = np.zeros((h, w), np.uint8)
    cv2.fillPoly(mask, [SIDE_CHEEK_POLYGONS[angle]], 255)
    for x0, y0, x1, y1 in SIDE_EXCLUSIONS[angle]:
        center = ((x0 + x1) // 2, (y0 + y1) // 2)
        axes = (max(1, (x1 - x0) // 2), max(1, (y1 - y0) // 2))
        cv2.ellipse(mask, center, axes, 0, 0, 360, 0, -1)
    matte = cv2.erode(
        (alpha > 45).astype(np.uint8) * 255,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (17, 17)),
        iterations=1,
    )
    mask = cv2.bitwise_and(mask, matte)
    return cv2.GaussianBlur(mask.astype(np.float32) / 255, (0, 0), 2.0)


def gaussian(x: np.ndarray, y: np.ndarray, cx: float, cy: float, sx: float, sy: float) -> np.ndarray:
    return np.exp(-0.5 * (((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2))


def visual_side_key(spec: ScanSpec, angle: str) -> str:
    """Return the side geometry key for the actual direction shown in the still."""

    if angle == "front":
        return angle
    # The July scan is cross-mapped in the UI to preserve silhouette labels.
    # The September scan stores the opposite profile filename orientation.
    if spec.key == "after":
        return "profile-left" if angle == "profile-right" else "profile-right"
    return angle


def skin_surface(rgb: np.ndarray, alpha: np.ndarray, angle: str) -> np.ndarray:
    roi = front_surface(rgb, alpha) if angle == "front" else side_surface(alpha.shape, alpha, angle)
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    hue, sat, val = cv2.split(hsv)
    r, g, b = rgb[:, :, 0].astype(np.int16), rgb[:, :, 1].astype(np.int16), rgb[:, :, 2].astype(np.int16)
    skin = (
        (roi > 0.06)
        & (sat > 8)
        & (sat < 150)
        & (val > 46)
        & (val < 250)
        & (r >= g - 30)
        & (r >= b - 24)
        & ~(((hue > 142) & (sat > 70)) | ((r > g + 42) & (b > g + 18) & (sat > 108)))
    )
    skin_u8 = cv2.morphologyEx(
        skin.astype(np.uint8) * 255,
        cv2.MORPH_CLOSE,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)),
        iterations=1,
    )
    return np.clip(cv2.GaussianBlur(skin_u8.astype(np.float32) / 255, (0, 0), 1.8) * roi, 0, 1)


def pigment_alpha(rgb: np.ndarray, base: np.ndarray, skin: np.ndarray, *, strength: float, seed: int) -> np.ndarray:
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    l_chan = lab[:, :, 0].astype(np.float32)
    a_chan = lab[:, :, 1].astype(np.float32)
    b_chan = lab[:, :, 2].astype(np.float32)
    gray = cv2.cvtColor(base, cv2.COLOR_RGB2GRAY).astype(np.float32)
    valid = skin > 0.12
    if int(valid.sum()) < 500:
        return np.zeros_like(skin, np.float32)
    local_l = cv2.GaussianBlur(l_chan, (0, 0), 18)
    local_gray = cv2.GaussianBlur(gray, (0, 0), 5.0)
    score = (
        0.82 * np.maximum(local_l - l_chan, 0)
        + 0.42 * np.maximum(local_gray - gray, 0)
        + 0.24 * np.maximum(a_chan - float(np.median(a_chan[valid])), 0)
        + 0.14 * np.maximum(b_chan - float(np.median(b_chan[valid])), 0)
    )
    med_l = float(np.median(l_chan[valid]))
    score[(l_chan < med_l - 34) | (l_chan > med_l + 58)] = 0
    score *= skin
    values = score[valid & (score > 0)]
    if values.size < 120:
        return synthetic_spots(skin, strength=strength, seed=seed)
    low = float(np.percentile(values, max(40, 58 - 10 * (strength - 1))))
    high = float(np.percentile(values, 97.2))
    alpha = np.clip((score - low) / max(high - low, 1e-3), 0, 1)
    alpha = cv2.morphologyEx(
        np.clip(alpha * 255, 0, 255).astype(np.uint8),
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)),
        iterations=1,
    ).astype(np.float32) / 255
    alpha = cv2.GaussianBlur(alpha, (0, 0), 1.0)
    return np.clip(np.maximum(alpha * 0.78 * strength, synthetic_spots(skin, strength=strength, seed=seed) * 0.86), 0, 0.80)


def remove_profile_feature_leakage(alpha: np.ndarray, angle: str) -> np.ndarray:
    """Keep side-profile pigmentation evidence on cheek skin, away from nose/lips/ear."""

    h, w = alpha.shape
    yy, xx = np.mgrid[0:h, 0:w]
    nx = xx.astype(np.float32) / w
    ny = yy.astype(np.float32) / h
    if angle == "profile-left":
        leakage = (
            0.88 * gaussian(nx, ny, 0.585, 0.475, 0.060, 0.135)
            + 0.80 * gaussian(nx, ny, 0.585, 0.565, 0.074, 0.070)
            + 0.55 * gaussian(nx, ny, 0.345, 0.505, 0.070, 0.150)
        )
    elif angle == "profile-right":
        leakage = (
            0.88 * gaussian(nx, ny, 0.415, 0.475, 0.060, 0.135)
            + 0.80 * gaussian(nx, ny, 0.415, 0.565, 0.074, 0.070)
            + 0.55 * gaussian(nx, ny, 0.655, 0.505, 0.070, 0.150)
        )
    else:
        return alpha
    return np.clip(alpha * (1 - np.clip(leakage, 0, 0.94)), 0, 0.80)


def synthetic_spots(skin: np.ndarray, *, strength: float, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    h, w = skin.shape
    ys, xs = np.nonzero(skin > 0.22)
    if xs.size < 500:
        return np.zeros_like(skin, np.float32)
    cx = float(np.median(xs))
    cy = float(np.median(ys) - h * 0.035)
    weights = np.exp(-(((xs - cx) / (w * 0.15)) ** 2 + ((ys - cy) / (h * 0.15)) ** 2))
    weights = weights / max(float(weights.sum()), 1e-6)
    spots = np.zeros((h, w), np.float32)
    count = int(round(88 * strength))
    chosen = rng.choice(xs.size, size=min(count, xs.size), replace=False, p=weights)
    for index in chosen:
        x, y = int(xs[index]), int(ys[index])
        radius = int(rng.integers(1, 4))
        cv2.circle(spots, (x, y), radius, float(rng.uniform(0.20, 0.58)), -1, lineType=cv2.LINE_AA)
    for index in rng.choice(xs.size, size=min(int(7 * strength), xs.size), replace=False, p=weights):
        x, y = int(xs[index]), int(ys[index])
        cv2.ellipse(
            spots,
            (x, y),
            (int(rng.integers(6, 15)), int(rng.integers(2, 7))),
            float(rng.uniform(-35, 35)),
            0,
            360,
            float(rng.uniform(0.16, 0.38)),
            -1,
            lineType=cv2.LINE_AA,
        )
    return np.clip(cv2.GaussianBlur(spots, (0, 0), 0.58) * skin, 0, 0.62)


def overlay_rgb(base: np.ndarray, color: tuple[int, int, int], alpha: np.ndarray) -> np.ndarray:
    a = alpha[:, :, None]
    return np.clip(base.astype(np.float32) * (1 - a) + np.array(color, np.float32) * a, 0, 255).astype(np.uint8)


def centered_side_focus(skin: np.ndarray) -> np.ndarray:
    ys, xs = np.nonzero(skin > 0.12)
    if xs.size < 500:
        return skin
    h, w = skin.shape
    yy, xx = np.mgrid[0:h, 0:w]
    cx = float(np.median(xs)) / w
    cy = float(np.median(ys)) / h
    focus = 0.18 + 0.92 * gaussian(xx / w, yy / h, cx, cy, 0.12, 0.17)
    return np.clip(skin * focus, 0, 1)


def side_redness_mask(rgb: np.ndarray, alpha: np.ndarray, angle: str, strength: float) -> np.ndarray:
    """Side-profile redness should stay on cheek skin, not the naturally red ear."""

    h, w = alpha.shape
    skin = centered_side_focus(skin_surface(rgb, alpha, angle))
    valid = skin > 0.12
    rgba = np.zeros((h, w, 4), np.uint8)
    if int(valid.sum()) < 500:
        return rgba

    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    red_green = lab[:, :, 1].astype(np.float32)
    local_red = cv2.GaussianBlur(red_green, (0, 0), 14.0)
    red_signal = np.maximum(red_green - local_red, 0) * skin
    values = red_signal[valid & (red_signal > 0)]
    if values.size > 80:
        low = float(np.percentile(values, 54))
        high = float(np.percentile(values, 96))
        heat = np.clip((red_signal - low) / max(high - low, 1e-3), 0, 1)
        heat = cv2.GaussianBlur(heat, (0, 0), 5.5) * skin
    else:
        heat = np.zeros((h, w), np.float32)

    cheek_flush = cv2.GaussianBlur(skin, (0, 0), 9.0) * 0.11
    mask_alpha = np.clip((cheek_flush + heat * 0.36) * strength, 0, 0.38)
    mask_alpha = remove_profile_feature_leakage(mask_alpha, angle)
    rgba[:, :, 0] = 255
    rgba[:, :, 1] = 74
    rgba[:, :, 2] = 62
    rgba[:, :, 3] = np.clip(mask_alpha * 255, 0, 255).astype(np.uint8)
    return rgba


def bake_redness(rgb: np.ndarray, alpha: np.ndarray, angle: str, strength: float) -> tuple[np.ndarray, np.ndarray]:
    if angle != "front":
        mask = side_redness_mask(rgb, alpha, angle, strength)
        return aura.bake_redness_image(rgb, mask), mask
    spots = aura.detect_redness_spots(rgb, alpha, angle=angle)
    mask = aura.render_redness_mask(rgb, alpha, angle=angle, spots=spots)
    mask[:, :, 3] = np.clip(mask[:, :, 3].astype(np.float32) * strength, 0, 185).astype(np.uint8)
    return aura.bake_redness_image(rgb, mask), mask


def synthetic_pores(skin: np.ndarray, *, strength: float, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    ys, xs = np.nonzero(skin > 0.18)
    if xs.size < 500:
        return np.zeros_like(skin, np.float32)
    weights = skin[ys, xs].astype(np.float64)
    weights = weights / max(float(weights.sum()), 1e-6)
    pores = np.zeros_like(skin, np.float32)
    count = int(round(185 * strength))
    chosen = rng.choice(xs.size, size=min(count, xs.size), replace=False, p=weights)
    for index in chosen:
        x, y = int(xs[index]), int(ys[index])
        radius = int(rng.integers(1, 3))
        cv2.circle(pores, (x, y), radius, float(rng.uniform(0.18, 0.42)), -1, lineType=cv2.LINE_AA)
    return cv2.GaussianBlur(pores, (0, 0), 0.55) * skin


def side_pore_mask(rgb: np.ndarray, alpha: np.ndarray, angle: str, strength: float, *, seed: int) -> np.ndarray:
    """Side-profile pore lens should read as cheek texture, not ear/neck shadow."""

    h, w = alpha.shape
    skin = skin_surface(rgb, alpha, angle)
    valid = skin > 0.12
    rgba = np.zeros((h, w, 4), np.uint8)
    if int(valid.sum()) < 500:
        return rgba

    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    local_avg = cv2.GaussianBlur(gray, (0, 0), 3.6)
    darkness = np.maximum(local_avg - gray, 0) * skin
    values = darkness[valid & (darkness > 0)]
    if values.size > 120:
        low = float(np.percentile(values, 58))
        high = float(np.percentile(values, 98.7))
        heat = np.clip((darkness - low) / max(high - low, 1e-3), 0, 1)
        heat = cv2.GaussianBlur(heat, (0, 0), 1.15) * skin
    else:
        heat = np.zeros((h, w), np.float32)

    fallback = synthetic_pores(skin, strength=strength, seed=seed)
    mask_alpha = np.clip((heat * 0.56 + fallback * 0.34) * strength, 0, 0.58)
    mask_alpha = remove_profile_feature_leakage(mask_alpha, angle)
    rgba[:, :, 0] = 58
    rgba[:, :, 1] = 34
    rgba[:, :, 2] = 16
    rgba[:, :, 3] = np.clip(mask_alpha * 255, 0, 255).astype(np.uint8)
    return rgba


def bake_pores(
    rgb: np.ndarray,
    alpha: np.ndarray,
    angle: str,
    strength: float,
    *,
    seed: int,
) -> tuple[np.ndarray, np.ndarray]:
    if angle != "front":
        mask = side_pore_mask(rgb, alpha, angle, strength, seed=seed)
        return aura.bake_pore_image(rgb, mask), mask
    mask = aura.render_pore_mask(rgb, alpha, angle=angle)
    mask[:, :, 3] = np.clip(mask[:, :, 3].astype(np.float32) * strength, 0, 175).astype(np.uint8)
    return aura.bake_pore_image(rgb, mask), mask


def gemini_wrinkle_paths(image_path: Path, *, project: str, location: str, model: str) -> Any | None:
    try:
        return gemini_wrinkles.fetch_wrinkle_paths(
            image_path,
            project=project,
            location=location,
            model=model,
        )
    except Exception as exc:
        print(f"[progress-demo] Gemini wrinkles failed for {image_path.name}: {exc}", flush=True)
        return None


def load_cached_wrinkle_paths(path: Path) -> Any | None:
    if not path.exists():
        return None
    try:
        return gemini_wrinkles.FacialWrinkleAnalysis.model_validate_json(path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"[progress-demo] Could not reuse {path.name}: {exc}", flush=True)
        return None


def wrinkle_surface(rgb: np.ndarray, alpha: np.ndarray, angle: str) -> np.ndarray:
    if angle != "front":
        return np.clip(side_surface(alpha.shape, alpha, angle) * 1.22, 0, 1)
    h, w = alpha.shape
    yy, xx = np.mgrid[0:h, 0:w]
    x0, y0, x1, y1 = aura.redness_face_bbox(rgb, alpha, "front")
    fw, fh = max(1, x1 - x0), max(1, y1 - y0)
    nx = (xx - x0) / fw
    ny = (yy - y0) / fh
    face = smoothstep(0.18, 0.25, nx) * (1 - smoothstep(0.75, 0.82, nx))
    face *= smoothstep(0.16, 0.23, ny) * (1 - smoothstep(0.72, 0.82, ny))
    lips = gaussian(nx, ny, 0.50, 0.70, 0.19, 0.060)
    return np.clip(face * (1 - lips * 0.86) * (alpha.astype(np.float32) / 255), 0, 1)


def bake_wrinkles(rgb: np.ndarray, alpha: np.ndarray, analysis: Any | None, angle: str) -> np.ndarray:
    base = grayscale_base(rgb, alpha).astype(np.float32)
    if analysis is None:
        return base.astype(np.uint8)
    overlay = np.array(gemini_wrinkles.render_overlay((rgb.shape[1], rgb.shape[0]), analysis).convert("RGBA"))
    a = overlay[:, :, 3].astype(np.float32) / 255.0
    a = np.clip(a * 0.78, 0, 0.74) * wrinkle_surface(rgb, alpha, angle)
    color = overlay[:, :, :3].astype(np.float32)
    out = base * (1 - a[:, :, None]) + color * a[:, :, None]
    return np.clip(out, 0, 255).astype(np.uint8)


def process_asset(spec: ScanSpec, angle: str, *, project: str, location: str, model: str, skip_gcp: bool) -> dict[str, int]:
    asset_dir = PUBLIC_3D / spec.slug
    stem = f"{spec.slug}-{angle}"
    color_path = asset_dir / f"{stem}-color.png"
    rembg_path = asset_dir / f"{stem}-rembg.png"
    rgb = load_rgb(color_path)
    alpha = load_rgba(rembg_path)[:, :, 3]
    analysis_angle = visual_side_key(spec, angle)
    base = grayscale_base(rgb, alpha)
    skin = skin_surface(rgb, alpha, analysis_angle)

    save_rgba(asset_dir / f"{stem}-texture-cutout.png", base, alpha)
    save_rgb(asset_dir / f"{stem}-texture.png", base)

    p_alpha = pigment_alpha(
        rgb,
        base,
        skin,
        strength=spec.pigment_strength,
        seed=abs(hash((spec.key, angle, "pigment"))) % (2**32),
    )
    if spec.key == "after" and analysis_angle != "front":
        p_alpha = remove_profile_feature_leakage(p_alpha, analysis_angle)
    pigment_rgb = overlay_rgb(base, (88, 52, 104), p_alpha)
    save_rgb(asset_dir / f"{stem}-pigmentation.png", pigment_rgb)
    save_rgba(asset_dir / f"{stem}-pigmentation-cutout.png", pigment_rgb, alpha)

    redness_rgb, redness_mask = bake_redness(rgb, alpha, analysis_angle, spec.redness_strength)
    save_rgba(asset_dir / f"{stem}-redness-mask.png", redness_mask[:, :, :3], redness_mask[:, :, 3])
    save_rgba(asset_dir / f"{stem}-redness-cutout.png", redness_rgb, alpha)

    pores_rgb, pore_mask = bake_pores(
        rgb,
        alpha,
        analysis_angle,
        spec.pore_strength,
        seed=abs(hash((spec.key, angle, "pores"))) % (2**32),
    )
    save_rgba(asset_dir / f"{stem}-pore-mask.png", pore_mask[:, :, :3], pore_mask[:, :, 3])
    save_rgba(asset_dir / f"{stem}-pores-cutout.png", pores_rgb, alpha)

    wrinkle_json_path = asset_dir / f"{stem}-wrinkles-gemini-analysis.json"
    analysis = (
        load_cached_wrinkle_paths(wrinkle_json_path)
        if skip_gcp
        else gemini_wrinkle_paths(color_path, project=project, location=location, model=model)
    )
    if analysis is not None:
        wrinkle_json_path.write_text(
            analysis.model_dump_json(indent=2),
            encoding="utf-8",
        )
    wrinkles_rgb = bake_wrinkles(rgb, alpha, analysis, analysis_angle)
    save_rgba(asset_dir / f"{stem}-wrinkles-view.png", wrinkles_rgb, alpha)

    return {
        "pigment_px": int((p_alpha > 0.04).sum()),
        "redness_px": int((redness_mask[:, :, 3] > 6).sum()),
        "pore_px": int((pore_mask[:, :, 3] > 6).sum()),
        "wrinkle_paths": len(getattr(analysis, "wrinkle_paths", []) or []),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", default=None)
    parser.add_argument("--location", default="us-central1")
    parser.add_argument("--model", default="gemini-2.5-pro")
    parser.add_argument("--skip-gcp", action="store_true")
    args = parser.parse_args()
    project = args.project or gcloud_project()

    summary: dict[str, dict[str, dict[str, int]]] = {}
    for spec in SCANS:
        summary[spec.key] = {}
        for angle in ANGLES:
            summary[spec.key][angle] = process_asset(
                spec,
                angle,
                project=project,
                location=args.location,
                model=args.model,
                skip_gcp=args.skip_gcp,
            )
            print(f"{spec.key} {angle} {summary[spec.key][angle]}", flush=True)

    out = PUBLIC_3D / "tanya-progress-annotation-regeneration-summary.json"
    out.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
