import { describe, expect, it } from "vitest";
import {
  clampMirrorCalloutBoxToCanvas,
  fitMirrorCalloutLabel,
  layoutMirrorRegionCallouts,
  mirrorCalloutBoxesOverlap,
  stackMirrorCalloutBoxesY,
} from "./mirrorAnnotationCanvas";

describe("stackMirrorCalloutBoxesY", () => {
  it("separates boxes that would overlap at similar anchor Y", () => {
    const items = [
      {
        key: "a",
        label: "Nasolabial Folds",
        anchorX: 200,
        anchorY: 420,
        boxWidth: 140,
        boxHeight: 24,
      },
      {
        key: "b",
        label: "Loose Neck Skin",
        anchorX: 210,
        anchorY: 430,
        boxWidth: 120,
        boxHeight: 24,
      },
    ];

    const ys = stackMirrorCalloutBoxesY(items, 10, 500, 6);
    const boxes = items.map((item, i) => ({
      x: 10,
      y: ys[i]!,
      boxWidth: item.boxWidth,
      boxHeight: item.boxHeight,
    }));

    expect(mirrorCalloutBoxesOverlap(boxes[0]!, boxes[1]!, 6)).toBe(false);
  });
});

describe("layoutMirrorRegionCallouts", () => {
  it("keeps opposite-margin callouts from overlapping on one side", () => {
    const layouts = layoutMirrorRegionCallouts(
      [
        {
          key: "nasolabial",
          label: "Nasolabial Folds",
          anchorX: 180,
          anchorY: 410,
          boxWidth: 150,
          boxHeight: 24,
        },
        {
          key: "chin",
          label: "Loose Neck Skin",
          anchorX: 220,
          anchorY: 470,
          boxWidth: 120,
          boxHeight: 24,
        },
      ],
      {
        canvasWidth: 512,
        canvasHeight: 488,
        marginSideMode: "opposite-from-anchor",
      },
    );

    expect(layouts).toHaveLength(2);
    expect(layouts.every((box) => box.marginSide === "right")).toBe(true);

    const [first, second] = layouts.sort((a, b) => a.y - b.y);
    expect(mirrorCalloutBoxesOverlap(first!, second!, 6)).toBe(false);
  });
});

describe("mirror callout fitting", () => {
  const measureCtx = {
    measureText: (text: string) => ({ width: text.length * 8 }) as TextMetrics,
  };

  it("truncates labels that would exceed the available callout width", () => {
    const fitted = fitMirrorCalloutLabel(
      measureCtx,
      "Very Long Highlighted Region Label",
      120,
      8,
    );

    expect(fitted.label.endsWith("...")).toBe(true);
    expect(fitted.boxWidth).toBeLessThanOrEqual(120);
  });

  it("clamps adjusted label boxes inside the canvas", () => {
    expect(
      clampMirrorCalloutBoxToCanvas(260, -10, 80, 24, 300, 180, 8),
    ).toEqual({ x: 212, y: 8 });
  });
});
