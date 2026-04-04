import { useEffect } from "react";
import {
  THE_TREATMENT_LEAD_WELCOME_PHONE,
  buildTheTreatmentLeadWelcomeSmsPreview,
} from "../../config/theTreatmentLeadWelcomeSms";
import { THE_TREATMENT_BOOKING_URL } from "../../utils/providerHelpers";
import { openDashboardHelpRequest } from "../../utils/dashboardHelpEvents";
import "./LeadAutoReplySettingsModal.css";

interface LeadAutoReplySettingsModalProps {
  onClose: () => void;
}

export default function LeadAutoReplySettingsModal({
  onClose,
}: LeadAutoReplySettingsModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sampleMessage = buildTheTreatmentLeadWelcomeSmsPreview("Alex");

  const handleRequestChange = () => {
    const draft =
      "I'd like to request a change to the automatic SMS sent to new leads.\n\n" +
      "Current message (example first name \"Alex\"):\n\n" +
      sampleMessage +
      "\n\nRequested change:\n\n";
    onClose();
    openDashboardHelpRequest(draft);
  };

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div
        className="modal-content lead-auto-reply-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="lead-auto-reply-title"
      >
        <div className="modal-header lead-auto-reply-modal__header">
          <div className="modal-header-info lead-auto-reply-modal__header-info">
            <h2 className="modal-title" id="lead-auto-reply-title">
              Auto-reply SMS
            </h2>
          </div>
          <button
            type="button"
            className="modal-close lead-auto-reply-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="lead-auto-reply-body">
          <p className="lead-auto-reply-intro">
            Sent automatically for new website leads with a phone number when
            source is not <code>Walk-in</code>. Includes the{" "}
            <a
              href={THE_TREATMENT_BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              booking link
            </a>{" "}
            and clinic line{" "}
            <span className="lead-auto-reply-intro-phone">
              {THE_TREATMENT_LEAD_WELCOME_PHONE}
            </span>
            . Use <strong>Request change</strong> to ask for edits.
          </p>
          <label className="lead-auto-reply-label" htmlFor="lead-auto-reply-sample">
            Preview (first name &quot;Alex&quot;)
          </label>
          <pre
            id="lead-auto-reply-sample"
            className="lead-auto-reply-sample"
            tabIndex={0}
          >
            {sampleMessage}
          </pre>
        </div>

        <div className="lead-auto-reply-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={handleRequestChange}
          >
            Request change
          </button>
          <button type="button" className="btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
