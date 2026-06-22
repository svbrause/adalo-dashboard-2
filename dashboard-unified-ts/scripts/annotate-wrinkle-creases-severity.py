#!/usr/bin/env python3
"""Detect wrinkle crease paths, score severity, and export istock-style annotation pack."""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import shutil
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SCRIPT_DIR = Path(__file__).resolve().parent

SEV_PAL_RGB = {
    "Mild": (110, 130, 155),
    "Moderate": (247, 139, 46),
    "High": (220, 53, 69),
}
GRAY_STROKE = (72, 92, 118)


def _load(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPT_DIR / filename)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _path_to_pixels(path: list[list[float]], iw: int, ih: int) -> np.ndarray:
    pts = []
    for x, y in path:
        pts.append([round(x / 100.0 * iw), round(y / 100.0 * ih)])
    return np.array(pts, dtype=np.int32).reshape(-1, 1, 2)


def score_path(
    path: list[list[float]],
    response: np.ndarray,
    iw: int,
    ih: int,
) -> float:
    samples: list[float] = []
    for x, y in path:
        px = int(round(x / 100.0 * iw))
        py = int(round(y / 100.0 * ih))
        if 0 <= px < iw and 0 <= py < ih:
            samples.append(float(response[py, px]))
    if not samples:
        return 0.0
    px_len = math.hypot(
        (path[-1][0] - path[0][0]) / 100.0 * iw,
        (path[-1][1] - path[0][1]) / 100.0 * ih,
    )
    return float(np.percentile(samples, 88)) * max(1.0, px_len ** 0.22)


def tier_for_scores(scores: list[float]) -> tuple[list[str], dict[str, float]]:
    if not scores:
        return [], {"moderate": 0.0, "high": 0.0}
    arr = np.array(scores, dtype=np.float32)
    mod_thr = float(np.percentile(arr, 62))
    hi_thr = float(np.percentile(arr, 90))
    tiers = [
        "High" if s >= hi_thr else "Moderate" if s >= mod_thr else "Mild"
        for s in scores
    ]
    return tiers, {"moderate": mod_thr, "high": hi_thr}


def render_stroked_paths(
    rgb: np.ndarray,
    paths: list[list[list[float]]],
    tiers: list[str] | None,
    *,
    gray: bool = False,
) -> np.ndarray:
    out = rgb.copy()
    h, w = rgb.shape[:2]
    shadow = np.zeros((h, w, 4), np.uint8)
    halo = np.zeros((h, w, 4), np.uint8)
    stroke = np.zeros((h, w, 4), np.uint8)

    for i, path in enumerate(paths):
        if len(path) < 2:
            continue
        tier = tiers[i] if tiers is not None else "Mild"
        col = GRAY_STROKE if gray else SEV_PAL_RGB[tier]
        lw = 3 if (not gray and tier == "High") else 2
        pts = _path_to_pixels(path, w, h)
        cv2.polylines(shadow, [pts], False, (0, 0, 0, 40), lw + 4, cv2.LINE_AA)
        cv2.polylines(halo, [pts], False, (255, 255, 255, 120), lw + 2, cv2.LINE_AA)
        alpha = 255 if gray else (220 if tier == "High" else 200)
        cv2.polylines(stroke, [pts], False, (*col, alpha), lw, cv2.LINE_AA)

    for layer in (shadow, halo, stroke):
        a = layer[:, :, 3:4].astype(np.float32) / 255.0
        out = np.clip(
            out.astype(np.float32) * (1.0 - a) + layer[:, :, :3].astype(np.float32) * a,
            0,
            255,
        ).astype(np.uint8)
    return out


def render_cutout_rgba(
    ih: int,
    iw: int,
    paths: list[list[list[float]]],
    tiers: list[str],
) -> np.ndarray:
    rgba = np.zeros((ih, iw, 4), np.uint8)
    for path, tier in zip(paths, tiers, strict=False):
        if len(path) < 2:
            continue
        col = SEV_PAL_RGB[tier]
        pts = _path_to_pixels(path, iw, ih)
        lw = 3 if tier == "High" else 2
        cv2.polylines(rgba, [pts], False, (*col, 110), lw + 2, cv2.LINE_AA)
        cv2.polylines(rgba, [pts], False, (*col, 230), lw, cv2.LINE_AA)
    return rgba


def add_legend(img: np.ndarray, counts: dict[str, int], title: str) -> np.ndarray:
    total = max(sum(counts.values()), 1)
    sev_idx = (
        counts.get("Mild", 0) * 0.35
        + counts.get("Moderate", 0) * 0.65
        + counts.get("High", 0)
    ) / total
    overall = "High" if sev_idx >= 0.72 else "Moderate" if sev_idx >= 0.48 else "Mild"
    h, w = img.shape[:2]
    pil = Image.fromarray(img)
    draw = ImageDraw.Draw(pil, "RGBA")
    try:
        fnt = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 15)
        fntb = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 17)
    except OSError:
        fnt = fntb = ImageFont.load_default()
    x0, y0 = 24, h - 122
    draw.rounded_rectangle(
        [x0, y0, x0 + 230, y0 + 98],
        radius=8,
        fill=(255, 255, 255, 226),
        outline=(45, 55, 72, 82),
        width=1,
    )
    draw.text((x0 + 12, y0 + 10), f"{title}: {overall}", fill=(25, 32, 42, 245), font=fntb)
    for i, label in enumerate(["Mild", "Moderate", "High"]):
        yy = y0 + 43 + i * 17
        draw.line([x0 + 14, yy + 7, x0 + 45, yy + 7], fill=(*SEV_PAL_RGB[label], 250), width=4)
        draw.text(
            (x0 + 56, yy),
            f"{label} ({counts.get(label, 0)})",
            fill=(42, 50, 62, 240),
            font=fnt,
        )
    return np.array(pil), overall, round(sev_idx, 3)


def build_comparison(
    rgb: np.ndarray,
    diagnostic: np.ndarray,
    severity: np.ndarray,
) -> np.ndarray:
    h, w = rgb.shape[:2]
    gap = 8
    try:
        fnt = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 22)
    except OSError:
        fnt = ImageFont.load_default()
    labels = ["Original", "Crease response", "Severity annotation"]
    panels = [rgb, diagnostic, severity]
    canvas = Image.new("RGB", (w * 3 + gap * 2, h + 52), (246, 246, 246))
    draw = ImageDraw.Draw(canvas)
    for i, (label, arr) in enumerate(zip(labels, panels, strict=True)):
        x = i * (w + gap)
        draw.text((x + 16, 13), label, fill=(30, 38, 50), font=fnt)
        canvas.paste(Image.fromarray(arr), (x, 52))
    return np.array(canvas)


def annotate_wrinkle_pack(
    img_path: Path,
    out_dir: Path,
    *,
    angle: str = "front",
    stem: str | None = None,
    copy_source: bool = True,
) -> None:
    face_mod = _load("annotate_face", "annotate-face-wrinkles.py")
    crease_mod = _load("crease", "wrinkle_crease_detect.py")
    cutout_mod = _load("cutout", "wrinkle_cutout_render.py")

    out_dir.mkdir(parents=True, exist_ok=True)
    img_path = img_path.resolve()
    stem = stem or img_path.stem

    if copy_source:
        stored = out_dir / f"{stem}-source.png"
        if img_path.resolve() != stored.resolve():
            shutil.copy2(img_path, stored)
        source_ref = stored
    else:
        source_ref = img_path

    rgb = np.array(Image.open(img_path).convert("RGB"))
    ih, iw = rgb.shape[:2]
    alpha = cutout_mod.studio_backdrop_mask(rgb)

    paths, tag = face_mod.resolve_wrinkle_paths(rgb, angle, alpha)
    print(f"[detect] {len(paths)} paths ({tag})")

    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    response = crease_mod._crease_response(gray, "any")
    skin = crease_mod._build_skin_mask(rgb, alpha)
    skin_mask = (skin > 40).astype(np.float32)
    resp_masked = (response.astype(np.float32) * skin_mask).astype(np.uint8)
    heat = cv2.applyColorMap(resp_masked, cv2.COLORMAP_MAGMA)
    diagnostic = cv2.cvtColor(heat, cv2.COLOR_BGR2RGB)
    person_a = (alpha.astype(np.float32) / 255.0)[..., None]
    diagnostic = (diagnostic * person_a).astype(np.uint8)

    scores = [score_path(p, response, iw, ih) for p in paths]
    tiers, thresholds = tier_for_scores(scores)
    counts = {k: tiers.count(k) for k in ("Mild", "Moderate", "High")}

    gray_overlay = render_stroked_paths(rgb, paths, tiers, gray=True)
    severity_overlay = render_stroked_paths(rgb, paths, tiers, gray=False)
    severity_overlay, overall, sev_idx = add_legend(
        severity_overlay,
        counts,
        "Wrinkle severity",
    )

    cutout = render_cutout_rgba(ih, iw, paths, tiers)
    base = rgb.astype(np.float32)
    a = cutout[:, :, 3:4].astype(np.float32) / 255.0
    baked = np.clip(base * (1.0 - a) + cutout[:, :, :3].astype(np.float32) * a, 0, 255).astype(
        np.uint8,
    )

    comparison = build_comparison(rgb, diagnostic, severity_overlay)

    Image.fromarray(rgb).save(out_dir / f"{stem}-source.png")
    Image.fromarray(diagnostic).save(out_dir / f"{stem}-crease-response-diagnostic.png")
    Image.fromarray(gray_overlay).save(out_dir / f"{stem}-wrinkle-lines-gray.png")
    Image.fromarray(severity_overlay).save(out_dir / f"{stem}-wrinkle-lines-severity.png")
    Image.fromarray(cutout, "RGBA").save(out_dir / f"{stem}-wrinkle-lines-severity-cutout.png")
    Image.fromarray(baked).save(out_dir / f"{stem}-wrinkle-lines-severity-baked.png")
    Image.fromarray(comparison).save(out_dir / f"{stem}-annotation-comparison.jpg", quality=95)

    payload = {
        "label": "CV-detected wrinkle crease annotation with severity",
        "imageSize": [iw, ih],
        "source": str(source_ref),
        "angle": angle,
        "wrinklePathSource": tag,
        "pathCount": len(paths),
        "overallSeverity": overall,
        "severityIndex": sev_idx,
        "counts": counts,
        "thresholds": thresholds,
        "wrinkles": [
            {"path": path, "score": round(score, 2), "tier": tier}
            for path, score, tier in zip(paths, scores, tiers, strict=False)
        ],
    }
    (out_dir / f"{stem}-wrinkle-severity.json").write_text(
        json.dumps(payload, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"[save] -> {out_dir}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Wrinkle crease annotation + severity pack.")
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--stem", type=str, default=None)
    parser.add_argument(
        "--angle",
        default="front",
        help="front | three-quarter-left | three-quarter-right | profile-left | profile-right",
    )
    parser.add_argument("--no-copy", action="store_true")
    args = parser.parse_args()
    annotate_wrinkle_pack(
        args.input,
        args.output_dir,
        angle=args.angle,
        stem=args.stem,
        copy_source=not args.no_copy,
    )


if __name__ == "__main__":
    main()
