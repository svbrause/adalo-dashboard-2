import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { ClientPhotoSlot } from "../types";
import { getFaceLandmarker } from "./faceLandmarker";
import {
  TANYA_TAN_LEFT_NAV_ORDER,
  type AuraTanViewAngle,
  type AuraTanViewerAngleAsset,
} from "./auraTanAnglePhotos";

export type AuraPhotoFacingDirection = "left" | "right" | "front" | "unknown";
export type AuraPhotoFacingByUrl = Record<string, AuraPhotoFacingDirection>;

const DETECT_MAX_EDGE = 512;
const PHOTO_FIELD_KEYS: Array<keyof Pick<
  AuraTanViewerAngleAsset,
  | "src"
  | "srcCutout"
  | "srcTexture"
  | "srcPigmentation"
  | "srcRedness"
  | "srcPores"
  | "srcWrinkles"
  | "srcWrinklesView"
>> = [
  "src",
  "srcCutout",
  "srcTexture",
  "srcPigmentation",
  "srcRedness",
  "srcPores",
  "srcWrinkles",
  "srcWrinklesView",
];
type PhotoFieldKey = (typeof PHOTO_FIELD_KEYS)[number];

const photoFacingCache = new Map<string, Promise<AuraPhotoFacingDirection>>();

function loadImage(src: string, crossOrigin: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Aura photo failed to load for direction detection"));
    img.src = src;
  });
}

async function loadDetectableImage(src: string): Promise<HTMLImageElement> {
  try {
    return await loadImage(src, true);
  } catch {
    return loadImage(src, false);
  }
}

function imageToDetectionCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const sw = img.naturalWidth || img.width || 1;
  const sh = img.naturalHeight || img.height || 1;
  const scale = Math.min(1, DETECT_MAX_EDGE / Math.max(sw, sh));
  const width = Math.max(1, Math.round(sw * scale));
  const height = Math.max(1, Math.round(sh * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable for Aura photo direction detection");
  ctx.drawImage(img, 0, 0, sw, sh, 0, 0, width, height);
  return canvas;
}

export function detectFacingDirectionFromLandmarks(
  landmarks: NormalizedLandmark[] | null | undefined,
): AuraPhotoFacingDirection {
  if (!landmarks?.length) return "unknown";
  const nose = landmarks[1];
  if (!nose) return "unknown";

  const xs = landmarks
    .map((landmark) => landmark.x)
    .filter((x) => Number.isFinite(x));
  if (xs.length === 0) return "unknown";

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const width = Math.max(0.001, maxX - minX);
  const centerX = minX + width / 2;
  const noseOffset = (nose.x - centerX) / width;

  if (noseOffset > 0.12) return "right";
  if (noseOffset < -0.12) return "left";
  return "front";
}

async function detectFacingDirectionFromImage(
  src: string,
): Promise<AuraPhotoFacingDirection> {
  try {
    const img = await loadDetectableImage(src);
    const landmarker = await getFaceLandmarker();
    let landmarks: NormalizedLandmark[] | undefined;
    try {
      landmarks = landmarker.detect(imageToDetectionCanvas(img)).faceLandmarks?.[0];
    } catch {
      landmarks = landmarker.detect(img).faceLandmarks?.[0];
    }
    return detectFacingDirectionFromLandmarks(landmarks);
  } catch {
    return "unknown";
  }
}

export function detectPhotoFacingDirection(
  src: string,
): Promise<AuraPhotoFacingDirection> {
  const url = src.trim();
  if (!url) return Promise.resolve("unknown");
  const cached = photoFacingCache.get(url);
  if (cached) return cached;
  const pending = detectFacingDirectionFromImage(url);
  photoFacingCache.set(url, pending);
  return pending;
}

function textForFacingInference(value: string | null | undefined): string {
  try {
    const url = new URL(value ?? "", window.location.origin);
    return decodeURIComponent(`${url.pathname} ${url.search}`).toLowerCase();
  } catch {
    return (value ?? "").toLowerCase();
  }
}

export function inferFacingDirectionFromText(
  value: string | null | undefined,
): AuraPhotoFacingDirection {
  const text = textForFacingInference(value);
  if (!text) return "unknown";
  if (/\bfront\b|facing-ahead/.test(text)) return "front";

  if (
    /(?:^|[-_/\s])(?:profile|three-quarter|side)?[-_\s]?left(?:90|45)?(?:$|[-_/.\s])/.test(text) ||
    /(?:left90|left45|left-90|left-45|90-left|45-left)/.test(text)
  ) {
    return "left";
  }
  if (
    /(?:^|[-_/\s])(?:profile|three-quarter|side)?[-_\s]?right(?:90|45)?(?:$|[-_/.\s])/.test(text) ||
    /(?:right90|right45|right-90|right-45|90-right|45-right)/.test(text)
  ) {
    return "right";
  }
  return "unknown";
}

function expectedFacingForAngle(
  angle: AuraTanViewAngle,
): AuraPhotoFacingDirection {
  // Aura rail angle ids are visual direction: the silhouette and photo point the same way.
  if (angle.endsWith("left")) return "left";
  if (angle.endsWith("right")) return "right";
  return "front";
}

function detectedOrInferredFacing(
  src: string | null | undefined,
  facingByUrl: AuraPhotoFacingByUrl,
): AuraPhotoFacingDirection {
  if (!src) return "unknown";
  const detected = facingByUrl[src];
  if (detected && detected !== "unknown") return detected;
  return inferFacingDirectionFromText(src);
}

function assetFacing(
  asset: AuraTanViewerAngleAsset | null | undefined,
  facingByUrl: AuraPhotoFacingByUrl,
): AuraPhotoFacingDirection {
  if (!asset) return "unknown";
  for (const key of PHOTO_FIELD_KEYS) {
    const direction = detectedOrInferredFacing(asset[key], facingByUrl);
    if (direction !== "unknown" && direction !== "front") return direction;
  }
  return detectedOrInferredFacing(asset.src, facingByUrl);
}

function swapPhotoFields(
  a: AuraTanViewerAngleAsset,
  b: AuraTanViewerAngleAsset,
): [AuraTanViewerAngleAsset, AuraTanViewerAngleAsset] {
  const nextA = { ...a };
  const nextB = { ...b };
  const mutableA = nextA as Partial<Record<PhotoFieldKey, string>>;
  const mutableB = nextB as Partial<Record<PhotoFieldKey, string>>;
  for (const key of PHOTO_FIELD_KEYS) {
    const aValue = mutableA[key];
    mutableA[key] = mutableB[key];
    mutableB[key] = aValue;
  }
  return [nextA, nextB];
}

function isCrossMappedProfilePair(
  leftAsset: AuraTanViewerAngleAsset,
  rightAsset: AuraTanViewerAngleAsset,
): boolean {
  const leftSrc = (leftAsset.src ?? "").toLowerCase();
  const rightSrc = (rightAsset.src ?? "").toLowerCase();
  return (
    /profile-right|three-quarter-right/.test(leftSrc) &&
    /profile-left|three-quarter-left/.test(rightSrc)
  );
}

function slotsAreCrossMappedProfilePair(slots: ClientPhotoSlot[]): boolean {
  const left = slots.find((slot) => slot.id === "profile-left");
  const right = slots.find((slot) => slot.id === "profile-right");
  if (!left?.url || !right?.url) return false;
  return (
    inferFacingDirectionFromText(left.url) === "right" &&
    inferFacingDirectionFromText(right.url) === "left"
  );
}

function shouldPreserveCrossMappedProfilePair(
  leftAsset: AuraTanViewerAngleAsset,
  rightAsset: AuraTanViewerAngleAsset,
): boolean {
  if (!isCrossMappedProfilePair(leftAsset, rightAsset)) return false;
  const leftSrc = (leftAsset.src ?? "").toLowerCase();
  return leftSrc.includes("tanya-progress-aura-before");
}

function shouldPreserveCrossMappedSlots(slots: ClientPhotoSlot[]): boolean {
  if (!slotsAreCrossMappedProfilePair(slots)) return false;
  const left = slots.find((slot) => slot.id === "profile-left");
  return (left?.url ?? "").toLowerCase().includes("tanya-progress-before");
}

export function alignViewerAngleAssetsByFacing(
  assets: Record<AuraTanViewAngle, AuraTanViewerAngleAsset>,
  facingByUrl: AuraPhotoFacingByUrl,
): Record<AuraTanViewAngle, AuraTanViewerAngleAsset> {
  const out = { ...assets };
  const alignPair = (left: AuraTanViewAngle, right: AuraTanViewAngle) => {
    const leftAsset = out[left];
    const rightAsset = out[right];
    if (!leftAsset || !rightAsset) return;
    if (shouldPreserveCrossMappedProfilePair(leftAsset, rightAsset)) return;
    const leftFacing = assetFacing(leftAsset, facingByUrl);
    const rightFacing = assetFacing(rightAsset, facingByUrl);
    const expectedLeft = expectedFacingForAngle(left);
    const expectedRight = expectedFacingForAngle(right);
    if (
      leftFacing === expectedRight &&
      rightFacing === expectedLeft
    ) {
      const [nextLeft, nextRight] = swapPhotoFields(leftAsset, rightAsset);
      out[left] = nextLeft;
      out[right] = nextRight;
      return;
    }
    if (
      rightFacing === expectedLeft &&
      leftFacing !== expectedLeft
    ) {
      const [nextLeft, nextRight] = swapPhotoFields(leftAsset, rightAsset);
      out[left] = nextLeft;
      out[right] = nextRight;
      return;
    }
    if (
      leftFacing === expectedRight &&
      rightFacing !== expectedRight
    ) {
      const [nextLeft, nextRight] = swapPhotoFields(leftAsset, rightAsset);
      out[left] = nextLeft;
      out[right] = nextRight;
    }
  };

  alignPair("profile-left", "profile-right");
  alignPair("three-quarter-left", "three-quarter-right");
  return out;
}

function likelySideSlot(slot: ClientPhotoSlot): boolean {
  const text = `${slot.id} ${slot.label ?? ""} ${slot.url}`.toLowerCase();
  return /side|profile|three-quarter|45|90|left|right/.test(text) && !text.includes("front");
}

export function inferFacingDirectionForSlot(
  slot: ClientPhotoSlot,
  facingByUrl: AuraPhotoFacingByUrl,
): AuraPhotoFacingDirection {
  const detected = slot.url ? facingByUrl[slot.url] : undefined;
  if (detected && detected !== "unknown") return detected;
  const fromUrl = inferFacingDirectionFromText(slot.url);
  if (fromUrl !== "unknown") return fromUrl;
  return inferFacingDirectionFromText(`${slot.id} ${slot.label ?? ""}`);
}

export function alignAvailableViewAnglesByFacing(
  baseAngles: AuraTanViewAngle[] | undefined,
  slots: ClientPhotoSlot[],
  facingByUrl: AuraPhotoFacingByUrl,
): AuraTanViewAngle[] | undefined {
  if (shouldPreserveCrossMappedSlots(slots)) {
    return baseAngles;
  }
  const base = new Set(baseAngles ?? []);
  const detectedSideAngles = new Set<AuraTanViewAngle>();

  for (const slot of slots) {
    if (!slot.url || !likelySideSlot(slot)) continue;
    const direction = inferFacingDirectionForSlot(slot, facingByUrl);
    if (direction !== "left" && direction !== "right") continue;
    const text = `${slot.id} ${slot.label ?? ""} ${slot.url}`.toLowerCase();
    const isThreeQuarter = /three-quarter|45/.test(text);
    detectedSideAngles.add(
      direction === "right"
        ? isThreeQuarter
          ? "three-quarter-right"
          : "profile-right"
        : isThreeQuarter
          ? "three-quarter-left"
          : "profile-left",
    );
  }

  if (detectedSideAngles.size > 0) {
    for (const angle of [
      "profile-left",
      "three-quarter-left",
      "three-quarter-right",
      "profile-right",
    ] as AuraTanViewAngle[]) {
      base.delete(angle);
    }
    for (const angle of detectedSideAngles) base.add(angle);
  }

  const ordered = TANYA_TAN_LEFT_NAV_ORDER.filter((angle) => base.has(angle));
  return ordered.length > 0 ? ordered : undefined;
}

export function collectFacingDetectionUrls(
  slots: ClientPhotoSlot[],
  assets?: Partial<
    Record<AuraTanViewAngle, Partial<AuraTanViewerAngleAsset> & { srcOriginal?: string }>
  >,
): string[] {
  const urls = new Set<string>();
  for (const slot of slots) {
    if (slot.url && likelySideSlot(slot)) urls.add(slot.url);
  }
  for (const asset of Object.values(assets ?? {})) {
    const src = asset?.srcOriginal ?? asset?.src;
    if (src && inferFacingDirectionFromText(src) !== "front") urls.add(src);
  }
  return [...urls];
}
