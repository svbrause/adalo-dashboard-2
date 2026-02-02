// Discussed Treatments Modal – pure helpers

import type { Client } from "../../../types";
import {
  ASSESSMENT_FINDINGS_BY_AREA,
  FINDING_TO_GOAL_REGION_TREATMENTS,
  GOAL_TO_REGIONS,
  ALL_INTEREST_OPTIONS,
  INTEREST_TO_TREATMENTS,
  OTHER_LABEL,
  OTHER_FINDING_LABEL,
  REGION_OPTIONS,
  RECOMMENDED_PRODUCTS_BY_CONTEXT,
  TREATMENT_PRODUCT_OPTIONS,
  OTHER_PRODUCT_LABEL,
  ALL_TREATMENTS,
  QUANTITY_QUICK_OPTIONS_DEFAULT,
  QUANTITY_OPTIONS_FILLER,
  QUANTITY_OPTIONS_TOX,
} from "./constants";

export function getRecommendedProducts(
  treatment: string,
  contextString: string
): string[] {
  if (!contextString.trim()) return [];
  const lower = contextString.toLowerCase();
  const allOptions = TREATMENT_PRODUCT_OPTIONS[treatment];
  if (!allOptions) return [];
  const baseList = allOptions.filter((p) => p !== OTHER_PRODUCT_LABEL);
  const recommended = new Set<string>();
  for (const row of RECOMMENDED_PRODUCTS_BY_CONTEXT) {
    if (row.treatment !== treatment) continue;
    if (row.keywords.some((k) => lower.includes(k))) {
      row.products
        .filter((p) => baseList.includes(p))
        .forEach((p) => recommended.add(p));
    }
  }
  return Array.from(recommended);
}

export function getGoalRegionTreatmentsForFinding(
  finding: string
): { goal: string; region: string; treatments: string[] } | null {
  if (!finding || finding === OTHER_FINDING_LABEL) return null;
  const lower = finding.toLowerCase();
  for (const row of FINDING_TO_GOAL_REGION_TREATMENTS) {
    if (row.keywords.some((k) => lower.includes(k)))
      return { goal: row.goal, region: row.region, treatments: row.treatments };
  }
  return null;
}

/** Findings that map to a given treatment (via getGoalRegionTreatmentsForFinding). */
export function getFindingsForTreatment(treatment: string): string[] {
  const lower = (treatment || "").toLowerCase();
  const found: string[] = [];
  for (const areaRow of ASSESSMENT_FINDINGS_BY_AREA) {
    for (const f of areaRow.findings) {
      const mapped = getGoalRegionTreatmentsForFinding(f);
      if (mapped?.treatments.some((t) => t.toLowerCase() === lower))
        found.push(f);
    }
  }
  return found;
}

/** Findings for treatment grouped by area. */
export function getFindingsByAreaForTreatment(
  treatment: string
): { area: string; findings: string[] }[] {
  const findingsForTx = new Set(getFindingsForTreatment(treatment));
  return ASSESSMENT_FINDINGS_BY_AREA.map(({ area, findings }) => ({
    area,
    findings: findings.filter((f) => findingsForTx.has(f)),
  })).filter((g) => g.findings.length > 0);
}

/** Map treatment → suggested goals and regions (for "add by treatment" flow). */
export function getGoalsAndRegionsForTreatment(treatment: string): {
  goals: string[];
  regions: string[];
} {
  const lower = (treatment || "").toLowerCase();
  const goals = new Set<string>();
  const regions = new Set<string>();
  for (const { keywords, treatments } of INTEREST_TO_TREATMENTS) {
    if (treatments.some((t) => t.toLowerCase() === lower)) {
      for (const g of ALL_INTEREST_OPTIONS) {
        if (keywords.some((k) => g.toLowerCase().includes(k))) goals.add(g);
      }
    }
  }
  for (const { keywords, regions: regs } of GOAL_TO_REGIONS) {
    for (const g of goals) {
      if (keywords.some((k) => g.toLowerCase().includes(k)))
        regs.forEach((r) => regions.add(r));
    }
  }
  if (goals.size === 0)
    return { goals: [...ALL_INTEREST_OPTIONS], regions: [...REGION_OPTIONS] };
  if (regions.size === 0)
    return { goals: Array.from(goals), regions: [...REGION_OPTIONS] };
  return { goals: Array.from(goals), regions: Array.from(regions) };
}

export function getTreatmentsForInterest(interest: string): string[] {
  if (!interest || interest === OTHER_LABEL) return [...ALL_TREATMENTS];
  const lower = interest.toLowerCase();
  const matched = new Set<string>();
  for (const { keywords, treatments } of INTEREST_TO_TREATMENTS) {
    if (keywords.some((k) => lower.includes(k))) {
      treatments.forEach((t) => matched.add(t));
    }
  }
  return matched.size > 0 ? Array.from(matched) : [...ALL_TREATMENTS];
}

export function getQuantityContext(treatment: string | undefined): {
  unitLabel: string;
  options: string[];
} {
  if (!treatment || !treatment.trim()) {
    return { unitLabel: "Quantity", options: QUANTITY_QUICK_OPTIONS_DEFAULT };
  }
  const t = treatment.trim().toLowerCase();
  if (
    t === "filler" ||
    t.includes("filler") ||
    t === "hyaluronic acid" ||
    t === "ha"
  ) {
    return { unitLabel: "Syringes", options: QUANTITY_OPTIONS_FILLER };
  }
  if (
    t === "neurotoxin" ||
    t === "tox" ||
    t === "botox" ||
    t.includes("neurotoxin") ||
    t.includes("tox") ||
    t === "dysport" ||
    t === "xeomin"
  ) {
    return { unitLabel: "Units", options: QUANTITY_OPTIONS_TOX };
  }
  if (
    t === "laser" ||
    t.includes("laser") ||
    t === "rf" ||
    t === "radiofrequency" ||
    t.includes("radiofrequency") ||
    t === "microneedling" ||
    t.includes("microneedling")
  ) {
    return { unitLabel: "Sessions", options: QUANTITY_QUICK_OPTIONS_DEFAULT };
  }
  return { unitLabel: "Quantity", options: QUANTITY_QUICK_OPTIONS_DEFAULT };
}

export function parseInterestedIssues(client: Client): string[] {
  const raw = client.interestedIssues;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((i) => i && String(i).trim());
  return String(raw)
    .split(",")
    .map((i) => i.trim())
    .filter(Boolean);
}

export function generateId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `disc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
