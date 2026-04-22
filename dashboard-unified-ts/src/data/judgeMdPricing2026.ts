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
        name: "Blepharoplasty (Eyelid Surgery)",
        price: 7000,
        note: "$7,000 upper; $7,000 lower; $13,000 upper & lower",
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
        name: "Liposuction of the submentum (area under the chin)",
        price: 6500,
        note: "$6,500 in office; $7,200 OR",
      },
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
      { name: "Botox/Dysport per Unit", price: 16, note: "per unit" },
      {
        name: "Masseters/Trapezius Muscle (100u botox or 300u dysport)",
        price: 1000,
      },
      {
        name: "Lip Flip or Gummy Smile or Browlift to neurotoxin",
        price: 180,
      },
      { name: "Baby Tox (<10u)", price: 18, note: "add-on per unit; <10u" },
      { name: "Juvederm Ultra Restylane Kysse", price: 850, note: "per syringe" },
      { name: "Juvederm Voluma", price: 1000, note: "per syringe" },
      { name: "Juvederm Volbella Restalyne L", price: 850, note: "per syringe" },
      { name: "Juvederm Vollure", price: 900, note: "per syringe" },
      { name: "Juvederm Vollux", price: 1200, note: "per syringe" },
      { name: "Juvederm Ultra Plus Restylane Refyne", price: 850, note: "per syringe" },
      { name: "Restylane Defyne", price: 950, note: "per syringe" },
      { name: "Restylane Contour Restylane Lyft", price: 1200, note: "per syringe" },
      { name: "Skinvive (intradermal)", price: 900, note: "per syringe" },
      { name: "Liquid Rhinoplasty", price: 2000 },
      { name: "Revance Redensity", price: 950 },
      { name: "Revance RHA2", price: 950 },
      { name: "Revance RHA3", price: 950 },
      { name: "Revance RHA4", price: 1100 },
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
 * Plan builder splits the price-list **Facial Surgery** section into subcategories (one card each).
 * Every facial line item maps to exactly one subcategory.
 */
export const JUDGEMD_FACIAL_SURGERY_PLAN_CATEGORIES = [
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
    "Blepharoplasty (Eyelid Surgery)",
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
  /** Legacy rows stored as the undivided label */
  "Facial Surgery",
]);

/**
 * Plan builder / discussed-treatments top-level categories for JudgeMD.
 * Facial surgery is split into {@link JUDGEMD_FACIAL_SURGERY_PLAN_CATEGORIES}; injectables → Neurotoxin, Filler, Biostimulants.
 */
export const JUDGEMD_PLAN_BUILDER_TREATMENTS: readonly string[] = [
  ...JUDGEMD_PLAN_SURGERY_CATEGORIES,
  "Neurotoxin",
  "Filler",
  "Biostimulants",
];

/** True when `treatment` is a JudgeMD surgery plan card (split facial + breast / body / vaginal, or legacy "Facial Surgery"). */
export function isJudgeMdSurgeryPlanCategory(treatment: string | undefined | null): boolean {
  return JUDGEMD_PLAN_SURGERY_CATEGORY_SET.has((treatment ?? "").trim());
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

/** Neurotoxin “Type” options from the JudgeMD injectables sheet. */
export function getJudgeMdNeurotoxinProductOptions(): string[] {
  const inj = injectablesSection();
  if (!inj) return [];
  return inj.items
    .filter((i) =>
      /botox|dysport|masseter|trapezius|lip flip|gummy|browlift|baby tox/i.test(i.name),
    )
    .map((i) => i.name);
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
        /hyaluronidase|dissolver/i.test(n)
      );
    })
    .map((i) => i.name);
}

/** Biostimulant type labels (Sculptra vial, Renuva) for checkout. */
export function getJudgeMdBiostimulantProductOptions(): string[] {
  const inj = injectablesSection();
  if (!inj) return [];
  return inj.items.filter((i) => /sculptra|renuva/i.test(i.name)).map((i) => i.name);
}

/** All surgical procedure names (legacy “Other procedures” picker / combined list). */
export function getJudgeMdSurgeryProductOptions(): string[] {
  return JUDGEMD_PRICE_LIST_2026_27.filter((s) => s.category !== "Injectables").flatMap(
    (s) => s.items.map((i) => i.name),
  );
}
