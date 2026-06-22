#!/usr/bin/env python3
"""Calibrate a Botox-style simulation from a before/after reference board.

This script extracts the left and right panels, aligns the right panel to the
before crop, measures wrinkle-response reduction, then emits a calibrated
simulation and scorecard.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[0]


def _load_sim():
    spec = importlib.util.spec_from_file_location(
        "simulate_wrinkle_treatment",
        SCRIPT_DIR / "simulate-wrinkle-treatment.py",
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _load_crease():
    spec = importlib.util.spec_from_file_location(
        "wrinkle_crease_detect",
        SCRIPT_DIR / "wrinkle_crease_detect.py",
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _align_after_to_before(before: np.ndarray, after: np.ndarray) -> tuple[np.ndarray, dict[str, object]]:
    """Affine-align after to before for metric comparison only."""
    after_rs = cv2.resize(after, (before.shape[1], before.shape[0]), interpolation=cv2.INTER_AREA)
    before_gray = cv2.cvtColor(before, cv2.COLOR_RGB2GRAY)
    after_gray = cv2.cvtColor(after_rs, cv2.COLOR_RGB2GRAY)
    warp = np.eye(2, 3, dtype=np.float32)
    try:
        cc, warp = cv2.findTransformECC(
            before_gray,
            after_gray,
            warp,
            cv2.MOTION_AFFINE,
            (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 80, 1e-5),
            None,
            5,
        )
        aligned = cv2.warpAffine(
            after_rs,
            warp,
            (before.shape[1], before.shape[0]),
            flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP,
            borderMode=cv2.BORDER_REFLECT,
        )
        return aligned, {"alignment": "ecc-affine", "ecc": float(cc), "warp": warp.tolist()}
    except cv2.error as exc:
        return after_rs, {"alignment": "resize-only", "error": str(exc)}


def _build_metrics_mask(before: np.ndarray, mask: np.ndarray, crease_mod) -> np.ndarray:
    gray = cv2.cvtColor(before, cv2.COLOR_RGB2GRAY)
    protect = sim._eye_protect_mask(gray, before.shape[0], before.shape[1], crease_mod)
    valid = (mask > 0.12) & (protect < 0.32)
    return valid.astype(np.uint8) * 255


def _metric_response(rgb: np.ndarray, valid: np.ndarray, crease_mod) -> dict[str, float]:
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    resp_any = crease_mod._crease_response(gray, "any").astype(np.float32)
    resp_h = crease_mod._crease_response(gray, "horizontal").astype(np.float32)
    lap = cv2.Laplacian(gray, cv2.CV_32F, ksize=3)
    values = valid > 0
    if not np.any(values):
        return {"creaseMean": 0.0, "creaseP90": 0.0, "horizontalP90": 0.0, "textureStd": 0.0}
    return {
        "creaseMean": float(np.mean(resp_any[values])),
        "creaseP90": float(np.percentile(resp_any[values], 90)),
        "horizontalP90": float(np.percentile(resp_h[values], 90)),
        "textureStd": float(np.std(lap[values])),
    }


def _zone_metric_masks(
    before: np.ndarray,
    metric_mask: np.ndarray,
    crease_mod,
    lateral_fold_mask: np.ndarray | None = None,
) -> dict[str, np.ndarray]:
    h, w = before.shape[:2]
    gray = cv2.cvtColor(before, cv2.COLOR_RGB2GRAY)
    eye = crease_mod._detect_primary_eye_box(gray)
    if eye is not None:
        ex, ey, ew, eh = crease_mod._refine_eye_box(eye, h, w)
        forehead = np.zeros((h, w), np.uint8)
        cv2.rectangle(
            forehead,
            (max(0, int(ex - w * 0.40)), max(0, int(ey - h * 0.42))),
            (min(w, int(ex + ew + w * 0.34)), max(1, int(ey + eh * 0.02))),
            255,
            -1,
        )
        crows = np.zeros((h, w), np.uint8)
        ox, oy = crease_mod._outer_canthus_from_iris(gray, (ex, ey, ew, eh), w)
        outward = "right" if ox >= ex + ew // 2 else "left"
        crows = crease_mod._crows_feet_fan_mask(h, w, ox, oy, outward=outward)
        under_eye = np.zeros((h, w), np.uint8)
        cv2.rectangle(
            under_eye,
            (max(0, ex - int(ew * 0.10)), min(h - 1, ey + int(eh * 0.52))),
            (min(w, ox + int(ew * 0.16)), min(h, ey + eh + int(eh * 0.28))),
            255,
            -1,
        )
    else:
        forehead = np.zeros((h, w), np.uint8)
        cv2.rectangle(forehead, (0, 0), (w, int(h * 0.42)), 255, -1)
        crows = np.zeros((h, w), np.uint8)
        cv2.rectangle(crows, (int(w * 0.03), int(h * 0.32)), (int(w * 0.62), int(h * 0.72)), 255, -1)
        under_eye = np.zeros((h, w), np.uint8)
        cv2.rectangle(under_eye, (int(w * 0.20), int(h * 0.48)), (int(w * 0.75), int(h * 0.68)), 255, -1)

    zones = {
        "allTreatment": metric_mask,
        "forehead": cv2.bitwise_and(metric_mask, forehead),
        "crowsFeet": cv2.bitwise_and(metric_mask, crows),
        "underEye": cv2.bitwise_and(metric_mask, under_eye),
    }
    if lateral_fold_mask is not None and lateral_fold_mask.max() > 0:
        lateral = (lateral_fold_mask > 0.16).astype(np.uint8) * 255
        zones["lateralCanthusFold"] = lateral
    return {key: value for key, value in zones.items() if cv2.countNonZero(value) > 50}


def _reduction(before: dict[str, float], other: dict[str, float]) -> dict[str, float]:
    out: dict[str, float] = {}
    for key, base in before.items():
        if base <= 1e-6:
            out[key] = 0.0
        else:
            out[key] = float(np.clip(1.0 - other[key] / base, -1.0, 1.0))
    return out


def _make_score_panel(
    before: np.ndarray,
    simulated: np.ndarray,
    target: np.ndarray,
) -> np.ndarray:
    h, w = before.shape[:2]
    gap = 8
    label_h = 42
    target = cv2.resize(target, (w, h), interpolation=cv2.INTER_AREA)
    canvas = np.full((h + label_h, w * 3 + gap * 2, 3), 245, np.uint8)
    labels = ("Before", "Simulated", "Aligned ground truth")
    for i, (label, img) in enumerate(zip(labels, (before, simulated, target))):
        x = i * (w + gap)
        canvas[:label_h, x : x + w] = sim._label_bar(label, w)
        canvas[label_h:, x : x + w] = img
    return canvas


def calibrate_reference(
    image_path: Path,
    out_dir: Path,
    *,
    stem: str,
    strength: float,
) -> dict[str, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    board = np.array(Image.open(image_path).convert("RGB"))
    before, before_region = sim.extract_source_region(board, "left-panel")
    after, after_region = sim.extract_source_region(board, "right-panel")
    aligned_after, align_meta = _align_after_to_before(before, after)

    paths, detect_meta = crease.detect_wrinkle_creases_periocular_cv(
        before,
        None,
        before.shape[1],
        before.shape[0],
    )
    zone_expand = max(14, int(min(before.shape[:2]) * 0.028))
    mask = sim._build_treatment_mask(
        before,
        paths,
        crease,
        cutout,
        zone_expand=zone_expand,
        eye_protect_strength=0.62,
    )
    lateral_fold_mask = sim._lateral_canthus_fold_mask(before, crease, mask)
    simulated = sim.simulate_wrinkle_treatment(
        before,
        mask,
        mode="tox",
        strength=strength,
        preset="calibrated",
        lateral_fold_mask=lateral_fold_mask,
    )

    metric_mask = _build_metrics_mask(before, mask, crease)
    before_metrics = _metric_response(before, metric_mask, crease)
    target_metrics = _metric_response(aligned_after, metric_mask, crease)
    sim_metrics = _metric_response(simulated, metric_mask, crease)
    target_reduction = _reduction(before_metrics, target_metrics)
    sim_reduction = _reduction(before_metrics, sim_metrics)
    zone_metrics: dict[str, object] = {}
    for zone_name, zone_mask in _zone_metric_masks(
        before,
        metric_mask,
        crease,
        lateral_fold_mask=lateral_fold_mask,
    ).items():
        z_before = _metric_response(before, zone_mask, crease)
        z_target = _metric_response(aligned_after, zone_mask, crease)
        z_sim = _metric_response(simulated, zone_mask, crease)
        zone_metrics[zone_name] = {
            "before": z_before,
            "groundTruthAfter": z_target,
            "simulation": z_sim,
            "groundTruthReduction": _reduction(z_before, z_target),
            "simulationReduction": _reduction(z_before, z_sim),
        }

    before_path = out_dir / f"{stem}-before.jpg"
    target_path = out_dir / f"{stem}-aligned-ground-truth.jpg"
    sim_path = out_dir / f"{stem}-simulated-calibrated.jpg"
    panel_path = out_dir / f"{stem}-before-sim-target.jpg"
    mask_path = out_dir / f"{stem}-metric-mask.jpg"
    fold_mask_path = out_dir / f"{stem}-lateral-fold-mask.jpg"
    meta_path = out_dir / f"{stem}-calibration.json"

    Image.fromarray(before).save(before_path, quality=92)
    Image.fromarray(aligned_after).save(target_path, quality=92)
    Image.fromarray(simulated).save(sim_path, quality=92)
    Image.fromarray(_make_score_panel(before, simulated, aligned_after)).save(panel_path, quality=92)
    Image.fromarray(sim._overlay_mask_preview(before, mask)).save(mask_path, quality=90)
    Image.fromarray(sim._overlay_mask_preview(before, lateral_fold_mask)).save(
        fold_mask_path,
        quality=90,
    )

    meta = {
        "source": str(image_path),
        "strength": strength,
        "beforeRegion": before_region,
        "afterRegion": after_region,
        "alignment": align_meta,
        "detection": detect_meta,
        "pathCount": len(paths),
        "lateralFoldMask": str(fold_mask_path),
        "metrics": {
            "before": before_metrics,
            "groundTruthAfter": target_metrics,
            "simulation": sim_metrics,
            "groundTruthReduction": target_reduction,
            "simulationReduction": sim_reduction,
            "remainingGap": {
                key: target_reduction[key] - sim_reduction[key]
                for key in target_reduction
            },
            "zones": zone_metrics,
        },
    }
    meta_path.write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print(
        f"{stem}: target crease reduction {target_reduction['creaseP90']:.2f}, "
        f"simulation {sim_reduction['creaseP90']:.2f} -> {panel_path.name}",
        flush=True,
    )
    return {
        "before": before_path,
        "target": target_path,
        "simulated": sim_path,
        "panel": panel_path,
        "mask": mask_path,
        "lateralFoldMask": fold_mask_path,
        "meta": meta_path,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Calibrate Botox simulation from a paired board.")
    parser.add_argument("image", type=Path)
    parser.add_argument(
        "-o",
        "--out-dir",
        type=Path,
        default=ROOT / "public" / "demo-3d" / "wrinkle-treatment-simulation",
    )
    parser.add_argument("--stem", default="botox-paired-calibrated")
    parser.add_argument("--strength", type=float, default=1.0)
    args = parser.parse_args()
    calibrate_reference(args.image.resolve(), args.out_dir.resolve(), stem=args.stem, strength=args.strength)


sim = _load_sim()
crease = _load_crease()
cutout = sim._load("cutout", "wrinkle_cutout_render.py")


if __name__ == "__main__":
    main()
