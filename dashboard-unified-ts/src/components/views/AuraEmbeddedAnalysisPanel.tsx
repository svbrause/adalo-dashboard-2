import { useMemo, useState, type CSSProperties } from "react";
import type { CategoryResult } from "../../config/analysisOverviewConfig";
import {
  CATEGORY_DESCRIPTIONS,
  tierColor,
  tierLabel,
} from "../../config/analysisOverviewConfig";
import type { Client, ClientPhotoSlot } from "../../types";
import type { SavedPatientAnnotation } from "../../utils/patientAnnotationsStorage";
import { SUGGESTION_TO_ISSUES } from "../modals/DiscussedTreatmentsModal/suggestionsMapping";
import { getTreatmentsForInterest } from "../modals/DiscussedTreatmentsModal/utils";
import { SUGGESTION_TO_AREA } from "../modals/DiscussedTreatmentsModal/suggestionsMapping";
import type {
  TreatmentPlanAddDirectOptions,
  TreatmentPlanPrefill,
} from "../modals/DiscussedTreatmentsModal/TreatmentPhotos";
import {
  AURA_OVERVIEW_TABS,
  categoryByKey,
  detectedIssuesForSubScore,
  issueToMirrorHighlightTerm,
  type AuraOverviewCategoryKey,
} from "../../utils/auraAnalysisBridge";
import {
  clientHasSeverityScores,
  issueSeverityVisual,
} from "../../utils/auraSeverityDisplay";
import { hasMirrorAnnotationHighlights } from "../postVisitBlueprint/AiMirrorCanvas";
import AuraCategoryRadarCard from "./AuraCategoryRadarCard";
import PatientMediaLibraryPanel from "./PatientMediaLibraryPanel";
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
  /** Patient photos, turntable video, saved face annotations. */
  patientFiles?: {
    photoSlots?: ClientPhotoSlot[];
    turntableVideoUrl?: string | null;
    annotationsRefreshKey: number;
    onLoadAnnotation: (record: SavedPatientAnnotation) => void;
  };
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

function IconTreat() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m18 2 4 4" />
      <path d="m17 7 3-3" />
      <path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5" />
      <path d="m9 11 4 4" />
      <path d="m5 19-3 3" />
      <path d="m14 4 6 6" />
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
      {collapsed ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
    </svg>
  );
}

function OverallScoreArc({
  score,
  color,
  label,
}: {
  score: number;
  color: string;
  label: string;
}) {
  const clamped = Math.max(0, Math.min(100, score));
  // 270-degree arc with a 90-degree top gap.
  const r = 14;
  const c = 2 * Math.PI * r;
  const arc = c * 0.75;
  const offset = arc * (1 - clamped / 100);
  return (
    <div className="aura-embedded-panel__overall-arc" aria-label={`${label} score ${clamped}`}>
      <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden>
        <g transform="rotate(135 22 22)">
          <circle
            cx="22"
            cy="22"
            r={r}
            fill="none"
            stroke="rgba(148, 163, 184, 0.3)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${arc} ${c}`}
          />
          <circle
            cx="22"
            cy="22"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${arc} ${c}`}
            strokeDashoffset={offset}
          />
        </g>
      </svg>
      <span className="aura-embedded-panel__overall-arc-value">{Math.round(clamped)}</span>
    </div>
  );
}

interface AuraEmbeddedAnalysisPanelProps {
  client: Client;
  categories: CategoryResult[];
  detectedIssues: Set<string>;
  bridge: AuraMirrorHighlightBridge;
  onAddToPlanDirect?: (
    prefill: TreatmentPlanPrefill,
    options?: TreatmentPlanAddDirectOptions,
  ) => Promise<void | unknown> | unknown;
  onOpenPlanBuilder?: () => void;
  onOpenTreatmentForIssue?: (
    issue: string,
    category: AuraOverviewCategoryKey,
  ) => void;
}

export default function AuraEmbeddedAnalysisPanel({
  client,
  categories,
  detectedIssues,
  bridge,
  onAddToPlanDirect,
  onOpenPlanBuilder,
  onOpenTreatmentForIssue,
}: AuraEmbeddedAnalysisPanelProps) {
  const [rightView, setRightView] = useState<"analysis" | "files" | "plan">("analysis");
  const {
    highlightTerms,
    onToggleIssueHighlight,
    activeCategory,
    panelCollapsed,
    onPanelCollapsedChange,
    patientFiles,
  } = bridge;

  const onFaceCount = highlightTerms.length;

  const severityIssues = client.severityScoresFromAnalyses?.issues;
  const hasSeverity = clientHasSeverityScores(client);
  const activeTab = AURA_OVERVIEW_TABS.find((t) => t.key === activeCategory);
  const categoryAccent = activeTab?.accent ?? "#60a5fa";

  const activeCat = categoryByKey(categories, activeCategory);
  const categoryScoreColor = activeCat
    ? tierColor(activeCat.tier)
    : categoryAccent;
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
          const ba = issueSeverityVisual(a, severityIssues, categoryScoreColor).badness01 ?? -1;
          const bb = issueSeverityVisual(b, severityIssues, categoryScoreColor).badness01 ?? -1;
          if (bb !== ba) return bb - ba;
          return a.localeCompare(b);
        });
        return { sub, issues: sortedIssues };
      })
      .filter((row) => row.issues.length > 0 || row.sub.detected > 0);
  }, [activeCat, activeCategory, detectedIssues, severityIssues, categoryScoreColor]);

  /** Findings grouped by sub-score section (matches radar dimensions). */
  const sectionedFindings = useMemo(
    () =>
      subScoresWithIssues
        .map(({ sub, issues }) => ({
          section: sub.name,
          items: issues.map((issue) => ({
            issue,
            vis: issueSeverityVisual(issue, severityIssues, categoryScoreColor),
          })),
        }))
        .filter((row) => row.items.length > 0),
    [subScoresWithIssues, severityIssues, categoryScoreColor],
  );

  /** Treatment suggestions relevant to all detected issues across all categories. */
  const suggestedTreatments = useMemo(() => {
    const issueSet = new Set(
      [...detectedIssues].map((i) => i.trim().toLowerCase()),
    );
    return Object.entries(SUGGESTION_TO_ISSUES)
      .map(([suggestion, issues]) => {
        const matched = issues.filter((i) =>
          issueSet.has(i.trim().toLowerCase()),
        );
        return { suggestion, matched };
      })
      .filter((row) => row.matched.length > 0)
      .sort((a, b) => b.matched.length - a.matched.length)
      .slice(0, 6);
  }, [detectedIssues]);

  return (
    <div
      className={`aura-embedded-panel${panelCollapsed ? " aura-embedded-panel--collapsed" : ""}${hasSeverity ? " aura-embedded-panel--has-severity" : ""}`}
    >
      <div
        className={`aura-embedded-panel__chrome${panelCollapsed ? " aura-embedded-panel__chrome--rail" : ""}`}
      >
        <button
          type="button"
          className="aura-embedded-panel__collapse"
          onClick={() => onPanelCollapsedChange(!panelCollapsed)}
          aria-expanded={!panelCollapsed}
          aria-label={panelCollapsed ? "Expand analysis panel" : "Collapse analysis panel"}
          title={panelCollapsed ? "Show analysis" : "Hide analysis"}
        >
          <IconPanelChevron collapsed={panelCollapsed} />
        </button>
        {!panelCollapsed ? (
          <>
            <div className="aura-embedded-panel__view-tabs" role="tablist" aria-label="Right panel">
              <button
                type="button"
                role="tab"
                aria-selected={rightView === "analysis"}
                className={`aura-embedded-panel__view-tab${rightView === "analysis" ? " aura-embedded-panel__view-tab--active" : ""}`}
                onClick={() => setRightView("analysis")}
              >
                Analysis
              </button>
              {(onAddToPlanDirect || onOpenPlanBuilder) ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={rightView === "plan"}
                  className={`aura-embedded-panel__view-tab${rightView === "plan" ? " aura-embedded-panel__view-tab--active" : ""}`}
                  onClick={() => setRightView("plan")}
                >
                  Plan
                </button>
              ) : null}
              {patientFiles ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={rightView === "files"}
                  className={`aura-embedded-panel__view-tab${rightView === "files" ? " aura-embedded-panel__view-tab--active" : ""}`}
                  onClick={() => setRightView("files")}
                >
                  Files
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </div>

      <div
        className="aura-embedded-panel__expandable"
        aria-hidden={panelCollapsed}
      >
        <div className="aura-embedded-panel__expandable-inner">
          {rightView === "plan" ? (
            <div className="aura-embedded-panel__plan">
              <div className="aura-embedded-panel__plan-header">
                <h3 className="aura-embedded-panel__plan-title">Treatment Plan</h3>
                <p className="aura-embedded-panel__plan-subhead">
                  Based on detected findings
                </p>
              </div>
              {suggestedTreatments.length === 0 ? (
                <p className="aura-embedded-panel__empty">
                  No treatment suggestions available for detected findings.
                </p>
              ) : (
                <ul className="aura-embedded-panel__plan-list">
                  {suggestedTreatments.map(({ suggestion, matched }) => {
                    const treatments = getTreatmentsForInterest(suggestion, undefined);
                    const firstTreatment = treatments[0] ?? "";
                    return (
                      <li key={suggestion} className="aura-embedded-panel__plan-item">
                        <div className="aura-embedded-panel__plan-item-top">
                          <span className="aura-embedded-panel__plan-item-name">{suggestion}</span>
                          <span className="aura-embedded-panel__plan-item-count">
                            {matched.length} finding{matched.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="aura-embedded-panel__plan-item-issues">
                          {matched.slice(0, 3).map((issue) => (
                            <span key={issue} className="aura-embedded-panel__plan-item-issue">
                              {issue}
                            </span>
                          ))}
                          {matched.length > 3 && (
                            <span className="aura-embedded-panel__plan-item-issue aura-embedded-panel__plan-item-issue--more">
                              +{matched.length - 3}
                            </span>
                          )}
                        </div>
                        {onAddToPlanDirect && firstTreatment ? (
                          <button
                            type="button"
                            className="aura-embedded-panel__plan-add-btn"
                            onClick={() =>
                              onAddToPlanDirect({
                                interest: suggestion,
                                region: SUGGESTION_TO_AREA[suggestion] ?? "",
                                treatment: firstTreatment,
                                findings: matched,
                              })
                            }
                          >
                            + Add to Plan
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
              {onOpenPlanBuilder ? (
                <button
                  type="button"
                  className="aura-embedded-panel__plan-open-btn"
                  onClick={() => onOpenPlanBuilder()}
                >
                  Open Full Plan Builder →
                </button>
              ) : null}
            </div>
          ) : rightView === "files" && patientFiles ? (
            <div className="aura-embedded-panel__files">
              <PatientMediaLibraryPanel
                client={client}
                photoSlots={patientFiles.photoSlots}
                turntableVideoUrl={patientFiles.turntableVideoUrl}
                refreshKey={patientFiles.annotationsRefreshKey}
                onLoadAnnotation={(record) => {
                  patientFiles.onLoadAnnotation(record);
                  setRightView("analysis");
                }}
              />
            </div>
          ) : activeCat ? (
            <div className="aura-embedded-panel__category">
              <div className="aura-embedded-panel__cat-header">
                <div className="aura-embedded-panel__cat-header-row">
                  <h3 className="aura-embedded-panel__cat-title">{activeCat.scoreLabel}</h3>
                  <div className="aura-embedded-panel__cat-header-meta">
                    <OverallScoreArc
                      score={activeCat.score}
                      color={categoryScoreColor}
                      label={activeCat.scoreLabel}
                    />
                    <span
                      className="aura-embedded-panel__cat-tier-pill"
                      style={{
                        color: categoryScoreColor,
                        borderColor: categoryScoreColor,
                        background: `color-mix(in srgb, ${categoryScoreColor} 10%, transparent)`,
                      }}
                    >
                      {tierLabel(activeCat.tier)}
                    </span>
                  </div>
                </div>
                <p className="aura-embedded-panel__cat-subheading">
                  {CATEGORY_DESCRIPTIONS[activeCategory]}
                </p>
              </div>

              <AuraCategoryRadarCard
                activeCat={activeCat}
                categoryAccent={categoryScoreColor}
              />

              <div className="aura-embedded-panel__issues-section">
                <h4 className="aura-embedded-panel__issues-heading">Findings</h4>
                {sectionedFindings.length === 0 ? (
                  <p className="aura-embedded-panel__empty">
                    No significant findings in this category for this client.
                  </p>
                ) : (
                  <div className="aura-embedded-panel__issue-groups">
                    {sectionedFindings.map((group) => (
                      <section
                        key={group.section}
                        className="aura-embedded-panel__issue-group"
                        aria-label={`${group.section} findings`}
                      >
                        <h5 className="aura-embedded-panel__issue-group-title">
                          {group.section}
                        </h5>
                        <ul className="aura-embedded-panel__issues">
                          {group.items.map(({ issue, vis }) => {
                            const isOnFace = isIssueOnFace(highlightTerms, issue);
                            const findingColor = vis.hasSeverityPayload ? vis.color : categoryScoreColor;
                            return (
                              <li
                                key={`${group.section}-${issue}`}
                                className={`aura-embedded-panel__issue${vis.hasSeverityPayload ? " aura-embedded-panel__issue--severity" : ""}`}
                                style={
                                  {
                                    "--issue-severity-color": findingColor,
                                  } as CSSProperties
                                }
                              >
                                <div className="aura-embedded-panel__issue-main">
                                  <span
                                    className="aura-embedded-panel__issue-dot"
                                    style={{ background: findingColor }}
                                    aria-hidden
                                  />
                                  <div className="aura-embedded-panel__issue-text">
                                    <span className="aura-embedded-panel__issue-name">{issue}</span>
                                    <span className="aura-embedded-panel__issue-meta">
                                      {vis.severityLevel ? (
                                        <span
                                          className="aura-embedded-panel__issue-level"
                                          style={{ color: findingColor, borderColor: findingColor, background: `color-mix(in srgb, ${findingColor} 12%, transparent)` }}
                                        >
                                          {vis.severityLevel}
                                        </span>
                                      ) : (
                                        <span className="aura-embedded-panel__issue-level aura-embedded-panel__issue-level--muted">
                                          Detected
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                </div>
                                {onOpenTreatmentForIssue && (
                                  <button
                                    type="button"
                                    className="aura-embedded-panel__issue-toggle aura-embedded-panel__issue-treat-btn"
                                    aria-label={`Treat ${issue}`}
                                    title={`Treat ${issue}`}
                                    onClick={() =>
                                      onOpenTreatmentForIssue(issue, activeCategory)
                                    }
                                  >
                                    <IconTreat />
                                    <span className="aura-embedded-panel__issue-treat-label">
                                      Treat
                                    </span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className={`aura-embedded-panel__issue-toggle${isOnFace ? " aura-embedded-panel__issue-toggle--on" : ""}`}
                                  aria-pressed={isOnFace}
                                  aria-label={
                                    isOnFace
                                      ? `Hide ${issue} on face`
                                      : `Show ${issue} on face`
                                  }
                                  onClick={() => onToggleIssueHighlight(issue, !isOnFace)}
                                >
                                  {isOnFace ? <IconEye /> : <IconEyeOff />}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    ))}
                  </div>
                )}
              </div>

              {onFaceCount > 0 && !hasFaceHighlights && (
                <p className="aura-embedded-panel__hint">
                  Pan the 3D view slightly if regions do not appear yet — landmarks load per angle.
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
