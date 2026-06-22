import { describe, expect, it } from "vitest";
import type { Client } from "../types";
import type { PatientAuraAssetManifest } from "./patientAuraAssets";
import { buildPatientMediaLibrary } from "./patientMediaLibrary";

const client = {
  id: "patient-1",
  name: "Morgan Westmoreland",
  frontPhoto: null,
  turntableVideoUrl: null,
} as Client;

describe("buildPatientMediaLibrary", () => {
  it("adds generated Aura analysis stills to patient files", () => {
    const manifest: PatientAuraAssetManifest = {
      turntableVideoUrl: "https://storage.googleapis.com/test/turntable.mp4",
      angles: {
        front: {
          src: "https://storage.googleapis.com/test/aura/morgan/front-rembg.png",
          srcOriginal:
            "https://storage.googleapis.com/test/aura/morgan/front-original.png",
          srcPigmentation:
            "https://storage.googleapis.com/test/aura/morgan/front-pigmentation.png",
          srcRedness:
            "https://storage.googleapis.com/test/aura/morgan/front-redness.png",
          srcPores: "https://storage.googleapis.com/test/aura/morgan/front-pores.png",
          srcWrinklesView:
            "https://storage.googleapis.com/test/aura/morgan/front-wrinkles-view.webp",
          timeRatio: 0.5,
          label: "Front",
          fromPhoto: true,
        },
        "profile-right": {
          src: "https://storage.googleapis.com/test/aura/morgan/right-rembg.png",
          srcOriginal:
            "https://storage.googleapis.com/test/aura/morgan/right-original.png",
          srcTexture:
            "https://storage.googleapis.com/test/aura/morgan/right-texture.png",
          timeRatio: 0.25,
          label: "Right profile",
          fromPhoto: true,
        },
      },
    };

    const sections = buildPatientMediaLibrary({
      client,
      photoSlots: [
        {
          id: "front-original",
          label: "Front original",
          url: "https://storage.googleapis.com/test/aura/morgan/front-original.png",
        },
      ],
      auraManifest: manifest,
      turntableVideoUrl: manifest.turntableVideoUrl,
    });

    const byTitle = new Map(sections.system.map((item) => [item.title, item]));

    expect(byTitle.get("Front original")?.url).toBe(
      "https://storage.googleapis.com/test/aura/morgan/front-original.png",
    );
    expect(byTitle.get("Front - Background removed")?.url).toBe(
      "https://storage.googleapis.com/test/aura/morgan/front-rembg.png",
    );
    expect(byTitle.get("Front - Pigmentation")?.systemCategory).toBe(
      "texture_maps",
    );
    expect(byTitle.get("Front - Redness")?.systemCategory).toBe(
      "redness_annotations",
    );
    expect(byTitle.get("Front - Pores")?.systemCategory).toBe(
      "pore_annotations",
    );
    expect(byTitle.get("Front - Wrinkles")?.systemCategory).toBe(
      "wrinkle_annotations",
    );
    expect(byTitle.get("Right profile - Pigmentation")?.url).toBe(
      "https://storage.googleapis.com/test/aura/morgan/right-texture.png",
    );
    expect(byTitle.get("Rotating face view")?.kind).toBe("video");
  });

  it("does not duplicate generated stills already represented by scan photos", () => {
    const cutoutUrl = "https://storage.googleapis.com/test/aura/morgan/front-rembg.png";
    const manifest: PatientAuraAssetManifest = {
      turntableVideoUrl: "",
      angles: {
        front: {
          src: cutoutUrl,
          srcCutout: cutoutUrl,
          timeRatio: 0.5,
          label: "Front",
        },
      },
    };

    const sections = buildPatientMediaLibrary({
      client,
      photoSlots: [{ id: "front", label: "Front", url: cutoutUrl }],
      auraManifest: manifest,
    });

    expect(sections.system.filter((item) => item.url === cutoutUrl)).toHaveLength(1);
  });
});
