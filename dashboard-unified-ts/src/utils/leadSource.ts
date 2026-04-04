import type { Client } from "../types";

/**
 * Source value stored in Airtable when a lead is added via the dashboard "Add Client" button.
 * Dashboard list includes all non-archived patients and web popup leads (including Add Client source).
 */
export const SOURCE_ADD_CLIENT = "Add Client";

/** Normalize for comparison (case, hyphens, spacing). */
export function normalizeLeadSourceKey(source: string | null | undefined): string {
  return String(source ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Web Popup Leads rows that were added in-clinic or from the dashboard — not the online treatment finder funnel.
 * Used to split Clients vs Leads in the sidebar and to hide the Online Treatment Finder section.
 */
export function isManualOrInClinicWebPopupLeadSource(
  source: string | null | undefined,
): boolean {
  const key = normalizeLeadSourceKey(source);
  if (!key) return false;
  if (key === SOURCE_ADD_CLIENT.toLowerCase()) return true;
  if (key === "walk in") return true;
  return false;
}

/** True when this row belongs in the Leads sidebar list (Instagram, site popup, etc.). */
export function isWebsiteMarketingWebLead(client: Client): boolean {
  if (client.tableSource === "Web Popup Leads") {
    return !isManualOrInClinicWebPopupLeadSource(client.source);
  }
  if (client.linkedLeadId && client.webPopupLeadSource != null) {
    return !isManualOrInClinicWebPopupLeadSource(client.webPopupLeadSource);
  }
  return false;
}

/** Show Online Treatment Finder / $50 coupon block only for marketing web-popup funnel leads. */
export function showOnlineTreatmentFinderSection(client: Client): boolean {
  return (
    client.tableSource === "Web Popup Leads" &&
    !isManualOrInClinicWebPopupLeadSource(client.source)
  );
}

/** Client type is from types/index.ts; we only need tableSource and source here. */
function isAddClientLead(client: {
  tableSource: string;
  source?: string | null;
}): boolean {
  if (client.tableSource !== "Web Popup Leads") return false;
  const src = (client.source ?? "").trim().toLowerCase();
  return src === SOURCE_ADD_CLIENT.toLowerCase();
}

export { isAddClientLead };
