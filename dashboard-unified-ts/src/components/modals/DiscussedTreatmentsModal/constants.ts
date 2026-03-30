// Discussed Treatments Modal – static data and options

import {
  getPriceRange2025,
  type DashboardTreatmentCategory,
  TREATMENT_CATEGORIES_IN_PRICE_LIST,
  isProviderRestrictedToPricingSheet,
  getEnergyDeviceTypesFromPriceList,
  getChemicalPeelTypesFromPriceList,
  getChemicalPeelAreasFromPriceList,
  getMicroneedlingTypesFromPriceList,
  getNeurotoxinTypesFromPriceList,
  getFillerTypesFromPriceList,
  getBiostimulantsTypesFromPriceList,
} from "../../../data/treatmentPricing2025";
import {
  getWellnestOfferingByTreatmentName,
  getWellnestProductOptionsForTreatment,
  getWellnestTreatmentOptionNames,
  isWellnestWellnessProviderCode,
} from "../../../data/wellnestOfferings";

export const AIRTABLE_FIELD = "Treatments Discussed";
export const OTHER_LABEL = "Other";
/** Placeholder treatment when user adds only a goal (no specific treatments). */
export const TREATMENT_GOAL_ONLY = "Goal only";

/** Assessment findings (e.g. from facial analysis) – user can add by finding first */
export const ASSESSMENT_FINDINGS = [
  "Thin Lips",
  "Dry Lips",
  "Asymmetric Lips",
  "Under Eye Hollows",
  "Under Eye Wrinkles",
  "Excess Upper Eyelid Skin",
  "Forehead Wrinkles",
  "Bunny Lines",
  "Crow's feet",
  "Mid Cheek Flattening",
  "Cheekbone - Not Prominent",
  "Nasolabial Folds",
  "Marionette Lines",
  "Prejowl Sulcus",
  "Retruded Chin",
  "Ill-Defined Jawline",
  "Jowls",
  "Excess/Submental Fullness",
  "Over-Projected Chin",
  "Temporal Hollow",
  "Platysmal Bands",
  "Loose Neck Skin",
  "Dark Spots",
  "Red Spots",
  "Gummy Smile",
  "Dorsal Hump",
  "Crooked Nose",
  "Droopy Tip",
  "Eyelid Bags",
  "Scars",
  "Fine Lines",
  "Masseter Hypertrophy",
  "Sagging Skin",
];
export const OTHER_FINDING_LABEL = "Other finding";

/** Assessment findings grouped by area (for "by treatment" flow and organization) */
export const ASSESSMENT_FINDINGS_BY_AREA: {
  area: string;
  findings: string[];
}[] = [
  {
    area: "Lips",
    findings: ["Thin Lips", "Dry Lips", "Asymmetric Lips", "Gummy Smile"],
  },
  {
    area: "Eyes",
    findings: [
      "Under Eye Hollows",
      "Under Eye Wrinkles",
      "Excess Upper Eyelid Skin",
      "Eyelid Bags",
      "Crow's feet",
    ],
  },
  {
    area: "Forehead",
    findings: ["Forehead Wrinkles", "Bunny Lines", "Temporal Hollow"],
  },
  {
    area: "Cheeks",
    findings: ["Mid Cheek Flattening", "Cheekbone - Not Prominent"],
  },
  { area: "Nasolabial", findings: ["Nasolabial Folds", "Marionette Lines"] },
  {
    area: "Jawline",
    findings: [
      "Prejowl Sulcus",
      "Retruded Chin",
      "Ill-Defined Jawline",
      "Jowls",
      "Excess/Submental Fullness",
      "Over-Projected Chin",
      "Masseter Hypertrophy",
    ],
  },
  { area: "Neck", findings: ["Platysmal Bands", "Loose Neck Skin"] },
  {
    area: "Skin",
    findings: [
      "Dark Spots",
      "Red Spots",
      "Scars",
      "Fine Lines",
      "Sagging Skin",
    ],
  },
  { area: "Nose", findings: ["Dorsal Hump", "Crooked Nose", "Droopy Tip"] },
];

/** Skincare: products from The Treatment Skin Boutique (shop.getthetreatment.com) + Other */
import {
  TREATMENT_BOUTIQUE_SKINCARE,
  type TreatmentBoutiqueProduct,
} from "./treatmentBoutiqueProducts";

export const SKINCARE_PRODUCTS = [
  ...TREATMENT_BOUTIQUE_SKINCARE.map((p) => p.name),
  "Other",
];

/** Skincare carousel items: name + optional image URL + optional description, price, imageUrls (same order as SKINCARE_PRODUCTS) */
export function getSkincareCarouselItems(): {
  name: string;
  imageUrl?: string;
  productUrl?: string;
  description?: string;
  price?: string;
  imageUrls?: string[];
}[] {
  return [
    ...TREATMENT_BOUTIQUE_SKINCARE.map((p: TreatmentBoutiqueProduct) => ({
      name: p.name,
      imageUrl: p.imageUrl,
      productUrl: p.productUrl,
      description: p.description,
      price: p.price,
      imageUrls: p.imageUrls,
    })),
    { name: "Other" },
  ];
}

/** Energy Device: types from price list (Laser, Sofwave, Ultherapy) plus Other. Used when not restricted to pricing sheet. */
export const ENERGY_DEVICE_TYPES = [
  "Moxi",
  "BBL (BroadBand Light)",
  "Moxi + BBL",
  "Sofwave",
  "Ultherapy",
  "Other",
];

export const OTHER_PRODUCT_LABEL = "Other";
export const SEE_ALL_OPTIONS_LABEL = "See all options";

/** Recommended product subsets by goal/finding context (keyword match). */
export const RECOMMENDED_PRODUCTS_BY_CONTEXT: {
  treatment: string;
  keywords: string[];
  products: string[];
}[] = [
  {
    treatment: "Skincare",
    keywords: ["hydrate", "dry", "moisturize", "barrier", "laxity"],
    products: [
      "SkinCeuticals Hyaluronic Acid Intensifier | Multi-Glycan Hydrating Serum for Plump & Smooth Skin",
      "SkinCeuticals Hydrating B5 Gel | Lightweight Moisturizer with Vitamin B5 for Deep Skin Hydration",
      "GM Collin Daily Ceramide Comfort | Nourishing Skin Barrier Capsules for Hydration & Repair (20 Ct.)",
      "SkinCeuticals Triple Lipid Restore 2:4:2 | Anti-Aging Moisturizer for Skin Barrier Repair & Hydration",
    ],
  },
  {
    treatment: "Skincare",
    keywords: [
      "acne",
      "red spot",
      "oil",
      "breakout",
      "pore",
      "salicylic",
      "benzoyl",
    ],
    products: [
      "SkinCeuticals Blemish + Age Defense | Targeted Serum for Acne and Signs of Aging",
      "GM Collin Essential Oil Complex | Nourishing Blend for Calm, Hydrated, Glowing Skin",
      "SkinCeuticals Silymarin CF | Antioxidant Serum for Oily & Acne-Prone Skin",
    ],
  },
  {
    treatment: "Skincare",
    keywords: [
      "dark spot",
      "pigment",
      "even skin",
      "tone",
      "hyperpigmentation",
      "melasma",
    ],
    products: [
      "SkinCeuticals C E Ferulic | Antioxidant Vitamin C Serum for Brightening & Anti-Aging",
      "SkinCeuticals Phloretin CF | Antioxidant Serum for Environmental Damage & Uneven Skin Tone",
      "SkinCeuticals Serum 10 AOX | Antioxidant Serum with 10% Vitamin C for Brightening & Protection",
      "SkinCeuticals Discoloration Defense | Targeted Serum for Dark Spots & Uneven Skin Tone",
      "SkinCeuticals Phyto A+ Brightening Treatment | Lightweight Gel Moisturizer for Dull, Uneven Skin",
      "The Treatment On The Daily SPF 45 | Lightweight Sunscreen for Daily Protection",
    ],
  },
  {
    treatment: "Skincare",
    keywords: [
      "fine line",
      "smoothen",
      "wrinkle",
      "anti-aging",
      "exfoliate",
      "scar",
    ],
    products: [
      "SkinCeuticals Retinol 0.3% | Anti-Aging Serum for Wrinkles & Skin Renewal",
      "SkinCeuticals Retinol 0.5% | Anti-Aging Serum for Wrinkles & Skin Renewal",
      "SkinCeuticals Retinol 1.0% | Anti-Aging Serum for Wrinkles & Skin Renewal",
      "SkinCeuticals C E Ferulic | Antioxidant Vitamin C Serum for Brightening & Anti-Aging",
      "SkinCeuticals Metacell Renewal B3 | Brightening & Anti-Aging Serum with Vitamin B3",
      "SkinCeuticals Glycolic 10 Renew Overnight | Exfoliating Night Serum for Smoother, Radiant Skin",
    ],
  },
  {
    treatment: "Skincare",
    keywords: ["sensitive", "redness", "irritat", "licorice", "centella"],
    products: [
      "GM Collin Sensiderm Cleansing Milk | Gentle Cleanser for Sensitive & Irritated Skin",
      "SkinCeuticals Triple Lipid Restore 2:4:2 | Anti-Aging Moisturizer for Skin Barrier Repair & Hydration",
      "SkinCeuticals Phyto Corrective Gel | Soothing Hydrating Serum for Redness & Sensitive Skin",
      "The Treatment On The Daily SPF 45 | Lightweight Sunscreen for Daily Protection",
    ],
  },
  {
    treatment: "Energy Device",
    keywords: [
      "dark spot",
      "pigment",
      "even skin",
      "tone",
      "red spot",
      "vascular",
    ],
    products: [
      "BBL (BroadBand Light)",
      "IPL (Intense Pulsed Light)",
      "PicoSure",
      "PicoWay",
      "VBeam (Pulsed Dye)",
      "Excel V",
    ],
  },
  {
    treatment: "Energy Device",
    keywords: [
      "fine line",
      "smoothen",
      "wrinkle",
      "resurfacing",
      "scar",
      "exfoliate",
    ],
    products: [
      "Moxi",
      "Halo",
      "Moxi + BBL",
      "Fraxel",
      "Clear + Brilliant",
      "Sciton ProFractional",
      "AcuPulse",
    ],
  },
  {
    treatment: "Chemical Peel",
    keywords: ["acne", "oil", "red spot", "exfoliate"],
    products: ["Salicylic", "Glycolic", "Jessner", "Mandelic"],
  },
  {
    treatment: "Chemical Peel",
    keywords: ["dark spot", "pigment", "even skin", "tone"],
    products: ["Glycolic", "TCA", "Mandelic", "VI Peel", "Lactic acid"],
  },
  {
    treatment: "Chemical Peel",
    keywords: ["fine line", "smoothen", "wrinkle", "exfoliate"],
    products: ["Glycolic", "TCA", "Lactic acid", "Jessner"],
  },
  {
    treatment: "Filler",
    keywords: ["lip", "lips", "balance lips", "thin lips", "dry lips"],
    products: ["Hyaluronic acid (HA) – lip"],
  },
  {
    treatment: "Filler",
    keywords: ["cheek", "volume", "mid cheek", "cheekbone", "hollow"],
    products: [
      "Hyaluronic acid (HA) – cheek",
      "PLLA / Sculptra",
      "Calcium hydroxyapatite (e.g. Radiesse)",
    ],
  },
  {
    treatment: "Filler",
    keywords: ["nasolabial", "marionette", "shadow", "smile line"],
    products: [
      "Hyaluronic acid (HA) – nasolabial",
      "Hyaluronic acid (HA) – other",
    ],
  },
  {
    treatment: "Filler",
    keywords: ["under eye", "tear trough", "hollow", "eyelid"],
    products: [
      "Hyaluronic acid (HA) – tear trough",
      "Hyaluronic acid (HA) – other",
    ],
  },
  {
    treatment: "Neurotoxin",
    keywords: [
      "fine line",
      "smoothen",
      "wrinkle",
      "forehead",
      "crow",
      "bunny",
      "gummy smile",
    ],
    products: [
      "OnabotulinumtoxinA (Botox)",
      "AbobotulinumtoxinA (Dysport)",
      "IncobotulinumtoxinA (Xeomin)",
      "PrabotulinumtoxinA (Jeuveau)",
      "DaxibotulinumtoxinA (Daxxify)",
    ],
  },
  {
    treatment: "Microneedling",
    keywords: ["scar", "fine line", "texture", "pore", "laxity", "tighten"],
    products: [
      "Standard microneedling",
      "RF microneedling",
      "With growth factors / PRP",
      "Nanoneedling",
      "TCA / TCA cross (acne scars)",
      "Suction (acne scars)",
      "With TXA (tranexamic acid)",
    ],
  },
];

/** Skincare category options for filtering the product carousel (treatment recommender). Includes an "Other" category for products not in the first five. */
const _SKINCARE_CATEGORIES_FROM_CONTEXT: {
  label: string;
  products: string[];
}[] = RECOMMENDED_PRODUCTS_BY_CONTEXT.filter(
  (r) => r.treatment === "Skincare",
).map((r, i) => ({
  label:
    i === 0
      ? "Hydration"
      : i === 1
        ? "Acne / oil"
        : i === 2
          ? "Dark spots / tone"
          : i === 3
            ? "Fine lines / anti-aging"
            : i === 4
              ? "Sensitive skin"
              : (r.keywords[0] ?? "Other"),
  products: r.products,
}));

const _ALL_CATEGORIZED_SKINCARE = new Set(
  _SKINCARE_CATEGORIES_FROM_CONTEXT.flatMap((c) => c.products),
);
const _OTHER_SKINCARE_PRODUCTS = SKINCARE_PRODUCTS.filter(
  (p) => !_ALL_CATEGORIZED_SKINCARE.has(p),
);

export const SKINCARE_CATEGORY_OPTIONS: {
  label: string;
  products: string[];
}[] = [
  ..._SKINCARE_CATEGORIES_FROM_CONTEXT,
  ...(_OTHER_SKINCARE_PRODUCTS.length > 0
    ? [{ label: "Other", products: _OTHER_SKINCARE_PRODUCTS }]
    : []),
];

/** Treatment type / product options per treatment (for product selector when that treatment is selected) */
export const TREATMENT_PRODUCT_OPTIONS: Record<string, string[]> = {
  Skincare: [...SKINCARE_PRODUCTS],
  "Energy Device": [...ENERGY_DEVICE_TYPES],
  Filler: [...getFillerTypesFromPriceList(), OTHER_PRODUCT_LABEL],
  Neurotoxin: [...getNeurotoxinTypesFromPriceList(), OTHER_PRODUCT_LABEL],
  "Chemical Peel": [...getChemicalPeelTypesFromPriceList(), OTHER_PRODUCT_LABEL],
  Microneedling: [...getMicroneedlingTypesFromPriceList(), OTHER_PRODUCT_LABEL],
  PRP: [
    "PRP",
    "PRP with microneedling",
    "PRP (platelet-rich plasma)",
    OTHER_PRODUCT_LABEL,
  ],
  PDGF: [
    "PDGF",
    "PDGF (platelet-derived growth factor)",
    "PDGF with microneedling",
    OTHER_PRODUCT_LABEL,
  ],
  Biostimulants: [...getBiostimulantsTypesFromPriceList(), OTHER_PRODUCT_LABEL],
  Kybella: [
    "Kybella (deoxycholic acid)",
    "Other injectable",
    OTHER_PRODUCT_LABEL,
  ],
  Threadlift: [
    "PDO threads",
    "PCL threads",
    "Suspension threads",
    "Barbed",
    "Smooth",
    OTHER_PRODUCT_LABEL,
  ],
};

/** Post-care instructions + suggested products per treatment. */
export const TREATMENT_POSTCARE: Record<
  string,
  {
    sendInstructionsLabel: string;
    instructionsText: string;
    suggestedProducts: string[];
  }
> = {
  "Energy Device": {
    sendInstructionsLabel: "Send energy device / laser post-care instructions",
    instructionsText: `Post-Care Instructions for Laser / Energy Device

• Avoid sun exposure for 24–48 hours; use SPF 50+ daily
• Keep treated area clean and moisturized
• No makeup for 24 hours if possible
• Avoid harsh actives (retinoids, acids) for 3–5 days
• No hot tubs, saunas, or intense exercise for 24–48 hours
• Apply healing balm or recommended post-care as directed`,
    suggestedProducts: [],
  },
  "Chemical Peel": {
    sendInstructionsLabel: "Send chemical peel post-care instructions",
    instructionsText: `Post-Care Instructions for Chemical Peel

• Use gentle cleanser and moisturizer only for 24–48 hours
• Apply SPF 50+ daily; avoid sun exposure
• No picking or peeling skin
• Avoid retinoids, AHAs/BHAs, and exfoliants for 5–7 days
• No waxing or harsh treatments on treated area
• Keep skin hydrated`,
    suggestedProducts: [],
  },
  Microneedling: {
    sendInstructionsLabel: "Send microneedling post-care instructions",
    instructionsText: `Post-Care Instructions for Microneedling

• Avoid sun exposure; use SPF 50+ daily
• No makeup for 24 hours
• Keep skin clean and moisturized; avoid harsh actives for 3–5 days
• No saunas, hot yoga, or intense sweating for 24–48 hours
• Use gentle, hydrating products only`,
    suggestedProducts: [],
  },
  Filler: {
    sendInstructionsLabel: "Send filler aftercare instructions",
    instructionsText: `Post-Care Instructions for Filler

• Avoid touching or massaging treated area for 24 hours (unless directed)
• No strenuous exercise for 24–48 hours
• Avoid alcohol and blood thinners for 24 hours
• Ice if needed for swelling; sleep with head elevated first night
• Call if you notice severe pain, vision changes, or blanching`,
    suggestedProducts: [],
  },
  Neurotoxin: {
    sendInstructionsLabel: "Send neurotoxin aftercare instructions",
    instructionsText: `Post-Care Instructions for Neurotoxin (e.g. Botox)

• No rubbing or massaging treated area for 24 hours
• Avoid strenuous exercise for 24 hours
• Results typically visible in 1-2 weeks`,
    suggestedProducts: [],
  },
  Skincare: {
    sendInstructionsLabel: "Send skincare routine instructions",
    instructionsText: `Skincare Routine Instructions

• Apply products in order: cleanse → treat → moisturize → SPF (AM)
• Use as directed; allow actives to absorb before next step
• Patch test new products if sensitive`,
    suggestedProducts: [],
  },
  PRP: {
    sendInstructionsLabel: "Send PRP post-care instructions",
    instructionsText: `Post-Care Instructions for PRP

• Avoid sun exposure; use SPF 50+ daily
• No makeup for 24 hours
• Keep skin clean and moisturized; avoid harsh actives for 3–5 days
• No saunas, hot yoga, or intense sweating for 24–48 hours`,
    suggestedProducts: [],
  },
  PDGF: {
    sendInstructionsLabel: "Send PDGF post-care instructions",
    instructionsText: `Post-Care Instructions for PDGF

• Avoid sun exposure; use SPF 50+ daily
• No makeup for 24 hours
• Keep skin clean and moisturized; avoid harsh actives for 3–5 days
• No saunas, hot yoga, or intense sweating for 24–48 hours`,
    suggestedProducts: [],
  },
};

const WELLNEST_PEPTIDE_POSTCARE: (typeof TREATMENT_POSTCARE)[string] = {
  sendInstructionsLabel: "Send peptide counseling notes",
  instructionsText: `Peptide therapy — patient education

• Follow your clinician's dosing and route instructions exactly
• Store and handle per pharmacy labeling (often refrigerated when indicated)
• Report injection-site reactions, fever, or unexpected symptoms promptly
• For use under medical supervision only`,
  suggestedProducts: [],
};

export function resolveTreatmentPostcare(
  treatment: string | undefined,
): (typeof TREATMENT_POSTCARE)[string] | undefined {
  if (!treatment?.trim()) return undefined;
  const direct = TREATMENT_POSTCARE[treatment];
  if (direct) return direct;
  if (getWellnestOfferingByTreatmentName(treatment)) return WELLNEST_PEPTIDE_POSTCARE;
  return undefined;
}

/** Map goal (interest) → suggested region(s). */
export const GOAL_TO_REGIONS: { keywords: string[]; regions: string[] }[] = [
  { keywords: ["lip", "lips"], regions: ["Lips"] },
  {
    keywords: ["eye", "eyelid", "under eye", "shadow", "tear trough"],
    regions: ["Under eyes", "Forehead", "Crow's feet"],
  },
  {
    keywords: ["brow", "forehead"],
    regions: ["Forehead", "Glabella", "Crow's feet"],
  },
  { keywords: ["cheek"], regions: ["Cheeks", "Nasolabial"] },
  {
    keywords: ["jaw", "jawline", "prejowl", "jowl", "chin", "submentum"],
    regions: ["Jawline"],
  },
  { keywords: ["neck", "platysmal"], regions: ["Jawline"] },
  { keywords: ["nose"], regions: ["Other"] },
  {
    keywords: [
      "skin",
      "tone",
      "scar",
      "line",
      "exfoliate",
      "hydrate skin",
      "laxity",
      "tighten",
    ],
    regions: [
      "Nasolabial",
      "Forehead",
      "Glabella",
      "Crow's feet",
      "Cheeks",
      "Jawline",
      "Under eyes",
      "Other",
    ],
  },
];

/** Map assessment finding → suggested goal, region, and treatments. */
export const FINDING_TO_GOAL_REGION_TREATMENTS: {
  keywords: string[];
  goal: string;
  region: string;
  treatments: string[];
}[] = [
  {
    keywords: ["thin lips", "asymmetric lips"],
    goal: "Balance Lips",
    region: "Lips",
    treatments: ["Filler", "Neurotoxin"],
  },
  {
    keywords: ["dry lips"],
    goal: "Hydrate Lips",
    region: "Lips",
    treatments: ["Filler", "Skincare"],
  },
  {
    keywords: ["under eye hollow", "eyelid bag", "tear trough"],
    goal: "Rejuvenate Lower Eyelids",
    region: "Under eyes",
    treatments: ["Filler", "Biostimulants"],
  },
  {
    keywords: ["under eye wrinkle"],
    goal: "Smoothen Fine Lines",
    region: "Under eyes",
    treatments: ["Neurotoxin", "Filler", "Microneedling", "Energy Device"],
  },
  {
    keywords: ["excess upper eyelid", "excess skin"],
    goal: "Rejuvenate Upper Eyelids",
    region: "Other",
    treatments: ["Energy Device", "Chemical Peel"],
  },
  {
    keywords: ["forehead wrinkle", "bunny line", "crow's feet"],
    goal: "Smoothen Fine Lines",
    region: "Forehead",
    treatments: ["Neurotoxin", "Filler", "Energy Device"],
  },
  {
    keywords: ["mid cheek", "cheek flatten", "cheekbone"],
    goal: "Improve Cheek Definition",
    region: "Cheeks",
    treatments: ["Filler", "Biostimulants"],
  },
  {
    keywords: ["nasolabial", "marionette", "smile line"],
    goal: "Shadow Correction",
    region: "Nasolabial",
    treatments: [
      "Filler",
      "Biostimulants",
      "Energy Device",
      "Chemical Peel",
      "Microneedling",
    ],
  },
  {
    keywords: ["prejowl", "retruded chin", "chin"],
    goal: "Balance Jawline",
    region: "Jawline",
    treatments: ["Filler", "Biostimulants"],
  },
  {
    keywords: ["jowl", "ill-defined jaw", "submental", "over-project"],
    goal: "Contour Jawline",
    region: "Jawline",
    treatments: ["Filler", "Biostimulants", "Kybella"],
  },
  {
    keywords: ["temporal hollow"],
    goal: "Balance Forehead",
    region: "Forehead",
    treatments: ["Filler", "Biostimulants"],
  },
  {
    keywords: ["platysmal", "loose neck", "neck"],
    goal: "Contour Neck",
    region: "Jawline",
    treatments: ["Neurotoxin", "Kybella", "Biostimulants"],
  },
  {
    keywords: ["dark spot", "red spot"],
    goal: "Even Skin Tone",
    region: "Other",
    treatments: ["Energy Device", "Chemical Peel", "Skincare"],
  },
  {
    keywords: ["gummy smile"],
    goal: "Balance Lips",
    region: "Lips",
    treatments: ["Neurotoxin"],
  },
  {
    keywords: ["dorsal hump", "crooked nose", "droopy tip"],
    goal: "Balance Nose",
    region: "Other",
    treatments: ["Filler"],
  },
  {
    keywords: ["scar", "fine line"],
    goal: "Smoothen Fine Lines",
    region: "Other",
    treatments: [
      "Energy Device",
      "Chemical Peel",
      "Microneedling",
      "PRP",
      "PDGF",
      "Filler",
      "Neurotoxin",
      "Biostimulants",
    ],
  },
  {
    keywords: ["masseter", "hypertrophy"],
    goal: "Contour Jawline",
    region: "Jawline",
    treatments: ["Neurotoxin"],
  },
  {
    keywords: ["sagging", "laxity"],
    goal: "Tighten Skin Laxity",
    region: "Other",
    treatments: ["Energy Device", "Biostimulants"],
  },
];

/** All treatment interest options (full list – users can select any or Other) */
export const ALL_INTEREST_OPTIONS = [
  "Contour Cheeks",
  "Improve Cheek Definition",
  "Rejuvenate Upper Eyelids",
  "Rejuvenate Lower Eyelids",
  "Balance Brows",
  "Balance Forehead",
  "Contour Jawline",
  "Contour Neck",
  "Balance Jawline",
  "Hydrate Lips",
  "Balance Lips",
  "Balance Nose",
  "Hydrate Skin",
  "Tighten Skin Laxity",
  "Shadow Correction",
  "Exfoliate Skin",
  "Smoothen Fine Lines",
  "Even Skin Tone",
  "Fade Scars",
];

/** Treatment names to exclude from selectable options (surgical / invasive procedures). */
export const SURGICAL_TREATMENTS = [
  "Threadlift",
  "Blepharoplasty",
  "Facelift",
  "Rhinoplasty",
  "Surgical",
];

/** All treatment/procedure options (non-surgical only). */
const ALL_TREATMENTS_RAW = [
  "Skincare",
  "Energy Device",
  "Chemical Peel",
  "Microneedling",
  "Filler",
  "Neurotoxin",
  "Biostimulants",
  "Kybella",
  "Threadlift",
  "PRP",
  "PDGF",
];
export const ALL_TREATMENTS = ALL_TREATMENTS_RAW.filter(
  (t) => !SURGICAL_TREATMENTS.includes(t),
);
export const OTHER_TREATMENT_LABEL = "Other";

/** Treatment options for the current provider. When provider is TheTreatment250, only categories that exist in the 2025 pricing sheet are returned. */
export function getTreatmentOptionsForProvider(providerCode: string | undefined): string[] {
  if (isWellnestWellnessProviderCode(providerCode)) {
    return Array.from(new Set([...getWellnestTreatmentOptionNames(), ...ALL_TREATMENTS]));
  }
  if (!isProviderRestrictedToPricingSheet(providerCode)) return [...ALL_TREATMENTS];
  return ALL_TREATMENTS.filter((t) =>
    (TREATMENT_CATEGORIES_IN_PRICE_LIST as readonly string[]).includes(t),
  );
}

/** Product/type options for a treatment and provider. When provider is TheTreatment250, Energy Device is restricted to types in the 2025 price list. */
export function getTreatmentProductOptionsForProvider(
  providerCode: string | undefined,
  treatment: string,
): string[] {
  if (isWellnestWellnessProviderCode(providerCode)) {
    const wellnest = getWellnestProductOptionsForTreatment(treatment);
    if (wellnest.length > 0) return wellnest;
  }
  const base = TREATMENT_PRODUCT_OPTIONS[treatment];
  if (!base) return [];
  if (!isProviderRestrictedToPricingSheet(providerCode)) return [...base];
  if (treatment === "Energy Device") {
    const inPriceList = new Set(getEnergyDeviceTypesFromPriceList());
    return base.filter((opt) => opt === OTHER_PRODUCT_LABEL || inPriceList.has(opt));
  }
  return [...base];
}

/** Longevity, downtime, and pricing for treatment examples (pricing from The Treatment 2025 price list). */
const _priceRange = (c: DashboardTreatmentCategory) => getPriceRange2025(c);

export const TREATMENT_META: Record<
  string,
  { longevity?: string; downtime?: string; priceRange?: string }
> = {
  Skincare: {
    longevity: "Ongoing",
    downtime: "None",
    priceRange: _priceRange("Skincare") ?? "Varies",
  },
  "Energy Device": {
    longevity: "6–12+ months",
    downtime: "3–7 days",
    priceRange: _priceRange("Energy Device") ?? "$250–$3,900",
  },
  "Chemical Peel": {
    longevity: "1–3 months",
    downtime: "3–7 days",
    priceRange: _priceRange("Chemical Peel") ?? "$85–$900",
  },
  Microneedling: {
    longevity: "2–4 months",
    downtime: "1–3 days",
    priceRange: _priceRange("Microneedling") ?? "$250–$775",
  },
  Filler: {
    longevity: "6–18 months",
    downtime: "1–2 days",
    priceRange: _priceRange("Filler") ?? "$750–$5,200",
  },
  Neurotoxin: {
    longevity: "3–4 months",
    downtime: "None",
    priceRange: _priceRange("Neurotoxin") ?? "$13/unit–$995",
  },
  Biostimulants: {
    longevity: "18–24+ months",
    downtime: "1–3 days",
    priceRange: _priceRange("Biostimulants") ?? "$800–$5,200",
  },
  Kybella: {
    longevity: "Permanent",
    downtime: "3–7 days",
    priceRange: "$1,200–$1,800",
  },
  Threadlift: {
    longevity: "12–18 months",
    downtime: "3–7 days",
    priceRange: "$1,500–$4,000",
  },
  PRP: {
    longevity: "Varies",
    downtime: "1–3 days",
    priceRange: "Varies",
  },
  PDGF: {
    longevity: "Varies",
    downtime: "1–3 days",
    priceRange: "Varies",
  },
};

/** Map each interest (by keyword match) to suggested treatments. */
export const INTEREST_TO_TREATMENTS: {
  keywords: string[];
  treatments: string[];
}[] = [
  {
    keywords: ["cheek", "contour", "definition"],
    treatments: ["Skincare", "Filler", "Biostimulants"],
  },
  {
    keywords: ["eyelid", "upper eyelid", "lower eyelid", "rejuvenate"],
    treatments: ["Skincare", "Energy Device"],
  },
  {
    keywords: ["brow", "brows"],
    treatments: ["Skincare", "Neurotoxin", "Filler"],
  },
  {
    keywords: ["forehead"],
    treatments: ["Skincare", "Neurotoxin", "Filler", "Energy Device", "Biostimulants"],
  },
  {
    keywords: ["jawline", "jaw"],
    treatments: ["Skincare", "Filler", "Biostimulants", "Kybella"],
  },
  { keywords: ["neck"], treatments: ["Skincare", "Kybella", "Biostimulants"] },
  {
    keywords: ["lip", "lips", "hydrate", "balance lips"],
    treatments: ["Skincare", "Filler"],
  },
  { keywords: ["nose", "balance nose"], treatments: ["Skincare", "Filler"] },
  {
    keywords: ["hydrate skin", "exfoliate", "skin tone", "even skin"],
    treatments: ["Skincare", "Chemical Peel", "Microneedling", "Energy Device"],
  },
  {
    keywords: ["laxity", "tighten", "sag"],
    treatments: ["Skincare", "Biostimulants"],
  },
  {
    keywords: ["shadow", "tear trough", "under eye"],
    treatments: ["Skincare", "Filler", "Biostimulants"],
  },
  {
    keywords: ["scar", "fade", "line", "fine line", "smoothen"],
    treatments: [
      "Skincare",
      "Energy Device",
      "Chemical Peel",
      "Microneedling",
      "PRP",
      "PDGF",
      "Filler",
      "Neurotoxin",
      "Biostimulants",
    ],
  },
];

export const REGION_OPTIONS = [
  "Forehead",
  "Glabella",
  "Crow's feet",
  "Lips",
  "Cheeks",
  "Nasolabial",
  "Marionette lines",
  "Prejowl sulcus",
  "Jawline",
  "Lower face",
  "Under eyes",
  "Multiple",
  "Other",
];

/** Where options for Microneedling on the treatment recommender (Face / Neck / Chest only). */
export const REGION_OPTIONS_MICRONEEDLING = ["Face", "Neck", "Chest"] as const;

/** Where options for Laser, Microneedling in checkout (broad areas, not specific face areas). */
export const CHECKOUT_REGION_OPTIONS_BROAD = ["Face", "Neck", "Chest"] as const;

/** Treatments that use broad Face/Neck/Chest region in checkout instead of REGION_OPTIONS. */
export const TREATMENTS_WITH_BROAD_REGION = ["Energy Device", "Microneedling"] as const;

/** Chemical Peel areas are separate from Type (e.g. Full Face, Full Back). */
export const CHEMICAL_PEEL_AREA_OPTIONS = [...getChemicalPeelAreasFromPriceList()] as const;

/** Treatments that have no Where selector. */
export const TREATMENTS_WITH_NO_REGION = [] as const;

/** Type options for Microneedling from the 2025 price list (Medical Spa: Microneedling, PRFM items). */
export const MICRONEEDLING_TYPE_OPTIONS = [
  ...getMicroneedlingTypesFromPriceList(),
  OTHER_PRODUCT_LABEL,
] as const;

/** Treatment type options for checkout right panel. Microneedling = same as recommender (PRP, TCA, PRFM, etc.); others match price list or recommender. */
export const CHECKOUT_TREATMENT_TYPE_OPTIONS: Record<string, string[]> = {
  "Energy Device": [...ENERGY_DEVICE_TYPES],
  Microneedling: [...MICRONEEDLING_TYPE_OPTIONS],
  Filler: [...getFillerTypesFromPriceList()],
  Neurotoxin: [...getNeurotoxinTypesFromPriceList()],
  Biostimulants: [...getBiostimulantsTypesFromPriceList()],
  "Chemical Peel": [...(TREATMENT_PRODUCT_OPTIONS["Chemical Peel"] ?? [])],
};

/** Checkout treatment type options filtered by provider (e.g. TheTreatment250 only sees options in the price list). */
export function getCheckoutTreatmentTypeOptionsForProvider(
  providerCode: string | undefined,
): Record<string, string[]> {
  const base = { ...CHECKOUT_TREATMENT_TYPE_OPTIONS };
  if (isWellnestWellnessProviderCode(providerCode)) {
    for (const name of getWellnestTreatmentOptionNames()) {
      base[name] = getWellnestProductOptionsForTreatment(name);
    }
    return base;
  }
  if (!isProviderRestrictedToPricingSheet(providerCode)) return base;
  base["Energy Device"] = getTreatmentProductOptionsForProvider(providerCode, "Energy Device");
  return base;
}

export const TIMELINE_OPTIONS = [
  "Now",
  "Add next visit",
  "Wishlist",
  "Completed",
];
/** Timeline value for skincare items; they are shown in a single "Skincare" section, not by visit timing. */
export const TIMELINE_SKINCARE = "Skincare";
/** Plan sections in display order (Now top, Completed bottom). Skincare is a separate category rendered first when present. */
export const PLAN_SECTIONS = [
  "Now",
  "Add next visit",
  "Wishlist",
  "Completed",
] as const;
/** Section label for the dedicated skincare products block (all skincare items in one list). */
export const SKINCARE_SECTION_LABEL = "Skincare";

/** Skincare "What" options for treatment explorer quick-add (product/type selector). */
export const SKINCARE_QUICK_ADD_WHAT_OPTIONS = [
  "Retinol",
  "Vitamin C",
  "SPF",
  "Exosomes",
  "Topical peptides",
  "Moisturizer",
  "Toner",
  "Cleanser",
  "Eye cream",
  "Firming cream",
  "Other",
] as const;

export const QUANTITY_QUICK_OPTIONS_DEFAULT = ["1", "2", "3", "4", "5"];
export const QUANTITY_OPTIONS_FILLER = ["1", "2", "3", "4", "5"];
/** Neurotoxin unit options: common dosing (10 single area, 35 typical multi-area, 50–80 full face). Includes default 35. */
export const QUANTITY_OPTIONS_TOX = ["10", "20", "35", "40", "50", "60", "80", "100"];
/** Biostimulants: Radiesse 1–6 syringes, Sculptra 1/3/4/5/6/8 vials. Quantity is separate from type. */
export const QUANTITY_OPTIONS_BIOSTIMULANTS = ["1", "2", "3", "4", "5", "6", "8"];
/** Radiesse: syringes (matches price list 1–6). */
export const QUANTITY_OPTIONS_RADIESSE = ["1", "2", "3", "4", "5", "6"];
/** Sculptra: vials (matches price list 1, 3, 4, 5, 6, 8). */
export const QUANTITY_OPTIONS_SCULPTRA = ["1", "3", "4", "5", "6", "8"];

export const QUANTITY_UNIT_OPTIONS = [
  "Syringes",
  "Vials",
  "Units",
  "Sessions",
  "Areas",
  "Quantity",
] as const;

export const RECURRING_OPTIONS = [
  "Every 6 weeks",
  "Every 3 months",
  "Every 6 months",
  "Yearly",
];
export const OTHER_RECURRING_LABEL = "Other";
