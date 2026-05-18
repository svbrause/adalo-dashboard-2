import { useEffect, useRef, useState, useCallback } from "react";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import {
  ADDITIONAL_AI_MIRROR_REGIONS,
  AI_MIRROR_REGIONS,
  polygonFromLandmarkIndices,
} from "../postVisitBlueprint/aiMirrorRegions";
import { getFaceLandmarker, getHighlightedRegionIds } from "../postVisitBlueprint/AiMirrorCanvas";
import "./Face3DViewer.css";

const DEFAULT_VIDEO_W = 1024;
const DEFAULT_VIDEO_H = 976;
// Keep cached frames sharp without holding full 1024px turntables in GPU memory.
const MAX_DISPLAY_DIM = 1024;
const MAX_CACHED_FRAMES = 150;
const MIN_EARLY_FRAMES = 16;
const MAX_ANGLE = 85;
const DEG_PER_PX = 360 / 380;
const AUTO_SPEED = 36;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ANNOTATION_DETECT_MAX_DIM = 512;

interface Face3DViewerProps {
  videoUrl: string;
  autoRotate: boolean;
  showAnnotations?: boolean;
  highlightTerms?: string[];
  highlightedAnnotationRegionIds?: string[];
}

/** Map an angle to a pre-extracted frame index. */
function angleToFrameIdx(angle: number, frameCount: number): number {
  return Math.floor((((angle / 360) * frameCount + frameCount) % frameCount)) % frameCount;
}

function waitForVideoEvent(video: HTMLVideoElement, eventName: keyof HTMLMediaElementEventMap): Promise<void> {
  return new Promise<void>((resolve) => {
    video.addEventListener(eventName, () => resolve(), { once: true });
  });
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  const clamped = Math.max(0, Math.min(time, Number.isFinite(video.duration) ? video.duration : time));
  if ("fastSeek" in video && typeof video.fastSeek === "function") {
    video.fastSeek(clamped);
  } else {
    video.currentTime = clamped;
  }
  return waitForVideoEvent(video, "seeked");
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
  if ((regionId === "rForehead" || regionId === "rLowerFace") && profileYawAmount(landmarks, width, height) > 0.16) {
    return [];
  }
  if (regionId === "rLeftUnderEye") return underEyeRegion(landmarks, width, height, "left");
  if (regionId === "rRightUnderEye") return underEyeRegion(landmarks, width, height, "right");
  if (regionId === "rLeftNasolabialFold") return nasolabialFoldRegion(landmarks, width, height, "left");
  if (regionId === "rRightNasolabialFold") return nasolabialFoldRegion(landmarks, width, height, "right");
  if (regionId === "rLeftMarionetteLine") return marionetteLineRegion(landmarks, width, height, "left");
  if (regionId === "rRightMarionetteLine") return marionetteLineRegion(landmarks, width, height, "right");
  if (regionId === "rLowerFace") return lowerFaceRegion(landmarks, width, height);
  return polygonFromLandmarkIndices(landmarks, indices, width, height);
}

/** Draw facial landmark annotations from cached MediaPipe landmarks. */
function renderAnnotationOverlay(
  overlayCanvas: HTMLCanvasElement,
  landmarks: NormalizedLandmark[],
  highlightTerms: string[],
  manualHighlightedRegionIds: string[],
): void {
  const w = overlayCanvas.width;
  const h = overlayCanvas.height;
  const ctx = overlayCanvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  if (!landmarks?.length) return;

  const highlightedRegions = getHighlightedRegionIds(highlightTerms);
  for (const regionId of manualHighlightedRegionIds) {
    highlightedRegions.add(regionId);
  }
  const renderRegions = [
    ...AI_MIRROR_REGIONS,
    ...ADDITIONAL_AI_MIRROR_REGIONS.filter((region) => highlightedRegions.has(region.id)),
  ];

  for (const { id, indices } of renderRegions) {
    const poly = annotationRegionPolygon(id, indices, landmarks, w, h);
    if (poly.length < 3) continue;
    const highlight = highlightedRegions.has(id);
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
    ctx.closePath();
    ctx.fillStyle = highlight ? "rgba(59, 130, 246, 0.22)" : "rgba(99, 102, 241, 0.05)";
    ctx.fill();
    ctx.strokeStyle = highlight ? "rgba(37, 99, 235, 0.9)" : "rgba(99, 102, 241, 0.18)";
    ctx.lineWidth = highlight
      ? Math.max(1.2, Math.min(w, h) * 0.002)
      : Math.max(0.6, Math.min(w, h) * 0.001);
    ctx.stroke();
  }

  if (highlightedRegions.size > 0) {
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
    const fs = Math.max(10, Math.round(Math.min(w, h) * 0.022));
    ctx.font = `600 ${fs}px ui-sans-serif, system-ui, sans-serif`;
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
      const side = cx < w / 2 ? "left" : "right";
      const tw = ctx.measureText(label).width;
      const bw = tw + 16, bh = fs + 10, mg = 8;
      const bx = side === "left" ? mg : w - bw - mg;
      const by = Math.max(mg, Math.min(h - bh - mg, cy - bh / 2));
      const ax = side === "left" ? bx + bw : bx;
      ctx.strokeStyle = "rgba(30,64,175,0.6)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ax, by + bh / 2); ctx.lineTo(cx, cy); ctx.stroke();
      ctx.fillStyle = "rgba(30,64,175,0.88)";
      ctx.strokeStyle = "rgba(191,219,254,0.9)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 999);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#eef2ff";
      ctx.fillText(label, bx + 8, by + bh / 2 + 0.5);
    }
    ctx.restore();
  }
}

function clearAnnotationOverlay(overlayCanvas: HTMLCanvasElement | null): void {
  if (!overlayCanvas) return;
  const ctx = overlayCanvas.getContext("2d");
  ctx?.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
}

export default function Face3DViewer({
  videoUrl,
  autoRotate,
  showAnnotations = false,
  highlightTerms = [],
  highlightedAnnotationRegionIds = [],
}: Face3DViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const zoomLayerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const annotationDetectCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentFrameIdxRef = useRef(0);

  // Pre-extracted frames stored as ImageBitmaps — drawn with ctx.drawImage (<0.1ms each).
  const framesRef = useRef<ImageBitmap[] | null>(null);
  const landmarksByFrameRef = useRef<Map<number, NormalizedLandmark[] | null>>(new Map());
  const pendingLandmarkFramesRef = useRef<Set<number>>(new Set());
  const landmarkFrameQueueRef = useRef<number[]>([]);
  const processingLandmarkQueueRef = useRef(false);
  const [framesReady, setFramesReady] = useState(false);
  const extractingRef = useRef(false);

  const autoRotateRef = useRef(autoRotate);
  const highlightTermsRef = useRef(highlightTerms);
  const showAnnotationsRef = useRef(showAnnotations);
  const highlightedAnnotationRegionIdsRef = useRef(highlightedAnnotationRegionIds);

  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const panXRef = useRef(0);
  const panYRef = useRef(0);

  const [displaySize, setDisplaySize] = useState({ w: DEFAULT_VIDEO_W, h: DEFAULT_VIDEO_H });
  const [overlaySize, setOverlaySize] = useState({ w: DEFAULT_VIDEO_W, h: DEFAULT_VIDEO_H });

  useEffect(() => { autoRotateRef.current = autoRotate; }, [autoRotate]);
  useEffect(() => {
    highlightTermsRef.current = highlightTerms;
    if (showAnnotationsRef.current && overlayRef.current) {
      const landmarks = landmarksByFrameRef.current.get(currentFrameIdxRef.current);
      if (landmarks?.length) {
        renderAnnotationOverlay(
          overlayRef.current,
          landmarks,
          highlightTerms,
          highlightedAnnotationRegionIdsRef.current,
        );
      }
    }
  }, [highlightTerms]);
  useEffect(() => { showAnnotationsRef.current = showAnnotations; }, [showAnnotations]);
  useEffect(() => {
    highlightedAnnotationRegionIdsRef.current = highlightedAnnotationRegionIds;
    if (showAnnotationsRef.current && overlayRef.current) {
      const landmarks = landmarksByFrameRef.current.get(currentFrameIdxRef.current);
      if (landmarks?.length) {
        renderAnnotationOverlay(
          overlayRef.current,
          landmarks,
          highlightTermsRef.current,
          highlightedAnnotationRegionIds,
        );
      } else {
        clearAnnotationOverlay(overlayRef.current);
      }
    }
  }, [highlightedAnnotationRegionIds]);

  useEffect(() => {
    if (!showAnnotations) {
      clearAnnotationOverlay(overlayRef.current);
      return;
    }
    const landmarks = landmarksByFrameRef.current.get(currentFrameIdxRef.current);
    if (landmarks?.length && overlayRef.current) {
      renderAnnotationOverlay(
        overlayRef.current,
        landmarks,
        highlightTermsRef.current,
        highlightedAnnotationRegionIdsRef.current,
      );
    }
  }, [showAnnotations]);

  const requestLandmarksForFrame = useCallback((idx: number) => {
    const frames = framesRef.current;
    if (!frames?.[idx]) return;
    if (landmarksByFrameRef.current.has(idx) || pendingLandmarkFramesRef.current.has(idx)) return;
    pendingLandmarkFramesRef.current.add(idx);
    landmarkFrameQueueRef.current.push(idx);
    if (processingLandmarkQueueRef.current) return;
    processingLandmarkQueueRef.current = true;

    void (async () => {
      try {
        const landmarker = await getFaceLandmarker();
        while (landmarkFrameQueueRef.current.length > 0) {
          const nextIdx = landmarkFrameQueueRef.current.shift()!;
          const frame = framesRef.current?.[nextIdx];
          if (!frame) {
            pendingLandmarkFramesRef.current.delete(nextIdx);
            continue;
          }
          const scale = Math.min(1, ANNOTATION_DETECT_MAX_DIM / Math.max(frame.width, frame.height));
          const w = Math.max(1, Math.round(frame.width * scale));
          const h = Math.max(1, Math.round(frame.height * scale));
          const canvas = annotationDetectCanvasRef.current ?? document.createElement("canvas");
          annotationDetectCanvasRef.current = canvas;
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            pendingLandmarkFramesRef.current.delete(nextIdx);
            continue;
          }
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(frame, 0, 0, w, h);
          const result = landmarker.detect(canvas);
          const landmarks = result.faceLandmarks?.[0] ?? null;
          landmarksByFrameRef.current.set(nextIdx, landmarks);
          pendingLandmarkFramesRef.current.delete(nextIdx);
          if (nextIdx === currentFrameIdxRef.current && showAnnotationsRef.current && landmarks?.length && overlayRef.current) {
            renderAnnotationOverlay(
              overlayRef.current,
              landmarks,
              highlightTermsRef.current,
              highlightedAnnotationRegionIdsRef.current,
            );
          }
          await idle();
        }
      } catch (err) {
        console.warn("[Face3DViewer] annotation landmark cache:", err);
      } finally {
        processingLandmarkQueueRef.current = false;
        if (landmarkFrameQueueRef.current.length > 0) {
          const restartIdx = landmarkFrameQueueRef.current.shift()!;
          pendingLandmarkFramesRef.current.delete(restartIdx);
          requestLandmarksForFrame(restartIdx);
        }
      }
    })();
  }, []);

  useEffect(() => {
    if (!showAnnotations || !framesRef.current?.length) return undefined;
    let cancelled = false;
    const current = currentFrameIdxRef.current;
    requestLandmarksForFrame(current);
    requestLandmarksForFrame((current + 1) % framesRef.current.length);

    void (async () => {
      const frameCount = framesRef.current?.length ?? 0;
      for (let offset = 0; offset < frameCount && !cancelled; offset++) {
        const forward = (current + offset) % frameCount;
        const backward = (current - offset + frameCount) % frameCount;
        requestLandmarksForFrame(forward);
        requestLandmarksForFrame(backward);
        await idle();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showAnnotations, framesReady, requestLandmarksForFrame]);

  /** Apply CSS transform directly — no React re-render during drag/scroll. */
  const applyTransform = useCallback((px: number, py: number, z: number) => {
    if (zoomLayerRef.current) {
      zoomLayerRef.current.style.transform = `translate(${px}px, ${py}px) scale(${z})`;
    }
  }, []);

  // ── Frame extraction ──────────────────────────────────────────────────────
  // Seeks through the video once at load time and snapshots every frame into
  // an ImageBitmap array.  After this, rotation is just ctx.drawImage(frame)
  // which is GPU-accelerated and takes <0.1ms — no more per-frame video seeks.
  //
  // A dedicated off-screen video element is used for seeking/extraction so it
  // never races with the display video element.  Both were sharing the same
  // element before, causing the seeked event to resolve the wrong awaiter and
  // extraction to capture frames at incorrect positions → glitchy rotation.
  useEffect(() => {
    if (framesRef.current) {
      framesRef.current.forEach((b) => b.close());
      framesRef.current = null;
    }
    landmarksByFrameRef.current.clear();
    pendingLandmarkFramesRef.current.clear();
    landmarkFrameQueueRef.current = [];
    processingLandmarkQueueRef.current = false;
    clearAnnotationOverlay(overlayRef.current);
    setFramesReady(false);

    let cancelled = false;

    async function extract() {
      // Off-screen video dedicated to seeking — never touches videoRef.current.
      const extractVid = document.createElement("video");
      extractVid.muted = true;
      extractVid.playsInline = true;
      extractVid.preload = "auto";
      extractVid.src = videoUrl;

      if (extractVid.readyState < 1) {
        await waitForVideoEvent(extractVid, "loadedmetadata");
      }
      if (cancelled) { extractVid.src = ""; return; }

      const dur = extractVid.duration;
      if (!dur || !isFinite(dur) || dur <= 0) { extractVid.src = ""; return; }

      const targetSize = fitDisplaySize(extractVid);
      setDisplaySize(targetSize);
      extractingRef.current = true;

      const N = Math.min(Math.max(Math.round(dur * 30), 48), MAX_CACHED_FRAMES);
      const bitmaps: ImageBitmap[] = [];

      const tmpC = document.createElement("canvas");
      tmpC.width = targetSize.w;
      tmpC.height = targetSize.h;
      const tmpCtx = tmpC.getContext("2d")!;

      for (let i = 0; i < N; i++) {
        if (cancelled) { bitmaps.forEach((b) => b.close()); extractVid.src = ""; return; }
        await seekVideo(extractVid, (i / N) * dur);
        if (cancelled) { bitmaps.forEach((b) => b.close()); extractVid.src = ""; return; }
        try {
          tmpCtx.drawImage(extractVid, 0, 0, targetSize.w, targetSize.h);
          bitmaps.push(await createImageBitmap(tmpC));
        } catch {
          // skip unreadable frames
        }

        // Enable the fast path as soon as we have basic coverage.
        if (!framesRef.current && bitmaps.length >= MIN_EARLY_FRAMES) {
          framesRef.current = [...bitmaps];
          setFramesReady(true);
        }

        // Yield every 4 frames so pointer events and paint aren't starved.
        // setTimeout(0) is enough — the old idle() waited up to 80ms per frame,
        // stretching extraction to 12+ seconds and keeping the fallback active far too long.
        if (i % 4 === 0) await new Promise<void>((r) => setTimeout(r, 0));
      }

      extractVid.src = "";
      if (cancelled) { bitmaps.forEach((b) => b.close()); return; }
      framesRef.current = bitmaps;
      setFramesReady(true);
      extractingRef.current = false;
    }

    extract().catch((err) => console.warn("[Face3DViewer] frame extraction:", err));
    return () => {
      cancelled = true;
      extractingRef.current = false;
    };
  }, [videoUrl]);

  // ── Wheel-to-zoom ─────────────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const oldZoom = zoomRef.current;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * factor));
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
    };
    viewer.addEventListener("wheel", onWheel, { passive: false });
    return () => viewer.removeEventListener("wheel", onWheel);
  }, [applyTransform]);

  const resetZoom = useCallback(() => {
    zoomRef.current = 1; panXRef.current = 0; panYRef.current = 0;
    applyTransform(0, 0, 1);
    setZoom(1);
  }, [applyTransform]);

  // ── Core RAF loop + pointer events ───────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    let angle = 0;
    let autoDir = 1;
    let dragging = false;
    let dragStartX = 0, dragStartY = 0, dragStartAngle = 0;
    let dragStartPanX = 0, dragStartPanY = 0;
    let rafId: number;
    let lastTs = 0;
    let lastFrameIdx = -1;

    function drawFrame() {
      const frames = framesRef.current;
      const canvas = displayCanvasRef.current;
      if (!frames || !frames.length || !canvas) return;
      const idx = angleToFrameIdx(angle, frames.length);
      const nextIdx = (idx + 1) % frames.length;
      if (idx === lastFrameIdx) return; // skip identical frames — no GPU work needed
      lastFrameIdx = idx;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(frames[idx], 0, 0, canvas.width, canvas.height);

      currentFrameIdxRef.current = idx;
      if (showAnnotationsRef.current && overlayRef.current) {
        const landmarks = landmarksByFrameRef.current.get(idx);
        if (landmarks?.length) {
          renderAnnotationOverlay(
            overlayRef.current,
            landmarks,
            highlightTermsRef.current,
            highlightedAnnotationRegionIdsRef.current,
          );
        } else {
          clearAnnotationOverlay(overlayRef.current);
          requestLandmarksForFrame(idx);
          requestLandmarksForFrame(nextIdx);
        }
      }
    }

    function tick(now: number) {
      const dt = lastTs ? (now - lastTs) / 1000 : 0;
      lastTs = now;

      if (!dragging && autoRotateRef.current && zoomRef.current <= 1) {
        angle += AUTO_SPEED * dt * autoDir;
        if (angle >= MAX_ANGLE)       { angle = MAX_ANGLE;  autoDir = -1; }
        else if (angle <= -MAX_ANGLE) { angle = -MAX_ANGLE; autoDir = 1; }
      }

      if (framesRef.current) {
        // Fast path: GPU bitmap copy, no decode.
        drawFrame();
      }
      // While frames are still extracting, the display video element plays
      // back naturally (autoPlay + loop set on the element).  No seeking here —
      // extraction now uses its own off-screen video so there is no seek race.

      rafId = requestAnimationFrame(tick);
    }

    function onPointerDown(e: PointerEvent) {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragging = true;
      dragStartX = e.clientX; dragStartY = e.clientY;
      dragStartAngle = angle;
      dragStartPanX = panXRef.current; dragStartPanY = panYRef.current;
      viewer!.style.cursor = "grabbing";
    }

    function onPointerMove(e: PointerEvent) {
      if (!dragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      if (zoomRef.current > 1) {
        panXRef.current = dragStartPanX + dx;
        panYRef.current = dragStartPanY + dy;
        applyTransform(panXRef.current, panYRef.current, zoomRef.current);
      } else {
        angle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, dragStartAngle - dx * DEG_PER_PX));
      }
    }

    function onPointerUp() {
      if (!dragging) return;
      dragging = false;
      viewer!.style.cursor = "";
      autoDir = angle >= 0 ? 1 : -1;
    }

    viewer.addEventListener("pointerdown", onPointerDown);
    viewer.addEventListener("pointermove", onPointerMove);
    viewer.addEventListener("pointerup", onPointerUp);
    viewer.addEventListener("pointercancel", onPointerUp);
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      viewer.removeEventListener("pointerdown", onPointerDown);
      viewer.removeEventListener("pointermove", onPointerMove);
      viewer.removeEventListener("pointerup", onPointerUp);
      viewer.removeEventListener("pointercancel", onPointerUp);
    };
  }, [videoUrl, applyTransform, requestLandmarksForFrame]);

  // ── Resize observer: keep overlay canvas matching rendered viewer size ────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const ro = new ResizeObserver(() => {
      const rect = viewer.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setOverlaySize({ w: Math.round(rect.width), h: Math.round(rect.height) });
      }
    });
    ro.observe(viewer);
    return () => ro.disconnect();
  }, []);

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
          {/*
           * Both elements are always mounted so their refs are always valid.
           * While frames are loading the video is visible (video seeking fallback).
           * Once frames are extracted the canvas is visible and video is hidden.
           */}
          <video
            ref={videoRef}
            src={videoUrl}
            width={displaySize.w}
            height={displaySize.h}
            preload="auto"
            muted
            playsInline
            autoPlay={!framesReady}
            loop
            className={`face3d-display${framesReady ? " face3d-display--hidden" : ""}`}
          />
          <canvas
            ref={displayCanvasRef}
            width={displaySize.w}
            height={displaySize.h}
            className={`face3d-display${framesReady ? "" : " face3d-display--hidden"}`}
          />
          {showAnnotations && (
            <canvas
              ref={overlayRef}
              className="face3d-annotation-overlay"
              width={overlaySize.w}
              height={overlaySize.h}
              aria-hidden
            />
          )}
        </div>
      </div>
      <p className="face3d-hint">
        {zoom > 1
          ? "Drag to pan · Scroll to zoom · Double-click to reset"
          : "Drag to rotate · Scroll to zoom"}
      </p>
    </div>
  );
}
