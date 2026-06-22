import { describe, expect, it } from "vitest";
import type { ClientPhotoSlot } from "../types";
import {
  buildViewerAngleAssetsFromPhotoSlots,
  inferAvailableViewAnglesFromPhotoSlots,
} from "./auraTanAnglePhotos";

describe("buildViewerAngleAssetsFromPhotoSlots", () => {
  it("maps generic Side label slots to the right-facing pre-scan still", () => {
    const slots: ClientPhotoSlot[] = [
      { id: "rec-front", label: "Front", url: "https://example.com/front.jpg" },
      { id: "rec-side", label: "Side", url: "https://example.com/side.jpg" },
    ];

    expect(inferAvailableViewAnglesFromPhotoSlots(slots)).toEqual([
      "profile-left",
      "front",
    ]);

    const assets = buildViewerAngleAssetsFromPhotoSlots(slots);
    expect(assets.front.src).toBe("https://example.com/front.jpg");
    expect(assets["profile-left"].src).toBe("https://example.com/side.jpg");
  });

  it("does not reuse front photo for side when a distinct side slot exists", () => {
    const slots: ClientPhotoSlot[] = [
      { id: "front-form", label: "Front photo", url: "/front.png" },
      { id: "side-form", label: "Profile", url: "/side.png" },
    ];

    const assets = buildViewerAngleAssetsFromPhotoSlots(slots);
    expect(assets.front.src).toBe("/front.png");
    expect(assets["profile-left"].src).toBe("/side.png");
  });

  it("maps five anatomical upload slots to visual rail angles", () => {
    const slots: ClientPhotoSlot[] = [
      { id: "front", label: "Front", url: "/front.png" },
      { id: "left45", label: "Left 45 degrees", url: "/left45.png" },
      { id: "right45", label: "Right 45 degrees", url: "/right45.png" },
      { id: "left90", label: "Left 90 degrees", url: "/left90.png" },
      { id: "right90", label: "Right 90 degrees", url: "/right90.png" },
    ];

    expect(inferAvailableViewAnglesFromPhotoSlots(slots)).toEqual([
      "profile-left",
      "three-quarter-left",
      "front",
      "three-quarter-right",
      "profile-right",
    ]);

    const assets = buildViewerAngleAssetsFromPhotoSlots(slots);
    expect(assets["profile-left"].src).toBe("/left90.png");
    expect(assets["three-quarter-left"].src).toBe("/left45.png");
    expect(assets.front.src).toBe("/front.png");
    expect(assets["three-quarter-right"].src).toBe("/right45.png");
    expect(assets["profile-right"].src).toBe("/right90.png");
  });
});
