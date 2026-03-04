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
  WELLNESS_QUIZ_FIELD_NAME,
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
  const [answers, setAnswers] = useState<Record<string, number | number[]>>(
    () => savedQuiz?.answers ?? {}
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<QuizPhase>(() => (savedQuiz ? "results" : "intro"));
  const [loading, setLoading] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const questions = WELLNESS_QUIZ.questions;
  const question = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;
  const isMultiSelect = question?.id === "goals" || question?.id === "conditions";
  const selectedForMulti = (answers[question?.id ?? ""] as number[] | undefined) ?? [];
  const hasAnswer = question
    ? isMultiSelect
      ? selectedForMulti.length > 0
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

  const handleSingleAnswer = (questionId: string, answerIndex: number) => {
    const next = { ...answers, [questionId]: answerIndex };
    setAnswers(next);
    if (isLast) {
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

  const handleMultiToggle = (questionId: string, answerIndex: number) => {
    const current = (answers[questionId] as number[] | undefined) ?? [];
    const next = current.includes(answerIndex)
      ? current.filter((i) => i !== answerIndex)
      : [...current, answerIndex].sort((a, b) => a - b);
    setAnswers({ ...answers, [questionId]: next });
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

  const performSave = async (
    answersToSave: Record<string, number | number[]>
  ): Promise<boolean> => {
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

  const suggestedTreatments =
    phase === "results"
      ? savedQuiz
        ? getSuggestedWellnessTreatments(savedQuiz)
        : getSuggestedWellnessTreatments(buildWellnessQuizPayload(answers))
      : [];

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
              A short quiz to match you with peptide and wellness treatments from our offerings.
              Your answers help suggest one or more options based on your age, goals, and any conditions.
            </p>
            <p className="wellness-quiz-intro-note">
              Results are for discussion with your provider only. Compounds may be investigational and not FDA-approved for general use.
            </p>
            <button
              type="button"
              className="wellness-quiz-btn wellness-quiz-btn--primary"
              onClick={handleStartQuiz}
            >
              Start quiz
            </button>
          </div>
        )}

        {phase === "questions" && question && (
          <div className="wellness-quiz-body">
            <p className="wellness-quiz-question-category">{question.title}</p>
            <p className="wellness-quiz-question-text">{question.question}</p>
            <div className="wellness-quiz-answers">
              {isMultiSelect ? (
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
              ) : (
                question.answers.map((a, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`wellness-quiz-answer-btn ${
                      answers[question.id] === idx ? "wellness-quiz-answer-btn--selected" : ""
                    }`}
                    onClick={() => handleSingleAnswer(question.id, idx)}
                  >
                    {a.label}
                  </button>
                ))
              )}
            </div>
            {isMultiSelect && (
              <div className="wellness-quiz-nav">
                <button
                  type="button"
                  className="wellness-quiz-btn wellness-quiz-btn--primary"
                  onClick={handleNext}
                  disabled={!hasAnswer}
                >
                  {isLast ? "See results" : "Next"}
                </button>
              </div>
            )}
            {!isMultiSelect && !isLast && (
              <button
                type="button"
                className="wellness-quiz-btn wellness-quiz-btn--secondary"
                onClick={goBack}
              >
                Back
              </button>
            )}
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
                    Based on your answers, the following treatments may be a fit for discussion with your provider.
                  </p>
                  {suggestedTreatments.length === 0 ? (
                    <p className="wellness-quiz-no-results">
                      No specific treatments matched. Consider retaking the quiz or discussing your goals directly with your provider.
                    </p>
                  ) : (
                    <WellnessQuizResultsCards
                      suggestedTreatments={suggestedTreatments}
                      answers={savedQuiz?.answers ?? answers}
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
              {suggestedTreatments.length > 0 && (
                <button
                  type="submit"
                  className="wellness-quiz-btn wellness-quiz-btn--primary"
                  disabled={loading}
                >
                  Save results
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
