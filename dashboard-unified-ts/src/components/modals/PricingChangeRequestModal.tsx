import { FormEvent, useEffect, useState } from "react";
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
  /** email-routing: whether this notification is currently active in the catalog. */
  notificationIsActive?: boolean;
};

type PricingChangeRequestModalProps = {
  /** When set, the form is prefilled for this SKU; otherwise a general pricing request. */
  sku: PricingHelpSkuContext | null;
  /** Prefills “Notes to team” for email-routing (e.g. enable/disable request from notifications table). */
  initialEmailNotes?: string;
  onClose: () => void;
};

export default function PricingChangeRequestModal({
  sku,
  initialEmailNotes,
  onClose,
}: PricingChangeRequestModalProps) {
  const { provider } = useDashboard();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // ── General / fallback free-text ──────────────────────────────────────────
  const [request, setRequest] = useState(
    "Describe what you need changed—new services, new prices, or different names shown to patients.\n\nRequested change:"
  );

  // ── Email-routing fields ──────────────────────────────────────────────────
  const [subjectChange, setSubjectChange] = useState("");
  const [recipientsChange, setRecipientsChange] = useState("");
  const [bodyChange, setBodyChange] = useState("");
  const [emailNotes, setEmailNotes] = useState("");

  // ── Treatment pricing fields ──────────────────────────────────────────────
  const [sectionChange, setSectionChange] = useState("");
  const [serviceNameChange, setServiceNameChange] = useState("");
  const [priceChange, setPriceChange] = useState("");
  const [noteChange, setNoteChange] = useState("");
  const [treatmentNotes, setTreatmentNotes] = useState("");

  // ── Product fields ────────────────────────────────────────────────────────
  const [productPriceChange, setProductPriceChange] = useState("");
  const [productDescChange, setProductDescChange] = useState("");
  const [productUrlChange, setProductUrlChange] = useState("");
  const [productNotes, setProductNotes] = useState("");

  const isEmailRouting = sku?.rowKind === "email-routing";
  const isTreatmentPricing = sku?.rowKind === "treatment";
  const isProduct = sku?.rowKind === "product";

  // Sync email-routing fields
  useEffect(() => {
    if (!sku || !isEmailRouting) return;
    setSubjectChange(sku.emailSubject ?? "");
    setRecipientsChange(sku.emailRecipients ?? "");
    setBodyChange(sku.emailBody ?? "");
    setEditMode(false);
    setEmailNotes(initialEmailNotes ?? "");
  }, [sku?.rowKind, sku?.name, sku?.category, initialEmailNotes]);

  // Sync treatment pricing fields
  useEffect(() => {
    if (!sku || !isTreatmentPricing) return;
    const displayPrice = sku.priceDisplayOverride?.trim() || formatPrice(sku.price);
    setSectionChange(sku.category?.trim() ?? "");
    setServiceNameChange(sku.name?.trim() ?? "");
    setPriceChange(displayPrice);
    setNoteChange(sku.note?.trim() ?? "");
    setEditMode(false);
    setTreatmentNotes("");
  }, [sku?.rowKind, sku?.name, sku?.category]);

  // Sync product fields
  useEffect(() => {
    if (!sku || !isProduct) return;
    setProductPriceChange(sku.priceDisplayOverride?.trim() ?? "");
    setProductDescChange(sku.descriptionSnippet?.trim() ?? "");
    setProductUrlChange(sku.productUrl?.trim() ?? "");
    setEditMode(false);
    setProductNotes("");
  }, [sku?.rowKind, sku?.name, sku?.category]);

  // Esc to close
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  // ── Change-detection ──────────────────────────────────────────────────────

  const emailHasActualChange =
    subjectChange.trim() !== (sku?.emailSubject?.trim() ?? "") ||
    recipientsChange.trim() !== (sku?.emailRecipients?.trim() ?? "") ||
    bodyChange.trim() !== (sku?.emailBody?.trim() ?? "") ||
    emailNotes.trim() !== "";

  const origDisplayPrice = sku?.priceDisplayOverride?.trim() || formatPrice(sku?.price ?? 0);
  const treatmentHasActualChange =
    sectionChange.trim() !== (sku?.category?.trim() ?? "") ||
    serviceNameChange.trim() !== (sku?.name?.trim() ?? "") ||
    priceChange.trim() !== origDisplayPrice ||
    noteChange.trim() !== (sku?.note?.trim() ?? "") ||
    treatmentNotes.trim() !== "";

  const productHasActualChange =
    productPriceChange.trim() !== (sku?.priceDisplayOverride?.trim() ?? "") ||
    productDescChange.trim() !== (sku?.descriptionSnippet?.trim() ?? "") ||
    productUrlChange.trim() !== (sku?.productUrl?.trim() ?? "") ||
    productNotes.trim() !== "";

  // ── Message builders ──────────────────────────────────────────────────────

  function buildEmailMessage(): string {
    const lines: string[] = [
      `*Notification:* ${sku!.name}`,
      sku!.emailTrigger?.trim() ? `*Trigger:* ${sku!.emailTrigger.trim()}` : "",
      sku!.notificationIsActive !== undefined
        ? `*Status (catalog):* ${sku!.notificationIsActive ? "On" : "Off"}`
        : "",
    ].filter(Boolean);

    if (subjectChange.trim() !== (sku!.emailSubject?.trim() ?? "")) {
      lines.push("", "*Subject change:*",
        `• *Current:* ${sku!.emailSubject ?? "—"}`,
        `• *Requested:* ${subjectChange.trim()}`);
    }
    if (recipientsChange.trim() !== (sku!.emailRecipients?.trim() ?? "")) {
      lines.push("", "*Recipients change:*",
        `• *Current:* ${sku!.emailRecipients ?? "—"}`,
        `• *Requested:* ${recipientsChange.trim()}`);
    }
    if (bodyChange.trim() !== (sku!.emailBody?.trim() ?? "")) {
      lines.push("", "*Template change:*",
        `• *Current:* ${sku!.emailBody?.trim() ?? "—"}`,
        `• *Requested:* ${bodyChange.trim()}`);
    }
    if (emailNotes.trim()) {
      lines.push("", `*Notes:* ${emailNotes.trim()}`);
    }
    return lines.join("\n");
  }

  function buildTreatmentMessage(): string {
    const priceChanged = priceChange.trim() !== origDisplayPrice;
    const noteChanged = noteChange.trim() !== (sku!.note?.trim() ?? "");
    const nameChanged = serviceNameChange.trim() !== (sku!.name?.trim() ?? "");
    const sectionChanged = sectionChange.trim() !== (sku!.category?.trim() ?? "");
    const lines: string[] = [
      `*Service (current record):* ${sku!.name}`,
      `*Section (current record):* ${sku!.category}`,
      sku!.planCategory ? `*Treatment type:* ${sku!.planCategory}` : "",
    ].filter(Boolean);

    if (nameChanged) {
      lines.push("", "*Service name change:*",
        `• *Current:* ${sku!.name}`,
        `• *Requested:* ${serviceNameChange.trim()}`);
    }
    if (sectionChanged) {
      lines.push("", "*Section change:*",
        `• *Current:* ${sku!.category}`,
        `• *Requested:* ${sectionChange.trim()}`);
    }
    if (priceChanged) {
      lines.push("", "*Price change:*",
        `• *Current:* ${origDisplayPrice}`,
        `• *Requested:* ${priceChange.trim()}`);
    }
    if (noteChanged) {
      lines.push("", "*Price note change:*",
        `• *Current:* ${sku!.note?.trim() || "—"}`,
        `• *Requested:* ${noteChange.trim() || "—"}`);
    }
    if (treatmentNotes.trim()) {
      lines.push("", `*Notes to team:* ${treatmentNotes.trim()}`);
    }
    return lines.join("\n");
  }

  function buildProductMessage(): string {
    const origPrice = sku!.priceDisplayOverride?.trim() ?? "";
    const origDesc = sku!.descriptionSnippet?.trim() ?? "";
    const origUrl = sku!.productUrl?.trim() ?? "";
    const priceChanged = productPriceChange.trim() !== origPrice;
    const descChanged = productDescChange.trim() !== origDesc;
    const urlChanged = productUrlChange.trim() !== origUrl;

    const lines: string[] = [
      `*Product:* ${sku!.name}`,
      `*Brand / Catalog:* ${sku!.category}`,
      origPrice && origPrice !== "—" ? `*Current price:* ${origPrice}` : "",
    ].filter(Boolean);

    if (priceChanged) {
      lines.push("", "*Price change:*",
        `• *Current:* ${origPrice || "—"}`,
        `• *Requested:* ${productPriceChange.trim()}`);
    }
    if (descChanged) {
      lines.push("", "*Description change:*",
        `• *Current:* ${origDesc || "—"}`,
        `• *Requested:* ${productDescChange.trim() || "—"}`);
    }
    if (urlChanged) {
      lines.push("", "*URL change:*",
        `• *Current:* ${origUrl || "—"}`,
        `• *Requested:* ${productUrlChange.trim() || "—"}`);
    }
    if (productNotes.trim()) {
      lines.push("", `*Notes:* ${productNotes.trim()}`);
    }
    return lines.join("\n");
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!provider) { showError("Please refresh the page and try again."); return; }
    if (!name.trim()) { showError("Please add your name."); return; }
    if (!email.trim() || !isValidEmail(email)) { showError("Please add a valid email."); return; }

    if (isEmailRouting && !emailHasActualChange) {
      showError("No changes detected — edit at least one field before sending.");
      return;
    }
    if (isTreatmentPricing && !treatmentHasActualChange) {
      showError("No changes detected — edit a field or add a note before sending.");
      return;
    }
    if (isProduct && !productHasActualChange) {
      showError("No changes detected — edit a field or add a note before sending.");
      return;
    }
    if (!isEmailRouting && !isTreatmentPricing && !isProduct && !request.trim()) {
      showError("Please describe what you would like changed.");
      return;
    }

    const category = isEmailRouting
      ? "Email Notification Change Request"
      : isProduct
        ? "Skincare Product Change Request"
        : "Pricing Change Request";

    const messageBody = isEmailRouting
      ? buildEmailMessage()
      : isTreatmentPricing
        ? buildTreatmentMessage()
        : isProduct
          ? buildProductMessage()
          : request.trim();

    setLoading(true);
    try {
      await submitHelpRequest(
        name.trim(),
        email.trim(),
        appendTeamNotificationEmailsToHelpMessage(messageBody, provider.id, provider),
        provider.id,
        { category, providerName: provider.name ?? "" },
      );
      showToast("Request sent to the team.");
      onClose();
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Failed to send request.");
    } finally {
      setLoading(false);
    }
  };

  // ── Labels ────────────────────────────────────────────────────────────────

  const title = isEmailRouting
    ? "Request email notification change"
    : isTreatmentPricing
      ? "Request pricing change"
      : isProduct
        ? "Request product or price change"
        : "Request pricing update";

  const subtitle = isEmailRouting
    ? "Email routing and content are managed by our team. Describe what you need updated and we will make the change."
    : isTreatmentPricing
      ? "You can browse prices here; only our team can edit the list. Send this form and we will update it for you."
      : isProduct
        ? "Product names, images, and prices in the dashboard come from our catalog. Send this form and we will update them for you."
        : "Use this when several services need changes, or your update does not match a single row in the list.";

  // ── Helpers for auto-grow textareas ───────────────────────────────────────
  function autoGrow(el: HTMLTextAreaElement | null) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content sms-config-request-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-info">
            <h2 className="modal-title">{title}</h2>
            <p className="sms-config-request-subtitle">{subtitle}</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
          <div className="sms-config-request-body">

            {/* Sender info */}
            <div className="creq-sender-row">
              <div className="form-group">
                <label htmlFor="pricing-req-name">Your name</label>
                <input id="pricing-req-name" type="text" value={name}
                  onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" required />
              </div>
              <div className="form-group">
                <label htmlFor="pricing-req-email">Email</label>
                <input id="pricing-req-email" type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder="you@clinic.com" required />
              </div>
            </div>

            {/* ── EMAIL ROUTING ──────────────────────────────────────────── */}
            {isEmailRouting && (
              <>
                {sku!.notificationIsActive !== undefined && (
                  <div className="creq-context">
                    <div className="creq-context-row">
                      <span className="creq-context-label">Status</span>
                      <span className="creq-context-value">
                        {sku!.notificationIsActive ? "On" : "Off"}
                      </span>
                    </div>
                  </div>
                )}
                <div className="creq-fields-group">
                  <div className="creq-group-header">
                    <span>{editMode ? "Editing" : "Current content"}</span>
                    {editMode ? (
                      <div className="creq-group-header-actions">
                        <button type="button" className="creq-field-cancel-btn" onClick={() => {
                          setEditMode(false);
                          setSubjectChange(sku!.emailSubject ?? "");
                          setRecipientsChange(sku!.emailRecipients ?? "");
                          setBodyChange(sku!.emailBody ?? "");
                        }}>Cancel</button>
                        <button type="button" className="creq-field-change-btn" onClick={() => setEditMode(false)}>Save</button>
                      </div>
                    ) : (
                      <button type="button" className="creq-field-change-btn" onClick={() => setEditMode(true)}>Change</button>
                    )}
                  </div>

                  {sku!.emailRecipients && (
                    <div className="creq-field creq-field--preview">
                      <div className="creq-field-header">To</div>
                      {editMode ? (
                        <textarea className="creq-inline-textarea" rows={1} value={recipientsChange}
                          onChange={(e) => setRecipientsChange(e.target.value)} />
                      ) : (
                        <div className="creq-field-preview">{renderTemplateVars(recipientsChange || sku!.emailRecipients)}</div>
                      )}
                    </div>
                  )}

                  {sku!.emailSubject && (
                    <div className="creq-field creq-field--preview">
                      <div className="creq-field-header">Subject</div>
                      {editMode ? (
                        <textarea className="creq-inline-textarea" rows={1} value={subjectChange}
                          onChange={(e) => setSubjectChange(e.target.value)} />
                      ) : (
                        <div className="creq-field-preview">{renderTemplateVars(subjectChange || sku!.emailSubject)}</div>
                      )}
                    </div>
                  )}

                  {sku!.emailBody && (
                    <div className="creq-field creq-field--preview creq-field--multiline-preview">
                      <div className="creq-field-header">Body</div>
                      {editMode ? (
                      <textarea
                        className="creq-inline-textarea creq-inline-textarea--body"
                        value={bodyChange}
                        onChange={(e) => { setBodyChange(e.target.value); autoGrow(e.target); }}
                        ref={(el) => { if (el) autoGrow(el); }}
                      />
                      ) : (
                        <div className="creq-field-preview creq-field-preview--multiline">{renderTemplateVars(bodyChange || sku!.emailBody)}</div>
                      )}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="email-req-notes">Notes to team</label>
                  <textarea id="email-req-notes" rows={3} value={emailNotes}
                    onChange={(e) => setEmailNotes(e.target.value)}
                    placeholder="Anything else the team should know…" />
                </div>
              </>
            )}

            {/* ── TREATMENT PRICING ─────────────────────────────────────── */}
            {isTreatmentPricing && sku && (
              <>
                {sku.planCategory && (
                  <div className="creq-context">
                    <div className="creq-context-row">
                      <span className="creq-context-label">Type</span>
                      <span className="creq-context-value">{sku.planCategory}</span>
                    </div>
                  </div>
                )}

                {/* Editable: section, service name, price, price note */}
                <div className="creq-fields-group">
                  <div className="creq-group-header">
                    <span>{editMode ? "Editing" : "Current pricing"}</span>
                    {editMode ? (
                      <div className="creq-group-header-actions">
                        <button type="button" className="creq-field-cancel-btn" onClick={() => {
                          setEditMode(false);
                          setSectionChange(sku.category?.trim() ?? "");
                          setServiceNameChange(sku.name?.trim() ?? "");
                          setPriceChange(origDisplayPrice);
                          setNoteChange(sku.note?.trim() ?? "");
                        }}>Cancel</button>
                        <button type="button" className="creq-field-change-btn" onClick={() => setEditMode(false)}>Save</button>
                      </div>
                    ) : (
                      <button type="button" className="creq-field-change-btn" onClick={() => setEditMode(true)}>Change</button>
                    )}
                  </div>

                  {/* Section (price list category) */}
                  <div className="creq-field creq-field--preview">
                    <div className="creq-field-header">Section</div>
                    {editMode ? (
                      <input
                        className="creq-inline-input"
                        type="text"
                        value={sectionChange}
                        onChange={(e) => setSectionChange(e.target.value)}
                        placeholder="e.g. Injectables, Laser"
                      />
                    ) : (
                      <div className={`creq-field-preview${sectionChange.trim() !== (sku.category?.trim() ?? "") ? " creq-field-preview--changed" : ""}`}>
                        {sectionChange || <span className="creq-field-preview-empty">—</span>}
                      </div>
                    )}
                  </div>

                  {/* Service name */}
                  <div className="creq-field creq-field--preview">
                    <div className="creq-field-header">Service name</div>
                    {editMode ? (
                      <input
                        className="creq-inline-input"
                        type="text"
                        value={serviceNameChange}
                        onChange={(e) => setServiceNameChange(e.target.value)}
                        placeholder="Name shown in the price list"
                      />
                    ) : (
                      <div className={`creq-field-preview${serviceNameChange.trim() !== (sku.name?.trim() ?? "") ? " creq-field-preview--changed" : ""}`}>
                        {serviceNameChange || <span className="creq-field-preview-empty">—</span>}
                      </div>
                    )}
                  </div>

                  {/* Price */}
                  <div className="creq-field creq-field--preview">
                    <div className="creq-field-header">Price</div>
                    {editMode ? (
                      <input
                        className="creq-inline-input"
                        type="text"
                        value={priceChange}
                        onChange={(e) => setPriceChange(e.target.value)}
                        placeholder="e.g. $175 or $150–$200"
                      />
                    ) : (
                      <div className={`creq-field-preview${priceChange !== origDisplayPrice ? " creq-field-preview--changed" : ""}`}>
                        {priceChange}
                      </div>
                    )}
                  </div>

                  {/* Price note */}
                  <div className="creq-field creq-field--preview creq-field--multiline-preview">
                    <div className="creq-field-header">Price note</div>
                    {editMode ? (
                      <div className="creq-field-price-note-stack">
                        <p className="creq-field-hint" id="pricing-req-price-note-hint">
                          Short text shown next to the price. Example:{" "}
                          <span className="creq-field-hint-example">CA locations only</span>
                        </p>
                        <textarea
                          className="creq-inline-textarea creq-inline-textarea--body"
                          value={noteChange}
                          rows={2}
                          onChange={(e) => { setNoteChange(e.target.value); autoGrow(e.target); }}
                          ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
                          placeholder='Optional — e.g. "CA locations only" or per area'
                          aria-describedby="pricing-req-price-note-hint"
                        />
                      </div>
                    ) : (
                      <div
                        className={`creq-field-preview creq-field-preview--multiline${noteChange !== (sku.note?.trim() ?? "") ? " creq-field-preview--changed" : ""}`}
                      >
                        {noteChange || <span className="creq-field-preview-empty">No note on file</span>}
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="treatment-req-notes">Notes to team</label>
                  <textarea id="treatment-req-notes" rows={3} value={treatmentNotes}
                    onChange={(e) => setTreatmentNotes(e.target.value)}
                    placeholder="Anything else the team should know — effective date, related services to update, etc." />
                </div>
              </>
            )}

            {/* ── PRODUCT ───────────────────────────────────────────────── */}
            {isProduct && sku && (
              <>
                {/* Read-only context */}
                <div className="creq-context">
                  <div className="creq-context-row">
                    <span className="creq-context-label">Brand</span>
                    <span className="creq-context-value">{sku.category}</span>
                  </div>
                  <div className="creq-context-row">
                    <span className="creq-context-label">Product</span>
                    <span className="creq-context-value">{sku.name}</span>
                  </div>
                  {sku.productUrl && (
                    <div className="creq-context-row">
                      <span className="creq-context-label">Shop link</span>
                      <a className="creq-context-link" href={sku.productUrl} target="_blank" rel="noopener noreferrer">
                        View on shop ↗
                      </a>
                    </div>
                  )}
                </div>

                {/* Editable fields */}
                <div className="creq-fields-group">
                  <div className="creq-group-header">
                    <span>{editMode ? "Editing" : "Current details"}</span>
                    {editMode ? (
                      <div className="creq-group-header-actions">
                        <button type="button" className="creq-field-cancel-btn" onClick={() => {
                          setEditMode(false);
                          setProductPriceChange(sku.priceDisplayOverride?.trim() ?? "");
                          setProductDescChange(sku.descriptionSnippet?.trim() ?? "");
                          setProductUrlChange(sku.productUrl?.trim() ?? "");
                        }}>Cancel</button>
                        <button type="button" className="creq-field-change-btn" onClick={() => setEditMode(false)}>Save</button>
                      </div>
                    ) : (
                      <button type="button" className="creq-field-change-btn" onClick={() => setEditMode(true)}>Change</button>
                    )}
                  </div>

                  {/* Price */}
                  <div className="creq-field creq-field--preview">
                    <div className="creq-field-header">Price</div>
                    {editMode ? (
                      <input
                        className="creq-inline-input"
                        type="text"
                        value={productPriceChange}
                        onChange={(e) => setProductPriceChange(e.target.value)}
                        placeholder="e.g. $182"
                      />
                    ) : (
                      <div className={`creq-field-preview${productPriceChange !== (sku.priceDisplayOverride?.trim() ?? "") ? " creq-field-preview--changed" : ""}`}>
                        {productPriceChange || <span className="creq-field-preview-empty">Not listed</span>}
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <div className="creq-field creq-field--preview creq-field--multiline-preview">
                    <div className="creq-field-header">Description</div>
                    {editMode ? (
                      <textarea
                        className="creq-inline-textarea creq-inline-textarea--body"
                        value={productDescChange}
                        rows={3}
                        onChange={(e) => { setProductDescChange(e.target.value); autoGrow(e.target); }}
                        ref={(el) => { if (el) autoGrow(el); }}
                        placeholder="Short description shown to staff in the catalog"
                      />
                    ) : (
                      <div className={`creq-field-preview creq-field-preview--multiline${productDescChange !== (sku.descriptionSnippet?.trim() ?? "") ? " creq-field-preview--changed" : ""}`}>
                        {productDescChange || <span className="creq-field-preview-empty">No description on file</span>}
                      </div>
                    )}
                  </div>

                  {/* URL */}
                  <div className="creq-field creq-field--preview">
                    <div className="creq-field-header">Shop URL</div>
                    {editMode ? (
                      <input
                        className="creq-inline-input"
                        type="url"
                        value={productUrlChange}
                        onChange={(e) => setProductUrlChange(e.target.value)}
                        placeholder="https://…"
                      />
                    ) : (
                      <div className={`creq-field-preview${productUrlChange !== (sku.productUrl?.trim() ?? "") ? " creq-field-preview--changed" : ""}`}>
                        {productUrlChange
                          ? <a className="creq-context-link" href={productUrlChange} target="_blank" rel="noopener noreferrer">{productUrlChange}</a>
                          : <span className="creq-field-preview-empty">No URL on file</span>}
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="product-req-notes">Notes to team</label>
                  <textarea id="product-req-notes" rows={3} value={productNotes}
                    onChange={(e) => setProductNotes(e.target.value)}
                    placeholder="Anything else the team should know — new product to add, image to update, etc." />
                </div>
              </>
            )}

            {/* ── GENERAL FREE-TEXT (sku === null) ──────────────────────── */}
            {!isEmailRouting && !isTreatmentPricing && !isProduct && (
              <div className="form-group">
                <label htmlFor="pricing-req-message">Your request</label>
                <textarea id="pricing-req-message" rows={8} value={request}
                  onChange={(e) => setRequest(e.target.value)} required />
              </div>
            )}

          </div>
          </div>
          <div className="modal-footer">
            <div className="modal-actions-left" />
            <div className="modal-actions-right">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
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
