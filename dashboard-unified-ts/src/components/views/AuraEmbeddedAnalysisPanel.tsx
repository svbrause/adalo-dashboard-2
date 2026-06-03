import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { CategoryResult } from "../../config/analysisOverviewConfig";
import {
  CATEGORY_DESCRIPTIONS,
  canonicalIssueDisplayLabel,
  tierColor,
  tierLabel,
} from "../../config/analysisOverviewConfig";
import type { Client, ClientPhotoSlot, DiscussedItem } from "../../types";
import type { SavedPatientAnnotation } from "../../utils/patientAnnotationsStorage";
import {
  getTreatmentPlanRowPrimaryLabel,
  getTreatmentPlanRowSecondaryLabel,
} from "../modals/DiscussedTreatmentsModal/utils";
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
  issueToMirrorHighlightTerm,
  SKIN_LENS_ORDER,
  type AuraOverviewCategoryKey,
  type AuraSkinLens,
} from "../../utils/auraAnalysisBridge";
import { getEffectiveSeverityIssues } from "../../utils/analysisOverviewClient";
import { issueSeverityVisual } from "../../utils/auraSeverityDisplay";
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
  /** Active Skin scan lens (Texture / Redness / Pores) — synced with left face sub-tabs. */
  activeSkinLens?: AuraSkinLens;
  onActiveSkinLensChange?: (lens: AuraSkinLens) => void;
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

type AnalysisLens = {
  label: string;
  detail: string;
  terms: string[];
  sections?: string[];
};

const CATEGORY_STORY: Record<
  AuraOverviewCategoryKey,
  {
    text: string;
    lenses: AnalysisLens[];
  }
> = {
  skinHealth: {
    text:
      "Skin lenses on the left match the chart: texture, redness, pores, and wrinkles. Scores run 1.2 (best) to 2.8 on a 0–3 scale.",
    lenses: [
      {
        label: "Texture",
        detail: "Roughness, dryness, spots",
        sections: ["Texture", "Hydration"],
        terms: ["texture", "dry", "crepey", "scar", "dark spot", "dark circle"],
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
        terms: ["wrinkle", "line", "crow", "forehead", "glabella", "perioral", "neck line"],
      },
    ],
  },
  volumeLoss: {
    text:
      "The volume view shows where contour support and shadowing may relate to the findings list. These are treated as support patterns, not standalone proof of tissue loss.",
    lenses: [
      {
        label: "Eye support",
        detail: "Under-eye hollows and bags",
        sections: ["Eye Area"],
        terms: ["eye", "hollow", "bag", "dark circle"],
      },
      {
        label: "Midface",
        detail: "Cheek contour and lateral weight",
        sections: ["Cheek Area"],
        terms: ["cheek", "cheekbone", "temporal", "mid cheek"],
      },
      {
        label: "Lower face",
        detail: "Folds, jowls, jaw support",
        sections: ["Lower Face", "Neck Area"],
        terms: ["fold", "jowl", "marionette", "lower", "prejowl", "neck", "platysmal"],
      },
    ],
  },
  proportions: {
    text:
      "The structure view organizes balance, alignment, and proportion findings. It is meant to connect visible shape cues to the issue list without implying a single ideal facial template.",
    lenses: [
      {
        label: "Brow / eyes",
        detail: "Upper-face balance",
        sections: ["Brow & Eyes"],
        terms: ["brow", "eyelid", "eye", "forehead"],
      },
      {
        label: "Profile / jaw",
        detail: "Chin and jawline proportion",
        sections: ["Jaw"],
        terms: ["jaw", "chin", "masseter"],
      },
      {
        label: "Feature balance",
        detail: "Nose and lip structure",
        sections: ["Nose", "Lips"],
        terms: ["nose", "tip", "hump", "lip", "philtral", "smile"],
      },
    ],
  },
};

function normalizeLensText(value: string): string {
  return value.toLowerCase().replace(/['']/g, "").replace(/\s+/g, " ").trim();
}

function lensesForFinding(
  categoryKey: AuraOverviewCategoryKey,
  section: string,
  issue: string,
): AnalysisLens[] {
  const story = CATEGORY_STORY[categoryKey];
  const sectionKey = normalizeLensText(section);
  const issueKey = normalizeLensText(issue);
  return story.lenses.filter((lens) => {
    const sectionMatch = lens.sections?.some(
      (name) => normalizeLensText(name) === sectionKey,
    );
    const termMatch = lens.terms.some((term) =>
      issueKey.includes(normalizeLensText(term)),
    );
    return sectionMatch || termMatch;
  });
}

function skinLensFocusSubheading(lens: AuraSkinLens, detail?: string): string {
  const label = AURA_SKIN_LENS_LABELS[lens];
  return detail
    ? `${label} lens: ${detail}.`
    : `${label} lens selected.`;
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
  const [rightView, setRightView] = useState<"analysis" | "files" | "plan">("analysis");
  const {
    highlightTerms,
    onToggleIssueHighlight,
    activeCategory,
    panelCollapsed,
    onPanelCollapsedChange,
    patientFiles,
    activeSkinLens,
  } = bridge;

  const onFaceCount = highlightTerms.length;

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
  const hasFaceHighlights = hasMirrorAnnotationHighlights(highlightTerms);
  const categoryStory = CATEGORY_STORY[activeCategory];

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
          items: issues.map((issue) => {
            const label = canonicalIssueDisplayLabel(issue);
            return {
              issue: label,
              vis: issueSeverityVisual(label, severityIssues, categoryScoreColor),
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

  /** Skin: group findings under Texture / Redness / Pores (left scan tabs). */
  const skinLensFindings = useMemo(() => {
    if (activeCategory !== "skinHealth") return [];
    const lenses = CATEGORY_STORY.skinHealth.lenses;
    const byLens = new Map<AuraSkinLens, { issue: string; vis: ReturnType<typeof issueSeverityVisual> }[]>();
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
  }, [activeCategory, activeCategoryIssues, severityIssues, categoryScoreColor]);

  const effectiveSkinLens: AuraSkinLens = activeSkinLens ?? "texture";

  const activeSkinLensMeta = useMemo(
    () =>
      CATEGORY_STORY.skinHealth.lenses.find(
        (l) => auraSkinLensFromLabel(l.label) === effectiveSkinLens,
      ),
    [effectiveSkinLens],
  );

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
    if (activeCategory !== "skinHealth") return findingsGroups;
    const lensIssues = collectIssuesForSkinLens(
      effectiveSkinLens,
      activeCategoryIssues,
      severityIssues,
    );
    return [
      {
        section: AURA_SKIN_LENS_LABELS[effectiveSkinLens],
        sectionDetail: activeSkinLensMeta?.detail,
        lensKey: effectiveSkinLens,
        items: lensIssues.map((issue) => ({
          issue,
          vis: issueSeverityVisual(issue, severityIssues, categoryScoreColor),
        })),
      },
    ];
  }, [
    activeCategory,
    findingsGroups,
    effectiveSkinLens,
    activeSkinLensMeta?.detail,
    activeCategoryIssues,
    severityIssues,
    categoryScoreColor,
  ]);

  const findingsEmpty = focusedFindingsGroups.every((g) => g.items.length === 0);

  const findingsSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeCategory !== "skinHealth" || panelCollapsed || rightView !== "analysis") {
      return;
    }
    findingsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [effectiveSkinLens, activeCategory, panelCollapsed, rightView]);

  const planItems = client.discussedItems ?? [];
  const planItemMeta = (item: DiscussedItem) => {
    const parts = [
      getTreatmentPlanRowSecondaryLabel(item, { omitTimeline: false }),
      item.brand ? `Brand: ${item.brand}` : null,
      item.quantity ? `Qty: ${item.quantity}` : null,
      item.region ? `Region: ${item.region}` : null,
    ].filter(Boolean);
    return parts.join(" · ");
  };

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
              {onOpenPlanBuilder ? (
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
                  Current plan items
                </p>
              </div>
              {planItems.length === 0 ? (
                <p className="aura-embedded-panel__empty">
                  No plan items yet. Use the plan builder to add treatment details.
                </p>
              ) : (
                <ul className="aura-embedded-panel__plan-list">
                  {planItems.map((item) => {
                    const meta = planItemMeta(item);
                    return (
                      <li key={item.id} className="aura-embedded-panel__plan-item">
                        <div className="aura-embedded-panel__plan-item-top">
                          <span className="aura-embedded-panel__plan-item-name">
                            {getTreatmentPlanRowPrimaryLabel(item)}
                          </span>
                          {item.timeline ? (
                            <span className="aura-embedded-panel__plan-item-count">
                              {item.timeline}
                            </span>
                          ) : null}
                        </div>
                        {meta ? (
                          <p className="aura-embedded-panel__plan-item-meta">
                            {meta}
                          </p>
                        ) : null}
                        {item.findings && item.findings.length > 0 ? (
                          <div className="aura-embedded-panel__plan-item-issues">
                            {item.findings.slice(0, 3).map((issue) => (
                              <span key={issue} className="aura-embedded-panel__plan-item-issue">
                                {issue}
                              </span>
                            ))}
                            {item.findings.length > 3 ? (
                              <span className="aura-embedded-panel__plan-item-issue aura-embedded-panel__plan-item-issue--more">
                                +{item.findings.length - 3}
                              </span>
                            ) : null}
                          </div>
                        ) : item.interest ? (
                          <div className="aura-embedded-panel__plan-item-issues">
                            <span className="aura-embedded-panel__plan-item-issue">
                              {item.interest}
                            </span>
                          </div>
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
                  {activeCategory === "skinHealth"
                    ? skinLensFocusSubheading(
                        effectiveSkinLens,
                        activeSkinLensMeta?.detail,
                      )
                    : CATEGORY_DESCRIPTIONS[activeCategory]}
                </p>
              </div>

              <AuraCategoryRadarCard
                activeCat={activeCat}
                categoryAccent={categoryScoreColor}
                radarDataOverride={skinLensRadarData}
                skinLensPolarArea={!!skinLensRadarData}
                activeSkinLens={
                  activeCategory === "skinHealth" ? effectiveSkinLens : undefined
                }
                chartAriaLabel={
                  skinLensRadarData
                    ? `Skin scan lens chart; ${AURA_SKIN_LENS_LABELS[effectiveSkinLens]} selected`
                    : undefined
                }
              />

              {activeCategory !== "skinHealth" ? (
                <div className="aura-embedded-panel__analysis-story">
                  <p className="aura-embedded-panel__analysis-story-text">
                    {categoryStory.text}
                  </p>
                  <div
                    className="aura-embedded-panel__analysis-chip-row aura-embedded-panel__analysis-chip-row--lenses"
                    aria-label={`${activeTab?.label ?? activeCat.name} scan lenses`}
                  >
                    {categoryStory.lenses.map((lens) => (
                      <span
                        key={lens.label}
                        className="aura-embedded-panel__analysis-chip aura-embedded-panel__analysis-chip--lens"
                        title={lens.detail}
                      >
                        <span
                          className="aura-embedded-panel__analysis-chip-dot"
                          style={{ background: categoryScoreColor }}
                          aria-hidden
                        />
                        {lens.label}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div
                ref={findingsSectionRef}
                className="aura-embedded-panel__issues-section"
              >
                <h4 className="aura-embedded-panel__issues-heading">
                  Findings
                </h4>
                {activeCategory === "skinHealth" ? (
                  <p className="aura-embedded-panel__issues-subheading">
                    Issues detected for this scan lens.
                  </p>
                ) : null}
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
                        <h5 className="aura-embedded-panel__issue-group-title">
                          <span
                            className="aura-embedded-panel__issue-group-lens"
                            style={
                              group.lensKey
                                ? ({
                                    color: AURA_SKIN_LENS_COLORS[group.lensKey],
                                  } as CSSProperties)
                                : undefined
                            }
                          >
                            {activeCategory === "skinHealth" ? "Detected issues" : group.section}
                          </span>
                          {activeCategory !== "skinHealth" && group.sectionDetail ? (
                            <span className="aura-embedded-panel__issue-group-detail">
                              {group.sectionDetail}
                            </span>
                          ) : null}
                        </h5>
                        <ul className="aura-embedded-panel__issues">
                          {group.items.map(({ issue, vis }) => {
                            const isOnFace = isIssueOnFace(highlightTerms, issue);
                            const findingColor = vis.hasSeverityPayload ? vis.color : categoryScoreColor;
                            const matchedLenses = lensesForFinding(
                              activeCategory,
                              group.section,
                              issue,
                            );
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
                                  <span
                                    className="aura-embedded-panel__issue-dot"
                                    style={{ background: findingColor }}
                                    aria-hidden
                                  />
                                  <div className="aura-embedded-panel__issue-text">
                                    <span className="aura-embedded-panel__issue-name">{issue}</span>
                                    {(vis.severityLevel ||
                                      vis.healthScore != null ||
                                      ((activeCategory !== "skinHealth" || !group.lensKey) &&
                                        matchedLenses.length > 0)) ? (
                                      <span className="aura-embedded-panel__issue-meta">
                                        {vis.severityLevel || vis.healthScore != null ? (
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
                                        {activeCategory !== "skinHealth" || !group.lensKey
                                          ? matchedLenses.slice(0, 2).map((lens) => (
                                              <span
                                                key={lens.label}
                                                className="aura-embedded-panel__issue-lens"
                                                title={lens.detail}
                                              >
                                                {lens.label}
                                              </span>
                                            ))
                                          : null}
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
