import { getHighlightedRegionIds } from "../components/postVisitBlueprint/AiMirrorCanvas";
import { issueToMirrorHighlightTerm } from "./auraAnalysisBridge";

/** Fallback badge text when no analysis issue maps to a mirror region. */
export const MIRROR_REGION_FALLBACK_LABELS: Record<string, string> = {
  rForehead: "Forehead",
  rLeftEye: "Eyes",
  rRightEye: "Eyes",
  rNose: "Nose",
  rLeftCheek: "Cheeks",
  rRightCheek: "Cheeks",
  rLips: "Lips",
  rChin: "Lower face",
  rLeftUnderEye: "Under eyes",
  rRightUnderEye: "Under eyes",
  rLeftNasolabialFold: "Nasolabial folds",
  rRightNasolabialFold: "Nasolabial folds",
  rLeftMarionetteLine: "Marionette lines",
  rRightMarionetteLine: "Marionette lines",
  rLowerFace: "Lower face",
};

function titleCaseWords(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Map analysis issue names → mirror region badge labels (highest issue wins per region). */
export function buildCalloutLabelsForIssues(
  issues: readonly string[],
): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const issue of issues) {
    const display = issue.trim();
    if (!display) continue;
    const term = issueToMirrorHighlightTerm(issue);
    for (const regionId of getHighlightedRegionIds([term])) {
      if (!labels[regionId]) labels[regionId] = display;
    }
  }
  return labels;
}

/** Map mirror highlight terms → badge labels (title-cased term text). */
export function buildCalloutLabelsFromHighlightTerms(
  terms: readonly string[],
): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const term of terms) {
    const display = titleCaseWords(term);
    if (!display) continue;
    for (const regionId of getHighlightedRegionIds([term])) {
      if (!labels[regionId]) labels[regionId] = display;
    }
  }
  return labels;
}

export function mergeCalloutLabelsByRegion(
  ...maps: Array<Record<string, string> | undefined>
): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const map of maps) {
    if (!map) continue;
    for (const [regionId, label] of Object.entries(map)) {
      if (label.trim()) merged[regionId] = label.trim();
    }
  }
  return merged;
}

export function resolveMirrorCalloutLabel(
  regionId: string,
  labelsByRegionId?: Record<string, string>,
): string {
  return (
    labelsByRegionId?.[regionId]?.trim()
    || MIRROR_REGION_FALLBACK_LABELS[regionId]
    || "Focus area"
  );
}
