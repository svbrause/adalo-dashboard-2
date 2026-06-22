import type { Client } from "../types";
import { mapAreasToFormFields } from "./formMapping";
import { splitName } from "./validation";

export type ClinicScanClientMatch = {
  id: string;
  tableSource: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  faceRegions: string[];
};

export type ClinicScanContactMatch = ClinicScanClientMatch & {
  matchedEmail: boolean;
  matchedPhone: boolean;
};

export function clientToClinicScanMatch(client: Client): ClinicScanClientMatch {
  const { first, last } = splitName(client.name);
  const { faceRegions } = mapAreasToFormFields(client);
  return {
    id: client.id,
    tableSource: client.tableSource,
    name: client.name,
    firstName: first,
    lastName: last,
    email: client.email ?? "",
    phone: client.phone ?? "",
    faceRegions,
  };
}

/** Match clients by name, email, or phone (same rules as dashboard search). */
export function searchClientsForClinicScan(
  clients: Client[],
  query: string,
  limit = 8,
): Client[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const normalizedDigits = q.replace(/\D/g, "");
  const matches = clients.filter((client) => {
    if (client.archived) return false;
    const name = String(client.name ?? "").toLowerCase();
    const email = String(client.email ?? "").toLowerCase();
    const phone = String(client.phone ?? "");
    const phoneDigits = phone.replace(/\D/g, "");
    return (
      name.includes(q) ||
      email.includes(q) ||
      phone.toLowerCase().includes(q) ||
      (normalizedDigits.length > 0 && phoneDigits.includes(normalizedDigits))
    );
  });

  return matches.slice(0, limit);
}

/** Normalize a phone string to the last 10 US digits, when available. */
export function normalizeContactPhoneDigits(phone: string): string {
  let digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length >= 11 && digits[0] === "1") digits = digits.slice(1);
  return digits.slice(-10);
}

/** Find non-archived clients whose email and/or phone exactly match the intake fields. */
export function findClientsByContactForClinicScan(
  clients: Client[],
  contact: { email?: string; phone?: string },
): ClinicScanContactMatch[] {
  const emailNorm = String(contact.email ?? "").trim().toLowerCase();
  const phoneDigits = normalizeContactPhoneDigits(contact.phone ?? "");
  const hasEmail = emailNorm.includes("@") && emailNorm.includes(".");
  const hasPhone = phoneDigits.length >= 10;
  if (!hasEmail && !hasPhone) return [];

  const byId = new Map<string, ClinicScanContactMatch>();

  for (const client of clients) {
    if (client.archived) continue;

    const clientEmail = String(client.email ?? "").trim().toLowerCase();
    const clientPhoneDigits = normalizeContactPhoneDigits(client.phone ?? "");
    const matchedEmail = hasEmail && clientEmail === emailNorm;
    const matchedPhone = hasPhone && clientPhoneDigits === phoneDigits;
    if (!matchedEmail && !matchedPhone) continue;

    const existing = byId.get(client.id);
    if (existing) {
      existing.matchedEmail = existing.matchedEmail || matchedEmail;
      existing.matchedPhone = existing.matchedPhone || matchedPhone;
      continue;
    }

    byId.set(client.id, {
      ...clientToClinicScanMatch(client),
      matchedEmail,
      matchedPhone,
    });
  }

  return Array.from(byId.values());
}
