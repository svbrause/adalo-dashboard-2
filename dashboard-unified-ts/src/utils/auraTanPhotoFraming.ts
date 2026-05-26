import type { AuraTanViewAngle } from "./auraTanAnglePhotos";

/**
 * Subject alignment on a 1024×1024 reference canvas (from `align-tan-png-plates.py`).
 * Used as CSS transforms on full-res PNGs — no re-encoded assets.
 */
const PLATE_ALIGN: Record<AuraTanViewAngle, { scale: number; ox: number; oy: number }> = {
  front: { scale: 0.177, ox: 301, oy: 166 },
  "profile-left": { scale: 0.148, ox: 551, oy: 272 },
  "three-quarter-left": { scale: 0.148, ox: 500, oy: 252 },
  "three-quarter-right": { scale: 0.139, ox: 230, oy: 294 },
  "profile-right": { scale: 0.147, ox: 159, oy: 271 },
};

const REF = PLATE_ALIGN.front;

/** Scales 1024-space offsets to the dashboard face column (~400–520px wide). */
const PLATE_PAN_SCALE = 0.52;

export function tanPhotoPlateAlignStyle(angle: AuraTanViewAngle): {
  transform: string;
  transformOrigin: string;
} {
  const plate = PLATE_ALIGN[angle];
  const scaleMul = plate.scale / REF.scale;
  const panX = (plate.ox - REF.ox) * PLATE_PAN_SCALE;
  const panY = (plate.oy - REF.oy) * PLATE_PAN_SCALE;
  return {
    transform: `translate(${panX}px, ${panY}px) scale(${scaleMul})`,
    transformOrigin: "center center",
  };
}
