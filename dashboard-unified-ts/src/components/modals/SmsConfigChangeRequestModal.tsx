import { FormEvent, useEffect, useState } from "react";
import { useDashboard } from "../../context/DashboardContext";
import { submitHelpRequest } from "../../services/api";
import { showError, showToast } from "../../utils/toast";
import { appendTeamNotificationEmailsToHelpMessage } from "../../utils/providerNotificationEmails";
import { isValidEmail } from "../../utils/validation";
import type { SmsProductConfig, SmsTemplateEventConfig } from "../../config/smsSettingsCatalog";
import { renderTemplateVars } from "../../utils/renderTemplateVars";
import "./SmsConfigChangeRequestModal.css";

interface SmsConfigChangeRequestModalProps {
  product: SmsProductConfig;
  eventConfig: SmsTemplateEventConfig;
  onClose: () => void;
}

export default function SmsConfigChangeRequestModal({
  product,
  eventConfig,
  onClose,
}: SmsConfigChangeRequestModalProps) {
  const { provider } = useDashboard();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [templateChange, setTemplateChange] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setTemplateChange(eventConfig.template);
    setEditMode(false);
    setNotes("");
  }, [product.id, eventConfig.id, eventConfig.template]);

  function startEdit() {
    setEditMode(true);
  }

  const templateChanged = templateChange.trim() !== eventConfig.template.trim();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  function buildMessage(): string {
    const lines: string[] = [
      `*Workflow:* ${product.productName}`,
      `*Event:* ${eventConfig.eventName}`,
      `*Trigger:* ${eventConfig.trigger}`,
      `*Status:* ${eventConfig.enabled ? "On" : "Off"}`,
    ];
    if (templateChanged) {
      lines.push(
        "",
        "*Template change:*",
        `• *Current:* ${eventConfig.template}`,
        `• *Requested:* ${templateChange.trim()}`,
      );
    }
    if (notes.trim()) {
      lines.push("", `*Notes:* ${notes.trim()}`);
    }
    return lines.join("\n");
  }

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
    if (!templateChanged && !notes.trim()) {
      showError("No changes detected — edit the template or add a note before sending.");
      return;
    }

    setLoading(true);
    try {
      await submitHelpRequest(
        name.trim(),
        email.trim(),
        appendTeamNotificationEmailsToHelpMessage(buildMessage(), provider.id, provider),
        provider.id,
        {
          category: "SMS Notification Template Change Request",
          providerName: provider.name ?? "",
        },
      );
      showToast("Request sent to the team.");
      onClose();
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Failed to send request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content sms-config-request-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-info">
            <h2 className="modal-title">Request a text message change</h2>
            <p className="sms-config-request-subtitle">
              Tell us what you would like different. Our team will make the update for you.
            </p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
          <div className="sms-config-request-body">

            {/* Sender info */}
            <div className="creq-sender-row">
              <div className="form-group">
                <label htmlFor="sms-req-name">Your name</label>
                <input
                  id="sms-req-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Smith"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="sms-req-email">Email</label>
                <input
                  id="sms-req-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@clinic.com"
                  required
                />
              </div>
            </div>

            {/* Read-only context */}
            <div className="creq-context">
              <div className="creq-context-row">
                <span className="creq-context-label">Workflow</span>
                <span className="creq-context-value">{product.productName}</span>
              </div>
              <div className="creq-context-row">
                <span className="creq-context-label">Event</span>
                <span className="creq-context-value">{eventConfig.eventName}</span>
              </div>
              <div className="creq-context-row">
                <span className="creq-context-label">Trigger</span>
                <span className="creq-context-value">{eventConfig.trigger}</span>
              </div>
              <div className="creq-context-row">
                <span className="creq-context-label">Status</span>
                <span className="creq-context-value">{eventConfig.enabled ? "On" : "Off"}</span>
              </div>
            </div>

            {/* Template field */}
            <div className="creq-fields-group">
              <div className="creq-group-header">
                <span>{editMode ? "Editing" : "Current template"}</span>
                {editMode ? (
                  <div className="creq-group-header-actions">
                    <button
                      type="button"
                      className="creq-field-cancel-btn"
                      onClick={() => {
                        setEditMode(false);
                        setTemplateChange(eventConfig.template);
                      }}
                    >
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
              <div className="creq-field creq-field--preview creq-field--multiline-preview">
                <div className="creq-field-header">Template</div>
                {editMode ? (
                  <textarea
                    className="creq-inline-textarea creq-inline-textarea--body"
                    id="sms-req-template"
                    value={templateChange}
                    onChange={(e) => {
                      setTemplateChange(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = e.target.scrollHeight + "px";
                    }}
                    ref={(el) => {
                      if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
                    }}
                  />
                ) : (
                  <div className="creq-field-preview creq-field-preview--multiline">{renderTemplateVars(templateChange || eventConfig.template)}</div>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="form-group">
              <label htmlFor="sms-req-notes">Additional notes</label>
              <textarea
                id="sms-req-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything else the team should know — timing, tone, other messages to update…"
              />
            </div>

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
