/**
 * Face sub-regions as MediaPipe landmark index sets — matches the live scan demo
 * (`test-live-mediapipe/index.html`) for consistent “analysis map” styling.
 */
export const AI_MIRROR_REGIONS: { id: string; indices: number[] }[] = [
  { id: "rForehead", indices: [67, 109, 10, 338, 297, 332, 284, 300, 293, 334, 296, 336, 107, 66, 105, 63, 70, 54, 103] },
  { id: "rLeftEye", indices: [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7] },
  { id: "rRightEye", indices: [362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381, 382] },
  { id: "rNose", indices: [6, 197, 195, 5, 4, 1, 19, 94, 2, 98, 327, 168] },
  { id: "rLeftCheek", indices: [50, 101, 205, 187, 147, 123, 116, 117] },
  { id: "rRightCheek", indices: [280, 330, 425, 411, 376, 352, 346, 347] },
  {
    id: "rLips",
    indices: [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78],
  },
  { id: "rChin", indices: [152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 227, 123, 147] },
];

export const ADDITIONAL_AI_MIRROR_REGIONS: { id: string; indices: number[] }[] = [
  { id: "rLeftUnderEye", indices: [] },
  { id: "rRightUnderEye", indices: [] },
  { id: "rLeftNasolabialFold", indices: [] },
  { id: "rRightNasolabialFold", indices: [] },
  { id: "rLeftMarionetteLine", indices: [] },
  { id: "rRightMarionetteLine", indices: [] },
  {
    id: "rLowerFace",
    indices: [205, 187, 147, 123, 116, 117, 93, 132, 58, 172, 136, 150, 149, 148, 152, 176, 378, 365, 288, 397, 361, 340, 346, 347, 376, 411, 425, 280],
  },
];

export function polygonFromLandmarkIndices(
  landmarks: { x: number; y: number }[],
  indices: number[],
  width: number,
  height: number,
): { x: number; y: number }[] {
  return indices
    .map((i) => {
      const lm = landmarks[i];
      if (!lm) return null;
      return { x: lm.x * width, y: lm.y * height };
    })
    .filter((p): p is { x: number; y: number } => p != null);
}
