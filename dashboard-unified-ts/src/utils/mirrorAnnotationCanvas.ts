/** Hi-DPI setup for face mirror annotation canvases (2D photo + 3D turntable overlay). */

const MAX_CANVAS_SCALE = 4;

export function mirrorAnnotationCanvasScale(extraScale = 1): number {
  const dpr =
    typeof window !== "undefined"
      ? Math.min(3, Math.max(1, window.devicePixelRatio || 1))
      : 1;
  return Math.min(MAX_CANVAS_SCALE, dpr * Math.max(1, extraScale));
}

/**
 * Sizes the canvas backing store for crisp strokes/text when CSS-scaled (e.g. zoom layer).
 * Drawing uses logical width/height coordinates after this call.
 */
export function prepareMirrorAnnotationCanvas(
  canvas: HTMLCanvasElement,
  logicalWidth: number,
  logicalHeight: number,
  extraScale = 1,
): CanvasRenderingContext2D | null {
  const scale = mirrorAnnotationCanvasScale(extraScale);
  const pixelW = Math.max(1, Math.round(logicalWidth * scale));
  const pixelH = Math.max(1, Math.round(logicalHeight * scale));
  if (canvas.width !== pixelW || canvas.height !== pixelH) {
    canvas.width = pixelW;
    canvas.height = pixelH;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  return ctx;
}

export function mirrorRegionLabelFontSize(logicalMinDim: number): number {
  return Math.max(12, Math.min(15, Math.round(logicalMinDim * 0.025)));
}

export function mirrorRegionLabelFont(logicalMinDim: number): string {
  const fs = mirrorRegionLabelFontSize(logicalMinDim);
  return `600 ${fs}px system-ui, -apple-system, "Segoe UI", sans-serif`;
}

/** Integer pixel coords reduce blurry subpixel canvas text. */
export function snapMirrorLabelTextPosition(x: number, y: number): { x: number; y: number } {
  return { x: Math.round(x), y: Math.round(y) };
}
