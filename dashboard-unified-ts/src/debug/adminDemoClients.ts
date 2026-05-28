/**
 * Demo patients for the Admin provider in development.
 * Emily Dunhill, Allison Baum, and Tanya Tan include facial analysis data + 3D model references
 * (see `src/utils/client3dConfig.ts` for the name→GLB mapping).
 * Tanya Tan is the full demo showcase: Aura turntable, analysis overview, severity scores,
 * completed skincare quiz (Amber) with AM/PM routine, and treatment plan items.
 *
 * Only injected when:
 *  1. The logged-in provider is Admin (code "admin" or "password", or display name "Admin"), AND
 *  2. Injection is enabled (always on for Admin provider unless VITE_ADMIN_DEMO_CLIENTS=false).
 */

import type {
  Client,
  DiscussedItem,
  AnalysisSeverityScoresData,
  DemoFacialAnalysisAi,
  Provider,
} from "../types";
import { isAdminBlueprintProvider } from "../utils/providerHelpers";
import { TANYA_TAN_SKINCARE_QUIZ } from "./adminDemoSkincareQuiz";
import { TANYA_TAN_GALLERY_PHOTO_SLOTS } from "../utils/auraTanAnglePhotos";
import tanyaTanSeverityScoresJson from "./tanya-tan-severity-scores.json";
import tanyaTanAnalysisAiJson from "./tanya-tan-analysis-ai.json";

const TANYA_TAN_SEVERITY = tanyaTanSeverityScoresJson as AnalysisSeverityScoresData;
const TANYA_TAN_ANALYSIS_AI = tanyaTanAnalysisAiJson as DemoFacialAnalysisAi;

/** Issue labels with predicted=true from Modal severity run, highest badness first. */
const TANYA_TAN_DETECTED_ISSUES = Object.entries(TANYA_TAN_SEVERITY.issues ?? {})
  .filter(([, row]) => row.predicted)
  .sort(
    (a, b) =>
      (b[1].severity_normalized_0_1 ?? 0) - (a[1].severity_normalized_0_1 ?? 0),
  )
  .map(([name]) => name)
  .join(", ");

/** Suffix when a live Airtable patient already uses the demo display name. */
export const ADMIN_DEMO_NAME_COLLISION_SUFFIX = " (Aura Demo)";

function item(partial: Partial<DiscussedItem> & Pick<DiscussedItem, "id" | "treatment">): DiscussedItem {
  return partial as DiscussedItem;
}

function baseClient(overrides: Partial<Client> & Pick<Client, "id" | "name">): Client {
  const now = new Date().toISOString();
  return {
    email: `${overrides.id}@demo.admin.local`,
    phone: "+1 555 000 0000",
    zipCode: "10001",
    age: null,
    ageRange: null,
    dateOfBirth: null,
    goals: [],
    wellnessGoals: [],
    concerns: "",
    areas: [],
    aestheticGoals: "",
    skinType: "Normal",
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
    createdAt: now,
    notes: "Demo patient — not synced to Airtable.",
    appointmentDate: null,
    treatmentReceived: null,
    revenue: null,
    lastContact: now,
    isReal: false,
    tableSource: "Patients",
    facialAnalysisStatus: "complete",
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
    locationName: "Admin (demo)",
    appointmentStaffName: null,
    contactHistory: [],
    ...overrides,
  };
}

const EMILY_SEVERITY: AnalysisSeverityScoresData = {
  schema_version: 1,
  detector_type: "multi_region",
  submission_id: "admin-demo-emily",
  issues: {
    "Forehead Wrinkles": {
      predicted: true,
      probability: 0.89,
      severity: 2,
      severity_normalized_0_1: 0.61,
      severity_level: "moderate",
    },
    "Crow's Feet": {
      predicted: true,
      probability: 0.82,
      severity: 2,
      severity_normalized_0_1: 0.55,
      severity_level: "moderate",
    },
    "Under Eye Hollowing": {
      predicted: true,
      probability: 0.77,
      severity: 2,
      severity_normalized_0_1: 0.51,
      severity_level: "mild-moderate",
    },
    "Nasolabial Folds": {
      predicted: true,
      probability: 0.73,
      severity: 2,
      severity_normalized_0_1: 0.48,
      severity_level: "mild-moderate",
    },
  },
};

const ALLISON_SEVERITY: AnalysisSeverityScoresData = {
  schema_version: 1,
  detector_type: "multi_region",
  submission_id: "admin-demo-allison",
  issues: {
    "Cheek Volume Loss": {
      predicted: true,
      probability: 0.91,
      severity: 3,
      severity_normalized_0_1: 0.68,
      severity_level: "moderate-severe",
    },
    "Marionette Lines": {
      predicted: true,
      probability: 0.85,
      severity: 2,
      severity_normalized_0_1: 0.58,
      severity_level: "moderate",
    },
    "Lip Thinning": {
      predicted: true,
      probability: 0.79,
      severity: 2,
      severity_normalized_0_1: 0.52,
      severity_level: "mild-moderate",
    },
    "Jawline Definition": {
      predicted: true,
      probability: 0.72,
      severity: 2,
      severity_normalized_0_1: 0.47,
      severity_level: "mild-moderate",
    },
  },
};

export function getAdminDemoClients(): Client[] {
  return [
    baseClient({
      id: "admin-demo-emily",
      name: "Emily Dunhill",
      age: 44,
      ageRange: "40-49",
      phone: "+1 555 312 8801",
      frontPhoto: "/demo-3d/emily-dunhill-photo.jpg",
      frontPhotoLoaded: true,
      galleryPhotoSlots: [
        { id: "front", label: "Front", url: "/demo-3d/emily-dunhill-photo.jpg" },
        { id: "left", label: "Left profile", url: "/demo-3d/emily-dunhill-photo-left.jpg" },
        { id: "right", label: "Right profile", url: "/demo-3d/emily-dunhill-photo-right.jpg" },
      ],
      interestedIssues: "Forehead Wrinkles, Crow's Feet, Under Eye Hollowing, Nasolabial Folds",
      allIssues: "Forehead Wrinkles, Crow's Feet, Under Eye Hollowing, Nasolabial Folds",
      skinType: "Combination",
      skinTone: "Medium",
      aestheticGoals: "Refresh and natural rejuvenation",
      severityScoresFromAnalyses: EMILY_SEVERITY,
      discussedItems: [
        item({
          id: "admin-emily-d1",
          treatment: "Botox",
          interest: "Forehead Wrinkles",
          findings: ["Forehead Wrinkles", "Crow's Feet"],
          region: "Forehead",
          timeline: "Now",
          quantity: "30",
        }),
        item({
          id: "admin-emily-d2",
          treatment: "Hyaluronic Acid Filler",
          interest: "Under Eye Hollowing",
          findings: ["Under Eye Hollowing"],
          region: "Under Eyes",
          timeline: "Now",
          quantity: "1",
        }),
        item({
          id: "admin-emily-d3",
          treatment: "Sculptra",
          interest: "Nasolabial Folds",
          findings: ["Nasolabial Folds"],
          region: "Mid-face",
          timeline: "Add next visit",
          quantity: "1",
        }),
      ],
    }),

    baseClient({
      id: "admin-demo-tanya",
      name: "Tanya Tan",
      age: 38,
      ageRange: "30-39",
      phone: "+1 555 312 8803",
      frontPhoto: "/demo-3d/tanya-tan-front.png",
      frontPhotoLoaded: true,
      galleryPhotoSlots: TANYA_TAN_GALLERY_PHOTO_SLOTS,
      interestedIssues: "",
      allIssues: TANYA_TAN_DETECTED_ISSUES,
      skinType: "Combination",
      skinTone: "Medium",
      skinComplaints: "Fine lines, uneven tone, occasional dryness",
      aestheticGoals: "Full demo — Aura scan, analysis overview, skincare quiz & routine",
      severityScoresFromAnalyses: TANYA_TAN_SEVERITY,
      demoFacialAnalysisAi: TANYA_TAN_ANALYSIS_AI,
      skincareQuiz: TANYA_TAN_SKINCARE_QUIZ,
      discussedItems: [
        item({
          id: "admin-tanya-d1",
          treatment: "Neurotoxin",
          product: "Botox",
          interest: "Forehead Wrinkles",
          findings: ["Forehead Wrinkles", "Crow's Feet"],
          region: "Forehead + Crow's Feet",
          timeline: "Now",
          quantity: "24",
          planQuoteRole: "core",
        }),
        item({
          id: "admin-tanya-d2",
          treatment: "Filler",
          product: "Fillers (except Voluma & Volux)",
          interest: "Under Eye Hollowing",
          findings: ["Under Eye Hollowing"],
          region: "Under Eyes",
          timeline: "Now",
          quantity: "1",
          planQuoteRole: "core",
        }),
        item({
          id: "admin-tanya-d3",
          treatment: "Chemical Peel",
          product: "Depigmentation peel",
          interest: "Uneven skin tone",
          findings: ["Uneven skin tone", "Perioral Lines"],
          region: "Full Face",
          timeline: "Add next visit",
          quantity: "1",
          planQuoteRole: "core",
        }),
        item({
          id: "admin-tanya-d4",
          treatment: "Skincare",
          product: "SkinCeuticals Discoloration Defense | Targeted Serum for Dark Spots & Uneven Skin Tone",
          interest: "Uneven skin tone",
          findings: ["Uneven skin tone"],
          region: "Full face",
          timeline: "Now",
          quantity: "1",
          planQuoteRole: "core",
        }),
      ],
    }),

    baseClient({
      id: "admin-demo-allison",
      name: "Allison Baum",
      age: 52,
      ageRange: "50-59",
      phone: "+1 555 312 8802",
      frontPhoto: "/demo-3d/allison-baum-photo.jpg",
      frontPhotoLoaded: true,
      galleryPhotoSlots: [
        { id: "front", label: "Front", url: "/demo-3d/allison-baum-photo.jpg" },
        { id: "left", label: "Left profile", url: "/demo-3d/allison-baum-photo-left.jpg" },
        { id: "right", label: "Right profile", url: "/demo-3d/allison-baum-photo-right.jpg" },
      ],
      interestedIssues: "Cheek Volume Loss, Marionette Lines, Lip Thinning, Jawline Definition",
      allIssues: "Cheek Volume Loss, Marionette Lines, Lip Thinning, Jawline Definition",
      skinType: "Dry",
      skinTone: "Fair-Medium",
      aestheticGoals: "Volume restoration and lower face rejuvenation",
      severityScoresFromAnalyses: ALLISON_SEVERITY,
      discussedItems: [
        item({
          id: "admin-allison-d1",
          treatment: "Radiesse",
          interest: "Cheek Volume Loss",
          findings: ["Cheek Volume Loss"],
          region: "Cheeks",
          timeline: "Now",
          quantity: "2",
        }),
        item({
          id: "admin-allison-d2",
          treatment: "Hyaluronic Acid Filler",
          interest: "Marionette Lines",
          findings: ["Marionette Lines"],
          region: "Lower face",
          timeline: "Now",
          quantity: "1",
        }),
        item({
          id: "admin-allison-d3",
          treatment: "Lip Filler",
          interest: "Lip Thinning",
          findings: ["Lip Thinning"],
          region: "Lips",
          timeline: "Add next visit",
          quantity: "1",
        }),
        item({
          id: "admin-allison-d4",
          treatment: "Kybella",
          interest: "Jawline Definition",
          findings: ["Jawline Definition"],
          region: "Chin/Jaw",
          timeline: "Wishlist",
          quantity: "1",
        }),
      ],
    }),
  ];
}

/** True when admin demo clients should be injected. */
export function isAdminDemoClientInjectionEnabled(
  provider?: Pick<Provider, "code" | "name"> | null,
): boolean {
  const v = import.meta.env.VITE_ADMIN_DEMO_CLIENTS as string | undefined;
  if (v === "false" || v === "0") return false;
  if (v === "true" || v === "1") return true;
  if (isAdminBlueprintProvider((provider ?? null) as Provider | null)) return true;
  return Boolean(import.meta.env.DEV);
}

function withDemoNameIfCollision(client: Client, liveNames: Set<string>): Client {
  const key = client.name.trim().toLowerCase();
  if (!liveNames.has(key)) return client;
  const suffixed = `${client.name}${ADMIN_DEMO_NAME_COLLISION_SUFFIX}`;
  return { ...client, name: suffixed };
}

/** Returns demo clients if Admin provider + injection enabled; skips duplicate ids, renames on name collision. */
export function getAdminDemoClientsIfEnabled(
  provider: Pick<Provider, "code" | "name"> | null | undefined,
  liveClients: Client[],
): Client[] {
  if (!isAdminBlueprintProvider((provider ?? null) as Provider | null)) return [];
  if (!isAdminDemoClientInjectionEnabled(provider)) return [];

  const liveIds = new Set(liveClients.map((c) => c.id));
  const liveNames = new Set(
    liveClients.map((c) => c.name.trim().toLowerCase()),
  );

  return getAdminDemoClients()
    .filter((c) => !liveIds.has(c.id))
    .map((c) => withDemoNameIfCollision(c, liveNames));
}
