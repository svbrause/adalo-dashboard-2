/**
 * Demo patients for Slim Studio Face & Body (`SlimStudio56` / `rec60E89lWbT9GyFT`)
 * when the dashboard has few or no live Airtable rows yet.
 * Emily Dunhill, Allison Baum, Tanya Tan, and Courtney Bellamy mirror Admin showcase demos
 * (Aura turntable, severity scores, skincare quiz where applicable).
 *
 * Merged in dev by default; disable with VITE_SLIM_STUDIO_SAMPLE_CLIENTS=false.
 * Treatment plan edits persist in sessionStorage (ids `slimstudio-demo-*`).
 */

import type {
  AnalysisSeverityScoresData,
  Client,
  DemoFacialAnalysisAi,
  DiscussedItem,
} from "../types";
import { isSlimStudioProvider } from "../data/slimStudioOfferings";
import { COURTNEY_BELLAMY_SEVERITY_ISSUES } from "./adminDemoSeverityOverlay";
import { TANYA_TAN_SKINCARE_QUIZ } from "./adminDemoSkincareQuiz";
import { TANYA_TAN_GALLERY_PHOTO_SLOTS } from "../utils/auraTanAnglePhotos";
import tanyaTanSeverityScoresJson from "./tanya-tan-severity-scores.json";
import tanyaTanAnalysisAiJson from "./tanya-tan-analysis-ai.json";

const TANYA_TAN_SEVERITY: AnalysisSeverityScoresData = {
  ...(tanyaTanSeverityScoresJson as AnalysisSeverityScoresData),
  submission_id: "slimstudio-demo-tanya",
};
const TANYA_TAN_ANALYSIS_AI = tanyaTanAnalysisAiJson as DemoFacialAnalysisAi;

const COURTNEY_AURA_BASE =
  "/demo-3d/courtney-bellamy-side-photo/courtney-bellamy-side-photo";

const COURTNEY_SEVERITY: AnalysisSeverityScoresData = {
  schema_version: 1,
  detector_type: "multi_region",
  submission_id: "slimstudio-demo-courtney",
  issues: COURTNEY_BELLAMY_SEVERITY_ISSUES,
};

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
const COURTNEY_DETECTED_ISSUES = detectedIssuesFromSeverity(COURTNEY_SEVERITY);

const EMILY_SEVERITY: AnalysisSeverityScoresData = {
  schema_version: 1,
  detector_type: "multi_region",
  submission_id: "slimstudio-demo-emily",
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
  submission_id: "slimstudio-demo-allison",
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

const DEMO_HEADSHOTS = {
  jennifer:
    "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&w=480&h=480&fit=crop&crop=faces&q=85",
  david:
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&w=480&h=480&fit=crop&crop=faces&q=85",
} as const;

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

export function isSlimStudioSampleClientInjectionEnabled(): boolean {
  const v = import.meta.env.VITE_SLIM_STUDIO_SAMPLE_CLIENTS as string | undefined;
  if (v === "false" || v === "0") return false;
  if (v === "true" || v === "1") return true;
  return Boolean(import.meta.env.DEV);
}

export function getSlimStudioSampleClients(): Client[] {
  return [
    baseClient({
      id: "slimstudio-demo-maya",
      name: "Maya Chen",
      tableSource: "Web Popup Leads",
      source: "website popup",
      phone: "+1 404 226 4325",
      age: 44,
      ageRange: "40-49",
      goals: ["Contour Jawline", "Even Skin Tone"],
      interestedIssues: "Submental fullness, jawline definition",
      whichRegions: "Jawline, Chin",
      areas: ["Jawline"],
      skinType: "Dry",
      skinTone: "Fair",
      offerEarned: true,
      offerClaimed: false,
      facialAnalysisStatus: "pending",
      status: "new",
      priority: "high",
      discussedItems: items(
        {
          id: "slim-maya-d1",
          treatment: "Kybella",
          product: "Kybella",
          interest: "Contour Jawline",
          region: "Chin/Jaw",
          timeline: "Now",
          quantity: "1",
        },
        {
          id: "slim-maya-d2",
          treatment: "CoolSculpting",
          product: "CoolSculpting Elite",
          interest: "Contour Jawline",
          region: "Submental",
          timeline: "Now",
          quantity: "1",
        },
        {
          id: "slim-maya-d3",
          treatment: "Neurotoxin",
          product: "Daxxify",
          interest: "Contour Jawline",
          region: "Jawline",
          timeline: "Add next visit",
          quantity: "40",
        },
        {
          id: "slim-maya-d4",
          treatment: "Filler",
          product: "Facial Balancing",
          interest: "Contour Jawline",
          region: "Mid-face",
          timeline: "Add next visit",
          quantity: "1",
        },
      ),
    }),
    baseClient({
      id: "slimstudio-demo-renee",
      name: "Renee Wilson",
      tableSource: "Web Popup Leads",
      source: "website popup",
      phone: "+1 404 226 4399",
      age: 46,
      ageRange: "40-49",
      goals: ["Tighten Skin Laxity"],
      interestedIssues: "Skin laxity, texture",
      whichRegions: "Full Face",
      areas: ["Full Face"],
      skinType: "Dry",
      skinTone: "Fair",
      offerEarned: true,
      offerClaimed: true,
      facialAnalysisStatus: "not-started",
      status: "contacted",
      priority: "medium",
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      lastContact: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      discussedItems: items(
        {
          id: "slim-renee-d1",
          treatment: "Morpheus8",
          product: "Morpheus8",
          interest: "Tighten Skin Laxity",
          region: "Full Face",
          timeline: "Now",
          quantity: "1",
        },
        {
          id: "slim-renee-d2",
          treatment: "Glacial",
          product: "Glacial (Cryomodulation)",
          interest: "Tighten Skin Laxity",
          region: "Full Face",
          timeline: "Now",
          quantity: "1",
        },
        {
          id: "slim-renee-d3",
          treatment: "Facials",
          product: "Facials",
          interest: "Tighten Skin Laxity",
          region: "Full Face",
          timeline: "Add next visit",
          quantity: "1",
        },
        {
          id: "slim-renee-d4",
          treatment: "Skincare",
          product: "Medical Grade Skincare",
          region: "Full face",
          timeline: "Now",
          quantity: "1",
        },
        {
          id: "slim-renee-d5",
          treatment: "Gut Health",
          product: "Gut Health Optimization",
          interest: "Tighten Skin Laxity",
          timeline: "Wishlist",
          quantity: "1",
        },
      ),
    }),
    baseClient({
      id: "slimstudio-demo-jennifer",
      name: "Jennifer Hart",
      frontPhoto: DEMO_HEADSHOTS.jennifer,
      frontPhotoLoaded: true,
      phone: "+1 404 410 7781",
      age: 39,
      ageRange: "30-39",
      goals: ["Smoothen Fine Lines", "Improve Cheek Definition"],
      interestedIssues: "Forehead wrinkles, nasolabial folds, under-eye hollows",
      whichRegions: "Forehead, Cheeks, Under eyes",
      areas: ["Forehead", "Cheeks", "Under eyes"],
      facialAnalysisStatus: "complete",
      status: "scheduled",
      priority: "high",
      allIssues: "Forehead Wrinkles, Nasolabial Folds, Under Eye Hollows",
      discussedItems: items(
        {
          id: "slim-jen-d1",
          treatment: "Neurotoxin",
          product: "Botox",
          interest: "Smoothen Fine Lines",
          findings: ["Forehead Wrinkles"],
          region: "Forehead",
          timeline: "Now",
          quantity: "40",
        },
        {
          id: "slim-jen-d2",
          treatment: "Filler",
          product: "Eyelight by Restylane",
          interest: "Shadow Correction",
          findings: ["Under Eye Hollows"],
          region: "Under Eyes",
          timeline: "Now",
          quantity: "1",
        },
        {
          id: "slim-jen-d3",
          treatment: "Filler",
          product: "Juvederm",
          interest: "Improve Cheek Definition",
          findings: ["Nasolabial Folds"],
          region: "Cheeks",
          timeline: "Now",
          quantity: "1",
        },
        {
          id: "slim-jen-d4",
          treatment: "Morpheus8",
          product: "Morpheus8",
          interest: "Tighten Skin Laxity",
          region: "Face",
          timeline: "Add next visit",
          quantity: "1",
        },
        {
          id: "slim-jen-d5",
          treatment: "Facials",
          product: "Facials",
          region: "Full Face",
          timeline: "Add next visit",
          quantity: "1",
        },
        {
          id: "slim-jen-d6",
          treatment: "Skincare",
          product: "Medical Grade Skincare",
          region: "Full face",
          timeline: "Now",
          quantity: "1",
        },
      ),
    }),
    baseClient({
      id: "slimstudio-demo-emily",
      name: "Emily Dunhill",
      age: 44,
      ageRange: "40-49",
      phone: "+1 404 555 8801",
      frontPhoto: "/demo-3d/emily-dunhill-photo.jpg",
      frontPhotoLoaded: true,
      galleryPhotoSlots: [
        { id: "front", label: "Front", url: "/demo-3d/emily-dunhill-photo.jpg" },
        { id: "left", label: "Left profile", url: "/demo-3d/emily-dunhill-photo-left.jpg" },
        { id: "right", label: "Right profile", url: "/demo-3d/emily-dunhill-photo-right.jpg" },
      ],
      interestedIssues:
        "Forehead Wrinkles, Crow's Feet, Under Eye Hollowing, Nasolabial Folds",
      allIssues:
        "Forehead Wrinkles, Crow's Feet, Under Eye Hollowing, Nasolabial Folds",
      whichRegions: "Forehead, Eyes, Mid-face",
      skinType: "Combination",
      skinTone: "Medium",
      aestheticGoals: "Refresh and natural rejuvenation",
      facialAnalysisStatus: "complete",
      severityScoresFromAnalyses: EMILY_SEVERITY,
      discussedItems: items(
        {
          id: "slim-emily-d1",
          treatment: "Neurotoxin",
          product: "Dysport",
          interest: "Forehead Wrinkles",
          findings: ["Forehead Wrinkles", "Crow's Feet"],
          region: "Forehead",
          timeline: "Now",
          quantity: "50",
        },
        {
          id: "slim-emily-d2",
          treatment: "Filler",
          product: "SKINVIVE",
          interest: "Under Eye Hollowing",
          findings: ["Under Eye Hollowing"],
          region: "Full Face",
          timeline: "Now",
          quantity: "1",
        },
        {
          id: "slim-emily-d3",
          treatment: "Biostimulants",
          product: "Sculptra",
          interest: "Nasolabial Folds",
          findings: ["Nasolabial Folds"],
          region: "Mid-face",
          timeline: "Add next visit",
          quantity: "1",
        },
        {
          id: "slim-emily-d4",
          treatment: "Glacial",
          product: "Glacial (Cryomodulation)",
          interest: "Forehead Wrinkles",
          findings: ["Forehead Wrinkles"],
          region: "Full Face",
          timeline: "Add next visit",
          quantity: "1",
        },
        {
          id: "slim-emily-d5",
          treatment: "Skincare",
          product: "Medical Grade Skincare",
          region: "Full face",
          timeline: "Now",
          quantity: "1",
        },
      ),
    }),
    baseClient({
      id: "slimstudio-demo-allison",
      name: "Allison Baum",
      age: 52,
      ageRange: "50-59",
      phone: "+1 404 555 8802",
      frontPhoto: "/demo-3d/allison-baum-photo.jpg",
      frontPhotoLoaded: true,
      galleryPhotoSlots: [
        { id: "front", label: "Front", url: "/demo-3d/allison-baum-photo.jpg" },
        { id: "left", label: "Left profile", url: "/demo-3d/allison-baum-photo-left.jpg" },
        { id: "right", label: "Right profile", url: "/demo-3d/allison-baum-photo-right.jpg" },
      ],
      interestedIssues:
        "Cheek Volume Loss, Marionette Lines, Lip Thinning, Jawline Definition",
      allIssues:
        "Cheek Volume Loss, Marionette Lines, Lip Thinning, Jawline Definition",
      whichRegions: "Cheeks, Lower face, Lips, Jawline",
      skinType: "Dry",
      skinTone: "Fair-Medium",
      aestheticGoals: "Volume restoration and lower face rejuvenation",
      facialAnalysisStatus: "complete",
      severityScoresFromAnalyses: ALLISON_SEVERITY,
      wellnessGoals: ["Hormone balance", "Energy"],
      discussedItems: items(
        {
          id: "slim-allison-d1",
          treatment: "Biostimulants",
          product: "Radiesse",
          interest: "Cheek Volume Loss",
          findings: ["Cheek Volume Loss"],
          region: "Cheeks",
          timeline: "Now",
          quantity: "2",
        },
        {
          id: "slim-allison-d2",
          treatment: "Filler",
          product: "Liquid Facelift",
          interest: "Marionette Lines",
          findings: ["Marionette Lines"],
          region: "Lower face",
          timeline: "Now",
          quantity: "1",
        },
        {
          id: "slim-allison-d3",
          treatment: "Filler",
          product: "Lip Fillers",
          interest: "Lip Thinning",
          findings: ["Lip Thinning"],
          region: "Lips",
          timeline: "Add next visit",
          quantity: "1",
        },
        {
          id: "slim-allison-d4",
          treatment: "Kybella",
          product: "Kybella",
          interest: "Jawline Definition",
          findings: ["Jawline Definition"],
          region: "Chin/Jaw",
          timeline: "Add next visit",
          quantity: "1",
        },
        {
          id: "slim-allison-d5",
          treatment: "Neurotoxin",
          product: "Xeomin",
          interest: "Forehead Wrinkles",
          findings: ["Forehead Wrinkles"],
          region: "Forehead",
          timeline: "Wishlist",
          quantity: "30",
        },
        {
          id: "slim-allison-d6",
          treatment: "HRT",
          product: "HRT (Hormone Replacement Therapy)",
          interest: "Energy",
          timeline: "Now",
          quantity: "1",
        },
      ),
    }),
    baseClient({
      id: "slimstudio-demo-tanya",
      name: "Tanya Tan",
      age: 38,
      ageRange: "30-39",
      phone: "+1 404 555 8803",
      frontPhoto: "/demo-3d/tanya-tan-front.png",
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
    baseClient({
      id: "slimstudio-demo-courtney",
      name: "Courtney Bellamy",
      age: 41,
      ageRange: "40-49",
      phone: "+1 404 555 8804",
      frontPhoto: `${COURTNEY_AURA_BASE}-front-color.png`,
      frontPhotoLoaded: true,
      auraManifestUrl: `${COURTNEY_AURA_BASE}-aura-manifest.json`,
      galleryPhotoSlots: [
        { id: "front", label: "Front", url: `${COURTNEY_AURA_BASE}-front-color.png` },
        {
          id: "three-quarter-right",
          label: "Right three-quarter",
          url: `${COURTNEY_AURA_BASE}-three-quarter-right-color.png`,
        },
        {
          id: "profile-right",
          label: "Right profile",
          url: `${COURTNEY_AURA_BASE}-profile-right-color.png`,
        },
      ],
      interestedIssues: COURTNEY_DETECTED_ISSUES,
      allIssues: COURTNEY_DETECTED_ISSUES,
      whichRegions: "Full Face",
      skinType: "Combination",
      skinTone: "Fair-Medium",
      skinComplaints: "Facial redness, visible pores, and uneven tone",
      aestheticGoals: "Calm redness, refine pores, and even skin tone",
      facialAnalysisStatus: "complete",
      severityScoresFromAnalyses: COURTNEY_SEVERITY,
      discussedItems: items(
        {
          id: "slim-courtney-d1",
          treatment: "Glacial",
          product: "Glacial (Cryomodulation)",
          interest: "Red Spots",
          findings: ["Red Spots", "Rosacea"],
          region: "Full Face",
          timeline: "Now",
          quantity: "1",
        },
        {
          id: "slim-courtney-d2",
          treatment: "Morpheus8",
          product: "Morpheus8",
          interest: "Whiteheads",
          findings: ["Whiteheads", "Blackheads"],
          region: "Face",
          timeline: "Add next visit",
          quantity: "3",
        },
        {
          id: "slim-courtney-d3",
          treatment: "Ariessence Pure PDGF+",
          product: "Ariessence Pure PDGF+",
          interest: "Dark Spots",
          findings: ["Dark Spots"],
          region: "Full Face",
          timeline: "Add next visit",
          quantity: "1",
        },
        {
          id: "slim-courtney-d4",
          treatment: "Facials",
          product: "Facials",
          interest: "Red Spots",
          findings: ["Rosacea"],
          region: "Full Face",
          timeline: "Now",
          quantity: "1",
        },
        {
          id: "slim-courtney-d5",
          treatment: "Skincare",
          product: "Medical Grade Skincare",
          interest: "Dark Spots",
          findings: ["Dark Spots", "Dry Skin"],
          region: "Full face",
          timeline: "Now",
          quantity: "1",
        },
        {
          id: "slim-courtney-d6",
          treatment: "Neurotoxin",
          product: "Daxxify",
          interest: "Forehead Wrinkles",
          findings: ["Forehead Wrinkles"],
          region: "Forehead",
          timeline: "Wishlist",
          quantity: "20",
        },
      ),
    }),
    baseClient({
      id: "slimstudio-demo-david",
      name: "David Brooks",
      frontPhoto: DEMO_HEADSHOTS.david,
      frontPhotoLoaded: true,
      phone: "+1 404 410 7792",
      age: 48,
      ageRange: "40-49",
      goals: ["Body contouring", "Muscle definition"],
      interestedIssues: "Abdominal fat, muscle tone",
      whichRegions: "Abdomen",
      areas: ["Abdomen"],
      facialAnalysisStatus: "pending",
      status: "scheduled",
      priority: "medium",
      wellnessGoals: ["Weight management", "Muscle tone", "Overall wellness"],
      discussedItems: items(
        {
          id: "slim-david-d1",
          treatment: "EMSculpt NEO",
          product: "EMSculpt NEO for the Abdomen",
          interest: "Muscle definition",
          region: "Abdomen",
          timeline: "Now",
          quantity: "4",
        },
        {
          id: "slim-david-d2",
          treatment: "CoolSculpting",
          product: "CoolSculpting for Men",
          interest: "Body contouring",
          region: "Flanks",
          timeline: "Now",
          quantity: "2",
        },
        {
          id: "slim-david-d3",
          treatment: "CoolSculpting",
          product: "DualSculpting & QuadSculpting",
          interest: "Body contouring",
          region: "Abdomen",
          timeline: "Add next visit",
          quantity: "1",
        },
        {
          id: "slim-david-d4",
          treatment: "Medical Weight Loss",
          product: "Medical Weight Loss",
          interest: "Body contouring",
          timeline: "Now",
          quantity: "1",
        },
        {
          id: "slim-david-d5",
          treatment: "Peptide Therapy",
          product: "Peptide Therapy",
          interest: "Muscle definition",
          timeline: "Add next visit",
          quantity: "1",
        },
        {
          id: "slim-david-d6",
          treatment: "Functional Wellness",
          product: "Functional Wellness",
          interest: "Overall wellness",
          timeline: "Add next visit",
          quantity: "1",
        },
      ),
    }),
  ];
}

export function getSlimStudioSampleClientsIfEnabled(
  provider: { code?: string | null; id?: string | null; name?: string | null } | undefined,
): Client[] {
  if (!isSlimStudioProvider(provider ?? null)) return [];
  if (!isSlimStudioSampleClientInjectionEnabled()) return [];
  return getSlimStudioSampleClients();
}
