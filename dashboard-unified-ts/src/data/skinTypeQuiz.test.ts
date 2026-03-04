import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  computeQuizScores,
  computeQuizResult,
  computeQuizProfile,
  getResultSummary,
  buildSkincareQuizPayload,
  getRecommendedProductsForSkinType,
  SKIN_TYPE_QUIZ,
  type GemstoneId,
} from "./skinTypeQuiz";

const GEMSTONES: GemstoneId[] = [
  "opal", "pearl", "jade", "quartz", "amber", "moonstone", "turquoise", "diamond",
];

describe("skinTypeQuiz", () => {
  describe("computeQuizScores", () => {
    it("returns zeros when no answers", () => {
      const scores = computeQuizScores({});
      expect(scores).toEqual({
        hydration: 0,
        reactivity: 0,
        pigmentation: 0,
      });
    });

    it("sums section points (1–4 per answer)", () => {
      // q1 hydration: index 0 = 1 point, q2 hydration: index 3 = 4 points
      const scores = computeQuizScores({ q1: 0, q2: 3 });
      expect(scores.hydration).toBe(1 + 4);
      expect(scores.reactivity).toBe(0);
      expect(scores.pigmentation).toBe(0);
    });

    it("ignores out-of-range answer index", () => {
      const scores = computeQuizScores({ q1: 999 });
      expect(scores.hydration).toBe(0);
    });
  });

  describe("computeQuizResult", () => {
    it("returns gemstone from section scores (e.g. all low = dry/sensitive/pigmented = amber)", () => {
      const answers: Record<string, number> = {};
      SKIN_TYPE_QUIZ.questions.forEach((q) => {
        answers[q.id] = 0; // first option = 1 point per section
      });
      const result = computeQuizResult(answers);
      expect(GEMSTONES).toContain(result);
      // Low hydration (5), low reactivity (6), low pigmentation (5) → D,S,P → amber
      expect(result).toBe("amber");
    });
  });

  describe("computeQuizProfile", () => {
    it("returns primary gemstone, section scores, and sectionLetters", () => {
      const profile = computeQuizProfile({});
      expect(GEMSTONES).toContain(profile.primary);
      expect(profile.scores).toHaveProperty("hydration");
      expect(profile.scores).toHaveProperty("reactivity");
      expect(profile.scores).toHaveProperty("pigmentation");
      expect(profile.sectionLetters).toHaveProperty("hydration");
      expect(profile.sectionLetters).toHaveProperty("reactivity");
      expect(profile.sectionLetters).toHaveProperty("pigmentation");
    });
  });

  describe("getResultSummary", () => {
    it("returns label and description for profile", () => {
      const profile = computeQuizProfile({ q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 });
      const summary = getResultSummary(profile);
      expect(typeof summary.label).toBe("string");
      expect(typeof summary.description).toBe("string");
    });
  });

  describe("buildSkincareQuizPayload", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-06-01T12:00:00.000Z"));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("builds payload with version, completedAt, result (gemstone), products", () => {
      const answers = { q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 };
      const payload = buildSkincareQuizPayload(answers);
      expect(payload.version).toBe(1);
      expect(payload.completedAt).toBe("2025-06-01T12:00:00.000Z");
      expect(payload.answers).toEqual(answers);
      expect(GEMSTONES).toContain(payload.result);
      expect(Array.isArray(payload.recommendedProductNames)).toBe(true);
      expect(payload.resultLabel).toBeDefined();
    });
  });

  describe("getRecommendedProductsForSkinType", () => {
    it("returns array of product names for each gemstone", () => {
      for (const t of GEMSTONES) {
        const products = getRecommendedProductsForSkinType(t);
        expect(Array.isArray(products)).toBe(true);
        expect(products.length).toBeGreaterThan(0);
      }
    });
  });
});
