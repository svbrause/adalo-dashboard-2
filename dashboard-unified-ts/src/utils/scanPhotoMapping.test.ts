import { describe, expect, it } from "vitest";
import type { ClientPhotoSlot } from "../types";
import { mapSlotsToModalPhotos } from "./scanPhotoMapping";

describe("mapSlotsToModalPhotos", () => {
  it("allows a selected original form front photo to become the scan front", () => {
    const slots: ClientPhotoSlot[] = [
      {
        id: "front-form",
        label: "Front (intake)",
        url: "https://example.com/original-front.jpg",
      },
    ];

    expect(mapSlotsToModalPhotos(slots)).toEqual({
      front: "https://example.com/original-front.jpg",
    });
  });

  it("keeps form side photos in the scan payload", () => {
    const slots: ClientPhotoSlot[] = [
      { id: "front-form", label: "Front (intake)", url: "/front.jpg" },
      { id: "side-form", label: "Side (intake)", url: "/side.jpg" },
    ];

    expect(mapSlotsToModalPhotos(slots)).toEqual({
      front: "/front.jpg",
      side: "/side.jpg",
    });
  });

  it("excludes consent and document slots", () => {
    const slots: ClientPhotoSlot[] = [
      { id: "consent-form", label: "Consent form", url: "/consent.pdf" },
      { id: "front-form", label: "Front (intake)", url: "/front.jpg" },
    ];

    expect(mapSlotsToModalPhotos(slots)).toEqual({
      front: "/front.jpg",
    });
  });
});
