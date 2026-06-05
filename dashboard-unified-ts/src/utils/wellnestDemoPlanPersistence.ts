/**
 * Demo patients (`wellnest-demo-*`, `admin-demo-*`) are not Airtable rows. Treatment plan
 * changes are stored in sessionStorage so Add to plan / Manage plan work until the tab closes.
 */

import type { Client, DiscussedItem } from "../types";
import { updateLeadRecord } from "../services/api";
import { AIRTABLE_FIELD } from "../components/modals/DiscussedTreatmentsModal/constants";
import { isAddClientLead } from "./leadSource";
import { capturePatientAcquisitionFunnelEvent } from "./patientAcquisitionAnalytics";

const WELLNEST_STORAGE_PREFIX = "wellnest-demo-plan:";
const ADMIN_DEMO_STORAGE_PREFIX = "admin-demo-plan:";
const SLIM_STUDIO_STORAGE_PREFIX = "slimstudio-demo-plan:";

export function isWellnestDemoSampleClient(client: Pick<Client, "id">): boolean {
  return client.id.startsWith("wellnest-demo-");
}

export function isAdminDemoSampleClient(client: Pick<Client, "id">): boolean {
  return client.id.startsWith("admin-demo-");
}

export function isSlimStudioDemoSampleClient(client: Pick<Client, "id">): boolean {
  return client.id.startsWith("slimstudio-demo-");
}

/** Clients whose plan edits are persisted in sessionStorage, not Airtable. */
export function isSessionDemoPlanClient(client: Pick<Client, "id">): boolean {
  return (
    isWellnestDemoSampleClient(client) ||
    isAdminDemoSampleClient(client) ||
    isSlimStudioDemoSampleClient(client)
  );
}

function storageKeyForDemoClient(clientId: string): string | null {
  if (clientId.startsWith("wellnest-demo-")) {
    return WELLNEST_STORAGE_PREFIX + clientId;
  }
  if (clientId.startsWith("admin-demo-")) {
    return ADMIN_DEMO_STORAGE_PREFIX + clientId;
  }
  if (clientId.startsWith("slimstudio-demo-")) {
    return SLIM_STUDIO_STORAGE_PREFIX + clientId;
  }
  return null;
}

export function loadSessionDemoDiscussedItems(clientId: string): DiscussedItem[] | null {
  const key = storageKeyForDemoClient(clientId);
  if (!key) return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as DiscussedItem[]) : null;
  } catch {
    return null;
  }
}

/** @deprecated Use {@link loadSessionDemoDiscussedItems} */
export function loadWellnestDemoDiscussedItems(clientId: string): DiscussedItem[] | null {
  if (!clientId.startsWith("wellnest-demo-")) return null;
  return loadSessionDemoDiscussedItems(clientId);
}

/** Merge stored plan onto a demo client row (used when re-injecting samples after refresh). */
export function withSessionDemoDiscussedItemsOverlay(client: Client): Client {
  if (!isSessionDemoPlanClient(client)) return client;
  const stored = loadSessionDemoDiscussedItems(client.id);
  if (!stored) return client;
  return { ...client, discussedItems: stored };
}

/** @deprecated Use {@link withSessionDemoDiscussedItemsOverlay} */
export function withWellnestDemoDiscussedItemsOverlay(client: Client): Client {
  return withSessionDemoDiscussedItemsOverlay(client);
}

/**
 * Save treatment plan to Airtable for real clients, or sessionStorage for Wellnest demos.
 */
export async function persistClientDiscussedItems(
  client: Pick<Client, "id" | "tableSource"> & { source?: string | null },
  nextItems: DiscussedItem[],
): Promise<void> {
  const touch = new Date().toISOString();
  const stamped = nextItems.map((i) => ({ ...i, updatedAt: touch }));

  const storageKey = storageKeyForDemoClient(client.id);
  if (storageKey) {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(stamped));
    } catch {
      /* quota / private mode */
    }
    return;
  }
  const payload = stamped.length > 0 ? JSON.stringify(stamped) : "";
  await updateLeadRecord(client.id, client.tableSource, {
    [AIRTABLE_FIELD]: payload,
  });

  if (stamped.length > 0 && isAddClientLead(client)) {
    const key = `ph_acq_plan:${client.id}`;
    try {
      if (typeof localStorage !== "undefined" && localStorage.getItem(key) !== "1") {
        localStorage.setItem(key, "1");
        capturePatientAcquisitionFunnelEvent(
          "funnel_treatment_plan_built",
          client.id,
          { plan_item_count: stamped.length },
        );
      }
    } catch {
      /* storage blocked */
    }
  }
}
