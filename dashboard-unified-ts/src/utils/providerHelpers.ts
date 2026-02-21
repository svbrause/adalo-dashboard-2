// Provider helper functions

import { Provider } from "../types";

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
