/**
 * The Treatment Skin Boutique – Price List 2025
 * Sourced from PRICE LIST 2025.pdf. Use for display and treatment meta price ranges.
 */

import {
  getWellnestOfferingByTreatmentName,
  getWellnestPeptideMeta,
  parseWellnestPriceMin,
} from "./wellnestOfferings";

export interface TreatmentPriceItem {
  name: string;
  price: number;
  note?: string;
}

/** Category used in the dashboard (maps to ALL_TREATMENTS). */
export type DashboardTreatmentCategory =
  | "Skincare"
  | "Energy Device"
  | "Chemical Peel"
  | "Microneedling"
  | "Filler"
  | "Neurotoxin"
  | "Biostimulants"
  | "Kybella"
  | "Threadlift";

/** All 2025 prices by PDF section (for reference and lookup). */
export const TREATMENT_PRICE_LIST_2025: {
  category: string;
  items: TreatmentPriceItem[];
}[] = [
  {
    category: "Consultations",
    items: [
      { name: "Acne Consultation", price: 150 },
      { name: "Cosmelan Consultation", price: 150 },
      { name: "Injectable Consultation", price: 150 },
      { name: "Laser Consultation", price: 150 },
      { name: "Ultherapy Consultation", price: 150 },
      { name: "Hair Restoration Consultation", price: 150 },
    ],
  },
  {
    category: "Injectables",
    items: [
      { name: "Botox 1-Unit", price: 13, note: "CA locations only" },
      { name: "Dysport 1-Unit", price: 5.2, note: "CA locations only" },
      { name: "Botox Sweating Treatment", price: 995 },
      { name: "Botox – Henderson (1–50u vial)", price: 650 },
      { name: "Dysport – Henderson (1–300u vial)", price: 995 },
      { name: "Fillers (except Voluma & Volux)", price: 750 },
      { name: "Voluma", price: 850 },
      { name: "Volux", price: 950 },
      { name: "Radiesse", price: 900 },
      { name: "Radiesse – 2 Syringes", price: 1530 },
      { name: "Radiesse – 3 Syringes", price: 2295 },
      { name: "Radiesse – 4 Syringes", price: 2880 },
      { name: "Radiesse – 5 Syringes", price: 3510 },
      { name: "Radiesse – 6 Syringes", price: 4050 },
      { name: "Sculptra – 1 Vial", price: 800 },
      { name: "Sculptra – 3 Vials", price: 2250 },
      { name: "Sculptra – 4 Vials", price: 3000 },
      { name: "Sculptra – 5 Vials", price: 3500 },
      { name: "Sculptra – 6 Vials", price: 4000 },
      { name: "Sculptra – 8 Vials", price: 5200 },
      { name: "Skinvive II", price: 750 },
      { name: "Skinvive III Add-On Syringe", price: 375 },
      { name: "Spider Vein Treatment", price: 750 },
      { name: "Spider Vein Treatment Package (3)", price: 2025 },
    ],
  },
  {
    category: "Other Treatments",
    items: [
      { name: "Filler Dissolver", price: 300 },
      { name: "Pronox Treatment", price: 75 },
      { name: "Vitamin B-12 Shot", price: 25 },
      { name: "Cortisone Shot", price: 50 },
      { name: "Zapping Treatment (Milia/Sebaceous Hyperplasia)", price: 150 },
      { name: "Light Stim Add-On", price: 40, note: "Esti services only" },
      { name: "Nerve Block", price: 25 },
    ],
  },
  {
    category: "Facial Services",
    items: [
      { name: "Focused Facial", price: 75 },
      { name: "Acne Facial", price: 150 },
      { name: "Calming Facial", price: 150 },
      { name: "Signature Facial", price: 150 },
      { name: "Treatman Facial", price: 150 },
      { name: "Treat Yourself Facial", price: 200 },
      { name: "Glass Skin Facial", price: 250 },
      { name: "Dermaplaning", price: 150 },
      { name: "Dermasweep", price: 150 },
      { name: "Dermasweep – Face, Neck & Chest", price: 275 },
      { name: "Dermasweep w/ Premium Infusion", price: 225 },
      { name: "Dermasweep w/ Premium Infusion – Face, Neck & Chest", price: 325 },
    ],
  },
  {
    category: "Chemical Peel",
    items: [
      { name: "Brightening Lactic Peel – Full Face", price: 85 },
      { name: "Brightening Lactic Peel – Full Back", price: 225 },
      { name: "Brightening Lactic Peel – Upper Back", price: 165 },
      { name: "Jessner's Peel – Full Face", price: 180 },
      { name: "Jessner's Peel – Face & Neck or Chest", price: 270 },
      { name: "Jessner's Peel – Face, Neck & Chest", price: 360 },
      { name: "Jessner's Peel – Full Back", price: 415 },
      { name: "Jessner's Peel – Upper Back", price: 355 },
      { name: "Sal-X Plus Acne Peel – Full Face", price: 125 },
      { name: "Sal-X Plus Acne Peel – Face, Neck & Chest", price: 250 },
      { name: "Sal-X Plus Acne Peel – Face, Neck or Chest", price: 180 },
      { name: "Sal-X Plus Acne Peel – Full Back", price: 310 },
      { name: "Sal-X Plus Acne Peel – Upper Back", price: 245 },
      { name: "Cosmelan MD Peel", price: 900 },
      { name: "Lactic Peel Add-On", price: 50, note: "Esti services only" },
    ],
  },
  {
    category: "Sofwave",
    items: [
      { name: "Sofwave – Full Face", price: 2850, note: "Claremont only" },
      { name: "Sofwave – Full Face + Neck", price: 3900 },
      { name: "Sofwave – Lower Face", price: 2000 },
      { name: "Sofwave – Lower Face + Neck", price: 3150 },
      { name: "Sofwave – Neck", price: 1650 },
      { name: "Sofwave – Brows", price: 800 },
    ],
  },
  {
    category: "Ultherapy",
    items: [
      { name: "Ultherapy – Full Face", price: 3500, note: "Newport only" },
      { name: "Ultherapy – Full Face + Neck", price: 4000 },
      { name: "Ultherapy – Lower Face", price: 2500 },
      { name: "Ultherapy – Lower Face + Neck", price: 3500 },
      { name: "Ultherapy – Upper Face", price: 1500 },
      { name: "Ultherapy – Neck", price: 2000 },
      { name: "Ultherapy – Brows", price: 500 },
    ],
  },
  {
    category: "Laser",
    items: [
      { name: "Moxi Full Face", price: 550 },
      { name: "Moxi Face, Neck & Chest", price: 995 },
      { name: "Moxi Neck", price: 400 },
      { name: "Moxi Chest", price: 550 },
      { name: "Moxi Hands", price: 350 },
      { name: "BBL Full Face", price: 550 },
      { name: "BBL Face, Neck & Chest", price: 995 },
      { name: "BBL Neck", price: 400 },
      { name: "BBL Chest", price: 550 },
      { name: "BBL Hands", price: 350 },
      { name: "BBL Full Arms & Hands", price: 995 },
      { name: "BBL Upper Arms", price: 600 },
      { name: "BBL Forearms", price: 600 },
      { name: "BBL Full Back", price: 850 },
      { name: "BBL Upper Back", price: 550 },
      { name: "BBL Lower Back", price: 550 },
      { name: "BBL Full Legs", price: 1075 },
      { name: "BBL Upper Legs/Thighs", price: 850 },
      { name: "BBL Lower Legs", price: 650 },
      { name: "BBL Spot Treatment", price: 250 },
      { name: "BBL + Moxi Full Face", price: 750 },
      { name: "BBL + Moxi Face, Neck & Chest", price: 1150 },
      { name: "BBL + Moxi Neck", price: 500 },
      { name: "BBL + Moxi Chest", price: 650 },
      { name: "BBL + Moxi Arms & Hands", price: 1095 },
      { name: "BBL + Moxi Hands", price: 450 },
      { name: "Moxi Full Face 3PK", price: 1485 },
      { name: "Moxi Face, Neck & Chest 3PK", price: 2687 },
      { name: "BBL Full Face 3PK", price: 1485 },
      { name: "BBL + Moxi Full Face 3PK", price: 2025 },
      { name: "BBL + Moxi Face, Neck & Chest 3PK", price: 3105 },
    ],
  },
  {
    category: "Medical Spa",
    items: [
      { name: "Microneedling", price: 500, note: "CA locations only" },
      { name: "Microneedling & PRFM Add-On Neck or Chest", price: 250 },
      { name: "PRFM Microneedling", price: 775, note: "CA locations only" },
      { name: "PRFM Hair Restoration", price: 750, note: "CA locations only" },
      { name: "PRFM Injections", price: 750, note: "CA locations only" },
      { name: "PRFM Additional Tube", price: 250 },
      { name: "Microneedling (Henderson)", price: 300 },
      { name: "PRFM Microneedling (Henderson)", price: 550 },
      { name: "PRFM Hair Restoration (Henderson)", price: 500 },
      { name: "PRFM Injections (Henderson)", price: 500 },
      { name: "Microneedling 5PK", price: 2000, note: "CA" },
      { name: "Microneedling 5PK (Henderson)", price: 1200 },
      { name: "PRFM Microneedling 5PK", price: 3100, note: "CA" },
      { name: "PRFM Microneedling 5PK (Henderson)", price: 2200 },
      { name: "PRFM Hair Restoration 5PK (Henderson)", price: 2000 },
      { name: "PRFM Injections 5PK (Henderson)", price: 2000 },
    ],
  },
];

/** Add-on options from the 2025 price list (for checkout "Add-ons" section). */
export function getAddOnOptions(): TreatmentPriceItem[] {
  const out: TreatmentPriceItem[] = [];
  for (const section of TREATMENT_PRICE_LIST_2025) {
    for (const item of section.items) {
      if (/add-?on/i.test(item.name)) out.push(item);
    }
  }
  return out;
}

/** Format price for display. */
export function formatPrice(price: number): string {
  if (price % 1 === 0) return `$${price.toLocaleString()}`;
  return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

/** Get min and max price from a list of items. */
function getMinMax(items: TreatmentPriceItem[]): { min: number; max: number } {
  if (items.length === 0) return { min: 0, max: 0 };
  const prices = items.map((i) => i.price);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/** All items that map to a dashboard category (for price range). */
function getItemsForDashboardCategory(
  category: DashboardTreatmentCategory
): TreatmentPriceItem[] {
  const flat: TreatmentPriceItem[] = [];
  for (const section of TREATMENT_PRICE_LIST_2025) {
    if (
      section.category === "Injectables" &&
      (category === "Filler" || category === "Neurotoxin" || category === "Biostimulants")
    ) {
      const injectables = section.items;
      if (category === "Neurotoxin") {
        flat.push(
          ...injectables.filter(
            (i) =>
              i.name.includes("Botox") ||
              i.name.includes("Dysport") ||
              i.name.includes("Sweating")
          )
        );
      } else if (category === "Filler") {
        flat.push(
          ...injectables.filter(
            (i) =>
              i.name.includes("Filler") ||
              i.name.includes("Voluma") ||
              i.name.includes("Volux") ||
              i.name.includes("Dissolver")
          )
        );
      } else if (category === "Biostimulants") {
        flat.push(
          ...injectables.filter(
            (i) =>
              i.name.includes("Radiesse") ||
              i.name.includes("Sculptra") ||
              i.name.includes("Skinvive")
          )
        );
      }
    } else if (
      section.category === "Facial Services" &&
      category === "Skincare"
    ) {
      flat.push(...section.items);
    } else if (
      section.category === "Chemical Peel" &&
      category === "Chemical Peel"
    ) {
      flat.push(...section.items);
    } else if (section.category === "Laser" && category === "Energy Device") {
      flat.push(...section.items);
    } else if (section.category === "Sofwave" && category === "Energy Device") {
      flat.push(...section.items);
    } else if (section.category === "Ultherapy" && category === "Energy Device") {
      flat.push(...section.items);
    } else if (
      section.category === "Medical Spa" &&
      category === "Microneedling"
    ) {
      flat.push(
        ...section.items.filter(
          (i) =>
            i.name.includes("Microneedling") || i.name.includes("PRFM")
        )
      );
    }
  }
  return flat;
}

/**
 * Price range string for dashboard treatment category (from 2025 list).
 * Use in TREATMENT_META.priceRange. Returns undefined if no 2025 prices map to that category.
 */
export function getPriceRange2025(
  category: DashboardTreatmentCategory
): string | undefined {
  const items = getItemsForDashboardCategory(category);
  if (items.length === 0) return undefined;
  const { min, max } = getMinMax(items);
  if (min === max) return formatPrice(min);
  return `${formatPrice(min)}–${formatPrice(max)}`;
}

/**
 * Full flat list of all 2025 services with price and category (for search/display).
 */
export function getAllPrices2025(): (TreatmentPriceItem & { category: string })[] {
  const out: (TreatmentPriceItem & { category: string })[] = [];
  for (const section of TREATMENT_PRICE_LIST_2025) {
    for (const item of section.items) {
      out.push({ ...item, category: section.category });
    }
  }
  return out;
}

/** Numeric min/max for a dashboard category (for checkout totals). Kybella/Threadlift use fixed ranges; others from 2025 list. */
export function getPriceRangeNumeric2025(
  category: string
): { min: number; max: number } | undefined {
  const c = category?.trim();
  if (!c) return undefined;
  // Categories not in TREATMENT_PRICE_LIST_2025 (from TREATMENT_META)
  const fallbacks: Record<string, { min: number; max: number }> = {
    Kybella: { min: 1200, max: 1800 },
    Threadlift: { min: 1500, max: 4000 },
    PRP: { min: 0, max: 0 }, // no price list
    PDGF: { min: 0, max: 0 },
  };
  if (fallbacks[c]) return fallbacks[c];
  const dash = c as DashboardTreatmentCategory;
  const items = getItemsForDashboardCategory(dash);
  if (items.length === 0) return undefined;
  return getMinMax(items);
}

/**
 * One line item for checkout: estimated price range for a plan item (by treatment category).
 * Used by TreatmentPlanCheckout to show per-line and total.
 */
export interface CheckoutLineItem {
  /** Display label (e.g. "Laser", "Neurotoxin • Forehead") */
  label: string;
  /** Estimated price min (0 if unknown) */
  min: number;
  /** Estimated price max (0 if unknown) */
  max: number;
  /** Formatted range string for display */
  displayPrice: string;
}

/**
 * Plan item shape used for price lookup (avoids coupling to DiscussedItem).
 */
export interface PlanItemForPricing {
  treatment: string;
  product?: string;
  region?: string;
  quantity?: string;
}

/** Category-level meta for checkout (longevity, recovery, sessions). Mirrors TREATMENT_META where used. */
export interface CategoryMeta {
  longevity?: string;
  downtime?: string;
  sessions?: string;
}

/** Provider code that must only see treatment options present in the 2025 price list. */
export const PROVIDER_CODE_RESTRICTED_TO_PRICE_LIST = "TheTreatment250";

/** Dashboard treatment category → price list section names (for SKU lookup). */
const DASHBOARD_TO_PRICE_SECTIONS: Record<string, string[]> = {
  Skincare: ["Facial Services"],
  "Energy Device": ["Laser", "Sofwave", "Ultherapy"],
  "Chemical Peel": ["Chemical Peel"],
  Microneedling: ["Medical Spa"],
  Filler: ["Injectables"],
  Neurotoxin: ["Injectables"],
  Biostimulants: ["Injectables"],
  Kybella: [],
  Threadlift: [],
  PRP: [],
  PDGF: [],
};

/** Treatment categories that have at least one price list section (for provider-restricted views). */
export const TREATMENT_CATEGORIES_IN_PRICE_LIST: DashboardTreatmentCategory[] = (
  Object.entries(DASHBOARD_TO_PRICE_SECTIONS) as [DashboardTreatmentCategory, string[]][]
)
  .filter(([, sections]) => sections.length > 0)
  .map(([cat]) => cat);

/** True when the provider should only see options that exist in the 2025 pricing sheet. */
export function isProviderRestrictedToPricingSheet(providerCode: string | undefined): boolean {
  return (providerCode ?? "").trim().toLowerCase() === PROVIDER_CODE_RESTRICTED_TO_PRICE_LIST.toLowerCase();
}

/** Energy device type names from the 2025 price list (Laser, Sofwave, Ultherapy sections). Used as Type options for Energy Device category. */
export function getEnergyDeviceTypesFromPriceList(): string[] {
  const devices: string[] = [];
  for (const section of TREATMENT_PRICE_LIST_2025) {
    if (section.category === "Sofwave") {
      devices.push("Sofwave");
    } else if (section.category === "Ultherapy") {
      devices.push("Ultherapy");
    } else if (section.category === "Laser") {
      const seen = new Set<string>();
      for (const item of section.items) {
        const n = item.name;
        if (n.startsWith("Moxi") && !n.includes("BBL")) seen.add("Moxi");
        else if (n.startsWith("BBL + Moxi") || n.includes("BBL + Moxi")) {
          seen.add("Moxi + BBL");
          seen.add("BBL (BroadBand Light)");
        } else if (n.startsWith("BBL")) seen.add("BBL (BroadBand Light)");
      }
      if (seen.has("Moxi")) devices.push("Moxi");
      if (seen.has("BBL (BroadBand Light)")) devices.push("BBL (BroadBand Light)");
      if (seen.has("Moxi + BBL")) devices.push("Moxi + BBL");
    }
  }
  return [...new Set(devices)];
}

function splitChemicalPeelTypeAndArea(name: string): { type: string; area: string | null } {
  const raw = (name ?? "").trim();
  if (!raw) return { type: "", area: null };
  const parts = raw.split(" – ");
  if (parts.length < 2) return { type: raw, area: null };
  return { type: parts[0]!.trim(), area: parts.slice(1).join(" – ").trim() || null };
}

/** Chemical peel SKU names from the 2025 price list. */
export function getChemicalPeelSkusFromPriceList(): string[] {
  const section = TREATMENT_PRICE_LIST_2025.find((s) => s.category === "Chemical Peel");
  if (!section) return [];
  return section.items.map((i) => i.name);
}

/** Chemical peel type names from the 2025 price list (without area suffix). */
export function getChemicalPeelTypesFromPriceList(): string[] {
  const section = TREATMENT_PRICE_LIST_2025.find((s) => s.category === "Chemical Peel");
  if (!section) return [];
  const types = section.items.map((i) => splitChemicalPeelTypeAndArea(i.name).type).filter(Boolean);
  return Array.from(new Set(types));
}

/** Chemical peel area names from the 2025 price list (e.g. Full Face, Full Back). */
export function getChemicalPeelAreasFromPriceList(): string[] {
  const section = TREATMENT_PRICE_LIST_2025.find((s) => s.category === "Chemical Peel");
  if (!section) return [];
  const areas = section.items
    .map((i) => splitChemicalPeelTypeAndArea(i.name).area)
    .filter((a): a is string => Boolean(a && a.trim()));
  return Array.from(new Set(areas));
}

/** Keep CA/general options only: exclude Henderson rows and single-location-only rows (e.g. Claremont only, Newport only). */
function isCaGeneralOption(item: TreatmentPriceItem): boolean {
  const name = item.name ?? "";
  const note = item.note ?? "";
  if (name.includes("Henderson")) return false;
  if (/only/i.test(note) && !/CA locations only|CA/i.test(note)) return false;
  return true;
}

/** Microneedling/PRFM type names from the 2025 price list (Medical Spa section). Used as Type options for Microneedling so selection matches pricing. */
export function getMicroneedlingTypesFromPriceList(): string[] {
  const section = TREATMENT_PRICE_LIST_2025.find((s) => s.category === "Medical Spa");
  if (!section) return [];
  return section.items
    .filter(
      (i) =>
        isCaGeneralOption(i) &&
        (i.name.includes("Microneedling") || i.name.includes("PRFM"))
    )
    .map((i) => i.name);
}

/** Neurotoxin type names from the 2025 price list (Injectables: Botox, Dysport, Sweating). Used as Type options so selection matches pricing. */
export function getNeurotoxinTypesFromPriceList(): string[] {
  const section = TREATMENT_PRICE_LIST_2025.find((s) => s.category === "Injectables");
  if (!section) return [];
  const normalized = section.items
    .filter(
      (i) =>
        isCaGeneralOption(i) &&
        (i.name.includes("Botox") ||
          i.name.includes("Dysport") ||
          i.name.includes("Sweating"))
    )
    .map((i) => {
      if (i.name.includes("Botox 1-Unit")) return "Botox";
      if (i.name.includes("Dysport 1-Unit")) return "Dysport";
      return i.name;
    });
  return Array.from(new Set(normalized));
}

/** Filler type names from the 2025 price list (Injectables: Filler, Voluma, Volux; Other Treatments: Filler Dissolver). Used as Type options so selection matches pricing. */
export function getFillerTypesFromPriceList(): string[] {
  const out: string[] = [];
  for (const section of TREATMENT_PRICE_LIST_2025) {
    if (section.category === "Injectables") {
      section.items
        .filter(
          (i) =>
            isCaGeneralOption(i) &&
            (i.name.includes("Filler") ||
              i.name.includes("Voluma") ||
              i.name.includes("Volux"))
        )
        .forEach((i) => out.push(i.name));
    } else if (section.category === "Other Treatments") {
      section.items
        .filter((i) => i.name.includes("Dissolver"))
        .forEach((i) => out.push(i.name));
    }
  }
  return out;
}

/** Biostimulants type names from the 2025 price list (Injectables: Radiesse, Sculptra, Skinvive). Type shows base name only; quantity (vials/syringes) is a separate field. */
export function getBiostimulantsTypesFromPriceList(): string[] {
  const section = TREATMENT_PRICE_LIST_2025.find((s) => s.category === "Injectables");
  if (!section) return [];
  const normalized: string[] = [];
  for (const i of section.items) {
    if (!isCaGeneralOption(i)) continue;
    if (i.name.includes("Radiesse")) {
      normalized.push("Radiesse");
    } else if (i.name.includes("Sculptra")) {
      normalized.push("Sculptra");
    } else if (i.name.includes("Skinvive")) {
      // Expose one clean type in selectors; pricing logic chooses II + add-on syringe SKU(s).
      normalized.push("Skinvive");
    }
  }
  return Array.from(new Set(normalized));
}

/** Category meta for checkout display (longevity, recovery, sessions). */
export const CHECKOUT_CATEGORY_META: Record<string, CategoryMeta> = {
  Skincare: { longevity: "Ongoing", downtime: "None", sessions: "Ongoing" },
  "Energy Device": { longevity: "6–12+ months", downtime: "3–7 days", sessions: "1–6" },
  "Chemical Peel": { longevity: "1–3 months", downtime: "3–7 days", sessions: "1–3" },
  Microneedling: { longevity: "2–4 months", downtime: "1–3 days", sessions: "1–5" },
  Filler: { longevity: "6–18 months", downtime: "1–2 days", sessions: "1–2" },
  Neurotoxin: { longevity: "3–4 months", downtime: "None", sessions: "1" },
  Biostimulants: { longevity: "18–24+ months", downtime: "1–3 days", sessions: "1–3" },
  Kybella: { longevity: "Permanent", downtime: "3–7 days", sessions: "1–2" },
  Threadlift: { longevity: "12–18 months", downtime: "3–7 days", sessions: "1" },
  PRP: { longevity: "Varies", downtime: "1–3 days", sessions: "Varies" },
  PDGF: { longevity: "Varies", downtime: "1–3 days", sessions: "Varies" },
};

export function getCategoryMeta(category: string): CategoryMeta | undefined {
  return CHECKOUT_CATEGORY_META[category?.trim() ?? ""];
}

type SkuWithCategory = TreatmentPriceItem & { category: string };

/** Get SKUs that belong to the given dashboard treatment category. */
function getSkusForDashboardCategory(dashboardCategory: string): SkuWithCategory[] {
  const sections = DASHBOARD_TO_PRICE_SECTIONS[dashboardCategory?.trim() ?? ""];
  if (!sections?.length) return [];
  const out: SkuWithCategory[] = [];
  for (const section of TREATMENT_PRICE_LIST_2025) {
    if (!sections.includes(section.category)) continue;
    const items = section.items;
    if (dashboardCategory === "Neurotoxin") {
      items
        .filter(
          (i) =>
            i.name.includes("Botox") || i.name.includes("Dysport") || i.name.includes("Sweating")
        )
        .forEach((i) => out.push({ ...i, category: section.category }));
    } else if (dashboardCategory === "Filler") {
      items
        .filter(
          (i) =>
            i.name.includes("Filler") ||
            i.name.includes("Voluma") ||
            i.name.includes("Volux") ||
            i.name.includes("Dissolver")
        )
        .forEach((i) => out.push({ ...i, category: section.category }));
    } else if (dashboardCategory === "Biostimulants") {
      items
        .filter(
          (i) =>
            i.name.includes("Radiesse") ||
            i.name.includes("Sculptra") ||
            i.name.includes("Skinvive")
        )
        .forEach((i) => out.push({ ...i, category: section.category }));
    } else if (dashboardCategory === "Microneedling") {
      items
        .filter((i) => i.name.includes("Microneedling") || i.name.includes("PRFM"))
        .forEach((i) => out.push({ ...i, category: section.category }));
    } else {
      items.forEach((i) => out.push({ ...i, category: section.category }));
    }
  }
  return out;
}

/** Normalize for fuzzy match: lowercase, collapse spaces, remove some punctuation. */
function norm(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/[\s–\-]+/g, " ")
    .trim();
}

/** Check if plan product/region text matches SKU name (contains or is contained). */
function skuNameMatches(skuName: string, productOrRegion: string): boolean {
  if (!productOrRegion?.trim()) return false;
  const a = norm(skuName);
  const b = norm(productOrRegion);
  if (a.includes(b) || b.includes(a)) return true;
  if (b.includes("face") && (a.includes("full face") || a.includes("face"))) return true;
  if (b.includes("neck") && a.includes("neck")) return true;
  if (b.includes("chest") && a.includes("chest")) return true;
  if (b.includes("moxi") && a.includes("moxi")) return true;
  if (b.includes("bbl") && a.includes("bbl")) return true;
  if (b.includes("botox") && a.includes("botox")) return true;
  if (b.includes("dysport") && a.includes("dysport")) return true;
  if (b.includes("filler") && (a.includes("filler") || a.includes("Voluma") || a.includes("Volux"))) return true;
  if (b.includes("radiasse") && a.includes("Radiesse")) return true;
  if (b.includes("sculptra") && a.includes("Sculptra")) return true;
  if (b.includes("microneedling") && a.includes("Microneedling")) return true;
  if (b.includes("peel") && a.includes("Peel")) return true;
  if (b.includes("facial") && a.includes("Facial")) return true;
  return false;
}

/** Default neurotoxin units for quoting when patient doesn't specify (typical multi-area treatment). */
export const DEFAULT_NEUROTOXIN_UNITS_FOR_QUOTE = 35;

/** Prefer Claremont/California pricing over Henderson when both exist. */
function preferClaremontCaSkus<T extends { name: string }>(skus: T[]): T[] {
  return [...skus].sort((a, b) => {
    const aH = a.name.includes("Henderson") ? 1 : 0;
    const bH = b.name.includes("Henderson") ? 1 : 0;
    return aH - bH;
  });
}

/** Match a plan item to a specific SKU and return price (total or per-unit × quantity). */
export function matchPlanItemToSku(
  item: PlanItemForPricing
): {
  sku: SkuWithCategory;
  totalPrice: number;
  isPerUnit?: boolean;
  unitPrice?: number;
  quantity?: number;
} | null {
  const treatment = (item.treatment ?? "").trim();
  if (!treatment) return null;
  // Skincare with a specific product (e.g. Retinol, Vitamin C) uses boutique pricing, not the 2025 facial price list.
  if (treatment === "Skincare" && (item.product ?? "").trim()) return null;
  let skus = getSkusForDashboardCategory(treatment);
  skus = preferClaremontCaSkus(skus);
  if (skus.length === 0) return null;

  const product = (item.product ?? "").trim();
  const region = (item.region ?? "").trim();
  const quantityStr = (item.quantity ?? "").trim();
  const qty = quantityStr ? parseInt(quantityStr, 10) : NaN;

  // Per-unit SKUs (Botox, Dysport) – use CA 1-Unit pricing only, not Henderson vials
  const perUnitSkus = skus.filter(
    (s) =>
      !s.name.includes("Henderson") &&
      (s.name.includes("1-Unit") ||
        (s.name.includes("Botox") && s.name.includes("Unit")) ||
        (s.name.includes("Dysport") && s.name.includes("Unit")))
  );
  const effectiveQty =
    !Number.isNaN(qty) && qty > 0
      ? qty
      : treatment === "Neurotoxin"
        ? DEFAULT_NEUROTOXIN_UNITS_FOR_QUOTE
        : 0;
  if (perUnitSkus.length > 0 && effectiveQty > 0) {
    const preferBotox = /botox|tox/i.test(product) && !/dysport/i.test(product);
    const preferDysport = /dysport/i.test(product);
    let chosen = perUnitSkus[0];
    if (preferBotox) chosen = perUnitSkus.find((s) => s.name.includes("Botox")) ?? chosen;
    if (preferDysport) chosen = perUnitSkus.find((s) => s.name.includes("Dysport")) ?? chosen;
    const totalPrice = chosen.price * effectiveQty;
    return {
      sku: chosen,
      totalPrice,
      isPerUnit: true,
      unitPrice: chosen.price,
      quantity: effectiveQty,
    };
  }

  // Chemical Peel: when both type and area are selected, require both to match the SKU.
  if (treatment === "Chemical Peel" && product && region) {
    const byTypeAndArea = skus.find(
      (s) => skuNameMatches(s.name, product) && skuNameMatches(s.name, region)
    );
    if (byTypeAndArea) return { sku: byTypeAndArea, totalPrice: byTypeAndArea.price };
  }

  // Biostimulants (Radiesse/Sculptra): type is base name only; quantity selects vial/syringe count SKU
  if (treatment === "Biostimulants" && product) {
    const bioQty = !Number.isNaN(qty) && qty > 0 ? qty : 1;
    if (/radiesse/i.test(product)) {
      const radiesseSkus = skus.filter((s) => s.name.includes("Radiesse"));
      const exact =
        bioQty === 1
          ? radiesseSkus.find((s) => s.name === "Radiesse")
          : radiesseSkus.find((s) => {
              const m = s.name.match(/Radiesse\s*[–-]\s*(\d+)\s*Syringe/i);
              return m && parseInt(m[1], 10) === bioQty;
            });
      if (exact) return { sku: exact, totalPrice: exact.price };
    }
    if (/sculptra/i.test(product)) {
      const sculptraSkus = skus.filter((s) => s.name.includes("Sculptra"));
      const exact = sculptraSkus.find((s) => {
        const m = s.name.match(/Sculptra\s*[–-]\s*(\d+)\s*Vial/i);
        return m && parseInt(m[1], 10) === bioQty;
      });
      if (exact) return { sku: exact, totalPrice: exact.price };
      if (bioQty === 1) {
        const one = sculptraSkus.find((s) => /Sculptra\s*[–-]\s*1\s*Vial/i.test(s.name));
        if (one) return { sku: one, totalPrice: one.price };
      }
    }
    if (/skinvive/i.test(product)) {
      const skinviveBase =
        skus.find((s) => /Skinvive\s*II/i.test(s.name)) ||
        skus.find((s) => /Skinvive/i.test(s.name));
      if (!skinviveBase) return null;
      const skinviveAddon = skus.find((s) => /Skinvive\s*III\s*Add-On\s*Syringe/i.test(s.name));
      if (bioQty <= 1 || !skinviveAddon) {
        return {
          sku: skinviveBase,
          totalPrice: skinviveBase.price,
          isPerUnit: true,
          unitPrice: skinviveBase.price,
          quantity: 1,
        };
      }
      // Skinvive pricing model: first syringe at Skinvive II, additional syringes at add-on rate.
      const totalPrice = skinviveBase.price + (bioQty - 1) * skinviveAddon.price;
      return {
        sku: skinviveBase,
        totalPrice,
        isPerUnit: true,
        unitPrice: skinviveAddon.price,
        quantity: bioQty,
      };
    }
  }

  // Try match by product then region
  const searchTerms = [product, region].filter(Boolean);
  let matched: SkuWithCategory | null = null;
  if (searchTerms.length > 0) {
    for (const term of searchTerms) {
      const found = skus.find((s) => skuNameMatches(s.name, term));
      if (found) {
        matched = found;
        break;
      }
    }
    if (!matched) {
      const term = searchTerms[0];
      const byContains = skus.filter((s) => skuNameMatches(s.name, term));
      if (byContains.length > 0) matched = byContains[0];
    }
  }
  if (!matched) {
    if (skus.length === 1) matched = skus[0];
    else if (treatment === "Filler" && !product) matched = skus.find((s) => s.name.includes("Fillers (except")) ?? skus[0];
    else if (treatment === "Neurotoxin" && !product) matched = skus.find((s) => s.name.includes("Botox 1-Unit")) ?? skus.find((s) => s.name.includes("Botox – Henderson")) ?? skus[0];
    else matched = skus[0];
  }
  if (!matched) return null;
  // Filler: quantity is in Syringes; if set, price should scale by quantity.
  if (treatment === "Filler" && !Number.isNaN(qty) && qty > 0) {
    return {
      sku: matched,
      totalPrice: matched.price * qty,
      isPerUnit: true,
      unitPrice: matched.price,
      quantity: qty,
    };
  }
  return { sku: matched, totalPrice: matched.price };
}

/** Same display string used on checkout lines for a matched SKU (per-unit or flat). */
export function formatSkuMatchDisplayPrice(match: {
  totalPrice: number;
  isPerUnit?: boolean;
  unitPrice?: number;
  quantity?: number;
}): string {
  return match.isPerUnit &&
    match.quantity != null &&
    match.unitPrice != null
    ? `${match.quantity} × ${formatPrice(match.unitPrice)} = ${formatPrice(match.totalPrice)}`
    : formatPrice(match.totalPrice);
}

/**
 * Estimated price range for a single plan item based on treatment category (2025 list).
 */
export function getEstimatedPriceForPlanItem(
  item: PlanItemForPricing
): { min: number; max: number; displayPrice: string } | undefined {
  const range = getPriceRangeNumeric2025(item.treatment?.trim() ?? "");
  if (!range) return undefined;
  if (range.min === 0 && range.max === 0) return undefined;
  return {
    min: range.min,
    max: range.max,
    displayPrice:
      range.min === range.max
        ? formatPrice(range.min)
        : `${formatPrice(range.min)}–${formatPrice(range.max)}`,
  };
}

/**
 * Build checkout summary: line items with estimated prices and total range.
 * Items without a matching price are omitted from totals but can still be shown with "Price varies".
 */
export function getCheckoutSummary(
  items: (PlanItemForPricing & { id?: string })[],
  getLabel: (item: PlanItemForPricing & { id?: string }) => string
): {
  lineItems: CheckoutLineItem[];
  totalMin: number;
  totalMax: number;
  hasUnknownPrices: boolean;
} {
  const lineItems: CheckoutLineItem[] = [];
  let totalMin = 0;
  let totalMax = 0;
  let hasUnknownPrices = false;
  for (const item of items) {
    const label = getLabel(item);
    const est = getEstimatedPriceForPlanItem(item);
    if (est) {
      lineItems.push({
        label,
        min: est.min,
        max: est.max,
        displayPrice: est.displayPrice,
      });
      totalMin += est.min;
      totalMax += est.max;
    } else {
      lineItems.push({
        label,
        min: 0,
        max: 0,
        displayPrice: "Price varies",
      });
      hasUnknownPrices = true;
    }
  }
  return { lineItems, totalMin, totalMax, hasUnknownPrices };
}

/**
 * Rich checkout line: SKU-level price plus longevity, recovery, sessions for detail view.
 */
export interface CheckoutLineItemDetail {
  /** Display label (e.g. "Laser • Full Face") */
  label: string;
  /** Matched SKU name from price list (e.g. "Moxi Full Face") */
  skuName?: string;
  /** Note from price list (e.g. "CA locations only") */
  skuNote?: string;
  /** Single price for this line (for total) */
  price: number;
  /** Formatted price for display (e.g. "$550" or "40 units × $13 = $520") */
  displayPrice: string;
  /** Longevity (e.g. "6–12+ months") */
  longevity?: string;
  /** Recovery/downtime (e.g. "3–7 days") */
  downtime?: string;
  /** Sessions (e.g. "1–6") */
  sessions?: string;
  /** Optional photo URL for treatment (caller can attach) */
  photoUrl?: string;
  /** True if no SKU matched (price is 0, displayPrice may be "Price varies") */
  isEstimate?: boolean;
  /** Product description (skincare only; when set, longevity/recovery/sessions are omitted) */
  description?: string;
  /** Quote UI grouping: `skincare` = Skin Boutique retail product line only; `treatment` = everything else (including facials under Skincare category) */
  quoteLineKind?: "skincare" | "treatment";
}

/** Skincare boutique product info for checkout (from getSkincareCarouselItems / TREATMENT_BOUTIQUE_SKINCARE). */
export interface SkincareProductInfo {
  price?: number;
  displayPrice: string;
  imageUrl?: string;
  productLabel: string;
  /** Short description (shown instead of longevity/recovery/sessions for skincare) */
  description?: string;
}

/**
 * Build checkout summary with SKU-level prices and category meta (longevity, downtime, sessions).
 * Uses specific SKU when product/region/quantity match; otherwise falls back to category range.
 * For Skincare + product, pass getSkincareProductInfo to use boutique product name, price, and image (not the 2025 facial list).
 */
export function getCheckoutSummaryWithSkus(
  items: (PlanItemForPricing & { id?: string })[],
  getLabel: (item: PlanItemForPricing & { id?: string }) => string,
  getSkincareProductInfo?: (productName: string) => SkincareProductInfo | null
): {
  lineItems: CheckoutLineItemDetail[];
  total: number;
  hasUnknownPrices: boolean;
} {
  const lineItems: CheckoutLineItemDetail[] = [];
  let total = 0;
  let hasUnknownPrices = false;
  const category = (item: PlanItemForPricing) => (item.treatment ?? "").trim();
  const meta = (cat: string) => getCategoryMeta(cat);

  for (const item of items) {
    const label = getLabel(item);
    const cat = category(item);
    const categoryMeta = meta(cat);
    const productName = (item.product ?? "").trim();

    /** Retail Skin Boutique products only — not in-office facials under the Skincare category. */
    const skincareLineKind = "skincare" as const;
    const treatmentLineKind = "treatment" as const;

    if (cat === "Skincare" && productName && getSkincareProductInfo) {
      const skincare = getSkincareProductInfo(productName);
      if (skincare) {
        lineItems.push({
          label: skincare.productLabel,
          skuName: skincare.productLabel,
          price: skincare.price ?? 0,
          displayPrice: skincare.displayPrice,
          photoUrl: skincare.imageUrl,
          isEstimate: !skincare.price,
          description: skincare.description,
          quoteLineKind: skincareLineKind,
          /* longevity/downtime/sessions omitted for skincare products */
        });
        total += skincare.price ?? 0;
        if (!skincare.price) hasUnknownPrices = true;
        continue;
      }
    }

    const match = matchPlanItemToSku(item);

    if (match) {
      const displayPrice = formatSkuMatchDisplayPrice(match);
      const isPerUnitNeuro =
        match.isPerUnit && /1-Unit|Unit/i.test(match.sku.name);
      const region = (item.region ?? "").trim();
      const neuroBrand = match.sku.name.includes("Dysport")
        ? "Dysport"
        : match.sku.name.includes("Botox")
          ? "Botox"
          : (item.treatment ?? "Neurotoxin").trim();
      const skuName = isPerUnitNeuro
        ? region
          ? `${neuroBrand} to ${region}`
          : neuroBrand
        : match.sku.name;
      lineItems.push({
        label,
        skuName,
        skuNote: match.sku.note,
        price: match.totalPrice,
        displayPrice,
        longevity: categoryMeta?.longevity,
        downtime: categoryMeta?.downtime,
        sessions: categoryMeta?.sessions,
        isEstimate: false,
        quoteLineKind: treatmentLineKind,
      });
      total += match.totalPrice;
    } else {
      const wellnest = getWellnestOfferingByTreatmentName(cat);
      if (wellnest) {
        const minPrice = parseWellnestPriceMin(wellnest.pricing);
        const wmeta = getWellnestPeptideMeta(cat);
        lineItems.push({
          label,
          skuName: wellnest.treatmentName,
          price: minPrice,
          displayPrice: wellnest.pricing,
          longevity: wmeta?.longevity,
          downtime: wmeta?.downtime,
          isEstimate: minPrice <= 0,
          quoteLineKind: treatmentLineKind,
        });
        total += minPrice;
        if (minPrice <= 0) hasUnknownPrices = true;
        continue;
      }
      const range = getPriceRangeNumeric2025(cat);
      const categoryMetaFallback = meta(cat);
      if (range && (range.min > 0 || range.max > 0)) {
        const displayPrice =
          range.min === range.max
            ? formatPrice(range.min)
            : `${formatPrice(range.min)}–${formatPrice(range.max)}`;
        lineItems.push({
          label,
          price: range.min,
          displayPrice,
          longevity: categoryMetaFallback?.longevity,
          downtime: categoryMetaFallback?.downtime,
          sessions: categoryMetaFallback?.sessions,
          isEstimate: true,
          quoteLineKind: treatmentLineKind,
        });
        total += range.min;
      } else {
        lineItems.push({
          label,
          price: 0,
          displayPrice: "Price varies",
          longevity: categoryMetaFallback?.longevity,
          downtime: categoryMetaFallback?.downtime,
          sessions: categoryMetaFallback?.sessions,
          isEstimate: true,
          quoteLineKind: treatmentLineKind,
        });
        hasUnknownPrices = true;
      }
    }
  }
  return { lineItems, total, hasUnknownPrices };
}
