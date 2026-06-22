import { describe, expect, it } from "vitest";
import {
  clampViewportZoom,
  wheelZoomFactor,
  zoomViewportAboutPoint,
} from "./mirrorViewportZoomMath";

describe("wheelZoomFactor", () => {
  it("zooms in with negative deltaY", () => {
    expect(wheelZoomFactor(-100, WheelEvent.DOM_DELTA_PIXEL)).toBeGreaterThan(1);
  });

  it("zooms out with positive deltaY", () => {
    expect(wheelZoomFactor(100, WheelEvent.DOM_DELTA_PIXEL)).toBeLessThan(1);
  });

  it("clamps large wheel steps for precision", () => {
    const factor = wheelZoomFactor(500, WheelEvent.DOM_DELTA_PIXEL);
    expect(factor).toBeLessThanOrEqual(1.06);
    expect(factor).toBeGreaterThanOrEqual(0.94);
  });
});

describe("zoomViewportAboutPoint", () => {
  it("keeps the focal point stable while zooming", () => {
    const oldZoom = 1.5;
    const newZoom = 2;
    const panX = 12;
    const panY = -8;
    const focalX = 40;
    const focalY = -20;
    const next = zoomViewportAboutPoint({
      oldZoom,
      newZoom,
      panX,
      panY,
      focalX,
      focalY,
    });
    const localX = (focalX - panX) / oldZoom;
    const localY = (focalY - panY) / oldZoom;
    expect(next.panX + localX * newZoom).toBeCloseTo(focalX, 5);
    expect(next.panY + localY * newZoom).toBeCloseTo(focalY, 5);
  });
});

describe("clampViewportZoom", () => {
  it("respects min and max bounds", () => {
    expect(clampViewportZoom(0.5, 1.42)).toBe(1.42);
    expect(clampViewportZoom(8, 1.42)).toBe(6);
  });
});
