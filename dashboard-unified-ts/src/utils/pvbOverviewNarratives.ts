import type { TreatmentChapter } from "./blueprintTreatmentChapters";
import type {
  BlueprintAnalysisOverviewSnapshot,
  PlanTreatmentRow,
} from "./postVisitBlueprintAnalysis";
import {
  formatTreatmentPlanRecordMetaLine,
  getCheckoutDisplayName,
} from "../components/modals/DiscussedTreatmentsModal/utils";
import {
  buildChapterAnalysisParagraph,
  maybeAppendIntroScanBridge,
  type ChapterOverviewAnalysisInput,
} from "./pvbChapterOverviewFromAnalysis";

function formatEnglishList(items: string[]): string {
  const clean = items.map((s) => s.trim()).filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0] ?? "";
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")}, and ${clean[clean.length - 1]}`;
}

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

export type ChapterOverviewParts = {
  intro: string;
  planBullets: string[];
  analysis: string;
};

export type ChapterOverviewBuildOptions = {
  overviewSnapshot: BlueprintAnalysisOverviewSnapshot | null;
  planRow: PlanTreatmentRow | null;
};

/**
 * Per-treatment overview: category context, plan rows (SKU / area / qty), and analysis-linked narrative.
 * Pass `options` when `analysisSummary.overviewSnapshot` + plan rows are available on the blueprint.
 */
export function buildChapterOverviewContent(
  chapter: TreatmentChapter,
  options?: ChapterOverviewBuildOptions | null,
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

  const intro = ctx
    ? maybeAppendIntroScanBridge(introBase, chapter, ctx)
    : introBase;

  const planBullets = chapter.planItems.map((item) => {
    const label = getCheckoutDisplayName(item);
    const meta = formatTreatmentPlanRecordMetaLine(item);
    return meta ? `${label} — ${meta}` : label;
  });

  const analysis = buildChapterAnalysisParagraph(chapter, ctx);

  return { intro, planBullets, analysis };
}
