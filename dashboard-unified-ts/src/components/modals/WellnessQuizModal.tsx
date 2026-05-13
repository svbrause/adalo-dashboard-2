/**
 * Wellness Quiz modal – questions map to Dr Reddy treatment offerings; suggests one or more treatments.
 * Saves to client's "Wellness Quiz" field.
 */

import { useState, FormEvent, useEffect } from "react";
import { Client, WellnessQuizData } from "../../types";
import { updateLeadRecord } from "../../services/api";
import { showToast, showError } from "../../utils/toast";
import {
  WELLNESS_QUIZ,
  buildWellnessQuizPayload,
  getSuggestedWellnessTreatments,
  getWellnessQuizDisplayCategoryScores,
  getWellnessSeverityRecord,
  getWellnessSeveritySourceIndices,
  WELLNESS_QUIZ_FIELD_NAME,
  type WellnessQuizAnswersMap,
} from "../../data/wellnessQuiz";
import type { TreatmentPlanPrefill } from "./DiscussedTreatmentsModal/TreatmentPhotos";
import WellnessQuizResultsCards from "../wellnessQuiz/WellnessQuizResultsCards";
import "./WellnessQuizModal.css";

type QuizPhase = "intro" | "questions" | "results";

interface WellnessQuizModalProps {
  client: Client;
  onClose: () => void;
  onSuccess: () => void;
  savedQuiz?: WellnessQuizData | null;
  /** When provided, each recommended peptide can be added to the client's treatment plan (opens plan modal with prefill). */
  onAddToPlan?: (prefill: TreatmentPlanPrefill) => void;
}

export default function WellnessQuizModal({
  client,
  onClose,
  onSuccess,
  savedQuiz,
  onAddToPlan,
}: WellnessQuizModalProps) {
  const [answers, setAnswers] = useState<WellnessQuizAnswersMap>(
    () => savedQuiz?.answers ?? {},
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<QuizPhase>(() => (savedQuiz ? "results" : "intro"));
  const [loading, setLoading] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const questions = WELLNESS_QUIZ.questions;
  const question = questions[currentIndex];
  const severitySourceQuestion = question?.severityForQuestionId
    ? questions.find((q) => q.id === question.severityForQuestionId)
    : undefined;
  const isLast = currentIndex === questions.length - 1;
  const isMultiSelect = Boolean(question?.multiSelect);
  const isSeverityStep = Boolean(question?.severityForQuestionId);
  const isContraindication = Boolean(question?.contraindicationNoneIndex !== undefined);
  const contraindicationNoneIdx = question?.contraindicationNoneIndex ?? -1;
  const hasContraindicationWarning =
    isContraindication &&
    Array.isArray(answers[question?.id ?? ""]) &&
    (answers[question?.id ?? ""] as number[]).some((i) => i !== contraindicationNoneIdx);
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
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    if (savedQuiz?.answers) {
      setAnswers(savedQuiz.answers);
      setPhase("results");
    }
  }, [savedQuiz]);

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

  const goBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    } else {
      setPhase("intro");
    }
  };

  const handleStartQuiz = () => {
    setPhase("questions");
  };

  /** Single-choice: only records selection; use Next to move forward (so Back/Next works through the whole quiz). */
  const handleSingleSelect = (questionId: string, answerIndex: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answerIndex }));
  };

  const handleMultiToggle = (questionId: string, answerIndex: number) => {
    const current = (answers[questionId] as number[] | undefined) ?? [];
    const q = questions.find((q) => q.id === questionId);
    const noneIdx = q?.contraindicationNoneIndex ?? -1;

    let next: number[];
    if (noneIdx >= 0 && answerIndex === noneIdx) {
      // "None of these apply" — clear everything else
      next = current.includes(noneIdx) ? [] : [noneIdx];
    } else if (noneIdx >= 0) {
      // Any specific condition — deselect "None"
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
    // Prune severity records for any multi-select that has a paired severity question
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
      const next = { ...answers };
      setPhase("results");
      setSaveFailed(false);
      setLoading(true);
      performSave(next)
        .then((ok) => {
          setLoading(false);
          if (ok) {
            showToast("Wellness quiz saved");
            onSuccess();
          } else {
            setSaveFailed(true);
          }
        })
        .catch(() => {
          setLoading(false);
          setSaveFailed(true);
        });
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  const performSave = async (answersToSave: WellnessQuizAnswersMap): Promise<boolean> => {
    try {
      const payload = buildWellnessQuizPayload(answersToSave);
      const quizJson = JSON.stringify(payload);
      await updateLeadRecord(client.id, client.tableSource, {
        [WELLNESS_QUIZ_FIELD_NAME]: quizJson,
      });
      if (client.linkedLeadId) {
        await updateLeadRecord(client.linkedLeadId, "Web Popup Leads", {
          [WELLNESS_QUIZ_FIELD_NAME]: quizJson,
        });
      }
      return true;
    } catch {
      showError("Failed to save wellness quiz. Please try again.");
      return false;
    }
  };

  const handleSaveResults = async (e: FormEvent) => {
    e.preventDefault();
    setSaveFailed(false);
    setLoading(true);
    const payload = buildWellnessQuizPayload(answers);
    try {
      await updateLeadRecord(client.id, client.tableSource, {
        [WELLNESS_QUIZ_FIELD_NAME]: JSON.stringify(payload),
      });
      if (client.linkedLeadId) {
        await updateLeadRecord(client.linkedLeadId, "Web Popup Leads", {
          [WELLNESS_QUIZ_FIELD_NAME]: JSON.stringify(payload),
        });
      }
      showToast("Wellness quiz saved");
      onSuccess();
    } catch {
      setSaveFailed(true);
      showError("Failed to save. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToQuestions = () => {
    setAnswers({});
    setPhase("intro");
    setCurrentIndex(0);
  };

  const resultsSnapshot =
    phase === "results" ? (savedQuiz ?? buildWellnessQuizPayload(answers)) : null;
  const suggestedTreatments =
    resultsSnapshot != null ? getSuggestedWellnessTreatments(resultsSnapshot) : [];
  const domainScores =
    resultsSnapshot != null ? getWellnessQuizDisplayCategoryScores(resultsSnapshot) : [];

  return (
    <div
      className="modal-overlay active wellness-quiz-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wellness-quiz-title"
    >
      <div
        className="wellness-quiz-modal-content modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="wellness-quiz-header">
          <h2 id="wellness-quiz-title" className="wellness-quiz-title">
            {phase === "intro"
              ? "Wellness Quiz"
              : phase === "questions"
                ? `Question ${currentIndex + 1} of ${questions.length}`
                : "Your results"}
          </h2>
          <button
            type="button"
            className="wellness-quiz-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
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
              Results are for discussion with your provider only. Compounds may be investigational and not FDA-approved for general use.
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
                      treatments are appropriate. Your provider will review your answers before
                      making any recommendation — you can continue the quiz.
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
          </div>
        )}

        {phase === "results" && (
          <form onSubmit={handleSaveResults} className="wellness-quiz-results-form">
            <div className="wellness-quiz-body wellness-quiz-results-body">
              {loading ? (
                <p className="wellness-quiz-loading">Saving…</p>
              ) : (
                <>
                  <p className="wellness-quiz-results-intro">
                    {suggestedTreatments.length > 0
                      ? "Based on your answers and how much each area matters to you, the following treatments may be a fit for discussion with your provider."
                      : domainScores.length > 0
                        ? "Here is how strongly your answers point toward different wellness focus areas. No specific peptides met the match threshold — consider retaking the quiz or discussing goals with your provider."
                        : "No specific treatments matched. Consider retaking the quiz or discussing your goals directly with your provider."}
                  </p>
                  {suggestedTreatments.length === 0 && domainScores.length === 0 ? null : (
                    <WellnessQuizResultsCards
                      suggestedTreatments={suggestedTreatments}
                      answers={savedQuiz?.answers ?? answers}
                      categoryScores={domainScores}
                      onAddToPlan={onAddToPlan}
                    />
                  )}
                </>
              )}
              {saveFailed && (
                <p className="wellness-quiz-error">Save failed. Please try again.</p>
              )}
            </div>
            <div className="wellness-quiz-footer">
              <button
                type="button"
                className="wellness-quiz-btn wellness-quiz-btn--secondary"
                onClick={handleBackToQuestions}
              >
                {savedQuiz ? "Retake quiz" : "Back to questions"}
              </button>
              <button
                type="submit"
                className="wellness-quiz-btn wellness-quiz-btn--primary"
                disabled={loading}
              >
                Save results
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
