/**
 * MediaPipe-derived polygons for mirror region ids (shared by 3D viewer + regional map).
 */
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import {
  ADDITIONAL_AI_MIRROR_REGIONS,
  AI_MIRROR_REGIONS,
  cheekRegionPolygon,
  foreheadRegionPolygon,
  polygonFromLandmarkIndices,
} from "../components/postVisitBlueprint/aiMirrorRegions";
import type { AuraZonePolygon } from "./regionalFaceZonePolygons";
import { polygonCentroid, toViewBox } from "./regionalFaceZonePolygons";

function mirrorRegionIndices(regionId: string): number[] {
  return (
    AI_MIRROR_REGIONS.find((r) => r.id === regionId)?.indices ??
    ADDITIONAL_AI_MIRROR_REGIONS.find((r) => r.id === regionId)?.indices ??
    []
  );
}

function getPointsByIndices(
  landmarks: NormalizedLandmark[],
  indices: number[],
  width: number,
  height: number,
): { x: number; y: number }[] {
  return indices
    .map((i) => landmarks[i])
    .filter(Boolean)
    .map((lm) => ({ x: lm.x * width, y: lm.y * height }));
}

function faceScalePixels(
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
): number {
  const pts = getPointsByIndices(landmarks, [234, 454, 10, 152], width, height);
  if (pts.length < 4) return Math.min(width, height);
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

function landmarkPoint(
  landmarks: NormalizedLandmark[],
  index: number,
  width: number,
  height: number,
): { x: number; y: number } | null {
  const lm = landmarks[index];
  return lm ? { x: lm.x * width, y: lm.y * height } : null;
}

function pointBetween(
  a: { x: number; y: number },
  b: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function stripAroundPolyline(
  points: { x: number; y: number }[],
  widthPx: number,
): { x: number; y: number }[] {
  if (points.length < 2) return [];
  const left: { x: number; y: number }[] = [];
  const right: { x: number; y: number }[] = [];
  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(0, i - 1)]!;
    const next = points[Math.min(points.length - 1, i + 1)]!;
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const p = points[i]!;
    left.push({ x: p.x + nx * widthPx, y: p.y + ny * widthPx });
    right.push({ x: p.x - nx * widthPx, y: p.y - ny * widthPx });
  }
  return [...left, ...right.reverse()];
}

function underEyeRegion(
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
  side: "left" | "right",
): { x: number; y: number }[] {
  const indices =
    side === "left"
      ? [33, 7, 163, 144, 145, 153, 154, 155, 133]
      : [362, 382, 381, 380, 374, 373, 390, 249, 263];
  const lid = getPointsByIndices(landmarks, indices, width, height);
  if (lid.length < 3) return [];
  const scale = faceScalePixels(landmarks, width, height);
  const lower = lid.slice().reverse().map((p) => ({ x: p.x, y: p.y + scale * 0.045 }));
  return [...lid, ...lower];
}

function nasolabialFoldRegion(
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
  side: "left" | "right",
): { x: number; y: number }[] {
  const start = landmarkPoint(landmarks, side === "left" ? 98 : 327, width, height);
  const end = landmarkPoint(landmarks, side === "left" ? 61 : 291, width, height);
  if (!start || !end) return [];
  const scale = faceScalePixels(landmarks, width, height);
  const outward = side === "left" ? -1 : 1;
  const mid = pointBetween(start, end, 0.52);
  mid.x += outward * scale * 0.018;
  mid.y += scale * 0.01;
  return stripAroundPolyline([start, mid, end], Math.max(4, scale * 0.012));
}

function marionetteLineRegion(
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
  side: "left" | "right",
): { x: number; y: number }[] {
  const start = landmarkPoint(landmarks, side === "left" ? 61 : 291, width, height);
  const chin = landmarkPoint(landmarks, side === "left" ? 172 : 397, width, height);
  if (!start || !chin) return [];
  const scale = faceScalePixels(landmarks, width, height);
  const outward = side === "left" ? -1 : 1;
  const end = {
    x: start.x + outward * scale * 0.055,
    y: start.y + scale * 0.22,
  };
  const guardEnd = pointBetween(end, chin, 0.18);
  const mid = pointBetween(start, guardEnd, 0.52);
  mid.x += outward * scale * 0.012;
  return stripAroundPolyline([start, mid, guardEnd], Math.max(4, scale * 0.013));
}

function lowerFaceRegion(
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
): { x: number; y: number }[] {
  return polygonFromLandmarkIndices(
    landmarks,
    mirrorRegionIndices("rLowerFace"),
    width,
    height,
  );
}

/** Pixel-space polygon for a mirror annotation region id (frontal reference photo). */
export function mirrorRegionPolygonPixels(
  regionId: string,
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
): { x: number; y: number }[] {
  if (regionId === "rLeftUnderEye") {
    return underEyeRegion(landmarks, width, height, "left");
  }
  if (regionId === "rRightUnderEye") {
    return underEyeRegion(landmarks, width, height, "right");
  }
  if (regionId === "rLeftNasolabialFold") {
    return nasolabialFoldRegion(landmarks, width, height, "left");
  }
  if (regionId === "rRightNasolabialFold") {
    return nasolabialFoldRegion(landmarks, width, height, "right");
  }
  if (regionId === "rLeftMarionetteLine") {
    return marionetteLineRegion(landmarks, width, height, "left");
  }
  if (regionId === "rRightMarionetteLine") {
    return marionetteLineRegion(landmarks, width, height, "right");
  }
  if (regionId === "rLowerFace") {
    return lowerFaceRegion(landmarks, width, height);
  }
  if (regionId === "rForehead") {
    return foreheadRegionPolygon(landmarks, width, height);
  }
  if (regionId === "rLeftCheek") {
    return cheekRegionPolygon(landmarks, width, height, "left");
  }
  if (regionId === "rRightCheek") {
    return cheekRegionPolygon(landmarks, width, height, "right");
  }
  return polygonFromLandmarkIndices(
    landmarks,
    mirrorRegionIndices(regionId),
    width,
    height,
  );
}

export function mirrorRegionPolygonInViewBox(
  regionId: string,
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
): AuraZonePolygon | null {
  const pixels = mirrorRegionPolygonPixels(regionId, landmarks, width, height);
  if (pixels.length < 3) return null;
  const points = toViewBox(pixels, width, height);
  return {
    points,
    score: polygonCentroid(points),
  };
}
