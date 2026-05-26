import { useMemo, type CSSProperties } from "react";
import type { CategoryResult } from "../../config/analysisOverviewConfig";
import { tierColor, tierLabel } from "../../config/analysisOverviewConfig";
import type { Client } from "../../types";
import {
  AURA_OVERVIEW_TABS,
  categoryByKey,
  detectedIssuesForSubScore,
  issueToMirrorHighlightTerm,
  type AuraOverviewCategoryKey,
} from "../../utils/auraAnalysisBridge";
import {
  clientHasSeverityScores,
  getSubScoreCanonicalIssues,
  issueSeverityVisual,
  severityColorFromBadness,
  subScoreSeverityBadness01,
} from "../../utils/auraSeverityDisplay";
import { hasMirrorAnnotationHighlights } from "../postVisitBlueprint/AiMirrorCanvas";
import AuraRegionalFaceCard from "./AuraRegionalFaceCard";
import "./AuraEmbeddedAnalysisPanel.css";

export interface AuraMirrorHighlightBridge {
  /** Issue highlight terms currently drawn on the photo / 3D view. */
  highlightTerms: string[];
  onToggleIssueHighlight: (issueName: string, enabled: boolean) => void;
  onClearIssueHighlights: () => void;
  activeCategory: AuraOverviewCategoryKey;
  onActiveCategoryChange: (key: AuraOverviewCategoryKey) => void;
  panelCollapsed: boolean;
  onPanelCollapsedChange: (collapsed: boolean) => void;
}

function isIssueOnFace(highlightTerms: string[], issue: string): boolean {
  const term = issueToMirrorHighlightTerm(issue).toLowerCase();
  return highlightTerms.some((t) => t.trim().toLowerCase() === term);
}

function IconEye({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17.9 17.9A10.1 10.1 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.1-5.9M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.2 3.2m-6.7-1.1a3 3 0 1 1-4.2-4.2" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function IconPanelChevron({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {collapsed ? <path d="M9 18l6-6-6-6" /> : <path d="M15 18l-6-6 6-6" />}
    </svg>
  );
}

interface AuraEmbeddedAnalysisPanelProps {
  client: Client;
  categories: CategoryResult[];
  detectedIssues: Set<string>;
  overallScore: number;
  bridge: AuraMirrorHighlightBridge;
}

export default function AuraEmbeddedAnalysisPanel({
  client,
  categories,
  detectedIssues,
  overallScore,
  bridge,
}: AuraEmbeddedAnalysisPanelProps) {
  const {
    highlightTerms,
    onToggleIssueHighlight,
    onClearIssueHighlights,
    activeCategory,
    onActiveCategoryChange,
    panelCollapsed,
    onPanelCollapsedChange,
  } = bridge;

  const onFaceCount = highlightTerms.length;

  const severityIssues = client.severityScoresFromAnalyses?.issues;
  const hasSeverity = clientHasSeverityScores(client);
  const activeTab = AURA_OVERVIEW_TABS.find((t) => t.key === activeCategory);
  const categoryAccent = activeTab?.accent ?? "#60a5fa";

  const activeCat = categoryByKey(categories, activeCategory);
  const hasFaceHighlights = hasMirrorAnnotationHighlights(highlightTerms);

  const subScoresWithIssues = useMemo(() => {
    if (!activeCat) return [];
    return activeCat.subScores
      .map((sub) => {
        const issues = detectedIssuesForSubScore(
          activeCategory,
          sub.name,
          detectedIssues,
        );
        const sortedIssues = [...issues].sort((a, b) => {
          const ba = issueSeverityVisual(a, severityIssues, categoryAccent).badness01 ?? -1;
          const bb = issueSeverityVisual(b, severityIssues, categoryAccent).badness01 ?? -1;
          if (bb !== ba) return bb - ba;
          return a.localeCompare(b);
        });
        const subBadness = subScoreSeverityBadness01(
          getSubScoreCanonicalIssues(sub.name),
          detectedIssues,
          severityIssues,
        );
        return {
          sub,
          issues: sortedIssues,
          subBadness,
          subColor:
            subBadness !== undefined
              ? severityColorFromBadness(subBadness)
              : tierColor(sub.tier),
        };
      })
      .filter((row) => row.issues.length > 0 || row.sub.detected > 0);
  }, [activeCat, activeCategory, detectedIssues, severityIssues, categoryAccent]);

  const priorityIssues = useMemo(() => {
    const all: { issue: string; badness01: number }[] = [];
    for (const row of subScoresWithIssues) {
      for (const issue of row.issues) {
        const vis = issueSeverityVisual(issue, severityIssues, categoryAccent);
        if (vis.badness01 !== undefined) {
          all.push({ issue, badness01: vis.badness01 });
        }
      }
    }
    return all.sort((a, b) => b.badness01 - a.badness01).slice(0, 3);
  }, [subScoresWithIssues, severityIssues, categoryAccent]);

  return (
    <div
      className={`aura-embedded-panel${panelCollapsed ? " aura-embedded-panel--collapsed" : ""}${hasSeverity ? " aura-embedded-panel--has-severity" : ""}`}
    >
      <div className="aura-embedded-panel__chrome">
        <button
          type="button"
          className="aura-embedded-panel__collapse"
          onClick={() => onPanelCollapsedChange(!panelCollapsed)}
          aria-expanded={!panelCollapsed}
          title={panelCollapsed ? "Show analysis panel" : "Hide analysis panel"}
        >
          <IconPanelChevron collapsed={panelCollapsed} />
        </button>
        <span className="aura-embedded-panel__overall">
          Overall <strong>{overallScore}</strong>
        </span>
        {onFaceCount > 0 ? (
          <button
            type="button"
            className="aura-embedded-panel__clear-face"
            onClick={onClearIssueHighlights}
          >
            Clear face ({onFaceCount})
          </button>
        ) : (
          <span className="aura-embedded-panel__face-hint">Tap issues to show on face</span>
        )}
      </div>

      {!panelCollapsed && (
        <>
          <div className="aura-embedded-panel__tabs" role="tablist" aria-label="Analysis categories">
            {AURA_OVERVIEW_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeCategory === tab.key}
                className={`aura-embedded-panel__tab${activeCategory === tab.key ? " aura-embedded-panel__tab--active" : ""}`}
                style={
                  activeCategory === tab.key
                    ? ({ "--aura-tab-accent": tab.accent } as CSSProperties)
                    : undefined
                }
                onClick={() => onActiveCategoryChange(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeCat && (
            <div className="aura-embedded-panel__category">
              <div className="aura-embedded-panel__cat-header">
                <h3 className="aura-embedded-panel__cat-title">{activeCat.scoreLabel}</h3>
                <p className="aura-embedded-panel__cat-tier" style={{ color: tierColor(activeCat.tier) }}>
                  {activeCat.score} · {tierLabel(activeCat.tier)}
                </p>
              </div>

              <AuraRegionalFaceCard
                activeCat={activeCat}
                detectedIssues={detectedIssues}
                severityIssues={severityIssues}
                hasSeverity={hasSeverity}
              />

              {hasSeverity && priorityIssues.length > 0 && (
                <div className="aura-embedded-panel__priority">
                  <span className="aura-embedded-panel__priority-label">Focus first</span>
                  <div className="aura-embedded-panel__priority-chips">
                    {priorityIssues.map(({ issue, badness01 }) => (
                      <span
                        key={issue}
                        className="aura-embedded-panel__priority-chip"
                        style={{
                          borderColor: severityColorFromBadness(badness01),
                          color: severityColorFromBadness(badness01),
                        }}
                      >
                        {issue}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="aura-embedded-panel__subs">
                {subScoresWithIssues.length === 0 ? (
                  <p className="aura-embedded-panel__empty">
                    No significant findings in this category for this client.
                  </p>
                ) : (
                  subScoresWithIssues.map(({ sub, issues, subBadness, subColor }) => (
                    <div
                      key={sub.name}
                      className="aura-embedded-panel__sub"
                      style={
                        subBadness !== undefined
                          ? ({
                              borderLeftColor: subColor,
                              "--aura-sub-tint": subColor,
                            } as CSSProperties)
                          : undefined
                      }
                    >
                      <div className="aura-embedded-panel__sub-head">
                        <span className="aura-embedded-panel__sub-name">{sub.name}</span>
                        <span
                          className="aura-embedded-panel__sub-score"
                          style={{ color: subColor }}
                        >
                          {sub.score}
                        </span>
                      </div>
                      {issues.length > 0 && (
                        <ul className="aura-embedded-panel__issues">
                          {issues.map((issue) => {
                            const vis = issueSeverityVisual(
                              issue,
                              severityIssues,
                              categoryAccent,
                            );
                            const isOnFace = isIssueOnFace(highlightTerms, issue);
                            return (
                              <li
                                key={issue}
                                className={`aura-embedded-panel__issue${vis.hasSeverityPayload ? " aura-embedded-panel__issue--severity" : ""}`}
                                style={
                                  vis.hasSeverityPayload
                                    ? ({ "--issue-severity-color": vis.color } as CSSProperties)
                                    : undefined
                                }
                              >
                                <div className="aura-embedded-panel__issue-main">
                                  <span
                                    className="aura-embedded-panel__issue-dot"
                                    style={{
                                      background: vis.hasSeverityPayload
                                        ? vis.color
                                        : categoryAccent,
                                    }}
                                    aria-hidden
                                  />
                                  <div className="aura-embedded-panel__issue-text">
                                    <span className="aura-embedded-panel__issue-name">{issue}</span>
                                    {vis.severityLevel ? (
                                      <span className="aura-embedded-panel__issue-level">
                                        {vis.severityLevel}
                                      </span>
                                    ) : !vis.hasSeverityPayload ? (
                                      <span className="aura-embedded-panel__issue-level aura-embedded-panel__issue-level--muted">
                                        Detected
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className={`aura-embedded-panel__issue-toggle${isOnFace ? " aura-embedded-panel__issue-toggle--on" : ""}`}
                                  aria-pressed={isOnFace}
                                  aria-label={
                                    isOnFace
                                      ? `Hide ${issue} on face`
                                      : `Show ${issue} on face`
                                  }
                                  onClick={() =>
                                    onToggleIssueHighlight(issue, !isOnFace)
                                  }
                                >
                                  {isOnFace ? <IconEye /> : <IconEyeOff />}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  ))
                )}
              </div>

              {onFaceCount > 0 && !hasFaceHighlights && (
                <p className="aura-embedded-panel__hint">
                  Pan the 3D view slightly if regions do not appear yet — landmarks load per angle.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
