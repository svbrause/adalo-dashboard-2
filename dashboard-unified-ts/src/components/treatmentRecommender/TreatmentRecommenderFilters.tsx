/**
 * Shared filter selectors for Treatment Recommender (by treatment and by suggestion).
 * Lifts state up via props. Collapsible by default to save space; summary shows active filters.
 */

import { useState } from "react";
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
  /** When true, filters section is collapsed by default (default: true). */
  defaultCollapsed?: boolean;
}

/** Build a short summary of active filters for the collapsed header and for "Showing results for". */
export function getFilterSummary(state: TreatmentRecommenderFilterState): string {
  const parts: string[] = [];
  if (state.hereFor) parts.push(state.hereFor);
  if (state.findingsToAddress.length > 0) {
    parts.push(state.findingsToAddress.length === 1 ? state.findingsToAddress[0] : `${state.findingsToAddress.length} findings`);
  }
  if (state.generalConcerns.length > 0) {
    parts.push(state.generalConcerns.length === 1 ? state.generalConcerns[0] : `${state.generalConcerns.length} concerns`);
  }
  if (state.sameDayAddOn) parts.push("Same day only");
  if (state.region.length > 0) {
    parts.push(state.region.length === 1 ? state.region[0] : `${state.region.length} regions`);
  }
  return parts.length === 0 ? "No filters" : parts.join(" · ");
}

export default function TreatmentRecommenderFilters({
  state,
  onStateChange,
  defaultCollapsed = true,
}: TreatmentRecommenderFiltersProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const findingsOptions = getFindingsOptionsForHereFor(state.hereFor);
  const summary = getFilterSummary(state);
  const hasActiveFilters =
    state.hereFor != null ||
    state.findingsToAddress.length > 0 ||
    state.generalConcerns.length > 0 ||
    state.sameDayAddOn ||
    state.region.length > 0;

  return (
    <div className="treatment-recommender-filters">
      <button
        type="button"
        className="treatment-recommender-filters__toggle"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <span className="treatment-recommender-filters__toggle-icon">
          {collapsed ? "▶" : "▼"}
        </span>
        <span className="treatment-recommender-filters__toggle-label">Filters</span>
        <span className={`treatment-recommender-filters__summary ${hasActiveFilters ? "treatment-recommender-filters__summary--active" : ""}`}>
          {summary}
        </span>
      </button>

      {!collapsed && (
        <div className="treatment-recommender-filters__content">
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
            <p className="treatment-recommender-filters__hint">
              Narrows suggestions/treatments to those relevant to these concerns.
            </p>
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
            <p className="treatment-recommender-filters__hint">
              By suggestion: only suggestions for these areas. By treatment: only treatments for these areas.
            </p>
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
      )}
    </div>
  );
}
