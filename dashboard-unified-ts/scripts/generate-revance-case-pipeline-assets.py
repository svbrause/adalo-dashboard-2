#!/usr/bin/env python3
"""Generate Aura skin-lens focus plates for Revance case gallery.

Builds both BEFORE and AFTER processed crops using the same texture/redness/pores
pipelines as patient Aura assets so the UI can render Tanya vs case before vs
case after in matching annotation styles.
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
from typing import Literal

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SCRIPT_DIR = Path(__file__).resolve().parent
GALLERY = ROOT / "public" / "revance-case-gallery"
OUT_DIR = GALLERY / "processed"
FOCUS_W, FOCUS_H = 640, 520

Lens = Literal["texture", "redness", "pores"]
Stage = Literal["before", "after"]


def _load(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPT_DIR / filename)
    if spec is None or spec.loader is None:
        raise ImportError(filename)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_patient = _load("patient", "generate_patient_aura_assets.py")
_cv = _load("cv", "generate-aura-cv-assets.py")

clinical_still_rgb = _patient.clinical_still_rgb
bake_redness_image = _patient.bake_redness_image
bake_pore_image = _patient.bake_pore_image
render_redness_mask = _patient.render_redness_mask
render_pore_mask = _patient.render_pore_mask
detect_redness_spots = _patient.detect_redness_spots
redness_face_bbox = _patient.redness_face_bbox
segment_person = _cv.segment_person


def load_case_rgb(src: Path, *, stage: Stage, comparison: bool) -> np.ndarray:
    rgb = np.array(Image.open(src).convert("RGB"))
    if comparison:
        w = rgb.shape[1] // 2
        if stage == "before":
            rgb = rgb[:, :w].copy()
        else:
            rgb = rgb[:, w:].copy()
    return rgb


def person_alpha(rgb: np.ndarray) -> np.ndarray:
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    bbox = _patient.estimate_bbox(rgb)
    return segment_person(bgr, bbox)


def crop_focus(rgb: np.ndarray, alpha: np.ndarray, angle: str = "front") -> np.ndarray:
    ih, iw = rgb.shape[:2]
    x0, y0, x1, y1 = redness_face_bbox(rgb, alpha, angle)
    cx = (x0 + x1) // 2
    cy = (y0 + y1) // 2
    face_w = max(1, x1 - x0)
    face_h = max(1, y1 - y0)
    crop_w = int(max(face_w * 1.35, iw * 0.55))
    crop_h = int(crop_w * FOCUS_H / FOCUS_W)
    crop_h = max(crop_h, int(face_h * 1.25))

    x0c = max(0, min(cx - crop_w // 2, iw - crop_w))
    y0c = max(0, min(cy - int(crop_h * 0.42), ih - crop_h))
    x1c = min(iw, x0c + crop_w)
    y1c = min(ih, y0c + crop_h)
    cropped = rgb[y0c:y1c, x0c:x1c]
    return cv2.resize(cropped, (FOCUS_W, FOCUS_H), interpolation=cv2.INTER_AREA)


def apply_lens(rgb: np.ndarray, alpha: np.ndarray, lens: Lens, angle: str = "front") -> np.ndarray:
    if lens == "texture":
        return clinical_still_rgb(rgb, "gray", angle=angle, turntable_fast=True)
    if lens == "redness":
        spots = detect_redness_spots(rgb, alpha, angle=angle)
        mask = render_redness_mask(rgb, alpha=None, angle=angle, spots=spots)
        return bake_redness_image(rgb, mask)
    if lens == "pores":
        mask = render_pore_mask(rgb, alpha=None, angle=angle)
        return bake_pore_image(rgb, mask)
    raise ValueError(lens)


def process_case_stage(
    *,
    case_id: str,
    src: Path,
    lens: Lens,
    stage: Stage,
    comparison: bool,
    angle: str = "front",
) -> dict[str, str]:
    if not src.exists():
        raise FileNotFoundError(src)

    rgb_full = load_case_rgb(src, stage=stage, comparison=comparison)
    alpha_full = person_alpha(rgb_full)
    processed = apply_lens(rgb_full, alpha_full, lens, angle)
    alpha_crop_src = person_alpha(processed)
    focus = crop_focus(processed, alpha_crop_src, angle)
    out_path = OUT_DIR / f"{case_id}-{stage}-pipeline.png"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(focus, "RGB").save(out_path, format="PNG", optimize=True)
    rel = f"/revance-case-gallery/processed/{case_id}-{stage}-pipeline.png"
    print(f"  {case_id} [{stage}]: {lens} -> {out_path.relative_to(ROOT)}", flush=True)
    return {"pipelineUrl": rel, "source": str(src.relative_to(ROOT))}


CASES: list[dict] = [
    {"caseId": "daxi-glabella", "beforeSrc": GALLERY / "cases/daxi-glabella.jpg", "afterSrc": GALLERY / "cases/daxi-glabella.jpg", "lens": "texture", "comparison": True},
    {"caseId": "daxi-forehead", "beforeSrc": GALLERY / "cases/daxi-forehead.jpg", "afterSrc": GALLERY / "cases/daxi-forehead.jpg", "lens": "texture", "comparison": True},
    {"caseId": "daxi-crows", "beforeSrc": GALLERY / "cases/daxi-crows.jpg", "afterSrc": GALLERY / "cases/daxi-crows.jpg", "lens": "texture", "comparison": True},
    {"caseId": "daxi-frown", "beforeSrc": GALLERY / "cases/daxi-frown.jpg", "afterSrc": GALLERY / "cases/daxi-frown.jpg", "lens": "texture", "comparison": True},
    {"caseId": "skinpen-texture", "beforeSrc": GALLERY / "cases/skinpen-texture-before.jpg", "afterSrc": GALLERY / "cases/skinpen-texture-after.jpg", "lens": "texture", "comparison": False},
    {"caseId": "skinpen-acne", "beforeSrc": GALLERY / "cases/skinpen-acne-before.jpg", "afterSrc": GALLERY / "cases/skinpen-acne-after.jpg", "lens": "texture", "comparison": False},
    {"caseId": "skinpen-quality", "beforeSrc": GALLERY / "cases/skinpen-quality-before.jpg", "afterSrc": GALLERY / "cases/skinpen-quality-after.jpg", "lens": "texture", "comparison": False},
    {"caseId": "hyperpigmentation", "beforeSrc": GALLERY / "cases/hyperpigmentation-before.jpg", "afterSrc": GALLERY / "cases/hyperpigmentation-after.jpg", "lens": "texture", "comparison": False},
    {"caseId": "rha3-nlf", "beforeSrc": GALLERY / "cases/rha3-nlf.png", "afterSrc": GALLERY / "cases/rha3-nlf.png", "lens": "redness", "comparison": True},
    {"caseId": "rha2-undereye", "beforeSrc": GALLERY / "cases/rha2-undereye-before.jpg", "afterSrc": GALLERY / "cases/rha2-undereye-after.jpg", "lens": "pores", "comparison": False},
]


def main() -> None:
    manifest: dict[str, dict[str, str]] = {}
    print("Generating Revance case skin-lens assets…", flush=True)
    for row in CASES:
        before = process_case_stage(
            case_id=row["caseId"],
            src=row["beforeSrc"],
            lens=row["lens"],
            stage="before",
            comparison=row["comparison"],
        )
        after = process_case_stage(
            case_id=row["caseId"],
            src=row["afterSrc"],
            lens=row["lens"],
            stage="after",
            comparison=row["comparison"],
        )
        manifest[row["caseId"]] = {
            "caseId": row["caseId"],
            "lens": row["lens"],
            "beforePipelineUrl": before["pipelineUrl"],
            "afterPipelineUrl": after["pipelineUrl"],
            "beforeSource": before["source"],
            "afterSource": after["source"],
        }

    manifest_path = OUT_DIR / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {manifest_path.relative_to(ROOT)} ({len(manifest)} cases)", flush=True)


if __name__ == "__main__":
    main()
