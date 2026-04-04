/**
 * Shared helpers for Analysis Overview + Post-Visit Blueprint — same inputs as the overview modal.
 */
import type { Client } from "../types";
import { normalizeIssue } from "../config/analysisOverviewConfig";

export function getDetectedIssuesFromClient(client: Client): Set<string> {
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
