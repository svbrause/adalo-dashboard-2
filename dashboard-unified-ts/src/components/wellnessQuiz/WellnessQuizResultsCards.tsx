/**
 * Shared detailed view of wellness quiz suggested peptides: what each is used for,
 * how it relates to the quiz answers, and add-to-treatment-plan action.
 * Used in the client detail Wellness Quiz section and in WellnessQuizModal results.
 */

import {
  getWellnessQuizMatchReasons,
  type WellnessTreatment,
} from "../../data/wellnessQuiz";
import type { TreatmentPlanPrefill } from "../modals/DiscussedTreatmentsModal/TreatmentPhotos";
import "../modals/WellnessQuizModal.css";

export interface WellnessQuizResultsCardsProps {
  suggestedTreatments: WellnessTreatment[];
  /** Saved quiz answers (used to show "How this matches your answers"). */
  answers: Record<string, number | number[]>;
  onAddToPlan?: (prefill: TreatmentPlanPrefill) => void;
}

export default function WellnessQuizResultsCards({
  suggestedTreatments,
  answers,
  onAddToPlan,
}: WellnessQuizResultsCardsProps) {
  if (suggestedTreatments.length === 0) return null;

  return (
    <ul className="wellness-quiz-treatment-list wellness-quiz-results-cards-inline">
      {suggestedTreatments.map((t) => {
        const matchReasons = getWellnessQuizMatchReasons(answers, t.id);
        return (
          <li key={t.id} className="wellness-quiz-treatment-card">
            <div className="wellness-quiz-treatment-card-header">
              <div className="wellness-quiz-treatment-name">{t.name}</div>
              <div className="wellness-quiz-treatment-category">{t.category}</div>
            </div>
            <div className="wellness-quiz-treatment-used-for">
              <span className="wellness-quiz-treatment-used-for-label">
                What it&apos;s used for
              </span>
              <p className="wellness-quiz-treatment-summary">
                {t.summary ?? t.whatItAddresses}
              </p>
              {t.summary && (
                <p className="wellness-quiz-treatment-addresses">
                  {t.whatItAddresses}
                </p>
              )}
            </div>
            {matchReasons.length > 0 && (
              <div className="wellness-quiz-treatment-matches">
                <span className="wellness-quiz-treatment-used-for-label">
                  How this matches your answers
                </span>
                <ul className="wellness-quiz-treatment-matches-list">
                  {matchReasons.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="wellness-quiz-treatment-meta">
              <span>Ideal: {t.idealDemographics}</span>
              <span>Delivery: {t.deliveryMethod}</span>
              <span>Pricing: {t.pricing}</span>
              <span>Duration: {t.duration}</span>
            </div>
            {t.notes && (
              <p className="wellness-quiz-treatment-notes">{t.notes}</p>
            )}
            {onAddToPlan && (
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
                      notes: t.summary ?? t.whatItAddresses,
                    });
                  }}
                >
                  Add to treatment plan
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
