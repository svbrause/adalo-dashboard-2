import type { Client, DiscussedItem } from "../types";
import type { PostVisitBlueprintPayload } from "./postVisitBlueprint";
import type { ScoreTier } from "../config/analysisOverviewConfig";
import {
  CATEGORY_DESCRIPTIONS,
  computeAreas,
  computeCategories,
  computeOverall,
  normalizeIssue,
  scoreTier,
} from "../config/analysisOverviewConfig";
import { getTreatmentDisplayName } from "../components/modals/DiscussedTreatmentsModal/utils";
import {
  getDetectedIssueDisplayStrings,
  getDetectedIssuesFromClient,
  getInterestAreaNamesFromClient,
} from "./analysisOverviewClient";

/** Same scoring / narrative as the dashboard Analysis Overview modal (serialized at send time). */
export interface BlueprintAnalysisOverviewSnapshot {
  overallScore: number;
  overallTier: ScoreTier;
  /** Patient-facing overview copy (multi-paragraph) — not the short dashboard template. */
  assessmentParagraph: string;
  categories: {
    key: string;
    name: string;
    scoreLabel: string;
    score: number;
    tier: ScoreTier;
    description: string;
    /** Sub-areas (e.g. Wrinkles, Texture) — used for spider charts. Omitted on older blueprint links. */
    subScores?: {
      name: string;
      score: number;
      /** Present on newer snapshots — powers strengths vs focus pills like Analysis Overview. */
      total?: number;
      detected?: number;
    }[];
  }[];
  /** Per face area: score + detected improvements (issue names). */
  areas: {
    name: string;
    score: number;
    tier: ScoreTier;
    hasInterest: boolean;
    improvements: string[];
    /** Features evaluated as “in good shape” — optional on older stored blueprints. */
    strengths?: string[];
  }[];
  /** Deduped labels from `allIssues` for chips. */
  detectedIssueLabels: string[];
  /**
   * LLM narrative from backend `/api/assessment` (OpenAI or Gemini) — fetched once when the blueprint is sent
   * and cached here so the patient page matches the dashboard Analysis Overview experience.
   */
  aiNarrative?: string;
}

/**
 * Re-derives per-area strengths vs improvements from `detectedIssueLabels` (same rules as
 * Analysis Overview). Fixes older stored snapshots that omitted `strengths` or had empty arrays.
 */
export function enrichOverviewSnapshotAreas(
  snapshot: BlueprintAnalysisOverviewSnapshot,
): BlueprintAnalysisOverviewSnapshot {
  if (!snapshot.areas.length) return snapshot;
  const detected = new Set(
    (snapshot.detectedIssueLabels ?? []).map((l) => normalizeIssue(l)),
  );
  const interestNames = new Set(
    snapshot.areas.filter((a) => a.hasInterest).map((a) => a.name.toLowerCase()),
  );
  const computed = computeAreas(detected, interestNames);
  const byName = new Map(computed.map((a) => [a.name, a]));
  return {
    ...snapshot,
    areas: snapshot.areas.map((a) => {
      const c = byName.get(a.name);
      if (!c) return a;
      return {
        ...a,
        score: c.score,
        tier: c.tier,
        strengths: c.strengths,
        improvements: c.improvements,
        hasInterest: c.hasInterest,
      };
    }),
  };
}

/** Snapshot of AI / intake analysis text stored when the blueprint link is generated. */
export interface BlueprintAnalysisSummary {
  goals: string[];
  concerns: string | null;
  aestheticGoals: string | null;
  interestedIssues: string | null;
  whichRegions: string | null;
  skinComplaints: string | null;
  processedAreasOfInterest: string | null;
  /** Populated when `client.allIssues` has data — powers overview-style scores on the patient page. */
  overviewSnapshot?: BlueprintAnalysisOverviewSnapshot;
}

const MAX_FIELD = 650;
const MAX_GOAL = 240;

/**
 * Human-readable analysis copy. Data often arrives query-encoded or slug-like
 * (e.g. "Face+and+neck+aging", "forehead_wrinkles") instead of proper labels
 * like "Forehead wrinkles".
 */
export function normalizeBlueprintAnalysisText(raw: string): string {
  let s = String(raw).trim();
  if (!s) return s;
  // URL/query style: plus signs mean spaces
  s = s.replace(/\+/g, " ");
  if (/%[0-9A-Fa-f]{2}/.test(s)) {
    try {
      s = decodeURIComponent(s);
    } catch {
      /* keep decoded + pass */
    }
  }
  // Slug style: underscores when there are no spaces yet
  if (!s.includes(" ") && /_/.test(s)) {
    s = s.replace(/_+/g, " ");
  }
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Hero pills / chips: same phrase with different casing (e.g. "Full face" vs "Full Face")
 * should appear once; keep first occurrence’s spelling.
 */
export function dedupeBlueprintDisplayStrings(
  raw: readonly string[],
  max?: number,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of raw) {
    const t = normalizeBlueprintAnalysisText(String(x).trim());
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (max != null && out.length >= max) break;
  }
  return out;
}

function trimField(value: unknown): string | null {
  const t = String(value ?? "").trim();
  if (!t) return null;
  const clipped = t.length <= MAX_FIELD ? t : `${t.slice(0, MAX_FIELD).trim()}…`;
  return normalizeBlueprintAnalysisText(clipped);
}

function normalizeConcerns(concerns: Client["concerns"]): string | null {
  if (Array.isArray(concerns)) {
    const parts = concerns.map((c) => String(c).trim()).filter(Boolean);
    return trimField(parts.join(" · "));
  }
  return trimField(concerns);
}

function formatEnglishList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}


/**
 * Rich, patient-readable overview for the Post-Visit Blueprint hero (replaces the short
 * `generateAssessment` blurb used in the dashboard modal).
 */
export function generateBlueprintPatientOverview(params: {
  overallScore: number;
  overallTier: ScoreTier;
  categories: { name: string; score: number }[];
  areas: {
    name: string;
    score: number;
    hasInterest: boolean;
    improvements: string[];
  }[];
  detectedIssueLabels: string[];
  focusCount: number;
}): string {
  const {
    categories,
    areas,
    detectedIssueLabels,
    focusCount,
  } = params;

  const paragraphs: string[] = [];

  const findings = detectedIssueLabels.slice(0, 8);
  if (findings.length > 0) {
    paragraphs.push(
      `Your scan picked up on ${formatEnglishList(findings)}.`,
    );
  }

  if (categories.length >= 2) {
    const sorted = [...categories].sort((a, b) => b.score - a.score);
    const strongest = sorted[0]!;
    const weakest = sorted[sorted.length - 1]!;
    paragraphs.push(
      `Of the three main areas\u2014skin health, volume, and facial structure\u2014${strongest.name} is your strongest (${strongest.score}), while ${weakest.name} has the most room for improvement (${weakest.score}).`,
    );
  }

  const byRegion = [...areas].sort((a, b) => a.score - b.score);
  const highlight = byRegion.slice(0, 3);
  if (highlight.length > 0) {
    const regionBits = highlight.map((a) => `${a.name} (${a.score})`);
    paragraphs.push(
      `By region, the areas with the most activity on your scan are ${formatEnglishList(regionBits)}.`,
    );
  }

  const interestNames = areas.filter((a) => a.hasInterest).map((a) => a.name);
  if (interestNames.length > 0) {
    paragraphs.push(
      `You flagged ${formatEnglishList(interestNames)} as areas you wanted to focus on\u2014your plan is built around those priorities.`,
    );
  } else if (focusCount > 0) {
    paragraphs.push(
      `You marked ${focusCount} priority ${focusCount === 1 ? "area" : "areas"} during your intake, and the plan below reflects that.`,
    );
  }

  return paragraphs.join("\n\n");
}

/**
 * Builds the same structured overview data as Analysis Overview (scores, areas, narrative).
 */
export function buildAnalysisOverviewSnapshotFromClient(
  client: Client,
): BlueprintAnalysisOverviewSnapshot | null {
  const detected = getDetectedIssuesFromClient(client);
  if (detected.size === 0) return null;

  const interestAreaNames = getInterestAreaNamesFromClient(client);
  const categories = computeCategories(detected);
  const overall = computeOverall(categories);
  const areaResults = computeAreas(detected, interestAreaNames);
  const focusAreas = areaResults
    .filter((a) => a.hasInterest)
    .sort((a, b) => a.score - b.score);
  const focusCount = focusAreas.length;

  const areaRows = areaResults.map((a) => ({
    name: a.name,
    score: a.score,
    hasInterest: a.hasInterest,
    improvements: a.improvements.slice(0, 8),
    strengths: a.strengths.slice(0, 8),
  }));
  const detectedLabels = getDetectedIssueDisplayStrings(client)
    .map((s) => normalizeBlueprintAnalysisText(s))
    .filter(Boolean)
    .slice(0, 36);

  const assessmentParagraph = generateBlueprintPatientOverview({
    overallScore: overall,
    overallTier: scoreTier(overall),
    categories: categories.map((c) => ({ name: c.name, score: c.score })),
    areas: areaRows,
    detectedIssueLabels: detectedLabels,
    focusCount,
  });

  return {
    overallScore: overall,
    overallTier: scoreTier(overall),
    assessmentParagraph,
    categories: categories.map((c) => ({
      key: c.key,
      name: c.name,
      scoreLabel: c.scoreLabel,
      score: c.score,
      tier: c.tier,
      description: CATEGORY_DESCRIPTIONS[c.key] ?? "",
      subScores: c.subScores.map((s) => ({
        name: s.name,
        score: s.score,
        total: s.total,
        detected: s.detected,
      })),
    })),
    areas: areaRows.map((a, i) => ({
      name: a.name,
      score: a.score,
      hasInterest: a.hasInterest,
      improvements: a.improvements,
      strengths: a.strengths,
      tier: areaResults[i]!.tier,
    })),
    detectedIssueLabels: detectedLabels,
  };
}

/**
 * Called when sending a blueprint — copies key analysis fields from the client record
 * so the patient page can explain *why* treatments were recommended.
 */
export function buildAnalysisSummaryFromClient(
  client: Client,
): BlueprintAnalysisSummary | undefined {
  const goals = (client.goals ?? [])
    .map((g) => normalizeBlueprintAnalysisText(String(g).trim()))
    .filter(Boolean)
    .map((g) => (g.length > MAX_GOAL ? `${g.slice(0, MAX_GOAL)}…` : g));

  const overviewSnapshot = buildAnalysisOverviewSnapshotFromClient(client);

  const out: BlueprintAnalysisSummary = {
    goals,
    concerns: normalizeConcerns(client.concerns),
    aestheticGoals: trimField(client.aestheticGoals),
    interestedIssues: trimField(client.interestedIssues),
    whichRegions: trimField(client.whichRegions),
    skinComplaints: trimField(client.skinComplaints),
    processedAreasOfInterest: trimField(client.processedAreasOfInterest),
    ...(overviewSnapshot ? { overviewSnapshot } : {}),
  };

  const hasAny =
    out.goals.length > 0 ||
    out.concerns ||
    out.aestheticGoals ||
    out.interestedIssues ||
    out.whichRegions ||
    out.skinComplaints ||
    out.processedAreasOfInterest ||
    out.overviewSnapshot;

  return hasAny ? out : undefined;
}

/** Stable DOM id for chapter sections (TOC links + plan row links). */
export function treatmentChapterAnchorId(key: string): string {
  const slug = key
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `pvb-ch-${slug || "treatment"}`;
}

/** One row per distinct treatment in the plan — links to the chapter below. */
export type PlanTreatmentRow = {
  key: string;
  displayName: string;
  anchorId: string;
  interest?: string;
  findings: string[];
};

export function buildPlanTreatmentRows(discussedItems: DiscussedItem[]): PlanTreatmentRow[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const item of discussedItems) {
    const key = item.treatment?.trim().toLowerCase() ?? "";
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    order.push(key);
  }

  const rows: PlanTreatmentRow[] = [];
  for (const key of order) {
    const planItems = discussedItems.filter(
      (i) => (i.treatment?.trim().toLowerCase() ?? "") === key,
    );
    if (planItems.length === 0) continue;

    const interests = new Set<string>();
    const findings = new Set<string>();
    for (const it of planItems) {
      const int = it.interest?.trim();
      if (int) interests.add(normalizeBlueprintAnalysisText(int));
      for (const f of it.findings ?? []) {
        const nf = f.trim();
        if (nf) findings.add(normalizeBlueprintAnalysisText(nf));
      }
    }

    rows.push({
      key,
      displayName: getTreatmentDisplayName(planItems[0]),
      anchorId: treatmentChapterAnchorId(key),
      interest: interests.size ? Array.from(interests).join(" · ") : undefined,
      findings: Array.from(findings),
    });
  }
  return rows;
}

export function derivePlanInterestsFromDiscussedItems(
  items: DiscussedItem[],
): { interests: string[]; findings: string[] } {
  const interests = new Set<string>();
  const findings = new Set<string>();
  for (const item of items) {
    const int = item.interest?.trim();
    if (int) interests.add(normalizeBlueprintAnalysisText(int));
    for (const f of item.findings ?? []) {
      const nf = f.trim();
      if (nf) findings.add(normalizeBlueprintAnalysisText(nf));
    }
  }
  return {
    interests: Array.from(interests).slice(0, 12),
    findings: Array.from(findings).slice(0, 16),
  };
}

/** Unified model for rendering the “analysis highlights” section. */
export type BlueprintAnalysisDisplay = {
  profileLabels: { label: string; value: string }[];
  goals: string[];
  /** Scores + narrative from Analysis Overview (when `allIssues` was present at send). */
  overviewSnapshot: BlueprintAnalysisOverviewSnapshot | null;
  /** Merged clinical lines (no duplicate raw field headers in UI). */
  clinicalSnapshotLines: { label: string; text: string }[];
  /** Per treatment → scroll target for chapters */
  planByTreatment: PlanTreatmentRow[];
  /** When nothing is tied to a treatment row, show global chips */
  globalPlanInsights: { interests: string[]; findings: string[] };
};

/** Split list-style fields (commas, semicolons, middle dots, etc.) */
function splitListParts(s: string): string[] {
  return normalizeBlueprintAnalysisText(s)
    .split(/[,;·]|(?:\s+-\s+)|(?:\s+&\s+)/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Remove duplicate segments (case-insensitive), preserve first-seen casing */
function dedupeListParts(parts: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const k = p.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

function tokenSet(parts: string[]): Set<string> {
  return new Set(parts.map((p) => p.toLowerCase()));
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

function isSubset(a: Set<string>, b: Set<string>): boolean {
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

/** Long-form concerns vs short tag lists (often duplicated across CRM fields). */
function isProseBlock(s: string): boolean {
  const t = s.trim();
  if (t.length <= 100) return false;
  const pieces = t.split(/[,;·]/).filter((x) => x.trim().length > 0);
  if (pieces.length >= 5 && t.length < 220) return false;
  if (t.length > 160) return true;
  return /[.!?]\s/.test(t);
}

type ParsedMixed = { prose: string | null; parts: string[] };

function parseMixedField(raw: string | null | undefined): ParsedMixed {
  if (!raw?.trim()) return { prose: null, parts: [] };
  const n = normalizeBlueprintAnalysisText(raw);
  if (isProseBlock(n)) return { prose: n, parts: [] };
  return { prose: null, parts: dedupeListParts(splitListParts(n)) };
}

/**
 * Merge overlapping CRM fields (concerns / regions / interests / areas) into one row
 * and dedupe repeated tokens inside each string.
 */
export function buildConsolidatedClinicalSnapshotLines(
  a: BlueprintAnalysisSummary | undefined,
): { label: string; text: string }[] {
  if (!a) return [];

  const ag = parseMixedField(a.aestheticGoals);
  const concerns = parseMixedField(a.concerns);
  const interested = parseMixedField(a.interestedIssues);
  const regions = parseMixedField(a.whichRegions);
  const areas = parseMixedField(a.processedAreasOfInterest);
  const skin = parseMixedField(a.skinComplaints);

  const unionParts = dedupeListParts([
    ...concerns.parts,
    ...interested.parts,
    ...regions.parts,
    ...areas.parts,
  ]);
  const unionSet = tokenSet(unionParts);

  const lines: { label: string; text: string }[] = [];

  if (ag.prose) {
    lines.push({ label: "What you're hoping to improve", text: ag.prose });
  } else if (ag.parts.length) {
    const agSet = tokenSet(ag.parts);
    if (!setsEqual(agSet, unionSet)) {
      lines.push({
        label: "What you're hoping to improve",
        text: ag.parts.join(", "),
      });
    }
  }

  if (concerns.prose) {
    lines.push({ label: "Concerns we noted", text: concerns.prose });
  }

  if (unionParts.length) {
    lines.push({ label: "Focus areas", text: unionParts.join(", ") });
  }

  if (skin.prose) {
    lines.push({ label: "Skin observations", text: skin.prose });
  } else if (skin.parts.length) {
    const skinSet = tokenSet(skin.parts);
    if (!isSubset(skinSet, unionSet)) {
      lines.push({
        label: "Skin observations",
        text: skin.parts.join(", "),
      });
    }
  }

  const seenText = new Set<string>();
  return lines.filter((row) => {
    const t = row.text.trim();
    if (!t) return false;
    const k = t.toLowerCase();
    if (seenText.has(k)) return false;
    seenText.add(k);
    return true;
  });
}

export const PVB_ANALYSIS_SECTION_ID = "pvb-analysis";

export function getBlueprintAnalysisDisplay(
  blueprint: PostVisitBlueprintPayload,
): BlueprintAnalysisDisplay | null {
  const p = blueprint.patient;
  const profileLabels: { label: string; value: string }[] = [];
  if (p.ageRange?.trim())
    profileLabels.push({ label: "Age range", value: p.ageRange.trim() });
  if (p.skinType?.trim())
    profileLabels.push({ label: "Skin type", value: p.skinType.trim() });
  if (p.skinTone?.trim())
    profileLabels.push({ label: "Skin tone", value: p.skinTone.trim() });
  if (p.ethnicBackground?.trim())
    profileLabels.push({ label: "Background", value: p.ethnicBackground.trim() });

  const a = blueprint.analysisSummary;

  const goals = a?.goals?.length ? a.goals.map((g) => normalizeBlueprintAnalysisText(g)) : [];

  const overviewSnapshot = a?.overviewSnapshot
    ? enrichOverviewSnapshotAreas(a.overviewSnapshot)
    : null;

  const clinicalSnapshotLines = buildConsolidatedClinicalSnapshotLines(a);

  const planByTreatment = buildPlanTreatmentRows(blueprint.discussedItems);
  const derived = derivePlanInterestsFromDiscussedItems(blueprint.discussedItems);

  const hasPerTreatmentContent = planByTreatment.some(
    (row) => Boolean(row.interest) || row.findings.length > 0,
  );
  const globalPlanInsights = hasPerTreatmentContent
    ? { interests: [], findings: [] }
    : {
        interests: derived.interests,
        findings: derived.findings,
      };

  const hasAny =
    profileLabels.length > 0 ||
    goals.length > 0 ||
    overviewSnapshot != null ||
    clinicalSnapshotLines.length > 0 ||
    planByTreatment.length > 0 ||
    globalPlanInsights.interests.length > 0 ||
    globalPlanInsights.findings.length > 0;

  if (!hasAny) return null;

  return {
    profileLabels,
    goals,
    overviewSnapshot,
    clinicalSnapshotLines,
    planByTreatment,
    globalPlanInsights,
  };
}
