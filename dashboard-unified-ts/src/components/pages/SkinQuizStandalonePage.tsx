/**
 * Standalone skin quiz page for the unique link sent via SMS.
 * Mobile-friendly, no dashboard chrome. Saves results to Airtable via backend.
 */

import { useState, useEffect } from "react";
import { parseSkinQuizParams } from "../../utils/skinQuizLink";
import { submitSkinQuizFromLink, fetchSkinQuizResultsFromLink } from "../../services/api";
import {
  SKIN_TYPE_QUIZ,
  buildSkincareQuizPayload,
  computeQuizProfile,
  getResultSummary,
  SKIN_TYPE_SCORE_ORDER,
  SKIN_TYPE_DISPLAY_LABELS,
  GEMSTONE_BY_SKIN_TYPE,
  ROUTINE_NOTES_BY_SKIN_TYPE,
  TREATMENT_RECOMMENDATIONS_BY_SKIN_TYPE,
  RECOMMENDED_PRODUCT_REASONS,
} from "../../data/skinTypeQuiz";
import { getSkincareCarouselItems } from "../modals/DiscussedTreatmentsModal/constants";
import SkinQuizProductModal, { type SkinQuizProduct } from "../modals/SkinQuizProductModal";
import "../modals/SkinTypeQuizModal.css";
import "../modals/SkinQuizProductModal.css";
import "./SkinQuizStandalonePage.css";

const TOTAL_QUESTIONS = SKIN_TYPE_QUIZ.questions.length;
type Phase = "intro" | "questions" | "results" | "invalid";

export default function SkinQuizStandalonePage() {
  const params = parseSkinQuizParams();
  const [phase, setPhase] = useState<Phase>(() => (params ? "intro" : "invalid"));
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(!!params);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<SkinQuizProduct | null>(null);

  useEffect(() => {
    if (!params) setPhase("invalid");
  }, [params]);

  // If client has already completed the quiz, load and show results instead of the quiz
  useEffect(() => {
    if (!params || !loadingExisting) return;
    let cancelled = false;
    fetchSkinQuizResultsFromLink(params.recordId, params.tableName)
      .then((payload) => {
        if (cancelled || !payload) return;
        setAnswers(payload.answers);
        setPhase("results");
      })
      .catch(() => {
        if (!cancelled) {
          // No results or error – show intro so they can take the quiz
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingExisting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params?.recordId, params?.tableName, loadingExisting]);

  const question = SKIN_TYPE_QUIZ.questions[currentIndex];
  const isLast = currentIndex === TOTAL_QUESTIONS - 1;

  const handleStart = () => setPhase("questions");
  const goBack = () => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
    else setPhase("intro");
  };

  const handleAnswer = (questionId: string, answerIndex: number) => {
    const next = { ...answers, [questionId]: answerIndex };
    setAnswers(next);
    if (isLast) {
      setLoading(true);
      setSaveError(null);
      const payload = buildSkincareQuizPayload(next);
      submitSkinQuizFromLink(params!.recordId, params!.tableName, payload)
        .then(() => {
          setLoading(false);
          setSaveError(null);
          setPhase("results");
        })
        .catch((e) => {
          setLoading(false);
          setSaveError(e?.message ?? "Could not save. Please try again.");
          setPhase("results"); // still show results
        });
    } else setCurrentIndex((i) => i + 1);
  };

  if (!params) {
    return (
      <div className="skin-quiz-standalone">
        <div className="skin-quiz-standalone__invalid">
          <h1>Invalid or expired link</h1>
          <p>This quiz link is invalid or has expired. Please request a new link from your provider.</p>
        </div>
      </div>
    );
  }

  if (loadingExisting) {
    return (
      <div className="skin-quiz-standalone">
        <div className="skin-quiz-standalone__card">
          <div className="skin-quiz-standalone__body">
            <p className="skin-quiz-standalone__saving">Loading your results…</p>
          </div>
        </div>
      </div>
    );
  }

  const showResults = phase === "results";
  const profile = showResults ? computeQuizProfile(answers) : null;
  const scores = profile?.scores ?? null;
  const resultSummary = profile ? getResultSummary(profile) : null;
  const payload = showResults ? buildSkincareQuizPayload(answers) : null;
  const maxScore = scores ? Math.max(...Object.values(scores), 1) : 1;
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
    <div className="skin-quiz-standalone">
      <div className="skin-quiz-standalone__card">
        {phase === "intro" && (
          <>
            <div className="skin-quiz-standalone__body">
              <div className="skin-type-quiz-intro">
                <h2 className="skin-type-quiz-intro-headline">Discover your Gemstone Skin Type</h2>
                <p>
                  Not sure what products are right for your skin? Take our quick, dermatologist-informed quiz to discover your <strong>true skin type</strong> and learn how to care for it.
                </p>
                <p>
                  In just a few questions, you&apos;ll find out whether your skin is oily, dry, combination, normal, or sensitive and get product recommendations curated by the licensed professionals at The Treatment Skin Boutique.
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
              </div>
            </div>
            <div className="skin-quiz-standalone__footer">
              <button type="button" className="skin-quiz-standalone__btn skin-quiz-standalone__btn--primary" onClick={handleStart}>
                Start
              </button>
            </div>
          </>
        )}

        {phase === "questions" && question && (
          <>
            <div className="skin-quiz-standalone__header">
              <span className="skin-quiz-standalone__progress">
                Question {currentIndex + 1} of {TOTAL_QUESTIONS}
              </span>
            </div>
            <div className="skin-quiz-standalone__body">
              <div className="skin-type-quiz-question skin-type-quiz-question-card skin-type-quiz-question-view">
                {question.title && (
                  <span className="skin-type-quiz-question-category">{question.title}</span>
                )}
                <h2 className="skin-type-quiz-main-question">{question.question}</h2>
                <p className="skin-type-quiz-subtitle">Choose the option that best describes you.</p>
                <div className="skin-type-quiz-answers skin-type-quiz-answers-grid" role="group" aria-label={question.question}>
                  {question.answers.map((a, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`skin-type-quiz-answer-card ${answers[question.id] === idx ? "skin-type-quiz-answer-card-selected" : ""}`}
                      onClick={() => handleAnswer(question.id, idx)}
                    >
                      <span className="skin-type-quiz-answer-card-text">{a.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="skin-quiz-standalone__footer">
              <button type="button" className="skin-quiz-standalone__btn skin-quiz-standalone__btn--secondary" onClick={goBack}>
                Back
              </button>
            </div>
          </>
        )}

        {phase === "results" && payload && scores && (
          <div className="skin-quiz-standalone__results">
            {saveError && (
              <p className="skin-quiz-standalone__error">{saveError}</p>
            )}
            {loading ? (
              <p className="skin-quiz-standalone__saving">Saving your results…</p>
            ) : (
              <>
                <div className="skin-type-quiz-result-hero">
                  <h2 className="skin-type-quiz-results-heading">Your results are in!</h2>
                  <p className="skin-type-quiz-results-congrats">Congratulations — you made it through the quiz! ✨</p>
                  <p className="skin-type-quiz-results-gemstone-intro">
                    Now that you know your Gemstone Skin Type, you hold the key to understanding what your skin truly needs.
                  </p>
                  {GEMSTONE_BY_SKIN_TYPE[payload.result] && (
                    <div className="skin-type-quiz-gemstone-badge">
                      <span className="skin-type-quiz-gemstone-name">
                        {GEMSTONE_BY_SKIN_TYPE[payload.result].name.toUpperCase()} 💎 {GEMSTONE_BY_SKIN_TYPE[payload.result].tagline}
                      </span>
                    </div>
                  )}
                  {resultSummary?.description && (
                    <p className="skin-type-quiz-result-description">{resultSummary.description}</p>
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
                                  ? { name, imageUrl: item.imageUrl, productUrl: item.productUrl, recommendedFor: RECOMMENDED_PRODUCT_REASONS[name], description: item.description, price: item.price, imageUrls: item.imageUrls }
                                  : null;
                              })
                              .filter(Boolean) as SkinQuizProduct[];
                            return (
                              <li key={i} className="skin-type-quiz-routine-step">
                                <span className="skin-type-quiz-routine-step-label">{step.label}</span>
                                <div className="skin-type-quiz-routine-step-products">
                                  {stepProducts.map((p, j) => (
                                    <button key={j} type="button" className="skin-type-quiz-routine-product-chip" onClick={() => setSelectedProduct(p)}>
                                      {p.imageUrl ? <img src={p.imageUrl} alt="" className="skin-type-quiz-routine-product-thumb" /> : <span className="skin-type-quiz-routine-product-placeholder">◆</span>}
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
                                  ? { name, imageUrl: item.imageUrl, productUrl: item.productUrl, recommendedFor: RECOMMENDED_PRODUCT_REASONS[name], description: item.description, price: item.price, imageUrls: item.imageUrls }
                                  : null;
                              })
                              .filter(Boolean) as SkinQuizProduct[];
                            return (
                              <li key={i} className="skin-type-quiz-routine-step">
                                <span className="skin-type-quiz-routine-step-label">{step.label}</span>
                                <div className="skin-type-quiz-routine-step-products">
                                  {stepProducts.map((p, j) => (
                                    <button key={j} type="button" className="skin-type-quiz-routine-product-chip" onClick={() => setSelectedProduct(p)}>
                                      {p.imageUrl ? <img src={p.imageUrl} alt="" className="skin-type-quiz-routine-product-thumb" /> : <span className="skin-type-quiz-routine-product-placeholder">◆</span>}
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
                        <span className="skin-type-quiz-routine-optional-label">Optional: {ROUTINE_NOTES_BY_SKIN_TYPE[payload.result]!.optional!.label}</span>
                      </div>
                    )}
                  </div>
                )}

                {recommendedWithDetails.length > 0 && (
                  <div className="skin-type-quiz-products-section">
                    <h3 className="skin-type-quiz-products-title">Recommended products</h3>
                    <p className="skin-type-quiz-products-subtitle">Based on your skin type, we recommend these products for the benefits below.</p>
                    <div className="skin-type-quiz-products-grid">
                      {recommendedWithDetails.map((product, idx) => (
                        <div key={idx} className="skin-type-quiz-product-card">
                          <div className="skin-type-quiz-product-card-image-wrap">
                            {product.imageUrl ? <img src={product.imageUrl} alt="" className="skin-type-quiz-product-card-image" /> : <div className="skin-type-quiz-product-card-placeholder"><span className="skin-type-quiz-product-card-placeholder-icon">◆</span></div>}
                          </div>
                          <div className="skin-type-quiz-product-card-body">
                            <div className="skin-type-quiz-product-card-reason">Recommended for: {product.recommendedFor}</div>
                            <div className="skin-type-quiz-product-card-name">{product.name}</div>
                            <button
                              type="button"
                              className="skin-type-quiz-product-card-link"
                              onClick={() => setSelectedProduct(product)}
                            >
                              View product →
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {TREATMENT_RECOMMENDATIONS_BY_SKIN_TYPE[payload.result] && (
                  <div className="skin-type-quiz-treatments-section">
                    <h3 className="skin-type-quiz-treatments-title">Your personalized treatment recommendations</h3>
                    <p className="skin-type-quiz-treatments-heading">{TREATMENT_RECOMMENDATIONS_BY_SKIN_TYPE[payload.result]!.heading}</p>
                    <ul className="skin-type-quiz-treatments-list">
                      {TREATMENT_RECOMMENDATIONS_BY_SKIN_TYPE[payload.result]!.items.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
    {selectedProduct && (
      <SkinQuizProductModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    )}
    </>
  );
}
