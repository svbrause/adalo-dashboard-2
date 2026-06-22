/**
 * Pretty Please Aesthetics — plan builder / checkout for provider code `PrettyPlease5357`.
 * Services aligned with prettypleaseaesthetics.com sitemap; skincare from prettypleaseaesthetics.shop.
 *
 * @see https://www.prettypleaseaesthetics.com/sitemap/
 * @see https://prettypleaseaesthetics.shop/
 */

import type { ProviderPricingJson } from "./treatmentPricing2025";
import { PRETTY_PLEASE_SKINCARE_PLAN_PRODUCTS } from "./prettyPleaseSkincare";

export const PRETTY_PLEASE_PROVIDER_CODE = "PrettyPlease5357";

export const PRETTY_PLEASE_DISPLAY_NAMES = [
  "Pretty Please Aesthetics",
  "Pretty Please",
] as const;

export type PrettyPleaseProviderContext = {
  code?: string | null;
  id?: string | null;
  name?: string | null;
};

export const OTHER_PRODUCT_LABEL = "Other";

export const PRETTY_PLEASE_DEMO_PROVIDER: PrettyPleaseProviderContext = {
  code: PRETTY_PLEASE_PROVIDER_CODE,
  name: "Pretty Please Aesthetics",
};

/** Top-level plan builder cards — mirrors site service groupings. */
export const PRETTY_PLEASE_PLAN_BUILDER_TREATMENTS: readonly string[] = [
  "Neurotoxin",
  "Dermal Fillers",
  "Lip Fillers",
  "Kybella",
  "Thread Lift",
  "PRF EZ Gel",
  "Biostimulators",
  "Laser & Energy",
  "Chemical Peels",
  "Vi Peels",
  "Microneedling",
  "Facials",
  "Acne Treatment",
  "Body Sculpting",
  "Wellness",
  "Skincare",
] as const;

const PRETTY_PLEASE_PLAN_SET = new Set<string>(PRETTY_PLEASE_PLAN_BUILDER_TREATMENTS);

export const PRETTY_PLEASE_PRODUCT_OPTIONS: Record<string, readonly string[]> = {
  Neurotoxin: ["Botox", "Dysport", "Xeomin", OTHER_PRODUCT_LABEL],
  "Dermal Fillers": [
    "Juvederm",
    "Restylane",
    "RHA Collection",
    "Sculptra (injectable)",
    "Facial Balancing",
    OTHER_PRODUCT_LABEL,
  ],
  "Lip Fillers": ["Lip Fillers", "Lip Enhancement", OTHER_PRODUCT_LABEL],
  Kybella: ["Kybella", OTHER_PRODUCT_LABEL],
  "Thread Lift": ["PDO Threads", "Thread Lift", OTHER_PRODUCT_LABEL],
  "PRF EZ Gel": ["PRF EZ Gel", OTHER_PRODUCT_LABEL],
  Biostimulators: ["Sculptra", "Radiesse", OTHER_PRODUCT_LABEL],
  "Laser & Energy": [
    "Aerolase",
    "Laser Skin Resurfacing",
    "Laser Treatments",
    "Ultherapy",
    "Skin Tightening",
    "Plasma Skin Tightening",
    OTHER_PRODUCT_LABEL,
  ],
  "Chemical Peels": ["Chemical Peels", "Signature Chemical Peel", OTHER_PRODUCT_LABEL],
  "Vi Peels": ["Vi Peel", "VI Peel Precision Plus", OTHER_PRODUCT_LABEL],
  Microneedling: [
    "Microneedling",
    "Mesoneedling",
    "Radio Frequency Microneedling",
    OTHER_PRODUCT_LABEL,
  ],
  Facials: [
    "HydraFacial",
    "Glo2 Facial",
    "AquaGold Facial",
    "Signature Facials",
    "LightStim LED Therapy",
    OTHER_PRODUCT_LABEL,
  ],
  "Acne Treatment": ["Acne Treatment", OTHER_PRODUCT_LABEL],
  "Body Sculpting": ["Body Sculpting", OTHER_PRODUCT_LABEL],
  Wellness: ["GLP-1", "GLP-1 Weight Management", OTHER_PRODUCT_LABEL],
  Skincare: [...PRETTY_PLEASE_SKINCARE_PLAN_PRODUCTS, OTHER_PRODUCT_LABEL],
};

export const PRETTY_PLEASE_TREATMENT_META: Record<
  string,
  { longevity?: string; downtime?: string; priceRange?: string }
> = {
  Neurotoxin: {
    longevity: "3–4 months",
    downtime: "None",
    priceRange: "Per unit",
  },
  "Dermal Fillers": {
    longevity: "6–18 months",
    downtime: "1–3 days",
    priceRange: "Varies by syringe",
  },
  "Lip Fillers": {
    longevity: "6–12 months",
    downtime: "1–3 days",
    priceRange: "Varies",
  },
  Kybella: {
    longevity: "Permanent",
    downtime: "3–7 days swelling",
    priceRange: "Per vial",
  },
  "Thread Lift": {
    longevity: "12–18 months",
    downtime: "3–7 days",
    priceRange: "Varies",
  },
  "PRF EZ Gel": {
    longevity: "6–12 months",
    downtime: "1–3 days",
    priceRange: "Varies",
  },
  Biostimulators: {
    longevity: "12–24 months",
    downtime: "1–3 days",
    priceRange: "Per vial",
  },
  "Laser & Energy": {
    longevity: "6–24 months",
    downtime: "0–7 days",
    priceRange: "Varies",
  },
  "Chemical Peels": {
    longevity: "1–3 months",
    downtime: "3–7 days",
    priceRange: "Varies",
  },
  "Vi Peels": {
    longevity: "1–3 months",
    downtime: "3–7 days peeling",
    priceRange: "From ~$350",
  },
  Microneedling: {
    longevity: "3–6 months",
    downtime: "1–3 days",
    priceRange: "From ~$450",
  },
  Facials: {
    longevity: "4–6 weeks",
    downtime: "None",
    priceRange: "$165–$350",
  },
  "Acne Treatment": {
    longevity: "Varies",
    downtime: "Minimal",
    priceRange: "Varies",
  },
  "Body Sculpting": {
    longevity: "Varies",
    downtime: "Minimal",
    priceRange: "Consultation",
  },
  Wellness: {
    longevity: "Ongoing",
    downtime: "None",
    priceRange: "Program-based",
  },
  Skincare: {
    longevity: "Ongoing",
    downtime: "None",
    priceRange: "Varies",
  },
};

export function isPrettyPleaseProviderCode(
  code: string | undefined | null,
  _recordId?: string | undefined | null,
): boolean {
  const c = (code ?? "").trim().toLowerCase();
  if (c === PRETTY_PLEASE_PROVIDER_CODE.toLowerCase()) return true;
  if (c === "prettyplease" || c === "prettyplease5357") return true;
  return false;
}

function isPrettyPleaseProviderName(name: string | undefined | null): boolean {
  const n = (name ?? "").trim().toLowerCase();
  if (!n) return false;
  return PRETTY_PLEASE_DISPLAY_NAMES.some((label) =>
    n.includes(label.toLowerCase()),
  );
}

export function isPrettyPleaseProvider(
  provider: PrettyPleaseProviderContext | string | null | undefined,
): boolean {
  if (provider == null) return false;
  if (typeof provider === "string") {
    return isPrettyPleaseProviderCode(provider);
  }
  return (
    isPrettyPleaseProviderCode(provider.code, provider.id) ||
    isPrettyPleaseProviderName(provider.name)
  );
}

export function getPrettyPleaseProductOptionsForTreatment(
  treatment: string | undefined,
): string[] {
  const key = (treatment ?? "").trim();
  const opts = PRETTY_PLEASE_PRODUCT_OPTIONS[key];
  return opts ? [...opts] : [];
}

/** Map generic recommender suggestions to Pretty Please plan categories. */
export function mapSuggestedTreatmentForPrettyPlease(
  treatment: string | undefined | null,
): string | null {
  const t = (treatment ?? "").trim();
  if (!t) return null;
  if (PRETTY_PLEASE_PLAN_SET.has(t)) return t;
  if (t === "Filler") return "Dermal Fillers";
  if (t === "Neurotoxin") return "Neurotoxin";
  if (t === "Biostimulants") return "Biostimulators";
  if (t === "Energy Treatment" || t === "Laser Treatments") return "Laser & Energy";
  if (t === "Chemical Peel") return "Chemical Peels";
  if (t === "Facial Services" || t === "Facials") return "Facials";
  if (t === "Microneedling") return "Microneedling";
  if (t === "Skincare") return "Skincare";
  if (t === "Kybella") return "Kybella";
  if (t === "Threadlift" || t === "Thread Lift") return "Thread Lift";
  if (t === "Wellness" || t === "GLP-1") return "Wellness";
  return null;
}

const PRETTY_PLEASE_REFERENCE_PRICES: Record<string, Record<string, number>> = {
  Neurotoxin: { Botox: 14, Dysport: 5, Xeomin: 13 },
  "Dermal Fillers": {
    Juvederm: 750,
    Restylane: 700,
    "RHA Collection": 750,
    "Facial Balancing": 850,
  },
  "Lip Fillers": { "Lip Fillers": 650, "Lip Enhancement": 650 },
  Kybella: { Kybella: 650 },
  "Thread Lift": { "PDO Threads": 2500, "Thread Lift": 2500 },
  "PRF EZ Gel": { "PRF EZ Gel": 850 },
  Biostimulators: { Sculptra: 850, Radiesse: 750 },
  "Laser & Energy": {
    Aerolase: 450,
    "Laser Skin Resurfacing": 1200,
    "Laser Treatments": 550,
    Ultherapy: 2500,
    "Skin Tightening": 650,
  },
  "Chemical Peels": { "Chemical Peels": 250, "Signature Chemical Peel": 275 },
  "Vi Peels": { "Vi Peel": 350, "VI Peel Precision Plus": 395 },
  Microneedling: {
    Microneedling: 450,
    Mesoneedling: 395,
    "Radio Frequency Microneedling": 850,
  },
  Facials: {
    HydraFacial: 275,
    "Glo2 Facial": 225,
    "AquaGold Facial": 450,
    "Signature Facials": 195,
    "LightStim LED Therapy": 95,
  },
  "Acne Treatment": { "Acne Treatment": 225 },
  "Body Sculpting": { "Body Sculpting": 350 },
  Wellness: { "GLP-1": 350, "GLP-1 Weight Management": 350 },
  Skincare: {},
};

function prettyPleaseReferencePrice(category: string, product: string): number {
  const table = PRETTY_PLEASE_REFERENCE_PRICES[category];
  if (!table) return 0;
  const direct = table[product] ?? 0;
  if (direct > 0) return direct;
  if (category === "Skincare") return 68;
  if (category === "Neurotoxin") return 14;
  return 0;
}

export function getPrettyPleaseEmbeddedPriceListBase(): ProviderPricingJson {
  return PRETTY_PLEASE_PLAN_BUILDER_TREATMENTS.map((category) => {
    const products = (PRETTY_PLEASE_PRODUCT_OPTIONS[category] ?? []).filter(
      (name) => name !== OTHER_PRODUCT_LABEL,
    );
    const items = products.map((product) => {
      const price = prettyPleaseReferencePrice(category, product);
      return {
        name: product,
        price,
        note:
          category === "Neurotoxin"
            ? "Per unit — reference pricing"
            : price > 0
              ? "Reference pricing"
              : "Contact practice for pricing",
      };
    });
    return { category, items };
  });
}
