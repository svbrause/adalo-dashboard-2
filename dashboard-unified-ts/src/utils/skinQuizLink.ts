/**
 * Helpers for the public skin quiz link sent via SMS.
 * Link format: /skin-quiz?r=<recordId>&t=<tableName>
 * so the standalone quiz page can save results to the correct Airtable record.
 */

import type { Client } from "../types";

const QUIZ_PATH = "/skin-quiz";

export function getSkinQuizLink(client: Client): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const params = new URLSearchParams();
  params.set("r", client.id);
  params.set("t", client.tableSource);
  return `${base}${QUIZ_PATH}?${params.toString()}`;
}

/** True if the client has completed the skin type quiz (has saved results). */
function hasCompletedSkinQuiz(client: Client): boolean {
  const quiz = client.skincareQuiz;
  return Boolean(quiz && typeof quiz === "object" && quiz.result);
}

export function getSkinQuizMessage(client: Client): string {
  const link = getSkinQuizLink(client);
  if (hasCompletedSkinQuiz(client)) {
    return `View your Skin Type Quiz results and personalized product recommendations: ${link}`;
  }
  return `Take our free Skin Type Quiz and get personalized product recommendations: ${link}`;
}

export function getQuizPath(): string {
  return QUIZ_PATH;
}

/** Parse recordId and tableName from current URL (for standalone quiz page). */
export function parseSkinQuizParams(): { recordId: string; tableName: string } | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const recordId = params.get("r");
  const tableName = params.get("t");
  if (!recordId || !tableName) return null;
  if (tableName !== "Patients" && tableName !== "Web Popup Leads") return null;
  return { recordId, tableName };
}

/** Check if current pathname is the standalone skin quiz page. */
export function isSkinQuizStandalonePath(): boolean {
  if (typeof window === "undefined") return false;
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  return path === QUIZ_PATH;
}
