/**
 * Wellnest sample patients (`wellnest-demo-*`) are not Airtable rows. Treatment plan
 * changes are stored in sessionStorage so Add to plan / Manage plan work until the tab closes.
 */

import type { Client, DiscussedItem } from "../types";
import { updateLeadRecord } from "../services/api";
import { AIRTABLE_FIELD } from "../components/modals/DiscussedTreatmentsModal/constants";
import { isAddClientLead } from "./leadSource";
import { capturePatientAcquisitionFunnelEvent } from "./patientAcquisitionAnalytics";

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
  client: Pick<Client, "id" | "tableSource"> & { source?: string | null },
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

  if (nextItems.length > 0 && isAddClientLead(client)) {
    const key = `ph_acq_plan:${client.id}`;
    try {
      if (typeof localStorage !== "undefined" && localStorage.getItem(key) !== "1") {
        localStorage.setItem(key, "1");
        capturePatientAcquisitionFunnelEvent(
          "funnel_treatment_plan_built",
          client.id,
          { plan_item_count: nextItems.length },
        );
      }
    } catch {
      /* storage blocked */
    }
  }
}
