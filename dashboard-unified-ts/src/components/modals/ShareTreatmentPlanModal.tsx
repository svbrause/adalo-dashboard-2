// Share Treatment Plan Modal – share the treatment plan with patient via SMS

import { useState, useEffect, useMemo } from "react";
import { Client, DiscussedItem } from "../../types";
import { useDashboard } from "../../context/DashboardContext";
import { sendSMSNotification } from "../../services/api";
import { formatProviderDisplayName } from "../../utils/providerHelpers";
import {
  isValidPhone,
  formatPhoneInput,
  cleanPhoneNumber,
} from "../../utils/validation";
import { showToast, showError } from "../../utils/toast";
import { getTreatmentDisplayName } from "./DiscussedTreatmentsModal/utils";
import "./ShareTreatmentPlanModal.css";

interface ShareTreatmentPlanModalProps {
  client: Client;
  onClose: () => void;
  onSuccess: () => void;
  /** When provided (e.g. from treatment plan popup), use this for the message body; else use client.discussedItems */
  discussedItems?: DiscussedItem[] | null;
}

/** Build pre-filled message body that includes the actual plan items, grouped by timeline */
function buildTreatmentPlanMessageBody(
  providerName: string,
  items: DiscussedItem[]
): string {
  if (items.length === 0) {
    return `${providerName}: Your treatment plan is ready. Here's a summary of the treatments we discussed for you.`;
  }
  const sections = ["Now", "Add next visit", "Wishlist", "Completed"] as const;
  const lines: string[] = [
    `${providerName}: Your treatment plan is ready. Here's what we discussed:`,
    "",
  ];
  for (const section of sections) {
    const inSection = items.filter((item) => {
      const t = (item.timeline ?? "").trim();
      if (section === "Now") return t === "Now";
      if (section === "Add next visit") return t === "Add next visit";
      if (section === "Completed") return t === "Completed";
      return t === "Wishlist" || !t;
    });
    if (inSection.length === 0) continue;
    lines.push(`${section}:`);
    for (const item of inSection) {
      const treatment = getTreatmentDisplayName(item);
      const parts: string[] = [treatment];
      if (item.region) parts.push(`(${item.region})`);
      if (item.product) parts.push(`— ${item.product}`);
      lines.push(`• ${parts.join(" ")}`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

export default function ShareTreatmentPlanModal({
  client,
  onClose,
  onSuccess,
  discussedItems,
}: ShareTreatmentPlanModalProps) {
  const { provider } = useDashboard();
  const planItems = discussedItems ?? client.discussedItems ?? [];
  const defaultMessageBody = useMemo(
    () =>
      buildTreatmentPlanMessageBody(
        formatProviderDisplayName(provider?.name) || "We",
        planItems
      ),
    [provider?.name, planItems]
  );
  const [formData, setFormData] = useState({
    name: client.name || "",
    phone: client.phone || "",
    message: defaultMessageBody,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  // Sync name/phone from client when they change (e.g. different client)
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      name: client.name || prev.name,
      phone: client.phone || prev.phone,
    }));
  }, [client.name, client.phone]);

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
      await sendSMSNotification(
        cleanPhoneNumber(formData.phone),
        formData.message,
        client.id,
        client.tableSource,
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
        className="modal-content add-lead-modal-content modal-content-narrow share-treatment-plan-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-info">
            <h2 className="modal-title">Share Treatment Plan with Patient</h2>
            <p className="modal-subtitle">
              Share the treatment plan with your patient via SMS
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="form-container">
            <div className="form-group">
              <label htmlFor="share-treatment-plan-name" className="form-label">
                Patient Name *
              </label>
              <input
                type="text"
                id="share-treatment-plan-name"
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
              <label htmlFor="share-treatment-plan-phone" className="form-label">
                Phone Number *
              </label>
              <input
                type="tel"
                id="share-treatment-plan-phone"
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
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                className="form-input-base"
              />
              {errors.phone && (
                <span className="field-error">{errors.phone}</span>
              )}
            </div>

            <div className="form-group form-group-spacing-lg">
              <label
                htmlFor="share-treatment-plan-message"
                className="form-label"
              >
                Message *
              </label>
              <textarea
                id="share-treatment-plan-message"
                rows={6}
                required
                placeholder="Enter your message about the treatment plan..."
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
