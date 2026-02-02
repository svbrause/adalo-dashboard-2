// Discussed Treatments Modal – header (title, subtitle, Share, Close)

interface DiscussedTreatmentsModalHeaderProps {
  clientName: string;
  onShare: () => void;
  onClose: () => void;
}

export default function DiscussedTreatmentsModalHeader({
  clientName,
  onShare,
  onClose,
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
