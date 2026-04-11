import type { FilterState } from "../types";

/** Icons align with list status key: ⊖ not started, ◷ pending, ✓ ready / complete. */
export const FILTER_OPT = {
  notStarted: "\u2296 ",
  /** Clock — used for “pending” analysis and similar middle states. */
  pending: "\u25F7 ",
  complete: "\u2713 ",
} as const;

/**
 * Human-readable tags for the collapsed “active filters” bar (non-empty only).
 */
export function getActiveFilterTags(filters: FilterState): string[] {
  const f = filters;
  const tags: string[] = [];

  const src = String(f.source ?? "").trim();
  if (src) tags.push(`Source: ${src}`);

  if (f.ageMin !== null || f.ageMax !== null) {
    const lo = f.ageMin != null ? String(f.ageMin) : "…";
    const hi = f.ageMax != null ? String(f.ageMax) : "…";
    tags.push(`Age: ${lo}–${hi}`);
  }

  if (f.analysisStatus) {
    const analysisLabel: Record<string, string> = {
      "Not started": "Not started",
      "Pending": "Pending",
      "Ready for Review": "Ready for review",
      "Patient Reviewed": "Patient reviewed",
    };
    tags.push(
      `Analysis: ${analysisLabel[f.analysisStatus] ?? f.analysisStatus}`,
    );
  }
  if (f.skinAnalysisState === "has") {
    tags.push("Skin analysis: has data");
  } else if (f.skinAnalysisState === "blank") {
    tags.push("Skin analysis: not started");
  }
  if (f.treatmentFinderState === "has") {
    tags.push("Treatment finder: has activity");
  } else if (f.treatmentFinderState === "blank") {
    tags.push("Treatment finder: not started");
  }
  if (f.treatmentPlanState === "has") {
    tags.push("Plan: complete");
  } else if (f.treatmentPlanState === "blank") {
    tags.push("Plan: not started");
  }
  if (f.quizState === "has") {
    tags.push("Quiz: complete");
  } else if (f.quizState === "blank") {
    tags.push("Quiz: not started");
  }

  const loc = String(f.locationName ?? "").trim();
  if (loc) tags.push(`Location: ${loc}`);
  const prov = String(f.providerName ?? "").trim();
  if (prov) tags.push(`Provider: ${prov}`);

  return tags;
}
