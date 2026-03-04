/**
 * Wellness Quiz – peptide/treatment recommendations from Dr Reddy Treatment Offerings.
 * Questions map to criteria (age, goals, conditions); scoring suggests one or more treatments.
 */

/** Set to true to show the Wellness Quiz section and modal in the client detail UI. */
export const WELLNESS_QUIZ_ENABLED = false;

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
}

export interface WellnessQuizData {
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
      "Anyone aged 30+ with significant contact sports, extreme workouts, or physically active after 40 (male and female)",
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
      "Stimulates the body’s own growth hormone release in a physiologic way. Used for anti-aging, recovery, and energy in adults 40+.",
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

/** Quiz questions: goals and age to suggest treatments. */
export const WELLNESS_QUIZ: WellnessQuizData = {
  treatments: WELLNESS_TREATMENTS,
  questions: [
    {
      id: "age",
      title: "Age range",
      question: "What is your age range?",
      answers: [
        { label: "Under 30", scores: {} },
        {
          label: "30–39",
          scores: {
            "bpc-157": 1,
            "tb-500": 1,
            "cjc-1295": 1,
            "semax": 1,
            "selank": 1,
            "melanotan-2": 1,
            "aod-9604": 1,
          },
        },
        {
          label: "40–49",
          scores: {
            "bpc-157": 1,
            "tb-500": 1,
            "cjc-1295": 1,
            "ipamorelin": 1,
            "semax": 1,
            "selank": 1,
            "ghk-cu": 1,
            "sermorelin": 1,
            "tessamorelin": 1,
            "epitalon": 1,
            "aod-9604": 1,
          },
        },
        {
          label: "50–59",
          scores: {
            "bpc-157": 1,
            "tb-500": 1,
            "cjc-1295": 1,
            "ipamorelin": 1,
            "semax": 1,
            "selank": 1,
            "ghrp-2-6": 1,
            "igf-1-lr3": 1,
            "ghk-cu": 1,
            "sermorelin": 1,
            "tessamorelin": 1,
            "epitalon": 1,
            "aod-9604": 1,
            "cartalax": 1,
          },
        },
        {
          label: "60+",
          scores: {
            "bpc-157": 1,
            "tb-500": 1,
            "cjc-1295": 1,
            "ipamorelin": 1,
            "semax": 1,
            "selank": 1,
            "p21": 2,
            "pinealon": 2,
            "ghrp-2-6": 1,
            "igf-1-lr3": 1,
            "ghk-cu": 1,
            "mk-677": 1,
            "sermorelin": 1,
            "tessamorelin": 1,
            "epitalon": 1,
            "cartalax": 1,
          },
        },
      ],
    },
    {
      id: "activity",
      title: "Activity level",
      question: "How would you describe your physical activity level?",
      answers: [
        { label: "Mostly sedentary or light activity", scores: {} },
        {
          label: "Moderately active (exercise a few times a week)",
          scores: { "bpc-157": 1, "tb-500": 1 },
        },
        {
          label: "Very active / athletic (frequent intense or contact sports, heavy training)",
          scores: { "bpc-157": 2, "tb-500": 2 },
        },
      ],
    },
    {
      id: "bodyComposition",
      title: "Body composition",
      question: "What best describes your body-composition goal?",
      answers: [
        { label: "No specific goal / general wellness", scores: {} },
        {
          label: "Weight or overall fat loss",
          scores: { "aod-9604": 2, tessamorelin: 1, "cjc-1295": 1 } as Record<string, number>,
        },
        {
          label: "Belly or midsection (visceral) fat",
          scores: { tessamorelin: 2, "aod-9604": 1 } as Record<string, number>,
        },
        {
          label: "Building or maintaining muscle",
          scores: {
            "cjc-1295": 2,
            ipamorelin: 2,
            "ghrp-2-6": 2,
            "igf-1-lr3": 2,
          },
        },
      ],
    },
    {
      id: "skinInterest",
      title: "Skin & appearance",
      question: "Are you interested in peptide options for skin or appearance?",
      answers: [
        { label: "No / not a priority", scores: {} },
        {
          label: "Yes – skin firmness, elasticity, or anti-aging",
          scores: { "ghk-cu": 2, sermorelin: 1 } as Record<string, number>,
        },
        {
          label: "Yes – tanning or skin tone",
          scores: { "melanotan-2": 2 },
        },
      ],
    },
    {
      id: "goals",
      title: "Primary goals",
      question: "What are your main wellness goals? (Select all that apply)",
      answers: [
        {
          label: "Injury or sports recovery",
          scores: { "bpc-157": 2, "tb-500": 2 },
        },
        {
          label: "Muscle growth or toning",
          scores: {
            "cjc-1295": 2,
            "ipamorelin": 2,
            "ghrp-2-6": 2,
            "igf-1-lr3": 2,
          },
        },
        {
          label: "Energy and recovery",
          scores: { "cjc-1295": 2, "ipamorelin": 1, "sermorelin": 1 },
        },
        {
          label: "Sleep support",
          scores: { ipamorelin: 2 } as Record<string, number>,
        },
        {
          label: "Memory, focus, or brain fog",
          scores: { semax: 2, selank: 1, "p21": 2, pinealon: 2 } as Record<string, number>,
        },
        {
          label: "Anxiety, stress, or mood",
          scores: { selank: 2 } as Record<string, number>,
        },
        {
          label: "Skin health or anti-aging",
          scores: { "ghk-cu": 2, sermorelin: 1, epitalon: 1 } as Record<string, number>,
        },
        {
          label: "Fat loss or metabolism",
          scores: {
            "cjc-1295": 1,
            tessamorelin: 2,
            "aod-9604": 2,
            epitalon: 1,
          } as Record<string, number>,
        },
        {
          label: "Bone or joint health",
          scores: { "mk-677": 2, cartalax: 2 } as Record<string, number>,
        },
        {
          label: "General anti-aging / longevity",
          scores: { sermorelin: 2, epitalon: 2, "ghk-cu": 1 } as Record<string, number>,
        },
      ],
    },
    {
      id: "conditions",
      title: "Conditions",
      question: "Do any of these apply? (Select all that apply)",
      answers: [
        {
          label: "GI or gut issues",
          scores: { "bpc-157": 2 },
        },
        {
          label: "Chronic inflammation or tendon/ligament issues",
          scores: { "bpc-157": 2, "tb-500": 2 },
        },
        {
          label: "Osteoporosis or bone density concerns",
          scores: { "mk-677": 2 },
        },
        {
          label: "Osteoarthritis or cartilage wear",
          scores: { "mk-677": 1, cartalax: 2 } as Record<string, number>,
        },
        {
          label: "None of these",
          scores: {},
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
  answers: Record<string, number | number[]>,
  treatmentId: string
): string[] {
  const reasons: string[] = [];
  for (const q of WELLNESS_QUIZ.questions) {
    const raw = answers[q.id];
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
 * Compute suggested treatment IDs from quiz answers.
 * Multi-select: each question can have multiple answers (stored as array of answer indices).
 * We sum scores per treatment, filter by age (minAge), and return treatments with score >= threshold.
 */
export function computeWellnessQuizResult(answersByQuestionId: Record<string, number | number[]>): string[] {
  const treatmentScores: Record<string, number> = {};
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
  const ageNum = ageLabel.includes("60+")
    ? 60
    : ageLabel.includes("50")
      ? 50
      : ageLabel.includes("40")
        ? 40
        : ageLabel.includes("30")
          ? 30
          : 0;

  for (const q of WELLNESS_QUIZ.questions) {
    const raw = answersByQuestionId[q.id];
    const indices = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
    for (const idx of indices) {
      if (typeof idx !== "number" || idx < 0 || idx >= q.answers.length) continue;
      const answer = q.answers[idx];
      for (const [tid, weight] of Object.entries(answer.scores)) {
        const w = weight ?? 0;
        treatmentScores[tid] = (treatmentScores[tid] ?? 0) + w;
      }
    }
  }

  const threshold = 1;
  const suggested = WELLNESS_TREATMENTS.filter((t) => {
    const score = treatmentScores[t.id] ?? 0;
    if (score < threshold) return false;
    if (t.minAge != null && ageNum > 0 && ageNum < t.minAge) return false;
    return true;
  });

  return suggested.map((t) => t.id);
}

/** Build payload to store in Airtable (e.g. "Wellness Quiz" long text). */
export function buildWellnessQuizPayload(answersByQuestionId: Record<string, number | number[]>): {
  version: 1;
  completedAt: string;
  answers: Record<string, number | number[]>;
  suggestedTreatmentIds: string[];
} {
  const suggestedTreatmentIds = computeWellnessQuizResult(answersByQuestionId);
  return {
    version: 1,
    completedAt: new Date().toISOString(),
    answers: { ...answersByQuestionId },
    suggestedTreatmentIds,
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

export const WELLNESS_QUIZ_FIELD_NAME = "Wellness Quiz";
