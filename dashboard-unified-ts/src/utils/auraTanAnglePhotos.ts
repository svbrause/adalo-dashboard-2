/**
 * Full-resolution Tanya Tan angle stills (2316×3088 PNG) for the Aura face mirror.
 * Viewer-left/right labels match the dashboard turntable column (not camera roll).
 */
import type { ClientPhotoSlot } from "../types";
import tanPngFront from "../assets/images/tan_front.png";
import tanPng45Left from "../assets/images/tan_45_left.png";
import tanPng45Right from "../assets/images/tan_45_right.png";
import tanPng90Left from "../assets/images/tan_90_left.png";
import tanPng90Right from "../assets/images/tan_90_right.png";
import tanJpgFront from "../assets/images/tan_front.JPG";
import tanJpg45Left from "../assets/images/tan_45_left.JPG";
import tanJpg45Right from "../assets/images/tan_45_right.JPG";
import tanJpg90Left from "../assets/images/tan_90_left.JPG";
import tanJpg90Right from "../assets/images/tan_90_right.JPG";
import tanPng45LeftRembg from "../assets/images/45-left-rembg.png";
import tanPng90RightRembg from "../assets/images/tan_90_right_rembg.png";
import tanPng90RightRembgTexture from "../assets/images/tan_90_right_rembg_texture.png";
import tanPng90RightRembgPigmentation from "../assets/images/tan_90_right_rembg_pigmentation.png";
import tanProfileLeftWrinkles from "../assets/images/aura-tan-profile-left-wrinkles.webp";
import tanProfileLeftWrinklesView from "../assets/images/aura-tan-profile-left-wrinkles-view.webp";
import tanThreeQuarterLeftWrinkles from "../assets/images/aura-tan-three-quarter-left-wrinkles.webp";
import tanThreeQuarterLeftWrinklesView from "../assets/images/aura-tan-three-quarter-left-wrinkles-view.webp";
import tanFrontWrinkles from "../assets/images/aura-tan-front-wrinkles.webp";
import tanFrontWrinklesView from "../assets/images/aura-tan-front-wrinkles-view.webp";
import tanThreeQuarterRightWrinkles from "../assets/images/aura-tan-three-quarter-right-wrinkles.webp";
import tanThreeQuarterRightWrinklesView from "../assets/images/aura-tan-three-quarter-right-wrinkles-view.webp";
import tanProfileRightWrinkles from "../assets/images/aura-tan-profile-right-wrinkles.webp";
import tanProfileRightWrinklesView from "../assets/images/aura-tan-profile-right-wrinkles-view.webp";

export type AuraTanViewAngle =
  | "profile-left"
  | "three-quarter-left"
  | "front"
  | "three-quarter-right"
  | "profile-right";

export type AuraTanViewerAngleAsset = {
  src: string;
  /** Clinical texture map for Texture tab. */
  srcTexture?: string;
  /** Clinical pigment map for Pigmentation tab. */
  srcPigmentation?: string;
  /** Redness overlay baked into color photo — used instead of CSS mask overlay. */
  srcRedness?: string;
  /** Pore map baked into texture photo — used instead of CSS mask overlay. */
  srcPores?: string;
  /** Background-removed still (rembg); used as base in Wrinkles lens when present. */
  srcCutout?: string;
  /** Transparent wrinkle line cutout (RGBA webp). */
  srcWrinkles?: string;
  /** Baked cutout + crease lines for Wrinkles lens display. */
  srcWrinklesView?: string;
  timeRatio: number;
  label: string;
  /** Per-patient CSS transform override — replaces the default Tanya plate-align when present. */
  cssTransform?: string;
  initialPanX?: number;
  initialPanY?: number;
  photoZoom?: number;
};

export type AuraTanBlendAngleAsset = AuraTanViewerAngleAsset & {
  /** CV-processed wrinkle plate (still webp); base photo is full-res PNG. */
  srcWrinkles: string;
};

/** Left-rail order: viewer L → front → viewer R (matches AuraFaceView). */
export const TANYA_TAN_LEFT_NAV_ORDER: AuraTanViewAngle[] = [
  "profile-left",
  "three-quarter-left",
  "front",
  "three-quarter-right",
  "profile-right",
];

/**
 * Studio / camera-roll labels (used on `/aura` turntable photo crossfade).
 * Matches `scripts/generate-aura-cv-assets.py` angle names.
 */
export const TANYA_TAN_STUDIO_ANGLE_ASSETS: Record<AuraTanViewAngle, AuraTanBlendAngleAsset> = {
  "profile-left": {
    src: tanPng90Left,
    srcWrinkles: tanProfileLeftWrinkles,
    srcWrinklesView: tanProfileLeftWrinklesView,
    timeRatio: 0.99,
    label: "Left profile",
  },
  "three-quarter-left": {
    src: tanPng45Left,
    srcWrinkles: tanThreeQuarterLeftWrinkles,
    srcWrinklesView: tanThreeQuarterLeftWrinklesView,
    timeRatio: 0.76,
    label: "Left three-quarter",
  },
  front: {
    src: tanPngFront,
    srcWrinkles: tanFrontWrinkles,
    srcWrinklesView: tanFrontWrinklesView,
    timeRatio: 0.5,
    label: "Front",
  },
  "three-quarter-right": {
    src: tanPng45Right,
    srcWrinkles: tanThreeQuarterRightWrinkles,
    srcWrinklesView: tanThreeQuarterRightWrinklesView,
    timeRatio: 0.24,
    label: "Right three-quarter",
  },
  "profile-right": {
    src: tanPng90Right,
    srcWrinkles: tanProfileRightWrinkles,
    srcWrinklesView: tanProfileRightWrinklesView,
    timeRatio: 0,
    label: "Right profile",
  },
};

/**
 * Dashboard turntable column: viewer-left/right labels matched to photos + turntable timing.
 */
export const TANYA_TAN_VIEWER_ANGLE_ASSETS: Record<AuraTanViewAngle, AuraTanViewerAngleAsset> = {
  "profile-left": {
    src: tanPng90Left,
    srcWrinkles: tanProfileLeftWrinkles,
    srcWrinklesView: tanProfileLeftWrinklesView,
    srcTexture: "/demo-3d/tanya-tan-profile-left-texture.png",
    srcRedness: "/demo-3d/tanya-tan/tanya-tan-profile-left-redness-cutout.png",
    srcPores: "/demo-3d/tanya-tan/tanya-tan-profile-left-pores-cutout.png",
    timeRatio: 0.99,
    label: "Left profile",
  },
  "three-quarter-left": {
    src: tanPng45Left,
    srcWrinkles: tanThreeQuarterLeftWrinkles,
    srcWrinklesView: tanThreeQuarterLeftWrinklesView,
    srcTexture: tanPng45LeftRembg,
    srcPigmentation: "/demo-3d/tanya-tan-45-left-pigmentation-brown.png",
    srcRedness: "/demo-3d/tanya-tan/tanya-tan-three-quarter-left-redness-cutout.png",
    srcPores: "/demo-3d/tanya-tan/tanya-tan-three-quarter-left-pores-cutout.png",
    timeRatio: 0.76,
    label: "Left three-quarter",
  },
  front: {
    src: tanPngFront,
    srcWrinkles: tanFrontWrinkles,
    srcWrinklesView: tanFrontWrinklesView,
    srcTexture: "/demo-3d/tanya-tan-front-texture.png",
    srcRedness: "/demo-3d/tanya-tan/tanya-tan-front-redness-cutout.png",
    srcPores: "/demo-3d/tanya-tan/tanya-tan-front-pores-cutout.png",
    timeRatio: 0.5,
    label: "Front",
  },
  "three-quarter-right": {
    src: tanPng45Right,
    srcWrinkles: tanThreeQuarterRightWrinkles,
    srcWrinklesView: tanThreeQuarterRightWrinklesView,
    srcTexture: "/demo-3d/tanya-tan-45-right-texture.png",
    srcRedness: "/demo-3d/tanya-tan/tanya-tan-three-quarter-right-redness-cutout.png",
    srcPores: "/demo-3d/tanya-tan/tanya-tan-three-quarter-right-pores-cutout.png",
    timeRatio: 0.24,
    label: "Right three-quarter",
  },
  "profile-right": {
    src: tanPng90RightRembg,
    srcWrinkles: tanProfileRightWrinkles,
    srcWrinklesView: tanProfileRightWrinklesView,
    srcTexture: tanPng90RightRembgTexture,
    srcPigmentation: tanPng90RightRembgPigmentation,
    srcRedness: "/demo-3d/tanya-tan/tanya-tan-profile-right-redness-cutout.png",
    srcPores: "/demo-3d/tanya-tan/tanya-tan-profile-right-pores-cutout.png",
    timeRatio: 0,
    label: "Right profile",
  },
};

/** Uncropped in-camera JPGs from the original Aura capture session. */
export const TANYA_TAN_ORIGINAL_CAPTURES: {
  angle: AuraTanViewAngle;
  label: string;
  url: string;
}[] = [
  { angle: "profile-left", label: "Left profile", url: tanJpg90Left },
  { angle: "three-quarter-left", label: "Left ¾", url: tanJpg45Left },
  { angle: "front", label: "Front", url: tanJpgFront },
  { angle: "three-quarter-right", label: "Right ¾", url: tanJpg45Right },
  { angle: "profile-right", label: "Right profile", url: tanJpg90Right },
];

/** Public URLs for demo client gallery / modals (same angles as viewer assets). */
const VIEWER_ANGLE_TIME_RATIOS: Record<AuraTanViewAngle, number> = {
  "profile-left": 0.99,
  "three-quarter-left": 0.76,
  front: 0.5,
  "three-quarter-right": 0.24,
  "profile-right": 0,
};

const VIEWER_ANGLE_LABELS: Record<AuraTanViewAngle, string> = {
  "profile-left": "Left profile",
  "three-quarter-left": "Left three-quarter",
  front: "Front",
  "three-quarter-right": "Right three-quarter",
  "profile-right": "Right profile",
};

function slotUrl(slots: ClientPhotoSlot[], ...ids: string[]): string | undefined {
  for (const id of ids) {
    const hit = slots.find((s) => s.id === id);
    if (hit?.url) return hit.url;
  }
  return undefined;
}

function isConsentPhotoSlot(slot: ClientPhotoSlot): boolean {
  const blob = `${slot.id} ${slot.label ?? ""}`.toLowerCase();
  return blob.includes("consent");
}

type SideSlotKind = "front" | "left" | "right" | "generic-side" | "other";

function classifyPhotoSlot(slot: ClientPhotoSlot): SideSlotKind {
  const id = slot.id.toLowerCase();
  const blob = `${slot.id} ${slot.label ?? ""}`.toLowerCase();

  if (id === "front" || id === "front-form" || blob.includes("front")) return "front";
  if (blob.includes("three-quarter")) return "other";
  if (id === "left-form" || id === "profile-left" || blob.includes("profile-left")) return "left";
  if (id === "side-form" || id === "profile-right" || blob.includes("profile-right")) return "right";
  if (blob.includes("left") && (blob.includes("90") || blob.includes("profile") || blob.includes("side"))) {
    return "left";
  }
  if (blob.includes("right") && (blob.includes("90") || blob.includes("profile") || blob.includes("side"))) {
    return "right";
  }
  if (id === "side" || (blob.includes("side") && !blob.includes("left") && !blob.includes("right"))) {
    return "generic-side";
  }
  if (blob.includes("left")) return "left";
  if (blob.includes("right")) return "right";
  return "other";
}

/**
 * Maps patient gallery slots to Aura turntable anchor stills.
 * Missing angles reuse the closest available photo (front fallback).
 */
/** Which turntable anchor stills the patient actually captured (excludes synthetic ¾ fills). */
export function inferAvailableViewAnglesFromPhotoSlots(
  slots: ClientPhotoSlot[],
): AuraTanViewAngle[] {
  const found = new Set<AuraTanViewAngle>();
  const photoSlots = slots.filter((s) => Boolean(s.url) && !isConsentPhotoSlot(s));

  let hasLeftProfile = false;
  let hasRightProfile = false;
  let hasGenericSide = false;

  for (const slot of photoSlots) {
    const blob = `${slot.id} ${slot.label ?? ""}`.toLowerCase();
    const kind = classifyPhotoSlot(slot);

    if (kind === "front") found.add("front");
    if (blob.includes("left") && blob.includes("45")) found.add("three-quarter-left");
    else if (blob.includes("right") && blob.includes("45")) found.add("three-quarter-right");
    else if (blob.includes("three-quarter-left") || slot.id === "three-quarter-left") {
      found.add("three-quarter-left");
    } else if (blob.includes("three-quarter-right") || slot.id === "three-quarter-right") {
      found.add("three-quarter-right");
    }

    if (kind === "left") hasLeftProfile = true;
    else if (kind === "right") hasRightProfile = true;
    else if (kind === "generic-side") hasGenericSide = true;
  }

  if (hasLeftProfile) found.add("profile-left");
  if (hasRightProfile) found.add("profile-right");

  if (hasGenericSide) {
    if (!hasLeftProfile && !hasRightProfile) {
      found.add("profile-right");
    } else if (hasLeftProfile && !hasRightProfile) {
      found.add("profile-right");
    } else if (hasRightProfile && !hasLeftProfile) {
      found.add("profile-left");
    }
  }

  if (found.size === 0 && photoSlots.length > 0) {
    found.add("front");
  }

  return TANYA_TAN_LEFT_NAV_ORDER.filter((angle) => found.has(angle));
}

export function buildViewerAngleAssetsFromPhotoSlots(
  slots: ClientPhotoSlot[],
): Record<AuraTanViewAngle, AuraTanViewerAngleAsset> {
  const fallbackUrl = slots.find((s) => s.url)?.url ?? "";
  const pick = (angle: AuraTanViewAngle): string => {
    switch (angle) {
      case "profile-left":
        return slotUrl(slots, "profile-left", "left-form") ?? fallbackUrl;
      case "three-quarter-left":
        return slotUrl(slots, "three-quarter-left", "left-form") ?? fallbackUrl;
      case "front":
        return slotUrl(slots, "front", "front-form") ?? fallbackUrl;
      case "three-quarter-right":
        return slotUrl(slots, "three-quarter-right", "side-form", "side") ?? fallbackUrl;
      case "profile-right":
        return slotUrl(slots, "profile-right", "side", "side-form") ?? fallbackUrl;
      default:
        return fallbackUrl;
    }
  };

  const out = {} as Record<AuraTanViewAngle, AuraTanViewerAngleAsset>;
  for (const angle of TANYA_TAN_LEFT_NAV_ORDER) {
    const src = pick(angle);
    out[angle] = {
      src,
      srcTexture: src,
      timeRatio: VIEWER_ANGLE_TIME_RATIOS[angle],
      label: VIEWER_ANGLE_LABELS[angle],
    };
  }
  return out;
}

export const TANYA_TAN_GALLERY_PHOTO_SLOTS: ClientPhotoSlot[] = [
  {
    id: "profile-left",
    label: "Left profile",
    url: "/demo-3d/tanya-tan-profile-left.png",
  },
  {
    id: "three-quarter-left",
    label: "Left ¾",
    url: "/demo-3d/tanya-tan-45-left.png",
  },
  { id: "front", label: "Front", url: "/demo-3d/tanya-tan-front.png" },
  {
    id: "three-quarter-right",
    label: "Right ¾",
    url: "/demo-3d/tanya-tan-45-right.png",
  },
  {
    id: "profile-right",
    label: "Right profile",
    url: "/demo-3d/tanya-tan-profile-right.png",
  },
];
