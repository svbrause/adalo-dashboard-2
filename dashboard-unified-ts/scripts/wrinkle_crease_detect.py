"""Detect wrinkle-like crease shadows in the image (not schematic landmark lines).

MediaPipe defines per-zone ROIs (forehead, crow's feet, NL folds, etc.); blackhat +
oriented filters find dark crease pixels inside those masks, then contours become paths.
"""

from __future__ import annotations

import math
from typing import Any, Literal, Sequence

import cv2
import numpy as np

OrientationPref = Literal["horizontal", "vertical", "any", "diagonal"]


def _clamp(v: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, v))


def _px(lm: Sequence[Any], idx: int, w: int, h: int) -> tuple[int, int]:
    p = lm[idx]
    return int(round(p.x * w)), int(round(p.y * h))


def _hull_mask(
    shape: tuple[int, int],
    lm: Sequence[Any],
    indices: list[int],
    *,
    dilate: int = 0,
    erode: int = 0,
) -> np.ndarray:
    h, w = shape
    pts = np.array([_px(lm, i, w, h) for i in indices if i < len(lm)], dtype=np.int32)
    mask = np.zeros((h, w), np.uint8)
    if len(pts) < 3:
        return mask
    hull = cv2.convexHull(pts)
    cv2.fillConvexPoly(mask, hull, 255)
    if erode > 0:
        mask = cv2.erode(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (erode, erode)), 1)
    if dilate > 0:
        mask = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (dilate, dilate)), 1)
    return mask


def _smooth_path(path: list[list[float]], window: int = 3) -> list[list[float]]:
    if len(path) < 3:
        return path
    half = window // 2
    out: list[list[float]] = []
    for i in range(len(path)):
        xs = [path[j][0] for j in range(max(0, i - half), min(len(path), i + half + 1))]
        ys = [path[j][1] for j in range(max(0, i - half), min(len(path), i + half + 1))]
        out.append([sum(xs) / len(xs), sum(ys) / len(ys)])
    return out


def _to_viewbox(px: float, py: float, img_w: int, img_h: int) -> list[float]:
    return [round(px / max(img_w, 1) * 100, 3), round(py / max(img_h, 1) * 100, 3)]


def _contour_orientation_deg(contour: np.ndarray) -> float:
    if len(contour) < 5:
        return 0.0
    rect = cv2.minAreaRect(contour)
    angle = rect[2]
    if rect[1][0] < rect[1][1]:
        angle += 90
    return abs(angle) % 180


def _orientation_ok(deg: float, pref: OrientationPref, slack: float = 28) -> bool:
    if pref == "any":
        return True
    if pref == "horizontal":
        return deg <= slack or deg >= 180 - slack
    if pref == "vertical":
        return abs(deg - 90) <= slack
    # diagonal — crow's feet / marionette
    return 25 <= deg <= 65 or 115 <= deg <= 155


def _crease_response(gray: np.ndarray, pref: OrientationPref) -> np.ndarray:
    clahe = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(8, 8)).apply(gray)
    if pref == "horizontal":
        k = cv2.getStructuringElement(cv2.MORPH_RECT, (35, 5))
        resp = cv2.morphologyEx(clahe, cv2.MORPH_BLACKHAT, k)
    elif pref == "vertical":
        k = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 25))
        resp = cv2.morphologyEx(clahe, cv2.MORPH_BLACKHAT, k)
    else:
        kh = cv2.getStructuringElement(cv2.MORPH_RECT, (29, 5))
        kv = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 19))
        resp = cv2.addWeighted(
            cv2.morphologyEx(clahe, cv2.MORPH_BLACKHAT, kh),
            0.65,
            cv2.morphologyEx(clahe, cv2.MORPH_BLACKHAT, kv),
            0.45,
            0,
        )
    return cv2.bilateralFilter(resp, 5, 20, 20)


def _extract_paths_in_mask(
    rgb: np.ndarray,
    skin_mask: np.ndarray,
    roi_mask: np.ndarray,
    img_w: int,
    img_h: int,
    *,
    orientation: OrientationPref = "any",
    min_length: float = 18,
    max_length: float = 320,
    min_aspect: float = 1.8,
    max_paths: int = 8,
    percentile: float = 91.5,
    min_score: float = 18.0,
) -> list[list[list[float]]]:
    work = cv2.bitwise_and(skin_mask, roi_mask)
    if work.sum() < 400:
        return []

    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    response = _crease_response(gray, orientation)
    values = response[work > 0]
    if values.size < 80:
        return []

    thresh = max(10, int(np.percentile(values, percentile)))
    binary = ((response >= thresh) & (work > 0)).astype(np.uint8) * 255
    binary = cv2.morphologyEx(
        binary, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)), 1
    )
    binary = cv2.morphologyEx(
        binary, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)), 1
    )

    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    scored: list[tuple[float, np.ndarray]] = []

    for contour in contours:
        length = cv2.arcLength(contour, False)
        if length < min_length or length > max_length:
            continue
        bx, by, bw, bh = cv2.boundingRect(contour)
        aspect = max(bw, bh) / max(1, min(bw, bh))
        if aspect < min_aspect and length < min_length * 1.4:
            continue
        deg = _contour_orientation_deg(contour)
        if not _orientation_ok(deg, orientation):
            continue
        mask_line = np.zeros(gray.shape, np.uint8)
        cv2.drawContours(mask_line, [contour], -1, 255, 1)
        score = float(cv2.mean(response, mask=mask_line)[0] * math.sqrt(length))
        if score < min_score:
            continue
        scored.append((score, contour))

    scored.sort(key=lambda t: t[0], reverse=True)
    paths: list[list[list[float]]] = []

    for _score, contour in scored[: max_paths * 2]:
        epsilon = max(0.8, 0.014 * cv2.arcLength(contour, False))
        approx = cv2.approxPolyDP(contour, epsilon, False).reshape(-1, 2)
        if len(approx) < 2:
            continue
        if len(approx) > 14:
            keep = np.linspace(0, len(approx) - 1, 14).round().astype(int)
            approx = approx[keep]
        path = [_to_viewbox(float(px), float(py), img_w, img_h) for px, py in approx]
        path = _smooth_path(path, window=3)
        if len(path) < 2:
            continue
        cx = sum(p[0] for p in path) / len(path)
        cy = sum(p[1] for p in path) / len(path)
        if any((cx - sum(p[0] for p in o) / len(o)) ** 2 + (cy - sum(p[1] for p in o) / len(o)) ** 2 < 2.2 ** 2 for o in paths):
            continue
        paths.append(path)
        if len(paths) >= max_paths:
            break

    return paths


def _face_yaw(lm: Sequence[Any]) -> float:
    return float(lm[1].x - lm[234].x)


def _side_visible(angle: str, side: str, yaw: float) -> bool:
    if angle == "front":
        return True
    if angle == "profile-left":
        return side == "left"
    if angle == "profile-right":
        return side == "right"
    if angle == "three-quarter-left":
        return side == "left" or (side == "right" and yaw < 0.1)
    if angle == "three-quarter-right":
        return side == "right" or (side == "left" and yaw > -0.1)
    return True


def _zone_masks_from_landmarks(
    lm: Sequence[Any],
    shape: tuple[int, int],
    angle: str,
) -> list[tuple[str, np.ndarray, OrientationPref, int]]:
    """(name, mask, orientation, max_paths) per facial zone."""
    h, w = shape
    yaw = _face_yaw(lm)
    zones: list[tuple[str, np.ndarray, OrientationPref, int]] = []

    brow_l = [46, 53, 52, 65, 55, 70, 63, 105, 66, 107]
    brow_r = [276, 283, 282, 295, 285, 300, 293, 334, 296, 336]
    forehead_top = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323]
    forehead = _hull_mask((h, w), lm, brow_l + brow_r + forehead_top, dilate=12, erode=0)
    eye_l = [33, 7, 163, 144, 145, 153, 154, 155, 133, 246, 161, 160, 159, 158, 157, 173]
    eye_r = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]
    forehead = cv2.bitwise_and(forehead, cv2.bitwise_not(_hull_mask((h, w), lm, eye_l + eye_r, dilate=8)))
    zones.append(("forehead", forehead, "horizontal", 7))

    glabella = _hull_mask((h, w), lm, [9, 8, 168, 6, 197, 195, 5, 107, 336], dilate=10)
    zones.append(("glabella", glabella, "vertical", 4))

    for side, eye_idx, outer in (
        ("left", eye_l, 33),
        ("right", eye_r, 263),
    ):
        if not _side_visible(angle, side, yaw):
            continue
        periocular = _hull_mask((h, w), lm, eye_idx, dilate=14)
        ox, oy = _px(lm, outer, w, h)
        fan = np.zeros((h, w), np.uint8)
        if side == "left":
            pts = np.array([[ox, oy], [ox - int(w * 0.14), oy - int(h * 0.05)], [ox - int(w * 0.1), oy + int(h * 0.08)]], np.int32)
        else:
            pts = np.array([[ox, oy], [ox + int(w * 0.14), oy - int(h * 0.05)], [ox + int(w * 0.1), oy + int(h * 0.08)]], np.int32)
        cv2.fillConvexPoly(fan, pts, 255)
        crows = cv2.bitwise_and(periocular, fan)
        zones.append((f"crows_{side}", crows, "diagonal", 6))

        under = _hull_mask((h, w), lm, [130, 25, 110, 24, 23, 22, 26, 112] if side == "left" else [359, 255, 339, 254, 253, 252, 256, 341], dilate=8)
        zones.append((f"under_eye_{side}", under, "horizontal", 3))

        nlf_idx = [220, 115, 131, 134, 102, 49, 61] if side == "left" else [440, 344, 360, 363, 329, 279, 291]
        zones.append((f"nasolabial_{side}", _hull_mask((h, w), lm, nlf_idx, dilate=10), "any", 4))

        marionette_idx = [61, 178, 148, 176, 172] if side == "left" else [291, 402, 377, 400, 397]
        zones.append((f"marionette_{side}", _hull_mask((h, w), lm, marionette_idx, dilate=8), "diagonal", 2))

    if angle in ("front", "three-quarter-left", "three-quarter-right"):
        perioral = _hull_mask((h, w), lm, [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291], dilate=6)
        zones.append(("perioral", perioral, "vertical", 5))

    if angle in ("front", "profile-left", "profile-right"):
        chin = _px(lm, 152, w, h)
        j0 = _px(lm, 172, w, h)
        j1 = _px(lm, 397, w, h)
        neck = np.zeros((h, w), np.uint8)
        y0 = _clamp(chin[1] + int(h * 0.02), 0, h - 1)
        y1 = _clamp(chin[1] + int(h * 0.22), y0 + 1, h)
        cv2.rectangle(neck, (min(j0[0], j1[0]), y0), (max(j0[0], j1[0]), y1), 255, -1)
        zones.append(("neck", neck, "horizontal", 4))

    return zones


def detect_wrinkle_creases_from_landmarks(
    rgb: np.ndarray,
    alpha: np.ndarray | None,
    lm: Sequence[Any],
    angle: str,
    img_w: int,
    img_h: int,
) -> list[list[list[float]]]:
    """Paths in viewBox 0–100 from image crease detection inside landmark zones."""
    ih, iw = rgb.shape[:2]
    skin = np.zeros((ih, iw), np.uint8)
    if alpha is not None:
        skin = (alpha > 80).astype(np.uint8) * 255
    else:
        skin[:] = 255

    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    hh, sat, val = cv2.split(hsv)
    skin_color = (
        (val > 50)
        & (val < 245)
        & (sat > 12)
        & (sat < 150)
        & ((hh < 28) | (hh > 165))
    ).astype(np.uint8) * 255
    skin = cv2.bitwise_and(skin, cv2.medianBlur(skin_color, 5))

    percentile = 91.5
    if angle.startswith("three-quarter") or angle.startswith("profile"):
        percentile = 88.0

    zones = _zone_masks_from_landmarks(lm, (ih, iw), angle)

    def _collect(pass_percentile: float, pass_min_score: float) -> list[list[list[float]]]:
        found: list[list[list[float]]] = []
        for _name, roi_mask, orientation, max_paths in zones:
            found.extend(
                _extract_paths_in_mask(
                    rgb,
                    skin,
                    roi_mask,
                    img_w,
                    img_h,
                    orientation=orientation,
                    max_paths=max_paths,
                    min_length=max(12, int(0.01 * min(ih, iw))),
                    max_length=max(140, int(0.25 * min(ih, iw))),
                    percentile=pass_percentile,
                    min_score=pass_min_score,
                )
            )
        return found

    all_paths = _collect(percentile, 18.0)
    if len(all_paths) < 3:
        all_paths = _collect(max(84.0, percentile - 4), 11.0)

    return all_paths
