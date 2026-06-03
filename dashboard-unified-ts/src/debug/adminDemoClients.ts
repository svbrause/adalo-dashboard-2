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

/** Kept for compatibility with older imports; demo clients no longer receive name suffixes. */
export const ADMIN_DEMO_NAME_COLLISION_SUFFIX = "";

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

const MORGAN_SEVERITY: AnalysisSeverityScoresData = {
  schema_version: 1,
  detector_type: "multi_region",
  submission_id: "admin-demo-morgan",
  issues: {
    "Facial Redness": {
      predicted: true,
      probability: 0.88,
      severity: 2,
      severity_normalized_0_1: 0.62,
      severity_level: "moderate",
    },
    "Enlarged Pores": {
      predicted: true,
      probability: 0.81,
      severity: 2,
      severity_normalized_0_1: 0.54,
      severity_level: "moderate",
    },
    "Acne / Breakouts": {
      predicted: true,
      probability: 0.74,
      severity: 2,
      severity_normalized_0_1: 0.48,
      severity_level: "mild-moderate",
    },
    "Uneven Skin Texture": {
      predicted: true,
      probability: 0.69,
      severity: 1,
      severity_normalized_0_1: 0.38,
      severity_level: "mild",
    },
  },
};

export function getAdminDemoClients(): Client[] {
  return [
    baseClient({
      id: "admin-demo-morgan",
      name: "Morgan Westmoreland",
      age: 42,
      ageRange: "40-49",
      phone: "+1 555 312 8804",
      frontPhoto: "/demo-3d/morgan-westmoreland/morgan-westmoreland-front-color.jpg",
      frontPhotoLoaded: true,
      galleryPhotoSlots: [
        { id: "front",               label: "Front",                 url: "/demo-3d/morgan-westmoreland/morgan-westmoreland-front-color.jpg" },
        { id: "right45",             label: "Right three-quarter",   url: "/demo-3d/morgan-westmoreland/morgan-westmoreland-three-quarter-right-color.jpg" },
        { id: "right90",             label: "Right profile",         url: "/demo-3d/morgan-westmoreland/morgan-westmoreland-profile-right-color.jpg" },
        { id: "left45",              label: "Left three-quarter",    url: "/demo-3d/morgan-westmoreland/morgan-westmoreland-three-quarter-left-color.jpg" },
        { id: "left90",              label: "Left profile",          url: "/demo-3d/morgan-westmoreland/morgan-westmoreland-profile-left-color.jpg" },
      ],
      interestedIssues: "Facial Redness, Enlarged Pores, Acne / Breakouts, Uneven Skin Texture",
      allIssues: "Facial Redness, Enlarged Pores, Acne / Breakouts, Uneven Skin Texture",
      skinType: "Combination",
      skinTone: "Medium-Fair",
      aestheticGoals: "Reduce redness and improve skin texture and tone",
      severityScoresFromAnalyses: MORGAN_SEVERITY,
      discussedItems: [
        item({
          id: "admin-morgan-d1",
          treatment: "IPL / Photofacial",
          interest: "Facial Redness",
          findings: ["Facial Redness", "Uneven Skin Texture"],
          region: "Full Face",
          timeline: "Now",
          quantity: "3",
        }),
        item({
          id: "admin-morgan-d2",
          treatment: "Chemical Peel",
          interest: "Enlarged Pores",
          findings: ["Enlarged Pores", "Acne / Breakouts"],
          region: "Full Face",
          timeline: "Now",
          quantity: "1",
        }),
        item({
          id: "admin-morgan-d3",
          treatment: "Skincare",
          interest: "Facial Redness",
          findings: ["Facial Redness"],
          region: "Full face",
          timeline: "Now",
          quantity: "1",
        }),
      ],
    }),

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
      skinComplaints: "Uneven pigment, early fine lines, mild texture changes, and occasional dryness",
      aestheticGoals: "Brighten uneven tone and build a prevention-focused skin quality plan",
      severityScoresFromAnalyses: TANYA_TAN_SEVERITY,
      demoFacialAnalysisAi: TANYA_TAN_ANALYSIS_AI,
      skincareQuiz: TANYA_TAN_SKINCARE_QUIZ,
      discussedItems: [
        item({
          id: "admin-tanya-d1",
          treatment: "Chemical Peel",
          product: "Depigmentation peel",
          interest: "Dark Spots",
          findings: ["Dark Spots", "Red Spots", "Uneven skin tone"],
          region: "Full Face",
          timeline: "Now",
          quantity: "1",
          planQuoteRole: "core",
        }),
        item({
          id: "admin-tanya-d2",
          treatment: "Microneedling",
          product: "PDGF with microneedling",
          interest: "Uneven skin texture",
          findings: ["Blackheads", "Whiteheads", "Fine Lines"],
          region: "Face",
          timeline: "Add next visit",
          quantity: "3",
          planQuoteRole: "core",
        }),
        item({
          id: "admin-tanya-d3",
          treatment: "Skincare",
          product: "SkinCeuticals Discoloration Defense | Targeted Serum for Dark Spots & Uneven Skin Tone",
          interest: "Dark Spots",
          findings: ["Dark Spots", "Uneven skin tone"],
          region: "Full face",
          timeline: "Now",
          quantity: "1",
          planQuoteRole: "core",
        }),
        item({
          id: "admin-tanya-d4",
          treatment: "Neurotoxin",
          product: "Botox",
          interest: "Forehead Wrinkles",
          findings: ["Forehead Wrinkles", "Crow's Feet Wrinkles"],
          region: "Forehead",
          timeline: "Wishlist",
          quantity: "16",
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
  void liveNames;
  return client;
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
