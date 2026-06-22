import { describe, expect, it } from "vitest";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { ClientPhotoSlot } from "../types";
import type { AuraTanViewAngle, AuraTanViewerAngleAsset } from "./auraTanAnglePhotos";
import {
  alignAvailableViewAnglesByFacing,
  alignViewerAngleAssetsByFacing,
  detectFacingDirectionFromLandmarks,
  inferFacingDirectionForSlot,
  inferFacingDirectionFromText,
} from "./auraPhotoFacingDetection";

function landmarksWithNose(noseX: number): NormalizedLandmark[] {
  return [
    { x: 0.2, y: 0.5, z: 0 },
    { x: noseX, y: 0.45, z: 0 },
    { x: 0.8, y: 0.5, z: 0 },
  ] as NormalizedLandmark[];
}

function asset(src: string, label: string, timeRatio: number): AuraTanViewerAngleAsset {
  return { src, srcTexture: src, label, timeRatio };
}

function angleAssets(
  overrides: Partial<Record<AuraTanViewAngle, AuraTanViewerAngleAsset>>,
): Record<AuraTanViewAngle, AuraTanViewerAngleAsset> {
  return {
    "profile-left": asset("/fallback-profile-left.jpg", "Left profile", 0.99),
    "three-quarter-left": asset("/fallback-three-quarter-left.jpg", "Left three-quarter", 0.76),
    front: asset("/front.jpg", "Front", 0.5),
    "three-quarter-right": asset("/fallback-three-quarter-right.jpg", "Right three-quarter", 0.24),
    "profile-right": asset("/fallback-profile-right.jpg", "Right profile", 0),
    ...overrides,
  };
}

describe("Aura photo facing detection", () => {
  it("uses nose offset to classify visual facing direction", () => {
    expect(detectFacingDirectionFromLandmarks(landmarksWithNose(0.68))).toBe("right");
    expect(detectFacingDirectionFromLandmarks(landmarksWithNose(0.32))).toBe("left");
    expect(detectFacingDirectionFromLandmarks(landmarksWithNose(0.5))).toBe("front");
  });

  it("infers visual direction from anatomical left/right filenames", () => {
    expect(inferFacingDirectionFromText("/aura/patient-profile-left-color.jpg")).toBe("left");
    expect(inferFacingDirectionFromText("/aura/patient-profile-right-color.jpg")).toBe("right");
    expect(inferFacingDirectionFromText("/aura/patient-three-quarter-left-color.jpg")).toBe("left");
    expect(inferFacingDirectionFromText("/aura/patient-three-quarter-right-color.jpg")).toBe("right");
  });

  it("keeps manifest photo fields when filename direction matches the rail silhouette", () => {
    const aligned = alignViewerAngleAssetsByFacing(
      angleAssets({
        "profile-left": asset(
          "https://storage.googleapis.com/test/aura/patient/patient-profile-left-color.jpg",
          "Left profile",
          0.99,
        ),
        "profile-right": asset(
          "https://storage.googleapis.com/test/aura/patient/patient-profile-right-color.jpg",
          "Right profile",
          0,
        ),
      }),
      {},
    );

    expect(aligned["profile-left"].src).toContain("profile-left-color.jpg");
    expect(aligned["profile-right"].src).toContain("profile-right-color.jpg");
    expect(aligned["profile-left"].label).toBe("Left profile");
    expect(aligned["profile-right"].timeRatio).toBe(0);
  });

  it("swaps manifest photo fields when left/right filenames are in the opposite rail slots", () => {
    const aligned = alignViewerAngleAssetsByFacing(
      angleAssets({
        "profile-left": asset(
          "https://storage.googleapis.com/test/aura/patient/patient-profile-right-color.jpg",
          "Left profile",
          0.99,
        ),
        "profile-right": asset(
          "https://storage.googleapis.com/test/aura/patient/patient-profile-left-color.jpg",
          "Right profile",
          0,
        ),
      }),
      {},
    );

    expect(aligned["profile-left"].src).toContain("profile-left-color.jpg");
    expect(aligned["profile-right"].src).toContain("profile-right-color.jpg");
  });

  it("keeps intentionally cross-mapped progress demo profile assets", () => {
    const aligned = alignViewerAngleAssetsByFacing(
      angleAssets({
        "profile-left": asset(
          "/demo-3d/tanya-progress-aura-before/tanya-progress-aura-before-profile-right-rembg.png",
          "Left profile",
          0.99,
        ),
        "profile-right": asset(
          "/demo-3d/tanya-progress-aura-before/tanya-progress-aura-before-profile-left-rembg.png",
          "Right profile",
          0,
        ),
      }),
      {},
    );

    expect(aligned["profile-left"].src).toContain("profile-right-rembg.png");
    expect(aligned["profile-right"].src).toContain("profile-left-rembg.png");
  });

  it("uses detected generic side direction to choose the matching side rail icon", () => {
    const slots: ClientPhotoSlot[] = [
      { id: "front", label: "Front", url: "/front.jpg" },
      { id: "rec-side", label: "Side", url: "/side.jpg" },
    ];

    expect(
      alignAvailableViewAnglesByFacing(["front", "profile-left"], slots, {
        "/side.jpg": "left",
      }),
    ).toEqual(["profile-left", "front"]);
  });

  it("keeps a generic side asset in the correct slot for its detected visual direction", () => {
    const aligned = alignViewerAngleAssetsByFacing(
      angleAssets({
        "profile-left": asset("/side.jpg", "Left profile", 0.99),
      }),
      { "/side.jpg": "left" },
    );

    expect(aligned["profile-left"].src).toBe("/side.jpg");
  });

  it("prefers the actual image filename over a conflicting slot label", () => {
    expect(
      inferFacingDirectionForSlot(
        {
          id: "profile-left",
          label: "Left profile",
          url: "/demo/patient-profile-right-color.jpg",
        },
        {},
      ),
    ).toBe("right");
  });
});
