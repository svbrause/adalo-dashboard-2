import type { AuraCvAnnotations } from "./auraCvAnnotations";
import type { ClientPhotoSlot } from "../types";
import type { AuraTanViewAngle, AuraTanViewerAngleAsset } from "./auraTanAnglePhotos";
import {
  inferAvailableViewAnglesFromPhotoSlots,
  TANYA_TAN_LEFT_NAV_ORDER,
} from "./auraTanAnglePhotos";

export type PatientAuraAngleAsset = {
  src: string;
  srcOriginal?: string;
  srcTexture?: string;
  srcPigmentation?: string;
  /** Redness baked into color photo pixels — no CSS overlay needed. */
  srcRedness?: string;
  /** Pore map baked into texture photo pixels — no CSS overlay needed. */
  srcPores?: string;
  /** Background-removed still (rembg) aligned to srcOriginal. */
  srcCutout?: string;
  /** Transparent wrinkle line cutout (RGBA webp). */
  srcWrinkles?: string;
  /** Cutout + crease lines baked for Wrinkles lens (matches evaluation composite). */
  srcWrinklesView?: string;
  timeRatio: number;
  label: string;
  fromPhoto?: boolean;
  /** Per-patient CSS transform to apply instead of the default Tanya plate-align. */
  cssTransform?: string;
  /** Default viewport pan when this angle is selected (px). */
  initialPanX?: number;
  initialPanY?: number;
  /** Override manifest viewerPhotoZoom for this angle only. */
  photoZoom?: number;
};

export type PatientAuraAssetManifest = {
  turntableVideoUrl: string;
  /** Viewport zoom for the live turntable (photos are often tighter crops). */
  viewerTurntableZoom?: number;
  /** Viewport zoom for angle stills; defaults to turntable zoom when omitted. */
  viewerPhotoZoom?: number;
  viewerInitialPanY?: number;
  textureVideoUrl?: string;
  pigmentationVideoUrl?: string;
  /** Turntable with redness baked per-frame. */
  rednessVideoUrl?: string;
  /** Turntable with pore darkening baked per-frame (greyscale base). */
  poresVideoUrl?: string;
  /** Turntable with wrinkle creases baked per-frame (cutout on black). */
  wrinklesVideoUrl?: string;
  /** Angles backed by submitted photos (¾ omitted when patient only has front + profiles). */
  availableViewAngles?: AuraTanViewAngle[];
  /** Patient-specific skin diagnostic overlay (viewBox 0–100). */
  cvAnnotations?: AuraCvAnnotations;
  angles: Partial<Record<AuraTanViewAngle, PatientAuraAngleAsset>>;
};

export function getAvailableViewAngles(
  manifest: PatientAuraAssetManifest | null | undefined,
  photoSlots: ClientPhotoSlot[],
): AuraTanViewAngle[] | undefined {
  const merged = new Set<AuraTanViewAngle>();

  for (const angle of manifest?.availableViewAngles ?? []) {
    merged.add(angle);
  }

  if (manifest?.angles) {
    for (const angle of TANYA_TAN_LEFT_NAV_ORDER) {
      const asset = manifest.angles[angle];
      if (asset?.fromPhoto) merged.add(angle);
    }
  }

  for (const angle of inferAvailableViewAnglesFromPhotoSlots(photoSlots)) {
    merged.add(angle);
  }

  const ordered = TANYA_TAN_LEFT_NAV_ORDER.filter((angle) => merged.has(angle));
  return ordered.length > 0 ? ordered : undefined;
}

const STORAGE_KEY = "patient-aura-asset-manifests";

const COURTNEY_BELLAMY_AURA_MANIFEST: PatientAuraAssetManifest = {
  turntableVideoUrl: "/demo-3d/courtney-bellamy-side-photo/courtney-bellamy-side-photo-turntable.mp4",
  textureVideoUrl: "/demo-3d/courtney-bellamy-side-photo/courtney-bellamy-side-photo-turntable.mp4",
  pigmentationVideoUrl: "/demo-3d/courtney-bellamy-side-photo/courtney-bellamy-side-photo-turntable.mp4",
  rednessVideoUrl: "/demo-3d/courtney-bellamy-side-photo/courtney-bellamy-side-photo-turntable.mp4",
  poresVideoUrl: "/demo-3d/courtney-bellamy-side-photo/courtney-bellamy-side-photo-turntable.mp4",
  wrinklesVideoUrl: "/demo-3d/courtney-bellamy-side-photo/courtney-bellamy-side-photo-turntable-wrinkles.mp4",
  availableViewAngles: ["front", "three-quarter-right", "profile-right"],
  cvAnnotations: {
    wrinkles: [],
    wrinklesByAngle: {},
    darkSpotsByAngle: {},
    redAreas: [],
    pores: [],
    volume: [],
  },
  viewerTurntableZoom: 1.92,
  viewerPhotoZoom: 1.42,
  viewerInitialPanY: -72,
  angles: {
    front: {
      src: "/demo-3d/courtney-bellamy-side-photo/courtney-bellamy-side-photo-front-rembg.png",
      srcOriginal: "/demo-3d/courtney-bellamy-side-photo/courtney-bellamy-side-photo-front-color.png",
      srcTexture: "/demo-3d/courtney-bellamy-side-photo/courtney-bellamy-side-photo-front-texture-cutout.png",
      srcPigmentation: "/demo-3d/courtney-bellamy-side-photo/courtney-bellamy-side-photo-front-pigmentation-cutout.png",
      srcRedness: "/demo-3d/courtney-bellamy-side-photo/courtney-bellamy-side-photo-front-redness-cutout.png",
      srcPores: "/demo-3d/courtney-bellamy-side-photo/courtney-bellamy-side-photo-front-pores-cutout.png",
      srcWrinkles: "/demo-3d/courtney-bellamy-side-photo/courtney-bellamy-side-photo-front-wrinkles.webp",
      srcWrinklesView: "/demo-3d/courtney-bellamy-side-photo/courtney-bellamy-side-photo-front-wrinkles-view.webp",
      cssTransform: "translate(0px, 6px) scale(0.86)",
      photoZoom: 0.88,
      timeRatio: 0.5,
      label: "Front",
      fromPhoto: true,
    },
    "three-quarter-right": {
      src: "/demo-3d/courtney-bellamy-side-photo/courtney-bellamy-side-photo-three-quarter-right-rembg.png",
      srcOriginal: "/demo-3d/courtney-bellamy-side-photo/courtney-bellamy-side-photo-three-quarter-right-color.png",
      srcTexture: "/demo-3d/courtney-bellamy-side-photo/courtney-bellamy-side-photo-three-quarter-right-texture-cutout.png",
      srcPigmentation: "/demo-3d/courtney-bellamy-side-photo/courtney-bellamy-side-photo-three-quarter-right-pigmentation-cutout.png",
      srcWrinkles: "/demo-3d/courtney-bellamy-side-photo/courtney-bellamy-side-photo-three-quarter-right-wrinkles.webp",
      srcWrinklesView: "/demo-3d/courtney-bellamy-side-photo/courtney-bellamy-side-photo-three-quarter-right-wrinkles-view.webp",
      cssTransform: "translate(-68px, -30px) scale(1.63)",
      timeRatio: 0.24,
      label: "Right three-quarter",
      fromPhoto: true,
    },
    "profile-right": {
      src: "/demo-3d/courtney-bellamy-side-photo/courtney-bellamy-side-photo-profile-right-rembg.png",
      srcOriginal: "/demo-3d/courtney-bellamy-side-photo/courtney-bellamy-side-photo-profile-right-color.png",
      srcTexture: "/demo-3d/courtney-bellamy-side-photo/courtney-bellamy-side-photo-profile-right-texture-cutout.png",
      srcPigmentation: "/demo-3d/courtney-bellamy-side-photo/courtney-bellamy-side-photo-profile-right-pigmentation-cutout.png",
      srcRedness: "/demo-3d/courtney-bellamy-side-photo/courtney-bellamy-side-photo-profile-right-redness-cutout.png",
      srcPores: "/demo-3d/courtney-bellamy-side-photo/courtney-bellamy-side-photo-profile-right-pores-cutout.png",
      srcWrinkles: "/demo-3d/courtney-bellamy-side-photo/courtney-bellamy-side-photo-profile-right-wrinkles.webp",
      srcWrinklesView: "/demo-3d/courtney-bellamy-side-photo/courtney-bellamy-side-photo-profile-right-wrinkles-view.webp",
      cssTransform: "translate(-52px, 6px) scale(1.03)",
      initialPanX: -12,
      timeRatio: 0,
      label: "Right profile",
      fromPhoto: true,
    },
  },
};

function isCourtneyBellamyName(clientName: string | null | undefined): boolean {
  return Boolean(clientName?.trim().toLowerCase().startsWith("courtney bellamy"));
}

function mergeDemoManifestFallback(
  clientName: string | null | undefined,
  manifest: PatientAuraAssetManifest | null,
): PatientAuraAssetManifest | null {
  if (!isCourtneyBellamyName(clientName)) return manifest;
  if (!manifest) return COURTNEY_BELLAMY_AURA_MANIFEST;

  const merged: PatientAuraAssetManifest = {
    ...COURTNEY_BELLAMY_AURA_MANIFEST,
    ...manifest,
    cvAnnotations: manifest.cvAnnotations
      ? {
          ...COURTNEY_BELLAMY_AURA_MANIFEST.cvAnnotations!,
          ...manifest.cvAnnotations,
          wrinkles:
            manifest.cvAnnotations.wrinkles ??
            COURTNEY_BELLAMY_AURA_MANIFEST.cvAnnotations!.wrinkles,
          darkSpotsByAngle:
            manifest.cvAnnotations.darkSpotsByAngle ??
            COURTNEY_BELLAMY_AURA_MANIFEST.cvAnnotations!.darkSpotsByAngle,
          redAreas:
            manifest.cvAnnotations.redAreas ??
            COURTNEY_BELLAMY_AURA_MANIFEST.cvAnnotations!.redAreas,
          pores:
            manifest.cvAnnotations.pores ??
            COURTNEY_BELLAMY_AURA_MANIFEST.cvAnnotations!.pores,
          volume:
            manifest.cvAnnotations.volume ??
            COURTNEY_BELLAMY_AURA_MANIFEST.cvAnnotations!.volume,
        }
      : COURTNEY_BELLAMY_AURA_MANIFEST.cvAnnotations,
    angles: { ...COURTNEY_BELLAMY_AURA_MANIFEST.angles },
  };

  for (const angle of TANYA_TAN_LEFT_NAV_ORDER) {
    const fallback = COURTNEY_BELLAMY_AURA_MANIFEST.angles[angle];
    const current = manifest.angles?.[angle];
    if (fallback || current) {
      merged.angles[angle] = {
        ...fallback,
        ...current,
        srcWrinkles: current?.srcWrinkles ?? fallback?.srcWrinkles,
        srcWrinklesView: current?.srcWrinklesView ?? fallback?.srcWrinklesView,
      } as PatientAuraAngleAsset;
    }
  }

  return merged;
}

function readMap(): Record<string, PatientAuraAssetManifest> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, PatientAuraAssetManifest>;
  } catch {
    return {};
  }
}

export function setPatientAuraManifest(
  clientName: string,
  manifest: PatientAuraAssetManifest,
): void {
  try {
    const map = readMap();
    map[clientName.trim()] = manifest;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(
      new CustomEvent("patient-aura-assets-changed", {
        detail: { clientName: clientName.trim() },
      }),
    );
  } catch {
    // localStorage may be unavailable
  }
}

export function getPatientAuraManifest(
  clientName: string | null | undefined,
): PatientAuraAssetManifest | null {
  if (!clientName) return null;
  return mergeDemoManifestFallback(clientName, readMap()[clientName.trim()] ?? null);
}

function clientSlug(clientName: string): string {
  return clientName.trim().toLowerCase().replace(/\s+/g, "-").replace(/\//g, "-").replace(/\./g, "");
}

/** Load manifest written by the scan pipeline (survives reload without localStorage). */
export async function fetchPatientAuraManifestFromDisk(
  clientName: string,
): Promise<PatientAuraAssetManifest | null> {
  const slug = clientSlug(clientName);
  try {
    const response = await fetch(`/demo-3d/${slug}/${slug}-aura-manifest.json`);
    if (!response.ok) return null;
    const manifest = mergeDemoManifestFallback(
      clientName,
      (await response.json()) as PatientAuraAssetManifest,
    );
    if (!manifest) return null;
    setPatientAuraManifest(clientName, manifest);
    return manifest;
  } catch {
    return null;
  }
}

/**
 * Fetch manifest from GCS when a patient's turntable video is already stored there.
 * Derives the manifest URL from the bucket in the turntable URL and the client slug.
 * Convention: gs://{bucket}/aura/{slug}/{slug}-aura-manifest.json
 */
export async function fetchPatientAuraManifestFromGcs(
  clientName: string,
  turntableVideoUrl: string,
): Promise<PatientAuraAssetManifest | null> {
  const match = turntableVideoUrl.match(/^https:\/\/storage\.googleapis\.com\/([^/]+)\//);
  if (!match) return null;
  const bucket = match[1];
  return fetchPatientAuraManifestFromGcsBucket(clientName, bucket);
}

export async function fetchPatientAuraManifestFromUrl(
  clientName: string,
  manifestUrl: string | null | undefined,
): Promise<PatientAuraAssetManifest | null> {
  const url = normalizeGcsUrl(manifestUrl);
  if (!url) return null;
  return fetchPatientAuraManifestFromResolvedUrl(clientName, url);
}

export async function fetchPatientAuraManifestFromGcsPrefix(
  clientName: string,
  prefix: string | null | undefined,
): Promise<PatientAuraAssetManifest | null> {
  const normalizedPrefix = normalizeGcsUrl(prefix)?.replace(/\/+$/, "");
  if (!normalizedPrefix) return null;
  const slug = clientSlug(clientName);
  const manifestUrl = normalizedPrefix.endsWith(".json")
    ? normalizedPrefix
    : `${normalizedPrefix}/${slug}-aura-manifest.json`;
  return fetchPatientAuraManifestFromResolvedUrl(clientName, manifestUrl);
}

/**
 * Try to fetch an Aura manifest from the configured GCS bucket (VITE_GCS_AURA_BUCKET).
 * Used for patients whose Airtable record doesn't yet have a turntable URL but whose
 * scan pipeline has already uploaded assets to GCS.
 */
export async function fetchPatientAuraManifestFromConfiguredBucket(
  clientName: string,
): Promise<PatientAuraAssetManifest | null> {
  const bucket = (import.meta.env as Record<string, string | undefined>)["VITE_GCS_AURA_BUCKET"]?.trim();
  if (!bucket) return null;
  return fetchPatientAuraManifestFromGcsBucket(clientName, bucket);
}

async function fetchPatientAuraManifestFromGcsBucket(
  clientName: string,
  bucket: string,
): Promise<PatientAuraAssetManifest | null> {
  const slug = clientSlug(clientName);
  const manifestUrl = `https://storage.googleapis.com/${bucket}/aura/${slug}/${slug}-aura-manifest.json`;
  return fetchPatientAuraManifestFromResolvedUrl(clientName, manifestUrl);
}

function normalizeGcsUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("gs://")) {
    return `https://storage.googleapis.com/${trimmed.slice("gs://".length)}`;
  }
  if (trimmed.startsWith("http://storage.googleapis.com/")) {
    return trimmed.replace("http://", "https://");
  }
  return trimmed;
}

async function fetchPatientAuraManifestFromResolvedUrl(
  clientName: string,
  manifestUrl: string,
): Promise<PatientAuraAssetManifest | null> {
  try {
    const url = new URL(manifestUrl, window.location.origin);
    url.searchParams.set("v", String(Date.now()));
    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) return null;
    const manifest = mergeDemoManifestFallback(
      clientName,
      (await response.json()) as PatientAuraAssetManifest,
    );
    if (!manifest) return null;
    setPatientAuraManifest(clientName, manifest);
    return manifest;
  } catch {
    return null;
  }
}

export function buildViewerAngleAssetsFromManifest(
  manifest: PatientAuraAssetManifest,
  fallbackSrc: string,
): Record<AuraTanViewAngle, AuraTanViewerAngleAsset> {
  const out = {} as Record<AuraTanViewAngle, AuraTanViewerAngleAsset>;
  for (const angle of TANYA_TAN_LEFT_NAV_ORDER) {
    const asset = manifest.angles[angle];
    if (asset) {
      const colorSrc = asset.srcOriginal ?? asset.src;
      const cutoutSrc =
        asset.srcCutout ??
        (asset.srcOriginal && asset.src !== asset.srcOriginal ? asset.src : undefined);
      out[angle] = {
        // Prefer color still for most lenses; Wrinkles lens uses srcCutout when available.
        src: colorSrc,
        srcCutout: cutoutSrc,
        srcTexture: asset.srcTexture,
        srcPigmentation: asset.srcPigmentation,
        srcRedness: asset.srcRedness,
        srcPores: asset.srcPores,
        srcWrinkles: asset.srcWrinkles,
        srcWrinklesView:
          asset.srcWrinklesView ??
          (asset.srcWrinkles
            ? asset.srcWrinkles.replace(/-wrinkles\.webp$/, "-wrinkles-view.webp")
            : undefined),
        timeRatio: asset.timeRatio,
        label: asset.label,
        cssTransform: asset.cssTransform,
        initialPanX: asset.initialPanX,
        initialPanY: asset.initialPanY,
        photoZoom: asset.photoZoom,
      };
    } else {
      out[angle] = {
        src: fallbackSrc,
        srcTexture: fallbackSrc,
        timeRatio: 0.5,
        label: angle,
      };
    }
  }
  return out;
}
