import type { AnnotateStroke } from "../components/aura/AnnotateDrawing";
import type { Client, ClientPhotoSlot } from "../types";
import { strokesToSvgMarkup } from "./annotationComposite";
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

export function buildPatientMediaLibrary(input: {
  client: Client;
  photoSlots?: ClientPhotoSlot[];
  turntableVideoUrl?: string | null;
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
        title: "3D turntable",
        subtitle: "Aura scan video",
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
        subtitle: "Original image",
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
        title: "3D turntable",
        subtitle: "Generated scan video",
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
