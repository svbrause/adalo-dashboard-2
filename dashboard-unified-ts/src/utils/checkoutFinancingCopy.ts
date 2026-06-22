import { formatPrice } from "../data/treatmentPricing2025";
import {
  isSlimStudioProvider,
  SLIM_STUDIO_FINANCING_URL,
  type SlimStudioProviderContext,
} from "../data/slimStudioOfferings";

function roundPayment(n: number): number {
  return Math.max(1, Math.round(n));
}

/** Split total ÷ months — default for non–Slim Studio providers. */
const DEFAULT_FINANCING_EXAMPLE_MONTHS = 5;

const DEFAULT_FINANCING_URL = "https://www.carecredit.com";

export type CheckoutFinancingConfig = {
  exampleMonths: number;
  financingUrl: string;
  /** Appended to monthly estimate summary when prices are known. */
  summarySuffix?: string;
  /** Shown when prices are unknown (checkout / quote). */
  leadNoPrices?: string;
  /** Shown when prices are unknown on blueprint with treatments-only scope. */
  leadNoPricesTreatmentsOnly?: string;
};

export type ProviderFinancingFields = SlimStudioProviderContext & {
  [key: string]: unknown;
};

function slimStudioFinancingConfig(): CheckoutFinancingConfig {
  return {
    exampleMonths: 12,
    financingUrl: SLIM_STUDIO_FINANCING_URL,
    summarySuffix:
      "0% APR for 12 months with Allē/Cherry (subject to approval).",
    leadNoPrices:
      "Pay in full or apply for Allē/Cherry or CareCredit — 3, 6, or 12 month plans with little to no interest (subject to approval).",
    leadNoPricesTreatmentsOnly:
      "Financing through Allē/Cherry or CareCredit usually applies to in-office treatments; retail skincare is paid separately.",
  };
}

function defaultFinancingConfig(financingUrl: string): CheckoutFinancingConfig {
  return {
    exampleMonths: DEFAULT_FINANCING_EXAMPLE_MONTHS,
    financingUrl,
  };
}

/** Resolve checkout / blueprint financing copy and link for a provider. */
export function getCheckoutFinancingConfig(
  provider?: ProviderFinancingFields | string | null,
): CheckoutFinancingConfig {
  if (isSlimStudioProvider(provider)) {
    return slimStudioFinancingConfig();
  }
  return defaultFinancingConfig(resolveProviderFinancingUrl(provider));
}

/** Prefer Airtable fields; Slim Studio always uses the practice financing page. */
export function resolveProviderFinancingUrl(
  provider?: ProviderFinancingFields | string | null,
): string {
  if (isSlimStudioProvider(provider)) {
    return SLIM_STUDIO_FINANCING_URL;
  }
  if (provider == null || typeof provider === "string") {
    return DEFAULT_FINANCING_URL;
  }
  const val = String(
    provider["Financing Link"] ??
      provider["Financing URL"] ??
      provider["CareCredit Link"] ??
      provider["Cherry Link"] ??
      "",
  ).trim();
  return val || DEFAULT_FINANCING_URL;
}

export function getFinancingMonthlyEstimate(
  total: number,
  config?: Pick<CheckoutFinancingConfig, "exampleMonths">,
): {
  perMonthFormatted: string;
  months: number;
} | null {
  if (!Number.isFinite(total) || total <= 0) return null;
  const months =
    config?.exampleMonths ?? DEFAULT_FINANCING_EXAMPLE_MONTHS;
  const t = Math.round(total * 100) / 100;
  const perMonth = roundPayment(t / months);
  return { perMonthFormatted: formatPrice(perMonth), months };
}

export function buildCheckoutFinancingExampleSummary(
  total: number,
  config?: CheckoutFinancingConfig,
): string | null {
  const financingConfig = config ?? defaultFinancingConfig(DEFAULT_FINANCING_URL);
  const est = getFinancingMonthlyEstimate(total, financingConfig);
  if (!est) return null;
  const base = `About ${est.perMonthFormatted}/mo for ${est.months} months.`;
  return financingConfig.summarySuffix
    ? `${base} ${financingConfig.summarySuffix}`
    : base;
}

/** Integrated / PVB quote: clarifies pay-over-time applies to treatments, not retail skincare. */
export const FINANCING_TREATMENTS_ONLY_SCOPE_NOTE =
  "Based on your treatments total only. Skincare products are paid separately.";

/** When treatment prices are unknown — same scope as {@link FINANCING_TREATMENTS_ONLY_SCOPE_NOTE}. */
export const FINANCING_TREATMENTS_ONLY_LEAD_NO_PRICES =
  "Financing usually applies to in-office treatments; retail skincare is paid separately.";

export function getFinancingLeadNoPrices(
  config: CheckoutFinancingConfig,
  treatmentsOnly: boolean,
): string {
  if (treatmentsOnly) {
    return (
      config.leadNoPricesTreatmentsOnly ?? FINANCING_TREATMENTS_ONLY_LEAD_NO_PRICES
    );
  }
  return config.leadNoPrices ?? "Pay in full at booking or ask about pay-over-time options.";
}
