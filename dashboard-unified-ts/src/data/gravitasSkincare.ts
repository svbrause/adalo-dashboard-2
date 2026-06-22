/**
 * Gravitas Medspa — skincare catalog, quiz mappings, and in-practice protocol sheets.
 * Products: Gravitas, Olivia Quido, Cleopatra, and Primocyn lines (+ protocol support items).
 * Protocols: Clear Skin Guide and Acne Erase Protocol (post-peel + maintenance regimens).
 *
 * @see https://www.gravitasmedspa.com/products-list
 */

import type { GemstoneId, RoutineStep } from "./skinTypeQuiz";
import type { TreatmentBoutiqueProduct } from "../components/modals/DiscussedTreatmentsModal/treatmentBoutiqueProducts";
import { GRAVITAS_SKINCARE_IMAGES } from "./providerSkincareImages";

const PRODUCTS_PAGE = "https://www.gravitasmedspa.com/products-list";

/** Canonical pipe-delimited product names for quiz + carousel matching. */
export const GRAVITAS_SKINCARE_PRODUCT_NAMES = {
  // Gravitas line
  skinVitalizingCleanser:
    "Skin Vitalizing Cleanser | Gentle botanical daily cleanser for sensitive skin",
  skinVitalizingToner:
    "Skin Vitalizing Toner | pH-balanced toner to prep and hydrate",
  luminousOilCleanser:
    "Luminous Oil Cleanser | Oil cleanser for makeup and sunscreen removal",
  oilControlCleanser:
    "Oil Control Cleanser | Salicylic acid cleanser for breakout-prone skin",
  oilControlToner:
    "Oil Control Toner | Salicylic + papaya enzyme toner for oily/acne skin",
  powerhouseVitC:
    "Powerhouse Vit. C Plus | 15% L-ascorbic antioxidant serum",
  biomeBalance:
    "Biome Balance | Hydrating niacinamide + peptide barrier serum",
  glassSkinSerum:
    "Glass Skin Serum | Pore-refining brightening serum",
  cellRepair:
    "Cell Repair w/ Growth Factor | Collagen-support recovery cream",
  silkySmoothPlus:
    "Silky Smooth Plus (Retinol w/ Bakuchiol Serum) | Gentle retinoid for renewal",
  exoluxCream:
    "Exolux Regenerative Cream | Post-procedure recovery and barrier support",
  uvProtectTint:
    "UV Protect SPF 44 w/ Tint and Hyaluronic Acid | Tinted mineral daily SPF",
  matteZincSpf:
    "Matte Tinted Zinc UV Defense | Matte mineral SPF for oily skin",
  zincSpf:
    "Zinc UV Defense | Hydrating broad-spectrum mineral sunscreen",
  freshlookEye:
    "Freshlook Eye Repair Cream | Retinoid + peptide eye cream",
  blemishCorrector:
    "Blemish Corrector | Hydroquinone-free brightening corrector",
  acneEraseCream:
    "Acne Erase Cream | Benzoyl peroxide spot treatment",
  pumiceScrub: "Pumice Scrub | Weekly microdermabrasion-style exfoliant",
  sulfurMask: "Sulfur Mask | Clarifying mask for congested skin",
  pumpkinMask: "Pumpkin Renewal Mask | Enzyme brightening treatment mask",
  // Olivia Quido
  cleansingMilk:
    "Cleansing Milk | Ultra-gentle hydrating Olivia Quido cleanser",
  balancingToner:
    "Balancing Toner | Alcohol-free pH-balancing Olivia Quido toner",
  activeMoisturizer:
    "Active Moisturizer | Resurfacing daily hydrator with gentle acids",
  vitaminCSerum20:
    "Vitamin C Serum 20% | High-potency brightening serum",
  bhaEssence:
    "BHA Exfoliating Essence 2% | Leave-on salicylic exfoliant",
  broadSpectrumSpf50:
    "Broad Spectrum SPF 50 | Lightweight hybrid daily sunscreen",
  secretPearl: "Secret Pearl | Brightening anti-aging niacinamide complex",
  secretRadiance: "Secret Radiance | Night pigment-correcting cream",
  secretGold: "Secret Gold Overnight Mask | 24K brightening overnight mask",
  secretGlow: "Secret Glow Overnight Mask | Overnight firming brightening mask",
  beautyOil: "Beauty Oil | Bakuchiol beauty oil for fine lines",
  ff1: "FF1 Firm & Fade | Prescription at-home brightening (provider-directed)",
  ff2: "FF2 Firm & Fade | Prescription at-home brightening step 2 (provider-directed)",
  // Cleopatra
  youthSerumElixir:
    "Youth Serum Elixir | Botanical anti-aging facial oil serum",
  acneBlend: "Acne Blend | Essential-oil acne spot blend",
  // Primocyn + protocol support
  primocynHydrogel:
    "Primocyn Hydrogel 6oz | Soothing post-procedure hydrogel",
  primocynSolution:
    "Primocyn Solution 236ml | Calming antimicrobial skin solution spray",
  cetaphilWash:
    "Cetaphil Gentle Cleanser | Sensitive-skin wash for irritated recovery",
  aquaphor: "Aquaphor | Occlusive barrier ointment for peeling recovery",
  hydrocortisone:
    "Hydrocortisone Cream 1% | Short-term anti-redness support (as directed)",
  benadrylCream:
    "Benadryl Cream | PM soothing support during irritated recovery",
  // Protocol aliases (Clear Skin / Acne Erase sheets)
  acneCream: "Acne Cream | Spot treatment (Acne Erase protocol)",
  hydratingGel: "Hydrating Gel | Lightweight hydration (post-peel protocol)",
} as const;

export type GravitasSkincareProductName =
  (typeof GRAVITAS_SKINCARE_PRODUCT_NAMES)[keyof typeof GRAVITAS_SKINCARE_PRODUCT_NAMES];

const P = GRAVITAS_SKINCARE_PRODUCT_NAMES;

type GravitasSkincareImageKey = keyof typeof GRAVITAS_SKINCARE_IMAGES;

function productRow(
  imageKey: GravitasSkincareImageKey,
  name: GravitasSkincareProductName,
  productUrl = PRODUCTS_PAGE,
): TreatmentBoutiqueProduct {
  return {
    name,
    productUrl,
    imageUrl: GRAVITAS_SKINCARE_IMAGES[imageKey],
  };
}

/** Full boutique carousel — Gravitas + Olivia Quido + Cleopatra + Primocyn. */
export const GRAVITAS_SKINCARE_CAROUSEL: TreatmentBoutiqueProduct[] = [
  productRow("skinVitalizingCleanser", P.skinVitalizingCleanser),
  productRow("skinVitalizingToner", P.skinVitalizingToner),
  productRow("luminousOilCleanser", P.luminousOilCleanser),
  productRow("oilControlCleanser", P.oilControlCleanser),
  productRow("oilControlToner", P.oilControlToner),
  productRow("powerhouseVitC", P.powerhouseVitC),
  productRow("biomeBalance", P.biomeBalance),
  productRow("glassSkinSerum", P.glassSkinSerum),
  productRow("cellRepair", P.cellRepair),
  productRow("silkySmoothPlus", P.silkySmoothPlus),
  productRow("exoluxCream", P.exoluxCream),
  productRow("uvProtectTint", P.uvProtectTint),
  productRow("matteZincSpf", P.matteZincSpf),
  productRow("zincSpf", P.zincSpf),
  productRow("freshlookEye", P.freshlookEye),
  productRow("blemishCorrector", P.blemishCorrector),
  productRow("acneEraseCream", P.acneEraseCream),
  productRow("pumiceScrub", P.pumiceScrub),
  productRow("sulfurMask", P.sulfurMask),
  productRow("pumpkinMask", P.pumpkinMask),
  productRow("cleansingMilk", P.cleansingMilk),
  productRow("balancingToner", P.balancingToner),
  productRow("activeMoisturizer", P.activeMoisturizer),
  productRow("vitaminCSerum20", P.vitaminCSerum20),
  productRow("bhaEssence", P.bhaEssence),
  productRow("broadSpectrumSpf50", P.broadSpectrumSpf50),
  productRow("secretPearl", P.secretPearl),
  productRow("secretRadiance", P.secretRadiance),
  productRow("secretGold", P.secretGold),
  productRow("secretGlow", P.secretGlow),
  productRow("beautyOil", P.beautyOil),
  productRow("ff1", P.ff1),
  productRow("ff2", P.ff2),
  productRow("youthSerumElixir", P.youthSerumElixir),
  productRow("acneBlend", P.acneBlend),
  productRow("primocynHydrogel", P.primocynHydrogel),
  productRow("primocynSolution", P.primocynSolution),
  productRow("cetaphilWash", P.cetaphilWash),
  productRow("aquaphor", P.aquaphor),
  productRow("hydrocortisone", P.hydrocortisone),
  productRow("benadrylCream", P.benadrylCream),
  productRow("acneCream", P.acneCream),
  productRow("hydratingGel", P.hydratingGel),
];

export function gravitasSkincareShortName(fullName: string): string {
  return fullName.split("|")[0]?.trim() ?? fullName;
}

export const GRAVITAS_SKINCARE_PLAN_PRODUCTS: readonly string[] =
  GRAVITAS_SKINCARE_CAROUSEL.map((p) => gravitasSkincareShortName(p.name));

export const GRAVITAS_RECOMMENDED_PRODUCT_REASONS: Record<string, string> = {
  [P.skinVitalizingCleanser]: "Gentle daily cleanse for sensitive skin",
  [P.oilControlCleanser]: "Salicylic cleanse for congested pores",
  [P.luminousOilCleanser]: "First-step oil cleanse (PM protocol)",
  [P.cleansingMilk]: "Ultra-gentle Olivia Quido cleanse option",
  [P.skinVitalizingToner]: "Prep and hydrate after cleanse",
  [P.oilControlToner]: "Oil control and pore clarity",
  [P.balancingToner]: "pH balance and prep for actives",
  [P.powerhouseVitC]: "Antioxidant + brightening (Clear Skin AM)",
  [P.vitaminCSerum20]: "High-potency vitamin C brightening",
  [P.youthSerumElixir]: "Botanical renewal serum (Clear Skin / Acne Erase)",
  [P.biomeBalance]: "Barrier hydration and calm",
  [P.glassSkinSerum]: "Texture and pore refinement",
  [P.acneBlend]: "Natural acne spot support",
  [P.blemishCorrector]: "Even tone and post-acne marks",
  [P.acneEraseCream]: "Benzoyl peroxide spot treatment",
  [P.acneCream]: "Acne Erase protocol spot treatment",
  [P.freshlookEye]: "Periorbital fine lines and puffiness",
  [P.cellRepair]: "Growth-factor repair and firmness",
  [P.secretPearl]: "Brightening overnight support",
  [P.secretGold]: "Mon/Thu mask night (Clear Skin protocol)",
  [P.secretGlow]: "Overnight glow and firmness",
  [P.silkySmoothPlus]: "Retinol + bakuchiol renewal (PM most nights)",
  [P.ff1]: "Provider-directed fade cream — hold before peels",
  [P.ff2]: "Provider-directed fade step 2 — hold before peels",
  [P.uvProtectTint]: "Tinted daily SPF with hyaluronic acid",
  [P.broadSpectrumSpf50]: "Daily hybrid SPF 50",
  [P.zincSpf]: "Mineral UV defense",
  [P.matteZincSpf]: "Matte SPF for oily/acne skin",
  [P.primocynSolution]: "Calming mist throughout the day",
  [P.primocynHydrogel]: "Post-peel soothing hydrogel",
  [P.pumiceScrub]: "Weekly exfoliation (Mon/Thu protocol)",
  [P.pumpkinMask]: "Alternate weekly with Pumice Scrub",
  [P.sulfurMask]: "Mon/Thu clarifying mask (Acne Erase)",
  [P.activeMoisturizer]: "Lightweight hydration",
  [P.hydratingGel]: "Post-peel lightweight moisture",
  [P.exoluxCream]: "Recovery after in-office treatments",
  [P.cetaphilWash]: "Irritated-skin recovery cleanse",
  [P.aquaphor]: "Barrier support during heavy peeling",
  [P.hydrocortisone]: "Short-term redness relief (as directed)",
  [P.benadrylCream]: "PM soothing during irritation protocol",
};

/** Patient-facing protocol notes (from in-practice Clear Skin + Acne Erase sheets). */
export const GRAVITAS_PROTOCOL_NOTES = {
  postPeel: [
    "Expect redness, dryness, itchiness, and peeling during recovery.",
    "Avoid waxing the face or brows; avoid heat, sun, sauna, and heavy sweating.",
    "Use white toothpaste only — no colored toothpaste or mouthwash.",
    "Stop FF1 or FF2 as directed by your provider before your next appointment.",
    "Send front, right, and left photos without filters during peeling so your regimen can be adjusted.",
  ],
  irritatedRecovery:
    "If skin becomes too dry, red, or irritated, follow the 5–7 day recovery regimen (Cetaphil, Primocyn Hydrogel, Aquaphor, and as-directed hydrocortisone/Benadryl) shown in your PM/AM steps.",
} as const;

function step(label: string, ...productNames: GravitasSkincareProductName[]): RoutineStep {
  return { label, productNames: [...productNames] };
}

/** Clear Skin Guide — maintenance AM regimen (from protocol sheet). */
function clearSkinAmRoutine(): RoutineStep[] {
  return [
    step(
      "Cleanse — Skin Vitalizing Cleanser, Cleansing Milk, or Oil Control Cleanser",
      P.skinVitalizingCleanser,
      P.cleansingMilk,
      P.oilControlCleanser,
    ),
    step("Tone — Skin Vitalizing Toner", P.skinVitalizingToner),
    step(
      "Treat — Powerhouse Vit. C Plus (3–4 drops, massage in)",
      P.powerhouseVitC,
    ),
    step(
      "Serum — Youth Serum Elixir (5–6 drops face, 3–4 neck)",
      P.youthSerumElixir,
    ),
    step("Spot — Acne Blend (breakouts only)", P.acneBlend),
    step("Barrier — Biome Balance (3–4 drops face, 2–3 neck)", P.biomeBalance),
    step("Eyes — Freshlook Eye Cream", P.freshlookEye),
    step("Correct — Blemish Corrector (2–3 pumps)", P.blemishCorrector),
    step("Repair — Cell Repair or Secret Pearl", P.cellRepair, P.secretPearl),
    step(
      "Protect — UV Protect SPF 44 Tint or Broad Spectrum SPF 50",
      P.uvProtectTint,
      P.broadSpectrumSpf50,
    ),
    step(
      "Mist as needed — Primocyn Solution or Balancing Toner",
      P.primocynSolution,
      P.balancingToner,
    ),
  ];
}

/** Clear Skin Guide — PM most nights (Tue–Sun). */
function clearSkinPmMostNights(): RoutineStep[] {
  return [
    step("First cleanse — Luminous Oil Cleanser", P.luminousOilCleanser),
    step(
      "Second cleanse — Skin Vitalizing Cleanser or Cleansing Milk",
      P.skinVitalizingCleanser,
      P.cleansingMilk,
    ),
    step("Eyes — Freshlook Eye Cream", P.freshlookEye),
    step(
      "Treat — Vitamin C Serum 20%, Acne Blend, or Youth Serum Elixir",
      P.vitaminCSerum20,
      P.acneBlend,
      P.youthSerumElixir,
    ),
    step("Correct — Blemish Corrector (2–3 pumps)", P.blemishCorrector),
    step(
      "Renew — Silky Smooth Plus (retinol + bakuchiol)",
      P.silkySmoothPlus,
    ),
    step("Hydrate — Biome Balance", P.biomeBalance),
    step(
      "Fade — FF1 (hold 4 days before next facial; restart every other day if stinging)",
      P.ff1,
    ),
    step("Repair — Cell Repair or Biome Balance", P.cellRepair, P.biomeBalance),
  ];
}

/** Acne Erase Protocol — AM regimen. */
function acneEraseAmRoutine(): RoutineStep[] {
  return [
    step(
      "Cleanse — Oil Control Cleanser, Cleansing Milk, or Skin Vitalizing Cleanser",
      P.oilControlCleanser,
      P.cleansingMilk,
      P.skinVitalizingCleanser,
    ),
    step("Tone — Oil Control Toner (spray entire face)", P.oilControlToner),
    step("Barrier — Biome Balance (3–4 face, 2–3 neck)", P.biomeBalance),
    step(
      "Serum — Youth Serum Elixir (4–5 face, 2–3 neck)",
      P.youthSerumElixir,
    ),
    step("Eyes — Freshlook Eye Cream", P.freshlookEye),
    step("Correct — Blemish Corrector (2–3 pumps)", P.blemishCorrector),
    step("Protect — Matte Tinted Zinc or Zinc UV Defense", P.matteZincSpf, P.zincSpf),
    step("Mist — Primocyn Solution throughout the day", P.primocynSolution),
  ];
}

/** Acne Erase Protocol — PM most nights. */
function acneErasePmMostNights(): RoutineStep[] {
  return [
    step("First cleanse — Luminous Oil Cleanser (1 pump, emulsify, rinse)", P.luminousOilCleanser),
    step(
      "Second cleanse — Oil Control or Skin Vitalizing Cleanser",
      P.oilControlCleanser,
      P.skinVitalizingCleanser,
    ),
    step("Tone — Oil Control Toner", P.oilControlToner),
    step(
      "Treat — Acne Blend, Biome Balance, or Freshlook Eye Cream",
      P.acneBlend,
      P.biomeBalance,
      P.freshlookEye,
    ),
    step(
      "Fade — FF1 (hold 5 days before facial; hold 1 month after 6 months use)",
      P.ff1,
    ),
    step("Renew — Silky Smooth Plus", P.silkySmoothPlus),
    step(
      "Spot — Blemish Corrector or Acne Erase Cream (Q-tip spot only)",
      P.blemishCorrector,
      P.acneEraseCream,
    ),
    step("Mist — Primocyn Solution", P.primocynSolution),
  ];
}

/** Acne Erase Protocol — PM Mon & Thu (see optional block in quiz results). */
const ACNE_ERASE_PM_MON_THU_PRODUCTS: GravitasSkincareProductName[] = [
  P.luminousOilCleanser,
  P.oilControlCleanser,
  P.sulfurMask,
  P.biomeBalance,
  P.secretGold,
];

/** Post-peel AM/PM (both protocol sheets). */
function postPeelRoutine(period: "am" | "pm"): RoutineStep[] {
  if (period === "am") {
    return [
      step(
        "Cleanse — Cleansing Milk or Skin Vitalizing Cleanser",
        P.cleansingMilk,
        P.skinVitalizingCleanser,
      ),
      step("Hydrate — Hydrating Gel or Active Moisturizer", P.hydratingGel, P.activeMoisturizer),
      step("Protect — Broad Spectrum SPF 50 (face and neck)", P.broadSpectrumSpf50),
    ];
  }
  return [
    step(
      "Cleanse — Cleansing Milk or Skin Vitalizing Cleanser",
      P.cleansingMilk,
      P.skinVitalizingCleanser,
    ),
    step("Hydrate — Hydrating Gel or Active Moisturizer", P.hydratingGel, P.activeMoisturizer),
    step("Spot — Acne Cream (spot treatment only)", P.acneCream, P.acneEraseCream),
  ];
}

/** If too dry/red/irritated — 5–7 day recovery (both protocol sheets). */
function irritatedRecoveryRoutine(period: "am" | "pm"): RoutineStep[] {
  if (period === "am") {
    return [
      step("Cleanse — Cetaphil Gentle Cleanser", P.cetaphilWash),
      step("Soothe — Primocyn Hydrogel", P.primocynHydrogel),
      step("Barrier — Aquaphor", P.aquaphor),
      step("Calm — Hydrocortisone Cream 1% (as directed)", P.hydrocortisone),
      step("Protect — Zinc UV Defense (face and neck)", P.zincSpf),
    ];
  }
  return [
    step("Cleanse — Cetaphil Gentle Cleanser", P.cetaphilWash),
    step("Soothe — Primocyn Hydrogel", P.primocynHydrogel),
    step("Barrier — Aquaphor", P.aquaphor),
    step("Calm — Benadryl Cream", P.benadrylCream),
  ];
}

type GravitasRoutine = {
  am: RoutineStep[];
  pm: RoutineStep[];
  optional?: { label: string; productNames: string[] };
  protocolLabel?: string;
};

function withClearSkinGuide(base: GravitasRoutine): GravitasRoutine {
  return {
    ...base,
    protocolLabel: "Clear Skin Guide",
    optional: base.optional ?? {
      label: "Mon & Thu PM — Pumice Scrub or Pumpkin Mask (alternate weekly)",
      productNames: [
        P.pumiceScrub,
        P.pumpkinMask,
        P.secretGold,
        P.secretPearl,
        P.luminousOilCleanser,
        P.skinVitalizingCleanser,
      ],
    },
  };
}

function withAcneErase(base: GravitasRoutine): GravitasRoutine {
  return {
    ...base,
    protocolLabel: "Acne Erase Protocol",
    optional: {
      label: "Mon & Thu PM — Sulfur Mask + Secret Gold (Acne Erase sheet)",
      productNames: [...ACNE_ERASE_PM_MON_THU_PRODUCTS],
    },
  };
}

/** Gemstone → Gravitas protocol routines. */
export const GRAVITAS_ROUTINE_NOTES_BY_SKIN_TYPE: Record<GemstoneId, GravitasRoutine> = {
  opal: withAcneErase({
    am: acneEraseAmRoutine(),
    pm: acneErasePmMostNights(),
  }),
  pearl: withAcneErase({
    am: acneEraseAmRoutine(),
    pm: acneErasePmMostNights(),
  }),
  jade: withClearSkinGuide({
    am: clearSkinAmRoutine(),
    pm: clearSkinPmMostNights(),
  }),
  quartz: withClearSkinGuide({
    am: clearSkinAmRoutine().slice(0, 8),
    pm: clearSkinPmMostNights().slice(0, 6),
  }),
  amber: withClearSkinGuide({
    am: [
      step("Cleanse — Cleansing Milk (gentle)", P.cleansingMilk),
      step("Tone — Balancing Toner", P.balancingToner),
      step("Hydrate — Biome Balance", P.biomeBalance),
      step("Correct — Blemish Corrector", P.blemishCorrector),
      step("Protect — UV Protect SPF 44 Tint", P.uvProtectTint),
    ],
    pm: [
      step("Cleanse — Cleansing Milk", P.cleansingMilk),
      step("Treat — Secret Pearl or Youth Serum Elixir", P.secretPearl, P.youthSerumElixir),
      step("Repair — Exolux Regenerative Cream", P.exoluxCream),
    ],
    optional: {
      label: "If irritated: 5–7 day recovery regimen (Cetaphil + Primocyn + Aquaphor)",
      productNames: [P.cetaphilWash, P.primocynHydrogel, P.aquaphor],
    },
  }),
  moonstone: withClearSkinGuide({
    am: [
      step("Cleanse — Cleansing Milk", P.cleansingMilk),
      step("Hydrate — Active Moisturizer", P.activeMoisturizer),
      step("Protect — Broad Spectrum SPF 50", P.broadSpectrumSpf50),
    ],
    pm: [
      step("Cleanse — Cleansing Milk", P.cleansingMilk),
      step("Hydrate — Biome Balance + Beauty Oil", P.biomeBalance, P.beautyOil),
    ],
  }),
  turquoise: withClearSkinGuide({
    am: clearSkinAmRoutine(),
    pm: clearSkinPmMostNights(),
  }),
  diamond: withClearSkinGuide({
    am: clearSkinAmRoutine(),
    pm: clearSkinPmMostNights(),
  }),
};

/** Exported for quiz UI — post-peel + recovery steps referenced on protocol sheets. */
export const GRAVITAS_POST_PEEL_ROUTINES = {
  am: postPeelRoutine("am"),
  pm: postPeelRoutine("pm"),
  notes: GRAVITAS_PROTOCOL_NOTES.postPeel,
};

export const GRAVITAS_IRRITATED_RECOVERY_ROUTINES = {
  am: irritatedRecoveryRoutine("am"),
  pm: irritatedRecoveryRoutine("pm"),
  notes: GRAVITAS_PROTOCOL_NOTES.irritatedRecovery,
};

function uniqueFromRoutine(gemstone: GemstoneId): string[] {
  const routine = GRAVITAS_ROUTINE_NOTES_BY_SKIN_TYPE[gemstone];
  const names = new Set<string>();
  for (const block of [routine.am, routine.pm]) {
    for (const s of block) {
      for (const n of s.productNames) names.add(n);
    }
  }
  if (routine.optional) {
    for (const n of routine.optional.productNames) names.add(n);
  }
  return Array.from(names);
}

export const GRAVITAS_SKIN_TYPE_TO_PRODUCTS: Record<GemstoneId, string[]> = {
  opal: uniqueFromRoutine("opal"),
  pearl: uniqueFromRoutine("pearl"),
  jade: uniqueFromRoutine("jade"),
  quartz: uniqueFromRoutine("quartz"),
  amber: uniqueFromRoutine("amber"),
  moonstone: uniqueFromRoutine("moonstone"),
  turquoise: uniqueFromRoutine("turquoise"),
  diamond: uniqueFromRoutine("diamond"),
};

export const GRAVITAS_TREATMENT_RECOMMENDATIONS_BY_SKIN_TYPE: Record<
  GemstoneId,
  { heading: string; items: string[] }
> = {
  opal: {
    heading: "Reactive, pigmented, breakout-prone — Acne Erase Protocol",
    items: [
      "Acne Treatment w/ Blue LED Light Therapy — extractions + blue light",
      "Skin Peeling — when your provider clears you after assessment",
      "Medical Extractions — professional decongestion",
      "Skinpen Microneedling — texture and scarring when ready",
    ],
  },
  pearl: {
    heading: "Sensitive skin with congestion — gentle in-office support",
    items: [
      "Glow N Go Facial — calming glow with biocellulose mask",
      "Acne Treatment w/ Blue LED Light Therapy",
      "LED Light Therapy add-on — red or blue as recommended",
      "Skin Vitalizing Experience — hydration + paraffin relaxation",
    ],
  },
  jade: {
    heading: "Pigment and sun damage — Clear Skin Guide + brightening facials",
    items: [
      "Skin Peeling — depigmentation protocol",
      "Ultimate Oxylux Experience — oxygenation + LED",
      "Skinpen Microneedling — tone and texture renewal",
      "Gluta C IV Therapy — antioxidant brightening support",
    ],
  },
  quartz: {
    heading: "Resilient skin — prevention and maintenance",
    items: [
      "Skin Vitalizing Experience — monthly glow maintenance",
      "Red Light Therapy — collagen and wellness support",
      "Botox — expression refinement as goals evolve",
      "Radiance Infusion Express — pre-event glow",
    ],
  },
  amber: {
    heading: "Dry, sensitive, discolored — Clear Skin Guide (gentle)",
    items: [
      "Skin Vitalizing Experience — customized hydration facial",
      "Skin Peeling — when barrier is ready (provider assessment)",
      "Paraffin Treatment add-on — hands and feet nourishment",
      "Ultra C Wellness Drip — antioxidant + hydration support",
    ],
  },
  moonstone: {
    heading: "Delicate, dry skin — barrier-first care",
    items: [
      "Glow N Go Facial — gentle cleanse and mask",
      "Skin Vitalizing Experience — deep hydration",
      "Red Light Therapy — calm collagen support",
      "Hydration Renewal Drip — internal hydration boost",
    ],
  },
  turquoise: {
    heading: "Pigment with tolerant skin — Clear Skin + resurfacing",
    items: [
      "Skin Peeling — melasma / sun spot protocol",
      "Ultimate Skin Veneer Experience — tightening + brightening",
      "PRP Microneedling — regenerative renewal",
      "Gluta C - Brilliance (Package of 8) — sustained brightening",
    ],
  },
  diamond: {
    heading: "Mature, resilient skin — advanced renewal",
    items: [
      "Ultimate Oxylux Experience — full oxygenation protocol",
      "PRP Microneedling — collagen regeneration",
      "Botox — softening dynamic lines",
      "Fountain of Youth IV — anti-aging wellness infusion",
    ],
  },
};

const S = gravitasSkincareShortName;

export const GRAVITAS_RECOMMENDED_PRODUCTS_BY_CONTEXT: {
  treatment: string;
  keywords: string[];
  products: string[];
}[] = [
  {
    treatment: "Skincare",
    keywords: ["hydrate", "dry", "moisturize", "barrier", "dehydrat"],
    products: [
      S(P.biomeBalance),
      S(P.activeMoisturizer),
      S(P.cleansingMilk),
      S(P.exoluxCream),
    ],
  },
  {
    treatment: "Skincare",
    keywords: ["oil", "acne", "breakout", "congest", "pore"],
    products: [
      S(P.oilControlCleanser),
      S(P.oilControlToner),
      S(P.acneBlend),
      S(P.acneEraseCream),
      S(P.sulfurMask),
    ],
  },
  {
    treatment: "Skincare",
    keywords: ["pigment", "spot", "melasma", "sun", "tone", "bright"],
    products: [
      S(P.blemishCorrector),
      S(P.powerhouseVitC),
      S(P.secretPearl),
      S(P.ff1),
      S(P.vitaminCSerum20),
    ],
  },
  {
    treatment: "Skincare",
    keywords: ["red", "sensitive", "rosacea", "irritat", "peel"],
    products: [
      S(P.cleansingMilk),
      S(P.primocynHydrogel),
      S(P.exoluxCream),
      S(P.cetaphilWash),
      S(P.aquaphor),
    ],
  },
  {
    treatment: "Skincare",
    keywords: ["wrinkle", "line", "aging", "firm", "retinol"],
    products: [
      S(P.silkySmoothPlus),
      S(P.cellRepair),
      S(P.youthSerumElixir),
      S(P.secretRadiance),
    ],
  },
  {
    treatment: "Skincare",
    keywords: ["eye", "puff", "dark circle"],
    products: [S(P.freshlookEye)],
  },
  {
    treatment: "Skincare",
    keywords: ["spf", "sun", "uv"],
    products: [S(P.broadSpectrumSpf50), S(P.uvProtectTint), S(P.zincSpf)],
  },
];
