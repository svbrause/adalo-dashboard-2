/**
 * Source value stored in Airtable when a lead is added via the dashboard "Add Client" button.
 * These leads are shown on the All Clients tab; other Web Popup Leads (from the web form) appear on the Leads tab.
 */
export const SOURCE_ADD_CLIENT = "Add Client";

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
