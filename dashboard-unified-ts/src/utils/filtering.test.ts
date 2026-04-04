import { describe, expect, it } from "vitest";
import type { Client, FilterState } from "../types";
import { applyFilters, applySorting } from "./filtering";

const defaultFilters: FilterState = {
  source: "",
  ageMin: null,
  ageMax: null,
  analysisStatus: "",
  skinAnalysisState: "",
  treatmentFinderState: "",
  treatmentPlanState: "",
  leadStage: "",
  locationName: "",
  providerName: "",
};

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: "c-1",
    name: "Jane Doe",
    email: "jane@example.com",
    phone: "(949) 555-1234",
    zipCode: null,
    age: 34,
    ageRange: null,
    dateOfBirth: null,
    goals: [],
    wellnessGoals: [],
    concerns: "",
    areas: [],
    aestheticGoals: "",
    skinType: null,
    skinTone: null,
    ethnicBackground: null,
    engagementLevel: null,
    casesViewedCount: 0,
    totalCasesAvailable: 0,
    concernsExplored: [],
    photosLiked: 0,
    photosViewed: 0,
    treatmentsViewed: [],
    source: "Website",
    status: "new",
    priority: "medium",
    createdAt: "2026-01-01T00:00:00.000Z",
    notes: "",
    appointmentDate: null,
    treatmentReceived: null,
    revenue: null,
    lastContact: null,
    isReal: true,
    tableSource: "Patients",
    facialAnalysisStatus: null,
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
    locationName: null,
    appointmentStaffName: null,
    discussedItems: [],
    contactHistory: [],
    ...overrides,
  };
}

describe("applyFilters", () => {
  it("matches phone numbers by normalized digits", () => {
    const clients = [makeClient({ phone: "(949) 555-1234" })];

    const result = applyFilters(clients, defaultFilters, "9495551234");
    expect(result).toHaveLength(1);
  });

  it("handles null-ish client fields safely during search", () => {
    const unsafeClient = makeClient({
      name: null as unknown as string,
      email: undefined as unknown as string,
      phone: null as unknown as string,
    });

    const result = applyFilters([unsafeClient], defaultFilters, "anything");
    expect(result).toEqual([]);
  });

  it("supports treatment-plan has/blank filters", () => {
    const withPlan = makeClient({
      id: "with-plan",
      discussedItems: [
        {
          id: "item-1",
          treatment: "Botox",
        },
      ],
    });
    const withoutPlan = makeClient({ id: "without-plan", discussedItems: [] });

    const hasPlan = applyFilters(
      [withPlan, withoutPlan],
      { ...defaultFilters, treatmentPlanState: "has" },
      "",
    );
    const blankPlan = applyFilters(
      [withPlan, withoutPlan],
      { ...defaultFilters, treatmentPlanState: "blank" },
      "",
    );

    expect(hasPlan.map((c) => c.id)).toEqual(["with-plan"]);
    expect(blankPlan.map((c) => c.id)).toEqual(["without-plan"]);
  });
});

describe("applySorting", () => {
  it("sorts by last contact descending with createdAt fallback", () => {
    const a = makeClient({
      id: "a",
      createdAt: "2026-01-01T00:00:00.000Z",
      lastContact: null,
    });
    const b = makeClient({
      id: "b",
      createdAt: "2026-01-02T00:00:00.000Z",
      lastContact: "2026-01-03T00:00:00.000Z",
    });

    const sorted = applySorting([a, b], { field: "lastContact", order: "desc" });
    expect(sorted.map((c) => c.id)).toEqual(["b", "a"]);
  });
});
