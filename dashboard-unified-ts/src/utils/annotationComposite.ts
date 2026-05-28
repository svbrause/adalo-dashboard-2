import type { AnnotateStroke } from "../components/aura/AnnotateDrawing";

const STROKE_RASTER_SIZE = 1000;

/** Where the face image sits inside the draw overlay (0–1 fractions). */
export type AnnotateContentRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

export function strokesToSvgMarkup(strokes: AnnotateStroke[], viewBox = "0 0 100 100"): string {
  const ink = strokes.filter((s) => s.tool !== "eraser");
  const erasers = strokes.filter((s) => s.tool === "eraser");
  const paths = ink
    .map(
      (s) =>
        `<path d="${s.d}" fill="none" stroke="${s.color}" stroke-width="${s.width}" stroke-opacity="${s.opacity}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`,
    )
    .join("");
  const eraserPaths = erasers
    .map(
      (s) =>
        `<path d="${s.d}" fill="none" stroke="#000" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`,
    )
    .join("");
  const mask =
    erasers.length > 0
      ? `<defs><mask id="erase"><rect width="100" height="100" fill="white"/>${eraserPaths}</mask></defs>`
      : "";
  const maskedPaths =
    erasers.length > 0
      ? `<g mask="url(#erase)">${paths}</g>`
      : paths;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">${mask}${maskedPaths}</svg>`;
}

/** Map overlay-normalized ink (viewBox 0–100) onto the face image using measured layout. */
function isFullContentRect(rect: AnnotateContentRect): boolean {
  return rect.x <= 0.001 && rect.y <= 0.001 && rect.w >= 0.999 && rect.h >= 0.999;
}

async function rasterizeStrokesLayer(
  strokes: AnnotateStroke[],
  size = STROKE_RASTER_SIZE,
): Promise<HTMLImageElement> {
  const svg = strokesToSvgMarkup(strokes);
  const sized = svg.replace(
    "<svg ",
    `<svg width="${size}" height="${size}" `,
  );
  const svgUrl = `data:image/svg+xml,${encodeURIComponent(sized)}`;
  return loadImage(svgUrl);
}

/**
 * Face bounds inside the draw overlay (same box as the SVG viewBox).
 * Strokes use 0–100 coords relative to the overlay element.
 */
export function measureAnnotateContentRect(measureRoot: HTMLElement): AnnotateContentRect | undefined {
  const overlayEl =
    measureRoot.querySelector<HTMLElement>(".face3d-draw-overlay") ?? measureRoot;
  const imageEl =
    measureRoot.querySelector<HTMLElement>(".avf-static-photo__img") ??
    measureRoot.querySelector<HTMLElement>(".ai-mirror-canvas") ??
    measureRoot.querySelector<HTMLElement>(".ai-mirror-fallback-img") ??
    measureRoot.querySelector<HTMLVideoElement>(".face3d-display") ??
    measureRoot.querySelector<HTMLCanvasElement>(".face3d-frame-cache-layer");
  if (!imageEl) return undefined;

  const overlay = overlayEl.getBoundingClientRect();
  const image = imageEl.getBoundingClientRect();
  if (overlay.width <= 0 || overlay.height <= 0 || image.width <= 0 || image.height <= 0) {
    return undefined;
  }

  return {
    x: (image.left - overlay.left) / overlay.width,
    y: (image.top - overlay.top) / overlay.height,
    w: image.width / overlay.width,
    h: image.height / overlay.height,
  };
}

/** Snapshot the current turntable video frame (matches what the user drew on). */
export function captureVideoFrameDataUrl(video: HTMLVideoElement): string | null {
  if (video.videoWidth <= 0 || video.videoHeight <= 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0);
  try {
    return canvas.toDataURL("image/jpeg", 0.92);
  } catch {
    return null;
  }
}

/** Rasterize strokes + photo; ink is aligned via contentRect when the face is letterboxed. */
export async function compositeAnnotationOnImage(
  imageUrl: string,
  strokes: AnnotateStroke[],
  contentRect?: AnnotateContentRect,
): Promise<string> {
  const img = await loadImage(imageUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");

  ctx.drawImage(img, 0, 0);

  const ink = strokes.filter((s) => s.tool !== "eraser");
  if (ink.length === 0) {
    return canvas.toDataURL("image/jpeg", 0.92);
  }

  const rect = contentRect ?? { x: 0, y: 0, w: 1, h: 1 };
  const overlay = await rasterizeStrokesLayer(strokes);
  const size = STROKE_RASTER_SIZE;

  if (isFullContentRect(rect)) {
    ctx.drawImage(overlay, 0, 0, w, h);
  } else {
    const sx = Math.max(0, rect.x * size);
    const sy = Math.max(0, rect.y * size);
    const sw = Math.min(size - sx, rect.w * size);
    const sh = Math.min(size - sy, rect.h * size);
    if (sw > 0 && sh > 0) {
      ctx.drawImage(overlay, sx, sy, sw, sh, 0, 0, w, h);
    }
  }

  return canvas.toDataURL("image/jpeg", 0.92);
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function sanitizeDownloadFilename(label: string): string {
  const base = label
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
  return base || "face-annotation";
}
