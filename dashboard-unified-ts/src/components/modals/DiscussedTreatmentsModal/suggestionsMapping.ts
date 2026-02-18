/**
 * Treatment Interests (suggestions) from Suggestions-Grid view CSV.
 * Name = suggestion label (shown as "Treatment Interest" in UI).
 * Each suggestion maps to one area; issues are from CSV "Issues" column for feature breakdown subcategories.
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

/** Suggestion name → list of issue display names (from Suggestions-Grid CSV Issues column). Used for feature breakdown by subcategory. */
export const SUGGESTION_TO_ISSUES: Record<string, string[]> = {
  "Contour Cheeks": ["Heavy Lateral Cheek"],
  "Improve Cheek Definition": [
    "Mid Cheek Flattening",
    "Cheekbone - Not Prominent",
    "Lower Cheeks - Volume Depletion",
  ],
  "Rejuvenate Upper Eyelids": [
    "Excess Upper Eyelid Skin",
    "Upper Eyelid Droop",
    "Upper Eye Hollow",
  ],
  "Rejuvenate Lower Eyelids": [
    "Lower Eyelid - Excess Skin",
    "Lower Eyelid Bags",
    "Under Eye Hollow",
    "Lower Eyelid Sag",
    "Under Eye Dark Circles",
  ],
  "Balance Brows": ["Brow Asymmetry", "Brow Ptosis"],
  "Balance Forehead": ["Flat Forehead", "Temporal Hollow"],
  "Contour Jawline": [
    "Excess/Submental Fullness",
    "Jowls",
    "Ill-Defined Jawline",
    "Masseter Hypertrophy",
    "Over-Projected Chin",
  ],
  "Contour Neck": ["Loose Neck Skin", "Platysmal Bands"],
  "Balance Jawline": [
    "Asymmetric Jawline",
    "Asymmetric Chin",
    "Prejowl Sulcus",
    "Retruded Chin",
  ],
  "Hydrate Lips": ["Dry Lips"],
  "Balance Lips": [
    "Asymmetric Lips",
    "Gummy Smile",
    "Thin Lips",
    "Lip Thinning When Smiling",
    "Lacking Philtral Column",
    "Long Philtral Column",
  ],
  "Balance Nose": [
    "Dorsal Hump",
    "Droopy Tip",
    "Tip Droop When Smiling",
    "Crooked Nose",
  ],
  "Hydrate Skin": ["Dry Skin"],
  "Tighten Skin Laxity": ["Crepey Skin"],
  "Shadow Correction": ["Nasolabial Folds", "Marionette Lines"],
  "Exfoliate Skin": ["Blackheads", "Whiteheads"],
  "Smoothen Fine Lines": [
    "Bunny Lines",
    "Crow's Feet Wrinkles",
    "Forehead Wrinkles",
    "Glabella Wrinkles",
    "Under Eye Wrinkles",
    "Perioral Wrinkles",
    "Neck Lines",
  ],
  "Even Skin Tone": ["Dark Spots", "Red Spots", "Rosacea [DEPRECATED]"],
  "Fade Scars": ["Scars"],
};

/** All Treatment Interest names (suggestions), sorted for the selector. */
export const ALL_TREATMENT_INTERESTS = Object.keys(SUGGESTION_TO_AREA).sort(
  (a, b) => a.localeCompare(b)
);
