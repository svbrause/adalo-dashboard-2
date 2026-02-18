/**
 * Shared filter selectors for Treatment Recommender (by treatment and by suggestion).
 * Lifts state up via props.
 */

import {
  HERE_FOR_OPTIONS,
  getFindingsOptionsForHereFor,
  GENERAL_CONCERNS_OPTIONS,
  REGION_FILTER_OPTIONS,
  type TreatmentRecommenderFilterState,
} from "../../config/treatmentRecommenderConfig";
import "./TreatmentRecommenderFilters.css";

export type { TreatmentRecommenderFilterState };

export interface TreatmentRecommenderFiltersProps {
  state: TreatmentRecommenderFilterState;
  onStateChange: (next: Partial<TreatmentRecommenderFilterState>) => void;
}

export default function TreatmentRecommenderFilters({
  state,
  onStateChange,
}: TreatmentRecommenderFiltersProps) {
  const findingsOptions = getFindingsOptionsForHereFor(state.hereFor);

  return (
    <div className="treatment-recommender-filters">
      <div className="treatment-recommender-filters__row">
        <label className="treatment-recommender-filters__label">
          What are you here for?
        </label>
        <div className="treatment-recommender-filters__chips">
          {HERE_FOR_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`treatment-recommender-filters__chip ${
                state.hereFor === opt ? "treatment-recommender-filters__chip--selected" : ""
              }`}
              onClick={() => onStateChange({ hereFor: opt })}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="treatment-recommender-filters__row">
        <label className="treatment-recommender-filters__label">
          What is the client here to address? (findings)
        </label>
        {state.hereFor == null ? (
          <p className="treatment-recommender-filters__hint">
            Select Tox or Filler above first to choose findings.
          </p>
        ) : (
          <div className="treatment-recommender-filters__chips">
            {findingsOptions.map((f) => (
              <button
                key={f}
                type="button"
                className={`treatment-recommender-filters__chip ${
                  state.findingsToAddress.includes(f) ? "treatment-recommender-filters__chip--selected" : ""
                }`}
                onClick={() => {
                  const next = state.findingsToAddress.includes(f)
                    ? state.findingsToAddress.filter((x) => x !== f)
                    : [...state.findingsToAddress, f];
                  onStateChange({ findingsToAddress: next });
                }}
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="treatment-recommender-filters__row">
        <label className="treatment-recommender-filters__label">
          General concerns
        </label>
        <div className="treatment-recommender-filters__chips">
          {GENERAL_CONCERNS_OPTIONS.map((c) => (
            <button
              key={c}
              type="button"
              className={`treatment-recommender-filters__chip ${
                state.generalConcerns.includes(c) ? "treatment-recommender-filters__chip--selected" : ""
              }`}
              onClick={() => {
                const next = state.generalConcerns.includes(c)
                  ? state.generalConcerns.filter((x) => x !== c)
                  : [...state.generalConcerns, c];
                onStateChange({ generalConcerns: next });
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="treatment-recommender-filters__row">
        <label className="treatment-recommender-filters__label">
          Same day / add-on only?
        </label>
        <div className="treatment-recommender-filters__chips">
          <button
            type="button"
            className={`treatment-recommender-filters__chip ${
              state.sameDayAddOn === true ? "treatment-recommender-filters__chip--selected" : ""
            }`}
            onClick={() => onStateChange({ sameDayAddOn: true })}
          >
            Yes
          </button>
          <button
            type="button"
            className={`treatment-recommender-filters__chip ${
              state.sameDayAddOn === false ? "treatment-recommender-filters__chip--selected" : ""
            }`}
            onClick={() => onStateChange({ sameDayAddOn: false })}
          >
            No
          </button>
        </div>
      </div>

      <div className="treatment-recommender-filters__row">
        <label className="treatment-recommender-filters__label">Region(s)</label>
        <div className="treatment-recommender-filters__chips">
          {REGION_FILTER_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              className={`treatment-recommender-filters__chip ${
                state.region.includes(r) ? "treatment-recommender-filters__chip--selected" : ""
              }`}
              onClick={() => {
                const next = state.region.includes(r)
                  ? state.region.filter((x) => x !== r)
                  : [...state.region, r];
                onStateChange({ region: next });
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
