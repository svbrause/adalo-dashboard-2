import { describe, expect, it } from "vitest";
import {
  FACE3D_TIMELINE_FPS,
  face3dTimelineKey,
  face3dTimelineTimeFromKey,
  quantizeFace3dTimelineTime,
  resolveLandmarksForTimeKey,
  type FrameLandmarkCache,
} from "./face3dLandmarkCache";

describe("face3d timeline helpers", () => {
  it("uses a single 30fps bucket grid for video time", () => {
    expect(face3dTimelineKey(0.016)).toBe(0);
    expect(face3dTimelineKey(0.034)).toBe(1);
    expect(face3dTimelineTimeFromKey(1)).toBeCloseTo(1 / FACE3D_TIMELINE_FPS);
    expect(quantizeFace3dTimelineTime(0.02)).toBe(1 / FACE3D_TIMELINE_FPS);
  });

  it("resolveLandmarksForTimeKey stays within maxKeyDelta", () => {
    const cache: FrameLandmarkCache = new Map([
      [10, [{ x: 0.5, y: 0.5, z: 0 } as never]],
      [20, [{ x: 0.4, y: 0.5, z: 0 } as never]],
    ]);
    expect(resolveLandmarksForTimeKey(cache, 10, 1)?.[0]?.x).toBe(0.5);
    expect(resolveLandmarksForTimeKey(cache, 11, 1)?.[0]?.x).toBe(0.5);
    expect(resolveLandmarksForTimeKey(cache, 15, 1)).toBeNull();
    expect(resolveLandmarksForTimeKey(cache, 11)?.[0]?.x).toBe(0.5);
    expect(resolveLandmarksForTimeKey(cache, 15)).toBeNull();
  });
});
