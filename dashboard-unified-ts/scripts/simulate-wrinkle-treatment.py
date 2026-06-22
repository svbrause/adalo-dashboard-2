#!/usr/bin/env python3
"""Simulate post-treatment wrinkle smoothing (neurotoxin / laser / combined).

Uses CV crease detection to build a soft treatment mask, then frequency-separation
smoothing + crease-shadow lift inside periocular skin — preserves lashes, brows, and
global skin tone while softening crow's feet and under-eye lines.
"""

from __future__ import annotations

import argparse
import importlib.util
import math
from pathlib import Path
from typing import Literal

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SCRIPT_DIR = Path(__file__).resolve().parent

TreatmentMode = Literal["tox", "laser", "combined"]
GuidedHealMode = Literal["natural", "smooth", "glass", "photoshop"]
SourceRegion = Literal["full", "left-panel", "right-panel", "auto-left-panel"]
SimulationPreset = Literal["natural", "reference", "calibrated", "dramatic"]


def _load(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPT_DIR / filename)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _zone_treatment_base(
    rgb: np.ndarray,
    crease_mod,
) -> np.ndarray:
    """Soft mask over forehead + periocular zones (not just crease lines)."""
    ih, iw = rgb.shape[:2]
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    eye = crease_mod._detect_primary_eye_box(gray)
    if eye is not None:
        eye = crease_mod._refine_eye_box(eye, ih, iw)
        zones = crease_mod._periocular_zone_masks_from_eye((ih, iw), eye, gray)
    else:
        zones = crease_mod._heuristic_periocular_zone_masks((ih, iw))

    base = np.zeros((ih, iw), np.float32)
    forehead = np.zeros((ih, iw), np.uint8)
    if eye is not None:
        ex, ey, ew, eh = eye
        y0 = max(0, int(ey - ih * 0.42))
        y1 = max(y0 + 1, int(ey + eh * 0.04))
        x0 = max(0, int(ex - iw * 0.42))
        x1 = min(iw, int(ex + ew + iw * 0.36))
        cv2.rectangle(forehead, (x0, y0), (x1, min(ih, y1)), 255, -1)
    else:
        cv2.rectangle(
            forehead,
            (int(iw * 0.08), int(ih * 0.08)),
            (int(iw * 0.96), int(ih * 0.42)),
            255,
            -1,
        )
    base = np.maximum(base, forehead.astype(np.float32) / 255.0 * 0.84)

    for entry in zones:
        zone_mask = entry[1]
        weight = 1.0 if entry[0] == "crows_feet" else 0.82
        base = np.maximum(base, zone_mask.astype(np.float32) / 255.0 * weight)
    return cv2.GaussianBlur(base, (0, 0), max(6.0, min(ih, iw) * 0.012))


def _paths_to_weight_mask(
    paths: list[list[list[float]]],
    iw: int,
    ih: int,
    *,
    stroke: int,
) -> np.ndarray:
    mask = np.zeros((ih, iw), np.float32)
    for path in paths:
        pts = np.array(
            [[round(x / 100.0 * iw), round(y / 100.0 * ih)] for x, y in path],
            dtype=np.int32,
        )
        if len(pts) >= 2:
            cv2.polylines(mask, [pts], False, 1.0, stroke, cv2.LINE_AA)
    if mask.max() <= 0:
        return mask
    dilate = max(3, stroke // 3)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (dilate, dilate))
    mask = cv2.dilate((mask > 0.05).astype(np.uint8), k, iterations=2).astype(np.float32)
    return cv2.GaussianBlur(mask, (0, 0), max(4.0, stroke * 0.45))


def _crease_weight_map(
    gray: np.ndarray,
    skin: np.ndarray,
    crease_mod,
) -> np.ndarray:
    resp = crease_mod._crease_response(gray, "any")
    valid = skin > 40
    if not np.any(valid):
        return np.zeros_like(resp, dtype=np.float32)
    p58 = float(np.percentile(resp[valid], 58))
    p88 = float(np.percentile(resp[valid], 88))
    span = max(p88 - p58, 4.0)
    w = (resp.astype(np.float32) - p58) / span
    w = np.clip(w, 0.0, 1.0) * (valid.astype(np.float32) / 255.0)
    w = cv2.GaussianBlur(w, (0, 0), 7.0)
    dilate = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    strong = cv2.dilate((w > 0.35).astype(np.uint8), dilate, iterations=1).astype(np.float32)
    return np.clip(np.maximum(w, strong * 0.55), 0.0, 1.0)


def _eye_protect_mask(
    gray: np.ndarray,
    ih: int,
    iw: int,
    crease_mod,
) -> np.ndarray:
    """Keep lashes, iris, and lid makeup sharp."""
    protect = np.zeros((ih, iw), np.uint8)
    eye = crease_mod._detect_primary_eye_box(gray)
    if eye is not None:
        eye = crease_mod._refine_eye_box(eye, ih, iw)
    if eye is None:
        # Fallback: central-upper third where the eye usually sits in periocular crops.
        cx, cy = iw // 2, int(ih * 0.42)
        rx, ry = int(iw * 0.22), int(ih * 0.14)
        cv2.ellipse(protect, (cx, cy), (rx, ry), 0, 0, 360, 255, -1)
    else:
        x, y, ew, eh = eye
        pad_x = int(ew * 0.18)
        pad_y = int(eh * 0.22)
        x0 = max(0, x - pad_x)
        y0 = max(0, y - pad_y)
        x1 = min(iw, x + ew + pad_x)
        y1 = min(ih, y + eh + pad_y)
        cv2.ellipse(
            protect,
            (int((x0 + x1) / 2), int((y0 + y1) / 2)),
            (int((x1 - x0) / 2), int((y1 - y0) / 2)),
            0,
            0,
            360,
            255,
            -1,
        )
    return cv2.GaussianBlur(protect.astype(np.float32) / 255.0, (0, 0), 6.0)


def _detect_eye_boxes(gray: np.ndarray) -> list[tuple[int, int, int, int]]:
    h, w = gray.shape
    min_dim = max(22, int(min(h, w) * 0.045))
    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_eye.xml")
    eyes = cascade.detectMultiScale(
        gray,
        scaleFactor=1.05,
        minNeighbors=4,
        minSize=(min_dim, min_dim),
    )
    boxes = [tuple(map(int, e)) for e in eyes]
    boxes.sort(key=lambda b: b[2] * b[3], reverse=True)
    kept: list[tuple[int, int, int, int]] = []
    for box in boxes:
        x, y, ew, eh = box
        cx, cy = x + ew / 2, y + eh / 2
        if any(
            abs(cx - (kx + kw / 2)) < max(ew, kw) * 0.45
            and abs(cy - (ky + kh / 2)) < max(eh, kh) * 0.45
            for kx, ky, kw, kh in kept
        ):
            continue
        kept.append(box)
        if len(kept) >= 2:
            break
    return kept


def _all_eye_protect_mask(
    gray: np.ndarray,
    ih: int,
    iw: int,
    crease_mod,
) -> np.ndarray:
    protect = np.zeros((ih, iw), np.float32)
    boxes = _detect_eye_boxes(gray)
    if not boxes:
        single = _eye_protect_mask(gray, ih, iw, crease_mod)
        return np.clip(single, 0.0, 1.0)

    for eye in boxes:
        x, y, ew, eh = crease_mod._refine_eye_box(eye, ih, iw)
        pad_x = int(ew * 0.22)
        pad_y = int(eh * 0.22)
        cx = int(x + ew / 2)
        cy = int(y + eh / 2)
        eye_mask = np.zeros((ih, iw), np.uint8)
        cv2.ellipse(
            eye_mask,
            (cx, cy),
            (max(5, int(ew / 2 + pad_x)), max(5, int(eh / 2 + pad_y))),
            0,
            0,
            360,
            255,
            -1,
        )
        protect = np.maximum(
            protect,
            cv2.GaussianBlur(eye_mask.astype(np.float32) / 255.0, (0, 0), 6.0),
        )
    return np.clip(protect, 0.0, 1.0)


def _build_treatment_mask(
    rgb: np.ndarray,
    paths: list[list[list[float]]],
    crease_mod,
    cutout_mod,
    *,
    zone_expand: int,
    eye_protect_strength: float = 1.0,
) -> np.ndarray:
    ih, iw = rgb.shape[:2]
    alpha = cutout_mod.studio_backdrop_mask(rgb)
    skin = crease_mod._build_skin_mask(rgb, alpha)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)

    path_mask = _paths_to_weight_mask(paths, iw, ih, stroke=zone_expand)
    crease_mask = _crease_weight_map(gray, skin, crease_mod)
    zone_base = _zone_treatment_base(rgb, crease_mod)

    line_focus = np.clip(np.maximum(path_mask * 1.0, crease_mask * 0.92), 0.0, 1.0)
    mask = np.clip(zone_base * 0.55 + line_focus * 0.65, 0.0, 1.0)
    mask *= (skin.astype(np.float32) / 255.0)

    # Suppress treatment in clearly hair-like pixels (dark and low-saturation).
    # This prevents forehead-zone bleed into scalp/hairline on full-face images.
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    dark_low_sat = ((hsv[:, :, 2] < 72) & (hsv[:, :, 1] < 90)).astype(np.uint8)
    dark_low_sat = cv2.dilate(
        dark_low_sat,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)),
        iterations=1,
    )
    mask *= np.clip(1.0 - dark_low_sat.astype(np.float32) * 0.85, 0.0, 1.0)

    # Feather toward cheek/temple; avoid hard crop edges.
    edge_falloff = np.ones((ih, iw), np.float32)
    margin = max(8, min(ih, iw) // 28)
    edge_falloff[:margin, :] *= np.linspace(0, 1, margin, dtype=np.float32)[:, None]
    edge_falloff[-margin:, :] *= np.linspace(1, 0, margin, dtype=np.float32)[:, None]
    edge_falloff[:, :margin] *= np.linspace(0, 1, margin, dtype=np.float32)
    edge_falloff[:, -margin:] *= np.linspace(1, 0, margin, dtype=np.float32)
    mask *= edge_falloff

    protect = _all_eye_protect_mask(gray, ih, iw, crease_mod)
    mask *= 1.0 - protect * float(np.clip(eye_protect_strength, 0.0, 1.0))
    return cv2.GaussianBlur(mask, (0, 0), max(3.0, zone_expand * 0.35))


def _guided_heal_mask_from_markup(
    markup_rgb: np.ndarray,
    source_rgb: np.ndarray,
) -> np.ndarray:
    """Extract hand-drawn gray wrinkle guide strokes from an annotated image."""
    rgb_i = markup_rgb.astype(np.int16)
    channel_spread = rgb_i.max(axis=2) - rgb_i.min(axis=2)
    value = markup_rgb.max(axis=2)
    diff = np.max(
        np.abs(markup_rgb.astype(np.int16) - source_rgb.astype(np.int16)),
        axis=2,
    )

    # The guide strokes are neutral gray; this avoids grabbing brows, iris, logo, or warm shadows.
    mask = (
        (diff > 26) &
        (channel_spread < 24) &
        (value > 45) &
        (value < 155)
    ).astype(np.uint8) * 255
    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)),
    )
    mask = cv2.dilate(
        mask,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)),
        iterations=1,
    )
    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_CLOSE,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)),
    )
    return mask


def _guided_spot_heal(
    rgb: np.ndarray,
    guide_mask: np.ndarray,
    *,
    mode: GuidedHealMode = "natural",
    crease_mod=None,
) -> np.ndarray:
    """Photoshop-like spot healing over user-guided wrinkle strokes."""
    if guide_mask.max() <= 0:
        return rgb
    if mode == "photoshop":
        core_k = 23
        wide_k = 43
        inpaint_r = 11
        core_opacity = 0.82
        surrounding_smooth = 0.42
        low_sigma = 10.0
        shadow_lift = 34.0
        texture_mix = 0.10
        patch_mix = 0.65
    elif mode == "glass":
        core_k = 19
        wide_k = 39
        inpaint_r = 10
        core_opacity = 0.98
        surrounding_smooth = 0.86
        low_sigma = 12.5
        shadow_lift = 46.0
        texture_mix = 0.035
        patch_mix = 0.78
    elif mode == "smooth":
        core_k = 15
        wide_k = 31
        inpaint_r = 8
        core_opacity = 0.92
        surrounding_smooth = 0.68
        low_sigma = 9.5
        shadow_lift = 38.0
        texture_mix = 0.07
        patch_mix = 0.78
    else:
        core_k = 9
        wide_k = 19
        inpaint_r = 5
        core_opacity = 0.76
        surrounding_smooth = 0.44
        low_sigma = 5.2
        shadow_lift = 24.0
        texture_mix = 0.18
        patch_mix = 0.78

    base = (guide_mask > 0).astype(np.uint8) * 255
    if crease_mod is not None:
        ih, iw = rgb.shape[:2]
        gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
        if mode == "photoshop":
            eye_stop = np.zeros((ih, iw), np.uint8)
            eye = crease_mod._detect_primary_eye_box(gray)
            if eye is not None:
                x, y, ew, eh = crease_mod._refine_eye_box(eye, ih, iw)
                x0 = max(0, x - int(ew * 0.08))
                y0 = max(0, y - int(eh * 0.10))
                x1 = min(iw, x + ew + int(ew * 0.10))
                y1 = min(ih, y + eh + int(eh * 0.12))
                eye_roi = np.zeros((ih, iw), np.uint8)
                eye_roi[y0:y1, x0:x1] = 255
            else:
                eye_roi = np.zeros((ih, iw), np.uint8)
                eye_roi[int(ih * 0.16):int(ih * 0.52), int(iw * 0.16):int(iw * 0.62)] = 255
            hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
            high_contrast_eye = (
                ((gray < 78) | ((hsv[:, :, 1] < 45) & (gray > 185))).astype(np.uint8) * 255
            )
            eye_stop = cv2.bitwise_and(high_contrast_eye, eye_roi)
            eye_stop = cv2.dilate(
                eye_stop,
                cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)),
                iterations=1,
            )
        else:
            eye_protect = _eye_protect_mask(gray, ih, iw, crease_mod)
            # Keep the retouch from feathering into the eyelid, lashes, iris, or makeup.
            # A hard-ish cutoff here reads more like a brush edge than a blur crossing the eye.
            eye_stop = cv2.dilate(
                (eye_protect > 0.46).astype(np.uint8) * 255,
                cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)),
                iterations=1,
            )
        base = cv2.bitwise_and(base, cv2.bitwise_not(eye_stop))
    core = cv2.dilate(
        base,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (core_k, core_k)),
        iterations=1,
    )
    wide = cv2.dilate(
        base,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (wide_k, wide_k)),
        iterations=1,
    )
    wide = cv2.morphologyEx(
        wide,
        cv2.MORPH_CLOSE,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11)),
    )

    telea = cv2.inpaint(rgb, core, inpaint_r, cv2.INPAINT_TELEA).astype(np.float32)
    ns = cv2.inpaint(rgb, core, inpaint_r + 2, cv2.INPAINT_NS).astype(np.float32)
    core_heal = telea * patch_mix + ns * (1.0 - patch_mix)
    if mode == "photoshop":
        low_src = cv2.GaussianBlur(rgb.astype(np.float32), (0, 0), 18.0)
        low_heal = cv2.GaussianBlur(core_heal, (0, 0), 18.0)
        core_heal = np.clip(core_heal + (low_src - low_heal) * 0.55, 0, 255)
    rgb_f = rgb.astype(np.float32)

    # Local low-frequency skin tone works better than wide inpainting for periocular
    # wrinkles: it removes the crease contrast without creating cloned rectangular patches.
    low = cv2.bilateralFilter(rgb, 17, 62, 54).astype(np.float32)
    low = cv2.GaussianBlur(low, (0, 0), low_sigma)

    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    dark = np.clip((138.0 - gray) / 70.0, 0.0, 1.0)
    wide_soft = cv2.GaussianBlur(wide.astype(np.float32) / 255.0, (0, 0), 3.2)
    wide_soft = np.clip(wide_soft * 1.08, 0.0, 1.0)[..., None]
    core_soft = cv2.GaussianBlur(core.astype(np.float32) / 255.0, (0, 0), 1.6)
    core_soft = np.clip(core_soft * 1.28, 0.0, 1.0)[..., None]

    healed = rgb_f * (1.0 - wide_soft * surrounding_smooth) + low * (
        wide_soft * surrounding_smooth
    )
    healed += dark[..., None] * (wide.astype(np.float32)[..., None] / 255.0) * shadow_lift
    healed = healed * (1.0 - core_soft * core_opacity) + core_heal * (
        core_soft * core_opacity
    )

    texture = rgb_f - cv2.GaussianBlur(rgb_f, (0, 0), 1.2)
    healed += texture * wide_soft * texture_mix
    return np.clip(healed, 0, 255).astype(np.uint8)


def _crease_core_mask(rgb: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Narrow inpaint target for the deepest wrinkle shadows only."""
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13))
    blackhat = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, kernel).astype(np.float32)
    valid = mask > 0.18
    if not np.any(valid):
        return np.zeros_like(mask, dtype=np.float32)

    # Percentile threshold adapts to each crop, but stays narrow enough to avoid
    # inpainting full periocular patches or the protected eyelid boundary.
    threshold = max(9.0, float(np.percentile(blackhat[valid], 78)))
    core = ((blackhat >= threshold) & (mask > 0.24)).astype(np.uint8)
    core = cv2.morphologyEx(
        core,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)),
    )
    core = cv2.dilate(
        core,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)),
        iterations=1,
    )
    core_f = cv2.GaussianBlur(core.astype(np.float32), (0, 0), 1.8)
    return np.clip(core_f * mask, 0.0, 1.0)


def _lateral_canthus_fold_mask(
    rgb: np.ndarray,
    crease_mod,
    treatment_mask: np.ndarray,
) -> np.ndarray:
    """Target the deep horizontal crow's-foot fold radiating from the outer eye corner."""
    ih, iw = rgb.shape[:2]
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    eye = crease_mod._detect_primary_eye_box(gray)
    if eye is None:
        return np.zeros((ih, iw), np.float32)

    eye = crease_mod._refine_eye_box(eye, ih, iw)
    ex, ey, ew, eh = eye
    ox, oy = crease_mod._outer_canthus_from_iris(gray, eye, iw)
    outward = -1 if ox <= ex + ew // 2 else 1

    band = np.zeros((ih, iw), np.uint8)
    span = int(max(iw * 0.34, ew * 1.45))
    x0 = max(0, ox - span) if outward < 0 else ox
    x1 = ox if outward < 0 else min(iw - 1, ox + span)
    y0 = max(0, int(oy - eh * 0.02))
    y1 = min(ih - 1, int(oy + eh * 0.58))
    cv2.rectangle(band, (x0, y0), (x1, y1), 255, -1)

    # Keep the mask outside the eye interior. The long crease starts at the corner,
    # but the visible eye and lash line should remain sharp.
    eye_stop = (_all_eye_protect_mask(gray, ih, iw, crease_mod) > 0.38).astype(np.uint8) * 255
    band = cv2.bitwise_and(band, cv2.bitwise_not(eye_stop))

    horizontal = cv2.morphologyEx(
        gray,
        cv2.MORPH_BLACKHAT,
        cv2.getStructuringElement(cv2.MORPH_RECT, (47, 7)),
    ).astype(np.float32)
    valid = (band > 0) & (treatment_mask > 0.08)
    if not np.any(valid):
        return np.zeros((ih, iw), np.float32)

    low_p = float(np.percentile(horizontal[valid], 46))
    high_p = max(low_p + 1.0, float(np.percentile(horizontal[valid], 90)))
    line = np.clip((horizontal - low_p) / (high_p - low_p), 0.0, 1.0)
    line = line * (band.astype(np.float32) / 255.0)

    # Add a narrow ray from the canthus so the full fold is treated, even where the
    # darkest portion is broken by makeup/lighting.
    ray = np.zeros((ih, iw), np.uint8)
    end_x = x0 if outward < 0 else x1
    for offset, weight in ((0.10, 210), (0.24, 255)):
        ray_y = min(ih - 1, int(oy + eh * offset))
        cv2.line(
            ray,
            (ox, ray_y),
            (end_x, ray_y),
            weight,
            max(8, int(eh * 0.11)),
            cv2.LINE_AA,
        )
    ray = cv2.bitwise_and(ray, band)
    line = np.maximum(line, ray.astype(np.float32) / 255.0 * 0.72)
    line *= np.clip(0.36 + treatment_mask * 0.92, 0.0, 1.0)
    return cv2.GaussianBlur(line, (0, 0), max(2.4, eh * 0.035))


def _heal_lateral_canthus_fold(
    rgb: np.ndarray,
    working: np.ndarray,
    fold_mask: np.ndarray,
    *,
    strength: float,
) -> np.ndarray:
    if fold_mask.max() <= 0:
        return working

    core = (fold_mask > 0.22).astype(np.uint8) * 255
    core = cv2.dilate(
        core,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 5)),
        iterations=1,
    )
    patched = cv2.inpaint(working.astype(np.uint8), core, 10, cv2.INPAINT_TELEA).astype(np.float32)
    soft = np.clip(cv2.GaussianBlur(fold_mask, (0, 0), 4.8) * strength * 1.42, 0.0, 1.0)[..., None]
    smoothed = cv2.bilateralFilter(working.astype(np.uint8), 31, 92, 70).astype(np.float32)
    smoothed = cv2.GaussianBlur(smoothed, (0, 0), 3.2)
    healed = working.astype(np.float32) * (1.0 - soft * 0.92) + smoothed * (soft * 0.36) + patched * (soft * 0.56)

    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    dark = np.clip((135.0 - gray) / 92.0, 0.0, 1.0)
    healed += dark[..., None] * soft * 65.0 * strength
    return np.clip(healed, 0, 255).astype(np.float32)


def _under_eye_refinement_mask(
    rgb: np.ndarray,
    crease_mod,
    treatment_mask: np.ndarray,
) -> np.ndarray:
    ih, iw = rgb.shape[:2]
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    eye = crease_mod._detect_primary_eye_box(gray)
    if eye is None:
        return np.zeros((ih, iw), np.float32)
    ex, ey, ew, eh = crease_mod._refine_eye_box(eye, ih, iw)
    under = np.zeros((ih, iw), np.uint8)
    cv2.rectangle(
        under,
        (max(0, ex - int(ew * 0.22)), min(ih - 1, ey + int(eh * 0.56))),
        (min(iw, ex + ew + int(ew * 0.28)), min(ih, ey + eh + int(eh * 0.34))),
        255,
        -1,
    )
    eye_stop = (_all_eye_protect_mask(gray, ih, iw, crease_mod) > 0.36).astype(np.uint8) * 255
    under = cv2.bitwise_and(under, cv2.bitwise_not(eye_stop))
    mask = under.astype(np.float32) / 255.0 * np.clip(0.58 + treatment_mask, 0.0, 1.0)
    return cv2.GaussianBlur(mask, (0, 0), max(2.4, eh * 0.045))


def _smooth_under_eye_texture(
    working: np.ndarray,
    under_mask: np.ndarray,
    *,
    strength: float,
    rgb_orig: np.ndarray | None = None,
) -> np.ndarray:
    if under_mask.max() <= 0:
        return working.astype(np.float32)
    working_u8 = working.astype(np.uint8)
    # Inpaint the deepest under-eye creases before blending.
    core = (under_mask > 0.30).astype(np.uint8) * 255
    core = cv2.dilate(core, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 3)), iterations=1)
    patched = cv2.inpaint(working_u8, core, 7, cv2.INPAINT_TELEA).astype(np.float32)
    smoothed = cv2.bilateralFilter(working_u8, 21, 64, 48).astype(np.float32)
    smoothed = cv2.GaussianBlur(smoothed, (0, 0), 2.4)
    soft = np.clip(under_mask * strength * 0.96, 0.0, 0.96)[..., None]
    core_soft = np.clip(cv2.GaussianBlur(under_mask, (0, 0), 2.0) * strength * 1.28, 0.0, 0.96)[..., None]
    out = working.astype(np.float32) * (1.0 - soft * 0.88) + patched * (soft * 0.56) + smoothed * (soft * 0.32)
    src_for_lift = rgb_orig if rgb_orig is not None else working_u8
    gray_lift = cv2.cvtColor(src_for_lift, cv2.COLOR_RGB2GRAY).astype(np.float32)
    dark = np.clip((148.0 - gray_lift) / 80.0, 0.0, 1.0)
    out += dark[..., None] * core_soft * 58.0 * strength
    return np.clip(out, 0, 255).astype(np.float32)


def _residual_periocular_line_mask(
    rgb: np.ndarray,
    crease_mod,
    treatment_mask: np.ndarray,
) -> np.ndarray:
    """Detect remaining fine horizontal/diagonal periocular line shadows."""
    ih, iw = rgb.shape[:2]
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    eye = crease_mod._detect_primary_eye_box(gray)
    if eye is None:
        roi = np.clip(treatment_mask, 0.0, 1.0)
    else:
        ex, ey, ew, eh = crease_mod._refine_eye_box(eye, ih, iw)
        roi_u8 = np.zeros((ih, iw), np.uint8)
        ox, oy = crease_mod._outer_canthus_from_iris(gray, (ex, ey, ew, eh), iw)
        outward = -1 if ox <= ex + ew // 2 else 1
        span = int(max(iw * 0.42, ew * 1.75))
        x0 = max(0, ox - span) if outward < 0 else max(0, ex - int(ew * 0.08))
        x1 = min(iw, ex + ew + int(ew * 0.08)) if outward < 0 else min(iw, ox + span)
        y0 = max(0, ey - int(eh * 0.10))
        y1 = min(ih, ey + eh + int(eh * 0.62))
        cv2.rectangle(roi_u8, (x0, y0), (x1, y1), 255, -1)

        eye_stop = (_all_eye_protect_mask(gray, ih, iw, crease_mod) > 0.34).astype(np.uint8) * 255
        roi_u8 = cv2.bitwise_and(roi_u8, cv2.bitwise_not(eye_stop))
        roi = roi_u8.astype(np.float32) / 255.0
        roi *= np.clip(0.22 + treatment_mask, 0.0, 1.0)

    resp_h = cv2.morphologyEx(
        gray,
        cv2.MORPH_BLACKHAT,
        cv2.getStructuringElement(cv2.MORPH_RECT, (39, 5)),
    ).astype(np.float32)
    resp_any = crease_mod._crease_response(gray, "any").astype(np.float32)
    response = np.maximum(resp_h * 0.96, resp_any * 0.74)
    valid = roi > 0.12
    if not np.any(valid):
        return np.zeros((ih, iw), np.float32)
    low_p = float(np.percentile(response[valid], 48))
    high_p = max(low_p + 1.0, float(np.percentile(response[valid], 88)))
    lines = np.clip((response - low_p) / (high_p - low_p), 0.0, 1.0) * roi
    lines = cv2.morphologyEx(
        (lines > 0.32).astype(np.uint8) * 255,
        cv2.MORPH_CLOSE,
        cv2.getStructuringElement(cv2.MORPH_RECT, (9, 3)),
    ).astype(np.float32) / 255.0
    return cv2.GaussianBlur(lines * roi, (0, 0), 2.2)


def _heal_residual_periocular_lines(
    rgb: np.ndarray,
    working: np.ndarray,
    line_mask: np.ndarray,
    *,
    strength: float,
) -> np.ndarray:
    if line_mask.max() <= 0:
        return working.astype(np.float32)
    core = (line_mask > 0.18).astype(np.uint8) * 255
    core = cv2.dilate(
        core,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)),
        iterations=1,
    )
    patched = cv2.inpaint(working.astype(np.uint8), core, 8, cv2.INPAINT_TELEA).astype(np.float32)
    low = cv2.bilateralFilter(working.astype(np.uint8), 29, 86, 64).astype(np.float32)
    low = cv2.GaussianBlur(low, (0, 0), 2.8)
    soft = np.clip(cv2.GaussianBlur(line_mask, (0, 0), 4.0) * strength * 1.52, 0.0, 1.0)[..., None]
    out = working.astype(np.float32) * (1.0 - soft * 0.90) + patched * (soft * 0.52) + low * (soft * 0.38)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    dark = np.clip((142.0 - gray) / 95.0, 0.0, 1.0)
    out += dark[..., None] * soft * 58.0 * strength
    return np.clip(out, 0, 255).astype(np.float32)


def _forehead_line_mask(
    rgb: np.ndarray,
    crease_mod,
    treatment_mask: np.ndarray,
) -> np.ndarray:
    ih, iw = rgb.shape[:2]
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    boxes = _detect_eye_boxes(gray)
    if boxes:
        y_eye = min(y for _x, y, _w, _h in boxes)
        x0 = max(0, min(x for x, _y, _w, _h in boxes) - int(iw * 0.18))
        x1 = min(iw, max(x + ew for x, _y, ew, _h in boxes) + int(iw * 0.18))
        y0 = max(0, int(y_eye - ih * 0.34))
        y1 = min(ih, int(y_eye + ih * 0.035))
    else:
        x0, x1 = int(iw * 0.12), int(iw * 0.88)
        y0, y1 = int(ih * 0.12), int(ih * 0.38)

    roi = np.zeros((ih, iw), np.float32)
    roi[y0:y1, x0:x1] = 1.0
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    hue, sat, val = cv2.split(hsv)
    skin_like = (
        (val > 58)
        & (val < 248)
        & (sat > 10)
        & (sat < 150)
        & ((hue < 32) | (hue > 165))
    ).astype(np.float32)
    skin_like = cv2.medianBlur((skin_like * 255).astype(np.uint8), 7).astype(np.float32) / 255.0
    roi *= skin_like
    roi *= np.clip(0.12 + treatment_mask * 1.20, 0.0, 1.0)
    horizontal = cv2.morphologyEx(
        gray,
        cv2.MORPH_BLACKHAT,
        cv2.getStructuringElement(cv2.MORPH_RECT, (55, 7)),
    ).astype(np.float32)
    valid = roi > 0.12
    if not np.any(valid):
        return np.zeros((ih, iw), np.float32)
    low_p = float(np.percentile(horizontal[valid], 48))
    high_p = max(low_p + 1.0, float(np.percentile(horizontal[valid], 91)))
    lines = np.clip((horizontal - low_p) / (high_p - low_p), 0.0, 1.0) * roi
    lines = cv2.morphologyEx(
        (lines > 0.32).astype(np.uint8) * 255,
        cv2.MORPH_CLOSE,
        cv2.getStructuringElement(cv2.MORPH_RECT, (13, 3)),
    ).astype(np.float32) / 255.0
    return cv2.GaussianBlur(lines * roi, (0, 0), 2.4)


def _heal_forehead_lines(
    rgb: np.ndarray,
    working: np.ndarray,
    forehead_mask: np.ndarray,
    *,
    strength: float,
) -> np.ndarray:
    if forehead_mask.max() <= 0:
        return working.astype(np.float32)
    core = (forehead_mask > 0.34).astype(np.uint8) * 255
    core = cv2.dilate(
        core,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 3)),
        iterations=1,
    )
    if cv2.countNonZero(core) > working.shape[0] * working.shape[1] * 0.08:
        return working.astype(np.float32)
    patched = cv2.inpaint(working.astype(np.uint8), core, 7, cv2.INPAINT_TELEA).astype(np.float32)
    smooth = cv2.bilateralFilter(working.astype(np.uint8), 21, 58, 42).astype(np.float32)
    smooth = cv2.GaussianBlur(smooth, (0, 0), 1.6)
    soft = np.clip(cv2.GaussianBlur(forehead_mask, (0, 0), 3.0) * strength * 0.94, 0.0, 0.90)[..., None]
    out = working.astype(np.float32) * (1.0 - soft * 0.86) + patched * (soft * 0.52) + smooth * (soft * 0.34)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    dark = np.clip((142.0 - gray) / 96.0, 0.0, 1.0)
    out += dark[..., None] * soft * 44.0 * strength
    return np.clip(out, 0, 255).astype(np.float32)


def _glabella_fold_mask(
    rgb: np.ndarray,
    crease_mod,
    treatment_mask: np.ndarray,
) -> np.ndarray:
    """Detect vertical glabella frown lines ('11 lines') between the brows."""
    ih, iw = rgb.shape[:2]
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    boxes = _detect_eye_boxes(gray)

    if boxes:
        y_eye = min(y for _x, y, _w, _h in boxes)
        x_left = min(x for x, _y, _w, _h in boxes)
        x_right = max(x + ew for x, _y, ew, _h in boxes)
        x_center = (x_left + x_right) // 2
        # Keep glabella narrow: only target the zone between the inner brow corners.
        span_x = int((x_right - x_left) * 0.15)
        span_y = int(ih * 0.22)
        x0 = max(0, x_center - span_x)
        x1 = min(iw, x_center + span_x)
        y0 = max(0, y_eye - span_y)
        y1 = min(ih, y_eye + int(ih * 0.02))
    else:
        x0 = int(iw * 0.40)
        x1 = int(iw * 0.60)
        y0 = int(ih * 0.24)
        y1 = int(ih * 0.52)

    roi = np.zeros((ih, iw), np.float32)
    roi[y0:y1, x0:x1] = 1.0

    vertical = cv2.morphologyEx(
        gray,
        cv2.MORPH_BLACKHAT,
        cv2.getStructuringElement(cv2.MORPH_RECT, (7, 47)),
    ).astype(np.float32)
    resp_any = crease_mod._crease_response(gray, "any").astype(np.float32)
    response = np.maximum(vertical * 0.98, resp_any * 0.72)

    valid = roi > 0.12
    if not np.any(valid):
        return np.zeros((ih, iw), np.float32)

    low_p = float(np.percentile(response[valid], 42))
    high_p = max(low_p + 1.0, float(np.percentile(response[valid], 88)))
    lines = np.clip((response - low_p) / (high_p - low_p), 0.0, 1.0) * roi
    lines = cv2.morphologyEx(
        (lines > 0.26).astype(np.uint8) * 255,
        cv2.MORPH_CLOSE,
        cv2.getStructuringElement(cv2.MORPH_RECT, (3, 13)),
    ).astype(np.float32) / 255.0
    lines *= np.clip(0.18 + treatment_mask * 1.10, 0.0, 1.0)
    return cv2.GaussianBlur(lines * roi, (0, 0), 2.8)


def _heal_glabella_folds(
    rgb: np.ndarray,
    working: np.ndarray,
    glabella_mask: np.ndarray,
    *,
    strength: float,
) -> np.ndarray:
    if glabella_mask.max() <= 0:
        return working.astype(np.float32)
    core = (glabella_mask > 0.22).astype(np.uint8) * 255
    core = cv2.dilate(
        core,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 7)),
        iterations=1,
    )
    patched = cv2.inpaint(working.astype(np.uint8), core, 9, cv2.INPAINT_TELEA).astype(np.float32)
    smooth = cv2.bilateralFilter(working.astype(np.uint8), 25, 72, 56).astype(np.float32)
    smooth = cv2.GaussianBlur(smooth, (0, 0), 2.2)
    soft = np.clip(cv2.GaussianBlur(glabella_mask, (0, 0), 4.5) * strength * 1.35, 0.0, 1.0)[..., None]
    out = working.astype(np.float32) * (1.0 - soft * 0.92) + patched * (soft * 0.54) + smooth * (soft * 0.38)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    dark = np.clip((145.0 - gray) / 88.0, 0.0, 1.0)
    out += dark[..., None] * soft * 52.0 * strength
    return np.clip(out, 0, 255).astype(np.float32)


def _relax_lateral_eye_geometry(
    rgb: np.ndarray,
    working: np.ndarray,
    crease_mod,
    fold_mask: np.ndarray | None,
    *,
    strength: float,
) -> np.ndarray:
    """Tiny local remap around the outer eye to mimic relaxed contraction."""
    if fold_mask is None or fold_mask.max() <= 0:
        return working.astype(np.float32)
    ih, iw = rgb.shape[:2]
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    eye = crease_mod._detect_primary_eye_box(gray)
    if eye is None:
        return working.astype(np.float32)
    ex, ey, ew, eh = crease_mod._refine_eye_box(eye, ih, iw)
    ox, _oy = crease_mod._outer_canthus_from_iris(gray, eye, iw)
    outward = -1 if ox <= ex + ew // 2 else 1

    yy, xx = np.mgrid[0:ih, 0:iw].astype(np.float32)
    influence = cv2.GaussianBlur(fold_mask, (0, 0), max(5.0, eh * 0.09))
    influence = np.clip(influence * strength, 0.0, 1.0)
    # Sample slightly opposite the contraction direction so the visible skin reads flatter.
    map_x = xx - outward * influence * max(1.0, ew * 0.030)
    map_y = yy - influence * max(1.0, eh * 0.018)
    warped = cv2.remap(
        working.astype(np.uint8),
        map_x,
        map_y,
        interpolation=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_REFLECT,
    ).astype(np.float32)
    a = np.clip(influence * 0.34, 0.0, 0.34)[..., None]
    return working.astype(np.float32) * (1.0 - a) + warped * a


def _skin_tone_polish(rgb: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Low-strength color/texture equalization that preserves natural pores."""
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    l, a, b = cv2.split(lab)
    l_smooth = cv2.bilateralFilter(l, 9, 30, 26)
    a_smooth = cv2.bilateralFilter(a, 9, 18, 22)
    b_smooth = cv2.bilateralFilter(b, 9, 18, 22)
    polished = cv2.cvtColor(cv2.merge([l_smooth, a_smooth, b_smooth]), cv2.COLOR_LAB2RGB)
    m = np.clip(mask[..., None] * 0.42, 0.0, 0.42)
    return (rgb.astype(np.float32) * (1.0 - m) + polished.astype(np.float32) * m)


def simulate_wrinkle_treatment(
    rgb: np.ndarray,
    mask: np.ndarray,
    *,
    mode: TreatmentMode = "combined",
    strength: float = 0.72,
    preset: SimulationPreset = "natural",
    lateral_fold_mask: np.ndarray | None = None,
    glabella_mask: np.ndarray | None = None,
) -> np.ndarray:
    """Return treated RGB image."""
    strength = float(np.clip(strength, 0.0, 1.0))
    if preset == "dramatic":
        preset_boost = 3.50
    elif preset == "calibrated":
        preset_boost = 2.65
    elif preset == "reference":
        preset_boost = 1.38
    else:
        preset_boost = 1.0
    rgb_f = rgb.astype(np.float32)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)

    if mode == "tox":
        hf_sigma = 1.8
        hf_atten = 0.42 * strength * preset_boost
        shadow_lift = 0.26 * strength * preset_boost
        polish_mix = 0.18 * strength * preset_boost
        inpaint_mix = 0.20 * strength * preset_boost
        inpaint_r = 3
    elif mode == "laser":
        hf_sigma = 2.8
        hf_atten = 0.52 * strength * preset_boost
        shadow_lift = 0.22 * strength * preset_boost
        polish_mix = 0.34 * strength * preset_boost
        inpaint_mix = 0.16 * strength * preset_boost
        inpaint_r = 3
    else:
        hf_sigma = 2.3
        hf_atten = 0.58 * strength * preset_boost
        shadow_lift = 0.32 * strength * preset_boost
        polish_mix = 0.30 * strength * preset_boost
        inpaint_mix = 0.24 * strength * preset_boost
        inpaint_r = 4

    hf_atten = min(hf_atten, 0.92)
    polish_mix = min(polish_mix, 0.62)
    inpaint_mix = min(inpaint_mix, 0.42)

    core = _crease_core_mask(rgb, mask)
    crease_binary = (core > 0.18).astype(np.uint8) * 255
    inpainted = cv2.inpaint(rgb, crease_binary, inpaint_r, cv2.INPAINT_TELEA).astype(
        np.float32,
    )
    inpaint_blend = np.clip(core * inpaint_mix, 0.0, 0.32)[..., None]
    base_rgb = rgb_f * (1.0 - inpaint_blend) + inpainted * inpaint_blend

    base = cv2.bilateralFilter(base_rgb.astype(np.uint8), 9, 42, 34)

    k = max(3, int(round(hf_sigma * 2)) | 1)
    base_f = base.astype(np.float32)
    low = cv2.GaussianBlur(base_f, (k, k), hf_sigma)
    high = base_f - cv2.GaussianBlur(base_f, (k, k), hf_sigma)
    m = mask[..., None]
    treated = low + high * (1.0 - m * hf_atten)

    crease_dark = np.clip((108.0 - gray) / 108.0, 0.0, 1.0)
    treated += (core[..., None] * 0.75 + m * 0.25) * crease_dark[..., None] * (
        shadow_lift * 48.0
    )

    polish = _skin_tone_polish(base, mask)
    treated = treated * (1.0 - m * polish_mix) + polish * (m * polish_mix)

    if preset in ("reference", "calibrated", "dramatic"):
        broad_mix = 0.48 if preset == "reference" else (0.82 if preset == "calibrated" else 0.96)
        line_lift = 28.0 if preset == "reference" else (82.0 if preset == "calibrated" else 110.0)
        porcelain_sigma = 1.8 if preset == "reference" else 2.6
        broad = cv2.GaussianBlur(mask, (0, 0), max(6.0, min(rgb.shape[:2]) * 0.018))
        broad = np.clip(broad[..., None] * strength * broad_mix, 0.0, broad_mix)
        porcelain = cv2.bilateralFilter(base.astype(np.uint8), 23, 70, 54).astype(np.float32)
        porcelain = cv2.GaussianBlur(porcelain, (0, 0), porcelain_sigma)
        treated = treated * (1.0 - broad) + porcelain * broad
        line_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (31, 5))
        dark_lines = cv2.morphologyEx(
            cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY),
            cv2.MORPH_BLACKHAT,
            line_kernel,
        ).astype(np.float32)
        valid = mask > 0.12
        if np.any(valid):
            low_p = float(np.percentile(dark_lines[valid], 54))
            high_p = max(low_p + 1.0, float(np.percentile(dark_lines[valid], 93)))
            line_w = np.clip((dark_lines - low_p) / (high_p - low_p), 0.0, 1.0)
            line_w = cv2.GaussianBlur(line_w * mask, (0, 0), 2.2)[..., None]
            treated += line_w * (line_lift * strength)

        if preset in ("calibrated", "dramatic"):
            smooth_strength = 0.38 if preset == "calibrated" else 0.58
            very_low = cv2.bilateralFilter(base.astype(np.uint8), 31, 92, 72).astype(np.float32)
            very_low = cv2.GaussianBlur(very_low, (0, 0), 3.4)
            smooth_field = np.clip(
                cv2.GaussianBlur(mask, (0, 0), max(8.0, min(rgb.shape[:2]) * 0.026))
                * strength
                * smooth_strength,
                0.0,
                smooth_strength,
            )[..., None]
            treated = treated * (1.0 - smooth_field) + very_low * smooth_field

    # Reintroduce fine skin grain so treated zones don't look airbrushed.
    grain = rgb_f - cv2.GaussianBlur(rgb_f, (0, 0), 1.6)
    grain_mix = 0.32 + 0.18 * (1.0 - strength)
    if preset == "reference":
        grain_mix *= 0.46
    elif preset == "calibrated":
        grain_mix *= 0.18
    elif preset == "dramatic":
        grain_mix *= 0.10
    treated += grain * m * grain_mix

    out_mask = m
    if preset in ("calibrated", "dramatic") and lateral_fold_mask is not None:
        out_mask = np.maximum(out_mask, np.clip(lateral_fold_mask[..., None] * 0.96, 0.0, 0.96))
    out = rgb_f * (1.0 - out_mask) + treated * out_mask

    if preset in ("calibrated", "dramatic"):
        fold_strength_mult = 1.22 if preset == "calibrated" else 1.38
        out = _relax_lateral_eye_geometry(
            rgb,
            out,
            _load("crease_for_warp", "wrinkle_crease_detect.py"),
            lateral_fold_mask,
            strength=strength,
        )
        under_mask = _under_eye_refinement_mask(
            rgb,
            _load("crease_for_under_eye", "wrinkle_crease_detect.py"),
            mask,
        )
        out = _smooth_under_eye_texture(out, under_mask, strength=strength, rgb_orig=rgb)
        residual_mask = _residual_periocular_line_mask(
            out.astype(np.uint8),
            _load("crease_for_residual", "wrinkle_crease_detect.py"),
            mask,
        )
        out = _heal_residual_periocular_lines(
            rgb,
            out,
            residual_mask,
            strength=strength,
        )
        forehead_mask = _forehead_line_mask(
            out.astype(np.uint8),
            _load("crease_for_forehead", "wrinkle_crease_detect.py"),
            mask,
        )
        out = _heal_forehead_lines(
            rgb,
            out,
            forehead_mask,
            strength=strength,
        )
        if glabella_mask is not None:
            out = _heal_glabella_folds(
                rgb,
                out,
                glabella_mask,
                strength=strength,
            )
        if lateral_fold_mask is not None:
            out = _heal_lateral_canthus_fold(
                rgb,
                out,
                lateral_fold_mask,
                strength=min(1.0, strength * fold_strength_mult),
            )
        crease_mod_final = _load("crease_for_eye_restore", "wrinkle_crease_detect.py")
        eye_restore = _all_eye_protect_mask(
            cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY),
            rgb.shape[0],
            rgb.shape[1],
            crease_mod_final,
        )
        eye_restore = np.clip((eye_restore - 0.22) / 0.48, 0.0, 1.0)[..., None]
        out = out * (1.0 - eye_restore) + rgb.astype(np.float32) * eye_restore

    return np.clip(out, 0, 255).astype(np.uint8)


def _overlay_mask_preview(rgb: np.ndarray, mask: np.ndarray) -> np.ndarray:
    tint = rgb.astype(np.float32).copy()
    tint[:, :, 0] = np.clip(tint[:, :, 0] + mask * 55, 0, 255)
    tint[:, :, 2] = np.clip(tint[:, :, 2] + mask * 35, 0, 255)
    return tint.astype(np.uint8)


def _label_bar(text: str, width: int, *, height: int = 42) -> np.ndarray:
    bar = np.full((height, width, 3), 255, np.uint8)
    pil = Image.fromarray(bar)
    draw = ImageDraw.Draw(pil)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 18)
    except OSError:
        font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    draw.text(((width - tw) // 2, 10), text, fill=(30, 30, 30), font=font)
    return np.array(pil)


def _find_vertical_panel_split(rgb: np.ndarray) -> int | None:
    """Find the white divider in a side-by-side before/after marketing board."""
    h, w = rgb.shape[:2]
    y0 = int(h * 0.12)
    y1 = int(h * 0.90)
    strip = rgb[y0:y1]
    if strip.size == 0:
        return None

    whiteness = np.mean(np.min(strip, axis=2), axis=0)
    col_std = np.mean(np.std(strip.astype(np.float32), axis=2), axis=0)
    score = whiteness - col_std * 0.35
    search0 = int(w * 0.38)
    search1 = int(w * 0.62)
    if search1 <= search0:
        return None
    local = score[search0:search1]
    if local.size == 0:
        return None

    split = int(search0 + np.argmax(local))
    if score[split] < 188:
        return None
    return split


def _trim_panel_chrome(rgb: np.ndarray, *, from_board: bool = False) -> np.ndarray:
    """Remove bright title/footer borders from a panel crop while keeping the face crop."""
    h, w = rgb.shape[:2]
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    non_white = gray < 244

    row_density = np.mean(non_white, axis=1)
    col_density = np.mean(non_white, axis=0)
    rows = np.where(row_density > 0.08)[0]
    cols = np.where(col_density > 0.08)[0]
    if rows.size == 0 or cols.size == 0:
        return rgb

    y0 = int(rows[0])
    y1 = int(rows[-1]) + 1
    x0 = int(cols[0])
    x1 = int(cols[-1]) + 1

    # Bottom clinic logos/captions are usually separated by a white band. Prefer the
    # largest non-white face/photo block above the lower fifth of the input board.
    if h > 500:
        candidate = row_density > 0.18
        runs: list[tuple[int, int]] = []
        start: int | None = None
        for i, ok in enumerate(candidate):
            if ok and start is None:
                start = i
            elif not ok and start is not None:
                if i - start > h * 0.12:
                    runs.append((start, i))
                start = None
        if start is not None and h - start > h * 0.12:
            runs.append((start, h))
        if runs:
            y0, y1 = max(runs, key=lambda r: r[1] - r[0])

    pad = max(0, min(h, w) // 180)
    y0 = max(0, y0 - pad)
    x0 = max(0, x0 - pad)
    y1 = min(h, y1 + pad)
    x1 = min(w, x1 + pad)
    crop = rgb[y0:y1, x0:x1]

    if from_board and crop.shape[0] > 420:
        # Before/after boards often burn "BEFORE" / "AFTER" labels into the lower
        # photo corner. Drop a thin lower band so text is not treated as anatomy.
        bottom_trim = int(round(crop.shape[0] * 0.065))
        if bottom_trim > 0:
            crop = crop[:-bottom_trim]

    return crop


def extract_source_region(
    rgb: np.ndarray,
    region: SourceRegion,
) -> tuple[np.ndarray, dict[str, object]]:
    """Normalize either a direct before image or a side-by-side board into one crop."""
    if region == "full":
        return rgb, {"sourceRegion": "full"}

    h, w = rgb.shape[:2]
    split = _find_vertical_panel_split(rgb)
    should_extract = region in ("left-panel", "right-panel") or (
        region == "auto-left-panel" and split is not None and w >= h * 0.85
    )
    if not should_extract:
        return rgb, {"sourceRegion": "full", "autoPanelDetected": False}

    split = split if split is not None else w // 2
    margin = max(2, w // 220)
    if region == "right-panel":
        crop = rgb[:, min(w, split + margin) :]
        used = "right-panel"
    else:
        crop = rgb[:, : max(1, split - margin)]
        used = "left-panel"

    crop = _trim_panel_chrome(crop, from_board=True)
    return crop, {
        "sourceRegion": used,
        "autoPanelDetected": split is not None,
        "panelSplitX": split,
        "inputSize": [w, h],
        "cropSize": [int(crop.shape[1]), int(crop.shape[0])],
    }


def build_before_after_panel(
    before: np.ndarray,
    after: np.ndarray,
    *,
    title: str,
    mode: TreatmentMode,
) -> np.ndarray:
    h, w = before.shape[:2]
    gap = 8
    label_h = 42
    canvas_w = w * 2 + gap
    canvas = np.full((h + label_h, canvas_w, 3), 245, np.uint8)
    canvas[:label_h, :w] = _label_bar("Before", w)
    canvas[:label_h, w + gap :] = _label_bar(f"After ({mode})", w)
    canvas[label_h:, :w] = before
    canvas[label_h:, w + gap : w + gap + w] = after
    canvas[label_h:, w : w + gap] = 220

    footer_h = 28
    footer = np.full((footer_h, canvas_w, 3), 245, np.uint8)
    pil = Image.fromarray(footer)
    draw = ImageDraw.Draw(pil)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 13)
    except OSError:
        font = ImageFont.load_default()
    draw.text((12, 6), title, fill=(90, 90, 90), font=font)
    return np.vstack([canvas, np.array(footer)])


def build_three_panel(
    before: np.ndarray,
    simulated: np.ndarray,
    ground_truth: np.ndarray,
    *,
    title: str,
    mode: TreatmentMode,
) -> np.ndarray:
    h, w = before.shape[:2]
    gap = 10
    label_h = 44
    canvas_w = w * 3 + gap * 2
    canvas = np.full((h + label_h, canvas_w, 3), 230, np.uint8)
    canvas[:label_h, :w] = _label_bar("Before", w, height=label_h)
    canvas[:label_h, w + gap : w + gap + w] = _label_bar(f"Simulated After ({mode})", w, height=label_h)
    canvas[:label_h, w * 2 + gap * 2 :] = _label_bar("Real After", w, height=label_h)
    canvas[label_h:, :w] = before
    canvas[label_h:, w + gap : w + gap + w] = simulated
    gt_resized = cv2.resize(ground_truth, (w, h), interpolation=cv2.INTER_AREA)
    canvas[label_h:, w * 2 + gap * 2 : w * 3 + gap * 2] = gt_resized
    return canvas


def process_image(
    img_path: Path,
    out_dir: Path,
    *,
    stem: str | None = None,
    mode: TreatmentMode = "combined",
    strength: float = 0.72,
    source_region: SourceRegion = "full",
    preset: SimulationPreset = "natural",
    guide_mask_path: Path | None = None,
    guided_heal_mode: GuidedHealMode = "natural",
    ground_truth_path: Path | None = None,
) -> dict[str, Path]:
    crease_mod = _load("crease", "wrinkle_crease_detect.py")
    cutout_mod = _load("cutout", "wrinkle_cutout_render.py")

    out_dir.mkdir(parents=True, exist_ok=True)
    input_rgb = np.array(Image.open(img_path).convert("RGB"))
    rgb, region_meta = extract_source_region(input_rgb, source_region)
    ih, iw = rgb.shape[:2]
    stem = stem or img_path.stem
    guide_mask: np.ndarray | None = None
    healed_rgb: np.ndarray | None = None
    if guide_mask_path is not None:
        markup = np.array(Image.open(guide_mask_path).convert("RGB"))
        if markup.shape[:2] != rgb.shape[:2]:
            raise ValueError(
                f"Guide mask size {markup.shape[1]}x{markup.shape[0]} does not match "
                f"source size {iw}x{ih}: {guide_mask_path}",
            )
        guide_mask = _guided_heal_mask_from_markup(markup, rgb)
        healed_rgb = _guided_spot_heal(
            rgb,
            guide_mask,
            mode=guided_heal_mode,
            crease_mod=crease_mod,
        )

    paths, meta = crease_mod.detect_wrinkle_creases_periocular_cv(rgb, None, iw, ih)
    zone_expand = max(14, int(min(ih, iw) * 0.028))
    if preset == "dramatic":
        eye_protect_strength = 0.45
    elif preset == "calibrated":
        eye_protect_strength = 0.58
    else:
        eye_protect_strength = 1.0
    mask = _build_treatment_mask(
        rgb,
        paths,
        crease_mod,
        cutout_mod,
        zone_expand=zone_expand,
        eye_protect_strength=eye_protect_strength,
    )
    sim_source = healed_rgb if healed_rgb is not None else rgb
    if guide_mask is not None:
        guide_soft = cv2.GaussianBlur(guide_mask.astype(np.float32) / 255.0, (0, 0), 7.0)
        mask = np.clip(np.maximum(mask, guide_soft * 0.86), 0.0, 1.0)
    lateral_fold_mask = None
    glabella_mask = None
    if preset in ("calibrated", "dramatic"):
        lateral_fold_mask = _lateral_canthus_fold_mask(rgb, crease_mod, mask)
        glabella_mask = _glabella_fold_mask(rgb, crease_mod, mask)
    treated = simulate_wrinkle_treatment(
        sim_source,
        mask,
        mode=mode,
        strength=strength,
        preset=preset,
        lateral_fold_mask=lateral_fold_mask,
        glabella_mask=glabella_mask,
    )

    paths_out: dict[str, Path] = {}
    before_path = out_dir / f"{stem}-before.jpg"
    treated_path = out_dir / f"{stem}-treated-{mode}.jpg"
    panel_path = out_dir / f"{stem}-before-after-{mode}.jpg"
    mask_path = out_dir / f"{stem}-treatment-mask.jpg"
    fold_mask_path = out_dir / f"{stem}-lateral-fold-mask.jpg"
    glabella_mask_path = out_dir / f"{stem}-glabella-mask.jpg"

    Image.fromarray(rgb, "RGB").save(before_path, quality=92)
    Image.fromarray(treated, "RGB").save(treated_path, quality=92)
    Image.fromarray(
        build_before_after_panel(rgb, treated, title=img_path.name, mode=mode),
        "RGB",
    ).save(panel_path, quality=92)
    Image.fromarray(_overlay_mask_preview(rgb, mask), "RGB").save(mask_path, quality=90)
    if lateral_fold_mask is not None:
        Image.fromarray(_overlay_mask_preview(rgb, lateral_fold_mask), "RGB").save(
            fold_mask_path,
            quality=90,
        )
    if glabella_mask is not None:
        Image.fromarray(_overlay_mask_preview(rgb, glabella_mask), "RGB").save(
            glabella_mask_path,
            quality=90,
        )
    if ground_truth_path is not None:
        gt_rgb = np.array(Image.open(ground_truth_path).convert("RGB"))
        three_panel_path = out_dir / f"{stem}-three-panel-{mode}.jpg"
        Image.fromarray(
            build_three_panel(rgb, treated, gt_rgb, title=img_path.name, mode=mode),
            "RGB",
        ).save(three_panel_path, quality=93)
        paths_out["threePanel"] = three_panel_path

    meta_path = out_dir / f"{stem}-meta.json"
    import json

    meta_path.write_text(
        json.dumps(
            {
                "source": str(img_path),
                "guideMask": str(guide_mask_path) if guide_mask_path else None,
                "guidedHealMode": guided_heal_mode if guide_mask_path else None,
                "pathCount": len(paths),
                "mode": mode,
                "strength": strength,
                "preset": preset,
                "region": region_meta,
                "lateralFoldMask": str(fold_mask_path) if lateral_fold_mask is not None else None,
                "glabellaMask": str(glabella_mask_path) if glabella_mask is not None else None,
                "detection": meta,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    paths_out["before"] = before_path
    paths_out["treated"] = treated_path
    paths_out["panel"] = panel_path
    paths_out["mask"] = mask_path
    if lateral_fold_mask is not None:
        paths_out["lateralFoldMask"] = fold_mask_path
    if glabella_mask is not None:
        paths_out["glabellaMask"] = glabella_mask_path
    paths_out["meta"] = meta_path
    print(
        f"{stem}: {len(paths)} crease paths → {treated_path.name} "
        f"(mode={mode}, strength={strength:.2f})",
        flush=True,
    )
    return paths_out


def main() -> None:
    parser = argparse.ArgumentParser(description="Simulate wrinkle treatment smoothing.")
    parser.add_argument("images", nargs="+", type=Path, help="Input periocular / face crops")
    parser.add_argument(
        "-o",
        "--out-dir",
        type=Path,
        default=ROOT / "public" / "demo-3d" / "wrinkle-treatment-simulation",
    )
    parser.add_argument(
        "--mode",
        choices=("tox", "laser", "combined"),
        default="combined",
        help="tox = dynamic lines; laser = texture; combined = both",
    )
    parser.add_argument("--stem", type=str, default=None, help="Output filename stem")
    parser.add_argument("--strength", type=float, default=0.88, help="0–1 treatment intensity")
    parser.add_argument(
        "--preset",
        choices=("natural", "reference", "calibrated", "dramatic"),
        default="calibrated",
        help=(
            "natural keeps more texture; reference is polished; calibrated matches "
            "typical Botox results; dramatic pushes toward the most aggressive examples."
        ),
    )
    parser.add_argument(
        "--source-region",
        choices=("full", "left-panel", "right-panel", "auto-left-panel"),
        default="full",
        help=(
            "Use full input, a side-by-side panel, or auto-detect a left before panel "
            "from a before/after board."
        ),
    )
    parser.add_argument(
        "--guide-mask",
        type=Path,
        default=None,
        help="Annotated image with neutral gray wrinkle strokes to spot-heal before simulation",
    )
    parser.add_argument(
        "--guided-heal-mode",
        choices=("natural", "smooth", "glass", "photoshop"),
        default="natural",
        help="How aggressively to heal guide-mask strokes before simulation",
    )
    parser.add_argument("--all-modes", action="store_true", help="Export tox, laser, and combined")
    parser.add_argument(
        "--ground-truth",
        type=Path,
        default=None,
        help="Real after image to include as a third panel in the comparison composite",
    )
    args = parser.parse_args()

    modes: list[TreatmentMode] = ["tox", "laser", "combined"] if args.all_modes else [args.mode]
    for img in args.images:
        if not img.is_file():
            print(f"skip missing: {img}")
            continue
        for mode in modes:
            process_image(
                img.resolve(),
                args.out_dir.resolve(),
                stem=args.stem,
                mode=mode,
                strength=args.strength,
                source_region=args.source_region,
                preset=args.preset,
                guide_mask_path=args.guide_mask.resolve() if args.guide_mask else None,
                guided_heal_mode=args.guided_heal_mode,
                ground_truth_path=args.ground_truth.resolve() if args.ground_truth else None,
            )


if __name__ == "__main__":
    main()
