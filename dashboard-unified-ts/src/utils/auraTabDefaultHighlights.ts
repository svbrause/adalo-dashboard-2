import {
  computeCategories,
  normalizeIssue,
  type CategoryResult,
} from "../config/analysisOverviewConfig";
import type { Client } from "../types";
import {
  getDetectedIssuesFromClient,
  getEffectiveSeverityIssues,
} from "./analysisOverviewClient";
import { getHighlightedRegionIds } from "../components/postVisitBlueprint/AiMirrorCanvas";
import {
  auraFaceTabToOverviewCategory,
  categoryByKey,
  collectIssuesForSkinLens,
  detectedIssuesForCategory,
  detectedIssuesForSubScore,
  issueToMirrorHighlightTerm,
  isAuraAnalysisAreaFiltered,
  SKIN_LENS_ORDER,
  type AuraFaceAnalysisTab,
  type AuraOverviewCategoryKey,
  type AuraSkinLens,
} from "./auraAnalysisBridge";
import { SUB_SCORE_MINIMAP_REGIONS, issueSeverityVisual } from "./auraSeverityDisplay";
import { buildCalloutLabelsForIssues } from "./mirrorCalloutLabels";

export type AuraTabDefaultHighlights = {
  terms: string[];
  regionIds: string[];
  /** Issue names keyed by mirror region id for on-face callout badges. */
  labelsByRegionId: Record<string, string>;
};

const VOLUME_STRUCTURE_TABS = ["volume", "structure"] as const satisfies readonly AuraFaceAnalysisTab[];
type VolumeStructureTab = (typeof VOLUME_STRUCTURE_TABS)[number];

const SKIN_LENS_TABS = SKIN_LENS_ORDER;
type SkinLensTab = AuraSkinLens;

const DEFAULT_TOP_ISSUE_COUNT = 3;

function categoryAccent(categoryKey: string): string {
  if (categoryKey === "volumeLoss") return "#60a5fa";
  if (categoryKey === "proportions") return "#c4b5fd";
  return "#94a3b8";
}

function topIssuesForCategory(
  categoryKey: string,
  activeCat: CategoryResult | undefined,
  detected: Set<string>,
  severityIssues: ReturnType<typeof getEffectiveSeverityIssues>,
  maxIssues: number,
): string[] {
  if (!activeCat) return [];

  const issues = detectedIssuesForCategory(categoryKey, detected);
  const accent = categoryAccent(categoryKey);

  const scored = issues
    .map((issue) => ({
      issue,
      badness:
        issueSeverityVisual(issue, severityIssues, accent).badness01 ??
        (detected.has(normalizeIssue(issue)) ? 0.35 : 0),
    }))
    .sort((a, b) => {
      if (b.badness !== a.badness) return b.badness - a.badness;
      return a.issue.localeCompare(b.issue);
    });

  const withSignal = scored.filter((row) => row.badness > 0);
  const picked = (withSignal.length > 0 ? withSignal : scored).slice(0, maxIssues);
  return picked.map((row) => row.issue);
}

function uniqueMirrorTerms(issues: string[]): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const issue of issues) {
    const term = issueToMirrorHighlightTerm(issue);
    const key = term.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    terms.push(term);
  }
  return terms;
}

function regionIdsForTopIssues(issues: string[], maxRegions = 8): string[] {
  const seen = new Set<string>();
  const regionIds: string[] = [];
  for (const issue of issues) {
    for (const regionId of getHighlightedRegionIds([
      issueToMirrorHighlightTerm(issue),
    ])) {
      if (seen.has(regionId)) continue;
      seen.add(regionId);
      regionIds.push(regionId);
    }
  }
  return regionIds.slice(0, maxRegions);
}

/**
 * Default face highlights for Volume / Structure tabs: top severity issues in each category.
 */
export function buildDefaultTabSeverityHighlights(
  client: Client,
  maxIssues = DEFAULT_TOP_ISSUE_COUNT,
): Partial<Record<VolumeStructureTab, AuraTabDefaultHighlights>> {
  const detected = getDetectedIssuesFromClient(client);
  const severityIssues = getEffectiveSeverityIssues(client);
  const categories = computeCategories(detected);
  const out: Partial<Record<VolumeStructureTab, AuraTabDefaultHighlights>> = {};

  for (const tab of VOLUME_STRUCTURE_TABS) {
    const categoryKey = auraFaceTabToOverviewCategory(tab);
    const activeCat = categoryByKey(categories, categoryKey);
    const topIssues = topIssuesForCategory(
      categoryKey,
      activeCat,
      detected,
      severityIssues,
      maxIssues,
    );
    if (topIssues.length === 0) continue;

    const terms = uniqueMirrorTerms(topIssues);
    const regionIds = regionIdsForTopIssues(topIssues);
    const labelsByRegionId = buildCalloutLabelsForIssues(topIssues);

    if (terms.length === 0 && regionIds.length === 0) continue;

    out[tab] = { terms, regionIds, labelsByRegionId };
  }

  return out;
}

/**
 * Default face highlights for Skin sub-lenses (Pigmentation, Redness, Pores, Wrinkles).
 */
export function buildSkinLensDefaultHighlights(
  client: Client,
  maxIssues = DEFAULT_TOP_ISSUE_COUNT,
): Partial<Record<SkinLensTab, AuraTabDefaultHighlights>> {
  const detected = getDetectedIssuesFromClient(client);
  const severityIssues = getEffectiveSeverityIssues(client);
  const categoryIssues = detectedIssuesForCategory("skinHealth", detected);
  const accent = categoryAccent("skinHealth");
  const out: Partial<Record<SkinLensTab, AuraTabDefaultHighlights>> = {};

  for (const lens of SKIN_LENS_TABS) {
    const issues = collectIssuesForSkinLens(
      lens,
      categoryIssues,
      severityIssues,
    )
      .map((issue) => ({
        issue,
        badness:
          issueSeverityVisual(issue, severityIssues, accent).badness01 ??
          (detected.has(normalizeIssue(issue)) ? 0.35 : 0),
      }))
      .sort((a, b) => {
        if (b.badness !== a.badness) return b.badness - a.badness;
        return a.issue.localeCompare(b.issue);
      })
      .slice(0, maxIssues)
      .map((row) => row.issue);

    if (issues.length === 0) continue;

    const terms = uniqueMirrorTerms(issues);
    const regionIds = [
      ...new Set(
        issues.flatMap((issue) => [
          ...getHighlightedRegionIds([issueToMirrorHighlightTerm(issue)]),
        ]),
      ),
    ].slice(0, maxIssues);
    const labelsByRegionId = buildCalloutLabelsForIssues(issues);

    if (terms.length === 0 && regionIds.length === 0) continue;
    out[lens] = { terms, regionIds, labelsByRegionId };
  }

  return out;
}

/**
 * Face + callout highlights for a single Volume / Structure area tab
 * (Eye Area, Cheek Area, Lower Face, Neck Area, etc.).
 */
export function buildAnalysisAreaFaceHighlights(
  client: Client,
  categoryKey: AuraOverviewCategoryKey,
  areaName: string,
): AuraTabDefaultHighlights | null {
  if (categoryKey !== "volumeLoss" && categoryKey !== "proportions") {
    return null;
  }
  if (!isAuraAnalysisAreaFiltered(areaName)) {
    return null;
  }
  const areaRegions = SUB_SCORE_MINIMAP_REGIONS[areaName];
  if (!areaRegions?.length) return null;

  const detected = getDetectedIssuesFromClient(client);
  const issues = detectedIssuesForSubScore(categoryKey, areaName, detected);
  const areaRegionSet = new Set(areaRegions);

  const issueRegionIds = new Set<string>();
  for (const issue of issues) {
    for (const regionId of getHighlightedRegionIds([
      issueToMirrorHighlightTerm(issue),
    ])) {
      if (areaRegionSet.has(regionId)) {
        issueRegionIds.add(regionId);
      }
    }
  }

  const regionIds =
    issueRegionIds.size > 0 ? [...issueRegionIds] : [...areaRegions];
  const terms = uniqueMirrorTerms(issues);
  const labelsByRegionId = buildCalloutLabelsForIssues(issues);

  return { terms, regionIds, labelsByRegionId };
}
