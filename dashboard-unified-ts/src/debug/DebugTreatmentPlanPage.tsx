/**
 * Debug page: Treatment Plan popup with dummy data.
 * Open /debug/treatment-plan or ?debug=treatment-plan (no provider login).
 * Uses the same DiscussedTreatmentsModal component and CSS as the main dashboard.
 */

import DiscussedTreatmentsModal from "../components/modals/DiscussedTreatmentsModal";
import { getDummyClient } from "./dummyData";
import "../styles/index.css";

export default function DebugTreatmentPlanPage() {
  const client = getDummyClient();

  // NOTE: Do NOT wrap DiscussedTreatmentsModal in modal-content or discussed-treatments-* classes.
  // The component renders its own modal-overlay and modal-content; duplicating those classes
  // causes CSS conflicts (e.g., grid layout applied to wrong element).
  return (
    <div className="debug-page debug-treatment-plan">
      <div className="debug-page-header">
        <h1>Debug: Treatment Plan</h1>
        <p>
          Same component as the main dashboard. No provider login.{" "}
          <a href="/debug">Debug home</a> · <a href="/">Exit debug</a>
        </p>
      </div>
      <div className="debug-modal-wrap">
        <DiscussedTreatmentsModal
          client={client}
          onClose={() => {
            window.location.href = "/";
          }}
          onUpdate={() => {}}
        />
      </div>
    </div>
  );
}
