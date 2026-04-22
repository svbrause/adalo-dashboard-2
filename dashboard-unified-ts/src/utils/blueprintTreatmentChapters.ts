import type { DiscussedItem } from "../types";
import type { PostVisitBlueprintVideo } from "../config/postVisitBlueprintVideos";
import {
  POST_VISIT_BLUEPRINT_VIDEOS,
  selectVideosForChapterPlanItems,
} from "../config/postVisitBlueprintVideos";
import type { TreatmentResultsCard } from "./postVisitBlueprintCases";
import {
  ENERGY_TREATMENT_CATEGORY,
  LEGACY_ENERGY_DEVICE_CATEGORY,
  TREATMENT_META,
  canonicalPlanTreatmentName,
} from "../components/modals/DiscussedTreatmentsModal/constants";
import { getWellnestPeptideMeta } from "../data/wellnestOfferings";
import { getDisplayAreaForItem } from "../components/modals/DiscussedTreatmentsModal/utils";
import { getAlignedCheckoutLineItemsForDiscussedItems } from "../components/modals/DiscussedTreatmentsModal/TreatmentPlanCheckout";
import {
  dedupeBlueprintDisplayStrings,
  normalizeBlueprintAnalysisText,
} from "./postVisitBlueprintAnalysis";
import type { CheckoutLineItemDetail } from "../data/treatmentPricing2025";
import {
  formatPrice,
  formatSkuMatchDisplayPrice,
  getEffectivePriceList,
  matchPlanItemToSku,
  TREATMENT_PRICE_LIST_2025,
  type TreatmentPriceItem,
} from "../data/treatmentPricing2025";
import { getQuoteLineDiscussedItemIndexOrder } from "./pvbQuotePartition";
import type { BlueprintChapterSlot } from "./pvbChapterSchedule";
import {
  buildBlueprintChapterSchedule,
  chapterTreatmentNormKey,
  planItemsForBlueprintChapterSlot,
} from "./pvbChapterSchedule";
import {
  resolveOtherProcedureSubChapterDowntime,
  resolveOtherProcedureSubChapterLongevity,
} from "./otherProcedureLongevity";

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
  /**
   * For **Other procedures** / **Energy Treatment** sub-chapters: chip text for the top of the chapter card.
   * Omits the full multi-type `product` string (the section title already names this row).
   */
  planDisplayHighlights?: string[];
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
  priceList: { category: string; items: TreatmentPriceItem[] }[] = TREATMENT_PRICE_LIST_2025,
): { priceRange: string | undefined; priceFactLabel: "price" | "range" } {
  const planIds = new Set(planItems.map((p) => p.id));
  if (quoteLineItems?.length) {
    const aligned = getAlignedCheckoutLineItemsForDiscussedItems(
      discussedItems,
      priceList,
    );
    const order = getQuoteLineDiscussedItemIndexOrder(discussedItems, aligned);
    if (order.length === quoteLineItems.length) {
      const fromQuote: string[] = [];
      for (let i = 0; i < quoteLineItems.length; i++) {
        const dIdx = order[i]!;
        const line = quoteLineItems[i]!;
        const d = discussedItems[dIdx];
        if (!d || !line) continue;
        if (!planIds.has(d.id)) continue;
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
    const m = matchPlanItemToSku(pi, priceList);
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

const ENERGY_CHAPTER_BASE = chapterTreatmentNormKey(ENERGY_TREATMENT_CATEGORY);

/**
 * Other procedures / Energy Treatment rows often list several names in `product`. Video keyword
 * matching uses that full string, so e.g. "injection" inside "PRFM injections" could match
 * filler clips on a Cortisone-only chapter. For sub-chapters, narrow `product` to this
 * section's label when scoring videos (plan data on disk unchanged).
 */
function planItemsForVideoKeywordMatching(
  slot: BlueprintChapterSlot,
  planItems: DiscussedItem[],
): DiscussedItem[] {
  if (slot.key.startsWith("other procedures::")) {
    return planItems.map((item) => {
      if ((item.treatment ?? "").trim() !== "Other procedures") return item;
      return { ...item, product: slot.displayName };
    });
  }
  if (slot.key.startsWith(`${ENERGY_CHAPTER_BASE}::`)) {
    return planItems.map((item) => {
      const tr = (item.treatment ?? "").trim();
      if (tr !== ENERGY_TREATMENT_CATEGORY && tr !== LEGACY_ENERGY_DEVICE_CATEGORY)
        return item;
      return { ...item, product: slot.displayName };
    });
  }
  return planItems;
}

/** Top-of-card chips: region / interest / findings — not the full comma-separated product list. */
function buildSubChapterPlanHighlights(planItems: DiscussedItem[]): string[] {
  const parts = new Set<string>();
  for (const item of planItems) {
    const region = item.region?.trim();
    if (region) parts.add(normalizeBlueprintAnalysisText(region));
    const interest = item.interest?.trim();
    if (interest) parts.add(normalizeBlueprintAnalysisText(interest));
    for (const f of item.findings ?? []) {
      if (f.trim()) parts.add(normalizeBlueprintAnalysisText(f.trim()));
    }
  }
  return Array.from(parts).slice(0, 8);
}

/**
 * Build one chapter per distinct treatment in plan order.
 * **Other procedures** becomes one chapter per selected procedure type (PRFM, Skinvive, …).
 */
export function buildTreatmentChapters(
  discussedItems: DiscussedItem[],
  treatmentCards: TreatmentResultsCard[],
  catalog: PostVisitBlueprintVideo[] = POST_VISIT_BLUEPRINT_VIDEOS,
  quoteLineItems?: CheckoutLineItemDetail[],
  providerCode?: string,
): TreatmentChapter[] {
  const priceList = getEffectivePriceList(undefined, providerCode);
  const schedule = buildBlueprintChapterSchedule(discussedItems, providerCode);
  const chapters: TreatmentChapter[] = [];
  const otherNorm = chapterTreatmentNormKey("Other procedures");

  for (const slot of schedule) {
    const planItems = planItemsForBlueprintChapterSlot(
      slot,
      discussedItems,
      providerCode,
    );
    if (planItems.length === 0) continue;

    const metaSourceName = slot.treatment;
    const meta: ChapterMetaSource =
      (TREATMENT_META[
        canonicalPlanTreatmentName(metaSourceName)
      ] as ChapterMetaSource | undefined) ??
      getWellnestPeptideMeta(metaSourceName) ??
      {};
    let chapterLongevity = meta.longevity;
    let chapterDowntime = meta.downtime;
    if (
      metaSourceName === "Other procedures" &&
      slot.key.startsWith("other procedures::")
    ) {
      const specific = resolveOtherProcedureSubChapterLongevity(slot.displayName);
      if (
        specific &&
        (chapterLongevity === "Varies" || !chapterLongevity?.trim())
      ) {
        chapterLongevity = specific;
      }
      const down = resolveOtherProcedureSubChapterDowntime(slot.displayName);
      if (down) chapterDowntime = down;
    }
    const caseCard =
      treatmentCards.find((c) => chapterTreatmentNormKey(c.treatment) === slot.key) ??
      (slot.key.startsWith("other procedures::")
        ? treatmentCards.find(
            (c) => chapterTreatmentNormKey(c.treatment) === otherNorm,
          ) ?? null
        : slot.key.startsWith(`${ENERGY_CHAPTER_BASE}::`)
          ? treatmentCards.find(
              (c) =>
                chapterTreatmentNormKey(c.treatment) === ENERGY_CHAPTER_BASE,
            ) ?? null
          : null);
    const { priceRange, priceFactLabel } = resolveChapterPriceDisplay(
      slot.key,
      planItemsForVideoKeywordMatching(slot, planItems),
      discussedItems,
      quoteLineItems,
      meta.priceRange,
      priceList,
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
      key: slot.key,
      treatment: canonicalPlanTreatmentName(metaSourceName),
      displayName: slot.displayName,
      displayArea: uniqueAreas.length > 0 ? uniqueAreas.join(", ") : null,
      whyRecommended: buildWhyRecommended(planItems),
      meta: {
        longevity: chapterLongevity,
        downtime: chapterDowntime,
        downtimeFactLabel: meta.downtimeFactLabel,
        notes: meta.notes,
        priceRange,
        priceFactLabel,
      },
      videos: videosForItems(
        planItemsForVideoKeywordMatching(slot, planItems),
        catalog,
      ),
      caseCard,
      planItems,
      mirrorHighlightTerms: buildMirrorTerms(planItems),
      planDisplayHighlights:
        slot.key.startsWith("other procedures::") ||
        slot.key.startsWith(`${ENERGY_CHAPTER_BASE}::`)
          ? buildSubChapterPlanHighlights(planItems)
          : undefined,
    });
  }

  return chapters;
}
