/**
 * Skin Type Quiz – Gemstone Skin Type Questionnaire
 *
 * Three sections: Hydration (Oily vs Dry), Reactivity (Sensitive vs Resistant),
 * Pigmentation (Pigmented vs Non-pigmented). Each answer scores 1–4 (A=1, B=2, C=3, D=4).
 * Section totals map to a 3-letter code (e.g. OSP) and then to one of 8 gemstone types.
 */

/** The 8 gemstone skin types (result of the quiz). */
export type GemstoneId =
  | "opal"
  | "pearl"
  | "jade"
  | "quartz"
  | "amber"
  | "moonstone"
  | "turquoise"
  | "diamond";

/** Alias for backward compatibility; result is always one of the 8 gemstones. */
export type SkinTypeId = GemstoneId;

/** Section of the quiz; each has 5–6 questions and maps to one letter. */
export type QuizSectionId = "hydration" | "reactivity" | "pigmentation";

/** One answer option: label and point value (1–4) for that question's section. */
export interface QuizAnswer {
  label: string;
  /** Points for this section (A=1, B=2, C=3, D=4). */
  points: number;
}

/** One multiple-choice question. */
export interface QuizQuestion {
  id: string;
  title: string;
  question: string;
  section: QuizSectionId;
  answers: QuizAnswer[];
}

/** All quiz questions in order. */
export interface SkinTypeQuizData {
  questions: QuizQuestion[];
  resultDescriptions?: Partial<
    Record<SkinTypeId, { label: string; description?: string }>
  >;
}

/** Section totals → letter. Hydration: 5–10 = D, 11–20 = O. Reactivity: 6–15 = S, 16–24 = R. Pigmentation: 5–12 = P, 13–20 = N. */
export function getSectionLetters(sectionScores: Record<QuizSectionId, number>): Record<QuizSectionId, string> {
  const h = sectionScores.hydration;
  const r = sectionScores.reactivity;
  const p = sectionScores.pigmentation;
  return {
    hydration: h >= 5 && h <= 10 ? "D" : "O",
    reactivity: r >= 6 && r <= 15 ? "S" : "R",
    pigmentation: p >= 5 && p <= 12 ? "P" : "N",
  };
}

/** 3-letter code (e.g. OSP) → gemstone id. */
const CODE_TO_GEMSTONE: Record<string, GemstoneId> = {
  OSP: "opal",
  OSN: "pearl",
  ORP: "jade",
  ORN: "quartz",
  DSP: "amber",
  DSN: "moonstone",
  DRP: "turquoise",
  DRN: "diamond",
};

export function getGemstoneFromSectionScores(sectionScores: Record<QuizSectionId, number>): GemstoneId {
  const letters = getSectionLetters(sectionScores);
  const code = letters.hydration + letters.reactivity + letters.pigmentation;
  return CODE_TO_GEMSTONE[code] ?? "quartz";
}

export const SKIN_TYPE_QUIZ: SkinTypeQuizData = {
  questions: [
    {
      id: "q1",
      title: "Hydration",
      section: "hydration",
      question: "When you wake up in the morning, your skin feels:",
      answers: [
        { label: "Tight and in need of moisturizer", points: 1 },
        { label: "Comfortable and balanced", points: 2 },
        { label: "Slightly oily in some areas", points: 3 },
        { label: "Oily all over", points: 4 },
      ],
    },
    {
      id: "q2",
      title: "Hydration",
      section: "hydration",
      question: "By midday, your T-zone (forehead, nose, chin):",
      answers: [
        { label: "Still feels tight or normal", points: 1 },
        { label: "Has a slight shine", points: 2 },
        { label: "Is noticeably shiny", points: 3 },
        { label: "Is very oily and shiny", points: 4 },
      ],
    },
    {
      id: "q3",
      title: "Hydration",
      section: "hydration",
      question: "How does your skin feel 2-3 hours after cleansing (without moisturizer)?",
      answers: [
        { label: "Very tight and uncomfortable", points: 1 },
        { label: "Slightly tight", points: 2 },
        { label: "Comfortable", points: 3 },
        { label: "Already showing oil", points: 4 },
      ],
    },
    {
      id: "q4",
      title: "Hydration",
      section: "hydration",
      question: "Your pores are:",
      answers: [
        { label: "Barely visible", points: 1 },
        { label: "Small and fine", points: 2 },
        { label: "Visible, especially on nose and cheeks", points: 3 },
        { label: "Large and visible across face", points: 4 },
      ],
    },
    {
      id: "q5",
      title: "Hydration",
      section: "hydration",
      question: "How often do you typically need to moisturize?",
      answers: [
        { label: "Multiple times a day", points: 1 },
        { label: "Twice daily (morning and night)", points: 2 },
        { label: "Once daily", points: 3 },
        { label: "Rarely or only occasionally", points: 4 },
      ],
    },
    {
      id: "q6",
      title: "Reactivity",
      section: "reactivity",
      question: "When trying new skincare products, your skin:",
      answers: [
        { label: "Often breaks out, stings, or gets irritated", points: 1 },
        { label: "Sometimes reacts but usually adjusts", points: 2 },
        { label: "Rarely has reactions", points: 3 },
        { label: "Can handle almost anything", points: 4 },
      ],
    },
    {
      id: "q7",
      title: "Reactivity",
      section: "reactivity",
      question: "In windy or cold weather, your skin:",
      answers: [
        { label: "Becomes very red and irritated", points: 1 },
        { label: "Gets slightly red or tight", points: 2 },
        { label: "Feels a bit dry but manageable", points: 3 },
        { label: "Doesn't seem affected", points: 4 },
      ],
    },
    {
      id: "q8",
      title: "Reactivity",
      section: "reactivity",
      question: "Fragranced products (perfumes, scented lotions):",
      answers: [
        { label: "Always cause irritation or breakouts", points: 1 },
        { label: "Sometimes cause problems", points: 2 },
        { label: "Rarely bother you", points: 3 },
        { label: "Never cause issues", points: 4 },
      ],
    },
    {
      id: "q9",
      title: "Reactivity",
      section: "reactivity",
      question: "After sun exposure (even with sunscreen), your skin:",
      answers: [
        { label: "Gets very red and burns easily", points: 1 },
        { label: "Sometimes gets pink or burns", points: 2 },
        { label: "Tans gradually with minimal burning", points: 3 },
        { label: "Rarely burns, tans easily", points: 4 },
      ],
    },
    {
      id: "q10",
      title: "Reactivity",
      section: "reactivity",
      question: "How does your skin react to stress, hormonal changes, or diet?",
      answers: [
        { label: "Very noticeable reactions (breakouts, redness, sensitivity)", points: 1 },
        { label: "Some reactions during major changes", points: 2 },
        { label: "Mild reactions occasionally", points: 3 },
        { label: "Skin stays pretty much the same", points: 4 },
      ],
    },
    {
      id: "q11",
      title: "Reactivity",
      section: "reactivity",
      question: "Retinol or acid products (AHA/BHA):",
      answers: [
        { label: "Cause irritation even in small amounts", points: 1 },
        { label: "Need to be introduced very slowly", points: 2 },
        { label: "Can be tolerated with gradual introduction", points: 3 },
        { label: "Can use regularly without issues", points: 4 },
      ],
    },
    {
      id: "q12",
      title: "Pigmentation",
      section: "pigmentation",
      question: "When you get a pimple or minor injury, afterward you:",
      answers: [
        { label: "Almost always get a dark mark that lasts months", points: 1 },
        { label: "Sometimes get marks that fade slowly", points: 2 },
        { label: "Occasionally get marks that fade quickly", points: 3 },
        { label: "Rarely get any lasting marks", points: 4 },
      ],
    },
    {
      id: "q13",
      title: "Pigmentation",
      section: "pigmentation",
      question: "Your skin tone on your face is:",
      answers: [
        { label: "Very uneven with many dark spots or patches", points: 1 },
        { label: "Somewhat uneven with some spots", points: 2 },
        { label: "Mostly even with occasional spots", points: 3 },
        { label: "Very even with few to no spots", points: 4 },
      ],
    },
    {
      id: "q14",
      title: "Pigmentation",
      section: "pigmentation",
      question: "In the past, sun exposure has caused:",
      answers: [
        { label: "Many freckles, sun spots, or melasma", points: 1 },
        { label: "Some freckles or spots", points: 2 },
        { label: "Occasional light freckling", points: 3 },
        { label: "Very little pigmentation change", points: 4 },
      ],
    },
    {
      id: "q15",
      title: "Pigmentation",
      section: "pigmentation",
      question: "Your family history includes:",
      answers: [
        { label: "Many relatives with melasma, sun spots, or uneven skin tone", points: 1 },
        { label: "Some relatives with pigmentation issues", points: 2 },
        { label: "Few relatives with these issues", points: 3 },
        { label: "No family history of pigmentation problems", points: 4 },
      ],
    },
    {
      id: "q16",
      title: "Pigmentation",
      section: "pigmentation",
      question: "When you tan:",
      answers: [
        { label: "You burn and develop uneven pigmentation", points: 1 },
        { label: "You tan unevenly with some spots", points: 2 },
        { label: "You tan fairly evenly", points: 3 },
        { label: "You tan very evenly without spots", points: 4 },
      ],
    },
  ],

  resultDescriptions: {
    opal: {
      label: "Opal",
      description:
        "Your skin is oily, reactive, and prone to pigmentation. Like the opal gemstone, your skin shows a beautiful play of color but can reveal imperfections clearly. Targeted treatments focus on controlling oil, calming sensitivity, and addressing pigmentation for a balanced, radiant complexion.",
    },
    pearl: {
      label: "Pearl",
      description:
        "You have oily, sensitive skin that stays mostly clear of pigmentation. Like a pearl, your skin is beautiful yet delicate, needing gentle care to maintain balance and minimize irritation while controlling shine and reactivity.",
    },
    jade: {
      label: "Jade",
      description:
        "Your skin is oily and resistant with pigmentation concerns. Like the jade gemstone, your skin is resilient but reveals imperfections clearly. Treatment aims to reduce discoloration while enhancing skin texture and clarity.",
    },
    quartz: {
      label: "Quartz",
      description:
        "Oily, resistant, and non-pigmented — your skin is clear and tough like quartz. You benefit from treatments that maintain clarity, improve texture, and prevent aging while controlling oil production effectively.",
    },
    amber: {
      label: "Amber",
      description:
        "Your dry, sensitive skin with pigmentation is like amber — warm, beautiful, but delicate. Treatments focus on strengthening your skin barrier, reducing pigmentation, and deeply hydrating for a luminous glow.",
    },
    moonstone: {
      label: "Moonstone",
      description:
        "With dry, sensitive, and non-pigmented skin, your skin resembles the soft glow of moonstone. Gentle, nurturing treatments that protect and restore moisture help maintain your skin's natural radiance.",
    },
    turquoise: {
      label: "Turquoise",
      description:
        "Your skin is dry, resistant, and pigmented. It is tough yet delicate like turquoise. You respond well to therapies that balance pigmentation and restore hydration while promoting skin strength.",
    },
    diamond: {
      label: "Diamond",
      description:
        "Dry, resistant, and non-pigmented — your skin is clear and resilient like a diamond. You're well suited for advanced rejuvenation that enhances firmness, hydration, and youthful radiance.",
    },
  },
};

/** Display labels for the three quiz sections (used on results score breakdown). */
export const SECTION_DISPLAY_LABELS: Record<QuizSectionId, string> = {
  hydration: "Hydration",
  reactivity: "Reactivity",
  pigmentation: "Pigmentation",
};

/** Display labels for score axes (section ids). Kept for backward compatibility with UI that iterates score keys. */
export const SKIN_TYPE_DISPLAY_LABELS: Record<string, string> = {
  hydration: "Hydration",
  reactivity: "Reactivity",
  pigmentation: "Pigmentation",
};

/** Gemstone name and tagline for results hero (e.g. "Opal – Iridescent and reactive"). */
export const GEMSTONE_BY_SKIN_TYPE: Record<
  GemstoneId,
  { name: string; tagline: string }
> = {
  opal: { name: "Opal", tagline: "Iridescent and reactive" },
  pearl: { name: "Pearl", tagline: "Lustrous but delicate" },
  jade: { name: "Jade", tagline: "Strong and precious, shows every mark" },
  quartz: { name: "Quartz", tagline: "Clear and resilient" },
  amber: { name: "Amber", tagline: "Warm golden treasure" },
  moonstone: { name: "Moonstone", tagline: "Ethereal inner glow" },
  turquoise: { name: "Turquoise", tagline: "Sacred weathered beauty" },
  diamond: { name: "Diamond", tagline: "Rare perfect clarity" },
};

/** One step in a routine: label shown to user + full product names for lookup in boutique. */
export interface RoutineStep {
  label: string;
  productNames: string[];
}

/** Routine notes: AM/PM steps with labels and linked product names (match getSkincareCarouselItems). */
export const ROUTINE_NOTES_BY_SKIN_TYPE: Record<
  GemstoneId,
  { am: RoutineStep[]; pm: RoutineStep[]; optional?: { label: string; productNames: string[] } }
> = {
  opal: {
    am: [
      {
        label: "Simply Clean or Gentle Cleanser",
        productNames: [
          "SkinCeuticals Simply Clean | Gentle Foaming Cleanser for All Skin Types",
          "SkinCeuticals Gentle Cleanser | Soothing Cream Cleanser for Dry & Sensitive Skin",
        ],
      },
      {
        label: "Phloretin CF or Silymarin CF",
        productNames: [
          "SkinCeuticals Phloretin CF | Antioxidant Serum for Environmental Damage & Uneven Skin Tone",
          "SkinCeuticals Silymarin CF | Antioxidant Serum for Oily & Acne-Prone Skin",
        ],
      },
      {
        label: "Blemish + Age Defense",
        productNames: [
          "SkinCeuticals Blemish + Age Defense | Targeted Serum for Acne and Signs of Aging",
        ],
      },
      {
        label: "P-Tiox",
        productNames: [
          "SkinCeuticals P-Tiox | Glass Skin Serum for Skin Protection & Repair",
        ],
      },
      {
        label: "On The Daily SPF 45 or Let's Get Physical Tinted SPF 44",
        productNames: [
          "The Treatment On The Daily SPF 45 | Lightweight Sunscreen for Daily Protection",
          "The Treatment Let's Get Physical Tinted SPF 44 | Lightweight Tinted Sunscreen with Broad Spectrum Protection",
        ],
      },
    ],
    pm: [
      {
        label: "Simply Clean or LHA Cleanser",
        productNames: [
          "SkinCeuticals Simply Clean | Gentle Foaming Cleanser for All Skin Types",
          "SkinCeuticals LHA Cleanser | Exfoliating Face Wash for Acne-Prone & Congested Skin",
        ],
      },
      {
        label: "Retinol 0.5",
        productNames: [
          "SkinCeuticals Retinol 0.5% | Anti-Aging Serum for Wrinkles & Skin Renewal",
        ],
      },
      {
        label: "P-Tiox",
        productNames: [
          "SkinCeuticals P-Tiox | Glass Skin Serum for Skin Protection & Repair",
        ],
      },
      {
        label: "Daily Moisture",
        productNames: [
          "SkinCeuticals Daily Moisture | Lightweight Hydrating Moisturizer for All Skin Types",
        ],
      },
    ],
    optional: {
      label: "Glycolic 10 Renew Overnight 1–2×/week",
      productNames: [
        "SkinCeuticals Glycolic 10 Renew Overnight | Exfoliating Night Serum for Smoother, Radiant Skin",
      ],
    },
  },
  pearl: {
    am: [
      {
        label: "Simply Clean",
        productNames: [
          "SkinCeuticals Simply Clean | Gentle Foaming Cleanser for All Skin Types",
        ],
      },
      {
        label: "Hyaluronic Acid Intensifier",
        productNames: [
          "SkinCeuticals Hyaluronic Acid Intensifier | Multi-Glycan Hydrating Serum for Plump & Smooth Skin",
        ],
      },
      {
        label: "Hydrating B5 Gel",
        productNames: [
          "SkinCeuticals Hydrating B5 Gel | Lightweight Moisturizer with Vitamin B5 for Deep Skin Hydration",
        ],
      },
      {
        label: "Triple Lipid Restore or Emollience",
        productNames: [
          "SkinCeuticals Triple Lipid Restore 2:4:2 | Anti-Aging Moisturizer for Skin Barrier Repair & Hydration",
          "SkinCeuticals Emollience | Hydrating Moisturizer for Normal to Dry Skin",
        ],
      },
      {
        label: "On The Daily SPF 45",
        productNames: [
          "The Treatment On The Daily SPF 45 | Lightweight Sunscreen for Daily Protection",
        ],
      },
    ],
    pm: [
      {
        label: "Replenishing Cleanser or Gentle Cleanser",
        productNames: [
          "SkinCeuticals Replenishing Cleanser | Hydrating Face Wash for Dry & Sensitive Skin",
          "SkinCeuticals Gentle Cleanser | Soothing Cream Cleanser for Dry & Sensitive Skin",
        ],
      },
      {
        label: "Daily Ceramide Comfort",
        productNames: [
          "GM Collin Daily Ceramide Comfort | Nourishing Skin Barrier Capsules for Hydration & Repair (20 Ct.)",
        ],
      },
      {
        label: "Hydrating B5 Gel",
        productNames: [
          "SkinCeuticals Hydrating B5 Gel | Lightweight Moisturizer with Vitamin B5 for Deep Skin Hydration",
        ],
      },
      {
        label: "Renew Overnight or Hydra Balm",
        productNames: [
          "SkinCeuticals Renew Overnight | Intensive Night Cream for Dry & Dehydrated Skin",
          "SkinCeuticals Hydra Balm | Intensive Moisturizing Balm for Compromised, Dry & Dehydrated Skin",
        ],
      },
    ],
    optional: {
      label: "Hydrating B5 Mask 1–2×/week",
      productNames: [
        "SkinCeuticals Hydrating B5 Mask | Nourishing Face Mask with Vitamin B5 for Intense Moisture",
      ],
    },
  },
  jade: {
    am: [
      {
        label: "Simply Clean (gel cleanser for oily/resistant)",
        productNames: [
          "SkinCeuticals Simply Clean | Gentle Foaming Cleanser for All Skin Types",
        ],
      },
      {
        label: "Silymarin CF",
        productNames: [
          "SkinCeuticals Silymarin CF | Antioxidant Serum for Oily & Acne-Prone Skin",
        ],
      },
      {
        label: "Discoloration Defense",
        productNames: [
          "SkinCeuticals Discoloration Defense | Targeted Serum for Dark Spots & Uneven Skin Tone",
        ],
      },
      {
        label: "Blemish + Age Defense",
        productNames: [
          "SkinCeuticals Blemish + Age Defense | Targeted Serum for Acne and Signs of Aging",
        ],
      },
      {
        label: "On The Daily SPF 45 or Let's Get Physical Tinted SPF 44",
        productNames: [
          "The Treatment On The Daily SPF 45 | Lightweight Sunscreen for Daily Protection",
          "The Treatment Let's Get Physical Tinted SPF 44 | Lightweight Tinted Sunscreen with Broad Spectrum Protection",
        ],
      },
    ],
    pm: [
      {
        label: "LHA Cleanser",
        productNames: [
          "SkinCeuticals LHA Cleanser | Exfoliating Face Wash for Acne-Prone & Congested Skin",
        ],
      },
      {
        label: "P-Tiox",
        productNames: [
          "SkinCeuticals P-Tiox | Glass Skin Serum for Skin Protection & Repair",
        ],
      },
      {
        label: "Retinol",
        productNames: [
          "SkinCeuticals Retinol 0.5% | Anti-Aging Serum for Wrinkles & Skin Renewal",
        ],
      },
      {
        label: "RGN-6",
        productNames: [],
      },
    ],
    optional: {
      label: "Glycolic 10 Renew Overnight 1–2×/week",
      productNames: [
        "SkinCeuticals Glycolic 10 Renew Overnight | Exfoliating Night Serum for Smoother, Radiant Skin",
      ],
    },
  },
  quartz: {
    am: [
      {
        label: "Simply Clean or Gentle Cleanser",
        productNames: [
          "SkinCeuticals Simply Clean | Gentle Foaming Cleanser for All Skin Types",
        ],
      },
      {
        label: "C E Ferulic or P-Tiox",
        productNames: [
          "SkinCeuticals C E Ferulic | Antioxidant Vitamin C Serum for Brightening & Anti-Aging",
          "SkinCeuticals P-Tiox | Glass Skin Serum for Skin Protection & Repair",
        ],
      },
      {
        label: "Hydrating B5 Gel",
        productNames: [
          "SkinCeuticals Hydrating B5 Gel | Lightweight Moisturizer with Vitamin B5 for Deep Skin Hydration",
        ],
      },
      {
        label: "Daily Moisture",
        productNames: [
          "SkinCeuticals Daily Moisture | Lightweight Hydrating Moisturizer for All Skin Types",
        ],
      },
      {
        label: "On The Daily SPF 45 or Let's Get Physical Tinted SPF 44",
        productNames: [
          "The Treatment On The Daily SPF 45 | Lightweight Sunscreen for Daily Protection",
          "The Treatment Let's Get Physical Tinted SPF 44 | Lightweight Tinted Sunscreen with Broad Spectrum Protection",
        ],
      },
    ],
    pm: [
      {
        label: "Simply Clean",
        productNames: [
          "SkinCeuticals Simply Clean | Gentle Foaming Cleanser for All Skin Types",
        ],
      },
      {
        label: "P-Tiox",
        productNames: [
          "SkinCeuticals P-Tiox | Glass Skin Serum for Skin Protection & Repair",
        ],
      },
      {
        label: "Hydrating B5 Gel",
        productNames: [
          "SkinCeuticals Hydrating B5 Gel | Lightweight Moisturizer with Vitamin B5 for Deep Skin Hydration",
        ],
      },
      {
        label: "Daily Moisture",
        productNames: [
          "SkinCeuticals Daily Moisture | Lightweight Hydrating Moisturizer for All Skin Types",
        ],
      },
    ],
    optional: {
      label: "Retinol 0.3 or 0.5 2–3×/week",
      productNames: [
        "SkinCeuticals Retinol 0.3% | Anti-Aging Serum for Wrinkles & Skin Renewal",
        "SkinCeuticals Retinol 0.5% | Anti-Aging Serum for Wrinkles & Skin Renewal",
      ],
    },
  },
  amber: {
    am: [
      {
        label: "Gentle Cleanser (hydrating cream cleanser)",
        productNames: [
          "SkinCeuticals Gentle Cleanser | Soothing Cream Cleanser for Dry & Sensitive Skin",
        ],
      },
      {
        label: "Phloretin CF",
        productNames: [
          "SkinCeuticals Phloretin CF | Antioxidant Serum for Environmental Damage & Uneven Skin Tone",
        ],
      },
      {
        label: "HA Intensifier",
        productNames: [
          "SkinCeuticals Hyaluronic Acid Intensifier | Multi-Glycan Hydrating Serum for Plump & Smooth Skin",
        ],
      },
      {
        label: "Discoloration Defense",
        productNames: [
          "SkinCeuticals Discoloration Defense | Targeted Serum for Dark Spots & Uneven Skin Tone",
        ],
      },
      {
        label: "On The Daily SPF 45 or Let's Get Physical Tinted SPF 44",
        productNames: [
          "The Treatment On The Daily SPF 45 | Lightweight Sunscreen for Daily Protection",
          "The Treatment Let's Get Physical Tinted SPF 44 | Lightweight Tinted Sunscreen with Broad Spectrum Protection",
        ],
      },
    ],
    pm: [
      {
        label: "Gentle Cleanser",
        productNames: [
          "SkinCeuticals Gentle Cleanser | Soothing Cream Cleanser for Dry & Sensitive Skin",
        ],
      },
      {
        label: "P-Tiox (if tolerated) or Cell Cycle Catalyst",
        productNames: [
          "SkinCeuticals P-Tiox | Glass Skin Serum for Skin Protection & Repair",
        ],
      },
      {
        label: "HA Intensifier or AGE Interrupter",
        productNames: [
          "SkinCeuticals Hyaluronic Acid Intensifier | Multi-Glycan Hydrating Serum for Plump & Smooth Skin",
        ],
      },
      {
        label: "Phyto Corrective Gel (if redness)",
        productNames: [
          "SkinCeuticals Phyto Corrective Gel | Soothing Hydrating Serum for Redness & Sensitive Skin",
        ],
      },
      {
        label: "Triple Lipid Restore 2:4:2 or AGE Interrupter Advanced",
        productNames: [
          "SkinCeuticals Triple Lipid Restore 2:4:2 | Anti-Aging Moisturizer for Skin Barrier Repair & Hydration",
        ],
      },
    ],
  },
  moonstone: {
    am: [
      {
        label: "Gentle Cleanser",
        productNames: [
          "SkinCeuticals Gentle Cleanser | Soothing Cream Cleanser for Dry & Sensitive Skin",
          "SkinCeuticals Simply Clean | Gentle Foaming Cleanser for All Skin Types",
        ],
      },
      {
        label: "Serum 10 AOX+",
        productNames: [
          "SkinCeuticals Serum 10 AOX | Antioxidant Serum with 10% Vitamin C for Brightening & Protection",
        ],
      },
      {
        label: "HA Intensifier",
        productNames: [
          "SkinCeuticals Hyaluronic Acid Intensifier | Multi-Glycan Hydrating Serum for Plump & Smooth Skin",
        ],
      },
      {
        label: "P-Tiox (if tolerated) or Cell Cycle Catalyst",
        productNames: [
          "SkinCeuticals P-Tiox | Glass Skin Serum for Skin Protection & Repair",
        ],
      },
      {
        label: "On The Daily SPF 45 or Let's Get Physical Tinted SPF 44",
        productNames: [
          "The Treatment On The Daily SPF 45 | Lightweight Sunscreen for Daily Protection",
          "The Treatment Let's Get Physical Tinted SPF 44 | Lightweight Tinted Sunscreen with Broad Spectrum Protection",
        ],
      },
    ],
    pm: [
      {
        label: "Gentle Cleanser",
        productNames: [
          "SkinCeuticals Gentle Cleanser | Soothing Cream Cleanser for Dry & Sensitive Skin",
        ],
      },
      {
        label: "HA Intensifier",
        productNames: [
          "SkinCeuticals Hyaluronic Acid Intensifier | Multi-Glycan Hydrating Serum for Plump & Smooth Skin",
        ],
      },
      {
        label: "Phyto A+",
        productNames: [
          "SkinCeuticals Phyto A+ Brightening Treatment | Lightweight Gel Moisturizer for Dull, Uneven Skin",
        ],
      },
      {
        label: "P-Tiox (if tolerated) or Cell Cycle Catalyst",
        productNames: [
          "SkinCeuticals P-Tiox | Glass Skin Serum for Skin Protection & Repair",
        ],
      },
      {
        label: "GM Collins Rosa Sea Moisturizer or Emollience",
        productNames: [
          "SkinCeuticals Emollience | Hydrating Moisturizer for Normal to Dry Skin",
        ],
      },
    ],
  },
  turquoise: {
    am: [
      { label: "Replenishing Cleanser", productNames: ["SkinCeuticals Replenishing Cleanser | Hydrating Face Wash for Dry & Sensitive Skin"] },
      { label: "Phloretin CF", productNames: ["SkinCeuticals Phloretin CF | Antioxidant Serum for Environmental Damage & Uneven Skin Tone"] },
      { label: "Discoloration Defense", productNames: ["SkinCeuticals Discoloration Defense | Targeted Serum for Dark Spots & Uneven Skin Tone"] },
      { label: "P-Tiox", productNames: ["SkinCeuticals P-Tiox | Glass Skin Serum for Skin Protection & Repair"] },
      { label: "On The Daily SPF 45 or Let's Get Physical Tinted SPF 44", productNames: ["The Treatment On The Daily SPF 45 | Lightweight Sunscreen for Daily Protection", "The Treatment Let's Get Physical Tinted SPF 44 | Lightweight Tinted Sunscreen with Broad Spectrum Protection"] },
    ],
    pm: [
      { label: "Replenishing Cleanser", productNames: ["SkinCeuticals Replenishing Cleanser | Hydrating Face Wash for Dry & Sensitive Skin"] },
      { label: "P-Tiox", productNames: ["SkinCeuticals P-Tiox | Glass Skin Serum for Skin Protection & Repair"] },
      { label: "HA Intensifier", productNames: ["SkinCeuticals Hyaluronic Acid Intensifier | Multi-Glycan Hydrating Serum for Plump & Smooth Skin"] },
      { label: "Triple Lipid Restore 2:4:2 or RGN-6", productNames: ["SkinCeuticals Triple Lipid Restore 2:4:2 | Anti-Aging Moisturizer for Skin Barrier Repair & Hydration"] },
    ],
  },
  diamond: {
    am: [
      { label: "Simply Clean Cleanser", productNames: ["SkinCeuticals Simply Clean | Gentle Foaming Cleanser for All Skin Types"] },
      { label: "CE Ferulic", productNames: ["SkinCeuticals C E Ferulic | Antioxidant Vitamin C Serum for Brightening & Anti-Aging"] },
      { label: "P-Tiox", productNames: ["SkinCeuticals P-Tiox | Glass Skin Serum for Skin Protection & Repair"] },
      { label: "HA Intensifier", productNames: ["SkinCeuticals Hyaluronic Acid Intensifier | Multi-Glycan Hydrating Serum for Plump & Smooth Skin"] },
      { label: "On The Daily SPF 45 or Let's Get Physical Tinted SPF 44", productNames: ["The Treatment On The Daily SPF 45 | Lightweight Sunscreen for Daily Protection", "The Treatment Let's Get Physical Tinted SPF 44 | Lightweight Tinted Sunscreen with Broad Spectrum Protection"] },
    ],
    pm: [
      { label: "Simply Clean Cleanser", productNames: ["SkinCeuticals Simply Clean | Gentle Foaming Cleanser for All Skin Types"] },
      { label: "Retinol 0.5", productNames: ["SkinCeuticals Retinol 0.5% | Anti-Aging Serum for Wrinkles & Skin Renewal"] },
      { label: "P-Tiox", productNames: ["SkinCeuticals P-Tiox | Glass Skin Serum for Skin Protection & Repair"] },
      { label: "HA Intensifier", productNames: ["SkinCeuticals Hyaluronic Acid Intensifier | Multi-Glycan Hydrating Serum for Plump & Smooth Skin"] },
      { label: "Triple Lipid Restore 2:4:2", productNames: ["SkinCeuticals Triple Lipid Restore 2:4:2 | Anti-Aging Moisturizer for Skin Barrier Repair & Hydration"] },
    ],
  },
};

/** In-person treatment recommendations per skin type for "Your personalized treatment recommendations" section. */
export const TREATMENT_RECOMMENDATIONS_BY_SKIN_TYPE: Record<
  GemstoneId,
  { heading: string; items: string[] }
> = {
  opal: {
    heading: "Reactive, breakout-prone, with stubborn pigmentation",
    items: [
      "BBL/Moxi – For pigmentation and redness (laser consultation will determine which is best)",
      "PRFM Injections – Healing and collagen support",
      "Cosmelan Peel – For deeper pigment correction",
      "Sweating Treatment with Botox – Helps manage oil and sweat",
    ],
  },
  pearl: {
    heading: "Reactive, breakout-prone, not prone to pigmentation",
    items: [
      "PRFM Injections – Regenerates skin and improves barrier",
      "Sweating Treatment with Botox – Controls oil and sweat",
      "Sofwave/Ultherapy – Tightening treatment with no downtime",
      "Fillers – For contour and volume",
      "Microneedling – Collagen stimulation and textural improvement",
    ],
  },
  jade: {
    heading: "Tolerant skin prone to pigmentation and sun damage",
    items: [
      "Cosmelan Peel – Corrects stubborn pigmentation",
      "BBL/Moxi – Brightens and evens tone (laser consultation will determine best option)",
      "Sofwave/Ultherapy – Firms and stimulates collagen",
      "Sculptra – Long-term collagen stimulation",
      "Dermasweep – Gently exfoliates and radiates",
    ],
  },
  quartz: {
    heading: "Balanced, clear skin — ideal for advanced rejuvenation",
    items: [
      "Sofwave/Ultherapy – Tightens and improves skin quality",
      "Sculptra – Collagen and structural support",
      "Fillers – For contour and volume",
      "PRFM Microneedling – Collagen stimulation and textural improvement with brightening benefits",
    ],
  },
  amber: {
    heading: "Delicate skin with discoloration — needs gentle pigment correction",
    items: [
      "BBL/Moxi – Brightens and evens tone (laser consultation will determine best option)",
      "PRFM Microneedling – Collagen stimulation with brightening benefits",
      "SkinVive – Gentle hydration and radiance",
      "Cosmelan Peel – Pigmentation correction",
      "Sculptra – Collagen and structural support, enhanced skin glow",
    ],
  },
  moonstone: {
    heading: "Extremely delicate and dry — needs nurturing, low-risk options",
    items: [
      "SkinVive – Hydration without irritation",
      "Ultherapy or Sofwave – Tightening and collagen boost",
      "PRFM Injections – Repair and texture enhancement",
      "Sculptra – Collagen and structural support, skin glow",
      "BBL – Calms the skin",
    ],
  },
  turquoise: {
    heading: "Tolerant skin with visible pigment and early aging",
    items: [
      "Cosmelan Peel – Comprehensive pigment reset",
      "BBL/Moxi – Corrects tone and sun damage (laser consultation will determine best option)",
      "PRFM Microneedling – Collagen stimulation with brightening benefits",
      "Fillers – For natural contour and replenishment",
      "SkinVive – Helps hydrate skin",
    ],
  },
  diamond: {
    heading: "Resilient, aging skin — ideal for full rejuvenation plans",
    items: [
      "Ultherapy or Sofwave – Lifting and firming",
      "Sculptra – Collagen regeneration, skin glow",
      "Fillers – Volume and definition",
      "SkinVive – Hydration and glow boost",
    ],
  },
};

/** Short advice (legacy; gemstone quiz has no secondary tendency). */
export const SECONDARY_TENDENCY_ADVICE: Partial<Record<GemstoneId, string>> = {};

// ---------------------------------------------------------------------------
// Scoring: answer index (0-based) per question id → total per skin type → winner
// ---------------------------------------------------------------------------

/** Display order for section score breakdown (results screen). */
export const SECTION_SCORE_ORDER: QuizSectionId[] = [
  "hydration",
  "reactivity",
  "pigmentation",
];

/** Backward compatibility: same as SECTION_SCORE_ORDER for iteration. */
export const SKIN_TYPE_SCORE_ORDER: QuizSectionId[] = SECTION_SCORE_ORDER;

/**
 * Compute section totals from quiz answers (A=1, B=2, C=3, D=4 per question).
 * @param answersByQuestionId Map of question id → selected answer index (0-based)
 * @returns Section scores (hydration 5–20, reactivity 6–24, pigmentation 5–20)
 */
export function computeQuizScores(
  answersByQuestionId: Record<string, number>
): Record<QuizSectionId, number> {
  const totals: Record<QuizSectionId, number> = {
    hydration: 0,
    reactivity: 0,
    pigmentation: 0,
  };
  for (const q of SKIN_TYPE_QUIZ.questions) {
    const answerIndex = answersByQuestionId[q.id];
    if (answerIndex == null || answerIndex < 0 || answerIndex >= q.answers.length)
      continue;
    const answer = q.answers[answerIndex];
    const points = "points" in answer ? answer.points : 0;
    if (q.section && totals[q.section] !== undefined) {
      totals[q.section] += points;
    }
  }
  return totals;
}

/**
 * Compute gemstone result from quiz answers.
 * @param answersByQuestionId Map of question id → selected answer index (0-based)
 * @returns The gemstone skin type (e.g. opal, quartz)
 */
export function computeQuizResult(
  answersByQuestionId: Record<string, number>
): GemstoneId {
  return computeQuizProfile(answersByQuestionId).primary;
}

/** Profile: primary gemstone, section scores, and section letters (D/O, S/R, P/N). */
export interface SkinProfile {
  primary: GemstoneId;
  scores: Record<QuizSectionId, number>;
  sectionLetters: Record<QuizSectionId, string>;
}

/**
 * Compute full profile from quiz answers (gemstone + section scores and letters).
 */
export function computeQuizProfile(
  answersByQuestionId: Record<string, number>
): SkinProfile {
  const scores = computeQuizScores(answersByQuestionId);
  const sectionLetters = getSectionLetters(scores);
  const primary = getGemstoneFromSectionScores(scores);
  return { primary, scores, sectionLetters };
}

/**
 * Human-readable result label and description from a profile.
 * Used on the results screen and stored in the quiz payload.
 */
export function getResultSummary(profile: SkinProfile): {
  label: string;
  description: string;
} {
  const desc = SKIN_TYPE_QUIZ.resultDescriptions?.[profile.primary];
  const label = desc?.label ?? profile.primary;
  const description = desc?.description ?? "";
  return { label, description };
}

// ---------------------------------------------------------------------------
// Skin type → product names (must match names in treatmentBoutiqueProducts / getSkincareCarouselItems)
// Aligned with RECOMMENDED_PRODUCTS_BY_CONTEXT Skincare categories where possible.
// ---------------------------------------------------------------------------

export const SKIN_TYPE_TO_PRODUCTS: Record<GemstoneId, string[]> = {
  opal: [
    "SkinCeuticals Simply Clean | Gentle Foaming Cleanser for All Skin Types",
    "SkinCeuticals Phloretin CF | Antioxidant Serum for Environmental Damage & Uneven Skin Tone",
    "SkinCeuticals Silymarin CF | Antioxidant Serum for Oily & Acne-Prone Skin",
    "SkinCeuticals Discoloration Defense | Targeted Serum for Dark Spots & Uneven Skin Tone",
    "SkinCeuticals Phyto Corrective Gel | Soothing Hydrating Serum for Redness & Sensitive Skin",
    "SkinCeuticals P-Tiox | Glass Skin Serum for Skin Protection & Repair",
    "SkinCeuticals Blemish + Age Defense | Targeted Serum for Acne and Signs of Aging",
    "The Treatment On The Daily SPF 45 | Lightweight Sunscreen for Daily Protection",
    "The Treatment Let's Get Physical Tinted SPF 44 | Lightweight Tinted Sunscreen with Broad Spectrum Protection",
  ],
  pearl: [
    "SkinCeuticals Simply Clean | Gentle Foaming Cleanser for All Skin Types",
    "SkinCeuticals Phloretin CF | Antioxidant Serum for Environmental Damage & Uneven Skin Tone",
    "SkinCeuticals Phyto Corrective Gel | Soothing Hydrating Serum for Redness & Sensitive Skin",
    "SkinCeuticals P-Tiox | Glass Skin Serum for Skin Protection & Repair",
    "The Treatment On The Daily SPF 45 | Lightweight Sunscreen for Daily Protection",
    "SkinCeuticals Daily Moisture | Lightweight Hydrating Moisturizer for All Skin Types",
  ],
  jade: [
    "SkinCeuticals Simply Clean | Gentle Foaming Cleanser for All Skin Types",
    "SkinCeuticals Silymarin CF | Antioxidant Serum for Oily & Acne-Prone Skin",
    "SkinCeuticals Discoloration Defense | Targeted Serum for Dark Spots & Uneven Skin Tone",
    "SkinCeuticals Blemish + Age Defense | Targeted Serum for Acne and Signs of Aging",
    "SkinCeuticals P-Tiox | Glass Skin Serum for Skin Protection & Repair",
    "SkinCeuticals LHA Cleanser | Exfoliating Face Wash for Acne-Prone & Congested Skin",
    "SkinCeuticals Retinol 0.5% | Anti-Aging Serum for Wrinkles & Skin Renewal",
    "The Treatment On The Daily SPF 45 | Lightweight Sunscreen for Daily Protection",
  ],
  quartz: [
    "SkinCeuticals Simply Clean | Gentle Foaming Cleanser for All Skin Types",
    "SkinCeuticals Gentle Cleanser | Soothing Cream Cleanser for Dry & Sensitive Skin",
    "SkinCeuticals Phloretin CF | Antioxidant Serum for Environmental Damage & Uneven Skin Tone",
    "SkinCeuticals Silymarin CF | Antioxidant Serum for Oily & Acne-Prone Skin",
    "SkinCeuticals Blemish + Age Defense | Targeted Serum for Acne and Signs of Aging",
    "SkinCeuticals P-Tiox | Glass Skin Serum for Skin Protection & Repair",
    "SkinCeuticals Retinol 0.5% | Anti-Aging Serum for Wrinkles & Skin Renewal",
    "SkinCeuticals Daily Moisture | Lightweight Hydrating Moisturizer for All Skin Types",
    "The Treatment On The Daily SPF 45 | Lightweight Sunscreen for Daily Protection",
  ],
  amber: [
    "SkinCeuticals Gentle Cleanser | Soothing Cream Cleanser for Dry & Sensitive Skin",
    "SkinCeuticals Phloretin CF | Antioxidant Serum for Environmental Damage & Uneven Skin Tone",
    "SkinCeuticals Hyaluronic Acid Intensifier | Multi-Glycan Hydrating Serum for Plump & Smooth Skin",
    "SkinCeuticals Discoloration Defense | Targeted Serum for Dark Spots & Uneven Skin Tone",
    "SkinCeuticals P-Tiox | Glass Skin Serum for Skin Protection & Repair",
    "SkinCeuticals Phyto Corrective Gel | Soothing Hydrating Serum for Redness & Sensitive Skin",
    "SkinCeuticals Triple Lipid Restore 2:4:2 | Anti-Aging Moisturizer for Skin Barrier Repair & Hydration",
    "The Treatment On The Daily SPF 45 | Lightweight Sunscreen for Daily Protection",
  ],
  moonstone: [
    "SkinCeuticals Gentle Cleanser | Soothing Cream Cleanser for Dry & Sensitive Skin",
    "SkinCeuticals Serum 10 AOX | Antioxidant Serum with 10% Vitamin C for Brightening & Protection",
    "SkinCeuticals Hyaluronic Acid Intensifier | Multi-Glycan Hydrating Serum for Plump & Smooth Skin",
    "SkinCeuticals P-Tiox | Glass Skin Serum for Skin Protection & Repair",
    "SkinCeuticals Phyto A+ Brightening Treatment | Lightweight Gel Moisturizer for Dull, Uneven Skin",
    "SkinCeuticals Emollience | Hydrating Moisturizer for Normal to Dry Skin",
    "The Treatment On The Daily SPF 45 | Lightweight Sunscreen for Daily Protection",
  ],
  turquoise: [
    "SkinCeuticals Replenishing Cleanser | Hydrating Face Wash for Dry & Sensitive Skin",
    "SkinCeuticals Phloretin CF | Antioxidant Serum for Environmental Damage & Uneven Skin Tone",
    "SkinCeuticals Discoloration Defense | Targeted Serum for Dark Spots & Uneven Skin Tone",
    "SkinCeuticals P-Tiox | Glass Skin Serum for Skin Protection & Repair",
    "SkinCeuticals Hyaluronic Acid Intensifier | Multi-Glycan Hydrating Serum for Plump & Smooth Skin",
    "SkinCeuticals Triple Lipid Restore 2:4:2 | Anti-Aging Moisturizer for Skin Barrier Repair & Hydration",
    "The Treatment On The Daily SPF 45 | Lightweight Sunscreen for Daily Protection",
  ],
  diamond: [
    "SkinCeuticals Simply Clean | Gentle Foaming Cleanser for All Skin Types",
    "SkinCeuticals C E Ferulic | Antioxidant Vitamin C Serum for Brightening & Anti-Aging",
    "SkinCeuticals P-Tiox | Glass Skin Serum for Skin Protection & Repair",
    "SkinCeuticals Hyaluronic Acid Intensifier | Multi-Glycan Hydrating Serum for Plump & Smooth Skin",
    "SkinCeuticals Retinol 0.5% | Anti-Aging Serum for Wrinkles & Skin Renewal",
    "SkinCeuticals Triple Lipid Restore 2:4:2 | Anti-Aging Moisturizer for Skin Barrier Repair & Hydration",
    "The Treatment On The Daily SPF 45 | Lightweight Sunscreen for Daily Protection",
  ],
};

/**
 * Why we recommend each product (for quiz results UI).
 * Shown as "Recommended for: …" under each product. Key = exact product name from SKIN_TYPE_TO_PRODUCTS.
 */
export const RECOMMENDED_PRODUCT_REASONS: Record<string, string> = {
  "SkinCeuticals Hyaluronic Acid Intensifier | Multi-Glycan Hydrating Serum for Plump & Smooth Skin":
    "Deep hydration & plumping",
  "SkinCeuticals Hydrating B5 Gel | Lightweight Moisturizer with Vitamin B5 for Deep Skin Hydration":
    "Lightweight hydration",
  "GM Collin Daily Ceramide Comfort | Nourishing Skin Barrier Capsules for Hydration & Repair (20 Ct.)":
    "Barrier repair & hydration",
  "SkinCeuticals Triple Lipid Restore 2:4:2 | Anti-Aging Moisturizer for Skin Barrier Repair & Hydration":
    "Barrier repair & hydration",
  "SkinCeuticals Hydra Balm | Intensive Moisturizing Balm for Compromised, Dry & Dehydrated Skin":
    "Intensive moisture for dry skin",
  "SkinCeuticals Renew Overnight | Intensive Night Cream for Dry & Dehydrated Skin":
    "Night hydration",
  "SkinCeuticals Emollience | Hydrating Moisturizer for Normal to Dry Skin":
    "Hydration for normal to dry",
  "SkinCeuticals Blemish + Age Defense | Targeted Serum for Acne and Signs of Aging":
    "Acne & oil control, anti-aging",
  "SkinCeuticals Silymarin CF | Antioxidant Serum for Oily & Acne-Prone Skin":
    "Oil control & antioxidant protection",
  "SkinCeuticals Purifying Cleanser | Deep Cleansing Face Wash for Oily & Acne-Prone Skin":
    "Deep cleansing, oil control",
  "Skinceuticals Clarifying Clay Mask | Detoxifying Face Mask for Oil Control":
    "Oil control & clarifying",
  "SkinCeuticals Daily Moisture | Lightweight Hydrating Moisturizer for All Skin Types":
    "Lightweight hydration, all skin types",
  "The TreatMINT Cooling Clay Mask | Detoxifying & Refreshing Face Mask for Clear Skin":
    "Detoxifying & clear skin",
  "SkinCeuticals Equalizing Toner | Alcohol-Free Toner for Balanced, Refreshed Skin":
    "Balance & refresh",
  "SkinCeuticals Phyto Corrective Gel | Soothing Hydrating Serum for Redness & Sensitive Skin":
    "Soothing redness & sensitivity",
  "The Treatment On The Daily SPF 45 | Lightweight Sunscreen for Daily Protection":
    "Daily sun protection",
  "SkinCeuticals Simply Clean | Gentle Foaming Cleanser for All Skin Types":
    "Gentle cleansing",
  "SkinCeuticals P-Tiox | Glass Skin Serum for Skin Protection & Repair":
    "Protection & repair",
  "SkinCeuticals C E Ferulic | Antioxidant Vitamin C Serum for Brightening & Anti-Aging":
    "Brightening & antioxidant protection",
  "GM Collin Sensiderm Cleansing Milk | Gentle Cleanser for Sensitive & Irritated Skin":
    "Gentle cleansing for sensitive skin",
  "SkinCeuticals Soothing Cleanser | Gentle Face Wash for Sensitive & Irritated Skin":
    "Gentle cleansing for sensitive skin",
  "SkinCeuticals Redness Neutralizer | Soothing Serum for Sensitive & Redness-Prone Skin":
    "Redness & sensitivity",
  "SkinCeuticals Epidermal Repair | Calming Therapeutic Treatment for Compromised or Sensitive Skin":
    "Calming & barrier repair",
  "SkinCeuticals Phloretin CF | Antioxidant Serum for Environmental Damage & Uneven Skin Tone":
    "Even tone & environmental protection",
  "SkinCeuticals Discoloration Defense | Targeted Serum for Dark Spots & Uneven Skin Tone":
    "Dark spots & uneven tone",
  "SkinCeuticals Phyto A+ Brightening Treatment | Lightweight Gel Moisturizer for Dull, Uneven Skin":
    "Brightening & even tone",
  "SkinCeuticals Serum 10 AOX | Antioxidant Serum with 10% Vitamin C for Brightening & Protection":
    "Vitamin C brightening & protection",
  "SkinCeuticals Glycolic 10 Renew Overnight | Exfoliating Night Serum for Smoother, Radiant Skin":
    "Gentle exfoliation & radiance",
};

/**
 * Return recommended product names for a skin type (from our boutique list).
 * Use with getSkincareCarouselItems() or TREATMENT_BOUTIQUE_SKINCARE to resolve to full product objects.
 */
export function getRecommendedProductsForSkinType(skinType: GemstoneId): string[] {
  return [...(SKIN_TYPE_TO_PRODUCTS[skinType] ?? [])];
}

// ---------------------------------------------------------------------------
// Persistence: build payload for Airtable "Skincare Quiz" long text field
// ---------------------------------------------------------------------------

/** Airtable field name for the skincare quiz JSON (same in Patients and Web Popup Leads). */
export const SKINCARE_QUIZ_FIELD_NAME = "Skincare Quiz";

/**
 * Build the object to store in Airtable "Skincare Quiz" (long text) as JSON.
 * Use with updateLeadRecord(recordId, tableName, { [SKINCARE_QUIZ_FIELD_NAME]: JSON.stringify(payload) }).
 */
export function buildSkincareQuizPayload(answersByQuestionId: Record<string, number>): {
  version: 1;
  completedAt: string;
  answers: Record<string, number>;
  result: GemstoneId;
  recommendedProductNames: string[];
  resultLabel?: string;
  resultDescription?: string;
} {
  const profile = computeQuizProfile(answersByQuestionId);
  const { label: resultLabel, description: resultDescription } =
    getResultSummary(profile);
  return {
    version: 1,
    completedAt: new Date().toISOString(),
    answers: { ...answersByQuestionId },
    result: profile.primary,
    recommendedProductNames: getRecommendedProductsForSkinType(profile.primary),
    resultLabel,
    resultDescription,
  };
}
