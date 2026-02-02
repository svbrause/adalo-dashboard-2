// Status formatting utilities

export function formatFacialStatus(status: string | null | undefined): string {
  // Handle null, undefined, empty strings, or "not-started" - show as "Pending"
  if (
    !status ||
    (typeof status === "string" && status.trim() === "") ||
    String(status).toLowerCase().trim() === "not-started"
  ) {
    return "Pending";
  }

  const normalized = String(status).trim();

  // Handle common variations
  if (normalized.toLowerCase() === "pending") return "Pending";
  if (normalized.toLowerCase() === "ready") return "Ready for Review";
  if (
    normalized.toLowerCase().includes("patient reviewed") ||
    normalized.toLowerCase().includes("reviewed")
  ) {
    return "Patient Reviewed";
  }

  // Return normalized status (capitalize first letter)
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

/** True when the client has at least one interested treatment from analysis. */
export function hasInterestedTreatments(client: {
  interestedIssues?: string | string[] | null;
}): boolean {
  const v = client.interestedIssues;
  if (v == null) return false;
  if (Array.isArray(v)) return v.some((i) => i && String(i).trim());
  return String(v).trim().length > 0;
}

/**
 * Display version of facial status: when status is "Ready for Review" and the
 * patient has interested treatments, show "Reviewed by Patient" instead.
 */
export function formatFacialStatusForDisplay(
  status: string | null | undefined,
  hasInterestedTreatments: boolean,
): string {
  const base = formatFacialStatus(status);
  if (base === "Ready for Review" && hasInterestedTreatments) {
    return "Reviewed by Patient";
  }
  return base;
}

/**
 * Status to use for badge color when using display label: use "patient reviewed"
 * so the badge is green when we show "Reviewed by Patient".
 */
export function getFacialStatusColorForDisplay(
  status: string | null | undefined,
  hasInterestedTreatments: boolean,
): string {
  const display = formatFacialStatusForDisplay(status, hasInterestedTreatments);
  if (display === "Reviewed by Patient") {
    return getFacialStatusColor("patient reviewed");
  }
  return getFacialStatusColor(status);
}

/**
 * Border color when using display label: green when we show "Reviewed by Patient".
 */
export function getFacialStatusBorderColorForDisplay(
  status: string | null | undefined,
  hasInterestedTreatments: boolean,
): string {
  const display = formatFacialStatusForDisplay(status, hasInterestedTreatments);
  if (display === "Reviewed by Patient") {
    return getFacialStatusBorderColor("patient reviewed");
  }
  return getFacialStatusBorderColor(status);
}

export function getFacialStatusColor(status: string | null | undefined): string {
  if (!status) return "#E0E0E0"; // Gray for "Not Started"

  // First format the status to get the display version, then match
  const formattedStatus = formatFacialStatus(status);
  const normalized = String(status).trim().toLowerCase();
  const formattedNormalized = formattedStatus.toLowerCase();

  // Map colors - use consistent colors everywhere
  if (
    normalized === "pending" ||
    normalized === "not-started" ||
    formattedNormalized === "pending"
  ) {
    return "#FFF3CD"; // Light yellow for Pending
  } else if (
    normalized === "ready" ||
    normalized === "ready for review" ||
    normalized === "opened" ||
    formattedNormalized === "ready for review" ||
    formattedNormalized.includes("ready")
  ) {
    return "#D1ECF1"; // Light blue for Ready for Review
  } else if (
    normalized.includes("patient reviewed") ||
    normalized.includes("reviewed") ||
    formattedNormalized.includes("patient reviewed") ||
    formattedNormalized.includes("reviewed")
  ) {
    return "#D4EDDA"; // Light green for Patient Reviewed
  }

  return "#E0E0E0"; // Default gray
}

export function getFacialStatusBorderColor(status: string | null | undefined): string {
  if (!status) return "#E0E0E0"; // Gray for "Not Started"

  // First format the status to get the display version, then match
  const formattedStatus = formatFacialStatus(status);
  const normalized = String(status).trim().toLowerCase();
  const formattedNormalized = formattedStatus.toLowerCase();

  // Map to very pale, soft border colors - use same colors as getFacialStatusColor for consistency
  if (
    normalized === "pending" ||
    normalized === "not-started" ||
    formattedNormalized === "pending"
  ) {
    return "#FFECB3"; // Very pale yellow/amber for Pending
  } else if (
    normalized === "ready" ||
    normalized === "ready for review" ||
    normalized === "opened" ||
    formattedNormalized === "ready for review" ||
    formattedNormalized.includes("ready")
  ) {
    return "#D1ECF1"; // Light blue for Ready for Review (same as getFacialStatusColor)
  } else if (
    normalized.includes("patient reviewed") ||
    normalized.includes("reviewed") ||
    formattedNormalized.includes("patient reviewed") ||
    formattedNormalized.includes("reviewed")
  ) {
    return "#C8E6C9"; // Very pale green for Patient Reviewed
  }

  return "#E0E0E0"; // Default gray
}

export function getStatusBadgeColor(
  status: "new" | "contacted" | "requested-consult" | "scheduled" | "converted",
): string {
  const colorMap = {
    new: "#E3F2FD", // Light blue
    contacted: "#FFF3E0", // Light orange
    "requested-consult": "#E8EAF6", // Light indigo
    scheduled: "#E8F5E9", // Light green
    converted: "#F3E5F5", // Light purple
  };

  return colorMap[status] || "#E0E0E0";
}

export function getStatusTextColor(
  status: "new" | "contacted" | "requested-consult" | "scheduled" | "converted",
): string {
  const colorMap = {
    new: "#1976D2", // Blue
    contacted: "#F57C00", // Orange
    "requested-consult": "#3949AB", // Indigo
    scheduled: "#388E3C", // Green
    converted: "#7B1FA2", // Purple
  };

  return colorMap[status] || "#666";
}
