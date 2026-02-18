/**
 * Issue → Concern / General Category / Areas mapping
 * Derived from issue-to-concern-mapping.csv and ISSUE_TO_CONCERN_MAPPING.md.
 * Maps dashboard display issue names (Airtable "Name (from All Issues)") to the
 * external taxonomy: Concern(s), General Category (5), and Areas.
 * Use for LLM payloads, filters, or future 5-category view without changing
 * the existing 3-category framework in analysisOverviewConfig.
 */

export type GeneralCategory =
  | "Skin Health"
  | "Volume Loss"
  | "Proportions"
  | "Skin Laxity"
  | "Excess Fat";

export interface ConcernMappingRow {
  concernId: string;
  concernName: string;
  generalCategory: GeneralCategory;
  areas: string[];
}

export interface IssueConcernMapping {
  /** CSV issue key (slug) */
  issueSlug: string;
  /** One or more concerns (e.g. ill-defined-jawline → Skin Laxity + Excess Fat) */
  concerns: ConcernMappingRow[];
  /** All areas for this issue (union if multi-concern) */
  areas: string[];
  /** Primary general category (first concern's category) */
  generalCategory: GeneralCategory;
}

/** Dashboard display name → CSV Issue slug (for issues we use in CATEGORIES/AREAS) */
const DISPLAY_NAME_TO_SLUG: Record<string, string> = {
  "Forehead Wrinkles": "forehead-lines",
  "Crow's Feet Wrinkles": "crow's-feet",
  "Glabella Wrinkles": "glabella",
  "Under Eye Wrinkles": "under-eye-wrinkles",
  "Perioral Wrinkles": "perioral-wrinkles",
  "Bunny Lines": "bunny-lines",
  "Neck Lines": "neck-lines",
  "Dry Skin": "dry-skin",
  Whiteheads: "whiteheads",
  Blackheads: "blackheads",
  "Crepey Skin": "crepey-skin",
  "Dark Spots": "dark-spots",
  "Red Spots": "red-spots",
  Scars: "scars",
  "Under Eye Dark Circles": "under-eye-dark-circles",
  "Under Eye Hollow": "under-eye-hollows",
  "Upper Eye Hollow": "upper-eye-hollow",
  "Lower Eyelid Bags": "lower-eyelid-bags",
  "Mid Cheek Flattening": "mid-cheek-flattening",
  "Cheekbone - Not Prominent": "cheekbone-not-prominent",
  "Temporal Hollow": "temporal-hollow",
  "Loose Neck Skin": "loose-neck-skin",
  "Platysmal Bands": "platysmal-bands",
  "Excess/Submental Fullness": "submental-fullness",
  "Nasolabial Folds": "nasolabial-folds",
  "Marionette Lines": "marionette-lines",
  Jowls: "jowls",
  "Lower Cheeks - Volume Depletion": "lower-cheeks-volume-depletion",
  "Prejowl Sulcus": "prejowl-sulcus",
  "Brow Asymmetry": "brow-asymmetry",
  "Brow Ptosis": "brow-ptosis",
  "Excess Upper Eyelid Skin": "excess-upper-eyelid-skin",
  "Lower Eyelid - Excess Skin": "excess-lower-eyelid-skin",
  "Upper Eyelid Droop": "upper-eyelid-droop",
  "Lower Eyelid Sag": "lower-eyelid-sag",
  "Ill-Defined Jawline": "ill-defined-jawline",
  "Asymmetric Jawline": "asymmetric-jawline",
  "Masseter Hypertrophy": "masseter-hypertrophy",
  "Retruded Chin": "retruded-chin",
  "Over-Projected Chin": "over-projected-chin",
  "Asymmetric Chin": "asymmetric-chin",
  "Crooked Nose": "crooked-nose",
  "Droopy Tip": "droopy-tip",
  "Dorsal Hump": "dorsal-hump",
  "Tip Droop When Smiling": "tip-droop-when-smiling",
  "Thin Lips": "thin-lips",
  "Lacking Philtral Column": "lacking-philtral-column",
  "Long Philtral Column": "long-philtral-column",
  "Gummy Smile": "gummy-smile",
  "Asymmetric Lips": "asymmetric-lips",
  "Dry Lips": "dry-lips",
  "Lip Thinning When Smiling": "lip-thinning-when-smiling",
  "Flat Forehead": "flat-forehead",
  "Heavy Lateral Cheek": "heavy-lateral-cheek",
  Rosacea: "rosacea",
};

/** Slug → aggregated concern/areas (from CSV; one issue can have multiple concern rows) */
const SLUG_TO_MAPPING: Map<string, IssueConcernMapping> = (() => {
  const rows: Array<{ issue: string; concernId: string; concernName: string; generalCategory: GeneralCategory; areas: string[] }> = [
    { issue: "11s", concernId: "fine-lines-wrinkles", concernName: "Fine Lines & Wrinkles", generalCategory: "Skin Health", areas: ["Forehead"] },
    { issue: "forehead-lines", concernId: "fine-lines-wrinkles", concernName: "Fine Lines & Wrinkles", generalCategory: "Skin Health", areas: ["Forehead"] },
    { issue: "crow's-feet", concernId: "fine-lines-wrinkles", concernName: "Fine Lines & Wrinkles", generalCategory: "Skin Health", areas: ["Eyes"] },
    { issue: "glabella", concernId: "fine-lines-wrinkles", concernName: "Fine Lines & Wrinkles", generalCategory: "Skin Health", areas: ["Forehead"] },
    { issue: "under-eye-wrinkles", concernId: "fine-lines-wrinkles", concernName: "Fine Lines & Wrinkles", generalCategory: "Skin Health", areas: ["Eyes"] },
    { issue: "perioral-wrinkles", concernId: "fine-lines-wrinkles", concernName: "Fine Lines & Wrinkles", generalCategory: "Skin Health", areas: ["Lips"] },
    { issue: "bunny-lines", concernId: "fine-lines-wrinkles", concernName: "Fine Lines & Wrinkles", generalCategory: "Skin Health", areas: ["Nose"] },
    { issue: "neck-lines", concernId: "fine-lines-wrinkles", concernName: "Fine Lines & Wrinkles", generalCategory: "Skin Health", areas: ["Neck"] },
    { issue: "marionette-lines", concernId: "fine-lines-wrinkles", concernName: "Fine Lines & Wrinkles", generalCategory: "Skin Health", areas: ["Lips", "Jawline"] },
    { issue: "nasolabial-folds", concernId: "fine-lines-wrinkles", concernName: "Fine Lines & Wrinkles", generalCategory: "Skin Health", areas: ["Cheeks", "Lips"] },
    { issue: "dry-skin", concernId: "skin-texture", concernName: "Skin Texture", generalCategory: "Skin Health", areas: ["Full Face"] },
    { issue: "whiteheads", concernId: "skin-texture", concernName: "Skin Texture", generalCategory: "Skin Health", areas: ["Full Face"] },
    { issue: "blackheads", concernId: "skin-texture", concernName: "Skin Texture", generalCategory: "Skin Health", areas: ["Full Face"] },
    { issue: "crepey-skin", concernId: "skin-texture", concernName: "Skin Texture", generalCategory: "Skin Health", areas: ["Full Face"] },
    { issue: "dark-spots", concernId: "pigmentation", concernName: "Pigmentation", generalCategory: "Skin Health", areas: ["Full Face"] },
    { issue: "red-spots", concernId: "pigmentation", concernName: "Pigmentation", generalCategory: "Skin Health", areas: ["Full Face"] },
    { issue: "scars", concernId: "skin-texture", concernName: "Skin Texture", generalCategory: "Skin Health", areas: ["Full Face"] },
    { issue: "under-eye-dark-circles", concernId: "pigmentation", concernName: "Pigmentation", generalCategory: "Skin Health", areas: ["Eyes"] },
    { issue: "under-eye-hollows", concernId: "volume-loss", concernName: "Volume Loss", generalCategory: "Volume Loss", areas: ["Eyes"] },
    { issue: "upper-eye-hollow", concernId: "volume-loss", concernName: "Volume Loss", generalCategory: "Volume Loss", areas: ["Eyes"] },
    { issue: "lower-eyelid-bags", concernId: "skin-laxity", concernName: "Skin Laxity", generalCategory: "Skin Laxity", areas: ["Eyes"] },
    { issue: "mid-cheek-flattening", concernId: "volume-loss", concernName: "Volume Loss", generalCategory: "Volume Loss", areas: ["Cheeks"] },
    { issue: "cheekbone-not-prominent", concernId: "volume-loss", concernName: "Volume Loss", generalCategory: "Volume Loss", areas: ["Cheeks"] },
    { issue: "temporal-hollow", concernId: "volume-loss", concernName: "Volume Loss", generalCategory: "Volume Loss", areas: ["Forehead"] },
    { issue: "loose-neck-skin", concernId: "skin-laxity", concernName: "Skin Laxity", generalCategory: "Skin Laxity", areas: ["Neck"] },
    { issue: "platysmal-bands", concernId: "volume-loss", concernName: "Volume Loss", generalCategory: "Volume Loss", areas: ["Neck"] },
    { issue: "submental-fullness", concernId: "excess-fat", concernName: "Excess Fat", generalCategory: "Excess Fat", areas: ["Chin", "Jawline"] },
    { issue: "jowls", concernId: "skin-laxity", concernName: "Skin Laxity", generalCategory: "Skin Laxity", areas: ["Jawline"] },
    { issue: "lower-cheeks-volume-depletion", concernId: "volume-loss", concernName: "Volume Loss", generalCategory: "Volume Loss", areas: ["Cheeks"] },
    { issue: "prejowl-sulcus", concernId: "skin-laxity", concernName: "Skin Laxity", generalCategory: "Skin Laxity", areas: ["Jawline"] },
    { issue: "brow-asymmetry", concernId: "facial-asymmetry", concernName: "Facial Asymmetry", generalCategory: "Proportions", areas: ["Forehead", "Eyes"] },
    { issue: "brow-ptosis", concernId: "skin-laxity", concernName: "Skin Laxity", generalCategory: "Skin Laxity", areas: ["Forehead", "Eyes"] },
    { issue: "excess-upper-eyelid-skin", concernId: "skin-laxity", concernName: "Skin Laxity", generalCategory: "Skin Laxity", areas: ["Eyes"] },
    { issue: "excess-lower-eyelid-skin", concernId: "skin-laxity", concernName: "Skin Laxity", generalCategory: "Skin Laxity", areas: ["Eyes"] },
    { issue: "upper-eyelid-droop", concernId: "skin-laxity", concernName: "Skin Laxity", generalCategory: "Skin Laxity", areas: ["Eyes"] },
    { issue: "lower-eyelid-sag", concernId: "skin-laxity", concernName: "Skin Laxity", generalCategory: "Skin Laxity", areas: ["Eyes"] },
    { issue: "ill-defined-jawline", concernId: "skin-laxity", concernName: "Skin Laxity", generalCategory: "Skin Laxity", areas: ["Jawline"] },
    { issue: "ill-defined-jawline", concernId: "excess-fat", concernName: "Excess Fat", generalCategory: "Excess Fat", areas: ["Jawline"] },
    { issue: "asymmetric-jawline", concernId: "facial-asymmetry", concernName: "Facial Asymmetry", generalCategory: "Proportions", areas: ["Jawline"] },
    { issue: "masseter-hypertrophy", concernId: "facial-structure", concernName: "Facial Structure", generalCategory: "Proportions", areas: ["Jawline"] },
    { issue: "retruded-chin", concernId: "facial-structure", concernName: "Facial Structure", generalCategory: "Proportions", areas: ["Chin"] },
    { issue: "over-projected-chin", concernId: "facial-structure", concernName: "Facial Structure", generalCategory: "Proportions", areas: ["Chin"] },
    { issue: "asymmetric-chin", concernId: "facial-asymmetry", concernName: "Facial Asymmetry", generalCategory: "Proportions", areas: ["Chin"] },
    { issue: "crooked-nose", concernId: "facial-structure", concernName: "Facial Structure", generalCategory: "Proportions", areas: ["Nose"] },
    { issue: "droopy-tip", concernId: "facial-structure", concernName: "Facial Structure", generalCategory: "Proportions", areas: ["Nose"] },
    { issue: "dorsal-hump", concernId: "facial-structure", concernName: "Facial Structure", generalCategory: "Proportions", areas: ["Nose"] },
    { issue: "tip-droop-when-smiling", concernId: "facial-structure", concernName: "Facial Structure", generalCategory: "Proportions", areas: ["Nose"] },
    { issue: "thin-lips", concernId: "facial-structure", concernName: "Facial Structure", generalCategory: "Proportions", areas: ["Lips"] },
    { issue: "lacking-philtral-column", concernId: "volume-loss", concernName: "Volume Loss", generalCategory: "Volume Loss", areas: ["Lips"] },
    { issue: "long-philtral-column", concernId: "facial-structure", concernName: "Facial Structure", generalCategory: "Proportions", areas: ["Lips"] },
    { issue: "gummy-smile", concernId: "volume-loss", concernName: "Volume Loss", generalCategory: "Volume Loss", areas: ["Lips"] },
    { issue: "asymmetric-lips", concernId: "facial-asymmetry", concernName: "Facial Asymmetry", generalCategory: "Proportions", areas: ["Lips"] },
    { issue: "dry-lips", concernId: "skin-texture", concernName: "Skin Texture", generalCategory: "Skin Health", areas: ["Lips"] },
    { issue: "lip-thinning-when-smiling", concernId: "volume-loss", concernName: "Volume Loss", generalCategory: "Volume Loss", areas: ["Lips"] },
  ];

  const map = new Map<string, IssueConcernMapping>();
  for (const r of rows) {
    const existing = map.get(r.issue);
    const row: ConcernMappingRow = { concernId: r.concernId, concernName: r.concernName, generalCategory: r.generalCategory, areas: r.areas };
    if (!existing) {
      map.set(r.issue, {
        issueSlug: r.issue,
        concerns: [row],
        areas: [...r.areas],
        generalCategory: r.generalCategory,
      });
    } else {
      if (!existing.concerns.some((c) => c.concernId === r.concernId)) existing.concerns.push(row);
      const areaSet = new Set([...existing.areas, ...r.areas]);
      existing.areas = Array.from(areaSet);
    }
  }
  return map;
})();

/**
 * Normalize display name for lookup (trim, collapse spaces; match DISPLAY_NAME_TO_SLUG keys).
 */
function normalizeDisplayName(name: string): string {
  return name.trim();
}

/**
 * Get concern/category/areas for a dashboard issue display name (e.g. from Airtable).
 * Returns null if the issue is not in the mapping.
 */
export function getConcernMapping(displayName: string): IssueConcernMapping | null {
  const key = normalizeDisplayName(displayName);
  const slug = DISPLAY_NAME_TO_SLUG[key] ?? key.toLowerCase().replace(/\s+/g, "-").replace(/['']/g, "");
  return SLUG_TO_MAPPING.get(slug) ?? SLUG_TO_MAPPING.get(slug.replace(/\s+/g, "-")) ?? null;
}

/**
 * Get the primary general category for an issue (5-category taxonomy).
 * Falls back to null if not in mapping.
 */
export function getGeneralCategoryForIssue(displayName: string): GeneralCategory | null {
  const m = getConcernMapping(displayName);
  return m ? m.generalCategory : null;
}

/**
 * Get the primary concern name for an issue (e.g. "Pigmentation", "Skin Texture", "Fine Lines & Wrinkles").
 * More specific than general category; use for feature breakdown labels to avoid repeating "Skin Health".
 */
export function getConcernNameForIssue(displayName: string): string | null {
  const m = getConcernMapping(displayName);
  const first = m?.concerns?.[0];
  return first ? first.concernName : null;
}

/**
 * Get areas for an issue from the external taxonomy (may include Chin, Neck, Full Face).
 * Returns empty array if not in mapping.
 */
export function getAreasForIssue(displayName: string): string[] {
  const m = getConcernMapping(displayName);
  return m ? m.areas : [];
}

/** All 5 general categories from the external mapping (for filters or future UI). */
export const GENERAL_CATEGORIES: GeneralCategory[] = [
  "Skin Health",
  "Volume Loss",
  "Proportions",
  "Skin Laxity",
  "Excess Fat",
];

export interface BreakdownRowByCategory {
  label: string;
  issues: string[];
}

/**
 * Group issue display names by general category (Skin Health, Volume Loss, etc.) for feature breakdown.
 * Unmapped issues go under "Other". Order: GENERAL_CATEGORIES then Other.
 */
export function groupIssuesByCategory(issueDisplayNames: string[]): BreakdownRowByCategory[] {
  const byCategory = new Map<string, string[]>();
  const other: string[] = [];
  for (const name of issueDisplayNames) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const category = getGeneralCategoryForIssue(trimmed);
    if (category) {
      const list = byCategory.get(category) ?? [];
      if (!list.includes(trimmed)) list.push(trimmed);
      byCategory.set(category, list);
    } else {
      if (!other.includes(trimmed)) other.push(trimmed);
    }
  }
  const result: BreakdownRowByCategory[] = [];
  for (const cat of GENERAL_CATEGORIES) {
    const issues = byCategory.get(cat);
    if (issues?.length) result.push({ label: cat, issues });
  }
  if (other.length) result.push({ label: "Other", issues: other });
  return result;
}

/**
 * Group issue display names by concern name (e.g. "Pigmentation", "Skin Texture", "Fine Lines & Wrinkles")
 * for feature breakdown. More specific than general category so we avoid repeating "Skin Health" on every skin suggestion.
 * Unmapped issues go under "Other".
 */
export function groupIssuesByConcern(issueDisplayNames: string[]): BreakdownRowByCategory[] {
  const byConcern = new Map<string, string[]>();
  const other: string[] = [];
  for (const name of issueDisplayNames) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const concernName = getConcernNameForIssue(trimmed);
    if (concernName) {
      const list = byConcern.get(concernName) ?? [];
      if (!list.includes(trimmed)) list.push(trimmed);
      byConcern.set(concernName, list);
    } else {
      if (!other.includes(trimmed)) other.push(trimmed);
    }
  }
  const result: BreakdownRowByCategory[] = [];
  const sortedConcerns = Array.from(byConcern.keys()).sort((a, b) => a.localeCompare(b));
  for (const label of sortedConcerns) {
    const issues = byConcern.get(label);
    if (issues?.length) result.push({ label, issues });
  }
  if (other.length) result.push({ label: "Other", issues: other });
  return result;
}
