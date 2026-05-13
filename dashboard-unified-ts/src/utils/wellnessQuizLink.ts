/**
 * Public wellness quiz link (SMS) — /wellness-quiz?r=<recordId>&t=<tableName>
 * Same query shape as the skin quiz; standalone page saves to "Wellness Quiz" on the record.
 */

import type { Client } from "../types";

const QUIZ_PATH = "/wellness-quiz";

export function getWellnessQuizLink(client: Client): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const params = new URLSearchParams();
  params.set("r", client.id);
  params.set("t", client.tableSource);
  return `${base}${QUIZ_PATH}?${params.toString()}`;
}

export function hasCompletedWellnessQuiz(client: Client): boolean {
  const q = client.wellnessQuiz;
  return Boolean(q && typeof q === "object" && q.completedAt);
}

/**
 * SMS / email prefill: invite (no quiz yet) or link back to the same public URL when results exist.
 * Mirrors getSkinQuizMessage; staff still use getWellnessQuizResultsSMSMessage for a text summary of results.
 */
export function getWellnessQuizMessage(client: Client): string {
  const link = getWellnessQuizLink(client);
  if (hasCompletedWellnessQuiz(client)) {
    return `View your wellness quiz results and discuss suggestions with your provider: ${link}`;
  }
  return `Complete your short wellness quiz to see personalized options from our offerings:
${link}`;
}

export function getWellnessQuizPath(): string {
  return QUIZ_PATH;
}

export function parseWellnessQuizParams(): { recordId: string; tableName: string } | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const recordId = params.get("r");
  const tableName = params.get("t");
  if (!recordId || !tableName) return null;
  if (tableName !== "Patients" && tableName !== "Web Popup Leads") return null;
  return { recordId, tableName };
}

export function isWellnessQuizStandalonePath(): boolean {
  if (typeof window === "undefined") return false;
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  return path === QUIZ_PATH;
}
