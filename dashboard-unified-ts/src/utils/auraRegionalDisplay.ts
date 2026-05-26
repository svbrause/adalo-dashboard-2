import {
  normalizeIssue,
  scoreTier,
  tierColor,
  type CategoryResult,
} from "../config/analysisOverviewConfig";
import type { AnalysisSeverityIssue } from "../types";
import {
  getSubScoreCanonicalIssues,
  regionHighlightsForCategory,
  subScoreSeverityBadness01,
} from "./auraSeverityDisplay";

/** Five broad regions shown on the Aura-style regional card. */
export const AURA_FIVE_REGION_IDS = [
  "forehead",
  "leftCheek",
  "rightCheek",
  "nose",
  "chin",
] as const;

export type AuraFiveRegionId = (typeof AURA_FIVE_REGION_IDS)[number];

export const AURA_FIVE_REGION_LABELS: Record<AuraFiveRegionId, string> = {
  forehead: "Forehead",
  leftCheek: "Left cheek",
  rightCheek: "Right cheek",
  nose: "Nose",
  chin: "Chin",
};

/** Minimap region ids rolled up into each Aura regional zone. */
export const REGION_TO_MINIMAP_IDS: Record<AuraFiveRegionId, string[]> = {
  forehead: ["rForehead", "rLeftEye", "rRightEye"],
  leftCheek: ["rLeftCheek", "rTemporal"],
  rightCheek: ["rRightCheek", "rTemporalR"],
  nose: ["rNose"],
  chin: ["rLowerFace", "rChin", "rLips"],
};

export interface AuraRegionalZoneScore {
  id: AuraFiveRegionId;
  label: string;
  /** Aura-style 1.0 (mild) – 5.0 (severe). */
  score15: number;
  badness01: number;
  color: string;
}

/** Map detector badness 0–1 → Aura 1–5 scale. */
export function badnessToAuraScale15(badness01: number): number {
  const b = Math.max(0, Math.min(1, badness01));
  return Math.round((1 + b * 4) * 10) / 10;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(c1: string, c2: string, t: number): string {
  const parse = (hex: string) => {
    const h = hex.replace("#", "");
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  };
  const [r1, g1, b1] = parse(c1);
  const [r2, g2, b2] = parse(c2);
  const r = Math.round(lerp(r1, r2, t));
  const g = Math.round(lerp(g1, g2, t));
  const b = Math.round(lerp(b1, b2, t));
  return `rgb(${r}, ${g}, ${b})`;
}

/** Green (mild) → amber → red (severe), matching Aura regional legend. */
export function auraScale15Color(score15: number): string {
  const t = Math.max(0, Math.min(1, (score15 - 1) / 4));
  if (t <= 0.5) return lerpColor("#7ad67a", "#e6c84e", t * 2);
  return lerpColor("#e6c84e", "#e06655", (t - 0.5) * 2);
}

export function fiveRegionalScoresForCategory(
  activeCat: CategoryResult | undefined,
  detected: Set<string>,
  severityIssues: Record<string, AnalysisSeverityIssue> | undefined,
): AuraRegionalZoneScore[] {
  if (!activeCat) return [];

  const hasSeverity =
    !!severityIssues && Object.keys(severityIssues).length > 0;
  const highlights = regionHighlightsForCategory(
    activeCat,
    detected,
    severityIssues,
  );

  const zoneBadness = new Map<AuraFiveRegionId, number>();

  for (const h of highlights) {
    for (const zoneId of AURA_FIVE_REGION_IDS) {
      if (REGION_TO_MINIMAP_IDS[zoneId].includes(h.regionId)) {
        const prev = zoneBadness.get(zoneId);
        if (prev === undefined || h.badness01 > prev) {
          zoneBadness.set(zoneId, h.badness01);
        }
      }
    }
  }

  // Fill zones still empty using sub-score health (no severity JSON or unmapped highlights).
  for (const sub of activeCat.subScores) {
    if (sub.detected <= 0) continue;
    const badness = Math.min(1, (100 - sub.score) / 100);
    const mappedZones = SUB_SCORE_TO_AURA_ZONES[sub.name];
    if (!mappedZones?.length) continue;
    for (const zoneId of mappedZones) {
      if (zoneBadness.has(zoneId)) continue;
      zoneBadness.set(zoneId, badness);
    }
  }

  const out: AuraRegionalZoneScore[] = [];
  for (const id of AURA_FIVE_REGION_IDS) {
    let badness = zoneBadness.get(id);
    if (badness === undefined) continue;

    if (!hasSeverity) {
      const tier = scoreTier(Math.round((1 - badness) * 100));
      const color = tierColor(tier);
      const score15 = badnessToAuraScale15(badness);
      out.push({
        id,
        label: AURA_FIVE_REGION_LABELS[id],
        score15,
        badness01: badness,
        color,
      });
      continue;
    }

    const score15 = badnessToAuraScale15(badness);
    out.push({
      id,
      label: AURA_FIVE_REGION_LABELS[id],
      score15,
      badness01: badness,
      color: auraScale15Color(score15),
    });
  }

  return out;
}

/** Sub-score name → Aura five-region zone(s) for fallback scoring. */
const SUB_SCORE_TO_AURA_ZONES: Record<string, AuraFiveRegionId[]> = {
  Wrinkles: ["forehead"],
  Texture: ["leftCheek", "rightCheek"],
  Pigmentation: ["forehead", "leftCheek", "rightCheek"],
  Hydration: ["leftCheek", "rightCheek"],
  "Eye Area": ["leftCheek", "rightCheek"],
  "Cheek Area": ["leftCheek", "rightCheek"],
  "Neck Area": ["chin"],
  "Lower Face": ["chin"],
  "Brow & Eyes": ["forehead"],
  Jaw: ["chin"],
  Nose: ["nose"],
  Lips: ["chin"],
};

/** Health-style +/- display from badness (higher = more positive change needed). */
export function badnessToPlusMinus(badness01: number): string {
  const delta = (badness01 - 0.35) * 2;
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}`;
}

/** Direct regional scores from severity issues mapped by area (all categories). */
export function fiveRegionalScoresFromSeverity(
  detected: Set<string>,
  severityIssues: Record<string, AnalysisSeverityIssue> | undefined,
  canonicalIssuesByZone: Record<AuraFiveRegionId, string[]>,
): AuraRegionalZoneScore[] {
  if (!severityIssues) return [];
  const out: AuraRegionalZoneScore[] = [];
  for (const id of AURA_FIVE_REGION_IDS) {
    const issues = canonicalIssuesByZone[id] ?? [];
    const hits = issues.filter((i) => detected.has(normalizeIssue(i)));
    if (hits.length === 0) continue;
    const badness = subScoreSeverityBadness01(hits, detected, severityIssues);
    if (badness === undefined) continue;
    const score15 = badnessToAuraScale15(badness);
    out.push({
      id,
      label: AURA_FIVE_REGION_LABELS[id],
      score15,
      badness01: badness,
      color: auraScale15Color(score15),
    });
  }
  return out;
}

export function getRegionalIssuesByZone(): Record<AuraFiveRegionId, string[]> {
  const zones: Record<AuraFiveRegionId, Set<string>> = {
    forehead: new Set(),
    leftCheek: new Set(),
    rightCheek: new Set(),
    nose: new Set(),
    chin: new Set(),
  };
  for (const [subName, zoneList] of Object.entries(SUB_SCORE_TO_AURA_ZONES)) {
    for (const issue of getSubScoreCanonicalIssues(subName)) {
      for (const zone of zoneList) {
        zones[zone].add(issue);
      }
    }
  }
  return {
    forehead: [...zones.forehead],
    leftCheek: [...zones.leftCheek],
    rightCheek: [...zones.rightCheek],
    nose: [...zones.nose],
    chin: [...zones.chin],
  };
}
