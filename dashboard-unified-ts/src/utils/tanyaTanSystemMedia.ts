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

export type TanyaTanSystemMediaCategory =
  | "color_stills"
  | "texture_maps"
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
  color_stills: "Color photos",
  texture_maps: "Clinical texture",
  original_captures: "Original photos",
  scan_video: "3D scan",
};

const COLOR_STILLS: TanyaTanSystemMediaEntry[] = TANYA_TAN_GALLERY_PHOTO_SLOTS.map(
  (slot) => ({
    id: `sys-color-${slot.id}`,
    kind: "photo" as const,
    category: "color_stills" as const,
    title: slot.label,
    subtitle: "Full-color capture",
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

/** Same clinical texture plates as the Aura left-rail / Skin tab (viewer angle assets). */
const TEXTURE_MAPS: TanyaTanSystemMediaEntry[] = TEXTURE_MAP_ANGLES.map(
  ({ angle, id, title }) => {
    const asset = TANYA_TAN_VIEWER_ANGLE_ASSETS[angle];
    return {
      id,
      category: "texture_maps",
      kind: "photo",
      title,
      subtitle: "Grayscale texture plate",
      url: asset.srcTexture ?? asset.src,
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

export const TANYA_TAN_SYSTEM_MEDIA: TanyaTanSystemMediaEntry[] = [
  ...COLOR_STILLS,
  ...TEXTURE_MAPS,
  ...ORIGINAL_CAPTURES,
];

export const TANYA_TAN_SYSTEM_MEDIA_ORDER: TanyaTanSystemMediaCategory[] = [
  "original_captures",
  "color_stills",
  "texture_maps",
  "scan_video",
];

export function isTanyaTanDemoClient(client: {
  id: string;
  name?: string | null;
}): boolean {
  return client.id === "admin-demo-tanya";
}
