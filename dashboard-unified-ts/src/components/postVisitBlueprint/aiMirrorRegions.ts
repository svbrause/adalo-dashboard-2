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

/**
 * Revert switch for the previous compact cheek ovals.
 * Set to false if the broader cheek patch feels too large during review.
 */
const USE_EXPANDED_CHEEK_REGION = true;

/** Cheek landmarks for hull — wide malar coverage without jaw hinge or ear rim. */
const LEFT_CHEEK_HULL_INDICES = [
  117, 118, 119, 100, 50, 101, 123, 116, 147, 187, 205, 227, 234,
];
const RIGHT_CHEEK_HULL_INDICES = [
  346, 347, 348, 329, 280, 330, 352, 376, 411, 425, 427, 454,
];

function crossProduct(
  origin: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
}

function convexHull(
  points: { x: number; y: number }[],
): { x: number; y: number }[] {
  if (points.length <= 3) return points;
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);

  const lower: { x: number; y: number }[] = [];
  for (const point of sorted) {
    while (
      lower.length >= 2 &&
      crossProduct(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 0
    ) {
      lower.pop();
    }
    lower.push(point);
  }

  const upper: { x: number; y: number }[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const point = sorted[i]!;
    while (
      upper.length >= 2 &&
      crossProduct(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 0
    ) {
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function expandPolygonFromCentroid(
  points: { x: number; y: number }[],
  factor: number,
): { x: number; y: number }[] {
  if (points.length === 0 || factor === 1) return points;
  const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  return points.map((p) => ({
    x: cx + (p.x - cx) * factor,
    y: cy + (p.y - cy) * factor,
  }));
}

function landmarkPoint(
  landmarks: { x: number; y: number }[],
  index: number,
  width: number,
  height: number,
): { x: number; y: number } | null {
  const lm = landmarks[index];
  return lm ? { x: lm.x * width, y: lm.y * height } : null;
}

function clampPointToCanvas(
  point: { x: number; y: number },
  width: number,
  height: number,
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(width, point.x)),
    y: Math.max(0, Math.min(height, point.y)),
  };
}

function smoothClosedPath(
  anchors: { x: number; y: number }[],
  samplesPerSegment = 4,
): { x: number; y: number }[] {
  if (anchors.length < 3) return anchors;
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < anchors.length; i++) {
    const p0 = anchors[(i - 1 + anchors.length) % anchors.length]!;
    const p1 = anchors[i]!;
    const p2 = anchors[(i + 1) % anchors.length]!;
    const p3 = anchors[(i + 2) % anchors.length]!;
    for (let j = 0; j < samplesPerSegment; j++) {
      const t = j / samplesPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      points.push({
        x:
          0.5 *
          ((2 * p1.x) +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y:
          0.5 *
          ((2 * p1.y) +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  return points;
}

function faceMidlineX(
  landmarks: { x: number; y: number }[],
  width: number,
  height: number,
): number {
  const ids = [168, 1, 4, 152];
  const pts = ids
    .map((index) => landmarkPoint(landmarks, index, width, height))
    .filter((point): point is { x: number; y: number } => point != null);
  if (pts.length === 0) return width / 2;
  return pts.reduce((sum, point) => sum + point.x, 0) / pts.length;
}

function mirrorPolygonAcrossMidline(
  points: { x: number; y: number }[],
  midlineX: number,
): { x: number; y: number }[] {
  return points.map((point) => ({
    x: midlineX * 2 - point.x,
    y: point.y,
  }));
}

/**
 * Symmetrical nose patch: tapered bridge, paired alae, and a soft columella base.
 * Avoids the sailboat-like loop from connecting raw mesh indices in order.
 */
export function noseRegionPolygon(
  landmarks: { x: number; y: number }[],
  width: number,
  height: number,
): { x: number; y: number }[] {
  const scale = faceScalePixels(landmarks, width, height);
  const midlineX = faceMidlineX(landmarks, width, height);
  const bridgeTop = landmarkPoint(landmarks, 168, width, height);
  const bridgeMid = landmarkPoint(landmarks, 6, width, height);
  const tip = landmarkPoint(landmarks, 4, width, height);
  const base =
    landmarkPoint(landmarks, 2, width, height) ??
    landmarkPoint(landmarks, 1, width, height);
  const leftAlar =
    landmarkPoint(landmarks, 49, width, height) ??
    landmarkPoint(landmarks, 98, width, height);
  const rightAlar =
    landmarkPoint(landmarks, 279, width, height) ??
    landmarkPoint(landmarks, 327, width, height);

  if (!bridgeTop || !tip || !base) {
    return polygonFromLandmarkIndices(
      landmarks,
      AI_MIRROR_REGIONS.find((region) => region.id === "rNose")?.indices ?? [],
      width,
      height,
    );
  }

  const leftAlarDistance = leftAlar
    ? Math.abs(midlineX - leftAlar.x)
    : scale * 0.042;
  const rightAlarDistance = rightAlar
    ? Math.abs(rightAlar.x - midlineX)
    : scale * 0.042;
  const alarHalfWidth = Math.max(
    scale * 0.034,
    (leftAlarDistance + rightAlarDistance) / 2,
  );
  const bridgeHalfWidth = alarHalfWidth * 0.34;
  const midHalfWidth = alarHalfWidth * 0.68;

  const topY = bridgeTop.y - scale * 0.008;
  const midY = bridgeMid?.y ?? tip.y - scale * 0.05;
  const tipY = tip.y;
  const baseY = Math.max(base.y, tipY + scale * 0.018);

  const anchors = [
    { x: midlineX, y: topY },
    { x: midlineX - bridgeHalfWidth, y: midY - scale * 0.02 },
    { x: midlineX - midHalfWidth, y: tipY - scale * 0.01 },
    { x: midlineX - alarHalfWidth, y: tipY + scale * 0.03 },
    { x: midlineX - alarHalfWidth * 0.58, y: baseY },
    { x: midlineX, y: baseY + scale * 0.01 },
    { x: midlineX + alarHalfWidth * 0.58, y: baseY },
    { x: midlineX + alarHalfWidth, y: tipY + scale * 0.03 },
    { x: midlineX + midHalfWidth, y: tipY - scale * 0.01 },
    { x: midlineX + bridgeHalfWidth, y: midY - scale * 0.02 },
  ];

  return smoothClosedPath(anchors, 4);
}

/** Previous compact cheek oval, kept as a one-line revert path. */
function legacyCheekRegionPolygon(
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

/** Cheek hull with guardrails: full malar area, no ear / jaw / lip spill. */
function expandedCheekRegionPolygon(
  landmarks: { x: number; y: number }[],
  width: number,
  height: number,
  side: "left" | "right",
): { x: number; y: number }[] {
  const hullIndices =
    side === "left" ? LEFT_CHEEK_HULL_INDICES : RIGHT_CHEEK_HULL_INDICES;
  const cheekPoints = polygonFromLandmarkIndices(
    landmarks,
    hullIndices,
    width,
    height,
  );
  if (cheekPoints.length < 6) {
    return legacyCheekRegionPolygon(landmarks, width, height, side);
  }

  const scale = faceScalePixels(landmarks, width, height);
  const hull = convexHull(cheekPoints);
  if (hull.length < 3) {
    return legacyCheekRegionPolygon(landmarks, width, height, side);
  }

  const expanded = expandPolygonFromCentroid(hull, 1.06);
  const mouthCorner = landmarkPoint(
    landmarks,
    side === "left" ? 61 : 291,
    width,
    height,
  );
  const outerEdge = landmarkPoint(
    landmarks,
    side === "left" ? 234 : 454,
    width,
    height,
  );
  const innerEdge = landmarkPoint(
    landmarks,
    side === "left" ? 98 : 327,
    width,
    height,
  );
  const maxBottomY = mouthCorner
    ? mouthCorner.y - scale * 0.038
    : Number.POSITIVE_INFINITY;
  const outerPad = scale * 0.006;
  const innerPad = scale * 0.012;

  const bounded = expanded.map((point) => {
    let { x, y } = point;
    if (outerEdge) {
      x =
        side === "left"
          ? Math.max(x, outerEdge.x + outerPad)
          : Math.min(x, outerEdge.x - outerPad);
    }
    if (innerEdge) {
      x =
        side === "left"
          ? Math.min(x, innerEdge.x - innerPad)
          : Math.max(x, innerEdge.x + innerPad);
    }
    y = Math.min(y, maxBottomY);
    return clampPointToCanvas({ x, y }, width, height);
  });

  return smoothClosedPath(bounded, 5);
}

export function cheekRegionPolygon(
  landmarks: { x: number; y: number }[],
  width: number,
  height: number,
  side: "left" | "right",
): { x: number; y: number }[] {
  const leftPolygon = USE_EXPANDED_CHEEK_REGION
    ? expandedCheekRegionPolygon(landmarks, width, height, "left")
    : legacyCheekRegionPolygon(landmarks, width, height, "left");
  if (leftPolygon.length < 3) {
    return side === "left"
      ? leftPolygon
      : legacyCheekRegionPolygon(landmarks, width, height, "right");
  }
  if (side === "left") return leftPolygon;
  return mirrorPolygonAcrossMidline(
    leftPolygon,
    faceMidlineX(landmarks, width, height),
  );
}

const LIPS_LANDMARK_INDICES =
  AI_MIRROR_REGIONS.find((region) => region.id === "rLips")?.indices ?? [];

/** Closed lip outline from MediaPipe — slightly padded so cheek redness does not tint lips. */
export function lipsRegionPolygon(
  landmarks: { x: number; y: number }[],
  width: number,
  height: number,
): { x: number; y: number }[] {
  const core = polygonFromLandmarkIndices(
    landmarks,
    LIPS_LANDMARK_INDICES,
    width,
    height,
  );
  if (core.length < 3) return [];

  const cx = core.reduce((sum, point) => sum + point.x, 0) / core.length;
  const cy = core.reduce((sum, point) => sum + point.y, 0) / core.length;
  const scale = faceScalePixels(landmarks, width, height);
  const pad = 1 + Math.min(0.1, (scale / Math.min(width, height)) * 0.08);

  return core.map((point) => ({
    x: cx + (point.x - cx) * pad,
    y: cy + (point.y - cy) * pad,
  }));
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
