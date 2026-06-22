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

    eye_protect = cv2.bitwise_or(
        _hull_mask((h, w), lm, eye_l, dilate=6),
        _hull_mask((h, w), lm, eye_r, dilate=6),
    )
    brow_protect = cv2.bitwise_or(
        _hull_mask((h, w), lm, brow_l, dilate=9),
        _hull_mask((h, w), lm, brow_r, dilate=9),
    )
    face_scale = max(
        int(math.hypot(_px(lm, 454, w, h)[0] - _px(lm, 234, w, h)[0], _px(lm, 454, w, h)[1] - _px(lm, 234, w, h)[1])),
        int(min(h, w) * 0.24),
    )
    face_oval = _hull_mask(
        (h, w),
        lm,
        [
            10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
            397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
            172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
        ],
        dilate=max(8, int(face_scale * 0.035)),
    )

    for side, eye_idx, outer in (
        ("left", eye_l, 33),
        ("right", eye_r, 263),
    ):
        if not _side_visible(angle, side, yaw):
            continue
        periocular = _hull_mask((h, w), lm, eye_idx, dilate=14)
        ox, oy = _px(lm, outer, w, h)
        fan = np.zeros((h, w), np.uint8)
        span_x = max(28, int(face_scale * 0.34))
        span_y = max(20, int(face_scale * 0.18))
        if side == "left":
            pts = np.array(
                [
                    [ox, oy],
                    [max(0, ox - span_x), max(0, oy - int(span_y * 0.50))],
                    [max(0, ox - span_x), min(h - 1, oy + int(span_y * 0.95))],
                    [max(0, ox - int(span_x * 0.18)), min(h - 1, oy + int(span_y * 0.66))],
                ],
                np.int32,
            )
            ellipse_center = (max(0, ox - int(span_x * 0.47)), min(h - 1, oy + int(span_y * 0.18)))
        else:
            pts = np.array(
                [
                    [ox, oy],
                    [min(w - 1, ox + span_x), max(0, oy - int(span_y * 0.50))],
                    [min(w - 1, ox + span_x), min(h - 1, oy + int(span_y * 0.95))],
                    [min(w - 1, ox + int(span_x * 0.18)), min(h - 1, oy + int(span_y * 0.66))],
                ],
                np.int32,
            )
            ellipse_center = (min(w - 1, ox + int(span_x * 0.47)), min(h - 1, oy + int(span_y * 0.18)))
        cv2.fillConvexPoly(fan, pts, 255)
        cv2.ellipse(
            fan,
            ellipse_center,
            (max(18, int(span_x * 0.56)), max(12, int(span_y * 0.62))),
            0,
            0,
            360,
            255,
            -1,
        )
        crows = cv2.bitwise_and(
            fan,
            cv2.bitwise_not(cv2.bitwise_or(eye_protect, brow_protect)),
        )
        crows = cv2.bitwise_and(crows, face_oval)
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


def _build_skin_mask(rgb: np.ndarray, alpha: np.ndarray | None) -> np.ndarray:
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
    return cv2.bitwise_and(skin, cv2.medianBlur(skin_color, 5))


def _mask_from_polygon(shape: tuple[int, int], pts: list[tuple[int, int]]) -> np.ndarray:
    h, w = shape
    mask = np.zeros((h, w), np.uint8)
    if len(pts) < 3:
        return mask
    arr = np.array(
        [[_clamp(x, 0, w - 1), _clamp(y, 0, h - 1)] for x, y in pts],
        dtype=np.int32,
    )
    cv2.fillConvexPoly(mask, arr, 255)
    return mask


def _facial_hair_suppression_mask(
    rgb: np.ndarray,
    lm: Sequence[Any],
    shape: tuple[int, int],
) -> np.ndarray:
    """Detect beard/mustache hair inside lower-face zones and dilate it away.

    The wrinkle response sees beard/mustache connector hairs as short dark
    creases. Restricting this detector to landmarked lower-face regions keeps
    true upper-face wrinkles available while removing common false positives.
    """
    h, w = shape
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    _hue, sat, val = cv2.split(hsv)

    # Estimate skin brightness from central forehead/cheek points, avoiding
    # the mouth/chin region where facial hair is expected.
    reference_idx = [10, 9, 8, 151, 108, 337, 117, 346, 123, 352, 50, 280]
    ref_vals: list[int] = []
    for idx in reference_idx:
        if idx >= len(lm):
            continue
        x, y = _px(lm, idx, w, h)
        patch = gray[
            max(0, y - 3) : min(h, y + 4),
            max(0, x - 3) : min(w, x + 4),
        ]
        if patch.size:
            ref_vals.append(int(np.median(patch)))
    skin_gray = float(np.median(ref_vals)) if ref_vals else float(np.percentile(gray, 62))

    left_mouth = _px(lm, 61, w, h)
    right_mouth = _px(lm, 291, w, h)
    nose_base = _px(lm, 2, w, h)
    chin = _px(lm, 152, w, h)
    jaw_l = _px(lm, 172, w, h)
    jaw_r = _px(lm, 397, w, h)
    face_w = max(1, abs(_px(lm, 454, w, h)[0] - _px(lm, 234, w, h)[0]))
    mouth_w = max(1, abs(right_mouth[0] - left_mouth[0]))

    mustache = _mask_from_polygon(
        (h, w),
        [
            (left_mouth[0] - int(mouth_w * 0.28), nose_base[1] - int(face_w * 0.055)),
            (right_mouth[0] + int(mouth_w * 0.28), nose_base[1] - int(face_w * 0.055)),
            (right_mouth[0] + int(mouth_w * 0.20), right_mouth[1] + int(face_w * 0.075)),
            (left_mouth[0] - int(mouth_w * 0.20), left_mouth[1] + int(face_w * 0.075)),
        ],
    )
    goatee = _mask_from_polygon(
        (h, w),
        [
            (left_mouth[0] - int(face_w * 0.14), left_mouth[1] - int(face_w * 0.02)),
            (right_mouth[0] + int(face_w * 0.14), right_mouth[1] - int(face_w * 0.02)),
            (jaw_r[0] + int(face_w * 0.05), chin[1] + int(face_w * 0.08)),
            (chin[0], chin[1] + int(face_w * 0.16)),
            (jaw_l[0] - int(face_w * 0.05), chin[1] + int(face_w * 0.08)),
        ],
    )
    cheek_beard = _hull_mask(
        (h, w),
        lm,
        [
            132, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365,
            397, 361, 288, 397, 172, 58, 177,
        ],
        dilate=max(9, int(face_w * 0.018)),
    )
    lower_face = cv2.bitwise_or(cv2.bitwise_or(mustache, goatee), cheek_beard)

    dark_by_ref = gray < max(48, skin_gray - 34)
    very_dark = gray < max(42, skin_gray - 52)
    chroma_hair = (val < max(78, skin_gray - 18)) & (sat > 18)
    hair_like = ((dark_by_ref & (sat > 10)) | very_dark | chroma_hair)
    hair = np.zeros((h, w), np.uint8)
    hair[hair_like & (lower_face > 0)] = 255

    hair = cv2.morphologyEx(
        hair,
        cv2.MORPH_CLOSE,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)),
        iterations=1,
    )
    hair = cv2.dilate(
        hair,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)),
        iterations=1,
    )
    return hair


def _wrinkle_candidate_skin_mask(
    rgb: np.ndarray,
    alpha: np.ndarray | None,
    lm: Sequence[Any],
    angle: str,
) -> np.ndarray:
    h, w = rgb.shape[:2]
    skin = _build_skin_mask(rgb, alpha)
    eye_l = [33, 7, 163, 144, 145, 153, 154, 155, 133, 246, 161, 160, 159, 158, 157, 173]
    eye_r = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]
    brow_l = [46, 53, 52, 65, 55, 70, 63, 105, 66, 107]
    brow_r = [276, 283, 282, 295, 285, 300, 293, 334, 296, 336]
    lips = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146]
    lower_nose = [1, 2, 4, 5, 19, 94, 97, 98, 326, 327]

    protect = np.zeros((h, w), np.uint8)
    for idxs, dilate in (
        (eye_l, 8),
        (eye_r, 8),
        (brow_l, 14),
        (brow_r, 14),
        (lips, 11),
        (lower_nose, 7),
    ):
        protect = cv2.bitwise_or(protect, _hull_mask((h, w), lm, idxs, dilate=dilate))

    if angle == "front":
        hair = _facial_hair_suppression_mask(rgb, lm, (h, w))
        protect = cv2.bitwise_or(protect, hair)

    return cv2.bitwise_and(skin, cv2.bitwise_not(protect))


def _detect_primary_eye_box(gray: np.ndarray) -> tuple[int, int, int, int] | None:
    """Largest plausible eye region from Haar cascade (works on periocular crops)."""
    h, w = gray.shape
    min_dim = max(24, int(min(h, w) * 0.08))
    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_eye.xml")
    eyes = cascade.detectMultiScale(
        gray,
        scaleFactor=1.04,
        minNeighbors=4,
        minSize=(min_dim, min_dim),
    )
    if len(eyes) == 0:
        return None
    min_area = (min(h, w) * 0.12) ** 2
    candidates = [tuple(map(int, e)) for e in eyes if e[2] * e[3] >= min_area]
    if not candidates:
        candidates = [tuple(map(int, e)) for e in eyes]
    candidates.sort(key=lambda b: b[2] * b[3], reverse=True)
    return candidates[0]


def _eye_outer_corner(ex: int, ey: int, ew: int, eh: int, img_w: int) -> tuple[int, int]:
    cx = ex + ew // 2
    if cx <= img_w // 2:
        return ex + ew, ey + int(eh * 0.42)
    return ex, ey + int(eh * 0.42)


def _crows_feet_fan_mask(
    h: int,
    w: int,
    ox: int,
    oy: int,
    *,
    outward: str,
) -> np.ndarray:
    fan = np.zeros((h, w), np.uint8)
    span = int(max(h, w) * 0.46)
    lift = int(h * 0.18)
    drop = int(h * 0.20)
    if outward == "right":
        pts = np.array([[ox, oy], [min(w - 1, ox + span), oy - lift], [min(w - 1, ox + span), oy + drop]], np.int32)
    else:
        pts = np.array([[ox, oy], [max(0, ox - span), oy - lift], [max(0, ox - span), oy + drop]], np.int32)
    cv2.fillConvexPoly(fan, pts, 255)
    return fan


def _periocular_zone_masks_from_eye(
    shape: tuple[int, int],
    eye: tuple[int, int, int, int],
    gray: np.ndarray,
) -> list[tuple[str, np.ndarray, OrientationPref, int]]:
    h, w = shape
    ex, ey, ew, eh = eye
    ox, oy = _outer_canthus_from_iris(gray, eye, w)
    outward = "right" if ox >= ex + ew // 2 else "left"

    periocular = np.zeros((h, w), np.uint8)
    pad_x_inner, pad_x_outer = int(ew * 0.16), int(w * 0.42)
    pad_y = int(eh * 0.18)
    if outward == "right":
        x0 = _clamp(ex - pad_x_inner, 0, w - 1)
        x1 = _clamp(max(ex + ew + pad_x_inner, ox + pad_x_outer), x0 + 1, w)
    else:
        x0 = _clamp(min(ex - pad_x_outer, ox - pad_x_outer), 0, w - 1)
        x1 = _clamp(ex + ew + pad_x_inner, x0 + 1, w)
    y0 = _clamp(ey - pad_y, 0, h - 1)
    y1 = _clamp(ey + eh + pad_y, y0 + 1, h)
    cv2.rectangle(periocular, (x0, y0), (x1, y1), 255, -1)

    socket = np.zeros((h, w), np.uint8)
    scx = ex + int(ew * 0.52) if outward == "right" else ex + int(ew * 0.48)
    scy = ey + int(eh * 0.44)
    cv2.ellipse(
        socket,
        (scx, scy),
        (max(6, int(ew * 0.20)), max(4, int(eh * 0.16))),
        0,
        0,
        360,
        255,
        -1,
    )
    skin_field = cv2.bitwise_and(periocular, cv2.bitwise_not(socket))

    fan = _crows_feet_fan_mask(h, w, ox, oy, outward=outward)
    crows = cv2.bitwise_and(fan, cv2.bitwise_not(socket))
    brow = np.zeros((h, w), np.uint8)
    by1 = _clamp(ey + int(eh * 0.30), 0, h - 1)
    bx0 = _clamp(ex - int(ew * 0.12), 0, w - 1)
    bx1 = _clamp(ox + int(ew * 0.38), bx0 + 1, w)
    cv2.rectangle(brow, (bx0, 0), (bx1, by1), 255, -1)
    crows = cv2.bitwise_and(crows, cv2.bitwise_not(brow))

    under = np.zeros((h, w), np.uint8)
    uy0 = _clamp(ey + int(eh * 0.58), 0, h - 1)
    uy1 = _clamp(ey + eh + int(eh * 0.22), uy0 + 1, h)
    ux0 = _clamp(ex - int(ew * 0.05), 0, w - 1)
    ux1 = _clamp(ox + int(ew * 0.08), ux0 + 1, w)
    cv2.rectangle(under, (ux0, uy0), (ux1, uy1), 255, -1)
    under = cv2.bitwise_and(under, skin_field)

    return [
        ("crows_feet", crows, "diagonal", 14, (ox, oy, outward)),
        ("under_eye", under, "horizontal", 5, None),
    ]


def _heuristic_periocular_zone_masks(shape: tuple[int, int]) -> list[tuple[str, np.ndarray, OrientationPref, int]]:
    h, w = shape
    crows = np.zeros((h, w), np.uint8)
    cv2.fillConvexPoly(
        crows,
        np.array([[int(w * 0.38), int(h * 0.38)], [w - 1, int(h * 0.18)], [w - 1, int(h * 0.58)]], np.int32),
        255,
    )
    under = np.zeros((h, w), np.uint8)
    cv2.rectangle(under, (int(w * 0.08), int(h * 0.44)), (int(w * 0.48), int(h * 0.58)), 255, -1)
    skin = np.zeros((h, w), np.uint8)
    cv2.rectangle(skin, (0, int(h * 0.12)), (w - 1, int(h * 0.72)), 255, -1)
    return [
        ("crows_feet", cv2.bitwise_and(crows, skin), "diagonal", 10, None),
        ("under_eye", cv2.bitwise_and(under, skin), "horizontal", 6, None),
    ]


def _dedupe_paths(paths: list[list[list[float]]], min_dist: float = 2.0) -> list[list[list[float]]]:
    kept: list[list[list[float]]] = []
    for path in paths:
        if len(path) < 2:
            continue
        cx = sum(p[0] for p in path) / len(path)
        cy = sum(p[1] for p in path) / len(path)
        if any((cx - sum(p[0] for p in o) / len(o)) ** 2 + (cy - sum(p[1] for p in o) / len(o)) ** 2 < min_dist ** 2 for o in kept):
            continue
        kept.append(path)
    return kept


def _filter_paths_outside_eye_interior(
    paths: list[list[list[float]]],
    eye: tuple[int, int, int, int] | None,
    img_w: int,
    img_h: int,
    *,
    canthus: tuple[int, int] | None = None,
) -> list[list[list[float]]]:
    if eye is None:
        return paths
    ex, ey, ew, eh = eye
    cx, cy = ex + ew // 2, ey + eh // 2
    rx, ry = max(4, ew // 2.8), max(3, eh // 2.8)
    kept: list[list[list[float]]] = []
    for path in paths:
        if canthus is not None and _path_min_dist_to_point_px(path, canthus[0], canthus[1], img_w, img_h) <= 28:
            kept.append(path)
            continue
        px = sum(p[0] for p in path) / len(path) / 100.0 * img_w
        py = sum(p[1] for p in path) / len(path) / 100.0 * img_h
        nx = (px - cx) / rx
        ny = (py - cy) / ry
        if nx * nx + ny * ny < 1.05:
            continue
        kept.append(path)
    return kept


def _refine_eye_box(eye: tuple[int, int, int, int], h: int, w: int) -> tuple[int, int, int, int]:
    """Haar eye detections on tight crops are often oversized — shrink to plausible socket."""
    ex, ey, ew, eh = eye
    target_ew = int(w * 0.30)
    target_eh = int(h * 0.42)
    cx, cy = ex + ew // 2, ey + eh // 2
    if ew > target_ew or eh > target_eh:
        ew = min(ew, target_ew)
        eh = min(eh, target_eh)
        ex = _clamp(cx - ew // 2, 0, w - 1)
        ey = _clamp(cy - eh // 2, 0, h - 1)
    return ex, ey, ew, eh


def _outer_canthus_from_iris(
    gray: np.ndarray,
    eye: tuple[int, int, int, int],
    img_w: int,
) -> tuple[int, int]:
    ex, ey, ew, eh = eye
    roi = gray[ey : ey + eh, ex : ex + ew]
    if roi.size == 0:
        return _eye_outer_corner(ex, ey, ew, eh, img_w)
    dark_thr = float(np.percentile(roi, 22))
    ys, xs = np.where(roi <= dark_thr)
    if len(xs) < 12:
        return _eye_outer_corner(ex, ey, ew, eh, img_w)
    icx = ex + int(np.mean(xs))
    icy = ey + int(np.mean(ys))
    if icx <= img_w // 2:
        return ex + ew, icy
    return ex, icy


def _sclera_suppression_mask(rgb: np.ndarray, work: np.ndarray) -> np.ndarray:
    """Mask out bright sclera / specular highlights inside the ROI."""
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    _, sat, val = cv2.split(hsv)
    bright = (val > 178) & (sat < 48)
    suppress = np.zeros(work.shape, np.uint8)
    suppress[bright & (work > 0)] = 255
    return suppress


def _morph_skeleton(binary: np.ndarray) -> np.ndarray:
    skel = np.zeros_like(binary)
    img = binary.copy()
    kernel = cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3))
    while True:
        eroded = cv2.erode(img, kernel)
        dilated = cv2.dilate(eroded, kernel)
        temp = cv2.subtract(img, dilated)
        skel = cv2.bitwise_or(skel, temp)
        img = eroded
        if cv2.countNonZero(img) == 0:
            break
    return skel


def _line_sample_points(
    x0: float, y0: float, x1: float, y1: float, n: int,
) -> list[tuple[float, float]]:
    return [(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t) for t in [i / max(n - 1, 1) for i in range(n)]]


def _path_mean_response(
    path_px: list[tuple[float, float]],
    response: np.ndarray,
    gray: np.ndarray,
) -> float:
    h, w = gray.shape
    vals: list[float] = []
    bright = 0
    for x, y in path_px:
        ix, iy = int(round(x)), int(round(y))
        if ix < 0 or iy < 0 or ix >= w or iy >= h:
            continue
        vals.append(float(response[iy, ix]))
        if gray[iy, ix] > 170:
            bright += 1
    if len(vals) < 2 or bright > len(vals) * 0.35:
        return 0.0
    return float(np.mean(vals))


def _px_path_to_viewbox(
    path_px: list[tuple[float, float]], img_w: int, img_h: int,
) -> list[list[float]]:
    path = [_to_viewbox(x, y, img_w, img_h) for x, y in path_px]
    return _smooth_path(path, window=3) if len(path) >= 2 else []


def _extract_hough_paths_in_mask(
    gray: np.ndarray,
    response: np.ndarray,
    work: np.ndarray,
    img_w: int,
    img_h: int,
    *,
    orientation: OrientationPref,
    min_length: float,
    max_paths: int,
    percentile: float,
) -> list[list[list[float]]]:
    values = response[work > 0]
    if values.size < 80:
        return []
    thresh = max(8, int(np.percentile(values, percentile)))
    strong = ((response >= thresh) & (work > 0)).astype(np.uint8) * 255

    if orientation == "horizontal":
        close_k = cv2.getStructuringElement(cv2.MORPH_RECT, (13, 1))
    else:
        close_k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    strong = cv2.morphologyEx(strong, cv2.MORPH_CLOSE, close_k, iterations=1)
    strong = cv2.morphologyEx(
        strong, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2)), 1
    )

    lines = cv2.HoughLinesP(
        strong,
        rho=1,
        theta=np.pi / 180,
        threshold=10,
        minLineLength=int(min_length),
        maxLineGap=max(6, int(min_length * 0.45)),
    )
    if lines is None:
        return []

    scored: list[tuple[float, list[list[float]]]] = []
    for x1, y1, x2, y2 in lines[:, 0]:
        length = math.hypot(x2 - x1, y2 - y1)
        if length < min_length:
            continue
        deg = abs(math.degrees(math.atan2(y2 - y1, x2 - x1))) % 180
        if not _orientation_ok(deg, orientation, slack=32):
            continue
        n_pts = max(4, min(16, int(length / 6)))
        path_px = _line_sample_points(float(x1), float(y1), float(x2), float(y2), n_pts)
        score = _path_mean_response(path_px, response, gray) * math.sqrt(length)
        if score < 12:
            continue
        vb = _px_path_to_viewbox(path_px, img_w, img_h)
        if len(vb) >= 2:
            scored.append((score, vb))

    scored.sort(key=lambda t: t[0], reverse=True)
    return [p for _, p in scored[:max_paths]]


def _extract_skeleton_paths_in_mask(
    gray: np.ndarray,
    response: np.ndarray,
    work: np.ndarray,
    img_w: int,
    img_h: int,
    *,
    orientation: OrientationPref,
    min_length: float,
    max_paths: int,
    percentile: float,
) -> list[list[list[float]]]:
    values = response[work > 0]
    if values.size < 80:
        return []
    thresh = max(8, int(np.percentile(values, percentile + 1.5)))
    strong = ((response >= thresh) & (work > 0)).astype(np.uint8) * 255
    skel = _morph_skeleton(strong)
    contours, _ = cv2.findContours(skel, cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)

    scored: list[tuple[float, list[list[float]]]] = []
    for contour in contours:
        length = cv2.arcLength(contour, False)
        if length < min_length * 0.85:
            continue
        deg = _contour_orientation_deg(contour)
        if not _orientation_ok(deg, orientation, slack=34):
            continue
        pts = contour.reshape(-1, 2)
        if len(pts) > 18:
            keep = np.linspace(0, len(pts) - 1, 18).round().astype(int)
            pts = pts[keep]
        path_px = [(float(x), float(y)) for x, y in pts]
        score = _path_mean_response(path_px, response, gray) * math.sqrt(length)
        if score < 10:
            continue
        vb = _px_path_to_viewbox(path_px, img_w, img_h)
        if len(vb) >= 2:
            scored.append((score, vb))

    scored.sort(key=lambda t: t[0], reverse=True)
    return [p for _, p in scored[:max_paths]]


def _path_min_dist_to_point_px(
    path: list[list[float]], px: float, py: float, img_w: int, img_h: int,
) -> float:
    best = float("inf")
    for x, y in path:
        qx = x / 100.0 * img_w
        qy = y / 100.0 * img_h
        best = min(best, math.hypot(qx - px, qy - py))
    return best


def _anchor_path_at_canthus(
    path: list[list[float]],
    canthus: tuple[int, int],
    img_w: int,
    img_h: int,
    *,
    max_snap_px: float = 72.0,
) -> list[list[float]]:
    ox, oy = canthus
    ox_vb = ox / img_w * 100.0
    oy_vb = oy / img_h * 100.0
    if _path_min_dist_to_point_px(path, ox, oy, img_w, img_h) > max_snap_px:
        return path
    d0 = math.hypot(path[0][0] - ox_vb, path[0][1] - oy_vb)
    d1 = math.hypot(path[-1][0] - ox_vb, path[-1][1] - oy_vb)
    if d0 <= d1:
        return [[ox_vb, oy_vb]] + path
    return path + [[ox_vb, oy_vb]]


def _extract_radial_crows_paths(
    rgb: np.ndarray,
    gray: np.ndarray,
    skin: np.ndarray,
    roi_mask: np.ndarray,
    img_w: int,
    img_h: int,
    *,
    canthus: tuple[int, int],
    outward: str,
    max_paths: int,
    min_length: float,
    percentile: float = 82.0,
) -> list[list[list[float]]]:
    """Trace crease response along rays radiating from the outer canthus."""
    work = cv2.bitwise_and(skin, roi_mask)
    work = cv2.bitwise_and(work, cv2.bitwise_not(_sclera_suppression_mask(rgb, work)))
    work = cv2.dilate(work, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)), 1)
    if work.sum() < 400:
        return []

    response = _crease_response(gray, "diagonal")
    values = response[work > 0]
    if values.size < 80:
        return []
    thresh = max(5, float(np.percentile(values, percentile)))

    ox, oy = canthus
    max_dist = int(min(img_w, img_h) * 0.42)
    if outward == "right":
        angles = list(range(-46, 47, 5))
    else:
        angles = list(range(134, 227, 5))

    scored: list[tuple[float, list[list[float]]]] = []
    for angle_deg in angles:
        ang = math.radians(angle_deg)
        cos_a, sin_a = math.cos(ang), math.sin(ang)
        samples: list[tuple[float, float, float]] = []
        gap = 0
        for dist in range(0, max_dist, 2):
            x = ox + dist * cos_a
            y = oy + dist * sin_a
            ix, iy = int(round(x)), int(round(y))
            if ix < 0 or iy < 0 or ix >= img_w or iy >= img_h:
                break
            if work[iy, ix] == 0:
                gap += 1
                if gap > 5:
                    break
                continue
            gap = 0
            samples.append((x, y, float(response[iy, ix])))

        if len(samples) < 4:
            continue
        vals = [s[2] for s in samples]
        if max(vals) < thresh * 0.62:
            continue
        local_thr = max(thresh * 0.58, float(np.percentile(vals, 36)))
        path_px = [(float(ox), float(oy))]
        path_px.extend((x, y) for x, y, v in samples if v >= local_thr)
        if len(path_px) < 3:
            path_px = [(float(ox), float(oy))] + [(x, y) for x, y, _ in samples]
        length = math.hypot(path_px[-1][0] - path_px[0][0], path_px[-1][1] - path_px[0][1])
        if length < min_length * 0.45:
            continue
        score = _path_mean_response(path_px[1:], response, gray) * math.sqrt(length)
        if score < 4.5:
            continue
        vb = _px_path_to_viewbox(path_px, img_w, img_h)
        if len(vb) >= 2:
            scored.append((score, vb))

    scored.sort(key=lambda t: t[0], reverse=True)
    return [p for _, p in scored[:max_paths]]


def _extract_periocular_wrinkle_paths(
    rgb: np.ndarray,
    gray: np.ndarray,
    skin: np.ndarray,
    roi_mask: np.ndarray,
    img_w: int,
    img_h: int,
    *,
    orientation: OrientationPref,
    max_paths: int,
    min_length: float,
    percentile: float = 86.0,
    canthus_anchor: tuple[int, int, str] | None = None,
) -> list[list[list[float]]]:
    work = cv2.bitwise_and(skin, roi_mask)
    work = cv2.bitwise_and(work, cv2.bitwise_not(_sclera_suppression_mask(rgb, work)))
    if work.sum() < 400:
        return []

    response = _crease_response(gray, orientation)
    radial: list[list[list[float]]] = []
    if canthus_anchor is not None:
        ox, oy, outward = canthus_anchor
        radial = _extract_radial_crows_paths(
            rgb,
            gray,
            skin,
            roi_mask,
            img_w,
            img_h,
            canthus=(ox, oy),
            outward=outward,
            max_paths=max_paths,
            min_length=min_length,
            percentile=max(80.0, percentile - 4.0),
        )

    hough = _extract_hough_paths_in_mask(
        gray, response, work, img_w, img_h,
        orientation=orientation, min_length=min_length, max_paths=max_paths,
        percentile=percentile,
    )
    skel = _extract_skeleton_paths_in_mask(
        gray, response, work, img_w, img_h,
        orientation=orientation, min_length=min_length * 0.9, max_paths=max(4, max_paths // 2),
        percentile=percentile,
    )
    contour = _extract_paths_in_mask(
        rgb,
        skin,
        roi_mask,
        img_w,
        img_h,
        orientation=orientation,
        min_length=min_length * 0.85,
        max_length=max(140, int(0.28 * min(img_h, img_w))),
        max_paths=max(4, max_paths // 2),
        percentile=percentile,
        min_score=9.0,
    )
    merged = _dedupe_paths(radial + hough + skel, min_dist=1.4)
    if canthus_anchor is not None and len(merged) < max_paths // 2:
        merged = _dedupe_paths(merged + contour, min_dist=1.2)
    return merged[:max_paths]


def detect_wrinkle_creases_periocular_cv(
    rgb: np.ndarray,
    alpha: np.ndarray | None,
    img_w: int,
    img_h: int,
) -> tuple[list[list[list[float]]], dict[str, object]]:
    """Detect wrinkle crease shadows on tight periocular crops (no full-face landmarks)."""
    ih, iw = rgb.shape[:2]
    skin = _build_skin_mask(rgb, alpha)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)

    eye_raw = _detect_primary_eye_box(gray)
    eye = _refine_eye_box(eye_raw, ih, iw) if eye_raw is not None else None
    if eye is not None:
        zones = _periocular_zone_masks_from_eye((ih, iw), eye, gray)
        roi_source = "eye-cascade"
    else:
        zones = _heuristic_periocular_zone_masks((ih, iw))
        roi_source = "heuristic-crop"

    min_len = max(14, int(0.022 * min(ih, iw)))

    def _path_long_enough(path: list[list[float]]) -> bool:
        vb_len = math.hypot(path[-1][0] - path[0][0], path[-1][1] - path[0][1])
        px_len = math.hypot(
            (path[-1][0] - path[0][0]) / 100.0 * img_w,
            (path[-1][1] - path[0][1]) / 100.0 * img_h,
        )
        return vb_len >= 0.55 or px_len >= min_len * 0.65

    def _finalize(raw: list[list[list[float]]]) -> list[list[list[float]]]:
        cleaned = _filter_paths_outside_eye_interior(
            _dedupe_paths(raw, min_dist=1.25),
            eye,
            img_w,
            img_h,
            canthus=canthus_px,
        )
        return [p for p in cleaned if _path_long_enough(p)]

    canthus_px: tuple[int, int] | None = None
    if eye is not None:
        canthus_px = _outer_canthus_from_iris(gray, eye, iw)

    paths: list[list[list[float]]] = []
    for percentile in (80.0, 76.0, 72.0):
        crows_raw: list[list[list[float]]] = []
        under_raw: list[list[list[float]]] = []
        for name, roi_mask, orientation, max_paths, anchor in zones:
            chunk = _extract_periocular_wrinkle_paths(
                rgb,
                gray,
                skin,
                roi_mask,
                img_w,
                img_h,
                orientation=orientation,
                max_paths=max_paths,
                min_length=min_len,
                percentile=percentile,
                canthus_anchor=anchor,
            )
            if name == "crows_feet":
                crows_raw.extend(chunk)
            else:
                under_raw.extend(chunk)

        if canthus_px is not None:
            crows_raw = [
                _anchor_path_at_canthus(p, canthus_px, img_w, img_h, max_snap_px=88)
                for p in crows_raw
            ]
        if eye is not None:
            ex, ey, ew, eh = eye
            min_under_x = ex + int(ew * 0.34)
            under_raw = [
                p
                for p in under_raw
                if sum(pt[0] for pt in p) / len(p) / 100.0 * img_w >= min_under_x
            ]
        paths = _finalize(crows_raw + under_raw)
        if len(paths) >= 7:
            break

    meta: dict[str, object] = {
        "wrinklePathSource": "detected-creases-periocular-v3",
        "roiSource": roi_source,
        "pathCount": len(paths),
    }
    if eye is not None:
        meta["eyeBox"] = list(eye)
        ox, oy = _outer_canthus_from_iris(gray, eye, iw)
        meta["outerCanthus"] = [ox, oy]

    return paths, meta


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
    skin = _wrinkle_candidate_skin_mask(rgb, alpha, lm, angle)

    percentile = 91.5
    if angle.startswith("three-quarter") or angle.startswith("profile"):
        percentile = 88.0

    zones = _zone_masks_from_landmarks(lm, (ih, iw), angle)

    def _collect(pass_percentile: float, pass_min_score: float) -> list[list[list[float]]]:
        found: list[list[list[float]]] = []
        gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
        for name, roi_mask, orientation, max_paths in zones:
            zone_percentile = pass_percentile
            zone_min_score = pass_min_score
            zone_min_length = max(12, int(0.01 * min(ih, iw)))
            zone_max_paths = max_paths

            if name.startswith("crows_"):
                zone_percentile = max(82.0, pass_percentile - 7.0)
                zone_min_score = min(pass_min_score, 8.5)
                zone_min_length = max(8, int(0.006 * min(ih, iw)))
                zone_max_paths = max(max_paths, 8)
            elif name.startswith("under_eye_"):
                zone_percentile = max(84.0, pass_percentile - 5.0)
                zone_min_score = min(pass_min_score, 10.0)
                zone_min_length = max(9, int(0.007 * min(ih, iw)))

            work = cv2.bitwise_and(skin, roi_mask)
            response = _crease_response(gray, orientation)
            chunk = _extract_hough_paths_in_mask(
                gray,
                response,
                work,
                img_w,
                img_h,
                orientation=orientation,
                min_length=zone_min_length,
                max_paths=zone_max_paths,
                percentile=zone_percentile,
            )
            chunk.extend(
                _extract_skeleton_paths_in_mask(
                    gray,
                    response,
                    work,
                    img_w,
                    img_h,
                    orientation=orientation,
                    min_length=zone_min_length,
                    max_paths=max(3, zone_max_paths // 2),
                    percentile=zone_percentile,
                )
            )
            # Contour extraction is useful for broad lower-face folds but tends
            # to draw small closed islands around pores/hair. Keep it as a
            # limited fallback only when the line extractors found almost
            # nothing in non-periocular zones.
            if len(chunk) < 2 and not name.startswith(("crows_", "under_eye_")):
                chunk.extend(
                    _extract_paths_in_mask(
                        rgb,
                        skin,
                        roi_mask,
                        img_w,
                        img_h,
                        orientation=orientation,
                        max_paths=min(2, zone_max_paths),
                        min_length=max(zone_min_length * 1.2, 16),
                        max_length=max(140, int(0.25 * min(ih, iw))),
                        percentile=zone_percentile,
                        min_score=max(zone_min_score, 12.0),
                    )
                )
            found.extend(_dedupe_paths(chunk, min_dist=1.15))
        return found

    all_paths = _collect(percentile, 18.0)
    if len(all_paths) < 3:
        all_paths = _collect(max(84.0, percentile - 4), 11.0)

    return all_paths
