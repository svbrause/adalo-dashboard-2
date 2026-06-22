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
  return Math.max(10, Math.min(14, Math.round(logicalMinDim * 0.024)));
}

export function mirrorRegionLabelFont(logicalMinDim: number): string {
  const fs = mirrorRegionLabelFontSize(logicalMinDim);
  return `600 ${fs}px system-ui, -apple-system, "Segoe UI", sans-serif`;
}

/** Integer pixel coords reduce blurry subpixel canvas text. */
export function snapMirrorLabelTextPosition(x: number, y: number): { x: number; y: number } {
  return { x: Math.round(x), y: Math.round(y) };
}

export type MirrorRegionCalloutInput = {
  key: string;
  label: string;
  anchorX: number;
  anchorY: number;
  boxWidth: number;
  boxHeight: number;
};

export type MirrorRegionCalloutLayout = MirrorRegionCalloutInput & {
  marginSide: "left" | "right";
  x: number;
  y: number;
};

export type FittedMirrorCalloutLabel = {
  label: string;
  textWidth: number;
  boxWidth: number;
};

export type MirrorCalloutMarginSideMode = "opposite-from-anchor" | "same-as-anchor";

export type LayoutMirrorRegionCalloutsOptions = {
  canvasWidth: number;
  canvasHeight: number;
  margin?: number;
  minGap?: number;
  /** Extra top inset for left-margin callouts (viewport overlay controls). */
  yMinLeft?: number;
  yMinRight?: number;
  leftInset?: number;
  rightInset?: number;
  marginSideMode: MirrorCalloutMarginSideMode;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function fitMirrorCalloutLabel(
  ctx: Pick<CanvasRenderingContext2D, "measureText">,
  label: string,
  maxBoxWidth: number,
  padX: number,
): FittedMirrorCalloutLabel {
  const maxTextWidth = Math.max(24, maxBoxWidth - padX * 2);
  const fullTextWidth = ctx.measureText(label).width;
  if (fullTextWidth <= maxTextWidth) {
    return {
      label,
      textWidth: fullTextWidth,
      boxWidth: fullTextWidth + padX * 2,
    };
  }

  const suffix = "...";
  const suffixWidth = ctx.measureText(suffix).width;
  if (suffixWidth >= maxTextWidth) {
    return {
      label: suffix,
      textWidth: suffixWidth,
      boxWidth: Math.min(maxBoxWidth, suffixWidth + padX * 2),
    };
  }

  let lo = 0;
  let hi = label.length;
  let best = suffix;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const candidate = `${label.slice(0, mid).trimEnd()}${suffix}`;
    const width = ctx.measureText(candidate).width;
    if (width <= maxTextWidth) {
      best = candidate;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  const textWidth = ctx.measureText(best).width;
  return {
    label: best,
    textWidth,
    boxWidth: Math.min(maxBoxWidth, textWidth + padX * 2),
  };
}

export function clampMirrorCalloutBoxToCanvas(
  x: number,
  y: number,
  boxWidth: number,
  boxHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  margin = 8,
): { x: number; y: number } {
  const maxX = Math.max(margin, canvasWidth - boxWidth - margin);
  const maxY = Math.max(margin, canvasHeight - boxHeight - margin);
  return {
    x: clamp(x, margin, maxX),
    y: clamp(y, margin, maxY),
  };
}

export function marginSideForAnchorX(
  anchorX: number,
  canvasWidth: number,
  mode: MirrorCalloutMarginSideMode,
): "left" | "right" {
  const onLeft = anchorX < canvasWidth / 2;
  if (mode === "same-as-anchor") return onLeft ? "left" : "right";
  return onLeft ? "right" : "left";
}

/** True when axis-aligned label boxes overlap or sit closer than minGap. */
export function mirrorCalloutBoxesOverlap(
  a: { x: number; y: number; boxWidth: number; boxHeight: number },
  b: { x: number; y: number; boxWidth: number; boxHeight: number },
  minGap = 0,
): boolean {
  return (
    a.x < b.x + b.boxWidth + minGap
    && a.x + a.boxWidth + minGap > b.x
    && a.y < b.y + b.boxHeight + minGap
    && a.y + a.boxHeight + minGap > b.y
  );
}

/**
 * Stack callout boxes on one margin without vertical overlap.
 * Prefers anchorY when space allows; compresses evenly when needed.
 */
export function stackMirrorCalloutBoxesY(
  items: MirrorRegionCalloutInput[],
  yMin: number,
  yMax: number,
  minGap: number,
): number[] {
  const n = items.length;
  if (n === 0) return [];

  const heights = items.map((item) => item.boxHeight);
  const preferred = items.map((item) =>
    clamp(item.anchorY - item.boxHeight / 2, yMin, yMax - item.boxHeight),
  );

  if (n === 1) return preferred;

  const totalStack =
    heights.reduce((sum, h) => sum + h, 0) + (n - 1) * minGap;
  const available = Math.max(0, yMax - yMin);

  if (totalStack > available) {
    const gap =
      n > 1
        ? Math.max(2, (available - heights.reduce((sum, h) => sum + h, 0)) / (n - 1))
        : minGap;
    const ys: number[] = [];
    let y = yMin;
    for (let i = 0; i < n; i++) {
      ys.push(y);
      y += heights[i]! + gap;
    }
    return ys;
  }

  const ys = [...preferred];

  for (let i = 1; i < n; i++) {
    ys[i] = Math.max(ys[i]!, ys[i - 1]! + heights[i - 1]! + minGap);
  }

  const overflow = ys[n - 1]! + heights[n - 1]! - yMax;
  if (overflow > 0) {
    for (let i = 0; i < n; i++) ys[i] = ys[i]! - overflow;
  }

  if (ys[0]! < yMin) {
    const centroid =
      preferred.reduce((sum, y) => sum + y, 0) / n + heights[0]! / 2;
    let start = clamp(centroid - totalStack / 2, yMin, yMax - totalStack);
    for (let i = 0; i < n; i++) {
      ys[i] = start;
      start += heights[i]! + minGap;
    }
  }

  for (let i = 1; i < n; i++) {
    ys[i] = Math.max(ys[i]!, ys[i - 1]! + heights[i - 1]! + minGap);
  }
  for (let i = n - 2; i >= 0; i--) {
    ys[i] = Math.min(ys[i]!, ys[i + 1]! - heights[i]! - minGap);
  }

  ys[0] = Math.max(yMin, ys[0]!);
  ys[n - 1] = Math.min(yMax - heights[n - 1]!, ys[n - 1]!);

  return ys;
}

/** Assign non-overlapping positions for region callout badges on left/right margins. */
export function layoutMirrorRegionCallouts(
  items: MirrorRegionCalloutInput[],
  options: LayoutMirrorRegionCalloutsOptions,
): MirrorRegionCalloutLayout[] {
  const margin = options.margin ?? 10;
  const minGap = options.minGap ?? 6;
  const yMinLeft = options.yMinLeft ?? margin;
  const yMinRight = options.yMinRight ?? margin;
  const yMax = options.canvasHeight - margin;
  const leftInset = options.leftInset ?? margin;
  const rightInset = options.rightInset ?? margin;

  const bySide: Record<"left" | "right", MirrorRegionCalloutInput[]> = {
    left: [],
    right: [],
  };

  for (const item of items) {
    const marginSide = marginSideForAnchorX(
      item.anchorX,
      options.canvasWidth,
      options.marginSideMode,
    );
    bySide[marginSide].push(item);
  }

  const out: MirrorRegionCalloutLayout[] = [];

  for (const marginSide of ["left", "right"] as const) {
    const sideItems = [...bySide[marginSide]].sort((a, b) => a.anchorY - b.anchorY);
    if (sideItems.length === 0) continue;

    const yMin = marginSide === "left" ? yMinLeft : yMinRight;
    const ys = stackMirrorCalloutBoxesY(sideItems, yMin, yMax, minGap);

    sideItems.forEach((item, index) => {
      const x =
        marginSide === "left"
          ? Math.max(margin, leftInset)
          : options.canvasWidth - item.boxWidth - Math.max(margin, rightInset);
      out.push({
        ...item,
        marginSide,
        x,
        y: ys[index]!,
      });
    });
  }

  return out;
}
