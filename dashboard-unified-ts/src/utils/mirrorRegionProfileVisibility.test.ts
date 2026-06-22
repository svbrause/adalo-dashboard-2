import { describe, expect, it } from "vitest";
import {
  faceTurnDirection,
  mirrorRegionVisibleAtHeadPose,
  profileYawAmount,
} from "./mirrorRegionProfileVisibility";

function mockLandmarks(noseX: number, leftX: number, rightX: number) {
  const landmarks = Array.from({ length: 500 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
  landmarks[1] = { x: noseX, y: 0.45, z: 0, visibility: 1 };
  landmarks[234] = { x: leftX, y: 0.5, z: 0, visibility: 1 };
  landmarks[454] = { x: rightX, y: 0.5, z: 0, visibility: 1 };
  landmarks[10] = { x: 0.5, y: 0.25, z: 0, visibility: 1 };
  return landmarks;
}

describe("mirrorRegionProfileVisibility", () => {
  it("treats a centered nose as frontal yaw", () => {
    const lm = mockLandmarks(0.5, 0.3, 0.7);
    expect(profileYawAmount(lm, 1000, 1000)).toBeCloseTo(0, 2);
    expect(faceTurnDirection(lm, 1000, 1000)).toBe("front");
  });

  it("keeps bilateral regions visible at moderate 3/4 angles", () => {
    const lm = mockLandmarks(0.58, 0.3, 0.7);
    expect(mirrorRegionVisibleAtHeadPose("rLeftCheek", lm, 1000, 1000)).toBe(true);
    expect(mirrorRegionVisibleAtHeadPose("rRightCheek", lm, 1000, 1000)).toBe(true);
    expect(mirrorRegionVisibleAtHeadPose("rForehead", lm, 1000, 1000)).toBe(true);
  });

  it("hides far-side cheek only at strong profile", () => {
    const lm = mockLandmarks(0.74, 0.3, 0.7);
    expect(mirrorRegionVisibleAtHeadPose("rRightCheek", lm, 1000, 1000)).toBe(false);
    expect(mirrorRegionVisibleAtHeadPose("rLeftCheek", lm, 1000, 1000)).toBe(true);
  });

  it("hides broad far-side cheek patches before linear fold regions", () => {
    const lm = mockLandmarks(0.66, 0.3, 0.7);
    expect(mirrorRegionVisibleAtHeadPose("rRightCheek", lm, 1000, 1000)).toBe(false);
    expect(mirrorRegionVisibleAtHeadPose("rRightNasolabialFold", lm, 1000, 1000)).toBe(true);
  });
});
