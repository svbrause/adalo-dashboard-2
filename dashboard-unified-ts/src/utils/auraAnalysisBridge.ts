import {
  CATEGORIES,
  normalizeIssue,
} from "../config/analysisOverviewConfig";
import type { CategoryResult } from "../config/analysisOverviewConfig";

/** Overview category keys aligned with Aura-style tabs in expanded client detail. */
export type AuraOverviewCategoryKey = "skinHealth" | "volumeLoss" | "proportions";

export const AURA_OVERVIEW_TABS: {
  key: AuraOverviewCategoryKey;
  label: string;
  accent: string;
}[] = [
  { key: "skinHealth", label: "Skin", accent: "#d4a06a" },
  { key: "volumeLoss", label: "Volume", accent: "#60a5fa" },
  { key: "proportions", label: "Structure", accent: "#c4b5fd" },
];

/** Aura face viewport tabs (left column pills). */
export type AuraFaceAnalysisTab = "texture" | "pigmentation" | "volume" | "structure";

export function auraFaceTabToOverviewCategory(
  tab: AuraFaceAnalysisTab,
): AuraOverviewCategoryKey {
  switch (tab) {
    case "texture":
    case "pigmentation":
      return "skinHealth";
    case "volume":
      return "volumeLoss";
    case "structure":
      return "proportions";
  }
}

export function overviewCategoryToAuraFaceTab(
  key: AuraOverviewCategoryKey,
): AuraFaceAnalysisTab {
  switch (key) {
    case "skinHealth":
      return "texture";
    case "volumeLoss":
      return "volume";
    case "proportions":
      return "structure";
  }
}

export function auraTabLabelForCategoryKey(key: string): string {
  return AURA_OVERVIEW_TABS.find((t) => t.key === key)?.label ?? key;
}

/** Issues in this sub-score that were detected for the client. */
export function detectedIssuesForSubScore(
  categoryKey: string,
  subScoreName: string,
  detected: Set<string>,
): string[] {
  const cat = CATEGORIES.find((c) => c.key === categoryKey);
  const sub = cat?.subScores.find((s) => s.name === subScoreName);
  if (!sub) return [];
  return sub.issues.filter((issue) => detected.has(normalizeIssue(issue)));
}

export function categoryByKey(
  categories: CategoryResult[],
  key: AuraOverviewCategoryKey,
): CategoryResult | undefined {
  return categories.find((c) => c.key === key);
}

/** Display string passed to mirror highlight term matcher (see AiMirrorCanvas REGION_KEYWORDS). */
export function issueToMirrorHighlightTerm(issueName: string): string {
  const n = normalizeIssue(issueName);
  if (n === "under eye hollow" || n === "upper eye hollow") return "under eye";
  if (n === "under eye dark circles") return "under eye";
  if (n === "under eye wrinkles") return "under eye";
  return issueName.trim();
}
