import { useEffect, useRef, useState, useCallback, useMemo, type ReactNode } from "react";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import {
  ADDITIONAL_AI_MIRROR_REGIONS,
  AI_MIRROR_REGIONS,
  cheekRegionPolygon,
  foreheadRegionPolygon,
  noseRegionPolygon,
  polygonFromLandmarkIndices,
} from "../postVisitBlueprint/aiMirrorRegions";
import {
  getEffectiveHighlightedRegionIds,
  hasMirrorAnnotationHighlights,
} from "../postVisitBlueprint/AiMirrorCanvas";
import { getFaceLandmarker } from "../../utils/faceLandmarker";
import {
  FACE3D_LANDMARK_DISPLAY_MAX_DELTA,
  face3dTimelineKey,
  face3dTimelineTimeFromKey,
  getFace3dLandmarkCache,
  pruneFace3dLandmarkCaches,
  quantizeFace3dTimelineTime,
  resolveLandmarksForTimeKey,
} from "../../utils/face3dLandmarkCache";
import {
  avoidMirrorViewportOverlay,
  MIRROR_ANNOTATION_THEME,
  mirrorViewportOverlaySafeBottom,
} from "../../constants/mirrorAnnotationTheme";
import {
  clampMirrorCalloutBoxToCanvas,
  fitMirrorCalloutLabel,
  mirrorRegionLabelFont,
  mirrorRegionLabelFontSize,
  prepareMirrorAnnotationCanvas,
  layoutMirrorRegionCallouts,
  snapMirrorLabelTextPosition,
  type MirrorRegionCalloutInput,
} from "../../utils/mirrorAnnotationCanvas";
import { resolveMirrorCalloutLabel } from "../../utils/mirrorCalloutLabels";
import { mirrorRegionVisibleAtHeadPose } from "../../utils/mirrorRegionProfileVisibility";
import {
  clampViewportZoom,
  VIEWPORT_MAX_ZOOM,
  VIEWPORT_MIN_ZOOM,
  wheelZoomFactor,
  zoomViewportAboutPoint,
} from "../../utils/mirrorViewportZoomMath";
import "./Face3DViewer.css";

const DEFAULT_VIDEO_W = 1024;
const DEFAULT_VIDEO_H = 976;
const MAX_DISPLAY_DIM = 1024;
/** Turntable export: -65° (start) → 0° nose-front (mid) → +65° (end). */
const MAX_YAW_DEG = 65;
const DEG_PER_PX = (2 * MAX_YAW_DEG) / 380;
/** Throttle live video seeks while scrubbing — avoids decoder stutter. */
const SCRUB_VIDEO_SEEK_MS = 28;
const AUTO_SPEED = 22;
const MIN_ZOOM = VIEWPORT_MIN_ZOOM;
const MAX_ZOOM = VIEWPORT_MAX_ZOOM;
const ANNOTATION_DETECT_MAX_DIM = 512;
/**
 * Shared timeline for decoded turntable frames + MediaPipe landmarks.
 * Using one bucket rate prevents overlay drift when scrubbing (was 60fps video vs 30fps landmarks).
 */
/** Prefetch ±N buckets around interactive requests (scrub / playback). */
const LANDMARK_DETECT_NEIGHBOR_SPAN = 4;
/** Max pending landmark keys (prevents memory / seek storms). */
const LANDMARK_QUEUE_MAX = 32;
/** MediaPipe jobs per idle slice — yields to the main thread between batches. */
const LANDMARK_BATCH_MAX = 4;
/** GPU frame bitmaps kept in cache.  220 covers a full ~6 s turntable at 30 fps. */
const FRAME_CACHE_MAX = 220;
interface Face3DViewerProps {
  videoUrl: string;
  /** When true the video is a forward+reversed ping-pong: the player loops it forward and the face oscillates. */
  pingPong?: boolean;
  autoRotate: boolean;
  /** External yaw control in degrees (-65 = left end, 0 = front, +65 = right end). */
  controlledYawDeg?: number;
  /** External turntable timeline control (0 = first frame, 1 = final frame). */
  controlledTimeRatio?: number;
  controlledTimeAnimationMs?: number;
  onTimeRatioChange?: (ratio: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  showAnnotations?: boolean;
  highlightTerms?: string[];
  highlightedAnnotationRegionIds?: string[];
  /** Analysis issue names per mirror region (overrides generic region titles). */
  calloutLabelsByRegionId?: Record<string, string>;
  showHint?: boolean;
  /** Start zoomed in (default 1). Applied once when the video first loads. */
  initialZoom?: number;
  /** Initial vertical pan in pixels (negative = shift content up, revealing lower face). */
  initialPanY?: number;
  /** Optional overlay rendered inside the zoom/pan layer (tracks zoom with the video). */
  overlay?: ReactNode;
  /** Ink / markup above diagnostic overlays (tracks zoom with the video). */
  drawOverlay?: ReactNode;
  /** Receives the zoom layer root for annotation export layout measurement. */
  annotateMeasureRootRef?: (el: HTMLElement | null) => void;
  /** Opacity for the video/canvas media layer (0–1). Useful when an overlay replaces the video at anchor angles. */
  mediaOpacity?: number;
  /** When false, wheel scroll passes through to the page instead of zooming. */
  wheelZoomEnabled?: boolean;
}

function clampYaw(yawDeg: number): number {
  return Math.max(-MAX_YAW_DEG, Math.min(MAX_YAW_DEG, yawDeg));
}

/** Timeline position for nose-front (yaw 0°). */
function frontVideoTime(duration: number, pingPong = false): number {
  return yawToVideoTime(0, duration, pingPong);
}

/** For ping-pong video: map backward-half time (T/2…T) to its equivalent forward-half time (0…T/2). */
function pingPongNorm(t: number, duration: number): number {
  const half = duration / 2;
  return t > half ? duration - t : t;
}

/** Map yaw to the forward-half timeline position (ping-pong) or full timeline (normal). */
function yawToVideoTime(yawDeg: number, duration: number, pingPong = false): number {
  if (!duration || !isFinite(duration)) return 0;
  const clamped = clampYaw(yawDeg);
  const halfDur = pingPong ? duration / 2 : duration;
  return ((clamped + MAX_YAW_DEG) / (2 * MAX_YAW_DEG)) * halfDur;
}

/** Inverse of {@link yawToVideoTime}. Handles both halves of a ping-pong video. */
function videoTimeToYaw(t: number, duration: number, pingPong = false): number {
  if (!duration || !isFinite(duration)) return 0;
  const lt = pingPong ? pingPongNorm(t, duration) : t;
  const halfDur = pingPong ? duration / 2 : duration;
  return (lt / halfDur) * (2 * MAX_YAW_DEG) - MAX_YAW_DEG;
}

/** Match {@link AUTO_SPEED} (deg/s) via native playbackRate. */
function computeAutoPlaybackRate(duration: number, pingPong = false): number {
  const halfDur = pingPong ? duration / 2 : duration;
  return (AUTO_SPEED * halfDur) / (2 * MAX_YAW_DEG);
}

const SCRUB_SEEK_EPS = 0.02;
/** Tighter threshold while dragging so scrub RAF can keep up. */
const SCRUB_SEEK_EPS_DRAG = 0.006;
const END_TIME_EPS = 0.03;
/** Capture frames at quarter resolution so the full turntable fits in one cache pass.
 *  At 1024×976 source, 0.25× ≈ 256×244 ≈ 250 KB/frame × 220 frames ≈ 55 MB.
 *  This prevents backward-cache seeks (which stall near the front view). */
const FRAME_CACHE_SCALE = 0.25;
function seekVideoToTime(
  video: HTMLVideoElement,
  target: number,
  eps = SCRUB_SEEK_EPS,
  useFastSeek = true,
): void {
  if (Math.abs(video.currentTime - target) < eps) return;
  const fast = (video as HTMLVideoElement & { fastSeek?: (t: number) => void }).fastSeek;
  if (useFastSeek && typeof fast === "function") {
    try {
      fast.call(video, target);
      return;
    } catch {
      /* fall through */
    }
  }
  video.currentTime = target;
}

function seekVideoPrecisely(video: HTMLVideoElement, target: number, eps = SCRUB_SEEK_EPS): void {
  seekVideoToTime(video, target, eps, false);
}

function safeSetPlaybackRate(video: HTMLVideoElement, rate: number): boolean {
  try {
    video.playbackRate = rate;
    return true;
  } catch {
    // Reverse playback (-1) is unsupported in many browsers; callers fall back to frame cache.
    return false;
  }
}

function idle(): Promise<void> {
  return new Promise((resolve) => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(() => resolve(), { timeout: 80 });
    } else {
      globalThis.setTimeout(resolve, 0);
    }
  });
}

function fitDisplaySize(video: HTMLVideoElement): { w: number; h: number } {
  const sourceW = video.videoWidth || DEFAULT_VIDEO_W;
  const sourceH = video.videoHeight || DEFAULT_VIDEO_H;
  const scale = Math.min(1, MAX_DISPLAY_DIM / Math.max(sourceW, sourceH));
  return {
    w: Math.max(1, Math.round(sourceW * scale)),
    h: Math.max(1, Math.round(sourceH * scale)),
  };
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

function faceScalePixels(landmarks: NormalizedLandmark[], width: number, height: number): number {
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

function pointBetween(a: { x: number; y: number }, b: { x: number; y: number }, t: number): { x: number; y: number } {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function stripAroundPolyline(points: { x: number; y: number }[], widthPx: number): { x: number; y: number }[] {
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
    [61, 91, 84, 17, 314, 321, 291, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172],
    width,
    height,
  );
}

function annotationRegionPolygon(
  regionId: string,
  indices: number[],
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
): { x: number; y: number }[] {
  if (!mirrorRegionVisibleAtHeadPose(regionId, landmarks, width, height)) {
    return [];
  }
  if (regionId === "rLeftUnderEye") return underEyeRegion(landmarks, width, height, "left");
  if (regionId === "rRightUnderEye") return underEyeRegion(landmarks, width, height, "right");
  if (regionId === "rLeftNasolabialFold") return nasolabialFoldRegion(landmarks, width, height, "left");
  if (regionId === "rRightNasolabialFold") return nasolabialFoldRegion(landmarks, width, height, "right");
  if (regionId === "rLeftMarionetteLine") return marionetteLineRegion(landmarks, width, height, "left");
  if (regionId === "rRightMarionetteLine") return marionetteLineRegion(landmarks, width, height, "right");
  if (regionId === "rLowerFace") return lowerFaceRegion(landmarks, width, height);
  if (regionId === "rForehead") {
    return foreheadRegionPolygon(landmarks, width, height);
  }
  if (regionId === "rNose") {
    return noseRegionPolygon(landmarks, width, height);
  }
  if (regionId === "rLeftCheek") {
    return cheekRegionPolygon(landmarks, width, height, "left");
  }
  if (regionId === "rRightCheek") {
    return cheekRegionPolygon(landmarks, width, height, "right");
  }
  return polygonFromLandmarkIndices(landmarks, indices, width, height);
}

/** Draw facial landmark annotations from cached MediaPipe landmarks.
 *  zoomLevel/panXPx are the current viewer zoom so label badges stay inside
 *  the visible viewport even when the canvas is cropped by CSS scale. */
function renderAnnotationOverlay(
  overlayCanvas: HTMLCanvasElement,
  logicalW: number,
  logicalH: number,
  landmarks: NormalizedLandmark[],
  highlightTerms: string[],
  manualHighlightedRegionIds: string[],
  zoomLevel = 1,
  panXPx = 0,
  calloutLabelsByRegionId?: Record<string, string>,
): void {
  const ctx = prepareMirrorAnnotationCanvas(overlayCanvas, logicalW, logicalH, zoomLevel);
  if (!ctx) return;
  const w = logicalW;
  const h = logicalH;
  ctx.clearRect(0, 0, w, h);
  if (!landmarks?.length) return;

  const highlightedRegions = getEffectiveHighlightedRegionIds(
    highlightTerms,
    manualHighlightedRegionIds,
  );
  if (highlightedRegions.size === 0) return;

  const renderRegions = [
    ...AI_MIRROR_REGIONS.filter((region) => highlightedRegions.has(region.id)),
    ...ADDITIONAL_AI_MIRROR_REGIONS.filter((region) => highlightedRegions.has(region.id)),
  ];

  for (const { id, indices } of renderRegions) {
    const poly = annotationRegionPolygon(id, indices, landmarks, w, h);
    if (poly.length < 3) continue;
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
    ctx.closePath();
    ctx.fillStyle = MIRROR_ANNOTATION_THEME.regionFill;
    ctx.fill();
    ctx.strokeStyle = MIRROR_ANNOTATION_THEME.regionStroke;
    ctx.lineWidth = Math.max(1.2, Math.min(w, h) * 0.002);
    ctx.stroke();
  }

  {
    ctx.save();
    const minDim = Math.min(w, h);
    const fs = mirrorRegionLabelFontSize(minDim);
    ctx.font = mirrorRegionLabelFont(minDim);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const seen = new Set<string>();
    const calloutInputs: MirrorRegionCalloutInput[] = [];
    const cropFraction = Math.max(0, (1 - 1 / zoomLevel) / 2);
    const leftInset = Math.ceil(cropFraction * w - panXPx / zoomLevel) + 10;
    const rightInset = Math.ceil(cropFraction * w + panXPx / zoomLevel) + 10;
    const mg = 8;
    const maxCalloutBoxWidth = Math.max(
      80,
      Math.min(w - leftInset - rightInset - mg * 2, w * 0.5),
    );

    for (const { id, indices } of renderRegions) {
      if (!highlightedRegions.has(id)) continue;
      const label = resolveMirrorCalloutLabel(id, calloutLabelsByRegionId);
      if (seen.has(label)) continue;
      seen.add(label);
      const poly = annotationRegionPolygon(id, indices, landmarks, w, h);
      if (poly.length < 1) continue;
      const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length;
      const cy = poly.reduce((s, p) => s + p.y, 0) / poly.length;
      const padX = 8;
      const padY = 5;
      const fitted = fitMirrorCalloutLabel(
        ctx,
        label,
        maxCalloutBoxWidth,
        padX,
      );
      calloutInputs.push({
        key: id,
        label: fitted.label,
        anchorX: cx,
        anchorY: cy,
        boxWidth: fitted.boxWidth,
        boxHeight: fs + padY * 2,
      });
    }

    const overlaySafeBottom = mirrorViewportOverlaySafeBottom();

    const layouts = layoutMirrorRegionCallouts(calloutInputs, {
      canvasWidth: w,
      canvasHeight: h,
      margin: mg,
      yMinLeft: Math.max(mg, overlaySafeBottom),
      leftInset,
      rightInset,
      marginSideMode: "opposite-from-anchor",
    });

    for (const box of layouts) {
      let { x: bx, y: by } = box;
      ({ x: bx, y: by } = avoidMirrorViewportOverlay(
        box.marginSide,
        bx,
        by,
        box.boxWidth,
        box.boxHeight,
        h,
      ));
      ({ x: bx, y: by } = clampMirrorCalloutBoxToCanvas(
        bx,
        by,
        box.boxWidth,
        box.boxHeight,
        w,
        h,
        mg,
      ));
      const ax = box.marginSide === "left" ? bx + box.boxWidth : bx;
      const ay = by + box.boxHeight / 2;
      ctx.strokeStyle = MIRROR_ANNOTATION_THEME.connector;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(box.anchorX, box.anchorY);
      ctx.stroke();
      ctx.fillStyle = MIRROR_ANNOTATION_THEME.labelFill;
      ctx.strokeStyle = MIRROR_ANNOTATION_THEME.labelStroke;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(bx, by, box.boxWidth, box.boxHeight, 999);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = MIRROR_ANNOTATION_THEME.labelText;
      const textPos = snapMirrorLabelTextPosition(bx + 8, ay);
      ctx.fillText(box.label, textPos.x, textPos.y);
    }
    ctx.restore();
  }
}

function pruneFrameCache(cache: Map<number, ImageBitmap>, keepNearKey: number): void {
  if (cache.size <= FRAME_CACHE_MAX) return;
  const keys = [...cache.keys()].sort(
    (a, b) => Math.abs(a - keepNearKey) - Math.abs(b - keepNearKey),
  );
  for (let i = FRAME_CACHE_MAX; i < keys.length; i++) {
    const k = keys[i]!;
    cache.get(k)?.close();
    cache.delete(k);
  }
}

function isTurntablePlaybackActive(video: HTMLVideoElement | null, dragging: boolean): boolean {
  if (dragging) return true;
  return Boolean(video && !video.paused);
}

function clearAnnotationOverlay(overlayCanvas: HTMLCanvasElement | null): void {
  if (!overlayCanvas) return;
  const ctx = overlayCanvas.getContext("2d");
  ctx?.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
}

export default function Face3DViewer({
  videoUrl,
  pingPong = false,
  autoRotate,
  controlledYawDeg,
  controlledTimeRatio,
  controlledTimeAnimationMs = 0,
  onTimeRatioChange,
  onDragStart,
  onDragEnd,
  showAnnotations = false,
  highlightTerms = [],
  highlightedAnnotationRegionIds = [],
  calloutLabelsByRegionId,
  showHint = true,
  initialZoom = 1,
  initialPanY = 0,
  overlay,
  drawOverlay,
  annotateMeasureRootRef,
  mediaOpacity = 1,
  wheelZoomEnabled = true,
}: Face3DViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const zoomLayerRef = useRef<HTMLDivElement | null>(null);
  const setZoomLayerRef = useCallback(
    (el: HTMLDivElement | null) => {
      zoomLayerRef.current = el;
      annotateMeasureRootRef?.(el);
    },
    [annotateMeasureRootRef],
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const annotationDetectCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameCacheRef = useRef<Map<number, ImageBitmap>>(new Map());
  const autoRotateStartedForUrlRef = useRef<string | null>(null);
  const pingPongRef = useRef(pingPong);
  const frameCapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentTimeKeyRef = useRef(0);
  const yawRef = useRef(0);
  const controlledTimeAnimationRef = useRef(0);
  const landmarksByTimeKeyRef = useRef(getFace3dLandmarkCache(videoUrl));
  const pendingLandmarkKeysRef = useRef<Set<number>>(new Set());
  const landmarkKeyQueueRef = useRef<number[]>([]);
  const deferredLandmarkKeysRef = useRef<Set<number>>(new Set());
  const processingLandmarkQueueRef = useRef(false);
  const landmarkProcessorGenRef = useRef(0);
  const lastCaptureKeyRef = useRef(-9999);
  const enqueueLandmarkDetectionRef = useRef<
    ((key: number, opts?: { expandNeighbors?: boolean }) => void) | null
  >(null);

  const autoRotateRef = useRef(autoRotate);
  const autoDirRef = useRef<1 | -1>(1);
  const draggingRef = useRef(false);
  const panningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const scrubTargetYawRef = useRef(0);
  const scrubDisplayYawRef = useRef(0);
  const lastScrubSeekAtRef = useRef(0);
  const autoPlaybackControllerRef = useRef<{
    start: (preferredDir?: 1 | -1) => void;
    stop: () => void;
  } | null>(null);
  const videoRetryCountRef = useRef(0);
  const videoRetryTimerRef = useRef<number | null>(null);
  const highlightTermsRef = useRef(highlightTerms);
  const showAnnotationsRef = useRef(showAnnotations);
  const highlightedAnnotationRegionIdsRef = useRef(highlightedAnnotationRegionIds);
  const calloutLabelsByRegionIdRef = useRef(calloutLabelsByRegionId);
  const onTimeRatioChangeRef = useRef(onTimeRatioChange);
  const onDragStartRef = useRef(onDragStart);
  const onDragEndRef = useRef(onDragEnd);
  const controlledTimeRatioRef = useRef(controlledTimeRatio);
  const controlledYawDegRef = useRef(controlledYawDeg);

  useEffect(() => {
    controlledTimeRatioRef.current = controlledTimeRatio;
  }, [controlledTimeRatio]);

  useEffect(() => {
    controlledYawDegRef.current = controlledYawDeg;
  }, [controlledYawDeg]);

  const [zoom, setZoom] = useState(1);
  const [videoError, setVideoError] = useState<string | null>(null);
  /** Hide the turntable until the first seek to front (avoids a flash of frame 0 / profile). */
  const [videoPositioned, setVideoPositioned] = useState(false);
  const zoomRef = useRef(1);
  const panXRef = useRef(0);
  const panYRef = useRef(0);
  // Minimum zoom tracks initialZoom so users can't scroll below the default crop.
  const minZoomRef = useRef(Math.max(MIN_ZOOM, initialZoom));

  const [displaySize, setDisplaySize] = useState({ w: DEFAULT_VIDEO_W, h: DEFAULT_VIDEO_H });
  const displaySizeRef = useRef(displaySize);
  useEffect(() => {
    displaySizeRef.current = displaySize;
  }, [displaySize]);

  /**
   * crossOrigin on public GCS MP4s requires bucket CORS headers. Without them,
   * the browser blocks media load entirely. Keep playback first; canvas-backed
   * landmark capture gracefully skips when the video is cross-origin tainted.
   */
  const videoCrossOrigin = useMemo((): "" | "anonymous" | undefined => {
    if (typeof window === "undefined") return undefined;
    try {
      const resolved = new URL(videoUrl, window.location.href);
      if (resolved.hostname === "storage.googleapis.com") return undefined;
      return resolved.origin !== window.location.origin ? "anonymous" : undefined;
    } catch {
      return undefined;
    }
  }, [videoUrl]);

  const renderCachedAnnotations = useCallback(() => {
    if (!showAnnotationsRef.current || !overlayRef.current) return;
    if (
      !hasMirrorAnnotationHighlights(
        highlightTermsRef.current,
        highlightedAnnotationRegionIdsRef.current,
      )
    ) {
      clearAnnotationOverlay(overlayRef.current);
      return;
    }
    const landmarks = resolveLandmarksForTimeKey(
      landmarksByTimeKeyRef.current,
      currentTimeKeyRef.current,
      FACE3D_LANDMARK_DISPLAY_MAX_DELTA,
    );
    if (landmarks?.length) {
      const { w, h } = displaySizeRef.current;
      renderAnnotationOverlay(
        overlayRef.current,
        w,
        h,
        landmarks,
        highlightTermsRef.current,
        highlightedAnnotationRegionIdsRef.current,
        zoomRef.current,
        panXRef.current,
        calloutLabelsByRegionIdRef.current,
      );
    } else {
      clearAnnotationOverlay(overlayRef.current);
    }
  }, []);

  // Hides the frame-cache canvas; video is always the active display layer now.
  const setActiveVideo = useCallback(() => {
    const dc = displayCanvasRef.current;
    if (dc) dc.style.opacity = "0";
  }, []);

  const logicalVideoTime = useCallback((): number | null => {
    const video = videoRef.current;
    if (!video?.duration || !isFinite(video.duration)) return null;
    const t = Math.max(0, Math.min(video.duration, video.currentTime));
    return pingPongRef.current ? pingPongNorm(t, video.duration) : t;
  }, []);

  const drawVideoFrameToDisplay = useCallback(() => {
    const video = videoRef.current;
    const dc = displayCanvasRef.current;
    if (!video || !dc || video.readyState < 2) return false;
    const ctx = dc.getContext("2d");
    if (!ctx) return false;
    try {
      ctx.clearRect(0, 0, dc.width, dc.height);
      ctx.drawImage(video, 0, 0, dc.width, dc.height);
      return true;
    } catch {
      return false;
    }
  }, []);

  const activeCaptureVideo = useCallback((): HTMLVideoElement | null => {
    const video = videoRef.current;
    return video && video.readyState >= 2 ? video : null;
  }, []);

  const captureFrameBitmapAtKey = useCallback((key: number): Promise<void> => {
    const video = activeCaptureVideo();
    if (!video) return Promise.resolve();
    if (frameCacheRef.current.has(key)) return Promise.resolve();
    const srcW = video.videoWidth || DEFAULT_VIDEO_W;
    const srcH = video.videoHeight || DEFAULT_VIDEO_H;
    const capW = Math.max(1, Math.round(srcW * FRAME_CACHE_SCALE));
    const capH = Math.max(1, Math.round(srcH * FRAME_CACHE_SCALE));
    let cap = frameCapCanvasRef.current;
    if (!cap || cap.width !== capW || cap.height !== capH) {
      cap = document.createElement("canvas");
      cap.width = capW;
      cap.height = capH;
      frameCapCanvasRef.current = cap;
    }
    const ctx = cap.getContext("2d");
    if (!ctx) return Promise.resolve();
    try {
      ctx.drawImage(video, 0, 0, capW, capH);
    } catch {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      void createImageBitmap(cap!).then((bitmap) => {
        const prior = frameCacheRef.current.get(key);
        if (prior) prior.close();
        frameCacheRef.current.set(key, bitmap);
        pruneFrameCache(frameCacheRef.current, currentTimeKeyRef.current);
        resolve();
      });
    });
  }, [activeCaptureVideo]);

  useEffect(() => {
    pruneFace3dLandmarkCaches(videoUrl);
    landmarksByTimeKeyRef.current = getFace3dLandmarkCache(videoUrl);
    pendingLandmarkKeysRef.current.clear();
    landmarkKeyQueueRef.current = [];
    deferredLandmarkKeysRef.current.clear();
    processingLandmarkQueueRef.current = false;
    landmarkProcessorGenRef.current += 1;
    lastCaptureKeyRef.current = -9999;
    yawRef.current = 0;
    currentTimeKeyRef.current = 0;
    setVideoPositioned(false);
    setVideoError(null);
    // Release GPU-backed ImageBitmaps from the previous video
    for (const bmp of frameCacheRef.current.values()) bmp.close();
    frameCacheRef.current.clear();
    autoRotateStartedForUrlRef.current = null;
    videoRetryCountRef.current = 0;
    if (videoRetryTimerRef.current !== null) {
      window.clearTimeout(videoRetryTimerRef.current);
      videoRetryTimerRef.current = null;
    }
  }, [videoUrl]);

  useEffect(
    () => () => {
      if (videoRetryTimerRef.current !== null) {
        window.clearTimeout(videoRetryTimerRef.current);
        videoRetryTimerRef.current = null;
      }
    },
    [],
  );

  useEffect(() => { autoRotateRef.current = autoRotate; }, [autoRotate]);
  useEffect(() => { pingPongRef.current = pingPong; }, [pingPong]);
  useEffect(() => { onTimeRatioChangeRef.current = onTimeRatioChange; }, [onTimeRatioChange]);
  useEffect(() => { onDragStartRef.current = onDragStart; }, [onDragStart]);
  useEffect(() => { onDragEndRef.current = onDragEnd; }, [onDragEnd]);
  useEffect(() => { minZoomRef.current = Math.max(MIN_ZOOM, initialZoom); }, [initialZoom]);
  useEffect(() => {
    highlightTermsRef.current = highlightTerms;
    renderCachedAnnotations();
  }, [highlightTerms, renderCachedAnnotations]);
  useEffect(() => { showAnnotationsRef.current = showAnnotations; }, [showAnnotations]);
  useEffect(() => {
    highlightedAnnotationRegionIdsRef.current = highlightedAnnotationRegionIds;
    renderCachedAnnotations();
  }, [highlightedAnnotationRegionIds, renderCachedAnnotations]);
  useEffect(() => {
    calloutLabelsByRegionIdRef.current = calloutLabelsByRegionId;
    renderCachedAnnotations();
  }, [calloutLabelsByRegionId, renderCachedAnnotations]);

  useEffect(() => {
    if (!showAnnotations) {
      clearAnnotationOverlay(overlayRef.current);
      return;
    }
    renderCachedAnnotations();
  }, [showAnnotations, renderCachedAnnotations]);

  const handleVideoReady = useCallback(() => {
    videoRetryCountRef.current = 0;
    if (videoRetryTimerRef.current !== null) {
      window.clearTimeout(videoRetryTimerRef.current);
      videoRetryTimerRef.current = null;
    }
    setVideoError(null);
  }, []);

  const handleVideoError = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      setVideoError("3D preview video could not be loaded.");
      return;
    }
    if (video.readyState >= 1) {
      setVideoError(null);
      return;
    }
    if (videoRetryCountRef.current < 2) {
      videoRetryCountRef.current += 1;
      if (videoRetryTimerRef.current !== null) {
        window.clearTimeout(videoRetryTimerRef.current);
      }
      videoRetryTimerRef.current = window.setTimeout(() => {
        videoRetryTimerRef.current = null;
        const currentVideo = videoRef.current;
        if (!currentVideo || currentVideo.readyState >= 1) return;
        currentVideo.load();
      }, 250 * videoRetryCountRef.current);
      return;
    }
    setVideoError("3D preview video could not be loaded.");
  }, []);

  const trimLandmarkQueue = useCallback(() => {
    const queue = landmarkKeyQueueRef.current;
    if (queue.length <= LANDMARK_QUEUE_MAX) return;
    const current = currentTimeKeyRef.current;
    const near = queue.filter((k) => Math.abs(k - current) <= 4);
    const far = queue.filter((k) => Math.abs(k - current) > 4);
    landmarkKeyQueueRef.current = [
      ...near,
      ...far.slice(-(LANDMARK_QUEUE_MAX - near.length)),
    ];
  }, []);

  const drainDeferredLandmarkKeys = useCallback((maxKeys = 12) => {
    if (isTurntablePlaybackActive(videoRef.current, draggingRef.current)) {
      return;
    }
    const current = currentTimeKeyRef.current;
    const sorted = [...deferredLandmarkKeysRef.current].sort(
      (a, b) => Math.abs(a - current) - Math.abs(b - current),
    );
    deferredLandmarkKeysRef.current.clear();
    for (const k of sorted.slice(0, maxKeys)) {
      if (
        landmarksByTimeKeyRef.current.has(k) ||
        pendingLandmarkKeysRef.current.has(k) ||
        landmarkKeyQueueRef.current.includes(k)
      ) {
        continue;
      }
      pendingLandmarkKeysRef.current.add(k);
      landmarkKeyQueueRef.current.push(k);
    }
    trimLandmarkQueue();
  }, [trimLandmarkQueue]);

  const processLandmarkQueueRef = useRef<() => Promise<void>>(async () => {});

  const scheduleLandmarkProcessor = useCallback((delayMs = 0) => {
    const run = () => {
      if (processingLandmarkQueueRef.current) return;
      void processLandmarkQueueRef.current();
    };
    if (delayMs > 0) window.setTimeout(run, delayMs);
    else run();
  }, []);

  const processLandmarkQueue = useCallback(async () => {
    if (processingLandmarkQueueRef.current) return;
    if (landmarkKeyQueueRef.current.length === 0) return;
    processingLandmarkQueueRef.current = true;
    const gen = landmarkProcessorGenRef.current;

    try {
      const landmarker = await getFaceLandmarker();
      let processed = 0;
      let seekedThisBatch = false;

      while (
        processed < LANDMARK_BATCH_MAX &&
        landmarkKeyQueueRef.current.length > 0 &&
        gen === landmarkProcessorGenRef.current
      ) {
        const nextKey = landmarkKeyQueueRef.current.shift()!;
        const v = videoRef.current;
        const targetTime = face3dTimelineTimeFromKey(nextKey);
        const playbackTime = targetTime;
        const timeTolerance = draggingRef.current ? 0.02 : 0.04;
        const cachedFrame = frameCacheRef.current.get(nextKey);
        const playbackActive = isTurntablePlaybackActive(v, draggingRef.current);

        if (!v || v.readyState < 2) {
          pendingLandmarkKeysRef.current.delete(nextKey);
          processed++;
          await idle();
          continue;
        }

        if (!cachedFrame) {
          const isInteractive =
            autoRotateRef.current || draggingRef.current;
          if (playbackActive) {
            deferredLandmarkKeysRef.current.add(nextKey);
            pendingLandmarkKeysRef.current.delete(nextKey);
            processed++;
            await idle();
            continue;
          }
          if (!isInteractive) {
            pendingLandmarkKeysRef.current.delete(nextKey);
            processed++;
            await idle();
            continue;
          }
          if (
            !seekedThisBatch &&
            !draggingRef.current &&
            Math.abs(v.currentTime - playbackTime) > timeTolerance
          ) {
            seekVideoPrecisely(v, targetTime, SCRUB_SEEK_EPS_DRAG);
            pendingLandmarkKeysRef.current.delete(nextKey);
            landmarkKeyQueueRef.current.unshift(nextKey);
            seekedThisBatch = true;
            processed++;
            break;
          }
        }

        const srcW = v.videoWidth || DEFAULT_VIDEO_W;
        const srcH = v.videoHeight || DEFAULT_VIDEO_H;
        const scale = Math.min(1, ANNOTATION_DETECT_MAX_DIM / Math.max(srcW, srcH));
        const w = Math.max(1, Math.round(srcW * scale));
        const h = Math.max(1, Math.round(srcH * scale));
        const canvas =
          annotationDetectCanvasRef.current ?? document.createElement("canvas");
        annotationDetectCanvasRef.current = canvas;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          pendingLandmarkKeysRef.current.delete(nextKey);
          processed++;
          await idle();
          continue;
        }
        ctx.clearRect(0, 0, w, h);

        try {
          if (cachedFrame) {
            ctx.drawImage(cachedFrame, 0, 0, w, h);
          } else {
            ctx.drawImage(v, 0, 0, w, h);
          }
        } catch {
          pendingLandmarkKeysRef.current.delete(nextKey);
          processed++;
          await idle();
          continue;
        }

        const result = landmarker.detect(canvas);
        const landmarks = result.faceLandmarks?.[0] ?? null;
        landmarksByTimeKeyRef.current.set(nextKey, landmarks);
        pendingLandmarkKeysRef.current.delete(nextKey);
        if (
          showAnnotationsRef.current &&
          landmarks?.length &&
          Math.abs(nextKey - currentTimeKeyRef.current) <=
            FACE3D_LANDMARK_DISPLAY_MAX_DELTA
        ) {
          renderCachedAnnotations();
        }
        processed++;
        await idle();
      }
    } catch (err) {
      console.warn("[Face3DViewer] annotation landmark cache:", err);
    } finally {
      processingLandmarkQueueRef.current = false;
      if (gen === landmarkProcessorGenRef.current) {
        const playbackActive = isTurntablePlaybackActive(
          videoRef.current,
          draggingRef.current,
        );
        const hasQueue = landmarkKeyQueueRef.current.length > 0;
        const hasDeferred = deferredLandmarkKeysRef.current.size > 0;
        if (hasQueue || hasDeferred) {
          if (!playbackActive && hasDeferred) drainDeferredLandmarkKeys();
          scheduleLandmarkProcessor(playbackActive ? 150 : 24);
        }
      }
    }
  }, [drainDeferredLandmarkKeys, renderCachedAnnotations, scheduleLandmarkProcessor]);

  processLandmarkQueueRef.current = processLandmarkQueue;

  const drainDeferredLandmarkKeysRef = useRef(drainDeferredLandmarkKeys);
  const scheduleLandmarkProcessorRef = useRef(scheduleLandmarkProcessor);
  useEffect(() => {
    drainDeferredLandmarkKeysRef.current = drainDeferredLandmarkKeys;
    scheduleLandmarkProcessorRef.current = scheduleLandmarkProcessor;
  }, [drainDeferredLandmarkKeys, scheduleLandmarkProcessor]);

  const enqueueLandmarkDetection = useCallback((
    key: number,
    opts?: { expandNeighbors?: boolean },
  ) => {
    if (
      !hasMirrorAnnotationHighlights(
        highlightTermsRef.current,
        highlightedAnnotationRegionIdsRef.current,
      )
    ) {
      return;
    }
    const cache = landmarksByTimeKeyRef.current;
    const expandNeighbors =
      opts?.expandNeighbors ??
      (autoRotateRef.current || draggingRef.current);
    const neighborSpan = expandNeighbors ? LANDMARK_DETECT_NEIGHBOR_SPAN : 0;
    const toQueue: number[] = [];
    for (let d = -neighborSpan; d <= neighborSpan; d++) {
      const k = key + d;
      if (
        k >= 0 &&
        !cache.has(k) &&
        !pendingLandmarkKeysRef.current.has(k) &&
        !landmarkKeyQueueRef.current.includes(k) &&
        !deferredLandmarkKeysRef.current.has(k) &&
        !toQueue.includes(k)
      ) {
        toQueue.push(k);
      }
    }
    if (toQueue.length === 0) return;
    const queue = landmarkKeyQueueRef.current;
    const priority = toQueue.filter((k) => k === key);
    const neighbors = toQueue.filter((k) => k !== key);
    for (const k of [...priority, ...neighbors]) {
      pendingLandmarkKeysRef.current.add(k);
      queue.push(k);
    }
    trimLandmarkQueue();
    scheduleLandmarkProcessor();
  }, [scheduleLandmarkProcessor, trimLandmarkQueue]);

  enqueueLandmarkDetectionRef.current = enqueueLandmarkDetection;

  const captureCurrentFrame = useCallback(() => {
    const video = activeCaptureVideo();
    if (!video) return;
    const key = face3dTimelineKey(logicalVideoTime() ?? video.currentTime);
    if (key === lastCaptureKeyRef.current) return;
    lastCaptureKeyRef.current = key;
    void captureFrameBitmapAtKey(key).then(() => {
      if (
        hasMirrorAnnotationHighlights(
          highlightTermsRef.current,
          highlightedAnnotationRegionIdsRef.current,
        )
      ) {
        enqueueLandmarkDetection(key, {
          expandNeighbors: autoRotateRef.current,
        });
      }
    });
  }, [activeCaptureVideo, captureFrameBitmapAtKey, logicalVideoTime, enqueueLandmarkDetection]);

  const requestLandmarksForTimeKey = useCallback(
    (key: number) => {
      enqueueLandmarkDetection(key, {
        expandNeighbors: autoRotateRef.current || draggingRef.current,
      });
    },
    [enqueueLandmarkDetection],
  );

  const syncYawFromVideo = useCallback((opts?: { queueLandmarks?: boolean }) => {
    const video = videoRef.current;
    if (!video || !isFinite(video.duration) || video.duration <= 0) return;
    const lt = logicalVideoTime();
    if (lt === null) return;
    const pp = pingPongRef.current;
    const halfDur = pp ? video.duration / 2 : video.duration;
    yawRef.current = videoTimeToYaw(lt, video.duration, pp);
    if (controlledTimeRatioRef.current === undefined) {
      onTimeRatioChangeRef.current?.(Math.max(0, Math.min(1, lt / halfDur)));
    }
    const key = face3dTimelineKey(lt);
    const keyChanged = key !== currentTimeKeyRef.current;
    if (keyChanged) currentTimeKeyRef.current = key;
    renderCachedAnnotations();
    if (opts?.queueLandmarks === false || !keyChanged) return;
    requestLandmarksForTimeKey(key);
  }, [logicalVideoTime, renderCachedAnnotations, requestLandmarksForTimeKey]);

  const primeLandmarkCacheForHighlights = useCallback(() => {
    if (
      !showAnnotationsRef.current ||
      !hasMirrorAnnotationHighlights(
        highlightTermsRef.current,
        highlightedAnnotationRegionIdsRef.current,
      )
    ) {
      return;
    }
    const video = videoRef.current;
    if (!video?.duration || !isFinite(video.duration)) return;
    const current = currentTimeKeyRef.current;
    // Do not seek across the turntable just because an issue highlight was
    // toggled. Seeking here moves the visible video while auto-rotate is off,
    // which makes the face appear to rotate/glitch. Queue only the current
    // frame; nearby frames can be detected later during real scrub/rotation.
    void captureFrameBitmapAtKey(current).then(() => {
      enqueueLandmarkDetection(current, { expandNeighbors: false });
    });
  }, [captureFrameBitmapAtKey, enqueueLandmarkDetection]);

  useEffect(() => {
    if (
      showAnnotations &&
      hasMirrorAnnotationHighlights(highlightTerms, highlightedAnnotationRegionIds)
    ) {
      primeLandmarkCacheForHighlights();
      return;
    }
    landmarkProcessorGenRef.current += 1;
    landmarkKeyQueueRef.current = [];
    deferredLandmarkKeysRef.current.clear();
    pendingLandmarkKeysRef.current.clear();
    processingLandmarkQueueRef.current = false;
  }, [
    highlightTerms,
    highlightedAnnotationRegionIds,
    showAnnotations,
    videoUrl,
    primeLandmarkCacheForHighlights,
  ]);

  // Auto-rotate: loop the ping-pong video forward so the face oscillates naturally.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    let cancelled = false;
    let autoRaf = 0;
    let autoMode: 'idle' | 'forward' | 'manual-pingpong' = 'idle';
    let initialZoomApplied = false;
    const initZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, initialZoom));
    const initPanY = initialPanY;
    let rvfcId = 0;

    clearAnnotationOverlay(overlayRef.current);

    const stopAuto = () => {
      if (autoRaf) { cancelAnimationFrame(autoRaf); autoRaf = 0; }
      video.pause();
      video.loop = false;
      safeSetPlaybackRate(video, 1);
      const dc = displayCanvasRef.current;
      if (dc) dc.style.opacity = '0';
      autoMode = 'idle';
    };

    // Ping-pong encoded videos can loop forward. One-way videos need code-driven
    // reverse scrubbing because browser reverse playback is not reliable.
    const startForward = (preferredDir: 1 | -1 = 1) => {
      if (autoRaf) { cancelAnimationFrame(autoRaf); autoRaf = 0; }
      const d = video.duration;
      if (!d || !isFinite(d)) return;
      const pp = pingPongRef.current;
      const rate = computeAutoPlaybackRate(d, pp);
      autoDirRef.current = preferredDir;

      if (!pp) {
        autoMode = 'manual-pingpong';
        video.loop = false;
        video.pause();
        safeSetPlaybackRate(video, 1);
        const dc = displayCanvasRef.current;
        if (dc) dc.style.opacity = '0';

        let lastTs = 0;
        const step = (ts: number) => {
          autoRaf = 0;
          if (cancelled || !autoRotateRef.current || draggingRef.current || autoMode !== 'manual-pingpong') return;
          if (!lastTs) lastTs = ts;
          const dt = Math.min(0.05, Math.max(0, (ts - lastTs) / 1000));
          lastTs = ts;
          let next = video.currentTime + autoDirRef.current * rate * dt;
          const minT = END_TIME_EPS;
          const maxT = d - END_TIME_EPS;
          if (next >= maxT) {
            next = maxT;
            video.currentTime = next;
            syncYawFromVideo();
            captureCurrentFrame();
            return;
          }
          if (next <= minT) {
            next = minT;
            video.currentTime = next;
            syncYawFromVideo();
            captureCurrentFrame();
            return;
          }
          if (Math.abs(video.currentTime - next) > SCRUB_SEEK_EPS_DRAG) {
            video.currentTime = next;
          }
          syncYawFromVideo();
          captureCurrentFrame();
          autoRaf = requestAnimationFrame(step);
        };

        const targetStart = yawToVideoTime(
          preferredDir === -1 ? MAX_YAW_DEG : yawRef.current,
          d,
          false,
        );
        const begin = () => {
          if (cancelled || autoMode !== 'manual-pingpong') return;
          autoRaf = requestAnimationFrame(step);
        };
        if (Math.abs(video.currentTime - targetStart) > SCRUB_SEEK_EPS) {
          video.currentTime = targetStart;
          video.addEventListener('seeked', begin, { once: true });
        } else {
          begin();
        }
        return;
      }

      autoMode = 'forward';
      video.loop = false;

      const doPlay = () => {
        if (cancelled || autoMode !== 'forward') return;
        const dc = displayCanvasRef.current;
        safeSetPlaybackRate(video, rate);
        void video.play().catch(() => {});
        if (dc) dc.style.opacity = '0';
        const halfEnd = pp ? d / 2 - END_TIME_EPS : d - END_TIME_EPS;
        const monitor = () => {
          autoRaf = 0;
          if (cancelled || !autoRotateRef.current || draggingRef.current || autoMode !== 'forward') return;
          const lt = logicalVideoTime() ?? video.currentTime;
          if (lt >= halfEnd) {
            video.pause();
            video.currentTime = halfEnd;
            syncYawFromVideo();
            return;
          }
          syncYawFromVideo();
          autoRaf = requestAnimationFrame(monitor);
        };
        autoRaf = requestAnimationFrame(monitor);
      };

      // Seek to forward-half start for the current yaw.
      const targetStart = yawToVideoTime(yawRef.current, d, pingPongRef.current);
      if (Math.abs(video.currentTime - targetStart) > SCRUB_SEEK_EPS) {
        video.pause();
        video.currentTime = targetStart;
        video.addEventListener('seeked', doPlay, { once: true });
      } else {
        doPlay();
      }
    };

    // "Start backward" = begin oscillation from the right extreme.
    const startBackward = () => {
      autoDirRef.current = -1;
      yawRef.current = MAX_YAW_DEG;
      startForward(-1);
    };

    const stopAutoPlayback = () => stopAuto();

    const startAutoPlayback = (preferredDir: 1 | -1 = autoDirRef.current) => {
      if (cancelled || draggingRef.current || !autoRotateRef.current) return;
      if (!video.duration || !isFinite(video.duration)) return;
      if (preferredDir === -1) startBackward();
      else startForward();
    };

    const onLoaded = () => {
      if (cancelled) return;
      const size = fitDisplaySize(video);
      displaySizeRef.current = size;
      setDisplaySize((prev) =>
        prev.w === size.w && prev.h === size.h ? prev : size,
      );
      if (!initialZoomApplied && (initZoom !== 1 || initPanY !== 0)) {
        initialZoomApplied = true;
        zoomRef.current = initZoom;
        panYRef.current = initPanY;
        panXRef.current = 0;
        if (zoomLayerRef.current) {
          zoomLayerRef.current.style.transform = `translate3d(0px, ${initPanY}px, 0) scale(${initZoom})`;
        }
        setZoom(initZoom);
      }
      renderCachedAnnotations();
      stopAuto();
      const pp = pingPongRef.current;
      const halfDur = pp ? video.duration / 2 : video.duration;
      const initialControlledRatio = controlledTimeRatioRef.current;
      const controlledTime =
        initialControlledRatio === undefined
          ? null
          : Math.max(0, Math.min(1, initialControlledRatio)) * halfDur;
      const initialYaw =
        controlledTime !== null
          ? videoTimeToYaw(controlledTime, video.duration, pp)
          : clampYaw(controlledYawDegRef.current ?? 0);
      yawRef.current = initialYaw;
      const target =
        controlledTime ?? frontVideoTime(video.duration, pp);
      const beginAutoRotate = () => {
        if (cancelled || !autoRotateRef.current) return;
        autoRotateStartedForUrlRef.current = videoUrl;
        autoDirRef.current = 1;
        yawRef.current = 0;
        const d = video.duration;
        if (!d || !isFinite(d)) {
          startAutoPlayback(1);
          return;
        }
        const frontTime = frontVideoTime(d, pingPongRef.current);
        const go = () => startAutoPlayback(1);
        if (Math.abs(video.currentTime - frontTime) < SCRUB_SEEK_EPS) go();
        else {
          video.currentTime = frontTime;
          video.addEventListener("seeked", go, { once: true });
        }
      };

      const afterSeek = () => {
        if (cancelled) return;
        syncYawFromVideo({ queueLandmarks: false });
        video.loop = false;
        setVideoPositioned(true);
        if (autoRotateRef.current) {
          beginAutoRotate();
          return;
        }
        setActiveVideo();
        const v = videoRef.current;
        if (v?.paused) {
          // iOS/Safari may not paint a frame until play() has run at least once.
          void v.play()
            .then(() => {
              v.pause();
            })
            .catch(() => {});
        }
      };
      if (Math.abs(video.currentTime - target) < SCRUB_SEEK_EPS) afterSeek();
      else {
        seekVideoToTime(video, target);
        video.addEventListener('seeked', afterSeek, { once: true });
      }
    };

    const onSeeked = () => {
      if (cancelled) return;
      syncYawFromVideo({ queueLandmarks: !draggingRef.current });
      if (!draggingRef.current) {
        drainDeferredLandmarkKeysRef.current();
        scheduleLandmarkProcessorRef.current(32);
      }
    };

    // Playback stops at profile limits; do not restart from ended.
    const onEnded = () => {
      if (cancelled || draggingRef.current) return;
      video.pause();
    };

    const scheduleVideoFrameSync = () => {
      const rvfc = (
        video as HTMLVideoElement & {
          requestVideoFrameCallback?: (cb: () => void) => number;
          cancelVideoFrameCallback?: (id: number) => void;
        }
      ).requestVideoFrameCallback;
      if (typeof rvfc !== 'function' || cancelled || video.paused) return;
      const id = rvfc.call(video, () => {
        rvfcId = 0;
        if (!cancelled && !draggingRef.current && !video.paused) {
          syncYawFromVideo();
          captureCurrentFrame();
        }
        scheduleVideoFrameSync();
      });
      if (typeof id === 'number') rvfcId = id;
    };

    const onPlay = () => {
      if (cancelled) return;
      scheduleVideoFrameSync();
    };

    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('ended', onEnded);
    video.addEventListener('play', onPlay);
    autoPlaybackControllerRef.current = {
      start: startAutoPlayback,
      stop: stopAutoPlayback,
    };
    if (video.readyState >= 1) onLoaded();

    return () => {
      cancelled = true;
      if (autoPlaybackControllerRef.current?.stop === stopAutoPlayback) {
        autoPlaybackControllerRef.current = null;
      }
      const cancelRvfc = (
        video as HTMLVideoElement & { cancelVideoFrameCallback?: (id: number) => void }
      ).cancelVideoFrameCallback;
      if (rvfcId && typeof cancelRvfc === 'function') cancelRvfc.call(video, rvfcId);
      stopAuto();
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('play', onPlay);
      video.pause();
    };
  }, [
    videoUrl,
    initialZoom,
    initialPanY,
    syncYawFromVideo,
    drawVideoFrameToDisplay,
    captureCurrentFrame,
    captureFrameBitmapAtKey,
    renderCachedAnnotations,
    requestLandmarksForTimeKey,
    setActiveVideo,
  ]);

  useEffect(() => {
    const video = videoRef.current;
    if (!autoRotate) {
      autoRotateStartedForUrlRef.current = null;
      autoPlaybackControllerRef.current?.stop();
      if (video) {
        video.pause();
        safeSetPlaybackRate(video, 1);
      }
      return;
    }
    if (!video?.duration || !isFinite(video.duration)) return;
    // Cold start is handled in the metadata effect (prime cache, then begin).
    if (autoRotateStartedForUrlRef.current === videoUrl) return;

    const startFromFront = () => {
      autoRotateStartedForUrlRef.current = videoUrl;
      autoDirRef.current = 1;
      yawRef.current = 0;
      const frontTime = frontVideoTime(video.duration, pingPongRef.current);
      const go = () => autoPlaybackControllerRef.current?.start(1);
      if (Math.abs(video.currentTime - frontTime) < SCRUB_SEEK_EPS) go();
      else {
        video.currentTime = frontTime;
        video.addEventListener("seeked", go, { once: true });
      }
    };

    startFromFront();
  }, [autoRotate, videoUrl]);

  useEffect(() => {
    if (controlledYawDeg === undefined) return;
    if (controlledTimeRatio !== undefined) return;
    const video = videoRef.current;
    if (!video || !video.duration || !isFinite(video.duration)) return;
    const yaw = clampYaw(controlledYawDeg);
    const target = yawToVideoTime(yaw, video.duration, pingPongRef.current);
    const quantizedTime = quantizeFace3dTimelineTime(target);
    autoPlaybackControllerRef.current?.stop();
    setActiveVideo();
    video.pause();
    safeSetPlaybackRate(video, 1);
    if (displayCanvasRef.current) displayCanvasRef.current.style.opacity = "0";
    draggingRef.current = false;
    yawRef.current = yaw;
    scrubTargetYawRef.current = yaw;
    currentTimeKeyRef.current = face3dTimelineKey(quantizedTime);
    seekVideoPrecisely(video, quantizedTime, SCRUB_SEEK_EPS_DRAG);
    renderCachedAnnotations();
    requestLandmarksForTimeKey(currentTimeKeyRef.current);
  }, [controlledYawDeg, controlledTimeRatio, renderCachedAnnotations, requestLandmarksForTimeKey, setActiveVideo]);

  useEffect(() => {
    if (controlledTimeRatio === undefined) return;
    if (draggingRef.current || panningRef.current) return;
    const video = videoRef.current;
    if (!video || !video.duration || !isFinite(video.duration)) return;
    const pp = pingPongRef.current;
    const halfDur = pp ? video.duration / 2 : video.duration;
    const ratio = Math.max(0, Math.min(1, controlledTimeRatio));
    const currentRatio = (() => {
      const lt = logicalVideoTime();
      if (lt === null || halfDur <= 0) return null;
      return Math.max(0, Math.min(1, lt / halfDur));
    })();
    if (currentRatio !== null && Math.abs(currentRatio - ratio) < 0.002) return;
    const target = ratio * halfDur;
    autoPlaybackControllerRef.current?.stop();
    setActiveVideo();
    video.pause();
    safeSetPlaybackRate(video, 1);
    draggingRef.current = false;
    if (controlledTimeAnimationRef.current) {
      cancelAnimationFrame(controlledTimeAnimationRef.current);
      controlledTimeAnimationRef.current = 0;
    }

    const start = logicalVideoTime() ?? 0;
    const shortestDelta = target - start;
    const ms = Math.max(0, controlledTimeAnimationMs);
    const setFrame = (logicalT: number, queueLandmarks = true) => {
      const clamped = Math.max(0, Math.min(halfDur, logicalT));
      yawRef.current = videoTimeToYaw(clamped, halfDur);
      onTimeRatioChangeRef.current?.(Math.max(0, Math.min(1, clamped / halfDur)));
      scrubTargetYawRef.current = yawRef.current;
      currentTimeKeyRef.current = face3dTimelineKey(clamped);
      const quantized = quantizeFace3dTimelineTime(clamped);
      const dc = displayCanvasRef.current;
      if (dc) dc.style.opacity = "0";
      seekVideoPrecisely(video, quantized, SCRUB_SEEK_EPS_DRAG);
      renderCachedAnnotations();
      if (queueLandmarks) {
        requestLandmarksForTimeKey(currentTimeKeyRef.current);
      }
    };

    if (ms === 0 || Math.abs(shortestDelta) < 0.03) {
      setFrame(target, true);
      if (!autoRotateRef.current) {
        setActiveVideo();
        const v = videoRef.current;
        if (v?.paused) {
          void v.play()
            .then(() => {
              v.pause();
            })
            .catch(() => {});
        }
      }
      return;
    }

    const started = performance.now();
    const easeInOut = (t: number) => {
      const x = Math.max(0, Math.min(1, t));
      return x * x * x * (x * (x * 6 - 15) + 10);
    };
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / ms);
      const finished = progress === 1;
      setFrame(start + shortestDelta * easeInOut(progress), finished);
      if (!finished) {
        controlledTimeAnimationRef.current = requestAnimationFrame(tick);
      } else {
        controlledTimeAnimationRef.current = 0;
      }
    };
    controlledTimeAnimationRef.current = requestAnimationFrame(tick);

    return () => {
      if (controlledTimeAnimationRef.current) {
        cancelAnimationFrame(controlledTimeAnimationRef.current);
        controlledTimeAnimationRef.current = 0;
      }
    };
  }, [controlledTimeRatio, controlledTimeAnimationMs, logicalVideoTime, renderCachedAnnotations, requestLandmarksForTimeKey, setActiveVideo]);

  /** Apply CSS transform directly — no React re-render during drag/scroll. */
  const applyTransform = useCallback((px: number, py: number, z: number) => {
    if (zoomLayerRef.current) {
      const x = Math.round(px);
      const y = Math.round(py);
      zoomLayerRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${z})`;
    }
  }, []);

  const publishScrubRatio = useCallback((yaw: number) => {
    onTimeRatioChangeRef.current?.(
      Math.max(0, Math.min(1, (yaw + MAX_YAW_DEG) / (2 * MAX_YAW_DEG))),
    );
  }, []);

  /** Drag scrub: keep the MP4 visible and seek the decoder (no canvas frame stepping). */
  const applyScrubYaw = useCallback(
    (yaw: number) => {
      const video = videoRef.current;
      if (!video?.duration) return;
      yawRef.current = yaw;
      const quantizedTime = quantizeFace3dTimelineTime(
        yawToVideoTime(yaw, video.duration, pingPongRef.current),
      );
      const targetKey = face3dTimelineKey(quantizedTime);
      const dc = displayCanvasRef.current;
      if (dc) dc.style.opacity = "0";

      const now = performance.now();
      if (
        now - lastScrubSeekAtRef.current >= SCRUB_VIDEO_SEEK_MS &&
        Math.abs(video.currentTime - quantizedTime) > SCRUB_SEEK_EPS_DRAG
      ) {
        seekVideoToTime(video, quantizedTime, SCRUB_SEEK_EPS_DRAG, true);
        lastScrubSeekAtRef.current = now;
      }

      if (targetKey !== currentTimeKeyRef.current) {
        currentTimeKeyRef.current = targetKey;
        renderCachedAnnotations();
      }
    },
    [renderCachedAnnotations],
  );

  // ── Wheel-to-zoom ─────────────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !wheelZoomEnabled) return;
    const onWheel = (e: WheelEvent) => {
      const factor = wheelZoomFactor(e.deltaY, e.deltaMode);
      const oldZoom = zoomRef.current;
      const newZoom = clampViewportZoom(oldZoom * factor, minZoomRef.current);
      if (Math.abs(newZoom - oldZoom) < 0.0001) return;
      e.preventDefault();
      const rect = viewer.getBoundingClientRect();
      const cx = e.clientX - (rect.left + rect.width / 2);
      const cy = e.clientY - (rect.top + rect.height / 2);
      const { panX: newPanX, panY: newPanY } = zoomViewportAboutPoint({
        oldZoom,
        newZoom,
        panX: panXRef.current,
        panY: panYRef.current,
        focalX: cx,
        focalY: cy,
      });
      zoomRef.current = newZoom;
      panXRef.current = newPanX;
      panYRef.current = newPanY;
      applyTransform(newPanX, newPanY, newZoom);
      setZoom(newZoom);
      renderCachedAnnotations();
    };
    viewer.addEventListener("wheel", onWheel, { passive: false });
    return () => viewer.removeEventListener("wheel", onWheel);
  }, [applyTransform, renderCachedAnnotations, wheelZoomEnabled]);

  const resetZoom = useCallback(() => {
    const z = minZoomRef.current;
    const py = initialPanY;
    zoomRef.current = z;
    panXRef.current = 0;
    panYRef.current = py;
    applyTransform(0, py, z);
    setZoom(z);
    renderCachedAnnotations();
  }, [applyTransform, initialPanY, renderCachedAnnotations]);

  // ── Pointer: zoomed → pan; otherwise smooth turntable scrub via frame cache ─
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    let dragStartX = 0;
    let dragStartYaw = 0;
    let resumeAutoAfterPan = false;
    let resumeAutoAfterScrub = false;

    const flushPanTransform = () => {
      applyTransform(panXRef.current, panYRef.current, zoomRef.current);
    };

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest("button, a, input, summary")) return;
      // Drawing mode: the annotate SVG owns pointer interaction; never rotate while inking.
      if ((e.target as HTMLElement).closest(".avf-drawing-layer--active")) return;
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      viewer!.style.cursor = "grabbing";

      if (zoomRef.current > minZoomRef.current + 0.02) {
        panningRef.current = true;
        viewer!.classList.add("face3d-viewer--panning");
        resumeAutoAfterPan = autoRotateRef.current;
        if (resumeAutoAfterPan) {
          autoPlaybackControllerRef.current?.stop();
        }
        videoRef.current?.pause();
        panStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          panX: panXRef.current,
          panY: panYRef.current,
        };
        return;
      }

      draggingRef.current = true;
      onDragStartRef.current?.();
      dragStartX = e.clientX;
      dragStartYaw = yawRef.current;
      scrubTargetYawRef.current = dragStartYaw;
      scrubDisplayYawRef.current = dragStartYaw;
      lastScrubSeekAtRef.current = 0;
      resumeAutoAfterScrub = autoRotateRef.current;
      if (resumeAutoAfterScrub) {
        autoPlaybackControllerRef.current?.stop();
      }
      const video = videoRef.current;
      if (video) {
        setActiveVideo();
        video.pause();
        safeSetPlaybackRate(video, 1);
        if (displayCanvasRef.current) displayCanvasRef.current.style.opacity = "0";
      }
    }

    function onPointerMove(e: PointerEvent) {
      if (panningRef.current) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        panXRef.current = panStartRef.current.panX + dx;
        panYRef.current = panStartRef.current.panY + dy;
        flushPanTransform();
        return;
      }
      if (!draggingRef.current) return;
      const dx = e.clientX - dragStartX;
      const rawYaw = dragStartYaw - dx * DEG_PER_PX;
      const yaw = clampYaw(rawYaw);
      // Re-anchor to the clamp boundary so dragging back immediately reverses direction.
      if (rawYaw !== yaw) {
        dragStartX = e.clientX;
        dragStartYaw = yaw;
      }
      scrubTargetYawRef.current = yaw;
      scrubDisplayYawRef.current = yaw;
      publishScrubRatio(yaw);
      applyScrubYaw(yaw);
    }

    function endPointer(e: PointerEvent) {
      if (panningRef.current) {
        panningRef.current = false;
        viewer!.classList.remove("face3d-viewer--panning");
        flushPanTransform();
        requestAnimationFrame(() => renderCachedAnnotations());
        viewer!.style.cursor = zoomRef.current > minZoomRef.current ? "grab" : "";
        if (resumeAutoAfterPan && videoRef.current?.duration) {
          autoPlaybackControllerRef.current?.start(autoDirRef.current);
        }
        resumeAutoAfterPan = false;
        try {
          viewer!.releasePointerCapture(e.pointerId);
        } catch {
          /* already released */
        }
        return;
      }
      if (!draggingRef.current) return;
      draggingRef.current = false;
      onDragEndRef.current?.();
      scrubDisplayYawRef.current = scrubTargetYawRef.current;
      publishScrubRatio(scrubTargetYawRef.current);
      if (displayCanvasRef.current) displayCanvasRef.current.style.opacity = "0";
      viewer!.style.cursor = zoomRef.current > minZoomRef.current ? "grab" : "";
      const video = videoRef.current;
      if (video?.duration) {
        const target = yawToVideoTime(
          scrubTargetYawRef.current,
          video.duration,
          pingPongRef.current,
        );
        seekVideoPrecisely(video, quantizeFace3dTimelineTime(target), SCRUB_SEEK_EPS_DRAG);
        yawRef.current = scrubTargetYawRef.current;
        syncYawFromVideo({ queueLandmarks: true });
        drainDeferredLandmarkKeysRef.current();
        scheduleLandmarkProcessorRef.current(32);
      }
      autoDirRef.current = yawRef.current >= 0 ? 1 : -1;
      if (resumeAutoAfterScrub && video?.duration) {
        autoPlaybackControllerRef.current?.start(autoDirRef.current);
      }
      resumeAutoAfterScrub = false;
      try {
        viewer!.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    }

    viewer.addEventListener("pointerdown", onPointerDown);
    viewer.addEventListener("pointermove", onPointerMove);
    viewer.addEventListener("pointerup", endPointer);
    viewer.addEventListener("pointercancel", endPointer);

    return () => {
      viewer.removeEventListener("pointerdown", onPointerDown);
      viewer.removeEventListener("pointermove", onPointerMove);
      viewer.removeEventListener("pointerup", endPointer);
      viewer.removeEventListener("pointercancel", endPointer);
    };
  }, [
    videoUrl,
    syncYawFromVideo,
    applyTransform,
    applyScrubYaw,
    publishScrubRatio,
    renderCachedAnnotations,
    setActiveVideo,
  ]);

  return (
    <div className="face3d-wrap">
      <div
        ref={viewerRef}
        className="face3d-viewer"
        style={{ aspectRatio: `${displaySize.w} / ${displaySize.h}` }}
        onDoubleClick={zoom > 1 ? resetZoom : undefined}
        title={zoom > 1 ? "Double-click to reset zoom" : undefined}
      >
        <div ref={setZoomLayerRef} className="face3d-zoom-layer">
          <div
            className={`face3d-media-layer${videoPositioned ? "" : " face3d-media-layer--pending"}`}
            style={{ opacity: mediaOpacity }}
          >
            <video
              ref={videoRef}
              src={videoUrl}
              width={displaySize.w}
              height={displaySize.h}
              preload="auto"
              muted
              playsInline
              crossOrigin={videoCrossOrigin}
              className="face3d-display"
              onLoadedMetadata={handleVideoReady}
              onCanPlay={handleVideoReady}
              onError={handleVideoError}
            />
            <canvas
              ref={displayCanvasRef}
              className="face3d-frame-cache-layer"
              width={displaySize.w}
              height={displaySize.h}
              aria-hidden
            />
          </div>
          {overlay ? <div className="face3d-content-overlay">{overlay}</div> : null}
          {showAnnotations && (
            <canvas
              ref={overlayRef}
              className="face3d-annotation-overlay"
              aria-hidden
            />
          )}
          {drawOverlay ? <div className="face3d-draw-overlay">{drawOverlay}</div> : null}
          {videoError ? <div className="face3d-error">{videoError}</div> : null}
        </div>
      </div>
      {showHint ? (
        <p className="face3d-hint">
          {zoom > 1
            ? "Drag to pan · Scroll to zoom · Double-click to reset zoom"
            : "Drag to rotate · Scroll to zoom"}
        </p>
      ) : null}
    </div>
  );
}
