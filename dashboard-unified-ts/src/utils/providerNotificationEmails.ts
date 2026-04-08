import type { Provider } from "../types";
import { isValidEmail } from "./validation";

const STORAGE_PREFIX = "dashboard_team_notification_emails_v1_";

function storageKey(providerId: string): string {
  return `${STORAGE_PREFIX}${providerId.trim()}`;
}

function dedupeValidEmails(emails: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of emails) {
    const t = String(raw ?? "").trim();
    if (!t || !isValidEmail(t)) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

/**
 * Default notification recipients from the provider's Airtable record.
 * Primary source: "Booking Email" field (Providers table).
 * Falls back to generic email fields if "Booking Email" is absent.
 */
export function defaultTeamNotificationEmailsFromProvider(
  provider: Provider | null,
): string[] {
  if (!provider) return [];
  const candidates = [
    // Primary: Booking Email field in the Providers table
    provider["Booking Email"],
    // Fallbacks for providers whose record doesn't have the Booking Email field
    (provider as { email?: string }).email,
    (provider as { Email?: string }).Email,
    provider["Email"],
    provider["Provider Email"],
    provider["Contact Email"],
  ].filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  const parts: string[] = [];
  for (const c of candidates) {
    for (const p of c.split(/[,;\n]+/)) {
      const t = p.trim();
      if (t) parts.push(t);
    }
  }
  return dedupeValidEmails(parts);
}

/**
 * `undefined` = user has never saved; use {@link defaultTeamNotificationEmailsFromProvider}.
 * `[]` = user saved an explicit empty list (no CC line on requests).
 */
export function loadSavedTeamNotificationEmails(
  providerId: string,
): string[] | undefined {
  if (!providerId?.trim()) return undefined;
  try {
    const raw = localStorage.getItem(storageKey(providerId));
    if (raw == null) return undefined;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    return dedupeValidEmails(parsed.map(String));
  } catch {
    return undefined;
  }
}

export function saveTeamNotificationEmails(
  providerId: string,
  emails: string[],
): void {
  if (!providerId?.trim()) return;
  localStorage.setItem(
    storageKey(providerId),
    JSON.stringify(dedupeValidEmails(emails)),
  );
}

export function clearSavedTeamNotificationEmails(providerId: string): void {
  if (!providerId?.trim()) return;
  localStorage.removeItem(storageKey(providerId));
}

/** Recipients appended to help / change-request messages for this provider. */
export function getEffectiveTeamNotificationEmails(
  providerId: string,
  provider: Provider | null,
): string[] {
  const saved = loadSavedTeamNotificationEmails(providerId);
  if (saved !== undefined) return saved;
  return defaultTeamNotificationEmailsFromProvider(provider);
}

/**
 * Appends a footer so support can CC or route to the practice’s chosen inboxes.
 * Omits the footer when the effective list is empty.
 */
export function appendTeamNotificationEmailsToHelpMessage(
  message: string,
  providerId: string,
  provider: Provider | null,
): string {
  const emails = getEffectiveTeamNotificationEmails(providerId, provider);
  if (emails.length === 0) return message.trim();
  return `${message.trim()}\n\n---\nProvider team notification recipients (Settings › Team notifications): ${emails.join(", ")}`;
}
