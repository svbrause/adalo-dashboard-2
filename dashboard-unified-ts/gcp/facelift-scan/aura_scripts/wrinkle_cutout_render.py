"""Render transparent wrinkle-line cutouts (RGBA)."""

from __future__ import annotations

import cv2
import numpy as np


def viewbox_paths_to_pixels(
    paths: list[list[list[float]]],
    img_w: int,
    img_h: int,
) -> list[list[list[float]]]:
    out: list[list[list[float]]] = []
    for path in paths:
        pts: list[list[float]] = []
        for vx, vy in path:
            pts.append([float(vx) / 100.0 * img_w, float(vy) / 100.0 * img_h])
        if len(pts) >= 2:
            out.append(pts)
    return out


def render_wrinkle_cutout_rgba(
    img_h: int,
    img_w: int,
    paths_viewbox: list[list[list[float]]],
    face_alpha: np.ndarray | None = None,
) -> np.ndarray:
    """RGBA plate: transparent background, brown crease strokes only."""
    rgba = np.zeros((img_h, img_w, 4), np.uint8)
    paths_px = viewbox_paths_to_pixels(paths_viewbox, img_w, img_h)

    for path in paths_px:
        pts = np.array([[round(x), round(y)] for x, y in path], dtype=np.int32)
        if len(pts) < 2:
            continue
        # Soft halo then crisp core (warm brown, visible on cutout + color still)
        cv2.polylines(rgba, [pts], False, (110, 130, 155, 110), 4, cv2.LINE_AA)
        cv2.polylines(rgba, [pts], False, (72, 92, 118, 220), 3, cv2.LINE_AA)
        cv2.polylines(rgba, [pts], False, (48, 62, 82, 255), 2, cv2.LINE_AA)

    if face_alpha is not None:
        line_a = rgba[:, :, 3]
        fa = face_alpha if face_alpha.ndim == 2 else face_alpha[:, :, 0]
        rgba[:, :, 3] = cv2.bitwise_and(line_a, fa)

    return rgba


def studio_backdrop_mask(rgb: np.ndarray) -> np.ndarray:
    """Return uint8 mask (255 = person, 0 = background) for studio-lit portraits.

    Works by sampling the background colour from the image border, computing
    per-pixel colour distance, then flood-filling the connected background
    region from all four corners.  Handles white, grey, and beige seamless
    backdrops without relying on rembg alpha quality.
    """
    h, w = rgb.shape[:2]
    pad = max(10, min(h, w) // 30)
    edges = np.concatenate([
        rgb[:pad, :].reshape(-1, 3),
        rgb[-pad:, :].reshape(-1, 3),
        rgb[:, :pad].reshape(-1, 3),
        rgb[:, -pad:].reshape(-1, 3),
    ])
    bg_color = np.median(edges, axis=0).astype(np.float32)

    dist = np.linalg.norm(rgb.astype(np.float32) - bg_color, axis=2)

    # Threshold: pixels within 22 colour units of the background → candidate BG.
    # Use a slightly larger threshold (35) if most of the border is uniform.
    border_std = float(dist[:pad].std() + dist[-pad:].std() + dist[:, :pad].std() + dist[:, -pad:].std()) / 4
    thr = 22 if border_std > 8 else 35
    bg_binary = (dist < thr).astype(np.uint8) * 255

    # Flood-fill connected background from all four corners.
    seed_mask = np.zeros((h + 2, w + 2), np.uint8)
    for corner in [(0, 0), (0, w - 1), (h - 1, 0), (h - 1, w - 1)]:
        cy, cx = corner
        if bg_binary[cy, cx] == 255:
            cv2.floodFill(bg_binary, seed_mask, (cx, cy), 128)

    # 128 = connected background, 255 = isolated BG island (keep as FG), 0 = FG.
    connected_bg = (bg_binary == 128).astype(np.uint8) * 255
    fg_mask = 255 - connected_bg

    # Morphological clean-up: close small holes inside the person, erode 1 px
    # to avoid background fringe.
    k_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))
    k_erode = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, k_close, iterations=2)
    fg_mask = cv2.erode(fg_mask, k_erode, iterations=1)

    # Soft edge via Gaussian blur (avoids hard jagged cut).
    fg_soft = cv2.GaussianBlur(fg_mask.astype(np.float32), (0, 0), 3.0)
    return np.clip(fg_soft, 0, 255).astype(np.uint8)


def flatten_rgb_on_black(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """Composite person onto pure black using a soft alpha matte."""
    a = alpha.astype(np.float32) / 255.0
    if a.ndim == 3:
        a = a[:, :, 0]
    return np.clip(rgb.astype(np.float32) * a[:, :, None], 0, 255).astype(np.uint8)


def restore_interior_black_holes(fg_rgb: np.ndarray, src_rgb: np.ndarray) -> np.ndarray:
    """Restore black cutout holes that are inside the subject silhouette.

    Keeps border-connected black pixels as true background, but fills interior
    islands from the source RGB to avoid "missing face" artifacts.
    """
    out = fg_rgb.copy()
    black = ((out[:, :, 0] < 6) & (out[:, :, 1] < 6) & (out[:, :, 2] < 6)).astype(np.uint8)
    num, labels = cv2.connectedComponents(black, connectivity=8)
    if num <= 1:
        return out
    h, w = black.shape
    border_labels = set(np.unique(np.concatenate([
        labels[0, :],
        labels[h - 1, :],
        labels[:, 0],
        labels[:, w - 1],
    ]).astype(np.int32)))
    for lab in range(1, num):
        if lab in border_labels:
            continue
        region = labels == lab
        if int(region.sum()) < 12:
            continue
        out[region] = src_rgb[region]
    return out


def _corner_brightness(rgb: np.ndarray, pad: int = 12) -> float:
    """Mean brightness of the four image corners (used to detect black backgrounds)."""
    h, w = rgb.shape[:2]
    p = max(1, min(pad, h // 8, w // 8))
    corners = np.concatenate([
        rgb[:p, :p].reshape(-1, 3),
        rgb[:p, -p:].reshape(-1, 3),
        rgb[-p:, :p].reshape(-1, 3),
        rgb[-p:, -p:].reshape(-1, 3),
    ])
    return float(corners.mean())


def composite_wrinkle_view_rgb(
    rgb: np.ndarray,
    alpha: np.ndarray | None,
    wrinkle_rgba: np.ndarray,
) -> np.ndarray:
    """Bake crease strokes onto a black-background person cutout.

    Background removal strategy (in priority order):
    1. Already on black — corners are dark, no further removal needed; use
       luminance visibility mask so hair / shadows near black are preserved.
    2. Rembg alpha usable — at least 5 % transparent (BG removed) and the
       face area is mostly opaque (< 90 % transparent overall).
    3. Studio backdrop — flood-fill eraser for gray / white seamless backdrops
       where rembg completely failed (all-opaque alpha).
    """
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)

    # 1. Already on black background.
    if _corner_brightness(rgb) < 15:
        visible = np.clip(cv2.GaussianBlur((gray > 22).astype(np.float32), (0, 0), 2.0), 0, 255)
        fg = flatten_rgb_on_black(rgb, (visible * 255).astype(np.uint8))
    else:
        # 2. Try rembg alpha.
        use_rembg = False
        if alpha is not None:
            a = alpha[:, :, 0] if alpha.ndim == 3 else alpha
            t_frac = float((a < 32).sum()) / a.size
            use_rembg = 0.05 <= t_frac <= 0.90

        if use_rembg:
            a2d = alpha[:, :, 0] if alpha.ndim == 3 else alpha
            fg = flatten_rgb_on_black(rgb, a2d)
        else:
            # 3. Studio backdrop flood-fill.
            mask = studio_backdrop_mask(rgb)
            fg = flatten_rgb_on_black(rgb, mask)

    fg = restore_interior_black_holes(fg, rgb)
    base = fg.astype(np.float32)
    ov = wrinkle_rgba.astype(np.float32)
    a_ov = ov[:, :, 3:4] / 255.0
    return np.clip(base * (1.0 - a_ov) + ov[:, :, :3] * a_ov, 0, 255).astype(np.uint8)
