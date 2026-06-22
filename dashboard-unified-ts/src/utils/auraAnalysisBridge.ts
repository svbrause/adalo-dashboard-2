import {
  CATEGORIES,
  canonicalIssueDisplayLabel,
  normalizeIssue,
  scoreTier,
  tierColor,
} from "../config/analysisOverviewConfig";
import type { CategoryResult } from "../config/analysisOverviewConfig";
import type { AnalysisSeverityIssue } from "../types";
import {
  getSeverityPayloadForIssueLabel,
  isSeverityRowNonPerfect,
} from "./analysisOverviewClient";
import { issueSeverityVisual } from "./auraSeverityDisplay";

/** Overview category keys aligned with Aura-style tabs in expanded client detail. */
export type AuraOverviewCategoryKey = "skinHealth" | "volumeLoss" | "proportions";

/** Left-rail Volume / Structure sub-tab: show all areas (no petal or findings filter). */
export const AURA_ANALYSIS_AREA_ALL = "All";

export function isAuraAnalysisAreaFiltered(
  area?: string | null,
): area is string {
  return Boolean(area && area !== AURA_ANALYSIS_AREA_ALL);
}

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

const categoryIssueKeysCache = new Map<string, Set<string>>();

function categoryIssueKeys(categoryKey: string): Set<string> {
  let keys = categoryIssueKeysCache.get(categoryKey);
  if (!keys) {
    const cat = CATEGORIES.find((c) => c.key === categoryKey);
    keys = new Set(
      (cat?.subScores ?? []).flatMap((s) =>
        s.issues.map((issue) => normalizeIssue(issue)),
      ),
    );
    categoryIssueKeysCache.set(categoryKey, keys);
  }
  return keys;
}

/** Detected issues that belong to a single overview category (Skin, Volume, Structure). */
export function detectedIssuesForCategory(
  categoryKey: string,
  detected: Set<string>,
): string[] {
  const allowed = categoryIssueKeys(categoryKey);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const issue of detected) {
    const key = normalizeIssue(issue);
    if (!allowed.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(canonicalIssueDisplayLabel(issue));
  }
  return out.sort((a, b) => a.localeCompare(b));
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
  if (n === "fine lines") return "fine lines";
  if (n === "mid cheek flattening") return "cheek";
  if (n === "nasolabial folds") return "nasolabial";
  if (n === "marionette lines") return "marionette";
  if (n === "temporal hollow") return "temple";
  if (n === "ill defined jawline" || n === "asymmetric jawline") return "jawline";
  return issueName.trim();
}

/** Skin scan lenses (left tabs + polar chart). */
export type AuraSkinLens =
  | "pigmentation"
  | "texture"
  | "redness"
  | "pores"
  | "wrinkles";

export const SKIN_LENS_ORDER: AuraSkinLens[] = [
  "pigmentation",
  "redness",
  "pores",
  "wrinkles",
];

/** Clockwise petal order on the skin coxcomb (first sector starts at top). Shorter labels on the right. */
export const SKIN_LENS_CHART_ORDER: AuraSkinLens[] = [
  "pores",
  "redness",
  "wrinkles",
  "pigmentation",
];

export const AURA_SKIN_LENS_LABELS: Record<AuraSkinLens, string> = {
  pigmentation: "Pigmentation",
  texture: "Texture",
  redness: "Redness",
  pores: "Pores",
  wrinkles: "Wrinkles",
};

/** Group headings in findings list (chart fill uses 1–5 severity gradient). */
export const AURA_SKIN_LENS_COLORS: Record<AuraSkinLens, string> = {
  pigmentation: "#9b7a56",
  texture: "#8b7bd8",
  redness: "#7eb88a",
  pores: "#8ec67a",
  wrinkles: "#7aa88c",
};

/** Coxcomb grid scale (petal length is plotted on this range). */
export const CHART_AXIS_MIN = 0;
export const CHART_AXIS_MAX = 3;

/** Displayed score labels on each petal (always one decimal). */
export const SCORE_VALUE_MIN = 1.2;
export const SCORE_VALUE_MAX = 2.8;

export type SkinLensRadarDatum = {
  name: string;
  score: number;
  /** Petal length on the 0–3 chart (1.2–2.8); use this for plotting to avoid round-trip drift. */
  severityAxis: number;
  lens: AuraSkinLens;
  color: string;
  scoreColor: string;
};

/**
 * Petal score 1.2–2.8 (lower = better/green); plotted on a 0–3 chart axis.
 */
export function healthScoreToSeverityAxis(healthScore: number): number {
  const h = Math.max(0, Math.min(100, healthScore));
  const axis =
    SCORE_VALUE_MIN + ((100 - h) / 100) ** 0.9 * (SCORE_VALUE_MAX - SCORE_VALUE_MIN);
  const clamped = Math.max(SCORE_VALUE_MIN, Math.min(SCORE_VALUE_MAX, axis));
  return Math.round(clamped * 10) / 10;
}

/** Minimum gap between any two skin-lens petal scores on the 1.2–2.8 axis. */
export const MIN_LENS_AXIS_GAP = 0.28;

/** Inverse of {@link healthScoreToSeverityAxis} for spreading / nudging petal scores. */
export function severityAxisToHealthScore(axis: number): number {
  const clamped = Math.max(
    SCORE_VALUE_MIN,
    Math.min(SCORE_VALUE_MAX, Math.round(axis * 10) / 10),
  );
  const t = (clamped - SCORE_VALUE_MIN) / (SCORE_VALUE_MAX - SCORE_VALUE_MIN);
  const normalized = Math.max(0, Math.min(1, t)) ** (1 / 0.9);
  return Math.round(100 - normalized * 100);
}

/** One decimal (e.g. 1.5, 2.7). */
export function formatSeverityAxisValue(axis: number): string {
  const clamped = Math.max(
    SCORE_VALUE_MIN,
    Math.min(SCORE_VALUE_MAX, Math.round(axis * 10) / 10),
  );
  return clamped.toFixed(1);
}

export function auraSkinLensFromLabel(label: string): AuraSkinLens | undefined {
  const key = label.trim().toLowerCase();
  if (key === "pigmentation" || key === "pigment") return "pigmentation";
  if (key === "texture") return "texture";
  if (key === "redness") return "redness";
  if (key === "pores") return "pores";
  if (key === "wrinkles") return "wrinkles";
  return undefined;
}

const SKIN_LENS_SUB_SCORES: Record<AuraSkinLens, string[]> = {
  pigmentation: ["Pigmentation"],
  texture: ["Texture"],
  redness: ["Pigmentation"],
  pores: ["Texture"],
  wrinkles: ["Wrinkles"],
};

export const SKIN_LENS_ISSUES: Record<AuraSkinLens, string[]> = {
  pigmentation: ["Dark Spots", "Under Eye Dark Circles"],
  texture: ["Scars", "Dry Skin", "Crepey Skin"],
  redness: ["Facial Redness", "Red Spots", "Rosacea"],
  pores: [
    "Enlarged Pores",
    "Acne / Breakouts",
    "Uneven Skin Texture",
    "Whiteheads",
    "Blackheads",
  ],
  wrinkles: [
    "Fine Lines",
    "Forehead Wrinkles",
    "Crow's Feet Wrinkles",
    "Glabella Wrinkles",
    "Under Eye Wrinkles",
    "Perioral Wrinkles",
    "Bunny Lines",
    "Neck Lines",
  ],
};

export function primarySkinLensForIssue(issue: string): AuraSkinLens {
  const key = normalizeIssue(issue);
  const order: AuraSkinLens[] = [
    "pores",
    "redness",
    "wrinkles",
    "texture",
    "pigmentation",
  ];
  for (const lens of order) {
    if (SKIN_LENS_ISSUES[lens].some((name) => normalizeIssue(name) === key)) {
      return lens;
    }
  }
  return "pigmentation";
}

/**
 * Issues for a skin lens tab: detected category issues plus severity-predicted
 * rows for that lens (so demo clients like Courtney Bellamy always surface redness/pores).
 */
export function collectIssuesForSkinLens(
  lens: AuraSkinLens,
  activeCategoryIssues: string[],
  severityIssues?: Record<string, AnalysisSeverityIssue>,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (raw: string) => {
    const label = canonicalIssueDisplayLabel(raw);
    const key = normalizeIssue(label);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(label);
  };

  for (const issue of activeCategoryIssues) {
    if (primarySkinLensForIssue(issue) === lens) add(issue);
  }

  if (severityIssues) {
    for (const issueName of SKIN_LENS_ISSUES[lens]) {
      const payload = getSeverityPayloadForIssueLabel(issueName, severityIssues);
      if (!payload?.predicted || !isSeverityRowNonPerfect(payload)) continue;
      add(issueName);
    }
  }

  return out;
}

/**
 * Evenly spread petal axis values (1.2–2.8) while preserving each lens’s severity rank.
 */
export function spreadSkinLensAxisValues(
  axesByLens: Record<AuraSkinLens, number>,
): Record<AuraSkinLens, number> {
  const ranked = SKIN_LENS_ORDER.map((lens) => ({
    lens,
    axis: Math.max(
      SCORE_VALUE_MIN,
      Math.min(SCORE_VALUE_MAX, axesByLens[lens]),
    ),
  })).sort((a, b) => a.axis - b.axis);

  const n = ranked.length;
  const slack = SCORE_VALUE_MAX - SCORE_VALUE_MIN - MIN_LENS_AXIS_GAP * (n - 1);
  const start = SCORE_VALUE_MIN + Math.max(0, slack * 0.12);

  const out = {} as Record<AuraSkinLens, number>;
  ranked.forEach((row, rank) => {
    const target = Math.min(
      SCORE_VALUE_MAX,
      start + rank * MIN_LENS_AXIS_GAP,
    );
    const blended = Math.round((row.axis * 0.4 + target * 0.6) * 10) / 10;
    out[row.lens] = Math.max(SCORE_VALUE_MIN, Math.min(SCORE_VALUE_MAX, blended));
  });

  for (let i = 1; i < ranked.length; i++) {
    const prev = ranked[i - 1].lens;
    const cur = ranked[i].lens;
    if (out[cur] - out[prev] < MIN_LENS_AXIS_GAP) {
      out[cur] = Math.min(SCORE_VALUE_MAX, out[prev] + MIN_LENS_AXIS_GAP);
    }
  }

  const worst = ranked[n - 1].lens;
  if (out[worst] > SCORE_VALUE_MAX) {
    const shift = out[worst] - SCORE_VALUE_MAX;
    for (const row of ranked) {
      out[row.lens] = Math.max(
        SCORE_VALUE_MIN,
        Math.round((out[row.lens] - shift) * 10) / 10,
      );
    }
  }

  const best = ranked[0].lens;
  if (out[best] < SCORE_VALUE_MIN) {
    const shift = SCORE_VALUE_MIN - out[best];
    for (const row of ranked) {
      out[row.lens] = Math.min(
        SCORE_VALUE_MAX,
        Math.round((out[row.lens] + shift) * 10) / 10,
      );
    }
  }

  return out;
}

function computeLensHealthScore(
  lens: AuraSkinLens,
  activeCat: CategoryResult,
  severityIssues?: Record<string, AnalysisSeverityIssue>,
  detected?: Set<string>,
): number {
  let sum = 0;
  let count = 0;

  for (const issue of SKIN_LENS_ISSUES[lens]) {
    const vis = issueSeverityVisual(issue, severityIssues, "#94a3b8");
    if (vis.healthScore != null && vis.hasSeverityPayload) {
      const payload = getSeverityPayloadForIssueLabel(issue, severityIssues);
      if (payload?.predicted && isSeverityRowNonPerfect(payload)) {
        sum += vis.healthScore;
        count += 1;
        continue;
      }
    }
    if (detected?.has(normalizeIssue(issue))) {
      sum += vis.healthScore ?? 45;
      count += 1;
    }
  }

  if (count > 0) {
    return Math.max(0, Math.min(100, Math.round(sum / count)));
  }
  if (
    (severityIssues && Object.keys(severityIssues).length > 0) ||
    (detected && detected.size > 0)
  ) {
    return 100;
  }
  return fallbackLensScore(activeCat, lens);
}

/** Skin lens radar axes aligned with left-panel Texture / Redness / Pores tabs. */
export function buildSkinLensRadarData(
  activeCat: CategoryResult,
  options?: {
    detected?: Set<string>;
    severityIssues?: Record<string, AnalysisSeverityIssue>;
  },
): SkinLensRadarDatum[] {
  const detected = options?.detected;
  const severityIssues = options?.severityIssues;

  const rawScores = {} as Record<AuraSkinLens, number>;
  const rawAxes = {} as Record<AuraSkinLens, number>;
  for (const lens of SKIN_LENS_ORDER) {
    const health = computeLensHealthScore(
      lens,
      activeCat,
      severityIssues,
      detected,
    );
    rawScores[lens] = health;
    rawAxes[lens] = healthScoreToSeverityAxis(health);
  }

  return SKIN_LENS_CHART_ORDER.map((lens) => {
    const score = rawScores[lens];
    const severityAxis = rawAxes[lens];
    return {
      name: AURA_SKIN_LENS_LABELS[lens],
      score,
      severityAxis,
      lens,
      color: AURA_SKIN_LENS_COLORS[lens],
      scoreColor: tierColor(scoreTier(score)),
    };
  });
}

function fallbackLensScore(activeCat: CategoryResult, lens: AuraSkinLens): number {
  const names = SKIN_LENS_SUB_SCORES[lens];
  const subs = activeCat.subScores.filter((s) => names.includes(s.name));
  const base =
    subs.length > 0
      ? Math.round(subs.reduce((sum, s) => sum + s.score, 0) / subs.length)
      : activeCat.score;
  /** When sub-scores collapse to one number, nudge lenses apart on the health scale. */
  const lensBias: Record<AuraSkinLens, number> = {
    pigmentation: -8,
    redness: -10,
    pores: -4,
    texture: 2,
    wrinkles: 8,
  };
  return Math.max(0, Math.min(100, base + lensBias[lens]));
}
