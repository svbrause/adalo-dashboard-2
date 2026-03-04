// Add Client Modal Component

import { useState, FormEvent, useEffect } from "react";
import { createLeadRecord } from "../../services/api";
import {
  isValidEmail,
  isValidPhone,
  isValidZipCode,
  formatPhoneInput,
  formatZipCodeInput,
} from "../../utils/validation";
import { showToast, showError } from "../../utils/toast";
import "./AddClientModal.css";

interface AddClientModalProps {
  onClose: () => void;
  onSuccess: () => void;
  providerId: string;
}

export default function AddClientModal({
  onClose,
  onSuccess,
  providerId,
}: AddClientModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    zipCode: "",
    source: "Walk-in",
    notes: "",
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

    // Validation
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

    if (formData.phone && !isValidPhone(formData.phone)) {
      setErrors({ phone: "Please enter a valid phone number" });
      return;
    }

    if (formData.zipCode && !isValidZipCode(formData.zipCode)) {
      setErrors({ zipCode: "Please enter a valid 5-digit zip code" });
      return;
    }

    setLoading(true);

    try {
      const fields: Record<string, unknown> = {
        Name: formData.name.trim(),
        "Email Address": formData.email.trim(),
        "Phone Number": formData.phone ? formData.phone.replace(/\D/g, "") : "",
        "Zip Code": formData.zipCode || null,
        Source: formData.source,
        Notes: formData.notes.trim() || "",
        Status: "New",
        Contacted: false,
        // Link to provider if providerId is available
        ...(providerId ? { Providers: [providerId] } : {}),
      };
      if (formData.dateOfBirth.trim()) {
        fields["Date of Birth"] = formData.dateOfBirth.trim();
      }

      await createLeadRecord("Web Popup Leads", fields);
      showToast(`Added ${formData.name} as a new lead!`);
      onSuccess();
      onClose();
    } catch (error: any) {
      showError(error.message || "Failed to add client. Please try again.");
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
            <h2 className="modal-title">Add New Lead</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="new-lead-name">Full Name *</label>
              <input
                type="text"
                id="new-lead-name"
                required
                placeholder="Enter full name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
              {errors.name && (
                <span className="field-error">{errors.name}</span>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="new-lead-email">Email Address *</label>
                <input
                  type="email"
                  id="new-lead-email"
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
                <label htmlFor="new-lead-phone">Phone Number</label>
                <input
                  type="tel"
                  id="new-lead-phone"
                  placeholder="(555) 123-4567"
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
                />
                {errors.phone && (
                  <span className="field-error">{errors.phone}</span>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="new-lead-dob">Date of Birth</label>
                <input
                  type="date"
                  id="new-lead-dob"
                  placeholder="YYYY-MM-DD"
                  value={formData.dateOfBirth}
                  onChange={(e) =>
                    setFormData({ ...formData, dateOfBirth: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label htmlFor="new-lead-zipcode">Zip Code (optional)</label>
                <input
                  type="text"
                  id="new-lead-zipcode"
                  placeholder="12345"
                  maxLength={5}
                  value={formData.zipCode}
                  onInput={(e) => {
                    formatZipCodeInput(e.target as HTMLInputElement);
                    setFormData({
                      ...formData,
                      zipCode: (e.target as HTMLInputElement).value,
                    });
                  }}
                  onChange={(e) => {
                    setFormData({ ...formData, zipCode: e.target.value });
                  }}
                />
                {errors.zipCode && (
                  <span className="field-error">{errors.zipCode}</span>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="new-lead-source">Source</label>
                <select
                  id="new-lead-source"
                  value={formData.source}
                  onChange={(e) =>
                    setFormData({ ...formData, source: e.target.value })
                  }
                >
                  <option value="Walk-in">Walk-in</option>
                  <option value="Phone Call">Phone Call</option>
                  <option value="Referral">Referral</option>
                  <option value="Social Media">Social Media</option>
                  <option value="Website">Website</option>
                  <option value="AI Consult">AI Consult Tool</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="new-lead-notes">Notes</label>
              <textarea
                id="new-lead-notes"
                rows={3}
                placeholder="Any additional details about this client..."
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
              />
            </div>
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
                    Adding...
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
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Add Client
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
