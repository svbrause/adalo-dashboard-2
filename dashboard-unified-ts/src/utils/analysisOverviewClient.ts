/**
 * Shared helpers for Analysis Overview + Post-Visit Blueprint — same inputs as the overview modal.
 */
import type { AnalysisSeverityIssue, Client } from "../types";
import { adminDemoSeverityIssuesForClient } from "../debug/adminDemoSeverityOverlay";
import { normalizeIssue } from "../config/analysisOverviewConfig";
import { issueToAreaMap } from "./issueMapping";

/** Normalized severity at or below this is treated as a non-issue (“perfect”). */
export const SEVERITY_NORM_NEAR_ZERO = 1e-5;

/** 0–1 “badness” for ring fill / sorting; prefers `severity_normalized_0_1`, else coarse legacy heuristic. */
export function inferSeverityBadness01(
  issue: AnalysisSeverityIssue | undefined,
): number | undefined {
  if (!issue) return undefined;
  const n = issue.severity_normalized_0_1;
  if (n !== undefined && Number.isFinite(n)) {
    return Math.max(0, Math.min(1, n));
  }
  const severity = typeof issue.severity === "number" ? issue.severity : 0;
  const probability = typeof issue.probability === "number" ? issue.probability : 0;
  if (!issue.predicted && severity <= 0 && probability <= 0) return undefined;
  return Math.max(0, Math.min(1, Math.max(severity, probability) / 100));
}

/** True when this detector row should surface as having meaningful severity (shown in severity lists). */
export function isSeverityRowNonPerfect(issue: AnalysisSeverityIssue): boolean {
  const level =
    typeof issue.severity_level === "string"
      ? issue.severity_level.trim().toLowerCase()
      : "";
  if (level === "none" || level === "minimal") return false;

  const n = issue.severity_normalized_0_1;
  if (n !== undefined && Number.isFinite(n)) {
    if (issue.predicted === false) return n >= 0.25;
    return n > SEVERITY_NORM_NEAR_ZERO;
  }
  if (issue.predicted === false) return false;
  return Boolean(
    issue.predicted ||
      (issue.severity ?? 0) > 0 ||
      (issue.probability ?? 0) > 0,
  );
}

/** Severity JSON for overview / Aura panel (includes Courtney showcase fallback). */
export function getEffectiveSeverityIssues(
  client: Client,
): Record<string, AnalysisSeverityIssue> | undefined {
  return adminDemoSeverityIssuesForClient(client);
}

export function getDetectedIssuesFromClient(client: Client): Set<string> {
  const severityIssues = getEffectiveSeverityIssues(client);
  if (severityIssues && Object.keys(severityIssues).length > 0) {
    const set = new Set<string>();
    for (const [issueName, issue] of Object.entries(severityIssues)) {
      if (!isSeverityRowNonPerfect(issue)) continue;
      set.add(normalizeIssue(issueName));
    }
    if (set.size > 0) return set;
  }

  const set = new Set<string>();
  const raw = client.allIssues;
  if (!raw) return set;
  const list = Array.isArray(raw)
    ? raw
    : String(raw)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
  list.forEach((issue) => set.add(normalizeIssue(issue)));
  return set;
}

export function getInterestAreaNamesFromClient(client: Client): Set<string> {
  const names = new Set<string>();
  const sources = [
    client.processedAreasOfInterest,
    client.areasOfInterestFromForm,
    client.whichRegions,
  ].filter(Boolean) as string[];

  sources.forEach((str) => {
    const s = typeof str === "string" ? str : String(str);
    s.split(",").forEach((part) => {
      const trimmed = part.trim().toLowerCase();
      if (trimmed) names.add(trimmed);
    });
  });

  names.forEach((n) => {
    if (n.includes("jaw") || n.includes("chin")) names.add("jawline");
    if (n.includes("eye")) names.add("eyes");
    if (n.includes("lip")) names.add("lips");
    if (n.includes("forehead") || n.includes("brow")) names.add("forehead");
    if (n.includes("cheek")) names.add("cheeks");
    if (n.includes("nose")) names.add("nose");
    if (n.includes("skin")) {
      names.add("skin");
      names.add("skin quality");
    }
  });

  return names;
}

export interface SeverityIssueDisplayRow {
  issue: string;
  severity: number;
  probability: number;
  predicted: boolean;
  severityLevel?: string;
  source?: string;
  severityNormalized01?: number;
  badness01?: number;
}

export function getSeverityIssueRowsFromClient(
  client: Client,
): SeverityIssueDisplayRow[] {
  const severityIssues = getEffectiveSeverityIssues(client);
  if (!severityIssues) return [];
  const rows: SeverityIssueDisplayRow[] = [];
  for (const [issueName, issue] of Object.entries(severityIssues)) {
    if (!isSeverityRowNonPerfect(issue)) continue;
    const severity = typeof issue.severity === "number" ? issue.severity : 0;
    const probability = typeof issue.probability === "number" ? issue.probability : 0;
    const predicted = issue.predicted === true;
    const n = issue.severity_normalized_0_1;
    const badness =
      inferSeverityBadness01(issue) ??
      Math.min(1, Math.max(severity, probability) / 100);
    rows.push({
      issue: issueName,
      severity,
      probability,
      predicted,
      severityLevel:
        typeof issue.severity_level === "string" ? issue.severity_level : undefined,
      source: typeof issue.source === "string" ? issue.source : undefined,
      severityNormalized01:
        n !== undefined && Number.isFinite(n)
          ? Math.max(0, Math.min(1, n))
          : undefined,
      badness01: badness,
    });
  }
  rows.sort((a, b) => {
    const ba = a.badness01 ?? 0;
    const bb = b.badness01 ?? 0;
    if (bb !== ba) return bb - ba;
    if (b.severity !== a.severity) return b.severity - a.severity;
    return a.issue.localeCompare(b.issue);
  });
  return rows;
}

/**
 * Per-display-region score from 60 (worst) to 100 (best). Uses every issue mapped into that region
 * from `issueToAreaMap`; issues not flagged by the detector (or rollup when no detector) count as perfect.
 */
export function getRegionGrade60to100(
  displayAreaName: string,
  options: {
    severityIssues: Record<string, AnalysisSeverityIssue> | undefined;
    rollupIssueNormKeys: Set<string>;
    canonicalIssueNames?: string[];
  },
): number {
  const list =
    options.canonicalIssueNames ??
    ISSUES_FOR_DISPLAY_AREA[displayAreaName] ??
    [];

  if (!list || list.length === 0) return 100;

  const hasSeverity =
    !!options.severityIssues &&
    Object.keys(options.severityIssues).length > 0;

  let sumGood = 0;
  for (const canonical of list) {
    sumGood += issueGoodnessForRegionScore(
      canonical,
      options.severityIssues,
      hasSeverity,
      options.rollupIssueNormKeys,
    );
  }
  const avg = sumGood / list.length;
  return Math.round(60 + 40 * avg);
}

const ISSUES_FOR_DISPLAY_AREA: Record<string, string[]> = (() => {
  const m: Record<string, Set<string>> = {};
  for (const [issue, area] of Object.entries(issueToAreaMap)) {
    if (!m[area]) m[area] = new Set();
    m[area].add(issue);
  }
  const out: Record<string, string[]> = {};
  for (const [a, set] of Object.entries(m)) {
    out[a] = Array.from(set).sort((x, y) => x.localeCompare(y));
  }
  return out;
})();

/** Resolve detector payload for a display issue label (exact or normalized key match). */
export function getSeverityPayloadForIssueLabel(
  displayIssueName: string,
  severityIssues: Record<string, AnalysisSeverityIssue> | undefined,
): AnalysisSeverityIssue | undefined {
  return getPayloadForCanonicalIssue(displayIssueName, severityIssues);
}

function getPayloadForCanonicalIssue(
  canonicalIssue: string,
  severityIssues: Record<string, AnalysisSeverityIssue> | undefined,
): AnalysisSeverityIssue | undefined {
  if (!severityIssues) return undefined;
  const direct = severityIssues[canonicalIssue];
  if (direct) return direct;
  const nk = normalizeIssue(canonicalIssue);
  for (const [k, v] of Object.entries(severityIssues)) {
    if (normalizeIssue(k) === nk) return v;
  }
  return undefined;
}

function issueGoodnessForRegionScore(
  canonicalIssue: string,
  severityIssues: Record<string, AnalysisSeverityIssue> | undefined,
  hasSeverityJson: boolean,
  rollupIssueNormKeys: Set<string>,
): number {
  const payload = getPayloadForCanonicalIssue(
    canonicalIssue,
    severityIssues,
  );

  if (payload) {
    const n = payload.severity_normalized_0_1;
    if (n !== undefined && Number.isFinite(n)) {
      const b = Math.max(0, Math.min(1, n));
      return Math.max(0, Math.min(1, 1 - b));
    }
    if (
      !(payload.predicted ||
        (payload.severity ?? 0) > 0 ||
        (payload.probability ?? 0) > 0)
    ) {
      return 1;
    }
    const bad = inferSeverityBadness01(payload);
    const b =
      bad !== undefined ? bad : Math.min(1, Math.max(payload.severity ?? 0, payload.probability ?? 0) / 100);
    return Math.max(0, 1 - b);
  }

  if (!hasSeverityJson) {
    const nk = normalizeIssue(canonicalIssue);
    if (rollupIssueNormKeys.has(nk)) {
      const b = Math.min(1, 0.55);
      return 1 - b;
    }
    return 1;
  }

  return 1;
}


/** Deduped display strings for detected issues (preserves first-seen label casing). */
export function getDetectedIssueDisplayStrings(client: Client): string[] {
  const raw = client.allIssues;
  if (!raw) return [];
  const list = Array.isArray(raw)
    ? raw.map((x) => String(x).trim()).filter(Boolean)
    : String(raw)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const issue of list) {
    const key = normalizeIssue(issue);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(issue.trim());
  }
  return out;
}
