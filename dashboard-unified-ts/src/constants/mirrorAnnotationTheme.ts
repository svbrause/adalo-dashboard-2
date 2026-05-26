/** Shared mint/teal styling for face mirror annotations (2D photo + 3D video). */
export const MIRROR_ANNOTATION_THEME = {
  regionFill: "rgba(54, 117, 136, 0.28)",
  regionStroke: "rgba(90, 154, 171, 0.92)",
  softFillStart: "rgba(54, 117, 136, 0.26)",
  softFillMid: "rgba(110, 184, 196, 0.14)",
  softFillEnd: "rgba(110, 184, 196, 0)",
  softStroke: "rgba(125, 211, 192, 0.4)",
  connector: "rgba(90, 154, 171, 0.72)",
  labelFill: "rgba(44, 95, 107, 0.9)",
  labelStroke: "rgba(125, 211, 192, 0.88)",
  labelText: "#e8f6f3",
} as const;

/**
 * Reserved screen area for FaceMirrorPanel controls (Rotate + Highlight pills).
 * Keep in sync with `.fmp-viewport-overlays` in FaceMirrorPanel.css.
 */
export const MIRROR_VIEWPORT_OVERLAY_SAFE = {
  top: 10,
  left: 10,
  width: 220,
  height: 44,
  padding: 10,
} as const;

export function mirrorViewportOverlaySafeBottom(): number {
  const z = MIRROR_VIEWPORT_OVERLAY_SAFE;
  return z.top + z.height + z.padding;
}

/** Nudge left-side callout badges so they do not sit under viewport overlay controls. */
export function avoidMirrorViewportOverlay(
  side: "left" | "right",
  calloutX: number,
  calloutY: number,
  boxW: number,
  boxH: number,
  canvasH: number,
): { x: number; y: number } {
  if (side !== "left") return { x: calloutX, y: calloutY };

  const z = MIRROR_VIEWPORT_OVERLAY_SAFE;
  const zoneRight = z.left + z.width;
  const zoneBottom = z.top + z.height;

  let x = calloutX;
  let y = calloutY;

  const overlaps = () =>
    x < zoneRight + z.padding
    && x + boxW > z.left
    && y < zoneBottom + z.padding
    && y + boxH > z.top;

  if (overlaps()) {
    y = zoneBottom + z.padding;
  }
  if (overlaps()) {
    x = zoneRight + z.padding;
  }
  if (overlaps()) {
    y = Math.min(canvasH - boxH - z.padding, y + boxH + z.padding);
  }

  return { x, y };
}
