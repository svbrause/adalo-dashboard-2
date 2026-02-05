/**
 * Debug index: links to Treatment Examples and Treatment Plan debug pages.
 * Open /debug (no provider login). Use these URLs to test popups with dummy data.
 */

import "../styles/index.css";

const DEBUG_LINKS = [
  {
    path: "/debug/treatment-examples",
    label: "Treatment Examples popup",
    description: "TreatmentPhotos with dummy photos",
  },
  {
    path: "/debug/treatment-plan",
    label: "Treatment Plan popup",
    description: "DiscussedTreatmentsModal with dummy client & plan",
  },
  {
    path: "/debug/patient-issues",
    label: "Patient Issues popup",
    description: "PatientIssuesModal with photo carousel for each issue",
  },
] as const;

export default function DebugIndexPage() {
  return (
    <div className="debug-page debug-index">
      <div className="debug-page-header">
        <h1>Debug pages</h1>
        <p>
          Same components as the main dashboard, with dummy data. No provider
          login. <a href="/">Back to app</a>
        </p>
      </div>
      <ul className="debug-index-list">
        {DEBUG_LINKS.map(({ path, label, description }) => (
          <li key={path}>
            <a href={path}>{label}</a>
            <span className="debug-index-desc">{description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
