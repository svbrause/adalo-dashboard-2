/**
 * Skincare quiz payloads for admin demo patients (gemstone + AM/PM routine products).
 */

import { SKIN_TYPE_QUIZ, buildSkincareQuizPayload } from "../data/skinTypeQuiz";
import { SLIM_STUDIO_DEMO_PROVIDER } from "../data/slimStudioOfferings";
import { GRAVITAS_DEMO_PROVIDER } from "../data/gravitasOfferings";
import { PRETTY_PLEASE_DEMO_PROVIDER } from "../data/prettyPleaseOfferings";
import type { SkincareQuizData } from "../types";
import type { SkincareQuizProviderContext } from "../data/skinTypeQuiz";

/** Stable answers → Amber (dry, sensitive, pigmented) with full routine catalog. */
const AMBER_DEMO_ANSWERS: Record<string, number> = Object.fromEntries(
  SKIN_TYPE_QUIZ.questions.map((q) => [q.id, 0]),
);

export function buildAdminDemoSkincareQuiz(
  completedAt = "2026-02-15T14:30:00.000Z",
  provider?: SkincareQuizProviderContext | null,
): SkincareQuizData {
  const payload = buildSkincareQuizPayload(AMBER_DEMO_ANSWERS, provider);
  return {
    ...payload,
    completedAt,
  };
}

/** Default admin showcase quiz (SkinCeuticals / Treatment boutique catalog). */
export const ADMIN_DEMO_SKINCARE_QUIZ = buildAdminDemoSkincareQuiz();

/** Tanya Tan showcase quiz for Slim Studio (ISDIN, Hydrinity, Skinade). */
export const TANYA_TAN_SKINCARE_QUIZ = buildAdminDemoSkincareQuiz(
  "2026-02-15T14:30:00.000Z",
  SLIM_STUDIO_DEMO_PROVIDER,
);

/** Gravitas Medspa showcase quiz (Clear Skin Guide / Acne Erase catalog). */
export const GRAVITAS_SKINCARE_QUIZ = buildAdminDemoSkincareQuiz(
  "2026-02-15T14:30:00.000Z",
  GRAVITAS_DEMO_PROVIDER,
);

/** Pretty Please Aesthetics showcase quiz (shop catalog + core regimen). */
export const PRETTY_PLEASE_SKINCARE_QUIZ = buildAdminDemoSkincareQuiz(
  "2026-02-15T14:30:00.000Z",
  PRETTY_PLEASE_DEMO_PROVIDER,
);
