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
import tanPng45LeftRembg from "../assets/images/45-left-rembg.png";
import tanPng90RightRembg from "../assets/images/tan_90_right_rembg.png";
import tanPng90RightRembgTexture from "../assets/images/tan_90_right_rembg_texture.png";
import tanPng90RightRembgPigmentation from "../assets/images/tan_90_right_rembg_pigmentation.png";
import tanProfileLeftWrinkles from "../assets/images/aura-tan-profile-left-wrinkles.webp";
import tanThreeQuarterLeftWrinkles from "../assets/images/aura-tan-three-quarter-left-wrinkles.webp";
import tanFrontWrinkles from "../assets/images/aura-tan-front-wrinkles.webp";
import tanThreeQuarterRightWrinkles from "../assets/images/aura-tan-three-quarter-right-wrinkles.webp";
import tanProfileRightWrinkles from "../assets/images/aura-tan-profile-right-wrinkles.webp";

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
  timeRatio: number;
  label: string;
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
    timeRatio: 0.99,
    label: "Left profile",
  },
  "three-quarter-left": {
    src: tanPng45Left,
    srcWrinkles: tanThreeQuarterLeftWrinkles,
    timeRatio: 0.76,
    label: "Left three-quarter",
  },
  front: {
    src: tanPngFront,
    srcWrinkles: tanFrontWrinkles,
    timeRatio: 0.5,
    label: "Front",
  },
  "three-quarter-right": {
    src: tanPng45Right,
    srcWrinkles: tanThreeQuarterRightWrinkles,
    timeRatio: 0.24,
    label: "Right three-quarter",
  },
  "profile-right": {
    src: tanPng90Right,
    srcWrinkles: tanProfileRightWrinkles,
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
    srcTexture: "/demo-3d/tanya-tan-profile-left-texture.png",
    timeRatio: 0.99,
    label: "Left profile",
  },
  "three-quarter-left": {
    src: tanPng45Left,
    srcTexture: tanPng45LeftRembg,
    srcPigmentation: "/demo-3d/tanya-tan-45-left-pigmentation-brown.png",
    timeRatio: 0.76,
    label: "Left three-quarter",
  },
  front: {
    src: tanPngFront,
    srcTexture: "/demo-3d/tanya-tan-front-texture.png",
    timeRatio: 0.5,
    label: "Front",
  },
  "three-quarter-right": {
    src: tanPng45Right,
    srcTexture: "/demo-3d/tanya-tan-45-right-texture.png",
    timeRatio: 0.24,
    label: "Right three-quarter",
  },
  "profile-right": {
    src: tanPng90RightRembg,
    srcTexture: tanPng90RightRembgTexture,
    srcPigmentation: tanPng90RightRembgPigmentation,
    timeRatio: 0,
    label: "Right profile",
  },
};

/** Public URLs for demo client gallery / modals (same angles as viewer assets). */
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
