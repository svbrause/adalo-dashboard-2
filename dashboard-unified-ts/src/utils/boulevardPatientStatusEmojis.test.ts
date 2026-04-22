import { describe, expect, it } from "vitest";
import {
  BOULEVARD_AI_ANALYSIS_COMPLETE_EMOJI,
  BOULEVARD_SKINCARE_QUIZ_EMOJI_BY_TYPE,
  buildBoulevardPatientStatusEmojiPrefix,
  getBoulevardEmojiForSkincareQuizResult,
} from "./boulevardPatientStatusEmojis";

describe("boulevardPatientStatusEmojis", () => {
  it("matches Erin spec for all eight gemstones", () => {
    expect(BOULEVARD_SKINCARE_QUIZ_EMOJI_BY_TYPE.OPAL).toBe("✨");
    expect(BOULEVARD_SKINCARE_QUIZ_EMOJI_BY_TYPE.PEARL).toBe("🦪");
    expect(BOULEVARD_SKINCARE_QUIZ_EMOJI_BY_TYPE.JADE).toBe("💚");
    expect(BOULEVARD_SKINCARE_QUIZ_EMOJI_BY_TYPE.QUARTZ).toBe("💎");
    expect(BOULEVARD_SKINCARE_QUIZ_EMOJI_BY_TYPE.AMBER).toBe("🧡");
    expect(BOULEVARD_SKINCARE_QUIZ_EMOJI_BY_TYPE.MOONSTONE).toBe("🌙");
    expect(BOULEVARD_SKINCARE_QUIZ_EMOJI_BY_TYPE.TURQUOISE).toBe("💙");
    expect(BOULEVARD_SKINCARE_QUIZ_EMOJI_BY_TYPE.DIAMOND).toBe("💍");
  });

  it("builds prefix: analysis only, quiz only, both", () => {
    expect(
      buildBoulevardPatientStatusEmojiPrefix({
        analysisComplete: true,
        skincareQuizResult: null,
      }),
    ).toBe(BOULEVARD_AI_ANALYSIS_COMPLETE_EMOJI);

    expect(
      buildBoulevardPatientStatusEmojiPrefix({
        analysisComplete: false,
        skincareQuizResult: "turquoise",
      }),
    ).toBe("💙");

    expect(
      buildBoulevardPatientStatusEmojiPrefix({
        analysisComplete: true,
        skincareQuizResult: "opal",
      }),
    ).toBe(`${BOULEVARD_AI_ANALYSIS_COMPLETE_EMOJI}✨`);
  });

  it("accepts uppercase result strings", () => {
    expect(getBoulevardEmojiForSkincareQuizResult("PEARL")).toBe("🦪");
  });

  it("returns null for invalid quiz result", () => {
    expect(getBoulevardEmojiForSkincareQuizResult("ruby")).toBeNull();
    expect(getBoulevardEmojiForSkincareQuizResult("")).toBeNull();
  });
});
