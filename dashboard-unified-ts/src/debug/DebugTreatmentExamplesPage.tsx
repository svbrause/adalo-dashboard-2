/**
 * Debug page: Treatment Examples popup with real data from the Photos table.
 * Open /debug/treatment-examples or ?debug=treatment-examples (no provider login).
 * Same component and data source as live – apples to apples comparison.
 */

import { useMemo } from "react";
import TreatmentPhotos from "../components/modals/DiscussedTreatmentsModal/TreatmentPhotos";
import { getDummyClient } from "./dummyData";
import "../styles/index.css";
/* Same CSS as live: modal and Treatment Photos styles (live loads this via DiscussedTreatmentsModal) */
import "../components/modals/DiscussedTreatmentsModal/index.css";

export default function DebugTreatmentExamplesPage() {
  const client = useMemo(() => getDummyClient(), []);

  return (
    <div className="debug-page debug-treatment-examples">
      <div className="debug-page-header">
        <h1>Debug: Treatment Examples</h1>
        <p>
          Same component and Photos table data as live. No provider login.{" "}
          <a href="/debug">Debug home</a> · <a href="/">Exit debug</a>
        </p>
      </div>
      {/* Same DOM structure as live: overlay + modal so layout/CSS match exactly */}
      <div className="discussed-treatments-photos-modal-overlay debug-photos-overlay">
        <div className="discussed-treatments-photos-modal">
          <TreatmentPhotos
            client={client}
            onClose={() => {
              window.location.href = "/";
            }}
          />
        </div>
      </div>
    </div>
  );
}
