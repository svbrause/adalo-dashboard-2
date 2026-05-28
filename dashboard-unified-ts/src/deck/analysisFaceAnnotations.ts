/**
 * Front-face analysis overlays for the clinic deck (viewBox 0 0 100 100).
 * Geometry aligned with AuraFaceView / AURA_CV_ANNOTATIONS on Tanya's front capture.
 */

export type AnalysisConcernId = "skin" | "volume" | "expression";

type Spot = { cx: number; cy: number; rx: number; ry: number; intensity?: number };

export type AnalysisAnnotationLayer = {
  id: AnalysisConcernId;
  label: string;
  /** Filled regions (skin / volume) */
  paths: string[];
  /** Pigment spots (skin) */
  spots: Spot[];
  /** Stroke-only lines (expression wrinkles) */
  strokes: string[];
  callout: { x: number; y: number };
};

/** Pigment on front — person's left cheek (image right). */
export const AURA_SKIN_SPOTS_FRONT: Spot[] = [
  { cx: 63.86, cy: 54.7, rx: 0.9, ry: 0.9, intensity: 0.65 },
  { cx: 64.29, cy: 56.31, rx: 1.0, ry: 1.0, intensity: 0.68 },
  { cx: 62.52, cy: 56.25, rx: 1.05, ry: 1.05, intensity: 0.7 },
  { cx: 60.28, cy: 57.58, rx: 1.05, ry: 1.05, intensity: 0.68 },
  { cx: 61.63, cy: 59.08, rx: 1.1, ry: 1.1, intensity: 0.72 },
  { cx: 36.14, cy: 54.7, rx: 0.9, ry: 0.9, intensity: 0.65 },
  { cx: 35.71, cy: 56.31, rx: 1.0, ry: 1.0, intensity: 0.68 },
  { cx: 37.48, cy: 56.25, rx: 1.05, ry: 1.05, intensity: 0.7 },
];

/** Cheek / tone regions (front viewBox); pair with {@link AURA_SKIN_SPOTS_FRONT}. */
export const AURA_SKIN_REGION_PATHS = [
  "M 46.19 57.03 L 51.22 57.32 L 49.07 53.76 L 48.19 54.15 L 47.75 56.1 Z",
  "M 39.36 57.28 L 39.94 59.38 L 46.63 59.38 L 47.8 55.52 L 44.53 56.84 L 44.58 55.32 L 41.6 55.22 Z",
  "M 59.81 57.47 L 56.4 54.25 L 53.52 55.08 L 55.22 56.64 L 53.32 57.28 L 53.61 59.38 L 59.08 59.38 Z",
  "M 44.7 47.9 L 49.8 43.6 L 55.1 47.9 L 53.85 60.2 L 49.7 64.35 L 45.85 60.2 Z",
  "M 40.25 64.85 Q 49.5 61.9 59.55 64.8 Q 55.55 69.4 44.3 69.2 Z",
] as const;

/** Deck + Aura skin tab: spot radii are in ~1.0 viewBox units. */
export const AURA_SKIN_SPOT_DISPLAY_SCALE = 4.2;

/** Per-angle CV spots (rx≈0.25 units) need extra scale to match {@link AURA_SKIN_SPOT_DISPLAY_SCALE}. */
export const AURA_LEGACY_SPOT_DISPLAY_SCALE = 16.8;

export const ANALYSIS_FACE_LAYERS: AnalysisAnnotationLayer[] = [
  {
    id: "skin",
    label: "Skin quality",
    paths: [],
    spots: [],
    strokes: [],
    callout: { x: 72, y: 39 },
  },
  {
    id: "volume",
    label: "Structure",
    paths: [
      "M 36.74 47.84 L 43.49 44.81 L 47.87 49.35 L 45.48 57.41 L 39.52 58.92 Z",
      "M 62.97 47.84 L 56.21 44.81 L 51.84 49.35 L 54.23 57.41 L 60.19 58.92 Z",
      "M 41.11 65.98 L 46.67 68.5 L 53.03 68.5 L 58.6 65.98 L 55.42 71.02 L 44.29 71.02 Z",
    ],
    spots: [],
    strokes: [],
    callout: { x: 34, y: 52 },
  },
  {
    id: "expression",
    label: "Expression",
    paths: [],
    spots: [],
    strokes: [
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
    callout: { x: 50, y: 31 },
  },
];
