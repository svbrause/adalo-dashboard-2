import { useEffect, useState } from "react";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import {
  AURA_FIVE_REGION_IDS,
  type AuraFiveRegionId,
} from "../utils/auraRegionalDisplay";
import { getFaceLandmarker } from "../utils/faceLandmarker";
import {
  buildAuraZonePolygonsForView,
  type AuraZonePolygon,
} from "../utils/regionalFaceZonePolygons";
import {
  REGIONAL_FACE_IMAGE_HEIGHT,
  REGIONAL_FACE_IMAGE_WIDTH,
  REGIONAL_FACE_PAN_VIEW,
  REGIONAL_FACE_VIEW_IMAGE,
} from "../utils/regionalFaceGrid";

export type RegionalFaceLandmarksByView = Partial<
  Record<typeof REGIONAL_FACE_PAN_VIEW, Partial<Record<AuraFiveRegionId, AuraZonePolygon>>>
>;

export type RegionalFaceLandmarkStatus = "idle" | "loading" | "ready" | "error";

const DETECT_MAX_EDGE = 640;
const CACHE_VERSION = "front-only-v5";

let cachedLandmarks: RegionalFaceLandmarksByView | null = null;
let cacheVersion: string | null = null;
let detectPromise: Promise<RegionalFaceLandmarksByView> | null = null;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Regional face image failed to load"));
    img.src = src;
  });
}

function prepareDetectionCanvas(
  img: HTMLImageElement,
): { canvas: HTMLCanvasElement; width: number; height: number } {
  const sw = img.naturalWidth || REGIONAL_FACE_IMAGE_WIDTH;
  const sh = img.naturalHeight || REGIONAL_FACE_IMAGE_HEIGHT;
  const scale = Math.min(1, DETECT_MAX_EDGE / Math.max(sw, sh));
  const width = Math.max(1, Math.round(sw * scale));
  const height = Math.max(1, Math.round(sh * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(img, 0, 0, sw, sh, 0, 0, width, height);
  return { canvas, width, height };
}

async function detectFrontZones(): Promise<
  Partial<Record<AuraFiveRegionId, AuraZonePolygon>>
> {
  const img = await loadImage(REGIONAL_FACE_VIEW_IMAGE);
  const { canvas, width, height } = prepareDetectionCanvas(img);
  const landmarker = await getFaceLandmarker();
  const result = landmarker.detect(canvas);
  const landmarks: NormalizedLandmark[] | undefined =
    result.faceLandmarks?.[0];
  if (!landmarks?.length) return {};
  return buildAuraZonePolygonsForView(landmarks, width, height, AURA_FIVE_REGION_IDS);
}

function fetchLandmarks(): Promise<RegionalFaceLandmarksByView> {
  if (cachedLandmarks && cacheVersion === CACHE_VERSION) {
    return Promise.resolve(cachedLandmarks);
  }
  if (!detectPromise || cacheVersion !== CACHE_VERSION) {
    cacheVersion = CACHE_VERSION;
    cachedLandmarks = null;
    detectPromise = detectFrontZones()
      .then((zones) => {
        const data = { [REGIONAL_FACE_PAN_VIEW]: zones };
        cachedLandmarks = data;
        return data;
      })
      .catch((err) => {
        detectPromise = null;
        throw err;
      });
  }
  return detectPromise;
}

export function useRegionalFaceLandmarks(): {
  status: RegionalFaceLandmarkStatus;
  zonesByView: RegionalFaceLandmarksByView;
} {
  const [status, setStatus] = useState<RegionalFaceLandmarkStatus>(() =>
    cachedLandmarks && cacheVersion === CACHE_VERSION ? "ready" : "idle",
  );
  const [zonesByView, setZonesByView] = useState<RegionalFaceLandmarksByView>(
    () => (cachedLandmarks && cacheVersion === CACHE_VERSION ? cachedLandmarks : {}),
  );

  useEffect(() => {
    if (cachedLandmarks && cacheVersion === CACHE_VERSION) {
      setZonesByView(cachedLandmarks);
      setStatus("ready");
      return;
    }

    let cancelled = false;
    setStatus("loading");

    fetchLandmarks()
      .then((data) => {
        if (cancelled) return;
        setZonesByView(data);
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setZonesByView({});
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { status, zonesByView };
}
