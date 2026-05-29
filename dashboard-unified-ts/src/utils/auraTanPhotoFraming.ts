import type { AuraTanViewAngle } from "./auraTanAnglePhotos";

/**
 * Subject alignment on a 1024×1024 reference canvas (from `align-tan-png-plates.py`).
 * Used as CSS transforms on full-res PNGs — no re-encoded assets.
 */
const PLATE_ALIGN: Record<AuraTanViewAngle, { scale: number; ox: number; oy: number }> = {
  front: { scale: 0.177, ox: 301, oy: 275 },
  "profile-left": { scale: 0.148, ox: 245, oy: 345 },
  "three-quarter-left": { scale: 0.142, ox: 260, oy: 372 },
  "three-quarter-right": { scale: 0.139, ox: 340, oy: 318 },
  "profile-right": { scale: 0.147, ox: 380, oy: 328 },
};

/** Fixed front baseline — per-angle oy/ox edits move that angle without shifting others. */
const REF = { scale: 0.177, ox: 301, oy: 166 };

/** Scales 1024-space offsets to the dashboard face column (~400–520px wide). */
const PLATE_PAN_SCALE_X = 0.36;
const PLATE_PAN_SCALE_Y = 0.34;

export function tanPhotoPlateAlignStyle(angle: AuraTanViewAngle): {
  transform: string;
  transformOrigin: string;
} {
  const plate = PLATE_ALIGN[angle];
  const scaleMul = plate.scale / REF.scale;
  const panX = (plate.ox - REF.ox) * PLATE_PAN_SCALE_X;
  const panY = (plate.oy - REF.oy) * PLATE_PAN_SCALE_Y;
  return {
    transform: `translate(${panX}px, ${panY}px) scale(${scaleMul})`,
    transformOrigin: "center center",
  };
}
