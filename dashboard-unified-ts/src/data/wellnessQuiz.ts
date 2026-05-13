/**
 * Wellness Quiz – peptide/treatment recommendations from Dr Reddy Treatment Offerings.
 * Questions map to criteria (age, goals, conditions); scoring suggests one or more treatments.
 * Kept in sync with skin-type-react `wellnessQuiz.ts` treatment list and question flow.
 */

import {
  getWellnestOfferingByTreatmentName,
  isWellnestWellnessProviderCode,
  WELLNEST_BROWSE_GROUP_LABELS,
  WELLNEST_BROWSE_GROUP_ORDER,
} from "./wellnestOfferings";
import type { WellnessQuizCategoryScore, WellnessQuizData } from "../types";

/** Stored quiz answers: single index, multi indices, or per-option severity maps. */
export type WellnessQuizAnswersMap = WellnessQuizData["answers"];

/** Set to true to show the Wellness Quiz section and modal in the client detail UI (all non-Wellnest providers). */
export const WELLNESS_QUIZ_ENABLED = false;

/**
 * Client detail / modal: show Wellness Quiz when {@link WELLNESS_QUIZ_ENABLED} is true,
 * or when the signed-in provider is Wellnest (peptide UI — replaces Skin Quiz for that org).
 */
export function isWellnessQuizShownForDashboardProvider(
  providerCode: string | undefined,
): boolean {
  return WELLNESS_QUIZ_ENABLED || isWellnestWellnessProviderCode(providerCode);
}

/** Single treatment offering from the spreadsheet. */
export interface WellnessTreatment {
  id: string;
  name: string;
  category: string;
  whatItAddresses: string;
  /** Short plain-language summary of what this peptide is used for (for results display). */
  summary?: string;
  idealDemographics: string;
  deliveryMethod: string;
  pricing: string;
  notes: string;
  duration: string;
  /** Keywords used to match quiz answers (goals/conditions). */
  matchKeywords: string[];
  /** Minimum age from demographics (e.g. 30, 40, 50, 60, 65). */
  minAge?: number;
}

/** One answer option: label and which treatment IDs it suggests (weight 1 = weak match, 2 = strong). */
export interface WellnessQuizAnswer {
  label: string;
  /** Treatment IDs this answer suggests; value = weight for scoring. */
  scores: Partial<Record<string, number>>;
}

export interface WellnessQuizQuestion {
  id: string;
  title: string;
  question: string;
  answers: WellnessQuizAnswer[];
  /**
   * When set, this step collects impact 0–4 per selected answer index of another question
   * (e.g. after multi-select goals). Answers array is unused for this step.
   */
  severityForQuestionId?: string;
  /** Render this question as a multi-select chip grid (vs. single-select button list). */
  multiSelect?: boolean;
  /**
   * When set, this is a contraindication screening step.
   * Value = index of the "None of these apply" answer (mutually exclusive with all others).
   * A warning is shown in the UI if any non-none option is selected.
   */
  contraindicationNoneIndex?: number;
}

/** In-repo quiz definition (questions + treatment catalog). Not the Airtable JSON shape. */
export interface WellnessQuizDefinition {
  questions: WellnessQuizQuestion[];
  treatments: WellnessTreatment[];
}

/** All treatments from Dr Reddy Treatment Offerings CSV (rows 2–19). */
export const WELLNESS_TREATMENTS: WellnessTreatment[] = [
  {
    id: "bpc-157",
    name: "BPC-157",
    category: "Injury recovery, inflammation, gut health",
    whatItAddresses:
      "Soft tissue repair support, tendon/ligament recovery, chronic GI issues, GI lining support, anti-inflammatory properties",
    summary:
      "A peptide that supports soft tissue and tendon/ligament repair, reduces inflammation, and helps with gut lining and chronic GI issues. Often used after injury or intense training.",
    idealDemographics:
      "Anyone aged 30+ with significant contact sports, extreme workouts, or physically active after 40\n(male and female)",
    deliveryMethod: "SC injection (best), oral and nasal spray available",
    pricing: "$250",
    notes: "5 weeks supply, prepared under strict aseptic precautions",
    duration: "2 weeks – 8 weeks",
    matchKeywords: ["injury", "recovery", "gut", "gi", "inflammation", "sports", "tendon", "ligament"],
    minAge: 30,
  },
  {
    id: "tb-500",
    name: "Thymosin Beta-4 (TB-500 fragment)",
    category: "Musculoskeletal injury",
    whatItAddresses: "Accelerated muscle recovery, reduced inflammation, improved mobility",
    summary:
      "Supports faster muscle recovery, reduces inflammation, and improves mobility. Commonly used alongside BPC-157 for sports and activity-related injuries.",
    idealDemographics:
      "Anyone aged 30+ with contact sports, extreme workouts, or physically active after 40",
    deliveryMethod: "SC injection (best), nasal spray available",
    pricing: "$200",
    notes: "Ready to use, aseptic precautions",
    duration: "1 week – 8 weeks",
    matchKeywords: ["injury", "muscle", "recovery", "inflammation", "mobility", "sports"],
    minAge: 30,
  },
  {
    id: "cjc-1295",
    name: "CJC-1295",
    category: "Low energy, poor recovery, metabolic optimization",
    whatItAddresses: "Increased IGF-1, fat metabolism support, improved recovery",
    summary:
      "Promotes natural growth hormone release and IGF-1, supporting energy, recovery, fat metabolism, and muscle toning. Used for metabolic and body-composition goals.",
    idealDemographics: "Poor muscle mass gain, toning in men and women",
    deliveryMethod: "SC injection",
    pricing: "$250",
    notes: "5 weeks minimum",
    duration: "4 weeks – 10 weeks",
    matchKeywords: ["energy", "recovery", "metabolic", "muscle", "toning", "fat metabolism"],
    minAge: 30,
  },
  {
    id: "ipamorelin",
    name: "Ipamorelin",
    /** Not sleep-only in clinical use; plan builder lets staff set per-patient focus via `interest`. */
    category: "Sleep and Muscle growth",
    whatItAddresses:
      "Selective ghrelin receptor agonist, natural GH release, minimal cortisol elevation, lean mass preservation",
    summary:
      "Stimulates natural growth hormone release with minimal side effects. Supports sleep quality, lean muscle preservation, and recovery—often preferred for 40+ for sleep and body composition.",
    idealDemographics: "Aged 40+ both sexes",
    deliveryMethod: "SC injection only",
    pricing: "$250",
    notes: "5 weeks",
    duration: "4 weeks – 10 weeks",
    matchKeywords: ["sleep", "muscle", "growth", "recovery"],
    minAge: 40,
  },
  {
    id: "semax",
    name: "Semax",
    category: "Memory",
    whatItAddresses: "Brain fog, focus, cognitive decline",
    summary:
      "A nootropic peptide that may support focus, clarity, and cognitive function. Used to address brain fog and mild cognitive concerns.",
    idealDemographics: "Aged 30+",
    deliveryMethod: "SC injection, nasal spray available",
    pricing: "$300",
    notes: "10 weeks supply",
    duration: "8 weeks – 16 weeks",
    matchKeywords: ["memory", "focus", "cognitive", "brain fog"],
    minAge: 30,
  },
  {
    id: "selank",
    name: "Selank",
    category: "Anxiety, Fatigue, chronic stress",
    whatItAddresses: "Anxiolytic effects, improved cognition, mood balance",
    summary:
      "Supports mood balance, reduced anxiety, and improved resilience to stress. May also support cognition and fatigue related to stress.",
    idealDemographics: "Aged 30+ both sexes",
    deliveryMethod: "SC injection ideal",
    pricing: "$300–500",
    notes: "5–10 weeks",
    duration: "6 weeks – 16 weeks",
    matchKeywords: ["anxiety", "fatigue", "stress", "mood", "cognition"],
    minAge: 30,
  },
  {
    id: "p21",
    name: "P 21",
    category: "Memory",
    whatItAddresses: "Synapse regeneration",
    summary:
      "Supports synapse regeneration and cognitive function. Typically considered for older adults (60+) with memory or cognitive decline concerns.",
    idealDemographics: "Aged 60+",
    deliveryMethod: "SC injection",
    pricing: "$500",
    notes: "10 weeks",
    duration: "3–6 months",
    matchKeywords: ["memory", "cognitive", "synapse"],
    minAge: 60,
  },
  {
    id: "pinealon",
    name: "Pinealon",
    category: "Memory",
    whatItAddresses: "Brain oxidative defense, cognitive decline",
    summary:
      "Supports brain antioxidant defenses and may help with age-related cognitive decline. Often used in the 60+ population for memory and clarity.",
    idealDemographics: "Aged 60+",
    deliveryMethod: "SC injection",
    pricing: "$500",
    notes: "10–16 weeks",
    duration: "3–6 months",
    matchKeywords: ["memory", "cognitive", "brain"],
    minAge: 60,
  },
  {
    id: "ghrp-2-6",
    name: "GHRP-2 / GHRP-6",
    category: "Muscle loss",
    whatItAddresses: "Recovery, body composition",
    summary:
      "Growth hormone–releasing peptides that support recovery and body composition. Used to help maintain or build lean mass and support energy in adults 35+.",
    idealDemographics: "Aged 35+",
    deliveryMethod: "SC injection",
    pricing: "$250",
    notes: "5 weeks",
    duration: "2–5 months",
    matchKeywords: ["muscle", "recovery", "body composition"],
    minAge: 35,
  },
  {
    id: "igf-1-lr3",
    name: "IGF-1 LR3",
    category: "Muscle bulk assistance",
    whatItAddresses: "Muscle growth",
    summary:
      "A long-acting form of IGF-1 that supports muscle growth and recovery. Often used by those 35+ seeking muscle bulk or athletic performance support.",
    idealDemographics: "Aged 35+",
    deliveryMethod: "SC injection",
    pricing: "$250",
    notes: "5 weeks",
    duration: "2–5 months",
    matchKeywords: ["muscle", "growth", "bulk"],
    minAge: 35,
  },
  {
    id: "ghk-cu",
    name: "GHK-Cu",
    category: "Skin health",
    whatItAddresses: "Skin firmness, skin laxity and elastin stimulation",
    summary:
      "Copper peptide that supports skin firmness, elasticity, and repair. Used for skin laxity, anti-aging, and wound healing—often in 40+ for skin and longevity goals.",
    idealDemographics: "Aged 40+",
    deliveryMethod: "SC injection or face peptide cream",
    pricing: "$250–350",
    notes: "5–8 weeks",
    duration: "2–3 months",
    matchKeywords: ["skin", "firmness", "laxity", "elastin", "anti-aging"],
    minAge: 40,
  },
  {
    id: "melanotan-2",
    name: "Melanotan 2",
    category: "Skin Tan, libido",
    whatItAddresses: "Melanin increase, libido increase",
    summary:
      "Supports natural tanning through melanin stimulation and may support libido. Used by adults 30+ for tanning and related wellness goals.",
    idealDemographics: "Natural tanning peptide",
    deliveryMethod: "SC injection",
    pricing: "$200 onwards",
    notes: "5 weeks minimum",
    duration: "3 months",
    matchKeywords: ["tan", "libido"],
    minAge: 30,
  },
  {
    id: "mk-677",
    name: "MK-677",
    category: "Osteoporosis, Osteoarthritis",
    whatItAddresses: "Bone density decline prevention",
    summary:
      "An oral growth hormone secretagogue that may support bone density and joint health. Often considered for adults 65+ with osteoporosis or osteoarthritis concerns.",
    idealDemographics: "Aged 65+",
    deliveryMethod: "SC injection",
    pricing: "$350–600",
    notes: "5–10 weeks",
    duration: "3 months",
    matchKeywords: ["bone", "osteoporosis", "osteoarthritis", "bone density"],
    minAge: 65,
  },
  {
    id: "sermorelin",
    name: "Sermorelin",
    category: "Anti Aging",
    whatItAddresses: "Physiologic GH stimulation, anti-aging interest",
    summary:
      "Stimulates the body's own growth hormone release in a physiologic way. Used for anti-aging, recovery, and energy in adults 40+.",
    idealDemographics: "Aged 40+",
    deliveryMethod: "SC injection",
    pricing: "$300–500",
    notes: "5–10 weeks",
    duration: "8–12 weeks",
    matchKeywords: ["anti-aging", "recovery", "growth hormone"],
    minAge: 40,
  },
  {
    id: "tessamorelin",
    name: "Tessamorelin",
    category: "Fat, especially visceral fat excess",
    whatItAddresses: "Obesity adjunct therapy",
    summary:
      "Targets visceral fat and supports healthy body composition. Used as an adjunct for weight and metabolic goals in adults 40+.",
    idealDemographics: "Aged 40+",
    deliveryMethod: "SC injection",
    pricing: "$500",
    notes: "5–10 weeks",
    duration: "3 months",
    matchKeywords: ["fat", "visceral", "obesity", "weight"],
    minAge: 40,
  },
  {
    id: "epitalon",
    name: "Epitalon",
    category: "Cellular aging",
    whatItAddresses: "Metabolism reset",
    summary:
      "Supports cellular aging and metabolism. Used for longevity and general anti-aging in adults 40+.",
    idealDemographics: "Aged 40+",
    deliveryMethod: "SC injection",
    pricing: "$400–500",
    notes: "5–10 weeks",
    duration: "3 months",
    matchKeywords: ["aging", "cellular", "metabolism"],
    minAge: 40,
  },
  {
    id: "aod-9604",
    name: "AOD 9604",
    category: "Fat metabolism",
    whatItAddresses: "Obesity adjunct therapy",
    summary:
      "A fragment of growth hormone that supports fat metabolism and body composition. Used as an adjunct for weight and metabolic goals in adults 30+.",
    idealDemographics: "Aged 30+ both sexes",
    deliveryMethod: "SC injection",
    pricing: "$300–500",
    notes: "1–2 months",
    duration: "3 months",
    matchKeywords: ["fat", "metabolism", "obesity", "weight"],
    minAge: 30,
  },
  {
    id: "cartalax",
    name: "Cartalax",
    category: "Osteoarthritis",
    whatItAddresses: "Cartilage repair",
    summary:
      "Supports cartilage repair and joint health. Used for osteoarthritis and joint wear in adults 50+.",
    idealDemographics: "Aged 50+",
    deliveryMethod: "SC injection",
    pricing: "$350–500",
    notes: "5–10 weeks",
    duration: "3 months",
    matchKeywords: ["joint", "cartilage", "osteoarthritis"],
    minAge: 50,
  },
];

/** Quiz questions: domain-specific symptom questions that score treatments by severity. */
export const WELLNESS_QUIZ: WellnessQuizDefinition = {
  treatments: WELLNESS_TREATMENTS,
  questions: [
    // ── Q1: Age — gates minAge only, no scoring ───────────────────────────────
    {
      id: "age",
      title: "About you",
      question: "What is your age range?",
      answers: [
        { label: "Under 30", scores: {} },
        { label: "30–39", scores: {} },
        { label: "40–49", scores: {} },
        { label: "50–59", scores: {} },
        { label: "60–64", scores: {} },
        { label: "65+", scores: {} },
      ],
    },
    // ── Q2: Physical activity ─────────────────────────────────────────────────
    {
      id: "activity",
      title: "Physical Activity",
      question: "How would you describe your typical physical activity level?",
      answers: [
        { label: "Mostly sedentary — desk work, minimal exercise", scores: {} },
        {
          label: "Light activity — walking, yoga, or casual movement most days",
          scores: { "bpc-157": 1 },
        },
        {
          label: "Moderately active — gym or cardio 3–4 times per week",
          scores: { "bpc-157": 1, "tb-500": 1, "cjc-1295": 1 },
        },
        {
          label: "Very active — intense daily training",
          scores: { "bpc-157": 2, "tb-500": 2, "cjc-1295": 1 },
        },
        {
          label: "High-performance or contact sports — extreme exertion, heavy impact",
          scores: { "bpc-157": 3, "tb-500": 3, "cjc-1295": 2, "igf-1-lr3": 1 },
        },
      ],
    },
    // ── Q3: Injury & tissue recovery ─────────────────────────────────────────
    {
      id: "injury",
      title: "Injury & Tissue Recovery",
      question: "How are you managing with injuries, tissue recovery, or chronic inflammation?",
      answers: [
        { label: "No current injuries or recovery concerns", scores: {} },
        {
          label: "Mild — occasional soreness or a mostly-healed past injury",
          scores: { "bpc-157": 1, "tb-500": 1 },
        },
        {
          label: "Moderate — recurring tendon, ligament, or soft-tissue inflammation",
          scores: { "bpc-157": 2, "tb-500": 2 },
        },
        {
          label: "Significant — active injury or post-surgical recovery in progress",
          scores: { "bpc-157": 3, "tb-500": 3 },
        },
        {
          label: "Chronic — persistent inflammation or soft-tissue issues limiting daily life",
          scores: { "bpc-157": 3, "tb-500": 2 },
        },
      ],
    },
    // ── Q4: Gut & digestive health ────────────────────────────────────────────
    {
      id: "gut",
      title: "Gut & Digestive Health",
      question: "How would you describe your digestive health and gut comfort?",
      answers: [
        { label: "Good — no significant gut or GI concerns", scores: {} },
        {
          label: "Occasional — bloating or mild discomfort after certain foods",
          scores: { "bpc-157": 1 },
        },
        {
          label: "Frequent — regular bloating, gas, or GI discomfort",
          scores: { "bpc-157": 2 },
        },
        {
          label: "Chronic — IBS symptoms, gut pain, or frequent GI flares",
          scores: { "bpc-157": 3 },
        },
        {
          label: "Significant — gut lining issues, inflammatory bowel, or post-antibiotic gut damage",
          scores: { "bpc-157": 4 },
        },
      ],
    },
    // ── Q5: Energy & vitality ─────────────────────────────────────────────────
    {
      id: "energy",
      title: "Energy & Vitality",
      question: "How is your energy and drive throughout a typical day?",
      answers: [
        { label: "Consistent — strong energy from morning through evening", scores: {} },
        {
          label: "Mild dips — some afternoon fatigue, generally functional",
          scores: { "cjc-1295": 1, "sermorelin": 1 },
        },
        {
          label: "Regular fatigue — energy crashes most afternoons, often rely on caffeine",
          scores: { "cjc-1295": 2, "sermorelin": 1, "selank": 1 },
        },
        {
          label: "Low energy — tired much of the day, affects productivity",
          scores: { "cjc-1295": 3, "sermorelin": 2, "selank": 1 },
        },
        {
          label: "Exhausted — chronic fatigue is a primary daily concern",
          scores: { "cjc-1295": 3, "sermorelin": 2, "selank": 2, "ipamorelin": 1 },
        },
      ],
    },
    // ── Q6: Sleep quality ─────────────────────────────────────────────────────
    {
      id: "sleep",
      title: "Sleep Quality",
      question: "How would you describe your sleep quality and how rested you feel on waking?",
      answers: [
        { label: "Good — fall asleep easily, sleep through the night, wake rested", scores: {} },
        {
          label: "Mild issues — occasionally slow to fall asleep or slight grogginess on waking",
          scores: { "ipamorelin": 1 },
        },
        {
          label: "Regular disruption — frequently wake during the night or struggle to fall asleep",
          scores: { "ipamorelin": 2 },
        },
        {
          label: "Poor — rarely feel rested; sleep quality is consistently compromised",
          scores: { "ipamorelin": 3 },
        },
        {
          label: "Significant insomnia — sleep disruption is a major daily health concern",
          scores: { "ipamorelin": 4 },
        },
      ],
    },
    // ── Q7: Cognitive health ──────────────────────────────────────────────────
    {
      id: "cognitive",
      title: "Cognitive Health",
      question: "How would you rate your mental clarity, focus, and memory?",
      answers: [
        { label: "Sharp — clear thinking, good memory, strong focus", scores: {} },
        {
          label: "Occasional fog — some brain fog or forgetfulness, generally manageable",
          scores: { "semax": 1, "selank": 1 },
        },
        {
          label: "Frequent fog — brain fog regularly affecting work, decisions, or daily tasks",
          scores: { "semax": 2, "selank": 1 },
        },
        {
          label: "Noticeable decline — meaningful memory gaps or sustained poor concentration",
          scores: { "semax": 3, "p21": 2, "pinealon": 2 },
        },
        {
          label: "Significant concern — cognitive decline is a primary health priority",
          scores: { "semax": 3, "p21": 3, "pinealon": 3 },
        },
      ],
    },
    // ── Q8: Mood & stress ─────────────────────────────────────────────────────
    {
      id: "mood",
      title: "Mood & Stress",
      question: "How does anxiety or chronic stress affect your daily life?",
      answers: [
        { label: "Well-managed — generally calm and resilient to stress", scores: {} },
        {
          label: "Mild — occasional anxiety or stress that passes relatively quickly",
          scores: { "selank": 1 },
        },
        {
          label: "Moderate — anxiety or stress regularly affecting mood or productivity",
          scores: { "selank": 2 },
        },
        {
          label: "Significant — chronic stress or anxiety meaningfully impacting daily quality of life",
          scores: { "selank": 3 },
        },
        {
          label: "Primary concern — mood and anxiety management is a top health priority",
          scores: { "selank": 4 },
        },
      ],
    },
    // ── Q9: Body composition ──────────────────────────────────────────────────
    {
      id: "bodyComposition",
      title: "Body Composition",
      question: "What is your main body-composition challenge?",
      answers: [
        { label: "None — satisfied with current body composition", scores: {} },
        {
          label: "Mild stubborn fat — diet and exercise help but progress is slow",
          scores: { "aod-9604": 1, "cjc-1295": 1 },
        },
        {
          label:
            "Belly or visceral fat — midsection fat that doesn’t respond well to standard effort",
          scores: { "tessamorelin": 2, "aod-9604": 1, "cjc-1295": 1 } as Record<string, number>,
        },
        {
          label: "Difficulty building or maintaining muscle despite training and adequate protein",
          scores: {
            "cjc-1295": 2,
            "ipamorelin": 1,
            "ghrp-2-6": 2,
            "igf-1-lr3": 2,
          },
        },
        {
          label: "Both — struggling with fat loss and muscle retention simultaneously",
          scores: {
            "cjc-1295": 2,
            "aod-9604": 2,
            "tessamorelin": 1,
            "ghrp-2-6": 1,
          } as Record<string, number>,
        },
      ],
    },
    // ── Q10: Skin health ──────────────────────────────────────────────────────
    {
      id: "skin",
      title: "Skin Health",
      question: "How would you describe your current skin health and aging concerns?",
      answers: [
        { label: "No skin concerns — not a current focus", scores: {} },
        {
          label: "Early changes — some fine lines or mild elasticity changes beginning to appear",
          scores: { "ghk-cu": 1, "sermorelin": 1 },
        },
        {
          label: "Noticeable — visible loss of skin firmness, elasticity, or skin laxity",
          scores: { "ghk-cu": 2, "sermorelin": 1, "epitalon": 1 },
        },
        {
          label: "Significant — prominent sagging, substantial laxity, or advanced skin aging",
          scores: { "ghk-cu": 3, "sermorelin": 1, "epitalon": 1 },
        },
      ],
    },
    // ── Q11: Tanning & libido ─────────────────────────────────────────────────
    {
      id: "appearance",
      title: "Tanning & Libido",
      question: "Do any of the following resonate with your personal wellness goals?",
      answers: [
        { label: "Neither — not relevant to my goals", scores: {} },
        {
          label: "Natural tanning — interested in melanin-based tanning support",
          scores: { "melanotan-2": 3 },
        },
        {
          label: "Libido support — interested in peptide support for libido",
          scores: { "melanotan-2": 3 },
        },
        {
          label: "Both — natural tanning and libido support are both goals",
          scores: { "melanotan-2": 4 },
        },
      ],
    },
    // ── Q12: Bone & joint health ──────────────────────────────────────────────
    {
      id: "boneJoint",
      title: "Bone & Joint Health",
      question: "How are your joints, cartilage, and bone health?",
      answers: [
        { label: "No concerns — joints and bones feel healthy and functional", scores: {} },
        {
          label: "Mild — occasional stiffness or minor joint aches that pass on their own",
          scores: { "cartalax": 1, "mk-677": 1 },
        },
        {
          label: "Moderate — regular joint pain or stiffness that limits some activities",
          scores: { "cartalax": 2, "mk-677": 1 },
        },
        {
          label: "Significant — diagnosed osteoarthritis or notable cartilage wear",
          scores: { "cartalax": 3, "mk-677": 2 },
        },
        {
          label: "Bone density concern — osteoporosis or fracture risk is a health priority",
          scores: { "mk-677": 3, "cartalax": 1 },
        },
      ],
    },
    // ── Q13: Longevity & anti-aging ───────────────────────────────────────────
    {
      id: "longevity",
      title: "Longevity & Anti-Aging",
      question: "How important is active aging and longevity to your wellness goals?",
      answers: [
        {
          label: "Not a focus — addressing specific symptoms is my main goal right now",
          scores: {},
        },
        {
          label: "Somewhat interested — healthy aging matters but isn’t a top priority",
          scores: { "epitalon": 1, "sermorelin": 1 },
        },
        {
          label:
            "Actively interested — I take an intentional approach to slowing the aging process",
          scores: { "epitalon": 2, "sermorelin": 2, "ghk-cu": 1 },
        },
        {
          label: "Primary goal — longevity optimization is central to my health strategy",
          scores: {
            "epitalon": 3,
            "sermorelin": 2,
            "ghk-cu": 1,
            "p21": 1,
            "pinealon": 1,
          } as Record<string, number>,
        },
      ],
    },
  ],
};

/** Get treatment by id. */
export function getWellnessTreatmentById(id: string): WellnessTreatment | undefined {
  return WELLNESS_TREATMENTS.find((t) => t.id === id);
}

/**
 * Return human-readable reasons why this treatment was suggested (which quiz answers contributed).
 * Used to show "How this matches your answers" in the client detail wellness section.
 */
export function getWellnessQuizMatchReasons(
  answers: WellnessQuizAnswersMap,
  treatmentId: string,
): string[] {
  const reasons: string[] = [];
  for (const q of WELLNESS_QUIZ.questions) {
    if (q.severityForQuestionId || q.answers.length === 0) continue;
    const raw = answers[q.id];
    if (raw != null && typeof raw === "object" && !Array.isArray(raw)) continue;
    const indices = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
    const labels: string[] = [];
    for (const idx of indices) {
      if (typeof idx !== "number" || idx < 0 || idx >= q.answers.length) continue;
      const answer = q.answers[idx];
      const score = answer.scores[treatmentId];
      if (score != null && score > 0) labels.push(answer.label);
    }
    if (labels.length > 0) reasons.push(`${q.title}: ${labels.join(", ")}`);
  }
  return reasons;
}

/**
 * Answer option labels that contributed points to this treatment (deduped, quiz question order).
 * Compact for plan-builder chips; use {@link getWellnessQuizMatchReasons} for full "Question: answers" lines.
 *
 * By default skips **age range** when any other question also contributed (age scores many peptides);
 * if age is the only scoring driver, age labels are still returned.
 */
export function getWellnessQuizMatchAnswerLabelsForTreatment(
  answers: WellnessQuizAnswersMap,
  treatmentId: string,
  opts?: { skipQuestionIds?: readonly string[] },
): string[] {
  const collect = (skipQuestionIds: Set<string>): string[] => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const q of WELLNESS_QUIZ.questions) {
      if (q.severityForQuestionId || q.answers.length === 0) continue;
      if (skipQuestionIds.has(q.id)) continue;
      const raw = answers[q.id];
      if (raw != null && typeof raw === "object" && !Array.isArray(raw)) continue;
      const indices = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
      for (const idx of indices) {
        if (typeof idx !== "number" || idx < 0 || idx >= q.answers.length) {
          continue;
        }
        const answer = q.answers[idx];
        const score = answer.scores[treatmentId];
        if (score != null && score > 0) {
          const lab = answer.label.trim();
          if (lab && !seen.has(lab)) {
            seen.add(lab);
            out.push(lab);
          }
        }
      }
    }
    return out;
  };

  const skip = new Set(opts?.skipQuestionIds ?? ["age"]);
  const withoutSkipped = collect(skip);
  if (withoutSkipped.length > 0) return withoutSkipped;
  return collect(new Set());
}

/** Severity 0–4 → multiplier on peptide row scores for that answer (degree, not binary). */
export function wellnessSeverityMultiplier(severity: number | undefined): number {
  if (severity == null || Number.isNaN(severity)) return 1;
  const s = Math.min(4, Math.max(0, Math.round(severity)));
  const table = [0.45, 0.78, 1, 1.32, 1.68];
  return table[s] ?? 1;
}

export function getWellnessSeverityRecord(
  answers: WellnessQuizAnswersMap,
  severityQuestionId: string,
): Record<string, number> {
  const v = answers[severityQuestionId];
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "number" && Number.isFinite(val)) out[k] = val;
  }
  return out;
}

/**
 * Indices from the source multi-select that need an impact rating (skips options with no scoring weights, e.g. "None of these").
 */
export function getWellnessSeveritySourceIndices(
  severityQuestion: WellnessQuizQuestion,
  answers: WellnessQuizAnswersMap,
): number[] {
  const sourceId = severityQuestion.severityForQuestionId;
  if (!sourceId) return [];
  const srcQ = WELLNESS_QUIZ.questions.find((q) => q.id === sourceId);
  if (!srcQ) return [];
  const raw = answers[sourceId];
  const indices = Array.isArray(raw) ? raw : raw != null ? [raw as number] : [];
  const out: number[] = [];
  for (const idx of indices) {
    if (typeof idx !== "number" || idx < 0 || idx >= srcQ.answers.length) continue;
    const scores = srcQ.answers[idx]?.scores ?? {};
    if (Object.keys(scores).length === 0) continue;
    out.push(idx);
  }
  return out;
}

function wellnessQuizAgeNum(answersByQuestionId: WellnessQuizAnswersMap): number {
  const ageAnswer = answersByQuestionId["age"];
  const ageIndex = Array.isArray(ageAnswer) ? ageAnswer[0] : ageAnswer;
  const ageQuestion = WELLNESS_QUIZ.questions.find((q) => q.id === "age");
  const ageLabel =
    typeof ageIndex === "number" &&
    ageQuestion &&
    ageIndex >= 0 &&
    ageIndex < ageQuestion.answers.length
      ? ageQuestion.answers[ageIndex].label
      : "";
  if (ageLabel.startsWith("65")) return 65;
  if (ageLabel.startsWith("60")) return 60;
  if (ageLabel.startsWith("50")) return 50;
  if (ageLabel.startsWith("40")) return 40;
  if (ageLabel.startsWith("30")) return 30;
  return 0;
}

/**
 * Weighted peptide scores from all quiz steps.
 */
export function computeWellnessTreatmentScores(
  answersByQuestionId: WellnessQuizAnswersMap,
): Record<string, number> {
  const treatmentScores: Record<string, number> = {};
  const goalsSev = getWellnessSeverityRecord(answersByQuestionId, "goalsSeverity");
  const condSev = getWellnessSeverityRecord(answersByQuestionId, "conditionsSeverity");

  for (const q of WELLNESS_QUIZ.questions) {
    if (q.severityForQuestionId) continue;
    const raw = answersByQuestionId[q.id];
    if (raw != null && typeof raw === "object" && !Array.isArray(raw)) continue;
    const indices = Array.isArray(raw) ? raw : raw != null ? [raw as number] : [];
    for (const idx of indices) {
      if (typeof idx !== "number" || idx < 0 || idx >= q.answers.length) continue;
      const answer = q.answers[idx];
      const mult =
        q.id === "goals"
          ? wellnessSeverityMultiplier(goalsSev[String(idx)])
          : q.id === "conditions"
            ? wellnessSeverityMultiplier(condSev[String(idx)])
            : 1;
      for (const [tid, weight] of Object.entries(answer.scores)) {
        const w = (weight ?? 0) * mult;
        treatmentScores[tid] = (treatmentScores[tid] ?? 0) + w;
      }
    }
  }
  return treatmentScores;
}

export function selectSuggestedTreatmentIdsFromScores(
  treatmentScores: Record<string, number>,
  answersByQuestionId: WellnessQuizAnswersMap,
): string[] {
  const ageNum = wellnessQuizAgeNum(answersByQuestionId);
  const threshold = 1;
  return WELLNESS_TREATMENTS.filter((t) => {
    const score = treatmentScores[t.id] ?? 0;
    if (score < threshold) return false;
    if (t.minAge != null && ageNum > 0 && ageNum < t.minAge) return false;
    return true;
  }).map((t) => t.id);
}

export function aggregateWellnessCategoryScores(
  treatmentScores: Record<string, number>,
): WellnessQuizCategoryScore[] {
  const byBucket: Record<string, number> = {};
  for (const [tid, score] of Object.entries(treatmentScores)) {
    if (score <= 0) continue;
    const t = getWellnessTreatmentById(tid);
    if (!t) continue;
    const off = getWellnestOfferingByTreatmentName(t.name);
    const bucket = off?.browseGroup;
    if (!bucket) continue;
    byBucket[bucket] = (byBucket[bucket] ?? 0) + score;
  }
  const max = Math.max(...Object.values(byBucket), 1);
  const ordered: WellnessQuizCategoryScore[] = [];
  for (const id of WELLNEST_BROWSE_GROUP_ORDER) {
    const raw = byBucket[id] ?? 0;
    if (raw <= 0) continue;
    ordered.push({
      id,
      label: WELLNEST_BROWSE_GROUP_LABELS[id] ?? id,
      raw,
      percent: Math.round((raw / max) * 100),
    });
  }
  for (const [id, raw] of Object.entries(byBucket)) {
    if (raw <= 0) continue;
    if ((WELLNEST_BROWSE_GROUP_ORDER as readonly string[]).includes(id)) continue;
    ordered.push({
      id,
      label: WELLNEST_BROWSE_GROUP_LABELS[id] ?? id,
      raw,
      percent: Math.round((raw / max) * 100),
    });
  }
  return ordered.sort((a, b) => b.raw - a.raw);
}

/**
 * Compute suggested treatment IDs from quiz answers (legacy + v2 impact-weighted).
 */
export function computeWellnessQuizResult(
  answersByQuestionId: WellnessQuizAnswersMap,
): string[] {
  const treatmentScores = computeWellnessTreatmentScores(answersByQuestionId);
  return selectSuggestedTreatmentIdsFromScores(
    treatmentScores,
    answersByQuestionId,
  );
}

/** Category bars for client UI — uses stored scores when present, else recomputes from answers. */
export function getWellnessQuizDisplayCategoryScores(
  quiz:
    | Pick<WellnessQuizData, "answers" | "categoryScores">
    | null
    | undefined,
): WellnessQuizCategoryScore[] {
  if (!quiz?.answers) return [];
  if (quiz.categoryScores && quiz.categoryScores.length > 0)
    return quiz.categoryScores;
  const treatmentScores = computeWellnessTreatmentScores(quiz.answers);
  return aggregateWellnessCategoryScores(treatmentScores);
}

/** Build payload to store in Airtable (e.g. "Wellness Quiz" long text). */
export function buildWellnessQuizPayload(
  answersByQuestionId: WellnessQuizAnswersMap,
): WellnessQuizData {
  const treatmentScores = computeWellnessTreatmentScores(answersByQuestionId);
  const suggestedTreatmentIds = selectSuggestedTreatmentIdsFromScores(
    treatmentScores,
    answersByQuestionId,
  );
  const categoryScores = aggregateWellnessCategoryScores(treatmentScores);
  return {
    version: 2,
    completedAt: new Date().toISOString(),
    answers: { ...answersByQuestionId },
    suggestedTreatmentIds,
    categoryScores,
  };
}

/** Resolve full treatment objects from stored quiz payload (for display). */
export function getSuggestedWellnessTreatments(quiz: { suggestedTreatmentIds: string[] }): WellnessTreatment[] {
  return quiz.suggestedTreatmentIds
    .map((id) => getWellnessTreatmentById(id))
    .filter((t): t is WellnessTreatment => t != null);
}

/**
 * Build an SMS-friendly message with wellness quiz results and recommended peptides.
 * Used when sending results to the client via SMS from the client details page.
 */
export function getWellnessQuizResultsSMSMessage(quiz: {
  suggestedTreatmentIds: string[];
}): string {
  const treatments = getSuggestedWellnessTreatments(quiz);
  if (treatments.length === 0) {
    return "Your wellness quiz results are ready. No specific peptides were suggested this time—consider discussing your goals with your provider.";
  }
  const intro = "Your wellness quiz results. We suggest discussing these with your provider:\n\n";
  const lines = treatments.map((t) => {
    const summary = t.summary ?? t.whatItAddresses;
    const short = summary.length > 80 ? summary.slice(0, 77) + "..." : summary;
    return `• ${t.name}: ${short}`;
  });
  return intro + lines.join("\n\n");
}

/** Match intake wellness goal labels against peptide/education text (shared with plan builder). */
export type IntakeGoalMatchResult = {
  score: number;
  matchedGoals: string[];
};

function normalizeWellnestGoalToken(value: string): string {
  return value.trim().toLowerCase();
}

function expandWellnestGoalAliases(goal: string): string[] {
  const g = normalizeWellnestGoalToken(goal);
  const aliases: Record<string, string[]> = {
    recovery: ["recovery", "injury", "muscle", "mobility", "training"],
    "training support": ["training", "recovery", "muscle", "performance"],
    energy: ["energy", "fatigue", "metabolic"],
    sleep: ["sleep", "rest"],
    focus: ["focus", "memory", "cognitive", "brain fog"],
    longevity: ["longevity", "anti-aging", "cellular aging", "metabolism"],
    "stress balance": ["stress", "anxiety", "mood"],
    "body composition": ["body composition", "fat", "weight", "metabolic"],
    "metabolic support": [
      "metabolic",
      "fat metabolism",
      "weight",
      "visceral fat",
    ],
    gut: ["gut", "gi", "inflammation"],
    "gut comfort": ["gut", "gi", "inflammation"],
  };
  const mapped = aliases[g] ?? [];
  return Array.from(new Set([g, ...mapped]));
}

/**
 * Score how well intake wellness goals align with a treatment description corpus
 * (summary, what-it-addresses, keywords, etc.).
 */
export function scoreIntakeGoalsAgainstWellnestCorpus(
  goals: string[],
  treatmentCorpus: string,
  matchKeywords: string[],
): IntakeGoalMatchResult {
  const matchedGoals = new Set<string>();
  const normalizedCorpus = normalizeWellnestGoalToken(treatmentCorpus);
  const keywords = (matchKeywords ?? [])
    .map((k) => normalizeWellnestGoalToken(k))
    .filter((k) => k.length >= 3);
  let score = 0;
  for (const rawGoal of goals) {
    const goal = rawGoal.trim();
    const goalL = normalizeWellnestGoalToken(goal);
    if (!goalL) continue;
    const goalCandidates = expandWellnestGoalAliases(goal);
    let matched = false;
    for (const candidate of goalCandidates) {
      if (candidate.length >= 3 && normalizedCorpus.includes(candidate)) {
        score += 2;
        matched = true;
        break;
      }
      for (const kw of keywords) {
        if (
          candidate.includes(kw) ||
          kw.includes(candidate) ||
          candidate
            .split(/\s+/)
            .some((part) => part.length >= 3 && kw.includes(part))
        ) {
          score += 1;
          matched = true;
          break;
        }
      }
      if (matched) break;
    }
    if (matched) matchedGoals.add(goal);
  }
  return { score, matchedGoals: Array.from(matchedGoals) };
}

export const WELLNESS_QUIZ_FIELD_NAME = "Wellness Quiz";

export interface WellnessQuizDomainBreakdownItem {
  questionTitle: string;
  answerLabel: string;
  /** Total points this answer contributed to treatments in this domain. */
  points: number;
}

/**
 * For a given domain (browseGroup), returns the quiz answers that drove its score,
 * sorted highest points first. Shows the patient WHY a domain ranks where it does.
 */
export function getWellnessQuizDomainBreakdown(
  answers: WellnessQuizAnswersMap,
  treatmentIdsInDomain: Set<string>,
): WellnessQuizDomainBreakdownItem[] {
  const items: WellnessQuizDomainBreakdownItem[] = [];
  for (const q of WELLNESS_QUIZ.questions) {
    if (q.severityForQuestionId || q.answers.length === 0 || q.id === "age") continue;
    const raw = answers[q.id];
    if (raw == null) continue;
    if (typeof raw === "object" && !Array.isArray(raw)) continue;
    const indices = Array.isArray(raw) ? (raw as number[]) : [raw as number];
    for (const idx of indices) {
      if (typeof idx !== "number" || idx < 0 || idx >= q.answers.length) continue;
      const answer = q.answers[idx];
      let domainPts = 0;
      for (const [tid, pts] of Object.entries(answer.scores)) {
        if (treatmentIdsInDomain.has(tid) && pts != null && pts > 0) {
          domainPts += pts;
        }
      }
      if (domainPts > 0) {
        items.push({ questionTitle: q.title, answerLabel: answer.label, points: domainPts });
      }
    }
  }
  return items.sort((a, b) => b.points - a.points);
}

export interface WellnessQuizMatchBreakdownItem {
  questionTitle: string;
  answerLabel: string;
  /** Raw score points this answer contributed to this treatment. */
  points: number;
}

/** Per-question breakdown of why a treatment was scored, sorted highest points first. */
export function getWellnessQuizMatchBreakdownForTreatment(
  answers: WellnessQuizAnswersMap,
  treatmentId: string,
): WellnessQuizMatchBreakdownItem[] {
  const items: WellnessQuizMatchBreakdownItem[] = [];
  for (const q of WELLNESS_QUIZ.questions) {
    if (q.severityForQuestionId || q.answers.length === 0 || q.id === "age") continue;
    const raw = answers[q.id];
    if (raw == null) continue;
    if (typeof raw === "object" && !Array.isArray(raw)) continue;
    const indices = Array.isArray(raw) ? (raw as number[]) : [raw as number];
    for (const idx of indices) {
      if (typeof idx !== "number" || idx < 0 || idx >= q.answers.length) continue;
      const answer = q.answers[idx];
      const pts = answer.scores[treatmentId];
      if (pts != null && pts > 0) {
        items.push({ questionTitle: q.title, answerLabel: answer.label, points: pts });
      }
    }
  }
  return items.sort((a, b) => b.points - a.points);
}
