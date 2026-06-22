import { describe, expect, it } from "vitest";
import type { TreatmentChapter } from "./blueprintTreatmentChapters";
import { buildPvbChapterInsightVisual } from "./pvbChapterInsightVisuals";

function chapter(overrides: Partial<TreatmentChapter> = {}): TreatmentChapter {
  return {
    key: "morpheus8",
    treatment: "Morpheus8",
    displayName: "Morpheus8",
    displayArea: "Full face",
    whyRecommended: [],
    meta: {},
    videos: [],
    caseCard: null,
    planItems: [
      {
        id: "morpheus8-1",
        treatment: "Morpheus8",
        product: "Morpheus8",
        interest: "Dark Spots",
        findings: ["Dark Spots", "Uneven skin tone"],
        region: "Full Face",
      },
    ],
    mirrorHighlightTerms: ["Full Face"],
    ...overrides,
  };
}

describe("buildPvbChapterInsightVisual", () => {
  it("uses Tanya's pigmentation map for pigment-related demo chapters", () => {
    const visual = buildPvbChapterInsightVisual(
      chapter(),
      {
        patientId: "slimstudio-demo-tanya",
        patientName: "Tanya Tan",
        heroPhotoUrl: "/demo-3d/tanya-tan-front.png",
      },
      {
        planRow: {
          key: "morpheus8",
          displayName: "Morpheus8",
          anchorId: "treatment-morpheus8",
          interest: "Dark Spots",
          findings: ["Dark Spots", "Uneven skin tone"],
        },
      },
    );

    expect(visual?.lens).toBe("pigmentation");
    expect(visual?.imageUrl).toContain("pigmentation");
    expect(visual?.mirrorImageUrl).toBeUndefined();
    expect(visual?.caption).not.toMatch(/aura/i);
    expect(visual?.caption).toMatch(/on the left/i);
    expect(visual?.caption).toContain("Dark Spots");
    expect(visual?.caption).toContain("Uneven skin tone");
  });

  it("rotates pigmentation map angles across chapters", () => {
    const patient = {
      patientId: "slimstudio-demo-tanya",
      patientName: "Tanya Tan",
      heroPhotoUrl: "/demo-3d/tanya-tan-front.png",
    };
    const ctx = {
      planRow: {
        key: "morpheus8",
        displayName: "Morpheus8",
        anchorId: "treatment-morpheus8",
        interest: "Dark Spots",
        findings: ["Dark Spots"],
      },
    };

    const first = buildPvbChapterInsightVisual(chapter(), patient, ctx, 0);
    const second = buildPvbChapterInsightVisual(
      chapter({ key: "bbl", displayName: "BBL", treatment: "Energy Treatment" }),
      patient,
      { ...ctx, planRow: { ...ctx.planRow, key: "bbl", displayName: "BBL" } },
      1,
    );

    expect(first?.lens).toBe("pigmentation");
    expect(second?.lens).toBe("pigmentation");
    expect(first?.imageUrl).toBeTruthy();
    expect(second?.imageUrl).toBeTruthy();
    expect(first?.imageUrl).not.toBe(second?.imageUrl);
  });

  it("prefers left-side angles when the chapter area is left profile", () => {
    const visual = buildPvbChapterInsightVisual(
      chapter({
        displayArea: "Left profile",
        planItems: [
          {
            id: "morpheus8-1",
            treatment: "Morpheus8",
            product: "Morpheus8",
            interest: "Dark Spots",
            findings: ["Dark Spots"],
            region: "Left profile",
          },
        ],
      }),
      {
        patientId: "slimstudio-demo-tanya",
        patientName: "Tanya Tan",
        heroPhotoUrl: "/demo-3d/tanya-tan-front.png",
      },
      undefined,
      0,
    );

    expect(visual?.imageUrl).toContain("profile-left-pigmentation");
  });

  it("cycles through all five pigmentation angles by chapter index", () => {
    const patient = {
      patientId: "slimstudio-demo-tanya",
      patientName: "Tanya Tan",
      heroPhotoUrl: "/demo-3d/tanya-tan-front.png",
    };
    const ctx = {
      planRow: {
        key: "morpheus8",
        displayName: "Morpheus8",
        anchorId: "treatment-morpheus8",
        interest: "Dark Spots",
        findings: ["Dark Spots"],
      },
    };
    const urls = [0, 1, 2, 3, 4].map((index) =>
      buildPvbChapterInsightVisual(chapter(), patient, ctx, index)?.imageUrl,
    );
    expect(new Set(urls).size).toBe(5);
  });

  it("falls back to patient area highlights for non-demo patients", () => {
    const visual = buildPvbChapterInsightVisual(
      chapter(),
      {
        patientId: "rec123",
        patientName: "Patient Example",
        heroPhotoUrl: "https://example.com/front.jpg",
      },
    );

    expect(visual?.lens).toBe("treatment-area");
    expect(visual?.mirrorImageUrl).toBe("https://example.com/front.jpg");
    expect(visual?.highlightTerms).toEqual(["Full Face"]);
  });
});
