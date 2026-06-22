import { describe, expect, it } from "vitest";
import { TANYA_TAN_SKINCARE_QUIZ } from "../debug/adminDemoSkincareQuiz";
import { buildAnalysisSummaryFromClient } from "./postVisitBlueprintAnalysis";
import {
  buildPostVisitBlueprintLink,
  compactPostVisitBlueprintPayloadForShare,
  isBrokenTurntableVideoUrl,
  resolveBlueprintTurntableVideoUrl,
  type PostVisitBlueprintPayload,
} from "./postVisitBlueprint";
import { TANYA_AURA_TURNTABLE_VIDEO_URL } from "./auraScanConfig";
import type { DiscussedItem } from "../types";

function buildBulkyTanyaFixture(): PostVisitBlueprintPayload {
  const discussedItems: DiscussedItem[] = [
    {
      id: "slim-tanya-d1",
      treatment: "Morpheus8",
      product: "Morpheus8",
      interest: "Dark Spots",
      findings: ["Dark Spots", "Red Spots", "Uneven skin tone"],
      region: "Full Face",
      timeline: "Now",
      quantity: "1",
      planQuoteRole: "core",
    },
  ];
  const analysisSummary = buildAnalysisSummaryFromClient({
    id: "slimstudio-demo-tanya",
    name: "Tanya Tan",
    tableSource: "Patients",
    ageRange: "30-39",
    skinType: "Combination",
    allIssues: ["Dark Spots", "Crow's Feet Wrinkles", "Dry Lips"],
  } as unknown as Parameters<typeof buildAnalysisSummaryFromClient>[0]);
  const os = analysisSummary?.overviewSnapshot;
  if (os) {
    os.aiNarrative = "x".repeat(8_000);
    os.assessmentParagraph = "y".repeat(4_000);
  }
  return {
    version: 1,
    token: "fbe46ea3-3829-4c3f-a225-2155971f5aa1",
    createdAt: "2026-06-05T21:03:32.912Z",
    clinicName: "Slim Studio",
    providerName: "Slim Studio",
    providerCode: "SlimStudio56",
    patient: {
      id: "slimstudio-demo-tanya",
      name: "Tanya Tan",
      email: "slimstudio-demo-tanya@demo.slimstudio.local",
      phone: "+1 404 555 08803",
      tableSource: "Patients",
      ageRange: "30-39",
      skinType: "Combination",
      skinTone: "Medium",
      ethnicBackground: null,
      skincareQuiz: TANYA_TAN_SKINCARE_QUIZ,
      frontPhoto: "/demo-3d/tanya-tan-front.png",
      turntableVideoUrl: "/src/assets/images/turntable_1024_black_scrub.mp4",
    },
    discussedItems,
    quote: {
      lineItems: [
        {
          label: "Morpheus8",
          skuName: "Morpheus8",
          skuNote: "Reference pricing",
          price: 950,
          displayPrice: "$950",
          isEstimate: false,
          quoteLineKind: "treatment",
        },
      ],
      total: 950,
      totalAfterDiscount: 950,
      hasUnknownPrices: false,
      isMintMember: false,
    },
    cta: { financingUrl: "https://slimstudioatlanta.com/patient-resources/financing/" },
    analysisSummary: analysisSummary
      ? {
          ...analysisSummary,
          concerns:
            "Uneven pigmentation, dryness, and occasional dryness on cheeks.",
          aestheticGoals: "Brighten uneven tone and build a prevention-focused plan",
        }
      : undefined,
    recommenderFocusRegions: ["Full Face", "Eyes"],
  };
}

describe("compactPostVisitBlueprintPayloadForShare", () => {
  it("shrinks URL-embed payload dramatically while keeping plan essentials", () => {
    const full = buildBulkyTanyaFixture();
    const fullLink = buildPostVisitBlueprintLink(full.token, full);
    const compact = compactPostVisitBlueprintPayloadForShare(full, {
      forUrlEmbed: true,
    });
    const compactLink = buildPostVisitBlueprintLink(full.token, compact);

    expect(compactLink.length).toBeLessThan(fullLink.length * 0.35);
    expect(compact.patient.skincareQuiz?.answers).toEqual({});
    expect(compact.patient.skincareQuiz?.recommendedProductNames).toBeUndefined();
    expect(compact.patient.email).toBeUndefined();
    expect(compact.analysisSummary?.overviewSnapshot?.aiNarrative).toBeUndefined();
    expect(compact.discussedItems[0]?.treatment).toBe("Morpheus8");
    expect(compact.quote.total).toBe(950);
  });

  it("strips analysis for Wellnest server store compaction", () => {
    const full = buildBulkyTanyaFixture();
    full.providerCode = "WellnestWellness";
    const compact = compactPostVisitBlueprintPayloadForShare(full, {
      omitAnalysis: true,
      publicPatientId: "wellnest-demo",
    });
    expect(compact.analysisSummary).toBeUndefined();
    expect(compact.patient.id).toBe("wellnest-demo");
  });
});

describe("resolveBlueprintTurntableVideoUrl", () => {
  it("flags dev-only turntable paths as broken", () => {
    expect(isBrokenTurntableVideoUrl("/src/assets/images/turntable_1024_black_scrub.mp4")).toBe(
      true,
    );
    expect(isBrokenTurntableVideoUrl(TANYA_AURA_TURNTABLE_VIDEO_URL)).toBe(false);
  });

  it("prefers stable Tanya demo URL over a broken stored path", () => {
    const url = resolveBlueprintTurntableVideoUrl({
      id: "slimstudio-demo-tanya",
      name: "Tanya Tan",
      turntableVideoUrl: "/src/assets/images/turntable_1024_black_scrub.mp4",
    });
    expect(url).toBe(TANYA_AURA_TURNTABLE_VIDEO_URL);
  });

  it("uses stored GCS turntable for real patients without a name map", () => {
    const gcs = "https://storage.googleapis.com/example/turntables/patient.mp4";
    const url = resolveBlueprintTurntableVideoUrl({
      id: "rec123",
      name: "Jane Doe",
      turntableVideoUrl: gcs,
    });
    expect(url).toBe(gcs);
  });
});
