import type { DiscussedItem } from "../types";
import type { CheckoutLineItemDetail } from "../data/treatmentPricing2025";
import { isBoutiqueSkincareProductName } from "../components/modals/DiscussedTreatmentsModal/treatmentBoutiqueProducts";

/**
 * Order of discussed-item indices that matches `quote.lineItems` from checkout:
 * all non-wishlist Skincare rows (in list order), then all other non-wishlist treatments.
 * Same as TreatmentPlanCheckout `activeIndices`.
 */
export function getQuoteLineDiscussedItemIndexOrder(
  discussedItems: DiscussedItem[],
): number[] {
  const skincare: number[] = [];
  const treatment: number[] = [];
  discussedItems.forEach((d, idx) => {
    if ((d.timeline ?? "").trim().toLowerCase() === "wishlist") return;
    if (
      (d.treatment ?? "").trim() === "Skincare" &&
      isBoutiqueSkincareProductName(d.product ?? "")
    ) {
      skincare.push(idx);
    } else treatment.push(idx);
  });
  return [...skincare, ...treatment];
}

/**
 * Resolve skincare vs treatment row for blueprint quote (`quoteLineKind` or legacy payloads).
 * Stored `quote.lineItems` are in the same order as checkout: non-wishlist boutique skincare lines
 * first, then all other lines — not the same order as `discussedItems` in the plan list.
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
