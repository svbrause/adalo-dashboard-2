/**
 * Skincare quiz payloads for admin demo patients (gemstone + AM/PM routine products).
 */

import { SKIN_TYPE_QUIZ, buildSkincareQuizPayload } from "../data/skinTypeQuiz";
import type { SkincareQuizData } from "../types";

/** Stable answers → Amber (dry, sensitive, pigmented) with full routine catalog. */
const AMBER_DEMO_ANSWERS: Record<string, number> = Object.fromEntries(
  SKIN_TYPE_QUIZ.questions.map((q) => [q.id, 0]),
);

export function buildAdminDemoSkincareQuiz(
  completedAt = "2026-02-15T14:30:00.000Z",
): SkincareQuizData {
  const payload = buildSkincareQuizPayload(AMBER_DEMO_ANSWERS);
  return {
    ...payload,
    completedAt,
  };
}

/** Tanya Tan showcase quiz (Amber + recommended products + routine sections). */
export const TANYA_TAN_SKINCARE_QUIZ = buildAdminDemoSkincareQuiz();
