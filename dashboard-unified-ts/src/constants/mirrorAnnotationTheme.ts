/** Shared mint/teal styling for face mirror annotations (2D photo + 3D video). */
export type MirrorAnnotationTheme = {
  regionFill: string;
  regionStroke: string;
  softFillStart: string;
  softFillMid: string;
  softFillEnd: string;
  softStroke: string;
  connector: string;
  labelFill: string;
  labelStroke: string;
  labelText: string;
};

export const MIRROR_ANNOTATION_THEME: MirrorAnnotationTheme = {
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
};

function parseHexColor(hex: string): [number, number, number] | null {
  const normalized = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

function mixChannel(base: number, target: number, amount: number): number {
  return Math.round(base + (target - base) * amount);
}

function rgba([r, g, b]: readonly [number, number, number], alpha: number): string {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Derive mirror annotation colors from a treatment/chapter accent (e.g. #2dd4bf). */
export function mirrorAnnotationThemeFromAccent(accent: string): MirrorAnnotationTheme {
  const rgb = parseHexColor(accent);
  if (!rgb) return MIRROR_ANNOTATION_THEME;

  const lighter: [number, number, number] = [
    mixChannel(rgb[0], 255, 0.38),
    mixChannel(rgb[1], 255, 0.38),
    mixChannel(rgb[2], 255, 0.38),
  ];
  const darker: [number, number, number] = [
    mixChannel(rgb[0], 0, 0.32),
    mixChannel(rgb[1], 0, 0.32),
    mixChannel(rgb[2], 0, 0.32),
  ];

  return {
    regionFill: rgba(rgb, 0.32),
    regionStroke: rgba(lighter, 0.95),
    softFillStart: rgba(rgb, 0.28),
    softFillMid: rgba(lighter, 0.16),
    softFillEnd: rgba(lighter, 0),
    softStroke: rgba(lighter, 0.55),
    connector: rgba(lighter, 0.78),
    labelFill: rgba(darker, 0.92),
    labelStroke: rgba(lighter, 0.9),
    labelText: "#f0f2f6",
  };
}

/**
 * Reserved screen area for FaceMirrorPanel viewport overlay controls (Rotate pill).
 * Regions on Aura clients live on the right tool rail, not here.
 */
export const MIRROR_VIEWPORT_OVERLAY_SAFE = {
  top: 10,
  left: 10,
  width: 120,
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
