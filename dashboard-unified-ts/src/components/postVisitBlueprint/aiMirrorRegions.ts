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

/** Brow contour left → right (MediaPipe face mesh). */
const FOREHEAD_BROW_INDICES = [70, 63, 105, 66, 107, 336, 296, 334, 293, 300];

function faceScalePixels(
  landmarks: { x: number; y: number }[],
  width: number,
  height: number,
): number {
  const ids = [234, 454, 10, 152];
  const pts = ids
    .map((i) => landmarks[i])
    .filter(Boolean)
    .map((lm) => ({ x: lm.x * width, y: lm.y * height }));
  if (pts.length < 4) return Math.min(width, height);
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

/** Ellipse sampled as a closed polygon (for canvas fill/stroke). */
export function ovalPoints(
  center: { x: number; y: number },
  rx: number,
  ry: number,
  steps = 32,
  rotationRad = 0,
): { x: number; y: number }[] {
  const cosR = Math.cos(rotationRad);
  const sinR = Math.sin(rotationRad);
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const ex = Math.cos(t) * rx;
    const ey = Math.sin(t) * ry;
    points.push({
      x: center.x + ex * cosR - ey * sinR,
      y: center.y + ex * sinR + ey * cosR,
    });
  }
  return points;
}

function quadraticSample(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  count: number,
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 1; i < count; i++) {
    const t = i / count;
    const u = 1 - t;
    out.push({
      x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    });
  }
  return out;
}

function filletArcPoints(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  steps: number,
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = startAngle + ((endAngle - startAngle) * i) / steps;
    pts.push({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
  }
  return pts;
}

const LEFT_CHEEK_INDICES = [50, 101, 205, 187, 147, 123, 116, 117];
const RIGHT_CHEEK_INDICES = [280, 330, 425, 411, 376, 352, 346, 347];

/** Smooth cheek oval anchored to landmark bbox (avoids pac-man mesh polygons). */
export function cheekRegionPolygon(
  landmarks: { x: number; y: number }[],
  width: number,
  height: number,
  side: "left" | "right",
): { x: number; y: number }[] {
  const indices = side === "left" ? LEFT_CHEEK_INDICES : RIGHT_CHEEK_INDICES;
  const cheek = polygonFromLandmarkIndices(landmarks, indices, width, height);
  if (cheek.length < 4) return [];

  const xs = cheek.map((p) => p.x);
  const ys = cheek.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  const rx = Math.max(14, (maxX - minX) * 0.5);
  const ry = Math.max(14, (maxY - minY) * 0.54);
  const rotation = side === "left" ? -0.14 : 0.14;
  return ovalPoints(center, rx, ry, 36, rotation);
}

function subsamplePolyline(
  points: { x: number; y: number }[],
  targetCount: number,
): { x: number; y: number }[] {
  if (points.length <= targetCount) return points;
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < targetCount; i++) {
    const t = targetCount <= 1 ? 0 : i / (targetCount - 1);
    const idx = t * (points.length - 1);
    const i0 = Math.floor(idx);
    const i1 = Math.min(points.length - 1, i0 + 1);
    const f = idx - i0;
    out.push({
      x: points[i0]!.x * (1 - f) + points[i1]!.x * f,
      y: points[i0]!.y * (1 - f) + points[i1]!.y * f,
    });
  }
  return out;
}

/**
 * Smooth forehead band: narrower at the hairline (top), wider along the brows (bottom).
 * Avoids jagged mesh polygons from raw landmark loops.
 */
export function foreheadRegionPolygon(
  landmarks: { x: number; y: number }[],
  width: number,
  height: number,
): { x: number; y: number }[] {
  const browPts = polygonFromLandmarkIndices(
    landmarks,
    FOREHEAD_BROW_INDICES,
    width,
    height,
  ).sort((a, b) => a.x - b.x);
  if (browPts.length < 3) return [];

  const scale = faceScalePixels(landmarks, width, height);
  const padX = scale * 0.035;
  const bandDepth = Math.max(scale * 0.18, height * 0.07);

  const browY =
    browPts.reduce((sum, p) => sum + p.y, 0) / browPts.length;
  const leftBrow = browPts[0]!;
  const rightBrow = browPts[browPts.length - 1]!;

  const topCenterLm = landmarks[10];
  let topY = browY - bandDepth;
  if (topCenterLm) {
    topY = Math.min(topY, topCenterLm.y * height);
  }

  // Hairline (top) narrower than brow line (bottom) — taper toward top of face.
  const centerX = topCenterLm
    ? topCenterLm.x * width
    : (leftBrow.x + rightBrow.x) / 2;
  const browSpan = rightBrow.x - leftBrow.x;
  const topSpan = browSpan * 0.8;
  const topLeft = { x: centerX - topSpan / 2, y: topY };
  const topRight = { x: centerX + topSpan / 2, y: topY };
  // Soft arch: center only slightly higher than corners (trapezoid / shallow oval top).
  const archLift = scale * 0.012;
  const topMid = {
    x: centerX,
    y: topY - archLift,
  };

  const cornerR = Math.min(scale * 0.05, topSpan * 0.14, bandDepth * 0.28);
  const cornerSteps = 5;

  const widenedBrow = browPts.map((p, i) => {
    if (i === 0) return { x: p.x - padX, y: p.y };
    if (i === browPts.length - 1) return { x: p.x + padX, y: p.y };
    return p;
  });
  const browBottom = subsamplePolyline(widenedBrow, 7);

  const leftRise = { x: topLeft.x, y: topLeft.y + cornerR };
  const rightRise = { x: topRight.x, y: topRight.y + cornerR };

  const tlArc = filletArcPoints(
    topLeft.x + cornerR,
    topLeft.y + cornerR,
    cornerR,
    Math.PI,
    Math.PI * 1.5,
    cornerSteps,
  );
  const trArc = filletArcPoints(
    topRight.x - cornerR,
    topRight.y + cornerR,
    cornerR,
    Math.PI * 1.5,
    Math.PI * 2,
    cornerSteps,
  );
  const topCurve = quadraticSample(
    tlArc[tlArc.length - 1]!,
    topMid,
    trArc[0]!,
    6,
  );

  return [
    ...browBottom.slice().reverse(),
    leftRise,
    ...tlArc.slice(1),
    ...topCurve,
    ...trArc.slice(1),
    rightRise,
  ];
}
