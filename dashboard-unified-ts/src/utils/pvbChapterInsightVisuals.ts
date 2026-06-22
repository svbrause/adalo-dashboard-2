import type { TreatmentChapter } from "./blueprintTreatmentChapters";
import type {
  BlueprintAnalysisOverviewSnapshot,
  PlanTreatmentRow,
} from "./postVisitBlueprintAnalysis";
import {
  TANYA_TAN_LEFT_NAV_ORDER,
  TANYA_TAN_VIEWER_ANGLE_ASSETS,
  type AuraTanViewAngle,
} from "./auraTanAnglePhotos";
import { getChapterOverviewMergedConcerns } from "./pvbChapterOverviewFromAnalysis";

export type PvbChapterInsightVisual = {
  imageUrl?: string;
  mirrorImageUrl?: string;
  highlightTerms?: string[];
  label: string;
  caption: string;
  alt: string;
  lens: "pigmentation" | "texture" | "wrinkles" | "redness" | "treatment-area";
};

type PatientVisualContext = {
  patientId?: string | null;
  patientName?: string | null;
  heroPhotoUrl?: string | null;
};

type ChapterVisualContext = {
  snapshot?: BlueprintAnalysisOverviewSnapshot | null;
  planRow?: PlanTreatmentRow | null;
};

function visualSearchText(
  chapter: TreatmentChapter,
  ctx?: ChapterVisualContext | null,
): string {
  return [
    chapter.key,
    chapter.treatment,
    chapter.displayName,
    chapter.displayArea ?? "",
    ...chapter.whyRecommended,
    ...(ctx?.planRow?.interest ? [ctx.planRow.interest] : []),
    ...(ctx?.planRow?.findings ?? []),
    ...(ctx?.snapshot?.detectedIssueLabels ?? []),
    ...chapter.planItems.flatMap((item) => [
      item.treatment,
      item.product ?? "",
      item.interest ?? "",
      item.region ?? "",
      ...(item.findings ?? []),
    ]),
  ]
    .join(" | ")
    .toLowerCase();
}

function isTanyaDemoPatient(patient: PatientVisualContext): boolean {
  const text = [
    patient.patientId ?? "",
    patient.patientName ?? "",
    patient.heroPhotoUrl ?? "",
  ]
    .join(" | ")
    .toLowerCase();
  return /\btanya\s+tan\b|tanya-tan|demo-tanya/.test(text);
}

function chapterLens(
  chapter: TreatmentChapter,
  ctx?: ChapterVisualContext | null,
): PvbChapterInsightVisual["lens"] | null {
  const text = visualSearchText(chapter, ctx);
  const isPigment =
    /pigment|hyperpigment|dark spot|brown spot|sun spot|sun damage|melasma|discolor|uneven tone|brighten|depigmentation|bbl|broadband|ipl|moxi|glacial|photofacial/.test(
      text,
    );
  const isRedness =
    /red spot|redness|rosacea|vascular|vbeam|excel v|erythema/.test(text);
  const isTexture =
    /texture|pore|scar|acne|blackhead|whitehead|rough|microneed|morpheus|resurfac|dermaplan|dermasweep/.test(
      text,
    );
  const isWrinkles =
    /wrinkle|fine line|forehead|crow|frown|glabella|neurotoxin|botox|dysport|xeomin|daxxify|jeuveau|expression/.test(
      text,
    );

  if (isPigment) return "pigmentation";
  if (isWrinkles) return "wrinkles";
  if (isTexture) return "texture";
  if (isRedness) return "redness";
  return null;
}

function dedupeLabels(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const label = raw.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

function formatEnglishList(items: string[]): string {
  const clean = items.map((s) => s.trim()).filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0] ?? "";
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")}, and ${clean[clean.length - 1]}`;
}

/** Visit + scan findings tied to this chapter (same source as chapter overview copy). */
function collectChapterInsightFindings(
  chapter: TreatmentChapter,
  ctx?: ChapterVisualContext | null,
): string[] {
  const merged = getChapterOverviewMergedConcerns(chapter, {
    overviewSnapshot: ctx?.snapshot ?? null,
    planRow: ctx?.planRow ?? null,
  });
  const fromPlan = chapter.planItems.flatMap((item) => [
    ...(item.findings ?? []),
    ...(item.interest?.trim() ? [item.interest.trim()] : []),
  ]);
  return dedupeLabels([...merged, ...fromPlan, ...chapter.whyRecommended]).slice(
    0,
    6,
  );
}

function visualPhraseForLens(lens: PvbChapterInsightVisual["lens"]): string {
  switch (lens) {
    case "pigmentation":
      return "The pigmentation map on the left";
    case "wrinkles":
      return "The wrinkle map on the left";
    case "texture":
      return "The texture view on the left";
    case "redness":
      return "The redness map on the left";
    default:
      return "The highlighted areas on the left";
  }
}

function lensFallbackCaption(lens: PvbChapterInsightVisual["lens"]): string {
  const visual = visualPhraseForLens(lens);
  switch (lens) {
    case "pigmentation":
      return `${visual} shows pigment patterns from your assessment that connect to this recommendation.`;
    case "wrinkles":
      return `${visual} shows expression lines from your assessment that connect to this recommendation.`;
    case "texture":
      return `${visual} shows skin texture from your assessment that connects to this recommendation.`;
    case "redness":
      return `${visual} shows redness patterns from your assessment that connect to this recommendation.`;
    default:
      return `${visual} connect to what your provider noted during your visit.`;
  }
}

function buildInsightCaption(
  findings: string[],
  lens: PvbChapterInsightVisual["lens"],
): string {
  const visual = visualPhraseForLens(lens);
  if (findings.length === 0) return lensFallbackCaption(lens);
  if (findings.length === 1) {
    return `${visual} shows areas related to ${findings[0]} from your assessment.`;
  }
  return `${visual} shows where your assessment noted ${formatEnglishList(findings)}.`;
}

function tanyaAnglesWithLensAsset(
  lens: PvbChapterInsightVisual["lens"],
): AuraTanViewAngle[] {
  return TANYA_TAN_LEFT_NAV_ORDER.filter((angle) => {
    const asset = TANYA_TAN_VIEWER_ANGLE_ASSETS[angle];
    switch (lens) {
      case "pigmentation":
        return Boolean(asset.srcPigmentation);
      case "wrinkles":
        return Boolean(asset.srcWrinklesView ?? asset.srcWrinkles);
      case "texture":
        return Boolean(asset.srcTexture ?? asset.src);
      case "redness":
        return Boolean(asset.srcRedness);
      default:
        return false;
    }
  });
}

/** Prefer angles that match a specific side or sub-region (not generic "full face"). */
function areaPreferredTanyaAngles(chapter: TreatmentChapter): AuraTanViewAngle[] {
  const text = [
    chapter.displayArea ?? "",
    ...chapter.planItems.map((item) => item.region ?? ""),
  ]
    .join(" ")
    .toLowerCase();

  if (/\bleft profile\b|\bprofile left\b|\b90.?left\b|\bleft side\b/.test(text)) {
    return ["profile-left", "three-quarter-left"];
  }
  if (/\bright profile\b|\bprofile right\b|\b90.?right\b|\bright side\b/.test(text)) {
    return ["profile-right", "three-quarter-right"];
  }
  if (/\bthree.?quarter.?left\b|\b45.?left\b|\b3\/4 left\b/.test(text)) {
    return ["three-quarter-left"];
  }
  if (/\bthree.?quarter.?right\b|\b45.?right\b|\b3\/4 right\b/.test(text)) {
    return ["three-quarter-right"];
  }
  return [];
}

function pickTanyaAngleForChapter(
  chapter: TreatmentChapter,
  lens: PvbChapterInsightVisual["lens"],
  chapterIndex: number,
): AuraTanViewAngle | null {
  const available = tanyaAnglesWithLensAsset(lens);
  if (available.length === 0) return null;

  const preferred = areaPreferredTanyaAngles(chapter).filter((angle) =>
    available.includes(angle),
  );
  if (preferred.length === 1) {
    return preferred[0]!;
  }
  if (preferred.length > 1) {
    return preferred[((chapterIndex % preferred.length) + preferred.length) % preferred.length]!;
  }

  return available[((chapterIndex % available.length) + available.length) % available.length]!;
}

function tanyaVisualForLens(
  chapter: TreatmentChapter,
  lens: PvbChapterInsightVisual["lens"],
  caption: string,
  angle: AuraTanViewAngle,
): PvbChapterInsightVisual | null {
  const asset = TANYA_TAN_VIEWER_ANGLE_ASSETS[angle];
  if (lens === "pigmentation") {
    const imageUrl = asset.srcPigmentation;
    if (!imageUrl) return null;
    return {
      imageUrl,
      lens,
      label: "Pigmentation map",
      caption,
      alt: `${asset.label} pigmentation map for ${chapter.displayName}`,
    };
  }
  if (lens === "wrinkles") {
    const imageUrl = asset.srcWrinklesView ?? asset.srcWrinkles;
    if (!imageUrl) return null;
    return {
      imageUrl,
      lens,
      label: "Wrinkle map",
      caption,
      alt: `${asset.label} wrinkle map for ${chapter.displayName}`,
    };
  }
  if (lens === "texture") {
    const imageUrl = asset.srcTexture ?? asset.src;
    if (!imageUrl) return null;
    return {
      imageUrl,
      lens,
      label: "Texture view",
      caption,
      alt: `${asset.label} texture view for ${chapter.displayName}`,
    };
  }
  if (lens === "redness") {
    const imageUrl = asset.srcRedness;
    if (!imageUrl) return null;
    return {
      imageUrl,
      lens,
      label: "Redness map",
      caption,
      alt: `${asset.label} redness map for ${chapter.displayName}`,
    };
  }
  return null;
}

export function buildPvbChapterInsightVisual(
  chapter: TreatmentChapter,
  patient: PatientVisualContext,
  ctx?: ChapterVisualContext | null,
  chapterIndex = 0,
): PvbChapterInsightVisual | null {
  const lens = chapterLens(chapter, ctx);
  const findings = collectChapterInsightFindings(chapter, ctx);
  const captionLens = lens ?? "treatment-area";
  const caption = buildInsightCaption(findings, captionLens);

  if (lens && isTanyaDemoPatient(patient)) {
    const angle = pickTanyaAngleForChapter(chapter, lens, chapterIndex);
    if (angle) {
      const tanya = tanyaVisualForLens(chapter, lens, caption, angle);
      if (tanya) return tanya;
    }
  }

  const highlightTerms = chapter.mirrorHighlightTerms
    .map((term) => term.trim())
    .filter(Boolean)
    .slice(0, 6);
  const mirrorImageUrl = patient.heroPhotoUrl?.trim();
  if (!mirrorImageUrl || highlightTerms.length === 0) return null;

  return {
    mirrorImageUrl,
    highlightTerms,
    lens: "treatment-area",
    label: lens === "pigmentation" ? "Treatment focus" : "Treatment area",
    caption,
    alt: `${chapter.displayName} treatment focus`,
  };
}
