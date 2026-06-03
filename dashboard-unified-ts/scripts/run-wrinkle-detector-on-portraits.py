#!/usr/bin/env python3
"""Run crease wrinkle detector on arbitrary front-facing portraits."""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SCRIPT_DIR = Path(__file__).resolve().parent
OUT_DIR = ROOT / "public" / "demo-3d" / "wrinkle-evaluation"


def _load(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPT_DIR / filename)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_mp = _load("mp", "mediapipe_wrinkle_paths.py")
_cutout = _load("cutout", "wrinkle_cutout_render.py")
_patient = _load("patient", "generate_patient_aura_assets.py")
_cv = _load("cv", "generate-aura-cv-assets.py")
_export = _load("export", "export-wrinkle-evaluation-composites.py")

mediapipe_wrinkle_paths = _mp.mediapipe_wrinkle_paths
render_wrinkle_cutout_rgba = _cutout.render_wrinkle_cutout_rgba
redness_face_bbox = _patient.redness_face_bbox
estimate_bbox = _patient.estimate_bbox
segment_person = _cv.segment_person
save_triptych = _export.save_triptych
composite_rgba_on_rgb = _export.composite_rgba_on_rgb


def person_alpha(rgb: np.ndarray) -> np.ndarray:
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    return segment_person(bgr, estimate_bbox(rgb))


def process_portrait(image_path: Path, slug: str, angle: str = "front") -> None:
    rgb = np.array(Image.open(image_path).convert("RGB"))
    alpha = person_alpha(rgb)
    ih, iw = rgb.shape[:2]
    x0, y0, x1, y1 = redness_face_bbox(rgb, alpha, angle)
    bbox = (x0, y0, max(1, x1 - x0), max(1, y1 - y0))

    paths, path_source = mediapipe_wrinkle_paths(
        rgb, angle, iw, ih, fallback_bbox=bbox, alpha=alpha
    )
    cutout = render_wrinkle_cutout_rgba(ih, iw, paths, alpha)
    baked = composite_rgba_on_rgb(rgb, cutout)

    out_subjects = OUT_DIR / "subjects"
    out_subjects.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgb, "RGB").save(out_subjects / f"{slug}-color.jpg", quality=92)
    Image.fromarray(cutout, "RGBA").save(out_subjects / f"{slug}-wrinkles.webp", quality=92)
    (out_subjects / f"{slug}-wrinkle-meta.json").write_text(
        json.dumps(
            {
                "source": str(image_path),
                "pathSource": path_source,
                "pathCount": len(paths),
                "angle": angle,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    save_triptych(
        OUT_DIR / f"{slug}_front.png",
        slug.replace("-", " ").title(),
        rgb,
        cutout,
        baked,
        f"{path_source} ({len(paths)} paths)",
    )
    print(f"{slug}: {len(paths)} paths — {path_source}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("images", nargs="*", type=Path)
    parser.add_argument(
        "--default-dir",
        type=Path,
        default=ROOT / "public" / "demo-3d" / "wrinkle-evaluation" / "incoming",
    )
    args = parser.parse_args()

    jobs: list[tuple[Path, str]] = []
    for p in args.images:
        slug = p.stem.lower().replace(" ", "-").replace("_", "-")
        slug = slug.removeprefix("front---").replace("front-", "")
        for suffix in ("-front", "-color"):
            if slug.endswith(suffix):
                slug = slug[: -len(suffix)]
        jobs.append((p.resolve(), slug))

    if not jobs:
        for p in sorted(args.default_dir.glob("*.png")) + sorted(args.default_dir.glob("*.jpg")):
            slug = p.stem.lower().replace("_", "-")
            if "lori" in slug or "lynette" in slug or "feinberg" in slug or "edelson" in slug:
                jobs.append((p.resolve(), slug[:48]))

    if not jobs:
        print("No images provided.", flush=True)
        return

    print("Crease detector: scripts/wrinkle_crease_detect.py\n", flush=True)
    for path, slug in jobs:
        if not path.exists():
            print(f"Skip missing {path}", flush=True)
            continue
        print(f"Processing {path.name}…", flush=True)
        process_portrait(path, slug)


if __name__ == "__main__":
    main()
