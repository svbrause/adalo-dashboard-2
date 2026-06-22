#!/usr/bin/env python3
"""Apply an Aura-style pigmentation texture treatment to the turntable video.

This is a demo visual pass, not a diagnostic detector. It keeps the black
background, converts visible skin into a flattened clinical grayscale/brown
texture, and overlays high-frequency pigment flecks frame by frame.
"""

from __future__ import annotations

import argparse
import importlib.util
import subprocess
import tempfile
import threading
from pathlib import Path
from typing import Any

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT = ROOT / "src/assets/images/turntable_2048_black.mp4"
DEFAULT_GRAY = ROOT / "src/assets/images/turntable_2048_black_pigmentation_gray.mp4"
DEFAULT_BROWN = ROOT / "src/assets/images/turntable_2048_black_pigmentation_brown.mp4"
DEFAULT_WRINKLES_1024 = ROOT / "src/assets/images/turntable_1024_black_wrinkles_scrub.mp4"
DEFAULT_INPUT_1024 = ROOT / "src/assets/images/turntable_1024_black_scrub.mp4"

LUMINANCE_VISIBLE_THRESH = 10

_cv_assets_mod: Any | None = None
_aura_assets_mod: Any | None = None
_cv_assets_lock = threading.Lock()
_aura_assets_lock = threading.Lock()


def _gaussian_2d(
    nx: np.ndarray,
    ny: np.ndarray,
    cx: float,
    cy: float,
    sx: float,
    sy: float,
) -> np.ndarray:
    return np.exp(-0.5 * (((nx - cx) / sx) ** 2 + ((ny - cy) / sy) ** 2))


def _cv_assets() -> Any:
    global _cv_assets_mod
    if _cv_assets_mod is None:
        with _cv_assets_lock:
            if _cv_assets_mod is None:
                spec = importlib.util.spec_from_file_location(
                    "aura_cv_assets",
                    SCRIPT_DIR / "generate-aura-cv-assets.py",
                )
                if spec is None or spec.loader is None:
                    raise ImportError("Cannot load generate-aura-cv-assets.py")
                mod = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(mod)
                _cv_assets_mod = mod
    return _cv_assets_mod


def _aura_assets() -> Any:
    global _aura_assets_mod
    if _aura_assets_mod is None:
        with _aura_assets_lock:
            if _aura_assets_mod is None:
                spec = importlib.util.spec_from_file_location(
                    "aura_patient_assets",
                    SCRIPT_DIR / "generate_patient_aura_assets.py",
                )
                if spec is None or spec.loader is None:
                    raise ImportError("Cannot load generate_patient_aura_assets.py")
                mod = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(mod)
                _aura_assets_mod = mod
    return _aura_assets_mod


def estimate_bbox(rgb: np.ndarray) -> tuple[int, int, int, int]:
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    ys, xs = np.where(gray > 25)
    h, w = rgb.shape[:2]
    if xs.size == 0:
        return (w // 4, h // 8, w // 2, h // 2)
    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    return (x0, y0, max(1, x1 - x0), max(1, y1 - y0))


def is_flat_studio_backdrop(gray: np.ndarray, person: np.ndarray) -> bool:
    """Detect mid-gray seamless paper/backdrop using uniform corner regions."""
    h, w = gray.shape
    pad_y, pad_x = max(8, h // 12), max(8, w // 12)
    regions = (
        (slice(0, pad_y), slice(0, pad_x)),
        (slice(0, pad_y), slice(-pad_x, None)),
        (slice(-pad_y, None), slice(0, pad_x)),
        (slice(-pad_y, None), slice(-pad_x, None)),
    )
    flat_corners = 0
    for ys, xs in regions:
        patch_person = person[ys, xs]
        patch_gray = gray[ys, xs]
        if float(patch_person.mean()) > 0.15:
            continue
        if 40 < float(patch_gray.mean()) < 220 and float(patch_gray.std()) < 20:
            flat_corners += 1
    return flat_corners >= 2


def person_alpha(rgb: np.ndarray) -> np.ndarray:
    """GrabCut person matte — removes studio backgrounds from intake photos."""
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    alpha_u8 = _cv_assets().segment_person(bgr, estimate_bbox(rgb))
    # Slight expand so profile nose tips stay inside the matte.
    alpha_u8 = cv2.dilate(
        alpha_u8,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)),
        1,
    )
    return alpha_u8.astype(np.float32) / 255.0


def raw_turntable_visible(gray: np.ndarray) -> np.ndarray:
    """Pixels lit in the source turntable plate (same basis as the raw 3D export)."""
    return (gray > LUMINANCE_VISIBLE_THRESH).astype(np.float32)


def neck_fade_visible(visible: np.ndarray) -> np.ndarray:
    """Fade neck/chest below the face; never trim horizontal profile extremes."""
    ys, xs = np.where(visible > 0.5)
    if xs.size == 0:
        return visible
    y0, y1 = int(ys.min()), int(ys.max())
    bh = max(1, y1 - y0)
    neck_y = y0 + int(0.90 * bh)
    out = visible.copy()
    out[neck_y:, :] *= 0.12
    return out


def composite_matte(rgb: np.ndarray, subject: np.ndarray, *, turntable_fast: bool = False) -> np.ndarray:
    """Alpha matte for gray/brown encode on pure black."""
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    raw = neck_fade_visible(raw_turntable_visible(gray))
    subj = np.clip(subject.astype(np.float32) / 255.0, 0, 1)

    if turntable_fast:
        # FaceLift turntable on a black plate — luminance matte only (skip GrabCut per frame).
        return np.clip(np.maximum(subj, raw), 0, 1)

    person = person_alpha(rgb)

    if is_flat_studio_backdrop(gray, person):
        # Intake photo on a gray seamless — drop backdrop via GrabCut matte.
        return np.clip(person, 0, 1)

    # Turntable / dark plate: union person + luminance so profile nose never clips.
    return np.clip(np.maximum(np.maximum(person, subj), raw), 0, 1)


def subject_mask(rgb: np.ndarray, *, exclude_neck: bool = True) -> np.ndarray:
    """Soft silhouette for skin detection / neck cleanup (not the final crop boundary)."""
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    mask = (gray > LUMINANCE_VISIBLE_THRESH).astype(np.uint8) * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)), 1)

    if exclude_neck:
        ys, xs = np.where(mask > 24)
        if xs.size > 0:
            y0, y1 = int(ys.min()), int(ys.max())
            bh = max(1, y1 - y0)
            neck_y = y0 + int(0.90 * bh)
            mask[neck_y:, :] = 0

    return cv2.GaussianBlur(mask, (0, 0), 2.0)


def skin_mask(rgb: np.ndarray, subject: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    h, s, v = cv2.split(hsv)
    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)

    skin = (
        (subject > 20)
        & (v > 58)
        & (v < 242)
        & (s > 12)
        & (s < 135)
        & ((h < 28) | (h > 168))
        & (r > b - 8)
        & (g > b - 38)
    )
    mask = skin.astype(np.uint8) * 255
    ys, xs = np.where(subject > 20)
    if xs.size:
        x0, x1 = int(xs.min()), int(xs.max())
        y0, y1 = int(ys.min()), int(ys.max())
        bw = max(1, x1 - x0)
        bh = max(1, y1 - y0)
        pigment_roi = np.zeros_like(mask)
        # Wider face pigment zone — aligned with detect_pigment_spots cheek ROI.
        cv2.rectangle(
            pigment_roi,
            (x0 + int(0.16 * bw), y0 + int(0.28 * bh)),
            (x0 + int(0.84 * bw), y0 + int(0.72 * bh)),
            255,
            -1,
        )
        mask = cv2.bitwise_and(mask, pigment_roi)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)), 1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21)), 1)
    return cv2.GaussianBlur(mask, (0, 0), 2.5)


def clinical_base(rgb: np.ndarray, matte: np.ndarray, palette: str) -> np.ndarray:
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    blur = cv2.GaussianBlur(gray, (0, 0), 34)
    flat = cv2.divide(gray, np.maximum(blur, 1), scale=136)
    flat = cv2.createCLAHE(clipLimit=1.45, tileGridSize=(8, 8)).apply(flat)
    flat = np.clip(flat.astype(np.float32) * 0.72 + gray.astype(np.float32) * 0.28, 0, 255).astype(np.uint8)

    if palette == "brown":
        low = np.array([42, 32, 27], np.float32)
        high = np.array([226, 206, 188], np.float32)
        base = low + (flat[:, :, None].astype(np.float32) / 255.0) * (high - low)
    else:
        base = np.repeat(flat[:, :, None], 3, axis=2).astype(np.float32)

    alpha = matte[:, :, None]
    out = base * alpha
    return out.astype(np.uint8)


def pigment_overlay(rgb: np.ndarray, skin: np.ndarray, palette: str) -> tuple[np.ndarray, np.ndarray]:
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    l = lab[:, :, 0].astype(np.float32)
    a = lab[:, :, 1].astype(np.float32)
    b = lab[:, :, 2].astype(np.float32)
    local_l = cv2.GaussianBlur(l, (0, 0), 21)
    dark = np.maximum(local_l - l, 0)

    valid = skin > 24
    overlay = np.zeros((*l.shape, 3), np.float32)
    alpha = np.zeros(l.shape, np.float32)
    if valid.sum() < 500:
        return overlay.astype(np.uint8), alpha

    med_l = float(np.median(l[valid]))
    grad_x = cv2.Sobel(l, cv2.CV_32F, 1, 0, ksize=3)
    grad_y = cv2.Sobel(l, cv2.CV_32F, 0, 1, ksize=3)
    edge = cv2.magnitude(grad_x, grad_y)
    valid = valid & (l > med_l - 18) & (l < med_l + 72) & (edge < 42)
    valid = cv2.morphologyEx(valid.astype(np.uint8) * 255, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)), 1) > 0
    if valid.sum() < 500:
        return overlay.astype(np.uint8), alpha

    def scaled(x: np.ndarray) -> np.ndarray:
        med = float(np.median(x[valid]))
        p84 = float(np.percentile(x[valid], 84))
        return np.clip((x - med) / max(p84 - med, 1.0), 0, 4)

    score = 0.54 * scaled(dark) + 0.32 * scaled(a) + 0.14 * scaled(b)
    score[~valid] = 0
    score = cv2.GaussianBlur(score, (0, 0), 0.8)

    if palette == "gray":
        fleck_thresh, fleck_scale = 0.75, 1.35
        diffuse_thresh, diffuse_scale = 0.48, 2.0
        noise_cutoff = 0.35
    else:
        fleck_thresh, fleck_scale = 1.2, 1.75
        diffuse_thresh, diffuse_scale = 0.7, 2.4
        noise_cutoff = 0.47

    flecks = np.clip((score - fleck_thresh) / fleck_scale, 0, 1)
    diffuse = np.clip((score - diffuse_thresh) / diffuse_scale, 0, 1)
    diffuse = cv2.GaussianBlur(diffuse, (0, 0), 4.5)

    # Keep the signal stippled like the Aura reference rather than blob-like.
    noise = cv2.GaussianBlur(np.random.default_rng(42).random(l.shape).astype(np.float32), (0, 0), 0.8)
    flecks = flecks * (noise > noise_cutoff)

    if palette == "brown":
        diffuse_color = np.array([120, 74, 43], np.float32)
        fleck_color = np.array([74, 42, 26], np.float32)
        alpha = np.clip(diffuse * 0.16 + flecks * 0.72, 0, 0.78)
    else:
        diffuse_color = np.array([142, 94, 214], np.float32)
        fleck_color = np.array([82, 44, 148], np.float32)
        alpha = np.clip(diffuse * 0.12 + flecks * 0.88, 0, 0.86)

    overlay[:] = diffuse_color
    strong = flecks > 0.08
    overlay[strong] = fleck_color
    alpha *= skin.astype(np.float32) / 255.0
    return overlay.astype(np.uint8), alpha


def bake_cv_spots(
    out: np.ndarray,
    rgb: np.ndarray,
    matte: np.ndarray,
    *,
    angle: str,
    palette: str,
    person_u8: np.ndarray | None = None,
) -> np.ndarray:
    """Stamp detect_pigment_spots ellipses into the gray texture."""
    if palette != "gray":
        return out

    aura = _aura_assets()
    if person_u8 is None:
        person_u8 = (person_alpha(rgb) * 255).astype(np.uint8)
    spots = aura.detect_pigment_spots(rgb, person_u8, angle=angle, max_spots=36)
    if not spots:
        return out

    h, w = rgb.shape[:2]
    bbox = aura.face_bbox_from_alpha(person_u8)
    x0, y0, x1, y1 = bbox
    fw = max(1, x1 - x0)
    fh = max(1, y1 - y0)
    fleck_color = np.array([82, 44, 148], np.float32)

    spot_alpha = np.zeros((h, w), np.float32)
    for spot in spots:
        cx = x0 + (spot["cx"] / 100.0) * fw
        cy = y0 + (spot["cy"] / 100.0) * fh
        rx = max(2.0, spot["rx"] / 100.0 * fw * 1.35)
        ry = max(2.0, spot["ry"] / 100.0 * fh * 1.35)
        strength = float(0.42 + 0.38 * spot.get("intensity", 0.8))
        cv2.ellipse(
            spot_alpha,
            (int(round(cx)), int(round(cy))),
            (int(round(rx)), int(round(ry))),
            0,
            0,
            360,
            strength,
            -1,
        )

    spot_alpha = cv2.GaussianBlur(spot_alpha, (0, 0), 1.2)
    spot_alpha = np.clip(spot_alpha * matte, 0, 0.82)
    return out * (1 - spot_alpha[:, :, None]) + fleck_color * spot_alpha[:, :, None]


def infer_turntable_angle(index: int, total: int) -> str:
    if total <= 1:
        return "front"
    ratio = index / max(total - 1, 1)
    if ratio >= 0.92:
        return "profile-left"
    if ratio <= 0.08:
        return "profile-right"
    if ratio >= 0.72:
        return "three-quarter-left"
    if ratio <= 0.28:
        return "three-quarter-right"
    return "front"


def _redness_frame(bgr: np.ndarray) -> np.ndarray:
    """Bake redness detection into a single turntable frame (black background)."""
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    # Visible-pixel mask: turntable has pure black background.
    visible = np.clip(cv2.GaussianBlur((gray > 22).astype(np.float32), (0, 0), 2.0), 0, 1)
    valid = visible > 0.25
    if int(valid.sum()) < 400:
        return bgr
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    a_chan = lab[:, :, 1].astype(np.float32)
    thresh = float(np.percentile(a_chan[valid], 65))
    peak = float(np.percentile(a_chan[valid], 99))
    heat = np.clip((a_chan - thresh) / max(peak - thresh, 1e-3), 0, 1) * visible
    heat = cv2.GaussianBlur(heat, (0, 0), 4.0)
    eff = np.clip(heat * 0.80, 0, 0.70)
    result = rgb.astype(np.float32)
    result[:, :, 0] = np.clip(rgb[:, :, 0] * (1 - eff * 0.08) + 215 * eff * 0.92, 0, 255)
    result[:, :, 1] = np.clip(rgb[:, :, 1] * (1 - eff * 0.66) + 55 * eff * 0.34, 0, 255)
    result[:, :, 2] = np.clip(rgb[:, :, 2] * (1 - eff * 0.62) + 45 * eff * 0.38, 0, 255)
    # Keep pure-black background untouched.
    bg_mask = (1 - visible)[:, :, None]
    result = result * (1 - bg_mask)
    return cv2.cvtColor(np.clip(result, 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR)


def _pores_frame(bgr: np.ndarray) -> np.ndarray:
    """Bake pore detection into a single turntable frame (black background)."""
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    visible = np.clip(cv2.GaussianBlur((gray > 22).astype(np.float32), (0, 0), 2.0), 0, 1)
    valid = visible > 0.25
    if int(valid.sum()) < 400:
        return bgr
    local_avg = cv2.GaussianBlur(gray, (0, 0), 4.0)
    darkness = np.maximum(local_avg - gray, 0.0) * visible
    thresh = float(np.percentile(darkness[valid], 65))
    peak = float(np.percentile(darkness[valid], 99))
    heat = np.clip((darkness - thresh) / max(peak - thresh, 1e-3), 0, 1) * visible
    heat = cv2.GaussianBlur(heat, (0, 0), 1.5)
    eff = np.clip(heat * 1.40, 0, 0.82)
    # Use neutral grayscale base (avoids colour artifacts from clinical processing).
    gray_rgb = np.stack([gray, gray, gray], axis=-1)
    lightness = (1 - eff * 0.82)[:, :, None]
    result = gray_rgb * lightness * visible[:, :, None]
    return cv2.cvtColor(np.clip(result, 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR)


def _wrinkle_frame(bgr: np.ndarray, angle: str, *, turntable_fast: bool = False) -> np.ndarray:
    """Bake wrinkle/crease detection into a turntable frame (black background).

    Uses blackhat morphology on the luminance channel — fully per-pixel, no
    landmark detection required, so it works at every turntable angle and never
    flickers from failed face detection. Creases appear as a teal clinical
    overlay consistent with the generated still-photo wrinkle palette.
    """
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    subject = subject_mask(rgb)
    matte = composite_matte(rgb, subject, turntable_fast=turntable_fast)

    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    hue, sat, val = cv2.split(hsv)
    red = rgb[:, :, 0].astype(np.int16)
    green = rgb[:, :, 1].astype(np.int16)
    blue = rgb[:, :, 2].astype(np.int16)
    skin_chroma = (
        (subject > 20)
        & (val > 50)
        & (val < 246)
        & (sat > 10)
        & (sat < 150)
        & ((hue < 30) | (hue > 165))
        & (red >= green - 28)
        & (red >= blue - 18)
        & (green >= blue - 42)
    ).astype(np.uint8) * 255
    ys, xs = np.where(subject > 20)
    zone_prior = np.ones_like(gray, dtype=np.float32)
    if xs.size:
        h, w = gray.shape
        x0, x1 = int(xs.min()), int(xs.max())
        y0, y1 = int(ys.min()), int(ys.max())
        bw, bh = max(1, x1 - x0), max(1, y1 - y0)
        face_roi = np.zeros((h, w), np.uint8)
        if angle == "profile-right":
            rx0, rx1 = 0.36, 0.92
        elif angle == "profile-left":
            rx0, rx1 = 0.08, 0.64
        elif angle == "three-quarter-right":
            rx0, rx1 = 0.22, 0.86
        elif angle == "three-quarter-left":
            rx0, rx1 = 0.14, 0.78
        else:
            rx0, rx1 = 0.22, 0.78
        cv2.rectangle(
            face_roi,
            (x0 + int(rx0 * bw), y0 + int(0.13 * bh)),
            (x0 + int(rx1 * bw), y0 + int(0.82 * bh)),
            255,
            -1,
        )
        skin_chroma = cv2.bitwise_and(skin_chroma, face_roi)

        yy, xx = np.mgrid[0:h, 0:w]
        nx = (xx - x0) / bw
        ny = (yy - y0) / bh
        forehead = _gaussian_2d(nx, ny, 0.50, 0.28, 0.23, 0.060)
        under_eye = _gaussian_2d(nx, ny, 0.36, 0.45, 0.13, 0.050) + _gaussian_2d(nx, ny, 0.64, 0.45, 0.13, 0.050)
        crows = _gaussian_2d(nx, ny, 0.23, 0.43, 0.11, 0.070) + _gaussian_2d(nx, ny, 0.77, 0.43, 0.11, 0.070)
        nasolabial = _gaussian_2d(nx, ny, 0.40, 0.61, 0.10, 0.095) + _gaussian_2d(nx, ny, 0.60, 0.61, 0.10, 0.095)
        marionette = _gaussian_2d(nx, ny, 0.42, 0.73, 0.10, 0.070) + _gaussian_2d(nx, ny, 0.58, 0.73, 0.10, 0.070)
        chin = _gaussian_2d(nx, ny, 0.50, 0.80, 0.16, 0.045)
        zone_prior = np.clip(forehead + under_eye + crows + nasolabial + marionette + chin, 0.0, 1.0).astype(np.float32)

        brows = _gaussian_2d(nx, ny, 0.35, 0.38, 0.20, 0.070) + _gaussian_2d(nx, ny, 0.65, 0.38, 0.20, 0.070)
        eyes = _gaussian_2d(nx, ny, 0.35, 0.43, 0.17, 0.070) + _gaussian_2d(nx, ny, 0.65, 0.43, 0.17, 0.070)
        lips = _gaussian_2d(nx, ny, 0.50, 0.69, 0.20, 0.060)
        nose_tip = _gaussian_2d(nx, ny, 0.50, 0.56, 0.13, 0.080)
        zone_prior *= 1.0 - np.clip(brows * 1.20 + eyes * 1.05 + lips * 1.00 + nose_tip * 0.55, 0.0, 1.00)
    skin_chroma = cv2.morphologyEx(
        skin_chroma,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)),
        1,
    )
    feature_exclusion = (
        ((val < 78) & (sat > 18))
        | ((sat > 92) & (val < 150))
        | ((blue > red + 18) & (val < 128))
    ).astype(np.uint8) * 255
    feature_exclusion = cv2.dilate(
        feature_exclusion,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)),
        iterations=1,
    )
    skin_chroma = cv2.morphologyEx(
        skin_chroma,
        cv2.MORPH_CLOSE,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (19, 19)),
        1,
    )
    skin_chroma = cv2.bitwise_and(skin_chroma, cv2.bitwise_not(feature_exclusion))
    visible = np.clip(cv2.GaussianBlur(skin_chroma.astype(np.float32) / 255.0, (0, 0), 2.0), 0, 1)
    visible = np.clip(visible * matte * cv2.GaussianBlur(zone_prior, (0, 0), 1.4), 0, 1)
    valid = visible > 0.18
    if int(valid.sum()) < 400:
        return bgr

    # ---- Blackhat morphology: detects dark linear creases as bright response ----
    # Blackhat = closing(I) - I  →  highlights dark structures smaller than the kernel.
    k_size = max(7, min(gray.shape[:2]) // 50)
    if k_size % 2 == 0:
        k_size += 1
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k_size, k_size))
    closed = cv2.morphologyEx(gray.astype(np.uint8), cv2.MORPH_CLOSE, kernel)
    blackhat = np.maximum(closed.astype(np.float32) - gray, 0.0) * visible

    # Also detect creases on the Cb channel (skin tone shifts at wrinkles).
    yuv = cv2.cvtColor(rgb, cv2.COLOR_RGB2YUV).astype(np.float32)
    cb = yuv[:, :, 1]
    cb_blackhat = np.maximum(
        cv2.morphologyEx(cb.astype(np.uint8), cv2.MORPH_CLOSE, kernel).astype(np.float32) - cb, 0.0
    ) * visible

    # Combine and normalise within the face region.
    crease_signal = blackhat * 0.7 + cb_blackhat * 0.3
    if int(valid.sum()) > 0:
        thr = float(np.percentile(crease_signal[valid], 70))
        peak = float(np.percentile(crease_signal[valid], 98))
    else:
        return bgr
    heat = np.clip((crease_signal - thr) / max(peak - thr, 1e-3), 0, 1) * visible

    # Light blur for smooth lines (no staircasing).
    heat = cv2.GaussianBlur(heat, (0, 0), 1.2)
    eff = np.clip(heat * 1.6, 0, 0.78)

    # Render: keep original skin colours, paint creases with the V4 teal
    # clinical palette. Strength/severity is expressed through both brightness
    # and opacity so the lens reads as annotation rather than bruising.
    severity = np.clip(heat ** 0.82, 0.0, 1.0)
    low_teal = np.array([0.0, 88.0, 96.0], dtype=np.float32)
    high_teal = np.array([20.0, 214.0, 212.0], dtype=np.float32)
    crease_rgb = low_teal * (1.0 - severity[:, :, None]) + high_teal * severity[:, :, None]
    base = rgb.astype(np.float32)
    shadow_rgb = np.array([0.0, 38.0, 46.0], dtype=np.float32)
    shadow_eff = np.clip(eff * 0.16, 0.0, 0.10)
    wrinkle_alpha = eff * visible * 0.82
    shaded = base * (1 - shadow_eff[:, :, None] * visible[:, :, None]) + shadow_rgb * (
        shadow_eff[:, :, None] * visible[:, :, None]
    )
    result = shaded * (1 - wrinkle_alpha[:, :, None]) + crease_rgb * wrinkle_alpha[:, :, None]
    return cv2.cvtColor(np.clip(result, 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR)


def process_frame(
    bgr: np.ndarray,
    palette: str,
    *,
    angle: str = "front",
    turntable_fast: bool = False,
) -> np.ndarray:
    # Redness and pores are baked per-frame directly from the colour turntable;
    # they don't use the clinical skin-segmentation pipeline below.
    if palette == "redness":
        return _redness_frame(bgr)
    if palette == "pores":
        return _pores_frame(bgr)
    if palette == "wrinkles":
        return _wrinkle_frame(bgr, angle, turntable_fast=turntable_fast)

    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    subj = subject_mask(rgb)
    matte = composite_matte(rgb, subj, turntable_fast=turntable_fast)
    skin = skin_mask(rgb, subj)
    base = clinical_base(rgb, matte, palette).astype(np.float32)
    overlay, alpha = pigment_overlay(rgb, skin, palette)
    out = base * (1 - alpha[:, :, None]) + overlay.astype(np.float32) * alpha[:, :, None]
    out = bake_cv_spots(
        out,
        rgb,
        matte,
        angle=angle,
        palette=palette,
        person_u8=subj if turntable_fast else None,
    )
    # Composite on pure black; matte follows raw turntable visibility (profile nose intact).
    out = out * matte[:, :, None]
    return cv2.cvtColor(np.clip(out, 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR)


def process_video(src: Path, out: Path, palette: str, *, turntable_fast: bool = True, ping_pong: bool = False) -> None:
    cap = cv2.VideoCapture(str(src))
    if not cap.isOpened():
        raise FileNotFoundError(src)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = Path(tempfile.gettempdir()) / f"{out.stem}.mp4v.tmp.mp4"

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(tmp_path), fourcc, fps, (width, height))
    if not writer.isOpened():
        raise RuntimeError(f"Could not open video writer for {tmp_path}")

    index = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        writer.write(
            process_frame(
                frame,
                palette,
                angle=infer_turntable_angle(index, total),
                turntable_fast=turntable_fast,
            )
        )
        index += 1
        if total and index % 20 == 0:
            print(f"{palette}: {index}/{total} frames", flush=True)

    cap.release()
    writer.release()
    if ping_pong:
        # Stitch forward + reversed frames in one encode from the lossless temp.
        # All-keyframes so the backward half is instantly seekable.
        subprocess.run(
            [
                "ffmpeg", "-y", "-v", "error",
                "-i", str(tmp_path),
                "-filter_complex", "[0:v]reverse[r];[0:v][r]concat=n=2:v=1[out]",
                "-map", "[out]",
                "-c:v", "libx264", "-pix_fmt", "yuv420p",
                "-profile:v", "high", "-level", "5.2",
                "-g", "1", "-keyint_min", "1", "-sc_threshold", "0",
                "-movflags", "+faststart",
                str(out),
            ],
            check=True,
        )
    else:
        subprocess.run(
            [
                "ffmpeg", "-y", "-v", "error",
                "-i", str(tmp_path),
                "-c:v", "libx264", "-pix_fmt", "yuv420p",
                "-profile:v", "high", "-level", "5.2",
                "-movflags", "+faststart",
                str(out),
            ],
            check=True,
        )
    tmp_path.unlink(missing_ok=True)
    print(f"Wrote {out}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument(
        "--palette",
        choices=("gray", "brown", "redness", "pores", "wrinkles", "both"),
        default="gray",
    )
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()

    src = args.input if args.input.is_absolute() else ROOT / args.input
    if args.palette == "both":
        process_video(src, DEFAULT_GRAY, "gray")
        process_video(src, DEFAULT_BROWN, "brown")
    else:
        default_out = {
            "brown": DEFAULT_BROWN,
            "redness": ROOT / "src/assets/images/turntable_1024_black_redness_scrub.mp4",
            "pores": ROOT / "src/assets/images/turntable_1024_black_pores_scrub.mp4",
            "wrinkles": DEFAULT_WRINKLES_1024,
        }.get(args.palette, DEFAULT_GRAY)
        out = args.output if args.output else default_out
        out = out if out.is_absolute() else ROOT / out
        src_use = DEFAULT_INPUT_1024 if args.palette in ("redness", "pores", "wrinkles") else src
        process_video(src_use, out, args.palette, ping_pong=args.palette == "wrinkles")


if __name__ == "__main__":
    main()
