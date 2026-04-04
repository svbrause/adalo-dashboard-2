// Provider helper functions

import { Provider } from "../types";
import { isWellnestWellnessProviderCode } from "../data/wellnestOfferings";

/** The Treatment Skin Boutique — public booking (MVP Post-Visit Blueprint CTA). */
export const THE_TREATMENT_BOOKING_URL = "https://getthetreatment.com/#book-now";

/**
 * Provider login codes that share The Treatment combined patient list
 * (see DashboardContext merge for TheTreatment250 / TheTreatment447).
 */
export const THE_TREATMENT_PROVIDER_CODES = ["TheTreatment250", "TheTreatment447"] as const;

const THE_TREATMENT_DISPLAY_NAMES = [
  "The Treatment",
  "San Clemente, Henderson, and Newport Beach",
] as const;

const WELLNEST_DISPLAY_NAMES = ["Wellnest MD", "Wellnest"] as const;

/** Admin login codes allowed to send/view Post-Visit Blueprint links. */
const ADMIN_BLUEPRINT_PROVIDER_CODES = ["admin", "password"] as const;

function isAdminBlueprintCode(code: string | null | undefined): boolean {
  const c = (code || "").trim().toLowerCase();
  return ADMIN_BLUEPRINT_PROVIDER_CODES.some((x) => x === c);
}

/**
 * True when a shared blueprint was sent from an Admin / demo login (patient `/tp` branding).
 * Matches admin provider codes or display name "Admin" (including legacy links without code).
 */
export function isPostVisitBlueprintAdminSender(payload: {
  providerCode?: string;
  providerName?: string;
}): boolean {
  if (isAdminBlueprintCode(payload.providerCode)) return true;
  const prov = (payload.providerName || "").trim().toLowerCase();
  return prov === "admin";
}

/** True when the logged-in account is The Treatment Skin Boutique (Post-Visit Blueprint is gated here). */
export function isTheTreatmentProvider(provider: Provider | null): boolean {
  if (!provider) return false;
  const code = (provider.code || "").trim().toLowerCase();
  const codeMatch = THE_TREATMENT_PROVIDER_CODES.some((c) => c.toLowerCase() === code);
  const nameTrimmed = (provider.name || "").trim();
  const nameMatch = THE_TREATMENT_DISPLAY_NAMES.some((name) => name === nameTrimmed);
  return codeMatch || nameMatch;
}

/** For public blueprint payload validation (provider code string only). */
export function isTheTreatmentProviderCode(code: string | null | undefined): boolean {
  if (!code?.trim()) return false;
  const c = code.trim().toLowerCase();
  return THE_TREATMENT_PROVIDER_CODES.some((x) => x.toLowerCase() === c);
}

/**
 * Internal / demo login that may send Post-Visit Blueprints (e.g. provider code or display name "Admin").
 * Matches allowlisted admin codes or display name "Admin".
 */
export function isAdminBlueprintProvider(provider: Provider | null): boolean {
  if (!provider) return false;
  const name = (provider.name || "").trim().toLowerCase();
  return isAdminBlueprintCode(provider.code) || name === "admin";
}

/**
 * Legacy env flag for The Treatment–specific experiments. Post-Visit Blueprint and related
 * dashboard UI are no longer gated on this value; kept for optional future use.
 */
export function theTreatmentPreviewFeaturesEnabled(): boolean {
  return import.meta.env.VITE_THE_TREATMENT_PREVIEW_FEATURES === "true";
}

/**
 * Whether The Treatment–specific preview UI should show. Post-Visit Blueprint is enabled
 * for all providers; this now always returns true so dashboard behavior is consistent.
 */
export function providerShowsTheTreatmentPreviewUi(
  _provider: Provider | null | undefined,
): boolean {
  return true;
}

/** Dashboard: any logged-in provider may send a Post-Visit Blueprint link. */
export function isPostVisitBlueprintSender(provider: Provider | null): boolean {
  return Boolean(provider);
}

/**
 * Patient micro-site: trust any non-empty issuer code on the payload (links are still
 * token-gated server-side). Legacy allowlist helpers remain for empty-code fallbacks.
 */
export function isPostVisitBlueprintProviderCode(code: string | null | undefined): boolean {
  if (code?.trim()) return true;
  return false;
}

/**
 * Whether a decoded blueprint may be shown on the patient page.
 * - If `providerCode` is present: any non-empty code (see {@link isPostVisitBlueprintProviderCode}).
 * - If `providerCode` is missing/empty (older SMS links): allow only when clinic or provider
 *   display matches Admin, The Treatment, or Wellnest.
 */
export function isPostVisitBlueprintAllowedForPatient(payload: {
  providerCode?: string;
  clinicName?: string;
  providerName?: string;
}): boolean {
  const code = payload.providerCode?.trim();
  if (code) {
    return isPostVisitBlueprintProviderCode(code);
  }

  const clinicL = (payload.clinicName || "").trim().toLowerCase();
  const provL = (payload.providerName || "").trim().toLowerCase();
  if (clinicL === "admin" || provL === "admin") return true;

  const clinicTrim = (payload.clinicName || "").trim();
  const provTrim = (payload.providerName || "").trim();
  if (
    WELLNEST_DISPLAY_NAMES.some((n) => n === clinicTrim || n === provTrim)
  ) {
    return true;
  }
  return THE_TREATMENT_DISPLAY_NAMES.some(
    (n) => n === clinicTrim || n === provTrim,
  );
}

/**
 * Booking / scheduling URL embedded in Post-Visit Blueprint CTAs.
 * Wellnest uses the provider telehealth / web link when set; The Treatment keeps the public book page.
 */
export function getPostVisitBlueprintBookingUrl(provider: Provider | null): string {
  if (isWellnestWellnessProviderCode(provider?.code)) {
    const tele = getTelehealthLink(provider);
    const t = tele?.trim();
    if (t && !t.includes("your-telehealth-link.com")) return t;
    const web = String(
      provider?.["Web Link"] || provider?.WebLink || "",
    ).trim();
    return web;
  }
  return THE_TREATMENT_BOOKING_URL;
}

/** Name fragment that identifies Unique Aesthetics (e.g. "Unique Aesthetics & Wellness"). */
const UNIQUE_AESTHETICS_NAME_FRAGMENT = "unique aesthetics";
/** Login code for Unique Aesthetics (Providers table). */
const UNIQUE_AESTHETICS_CODE = "unique2321";

/**
 * True when the logged-in provider is Unique Aesthetics (by display name or code).
 * Used to hide Scan At Home and Skin Quiz for this provider.
 */
export function isUniqueAestheticsProvider(provider: Provider | null): boolean {
  if (!provider) return false;
  const displayName = formatProviderDisplayName(provider.name).trim().toLowerCase();
  const rawName = (provider.name || "").trim().toLowerCase();
  const code = (provider.code || "").trim().toLowerCase();
  const nameContains = displayName.includes(UNIQUE_AESTHETICS_NAME_FRAGMENT) ||
    rawName.includes(UNIQUE_AESTHETICS_NAME_FRAGMENT);
  return code === UNIQUE_AESTHETICS_CODE || nameContains;
}

/**
 * Format provider name for display. If the name contains commas (e.g. "Amy,Amy Calo,Calo"),
 * use the segment before the first comma as first name and after the last comma as last name.
 */
export function formatProviderDisplayName(
  name: string | null | undefined,
): string {
  const raw = (name || "").trim();
  if (!raw) return "";
  const commaIndex = raw.indexOf(",");
  if (commaIndex === -1) return raw;
  const firstPart = raw.slice(0, commaIndex).trim();
  const lastCommaIndex = raw.lastIndexOf(",");
  const lastPart = raw.slice(lastCommaIndex + 1).trim();
  if (!firstPart && !lastPart) return raw;
  if (!firstPart) return lastPart;
  if (!lastPart) return firstPart;
  return `${firstPart} ${lastPart}`;
}

export function getJotformUrl(provider: Provider | null): string {
  if (!provider) return "https://app.ponce.ai/face/default-clinic";

  // Use Form Link from Providers table when set (used for in-clinic scan)
  const formLink =
    provider["Form Link"] ||
    provider.FormLink ||
    provider["Form link"] ||
    provider["form link"];
  if (formLink && typeof formLink === "string" && formLink.trim()) {
    return formLink.trim();
  }

  return (
    provider.JotformURL ||
    provider.SCAN_FORM_URL ||
    "https://app.ponce.ai/face/default-clinic"
  );
}

export function getTelehealthLink(provider: Provider | null): string {
  if (!provider) return "https://your-telehealth-link.com";
  return (
    provider["Web Link"] ||
    provider.WebLink ||
    "https://your-telehealth-link.com"
  );
}

export function getTelehealthScanLink(provider: Provider | null): string {
  if (!provider) {
    console.warn("⚠️ PROVIDER_INFO not loaded yet, using default URL");
    return "https://app.ponce.ai/face/default-email";
  }

  let link =
    provider["Web Link"] ||
    provider.WebLink ||
    provider["web link"] ||
    provider.webLink;

  if (!link) {
    link =
      provider["Form Link"] ||
      provider.FormLink ||
      provider["Form link"] ||
      provider.formLink;
  }

  if (!link) {
    console.warn(
      "⚠️ No Web Link or Form Link found in provider info, using default",
    );
    return "https://app.ponce.ai/face/default-email";
  }

  return link;
}
