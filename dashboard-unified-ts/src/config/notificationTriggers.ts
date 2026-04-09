/**
 * Shared “when it sends” copy where SMS and email describe the same user action
 * (single source of truth for Settings → Notifications).
 */

/** Treatment Finder: patient welcome text + team new-lead email fire on the same submission. */
export const TREATMENT_FINDER_WEBSITE_COMPLETION_TRIGGER =
  "Someone completes the Treatment Finder on your website";

/** Facial analysis: photos in — SMS + “analysis started” email describe the same moment. */
export const FACIAL_ANALYSIS_IN_PROGRESS_TRIGGER =
  "We received their scan photos and their analysis is being prepared";

/** Facial analysis: report done — SMS + patient/team “report ready” email describe the same moment. */
export const FACIAL_ANALYSIS_READY_TO_REVIEW_TRIGGER =
  "Their facial analysis is ready for them to review";
