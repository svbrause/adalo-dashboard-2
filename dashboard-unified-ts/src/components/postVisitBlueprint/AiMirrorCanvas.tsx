import { useEffect, useRef, useState } from "react";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import {
  AI_MIRROR_REGIONS,
  polygonFromLandmarkIndices,
} from "./aiMirrorRegions";
import "./AiMirrorCanvas.css";

/** Keep in sync with `package.json` dependency for WASM layout compatibility. */
const MEDIAPIPE_TASKS_VISION_VERSION = "0.10.21";
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_TASKS_VISION_VERSION}/wasm`;
const FACE_LANDMARKER_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

type MirrorStatus = "loading" | "ready" | "error";
type RegionTone = "highlight" | "base";
// Temporary QA: set true to highlight every mapped region for shape QA.
const DEBUG_HIGHLIGHT_ALL_AREAS = false;

const REGION_KEYWORDS: Record<string, string[]> = {
  rForehead: ["forehead", "brow", "frown", "glabella", "wrinkle"],
  rLeftEye: ["eye", "under eye", "eyelid", "crow", "tear trough"],
  rRightEye: ["eye", "under eye", "eyelid", "crow", "tear trough"],
  rNose: ["nose", "nasal", "bridge", "tip", "nostril"],
  rLeftCheek: ["cheek", "midface", "nasolabial", "smile line", "malar"],
  rRightCheek: ["cheek", "midface", "nasolabial", "smile line", "malar"],
  rLips: ["lip", "mouth", "marionette", "perioral", "gummy"],
  rChin: ["chin", "jaw", "jawline", "submental", "jowl", "neck"],
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
};

let faceLandmarkerPromise: Promise<
  import("@mediapipe/tasks-vision").FaceLandmarker
> | null = null;

function getFaceLandmarker() {
  if (!faceLandmarkerPromise) {
    faceLandmarkerPromise = (async () => {
      const { FaceLandmarker, FilesetResolver } =
        await import("@mediapipe/tasks-vision");
      const wasm = await FilesetResolver.forVisionTasks(WASM_BASE);
      return FaceLandmarker.createFromOptions(wasm, {
        baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL },
        runningMode: "IMAGE",
        numFaces: 1,
        minFaceDetectionConfidence: 0.4,
        minFacePresenceConfidence: 0.4,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      });
    })();
  }
  return faceLandmarkerPromise;
}

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

function getHighlightedRegionIds(highlightTerms: string[]): Set<string> {
  if (DEBUG_HIGHLIGHT_ALL_AREAS) {
    return new Set(AI_MIRROR_REGIONS.map((r) => r.id));
  }
  const terms = highlightTerms.map(normalizeTerm).filter(Boolean);
  if (!terms.length) return new Set();
  const highlighted = new Set<string>();

  for (const [regionId, keywords] of Object.entries(REGION_KEYWORDS)) {
    const hit = terms.some((term) =>
      keywords.some((kw) => term.includes(kw) || kw.includes(term)),
    );
    if (hit) highlighted.add(regionId);
  }
  return highlighted;
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

function ovalPoints(
  center: { x: number; y: number },
  rx: number,
  ry: number,
  steps = 24,
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    points.push({
      x: center.x + Math.cos(t) * rx,
      y: center.y + Math.sin(t) * ry,
    });
  }
  return points;
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
  if (regionId === "rLeftCheek") {
    const cheek = getPointsByIndices(
      landmarks,
      [50, 101, 205, 187, 147, 123, 116, 117],
      width,
      height,
    );
    if (cheek.length >= 4) {
      const center = averagePoint(cheek);
      const xSpread = Math.abs(
        (cheek.find((p) => p.x === Math.max(...cheek.map((q) => q.x)))?.x ??
          center.x) -
          (cheek.find((p) => p.x === Math.min(...cheek.map((q) => q.x)))?.x ??
            center.x),
      );
      const ySpread = Math.abs(
        (cheek.find((p) => p.y === Math.max(...cheek.map((q) => q.y)))?.y ??
          center.y) -
          (cheek.find((p) => p.y === Math.min(...cheek.map((q) => q.y)))?.y ??
            center.y),
      );
      return ovalPoints(
        center,
        Math.max(10, xSpread * 0.34),
        Math.max(10, ySpread * 0.42),
      );
    }
  }

  if (regionId === "rRightCheek") {
    const cheek = getPointsByIndices(
      landmarks,
      [330, 425, 411, 376, 352, 346, 347, 280],
      width,
      height,
    );
    if (cheek.length >= 4) {
      const center = averagePoint(cheek);
      const xSpread = Math.abs(
        (cheek.find((p) => p.x === Math.max(...cheek.map((q) => q.x)))?.x ??
          center.x) -
          (cheek.find((p) => p.x === Math.min(...cheek.map((q) => q.x)))?.x ??
            center.x),
      );
      const ySpread = Math.abs(
        (cheek.find((p) => p.y === Math.max(...cheek.map((q) => q.y)))?.y ??
          center.y) -
          (cheek.find((p) => p.y === Math.min(...cheek.map((q) => q.y)))?.y ??
            center.y),
      );
      return ovalPoints(
        center,
        Math.max(10, xSpread * 0.34),
        Math.max(10, ySpread * 0.42),
      );
    }
  }

  if (regionId === "rForehead") {
    const raw = polygonFromLandmarkIndices(
      landmarks,
      fallbackIndices,
      width,
      height,
    );
    const browPts = getPointsByIndices(
      landmarks,
      [70, 63, 105, 66, 107, 336, 296, 334, 293, 300],
      width,
      height,
    );
    if (raw.length >= 3 && browPts.length >= 4) {
      const browY = browPts.reduce((s, p) => s + p.y, 0) / browPts.length;
      const topOnly = raw
        .filter((p) => p.y <= browY + height * 0.025)
        .sort((a, b) => a.x - b.x);
      const browLine = [...browPts].sort((a, b) => b.x - a.x);
      if (topOnly.length >= 3) {
        return [...topOnly, ...browLine];
      }
    }
    return raw;
  }

  return polygonFromLandmarkIndices(landmarks, fallbackIndices, width, height);
}

function drawAnnotatedFace(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  landmarks: NormalizedLandmark[],
  FaceLandmarker: typeof import("@mediapipe/tasks-vision").FaceLandmarker,
  DrawingUtils: typeof import("@mediapipe/tasks-vision").DrawingUtils,
  highlightTerms: string[],
): void {
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;
  ctx.clearRect(0, 0, cw, ch);
  ctx.drawImage(img, 0, 0, cw, ch);

  const du = new DrawingUtils(ctx);
  const highlightedRegions = getHighlightedRegionIds(highlightTerms);
  const regionLabels: Array<{ label: string; x: number; y: number }> = [];

  for (const { id, indices } of AI_MIRROR_REGIONS) {
    const poly = getRenderRegionPolygon(id, landmarks, cw, ch, indices);
    if (poly.length < 3) continue;
    const tone: RegionTone = highlightedRegions.has(id) ? "highlight" : "base";

    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
    ctx.closePath();
    ctx.fillStyle =
      tone === "highlight"
        ? "rgba(59, 130, 246, 0.26)"
        : "rgba(99, 102, 241, 0.05)";
    ctx.fill();
    ctx.strokeStyle =
      tone === "highlight"
        ? "rgba(37, 99, 235, 0.95)"
        : "rgba(99, 102, 241, 0.18)";
    ctx.lineWidth =
      tone === "highlight"
        ? Math.max(1.3, Math.min(cw, ch) * 0.0022)
        : Math.max(0.8, Math.min(cw, ch) * 0.0012);
    ctx.stroke();

    if (tone === "highlight") {
      const center = polygonCentroid(poly);
      regionLabels.push({
        label: REGION_DISPLAY_LABEL[id] ?? "Focus Area",
        x: center.x,
        y: center.y,
      });
    }
  }

  const lineOval = Math.max(1, Math.min(cw, ch) * 0.0018);
  const lineContour = Math.max(0.7, Math.min(cw, ch) * 0.0013);

  ctx.save();
  ctx.globalAlpha = 0.7;
  du.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, {
    color: "#4f46e5",
    lineWidth: lineOval,
  });
  du.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_CONTOURS, {
    color: "#9dd6cbaa",
    lineWidth: lineContour,
  });
  ctx.restore();

  if (regionLabels.length > 0) {
    ctx.save();
    const fs = Math.max(11, Math.min(14, Math.round(Math.min(cw, ch) * 0.025)));
    ctx.font = `600 ${fs}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
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
      const calloutX = side === "left" ? margin : cw - boxW - margin;
      const yMin = margin;
      const yMax = ch - boxH - margin;
      const targetY =
        slotCount <= 1
          ? row.y - boxH / 2
          : yMin + (slotIndex / Math.max(1, slotCount - 1)) * (yMax - yMin);
      const calloutY = Math.max(yMin, Math.min(yMax, targetY));
      const anchorX = side === "left" ? calloutX + boxW : calloutX;
      const anchorY = calloutY + boxH / 2;

      // Connector line from label box to highlighted region center.
      ctx.strokeStyle = "rgba(30, 64, 175, 0.75)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(anchorX, anchorY);
      ctx.lineTo(row.x, row.y);
      ctx.stroke();

      ctx.fillStyle = "rgba(30, 64, 175, 0.9)";
      ctx.strokeStyle = "rgba(191, 219, 254, 0.95)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(calloutX, calloutY, boxW, boxH, 999);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#eef2ff";
      ctx.fillText(row.label, calloutX + padX, calloutY + boxH / 2 + 0.5);
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

export interface AiMirrorCanvasProps {
  imageUrl: string;
  alt?: string;
  highlightTerms?: string[];
}

/**
 * Renders the patient photo with MediaPipe face mesh / regions (static IMAGE mode),
 * following the same landmark drawing approach as `test-live-mediapipe/index.html`.
 */
export function AiMirrorCanvas({
  imageUrl,
  alt = "Your facial analysis",
  highlightTerms = [],
}: AiMirrorCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<MirrorStatus>("loading");
  const [fallbackImageUrl, setFallbackImageUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !imageUrl) return undefined;

    setStatus("loading");
    setFallbackImageUrl(null);
    setErrorMessage("");

    (async () => {
      try {
        const img = await loadImage(imageUrl, true);
        if (cancelled) return;

        const maxW = Math.max(280, wrap.clientWidth || 560);
        const scale = Math.min(1, maxW / img.naturalWidth);
        const cw = Math.max(1, Math.round(img.naturalWidth * scale));
        const ch = Math.max(1, Math.round(img.naturalHeight * scale));

        const { FaceLandmarker, DrawingUtils } =
          await import("@mediapipe/tasks-vision");
        const landmarker = await getFaceLandmarker();
        if (cancelled) return;

        const result = landmarker.detect(img);
        const landmarks = result.faceLandmarks?.[0];
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          if (!cancelled) setStatus("error");
          return;
        }

        canvas.width = cw;
        canvas.height = ch;

        if (!landmarks?.length) {
          ctx.drawImage(img, 0, 0, cw, ch);
        } else {
          drawAnnotatedFace(
            ctx,
            img,
            landmarks,
            FaceLandmarker,
            DrawingUtils,
            highlightTerms,
          );
        }
        if (!cancelled) setStatus("ready");
      } catch {
        // Common failure cases:
        // - Expired / bad URL (410, 404)
        // - Detect/draw failed even after a successful load (e.g. strict WASM + tainted image)
        try {
          const plainImg = await loadImage(imageUrl, false);
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
  }, [imageUrl, highlightTerms]);

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
          Mapping facial landmarks…
        </div>
      ) : null}
    </div>
  );
}
