// Analysis Overview Modal – high-level scores, categories, areas (desktop-optimized)
// Supports drill-down into category detail and area detail views.

import { useMemo, useState, useEffect, useRef } from "react";
import {
  AreaThemeFeatureRow,
  SubScoreFeatureRow,
} from "../analysisOverview/FeatureBreakdownRows";
import { useDashboard } from "../../context/DashboardContext";
import { Client, TreatmentPhoto } from "../../types";
import { fetchTreatmentPhotos, fetchTableRecords, fetchAIAssessment, fetchCategoryAssessment } from "../../services/api";
import type { AirtableRecord } from "../../services/api";
import {
  CATEGORIES,
  CATEGORY_DESCRIPTIONS,
  AREAS,
  normalizeIssue,
  computeCategories,
  computeOverall,
  computeAreas,
  scoreTier,
  tierColor,
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
import { getSuggestedTreatmentsForFindings } from "./DiscussedTreatmentsModal/utils";
import { TREATMENT_META } from "./DiscussedTreatmentsModal/constants";
import type { TreatmentPlanPrefill } from "./DiscussedTreatmentsModal/TreatmentPhotos";
import PhotoViewerModal from "./PhotoViewerModal";
import { AiSparkleLogo, GeminiWordmark } from "../ai/AiGeminiBrand";
import { RadarChart } from "../postVisitBlueprint/RadarChart";
import "./AnalysisOverviewModal.css";

/** Typewriter text – animates char-by-char on first render only */
function TypewriterText({
  text,
  speed = 25,
  enabled = true,
}: {
  text: string;
  speed?: number;
  enabled?: boolean;
}) {
  const [displayed, setDisplayed] = useState(enabled ? "" : text);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!enabled || hasAnimated.current) {
      setDisplayed(text);
      return;
    }
    hasAnimated.current = true;
    let idx = 0;
    setDisplayed("");
    const timer = setInterval(() => {
      idx++;
      setDisplayed(text.slice(0, idx));
      if (idx >= text.length) clearInterval(timer);
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed, enabled]);

  return (
    <span className="ao-typewriter">
      {displayed}
      {enabled && displayed.length < text.length && (
        <span className="ao-typewriter__cursor" aria-hidden>|</span>
      )}
    </span>
  );
}

/** Section titles that pair LLM-backed copy with AI + Gemini brand */
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
  /** When provided, "Add to plan" in detail views opens the treatment plan with this prefill (parent should close overview and open DiscussedTreatmentsModal). Second arg is current drill-down state so parent can reopen overview there when treatment plan closes. */
  onAddToPlan?: (prefill: TreatmentPlanPrefill, returnState?: DetailView) => void;
  /** If set, the modal opens with this detail view (e.g. after returning from treatment plan). */
  initialDetailView?: DetailView | null;
}

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

/** Map Airtable record to TreatmentPhoto (minimal fields for overview photo strip) */
function mapRecordToPhoto(record: AirtableRecord): TreatmentPhoto {
  const fields = record.fields;
  const photoAttachment = fields["Photo"];
  let photoUrl = "";
  let thumbnailUrl = "";
  if (Array.isArray(photoAttachment) && photoAttachment.length > 0) {
    const att = photoAttachment[0];
    photoUrl =
      att.thumbnails?.full?.url ||
      att.thumbnails?.large?.url ||
      att.url ||
      "";
    thumbnailUrl =
      att.thumbnails?.large?.url ||
      att.thumbnails?.small?.url ||
      att.url ||
      "";
  }
  const treatments = Array.isArray(fields["Name (from Treatments)"])
    ? fields["Name (from Treatments)"]
    : fields["Treatments"]
      ? [fields["Treatments"]]
      : [];
  const generalTreatments = Array.isArray(
    fields["Name (from General Treatments)"]
  )
    ? fields["Name (from General Treatments)"]
    : fields["General Treatments"]
      ? [fields["General Treatments"]]
      : [];
  const areaNames = fields["Area Names"]
    ? String(fields["Area Names"])
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean)
    : [];
  return {
    id: record.id,
    name: (fields["Name"] as string) || "",
    photoUrl,
    thumbnailUrl,
    treatments,
    generalTreatments,
    areaNames,
    caption: (fields["Caption"] as string) || undefined,
  };
}

/** Extract words (alpha) from text for relevance matching. */
function getWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

/**
 * Pick the single most relevant photo for this treatment + goal + finding.
 * Matches treatment type, then scores by how many goal/finding words appear in photo name/caption.
 */
function pickBestPhotoForTreatment(
  photos: TreatmentPhoto[],
  treatmentName: string,
  goal: string,
  exampleFinding: string
): TreatmentPhoto | null {
  if (!treatmentName.trim()) return null;
  const t = treatmentName.trim().toLowerCase();
  const candidates = photos.filter((p) => {
    if (!p.photoUrl) return false;
    const general = (p.generalTreatments || []).some((g) =>
      String(g).toLowerCase().includes(t)
    );
    const specific = (p.treatments || []).some((s) =>
      String(s).toLowerCase().includes(t)
    );
    const nameHasTreatment = (p.name || "").toLowerCase().includes(t);
    return general || specific || nameHasTreatment;
  });
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const goalWords = new Set(getWords(goal));
  const findingWords = new Set(getWords(exampleFinding));
  const allKeywords = [...goalWords, ...findingWords];
  if (allKeywords.length === 0) return candidates[0];

  let best = candidates[0];
  let bestScore = 0;
  for (const p of candidates) {
    const text = `${p.name || ""} ${p.caption || ""}`.toLowerCase();
    const score = allKeywords.filter((kw) => text.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

/** Short "why this treatment" explanation from finding and goal – softer tone. */
function getWhyThisTreatment(
  exampleFinding: string,
  goal: string,
  treatment: string
): string {
  return `We noticed some ${exampleFinding.toLowerCase()} in this area, which is very common. ${treatment} is a gentle, effective approach to help with ${goal.toLowerCase()}.`;
}

/** Single treatment row: one relevant photo, why text, meta (longevity/downtime/price), Add to plan */
const TIMELINE_OPTIONS = ["Now", "Next Visit", "Wishlist"] as const;
type TimelineOption = typeof TIMELINE_OPTIONS[number];

function TreatmentRowContent({
  suggestion,
  bestPhoto,
  onAddToPlan,
}: {
  suggestion: { treatment: string; goal: string; region: string; exampleFinding: string };
  bestPhoto: TreatmentPhoto | null;
  onAddToPlan?: (prefill: TreatmentPlanPrefill) => void;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [addedTimeline, setAddedTimeline] = useState<TimelineOption | null>(null);
  // (inline confirmation is handled by addedTimeline state)
  const meta = TREATMENT_META[suggestion.treatment];
  const whyText = getWhyThisTreatment(
    suggestion.exampleFinding,
    suggestion.goal,
    suggestion.treatment
  );

  const handleAddWithTimeline = (timeline: TimelineOption) => {
    setShowTimeline(false);
    // Build the prefill for the inline confirmation
    const prefill: TreatmentPlanPrefill = {
      interest: suggestion.goal,
      region: suggestion.region,
      treatment: suggestion.treatment,
      findings: [suggestion.exampleFinding],
      timeline,
    };
    // Confirm inline – don't navigate away
    setAddedTimeline(timeline);
    // Notify parent for persistence (but parent should NOT close modal)
    onAddToPlan?.(prefill);
  };

  const handleRemove = () => {
    setAddedTimeline(null);
  };

  return (
    <>
      <div className="ao-detail__treatment-card">
        <div className="ao-detail__treatment-left">
          <div className="ao-detail__treatment-row">
            <div className="ao-detail__treatment-info">
              <span className="ao-detail__treatment-name">{suggestion.treatment}</span>
              <span className="ao-detail__treatment-meta">
                {suggestion.exampleFinding} · {suggestion.region}
              </span>
            </div>
          </div>
          <p className="ao-detail__treatment-why">{whyText}</p>
          {(meta?.longevity || meta?.downtime || meta?.priceRange) && (
            <div className="ao-detail__treatment-meta-line">
              {meta.longevity && <span>Longevity: {meta.longevity}</span>}
              {meta.downtime && <span>Downtime: {meta.downtime}</span>}
              {meta.priceRange && <span>Price: {meta.priceRange}</span>}
            </div>
          )}
          <div className="ao-detail__treatment-actions">
            {addedTimeline ? (
              <>
                <span className="ao-detail__treatment-added">
                  ✓ Added · {addedTimeline}
                </span>
                <button
                  type="button"
                  className="ao-detail__treatment-remove"
                  onClick={handleRemove}
                >
                  Remove
                </button>
              </>
            ) : showTimeline ? (
              <div className="ao-detail__inline-panel">
                <span className="ao-detail__inline-panel-label">When?</span>
                <div className="ao-detail__timeline-picker">
                  {TIMELINE_OPTIONS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className="ao-detail__timeline-btn"
                      onClick={() => handleAddWithTimeline(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="ao-detail__treatment-add"
                onClick={() => setShowTimeline(true)}
              >
                Add to plan
              </button>
            )}
          </div>
        </div>
        {bestPhoto ? (
          <div className="ao-detail__photo-single">
            <button
              type="button"
              className="ao-detail__photo-single-btn"
              onClick={() => setLightboxOpen(true)}
              aria-label={`View before/after: ${bestPhoto.name || "Treatment example"}`}
            >
              <img
                src={bestPhoto.thumbnailUrl || bestPhoto.photoUrl}
                alt=""
                className="ao-detail__photo-single-img"
                loading="lazy"
              />
              <span className="ao-detail__photo-single-label">Before/after example</span>
              <span className="ao-detail__photo-expand" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                </svg>
              </span>
            </button>
          </div>
        ) : null}
      </div>
      {lightboxOpen && bestPhoto && (
        <div
          className="ao-detail__lightbox-overlay"
          onClick={() => setLightboxOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="View photo"
        >
          <button
            type="button"
            className="ao-detail__lightbox-close"
            onClick={() => setLightboxOpen(false)}
            aria-label="Close"
          >
            ×
          </button>
          <div
            className="ao-detail__lightbox-content"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={bestPhoto.photoUrl}
              alt={bestPhoto.name || "Before/after"}
              className="ao-detail__lightbox-img"
            />
            {(bestPhoto.name || bestPhoto.caption) && (
              <p className="ao-detail__lightbox-caption">
                {bestPhoto.name || ""}
                {bestPhoto.name && bestPhoto.caption ? " — " : ""}
                {bestPhoto.caption || ""}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** Horizontal bar for sub-score breakdown in category detail */
function DetailBar({
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
    <div className="ao-detail-bar">
      <div className="ao-detail-bar__header">
        <span className="ao-detail-bar__label">{label}</span>
        <span className="ao-detail-bar__score" style={{ color }}>
          {score}
        </span>
      </div>
      <div className="ao-detail-bar__track">
        <div
          className="ao-detail-bar__fill"
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
  const desc = CATEGORY_DESCRIPTIONS[cat.key] || "";

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
          <div className="ao-modal-cat-card__header-gauge">
            <ScoreGauge
              score={cat.score}
              size={88}
              strokeWidth={7}
              animate={animate}
              label={cat.scoreLabel}
              className="ao-modal-gauge--category"
            />
          </div>
          {cat.subScores.length >= 3 && (
            <div className="ao-modal-cat-card__header-radar" aria-hidden>
              <RadarChart
                data={cat.subScores.map((s) => ({ name: s.name, score: s.score }))}
                size={70}
                animate={animate}
                showLabels={false}
                className="ao-radar--compact"
              />
            </div>
          )}
        </div>
        <div className="ao-modal-cat-card__right">
          <span className="ao-modal-cat-card__chev" aria-hidden>
            {isOpen ? "▲" : "▼"}
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="ao-modal-cat-card__body">
          {desc && <p className="ao-modal-cat-card__desc-expanded">{desc}</p>}
          {cat.subScores.length >= 3 ? (
            <RadarChart
              data={cat.subScores.map((s) => ({ name: s.name, score: s.score }))}
              size={200}
              animate={animate}
            />
          ) : (
            <div className="ao-modal-cat-card__bars">
              {cat.subScores.map((s) => (
                <DetailBar
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

/* ========== Category Detail View (drill-down) ========== */
function CategoryDetailContent({
  categoryKey,
  detectedIssues,
  onBack,
  onAddToPlan,
  treatmentPhotos,
  treatmentPhotosLoading,
  providerCode,
}: {
  categoryKey: string;
  detectedIssues: Set<string>;
  onBack: () => void;
  onAddToPlan?: (prefill: TreatmentPlanPrefill) => void;
  treatmentPhotos: TreatmentPhoto[];
  treatmentPhotosLoading: boolean;
  providerCode?: string;
}) {
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 150);
    return () => clearTimeout(t);
  }, []);

  const categories = useMemo(
    () => computeCategories(detectedIssues),
    [detectedIssues]
  );
  const catResult = categories.find((c) => c.key === categoryKey);
  const catDef = CATEGORIES.find((c) => c.key === categoryKey);

  const detectedIssueNames = useMemo(() => {
    if (!catDef) return [];
    return catDef.subScores.flatMap((s) => s.issues).filter((issue) =>
      detectedIssues.has(normalizeIssue(issue))
    );
  }, [catDef, detectedIssues]);

  const suggestedTreatments = useMemo(
    () => getSuggestedTreatmentsForFindings(detectedIssueNames, providerCode),
    [detectedIssueNames, providerCode]
  );

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

  // LLM-generated category assessment
  const [aiCatText, setAiCatText] = useState<string | null>(null);
  const [aiCatLoading, setAiCatLoading] = useState(false);

  const strengthIssueNames = useMemo(() => {
    if (!catDef) return [];
    return catDef.subScores.flatMap((s) => s.issues).filter(
      (issue) => !detectedIssues.has(normalizeIssue(issue))
    );
  }, [catDef, detectedIssues]);

  useEffect(() => {
    if (!catResult) return;
    let mounted = true;
    setAiCatLoading(true);
    fetchCategoryAssessment({
      categoryOrArea: catResult.name,
      score: catResult.score,
      tier: catResult.tier,
      subScores: catResult.subScores.map(s => ({
        name: s.name,
        score: s.score,
        detected: s.detected,
        total: s.total,
      })),
      detectedIssues: detectedIssueNames,
      strengthIssues: strengthIssueNames,
    })
      .then(text => { if (mounted) { setAiCatText(text); setAiCatLoading(false); } })
      .catch(() => { if (mounted) setAiCatLoading(false); });
    return () => { mounted = false; };
  }, [catResult, detectedIssueNames, strengthIssueNames]);

  const displayCatAssessment = aiCatText || categoryDescription;

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
        <div className="ao-detail__hero-gauge">
          <ScoreGauge
            score={catResult.score}
            size={110}
            strokeWidth={10}
            animate={animate}
            label={CATEGORIES.find(c => c.key === categoryKey)?.scoreLabel ?? CATEGORIES.find(c => c.key === categoryKey)?.name ?? ""}
          />
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
              <TypewriterText text={displayCatAssessment} speed={20} />
            </p>
          )}
        </div>
      </section>

      {/* Sub-score breakdown with collapsible check/x pills */}
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
              subScore={s}
              issues={CATEGORIES.find(c => c.key === categoryKey)?.subScores.find(ss => ss.name === s.name)?.issues || []}
              detectedIssues={detectedIssues}
              animate={animate}
            />
          ))}
        </div>
      </section>

      {suggestedTreatments.length > 0 && (
        <section className="ao-detail__section">
          <h3 className="ao-detail__section-title">Suggested treatments</h3>
          <p className="ao-detail__treatments-intro">
            Based on the findings above, here are some approaches that could help address these concerns.
          </p>
          {treatmentPhotosLoading && (
            <p className="ao-detail__photo-strip-loading">Loading treatment examples…</p>
          )}
          <ul className="ao-detail__treatment-list">
            {suggestedTreatments.map((s, i) => {
              const bestPhoto = treatmentPhotosLoading
                ? null
                : pickBestPhotoForTreatment(
                    treatmentPhotos,
                    s.treatment,
                    s.goal,
                    s.exampleFinding
                  );
              return (
                <li key={`${s.treatment}-${s.goal}-${s.region}-${i}`} className="ao-detail__treatment-item">
                  <TreatmentRowContent
                    suggestion={s}
                    bestPhoto={bestPhoto}
                    onAddToPlan={onAddToPlan}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ========== Area Detail View (drill-down) ========== */
function AreaDetailContent({
  areaName,
  detectedIssues,
  interestAreaNames,
  onBack,
  onAddToPlan,
  treatmentPhotos,
  treatmentPhotosLoading,
  providerCode,
}: {
  areaName: string;
  detectedIssues: Set<string>;
  interestAreaNames: Set<string>;
  onBack: () => void;
  onAddToPlan?: (prefill: TreatmentPlanPrefill) => void;
  treatmentPhotos: TreatmentPhoto[];
  treatmentPhotosLoading: boolean;
  providerCode?: string;
}) {
  const areaResults = useMemo(
    () => computeAreas(detectedIssues, interestAreaNames),
    [detectedIssues, interestAreaNames]
  );
  const areaResult = areaResults.find((a) => a.name === areaName);
  const areaDef = AREAS.find((a) => a.name === areaName);
  const themes = useMemo(
    () => summarizeAreaThemes(areaName, detectedIssues),
    [areaName, detectedIssues]
  );

  const detectedIssueNames = useMemo(() => {
    if (!areaDef) return [];
    return areaDef.issues.filter((issue) =>
      detectedIssues.has(normalizeIssue(issue))
    );
  }, [areaDef, detectedIssues]);

  const suggestedTreatments = useMemo(
    () => getSuggestedTreatmentsForFindings(detectedIssueNames, providerCode),
    [detectedIssueNames, providerCode]
  );

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

  // LLM-generated area assessment
  const [aiAreaText, setAiAreaText] = useState<string | null>(null);
  const [aiAreaLoading, setAiAreaLoading] = useState(false);

  const strengthIssueNames = useMemo(() => {
    if (!areaDef) return [];
    return areaDef.issues.filter(issue => !detectedIssues.has(normalizeIssue(issue)));
  }, [areaDef, detectedIssues]);

  useEffect(() => {
    if (!areaResult) return;
    let mounted = true;
    setAiAreaLoading(true);
    fetchCategoryAssessment({
      categoryOrArea: areaResult.name,
      score: areaResult.score,
      tier: areaResult.tier,
      subScores: themes.map(t => ({
        name: t.label,
        score: t.totalCount > 0 ? Math.round(((t.totalCount - t.detectedCount) / t.totalCount) * 100) : 100,
        detected: t.detectedCount,
        total: t.totalCount,
      })),
      detectedIssues: detectedIssueNames,
      strengthIssues: strengthIssueNames,
    })
      .then(text => { if (mounted) { setAiAreaText(text); setAiAreaLoading(false); } })
      .catch(() => { if (mounted) setAiAreaLoading(false); });
    return () => { mounted = false; };
  }, [areaResult, themes, detectedIssueNames, strengthIssueNames]);

  const displayAreaAssessment = aiAreaText || areaDescription;

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
        <div className="ao-detail__hero-gauge">
          <ScoreGauge
            score={areaResult.score}
            size={110}
            strokeWidth={10}
            animate={true}
            label={areaResult.name}
          />
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
              <TypewriterText text={displayAreaAssessment} speed={20} />
            </p>
          )}
        </div>
      </section>

      {/* Theme-based feature breakdown with check/x pills */}
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
              theme={theme}
              detectedIssues={detectedIssues}
            />
          ))}
        </div>
      </section>

      {suggestedTreatments.length > 0 && (
        <section className="ao-detail__section">
          <h3 className="ao-detail__section-title">Suggested treatments</h3>
          <p className="ao-detail__treatments-intro">
            Based on the findings above, here are some approaches that could help address these concerns.
          </p>
          {treatmentPhotosLoading && (
            <p className="ao-detail__photo-strip-loading">Loading treatment examples…</p>
          )}
          <ul className="ao-detail__treatment-list">
            {suggestedTreatments.map((s, i) => {
              const bestPhoto = treatmentPhotosLoading
                ? null
                : pickBestPhotoForTreatment(
                    treatmentPhotos,
                    s.treatment,
                    s.goal,
                    s.exampleFinding
                  );
              return (
                <li key={`${s.treatment}-${s.goal}-${s.region}-${i}`} className="ao-detail__treatment-item">
                  <TreatmentRowContent
                    suggestion={s}
                    bestPhoto={bestPhoto}
                    onAddToPlan={onAddToPlan}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function AnalysisOverviewModal({
  client,
  onClose,
  onAddToPlan,
  initialDetailView,
}: AnalysisOverviewModalProps) {
  const { provider } = useDashboard();
  const [animate, setAnimate] = useState(false);
  const [detailView, setDetailView] = useState<DetailView>(null);

  // Restore drill-down when reopening from treatment plan
  useEffect(() => {
    if (initialDetailView !== undefined) {
      setDetailView(initialDetailView ?? null);
    }
  }, [initialDetailView]);
  const [treatmentPhotos, setTreatmentPhotos] = useState<TreatmentPhoto[]>([]);
  const [treatmentPhotosLoading, setTreatmentPhotosLoading] = useState(false);
  const [clientFrontPhotoUrl, setClientFrontPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 350);
    return () => clearTimeout(t);
  }, []);

  // Load client front photo when modal is open
  useEffect(() => {
    if (!client) {
      setClientFrontPhotoUrl(null);
      return;
    }
    const getUrl = (att: { thumbnails?: { large?: { url?: string }; full?: { url?: string } }; url?: string }) =>
      att?.thumbnails?.full?.url || att?.thumbnails?.large?.url || att?.url || null;

    if (client.frontPhoto && Array.isArray(client.frontPhoto) && client.frontPhoto.length > 0) {
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
          const front = fields["Front Photo"] || fields["Front photo"] || fields["frontPhoto"];
          if (front && Array.isArray(front) && front.length > 0) {
            setClientFrontPhotoUrl((prev) => prev || getUrl(front[0]) || null);
          }
        })
        .catch(() => {});
      return () => {
        mounted = false;
      };
    }
  }, [client]);

  useEffect(() => {
    if (!detailView) {
      setTreatmentPhotos([]);
      return;
    }
    let mounted = true;
    setTreatmentPhotosLoading(true);
    fetchTreatmentPhotos({ limit: 1500 })
      .then((records) => {
        if (mounted) {
          const photos = records
            .map(mapRecordToPhoto)
            .filter((p) => p.photoUrl);
          setTreatmentPhotos(photos);
          setTreatmentPhotosLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setTreatmentPhotos([]);
          setTreatmentPhotosLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [detailView]);

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
    [detectedIssues]
  );
  const overall = useMemo(() => computeOverall(categories), [categories]);

  const areaResults = useMemo(
    () => computeAreas(detectedIssues, interestAreaNames),
    [detectedIssues, interestAreaNames]
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
    [overall, categories, focusCount]
  );

  // LLM-generated overview assessment (async, with fallback to template)
  const [aiAssessmentText, setAiAssessmentText] = useState<string | null>(null);
  const [aiAssessmentLoading, setAiAssessmentLoading] = useState(false);

  useEffect(() => {
    if (detectedIssues.size === 0) return;
    let mounted = true;
    setAiAssessmentLoading(true);
    const detectedList = Array.from(detectedIssues);
    fetchAIAssessment({
      overall,
      categories: categories.map(c => ({ name: c.name, score: c.score, tier: c.tier })),
      focusCount,
      detectedIssues: detectedList,
    })
      .then(text => {
        if (mounted) {
          setAiAssessmentText(text);
          setAiAssessmentLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setAiAssessmentLoading(false);
      });
    return () => { mounted = false; };
  }, [detectedIssues, overall, categories, focusCount]);

  // The displayed assessment: LLM text if available, otherwise template
  const displayAssessment = aiAssessmentText || assessmentText;

  const hasAnyData = detectedIssues.size > 0;

  const showCategoryDetail = detailView?.type === "category";
  const showAreaDetail = detailView?.type === "area";
  const showAreasPage = detailView?.type === "areas";
  const [aiSummaryOpen, setAiSummaryOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  // Default: open first category so at least one radar is visible without clicks.
  const [openCategoryKey, setOpenCategoryKey] = useState<string | null>(
    CATEGORIES[0]?.key ?? null
  );

  // Inline treatment plan handler – records additions without navigating away
  const handleInlineAddToPlan = (prefill: TreatmentPlanPrefill) => {
    // Notify parent for persistence if available, but DON'T navigate away
    // Parent should check if inline mode is active and skip closing the overview
    onAddToPlan?.(prefill, detailView);
  };

  return (
    <div className="modal-overlay active" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="ao-modal-title">
      <div
        className={`modal-content analysis-overview-modal${isMaximized ? " analysis-overview-modal--maximized" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="analysis-overview-modal__header">
          <h2 id="ao-modal-title" className="analysis-overview-modal__title">
            {showCategoryDetail && detailView?.type === "category"
              ? (categories.find((c) => c.key === detailView.key)?.scoreLabel ?? detailView.key)
              : showAreaDetail && detailView?.type === "area"
                ? (detailView.name)
                : showAreasPage
                  ? "All Areas"
                  : "Facial Analysis"}
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
              onAddToPlan={handleInlineAddToPlan}
              treatmentPhotos={treatmentPhotos}
              treatmentPhotosLoading={treatmentPhotosLoading}
              providerCode={provider?.code}
            />
          ) : showAreaDetail && detailView?.type === "area" ? (
            <AreaDetailContent
              areaName={detailView.name}
              detectedIssues={detectedIssues}
              interestAreaNames={interestAreaNames}
              onBack={() => setDetailView(null)}
              onAddToPlan={handleInlineAddToPlan}
              treatmentPhotos={treatmentPhotos}
              treatmentPhotosLoading={treatmentPhotosLoading}
              providerCode={provider?.code}
            />
          ) : showAreasPage ? (
            /* ===== All Areas inner page with face map ===== */
            <div className="ao-detail">
              <button
                type="button"
                className="ao-detail__back"
                onClick={() => setDetailView(null)}
                aria-label="Back to overview"
              >
                ← Back to Overview
              </button>

              {/* SVG face map */}
              <div className="ao-face-map">
                <svg viewBox="0 0 300 400" className="ao-face-map__svg">
                  {/* Face outline */}
                  <ellipse cx="150" cy="190" rx="110" ry="150" fill="none" stroke="#e0e0e0" strokeWidth="1.5" />
                  {/* Forehead region */}
                  <ellipse cx="150" cy="90" rx="80" ry="40"
                    className="ao-face-map__region"
                    fill={tierColor((areaResults.find(a => a.name === "Forehead") || { tier: "good" as const }).tier)}
                    opacity="0.25"
                    onClick={() => setDetailView({ type: "area", name: "Forehead" })}
                    style={{ cursor: "pointer" }}
                  />
                  <text x="150" y="95" textAnchor="middle" className="ao-face-map__label">Forehead</text>
                  {/* Eyes region */}
                  <ellipse cx="110" cy="155" rx="30" ry="16"
                    className="ao-face-map__region"
                    fill={tierColor((areaResults.find(a => a.name === "Eyes") || { tier: "good" as const }).tier)}
                    opacity="0.25"
                    onClick={() => setDetailView({ type: "area", name: "Eyes" })}
                    style={{ cursor: "pointer" }}
                  />
                  <ellipse cx="190" cy="155" rx="30" ry="16"
                    className="ao-face-map__region"
                    fill={tierColor((areaResults.find(a => a.name === "Eyes") || { tier: "good" as const }).tier)}
                    opacity="0.25"
                    onClick={() => setDetailView({ type: "area", name: "Eyes" })}
                    style={{ cursor: "pointer" }}
                  />
                  <text x="150" y="150" textAnchor="middle" className="ao-face-map__label">Eyes</text>
                  {/* Nose region */}
                  <ellipse cx="150" cy="200" rx="18" ry="28"
                    className="ao-face-map__region"
                    fill={tierColor((areaResults.find(a => a.name === "Nose") || { tier: "good" as const }).tier)}
                    opacity="0.25"
                    onClick={() => setDetailView({ type: "area", name: "Nose" })}
                    style={{ cursor: "pointer" }}
                  />
                  <text x="150" y="205" textAnchor="middle" className="ao-face-map__label">Nose</text>
                  {/* Cheeks region */}
                  <ellipse cx="80" cy="205" rx="30" ry="30"
                    className="ao-face-map__region"
                    fill={tierColor((areaResults.find(a => a.name === "Cheeks") || { tier: "good" as const }).tier)}
                    opacity="0.25"
                    onClick={() => setDetailView({ type: "area", name: "Cheeks" })}
                    style={{ cursor: "pointer" }}
                  />
                  <ellipse cx="220" cy="205" rx="30" ry="30"
                    className="ao-face-map__region"
                    fill={tierColor((areaResults.find(a => a.name === "Cheeks") || { tier: "good" as const }).tier)}
                    opacity="0.25"
                    onClick={() => setDetailView({ type: "area", name: "Cheeks" })}
                    style={{ cursor: "pointer" }}
                  />
                  <text x="80" y="210" textAnchor="middle" className="ao-face-map__label">Cheeks</text>
                  {/* Lips region */}
                  <ellipse cx="150" cy="260" rx="30" ry="14"
                    className="ao-face-map__region"
                    fill={tierColor((areaResults.find(a => a.name === "Lips") || { tier: "good" as const }).tier)}
                    opacity="0.25"
                    onClick={() => setDetailView({ type: "area", name: "Lips" })}
                    style={{ cursor: "pointer" }}
                  />
                  <text x="150" y="264" textAnchor="middle" className="ao-face-map__label">Lips</text>
                  {/* Jawline region */}
                  <path d="M60,250 Q60,330 150,340 Q240,330 240,250"
                    className="ao-face-map__region"
                    fill={tierColor((areaResults.find(a => a.name === "Jawline") || { tier: "good" as const }).tier)}
                    opacity="0.15"
                    onClick={() => setDetailView({ type: "area", name: "Jawline" })}
                    style={{ cursor: "pointer" }}
                  />
                  <text x="150" y="320" textAnchor="middle" className="ao-face-map__label">Jawline</text>
                </svg>

                {/* Legend */}
                <div className="ao-face-map__legend">
                  <span className="ao-face-map__legend-item">
                    <span className="ao-face-map__legend-dot" style={{ background: tierColor("excellent") }} />
                    Excellent
                  </span>
                  <span className="ao-face-map__legend-item">
                    <span className="ao-face-map__legend-dot" style={{ background: tierColor("good") }} />
                    Good
                  </span>
                  <span className="ao-face-map__legend-item">
                    <span className="ao-face-map__legend-dot" style={{ background: tierColor("moderate") }} />
                    Moderate
                  </span>
                  <span className="ao-face-map__legend-item">
                    <span className="ao-face-map__legend-dot" style={{ background: tierColor("attention") }} />
                    Attention
                  </span>
                </div>
              </div>

              {/* Area list below the map */}
              <div className="analysis-overview-modal__areas-list">
                {areaResults
                  .sort((a, b) => a.score - b.score)
                  .map((a) => (
                    <AreaCard
                      key={a.name}
                      area={a}
                      onExploreDetails={(name) => setDetailView({ type: "area", name })}
                    />
                  ))}
              </div>
            </div>
          ) : (
            /* ===== Main overview ===== */
            <>
              {/* Hero: front photo */}
              <section className="analysis-overview-modal__hero">
                <div className="analysis-overview-modal__hero-card">
                  {clientFrontPhotoUrl && (
                    <div
                      className="analysis-overview-modal__client-photo-wrap analysis-overview-modal__client-photo-wrap--clickable"
                      onClick={() => setShowPhotoViewer(true)}
                      role="button"
                      tabIndex={0}
                      aria-label="View patient photos"
                    >
                      <img
                        src={clientFrontPhotoUrl}
                        alt="Patient"
                        className="analysis-overview-modal__client-photo"
                      />
                      <span className="analysis-overview-modal__photo-overlay">View</span>
                      <span className="analysis-overview-modal__photo-expand" aria-hidden>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                        </svg>
                      </span>
                    </div>
                  )}
                </div>
              </section>

              {/* AI Summary: "Aesthetic Intelligence" branded, collapsed by default */}
              <section className="ao-ai-summary">
                <button
                  type="button"
                  className="ao-ai-summary__toggle"
                  onClick={() => setAiSummaryOpen(!aiSummaryOpen)}
                >
                  <div className="ao-ai-summary__brand">
                    <AiSparkleLogo size={16} className="ao-ai-summary__icon ao-ai-logo" />
                    <span className="ao-ai-summary__label">Aesthetic Intelligence</span>
                    <GeminiWordmark />
                  </div>
                  <span className="ao-ai-summary__chev" aria-hidden>
                    {aiSummaryOpen ? "▲" : "▼"}
                  </span>
                </button>
                {aiSummaryOpen && (
                  <div className="ao-ai-summary__body">
                    {aiAssessmentLoading ? (
                      <div className="ao-ai-summary__loading">
                        <span className="ao-ai-summary__shimmer" />
                        <span className="ao-ai-summary__shimmer ao-ai-summary__shimmer--short" />
                      </div>
                    ) : (
                      <p className="ao-ai-summary__text">
                        <TypewriterText text={displayAssessment} speed={25} />
                      </p>
                    )}
                  </div>
                )}
              </section>

              {/* Category sub-scores – circle inside each collapsible card */}
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
                    <div key={c.key} className="analysis-overview-modal__cat-column">
                      <CategoryCard
                        cat={c}
                        isOpen={openCategoryKey === c.key}
                        onToggle={() => setOpenCategoryKey(openCategoryKey === c.key ? null : c.key)}
                        animate={animate}
                        onExploreDetails={(key) => setDetailView({ type: "category", key })}
                      />
                    </div>
                  ))}
                </div>
              </section>

              {/* Client's focus areas */}
              {focusAreas.length > 0 && (
                <section className="analysis-overview-modal__areas">
                  <OverviewSectionHeading>
                    Client&apos;s focus areas
                  </OverviewSectionHeading>
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
                  <div className="analysis-overview-modal__area-grid">
                    {focusAreas.map((a) => (
                      <AreaCard
                        key={a.name}
                        area={a}
                        onExploreDetails={(name) => setDetailView({ type: "area", name })}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Other areas */}
              {otherAreas.length > 0 && (
                <section className="analysis-overview-modal__areas">
                  <OverviewSectionHeading>Other areas</OverviewSectionHeading>
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
                  <div className="analysis-overview-modal__area-grid">
                    {otherAreas.map((a) => (
                      <AreaCard
                        key={a.name}
                        area={a}
                        onExploreDetails={(name) => setDetailView({ type: "area", name })}
                      />
                    ))}
                  </div>
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
