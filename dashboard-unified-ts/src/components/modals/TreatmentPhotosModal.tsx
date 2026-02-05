// Wrapper that opens TreatmentPhotos in a modal overlay (same component, different entry point)

import type { Client } from "../../types";
import type { DiscussedItem } from "../../types";
import TreatmentPhotos, {
  type TreatmentPlanPrefill,
} from "./DiscussedTreatmentsModal/TreatmentPhotos";
import "./TreatmentPhotosModal.css";

export interface TreatmentPhotosModalProps {
  client: Client;
  /** When opened from an issue in View Details */
  issue?: string;
  /** Region/area for that issue */
  region?: string;
  /** When opened from an interested treatment (suggestion name) */
  interest?: string;
  onClose: () => void;
  onUpdate: () => void | Promise<void>;
  /** When provided, "Add to plan" opens the treatment planning modal with form prefilled instead of adding directly */
  onAddToPlanWithPrefill?: (prefilled: TreatmentPlanPrefill) => void;
  /** Current plan items – for "Added to plan" state */
  planItems?: DiscussedItem[];
}

export default function TreatmentPhotosModal({
  client,
  issue,
  region,
  interest,
  onClose,
  onUpdate,
  onAddToPlanWithPrefill,
  planItems = [],
}: TreatmentPhotosModalProps) {
  return (
    <div
      className="treatment-photos-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-label="Treatment Explorer"
    >
      <div className="treatment-photos-modal-content" onClick={(e) => e.stopPropagation()}>
        <TreatmentPhotos
          client={client}
          issue={issue}
          region={region}
          interest={interest}
          onClose={onClose}
          onUpdate={onUpdate}
          onAddToPlanWithPrefill={onAddToPlanWithPrefill}
          planItems={planItems}
        />
      </div>
    </div>
  );
}
