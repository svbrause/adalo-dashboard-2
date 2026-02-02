// Discussed Treatments Modal – static data and options

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

/** Skincare: specific products (brand + product) for carousel */
export const SKINCARE_PRODUCTS = [
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
export const LASER_DEVICES = [
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
      "Skinceuticals Hyaluronic Acid",
      "SkinMedica HA5 Rejuvenating Hydrator",
      "CeraVe Moisturizing Cream",
      "Skinceuticals Triple Lipid Restore",
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
      "Skinceuticals Blemish + Age Defense",
      "Paula's Choice 2% BHA",
      "SkinMedica Lytic Treatment",
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
      "Skinceuticals C E Ferulic",
      "Skinceuticals Phloretin CF",
      "SkinMedica Vitamin C+ E Complex",
      "Skinceuticals Discoloration Defense",
      "SkinMedica Even Correct",
      "EltaMD UV Clear",
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
  {
    treatment: "Skincare",
    keywords: ["sensitive", "redness", "irritat", "licorice", "centella"],
    products: [
      "CeraVe Moisturizing Cream",
      "Skinceuticals Triple Lipid Restore",
      "EltaMD UV Clear",
    ],
  },
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
    ],
  },
];

/** Treatment type / product options per treatment (for product selector when that treatment is selected) */
export const TREATMENT_PRODUCT_OPTIONS: Record<string, string[]> = {
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

/** Post-care instructions + suggested products per treatment. */
export const TREATMENT_POSTCARE: Record<
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

/** All treatment/procedure options (non-surgical only). */
export const ALL_TREATMENTS = [
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
export const OTHER_TREATMENT_LABEL = "Other";

/** Map each interest (by keyword match) to suggested treatments. */
export const INTEREST_TO_TREATMENTS: {
  keywords: string[];
  treatments: string[];
}[] = [
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
  { keywords: ["neck"], treatments: ["Skincare", "Kybella", "Radiofrequency"] },
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

export const REGION_OPTIONS = [
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
export const TIMELINE_OPTIONS = ["Now", "Add next visit", "Wishlist"];
/** Plan sections in display order (Now top, Wishlist bottom). */
export const PLAN_SECTIONS = ["Now", "Add next visit", "Wishlist"] as const;

export const QUANTITY_QUICK_OPTIONS_DEFAULT = ["1", "2", "3", "4", "5"];
export const QUANTITY_OPTIONS_FILLER = ["1", "2", "3", "4", "5"];
export const QUANTITY_OPTIONS_TOX = ["20", "40", "60", "80", "100"];

export const QUANTITY_UNIT_OPTIONS = [
  "Syringes",
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
