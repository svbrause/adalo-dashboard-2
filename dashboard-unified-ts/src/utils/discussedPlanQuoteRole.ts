import type { DiscussedItem } from "../types";

/** True when the row is locked into the patient-facing quote (not an optional add-on). */
export function isPlanQuoteCoreDiscussedItem(item: DiscussedItem): boolean {
  return item.planQuoteRole === "core";
}
