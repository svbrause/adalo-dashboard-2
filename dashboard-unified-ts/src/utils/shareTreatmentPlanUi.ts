import type { DiscussedItem } from "../types";
import { formatPlanScheduledDateLabel } from "./planScheduledDate";
import { isWishlistTimelineDiscussedItem } from "./postVisitBlueprint";

/** Group heading for active (non-wishlist) treatments in share / preview UI. */
export const SHARE_TREATMENT_PLAN_SECTION_TITLE = "Treatment plan";

/** Wishlist bucket — not part of the active plan (Amazon-style). */
export const SHARE_WISHLIST_SECTION_TITLE = "Wishlist";

/** Completed rows in client summary (not on share blueprint). */
export const SHARE_COMPLETED_SECTION_TITLE = "Completed";

/**
 * "Now" / "Next visit" hint on a row when the plan groups Now + next visit together.
 */
export function planTimingLabelForDiscussedItem(
  item: DiscussedItem,
): string | null {
  if ((item.treatment ?? "").trim() === "Skincare") return null;
  const scheduled = formatPlanScheduledDateLabel(item.scheduledDate);
  if (scheduled) return scheduled;
  const t = (item.timeline ?? "").trim();
  if (t === "Now") return "Now";
  if (t === "Add next visit") return "Next Visit";
  return null;
}

export type ShareLinkTreatmentGroupVariant = "plan" | "wishlist";

export function buildShareLinkTreatmentGroups(
  treatmentShareItems: readonly DiscussedItem[],
): Array<{
  title: string;
  variant: ShareLinkTreatmentGroupVariant;
  items: DiscussedItem[];
}> {
  const plan: DiscussedItem[] = [];
  const wishlist: DiscussedItem[] = [];
  for (const item of treatmentShareItems) {
    if (isWishlistTimelineDiscussedItem(item)) wishlist.push(item);
    else plan.push(item);
  }
  const out: Array<{
    title: string;
    variant: ShareLinkTreatmentGroupVariant;
    items: DiscussedItem[];
  }> = [];
  if (plan.length > 0) {
    out.push({
      title: SHARE_TREATMENT_PLAN_SECTION_TITLE,
      variant: "plan",
      items: plan,
    });
  }
  if (wishlist.length > 0) {
    out.push({
      title: SHARE_WISHLIST_SECTION_TITLE,
      variant: "wishlist",
      items: wishlist,
    });
  }
  return out;
}

export type ClientDetailTreatmentPreviewSectionId =
  | "plan"
  | "wishlist"
  | "completed";

const CLIENT_DETAIL_SECTION_ORDER: ClientDetailTreatmentPreviewSectionId[] = [
  "plan",
  "wishlist",
  "completed",
];

const CLIENT_DETAIL_SECTION_TITLE: Record<
  ClientDetailTreatmentPreviewSectionId,
  string
> = {
  plan: SHARE_TREATMENT_PLAN_SECTION_TITLE,
  wishlist: SHARE_WISHLIST_SECTION_TITLE,
  completed: SHARE_COMPLETED_SECTION_TITLE,
};

function itemMatchesClientDetailTreatmentSection(
  item: DiscussedItem,
  section: ClientDetailTreatmentPreviewSectionId,
): boolean {
  if ((item.treatment ?? "").trim() === "Skincare") return false;
  const t = (item.timeline ?? "").trim();
  if (section === "plan") {
    if (item.scheduledDate?.trim()) return true;
    return t === "Now" || t === "Add next visit";
  }
  if (section === "wishlist") {
    if (item.scheduledDate?.trim()) return false;
    return t === "Wishlist" || !t;
  }
  return t === "Completed";
}

/** Non-skincare treatments for the client detail / modal plan preview buckets. */
export function getDiscussedTreatmentsForClientDetailSection(
  discussedItems: readonly DiscussedItem[] | undefined,
  section: ClientDetailTreatmentPreviewSectionId,
): DiscussedItem[] {
  const items = discussedItems ?? [];
  return items.filter((item) =>
    itemMatchesClientDetailTreatmentSection(item, section),
  );
}

export function clientDetailTreatmentPreviewSectionsInOrder(): ReadonlyArray<{
  id: ClientDetailTreatmentPreviewSectionId;
  title: string;
}> {
  return CLIENT_DETAIL_SECTION_ORDER.map((id) => ({
    id,
    title: CLIENT_DETAIL_SECTION_TITLE[id],
  }));
}
