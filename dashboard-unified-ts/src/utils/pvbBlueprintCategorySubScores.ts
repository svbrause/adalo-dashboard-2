import { CATEGORIES } from "../config/analysisOverviewConfig";
import type { BlueprintAnalysisOverviewSnapshot } from "./postVisitBlueprintAnalysis";

type CategorySnap = BlueprintAnalysisOverviewSnapshot["categories"][number];
export type ResolvedSubScore = NonNullable<CategorySnap["subScores"]>[number];

/**
 * When a stored blueprint omits `subScores` (older links) or sends an empty array,
 * derive sub-area rows from {@link CATEGORIES} so strengths / improvement pills and
 * radars always have data to split.
 */
export function buildFallbackSubScoresForCategory(cat: CategorySnap): ResolvedSubScore[] {
  const def = CATEGORIES.find((c) => c.key === cat.key);
  if (!def) return [];
  const n = def.subScores.length;
  return def.subScores.map((sub, i) => {
    const issueCount = Math.max(1, sub.issues.length);
    const spread =
      n <= 1 ? 0 : (i / Math.max(1, n - 1) - 0.5) * 14;
    const score = Math.round(Math.min(100, Math.max(0, cat.score + spread)));
    const detected = Math.min(
      issueCount,
      Math.max(0, Math.round(((100 - score) / 100) * issueCount)),
    );
    return {
      name: sub.name,
      score,
      total: issueCount,
      detected,
    };
  });
}

/** Prefer snapshot sub-scores; otherwise synthesize from framework definitions. */
export function resolveBlueprintCategorySubScores(cat: CategorySnap): ResolvedSubScore[] {
  const raw = cat.subScores;
  if (raw && raw.length > 0) return raw;
  return buildFallbackSubScoresForCategory(cat);
}
