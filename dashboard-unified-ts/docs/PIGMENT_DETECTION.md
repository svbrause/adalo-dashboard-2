# Pigment detection (melasma + lentigines) on studio portraits

## What we are trying to do

Overlay **clinical communication** markers on visible-light photos: diffuse melasma patches + discrete lentigines. This is **not** the same as Wood’s lamp, dermoscopy, or a diagnostic classifier.

## Why naive detectors fail

| Failure | Cause |
|--------|--------|
| Blue / wrong color | OpenCV BGR saved as RGB |
| Whole face tinted | Threshold on raw luminance (shadows = “pigment”) |
| Random blobs | No face ROI; hair, eyes, background included |
| Missed melasma | Lentigo-only blob finder; melasma is low-contrast and patchy |
| Misplaced on ¾ views | Front-view SVG coordinates pasted on rotated photos |

## Best-practice pipeline (recommended order)

1. **Normalize geometry** — Face detect (MediaPipe / Vision API) → cheek ROI for the angle (person’s left vs right).
2. **Normalize illumination** — Divide by large Gaussian blur of L, or CLAHE on L only inside skin mask. Shadows and specular highlights are the main false-positive source.
3. **Use melanin-sensitive features** — LAB `a*` or `b*`, or log `(R/G)` on skin pixels; not RGB luminance alone.
4. **Two heads** — **Melasma**: large, soft-connected regions (morph close + area filter). **Lentigines**: small high-response blobs after black-hat / DoG, with NMS.
5. **Reject shadows** — High gradient + low chroma difference vs local skin median → drop.
6. **Human QA** — CV proposes mask/ellipses; clinician nudges; store JSON (same schema as Aura overlays).
7. **ML when labels exist** — Face parsing (CelebAMask / BiSeNet) + pigment U-Net trained on your captures; Modal/GPU for batch offline, not per-click in dashboard.

## What each cloud tool is good for

| Tool | Good for | Not good for |
|------|----------|----------------|
| **Google Cloud Vision** (`gcloud ml vision detect-faces`) | Face bounding box, roll/pitch for ROI | Melasma segmentation |
| **Modal + GPU** | SAM / face-parsing / custom U-Net at scale | Real-time without deploy |
| **Gemini / multimodal** | Qualitative “where is pigment?” with prompt | Stable pixel masks without validation |

## Repo tooling

```bash
# Compare several local detectors on one image
python3 scripts/compare-pigment-detectors.py \
  --image public/demo-3d/tanya-tan-45-left.png \
  --cheek left

# Optional: GCloud face box (needs auth + Vision API)
python3 scripts/compare-pigment-detectors.py --image ... --cheek left --gcloud

# Optional: Modal SAM-style mask (deploy once)
modal run scripts/modal_pigment_sam.py --image-path public/demo-3d/tanya-tan-45-left.png
```

Outputs land in `public/demo-3d/pigment-benchmark/<stem>/` as `*_overlay.png` and `*_annotated.png` per method.
