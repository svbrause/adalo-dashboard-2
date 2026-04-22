import type { DiscussedItem } from "../types";
import {
  isValidPlanScheduledDateIso,
  parsePlanScheduledDateLocal,
} from "./planScheduledDate";

export type PvbPlanCalendarDayBlock = {
  iso: string;
  dateShort: string;
  items: DiscussedItem[];
};

export type PvbPlanCalendarMonthBlock = {
  monthKey: string;
  monthLabel: string;
  days: PvbPlanCalendarDayBlock[];
};

/**
 * Groups plan rows with a valid {@link DiscussedItem.scheduledDate} into month → day → items,
 * matching the plan builder “Schedule” subview (agenda list).
 */
export function buildPlanCalendarAgendaFromDiscussedItems(
  discussedItems: DiscussedItem[],
): PvbPlanCalendarMonthBlock[] {
  const byDate = new Map<string, DiscussedItem[]>();
  for (const item of discussedItems) {
    const iso = item.scheduledDate?.trim();
    if (!iso || !isValidPlanScheduledDateIso(iso)) continue;
    const cur = byDate.get(iso) ?? [];
    cur.push(item);
    byDate.set(iso, cur);
  }
  const isos = [...byDate.keys()].sort();
  const months: PvbPlanCalendarMonthBlock[] = [];
  let current: PvbPlanCalendarMonthBlock | null = null;
  for (const iso of isos) {
    const d = parsePlanScheduledDateLocal(iso);
    if (!d) continue;
    const items = byDate.get(iso) ?? [];
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthLabel = new Intl.DateTimeFormat(undefined, {
      month: "long",
      year: "numeric",
    }).format(d);
    const dateShort = new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(d);
    if (!current || current.monthKey !== monthKey) {
      current = { monthKey, monthLabel, days: [] };
      months.push(current);
    }
    current.days.push({ iso, dateShort, items });
  }
  return months;
}
