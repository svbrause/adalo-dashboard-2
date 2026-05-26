import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import {
  ADDITIONAL_AI_MIRROR_REGIONS,
  AI_MIRROR_REGIONS,
  cheekRegionPolygon,
  foreheadRegionPolygon,
  polygonFromLandmarkIndices,
} from "../postVisitBlueprint/aiMirrorRegions";
import {
  getEffectiveHighlightedRegionIds,
  hasMirrorAnnotationHighlights,
} from "../postVisitBlueprint/AiMirrorCanvas";
import { getFaceLandmarker } from "../../utils/faceLandmarker";
import {
  FACE3D_TIMELINE_FPS,
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
  mirrorRegionLabelFont,
  mirrorRegionLabelFontSize,
  prepareMirrorAnnotationCanvas,
  snapMirrorLabelTextPosition,
} from "../../utils/mirrorAnnotationCanvas";
import "./Face3DViewer.css";

const DEFAULT_VIDEO_W = 1024;
const DEFAULT_VIDEO_H = 976;
const MAX_DISPLAY_DIM = 1024;
/** Turntable export: -65° (start) → 0° nose-front (mid) → +65° (end). */
const MAX_YAW_DEG = 65;
const DEG_PER_PX = (2 * MAX_YAW_DEG) / 380;
const AUTO_SPEED = 22;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ANNOTATION_DETECT_MAX_DIM = 512;
/**
 * Shared timeline for decoded turntable frames + MediaPipe landmarks.
 * Using one bucket rate prevents overlay drift when scrubbing (was 60fps video vs 30fps landmarks).
 */
const TIMELINE_KEY_MAX_DELTA = 1;
/** Frame bitmap lookup tolerance while scrubbing (same buckets as landmarks). */
const FRAME_CACHE_MAX_KEY_DELTA = 2;
/** Wider tolerance during reverse cache playback (forward play may skip occasional buckets). */
const FRAME_CACHE_REVERSE_MAX_KEY_DELTA = 4;
/** Step size for background cache fill (scrub / Safari fallback only). */
const FRAME_CACHE_PRIME_STEP = 2;

interface Face3DViewerProps {
  videoUrl: string;
  autoRotate: boolean;
  /** External yaw control in degrees (-65 = left end, 0 = front, +65 = right end). */
  controlledYawDeg?: number;
  /** External turntable timeline control (0 = first frame, 1 = final frame). */
  controlledTimeRatio?: number;
  controlledTimeAnimationMs?: number;
  onTimeRatioChange?: (ratio: number) => void;
  showAnnotations?: boolean;
  highlightTerms?: string[];
  highlightedAnnotationRegionIds?: string[];
  showHint?: boolean;
  /** Start zoomed in (default 1). Applied once when the video first loads. */
  initialZoom?: number;
  /** Initial vertical pan in pixels (negative = shift content up, revealing lower face). */
  initialPanY?: number;
  /** Optional overlay rendered inside the zoom/pan layer (tracks zoom with the video). */
  overlay?: ReactNode;
  /** Opacity for the video/canvas media layer (0–1). Useful when an overlay replaces the video at anchor angles. */
  mediaOpacity?: number;
}

function clampYaw(yawDeg: number): number {
  return Math.max(-MAX_YAW_DEG, Math.min(MAX_YAW_DEG, yawDeg));
}

/** Map yaw (0 = nose front) to timeline position. */
function yawToVideoTime(yawDeg: number, duration: number): number {
  if (!duration || !isFinite(duration)) return 0;
  const clamped = clampYaw(yawDeg);
  return ((clamped + MAX_YAW_DEG) / (2 * MAX_YAW_DEG)) * duration;
}

/** Inverse of {@link yawToVideoTime}. */
function videoTimeToYaw(t: number, duration: number): number {
  if (!duration || !isFinite(duration)) return 0;
  return (t / duration) * (2 * MAX_YAW_DEG) - MAX_YAW_DEG;
}

/** Match {@link AUTO_SPEED} (deg/s) via native playbackRate (sign = direction). */
function computeAutoPlaybackRate(duration: number, direction: 1 | -1 = 1): number {
  return (direction * AUTO_SPEED * duration) / (2 * MAX_YAW_DEG);
}

const SCRUB_SEEK_EPS = 0.02;
/** Tighter threshold while dragging so scrub RAF can keep up. */
const SCRUB_SEEK_EPS_DRAG = 0.006;
const END_TIME_EPS = 0.03;
/** Capture frames at half resolution to keep memory under ~30 MB for a typical turntable. */
const FRAME_CACHE_SCALE = 0.5;
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
  } catch (err) {
    console.warn("[Face3DViewer] unsupported playbackRate:", rate, err);
    return false;
  }
}

/** True when the browser will honor a negative playbackRate (smooth reverse auto-rotate). */
function detectReverseVideoPlayback(video: HTMLVideoElement): boolean {
  const prev = video.playbackRate;
  if (!safeSetPlaybackRate(video, -1)) {
    safeSetPlaybackRate(video, prev || 1);
    return false;
  }
  const ok = video.playbackRate < 0;
  safeSetPlaybackRate(video, prev || 1);
  return ok;
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

function profileYawAmount(landmarks: NormalizedLandmark[], width: number, height: number): number {
  const left = landmarkPoint(landmarks, 234, width, height);
  const right = landmarkPoint(landmarks, 454, width, height);
  const nose = landmarkPoint(landmarks, 1, width, height);
  if (!left || !right || !nose) return 0;
  const faceWidth = Math.max(1, Math.abs(right.x - left.x));
  const centerX = (left.x + right.x) / 2;
  return Math.abs(nose.x - centerX) / faceWidth;
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
  // Central lower face: lower mouth + chin/jaw. This avoids the broad cheek-to-cheek
  // shape that becomes misleading on generated turntable side views.
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
  if ((regionId === "rForehead" || regionId === "rLowerFace") && profileYawAmount(landmarks, width, height) > 0.22) {
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
    const DISPLAY: Record<string, string> = {
      rForehead: "Forehead", rLeftEye: "Eyes", rRightEye: "Eyes",
      rNose: "Nose", rLeftCheek: "Cheeks", rRightCheek: "Cheeks",
      rLips: "Lips", rChin: "Chin/Jawline",
      rLeftUnderEye: "Under Eyes", rRightUnderEye: "Under Eyes",
      rLeftNasolabialFold: "Nasolabial Folds", rRightNasolabialFold: "Nasolabial Folds",
      rLeftMarionetteLine: "Marionette Lines", rRightMarionetteLine: "Marionette Lines",
      rLowerFace: "Lower Face",
    };
    ctx.save();
    const minDim = Math.min(w, h);
    const fs = mirrorRegionLabelFontSize(minDim);
    ctx.font = mirrorRegionLabelFont(minDim);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const seen = new Set<string>();
    for (const { id, indices } of renderRegions) {
      if (!highlightedRegions.has(id)) continue;
      const label = DISPLAY[id];
      if (!label || seen.has(label)) continue;
      seen.add(label);
      const poly = annotationRegionPolygon(id, indices, landmarks, w, h);
      if (poly.length < 1) continue;
      const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length;
      const cy = poly.reduce((s, p) => s + p.y, 0) / poly.length;
      const side = cx < w / 2 ? "right" : "left";
      const tw = ctx.measureText(label).width;
      const bw = tw + 16, bh = fs + 10;
      // At zoom > 1 the canvas edges are cropped; keep labels inside the visible strip.
      const cropFraction = Math.max(0, (1 - 1 / zoomLevel) / 2);
      const leftInset = Math.ceil(cropFraction * w - panXPx / zoomLevel) + 10;
      const rightInset = Math.ceil(cropFraction * w + panXPx / zoomLevel) + 10;
      const mg = 8;
      const overlaySafeBottom = mirrorViewportOverlaySafeBottom();
      let bx = side === "left" ? Math.max(mg, leftInset) : w - bw - Math.max(mg, rightInset);
      let by = Math.max(
        side === "left" ? Math.max(mg, overlaySafeBottom) : mg,
        Math.min(h - bh - mg, cy - bh / 2),
      );
      ({ x: bx, y: by } = avoidMirrorViewportOverlay(side, bx, by, bw, bh, h));
      const ax = side === "left" ? bx + bw : bx;
      ctx.strokeStyle = MIRROR_ANNOTATION_THEME.connector;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ax, by + bh / 2); ctx.lineTo(cx, cy); ctx.stroke();
      ctx.fillStyle = MIRROR_ANNOTATION_THEME.labelFill;
      ctx.strokeStyle = MIRROR_ANNOTATION_THEME.labelStroke;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 999);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = MIRROR_ANNOTATION_THEME.labelText;
      const textPos = snapMirrorLabelTextPosition(bx + 8, by + bh / 2);
      ctx.fillText(label, textPos.x, textPos.y);
    }
    ctx.restore();
  }
}

/** Walk outward from targetKey until we find a cached ImageBitmap within maxDelta. */
function findNearestFrame(
  cache: Map<number, ImageBitmap>,
  targetKey: number,
  maxDelta: number,
): ImageBitmap | null {
  const exact = cache.get(targetKey);
  if (exact) return exact;
  for (let d = 1; d <= maxDelta; d++) {
    const a = cache.get(targetKey - d);
    if (a) return a;
    const b = cache.get(targetKey + d);
    if (b) return b;
  }
  return null;
}

function clearAnnotationOverlay(overlayCanvas: HTMLCanvasElement | null): void {
  if (!overlayCanvas) return;
  const ctx = overlayCanvas.getContext("2d");
  ctx?.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
}

export default function Face3DViewer({
  videoUrl,
  autoRotate,
  controlledYawDeg,
  controlledTimeRatio,
  controlledTimeAnimationMs = 0,
  onTimeRatioChange,
  showAnnotations = false,
  highlightTerms = [],
  highlightedAnnotationRegionIds = [],
  showHint = true,
  initialZoom = 1,
  initialPanY = 0,
  overlay,
  mediaOpacity = 1,
}: Face3DViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const zoomLayerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const annotationDetectCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameCacheRef = useRef<Map<number, ImageBitmap>>(new Map());
  const frameCachePrimedUrlRef = useRef<string | null>(null);
  const frameCachePrimePromiseRef = useRef<Promise<void> | null>(null);
  const reversePlaybackOkRef = useRef<boolean | null>(null);
  const frameCapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentTimeKeyRef = useRef(0);
  const yawRef = useRef(0);
  const controlledTimeAnimationRef = useRef(0);

  const landmarksByTimeKeyRef = useRef(getFace3dLandmarkCache(videoUrl));
  const pendingLandmarkKeysRef = useRef<Set<number>>(new Set());
  const landmarkKeyQueueRef = useRef<number[]>([]);
  const processingLandmarkQueueRef = useRef(false);

  const autoRotateRef = useRef(autoRotate);
  const autoDirRef = useRef<1 | -1>(1);
  const draggingRef = useRef(false);
  const scrubTargetYawRef = useRef(0);
  const lastDisplayedLandmarksRef = useRef<NormalizedLandmark[] | null>(null);
  const autoPlaybackControllerRef = useRef<{
    start: (preferredDir?: 1 | -1) => void;
    stop: () => void;
  } | null>(null);
  const highlightTermsRef = useRef(highlightTerms);
  const showAnnotationsRef = useRef(showAnnotations);
  const highlightedAnnotationRegionIdsRef = useRef(highlightedAnnotationRegionIds);
  const onTimeRatioChangeRef = useRef(onTimeRatioChange);

  const [zoom, setZoom] = useState(1);
  const [videoError, setVideoError] = useState<string | null>(null);
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
    const cached = resolveLandmarksForTimeKey(
      landmarksByTimeKeyRef.current,
      currentTimeKeyRef.current,
      TIMELINE_KEY_MAX_DELTA,
    );
    const landmarks = cached;
    if (landmarks?.length) {
      lastDisplayedLandmarksRef.current = landmarks;
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
      );
    } else if (draggingRef.current) {
      clearAnnotationOverlay(overlayRef.current);
    }
  }, []);

  const drawVideoFrameToDisplay = useCallback(() => {
    const video = videoRef.current;
    const dc = displayCanvasRef.current;
    if (!video || !dc || video.readyState < 2) return false;
    const ctx = dc.getContext("2d");
    if (!ctx) return false;
    ctx.clearRect(0, 0, dc.width, dc.height);
    ctx.drawImage(video, 0, 0, dc.width, dc.height);
    return true;
  }, []);

  const captureFrameBitmapAtKey = useCallback((key: number): Promise<void> => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return Promise.resolve();
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
    ctx.drawImage(video, 0, 0, capW, capH);
    return new Promise((resolve) => {
      void createImageBitmap(cap!).then((bitmap) => {
        const prior = frameCacheRef.current.get(key);
        if (prior) prior.close();
        frameCacheRef.current.set(key, bitmap);
        resolve();
      });
    });
  }, []);

  const captureCurrentFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    const key = face3dTimelineKey(video.currentTime);
    void captureFrameBitmapAtKey(key);
  }, [captureFrameBitmapAtKey]);

  const seekVideoToTimelineKey = useCallback((video: HTMLVideoElement, key: number): Promise<void> => {
    const t = quantizeFace3dTimelineTime(face3dTimelineTimeFromKey(key));
    if (Math.abs(video.currentTime - t) <= SCRUB_SEEK_EPS) return Promise.resolve();
    return new Promise((resolve) => {
      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked);
        resolve();
      };
      video.pause();
      video.addEventListener("seeked", onSeeked, { once: true });
      video.currentTime = t;
    });
  }, []);

  /** Decode every timeline bucket once so the first reverse pass never freezes on stale frames. */
  const primeTurntableFrameCache = useCallback(
    async (video: HTMLVideoElement, isCancelled: () => boolean) => {
      const d = video.duration;
      if (!d || !isFinite(d)) return;
      const maxKey = face3dTimelineKey(Math.max(0, d - END_TIME_EPS));
      for (let key = 0; key <= maxKey; key += FRAME_CACHE_PRIME_STEP) {
        if (isCancelled()) return;
        if (frameCacheRef.current.has(key)) continue;
        await seekVideoToTimelineKey(video, key);
        if (isCancelled()) return;
        await captureFrameBitmapAtKey(key);
      }
    },
    [captureFrameBitmapAtKey, seekVideoToTimelineKey],
  );

  const ensureFrameCachePrimed = useCallback(
    (video: HTMLVideoElement, isCancelled: () => boolean) => {
      if (frameCachePrimedUrlRef.current === videoUrl) return Promise.resolve();
      if (frameCachePrimePromiseRef.current) return frameCachePrimePromiseRef.current;
      const dc = displayCanvasRef.current;
      if (dc) dc.style.opacity = "0";
      video.pause();
      const promise = primeTurntableFrameCache(video, isCancelled).then(() => {
        if (!isCancelled()) frameCachePrimedUrlRef.current = videoUrl;
        frameCachePrimePromiseRef.current = null;
      });
      frameCachePrimePromiseRef.current = promise;
      return promise;
    },
    [videoUrl, primeTurntableFrameCache],
  );

  useEffect(() => {
    pruneFace3dLandmarkCaches(videoUrl);
    landmarksByTimeKeyRef.current = getFace3dLandmarkCache(videoUrl);
    pendingLandmarkKeysRef.current.clear();
    landmarkKeyQueueRef.current = [];
    processingLandmarkQueueRef.current = false;
    yawRef.current = 0;
    currentTimeKeyRef.current = 0;
    lastDisplayedLandmarksRef.current = null;
    setVideoError(null);
    // Release GPU-backed ImageBitmaps from the previous video
    for (const bmp of frameCacheRef.current.values()) bmp.close();
    frameCacheRef.current.clear();
    frameCachePrimedUrlRef.current = null;
    frameCachePrimePromiseRef.current = null;
    reversePlaybackOkRef.current = null;
  }, [videoUrl]);

  useEffect(() => { autoRotateRef.current = autoRotate; }, [autoRotate]);
  useEffect(() => { onTimeRatioChangeRef.current = onTimeRatioChange; }, [onTimeRatioChange]);
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
    if (!showAnnotations) {
      clearAnnotationOverlay(overlayRef.current);
      return;
    }
    renderCachedAnnotations();
  }, [showAnnotations, renderCachedAnnotations]);

  const enqueueLandmarkDetection = useCallback((key: number) => {
    if (
      !hasMirrorAnnotationHighlights(
        highlightTermsRef.current,
        highlightedAnnotationRegionIdsRef.current,
      )
    ) {
      return;
    }
    const cache = landmarksByTimeKeyRef.current;
    const toQueue = [key, key - 1, key + 1].filter(
      (k) =>
        k >= 0 &&
        !cache.has(k) &&
        !pendingLandmarkKeysRef.current.has(k) &&
        !landmarkKeyQueueRef.current.includes(k),
    );
    if (toQueue.length === 0) return;
    const queue = landmarkKeyQueueRef.current;
    const priority = toQueue.filter((k) => k === key);
    const neighbors = toQueue.filter((k) => k !== key);
    for (const k of [...priority, ...neighbors]) {
      pendingLandmarkKeysRef.current.add(k);
      queue.push(k);
    }
    if (queue.length > 20) {
      landmarkKeyQueueRef.current = queue.slice(-16);
    }
    if (processingLandmarkQueueRef.current) return;
    processingLandmarkQueueRef.current = true;

    void (async () => {
      try {
        const landmarker = await getFaceLandmarker();
        while (landmarkKeyQueueRef.current.length > 0) {
          const nextKey = landmarkKeyQueueRef.current.shift()!;
          const v = videoRef.current;
          const targetTime = face3dTimelineTimeFromKey(nextKey);
          const timeTolerance = draggingRef.current ? 0.02 : 0.06;
          const cachedFrame =
            frameCacheRef.current.get(nextKey) ??
            findNearestFrame(frameCacheRef.current, nextKey, TIMELINE_KEY_MAX_DELTA);

          if (!v || v.readyState < 2) {
            pendingLandmarkKeysRef.current.delete(nextKey);
            continue;
          }

          const srcW = v.videoWidth || DEFAULT_VIDEO_W;
          const srcH = v.videoHeight || DEFAULT_VIDEO_H;
          const scale = Math.min(1, ANNOTATION_DETECT_MAX_DIM / Math.max(srcW, srcH));
          const w = Math.max(1, Math.round(srcW * scale));
          const h = Math.max(1, Math.round(srcH * scale));
          const canvas = annotationDetectCanvasRef.current ?? document.createElement("canvas");
          annotationDetectCanvasRef.current = canvas;
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            pendingLandmarkKeysRef.current.delete(nextKey);
            continue;
          }
          ctx.clearRect(0, 0, w, h);

          if (cachedFrame) {
            ctx.drawImage(cachedFrame, 0, 0, w, h);
          } else {
            if (Math.abs(v.currentTime - targetTime) > timeTolerance) {
              seekVideoPrecisely(v, targetTime, SCRUB_SEEK_EPS_DRAG);
              pendingLandmarkKeysRef.current.delete(nextKey);
              landmarkKeyQueueRef.current.unshift(nextKey);
              break;
            }
            ctx.drawImage(v, 0, 0, w, h);
          }

          const result = landmarker.detect(canvas);
          const landmarks = result.faceLandmarks?.[0] ?? null;
          landmarksByTimeKeyRef.current.set(nextKey, landmarks);
          pendingLandmarkKeysRef.current.delete(nextKey);
          if (
            showAnnotationsRef.current &&
            landmarks?.length &&
            Math.abs(nextKey - currentTimeKeyRef.current) <= TIMELINE_KEY_MAX_DELTA
          ) {
            renderCachedAnnotations();
          }
          if (!draggingRef.current && landmarkKeyQueueRef.current.length > 2) {
            await idle();
          }
        }
      } catch (err) {
        console.warn("[Face3DViewer] annotation landmark cache:", err);
      } finally {
        processingLandmarkQueueRef.current = false;
        if (landmarkKeyQueueRef.current.length > 0) {
          const restartKey = landmarkKeyQueueRef.current.shift()!;
          pendingLandmarkKeysRef.current.delete(restartKey);
          enqueueLandmarkDetection(restartKey);
        }
      }
    })();
  }, [renderCachedAnnotations]);

  const requestLandmarksForTimeKey = useCallback(
    (key: number) => {
      enqueueLandmarkDetection(key);
    },
    [enqueueLandmarkDetection],
  );

  const syncYawFromVideo = useCallback((opts?: { queueLandmarks?: boolean }) => {
    const video = videoRef.current;
    if (!video || !isFinite(video.duration) || video.duration <= 0) return;
    yawRef.current = videoTimeToYaw(video.currentTime, video.duration);
    onTimeRatioChangeRef.current?.(Math.max(0, Math.min(1, video.currentTime / video.duration)));
    const key = face3dTimelineKey(video.currentTime);
    if (key === currentTimeKeyRef.current) return;
    currentTimeKeyRef.current = key;
    renderCachedAnnotations();
    if (opts?.queueLandmarks !== false) {
      requestLandmarksForTimeKey(key);
    }
  }, [renderCachedAnnotations, requestLandmarksForTimeKey]);

  // Auto-rotate: forward uses native video.play(); reverse uses the same timeline
  // bucket rate as forward but draws only from the frame cache (no per-frame seeks).
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    let cancelled = false;
    let autoRaf = 0;
    let autoMode: 'idle' | 'forward' | 'backward' = 'idle';
    let initialZoomApplied = false;
    const initZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, initialZoom));
    const initPanY = initialPanY;
    let rvfcId = 0;

    clearAnnotationOverlay(overlayRef.current);

    const stopAuto = () => {
      if (autoRaf) { cancelAnimationFrame(autoRaf); autoRaf = 0; }
      video.pause();
      safeSetPlaybackRate(video, 1);
      const dc = displayCanvasRef.current;
      if (dc) dc.style.opacity = '0';
      autoMode = 'idle';
    };

    const drawTimelineFrame = (
      timelineKey: number,
      lastBitmap: ImageBitmap | null,
    ): ImageBitmap | null => {
      const dc = displayCanvasRef.current;
      if (!dc) return lastBitmap;
      const frame =
        findNearestFrame(
          frameCacheRef.current,
          timelineKey,
          FRAME_CACHE_REVERSE_MAX_KEY_DELTA,
        ) ?? lastBitmap;
      if (!frame) return lastBitmap;
      const ctx = dc.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, dc.width, dc.height);
        ctx.drawImage(frame, 0, 0, dc.width, dc.height);
      }
      return frame;
    };

    // Forward pass: native play() fills the frame cache via rvfc; monitor RAF
    // detects the end and hands off to startBackward().
    const startForward = () => {
      if (autoRaf) { cancelAnimationFrame(autoRaf); autoRaf = 0; }
      autoMode = 'forward';
      autoDirRef.current = 1;
      const d = video.duration;
      if (!d || !isFinite(d)) return;
      const rate = computeAutoPlaybackRate(d, 1);

      const doPlay = () => {
        if (cancelled || autoMode !== 'forward') return;
        const dc = displayCanvasRef.current;
        safeSetPlaybackRate(video, rate);
        void video.play().catch(() => {});
        if (dc) dc.style.opacity = '0'; // Reveal only after seek + play are aligned
        const monitor = () => {
          autoRaf = 0;
          if (cancelled || !autoRotateRef.current || draggingRef.current || autoMode !== 'forward') return;
          const d2 = video.duration;
          if (!d2 || !isFinite(d2)) { autoRaf = requestAnimationFrame(monitor); return; }
          syncYawFromVideo();
          if (video.currentTime >= d2 - END_TIME_EPS || video.ended) {
            yawRef.current = MAX_YAW_DEG;
            video.currentTime = Math.max(0, d2 - END_TIME_EPS);
            autoDirRef.current = -1;
            startBackward();
            return;
          }
          autoRaf = requestAnimationFrame(monitor);
        };
        autoRaf = requestAnimationFrame(monitor);
      };

      // Seek to the correct start position before playing (important when
      // transitioning from backward where video.currentTime may be anywhere).
      const targetStart = yawToVideoTime(yawRef.current, d);
      if (Math.abs(video.currentTime - targetStart) > SCRUB_SEEK_EPS) {
        video.pause();
        video.currentTime = targetStart;
        video.addEventListener('seeked', doPlay, { once: true });
      } else {
        doPlay();
      }
    };

    // Reverse: native video when supported (same smoothness as forward); else stepped cache RAF.
    const startBackwardCache = () => {
      if (autoRaf) { cancelAnimationFrame(autoRaf); autoRaf = 0; }
      autoMode = 'backward';
      autoDirRef.current = -1;
      video.pause();
      safeSetPlaybackRate(video, 1);
      const dc = displayCanvasRef.current;
      const d0 = video.duration;
      if (!d0 || !isFinite(d0)) return;
      const keysPerSecond =
        Math.abs(computeAutoPlaybackRate(d0, 1)) * FACE3D_TIMELINE_FPS;
      const maxKey = face3dTimelineKey(Math.max(0, d0 - END_TIME_EPS));
      let timelineKey = Math.min(
        maxKey,
        Math.max(0, face3dTimelineKey(yawToVideoTime(yawRef.current, d0))),
      );
      let lastBitmap: ImageBitmap | null = null;
      if (dc) {
        lastBitmap = drawTimelineFrame(timelineKey, null);
        dc.style.opacity = '1';
      }
      let last = performance.now();
      const tick = (now: number) => {
        autoRaf = 0;
        if (cancelled || !autoRotateRef.current || draggingRef.current || autoMode !== 'backward') {
          if (dc) dc.style.opacity = '0';
          return;
        }
        const d = video.duration;
        if (!d || !isFinite(d)) {
          autoRaf = requestAnimationFrame(tick);
          return;
        }
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        timelineKey -= keysPerSecond * dt;
        if (timelineKey <= 0) {
          timelineKey = 0;
          yawRef.current = -MAX_YAW_DEG;
          autoDirRef.current = 1;
          const leftTime = yawToVideoTime(-MAX_YAW_DEG, d);
          const handoffToForward = () => {
            if (cancelled || autoMode !== 'backward') return;
            startForward();
          };
          if (Math.abs(video.currentTime - leftTime) > SCRUB_SEEK_EPS) {
            video.currentTime = leftTime;
            video.addEventListener('seeked', handoffToForward, { once: true });
          } else {
            handoffToForward();
          }
          return;
        }
        const playbackTime = face3dTimelineTimeFromKey(Math.round(timelineKey));
        yawRef.current = videoTimeToYaw(playbackTime, d);
        onTimeRatioChangeRef.current?.(Math.max(0, Math.min(1, playbackTime / d)));
        lastBitmap = drawTimelineFrame(Math.round(timelineKey), lastBitmap);
        const landmarkKey = Math.round(timelineKey);
        if (landmarkKey !== currentTimeKeyRef.current) {
          currentTimeKeyRef.current = landmarkKey;
          renderCachedAnnotations();
          requestLandmarksForTimeKey(landmarkKey);
        }
        autoRaf = requestAnimationFrame(tick);
      };
      autoRaf = requestAnimationFrame(tick);
    };

    const startBackwardVideo = () => {
      if (autoRaf) { cancelAnimationFrame(autoRaf); autoRaf = 0; }
      autoMode = 'backward';
      autoDirRef.current = -1;
      const dc = displayCanvasRef.current;
      if (dc) dc.style.opacity = '0';
      const d = video.duration;
      if (!d || !isFinite(d)) return;
      const endTime = Math.max(0, d - END_TIME_EPS);
      const rate = computeAutoPlaybackRate(d, -1);

      const doPlay = () => {
        if (cancelled || autoMode !== 'backward') return;
        if (!safeSetPlaybackRate(video, rate) || video.playbackRate >= 0) {
          reversePlaybackOkRef.current = false;
          startBackwardCache();
          return;
        }
        void video.play().catch(() => {
          reversePlaybackOkRef.current = false;
          startBackwardCache();
        });
        const monitor = () => {
          autoRaf = 0;
          if (cancelled || !autoRotateRef.current || draggingRef.current || autoMode !== 'backward') return;
          const d2 = video.duration;
          if (!d2 || !isFinite(d2)) { autoRaf = requestAnimationFrame(monitor); return; }
          syncYawFromVideo();
          if (video.currentTime <= END_TIME_EPS || video.paused) {
            video.pause();
            safeSetPlaybackRate(video, 1);
            yawRef.current = -MAX_YAW_DEG;
            autoDirRef.current = 1;
            const leftTime = yawToVideoTime(-MAX_YAW_DEG, d2);
            const handoffToForward = () => {
              if (cancelled || autoMode !== 'backward') return;
              startForward();
            };
            if (Math.abs(video.currentTime - leftTime) > SCRUB_SEEK_EPS) {
              video.currentTime = leftTime;
              video.addEventListener('seeked', handoffToForward, { once: true });
            } else {
              handoffToForward();
            }
            return;
          }
          autoRaf = requestAnimationFrame(monitor);
        };
        autoRaf = requestAnimationFrame(monitor);
      };

      if (Math.abs(video.currentTime - endTime) > SCRUB_SEEK_EPS) {
        video.pause();
        safeSetPlaybackRate(video, 1);
        video.currentTime = endTime;
        video.addEventListener('seeked', doPlay, { once: true });
      } else {
        doPlay();
      }
    };

    const startBackward = () => {
      if (reversePlaybackOkRef.current !== false) {
        startBackwardVideo();
      } else {
        startBackwardCache();
      }
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
      setDisplaySize(size);
      // Apply initial zoom/pan once — lets the face fill the frame on first load.
      if (!initialZoomApplied && (initZoom !== 1 || initPanY !== 0)) {
        initialZoomApplied = true;
        zoomRef.current = initZoom;
        panYRef.current = initPanY;
        panXRef.current = 0;
        if (zoomLayerRef.current) {
          zoomLayerRef.current.style.transform = `translate(0px, ${initPanY}px) scale(${initZoom})`;
        }
        setZoom(initZoom);
      }
      renderCachedAnnotations();
      stopAuto();
      if (reversePlaybackOkRef.current === null) {
        reversePlaybackOkRef.current = detectReverseVideoPlayback(video);
      }
      const initialYaw = autoRotateRef.current
        ? -MAX_YAW_DEG
        : clampYaw(controlledYawDeg ?? 0);
      const controlledTime =
        controlledTimeRatio === undefined
          ? null
          : Math.max(0, Math.min(1, controlledTimeRatio)) * video.duration;
      yawRef.current = controlledTime == null ? initialYaw : videoTimeToYaw(controlledTime, video.duration);
      const target = controlledTime ?? yawToVideoTime(initialYaw, video.duration);
      const beginAutoRotate = () => {
        if (cancelled || !autoRotateRef.current) return;
        autoDirRef.current = 1;
        yawRef.current = -MAX_YAW_DEG;
        const d = video.duration;
        if (!d || !isFinite(d)) {
          startAutoPlayback(1);
          return;
        }
        const leftTime = yawToVideoTime(-MAX_YAW_DEG, d);
        const go = () => startAutoPlayback(1);
        if (Math.abs(video.currentTime - leftTime) < SCRUB_SEEK_EPS) go();
        else {
          video.currentTime = leftTime;
          video.addEventListener("seeked", go, { once: true });
        }
      };

      const afterSeek = () => {
        if (cancelled) return;
        syncYawFromVideo();
        if (!autoRotateRef.current) return;
        // Fill cache in the background for manual scrub / Safari fallback only.
        if (frameCachePrimedUrlRef.current !== videoUrl) {
          void ensureFrameCachePrimed(video, () => cancelled);
        }
        beginAutoRotate();
      };
      if (Math.abs(video.currentTime - target) < SCRUB_SEEK_EPS) afterSeek();
      else {
        seekVideoToTime(video, target);
        video.addEventListener('seeked', afterSeek, { once: true });
      }
    };

    const onSeeked = () => {
      if (cancelled) return;
      syncYawFromVideo();
      if (draggingRef.current) {
        drawVideoFrameToDisplay();
        captureCurrentFrame();
        const dc = displayCanvasRef.current;
        if (dc) dc.style.opacity = "1";
        return;
      }
      captureCurrentFrame();
    };

    // Safety net in case the monitor RAF misses the video end event.
    const onEnded = () => {
      if (cancelled || draggingRef.current || !autoRotateRef.current) return;
      if (autoMode === 'forward') {
        yawRef.current = MAX_YAW_DEG;
        autoDirRef.current = -1;
        startBackward();
      }
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
    controlledYawDeg,
    controlledTimeRatio,
    initialZoom,
    initialPanY,
    syncYawFromVideo,
    drawVideoFrameToDisplay,
    captureCurrentFrame,
    captureFrameBitmapAtKey,
    ensureFrameCachePrimed,
    renderCachedAnnotations,
    requestLandmarksForTimeKey,
  ]);

  useEffect(() => {
    const video = videoRef.current;
    if (!autoRotate) {
      autoPlaybackControllerRef.current?.stop();
      if (video) {
        video.pause();
        safeSetPlaybackRate(video, 1);
      }
      return;
    }
    if (!video?.duration || !isFinite(video.duration)) return;
    if (frameCachePrimedUrlRef.current !== videoUrl) {
      void ensureFrameCachePrimed(video, () => false);
    }
    autoDirRef.current = 1;
    yawRef.current = -MAX_YAW_DEG;
    const leftTime = yawToVideoTime(-MAX_YAW_DEG, video.duration);
    const go = () => autoPlaybackControllerRef.current?.start(1);
    if (Math.abs(video.currentTime - leftTime) < SCRUB_SEEK_EPS) go();
    else {
      video.currentTime = leftTime;
      video.addEventListener("seeked", go, { once: true });
    }
  }, [autoRotate, videoUrl, ensureFrameCachePrimed]);

  useEffect(() => {
    if (controlledYawDeg === undefined) return;
    if (controlledTimeRatio !== undefined) return;
    const video = videoRef.current;
    if (!video || !video.duration || !isFinite(video.duration)) return;
    const yaw = clampYaw(controlledYawDeg);
    const target = yawToVideoTime(yaw, video.duration);
    const quantizedTime = quantizeFace3dTimelineTime(target);
    autoPlaybackControllerRef.current?.stop();
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
  }, [controlledYawDeg, controlledTimeRatio, renderCachedAnnotations, requestLandmarksForTimeKey]);

  useEffect(() => {
    if (controlledTimeRatio === undefined) return;
    const video = videoRef.current;
    if (!video || !video.duration || !isFinite(video.duration)) return;
    const ratio = Math.max(0, Math.min(1, controlledTimeRatio));
    const target = ratio * video.duration;
    autoPlaybackControllerRef.current?.stop();
    video.pause();
    safeSetPlaybackRate(video, 1);
    draggingRef.current = false;
    if (controlledTimeAnimationRef.current) {
      cancelAnimationFrame(controlledTimeAnimationRef.current);
      controlledTimeAnimationRef.current = 0;
    }

    const duration = video.duration;
    const start = video.currentTime || 0;
    // Turntable is a linear sweep (left profile → front → right); never wrap the long way.
    const shortestDelta = target - start;
    const ms = Math.max(0, controlledTimeAnimationMs);
    if (displayCanvasRef.current) {
      displayCanvasRef.current.style.opacity = ms > 0 ? "1" : "0";
    }
    const setFrame = (time: number, queueLandmarks = true, finished = false) => {
      const wrapped = ((time % duration) + duration) % duration;
      yawRef.current = videoTimeToYaw(wrapped, duration);
      onTimeRatioChangeRef.current?.(Math.max(0, Math.min(1, wrapped / duration)));
      scrubTargetYawRef.current = yawRef.current;
      currentTimeKeyRef.current = face3dTimelineKey(wrapped);

      const targetKey = face3dTimelineKey(wrapped);
      const quantized = quantizeFace3dTimelineTime(wrapped);
      const cachedFrame = findNearestFrame(frameCacheRef.current, targetKey, FRAME_CACHE_MAX_KEY_DELTA);
      const dc = displayCanvasRef.current;
      const aligned = Math.abs(video.currentTime - quantized) <= SCRUB_SEEK_EPS_DRAG;
      if (cachedFrame && dc) {
        const ctx = dc.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, dc.width, dc.height);
          ctx.drawImage(cachedFrame, 0, 0, dc.width, dc.height);
        }
        dc.style.opacity = "1";
      } else if (aligned) {
        seekVideoPrecisely(video, quantized, SCRUB_SEEK_EPS_DRAG);
        drawVideoFrameToDisplay();
        captureCurrentFrame();
        if (dc) dc.style.opacity = "1";
      } else {
        seekVideoPrecisely(video, quantized, SCRUB_SEEK_EPS_DRAG);
        if (dc) dc.style.opacity = "0";
      }

      renderCachedAnnotations();
      if (queueLandmarks) requestLandmarksForTimeKey(currentTimeKeyRef.current);
      if (finished && dc) dc.style.opacity = "0";
    };

    if (ms === 0 || Math.abs(shortestDelta) < 0.03) {
      setFrame(target, true, true);
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
      setFrame(start + shortestDelta * easeInOut(progress), true, finished);
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
  }, [
    controlledTimeRatio,
    controlledTimeAnimationMs,
    drawVideoFrameToDisplay,
    captureCurrentFrame,
    renderCachedAnnotations,
    requestLandmarksForTimeKey,
  ]);

  /** Apply CSS transform directly — no React re-render during drag/scroll. */
  const applyTransform = useCallback((px: number, py: number, z: number) => {
    if (zoomLayerRef.current) {
      zoomLayerRef.current.style.transform = `translate(${px}px, ${py}px) scale(${z})`;
    }
  }, []);

  // ── Wheel-to-zoom ─────────────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const oldZoom = zoomRef.current;
      const newZoom = Math.max(minZoomRef.current, Math.min(MAX_ZOOM, oldZoom * factor));
      if (newZoom === oldZoom) return;
      const rect = viewer.getBoundingClientRect();
      const cx = e.clientX - (rect.left + rect.width / 2);
      const cy = e.clientY - (rect.top + rect.height / 2);
      const localX = (cx - panXRef.current) / oldZoom;
      const localY = (cy - panYRef.current) / oldZoom;
      const newPanX = cx - localX * newZoom;
      const newPanY = cy - localY * newZoom;
      zoomRef.current = newZoom;
      panXRef.current = newPanX;
      panYRef.current = newPanY;
      applyTransform(newPanX, newPanY, newZoom);
      setZoom(newZoom);
      renderCachedAnnotations();
    };
    viewer.addEventListener("wheel", onWheel, { passive: false });
    return () => viewer.removeEventListener("wheel", onWheel);
  }, [applyTransform, renderCachedAnnotations]);

  const resetZoom = useCallback(() => {
    const z = minZoomRef.current;
    const py = initialPanY;
    zoomRef.current = z; panXRef.current = 0; panYRef.current = py;
    applyTransform(0, py, z);
    setZoom(z);
    renderCachedAnnotations();
  }, [applyTransform, initialPanY, renderCachedAnnotations]);

  // ── Pointer scrub: RAF seeks when decoder is ready (no seek pile-up) ───────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    let dragStartX = 0;
    let dragStartYaw = 0;
    let scrubRaf = 0;

    const stopScrubLoop = () => {
      if (scrubRaf) cancelAnimationFrame(scrubRaf);
      scrubRaf = 0;
    };

    const startScrubLoop = () => {
      stopScrubLoop();
      const tick = () => {
        scrubRaf = 0;
        if (!draggingRef.current) return;
        const video = videoRef.current;
        if (!video?.duration) return;
        const yaw = scrubTargetYawRef.current;
        yawRef.current = yaw;
        const target = yawToVideoTime(yaw, video.duration);
        const quantizedTime = quantizeFace3dTimelineTime(target);
        const targetKey = face3dTimelineKey(quantizedTime);

        const cachedFrame = findNearestFrame(
          frameCacheRef.current,
          targetKey,
          FRAME_CACHE_MAX_KEY_DELTA,
        );
        const dc = displayCanvasRef.current;
        const aligned = Math.abs(video.currentTime - quantizedTime) <= SCRUB_SEEK_EPS_DRAG;
        if (cachedFrame && dc) {
          const ctx = dc.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, dc.width, dc.height);
            ctx.drawImage(cachedFrame, 0, 0, dc.width, dc.height);
          }
          dc.style.opacity = "1";
        } else if (aligned) {
          if (drawVideoFrameToDisplay()) captureCurrentFrame();
          if (dc) dc.style.opacity = "1";
        } else {
          seekVideoPrecisely(video, quantizedTime, SCRUB_SEEK_EPS_DRAG);
          // Let the live video show through until the seek lands (avoids frozen front frame).
          if (dc) dc.style.opacity = "0";
        }

        if (targetKey !== currentTimeKeyRef.current) {
          currentTimeKeyRef.current = targetKey;
          renderCachedAnnotations();
          requestLandmarksForTimeKey(targetKey);
        }
        scrubRaf = requestAnimationFrame(tick);
      };
      scrubRaf = requestAnimationFrame(tick);
    };

    function onPointerDown(e: PointerEvent) {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      draggingRef.current = true;
      dragStartX = e.clientX;
      dragStartYaw = yawRef.current;
      scrubTargetYawRef.current = dragStartYaw;
      viewer!.style.cursor = "grabbing";
      const video = videoRef.current;
      if (video) { video.pause(); safeSetPlaybackRate(video, 1); }
      if (displayCanvasRef.current) displayCanvasRef.current.style.opacity = "1";
      startScrubLoop();
    }

    function onPointerMove(e: PointerEvent) {
      if (!draggingRef.current) return;
      const dx = e.clientX - dragStartX;
      scrubTargetYawRef.current = clampYaw(dragStartYaw - dx * DEG_PER_PX);
    }

    function onPointerUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      stopScrubLoop();
      if (displayCanvasRef.current) displayCanvasRef.current.style.opacity = "0";
      viewer!.style.cursor = "";
      const video = videoRef.current;
      if (video?.duration) {
        const target = yawToVideoTime(scrubTargetYawRef.current, video.duration);
        seekVideoPrecisely(video, quantizeFace3dTimelineTime(target), SCRUB_SEEK_EPS_DRAG);
        yawRef.current = scrubTargetYawRef.current;
        syncYawFromVideo({ queueLandmarks: true });
      }
      autoDirRef.current = yawRef.current >= 0 ? 1 : -1;
      if (autoRotateRef.current && video?.duration) {
        autoPlaybackControllerRef.current?.start(autoDirRef.current);
      }
    }

    viewer.addEventListener("pointerdown", onPointerDown);
    viewer.addEventListener("pointermove", onPointerMove);
    viewer.addEventListener("pointerup", onPointerUp);
    viewer.addEventListener("pointercancel", onPointerUp);

    return () => {
      stopScrubLoop();
      viewer.removeEventListener("pointerdown", onPointerDown);
      viewer.removeEventListener("pointermove", onPointerMove);
      viewer.removeEventListener("pointerup", onPointerUp);
      viewer.removeEventListener("pointercancel", onPointerUp);
    };
  }, [
    videoUrl,
    syncYawFromVideo,
    renderCachedAnnotations,
    applyTransform,
    requestLandmarksForTimeKey,
    drawVideoFrameToDisplay,
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
        <div ref={zoomLayerRef} className="face3d-zoom-layer">
          <div className="face3d-media-layer" style={{ opacity: mediaOpacity }}>
            <video
              ref={videoRef}
              src={videoUrl}
              width={displaySize.w}
              height={displaySize.h}
              preload="auto"
              muted
              playsInline
              crossOrigin="anonymous"
              className="face3d-display"
              onError={() => setVideoError("3D preview video could not be loaded.")}
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
