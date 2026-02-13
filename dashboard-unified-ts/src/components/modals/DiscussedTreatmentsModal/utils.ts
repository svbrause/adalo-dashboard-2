// Discussed Treatments Modal – pure helpers

import type { Client, DiscussedItem } from "../../../types";
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
  TREATMENT_GOAL_ONLY,
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

/**
 * Suggested treatments for a list of findings/issues (e.g. from analysis).
 * Returns deduplicated entries with goal, region, and an example finding for prefill.
 * Used by Analysis Overview category/area detail views.
 */
export function getSuggestedTreatmentsForFindings(findings: string[]): {
  treatment: string;
  goal: string;
  region: string;
  exampleFinding: string;
}[] {
  const seen = new Set<string>();
  const result: { treatment: string; goal: string; region: string; exampleFinding: string }[] = [];
  for (const finding of findings) {
    const mapped = getGoalRegionTreatmentsForFinding(finding);
    if (!mapped) continue;
    for (const treatment of mapped.treatments) {
      const key = `${treatment}|${mapped.goal}|${mapped.region}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({
        treatment,
        goal: mapped.goal,
        region: mapped.region,
        exampleFinding: finding,
      });
    }
  }
  return result;
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

/** Maps region/interest/finding text to a single display area (Forehead, Eyes, Nose, Cheeks, Lips, Chin, Jawline, Neck, Skin, Full face), or null if no match. */
function normalizeToDisplayArea(text: string | null | undefined): string | null {
  if (!text || !String(text).trim()) return null;
  const lower = String(text).toLowerCase().trim();
  if (lower.includes("forehead")) return "Forehead";
  if (lower.includes("under eye") || lower.includes("tear trough") || (lower.includes("eye") && !lower.includes("eyebrow"))) return "Eyes";
  if (lower.includes("eyelid") || lower.includes("crow") || lower.includes("bunny")) return "Eyes";
  if (lower.includes("nose") || lower.includes("nasal")) return "Nose";
  if (lower.includes("cheek") || lower.includes("mid cheek")) return "Cheeks";
  if (lower.includes("lip")) return "Lips";
  if (lower.includes("chin")) return "Chin";
  if (lower.includes("jaw") || lower.includes("jowl") || lower.includes("prejowl")) return "Jawline";
  if (lower.includes("neck") || lower.includes("platysma")) return "Neck";
  if (lower.includes("full face")) return "Full face";
  if (lower === "skin" || lower.includes("skin")) return "Skin";
  return null;
}

/** Get a single display area for an item: region (normalized), else derived from interest, else from first finding. No "—". */
export function getDisplayAreaForItem(item: DiscussedItem): string | null {
  const fromRegion = normalizeToDisplayArea(item.region);
  if (fromRegion) return fromRegion;
  const fromInterest = normalizeToDisplayArea(item.interest);
  if (fromInterest) return fromInterest;
  if (item.findings?.length) {
    for (const f of item.findings) {
      const a = normalizeToDisplayArea(f);
      if (a) return a;
    }
  }
  return null;
}

/** Bullet character used to separate attributes in one line. */
export const TREATMENT_PLAN_BULLET = " • ";

/** Display name for the treatment heading: when treatment is "Goal only", show the goal/interest (e.g. "Fade Scars") instead. */
export function getTreatmentDisplayName(item: DiscussedItem): string {
  if (item.treatment === TREATMENT_GOAL_ONLY && item.interest?.trim()) {
    return item.interest.trim();
  }
  return (item.treatment || "").trim() || "—";
}

/** Build metadata line only: area, product, quantity (no treatment name, no timeline — sections already group by timeline). */
export function formatTreatmentPlanRecordMetaLine(item: DiscussedItem): string {
  const parts: string[] = [];
  const area = getDisplayAreaForItem(item);
  if (area) parts.push(area);
  const product = (item.product || "").trim();
  if (product) parts.push(product);
  if (item.quantity && String(item.quantity).trim()) parts.push(`Qty: ${item.quantity}`);
  return parts.join(TREATMENT_PLAN_BULLET);
}

/** Build a single line of non-empty parts: treatment, area, product, quantity (timeline omitted; sections group by timeline). */
export function formatTreatmentPlanRecordLine(item: DiscussedItem): string {
  const treatment = (item.treatment || "").trim();
  const meta = formatTreatmentPlanRecordMetaLine(item);
  return treatment && meta ? `${treatment}${TREATMENT_PLAN_BULLET}${meta}` : treatment || meta;
}
