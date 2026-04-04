import type { DiscussedItem } from "../types";
import type { CheckoutLineItemDetail } from "../data/treatmentPricing2025";
import { isBoutiqueSkincareProductName } from "../components/modals/DiscussedTreatmentsModal/treatmentBoutiqueProducts";

/** Matches {@link isDiscussedItemOnPostVisitBlueprint} — kept local to avoid import cycles. */
const PVB_QUOTE_ORDER_EXCLUDED_TIMELINES = new Set(["completed"]);

function isDiscussedItemInBlueprintQuoteOrder(item: DiscussedItem): boolean {
  const treatment = (item.treatment ?? "").trim();
  if (treatment === "Skincare") return true;
  const tl = (item.timeline ?? "").trim().toLowerCase();
  return !PVB_QUOTE_ORDER_EXCLUDED_TIMELINES.has(tl);
}

/**
 * Order of discussed-item indices that matches `quote.lineItems` on the post-visit blueprint:
 * boutique skincare lines first (in list order), then all other rows — same grouping as checkout
 * when `alignedLineItems` is passed (length must match `discussedItems`).
 *
 * Includes **wishlist** and empty-timeline rows so the saved quote has one line per on-blueprint
 * plan row (wishlist lines use $0 / "Wishlist" in {@link computeQuoteSheetDataForDiscussedItems}).
 */
export function getQuoteLineDiscussedItemIndexOrder(
  discussedItems: DiscussedItem[],
  alignedLineItems?: CheckoutLineItemDetail[],
): number[] {
  const skincare: number[] = [];
  const treatment: number[] = [];
  const useKind =
    alignedLineItems != null &&
    alignedLineItems.length === discussedItems.length;
  discussedItems.forEach((d, idx) => {
    if (!isDiscussedItemInBlueprintQuoteOrder(d)) return;
    if (useKind) {
      if (alignedLineItems![idx]?.quoteLineKind === "skincare") {
        skincare.push(idx);
      } else {
        treatment.push(idx);
      }
      return;
    }
    if (
      (d.treatment ?? "").trim() === "Skincare" &&
      isBoutiqueSkincareProductName(d.product ?? "")
    ) {
      skincare.push(idx);
    } else {
      treatment.push(idx);
    }
  });
  return [...skincare, ...treatment];
}

/**
 * Resolve skincare vs treatment row for blueprint quote (`quoteLineKind` or legacy payloads).
 * Stored `quote.lineItems` follow {@link getQuoteLineDiscussedItemIndexOrder} (skincare group first).
 */
export function resolveQuoteLineKind(
  line: CheckoutLineItemDetail,
  idx: number,
  discussedItems: DiscussedItem[],
): "skincare" | "treatment" {
  if (line.quoteLineKind) return line.quoteLineKind;
  const orderedDiscussedIdx = getQuoteLineDiscussedItemIndexOrder(discussedItems);
  if (idx >= orderedDiscussedIdx.length) return "treatment";
  const d = discussedItems[orderedDiscussedIdx[idx]!];
  if (
    d.treatment?.trim() === "Skincare" &&
    isBoutiqueSkincareProductName(d.product ?? "")
  ) {
    return "skincare";
  }
  return "treatment";
}

export function partitionQuoteLineIndices(
  lineItems: CheckoutLineItemDetail[],
  discussedItems: DiscussedItem[],
): { skincare: number[]; treatment: number[] } {
  const skincare: number[] = [];
  const treatment: number[] = [];
  lineItems.forEach((line, idx) => {
    const k = resolveQuoteLineKind(line, idx, discussedItems);
    if (k === "skincare") skincare.push(idx);
    else treatment.push(idx);
  });
  return { skincare, treatment };
}
