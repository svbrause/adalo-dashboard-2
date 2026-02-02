// Patient Issues Modal Component

import { useEffect } from 'react';
import { Client } from '../../types';
import { formatRelativeDate } from '../../utils/dateFormatting';
import { issueToSuggestionMap, groupIssuesByArea } from '../../utils/issueMapping';
import './PatientIssuesModal.css';

interface PatientIssuesModalProps {
  client: Client;
  onClose: () => void;
}

export default function PatientIssuesModal({ client, onClose }: PatientIssuesModalProps) {
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

  // Parse issues - kept for potential future use
  // let allIssues: string[] = [];
  // if (Array.isArray(client.allIssues)) {
  //   allIssues = client.allIssues.filter(i => i && i.trim());
  // } else if (typeof client.allIssues === 'string') {
  //   allIssues = client.allIssues.split(',').map(i => i.trim()).filter(i => i);
  // }

  let interestedIssues: string[] = [];
  if (Array.isArray(client.interestedIssues)) {
    interestedIssues = client.interestedIssues.filter(i => i && i.trim());
  } else if (typeof client.interestedIssues === 'string') {
    interestedIssues = client.interestedIssues.split(',').map(i => i.trim()).filter(i => i);
  }

  const patientGoals: string[] = Array.isArray(client.goals) 
    ? (client.goals as string[])
    : (typeof (client.goals as any) === 'string' && (client.goals as any) ? (client.goals as any as string).split(',').map((g: string) => g.trim()) : []);

  // Get actual focus areas
  const actualFocusAreas = new Set<string>();
  const areasOfInterest = client.processedAreasOfInterest || client.areasOfInterestFromForm || client.whichRegions;
  if (areasOfInterest) {
    const areasArray = typeof areasOfInterest === 'string' 
      ? areasOfInterest.split(',').map(a => a.trim()).filter(a => a)
      : Array.isArray(areasOfInterest) ? areasOfInterest : [areasOfInterest];
    areasArray.forEach(area => {
      const normalizedArea = area.trim();
      const capitalizedArea = normalizedArea.charAt(0).toUpperCase() + normalizedArea.slice(1).toLowerCase();
      actualFocusAreas.add(capitalizedArea);
      actualFocusAreas.add(normalizedArea);
      if (normalizedArea.toLowerCase().includes('jaw') || normalizedArea.toLowerCase().includes('chin')) {
        actualFocusAreas.add('Jawline');
      }
      if (normalizedArea.toLowerCase().includes('nose')) {
        actualFocusAreas.add('Nose');
      }
      if (normalizedArea.toLowerCase().includes('lip')) {
        actualFocusAreas.add('Lips');
      }
    });
  }

  // Find matching interests
  const findMatchingInterests = (issue: string): string[] => {
    const matchingInterests: string[] = [];
    const issueLower = issue.toLowerCase().trim();
    
    const mappedSuggestion = issueToSuggestionMap[issue];
    if (mappedSuggestion) {
      const mappedSuggestionLower = mappedSuggestion.toLowerCase();
      if (interestedIssues.some(interest => interest.toLowerCase().trim() === mappedSuggestionLower)) {
        matchingInterests.push(mappedSuggestion);
      }
    }
    
    interestedIssues.forEach(interest => {
      const interestLower = interest.toLowerCase().trim();
      if (interestLower === issueLower && !matchingInterests.includes(interest)) {
        matchingInterests.push(interest);
      }
    });
    
    return [...new Set(matchingInterests)];
  };

  const interestedSet = new Set(interestedIssues.map(i => i.toLowerCase().trim()));

  // Determine focus areas
  const focusAreas = new Set<string>();
  actualFocusAreas.forEach(area => {
    focusAreas.add(area);
  });

  if (actualFocusAreas.size === 0) {
    patientGoals.forEach((goal: string) => {
      const goalLower = goal.toLowerCase();
      if (goalLower.includes('lip') || goalLower.includes('lips')) focusAreas.add('Lips');
      if (goalLower.includes('eye') || goalLower.includes('eyes')) focusAreas.add('Eyes');
      if (goalLower.includes('cheek') || goalLower.includes('cheeks')) focusAreas.add('Cheeks');
      if (goalLower.includes('forehead') || goalLower.includes('brow')) focusAreas.add('Forehead');
      if (goalLower.includes('chin') || goalLower.includes('jaw')) focusAreas.add('Jawline');
      if (goalLower.includes('neck')) focusAreas.add('Neck');
      if (goalLower.includes('skin')) focusAreas.add('Skin');
      if (goalLower.includes('nose')) focusAreas.add('Nose');
    });
  }

  // Group issues by area
  const groupedIssues = groupIssuesByArea(client.allIssues || '');

  // Sort areas
  const areaOrder = ['Forehead', 'Eyes', 'Cheeks', 'Nose', 'Lips', 'Jawline', 'Skin', 'Body', 'Other'];
  const sortedAreas = Object.keys(groupedIssues).sort((a, b) => {
    const aIndex = areaOrder.indexOf(a);
    const bIndex = areaOrder.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  // Get front photo URL if available
  let frontPhotoUrl: string | null = null;
  if (client.frontPhoto && Array.isArray(client.frontPhoto) && client.frontPhoto.length > 0) {
    const attachment = client.frontPhoto[0];
    frontPhotoUrl = attachment.thumbnails?.large?.url || 
                    attachment.thumbnails?.full?.url ||
                    attachment.url;
  }

  const lastActivityRelative = client.lastContact 
    ? formatRelativeDate(client.lastContact) 
    : (client.createdAt ? formatRelativeDate(client.createdAt) : 'No activity yet');

  return (
    <div className="modal-overlay active patient-issues-modal-overlay" onClick={onClose}>
      <div className="modal-content patient-issues-modal" onClick={(e) => e.stopPropagation()}>
        <div className="patient-issues-modal-header">
          <div className="patient-issues-modal-header-content">
            <h2>Analysis Results for {client.name}</h2>
            <div className="patient-issues-header-info">
              <div className="patient-issues-activity-badge">
                <span className="patient-issues-activity-label">Last Activity:</span>
                <span className="patient-issues-activity-value">{lastActivityRelative}</span>
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="patient-issues-modal-body">
          {frontPhotoUrl && (
            <div className="modal-photo-container">
              <img src={frontPhotoUrl} alt={client.name} className="modal-photo" />
            </div>
          )}
          
          <div className="detail-section detail-section-spacing-bottom">
            <div className="detail-section-title">Analysis Results</div>
          </div>
          
          <div className="patient-issues-grid">
            {sortedAreas.length === 0 ? (
              <div className="patient-issues-empty-state">
                <p>No issues found for this patient.</p>
              </div>
            ) : (
              sortedAreas.map(area => {
                const issues = groupedIssues[area];
                const areaLower = area.toLowerCase();
                const isFocusArea = focusAreas.has(area) || 
                  Array.from(focusAreas).some(fa => {
                    const faLower = fa.toLowerCase();
                    return faLower === areaLower ||
                      (faLower.includes('jaw') && areaLower === 'jawline') ||
                      (faLower.includes('chin') && areaLower === 'jawline');
                  });

                return (
                  <div key={area} className="patient-issues-area-card">
                    <h3 className="patient-issues-area-title">
                      {area}
                      {isFocusArea && (
                        <span className="patient-issues-focus-badge">
                          Focus Area
                        </span>
                      )}
                    </h3>
                    <ul className="patient-issues-list">
                      {issues.map((issue: string, i: number) => {
                        const isInterested = interestedSet.has(issue.toLowerCase());
                        const matchingInterests = findMatchingInterests(issue);
                        
                        return (
                          <li key={i} className="patient-issues-item">
                            <span className="patient-issues-bullet">•</span>
                            <div className="patient-issues-header">
                              <span className="patient-issues-name">{issue}</span>
                              {isInterested && (
                                <span className="patient-issues-interested-badge">
                                  Interested
                                </span>
                              )}
                            </div>
                            {matchingInterests.length > 0 && (
                              <div className="patient-issues-treatments-container">
                                <span className="patient-issues-treatments-label">Interested Treatments:</span>
                                {matchingInterests.map((interest, j) => (
                                  <span key={j} className="patient-issues-treatment-tag">
                                    {interest}
                                  </span>
                                ))}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
