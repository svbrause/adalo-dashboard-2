// Contact History Section Component

import { useState } from 'react';
import { Client, ContactHistoryEntry } from '../../types';
import { formatRelativeDate } from '../../utils/dateFormatting';
import { formatFacialStatus } from '../../utils/statusFormatting';
import { formatContactType, formatOutcome, formatNotesWithLineBreaks } from '../../utils/contactHistory';
import { saveContactLog, updateClientStatus } from '../../services/contactHistory';
import { showToast, showError } from '../../utils/toast';
import './ContactHistorySection.css';

interface ContactHistorySectionProps {
  client: Client;
  onUpdate: () => void;
}

export default function ContactHistorySection({ client, onUpdate }: ContactHistorySectionProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    type: 'call' as 'call' | 'email' | 'text' | 'meeting',
    outcome: 'reached' as 'reached' | 'voicemail' | 'no-answer' | 'scheduled' | 'sent' | 'replied' | 'attended' | 'no-show' | 'cancelled',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  // Get available outcomes based on contact type
  const getOutcomesForType = (type: 'call' | 'email' | 'text' | 'meeting'): Array<{ value: string; label: string }> => {
    switch (type) {
      case 'call':
        return [
          { value: 'reached', label: 'Reached' },
          { value: 'voicemail', label: 'Left Voicemail' },
          { value: 'no-answer', label: 'No Answer' },
          { value: 'scheduled', label: 'Scheduled Appointment' },
          { value: 'cancelled', label: 'Cancelled' }
        ];
      case 'email':
        return [
          { value: 'sent', label: 'Sent' },
          { value: 'replied', label: 'Replied' },
          { value: 'scheduled', label: 'Scheduled Appointment' },
          { value: 'cancelled', label: 'Cancelled' }
        ];
      case 'text':
        return [
          { value: 'sent', label: 'Sent' },
          { value: 'replied', label: 'Replied' },
          { value: 'scheduled', label: 'Scheduled Appointment' },
          { value: 'cancelled', label: 'Cancelled' }
        ];
      case 'meeting':
        return [
          { value: 'attended', label: 'Attended' },
          { value: 'no-show', label: 'No-Show' },
          { value: 'scheduled', label: 'Scheduled Appointment' },
          { value: 'cancelled', label: 'Cancelled' }
        ];
      default:
        return [{ value: 'reached', label: 'Reached' }];
    }
  };

  // Get default outcome for a contact type
  const getDefaultOutcome = (type: 'call' | 'email' | 'text' | 'meeting'): string => {
    switch (type) {
      case 'call':
        return 'reached';
      case 'email':
      case 'text':
        return 'sent';
      case 'meeting':
        return 'attended';
      default:
        return 'reached';
    }
  };

  // Handle contact type change - reset outcome to default for new type
  const handleTypeChange = (newType: 'call' | 'email' | 'text' | 'meeting') => {
    const defaultOutcome = getDefaultOutcome(newType);
    setFormData({ ...formData, type: newType, outcome: defaultOutcome as any });
  };

  const handleSave = async () => {
    if (!formData.notes.trim()) {
      showError('Please enter notes');
      return;
    }

    setSaving(true);
    try {
      await saveContactLog(client, formData);
      
      // Update client status if needed
      if (formData.outcome === 'scheduled' && client.status !== 'converted') {
        await updateClientStatus(client, 'scheduled');
      } else if (client.status === 'new') {
        await updateClientStatus(client, 'contacted');
      }
      
      showToast('Contact log added!');
      setShowAddForm(false);
      const defaultOutcome = getDefaultOutcome('call');
      setFormData({ type: 'call', outcome: defaultOutcome as any, notes: '' });
      onUpdate();
    } catch (error: any) {
      showError(error.message || 'Failed to save contact history');
    } finally {
      setSaving(false);
    }
  };

  // Combine contact history with facial analysis entry if applicable
  const allEntries: Array<ContactHistoryEntry & { type?: string }> = [...(client.contactHistory || [])];
  
  if (client.facialAnalysisStatus && client.facialAnalysisStatus !== '' && client.facialAnalysisStatus !== 'not-started') {
    allEntries.push({
      id: 'facial-analysis',
      leadId: client.id,
      type: 'facial-analysis' as any,
      outcome: 'reached',
      notes: `Facial analysis status: ${formatFacialStatus(client.facialAnalysisStatus)}`,
      date: client.createdAt || new Date().toISOString(),
    });
  }

  // Sort by date (most recent first)
  allEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="detail-section contact-history-section">
      <div className="detail-section-title section-title-flex">
        <span>Contact History</span>
        <button 
          className="btn-secondary btn-sm btn-sm-custom" 
          onClick={() => setShowAddForm(!showAddForm)}
        >
          Add Entry
        </button>
      </div>
      
      {showAddForm && (
        <div className="add-contact-log-form">
          <div className="form-row">
            <div className="form-group">
              <label>Contact Type</label>
              <select
                value={formData.type}
                onChange={(e) => handleTypeChange(e.target.value as any)}
              >
                <option value="call">Phone Call</option>
                <option value="email">Email</option>
                <option value="text">Text Message</option>
                <option value="meeting">In-Person</option>
              </select>
            </div>
            <div className="form-group">
              <label>Outcome</label>
              <select
                value={formData.outcome}
                onChange={(e) => setFormData({ ...formData, outcome: e.target.value as any })}
              >
                {getOutcomesForType(formData.type).map((outcome) => (
                  <option key={outcome.value} value={outcome.value}>
                    {outcome.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea
              rows={2}
              placeholder="What was discussed..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
          <div className="edit-actions">
            <button 
              className="btn-secondary btn-sm" 
              onClick={() => {
                setShowAddForm(false);
                const defaultOutcome = getDefaultOutcome('call');
                setFormData({ type: 'call', outcome: defaultOutcome as any, notes: '' });
              }}
            >
              Cancel
            </button>
            <button 
              className="btn-primary btn-sm" 
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Entry'}
            </button>
          </div>
        </div>
      )}
      
      <div className="contact-history-list">
        {allEntries.length === 0 ? (
          <div className="no-data">No contact history yet. Add your first interaction!</div>
        ) : (
          allEntries.map((entry) => {
            if ((entry.type as string) === 'facial-analysis') {
              return (
                <div key={entry.id} className="contact-entry">
                  <div className="contact-entry-header">
                    <span className="contact-type facial-analysis">Facial Analysis</span>
                    <span className="contact-date">{formatRelativeDate(entry.date)}</span>
                  </div>
                  <div className="contact-outcome">
                    Status: {formatFacialStatus((entry as any).status || client.facialAnalysisStatus)}
                  </div>
                  {entry.notes && (
                    <div 
                      className="contact-notes" 
                      dangerouslySetInnerHTML={{ __html: formatNotesWithLineBreaks(entry.notes) }}
                    />
                  )}
                </div>
              );
            }
            
            return (
              <div key={entry.id} className="contact-entry">
                <div className="contact-entry-header">
                  <span className={`contact-type ${entry.type}`}>
                    {formatContactType(entry.type)}
                  </span>
                  <span className="contact-date">{formatRelativeDate(entry.date)}</span>
                </div>
                <div className={`contact-outcome ${entry.outcome}`}>
                  {formatOutcome(entry.outcome)}
                </div>
                {entry.notes && (
                  <div 
                    className="contact-notes" 
                    dangerouslySetInnerHTML={{ __html: formatNotesWithLineBreaks(entry.notes) }}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
