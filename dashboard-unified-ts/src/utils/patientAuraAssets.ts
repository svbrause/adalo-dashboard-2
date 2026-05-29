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
  timeRatio: number;
  label: string;
  fromPhoto?: boolean;
};

export type PatientAuraAssetManifest = {
  turntableVideoUrl: string;
  textureVideoUrl?: string;
  pigmentationVideoUrl?: string;
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
  return readMap()[clientName.trim()] ?? null;
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
    const manifest = (await response.json()) as PatientAuraAssetManifest;
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
      out[angle] = {
        src: asset.src,
        srcTexture: asset.srcTexture,
        srcPigmentation: asset.srcPigmentation,
        timeRatio: asset.timeRatio,
        label: asset.label,
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
