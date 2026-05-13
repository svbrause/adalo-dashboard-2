/**
 * Suggested treatments from the wellness quiz: name, category, short blurb, optional
 * "Your answers" line, optional intake-goal alignment (Wellnest), and add-to-treatment-plan
 * when used from the dashboard.
 */

import {
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  computeWellnessTreatmentScores,
  getWellnessQuizDisplayCategoryScores,
  getWellnessQuizDomainBreakdown,
  getWellnessQuizMatchAnswerLabelsForTreatment,
  getWellnessQuizMatchBreakdownForTreatment,
  getWellnessQuizMatchReasons,
  scoreIntakeGoalsAgainstWellnestCorpus,
  WELLNESS_TREATMENTS,
  type WellnessQuizAnswersMap,
  type WellnessTreatment,
} from "../../data/wellnessQuiz";
import type { WellnessQuizCategoryScore } from "../../types";
import { getWellnestOfferingByTreatmentName, WELLNEST_BROWSE_GROUP_DESCRIPTIONS } from "../../data/wellnestOfferings";
import type { TreatmentPlanPrefill } from "../modals/DiscussedTreatmentsModal/TreatmentPhotos";
import "../modals/WellnessQuizModal.css";

function InfoTip({ text, align = "center" }: { text: string; align?: "left" | "center" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const handleKeyDown = (e: ReactKeyboardEvent<HTMLSpanElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((o) => !o);
    }
  };
  return (
    <span
      ref={ref}
      className="wq-info-tip"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        role="button"
        tabIndex={0}
        className="wq-info-tip__btn"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label="More information"
      >
        i
      </span>
      {open && (
        <span className={`wq-info-tip__bubble wq-info-tip__bubble--${align}`} role="tooltip">
          {text}
        </span>
      )}
    </span>
  );
}

const META_MAX = 160;
/** How many peptide rows show before "Show all" (long lists are overwhelming). */
const PEPTIDES_INITIAL_VISIBLE = 5;

/** One patient-facing line: prefer summary; avoid duplicating the long addresses blob used elsewhere. */
function treatmentMetaLine(t: WellnessTreatment): string {
  const sum = t.summary?.trim();
  if (sum) {
    return sum.length > META_MAX ? `${sum.slice(0, META_MAX - 1).trim()}…` : sum;
  }
  const addr = t.whatItAddresses?.trim();
  if (addr) {
    return addr.length > META_MAX
      ? `${addr.slice(0, META_MAX - 1).trim()}…`
      : addr;
  }
  return t.category?.trim() ?? "";
}

export interface WellnessQuizResultsCardsProps {
  suggestedTreatments: WellnessTreatment[];
  /** Saved quiz answers (used to show "How this matches your answers"). */
  answers: WellnessQuizAnswersMap;
  /** Precomputed domain emphasis (bars); if omitted, derived from answers. */
  categoryScores?: WellnessQuizCategoryScore[];
  onAddToPlan?: (prefill: TreatmentPlanPrefill) => void;
  /** Wellnest: intake wellness goals — used to explain how each suggestion aligns with charted goals. */
  intakeWellnessGoals?: string[];
  /** Max peptide cards before expand; default {@link PEPTIDES_INITIAL_VISIBLE}. */
  peptidesInitialVisible?: number;
}

export default function WellnessQuizResultsCards({
  suggestedTreatments,
  answers,
  categoryScores: categoryScoresProp,
  onAddToPlan,
  intakeWellnessGoals,
  peptidesInitialVisible = PEPTIDES_INITIAL_VISIBLE,
}: WellnessQuizResultsCardsProps) {
  const [peptidesExpanded, setPeptidesExpanded] = useState(false);

  const domainRows = getWellnessQuizDisplayCategoryScores({
    answers,
    categoryScores: categoryScoresProp,
  });

  /**
   * When `answers` is empty (legacy rows or quiz JSON not loaded on the client), every weighted
   * score is 0 and match % would read as 0%. Fall back to rank by saved suggestion list order.
   */
  const { treatmentScores, matchPercentUsesListOrderFallback } = useMemo(() => {
    const natural = computeWellnessTreatmentScores(answers);
    let maxNat = 0;
    for (const t of suggestedTreatments) {
      maxNat = Math.max(maxNat, natural[t.id] ?? 0);
    }
    if (maxNat > 0 || suggestedTreatments.length <= 1) {
      return {
        treatmentScores: natural,
        matchPercentUsesListOrderFallback: false,
      };
    }
    const n = suggestedTreatments.length;
    const rank: Record<string, number> = {};
    suggestedTreatments.forEach((t, i) => {
      rank[t.id] = n - i;
    });
    return {
      treatmentScores: rank,
      matchPercentUsesListOrderFallback: true,
    };
  }, [answers, suggestedTreatments]);

  /** All treatment IDs per browse-group domain — used to explain domain scores by quiz answer. */
  const domainTreatmentIds = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const t of WELLNESS_TREATMENTS) {
      const offering = getWellnestOfferingByTreatmentName(t.name);
      const group = offering?.browseGroup;
      if (!group) continue;
      if (!map[group]) map[group] = new Set();
      map[group].add(t.id);
    }
    return map;
  }, []);

  const sortedSuggested = useMemo(() => {
    if (suggestedTreatments.length <= 1) return suggestedTreatments;
    return [...suggestedTreatments].sort((a, b) => {
      const sa = treatmentScores[a.id] ?? 0;
      const sb = treatmentScores[b.id] ?? 0;
      if (sb !== sa) return sb - sa;
      return a.name.localeCompare(b.name);
    });
  }, [suggestedTreatments, treatmentScores]);

  const maxPeptideMatchScore = useMemo(() => {
    let m = 0;
    for (const t of sortedSuggested) {
      m = Math.max(m, treatmentScores[t.id] ?? 0);
    }
    return m;
  }, [sortedSuggested, treatmentScores]);

  const visiblePeptides =
    peptidesExpanded || sortedSuggested.length <= peptidesInitialVisible
      ? sortedSuggested
      : sortedSuggested.slice(0, peptidesInitialVisible);
  const hiddenPeptideCount = sortedSuggested.length - peptidesInitialVisible;
  const peptideMatchExplainerId = useId();
  const comparePeptideScoresAmongList = sortedSuggested.length > 1;

  if (suggestedTreatments.length === 0 && domainRows.length === 0) return null;

  return (
    <div className="wellness-quiz-results-stack">
      {domainRows.length > 0 ? (
        <section
          className="wellness-quiz-domain-scores"
          aria-label="Wellness focus emphasis from your quiz"
        >
          <h3 className="wellness-quiz-domain-scores__title">Focus emphasis</h3>
          <div className="wellness-quiz-domain-bars">
            {domainRows.map((row) => {
              const domainBreakdown = getWellnessQuizDomainBreakdown(
                answers,
                domainTreatmentIds[row.id] ?? new Set(),
              );
              const domainInfoText = WELLNEST_BROWSE_GROUP_DESCRIPTIONS[row.id] ?? row.label;
              return (
                <div key={row.id} className="wellness-quiz-domain-row wellness-quiz-domain-row--expanded">
                  <div className="wellness-quiz-domain-row-top">
                    <span className="wellness-quiz-domain-label">
                      {row.label}
                      <InfoTip text={domainInfoText} align="left" />
                    </span>
                    <div className="wellness-quiz-domain-bar-wrap">
                      <div
                        className="wellness-quiz-domain-bar"
                        style={{ width: `${row.percent}%` }}
                      />
                    </div>
                    <span className="wellness-quiz-domain-value">{Math.round(row.raw)} pts</span>
                  </div>
                  {domainBreakdown.length > 0 && (
                    <div className="wellness-quiz-domain-why-chips">
                      {domainBreakdown.slice(0, 3).map((item) => {
                        const shortAnswer = item.answerLabel.includes(" — ")
                          ? item.answerLabel.split(" — ")[0].trim()
                          : item.answerLabel;
                        return (
                          <span key={item.questionTitle} className="wellness-quiz-domain-why-chip">
                            <span className="wellness-quiz-domain-why-chip__topic">{item.questionTitle}:</span>
                            {shortAnswer}
                            <span className="wellness-quiz-domain-why-chip__pts">+{Math.round(item.points)}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
      {suggestedTreatments.length === 0 ? null : (
        <>
          {comparePeptideScoresAmongList && matchPercentUsesListOrderFallback ? (
            <p
              className="wellness-quiz-peptide-match-explainer"
              id={peptideMatchExplainerId}
            >
              <strong>No quiz answer weights on this record.</strong> Match ranking follows the saved suggestion order until quiz answers are available.
            </p>
          ) : null}
          <ul
            className="wellness-quiz-treatment-list wellness-quiz-treatment-list--compact wellness-quiz-results-cards-inline wellness-quiz-peptide-suggestions"
            aria-describedby={
              comparePeptideScoresAmongList ? peptideMatchExplainerId : undefined
            }
          >
            {visiblePeptides.map((t) => {
        const meta = treatmentMetaLine(t);
        const matchBreakdown = getWellnessQuizMatchBreakdownForTreatment(answers, t.id);
        const matchLabels = getWellnessQuizMatchAnswerLabelsForTreatment(answers, t.id);
        const matchReasonLines = getWellnessQuizMatchReasons(answers, t.id);
        const reasonSummary =
          matchReasonLines.length > 0
            ? matchReasonLines.slice(0, 2).join(" · ")
            : "";
        const offering = getWellnestOfferingByTreatmentName(t.name);
        const goalCorpus = [
          t.summary ?? "",
          t.whatItAddresses,
          t.category,
          t.name,
          offering?.addresses ?? "",
          offering?.category ?? "",
          offering?.notes ?? "",
        ]
          .filter(Boolean)
          .join(" ");
        const goalMatch =
          intakeWellnessGoals && intakeWellnessGoals.length > 0
            ? scoreIntakeGoalsAgainstWellnestCorpus(
                intakeWellnessGoals,
                goalCorpus,
                t.matchKeywords,
              )
            : null;
        const goalLine =
          goalMatch && goalMatch.matchedGoals.length > 0
            ? goalMatch.matchedGoals.join(" · ")
            : "";
        const fullMatchTitle =
          matchBreakdown.map((b) => `${b.questionTitle}: ${b.answerLabel} (+${b.points})`).join(" | ") ||
          matchLabels.join(" · ") ||
          reasonSummary ||
          "Suggested from wellness quiz answers";
        const hasSummary = Boolean(t.summary?.trim());
        const rawMatch = treatmentScores[t.id] ?? 0;
        const matchRelativePct =
          maxPeptideMatchScore > 0
            ? Math.round((rawMatch / maxPeptideMatchScore) * 100)
            : sortedSuggested.length <= 1
              ? 100
              : 0;
        const tiesTop =
          comparePeptideScoresAmongList &&
          maxPeptideMatchScore > 0 &&
          rawMatch >= maxPeptideMatchScore - 1e-6;
        const matchLabel = comparePeptideScoresAmongList
          ? matchPercentUsesListOrderFallback
            ? "Suggested"
            : tiesTop
              ? "Best match"
              : matchRelativePct >= 70
                ? "Strong match"
                : matchRelativePct >= 40
                  ? "Good match"
                  : "Possible match"
          : "Suggested";
        return (
          <li
            key={t.id}
            className="wellness-quiz-treatment-card wellness-quiz-treatment-card--results-dense"
          >
            <div className="wellness-quiz-treatment-card-inner">
              <div className="wellness-quiz-treatment-card-main">
                <div className="wellness-quiz-treatment-card-header">
                  <div className="wellness-quiz-treatment-name-row">
                    <div className="wellness-quiz-treatment-name-block">
                      <span className="wellness-quiz-treatment-name">{t.name}</span>
                      {t.category && !hasSummary ? (
                        <span
                          className="wellness-quiz-treatment-category-inline"
                          title={t.category}
                        >
                          {t.category.length > 48
                            ? `${t.category.slice(0, 47).trim()}…`
                            : t.category}
                        </span>
                      ) : null}
                    </div>
                    <span className="wellness-quiz-treatment-match-badge">
                      <span className="wellness-quiz-treatment-match-badge__label">
                        {matchLabel}
                      </span>
                      {comparePeptideScoresAmongList && !tiesTop && !matchPercentUsesListOrderFallback && (
                        <span className="wellness-quiz-treatment-match-badge__pct">
                          {matchRelativePct}%
                        </span>
                      )}
                    </span>
                  </div>
                  {meta ? (
                    <p className="wellness-quiz-treatment-meta" title={meta}>
                      {meta}
                    </p>
                  ) : null}
                </div>
                {matchBreakdown.length > 0 ? (
                  <div className="wellness-quiz-match-breakdown" title={fullMatchTitle}>
                    <span className="wellness-quiz-match-breakdown__label">
                      Why this matched ({Math.round(rawMatch)} pts):
                    </span>
                    <ul className="wellness-quiz-match-breakdown__list">
                      {matchBreakdown.slice(0, 4).map((item) => (
                        <li key={item.questionTitle} className="wellness-quiz-match-breakdown__row">
                          <span className="wellness-quiz-match-breakdown__q">{item.questionTitle}</span>
                          <span className="wellness-quiz-match-breakdown__pts">+{Math.round(item.points)}</span>
                          <span className="wellness-quiz-match-breakdown__a">
                            {item.answerLabel.length > 55
                              ? `${item.answerLabel.slice(0, 53).trim()}…`
                              : item.answerLabel}
                          </span>
                        </li>
                      ))}
                      {matchBreakdown.length > 4 && (
                        <li className="wellness-quiz-match-breakdown__more">
                          +{matchBreakdown.length - 4} more matching answer{matchBreakdown.length - 4 > 1 ? "s" : ""}
                        </li>
                      )}
                    </ul>
                  </div>
                ) : null}
                {goalLine ? (
                  <p
                    className="wellness-quiz-treatment-matches-line wellness-quiz-treatment-matches-line--intake-goals"
                    title={goalMatch!.matchedGoals.join("\n")}
                  >
                    <span className="wellness-quiz-treatment-matches-line__prefix">
                      Relates to your goals:{" "}
                    </span>
                    {goalLine}
                  </p>
                ) : null}
              </div>
              {onAddToPlan ? (
                <div className="wellness-quiz-treatment-actions">
                  <button
                    type="button"
                    className="wellness-quiz-btn wellness-quiz-btn--add-to-plan"
                    onClick={() => {
                      onAddToPlan({
                        interest: "",
                        region: "",
                        treatment: t.name,
                        treatmentProduct: t.category,
                        timeline: "Wishlist",
                        notes:
                          t.whatItAddresses?.trim() ||
                          t.summary?.trim() ||
                          undefined,
                      });
                    }}
                  >
                    Add to plan
                  </button>
                </div>
              ) : null}
            </div>
          </li>
        );
            })}
          </ul>
          {hiddenPeptideCount > 0 ? (
            <div className="wellness-quiz-peptide-expand">
              <button
                type="button"
                className="wellness-quiz-btn wellness-quiz-btn--secondary wellness-quiz-peptide-expand__btn"
                onClick={() => setPeptidesExpanded((e) => !e)}
                aria-expanded={peptidesExpanded}
              >
                {peptidesExpanded
                  ? `Show top ${peptidesInitialVisible} only`
                  : `Show all ${sortedSuggested.length} suggestions (${hiddenPeptideCount} more)`}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
