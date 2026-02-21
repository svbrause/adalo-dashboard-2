// Offer Request Modal – structured fields matching the Offers table.
// Submits to Help Requests so support can add/edit the offer in Airtable.

import { useState, FormEvent, useEffect } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { submitHelpRequest } from '../../services/api';
import { isValidEmail } from '../../utils/validation';
import { setBodyScrollLock } from '../../utils/scrollLock';
import { showToast, showError } from '../../utils/toast';
import { Offer } from '../../types';
import './OfferRequestModal.css';

const OFFER_FIELDS = [
  { key: 'name', label: 'Name', placeholder: 'e.g. $50 Off' },
  { key: 'heading', label: 'Heading', placeholder: 'e.g. $50 off any new treatments' },
  { key: 'details', label: 'Details', placeholder: 'e.g. Limited time offer — apply at your consultation' },
  { key: 'availableUntil', label: 'Available Until', placeholder: 'e.g. Forever' },
  { key: 'redemptionPeriod', label: 'Redemption Period', placeholder: 'e.g. 1 Week' },
  { key: 'treatmentFilter', label: 'Treatment Filter', placeholder: 'e.g. Applies to All Treatments' },
] as const;

type OfferFormKey = (typeof OFFER_FIELDS)[number]['key'];

export interface OfferRequestModalProps {
  onClose: () => void;
  mode: 'add' | 'edit';
  /** When mode is 'edit', pre-fill from this offer */
  initialOffer?: Offer | null;
}

const defaultOfferValues: Record<OfferFormKey, string> = {
  name: '',
  heading: '',
  details: '',
  availableUntil: '',
  redemptionPeriod: '',
  treatmentFilter: '',
};

function offerToFormValues(offer: Offer | null | undefined): Record<OfferFormKey, string> {
  if (!offer) return { ...defaultOfferValues };
  return {
    name: offer.name ?? '',
    heading: offer.heading ?? '',
    details: offer.details ?? '',
    availableUntil: offer.availableUntil ?? '',
    redemptionPeriod: offer.redemptionPeriod ?? '',
    treatmentFilter: offer.treatmentFilter ?? '',
  };
}

function buildMessageFromOffer(
  mode: 'add' | 'edit',
  offerValues: Record<OfferFormKey, string>,
  notes: string,
  existingOfferName?: string
): string {
  const lines: string[] = [
    mode === 'add' ? 'Request type: Add Offer' : `Request type: Edit Offer${existingOfferName ? ` (current: "${existingOfferName}")` : ''}`,
    '',
    'Offer details:',
    ...OFFER_FIELDS.map(({ key, label }) => `${label}: ${offerValues[key] || '(not set)'}`),
  ];
  if (notes.trim()) {
    lines.push('', 'Notes:', notes.trim());
  }
  return lines.join('\n');
}

export default function OfferRequestModal({
  onClose,
  mode,
  initialOffer = null,
}: OfferRequestModalProps) {
  const { provider } = useDashboard();
  const [offerValues, setOfferValues] = useState<Record<OfferFormKey, string>>(() =>
    offerToFormValues(initialOffer)
  );
  const [notes, setNotes] = useState('');
  const [requesterName, setRequesterName] = useState('');
  const [requesterEmail, setRequesterEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Lock body scroll when modal is open (prevents iOS background scroll)
  useEffect(() => {
    setBodyScrollLock(true);
    return () => setBodyScrollLock(false);
  }, []);

  const handleOfferChange = (key: OfferFormKey, value: string) => {
    setOfferValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!requesterName.trim()) {
      setErrors({ requesterName: 'Your name is required' });
      return;
    }
    if (!requesterEmail.trim()) {
      setErrors({ requesterEmail: 'Email is required' });
      return;
    }
    if (!isValidEmail(requesterEmail)) {
      setErrors({ requesterEmail: 'Please enter a valid email address' });
      return;
    }
    if (!provider) {
      showError('Provider information not available');
      return;
    }

    setLoading(true);
    try {
      const message = buildMessageFromOffer(
        mode,
        offerValues,
        notes,
        mode === 'edit' ? initialOffer?.name : undefined
      );
      await submitHelpRequest(requesterName, requesterEmail, message, provider.id);
      showToast("Request submitted. The Ponce support team will follow up.");
      onClose();
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  const title = mode === 'add' ? 'Add New Offer' : 'Edit Offer';

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content offer-request-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-info">
            <h2 className="modal-title">{title}</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="offer-request-instruction">
              If you want to add or edit an offer, send a message to the Ponce support team. Fill in the offer details below; your request will be sent to support.
            </div>

            <div className="offer-request-section">
              <h3 className="offer-request-section-heading">Offer details</h3>
              <div className="offer-request-fields">
              {OFFER_FIELDS.map(({ key, label, placeholder }) => (
                <div key={key} className="form-group">
                  <label htmlFor={`offer-${key}`}>{label}</label>
                  <input
                    type="text"
                    id={`offer-${key}`}
                    placeholder={placeholder}
                    value={offerValues[key]}
                    onChange={(e) => handleOfferChange(key, e.target.value)}
                  />
                </div>
              ))}
              <div className="form-group offer-request-notes-group">
                <label htmlFor="offer-notes">Notes</label>
                <textarea
                  id="offer-notes"
                  rows={3}
                  placeholder="Any additional notes for the support team..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="offer-request-notes-input"
                />
              </div>
              </div>
            </div>

            <div className="offer-request-section">
              <h3 className="offer-request-section-heading">Your contact info (for follow-up)</h3>
            <div className="offer-request-requester">
              <div className="form-group">
                <label htmlFor="offer-requester-name">Your Name *</label>
                <input
                  type="text"
                  id="offer-requester-name"
                  required
                  placeholder="Enter your name"
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                />
                {errors.requesterName && (
                  <span className="field-error">{errors.requesterName}</span>
                )}
              </div>
              <div className="form-group">
                <label htmlFor="offer-requester-email">Email Address *</label>
                <input
                  type="email"
                  id="offer-requester-email"
                  required
                  placeholder="email@example.com"
                  value={requesterEmail}
                  onChange={(e) => setRequesterEmail(e.target.value)}
                />
                {errors.requesterEmail && (
                  <span className="field-error">{errors.requesterEmail}</span>
                )}
              </div>
            </div>
            </div>

            {provider && (
              <div className="form-group form-info-box">
                <label className="form-info-label">Provider</label>
                <div className="form-info-value">{provider.name || '-'}</div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <div className="modal-actions-left" />
            <div className="modal-actions-right">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner spinner-inline" />
                    Sending...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="modal-icon-spacing">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
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
