/**
 * Build user-facing text from POST /api/dashboard/sms failure JSON.
 * Pure function — unit-tested; does not call OpenPhone.
 */

export type SmsSendErrorPayload = {
  error?: string | { message?: string };
  message?: string;
  details?: { message?: string; code?: string };
};

/** OpenPhone: invalid `to` phone number (see public API docs). */
export const OPENPHONE_INVALID_TO_CODE = "0202400";

export function buildSmsSendErrorMessage(errorData: unknown): string {
  if (errorData == null || typeof errorData !== "object") {
    return "Failed to send SMS notification";
  }
  const ed = errorData as SmsSendErrorPayload;
  const detailsMsg =
    typeof ed.details?.message === "string" ? ed.details.message.trim() : "";
  const nestedErrorMsg =
    typeof ed.error === "object" &&
    ed.error !== null &&
    typeof ed.error.message === "string"
      ? ed.error.message.trim()
      : "";
  const base =
    detailsMsg ||
    nestedErrorMsg ||
    (typeof ed.error === "string" ? ed.error : "") ||
    ed.message ||
    "Failed to send SMS notification";

  const opCode =
    typeof ed.details?.code === "string" ? ed.details.code.trim() : "";

  const isInvalidTo =
    opCode === OPENPHONE_INVALID_TO_CODE ||
    /`to` array is invalid|invalid.*`to`/i.test(base);

  if (isInvalidTo) {
    return "OpenPhone rejected this recipient as invalid or not SMS-deliverable. Use a real US mobile number you can receive texts on.";
  }

  return base;
}
