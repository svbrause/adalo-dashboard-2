// Help Request Modal Component

import { useState, FormEvent, useEffect } from "react";
import { useDashboard } from "../../context/DashboardContext";
import { submitHelpRequest } from "../../services/api";
import { formatProviderDisplayName } from "../../utils/providerHelpers";
import { isValidEmail } from "../../utils/validation";
import { showToast, showError } from "../../utils/toast";
import "./HelpRequestModal.css";

interface HelpRequestModalProps {
  onClose: () => void;
}

export default function HelpRequestModal({ onClose }: HelpRequestModalProps) {
  const { provider } = useDashboard();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!formData.name.trim()) {
      setErrors({ name: "Name is required" });
      return;
    }

    if (!formData.email.trim()) {
      setErrors({ email: "Email is required" });
      return;
    }

    if (!isValidEmail(formData.email)) {
      setErrors({ email: "Please enter a valid email address" });
      return;
    }

    if (!formData.message.trim()) {
      setErrors({ message: "Message is required" });
      return;
    }

    if (!provider) {
      showError("Provider information not available");
      return;
    }

    setLoading(true);

    try {
      await submitHelpRequest(
        formData.name,
        formData.email,
        formData.message,
        provider.id,
      );
      showToast(
        "Help request submitted successfully! We'll get back to you soon.",
      );
      onClose();
      setFormData({ name: "", email: "", message: "" });
    } catch (error: any) {
      showError(error.message || "Failed to submit help request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div
        className="modal-content add-lead-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-info">
            <h2 className="modal-title">Request Help</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="help-request-name">Your Name *</label>
              <input
                type="text"
                id="help-request-name"
                required
                placeholder="Enter your name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
              {errors.name && (
                <span className="field-error">{errors.name}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="help-request-email">Email Address *</label>
              <input
                type="email"
                id="help-request-email"
                required
                placeholder="email@example.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
              {errors.email && (
                <span className="field-error">{errors.email}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="help-request-message">Message *</label>
              <textarea
                id="help-request-message"
                rows={5}
                required
                placeholder="Describe how we can help you..."
                value={formData.message}
                onChange={(e) =>
                  setFormData({ ...formData, message: e.target.value })
                }
              />
              {errors.message && (
                <span className="field-error">{errors.message}</span>
              )}
            </div>

            {provider && (
              <div className="form-group form-info-box">
                <label className="form-info-label">
                  Provider Information (pre-filled)
                </label>
                <div className="form-info-value">
                  {formatProviderDisplayName(provider.name) || "-"}
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <div className="modal-actions-left"></div>
            <div className="modal-actions-right">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? (
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
                    Send Request
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
