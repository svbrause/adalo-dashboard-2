import type { DiscussedItem } from "../types";
import type { PostVisitBlueprintVideo } from "../config/postVisitBlueprintVideos";
import {
  orderBlueprintVideosForPlan,
  POST_VISIT_BLUEPRINT_VIDEOS,
} from "../config/postVisitBlueprintVideos";
import type { TreatmentResultsCard } from "./postVisitBlueprintCases";
import { TREATMENT_META } from "../components/modals/DiscussedTreatmentsModal/constants";
import {
  getTreatmentDisplayName,
  getDisplayAreaForItem,
} from "../components/modals/DiscussedTreatmentsModal/utils";
import { normalizeBlueprintAnalysisText } from "./postVisitBlueprintAnalysis";

export type TreatmentChapter = {
  key: string;
  treatment: string;
  displayName: string;
  /** Aggregated display areas from all plan items for this treatment */
  displayArea: string | null;
  /** Derived from interest + findings on the treatment's plan items */
  whyRecommended: string[];
  meta: { longevity?: string; downtime?: string; priceRange?: string };
  /** Videos whose keywords match this treatment's plan items */
  videos: PostVisitBlueprintVideo[];
  /** Pre-built result card with matched case photos, or null */
  caseCard: TreatmentResultsCard | null;
  planItems: DiscussedItem[];
  /** Terms for AiMirrorCanvas highlight when viewing this chapter */
  mirrorHighlightTerms: string[];
};

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function buildWhyRecommended(items: DiscussedItem[]): string[] {
  const reasons = new Set<string>();
  for (const item of items) {
    if (item.interest?.trim())
      reasons.add(normalizeBlueprintAnalysisText(item.interest.trim()));
    if (item.findings?.length) {
      for (const f of item.findings) {
        if (f.trim()) reasons.add(normalizeBlueprintAnalysisText(f.trim()));
      }
    }
  }
  return Array.from(reasons).slice(0, 6);
}

function buildMirrorTerms(items: DiscussedItem[]): string[] {
  const terms = new Set<string>();
  for (const item of items) {
    if (item.region?.trim())
      terms.add(normalizeBlueprintAnalysisText(item.region.trim()));
    if (item.findings?.length) {
      for (const f of item.findings) {
        if (f.trim()) terms.add(normalizeBlueprintAnalysisText(f.trim()));
      }
    }
    if (item.interest?.trim())
      terms.add(normalizeBlueprintAnalysisText(item.interest.trim()));
  }
  return Array.from(terms).slice(0, 8);
}

function videosForItems(
  items: DiscussedItem[],
  catalog: PostVisitBlueprintVideo[],
): PostVisitBlueprintVideo[] {
  const haystack = items
    .flatMap((i) => [i.treatment, i.product, i.region, ...(i.findings ?? [])])
    .filter(Boolean)
    .map((x) => normalizeBlueprintAnalysisText(String(x)))
    .join(" ")
    .toLowerCase();
  if (!haystack.trim()) return [];
  return orderBlueprintVideosForPlan(items, catalog).filter((v) =>
    v.matchKeywords.some((kw) => haystack.includes(kw.toLowerCase())),
  );
}

/**
 * Build one chapter per distinct treatment in plan order.
 * Each chapter aggregates plan items, matched videos, and case data.
 */
export function buildTreatmentChapters(
  discussedItems: DiscussedItem[],
  treatmentCards: TreatmentResultsCard[],
  catalog: PostVisitBlueprintVideo[] = POST_VISIT_BLUEPRINT_VIDEOS,
): TreatmentChapter[] {
  const seen = new Set<string>();
  const chapters: TreatmentChapter[] = [];

  for (const item of discussedItems) {
    const t = item.treatment?.trim();
    if (!t) continue;
    const key = norm(t);
    if (seen.has(key)) continue;
    seen.add(key);

    const planItems = discussedItems.filter(
      (i) => norm(i.treatment ?? "") === key,
    );
    const meta = TREATMENT_META[t] ?? {};
    const caseCard = treatmentCards.find((c) => c.key === key) ?? null;

    const areas = new Set<string>();
    for (const pi of planItems) {
      const area = getDisplayAreaForItem(pi);
      if (area) areas.add(area);
    }

    chapters.push({
      key,
      treatment: t,
      displayName: getTreatmentDisplayName(planItems[0]),
      displayArea: areas.size > 0 ? Array.from(areas).join(", ") : null,
      whyRecommended: buildWhyRecommended(planItems),
      meta: {
        longevity: meta.longevity,
        downtime: meta.downtime,
        priceRange: meta.priceRange,
      },
      videos: videosForItems(planItems, catalog),
      caseCard,
      planItems,
      mirrorHighlightTerms: buildMirrorTerms(planItems),
    });
  }

  return chapters;
}
