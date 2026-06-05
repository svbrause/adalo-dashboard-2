/**
 * Slim Studio Face & Body — plan builder / checkout offerings for provider code `SlimStudio56`.
 * Aligned with https://slimstudioatlanta.com/services/ (CoolSculpting, EMSculpt NEO, injectables,
 * regenerative skin, and wellness). Educational / plan-building only — not medical advice.
 */

import type { ProviderPricingJson } from "./treatmentPricing2025";

/** Primary Airtable / dashboard login code for Slim Studio Buckhead. */
export const SLIM_STUDIO_PROVIDER_CODE = "SlimStudio56";

/** Airtable Providers record id (Web Popup Leads / merged dashboard). */
export const SLIM_STUDIO_PROVIDER_RECORD_ID = "rec60E89lWbT9GyFT";

/** Dashboard / Airtable display names that identify Slim Studio. */
export const SLIM_STUDIO_DISPLAY_NAMES = [
  "Slim Studio",
  "Slim Studio Face & Body",
  "Slim Studio FACE & BODY",
] as const;

export type SlimStudioProviderContext = {
  code?: string | null;
  id?: string | null;
  name?: string | null;
};

export const OTHER_PRODUCT_LABEL = "Other";

/** Top-level plan builder cards — mirrors slimstudioatlanta.com/services groupings. */
export const SLIM_STUDIO_PLAN_BUILDER_TREATMENTS: readonly string[] = [
  "CoolSculpting",
  "EMSculpt NEO",
  "Neurotoxin",
  "Filler",
  "Kybella",
  "Biostimulants",
  "Morpheus8",
  "Ariessence Pure PDGF+",
  "Glacial",
  "Facials",
  "Skincare",
  "Peptide Therapy",
  "Medical Weight Loss",
  "Functional Wellness",
  "HRT",
  "Gut Health",
] as const;

const SLIM_STUDIO_PLAN_SET = new Set<string>(SLIM_STUDIO_PLAN_BUILDER_TREATMENTS);

/** Product / type line items for the second dropdown per plan category. */
export const SLIM_STUDIO_PRODUCT_OPTIONS: Record<string, readonly string[]> = {
  CoolSculpting: [
    "CoolSculpting Treatment",
    "CoolSculpting Elite",
    "CoolSculpting for Men",
    "CoolSculpting for Women",
    "DualSculpting & QuadSculpting",
    "Body Sculpting",
    OTHER_PRODUCT_LABEL,
  ],
  "EMSculpt NEO": [
    "EMSculpt NEO Treatment",
    "EMSculpt NEO for the Abdomen",
    "Body Sculpting",
    OTHER_PRODUCT_LABEL,
  ],
  Neurotoxin: [
    "Botox",
    "Dysport",
    "Xeomin",
    "Daxxify",
    "Jeuveau",
    OTHER_PRODUCT_LABEL,
  ],
  Filler: [
    "Facial Balancing",
    "Dermal Fillers",
    "Lip Fillers",
    "Liquid Facelift",
    "Juvederm",
    "SKINVIVE",
    "Eyelight by Restylane",
    "RHA Collection",
    OTHER_PRODUCT_LABEL,
  ],
  Kybella: ["Kybella", OTHER_PRODUCT_LABEL],
  Biostimulants: ["Radiesse", "Sculptra", OTHER_PRODUCT_LABEL],
  Morpheus8: ["Morpheus8", OTHER_PRODUCT_LABEL],
  "Ariessence Pure PDGF+": ["Ariessence Pure PDGF+", OTHER_PRODUCT_LABEL],
  Glacial: ["Glacial (Cryomodulation)", OTHER_PRODUCT_LABEL],
  Facials: ["Facials", OTHER_PRODUCT_LABEL],
  Skincare: ["Medical Grade Skincare", OTHER_PRODUCT_LABEL],
  "Peptide Therapy": ["Peptide Therapy", OTHER_PRODUCT_LABEL],
  "Medical Weight Loss": ["Medical Weight Loss", OTHER_PRODUCT_LABEL],
  "Functional Wellness": ["Functional Wellness", OTHER_PRODUCT_LABEL],
  HRT: ["HRT (Hormone Replacement Therapy)", OTHER_PRODUCT_LABEL],
  "Gut Health": ["Gut Health Optimization", OTHER_PRODUCT_LABEL],
};

/** Display meta for plan cards and blueprint chapters. */
export const SLIM_STUDIO_TREATMENT_META: Record<
  string,
  { longevity?: string; downtime?: string; priceRange?: string }
> = {
  CoolSculpting: {
    longevity: "Permanent fat reduction",
    downtime: "Minimal",
    priceRange: "Varies by area",
  },
  "EMSculpt NEO": {
    longevity: "Muscle + fat results with maintenance",
    downtime: "Minimal",
    priceRange: "Varies by area",
  },
  Neurotoxin: {
    longevity: "3–4 months",
    downtime: "None",
    priceRange: "Varies",
  },
  Filler: {
    longevity: "6–18 months",
    downtime: "1–2 days",
    priceRange: "Varies",
  },
  Kybella: {
    longevity: "Permanent",
    downtime: "3–7 days",
    priceRange: "Varies",
  },
  Biostimulants: {
    longevity: "18–24+ months",
    downtime: "1–3 days",
    priceRange: "Varies",
  },
  Morpheus8: {
    longevity: "6–12+ months",
    downtime: "3–7 days",
    priceRange: "Varies",
  },
  "Ariessence Pure PDGF+": {
    longevity: "Varies",
    downtime: "1–3 days",
    priceRange: "Varies",
  },
  Glacial: {
    longevity: "Varies",
    downtime: "Minimal",
    priceRange: "Varies",
  },
  Facials: {
    longevity: "4–6 weeks",
    downtime: "None",
    priceRange: "Varies",
  },
  Skincare: {
    longevity: "Ongoing",
    downtime: "None",
    priceRange: "Varies",
  },
  "Peptide Therapy": {
    longevity: "Varies",
    downtime: "Minimal",
    priceRange: "Varies",
  },
  "Medical Weight Loss": {
    longevity: "Program-based",
    downtime: "None",
    priceRange: "Varies",
  },
  "Functional Wellness": {
    longevity: "Ongoing",
    downtime: "None",
    priceRange: "Varies",
  },
  HRT: {
    longevity: "Ongoing",
    downtime: "None",
    priceRange: "Varies",
  },
  "Gut Health": {
    longevity: "Program-based",
    downtime: "None",
    priceRange: "Varies",
  },
};

export function isSlimStudioProviderCode(
  providerCode: string | undefined | null,
  providerId?: string | undefined | null,
): boolean {
  const c = (providerCode ?? "").trim().toLowerCase();
  if (
    c === SLIM_STUDIO_PROVIDER_CODE.toLowerCase() ||
    c === "slimstudio" ||
    c.startsWith("slimstudio")
  ) {
    return true;
  }
  const id = (providerId ?? "").trim();
  return id === SLIM_STUDIO_PROVIDER_RECORD_ID;
}

function isSlimStudioProviderName(name: string | undefined | null): boolean {
  const n = (name ?? "").trim();
  if (!n) return false;
  if (SLIM_STUDIO_DISPLAY_NAMES.some((label) => label === n)) return true;
  const lower = n.toLowerCase();
  return lower.includes("slim studio");
}

/**
 * Resolve Slim Studio from login code, Airtable record id, or practice display name.
 * Prefer this over {@link isSlimStudioProviderCode} when a full provider object is available.
 */
export function isSlimStudioProvider(
  provider: SlimStudioProviderContext | string | null | undefined,
): boolean {
  if (provider == null) return false;
  if (typeof provider === "string") {
    return isSlimStudioProviderCode(provider);
  }
  return (
    isSlimStudioProviderCode(provider.code, provider.id) ||
    isSlimStudioProviderName(provider.name)
  );
}

export function getSlimStudioProductOptionsForTreatment(
  treatment: string | undefined,
): string[] {
  const key = (treatment ?? "").trim();
  const opts = SLIM_STUDIO_PRODUCT_OPTIONS[key];
  return opts ? [...opts] : [];
}

/**
 * Map generic finding/interest suggestions to Slim Studio plan categories.
 * Returns null when the service is not offered at Slim Studio.
 */
export function mapSuggestedTreatmentForSlimStudio(
  treatment: string | undefined | null,
): string | null {
  const t = (treatment ?? "").trim();
  if (!t) return null;
  if (SLIM_STUDIO_PLAN_SET.has(t)) return t;
  if (t === "Energy Treatment" || t === "Microneedling") return "Morpheus8";
  if (t === "Facial Services") return "Facials";
  if (t === "Chemical Peel" || t === "Threadlift" || t === "Other procedures") {
    return null;
  }
  return null;
}

/**
 * Reference demo / plan-quote prices for Slim Studio (Atlanta med-spa ranges).
 * Shown on demo patient plans and as the default sheet before provider overrides.
 */
const SLIM_STUDIO_REFERENCE_PRICES: Record<string, Record<string, number>> = {
  CoolSculpting: {
    "CoolSculpting Treatment": 750,
    "CoolSculpting Elite": 850,
    "CoolSculpting for Men": 750,
    "CoolSculpting for Women": 750,
    "DualSculpting & QuadSculpting": 1200,
    "Body Sculpting": 900,
  },
  "EMSculpt NEO": {
    "EMSculpt NEO Treatment": 350,
    "EMSculpt NEO for the Abdomen": 350,
    "Body Sculpting": 900,
  },
  Neurotoxin: {
    Botox: 14,
    Dysport: 5,
    Xeomin: 12,
    Daxxify: 16,
    Jeuveau: 13,
  },
  Filler: {
    "Facial Balancing": 1200,
    "Dermal Fillers": 750,
    "Lip Fillers": 650,
    "Liquid Facelift": 2200,
    Juvederm: 750,
    SKINVIVE: 750,
    "Eyelight by Restylane": 850,
    "RHA Collection": 750,
  },
  Kybella: {
    Kybella: 600,
  },
  Biostimulants: {
    Radiesse: 850,
    "Radiesse – 2 Syringes": 1650,
    Sculptra: 950,
    "Sculptra - 1 Vial": 950,
  },
  Morpheus8: {
    Morpheus8: 950,
  },
  "Ariessence Pure PDGF+": {
    "Ariessence Pure PDGF+": 650,
  },
  Glacial: {
    "Glacial (Cryomodulation)": 350,
  },
  Facials: {
    Facials: 175,
  },
  Skincare: {
    "Medical Grade Skincare": 125,
  },
  "Peptide Therapy": {
    "Peptide Therapy": 450,
  },
  "Medical Weight Loss": {
    "Medical Weight Loss": 299,
  },
  "Functional Wellness": {
    "Functional Wellness": 350,
  },
  HRT: {
    "HRT (Hormone Replacement Therapy)": 275,
  },
  "Gut Health": {
    "Gut Health Optimization": 325,
  },
};

function slimStudioPriceListSkuName(category: string, product: string): string {
  if (category === "Neurotoxin") return `${product} - 1 Unit`;
  if (category === "Biostimulants" && product === "Sculptra") return "Sculptra - 1 Vial";
  return product;
}

function slimStudioReferencePrice(category: string, product: string): number {
  const table = SLIM_STUDIO_REFERENCE_PRICES[category];
  if (!table) return 0;
  return table[product] ?? table[slimStudioPriceListSkuName(category, product)] ?? 0;
}

/** Embedded price list for Settings → Treatment Pricing (reference rows per service line). */
export function getSlimStudioEmbeddedPriceListBase(): ProviderPricingJson {
  const extraBiostimulantRows = [
    { name: "Radiesse – 2 Syringes", price: 1650 },
    { name: "Sculptra - 1 Vial", price: 950 },
  ];

  return SLIM_STUDIO_PLAN_BUILDER_TREATMENTS.map((category) => {
    const products = (SLIM_STUDIO_PRODUCT_OPTIONS[category] ?? []).filter(
      (name) => name !== OTHER_PRODUCT_LABEL,
    );
    const items = products.map((product) => {
      const name = slimStudioPriceListSkuName(category, product);
      const price = slimStudioReferencePrice(category, product);
      return {
        name,
        price,
        note: price > 0 ? "Reference pricing" : "Contact practice for pricing",
      };
    });
    if (category === "Biostimulants") {
      for (const row of extraBiostimulantRows) {
        if (!items.some((i) => i.name === row.name)) {
          items.push({ ...row, note: "Reference pricing" });
        }
      }
    }
    return { category, items };
  });
}
