// Telehealth SMS Modal Component

import { useState, useEffect } from "react";
import { Client } from "../../types";
import { useDashboard } from "../../context/DashboardContext";
import { sendSMSNotification } from "../../services/api";
import {
  getTelehealthScanLink,
  formatProviderDisplayName,
} from "../../utils/providerHelpers";
import { splitName, cleanPhoneNumber, formatPhoneDisplay } from "../../utils/validation";
import {
  mapAreasToFormFields,
  mapSkinComplaints,
} from "../../utils/formMapping";
import { showToast, showError } from "../../utils/toast";
import "./TelehealthSMSModal.css";

interface TelehealthSMSModalProps {
  client: Client;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TelehealthSMSModal({
  client,
  onClose,
  onSuccess,
}: TelehealthSMSModalProps) {
  const { provider } = useDashboard();
  const [message, setMessage] = useState("");
  const [smsLink, setSmsLink] = useState("");
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
    // Build default message
    const providerName = formatProviderDisplayName(provider?.name) || "We";
    const defaultMessage = `${providerName}: We are now utilizing a new patient tool to help track treatment progress and develop customized plans. Please complete the 5-min at-home AI facial scan prior to your next appointment and earn $50 off any new treatments you discover:`;
    setMessage(defaultMessage);

    // Build prefill URL
    const { first, last } = splitName(client.name);
    const phoneNumber = cleanPhoneNumber(client.phone);
    const { whatAreas, faceRegions } = mapAreasToFormFields(client);
    const skinComplaints = mapSkinComplaints(client);

    const params: string[] = [];
    params.push(`provider=${encodeURIComponent(providerName)}`);
    if (first) params.push(`name[first]=${encodeURIComponent(first)}`);
    if (last) params.push(`name[last]=${encodeURIComponent(last)}`);
    if (client.email) params.push(`email=${encodeURIComponent(client.email)}`);
    if (phoneNumber)
      params.push(`phoneNumber=${encodeURIComponent(phoneNumber)}`);
    if (client.zipCode)
      params.push(`zipCode=${encodeURIComponent(client.zipCode)}`);
    if (whatAreas.length > 0)
      params.push(`whatAreas=${encodeURIComponent(whatAreas.join(","))}`);
    if (faceRegions.length > 0)
      params.push(`faceRegions=${encodeURIComponent(faceRegions.join(","))}`);
    if (skinComplaints.length > 0)
      params.push(
        `skinComplaints=${encodeURIComponent(skinComplaints.join(","))}`,
      );
    params.push(
      `source=${encodeURIComponent("Provider Dashboard - SMS Link")}`,
    );

    const link = getTelehealthScanLink(provider);
    setSmsLink(`${link}?${params.join("&")}`);
  }, [client, provider]);

  const handleSend = async () => {
    if (!message.trim()) {
      showError("Please enter a message");
      return;
    }

    setSending(true);
    try {
      const finalMessage = `${message} ${smsLink}`;
      const cleanedPhone = client.phone.replace(/\D/g, "");

      await sendSMSNotification(
        cleanedPhone,
        finalMessage,
        client.name || undefined,
      );

      showToast(`SMS notification sent to ${client.name}`);
      onSuccess();
      onClose();
    } catch (error: any) {
      showError(error.message || "Failed to send SMS");
    } finally {
      setSending(false);
    }
  };

  const characterCount = message.length;

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div
        className="modal-content add-lead-modal-content modal-content-narrow"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-info">
            <h2 className="modal-title">Review SMS Message</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="form-container">
            <div className="form-group">
              <label className="form-label">Patient Information</label>
              <div className="patient-info-box">
                <div className="patient-info-row">
                  <strong>Name:</strong> {client.name}
                </div>
                <div className="patient-info-row">
                  <strong>Phone:</strong> {formatPhoneDisplay(client.phone)}
                </div>
              </div>
            </div>

            <div className="form-group form-group-spacing-lg">
              <label htmlFor="sms-message-textarea" className="form-label">
                Message *
              </label>
              <textarea
                id="sms-message-textarea"
                rows={6}
                required
                placeholder="Enter your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="form-textarea-base"
              />
              <div
                className={`character-count ${characterCount > 160 ? "character-count-error" : characterCount > 140 ? "character-count-warning" : "character-count-normal"}`}
              >
                {characterCount} characters
              </div>
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
              disabled={sending || !message.trim()}
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
