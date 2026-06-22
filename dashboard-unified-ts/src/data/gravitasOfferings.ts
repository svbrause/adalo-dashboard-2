/**
 * Gravitas Medspa — plan builder / checkout offerings for provider code `Gravitas272`.
 * Services and skincare aligned with gravitasmedspa.com and in-practice protocol sheets
 * (Clear Skin Guide, Acne Erase Protocol).
 */

import type { ProviderPricingJson } from "./treatmentPricing2025";
import { GRAVITAS_SKINCARE_PLAN_PRODUCTS } from "./gravitasSkincare";

export const GRAVITAS_PROVIDER_CODE = "Gravitas272";

export const GRAVITAS_DISPLAY_NAMES = [
  "Gravitas Medspa",
  "Gravitas Med Spa",
] as const;

export type GravitasProviderContext = {
  code?: string | null;
  id?: string | null;
  name?: string | null;
};

export const OTHER_PRODUCT_LABEL = "Other";

/** Demo provider identity for Gravitas skincare quiz payloads. */
export const GRAVITAS_DEMO_PROVIDER: GravitasProviderContext = {
  code: GRAVITAS_PROVIDER_CODE,
  name: "Gravitas Medspa",
};

/** Top-level plan builder cards — from Gravitas 2026 services sheet. */
export const GRAVITAS_PLAN_BUILDER_TREATMENTS: readonly string[] = [
  "Facials",
  "Add-On Services",
  "Permanent Makeup",
  "Red Light Therapy",
  "Medical Skin Services",
  "IV Therapy",
  "Neurotoxin",
  "Skincare",
] as const;

const GRAVITAS_PLAN_SET = new Set<string>(GRAVITAS_PLAN_BUILDER_TREATMENTS);

export const GRAVITAS_PRODUCT_OPTIONS: Record<string, readonly string[]> = {
  Facials: [
    "Glow N Go Facial",
    "Skin Vitalizing Experience",
    "Ultimate Skin Veneer Experience",
    "Ultimate Oxylux Experience",
    "Acne Treatment w/ Blue LED Light Therapy",
    "Rejuvenating Pumpkin Spice Experience w/ Head Massage",
    "Radiance Infusion Express",
    "Radiant Neck Reset",
    "Underarm Glow Revival",
    "FREE Birthday Skin Cleanse",
    OTHER_PRODUCT_LABEL,
  ],
  "Add-On Services": [
    "LED Light Therapy",
    "Epidermal Sweep",
    "Medical Extractions",
    "Paraffin Treatment (Hands and Feet)",
    "Eyebrow Grooming",
    OTHER_PRODUCT_LABEL,
  ],
  "Permanent Makeup": ["Ombre Eyebrows Powdershading", OTHER_PRODUCT_LABEL],
  "Red Light Therapy": ["Red Light Therapy", OTHER_PRODUCT_LABEL],
  "Medical Skin Services": [
    "Skin Peeling",
    "Skinpen Microneedling",
    "PRP Microneedling",
    "Natural Warts Removal",
    OTHER_PRODUCT_LABEL,
  ],
  "IV Therapy": [
    "Gluta C Single Dose",
    "Gluta C - Brilliance (Package of 8)",
    "Fountain of Youth 5K / 15K",
    "Hydration Renewal Drip",
    "Ultra C Wellness Drip",
    "Lipomelt Shot",
    OTHER_PRODUCT_LABEL,
  ],
  Neurotoxin: ["Botox", OTHER_PRODUCT_LABEL],
  Skincare: [...GRAVITAS_SKINCARE_PLAN_PRODUCTS, OTHER_PRODUCT_LABEL],
};

export const GRAVITAS_TREATMENT_META: Record<
  string,
  { longevity?: string; downtime?: string; priceRange?: string }
> = {
  Facials: {
    longevity: "4–6 weeks",
    downtime: "None",
    priceRange: "$165–$410",
  },
  "Add-On Services": {
    longevity: "Varies",
    downtime: "None",
    priceRange: "Varies",
  },
  "Permanent Makeup": {
    longevity: "1–3 years",
    downtime: "7–14 days",
    priceRange: "From $799",
  },
  "Red Light Therapy": {
    longevity: "Cumulative",
    downtime: "None",
    priceRange: "Varies",
  },
  "Medical Skin Services": {
    longevity: "3–12+ months",
    downtime: "1–7 days",
    priceRange: "$250–$750",
  },
  "IV Therapy": {
    longevity: "Varies",
    downtime: "None",
    priceRange: "Varies",
  },
  Neurotoxin: {
    longevity: "3–4 months",
    downtime: "None",
    priceRange: "$13/unit",
  },
  Skincare: {
    longevity: "Ongoing",
    downtime: "None",
    priceRange: "Varies",
  },
};

export function isGravitasProviderCode(
  code: string | undefined | null,
  _recordId?: string | undefined | null,
): boolean {
  const c = (code ?? "").trim().toLowerCase();
  if (c === GRAVITAS_PROVIDER_CODE.toLowerCase()) return true;
  if (c === "gravitas" || c === "gravitas272") return true;
  return false;
}

function isGravitasProviderName(name: string | undefined | null): boolean {
  const n = (name ?? "").trim().toLowerCase();
  if (!n) return false;
  return GRAVITAS_DISPLAY_NAMES.some((label) => n.includes(label.toLowerCase()));
}

export function isGravitasProvider(
  provider: GravitasProviderContext | string | null | undefined,
): boolean {
  if (provider == null) return false;
  if (typeof provider === "string") {
    return isGravitasProviderCode(provider);
  }
  return (
    isGravitasProviderCode(provider.code, provider.id) ||
    isGravitasProviderName(provider.name)
  );
}

export function getGravitasProductOptionsForTreatment(
  treatment: string | undefined,
): string[] {
  const key = (treatment ?? "").trim();
  const opts = GRAVITAS_PRODUCT_OPTIONS[key];
  return opts ? [...opts] : [];
}

/** Map generic recommender suggestions to Gravitas plan categories. */
export function mapSuggestedTreatmentForGravitas(
  treatment: string | undefined | null,
): string | null {
  const t = (treatment ?? "").trim();
  if (!t) return null;
  if (GRAVITAS_PLAN_SET.has(t)) return t;
  if (t === "Facial Services" || t === "Facials") return "Facials";
  if (t === "Chemical Peel") return "Medical Skin Services";
  if (t === "Microneedling" || t === "Energy Treatment") return "Medical Skin Services";
  if (t === "Neurotoxin") return "Neurotoxin";
  if (t === "Skincare") return "Skincare";
  if (t === "IV Therapy" || t === "Wellness") return "IV Therapy";
  return null;
}

const GRAVITAS_REFERENCE_PRICES: Record<string, Record<string, number>> = {
  Facials: {
    "Glow N Go Facial": 165,
    "Skin Vitalizing Experience": 245,
    "Ultimate Skin Veneer Experience": 310,
    "Ultimate Oxylux Experience": 410,
    "Acne Treatment w/ Blue LED Light Therapy": 250,
    "Radiance Infusion Express": 165,
    "Radiant Neck Reset": 165,
    "Underarm Glow Revival": 165,
    "FREE Birthday Skin Cleanse": 0,
  },
  "Add-On Services": {
    "LED Light Therapy": 75,
    "Epidermal Sweep": 65,
    "Medical Extractions": 85,
    "Paraffin Treatment (Hands and Feet)": 45,
    "Eyebrow Grooming": 35,
  },
  "Permanent Makeup": {
    "Ombre Eyebrows Powdershading": 799,
  },
  "Red Light Therapy": {
    "Red Light Therapy": 95,
  },
  "Medical Skin Services": {
    "Skin Peeling": 250,
    "Skinpen Microneedling": 450,
    "PRP Microneedling": 750,
    "Natural Warts Removal": 400,
  },
  "IV Therapy": {
    "Gluta C Single Dose": 175,
    "Gluta C - Brilliance (Package of 8)": 1200,
    "Fountain of Youth 5K / 15K": 225,
    "Hydration Renewal Drip": 150,
    "Ultra C Wellness Drip": 175,
    "Lipomelt Shot": 45,
  },
  Neurotoxin: {
    Botox: 13,
  },
  Skincare: {},
};

function gravitasReferencePrice(category: string, product: string): number {
  const table = GRAVITAS_REFERENCE_PRICES[category];
  if (!table) return 0;
  const direct = table[product] ?? 0;
  if (direct > 0) return direct;
  if (category === "Skincare") return 68;
  if (category === "Neurotoxin" && product === "Botox") return 13;
  return 0;
}

export function getGravitasEmbeddedPriceListBase(): ProviderPricingJson {
  return GRAVITAS_PLAN_BUILDER_TREATMENTS.map((category) => {
    const products = (GRAVITAS_PRODUCT_OPTIONS[category] ?? []).filter(
      (name) => name !== OTHER_PRODUCT_LABEL,
    );
    const items = products.map((product) => {
      const price = gravitasReferencePrice(category, product);
      return {
        name: product,
        price,
        note:
          category === "Neurotoxin" && product === "Botox"
            ? "Per unit — reference pricing"
            : price > 0
              ? "Reference pricing"
              : "Contact practice for pricing",
      };
    });
    return { category, items };
  });
}
