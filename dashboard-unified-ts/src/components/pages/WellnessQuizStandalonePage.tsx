/**
 * Public wellness quiz (SMS link) — no dashboard. Saves via POST /api/wellness-quiz/submit.
 */

import { useState, useEffect } from "react";
import { parseWellnessQuizParams } from "../../utils/wellnessQuizLink";
import { submitWellnessQuizFromLink, fetchWellnessQuizResultsFromLink } from "../../services/api";
import {
  WELLNESS_QUIZ,
  buildWellnessQuizPayload,
  getSuggestedWellnessTreatments,
  getWellnessQuizDisplayCategoryScores,
  getWellnessSeverityRecord,
  getWellnessSeveritySourceIndices,
  type WellnessQuizAnswersMap,
} from "../../data/wellnessQuiz";
import type { WellnessQuizData } from "../../types";
import WellnessQuizResultsCards from "../wellnessQuiz/WellnessQuizResultsCards";
import "../modals/WellnessQuizModal.css";
import "./WellnessQuizStandalonePage.css";

type Phase = "intro" | "questions" | "results" | "invalid";

export default function WellnessQuizStandalonePage() {
  const params = parseWellnessQuizParams();
  const [phase, setPhase] = useState<Phase>(() => (params ? "intro" : "invalid"));
  const [answers, setAnswers] = useState<WellnessQuizAnswersMap>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(!!params);
  const [initialLoaded, setInitialLoaded] = useState<WellnessQuizData | null>(null);

  const questions = WELLNESS_QUIZ.questions;
  const question = questions[currentIndex];
  const severitySourceQuestion = question?.severityForQuestionId
    ? questions.find((q) => q.id === question.severityForQuestionId)
    : undefined;
  const isLast = currentIndex === questions.length - 1;
  const isMultiSelect = Boolean(question?.multiSelect);
  const isSeverityStep = Boolean(question?.severityForQuestionId);
  const contraindicationNoneIdx = question?.contraindicationNoneIndex ?? -1;
  const hasContraindicationWarning =
    question?.contraindicationNoneIndex !== undefined &&
    Array.isArray(answers[question.id]) &&
    (answers[question.id] as number[]).some((i) => i !== contraindicationNoneIdx);
  const selectedForMulti = (answers[question?.id ?? ""] as number[] | undefined) ?? [];
  const severitySourceIndices =
    question && isSeverityStep ? getWellnessSeveritySourceIndices(question, answers) : [];
  const hasAnswer = question
    ? isMultiSelect
      ? selectedForMulti.length > 0
      : isSeverityStep
        ? severitySourceIndices.length === 0 ||
          severitySourceIndices.every((i) => {
            const rec = answers[question.id] as Record<string, number> | undefined;
            return typeof rec?.[String(i)] === "number";
          })
        : typeof answers[question.id] === "number" && (answers[question.id] as number) >= 0
    : false;

  useEffect(() => {
    if (!params) setPhase("invalid");
  }, [params]);

  useEffect(() => {
    if (!params || !loadingExisting) return;
    let cancelled = false;
    fetchWellnessQuizResultsFromLink(params.recordId, params.tableName)
      .then((data) => {
        if (cancelled || !data) return;
        setInitialLoaded(data);
        setAnswers(data.answers);
        setPhase("results");
      })
      .catch(() => {
        /* no results or error — stay on intro */
      })
      .finally(() => {
        if (!cancelled) setLoadingExisting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params, loadingExisting]);

  useEffect(() => {
    if (phase !== "questions" || !question?.severityForQuestionId) return;
    setAnswers((a) => {
      const src = getWellnessSeveritySourceIndices(question, a);
      if (src.length === 0) return a;
      const qid = question.id;
      const cur = getWellnessSeverityRecord(a, qid);
      const next: Record<string, number> = { ...cur };
      let changed = false;
      for (const i of src) {
        if (next[String(i)] === undefined) {
          next[String(i)] = 2;
          changed = true;
        }
      }
      return changed ? { ...a, [qid]: next } : a;
    });
  }, [phase, currentIndex, question?.id, question?.severityForQuestionId]);

  const performSave = async (answersToSave: WellnessQuizAnswersMap) => {
    if (!params) return false;
    const payload = buildWellnessQuizPayload(answersToSave);
    await submitWellnessQuizFromLink(params.recordId, params.tableName, payload);
    return true;
  };

  const goBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    } else {
      setPhase("intro");
    }
  };

  const handleStartQuiz = () => {
    setSaveError(null);
    setInitialLoaded(null);
    setPhase("questions");
  };

  const handleSingleSelect = (questionId: string, answerIndex: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answerIndex }));
  };

  const handleMultiToggle = (questionId: string, answerIndex: number) => {
    const current = (answers[questionId] as number[] | undefined) ?? [];
    const q = questions.find((q) => q.id === questionId);
    const noneIdx = q?.contraindicationNoneIndex ?? -1;

    let next: number[];
    if (noneIdx >= 0 && answerIndex === noneIdx) {
      next = current.includes(noneIdx) ? [] : [noneIdx];
    } else if (noneIdx >= 0) {
      const toggled = current.includes(answerIndex)
        ? current.filter((i) => i !== answerIndex)
        : [...current, answerIndex];
      next = toggled.filter((i) => i !== noneIdx).sort((a, b) => a - b);
    } else {
      next = current.includes(answerIndex)
        ? current.filter((i) => i !== answerIndex)
        : [...current, answerIndex].sort((a, b) => a - b);
    }

    const patch: WellnessQuizAnswersMap = { ...answers, [questionId]: next };
    if (questionId === "goals") {
      const prev = getWellnessSeverityRecord(patch, "goalsSeverity");
      const pruned: Record<string, number> = {};
      for (const i of next) {
        const k = String(i);
        if (prev[k] !== undefined) pruned[k] = prev[k];
      }
      patch.goalsSeverity = pruned;
    }
    if (questionId === "conditions") {
      const prev = getWellnessSeverityRecord(patch, "conditionsSeverity");
      const pruned: Record<string, number> = {};
      for (const i of next) {
        const k = String(i);
        if (prev[k] !== undefined) pruned[k] = prev[k];
      }
      patch.conditionsSeverity = pruned;
    }
    setAnswers(patch);
  };

  const handleSeverityPick = (questionId: string, answerIndex: number, severity: number) => {
    setAnswers((prev) => {
      const cur = getWellnessSeverityRecord(prev, questionId);
      return {
        ...prev,
        [questionId]: { ...cur, [String(answerIndex)]: severity },
      };
    });
  };

  const handleNext = () => {
    if (isLast) {
      setSaveError(null);
      setLoading(true);
      const next = { ...answers };
      performSave(next)
        .then(() => {
          setLoading(false);
          setPhase("results");
        })
        .catch((e) => {
          setLoading(false);
          setSaveError((e as Error)?.message ?? "Could not save. Please try again.");
          setPhase("results");
        });
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  const handleRetake = () => {
    setAnswers({});
    setCurrentIndex(0);
    setInitialLoaded(null);
    setSaveError(null);
    setPhase("intro");
  };

  if (!params) {
    return (
      <div className="wellness-quiz-standalone">
        <div className="wellness-quiz-standalone__inner wellness-quiz-modal-content">
          <div className="wellness-quiz-standalone__invalid">
            <h1>Invalid or expired link</h1>
            <p>This link is invalid or has expired. Please request a new link from your provider.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loadingExisting) {
    return (
      <div className="wellness-quiz-standalone">
        <div className="wellness-quiz-standalone__inner wellness-quiz-modal-content">
          <p className="wellness-quiz-standalone__loading">Loading your results…</p>
        </div>
      </div>
    );
  }

  const resultAnswers = initialLoaded?.answers ?? answers;
  const resultsSnapshot =
    phase === "results"
      ? initialLoaded ?? buildWellnessQuizPayload(resultAnswers)
      : null;
  const suggestedTreatments =
    resultsSnapshot != null ? getSuggestedWellnessTreatments(resultsSnapshot) : [];
  const domainScores =
    resultsSnapshot != null ? getWellnessQuizDisplayCategoryScores(resultsSnapshot) : [];

  return (
    <div className="wellness-quiz-standalone">
      <div className="wellness-quiz-standalone__inner wellness-quiz-modal-content">
        <div className="wellness-quiz-header wellness-quiz-standalone__header">
          <h1 className="wellness-quiz-title">
            {phase === "intro"
              ? "Wellness quiz"
              : phase === "questions"
                ? `Question ${currentIndex + 1} of ${questions.length}`
                : "Your results"}
          </h1>
        </div>

        {phase === "intro" && (
          <div className="wellness-quiz-body">
            <p className="wellness-quiz-intro">
              This intake quiz identifies which peptide and wellness treatments may be worth discussing with your provider. Answer {questions.length} questions across key health domains — your responses generate a personalized match profile.
            </p>
            <div className="wellness-quiz-intro-domains">
              {[
                "Physical Activity",
                "Injury & Recovery",
                "Gut Health",
                "Energy & Vitality",
                "Sleep Quality",
                "Cognitive Health",
                "Mood & Stress",
                "Body Composition",
                "Skin Health",
                "Bone & Joint",
                "Longevity",
              ].map((d) => (
                <span key={d} className="wellness-quiz-intro-domain-chip">{d}</span>
              ))}
            </div>
            <button
              type="button"
              className="wellness-quiz-btn wellness-quiz-btn--primary"
              onClick={handleStartQuiz}
            >
              Begin quiz
            </button>
            <p className="wellness-quiz-intro-note">
              Results are for discussion with your provider only. Compounds may be investigational and
              not FDA-approved for general use.
            </p>
          </div>
        )}

        {phase === "questions" && question && (
          <div className="wellness-quiz-body">
            <p className="wellness-quiz-question-category">{question.title}</p>
            <p className="wellness-quiz-question-text">{question.question}</p>
            <div className="wellness-quiz-answers">
              {isMultiSelect ? (
                <>
                  <div className="wellness-quiz-chips">
                    {question.answers.map((a, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className={`wellness-quiz-chip ${selectedForMulti.includes(idx) ? "wellness-quiz-chip--selected" : ""}`}
                        onClick={() => handleMultiToggle(question.id, idx)}
                      >
                        <span className="wellness-quiz-chip-label">{a.label}</span>
                      </button>
                    ))}
                  </div>
                  {hasContraindicationWarning && (
                    <div className="wellness-quiz-contraindication-warning" role="alert">
                      <strong>Heads up:</strong> One or more of these conditions may affect which
                      treatments are appropriate. Your provider will review your answers before making
                      any recommendation — you can continue the quiz.
                    </div>
                  )}
                </>
              ) : isSeverityStep ? (
                <div className="wellness-quiz-severity-block">
                  {severitySourceIndices.length === 0 ? (
                    <p className="wellness-quiz-severity-skip-note">
                      Nothing to rate on this step — continue.
                    </p>
                  ) : (
                    severitySourceIndices.map((idx) => {
                      const label =
                        severitySourceQuestion?.answers[idx]?.label ?? `Option ${idx + 1}`;
                      const rec =
                        (answers[question.id] as Record<string, number> | undefined) ?? {};
                      const val = rec[String(idx)] ?? 2;
                      return (
                        <div key={`${question.id}-${idx}`} className="wellness-quiz-severity-row">
                          <div className="wellness-quiz-severity-row-label">{label}</div>
                          <div
                            className="wellness-quiz-impact-scale"
                            role="group"
                            aria-label={`Day-to-day impact for ${label}`}
                          >
                            {[0, 1, 2, 3, 4].map((s) => (
                              <button
                                key={s}
                                type="button"
                                className={`wellness-quiz-impact-btn ${
                                  val === s ? "wellness-quiz-impact-btn--selected" : ""
                                }`}
                                onClick={() => handleSeverityPick(question.id, idx, s)}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                question.answers.map((a, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`wellness-quiz-answer-btn ${
                      answers[question.id] === idx ? "wellness-quiz-answer-btn--selected" : ""
                    }`}
                    onClick={() => handleSingleSelect(question.id, idx)}
                  >
                    {a.label}
                  </button>
                ))
              )}
            </div>
            <div className="wellness-quiz-question-footer-nav">
              <button
                type="button"
                className="wellness-quiz-btn wellness-quiz-btn--secondary"
                onClick={goBack}
              >
                Back
              </button>
              <button
                type="button"
                className="wellness-quiz-btn wellness-quiz-btn--primary"
                onClick={handleNext}
                disabled={!hasAnswer || (isLast && loading)}
              >
                {isLast ? "See results" : "Next"}
              </button>
            </div>
            {isLast && loading && <p className="wellness-quiz-loading">Saving…</p>}
          </div>
        )}

        {phase === "results" && (
          <div className="wellness-quiz-body wellness-quiz-results-body">
            {saveError && <p className="wellness-quiz-error wellness-quiz-standalone__error">{saveError}</p>}
            {loading ? (
              <p className="wellness-quiz-loading">Saving…</p>
            ) : (
              <>
                <p className="wellness-quiz-results-intro">
                  {suggestedTreatments.length > 0
                    ? "Based on your answers and how much each area matters to you, the following treatments may be a fit for discussion with your provider."
                    : domainScores.length > 0
                      ? "Here is how strongly your answers point toward different wellness focus areas. No specific peptides met the match threshold — consider discussing goals with your provider."
                      : "No specific treatments matched. Consider retaking the quiz or discussing your goals directly with your provider."}
                </p>
                {suggestedTreatments.length === 0 && domainScores.length === 0 ? null : (
                  <WellnessQuizResultsCards
                    suggestedTreatments={suggestedTreatments}
                    answers={resultAnswers}
                    categoryScores={domainScores}
                  />
                )}
                <div className="wellness-quiz-footer">
                  <button
                    type="button"
                    className="wellness-quiz-btn wellness-quiz-btn--secondary"
                    onClick={handleRetake}
                  >
                    Retake quiz
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
