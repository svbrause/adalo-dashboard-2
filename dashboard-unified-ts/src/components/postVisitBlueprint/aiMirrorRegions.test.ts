import { describe, expect, it } from "vitest";
import { cheekRegionPolygon, lipsRegionPolygon, noseRegionPolygon } from "./aiMirrorRegions";

function polygonArea(points: { x: number; y: number }[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area / 2);
}

function maxY(points: { x: number; y: number }[]): number {
  return Math.max(...points.map((point) => point.y));
}

/** Minimal frontal face mesh stub with symmetric cheek landmarks populated. */
function buildFrontalFaceLandmarks(width: number, height: number) {
  const landmarks: { x: number; y: number }[] = Array.from({ length: 468 }, () => ({
    x: 0.5,
    y: 0.5,
  }));

  const set = (index: number, x: number, y: number) => {
    landmarks[index] = { x: x / width, y: y / height };
  };

  set(1, width * 0.5, height * 0.52);
  set(10, width * 0.5, height * 0.18);
  set(152, width * 0.5, height * 0.82);
  set(234, width * 0.18, height * 0.52);
  set(454, width * 0.82, height * 0.52);
  set(98, width * 0.46, height * 0.54);
  set(327, width * 0.54, height * 0.54);
  set(61, width * 0.44, height * 0.66);
  set(291, width * 0.56, height * 0.66);
  set(168, width * 0.5, height * 0.34);
  set(6, width * 0.5, height * 0.4);
  set(4, width * 0.5, height * 0.52);
  set(2, width * 0.5, height * 0.58);
  set(49, width * 0.46, height * 0.56);
  set(279, width * 0.54, height * 0.56);

  const leftCheek = [
    [117, 0.42, 0.34],
    [118, 0.4, 0.38],
    [119, 0.38, 0.42],
    [100, 0.4, 0.44],
    [50, 0.42, 0.46],
    [101, 0.44, 0.48],
    [123, 0.46, 0.5],
    [116, 0.44, 0.52],
    [147, 0.47, 0.56],
    [187, 0.44, 0.58],
    [205, 0.42, 0.6],
    [227, 0.28, 0.46],
  ] as const;

  for (const [index, x, y] of leftCheek) {
    set(index, width * x, height * y);
    const mirrorIndex =
      index === 117
        ? 346
        : index === 118
          ? 347
          : index === 119
            ? 348
            : index === 100
              ? 329
              : index === 50
                ? 280
                : index === 101
                  ? 330
                  : index === 123
                    ? 352
                    : index === 116
                      ? 346
                      : index === 147
                        ? 376
                        : index === 187
                          ? 411
                          : index === 205
                            ? 425
                            : index === 227
                              ? 427
                              : null;
    if (mirrorIndex != null) {
      set(mirrorIndex, width * (1 - x), height * y);
    }
  }

  return landmarks;
}

function mirrorX(points: { x: number; y: number }[], midlineX: number) {
  return points.map((point) => ({
    x: midlineX * 2 - point.x,
    y: point.y,
  }));
}

describe("cheekRegionPolygon", () => {
  it("covers the mid-cheek without spilling into mouth, jaw, or ears", () => {
    const width = 800;
    const height = 1000;
    const landmarks = buildFrontalFaceLandmarks(width, height);
    const left = cheekRegionPolygon(landmarks, width, height, "left");
    const right = cheekRegionPolygon(landmarks, width, height, "right");
    const mouthY = height * 0.66;

    expect(left.length).toBeGreaterThan(12);
    expect(right.length).toBeGreaterThan(12);
    expect(polygonArea(left)).toBeGreaterThan(width * height * 0.038);
    expect(polygonArea(left)).toBeLessThan(width * height * 0.08);
    expect(maxY(left)).toBeLessThan(mouthY - height * 0.02);
    expect(maxY(right)).toBeLessThan(mouthY - height * 0.02);
    expect(Math.min(...left.map((point) => point.x))).toBeGreaterThan(width * 0.17);
    expect(Math.max(...right.map((point) => point.x))).toBeLessThan(width * 0.83);
  });

  it("mirrors the left cheek shape across the facial midline", () => {
    const width = 800;
    const height = 1000;
    const landmarks = buildFrontalFaceLandmarks(width, height);
    const left = cheekRegionPolygon(landmarks, width, height, "left");
    const right = cheekRegionPolygon(landmarks, width, height, "right");
    const midlineX = width * 0.5;
    const mirroredLeft = mirrorX(left, midlineX);

    expect(left.length).toBeGreaterThan(0);
    expect(right.length).toBe(left.length);
    for (let i = 0; i < left.length; i++) {
      expect(right[i]!.x).toBeCloseTo(mirroredLeft[i]!.x, 1);
      expect(right[i]!.y).toBeCloseTo(mirroredLeft[i]!.y, 1);
    }
  });
});

describe("noseRegionPolygon", () => {
  it("builds a symmetrical nose centered on the facial midline", () => {
    const width = 800;
    const height = 1000;
    const landmarks = buildFrontalFaceLandmarks(width, height);
    const nose = noseRegionPolygon(landmarks, width, height);
    const midlineX = width * 0.5;

    expect(nose.length).toBeGreaterThan(12);
    const leftExtent = midlineX - Math.min(...nose.map((point) => point.x));
    const rightExtent = Math.max(...nose.map((point) => point.x)) - midlineX;
    expect(leftExtent).toBeCloseTo(rightExtent, 0);
    expect(Math.min(...nose.map((point) => point.y))).toBeLessThan(height * 0.58);
    expect(Math.max(...nose.map((point) => point.y))).toBeGreaterThan(height * 0.48);
  });
});

describe("lipsRegionPolygon", () => {
  it("builds a padded lip outline below the nose on front-facing faces", () => {
    const width = 800;
    const height = 1000;
    const landmarks = buildFrontalFaceLandmarks(width, height);
    const lips = lipsRegionPolygon(landmarks, width, height);
    const nose = noseRegionPolygon(landmarks, width, height);

    expect(lips.length).toBeGreaterThan(8);
    expect(maxY(lips)).toBeGreaterThan(maxY(nose));
  });
});
