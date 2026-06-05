import type { AuraTanViewAngle } from "./auraTanAnglePhotos";
import generatedTanAnnotations from "../assets/aura-tan-wrinkle-annotations.json";

export type AuraCvDarkSpot = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  intensity: number;
};

export type AuraCvRedSpot = AuraCvDarkSpot;

export type AuraCvPoreSpot = { cx: number; cy: number; r: number };
export type AuraCvTextureMark = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rotation?: number;
  intensity: number;
};

export type AuraCvAnnotations = {
  wrinkles: string[];
  /** Per-angle crease paths (viewBox 0–100); preferred over flat `wrinkles` when present. */
  wrinklesByAngle?: Partial<Record<AuraTanViewAngle, string[]>>;
  darkSpotsByAngle: Partial<Record<AuraTanViewAngle, AuraCvDarkSpot[]>>;
  /** Optional PNG/SVG mask layer for redness; preferred over ellipse spot glyphs. */
  redMaskByAngle?: Partial<Record<AuraTanViewAngle, string>>;
  redSpotsByAngle?: Partial<Record<AuraTanViewAngle, AuraCvRedSpot[]>>;
  /** Optional PNG mask layer for visible pores; brownish overlay per angle. */
  poreMaskByAngle?: Partial<Record<AuraTanViewAngle, string>>;
  /** Depressed / irregular surface texture marks such as atrophic acne scars. */
  textureMarksByAngle?: Partial<Record<AuraTanViewAngle, AuraCvTextureMark[]>>;
  redAreas: string[];
  pores: AuraCvPoreSpot[];
  volume: string[];
};

type GeneratedTanAnnotation = {
  redSpots?: AuraCvRedSpot[];
  wrinkles?: number[][][];
};

function polylineToSvgPath(points: number[][]): string {
  if (points.length < 2) return "";
  const [first, ...rest] = points;
  let d = `M ${first[0]} ${first[1]}`;
  for (const [x, y] of rest) d += ` L ${x} ${y}`;
  return d;
}

const GENERATED_TAN_RED_SPOTS_BY_ANGLE = Object.fromEntries(
  Object.entries(generatedTanAnnotations as Record<AuraTanViewAngle, GeneratedTanAnnotation>)
    .map(([angle, annotation]) => [angle, annotation.redSpots ?? []]),
) as Partial<Record<AuraTanViewAngle, AuraCvRedSpot[]>>;

const GENERATED_TAN_WRINKLES_BY_ANGLE = Object.fromEntries(
  Object.entries(generatedTanAnnotations as Record<AuraTanViewAngle, GeneratedTanAnnotation>)
    .map(([angle, annotation]) => [
      angle,
      (annotation.wrinkles ?? [])
        .map((polyline) => polylineToSvgPath(polyline))
        .filter((d) => d.length > 0),
    ])
    .filter(([, paths]) => (paths as string[]).length > 0),
) as Partial<Record<AuraTanViewAngle, string[]>>;

function normalizeWrinklePathList(paths: unknown): string[] {
  if (!Array.isArray(paths)) return [];
  return paths
    .map((entry) =>
      typeof entry === "string"
        ? entry
        : Array.isArray(entry) && Array.isArray(entry[0])
          ? polylineToSvgPath(entry as number[][])
          : "",
    )
    .filter((d) => d.length > 0);
}

/** Wrinkle SVG paths for a given pose (viewBox 0–100). */
export function wrinklePathsForAngle(
  annotations: AuraCvAnnotations,
  angle: AuraTanViewAngle,
): string[] {
  const perAngle = annotations.wrinklesByAngle?.[angle];
  if (perAngle?.length) return normalizeWrinklePathList(perAngle);
  return normalizeWrinklePathList(annotations.wrinkles);
}

export const EMPTY_AURA_CV_ANNOTATIONS: AuraCvAnnotations = {
  wrinkles: [],
  darkSpotsByAngle: {},
  redMaskByAngle: {},
  redSpotsByAngle: {},
  textureMarksByAngle: {},
  redAreas: [],
  pores: [],
  volume: [],
};

/** Bundled Tanya Tan demo diagnostic overlay geometry (viewBox 0–100). */
export const TANYA_AURA_CV_ANNOTATIONS: AuraCvAnnotations = {
  wrinklesByAngle: GENERATED_TAN_WRINKLES_BY_ANGLE,
  wrinkles: [
    "M 42.09 32.03 Q 42.77 31.73 43.46 32.03",
    "M 43.51 30.52 Q 43.97 30.22 44.43 30.52",
    "M 53.66 33.42 Q 54.15 33.12 54.64 33.42",
    "M 41.21 32.64 Q 41.65 32.34 42.09 32.64",
    "M 40.19 30.79 Q 40.58 30.49 40.97 30.79",
    "M 54.79 31.54 Q 55.2 31.24 55.62 31.54",
    "M 52.34 31.88 Q 52.73 31.58 53.12 31.88",
    "M 54.1 30.15 Q 54.52 29.85 54.93 30.15",
    "M 45.07 31.59 Q 45.51 31.29 45.95 31.59",
    "M 43.75 46.39 Q 44.31 46.09 44.87 46.39",
    "M 44.48 45.43 Q 44.82 45.13 45.17 45.43",
    "M 56.1 47.44 Q 56.67 47.14 57.23 47.44",
    "M 58.59 43.8 Q 59.01 43.5 59.42 43.8",
    "M 52.1 60.74 Q 52.64 60.44 53.17 60.74",
    "M 37.9 43.8 Q 40.6 42.35 43.5 43.55",
    "M 56.4 43.7 Q 59.5 42.3 62.45 43.55",
    "M 40.5 56.85 Q 43.25 58.2 46.35 57.55",
    "M 53.55 57.55 Q 56.7 58.2 59.6 56.85",
  ],
  volume: [
    "M 36.74 47.84 L 43.49 44.81 L 47.87 49.35 L 45.48 57.41 L 39.52 58.92 Z",
    "M 62.97 47.84 L 56.21 44.81 L 51.84 49.35 L 54.23 57.41 L 60.19 58.92 Z",
    "M 41.11 65.98 L 46.67 68.5 L 53.03 68.5 L 58.6 65.98 L 55.42 71.02 L 44.29 71.02 Z",
  ],
  redAreas: [
    "M 46.19 57.03 L 51.22 57.32 L 49.07 53.76 L 48.19 54.15 L 47.75 56.1 Z",
    "M 39.36 57.28 L 39.94 59.38 L 46.63 59.38 L 47.8 55.52 L 44.53 56.84 L 44.58 55.32 L 41.6 55.22 Z",
    "M 59.81 57.47 L 56.4 54.25 L 53.52 55.08 L 55.22 56.64 L 53.32 57.28 L 53.61 59.38 L 59.08 59.38 Z",
    "M 44.7 47.9 L 49.8 43.6 L 55.1 47.9 L 53.85 60.2 L 49.7 64.35 L 45.85 60.2 Z",
    "M 40.25 64.85 Q 49.5 61.9 59.55 64.8 Q 55.55 69.4 44.3 69.2 Z",
  ],
  redSpotsByAngle: GENERATED_TAN_RED_SPOTS_BY_ANGLE,
  textureMarksByAngle: {
    front: [
      { cx: 43.6, cy: 47.8, rx: 0.85, ry: 0.38, rotation: -18, intensity: 0.72 },
      { cx: 45.9, cy: 50.7, rx: 0.62, ry: 0.3, rotation: 12, intensity: 0.58 },
      { cx: 53.8, cy: 48.9, rx: 0.72, ry: 0.34, rotation: 16, intensity: 0.64 },
      { cx: 55.7, cy: 52.4, rx: 0.58, ry: 0.28, rotation: -10, intensity: 0.52 },
      { cx: 47.8, cy: 56.2, rx: 0.5, ry: 0.24, rotation: 4, intensity: 0.44 },
      { cx: 52.2, cy: 56.4, rx: 0.48, ry: 0.24, rotation: -6, intensity: 0.42 },
    ],
    "three-quarter-left": [
      { cx: 40.7, cy: 45.8, rx: 0.92, ry: 0.4, rotation: -20, intensity: 0.7 },
      { cx: 42.9, cy: 49.4, rx: 0.74, ry: 0.32, rotation: 14, intensity: 0.62 },
      { cx: 45.0, cy: 53.0, rx: 0.58, ry: 0.26, rotation: -4, intensity: 0.46 },
      { cx: 48.0, cy: 47.5, rx: 0.44, ry: 0.22, rotation: 18, intensity: 0.4 },
    ],
    "three-quarter-right": [
      { cx: 33.8, cy: 47.2, rx: 0.9, ry: 0.38, rotation: 18, intensity: 0.68 },
      { cx: 36.2, cy: 50.8, rx: 0.74, ry: 0.32, rotation: -12, intensity: 0.6 },
      { cx: 38.4, cy: 54.1, rx: 0.56, ry: 0.26, rotation: 5, intensity: 0.45 },
      { cx: 31.8, cy: 52.6, rx: 0.42, ry: 0.2, rotation: -18, intensity: 0.38 },
    ],
    "profile-left": [
      { cx: 58.4, cy: 47.8, rx: 0.82, ry: 0.34, rotation: -12, intensity: 0.58 },
      { cx: 56.5, cy: 51.0, rx: 0.64, ry: 0.28, rotation: 10, intensity: 0.5 },
      { cx: 53.8, cy: 54.2, rx: 0.46, ry: 0.22, rotation: -4, intensity: 0.38 },
    ],
    "profile-right": [
      { cx: 48.3, cy: 45.8, rx: 0.86, ry: 0.36, rotation: 12, intensity: 0.62 },
      { cx: 51.0, cy: 48.7, rx: 0.68, ry: 0.28, rotation: -8, intensity: 0.54 },
      { cx: 53.2, cy: 52.4, rx: 0.5, ry: 0.24, rotation: 4, intensity: 0.4 },
    ],
  },
  darkSpotsByAngle: {
    front: [],
    "three-quarter-left": [
      { cx: 43.0, cy: 45.5, rx: 0.309, ry: 0.309, intensity: 0.76 },
      { cx: 41.5, cy: 47.8, rx: 0.258, ry: 0.258, intensity: 0.74 },
      { cx: 44.8, cy: 42.3, rx: 0.279, ry: 0.279, intensity: 0.72 },
      { cx: 46.2, cy: 44.0, rx: 0.268, ry: 0.268, intensity: 0.7 },
      { cx: 42.5, cy: 41.0, rx: 0.258, ry: 0.258, intensity: 0.68 },
    ],
    "three-quarter-right": [
      { cx: 33.0, cy: 47.5, rx: 0.309, ry: 0.309, intensity: 0.76 },
      { cx: 31.5, cy: 49.8, rx: 0.258, ry: 0.258, intensity: 0.74 },
      { cx: 34.8, cy: 44.3, rx: 0.279, ry: 0.279, intensity: 0.72 },
      { cx: 36.2, cy: 46.0, rx: 0.268, ry: 0.268, intensity: 0.7 },
      { cx: 32.5, cy: 43.0, rx: 0.258, ry: 0.258, intensity: 0.68 },
    ],
    "profile-left": [],
    "profile-right": [
      { cx: 47.0, cy: 44.0, rx: 0.95, ry: 0.62, intensity: 0.74 },
      { cx: 50.0, cy: 45.1, rx: 1.25, ry: 0.86, intensity: 0.78 },
      { cx: 53.4, cy: 44.8, rx: 0.82, ry: 0.58, intensity: 0.7 },
      { cx: 49.4, cy: 48.2, rx: 0.72, ry: 0.54, intensity: 0.68 },
      { cx: 45.5, cy: 49.4, rx: 0.64, ry: 0.45, intensity: 0.62 },
    ],
  },
  pores: [
    { cx: 47.5, cy: 43.9, r: 0.28 },
    { cx: 50.0, cy: 43.4, r: 0.3 },
    { cx: 52.6, cy: 44.0, r: 0.28 },
    { cx: 48.1, cy: 47.2, r: 0.32 },
    { cx: 51.9, cy: 47.6, r: 0.32 },
    { cx: 49.5, cy: 50.8, r: 0.34 },
    { cx: 50.9, cy: 54.0, r: 0.34 },
    { cx: 47.6, cy: 57.5, r: 0.3 },
    { cx: 52.8, cy: 57.6, r: 0.3 },
    { cx: 42.0, cy: 57.2, r: 0.28 },
    { cx: 58.2, cy: 56.8, r: 0.28 },
    { cx: 44.8, cy: 62.6, r: 0.26 },
    { cx: 55.5, cy: 62.3, r: 0.26 },
    { cx: 47.8, cy: 68.1, r: 0.28 },
    { cx: 52.0, cy: 68.0, r: 0.28 },
  ],
};
