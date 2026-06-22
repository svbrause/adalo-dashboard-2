#!/usr/bin/env python3
"""
Wrinkle Detection, Annotation & Removal Pipeline
=================================================
Uses multi-scale Hessian ridge detection (Frangi-style) to:
  1. Detect fine wrinkles/skin lines as dark ridges
  2. Annotate them with overlay lines (like manual markup)
  3. Remove them via inpainting + bilateral smoothing blend

Requirements:
    pip install opencv-python scipy scikit-image numpy Pillow

Usage:
    python wrinkle_pipeline.py --input face.png --output_dir ./results
    python wrinkle_pipeline.py --input face.png --threshold 10 --sigmas 1.0 1.5 2.0 2.5
"""

from __future__ import annotations

import argparse
import os

import cv2
import numpy as np
from scipy.ndimage import gaussian_filter
from skimage.morphology import skeletonize


def build_skin_mask(gray: np.ndarray, lo: int = 90, hi: int = 245) -> np.ndarray:
    """Rough skin mask: exclude very dark (eyes, brows) and blown highlights."""
    mask = ((gray > lo) & (gray < hi)).astype(np.uint8) * 255
    return mask


def detect_wrinkles(
    gray: np.ndarray,
    skin_mask: np.ndarray,
    sigmas: list[float] | tuple[float, ...] = (1.0, 1.5, 2.0, 2.5),
    threshold: int = 10,
) -> tuple[np.ndarray, np.ndarray]:
    """Multi-scale Hessian ridge detector tuned for fine skin lines."""
    response = np.zeros_like(gray, dtype=float)

    for sigma in sigmas:
        g = gray.astype(float)
        scale = sigma**2
        Dxx = gaussian_filter(g, sigma, order=[0, 2]) * scale
        Dyy = gaussian_filter(g, sigma, order=[2, 0]) * scale
        Dxy = gaussian_filter(g, sigma, order=[1, 1]) * scale

        discriminant = np.sqrt((Dxx - Dyy) ** 2 + 4 * Dxy ** 2)
        lambda1 = 0.5 * (Dxx + Dyy + discriminant)
        lambda2 = 0.5 * (Dxx + Dyy - discriminant)

        ridgeness = np.where((lambda1 > 0) & (lambda2 > 0), lambda2, 0)
        response = np.maximum(response, ridgeness)

    ridge_map = (response / (response.max() + 1e-10) * 255).astype(np.uint8)

    _, mask = cv2.threshold(ridge_map, threshold, 255, cv2.THRESH_BINARY)
    mask = cv2.bitwise_and(mask, skin_mask)

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)

    return mask, ridge_map


def annotate_wrinkles(
    image_bgr: np.ndarray,
    wrinkle_mask: np.ndarray,
    line_color: tuple[int, int, int] = (50, 52, 65),
    line_thickness: int = 1,
    skeletonize_lines: bool = True,
) -> np.ndarray:
    """Draw wrinkle annotation lines on top of the original image."""
    annotated = image_bgr.copy()

    if skeletonize_lines:
        skel = skeletonize(wrinkle_mask > 0).astype(np.uint8) * 255
    else:
        skel = wrinkle_mask.copy()

    if line_thickness > 1:
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (line_thickness, line_thickness))
        skel = cv2.dilate(skel, k, iterations=1)

    annotated[skel > 0] = line_color
    return annotated


def remove_wrinkles(
    image_bgr: np.ndarray,
    wrinkle_mask: np.ndarray,
    inpaint_radius: int = 10,
    bilateral_passes: int = 1,
    blend_expand_px: int = 10,
    blend_blur_sigma: float = 6.0,
) -> np.ndarray:
    """Remove wrinkles via TELEA inpainting + bilateral smoothing + feathered blend."""
    k_inpaint = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    inpaint_mask = cv2.dilate(wrinkle_mask, k_inpaint)

    repaired = cv2.inpaint(image_bgr, inpaint_mask, inpaint_radius, cv2.INPAINT_TELEA)

    smoothed = repaired.copy()
    for _ in range(bilateral_passes):
        smoothed = cv2.bilateralFilter(smoothed, 13, 60, 60)

    k_blend = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE,
        (blend_expand_px * 2 + 1, blend_expand_px * 2 + 1),
    )
    blend_base = cv2.dilate(wrinkle_mask, k_blend)
    kernel_size = int(blend_blur_sigma * 4) | 1
    blend_float = (
        cv2.GaussianBlur(blend_base.astype(float), (kernel_size, kernel_size), blend_blur_sigma)
        / 255.0
    )
    alpha = np.stack([blend_float] * 3, axis=2)

    return (smoothed.astype(float) * alpha + image_bgr.astype(float) * (1.0 - alpha)).astype(
        np.uint8,
    )


def run_pipeline(
    input_path: str,
    output_dir: str,
    threshold: int = 10,
    sigmas: list[float] | tuple[float, ...] = (1.0, 1.5, 2.0, 2.5),
    annotation_color: tuple[int, int, int] = (50, 52, 65),
    save_comparison: bool = True,
    save_ridge_map: bool = False,
) -> dict[str, np.ndarray]:
    """End-to-end pipeline."""
    os.makedirs(output_dir, exist_ok=True)
    base = os.path.splitext(os.path.basename(input_path))[0]

    img = cv2.imread(input_path)
    if img is None:
        raise FileNotFoundError(f"Cannot load image: {input_path}")
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    skin_mask = build_skin_mask(gray)
    wrinkle_mask, ridge_map = detect_wrinkles(gray, skin_mask, sigmas=sigmas, threshold=threshold)
    wrinkle_px = int((wrinkle_mask > 0).sum())
    skin_px = max(int((skin_mask > 0).sum()), 1)
    print(f"[detect]  {wrinkle_px} wrinkle pixels ({100.0 * wrinkle_px / skin_px:.1f}% of skin)")

    annotated = annotate_wrinkles(img, wrinkle_mask, line_color=annotation_color)
    removed = remove_wrinkles(img, wrinkle_mask)

    ann_path = os.path.join(output_dir, f"{base}_annotated.png")
    rem_path = os.path.join(output_dir, f"{base}_removed.png")
    cv2.imwrite(ann_path, annotated)
    cv2.imwrite(rem_path, removed)
    print(f"[save]    {ann_path}")
    print(f"[save]    {rem_path}")

    results: dict[str, np.ndarray] = {
        "original": img,
        "annotated": annotated,
        "removed": removed,
        "wrinkle_mask": wrinkle_mask,
        "ridge_map": ridge_map,
    }

    if save_ridge_map:
        rm_path = os.path.join(output_dir, f"{base}_ridge_map.png")
        cv2.imwrite(rm_path, ridge_map)
        print(f"[save]    {rm_path}")

    if save_comparison:
        sep = np.ones((img.shape[0], 6, 3), dtype=np.uint8) * 200
        comparison = np.hstack([img, sep, annotated, sep, removed])
        cmp_path = os.path.join(output_dir, f"{base}_comparison.png")
        cv2.imwrite(cmp_path, comparison)
        print(f"[save]    {cmp_path}  (original | annotated | removed)")
        results["comparison"] = comparison

    return results


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Detect, annotate, and remove facial wrinkles using CV.",
    )
    parser.add_argument("--input", required=True, help="Path to input face image")
    parser.add_argument("--output_dir", default="./results", help="Where to save outputs")
    parser.add_argument(
        "--threshold",
        type=int,
        default=10,
        help="Ridge detection threshold 0-255 (lower=more lines, default=10)",
    )
    parser.add_argument(
        "--sigmas",
        type=float,
        nargs="+",
        default=[1.0, 1.5, 2.0, 2.5],
        help="Hessian scales (default: 1.0 1.5 2.0 2.5)",
    )
    parser.add_argument("--no_comparison", action="store_true", help="Skip comparison image")
    parser.add_argument(
        "--save_ridge_map",
        action="store_true",
        help="Also save the raw ridge response map for tuning",
    )
    args = parser.parse_args()

    print(f"\n{'=' * 55}")
    print("  Wrinkle Pipeline")
    print(f"  input     : {args.input}")
    print(f"  output_dir: {args.output_dir}")
    print(f"  threshold : {args.threshold}")
    print(f"  sigmas    : {args.sigmas}")
    print(f"{'=' * 55}\n")

    run_pipeline(
        input_path=args.input,
        output_dir=args.output_dir,
        threshold=args.threshold,
        sigmas=args.sigmas,
        save_comparison=not args.no_comparison,
        save_ridge_map=args.save_ridge_map,
    )
    print("\nDone.")


if __name__ == "__main__":
    main()
