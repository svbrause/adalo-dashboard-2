/**
 * Debug page: Patient Issues Modal with photo carousel.
 * Uses dummy client data with issues to test the IssuePhotoCarousel.
 */

import { getDummyClient, getDummyTreatmentPhotos } from "./dummyData";
import PatientIssuesModal from "../components/modals/PatientIssuesModal";

export default function DebugPatientIssuesPage() {
  const dummyClient = getDummyClient();
  const dummyPhotos = getDummyTreatmentPhotos();

  return (
    <div className="debug-page debug-patient-issues">
      <div className="debug-page-header">
        <h1>Debug: Patient Issues</h1>
        <p>
          PatientIssuesModal with photo carousel. <a href="/debug">Debug home</a> ·{" "}
          <a href="/">Exit debug</a>
        </p>
      </div>
      <PatientIssuesModal
        client={dummyClient}
        onClose={() => {}}
        onPhotoClick={(photo) => console.log("Photo clicked:", photo)}
        demoPhotos={dummyPhotos}
      />
    </div>
  );
}
