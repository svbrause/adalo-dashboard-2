import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildViewerAngleAssetsFromManifest,
  cacheBustAuraAssetUrl,
  cacheBustPatientAuraManifest,
  getAvailableViewAngles,
  hasGeneratedAuraStillAssets,
  pickPreferredPatientAuraManifest,
  resolvePatientAuraManifest,
  type PatientAuraAssetManifest,
} from "./patientAuraAssets";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

describe("patient Aura asset manifest", () => {
  it("uses the background-removed still as the default viewer photo", () => {
    const manifest: PatientAuraAssetManifest = {
      turntableVideoUrl: "",
      angles: {
        front: {
          src: "https://storage.googleapis.com/test/aura/client/client-front-rembg.png",
          srcOriginal:
            "https://storage.googleapis.com/test/aura/client/client-front-color.png",
          srcTexture:
            "https://storage.googleapis.com/test/aura/client/client-front-texture-cutout.png",
          timeRatio: 0.5,
          label: "Front",
          fromPhoto: true,
        },
      },
    };

    const assets = buildViewerAngleAssetsFromManifest(manifest, "/fallback.png");

    expect(assets.front.src).toBe(
      "https://storage.googleapis.com/test/aura/client/client-front-rembg.png",
    );
    expect(assets.front.srcCutout).toBe(
      "https://storage.googleapis.com/test/aura/client/client-front-rembg.png",
    );
    expect(assets.front.srcTexture).toBe(
      "https://storage.googleapis.com/test/aura/client/client-front-texture-cutout.png",
    );
  });

  it("preserves color originals when no cutout exists", () => {
    const manifest: PatientAuraAssetManifest = {
      turntableVideoUrl: "",
      angles: {
        front: {
          src: "https://storage.googleapis.com/test/aura/client/client-front-color.png",
          srcOriginal:
            "https://storage.googleapis.com/test/aura/client/client-front-color.png",
          timeRatio: 0.5,
          label: "Front",
          fromPhoto: true,
        },
      },
    };

    const assets = buildViewerAngleAssetsFromManifest(manifest, "/fallback.png");

    expect(assets.front.src).toBe(
      "https://storage.googleapis.com/test/aura/client/client-front-color.png",
    );
    expect(assets.front.srcCutout).toBeUndefined();
  });

  it("detects generated Aura still assets without treating raw photo slots as generated", () => {
    expect(
      hasGeneratedAuraStillAssets({
        src: "https://storage.googleapis.com/test/aura/client/client-front-color.png",
      }),
    ).toBe(true);
    expect(
      hasGeneratedAuraStillAssets({
        srcPigmentation:
          "https://storage.googleapis.com/test/aura/client/client-front-pigmentation-cutout.png",
      }),
    ).toBe(true);
    expect(
      hasGeneratedAuraStillAssets({
        src: "https://dl.airtable.com/raw-uploaded-front.jpg",
        srcTexture: "https://dl.airtable.com/raw-uploaded-front.jpg",
      }),
    ).toBe(false);
  });

  it("cache-busts regenerated Aura assets without altering signed URLs", () => {
    const manifest: PatientAuraAssetManifest = {
      turntableVideoUrl:
        "https://storage.googleapis.com/test-deploy-august25/turntables/morgan-westmoreland-turntable-seek.mp4",
      textureVideoUrl:
        "https://storage.googleapis.com/test-deploy-august25/turntables/morgan-westmoreland-texture.mp4?v=old",
      angles: {
        front: {
          src: "https://storage.googleapis.com/test-deploy-august25/aura/morgan-westmoreland/morgan-westmoreland-front-rembg.png",
          srcOriginal:
            "https://storage.googleapis.com/test-deploy-august25/aura/morgan-westmoreland/morgan-westmoreland-front-color.png",
          srcWrinklesView:
            "/demo-3d/morgan-westmoreland/morgan-westmoreland-front-wrinkles-view.webp",
          timeRatio: 0.5,
          label: "Front",
          fromPhoto: true,
        },
      },
      cvAnnotations: {
        wrinkles: [],
        wrinklesByAngle: {},
        darkSpotsByAngle: {},
        redAreas: [],
        redMaskByAngle: {
          front:
            "https://storage.googleapis.com/test-deploy-august25/aura/morgan-westmoreland/morgan-westmoreland-front-redness-mask.png",
        },
        pores: [],
        poreMaskByAngle: {
          front:
            "https://storage.googleapis.com/test-deploy-august25/aura/morgan-westmoreland/morgan-westmoreland-front-pore-mask.png",
        },
        volume: [],
      },
    };

    const refreshed = cacheBustPatientAuraManifest(manifest, "job-123");

    expect(refreshed.turntableVideoUrl).toContain("auraRefresh=job-123");
    expect(refreshed.textureVideoUrl).toContain("v=old");
    expect(refreshed.textureVideoUrl).toContain("auraRefresh=job-123");
    expect(refreshed.angles.front?.src).toContain("auraRefresh=job-123");
    expect(refreshed.angles.front?.srcOriginal).toContain(
      "auraRefresh=job-123",
    );
    expect(refreshed.angles.front?.srcWrinklesView).toBe(
      "/demo-3d/morgan-westmoreland/morgan-westmoreland-front-wrinkles-view.webp?auraRefresh=job-123",
    );
    expect(refreshed.cvAnnotations?.redMaskByAngle?.front).toContain(
      "auraRefresh=job-123",
    );
    expect(refreshed.cvAnnotations?.poreMaskByAngle?.front).toContain(
      "auraRefresh=job-123",
    );
    expect(
      cacheBustAuraAssetUrl(
        "https://storage.googleapis.com/test/file.png?X-Goog-Signature=abc",
        "job-123",
      ),
    ).toBe(
      "https://storage.googleapis.com/test/file.png?X-Goog-Signature=abc",
    );
  });

  it("keeps generated manifest angles selectable even when availableViewAngles is stale", () => {
    const manifest: PatientAuraAssetManifest = {
      turntableVideoUrl:
        "https://storage.googleapis.com/test-deploy-august25/turntables/morgan-westmoreland-turntable-seek.mp4",
      availableViewAngles: ["profile-left", "front", "profile-right"],
      angles: {
        "profile-left": {
          src: "https://storage.googleapis.com/test/aura/client/client-profile-left-rembg.png",
          timeRatio: 0.99,
          label: "Left profile",
          fromPhoto: true,
        },
        "three-quarter-left": {
          src: "https://storage.googleapis.com/test/aura/client/client-three-quarter-left-rembg.png",
          timeRatio: 0.76,
          label: "Left three-quarter",
          fromPhoto: false,
        },
        front: {
          src: "https://storage.googleapis.com/test/aura/client/client-front-rembg.png",
          timeRatio: 0.5,
          label: "Front",
          fromPhoto: true,
        },
        "three-quarter-right": {
          src: "https://storage.googleapis.com/test/aura/client/client-three-quarter-right-rembg.png",
          timeRatio: 0.24,
          label: "Right three-quarter",
          fromPhoto: false,
        },
        "profile-right": {
          src: "https://storage.googleapis.com/test/aura/client/client-profile-right-rembg.png",
          timeRatio: 0,
          label: "Right profile",
          fromPhoto: true,
        },
      },
    };

    expect(getAvailableViewAngles(manifest, [])).toEqual([
      "profile-left",
      "three-quarter-left",
      "front",
      "three-quarter-right",
      "profile-right",
    ]);
  });

  it("keeps diagnostic-only generated angles selectable", () => {
    const manifest: PatientAuraAssetManifest = {
      turntableVideoUrl:
        "https://storage.googleapis.com/test-deploy-august25/turntables/wafaa-risheq-turntable-seek.mp4",
      availableViewAngles: ["front", "profile-left"],
      angles: {
        front: {
          src: "https://storage.googleapis.com/test-deploy-august25/aura/wafaa-risheq/wafaa-risheq-front-rembg.png",
          timeRatio: 0.5,
          label: "Front",
          fromPhoto: true,
        },
        "profile-right": {
          src: "",
          srcPigmentation:
            "https://storage.googleapis.com/test-deploy-august25/aura/wafaa-risheq/wafaa-risheq-profile-right-pigmentation-cutout.png",
          timeRatio: 0,
          label: "Right profile",
        },
      },
    };

    expect(getAvailableViewAngles(manifest, [])).toContain("profile-right");
  });

  it("loads the richer Aura manifest next to a saved GCS turntable", async () => {
    const manifest: PatientAuraAssetManifest = {
      turntableVideoUrl:
        "https://storage.googleapis.com/test-deploy-august25/turntables/morgan-westmoreland-turntable-seek.mp4",
      angles: {
        front: {
          src: "https://storage.googleapis.com/test-deploy-august25/aura/morgan-westmoreland/morgan-westmoreland-front-rembg.png",
          srcOriginal:
            "https://storage.googleapis.com/test-deploy-august25/aura/morgan-westmoreland/morgan-westmoreland-front-color.png",
          timeRatio: 0.5,
          label: "Front",
          fromPhoto: true,
        },
      },
      cvAnnotations: {
        wrinkles: [],
        wrinklesByAngle: {},
        darkSpotsByAngle: {},
        redAreas: [],
        redMaskByAngle: {
          front:
            "/demo-3d/morgan-westmoreland/morgan-westmoreland-front-redness-mask.png",
        },
        pores: [],
        poreMaskByAngle: {
          front:
            "/demo-3d/morgan-westmoreland/morgan-westmoreland-front-pore-mask.png",
        },
        volume: [],
      },
    };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => ({
      ok: true,
      status: 200,
      json: async () => manifest,
    }));
    vi.stubGlobal("fetch", fetchMock);

    const resolved = await resolvePatientAuraManifest({
      clientName: "Morgan Westmoreland",
      turntableVideoUrl:
        "https://storage.googleapis.com/test-deploy-august25/turntables/morgan-westmoreland-turntable-seek.mp4",
    });

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/aura/morgan-westmoreland/morgan-westmoreland-aura-manifest.json",
    );
    expect(resolved?.angles.front?.src).toContain("-rembg.png");
    expect(resolved?.cvAnnotations?.redMaskByAngle?.front).toBe(
      "https://storage.googleapis.com/test-deploy-august25/aura/morgan-westmoreland/morgan-westmoreland-front-redness-mask.png",
    );
    expect(resolved?.cvAnnotations?.poreMaskByAngle?.front).toBe(
      "https://storage.googleapis.com/test-deploy-august25/aura/morgan-westmoreland/morgan-westmoreland-front-pore-mask.png",
    );
  });

  it("prefers manifests with skin-lens stills over turntable-only stubs", () => {
    const turntableOnly: PatientAuraAssetManifest = {
      turntableVideoUrl: "https://storage.googleapis.com/test/video.mp4",
      angles: {},
    };
    const progressScan: PatientAuraAssetManifest = {
      turntableVideoUrl: "https://storage.googleapis.com/test/video.mp4",
      angles: {
        front: {
          src: "/demo-3d/progress/front-rembg.png",
          srcPigmentation: "/demo-3d/progress/front-pigmentation-cutout.png",
          srcRedness: "/demo-3d/progress/front-redness-cutout.png",
          srcPores: "/demo-3d/progress/front-pores-cutout.png",
          srcWrinklesView: "/demo-3d/progress/front-wrinkles-view.png",
          timeRatio: 0.5,
          label: "Front",
        },
      },
    };

    const picked = pickPreferredPatientAuraManifest(
      turntableOnly,
      progressScan,
    );
    expect(picked?.angles.front?.srcPigmentation).toContain(
      "pigmentation-cutout",
    );
  });
});
