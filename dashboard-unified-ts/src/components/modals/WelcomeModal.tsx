// Welcome Modal Component

import { useEffect } from "react";
import ponceLogo from "../../assets/images/ponce logo.png";
import "./WelcomeModal.css";

interface WelcomeModalProps {
  onClose: () => void;
}

export default function WelcomeModal({ onClose }: WelcomeModalProps) {
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

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div
        className="modal-content add-lead-modal-content modal-content-narrow"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-info">
            <h2 className="modal-title">Welcome to Dashboard 2.0! 🎉</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="welcome-content-wrapper">
            <div
              className="welcome-logo-container"
              id="welcome-logo-container"
            >
              <img
                src={ponceLogo}
                alt="Ponce Logo"
                className="img-logo"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                  const container = document.getElementById(
                    "welcome-logo-container",
                  );
                  if (container) container.style.display = "none";
                }}
              />
            </div>
            <p className="welcome-text-content">
              We're excited to introduce you to our new and improved Provider
              Dashboard!
            </p>
            <div className="welcome-info-box">
              <h3 className="welcome-info-title">
                What's New:
              </h3>
              <ul className="welcome-info-list">
                <li>Enhanced user interface and improved navigation</li>
                <li>
                  Integrated support for our new online self assessment lead
                  generation tool
                </li>
                <li>
                  Unified tracking of new leads and facial analysis patients in
                  one place
                </li>
                <li>Added search and filter capabilities</li>
                <li>
                  Ability to manually remind patients to review unseen analyses
                </li>
                <li>
                  Replaced visual facial analysis interface with a report format
                </li>
              </ul>
            </div>
            <p className="welcome-text-secondary">
              This dashboard replaces the previous version and provides a more
              intuitive experience for managing your patients and leads.
            </p>
            <div className="welcome-help-box">
              <p className="welcome-help-text">
                💬 Have questions or need help? Reach out to us at{" "}
                <a
                  href="mailto:support@ponce.ai"
                  className="welcome-help-link"
                >
                  support@ponce.ai
                </a>{" "}
                or just tap the get support button on the left menu
              </p>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <div className="modal-actions-left"></div>
          <div className="modal-actions-right">
            <button type="button" className="btn-primary" onClick={onClose}>
              Get Started
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
