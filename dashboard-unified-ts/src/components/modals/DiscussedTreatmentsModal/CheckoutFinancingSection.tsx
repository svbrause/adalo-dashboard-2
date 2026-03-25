import {
  buildCheckoutFinancingExampleSummary,
  FINANCING_TREATMENTS_ONLY_LEAD_NO_PRICES,
  FINANCING_TREATMENTS_ONLY_SCOPE_NOTE,
  getFinancingMonthlyEstimate,
} from "../../../utils/checkoutFinancingCopy";
import "./CheckoutFinancingSection.css";

export type CheckoutFinancingIntegratedSurface =
  | "order-summary"
  | "quote-footer"
  | "pvb-drawer";

export function CheckoutFinancingSection({
  totalAmount,
  hasUnknownPrices,
  financingUrl,
  variant = "panel",
  integratedSurface = "order-summary",
  onFinancingLinkClick,
  /** Hide the bottom financing CTA link (e.g. Post-Visit Blueprint quote drawer). */
  showFinancingLink = true,
  /** Blueprint: financing copy applies to treatments portion only. */
  financingScope = "default",
}: {
  totalAmount: number;
  hasUnknownPrices: boolean;
  financingUrl: string;
  /** `integrated` nests financing as rows with the treatment quote; legacy boxed styles are deprecated. */
  variant?: "panel" | "quote-sheet" | "pvb" | "integrated";
  /** When `variant` is `integrated`, controls spacing and palette. */
  integratedSurface?: CheckoutFinancingIntegratedSurface;
  onFinancingLinkClick?: () => void;
  showFinancingLink?: boolean;
  financingScope?: "default" | "treatments_only";
}) {
  const showNumbers =
    !hasUnknownPrices && Number.isFinite(totalAmount) && totalAmount > 0;
  const summaryLine = showNumbers
    ? buildCheckoutFinancingExampleSummary(totalAmount)
    : null;
  const monthlyEstimate = showNumbers
    ? getFinancingMonthlyEstimate(totalAmount)
    : null;

  const treatmentsOnly = financingScope === "treatments_only";
  const leadPayInFull =
    "Pay in full at booking or ask about pay-over-time options.";
  const leadTreatmentsOnly = FINANCING_TREATMENTS_ONLY_LEAD_NO_PRICES;
  const noNumbersLeadLegacy =
    variant === "pvb" && treatmentsOnly ? leadTreatmentsOnly : leadPayInFull;
  const noNumbersLeadIntegrated =
    integratedSurface === "pvb-drawer" && treatmentsOnly
      ? leadTreatmentsOnly
      : leadPayInFull;

  const integratedClass =
    integratedSurface === "quote-footer"
      ? "treatment-plan-checkout-financing--integrated treatment-plan-checkout-financing--integrated-quote-footer"
      : integratedSurface === "pvb-drawer"
        ? "treatment-plan-checkout-financing--integrated treatment-plan-checkout-financing--integrated-pvb"
        : "treatment-plan-checkout-financing--integrated treatment-plan-checkout-financing--integrated-order";

  if (variant === "integrated") {
    return (
      <div
        className={integratedClass}
        aria-label="Payment and financing options"
      >
        {monthlyEstimate ? (
          <>
            <div className="treatment-plan-checkout-financing-integrated__row">
              <span className="treatment-plan-checkout-financing-integrated__label">
                Est. monthly ({monthlyEstimate.months} payments)
              </span>
              <span className="treatment-plan-checkout-financing-integrated__value">
                {monthlyEstimate.perMonthFormatted}/mo
              </span>
            </div>
            {treatmentsOnly ? (
              <p className="treatment-plan-checkout-financing-integrated__scope-note">
                {FINANCING_TREATMENTS_ONLY_SCOPE_NOTE}
              </p>
            ) : null}
          </>
        ) : (
          <p className="treatment-plan-checkout-financing-integrated__lead">
            {noNumbersLeadIntegrated}
          </p>
        )}
        {showFinancingLink ? (
          <a
            className="treatment-plan-checkout-financing-integrated__link"
            href={financingUrl}
            target="_blank"
            rel="noreferrer"
            onClick={onFinancingLinkClick}
          >
            View financing options
          </a>
        ) : null}
      </div>
    );
  }

  /* Legacy boxed layout — kept for any older callers; prefer variant="integrated". */
  const wrapClass =
    variant === "panel"
      ? "treatment-plan-checkout-financing"
      : `treatment-plan-checkout-financing treatment-plan-checkout-financing--quote-sheet${
          variant === "pvb" ? " treatment-plan-checkout-financing--pvb" : ""
        }`;

  const sectionTitle =
    variant === "pvb" && treatmentsOnly
      ? "Financing for treatments"
      : "Pay in full or finance";

  return (
    <section className={wrapClass} aria-label="Payment and financing options">
      <h4 className="treatment-plan-checkout-financing__title">{sectionTitle}</h4>

      {summaryLine ? (
        <p className="treatment-plan-checkout-financing__summary">{summaryLine}</p>
      ) : (
        <p className="treatment-plan-checkout-financing__lead">{noNumbersLeadLegacy}</p>
      )}

      {showFinancingLink ? (
        <a
          className="treatment-plan-checkout-financing__link"
          href={financingUrl}
          target="_blank"
          rel="noreferrer"
          onClick={onFinancingLinkClick}
        >
          Check financing options
        </a>
      ) : null}
    </section>
  );
}
