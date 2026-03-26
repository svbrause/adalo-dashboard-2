/**
 * Wellnest MD — wellness / peptide offerings for provider code `Wellnest1300`.
 * Sourced from "Dr Reddy Treatment Offering Details" CSV + aligned with skin-type-react wellness ids where applicable.
 * Educational / plan-building only — not medical advice.
 */

export const WELLNEST_PROVIDER_CODE = "Wellnest1300";

export type WellnestOffering = {
  /** Value stored as DiscussedItem.treatment (and chapter key) */
  treatmentName: string;
  /** Broad bucket for recommender grouping */
  category: string;
  addresses: string;
  demographics: string;
  delivery: string;
  /** Raw pricing string from sheet (display + light parse) */
  pricing: string;
  notes: string;
  resultsTimeline: string;
  /** Optional id aligned with skin-type-react wellnessQuiz ids for asset cross-ref */
  wellnessQuizId?: string;
};

/**
 * Regulatory blurb — show in patient-facing materials only as approved by counsel.
 */
export const WELLNEST_REGULATORY_NOTICE =
  "These compounds are investigational research peptides. They are not FDA-approved for general therapeutic use unless otherwise specified. Content is for scientific and educational discussion only.";

export const WELLNEST_OFFERINGS: WellnestOffering[] = [
  {
    treatmentName: "BPC-157",
    category: "Recovery, inflammation & gut",
    addresses:
      "Soft tissue repair support, tendon/ligament recovery, chronic GI issues, GI lining support, anti-inflammatory properties",
    demographics:
      "Adults 30+ with contact sports, intense workouts, or active lifestyle; often 40+ male and female",
    delivery: "SC injection preferred; oral and nasal spray available",
    pricing: "$250",
    notes:
      "5 weeks supply; ready-to-use, prepared under strict aseptic precautions to avoid cross-contamination",
    resultsTimeline: "2–8 weeks",
    wellnessQuizId: "bpc-157",
  },
  {
    treatmentName: "Thymosin Beta-4 (TB-500)",
    category: "Musculoskeletal injury",
    addresses:
      "Accelerated muscle recovery, reduced inflammation, improved mobility",
    demographics:
      "Adults 30+ with contact sports, intense workouts, or active lifestyle; often 40+",
    delivery: "SC injection preferred; nasal spray available",
    pricing: "$200",
    notes:
      "Ready-to-use, prepared under strict aseptic precautions to avoid cross-contamination",
    resultsTimeline: "1–8 weeks",
    wellnessQuizId: "tb-500",
  },
  {
    treatmentName: "CJC-1295",
    category: "Energy & recovery",
    addresses: "Low energy, poor recovery, metabolic optimization",
    demographics: "Poor muscle mass gain / toning, men and women",
    delivery: "SC injection",
    pricing: "$250",
    notes: "5 weeks minimum",
    resultsTimeline: "4–10 weeks",
    wellnessQuizId: "cjc-1295",
  },
  {
    treatmentName: "Ipamorelin",
    category: "Sleep & muscle",
    addresses:
      "Selective ghrelin receptor agonist, stimulates natural GH release, minimal cortisol elevation, lean mass preservation",
    demographics: "Aged 40+, both sexes",
    delivery: "SC injection only",
    pricing: "$250",
    notes: "5 weeks",
    resultsTimeline: "4–10 weeks",
    wellnessQuizId: "ipamorelin",
  },
  {
    treatmentName: "Semax",
    category: "Cognitive",
    addresses: "Brain fog, focus, cognitive decline",
    demographics: "Aged 30+",
    delivery: "SC injection; nasal spray available",
    pricing: "$300",
    notes: "10 weeks supply",
    resultsTimeline: "8–16 weeks",
    wellnessQuizId: "semax",
  },
  {
    treatmentName: "Selank",
    category: "Stress & mood",
    addresses: "Anxiolytic effects, improved cognition, mood balance",
    demographics: "Aged 30+, both sexes",
    delivery: "SC injection ideal",
    pricing: "$300–$500",
    notes: "5–10 weeks",
    resultsTimeline: "6–16 weeks",
    wellnessQuizId: "selank",
  },
  {
    treatmentName: "P-21",
    category: "Cognitive",
    addresses: "Synapse regeneration",
    demographics: "Aged 60+",
    delivery: "SC injection",
    pricing: "$500",
    notes: "10 weeks",
    resultsTimeline: "3–6 months",
    wellnessQuizId: "p21",
  },
  {
    treatmentName: "Pinealon",
    category: "Cognitive",
    addresses: "Brain oxidative defense, cognitive decline",
    demographics: "Aged 60+",
    delivery: "SC injection",
    pricing: "$500",
    notes: "10–16 weeks",
    resultsTimeline: "3–6 months",
    wellnessQuizId: "pinealon",
  },
  {
    treatmentName: "GHRP-2 / GHRP-6",
    category: "Muscle & composition",
    addresses: "Recovery, body composition",
    demographics: "Aged 35+",
    delivery: "SC injection",
    pricing: "$250",
    notes: "5 weeks",
    resultsTimeline: "2–5 months",
    wellnessQuizId: "ghrp-2-6",
  },
  {
    treatmentName: "IGF-1 LR3",
    category: "Muscle & composition",
    addresses: "Muscle growth support",
    demographics: "Aged 35+",
    delivery: "SC injection",
    pricing: "$250",
    notes: "5 weeks",
    resultsTimeline: "2–5 months",
    wellnessQuizId: "igf-1-lr3",
  },
  {
    treatmentName: "GHK-Cu",
    category: "Skin",
    addresses: "Skin firmness, laxity, elastin stimulation",
    demographics: "Aged 40+",
    delivery: "SC injection or topical peptide cream",
    pricing: "$250–$350",
    notes: "5–8 weeks",
    resultsTimeline: "2–3 months",
    wellnessQuizId: "ghk-cu",
  },
  {
    treatmentName: "Melanotan 2",
    category: "Skin & tanning",
    addresses: "Melanin increase, libido (patient selection)",
    demographics: "Natural tanning peptide pathway; provider discretion",
    delivery: "SC injection",
    pricing: "$200+",
    notes: "5 weeks minimum",
    resultsTimeline: "3+ months",
    wellnessQuizId: "melanotan-2",
  },
  {
    treatmentName: "MK-677",
    category: "Bone & joint",
    addresses: "Osteoporosis, osteoarthritis, bone density decline prevention",
    demographics: "Often 65+",
    delivery: "SC injection",
    pricing: "$350–$600",
    notes: "5–10 weeks",
    resultsTimeline: "3+ months",
    wellnessQuizId: "mk-677",
  },
  {
    treatmentName: "Sermorelin",
    category: "Longevity & GH axis",
    addresses: "Physiologic GH stimulation, anti-aging interest",
    demographics: "Aged 40+",
    delivery: "SC injection",
    pricing: "$300–$500",
    notes: "5–10 weeks",
    resultsTimeline: "8–12 weeks",
    wellnessQuizId: "sermorelin",
  },
  {
    treatmentName: "Tesamorelin",
    category: "Metabolic & body composition",
    addresses: "Visceral fat excess, obesity adjunct therapy",
    demographics: "Aged 40+",
    delivery: "SC injection",
    pricing: "$500",
    notes: "5–10 weeks",
    resultsTimeline: "3+ months",
    wellnessQuizId: "tessamorelin",
  },
  {
    treatmentName: "Epitalon",
    category: "Longevity",
    addresses: "Cellular aging, metabolism reset",
    demographics: "Aged 40+",
    delivery: "SC injection",
    pricing: "$400–$500",
    notes: "5–10 weeks",
    resultsTimeline: "3+ months",
    wellnessQuizId: "epitalon",
  },
  {
    treatmentName: "AOD-9604",
    category: "Metabolic & body composition",
    addresses: "Fat metabolism, obesity adjunct therapy",
    demographics: "Aged 30+, both sexes",
    delivery: "SC injection",
    pricing: "$300–$500",
    notes: "1–2 months",
    resultsTimeline: "3+ months",
    wellnessQuizId: "aod-9604",
  },
  {
    treatmentName: "Cartalax",
    category: "Bone & joint",
    addresses: "Osteoarthritis, cartilage repair support",
    demographics: "Aged 50+",
    delivery: "SC injection",
    pricing: "$350–$500",
    notes: "5–10 weeks",
    resultsTimeline: "3+ months",
    wellnessQuizId: "cartalax",
  },
];

const offeringByName = new Map(
  WELLNEST_OFFERINGS.map((o) => [normalizeWellnestTreatmentKey(o.treatmentName), o]),
);

function normalizeWellnestTreatmentKey(name: string): string {
  return name.trim().toLowerCase();
}

export function isWellnestWellnessProviderCode(
  code: string | null | undefined,
): boolean {
  const c = (code ?? "").trim().toLowerCase();
  return c === WELLNEST_PROVIDER_CODE.toLowerCase();
}

export function getWellnestOfferingByTreatmentName(
  treatment: string | null | undefined,
): WellnestOffering | undefined {
  if (!treatment?.trim()) return undefined;
  return offeringByName.get(normalizeWellnestTreatmentKey(treatment));
}

/** Top-level treatment picker options for recommender / plan (one row per offering). */
export function getWellnestTreatmentOptionNames(): string[] {
  return WELLNEST_OFFERINGS.map((o) => o.treatmentName);
}

/**
 * Product / delivery line items for the second dropdown (optional detail).
 */
export function getWellnestProductOptionsForTreatment(
  treatment: string | undefined,
): string[] {
  const o = getWellnestOfferingByTreatmentName(treatment);
  if (!o) return [];
  const parts = o.delivery
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const base = parts.length ? parts : [o.delivery.trim()].filter(Boolean);
  return [...base, "Other"];
}

/** Meta for blueprint chapters + checkout fallbacks */
export function getWellnestPeptideMeta(treatment: string): {
  longevity?: string;
  downtime?: string;
  downtimeFactLabel?: string;
  notes?: string;
  priceRange?: string;
} | null {
  const o = getWellnestOfferingByTreatmentName(treatment);
  if (!o) return null;
  return {
    longevity: o.resultsTimeline,
    downtime: o.delivery,
    downtimeFactLabel: "Delivery",
    notes: o.notes,
    priceRange: o.pricing,
  };
}

/** Parse a conservative numeric price for checkout totals (min of range). */
export function parseWellnestPriceMin(pricing: string): number {
  const s = pricing.replace(/\s/g, "");
  const matches = s.match(/\$[\d,]+(?:\.\d+)?/g);
  if (!matches?.length) return 0;
  const nums = matches.map((m) => {
    const n = parseFloat(m.replace(/[$,]/g, ""));
    return Number.isFinite(n) ? n : 0;
  });
  const positives = nums.filter((n) => n > 0);
  return positives.length ? Math.min(...positives) : 0;
}
