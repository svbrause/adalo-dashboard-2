/**
 * PostHog funnel: Add Client → scan → plan → send PVS → open → engage → checkout CTA.
 * All events include `patient_id` and register the `patient` group when PostHog is configured.
 *
 * In PostHog: enable Group analytics with type key `patient`, or build insights that filter
 * by property `patient_id` across these events.
 */

const GROUP_TYPE = "patient";

export type PatientAcquisitionFunnelEvent =
  | "funnel_add_client_success"
  | "funnel_patient_scanned"
  | "funnel_treatment_plan_built"
  | "funnel_pvs_sent"
  | "funnel_pvs_opened"
  | "funnel_pvs_engaged_2min"
  | "funnel_pvs_checkout_cta";

export function capturePatientAcquisitionFunnelEvent(
  event: PatientAcquisitionFunnelEvent,
  patientId: string,
  properties?: Record<string, unknown>,
): void {
  if (!patientId?.trim()) return;
  const ph = typeof window !== "undefined" ? window.posthog : undefined;
  if (!ph?.capture) return;

  try {
    if (typeof ph.group === "function") {
      ph.group(GROUP_TYPE, patientId);
    }
  } catch {
    /* group may be unavailable if group analytics is off */
  }

  ph.capture(event, {
    patient_id: patientId,
    ...properties,
  });
}
