/**
 * Boulevard patient profile: leading status emojis (prefix on display name or nickname).
 *
 * Spec (ops / Erin):
 * - Completed AI facial analysis → 🧠
 * - Completed skincare (gemstone) quiz → emoji for that skin type
 * - Both may appear together; order is analysis first, then quiz.
 *
 * Gemstone emoji key: OPAL ✨, PEARL 🦪, JADE 💚, QUARTZ 💎, AMBER 🧡,
 * MOONSTONE 🌙, TURQUOISE 💙, DIAMOND 💍 — same as {@link GEMSTONE_BY_SKIN_TYPE}.
 */

import type { Client } from "../types";
import {
  GEMSTONE_BY_SKIN_TYPE,
  type GemstoneId,
} from "../data/skinTypeQuiz";
import { getAnalysisSectionIconKind } from "./dashboardListSectionStatus";

export const BOULEVARD_AI_ANALYSIS_COMPLETE_EMOJI = "🧠";

const GEMSTONE_IDS = Object.keys(GEMSTONE_BY_SKIN_TYPE) as GemstoneId[];

function isGemstoneId(value: string): value is GemstoneId {
  return (GEMSTONE_BY_SKIN_TYPE as Record<string, unknown>)[value] != null;
}

/**
 * Emoji for a stored quiz `result` (lowercase gemstone id). Returns null if unknown.
 */
export function getBoulevardEmojiForSkincareQuizResult(
  result: string | null | undefined,
): string | null {
  if (result == null || typeof result !== "string") return null;
  const key = result.trim().toLowerCase();
  if (!isGemstoneId(key)) return null;
  return GEMSTONE_BY_SKIN_TYPE[key].emoji;
}

/** Human-readable map for Zapier/backend docs (uppercase keys as in the spec sheet). */
export const BOULEVARD_SKINCARE_QUIZ_EMOJI_BY_TYPE: Record<string, string> =
  Object.fromEntries(
    GEMSTONE_IDS.map((id) => [id.toUpperCase(), GEMSTONE_BY_SKIN_TYPE[id].emoji]),
  );

export function buildBoulevardPatientStatusEmojiPrefix(options: {
  /** When true, prefix includes {@link BOULEVARD_AI_ANALYSIS_COMPLETE_EMOJI}. */
  analysisComplete: boolean;
  /**
   * Skincare quiz `result` (e.g. `opal`) when the quiz is completed and should show on Boulevard.
   * Omit or pass null when the quiz is not done or should not be reflected in the name.
   */
  skincareQuizResult?: string | null;
}): string {
  const parts: string[] = [];
  if (options.analysisComplete) {
    parts.push(BOULEVARD_AI_ANALYSIS_COMPLETE_EMOJI);
  }
  const skin = getBoulevardEmojiForSkincareQuizResult(
    options.skincareQuizResult ?? null,
  );
  if (skin) parts.push(skin);
  return parts.join("");
}

/**
 * True when the dashboard would treat facial analysis as “done enough” to show the
 * completed analysis icon (Ready for Review / Patient Reviewed path).
 * Align Boulevard automation with this unless ops defines a different Airtable rule.
 */
export function clientQualifiesForBoulevardAnalysisEmoji(
  client: Client,
  providerCode?: string | null,
): boolean {
  const kind = getAnalysisSectionIconKind(client, providerCode);
  return kind === "ready" || kind === "reviewed";
}

/**
 * Concatenated status emojis for a client (no trailing space). Consumers typically
 * prepend to the legal first name or nickname in Boulevard and strip/rebuild when status changes.
 */
export function buildBoulevardPatientStatusEmojiPrefixFromClient(
  client: Client,
  providerCode?: string | null,
): string {
  const analysisComplete = clientQualifiesForBoulevardAnalysisEmoji(
    client,
    providerCode,
  );
  const skincareQuizResult =
    client.skincareQuiz?.completedAt && client.skincareQuiz.result
      ? client.skincareQuiz.result
      : null;
  return buildBoulevardPatientStatusEmojiPrefix({
    analysisComplete,
    skincareQuizResult,
  });
}
