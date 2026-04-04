/**
 * Wellnest sample patients (`wellnest-demo-*`) are not Airtable rows. Treatment plan
 * changes are stored in sessionStorage so Add to plan / Manage plan work until the tab closes.
 */

import type { Client, DiscussedItem } from "../types";
import { updateLeadRecord } from "../services/api";
import { AIRTABLE_FIELD } from "../components/modals/DiscussedTreatmentsModal/constants";

const STORAGE_PREFIX = "wellnest-demo-plan:";

export function isWellnestDemoSampleClient(client: Pick<Client, "id">): boolean {
  return client.id.startsWith("wellnest-demo-");
}

export function loadWellnestDemoDiscussedItems(clientId: string): DiscussedItem[] | null {
  if (!clientId.startsWith("wellnest-demo-")) return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + clientId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as DiscussedItem[]) : null;
  } catch {
    return null;
  }
}

/** Merge stored plan onto a client row (used when re-injecting samples after refresh). */
export function withWellnestDemoDiscussedItemsOverlay(client: Client): Client {
  if (!isWellnestDemoSampleClient(client)) return client;
  const stored = loadWellnestDemoDiscussedItems(client.id);
  if (!stored) return client;
  return { ...client, discussedItems: stored };
}

/**
 * Save treatment plan to Airtable for real clients, or sessionStorage for Wellnest demos.
 */
export async function persistClientDiscussedItems(
  client: Pick<Client, "id" | "tableSource">,
  nextItems: DiscussedItem[],
): Promise<void> {
  if (isWellnestDemoSampleClient(client)) {
    try {
      sessionStorage.setItem(STORAGE_PREFIX + client.id, JSON.stringify(nextItems));
    } catch {
      /* quota / private mode */
    }
    return;
  }
  const payload = nextItems.length > 0 ? JSON.stringify(nextItems) : "";
  await updateLeadRecord(client.id, client.tableSource, {
    [AIRTABLE_FIELD]: payload,
  });
}
