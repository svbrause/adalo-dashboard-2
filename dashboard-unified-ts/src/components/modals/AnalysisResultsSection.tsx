// Analysis Results Section Component - Complete Version

import { useState } from 'react';
import { Client } from '../../types';
import { issueToSuggestionMap, getIssueArea } from '../../utils/issueMapping';
import './AnalysisResultsSection.css';

interface AnalysisResultsSectionProps {
  client: Client;
  /** Called when user wants to view treatment photos for a specific issue/region */
  onViewExamples?: (issue: string, region: string) => void;
  /** Called when user clicks on a treatment interest */
  onTreatmentInterestClick?: (interest: string) => void;
}

export default function AnalysisResultsSection({ 
  client,
  onViewExamples,
  onTreatmentInterestClick,
}: AnalysisResultsSectionProps) {
  const [expanded, setExpanded] = useState(false);

  // Parse issues
  let allIssues: string[] = [];
  if (Array.isArray(client.allIssues)) {
    allIssues = client.allIssues.filter(i => i && i.trim());
  } else if (typeof client.allIssues === 'string') {
    allIssues = client.allIssues.split(',').map(i => i.trim()).filter(i => i);
  }

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

  /** Decode URL-style plus signs to spaces for display (e.g. "Face+and+neck+aging" -> "Face and neck aging"). */
  const decodeAreaForDisplay = (s: string) => String(s).replace(/\+/g, ' ');

  const processedAreas = client.processedAreasOfInterest
    ? (typeof client.processedAreasOfInterest === 'string' 
        ? client.processedAreasOfInterest.split(',').map(a => a.trim()).filter(a => a)
        : [])
    : [];

  const hasData = allIssues.length > 0 || interestedIssues.length > 0 || processedAreas.length > 0 || client.skinComplaints;

  if (!hasData) {
    return (
      <div className="analysis-results-empty">
        Facial analysis data is available for this patient.
      </div>
    );
  }

  // Find matching interests for an issue
  const findMatchingInterests = (issue: string, _issueArea: string): string[] => {
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
  const groupedIssues: Record<string, string[]> = {};
  allIssues.forEach(issue => {
    const area = getIssueArea(issue);
    if (!groupedIssues[area]) {
      groupedIssues[area] = [];
    }
    groupedIssues[area].push(issue);
  });

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

  return (
    <div className="analysis-results-section">
      {/* Summary sections */}
      <div className="analysis-summary-section">
        <div className="analysis-section-title">
          Interested Treatments
        </div>
        {interestedIssues.length > 0 ? (
          <div className="analysis-tags-container">
            {interestedIssues.map((issue, i) => (
              <button
                key={i}
                type="button"
                className={`analysis-tag${onTreatmentInterestClick ? ' analysis-tag-clickable' : ''}`}
                onClick={() => onTreatmentInterestClick?.(issue)}
                disabled={!onTreatmentInterestClick}
              >
                {decodeAreaForDisplay(issue)}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {processedAreas.length > 0 && (
        <div className="analysis-summary-section">
          <div className="analysis-section-title-focus">
            Focus Areas
          </div>
          <div className="analysis-focus-areas-text">
            {processedAreas.map(decodeAreaForDisplay).join(', ')}
          </div>
        </div>
      )}

      {/* Expandable detailed results */}
      <button
        className={`btn-secondary btn-sm analysis-expand-button ${expanded ? 'expanded' : ''}`}
        onClick={() => setExpanded(!expanded)}
      >
        <span>{expanded ? 'Hide' : 'View'} Details</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`analysis-expand-icon ${expanded ? 'expanded' : ''}`}
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {expanded && (
        <div className="analysis-expanded-content">
          <div className="analysis-results-grid">
            {sortedAreas.length === 0 ? (
              <div className="analysis-empty-state">
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
                      (faLower.includes('chin') && areaLower === 'jawline') ||
                      (faLower.includes('nose') && areaLower === 'nose') ||
                      (faLower.includes('lip') && areaLower === 'lips');
                  });

                return (
                  <div key={area} className="analysis-area-card">
                    <h3 className="analysis-area-title">
                      {decodeAreaForDisplay(area)}
                      {isFocusArea && (
                        <span className="analysis-focus-badge">
                          Focus Area
                        </span>
                      )}
                    </h3>
                    <ul className="analysis-issues-list">
                      {issues.map((issue, i) => {
                        const isInterested = interestedSet.has(issue.toLowerCase());
                        const matchingInterests = findMatchingInterests(issue, area);
                        
                        return (
                          <li key={i} className="analysis-issue-item">
                            <span className="analysis-issue-bullet">•</span>
                            <div className="analysis-issue-content">
                              <div className="analysis-issue-header">
                                <span className="analysis-issue-name">{decodeAreaForDisplay(issue)}</span>
                                {isInterested && (
                                  <span className="analysis-interested-badge">
                                    Interested
                                  </span>
                                )}
                              </div>
                              {matchingInterests.length > 0 ? (
                                <div className="analysis-treatments-container">
                                  <span className="analysis-treatments-label">Interested Treatments:</span>
                                  {matchingInterests.map((interest, j) => (
                                    <button
                                      key={j}
                                      type="button"
                                      className={`analysis-treatment-tag${onTreatmentInterestClick ? ' analysis-tag-clickable' : ''}`}
                                      onClick={() => onTreatmentInterestClick?.(interest)}
                                      disabled={!onTreatmentInterestClick}
                                    >
                                      {decodeAreaForDisplay(interest)}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                              {onViewExamples && (
                                <button
                                  type="button"
                                  className="analysis-view-examples-btn"
                                  onClick={() => onViewExamples(issue, area)}
                                >
                                  View Examples
                                </button>
                              )}
                            </div>
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
      )}
    </div>
  );
}
