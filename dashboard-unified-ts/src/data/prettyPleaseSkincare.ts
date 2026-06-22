/**
 * Pretty Please Aesthetics — skincare catalog and quiz mappings.
 * Products sourced from prettypleaseaesthetics.shop (HydroPeptide, Revision, Hydrinity, etc.).
 *
 * @see https://prettypleaseaesthetics.shop/
 */

import type { GemstoneId, RoutineStep } from "./skinTypeQuiz";
import type { TreatmentBoutiqueProduct } from "../components/modals/DiscussedTreatmentsModal/treatmentBoutiqueProducts";
import { PRETTY_PLEASE_SKINCARE_IMAGES } from "./providerSkincareImages";

const SHOP_BASE = "https://prettypleaseaesthetics.shop/products/";

export const PRETTY_PLEASE_CORE_REGIMEN_NOTE =
  "Back to basics: Cleanse → Exfoliate → Tone — then add targeted serums and daily SPF.";

export const PRETTY_PLEASE_SKINCARE_PRODUCT_NAMES = {
  dailySerum: "DAILY Serum | (plated) Skin Science medical-grade skincare",
  hairSerum: "HAIR Serum | (plated) Skin Science medical-grade skincare",
  intenseSerum: "INTENSE Serum | (plated) Skin Science medical-grade skincare",
  regeneratingSkinNectar: "Regenerating Skin Nectar | Alastin medical-grade skincare",
  sunforgettableTotalProtectionFaceShieldFlexSpf50: "Sunforgettable Total Protection Face Shield Flex SPF 50 | Colorescience medical-grade skincare",
  totalProtectionNoShowMineralSunscreenSpf50: "Total Protection No-Show Mineral Sunscreen SPF 50 | Colorescience medical-grade skincare",
  lipidRecoveryMask: "Lipid Recovery Mask | Epicutis medical-grade skincare",
  lipidRecoveryMaskForEyes: "Lipid Recovery Mask For Eyes | Epicutis medical-grade skincare",
  lipidSerum: "Lipid Serum | Epicutis medical-grade skincare",
  hyacynActivePurifyingMist: "Hyacyn Active Purifying Mist | Hydrinity medical-grade skincare",
  preludeFacialTreatmentCleanser: "Prelude Facial Treatment Cleanser | Hydrinity medical-grade skincare",
  restorativeHaMasque: "Restorative HA+ Masque | Hydrinity medical-grade skincare",
  aquaboost: "Aquaboost | HydroPeptide medical-grade skincare",
  clarifyingTonerPads: "Clarifying Toner Pads | HydroPeptide medical-grade skincare",
  cleansingGel: "Cleansing Gel | HydroPeptide medical-grade skincare",
  collagenReactivatePm: "Collagen ReActivate PM | HydroPeptide medical-grade skincare",
  eyeAuthority: "Eye Authority | HydroPeptide medical-grade skincare",
  firmaBright: "Firma-Bright | HydroPeptide medical-grade skincare",
  foamingCreamCleanser: "Foaming Cream Cleanser | HydroPeptide medical-grade skincare",
  hydroactiveCleanse: "Hydroactive Cleanse | HydroPeptide medical-grade skincare",
  lipService: "Lip Service | HydroPeptide medical-grade skincare",
  lumaproCSerum: "LumaPro-C Serum | HydroPeptide medical-grade skincare",
  nimniDayCream: "Nimni Day Cream | HydroPeptide medical-grade skincare",
  powerLift: "Power Lift | HydroPeptide medical-grade skincare",
  powerSerum: "Power Serum | HydroPeptide medical-grade skincare",
  solarDefenseBodySpf30: "Solar Defense Body SPF 30 | HydroPeptide medical-grade skincare",
  solarDefenseTintedSpf30: "Solar Defense Tinted SPF 30 | HydroPeptide medical-grade skincare",
  solarDew: "Solar Dew | HydroPeptide medical-grade skincare",
  soothingSerum: "Soothing Serum | HydroPeptide medical-grade skincare",
  spotCorrection: "Spot Correction | HydroPeptide medical-grade skincare",
  tripleAcidPeptidePeel: "Triple Acid Peptide Peel | HydroPeptide medical-grade skincare",
  vitalEyes: "Vital Eyes | HydroPeptide medical-grade skincare",
  haReplenishingEyeSerum: "HA+ Replenishing Eye Serum | Ourself medical-grade skincare",
  replenishingLipFiller: "Replenishing Lip Filler | Ourself medical-grade skincare",
  brighteningFacialWash: "Brightening Facial Wash | Revision Skincare medical-grade skincare",
  dEJDailyBoostingSerum: "D·E·J Daily Boosting Serum | Revision Skincare medical-grade skincare",
  dEJEyeCream: "D·E·J Eye Cream | Revision Skincare medical-grade skincare",
  intellishadeClear: "Intellishade Clear | Revision Skincare medical-grade skincare",
  intellishadeMatte: "Intellishade Matte | Revision Skincare medical-grade skincare",
  intellishadeOriginal: "Intellishade Original | Revision Skincare medical-grade skincare",
  porePurifyingClayMask: "Pore Purifying Clay Mask | Revision Skincare medical-grade skincare",
  retinolComplete05: "Retinol Complete 0.5 | Revision Skincare medical-grade skincare",
  revoxLineRelaxer: "Revox Line Relaxer | Revision Skincare medical-grade skincare",
  tripleActionExfoliator: "Triple Action Exfoliator | Revision Skincare medical-grade skincare",
  youthfullLipReplenisher: "YouthFull Lip Replenisher | Revision Skincare medical-grade skincare",
} as const;

export type PrettyPleaseSkincareProductName =
  (typeof PRETTY_PLEASE_SKINCARE_PRODUCT_NAMES)[keyof typeof PRETTY_PLEASE_SKINCARE_PRODUCT_NAMES];

const P = PRETTY_PLEASE_SKINCARE_PRODUCT_NAMES;

type PrettyPleaseSkincareImageKey = keyof typeof PRETTY_PLEASE_SKINCARE_IMAGES;

function productRow(
  imageKey: PrettyPleaseSkincareImageKey,
  name: PrettyPleaseSkincareProductName,
  handle: string,
  price?: string,
): TreatmentBoutiqueProduct {
  return {
    name,
    productUrl: SHOP_BASE + handle,
    imageUrl: PRETTY_PLEASE_SKINCARE_IMAGES[imageKey],
    price: price ? `$${price}` : undefined,
  };
}

export const PRETTY_PLEASE_SKINCARE_CAROUSEL: TreatmentBoutiqueProduct[] = [
  productRow("dailySerum", P.dailySerum, "daily", "258.00"),
  productRow("hairSerum", P.hairSerum, "hair", "458.00"),
  productRow("intenseSerum", P.intenseSerum, "intense", "258.00"),
  productRow("regeneratingSkinNectar", P.regeneratingSkinNectar, "skin-nectar", "236.00"),
  productRow("sunforgettableTotalProtectionFaceShieldFlexSpf50", P.sunforgettableTotalProtectionFaceShieldFlexSpf50, "face-shield-flex-deep", "58.00"),
  productRow("totalProtectionNoShowMineralSunscreenSpf50", P.totalProtectionNoShowMineralSunscreenSpf50, "total-protection-no-show-mineral-sunscreen-spf-50", "48.00"),
  productRow("lipidRecoveryMask", P.lipidRecoveryMask, "lipid-recovery-mask", "20.00"),
  productRow("lipidRecoveryMaskForEyes", P.lipidRecoveryMaskForEyes, "lipid-recovery-mask-for-eyes", "18.00"),
  productRow("lipidSerum", P.lipidSerum, "lipid-serum", "250.00"),
  productRow("hyacynActivePurifyingMist", P.hyacynActivePurifyingMist, "hyacyn-active-purifying-mist", "60.00"),
  productRow("preludeFacialTreatmentCleanser", P.preludeFacialTreatmentCleanser, "prelude", "58.00"),
  productRow("restorativeHaMasque", P.restorativeHaMasque, "restorative-ha-masque", "24.00"),
  productRow("aquaboost", P.aquaboost, "aquaboost", "69.00"),
  productRow("clarifyingTonerPads", P.clarifyingTonerPads, "clarifying-toner-pads", "49.00"),
  productRow("cleansingGel", P.cleansingGel, "cleansing-gel", "49.00"),
  productRow("collagenReactivatePm", P.collagenReactivatePm, "nimni-cream", "112.00"),
  productRow("eyeAuthority", P.eyeAuthority, "eye-authority", "83.00"),
  productRow("firmaBright", P.firmaBright, "firma-bright", "133.00"),
  productRow("foamingCreamCleanser", P.foamingCreamCleanser, "foaming-cream-cleanser", "46.00"),
  productRow("hydroactiveCleanse", P.hydroactiveCleanse, "hydroactive-cleanse", "20.00"),
  productRow("lipService", P.lipService, "lip-service", "39.00"),
  productRow("lumaproCSerum", P.lumaproCSerum, "lumapro-c-serum", "149.00"),
  productRow("nimniDayCream", P.nimniDayCream, "nimni-day-cream", "112.00"),
  productRow("powerLift", P.powerLift, "power-lift", "110.00"),
  productRow("powerSerum", P.powerSerum, "power-serum", "154.00"),
  productRow("solarDefenseBodySpf30", P.solarDefenseBodySpf30, "solar-defense-body-spf-30", "49.00"),
  productRow("solarDefenseTintedSpf30", P.solarDefenseTintedSpf30, "solar-defense-tinted-spf-30", "53.00"),
  productRow("solarDew", P.solarDew, "solar-dew", "68.00"),
  productRow("soothingSerum", P.soothingSerum, "soothing-serum", "139.00"),
  productRow("spotCorrection", P.spotCorrection, "spot-correction", "39.00"),
  productRow("tripleAcidPeptidePeel", P.tripleAcidPeptidePeel, "triple-acid-peptide-peel", "89.00"),
  productRow("vitalEyes", P.vitalEyes, "vital-eyes", "112.00"),
  productRow("haReplenishingEyeSerum", P.haReplenishingEyeSerum, "ha-replenishing-eye-serum", "130.00"),
  productRow("replenishingLipFiller", P.replenishingLipFiller, "replenishing-lip-filler", "145.00"),
  productRow("brighteningFacialWash", P.brighteningFacialWash, "brightening-wash", "45.00"),
  productRow("dEJDailyBoostingSerum", P.dEJDailyBoostingSerum, "dej-daily-boosting-serum", "225.00"),
  productRow("dEJEyeCream", P.dEJEyeCream, "dej-eye-cream", "120.00"),
  productRow("intellishadeClear", P.intellishadeClear, "intellishade-clear", "86.00"),
  productRow("intellishadeMatte", P.intellishadeMatte, "intellishade-matte", "86.00"),
  productRow("intellishadeOriginal", P.intellishadeOriginal, "intellishade-original", "86.00"),
  productRow("porePurifyingClayMask", P.porePurifyingClayMask, "pore-purifying-clay-mask", "56.00"),
  productRow("retinolComplete05", P.retinolComplete05, "retinol-complete-0-5", "114.00"),
  productRow("revoxLineRelaxer", P.revoxLineRelaxer, "revox-line-relaxer", "154.00"),
  productRow("tripleActionExfoliator", P.tripleActionExfoliator, "triple-action", "75.00"),
  productRow("youthfullLipReplenisher", P.youthfullLipReplenisher, "youthfull-lip", "42.00"),
];

export function prettyPleaseSkincareShortName(fullName: string): string {
  return fullName.split("|")[0]?.trim() ?? fullName;
}

export const PRETTY_PLEASE_SKINCARE_PLAN_PRODUCTS: readonly string[] =
  PRETTY_PLEASE_SKINCARE_CAROUSEL.map((p) => prettyPleaseSkincareShortName(p.name));

function step(label: string, ...productNames: PrettyPleaseSkincareProductName[]): RoutineStep {
  return { label, productNames };
}

export const PRETTY_PLEASE_ROUTINE_NOTES_BY_SKIN_TYPE: Record<
  GemstoneId,
  {
    am: RoutineStep[];
    pm: RoutineStep[];
    optional?: { label: string; productNames: PrettyPleaseSkincareProductName[] };
  }
> = {
  opal: {
    am: [
      step("Cleanse — Foaming Cream Cleanser", P.foamingCreamCleanser),
      step("Tone — Clarifying Toner Pads", P.clarifyingTonerPads),
      step("Correct — Soothing Serum", P.soothingSerum),
      step("Protect — Solar Dew SPF", P.solarDew),
    ],
    pm: [
      step("Cleanse — Cleansing Gel", P.cleansingGel),
      step("Treat — LumaPro-C Serum", P.lumaproCSerum),
      step("Hydrate — Aquaboost", P.aquaboost),
    ],
  },
  pearl: {
    am: [
      step("Cleanse — Foaming Cream Cleanser", P.foamingCreamCleanser),
      step("Calm — Soothing Serum", P.soothingSerum),
      step("Protect — Total Protection No-Show SPF 50", P.totalProtectionNoShowMineralSunscreenSpf50),
    ],
    pm: [
      step("Cleanse — Prelude Facial Treatment Cleanser", P.preludeFacialTreatmentCleanser),
      step("Repair — Lipid Serum", P.lipidSerum),
      step("Hydrate — Restorative HA+ Masque 1–2×/week", P.restorativeHaMasque),
    ],
  },
  jade: {
    am: [
      step("Cleanse — Brightening Facial Wash", P.brighteningFacialWash),
      step("Tone — Clarifying Toner Pads", P.clarifyingTonerPads),
      step("Brighten — Firma-Bright", P.firmaBright),
      step("Protect — Intellishade Original", P.intellishadeOriginal),
    ],
    pm: [
      step("Cleanse — Brightening Facial Wash", P.brighteningFacialWash),
      step("Treat — LumaPro-C Serum", P.lumaproCSerum),
      step("Renew — Retinol Complete 0.5", P.retinolComplete05),
    ],
  },
  quartz: {
    am: [
      step("Cleanse — Cleansing Gel", P.cleansingGel),
      step("Tone — Clarifying Toner Pads", P.clarifyingTonerPads),
      step("Antioxidant — Power Serum", P.powerSerum),
      step("Protect — Solar Defense Tinted SPF 30", P.solarDefenseTintedSpf30),
    ],
    pm: [
      step("Cleanse — Cleansing Gel", P.cleansingGel),
      step("Treat — D·E·J Daily Boosting Serum", P.dEJDailyBoostingSerum),
      step("Hydrate — Power Lift", P.powerLift),
    ],
  },
  amber: {
    am: [
      step("Cleanse — Brightening Facial Wash", P.brighteningFacialWash),
      step("Tone — Clarifying Toner Pads (as tolerated)", P.clarifyingTonerPads),
      step("Calm + brighten — Soothing Serum", P.soothingSerum),
      step("Correct — Firma-Bright", P.firmaBright),
      step("Protect — Intellishade Original SPF", P.intellishadeOriginal),
    ],
    pm: [
      step("Cleanse — Foaming Cream Cleanser", P.foamingCreamCleanser),
      step("Treat — D·E·J Daily Boosting Serum", P.dEJDailyBoostingSerum),
      step("Renew — Retinol Complete 0.5", P.retinolComplete05),
      step("Hydrate — Power Lift", P.powerLift),
    ],
    optional: {
      label: "1–2×/week: Restorative HA+ Masque for extra barrier support",
      productNames: [P.restorativeHaMasque],
    },
  },
  moonstone: {
    am: [
      step("Cleanse — Prelude Facial Treatment Cleanser", P.preludeFacialTreatmentCleanser),
      step("Hydrate — Aquaboost", P.aquaboost),
      step("Protect — Intellishade Clear", P.intellishadeClear),
    ],
    pm: [
      step("Cleanse — Foaming Cream Cleanser", P.foamingCreamCleanser),
      step("Repair — Lipid Recovery Mask", P.lipidRecoveryMask),
      step("Nourish — Regenerating Skin Nectar", P.regeneratingSkinNectar),
    ],
  },
  turquoise: {
    am: [
      step("Cleanse — Brightening Facial Wash", P.brighteningFacialWash),
      step("Exfoliate — Triple Action Exfoliator (2–3×/week)", P.tripleActionExfoliator),
      step("Brighten — LumaPro-C Serum", P.lumaproCSerum),
      step("Protect — Sunforgettable Face Shield Flex SPF 50", P.sunforgettableTotalProtectionFaceShieldFlexSpf50),
    ],
    pm: [
      step("Cleanse — Brightening Facial Wash", P.brighteningFacialWash),
      step("Correct — Spot Correction", P.spotCorrection),
      step("Renew — Retinol Complete 0.5", P.retinolComplete05),
    ],
  },
  diamond: {
    am: [
      step("Cleanse — Cleansing Gel", P.cleansingGel),
      step("Antioxidant — D·E·J Daily Boosting Serum", P.dEJDailyBoostingSerum),
      step("Protect — Intellishade Matte", P.intellishadeMatte),
    ],
    pm: [
      step("Cleanse — Cleansing Gel", P.cleansingGel),
      step("Treat — Power Serum", P.powerSerum),
      step("Renew — Collagen ReActivate PM", P.collagenReactivatePm),
      step("Eye — D·E·J Eye Cream", P.dEJEyeCream),
    ],
  },
};

function uniqueFromRoutine(gemstone: GemstoneId): string[] {
  const routine = PRETTY_PLEASE_ROUTINE_NOTES_BY_SKIN_TYPE[gemstone];
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

export const PRETTY_PLEASE_SKIN_TYPE_TO_PRODUCTS: Record<GemstoneId, string[]> = {
  opal: uniqueFromRoutine("opal"),
  pearl: uniqueFromRoutine("pearl"),
  jade: uniqueFromRoutine("jade"),
  quartz: uniqueFromRoutine("quartz"),
  amber: uniqueFromRoutine("amber"),
  moonstone: uniqueFromRoutine("moonstone"),
  turquoise: uniqueFromRoutine("turquoise"),
  diamond: uniqueFromRoutine("diamond"),
};

export const PRETTY_PLEASE_RECOMMENDED_PRODUCT_REASONS: Record<string, string> = {
  [P.brighteningFacialWash]: "Revision brightening cleanse — core regimen step",
  [P.clarifyingTonerPads]: "Tone and clarify after cleanse",
  [P.foamingCreamCleanser]: "Gentle cream-to-foam cleanse",
  [P.soothingSerum]: "Calm reactive skin while treating pigment",
  [P.firmaBright]: "Target uneven tone and early photoaging",
  [P.lumaproCSerum]: "Vitamin C brightening serum",
  [P.intellishadeOriginal]: "Tinted daily SPF with peptides",
  [P.dEJDailyBoostingSerum]: "Structural support and antioxidant defense",
  [P.retinolComplete05]: "Gentle retinoid for renewal",
  [P.powerLift]: "Peptide moisturizer for dry skin",
  [P.restorativeHaMasque]: "Weekly HA hydration boost",
  [P.tripleActionExfoliator]: "Exfoliate step in core regimen",
  [P.spotCorrection]: "Focused pigment corrector",
  [P.solarDew]: "Lightweight daily SPF",
  [P.regeneratingSkinNectar]: "Post-procedure recovery support",
};

export const PRETTY_PLEASE_TREATMENT_RECOMMENDATIONS_BY_SKIN_TYPE: Record<
  GemstoneId,
  { heading: string; items: string[] }
> = {
  opal: {
    heading: "Reactive skin with pigment — gentle in-office options",
    items: [
      "Aerolase — Calm redness and support clarity",
      "HydraFacial — Hydrating, low-irritation facial",
      "Vi Peel — Pigment-focused peel when your provider agrees you're ready",
      "Microneedling — Texture support with proper prep",
    ],
  },
  pearl: {
    heading: "Sensitive, reactive skin — barrier-first care",
    items: [
      "Signature Facials — Custom calming protocol",
      "HydraFacial — Gentle hydration and glow",
      "LightStim LED Therapy — Soothing light therapy add-on",
      "Neurotoxin — Expression softening when appropriate",
    ],
  },
  jade: {
    heading: "Pigment and sun damage with tolerant skin",
    items: [
      "Vi Peel — Brightening and resurfacing",
      "Aerolase — Tone and redness refinement",
      "Microneedling — Collagen and texture renewal",
      "Chemical Peels — Provider-selected depth",
    ],
  },
  quartz: {
    heading: "Clear, resilient skin — maintenance and prevention",
    items: [
      "HydraFacial — Monthly skin health maintenance",
      "Botox — Prevention and expression balance",
      "Ultherapy — Collagen tightening over time",
      "Dermal Fillers — Subtle contour refinement",
    ],
  },
  amber: {
    heading: "Dry, sensitive skin with discoloration",
    items: [
      "Vi Peel — Even tone with structured home care",
      "HydraFacial — Hydrating brightening facial",
      "Microneedling — Texture when barrier is ready",
      "Aerolase — Gentle pigment and redness support",
    ],
  },
  moonstone: {
    heading: "Delicate, dry skin — nurturing professional care",
    items: [
      "Signature Facials — Hydration-first protocol",
      "HydraFacial — Gentle glow and comfort",
      "Glo2 Facial — Oxygenation and luminosity",
      "Dermal Fillers — Soft volume when goals include contour",
    ],
  },
  turquoise: {
    heading: "Pigment and early aging with tolerant skin",
    items: [
      "Vi Peel — Pigment and texture renewal",
      "Microneedling — Collagen induction series",
      "Chemical Peels — Custom in-office exfoliation",
      "Biostimulators — Gradual firmness and quality",
    ],
  },
  diamond: {
    heading: "Mature, resilient skin — structural support",
    items: [
      "Ultherapy — Non-surgical skin tightening",
      "Sculptra or Radiesse — Biostimulator quality and lift",
      "Botox — Refinement and prevention",
      "AquaGold Facial — Micro-delivery facial boost",
    ],
  },
};

const S = prettyPleaseSkincareShortName;

export const PRETTY_PLEASE_RECOMMENDED_PRODUCTS_BY_CONTEXT: {
  treatment: string;
  keywords: string[];
  products: string[];
}[] = [
  {
    treatment: "Skincare",
    keywords: ["hydrate", "dry", "moistur", "barrier", "dehydrat"],
    products: [S(P.aquaboost), S(P.powerLift), S(P.preludeFacialTreatmentCleanser)],
  },
  {
    treatment: "Skincare",
    keywords: ["oil", "acne", "breakout", "congest", "pore"],
    products: [
      S(P.clarifyingTonerPads),
      S(P.cleansingGel),
      S(P.spotCorrection),
      S(P.porePurifyingClayMask),
    ],
  },
  {
    treatment: "Skincare",
    keywords: ["pigment", "spot", "melasma", "sun", "tone", "bright"],
    products: [
      S(P.brighteningFacialWash),
      S(P.firmaBright),
      S(P.lumaproCSerum),
      S(P.retinolComplete05),
    ],
  },
  {
    treatment: "Skincare",
    keywords: ["red", "sensitive", "react", "rosacea"],
    products: [S(P.soothingSerum), S(P.hyacynActivePurifyingMist), S(P.lipidSerum)],
  },
  {
    treatment: "Skincare",
    keywords: ["eye", "puff", "dark circle"],
    products: [S(P.eyeAuthority), S(P.dEJEyeCream), S(P.vitalEyes)],
  },
  {
    treatment: "Skincare",
    keywords: ["spf", "sun", "protect"],
    products: [
      S(P.intellishadeOriginal),
      S(P.solarDew),
      S(P.totalProtectionNoShowMineralSunscreenSpf50),
    ],
  },
];

