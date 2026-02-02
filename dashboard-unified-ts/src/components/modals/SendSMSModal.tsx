// Generic Send SMS Modal Component

import { useState, useEffect } from 'react';
import { Client } from '../../types';
import { sendSMSNotification } from '../../services/api';
import { isValidPhone, cleanPhoneNumber } from '../../utils/validation';
import { showToast, showError } from '../../utils/toast';
import './SendSMSModal.css';

interface SendSMSModalProps {
  client: Client;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SendSMSModal({ client, onClose, onSuccess }: SendSMSModalProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSend = async () => {
    setErrors({});

    if (!message.trim()) {
      setErrors({ message: 'Message is required' });
      return;
    }

    if (!client.phone) {
      setErrors({ phone: 'Phone number is required' });
      return;
    }

    if (!isValidPhone(client.phone)) {
      setErrors({ phone: 'Please enter a valid phone number' });
      return;
    }

    setSending(true);
    try {
      const cleanedPhone = cleanPhoneNumber(client.phone);
      await sendSMSNotification(cleanedPhone, message, client.id, client.tableSource);
      
      showToast(`SMS sent to ${client.name}`);
      onSuccess();
      onClose();
    } catch (error: any) {
      showError(error.message || 'Failed to send SMS');
    } finally {
      setSending(false);
    }
  };

  const characterCount = message.length;
  const characterCountClass = characterCount > 160 ? 'character-count-error' : characterCount > 140 ? 'character-count-warning' : 'character-count-normal';

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content add-lead-modal-content modal-content-narrow" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-info">
            <h2 className="modal-title">Send SMS</h2>
            <p className="modal-subtitle">
              Send a message to {client.name}
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-container">
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <div className="patient-info-box">
                <div className="patient-info-value">
                  {client.phone || 'N/A'}
                </div>
              </div>
              {errors.phone && <span className="field-error">{errors.phone}</span>}
            </div>

            <div className="form-group form-group-spacing-lg">
              <label htmlFor="sms-message" className="form-label">
                Message *
              </label>
              <textarea
                id="sms-message"
                rows={6}
                required
                placeholder="Enter your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="form-textarea-base"
              />
              <div className={`character-count ${characterCountClass}`}>
                {characterCount} characters
              </div>
              {errors.message && <span className="field-error">{errors.message}</span>}
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
              disabled={sending || !message.trim() || !client.phone}
            >
              {sending ? (
                <>
                  <span className="spinner spinner-inline"></span>
                  Sending...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="modal-icon-spacing">
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
