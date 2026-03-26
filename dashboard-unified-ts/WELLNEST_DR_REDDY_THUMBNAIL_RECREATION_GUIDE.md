# Dr. Reddy video thumbnails — recreation guide (absolute paths)

Use this in **another Cursor window** or machine to reproduce the 16 Wellnest thumbnails. All paths below are **absolute** for the canonical repo on this Mac; if your clone lives elsewhere, replace only the prefix.

## Repository root

```
/Users/sambrause/Documents/GitHub/ponce-cases-staging/skin-type-react/skin-type-react
```

---

## Where outputs go (PNG files)

Export **16 PNGs**, **1280×720**, named exactly:

| Output file | Absolute path |
|-------------|----------------|
| All 16 thumbnails | Directory: `/Users/sambrause/Documents/GitHub/ponce-cases-staging/skin-type-react/skin-type-react/public/wellnest/thumbnails/` |
| `video-reddy-1.png` | `/Users/sambrause/Documents/GitHub/ponce-cases-staging/skin-type-react/skin-type-react/public/wellnest/thumbnails/video-reddy-1.png` |
| `video-reddy-2.png` | `/Users/sambrause/Documents/GitHub/ponce-cases-staging/skin-type-react/skin-type-react/public/wellnest/thumbnails/video-reddy-2.png` |
| … | … (same folder, `video-reddy-3.png` through `video-reddy-16.png`) |
| `video-reddy-16.png` | `/Users/sambrause/Documents/GitHub/ponce-cases-staging/skin-type-react/skin-type-react/public/wellnest/thumbnails/video-reddy-16.png` |

These paths match **`WELLNEST_CASE_IMAGES`** in:

`/Users/sambrause/Documents/GitHub/ponce-cases-staging/skin-type-react/skin-type-react/src/data/wellnessQuiz.ts`

**Note:** In the current React app, Dr. Reddy cases often use **live** thumbnails from code (see below), not these PNGs, on screen. The PNGs are still the right asset for **Vimeo**, **social**, **other apps**, or if you point the product at static images.

---

## Source assets (Dr. Reddy photo + vials)

| Asset | Absolute path |
|-------|----------------|
| Dr. Reddy image used in-app for live thumbs | `/Users/sambrause/Documents/GitHub/ponce-cases-staging/skin-type-react/skin-type-react/public/wellnest/Dr-Reddy-qr-code.png` |
| Vial overlay 1 | `/Users/sambrause/Documents/GitHub/ponce-cases-staging/skin-type-react/skin-type-react/public/wellnest/thumbnails/vials/vial-1.png` |
| Vial overlay 2 | `/Users/sambrause/Documents/GitHub/ponce-cases-staging/skin-type-react/skin-type-react/public/wellnest/thumbnails/vials/vial-2.png` |
| Vial overlay 3 | `/Users/sambrause/Documents/GitHub/ponce-cases-staging/skin-type-react/skin-type-react/public/wellnest/thumbnails/vials/vial-3.png` |

Slides **9** and **16** in the programmatic spec use vials (`useVial: 1` and `useVial: 2` in code).

---

## Canonical spec (match the in-app live layout)

The **source of truth** for layout, copy, accent colors, and face framing is:

`/Users/sambrause/Documents/GitHub/ponce-cases-staging/skin-type-react/skin-type-react/src/data/wellnestThumbnails.ts`

Constants: **`WELLNEST_THUMBNAIL_SLIDES`** (16 entries, index `video-reddy-{N}` → entry `N-1`).

Palette used in code:

| Token | Hex |
|-------|-----|
| Charcoal | `#232323` |
| Mint | `#63D4AC` |
| Teal | `#4ab896` |
| Coral | `#e07c4a` |
| Light blue | `#a8c4cc` |

### Slide-by-slide spec (recreate in Figma / Canva / export tools)

| # | `imageKey` | Layout | `themeColor` | text1 | text2 | text3 | highlightLine | faceScale | faceX | faceY | useVial |
|---|------------|--------|--------------|-------|-------|-------|-----------------|-----------|-------|-------|---------|
| 1 | video-reddy-1 | split-right | #63D4AC | PEPTIDES | EXPLAINED | — | 1 | 1.5 | 88% | 15% | — |
| 2 | video-reddy-2 | corner-box | #4ab896 | THE REGEN | REVOLUTION | Why peptides matter | — | 1.3 | 18% | 15% | — |
| 3 | video-reddy-3 | bottom-text | #e07c4a | WHY NOW? | THE PEPTIDE TREND | — | 1 | 1.3 | 28% | 15% | — |
| 4 | video-reddy-4 | split-left | #63D4AC | FDA | APPROVED? | The Facts | 1 | 1.4 | 12% | 15% | — |
| 5 | video-reddy-5 | split-right | #4ab896 | 3 MYTHS | BUSTED | — | 2 | 1.5 | 88% | 15% | — |
| 6 | video-reddy-6 | corner-box | #63D4AC | THE FUTURE | OF RESEARCH | — | — | 1.2 | 18% | 15% | — |
| 7 | video-reddy-7 | bottom-text | #a8c4cc | IS IT RIGHT | FOR YOU? | — | 2 | 1.3 | 72% | 15% | — |
| 8 | video-reddy-8 | split-left | #4ab896 | METABOLISM | BOOST | Growth Hormone explained | 1 | 1.4 | 12% | 15% | — |
| 9 | video-reddy-9 | split-right | #e07c4a | SKINCARE | PEPTIDES | Which one? | 1 | 1.3 | 82% | 40% | 1 |
| 10 | video-reddy-10 | corner-box | #63D4AC | RECOVERY | STACK | Heal faster | — | 1.3 | 18% | 15% | — |
| 11 | video-reddy-11 | bottom-text | #4ab896 | SKIN | REGENERATION? | — | 1 | 1.3 | 28% | 15% | — |
| 12 | video-reddy-12 | split-left | #e07c4a | BODY | COMPOSITION | — | 2 | 1.4 | 12% | 15% | — |
| 13 | video-reddy-13 | corner-box | #a8c4cc | DR. REDDY'S | GUIDE | Rapid-fire facts | — | 1.2 | 18% | 15% | — |
| 14 | video-reddy-14 | split-right | #63D4AC | FOCUS | & CALM | Neuropeptides | 1 | 1.5 | 88% | 15% | — |
| 15 | video-reddy-15 | bottom-text | #4ab896 | STUBBORN | FAT? | — | 2 | 1.3 | 72% | 15% | — |
| 16 | video-reddy-16 | split-left | #232323 | CELLULAR | AGING | The Epitalon Story | 1 | 1.1 | 12% | 50% | 2 |

**Layout meanings** (mirror `WellnestThumbnail.tsx`):

- **split-left** — text panel on the right, face on the left; gradient darkening toward text side.
- **split-right** — text on the left, face on the right.
- **bottom-text** — full-bleed face, strong bottom gradient, centered text block low.
- **corner-box** — full-bleed face, floating colored box bottom-right with stacked lines.

Keep the **center** of the frame relatively clear for a **play button** overlay (YouTube-style).

**React implementation reference** (how the live thumb is drawn):

`/Users/sambrause/Documents/GitHub/ponce-cases-staging/skin-type-react/skin-type-react/src/components/WellnestThumbnail.tsx`

---

## Alternative copy (CSV / Canva brief)

For slightly different headline wording used in design briefs (A/B/C style tags):

`/Users/sambrause/Documents/GitHub/ponce-cases-staging/skin-type-react/skin-type-react/public/wellnest/thumbnails/thumbnail-copy.csv`

Long-form Canva / manual instructions:

- `/Users/sambrause/Documents/GitHub/ponce-cases-staging/skin-type-react/skin-type-react/public/wellnest/thumbnails/CANVA-AI-PROMPTS.md`
- `/Users/sambrause/Documents/GitHub/ponce-cases-staging/skin-type-react/skin-type-react/public/wellnest/thumbnails/CANVA-BRIEF.md`

Original short README for this folder:

`/Users/sambrause/Documents/GitHub/ponce-cases-staging/skin-type-react/skin-type-react/public/wellnest/thumbnails/README.md`

---

## Method A — Export from this repo’s HTML tools (fastest parity)

1. From the repo root, run the Vite dev server (`npm run dev` in  
   `/Users/sambrause/Documents/GitHub/ponce-cases-staging/skin-type-react/skin-type-react`).

2. **Thumbnail editor** (editable text, export PNG per slide):  
   Open in browser: `http://localhost:5173/wellnest/thumbnail-editor.html`  
   File on disk:  
   `/Users/sambrause/Documents/GitHub/ponce-cases-staging/skin-type-react/skin-type-react/public/wellnest/thumbnail-editor.html`

3. **Thumbnail generator** (batch download):  
   `http://localhost:5173/wellnest/thumbnail-generator.html`  
   File on disk:  
   `/Users/sambrause/Documents/GitHub/ponce-cases-staging/skin-type-react/skin-type-react/public/wellnest/thumbnail-generator.html`

4. Save downloads into:  
   `/Users/sambrause/Documents/GitHub/ponce-cases-staging/skin-type-react/skin-type-react/public/wellnest/thumbnails/`  
   using exact names `video-reddy-1.png` … `video-reddy-16.png`.

---

## Method B — Canva (or Figma) manual / AI

1. Canvas size **1280 × 720** px.
2. Use copy from the table above **or** from  
   `/Users/sambrause/Documents/GitHub/ponce-cases-staging/skin-type-react/skin-type-react/public/wellnest/thumbnails/thumbnail-copy.csv`
3. Import Dr. Reddy reference:  
   `/Users/sambrause/Documents/GitHub/ponce-cases-staging/skin-type-react/skin-type-react/public/wellnest/Dr-Reddy-qr-code.png`  
   (or a higher-res portrait if you have one; keep lighting/brand consistent.)
4. For slides 9 and 16, optionally composite vials from the paths in **Source assets** above.
5. Export PNG → drop into  
   `/Users/sambrause/Documents/GitHub/ponce-cases-staging/skin-type-react/skin-type-react/public/wellnest/thumbnails/`

Follow prompts in:

`/Users/sambrause/Documents/GitHub/ponce-cases-staging/skin-type-react/skin-type-react/public/wellnest/thumbnails/CANVA-AI-PROMPTS.md`

---

## Method C — Rebuild in another codebase

1. Copy into the other project:
   - `/Users/sambrause/Documents/GitHub/ponce-cases-staging/skin-type-react/skin-type-react/src/data/wellnestThumbnails.ts`
   - `/Users/sambrause/Documents/GitHub/ponce-cases-staging/skin-type-react/skin-type-react/public/wellnest/Dr-Reddy-qr-code.png`
   - `/Users/sambrause/Documents/GitHub/ponce-cases-staging/skin-type-react/skin-type-react/public/wellnest/thumbnails/vials/` (whole folder)
2. Reimplement layout rules from  
   `/Users/sambrause/Documents/GitHub/ponce-cases-staging/skin-type-react/skin-type-react/src/components/WellnestThumbnail.tsx`  
   or render PNGs in Node/canvas using the same numbers as **`WELLNEST_THUMBNAIL_SLIDES`**.

---

## Vimeo URLs (optional cross-check)

Video URLs per key live next to image keys in:

`/Users/sambrause/Documents/GitHub/ponce-cases-staging/skin-type-react/skin-type-react/src/data/wellnessQuiz.ts`  
→ object **`WELLNEST_CASE_VIDEOS`** (search for `video-reddy-1`).

---

## One-line copy for all outputs

```bash
# After generating PNGs elsewhere, install into this repo:
DEST="/Users/sambrause/Documents/GitHub/ponce-cases-staging/skin-type-react/skin-type-react/public/wellnest/thumbnails"
# cp /path/to/your/video-reddy-*.png "$DEST/"
```

---

## This guide on disk

`/Users/sambrause/Documents/GitHub/ponce-cases-staging/skin-type-react/skin-type-react/docs/WELLNESS_WELLNEST_REFERENCE.md` — broader wellness asset index (also uses absolute paths).  
`/Users/sambrause/Documents/GitHub/ponce-cases-staging/skin-type-react/skin-type-react/docs/WELLNESS_WELLNEST_ABSOLUTE_PATHS.md` — full file manifest.

---

*Spec table derived from `WELLNEST_THUMBNAIL_SLIDES` in `wellnestThumbnails.ts`. Update this doc if that array changes.*
