"""Anatomically placed wrinkle guide lines (viewBox 0–100).

Models common facial rhytids by pose: forehead (horizontal), glabella (vertical),
crow's feet (radiating), under-eye (fine arcs), nasolabial folds (curved),
marionette lines (oblique), perioral (vertical), and neck (horizontal).
"""

from __future__ import annotations

import math
from typing import Callable


def _pt(
    bbox: tuple[int, int, int, int],
    u: float,
    v: float,
    img_w: int,
    img_h: int,
) -> list[float]:
    x, y, w, h = bbox
    px = x + u * w
    py = y + v * h
    return [round(px / max(img_w, 1) * 100, 3), round(py / max(img_h, 1) * 100, 3)]


def _sample_quad(
    bbox: tuple[int, int, int, int],
    u0: float,
    v0: float,
    uc: float,
    vc: float,
    u1: float,
    v1: float,
    img_w: int,
    img_h: int,
    n: int = 14,
) -> list[list[float]]:
    pts: list[list[float]] = []
    for i in range(n):
        t = i / max(n - 1, 1)
        omt = 1 - t
        u = omt * omt * u0 + 2 * omt * t * uc + t * t * u1
        v = omt * omt * v0 + 2 * omt * t * vc + t * t * v1
        pts.append(_pt(bbox, u, v, img_w, img_h))
    return pts


def _sample_line(
    bbox: tuple[int, int, int, int],
    u0: float,
    v0: float,
    u1: float,
    v1: float,
    img_w: int,
    img_h: int,
    n: int = 10,
) -> list[list[float]]:
    return [
        _pt(bbox, u0 + (u1 - u0) * (i / max(n - 1, 1)), v0 + (v1 - v0) * (i / max(n - 1, 1)), img_w, img_h)
        for i in range(n)
    ]


def _forehead_horizontal(
    bbox: tuple[int, int, int, int],
    img_w: int,
    img_h: int,
    y: float,
    arch: float = 0.018,
    x0: float = 0.14,
    x1: float = 0.86,
) -> list[list[float]]:
    return _sample_quad(bbox, x0, y, (x0 + x1) / 2, y - arch, x1, y, img_w, img_h, n=16)


def _glabella_vertical(
    bbox: tuple[int, int, int, int],
    img_w: int,
    img_h: int,
    cx: float = 0.5,
) -> list[list[list[float]]]:
    return [
        _sample_line(bbox, cx - 0.03, 0.26, cx - 0.03, 0.34, img_w, img_h, 8),
        _sample_line(bbox, cx + 0.03, 0.26, cx + 0.03, 0.34, img_w, img_h, 8),
        _sample_line(bbox, cx, 0.27, cx, 0.35, img_w, img_h, 7),
    ]


def _crow_feet(
    bbox: tuple[int, int, int, int],
    img_w: int,
    img_h: int,
    ox: float,
    oy: float,
    side: str,
) -> list[list[list[float]]]:
    paths: list[list[list[float]]] = []
    sign = -1 if side == "left" else 1
    for deg in (-38, -22, -6, 8, 22):
        rad = math.radians(deg * sign)
        length = 0.055 + abs(deg) * 0.0008
        u1 = ox + math.cos(rad) * length
        v1 = oy + math.sin(rad) * length * 0.72
        paths.append(_sample_line(bbox, ox, oy, u1, v1, img_w, img_h, 6))
    return paths


def _under_eye_arc(
    bbox: tuple[int, int, int, int],
    img_w: int,
    img_h: int,
    cx: float,
    y: float,
) -> list[list[float]]:
    return _sample_quad(bbox, cx - 0.09, y, cx, y + 0.012, cx + 0.09, y, img_w, img_h, n=12)


def _nasolabial_fold(
    bbox: tuple[int, int, int, int],
    img_w: int,
    img_h: int,
    side: str,
) -> list[list[float]]:
    if side == "left":
        return _sample_quad(bbox, 0.44, 0.50, 0.39, 0.60, 0.36, 0.72, img_w, img_h, n=16)
    return _sample_quad(bbox, 0.56, 0.50, 0.61, 0.60, 0.64, 0.72, img_w, img_h, n=16)


def _marionette(
    bbox: tuple[int, int, int, int],
    img_w: int,
    img_h: int,
    side: str,
) -> list[list[float]]:
    if side == "left":
        return _sample_quad(bbox, 0.40, 0.73, 0.37, 0.79, 0.36, 0.86, img_w, img_h, n=12)
    return _sample_quad(bbox, 0.60, 0.73, 0.63, 0.79, 0.64, 0.86, img_w, img_h, n=12)


def _perioral_vertical(
    bbox: tuple[int, int, int, int],
    img_w: int,
    img_h: int,
) -> list[list[list[float]]]:
    paths: list[list[list[float]]] = []
    for cx in (0.47, 0.49, 0.51, 0.53):
        paths.append(_sample_line(bbox, cx, 0.66, cx, 0.74, img_w, img_h, 7))
    return paths


def _neck_lines(
    bbox: tuple[int, int, int, int],
    img_w: int,
    img_h: int,
    y0: float = 0.88,
) -> list[list[list[float]]]:
    return [
        _forehead_horizontal(bbox, img_w, img_h, y0, arch=0.006, x0=0.28, x1=0.72),
        _forehead_horizontal(bbox, img_w, img_h, y0 + 0.04, arch=0.005, x0=0.24, x1=0.76),
    ]


def _paths_front(bbox: tuple[int, int, int, int], img_w: int, img_h: int) -> list[list[list[float]]]:
    paths: list[list[list[float]]] = []
    for y in (0.10, 0.14, 0.18, 0.22):
        paths.append(_forehead_horizontal(bbox, img_w, img_h, y))
    paths.extend(_glabella_vertical(bbox, img_w, img_h))
    paths.extend(_crow_feet(bbox, img_w, img_h, 0.34, 0.40, "left"))
    paths.extend(_crow_feet(bbox, img_w, img_h, 0.66, 0.40, "right"))
    paths.append(_under_eye_arc(bbox, img_w, img_h, 0.38, 0.44))
    paths.append(_under_eye_arc(bbox, img_w, img_h, 0.62, 0.44))
    paths.append(_nasolabial_fold(bbox, img_w, img_h, "left"))
    paths.append(_nasolabial_fold(bbox, img_w, img_h, "right"))
    paths.append(_marionette(bbox, img_w, img_h, "left"))
    paths.append(_marionette(bbox, img_w, img_h, "right"))
    paths.extend(_perioral_vertical(bbox, img_w, img_h))
    paths.extend(_neck_lines(bbox, img_w, img_h))
    return paths


def _paths_three_quarter(
    bbox: tuple[int, int, int, int],
    img_w: int,
    img_h: int,
    side: str,
) -> list[list[list[float]]]:
    paths: list[list[list[float]]] = []
    near = "right" if side == "right" else "left"
    far = "left" if near == "right" else "right"
    ox_near = 0.62 if near == "right" else 0.38
    ox_far = 0.38 if near == "right" else 0.62

    for y in (0.11, 0.16, 0.21):
        paths.append(_forehead_horizontal(bbox, img_w, img_h, y, arch=0.014, x0=0.18, x1=0.82))
    paths.extend(_glabella_vertical(bbox, img_w, img_h, 0.5 if near == "right" else 0.48))
    paths.extend(_crow_feet(bbox, img_w, img_h, ox_near, 0.41, near))
    paths.extend(_crow_feet(bbox, img_w, img_h, ox_far, 0.41, far)[:2])  # fainter far side
    paths.append(_under_eye_arc(bbox, img_w, img_h, ox_near, 0.45))
    paths.append(_nasolabial_fold(bbox, img_w, img_h, near))
    paths.append(_marionette(bbox, img_w, img_h, near))
    paths.extend(_perioral_vertical(bbox, img_w, img_h)[:2])
    paths.extend(_neck_lines(bbox, img_w, img_h))
    return paths


def _paths_profile(
    bbox: tuple[int, int, int, int],
    img_w: int,
    img_h: int,
    side: str,
) -> list[list[list[float]]]:
    paths: list[list[list[float]]] = []
    # Forehead / temple — mostly vertical on profile
    for x in (0.52, 0.56, 0.60):
        paths.append(_sample_line(bbox, x, 0.10, x - 0.02, 0.26, img_w, img_h, 10))
    paths.extend(_crow_feet(bbox, img_w, img_h, 0.58 if side == "right" else 0.42, 0.42, side))
    paths.append(_under_eye_arc(bbox, img_w, img_h, 0.56 if side == "right" else 0.44, 0.46))
    paths.append(_nasolabial_fold(bbox, img_w, img_h, side))
    paths.append(_marionette(bbox, img_w, img_h, side))
    # Neck — horizontal bands under jaw
    for y in (0.84, 0.89, 0.93):
        paths.append(
            _sample_line(bbox, 0.30, y, 0.72, y + 0.01, img_w, img_h, 12),
        )
    return paths


_BUILDERS: dict[str, Callable[..., list[list[list[float]]]]] = {
    "front": lambda b, w, h: _paths_front(b, w, h),
    "three-quarter-left": lambda b, w, h: _paths_three_quarter(b, w, h, "left"),
    "three-quarter-right": lambda b, w, h: _paths_three_quarter(b, w, h, "right"),
    "profile-left": lambda b, w, h: _paths_profile(b, w, h, "left"),
    "profile-right": lambda b, w, h: _paths_profile(b, w, h, "right"),
}


def anatomical_wrinkle_paths(
    angle: str,
    bbox: tuple[int, int, int, int],
    img_w: int,
    img_h: int,
) -> list[list[list[float]]]:
    """Wrinkle polylines in viewBox 0–100 coordinates."""
    builder = _BUILDERS.get(angle, _paths_front)
    paths = builder(bbox, img_w, img_h)
    return [p for p in paths if len(p) >= 2]
