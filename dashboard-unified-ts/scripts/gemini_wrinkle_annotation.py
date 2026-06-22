#!/usr/bin/env python3
"""Generate semantic wrinkle path annotations with Gemini on Vertex AI.

The model is used for anatomical path placement. Rendering stays local so the
dashboard can consume a normal transparent overlay and composited preview.
"""

from __future__ import annotations

import argparse
import json
import math
import re
from pathlib import Path
from io import BytesIO
from typing import Literal

import cv2
import numpy as np
from google import genai
from google.genai import types
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont
from pydantic import BaseModel, Field


Category = Literal[
    "forehead_lines",
    "glabellar_creases",
    "periorbital_fine_lines",
    "nasolabial_folds",
    "perioral_lines",
    "marionette_lines",
    "neck_lines",
]


class Point(BaseModel):
    x: int = Field(ge=0, le=1000)
    y: int = Field(ge=0, le=1000)


class WrinklePath(BaseModel):
    category: Category
    severity: int = Field(ge=1, le=5)
    confidence: float = Field(ge=0, le=1)
    points: list[Point] = Field(min_length=2)


class FacialWrinkleAnalysis(BaseModel):
    wrinkle_paths: list[WrinklePath]


ZoneKind = Literal[
    "wrinkle_candidate_skin",
    "hair",
    "eyebrow",
    "eye",
    "eyelash",
    "lip",
    "nostril",
    "clothing",
    "background",
    "jewelry",
]


class PolygonZone(BaseModel):
    kind: ZoneKind
    label: str
    confidence: float = Field(ge=0, le=1)
    points: list[Point] = Field(min_length=3)


class FacialSemanticZones(BaseModel):
    include_zones: list[PolygonZone]
    exclude_zones: list[PolygonZone]


PALETTE: dict[Category, tuple[int, int, int]] = {
    "forehead_lines": (0, 177, 184),
    "glabellar_creases": (0, 143, 168),
    "periorbital_fine_lines": (0, 188, 166),
    "nasolabial_folds": (22, 109, 184),
    "perioral_lines": (34, 130, 160),
    "marionette_lines": (37, 94, 150),
    "neck_lines": (68, 89, 112),
}


def slugify(path: Path) -> str:
    stem = path.stem.lower()
    return re.sub(r"[^a-z0-9]+", "-", stem).strip("-") or "image"


def fetch_wrinkle_paths(
    image_path: Path,
    *,
    project: str,
    location: str,
    model: str,
    guide_image_path: Path | None = None,
) -> FacialWrinkleAnalysis:
    client = genai.Client(vertexai=True, project=project, location=location)
    pil_image = Image.open(image_path).convert("RGB")
    guide_image = Image.open(guide_image_path).convert("RGB") if guide_image_path else None
    prompt = """
You are creating a precise dermatology-style wrinkle annotation overlay.

Return JSON only. Trace only true visible facial wrinkle valleys or fold
centerlines. Use normalized image-frame coordinates on a 0-1000 grid where
0,0 is the top-left of the full image and 1000,1000 is the bottom-right.

Rules:
- Draw short polylines that follow the exact visible wrinkle contour.
- Include forehead, glabellar, crow's feet/periorbital, nasolabial, perioral,
  marionette, and neck lines only when actually visible.
- Exclude eyes, pupils, iris edges, eyelashes, eyebrows, lips, nostril rims,
  hair, beard, ears, clothing, jewelry, background, and image borders.
- Do not draw broad regions, masks, blobs, shaded areas, or generic anatomy.
- Prefer fewer accurate paths over many speculative paths.
- Severity is 1 for faint/shallow, 5 for deep/severe.
- Confidence should reflect how clearly the line is visible.
"""
    if guide_image is not None:
        prompt += """

You are also given a second image: a computer-vision response map of candidate
crease/wrinkle locations for the same face. Use it only as a candidate guide.
The final paths must still align to actual wrinkle contours in the original
photo. This is a filtering and tracing task, not a template drawing task:
- Keep candidate lines that correspond to real visible wrinkles.
- Reject candidate response from eyebrows, eyelids, eye openings, nostrils,
  lips, hair, shadows, clothing, or background.
- Follow the local contour of each visible wrinkle; do not replace it with a
  smooth generic arc unless that is the actual contour.
- Include short crow's-feet and under-eye fine lines when clearly supported.
"""
    contents: list[object] = [pil_image]
    if guide_image is not None:
        contents.append(guide_image)
    contents.append(prompt)
    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=FacialWrinkleAnalysis,
            temperature=0.05,
            top_p=0.3,
        ),
    )
    parsed = getattr(response, "parsed", None)
    if parsed is not None:
        return parsed
    return FacialWrinkleAnalysis.model_validate_json(response.text or "{}")


def fetch_semantic_zones(
    image_path: Path,
    *,
    project: str,
    location: str,
    model: str,
) -> FacialSemanticZones:
    client = genai.Client(vertexai=True, project=project, location=location)
    pil_image = Image.open(image_path).convert("RGB")
    prompt = """
You are creating a semantic gating mask for a dermatology wrinkle detector.

Return JSON only. Use normalized image-frame coordinates on a 0-1000 grid where
0,0 is the top-left of the full image and 1000,1000 is the bottom-right.

Task:
- Return include_zones as simplified polygons covering only facial skin regions
  where wrinkle/crease texture should be allowed: forehead skin, glabella skin,
  lateral crow's-feet skin, under-eye skin, cheek fold skin, nasolabial fold
  skin, marionette/perioral skin outside the lips, chin, and neck skin.
- Return exclude_zones as polygons covering hair, eyebrows, eyes/iris/sclera,
  eyelashes, lips, nostrils, jewelry, clothing, and background.

Rules:
- Polygons may be broad regions. Do not trace individual wrinkles.
- Include zones should be permissive enough that a local CV response map can
  still find fine wrinkle pixels inside them.
- Exclude zones should be conservative and precise around eyes, eyebrows, lips,
  nostrils, hairline, and clothing.
- Do not include skin that is hidden by hair, fabric, jewelry, or background.
- Prefer 6-18 simple polygons total over tiny detailed fragments.
"""
    response = client.models.generate_content(
        model=model,
        contents=[pil_image, prompt],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=FacialSemanticZones,
            temperature=0.05,
            top_p=0.3,
        ),
    )
    parsed = getattr(response, "parsed", None)
    if parsed is not None:
        return parsed
    return FacialSemanticZones.model_validate_json(response.text or "{}")


def edit_wrinkle_visualization(
    image_path: Path,
    *,
    project: str,
    location: str,
    model: str,
    edit_preset: str = "clinical",
) -> tuple[Image.Image, str]:
    client = genai.Client(vertexai=True, project=project, location=location)
    pil_image = Image.open(image_path).convert("RGB")
    base_prompt = """
Edit the provided portrait.

Goal: create an educational dermatology visualization that highlights visible
facial wrinkles and fine lines.

Preserve the original person's identity, age, expression, pose, lighting,
background, skin tone, camera framing, and facial geometry. Do not beautify,
smooth, age, retouch, distort, sharpen, recolor, or otherwise change the face.

Add only a subtle semi-transparent cool teal/slate contour overlay on visible
wrinkles and fine facial lines. The overlay should look like a clinical
skin-analysis annotation layer, not makeup, bruising, scars, shadows, paint,
or new wrinkles. Do not place overlay on eyes, pupils, eyelashes, eyebrows,
lips, nostrils, hair, jewelry, clothing, or background.
"""
    sparse_rules = """

Critical style constraints:
- Do not draw facial topology, face mesh lines, cheek contour loops, eye rings,
  nose outlines, lip outlines, or anatomical guide curves.
- Add marks only where there is an existing visible wrinkle/fold valley.
- Use short broken contour strokes that hug the actual wrinkle texture.
- Leave smooth skin areas unmarked.
- The result should look like sparse wrinkle annotation, not a full-face diagram.
"""
    transparent_rules = """

Critical style constraints:
- Make the annotation layer extremely sparse and semi-transparent.
- Use cool graphite/teal strokes with low opacity.
- Do not create continuous outlines around facial features.
- Do not alter the underlying pixels except for adding the annotation strokes.
"""
    if edit_preset == "sparse":
        prompt = base_prompt + sparse_rules
    elif edit_preset == "transparent":
        prompt = base_prompt + sparse_rules + transparent_rules
    else:
        prompt = base_prompt
    response = client.models.generate_content(
        model=model,
        contents=[pil_image, prompt],
        config=types.GenerateContentConfig(
            response_modalities=[types.Modality.TEXT, types.Modality.IMAGE],
            temperature=0.15,
        ),
    )
    text_parts: list[str] = []
    image_parts: list[Image.Image] = []
    for candidate in response.candidates or []:
        content = candidate.content
        if not content:
            continue
        for part in content.parts or []:
            if getattr(part, "text", None):
                text_parts.append(part.text)
            inline_data = getattr(part, "inline_data", None)
            if inline_data and inline_data.data:
                image_parts.append(Image.open(BytesIO(inline_data.data)).convert("RGB"))
    if not image_parts:
        raise RuntimeError("Gemini image edit response did not include an image part.")
    return image_parts[0], "\n".join(text_parts).strip()


def smooth_points(points: list[tuple[int, int]]) -> list[tuple[int, int]]:
    if len(points) < 4:
        return points
    smoothed: list[tuple[int, int]] = []
    for i, pt in enumerate(points):
        if i == 0 or i == len(points) - 1:
            smoothed.append(pt)
            continue
        x = round((points[i - 1][0] + 2 * pt[0] + points[i + 1][0]) / 4)
        y = round((points[i - 1][1] + 2 * pt[1] + points[i + 1][1]) / 4)
        smoothed.append((x, y))
    return smoothed


def render_overlay(
    size: tuple[int, int],
    analysis: FacialWrinkleAnalysis,
    *,
    scale: int = 3,
) -> Image.Image:
    w, h = size
    overlay = Image.new("RGBA", (w * scale, h * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")

    for path in analysis.wrinkle_paths:
        pts = [
            (
                int(round((pt.x / 1000.0) * w * scale)),
                int(round((pt.y / 1000.0) * h * scale)),
            )
            for pt in path.points
        ]
        pts = smooth_points(pts)
        if len(pts) < 2:
            continue

        color = PALETTE.get(path.category, (0, 170, 180))
        severity = max(1, min(5, int(path.severity)))
        confidence = max(0.0, min(1.0, float(path.confidence)))
        width = max(2, int(round((1.0 + severity * 0.55) * scale)))
        alpha = int(round((95 + severity * 22) * confidence))
        alpha = max(70, min(210, alpha))

        shadow_width = width + max(2, scale)
        draw.line(pts, fill=(0, 35, 42, int(alpha * 0.24)), width=shadow_width, joint="curve")
        draw.line(pts, fill=(*color, alpha), width=width, joint="curve")

        if severity >= 4:
            hi = tuple(min(255, c + 46) for c in color)
            draw.line(pts, fill=(*hi, int(alpha * 0.42)), width=max(1, width // 3), joint="curve")

    return overlay.resize((w, h), Image.Resampling.LANCZOS)


def composite_with_overlay(source: Image.Image, overlay: Image.Image) -> Image.Image:
    return Image.alpha_composite(source.convert("RGBA"), overlay).convert("RGB")


def make_contact_sheet(source: Image.Image, overlay: Image.Image, composite: Image.Image, out: Path) -> None:
    panels = [("Source", source.convert("RGB")), ("Gemini overlay", composite), ("Transparent overlay", overlay)]
    thumb_w = 420
    thumb_h = int(source.height * thumb_w / source.width)
    gap = 12
    label_h = 38
    sheet = Image.new("RGB", ((thumb_w + gap) * len(panels) - gap, thumb_h + label_h), (238, 238, 238))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 24)
    except Exception:
        font = ImageFont.load_default()
    for i, (label, image) in enumerate(panels):
        x = i * (thumb_w + gap)
        draw.text((x + 6, 5), label, fill=(18, 22, 30), font=font)
        if image.mode == "RGBA":
            bg = Image.new("RGBA", image.size, (18, 22, 30, 255))
            preview = Image.alpha_composite(bg, image).convert("RGB")
        else:
            preview = image.convert("RGB")
        sheet.paste(preview.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS), (x, label_h))
    sheet.save(out, quality=94)


def make_image_edit_contact_sheet(source: Image.Image, edited: Image.Image, out: Path) -> None:
    panels = [("Source", source.convert("RGB")), ("Gemini image edit", edited.convert("RGB"))]
    thumb_w = 520
    thumb_h = int(source.height * thumb_w / source.width)
    gap = 12
    label_h = 40
    sheet = Image.new("RGB", ((thumb_w + gap) * len(panels) - gap, thumb_h + label_h), (238, 238, 238))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 24)
    except Exception:
        font = ImageFont.load_default()
    for i, (label, image) in enumerate(panels):
        x = i * (thumb_w + gap)
        draw.text((x + 6, 5), label, fill=(18, 22, 30), font=font)
        sheet.paste(image.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS), (x, label_h))
    sheet.save(out, quality=94)


def write_outputs(image_path: Path, analysis: FacialWrinkleAnalysis, out_dir: Path) -> dict[str, str]:
    out_dir.mkdir(parents=True, exist_ok=True)
    source = Image.open(image_path).convert("RGB")
    slug = slugify(image_path)
    overlay = render_overlay(source.size, analysis)
    composite = composite_with_overlay(source, overlay)

    source_out = out_dir / f"{slug}-source.png"
    overlay_out = out_dir / f"{slug}-gemini-wrinkle-overlay.png"
    composite_out = out_dir / f"{slug}-gemini-wrinkle-composite.png"
    contact_out = out_dir / f"{slug}-gemini-wrinkle-comparison.jpg"
    json_out = out_dir / f"{slug}-gemini-wrinkle-analysis.json"

    source.save(source_out)
    overlay.save(overlay_out)
    composite.save(composite_out)
    make_contact_sheet(source, overlay, composite, contact_out)
    json_out.write_text(analysis.model_dump_json(indent=2), encoding="utf-8")
    return {
        "source": str(source_out),
        "overlay": str(overlay_out),
        "composite": str(composite_out),
        "comparison": str(contact_out),
        "analysis": str(json_out),
    }


def write_image_edit_outputs(
    image_path: Path,
    edited: Image.Image,
    text: str,
    out_dir: Path,
    *,
    model: str,
    edit_preset: str,
) -> dict[str, str]:
    out_dir.mkdir(parents=True, exist_ok=True)
    source = Image.open(image_path).convert("RGB")
    slug = slugify(image_path)

    source_out = out_dir / f"{slug}-source.png"
    edited_out = out_dir / f"{slug}-gemini-image-edit-{edit_preset}.png"
    contact_out = out_dir / f"{slug}-gemini-image-edit-{edit_preset}-comparison.jpg"
    meta_out = out_dir / f"{slug}-gemini-image-edit-{edit_preset}-meta.json"

    source.save(source_out)
    edited.save(edited_out)
    make_image_edit_contact_sheet(source, edited, contact_out)
    meta_out.write_text(json.dumps({"model": model, "editPreset": edit_preset, "text": text}, indent=2), encoding="utf-8")
    return {
        "source": str(source_out),
        "edited": str(edited_out),
        "comparison": str(contact_out),
        "meta": str(meta_out),
    }


def zone_points(zone: PolygonZone, size: tuple[int, int]) -> list[tuple[int, int]]:
    w, h = size
    return [(int(round(pt.x / 1000.0 * w)), int(round(pt.y / 1000.0 * h))) for pt in zone.points]


def render_semantic_mask(size: tuple[int, int], zones: FacialSemanticZones) -> tuple[Image.Image, Image.Image]:
    include = Image.new("L", size, 0)
    exclude = Image.new("L", size, 0)
    include_draw = ImageDraw.Draw(include)
    exclude_draw = ImageDraw.Draw(exclude)

    for zone in zones.include_zones:
        pts = zone_points(zone, size)
        if len(pts) >= 3:
            include_draw.polygon(pts, fill=int(255 * max(0.2, zone.confidence)))
    for zone in zones.exclude_zones:
        pts = zone_points(zone, size)
        if len(pts) >= 3:
            exclude_draw.polygon(pts, fill=int(255 * max(0.35, zone.confidence)))

    include = include.filter(ImageFilter.GaussianBlur(2.0))
    exclude = exclude.filter(ImageFilter.GaussianBlur(1.0))
    mask = ImageChops.subtract(include, exclude)
    return mask, exclude


def response_overlay_from_mask(
    source: Image.Image,
    response_map_path: Path,
    semantic_mask: Image.Image,
) -> tuple[Image.Image, Image.Image]:
    source_rgba = source.convert("RGBA")
    response = Image.open(response_map_path).convert("L").resize(source.size, Image.Resampling.LANCZOS)
    r = np.asarray(response).astype(np.float32) / 255.0
    m = np.asarray(semantic_mask).astype(np.float32) / 255.0

    active = m > 0.04
    vals = r[active]
    if vals.size:
        lo, hi = np.percentile(vals, [48, 99.35])
    else:
        lo, hi = 0.2, 1.0
    severity = np.clip((r - lo) / max(hi - lo, 1e-6), 0, 1)
    alpha = (severity**0.85) * (m**0.75)
    alpha[alpha < 0.055] = 0
    alpha_img = Image.fromarray((alpha * 255).clip(0, 255).astype(np.uint8), "L").filter(ImageFilter.MedianFilter(3))
    alpha = np.asarray(alpha_img).astype(np.float32) / 255.0

    low = np.array([34, 52, 58], dtype=np.float32)
    high = np.array([80, 208, 206], dtype=np.float32)
    rgb = low * (1 - severity[..., None]) + high * severity[..., None]
    overlay = Image.fromarray(np.dstack([rgb, alpha * 255 * 0.72]).clip(0, 255).astype(np.uint8), "RGBA")

    shadow = Image.new("RGBA", source.size, (0, 35, 42, 0))
    shadow.putalpha(overlay.getchannel("A").filter(ImageFilter.GaussianBlur(0.45)).point(lambda p: int(p * 0.18)))
    composite = Image.alpha_composite(Image.alpha_composite(source_rgba, shadow), overlay).convert("RGB")
    return overlay, composite


def draw_zone_preview(source: Image.Image, mask: Image.Image, exclude: Image.Image) -> Image.Image:
    preview = source.convert("RGBA")
    include_overlay = Image.new("RGBA", source.size, (0, 184, 184, 0))
    include_overlay.putalpha(mask.point(lambda p: int(p * 0.30)))
    exclude_overlay = Image.new("RGBA", source.size, (45, 63, 78, 0))
    exclude_overlay.putalpha(exclude.point(lambda p: int(p * 0.24)))
    return Image.alpha_composite(Image.alpha_composite(preview, include_overlay), exclude_overlay).convert("RGB")


def make_semantic_contact_sheet(
    source: Image.Image,
    mask_preview: Image.Image,
    composite: Image.Image,
    overlay: Image.Image,
    out: Path,
) -> None:
    panels = [
        ("Source", source.convert("RGB")),
        ("Gemini semantic mask", mask_preview),
        ("CV response x mask", composite),
        ("Transparent overlay", overlay),
    ]
    thumb_w = 360
    thumb_h = int(source.height * thumb_w / source.width)
    gap = 10
    label_h = 36
    sheet = Image.new("RGB", ((thumb_w + gap) * len(panels) - gap, thumb_h + label_h), (238, 238, 238))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 22)
    except Exception:
        font = ImageFont.load_default()
    for i, (label, image) in enumerate(panels):
        x = i * (thumb_w + gap)
        draw.text((x + 5, 4), label, fill=(18, 22, 30), font=font)
        if image.mode == "RGBA":
            bg = Image.new("RGBA", image.size, (18, 22, 30, 255))
            image = Image.alpha_composite(bg, image).convert("RGB")
        sheet.paste(image.convert("RGB").resize((thumb_w, thumb_h), Image.Resampling.LANCZOS), (x, label_h))
    sheet.save(out, quality=94)


def write_semantic_zone_outputs(
    image_path: Path,
    zones: FacialSemanticZones,
    out_dir: Path,
    *,
    response_map_path: Path | None,
) -> dict[str, str]:
    out_dir.mkdir(parents=True, exist_ok=True)
    source = Image.open(image_path).convert("RGB")
    slug = slugify(image_path)
    mask, exclude = render_semantic_mask(source.size, zones)
    mask_preview = draw_zone_preview(source, mask, exclude)

    source_out = out_dir / f"{slug}-source.png"
    mask_out = out_dir / f"{slug}-gemini-semantic-include-mask.png"
    exclude_out = out_dir / f"{slug}-gemini-semantic-exclude-mask.png"
    preview_out = out_dir / f"{slug}-gemini-semantic-mask-preview.png"
    json_out = out_dir / f"{slug}-gemini-semantic-zones.json"

    source.save(source_out)
    mask.save(mask_out)
    exclude.save(exclude_out)
    mask_preview.save(preview_out)
    json_out.write_text(zones.model_dump_json(indent=2), encoding="utf-8")

    outputs = {
        "source": str(source_out),
        "includeMask": str(mask_out),
        "excludeMask": str(exclude_out),
        "maskPreview": str(preview_out),
        "zones": str(json_out),
    }
    if response_map_path is not None:
        overlay, composite = response_overlay_from_mask(source, response_map_path, mask)
        overlay_out = out_dir / f"{slug}-gemini-semantic-gated-response-overlay.png"
        composite_out = out_dir / f"{slug}-gemini-semantic-gated-response-composite.png"
        contact_out = out_dir / f"{slug}-gemini-semantic-gated-response-comparison.jpg"
        overlay.save(overlay_out)
        composite.save(composite_out)
        make_semantic_contact_sheet(source, mask_preview, composite, overlay, contact_out)
        outputs.update(
            {
                "overlay": str(overlay_out),
                "composite": str(composite_out),
                "comparison": str(contact_out),
            }
        )
    return outputs


def main() -> None:
    parser = argparse.ArgumentParser(description="Gemini/Vertex semantic wrinkle annotation prototype.")
    parser.add_argument("--image", required=True, type=Path)
    parser.add_argument("--out-dir", required=True, type=Path)
    parser.add_argument("--project", required=True)
    parser.add_argument("--location", default="us-central1")
    parser.add_argument("--model", default="gemini-2.5-pro")
    parser.add_argument("--guide-image", type=Path)
    parser.add_argument("--mode", choices=("paths", "semantic-zones", "image-edit"), default="paths")
    parser.add_argument("--response-map", type=Path)
    parser.add_argument("--edit-preset", choices=("clinical", "sparse", "transparent"), default="clinical")
    args = parser.parse_args()

    if args.mode == "semantic-zones":
        zones = fetch_semantic_zones(
            args.image,
            project=args.project,
            location=args.location,
            model=args.model,
        )
        outputs = write_semantic_zone_outputs(
            args.image,
            zones,
            args.out_dir,
            response_map_path=args.response_map,
        )
    elif args.mode == "image-edit":
        edited, text = edit_wrinkle_visualization(
            args.image,
            project=args.project,
            location=args.location,
            model=args.model,
            edit_preset=args.edit_preset,
        )
        outputs = write_image_edit_outputs(
            args.image,
            edited,
            text,
            args.out_dir,
            model=args.model,
            edit_preset=args.edit_preset,
        )
    else:
        analysis = fetch_wrinkle_paths(
            args.image,
            project=args.project,
            location=args.location,
            model=args.model,
            guide_image_path=args.guide_image,
        )
        outputs = write_outputs(args.image, analysis, args.out_dir)
    print(json.dumps(outputs, indent=2))


if __name__ == "__main__":
    main()
