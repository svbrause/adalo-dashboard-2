/**
 * Skin Type Quiz modal – card-style, one question at a time; auto-advances on answer.
 * Results screen shows score breakdown and recommended products. Saves to client's "Skincare Quiz" field.
 */

import { useState, FormEvent, useEffect } from "react";
import { Client, SkincareQuizData } from "../../types";
import { updateLeadRecord } from "../../services/api";
import { showToast, showError } from "../../utils/toast";
import {
  SKIN_TYPE_QUIZ,
  buildSkincareQuizPayload,
  computeQuizProfile,
  getResultSummary,
  SKIN_TYPE_SCORE_ORDER,
  SKIN_TYPE_DISPLAY_LABELS,
  RECOMMENDED_PRODUCT_REASONS,
  SKINCARE_QUIZ_FIELD_NAME,
  GEMSTONE_BY_SKIN_TYPE,
  ROUTINE_NOTES_BY_SKIN_TYPE,
  TREATMENT_RECOMMENDATIONS_BY_SKIN_TYPE,
} from "../../data/skinTypeQuiz";
import { getSkincareCarouselItems, TIMELINE_SKINCARE } from "./DiscussedTreatmentsModal/constants";
import SkinQuizProductModal, { type SkinQuizProduct } from "./SkinQuizProductModal";
import type { TreatmentPlanPrefill } from "./DiscussedTreatmentsModal/TreatmentPhotos";
import "./SkinTypeQuizModal.css";

const TOTAL_QUESTIONS = SKIN_TYPE_QUIZ.questions.length;

type QuizPhase = "intro" | "questions" | "results";

interface SkinTypeQuizModalProps {
  client: Client;
  onClose: () => void;
  onSuccess: () => void;
  /** When set, open in results view using saved answers (e.g. "View Results" for existing quiz). */
  savedQuiz?: SkincareQuizData | null;
  /** When provided, product modal shows "Add to treatment plan" and calls this with prefill. */
  onAddToPlan?: (prefill: TreatmentPlanPrefill) => void | Promise<void>;
  /** Provider/practice name for intro copy (replaces "The Treatment Skin Boutique" when set). */
  providerName?: string | null;
}

const DEFAULT_PROVIDER_NAME = "The Treatment Skin Boutique";

export default function SkinTypeQuizModal({
  client,
  onClose,
  onSuccess,
  savedQuiz,
  onAddToPlan,
  providerName,
}: SkinTypeQuizModalProps) {
  const practiceName = (providerName && providerName.trim()) || DEFAULT_PROVIDER_NAME;
  const [answers, setAnswers] = useState<Record<string, number>>(
    () => savedQuiz?.answers ?? {}
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<QuizPhase>(
    () => (savedQuiz ? "results" : "intro")
  );
  const [loading, setLoading] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<SkinQuizProduct | null>(null);

  const question = SKIN_TYPE_QUIZ.questions[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === TOTAL_QUESTIONS - 1;
  const hasAnswer = question && answers[question.id] != null && answers[question.id] >= 0;

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

  const handleAnswerChange = (questionId: string, answerIndex: number) => {
    const nextAnswers = { ...answers, [questionId]: answerIndex };
    setAnswers(nextAnswers);
    if (isLast) {
      setPhase("results");
      setSaveFailed(false);
      setLoading(true);
      performSave(nextAnswers)
        .then((ok) => {
          setLoading(false);
          if (ok) {
            const payload = buildSkincareQuizPayload(nextAnswers);
            const resultLabel =
              SKIN_TYPE_QUIZ.resultDescriptions?.[payload.result]?.label ?? payload.result;
            showToast(`Skincare quiz saved: ${resultLabel}`);
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

  const handleBackToQuestions = () => {
    setAnswers({});
    setPhase("intro");
    setCurrentIndex(0);
  };

  /** Persist quiz to client (and linked lead). Returns true on success, false on failure. */
  const performSave = async (answersToSave: Record<string, number>): Promise<boolean> => {
    const answered = SKIN_TYPE_QUIZ.questions.filter(
      (q) => answersToSave[q.id] != null && answersToSave[q.id] >= 0
    );
    if (answered.length < TOTAL_QUESTIONS) return false;
    try {
      const payload = buildSkincareQuizPayload(answersToSave);
      const quizJson = JSON.stringify(payload);
      await updateLeadRecord(client.id, client.tableSource, {
        [SKINCARE_QUIZ_FIELD_NAME]: quizJson,
      });
      if (client.linkedLeadId) {
        await updateLeadRecord(client.linkedLeadId, "Web Popup Leads", {
          [SKINCARE_QUIZ_FIELD_NAME]: quizJson,
        });
      }
      return true;
    } catch {
      showError("Failed to save skincare quiz. Please try again.");
      return false;
    }
  };

  const handleSaveResults = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const ok = await performSave(answers);
    setLoading(false);
    if (ok) {
      const payload = buildSkincareQuizPayload(answers);
      const resultLabel =
        SKIN_TYPE_QUIZ.resultDescriptions?.[payload.result]?.label ?? payload.result;
      showToast(`Skincare quiz saved: ${resultLabel}`);
      onSuccess();
      setSaveFailed(false);
    }
  };

  const showResults = phase === "results";
  const profile = showResults ? computeQuizProfile(answers) : null;
  const scores = profile?.scores ?? null;
  const resultSummary = profile ? getResultSummary(profile) : null;
  const payload = showResults ? buildSkincareQuizPayload(answers) : null;
  const maxScore = scores
    ? Math.max(...Object.values(scores), 1)
    : 1;

  const carouselItems = getSkincareCarouselItems();
  const recommendedWithDetails =
    payload?.recommendedProductNames?.map((name) => {
      const item = carouselItems.find((p) => p.name === name);
      return {
        name,
        imageUrl: item?.imageUrl,
        productUrl: item?.productUrl,
        recommendedFor: RECOMMENDED_PRODUCT_REASONS[name] ?? "Recommended for your skin type",
        description: item?.description,
        price: item?.price,
        imageUrls: item?.imageUrls,
      };
    }) ?? [];

  return (
    <>
    <div className="modal-overlay active skin-type-quiz-modal-overlay" onClick={onClose}>
      <div
        className={`modal-content skin-type-quiz-modal-content skin-type-quiz-card${showResults ? " skin-type-quiz-card--results" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header skin-type-quiz-card-header">
          <h2 className="modal-title">
            {showResults ? "Quiz results" : "Skin Type Quiz"}
          </h2>
          {phase === "questions" && (
            <div className="skin-type-quiz-progress">
              Question {currentIndex + 1} of {TOTAL_QUESTIONS}
            </div>
          )}
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {showResults && payload && scores ? (
          <form onSubmit={handleSaveResults} className="skin-type-quiz-results-form">
            <div className="skin-type-quiz-body skin-type-quiz-results-body">
              <div className="skin-type-quiz-result-hero">
                <h2 className="skin-type-quiz-results-heading">Your results are in!</h2>
                <p className="skin-type-quiz-results-congrats">
                  Congratulations — you made it through the quiz! ✨
                </p>
                <p className="skin-type-quiz-results-gemstone-intro">
                  Now that you know your Gemstone Skin Type, you hold the key to understanding what your skin truly needs.
                </p>
                <p className="skin-type-quiz-results-cta">
                  Use your personalized result to explore custom skincare products, or book a consultation to discover in-person treatments perfectly matched to your unique glow.
                </p>
                {GEMSTONE_BY_SKIN_TYPE[payload.result] && (
                  <div className="skin-type-quiz-gemstone-badge">
                    <span className="skin-type-quiz-gemstone-name">
                      {GEMSTONE_BY_SKIN_TYPE[payload.result].name.toUpperCase()} 💎{" "}
                      {GEMSTONE_BY_SKIN_TYPE[payload.result].tagline}
                    </span>
                  </div>
                )}
                {resultSummary?.description && (
                  <p className="skin-type-quiz-result-description">
                    {resultSummary.description}
                  </p>
                )}
              </div>

              <div className="skin-type-quiz-score-section">
                <h3 className="skin-type-quiz-score-title">Score breakdown</h3>
                <div className="skin-type-quiz-score-bars">
                  {SKIN_TYPE_SCORE_ORDER.map((sectionId) => {
                    const value = scores[sectionId] ?? 0;
                    const pct = maxScore > 0 ? (value / maxScore) * 100 : 0;
                    const letter = profile?.sectionLetters?.[sectionId];
                    const label = letter
                      ? `${SKIN_TYPE_DISPLAY_LABELS[sectionId]} (${letter})`
                      : SKIN_TYPE_DISPLAY_LABELS[sectionId];
                    return (
                      <div key={sectionId} className="skin-type-quiz-score-row">
                        <span className="skin-type-quiz-score-label">{label}</span>
                        <div className="skin-type-quiz-score-bar-wrap">
                          <div className="skin-type-quiz-score-bar" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="skin-type-quiz-score-value">{value}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {ROUTINE_NOTES_BY_SKIN_TYPE[payload.result] && (
                <div className="skin-type-quiz-routine-notes">
                  <h3 className="skin-type-quiz-routine-title">Routine Notes</h3>
                  <div className="skin-type-quiz-routine-grid">
                    <div className="skin-type-quiz-routine-block">
                      <h4 className="skin-type-quiz-routine-period">AM</h4>
                      <ul className="skin-type-quiz-routine-list">
                        {ROUTINE_NOTES_BY_SKIN_TYPE[payload.result]!.am.map((step, i) => {
                          const stepProducts = step.productNames
                            .map((name) => {
                              const item = carouselItems.find((p) => p.name === name);
                              return item
                                ? {
                                    name,
                                    imageUrl: item.imageUrl,
                                    productUrl: item.productUrl,
                                    recommendedFor: RECOMMENDED_PRODUCT_REASONS[name],
                                    description: item.description,
                                    price: item.price,
                                    imageUrls: item.imageUrls,
                                  }
                                : null;
                            })
                            .filter(Boolean) as SkinQuizProduct[];
                          return (
                            <li key={i} className="skin-type-quiz-routine-step">
                              <span className="skin-type-quiz-routine-step-label">{step.label}</span>
                              <div className="skin-type-quiz-routine-step-products">
                                {stepProducts.map((p, j) => (
                                  <button
                                    key={j}
                                    type="button"
                                    className="skin-type-quiz-routine-product-chip"
                                    onClick={() => setSelectedProduct(p)}
                                  >
                                    {p.imageUrl ? (
                                      <img src={p.imageUrl} alt="" className="skin-type-quiz-routine-product-thumb" />
                                    ) : (
                                      <span className="skin-type-quiz-routine-product-placeholder">◆</span>
                                    )}
                                    <span className="skin-type-quiz-routine-product-name">{p.name.split("|")[0]?.trim() ?? p.name}</span>
                                  </button>
                                ))}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                    <div className="skin-type-quiz-routine-block">
                      <h4 className="skin-type-quiz-routine-period">PM</h4>
                      <ul className="skin-type-quiz-routine-list">
                        {ROUTINE_NOTES_BY_SKIN_TYPE[payload.result]!.pm.map((step, i) => {
                          const stepProducts = step.productNames
                            .map((name) => {
                              const item = carouselItems.find((p) => p.name === name);
                              return item
                                ? {
                                    name,
                                    imageUrl: item.imageUrl,
                                    productUrl: item.productUrl,
                                    recommendedFor: RECOMMENDED_PRODUCT_REASONS[name],
                                    description: item.description,
                                    price: item.price,
                                    imageUrls: item.imageUrls,
                                  }
                                : null;
                            })
                            .filter(Boolean) as SkinQuizProduct[];
                          return (
                            <li key={i} className="skin-type-quiz-routine-step">
                              <span className="skin-type-quiz-routine-step-label">{step.label}</span>
                              <div className="skin-type-quiz-routine-step-products">
                                {stepProducts.map((p, j) => (
                                  <button
                                    key={j}
                                    type="button"
                                    className="skin-type-quiz-routine-product-chip"
                                    onClick={() => setSelectedProduct(p)}
                                  >
                                    {p.imageUrl ? (
                                      <img src={p.imageUrl} alt="" className="skin-type-quiz-routine-product-thumb" />
                                    ) : (
                                      <span className="skin-type-quiz-routine-product-placeholder">◆</span>
                                    )}
                                    <span className="skin-type-quiz-routine-product-name">{p.name.split("|")[0]?.trim() ?? p.name}</span>
                                  </button>
                                ))}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                  {ROUTINE_NOTES_BY_SKIN_TYPE[payload.result]!.optional && (
                    <div className="skin-type-quiz-routine-optional">
                      <span className="skin-type-quiz-routine-optional-label">
                        Optional: {ROUTINE_NOTES_BY_SKIN_TYPE[payload.result]!.optional!.label}
                      </span>
                      <div className="skin-type-quiz-routine-step-products">
                        {ROUTINE_NOTES_BY_SKIN_TYPE[payload.result]!.optional!.productNames.map((name) => {
                          const item = carouselItems.find((p) => p.name === name);
                          if (!item) return null;
                          const product: SkinQuizProduct = {
                            name: item.name,
                            imageUrl: item.imageUrl,
                            productUrl: item.productUrl,
                            recommendedFor: RECOMMENDED_PRODUCT_REASONS[name],
                            description: item.description,
                            price: item.price,
                            imageUrls: item.imageUrls,
                          };
                          return (
                            <button
                              key={name}
                              type="button"
                              className="skin-type-quiz-routine-product-chip"
                              onClick={() => setSelectedProduct(product)}
                            >
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt="" className="skin-type-quiz-routine-product-thumb" />
                              ) : (
                                <span className="skin-type-quiz-routine-product-placeholder">◆</span>
                              )}
                              <span className="skin-type-quiz-routine-product-name">{item.name.split("|")[0]?.trim() ?? item.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {recommendedWithDetails.length > 0 && (
                <div className="skin-type-quiz-products-section">
                  <h3 className="skin-type-quiz-products-title">Recommended products</h3>
                  <p className="skin-type-quiz-products-subtitle">
                    Based on your skin type, we recommend these products for the benefits below.
                  </p>
                  <div className="skin-type-quiz-products-grid">
                    {recommendedWithDetails.map((product, idx) => (
                      <div key={idx} className="skin-type-quiz-product-card">
                        <div className="skin-type-quiz-product-card-image-wrap">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt=""
                              className="skin-type-quiz-product-card-image"
                            />
                          ) : (
                            <div className="skin-type-quiz-product-card-placeholder">
                              <span className="skin-type-quiz-product-card-placeholder-icon">◆</span>
                            </div>
                          )}
                        </div>
                        <div className="skin-type-quiz-product-card-body">
                          <div className="skin-type-quiz-product-card-reason">
                            Recommended for: {product.recommendedFor}
                          </div>
                          <div className="skin-type-quiz-product-card-name">{product.name}</div>
                          {onAddToPlan ? (() => {
                            const displayName = product.name.split("|")[0]?.trim() ?? product.name;
                            const isInPlan = (client.discussedItems ?? []).some(
                              (item) =>
                                item.treatment?.trim() === "Skincare" &&
                                (item.product?.trim() === displayName ||
                                  item.product?.trim() === product.name)
                            );
                            return (
                              <button
                                type="button"
                                className={`skin-type-quiz-product-card-link skin-type-quiz-product-card-link--add${isInPlan ? " skin-type-quiz-product-card-link--added" : ""}`}
                                onClick={() => {
                                  if (isInPlan) return;
                                  const prefill: TreatmentPlanPrefill = {
                                    interest: "",
                                    region: "",
                                    treatment: "Skincare",
                                    treatmentProduct: displayName,
                                    timeline: TIMELINE_SKINCARE,
                                    notes: product.recommendedFor ?? undefined,
                                  };
                                  onAddToPlan(prefill);
                                }}
                                disabled={isInPlan}
                              >
                                {isInPlan ? "Added to plan" : "Add to plan"}
                              </button>
                            );
                          })() : (
                            <button
                              type="button"
                              className="skin-type-quiz-product-card-link"
                              onClick={() => setSelectedProduct(product)}
                            >
                              View product →
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {TREATMENT_RECOMMENDATIONS_BY_SKIN_TYPE[payload.result] && (
                <div className="skin-type-quiz-treatments-section">
                  <h3 className="skin-type-quiz-treatments-title">
                    Your personalized treatment recommendations
                  </h3>
                  <p className="skin-type-quiz-treatments-heading">
                    {TREATMENT_RECOMMENDATIONS_BY_SKIN_TYPE[payload.result]!.heading}
                  </p>
                  <ul className="skin-type-quiz-treatments-list">
                    {TREATMENT_RECOMMENDATIONS_BY_SKIN_TYPE[payload.result]!.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="modal-footer skin-type-quiz-card-footer">
              <div className="skin-type-quiz-nav-left">
                {savedQuiz ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleBackToQuestions}
                  >
                    Retake quiz
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleBackToQuestions}
                  >
                    Back to questions
                  </button>
                )}
              </div>
              <div className="skin-type-quiz-nav-right">
                {savedQuiz ? (
                  <button type="button" className="btn-primary" onClick={onClose}>
                    Close
                  </button>
                ) : saveFailed ? (
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={loading}
                  >
                    {loading ? "Saving…" : "Save results"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={onClose}
                    disabled={loading}
                  >
                    {loading ? "Saving…" : "Close"}
                  </button>
                )}
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={(e) => e.preventDefault()}>
            <div className="skin-type-quiz-body skin-type-quiz-card-body">
              {phase === "intro" && (
                <div className="skin-type-quiz-intro">
                  <h2 className="skin-type-quiz-intro-headline">Discover your Gemstone Skin Type</h2>
                  <p>
                    Not sure what products are right for your skin? Take our quick, dermatologist-informed quiz to discover your <strong>true skin type</strong> and learn how to care for it.
                  </p>
                  <p>
                    In just a few questions, you&apos;ll find out whether your skin is oily, dry, combination, normal, or sensitive and get product recommendations curated by the licensed professionals at {practiceName}.
                  </p>
                  <p>
                    Your skin is as unique as a gemstone — and the first step to glowing, confident skin is understanding what makes it shine. ✨ Take this detailed quiz to reveal your <strong>true skin type</strong> and your <strong>personalized gemstone match</strong>, plus tailored product and treatment recommendations from our experts.
                  </p>
                  <p>
                    It only takes a few minutes. Let&apos;s uncover your natural radiance. 💎
                  </p>
                  <p className="skin-type-quiz-intro-instruction">
                    <em>Answer each question honestly based on your skin&apos;s natural behavior without makeup or treatments.</em>
                  </p>
                  <p className="skin-type-quiz-intro-client">
                    Answer for <strong>{client.name}</strong>. Results are saved automatically to this client&apos;s record.
                  </p>
                </div>
              )}
              {phase === "questions" && question && (
                <div key={question.id} className="skin-type-quiz-question skin-type-quiz-question-card skin-type-quiz-question-view">
                  {question.title && (
                    <span className="skin-type-quiz-question-category">{question.title}</span>
                  )}
                  <h2 className="skin-type-quiz-main-question">{question.question}</h2>
                  <p className="skin-type-quiz-subtitle">
                    Choose the option that best describes {client.name?.split(" ")[0] || "them"}.
                  </p>
                  <div className="skin-type-quiz-answers skin-type-quiz-answers-grid" role="group" aria-label={question.question}>
                    {question.answers.map((a, idx) => {
                      const isSelected = answers[question.id] === idx;
                      return (
                        <button
                          key={idx}
                          type="button"
                          className={`skin-type-quiz-answer-card ${isSelected ? "skin-type-quiz-answer-card-selected" : ""}`}
                          onClick={() => handleAnswerChange(question.id, idx)}
                        >
                          <span className="skin-type-quiz-answer-card-text">{a.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer skin-type-quiz-card-footer">
              <div className="skin-type-quiz-nav-left">
                {phase === "intro" ? null : !isFirst ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={goBack}
                  >
                    Back
                  </button>
                ) : null}
              </div>
              <div className="skin-type-quiz-nav-right">
                {phase === "intro" ? (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleStartQuiz}
                  >
                    Start
                  </button>
                ) : isLast && hasAnswer ? (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setPhase("results")}
                  >
                    See results
                  </button>
                ) : null}
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
    {selectedProduct && (
      <SkinQuizProductModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToPlan={onAddToPlan}
      />
    )}
    </>
  );
}
