/**
 * Demo patient for Pretty Please Aesthetics (`PrettyPlease5357`) when the dashboard
 * has few or no live Airtable rows yet.
 * Tanya Tan mirrors the Admin / Slim Studio / Gravitas showcase (Aura turntable,
 * severity scores, completed Pretty Please skincare quiz).
 *
 * Merged for Pretty Please logins (dev and production); disable with
 * VITE_PRETTY_PLEASE_SAMPLE_CLIENTS=false.
 * Treatment plan edits persist in sessionStorage (ids `prettyplease-demo-*`).
 */

import type {
  AnalysisSeverityScoresData,
  Client,
  DemoFacialAnalysisAi,
  DiscussedItem,
} from "../types";
import {
  isPrettyPleaseProvider,
  PRETTY_PLEASE_PROVIDER_CODE,
} from "../data/prettyPleaseOfferings";
import { PRETTY_PLEASE_SKINCARE_QUIZ } from "./adminDemoSkincareQuiz";
import { TANYA_TAN_GALLERY_PHOTO_SLOTS } from "../utils/auraTanAnglePhotos";
import { demo3dAssetUrl } from "../utils/demoAssetUrls";
import tanyaTanSeverityScoresJson from "./tanya-tan-severity-scores.json";
import tanyaTanAnalysisAiJson from "./tanya-tan-analysis-ai.json";

const TANYA_TAN_SEVERITY: AnalysisSeverityScoresData = {
  ...(tanyaTanSeverityScoresJson as AnalysisSeverityScoresData),
  submission_id: "prettyplease-demo-tanya",
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
    email: `${overrides.id}@demo.prettyplease.local`,
    phone: "+1 916 555 1725",
    zipCode: "95819",
    age: 38,
    ageRange: "30-39",
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
    locationName: "Pretty Please Aesthetics — Sacramento (demo)",
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

export function filterOutPrettyPleaseSamplesDuplicatedByName(
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

export function isPrettyPleaseSampleClientInjectionEnabled(
  provider?: { code?: string | null; id?: string | null; name?: string | null } | null,
): boolean {
  const v = import.meta.env.VITE_PRETTY_PLEASE_SAMPLE_CLIENTS as string | undefined;
  if (v === "false" || v === "0") return false;
  if (v === "true" || v === "1") return true;
  if (isPrettyPleaseProvider(provider ?? null)) return true;
  return Boolean(import.meta.env.DEV);
}

export function getPrettyPleaseSampleClients(): Client[] {
  return [
    baseClient({
      id: "prettyplease-demo-tanya",
      name: "Tanya Tan",
      age: 38,
      ageRange: "30-39",
      phone: "+1 916 555 8803",
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
        "Brighten uneven tone with core Cleanse–Tone home care and in-office Vi Peel support",
      facialAnalysisStatus: "complete",
      severityScoresFromAnalyses: TANYA_TAN_SEVERITY,
      demoFacialAnalysisAi: TANYA_TAN_ANALYSIS_AI,
      skincareQuiz: PRETTY_PLEASE_SKINCARE_QUIZ,
      discussedItems: items(
        {
          id: "prettyplease-tanya-d1",
          treatment: "Vi Peels",
          product: "Vi Peel",
          interest: "Dark Spots",
          findings: ["Dark Spots", "Red Spots", "Uneven skin tone"],
          region: "Full Face",
          timeline: "Now",
          quantity: "1",
          planQuoteRole: "core",
        },
        {
          id: "prettyplease-tanya-d2",
          treatment: "Microneedling",
          product: "Microneedling",
          interest: "Uneven skin texture",
          findings: ["Blackheads", "Whiteheads", "Fine Lines"],
          region: "Face",
          timeline: "Add next visit",
          quantity: "3",
          planQuoteRole: "core",
        },
        {
          id: "prettyplease-tanya-d3",
          treatment: "Facials",
          product: "HydraFacial",
          interest: "Dark Spots",
          findings: ["Red Spots", "Uneven skin tone"],
          region: "Full Face",
          timeline: "Now",
          quantity: "1",
          planQuoteRole: "core",
        },
        {
          id: "prettyplease-tanya-d4",
          treatment: "Skincare",
          product: "LumaPro-C Serum",
          interest: "Dark Spots",
          findings: ["Dark Spots", "Uneven skin tone"],
          region: "Full face",
          timeline: "Now",
          quantity: "1",
          planQuoteRole: "core",
        },
        {
          id: "prettyplease-tanya-d5",
          treatment: "Skincare",
          product: "Firma-Bright",
          interest: "Uneven skin texture",
          findings: ["Fine Lines"],
          region: "Full face",
          timeline: "Now",
          quantity: "1",
          planQuoteRole: "core",
        },
        {
          id: "prettyplease-tanya-d6",
          treatment: "Laser & Energy",
          product: "Aerolase",
          interest: "Red Spots",
          findings: ["Red Spots", "Uneven skin tone"],
          region: "Full Face",
          timeline: "Add next visit",
          quantity: "1",
          planQuoteRole: "core",
        },
        {
          id: "prettyplease-tanya-d7",
          treatment: "Neurotoxin",
          product: "Botox",
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

export function getPrettyPleaseSampleClientsIfEnabled(
  provider: { code?: string | null; id?: string | null; name?: string | null } | undefined,
): Client[] {
  if (!isPrettyPleaseProvider(provider ?? null)) return [];
  if (!isPrettyPleaseSampleClientInjectionEnabled(provider)) return [];
  return getPrettyPleaseSampleClients().filter((c) => c.tableSource === "Patients");
}

export { PRETTY_PLEASE_PROVIDER_CODE };
