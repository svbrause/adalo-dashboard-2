import type { Client } from "../types";
import {
  formatFacialStatusForDisplay,
  getFacialStatusBorderColorForDisplay,
  getFacialStatusColorForDisplay,
  hasFacialInterestedTreatments,
} from "./statusFormatting";

export type AnalysisSectionIconKind =
  | "not_started"
  | "pending"
  | "ready"
  | "reviewed";

export function getAnalysisSectionIconKind(
  client: Client,
  providerCode?: string | null,
): AnalysisSectionIconKind {
  const label = formatFacialStatusForDisplay(
    client.facialAnalysisStatus,
    hasFacialInterestedTreatments(client),
    providerCode,
  );
  const lower = label.toLowerCase();
  if (lower.includes("reviewed")) return "reviewed";
  if (lower.includes("ready")) return "ready";
  if (lower === "pending" || lower.includes("pending")) return "pending";
  if (lower.includes("not started")) return "not_started";
  return "pending";
}

export function analysisSectionAriaLabel(
  client: Client,
  providerCode?: string | null,
): string {
  const t = formatFacialStatusForDisplay(
    client.facialAnalysisStatus,
    hasFacialInterestedTreatments(client),
    providerCode,
  );
  return `Analysis: ${t}`;
}

export function analysisSectionIconColors(
  client: Client,
  providerCode?: string | null,
): { fill: string; border: string } {
  return {
    fill: getFacialStatusColorForDisplay(
      client.facialAnalysisStatus,
      hasFacialInterestedTreatments(client),
      providerCode,
    ),
    border: getFacialStatusBorderColorForDisplay(
      client.facialAnalysisStatus,
      hasFacialInterestedTreatments(client),
      providerCode,
    ),
  };
}

export function hasTreatmentPlanItems(client: Client): boolean {
  return (client.discussedItems?.length ?? 0) > 0;
}

export function hasQuizCompleted(client: Client): boolean {
  if (client.skincareQuiz?.completedAt) return true;
  if (client.wellnessQuiz?.completedAt) return true;
  return false;
}
