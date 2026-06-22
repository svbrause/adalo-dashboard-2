import { describe, expect, it } from "vitest";
import { computeCategories, normalizeIssue } from "../config/analysisOverviewConfig";
import {
  buildSkinLensRadarData,
  collectIssuesForSkinLens,
  healthScoreToSeverityAxis,
} from "../utils/auraAnalysisBridge";
import { buildViewerAngleAssetsFromPhotoSlots } from "../utils/auraTanAnglePhotos";
import { getDetectedIssuesFromClient } from "../utils/analysisOverviewClient";
import { getAdminDemoClientsIfEnabled } from "./adminDemoClients";
import type { Client } from "../types";

const REDNESS_ISSUES = ["red spots", "rosacea"];
const PORES_ISSUES = ["whiteheads", "blackheads"];

function demoHasRednessAndPores(client: Client | undefined): boolean {
  if (!client) return false;
  const detected = getDetectedIssuesFromClient(client);
  const hasRedness = REDNESS_ISSUES.some((k) => detected.has(k));
  const hasPores = PORES_ISSUES.some((k) => detected.has(k));
  return hasRedness && hasPores;
}

const adminProvider = { code: "admin", name: "Admin" };

function liveClient(overrides: Partial<Client> & Pick<Client, "id" | "name">): Client {
  const { id, name, ...rest } = overrides;
  return {
    email: "live@example.com",
    phone: "",
    tableSource: "Patients",
    archived: false,
    discussedItems: [],
    ...rest,
    id,
    name,
  } as Client;
}

describe("getAdminDemoClientsIfEnabled", () => {
  it("returns Tanya Tan for admin provider", () => {
    const demos = getAdminDemoClientsIfEnabled(adminProvider, []);
    const tanya = demos.find((c) => c.id === "admin-demo-tanya");
    expect(tanya?.name).toBe("Tanya Tan");
  });

  it("Tanya Tan includes demo redness and pore findings with severity", () => {
    const demos = getAdminDemoClientsIfEnabled(adminProvider, []);
    const tanya = demos.find((c) => c.id === "admin-demo-tanya");
    expect(demoHasRednessAndPores(tanya)).toBe(true);
    for (const client of [tanya]) {
      const red = client?.severityScoresFromAnalyses?.issues?.["Red Spots"];
      const pores = client?.severityScoresFromAnalyses?.issues?.["Whiteheads"];
      const pigment = client?.severityScoresFromAnalyses?.issues?.["Dark Spots"];
      expect(red?.predicted).toBe(true);
      expect(red?.severity_normalized_0_1).toBeGreaterThan(0.25);
      expect(pores?.predicted).toBe(true);
      expect(pores?.severity_normalized_0_1).toBeGreaterThan(0.25);
      expect(pigment?.severity_normalized_0_1).toBeGreaterThan(
        red?.severity_normalized_0_1 ?? 0,
      );
    }
    expect(
      getDetectedIssuesFromClient(tanya!).has(normalizeIssue("Rosacea")),
    ).toBe(true);

    for (const client of [tanya]) {
      const detected = getDetectedIssuesFromClient(client!);
      const categories = computeCategories(detected);
      const skin = categories.find((c) => c.key === "skinHealth");
      expect(skin).toBeDefined();
      const lensRows = buildSkinLensRadarData(skin!, {
        detected,
        severityIssues: client!.severityScoresFromAnalyses?.issues,
      });
      expect(lensRows).toHaveLength(4);
      for (const row of lensRows) {
        const axis = healthScoreToSeverityAxis(row.score);
        expect(axis).toBeGreaterThanOrEqual(1.2);
        expect(axis).toBeLessThanOrEqual(2.8);
        expect(axis.toFixed(1)).toMatch(/^\d+\.\d$/);
      }
    }
  });

  it("includes completed skincare quiz with routine products for Tanya Tan", () => {
    const demos = getAdminDemoClientsIfEnabled(adminProvider, []);
    const tanya = demos.find((c) => c.id === "admin-demo-tanya");
    expect(tanya?.skincareQuiz?.completedAt).toBeTruthy();
    expect(tanya?.skincareQuiz?.result).toBe("amber");
    expect(tanya?.skincareQuiz?.resultLabel).toBe("Amber");
    expect(tanya?.skincareQuiz?.recommendedProductNames?.length).toBeGreaterThan(5);
    expect(Object.keys(tanya?.skincareQuiz?.answers ?? {}).length).toBeGreaterThan(10);
  });

  it("renames demo when a live patient already has the same name", () => {
    const live = [liveClient({ id: "rec-live-tanya", name: "Tanya Tan" })];
    const demos = getAdminDemoClientsIfEnabled(adminProvider, live);
    const tanya = demos.find((c) => c.id === "admin-demo-tanya");
    expect(tanya?.name).toBe("Tanya Tan");
  });

  it("does not inject the removed Courtney Bellamy Aura demo client", () => {
    const demos = getAdminDemoClientsIfEnabled(adminProvider, []);
    expect(demos.some((c) => c.id === "admin-demo-courtney")).toBe(false);
    expect(demos.some((c) => c.name === "Courtney Bellamy (Aura Demo)")).toBe(false);
  });

  it("includes updated-pipeline sample Aura records for Admin", () => {
    const demos = getAdminDemoClientsIfEnabled(adminProvider, []);
    const samples = demos.filter((c) => c.id.startsWith("admin-demo-sample-"));
    expect(samples.map((c) => c.id)).toEqual([
      "admin-demo-sample-czarina",
      "admin-demo-sample-julio",
      "admin-demo-sample-snigdha",
    ]);
    for (const sample of samples) {
      expect(sample.auraManifestUrl).toContain("/demo-3d/sample-");
      expect(sample.galleryPhotoSlots?.length).toBeGreaterThanOrEqual(3);
      expect(sample.frontPhoto).toContain("-front-color.png");
      expect(sample.severityScoresFromAnalyses?.detector_type).toBe(
        "local_gcp_pipeline_sample",
      );
      expect(Object.keys(sample.severityScoresFromAnalyses?.issues ?? {})).not.toHaveLength(0);
    }
  });

  it("includes a progress tracking demo with two dated scans", () => {
    const demos = getAdminDemoClientsIfEnabled(adminProvider, []);
    const progressDemo = demos.find((c) => c.id === "admin-demo-progress-tracking");
    expect(progressDemo?.name).toBe("Anita Desai");
    expect(progressDemo?.progressScans).toHaveLength(2);
    expect(progressDemo?.progressScans?.map((scan) => scan.label)).toEqual([
      "July 1, 2026 scan",
      "September 1, 2026 scan",
    ]);
    const [july, september] = progressDemo!.progressScans!;
    expect(july.metrics?.pigmentation).toBeGreaterThan(
      september.metrics?.pigmentation ?? 0,
    );
    expect(july.metrics?.redness).toBeGreaterThan(
      september.metrics?.redness ?? 0,
    );
    expect(july.photoSlots?.find((slot) => slot.id === "front")?.url).toContain(
      "tanya-progress-before-front.JPG",
    );
    expect(july.photoSlots?.find((slot) => slot.id === "front")?.url).toMatch(
      /^\/demo-3d\/tanya-progress-before\//,
    );
    expect(september.photoSlots?.find((slot) => slot.id === "front")?.url).toContain(
      "tanya-progress-aura-after-front-color.png",
    );
    expect(july.photoSlots?.find((slot) => slot.id === "front")?.url).not.toBe(
      september.photoSlots?.find((slot) => slot.id === "front")?.url,
    );
    expect(july.photoSlots?.map((slot) => slot.id)).toEqual([
      "profile-left",
      "front",
      "profile-right",
    ]);
    expect(july.photoSlots?.find((slot) => slot.id === "profile-right")?.url).toContain(
      "tanya-progress-before-profile-left.JPG",
    );
    expect(july.auraManifest?.angles?.["profile-right"]?.srcPigmentation).toContain(
      "tanya-progress-aura-before-profile-left-pigmentation-cutout.png",
    );
    expect(july.auraManifest?.angles?.front?.srcPigmentation).toBeTruthy();
    expect(july.auraManifest?.angles?.front?.srcPigmentation).toContain(
      "tanya-progress-aura-before-front-pigmentation-cutout.png",
    );
    expect(september.auraManifest?.angles?.front?.srcRedness).toContain(
      "tanya-progress-aura-after-front-redness-cutout.png",
    );
    expect(september.auraManifest?.angles?.front?.photoZoom).toBe(1);
  });

  it("maps Morgan Westmoreland photos to the viewer-side Aura silhouettes", () => {
    const demos = getAdminDemoClientsIfEnabled(adminProvider, []);
    const morgan = demos.find((c) => c.id === "admin-demo-morgan");
    expect(morgan?.galleryPhotoSlots).toBeTruthy();

    const assets = buildViewerAngleAssetsFromPhotoSlots(morgan!.galleryPhotoSlots!);
    expect(assets["profile-left"].src).toContain("morgan-westmoreland-profile-left-color.jpg");
    expect(assets["three-quarter-left"].src).toContain(
      "morgan-westmoreland-three-quarter-left-color.jpg",
    );
    expect(assets["three-quarter-right"].src).toContain(
      "morgan-westmoreland-three-quarter-right-color.jpg",
    );
    expect(assets["profile-right"].src).toContain("morgan-westmoreland-profile-right-color.jpg");
  });

  it("maps Morgan Westmoreland skin severity rows into skin scores and findings", () => {
    const demos = getAdminDemoClientsIfEnabled(adminProvider, []);
    const morgan = demos.find((c) => c.id === "admin-demo-morgan");
    expect(morgan).toBeTruthy();

    const detected = getDetectedIssuesFromClient(morgan!);
    expect(detected.has(normalizeIssue("Facial Redness"))).toBe(true);
    expect(detected.has(normalizeIssue("Enlarged Pores"))).toBe(true);
    expect(detected.has(normalizeIssue("Acne / Breakouts"))).toBe(true);
    expect(detected.has(normalizeIssue("Uneven Skin Texture"))).toBe(true);

    const categories = computeCategories(detected);
    const skin = categories.find((c) => c.key === "skinHealth");
    expect(skin).toBeDefined();
    expect(skin!.score).toBeLessThan(100);

    const severityIssues = morgan!.severityScoresFromAnalyses?.issues;
    expect(
      collectIssuesForSkinLens("redness", [], severityIssues),
    ).toContain("Facial Redness");
    expect(
      collectIssuesForSkinLens("pores", [], severityIssues),
    ).toEqual(
      expect.arrayContaining([
        "Enlarged Pores",
        "Acne / Breakouts",
        "Uneven Skin Texture",
      ]),
    );

    const lensRows = buildSkinLensRadarData(skin!, {
      detected,
      severityIssues,
    });
    const lensScore = (name: string) =>
      lensRows.find((row) => row.name === name)?.score;
    expect(lensScore("Redness")).toBeLessThan(100);
    expect(lensScore("Pores")).toBeLessThan(100);
    expect(lensScore("Pigmentation")).toBe(100);
    expect(lensScore("Wrinkles")).toBe(100);
  });

  it("Anita Desai progress demo has clinically coherent volume and structure scores", () => {
    const demos = getAdminDemoClientsIfEnabled(adminProvider, []);
    const progressClient = demos.find((c) => c.id === "admin-demo-progress-tracking");
    expect(progressClient?.name).toBe("Anita Desai");

    const subScore = (
      categories: ReturnType<typeof computeCategories>,
      key: string,
      name: string,
    ) =>
      categories
        .find((c) => c.key === key)
        ?.subScores.find((sub) => sub.name === name)?.score;

    const julyScan = progressClient!.progressScans?.find(
      (scan) => scan.id === "admin-demo-progress-2026-07-01",
    );
    const septemberScan = progressClient!.progressScans?.find(
      (scan) => scan.id === "admin-demo-progress-2026-09-01",
    );

    const julyDetected = getDetectedIssuesFromClient({
      ...progressClient!,
      severityScoresFromAnalyses: julyScan?.severityScores ?? undefined,
    });
    const septemberDetected = getDetectedIssuesFromClient({
      ...progressClient!,
      severityScoresFromAnalyses: septemberScan?.severityScores ?? undefined,
    });

    // Skin-led case: early midface volume + mild jawline softening only.
    expect(julyDetected.has(normalizeIssue("Under Eye Hollow"))).toBe(true);
    expect(julyDetected.has(normalizeIssue("Mid Cheek Flattening"))).toBe(true);
    expect(julyDetected.has(normalizeIssue("Nasolabial Folds"))).toBe(true);
    expect(julyDetected.has(normalizeIssue("Ill-Defined Jawline"))).toBe(true);
    expect(julyDetected.has(normalizeIssue("Temporal Hollow"))).toBe(true);
    expect(julyDetected.has(normalizeIssue("Marionette Lines"))).toBe(true);
    expect(julyDetected.has(normalizeIssue("Asymmetric Jawline"))).toBe(true);
    expect(julyDetected.has(normalizeIssue("Jowls"))).toBe(false);
    expect(julyDetected.has(normalizeIssue("Brow Ptosis"))).toBe(false);

    expect(septemberDetected.has(normalizeIssue("Temporal Hollow"))).toBe(false);
    expect(septemberDetected.has(normalizeIssue("Marionette Lines"))).toBe(false);
    expect(septemberDetected.has(normalizeIssue("Asymmetric Jawline"))).toBe(true);

    const julyCategories = computeCategories(julyDetected);
    const septemberCategories = computeCategories(septemberDetected);

    // July (before peel): midface volume + early lower-face lines; jaw slightly softer.
    expect(subScore(julyCategories, "volumeLoss", "Eye Area")).toBe(67);
    expect(subScore(julyCategories, "volumeLoss", "Cheek Area")).toBe(50);
    expect(subScore(julyCategories, "volumeLoss", "Neck Area")).toBe(100);
    expect(subScore(julyCategories, "volumeLoss", "Lower Face")).toBe(60);
    expect(julyCategories.find((c) => c.key === "volumeLoss")!.score).toBe(69);

    expect(subScore(julyCategories, "proportions", "Brow & Eyes")).toBe(100);
    expect(subScore(julyCategories, "proportions", "Jaw")).toBe(67);
    expect(subScore(julyCategories, "proportions", "Nose")).toBe(100);
    expect(subScore(julyCategories, "proportions", "Lips")).toBe(100);
    expect(julyCategories.find((c) => c.key === "proportions")!.score).toBe(92);

    // September (after treatment): fewer flagged volume/structure findings.
    expect(subScore(septemberCategories, "volumeLoss", "Cheek Area")).toBe(75);
    expect(subScore(septemberCategories, "volumeLoss", "Lower Face")).toBe(80);
    expect(
      septemberCategories.find((c) => c.key === "volumeLoss")!.score,
    ).toBe(81);

    expect(subScore(septemberCategories, "proportions", "Jaw")).toBe(67);
    expect(
      septemberCategories.find((c) => c.key === "proportions")!.score,
    ).toBe(92);

    expect(
      septemberCategories.find((c) => c.key === "volumeLoss")!.score,
    ).toBeGreaterThan(julyCategories.find((c) => c.key === "volumeLoss")!.score);
    expect(
      septemberCategories.find((c) => c.key === "proportions")!.score,
    ).toBeGreaterThanOrEqual(
      julyCategories.find((c) => c.key === "proportions")!.score,
    );

    const julyIssues = julyScan?.severityScores?.issues ?? {};
    expect(julyIssues["Under Eye Hollow"]?.severity_normalized_0_1).toBeCloseTo(
      0.28 * 1.05,
      2,
    );
    expect(julyIssues["Ill-Defined Jawline"]?.severity_normalized_0_1).toBeCloseTo(
      0.22,
      2,
    );
  });

  it("skips non-admin providers", () => {
    expect(
      getAdminDemoClientsIfEnabled({ code: "TheTreatment250", name: "The Treatment" }, []),
    ).toEqual([]);
  });
});
