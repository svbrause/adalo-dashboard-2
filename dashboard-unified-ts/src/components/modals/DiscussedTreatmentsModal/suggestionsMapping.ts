/**
 * Treatment Interests (suggestions) from Suggestions-Grid view CSV.
 * Name = suggestion label (shown as "Treatment Interest" in UI).
 * Each suggestion maps to one area; issues are listed for reference (issue→suggestion is in issueMapping).
 */

export const SUGGESTION_TO_AREA: Record<string, string> = {
  "Contour Cheeks": "Cheeks",
  "Improve Cheek Definition": "Cheeks",
  "Rejuvenate Upper Eyelids": "Eyes",
  "Rejuvenate Lower Eyelids": "Eyes",
  "Balance Brows": "Forehead",
  "Balance Forehead": "Forehead",
  "Contour Jawline": "Jawline",
  "Contour Neck": "Jawline",
  "Balance Jawline": "Jawline",
  "Hydrate Lips": "Lips",
  "Balance Lips": "Lips",
  "Balance Nose": "Nose",
  "Hydrate Skin": "Skin",
  "Tighten Skin Laxity": "Skin",
  "Shadow Correction": "Skin",
  "Exfoliate Skin": "Skin",
  "Smoothen Fine Lines": "Skin",
  "Even Skin Tone": "Skin",
  "Fade Scars": "Skin",
};

/** All Treatment Interest names (suggestions), sorted for the selector. */
export const ALL_TREATMENT_INTERESTS = Object.keys(SUGGESTION_TO_AREA).sort(
  (a, b) => a.localeCompare(b)
);
