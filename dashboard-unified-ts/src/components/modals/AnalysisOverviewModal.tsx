// Analysis Overview Modal – high-level scores, categories, areas (desktop-optimized)
// Supports drill-down into category detail and area detail views.

import { useMemo, useState, useEffect, useRef } from "react";
import {
  AreaThemeFeatureRow,
  SubScoreFeatureRow,
} from "../analysisOverview/FeatureBreakdownRows";
import { useDashboard } from "../../context/DashboardContext";
import { Client, DiscussedItem } from "../../types";
import {
  fetchTableRecords,
  fetchAIAssessment,
  fetchCategoryAssessment,
  fetchPatientRecords,
  parsePatientRecordsToCards,
  type PatientSuggestionCard,
} from "../../services/api";
import {
  CATEGORIES,
  AREAS,
  normalizeIssue,
  computeCategories,
  computeOverall,
  computeAreas,
  scoreTier,
  tierColor,
  tierLabel,
  summarizeAreaThemes,
  generateAssessment,
  getCategoryDescriptionForPatient,
  getAreaDescriptionForPatient,
  type CategoryResult,
  type AreaResult,
} from "../../config/analysisOverviewConfig";
import {
  getDetectedIssuesFromClient,
  getInterestAreaNamesFromClient,
} from "../../utils/analysisOverviewClient";
import {
  getQuantityContext,
  getTreatmentsForInterest,
} from "./DiscussedTreatmentsModal/utils";
import {
  REGION_OPTIONS,
  TIMELINE_OPTIONS,
  isEnergyTreatmentCategory,
} from "./DiscussedTreatmentsModal/constants";
import {
  SUGGESTION_TO_ISSUES,
  SUGGESTION_TO_AREA,
} from "./DiscussedTreatmentsModal/suggestionsMapping";
import { groupIssuesByConcern } from "../../config/issueToConcernMapping";
import type {
  TreatmentPlanAddDirectOptions,
  TreatmentPlanPrefill,
} from "./DiscussedTreatmentsModal/TreatmentPhotos";
import PhotoViewerModal from "./PhotoViewerModal";
import TreatmentPhotosModal from "./TreatmentPhotosModal";
import { AiSparkleLogo, GeminiWordmark } from "../ai/AiGeminiBrand";
import { RadarChart } from "../postVisitBlueprint/RadarChart";
import "./AnalysisOverviewModal.css";

// ---------------------------------------------------------------------------
// TypewriterText – animates char-by-char, with parent-level dedup to prevent
// replay when navigating back from drill-down views.
// ---------------------------------------------------------------------------
function TypewriterText({
  text,
  speed = 25,
  enabled = true,
  animatedKeysRef,
}: {
  text: string;
  speed?: number;
  enabled?: boolean;
  animatedKeysRef?: React.MutableRefObject<Set<string>>;
}) {
  const alreadyPlayed =
    animatedKeysRef && animatedKeysRef.current.has(text);
  const shouldAnimate = enabled && !alreadyPlayed;
  const [displayed, setDisplayed] = useState(shouldAnimate ? "" : text);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!shouldAnimate || hasAnimated.current) {
      setDisplayed(text);
      return;
    }
    hasAnimated.current = true;
    if (animatedKeysRef) animatedKeysRef.current.add(text);
    let idx = 0;
    setDisplayed("");
    const timer = setInterval(() => {
      idx++;
      setDisplayed(text.slice(0, idx));
      if (idx >= text.length) clearInterval(timer);
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed, shouldAnimate, animatedKeysRef]);

  return (
    <span className="ao-typewriter">
      {displayed}
      {shouldAnimate && displayed.length < text.length && (
        <span className="ao-typewriter__cursor" aria-hidden>|</span>
      )}
    </span>
  );
}

function OverviewSectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="analysis-overview-modal__area-group-title">
      <span className="analysis-overview-modal__area-group-title-inner">
        <AiSparkleLogo size={14} className="ao-ai-logo" />
        <span>{children}</span>
        <GeminiWordmark />
      </span>
    </h3>
  );
}

export type DetailView =
  | null
  | { type: "category"; key: string }
  | { type: "area"; name: string }
  | { type: "areas" };

interface AnalysisOverviewModalProps {
  client: Client;
  onClose: () => void;
  onAddToPlanDirect?: (
    prefill: TreatmentPlanPrefill,
    options?: TreatmentPlanAddDirectOptions,
  ) => Promise<void | DiscussedItem> | DiscussedItem | void;
  initialDetailView?: DetailView | null;
}

// ---------------------------------------------------------------------------
// ScoreGauge – used ONLY for the single overall score
// ---------------------------------------------------------------------------
function ScoreGauge({
  score,
  size = 120,
  strokeWidth = 10,
  animate,
  label,
  className,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
  animate: boolean;
  label?: string;
  className?: string;
}) {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = animate ? (score / 100) * circumference : 0;
  const offset = circumference - progress;
  const color = tierColor(scoreTier(score));

  return (
    <div className={`ao-modal-gauge ${className ?? ""}`.trim()} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(0,0,0,0.08)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{
            transition: animate
              ? "stroke-dashoffset 1.2s ease-out"
              : "none",
          }}
        />
      </svg>
      <div className="ao-modal-gauge__inner">
        <span className="ao-modal-gauge__value">{animate ? score : 0}</span>
        {label && <span className="ao-modal-gauge__label">{label}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Horizontal bar for scores (replaces circular gauges on categories)
// ---------------------------------------------------------------------------
function ScoreBar({
  label,
  score,
  animate,
}: {
  label: string;
  score: number;
  animate: boolean;
}) {
  const color = tierColor(scoreTier(score));
  return (
    <div className="ao-score-bar">
      <div className="ao-score-bar__header">
        <span className="ao-score-bar__label">{label}</span>
        <span className="ao-score-bar__score" style={{ color }}>
          {score}
        </span>
      </div>
      <div className="ao-score-bar__track">
        <div
          className="ao-score-bar__fill"
          style={{
            width: animate ? `${score}%` : "0%",
            background: color,
            transition: animate ? "width 0.8s ease-out" : "none",
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CategoryCard – horizontal bar header, expand for radar + sub-scores
// ---------------------------------------------------------------------------
function CategoryCard({
  cat,
  isOpen,
  onToggle,
  animate,
  onExploreDetails,
}: {
  cat: CategoryResult;
  isOpen: boolean;
  onToggle: () => void;
  animate: boolean;
  onExploreDetails: (categoryKey: string) => void;
}) {
  const color = tierColor(scoreTier(cat.score));

  return (
    <div
      className={`ao-modal-cat-card ${isOpen ? "ao-modal-cat-card--open" : ""}`}
    >
      <button
        className="ao-modal-cat-card__header"
        onClick={onToggle}
        type="button"
        aria-expanded={isOpen}
        aria-label={`${cat.scoreLabel}, ${cat.score}. ${isOpen ? "Collapse" : "Expand"} breakdown`}
      >
        <div className="ao-modal-cat-card__header-left">
          <span className="ao-modal-cat-card__name">{cat.scoreLabel}</span>
        </div>
        <div className="ao-modal-cat-card__header-right">
          <div className="ao-modal-cat-card__bar-wrap">
            <div className="ao-modal-cat-card__bar-track">
              <div
                className="ao-modal-cat-card__bar-fill"
                style={{
                  width: animate ? `${cat.score}%` : "0%",
                  background: color,
                  transition: animate ? "width 0.8s ease-out" : "none",
                }}
              />
            </div>
            <span className="ao-modal-cat-card__score" style={{ color }}>
              {cat.score}
            </span>
          </div>
          <span className="ao-modal-cat-card__chev" aria-hidden>
            {isOpen ? "▲" : "▼"}
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="ao-modal-cat-card__body">
          {cat.subScores.length >= 3 && (
            <RadarChart
              data={cat.subScores.map((s) => ({ name: s.name, score: s.score }))}
              size={168}
              animate={animate}
            />
          )}
          {/* Skip stacked bars when radar already shows the same dimensions */}
          {cat.subScores.length < 3 && (
            <div className="ao-modal-cat-card__bars">
              {cat.subScores.map((s) => (
                <ScoreBar
                  key={s.name}
                  label={s.name}
                  score={s.score}
                  animate={animate}
                />
              ))}
            </div>
          )}
          <button
            type="button"
            className="ao-modal-cat-card__explore"
            onClick={(e) => {
              e.stopPropagation();
              onExploreDetails(cat.key);
            }}
          >
            Explore →
          </button>
        </div>
      )}
    </div>
  );
}

function AreaCard({
  area,
  onExploreDetails,
}: {
  area: AreaResult;
  onExploreDetails: (areaName: string) => void;
}) {
  const color = tierColor(area.tier);

  return (
    <button
      type="button"
      className="ao-modal-area-card"
      onClick={() => onExploreDetails(area.name)}
    >
      <div className="ao-modal-area-card__left">
        <span className="ao-modal-area-card__dot" style={{ background: color }} />
        <span className="ao-modal-area-card__name">{area.name}</span>
      </div>
      <span className="ao-modal-area-card__chev" aria-hidden>→</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// TierLegend – single shared legend for area tier colors
// ---------------------------------------------------------------------------
function TierLegend() {
  return (
    <div className="analysis-overview-modal__area-dot-legend">
      <span className="analysis-overview-modal__area-legend-item">
        <span className="analysis-overview-modal__area-legend-dot" style={{ background: tierColor("excellent") }} />
        Excellent
      </span>
      <span className="analysis-overview-modal__area-legend-item">
        <span className="analysis-overview-modal__area-legend-dot" style={{ background: tierColor("good") }} />
        Very Good
      </span>
      <span className="analysis-overview-modal__area-legend-item">
        <span className="analysis-overview-modal__area-legend-dot" style={{ background: tierColor("moderate") }} />
        Good
      </span>
      <span className="analysis-overview-modal__area-legend-item">
        <span className="analysis-overview-modal__area-legend-dot" style={{ background: tierColor("attention") }} />
        Needs Attention
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Suggestion card – recommender-style treatment card for drill-down views
// ---------------------------------------------------------------------------
const TIMELINE_OPTIONS_ADD = TIMELINE_OPTIONS.filter((t) => t !== "Completed");

function SuggestionCard({
  card,
  detectedIssues,
  discussedItems,
  onAddToPlanDirect,
  providerCode,
  onViewExamples,
}: {
  card: PatientSuggestionCard;
  detectedIssues: Set<string>;
  discussedItems?: DiscussedItem[];
  onAddToPlanDirect?: (
    prefill: TreatmentPlanPrefill,
    options?: TreatmentPlanAddDirectOptions,
  ) => Promise<void | DiscussedItem> | DiscussedItem | void;
  providerCode?: string;
  onViewExamples: (interest: string) => void;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const treatments = useMemo(
    () => getTreatmentsForInterest(card.suggestionName, providerCode),
    [card.suggestionName, providerCode],
  );
  const [what, setWhat] = useState(treatments[0] ?? "");
  const [when, setWhen] = useState(TIMELINE_OPTIONS_ADD[0] ?? "Now");
  const [where, setWhere] = useState<string[]>([]);
  const [product, setProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");

  const issuesList = useMemo(() => {
    const fromMapping = SUGGESTION_TO_ISSUES[card.suggestionName] ?? [];
    if (fromMapping.length > 0) return fromMapping;
    if (card.issuesString) {
      return card.issuesString.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return [];
  }, [card.suggestionName, card.issuesString]);

  const breakdownRows = useMemo(
    () => groupIssuesByConcern(issuesList),
    [issuesList],
  );

  const onPlan = useMemo(() => {
    if (!discussedItems?.length) return false;
    return discussedItems.some(
      (i) =>
        (i.interest?.trim().toLowerCase() ?? "") ===
        card.suggestionName.trim().toLowerCase(),
    );
  }, [discussedItems, card.suggestionName]);

  const isSkincare = what === "Skincare";
  const showWhereRow = !isSkincare && !isEnergyTreatmentCategory(what);

  const openForm = () => {
    setWhat(treatments[0] ?? "");
    setWhen(TIMELINE_OPTIONS_ADD[0] ?? "Now");
    setWhere([]);
    setProduct("");
    setNotes("");
    setQuantity(
      isSkincare
        ? ""
        : getQuantityContext(treatments[0] ?? "", undefined).defaultQuantity,
    );
    setFormOpen(true);
  };

  useEffect(() => {
    if (!formOpen || isSkincare) return;
    const qtyCtx = getQuantityContext(what, product.trim() || undefined);
    if (qtyCtx.quantityControl === "text") return;
    const { options, defaultQuantity } = qtyCtx;
    const q = quantity.trim();
    if (q && options.includes(q)) return;
    const next = defaultQuantity;
    if (q !== next) setQuantity(next);
  }, [formOpen, isSkincare, what, product, quantity]);

  const handleConfirm = async () => {
    if (!onAddToPlanDirect) return;
    const region =
      isSkincare || isEnergyTreatmentCategory(what)
        ? ""
        : where.length > 0
          ? where.join(", ")
          : (SUGGESTION_TO_AREA[card.suggestionName] ?? "");
    const prefill: TreatmentPlanPrefill = {
      interest: card.suggestionName,
      region,
      treatment: what,
      timeline: when,
      treatmentProduct: product.trim() || undefined,
      quantity: quantity.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    setSaving(true);
    try {
      await onAddToPlanDirect(prefill);
      setFormOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const detectedForCard = useMemo(() => {
    const set = new Set(detectedIssues);
    if (card.issuesString) {
      card.issuesString
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((issue) => set.add(normalizeIssue(issue)));
    }
    return set;
  }, [detectedIssues, card.issuesString]);

  return (
    <div className="ao-suggestion-card">
      <div className="ao-suggestion-card__top">
        {card.photoUrl ? (
          <div className="ao-suggestion-card__photo-wrap">
            <img
              src={card.photoUrl}
              alt=""
              className="ao-suggestion-card__photo"
              loading="lazy"
            />
          </div>
        ) : null}
        <div className="ao-suggestion-card__main">
          <h4 className="ao-suggestion-card__title">{card.suggestionName}</h4>
          {card.shortSummary && (
            <p className="ao-suggestion-card__short-summary">
              {card.shortSummary}
            </p>
          )}
          {card.aiSummary && (
            <details className="ao-suggestion-card__ai-details">
              <summary>Learn more</summary>
              <p className="ao-suggestion-card__ai-text">{card.aiSummary}</p>
            </details>
          )}

          {breakdownRows.length > 0 && (
            <div className="ao-suggestion-card__breakdown">
              <h5 className="ao-suggestion-card__breakdown-title">
                Feature breakdown
              </h5>
              {breakdownRows.map((row) => (
                <SubScoreFeatureRow
                  key={row.label}
                  variant="minimal"
                  subScore={{
                    name: row.label,
                    score: (() => {
                      const bad = row.issues.filter((i) =>
                        detectedForCard.has(normalizeIssue(i)),
                      ).length;
                      return row.issues.length > 0
                        ? Math.round(
                            ((row.issues.length - bad) / row.issues.length) *
                              100,
                          )
                        : 100;
                    })(),
                    total: row.issues.length,
                    detected: row.issues.filter((i) =>
                      detectedForCard.has(normalizeIssue(i)),
                    ).length,
                  }}
                  issues={row.issues}
                  detectedIssues={detectedForCard}
                  animate={true}
                />
              ))}
            </div>
          )}

          <div className="ao-suggestion-card__actions">
            {onPlan && !formOpen ? (
              <div className="ao-suggestion-card__added-row">
                <span className="ao-suggestion-card__added">✓ Added to plan</span>
                {onAddToPlanDirect && (
                  <button
                    type="button"
                    className="ao-suggestion-card__add-btn ao-suggestion-card__add-btn--subtle"
                    onClick={openForm}
                  >
                    Add again
                  </button>
                )}
              </div>
            ) : formOpen ? (
              <div className="ao-suggestion-card__add-form">
                {treatments.length > 1 && (
                  <div className="ao-suggestion-card__form-row">
                    <span>Type</span>
                    <div className="ao-suggestion-card__chips">
                      {treatments.map((t) => (
                        <button
                          key={t}
                          type="button"
                          className={`ao-suggestion-card__chip${what === t ? " ao-suggestion-card__chip--selected" : ""}`}
                          onClick={() => setWhat(t)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {showWhereRow && (
                  <div className="ao-suggestion-card__form-row">
                    <span>Where</span>
                    <div className="ao-suggestion-card__chips">
                      {REGION_OPTIONS.filter(
                        (r) => r !== "Multiple" && r !== "Other",
                      ).map((r) => (
                        <button
                          key={r}
                          type="button"
                          className={`ao-suggestion-card__chip${where.includes(r) ? " ao-suggestion-card__chip--selected" : ""}`}
                          onClick={() =>
                            setWhere((prev) =>
                              prev.includes(r)
                                ? prev.filter((x) => x !== r)
                                : [...prev, r],
                            )
                          }
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="ao-suggestion-card__form-row">
                  <span>When</span>
                  <div className="ao-suggestion-card__chips">
                    {TIMELINE_OPTIONS_ADD.map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={`ao-suggestion-card__chip${when === t ? " ao-suggestion-card__chip--selected" : ""}`}
                        onClick={() => setWhen(t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                {!isSkincare && (() => {
                  const qtyCtx = getQuantityContext(what, product.trim() || undefined);
                  return (
                    <div className="ao-suggestion-card__form-row">
                      <span>{qtyCtx.unitLabel}</span>
                      {qtyCtx.quantityControl === "text" ? (
                        <input
                          type="text"
                          inputMode="numeric"
                          className="ao-suggestion-card__select"
                          aria-label={qtyCtx.unitLabel}
                          placeholder={qtyCtx.defaultQuantity}
                          value={quantity}
                          onChange={(e) =>
                            setQuantity(e.target.value.replace(/\D/g, ""))
                          }
                        />
                      ) : (
                        <select
                          className="ao-suggestion-card__select"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                        >
                          {qtyCtx.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })()}
                <details className="ao-suggestion-card__opt-details">
                  <summary>Optional details</summary>
                  <div className="ao-suggestion-card__opt-fields">
                    <label className="ao-suggestion-card__field-label">
                      Product
                      <input
                        type="text"
                        className="ao-suggestion-card__field-input"
                        placeholder="e.g. Juvederm, Botox"
                        value={product}
                        onChange={(e) => setProduct(e.target.value)}
                      />
                    </label>
                    <label className="ao-suggestion-card__field-label">
                      Notes
                      <textarea
                        className="ao-suggestion-card__field-textarea"
                        placeholder="Optional notes"
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </label>
                  </div>
                </details>
                <div className="ao-suggestion-card__form-actions">
                  <button
                    type="button"
                    className="ao-suggestion-card__confirm-btn"
                    disabled={saving || !onAddToPlanDirect}
                    onClick={() => void handleConfirm()}
                  >
                    {saving ? "Adding…" : "Confirm"}
                  </button>
                  <button
                    type="button"
                    className="ao-suggestion-card__cancel-btn"
                    disabled={saving}
                    onClick={() => setFormOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : onAddToPlanDirect ? (
              <button
                type="button"
                className="ao-suggestion-card__add-btn"
                onClick={openForm}
              >
                Add to plan
              </button>
            ) : null}
            <button
              type="button"
              className="ao-suggestion-card__examples-btn"
              onClick={() => onViewExamples(card.suggestionName)}
            >
              View examples
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DrillDownSuggestions – recommender-style treatment cards for a drill-down
// ---------------------------------------------------------------------------
function DrillDownSuggestions({
  suggestionCards,
  detectedIssueNames,
  detectedIssues,
  discussedItems,
  onAddToPlanDirect,
  providerCode,
  client,
}: {
  suggestionCards: PatientSuggestionCard[];
  detectedIssueNames: string[];
  detectedIssues: Set<string>;
  discussedItems?: DiscussedItem[];
  onAddToPlanDirect?: (
    prefill: TreatmentPlanPrefill,
    options?: TreatmentPlanAddDirectOptions,
  ) => Promise<void | DiscussedItem> | DiscussedItem | void;
  providerCode?: string;
  client: Client;
}) {
  const [photoExplorerInterest, setPhotoExplorerInterest] = useState<string | null>(null);

  const relevantCards = useMemo(() => {
    if (suggestionCards.length === 0 || detectedIssueNames.length === 0)
      return [];
    const detectedSet = new Set(detectedIssueNames.map(normalizeIssue));
    return suggestionCards.filter((card) => {
      const suggIssues = SUGGESTION_TO_ISSUES[card.suggestionName] ?? [];
      if (suggIssues.length > 0) {
        return suggIssues.some((i) => detectedSet.has(normalizeIssue(i)));
      }
      if (card.issuesString) {
        return card.issuesString
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .some((i) => detectedSet.has(normalizeIssue(i)));
      }
      return false;
    });
  }, [suggestionCards, detectedIssueNames]);

  if (relevantCards.length === 0) return null;

  return (
    <>
      <section className="ao-detail__section">
        <h3 className="ao-detail__section-title">Suggested treatments</h3>
        <p className="ao-detail__treatments-intro">
          Based on the findings above, here are some approaches that could help
          address these concerns.
        </p>
        <div className="ao-suggestion-cards">
          {relevantCards.map((card) => (
            <SuggestionCard
              key={card.id}
              card={card}
              detectedIssues={detectedIssues}
              discussedItems={discussedItems}
              onAddToPlanDirect={onAddToPlanDirect}
              providerCode={providerCode}
              onViewExamples={setPhotoExplorerInterest}
            />
          ))}
        </div>
      </section>
      {photoExplorerInterest && client && (
        <TreatmentPhotosModal
          client={client}
          interest={photoExplorerInterest}
          selectedRegion={SUGGESTION_TO_AREA[photoExplorerInterest]}
          onClose={() => setPhotoExplorerInterest(null)}
          onAddToPlanDirect={onAddToPlanDirect}
          planItems={client.discussedItems ?? []}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// CategoryDetailContent (drill-down)
// ---------------------------------------------------------------------------
function CategoryDetailContent({
  categoryKey,
  detectedIssues,
  onBack,
  discussedItems,
  onAddToPlanDirect,
  providerCode,
  animatedKeysRef,
  suggestionCards,
  client,
}: {
  categoryKey: string;
  detectedIssues: Set<string>;
  onBack: () => void;
  discussedItems?: DiscussedItem[];
  onAddToPlanDirect?: (
    prefill: TreatmentPlanPrefill,
    options?: TreatmentPlanAddDirectOptions,
  ) => Promise<void | DiscussedItem> | DiscussedItem | void;
  providerCode?: string;
  animatedKeysRef: React.MutableRefObject<Set<string>>;
  suggestionCards: PatientSuggestionCard[];
  client: Client;
}) {
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 150);
    return () => clearTimeout(t);
  }, []);

  const categories = useMemo(
    () => computeCategories(detectedIssues),
    [detectedIssues],
  );
  const catResult = categories.find((c) => c.key === categoryKey);
  const catDef = CATEGORIES.find((c) => c.key === categoryKey);

  const detectedIssueNames = useMemo(() => {
    if (!catDef) return [];
    return catDef.subScores
      .flatMap((s) => s.issues)
      .filter((issue) => detectedIssues.has(normalizeIssue(issue)));
  }, [catDef, detectedIssues]);

  if (!catDef || !catResult) {
    return (
      <div className="ao-detail">
        <button type="button" className="ao-detail__back" onClick={onBack}>
          ← Back to Overview
        </button>
        <p className="ao-detail__empty">Category not found.</p>
      </div>
    );
  }

  const categoryDescription = getCategoryDescriptionForPatient(catResult);

  const [aiCatText, setAiCatText] = useState<string | null>(null);
  const [aiCatLoading, setAiCatLoading] = useState(false);

  const strengthIssueNames = useMemo(() => {
    if (!catDef) return [];
    return catDef.subScores
      .flatMap((s) => s.issues)
      .filter((issue) => !detectedIssues.has(normalizeIssue(issue)));
  }, [catDef, detectedIssues]);

  useEffect(() => {
    if (!catResult) return;
    let mounted = true;
    setAiCatLoading(true);
    fetchCategoryAssessment({
      categoryOrArea: catResult.name,
      score: catResult.score,
      tier: catResult.tier,
      subScores: catResult.subScores.map((s) => ({
        name: s.name,
        score: s.score,
        detected: s.detected,
        total: s.total,
      })),
      detectedIssues: detectedIssueNames,
      strengthIssues: strengthIssueNames,
    })
      .then((text) => {
        if (mounted) {
          setAiCatText(text);
          setAiCatLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setAiCatLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [catResult, detectedIssueNames, strengthIssueNames]);

  const displayCatAssessment = aiCatText || categoryDescription;
  const color = tierColor(catResult.tier);

  return (
    <div className="ao-detail">
      <button
        type="button"
        className="ao-detail__back"
        onClick={onBack}
        aria-label="Back to overview"
      >
        ← Back to Overview
      </button>

      <section className="ao-detail__hero ao-detail__hero--with-ai">
        <div className="ao-detail__hero-score">
          <span className="ao-detail__hero-score-number" style={{ color }}>
            {catResult.score}
          </span>
          <span className="ao-detail__hero-score-tier" style={{ color }}>
            {tierLabel(catResult.tier)}
          </span>
          <span className="ao-detail__hero-score-name">{catResult.scoreLabel}</span>
        </div>
        <div className="ao-detail__hero-ai">
          <div className="ao-detail__ai-header">
            <AiSparkleLogo size={14} className="ao-ai-logo" />
            <span className="ao-detail__ai-label">Aesthetic Intelligence</span>
            <GeminiWordmark />
          </div>
          {aiCatLoading ? (
            <div className="ao-ai-summary__loading">
              <span className="ao-ai-summary__shimmer" />
              <span className="ao-ai-summary__shimmer ao-ai-summary__shimmer--short" />
            </div>
          ) : (
            <p className="ao-detail__ai-text">
              <TypewriterText
                text={displayCatAssessment}
                speed={20}
                animatedKeysRef={animatedKeysRef}
              />
            </p>
          )}
        </div>
      </section>

      <section className="ao-detail__section">
        <h3 className="ao-detail__section-title ao-detail__section-title--with-ai">
          <span className="ao-detail__section-title-inner">
            <AiSparkleLogo size={13} className="ao-ai-logo" />
            <span>Feature Breakdown</span>
            <GeminiWordmark />
          </span>
        </h3>
        <div className="ao-detail__subscore-list">
          {catResult.subScores.map((s) => (
            <SubScoreFeatureRow
              key={s.name}
              variant="minimal"
              subScore={s}
              issues={
                CATEGORIES.find((c) => c.key === categoryKey)?.subScores.find(
                  (ss) => ss.name === s.name,
                )?.issues || []
              }
              detectedIssues={detectedIssues}
              animate={animate}
            />
          ))}
        </div>
      </section>

      <DrillDownSuggestions
        suggestionCards={suggestionCards}
        detectedIssueNames={detectedIssueNames}
        detectedIssues={detectedIssues}
        discussedItems={discussedItems}
        onAddToPlanDirect={onAddToPlanDirect}
        providerCode={providerCode}
        client={client}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// AreaDetailContent (drill-down)
// ---------------------------------------------------------------------------
function AreaDetailContent({
  areaName,
  detectedIssues,
  interestAreaNames,
  onBack,
  discussedItems,
  onAddToPlanDirect,
  providerCode,
  animatedKeysRef,
  suggestionCards,
  client,
}: {
  areaName: string;
  detectedIssues: Set<string>;
  interestAreaNames: Set<string>;
  onBack: () => void;
  discussedItems?: DiscussedItem[];
  onAddToPlanDirect?: (
    prefill: TreatmentPlanPrefill,
    options?: TreatmentPlanAddDirectOptions,
  ) => Promise<void | DiscussedItem> | DiscussedItem | void;
  providerCode?: string;
  animatedKeysRef: React.MutableRefObject<Set<string>>;
  suggestionCards: PatientSuggestionCard[];
  client: Client;
}) {
  const areaResults = useMemo(
    () => computeAreas(detectedIssues, interestAreaNames),
    [detectedIssues, interestAreaNames],
  );
  const areaResult = areaResults.find((a) => a.name === areaName);
  const areaDef = AREAS.find((a) => a.name === areaName);
  const themes = useMemo(
    () => summarizeAreaThemes(areaName, detectedIssues),
    [areaName, detectedIssues],
  );

  const detectedIssueNames = useMemo(() => {
    if (!areaDef) return [];
    return areaDef.issues.filter((issue) =>
      detectedIssues.has(normalizeIssue(issue)),
    );
  }, [areaDef, detectedIssues]);

  if (!areaDef || !areaResult) {
    return (
      <div className="ao-detail">
        <button type="button" className="ao-detail__back" onClick={onBack}>
          ← Back to Overview
        </button>
        <p className="ao-detail__empty">Area not found.</p>
      </div>
    );
  }

  const areaDescription = getAreaDescriptionForPatient(areaResult);

  const [aiAreaText, setAiAreaText] = useState<string | null>(null);
  const [aiAreaLoading, setAiAreaLoading] = useState(false);

  const strengthIssueNames = useMemo(() => {
    if (!areaDef) return [];
    return areaDef.issues.filter(
      (issue) => !detectedIssues.has(normalizeIssue(issue)),
    );
  }, [areaDef, detectedIssues]);

  useEffect(() => {
    if (!areaResult) return;
    let mounted = true;
    setAiAreaLoading(true);
    fetchCategoryAssessment({
      categoryOrArea: areaResult.name,
      score: areaResult.score,
      tier: areaResult.tier,
      subScores: themes.map((t) => ({
        name: t.label,
        score:
          t.totalCount > 0
            ? Math.round(
                ((t.totalCount - t.detectedCount) / t.totalCount) * 100,
              )
            : 100,
        detected: t.detectedCount,
        total: t.totalCount,
      })),
      detectedIssues: detectedIssueNames,
      strengthIssues: strengthIssueNames,
    })
      .then((text) => {
        if (mounted) {
          setAiAreaText(text);
          setAiAreaLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setAiAreaLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [areaResult, themes, detectedIssueNames, strengthIssueNames]);

  const displayAreaAssessment = aiAreaText || areaDescription;
  const color = tierColor(areaResult.tier);

  return (
    <div className="ao-detail">
      <button
        type="button"
        className="ao-detail__back"
        onClick={onBack}
        aria-label="Back to overview"
      >
        ← Back to Overview
      </button>

      <section className="ao-detail__hero ao-detail__hero--with-ai">
        <div className="ao-detail__hero-score">
          <span className="ao-detail__hero-score-number" style={{ color }}>
            {areaResult.score}
          </span>
          <span className="ao-detail__hero-score-tier" style={{ color }}>
            {tierLabel(areaResult.tier)}
          </span>
          <span className="ao-detail__hero-score-name">{areaResult.name}</span>
        </div>
        <div className="ao-detail__hero-ai">
          <div className="ao-detail__ai-header">
            <AiSparkleLogo size={14} className="ao-ai-logo" />
            <span className="ao-detail__ai-label">Aesthetic Intelligence</span>
            <GeminiWordmark />
          </div>
          {aiAreaLoading ? (
            <div className="ao-ai-summary__loading">
              <span className="ao-ai-summary__shimmer" />
              <span className="ao-ai-summary__shimmer ao-ai-summary__shimmer--short" />
            </div>
          ) : (
            <p className="ao-detail__ai-text">
              <TypewriterText
                text={displayAreaAssessment}
                speed={20}
                animatedKeysRef={animatedKeysRef}
              />
            </p>
          )}
        </div>
      </section>

      <section className="ao-detail__section">
        <h3 className="ao-detail__section-title ao-detail__section-title--with-ai">
          <span className="ao-detail__section-title-inner">
            <AiSparkleLogo size={13} className="ao-ai-logo" />
            <span>Feature Breakdown</span>
            <GeminiWordmark />
          </span>
        </h3>
        <div className="ao-detail__subscore-list">
          {themes.map((theme) => (
            <AreaThemeFeatureRow
              key={theme.label}
              variant="minimal"
              theme={theme}
              detectedIssues={detectedIssues}
            />
          ))}
        </div>
      </section>

      <DrillDownSuggestions
        suggestionCards={suggestionCards}
        detectedIssueNames={detectedIssueNames}
        detectedIssues={detectedIssues}
        discussedItems={discussedItems}
        onAddToPlanDirect={onAddToPlanDirect}
        providerCode={providerCode}
        client={client}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------
export default function AnalysisOverviewModal({
  client,
  onClose,
  onAddToPlanDirect,
  initialDetailView,
}: AnalysisOverviewModalProps) {
  const { provider } = useDashboard();
  const [animate, setAnimate] = useState(false);
  const [detailView, setDetailView] = useState<DetailView>(null);
  const animatedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (initialDetailView !== undefined) {
      setDetailView(initialDetailView ?? null);
    }
  }, [initialDetailView]);

  const [clientFrontPhotoUrl, setClientFrontPhotoUrl] = useState<string | null>(
    null,
  );
  const [suggestionCards, setSuggestionCards] = useState<
    PatientSuggestionCard[]
  >([]);

  useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 350);
    return () => clearTimeout(t);
  }, []);

  // Load client front photo
  useEffect(() => {
    if (!client) {
      setClientFrontPhotoUrl(null);
      return;
    }
    const getUrl = (att: {
      thumbnails?: { large?: { url?: string }; full?: { url?: string } };
      url?: string;
    }) =>
      att?.thumbnails?.full?.url ||
      att?.thumbnails?.large?.url ||
      att?.url ||
      null;

    if (
      client.frontPhoto &&
      Array.isArray(client.frontPhoto) &&
      client.frontPhoto.length > 0
    ) {
      setClientFrontPhotoUrl(getUrl(client.frontPhoto[0]) || null);
    }

    if (client.tableSource === "Patients") {
      let mounted = true;
      fetchTableRecords("Patients", {
        filterFormula: `RECORD_ID() = "${client.id}"`,
        fields: ["Front Photo"],
      })
        .then((records) => {
          if (!mounted || records.length === 0) return;
          const fields = records[0].fields;
          const front =
            fields["Front Photo"] ||
            fields["Front photo"] ||
            fields["frontPhoto"];
          if (front && Array.isArray(front) && front.length > 0) {
            setClientFrontPhotoUrl(
              (prev) => prev || getUrl(front[0]) || null,
            );
          }
        })
        .catch(() => {});
      return () => {
        mounted = false;
      };
    }
  }, [client]);

  // Fetch patient-records for recommender-style suggestion cards
  useEffect(() => {
    const email = client?.email?.trim();
    if (!email) {
      setSuggestionCards([]);
      return;
    }
    let mounted = true;
    fetchPatientRecords(email)
      .then((records) => {
        if (mounted) setSuggestionCards(parsePatientRecordsToCards(records));
      })
      .catch(() => {
        if (mounted) setSuggestionCards([]);
      });
    return () => {
      mounted = false;
    };
  }, [client?.email]);

  const detectedIssues = useMemo(
    () => getDetectedIssuesFromClient(client),
    [client],
  );
  const interestAreaNames = useMemo(
    () => getInterestAreaNamesFromClient(client),
    [client],
  );

  const categories = useMemo(
    () => computeCategories(detectedIssues),
    [detectedIssues],
  );
  const overall = useMemo(() => computeOverall(categories), [categories]);

  const areaResults = useMemo(
    () => computeAreas(detectedIssues, interestAreaNames),
    [detectedIssues, interestAreaNames],
  );

  const focusAreas = areaResults
    .filter((a) => a.hasInterest)
    .sort((a, b) => a.score - b.score);
  const otherAreas = areaResults
    .filter((a) => !a.hasInterest)
    .sort((a, b) => a.score - b.score);
  const focusCount = focusAreas.length;

  const assessmentText = useMemo(
    () => generateAssessment(overall, categories, focusCount),
    [overall, categories, focusCount],
  );

  const [aiAssessmentText, setAiAssessmentText] = useState<string | null>(
    null,
  );
  const [aiAssessmentLoading, setAiAssessmentLoading] = useState(false);

  useEffect(() => {
    if (detectedIssues.size === 0) return;
    let mounted = true;
    setAiAssessmentLoading(true);
    const detectedList = Array.from(detectedIssues);
    fetchAIAssessment({
      overall,
      categories: categories.map((c) => ({
        name: c.name,
        score: c.score,
        tier: c.tier,
      })),
      focusCount,
      detectedIssues: detectedList,
    })
      .then((text) => {
        if (mounted) {
          setAiAssessmentText(text);
          setAiAssessmentLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setAiAssessmentLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [detectedIssues, overall, categories, focusCount]);

  const displayAssessment = aiAssessmentText || assessmentText;

  const hasAnyData = detectedIssues.size > 0;

  const showCategoryDetail = detailView?.type === "category";
  const showAreaDetail = detailView?.type === "area";
  const showAreasPage = detailView?.type === "areas";
  const [isMaximized, setIsMaximized] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [openCategoryKey, setOpenCategoryKey] = useState<string | null>(
    CATEGORIES[0]?.key ?? null,
  );

  const patientFirst = client.name ? client.name.split(" ")[0] : "";

  return (
    <div
      className="modal-overlay active"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ao-modal-title"
    >
      <div
        className={`modal-content analysis-overview-modal${isMaximized ? " analysis-overview-modal--maximized" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="analysis-overview-modal__header">
          <h2 id="ao-modal-title" className="analysis-overview-modal__title">
            {showCategoryDetail && detailView?.type === "category"
              ? (categories.find((c) => c.key === detailView.key)
                  ?.scoreLabel ?? detailView.key)
              : showAreaDetail && detailView?.type === "area"
                ? detailView.name
                : showAreasPage
                  ? "All Areas"
                  : `Facial Analysis${patientFirst ? ` — ${patientFirst}` : ""}`}
          </h2>
          <div className="analysis-overview-modal__header-actions">
            <button
              type="button"
              className="analysis-overview-modal__maximize"
              onClick={() => setIsMaximized(!isMaximized)}
              aria-label={isMaximized ? "Restore" : "Maximize"}
            >
              {isMaximized ? "⊡" : "⛶"}
            </button>
            <button
              type="button"
              className="modal-close analysis-overview-modal__close"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="analysis-overview-modal__body">
          {!hasAnyData ? (
            <div className="analysis-overview-modal__empty">
              No facial analysis data for this patient yet. Complete a facial
              analysis to see scores and categories here.
            </div>
          ) : showCategoryDetail && detailView?.type === "category" ? (
            <CategoryDetailContent
              categoryKey={detailView.key}
              detectedIssues={detectedIssues}
              onBack={() => setDetailView(null)}
              discussedItems={client.discussedItems}
              onAddToPlanDirect={onAddToPlanDirect}
              providerCode={provider?.code}
              animatedKeysRef={animatedKeysRef}
              suggestionCards={suggestionCards}
              client={client}
            />
          ) : showAreaDetail && detailView?.type === "area" ? (
            <AreaDetailContent
              areaName={detailView.name}
              detectedIssues={detectedIssues}
              interestAreaNames={interestAreaNames}
              onBack={() => setDetailView(null)}
              discussedItems={client.discussedItems}
              onAddToPlanDirect={onAddToPlanDirect}
              providerCode={provider?.code}
              animatedKeysRef={animatedKeysRef}
              suggestionCards={suggestionCards}
              client={client}
            />
          ) : showAreasPage ? (
            <div className="ao-detail">
              <button
                type="button"
                className="ao-detail__back"
                onClick={() => setDetailView(null)}
                aria-label="Back to overview"
              >
                ← Back to Overview
              </button>

              <TierLegend />

              <div className="analysis-overview-modal__areas-list">
                {areaResults
                  .sort((a, b) => a.score - b.score)
                  .map((a) => (
                    <AreaCard
                      key={a.name}
                      area={a}
                      onExploreDetails={(name) =>
                        setDetailView({ type: "area", name })
                      }
                    />
                  ))}
              </div>
            </div>
          ) : (
            <>
              {/* ===== Hero: Photo + Overall Score + AI Summary ===== */}
              <section className="ao-hero">
                {clientFrontPhotoUrl && (
                  <div
                    className="ao-hero__photo-wrap"
                    onClick={() => setShowPhotoViewer(true)}
                    role="button"
                    tabIndex={0}
                    aria-label="View patient photos"
                  >
                    <img
                      src={clientFrontPhotoUrl}
                      alt="Patient"
                      className="ao-hero__photo"
                    />
                    <span className="ao-hero__photo-overlay">View</span>
                  </div>
                )}
                <div className="ao-hero__gauge-wrap">
                  <ScoreGauge
                    score={overall}
                    size={120}
                    strokeWidth={10}
                    animate={animate}
                    label="Overall"
                  />
                </div>
                <div className="ao-hero__ai">
                  <div className="ao-hero__ai-brand">
                    <AiSparkleLogo
                      size={16}
                      className="ao-ai-summary__icon ao-ai-logo"
                    />
                    <span className="ao-ai-summary__label">
                      Aesthetic Intelligence
                    </span>
                    <GeminiWordmark />
                  </div>
                  {aiAssessmentLoading ? (
                    <div className="ao-ai-summary__loading">
                      <span className="ao-ai-summary__shimmer" />
                      <span className="ao-ai-summary__shimmer ao-ai-summary__shimmer--short" />
                    </div>
                  ) : (
                    <p className="ao-hero__ai-text">
                      <TypewriterText
                        text={displayAssessment}
                        speed={25}
                        animatedKeysRef={animatedKeysRef}
                      />
                    </p>
                  )}
                </div>
              </section>

              {/* ===== Category scores ===== */}
              <section className="analysis-overview-modal__categories">
                <div
                  className="analysis-overview-modal__categories-brand"
                  aria-label="AI-assisted category scores"
                >
                  <AiSparkleLogo size={14} className="ao-ai-logo" />
                  <span className="analysis-overview-modal__categories-brand-label">
                    Category scores
                  </span>
                  <GeminiWordmark />
                </div>
                <div className="analysis-overview-modal__cat-columns">
                  {categories.map((c) => (
                    <div
                      key={c.key}
                      className="analysis-overview-modal__cat-column"
                    >
                      <CategoryCard
                        cat={c}
                        isOpen={openCategoryKey === c.key}
                        onToggle={() =>
                          setOpenCategoryKey(
                            openCategoryKey === c.key ? null : c.key,
                          )
                        }
                        animate={animate}
                        onExploreDetails={(key) =>
                          setDetailView({ type: "category", key })
                        }
                      />
                    </div>
                  ))}
                </div>
              </section>

              {/* ===== Areas (merged with single legend) ===== */}
              {(focusAreas.length > 0 || otherAreas.length > 0) && (
                <section className="analysis-overview-modal__areas">
                  <OverviewSectionHeading>Areas</OverviewSectionHeading>
                  <TierLegend />

                  {focusAreas.length > 0 && (
                    <>
                      <span className="analysis-overview-modal__area-sub-label">
                        Client&apos;s focus areas
                      </span>
                      <div className="analysis-overview-modal__area-grid">
                        {focusAreas.map((a) => (
                          <AreaCard
                            key={a.name}
                            area={a}
                            onExploreDetails={(name) =>
                              setDetailView({ type: "area", name })
                            }
                          />
                        ))}
                      </div>
                    </>
                  )}

                  {otherAreas.length > 0 && (
                    <>
                      <span className="analysis-overview-modal__area-sub-label">
                        Other areas
                      </span>
                      <div className="analysis-overview-modal__area-grid">
                        {otherAreas.map((a) => (
                          <AreaCard
                            key={a.name}
                            area={a}
                            onExploreDetails={(name) =>
                              setDetailView({ type: "area", name })
                            }
                          />
                        ))}
                      </div>
                    </>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </div>
      {showPhotoViewer && client && (
        <PhotoViewerModal
          client={client}
          initialPhotoType="front"
          onClose={() => setShowPhotoViewer(false)}
        />
      )}
    </div>
  );
}
