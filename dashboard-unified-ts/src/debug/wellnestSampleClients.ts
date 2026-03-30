/**
 * Demo patients for Wellnest MD (`Wellnest1300`) when Airtable has no rows yet.
 * Merged in dev by default; disable with VITE_WELLNEST_SAMPLE_CLIENTS=false.
 * Treatment plan edits persist in sessionStorage (ids `wellnest-demo-*`) — see wellnestDemoPlanPersistence.
 *
 * Default headshots use local demo-environment assets under
 * `public/post-visit-blueprint/videos/wellnest/patient-photos`.
 * Optional env overrides remain supported for quick swaps.
 */

import type { Client, DiscussedItem } from "../types";
import { isWellnestWellnessProviderCode } from "../data/wellnestOfferings";
import { getWellnestDemoPhotoUrls } from "./wellnestDemoPhotos";

const DEFAULT_DEMO_HEADSHOTS = {
  alex:
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&w=480&h=480&fit=crop&crop=faces&q=85",
  jordan:
    "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&w=480&h=480&fit=crop&crop=faces&q=85",
  taylor:
    "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&w=480&h=480&fit=crop&crop=faces&q=85",
} as const;

function resolveDemoHeadshotUrl(envValue: string | undefined, fallback: string): string {
  const trimmed = (envValue ?? "").trim();
  return trimmed || fallback;
}

const DEMO_HEADSHOTS = {
  alex: resolveDemoHeadshotUrl(
    import.meta.env.VITE_WELLNEST_DEMO_HEADSHOT_ALEX,
    getWellnestDemoPhotoUrls("wellnest-demo-alex")?.front ??
      DEFAULT_DEMO_HEADSHOTS.alex,
  ),
  jordan: resolveDemoHeadshotUrl(
    import.meta.env.VITE_WELLNEST_DEMO_HEADSHOT_JORDAN,
    getWellnestDemoPhotoUrls("wellnest-demo-jordan")?.front ??
      DEFAULT_DEMO_HEADSHOTS.jordan,
  ),
  taylor: resolveDemoHeadshotUrl(
    import.meta.env.VITE_WELLNEST_DEMO_HEADSHOT_TAYLOR,
    getWellnestDemoPhotoUrls("wellnest-demo-taylor")?.front ??
      DEFAULT_DEMO_HEADSHOTS.taylor,
  ),
} as const;

function baseClient(overrides: Partial<Client> & Pick<Client, "id" | "name">): Client {
  const now = new Date().toISOString();
  return {
    email: `${overrides.id}@demo.wellnest.local`,
    phone: "+1 555 0100",
    zipCode: "92101",
    age: 42,
    ageRange: "40-49",
    dateOfBirth: null,
    goals: ["Recovery", "Energy", "Longevity"],
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
    createdAt: now,
    notes: "Demo patient — not synced to Airtable.",
    appointmentDate: null,
    treatmentReceived: null,
    revenue: null,
    lastContact: now,
    isReal: false,
    tableSource: "Patients",
    facialAnalysisStatus: "pending",
    frontPhoto: DEMO_HEADSHOTS.alex,
    frontPhotoLoaded: true,
    allIssues: "",
    interestedIssues:
      "Recovery support, sleep quality, metabolic wellness, cognitive clarity",
    whichRegions: "",
    skinComplaints: "",
    processedAreasOfInterest: "",
    areasOfInterestFromForm: "",
    archived: false,
    offerClaimed: false,
    offerExpirationDate: null,
    locationName: "Wellnest MD (demo)",
    appointmentStaffName: null,
    contactHistory: [],
    ...overrides,
  };
}

function items(...rows: DiscussedItem[]): DiscussedItem[] {
  return rows;
}

/** When true, dashboard merges demo rows for Wellnest1300 after API fetch. */
export function isWellnestSampleClientInjectionEnabled(): boolean {
  const v = import.meta.env.VITE_WELLNEST_SAMPLE_CLIENTS as string | undefined;
  if (v === "false" || v === "0") return false;
  if (v === "true" || v === "1") return true;
  return Boolean(import.meta.env.DEV);
}

export function getWellnestSampleClients(): Client[] {
  return [
    baseClient({
      id: "wellnest-demo-alex",
      name: "Alex Rivera",
      phone: "+1 555 201 4401",
      age: 38,
      ageRange: "30-39",
      goals: ["Recovery", "Training support"],
      interestedIssues: "Tendon recovery, workout inflammation, gut comfort",
      discussedItems: items(
        {
          id: "wellnest-d1",
          treatment: "BPC-157",
          interest: "Recovery support",
          timeline: "Now",
          product: "SC injection preferred",
          quantity: "1",
          notes: "5-week supply discussed",
        },
        {
          id: "wellnest-d2",
          treatment: "Thymosin Beta-4 (TB-500)",
          interest: "Recovery support",
          timeline: "Add next visit",
          product: "SC injection preferred",
          quantity: "1",
        },
        {
          id: "wellnest-d3",
          treatment: "CJC-1295",
          interest: "Energy & recovery",
          timeline: "Wishlist",
          product: "SC injection",
          quantity: "1",
        },
      ),
      wellnessQuiz: {
        version: 1,
        completedAt: nowIso(),
        answers: {},
        suggestedTreatmentIds: ["bpc-157", "tb-500", "cjc-1295"],
      },
    }),
    baseClient({
      id: "wellnest-demo-jordan",
      name: "Jordan Lee",
      frontPhoto: DEMO_HEADSHOTS.jordan,
      phone: "+1 555 201 4402",
      age: 51,
      ageRange: "50-59",
      goals: ["Sleep", "Focus", "Stress balance"],
      interestedIssues: "Brain fog, stress, sleep latency",
      discussedItems: items(
        {
          id: "wellnest-d4",
          treatment: "Semax",
          interest: "Cognitive clarity",
          timeline: "Now",
          product: "Nasal spray available",
          quantity: "1",
        },
        {
          id: "wellnest-d5",
          treatment: "Selank",
          interest: "Stress balance",
          timeline: "Add next visit",
          product: "SC injection ideal",
          quantity: "1",
        },
        {
          id: "wellnest-d6",
          treatment: "Ipamorelin",
          interest: "Sleep & muscle",
          timeline: "Wishlist",
          product: "SC injection only",
          quantity: "1",
        },
      ),
    }),
    baseClient({
      id: "wellnest-demo-taylor",
      name: "Taylor Morgan",
      frontPhoto: DEMO_HEADSHOTS.taylor,
      phone: "+1 555 201 4403",
      age: 47,
      ageRange: "40-49",
      goals: ["Body composition", "Metabolic support"],
      interestedIssues: "Visceral fat, joint comfort, bone health",
      discussedItems: items(
        {
          id: "wellnest-d7",
          treatment: "Tesamorelin",
          interest: "Metabolic wellness",
          timeline: "Now",
          product: "SC injection",
          quantity: "1",
        },
        {
          id: "wellnest-d8",
          treatment: "AOD-9604",
          interest: "Metabolic wellness",
          timeline: "Add next visit",
          product: "SC injection",
          quantity: "1",
        },
        {
          id: "wellnest-d9",
          treatment: "Cartalax",
          interest: "Joint support",
          timeline: "Wishlist",
          product: "SC injection",
          quantity: "1",
        },
        {
          id: "wellnest-d10",
          treatment: "MK-677",
          interest: "Bone & joint",
          timeline: "Wishlist",
          product: "SC injection",
          quantity: "1",
        },
      ),
      wellnessQuiz: {
        version: 1,
        completedAt: nowIso(),
        answers: {},
        suggestedTreatmentIds: ["tesamorelin", "aod-9604", "cartalax", "mk-677"],
      },
    }),
  ];
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Append demo rows after live fetch when Wellnest + injection is on. */
export function getWellnestSampleClientsIfEnabled(
  providerCode: string | undefined,
): Client[] {
  if (!isWellnestWellnessProviderCode(providerCode)) return [];
  if (!isWellnestSampleClientInjectionEnabled()) return [];
  return getWellnestSampleClients();
}
