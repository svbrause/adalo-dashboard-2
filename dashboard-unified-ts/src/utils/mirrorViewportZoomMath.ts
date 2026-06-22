export const VIEWPORT_MIN_ZOOM = 1;
export const VIEWPORT_MAX_ZOOM = 6;

/** Per-wheel-event zoom clamp — keeps trackpad gestures smooth and mouse wheels precise. */
const WHEEL_ZOOM_FACTOR_MIN = 0.94;
const WHEEL_ZOOM_FACTOR_MAX = 1.06;
const WHEEL_ZOOM_SENSITIVITY = 0.0011;

export type ViewportTransform = {
  zoom: number;
  panX: number;
  panY: number;
};

export function clampViewportZoom(zoom: number, minZoom: number): number {
  return Math.max(minZoom, Math.min(VIEWPORT_MAX_ZOOM, zoom));
}

/** Normalize wheel delta across line / pixel / page modes before exponential zoom. */
export function wheelZoomFactor(deltaY: number, deltaMode: number): number {
  let normalizedDelta = deltaY;
  if (deltaMode === WheelEvent.DOM_DELTA_LINE) {
    normalizedDelta *= 16;
  } else if (deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    normalizedDelta *= 320;
  }
  const raw = Math.exp(-normalizedDelta * WHEEL_ZOOM_SENSITIVITY);
  return Math.max(WHEEL_ZOOM_FACTOR_MIN, Math.min(WHEEL_ZOOM_FACTOR_MAX, raw));
}

export function zoomViewportAboutPoint({
  oldZoom,
  newZoom,
  panX,
  panY,
  focalX,
  focalY,
}: {
  oldZoom: number;
  newZoom: number;
  panX: number;
  panY: number;
  focalX: number;
  focalY: number;
}): Pick<ViewportTransform, "panX" | "panY"> {
  const localX = (focalX - panX) / oldZoom;
  const localY = (focalY - panY) / oldZoom;
  return {
    panX: focalX - localX * newZoom,
    panY: focalY - localY * newZoom,
  };
}
