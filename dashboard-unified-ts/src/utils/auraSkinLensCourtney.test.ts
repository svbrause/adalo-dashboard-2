import { describe, expect, it } from "vitest";
import { COURTNEY_BELLAMY_SEVERITY_ISSUES } from "../debug/adminDemoSeverityOverlay";
import {
  collectIssuesForSkinLens,
  detectedIssuesForCategory,
  type AuraSkinLens,
} from "./auraAnalysisBridge";
import {
  getDetectedIssuesFromClient,
  getEffectiveSeverityIssues,
} from "./analysisOverviewClient";
import type { Client } from "../types";

function courtneyLikeClient(
  overrides: Partial<Client> & { id?: string; name?: string } = {},
): Client {
  return {
    id: "rec-live-courtney",
    name: "Courtney Bellamy",
    email: "courtney@example.com",
    phone: "",
    tableSource: "Patients",
    archived: false,
    discussedItems: [],
    auraManifestUrl:
      "/demo-3d/courtney-bellamy-side-photo/courtney-bellamy-side-photo-aura-manifest.json",
    frontPhoto:
      "/demo-3d/courtney-bellamy-side-photo/courtney-bellamy-side-photo-front-color.png",
    severityScoresFromAnalyses: null,
    allIssues: "",
    ...overrides,
  } as Client;
}

describe("Courtney Bellamy skin lens findings", () => {
  it("falls back to demo severity when Airtable client has no severity JSON", () => {
    const client = courtneyLikeClient();
    const severity = getEffectiveSeverityIssues(client);
    expect(severity).toBe(COURTNEY_BELLAMY_SEVERITY_ISSUES);
    expect(severity?.["Red Spots"]?.predicted).toBe(true);
    expect(severity?.["Whiteheads"]?.predicted).toBe(true);
  });

  it("surfaces redness and pores issues for the focused lens tabs", () => {
    const client = courtneyLikeClient();
    const detected = getDetectedIssuesFromClient(client);
    const skinIssues = detectedIssuesForCategory("skinHealth", detected);

    const redness = collectIssuesForSkinLens("redness", skinIssues, getEffectiveSeverityIssues(client));
    const pores = collectIssuesForSkinLens("pores", skinIssues, getEffectiveSeverityIssues(client));

    expect(redness).toEqual(expect.arrayContaining(["Red Spots", "Rosacea"]));
    expect(pores).toEqual(expect.arrayContaining(["Whiteheads", "Blackheads"]));
    expect(redness.length).toBeGreaterThanOrEqual(2);
    expect(pores.length).toBeGreaterThanOrEqual(2);
  });

  it("works for injected admin demo client id", () => {
    const client = courtneyLikeClient({ id: "admin-demo-courtney" });
    const lenses: AuraSkinLens[] = ["redness", "pores"];
    const detected = getDetectedIssuesFromClient(client);
    const skinIssues = detectedIssuesForCategory("skinHealth", detected);
    for (const lens of lenses) {
      const issues = collectIssuesForSkinLens(
        lens,
        skinIssues,
        getEffectiveSeverityIssues(client),
      );
      expect(issues.length).toBeGreaterThanOrEqual(2);
    }
  });
});
