import { FormEvent, useEffect, useMemo, useState } from "react";
import { useDashboard } from "../../context/DashboardContext";
import { submitHelpRequest } from "../../services/api";
import { formatPrice } from "../../data/treatmentPricing2025";
import { showError, showToast } from "../../utils/toast";
import { isValidEmail } from "../../utils/validation";
import "./SmsConfigChangeRequestModal.css";

export type PricingHelpSkuContext = {
  /** Price list section in code (e.g. Injectables, Laser). */
  category: string;
  name: string;
  price: number;
  note?: string;
  /** Unified dashboard category when mapped (e.g. Biostimulants, Filler). */
  planCategory?: string;
};

type PricingChangeRequestModalProps = {
  /** When set, the form is prefilled for this SKU; otherwise a general pricing request. */
  sku: PricingHelpSkuContext | null;
  onClose: () => void;
};

export default function PricingChangeRequestModal({
  sku,
  onClose,
}: PricingChangeRequestModalProps) {
  const { provider } = useDashboard();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [request, setRequest] = useState("");
  const [loading, setLoading] = useState(false);

  const defaultRequest = useMemo(() => {
    if (sku) {
      const noteLine = sku.note?.trim() ? `Note on file: ${sku.note.trim()}` : "";
      const planLine = sku.planCategory?.trim()
        ? `Treatment type in plans: ${sku.planCategory.trim()}`
        : "";
      return [
        `Section: ${sku.category}`,
        planLine,
        `Service: ${sku.name}`,
        `Current price: ${formatPrice(sku.price)}`,
        noteLine,
        "",
        "What I would like changed:",
      ]
        .filter(Boolean)
        .join("\n");
    }
    return [
      "Describe what you need changed—new services, new prices, or different names shown to patients.",
      "If you can, list each service with the price today and the price or wording you want.",
      "",
      "What I would like changed:",
    ].join("\n");
  }, [sku]);

  useEffect(() => {
    setRequest(defaultRequest);
  }, [defaultRequest]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!provider) {
      showError("Please refresh the page and try again.");
      return;
    }
    if (!name.trim()) {
      showError("Please add your name.");
      return;
    }
    if (!email.trim() || !isValidEmail(email)) {
      showError("Please add a valid email.");
      return;
    }
    if (!request.trim()) {
      showError("Please describe what you would like changed.");
      return;
    }

    setLoading(true);
    try {
      const taggedMessage = `[PRICING CHANGE REQUEST]\n${request.trim()}`;
      await submitHelpRequest(name.trim(), email.trim(), taggedMessage, provider.id);
      showToast("Request sent to the team.");
      onClose();
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Failed to send request.");
    } finally {
      setLoading(false);
    }
  };

  const title = sku ? "Request pricing change" : "Request pricing update";
  const subtitle = sku
    ? "You can browse prices here; only our team can edit the list. Send this form and we will update it for you."
    : "Use this when several services need changes, or your update does not match a single row in the list.";

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content sms-config-request-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-info">
            <h2 className="modal-title">{title}</h2>
            <p className="sms-config-request-subtitle">{subtitle}</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body sms-config-request-body">
            <div className="form-group">
              <label htmlFor="pricing-req-name">Your Name</label>
              <input
                id="pricing-req-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="pricing-req-email">Email</label>
              <input
                id="pricing-req-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@clinic.com"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="pricing-req-message">What would you like changed?</label>
              <textarea
                id="pricing-req-message"
                rows={8}
                value={request}
                onChange={(e) => setRequest(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="modal-footer">
            <div className="modal-actions-left" />
            <div className="modal-actions-right">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? "Sending..." : "Send request"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
