import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import {
  ADDITIONAL_AI_MIRROR_REGIONS,
  AI_MIRROR_REGIONS,
  cheekRegionPolygon,
  foreheadRegionPolygon,
  polygonFromLandmarkIndices,
} from "../components/postVisitBlueprint/aiMirrorRegions";
import type { AuraFiveRegionId } from "./auraRegionalDisplay";

export type NormalizedPoint = { x: number; y: number };

export interface AuraZonePolygon {
  /** Closed polygon in 0–100 viewBox coordinates. */
  points: NormalizedPoint[];
  score: NormalizedPoint;
}

/** Slight inset so fills sit on the sculpt, not outside it. */
const REGIONAL_ZONE_INSET = 0.94;

function mirrorRegionIndices(regionId: string): number[] {
  return (
    AI_MIRROR_REGIONS.find((r) => r.id === regionId)?.indices ??
    ADDITIONAL_AI_MIRROR_REGIONS.find((r) => r.id === regionId)?.indices ??
    []
  );
}

function pixelCentroid(points: { x: number; y: number }[]): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 };
  const sum = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function insetPolygonPixels(
  points: { x: number; y: number }[],
  scale: number,
): { x: number; y: number }[] {
  if (points.length < 3 || scale >= 1) return points;
  const c = pixelCentroid(points);
  return points.map((p) => ({
    x: c.x + (p.x - c.x) * scale,
    y: c.y + (p.y - c.y) * scale,
  }));
}

function polygonCentroid(points: NormalizedPoint[]): NormalizedPoint {
  if (points.length === 0) return { x: 50, y: 50 };
  const sum = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function toViewBox(
  points: { x: number; y: number }[],
  width: number,
  height: number,
): NormalizedPoint[] {
  if (width <= 0 || height <= 0) return [];
  return points.map((p) => ({
    x: (p.x / width) * 100,
    y: (p.y / height) * 100,
  }));
}

function finalizeZone(points: { x: number; y: number }[]): { x: number; y: number }[] {
  if (points.length < 3) return points;
  return insetPolygonPixels(points, REGIONAL_ZONE_INSET);
}

function regionalCheekZone(
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
  side: "left" | "right",
): { x: number; y: number }[] {
  const oval = cheekRegionPolygon(landmarks, width, height, side);
  if (oval.length < 4) return oval;
  return insetPolygonPixels(oval, REGIONAL_ZONE_INSET);
}

function regionalForeheadZone(
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
): { x: number; y: number }[] {
  const band = foreheadRegionPolygon(landmarks, width, height);
  return finalizeZone(band);
}

function regionalNoseZone(
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
): { x: number; y: number }[] {
  const mesh = polygonFromLandmarkIndices(
    landmarks,
    mirrorRegionIndices("rNose"),
    width,
    height,
  );
  return finalizeZone(mesh);
}

function regionalChinZone(
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
): { x: number; y: number }[] {
  const chin = polygonFromLandmarkIndices(
    landmarks,
    mirrorRegionIndices("rChin"),
    width,
    height,
  );
  if (chin.length >= 4) {
    return finalizeZone(chin);
  }
  const lips = polygonFromLandmarkIndices(
    landmarks,
    mirrorRegionIndices("rLips"),
    width,
    height,
  );
  if (lips.length >= 4) {
    const lipYs = lips.map((p) => p.y);
    const splitY = (Math.min(...lipYs) + Math.max(...lipYs)) / 2;
    const lower = lips.filter((p) => p.y >= splitY);
    return finalizeZone(lower);
  }
  return chin;
}

/**
 * MediaPipe-derived regional zones — tight to anatomy (same helpers as live mirror).
 */
export function auraZonePolygonPixels(
  zoneId: AuraFiveRegionId,
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
): { x: number; y: number }[] {
  switch (zoneId) {
    case "forehead":
      return regionalForeheadZone(landmarks, width, height);
    case "leftCheek":
      return regionalCheekZone(landmarks, width, height, "left");
    case "rightCheek":
      return regionalCheekZone(landmarks, width, height, "right");
    case "nose":
      return regionalNoseZone(landmarks, width, height);
    case "chin":
      return regionalChinZone(landmarks, width, height);
    default:
      return [];
  }
}

export function auraZonePolygonInViewBox(
  zoneId: AuraFiveRegionId,
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
): AuraZonePolygon | null {
  const pixels = auraZonePolygonPixels(zoneId, landmarks, width, height);
  if (pixels.length < 3) return null;
  const points = toViewBox(pixels, width, height);
  return {
    points,
    score: polygonCentroid(points),
  };
}

export function buildAuraZonePolygonsForView(
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
  zoneIds: readonly AuraFiveRegionId[],
): Partial<Record<AuraFiveRegionId, AuraZonePolygon>> {
  const out: Partial<Record<AuraFiveRegionId, AuraZonePolygon>> = {};
  for (const id of zoneIds) {
    const poly = auraZonePolygonInViewBox(id, landmarks, width, height);
    if (poly) out[id] = poly;
  }
  return out;
}

export function polygonPointsAttr(points: NormalizedPoint[]): string {
  return points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}
