// Analysis Overview Modal – high-level scores, categories, areas (desktop-optimized)
// Supports drill-down into category detail and area detail views.

import { useMemo, useState, useEffect } from "react";
import { Client, TreatmentPhoto } from "../../types";
import { fetchTreatmentPhotos, fetchTableRecords } from "../../services/api";
import type { AirtableRecord } from "../../services/api";
import {
  CATEGORIES,
  AREAS,
  normalizeIssue,
  computeCategories,
  computeOverall,
  computeAreas,
  scoreTier,
  tierLabel,
  tierColor,
  summarizeAreaThemes,
  splitStrengthsAndImprovements,
  generateAssessment,
  getCategoryDescriptionForPatient,
  getAreaDescriptionForPatient,
  type CategoryResult,
  type AreaResult,
  type ThemeSummary,
} from "../../config/analysisOverviewConfig";
import { getSuggestedTreatmentsForFindings } from "./DiscussedTreatmentsModal/utils";
import { TREATMENT_META } from "./DiscussedTreatmentsModal/constants";
import type { TreatmentPlanPrefill } from "./DiscussedTreatmentsModal/TreatmentPhotos";
import "./AnalysisOverviewModal.css";

export type DetailView =
  | null
  | { type: "category"; key: string }
  | { type: "area"; name: string };

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
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
  animate: boolean;
  label?: string;
}) {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = animate ? (score / 100) * circumference : 0;
  const offset = circumference - progress;
  const color = tierColor(scoreTier(score));

  return (
    <div className="ao-modal-gauge" style={{ width: size, height: size }}>
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

/** Short "why this treatment" explanation from finding and goal. */
function getWhyThisTreatment(
  exampleFinding: string,
  goal: string,
  treatment: string
): string {
  return `We detected ${exampleFinding} in this area. ${goal} is a good fit—${treatment} can help address these concerns.`;
}

/** Single treatment row: one relevant photo, why text, meta (longevity/downtime/price), Add to plan */
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
  const meta = TREATMENT_META[suggestion.treatment];
  const whyText = getWhyThisTreatment(
    suggestion.exampleFinding,
    suggestion.goal,
    suggestion.treatment
  );

  return (
    <>
      <div className="ao-detail__treatment-card">
        <div className="ao-detail__treatment-left">
          <div className="ao-detail__treatment-row">
            <div className="ao-detail__treatment-info">
              <span className="ao-detail__treatment-name">{suggestion.treatment}</span>
              <span className="ao-detail__treatment-meta">
                {suggestion.goal} · {suggestion.region}
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
          {onAddToPlan && (
            <button
              type="button"
              className="ao-detail__treatment-add"
              onClick={() =>
                onAddToPlan({
                  interest: suggestion.goal,
                  region: suggestion.region,
                  treatment: suggestion.treatment,
                  findings: [suggestion.exampleFinding],
                  timeline: "Wishlist",
                })
              }
            >
              Add to plan
            </button>
          )}
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
  defaultOpen,
  animate,
  onExploreDetails,
}: {
  cat: CategoryResult;
  defaultOpen: boolean;
  animate: boolean;
  onExploreDetails: (categoryKey: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const color = tierColor(cat.tier);

  return (
    <div
      className={`ao-modal-cat-card ${open ? "ao-modal-cat-card--open" : ""}`}
    >
      <button
        className="ao-modal-cat-card__header"
        onClick={() => setOpen(!open)}
        type="button"
      >
        <span className="ao-modal-cat-card__name">{cat.name}</span>
        <div className="ao-modal-cat-card__right">
          <span
            className="ao-modal-cat-card__score"
            style={{ background: color }}
          >
            {cat.score}
          </span>
          <span className="ao-modal-cat-card__chev" aria-hidden>
            {open ? "▲" : "▼"}
          </span>
        </div>
      </button>

      {open && (
        <div className="ao-modal-cat-card__body">
          <div className="ao-modal-cat-card__breakdown">
            <h4 className="ao-modal-cat-card__group-title">Breakdown</h4>
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
          </div>
          <button
            type="button"
            className="ao-modal-cat-card__explore"
            onClick={(e) => {
              e.stopPropagation();
              onExploreDetails(cat.key);
            }}
          >
            Explore {cat.name} →
          </button>
        </div>
      )}
    </div>
  );
}

function AreaCard({
  area,
  themes,
  defaultOpen,
  onExploreDetails,
}: {
  area: AreaResult;
  themes: ThemeSummary[];
  defaultOpen: boolean;
  onExploreDetails: (areaName: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const color = tierColor(area.tier);
  const { strengths, improvements } = splitStrengthsAndImprovements(
    themes,
    (t) => t.totalCount - t.detectedCount,
    (t) => t.detectedCount
  );

  return (
    <div
      className={`ao-modal-area-card ${open ? "ao-modal-area-card--open" : ""}`}
    >
      <button
        className="ao-modal-area-card__header"
        onClick={() => setOpen(!open)}
        type="button"
      >
        <div className="ao-modal-area-card__left">
          {area.hasInterest && (
            <span className="ao-modal-area-card__star" aria-hidden>
              ★
            </span>
          )}
          <span className="ao-modal-area-card__name">{area.name}</span>
        </div>
        <div className="ao-modal-area-card__right">
          <span
            className="ao-modal-area-card__score"
            style={{ background: color }}
          >
            {area.score}
          </span>
          <span className="ao-modal-area-card__chev" aria-hidden>
            {open ? "▲" : "▼"}
          </span>
        </div>
      </button>

      {open && (
        <div className="ao-modal-area-card__body">
          <div className="ao-modal-area-card__group">
            <h4 className="ao-modal-area-card__group-title ao-modal-area-card__group-title--good">
              Strengths
            </h4>
            <div className="ao-modal-area-card__pills">
              {strengths.length > 0 ? (
                strengths.map((t) => (
                  <span
                    key={t.label}
                    className="ao-modal-area-card__pill ao-modal-area-card__pill--good"
                  >
                    {t.label}
                    <span className="ao-modal-area-card__pill-count">
                      {t.totalCount - t.detectedCount}/{t.totalCount} look good
                    </span>
                  </span>
                ))
              ) : (
                <span className="ao-modal-area-card__pill ao-modal-area-card__pill--good ao-modal-area-card__pill--empty">
                  All features in this area need attention
                </span>
              )}
            </div>
          </div>
          <div className="ao-modal-area-card__group">
            <h4 className="ao-modal-area-card__group-title ao-modal-area-card__group-title--imp">
              Areas for Improvement
            </h4>
            <div className="ao-modal-area-card__pills">
              {improvements.length > 0 ? (
                improvements.map((t) => (
                  <span
                    key={t.label}
                    className="ao-modal-area-card__pill ao-modal-area-card__pill--imp"
                  >
                    {t.label}
                    {t.detectedCount > 0 && (
                      <span className="ao-modal-area-card__pill-count">
                        {t.detectedCount}/{t.totalCount}
                      </span>
                    )}
                  </span>
                ))
              ) : (
                <span className="ao-modal-area-card__pill ao-modal-area-card__pill--imp ao-modal-area-card__pill--empty">
                  None — looking good
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            className="ao-modal-area-card__explore"
            onClick={(e) => {
              e.stopPropagation();
              onExploreDetails(area.name);
            }}
          >
            Explore {area.name} →
          </button>
        </div>
      )}
    </div>
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
  clientFrontPhotoUrl,
  clientSidePhotoUrl,
}: {
  categoryKey: string;
  detectedIssues: Set<string>;
  onBack: () => void;
  onAddToPlan?: (prefill: TreatmentPlanPrefill) => void;
  treatmentPhotos: TreatmentPhoto[];
  treatmentPhotosLoading: boolean;
  clientFrontPhotoUrl?: string | null;
  clientSidePhotoUrl?: string | null;
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
    () => getSuggestedTreatmentsForFindings(detectedIssueNames),
    [detectedIssueNames]
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

  const { strengths: strengthSubs, improvements: improvementSubs } =
    splitStrengthsAndImprovements(
      catResult.subScores,
      (s) => s.total - s.detected,
      (s) => s.detected
    );
  const categoryDescription = getCategoryDescriptionForPatient(catResult);

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

      <section className="ao-detail__hero">
        <div className="ao-detail__hero-left">
          <div className="ao-detail__hero-gauge">
            <ScoreGauge
              score={catResult.score}
              size={80}
              strokeWidth={8}
              animate={animate}
            />
          </div>
          <div className="ao-detail__hero-info">
            <span
              className="ao-detail__tier"
              style={{ color: tierColor(catResult.tier) }}
            >
              {tierLabel(catResult.tier)}
            </span>
            <p className="ao-detail__desc">
              {categoryDescription}
            </p>
          </div>
        </div>
        {(clientFrontPhotoUrl || clientSidePhotoUrl) && (
          <div className="ao-detail__client-photos">
            {clientFrontPhotoUrl && (
              <div className="ao-detail__client-photo-wrap">
                <img src={clientFrontPhotoUrl} alt="Front" className="ao-detail__client-photo" />
                <span className="ao-detail__client-photo-label">Front</span>
              </div>
            )}
            {clientSidePhotoUrl && (
              <div className="ao-detail__client-photo-wrap">
                <img src={clientSidePhotoUrl} alt="Side" className="ao-detail__client-photo" />
                <span className="ao-detail__client-photo-label">Side</span>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="ao-detail__section">
        <h3 className="ao-detail__section-title">Breakdown</h3>
        <div className="ao-detail__bars">
          {catResult.subScores.map((s) => (
            <DetailBar
              key={s.name}
              label={s.name}
              score={s.score}
              animate={animate}
            />
          ))}
        </div>
      </section>

      <section className="ao-detail__section">
        <h3 className="ao-detail__section-title ao-detail__section-title--good">
          Strengths
        </h3>
        <div className="ao-detail__theme-list">
          {strengthSubs.length > 0 ? (
            strengthSubs.map((s) => (
              <div
                key={s.name}
                className="ao-detail__theme-card ao-detail__theme-card--good"
              >
                <span className="ao-detail__theme-label">{s.name}</span>
                <span className="ao-detail__theme-detail">
                  {s.total - s.detected} of {s.total} features look good
                  {s.score > 0 ? ` (score ${s.score})` : ""}
                </span>
              </div>
            ))
          ) : (
            <div className="ao-detail__theme-card ao-detail__theme-card--good ao-detail__theme-card--empty">
              <span className="ao-detail__theme-detail">
                All features in this category need attention.
              </span>
            </div>
          )}
        </div>
      </section>

      <section className="ao-detail__section">
        <h3 className="ao-detail__section-title ao-detail__section-title--imp">
          Areas for Improvement
        </h3>
        <div className="ao-detail__theme-list">
          {improvementSubs.length > 0 ? (
            improvementSubs.map((s) => (
              <div
                key={s.name}
                className="ao-detail__theme-card ao-detail__theme-card--imp"
              >
                <span className="ao-detail__theme-label">{s.name}</span>
                <span className="ao-detail__theme-detail">
                  {s.detected} of {s.total} features detected (score {s.score})
                </span>
              </div>
            ))
          ) : (
            <div className="ao-detail__theme-card ao-detail__theme-card--imp ao-detail__theme-card--empty">
              <span className="ao-detail__theme-detail">
                No areas for improvement — all sub-scores are in good shape.
              </span>
            </div>
          )}
        </div>
      </section>

      {suggestedTreatments.length > 0 && (
        <section className="ao-detail__section">
          <h3 className="ao-detail__section-title">Suggested treatments</h3>
          <p className="ao-detail__treatments-intro">
            Based on findings in this category, the following treatments may be relevant.
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
  clientFrontPhotoUrl,
  clientSidePhotoUrl,
}: {
  areaName: string;
  detectedIssues: Set<string>;
  interestAreaNames: Set<string>;
  onBack: () => void;
  onAddToPlan?: (prefill: TreatmentPlanPrefill) => void;
  treatmentPhotos: TreatmentPhoto[];
  treatmentPhotosLoading: boolean;
  clientFrontPhotoUrl?: string | null;
  clientSidePhotoUrl?: string | null;
}) {
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 150);
    return () => clearTimeout(t);
  }, []);

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
    () => getSuggestedTreatmentsForFindings(detectedIssueNames),
    [detectedIssueNames]
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

  const { strengths, improvements } = splitStrengthsAndImprovements(
    themes,
    (t) => t.totalCount - t.detectedCount,
    (t) => t.detectedCount
  );
  const impCount = areaResult.improvements.length;

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

      <section className="ao-detail__hero">
        <div className="ao-detail__hero-left">
          <div className="ao-detail__hero-gauge">
            <ScoreGauge
              score={areaResult.score}
              size={80}
              strokeWidth={8}
              animate={animate}
            />
          </div>
          <div className="ao-detail__hero-info">
            <span
              className="ao-detail__tier"
              style={{ color: tierColor(areaResult.tier) }}
            >
              {tierLabel(areaResult.tier)}
            </span>
            {areaResult.hasInterest && (
              <span className="ao-detail__focus-badge">★ Focus Area</span>
            )}
            <p className="ao-detail__desc">
              {getAreaDescriptionForPatient(areaResult)}
            </p>
          </div>
        </div>
        {(clientFrontPhotoUrl || clientSidePhotoUrl) && (
          <div className="ao-detail__client-photos">
            {clientFrontPhotoUrl && (
              <div className="ao-detail__client-photo-wrap">
                <img src={clientFrontPhotoUrl} alt="Front" className="ao-detail__client-photo" />
                <span className="ao-detail__client-photo-label">Front</span>
              </div>
            )}
            {clientSidePhotoUrl && (
              <div className="ao-detail__client-photo-wrap">
                <img src={clientSidePhotoUrl} alt="Side" className="ao-detail__client-photo" />
                <span className="ao-detail__client-photo-label">Side</span>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="ao-detail__section">
        <h3 className="ao-detail__section-title">What We Analyzed</h3>
        <p className="ao-detail__overview-text">
          We evaluated {areaDef.issues.length} features in this area.{" "}
          {impCount > 0
            ? `${impCount} ${impCount === 1 ? "feature was" : "features were"} identified for potential improvement.`
            : "No notable concerns were detected — looking great!"}
        </p>
      </section>

      <section className="ao-detail__section">
        <h3 className="ao-detail__section-title ao-detail__section-title--good">
          Strengths
        </h3>
        <div className="ao-detail__theme-list">
          {strengths.length > 0 ? (
            strengths.map((t) => (
              <div
                key={t.label}
                className="ao-detail__theme-card ao-detail__theme-card--good"
              >
                <span className="ao-detail__theme-label">{t.label}</span>
                <span className="ao-detail__theme-detail">
                  {t.totalCount - t.detectedCount} of {t.totalCount}{" "}
                  {t.totalCount === 1 ? "feature" : "features"} look good
                </span>
              </div>
            ))
          ) : (
            <div className="ao-detail__theme-card ao-detail__theme-card--good ao-detail__theme-card--empty">
              <span className="ao-detail__theme-detail">
                All features in this area need attention.
              </span>
            </div>
          )}
        </div>
      </section>

      <section className="ao-detail__section">
        <h3 className="ao-detail__section-title ao-detail__section-title--imp">
          Areas for Improvement
        </h3>
        <div className="ao-detail__theme-list">
          {improvements.length > 0 ? (
            improvements.map((t) => (
              <div
                key={t.label}
                className="ao-detail__theme-card ao-detail__theme-card--imp"
              >
                <span className="ao-detail__theme-label">{t.label}</span>
                <span className="ao-detail__theme-detail">
                  {t.detectedCount} of {t.totalCount}{" "}
                  {t.totalCount === 1 ? "feature" : "features"} detected
                </span>
              </div>
            ))
          ) : (
            <div className="ao-detail__theme-card ao-detail__theme-card--imp ao-detail__theme-card--empty">
              <span className="ao-detail__theme-detail">
                No areas for improvement — all features in this area look good.
              </span>
            </div>
          )}
        </div>
      </section>

      {suggestedTreatments.length > 0 && (
        <section className="ao-detail__section">
          <h3 className="ao-detail__section-title">Suggested treatments</h3>
          <p className="ao-detail__treatments-intro">
            Based on findings in this area, the following treatments may be relevant.
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

/** Build detected issues Set from client.allIssues (comma-separated or array). */
function getDetectedIssues(client: Client): Set<string> {
  const set = new Set<string>();
  const raw = client.allIssues;
  if (!raw) return set;
  const list = Array.isArray(raw)
    ? raw
    : String(raw)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
  list.forEach((issue) => set.add(normalizeIssue(issue)));
  return set;
}

/** Build interest area names (lowercase) from client form/regions. */
function getInterestAreaNames(client: Client): Set<string> {
  const names = new Set<string>();
  const sources = [
    client.processedAreasOfInterest,
    client.areasOfInterestFromForm,
    client.whichRegions,
  ].filter(Boolean) as string[];

  sources.forEach((str) => {
    const s = typeof str === "string" ? str : String(str);
    s.split(",").forEach((part) => {
      const trimmed = part.trim().toLowerCase();
      if (trimmed) names.add(trimmed);
    });
  });

  // Map common phrases to area names
  names.forEach((n) => {
    if (n.includes("jaw") || n.includes("chin")) names.add("jawline");
    if (n.includes("eye")) names.add("eyes");
    if (n.includes("lip")) names.add("lips");
    if (n.includes("forehead") || n.includes("brow")) names.add("forehead");
    if (n.includes("cheek")) names.add("cheeks");
    if (n.includes("nose")) names.add("nose");
    if (n.includes("skin")) names.add("skin");
  });

  return names;
}

export default function AnalysisOverviewModal({
  client,
  onClose,
  onAddToPlan,
  initialDetailView,
}: AnalysisOverviewModalProps) {
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
  const [clientSidePhotoUrl, setClientSidePhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 350);
    return () => clearTimeout(t);
  }, []);

  // Load client front + side photos when modal is open (Patients table has both)
  useEffect(() => {
    if (!client) {
      setClientFrontPhotoUrl(null);
      setClientSidePhotoUrl(null);
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
        fields: ["Front Photo", "Side Photo"],
      })
        .then((records) => {
          if (!mounted || records.length === 0) return;
          const fields = records[0].fields;
          const front = fields["Front Photo"] || fields["Front photo"] || fields["frontPhoto"];
          if (front && Array.isArray(front) && front.length > 0) {
            setClientFrontPhotoUrl((prev) => prev || getUrl(front[0]) || null);
          }
          const side = fields["Side Photo"] || fields["Side photo"] || fields["sidePhoto"];
          if (side && Array.isArray(side) && side.length > 0) {
            setClientSidePhotoUrl(getUrl(side[0]) || null);
          }
        })
        .catch(() => {});
      return () => {
        mounted = false;
      };
    }
    setClientSidePhotoUrl(null);
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

  const detectedIssues = useMemo(() => getDetectedIssues(client), [client]);
  const interestAreaNames = useMemo(
    () => getInterestAreaNames(client),
    [client]
  );

  const categories = useMemo(
    () => computeCategories(detectedIssues),
    [detectedIssues]
  );
  const overall = useMemo(() => computeOverall(categories), [categories]);
  const overallTier = scoreTier(overall);

  const areaResults = useMemo(
    () => computeAreas(detectedIssues, interestAreaNames),
    [detectedIssues, interestAreaNames]
  );

  const areaThemes = useMemo(() => {
    const map: Record<string, ThemeSummary[]> = {};
    areaResults.forEach((a) => {
      map[a.name] = summarizeAreaThemes(a.name, detectedIssues);
    });
    return map;
  }, [areaResults, detectedIssues]);

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

  const hasAnyData = detectedIssues.size > 0;

  const showCategoryDetail = detailView?.type === "category";
  const showAreaDetail = detailView?.type === "area";

  return (
    <div className="modal-overlay active" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="ao-modal-title">
      <div
        className="modal-content analysis-overview-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="analysis-overview-modal__header">
          <h2 id="ao-modal-title" className="analysis-overview-modal__title">
            {showCategoryDetail && detailView
              ? (categories.find((c) => c.key === detailView.key)?.name ?? detailView.key)
              : showAreaDetail
                ? (detailView?.name ?? "")
                : "Analysis Overview"}
          </h2>
          <button
            type="button"
            className="modal-close analysis-overview-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
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
              onAddToPlan={onAddToPlan ? (prefill) => onAddToPlan(prefill, detailView) : undefined}
              treatmentPhotos={treatmentPhotos}
              treatmentPhotosLoading={treatmentPhotosLoading}
              clientFrontPhotoUrl={clientFrontPhotoUrl}
              clientSidePhotoUrl={clientSidePhotoUrl}
            />
          ) : showAreaDetail && detailView?.type === "area" ? (
            <AreaDetailContent
              areaName={detailView.name}
              detectedIssues={detectedIssues}
              interestAreaNames={interestAreaNames}
              onBack={() => setDetailView(null)}
              onAddToPlan={onAddToPlan ? (prefill) => onAddToPlan(prefill, detailView) : undefined}
              treatmentPhotos={treatmentPhotos}
              treatmentPhotosLoading={treatmentPhotosLoading}
              clientFrontPhotoUrl={clientFrontPhotoUrl}
              clientSidePhotoUrl={clientSidePhotoUrl}
            />
          ) : (
            <>
              <section className="analysis-overview-modal__hero">
                <div className="analysis-overview-modal__hero-card">
                  <div className="analysis-overview-modal__score-and-desc">
                    <div className="analysis-overview-modal__score-block">
                      <ScoreGauge
                        score={overall}
                        size={128}
                        strokeWidth={10}
                        animate={animate}
                        label="Overall Score"
                      />
                      <span
                        className="analysis-overview-modal__tier"
                        style={{ color: tierColor(overallTier) }}
                      >
                        {tierLabel(overallTier)}
                      </span>
                    </div>
                    <p className="analysis-overview-modal__assessment analysis-overview-modal__assessment--hero">
                      {assessmentText}
                    </p>
                  </div>
                  {(clientFrontPhotoUrl || clientSidePhotoUrl) && (
                    <div className="analysis-overview-modal__client-photos">
                      {clientFrontPhotoUrl && (
                        <div className="analysis-overview-modal__client-photo-wrap">
                          <img
                            src={clientFrontPhotoUrl}
                            alt="Front"
                            className="analysis-overview-modal__client-photo"
                          />
                          <span className="analysis-overview-modal__client-photo-label">Front</span>
                        </div>
                      )}
                      {clientSidePhotoUrl && (
                        <div className="analysis-overview-modal__client-photo-wrap">
                          <img
                            src={clientSidePhotoUrl}
                            alt="Side"
                            className="analysis-overview-modal__client-photo"
                          />
                          <span className="analysis-overview-modal__client-photo-label">Side</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="analysis-overview-modal__cat-cards">
                  {categories.map((c) => (
                    <CategoryCard
                      key={c.key}
                      cat={c}
                      defaultOpen={true}
                      animate={animate}
                      onExploreDetails={(key) => setDetailView({ type: "category", key })}
                    />
                  ))}
                </div>
              </section>

              <section className="analysis-overview-modal__areas">
                {focusAreas.length > 0 && (
                  <div className="analysis-overview-modal__area-group">
                    <h3 className="analysis-overview-modal__area-group-title">
                      <span className="analysis-overview-modal__area-group-icon" aria-hidden>★</span>
                      Focus Areas
                    </h3>
                    <div className="analysis-overview-modal__area-grid">
                      {focusAreas.map((a) => (
                        <AreaCard
                          key={a.name}
                          area={a}
                          themes={areaThemes[a.name] || []}
                          defaultOpen={true}
                          onExploreDetails={(name) => setDetailView({ type: "area", name })}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {otherAreas.length > 0 && (
                  <div className="analysis-overview-modal__area-group">
                    <h3 className="analysis-overview-modal__area-group-title">
                      All Areas
                    </h3>
                    <div className="analysis-overview-modal__area-grid">
                      {otherAreas.map((a) => (
                        <AreaCard
                          key={a.name}
                          area={a}
                          themes={areaThemes[a.name] || []}
                          defaultOpen={false}
                          onExploreDetails={(name) => setDetailView({ type: "area", name })}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
