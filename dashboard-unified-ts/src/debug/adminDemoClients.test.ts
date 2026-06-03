import { describe, expect, it } from "vitest";
import { computeCategories, normalizeIssue } from "../config/analysisOverviewConfig";
import {
  buildSkinLensRadarData,
  healthScoreToSeverityAxis,
} from "../utils/auraAnalysisBridge";
import { getDetectedIssuesFromClient } from "../utils/analysisOverviewClient";
import {
  ADMIN_DEMO_NAME_COLLISION_SUFFIX,
  getAdminDemoClientsIfEnabled,
} from "./adminDemoClients";
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

  it("Courtney Bellamy and Tanya Tan include demo redness and pore findings with severity", () => {
    const demos = getAdminDemoClientsIfEnabled(adminProvider, []);
    const courtney = demos.find((c) => c.id === "admin-demo-courtney");
    const tanya = demos.find((c) => c.id === "admin-demo-tanya");
    expect(demoHasRednessAndPores(courtney)).toBe(true);
    expect(demoHasRednessAndPores(tanya)).toBe(true);
    for (const client of [courtney, tanya]) {
      const red = client?.severityScoresFromAnalyses?.issues?.["Red Spots"];
      const pores = client?.severityScoresFromAnalyses?.issues?.["Whiteheads"];
      expect(red?.predicted).toBe(true);
      expect(red?.severity_normalized_0_1).toBeGreaterThan(0.4);
      expect(pores?.predicted).toBe(true);
      expect(pores?.severity_normalized_0_1).toBeGreaterThan(0.35);
    }
    expect(
      getDetectedIssuesFromClient(tanya!).has(normalizeIssue("Rosacea")),
    ).toBe(true);

    for (const client of [courtney, tanya]) {
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
        expect(String(axis)).toMatch(/^\d+\.\d$/);
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
    expect(tanya?.name).toBe(`Tanya Tan${ADMIN_DEMO_NAME_COLLISION_SUFFIX}`);
  });

  it("skips non-admin providers", () => {
    expect(
      getAdminDemoClientsIfEnabled({ code: "TheTreatment250", name: "The Treatment" }, []),
    ).toEqual([]);
  });
});
