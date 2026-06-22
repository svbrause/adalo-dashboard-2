# Botox-style wrinkle simulation engine

`scripts/simulate-wrinkle-treatment.py` creates cosmetic before/after previews from a
single before image. It is a visualization tool, not a clinical outcome predictor.

## What it does

- Detects wrinkle-like dark crease texture with OpenCV.
- Builds soft treatment masks for forehead, crow's-feet, and under-eye areas.
- Protects eyes, lashes, brows, and makeup from the smoothing pass.
- Applies frequency separation, crease-shadow lift, light inpainting, and skin-tone
  polish.
- Can extract the left "before" crop from a side-by-side before/after board.

## Example

```bash
python3 scripts/simulate-wrinkle-treatment.py \
  /path/to/before-or-before-after-board.jpg \
  --source-region auto-left-panel \
  --mode tox \
  --preset reference \
  --strength 0.9 \
  --stem botox-reference-left-polished \
  -o public/demo-3d/wrinkle-treatment-simulation
```

Outputs:

- `{stem}-before.jpg`
- `{stem}-treated-{mode}.jpg`
- `{stem}-before-after-{mode}.jpg`
- `{stem}-treatment-mask.jpg`
- `{stem}-meta.json`

## Paired reference calibration

For a before/after board, run:

```bash
python3 scripts/calibrate-botox-simulation.py \
  /path/to/before-after-board.jpg \
  --stem botox-reference-paired \
  --strength 1.0 \
  -o public/demo-3d/wrinkle-treatment-simulation
```

This exports a three-column comparison:

- Before crop
- Calibrated simulation
- Aligned ground-truth after crop

It also writes `{stem}-calibration.json` with crease and texture reduction metrics
for forehead, crow's-feet, under-eye, and the full treatment mask.

## Presets

- `--preset natural`: conservative softening that keeps more texture.
- `--preset reference`: stronger, more polished output closer to marketing Botox
  examples.
- `--preset calibrated`: strongest preset, tuned for paired-reference evaluation.

## Modes

- `tox`: softens dynamic crease shadows and high-frequency wrinkle texture.
- `laser`: emphasizes texture polish.
- `combined`: applies both wrinkle and texture smoothing.
