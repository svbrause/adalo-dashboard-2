#!/usr/bin/env python3
"""Generate Aura-style pigmentation maps for Tanya's 45-left photo.

This is closer to the Aura references than a hand-drawn annotation: create a
flattened clinical skin texture, compute a per-pixel pigment signal, then mask it
to skin while excluding brows, eyes, lips, hair, nostril shadows, and clothing.
"""

from __future__ import annotations

from pathlib import Path
import subprocess

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public/demo-3d/tanya-tan-45-left.png"
OUT_GRAY = ROOT / "public/demo-3d/tanya-tan-45-left-pigmentation-gray.png"
OUT_BROWN = ROOT / "public/demo-3d/tanya-tan-45-left-pigmentation-brown.png"
OUT_MASK = ROOT / "public/demo-3d/tanya-tan-45-left-pigmentation-mask.png"

def face_landmarker_model() -> Path:
    cache = ROOT / ".cache" / "face_landmarker.task"
    if not cache.exists():
        cache.parent.mkdir(parents=True, exist_ok=True)
        url = (
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/"
            "face_landmarker/float16/1/face_landmarker.task"
        )
        subprocess.run(["curl", "-fsSL", url, "-o", str(cache)], check=True, timeout=180)
    return cache


def landmarks_for(rgb: np.ndarray):
    import mediapipe as mp
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision

    opts = vision.FaceLandmarkerOptions(
        base_options=mp_python.BaseOptions(
            model_asset_path=str(face_landmarker_model()),
            delegate=mp_python.BaseOptions.Delegate.CPU,
        ),
        running_mode=vision.RunningMode.IMAGE,
        num_faces=1,
    )
    landmarker = vision.FaceLandmarker.create_from_options(opts)
    mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb))
    result = landmarker.detect(mp_img)
    landmarker.close()
    if not result.face_landmarks:
        raise RuntimeError("No face landmarks detected")
    return result.face_landmarks[0]


def hull_mask(shape: tuple[int, int], points: list[tuple[int, int]], blur: int = 0) -> np.ndarray:
    mask = np.zeros(shape, np.uint8)
    if len(points) >= 3:
        cv2.fillConvexPoly(mask, cv2.convexHull(np.array(points, np.int32)), 255)
    if blur:
        mask = cv2.GaussianBlur(mask, (0, 0), blur)
    return mask


def skin_mask(rgb: np.ndarray) -> np.ndarray:
    h, w = rgb.shape[:2]
    try:
        lm = landmarks_for(rgb)
    except Exception:
        return manual_skin_mask(rgb)
    pts = [(int(p.x * w), int(p.y * h)) for p in lm]

    face = hull_mask((h, w), pts, blur=9)
    face = cv2.erode(face, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31)), 1)

    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    hh, sat, val = cv2.split(hsv)
    rgbf = rgb.astype(np.int16)
    skin_color = (
        (val > 56)
        & (val < 244)
        & (sat > 10)
        & (sat < 145)
        & (rgbf[:, :, 0] > rgbf[:, :, 2] - 10)
        & (rgbf[:, :, 1] > rgbf[:, :, 2] - 34)
        & ((hh < 28) | (hh > 165))
    ).astype(np.uint8) * 255

    mask = cv2.bitwise_and(face, cv2.medianBlur(skin_color, 7))

    # Landmark groups to subtract. These intentionally over-mask facial features
    # because the source RGB image has dark brows/eyes that look like pigment.
    feature_groups = [
        # Left/right eyes + brows
        [33, 7, 163, 144, 145, 153, 154, 155, 133, 246, 161, 160, 159, 158, 157, 173, 46, 53, 52, 65, 55, 70, 63, 105, 66, 107],
        [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398, 276, 283, 282, 295, 285, 300, 293, 334, 296, 336],
        # Lips
        [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95],
        # Nose holes and deep nose crease
        [1, 2, 4, 5, 94, 97, 98, 99, 326, 327, 328, 168, 197],
    ]
    exclude = np.zeros((h, w), np.uint8)
    for group in feature_groups:
        group_pts = [pts[i] for i in group if i < len(pts)]
        part = hull_mask((h, w), group_pts)
        part = cv2.dilate(part, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (45, 45)), 2)
        exclude = cv2.bitwise_or(exclude, part)

    # Extra conservative top-band removal around brows/hairline on this crop.
    exclude[: int(0.36 * h), :] = 255

    mask = cv2.bitwise_and(mask, cv2.bitwise_not(exclude))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)), 1)
    mask = cv2.GaussianBlur(mask, (0, 0), 5)
    return mask


def manual_skin_mask(rgb: np.ndarray) -> np.ndarray:
    """Fallback tuned to Tanya's fixed 45-left demo capture.

    We keep this intentionally cheek-focused. The Aura references likely use
    controlled scan/UV texture data, but this source is a normal RGB portrait;
    normal shadows around eyes, nose, mouth, and jaw otherwise dominate.
    """
    h, w = rgb.shape[:2]
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    hh, sat, val = cv2.split(hsv)
    rgbf = rgb.astype(np.int16)
    skin_color = (
        (val > 62)
        & (val < 245)
        & (sat > 10)
        & (sat < 135)
        & (rgbf[:, :, 0] > rgbf[:, :, 2] - 8)
        & (rgbf[:, :, 1] > rgbf[:, :, 2] - 36)
        & ((hh < 28) | (hh > 165))
    ).astype(np.uint8) * 255

    cheek_polys = [
        np.array(
            [(985, 1230), (1290, 1125), (1635, 1165), (1810, 1370), (1755, 1605), (1510, 1780), (1125, 1690), (900, 1480)],
            np.int32,
        ),
        np.array(
            [(1160, 1455), (1510, 1450), (1760, 1610), (1695, 1840), (1375, 1910), (1085, 1740)],
            np.int32,
        ),
    ]
    roi = np.zeros((h, w), np.uint8)
    for poly in cheek_polys:
        cv2.fillPoly(roi, [poly], 255)

    exclude = np.zeros((h, w), np.uint8)
    cv2.rectangle(exclude, (980, 930), (1580, 1225), 255, -1)   # eye + brow
    cv2.rectangle(exclude, (660, 1360), (960, 1620), 255, -1)   # nostril shadow
    cv2.rectangle(exclude, (650, 1710), (1220, 2030), 255, -1)  # lips
    cv2.rectangle(exclude, (1760, 1020), (2060, 1680), 255, -1) # ear/hair edge

    mask = cv2.bitwise_and(roi, skin_color)
    mask = cv2.bitwise_and(mask, cv2.bitwise_not(exclude))
    mask[:, :1050] = 0
    mask[:1250, :] = 0
    mask[:, 1700:] = 0
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (17, 17)), 1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (39, 39)), 1)
    return cv2.GaussianBlur(mask, (0, 0), 7)


def pigment_signal(rgb: np.ndarray, mask: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    l = lab[:, :, 0].astype(np.float32)
    a = lab[:, :, 1].astype(np.float32)
    b = lab[:, :, 2].astype(np.float32)
    local_l = cv2.GaussianBlur(l, (0, 0), 34)
    dark = np.maximum(local_l - l, 0)
    skin = mask > 20
    if skin.sum() < 100:
        return np.zeros_like(l, np.float32), np.zeros_like(l, np.float32)

    def robust_z(x: np.ndarray) -> np.ndarray:
        med = np.median(x[skin])
        p16, p84 = np.percentile(x[skin], [16, 84])
        return (x - med) / max(float(p84 - p16), 1.0)

    score = 0.72 * robust_z(dark) + 0.36 * robust_z(a) + 0.16 * robust_z(b)
    score[~skin] = -4
    score = cv2.GaussianBlur(score, (0, 0), 1.2)

    diffuse = np.clip((score - np.percentile(score[skin], 62)) / 1.8, 0, 1)
    flecks = np.clip((score - np.percentile(score[skin], 78)) / 1.3, 0, 1)
    texture = cv2.createCLAHE(clipLimit=2.4, tileGridSize=(8, 8)).apply(l.astype(np.uint8))
    local_texture = cv2.GaussianBlur(texture.astype(np.float32), (0, 0), 18)
    flecks *= np.clip((local_texture - texture) / 20.0, 0, 1)

    return diffuse * (mask / 255.0), flecks * (mask / 255.0)


def build_overlay(diffuse: np.ndarray, flecks: np.ndarray, palette: str) -> Image.Image:
    h, w = diffuse.shape
    overlay = np.zeros((h, w, 4), np.uint8)
    if palette == "gray":
        diffuse_color = np.array([238, 130, 96], np.uint8)
        fleck_color = np.array([80, 48, 92], np.uint8)
    else:
        diffuse_color = np.array([132, 82, 48], np.uint8)
        fleck_color = np.array([84, 48, 28], np.uint8)

    d = cv2.GaussianBlur(diffuse, (0, 0), 5)
    f = cv2.GaussianBlur(flecks, (0, 0), 0.7)
    overlay[:, :, :3] = diffuse_color
    overlay[:, :, 3] = np.clip(d * 72, 0, 72).astype(np.uint8)

    fleck_px = f > 0.08
    overlay[fleck_px, :3] = fleck_color
    overlay[fleck_px, 3] = np.maximum(overlay[fleck_px, 3], np.clip(f[fleck_px] * 185, 0, 185).astype(np.uint8))
    return Image.fromarray(overlay, "RGBA")


def clinical_base(src: Image.Image, palette: str) -> Image.Image:
    rgb = np.array(src.convert("RGB"))
    gray_cv = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    flat = cv2.divide(gray_cv, cv2.GaussianBlur(gray_cv, (0, 0), 52), scale=138)
    flat = cv2.createCLAHE(clipLimit=1.35, tileGridSize=(8, 8)).apply(flat)
    flat = np.clip(flat.astype(np.float32) * 0.72 + gray_cv.astype(np.float32) * 0.28, 0, 255).astype(np.uint8)
    if palette == "gray":
        gray = ImageOps.autocontrast(Image.fromarray(flat, "L"), cutoff=1)
        base = Image.merge("RGB", (gray, gray, gray)).convert("RGBA")
        return ImageEnhance.Contrast(base).enhance(0.92)

    sepia = Image.fromarray(flat, "L")
    sepia = ImageOps.colorize(sepia, black="#2a211d", white="#e5d0bd")
    return ImageEnhance.Contrast(sepia.convert("RGBA")).enhance(0.95)


def main() -> None:
    src = Image.open(SRC).convert("RGB")
    rgb = np.array(src)
    mask = skin_mask(rgb)
    diffuse, flecks = pigment_signal(rgb, mask)

    for palette, out_path in (("gray", OUT_GRAY), ("brown", OUT_BROWN)):
        base = clinical_base(src, palette)
        overlay = build_overlay(diffuse, flecks, palette)
        out = Image.alpha_composite(base, overlay)
        out.save(out_path, format="PNG", optimize=True)

    Image.fromarray(mask, "L").save(OUT_MASK, format="PNG", optimize=True)
    print(f"Wrote {OUT_GRAY.relative_to(ROOT)}")
    print(f"Wrote {OUT_BROWN.relative_to(ROOT)}")
    print(f"Wrote {OUT_MASK.relative_to(ROOT)}")
if __name__ == "__main__":
    main()
