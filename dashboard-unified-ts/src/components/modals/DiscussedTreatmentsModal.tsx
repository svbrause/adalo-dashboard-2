// Discussed Treatments Modal – treatments/products discussed with patient in clinic, linked to treatment interests

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Client, DiscussedItem } from "../../types";
import { updateLeadRecord } from "../../services/api";
import { showToast, showError } from "../../utils/toast";
import { groupIssuesByArea } from "../../utils/issueMapping";
import "./DiscussedTreatmentsModal.css";

/** Hook: true when viewport is narrow (e.g. mobile). Use for native select fallbacks. */
function useIsNarrowScreen(maxWidthPx = 768): boolean {
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia(`(max-width: ${maxWidthPx}px)`).matches
      : false
  );
  useEffect(() => {
    const m = window.matchMedia(`(max-width: ${maxWidthPx}px)`);
    const onChange = () => setIsNarrow(m.matches);
    m.addEventListener("change", onChange);
    return () => m.removeEventListener("change", onChange);
  }, [maxWidthPx]);
  return isNarrow;
}

const AIRTABLE_FIELD = "Treatments Discussed";
const OTHER_LABEL = "Other";
/** Placeholder treatment when user adds only a goal (no specific treatments). */
const TREATMENT_GOAL_ONLY = "Goal only";

/** Add-entry mode: start by patient goal, assessment finding, or treatment */
export type AddByMode = "goal" | "finding" | "treatment";

/** Assessment findings (e.g. from facial analysis) – user can add by finding first */
const ASSESSMENT_FINDINGS = [
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
const OTHER_FINDING_LABEL = "Other finding";

/** Assessment findings grouped by area (for "by treatment" flow and organization) */
const ASSESSMENT_FINDINGS_BY_AREA: { area: string; findings: string[] }[] = [
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

/** Skincare: specific products (brand + product) for carousel */
const SKINCARE_PRODUCTS = [
  "Skinceuticals Retinol 0.3",
  "Skinceuticals Retinol 0.5",
  "Skinceuticals Retinol 1.0",
  "SkinMedica Retinol 0.25",
  "SkinMedica Retinol 0.5",
  "SkinMedica Retinol 1.0",
  "CeraVe Resurfacing Retinol Serum",
  "Paula's Choice 1% Retinol",
  "Skinceuticals C E Ferulic",
  "Skinceuticals Phloretin CF",
  "SkinMedica Vitamin C+ E Complex",
  "Drunk Elephant C-Firma",
  "Skinceuticals Hyaluronic Acid",
  "SkinMedica HA5 Rejuvenating Hydrator",
  "CeraVe Moisturizing Cream",
  "Skinceuticals Blemish + Age Defense",
  "Paula's Choice 2% BHA",
  "SkinMedica Lytic Treatment",
  "Skinceuticals Discoloration Defense",
  "SkinMedica Even Correct",
  "Skinceuticals Metacell Renewal B3",
  "SkinMedica TNS Advanced+",
  "Neostrata Glycolic Renewal",
  "Skinceuticals LHA Toner",
  "EltaMD UV Clear",
  "Skinceuticals Triple Lipid Restore",
  "Other",
];
/** Laser: specific devices for carousel */
const LASER_DEVICES = [
  "Moxi",
  "Halo",
  "BBL (BroadBand Light)",
  "Moxi + BBL",
  "PicoSure",
  "PicoWay",
  "Fraxel",
  "Clear + Brilliant",
  "IPL (Intense Pulsed Light)",
  "Sciton ProFractional",
  "Laser Genesis",
  "VBeam (Pulsed Dye)",
  "Excel V",
  "AcuPulse",
  "Other",
];
const OTHER_PRODUCT_LABEL = "Other";
const SEE_ALL_OPTIONS_LABEL = "See all options";

/** Recommended product subsets by goal/finding context (keyword match). Curated list for most cases; user can "See all" for the rest. */
const RECOMMENDED_PRODUCTS_BY_CONTEXT: {
  treatment: string;
  keywords: string[];
  products: string[];
}[] = [
  /* Skincare – hydration / dry */
  {
    treatment: "Skincare",
    keywords: ["hydrate", "dry", "moisturize", "barrier", "laxity"],
    products: [
      "Skinceuticals Hyaluronic Acid",
      "SkinMedica HA5 Rejuvenating Hydrator",
      "CeraVe Moisturizing Cream",
      "Skinceuticals Triple Lipid Restore",
    ],
  },
  /* Skincare – acne / red spots / oil */
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
      "Skinceuticals Blemish + Age Defense",
      "Paula's Choice 2% BHA",
      "SkinMedica Lytic Treatment",
    ],
  },
  /* Skincare – dark spots / pigmentation */
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
      "Skinceuticals C E Ferulic",
      "Skinceuticals Phloretin CF",
      "SkinMedica Vitamin C+ E Complex",
      "Skinceuticals Discoloration Defense",
      "SkinMedica Even Correct",
      "EltaMD UV Clear",
    ],
  },
  /* Skincare – fine lines / anti-aging */
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
      "Skinceuticals Retinol 0.3",
      "Skinceuticals Retinol 0.5",
      "SkinMedica Retinol 0.25",
      "SkinMedica Retinol 0.5",
      "Skinceuticals C E Ferulic",
      "SkinMedica TNS Advanced+",
      "Skinceuticals Metacell Renewal B3",
      "Neostrata Glycolic Renewal",
    ],
  },
  /* Skincare – sensitivity / barrier */
  {
    treatment: "Skincare",
    keywords: ["sensitive", "redness", "irritat", "licorice", "centella"],
    products: [
      "CeraVe Moisturizing Cream",
      "Skinceuticals Triple Lipid Restore",
      "EltaMD UV Clear",
    ],
  },
  /* Laser – pigment / dark spots */
  {
    treatment: "Laser",
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
  /* Laser – resurfacing / lines */
  {
    treatment: "Laser",
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
  /* Chemical peel – acne / oil */
  {
    treatment: "Chemical Peel",
    keywords: ["acne", "oil", "red spot", "exfoliate"],
    products: ["Salicylic", "Glycolic", "Jessner", "Mandelic"],
  },
  /* Chemical peel – pigmentation */
  {
    treatment: "Chemical Peel",
    keywords: ["dark spot", "pigment", "even skin", "tone"],
    products: ["Glycolic", "TCA", "Mandelic", "VI Peel", "Lactic acid"],
  },
  /* Chemical peel – anti-aging */
  {
    treatment: "Chemical Peel",
    keywords: ["fine line", "smoothen", "wrinkle", "exfoliate"],
    products: ["Glycolic", "TCA", "Lactic acid", "Jessner"],
  },
  /* Filler – lips */
  {
    treatment: "Filler",
    keywords: ["lip", "lips", "balance lips", "thin lips", "dry lips"],
    products: ["Hyaluronic acid (HA) – lip"],
  },
  /* Filler – cheeks / volume */
  {
    treatment: "Filler",
    keywords: ["cheek", "volume", "mid cheek", "cheekbone", "hollow"],
    products: [
      "Hyaluronic acid (HA) – cheek",
      "PLLA / Sculptra",
      "Calcium hydroxyapatite (e.g. Radiesse)",
    ],
  },
  /* Filler – nasolabial / marionette */
  {
    treatment: "Filler",
    keywords: ["nasolabial", "marionette", "shadow", "smile line"],
    products: [
      "Hyaluronic acid (HA) – nasolabial",
      "Hyaluronic acid (HA) – other",
    ],
  },
  /* Filler – tear trough / under eye */
  {
    treatment: "Filler",
    keywords: ["under eye", "tear trough", "hollow", "eyelid"],
    products: [
      "Hyaluronic acid (HA) – tear trough",
      "Hyaluronic acid (HA) – other",
    ],
  },
  /* Neurotoxin – lines */
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
  /* Microneedling – general */
  {
    treatment: "Microneedling",
    keywords: ["scar", "fine line", "texture", "pore", "laxity", "tighten"],
    products: [
      "Standard microneedling",
      "RF microneedling",
      "With growth factors / PRP",
      "Nanoneedling",
    ],
  },
];

function getRecommendedProducts(
  treatment: string,
  contextString: string
): string[] {
  if (!contextString.trim()) return [];
  const lower = contextString.toLowerCase();
  const allOptions = TREATMENT_PRODUCT_OPTIONS[treatment];
  if (!allOptions) return [];
  const baseList = allOptions.filter((p) => p !== OTHER_PRODUCT_LABEL);
  const recommended = new Set<string>();
  for (const row of RECOMMENDED_PRODUCTS_BY_CONTEXT) {
    if (row.treatment !== treatment) continue;
    if (row.keywords.some((k) => lower.includes(k))) {
      row.products
        .filter((p) => baseList.includes(p))
        .forEach((p) => recommended.add(p));
    }
  }
  return Array.from(recommended);
}

/** Treatment type / product options per treatment (for product selector when that treatment is selected) */
const TREATMENT_PRODUCT_OPTIONS: Record<string, string[]> = {
  Skincare: [...SKINCARE_PRODUCTS],
  Laser: [...LASER_DEVICES],
  Radiofrequency: [
    "Microneedling RF (e.g. Morpheus8, Secret RF)",
    "Monopolar (e.g. Thermage)",
    "Bipolar",
    "Tripolar (e.g. Tripollar)",
    "Fractional RF",
    "Sublative RF",
    "Multipolar",
    "RF microneedling",
    OTHER_PRODUCT_LABEL,
  ],
  Filler: [
    "Hyaluronic acid (HA) – lip",
    "Hyaluronic acid (HA) – cheek",
    "Hyaluronic acid (HA) – nasolabial",
    "Hyaluronic acid (HA) – tear trough",
    "Hyaluronic acid (HA) – other",
    "Calcium hydroxyapatite (e.g. Radiesse)",
    "PLLA / Sculptra",
    "Polycaprolactone (e.g. Ellansé)",
    OTHER_PRODUCT_LABEL,
  ],
  Neurotoxin: [
    "OnabotulinumtoxinA (Botox)",
    "AbobotulinumtoxinA (Dysport)",
    "IncobotulinumtoxinA (Xeomin)",
    "PrabotulinumtoxinA (Jeuveau)",
    "DaxibotulinumtoxinA (Daxxify)",
    "LetibotulinumtoxinA (Letybo)",
    "RimabotulinumtoxinB (Myobloc)",
    OTHER_PRODUCT_LABEL,
  ],
  "Chemical Peel": [
    "Glycolic",
    "Salicylic",
    "TCA",
    "Jessner",
    "Lactic acid",
    "Mandelic",
    "Phenol (deep)",
    "VI Peel",
    "Blue peel",
    "Enzyme peel",
    OTHER_PRODUCT_LABEL,
  ],
  Microneedling: [
    "Standard microneedling",
    "RF microneedling",
    "Nanoneedling",
    "Dermaroller",
    "Dermapen",
    "With growth factors / PRP",
    OTHER_PRODUCT_LABEL,
  ],
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

/** Post-care instructions + "patients often add" suggested products per treatment (Amazon-style). */
const TREATMENT_POSTCARE: Record<
  string,
  {
    sendInstructionsLabel: string;
    instructionsText: string;
    suggestedProducts: string[];
  }
> = {
  Laser: {
    sendInstructionsLabel: "Send laser post-care instructions",
    instructionsText: `• Avoid sun exposure for 24–48 hours; use SPF 50+ daily
• Keep treated area clean and moisturized
• No makeup for 24 hours if possible
• Avoid harsh actives (retinoids, acids) for 3–5 days
• No hot tubs, saunas, or intense exercise for 24–48 hours
• Apply healing balm or recommended post-care as directed`,
    suggestedProducts: [
      "Sunscreen SPF 50+",
      "Healing balm",
      "Gentle cleanser",
      "Post-care serum",
      "Hydrating moisturizer",
    ],
  },
  "Chemical Peel": {
    sendInstructionsLabel: "Send chemical peel post-care instructions",
    instructionsText: `• Use gentle cleanser and moisturizer only for 24–48 hours
• Apply SPF 50+ daily; avoid sun exposure
• No picking or peeling skin
• Avoid retinoids, AHAs/BHAs, and exfoliants for 5–7 days
• No waxing or harsh treatments on treated area
• Keep skin hydrated`,
    suggestedProducts: [
      "Gentle cleanser",
      "Hydrating moisturizer",
      "Sunscreen SPF 50+",
      "Healing ointment",
      "Vitamin C serum (after peel has healed)",
    ],
  },
  Microneedling: {
    sendInstructionsLabel: "Send microneedling post-care instructions",
    instructionsText: `• Avoid sun exposure; use SPF 50+ daily
• No makeup for 24 hours
• Keep skin clean and moisturized; avoid harsh actives for 3–5 days
• No saunas, hot yoga, or intense sweating for 24–48 hours
• Use gentle, hydrating products only`,
    suggestedProducts: [
      "Hyaluronic acid serum",
      "Healing balm",
      "Gentle cleanser",
      "Sunscreen SPF 50+",
      "Growth factor serum",
    ],
  },
  Filler: {
    sendInstructionsLabel: "Send filler aftercare instructions",
    instructionsText: `• Avoid touching or massaging treated area for 24 hours (unless directed)
• No strenuous exercise for 24–48 hours
• Avoid alcohol and blood thinners for 24 hours
• Ice if needed for swelling; sleep with head elevated first night
• Call if you notice severe pain, vision changes, or blanching`,
    suggestedProducts: [
      "Arnica (for bruising)",
      "Lip balm (for lip filler)",
      "Gentle cleanser",
      "Sunscreen SPF 50+",
    ],
  },
  Neurotoxin: {
    sendInstructionsLabel: "Send neurotoxin aftercare instructions",
    instructionsText: `• Stay upright for 4 hours; avoid lying down
• No rubbing or massaging treated area for 24 hours
• Avoid strenuous exercise for 24 hours
• Results typically visible in 3–7 days`,
    suggestedProducts: [
      "Gentle cleanser",
      "Sunscreen SPF 50+",
      "Facial moisturizer",
    ],
  },
  Skincare: {
    sendInstructionsLabel: "Send skincare routine instructions",
    instructionsText: `• Apply products in order: cleanse → treat → moisturize → SPF (AM)
• Use as directed; allow actives to absorb before next step
• Patch test new products if sensitive`,
    suggestedProducts: [],
  },
};

/** Findings that map to a given treatment (via getGoalRegionTreatmentsForFinding) */
function getFindingsForTreatment(treatment: string): string[] {
  const lower = (treatment || "").toLowerCase();
  const found: string[] = [];
  for (const areaRow of ASSESSMENT_FINDINGS_BY_AREA) {
    for (const f of areaRow.findings) {
      const mapped = getGoalRegionTreatmentsForFinding(f);
      if (mapped?.treatments.some((t) => t.toLowerCase() === lower))
        found.push(f);
    }
  }
  return found;
}

/** Findings for treatment grouped by area (only areas that have at least one finding for this treatment) */
function getFindingsByAreaForTreatment(
  treatment: string
): { area: string; findings: string[] }[] {
  const findingsForTx = new Set(getFindingsForTreatment(treatment));
  return ASSESSMENT_FINDINGS_BY_AREA.map(({ area, findings }) => ({
    area,
    findings: findings.filter((f) => findingsForTx.has(f)),
  })).filter((g) => g.findings.length > 0);
}

/** Map goal (interest) → suggested region(s) so region dropdown can be filtered/pre-filled */
const GOAL_TO_REGIONS: { keywords: string[]; regions: string[] }[] = [
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

/** Map assessment finding → suggested goal, region, and treatments (from catalog logic) */
const FINDING_TO_GOAL_REGION_TREATMENTS: {
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
    treatments: ["Filler"],
  },
  {
    keywords: ["under eye wrinkle"],
    goal: "Smoothen Fine Lines",
    region: "Under eyes",
    treatments: ["Neurotoxin", "Filler", "Microneedling", "Laser"],
  },
  {
    keywords: ["excess upper eyelid", "excess skin"],
    goal: "Rejuvenate Upper Eyelids",
    region: "Other",
    treatments: ["Laser", "Radiofrequency", "Chemical Peel"],
  },
  {
    keywords: ["forehead wrinkle", "bunny line", "crow's feet"],
    goal: "Smoothen Fine Lines",
    region: "Forehead",
    treatments: ["Neurotoxin", "Filler", "Laser"],
  },
  {
    keywords: ["mid cheek", "cheek flatten", "cheekbone"],
    goal: "Improve Cheek Definition",
    region: "Cheeks",
    treatments: ["Filler"],
  },
  {
    keywords: ["nasolabial", "marionette", "smile line"],
    goal: "Shadow Correction",
    region: "Nasolabial",
    treatments: ["Filler", "Laser", "Chemical Peel", "Microneedling"],
  },
  {
    keywords: ["prejowl", "retruded chin", "chin"],
    goal: "Balance Jawline",
    region: "Jawline",
    treatments: ["Filler"],
  },
  {
    keywords: ["jowl", "ill-defined jaw", "submental", "over-project"],
    goal: "Contour Jawline",
    region: "Jawline",
    treatments: ["Filler", "Kybella", "Radiofrequency"],
  },
  {
    keywords: ["temporal hollow"],
    goal: "Balance Forehead",
    region: "Forehead",
    treatments: ["Filler"],
  },
  {
    keywords: ["platysmal", "loose neck", "neck"],
    goal: "Contour Neck",
    region: "Jawline",
    treatments: ["Neurotoxin", "Kybella", "Radiofrequency"],
  },
  {
    keywords: ["dark spot", "red spot"],
    goal: "Even Skin Tone",
    region: "Other",
    treatments: ["Laser", "Chemical Peel", "Skincare"],
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
      "Laser",
      "Chemical Peel",
      "Microneedling",
      "Filler",
      "Neurotoxin",
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
    treatments: ["Radiofrequency", "Threadlift", "Laser"],
  },
];

function getGoalRegionTreatmentsForFinding(
  finding: string
): { goal: string; region: string; treatments: string[] } | null {
  if (!finding || finding === OTHER_FINDING_LABEL) return null;
  const lower = finding.toLowerCase();
  for (const row of FINDING_TO_GOAL_REGION_TREATMENTS) {
    if (row.keywords.some((k) => lower.includes(k)))
      return { goal: row.goal, region: row.region, treatments: row.treatments };
  }
  return null;
}

/** Map treatment → suggested goals and regions (for "add by treatment" flow) */
function getGoalsAndRegionsForTreatment(treatment: string): {
  goals: string[];
  regions: string[];
} {
  const lower = (treatment || "").toLowerCase();
  const goals = new Set<string>();
  const regions = new Set<string>();
  for (const { keywords, treatments } of INTEREST_TO_TREATMENTS) {
    if (treatments.some((t) => t.toLowerCase() === lower)) {
      for (const g of ALL_INTEREST_OPTIONS) {
        if (keywords.some((k) => g.toLowerCase().includes(k))) goals.add(g);
      }
    }
  }
  for (const { keywords, regions: regs } of GOAL_TO_REGIONS) {
    for (const g of goals) {
      if (keywords.some((k) => g.toLowerCase().includes(k)))
        regs.forEach((r) => regions.add(r));
    }
  }
  if (goals.size === 0)
    return { goals: [...ALL_INTEREST_OPTIONS], regions: [...REGION_OPTIONS] };
  if (regions.size === 0)
    return { goals: Array.from(goals), regions: [...REGION_OPTIONS] };
  return { goals: Array.from(goals), regions: Array.from(regions) };
}

/** All treatment interest options (full list – users can select any or Other) */
const ALL_INTEREST_OPTIONS = [
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

/** All treatment/procedure options (non-surgical only: Skincare, laser, injectable, etc.) */
const ALL_TREATMENTS = [
  "Skincare",
  "Laser",
  "Radiofrequency",
  "Chemical Peel",
  "Microneedling",
  "Filler",
  "Neurotoxin",
  "Kybella",
  "Threadlift",
];
const OTHER_TREATMENT_LABEL = "Other";

/** Map each interest (by keyword match) to suggested treatments (non-surgical only) */
const INTEREST_TO_TREATMENTS: { keywords: string[]; treatments: string[] }[] = [
  {
    keywords: ["cheek", "contour", "definition"],
    treatments: ["Skincare", "Filler"],
  },
  {
    keywords: ["eyelid", "upper eyelid", "lower eyelid", "rejuvenate"],
    treatments: ["Skincare", "Laser", "Radiofrequency"],
  },
  {
    keywords: ["brow", "brows"],
    treatments: ["Skincare", "Neurotoxin", "Filler"],
  },
  {
    keywords: ["forehead"],
    treatments: ["Skincare", "Neurotoxin", "Filler", "Laser"],
  },
  {
    keywords: ["jawline", "jaw"],
    treatments: ["Skincare", "Filler", "Kybella"],
  },
  {
    keywords: ["neck"],
    treatments: ["Skincare", "Kybella", "Radiofrequency"],
  },
  {
    keywords: ["lip", "lips", "hydrate", "balance lips"],
    treatments: ["Skincare", "Filler"],
  },
  { keywords: ["nose", "balance nose"], treatments: ["Skincare", "Filler"] },
  {
    keywords: ["hydrate skin", "exfoliate", "skin tone", "even skin"],
    treatments: ["Skincare", "Chemical Peel", "Microneedling", "Laser"],
  },
  {
    keywords: ["laxity", "tighten", "sag"],
    treatments: ["Skincare", "Radiofrequency", "Threadlift"],
  },
  {
    keywords: ["shadow", "tear trough", "under eye"],
    treatments: ["Skincare", "Filler"],
  },
  {
    keywords: ["scar", "fade", "line", "fine line", "smoothen"],
    treatments: [
      "Skincare",
      "Laser",
      "Chemical Peel",
      "Microneedling",
      "Filler",
      "Neurotoxin",
    ],
  },
];

function getTreatmentsForInterest(interest: string): string[] {
  if (!interest || interest === OTHER_LABEL) return [...ALL_TREATMENTS];
  const lower = interest.toLowerCase();
  const matched = new Set<string>();
  for (const { keywords, treatments } of INTEREST_TO_TREATMENTS) {
    if (keywords.some((k) => lower.includes(k))) {
      treatments.forEach((t) => matched.add(t));
    }
  }
  return matched.size > 0 ? Array.from(matched) : [...ALL_TREATMENTS];
}

const REGION_OPTIONS = [
  "Forehead",
  "Glabella",
  "Crow's feet",
  "Lips",
  "Cheeks",
  "Nasolabial",
  "Jawline",
  "Under eyes",
  "Multiple",
  "Other",
];
const TIMELINE_OPTIONS = ["Now", "Add next visit", "Save for later"];
/** Plan sections in display order (Now top, Save for later bottom). */
const PLAN_SECTIONS = ["Now", "Add next visit", "Save for later"] as const;
/** Quick quantity chips (e.g. syringes, units) – no typing for common cases */
/** Default quantity chips when treatment has no specific unit. */
const QUANTITY_QUICK_OPTIONS_DEFAULT = ["1", "2", "3", "4", "5"];
/** Filler: syringes, typically 1–5. */
const QUANTITY_OPTIONS_FILLER = ["1", "2", "3", "4", "5"];
/** Tox / neurotoxin: units, typically tens to low hundreds. */
const QUANTITY_OPTIONS_TOX = ["20", "40", "60", "80", "100"];

/** Unit options user can select (defaults per treatment; user can override). */
const QUANTITY_UNIT_OPTIONS = [
  "Syringes",
  "Units",
  "Sessions",
  "Areas",
  "Quantity",
] as const;

function getQuantityContext(treatment: string | undefined): {
  unitLabel: string;
  options: string[];
} {
  if (!treatment || !treatment.trim()) {
    return { unitLabel: "Quantity", options: QUANTITY_QUICK_OPTIONS_DEFAULT };
  }
  const t = treatment.trim().toLowerCase();
  if (
    t === "filler" ||
    t.includes("filler") ||
    t === "hyaluronic acid" ||
    t === "ha"
  ) {
    return { unitLabel: "Syringes", options: QUANTITY_OPTIONS_FILLER };
  }
  if (
    t === "neurotoxin" ||
    t === "tox" ||
    t === "botox" ||
    t.includes("neurotoxin") ||
    t.includes("tox") ||
    t === "dysport" ||
    t === "xeomin"
  ) {
    return { unitLabel: "Units", options: QUANTITY_OPTIONS_TOX };
  }
  if (
    t === "laser" ||
    t.includes("laser") ||
    t === "rf" ||
    t === "radiofrequency" ||
    t.includes("radiofrequency") ||
    t === "microneedling" ||
    t.includes("microneedling")
  ) {
    return { unitLabel: "Sessions", options: QUANTITY_QUICK_OPTIONS_DEFAULT };
  }
  return { unitLabel: "Quantity", options: QUANTITY_QUICK_OPTIONS_DEFAULT };
}

const RECURRING_OPTIONS = [
  "Every 6 weeks",
  "Every 3 months",
  "Every 6 months",
  "Yearly",
];
const OTHER_RECURRING_LABEL = "Other";

interface DiscussedTreatmentsModalProps {
  client: Client;
  onClose: () => void;
  /** Call after data changes; may return a Promise (e.g. silent refresh). Await before closing so panel shows fresh data. */
  onUpdate: () => void | Promise<void>;
}

function parseInterestedIssues(client: Client): string[] {
  const raw = client.interestedIssues;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((i) => i && String(i).trim());
  return String(raw)
    .split(",")
    .map((i) => i.trim())
    .filter(Boolean);
}

function generateId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `disc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function DiscussedTreatmentsModal({
  client,
  onClose,
  onUpdate,
}: DiscussedTreatmentsModalProps) {
  const [items, setItems] = useState<DiscussedItem[]>(
    client.discussedItems?.length ? [...client.discussedItems] : []
  );
  const interestOptions = useMemo(() => {
    const fromIssues = parseInterestedIssues(client);
    const rawGoals: string[] | string = client.goals as string[] | string;
    const fromGoals: string[] =
      Array.isArray(rawGoals) && rawGoals.length
        ? rawGoals.filter((g: string) => g && String(g).trim())
        : typeof rawGoals === "string" && rawGoals
        ? rawGoals
            .split(",")
            .map((g: string) => g.trim())
            .filter(Boolean)
        : [];
    const set = new Set<string>([...fromIssues, ...fromGoals]);
    return Array.from(set).sort();
  }, [client.interestedIssues, client.goals]);

  /** Full list: all interest options + Other. Patient's interests are still available via interestOptions for highlighting. */
  const topicOptions = useMemo(
    () => [...ALL_INTEREST_OPTIONS, OTHER_LABEL],
    []
  );

  const [addMode, setAddMode] = useState<AddByMode>("goal");
  /** By assessment finding: multi-select (one or more findings) */
  const [selectedFindings, setSelectedFindings] = useState<string[]>([]);
  const [selectedTreatmentFirst, setSelectedTreatmentFirst] = useState("");
  /** When adding by treatment: selected assessment findings (multi-select, sets goal + region) */
  const [selectedFindingByTreatment, setSelectedFindingByTreatment] = useState<
    string[]
  >([]);
  /** By assessment finding: which areas are expanded (collapsed by default) */
  const [expandedFindingAreas, setExpandedFindingAreas] = useState<Set<string>>(
    new Set()
  );
  const [showOtherFindingPicker, setShowOtherFindingPicker] = useState(false);
  const [
    showOtherFindingPickerByTreatment,
    setShowOtherFindingPickerByTreatment,
  ] = useState(false);
  const [otherFindingSearch, setOtherFindingSearch] = useState("");
  const [otherFindingSearchByTreatment, setOtherFindingSearchByTreatment] =
    useState("");
  const [interestSearch, setInterestSearch] = useState("");
  const [showFullInterestList, setShowFullInterestList] = useState(false);
  /** Which treatment's "See all options" picker is open (null = none). */
  const [openProductSearchFor, setOpenProductSearchFor] = useState<
    string | null
  >(null);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const isNarrowScreen = useIsNarrowScreen(768);

  const [form, setForm] = useState({
    interest: "",
    /** When adding by goal: per-treatment selected detected issues (all relevant shown below treatment, selected by default) */
    selectedFindingsByTreatment: {} as Record<string, string[]>,
    /** For Skincare/Laser: multi-select product names per treatment */
    selectedProductsByTreatment: {} as Record<string, string[]>,
    selectedTreatments: [] as string[],
    otherTreatment: "",
    skincareProduct: "",
    skincareProductOther: "",
    treatmentProducts: {} as Record<string, string>,
    treatmentProductOther: {} as Record<string, string>,
    showOptional: true, // Always show optional details
    brand: "",
    region: "",
    timeline: "",
    quantity: "",
    quantityUnit: "", // override unit (default from getQuantityContext); e.g. "Syringes", "Units"
    recurring: "",
    recurringOther: "",
    notes: "",
    brandOther: "",
    regionOther: "",
    timelineOther: "",
  });

  const filteredInterestOptions = useMemo(() => {
    if (!interestSearch.trim()) return topicOptions;
    const q = interestSearch.trim().toLowerCase();
    return topicOptions.filter((opt) => opt.toLowerCase().includes(q));
  }, [topicOptions, interestSearch]);

  /** Searchable full list for "Other finding" (by-finding mode) */
  const filteredOtherFindings = useMemo(() => {
    const q = otherFindingSearch.trim().toLowerCase();
    if (!q) return [...ASSESSMENT_FINDINGS];
    return ASSESSMENT_FINDINGS.filter((f) => f.toLowerCase().includes(q));
  }, [otherFindingSearch]);

  /** Searchable full list for "Other finding" (by-treatment mode) */
  const filteredOtherFindingsByTreatment = useMemo(() => {
    const q = otherFindingSearchByTreatment.trim().toLowerCase();
    if (!q) return [...ASSESSMENT_FINDINGS];
    return ASSESSMENT_FINDINGS.filter((f) => f.toLowerCase().includes(q));
  }, [otherFindingSearchByTreatment]);

  /** Chips: patient's interests + Other. Full list only shown when Other is expanded. */
  const interestChipOptions = useMemo(
    () =>
      interestOptions.length > 0
        ? [...interestOptions, OTHER_LABEL]
        : [OTHER_LABEL],
    [interestOptions]
  );

  /** Assessment findings from this patient's analysis, grouped by area (for "by assessment finding" mode). */
  const patientFindingsByArea = useMemo(() => {
    const grouped = groupIssuesByArea(client.allIssues ?? "");
    const areaOrder = [
      "Lips",
      "Eyes",
      "Forehead",
      "Cheeks",
      "Nasolabial",
      "Jawline",
      "Neck",
      "Skin",
      "Nose",
      "Body",
      "Other",
    ];
    return Object.entries(grouped)
      .map(([area, findings]) => ({
        area,
        findings: findings.filter((f) => f && String(f).trim()),
      }))
      .filter(({ findings }) => findings.length > 0)
      .sort((a, b) => {
        const ai = areaOrder.indexOf(a.area);
        const bi = areaOrder.indexOf(b.area);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return a.area.localeCompare(b.area);
      });
  }, [client.allIssues]);

  /** Helper: detected issues for this client that map to the given goal and treatment (for showing below each selected treatment). */
  const getDetectedIssuesForTreatment = useCallback(
    (treatment: string, interest: string): string[] => {
      if (!interest?.trim()) return [];
      const clientIssues = patientFindingsByArea.flatMap(
        ({ findings }) => findings
      );
      const lower = treatment.toLowerCase();
      return clientIssues.filter((issue) => {
        const m = getGoalRegionTreatmentsForFinding(issue);
        return (
          m?.goal === interest?.trim() &&
          m?.treatments.some((t) => t.toLowerCase() === lower)
        );
      });
    },
    [patientFindingsByArea]
  );

  /** By assessment finding: expand all area containers by default when entering finding mode. */
  useEffect(() => {
    if (addMode === "finding" && patientFindingsByArea.length > 0) {
      setExpandedFindingAreas((prev) => {
        const allAreas = new Set(patientFindingsByArea.map(({ area }) => area));
        if (prev.size === 0) return allAreas;
        return prev;
      });
    }
  }, [addMode, patientFindingsByArea]);

  /** Context string from goal/finding for intelligent product recommendations. */
  const productContextString = useMemo(() => {
    const parts = [
      form.interest,
      addMode === "finding" ? selectedFindings.join(" ") : "",
      addMode === "treatment" ? selectedFindingByTreatment.join(" ") : "",
    ].filter(Boolean);
    // In by-treatment mode, also add goal + region for each selected finding (including Other findings)
    // so suggested products show for Other findings the same as for AI-identified findings.
    if (addMode === "treatment" && selectedFindingByTreatment.length > 0) {
      const goalRegionParts: string[] = [];
      for (const f of selectedFindingByTreatment) {
        const mapped = getGoalRegionTreatmentsForFinding(f);
        if (mapped) {
          if (mapped.goal) goalRegionParts.push(mapped.goal);
          if (mapped.region) goalRegionParts.push(mapped.region);
        }
      }
      if (goalRegionParts.length > 0) parts.push(goalRegionParts.join(" "));
    }
    return parts.join(" ");
  }, [form.interest, addMode, selectedFindings, selectedFindingByTreatment]);

  const [savingAdd, setSavingAdd] = useState(false);
  /** When true (and no item selected/editing), right column shows add form; when false, shows "Select an item". Only used when items.length > 0. */
  const [showAddForm, setShowAddForm] = useState(false);
  /** Selected plan item for record review: clicking a row sets this, right column shows detail. */
  const [selectedPlanItemId, setSelectedPlanItemId] = useState<string | null>(
    null
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editShowOptionalDetails, setEditShowOptionalDetails] = useState(false);
  const [editForm, setEditForm] = useState<{
    interest: string;
    treatment: string;
    product: string;
    quantity: string;
    quantityUnit: string;
    brand: string;
    brandOther: string;
    region: string;
    regionOther: string;
    timeline: string;
    timelineOther: string;
    notes: string;
  }>({
    interest: "",
    treatment: "",
    product: "",
    quantity: "",
    quantityUnit: "",
    brand: "",
    brandOther: "",
    region: "",
    regionOther: "",
    timeline: "",
    timelineOther: "",
    notes: "",
  });
  const addFormSectionRef = useRef<HTMLDivElement>(null);

  const treatmentsForTopic = useMemo(() => {
    if (addMode === "finding" && selectedFindings.length > 0) {
      const treatments = new Set<string>();
      for (const finding of selectedFindings) {
        const mapped = getGoalRegionTreatmentsForFinding(finding);
        if (mapped) mapped.treatments.forEach((t) => treatments.add(t));
      }
      return treatments.size > 0
        ? Array.from(treatments)
        : getTreatmentsForInterest(form.interest);
    }
    return getTreatmentsForInterest(form.interest);
  }, [addMode, selectedFindings, form.interest]);

  /** Region options filtered by selected goal (or all when no goal) */
  /** When adding by treatment first: assessment findings grouped by area (replaces goal/region) */
  const findingsByAreaForTreatment = useMemo(
    () =>
      addMode === "treatment" &&
      selectedTreatmentFirst &&
      selectedTreatmentFirst !== OTHER_TREATMENT_LABEL
        ? getFindingsByAreaForTreatment(selectedTreatmentFirst)
        : [],
    [addMode, selectedTreatmentFirst]
  );

  /** Kept for compatibility (by-treatment UI uses findingsByAreaForTreatment); referenced so bundler/cache does not throw */
  const goalsAndRegionsForTreatment = useMemo(
    () =>
      addMode === "treatment" && selectedTreatmentFirst
        ? getGoalsAndRegionsForTreatment(selectedTreatmentFirst)
        : { goals: ALL_INTEREST_OPTIONS, regions: REGION_OPTIONS },
    [addMode, selectedTreatmentFirst]
  );
  void goalsAndRegionsForTreatment;

  /** Items grouped by plan section (Now, Add next visit, Save for later). Empty/missing timeline → Save for later. */
  const itemsBySection = useMemo(() => {
    const now: DiscussedItem[] = [];
    const addNext: DiscussedItem[] = [];
    const saveForLater: DiscussedItem[] = [];
    for (const item of items) {
      const t = item.timeline?.trim();
      if (t === "Now") now.push(item);
      else if (t === "Add next visit") addNext.push(item);
      else saveForLater.push(item); // "Save for later" or empty/other
    }
    const byTreatment = (a: DiscussedItem, b: DiscussedItem) =>
      (a.treatment || "").localeCompare(b.treatment || "");
    return {
      Now: now.sort(byTreatment),
      "Add next visit": addNext.sort(byTreatment),
      "Save for later": saveForLater.sort(byTreatment),
    };
  }, [items]);

  /** Preview for the "New item" row when add form is visible (left column stays connected). */
  const newItemPreview = useMemo(() => {
    const treatment =
      addMode === "treatment" && selectedTreatmentFirst
        ? selectedTreatmentFirst === OTHER_TREATMENT_LABEL
          ? form.otherTreatment.trim() || null
          : selectedTreatmentFirst
        : form.selectedTreatments.filter(
            (t) => t !== OTHER_TREATMENT_LABEL
          )[0] ??
          (form.otherTreatment.trim() || null) ??
          (form.interest?.trim() || null);
    const qVal = form.quantity?.trim();
    const qUnit = form.quantityUnit?.trim();
    const quantity =
      qVal && qUnit && qUnit !== "Quantity" ? `${qVal} ${qUnit}` : qVal || null;
    return {
      primary: treatment || "New item",
      interest: form.interest?.trim() || null,
      timeline: form.timeline?.trim() || null,
      quantity,
    };
  }, [
    addMode,
    selectedTreatmentFirst,
    form.otherTreatment,
    form.selectedTreatments,
    form.interest,
    form.timeline,
    form.quantity,
    form.quantityUnit,
  ]);

  const [completeItemId, setCompleteItemId] = useState<string | null>(null);
  /** Post-care instructions modal: show instructions text + copy. */
  const [postCareModal, setPostCareModal] = useState<{
    treatment: string;
    label: string;
    instructionsText: string;
  } | null>(null);
  /** Drag and drop state for moving items between sections. */
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverSection, setDragOverSection] = useState<
    (typeof PLAN_SECTIONS)[number] | null
  >(null);

  const handleComplete = (item: DiscussedItem, addNext: boolean) => {
    // Remove the completed item
    const nextItems = items.filter((i) => i.id !== item.id);

    if (addNext) {
      // Add a new item for next visit
      const newItem: DiscussedItem = {
        ...item,
        id: generateId(),
        timeline: "Add next visit",
        recurring: item.recurring, // Keep recurring if set? Or maybe clear it?
        // Maybe clear notes?
        notes: undefined,
      };
      nextItems.push(newItem);
    }

    setItems(nextItems);
    setCompleteItemId(null);
    setSavingAdd(true);
    persistItems(nextItems).finally(() => setSavingAdd(false));
  };

  const toggleFinding = (finding: string) => {
    const next = selectedFindings.includes(finding)
      ? selectedFindings.filter((f) => f !== finding)
      : [...selectedFindings, finding];
    setSelectedFindings(next);
    const goals: string[] = [];
    const regions = new Set<string>();
    for (const f of next) {
      const mapped = getGoalRegionTreatmentsForFinding(f);
      if (mapped) {
        goals.push(mapped.goal);
        regions.add(mapped.region);
      }
    }
    setForm((f) => ({
      ...f,
      interest: goals.length > 0 ? goals.join(", ") : "",
      region:
        regions.size === 1
          ? Array.from(regions)[0]!
          : regions.size > 1
          ? "Multiple"
          : "",
      regionOther: "",
      selectedTreatments: [],
      otherTreatment: "",
    }));
  };

  const toggleFindingArea = (area: string) => {
    setExpandedFindingAreas((prev) => {
      const next = new Set(prev);
      if (next.has(area)) next.delete(area);
      else next.add(area);
      return next;
    });
  };

  const handleSelectTreatmentFirst = (treatment: string) => {
    setSelectedTreatmentFirst(treatment);
    setSelectedFindingByTreatment([]);
    setForm((f) => ({
      ...f,
      selectedTreatments: [],
      otherTreatment: "",
    }));
  };

  const handleSelectFindingByTreatment = (finding: string) => {
    const next = selectedFindingByTreatment.includes(finding)
      ? selectedFindingByTreatment.filter((f) => f !== finding)
      : [...selectedFindingByTreatment, finding];
    setSelectedFindingByTreatment(next);
    const goals: string[] = [];
    const regions = new Set<string>();
    for (const f of next) {
      const mapped = getGoalRegionTreatmentsForFinding(f);
      if (mapped) {
        goals.push(mapped.goal);
        regions.add(mapped.region);
      }
    }
    setForm((f) => ({
      ...f,
      interest: goals.join(", ") || "",
      region:
        regions.size === 1
          ? Array.from(regions)[0]!
          : regions.size > 1
          ? "Multiple"
          : "",
      regionOther: "",
    }));
  };

  const handleAddModeChange = (mode: AddByMode) => {
    // If clicking the same mode, reset selections within that mode
    if (addMode === mode) {
      setSelectedFindings([]);
      setSelectedTreatmentFirst("");
      setSelectedFindingByTreatment([]);
      setExpandedFindingAreas(new Set());
      setShowOtherFindingPicker(false);
      setShowOtherFindingPickerByTreatment(false);
      setOtherFindingSearch("");
      setOtherFindingSearchByTreatment("");
      setOpenProductSearchFor(null);
      setProductSearchQuery("");
      setForm((f) => ({
        ...f,
        interest: "",
        selectedFindingsByTreatment: {},
        selectedProductsByTreatment: {},
        selectedTreatments: [],
        otherTreatment: "",
        skincareProduct: "",
        skincareProductOther: "",
        treatmentProducts: {},
        treatmentProductOther: {},
        region: "",
        regionOther: "",
      }));
      setShowFullInterestList(false);
      setInterestSearch("");
      return;
    }

    // Otherwise switch to new mode and reset
    setAddMode(mode);
    setSelectedFindings([]);
    setSelectedTreatmentFirst("");
    setSelectedFindingByTreatment([]);
    setExpandedFindingAreas(new Set());
    setShowOtherFindingPicker(false);
    setShowOtherFindingPickerByTreatment(false);
    setOtherFindingSearch("");
    setOtherFindingSearchByTreatment("");
    setOpenProductSearchFor(null);
    setProductSearchQuery("");
    setForm((f) => ({
      ...f,
      interest: "",
      selectedFindingsByTreatment: {},
      selectedProductsByTreatment: {},
      selectedTreatments: [],
      otherTreatment: "",
      skincareProduct: "",
      skincareProductOther: "",
      treatmentProducts: {},
      treatmentProductOther: {},
      region: "",
      regionOther: "",
    }));
    setShowFullInterestList(false);
    setInterestSearch("");
  };

  const toggleTreatment = (name: string) => {
    setForm((f) => {
      const isAdding = !f.selectedTreatments.includes(name);
      const nextTreatments = isAdding
        ? [...f.selectedTreatments, name]
        : f.selectedTreatments.filter((t) => t !== name);
      const nextFindingsByTreatment = { ...f.selectedFindingsByTreatment };
      const nextProductsByTreatment = { ...f.selectedProductsByTreatment };
      if (isAdding) {
        const issues = getDetectedIssuesForTreatment(name, f.interest);
        nextFindingsByTreatment[name] = issues;
        if (name === "Skincare") nextProductsByTreatment[name] = [];
      } else {
        delete nextFindingsByTreatment[name];
        delete nextProductsByTreatment[name];
      }
      return {
        ...f,
        selectedTreatments: nextTreatments,
        selectedFindingsByTreatment: nextFindingsByTreatment,
        selectedProductsByTreatment: nextProductsByTreatment,
      };
    });
  };

  /** By patient interest: select exactly one treatment (radio). */
  const selectTreatmentGoal = (name: string) => {
    setForm((f) => {
      const alreadySelected = f.selectedTreatments[0] === name;
      const nextTreatments = alreadySelected ? [] : [name];
      const nextFindingsByTreatment = { ...f.selectedFindingsByTreatment };
      const nextProductsByTreatment = { ...f.selectedProductsByTreatment };
      if (alreadySelected) {
        delete nextFindingsByTreatment[name];
        delete nextProductsByTreatment[name];
      } else {
        const issues = getDetectedIssuesForTreatment(name, f.interest ?? "");
        nextFindingsByTreatment[name] = issues;
        if (name === "Skincare") nextProductsByTreatment[name] = [];
        // Clear other treatments' data when switching
        f.selectedTreatments.forEach((t) => {
          if (t !== name) {
            delete nextFindingsByTreatment[t];
            delete nextProductsByTreatment[t];
          }
        });
      }
      return {
        ...f,
        selectedTreatments: nextTreatments,
        selectedFindingsByTreatment: nextFindingsByTreatment,
        selectedProductsByTreatment: nextProductsByTreatment,
      };
    });
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editingId) setEditingId(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose, editingId]);

  const persistItems = async (nextItems: DiscussedItem[]) => {
    const payload = nextItems.length > 0 ? JSON.stringify(nextItems) : "";
    await updateLeadRecord(client.id, client.tableSource, {
      [AIRTABLE_FIELD]: payload,
    });
  };

  const handleAdd = async () => {
    const treatments: string[] =
      addMode === "treatment" && selectedTreatmentFirst
        ? selectedTreatmentFirst === OTHER_TREATMENT_LABEL
          ? form.otherTreatment.trim()
            ? [form.otherTreatment.trim()]
            : []
          : [selectedTreatmentFirst]
        : [
            ...form.selectedTreatments.filter(
              (t) => t !== OTHER_TREATMENT_LABEL
            ),
            ...(form.otherTreatment.trim() ? [form.otherTreatment.trim()] : []),
          ];
    const hasGoalOrFindingOnly =
      (addMode === "goal" && !!form.interest?.trim()) ||
      (addMode === "finding" && selectedFindings.length > 0);
    const effectiveTreatments =
      treatments.length > 0
        ? treatments
        : hasGoalOrFindingOnly
        ? [TREATMENT_GOAL_ONLY]
        : [];
    if (effectiveTreatments.length === 0) return;
    const interest =
      form.interest && form.interest !== OTHER_LABEL
        ? form.interest.trim()
        : undefined;
    const brand =
      form.brand === "Other"
        ? form.brandOther.trim() || undefined
        : form.brand?.trim() || undefined;
    const region =
      form.region === "Other"
        ? form.regionOther.trim() || undefined
        : form.region?.trim() || undefined;
    const timeline = form.timeline?.trim() || "Save for later";
    const productFor = (t: string): string | undefined => {
      const opts = TREATMENT_PRODUCT_OPTIONS[t];
      if (!opts) return undefined;
      const sel =
        form.treatmentProducts[t] ??
        (t === "Skincare" ? form.skincareProduct : undefined);
      if (!sel?.trim()) return undefined;
      return sel === OTHER_PRODUCT_LABEL
        ? (
            form.treatmentProductOther[t] ??
            (t === "Skincare" ? form.skincareProductOther : "")
          ).trim() || undefined
        : sel.trim();
    };
    /** For Skincare only: multi-select product names. Everything else: single product from productFor. */
    const productsForTreatment = (treatment: string): string[] => {
      if (treatment === "Skincare") {
        const selected = form.selectedProductsByTreatment[treatment] ?? [];
        return selected
          .map((p) =>
            p === OTHER_PRODUCT_LABEL
              ? (
                  form.treatmentProductOther[treatment] ??
                  form.skincareProductOther ??
                  ""
                ).trim()
              : p.trim()
          )
          .filter(Boolean);
      }
      const single = productFor(treatment);
      return single ? [single] : [];
    };
    const quantityVal = form.quantity?.trim();
    const quantityUnitVal = form.quantityUnit?.trim();
    const quantityForItem =
      quantityVal && quantityUnitVal && quantityUnitVal !== "Quantity"
        ? `${quantityVal} ${quantityUnitVal}`
        : quantityVal || undefined;
    const optional = {
      brand,
      region,
      timeline,
      quantity: quantityForItem,
      recurring:
        form.recurring === OTHER_RECURRING_LABEL
          ? (form.recurringOther || "").trim() || undefined
          : form.recurring || undefined,
      notes: form.notes.trim() || undefined,
    };
    const newItems: DiscussedItem[] = [];
    for (const treatment of effectiveTreatments) {
      const products = productsForTreatment(treatment);
      const findingsForTreatment =
        addMode === "goal"
          ? form.selectedFindingsByTreatment[treatment] ??
            getDetectedIssuesForTreatment(treatment, form.interest ?? "")
          : addMode === "treatment"
          ? selectedFindingByTreatment
          : undefined;
      if (products.length === 0) {
        newItems.push({
          id: generateId(),
          interest: interest || undefined,
          ...(findingsForTreatment?.length
            ? { findings: findingsForTreatment }
            : {}),
          treatment,
          ...optional,
        });
      } else {
        for (const product of products) {
          newItems.push({
            id: generateId(),
            interest: interest || undefined,
            ...(findingsForTreatment?.length
              ? { findings: findingsForTreatment }
              : {}),
            treatment,
            product,
            ...optional,
          });
        }
      }
    }
    const nextItems = [...items, ...newItems];
    setItems(nextItems);
    setSavingAdd(true);
    try {
      await persistItems(nextItems);
      showToast("Added to plan");
      onUpdate(); // fire-and-forget refresh so panel can show updated count
      // Reset add-form state so "add another item" starts fresh
      setForm({
        interest: "",
        selectedFindingsByTreatment: {},
        selectedProductsByTreatment: {},
        selectedTreatments: [],
        otherTreatment: "",
        skincareProduct: "",
        skincareProductOther: "",
        treatmentProducts: {},
        treatmentProductOther: {},
        showOptional: true,
        brand: "",
        region: "",
        timeline: "",
        quantity: "",
        quantityUnit: "",
        recurring: "",
        recurringOther: "",
        notes: "",
        brandOther: "",
        regionOther: "",
        timelineOther: "",
      });
      setAddMode("goal");
      setSelectedFindings([]);
      setSelectedTreatmentFirst("");
      setSelectedFindingByTreatment([]);
      setExpandedFindingAreas(new Set());
      setShowOtherFindingPicker(false);
      setShowOtherFindingPickerByTreatment(false);
      setOtherFindingSearch("");
      setOtherFindingSearchByTreatment("");
      setInterestSearch("");
      setShowFullInterestList(false);
      setOpenProductSearchFor(null);
      setProductSearchQuery("");
    } catch (e: any) {
      showError(e.message || "Failed to save");
      setItems(items); // revert on error
    } finally {
      setSavingAdd(false);
    }
  };

  /** Discard work-in-progress add form: reset form state and close add form (when items exist). */
  const handleDiscardAddForm = () => {
    setForm({
      interest: "",
      selectedFindingsByTreatment: {},
      selectedProductsByTreatment: {},
      selectedTreatments: [],
      otherTreatment: "",
      skincareProduct: "",
      skincareProductOther: "",
      treatmentProducts: {},
      treatmentProductOther: {},
      showOptional: true,
      brand: "",
      region: "",
      timeline: "",
      quantity: "",
      quantityUnit: "",
      recurring: "",
      recurringOther: "",
      notes: "",
      brandOther: "",
      regionOther: "",
      timelineOther: "",
    });
    setAddMode("goal");
    setSelectedFindings([]);
    setSelectedTreatmentFirst("");
    setSelectedFindingByTreatment([]);
    setExpandedFindingAreas(new Set());
    setShowOtherFindingPicker(false);
    setShowOtherFindingPickerByTreatment(false);
    setOtherFindingSearch("");
    setOtherFindingSearchByTreatment("");
    setInterestSearch("");
    setShowFullInterestList(false);
    setOpenProductSearchFor(null);
    setProductSearchQuery("");
    setShowAddForm(false);
  };

  const hasAnyTreatmentSelected =
    (addMode === "treatment" &&
      selectedTreatmentFirst &&
      (selectedTreatmentFirst !== OTHER_TREATMENT_LABEL ||
        form.otherTreatment.trim().length > 0)) ||
    form.selectedTreatments.some((t) => t !== OTHER_TREATMENT_LABEL) ||
    form.otherTreatment.trim().length > 0;

  /** In goal/finding mode, user can add with only a goal (treatments optional). */
  const canAddWithGoalOnly =
    (addMode === "goal" && !!form.interest?.trim()) ||
    (addMode === "finding" && selectedFindings.length > 0);

  const handleRemove = async (id: string) => {
    if (editingId === id) setEditingId(null);
    if (selectedPlanItemId === id) setSelectedPlanItemId(null);
    const nextItems = items.filter((x) => x.id !== id);
    setItems(nextItems);
    try {
      await persistItems(nextItems);
      onUpdate();
    } catch (e: any) {
      showError(e.message || "Failed to update");
      setItems(items);
    }
  };

  const handleEditStart = (item: DiscussedItem) => {
    setEditingId(item.id);
    const timeline = item.timeline?.trim() || "";
    const hasOptional = !!(
      timeline ||
      (item.notes?.trim() ?? "") ||
      (item.quantity?.trim() ?? "")
    );
    setEditShowOptionalDetails(hasOptional);
    const qRaw = item.quantity?.trim() || "";
    const qtyCtx = getQuantityContext(item.treatment?.trim());
    const parsed =
      /^(\d+)\s+(.+)$/.exec(qRaw) ||
      (qRaw && !/^\d+$/.test(qRaw) ? null : null);
    const quantity = parsed ? parsed[1]! : qRaw;
    const rawUnit = parsed ? parsed[2]!.trim() : "";
    const matchedUnit = rawUnit
      ? QUANTITY_UNIT_OPTIONS.find(
          (u) => u.toLowerCase() === rawUnit.toLowerCase()
        )
      : undefined;
    const quantityUnit = matchedUnit ?? (qRaw ? qtyCtx.unitLabel : "");
    setEditForm({
      interest: item.interest?.trim() || "",
      treatment: item.treatment?.trim() || "",
      product: item.product?.trim() || "",
      quantity,
      quantityUnit,
      brand: "",
      brandOther: "",
      region: "",
      regionOther: "",
      timeline: TIMELINE_OPTIONS.includes(timeline) ? timeline : "",
      timelineOther: "",
      notes: item.notes?.trim() || "",
    });
  };

  const handleEditCancel = () => {
    setEditingId(null);
  };

  /** Move an item to another plan section (Now / Add next visit / Save for later). */
  const handleMoveToSection = async (
    itemId: string,
    newTimeline: (typeof PLAN_SECTIONS)[number]
  ) => {
    const nextItems = items.map((i) =>
      i.id === itemId ? { ...i, timeline: newTimeline } : i
    );
    setItems(nextItems);
    try {
      await persistItems(nextItems);
      showToast(`Moved to ${newTimeline}`);
      onUpdate();
    } catch (e: unknown) {
      setItems(items);
      showError(e instanceof Error ? e.message : "Failed to move");
    }
  };

  /** Drag handlers for reordering items between sections. */
  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    itemId: string
  ) => {
    setDraggedItemId(itemId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", itemId);
  };

  const handleDragEnd = () => {
    setDraggedItemId(null);
    setDragOverSection(null);
  };

  const handleDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    section: (typeof PLAN_SECTIONS)[number]
  ) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverSection(section);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    // Only clear if leaving the section container itself
    if (e.currentTarget === e.target) {
      setDragOverSection(null);
    }
  };

  const handleDrop = async (
    e: React.DragEvent<HTMLDivElement>,
    targetSection: (typeof PLAN_SECTIONS)[number]
  ) => {
    e.preventDefault();
    setDragOverSection(null);

    if (!draggedItemId) return;

    const item = items.find((i) => i.id === draggedItemId);
    if (!item) return;

    const currentSection = item.timeline || "Save for later";
    if (currentSection === targetSection) {
      setDraggedItemId(null);
      return;
    }

    await handleMoveToSection(draggedItemId, targetSection);
    setDraggedItemId(null);
  };

  /** Add a suggested post-care product to the plan (one-click, like "customers also bought"). */
  const handleAddSuggestedProduct = async (
    treatment: string,
    productName: string
  ) => {
    const newItem: DiscussedItem = {
      id: generateId(),
      treatment,
      product: productName,
      timeline: "Save for later",
      notes: "Post-care / recommended",
    };
    const nextItems = [...items, newItem];
    setItems(nextItems);
    try {
      await persistItems(nextItems);
      showToast(`Added ${productName} to plan`);
      onUpdate();
    } catch (e: unknown) {
      setItems(items);
      showError(e instanceof Error ? e.message : "Failed to add");
    }
  };

  /** Copy post-care instructions to clipboard and close modal. */
  const handleCopyPostCareInstructions = () => {
    if (!postCareModal) return;
    const text = postCareModal.instructionsText;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => {
          showToast("Copied to clipboard");
          setPostCareModal(null);
        },
        () => showError("Copy failed")
      );
    } else {
      showError("Clipboard not available");
    }
  };

  const handleEditSave = async () => {
    if (!editingId) return;
    const interest =
      editForm.interest && editForm.interest !== OTHER_LABEL
        ? editForm.interest.trim()
        : undefined;
    const productVal = editForm.product?.trim();
    const timelineVal = editForm.timeline?.trim() || undefined;
    const quantityVal = editForm.quantity?.trim();
    const quantityUnitVal = editForm.quantityUnit?.trim();
    const quantityForItem =
      quantityVal && quantityUnitVal && quantityUnitVal !== "Quantity"
        ? `${quantityVal} ${quantityUnitVal}`
        : quantityVal || undefined;
    const updated: DiscussedItem = {
      id: editingId,
      interest: interest || undefined,
      treatment: editForm.treatment.trim(),
      ...(productVal ? { product: productVal } : {}),
      brand: undefined,
      region: undefined,
      timeline: timelineVal || undefined,
      quantity: quantityForItem || undefined,
      notes: editForm.notes.trim() || undefined,
    };
    const nextItems = items.map((x) => (x.id === editingId ? updated : x));
    setItems(nextItems);
    setEditingId(null);
    try {
      await persistItems(nextItems);
      showToast("Item updated");
      onUpdate();
    } catch (e: any) {
      showError(e.message || "Failed to update");
    }
  };

  /** Close immediately (X or overlay). Refresh in background so panel updates. */
  const handleCloseImmediate = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onUpdate(); // fire-and-forget refresh
    onClose();
  };

  return (
    <div className="modal-overlay active" onClick={handleCloseImmediate}>
      <div
        className={`modal-content discussed-treatments-modal-content${
          items.length > 0 ? " discussed-treatments-modal-content-has-plan" : ""
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header discussed-treatments-modal-header">
          <div className="modal-header-info">
            <h2 className="modal-title">
              Treatment plan for {client.name?.split(" ")[0] || "patient"}
            </h2>
            <p className="modal-subtitle">
              Adding to the plan saves to their record. Pick a topic, check what
              you discussed, add to plan — then share when ready.
            </p>
          </div>
          <div className="discussed-treatments-modal-header-actions">
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => {
                /* TODO: wire to share/send flow */
                showToast("Share with patient coming soon");
              }}
            >
              Share with patient
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm discussed-treatments-close-btn"
              onClick={handleCloseImmediate}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="modal-body discussed-treatments-modal-body">
          <div
            className={
              items.length > 0
                ? "discussed-treatments-two-column"
                : "discussed-treatments-single-column"
            }
          >
            {items.length > 0 && (
              <aside
                className="discussed-treatments-column discussed-treatments-column-plan discussed-treatments-column-master"
                aria-label="Treatment plan list"
              >
                <div className="discussed-treatments-list-section discussed-treatments-master-list">
                  <div className="discussed-treatments-master-list-header">
                    <h3 className="discussed-treatments-list-title">
                      {client.name?.trim().split(/\s+/)[0] || "Patient"}&apos;s
                      plan ({items.length}{" "}
                      {items.length === 1 ? "item" : "items"})
                    </h3>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => {
                        setSelectedPlanItemId(null);
                        setEditingId(null);
                        setShowAddForm(true);
                      }}
                    >
                      + Add new
                    </button>
                  </div>
                  <p className="discussed-treatments-list-hint">
                    Click a row to view details. Drag items to reorder between
                    sections.
                  </p>
                  {/* New-item row when add form is shown */}
                  {!selectedPlanItemId && !editingId && showAddForm && (
                    <div
                      className="discussed-treatments-record-row discussed-treatments-record-row-new selected"
                      role="listitem"
                      aria-label={`New item${
                        newItemPreview.primary !== "New item"
                          ? `: ${newItemPreview.primary}`
                          : ""
                      }`}
                    >
                      <div className="discussed-treatments-record-primary">
                        {newItemPreview.primary}
                      </div>
                      {(newItemPreview.interest ||
                        newItemPreview.timeline ||
                        newItemPreview.quantity) && (
                        <div className="discussed-treatments-record-meta">
                          {newItemPreview.quantity && (
                            <span className="discussed-treatments-record-quantity">
                              Qty: {newItemPreview.quantity}
                            </span>
                          )}
                          {newItemPreview.interest && (
                            <span className="discussed-treatments-record-for">
                              {newItemPreview.interest}
                            </span>
                          )}
                          {newItemPreview.timeline && (
                            <span className="discussed-treatments-record-timeline">
                              {newItemPreview.timeline}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Plan organized by timeline: Now → Add next visit → Save for later */}
                  <div className="discussed-treatments-plan-sections">
                    {PLAN_SECTIONS.map((sectionLabel) => {
                      const sectionItems = itemsBySection[sectionLabel];
                      return (
                        <div
                          key={sectionLabel}
                          className={`discussed-treatments-plan-section ${
                            dragOverSection === sectionLabel ? "drag-over" : ""
                          }`}
                          aria-label={`${sectionLabel} (${sectionItems.length} items)`}
                          onDragOver={(e) => handleDragOver(e, sectionLabel)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, sectionLabel)}
                        >
                          <h4 className="discussed-treatments-plan-section-title">
                            {sectionLabel}
                          </h4>
                          <div
                            className="discussed-treatments-master-records-list"
                            role="list"
                            aria-label={`${sectionLabel} items`}
                          >
                            {sectionItems.map((item) => {
                              return (
                                <div
                                  key={item.id}
                                  draggable
                                  onDragStart={(e) =>
                                    handleDragStart(e, item.id)
                                  }
                                  onDragEnd={handleDragEnd}
                                  className={`discussed-treatments-record-row ${
                                    selectedPlanItemId === item.id ||
                                    editingId === item.id
                                      ? "selected"
                                      : ""
                                  } ${
                                    draggedItemId === item.id ? "dragging" : ""
                                  }`}
                                  onClick={() => setSelectedPlanItemId(item.id)}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      setSelectedPlanItemId(item.id);
                                    }
                                  }}
                                  aria-label={`Select ${item.treatment}${
                                    item.interest ? ` for ${item.interest}` : ""
                                  }`}
                                  aria-selected={
                                    selectedPlanItemId === item.id ||
                                    editingId === item.id
                                  }
                                >
                                  <div
                                    className="discussed-treatments-drag-handle"
                                    aria-label="Drag to move"
                                  >
                                    ⋮⋮
                                  </div>
                                  <div className="discussed-treatments-record-row-main">
                                    <div className="discussed-treatments-record-primary">
                                      {item.treatment || "—"}
                                    </div>
                                    {(item.quantity || item.interest) && (
                                      <div className="discussed-treatments-record-meta">
                                        {item.quantity && (
                                          <span className="discussed-treatments-record-quantity">
                                            Qty: {item.quantity}
                                          </span>
                                        )}
                                        {item.interest && (
                                          <span className="discussed-treatments-record-for">
                                            {item.interest}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </aside>
            )}
            <div
              className="discussed-treatments-column discussed-treatments-column-form discussed-treatments-column-detail"
              aria-label={items.length > 0 ? "Item detail" : undefined}
            >
              {editingId ? (
                <div className="discussed-treatments-form-section discussed-treatments-edit-panel">
                  <div className="discussed-treatments-edit-panel-header">
                    <h3 className="discussed-treatments-form-title">
                      Edit item
                    </h3>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => {
                        setEditingId(null);
                        setCompleteItemId(null);
                      }}
                    >
                      + Add new
                    </button>
                  </div>
                  <p className="discussed-treatments-form-hint">
                    Update the fields below, then save.
                  </p>

                  <div className="discussed-treatments-add-form-body goal-flow-active">
                    <div className="discussed-treatments-add-form-single-box">
                      {/* Addressing (goal) – same chip row as add form */}
                      <div className="discussed-treatments-goal-flow-box">
                        <h3 className="discussed-treatments-form-title discussed-treatments-form-title-step2">
                          Patient&apos;s Treatment Interests
                        </h3>
                        <p className="discussed-treatments-form-hint">
                          Goal or topic for this item
                        </p>
                        <div
                          className="discussed-treatments-chip-row"
                          role="group"
                          aria-label="Addressing (goal)"
                        >
                          {interestChipOptions.map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              className={`discussed-treatments-topic-chip ${
                                editForm.interest === opt ? "selected" : ""
                              } ${opt === OTHER_LABEL ? "other-chip" : ""}`}
                              onClick={() =>
                                setEditForm((f) => ({
                                  ...f,
                                  interest: f.interest === opt ? "" : opt,
                                }))
                              }
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Treatment – same chip grid as add form (By Treatment) */}
                      <div className="discussed-treatments-treatment-sub-box">
                        <h3 className="discussed-treatments-form-title discussed-treatments-form-title-step2">
                          Treatment
                        </h3>
                        <div
                          className="discussed-treatments-checkbox-grid"
                          role="group"
                          aria-label="Treatments"
                        >
                          {ALL_TREATMENTS.map((name) => (
                            <button
                              key={name}
                              type="button"
                              className={`discussed-treatments-topic-chip ${
                                editForm.treatment === name ? "selected" : ""
                              }`}
                              onClick={() =>
                                setEditForm((f) => ({
                                  ...f,
                                  treatment: name,
                                  product: "",
                                }))
                              }
                            >
                              {name}
                            </button>
                          ))}
                          <button
                            type="button"
                            className={`discussed-treatments-topic-chip other-chip ${
                              editForm.treatment &&
                              (editForm.treatment === OTHER_TREATMENT_LABEL ||
                                !ALL_TREATMENTS.includes(editForm.treatment))
                                ? "selected"
                                : ""
                            }`}
                            onClick={() =>
                              setEditForm((f) => ({
                                ...f,
                                treatment:
                                  f.treatment &&
                                  !ALL_TREATMENTS.includes(f.treatment)
                                    ? f.treatment
                                    : OTHER_TREATMENT_LABEL,
                              }))
                            }
                          >
                            {OTHER_TREATMENT_LABEL}
                          </button>
                        </div>
                        {editForm.treatment &&
                          (editForm.treatment === OTHER_TREATMENT_LABEL ||
                            !ALL_TREATMENTS.includes(editForm.treatment)) && (
                            <div className="discussed-treatments-other-treatment-by-tx">
                              <div className="discussed-treatments-other-treatment-by-tx-label">
                                Treatment name
                              </div>
                              <input
                                type="text"
                                placeholder="e.g. CoolSculpting, PRP, body contouring"
                                value={
                                  editForm.treatment === OTHER_TREATMENT_LABEL
                                    ? ""
                                    : editForm.treatment
                                }
                                onChange={(e) =>
                                  setEditForm((f) => ({
                                    ...f,
                                    treatment:
                                      e.target.value.trim() ||
                                      OTHER_TREATMENT_LABEL,
                                  }))
                                }
                                className="discussed-treatments-other-treatment-by-tx-input"
                                aria-label="Treatment name"
                              />
                            </div>
                          )}
                      </div>

                      {/* Product/Type – carousel for Skincare/Laser, chips for others (same as add form) */}
                      {editForm.treatment &&
                        ALL_TREATMENTS.includes(editForm.treatment) &&
                        (TREATMENT_PRODUCT_OPTIONS[editForm.treatment]
                          ?.length ?? 0) > 0 &&
                        (() => {
                          const treatment = editForm.treatment;
                          const opts =
                            TREATMENT_PRODUCT_OPTIONS[treatment] ?? [];
                          const fullList = opts.filter(
                            (p) => p !== OTHER_PRODUCT_LABEL
                          );
                          const sectionTitle =
                            treatment === "Skincare" ? "Product" : "Type";
                          const isSkincareOrLaser =
                            treatment === "Skincare" || treatment === "Laser";
                          const editProductSelected = isSkincareOrLaser
                            ? fullList.includes(editForm.product)
                              ? [editForm.product]
                              : editForm.product
                              ? [OTHER_PRODUCT_LABEL]
                              : []
                            : editForm.product;

                          return (
                            <div className="discussed-treatments-treatment-sub-box">
                              <h3 className="discussed-treatments-form-title discussed-treatments-form-title-step2">
                                {sectionTitle} (optional)
                              </h3>
                              <p className="discussed-treatments-form-hint">
                                Select a {sectionTitle.toLowerCase()} if
                                desired.
                              </p>
                              <div className="discussed-treatments-product-inline discussed-treatments-product-inline-by-treatment">
                                {isSkincareOrLaser ? (
                                  <div
                                    className="discussed-treatments-product-carousel"
                                    role="group"
                                    aria-label={`Select ${sectionTitle.toLowerCase()}`}
                                  >
                                    <div className="discussed-treatments-product-carousel-track">
                                      {fullList.map((p) => {
                                        const isChecked =
                                          editProductSelected.includes(p);
                                        return (
                                          <label
                                            key={p}
                                            className={`discussed-treatments-product-carousel-item ${
                                              treatment !== "Skincare"
                                                ? "discussed-treatments-product-text-only"
                                                : ""
                                            } ${isChecked ? "selected" : ""} ${
                                              p === OTHER_PRODUCT_LABEL
                                                ? "other-chip"
                                                : ""
                                            }`}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => {
                                                setEditForm((f) => ({
                                                  ...f,
                                                  product: isChecked ? "" : p,
                                                }));
                                              }}
                                              className="discussed-treatments-checkbox-input"
                                            />
                                            <div
                                              className="discussed-treatments-product-carousel-image"
                                              aria-hidden
                                            />
                                            <span className="discussed-treatments-product-carousel-label">
                                              {p}
                                            </span>
                                          </label>
                                        );
                                      })}
                                      {opts.includes(OTHER_PRODUCT_LABEL) && (
                                        <label
                                          className={`discussed-treatments-product-carousel-item ${
                                            treatment !== "Skincare"
                                              ? "discussed-treatments-product-text-only"
                                              : ""
                                          } ${
                                            editProductSelected.includes(
                                              OTHER_PRODUCT_LABEL
                                            ) ||
                                            (editForm.product &&
                                              !fullList.includes(
                                                editForm.product
                                              ))
                                              ? "selected"
                                              : ""
                                          } other-chip`}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={
                                              editProductSelected.includes(
                                                OTHER_PRODUCT_LABEL
                                              ) ||
                                              (!!editForm.product &&
                                                !fullList.includes(
                                                  editForm.product
                                                ))
                                            }
                                            onChange={() => {
                                              setEditForm((f) => ({
                                                ...f,
                                                product:
                                                  editProductSelected.includes(
                                                    OTHER_PRODUCT_LABEL
                                                  ) ||
                                                  (f.product &&
                                                    !fullList.includes(
                                                      f.product
                                                    ))
                                                    ? ""
                                                    : OTHER_PRODUCT_LABEL,
                                              }));
                                            }}
                                            className="discussed-treatments-checkbox-input"
                                          />
                                          <div
                                            className="discussed-treatments-product-carousel-image"
                                            aria-hidden
                                          />
                                          <span className="discussed-treatments-product-carousel-label">
                                            {OTHER_PRODUCT_LABEL}
                                          </span>
                                        </label>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div
                                    className="discussed-treatments-chip-row"
                                    role="group"
                                    aria-label={sectionTitle}
                                  >
                                    {fullList.map((p) => (
                                      <button
                                        key={p}
                                        type="button"
                                        className={`discussed-treatments-prefill-chip ${
                                          editForm.product === p
                                            ? "selected"
                                            : ""
                                        }`}
                                        onClick={() =>
                                          setEditForm((f) => ({
                                            ...f,
                                            product: f.product === p ? "" : p,
                                          }))
                                        }
                                      >
                                        {p}
                                      </button>
                                    ))}
                                    {opts.includes(OTHER_PRODUCT_LABEL) && (
                                      <>
                                        <button
                                          type="button"
                                          className={`discussed-treatments-prefill-chip ${
                                            editForm.product &&
                                            !fullList.includes(editForm.product)
                                              ? "selected"
                                              : ""
                                          }`}
                                          onClick={() =>
                                            setEditForm((f) => ({
                                              ...f,
                                              product:
                                                f.product &&
                                                !fullList.includes(f.product)
                                                  ? f.product
                                                  : OTHER_PRODUCT_LABEL,
                                            }))
                                          }
                                        >
                                          {OTHER_PRODUCT_LABEL}
                                        </button>
                                        {editForm.product &&
                                          !fullList.includes(
                                            editForm.product
                                          ) && (
                                            <input
                                              type="text"
                                              placeholder="Specify product or device"
                                              value={
                                                editForm.product ===
                                                OTHER_PRODUCT_LABEL
                                                  ? ""
                                                  : editForm.product
                                              }
                                              onChange={(e) =>
                                                setEditForm((f) => ({
                                                  ...f,
                                                  product:
                                                    e.target.value.trim() ||
                                                    OTHER_PRODUCT_LABEL,
                                                }))
                                              }
                                              className="discussed-treatments-prefill-other-input"
                                            />
                                          )}
                                      </>
                                    )}
                                  </div>
                                )}
                                {isSkincareOrLaser &&
                                  (editProductSelected.includes(
                                    OTHER_PRODUCT_LABEL
                                  ) ||
                                    (editForm.product &&
                                      !fullList.includes(
                                        editForm.product
                                      ))) && (
                                    <div
                                      className="discussed-treatments-product-other-input-wrap"
                                      style={{ marginTop: 8 }}
                                    >
                                      <input
                                        type="text"
                                        placeholder="Specify product or device"
                                        value={
                                          editForm.product &&
                                          !fullList.includes(editForm.product)
                                            ? editForm.product
                                            : ""
                                        }
                                        onChange={(e) =>
                                          setEditForm((f) => ({
                                            ...f,
                                            product: e.target.value.trim(),
                                          }))
                                        }
                                        className="discussed-treatments-prefill-other-input"
                                      />
                                    </div>
                                  )}
                              </div>
                            </div>
                          );
                        })()}

                      {/* Optional details – same as add form (timeline chips + notes) */}
                      {!editShowOptionalDetails ? (
                        <button
                          type="button"
                          className="discussed-treatments-optional-toggle"
                          onClick={() => setEditShowOptionalDetails(true)}
                        >
                          + Add details (optional — timeline)
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="discussed-treatments-optional-toggle discussed-treatments-optional-hide"
                            onClick={() => setEditShowOptionalDetails(false)}
                          >
                            − Hide optional details
                          </button>
                          <div className="discussed-treatments-prefill-rows">
                            {(() => {
                              const qtyCtx = getQuantityContext(
                                editForm.treatment
                              );
                              const displayUnit =
                                editForm.quantityUnit || qtyCtx.unitLabel;
                              return (
                                <div className="discussed-treatments-prefill-row">
                                  <span className="discussed-treatments-prefill-label">
                                    {displayUnit} (optional)
                                  </span>
                                  <select
                                    className="discussed-treatments-quantity-unit-select"
                                    value={displayUnit}
                                    onChange={(e) =>
                                      setEditForm((f) => ({
                                        ...f,
                                        quantityUnit: e.target.value,
                                      }))
                                    }
                                    aria-label="Quantity unit"
                                  >
                                    {QUANTITY_UNIT_OPTIONS.map((u) => (
                                      <option key={u} value={u}>
                                        {u}
                                      </option>
                                    ))}
                                  </select>
                                  <div className="discussed-treatments-chip-row">
                                    {qtyCtx.options.map((q) => (
                                      <button
                                        key={q}
                                        type="button"
                                        className={`discussed-treatments-prefill-chip ${
                                          editForm.quantity === q
                                            ? "selected"
                                            : ""
                                        }`}
                                        onClick={() =>
                                          setEditForm((f) => ({
                                            ...f,
                                            quantity: f.quantity === q ? "" : q,
                                          }))
                                        }
                                      >
                                        {q}
                                      </button>
                                    ))}
                                    <span className="discussed-treatments-quantity-other-wrap">
                                      <input
                                        type="number"
                                        min={1}
                                        max={999}
                                        placeholder="Other"
                                        value={
                                          editForm.quantity &&
                                          !qtyCtx.options.includes(
                                            editForm.quantity
                                          )
                                            ? editForm.quantity
                                            : ""
                                        }
                                        onChange={(e) => {
                                          const v = e.target.value.replace(
                                            /\D/g,
                                            ""
                                          );
                                          setEditForm((f) => ({
                                            ...f,
                                            quantity: v,
                                          }));
                                        }}
                                        className="discussed-treatments-quantity-other-input"
                                        aria-label={`${displayUnit} (other)`}
                                      />
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}
                            <div className="discussed-treatments-prefill-row">
                              <span className="discussed-treatments-prefill-label">
                                Timeline
                              </span>
                              <div className="discussed-treatments-chip-row">
                                {TIMELINE_OPTIONS.map((opt) => (
                                  <label
                                    key={opt}
                                    className={`discussed-treatments-prefill-chip ${
                                      editForm.timeline === opt
                                        ? "selected"
                                        : ""
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name="edit-timeline"
                                      checked={editForm.timeline === opt}
                                      onChange={() =>
                                        setEditForm((f) => ({
                                          ...f,
                                          timeline: opt,
                                        }))
                                      }
                                      className="discussed-treatments-radio-input"
                                    />
                                    {opt}
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="form-group discussed-treatments-notes-row">
                            <label htmlFor="edit-notes" className="form-label">
                              Notes (optional)
                            </label>
                            <input
                              id="edit-notes"
                              type="text"
                              placeholder="Any other detail"
                              value={editForm.notes}
                              onChange={(e) =>
                                setEditForm((f) => ({
                                  ...f,
                                  notes: e.target.value,
                                }))
                              }
                              className="form-input-base"
                            />
                          </div>
                        </>
                      )}
                    </div>
                    <div className="discussed-treatments-edit-actions discussed-treatments-edit-panel-actions">
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={handleEditCancel}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn-primary btn-sm"
                        onClick={handleEditSave}
                        disabled={
                          !editForm.treatment.trim() ||
                          editForm.treatment === OTHER_TREATMENT_LABEL
                        }
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              ) : selectedPlanItemId ? (
                (() => {
                  const sel = items.find((i) => i.id === selectedPlanItemId);
                  return (
                    <div className="discussed-treatments-detail-view-container">
                      {sel ? (
                        <>
                          <div className="discussed-treatments-detail-header">
                            <div className="discussed-treatments-detail-header-left">
                              <h3 className="discussed-treatments-detail-title">
                                {sel.treatment}
                              </h3>
                              {sel.product && (
                                <p className="discussed-treatments-detail-subtitle">
                                  {sel.product}
                                </p>
                              )}
                            </div>
                            <div className="discussed-treatments-detail-header-actions">
                              {completeItemId === sel.id ? (
                                <div className="discussed-treatments-detail-complete-confirm-inline">
                                  <span className="discussed-treatments-detail-complete-text">
                                    Add next visit?
                                  </span>
                                  <button
                                    type="button"
                                    className="btn-secondary btn-sm"
                                    onClick={() => setCompleteItemId(null)}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-secondary btn-sm"
                                    onClick={() => handleComplete(sel, false)}
                                  >
                                    No
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-primary btn-sm"
                                    onClick={() => handleComplete(sel, true)}
                                  >
                                    Yes
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="btn-secondary btn-sm"
                                    onClick={() => setCompleteItemId(sel.id)}
                                  >
                                    Mark completed
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-secondary btn-sm"
                                    onClick={() => handleEditStart(sel)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-secondary btn-sm discussed-treatments-btn-remove"
                                    onClick={() => handleRemove(sel.id)}
                                  >
                                    Remove
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="discussed-treatments-detail-body">
                            <div className="discussed-treatments-detail-section">
                              <h4 className="discussed-treatments-detail-section-title">
                                Clinical details
                              </h4>
                              <div className="discussed-treatments-detail-grid">
                                {sel.interest ? (
                                  <div className="discussed-treatments-detail-field">
                                    <div className="discussed-treatments-detail-field-label">
                                      Patient interest
                                    </div>
                                    <div className="discussed-treatments-detail-field-value">
                                      {sel.interest}
                                    </div>
                                  </div>
                                ) : null}

                                {sel.product || sel.brand ? (
                                  <div className="discussed-treatments-detail-field">
                                    <div className="discussed-treatments-detail-field-label">
                                      Product / brand
                                    </div>
                                    <div className="discussed-treatments-detail-field-value">
                                      {[sel.product, sel.brand]
                                        .filter(Boolean)
                                        .join(" · ")}
                                    </div>
                                  </div>
                                ) : null}

                                {sel.region ? (
                                  <div className="discussed-treatments-detail-field">
                                    <div className="discussed-treatments-detail-field-label">
                                      Target region
                                    </div>
                                    <div className="discussed-treatments-detail-field-value">
                                      {sel.region}
                                    </div>
                                  </div>
                                ) : null}

                                {sel.quantity ? (
                                  <div className="discussed-treatments-detail-field">
                                    <div className="discussed-treatments-detail-field-label">
                                      Quantity
                                    </div>
                                    <div className="discussed-treatments-detail-field-value">
                                      {sel.quantity}
                                    </div>
                                  </div>
                                ) : null}

                                {sel.findings?.length ? (
                                  <div className="discussed-treatments-detail-field discussed-treatments-detail-field-full">
                                    <div className="discussed-treatments-detail-field-label">
                                      Associated findings
                                    </div>
                                    <div className="discussed-treatments-detail-field-value">
                                      <div className="discussed-treatments-finding-tags">
                                        {sel.findings.map((f) => (
                                          <span
                                            key={f}
                                            className="discussed-treatments-finding-tag"
                                          >
                                            {f}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            </div>

                            {sel.timeline || sel.recurring || sel.notes ? (
                              <div className="discussed-treatments-detail-section">
                                <h4 className="discussed-treatments-detail-section-title">
                                  Plan & follow-up
                                </h4>
                                <div className="discussed-treatments-detail-grid">
                                  {sel.timeline ? (
                                    <div className="discussed-treatments-detail-field">
                                      <div className="discussed-treatments-detail-field-label">
                                        Timeline
                                      </div>
                                      <div className="discussed-treatments-detail-field-value discussed-treatments-detail-value-inline">
                                        <span className="discussed-treatments-detail-inline-icon">
                                          🗓
                                        </span>
                                        {sel.timeline}
                                      </div>
                                    </div>
                                  ) : null}

                                  {sel.recurring ? (
                                    <div className="discussed-treatments-detail-field">
                                      <div className="discussed-treatments-detail-field-label">
                                        Recurring
                                      </div>
                                      <div className="discussed-treatments-detail-field-value discussed-treatments-detail-value-inline">
                                        <span className="discussed-treatments-detail-inline-icon">
                                          ↻
                                        </span>
                                        {sel.recurring}
                                      </div>
                                    </div>
                                  ) : null}

                                  {sel.notes ? (
                                    <div className="discussed-treatments-detail-field discussed-treatments-detail-field-full">
                                      <div className="discussed-treatments-detail-field-label">
                                        Notes
                                      </div>
                                      <div className="discussed-treatments-detail-field-value discussed-treatments-detail-notes">
                                        {sel.notes}
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}

                            {/* Post-care & recommended products (Laser, Chemical Peel, etc.) */}
                            {TREATMENT_POSTCARE[sel.treatment] && (
                              <div className="discussed-treatments-detail-section discussed-treatments-postcare-section">
                                <h4 className="discussed-treatments-detail-section-title">
                                  Post-care & recommended
                                </h4>
                                <div className="discussed-treatments-postcare-actions">
                                  <button
                                    type="button"
                                    className="discussed-treatments-postcare-send-btn"
                                    onClick={() => {
                                      const pc =
                                        TREATMENT_POSTCARE[sel.treatment];
                                      if (pc)
                                        setPostCareModal({
                                          treatment: sel.treatment,
                                          label: pc.sendInstructionsLabel,
                                          instructionsText: pc.instructionsText,
                                        });
                                    }}
                                  >
                                    {
                                      TREATMENT_POSTCARE[sel.treatment]
                                        .sendInstructionsLabel
                                    }
                                  </button>
                                  {TREATMENT_POSTCARE[sel.treatment]
                                    .suggestedProducts.length > 0 && (
                                    <div className="discussed-treatments-postcare-suggested">
                                      <span className="discussed-treatments-postcare-suggested-label">
                                        Patients often add:
                                      </span>
                                      <div className="discussed-treatments-postcare-chips">
                                        {TREATMENT_POSTCARE[
                                          sel.treatment
                                        ].suggestedProducts.map((product) => (
                                          <button
                                            key={product}
                                            type="button"
                                            className="discussed-treatments-postcare-chip"
                                            onClick={() =>
                                              handleAddSuggestedProduct(
                                                sel.treatment,
                                                product
                                              )
                                            }
                                          >
                                            + {product}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <p className="discussed-treatments-form-hint">
                          Select an item from the list.
                        </p>
                      )}
                    </div>
                  );
                })()
              ) : items.length > 0 && !showAddForm ? (
                <div className="discussed-treatments-form-section discussed-treatments-select-prompt">
                  <h3 className="discussed-treatments-form-title">
                    BUILD PLAN
                  </h3>
                  <p className="discussed-treatments-form-hint">
                    Select an item from the list to view or edit, or click
                    &quot;+ Add new&quot; to add a treatment to the plan.
                  </p>
                </div>
              ) : (
                <div
                  ref={addFormSectionRef}
                  id="discussed-treatments-add-section"
                  className="discussed-treatments-form-section"
                >
                  <div className="discussed-treatments-add-form-header-row">
                    <div>
                      <h3 className="discussed-treatments-form-title">
                        {items.length > 0
                          ? "BUILD PLAN"
                          : "What they're interested in"}
                      </h3>
                      <p className="discussed-treatments-form-hint">
                        Start by developing a treatment plan and wishlist so
                        patients can plan and research
                      </p>
                    </div>
                    {items.length > 0 && (
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={handleDiscardAddForm}
                      >
                        Discard
                      </button>
                    )}
                  </div>
                  <div
                    className="discussed-treatments-add-by-mode"
                    role="group"
                    aria-label="How to add"
                  >
                    <button
                      type="button"
                      className={`discussed-treatments-mode-chip ${
                        addMode === "goal" ? "selected" : ""
                      }`}
                      onClick={() => handleAddModeChange("goal")}
                    >
                      By Patient Interests
                    </button>
                    <button
                      type="button"
                      className={`discussed-treatments-mode-chip ${
                        addMode === "treatment" ? "selected" : ""
                      }`}
                      onClick={() => handleAddModeChange("treatment")}
                    >
                      By Treatment
                    </button>
                  </div>

                  {addMode === "goal" ||
                  addMode === "finding" ||
                  addMode === "treatment" ? (
                    <div
                      className={`discussed-treatments-add-form-body${
                        addMode === "goal" ? " goal-flow-active" : ""
                      }${
                        addMode === "treatment" ? " treatment-flow-active" : ""
                      }`}
                    >
                      <div className="discussed-treatments-add-form-single-box">
                        {/* --- By assessment finding: this patient's analysis findings by area, then Other --- */}
                        {addMode === "finding" && (
                          <div className="discussed-treatments-finding-step">
                            <h3 className="discussed-treatments-form-title discussed-treatments-form-title-step2">
                              Assessment finding
                            </h3>
                            <p className="discussed-treatments-form-hint">
                              Findings from this patient&apos;s analysis, by
                              area. Select one or more, or use Other to add a
                              finding not listed.
                            </p>
                            {patientFindingsByArea.length > 0 ? (
                              <div className="discussed-treatments-findings-by-area discussed-treatments-findings-collapsible discussed-treatments-findings-cards-grid">
                                {patientFindingsByArea.map(
                                  ({ area, findings }) => {
                                    const isExpanded =
                                      expandedFindingAreas.has(area);
                                    const selectedInArea = findings.filter(
                                      (f) => selectedFindings.includes(f)
                                    ).length;
                                    const focusAreas = (
                                      client.areas &&
                                      Array.isArray(client.areas)
                                        ? client.areas
                                        : []
                                    ) as string[];
                                    const isFocusArea = focusAreas.some(
                                      (a) =>
                                        String(a).trim().toLowerCase() ===
                                        area.trim().toLowerCase()
                                    );
                                    return (
                                      <div
                                        key={area}
                                        className="discussed-treatments-area-card discussed-treatments-area-group discussed-treatments-area-collapsible"
                                      >
                                        <button
                                          type="button"
                                          className="discussed-treatments-area-collapse-trigger"
                                          onClick={() =>
                                            toggleFindingArea(area)
                                          }
                                          aria-expanded={isExpanded}
                                          aria-controls={`findings-area-${area}`}
                                        >
                                          <span className="discussed-treatments-area-collapse-label">
                                            {area}
                                          </span>
                                          {isFocusArea && (
                                            <span
                                              className="discussed-treatments-area-focus-badge"
                                              title="Focus area for this patient"
                                            >
                                              Focus
                                            </span>
                                          )}
                                          {selectedInArea > 0 && (
                                            <span
                                              className="discussed-treatments-area-count"
                                              aria-label={`${selectedInArea} selected`}
                                            >
                                              {selectedInArea}
                                            </span>
                                          )}
                                          <span
                                            className="discussed-treatments-area-chevron"
                                            aria-hidden
                                          >
                                            {isExpanded ? "▼" : "▶"}
                                          </span>
                                        </button>
                                        <div
                                          id={`findings-area-${area}`}
                                          className="discussed-treatments-area-collapse-content"
                                          hidden={!isExpanded}
                                        >
                                          <div
                                            className="discussed-treatments-chip-row"
                                            role="group"
                                            aria-label={`Findings – ${area}`}
                                          >
                                            {findings.map((f) => (
                                              <button
                                                key={f}
                                                type="button"
                                                className={`discussed-treatments-topic-chip ${
                                                  selectedFindings.includes(f)
                                                    ? "selected"
                                                    : ""
                                                }`}
                                                onClick={() => toggleFinding(f)}
                                              >
                                                {f}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }
                                )}
                              </div>
                            ) : (
                              <p className="discussed-treatments-form-hint">
                                No assessment findings for this patient yet. Use
                                Other below to add a finding.
                              </p>
                            )}
                            <div className="discussed-treatments-other-finding-section">
                              <h4 className="discussed-treatments-other-finding-heading">
                                {OTHER_FINDING_LABEL}
                              </h4>
                              <span className="discussed-treatments-area-label">
                                Add a finding not in this patient&apos;s
                                analysis (search all findings).
                              </span>
                              {!showOtherFindingPicker ? (
                                <button
                                  type="button"
                                  className="discussed-treatments-topic-chip other-chip"
                                  onClick={() => {
                                    setShowOtherFindingPicker(true);
                                    setOtherFindingSearch("");
                                  }}
                                >
                                  {OTHER_FINDING_LABEL}
                                </button>
                              ) : (
                                <div className="discussed-treatments-interest-search-wrap">
                                  <input
                                    type="text"
                                    className="discussed-treatments-interest-search-input"
                                    placeholder="Search findings..."
                                    value={otherFindingSearch}
                                    onChange={(e) =>
                                      setOtherFindingSearch(e.target.value)
                                    }
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    className="discussed-treatments-interest-back-btn"
                                    onClick={() => {
                                      setShowOtherFindingPicker(false);
                                      setOtherFindingSearch("");
                                    }}
                                    style={{ marginTop: 6 }}
                                  >
                                    ← Back
                                  </button>
                                  <div
                                    className="discussed-treatments-interest-dropdown discussed-treatments-findings-dropdown"
                                    role="listbox"
                                  >
                                    {filteredOtherFindings.map((f) => (
                                      <button
                                        key={f}
                                        type="button"
                                        role="option"
                                        className={`discussed-treatments-interest-option ${
                                          selectedFindings.includes(f)
                                            ? "selected"
                                            : ""
                                        }`}
                                        onClick={() => {
                                          toggleFinding(f);
                                          setShowOtherFindingPicker(false);
                                          setOtherFindingSearch("");
                                        }}
                                      >
                                        {f}
                                      </button>
                                    ))}
                                    {filteredOtherFindings.length === 0 && (
                                      <div className="discussed-treatments-interest-empty">
                                        No matches.
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                            {selectedFindings.length > 0 &&
                              (form.interest || form.region) && (
                                <p className="discussed-treatments-form-hint discussed-treatments-prefill-hint">
                                  Goals: {form.interest} · Region: {form.region}
                                  . Select treatments below, then add to plan.
                                </p>
                              )}
                          </div>
                        )}

                        {/* --- By treatment: treatment first, then assessment finding (optional), then product (optional) --- */}
                        {(addMode as AddByMode) === "treatment" && (
                          <div className="discussed-treatments-treatment-first-step">
                            <div className="discussed-treatments-treatment-sub-box">
                              <h3 className="discussed-treatments-form-title discussed-treatments-form-title-step2">
                                Treatment
                              </h3>
                              <div
                                className="discussed-treatments-checkbox-grid"
                                role="group"
                                aria-label="Treatments"
                              >
                                {ALL_TREATMENTS.map((name) => (
                                  <button
                                    key={name}
                                    type="button"
                                    className={`discussed-treatments-topic-chip ${
                                      selectedTreatmentFirst === name
                                        ? "selected"
                                        : ""
                                    }`}
                                    onClick={() =>
                                      handleSelectTreatmentFirst(name)
                                    }
                                  >
                                    {name}
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  className={`discussed-treatments-topic-chip other-chip ${
                                    selectedTreatmentFirst ===
                                    OTHER_TREATMENT_LABEL
                                      ? "selected"
                                      : ""
                                  }`}
                                  onClick={() =>
                                    handleSelectTreatmentFirst(
                                      OTHER_TREATMENT_LABEL
                                    )
                                  }
                                >
                                  {OTHER_TREATMENT_LABEL}
                                </button>
                              </div>
                              {selectedTreatmentFirst ===
                                OTHER_TREATMENT_LABEL && (
                                <div className="discussed-treatments-other-treatment-by-tx">
                                  <div className="discussed-treatments-other-treatment-by-tx-label">
                                    Treatment name
                                  </div>
                                  <p className="discussed-treatments-form-hint discussed-treatments-other-treatment-by-tx-hint">
                                    Type the treatment you discussed (e.g.
                                    CoolSculpting, PRP)
                                  </p>
                                  <input
                                    type="text"
                                    placeholder="e.g. CoolSculpting, PRP, body contouring"
                                    value={form.otherTreatment}
                                    onChange={(e) =>
                                      setForm((f) => ({
                                        ...f,
                                        otherTreatment: e.target.value,
                                      }))
                                    }
                                    className="discussed-treatments-other-treatment-by-tx-input"
                                    aria-label="Treatment name"
                                  />
                                </div>
                              )}
                            </div>
                            {/* Product / type (optional) — after assessment finding */}
                            {selectedTreatmentFirst &&
                              selectedTreatmentFirst !==
                                OTHER_TREATMENT_LABEL &&
                              (TREATMENT_PRODUCT_OPTIONS[selectedTreatmentFirst]
                                ?.length ?? 0) > 0 &&
                              (() => {
                                const treatment = selectedTreatmentFirst;
                                const opts =
                                  TREATMENT_PRODUCT_OPTIONS[treatment] ?? [];
                                const fullList = opts.filter(
                                  (p) => p !== OTHER_PRODUCT_LABEL
                                );
                                const selected =
                                  form.treatmentProducts[treatment] ??
                                  (treatment === "Skincare"
                                    ? form.skincareProduct
                                    : "");
                                const otherVal =
                                  form.treatmentProductOther[treatment] ??
                                  (treatment === "Skincare"
                                    ? form.skincareProductOther
                                    : "");
                                const sectionTitle =
                                  treatment === "Skincare" ? "Product" : "Type";
                                const q = productSearchQuery
                                  .trim()
                                  .toLowerCase();
                                const searchFilteredList = q
                                  ? fullList.filter((p: string) =>
                                      p.toLowerCase().includes(q)
                                    )
                                  : fullList;
                                return (
                                  <div className="discussed-treatments-treatment-sub-box">
                                    <h3 className="discussed-treatments-form-title discussed-treatments-form-title-step2">
                                      {sectionTitle} (optional)
                                    </h3>
                                    <p className="discussed-treatments-form-hint">
                                      Select a {sectionTitle.toLowerCase()} if
                                      desired, or skip to add to plan.
                                    </p>
                                    <div className="discussed-treatments-product-inline discussed-treatments-product-inline-by-treatment">
                                      {treatment === "Skincare" ? (
                                        <div
                                          className="discussed-treatments-product-carousel"
                                          role="group"
                                          aria-label={`Select ${sectionTitle.toLowerCase()} (multiple)`}
                                        >
                                          <div className="discussed-treatments-product-carousel-track">
                                            {fullList.map((p) => {
                                              const selectedListTx =
                                                form
                                                  .selectedProductsByTreatment[
                                                  treatment
                                                ] ?? [];
                                              const isCheckedTx =
                                                selectedListTx.includes(p);
                                              return (
                                                <label
                                                  key={p}
                                                  className={`discussed-treatments-product-carousel-item ${
                                                    isCheckedTx
                                                      ? "selected"
                                                      : ""
                                                  } ${
                                                    p === OTHER_PRODUCT_LABEL
                                                      ? "other-chip"
                                                      : ""
                                                  }`}
                                                >
                                                  <input
                                                    type="checkbox"
                                                    checked={isCheckedTx}
                                                    onChange={() => {
                                                      const currentTx =
                                                        form
                                                          .selectedProductsByTreatment[
                                                          treatment
                                                        ] ?? [];
                                                      setForm((f) => ({
                                                        ...f,
                                                        selectedProductsByTreatment:
                                                          {
                                                            ...f.selectedProductsByTreatment,
                                                            [treatment]:
                                                              isCheckedTx
                                                                ? currentTx.filter(
                                                                    (x) =>
                                                                      x !== p
                                                                  )
                                                                : [
                                                                    ...currentTx,
                                                                    p,
                                                                  ],
                                                          },
                                                        ...(p ===
                                                          OTHER_PRODUCT_LABEL &&
                                                        !isCheckedTx
                                                          ? {
                                                              treatmentProductOther:
                                                                {
                                                                  ...f.treatmentProductOther,
                                                                  [treatment]:
                                                                    "",
                                                                },
                                                              skincareProductOther:
                                                                "",
                                                            }
                                                          : {}),
                                                      }));
                                                    }}
                                                    className="discussed-treatments-checkbox-input"
                                                  />
                                                  <div
                                                    className="discussed-treatments-product-carousel-image"
                                                    aria-hidden
                                                  />
                                                  <span className="discussed-treatments-product-carousel-label">
                                                    {p}
                                                  </span>
                                                </label>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      ) : treatment === "Laser" ? (
                                        <div
                                          className="discussed-treatments-product-carousel"
                                          role="group"
                                          aria-label={`Select ${sectionTitle.toLowerCase()}`}
                                        >
                                          <div className="discussed-treatments-product-carousel-track">
                                            {fullList.map((p) => {
                                              const isSelectedTx =
                                                selected === p;
                                              return (
                                                <label
                                                  key={p}
                                                  className={`discussed-treatments-product-carousel-item discussed-treatments-product-text-only ${
                                                    isSelectedTx
                                                      ? "selected"
                                                      : ""
                                                  } ${
                                                    p === OTHER_PRODUCT_LABEL
                                                      ? "other-chip"
                                                      : ""
                                                  }`}
                                                >
                                                  <input
                                                    type="radio"
                                                    name={`product-tx-${treatment}`}
                                                    checked={isSelectedTx}
                                                    onChange={() =>
                                                      setForm((f) => ({
                                                        ...f,
                                                        treatmentProducts: {
                                                          ...f.treatmentProducts,
                                                          [treatment]: p,
                                                        },
                                                        treatmentProductOther: {
                                                          ...f.treatmentProductOther,
                                                          [treatment]:
                                                            p ===
                                                            OTHER_PRODUCT_LABEL
                                                              ? f
                                                                  .treatmentProductOther[
                                                                  treatment
                                                                ] ?? ""
                                                              : "",
                                                        },
                                                      }))
                                                    }
                                                    className="discussed-treatments-checkbox-input"
                                                  />
                                                  <div
                                                    className="discussed-treatments-product-carousel-image"
                                                    aria-hidden
                                                  />
                                                  <span className="discussed-treatments-product-carousel-label">
                                                    {p}
                                                  </span>
                                                </label>
                                              );
                                            })}
                                            {opts.includes(
                                              OTHER_PRODUCT_LABEL
                                            ) && (
                                              <label
                                                className={`discussed-treatments-product-carousel-item discussed-treatments-product-text-only ${
                                                  selected ===
                                                  OTHER_PRODUCT_LABEL
                                                    ? "selected"
                                                    : ""
                                                } other-chip`}
                                              >
                                                <input
                                                  type="radio"
                                                  name={`product-tx-${treatment}`}
                                                  checked={
                                                    selected ===
                                                    OTHER_PRODUCT_LABEL
                                                  }
                                                  onChange={() =>
                                                    setForm((f) => ({
                                                      ...f,
                                                      treatmentProducts: {
                                                        ...f.treatmentProducts,
                                                        [treatment]:
                                                          OTHER_PRODUCT_LABEL,
                                                      },
                                                      treatmentProductOther: {
                                                        ...f.treatmentProductOther,
                                                        [treatment]:
                                                          f
                                                            .treatmentProductOther[
                                                            treatment
                                                          ] ?? "",
                                                      },
                                                    }))
                                                  }
                                                  className="discussed-treatments-checkbox-input"
                                                />
                                                <div
                                                  className="discussed-treatments-product-carousel-image"
                                                  aria-hidden
                                                />
                                                <span className="discussed-treatments-product-carousel-label">
                                                  {OTHER_PRODUCT_LABEL}
                                                </span>
                                              </label>
                                            )}
                                          </div>
                                        </div>
                                      ) : (
                                        /* Filler, Neurotoxin, Chemical Peel, etc.: show full type list as chips (single-select) */
                                        <div
                                          className="discussed-treatments-product-carousel"
                                          role="group"
                                          aria-label={`Select ${sectionTitle.toLowerCase()} (optional)`}
                                        >
                                          <div className="discussed-treatments-product-carousel-track">
                                            {fullList.map((p) => {
                                              const isSelectedTx =
                                                selected === p;
                                              return (
                                                <label
                                                  key={p}
                                                  className={`discussed-treatments-product-carousel-item discussed-treatments-product-text-only ${
                                                    isSelectedTx
                                                      ? "selected"
                                                      : ""
                                                  } ${
                                                    p === OTHER_PRODUCT_LABEL
                                                      ? "other-chip"
                                                      : ""
                                                  }`}
                                                >
                                                  <input
                                                    type="radio"
                                                    name={`product-tx-${treatment}`}
                                                    checked={isSelectedTx}
                                                    onChange={() =>
                                                      setForm((f) => ({
                                                        ...f,
                                                        treatmentProducts: {
                                                          ...f.treatmentProducts,
                                                          [treatment]: p,
                                                        },
                                                        treatmentProductOther: {
                                                          ...f.treatmentProductOther,
                                                          [treatment]:
                                                            p ===
                                                            OTHER_PRODUCT_LABEL
                                                              ? f
                                                                  .treatmentProductOther[
                                                                  treatment
                                                                ] ?? ""
                                                              : "",
                                                        },
                                                      }))
                                                    }
                                                    className="discussed-treatments-checkbox-input"
                                                  />
                                                  <div
                                                    className="discussed-treatments-product-carousel-image"
                                                    aria-hidden
                                                  />
                                                  <span className="discussed-treatments-product-carousel-label">
                                                    {p}
                                                  </span>
                                                </label>
                                              );
                                            })}
                                            {opts.includes(
                                              OTHER_PRODUCT_LABEL
                                            ) && (
                                              <label
                                                className={`discussed-treatments-product-carousel-item discussed-treatments-product-text-only ${
                                                  selected ===
                                                  OTHER_PRODUCT_LABEL
                                                    ? "selected"
                                                    : ""
                                                } other-chip`}
                                              >
                                                <input
                                                  type="radio"
                                                  name={`product-tx-${treatment}`}
                                                  checked={
                                                    selected ===
                                                    OTHER_PRODUCT_LABEL
                                                  }
                                                  onChange={() =>
                                                    setForm((f) => ({
                                                      ...f,
                                                      treatmentProducts: {
                                                        ...f.treatmentProducts,
                                                        [treatment]:
                                                          OTHER_PRODUCT_LABEL,
                                                      },
                                                      treatmentProductOther: {
                                                        ...f.treatmentProductOther,
                                                        [treatment]:
                                                          f
                                                            .treatmentProductOther[
                                                            treatment
                                                          ] ?? "",
                                                      },
                                                    }))
                                                  }
                                                  className="discussed-treatments-checkbox-input"
                                                />
                                                <div
                                                  className="discussed-treatments-product-carousel-image"
                                                  aria-hidden
                                                />
                                                <span className="discussed-treatments-product-carousel-label">
                                                  {OTHER_PRODUCT_LABEL}
                                                </span>
                                              </label>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                      {(treatment === "Skincare" &&
                                        (
                                          form.selectedProductsByTreatment[
                                            treatment
                                          ] ?? []
                                        ).includes(OTHER_PRODUCT_LABEL)) ||
                                      (treatment !== "Skincare" &&
                                        selected === OTHER_PRODUCT_LABEL) ? (
                                        <div className="discussed-treatments-product-other-input-wrap">
                                          <input
                                            type="text"
                                            placeholder="Specify product or device"
                                            value={otherVal}
                                            onChange={(e) =>
                                              setForm((f) => ({
                                                ...f,
                                                treatmentProductOther: {
                                                  ...f.treatmentProductOther,
                                                  [treatment]: e.target.value,
                                                },
                                                ...(treatment === "Skincare"
                                                  ? {
                                                      skincareProductOther:
                                                        e.target.value,
                                                    }
                                                  : {}),
                                              }))
                                            }
                                            className="discussed-treatments-prefill-other-input"
                                          />
                                        </div>
                                      ) : null}
                                      {false ? (
                                        isNarrowScreen ? (
                                          <div className="discussed-treatments-product-search-wrap">
                                            <div className="discussed-treatments-mobile-select-wrap">
                                              <select
                                                className="discussed-treatments-mobile-select"
                                                value={selected || ""}
                                                onChange={(e) => {
                                                  const p = e.target.value;
                                                  setForm((f) => ({
                                                    ...f,
                                                    treatmentProducts: {
                                                      ...f.treatmentProducts,
                                                      [treatment]: p,
                                                    },
                                                    treatmentProductOther: {
                                                      ...f.treatmentProductOther,
                                                      [treatment]: "",
                                                    },
                                                    ...(treatment === "Skincare"
                                                      ? {
                                                          skincareProduct: p,
                                                          skincareProductOther:
                                                            "",
                                                        }
                                                      : {}),
                                                  }));
                                                  setOpenProductSearchFor(null);
                                                  setProductSearchQuery("");
                                                }}
                                                aria-label={`Select ${sectionTitle.toLowerCase()}`}
                                              >
                                                <option value="">
                                                  Select or skip…
                                                </option>
                                                {fullList.map((p) => (
                                                  <option key={p} value={p}>
                                                    {p}
                                                  </option>
                                                ))}
                                                {opts.includes(
                                                  OTHER_PRODUCT_LABEL
                                                ) && (
                                                  <option
                                                    value={OTHER_PRODUCT_LABEL}
                                                  >
                                                    {OTHER_PRODUCT_LABEL}
                                                  </option>
                                                )}
                                              </select>
                                            </div>
                                            <button
                                              type="button"
                                              className="discussed-treatments-interest-back-btn"
                                              onClick={() => {
                                                setOpenProductSearchFor(null);
                                                setProductSearchQuery("");
                                              }}
                                            >
                                              ← Back
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="discussed-treatments-product-search-wrap">
                                            <input
                                              type="text"
                                              className="discussed-treatments-interest-search-input"
                                              placeholder="Search options..."
                                              value={productSearchQuery}
                                              onChange={(e) =>
                                                setProductSearchQuery(
                                                  e.target.value
                                                )
                                              }
                                              autoFocus
                                            />
                                            <button
                                              type="button"
                                              className="discussed-treatments-interest-back-btn"
                                              onClick={() => {
                                                setOpenProductSearchFor(null);
                                                setProductSearchQuery("");
                                              }}
                                            >
                                              ← Back
                                            </button>
                                            <div
                                              className="discussed-treatments-interest-dropdown discussed-treatments-findings-dropdown"
                                              role="listbox"
                                            >
                                              {searchFilteredList.map((p) => (
                                                <button
                                                  key={p}
                                                  type="button"
                                                  role="option"
                                                  className={`discussed-treatments-interest-option ${
                                                    selected === p
                                                      ? "selected"
                                                      : ""
                                                  }`}
                                                  onClick={() => {
                                                    setForm((f) => ({
                                                      ...f,
                                                      treatmentProducts: {
                                                        ...f.treatmentProducts,
                                                        [treatment]: p,
                                                      },
                                                      treatmentProductOther: {
                                                        ...f.treatmentProductOther,
                                                        [treatment]: "",
                                                      },
                                                      ...(treatment ===
                                                      "Skincare"
                                                        ? {
                                                            skincareProduct: p,
                                                            skincareProductOther:
                                                              "",
                                                          }
                                                        : {}),
                                                    }));
                                                    setOpenProductSearchFor(
                                                      null
                                                    );
                                                    setProductSearchQuery("");
                                                  }}
                                                >
                                                  {p}
                                                </button>
                                              ))}
                                              {opts.includes(
                                                OTHER_PRODUCT_LABEL
                                              ) && (
                                                <button
                                                  type="button"
                                                  role="option"
                                                  className={`discussed-treatments-interest-option ${
                                                    selected ===
                                                    OTHER_PRODUCT_LABEL
                                                      ? "selected"
                                                      : ""
                                                  }`}
                                                  onClick={() => {
                                                    setForm((f) => ({
                                                      ...f,
                                                      treatmentProducts: {
                                                        ...f.treatmentProducts,
                                                        [treatment]:
                                                          OTHER_PRODUCT_LABEL,
                                                      },
                                                      ...(treatment ===
                                                      "Skincare"
                                                        ? {
                                                            skincareProduct:
                                                              OTHER_PRODUCT_LABEL,
                                                          }
                                                        : {}),
                                                    }));
                                                    setOpenProductSearchFor(
                                                      null
                                                    );
                                                    setProductSearchQuery("");
                                                  }}
                                                >
                                                  {OTHER_PRODUCT_LABEL}
                                                </button>
                                              )}
                                              {searchFilteredList.length ===
                                                0 &&
                                                !opts.includes(
                                                  OTHER_PRODUCT_LABEL
                                                ) && (
                                                  <div className="discussed-treatments-interest-empty">
                                                    No matches.
                                                  </div>
                                                )}
                                            </div>
                                          </div>
                                        )
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })()}
                            {selectedTreatmentFirst && (
                              <div className="discussed-treatments-treatment-sub-box">
                                <h3 className="discussed-treatments-form-title discussed-treatments-form-title-step2">
                                  To address (optional)
                                </h3>
                                <p className="discussed-treatments-form-hint">
                                  Select an AI or provider identified concern
                                  for the selected treatment.
                                </p>
                                <div className="discussed-treatments-to-address-wrap">
                                  {findingsByAreaForTreatment.length > 0 ? (
                                    <div className="discussed-treatments-findings-by-area discussed-treatments-findings-cards-grid discussed-treatments-to-address-grid">
                                      {findingsByAreaForTreatment.map(
                                        ({ area, findings }) => (
                                          <div
                                            key={area}
                                            className="discussed-treatments-area-card discussed-treatments-area-card-to-address"
                                          >
                                            <span className="discussed-treatments-area-label discussed-treatments-area-card-heading">
                                              {area}
                                            </span>
                                            <div
                                              className="discussed-treatments-chip-row"
                                              role="group"
                                              aria-label={`Findings – ${area}`}
                                            >
                                              {findings.map((f) => (
                                                <button
                                                  key={f}
                                                  type="button"
                                                  className={`discussed-treatments-topic-chip ${
                                                    selectedFindingByTreatment.includes(
                                                      f
                                                    )
                                                      ? "selected"
                                                      : ""
                                                  }`}
                                                  onClick={() =>
                                                    handleSelectFindingByTreatment(
                                                      f
                                                    )
                                                  }
                                                >
                                                  {f}
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                        )
                                      )}
                                    </div>
                                  ) : (
                                    <p className="discussed-treatments-form-hint">
                                      No assessment findings mapped for this
                                      treatment. Add goal/region in optional
                                      details below.
                                    </p>
                                  )}
                                  <div className="discussed-treatments-other-finding-section discussed-treatments-other-at-bottom">
                                    <span className="discussed-treatments-finding-col-label">
                                      Other
                                    </span>
                                    <div className="discussed-treatments-other-selected-chips">
                                      {selectedFindingByTreatment
                                        .filter(
                                          (f) =>
                                            !findingsByAreaForTreatment.some(
                                              (g) => g.findings.includes(f)
                                            )
                                        )
                                        .map((f) => (
                                          <button
                                            key={f}
                                            type="button"
                                            className="discussed-treatments-topic-chip selected"
                                            onClick={() =>
                                              handleSelectFindingByTreatment(f)
                                            }
                                          >
                                            {f}
                                          </button>
                                        ))}
                                    </div>
                                    {!showOtherFindingPickerByTreatment ? (
                                      <button
                                        type="button"
                                        className="discussed-treatments-topic-chip other-chip"
                                        onClick={() => {
                                          setShowOtherFindingPickerByTreatment(
                                            true
                                          );
                                          setOtherFindingSearchByTreatment("");
                                        }}
                                      >
                                        + {OTHER_FINDING_LABEL}
                                      </button>
                                    ) : (
                                      <div className="discussed-treatments-interest-search-wrap discussed-treatments-search-compact">
                                        <input
                                          type="text"
                                          className="discussed-treatments-interest-search-input"
                                          placeholder="Search..."
                                          value={otherFindingSearchByTreatment}
                                          onChange={(e) =>
                                            setOtherFindingSearchByTreatment(
                                              e.target.value
                                            )
                                          }
                                          autoFocus
                                        />
                                        <button
                                          type="button"
                                          className="discussed-treatments-interest-back-btn discussed-treatments-back-inline"
                                          onClick={() => {
                                            setShowOtherFindingPickerByTreatment(
                                              false
                                            );
                                            setOtherFindingSearchByTreatment(
                                              ""
                                            );
                                          }}
                                        >
                                          ← Back
                                        </button>
                                        <div
                                          className="discussed-treatments-interest-dropdown discussed-treatments-findings-dropdown"
                                          role="listbox"
                                        >
                                          {filteredOtherFindingsByTreatment.map(
                                            (f) => (
                                              <button
                                                key={f}
                                                type="button"
                                                role="option"
                                                className={`discussed-treatments-interest-option ${
                                                  selectedFindingByTreatment.includes(
                                                    f
                                                  )
                                                    ? "selected"
                                                    : ""
                                                }`}
                                                onClick={() => {
                                                  handleSelectFindingByTreatment(
                                                    f
                                                  );
                                                  setShowOtherFindingPickerByTreatment(
                                                    false
                                                  );
                                                  setOtherFindingSearchByTreatment(
                                                    ""
                                                  );
                                                }}
                                              >
                                                {f}
                                              </button>
                                            )
                                          )}
                                          {filteredOtherFindingsByTreatment.length ===
                                            0 && (
                                            <div className="discussed-treatments-interest-empty">
                                              No matches.
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* --- By goal: Treatment Interests heading + topic chips, or full list only when Other clicked --- */}
                        {addMode === "goal" && (
                          <div className="discussed-treatments-goal-flow-box">
                            <div className="discussed-treatments-patient-interests-section">
                              <div className="discussed-treatments-section-label discussed-treatments-form-title-step2">
                                Patient's Treatment Interests
                              </div>
                              {!showFullInterestList ? (
                                <>
                                  <div
                                    className="discussed-treatments-topic-grid"
                                    role="group"
                                    aria-label="Interest from analysis or Other"
                                  >
                                    {interestChipOptions.map((topic) => (
                                      <button
                                        key={topic}
                                        type="button"
                                        className={`discussed-treatments-topic-chip ${
                                          form.interest === topic
                                            ? "selected"
                                            : ""
                                        } ${
                                          topic === OTHER_LABEL
                                            ? "other-chip"
                                            : ""
                                        }`}
                                        onClick={() => {
                                          if (topic === OTHER_LABEL) {
                                            setShowFullInterestList(true);
                                            setForm((f) => ({
                                              ...f,
                                              interest: "",
                                              selectedFindingsByTreatment: {},
                                              selectedTreatments: [],
                                              otherTreatment: "",
                                            }));
                                            setInterestSearch("");
                                          } else {
                                            setForm((f) => ({
                                              ...f,
                                              interest:
                                                form.interest === topic
                                                  ? ""
                                                  : topic,
                                              selectedFindingsByTreatment: {},
                                              selectedTreatments: [],
                                              otherTreatment: "",
                                            }));
                                          }
                                        }}
                                      >
                                        {topic}
                                      </button>
                                    ))}
                                  </div>
                                  {form.interest &&
                                    !interestChipOptions.includes(
                                      form.interest
                                    ) && (
                                      <div className="discussed-treatments-topic-grid discussed-treatments-selected-from-list-chips">
                                        <span className="discussed-treatments-topic-chip selected">
                                          {form.interest}
                                        </span>
                                        <button
                                          type="button"
                                          className="discussed-treatments-topic-chip discussed-treatments-interest-change-chip"
                                          onClick={() => {
                                            setShowFullInterestList(true);
                                            setInterestSearch(form.interest);
                                          }}
                                        >
                                          Change
                                        </button>
                                      </div>
                                    )}
                                </>
                              ) : (
                                <div
                                  className={
                                    isNarrowScreen
                                      ? "discussed-treatments-interest-search-wrap discussed-treatments-interest-mobile-picker"
                                      : "discussed-treatments-interest-search-wrap"
                                  }
                                >
                                  {isNarrowScreen ? (
                                    <>
                                      <label
                                        htmlFor="treatment-interest-select"
                                        className="discussed-treatments-mobile-picker-label"
                                      >
                                        Select treatment interest
                                      </label>
                                      <select
                                        id="treatment-interest-select"
                                        className="discussed-treatments-mobile-select"
                                        value={form.interest || ""}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          setForm((f) => ({
                                            ...f,
                                            interest: v,
                                            selectedFindingsByTreatment: {},
                                            selectedTreatments: [],
                                            otherTreatment: "",
                                          }));
                                          setInterestSearch(v);
                                          if (v) setShowFullInterestList(false);
                                        }}
                                        aria-label="Select treatment interest"
                                      >
                                        <option value="">
                                          Select an option…
                                        </option>
                                        {topicOptions.map((topic) => (
                                          <option key={topic} value={topic}>
                                            {topic}
                                          </option>
                                        ))}
                                      </select>
                                      <button
                                        type="button"
                                        className="discussed-treatments-interest-back-btn discussed-treatments-mobile-picker-back"
                                        onClick={() => {
                                          setShowFullInterestList(false);
                                          setInterestSearch("");
                                        }}
                                      >
                                        ← Back to chips
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <div className="discussed-treatments-interest-full-list-header">
                                        <span className="discussed-treatments-interest-full-list-title">
                                          Choose from full list
                                        </span>
                                        <button
                                          type="button"
                                          className="discussed-treatments-interest-back-btn"
                                          onClick={() => {
                                            setShowFullInterestList(false);
                                            setInterestSearch("");
                                          }}
                                        >
                                          ← Back to chips
                                        </button>
                                      </div>
                                      <>
                                        <input
                                          type="text"
                                          className="discussed-treatments-interest-search-input"
                                          placeholder="Search or select interest..."
                                          value={
                                            form.interest || interestSearch
                                          }
                                          onChange={(e) => {
                                            const v = e.target.value;
                                            setInterestSearch(v);
                                            if (form.interest)
                                              setForm((f) => ({
                                                ...f,
                                                interest: "",
                                                selectedTreatments: [],
                                                otherTreatment: "",
                                              }));
                                          }}
                                        />
                                        <button
                                          type="button"
                                          className="discussed-treatments-interest-clear-btn"
                                          onClick={() => {
                                            setForm((f) => ({
                                              ...f,
                                              interest: "",
                                              selectedTreatments: [],
                                              otherTreatment: "",
                                            }));
                                            setInterestSearch("");
                                          }}
                                          aria-label="Clear interest"
                                          title="Clear"
                                          style={{
                                            visibility:
                                              form.interest || interestSearch
                                                ? "visible"
                                                : "hidden",
                                          }}
                                        >
                                          ×
                                        </button>
                                        <div
                                          className="discussed-treatments-interest-dropdown"
                                          role="listbox"
                                          aria-label="Interest options"
                                        >
                                          {filteredInterestOptions.map(
                                            (topic) => (
                                              <button
                                                key={topic}
                                                type="button"
                                                role="option"
                                                aria-selected={
                                                  form.interest === topic
                                                }
                                                className={`discussed-treatments-interest-option ${
                                                  form.interest === topic
                                                    ? "selected"
                                                    : ""
                                                }`}
                                                onClick={() => {
                                                  setForm((f) => ({
                                                    ...f,
                                                    interest:
                                                      form.interest === topic
                                                        ? ""
                                                        : topic,
                                                    selectedFindingsByTreatment:
                                                      {},
                                                    selectedTreatments: [],
                                                    otherTreatment: "",
                                                  }));
                                                  setInterestSearch("");
                                                  setShowFullInterestList(
                                                    false
                                                  );
                                                }}
                                              >
                                                {topic}
                                              </button>
                                            )
                                          )}
                                          {filteredInterestOptions.length ===
                                            0 && (
                                            <div className="discussed-treatments-interest-empty">
                                              No matches. Select
                                              &quot;Other&quot; for custom.
                                            </div>
                                          )}
                                        </div>
                                      </>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Treatments: each treatment with product options shows product/type right below */}
                        {(addMode === "goal" && form.interest) ||
                        (addMode === "finding" &&
                          selectedFindings.length > 0) ? (
                          <div className="discussed-treatments-treatment-options-block">
                            <h3 className="discussed-treatments-form-title discussed-treatments-form-title-step2">
                              Treatment options
                            </h3>
                            <p className="discussed-treatments-form-hint discussed-treatments-treatments-subheading">
                              {addMode === "goal"
                                ? "Optional — select one"
                                : "Optional — check any that apply"}
                            </p>
                            <div
                              className="discussed-treatments-treatments-with-products"
                              role="group"
                              aria-label="Treatments discussed"
                            >
                              {addMode === "goal" ? (
                                <>
                                  {/* Single full row: all treatment options (one per interest) */}
                                  <div className="discussed-treatments-chip-row">
                                    {treatmentsForTopic.map((name) => {
                                      const isSelected =
                                        form.selectedTreatments[0] === name;
                                      return (
                                        <label
                                          key={name}
                                          className={`discussed-treatments-prefill-chip discussed-treatments-treatment-chip ${
                                            isSelected ? "selected" : ""
                                          }`}
                                        >
                                          <input
                                            type="radio"
                                            name="treatment-goal"
                                            checked={isSelected}
                                            onChange={() =>
                                              selectTreatmentGoal(name)
                                            }
                                            className="discussed-treatments-radio-input"
                                          />
                                          <span className="discussed-treatments-checkbox-label">
                                            {name}
                                          </span>
                                        </label>
                                      );
                                    })}
                                    <label
                                      className={`discussed-treatments-prefill-chip discussed-treatments-topic-chip other-chip ${
                                        form.selectedTreatments[0] ===
                                        OTHER_TREATMENT_LABEL
                                          ? "selected"
                                          : ""
                                      }`}
                                    >
                                      <input
                                        type="radio"
                                        name="treatment-goal"
                                        checked={
                                          form.selectedTreatments[0] ===
                                          OTHER_TREATMENT_LABEL
                                        }
                                        onChange={() =>
                                          setForm((f) => ({
                                            ...f,
                                            selectedTreatments: [
                                              f.selectedTreatments[0] ===
                                              OTHER_TREATMENT_LABEL
                                                ? ""
                                                : OTHER_TREATMENT_LABEL,
                                            ].filter(Boolean),
                                            otherTreatment:
                                              f.selectedTreatments[0] ===
                                              OTHER_TREATMENT_LABEL
                                                ? ""
                                                : f.otherTreatment,
                                          }))
                                        }
                                        className="discussed-treatments-radio-input"
                                      />
                                      <span className="discussed-treatments-checkbox-label">
                                        {OTHER_TREATMENT_LABEL}
                                      </span>
                                    </label>
                                  </div>
                                  {/* Additional selections below the row: Other input, or product/type + detected issues */}
                                  <div className="discussed-treatments-goal-below-row">
                                    {form.selectedTreatments[0] ===
                                      OTHER_TREATMENT_LABEL && (
                                      <input
                                        type="text"
                                        placeholder="Type treatment name"
                                        value={form.otherTreatment}
                                        onChange={(e) =>
                                          setForm((f) => ({
                                            ...f,
                                            otherTreatment: e.target.value,
                                          }))
                                        }
                                        className="discussed-treatments-other-treatment-inline-input"
                                        aria-label="Other treatment name"
                                      />
                                    )}
                                    {form.selectedTreatments[0] &&
                                      form.selectedTreatments[0] !==
                                        OTHER_TREATMENT_LABEL &&
                                      (() => {
                                        const name = form.selectedTreatments[0];
                                        const hasProductOptions =
                                          (TREATMENT_PRODUCT_OPTIONS[name]
                                            ?.length ?? 0) > 0;
                                        const issues =
                                          getDetectedIssuesForTreatment(
                                            name,
                                            form.interest ?? ""
                                          );
                                        const treatment = name;
                                        const opts =
                                          TREATMENT_PRODUCT_OPTIONS[
                                            treatment
                                          ] ?? [];
                                        const fullList = opts.filter(
                                          (p) => p !== OTHER_PRODUCT_LABEL
                                        );
                                        const recommended =
                                          getRecommendedProducts(
                                            treatment,
                                            productContextString
                                          );
                                        const selected =
                                          form.treatmentProducts[treatment] ??
                                          (treatment === "Skincare"
                                            ? form.skincareProduct
                                            : "");
                                        const otherVal =
                                          form.treatmentProductOther[
                                            treatment
                                          ] ??
                                          (treatment === "Skincare"
                                            ? form.skincareProductOther
                                            : "");
                                        const sectionTitle =
                                          treatment === "Skincare"
                                            ? "Product"
                                            : "Type";
                                        const showSeeAll =
                                          openProductSearchFor === treatment;
                                        const q = productSearchQuery
                                          .trim()
                                          .toLowerCase();
                                        const searchFilteredList = q
                                          ? fullList.filter((p) =>
                                              p.toLowerCase().includes(q)
                                            )
                                          : fullList;
                                        return (
                                          <div className="discussed-treatments-treatment-product-section">
                                            {hasProductOptions && (
                                              <div className="discussed-treatments-product-inline">
                                                <span className="discussed-treatments-product-inline-label">
                                                  {sectionTitle} (optional)
                                                </span>
                                                {treatment === "Skincare" ? (
                                                  <div
                                                    className="discussed-treatments-product-carousel"
                                                    role="group"
                                                    aria-label={`Select ${sectionTitle.toLowerCase()} (multiple)`}
                                                  >
                                                    <div className="discussed-treatments-product-carousel-track">
                                                      {fullList.map((p) => {
                                                        const selectedList =
                                                          form
                                                            .selectedProductsByTreatment[
                                                            treatment
                                                          ] ?? [];
                                                        const isChecked =
                                                          selectedList.includes(
                                                            p
                                                          );
                                                        return (
                                                          <label
                                                            key={p}
                                                            className={`discussed-treatments-product-carousel-item ${
                                                              isChecked
                                                                ? "selected"
                                                                : ""
                                                            } ${
                                                              p ===
                                                              OTHER_PRODUCT_LABEL
                                                                ? "other-chip"
                                                                : ""
                                                            }`}
                                                          >
                                                            <input
                                                              type="checkbox"
                                                              checked={
                                                                isChecked
                                                              }
                                                              onChange={() => {
                                                                const current =
                                                                  form
                                                                    .selectedProductsByTreatment[
                                                                    treatment
                                                                  ] ?? [];
                                                                setForm(
                                                                  (f) => ({
                                                                    ...f,
                                                                    selectedProductsByTreatment:
                                                                      {
                                                                        ...f.selectedProductsByTreatment,
                                                                        [treatment]:
                                                                          isChecked
                                                                            ? current.filter(
                                                                                (
                                                                                  x
                                                                                ) =>
                                                                                  x !==
                                                                                  p
                                                                              )
                                                                            : [
                                                                                ...current,
                                                                                p,
                                                                              ],
                                                                      },
                                                                    ...(p ===
                                                                      OTHER_PRODUCT_LABEL &&
                                                                    !isChecked
                                                                      ? {
                                                                          treatmentProductOther:
                                                                            {
                                                                              ...f.treatmentProductOther,
                                                                              [treatment]:
                                                                                "",
                                                                            },
                                                                          skincareProductOther:
                                                                            "",
                                                                        }
                                                                      : {}),
                                                                  })
                                                                );
                                                              }}
                                                              className="discussed-treatments-checkbox-input"
                                                            />
                                                            <div
                                                              className="discussed-treatments-product-carousel-image"
                                                              aria-hidden
                                                            />
                                                            <span className="discussed-treatments-product-carousel-label">
                                                              {p}
                                                            </span>
                                                          </label>
                                                        );
                                                      })}
                                                    </div>
                                                  </div>
                                                ) : treatment === "Laser" ? (
                                                  <div
                                                    className="discussed-treatments-product-carousel"
                                                    role="group"
                                                    aria-label={`Select ${sectionTitle.toLowerCase()}`}
                                                  >
                                                    <div className="discussed-treatments-product-carousel-track">
                                                      {fullList.map((p) => {
                                                        const isSelectedRec =
                                                          selected === p;
                                                        return (
                                                          <label
                                                            key={p}
                                                            className={`discussed-treatments-product-carousel-item discussed-treatments-product-text-only ${
                                                              isSelectedRec
                                                                ? "selected"
                                                                : ""
                                                            } ${
                                                              p ===
                                                              OTHER_PRODUCT_LABEL
                                                                ? "other-chip"
                                                                : ""
                                                            }`}
                                                          >
                                                            <input
                                                              type="radio"
                                                              name={`product-rec-goal-${treatment}`}
                                                              checked={
                                                                isSelectedRec
                                                              }
                                                              onChange={() =>
                                                                setForm(
                                                                  (f) => ({
                                                                    ...f,
                                                                    treatmentProducts:
                                                                      {
                                                                        ...f.treatmentProducts,
                                                                        [treatment]:
                                                                          p,
                                                                      },
                                                                    treatmentProductOther:
                                                                      {
                                                                        ...f.treatmentProductOther,
                                                                        [treatment]:
                                                                          p ===
                                                                          OTHER_PRODUCT_LABEL
                                                                            ? f
                                                                                .treatmentProductOther[
                                                                                treatment
                                                                              ] ??
                                                                              ""
                                                                            : "",
                                                                      },
                                                                  })
                                                                )
                                                              }
                                                              className="discussed-treatments-checkbox-input"
                                                            />
                                                            <div
                                                              className="discussed-treatments-product-carousel-image"
                                                              aria-hidden
                                                            />
                                                            <span className="discussed-treatments-product-carousel-label">
                                                              {p}
                                                            </span>
                                                          </label>
                                                        );
                                                      })}
                                                      {opts.includes(
                                                        OTHER_PRODUCT_LABEL
                                                      ) && (
                                                        <label
                                                          className={`discussed-treatments-product-carousel-item discussed-treatments-product-text-only ${
                                                            selected ===
                                                            OTHER_PRODUCT_LABEL
                                                              ? "selected"
                                                              : ""
                                                          } other-chip`}
                                                        >
                                                          <input
                                                            type="radio"
                                                            name={`product-rec-goal-${treatment}`}
                                                            checked={
                                                              selected ===
                                                              OTHER_PRODUCT_LABEL
                                                            }
                                                            onChange={() =>
                                                              setForm((f) => ({
                                                                ...f,
                                                                treatmentProducts:
                                                                  {
                                                                    ...f.treatmentProducts,
                                                                    [treatment]:
                                                                      OTHER_PRODUCT_LABEL,
                                                                  },
                                                                treatmentProductOther:
                                                                  {
                                                                    ...f.treatmentProductOther,
                                                                    [treatment]:
                                                                      f
                                                                        .treatmentProductOther[
                                                                        treatment
                                                                      ] ?? "",
                                                                  },
                                                              }))
                                                            }
                                                            className="discussed-treatments-checkbox-input"
                                                          />
                                                          <div
                                                            className="discussed-treatments-product-carousel-image"
                                                            aria-hidden
                                                          />
                                                          <span className="discussed-treatments-product-carousel-label">
                                                            {
                                                              OTHER_PRODUCT_LABEL
                                                            }
                                                          </span>
                                                        </label>
                                                      )}
                                                    </div>
                                                  </div>
                                                ) : (
                                                  <>
                                                    {(() => {
                                                      const displayList =
                                                        recommended.length > 0
                                                          ? recommended
                                                          : [
                                                              ...fullList,
                                                              ...(opts.includes(
                                                                OTHER_PRODUCT_LABEL
                                                              )
                                                                ? [
                                                                    OTHER_PRODUCT_LABEL,
                                                                  ]
                                                                : []),
                                                            ];
                                                      return displayList.length >
                                                        0 ? (
                                                        <div
                                                          className="discussed-treatments-chip-row"
                                                          role="group"
                                                          aria-label={
                                                            recommended.length >
                                                            0
                                                              ? `Suggested ${sectionTitle}`
                                                              : `${sectionTitle} (optional)`
                                                          }
                                                        >
                                                          {displayList.map(
                                                            (p) => (
                                                              <label
                                                                key={p}
                                                                className={`discussed-treatments-prefill-chip ${
                                                                  selected === p
                                                                    ? "selected"
                                                                    : ""
                                                                }`}
                                                              >
                                                                <input
                                                                  type="radio"
                                                                  name={`product-rec-goal-${treatment}`}
                                                                  checked={
                                                                    selected ===
                                                                    p
                                                                  }
                                                                  onChange={() =>
                                                                    setForm(
                                                                      (f) => ({
                                                                        ...f,
                                                                        treatmentProducts:
                                                                          {
                                                                            ...f.treatmentProducts,
                                                                            [treatment]:
                                                                              p,
                                                                          },
                                                                        treatmentProductOther:
                                                                          {
                                                                            ...f.treatmentProductOther,
                                                                            [treatment]:
                                                                              "",
                                                                          },
                                                                      })
                                                                    )
                                                                  }
                                                                  className="discussed-treatments-radio-input"
                                                                />
                                                                {p}
                                                              </label>
                                                            )
                                                          )}
                                                        </div>
                                                      ) : null;
                                                    })()}
                                                    {selected &&
                                                      selected !==
                                                        OTHER_PRODUCT_LABEL &&
                                                      !(
                                                        recommended.length > 0
                                                          ? recommended
                                                          : fullList
                                                      ).includes(selected) && (
                                                        <div className="discussed-treatments-product-selected-other">
                                                          <span className="discussed-treatments-product-selected-label">
                                                            Selected: {selected}
                                                          </span>
                                                          <button
                                                            type="button"
                                                            className="discussed-treatments-product-change-btn"
                                                            onClick={() => {
                                                              setOpenProductSearchFor(
                                                                treatment
                                                              );
                                                              setProductSearchQuery(
                                                                ""
                                                              );
                                                            }}
                                                          >
                                                            Change
                                                          </button>
                                                        </div>
                                                      )}
                                                    {!showSeeAll ? (
                                                      <button
                                                        type="button"
                                                        className="discussed-treatments-see-all-options-btn"
                                                        onClick={() => {
                                                          setOpenProductSearchFor(
                                                            treatment
                                                          );
                                                          setProductSearchQuery(
                                                            ""
                                                          );
                                                        }}
                                                      >
                                                        {SEE_ALL_OPTIONS_LABEL}
                                                      </button>
                                                    ) : null}
                                                  </>
                                                )}
                                                {treatment === "Skincare" &&
                                                  (form
                                                    .selectedProductsByTreatment[
                                                    treatment
                                                  ]?.length ?? 0) > 0 && (
                                                    <div className="discussed-treatments-product-selected-other">
                                                      <span className="discussed-treatments-product-selected-label">
                                                        Selected:{" "}
                                                        {(
                                                          form
                                                            .selectedProductsByTreatment[
                                                            treatment
                                                          ] ?? []
                                                        )
                                                          .map((p) =>
                                                            p ===
                                                            OTHER_PRODUCT_LABEL
                                                              ? (
                                                                  form
                                                                    .treatmentProductOther[
                                                                    treatment
                                                                  ] ||
                                                                  form.skincareProductOther ||
                                                                  OTHER_PRODUCT_LABEL
                                                                ).trim() ||
                                                                OTHER_PRODUCT_LABEL
                                                              : p
                                                          )
                                                          .join(", ")}
                                                      </span>
                                                    </div>
                                                  )}
                                                {((treatment === "Skincare" &&
                                                  (
                                                    form
                                                      .selectedProductsByTreatment[
                                                      treatment
                                                    ] ?? []
                                                  ).includes(
                                                    OTHER_PRODUCT_LABEL
                                                  )) ||
                                                  (treatment === "Laser" &&
                                                    selected ===
                                                      OTHER_PRODUCT_LABEL) ||
                                                  (treatment !== "Skincare" &&
                                                    treatment !== "Laser" &&
                                                    selected ===
                                                      OTHER_PRODUCT_LABEL)) && (
                                                  <div className="discussed-treatments-product-other-input-wrap">
                                                    <input
                                                      type="text"
                                                      placeholder="Specify product or device"
                                                      value={otherVal}
                                                      onChange={(e) =>
                                                        setForm((f) => ({
                                                          ...f,
                                                          treatmentProductOther:
                                                            {
                                                              ...f.treatmentProductOther,
                                                              [treatment]:
                                                                e.target.value,
                                                            },
                                                          ...(treatment ===
                                                          "Skincare"
                                                            ? {
                                                                skincareProductOther:
                                                                  e.target
                                                                    .value,
                                                              }
                                                            : {}),
                                                        }))
                                                      }
                                                      className="discussed-treatments-prefill-other-input"
                                                    />
                                                  </div>
                                                )}
                                                {treatment !== "Skincare" &&
                                                  treatment !== "Laser" &&
                                                  showSeeAll &&
                                                  (isNarrowScreen ? (
                                                    <div className="discussed-treatments-product-search-wrap">
                                                      <div className="discussed-treatments-mobile-select-wrap">
                                                        <select
                                                          className="discussed-treatments-mobile-select"
                                                          value={selected || ""}
                                                          onChange={(e) => {
                                                            const p =
                                                              e.target.value;
                                                            setForm((f) => ({
                                                              ...f,
                                                              treatmentProducts:
                                                                {
                                                                  ...f.treatmentProducts,
                                                                  [treatment]:
                                                                    p,
                                                                },
                                                              treatmentProductOther:
                                                                {
                                                                  ...f.treatmentProductOther,
                                                                  [treatment]:
                                                                    "",
                                                                },
                                                              ...(treatment ===
                                                              "Skincare"
                                                                ? {
                                                                    skincareProduct:
                                                                      p,
                                                                    skincareProductOther:
                                                                      "",
                                                                  }
                                                                : {}),
                                                            }));
                                                            setOpenProductSearchFor(
                                                              null
                                                            );
                                                            setProductSearchQuery(
                                                              ""
                                                            );
                                                          }}
                                                          aria-label={`Select ${sectionTitle.toLowerCase()}`}
                                                        >
                                                          <option value="">
                                                            Select or skip…
                                                          </option>
                                                          {fullList.map((p) => (
                                                            <option
                                                              key={p}
                                                              value={p}
                                                            >
                                                              {p}
                                                            </option>
                                                          ))}
                                                          {opts.includes(
                                                            OTHER_PRODUCT_LABEL
                                                          ) && (
                                                            <option
                                                              value={
                                                                OTHER_PRODUCT_LABEL
                                                              }
                                                            >
                                                              {
                                                                OTHER_PRODUCT_LABEL
                                                              }
                                                            </option>
                                                          )}
                                                        </select>
                                                      </div>
                                                      <button
                                                        type="button"
                                                        className="discussed-treatments-interest-back-btn"
                                                        onClick={() => {
                                                          setOpenProductSearchFor(
                                                            null
                                                          );
                                                          setProductSearchQuery(
                                                            ""
                                                          );
                                                        }}
                                                      >
                                                        ← Back
                                                      </button>
                                                    </div>
                                                  ) : (
                                                    <div className="discussed-treatments-product-search-wrap">
                                                      <input
                                                        type="text"
                                                        className="discussed-treatments-interest-search-input"
                                                        placeholder="Search options..."
                                                        value={
                                                          productSearchQuery
                                                        }
                                                        onChange={(e) =>
                                                          setProductSearchQuery(
                                                            e.target.value
                                                          )
                                                        }
                                                        autoFocus
                                                      />
                                                      <button
                                                        type="button"
                                                        className="discussed-treatments-interest-back-btn"
                                                        onClick={() => {
                                                          setOpenProductSearchFor(
                                                            null
                                                          );
                                                          setProductSearchQuery(
                                                            ""
                                                          );
                                                        }}
                                                      >
                                                        ← Back
                                                      </button>
                                                      <div
                                                        className="discussed-treatments-interest-dropdown discussed-treatments-findings-dropdown"
                                                        role="listbox"
                                                      >
                                                        {searchFilteredList.map(
                                                          (p) => (
                                                            <button
                                                              key={p}
                                                              type="button"
                                                              role="option"
                                                              className={`discussed-treatments-interest-option ${
                                                                selected === p
                                                                  ? "selected"
                                                                  : ""
                                                              }`}
                                                              onClick={() => {
                                                                setForm(
                                                                  (f) => ({
                                                                    ...f,
                                                                    treatmentProducts:
                                                                      {
                                                                        ...f.treatmentProducts,
                                                                        [treatment]:
                                                                          p,
                                                                      },
                                                                    treatmentProductOther:
                                                                      {
                                                                        ...f.treatmentProductOther,
                                                                        [treatment]:
                                                                          "",
                                                                      },
                                                                    ...(treatment ===
                                                                    "Skincare"
                                                                      ? {
                                                                          skincareProduct:
                                                                            p,
                                                                          skincareProductOther:
                                                                            "",
                                                                        }
                                                                      : {}),
                                                                  })
                                                                );
                                                                setOpenProductSearchFor(
                                                                  null
                                                                );
                                                                setProductSearchQuery(
                                                                  ""
                                                                );
                                                              }}
                                                            >
                                                              {p}
                                                            </button>
                                                          )
                                                        )}
                                                        {opts.includes(
                                                          OTHER_PRODUCT_LABEL
                                                        ) && (
                                                          <button
                                                            type="button"
                                                            role="option"
                                                            className={`discussed-treatments-interest-option ${
                                                              selected ===
                                                              OTHER_PRODUCT_LABEL
                                                                ? "selected"
                                                                : ""
                                                            }`}
                                                            onClick={() => {
                                                              setForm((f) => ({
                                                                ...f,
                                                                treatmentProducts:
                                                                  {
                                                                    ...f.treatmentProducts,
                                                                    [treatment]:
                                                                      OTHER_PRODUCT_LABEL,
                                                                  },
                                                                ...(treatment ===
                                                                "Skincare"
                                                                  ? {
                                                                      skincareProduct:
                                                                        OTHER_PRODUCT_LABEL,
                                                                    }
                                                                  : {}),
                                                              }));
                                                              setOpenProductSearchFor(
                                                                null
                                                              );
                                                              setProductSearchQuery(
                                                                ""
                                                              );
                                                            }}
                                                          >
                                                            {
                                                              OTHER_PRODUCT_LABEL
                                                            }
                                                          </button>
                                                        )}
                                                        {searchFilteredList.length ===
                                                          0 &&
                                                          !opts.includes(
                                                            OTHER_PRODUCT_LABEL
                                                          ) && (
                                                            <div className="discussed-treatments-interest-empty">
                                                              No matches.
                                                            </div>
                                                          )}
                                                      </div>
                                                    </div>
                                                  ))}
                                                {selected ===
                                                  OTHER_PRODUCT_LABEL &&
                                                  treatment !== "Skincare" &&
                                                  treatment !== "Laser" && (
                                                    <div className="discussed-treatments-product-other-input-wrap">
                                                      <input
                                                        type="text"
                                                        placeholder="Specify (e.g. custom product)"
                                                        value={otherVal}
                                                        onChange={(e) =>
                                                          setForm((f) => ({
                                                            ...f,
                                                            treatmentProductOther:
                                                              {
                                                                ...f.treatmentProductOther,
                                                                [treatment]:
                                                                  e.target
                                                                    .value,
                                                              },
                                                            ...(treatment ===
                                                            "Skincare"
                                                              ? {
                                                                  skincareProductOther:
                                                                    e.target
                                                                      .value,
                                                                }
                                                              : {}),
                                                          }))
                                                        }
                                                        className="discussed-treatments-prefill-other-input"
                                                      />
                                                    </div>
                                                  )}
                                              </div>
                                            )}
                                            <div
                                              className="discussed-treatments-detected-issues-inline"
                                              role="group"
                                              aria-label={`Detected issues for ${name}`}
                                            >
                                              <span className="discussed-treatments-detected-issues-inline-label">
                                                Select the issues detected below
                                                that relate to this treatment:
                                              </span>
                                              {issues.length > 0 ? (
                                                <div
                                                  className="discussed-treatments-chip-row discussed-treatments-detected-issues-chips"
                                                  role="group"
                                                >
                                                  {issues.map((issue) => {
                                                    const selectedForTx =
                                                      form
                                                        .selectedFindingsByTreatment[
                                                        name
                                                      ] ?? issues;
                                                    const isIssueSelected =
                                                      selectedForTx.includes(
                                                        issue
                                                      );
                                                    return (
                                                      <label
                                                        key={issue}
                                                        className={`discussed-treatments-checkbox-chip discussed-treatments-treatment-chip ${
                                                          isIssueSelected
                                                            ? "selected"
                                                            : ""
                                                        }`}
                                                      >
                                                        <input
                                                          type="checkbox"
                                                          checked={
                                                            isIssueSelected
                                                          }
                                                          onChange={() => {
                                                            const current =
                                                              form
                                                                .selectedFindingsByTreatment[
                                                                name
                                                              ] ?? issues;
                                                            setForm((f) => ({
                                                              ...f,
                                                              selectedFindingsByTreatment:
                                                                {
                                                                  ...f.selectedFindingsByTreatment,
                                                                  [name]:
                                                                    isIssueSelected
                                                                      ? current.filter(
                                                                          (x) =>
                                                                            x !==
                                                                            issue
                                                                        )
                                                                      : [
                                                                          ...current,
                                                                          issue,
                                                                        ],
                                                                },
                                                            }));
                                                          }}
                                                          className="discussed-treatments-checkbox-input"
                                                        />
                                                        <span className="discussed-treatments-checkbox-label">
                                                          {issue}
                                                        </span>
                                                      </label>
                                                    );
                                                  })}
                                                </div>
                                              ) : (
                                                (() => {
                                                  const manualIssues =
                                                    getFindingsForTreatment(
                                                      name
                                                    ).length > 0
                                                      ? getFindingsForTreatment(
                                                          name
                                                        )
                                                      : ASSESSMENT_FINDINGS;
                                                  const selectedForTx =
                                                    form
                                                      .selectedFindingsByTreatment[
                                                      name
                                                    ] ?? [];
                                                  return (
                                                    <>
                                                      <p className="discussed-treatments-detected-issues-empty">
                                                        No detected issues below
                                                        relate to this
                                                        treatment. Select an
                                                        issue to treat with this
                                                        treatment:
                                                      </p>
                                                      {manualIssues.length >
                                                        0 && (
                                                        <div
                                                          className="discussed-treatments-chip-row discussed-treatments-detected-issues-chips"
                                                          role="group"
                                                        >
                                                          {manualIssues.map(
                                                            (issue) => {
                                                              const isIssueSelected =
                                                                selectedForTx.includes(
                                                                  issue
                                                                );
                                                              return (
                                                                <label
                                                                  key={issue}
                                                                  className={`discussed-treatments-checkbox-chip discussed-treatments-treatment-chip ${
                                                                    isIssueSelected
                                                                      ? "selected"
                                                                      : ""
                                                                  }`}
                                                                >
                                                                  <input
                                                                    type="checkbox"
                                                                    checked={
                                                                      isIssueSelected
                                                                    }
                                                                    onChange={() => {
                                                                      const current =
                                                                        form
                                                                          .selectedFindingsByTreatment[
                                                                          name
                                                                        ] ?? [];
                                                                      setForm(
                                                                        (
                                                                          f
                                                                        ) => ({
                                                                          ...f,
                                                                          selectedFindingsByTreatment:
                                                                            {
                                                                              ...f.selectedFindingsByTreatment,
                                                                              [name]:
                                                                                isIssueSelected
                                                                                  ? current.filter(
                                                                                      (
                                                                                        x
                                                                                      ) =>
                                                                                        x !==
                                                                                        issue
                                                                                    )
                                                                                  : [
                                                                                      ...current,
                                                                                      issue,
                                                                                    ],
                                                                            },
                                                                        })
                                                                      );
                                                                    }}
                                                                    className="discussed-treatments-checkbox-input"
                                                                  />
                                                                  <span className="discussed-treatments-checkbox-label">
                                                                    {issue}
                                                                  </span>
                                                                </label>
                                                              );
                                                            }
                                                          )}
                                                        </div>
                                                      )}
                                                    </>
                                                  );
                                                })()
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })()}
                                  </div>
                                </>
                              ) : (
                                <>
                                  {treatmentsForTopic.map((name) => {
                                    const hasProductOptions =
                                      (TREATMENT_PRODUCT_OPTIONS[name]
                                        ?.length ?? 0) > 0;
                                    const isSelected =
                                      form.selectedTreatments.includes(name);
                                    if (hasProductOptions) {
                                      const treatment = name;
                                      const opts =
                                        TREATMENT_PRODUCT_OPTIONS[treatment] ??
                                        [];
                                      const fullList = opts.filter(
                                        (p) => p !== OTHER_PRODUCT_LABEL
                                      );
                                      const recommended =
                                        getRecommendedProducts(
                                          treatment,
                                          productContextString
                                        );
                                      const selected =
                                        form.treatmentProducts[treatment] ??
                                        (treatment === "Skincare"
                                          ? form.skincareProduct
                                          : "");
                                      const otherVal =
                                        form.treatmentProductOther[treatment] ??
                                        (treatment === "Skincare"
                                          ? form.skincareProductOther
                                          : "");
                                      const sectionTitle =
                                        treatment === "Skincare"
                                          ? "Product"
                                          : "Type";
                                      const showSeeAll =
                                        openProductSearchFor === treatment;
                                      const q = productSearchQuery
                                        .trim()
                                        .toLowerCase();
                                      const searchFilteredList = q
                                        ? fullList.filter((p) =>
                                            p.toLowerCase().includes(q)
                                          )
                                        : fullList;
                                      return (
                                        <div
                                          key={name}
                                          className="discussed-treatments-treatment-block"
                                        >
                                          <label
                                            className={`discussed-treatments-checkbox-chip discussed-treatments-treatment-chip ${
                                              isSelected ? "selected" : ""
                                            }`}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isSelected}
                                              onChange={() =>
                                                toggleTreatment(name)
                                              }
                                              className="discussed-treatments-checkbox-input"
                                            />
                                            <span className="discussed-treatments-checkbox-label">
                                              {name}
                                            </span>
                                          </label>
                                          {isSelected && (
                                            <div className="discussed-treatments-product-inline">
                                              <span className="discussed-treatments-product-inline-label">
                                                {sectionTitle}
                                              </span>
                                              {treatment === "Skincare" ? (
                                                <div
                                                  className="discussed-treatments-product-carousel"
                                                  role="group"
                                                  aria-label={`Select ${sectionTitle.toLowerCase()} (multiple)`}
                                                >
                                                  <div className="discussed-treatments-product-carousel-track">
                                                    {fullList.map((p) => {
                                                      const selectedList =
                                                        form
                                                          .selectedProductsByTreatment[
                                                          treatment
                                                        ] ?? [];
                                                      const isChecked =
                                                        selectedList.includes(
                                                          p
                                                        );
                                                      return (
                                                        <label
                                                          key={p}
                                                          className={`discussed-treatments-product-carousel-item ${
                                                            isChecked
                                                              ? "selected"
                                                              : ""
                                                          } ${
                                                            p ===
                                                            OTHER_PRODUCT_LABEL
                                                              ? "other-chip"
                                                              : ""
                                                          }`}
                                                        >
                                                          <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => {
                                                              const current =
                                                                form
                                                                  .selectedProductsByTreatment[
                                                                  treatment
                                                                ] ?? [];
                                                              setForm((f) => ({
                                                                ...f,
                                                                selectedProductsByTreatment:
                                                                  {
                                                                    ...f.selectedProductsByTreatment,
                                                                    [treatment]:
                                                                      isChecked
                                                                        ? current.filter(
                                                                            (
                                                                              x
                                                                            ) =>
                                                                              x !==
                                                                              p
                                                                          )
                                                                        : [
                                                                            ...current,
                                                                            p,
                                                                          ],
                                                                  },
                                                                ...(p ===
                                                                  OTHER_PRODUCT_LABEL &&
                                                                !isChecked
                                                                  ? {
                                                                      treatmentProductOther:
                                                                        {
                                                                          ...f.treatmentProductOther,
                                                                          [treatment]:
                                                                            "",
                                                                        },
                                                                      skincareProductOther:
                                                                        "",
                                                                    }
                                                                  : {}),
                                                              }));
                                                            }}
                                                            className="discussed-treatments-checkbox-input"
                                                          />
                                                          <div
                                                            className="discussed-treatments-product-carousel-image"
                                                            aria-hidden
                                                          />
                                                          <span className="discussed-treatments-product-carousel-label">
                                                            {p}
                                                          </span>
                                                        </label>
                                                      );
                                                    })}
                                                  </div>
                                                </div>
                                              ) : treatment === "Laser" ? (
                                                <div
                                                  className="discussed-treatments-product-carousel"
                                                  role="group"
                                                  aria-label={`Select ${sectionTitle.toLowerCase()}`}
                                                >
                                                  <div className="discussed-treatments-product-carousel-track">
                                                    {fullList.map((p) => {
                                                      const isSelectedRec =
                                                        selected === p;
                                                      return (
                                                        <label
                                                          key={p}
                                                          className={`discussed-treatments-product-carousel-item discussed-treatments-product-text-only ${
                                                            isSelectedRec
                                                              ? "selected"
                                                              : ""
                                                          } ${
                                                            p ===
                                                            OTHER_PRODUCT_LABEL
                                                              ? "other-chip"
                                                              : ""
                                                          }`}
                                                        >
                                                          <input
                                                            type="radio"
                                                            name={`product-rec-${treatment}`}
                                                            checked={
                                                              isSelectedRec
                                                            }
                                                            onChange={() =>
                                                              setForm((f) => ({
                                                                ...f,
                                                                treatmentProducts:
                                                                  {
                                                                    ...f.treatmentProducts,
                                                                    [treatment]:
                                                                      p,
                                                                  },
                                                                treatmentProductOther:
                                                                  {
                                                                    ...f.treatmentProductOther,
                                                                    [treatment]:
                                                                      p ===
                                                                      OTHER_PRODUCT_LABEL
                                                                        ? f
                                                                            .treatmentProductOther[
                                                                            treatment
                                                                          ] ??
                                                                          ""
                                                                        : "",
                                                                  },
                                                              }))
                                                            }
                                                            className="discussed-treatments-checkbox-input"
                                                          />
                                                          <div
                                                            className="discussed-treatments-product-carousel-image"
                                                            aria-hidden
                                                          />
                                                          <span className="discussed-treatments-product-carousel-label">
                                                            {p}
                                                          </span>
                                                        </label>
                                                      );
                                                    })}
                                                    {opts.includes(
                                                      OTHER_PRODUCT_LABEL
                                                    ) && (
                                                      <label
                                                        className={`discussed-treatments-product-carousel-item discussed-treatments-product-text-only ${
                                                          selected ===
                                                          OTHER_PRODUCT_LABEL
                                                            ? "selected"
                                                            : ""
                                                        } other-chip`}
                                                      >
                                                        <input
                                                          type="radio"
                                                          name={`product-rec-${treatment}`}
                                                          checked={
                                                            selected ===
                                                            OTHER_PRODUCT_LABEL
                                                          }
                                                          onChange={() =>
                                                            setForm((f) => ({
                                                              ...f,
                                                              treatmentProducts:
                                                                {
                                                                  ...f.treatmentProducts,
                                                                  [treatment]:
                                                                    OTHER_PRODUCT_LABEL,
                                                                },
                                                              treatmentProductOther:
                                                                {
                                                                  ...f.treatmentProductOther,
                                                                  [treatment]:
                                                                    f
                                                                      .treatmentProductOther[
                                                                      treatment
                                                                    ] ?? "",
                                                                },
                                                            }))
                                                          }
                                                          className="discussed-treatments-checkbox-input"
                                                        />
                                                        <div
                                                          className="discussed-treatments-product-carousel-image"
                                                          aria-hidden
                                                        />
                                                        <span className="discussed-treatments-product-carousel-label">
                                                          {OTHER_PRODUCT_LABEL}
                                                        </span>
                                                      </label>
                                                    )}
                                                  </div>
                                                </div>
                                              ) : (
                                                <>
                                                  {recommended.length > 0 && (
                                                    <div
                                                      className="discussed-treatments-chip-row"
                                                      role="group"
                                                      aria-label={`Suggested ${sectionTitle}`}
                                                    >
                                                      {recommended.map((p) => (
                                                        <label
                                                          key={p}
                                                          className={`discussed-treatments-prefill-chip ${
                                                            selected === p
                                                              ? "selected"
                                                              : ""
                                                          }`}
                                                        >
                                                          <input
                                                            type="radio"
                                                            name={`product-rec-${treatment}`}
                                                            checked={
                                                              selected === p
                                                            }
                                                            onChange={() =>
                                                              setForm((f) => ({
                                                                ...f,
                                                                treatmentProducts:
                                                                  {
                                                                    ...f.treatmentProducts,
                                                                    [treatment]:
                                                                      p,
                                                                  },
                                                                treatmentProductOther:
                                                                  {
                                                                    ...f.treatmentProductOther,
                                                                    [treatment]:
                                                                      "",
                                                                  },
                                                              }))
                                                            }
                                                            className="discussed-treatments-radio-input"
                                                          />
                                                          {p}
                                                        </label>
                                                      ))}
                                                    </div>
                                                  )}
                                                  {selected &&
                                                    selected !==
                                                      OTHER_PRODUCT_LABEL &&
                                                    !recommended.includes(
                                                      selected
                                                    ) && (
                                                      <div className="discussed-treatments-product-selected-other">
                                                        <span className="discussed-treatments-product-selected-label">
                                                          Selected: {selected}
                                                        </span>
                                                        <button
                                                          type="button"
                                                          className="discussed-treatments-product-change-btn"
                                                          onClick={() => {
                                                            setOpenProductSearchFor(
                                                              treatment
                                                            );
                                                            setProductSearchQuery(
                                                              ""
                                                            );
                                                          }}
                                                        >
                                                          Change
                                                        </button>
                                                      </div>
                                                    )}
                                                  {!showSeeAll ? (
                                                    <button
                                                      type="button"
                                                      className="discussed-treatments-see-all-options-btn"
                                                      onClick={() => {
                                                        setOpenProductSearchFor(
                                                          treatment
                                                        );
                                                        setProductSearchQuery(
                                                          ""
                                                        );
                                                      }}
                                                    >
                                                      {SEE_ALL_OPTIONS_LABEL}
                                                    </button>
                                                  ) : null}
                                                </>
                                              )}
                                              {treatment === "Skincare" &&
                                                (form
                                                  .selectedProductsByTreatment[
                                                  treatment
                                                ]?.length ?? 0) > 0 && (
                                                  <div className="discussed-treatments-product-selected-other">
                                                    <span className="discussed-treatments-product-selected-label">
                                                      Selected:{" "}
                                                      {(
                                                        form
                                                          .selectedProductsByTreatment[
                                                          treatment
                                                        ] ?? []
                                                      )
                                                        .map((p) =>
                                                          p ===
                                                          OTHER_PRODUCT_LABEL
                                                            ? (
                                                                form
                                                                  .treatmentProductOther[
                                                                  treatment
                                                                ] ||
                                                                form.skincareProductOther ||
                                                                OTHER_PRODUCT_LABEL
                                                              ).trim() ||
                                                              OTHER_PRODUCT_LABEL
                                                            : p
                                                        )
                                                        .join(", ")}
                                                    </span>
                                                  </div>
                                                )}
                                              {((treatment === "Skincare" &&
                                                (
                                                  form
                                                    .selectedProductsByTreatment[
                                                    treatment
                                                  ] ?? []
                                                ).includes(
                                                  OTHER_PRODUCT_LABEL
                                                )) ||
                                                (treatment === "Laser" &&
                                                  selected ===
                                                    OTHER_PRODUCT_LABEL)) && (
                                                <div className="discussed-treatments-product-other-input-wrap">
                                                  <input
                                                    type="text"
                                                    placeholder="Specify product or device"
                                                    value={otherVal}
                                                    onChange={(e) =>
                                                      setForm((f) => ({
                                                        ...f,
                                                        treatmentProductOther: {
                                                          ...f.treatmentProductOther,
                                                          [treatment]:
                                                            e.target.value,
                                                        },
                                                        ...(treatment ===
                                                        "Skincare"
                                                          ? {
                                                              skincareProductOther:
                                                                e.target.value,
                                                            }
                                                          : {}),
                                                      }))
                                                    }
                                                    className="discussed-treatments-prefill-other-input"
                                                  />
                                                </div>
                                              )}
                                              {treatment !== "Skincare" &&
                                              treatment !== "Laser" &&
                                              showSeeAll ? (
                                                isNarrowScreen ? (
                                                  <div className="discussed-treatments-product-search-wrap">
                                                    <div className="discussed-treatments-mobile-select-wrap">
                                                      <select
                                                        className="discussed-treatments-mobile-select"
                                                        value={selected || ""}
                                                        onChange={(e) => {
                                                          const p =
                                                            e.target.value;
                                                          setForm((f) => ({
                                                            ...f,
                                                            treatmentProducts: {
                                                              ...f.treatmentProducts,
                                                              [treatment]: p,
                                                            },
                                                            treatmentProductOther:
                                                              {
                                                                ...f.treatmentProductOther,
                                                                [treatment]: "",
                                                              },
                                                            ...(treatment ===
                                                            "Skincare"
                                                              ? {
                                                                  skincareProduct:
                                                                    p,
                                                                  skincareProductOther:
                                                                    "",
                                                                }
                                                              : {}),
                                                          }));
                                                          setOpenProductSearchFor(
                                                            null
                                                          );
                                                          setProductSearchQuery(
                                                            ""
                                                          );
                                                        }}
                                                        aria-label={`Select ${sectionTitle.toLowerCase()}`}
                                                      >
                                                        <option value="">
                                                          Select or skip…
                                                        </option>
                                                        {fullList.map((p) => (
                                                          <option
                                                            key={p}
                                                            value={p}
                                                          >
                                                            {p}
                                                          </option>
                                                        ))}
                                                        {opts.includes(
                                                          OTHER_PRODUCT_LABEL
                                                        ) && (
                                                          <option
                                                            value={
                                                              OTHER_PRODUCT_LABEL
                                                            }
                                                          >
                                                            {
                                                              OTHER_PRODUCT_LABEL
                                                            }
                                                          </option>
                                                        )}
                                                      </select>
                                                    </div>
                                                    <button
                                                      type="button"
                                                      className="discussed-treatments-interest-back-btn"
                                                      onClick={() => {
                                                        setOpenProductSearchFor(
                                                          null
                                                        );
                                                        setProductSearchQuery(
                                                          ""
                                                        );
                                                      }}
                                                    >
                                                      ← Back
                                                    </button>
                                                  </div>
                                                ) : (
                                                  <div className="discussed-treatments-product-search-wrap">
                                                    <input
                                                      type="text"
                                                      className="discussed-treatments-interest-search-input"
                                                      placeholder="Search options..."
                                                      value={productSearchQuery}
                                                      onChange={(e) =>
                                                        setProductSearchQuery(
                                                          e.target.value
                                                        )
                                                      }
                                                      autoFocus
                                                    />
                                                    <button
                                                      type="button"
                                                      className="discussed-treatments-interest-back-btn"
                                                      onClick={() => {
                                                        setOpenProductSearchFor(
                                                          null
                                                        );
                                                        setProductSearchQuery(
                                                          ""
                                                        );
                                                      }}
                                                    >
                                                      ← Back
                                                    </button>
                                                    <div
                                                      className="discussed-treatments-interest-dropdown discussed-treatments-findings-dropdown"
                                                      role="listbox"
                                                    >
                                                      {searchFilteredList.map(
                                                        (p) => (
                                                          <button
                                                            key={p}
                                                            type="button"
                                                            role="option"
                                                            className={`discussed-treatments-interest-option ${
                                                              selected === p
                                                                ? "selected"
                                                                : ""
                                                            }`}
                                                            onClick={() => {
                                                              setForm((f) => ({
                                                                ...f,
                                                                treatmentProducts:
                                                                  {
                                                                    ...f.treatmentProducts,
                                                                    [treatment]:
                                                                      p,
                                                                  },
                                                                treatmentProductOther:
                                                                  {
                                                                    ...f.treatmentProductOther,
                                                                    [treatment]:
                                                                      "",
                                                                  },
                                                                ...(treatment ===
                                                                "Skincare"
                                                                  ? {
                                                                      skincareProduct:
                                                                        p,
                                                                      skincareProductOther:
                                                                        "",
                                                                    }
                                                                  : {}),
                                                              }));
                                                              setOpenProductSearchFor(
                                                                null
                                                              );
                                                              setProductSearchQuery(
                                                                ""
                                                              );
                                                            }}
                                                          >
                                                            {p}
                                                          </button>
                                                        )
                                                      )}
                                                      {opts.includes(
                                                        OTHER_PRODUCT_LABEL
                                                      ) && (
                                                        <button
                                                          type="button"
                                                          role="option"
                                                          className={`discussed-treatments-interest-option ${
                                                            selected ===
                                                            OTHER_PRODUCT_LABEL
                                                              ? "selected"
                                                              : ""
                                                          }`}
                                                          onClick={() => {
                                                            setForm((f) => ({
                                                              ...f,
                                                              treatmentProducts:
                                                                {
                                                                  ...f.treatmentProducts,
                                                                  [treatment]:
                                                                    OTHER_PRODUCT_LABEL,
                                                                },
                                                              ...(treatment ===
                                                              "Skincare"
                                                                ? {
                                                                    skincareProduct:
                                                                      OTHER_PRODUCT_LABEL,
                                                                  }
                                                                : {}),
                                                            }));
                                                            setOpenProductSearchFor(
                                                              null
                                                            );
                                                            setProductSearchQuery(
                                                              ""
                                                            );
                                                          }}
                                                        >
                                                          {OTHER_PRODUCT_LABEL}
                                                        </button>
                                                      )}
                                                      {searchFilteredList.length ===
                                                        0 &&
                                                        !opts.includes(
                                                          OTHER_PRODUCT_LABEL
                                                        ) && (
                                                          <div className="discussed-treatments-interest-empty">
                                                            No matches.
                                                          </div>
                                                        )}
                                                    </div>
                                                  </div>
                                                )
                                              ) : null}
                                              {selected ===
                                                OTHER_PRODUCT_LABEL &&
                                                treatment !== "Skincare" &&
                                                treatment !== "Laser" && (
                                                  <div className="discussed-treatments-product-other-input-wrap">
                                                    <input
                                                      type="text"
                                                      placeholder="Specify (e.g. custom product)"
                                                      value={otherVal}
                                                      onChange={(e) =>
                                                        setForm((f) => ({
                                                          ...f,
                                                          treatmentProductOther:
                                                            {
                                                              ...f.treatmentProductOther,
                                                              [treatment]:
                                                                e.target.value,
                                                            },
                                                          ...(treatment ===
                                                          "Skincare"
                                                            ? {
                                                                skincareProductOther:
                                                                  e.target
                                                                    .value,
                                                              }
                                                            : {}),
                                                        }))
                                                      }
                                                      className="discussed-treatments-prefill-other-input"
                                                    />
                                                  </div>
                                                )}
                                            </div>
                                          )}
                                          {isSelected &&
                                            (addMode as AddByMode) === "goal" &&
                                            (() => {
                                              const issues =
                                                getDetectedIssuesForTreatment(
                                                  name,
                                                  form.interest ?? ""
                                                );
                                              const selected =
                                                form
                                                  .selectedFindingsByTreatment[
                                                  name
                                                ] ?? issues;
                                              return (
                                                <div
                                                  className="discussed-treatments-detected-issues-inline"
                                                  role="group"
                                                  aria-label={`Detected issues for ${name}`}
                                                >
                                                  <span className="discussed-treatments-detected-issues-inline-label">
                                                    Select the issues detected
                                                    below that relate to this
                                                    treatment:
                                                  </span>
                                                  {issues.length > 0 ? (
                                                    <div
                                                      className="discussed-treatments-chip-row discussed-treatments-detected-issues-chips"
                                                      role="group"
                                                    >
                                                      {issues.map((issue) => {
                                                        const isIssueSelected =
                                                          selected.includes(
                                                            issue
                                                          );
                                                        return (
                                                          <label
                                                            key={issue}
                                                            className={`discussed-treatments-checkbox-chip discussed-treatments-treatment-chip ${
                                                              isIssueSelected
                                                                ? "selected"
                                                                : ""
                                                            }`}
                                                          >
                                                            <input
                                                              type="checkbox"
                                                              checked={
                                                                isIssueSelected
                                                              }
                                                              onChange={() => {
                                                                const current =
                                                                  form
                                                                    .selectedFindingsByTreatment[
                                                                    name
                                                                  ] ?? issues;
                                                                setForm(
                                                                  (f) => ({
                                                                    ...f,
                                                                    selectedFindingsByTreatment:
                                                                      {
                                                                        ...f.selectedFindingsByTreatment,
                                                                        [name]:
                                                                          isIssueSelected
                                                                            ? current.filter(
                                                                                (
                                                                                  x
                                                                                ) =>
                                                                                  x !==
                                                                                  issue
                                                                              )
                                                                            : [
                                                                                ...current,
                                                                                issue,
                                                                              ],
                                                                      },
                                                                  })
                                                                );
                                                              }}
                                                              className="discussed-treatments-checkbox-input"
                                                            />
                                                            <span className="discussed-treatments-checkbox-label">
                                                              {issue}
                                                            </span>
                                                          </label>
                                                        );
                                                      })}
                                                    </div>
                                                  ) : (
                                                    (() => {
                                                      const manualIssues =
                                                        getFindingsForTreatment(
                                                          name
                                                        ).length > 0
                                                          ? getFindingsForTreatment(
                                                              name
                                                            )
                                                          : ASSESSMENT_FINDINGS;
                                                      const selectedManual =
                                                        form
                                                          .selectedFindingsByTreatment[
                                                          name
                                                        ] ?? [];
                                                      return (
                                                        <>
                                                          <p className="discussed-treatments-detected-issues-empty">
                                                            No detected issues
                                                            below relate to this
                                                            treatment. Select an
                                                            issue to treat with
                                                            this treatment:
                                                          </p>
                                                          {manualIssues.length >
                                                            0 && (
                                                            <div
                                                              className="discussed-treatments-chip-row discussed-treatments-detected-issues-chips"
                                                              role="group"
                                                            >
                                                              {manualIssues.map(
                                                                (issue) => {
                                                                  const isIssueSelected =
                                                                    selectedManual.includes(
                                                                      issue
                                                                    );
                                                                  return (
                                                                    <label
                                                                      key={
                                                                        issue
                                                                      }
                                                                      className={`discussed-treatments-checkbox-chip discussed-treatments-treatment-chip ${
                                                                        isIssueSelected
                                                                          ? "selected"
                                                                          : ""
                                                                      }`}
                                                                    >
                                                                      <input
                                                                        type="checkbox"
                                                                        checked={
                                                                          isIssueSelected
                                                                        }
                                                                        onChange={() => {
                                                                          const current =
                                                                            form
                                                                              .selectedFindingsByTreatment[
                                                                              name
                                                                            ] ??
                                                                            [];
                                                                          setForm(
                                                                            (
                                                                              f
                                                                            ) => ({
                                                                              ...f,
                                                                              selectedFindingsByTreatment:
                                                                                {
                                                                                  ...f.selectedFindingsByTreatment,
                                                                                  [name]:
                                                                                    isIssueSelected
                                                                                      ? current.filter(
                                                                                          (
                                                                                            x
                                                                                          ) =>
                                                                                            x !==
                                                                                            issue
                                                                                        )
                                                                                      : [
                                                                                          ...current,
                                                                                          issue,
                                                                                        ],
                                                                                },
                                                                            })
                                                                          );
                                                                        }}
                                                                        className="discussed-treatments-checkbox-input"
                                                                      />
                                                                      <span className="discussed-treatments-checkbox-label">
                                                                        {issue}
                                                                      </span>
                                                                    </label>
                                                                  );
                                                                }
                                                              )}
                                                            </div>
                                                          )}
                                                        </>
                                                      );
                                                    })()
                                                  )}
                                                </div>
                                              );
                                            })()}
                                        </div>
                                      );
                                    }
                                    const issuesForTreatment =
                                      (addMode as AddByMode) === "goal"
                                        ? getDetectedIssuesForTreatment(
                                            name,
                                            form.interest ?? ""
                                          )
                                        : [];
                                    const showIssuesSection =
                                      isSelected &&
                                      (addMode as AddByMode) === "goal";
                                    return (
                                      <div
                                        key={name}
                                        className="discussed-treatments-treatment-block"
                                      >
                                        <label
                                          className={`discussed-treatments-checkbox-chip discussed-treatments-treatment-chip ${
                                            isSelected ? "selected" : ""
                                          }`}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() =>
                                              toggleTreatment(name)
                                            }
                                            className="discussed-treatments-checkbox-input"
                                          />
                                          <span className="discussed-treatments-checkbox-label">
                                            {name}
                                          </span>
                                        </label>
                                        {showIssuesSection && (
                                          <div
                                            className="discussed-treatments-detected-issues-inline"
                                            role="group"
                                            aria-label={`Detected issues for ${name}`}
                                          >
                                            <span className="discussed-treatments-detected-issues-inline-label">
                                              Select the issues detected below
                                              that relate to this treatment:
                                            </span>
                                            {issuesForTreatment.length > 0 ? (
                                              <div
                                                className="discussed-treatments-chip-row discussed-treatments-detected-issues-chips"
                                                role="group"
                                              >
                                                {issuesForTreatment.map(
                                                  (issue) => {
                                                    const selectedForTx =
                                                      form
                                                        .selectedFindingsByTreatment[
                                                        name
                                                      ] ?? issuesForTreatment;
                                                    const isIssueSelected =
                                                      selectedForTx.includes(
                                                        issue
                                                      );
                                                    return (
                                                      <label
                                                        key={issue}
                                                        className={`discussed-treatments-checkbox-chip discussed-treatments-treatment-chip ${
                                                          isIssueSelected
                                                            ? "selected"
                                                            : ""
                                                        }`}
                                                      >
                                                        <input
                                                          type="checkbox"
                                                          checked={
                                                            isIssueSelected
                                                          }
                                                          onChange={() => {
                                                            const current =
                                                              form
                                                                .selectedFindingsByTreatment[
                                                                name
                                                              ] ??
                                                              issuesForTreatment;
                                                            setForm((f) => ({
                                                              ...f,
                                                              selectedFindingsByTreatment:
                                                                {
                                                                  ...f.selectedFindingsByTreatment,
                                                                  [name]:
                                                                    isIssueSelected
                                                                      ? current.filter(
                                                                          (x) =>
                                                                            x !==
                                                                            issue
                                                                        )
                                                                      : [
                                                                          ...current,
                                                                          issue,
                                                                        ],
                                                                },
                                                            }));
                                                          }}
                                                          className="discussed-treatments-checkbox-input"
                                                        />
                                                        <span className="discussed-treatments-checkbox-label">
                                                          {issue}
                                                        </span>
                                                      </label>
                                                    );
                                                  }
                                                )}
                                              </div>
                                            ) : (
                                              (() => {
                                                const manualIssues =
                                                  getFindingsForTreatment(name)
                                                    .length > 0
                                                    ? getFindingsForTreatment(
                                                        name
                                                      )
                                                    : ASSESSMENT_FINDINGS;
                                                const selectedManual =
                                                  form
                                                    .selectedFindingsByTreatment[
                                                    name
                                                  ] ?? [];
                                                return (
                                                  <>
                                                    <p className="discussed-treatments-detected-issues-empty">
                                                      No detected issues below
                                                      relate to this treatment.
                                                      Select an issue to treat
                                                      with this treatment:
                                                    </p>
                                                    {manualIssues.length >
                                                      0 && (
                                                      <div
                                                        className="discussed-treatments-chip-row discussed-treatments-detected-issues-chips"
                                                        role="group"
                                                      >
                                                        {manualIssues.map(
                                                          (issue) => {
                                                            const isIssueSelected =
                                                              selectedManual.includes(
                                                                issue
                                                              );
                                                            return (
                                                              <label
                                                                key={issue}
                                                                className={`discussed-treatments-checkbox-chip discussed-treatments-treatment-chip ${
                                                                  isIssueSelected
                                                                    ? "selected"
                                                                    : ""
                                                                }`}
                                                              >
                                                                <input
                                                                  type="checkbox"
                                                                  checked={
                                                                    isIssueSelected
                                                                  }
                                                                  onChange={() => {
                                                                    const current =
                                                                      form
                                                                        .selectedFindingsByTreatment[
                                                                        name
                                                                      ] ?? [];
                                                                    setForm(
                                                                      (f) => ({
                                                                        ...f,
                                                                        selectedFindingsByTreatment:
                                                                          {
                                                                            ...f.selectedFindingsByTreatment,
                                                                            [name]:
                                                                              isIssueSelected
                                                                                ? current.filter(
                                                                                    (
                                                                                      x
                                                                                    ) =>
                                                                                      x !==
                                                                                      issue
                                                                                  )
                                                                                : [
                                                                                    ...current,
                                                                                    issue,
                                                                                  ],
                                                                          },
                                                                      })
                                                                    );
                                                                  }}
                                                                  className="discussed-treatments-checkbox-input"
                                                                />
                                                                <span className="discussed-treatments-checkbox-label">
                                                                  {issue}
                                                                </span>
                                                              </label>
                                                            );
                                                          }
                                                        )}
                                                      </div>
                                                    )}
                                                  </>
                                                );
                                              })()
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                  <div className="discussed-treatments-other-chip-row">
                                    <label
                                      className={`discussed-treatments-checkbox-chip discussed-treatments-topic-chip other-chip ${
                                        form.selectedTreatments.includes(
                                          OTHER_TREATMENT_LABEL
                                        ) || !!form.otherTreatment.trim()
                                          ? "selected"
                                          : ""
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={
                                          form.selectedTreatments.includes(
                                            OTHER_TREATMENT_LABEL
                                          ) || !!form.otherTreatment.trim()
                                        }
                                        onChange={() => {
                                          if (
                                            form.selectedTreatments.includes(
                                              OTHER_TREATMENT_LABEL
                                            ) ||
                                            form.otherTreatment.trim()
                                          ) {
                                            setForm((f) => ({
                                              ...f,
                                              selectedTreatments:
                                                f.selectedTreatments.filter(
                                                  (t) =>
                                                    t !== OTHER_TREATMENT_LABEL
                                                ),
                                              otherTreatment: "",
                                            }));
                                          } else {
                                            setForm((f) => ({
                                              ...f,
                                              selectedTreatments: [
                                                ...f.selectedTreatments,
                                                OTHER_TREATMENT_LABEL,
                                              ],
                                            }));
                                          }
                                        }}
                                        className="discussed-treatments-checkbox-input"
                                      />
                                      <span className="discussed-treatments-checkbox-label">
                                        {OTHER_TREATMENT_LABEL}
                                      </span>
                                    </label>
                                    {(form.selectedTreatments.includes(
                                      OTHER_TREATMENT_LABEL
                                    ) ||
                                      !!form.otherTreatment.trim()) && (
                                      <input
                                        type="text"
                                        placeholder="Type treatment name"
                                        value={form.otherTreatment}
                                        onChange={(e) => {
                                          const v = e.target.value.trim();
                                          setForm((f) => ({
                                            ...f,
                                            otherTreatment: e.target.value,
                                            selectedTreatments: v
                                              ? f.selectedTreatments.includes(
                                                  OTHER_TREATMENT_LABEL
                                                )
                                                ? f.selectedTreatments
                                                : [
                                                    ...f.selectedTreatments,
                                                    OTHER_TREATMENT_LABEL,
                                                  ]
                                              : f.selectedTreatments.filter(
                                                  (t) =>
                                                    t !== OTHER_TREATMENT_LABEL
                                                ),
                                          }));
                                        }}
                                        className="discussed-treatments-other-treatment-inline-input"
                                        aria-label="Other treatment name"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        ) : null}

                        <div className="discussed-treatments-prefill-rows">
                          {(() => {
                            const treatmentForQty =
                              form.selectedTreatments[0] ||
                              (form.otherTreatment.trim()
                                ? form.otherTreatment.trim()
                                : undefined);
                            const qtyCtx = getQuantityContext(treatmentForQty);
                            const displayUnit =
                              form.quantityUnit || qtyCtx.unitLabel;
                            return (
                              <div className="discussed-treatments-prefill-row">
                                <span className="discussed-treatments-prefill-label">
                                  {displayUnit} (optional)
                                </span>
                                <select
                                  className="discussed-treatments-quantity-unit-select"
                                  value={displayUnit}
                                  onChange={(e) =>
                                    setForm((f) => ({
                                      ...f,
                                      quantityUnit: e.target.value,
                                    }))
                                  }
                                  aria-label="Quantity unit"
                                >
                                  {QUANTITY_UNIT_OPTIONS.map((u) => (
                                    <option key={u} value={u}>
                                      {u}
                                    </option>
                                  ))}
                                </select>
                                <div className="discussed-treatments-chip-row">
                                  {qtyCtx.options.map((q) => (
                                    <button
                                      key={q}
                                      type="button"
                                      className={`discussed-treatments-prefill-chip ${
                                        form.quantity === q ? "selected" : ""
                                      }`}
                                      onClick={() =>
                                        setForm((f) => ({
                                          ...f,
                                          quantity: f.quantity === q ? "" : q,
                                        }))
                                      }
                                    >
                                      {q}
                                    </button>
                                  ))}
                                  <span className="discussed-treatments-quantity-other-wrap">
                                    <input
                                      type="number"
                                      min={1}
                                      max={999}
                                      placeholder="Other"
                                      value={
                                        form.quantity &&
                                        !qtyCtx.options.includes(form.quantity)
                                          ? form.quantity
                                          : ""
                                      }
                                      onChange={(e) => {
                                        const v = e.target.value.replace(
                                          /\D/g,
                                          ""
                                        );
                                        setForm((f) => ({
                                          ...f,
                                          quantity: v,
                                        }));
                                      }}
                                      className="discussed-treatments-quantity-other-input"
                                      aria-label={`${displayUnit} (other)`}
                                    />
                                  </span>
                                </div>
                              </div>
                            );
                          })()}
                          <div className="discussed-treatments-prefill-row">
                            <span className="discussed-treatments-prefill-label">
                              Timeline
                            </span>
                            <div className="discussed-treatments-chip-row">
                              {TIMELINE_OPTIONS.map((opt) => (
                                <label
                                  key={opt}
                                  className={`discussed-treatments-prefill-chip ${
                                    form.timeline === opt ? "selected" : ""
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name="timeline"
                                    checked={form.timeline === opt}
                                    onChange={() =>
                                      setForm((f) => ({ ...f, timeline: opt }))
                                    }
                                    className="discussed-treatments-radio-input"
                                  />
                                  {opt}
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="discussed-treatments-prefill-row">
                            <span className="discussed-treatments-prefill-label">
                              Recurring (optional)
                            </span>
                            <div className="discussed-treatments-chip-row">
                              <label
                                className={`discussed-treatments-prefill-chip ${
                                  !form.recurring ? "selected" : ""
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="recurring"
                                  checked={!form.recurring}
                                  onChange={() =>
                                    setForm((f) => ({
                                      ...f,
                                      recurring: "",
                                      recurringOther: "",
                                    }))
                                  }
                                  className="discussed-treatments-radio-input"
                                />
                                None
                              </label>
                              {RECURRING_OPTIONS.map((opt) => (
                                <label
                                  key={opt}
                                  className={`discussed-treatments-prefill-chip ${
                                    form.recurring === opt ? "selected" : ""
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name="recurring"
                                    checked={form.recurring === opt}
                                    onChange={() =>
                                      setForm((f) => ({
                                        ...f,
                                        recurring: opt,
                                        recurringOther: "",
                                      }))
                                    }
                                    className="discussed-treatments-radio-input"
                                  />
                                  {opt}
                                </label>
                              ))}
                              <label
                                className={`discussed-treatments-prefill-chip ${
                                  form.recurring === OTHER_RECURRING_LABEL
                                    ? "selected"
                                    : ""
                                } other-chip`}
                              >
                                <input
                                  type="radio"
                                  name="recurring"
                                  checked={
                                    form.recurring === OTHER_RECURRING_LABEL
                                  }
                                  onChange={() =>
                                    setForm((f) => ({
                                      ...f,
                                      recurring: OTHER_RECURRING_LABEL,
                                    }))
                                  }
                                  className="discussed-treatments-radio-input"
                                />
                                {OTHER_RECURRING_LABEL}
                              </label>
                            </div>
                            {form.recurring === OTHER_RECURRING_LABEL && (
                              <input
                                type="text"
                                placeholder="e.g. Every 4 weeks"
                                value={form.recurringOther}
                                onChange={(e) =>
                                  setForm((f) => ({
                                    ...f,
                                    recurringOther: e.target.value,
                                  }))
                                }
                                className="form-input-base discussed-treatments-other-inline"
                                style={{ marginTop: 8, maxWidth: 200 }}
                                aria-label="Other recurring"
                              />
                            )}
                          </div>

                          <div className="form-group discussed-treatments-notes-row">
                            <label
                              htmlFor="discussed-notes"
                              className="form-label"
                            >
                              Notes (optional)
                            </label>
                            <input
                              id="discussed-notes"
                              type="text"
                              placeholder="Any other detail"
                              value={form.notes}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  notes: e.target.value,
                                }))
                              }
                              className="form-input-base"
                            />
                          </div>

                          {/* Post-care & recommended (when a treatment with post-care is selected) */}
                          {(() => {
                            const currentTx =
                              form.selectedTreatments[0] ||
                              (form.otherTreatment.trim()
                                ? form.otherTreatment.trim()
                                : null);
                            const pc =
                              currentTx && TREATMENT_POSTCARE[currentTx];
                            if (!pc) return null;
                            return (
                              <div className="discussed-treatments-add-form-postcare discussed-treatments-postcare-section">
                                <h4 className="discussed-treatments-detail-section-title">
                                  Post-care & recommended
                                </h4>
                                <div className="discussed-treatments-postcare-actions">
                                  <button
                                    type="button"
                                    className="discussed-treatments-postcare-send-btn"
                                    onClick={() =>
                                      setPostCareModal({
                                        treatment: currentTx,
                                        label: pc.sendInstructionsLabel,
                                        instructionsText: pc.instructionsText,
                                      })
                                    }
                                  >
                                    {pc.sendInstructionsLabel}
                                  </button>
                                  {pc.suggestedProducts.length > 0 && (
                                    <div className="discussed-treatments-postcare-suggested">
                                      <span className="discussed-treatments-postcare-suggested-label">
                                        Patients often add:
                                      </span>
                                      <div className="discussed-treatments-postcare-chips">
                                        {pc.suggestedProducts.map((product) => (
                                          <button
                                            key={product}
                                            type="button"
                                            className="discussed-treatments-postcare-chip"
                                            onClick={() =>
                                              handleAddSuggestedProduct(
                                                currentTx,
                                                product
                                              )
                                            }
                                          >
                                            + {product}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          <button
                            type="button"
                            className="btn-primary discussed-treatments-add-btn"
                            onClick={handleAdd}
                            disabled={
                              (!hasAnyTreatmentSelected &&
                                !canAddWithGoalOnly) ||
                              savingAdd
                            }
                          >
                            {savingAdd ? "Saving..." : "Add to plan"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : addMode === "treatment" && selectedTreatmentFirst ? (
                    <>
                      <div className="discussed-treatments-prefill-rows">
                        {(() => {
                          const qtyCtx = getQuantityContext(
                            selectedTreatmentFirst
                          );
                          const displayUnit =
                            form.quantityUnit || qtyCtx.unitLabel;
                          return (
                            <div className="discussed-treatments-prefill-row">
                              <span className="discussed-treatments-prefill-label">
                                {displayUnit} (optional)
                              </span>
                              <select
                                className="discussed-treatments-quantity-unit-select"
                                value={displayUnit}
                                onChange={(e) =>
                                  setForm((f) => ({
                                    ...f,
                                    quantityUnit: e.target.value,
                                  }))
                                }
                                aria-label="Quantity unit"
                              >
                                {QUANTITY_UNIT_OPTIONS.map((u) => (
                                  <option key={u} value={u}>
                                    {u}
                                  </option>
                                ))}
                              </select>
                              <div className="discussed-treatments-chip-row">
                                {qtyCtx.options.map((q) => (
                                  <button
                                    key={q}
                                    type="button"
                                    className={`discussed-treatments-prefill-chip ${
                                      form.quantity === q ? "selected" : ""
                                    }`}
                                    onClick={() =>
                                      setForm((f) => ({
                                        ...f,
                                        quantity: f.quantity === q ? "" : q,
                                      }))
                                    }
                                  >
                                    {q}
                                  </button>
                                ))}
                                <span className="discussed-treatments-quantity-other-wrap">
                                  <input
                                    type="number"
                                    min={1}
                                    max={999}
                                    placeholder="Other"
                                    value={
                                      form.quantity &&
                                      !qtyCtx.options.includes(form.quantity)
                                        ? form.quantity
                                        : ""
                                    }
                                    onChange={(e) => {
                                      const v = e.target.value.replace(
                                        /\D/g,
                                        ""
                                      );
                                      setForm((f) => ({
                                        ...f,
                                        quantity: v,
                                      }));
                                    }}
                                    className="discussed-treatments-quantity-other-input"
                                    aria-label={`${displayUnit} (other)`}
                                  />
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                        <div className="discussed-treatments-prefill-row">
                          <span className="discussed-treatments-prefill-label">
                            Timeline
                          </span>
                          <div className="discussed-treatments-chip-row">
                            {TIMELINE_OPTIONS.map((opt) => (
                              <label
                                key={opt}
                                className={`discussed-treatments-prefill-chip ${
                                  form.timeline === opt ? "selected" : ""
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="timeline-by-tx"
                                  checked={form.timeline === opt}
                                  onChange={() =>
                                    setForm((f) => ({ ...f, timeline: opt }))
                                  }
                                  className="discussed-treatments-radio-input"
                                />
                                {opt}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="discussed-treatments-prefill-row">
                          <span className="discussed-treatments-prefill-label">
                            Recurring (optional)
                          </span>
                          <div className="discussed-treatments-chip-row">
                            <label
                              className={`discussed-treatments-prefill-chip ${
                                !form.recurring ? "selected" : ""
                              }`}
                            >
                              <input
                                type="radio"
                                name="recurring-tx"
                                checked={!form.recurring}
                                onChange={() =>
                                  setForm((f) => ({
                                    ...f,
                                    recurring: "",
                                    recurringOther: "",
                                  }))
                                }
                                className="discussed-treatments-radio-input"
                              />
                              None
                            </label>
                            {RECURRING_OPTIONS.map((opt) => (
                              <label
                                key={opt}
                                className={`discussed-treatments-prefill-chip ${
                                  form.recurring === opt ? "selected" : ""
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="recurring-tx"
                                  checked={form.recurring === opt}
                                  onChange={() =>
                                    setForm((f) => ({
                                      ...f,
                                      recurring: opt,
                                      recurringOther: "",
                                    }))
                                  }
                                  className="discussed-treatments-radio-input"
                                />
                                {opt}
                              </label>
                            ))}
                            <label
                              className={`discussed-treatments-prefill-chip ${
                                form.recurring === OTHER_RECURRING_LABEL
                                  ? "selected"
                                  : ""
                              } other-chip`}
                            >
                              <input
                                type="radio"
                                name="recurring-tx"
                                checked={
                                  form.recurring === OTHER_RECURRING_LABEL
                                }
                                onChange={() =>
                                  setForm((f) => ({
                                    ...f,
                                    recurring: OTHER_RECURRING_LABEL,
                                  }))
                                }
                                className="discussed-treatments-radio-input"
                              />
                              {OTHER_RECURRING_LABEL}
                            </label>
                          </div>
                          {form.recurring === OTHER_RECURRING_LABEL && (
                            <input
                              type="text"
                              placeholder="e.g. Every 4 weeks"
                              value={form.recurringOther}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  recurringOther: e.target.value,
                                }))
                              }
                              className="form-input-base discussed-treatments-other-inline"
                              style={{ marginTop: 8, maxWidth: 200 }}
                              aria-label="Other recurring"
                            />
                          )}
                        </div>
                      </div>
                      <div className="form-group discussed-treatments-notes-row">
                        <label
                          htmlFor="discussed-notes-tx"
                          className="form-label"
                        >
                          Notes (optional)
                        </label>
                        <input
                          id="discussed-notes-tx"
                          type="text"
                          placeholder="Any other detail"
                          value={form.notes}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, notes: e.target.value }))
                          }
                          className="form-input-base"
                        />
                      </div>
                      {/* Post-care & recommended (treatment mode) */}
                      {TREATMENT_POSTCARE[selectedTreatmentFirst] && (
                        <div className="discussed-treatments-add-form-postcare discussed-treatments-postcare-section">
                          <h4 className="discussed-treatments-detail-section-title">
                            Post-care & recommended
                          </h4>
                          <div className="discussed-treatments-postcare-actions">
                            <button
                              type="button"
                              className="discussed-treatments-postcare-send-btn"
                              onClick={() => {
                                const pc =
                                  TREATMENT_POSTCARE[selectedTreatmentFirst];
                                if (pc)
                                  setPostCareModal({
                                    treatment: selectedTreatmentFirst,
                                    label: pc.sendInstructionsLabel,
                                    instructionsText: pc.instructionsText,
                                  });
                              }}
                            >
                              {
                                TREATMENT_POSTCARE[selectedTreatmentFirst]
                                  .sendInstructionsLabel
                              }
                            </button>
                            {TREATMENT_POSTCARE[selectedTreatmentFirst]
                              .suggestedProducts.length > 0 && (
                              <div className="discussed-treatments-postcare-suggested">
                                <span className="discussed-treatments-postcare-suggested-label">
                                  Patients often add:
                                </span>
                                <div className="discussed-treatments-postcare-chips">
                                  {TREATMENT_POSTCARE[
                                    selectedTreatmentFirst
                                  ].suggestedProducts.map((product) => (
                                    <button
                                      key={product}
                                      type="button"
                                      className="discussed-treatments-postcare-chip"
                                      onClick={() =>
                                        handleAddSuggestedProduct(
                                          selectedTreatmentFirst,
                                          product
                                        )
                                      }
                                    >
                                      + {product}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      <button
                        type="button"
                        className="btn-primary discussed-treatments-add-btn"
                        onClick={handleAdd}
                        disabled={!hasAnyTreatmentSelected || savingAdd}
                      >
                        {savingAdd ? "Saving..." : "Add to plan"}
                      </button>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Post-care instructions modal (copy to clipboard) */}
        {postCareModal && (
          <div
            className="discussed-treatments-postcare-modal-overlay"
            onClick={() => setPostCareModal(null)}
            role="dialog"
            aria-label={postCareModal.label}
          >
            <div
              className="discussed-treatments-postcare-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="discussed-treatments-postcare-modal-header">
                <h4 className="discussed-treatments-postcare-modal-title">
                  {postCareModal.label}
                </h4>
                <button
                  type="button"
                  className="modal-close discussed-treatments-postcare-modal-close"
                  onClick={() => setPostCareModal(null)}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div className="discussed-treatments-postcare-modal-body">
                <pre className="discussed-treatments-postcare-modal-text">
                  {postCareModal.instructionsText}
                </pre>
              </div>
              <div className="discussed-treatments-postcare-modal-actions">
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => setPostCareModal(null)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  onClick={handleCopyPostCareInstructions}
                >
                  Copy to clipboard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
