/**
 * Load all Providers from Airtable via existing dashboard records API (filter TRUE()).
 * Used by Firebase admin UI to assign `practiceIds` (Airtable record ids) on user custom claims.
 */

import { BACKEND_API_URL } from "./api";

export type PracticeOption = {
  id: string;
  name: string;
  code: string;
};

export async function fetchAllPracticesForAdmin(): Promise<PracticeOption[]> {
  const u = new URL(`${BACKEND_API_URL}/api/dashboard/records/Providers`);
  u.searchParams.set("filterByFormula", "TRUE()");
  u.searchParams.set("maxRecords", "500");

  const res = await fetch(u.toString());
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err.error ||
        err.message ||
        `Failed to load Providers (${res.status})`,
    );
  }
  const data = (await res.json()) as {
    records?: Array<{ id: string; fields?: Record<string, unknown> }>;
  };
  const records = data.records ?? [];
  return records.map((r) => ({
    id: r.id,
    name: String(r.fields?.Name ?? r.fields?.name ?? ""),
    code: String(r.fields?.Code ?? r.fields?.code ?? ""),
  }));
}
