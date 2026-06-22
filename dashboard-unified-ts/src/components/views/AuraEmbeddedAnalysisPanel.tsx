import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { CategoryResult } from "../../config/analysisOverviewConfig";
import {
  CATEGORY_DESCRIPTIONS,
  canonicalIssueDisplayLabel,
  tierColor,
  tierLabel,
} from "../../config/analysisOverviewConfig";
import type { Client, ClientPhotoSlot } from "../../types";
import type { SavedPatientAnnotation } from "../../utils/patientAnnotationsStorage";
import {
  AURA_OVERVIEW_TABS,
  AURA_SKIN_LENS_COLORS,
  AURA_SKIN_LENS_LABELS,
  auraSkinLensFromLabel,
  buildSkinLensRadarData,
  categoryByKey,
  collectIssuesForSkinLens,
  detectedIssuesForCategory,
  detectedIssuesForSubScore,
  isAuraAnalysisAreaFiltered,
  SKIN_LENS_ORDER,
  type AuraOverviewCategoryKey,
  type AuraSkinLens,
} from "../../utils/auraAnalysisBridge";
import { getEffectiveSeverityIssues } from "../../utils/analysisOverviewClient";
import { issueSeverityVisual } from "../../utils/auraSeverityDisplay";
import type { PatientAuraAssetManifest } from "../../utils/patientAuraAssets";
import type { PatientProgressScan } from "../../utils/patientProgressScans";
import { hasMirrorAnnotationHighlights } from "../postVisitBlueprint/AiMirrorCanvas";
import AuraCategoryRadarCard from "./AuraCategoryRadarCard";
import PatientMediaLibraryPanel from "./PatientMediaLibraryPanel";
import "./AuraEmbeddedAnalysisPanel.css";

export interface AuraMirrorHighlightBridge {
  /** Issue highlight terms currently drawn on the photo / 3D view. */
  highlightTerms: string[];
  activeCategory: AuraOverviewCategoryKey;
  onActiveCategoryChange: (key: AuraOverviewCategoryKey) => void;
  panelCollapsed: boolean;
  onPanelCollapsedChange: (collapsed: boolean) => void;
  /** Patient photos, turntable video, saved face annotations. */
  patientFiles?: {
    photoSlots?: ClientPhotoSlot[];
    turntableVideoUrl?: string | null;
    auraManifest?: PatientAuraAssetManifest | null;
    annotationsRefreshKey: number;
    onLoadAnnotation: (record: SavedPatientAnnotation) => void;
    onCompareScans?: (scans: PatientProgressScan[]) => void;
    activeScanId?: string | null;
    onActiveScanIdChange?: (scanId: string) => void;
  };
  /** Active Skin scan lens (Pigmentation / Texture / Redness / Pores) — synced with left face sub-tabs. */
  activeSkinLens?: AuraSkinLens;
  onActiveSkinLensChange?: (lens: AuraSkinLens) => void;
  /** Active Volume / Structure area selected in the left Aura viewer. */
  activeAnalysisArea?: string;
  onActiveAnalysisAreaChange?: (area: string) => void;
  /** Hides all rendered analysis annotations/highlights without clearing saved selections. */
  annotationsHidden: boolean;
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

function IconSectionChevron({ expanded }: { expanded: boolean }) {
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
      <path d={expanded ? "m18 15-6-6-6 6" : "m6 9 6 6 6-6"} />
    </svg>
  );
}

type SkinAnalysisLens = {
  label: string;
  detail: string;
  terms: string[];
  sections?: string[];
};

const SKIN_ANALYSIS_LENSES: SkinAnalysisLens[] = [
  {
    label: "Pigmentation",
    detail: "Dark spots, discoloration, tone",
    sections: ["Pigmentation"],
    terms: [
      "pigment",
      "dark spot",
      "dark circle",
      "discolor",
      "tone",
      "melasma",
    ],
  },
  {
    label: "Redness",
    detail: "Red spots, rosacea",
    sections: ["Pigmentation"],
    terms: ["red", "rosacea", "irritation", "inflam", "facial redness"],
  },
  {
    label: "Pores",
    detail: "Congestion, visible pores",
    terms: ["pore", "whitehead", "blackhead", "acne", "comedone", "congestion"],
  },
  {
    label: "Wrinkles",
    detail: "Lines and creases",
    sections: ["Wrinkles"],
    terms: [
      "wrinkle",
      "line",
      "crow",
      "forehead",
      "glabella",
      "perioral",
      "neck line",
    ],
  },
];

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
    <div
      className="aura-embedded-panel__overall-arc"
      aria-label={`${label} score ${clamped}`}
    >
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
      <span className="aura-embedded-panel__overall-arc-value">
        {Math.round(clamped)}
      </span>
    </div>
  );
}

interface AuraEmbeddedAnalysisPanelProps {
  client: Client;
  categories: CategoryResult[];
  detectedIssues: Set<string>;
  bridge: AuraMirrorHighlightBridge;
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
  onOpenPlanBuilder,
  onOpenTreatmentForIssue,
}: AuraEmbeddedAnalysisPanelProps) {
  const [rightView, setRightView] = useState<"analysis" | "scans">("analysis");
  const [findingsExpanded, setFindingsExpanded] = useState(false);
  const prevPanelCollapsedRef = useRef(false);
  const {
    highlightTerms,
    activeCategory,
    panelCollapsed,
    onPanelCollapsedChange,
    patientFiles,
    activeSkinLens,
    activeAnalysisArea,
    annotationsHidden,
  } = bridge;

  const onFaceCount = annotationsHidden ? 0 : highlightTerms.length;

  const severityIssues = useMemo(
    () => getEffectiveSeverityIssues(client),
    [client],
  );
  const hasSeverity = Boolean(
    severityIssues && Object.keys(severityIssues).length > 0,
  );
  const activeTab = AURA_OVERVIEW_TABS.find((t) => t.key === activeCategory);
  const categoryAccent = activeTab?.accent ?? "#60a5fa";

  const activeCat = categoryByKey(categories, activeCategory);
  const categoryScoreColor = activeCat
    ? tierColor(activeCat.tier)
    : categoryAccent;
  const hasFaceHighlights =
    !annotationsHidden && hasMirrorAnnotationHighlights(highlightTerms);

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
          const ba =
            issueSeverityVisual(a, severityIssues, categoryScoreColor)
              .badness01 ?? -1;
          const bb =
            issueSeverityVisual(b, severityIssues, categoryScoreColor)
              .badness01 ?? -1;
          if (bb !== ba) return bb - ba;
          return a.localeCompare(b);
        });
        return { sub, issues: sortedIssues };
      })
      .filter((row) => row.issues.length > 0 || row.sub.detected > 0);
  }, [
    activeCat,
    activeCategory,
    detectedIssues,
    severityIssues,
    categoryScoreColor,
  ]);

  /** Findings grouped by sub-score section (matches radar dimensions). */
  const sectionedFindings = useMemo(
    () =>
      subScoresWithIssues
        .map(({ sub, issues }) => ({
          section: sub.name,
          items: issues.map((issue) => {
            const label = canonicalIssueDisplayLabel(issue);
            return {
              issue: label,
              vis: issueSeverityVisual(
                label,
                severityIssues,
                categoryScoreColor,
              ),
            };
          }),
        }))
        .filter((row) => row.items.length > 0),
    [subScoresWithIssues, severityIssues, categoryScoreColor],
  );

  const skinLensRadarData = useMemo(() => {
    if (!activeCat || activeCategory !== "skinHealth") return undefined;
    return buildSkinLensRadarData(activeCat, {
      detected: detectedIssues,
      severityIssues: severityIssues ?? undefined,
    });
  }, [activeCat, activeCategory, detectedIssues, severityIssues]);

  const activeCategoryIssues = useMemo(
    () => detectedIssuesForCategory(activeCategory, detectedIssues),
    [activeCategory, detectedIssues],
  );

  /** Skin: group findings under the left scan lens tabs. */
  const skinLensFindings = useMemo(() => {
    if (activeCategory !== "skinHealth") return [];
    const lenses = SKIN_ANALYSIS_LENSES;
    const byLens = new Map<
      AuraSkinLens,
      { issue: string; vis: ReturnType<typeof issueSeverityVisual> }[]
    >();
    for (const lens of lenses) {
      const key = auraSkinLensFromLabel(lens.label);
      if (key) byLens.set(key, []);
    }
    for (const lens of SKIN_LENS_ORDER) {
      const bucket = byLens.get(lens);
      if (!bucket) continue;
      for (const issue of collectIssuesForSkinLens(
        lens,
        activeCategoryIssues,
        severityIssues,
      )) {
        bucket.push({
          issue,
          vis: issueSeverityVisual(issue, severityIssues, categoryScoreColor),
        });
      }
    }
    return lenses
      .map((lens) => {
        const key = auraSkinLensFromLabel(lens.label);
        if (!key) return null;
        const items = (byLens.get(key) ?? []).sort((a, b) => {
          const ba = a.vis.badness01 ?? -1;
          const bb = b.vis.badness01 ?? -1;
          if (bb !== ba) return bb - ba;
          return a.issue.localeCompare(b.issue);
        });
        return { lensKey: key, lens, items };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);
  }, [
    activeCategory,
    activeCategoryIssues,
    severityIssues,
    categoryScoreColor,
  ]);

  const effectiveSkinLens: AuraSkinLens =
    activeSkinLens === "texture" || activeSkinLens == null
      ? "pigmentation"
      : activeSkinLens;

  const findingsGroups = useMemo(() => {
    if (activeCategory === "skinHealth") {
      return skinLensFindings
        .filter((g) => g.items.length > 0)
        .map((g) => ({
          section: g.lens.label,
          sectionDetail: g.lens.detail,
          lensKey: g.lensKey,
          items: g.items,
        }));
    }
    return sectionedFindings.map((g) => ({
      section: g.section,
      sectionDetail: undefined as string | undefined,
      lensKey: undefined as AuraSkinLens | undefined,
      items: g.items,
    }));
  }, [activeCategory, skinLensFindings, sectionedFindings]);

  /** Skin: show only the lens matching the left tab (always derived from severity + detected). */
  const focusedFindingsGroups = useMemo(() => {
    if (activeCategory !== "skinHealth") {
      if (!isAuraAnalysisAreaFiltered(activeAnalysisArea))
        return findingsGroups;
      const focused = findingsGroups.find(
        (g) => g.section === activeAnalysisArea,
      );
      return focused
        ? [focused]
        : findingsGroups.length > 0
          ? [findingsGroups[0]]
          : [];
    }
    const lensIssues = collectIssuesForSkinLens(
      effectiveSkinLens,
      activeCategoryIssues,
      severityIssues,
    );
    return [
      {
        section: AURA_SKIN_LENS_LABELS[effectiveSkinLens],
        sectionDetail: undefined,
        lensKey: effectiveSkinLens,
        items: lensIssues.map((issue) => ({
          issue,
          vis: issueSeverityVisual(issue, severityIssues, categoryScoreColor),
        })),
      },
    ];
  }, [
    activeCategory,
    activeAnalysisArea,
    findingsGroups,
    effectiveSkinLens,
    activeCategoryIssues,
    severityIssues,
    categoryScoreColor,
  ]);

  const findingsEmpty = focusedFindingsGroups.every(
    (g) => g.items.length === 0,
  );

  const findingsSectionRef = useRef<HTMLDivElement | null>(null);
  const expandableRef = useRef<HTMLDivElement | null>(null);
  const collapseBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (prevPanelCollapsedRef.current && !panelCollapsed) {
      setRightView("analysis");
    }
    prevPanelCollapsedRef.current = panelCollapsed;
  }, [panelCollapsed]);

  useEffect(() => {
    if (!panelCollapsed) return;
    const expandable = expandableRef.current;
    const focused = document.activeElement;
    if (
      expandable &&
      focused instanceof HTMLElement &&
      expandable.contains(focused)
    ) {
      collapseBtnRef.current?.focus();
    }
  }, [panelCollapsed]);

  useEffect(() => {
    if (panelCollapsed || rightView !== "analysis") {
      return;
    }
    findingsSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [
    effectiveSkinLens,
    activeAnalysisArea,
    activeCategory,
    panelCollapsed,
    rightView,
  ]);

  return (
    <div
      className={`aura-embedded-panel${panelCollapsed ? " aura-embedded-panel--collapsed" : ""}${hasSeverity ? " aura-embedded-panel--has-severity" : ""}`}
    >
      <div
        className={`aura-embedded-panel__chrome${panelCollapsed ? " aura-embedded-panel__chrome--rail" : ""}`}
      >
        <button
          ref={collapseBtnRef}
          type="button"
          className="aura-embedded-panel__collapse"
          onClick={() => onPanelCollapsedChange(!panelCollapsed)}
          aria-expanded={!panelCollapsed}
          aria-label={
            panelCollapsed ? "Expand analysis panel" : "Collapse analysis panel"
          }
          title={panelCollapsed ? "Show analysis" : "Hide analysis"}
        >
          <IconPanelChevron collapsed={panelCollapsed} />
          {panelCollapsed ? (
            <span className="aura-embedded-panel__collapse-label">
              Analysis
            </span>
          ) : null}
        </button>
        {!panelCollapsed ? (
          <>
            <div
              className="aura-embedded-panel__view-tabs"
              role="tablist"
              aria-label="Right panel"
            >
              <button
                type="button"
                role="tab"
                aria-selected={rightView === "analysis"}
                className={`aura-embedded-panel__view-tab${rightView === "analysis" ? " aura-embedded-panel__view-tab--active" : ""}`}
                onClick={() => setRightView("analysis")}
              >
                Analysis
              </button>
              {patientFiles ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={rightView === "scans"}
                  className={`aura-embedded-panel__view-tab${rightView === "scans" ? " aura-embedded-panel__view-tab--active" : ""}`}
                  onClick={() => setRightView("scans")}
                >
                  Scans
                </button>
              ) : null}
            </div>
            {onOpenPlanBuilder ? (
              <button
                type="button"
                className="aura-embedded-panel__quick-add-btn"
                onClick={() => onOpenPlanBuilder()}
              >
                <IconTreat />
                <span>Quick Add</span>
              </button>
            ) : null}
          </>
        ) : null}
      </div>

      <div
        ref={expandableRef}
        className="aura-embedded-panel__expandable"
        aria-hidden={panelCollapsed || undefined}
        {...(panelCollapsed ? { inert: true } : {})}
      >
        <div className="aura-embedded-panel__expandable-inner">
          {rightView === "scans" && patientFiles ? (
            <div className="aura-embedded-panel__files">
              <PatientMediaLibraryPanel
                client={client}
                photoSlots={patientFiles.photoSlots}
                turntableVideoUrl={patientFiles.turntableVideoUrl}
                auraManifest={patientFiles.auraManifest}
                refreshKey={patientFiles.annotationsRefreshKey}
                onLoadAnnotation={(record) => {
                  patientFiles.onLoadAnnotation(record);
                  setRightView("analysis");
                }}
                onCompareScans={patientFiles.onCompareScans}
                activeScanId={patientFiles.activeScanId}
                onActiveScanIdChange={patientFiles.onActiveScanIdChange}
              />
            </div>
          ) : activeCat ? (
            <div className="aura-embedded-panel__category">
              <div className="aura-embedded-panel__cat-header">
                <div className="aura-embedded-panel__cat-header-row">
                  <h3 className="aura-embedded-panel__cat-title">
                    {activeCat.scoreLabel}
                  </h3>
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
                {activeCategory !== "skinHealth" ? (
                  <p className="aura-embedded-panel__cat-subheading">
                    {CATEGORY_DESCRIPTIONS[activeCategory]}
                  </p>
                ) : null}
              </div>

              <div
                ref={findingsSectionRef}
                className={`aura-embedded-panel__issues-section${findingsExpanded ? " aura-embedded-panel__issues-section--expanded" : " aura-embedded-panel__issues-section--collapsed"}`}
              >
                <div className="aura-embedded-panel__findings-chart-stage">
                  <div className="aura-embedded-panel__findings-chart">
                    <AuraCategoryRadarCard
                      activeCat={activeCat}
                      categoryAccent={categoryScoreColor}
                      radarDataOverride={skinLensRadarData}
                      activeSkinLens={
                        activeCategory === "skinHealth"
                          ? effectiveSkinLens
                          : undefined
                      }
                      activeAnalysisArea={
                        activeCategory !== "skinHealth"
                          ? activeAnalysisArea
                          : undefined
                      }
                      chartAriaLabel={
                        skinLensRadarData
                          ? `Skin scan lens chart; ${AURA_SKIN_LENS_LABELS[effectiveSkinLens]} selected`
                          : `${activeCat.name} sub-score chart`
                      }
                    />
                  </div>

                  <button
                    type="button"
                    className="aura-embedded-panel__issues-header"
                    onClick={() => setFindingsExpanded((expanded) => !expanded)}
                    aria-expanded={findingsExpanded}
                  >
                    <span className="aura-embedded-panel__issues-heading">
                      Findings
                    </span>
                    <span className="aura-embedded-panel__issues-count">
                      {focusedFindingsGroups.reduce(
                        (sum, group) => sum + group.items.length,
                        0,
                      )}
                    </span>
                    <IconSectionChevron expanded={findingsExpanded} />
                  </button>
                </div>

                <div className="aura-embedded-panel__findings-body">
                  {findingsEmpty ? (
                    <p className="aura-embedded-panel__empty">
                      {activeCategory === "skinHealth"
                        ? `No significant ${AURA_SKIN_LENS_LABELS[effectiveSkinLens].toLowerCase()} findings for this client.`
                        : "No significant findings in this category for this client."}
                    </p>
                  ) : (
                    <div className="aura-embedded-panel__issue-groups">
                      {focusedFindingsGroups.map((group) => (
                        <section
                          key={group.lensKey ?? group.section}
                          className="aura-embedded-panel__issue-group aura-embedded-panel__issue-group--lens-active"
                          aria-label={`${group.section} findings`}
                          style={
                            group.lensKey
                              ? ({
                                  borderColor: `color-mix(in srgb, ${AURA_SKIN_LENS_COLORS[group.lensKey]} 42%, var(--theme-border, #e2e8f0))`,
                                  background: `color-mix(in srgb, ${AURA_SKIN_LENS_COLORS[group.lensKey]} 10%, var(--theme-bg-inset, #f8fafc))`,
                                } as CSSProperties)
                              : undefined
                          }
                        >
                          {activeCategory !== "skinHealth" ? (
                            <h5 className="aura-embedded-panel__issue-group-title">
                              <span
                                className="aura-embedded-panel__issue-group-lens"
                                style={
                                  group.lensKey
                                    ? ({
                                        color:
                                          AURA_SKIN_LENS_COLORS[group.lensKey],
                                      } as CSSProperties)
                                    : undefined
                                }
                              >
                                {group.section}
                              </span>
                              {group.sectionDetail ? (
                                <span className="aura-embedded-panel__issue-group-detail">
                                  {group.sectionDetail}
                                </span>
                              ) : null}
                            </h5>
                          ) : null}
                          <ul className="aura-embedded-panel__issues">
                            {group.items.map(({ issue, vis }) => {
                              const findingColor = vis.hasSeverityPayload
                                ? vis.color
                                : categoryScoreColor;
                              return (
                                <li
                                  key={`${group.lensKey ?? group.section}-${issue}`}
                                  className={`aura-embedded-panel__issue${vis.hasSeverityPayload ? " aura-embedded-panel__issue--severity" : ""}`}
                                  style={
                                    {
                                      "--issue-severity-color": findingColor,
                                    } as CSSProperties
                                  }
                                >
                                  <div className="aura-embedded-panel__issue-main">
                                    <div className="aura-embedded-panel__issue-text">
                                      <span className="aura-embedded-panel__issue-name">
                                        {issue}
                                      </span>
                                      {vis.severityLevel ||
                                      vis.healthScore != null ? (
                                        <span className="aura-embedded-panel__issue-meta">
                                          {vis.severityLevel ||
                                          vis.healthScore != null ? (
                                            <span
                                              className="aura-embedded-panel__issue-level"
                                              style={{
                                                color: findingColor,
                                                borderColor: findingColor,
                                                background: `color-mix(in srgb, ${findingColor} 12%, transparent)`,
                                              }}
                                            >
                                              {vis.severityLevel
                                                ? vis.healthScore != null
                                                  ? `${vis.severityLevel} · ${vis.healthScore}/100`
                                                  : vis.severityLevel
                                                : `${vis.healthScore}/100`}
                                            </span>
                                          ) : null}
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                  {onOpenTreatmentForIssue && (
                                    <button
                                      type="button"
                                      className="aura-embedded-panel__issue-toggle aura-embedded-panel__issue-treat-btn"
                                      aria-label={`Treat ${issue}`}
                                      title={`Treat ${issue}`}
                                      onClick={() =>
                                        onOpenTreatmentForIssue(
                                          issue,
                                          activeCategory,
                                        )
                                      }
                                    >
                                      <IconTreat />
                                      <span className="aura-embedded-panel__issue-treat-label">
                                        Treat
                                      </span>
                                    </button>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </section>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {onFaceCount > 0 && !hasFaceHighlights && (
                <p className="aura-embedded-panel__hint">
                  Pan the 3D view slightly if regions do not appear yet —
                  landmarks load per angle.
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
