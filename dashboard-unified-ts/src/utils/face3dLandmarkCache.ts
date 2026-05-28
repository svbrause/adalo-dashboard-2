import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

/** Turntable frame cache + landmark buckets share this rate (keeps overlays aligned). */
export const FACE3D_TIMELINE_FPS = 30;

export function face3dTimelineKey(mediaTimeSec: number): number {
  return Math.round(mediaTimeSec * FACE3D_TIMELINE_FPS);
}

export function face3dTimelineTimeFromKey(key: number): number {
  return key / FACE3D_TIMELINE_FPS;
}

export function quantizeFace3dTimelineTime(mediaTimeSec: number): number {
  return face3dTimelineTimeFromKey(face3dTimelineKey(mediaTimeSec));
}

export type FrameLandmarkCache = Map<number, NormalizedLandmark[] | null>;

const cacheByVideoUrl = new Map<string, FrameLandmarkCache>();
const MAX_CACHED_VIDEOS = 6;

/** Per-video landmark results keyed by extracted frame index. Survives remounts. */
export function getFace3dLandmarkCache(videoUrl: string): FrameLandmarkCache {
  let cache = cacheByVideoUrl.get(videoUrl);
  if (!cache) {
    cache = new Map();
    cacheByVideoUrl.set(videoUrl, cache);
    while (cacheByVideoUrl.size > MAX_CACHED_VIDEOS) {
      const oldest = cacheByVideoUrl.keys().next().value;
      if (!oldest) break;
      cacheByVideoUrl.delete(oldest);
    }
  }
  return cache;
}

export function pruneFace3dLandmarkCaches(keepVideoUrl: string): void {
  for (const url of [...cacheByVideoUrl.keys()]) {
    if (url !== keepVideoUrl) cacheByVideoUrl.delete(url);
  }
}

/**
 * Overlays must match the same 30fps bucket as the turntable video.
 * Only exact-key landmarks are shown (maxKeyDelta 0).
 */
/** Allow ±1 bucket when the exact frame is still processing. */
export const FACE3D_LANDMARK_DISPLAY_MAX_DELTA = 1;

/** @deprecated Use FACE3D_LANDMARK_DISPLAY_MAX_DELTA — kept for callers/tests. */
export const FACE3D_LANDMARK_RESOLVE_MAX_DELTA = FACE3D_LANDMARK_DISPLAY_MAX_DELTA;

/** Nearest cached landmarks within ±maxKeyDelta buckets (~1/FACE3D_TIMELINE_FPS s each). */
export function resolveLandmarksForTimeKey(
  cache: FrameLandmarkCache,
  timeKey: number,
  maxKeyDelta = FACE3D_LANDMARK_DISPLAY_MAX_DELTA,
): NormalizedLandmark[] | null {
  const exact = cache.get(timeKey);
  if (exact?.length) return exact;

  let best: NormalizedLandmark[] | null = null;
  let bestDist = maxKeyDelta + 1;
  for (const [key, landmarks] of cache) {
    if (!landmarks?.length) continue;
    const dist = Math.abs(key - timeKey);
    if (dist < bestDist) {
      bestDist = dist;
      best = landmarks;
    }
  }
  return best;
}
