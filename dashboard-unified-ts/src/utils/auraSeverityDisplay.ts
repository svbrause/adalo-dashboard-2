import {
  CATEGORIES,
  scoreTier,
  tierColor,
  normalizeIssue,
  type CategoryResult,
} from "../config/analysisOverviewConfig";
import type { AnalysisSeverityIssue, Client } from "../types";
import {
  getSeverityPayloadForIssueLabel,
  inferSeverityBadness01,
} from "./analysisOverviewClient";

/** Face minimap ellipses (viewBox 0 0 60 72), aligned with AuraFaceView. */
export const FACE_MINIMAP_ZONES: Record<
  string,
  { cx: number; cy: number; rx: number; ry: number }
> = {
  rForehead: { cx: 30, cy: 18, rx: 12, ry: 4 },
  rLeftEye: { cx: 22, cy: 29, rx: 5, ry: 3 },
  rRightEye: { cx: 38, cy: 29, rx: 5, ry: 3 },
  rLeftUnderEye: { cx: 22, cy: 33, rx: 5, ry: 2.5 },
  rRightUnderEye: { cx: 38, cy: 33, rx: 5, ry: 2.5 },
  rNose: { cx: 30, cy: 39, rx: 5, ry: 8 },
  rLeftCheek: { cx: 22, cy: 42, rx: 5, ry: 7 },
  rRightCheek: { cx: 38, cy: 42, rx: 5, ry: 7 },
  rLowerFace: { cx: 30, cy: 53, rx: 11, ry: 7 },
  rChin: { cx: 30, cy: 57, rx: 7, ry: 4 },
  rLips: { cx: 30, cy: 50, rx: 6, ry: 3 },
  rTemporal: { cx: 14, cy: 28, rx: 4, ry: 6 },
  rTemporalR: { cx: 46, cy: 28, rx: 4, ry: 6 },
};

/** Sub-score labels from analysis overview → minimap region ids. */
export const SUB_SCORE_MINIMAP_REGIONS: Record<string, string[]> = {
  Wrinkles: ["rForehead", "rLeftEye", "rRightEye", "rLowerFace"],
  Texture: ["rLeftCheek", "rRightCheek", "rNose"],
  Pigmentation: ["rForehead", "rLeftCheek", "rRightCheek"],
  Hydration: ["rLeftCheek", "rRightCheek"],
  "Eye Area": ["rLeftUnderEye", "rRightUnderEye", "rLeftEye", "rRightEye"],
  "Cheek Area": ["rLeftCheek", "rRightCheek", "rTemporal", "rTemporalR"],
  "Neck Area": ["rLowerFace", "rChin"],
  "Lower Face": ["rLowerFace", "rLips", "rChin"],
  "Brow & Eyes": ["rForehead", "rLeftEye", "rRightEye"],
  Jaw: ["rLowerFace", "rChin"],
  Nose: ["rNose"],
  Lips: ["rLips"],
};

export function clientHasSeverityScores(client: Client): boolean {
  const issues = client.severityScoresFromAnalyses?.issues;
  return !!issues && Object.keys(issues).length > 0;
}

export function severityHealthScoreFromBadness(badness01: number): number {
  const b = Math.max(0, Math.min(1, badness01));
  return Math.round((1 - b) * 100);
}

/** Tier color from detector badness (higher badness = warmer / attention). */
export function severityColorFromBadness(badness01: number): string {
  return tierColor(scoreTier(severityHealthScoreFromBadness(badness01)));
}

export function severityFillOpacity(badness01: number): number {
  const b = Math.max(0, Math.min(1, badness01));
  return 0.22 + b * 0.58;
}

export interface IssueSeverityVisual {
  issue: string;
  badness01?: number;
  healthScore?: number;
  color: string;
  hasSeverityPayload: boolean;
  severityLevel?: string;
}

export function issueSeverityVisual(
  issueName: string,
  severityIssues: Record<string, AnalysisSeverityIssue> | undefined,
  fallbackAccent: string,
): IssueSeverityVisual {
  const payload = getSeverityPayloadForIssueLabel(issueName, severityIssues);
  const badness = payload ? inferSeverityBadness01(payload) : undefined;
  if (badness !== undefined && Number.isFinite(badness)) {
    return {
      issue: issueName,
      badness01: badness,
      healthScore: severityHealthScoreFromBadness(badness),
      color: severityColorFromBadness(badness),
      hasSeverityPayload: true,
      severityLevel: payload?.severity_level,
    };
  }
  return {
    issue: issueName,
    color: fallbackAccent,
    hasSeverityPayload: false,
  };
}

/** Average badness across detected issues in a sub-score (undefined if no severity JSON). */
export function subScoreSeverityBadness01(
  canonicalIssues: string[],
  detected: Set<string>,
  severityIssues: Record<string, AnalysisSeverityIssue> | undefined,
): number | undefined {
  if (!severityIssues || !Object.keys(severityIssues).length) return undefined;
  const hits = canonicalIssues.filter((i) => detected.has(normalizeIssue(i)));
  if (hits.length === 0) return undefined;

  let sum = 0;
  let count = 0;
  for (const issue of hits) {
    const payload = getSeverityPayloadForIssueLabel(issue, severityIssues);
    const b = payload ? inferSeverityBadness01(payload) : undefined;
    if (b !== undefined && Number.isFinite(b)) {
      sum += b;
      count += 1;
    }
  }
  if (count === 0) return undefined;
  return sum / count;
}

export interface RegionSeverityHighlight {
  regionId: string;
  badness01: number;
  color: string;
  fillOpacity: number;
  subScoreName: string;
}

/** Max badness per minimap region for the active category (severity-weighted). */
export function regionHighlightsForCategory(
  activeCat: CategoryResult | undefined,
  detected: Set<string>,
  severityIssues: Record<string, AnalysisSeverityIssue> | undefined,
): RegionSeverityHighlight[] {
  if (!activeCat) return [];
  const byRegion = new Map<string, RegionSeverityHighlight>();

  const hasSeverity =
    !!severityIssues && Object.keys(severityIssues).length > 0;

  for (const sub of activeCat.subScores) {
    const regionIds = SUB_SCORE_MINIMAP_REGIONS[sub.name] ?? [];
    const badness =
      subScoreSeverityBadness01(
        CATEGORIES_SUB_ISSUES[sub.name] ?? [],
        detected,
        severityIssues,
      ) ??
      (sub.detected > 0
        ? Math.min(1, (100 - sub.score) / 100)
        : undefined);

    if (badness === undefined) continue;
    const color = hasSeverity
      ? severityColorFromBadness(badness)
      : tierColor(sub.tier);
    const fillOpacity = severityFillOpacity(badness);

    for (const regionId of regionIds) {
      const prev = byRegion.get(regionId);
      if (!prev || badness > prev.badness01) {
        byRegion.set(regionId, {
          regionId,
          badness01: badness,
          color,
          fillOpacity,
          subScoreName: sub.name,
        });
      }
    }
  }

  return Array.from(byRegion.values()).sort((a, b) => b.badness01 - a.badness01);
}

/** Lookup canonical issue lists per sub-score name (built once). */
const CATEGORIES_SUB_ISSUES: Record<string, string[]> = (() => {
  const out: Record<string, string[]> = {};
  for (const cat of CATEGORIES) {
    for (const sub of cat.subScores) {
      out[sub.name] = sub.issues;
    }
  }
  return out;
})();

export function getSubScoreCanonicalIssues(subScoreName: string): string[] {
  return CATEGORIES_SUB_ISSUES[subScoreName] ?? [];
}
