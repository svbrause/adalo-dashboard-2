import { describe, expect, it } from "vitest";
import { getAdminDemoClients } from "../debug/adminDemoClients";
import { COURTNEY_BELLAMY_SEVERITY_ISSUES } from "../debug/adminDemoSeverityOverlay";
import { computeCategories } from "../config/analysisOverviewConfig";
import {
  buildSkinLensRadarData,
  MIN_LENS_AXIS_GAP,
} from "./auraAnalysisBridge";
import {
  getDetectedIssuesFromClient,
  getEffectiveSeverityIssues,
} from "./analysisOverviewClient";
import type { Client } from "../types";

function courtneyClient(): Client {
  const client = getAdminDemoClients().find((c) => c.id === "admin-demo-courtney");
  if (!client) {
    throw new Error("Courtney Bellamy admin demo client not found");
  }
  return client;
}

function minPairwiseGap(values: number[]): number {
  let min = Infinity;
  for (let i = 0; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) {
      min = Math.min(min, Math.abs(values[i] - values[j]));
    }
  }
  return min;
}

describe("skin lens chart scores", () => {
  it("keeps texture, redness, pores, and wrinkles petals visibly separated", () => {
    const client = courtneyClient();
    const detected = getDetectedIssuesFromClient(client);
    const categories = computeCategories(detected);
    const skin = categories.find((c) => c.key === "skinHealth");
    expect(skin).toBeDefined();

    const rows = buildSkinLensRadarData(skin!, {
      detected,
      severityIssues: getEffectiveSeverityIssues(client),
    });
    expect(rows).toHaveLength(4);

    const axes = rows.map((r) => r.severityAxis);
    expect(minPairwiseGap(axes)).toBeGreaterThanOrEqual(MIN_LENS_AXIS_GAP - 0.05);

    const unique = new Set(axes.map((a) => a.toFixed(1)));
    expect(unique.size).toBe(4);
  });

  it("orders Courtney demo with redness as the most severe lens", () => {
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

    expect(byLens.redness).toBeGreaterThan(byLens.texture);
    expect(byLens.redness).toBeGreaterThan(byLens.wrinkles);
    expect(byLens.pores).toBeGreaterThan(byLens.wrinkles);
  });
});
