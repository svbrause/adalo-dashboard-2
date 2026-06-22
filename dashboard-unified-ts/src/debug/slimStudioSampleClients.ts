/**
 * Demo patient for Slim Studio Face & Body (`SlimStudio56` / `rec60E89lWbT9GyFT`)
 * when the dashboard has few or no live Airtable rows yet.
 * Tanya Tan mirrors the Admin showcase demo (Aura turntable, severity scores, skincare quiz).
 *
 * Merged for Slim Studio logins (dev and production); disable with VITE_SLIM_STUDIO_SAMPLE_CLIENTS=false.
 * Treatment plan edits persist in sessionStorage (ids `slimstudio-demo-*`).
 * Only **Patients** rows are injected — demo web-popup leads are omitted so the Leads board
 * stays limited to real funnel traffic.
 */

import type {
  AnalysisSeverityScoresData,
  Client,
  DemoFacialAnalysisAi,
  DiscussedItem,
} from "../types";
import { isSlimStudioProvider } from "../data/slimStudioOfferings";
import { TANYA_TAN_SKINCARE_QUIZ } from "./adminDemoSkincareQuiz";
import { TANYA_TAN_GALLERY_PHOTO_SLOTS } from "../utils/auraTanAnglePhotos";
import { demo3dAssetUrl } from "../utils/demoAssetUrls";
import tanyaTanSeverityScoresJson from "./tanya-tan-severity-scores.json";
import tanyaTanAnalysisAiJson from "./tanya-tan-analysis-ai.json";

const TANYA_TAN_SEVERITY: AnalysisSeverityScoresData = {
  ...(tanyaTanSeverityScoresJson as AnalysisSeverityScoresData),
  submission_id: "slimstudio-demo-tanya",
};
const TANYA_TAN_ANALYSIS_AI = tanyaTanAnalysisAiJson as DemoFacialAnalysisAi;

function detectedIssuesFromSeverity(
  severity: Pick<AnalysisSeverityScoresData, "issues">,
): string {
  return Object.entries(severity.issues ?? {})
    .filter(([, row]) => row.predicted)
    .sort(
      (a, b) =>
        (b[1].severity_normalized_0_1 ?? 0) - (a[1].severity_normalized_0_1 ?? 0),
    )
    .map(([name]) => name)
    .join(", ");
}

const TANYA_TAN_DETECTED_ISSUES = detectedIssuesFromSeverity(TANYA_TAN_SEVERITY);

function baseClient(overrides: Partial<Client> & Pick<Client, "id" | "name">): Client {
  const weekAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  return {
    email: `${overrides.id}@demo.slimstudio.local`,
    phone: "+1 404 555 0100",
    zipCode: "30305",
    age: 42,
    ageRange: "40-49",
    dateOfBirth: null,
    goals: [],
    wellnessGoals: [],
    concerns: "",
    areas: [],
    aestheticGoals: "",
    skinType: "Combination",
    skinTone: "Medium",
    ethnicBackground: null,
    engagementLevel: null,
    casesViewedCount: null,
    totalCasesAvailable: null,
    concernsExplored: null,
    photosLiked: 0,
    photosViewed: 0,
    treatmentsViewed: [],
    source: "Patients",
    status: "scheduled",
    priority: "medium",
    createdAt: weekAgo,
    notes: "Demo patient — not synced to Airtable.",
    appointmentDate: null,
    treatmentReceived: null,
    revenue: null,
    lastContact: weekAgo,
    isReal: false,
    tableSource: "Patients",
    facialAnalysisStatus: "pending",
    frontPhoto: null,
    frontPhotoLoaded: false,
    allIssues: "",
    interestedIssues: "",
    whichRegions: "",
    skinComplaints: "",
    processedAreasOfInterest: "",
    areasOfInterestFromForm: "",
    archived: false,
    offerClaimed: false,
    offerExpirationDate: null,
    locationName: "Slim Studio — Buckhead (demo)",
    appointmentStaffName: null,
    contactHistory: [],
    ...overrides,
  };
}

function items(...rows: DiscussedItem[]): DiscussedItem[] {
  return rows;
}

function normalizePersonName(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function filterOutSlimStudioSamplesDuplicatedByName(
  liveClients: Client[],
  samples: Client[],
): Client[] {
  const liveNameSet = new Set(
    liveClients.map((c) => normalizePersonName(c.name)).filter((n) => n.length > 0),
  );
  return samples.filter((s) => {
    const n = normalizePersonName(s.name);
    return !(n && liveNameSet.has(n));
  });
}

/** True when Slim Studio demo patients should be injected (mirrors Admin demo default-on for that provider). */
export function isSlimStudioSampleClientInjectionEnabled(
  provider?: { code?: string | null; id?: string | null; name?: string | null } | null,
): boolean {
  const v = import.meta.env.VITE_SLIM_STUDIO_SAMPLE_CLIENTS as string | undefined;
  if (v === "false" || v === "0") return false;
  if (v === "true" || v === "1") return true;
  if (isSlimStudioProvider(provider ?? null)) return true;
  return Boolean(import.meta.env.DEV);
}

export function getSlimStudioSampleClients(): Client[] {
  return [
    baseClient({
      id: "slimstudio-demo-tanya",
      name: "Tanya Tan",
      age: 38,
      ageRange: "30-39",
      phone: "+1 404 555 8803",
      frontPhoto: demo3dAssetUrl("tanya-tan-front.png"),
      frontPhotoLoaded: true,
      galleryPhotoSlots: TANYA_TAN_GALLERY_PHOTO_SLOTS,
      interestedIssues: "",
      allIssues: TANYA_TAN_DETECTED_ISSUES,
      whichRegions: "Full Face",
      skinType: "Combination",
      skinTone: "Medium",
      skinComplaints:
        "Uneven pigment, early fine lines, mild texture changes, and occasional dryness",
      aestheticGoals:
        "Brighten uneven tone and build a prevention-focused skin quality plan",
      facialAnalysisStatus: "complete",
      severityScoresFromAnalyses: TANYA_TAN_SEVERITY,
      demoFacialAnalysisAi: TANYA_TAN_ANALYSIS_AI,
      skincareQuiz: TANYA_TAN_SKINCARE_QUIZ,
      discussedItems: items(
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
        {
          id: "slim-tanya-d2",
          treatment: "Ariessence Pure PDGF+",
          product: "Ariessence Pure PDGF+",
          interest: "Uneven skin texture",
          findings: ["Blackheads", "Whiteheads", "Fine Lines"],
          region: "Face",
          timeline: "Add next visit",
          quantity: "3",
          planQuoteRole: "core",
        },
        {
          id: "slim-tanya-d3",
          treatment: "Glacial",
          product: "Glacial (Cryomodulation)",
          interest: "Dark Spots",
          findings: ["Red Spots", "Uneven skin tone"],
          region: "Full Face",
          timeline: "Now",
          quantity: "1",
          planQuoteRole: "core",
        },
        {
          id: "slim-tanya-d4",
          treatment: "Facials",
          product: "Facials",
          interest: "Uneven skin texture",
          findings: ["Fine Lines"],
          region: "Full Face",
          timeline: "Add next visit",
          quantity: "1",
          planQuoteRole: "core",
        },
        {
          id: "slim-tanya-d5",
          treatment: "Skincare",
          product: "Medical Grade Skincare",
          interest: "Dark Spots",
          findings: ["Dark Spots", "Uneven skin tone"],
          region: "Full face",
          timeline: "Now",
          quantity: "1",
          planQuoteRole: "core",
        },
        {
          id: "slim-tanya-d6",
          treatment: "Peptide Therapy",
          product: "Peptide Therapy",
          interest: "Uneven skin texture",
          timeline: "Add next visit",
          quantity: "1",
          planQuoteRole: "core",
        },
        {
          id: "slim-tanya-d7",
          treatment: "Neurotoxin",
          product: "Jeuveau",
          interest: "Forehead Wrinkles",
          findings: ["Forehead Wrinkles", "Crow's Feet Wrinkles"],
          region: "Forehead",
          timeline: "Wishlist",
          quantity: "16",
          planQuoteRole: "core",
        },
      ),
    }),
  ];
}

export function getSlimStudioSampleClientsIfEnabled(
  provider: { code?: string | null; id?: string | null; name?: string | null } | undefined,
): Client[] {
  if (!isSlimStudioProvider(provider ?? null)) return [];
  if (!isSlimStudioSampleClientInjectionEnabled(provider)) return [];
  return getSlimStudioSampleClients().filter((c) => c.tableSource === "Patients");
}
