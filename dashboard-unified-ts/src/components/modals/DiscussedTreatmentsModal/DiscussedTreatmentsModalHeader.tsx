// Discussed Treatments Modal – header (title, subtitle, Treatment Explorer, Checkout, Share, Close)

interface DiscussedTreatmentsModalHeaderProps {
  clientName: string;
  /** SMS summary (non–plan-link) or plan link — parent chooses */
  onShare: () => void;
  /** When false, Share button is hidden (e.g. empty plan). */
  showShare?: boolean;
  onClose: () => void;
  /** Open the treatment explorer photo gallery */
  onViewExamples?: () => void;
  /** Open the checkout (price summary) modal; when set, Checkout button is shown when plan has items */
  onCheckout?: () => void;
  /** Whether the plan has items (show Checkout button) */
  hasPlanItems?: boolean;
}

export default function DiscussedTreatmentsModalHeader({
  clientName,
  onShare,
  showShare = true,
  onClose,
  onViewExamples,
  onCheckout,
  hasPlanItems,
}: DiscussedTreatmentsModalHeaderProps) {
  return (
    <div className="modal-header discussed-treatments-modal-header">
      <div className="modal-header-info">
        <div className="discussed-treatments-modal-header-title-row">
          <h2 className="modal-title">{clientName}&apos;s plan</h2>
          {showShare ? (
            <button
              type="button"
              className="btn-secondary btn-sm discussed-treatments-header-share-btn"
              onClick={onShare}
            >
              Share
            </button>
          ) : null}
        </div>
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
        {onCheckout && hasPlanItems && (
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={onCheckout}
          >
            Quote
          </button>
        )}
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
