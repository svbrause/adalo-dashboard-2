import type { DiscussedItem } from "../types";
import type { PostVisitBlueprintVideo } from "../config/postVisitBlueprintVideos";
import {
  POST_VISIT_BLUEPRINT_VIDEOS,
  selectVideosForChapterPlanItems,
} from "../config/postVisitBlueprintVideos";
import type { TreatmentResultsCard } from "./postVisitBlueprintCases";
import {
  TREATMENT_META,
  canonicalPlanTreatmentName,
  LEGACY_ENERGY_DEVICE_CATEGORY,
  ENERGY_TREATMENT_CATEGORY,
} from "../components/modals/DiscussedTreatmentsModal/constants";
import { getWellnestPeptideMeta } from "../data/wellnestOfferings";
import {
  getTreatmentDisplayName,
  getDisplayAreaForItem,
} from "../components/modals/DiscussedTreatmentsModal/utils";
import { getAlignedCheckoutLineItemsForDiscussedItems } from "../components/modals/DiscussedTreatmentsModal/TreatmentPlanCheckout";
import { dedupeBlueprintDisplayStrings } from "./postVisitBlueprintAnalysis";
import type { CheckoutLineItemDetail } from "../data/treatmentPricing2025";
import {
  formatPrice,
  formatSkuMatchDisplayPrice,
  matchPlanItemToSku,
} from "../data/treatmentPricing2025";
import { getQuoteLineDiscussedItemIndexOrder } from "./pvbQuotePartition";

export type TreatmentChapter = {
  key: string;
  treatment: string;
  displayName: string;
  /** Aggregated display areas from all plan items for this treatment (comma-separated) */
  displayArea: string | null;
  /** Derived from interest + findings on the treatment's plan items */
  whyRecommended: string[];
  meta: {
    longevity?: string;
    downtime?: string;
    /** Label for the second quick-fact slot (defaults to "Downtime"). */
    downtimeFactLabel?: string;
    /** Optional chapter-level notes shown beneath quick facts. */
    notes?: string;
    priceRange?: string;
    /** Quick fact label: "Price" when tied to quote/SKU; "Range" for category-wide band */
    priceFactLabel?: "price" | "range";
  };
  /** Videos whose keywords match this treatment's plan items */
  videos: PostVisitBlueprintVideo[];
  /** Pre-built result card with matched case photos, or null */
  caseCard: TreatmentResultsCard | null;
  planItems: DiscussedItem[];
  /** Terms for AiMirrorCanvas highlight when viewing this chapter */
  mirrorHighlightTerms: string[];
};

/**
 * Splits aggregated chapter {@link TreatmentChapter.displayArea} into labels for pill UI.
 */
export function splitChapterDisplayAreas(
  displayArea: string | null | undefined,
): string[] {
  if (!displayArea?.trim()) return [];
  const parts = displayArea
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return dedupeBlueprintDisplayStrings(parts);
}

type ChapterMetaSource = {
  longevity?: string;
  downtime?: string;
  downtimeFactLabel?: string;
  notes?: string;
  priceRange?: string;
};

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** Normalized chapter key; legacy "Energy Device" rows share the same key as Energy Treatment. */
function chapterTreatmentNormKey(treatment: string): string {
  const t = treatment.trim();
  if (t === LEGACY_ENERGY_DEVICE_CATEGORY) return norm(ENERGY_TREATMENT_CATEGORY);
  return norm(t);
}

function isWishlistItem(item: DiscussedItem): boolean {
  return (item.timeline ?? "").trim().toLowerCase() === "wishlist";
}

/** Patient blueprint: show neurotoxin as total only, not per-unit × price breakdown */
function priceDisplayForChapterQuickFacts(
  chapterKey: string,
  line: CheckoutLineItemDetail,
): string {
  if (chapterKey === "neurotoxin") {
    return formatPrice(line.price ?? 0);
  }
  return line.displayPrice;
}

function skuPriceDisplayForChapterQuickFacts(
  chapterKey: string,
  match: NonNullable<ReturnType<typeof matchPlanItemToSku>>,
): string {
  if (chapterKey === "neurotoxin") {
    return formatPrice(match.totalPrice);
  }
  return formatSkuMatchDisplayPrice(match);
}

/**
 * Prefer stored quote lines (SKU-level, same as checkout), then per–plan-item SKU match,
 * then the broad category range from TREATMENT_META.
 */
function resolveChapterPriceDisplay(
  chapterKey: string,
  planItems: DiscussedItem[],
  discussedItems: DiscussedItem[],
  quoteLineItems: CheckoutLineItemDetail[] | undefined,
  categoryPriceRange: string | undefined,
): { priceRange: string | undefined; priceFactLabel: "price" | "range" } {
  if (quoteLineItems?.length) {
    const aligned = getAlignedCheckoutLineItemsForDiscussedItems(discussedItems);
    const order = getQuoteLineDiscussedItemIndexOrder(discussedItems, aligned);
    if (order.length === quoteLineItems.length) {
      const fromQuote: string[] = [];
      for (let i = 0; i < quoteLineItems.length; i++) {
        const dIdx = order[i]!;
        const line = quoteLineItems[i]!;
        const d = discussedItems[dIdx];
        if (!d || !line) continue;
        if (chapterTreatmentNormKey(d.treatment ?? "") !== chapterKey) continue;
        fromQuote.push(priceDisplayForChapterQuickFacts(chapterKey, line));
      }
      if (fromQuote.length > 0) {
        return {
          priceRange:
            fromQuote.length === 1 ? fromQuote[0]! : fromQuote.join(" · "),
          priceFactLabel: "price",
        };
      }
    }
  }

  const fromSku: string[] = [];
  for (const pi of planItems) {
    if (isWishlistItem(pi)) continue;
    const m = matchPlanItemToSku(pi);
    if (m) fromSku.push(skuPriceDisplayForChapterQuickFacts(chapterKey, m));
  }
  if (fromSku.length > 0) {
    return {
      priceRange: fromSku.join(" · "),
      priceFactLabel: "price",
    };
  }

  if (categoryPriceRange) {
    return { priceRange: categoryPriceRange, priceFactLabel: "range" };
  }
  return { priceRange: undefined, priceFactLabel: "range" };
}

function buildWhyRecommended(items: DiscussedItem[]): string[] {
  const raw: string[] = [];
  for (const item of items) {
    if (item.interest?.trim()) raw.push(item.interest.trim());
    if (item.findings?.length) {
      for (const f of item.findings) {
        if (f.trim()) raw.push(f.trim());
      }
    }
  }
  return dedupeBlueprintDisplayStrings(raw, 6);
}

function buildMirrorTerms(items: DiscussedItem[]): string[] {
  const raw: string[] = [];
  for (const item of items) {
    if (item.region?.trim()) raw.push(item.region.trim());
    if (item.findings?.length) {
      for (const f of item.findings) {
        if (f.trim()) raw.push(f.trim());
      }
    }
    if (item.interest?.trim()) raw.push(item.interest.trim());
  }
  return dedupeBlueprintDisplayStrings(raw, 8);
}

function videosForItems(
  items: DiscussedItem[],
  catalog: PostVisitBlueprintVideo[],
): PostVisitBlueprintVideo[] {
  return selectVideosForChapterPlanItems(items, catalog);
}

/**
 * Build one chapter per distinct treatment in plan order.
 * Each chapter aggregates plan items, matched videos, and case data.
 */
export function buildTreatmentChapters(
  discussedItems: DiscussedItem[],
  treatmentCards: TreatmentResultsCard[],
  catalog: PostVisitBlueprintVideo[] = POST_VISIT_BLUEPRINT_VIDEOS,
  quoteLineItems?: CheckoutLineItemDetail[],
): TreatmentChapter[] {
  const seen = new Set<string>();
  const chapters: TreatmentChapter[] = [];

  for (const item of discussedItems) {
    const t = item.treatment?.trim();
    if (!t) continue;
    const key = chapterTreatmentNormKey(t);
    if (seen.has(key)) continue;
    seen.add(key);

    const planItems = discussedItems.filter(
      (i) => chapterTreatmentNormKey(i.treatment ?? "") === key,
    );
    const meta: ChapterMetaSource =
      (TREATMENT_META[
        canonicalPlanTreatmentName(t)
      ] as ChapterMetaSource | undefined) ??
      getWellnestPeptideMeta(t) ??
      {};
    const caseCard =
      treatmentCards.find(
        (c) => chapterTreatmentNormKey(c.treatment) === key,
      ) ?? null;
    const { priceRange, priceFactLabel } = resolveChapterPriceDisplay(
      key,
      planItems,
      discussedItems,
      quoteLineItems,
      meta.priceRange,
    );

    const areaParts: string[] = [];
    for (const pi of planItems) {
      const area = getDisplayAreaForItem(pi);
      if (!area) continue;
      for (const seg of area.split(",")) {
        const s = seg.trim();
        if (s) areaParts.push(s);
      }
    }
    const uniqueAreas = dedupeBlueprintDisplayStrings(areaParts);

    chapters.push({
      key,
      treatment: canonicalPlanTreatmentName(t),
      displayName: getTreatmentDisplayName(planItems[0]),
      displayArea: uniqueAreas.length > 0 ? uniqueAreas.join(", ") : null,
      whyRecommended: buildWhyRecommended(planItems),
      meta: {
        longevity: meta.longevity,
        downtime: meta.downtime,
        downtimeFactLabel: meta.downtimeFactLabel,
        notes: meta.notes,
        priceRange,
        priceFactLabel,
      },
      videos: videosForItems(planItems, catalog),
      caseCard,
      planItems,
      mirrorHighlightTerms: buildMirrorTerms(planItems),
    });
  }

  return chapters;
}
