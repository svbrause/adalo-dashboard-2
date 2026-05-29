import { useEffect, useRef, useState } from "react";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import {
  AI_MIRROR_REGIONS,
  cheekRegionPolygon,
  foreheadRegionPolygon,
  polygonFromLandmarkIndices,
} from "./aiMirrorRegions";
import {
  isExpiringAirtableAttachmentUrl,
  isPhotoDisplayUrlFailed,
  markPhotoDisplayUrlFailed,
  sanitizePhotoDisplayUrl,
} from "../../utils/photoLoading";
import {
  avoidMirrorViewportOverlay,
  MIRROR_ANNOTATION_THEME,
  mirrorAnnotationThemeFromAccent,
  type MirrorAnnotationTheme,
  mirrorViewportOverlaySafeBottom,
} from "../../constants/mirrorAnnotationTheme";
import {
  mirrorRegionLabelFont,
  mirrorRegionLabelFontSize,
  prepareMirrorAnnotationCanvas,
  snapMirrorLabelTextPosition,
} from "../../utils/mirrorAnnotationCanvas";
import "./AiMirrorCanvas.css";

import { getFaceLandmarker } from "../../utils/faceLandmarker";

export { getFaceLandmarker } from "../../utils/faceLandmarker";

type MirrorStatus = "loading" | "ready" | "error";
type MirrorRegion = { id: string; indices: number[] };
// Temporary QA: set true to highlight every mapped region for shape QA.
const DEBUG_HIGHLIGHT_ALL_AREAS = false;

const REGION_KEYWORDS: Record<string, string[]> = {
  rForehead: ["forehead", "brow", "frown", "glabella", "wrinkle"],
  rLeftEye: ["eye", "eyelid", "crow"],
  rRightEye: ["eye", "eyelid", "crow"],
  rNose: ["nose", "nasal", "bridge", "tip", "nostril"],
  rLeftCheek: ["cheek", "midface", "malar"],
  rRightCheek: ["cheek", "midface", "malar"],
  rLips: ["lip", "mouth", "perioral", "gummy"],
  rChin: ["chin", "jaw", "jawline", "submental", "jowl", "neck"],
  rLeftUnderEye: ["under eye", "undereye", "tear trough", "lower eyelid"],
  rRightUnderEye: ["under eye", "undereye", "tear trough", "lower eyelid"],
  rLeftNasolabialFold: ["nasolabial", "nasal fold", "smile line"],
  rRightNasolabialFold: ["nasolabial", "nasal fold", "smile line"],
  rLeftMarionetteLine: ["marionette", "oral commissure", "mouth corner"],
  rRightMarionetteLine: ["marionette", "oral commissure", "mouth corner"],
};

const REGION_DISPLAY_LABEL: Record<string, string> = {
  rForehead: "Forehead",
  rLeftEye: "Eyes",
  rRightEye: "Eyes",
  rNose: "Nose",
  rLeftCheek: "Cheeks",
  rRightCheek: "Cheeks",
  rLips: "Lips",
  rChin: "Chin/Jawline",
  rLeftUnderEye: "Under Eyes",
  rRightUnderEye: "Under Eyes",
  rLeftNasolabialFold: "Nasolabial Folds",
  rRightNasolabialFold: "Nasolabial Folds",
  rLeftMarionetteLine: "Marionette Lines",
  rRightMarionetteLine: "Marionette Lines",
  rLowerFace: "Lower Face",
};

const GRANULAR_MIRROR_REGIONS: MirrorRegion[] = [
  { id: "rLeftUnderEye", indices: [] },
  { id: "rRightUnderEye", indices: [] },
  { id: "rLeftNasolabialFold", indices: [] },
  { id: "rRightNasolabialFold", indices: [] },
  { id: "rLeftMarionetteLine", indices: [] },
  { id: "rRightMarionetteLine", indices: [] },
  // Lower face: mid-cheek → left jaw → chin → right jaw → mid-cheek
  {
    id: "rLowerFace",
    indices: [205, 187, 147, 123, 116, 117, 93, 132, 58, 172, 136, 150, 149, 148, 152, 176, 378, 365, 288, 397, 361, 340, 346, 347, 376, 411, 425, 280],
  },
];

function loadImage(url: string, useCors = true): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (useCors) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image failed to load"));
    img.src = url;
  });
}

function normalizeTerm(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Checks whether `term` appears as a whole word inside `kw`.
 * Prevents e.g. term="face" from matching kw="midface" (substring-only match).
 */
function kwContainsWholeWord(kw: string, term: string): boolean {
  if (kw === term) return true;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(kw);
}

/**
 * Stable primitive for effect deps — parents often pass a fresh `highlightTerms` array each
 * render; MediaPipe should not re-run unless the actual strings changed.
 */
function highlightTermsFingerprint(terms: readonly string[] | undefined): string {
  return [...(terms ?? [])]
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join("\u0001");
}

export function getHighlightedRegionIds(highlightTerms: string[]): Set<string> {
  if (DEBUG_HIGHLIGHT_ALL_AREAS) {
    return new Set([
      ...AI_MIRROR_REGIONS.map((r) => r.id),
      ...GRANULAR_MIRROR_REGIONS.map((r) => r.id),
    ]);
  }
  const terms = highlightTerms.map(normalizeTerm).filter(Boolean);
  if (!terms.length) return new Set();
  const highlighted = new Set<string>();

  for (const [regionId, keywords] of Object.entries(REGION_KEYWORDS)) {
    const hit = terms.some((term) =>
      keywords.some((kw) => term.includes(kw) || kwContainsWholeWord(kw, term)),
    );
    if (hit) highlighted.add(regionId);
  }
  const hasUnderEye = terms.some((t) =>
    /(?:under\s*eye|undereye|tear\s*trough|lower\s*eyelid)/i.test(t),
  );
  const hasNasolabial = terms.some((t) =>
    /(?:nasolabial|nasal\s*fold|smile\s*line)/i.test(t),
  );
  const hasMarionette = terms.some((t) =>
    /(?:marionette|oral\s*commissure|mouth\s*corner)/i.test(t),
  );
  if (hasUnderEye) {
    highlighted.delete("rLeftEye");
    highlighted.delete("rRightEye");
  }
  if (hasNasolabial) {
    highlighted.delete("rNose");
    highlighted.delete("rLeftCheek");
    highlighted.delete("rRightCheek");
  }
  if (hasMarionette) {
    highlighted.delete("rLips");
  }
  // "Lower face" gets its own dedicated region polygon.
  if (terms.some((t) => /lower\s*face/i.test(t))) {
    highlighted.add("rLowerFace");
  }
  return highlighted;
}

/** Terms + manually selected regions (2D/3D shared). */
export function getEffectiveHighlightedRegionIds(
  highlightTerms: string[],
  manualRegionIds: string[] = [],
): Set<string> {
  const highlighted = getHighlightedRegionIds(highlightTerms);
  for (const id of manualRegionIds) highlighted.add(id);
  return highlighted;
}

/** True when highlight terms or manual region ids map to at least one region. */
export function hasMirrorAnnotationHighlights(
  highlightTerms: string[],
  manualRegionIds: string[] = [],
): boolean {
  return getEffectiveHighlightedRegionIds(highlightTerms, manualRegionIds).size > 0;
}

function polygonCentroid(points: { x: number; y: number }[]): {
  x: number;
  y: number;
} {
  if (points.length === 0) return { x: 0, y: 0 };
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), {
    x: 0,
    y: 0,
  });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function averagePoint(points: { x: number; y: number }[]): {
  x: number;
  y: number;
} {
  if (points.length === 0) return { x: 0, y: 0 };
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), {
    x: 0,
    y: 0,
  });
  return { x: sum.x / points.length, y: sum.y / points.length };
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
  return Math.max(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
  );
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

function landmarkPoint(
  landmarks: NormalizedLandmark[],
  index: number,
  width: number,
  height: number,
): { x: number; y: number } | null {
  const lm = landmarks[index];
  if (!lm) return null;
  return { x: lm.x * width, y: lm.y * height };
}

function pointBetween(
  a: { x: number; y: number },
  b: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

function isLinearFeatureRegion(regionId: string): boolean {
  return (
    regionId === "rLeftNasolabialFold" ||
    regionId === "rRightNasolabialFold" ||
    regionId === "rLeftMarionetteLine" ||
    regionId === "rRightMarionetteLine"
  );
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
  const faceScale = faceScalePixels(landmarks, width, height);
  const lower = lid
    .slice()
    .reverse()
    .map((p) => ({ x: p.x, y: p.y + faceScale * 0.045 }));
  return [...lid, ...lower];
}

function nasolabialFoldLine(
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
  side: "left" | "right",
): { x: number; y: number }[] {
  const start = landmarkPoint(landmarks, side === "left" ? 98 : 327, width, height);
  const end = landmarkPoint(landmarks, side === "left" ? 61 : 291, width, height);
  if (!start || !end) return [];
  const faceScale = faceScalePixels(landmarks, width, height);
  const outward = side === "left" ? -1 : 1;
  const mid = pointBetween(start, end, 0.52);
  mid.x += outward * faceScale * 0.018;
  mid.y += faceScale * 0.01;
  return [start, mid, end];
}

function nasolabialFoldRegion(
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
  side: "left" | "right",
): { x: number; y: number }[] {
  const line = nasolabialFoldLine(landmarks, width, height, side);
  if (line.length < 2) return [];
  const faceScale = faceScalePixels(landmarks, width, height);
  return stripAroundPolyline(line, Math.max(4, faceScale * 0.012));
}

function marionetteLinePath(
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
  side: "left" | "right",
): { x: number; y: number }[] {
  const start = landmarkPoint(landmarks, side === "left" ? 61 : 291, width, height);
  const chin = landmarkPoint(landmarks, side === "left" ? 172 : 397, width, height);
  if (!start || !chin) return [];
  const faceScale = faceScalePixels(landmarks, width, height);
  const outward = side === "left" ? -1 : 1;
  const end = {
    x: start.x + outward * faceScale * 0.055,
    y: start.y + faceScale * 0.22,
  };
  const guardEnd = pointBetween(end, chin, 0.18);
  const mid = pointBetween(start, guardEnd, 0.52);
  mid.x += outward * faceScale * 0.012;
  return [start, mid, guardEnd];
}

function marionetteLineRegion(
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
  side: "left" | "right",
): { x: number; y: number }[] {
  const line = marionetteLinePath(landmarks, width, height, side);
  if (line.length < 2) return [];
  const faceScale = faceScalePixels(landmarks, width, height);
  return stripAroundPolyline(line, Math.max(4, faceScale * 0.013));
}

function softFeatureCenter(
  regionId: string,
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
): { x: number; y: number } | null {
  if (regionId === "rLeftNasolabialFold") {
    const line = nasolabialFoldLine(landmarks, width, height, "left");
    return line.length ? averagePoint(line) : null;
  }
  if (regionId === "rRightNasolabialFold") {
    const line = nasolabialFoldLine(landmarks, width, height, "right");
    return line.length ? averagePoint(line) : null;
  }
  if (regionId === "rLeftMarionetteLine") {
    const line = marionetteLinePath(landmarks, width, height, "left");
    return line.length ? averagePoint(line) : null;
  }
  if (regionId === "rRightMarionetteLine") {
    const line = marionetteLinePath(landmarks, width, height, "right");
    return line.length ? averagePoint(line) : null;
  }
  return null;
}

function drawSoftFeatureRegion(
  ctx: CanvasRenderingContext2D,
  regionId: string,
  center: { x: number; y: number },
  width: number,
  height: number,
  theme: MirrorAnnotationTheme,
): void {
  const base = Math.min(width, height);
  const isNasolabial = regionId.includes("NasolabialFold");
  const rx = Math.max(18, base * (isNasolabial ? 0.052 : 0.055));
  const ry = Math.max(24, base * (isNasolabial ? 0.095 : 0.088));
  const rotation =
    regionId.includes("Left") ? -0.18 : regionId.includes("Right") ? 0.18 : 0;

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(rotation);

  const gradient = ctx.createRadialGradient(0, 0, 1, 0, 0, Math.max(rx, ry));
  gradient.addColorStop(0, theme.softFillStart);
  gradient.addColorStop(0.58, theme.softFillMid);
  gradient.addColorStop(1, theme.softFillEnd);

  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(0, 0, rx * 0.72, ry * 0.72, 0, 0, Math.PI * 2);
  ctx.strokeStyle = theme.softStroke;
  ctx.lineWidth = Math.max(1, base * 0.0014);
  ctx.stroke();

  ctx.restore();
}

/**
 * More anatomically stable render region from MediaPipe landmarks.
 * - Cheeks: landmark-anchored ovals (avoids pac-man polygons).
 * - Forehead: clipped band above eyebrows (avoids spill into eyes/nose).
 * - Others: explicit landmark polygons.
 */
function getRenderRegionPolygon(
  regionId: string,
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
  fallbackIndices: number[],
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

  if (regionId === "rLeftCheek") {
    return cheekRegionPolygon(landmarks, width, height, "left");
  }
  if (regionId === "rRightCheek") {
    return cheekRegionPolygon(landmarks, width, height, "right");
  }

  if (regionId === "rForehead") {
    return foreheadRegionPolygon(landmarks, width, height);
  }

  return polygonFromLandmarkIndices(landmarks, fallbackIndices, width, height);
}

function drawAnnotatedFace(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  landmarks: NormalizedLandmark[],
  highlightTerms: string[],
  manualRegionIds: string[],
  logicalWidth: number,
  logicalHeight: number,
  theme: MirrorAnnotationTheme = MIRROR_ANNOTATION_THEME,
): void {
  const cw = logicalWidth;
  const ch = logicalHeight;
  ctx.clearRect(0, 0, cw, ch);
  ctx.drawImage(img, 0, 0, cw, ch);

  const highlightedRegions = getEffectiveHighlightedRegionIds(
    highlightTerms,
    manualRegionIds,
  );
  if (highlightedRegions.size === 0) return;

  const regionLabels: Array<{ label: string; x: number; y: number }> = [];

  const renderRegions: MirrorRegion[] = [
    ...AI_MIRROR_REGIONS.filter((r) => highlightedRegions.has(r.id)),
    ...GRANULAR_MIRROR_REGIONS.filter((r) => highlightedRegions.has(r.id)),
  ];

  for (const { id, indices } of renderRegions) {
    if (isLinearFeatureRegion(id) && highlightedRegions.has(id)) {
      const center = softFeatureCenter(id, landmarks, cw, ch);
      if (center) {
        drawSoftFeatureRegion(ctx, id, center, cw, ch, theme);
        regionLabels.push({
          label: REGION_DISPLAY_LABEL[id] ?? "Focus Area",
          x: center.x,
          y: center.y,
        });
      }
      continue;
    }

    const poly = getRenderRegionPolygon(id, landmarks, cw, ch, indices);
    if (poly.length < 3) continue;

    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
    ctx.closePath();
    ctx.fillStyle = theme.regionFill;
    ctx.fill();
    ctx.strokeStyle = theme.regionStroke;
    ctx.lineWidth = Math.max(1.3, Math.min(cw, ch) * 0.0022);
    ctx.stroke();

    const center = polygonCentroid(poly);
    regionLabels.push({
      label: REGION_DISPLAY_LABEL[id] ?? "Focus Area",
      x: center.x,
      y: center.y,
    });
  }

  if (regionLabels.length > 0) {
    ctx.save();
    const minDim = Math.min(cw, ch);
    const fs = mirrorRegionLabelFontSize(minDim);
    ctx.font = mirrorRegionLabelFont(minDim);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const seen = new Set<string>();
    const uniqueRows = regionLabels.filter((row) => {
      if (seen.has(row.label)) return false;
      seen.add(row.label);
      return true;
    });
    uniqueRows.sort((a, b) => a.y - b.y);

    const leftRows = uniqueRows.filter((r) => r.x < cw / 2);
    const rightRows = uniqueRows.filter((r) => r.x >= cw / 2);

    const renderCallout = (
      row: { label: string; x: number; y: number },
      side: "left" | "right",
      slotIndex: number,
      slotCount: number,
    ) => {
      const textW = ctx.measureText(row.label).width;
      const padX = 8;
      const padY = 5;
      const boxW = textW + padX * 2;
      const boxH = fs + padY * 2;
      const margin = 10;
      const overlaySafeBottom = mirrorViewportOverlaySafeBottom();
      const calloutX = side === "left" ? margin : cw - boxW - margin;
      const yMin = side === "left" ? Math.max(margin, overlaySafeBottom) : margin;
      const yMax = ch - boxH - margin;
      const targetY =
        slotCount <= 1
          ? row.y - boxH / 2
          : yMin + (slotIndex / Math.max(1, slotCount - 1)) * (yMax - yMin);
      let calloutY = Math.max(yMin, Math.min(yMax, targetY));
      let resolvedX = calloutX;
      ({ x: resolvedX, y: calloutY } = avoidMirrorViewportOverlay(
        side,
        resolvedX,
        calloutY,
        boxW,
        boxH,
        ch,
      ));
      const anchorX = side === "left" ? resolvedX + boxW : resolvedX;
      const anchorY = calloutY + boxH / 2;

      // Connector line from label box to highlighted region center.
      ctx.strokeStyle = theme.connector;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(anchorX, anchorY);
      ctx.lineTo(row.x, row.y);
      ctx.stroke();

      ctx.fillStyle = theme.labelFill;
      ctx.strokeStyle = theme.labelStroke;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(resolvedX, calloutY, boxW, boxH, 999);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = theme.labelText;
      const textPos = snapMirrorLabelTextPosition(resolvedX + padX, calloutY + boxH / 2);
      ctx.fillText(row.label, textPos.x, textPos.y);
    };

    leftRows.forEach((row, i) =>
      renderCallout(row, "left", i, leftRows.length),
    );
    rightRows.forEach((row, i) =>
      renderCallout(row, "right", i, rightRows.length),
    );
    ctx.restore();
  }
}

function highlightedRegionIdsFingerprint(ids: readonly string[] | undefined): string {
  return [...(ids ?? [])].sort().join("\u0001");
}

export interface AiMirrorCanvasProps {
  imageUrl: string;
  alt?: string;
  highlightTerms?: string[];
  /** Manually selected regions — shared with 3D turntable. */
  highlightedRegionIds?: string[];
  showAnnotations?: boolean;
  /** Treatment/chapter accent — tints region fills, strokes, and callout badges. */
  annotationColor?: string;
}

/**
 * Renders the patient photo with MediaPipe face mesh / regions (static IMAGE mode),
 * following the same landmark drawing approach as `test-live-mediapipe/index.html`.
 */
export function AiMirrorCanvas({
  imageUrl,
  alt = "Your facial analysis",
  highlightTerms = [],
  highlightedRegionIds = [],
  showAnnotations = true,
  annotationColor,
}: AiMirrorCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<MirrorStatus>("loading");
  const [fallbackImageUrl, setFallbackImageUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [layoutWidth, setLayoutWidth] = useState(0);
  const highlightFingerprint = highlightTermsFingerprint(highlightTerms);
  const manualRegionsFingerprint = highlightedRegionIdsFingerprint(highlightedRegionIds);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;

    const syncWidth = () => {
      const w = Math.round(wrap.getBoundingClientRect().width);
      if (w > 0) setLayoutWidth(w);
    };

    syncWidth();
    const ro = new ResizeObserver(syncWidth);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const annotationTheme = annotationColor
      ? mirrorAnnotationThemeFromAccent(annotationColor)
      : MIRROR_ANNOTATION_THEME;
    let cancelled = false;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !imageUrl || layoutWidth <= 0) return undefined;

    setStatus("loading");
    setFallbackImageUrl(null);
    setErrorMessage("");

    const displayUrl = sanitizePhotoDisplayUrl(imageUrl, {
      allowExpiringAirtableCdn: true,
    });
    if (!displayUrl || isPhotoDisplayUrlFailed(imageUrl)) {
      setErrorMessage(
        "This analysis photo is no longer available. Please request a new blueprint link from your clinic.",
      );
      setStatus("error");
      return undefined;
    }

    (async () => {
      try {
        const img = await loadImage(displayUrl, true);
        if (cancelled) return;

        const maxW = Math.max(280, layoutWidth);
        const scale = Math.min(1, maxW / img.naturalWidth);
        const cw = Math.max(1, Math.round(img.naturalWidth * scale));
        const ch = Math.max(1, Math.round(img.naturalHeight * scale));

        const ctx = prepareMirrorAnnotationCanvas(canvas, cw, ch);
        if (!ctx) {
          if (!cancelled) setStatus("error");
          return;
        }

        if (!showAnnotations) {
          ctx.drawImage(img, 0, 0, cw, ch);
          if (!cancelled) setStatus("ready");
          return;
        }

        const landmarker = await getFaceLandmarker();
        if (cancelled) return;

        const result = landmarker.detect(img);
        const landmarks = result.faceLandmarks?.[0];

        if (!landmarks?.length) {
          ctx.drawImage(img, 0, 0, cw, ch);
        } else {
          drawAnnotatedFace(
            ctx,
            img,
            landmarks,
            highlightTerms,
            highlightedRegionIds,
            cw,
            ch,
            annotationTheme,
          );
        }
        if (!cancelled) setStatus("ready");
      } catch {
        markPhotoDisplayUrlFailed(displayUrl);
        // Expired Airtable CDN (410) — do not retry the same URL without CORS
        if (isExpiringAirtableAttachmentUrl(displayUrl)) {
          if (!cancelled) {
            setFallbackImageUrl(null);
            setErrorMessage(
              "This analysis photo is no longer available. Please request a new blueprint link from your clinic.",
            );
            setStatus("error");
          }
          return;
        }
        try {
          const plainImg = await loadImage(displayUrl, false);
          if (cancelled) return;
          setFallbackImageUrl(plainImg.src);
          setStatus("error");
        } catch {
          if (!cancelled) {
            setFallbackImageUrl(null);
            setErrorMessage(
              "This analysis photo is no longer available. Please request a new blueprint link from your clinic.",
            );
            setStatus("error");
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- highlightTerms omitted on purpose:
    // compare via highlightFingerprint so new array refs from parents do not re-run MediaPipe.
  }, [imageUrl, highlightFingerprint, manualRegionsFingerprint, showAnnotations, annotationColor, layoutWidth]);

  return (
    <div
      ref={wrapRef}
      className={`ai-mirror-canvas-wrap${status === "loading" ? " ai-mirror-canvas-wrap--loading" : ""}`}
    >
      {status === "error" ? (
        fallbackImageUrl ? (
          <img
            className="ai-mirror-fallback-img"
            src={fallbackImageUrl}
            alt={alt}
          />
        ) : (
          <div className="ai-mirror-unavailable" role="status">
            <strong>AI Mirror unavailable</strong>
            <span>{errorMessage}</span>
          </div>
        )
      ) : (
        <canvas
          ref={canvasRef}
          className="ai-mirror-canvas"
          aria-label={alt}
          aria-hidden={status === "loading"}
        />
      )}
      {status === "loading" ? (
        <div className="ai-mirror-loading" role="status">
          <span className="ai-mirror-loading-dot" aria-hidden />
          {showAnnotations ? "Mapping facial landmarks…" : "Loading photo…"}
        </div>
      ) : null}
    </div>
  );
}
