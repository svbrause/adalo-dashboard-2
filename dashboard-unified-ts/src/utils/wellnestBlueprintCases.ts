import { WELLNEST_CURATED_BLUEPRINT_CASES } from "../data/wellnestCuratedBlueprintCases";
import type { BlueprintCasePhoto } from "./postVisitBlueprintCases";

/**
 * Returns only the curated Wellnest cases (real patient photos).
 * Returns empty when no real photos exist — the "Results like yours" section
 * is omitted automatically when the list is empty.
 */
export function buildWellnestBlueprintCasePhotos(): BlueprintCasePhoto[] {
  const seenId = new Set<string>();
  const out: BlueprintCasePhoto[] = [];
  for (const p of WELLNEST_CURATED_BLUEPRINT_CASES) {
    if (seenId.has(p.id)) continue;
    seenId.add(p.id);
    out.push(p);
  }
  return out;
}
