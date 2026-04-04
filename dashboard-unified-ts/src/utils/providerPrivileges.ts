import type { Provider } from "../types";

function normCode(code: string | null | undefined): string {
  return (code ?? "").trim().toLowerCase();
}

/** Provider codes that may open Settings and the global Messages view. */
const SMS_SETTINGS_PROVIDER_CODES = new Set([
  "thetreatment250",
  "password", // Admin dashboard login
]);

/**
 * Settings + global Messages in the sidebar are only for:
 * - The Treatment staff (`TheTreatment250`)
 * - Admin (`password`)
 *
 * Wellnest and other provider codes do not get these entries.
 */
export function providerHasSmsAndSettingsAccess(
  provider: Provider | null | undefined,
): boolean {
  if (!provider) return false;
  const code = normCode(provider.code);
  if (!code) return false;
  return SMS_SETTINGS_PROVIDER_CODES.has(code);
}
