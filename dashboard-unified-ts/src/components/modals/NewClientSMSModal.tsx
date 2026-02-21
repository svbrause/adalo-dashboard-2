// New Client SMS Modal Component (for Scan at Home)

import { useState, useEffect } from "react";
import { useDashboard } from "../../context/DashboardContext";
import { sendSMSNotification } from "../../services/api";
import {
  getTelehealthScanLink,
  formatProviderDisplayName,
} from "../../utils/providerHelpers";
import {
  isValidPhone,
  formatPhoneInput,
  splitName,
  cleanPhoneNumber,
} from "../../utils/validation";
import { showToast, showError } from "../../utils/toast";
import "./NewClientSMSModal.css";

interface NewClientSMSModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function NewClientSMSModal({
  onClose,
  onSuccess,
}: NewClientSMSModalProps) {
  const { provider } = useDashboard();
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    message: "",
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

  useEffect(() => {
    // Set default message
    const providerName = formatProviderDisplayName(provider?.name) || "We";
    const defaultMessage = `${providerName}: We are now utilizing a new patient tool to help track treatment progress and develop customized plans. Please complete the 5-min at-home AI facial scan prior to your next appointment and earn $50 off any new treatments you discover:`;
    setFormData((prev) => ({ ...prev, message: defaultMessage }));
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
      // Build prefill URL
      const providerName = formatProviderDisplayName(provider?.name) || "We";
      const { first, last } = splitName(formData.name);
      const phoneNumber = cleanPhoneNumber(formData.phone);

      const params: string[] = [];
      params.push(`provider=${encodeURIComponent(providerName)}`);
      if (first) params.push(`name[first]=${encodeURIComponent(first)}`);
      if (last) params.push(`name[last]=${encodeURIComponent(last)}`);
      if (phoneNumber)
        params.push(`phoneNumber=${encodeURIComponent(phoneNumber)}`);
      params.push(
        `source=${encodeURIComponent("Provider Dashboard - SMS Link")}`,
      );

      const link = getTelehealthScanLink(provider);
      const prefillLink = `${link}?${params.join("&")}`;
      const finalMessage = `${formData.message} ${prefillLink}`;

      const cleanedPhone = formData.phone.replace(/\D/g, "");
      await sendSMSNotification(
        cleanedPhone,
        finalMessage,
        formData.name.trim() || undefined,
      );

      showToast(`SMS notification sent to ${formData.name}`);
      onSuccess();
      onClose();
      setFormData({ name: "", phone: "", message: "" });
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
        className="modal-content add-lead-modal-content modal-content-narrow"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-info">
            <h2 className="modal-title">Scan Client at Home</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="form-container">
            <div className="form-group">
              <label htmlFor="new-client-sms-name" className="form-label">
                Client Name *
              </label>
              <input
                type="text"
                id="new-client-sms-name"
                required
                placeholder="Enter client's name..."
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
              <label htmlFor="new-client-sms-phone" className="form-label">
                Phone Number *
              </label>
              <input
                type="tel"
                id="new-client-sms-phone"
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

            <div className="form-group form-group-spacing-lg">
              <label htmlFor="new-client-sms-message" className="form-label">
                Message *
              </label>
              <textarea
                id="new-client-sms-message"
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
