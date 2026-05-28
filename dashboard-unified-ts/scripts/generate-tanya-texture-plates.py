#!/usr/bin/env python3
"""Generate Aura-style clinical texture plates for Tanya Tan angle stills.

Outputs public/demo-3d/tanya-tan-*-texture.png (grayscale base + purple pigment flecks).
"""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

import importlib.util

_spec = importlib.util.spec_from_file_location(
    "generate_tanya_pigmentation_map",
    ROOT / "scripts" / "generate-tanya-pigmentation-map.py",
)
_pig = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(_pig)
build_overlay = _pig.build_overlay
clinical_base = _pig.clinical_base
pigment_signal = _pig.pigment_signal
skin_mask = _pig.skin_mask

import numpy as np
from PIL import Image

ANGLE_SOURCES: dict[str, Path] = {
    "profile-left": ROOT / "public/demo-3d/tanya-tan-profile-left.png",
    "three-quarter-left": ROOT / "public/demo-3d/tanya-tan-45-right.png",
    "front": ROOT / "public/demo-3d/tanya-tan-front.png",
    "three-quarter-right": ROOT / "public/demo-3d/tanya-tan-45-left.png",
    "profile-right": ROOT / "public/demo-3d/tanya-tan-profile-right.png",
}


def generate_texture_plate(src: Path, out: Path) -> None:
    if not src.exists():
        raise FileNotFoundError(src)
    image = Image.open(src).convert("RGB")
    rgb = np.array(image)
    mask = skin_mask(rgb)
    diffuse, flecks = pigment_signal(rgb, mask)
    base = clinical_base(image, "gray")
    overlay = build_overlay(diffuse, flecks, "gray")
    composed = Image.alpha_composite(base, overlay)
    out.parent.mkdir(parents=True, exist_ok=True)
    composed.convert("RGB").save(out, format="PNG", optimize=True)


def main() -> None:
    for angle_id, src in ANGLE_SOURCES.items():
        out = ROOT / "public/demo-3d" / f"{src.stem}-texture.png"
        generate_texture_plate(src, out)
        print(f"{angle_id}: {out.relative_to(ROOT)}", flush=True)


if __name__ == "__main__":
    main()
