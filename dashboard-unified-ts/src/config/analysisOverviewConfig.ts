/**
 * Analysis overview config – categories, areas, scoring.
 * Used by AnalysisOverviewModal to show high-level scores, strengths, and areas for improvement.
 * Issue names aligned with dashboard/Airtable "Name (from All Issues) (from Analyses)".
 */

export function normalizeIssue(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/['']/g, "")
    .replace(/\s+/g, " ");
}

export interface SubScoreDef {
  name: string;
  issues: string[];
}

export interface CategoryDef {
  name: string;
  key: string;
  description: string;
  subScores: SubScoreDef[];
}

/** Short category descriptions for overview cards */
export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  skinHealth: "Covers wrinkles, texture, pigmentation, and hydration",
  volumeLoss: "Evaluates facial volume in the eye, cheek, neck, and lower face areas",
  proportions: "Assesses symmetry and balance of brow, jaw, nose, and lips",
};

export const CATEGORIES: CategoryDef[] = [
  {
    name: "Skin Health",
    key: "skinHealth",
    description: "Covers wrinkles, texture, pigmentation, and hydration",
    subScores: [
      {
        name: "Wrinkles",
        issues: [
          "Forehead Wrinkles",
          "Crow's Feet Wrinkles",
          "Glabella Wrinkles",
          "Under Eye Wrinkles",
          "Perioral Wrinkles",
          "Bunny Lines",
          "Neck Lines",
        ],
      },
      {
        name: "Texture",
        issues: [
          "Dry Skin",
          "Whiteheads",
          "Blackheads",
          "Crepey Skin",
          "Rosacea",
        ],
      },
      {
        name: "Pigmentation",
        issues: [
          "Dark Spots",
          "Red Spots",
          "Scars",
          "Under Eye Dark Circles",
        ],
      },
      {
        name: "Hydration",
        issues: [
          "Dry Skin",
          "Crepey Skin",
        ],
      },
    ],
  },
  {
    name: "Volume Loss",
    key: "volumeLoss",
    description: "Evaluates facial volume in the eye, cheek, neck, and lower face areas",
    subScores: [
      {
        name: "Eye Area",
        issues: ["Under Eye Hollow", "Upper Eye Hollow", "Lower Eyelid Bags"],
      },
      {
        name: "Cheek Area",
        issues: [
          "Mid Cheek Flattening",
          "Cheekbone - Not Prominent",
          "Heavy Lateral Cheek",
          "Temporal Hollow",
        ],
      },
      {
        name: "Neck Area",
        issues: [
          "Loose Neck Skin",
          "Platysmal Bands",
          "Excess/Submental Fullness",
        ],
      },
      {
        name: "Lower Face",
        issues: [
          "Nasolabial Folds",
          "Marionette Lines",
          "Jowls",
          "Lower Cheeks - Volume Depletion",
          "Prejowl Sulcus",
        ],
      },
    ],
  },
  {
    name: "Proportions",
    key: "proportions",
    description: "Assesses symmetry and balance of brow, jaw, nose, and lips",
    subScores: [
      {
        name: "Brow & Eyes",
        issues: [
          "Brow Asymmetry",
          "Flat Forehead",
          "Brow Ptosis",
          "Excess Upper Eyelid Skin",
          "Lower Eyelid - Excess Skin",
          "Upper Eyelid Droop",
          "Lower Eyelid Sag",
        ],
      },
      {
        name: "Jaw",
        issues: [
          "Ill-Defined Jawline",
          "Asymmetric Jawline",
          "Masseter Hypertrophy",
          "Retruded Chin",
          "Over-Projected Chin",
          "Asymmetric Chin",
        ],
      },
      {
        name: "Nose",
        issues: [
          "Crooked Nose",
          "Droopy Tip",
          "Dorsal Hump",
          "Tip Droop When Smiling",
        ],
      },
      {
        name: "Lips",
        issues: [
          "Thin Lips",
          "Lacking Philtral Column",
          "Long Philtral Column",
          "Gummy Smile",
          "Asymmetric Lips",
          "Dry Lips",
          "Lip Thinning When Smiling",
        ],
      },
    ],
  },
];

export interface AreaDef {
  name: string;
  issues: string[];
}

export const AREAS: AreaDef[] = [
  {
    name: "Forehead",
    issues: [
      "Forehead Wrinkles",
      "Glabella Wrinkles",
      "Brow Asymmetry",
      "Flat Forehead",
      "Brow Ptosis",
    ],
  },
  {
    name: "Eyes",
    issues: [
      "Crow's Feet Wrinkles",
      "Under Eye Wrinkles",
      "Under Eye Dark Circles",
      "Excess Upper Eyelid Skin",
      "Lower Eyelid - Excess Skin",
      "Upper Eyelid Droop",
      "Lower Eyelid Sag",
      "Lower Eyelid Bags",
      "Under Eye Hollow",
      "Upper Eye Hollow",
    ],
  },
  {
    name: "Cheeks",
    issues: [
      "Nasolabial Folds",
      "Mid Cheek Flattening",
      "Cheekbone - Not Prominent",
      "Heavy Lateral Cheek",
      "Temporal Hollow",
    ],
  },
  {
    name: "Nose",
    issues: [
      "Crooked Nose",
      "Droopy Tip",
      "Dorsal Hump",
      "Tip Droop When Smiling",
    ],
  },
  {
    name: "Lips",
    issues: [
      "Thin Lips",
      "Lacking Philtral Column",
      "Long Philtral Column",
      "Gummy Smile",
      "Asymmetric Lips",
      "Dry Lips",
      "Lip Thinning When Smiling",
    ],
  },
  {
    name: "Jawline",
    issues: [
      "Marionette Lines",
      "Jowls",
      "Lower Cheeks - Volume Depletion",
      "Ill-Defined Jawline",
      "Asymmetric Jawline",
      "Masseter Hypertrophy",
      "Prejowl Sulcus",
      "Retruded Chin",
      "Over-Projected Chin",
      "Asymmetric Chin",
      "Loose Neck Skin",
      "Platysmal Bands",
      "Excess/Submental Fullness",
    ],
  },
  {
    name: "Skin",
    issues: [
      "Perioral Wrinkles",
      "Bunny Lines",
      "Neck Lines",
      "Dark Spots",
      "Red Spots",
      "Scars",
      "Dry Skin",
      "Whiteheads",
      "Blackheads",
      "Crepey Skin",
      "Rosacea",
    ],
  },
];

export type ScoreTier = "excellent" | "good" | "moderate" | "attention";

export function scoreTier(score: number): ScoreTier {
  if (score >= 90) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "moderate";
  return "attention";
}

export function tierLabel(tier: ScoreTier): string {
  switch (tier) {
    case "excellent":
      return "Excellent";
    case "good":
      return "Very Good";
    case "moderate":
      return "Good";
    case "attention":
      return "Needs Attention";
  }
}

export function tierColor(tier: ScoreTier): string {
  switch (tier) {
    case "excellent":
      return "#43a047";
    case "good":
      return "#66bb6a";
    case "moderate":
      return "#f9a825";
    case "attention":
      return "#ef6c00";
  }
}

export function scoreIssues(
  issues: string[],
  detected: Set<string>
): number {
  if (issues.length === 0) return 100;
  const found = issues.filter((i) => detected.has(normalizeIssue(i))).length;
  return Math.round(((issues.length - found) / issues.length) * 100);
}

export interface SubScoreResult {
  name: string;
  score: number;
  tier: ScoreTier;
  total: number;
  detected: number;
}

export interface CategoryResult {
  name: string;
  key: string;
  score: number;
  tier: ScoreTier;
  subScores: SubScoreResult[];
}

export function computeCategories(
  detected: Set<string>
): CategoryResult[] {
  return CATEGORIES.map((cat) => {
    const subs: SubScoreResult[] = cat.subScores.map((sub) => {
      const found = sub.issues.filter((i) =>
        detected.has(normalizeIssue(i))
      ).length;
      const score = scoreIssues(sub.issues, detected);
      return {
        name: sub.name,
        score,
        tier: scoreTier(score),
        total: sub.issues.length,
        detected: found,
      };
    });
    const avg = Math.round(
      subs.reduce((sum, s) => sum + s.score, 0) / subs.length
    );
    return {
      name: cat.name,
      key: cat.key,
      score: avg,
      tier: scoreTier(avg),
      subScores: subs,
    };
  });
}

/**
 * Patient-specific description of how this category score was derived from their analysis.
 * Applies the framework to the patient's actual sub-scores instead of generic framework explanation.
 */
export function getCategoryDescriptionForPatient(catResult: CategoryResult): string {
  const subs = catResult.subScores;
  if (subs.length === 0) {
    return `Your ${catResult.name} score is ${catResult.score}, based on this analysis.`;
  }
  const subList = subs
    .map((s) => `${s.name} (${s.score})`)
    .join(", ");
  const sorted = [...subs].sort((a, b) => b.score - a.score);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];
  let tail: string;
  if (strongest === weakest) {
    tail = "All areas in this category contributed similarly to your score.";
  } else if (weakest.score >= 80) {
    tail = `Your strongest area here is ${strongest.name}. ${weakest.name} has the most room for subtle refinement.`;
  } else {
    tail = `Your strongest area here is ${strongest.name}. ${weakest.name} had the most findings in your analysis and is the main opportunity for improvement.`;
  }
  return `Your ${catResult.name} score of ${catResult.score} is based on ${subs.length} sub-areas from your analysis: ${subList}. ${tail}`;
}

/**
 * Patient-specific description of how this area score was derived from their analysis.
 * Mirrors the category score explanation style.
 */
export function getAreaDescriptionForPatient(areaResult: AreaResult): string {
  const total = areaResult.strengths.length + areaResult.improvements.length;
  if (total === 0) {
    return `Your ${areaResult.name} score is ${areaResult.score}, based on this analysis.`;
  }
  const impCount = areaResult.improvements.length;
  const strengthCount = areaResult.strengths.length;
  let main: string;
  if (impCount === 0) {
    main = `All ${total} features we evaluated in this area look good — no concerns detected.`;
  } else if (strengthCount === 0) {
    main = `We evaluated ${total} features; ${impCount} ${impCount === 1 ? "was" : "were"} identified in your analysis as opportunities for improvement.`;
  } else {
    main = `Your score of ${areaResult.score} is based on ${total} features: ${strengthCount} ${strengthCount === 1 ? "is" : "are"} in good shape and ${impCount} ${impCount === 1 ? "was" : "were"} identified as opportunities for improvement.`;
  }
  let tail: string;
  if (areaResult.score >= 90) {
    tail = "This area is in excellent shape.";
  } else if (areaResult.score >= 70) {
    tail = "There is some room for refinement here.";
  } else if (areaResult.score >= 50) {
    tail = "Targeted treatments in this area could make a meaningful difference.";
  } else {
    tail = "This area has the most opportunity for improvement based on your analysis.";
  }
  return `${main} ${tail}`;
}

export function computeOverall(categories: CategoryResult[]): number {
  if (categories.length === 0) return 100;
  return Math.round(
    categories.reduce((s, c) => s + c.score, 0) / categories.length
  );
}

export function splitStrengthsAndImprovements<T>(
  items: T[],
  getGoodCount: (t: T) => number,
  getImpCount: (t: T) => number
): { strengths: T[]; improvements: T[] } {
  const strengths: T[] = [];
  const improvements: T[] = [];
  for (const item of items) {
    const good = getGoodCount(item);
    const imp = getImpCount(item);
    if (good > imp) strengths.push(item);
    else if (imp > good) improvements.push(item);
    else strengths.push(item);
  }
  if (strengths.length === 0 && improvements.length > 0) {
    const sorted = [...improvements].sort(
      (a, b) => getImpCount(a) - getImpCount(b)
    );
    strengths.push(sorted.shift()!);
    improvements.length = 0;
    improvements.push(...sorted);
  }
  if (improvements.length === 0 && strengths.length > 0) {
    const sorted = [...strengths].sort(
      (a, b) => getGoodCount(a) - getGoodCount(b)
    );
    improvements.push(sorted.shift()!);
    strengths.length = 0;
    strengths.push(...sorted);
  }
  return { strengths, improvements };
}

export interface AreaResult {
  name: string;
  score: number;
  tier: ScoreTier;
  strengths: string[];
  improvements: string[];
  hasInterest: boolean;
}

export function computeAreas(
  detected: Set<string>,
  interestAreaNames: Set<string>
): AreaResult[] {
  return AREAS.map((area) => {
    const strengths: string[] = [];
    const improvements: string[] = [];
    area.issues.forEach((issue) => {
      if (detected.has(normalizeIssue(issue))) {
        improvements.push(issue);
      } else {
        strengths.push(issue);
      }
    });
    const score = scoreIssues(area.issues, detected);
    return {
      name: area.name,
      score,
      tier: scoreTier(score),
      strengths,
      improvements,
      hasInterest: interestAreaNames.has(area.name.toLowerCase()),
    };
  });
}

export interface AreaTheme {
  label: string;
  issues: string[];
}

export const AREA_THEMES: Record<string, AreaTheme[]> = {
  Forehead: [
    {
      label: "Wrinkles",
      issues: ["Forehead Wrinkles", "Glabella Wrinkles"],
    },
    {
      label: "Brow Position",
      issues: ["Brow Asymmetry", "Flat Forehead", "Brow Ptosis"],
    },
  ],
  Eyes: [
    {
      label: "Skin Laxity",
      issues: [
        "Excess Upper Eyelid Skin",
        "Lower Eyelid - Excess Skin",
        "Upper Eyelid Droop",
        "Lower Eyelid Sag",
      ],
    },
    {
      label: "Volume",
      issues: [
        "Lower Eyelid Bags",
        "Under Eye Hollow",
        "Upper Eye Hollow",
      ],
    },
    {
      label: "Fine Lines & Discoloration",
      issues: [
        "Crow's Feet Wrinkles",
        "Under Eye Wrinkles",
        "Under Eye Dark Circles",
      ],
    },
  ],
  Cheeks: [
    {
      label: "Volume & Contour",
      issues: [
        "Mid Cheek Flattening",
        "Cheekbone - Not Prominent",
        "Heavy Lateral Cheek",
        "Temporal Hollow",
      ],
    },
    { label: "Facial Lines", issues: ["Nasolabial Folds"] },
  ],
  Nose: [
    {
      label: "Shape & Symmetry",
      issues: [
        "Crooked Nose",
        "Droopy Tip",
        "Dorsal Hump",
        "Tip Droop When Smiling",
      ],
    },
  ],
  Lips: [
    {
      label: "Volume & Shape",
      issues: [
        "Thin Lips",
        "Lacking Philtral Column",
        "Long Philtral Column",
        "Asymmetric Lips",
      ],
    },
    {
      label: "Function & Texture",
      issues: ["Dry Lips", "Lip Thinning When Smiling", "Gummy Smile"],
    },
  ],
  Jawline: [
    {
      label: "Contour",
      issues: [
        "Jowls",
        "Ill-Defined Jawline",
        "Asymmetric Jawline",
        "Masseter Hypertrophy",
      ],
    },
    {
      label: "Chin",
      issues: [
        "Retruded Chin",
        "Over-Projected Chin",
        "Asymmetric Chin",
        "Prejowl Sulcus",
      ],
    },
    {
      label: "Volume",
      issues: [
        "Lower Cheeks - Volume Depletion",
        "Marionette Lines",
      ],
    },
    {
      label: "Neck",
      issues: [
        "Loose Neck Skin",
        "Platysmal Bands",
        "Excess/Submental Fullness",
      ],
    },
  ],
  Skin: [
    {
      label: "Fine Lines",
      issues: ["Perioral Wrinkles", "Bunny Lines", "Neck Lines"],
    },
    {
      label: "Texture",
      issues: [
        "Dry Skin",
        "Whiteheads",
        "Blackheads",
        "Crepey Skin",
        "Rosacea",
      ],
    },
    {
      label: "Pigmentation",
      issues: ["Dark Spots", "Red Spots", "Scars"],
    },
  ],
};

export interface ThemeSummary {
  label: string;
  type: "strength" | "improvement";
  detectedCount: number;
  totalCount: number;
  issues: string[];
}

export function summarizeAreaThemes(
  areaName: string,
  detected: Set<string>
): ThemeSummary[] {
  const themes = AREA_THEMES[areaName];
  if (!themes) return [];

  return themes.map((theme) => {
    const detectedIssues = theme.issues.filter((i) =>
      detected.has(normalizeIssue(i))
    );
    return {
      label: theme.label,
      type:
        detectedIssues.length > 0 ? ("improvement" as const) : ("strength" as const),
      detectedCount: detectedIssues.length,
      totalCount: theme.issues.length,
      issues: theme.issues,
    };
  });
}

export function generateAssessment(
  overall: number,
  categories: CategoryResult[],
  focusCount: number
): string {
  const sorted = [...categories].sort((a, b) => b.score - a.score);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];

  const allSubs = categories.flatMap((c) =>
    c.subScores.map((s) => ({ ...s, category: c.name }))
  );
  const lowestSub = allSubs.sort((a, b) => a.score - b.score)[0];

  let opener: string;
  if (overall >= 90) {
    opener = `Overall aesthetic score of ${overall} reflects an exceptionally well-balanced profile.`;
  } else if (overall >= 75) {
    opener = `Overall score of ${overall} shows a strong profile with clear areas of excellence.`;
  } else if (overall >= 60) {
    opener = `Overall score of ${overall} shows a solid foundation with meaningful opportunities for enhancement.`;
  } else {
    opener = `Analysis identified several specific areas where targeted treatments could make a real difference.`;
  }

  const strengthLine = `${strongest.name} scored highest at ${strongest.score}.`;

  let focusLine: string;
  if (weakest.score >= 80) {
    focusLine = `All categories are performing well, with ${weakest.name} at ${weakest.score} offering the most room for subtle refinement.`;
  } else {
    focusLine = `Primary opportunity is in ${weakest.name} (${weakest.score}), particularly ${lowestSub?.name ?? "this area"}.`;
  }

  const interestLine =
    focusCount > 0
      ? ` ${focusCount} priority ${focusCount === 1 ? "area" : "areas"} highlighted based on patient interests.`
      : "";

  return `${opener} ${strengthLine} ${focusLine}${interestLine}`;
}
