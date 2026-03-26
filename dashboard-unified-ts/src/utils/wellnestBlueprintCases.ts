import type { DiscussedItem } from "../types";
import { WELLNEST_CURATED_BLUEPRINT_CASES } from "../data/wellnestCuratedBlueprintCases";
import { getWellnestOfferingByTreatmentName } from "../data/wellnestOfferings";
import { getWellnestRecommenderImageUrl } from "../data/wellnestRecommenderPresentation";
import {
  photoMatchesPlanTreatment,
  type BlueprintCasePhoto,
} from "./postVisitBlueprintCases";

function normTreatment(s: string): string {
  return s.trim().toLowerCase();
}

function hasCuratedForTreatment(treatment: string): boolean {
  return WELLNEST_CURATED_BLUEPRINT_CASES.some((p) =>
    photoMatchesPlanTreatment(p, treatment),
  );
}

/**
 * Curated cases (see `wellnestCuratedBlueprintCases.ts`) plus, for each plan peptide
 * without curated rows, one synthetic Unsplash slide so the carousel is never empty.
 */
export function buildWellnestBlueprintCasePhotos(
  discussedItems: DiscussedItem[],
): BlueprintCasePhoto[] {
  const seenId = new Set<string>();
  const out: BlueprintCasePhoto[] = [];

  for (const p of WELLNEST_CURATED_BLUEPRINT_CASES) {
    if (seenId.has(p.id)) continue;
    seenId.add(p.id);
    out.push(p);
  }

  const seenTreatment = new Set<string>();
  for (const item of discussedItems) {
    const t = item.treatment?.trim();
    if (!t) continue;
    const k = normTreatment(t);
    if (seenTreatment.has(k)) continue;
    seenTreatment.add(k);

    const offering = getWellnestOfferingByTreatmentName(t);
    if (!offering) continue;

    if (hasCuratedForTreatment(t)) continue;

    const photoUrl = getWellnestRecommenderImageUrl(t);
    const addressesLead = offering.addresses.split(/[,;]/)[0]?.trim() ?? "";
    const slug = k.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "case";
    const id = `wellnest-illustrative-${slug}`;
    if (seenId.has(id)) continue;
    seenId.add(id);
    out.push({
      id,
      photoUrl,
      treatments: [t, offering.category],
      storyTitle: offering.category,
      caption: addressesLead
        ? `${addressesLead}. Illustrative image only; not a patient outcome.`
        : "Illustrative image only; not a patient outcome.",
    });
  }

  return out;
}
