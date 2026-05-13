/**
 * Demo patients for the Admin provider in development.
 * Emily Dunhill and Allison Baum include facial analysis data + 3D model references
 * (see `src/utils/client3dConfig.ts` for the name→GLB mapping).
 *
 * Only injected when:
 *  1. The logged-in provider is Admin (code "admin" or "password"), AND
 *  2. Running in dev mode (or VITE_ADMIN_DEMO_CLIENTS=true).
 */

import type { Client, DiscussedItem, AnalysisSeverityScoresData } from "../types";

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

/** True when admin demo clients should be injected (dev mode or explicit env flag). */
export function isAdminDemoClientInjectionEnabled(): boolean {
  const v = import.meta.env.VITE_ADMIN_DEMO_CLIENTS as string | undefined;
  if (v === "false" || v === "0") return false;
  if (v === "true" || v === "1") return true;
  return Boolean(import.meta.env.DEV);
}

/** Returns demo clients if Admin provider + injection enabled; deduplicates by name. */
export function getAdminDemoClientsIfEnabled(
  providerCode: string | undefined,
  liveClients: Client[],
): Client[] {
  const code = (providerCode ?? "").trim().toLowerCase();
  if (code !== "admin" && code !== "password") return [];
  if (!isAdminDemoClientInjectionEnabled()) return [];

  const liveNames = new Set(
    liveClients.map((c) => c.name.trim().toLowerCase()),
  );
  return getAdminDemoClients().filter(
    (c) => !liveNames.has(c.name.trim().toLowerCase()),
  );
}
