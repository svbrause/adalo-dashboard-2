import { THE_TREATMENT_BOOKING_URL } from "../utils/providerHelpers";

/** Matches backend SMS enqueue for /the-treatment Web Popup Leads (non–Walk-in, with phone). */
export const THE_TREATMENT_LEAD_WELCOME_PHONE = "(844) 344-7546";

/**
 * Builds the welcome SMS body (same structure as
 * test-replace-adalo-patient-app backend dashboard/leads POST handler).
 */
export function buildTheTreatmentLeadWelcomeSms(
  rawName: string,
  bookingUrl: string = THE_TREATMENT_BOOKING_URL,
): string {
  const firstName = rawName.trim()
    ? rawName.trim().split(/\s+/)[0]
    : "there";
  return (
    `Hi ${firstName},\n` +
    "Welcome to The Treatment! Thank you for using our treatment tracker — we hope you loved your results! " +
    "When you're ready, our team would love to sit down with you, go over your results, and build a treatment plan tailored just for you. " +
    "Contact us by phone at " +
    THE_TREATMENT_LEAD_WELCOME_PHONE +
    " or book your visit here: " +
    bookingUrl
  );
}

/** Sample for dashboard preview (example first name). */
export function buildTheTreatmentLeadWelcomeSmsPreview(
  exampleFirstName = "Alex",
): string {
  return buildTheTreatmentLeadWelcomeSms(exampleFirstName);
}
