from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

_SCRIPT_DIR = Path(__file__).resolve().parent


def _load_local(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, _SCRIPT_DIR / filename)
    if spec is None or spec.loader is None:
        raise ImportError(filename)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_mp_wr = _load_local("mediapipe_wrinkle_paths", "mediapipe_wrinkle_paths.py")
_cutout = _load_local("wrinkle_cutout_render", "wrinkle_cutout_render.py")
mediapipe_wrinkle_paths = _mp_wr.mediapipe_wrinkle_paths
render_wrinkle_cutout_rgba = _cutout.render_wrinkle_cutout_rgba
composite_wrinkle_view_rgb = _cutout.composite_wrinkle_view_rgb


ROOT = Path(__file__).resolve().parents[1]
IMAGE_DIR = ROOT / "src" / "assets" / "images"
OUT_JSON = ROOT / "src" / "assets" / "aura-tan-wrinkle-annotations.json"
OUT_SIZE = 2048


ANGLE_SPECS = {
    "profile-right": {
        "source": "tan_90_right.png",
        "source_bbox": (212, 753, 1320, 1320),
        "target_bbox": (888, 708, 768, 768),
    },
    "three-quarter-right": {
        "source": "tan_45_right.png",
        "source_bbox": (530, 876, 1262, 1262),
        "target_bbox": (888, 720, 744, 744),
    },
    "front": {
        "source": "tan_front.png",
        "source_bbox": (618, 1155, 1116, 1116),
        "target_bbox": (604, 700, 816, 816),
    },
    "three-quarter-left": {
        "source": "tan_45_left.png",
        "source_bbox": (263, 628, 1326, 1326),
        "target_bbox": (424, 696, 792, 792),
    },
    "profile-left": {
        "source": "tan_90_left.png",
        "source_bbox": (473, 598, 1536, 1536),
        "target_bbox": (384, 684, 788, 788),
    },
}


def clamp(v: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, v))


def segment_person(bgr: np.ndarray, bbox: tuple[int, int, int, int]) -> np.ndarray:
    h, w = bgr.shape[:2]
    work_scale = min(1.0, 960 / max(h, w))
    if work_scale < 1:
        work_bgr = cv2.resize(bgr, (round(w * work_scale), round(h * work_scale)), interpolation=cv2.INTER_AREA)
        work_bbox = tuple(round(v * work_scale) for v in bbox)
        work_alpha = segment_person(work_bgr, work_bbox)
        return cv2.resize(work_alpha, (w, h), interpolation=cv2.INTER_LINEAR)

    x, y, bw, bh = bbox
    x0 = clamp(round(x - bw * 0.75), 0, w - 2)
    y0 = clamp(round(y - bh * 0.75), 0, h - 2)
    x1 = clamp(round(x + bw * 1.45), x0 + 1, w - 1)
    y1 = clamp(round(y + bh * 2.15), y0 + 1, h - 1)
    mask = np.zeros((h, w), np.uint8)
    bgd = np.zeros((1, 65), np.float64)
    fgd = np.zeros((1, 65), np.float64)
    cv2.grabCut(bgr, mask, (x0, y0, x1 - x0, y1 - y0), bgd, fgd, 5, cv2.GC_INIT_WITH_RECT)
    alpha = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    alpha = cv2.morphologyEx(alpha, cv2.MORPH_CLOSE, kernel, iterations=1)
    alpha = cv2.morphologyEx(alpha, cv2.MORPH_OPEN, kernel, iterations=1)
    alpha = cv2.GaussianBlur(alpha, (0, 0), 2.2)
    return alpha


def aligned_plate(spec: dict) -> tuple[np.ndarray, float, float, float]:
    bgr = cv2.imread(str(IMAGE_DIR / spec["source"]), cv2.IMREAD_COLOR)
    if bgr is None:
        raise FileNotFoundError(spec["source"])
    alpha = segment_person(bgr, spec["source_bbox"])
    src_x, src_y, src_w, _src_h = spec["source_bbox"]
    target_x, target_y, target_w, _target_h = spec["target_bbox"]
    scale = target_w / src_w
    resized_w = round(bgr.shape[1] * scale)
    resized_h = round(bgr.shape[0] * scale)
    resized_bgr = cv2.resize(bgr, (resized_w, resized_h), interpolation=cv2.INTER_AREA)
    resized_alpha = cv2.resize(alpha, (resized_w, resized_h), interpolation=cv2.INTER_AREA)
    offset_x = round(target_x - src_x * scale)
    offset_y = round(target_y - src_y * scale)

    canvas = np.zeros((OUT_SIZE, OUT_SIZE, 4), np.uint8)
    dst_x0 = clamp(offset_x, 0, OUT_SIZE)
    dst_y0 = clamp(offset_y, 0, OUT_SIZE)
    dst_x1 = clamp(offset_x + resized_w, 0, OUT_SIZE)
    dst_y1 = clamp(offset_y + resized_h, 0, OUT_SIZE)
    src_x0 = dst_x0 - offset_x
    src_y0 = dst_y0 - offset_y
    src_x1 = src_x0 + (dst_x1 - dst_x0)
    src_y1 = src_y0 + (dst_y1 - dst_y0)
    if dst_x1 > dst_x0 and dst_y1 > dst_y0:
        rgb = cv2.cvtColor(resized_bgr[src_y0:src_y1, src_x0:src_x1], cv2.COLOR_BGR2RGB)
        canvas[dst_y0:dst_y1, dst_x0:dst_x1, :3] = rgb
        canvas[dst_y0:dst_y1, dst_x0:dst_x1, 3] = resized_alpha[src_y0:src_y1, src_x0:src_x1]
    canvas[:, :, 3] = refine_plate_alpha(canvas, spec["target_bbox"])
    return canvas, scale, offset_x, offset_y


def refine_plate_alpha(rgba: np.ndarray, target_bbox: tuple[int, int, int, int]) -> np.ndarray:
    rgb = rgba[:, :, :3]
    alpha = rgba[:, :, 3]
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    h, s, v = cv2.split(hsv)
    # The capture wall is bright and low saturation; the subject is either skin
    # (warmer/saturated) or dark hair/clothing. This cleanup removes the wall
    # remnants left by GrabCut without needing a heavyweight matting model.
    wall = (((v > 95) & (s < 58) & (h > 18) & (h < 96)) | ((v > 145) & (s < 36)))
    subject_color = (~wall & (((s > 16) & (v > 34)) | (v < 92))).astype(np.uint8) * 255
    alpha = cv2.bitwise_and(alpha, subject_color)

    x, y, w, bh = target_bbox
    roi = np.zeros_like(alpha)
    roi[
        clamp(round(y - bh * 0.58), 0, OUT_SIZE): clamp(round(y + bh * 1.82), 0, OUT_SIZE),
        clamp(round(x - w * 0.82), 0, OUT_SIZE): clamp(round(x + w * 1.02), 0, OUT_SIZE),
    ] = 255
    alpha = cv2.bitwise_and(alpha, roi)
    alpha = cv2.morphologyEx(alpha, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21)), iterations=2)
    alpha = cv2.morphologyEx(alpha, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)), iterations=1)
    alpha = cv2.GaussianBlur(alpha, (0, 0), 1.4)
    return alpha


def skin_mask_from_plate(rgba: np.ndarray, target_bbox: tuple[int, int, int, int]) -> np.ndarray:
    rgb = rgba[:, :, :3]
    alpha = rgba[:, :, 3]
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    h, s, v = cv2.split(hsv)
    skin = (
        (alpha > 120)
        & (v > 68)
        & (s > 18)
        & (s < 145)
        & (((h < 26) | (h > 168)))
    ).astype(np.uint8) * 255
    x, y, w, bh = target_bbox
    roi = np.zeros_like(skin)
    pad_x = round(w * 0.28)
    top_pad = round(bh * 0.28)
    bottom_pad = round(bh * 0.62)
    roi[
        clamp(y - top_pad, 0, OUT_SIZE): clamp(y + bh + bottom_pad, 0, OUT_SIZE),
        clamp(x - pad_x, 0, OUT_SIZE): clamp(x + w + pad_x, 0, OUT_SIZE),
    ] = 255
    skin = cv2.bitwise_and(skin, roi)
    skin = cv2.medianBlur(skin, 7)
    return skin


def smooth_path(path: list[list[float]], window: int = 3) -> list[list[float]]:
    if len(path) < 3:
        return path
    half = window // 2
    smoothed: list[list[float]] = []
    for i in range(len(path)):
        xs: list[float] = []
        ys: list[float] = []
        for j in range(max(0, i - half), min(len(path), i + half + 1)):
            xs.append(path[j][0])
            ys.append(path[j][1])
        smoothed.append([sum(xs) / len(xs), sum(ys) / len(ys)])
    return smoothed


def wrinkle_zone_mask(shape: tuple[int, int], target_bbox: tuple[int, int, int, int], zone: str) -> np.ndarray:
    x, y, w, h = target_bbox
    mask = np.zeros(shape, np.uint8)
    if zone == "forehead":
        mask[
            clamp(round(y - h * 0.08), 0, shape[0]): clamp(round(y + h * 0.34), 0, shape[0]),
            clamp(round(x + w * 0.12), 0, shape[1]): clamp(round(x + w * 0.88), 0, shape[1]),
        ] = 255
    elif zone == "periocular":
        mask[
            clamp(round(y + h * 0.24), 0, shape[0]): clamp(round(y + h * 0.52), 0, shape[0]),
            clamp(round(x + w * 0.08), 0, shape[1]): clamp(round(x + w * 0.92), 0, shape[1]),
        ] = 255
    elif zone == "perioral":
        mask[
            clamp(round(y + h * 0.56), 0, shape[0]): clamp(round(y + h * 0.92), 0, shape[0]),
            clamp(round(x + w * 0.18), 0, shape[1]): clamp(round(x + w * 0.82), 0, shape[1]),
        ] = 255
    else:
        mask[
            clamp(round(y - h * 0.04), 0, shape[0]): clamp(round(y + h * 0.96), 0, shape[0]),
            clamp(round(x + w * 0.06), 0, shape[1]): clamp(round(x + w * 0.94), 0, shape[1]),
        ] = 255
    return mask


def path_centroid(path: list[list[float]]) -> tuple[float, float]:
    xs = [p[0] for p in path]
    ys = [p[1] for p in path]
    return sum(xs) / len(xs), sum(ys) / len(ys)


def zone_for_path(path: list[list[float]], target_bbox: tuple[int, int, int, int]) -> str:
    cx, cy = path_centroid(path)
    x, y, w, h = target_bbox
    nx = (cx / 100 * OUT_SIZE - x) / max(1, w)
    ny = (cy / 100 * OUT_SIZE - y) / max(1, h)
    if ny < 0.34:
        return "forehead"
    if ny < 0.56:
        return "periocular"
    return "perioral"


def dedupe_paths(paths: list[list[list[float]]], min_dist: float = 1.4) -> list[list[list[float]]]:
    kept: list[list[list[float]]] = []
    for path in paths:
        cx, cy = path_centroid(path)
        if any(
            (cx - path_centroid(other)[0]) ** 2 + (cy - path_centroid(other)[1]) ** 2 < min_dist ** 2
            for other in kept
        ):
            continue
        kept.append(path)
    return kept


def contour_score(gray: np.ndarray, contour: np.ndarray) -> float:
    mask = np.zeros(gray.shape, np.uint8)
    cv2.drawContours(mask, [contour], -1, 255, 1)
    length = cv2.arcLength(contour, False)
    return float(cv2.mean(gray, mask=mask)[0] * np.sqrt(length))


def wrinkle_paths(rgba: np.ndarray, target_bbox: tuple[int, int, int, int]) -> list[list[list[float]]]:
    rgb = rgba[:, :, :3]
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.4, tileGridSize=(8, 8)).apply(gray)
    skin = skin_mask_from_plate(rgba, target_bbox)
    zone_union = np.zeros_like(skin)
    for zone in ("forehead", "periocular", "perioral"):
        zone_union = cv2.bitwise_or(zone_union, wrinkle_zone_mask(skin.shape, target_bbox, zone))
    skin = cv2.bitwise_and(skin, zone_union)

    blackhat_h = cv2.morphologyEx(clahe, cv2.MORPH_BLACKHAT, cv2.getStructuringElement(cv2.MORPH_RECT, (31, 5)))
    blackhat_v = cv2.morphologyEx(clahe, cv2.MORPH_BLACKHAT, cv2.getStructuringElement(cv2.MORPH_RECT, (5, 21)))
    response = cv2.addWeighted(blackhat_h, 0.68, blackhat_v, 0.48, 0)
    response = cv2.bilateralFilter(response, 5, 18, 18)
    values = response[skin > 0]
    if values.size == 0:
        return []
    threshold = max(14, int(np.percentile(values, 93.2)))
    binary = ((response >= threshold) & (skin > 0)).astype(np.uint8) * 255
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)), iterations=1)
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)), iterations=1)
    contours, _hier = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    candidates = []
    x, y, w, h = target_bbox
    for contour in contours:
        length = cv2.arcLength(contour, False)
        if length < 42 or length > 280:
            continue
        bx, by, bw, bh = cv2.boundingRect(contour)
        aspect = max(bw, bh) / max(1, min(bw, bh))
        if aspect < 2.0 and length < 72:
            continue
        if by < y - h * 0.12 or by > y + h * 1.04:
            continue
        if bw < 8 and bh < 14:
            continue
        if bw > w * 0.62 or bh > h * 0.34:
            continue
        if by > y + h * 0.82 and bw > w * 0.28:
            continue
        score = contour_score(response, contour)
        if score < 42:
            continue
        candidates.append((score, contour))
    candidates.sort(key=lambda item: item[0], reverse=True)

    paths: list[list[list[float]]] = []
    zone_counts = {"forehead": 0, "periocular": 0, "perioral": 0}
    zone_limits = {"forehead": 8, "periocular": 10, "perioral": 6}
    for _score, contour in candidates:
        epsilon = max(1.0, 0.018 * cv2.arcLength(contour, False))
        approx = cv2.approxPolyDP(contour, epsilon, False).reshape(-1, 2)
        if len(approx) < 2:
            continue
        if len(approx) > 12:
            keep = np.linspace(0, len(approx) - 1, 12).round().astype(int)
            approx = approx[keep]
        path = [[round(float(px) / OUT_SIZE * 100, 3), round(float(py) / OUT_SIZE * 100, 3)] for px, py in approx]
        path = smooth_path(path, window=3)
        zone = zone_for_path(path, target_bbox)
        if zone_counts[zone] >= zone_limits[zone]:
            continue
        zone_counts[zone] += 1
        paths.append(path)
        if sum(zone_counts.values()) >= 22:
            break
    return dedupe_paths(paths)


def redness_roi_mask(shape: tuple[int, int], target_bbox: tuple[int, int, int, int], angle: str) -> np.ndarray:
    x, y, w, h = target_bbox
    mask = np.zeros(shape, np.uint8)
    # Nose / medial cheeks / perioral area, matching the style of the reference
    # erythema map without filling the entire face.
    mask[
        clamp(round(y + h * 0.30), 0, shape[0]): clamp(round(y + h * 1.08), 0, shape[0]),
        clamp(round(x - w * 0.18), 0, shape[1]): clamp(round(x + w * 1.18), 0, shape[1]),
    ] = 255
    if angle.startswith("profile"):
        mid_x = x + w // 2
        if angle == "profile-right":
            mask[:, :mid_x] = 0
        else:
            mask[:, mid_x:] = 0
    return mask


def red_spots(rgba: np.ndarray, target_bbox: tuple[int, int, int, int], angle: str) -> list[dict[str, float]]:
    rgb = rgba[:, :, :3]
    alpha = rgba[:, :, 3]
    roi = redness_roi_mask(alpha.shape, target_bbox, angle)
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    _hue, sat, val = cv2.split(hsv)
    valid = (
        (alpha > 120)
        & (roi > 0)
        & (val > 45)
        & (val < 245)
        & (sat > 6)
        & (sat < 165)
    )
    if valid.sum() < 500:
        return []

    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    l = lab[:, :, 0].astype(np.float32)
    a = lab[:, :, 1].astype(np.float32)
    local_a = cv2.GaussianBlur(a, (0, 0), 17)
    local_red = np.maximum(a - local_a, 0)
    global_red = np.maximum(a - float(np.median(a[valid])), 0)

    red = rgb[:, :, 0].astype(np.float32)
    green = rgb[:, :, 1].astype(np.float32)
    blue = rgb[:, :, 2].astype(np.float32)
    rgb_red = np.maximum(red - np.maximum(green, blue), 0)

    med_l = float(np.median(l[valid]))
    score = 0.34 * local_red + 0.42 * global_red + 0.24 * rgb_red
    score[~valid] = 0
    score[l < med_l - 34] = 0
    score[l > med_l + 54] = 0

    threshold = max(0.4, float(np.percentile(score[valid], 76)))
    peaks = (score >= threshold).astype(np.uint8) * 255
    peaks = cv2.morphologyEx(peaks, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)), iterations=1)
    peaks = cv2.morphologyEx(peaks, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)), iterations=1)
    n, _labels, stats, centroids = cv2.connectedComponentsWithStats(peaks, connectivity=8)

    spots: list[tuple[float, dict[str, float]]] = []
    for idx in range(1, n):
        area = int(stats[idx, cv2.CC_STAT_AREA])
        if area < 4 or area > 5200:
            continue
        x0 = int(stats[idx, cv2.CC_STAT_LEFT])
        y0 = int(stats[idx, cv2.CC_STAT_TOP])
        bw = int(stats[idx, cv2.CC_STAT_WIDTH])
        bh = int(stats[idx, cv2.CC_STAT_HEIGHT])
        if bw > target_bbox[2] * 0.42 or bh > target_bbox[3] * 0.36:
            continue
        cx_px, cy_px = centroids[idx]
        if not (0 <= int(cx_px) < OUT_SIZE and 0 <= int(cy_px) < OUT_SIZE):
            continue
        cx = float(cx_px) / OUT_SIZE * 100
        cy = float(cy_px) / OUT_SIZE * 100
        if not (15 <= cx <= 85 and 25 <= cy <= 82):
            continue
        intensity = float(np.clip(score[int(cy_px), int(cx_px)] / max(threshold, 1e-3), 0.45, 1.0))
        radius = float(np.clip(np.sqrt(area) / OUT_SIZE * 100 * 1.75, 0.16, 1.45))
        aspect = float(np.clip(bw / max(1, bh), 0.55, 1.85))
        spots.append((
            intensity * (1 + min(area, 1600) / 4200),
            {
                "cx": round(cx, 3),
                "cy": round(cy, 3),
                "rx": round(radius * np.sqrt(aspect), 3),
                "ry": round(radius / np.sqrt(aspect), 3),
                "intensity": round(intensity, 3),
            },
        ))

    spots.sort(key=lambda item: item[0], reverse=True)
    return [spot for _score, spot in spots[:72]]


def draw_wrinkle_paths(bgr: np.ndarray, paths: list[list[list[float]]]) -> np.ndarray:
    """Composite soft-glow wrinkle strokes onto the aligned plate."""
    h, w = bgr.shape[:2]
    line_mask = np.zeros((h, w), np.float32)
    for path in paths:
        pts = np.array(
            [[round(x / 100 * OUT_SIZE), round(y / 100 * OUT_SIZE)] for x, y in path],
            dtype=np.int32,
        )
        if len(pts) < 2:
            continue
        cv2.polylines(line_mask, [pts], False, 1.0, 1, cv2.LINE_AA)

    glow = cv2.GaussianBlur(line_mask, (0, 0), 2.6)
    out = bgr.astype(np.float32)
    stroke = np.array([109.0, 243.0, 167.0], dtype=np.float32)  # BGR #a7f36d
    # Soft outer glow
    for channel in range(3):
        out[:, :, channel] = np.clip(out[:, :, channel] + glow * (stroke[channel] * 0.34), 0, 255)
    # Crisp inner stroke
    for path in paths:
        pts = np.array(
            [[round(x / 100 * OUT_SIZE), round(y / 100 * OUT_SIZE)] for x, y in path],
            dtype=np.int32,
        )
        if len(pts) < 2:
            continue
        cv2.polylines(out, [pts], False, stroke.tolist(), 2, cv2.LINE_AA)
    return out.astype(np.uint8)


def save_plate(bgr: np.ndarray, out_path: Path) -> None:
    Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB), "RGB").save(out_path, "WEBP", quality=90, method=6)


def save_plate_from_rgba(plate: np.ndarray, out_path: Path) -> np.ndarray:
    rgb = plate[:, :, :3].astype(np.float32)
    alpha = plate[:, :, 3:4].astype(np.float32) / 255.0
    # Flatten onto black so the Aura viewport never shows fringe through alpha.
    composited = (rgb * alpha).astype(np.uint8)
    bgr = cv2.cvtColor(composited, cv2.COLOR_RGB2BGR)
    save_plate(bgr, out_path)
    return bgr


def main() -> None:
    annotations: dict[str, dict[str, object]] = {}
    for angle, spec in ANGLE_SPECS.items():
        plate, _scale, _offset_x, _offset_y = aligned_plate(spec)
        out_name = f"aura-tan-{angle}.webp"
        out_wrinkles_name = f"aura-tan-{angle}-wrinkles.webp"
        bgr = save_plate_from_rgba(plate, IMAGE_DIR / out_name)
        plate_rgb = plate[:, :, :3]
        paths, path_source = mediapipe_wrinkle_paths(
            plate_rgb,
            angle,
            OUT_SIZE,
            OUT_SIZE,
            fallback_bbox=spec["target_bbox"],
            alpha=plate[:, :, 3],
        )
        redness = red_spots(plate, spec["target_bbox"], angle)
        wrinkle_rgba = render_wrinkle_cutout_rgba(OUT_SIZE, OUT_SIZE, paths, plate[:, :, 3])
        Image.fromarray(wrinkle_rgba, "RGBA").save(
            IMAGE_DIR / out_wrinkles_name,
            "WEBP",
            quality=92,
            method=6,
        )
        out_wrinkles_view_name = f"aura-tan-{angle}-wrinkles-view.webp"
        view_rgb = composite_wrinkle_view_rgb(plate_rgb, plate[:, :, 3], wrinkle_rgba)
        Image.fromarray(view_rgb, "RGB").save(
            IMAGE_DIR / out_wrinkles_view_name,
            "WEBP",
            quality=92,
            method=6,
        )
        annotations[angle] = {
            "image": out_name,
            "imageWrinkles": out_wrinkles_name,
            "imageWrinklesView": out_wrinkles_view_name,
            "targetBBox": spec["target_bbox"],
            "wrinkles": paths,
            "wrinklePathSource": path_source,
            "redSpots": redness,
        }
        print(
            f"{angle}: {len(paths)} wrinkle paths ({path_source}), {len(redness)} red spots -> {out_name}, {out_wrinkles_name}",
            flush=True,
        )

    if not annotations["profile-right"].get("redSpots") and annotations["profile-left"].get("redSpots"):
        annotations["profile-right"]["redSpots"] = [
            {**spot, "cx": round(100 - float(spot["cx"]), 3)}
            for spot in annotations["profile-left"]["redSpots"]
        ]
    OUT_JSON.write_text(json.dumps(annotations, indent=2) + "\n")


if __name__ == "__main__":
    main()
