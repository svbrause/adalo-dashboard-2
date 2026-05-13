/**
 * JudgeMD — embedded price list (2026–27) when provider code matches {@link JUDGEMD_PROVIDER_CODE}.
 * Sourced from `Copy of  JudgeMD Price List 2026_27.md`. Ranges use min dollars in `price` and the full range in `note`.
 */

import type { ProviderPricingJson } from "./treatmentPricing2025";

/** Primary Airtable / dashboard code for JudgeMD (case-insensitive in {@link isJudgeMdProviderCode}). */
export const JUDGEMD_PROVIDER_CODE = "JudgeMD";

/** Demo / local JudgeMD login code (Add Client placeholder) — same catalog as production JudgeMD. */
export const JUDGEMD_DEMO_PROVIDER_CODE = "12345";

export function isJudgeMdProviderCode(providerCode: string | undefined | null): boolean {
  const c = (providerCode ?? "").trim().toLowerCase();
  return (
    c === "judgemd" ||
    c === "judge-md" ||
    c === "judge_md" ||
    c === JUDGEMD_DEMO_PROVIDER_CODE
  );
}

/**
 * Embedded JudgeMD sheet: surgery buckets + injectables. Used as the merge base (instead of 2025)
 * when {@link isJudgeMdProviderCode} is true.
 */
export const JUDGEMD_PRICE_LIST_2026_27: ProviderPricingJson = [
  {
    category: "Breast Surgery",
    items: [
      { name: "Breast Augmentation (with implants)", price: 13000 },
      { name: "Breast Reduction", price: 16000, note: "$16,000–$18,000+" },
      { name: "Breast Lift", price: 15500, note: "$15,500–$17,000+" },
      { name: "Breast Lift with Augmentation", price: 16000, note: "$16,000–$18,000" },
      { name: "Inverted Nipples", price: 5500, note: "$5,500–$6,500" },
      { name: "Breast Implant Removal", price: 7500, note: "$7,500+" },
      { name: "Breast Implant Replacement", price: 12000, note: "$12,000+" },
      { name: "Areola Reduction/nipple lift", price: 8000, note: "$8,000+" },
    ],
  },
  {
    category: "Facial Surgery",
    items: [
      { name: "Mini Face Lift", price: 12000, note: "$12,000+" },
      { name: "Face Lift", price: 28000 },
      { name: "Face Lift & Neck Lift", price: 34000, note: "$34,000+" },
      { name: "Neck Lift", price: 18000, note: "$18,000+" },
      { name: "Face Lift, Brow & Neck Lift", price: 40000, note: "$40,000+" },
      { name: "Cheek Lift", price: 8000, note: "$8,000+" },
      { name: "Fat Transfer to face", price: 6000, note: "$6,000+" },
      {
        name: "Fat Transfer to Tear Troughs",
        price: 6000,
        note: "$6,500 (in office), $6,000 (in OR bundled)",
      },
      {
        name: "Blepharoplasty (Upper Eyelid Surgery)",
        price: 7000,
      },
      {
        name: "Blepharoplasty (Lower Eyelid Surgery)",
        price: 7000,
      },
      {
        name: "Blepharoplasty (Quad - Upper & Lower Eyelid Surgery)",
        price: 13000,
      },
      { name: "Surgical Lip Lift", price: 5800, note: "$5,800–$6,800" },
      { name: "Brow lift", price: 9000, note: "$9,000+" },
      { name: "Rhinoplasty (Nose Reshaping)", price: 17500, note: "$17,500–$22,000" },
      { name: "Liposuction Submentum", price: 8000 },
      { name: "Tip Rhinoplasty", price: 9900, note: "$9,900+" },
      { name: "Revision Rhinoplasty", price: 23000, note: "$23,000+" },
      { name: "Buccal Fat Removal", price: 7000, note: "$7,000+" },
      { name: "Otoplasty (Bilateral Ear Reduction)", price: 6500, note: "$6,500–$9,000" },
      {
        name: "Earlobe Reduction",
        price: 1600,
        note: "$1,600+ per ear; $3,500+ both",
      },
      {
        name: "Earlobe Repair",
        price: 1500,
        note: "$1,500/ear or $2,900 both",
      },
      { name: "Surgical Chin Augmentation", price: 7000, note: "$7,000–$9,000" },
      { name: "Forehead Reduction (Hairline Lowering)", price: 8600, note: "$8,600–$10,000" },
      { name: "Mole Removal (Surgical Excision)", price: 2200, note: "$2,200+" },
      { name: "Dimpleplasty", price: 7000 },
      {
        name: "Thread Lift",
        price: 3500,
        note: "$3,500 lower face; $3,500 mid face; $6,500 mid+lower",
      },
      {
        name: "Full Facial Thread Correction",
        price: 8500,
        note: "$8,500+ (upper, lower, mid)",
      },
    ],
  },
  {
    category: "Body Sculpting",
    items: [
      { name: "Abdominoplasty (Tummy Tuck)", price: 13500, note: "$13,500–$18,500" },
      { name: "Abdominoplasty + Liposuction 360", price: 20000, note: "$20,000+" },
      { name: "Mini Tummy Tuck", price: 9500, note: "$9,500–$14,500" },
      { name: "Umbilicoplasty", price: 7000, note: "$7,000+" },
      { name: "Liposuction stomach", price: 7000, note: "$7,000–$9,500" },
      { name: "Liposuction thighs", price: 6800, note: "$6,800–$8,700 per area" },
      { name: "Liposuction circumferential thighs", price: 14500, note: "$14,500–$20,500" },
      { name: "Liposuction arms", price: 7500, note: "$7,500–$9,000" },
      { name: "Liposuction axilla", price: 6500, note: "$6,500+" },
      { name: "Brachioplasty (arm lift)", price: 10500, note: "$10,500–$15,000" },
      { name: "Liposuction knees", price: 3800, note: "$3,800–$4,500" },
      { name: "Liposuction calves/ankles", price: 7500, note: "$7,500–$9,500" },
      {
        name: "Sculptra to the buttock",
        price: 11500,
        note: "$11,500–$41,500; $1,050/vial; paid in full before booking",
      },
    ],
  },
  {
    category: "Vaginal Rejuvenation",
    items: [
      { name: "Labia Minora Reduction (labiaplasty)", price: 8000, note: "$8,000–$10,000" },
      { name: "Labia Majora Reduction", price: 7500, note: "$7,500–$9,000" },
      { name: "Clitoral Hood Reduction", price: 6000, note: "$6,000–$8,000" },
      { name: "Fat Transfer to Labia Majora", price: 5500, note: "$5,500+" },
      { name: "Liposuction of Mons Pubis", price: 7500, note: "$7,500+" },
      { name: "Mons Pubis Lift", price: 9000, note: "$9,000+" },
    ],
  },
  {
    category: "Injectables",
    items: [
      { name: "Hyaluronidase (Dissolver for Filler)", price: 600, note: "$600+" },
      { name: "Sculptra – 1 Vial", price: 1100, note: "per vial" },
      { name: "Renuva (3 cc)", price: 3000, note: "$3,000+" },
      { name: "Botox per Unit", price: 16, note: "per unit" },
      { name: "Dysport per Unit", price: 5.33, note: "per unit" },
      { name: "Daxxify per Unit", price: 8, note: "per unit" },
      {
        name: "Masseters Muscle (100u botox or 300u dysport)",
        price: 1000,
      },
      {
        name: "Trapezius Muscle (100u botox or 300u dysport)",
        price: 1000,
      },
      {
        name: "Lip Flip or Gummy Smile or Browlift to neurotoxin",
        price: 180,
      },
      { name: "Baby Tox (<10u)", price: 18, note: "add-on per unit; <10u" },
      { name: "Juvederm Ultra", price: 850, note: "per syringe" },
      { name: "Restylane Kysse", price: 850, note: "per syringe" },
      { name: "Juvederm Voluma", price: 1000, note: "per syringe" },
      { name: "Juvederm Volbella", price: 850, note: "per syringe" },
      { name: "Restylane L", price: 850, note: "per syringe" },
      { name: "Juvederm Vollure", price: 900, note: "per syringe" },
      { name: "Juvederm Vollux", price: 1200, note: "per syringe" },
      { name: "Juvederm Ultra Plus", price: 850, note: "per syringe" },
      { name: "Restylane Refyne", price: 850, note: "per syringe" },
      { name: "Restylane Defyne", price: 950, note: "per syringe" },
      { name: "Restylane Contour", price: 1200, note: "per syringe" },
      { name: "Restylane Lyft", price: 1200, note: "per syringe" },
      { name: "Skinvive (intradermal)", price: 900, note: "per syringe" },
      { name: "Liquid Rhinoplasty", price: 2000 },
      { name: "Revance Redensity", price: 950 },
      { name: "Revance RHA2", price: 950 },
      { name: "Revance RHA3", price: 950 },
      { name: "Revance RHA4", price: 1100 },
      { name: "EZ Gel PRF", price: 3000, note: "$3,000+" },
    ],
  },
];

/** Non-injectable surgery sections in {@link JUDGEMD_PRICE_LIST_2026_27} (each is its own plan card for JudgeMD). */
export const JUDGEMD_SURGERY_SECTION_CATEGORIES = [
  "Breast Surgery",
  "Facial Surgery",
  "Body Sculpting",
  "Vaginal Rejuvenation",
] as const;

/**
 * JudgeMD plan builder now exposes just two facial surgery cards:
 * - `Facial Surgery` for the broad non-rhinoplasty facial bucket
 * - `Rhinoplasty` for nose surgery specifically
 */
export const JUDGEMD_FACIAL_SURGERY_PLAN_CATEGORIES = [
  "Facial Surgery",
  "Rhinoplasty",
] as const;

/** Legacy split facial card labels kept for existing stored rows and backwards-compatible pricing lookups. */
const JUDGEMD_LEGACY_FACIAL_SURGERY_PLAN_CATEGORIES = [
  "Facial Surgery — Lifting & threads",
  "Facial Surgery — Eyes & brows",
  "Facial Surgery — Rhinoplasty",
  "Facial Surgery — Lips, chin & jaw",
  "Facial Surgery — Fat transfer",
  "Facial Surgery — Ears",
  "Facial Surgery — Forehead, hairline & skin",
] as const;

/** Item names per facial plan subcategory (must match {@link JUDGEMD_PRICE_LIST_2026_27} Facial Surgery exactly). */
export const JUDGEMD_FACIAL_PLAN_SUBCATEGORY_ITEMS: Record<string, readonly string[]> = {
  "Facial Surgery": [
    "Mini Face Lift",
    "Face Lift",
    "Face Lift & Neck Lift",
    "Neck Lift",
    "Face Lift, Brow & Neck Lift",
    "Cheek Lift",
    "Fat Transfer to face",
    "Fat Transfer to Tear Troughs",
    "Blepharoplasty (Upper Eyelid Surgery)",
    "Blepharoplasty (Lower Eyelid Surgery)",
    "Blepharoplasty (Quad - Upper & Lower Eyelid Surgery)",
    "Surgical Lip Lift",
    "Brow lift",
    "Liposuction Submentum",
    "Buccal Fat Removal",
    "Otoplasty (Bilateral Ear Reduction)",
    "Earlobe Reduction",
    "Earlobe Repair",
    "Surgical Chin Augmentation",
    "Forehead Reduction (Hairline Lowering)",
    "Mole Removal (Surgical Excision)",
    "Dimpleplasty",
    "Thread Lift",
    "Full Facial Thread Correction",
  ],
  "Rhinoplasty": [
    "Rhinoplasty (Nose Reshaping)",
    "Tip Rhinoplasty",
    "Revision Rhinoplasty",
  ],
  "Facial Surgery — Lifting & threads": [
    "Mini Face Lift",
    "Face Lift",
    "Face Lift & Neck Lift",
    "Neck Lift",
    "Face Lift, Brow & Neck Lift",
    "Cheek Lift",
    "Thread Lift",
    "Full Facial Thread Correction",
  ],
  "Facial Surgery — Eyes & brows": [
    "Blepharoplasty (Upper Eyelid Surgery)",
    "Blepharoplasty (Lower Eyelid Surgery)",
    "Blepharoplasty (Quad - Upper & Lower Eyelid Surgery)",
    "Brow lift",
  ],
  "Facial Surgery — Rhinoplasty": [
    "Rhinoplasty (Nose Reshaping)",
    "Tip Rhinoplasty",
    "Revision Rhinoplasty",
  ],
  "Facial Surgery — Lips, chin & jaw": [
    "Surgical Lip Lift",
    "Liposuction Submentum",
    "Buccal Fat Removal",
    "Surgical Chin Augmentation",
    "Dimpleplasty",
  ],
  "Facial Surgery — Fat transfer": ["Fat Transfer to face", "Fat Transfer to Tear Troughs"],
  "Facial Surgery — Ears": [
    "Otoplasty (Bilateral Ear Reduction)",
    "Earlobe Reduction",
    "Earlobe Repair",
  ],
  "Facial Surgery — Forehead, hairline & skin": [
    "Forehead Reduction (Hairline Lowering)",
    "Mole Removal (Surgical Excision)",
  ],
};

const JUDGEMD_FACIAL_PLAN_SUBCATEGORY_SET = new Set(
  Object.keys(JUDGEMD_FACIAL_PLAN_SUBCATEGORY_ITEMS),
);

/** True when `treatment` is a split facial plan card (e.g. "Facial Surgery — Rhinoplasty"). */
export function isJudgeMdFacialPlanSubcategory(treatment: string | undefined | null): boolean {
  return JUDGEMD_FACIAL_PLAN_SUBCATEGORY_SET.has((treatment ?? "").trim());
}

/**
 * Plan-level surgery category names in UI order: breast, facial subs, body, vaginal.
 * (Price list still has a single "Facial Surgery" section — subs filter that section.)
 */
export const JUDGEMD_PLAN_SURGERY_CATEGORIES: readonly string[] = [
  "Breast Surgery",
  ...JUDGEMD_FACIAL_SURGERY_PLAN_CATEGORIES,
  "Body Sculpting",
  "Vaginal Rejuvenation",
];

const JUDGEMD_PLAN_SURGERY_CATEGORY_SET = new Set<string>([
  ...JUDGEMD_PLAN_SURGERY_CATEGORIES,
  ...JUDGEMD_LEGACY_FACIAL_SURGERY_PLAN_CATEGORIES,
]);

/** JudgeMD injectable plan cards (always after every surgery card in canonical order). */
export const JUDGEMD_NONSURGICAL_PLAN_BUILDER_TREATMENTS = [
  "Skincare",
  "Neurotoxin",
  "Filler",
  "Biostimulants",
] as const;

/**
 * Suggested skincare add-ons (keyword fragments) by treatment.
 * Each entry is a short keyword matched case-insensitively against boutique product names.
 *
 * Non-surgical (injectables) — Dr. Judge's protocol:
 *   All injectables get SPF (Physical Fusion UV Defense SPF 50) — daily sun protection
 *   amplifies and maintains results.
 *   Neurotoxin   — C E Ferulic (antioxidant, extends toxin results) + P-Tiox (glass skin
 *                  serum designed for neurotoxin synergy) + Retinol 0.3% (renewal) + SPF
 *   Filler       — HA Intensifier (boosts natural HA alongside HA fillers) + Triple Lipid
 *                  Restore (barrier repair post-injection) + Phyto Corrective Gel (calms
 *                  redness) + SPF
 *   Biostimulants — Triple Lipid Restore (barrier during collagen remodeling) + C E Ferulic
 *                  (protects new collagen) + Retinol 0.5% (boosts collagen synthesis) + SPF
 *
 * Surgical — Dr. Judge's protocol:
 *   All surgery     — VitaMedica Recovery Support Program + Arnica Montana 30X HPUS
 *                     (peri-operative supplement support)
 *   Facial Surgery  — Epidermal Repair (post-surgical healing) + Phyto Corrective Gel
 *                     (calms redness/sensitivity) + Triple Lipid Restore (barrier repair) + SPF
 *   Rhinoplasty     — Triple Lipid Restore only + SPF (minimal regimen; perinasal skin
 *                     needs gentle moisture and sun protection, nothing else)
 *   Breast Surgery  — No SkinCeuticals topicals (incision sites need silicone-based scar
 *                     care, not skincare serums); silicone scar gel + sheets
 *   Body Sculpting  — No SkinCeuticals topicals (same rationale as breast — larger body
 *                     incisions need silicone scar sheets/gel); silicone scar gel + large sheets
 *   Vaginal Rejuvenation — Epidermal Repair (gentle healing) + Phyto Corrective Gel
 *                     (soothing) + Triple Lipid Restore (barrier support) + SPF
 */
const JUDGEMD_SURGICAL_RECOVERY_SUPPORT_KEYWORD = "Recovery Support Program";
const JUDGEMD_SILICONE_SCAR_GEL_KEYWORD = "SiliSilk Advanced Scar Gel";
const JUDGEMD_STANDARD_SCAR_SHEET_KEYWORD = "Epi-Derm Standard Sheet";
const JUDGEMD_LARGE_SCAR_SHEET_KEYWORD = "Epi-Derm Large Sheet";

export const JUDGEMD_TREATMENT_SKINCARE_PAIRINGS: Record<string, string[]> = {
  // — Non-surgical (injectables) —
  Neurotoxin: [
    "C E Ferulic",
    "P-Tiox",
    "Retinol 0.3%",
    "Physical Fusion UV Defense SPF 50",
  ],
  Filler: [
    "Hyaluronic Acid Intensifier",
    "Triple Lipid Restore",
    "Phyto Corrective Gel",
    "Physical Fusion UV Defense SPF 50",
  ],
  Biostimulants: [
    "Triple Lipid Restore",
    "C E Ferulic",
    "Retinol 0.5%",
    "Physical Fusion UV Defense SPF 50",
  ],
  // — Surgical —
  "Facial Surgery": [
    JUDGEMD_SURGICAL_RECOVERY_SUPPORT_KEYWORD,
    "Epidermal Repair",
    "Phyto Corrective Gel",
    "Triple Lipid Restore",
    "Physical Fusion UV Defense SPF 50",
  ],
  "Rhinoplasty": [
    JUDGEMD_SURGICAL_RECOVERY_SUPPORT_KEYWORD,
    "Triple Lipid Restore",
    "Physical Fusion UV Defense SPF 50",
  ],
  "Breast Surgery": [
    JUDGEMD_SURGICAL_RECOVERY_SUPPORT_KEYWORD,
    JUDGEMD_SILICONE_SCAR_GEL_KEYWORD,
    JUDGEMD_STANDARD_SCAR_SHEET_KEYWORD,
  ],
  "Body Sculpting": [
    JUDGEMD_SURGICAL_RECOVERY_SUPPORT_KEYWORD,
    JUDGEMD_SILICONE_SCAR_GEL_KEYWORD,
    JUDGEMD_LARGE_SCAR_SHEET_KEYWORD,
  ],
  "Vaginal Rejuvenation": [
    JUDGEMD_SURGICAL_RECOVERY_SUPPORT_KEYWORD,
    "Epidermal Repair",
    "Phyto Corrective Gel",
    "Triple Lipid Restore",
    "Physical Fusion UV Defense SPF 50",
  ],
  "Facial Surgery — Lifting & threads": [
    JUDGEMD_SURGICAL_RECOVERY_SUPPORT_KEYWORD,
    "Epidermal Repair",
    "Phyto Corrective Gel",
    "Triple Lipid Restore",
    "Physical Fusion UV Defense SPF 50",
  ],
  "Facial Surgery — Eyes & brows": [
    JUDGEMD_SURGICAL_RECOVERY_SUPPORT_KEYWORD,
    "Epidermal Repair",
    "Phyto Corrective Gel",
    "Triple Lipid Restore",
    "Physical Fusion UV Defense SPF 50",
  ],
  "Facial Surgery — Rhinoplasty": [
    JUDGEMD_SURGICAL_RECOVERY_SUPPORT_KEYWORD,
    "Triple Lipid Restore",
    "Physical Fusion UV Defense SPF 50",
  ],
  "Facial Surgery — Lips, chin & jaw": [
    JUDGEMD_SURGICAL_RECOVERY_SUPPORT_KEYWORD,
    "Epidermal Repair",
    "Phyto Corrective Gel",
    "Triple Lipid Restore",
    "Physical Fusion UV Defense SPF 50",
  ],
  "Facial Surgery — Fat transfer": [
    JUDGEMD_SURGICAL_RECOVERY_SUPPORT_KEYWORD,
    "Epidermal Repair",
    "Phyto Corrective Gel",
    "Triple Lipid Restore",
    "Physical Fusion UV Defense SPF 50",
  ],
  "Facial Surgery — Ears": [
    JUDGEMD_SURGICAL_RECOVERY_SUPPORT_KEYWORD,
    "Epidermal Repair",
    "Phyto Corrective Gel",
    "Triple Lipid Restore",
    "Physical Fusion UV Defense SPF 50",
  ],
  "Facial Surgery — Forehead, hairline & skin": [
    JUDGEMD_SURGICAL_RECOVERY_SUPPORT_KEYWORD,
    "Epidermal Repair",
    "Phyto Corrective Gel",
    "Triple Lipid Restore",
    "Physical Fusion UV Defense SPF 50",
  ],
};

/**
 * Plan builder / discussed-treatments top-level categories for JudgeMD.
 * Facial surgery is grouped into broad `Facial Surgery` + `Rhinoplasty`; injectables → Neurotoxin, Filler, Biostimulants.
 * Order is **all nonsurgical first**, then **all surgical** — never interleaved.
 */
export const JUDGEMD_PLAN_BUILDER_TREATMENTS: readonly string[] = [
  ...JUDGEMD_NONSURGICAL_PLAN_BUILDER_TREATMENTS,
  ...JUDGEMD_PLAN_SURGERY_CATEGORIES,
];

/** True when `treatment` is a JudgeMD surgery plan card (split facial + breast / body / vaginal, or legacy "Facial Surgery"). */
export function isJudgeMdSurgeryPlanCategory(treatment: string | undefined | null): boolean {
  return JUDGEMD_PLAN_SURGERY_CATEGORY_SET.has((treatment ?? "").trim());
}

/** Neurotoxin / Filler / Biostimulants plan cards (not surgery). */
export function isJudgeMdNonsurgicalPlanBuilderTreatment(
  treatment: string | undefined | null,
): boolean {
  return (JUDGEMD_NONSURGICAL_PLAN_BUILDER_TREATMENTS as readonly string[]).includes(
    (treatment ?? "").trim(),
  );
}

/**
 * Merge finding-based suggestions with the canonical plan list so **every nonsurgical card
 * appears before surgery** (same order as {@link JUDGEMD_PLAN_BUILDER_TREATMENTS} within each group).
 */
export function buildJudgeMdPlanBuilderTreatmentOrder(
  suggestedNamesOrdered: readonly string[],
  allowedOrdered: readonly string[] = JUDGEMD_PLAN_BUILDER_TREATMENTS,
): string[] {
  const suggestedInAllowed = new Set(
    suggestedNamesOrdered.filter((t) => allowedOrdered.includes(t)),
  );
  const seen = new Set<string>();
  const out: string[] = [];

  const surgeryBucket = allowedOrdered.filter((t) => isJudgeMdSurgeryPlanCategory(t));
  const nonsurgBucket = allowedOrdered.filter((t) => isJudgeMdNonsurgicalPlanBuilderTreatment(t));

  const appendBucket = (bucket: readonly string[]) => {
    for (const t of bucket) {
      if (suggestedInAllowed.has(t) && !seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    }
    for (const t of bucket) {
      if (!seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    }
  };

  appendBucket(nonsurgBucket);
  appendBucket(surgeryBucket);
  return out;
}

/** Plan builder UI: optional section headings before surgical vs non-surgical cards. */
export type JudgeMdPlanBuilderRowSpec =
  | { kind: "heading"; key: string; label: string }
  | { kind: "card"; treatment: string };

/** Build heading + card rows so the plan builder visually groups nonsurgical vs surgical options. */
export function buildJudgeMdPlanBuilderRowSpecs(
  treatmentsOrdered: readonly string[],
): JudgeMdPlanBuilderRowSpec[] {
  const out: JudgeMdPlanBuilderRowSpec[] = [];
  for (let i = 0; i < treatmentsOrdered.length; i++) {
    const t = treatmentsOrdered[i];
    const prev = i > 0 ? treatmentsOrdered[i - 1] : null;
    if (prev === null) {
      if (isJudgeMdSurgeryPlanCategory(t)) {
        out.push({
          kind: "heading",
          key: "jm-plan-h-surgical",
          label: "Surgical options",
        });
      } else if (isJudgeMdNonsurgicalPlanBuilderTreatment(t)) {
        out.push({
          kind: "heading",
          key: "jm-plan-h-nonsurgical",
          label: "Non-surgical options",
        });
      }
    } else if (
      isJudgeMdNonsurgicalPlanBuilderTreatment(prev) &&
      isJudgeMdSurgeryPlanCategory(t)
    ) {
      out.push({
        kind: "heading",
        key: `jm-plan-h-surgical-${i}`,
        label: "Surgical options",
      });
    }
    out.push({ kind: "card", treatment: t });
  }
  return out;
}

/**
 * Labels in Discussed Treatments `ASSESSMENT_FINDINGS_BY_AREA` (must match the `area` string) —
 * each Judge MD surgery plan card only shows "Analysis" circles for anatomy the procedure
 * type addresses (e.g. Eyes + Forehead for "Facial Surgery — Eyes & brows", not jawline).
 */
const ASSESSMENT_AREA = {
  lips: "Lips",
  eyes: "Eyes",
  forehead: "Forehead",
  cheeks: "Cheeks",
  nasolabial: "Nasolabial",
  jawline: "Jawline",
  neck: "Neck",
  skin: "Skin",
  nose: "Nose",
} as const;

type AssessmentAreaLabel = (typeof ASSESSMENT_AREA)[keyof typeof ASSESSMENT_AREA];

const ALL_ASSESSMENT_AREAS: readonly AssessmentAreaLabel[] = [
  ASSESSMENT_AREA.lips,
  ASSESSMENT_AREA.eyes,
  ASSESSMENT_AREA.forehead,
  ASSESSMENT_AREA.cheeks,
  ASSESSMENT_AREA.nasolabial,
  ASSESSMENT_AREA.jawline,
  ASSESSMENT_AREA.neck,
  ASSESSMENT_AREA.skin,
  ASSESSMENT_AREA.nose,
] as const;

const JUDGEMD_SURGERY_PLAN_ASSESSMENT_AREAS: Readonly<Record<string, "all" | "none" | readonly AssessmentAreaLabel[]>> = {
  /** Legacy: full facial finding graph. */
  "Facial Surgery": "all",
  "Rhinoplasty": [ASSESSMENT_AREA.nose],
  "Facial Surgery — Lifting & threads": [
    ASSESSMENT_AREA.cheeks,
    ASSESSMENT_AREA.jawline,
    ASSESSMENT_AREA.neck,
    ASSESSMENT_AREA.skin,
    ASSESSMENT_AREA.forehead,
  ],
  "Facial Surgery — Eyes & brows": [ASSESSMENT_AREA.eyes, ASSESSMENT_AREA.forehead],
  "Facial Surgery — Rhinoplasty": [ASSESSMENT_AREA.nose],
  "Facial Surgery — Lips, chin & jaw": [
    ASSESSMENT_AREA.lips,
    ASSESSMENT_AREA.jawline,
  ],
  "Facial Surgery — Fat transfer": [
    ASSESSMENT_AREA.eyes,
    ASSESSMENT_AREA.cheeks,
    ASSESSMENT_AREA.forehead,
    ASSESSMENT_AREA.nasolabial,
  ],
  /** Ears: no dedicated region in the facial assessment list. */
  "Facial Surgery — Ears": "none",
  "Facial Surgery — Forehead, hairline & skin": [
    ASSESSMENT_AREA.forehead,
    ASSESSMENT_AREA.skin,
  ],
  "Breast Surgery": "none",
  /** Submentum / body contour: closest match in the face+neck model. */
  "Body Sculpting": [ASSESSMENT_AREA.jawline, ASSESSMENT_AREA.neck, ASSESSMENT_AREA.skin],
  "Vaginal Rejuvenation": "none",
};

/**
 * For Judge MD surgery plan cards, restrict the recommender "Analysis" section to assessment
 * `area` rows that match the card’s scope.
 *
 * - `undefined` = not a Judge surgery card (Filler, Neurotoxin, etc.): no change to behavior.
 * - `all` = use every `area` row that has matching findings.
 * - `none` = no region rows.
 * - `{ allowedAreas }` = only these assessment `area` values.
 */
export function getJudgemdSurgeryPlanAssessmentFilter(
  treatment: string | undefined | null,
):
  | undefined
  | "all"
  | "none"
  | { allowedAreas: readonly string[] } {
  const t = (treatment ?? "").trim();
  if (!isJudgeMdSurgeryPlanCategory(t)) return undefined;
  const mode = JUDGEMD_SURGERY_PLAN_ASSESSMENT_AREAS[t];
  if (mode === "all") return "all";
  if (mode === "none") return "none";
  if (Array.isArray(mode) && mode.length > 0) {
    return { allowedAreas: mode as readonly string[] };
  }
  if (isJudgeMdFacialPlanSubcategory(t)) {
    return { allowedAreas: ALL_ASSESSMENT_AREAS as readonly string[] };
  }
  return "all";
}

/** Procedure names for one surgery plan category (section title, facial sub label, or legacy "Facial Surgery"). */
export function getJudgeMdProductOptionsForSurgeryCategory(category: string): string[] {
  const c = category.trim();
  const facial = JUDGEMD_FACIAL_PLAN_SUBCATEGORY_ITEMS[c];
  if (facial) return [...facial];
  if (c === "Facial Surgery") {
    const sec = JUDGEMD_PRICE_LIST_2026_27.find((s) => s.category === "Facial Surgery");
    return sec ? sec.items.map((i) => i.name) : [];
  }
  const sec = JUDGEMD_PRICE_LIST_2026_27.find((s) => s.category === c);
  return sec ? sec.items.map((i) => i.name) : [];
}

/** Map a facial SKU name to its plan subcategory, if any. */
export function getJudgeMdFacialPlanSubcategoryForItemName(
  itemName: string,
): (typeof JUDGEMD_FACIAL_SURGERY_PLAN_CATEGORIES)[number] | undefined {
  const n = (itemName ?? "").trim();
  for (const [sub, names] of Object.entries(JUDGEMD_FACIAL_PLAN_SUBCATEGORY_ITEMS)) {
    if (names.includes(n)) {
      return sub as (typeof JUDGEMD_FACIAL_SURGERY_PLAN_CATEGORIES)[number];
    }
  }
  return undefined;
}

function injectablesSection() {
  return JUDGEMD_PRICE_LIST_2026_27.find((s) => s.category === "Injectables");
}

/** Neurotoxin type labels for JudgeMD plan builder (match per-unit injectable rows for pricing). */
export function getJudgeMdNeurotoxinProductOptions(): string[] {
  if (!injectablesSection()) return [];
  return [
    "Botox",
    "Dysport",
    "Daxxify",
    "Baby Tox",
    "Lip Flip",
    "Gummy Smile",
    "Browlift",
    "Masseters",
    "Trapezius",
  ];
}

/** Filler “Type” options from the JudgeMD injectables sheet. */
export function getJudgeMdFillerProductOptions(): string[] {
  const inj = injectablesSection();
  if (!inj) return [];
  return inj.items
    .filter((i) => {
      const n = i.name;
      return (
        /juvederm|restylane|revance|liquid rhinoplasty|skinvive|redensity|rha/i.test(n) ||
        /hyaluronidase|dissolver/i.test(n) ||
        /renuva/i.test(n)
      );
    })
    .map((i) => i.name)
    .sort((a, b) => a.localeCompare(b));
}

export type JudgeMdOptionGroup = {
  label: string;
  options: string[];
};

function getJudgeMdFillerGroupLabel(option: string): string {
  const n = (option ?? "").trim().toLowerCase();
  if (n.includes("juvederm")) return "Juvederm";
  if (n.includes("restylane")) return "Restylane";
  return "Other products";
}

export function groupJudgeMdFillerProductOptions(
  options: readonly string[],
): JudgeMdOptionGroup[] {
  const grouped = new Map<string, string[]>();
  for (const label of ["Juvederm", "Restylane", "Other products"]) {
    grouped.set(label, []);
  }
  for (const option of options) {
    const trimmed = option.trim();
    if (!trimmed) continue;
    const key = getJudgeMdFillerGroupLabel(trimmed);
    grouped.get(key)?.push(trimmed);
  }
  return ["Juvederm", "Restylane", "Other products"]
    .map((label) => ({
      label,
      options: grouped.get(label) ?? [],
    }))
    .filter((group) => group.options.length > 0);
}

/** Biostimulant type labels (Sculptra vial, EZ Gel PRF). Renuva is listed under Filler for JudgeMD. */
export function getJudgeMdBiostimulantProductOptions(): string[] {
  const inj = injectablesSection();
  if (!inj) return [];
  return inj.items
    .filter((i) => /sculptra|ez\s*gel/i.test(i.name))
    .map((i) => i.name);
}

/** All surgical procedure names (legacy “Other procedures” picker / combined list). */
export function getJudgeMdSurgeryProductOptions(): string[] {
  return JUDGEMD_PRICE_LIST_2026_27.filter((s) => s.category !== "Injectables").flatMap(
    (s) => s.items.map((i) => i.name),
  );
}
