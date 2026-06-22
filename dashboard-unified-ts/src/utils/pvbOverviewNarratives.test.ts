import { describe, expect, it } from "vitest";
import type { TreatmentChapter } from "./blueprintTreatmentChapters";
import { buildChapterOverviewContent } from "./pvbOverviewNarratives";

function chapter(overrides: Partial<TreatmentChapter> = {}): TreatmentChapter {
  return {
    key: "morpheus8",
    treatment: "Morpheus8",
    displayName: "Morpheus8",
    displayArea: "Full face",
    whyRecommended: [],
    meta: {
      longevity: "6-12+ months",
      downtime: "3-7 days",
      priceRange: "$950",
    },
    videos: [],
    caseCard: null,
    planItems: [
      {
        id: "morpheus8-1",
        treatment: "Morpheus8",
        product: "Morpheus8",
        region: "Full face",
        quantity: "1",
        timeline: "Now",
      },
    ],
    mirrorHighlightTerms: [],
    ...overrides,
  };
}

describe("buildChapterOverviewContent", () => {
  it("uses treatment-specific copy for Morpheus8 instead of generic placeholders", () => {
    const overview = buildChapterOverviewContent(
      chapter(),
      undefined,
      {
        chapterIndex: 0,
        totalChapters: 2,
        allChapterDisplayNames: ["Morpheus8", "Medical Grade Skincare"],
        planShape: {
          chapterCount: 2,
          includesSkincare: true,
          includesInOfficeOrProcedures: true,
        },
      },
    );

    expect(overview.complementTop).toContain("tightening skin");
    expect(overview.intro).toContain("radiofrequency energy");
    expect(overview.analysis).toContain("sandpapery texture");
    expect(overview.complementBottom).toContain("collagen-remodeling");

    const combined = [
      overview.complementTop,
      overview.intro,
      overview.analysis,
      overview.complementBottom,
    ].join(" ");
    expect(combined).not.toContain("That’s the role Morpheus8 plays");
    expect(combined).not.toContain("focused on Morpheus8");
    expect(combined).not.toContain("part of your coordinated in-office plan");
  });
});
