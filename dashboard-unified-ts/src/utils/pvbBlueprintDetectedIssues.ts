import { normalizeIssue } from "../config/analysisOverviewConfig";

/** Build the same normalized issue set as Analysis Overview from blueprint snapshot labels. */
export function normalizedDetectedIssuesFromLabels(labels: string[]): Set<string> {
  const set = new Set<string>();
  for (const label of labels) {
    const k = normalizeIssue(label);
    if (k) set.add(k);
  }
  return set;
}
