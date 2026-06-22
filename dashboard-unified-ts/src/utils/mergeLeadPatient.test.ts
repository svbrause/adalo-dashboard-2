import { describe, expect, it } from "vitest";
import type { Client } from "../types";
import { mergeDuplicateLeadAndPatient } from "./mergeLeadPatient";

function client(input: Partial<Client> & Pick<Client, "id" | "email" | "tableSource">): Client {
  const { id, email, tableSource, ...overrides } = input;
  return {
    id,
    name: overrides.name ?? id,
    email,
    phone: overrides.phone ?? "",
    zipCode: null,
    age: null,
    ageRange: null,
    dateOfBirth: null,
    goals: [],
    wellnessGoals: [],
    concerns: "",
    areas: null,
    aestheticGoals: "",
    skinType: null,
    skinTone: null,
    ethnicBackground: null,
    engagementLevel: null,
    casesViewedCount: null,
    totalCasesAvailable: null,
    concernsExplored: null,
    photosLiked: 0,
    photosViewed: 0,
    treatmentsViewed: [],
    source: "Patient",
    status: "new",
    priority: "low",
    createdAt: "2026-06-01T00:00:00.000Z",
    notes: "",
    appointmentDate: null,
    treatmentReceived: null,
    revenue: null,
    lastContact: null,
    isReal: true,
    tableSource,
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
    contactHistory: [],
    ...overrides,
  };
}

describe("mergeDuplicateLeadAndPatient", () => {
  it("collapses duplicate patient rows with the same email and keeps processed analysis assets", () => {
    const pending = client({
      id: "rec-pending",
      email: "Same@Example.com",
      tableSource: "Patients",
      name: "Same Person",
      phone: "555-111-2222",
      frontPhoto: [{ url: "https://example.com/front.jpg" }] as any,
      facialAnalysisStatus: "Pending",
      createdAt: "2026-06-01T00:00:00.000Z",
    });
    const processed = client({
      id: "rec-processed",
      email: "same@example.com",
      tableSource: "Patients",
      auraManifestUrl: "https://storage.googleapis.com/bucket/aura/person/person-aura-manifest.json",
      severityScoresFromAnalyses: {
        schema_version: 4,
        detector_type: "multi_region",
        issues: {
          "Red Spots": { predicted: true, severity_normalized_0_1: 0.4 },
        },
      },
      facialAnalysisStatus: "Ready",
      createdAt: "2026-06-02T00:00:00.000Z",
    });

    const merged = mergeDuplicateLeadAndPatient([pending, processed]);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("rec-processed");
    expect(merged[0].phone).toBe("555-111-2222");
    expect(merged[0].frontPhoto).toEqual(pending.frontPhoto);
    expect(merged[0].auraManifestUrl).toBe(processed.auraManifestUrl);
    expect(merged[0].severityScoresFromAnalyses).toBe(
      processed.severityScoresFromAnalyses,
    );
  });

  it("handles Airtable array values for allIssues while scoring duplicate patient rows", () => {
    const pending = client({
      id: "rec-pending-array",
      email: "array@example.com",
      tableSource: "Patients",
      phone: "555-111-3333",
      allIssues: ["Pigmentation", "Redness"] as any,
    });
    const processed = client({
      id: "rec-processed-array",
      email: "array@example.com",
      tableSource: "Patients",
      severityScoresFromAnalyses: {
        schema_version: 4,
        detector_type: "multi_region",
        issues: {
          "Dark Spots": { predicted: true, severity_normalized_0_1: 0.35 },
        },
      },
    });

    const merged = mergeDuplicateLeadAndPatient([pending, processed]);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("rec-processed-array");
    expect(merged[0].allIssues).toEqual(["Pigmentation", "Redness"]);
  });

  it("still collapses a web lead and patient with the same email", () => {
    const lead = client({
      id: "lead-1",
      email: "lead@example.com",
      tableSource: "Web Popup Leads",
      name: "Lead Name",
      phone: "555-222-3333",
      source: "Website",
    });
    const patient = client({
      id: "patient-1",
      email: "lead@example.com",
      tableSource: "Patients",
      name: "Patient Name",
    });

    const merged = mergeDuplicateLeadAndPatient([lead, patient]);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("patient-1");
    expect(merged[0].linkedLeadId).toBe("lead-1");
    expect(merged[0].phone).toBe("555-222-3333");
  });
});
