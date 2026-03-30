import type { DiscussedItem } from "../types";
import type { TreatmentChapter } from "./blueprintTreatmentChapters";
import type {
  BlueprintAnalysisOverviewSnapshot,
  PlanTreatmentRow,
} from "./postVisitBlueprintAnalysis";
import {
  formatTreatmentPlanRecordMetaLine,
  getCheckoutDisplayName,
  getDisplayAreaForItem,
  TREATMENT_PLAN_BULLET,
} from "../components/modals/DiscussedTreatmentsModal/utils";
import { patientFacingSkincareShortName } from "./pvbSkincareDisplay";
import {
  buildChapterAnalysisParagraph,
  getChapterOverviewMergedConcerns,
  maybeAppendIntroScanBridge,
  type ChapterOverviewAnalysisInput,
} from "./pvbChapterOverviewFromAnalysis";

/** One plan line for chapter overview: skincare uses short names and avoids repeating product in meta. */
function buildChapterPlanBulletLine(item: DiscussedItem): string {
  const isSkincare = (item.treatment ?? "").trim().toLowerCase() === "skincare";
  const rawLabel = getCheckoutDisplayName(item);
  const label = isSkincare ? patientFacingSkincareShortName(rawLabel) : rawLabel;
  if (!isSkincare) {
    const meta = formatTreatmentPlanRecordMetaLine(item);
    return meta ? `${label} — ${meta}` : label;
  }
  const area = getDisplayAreaForItem(item);
  const metaParts: string[] = [];
  if (area) metaParts.push(area);
  if (item.quantity && String(item.quantity).trim()) {
    metaParts.push(`Qty: ${item.quantity}`);
  }
  const meta = metaParts.join(TREATMENT_PLAN_BULLET);
  return meta ? `${label} — ${meta}` : label;
}

function formatEnglishList(items: string[]): string {
  const clean = items.map((s) => s.trim()).filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0] ?? "";
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")}, and ${clean[clean.length - 1]}`;
}

/**
 * Top of complement sandwich: one short line on why this modality is a solid, credible choice
 * (before “how this can help you” in the intro).
 */
const TREATMENT_CATEGORY_PRAISE: Partial<Record<string, string>> = {
  Skincare:
    "Medical-grade home care is one of the highest-impact ways to keep skin healthy, even-toned, and responsive between visits.",
  "Energy Device":
    "Energy-based treatments are a proven path when you want clearer tone, smoother texture, and a fresher look without daily cover-up.",
  Laser:
    "Laser options are trusted workhorses for resetting sun damage, dullness, and uneven texture while supporting collagen over time.",
  "Chemical Peel":
    "Peels are a classic way to speed up renewal—great when you want brighter, clearer skin on a predictable timeline.",
  Microneedling:
    "Microneedling is a strong collagen-friendly option when texture, pores, or scars are what you notice most.",
  Filler:
    "Fillers are the standard of care when subtle volume and contour are what will move the needle on how rested you look.",
  Neurotoxin:
    "Neuromodulators are among the most studied tools for softening expression lines so your face looks relaxed, not “frozen,” when done thoughtfully.",
  Biostimulants:
    "Biostimulators shine when you want gradual, natural firming and structure rather than an instant one-and-done change.",
  Kybella: "Kybella is a targeted approach when submental fullness is the main thing standing between you and a cleaner jawline.",
  Threadlift: "Threads can offer meaningful lift when mild sagging—not just volume loss—is the story.",
  PRP: "PRP leverages your own growth signals—appealing when you want a biologic nudge toward repair and quality.",
  PDGF: "Growth-factor protocols support tissue quality and repair in focused areas.",
};

/** Short intro by treatment category for chapter “Overview” blocks. */
const TREATMENT_CATEGORY_INTRO: Partial<Record<string, string>> = {
  Skincare:
    "Medical-grade skincare supports your home routine and complements in-office procedures.",
  "Energy Device":
    "Energy-based treatments use light or controlled heat to improve tone, texture, pigment, and collagen.",
  Laser:
    "Laser treatments refresh tone and texture while supporting collagen renewal, often with a staged series for cumulative improvement.",
  "Chemical Peel":
    "Chemical peels exfoliate and renew the surface to improve texture, clarity, and fine lines.",
  Microneedling:
    "Microneedling stimulates collagen and can pair with topicals or biologics for texture and scars.",
  Filler:
    "Dermal fillers restore volume and contour where structure or fullness has changed with age.",
  Neurotoxin:
    "Neuromodulators soften dynamic lines by relaxing targeted muscles.",
  Biostimulants:
    "Biostimulators encourage gradual collagen and structural improvement over time.",
  Kybella: "Injectable fat-reduction can refine contour under the chin or in small defined areas.",
  Threadlift: "Threads lift and support tissue for a subtle repositioning effect.",
  PRP: "Platelet-rich plasma uses your own growth factors to support rejuvenation.",
  PDGF: "Growth-factor treatments support repair and quality in targeted tissue.",
};

/**
 * Top-of-page copy: connects listed chapters to scan findings / focus areas / visit themes.
 */
export function buildPvbPlanBridgeParagraph(
  chapterDisplayNames: string[],
  snapshot: BlueprintAnalysisOverviewSnapshot | null,
  globalInsights: { interests: string[]; findings: string[] },
): string | null {
  if (chapterDisplayNames.length === 0) return null;
  const list = formatEnglishList(chapterDisplayNames);
  const out: string[] = [];
  out.push(
    `The sections below cover ${list}—each with context, videos from your team, and—where available—real patient examples.`,
  );

  const findingParts: string[] = [];
  if (snapshot?.detectedIssueLabels?.length) {
    findingParts.push(...snapshot.detectedIssueLabels.slice(0, 8));
  }
  for (const f of globalInsights.findings.slice(0, 6)) {
    const t = f.trim();
    if (t && !findingParts.some((x) => x.toLowerCase() === t.toLowerCase())) {
      findingParts.push(t);
    }
  }

  const focusNames =
    snapshot?.areas?.filter((a) => a.hasInterest).map((a) => a.name) ?? [];
  const extraInterests = globalInsights.interests.slice(0, 6);

  if (findingParts.length) {
    const f = formatEnglishList(findingParts);
    if (focusNames.length) {
      out.push(
        `Together, these options address findings from your assessment (${f}) while respecting the regions you wanted to prioritize (${formatEnglishList(focusNames)}).`,
      );
    } else {
      out.push(
        `They were chosen to work with patterns noted in your scan (${f}) and what you discussed with your provider.`,
      );
    }
  } else if (focusNames.length) {
    out.push(
      `They align with the areas you emphasized during your visit (${formatEnglishList(focusNames)}).`,
    );
  } else if (extraInterests.length) {
    out.push(
      `They reflect what you shared as priorities: ${formatEnglishList(extraInterests)}.`,
    );
  }

  return out.join(" ");
}

/** Shape of the patient’s chapter list—drives holistic “whole plan” framing copy. */
export type PvbMainOverviewPlanShape = {
  chapterCount: number;
  /** Plan includes a Skincare chapter (home regimen / products). */
  includesSkincare: boolean;
  /** At least one non-skincare treatment chapter (procedures, injectables, devices, etc.). */
  includesInOfficeOrProcedures: boolean;
};

export type PvbMainOverviewPersonalization = {
  goals?: string[];
  findings?: string[];
  focusAreas?: string[];
  chapterNames?: string[];
};

function dedupeText(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const t = raw.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

/**
 * Opening copy for the top “Personalized Treatment Overview”: emphasizes that this is one
 * coordinated plan (home care, maintenance, aesthetics) rather than disconnected items.
 * Returns two short paragraphs so the typewriter paces them separately.
 */
export function buildPvbMainPlanFramingParagraphs(
  shape: PvbMainOverviewPlanShape,
  personalization?: PvbMainOverviewPersonalization | null,
): string[] {
  if (shape.chapterCount <= 0) return [];

  const open =
    "Here's the big picture: this is one coordinated treatment plan built around your goals and what came up in your visit.";

  let bridge: string;
  if (shape.includesSkincare && shape.includesInOfficeOrProcedures) {
    bridge =
      "How it is structured: foundation at home (medical-grade skincare), maintenance between visits, and in-office treatments for your top aesthetic goals. Each section shows how these pieces support one another.";
  } else if (shape.includesSkincare && !shape.includesInOfficeOrProcedures) {
    bridge =
      "How it is structured: a strong at-home skincare foundation plus steady maintenance to keep results consistent over time.";
  } else if (!shape.includesSkincare && shape.includesInOfficeOrProcedures) {
    bridge =
      "How it is structured: in-office treatments paired with a maintenance rhythm, so timing and upkeep stay aligned with your goals.";
  } else {
    bridge =
      "How it is structured: each step advances the same goals and keeps next actions clear.";
  }

  const out = [open, bridge];

  const priorities = dedupeText([
    ...(personalization?.findings ?? []),
    ...(personalization?.goals ?? []),
  ]).slice(0, 3);
  const focus = dedupeText(personalization?.focusAreas ?? []).slice(0, 2);
  const namedChapters = dedupeText(personalization?.chapterNames ?? []).slice(0, 3);

  if (priorities.length > 0 || focus.length > 0) {
    const parts: string[] = [];
    if (priorities.length > 0) {
      parts.push(`for you, priority themes are ${formatEnglishList(priorities)}`);
    }
    if (focus.length > 0) {
      parts.push(`with added focus on ${formatEnglishList(focus)}`);
    }
    const chapterTail =
      namedChapters.length > 0
        ? ` through ${formatEnglishList(namedChapters)}`
        : "";
    out.push(
      `Personalized to your profile: this plan is built ${parts.join(" and ")}${chapterTail}.`,
    );
  }

  return out;
}

export type ChapterOverviewParts = {
  /** Top bread: what’s strong / credible about this modality (validation before the “help you” line). */
  complementTop?: string;
  /** Opens with how this can help the patient look and feel their best, then category context. */
  intro: string;
  planBullets: string[];
  analysis: string;
  /** Bottom bread: tie-back to the coordinated plan and other chapters. */
  complementBottom?: string;
};

export type ChapterOverviewBuildOptions = {
  overviewSnapshot: BlueprintAnalysisOverviewSnapshot | null;
  planRow: PlanTreatmentRow | null;
};

/** Per-chapter context to generate complement-sandwich bookends (top + bottom around the core overview). */
export type ChapterComplementSandwichContext = {
  chapterIndex: number;
  totalChapters: number;
  /** Display names in plan order (same order as TOC chapters). */
  allChapterDisplayNames: string[];
  planShape: PvbMainOverviewPlanShape;
  /** Patient-specific priorities from the overview (goals/findings/focus). */
  patientPriorities?: string[];
};

function planPillarPhraseForComplement(planShape: PvbMainOverviewPlanShape): string {
  if (planShape.includesSkincare && planShape.includesInOfficeOrProcedures) {
    return "your medical-grade home routine, maintenance between visits, and in-office treatments";
  }
  if (planShape.includesSkincare && !planShape.includesInOfficeOrProcedures) {
    return "consistent at-home care and long-term maintenance";
  }
  if (!planShape.includesSkincare && planShape.includesInOfficeOrProcedures) {
    return "your in-office treatments and the upkeep rhythm your team recommends";
  }
  return "every step in this guide";
}

function buildChapterComplementTop(
  chapter: TreatmentChapter,
  ctx: ChapterComplementSandwichContext,
): string {
  const self = chapter.displayName.trim();
  const praise =
    TREATMENT_CATEGORY_PRAISE[chapter.treatment] ??
    `${self} is a well-established option when you want meaningful, natural-looking improvement.`;
  if (ctx.totalChapters <= 1) {
    return `Here's what's strong about this choice: ${praise}`;
  }
  const others = ctx.allChapterDisplayNames.filter((_, i) => i !== ctx.chapterIndex);
  const othersList = formatEnglishList(others);
  return `Here's what's strong about this choice: ${praise} It's also meant to work hand-in-hand with ${othersList} in your personalized guide.`;
}

function buildChapterComplementBottom(
  chapter: TreatmentChapter,
  ctx: ChapterComplementSandwichContext,
): string {
  const self = chapter.displayName.trim();
  const pillars = planPillarPhraseForComplement(ctx.planShape);
  const priority =
    (ctx.patientPriorities ?? []).find((p) => p.trim().length > 0) ?? "";
  const priorityTail = priority ? ` That lines up with your priority around ${priority}.` : "";
  if (ctx.totalChapters <= 1) {
    return `Bringing it together: ${self} works best as part of ${pillars}, with steady follow-through over time.${priorityTail}`;
  }
  const others = ctx.allChapterDisplayNames.filter((_, i) => i !== ctx.chapterIndex);
  const othersList = formatEnglishList(others);
  return `Bringing it together: ${self} covers this piece of the story, while ${othersList} cover complementary goals—so ${pillars} stay one coordinated plan.${priorityTail}`;
}

/**
 * Per-treatment overview: category context, plan rows (SKU / area / qty), and analysis-linked narrative.
 * Pass `options` when `analysisSummary.overviewSnapshot` + plan rows are available on the blueprint.
 */
export function buildChapterOverviewContent(
  chapter: TreatmentChapter,
  options?: ChapterOverviewBuildOptions | null,
  complementContext?: ChapterComplementSandwichContext | null,
): ChapterOverviewParts {
  const introBase =
    TREATMENT_CATEGORY_INTRO[chapter.treatment] ??
    `This portion of your plan focuses on ${chapter.displayName}.`;

  const ctx: ChapterOverviewAnalysisInput | undefined =
    options != null
      ? {
          overviewSnapshot: options.overviewSnapshot,
          planRow: options.planRow,
        }
      : undefined;

  const mergedConcerns = getChapterOverviewMergedConcerns(chapter, ctx);
  /** Opens with how this helps the patient (look/feel), before category explainer. */
  let howThisHelpsOpen: string | null = null;
  if (mergedConcerns.length > 0) {
    howThisHelpsOpen = `How this can help you look and feel your best: your team aligned ${chapter.displayName.trim()} with ${formatEnglishList(
      mergedConcerns.slice(0, 5),
    )}—so those are the improvements this chapter is built around.`;
  } else if (chapter.displayArea?.trim()) {
    howThisHelpsOpen = `How this can help you: this chapter focuses on ${chapter.displayArea.trim()} and the refinements you and your provider discussed for that area.`;
  }

  const hadExplicitAddressingSentence = Boolean(howThisHelpsOpen);

  let intro: string;
  if (howThisHelpsOpen) {
    intro = `${howThisHelpsOpen} ${introBase}`;
    if (mergedConcerns.length === 0) {
      intro = ctx ? maybeAppendIntroScanBridge(intro, chapter, ctx) : intro;
    }
  } else {
    const withLead = `How this can help you: ${introBase}`;
    intro = ctx ? maybeAppendIntroScanBridge(withLead, chapter, ctx) : withLead;
  }

  const planBullets = chapter.planItems.map((item) =>
    buildChapterPlanBulletLine(item),
  );

  const analysis = buildChapterAnalysisParagraph(chapter, mergedConcerns, {
    hadExplicitAddressingSentence,
  });

  let complementTop: string | undefined;
  let complementBottom: string | undefined;
  if (complementContext && complementContext.totalChapters > 0) {
    complementTop = buildChapterComplementTop(chapter, complementContext);
    complementBottom = buildChapterComplementBottom(chapter, complementContext);
  }

  return {
    complementTop,
    intro,
    planBullets,
    analysis,
    complementBottom,
  };
}
