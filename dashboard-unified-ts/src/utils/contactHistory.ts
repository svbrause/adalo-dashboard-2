// Contact history utilities

export function formatContactType(type: string): string {
  const labels: Record<string, string> = { 
    call: 'Phone Call', 
    email: 'Email', 
    text: 'Text Message', 
    meeting: 'In-Person',
    'facial-analysis': 'Facial Analysis'
  };
  return labels[type] || type;
}

export function formatOutcome(outcome: string): string {
  const labels: Record<string, string> = { 
    reached: 'Reached', 
    voicemail: 'Left Voicemail', 
    'no-answer': 'No Answer',
    scheduled: 'Scheduled Appointment',
    sent: 'Sent',
    replied: 'Replied',
    attended: 'Attended',
    'no-show': 'No-Show',
    cancelled: 'Cancelled'
  };
  return labels[outcome] || outcome;
}

export function formatNotesWithLineBreaks(notes: string): string {
  if (!notes) return '';
  // Escape HTML to prevent XSS, then convert newlines to <br> tags
  const escaped = String(notes)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  // Convert newlines to <br> tags
  return escaped.replace(/\n/g, '<br>');
}
