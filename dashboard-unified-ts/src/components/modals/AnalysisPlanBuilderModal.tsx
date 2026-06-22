import TreatmentRecommenderByTreatment, {
  type TreatmentRecommenderByTreatmentProps,
} from "../treatmentRecommender/TreatmentRecommenderByTreatment";
import "./AnalysisPlanBuilderModal.css";

interface AnalysisPlanBuilderModalProps
  extends Omit<TreatmentRecommenderByTreatmentProps, "onBack"> {
  onClose: () => void;
  darkMode?: boolean;
  /** When set, header reflects issue-focused entry (e.g. Treat Dark Spots). */
  focusIssueLabel?: string | null;
}

export default function AnalysisPlanBuilderModal({
  onClose,
  darkMode,
  focusIssueLabel: _focusIssueLabel,
  ...recommenderProps
}: AnalysisPlanBuilderModalProps) {
  void _focusIssueLabel;
  return (
    <div
      className={`analysis-planbuilder-modal-overlay${darkMode ? " cdp-dark" : ""}`}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="analysis-planbuilder-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Plan builder"
      >
        <div className="analysis-planbuilder-modal__header">
          <h2 className="analysis-planbuilder-modal__title">
            Plan Builder
          </h2>
          <button
            type="button"
            className="analysis-planbuilder-modal__close"
            onClick={onClose}
            aria-label="Close plan builder"
          >
            ×
          </button>
        </div>
        <div className="analysis-planbuilder-modal__body">
          <TreatmentRecommenderByTreatment
            {...recommenderProps}
            hideClientPhoto
            onBack={onClose}
          />
        </div>
      </div>
    </div>
  );
}
