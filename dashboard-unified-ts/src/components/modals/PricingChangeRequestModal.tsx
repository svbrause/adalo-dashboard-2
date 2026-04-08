import { FormEvent, useEffect, useMemo, useState } from "react";
import { useDashboard } from "../../context/DashboardContext";
import { submitHelpRequest } from "../../services/api";
import { formatPrice } from "../../data/treatmentPricing2025";
import { showError, showToast } from "../../utils/toast";
import { appendTeamNotificationEmailsToHelpMessage } from "../../utils/providerNotificationEmails";
import { isValidEmail } from "../../utils/validation";
import { renderTemplateVars } from "../../utils/renderTemplateVars";
import "./SmsConfigChangeRequestModal.css";

export type PricingHelpSkuContext = {
  /** Price list section in code (e.g. Injectables, Laser) or catalog name for products. */
  category: string;
  name: string;
  price: number;
  note?: string;
  /** Unified dashboard category when mapped (e.g. Biostimulants, Filler). */
  planCategory?: string;
  /** Boutique / catalog rows: show this instead of {@link formatPrice} on {@link price}. */
  priceDisplayOverride?: string;
  productUrl?: string;
  descriptionSnippet?: string;
  rowKind?: "treatment" | "product" | "email-routing";
  /** email-routing: trigger sentence shown under the notification name. */
  emailTrigger?: string;
  /** email-routing: example subject line. */
  emailSubject?: string;
  /** email-routing: comma-separated list of recipients (e.g. "Patient, hello@clinic.com"). */
  emailRecipients?: string;
  /** email-routing: representative body copy of the email. */
  emailBody?: string;
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
  const [loading, setLoading] = useState(false);

  // Pricing / product mode: single free-text request
  const [request, setRequest] = useState("");

  // Email-routing mode: structured per-field changes
  const [subjectChange, setSubjectChange] = useState("");
  const [recipientsChange, setRecipientsChange] = useState("");
  const [bodyChange, setBodyChange] = useState("");
  const [emailNotes, setEmailNotes] = useState("");

  // Single toggle for all email-routing fields
  const [editMode, setEditMode] = useState(false);

  function startEdit() {
    if (!subjectChange) setSubjectChange(sku?.emailSubject ?? "");
    if (!recipientsChange) setRecipientsChange(sku?.emailRecipients ?? "");
    if (!bodyChange) setBodyChange(sku?.emailBody ?? "");
    setEditMode(true);
  }

  function cancelEdit() {
    setEditMode(false);
    setSubjectChange("");
    setRecipientsChange("");
    setBodyChange("");
  }

  const isEmailRouting = sku?.rowKind === "email-routing";

  // Pricing / product default text (not used for email-routing)
  const defaultRequest = useMemo(() => {
    if (!sku || isEmailRouting) return "";
    const isProduct = sku.rowKind === "product";
    const priceLine = sku.priceDisplayOverride?.trim()
      ? `Current price: ${sku.priceDisplayOverride.trim()}`
      : `Current price: ${formatPrice(sku.price)}`;
    const noteLine = sku.note?.trim() ? `Note on file: ${sku.note.trim()}` : "";
    const planLine = sku.planCategory?.trim()
      ? `Treatment type in plans: ${sku.planCategory.trim()}`
      : "";
    const descLine =
      isProduct && sku.descriptionSnippet?.trim()
        ? `Description on file: ${sku.descriptionSnippet.trim()}`
        : "";
    const urlLine =
      isProduct && sku.productUrl?.trim()
        ? `Shop / product link: ${sku.productUrl.trim()}`
        : "";
    if (isProduct) {
      return [
        `Catalog: ${sku.category}`,
        `Product: ${sku.name}`,
        priceLine,
        descLine,
        urlLine,
        "",
        "Requested change:",
      ]
        .filter(Boolean)
        .join("\n");
    }
    return [
      `Section: ${sku.category}`,
      planLine,
      `Service: ${sku.name}`,
      priceLine,
      noteLine,
      "",
      "Requested change:",
    ]
      .filter(Boolean)
      .join("\n");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sku]);

  const defaultRequestFallback = useMemo(() => {
    if (sku) return "";
    return [
      "Describe what you need changed—new services, new prices, or different names shown to patients.",
      "If you can, list each service with the price today and the price or wording you want.",
      "",
      "Requested change:",
    ].join("\n");
  }, [sku]);

  useEffect(() => {
    if (!isEmailRouting) {
      setRequest(defaultRequest || defaultRequestFallback);
    }
  }, [defaultRequest, defaultRequestFallback, isEmailRouting]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  function buildEmailMessage(): string {
    const lines: string[] = [
      `Notification: ${sku!.name}`,
      sku!.emailTrigger?.trim() ? `Trigger: ${sku!.emailTrigger.trim()}` : "",
    ].filter(Boolean);

    const subjectChanged = subjectChange.trim() !== (sku!.emailSubject?.trim() ?? "");
    const recipientsChanged = recipientsChange.trim() !== (sku!.emailRecipients?.trim() ?? "");
    const bodyChanged = bodyChange.trim() !== (sku!.emailBody?.trim() ?? "");

    if (subjectChanged) {
      lines.push(
        "",
        "Subject:",
        `  Current: ${sku!.emailSubject ?? "—"}`,
        `  Requested: ${subjectChange.trim()}`,
      );
    }
    if (recipientsChanged) {
      lines.push(
        "",
        "Recipients:",
        `  Current: ${sku!.emailRecipients ?? "—"}`,
        `  Requested: ${recipientsChange.trim()}`,
      );
    }
    if (bodyChanged) {
      lines.push(
        "",
        "Template:",
        `  Current: ${sku!.emailBody?.trim() ?? "—"}`,
        `  Requested: ${bodyChange.trim()}`,
      );
    }
    if (emailNotes.trim()) {
      lines.push("", `Notes: ${emailNotes.trim()}`);
    }
    return lines.join("\n");
  }

  const emailHasActualChange = editMode && (
    subjectChange.trim() !== (sku?.emailSubject?.trim() ?? "") ||
    recipientsChange.trim() !== (sku?.emailRecipients?.trim() ?? "") ||
    bodyChange.trim() !== (sku?.emailBody?.trim() ?? "") ||
    emailNotes.trim() !== ""
  );

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

    if (isEmailRouting) {
      if (!editMode) {
        showError("Click Change to edit a field before sending.");
        return;
      }
      if (!emailHasActualChange) {
        showError("No changes detected — edit at least one field before sending.");
        return;
      }
    } else {
      if (!request.trim()) {
        showError("Please describe what you would like changed.");
        return;
      }
    }

    setLoading(true);
    try {
      const tag = isEmailRouting ? "[EMAIL NOTIFICATION CHANGE REQUEST]" : "[PRICING CHANGE REQUEST]";
      const body = isEmailRouting ? buildEmailMessage() : request.trim();
      const taggedMessage = `${tag}\n${body}`;
      await submitHelpRequest(
        name.trim(),
        email.trim(),
        appendTeamNotificationEmailsToHelpMessage(taggedMessage, provider.id, provider),
        provider.id,
      );
      showToast("Request sent to the team.");
      onClose();
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Failed to send request.");
    } finally {
      setLoading(false);
    }
  };

  const title = sku
    ? sku.rowKind === "product"
      ? "Request product or price change"
      : sku.rowKind === "email-routing"
        ? "Request email notification change"
        : "Request pricing change"
    : "Request pricing update";
  const subtitle = sku
    ? sku.rowKind === "product"
      ? "Product names, images, and prices in the dashboard come from our catalog. Send this form and we will update them for you."
      : sku.rowKind === "email-routing"
        ? "Email routing and content are managed by our team. Describe what you need updated and we will make the change."
        : "You can browse prices here; only our team can edit the list. Send this form and we will update it for you."
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
          <div className="modal-body">
          <div className="sms-config-request-body">

            {/* Sender info */}
            <div className="creq-sender-row">
              <div className="form-group">
                <label htmlFor="pricing-req-name">Your name</label>
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
            </div>

            {isEmailRouting ? (
              <>
                <div className="creq-fields-group">
                  <div className="creq-group-header">
                    <span>{editMode ? "Editing" : "Current content"}</span>
                    {editMode ? (
                      <div className="creq-group-header-actions">
                        <button type="button" className="creq-field-cancel-btn" onClick={cancelEdit}>
                          Cancel
                        </button>
                        <button type="button" className="creq-field-change-btn" onClick={() => setEditMode(false)}>
                          Save
                        </button>
                      </div>
                    ) : (
                      <button type="button" className="creq-field-change-btn" onClick={startEdit}>
                        Change
                      </button>
                    )}
                  </div>

                  {/* Recipients — comes first, matching standard email header order */}
                  {sku!.emailRecipients && (
                    <div className="creq-field creq-field--preview">
                      <div className="creq-field-header">To</div>
                      {editMode ? (
                        <textarea
                          className="creq-inline-textarea"
                          id="email-req-recipients"
                          rows={1}
                          value={recipientsChange}
                          onChange={(e) => setRecipientsChange(e.target.value)}
                        />
                      ) : (
                        <div className="creq-field-preview">{renderTemplateVars(recipientsChange || sku!.emailRecipients)}</div>
                      )}
                    </div>
                  )}

                  {/* Subject */}
                  {sku!.emailSubject && (
                    <div className="creq-field creq-field--preview">
                      <div className="creq-field-header">Subject</div>
                      {editMode ? (
                        <textarea
                          className="creq-inline-textarea"
                          id="email-req-subject"
                          rows={1}
                          value={subjectChange}
                          onChange={(e) => setSubjectChange(e.target.value)}
                        />
                      ) : (
                        <div className="creq-field-preview">{renderTemplateVars(subjectChange || sku!.emailSubject)}</div>
                      )}
                    </div>
                  )}

                  {/* Body */}
                  {sku!.emailBody && (
                    <div className="creq-field creq-field--preview creq-field--multiline-preview">
                      <div className="creq-field-header">Body</div>
                      {editMode ? (
                        <textarea
                          className="creq-inline-textarea creq-inline-textarea--body"
                          id="email-req-body"
                          value={bodyChange}
                          onChange={(e) => {
                            setBodyChange(e.target.value);
                            e.target.style.height = "auto";
                            e.target.style.height = e.target.scrollHeight + "px";
                          }}
                          ref={(el) => {
                            if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
                          }}
                        />
                      ) : (
                        <div className="creq-field-preview creq-field-preview--multiline">{renderTemplateVars(bodyChange || sku!.emailBody)}</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="form-group">
                  <label htmlFor="email-req-notes">Additional notes</label>
                  <textarea
                    id="email-req-notes"
                    rows={3}
                    value={emailNotes}
                    onChange={(e) => setEmailNotes(e.target.value)}
                    placeholder="Anything else the team should know…"
                  />
                </div>
              </>
            ) : (
              <div className="form-group">
                <label htmlFor="pricing-req-message">Your request</label>
                <textarea
                  id="pricing-req-message"
                  rows={8}
                  value={request}
                  onChange={(e) => setRequest(e.target.value)}
                  required
                />
              </div>
            )}

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
