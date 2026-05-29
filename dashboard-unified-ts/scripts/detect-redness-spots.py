#!/usr/bin/env python3
"""Detect erythema / red spots on facial photos and render overlays on color stills.

Usage:
  python3 scripts/detect-redness-spots.py \\
    --front path/to/front.jpg --side path/to/side.jpg \\
    --slug amie-bailey --out public/demo-3d/amie-bailey/pipeline-test
"""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SCRIPT_DIR = Path(__file__).resolve().parent


def load_mod(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ImportError(path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def load_rgb(path: Path) -> np.ndarray:
    bgr = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if bgr is None:
        raise FileNotFoundError(path)
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)


def compare_panel(source: np.ndarray, overlay: np.ndarray, label: str) -> np.ndarray:
    h = max(source.shape[0], overlay.shape[0])

    def pad(img: np.ndarray) -> np.ndarray:
        if img.shape[0] == h:
            return img
        return cv2.copyMakeBorder(img, 0, h - img.shape[0], 0, 0, cv2.BORDER_CONSTANT, value=(128, 128, 128))

    source, overlay = pad(source), pad(overlay)
    gap = np.zeros((h, 12, 3), np.uint8)
    combo = np.hstack([source, gap, overlay])
    banner = np.zeros((48, combo.shape[1], 3), np.uint8)
    cv2.putText(
        banner,
        f"{label}: COLOR (left) vs RED SPOTS (right)",
        (16, 32),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.65,
        (230, 230, 230),
        2,
        cv2.LINE_AA,
    )
    return np.vstack([banner, combo])


def process_photo(
    aura,
    rgb: np.ndarray,
    *,
    angle: str,
    label: str,
    out_dir: Path,
    slug: str,
) -> dict:
    rgba = aura.rembg_rgba(rgb)
    alpha = rgba[:, :, 3]
    spots = aura.detect_redness_spots(rgb, alpha, angle=angle)
    overlay = aura.render_redness_overlay(rgb, alpha, spots)

    stem = f"{slug}-{label}"
    cv2.imwrite(str(out_dir / f"{stem}-color.jpg"), cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), [int(cv2.IMWRITE_JPEG_QUALITY), 92])
    cv2.imwrite(str(out_dir / f"{stem}-redness.jpg"), cv2.cvtColor(overlay, cv2.COLOR_RGB2BGR), [int(cv2.IMWRITE_JPEG_QUALITY), 92])
    compare = compare_panel(rgb, overlay, label.upper())
    cv2.imwrite(str(out_dir / f"{stem}-compare.jpg"), cv2.cvtColor(compare, cv2.COLOR_RGB2BGR), [int(cv2.IMWRITE_JPEG_QUALITY), 92])

    return {"angle": angle, "label": label, "spotCount": len(spots), "spots": spots}


def main() -> None:
    parser = argparse.ArgumentParser(description="Detect redness spots on facial photos.")
    parser.add_argument("--front", type=Path, help="Front-facing color photo")
    parser.add_argument("--side", type=Path, help="Side profile color photo")
    parser.add_argument("--slug", default="patient", help="Output filename prefix")
    parser.add_argument("--out", type=Path, default=ROOT / "public/demo-3d/redness-test/pipeline-test")
    args = parser.parse_args()

    aura = load_mod("aura_assets", SCRIPT_DIR / "generate_patient_aura_assets.py")
    args.out.mkdir(parents=True, exist_ok=True)

    results: list[dict] = []
    if args.front:
        rgb = load_rgb(args.front)
        results.append(process_photo(aura, rgb, angle="front", label="front", out_dir=args.out, slug=args.slug))
    if args.side:
        rgb = load_rgb(args.side)
        results.append(process_photo(aura, rgb, angle="profile-right", label="side", out_dir=args.out, slug=args.slug))

    if not results:
        parser.error("Provide at least one of --front or --side")

    manifest = {"slug": args.slug, "results": results}
    manifest_path = args.out / f"{args.slug}-redness-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    for item in results:
        print(
            f"{item['label']}: {item['spotCount']} red spots -> "
            f"{args.out / f'{args.slug}-{item['label']}-compare.jpg'}",
            flush=True,
        )
    print(f"manifest: {manifest_path}", flush=True)


if __name__ == "__main__":
    main()
