import {
  useCallback,
  useEffect,
  useId,
  useState,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import "./MintMembershipInfoTrigger.css";

type MintMembershipInfoTriggerProps = {
  /** Stack above host UI (drawer ~100, modals ~1000+). */
  zIndex?: number;
  className?: string;
  /** Fires when the info dialog is opened (e.g. PostHog). */
  onInfoOpen?: () => void;
};

export function MintMembershipInfoTrigger({
  zIndex = 10050,
  className = "",
  onInfoOpen,
}: MintMembershipInfoTriggerProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  const onTriggerClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
    onInfoOpen?.();
  };

  const dialog =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            className="mint-membership-info-overlay"
            style={{ zIndex }}
            onClick={close}
            role="presentation"
          >
            <div
              className="mint-membership-info-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              onClick={(ev) => ev.stopPropagation()}
            >
              <button
                type="button"
                className="mint-membership-info-close"
                onClick={close}
                aria-label="Close Mint membership details"
              >
                ×
              </button>
              <h2 id={titleId}>Mint membership</h2>
              <p className="mint-membership-info-lead">
                The Treatment&rsquo;s membership program with monthly perks and savings on
                services and boutique skincare. Sign up through your preferred location; full
                terms are on our site.
              </p>
              <h3 className="mint-membership-info-sub">Membership &amp; benefits (summary)</h3>
              <ul>
                <li>$150 monthly account credit</li>
                <li>10% off all services</li>
                <li>10% off all products (gift card purchases excluded from the discount)</li>
                <li>Exclusive birthday gift</li>
                <li>Priority event access</li>
                <li>
                  Membership discounts are not combinable with other sales or discounts; monthly
                  credit cannot be used to purchase gift cards.
                </li>
              </ul>
              <p className="mint-membership-info-note">
                Active memberships renew monthly; initial agreement term and cancellation rules
                apply.
              </p>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        className={`mint-membership-info-btn${className ? ` ${className}` : ""}`}
        onClick={onTriggerClick}
        aria-label="Mint membership: more information"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        i
      </button>
      {dialog}
    </>
  );
}
