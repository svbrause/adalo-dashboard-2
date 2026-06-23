import type { AuraCvAnnotations } from "./auraCvAnnotations";
import type { ClientPhotoSlot } from "../types";
import type { AuraTanViewAngle, AuraTanViewerAngleAsset } from "./auraTanAnglePhotos";
import {
  inferAvailableViewAnglesFromPhotoSlots,
  TANYA_TAN_LEFT_NAV_ORDER,
  VIEWER_ANGLE_TIME_RATIOS,
} from "./auraTanAnglePhotos";

/** Remember GCS manifest URLs / patient slugs that returned 404 for this session. */
const missingPatientAuraManifestUrls = new Set<string>();
const missingPatientAuraManifestSlugs = new Set<string>();
const MISSING_MANIFEST_SLUGS_KEY = "patient-aura-missing-manifest-slugs";
const patientAuraManifestFetchInFlight = new Map<
  string,
  Promise<PatientAuraAssetManifest | null>
>();

function loadMissingManifestSlugs(): void {
  try {
    const raw = sessionStorage.getItem(MISSING_MANIFEST_SLUGS_KEY);
    if (!raw) return;
    for (const slug of JSON.parse(raw) as string[]) {
      missingPatientAuraManifestSlugs.add(slug);
    }
  } catch {
    /* ignore */
  }
}

function persistMissingManifestSlugs(): void {
  try {
    sessionStorage.setItem(
      MISSING_MANIFEST_SLUGS_KEY,
      JSON.stringify([...missingPatientAuraManifestSlugs]),
    );
  } catch {
    /* ignore */
  }
}

loadMissingManifestSlugs();

function patientAuraManifestCacheKey(manifestUrl: string): string {
  try {
    const url = new URL(manifestUrl, window.location.origin);
    url.search = "";
    return url.toString();
  } catch {
    return manifestUrl;
  }
}

function rememberMissingPatientAuraManifest(
  manifestUrl: string,
  clientName?: string,
): void {
  missingPatientAuraManifestUrls.add(patientAuraManifestCacheKey(manifestUrl));
  const slug =
    clientName != null
      ? clientSlug(clientName)
      : manifestUrl.match(/\/aura\/([^/]+)\//)?.[1];
  if (slug) {
    missingPatientAuraManifestSlugs.add(slug);
    persistMissingManifestSlugs();
  }
}

function clearMissingManifestSlug(clientName: string): void {
  const slug = clientSlug(clientName);
  if (!missingPatientAuraManifestSlugs.delete(slug)) return;
  persistMissingManifestSlugs();
}

function isPatientAuraManifestSlugMissing(clientName: string): boolean {
  return missingPatientAuraManifestSlugs.has(clientSlug(clientName));
}

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

function cutoutSrcForAngleAsset(
  asset: PatientAuraAngleAsset | null | undefined,
): string | undefined {
  if (!asset) return undefined;
  if (asset.srcCutout) return asset.srcCutout;
  if (asset.srcOriginal && asset.src && asset.src !== asset.srcOriginal) {
    return asset.src;
  }
  return undefined;
}

type GeneratedAuraStillAssetCandidate = {
  src?: string;
  srcCutout?: string;
  srcTexture?: string;
  srcPigmentation?: string;
  srcRedness?: string;
  srcPores?: string;
  srcWrinkles?: string;
  srcWrinklesView?: string;
};

const GENERATED_AURA_STILL_URL =
  /(?:\/aura\/|-(?:rembg|texture-cutout|pigmentation-cutout|redness-cutout|pores-cutout|wrinkles|wrinkles-view)\.(?:png|jpe?g|webp)(?:$|[?#]))/i;

function isGeneratedAuraStillUrl(value: string | null | undefined): boolean {
  return Boolean(value?.trim() && GENERATED_AURA_STILL_URL.test(value));
}

export function hasGeneratedAuraStillAssets(
  asset: GeneratedAuraStillAssetCandidate | null | undefined,
): boolean {
  if (!asset) return false;
  return [
    asset.src,
    asset.srcCutout,
    asset.srcTexture,
    asset.srcPigmentation,
    asset.srcRedness,
    asset.srcPores,
    asset.srcWrinkles,
    asset.srcWrinklesView,
  ].some(isGeneratedAuraStillUrl);
}

export function cacheBustAuraAssetUrl(
  value: string | null | undefined,
  token: string | number,
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || /^(blob|data):/i.test(trimmed)) return value ?? undefined;

  try {
    const isRootRelative = trimmed.startsWith("/");
    const url = new URL(
      trimmed,
      isRootRelative ? "https://ponce.local" : undefined,
    );
    if (
      url.searchParams.has("X-Goog-Signature") ||
      url.searchParams.has("X-Amz-Signature")
    ) {
      return trimmed;
    }
    url.searchParams.set("auraRefresh", String(token));
    return isRootRelative ? `${url.pathname}${url.search}${url.hash}` : url.toString();
  } catch {
    return trimmed;
  }
}

export function cacheBustPatientAuraManifest(
  manifest: PatientAuraAssetManifest,
  token: string | number,
): PatientAuraAssetManifest {
  const bust = (url: string | null | undefined): string | undefined =>
    cacheBustAuraAssetUrl(url, token);
  const bustAngleUrlMap = (
    urls: Partial<Record<AuraTanViewAngle, string>> | undefined,
  ): Partial<Record<AuraTanViewAngle, string>> | undefined => {
    if (!urls) return urls;
    return Object.fromEntries(
      Object.entries(urls).map(([angle, url]) => [angle, bust(url) ?? url]),
    ) as Partial<Record<AuraTanViewAngle, string>>;
  };

  const angles: PatientAuraAssetManifest["angles"] = {};
  for (const [angle, asset] of Object.entries(manifest.angles ?? {})) {
    if (!asset) continue;
    angles[angle as AuraTanViewAngle] = {
      ...asset,
      src: bust(asset.src) ?? asset.src,
      srcOriginal: bust(asset.srcOriginal),
      srcTexture: bust(asset.srcTexture),
      srcPigmentation: bust(asset.srcPigmentation),
      srcRedness: bust(asset.srcRedness),
      srcPores: bust(asset.srcPores),
      srcCutout: bust(asset.srcCutout),
      srcWrinkles: bust(asset.srcWrinkles),
      srcWrinklesView: bust(asset.srcWrinklesView),
    };
  }

  const cv = manifest.cvAnnotations;
  const cvAnnotations =
    cv == null
      ? cv
      : {
          ...cv,
          redMaskByAngle: bustAngleUrlMap(cv.redMaskByAngle),
          poreMaskByAngle: bustAngleUrlMap(cv.poreMaskByAngle),
        };

  return {
    ...manifest,
    turntableVideoUrl:
      bust(manifest.turntableVideoUrl) ?? manifest.turntableVideoUrl,
    textureVideoUrl: bust(manifest.textureVideoUrl),
    pigmentationVideoUrl: bust(manifest.pigmentationVideoUrl),
    rednessVideoUrl: bust(manifest.rednessVideoUrl),
    poresVideoUrl: bust(manifest.poresVideoUrl),
    wrinklesVideoUrl: bust(manifest.wrinklesVideoUrl),
    cvAnnotations,
    angles,
  };
}

function manifestCutoutAssetCount(
  manifest: PatientAuraAssetManifest | null | undefined,
): number {
  if (!manifest?.angles) return 0;
  return Object.values(manifest.angles).filter((asset) =>
    Boolean(cutoutSrcForAngleAsset(asset)),
  ).length;
}

function manifestSkinLensAssetCount(
  manifest: PatientAuraAssetManifest | null | undefined,
): number {
  if (!manifest?.angles) return 0;
  let count = 0;
  for (const asset of Object.values(manifest.angles)) {
    if (asset.srcPigmentation) count += 1;
    if (asset.srcRedness) count += 1;
    if (asset.srcPores) count += 1;
    if (asset.srcWrinkles || asset.srcWrinklesView) count += 1;
  }
  return count;
}

/** Prefer manifests with skin-lens stills, then cutout coverage. */
export function pickPreferredPatientAuraManifest(
  ...candidates: Array<PatientAuraAssetManifest | null | undefined>
): PatientAuraAssetManifest | null {
  const valid = candidates.filter(
    (manifest): manifest is PatientAuraAssetManifest =>
      Boolean(manifest && Object.keys(manifest.angles ?? {}).length > 0),
  );
  if (valid.length === 0) {
    return candidates.find(Boolean) ?? null;
  }

  return valid.sort((a, b) => {
    const skinDelta =
      manifestSkinLensAssetCount(b) - manifestSkinLensAssetCount(a);
    if (skinDelta !== 0) return skinDelta;
    return manifestCutoutAssetCount(b) - manifestCutoutAssetCount(a);
  })[0]!;
}

function richerAuraManifest(
  primary: PatientAuraAssetManifest,
  ...candidates: Array<PatientAuraAssetManifest | null | undefined>
): PatientAuraAssetManifest {
  let best = primary;
  let bestCutoutCount = manifestCutoutAssetCount(best);

  for (const candidate of candidates) {
    const count = manifestCutoutAssetCount(candidate);
    if (candidate && count > bestCutoutCount) {
      best = candidate;
      bestCutoutCount = count;
    }
  }

  return best;
}

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
      if (
        asset?.fromPhoto ||
        asset?.src ||
        asset?.srcOriginal ||
        cutoutSrcForAngleAsset(asset) ||
        hasGeneratedAuraStillAssets(asset)
      ) {
        merged.add(angle);
      }
    }
  }

  for (const angle of inferAvailableViewAnglesFromPhotoSlots(photoSlots)) {
    merged.add(angle);
  }

  const ordered = TANYA_TAN_LEFT_NAV_ORDER.filter((angle) => merged.has(angle));
  return ordered.length > 0 ? ordered : undefined;
}

const STORAGE_KEY = "patient-aura-asset-manifests";

const COURTNEY_BELLAMY_GCS_AURA_BASE =
  "https://storage.googleapis.com/test-deploy-august25/aura/courtney-bellamy";

function courtneyBellamyAuraUrl(filename: string): string {
  return `${COURTNEY_BELLAMY_GCS_AURA_BASE}/${filename}`;
}

const COURTNEY_BELLAMY_AURA_MANIFEST: PatientAuraAssetManifest = {
  turntableVideoUrl: courtneyBellamyAuraUrl("courtney-bellamy-turntable-skin-gray.mp4"),
  textureVideoUrl: courtneyBellamyAuraUrl("courtney-bellamy-turntable-skin-gray.mp4"),
  pigmentationVideoUrl: courtneyBellamyAuraUrl("courtney-bellamy-turntable-pigmentation.mp4"),
  rednessVideoUrl: courtneyBellamyAuraUrl("courtney-bellamy-turntable-redness.mp4"),
  poresVideoUrl: courtneyBellamyAuraUrl("courtney-bellamy-turntable-pores.mp4"),
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
      src: courtneyBellamyAuraUrl("courtney-bellamy-front-rembg-solid-v4.png"),
      srcOriginal: courtneyBellamyAuraUrl("courtney-bellamy-front-color.png"),
      srcTexture: courtneyBellamyAuraUrl("courtney-bellamy-front-texture-cutout-solid-v4.png"),
      srcPigmentation: courtneyBellamyAuraUrl("courtney-bellamy-front-pigmentation-cutout-solid-v4.png"),
      srcRedness: courtneyBellamyAuraUrl("courtney-bellamy-front-redness-cutout-solid-v4.png"),
      srcPores: courtneyBellamyAuraUrl("courtney-bellamy-front-pores-cutout-solid-v4.png"),
      cssTransform: "translate(0px, 6px) scale(0.86)",
      photoZoom: 0.88,
      timeRatio: 0.5,
      label: "Front",
      fromPhoto: true,
    },
    "three-quarter-right": {
      src: courtneyBellamyAuraUrl("courtney-bellamy-three-quarter-right-rembg-solid-v4.png"),
      srcOriginal: courtneyBellamyAuraUrl("courtney-bellamy-three-quarter-right-color.png"),
      srcTexture: courtneyBellamyAuraUrl("courtney-bellamy-three-quarter-right-texture-cutout-solid-v4.png"),
      srcPigmentation: courtneyBellamyAuraUrl("courtney-bellamy-three-quarter-right-pigmentation-cutout-solid-v4.png"),
      srcRedness: courtneyBellamyAuraUrl("courtney-bellamy-three-quarter-right-redness-cutout-solid-v4.png"),
      srcPores: courtneyBellamyAuraUrl("courtney-bellamy-three-quarter-right-pores-cutout-solid-v4.png"),
      cssTransform: "translate(-68px, -30px) scale(1.63)",
      timeRatio: 0.24,
      label: "Right three-quarter",
      fromPhoto: true,
    },
    "profile-right": {
      src: courtneyBellamyAuraUrl("courtney-bellamy-profile-right-rembg-solid-v4.png"),
      srcOriginal: courtneyBellamyAuraUrl("courtney-bellamy-profile-right-color.png"),
      srcTexture: courtneyBellamyAuraUrl("courtney-bellamy-profile-right-texture-cutout-solid-v4.png"),
      srcPigmentation: courtneyBellamyAuraUrl("courtney-bellamy-profile-right-pigmentation-cutout-solid-v4.png"),
      srcRedness: courtneyBellamyAuraUrl("courtney-bellamy-profile-right-redness-cutout-solid-v4.png"),
      srcPores: courtneyBellamyAuraUrl("courtney-bellamy-profile-right-pores-cutout-solid-v4.png"),
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
  clearMissingManifestSlug(clientName);
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
  return clientName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/\//g, "-")
    .replace(/\./g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
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
  if (!bucket || isPatientAuraManifestSlugMissing(clientName)) return null;
  return fetchPatientAuraManifestFromGcsBucket(clientName, bucket);
}

async function fetchPatientAuraManifestFromGcsBucket(
  clientName: string,
  bucket: string,
): Promise<PatientAuraAssetManifest | null> {
  const slug = clientSlug(clientName);
  if (missingPatientAuraManifestSlugs.has(slug)) return null;
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

function storageBucketFromUrl(value: string | null | undefined): string | undefined {
  const normalized = normalizeGcsUrl(value);
  return normalized?.match(/^https:\/\/storage\.googleapis\.com\/([^/]+)\//)?.[1];
}

async function fetchPatientAuraManifestFromResolvedUrl(
  clientName: string,
  manifestUrl: string,
): Promise<PatientAuraAssetManifest | null> {
  const cacheKey = patientAuraManifestCacheKey(manifestUrl);
  if (missingPatientAuraManifestUrls.has(cacheKey)) return null;
  const inFlight = patientAuraManifestFetchInFlight.get(cacheKey);
  if (inFlight) return inFlight;

  const pending = (async (): Promise<PatientAuraAssetManifest | null> => {
    try {
      const url = new URL(manifestUrl, window.location.origin);
      url.searchParams.set("v", String(Date.now()));
      const response = await fetch(url.toString(), { cache: "no-store" });
      if (!response.ok) {
        if (response.status === 404) {
          rememberMissingPatientAuraManifest(manifestUrl, clientName);
        }
        return null;
      }
      const manifest = mergeDemoManifestFallback(
        clientName,
        (await response.json()) as PatientAuraAssetManifest,
      );
      if (!manifest) return null;
      const normalizedManifestUrl = normalizeGcsUrl(manifestUrl);
      const manifestSlug =
        normalizedManifestUrl?.match(/\/aura\/([^/]+)\//)?.[1] ??
        clientSlug(clientName);
      const upgradedManifest = normalizedManifestUrl?.startsWith(
        "https://storage.googleapis.com/",
      )
        ? upgradeManifestLocalPathsToGcs(
            manifest,
            normalizedManifestUrl,
            manifestSlug,
          )
        : manifest;
      setPatientAuraManifest(clientName, upgradedManifest);
      return upgradedManifest;
    } catch {
      return null;
    }
  })();

  patientAuraManifestFetchInFlight.set(cacheKey, pending);
  try {
    return await pending;
  } finally {
    patientAuraManifestFetchInFlight.delete(cacheKey);
  }
}

const GCS_AURA_OBJECT_PATH =
  /^https:\/\/storage\.googleapis\.com\/[^/]+\/aura\/([^/]+)\//i;

/**
 * When a manifest was saved before the GCS rewrite fix (scan_aura_gcs.py), per-angle
 * URLs are local `/demo-3d/...` paths. This upgrades them to GCS URLs by extracting
 * the filename and prepending the correct aura GCS prefix for the client.
 */
function upgradeManifestLocalPathsToGcs(
  manifest: PatientAuraAssetManifest,
  gcsSourceUrl: string,
  slug: string,
): PatientAuraAssetManifest {
  // Extract bucket from GCS URL: https://storage.googleapis.com/{bucket}/...
  const bucketMatch = gcsSourceUrl.match(/^https:\/\/storage\.googleapis\.com\/([^/]+)\//);
  if (!bucketMatch) return manifest;
  const bucket = bucketMatch[1];
  const gcsBase = gcsSourceUrl.endsWith(".json") || /\/aura\/[^/]+\//i.test(gcsSourceUrl)
    ? gcsSourceUrl.replace(/[^/]*$/, "")
    : `https://storage.googleapis.com/${bucket}/aura/${slug}/`;

  const up = (url: string | undefined | null): string | undefined => {
    if (!url) return url ?? undefined;
    if (!url.startsWith("/demo-3d/")) return url;
    const filename = url.split("/").pop();
    return filename ? gcsBase + filename : url;
  };

  const angles: PatientAuraAssetManifest["angles"] = {};
  for (const [angle, asset] of Object.entries(manifest.angles)) {
    if (!asset) continue;
    angles[angle as AuraTanViewAngle] = {
      ...asset,
      src: up(asset.src) ?? asset.src,
      srcOriginal: up(asset.srcOriginal),
      srcTexture: up(asset.srcTexture),
      srcPigmentation: up(asset.srcPigmentation),
      srcRedness: up(asset.srcRedness),
      srcPores: up(asset.srcPores),
      srcCutout: up(asset.srcCutout),
      srcWrinkles: up(asset.srcWrinkles),
      srcWrinklesView: up(asset.srcWrinklesView),
    };
  }
  const cv = manifest.cvAnnotations;
  const cvAnnotations =
    cv == null
      ? cv
      : {
          ...cv,
          redMaskByAngle: Object.fromEntries(
            Object.entries(cv.redMaskByAngle ?? {}).map(([angle, url]) => [
              angle,
              up(url),
            ]),
          ),
          poreMaskByAngle: Object.fromEntries(
            Object.entries(cv.poreMaskByAngle ?? {}).map(([angle, url]) => [
              angle,
              up(url),
            ]),
          ),
        };
  return { ...manifest, angles, cvAnnotations };
}

/** Build a turntable-only manifest when a GCS video exists but no JSON manifest was uploaded. */
export function buildTurntableOnlyManifestFromGcsUrl(
  clientName: string,
  turntableVideoUrl: string,
): PatientAuraAssetManifest | null {
  const trimmed = turntableVideoUrl.trim();
  if (!trimmed.startsWith("https://storage.googleapis.com")) return null;
  const match = trimmed.match(GCS_AURA_OBJECT_PATH);
  if (!match) return null;
  const slug = clientSlug(clientName);
  const urlSlug = match[1]!.toLowerCase();
  if (urlSlug !== slug && !urlSlug.startsWith(`${slug}-`) && slug !== urlSlug) {
    return null;
  }
  return {
    turntableVideoUrl: trimmed,
    angles: {},
  };
}

export type ResolvePatientAuraManifestInput = {
  clientName: string;
  turntableVideoUrl?: string | null;
  auraManifestUrl?: string | null;
  auraGcsPrefix?: string | null;
  /** Probe configured bucket + local disk when there is no turntable video yet. */
  probeWhenNoTurntable?: boolean;
};

/**
 * Resolve Aura assets without probing GCS for a sibling manifest JSON when a
 * turntable MP4 is already known (avoids noisy 404s for video-only scans).
 */
export async function resolvePatientAuraManifest(
  input: ResolvePatientAuraManifestInput,
): Promise<PatientAuraAssetManifest | null> {
  const {
    clientName,
    turntableVideoUrl,
    auraManifestUrl,
    auraGcsPrefix,
    probeWhenNoTurntable = false,
  } = input;
  const cachedBeforeFetch = readMap()[clientName.trim()] ?? null;

  if (auraManifestUrl?.trim()) {
    const fromUrl = await fetchPatientAuraManifestFromUrl(
      clientName,
      auraManifestUrl,
    );
    if (fromUrl) {
      const sourceBucket = storageBucketFromUrl(auraManifestUrl);
      const fromSourceBucket =
        probeWhenNoTurntable &&
        manifestCutoutAssetCount(fromUrl) === 0 &&
        sourceBucket
          ? await fetchPatientAuraManifestFromGcsBucket(clientName, sourceBucket)
          : null;
      const fromConfiguredBucket =
        probeWhenNoTurntable && manifestCutoutAssetCount(fromUrl) === 0
          ? await fetchPatientAuraManifestFromConfiguredBucket(clientName)
          : null;
      const best = richerAuraManifest(
        fromUrl,
        fromSourceBucket,
        fromConfiguredBucket,
        cachedBeforeFetch,
      );
      if (best !== fromUrl) {
        setPatientAuraManifest(clientName, best);
      }
      return best;
    }
  }

  if (auraGcsPrefix?.trim()) {
    const fromPrefix = await fetchPatientAuraManifestFromGcsPrefix(
      clientName,
      auraGcsPrefix,
    );
    if (fromPrefix) return fromPrefix;
  }

  const gcsVideo = turntableVideoUrl?.trim();
  if (gcsVideo?.startsWith("https://storage.googleapis.com")) {
    const fromVideoBucket = await fetchPatientAuraManifestFromGcs(
      clientName,
      gcsVideo,
    );
    if (fromVideoBucket) {
      const best = richerAuraManifest(fromVideoBucket, cachedBeforeFetch);
      setPatientAuraManifest(clientName, best);
      return best;
    }

    // If there's already a richer manifest in localStorage (e.g. freshly written
    // by a completed scan), preserve it and just update the video URL instead of
    // clobbering it with a turntable-only stub that has empty angles.
    const cached = readMap()[clientName.trim()];
    if (cached && Object.keys(cached.angles ?? {}).length > 0) {
      // Also upgrade any per-angle URLs that were stored as local /demo-3d/ paths
      // before the GCS rewrite fix was deployed.
      const updated = upgradeManifestLocalPathsToGcs(
        { ...cached, turntableVideoUrl: gcsVideo },
        gcsVideo,
        clientSlug(clientName),
      );
      setPatientAuraManifest(clientName, updated);
      return updated;
    }
    const synthetic = buildTurntableOnlyManifestFromGcsUrl(clientName, gcsVideo);
    if (synthetic) {
      setPatientAuraManifest(clientName, synthetic);
      return synthetic;
    }
  }

  if (!probeWhenNoTurntable || isPatientAuraManifestSlugMissing(clientName)) {
    return null;
  }

  const fromBucket = await fetchPatientAuraManifestFromConfiguredBucket(clientName);
  if (fromBucket) return fromBucket;

  return fetchPatientAuraManifestFromDisk(clientName);
}

export function buildViewerAngleAssetsFromManifest(
  manifest: PatientAuraAssetManifest,
  fallbackSrc: string,
): Record<AuraTanViewAngle, AuraTanViewerAngleAsset> {
  const out = {} as Record<AuraTanViewAngle, AuraTanViewerAngleAsset>;
  for (const angle of TANYA_TAN_LEFT_NAV_ORDER) {
    const asset = manifest.angles[angle];
    if (asset) {
      const originalSrc = asset.srcOriginal ?? asset.src;
      const cutoutSrc = cutoutSrcForAngleAsset(asset);
      const baseSrc = cutoutSrc ?? asset.src ?? originalSrc ?? fallbackSrc;
      out[angle] = {
        // Upgraded Aura stills should use the background-removed patient cutout.
        src: baseSrc,
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
        timeRatio: VIEWER_ANGLE_TIME_RATIOS[angle],
        label: angle,
      };
    }
  }
  return out;
}
