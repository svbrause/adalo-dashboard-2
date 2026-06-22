import type { AnnotateStroke } from "../components/aura/AnnotateDrawing";
import type { Client, ClientPhotoSlot } from "../types";
import { strokesToSvgMarkup } from "./annotationComposite";
import type { AuraTanViewAngle } from "./auraTanAnglePhotos";
import type {
  PatientAuraAngleAsset,
  PatientAuraAssetManifest,
} from "./patientAuraAssets";
import { getClientFrontPhotoDisplayUrl } from "./photoLoading";
import type { SavedPatientAnnotation } from "./patientAnnotationsStorage";
import {
  isTanyaTanDemoClient,
  TANYA_TAN_SYSTEM_MEDIA,
  TANYA_TAN_SYSTEM_MEDIA_CATEGORY_LABELS,
  type TanyaTanSystemMediaCategory,
} from "./tanyaTanSystemMedia";

export type PatientMediaKind = "photo" | "video" | "annotation";

export type PatientMediaSource = "system" | "user";

export type PatientMediaItem = {
  id: string;
  kind: PatientMediaKind;
  source: PatientMediaSource;
  /** System-only subfolder (color, texture, processed, video). */
  systemCategory?: TanyaTanSystemMediaCategory;
  title: string;
  subtitle?: string;
  url?: string;
  annotation?: SavedPatientAnnotation;
  strokeCount?: number;
};

export type PatientMediaLibrarySections = {
  system: PatientMediaItem[];
  user: PatientMediaItem[];
};

const AURA_FILE_ANGLE_ORDER: AuraTanViewAngle[] = [
  "front",
  "three-quarter-left",
  "three-quarter-right",
  "profile-left",
  "profile-right",
];

const AURA_FILE_ANGLE_LABELS: Record<AuraTanViewAngle, string> = {
  front: "Front",
  "three-quarter-left": "Left three-quarter",
  "three-quarter-right": "Right three-quarter",
  "profile-left": "Left profile",
  "profile-right": "Right profile",
};

type AuraGeneratedImageField = keyof Pick<
  PatientAuraAngleAsset,
  | "srcCutout"
  | "srcTexture"
  | "srcPigmentation"
  | "srcRedness"
  | "srcPores"
  | "srcWrinkles"
  | "srcWrinklesView"
>;

const AURA_GENERATED_IMAGE_GROUPS: Array<{
  id: string;
  label: string;
  subtitle: string;
  systemCategory: TanyaTanSystemMediaCategory;
  fields: AuraGeneratedImageField[];
}> = [
  {
    id: "cutout",
    label: "Background removed",
    subtitle: "Background removed",
    systemCategory: "color_stills",
    fields: ["srcCutout"],
  },
  {
    id: "pigmentation",
    label: "Pigmentation",
    subtitle: "Pigmentation visualization",
    systemCategory: "texture_maps",
    fields: ["srcPigmentation", "srcTexture"],
  },
  {
    id: "redness",
    label: "Redness",
    subtitle: "Redness annotation",
    systemCategory: "redness_annotations",
    fields: ["srcRedness"],
  },
  {
    id: "pores",
    label: "Pores",
    subtitle: "Pore annotation",
    systemCategory: "pore_annotations",
    fields: ["srcPores"],
  },
  {
    id: "wrinkles",
    label: "Wrinkles",
    subtitle: "Wrinkle annotation",
    systemCategory: "wrinkle_annotations",
    fields: ["srcWrinklesView", "srcWrinkles"],
  },
];

function normalizedUrl(url: string | undefined): string | null {
  const trimmed = url?.trim();
  return trimmed || null;
}

function orderedAuraManifestAngles(
  manifest: PatientAuraAssetManifest,
): AuraTanViewAngle[] {
  const available = new Set(Object.keys(manifest.angles) as AuraTanViewAngle[]);
  return AURA_FILE_ANGLE_ORDER.filter((angle) => available.has(angle));
}

function auraAngleLabel(
  angle: AuraTanViewAngle,
  asset: PatientAuraAngleAsset,
): string {
  return asset.label?.trim() || AURA_FILE_ANGLE_LABELS[angle];
}

function auraCutoutUrl(asset: PatientAuraAngleAsset): string | null {
  const explicitCutout = normalizedUrl(asset.srcCutout);
  if (explicitCutout) return explicitCutout;

  const src = normalizedUrl(asset.src);
  const original = normalizedUrl(asset.srcOriginal);
  if (src && original && src !== original) return src;
  return null;
}

function auraGeneratedImageUrl(
  asset: PatientAuraAngleAsset,
  group: (typeof AURA_GENERATED_IMAGE_GROUPS)[number],
): string | null {
  if (group.id === "cutout") return auraCutoutUrl(asset);
  return (
    group.fields
      .map((field) => normalizedUrl(asset[field]))
      .find(Boolean) ?? null
  );
}

function appendGeneratedAuraMedia(
  manifest: PatientAuraAssetManifest | null | undefined,
  system: PatientMediaItem[],
  seenUrls: Set<string>,
): void {
  if (!manifest) return;

  for (const angle of orderedAuraManifestAngles(manifest)) {
    const asset = manifest.angles[angle];
    if (!asset) continue;

    const angleLabel = auraAngleLabel(angle, asset);
    for (const group of AURA_GENERATED_IMAGE_GROUPS) {
      const url = auraGeneratedImageUrl(asset, group);
      if (!url || seenUrls.has(url)) continue;

      seenUrls.add(url);
      system.push({
        id: `aura-${group.id}-${angle}`,
        kind: "photo",
        source: "system",
        systemCategory: group.systemCategory,
        title: `${angleLabel} - ${group.label}`,
        subtitle: `${group.subtitle} from upgraded analysis`,
        url,
      });
    }
  }
}

export function buildPatientMediaLibrary(input: {
  client: Client;
  photoSlots?: ClientPhotoSlot[];
  turntableVideoUrl?: string | null;
  auraManifest?: PatientAuraAssetManifest | null;
  savedAnnotations?: SavedPatientAnnotation[];
}): PatientMediaLibrarySections {
  const system: PatientMediaItem[] = [];
  const user: PatientMediaItem[] = [];
  const seenUrls = new Set<string>();

  if (isTanyaTanDemoClient(input.client)) {
    for (const entry of TANYA_TAN_SYSTEM_MEDIA) {
      if (!entry.url || seenUrls.has(entry.url)) continue;
      seenUrls.add(entry.url);
      system.push({
        id: entry.id,
        kind: entry.kind,
        source: "system",
        systemCategory: entry.category,
        title: entry.title,
        subtitle: entry.subtitle,
        url: entry.url,
      });
    }

    appendGeneratedAuraMedia(input.auraManifest, system, seenUrls);

    const video =
      input.turntableVideoUrl?.trim() ||
      input.client.turntableVideoUrl?.trim() ||
      null;
    if (video && !seenUrls.has(video)) {
      seenUrls.add(video);
      system.push({
        id: "sys-turntable-video",
        kind: "video",
        source: "system",
        systemCategory: "scan_video",
        title: "Rotating face view",
        subtitle: "From their scan",
        url: video,
      });
    }
  } else {
    const pushLegacyPhoto = (slot: ClientPhotoSlot) => {
      if (!slot.url || seenUrls.has(slot.url)) return;
      seenUrls.add(slot.url);
      system.push({
        id: `photo-${slot.id}`,
        kind: "photo",
        source: "system",
        systemCategory: "color_stills",
        title: slot.label || "Photo",
        subtitle: "Scan photo",
        url: slot.url,
      });
    };

    if (input.photoSlots?.length) {
      for (const slot of input.photoSlots) pushLegacyPhoto(slot);
    } else {
      const front = getClientFrontPhotoDisplayUrl(input.client.frontPhoto);
      if (front) {
        pushLegacyPhoto({ id: "front", label: "Front", url: front });
      }
    }

    appendGeneratedAuraMedia(input.auraManifest, system, seenUrls);

    const video =
      input.turntableVideoUrl?.trim() ||
      input.client.turntableVideoUrl?.trim() ||
      null;
    if (video && !seenUrls.has(video)) {
      seenUrls.add(video);
      system.push({
        id: "turntable-video",
        kind: "video",
        source: "system",
        systemCategory: "scan_video",
        title: "Rotating face view",
        subtitle: "From their scan",
        url: video,
      });
    }
  }

  for (const ann of input.savedAnnotations ?? []) {
    user.push({
      id: ann.id,
      kind: "annotation",
      source: "user",
      title: ann.label,
      subtitle: `${ann.viewContext} · ${ann.strokes.length} marks`,
      annotation: ann,
      strokeCount: ann.strokes.length,
    });
  }

  return { system, user };
}

export function flattenPatientMediaLibrary(
  sections: PatientMediaLibrarySections,
): PatientMediaItem[] {
  return [...sections.system, ...sections.user];
}

export function systemCategoryLabel(
  category: TanyaTanSystemMediaCategory | undefined,
): string {
  if (!category) return "System";
  return TANYA_TAN_SYSTEM_MEDIA_CATEGORY_LABELS[category] ?? "System";
}

export function annotationPreviewUrl(ann: SavedPatientAnnotation): string {
  if (ann.compositeDataUrl) return ann.compositeDataUrl;
  if (ann.faceImageUrl) return ann.faceImageUrl;
  if (ann.strokes.length === 0) return "";
  const svg = strokesToSvgMarkup(ann.strokes);
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** @deprecated Use {@link annotationPreviewUrl} */
export function annotationPreviewSvg(strokes: AnnotateStroke[]): string {
  if (strokes.length === 0) return "";
  const svg = strokesToSvgMarkup(strokes);
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
