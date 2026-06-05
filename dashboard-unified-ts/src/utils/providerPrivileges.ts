import { isSlimStudioProvider } from "../data/slimStudioOfferings";
import type { Provider } from "../types";

function normCode(code: string | null | undefined): string {
  return (code ?? "").trim().toLowerCase();
}

/** Provider codes that may open Settings and the global Messages view. */
const SMS_SETTINGS_PROVIDER_CODES = new Set([
  "thetreatment250",
  "thetreatment447",
  "password", // Admin dashboard login
  "wellnest1300",
  "judgemd",
  "12345", // JudgeMD demo / dev (same Settings + pricing as JudgeMD)
]);

/**
 * Settings + global Messages in the sidebar for:
 * - The Treatment staff (`TheTreatment250`, `TheTreatment447`)
 * - Admin (`password`)
 * - Wellnest MD (`Wellnest1300`) and JudgeMD (`JudgeMD` / demo `12345`) — practice settings + pricing catalog
 * - Slim Studio Face & Body (`SlimStudio56` / `rec60E89lWbT9GyFT`)
 */
export function providerHasSmsAndSettingsAccess(
  provider: Provider | null | undefined,
): boolean {
  if (!provider) return false;
  if (isSlimStudioProvider(provider)) return true;
  const code = normCode(provider.code);
  if (!code) return false;
  return SMS_SETTINGS_PROVIDER_CODES.has(code);
}
