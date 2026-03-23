import { FormEvent, useEffect, useMemo, useState } from "react";
import { useDashboard } from "../../context/DashboardContext";
import { submitHelpRequest } from "../../services/api";
import { showError, showToast } from "../../utils/toast";
import { isValidEmail } from "../../utils/validation";
import type { SmsProductConfig, SmsTemplateEventConfig } from "../../config/smsSettingsCatalog";
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
  const [request, setRequest] = useState("");
  const [loading, setLoading] = useState(false);

  const defaultRequest = useMemo(
    () =>
      [
        `Product: ${product.productName}`,
        `Event: ${eventConfig.eventName}`,
        `Current status: ${eventConfig.enabled ? "ON" : "OFF"}`,
        `Trigger: ${eventConfig.trigger}`,
        "",
        "Requested update:",
      ].join("\n"),
    [eventConfig.enabled, eventConfig.eventName, eventConfig.trigger, product.productName],
  );

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
      showError("Provider context is missing.");
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
      showError("Please describe the requested change.");
      return;
    }

    setLoading(true);
    try {
      const taggedMessage = `[SMS CONFIG CHANGE REQUEST]\n${request.trim()}`;
      await submitHelpRequest(name.trim(), email.trim(), taggedMessage, provider.id);
      showToast("Request sent to the team.");
      onClose();
    } catch (err: any) {
      showError(err?.message || "Failed to send request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content sms-config-request-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-info">
            <h2 className="modal-title">Request SMS Configuration Change</h2>
            <p className="sms-config-request-subtitle">
              This page is read-only for now. Submit a request and our team will update it.
            </p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body sms-config-request-body">
            <div className="form-group">
              <label htmlFor="sms-req-name">Your Name</label>
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
            <div className="form-group">
              <label htmlFor="sms-req-message">Requested change</label>
              <textarea
                id="sms-req-message"
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

