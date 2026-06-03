"""Wrinkle paths: crease-shadow detection in MediaPipe zones, schematic fallback."""

from __future__ import annotations

import importlib.util
import math
from pathlib import Path
from typing import Any, Sequence

import numpy as np

_SCRIPT_DIR = Path(__file__).resolve().parent


def _load(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, _SCRIPT_DIR / filename)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_mp = _load("mediapipe_landmarks", "mediapipe_landmarks.py")
_anat = _load("anatomical_wrinkle_paths", "anatomical_wrinkle_paths.py")
_crease = _load("wrinkle_crease_detect", "wrinkle_crease_detect.py")

detect_face_landmarks = _mp.detect_face_landmarks
anatomical_wrinkle_paths = _anat.anatomical_wrinkle_paths
detect_wrinkle_creases_from_landmarks = _crease.detect_wrinkle_creases_from_landmarks

# Region indices (MediaPipe 468 face mesh — matches build_severity_models_v2.py)
_LEFT_BROW = [46, 53, 52, 65, 55, 70, 63, 105, 66, 107]
_RIGHT_BROW = [276, 283, 282, 295, 285, 300, 293, 334, 296, 336]
_FOREHEAD_TOP = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323]
_LEFT_TEMPLE = 234
_RIGHT_TEMPLE = 454
_GLABELLA = [9, 8, 168, 6, 197, 195, 5, 107, 336]
_LEFT_CROWS = 33
_RIGHT_CROWS = 263
_UNDER_EYE_L = [130, 25, 110, 24, 23, 22, 26, 112, 243, 190, 56, 28, 27, 29, 30, 247]
_UNDER_EYE_R = [359, 255, 339, 254, 253, 252, 256, 341, 463, 414, 286, 258, 257, 259, 260, 467]
_NLF_LEFT = [220, 115, 131, 134, 102, 49, 220, 31, 228, 229, 230, 231, 232, 233, 244, 245, 122, 196, 3, 51, 45, 44, 1, 61]
_NLF_RIGHT = [440, 344, 360, 363, 329, 279, 440, 261, 448, 449, 450, 451, 452, 453, 464, 465, 351, 419, 248, 281, 275, 274, 1, 291]
_MARIONETTE_L = [61, 178, 148, 176, 172]
_MARIONETTE_R = [291, 402, 377, 400, 397]
_PERIORAL_TOP = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291]
_CHIN = 152
_JAW_L = 172
_JAW_R = 397


def _px(lm: Sequence[Any], idx: int, w: int, h: int) -> tuple[float, float]:
    p = lm[idx]
    return float(p.x * w), float(p.y * h)


def _to_viewbox(x: float, y: float, w: int, h: int) -> list[float]:
    return [round(x / max(w, 1) * 100, 3), round(y / max(h, 1) * 100, 3)]


def _interp_line(
    x0: float,
    y0: float,
    x1: float,
    y1: float,
    w: int,
    h: int,
    n: int = 12,
    bulge: float = 0.0,
) -> list[list[float]]:
    pts: list[list[float]] = []
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2 - bulge
    for i in range(n):
        t = i / max(n - 1, 1)
        omt = 1 - t
        x = omt * omt * x0 + 2 * omt * t * mx + t * t * x1
        y = omt * omt * y0 + 2 * omt * t * my + t * t * y1
        pts.append(_to_viewbox(x, y, w, h))
    return pts


def _chain(lm: Sequence[Any], indices: list[int], w: int, h: int, step: int = 1) -> list[list[float]]:
    uniq: list[int] = []
    for i in indices:
        if i not in uniq and i < len(lm):
            uniq.append(i)
    if len(uniq) < 2:
        return []
    pts = [_to_viewbox(*_px(lm, i, w, h), w, h) for i in uniq[::step]]
    return pts if len(pts) >= 2 else []


def _mean_y(lm: Sequence[Any], indices: list[int], h: int) -> float:
    ys = [lm[i].y * h for i in indices if i < len(lm)]
    return float(np.mean(ys)) if ys else h * 0.3


def _face_yaw(lm: Sequence[Any]) -> float:
    """Positive ≈ subject turned to their right (camera sees more left cheek)."""
    return float(lm[1].x - lm[_LEFT_TEMPLE].x)


def _side_visible(angle: str, side: str, yaw: float) -> bool:
    if angle == "front":
        return True
    if angle == "profile-left":
        return side == "left"
    if angle == "profile-right":
        return side == "right"
    if angle == "three-quarter-left":
        return side == "left" or (side == "right" and yaw < 0.12)
    if angle == "three-quarter-right":
        return side == "right" or (side == "left" and yaw > -0.12)
    return True


def _forehead_lines(lm: Sequence[Any], w: int, h: int) -> list[list[list[float]]]:
    brow_y = _mean_y(lm, _LEFT_BROW + _RIGHT_BROW, h)
    top_y = min(lm[i].y * h for i in _FOREHEAD_TOP if i < len(lm))
    x0 = _px(lm, _LEFT_TEMPLE, w, h)[0]
    x1 = _px(lm, _RIGHT_TEMPLE, w, h)[0]
    span = top_y - brow_y
    if span < 8:
        return []
    paths: list[list[list[float]]] = []
    for frac in (0.18, 0.38, 0.58, 0.78):
        y = brow_y + span * frac
        bulge = span * 0.04 * (1 - abs(frac - 0.5) * 1.6)
        paths.append(_interp_line(x0, y, x1, y, w, h, n=16, bulge=bulge))
    return paths


def _glabella_lines(lm: Sequence[Any], w: int, h: int) -> list[list[list[float]]]:
    brow_y = _mean_y(lm, _GLABELLA[:4], h)
    top_y = brow_y - h * 0.04
    paths: list[list[list[float]]] = []
    for idx in (9, 8, 107, 336):
        if idx >= len(lm):
            continue
        x, _y = _px(lm, idx, w, h)
        paths.append(_interp_line(x, top_y, x, brow_y + h * 0.02, w, h, n=8, bulge=0))
    return paths


def _crow_feet(lm: Sequence[Any], w: int, h: int, side: str) -> list[list[list[float]]]:
    idx = _LEFT_CROWS if side == "left" else _RIGHT_CROWS
    ox, oy = _px(lm, idx, w, h)
    paths: list[list[list[float]]] = []
    sign = -1 if side == "left" else 1
    for deg in (-42, -24, -8, 6, 20, 34):
        rad = math.radians(deg * sign)
        length = h * 0.035 + w * 0.012
        x1 = ox + math.cos(rad) * length
        y1 = oy + math.sin(rad) * length * 0.65
        paths.append(_interp_line(ox, oy, x1, y1, w, h, n=7, bulge=0))
    return paths


def _under_eye(lm: Sequence[Any], w: int, h: int, side: str) -> list[list[list[float]]]:
    chain = _chain(lm, _UNDER_EYE_L if side == "left" else _UNDER_EYE_R, w, h, step=2)
    return [chain] if chain else []


def _nasolabial(lm: Sequence[Any], w: int, h: int, side: str) -> list[list[list[float]]]:
    chain = _chain(lm, _NLF_LEFT if side == "left" else _NLF_RIGHT, w, h, step=2)
    return [chain] if chain else []


def _marionette(lm: Sequence[Any], w: int, h: int, side: str) -> list[list[list[float]]]:
    indices = _MARIONETTE_L if side == "left" else _MARIONETTE_R
    if len(indices) < 3:
        return []
    x0, y0 = _px(lm, indices[0], w, h)
    x2, y2 = _px(lm, indices[-1], w, h)
    xm, ym = _px(lm, indices[len(indices) // 2], w, h)
    bulge = h * 0.015 * (1 if side == "left" else -1)
    return [_interp_line(x0, y0, x2, y2, w, h, n=14, bulge=bulge * 0.5)]


def _perioral_lines(lm: Sequence[Any], w: int, h: int) -> list[list[list[float]]]:
    lip_y0 = _mean_y(lm, _PERIORAL_TOP[:6], h)
    lip_y1 = lip_y0 + h * 0.025
    paths: list[list[list[float]]] = []
    for idx in (37, 39, 0, 269, 270):
        if idx >= len(lm):
            continue
        x, _ = _px(lm, idx, w, h)
        paths.append(_interp_line(x, lip_y0 - h * 0.01, x, lip_y1, w, h, n=6, bulge=0))
    return paths


def _neck_lines(lm: Sequence[Any], w: int, h: int) -> list[list[list[float]]]:
    chin_x, chin_y = _px(lm, _CHIN, w, h)
    jx0, _ = _px(lm, _JAW_L, w, h)
    jx1, _ = _px(lm, _JAW_R, w, h)
    paths: list[list[list[float]]] = []
    for k, bulge in ((0.06, 0), (0.11, 0.004), (0.16, 0.008)):
        y = chin_y + h * k
        paths.append(_interp_line(jx0, y, jx1, y, w, h, n=14, bulge=h * bulge))
    return paths


def wrinkle_paths_from_landmarks(
    lm: Sequence[Any],
    angle: str,
    img_w: int,
    img_h: int,
) -> list[list[list[float]]]:
    yaw = _face_yaw(lm)
    paths: list[list[list[float]]] = []
    paths.extend(_forehead_lines(lm, img_w, img_h))
    paths.extend(_glabella_lines(lm, img_w, img_h))

    for side in ("left", "right"):
        if not _side_visible(angle, side, yaw):
            continue
        paths.extend(_crow_feet(lm, img_w, img_h, side))
        paths.extend(_under_eye(lm, img_w, img_h, side))
        paths.extend(_nasolabial(lm, img_w, img_h, side))
        paths.extend(_marionette(lm, img_w, img_h, side))

    if angle in ("front", "three-quarter-left", "three-quarter-right"):
        paths.extend(_perioral_lines(lm, img_w, img_h))
    if angle in ("front", "profile-left", "profile-right"):
        paths.extend(_neck_lines(lm, img_w, img_h))

    return [p for p in paths if len(p) >= 2]


def _landmarks_on_image(
    rgb: np.ndarray,
    fallback_bbox: tuple[int, int, int, int] | None,
) -> Sequence[Any] | None:
    lm = detect_face_landmarks(rgb)
    if lm is not None or fallback_bbox is None:
        return lm
    x, y, bw, bh = fallback_bbox
    pad = int(max(bw, bh) * 0.22)
    x0 = max(0, x - pad)
    y0 = max(0, y - pad)
    x1 = min(rgb.shape[1], x + bw + pad)
    y1 = min(rgb.shape[0], y + bh + pad)
    crop = rgb[y0:y1, x0:x1]
    if crop.size == 0:
        return None
    lm_crop = detect_face_landmarks(crop)
    if lm_crop is None:
        return None
    # Remap normalized coords from crop back to full image space.
    cw, ch = x1 - x0, y1 - y0
    full_w, full_h = rgb.shape[1], rgb.shape[0]

    class _Pt:
        __slots__ = ("x", "y", "z")

        def __init__(self, px: float, py: float, pz: float = 0.0):
            self.x, self.y, self.z = px, py, pz

    remapped = []
    for p in lm_crop:
        remapped.append(
            _Pt(
                (p.x * cw + x0) / full_w,
                (p.y * ch + y0) / full_h,
                getattr(p, "z", 0.0),
            )
        )
    return remapped


def mediapipe_wrinkle_paths(
    rgb: np.ndarray,
    angle: str,
    img_w: int | None = None,
    img_h: int | None = None,
    *,
    fallback_bbox: tuple[int, int, int, int] | None = None,
    alpha: np.ndarray | None = None,
) -> tuple[list[list[list[float]]], str]:
    """Returns (paths in viewBox 0–100, source tag)."""
    ih, iw = rgb.shape[:2]
    img_w = img_w or iw
    img_h = img_h or ih
    lm = _landmarks_on_image(rgb, fallback_bbox)
    if lm is not None:
        detected = detect_wrinkle_creases_from_landmarks(
            rgb, alpha, lm, angle, img_w, img_h
        )
        if len(detected) > 0:
            tag = "detected-creases" if len(detected) >= 4 else "detected-creases-partial"
            return detected, tag
        return (
            wrinkle_paths_from_landmarks(lm, angle, img_w, img_h),
            "mediapipe-schematic-fallback",
        )
    if fallback_bbox is not None:
        return anatomical_wrinkle_paths(angle, fallback_bbox, img_w, img_h), "bbox-fallback"
    return [], "none"
