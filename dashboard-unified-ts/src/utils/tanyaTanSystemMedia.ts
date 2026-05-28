/**
 * Curated system-generated assets for the Tanya Tan Aura demo (public/demo-3d).
 * Shown under Patient files → System, separate from user-drawn annotations.
 */
import { TANYA_TAN_GALLERY_PHOTO_SLOTS } from "./auraTanAnglePhotos";

export type TanyaTanSystemMediaCategory =
  | "color_stills"
  | "texture_maps"
  | "processed_analysis"
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
  processed_analysis: "Processed analysis",
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

const TEXTURE_MAPS: TanyaTanSystemMediaEntry[] = [
  {
    id: "sys-texture-front",
    category: "texture_maps",
    kind: "photo",
    title: "Front",
    subtitle: "Grayscale texture plate",
    url: "/demo-3d/tanya-tan-front-texture.png",
  },
  {
    id: "sys-texture-45-left",
    category: "texture_maps",
    kind: "photo",
    title: "Left ¾",
    subtitle: "Grayscale texture plate",
    url: "/demo-3d/tanya-tan-45-left-texture.png",
  },
  {
    id: "sys-texture-45-right",
    category: "texture_maps",
    kind: "photo",
    title: "Right ¾",
    subtitle: "Grayscale texture plate",
    url: "/demo-3d/tanya-tan-45-right-texture.png",
  },
  {
    id: "sys-texture-profile-left",
    category: "texture_maps",
    kind: "photo",
    title: "Left profile",
    subtitle: "Grayscale texture plate",
    url: "/demo-3d/tanya-tan-profile-left-texture.png",
  },
  {
    id: "sys-texture-profile-right",
    category: "texture_maps",
    kind: "photo",
    title: "Right profile",
    subtitle: "Grayscale texture plate",
    url: "/demo-3d/tanya-tan-profile-right-texture.png",
  },
];

const PROCESSED_ANALYSIS: TanyaTanSystemMediaEntry[] = [
  {
    id: "sys-proc-front-pigment-annotated",
    category: "processed_analysis",
    kind: "photo",
    title: "Front · pigment map",
    subtitle: "Detected spots annotated",
    url: "/demo-3d/tanya-tan-front-pigment-annotated.png",
  },
  {
    id: "sys-proc-front-pigment-overlay",
    category: "processed_analysis",
    kind: "photo",
    title: "Front · pigment overlay",
    subtitle: "Analysis overlay on color",
    url: "/demo-3d/tanya-tan-front-pigment-overlay.png",
  },
  {
    id: "sys-proc-45-left-pigment-annotated",
    category: "processed_analysis",
    kind: "photo",
    title: "Left ¾ · pigment map",
    subtitle: "Detected spots annotated",
    url: "/demo-3d/tanya-tan-45-left-pigment-annotated.png",
  },
  {
    id: "sys-proc-45-left-pigment-overlay",
    category: "processed_analysis",
    kind: "photo",
    title: "Left ¾ · pigment overlay",
    subtitle: "Analysis overlay on color",
    url: "/demo-3d/tanya-tan-45-left-pigment-overlay.png",
  },
  {
    id: "sys-proc-45-left-pigment-gray",
    category: "processed_analysis",
    kind: "photo",
    title: "Left ¾ · pigment gray",
    subtitle: "Grayscale analysis view",
    url: "/demo-3d/tanya-tan-45-left-pigmentation-gray.png",
  },
  {
    id: "sys-proc-45-left-pigment-mask",
    category: "processed_analysis",
    kind: "photo",
    title: "Left ¾ · pigment mask",
    subtitle: "Spot detection mask",
    url: "/demo-3d/tanya-tan-45-left-pigmentation-mask.png",
  },
  {
    id: "sys-proc-profile-right-texture-annotated",
    category: "processed_analysis",
    kind: "photo",
    title: "Right profile · texture map",
    subtitle: "Clinical overlay on grayscale",
    url: encodeURI("/demo-3d/tanya-tan-profile-right-texture (1).png"),
  },
];

export const TANYA_TAN_SYSTEM_MEDIA: TanyaTanSystemMediaEntry[] = [
  ...COLOR_STILLS,
  ...TEXTURE_MAPS,
  ...PROCESSED_ANALYSIS,
];

export const TANYA_TAN_SYSTEM_MEDIA_ORDER: TanyaTanSystemMediaCategory[] = [
  "color_stills",
  "texture_maps",
  "processed_analysis",
  "scan_video",
];

export function isTanyaTanDemoClient(client: {
  id: string;
  name?: string | null;
}): boolean {
  return client.id === "admin-demo-tanya";
}
