// Share Analysis Modal Component

import { useState, useEffect } from "react";
import { Client } from "../../types";
import { useDashboard } from "../../context/DashboardContext";
import { sendSMSNotification } from "../../services/api";
import { formatProviderDisplayName } from "../../utils/providerHelpers";
import {
  isValidPhone,
  formatPhoneInput,
  cleanPhoneNumber,
} from "../../utils/validation";
import { showToast, showError } from "../../utils/toast";
import "./ShareAnalysisModal.css";

interface ShareAnalysisModalProps {
  client: Client;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ShareAnalysisModal({
  client,
  onClose,
  onSuccess,
}: ShareAnalysisModalProps) {
  const { provider } = useDashboard();
  const defaultMessage =
    `${formatProviderDisplayName(provider?.name) || "We"}: Your facial analysis results are ready! Access your personalized analysis and self-review at patients.ponce.ai. Log in with your email address to view your results.`;
  const [formData, setFormData] = useState({
    name: client.name || "",
    phone: client.phone || "",
    message: defaultMessage,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  // When provider loads/changes, set default message if still empty
  useEffect(() => {
    const providerName = formatProviderDisplayName(provider?.name) || "We";
    const nextDefault = `${providerName}: Your facial analysis results are ready! Access your personalized analysis and self-review at patients.ponce.ai. Log in with your email address to view your results.`;
    setFormData((prev) =>
      prev.message.trim() === "" ? { ...prev, message: nextDefault } : prev
    );
  }, [provider]);

  const handleSend = async () => {
    setErrors({});

    if (!formData.name.trim()) {
      setErrors({ name: "Name is required" });
      return;
    }

    if (!formData.phone.trim()) {
      setErrors({ phone: "Phone number is required" });
      return;
    }

    if (!isValidPhone(formData.phone)) {
      setErrors({ phone: "Please enter a valid phone number" });
      return;
    }

    if (!formData.message.trim()) {
      setErrors({ message: "Message is required" });
      return;
    }

    setSending(true);
    try {
      const finalMessage = formData.message;
      const cleanedPhone = cleanPhoneNumber(formData.phone);

      await sendSMSNotification(
        cleanedPhone,
        finalMessage,
        formData.name.trim() || undefined,
      );

      showToast(`SMS notification sent to ${formData.name}`);
      onSuccess();
      onClose();
    } catch (error: any) {
      showError(error.message || "Failed to send SMS");
    } finally {
      setSending(false);
    }
  };

  const characterCount = formData.message.length;

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div
        className="modal-content add-lead-modal-content modal-content-narrow share-analysis-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-info">
            <h2 className="modal-title">Share Analysis with Patient</h2>
            <p className="modal-subtitle">
              Lets patient access their analysis results and self-review via
              their mobile device
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="form-container">
            <div className="form-group">
              <label htmlFor="share-analysis-name" className="form-label">
                Patient Name *
              </label>
              <input
                type="text"
                id="share-analysis-name"
                required
                placeholder="Enter patient's name..."
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="form-input-base"
              />
              {errors.name && (
                <span className="field-error">{errors.name}</span>
              )}
            </div>

            <div className="form-group form-group-spacing">
              <label htmlFor="share-analysis-phone" className="form-label">
                Phone Number *
              </label>
              <input
                type="tel"
                id="share-analysis-phone"
                required
                placeholder="(555) 555-5555"
                value={formData.phone}
                onInput={(e) => {
                  formatPhoneInput(e.target as HTMLInputElement);
                  setFormData({
                    ...formData,
                    phone: (e.target as HTMLInputElement).value,
                  });
                }}
                onChange={(e) => {
                  setFormData({ ...formData, phone: e.target.value });
                }}
                className="form-input-base"
              />
              {errors.phone && (
                <span className="field-error">{errors.phone}</span>
              )}
            </div>

            <div className="form-group form-group-spacing share-analysis-checkbox-row">
              <label className="share-analysis-checkbox-label">
                <input
                  type="checkbox"
                  checked
                  disabled
                  readOnly
                  aria-label="Include link for patient to access"
                  className="share-analysis-include-link-checkbox"
                />
                <span className="share-analysis-checkbox-text">
                  Include link for patient to access
                </span>
              </label>
            </div>

            <div className="form-group form-group-spacing-lg">
              <label htmlFor="share-analysis-message" className="form-label">
                Message *
              </label>
              <textarea
                id="share-analysis-message"
                rows={6}
                required
                placeholder="Enter your message..."
                value={formData.message}
                onChange={(e) =>
                  setFormData({ ...formData, message: e.target.value })
                }
                className="form-textarea-base"
              />
              <div
                className={`character-count ${characterCount > 160 ? "character-count-error" : characterCount > 140 ? "character-count-warning" : "character-count-normal"}`}
              >
                {characterCount} characters
              </div>
              {errors.message && (
                <span className="field-error">{errors.message}</span>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <div className="modal-actions-left"></div>
          <div className="modal-actions-right">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSend}
              disabled={sending}
            >
              {sending ? (
                <>
                  <span className="spinner spinner-inline"></span>
                  Sending...
                </>
              ) : (
                <>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="modal-icon-spacing"
                  >
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                  Send SMS
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
