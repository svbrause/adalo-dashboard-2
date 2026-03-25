import { formatPrice } from "../data/treatmentPricing2025";

function roundPayment(n: number): number {
  return Math.max(1, Math.round(n));
}

/** Split total ÷ months — used for financing copy and integrated quote rows. */
const FINANCING_EXAMPLE_MONTHS = 5;

export function getFinancingMonthlyEstimate(total: number): {
  perMonthFormatted: string;
  months: number;
} | null {
  if (!Number.isFinite(total) || total <= 0) return null;
  const t = Math.round(total * 100) / 100;
  const perMonth = roundPayment(t / FINANCING_EXAMPLE_MONTHS);
  return { perMonthFormatted: formatPrice(perMonth), months: FINANCING_EXAMPLE_MONTHS };
}

export function buildCheckoutFinancingExampleSummary(total: number): string | null {
  const est = getFinancingMonthlyEstimate(total);
  if (!est) return null;
  return `About ${est.perMonthFormatted}/mo for ${est.months} months.`;
}

/** Integrated / PVB quote: clarifies pay-over-time applies to treatments, not retail skincare. */
export const FINANCING_TREATMENTS_ONLY_SCOPE_NOTE =
  "Based on your treatments total only. Skincare products are paid separately.";

/** When treatment prices are unknown — same scope as {@link FINANCING_TREATMENTS_ONLY_SCOPE_NOTE}. */
export const FINANCING_TREATMENTS_ONLY_LEAD_NO_PRICES =
  "Financing usually applies to in-office treatments; retail skincare is paid separately.";
