import { describe, expect, it } from "vitest";
import { getHighlightedRegionIds } from "../components/postVisitBlueprint/AiMirrorCanvas";
import type { Client } from "../types";
import { buildAnalysisAreaFaceHighlights, buildDefaultTabSeverityHighlights, buildSkinLensDefaultHighlights } from "./auraTabDefaultHighlights";
import { getAdminDemoClientsIfEnabled } from "../debug/adminDemoClients";

const adminProvider = { code: "admin", name: "Admin" };

describe("buildDefaultTabSeverityHighlights", () => {
  it("separates volume and structure face regions for Anita Desai progress demo", () => {
    const demos = getAdminDemoClientsIfEnabled(adminProvider, []);
    const client = demos.find((c) => c.id === "admin-demo-progress-tracking");
    expect(client).toBeDefined();

    const highlights = buildDefaultTabSeverityHighlights(client!);
    const volumeRegions = new Set(highlights.volume?.regionIds ?? []);
    const structureRegions = new Set(highlights.structure?.regionIds ?? []);

    expect(volumeRegions.has("rLeftUnderEye")).toBe(true);
    expect(volumeRegions.has("rRightUnderEye")).toBe(true);
    expect(volumeRegions.has("rLeftCheek")).toBe(true);
    expect(volumeRegions.has("rRightCheek")).toBe(true);
    expect(volumeRegions.has("rLeftNasolabialFold")).toBe(true);
    expect(volumeRegions.has("rLowerFace")).toBe(false);

    expect(structureRegions.has("rLowerFace")).toBe(true);
    expect(structureRegions.has("rLeftUnderEye")).toBe(false);
    expect(structureRegions.has("rLeftCheek")).toBe(false);

    const overlap = [...volumeRegions].filter((id) => structureRegions.has(id));
    expect(overlap).toEqual([]);
  });

  it("returns under-eye highlights for volume when hollow severity is present", () => {
    const client = {
      id: "rec-test",
      name: "Test Client",
      email: "",
      phone: "",
      tableSource: "Patients",
      archived: false,
      severityScoresFromAnalyses: {
        issues: {
          "Under Eye Hollow": {
            predicted: true,
            probability: 0.88,
            severity: 3,
            severity_normalized_0_1: 0.72,
            severity_level: "moderate-severe",
          },
          "Nasolabial Folds": {
            predicted: true,
            probability: 0.65,
            severity: 2,
            severity_normalized_0_1: 0.48,
            severity_level: "moderate",
          },
        },
      },
    } as unknown as Client;

    const highlights = buildDefaultTabSeverityHighlights(client);
    expect(highlights.volume?.terms).toContain("under eye");
    expect(highlights.volume?.labelsByRegionId).toBeDefined();

    const regionIds = getHighlightedRegionIds(highlights.volume!.terms);
    expect(
      regionIds.has("rLeftUnderEye") ||
        regionIds.has("rRightUnderEye") ||
        highlights.volume!.regionIds.some((id) => id.includes("UnderEye")),
    ).toBe(true);
  });

  it("returns empty structure highlights when client has no structural findings", () => {
    const highlights = buildDefaultTabSeverityHighlights({
      id: "rec-empty",
      name: "Empty Client",
      email: "",
      phone: "",
      tableSource: "Patients",
      archived: false,
    } as unknown as Client);
    expect(highlights.structure).toBeUndefined();
  });
});

describe("buildSkinLensDefaultHighlights", () => {
  it("returns pigmentation and redness highlights for progress demo severity", () => {
    const client = {
      id: "admin-demo-progress-tracking",
      name: "Anita Desai",
      email: "",
      phone: "",
      tableSource: "Patients",
      archived: false,
      severityScoresFromAnalyses: {
        issues: {
          "Dark Spots": {
            predicted: true,
            probability: 0.7,
            severity: 0.38,
            severity_normalized_0_1: 0.38,
            severity_level: "mild-moderate",
          },
          "Facial Redness": {
            predicted: true,
            probability: 0.6,
            severity: 0.27,
            severity_normalized_0_1: 0.27,
            severity_level: "mild",
          },
          "Enlarged Pores": {
            predicted: true,
            probability: 0.55,
            severity: 0.34,
            severity_normalized_0_1: 0.34,
            severity_level: "mild-moderate",
          },
          "Fine Lines": {
            predicted: true,
            probability: 0.5,
            severity: 0.26,
            severity_normalized_0_1: 0.26,
            severity_level: "mild",
          },
        },
      },
    } as unknown as Client;

    const highlights = buildSkinLensDefaultHighlights(client);
    expect(highlights.pigmentation?.terms.length).toBeGreaterThan(0);
    expect(highlights.redness?.terms.length).toBeGreaterThan(0);
    expect(highlights.pores?.terms.length).toBeGreaterThan(0);
    expect(highlights.wrinkles?.terms).toContain("fine lines");
    expect(highlights.wrinkles?.regionIds).toEqual(
      expect.arrayContaining(["rForehead", "rLeftEye", "rRightEye"]),
    );
  });
});

describe("buildAnalysisAreaFaceHighlights", () => {
  const client = {
    id: "rec-area",
    name: "Area Client",
    email: "",
    phone: "",
    tableSource: "Patients",
    archived: false,
    severityScoresFromAnalyses: {
      issues: {
        "Under Eye Hollow": {
          predicted: true,
          probability: 0.88,
          severity: 3,
          severity_normalized_0_1: 0.72,
          severity_level: "moderate-severe",
        },
        "Nasolabial Folds": {
          predicted: true,
          probability: 0.65,
          severity: 2,
          severity_normalized_0_1: 0.48,
          severity_level: "moderate",
        },
      },
    },
  } as unknown as Client;

  it("returns null for the all-areas tab", () => {
    const highlights = buildAnalysisAreaFaceHighlights(
      client,
      "volumeLoss",
      "All",
    );
    expect(highlights).toBeNull();
  });

  it("limits volume eye area to under-eye regions and terms", () => {
    const highlights = buildAnalysisAreaFaceHighlights(
      client,
      "volumeLoss",
      "Eye Area",
    );
    expect(highlights?.terms).toContain("under eye");
    expect(highlights?.terms.some((t) => t.toLowerCase().includes("nasolabial"))).toBe(
      false,
    );
    expect(highlights?.regionIds.every((id) => id.includes("Eye"))).toBe(true);
  });

  it("limits lower face to mouth/jaw regions when NLF is detected", () => {
    const highlights = buildAnalysisAreaFaceHighlights(
      client,
      "volumeLoss",
      "Lower Face",
    );
    expect(highlights?.terms.some((t) => t.toLowerCase().includes("nasolabial"))).toBe(
      true,
    );
    expect(
      highlights?.regionIds.some(
        (id) => id === "rLowerFace" || id === "rLeftNasolabialFold",
      ),
    ).toBe(true);
    expect(highlights?.regionIds.some((id) => id.includes("UnderEye"))).toBe(false);
  });
});
