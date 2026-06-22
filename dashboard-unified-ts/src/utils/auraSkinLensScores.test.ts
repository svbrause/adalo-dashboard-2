import { describe, expect, it } from "vitest";
import { COURTNEY_BELLAMY_SEVERITY_ISSUES } from "../debug/adminDemoSeverityOverlay";
import { computeCategories } from "../config/analysisOverviewConfig";
import { buildSkinLensRadarData } from "./auraAnalysisBridge";
import {
  getDetectedIssuesFromClient,
  getEffectiveSeverityIssues,
} from "./analysisOverviewClient";
import type { Client } from "../types";

function courtneyClient(): Client {
  const detectedIssues = Object.entries(COURTNEY_BELLAMY_SEVERITY_ISSUES)
    .filter(([, row]) => row.predicted)
    .map(([issue]) => issue)
    .join(", ");
  return {
    id: "rec-live-courtney",
    name: "Courtney Bellamy",
    email: "courtney@example.com",
    phone: "",
    tableSource: "Patients",
    archived: false,
    allIssues: detectedIssues,
    interestedIssues: detectedIssues,
  } as Client;
}

describe("skin lens chart scores", () => {
  it("reports the four visible skin lenses without fabricating empty-lens severity", () => {
    const client = courtneyClient();
    const detected = getDetectedIssuesFromClient(client);
    const categories = computeCategories(detected);
    const skin = categories.find((c) => c.key === "skinHealth");
    expect(skin).toBeDefined();

    const rows = buildSkinLensRadarData(skin!, {
      detected,
      severityIssues: getEffectiveSeverityIssues(client),
    });
    expect(rows.map((row) => row.lens)).toEqual([
      "pores",
      "redness",
      "wrinkles",
      "pigmentation",
    ]);

    const byLens = Object.fromEntries(
      rows.map((r) => [r.lens, r.score]),
    ) as Record<string, number>;
    expect(byLens.wrinkles).toBe(100);
    expect(byLens.redness).toBeLessThan(100);
    expect(byLens.pores).toBeLessThan(100);
    expect(byLens.pigmentation).toBeLessThan(100);
  });

  it("orders Courtney with redness as the most severe lens", () => {
    const client = courtneyClient();
    const detected = getDetectedIssuesFromClient(client);
    const categories = computeCategories(detected);
    const skin = categories.find((c) => c.key === "skinHealth")!;

    const rows = buildSkinLensRadarData(skin, {
      detected,
      severityIssues: COURTNEY_BELLAMY_SEVERITY_ISSUES,
    });
    const byLens = Object.fromEntries(
      rows.map((r) => [r.lens, r.severityAxis]),
    ) as Record<string, number>;

    expect(byLens.redness).toBeGreaterThan(byLens.wrinkles);
    expect(byLens.pores).toBeGreaterThan(byLens.wrinkles);
  });
});
