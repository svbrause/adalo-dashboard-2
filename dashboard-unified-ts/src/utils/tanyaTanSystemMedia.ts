/**
 * Curated system-generated assets for the Tanya Tan Aura demo (public/demo-3d).
 * Shown under Patient files → System, separate from user-drawn annotations.
 */
import {
  TANYA_TAN_GALLERY_PHOTO_SLOTS,
  TANYA_TAN_ORIGINAL_CAPTURES,
  TANYA_TAN_VIEWER_ANGLE_ASSETS,
  type AuraTanViewAngle,
} from "./auraTanAnglePhotos";
import { demo3dAssetUrl } from "./demoAssetUrls";

export type TanyaTanSystemMediaCategory =
  | "color_stills"
  | "texture_maps"
  | "redness_annotations"
  | "pore_annotations"
  | "wrinkle_annotations"
  | "original_captures"
  | "scan_video";

export type TanyaTanSystemMediaEntry = {
  id: string;
  kind: "photo" | "video";
  category: TanyaTanSystemMediaCategory;
  title: string;
  subtitle: string;
  url: string;
};

export const TANYA_TAN_SYSTEM_MEDIA_CATEGORY_LABELS: Record<
  TanyaTanSystemMediaCategory,
  string
> = {
  color_stills: "Background removed",
  texture_maps: "Pigmentation maps",
  redness_annotations: "Redness annotations",
  pore_annotations: "Pore annotations",
  wrinkle_annotations: "Wrinkle annotations",
  original_captures: "Original photos",
  scan_video: "3D scan",
};

const COLOR_STILLS: TanyaTanSystemMediaEntry[] = TANYA_TAN_GALLERY_PHOTO_SLOTS.map(
  (slot) => ({
    id: `sys-color-${slot.id}`,
    kind: "photo" as const,
    category: "color_stills" as const,
    title: slot.label,
    subtitle: "Background removed",
    url: slot.url,
  }),
);

const TEXTURE_MAP_ANGLES: { angle: AuraTanViewAngle; id: string; title: string }[] = [
  { angle: "front", id: "sys-texture-front", title: "Front" },
  { angle: "three-quarter-left", id: "sys-texture-45-left", title: "Left ¾" },
  { angle: "three-quarter-right", id: "sys-texture-45-right", title: "Right ¾" },
  { angle: "profile-left", id: "sys-texture-profile-left", title: "Left profile" },
  { angle: "profile-right", id: "sys-texture-profile-right", title: "Right profile" },
];

/** Legacy skin-gray plates now shown as the Skin → Pigmentation lens. */
const TEXTURE_MAPS: TanyaTanSystemMediaEntry[] = TEXTURE_MAP_ANGLES.map(
  ({ angle, id, title }) => {
    const asset = TANYA_TAN_VIEWER_ANGLE_ASSETS[angle];
    return {
      id,
      category: "texture_maps",
      kind: "photo",
      title,
      subtitle: "Pigmentation annotation plate",
      url: asset.srcTexture ?? asset.src,
    };
  },
);

const REDNESS_ANNOTATIONS: TanyaTanSystemMediaEntry[] = TEXTURE_MAP_ANGLES.map(
  ({ angle, id, title }) => {
    const asset = TANYA_TAN_VIEWER_ANGLE_ASSETS[angle];
    return {
      id: id.replace("sys-texture", "sys-redness"),
      category: "redness_annotations",
      kind: "photo",
      title,
      subtitle: "Redness annotation",
      url: asset.srcRedness ?? asset.src,
    };
  },
);

const PORE_ANNOTATIONS: TanyaTanSystemMediaEntry[] = TEXTURE_MAP_ANGLES.map(
  ({ angle, id, title }) => {
    const asset = TANYA_TAN_VIEWER_ANGLE_ASSETS[angle];
    return {
      id: id.replace("sys-texture", "sys-pores"),
      category: "pore_annotations",
      kind: "photo",
      title,
      subtitle: "Pore annotation",
      url: asset.srcPores ?? asset.srcTexture ?? asset.src,
    };
  },
);

const WRINKLE_ANNOTATIONS: TanyaTanSystemMediaEntry[] = TEXTURE_MAP_ANGLES.map(
  ({ angle, id, title }) => {
    const asset = TANYA_TAN_VIEWER_ANGLE_ASSETS[angle];
    return {
      id: id.replace("sys-texture", "sys-wrinkles"),
      category: "wrinkle_annotations",
      kind: "photo",
      title,
      subtitle: "Wrinkle annotation",
      url: asset.srcWrinklesView ?? asset.srcWrinkles ?? asset.src,
    };
  },
);

const ORIGINAL_CAPTURES: TanyaTanSystemMediaEntry[] = TANYA_TAN_ORIGINAL_CAPTURES.map(
  ({ angle, label, url }) => ({
    id: `sys-original-${angle}`,
    category: "original_captures" as const,
    kind: "photo" as const,
    title: label,
    subtitle: "Uncropped camera original (JPG)",
    url,
  }),
);

const DIAGNOSTIC_VIDEOS: TanyaTanSystemMediaEntry[] = [
  {
    id: "sys-video-texture",
    category: "scan_video",
    kind: "video",
    title: "Pigmentation map turntable",
    subtitle: "Skin-gray pigmentation pass",
    url: demo3dAssetUrl("tanya-tan/tanya-tan-turntable-skin-gray.mp4"),
  },
  {
    id: "sys-video-pigmentation",
    category: "scan_video",
    kind: "video",
    title: "Brown pigmentation turntable",
    subtitle: "Pigmentation annotation video",
    url: demo3dAssetUrl("tanya-tan/tanya-tan-turntable-pigmentation.mp4"),
  },
  {
    id: "sys-video-redness",
    category: "scan_video",
    kind: "video",
    title: "Redness turntable",
    subtitle: "Redness annotation video",
    url: demo3dAssetUrl("tanya-tan/tanya-tan-turntable-redness.mp4"),
  },
  {
    id: "sys-video-pores",
    category: "scan_video",
    kind: "video",
    title: "Pores turntable",
    subtitle: "Pore annotation video",
    url: demo3dAssetUrl("tanya-tan/tanya-tan-turntable-pores.mp4"),
  },
  {
    id: "sys-video-wrinkles",
    category: "scan_video",
    kind: "video",
    title: "Wrinkles turntable",
    subtitle: "Per-frame crease annotation video",
    url: demo3dAssetUrl("tanya-tan/tanya-tan-turntable-wrinkles.mp4"),
  },
];

export const TANYA_TAN_SYSTEM_MEDIA: TanyaTanSystemMediaEntry[] = [
  ...COLOR_STILLS,
  ...TEXTURE_MAPS,
  ...REDNESS_ANNOTATIONS,
  ...PORE_ANNOTATIONS,
  ...WRINKLE_ANNOTATIONS,
  ...ORIGINAL_CAPTURES,
  ...DIAGNOSTIC_VIDEOS,
];

export const TANYA_TAN_SYSTEM_MEDIA_ORDER: TanyaTanSystemMediaCategory[] = [
  "original_captures",
  "color_stills",
  "texture_maps",
  "redness_annotations",
  "pore_annotations",
  "wrinkle_annotations",
  "scan_video",
];

export function isTanyaTanDemoClient(client: {
  id: string;
  name?: string | null;
}): boolean {
  if (client.id.endsWith("-demo-tanya")) return true;
  return client.id === "admin-demo-tanya";
}
