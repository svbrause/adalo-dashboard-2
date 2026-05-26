// Analysis Results Section Component — Facial analysis detail on client records

import { useMemo, useState } from "react";
import type { AnalysisSeverityIssue, Client } from "../../types";
import { issueToSuggestionMap, getIssueArea } from "../../utils/issueMapping";
import { normalizeIssue } from "../../config/analysisOverviewConfig";
import {
  parseInterestedIssuesList,
  partitionInterestedIssuesForFacialVsWellness,
} from "../../utils/partitionInterestedIssuesWellnessFacial";
import {
  getRegionGrade60to100,
  getSeverityPayloadForIssueLabel,
  inferSeverityBadness01,
  isSeverityRowNonPerfect,
} from "../../utils/analysisOverviewClient";
import { SeverityNormRing } from "../common/SeverityNormRing";
import "./AnalysisResultsSection.css";

interface AnalysisResultsSectionProps {
  client: Client;
  activeIssueTerm?: string | null;
  onIssueActivate?: (term: string) => void;
  onViewExamples?: (issue: string, region: string) => void;
  onTreatmentInterestClick?: (interest: string) => void;
}

function shouldShowIssueRow(
  issueName: string,
  severityIssues: Record<string, AnalysisSeverityIssue>,
  hasSeverityJson: boolean,
): boolean {
  const payload = getSeverityPayloadForIssueLabel(issueName, severityIssues);
  if (hasSeverityJson && payload) {
    return isSeverityRowNonPerfect(payload);
  }
  /* Rollup-only (no detector row yet) — still show if we have no JSON path at all handled above */
  if (hasSeverityJson && !payload) return true;
  return true;
}

function ringBadnessForRow(
  issueName: string,
  severityIssues: Record<string, AnalysisSeverityIssue>,
  hasSeverityJson: boolean,
): number {
  const payload = getSeverityPayloadForIssueLabel(issueName, severityIssues);
  if (payload) {
    const b = inferSeverityBadness01(payload);
    if (b !== undefined) return b;
  }
  if (hasSeverityJson) return 0.08;
  return Math.min(
    1,
    Math.max(payload?.severity ?? 0, payload?.probability ?? 0) / 100 || 0.12,
  );
}

export default function AnalysisResultsSection({
  client,
  activeIssueTerm,
  onIssueActivate,
  onViewExamples,
  onTreatmentInterestClick,
}: AnalysisResultsSectionProps) {
  const [expanded, setExpanded] = useState(false);

  const severityIssues = client.severityScoresFromAnalyses?.issues ?? {};
  const hasSeverityJson = Object.keys(severityIssues).length > 0;

  const { mergedAllIssues, rollupNormKeys } = useMemo(() => {
    let list: string[] = [];
    if (Array.isArray(client.allIssues)) {
      list = client.allIssues.filter((i) => i && String(i).trim());
    } else if (typeof client.allIssues === "string") {
      list = client.allIssues.split(",").map((i) => i.trim()).filter(Boolean);
    }
    const keys = new Set(list.map((i) => normalizeIssue(i)));

    if (hasSeverityJson) {
      for (const [name, issue] of Object.entries(severityIssues)) {
        if (!isSeverityRowNonPerfect(issue)) continue;
        const nk = normalizeIssue(name);
        if (keys.has(nk)) continue;
        keys.add(nk);
        list.push(name);
      }
    }

    return {
      mergedAllIssues: list,
      rollupNormKeys: new Set(
        (Array.isArray(client.allIssues)
          ? client.allIssues
          : typeof client.allIssues === "string"
            ? client.allIssues.split(",").map((s) => s.trim()).filter(Boolean)
            : []
        ).map((i) => normalizeIssue(String(i))),
      ),
    };
  }, [client.allIssues, client.severityScoresFromAnalyses]);

  const allIssues = mergedAllIssues;

  const interestedIssuesAll = parseInterestedIssuesList(client);
  const { facialInterests, wellnessInterests } =
    partitionInterestedIssuesForFacialVsWellness(interestedIssuesAll);

  const patientGoals: string[] = Array.isArray(client.goals)
    ? (client.goals as string[])
    : typeof (client.goals as unknown) === "string" && (client.goals as unknown)
      ? (client.goals as unknown as string)
          .split(",")
          .map((g: string) => g.trim())
      : [];

  const actualFocusAreas = new Set<string>();
  const areasOfInterest =
    client.processedAreasOfInterest ||
    client.areasOfInterestFromForm ||
    client.whichRegions;
  if (areasOfInterest) {
    const areasArray =
      typeof areasOfInterest === "string"
        ? areasOfInterest.split(",").map((a) => a.trim()).filter((a) => a)
        : Array.isArray(areasOfInterest)
          ? areasOfInterest
          : [areasOfInterest];
    areasArray.forEach((area) => {
      const normalizedArea = String(area).trim();
      const capitalizedArea =
        normalizedArea.charAt(0).toUpperCase() +
        normalizedArea.slice(1).toLowerCase();
      actualFocusAreas.add(capitalizedArea);
      actualFocusAreas.add(normalizedArea);
      if (
        normalizedArea.toLowerCase().includes("jaw") ||
        normalizedArea.toLowerCase().includes("chin")
      ) {
        actualFocusAreas.add("Jawline");
      }
      if (normalizedArea.toLowerCase().includes("nose")) {
        actualFocusAreas.add("Nose");
      }
      if (normalizedArea.toLowerCase().includes("lip")) {
        actualFocusAreas.add("Lips");
      }
    });
  }

  const decodeAreaForDisplay = (s: string) => String(s).replace(/\+/g, " ");

  const processedAreas = client.processedAreasOfInterest
    ? typeof client.processedAreasOfInterest === "string"
      ? client.processedAreasOfInterest
          .split(",")
          .map((a) => a.trim())
          .filter((a) => a)
      : []
    : [];

  const hasFacialAnalysisContent =
    allIssues.length > 0 ||
    hasSeverityJson ||
    facialInterests.length > 0 ||
    processedAreas.length > 0 ||
    Boolean(client.skinComplaints?.trim());

  if (!hasFacialAnalysisContent) {
    return (
      <div className="analysis-results-empty">
        <p>No facial analysis findings to display yet.</p>
        {wellnessInterests.length > 0 ? (
          <p className="analysis-results-empty-secondary">
            Wellness-oriented intake goals (energy, sleep, gut comfort, etc.)
            are shown under <strong>Online Treatment Finder</strong> or{" "}
            <strong>Wellness Quiz</strong> — not in this facial analysis block.
          </p>
        ) : null}
      </div>
    );
  }

  const findMatchingInterests = (
    issue: string,
    _issueArea: string,
  ): string[] => {
    const matchingInterests: string[] = [];
    const issueLower = issue.toLowerCase().trim();

    const mappedSuggestion = issueToSuggestionMap[issue];
    if (mappedSuggestion) {
      const mappedSuggestionLower = mappedSuggestion.toLowerCase();
      if (
        facialInterests.some(
          (interest) =>
            interest.toLowerCase().trim() === mappedSuggestionLower,
        )
      ) {
        matchingInterests.push(mappedSuggestion);
      }
    }

    facialInterests.forEach((interest) => {
      const interestLower = interest.toLowerCase().trim();
      if (interestLower === issueLower && !matchingInterests.includes(interest)) {
        matchingInterests.push(interest);
      }
    });

    return [...new Set(matchingInterests)];
  };

  const interestedSet = new Set(facialInterests.map((i) => i.toLowerCase().trim()));

  const focusAreas = new Set<string>();
  actualFocusAreas.forEach((area) => focusAreas.add(area));

  if (actualFocusAreas.size === 0) {
    patientGoals.forEach((goal: string) => {
      const goalLower = goal.toLowerCase();
      if (goalLower.includes("lip") || goalLower.includes("lips"))
        focusAreas.add("Lips");
      if (goalLower.includes("eye") || goalLower.includes("eyes"))
        focusAreas.add("Eyes");
      if (goalLower.includes("cheek") || goalLower.includes("cheeks"))
        focusAreas.add("Cheeks");
      if (goalLower.includes("forehead") || goalLower.includes("brow"))
        focusAreas.add("Forehead");
      if (goalLower.includes("chin") || goalLower.includes("jaw"))
        focusAreas.add("Jawline");
      if (goalLower.includes("neck")) focusAreas.add("Neck");
      if (goalLower.includes("skin")) focusAreas.add("Skin");
      if (goalLower.includes("nose")) focusAreas.add("Nose");
    });
  }

  const groupedIssues: Record<string, string[]> = {};
  allIssues.forEach((issue) => {
    const area = getIssueArea(issue);
    if (!groupedIssues[area]) groupedIssues[area] = [];
    groupedIssues[area].push(issue);
  });

  const areaOrder = [
    "Forehead",
    "Eyes",
    "Cheeks",
    "Nose",
    "Lips",
    "Jawline",
    "Skin",
    "Body",
    "Other",
  ];
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
      <div className="analysis-summary-section">
        <div className="analysis-section-title">Interested Treatments</div>
        {facialInterests.length > 0 ? (
          <div className="analysis-tags-container">
            {facialInterests.map((issue, i) => (
              <button
                key={i}
                type="button"
                className={`analysis-tag${onTreatmentInterestClick ? " analysis-tag-clickable" : ""}`}
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
          <div className="analysis-section-title-focus">Focus Areas</div>
          <div className="analysis-focus-areas-text">
            {processedAreas.map(decodeAreaForDisplay).join(", ")}
          </div>
        </div>
      )}

      <button
        type="button"
        className={`btn-secondary btn-sm analysis-expand-button ${expanded ? "expanded" : ""}`}
        onClick={() => setExpanded(!expanded)}
      >
        <span>{expanded ? "Hide" : "View"} Details</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`analysis-expand-icon ${expanded ? "expanded" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div className="analysis-expanded-content">
          <p className="analysis-region-grade-legend">
            Region scores (60–100) use every facial issue mapped to that area. Issues
            at baseline count as best; only issues above baseline are listed. Each
            issue gauge matches the Analysis Overview style: thick ring, tier color,
            and a 0–100 health score inside (from severity_normalized_0_1 when present).
          </p>
          <div className="analysis-results-grid">
            {sortedAreas.length === 0 ? (
              <div className="analysis-empty-state">
                <p>No issues found for this patient.</p>
              </div>
            ) : (
              sortedAreas.map((area) => {
                const issues = groupedIssues[area];
                const areaLower = area.toLowerCase();
                const isFocusArea =
                  focusAreas.has(area) ||
                  Array.from(focusAreas).some((fa) => {
                    const faLower = fa.toLowerCase();
                    return (
                      faLower === areaLower ||
                      (faLower.includes("jaw") && areaLower === "jawline") ||
                      (faLower.includes("chin") && areaLower === "jawline") ||
                      (faLower.includes("nose") && areaLower === "nose") ||
                      (faLower.includes("lip") && areaLower === "lips")
                    );
                  });

                const regionGrade = getRegionGrade60to100(area, {
                  severityIssues: hasSeverityJson ? severityIssues : undefined,
                  rollupIssueNormKeys: rollupNormKeys,
                });

                const visibleIssues = issues.filter((issue) =>
                  shouldShowIssueRow(issue, severityIssues, hasSeverityJson),
                );

                return (
                  <div key={area} className="analysis-area-card">
                    <h3 className="analysis-area-title">
                      <span className="analysis-area-title-text">
                        {decodeAreaForDisplay(area)}
                        {isFocusArea && (
                          <span className="analysis-focus-badge">Focus Area</span>
                        )}
                      </span>
                      <span
                        className="analysis-area-grade"
                        title="60 = weak, 100 = excellent (all issues in this area at baseline)"
                      >
                        {regionGrade}
                      </span>
                    </h3>
                    {visibleIssues.length === 0 ? (
                      <p className="analysis-area-all-clear">
                        No issues flagged above baseline in this area.
                      </p>
                    ) : (
                      <ul className="analysis-issues-list">
                        {visibleIssues.map((issue, i) => {
                          const isInterested = interestedSet.has(
                            issue.toLowerCase().trim(),
                          );
                          const matchingInterests = findMatchingInterests(
                            issue,
                            area,
                          );
                          const badness = ringBadnessForRow(
                            issue,
                            severityIssues,
                            hasSeverityJson,
                          );

                          const isActive = activeIssueTerm === issue;
                          return (
                            <li
                              key={i}
                              className={`analysis-issue-item${onIssueActivate ? " analysis-issue-item--clickable" : ""}${isActive ? " analysis-issue-item--active" : ""}`}
                              onClick={() => onIssueActivate?.(issue)}
                            >
                              <div className="analysis-issue-row">
                                <div className="analysis-issue-ring-wrap">
                                  <SeverityNormRing badness01={badness} size={56} />
                                </div>
                                <div className="analysis-issue-content">
                                  <div className="analysis-issue-header">
                                    <span className="analysis-issue-name">
                                      {decodeAreaForDisplay(issue)}
                                    </span>
                                    {isInterested && (
                                      <span className="analysis-interested-badge">
                                        Interested
                                      </span>
                                    )}
                                  </div>
                                  {matchingInterests.length > 0 ? (
                                    <div className="analysis-treatments-container">
                                      <span className="analysis-treatments-label">
                                        Interested Treatments:
                                      </span>
                                      {matchingInterests.map((interest, j) => (
                                        <button
                                          key={j}
                                          type="button"
                                          className={`analysis-treatment-tag${onTreatmentInterestClick ? " analysis-tag-clickable" : ""}`}
                                          onClick={() =>
                                            onTreatmentInterestClick?.(interest)
                                          }
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
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
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
