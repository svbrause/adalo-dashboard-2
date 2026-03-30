import { useEffect, useMemo, useState } from "react";
import {
  AreaThemeFeatureRow,
  SubScoreFeatureRow,
} from "../analysisOverview/FeatureBreakdownRows";
import type {
  BlueprintAnalysisOverviewSnapshot,
  PlanTreatmentRow,
} from "../../utils/postVisitBlueprintAnalysis";
import { resolveBlueprintCategorySubScores } from "../../utils/pvbBlueprintCategorySubScores";
import { normalizedDetectedIssuesFromLabels } from "../../utils/pvbBlueprintDetectedIssues";
import {
  CATEGORIES,
  summarizeAreaThemes,
  type AreaResult,
  type CategoryResult,
  getAreaDescriptionForPatient,
  scoreTier,
  tierColor,
  tierLabel,
} from "../../config/analysisOverviewConfig";
import { TREATMENT_META } from "../modals/DiscussedTreatmentsModal/constants";
import type { PatientSuggestionCard } from "../../services/api";
import {
  findPatientSuggestionCardForPlanRow,
  pickCasePhotoUrlForPlanRow,
  pickSuggestionOrCasePhotoForPlanRow,
  type BlueprintCasePhoto,
} from "../../utils/postVisitBlueprintCases";
import {
  trackPostVisitBlueprintEvent,
  type BlueprintPatientAnalyticsBase,
} from "../../utils/postVisitBlueprint";
import "./PvbAnalysisSubpages.css";

type SnapshotCategory = BlueprintAnalysisOverviewSnapshot["categories"][number];
type SnapshotArea = BlueprintAnalysisOverviewSnapshot["areas"][number];

/** Sub-scores that map to the Face areas → Eyes full-page view */
const EYE_RELATED_SUB_SCORES = new Set(["Eye Area", "Brow & Eyes"]);

function enrichSubScoreForPills(
  sub: NonNullable<SnapshotCategory["subScores"]>[number],
  categoryKey: string,
): { name: string; score: number; total: number; detected: number } {
  if (sub.total != null && sub.detected != null) {
    const total = Math.max(1, sub.total);
    const detected = Math.min(total, Math.max(0, sub.detected));
    return {
      name: sub.name,
      score: sub.score,
      total,
      detected,
    };
  }
  const catDef = CATEGORIES.find((c) => c.key === categoryKey);
  const subDef = catDef?.subScores.find((ss) => ss.name === sub.name);
  const total = Math.max(1, subDef?.issues.length ?? 1);
  const detected = Math.min(
    total,
    Math.max(0, Math.round(((100 - sub.score) / 100) * total)),
  );
  return { name: sub.name, score: sub.score, total, detected };
}

function snapshotToCategoryResult(cat: SnapshotCategory): CategoryResult {
  const resolved = resolveBlueprintCategorySubScores(cat);
  const subs = resolved.map((s) => {
    const e = enrichSubScoreForPills(s, cat.key);
    return {
      name: e.name,
      score: e.score,
      tier: scoreTier(e.score),
      total: e.total,
      detected: e.detected,
    };
  });
  return {
    name: cat.name,
    scoreLabel: cat.scoreLabel,
    key: cat.key,
    score: cat.score,
    tier: cat.tier,
    subScores: subs,
  };
}

function snapshotToAreaResult(ar: SnapshotArea): AreaResult {
  return {
    name: ar.name,
    score: ar.score,
    tier: ar.tier,
    strengths: ar.strengths ?? [],
    improvements: ar.improvements ?? [],
    hasInterest: ar.hasInterest,
  };
}

function CategoryGauge({
  score,
  animate,
  tier,
}: {
  score: number;
  animate: boolean;
  tier: CategoryResult["tier"];
}) {
  const size = 100;
  const strokeWidth = 8;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = animate ? (score / 100) * circumference : 0;
  const offset = circumference - progress;
  const color = tierColor(scoreTier(score));

  return (
    <div className="pvb-subpage-gauge" style={{ width: size, height: size }} aria-hidden>
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
            transition: animate ? "stroke-dashoffset 1s ease-out" : "none",
          }}
        />
      </svg>
      <div className="pvb-subpage-gauge__inner">
        <span className="pvb-subpage-gauge__value">{animate ? score : 0}</span>
        <span className="pvb-subpage-gauge__tier">{tierLabel(tier)}</span>
      </div>
    </div>
  );
}

/** Patient scan / front photo — keeps scores anchored to “you” */
function PvbPatientReferencePhoto({
  url,
  caption = "Your photo",
}: {
  url: string | null | undefined;
  caption?: string;
}) {
  const u = url?.trim();
  if (!u) return null;
  return (
    <figure className="pvb-subpage__patient-photo">
      <img src={u} alt="" className="pvb-subpage__patient-photo-img" loading="lazy" />
      <figcaption className="pvb-subpage__patient-photo-caption">{caption}</figcaption>
    </figure>
  );
}

function filterPlanRowsForCategory(
  rows: PlanTreatmentRow[],
  categoryKey: string,
): PlanTreatmentRow[] {
  const keyHints: Record<string, string[]> = {
    skinHealth: [
      "skin",
      "laser",
      "peel",
      "hydra",
      "facial",
      "texture",
      "pigment",
      "moxi",
      "bbl",
      "microneed",
      "chemical",
    ],
    volumeLoss: [
      "filler",
      "volume",
      "cheek",
      "lip",
      "under eye",
      "temple",
      "lift",
      "voluma",
      "juvederm",
      "restylane",
    ],
    proportions: [
      "botox",
      "tox",
      "jaw",
      "chin",
      "brow",
      "symmetry",
      "masseter",
      "kybella",
      "sculptra",
    ],
  };
  const hints = keyHints[categoryKey] ?? [];
  if (hints.length === 0 || rows.length === 0) return rows;
  const hay = (r: PlanTreatmentRow) =>
    `${r.displayName} ${r.interest ?? ""} ${r.findings.join(" ")}`.toLowerCase();
  const matched = rows.filter((r) => hints.some((h) => hay(r).includes(h)));
  return matched.length > 0 ? matched : rows;
}

function filterPlanRowsForArea(
  rows: PlanTreatmentRow[],
  areaName: string,
): PlanTreatmentRow[] {
  if (rows.length === 0) return rows;
  const token = areaName.trim().toLowerCase();
  const hay = (r: PlanTreatmentRow) =>
    `${r.displayName} ${r.interest ?? ""} ${r.findings.join(" ")}`.toLowerCase();
  const matched = rows.filter((r) => hay(r).includes(token));
  return matched.length > 0 ? matched : rows;
}

const TX_DESC_MAX = 120;

function truncateTxDesc(s: string): string {
  const t = s.trim();
  if (t.length <= TX_DESC_MAX) return t;
  return `${t.slice(0, TX_DESC_MAX).trim()}…`;
}

function getTreatmentMetaForPlanRow(
  row: PlanTreatmentRow,
): { longevity?: string; downtime?: string; priceRange?: string } {
  const dk = row.key.trim().toLowerCase();
  const byKey = Object.keys(TREATMENT_META).find((k) => k.toLowerCase() === dk);
  if (byKey) return TREATMENT_META[byKey];
  const dn = row.displayName.trim();
  if (TREATMENT_META[dn]) return TREATMENT_META[dn];
  const ci = Object.keys(TREATMENT_META).find(
    (k) => k.toLowerCase() === dn.toLowerCase(),
  );
  if (ci) return TREATMENT_META[ci];
  return {};
}

function planRowDescription(row: PlanTreatmentRow): string {
  const parts: string[] = [];
  if (row.interest) parts.push(row.interest);
  for (const f of row.findings.slice(0, 3)) {
    if (f.trim()) parts.push(f.trim());
  }
  return truncateTxDesc(
    parts.join(" · ") ||
      "Videos, pricing, and real before/afters are in your guide below.",
  );
}

type TxReaction = "like" | "dislike";

/**
 * Filled thumb icons (Material-style silhouettes) — read clearly at small sizes vs. thin strokes.
 */
function IconThumbUp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3-7c.09-.23.14-.47.14-.73v-2z" />
    </svg>
  );
}

function IconThumbDown({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3 7c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z" />
    </svg>
  );
}

/** Chevron left — matches patient-overview v0 SuggestionCard back control */
function IconChevronLeft({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

/** Photo / gallery — matches v0 “View Treatment Outcomes” affordance */
function IconGuideOutline({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" fill="currentColor" stroke="none" />
      <path d="M21 15l-5-5-4 4-3-3-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Full-screen treatment detail — layout aligned with patient-overview SuggestionCard. */
export function PvbTreatmentPlanDetailSubpage({
  row,
  casePhotos = [],
  suggestionCards,
  heroPhotoFallbackUrl,
  onBack,
  onJumpToTreatment,
  blueprintAnalyticsBase,
}: {
  row: PlanTreatmentRow;
  casePhotos?: BlueprintCasePhoto[];
  /** Patient-records API cards (AI summary + area-cropped photos), keyed by suggestion name */
  suggestionCards?: PatientSuggestionCard[];
  /** Front photo when no case / suggestion image */
  heroPhotoFallbackUrl?: string | null;
  onBack: () => void;
  onJumpToTreatment: (anchorId: string) => void;
  blueprintAnalyticsBase?: BlueprintPatientAnalyticsBase;
}) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [row.key]);

  const [reaction, setReaction] = useState<TxReaction | null>(null);
  const matchedSuggestion = useMemo(
    () => findPatientSuggestionCardForPlanRow(row, suggestionCards ?? []),
    [row, suggestionCards],
  );
  const photoUrl = pickSuggestionOrCasePhotoForPlanRow(
    row,
    casePhotos,
    matchedSuggestion,
    heroPhotoFallbackUrl,
  );
  const meta = getTreatmentMetaForPlanRow(row);
  const initials = row.displayName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const setReactionToggle = (next: TxReaction) => {
    setReaction((r) => {
      const neu = r === next ? null : next;
      if (blueprintAnalyticsBase) {
        queueMicrotask(() => {
          trackPostVisitBlueprintEvent("blueprint_plan_feedback_reaction", {
            ...blueprintAnalyticsBase,
            context: "treatment_subpage",
            treatment_key: row.key,
            reaction: neu,
          });
        });
      }
      return neu;
    });
  };

  const metaLine =
    [meta.priceRange, meta.downtime, meta.longevity].filter(Boolean).join(" · ") || null;

  const hasSuggestionAiCopy = Boolean(
    matchedSuggestion?.shortSummary?.trim() || matchedSuggestion?.aiSummary?.trim(),
  );
  const showPlanInterestLine = !hasSuggestionAiCopy && Boolean(row.interest?.trim());
  const hasFindings = row.findings.length > 0;
  const showDescriptionFallback =
    !hasSuggestionAiCopy && !showPlanInterestLine && !hasFindings;

  return (
    <div
      className="pvb-subpage pvb-subpage--treatment-detail pvb-suggestion-page"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pvb-subpage-tx-title"
    >
      <header className="pvb-suggestion-page__header">
        <button type="button" className="pvb-suggestion-page__back" onClick={onBack} aria-label="Back">
          <IconChevronLeft className="pvb-suggestion-page__back-icon" />
        </button>
      </header>

      <div className="pvb-suggestion-page__content">
        <div className="pvb-suggestion-page__photo">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={
                matchedSuggestion?.areaNames?.trim()
                  ? `Cropped view — ${matchedSuggestion.areaNames.trim()}`
                  : ""
              }
              className="pvb-suggestion-page__photo-img"
              loading="lazy"
            />
          ) : (
            <div className="pvb-suggestion-page__photo-placeholder">
              <span className="pvb-suggestion-page__photo-initials">{initials || "?"}</span>
            </div>
          )}
        </div>

        <div className="pvb-suggestion-page__info">
          <h1 className="pvb-suggestion-page__title" id="pvb-subpage-tx-title">
            {row.displayName}
          </h1>
          {metaLine ? <p className="pvb-suggestion-page__area">{metaLine}</p> : null}
        </div>

        <div className="pvb-suggestion-page__description">
          {hasSuggestionAiCopy && matchedSuggestion ? (
            <div className="pvb-suggestion-page__suggestion-copy">
              {matchedSuggestion.shortSummary?.trim() ? (
                <p className="pvb-suggestion-page__short-summary">
                  {matchedSuggestion.shortSummary.trim()}
                </p>
              ) : null}
              {matchedSuggestion.aiSummary?.trim() ? (
                <div className="pvb-suggestion-page__ai-detail">
                  <p className="pvb-suggestion-page__ai-detail-text">
                    {matchedSuggestion.aiSummary.trim()}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
          {showPlanInterestLine ? (
            <p className="pvb-suggestion-page__text">{row.interest}</p>
          ) : null}
          {hasFindings ? (
            <p className="pvb-suggestion-page__text">{row.findings.join(" · ")}</p>
          ) : null}
          {showDescriptionFallback ? (
            <p className="pvb-suggestion-page__text pvb-suggestion-page__text--muted">
              Videos, pricing, and real before/afters are in your personalized guide below.
            </p>
          ) : null}
        </div>

        <button
          type="button"
          className="pvb-suggestion-page__outcomes-btn"
          onClick={() => {
            if (blueprintAnalyticsBase) {
              trackPostVisitBlueprintEvent("blueprint_subpage_jump_to_guide", {
                ...blueprintAnalyticsBase,
                treatment_key: row.key,
                anchor_id: row.anchorId,
              });
            }
            onJumpToTreatment(row.anchorId);
          }}
        >
          <IconGuideOutline className="pvb-suggestion-page__outcomes-icon" />
          <span>View full section in your guide</span>
        </button>
      </div>

      <div
        className="pvb-suggestion-page__footer"
        role="group"
        aria-label="Interested or not interested"
      >
        <button
          type="button"
          className={`pvb-suggestion-page__action pvb-suggestion-page__action--skip${
            reaction === "dislike" ? " pvb-suggestion-page__action--active-skip" : ""
          }`}
          aria-pressed={reaction === "dislike"}
          aria-label="Not interested"
          onClick={() => setReactionToggle("dislike")}
        >
          <IconThumbDown className="pvb-suggestion-page__action-icon" />
        </button>
        <button
          type="button"
          className={`pvb-suggestion-page__action pvb-suggestion-page__action--like${
            reaction === "like" ? " pvb-suggestion-page__action--active-like" : ""
          }`}
          aria-pressed={reaction === "like"}
          onClick={() => setReactionToggle("like")}
        >
          <IconThumbUp className="pvb-suggestion-page__action-icon pvb-suggestion-page__action-icon--inline" />
          <span>I&apos;m interested</span>
        </button>
      </div>
    </div>
  );
}

/** Available treatments list — Details opens full-screen treatment view. */
function PvbRelatedPlanTreatmentsSection({
  rows,
  casePhotos = [],
  patientPhotoFallbackUrl,
  onOpenTreatmentDetails,
  blueprintAnalyticsBase,
}: {
  rows: PlanTreatmentRow[];
  casePhotos?: BlueprintCasePhoto[];
  /** When no Treatment Explorer match, show patient photo so cards stay personal */
  patientPhotoFallbackUrl?: string | null;
  onOpenTreatmentDetails: (row: PlanTreatmentRow) => void;
  blueprintAnalyticsBase?: BlueprintPatientAnalyticsBase;
}) {
  const [reactionByRow, setReactionByRow] = useState<Record<string, TxReaction | null>>({});

  const setRowReaction = (key: string, next: TxReaction) => {
    setReactionByRow((prev) => {
      const cur = prev[key] ?? null;
      const neu = cur === next ? null : next;
      if (blueprintAnalyticsBase) {
        queueMicrotask(() => {
          trackPostVisitBlueprintEvent("blueprint_plan_feedback_reaction", {
            ...blueprintAnalyticsBase,
            context: "analysis_plan_list",
            treatment_key: key,
            reaction: neu,
          });
        });
      }
      return { ...prev, [key]: neu };
    });
  };

  if (rows.length === 0) return null;
  return (
    <section
      className="pvb-subpage__section pvb-subpage__available-treatments"
      aria-label={`Available treatments (${rows.length})`}
    >
      <h2 className="pvb-subpage__h2 pvb-subpage__available-treatments__title">
        Available treatments{" "}
        <span className="pvb-subpage__available-treatments__count">({rows.length})</span>
      </h2>
      <p className="pvb-subpage__hint pvb-subpage__available-treatments__hint">
        Tap <strong>Details</strong> for a full screen with notes and a link to your guide. Use{" "}
        <strong>I&apos;m interested</strong> or the thumb down if an option isn&apos;t for you (saved
        on this device for this session).
      </p>

      <ul className="pvb-tx-card-list">
        {rows.map((row) => {
          const photoUrl =
            pickCasePhotoUrlForPlanRow(row, casePhotos) ??
            patientPhotoFallbackUrl?.trim() ??
            null;
          const meta = getTreatmentMetaForPlanRow(row);
          const desc = planRowDescription(row);
          const initials = row.displayName
            .split(/\s+/)
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
          return (
            <li key={row.key} className="pvb-tx-card-list__item">
              <div className="pvb-tx-card">
                <div className="pvb-tx-card__main-block">
                  <div className="pvb-tx-card__top">
                    {photoUrl ? (
                      <div className="pvb-tx-card__photo-wrap">
                        <img
                          src={photoUrl}
                          alt=""
                          className="pvb-tx-card__photo"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="pvb-tx-card__photo-wrap pvb-tx-card__photo-wrap--placeholder">
                        <span className="pvb-tx-card__photo-initials" aria-hidden>
                          {initials || "?"}
                        </span>
                      </div>
                    )}
                    <div className="pvb-tx-card__info">
                      <div className="pvb-tx-card__title-row">
                        <span className="pvb-tx-card__name">{row.displayName}</span>
                        <button
                          type="button"
                          className="pvb-tx-card__expand-btn"
                          onClick={() => {
                            if (blueprintAnalyticsBase) {
                              trackPostVisitBlueprintEvent(
                                "blueprint_subpage_treatment_details_opened",
                                {
                                  ...blueprintAnalyticsBase,
                                  treatment_key: row.key,
                                  source: "plan_list",
                                },
                              );
                            }
                            onOpenTreatmentDetails(row);
                          }}
                        >
                          <span className="pvb-tx-card__expand-label">Details</span>
                          <span className="pvb-tx-card__expand-chevron" aria-hidden>
                            →
                          </span>
                        </button>
                      </div>
                      <div className="pvb-tx-card__meta">
                        {meta.priceRange ? (
                          <div className="pvb-tx-card__meta-row">
                            <span className="pvb-tx-card__meta-label">Typical price range</span>
                            <span className="pvb-tx-card__meta-value pvb-tx-card__meta-value--price">
                              {meta.priceRange}
                            </span>
                          </div>
                        ) : null}
                        {meta.downtime ? (
                          <div className="pvb-tx-card__meta-row">
                            <span className="pvb-tx-card__meta-label">Recovery / downtime</span>
                            <span className="pvb-tx-card__meta-value pvb-tx-card__meta-value--down">
                              {meta.downtime}
                            </span>
                          </div>
                        ) : null}
                        {meta.longevity ? (
                          <div className="pvb-tx-card__meta-row">
                            <span className="pvb-tx-card__meta-label">How long results often last</span>
                            <span className="pvb-tx-card__meta-value pvb-tx-card__meta-value--long">
                              {meta.longevity}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <p className="pvb-tx-card__desc">{desc}</p>
                </div>

                <div
                  className="pvb-tx-card__reactions pvb-tx-card__reactions--suggestion"
                  role="group"
                  aria-label="Interested or not interested"
                >
                  <button
                    type="button"
                    className={`pvb-tx-card__action pvb-tx-card__action--skip${
                      reactionByRow[row.key] === "dislike" ? " pvb-tx-card__action--active-skip" : ""
                    }`}
                    aria-pressed={reactionByRow[row.key] === "dislike"}
                    aria-label="Not interested"
                    onClick={() => setRowReaction(row.key, "dislike")}
                  >
                    <IconThumbDown className="pvb-tx-card__action-icon" />
                  </button>
                  <button
                    type="button"
                    className={`pvb-tx-card__action pvb-tx-card__action--like${
                      reactionByRow[row.key] === "like" ? " pvb-tx-card__action--active-like" : ""
                    }`}
                    aria-pressed={reactionByRow[row.key] === "like"}
                    onClick={() => setRowReaction(row.key, "like")}
                  >
                    <IconThumbUp className="pvb-tx-card__action-icon pvb-tx-card__action-icon--inline" />
                    <span>I&apos;m interested</span>
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function PvbCategoryDetailSubpage({
  cat,
  animate,
  planRows,
  casePhotos,
  detectedIssueLabels,
  onBack,
  onOpenTreatmentDetails,
  onOpenEyeAreaDetails,
  patientPhotoUrl,
  blueprintAnalyticsBase,
}: {
  cat: SnapshotCategory;
  animate: boolean;
  planRows: PlanTreatmentRow[];
  /** Treatment Explorer photos (same pool as results cards) — optional thumbnails on plan rows */
  casePhotos?: BlueprintCasePhoto[];
  /** Same source as Analysis Overview — used to mark ✓/✕ on each feature */
  detectedIssueLabels: string[];
  onBack: () => void;
  onOpenTreatmentDetails: (row: PlanTreatmentRow) => void;
  /** When this category includes Eye Area / Brow & Eyes sub-scores, opens the Eyes face-area subpage */
  onOpenEyeAreaDetails?: () => void;
  /** Front / scan reference (same as page hero) */
  patientPhotoUrl?: string | null;
  blueprintAnalyticsBase?: BlueprintPatientAnalyticsBase;
}) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [cat.key]);

  const detectedIssues = useMemo(
    () => normalizedDetectedIssuesFromLabels(detectedIssueLabels),
    [detectedIssueLabels],
  );

  const catResult = snapshotToCategoryResult(cat);
  const relevantPlans = filterPlanRowsForCategory(planRows, cat.key);

  const showEyeAreaCta = useMemo(
    () =>
      onOpenEyeAreaDetails
        ? resolveBlueprintCategorySubScores(cat).some((s) =>
            EYE_RELATED_SUB_SCORES.has(s.name),
          )
        : false,
    [cat, onOpenEyeAreaDetails],
  );

  return (
    <div className="pvb-subpage" role="dialog" aria-modal="true" aria-labelledby="pvb-subpage-cat-title">
      <header className="pvb-subpage__topbar">
        <button type="button" className="pvb-subpage__back" onClick={onBack}>
          ← Back
        </button>
      </header>
      <div className="pvb-subpage__inner">
        <p className="pvb-subpage__eyebrow">Category</p>
        <h1 className="pvb-subpage__title" id="pvb-subpage-cat-title">
          {cat.name}
        </h1>

        <div
          className={`pvb-subpage__hero pvb-subpage__hero--category${
            patientPhotoUrl?.trim() ? " pvb-subpage__hero--category-with-photo" : ""
          }`}
        >
          <PvbPatientReferencePhoto url={patientPhotoUrl} caption="Your scan" />
          <CategoryGauge score={cat.score} animate={animate} tier={cat.tier} />
        </div>

        {showEyeAreaCta && onOpenEyeAreaDetails ? (
          <div className="pvb-subpage__eye-area-cta">
            <button
              type="button"
              className="pvb-subpage__cta-eye"
              onClick={() => {
                if (blueprintAnalyticsBase) {
                  trackPostVisitBlueprintEvent("blueprint_subpage_eye_area_cta_clicked", {
                    ...blueprintAnalyticsBase,
                    category_key: cat.key,
                  });
                }
                onOpenEyeAreaDetails?.();
              }}
            >
              View Eye area details
              <span aria-hidden> →</span>
            </button>
          </div>
        ) : null}

        <section className="pvb-subpage__section" aria-label="Feature breakdown">
          <h2 className="pvb-subpage__h2">Feature breakdown</h2>
          <p className="pvb-subpage__hint">
            Same view as Analysis Overview — tap a row to expand. ✓ features look good on the
            model; ✕ were noted in your scan.
          </p>
          <div className="ao-detail__subscore-list">
            {catResult.subScores.map((s) => (
              <SubScoreFeatureRow
                key={s.name}
                subScore={s}
                issues={
                  CATEGORIES.find((c) => c.key === cat.key)?.subScores.find(
                    (ss) => ss.name === s.name,
                  )?.issues ?? []
                }
                detectedIssues={detectedIssues}
                animate={animate}
              />
            ))}
          </div>
        </section>

        <PvbRelatedPlanTreatmentsSection
          rows={relevantPlans}
          casePhotos={casePhotos}
          patientPhotoFallbackUrl={patientPhotoUrl}
          onOpenTreatmentDetails={onOpenTreatmentDetails}
          blueprintAnalyticsBase={blueprintAnalyticsBase}
        />

        <button type="button" className="pvb-subpage__footer-cta" onClick={onBack}>
          ← Back to overview
        </button>
      </div>
    </div>
  );
}

export function PvbAreaDetailSubpage({
  area,
  animate,
  planRows,
  casePhotos,
  detectedIssueLabels,
  onBack,
  onOpenTreatmentDetails,
  patientPhotoUrl,
  blueprintAnalyticsBase,
}: {
  area: SnapshotArea;
  animate: boolean;
  planRows: PlanTreatmentRow[];
  casePhotos?: BlueprintCasePhoto[];
  detectedIssueLabels: string[];
  onBack: () => void;
  onOpenTreatmentDetails: (row: PlanTreatmentRow) => void;
  patientPhotoUrl?: string | null;
  blueprintAnalyticsBase?: BlueprintPatientAnalyticsBase;
}) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [area.name]);

  const detectedIssues = useMemo(
    () => normalizedDetectedIssuesFromLabels(detectedIssueLabels),
    [detectedIssueLabels],
  );
  const themes = useMemo(
    () => summarizeAreaThemes(area.name, detectedIssues),
    [area.name, detectedIssues],
  );

  const areaResult = snapshotToAreaResult(area);
  const narrative = getAreaDescriptionForPatient(areaResult);
  const strengths = area.strengths ?? [];
  const improvements = area.improvements ?? [];
  const relevantPlans = filterPlanRowsForArea(planRows, area.name);

  const size = 90;
  const strokeWidth = 7;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = animate ? (area.score / 100) * circumference : 0;
  const offset = circumference - progress;
  const color = tierColor(scoreTier(area.score));

  return (
    <div className="pvb-subpage" role="dialog" aria-modal="true" aria-labelledby="pvb-subpage-area-title">
      <header className="pvb-subpage__topbar">
        <button type="button" className="pvb-subpage__back" onClick={onBack}>
          ← Back
        </button>
      </header>
      <div className="pvb-subpage__inner">
        <p className="pvb-subpage__eyebrow">
          Face area
          {area.hasInterest ? (
            <span className="pvb-subpage__interest-badge" title="You highlighted this area">
              {" "}
              ★ Focus
            </span>
          ) : null}
        </p>
        <h1 className="pvb-subpage__title" id="pvb-subpage-area-title">
          {area.name}
        </h1>

        <div className="pvb-subpage__hero pvb-subpage__hero--area">
          <PvbPatientReferencePhoto url={patientPhotoUrl} caption="Your photo" />
          <div className="pvb-subpage-gauge pvb-subpage-gauge--sm" style={{ width: size, height: size }} aria-hidden>
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
                  transition: animate ? "stroke-dashoffset 1s ease-out" : "none",
                }}
              />
            </svg>
            <div className="pvb-subpage-gauge__inner">
              <span className="pvb-subpage-gauge__value">{animate ? area.score : 0}</span>
            </div>
          </div>
          <div>
            <p
              className="pvb-subpage__tier-inline"
              style={{ color: tierColor(area.tier) }}
            >
              {tierLabel(area.tier)}
            </p>
            <p className="pvb-subpage__lead">{narrative}</p>
          </div>
        </div>

        {themes.length > 0 ? (
          <section className="pvb-subpage__section" aria-label="Feature breakdown">
            <h2 className="pvb-subpage__h2">Feature breakdown</h2>
            <p className="pvb-subpage__hint">
              Same theme groups as Analysis Overview — expand each row for ✓/✕ on individual
              features.
            </p>
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
        ) : (
          <>
            {strengths.length > 0 ? (
              <section className="pvb-subpage__section">
                <h2 className="pvb-subpage__h2 pvb-subpage__h2--good">In good shape</h2>
                <div className="pvb-subpage__issue-wrap">
                  {strengths.map((t) => (
                    <span key={t} className="pvb-subpage__issue pvb-subpage__issue--good">
                      {t}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="pvb-subpage__section">
              <h2 className="pvb-subpage__h2 pvb-subpage__h2--imp">Noted in your scan</h2>
              {improvements.length > 0 ? (
                <div className="pvb-subpage__issue-wrap">
                  {improvements.map((t) => (
                    <span key={t} className="pvb-subpage__issue pvb-subpage__issue--imp">
                      {t}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="pvb-subpage__none">No concerns flagged in this region.</p>
              )}
            </section>
          </>
        )}

        <PvbRelatedPlanTreatmentsSection
          rows={relevantPlans}
          casePhotos={casePhotos}
          patientPhotoFallbackUrl={patientPhotoUrl}
          onOpenTreatmentDetails={onOpenTreatmentDetails}
          blueprintAnalyticsBase={blueprintAnalyticsBase}
        />

        <button type="button" className="pvb-subpage__footer-cta" onClick={onBack}>
          ← Back to overview
        </button>
      </div>
    </div>
  );
}
