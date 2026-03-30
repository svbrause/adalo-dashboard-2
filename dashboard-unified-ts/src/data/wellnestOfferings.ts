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
  /** Stable id for Wellnest recommender browse chips (see `WELLNEST_BROWSE_GROUP_LABELS`) */
  browseGroup: string;
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
    browseGroup: "recovery-tissue",
    addresses:
      "Soft tissue repair support, Tendon/ligament recovery, Chronic GI issues, GI lining support, Anti-inflammatory properties",
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
    browseGroup: "recovery-tissue",
    addresses:
      "Accelerated muscle recovery, Reduced inflammation, Improved mobility",
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
    browseGroup: "gh-performance",
    addresses: "",
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
    browseGroup: "gh-performance",
    addresses:
      "Selective ghrelin receptor agonist, Stimulates natural GH release, Minimal cortisol elevation, Supports lean mass preservation",
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
    browseGroup: "cognition-mood",
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
    browseGroup: "cognition-mood",
    addresses: "Anxiolytic effects, Improved cognition, Mood balance",
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
    browseGroup: "cognition-mood",
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
    browseGroup: "cognition-mood",
    addresses: "Brain oxidative defence, cognitive decline",
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
    browseGroup: "gh-performance",
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
    browseGroup: "gh-performance",
    addresses: "Muscle growth",
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
    browseGroup: "skin-aesthetic",
    addresses: "Skin firmness, skin laxity and elastin stimulation",
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
    browseGroup: "skin-aesthetic",
    addresses: "Melanin increase, libido increase",
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
    browseGroup: "bone-joint",
    addresses: "Bone density decline prevention",
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
    browseGroup: "gh-performance",
    addresses: "Physiologic GH stimulation, Anti-aging interest",
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
    browseGroup: "metabolic-composition",
    addresses: "Obesity adjunct therapy",
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
    browseGroup: "longevity",
    addresses: "Metabolism reset",
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
    browseGroup: "metabolic-composition",
    addresses: "Obesity adjunct therapy",
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
    browseGroup: "bone-joint",
    addresses: "Cartilage repair",
    demographics: "Aged 50+",
    delivery: "SC injection",
    pricing: "$350–$500",
    notes: "5–10 weeks",
    resultsTimeline: "3+ months",
    wellnessQuizId: "cartalax",
  },
];

/** Display order for Wellnest peptide “focus” browse chips in the treatment recommender. */
export const WELLNEST_BROWSE_GROUP_ORDER = [
  "recovery-tissue",
  "gh-performance",
  "cognition-mood",
  "metabolic-composition",
  "skin-aesthetic",
  "bone-joint",
  "longevity",
] as const;

export const WELLNEST_BROWSE_GROUP_LABELS: Record<string, string> = {
  "recovery-tissue": "Recovery & tissue",
  "gh-performance": "GH · performance · sleep",
  "cognition-mood": "Cognition & mood",
  "metabolic-composition": "Metabolic & composition",
  "skin-aesthetic": "Skin & tanning",
  "bone-joint": "Bone & joint",
  longevity: "Longevity",
};

export type WellnestPriceBand = "budget" | "mid" | "premium" | "variable";

/** Bucket list pricing for filter chips (uses highest number in the price string). */
export function getWellnestPriceBand(
  pricing: string | null | undefined,
): WellnestPriceBand {
  const s = (pricing ?? "").replace(/,/g, "");
  const nums = s.match(/\d+/g)?.map(Number) ?? [];
  if (nums.length === 0) return "variable";
  const hi = Math.max(...nums);
  if (hi >= 500) return "premium";
  if (hi >= 300) return "mid";
  return "budget";
}

export function wellnestDeliveryHasNasal(delivery: string): boolean {
  return /\bnasal\b/i.test(delivery);
}

export function wellnestDeliveryHasOral(delivery: string): boolean {
  return /\boral\b/i.test(delivery);
}

export function wellnestDeliveryHasTopical(delivery: string): boolean {
  return /\btopical\b/i.test(delivery) || /\bcream\b/i.test(delivery);
}

/**
 * Split Dr Reddy sheet column "What It Addresses" (comma-separated phrases) into chip labels.
 */
export function parseWellnestWhatItAddressesChips(
  raw: string | null | undefined,
): string[] {
  if (raw == null || !String(raw).trim()) return [];
  const parts = String(raw)
    .split(",")
    .map((s) => s.trim().replace(/\s+/g, " "))
    .filter((s) => s.length > 0);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const k = p.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

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
