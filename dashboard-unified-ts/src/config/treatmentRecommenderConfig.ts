/**
 * Treatment Recommender – filter options and helpers.
 * Used by TreatmentRecommenderFilters and by-treatment / by-suggestion screens.
 */

import { ASSESSMENT_FINDINGS } from "../components/modals/DiscussedTreatmentsModal/constants";
import { getGoalRegionTreatmentsForFinding } from "../components/modals/DiscussedTreatmentsModal/utils";
import { SUGGESTION_TO_AREA } from "../components/modals/DiscussedTreatmentsModal/suggestionsMapping";

/** "What are you here for?" – Tox (neurotoxin) or Filler */
export type HereForOption = "Tox" | "Filler";

export const HERE_FOR_OPTIONS: HereForOption[] = ["Tox", "Filler"];

/** Findings that map to Neurotoxin (for Tox filter). */
export const FINDINGS_FOR_TOX: string[] = (() => {
  const set = new Set<string>();
  for (const finding of ASSESSMENT_FINDINGS) {
    const mapped = getGoalRegionTreatmentsForFinding(finding);
    if (mapped?.treatments.some((t) => t === "Neurotoxin")) set.add(finding);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
})();

/** Findings that map to Filler (for Filler filter). */
export const FINDINGS_FOR_FILLER: string[] = (() => {
  const set = new Set<string>();
  for (const finding of ASSESSMENT_FINDINGS) {
    const mapped = getGoalRegionTreatmentsForFinding(finding);
    if (mapped?.treatments.some((t) => t === "Filler")) set.add(finding);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
})();

/** Get findings list for "What is the client here to address?" based on hereFor. */
export function getFindingsOptionsForHereFor(hereFor: HereForOption | null): string[] {
  if (hereFor === "Tox") return FINDINGS_FOR_TOX;
  if (hereFor === "Filler") return FINDINGS_FOR_FILLER;
  return [...FINDINGS_FOR_TOX, ...FINDINGS_FOR_FILLER].filter(
    (f, i, arr) => arr.indexOf(f) === i
  ).sort((a, b) => a.localeCompare(b));
}

/** General concerns (multi-select). */
export const GENERAL_CONCERNS_OPTIONS = [
  "Skin texture",
  "Pigmentation",
  "Fine lines & wrinkles",
  "Volume loss",
  "Excess fullness",
  "Skin laxity",
  "Asymmetry",
  "Alignment",
  "Definition",
] as const;

export type GeneralConcern = (typeof GENERAL_CONCERNS_OPTIONS)[number];

/** Same day / add-on: when Yes, only show treatments that can be done same day. */
export const SAME_DAY_TREATMENTS = ["Skincare", "Neurotoxin", "Filler"] as const;

/** Region filter options (recommender-specific wording). */
export const REGION_FILTER_OPTIONS = [
  "Skin/Full face",
  "Forehead/Brows",
  "Eyes",
  "Cheeks",
  "Nose",
  "Lips",
  "Jawline",
  "Chin",
  "Neck",
] as const;

export type RegionFilterOption = (typeof REGION_FILTER_OPTIONS)[number];

/**
 * Airtable field names for area cropped photos (Patients table).
 * Used on the by-suggestion recommender to show the relevant cropped area per suggestion.
 * Adjust keys to match your Airtable "Area Cropped Photo" field names per area.
 */
export const AREA_CROPPED_PHOTO_FIELDS: Record<string, string> = {
  Eyes: "Area Cropped Photo - Eyes",
  Forehead: "Area Cropped Photo - Forehead",
  Cheeks: "Area Cropped Photo - Cheeks",
  Lips: "Area Cropped Photo - Lips",
  Jawline: "Area Cropped Photo - Jawline",
  Nose: "Area Cropped Photo - Nose",
  Skin: "Area Cropped Photo - Skin",
};

/** Map recommender region label → internal region/area names used by TreatmentPhotos and REGION_OPTIONS. */
export const REGION_FILTER_TO_INTERNAL: Record<string, string[]> = {
  "Skin/Full face": ["Other", "Skin", "Full Face"],
  "Forehead/Brows": ["Forehead", "Glabella"],
  Eyes: ["Under eyes", "Eyes"],
  Cheeks: ["Cheeks"],
  Nose: ["Other"],
  Lips: ["Lips"],
  Jawline: ["Jawline", "Nasolabial"],
  Chin: ["Jawline"],
  Neck: ["Jawline"],
};

/** Filter treatments by same-day when sameDayAddOn is true. */
export function filterTreatmentsBySameDay(
  treatmentNames: string[],
  sameDayAddOn: boolean
): string[] {
  if (!sameDayAddOn) return treatmentNames;
  return treatmentNames.filter((t) =>
    (SAME_DAY_TREATMENTS as readonly string[]).includes(t)
  );
}

/** Map recommender region label → area name(s) used by SUGGESTION_TO_AREA (Forehead, Eyes, Cheeks, etc.). */
const REGION_FILTER_TO_AREAS: Record<string, string[]> = {
  "Skin/Full face": ["Skin"],
  "Forehead/Brows": ["Forehead"],
  Eyes: ["Eyes"],
  Cheeks: ["Cheeks"],
  Nose: ["Nose"],
  Lips: ["Lips"],
  Jawline: ["Jawline"],
  Chin: ["Jawline"],
  Neck: ["Jawline"],
};

/** Filter suggestions by region: keep only suggestions whose SUGGESTION_TO_AREA matches selected regions. */
export function filterSuggestionsByRegion(
  suggestionNames: string[],
  selectedRegions: string[]
): string[] {
  if (selectedRegions.length === 0) return suggestionNames;
  const areaSet = new Set<string>();
  for (const r of selectedRegions) {
    const areas = REGION_FILTER_TO_AREAS[r];
    if (areas) areas.forEach((a) => areaSet.add(a));
  }
  return suggestionNames.filter((name) => {
    const area = SUGGESTION_TO_AREA[name];
    if (!area) return true;
    return areaSet.has(area);
  });
}

/** Get first internal region for a recommender region (for opening TreatmentPhotos). */
export function getInternalRegionForFilter(regionFilter: string): string {
  const internals = REGION_FILTER_TO_INTERNAL[regionFilter];
  if (internals?.length) return internals[0];
  return regionFilter;
}

/** Default filter state for the recommender. */
export interface TreatmentRecommenderFilterState {
  hereFor: HereForOption | null;
  findingsToAddress: string[];
  generalConcerns: GeneralConcern[];
  sameDayAddOn: boolean;
  region: RegionFilterOption[];
}

export const DEFAULT_RECOMMENDER_FILTER_STATE: TreatmentRecommenderFilterState = {
  hereFor: null,
  findingsToAddress: [],
  generalConcerns: [],
  sameDayAddOn: false,
  region: [],
};
