// Discussed Treatments Modal – header (title, subtitle, Treatment Explorer, Share, Close)

interface DiscussedTreatmentsModalHeaderProps {
  clientName: string;
  onShare: () => void;
  onClose: () => void;
  /** Open the treatment explorer photo gallery */
  onViewExamples?: () => void;
}

export default function DiscussedTreatmentsModalHeader({
  clientName,
  onShare,
  onClose,
  onViewExamples,
}: DiscussedTreatmentsModalHeaderProps) {
  return (
    <div className="modal-header discussed-treatments-modal-header">
      <div className="modal-header-info">
        <h2 className="modal-title">Treatment plan for {clientName}</h2>
        <p className="modal-subtitle">
          Adding to the plan saves to their record. Pick a topic, check what you
          discussed, add to plan — then share when ready.
        </p>
      </div>
      <div className="discussed-treatments-modal-header-actions">
        {onViewExamples && (
          <button
            type="button"
            className="btn-secondary btn-sm discussed-treatments-view-examples-header-btn"
            onClick={onViewExamples}
          >
            Treatment Explorer
          </button>
        )}
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={onShare}
        >
          Share with patient
        </button>
        <button
          type="button"
          className="btn-secondary btn-sm discussed-treatments-close-btn"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>
    </div>
  );
}
