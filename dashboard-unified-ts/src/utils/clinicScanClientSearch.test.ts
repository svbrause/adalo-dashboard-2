import { describe, expect, it } from "vitest";
import type { Client } from "../types";
import {
  clientToClinicScanMatch,
  findClientsByContactForClinicScan,
  searchClientsForClinicScan,
} from "./clinicScanClientSearch";

function client(partial: Partial<Client> & Pick<Client, "id" | "name">): Client {
  const { id, name, ...rest } = partial;
  return {
    id,
    name,
    email: "",
    phone: "",
    zipCode: null,
    age: null,
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
    casesViewedCount: null,
    totalCasesAvailable: null,
    concernsExplored: null,
    photosLiked: 0,
    photosViewed: 0,
    treatmentsViewed: [],
    source: "Patients",
    status: "new",
    priority: "medium",
    createdAt: "2024-01-01",
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
    ...rest,
  } as Client;
}

describe("clinicScanClientSearch", () => {
  const clients = [
    client({
      id: "rec-a",
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "(555) 111-2222",
      areas: ["Eyes"],
    }),
    client({
      id: "rec-b",
      name: "John Smith",
      email: "john@example.com",
      phone: "(555) 333-4444",
    }),
    client({
      id: "rec-archived",
      name: "Jane Archived",
      email: "jane@example.com",
      archived: true,
    }),
  ];

  it("finds clients by name, email, or phone digits", () => {
    expect(searchClientsForClinicScan(clients, "ja").map((c) => c.id)).toEqual([
      "rec-a",
    ]);
    expect(searchClientsForClinicScan(clients, "john@").map((c) => c.id)).toEqual([
      "rec-b",
    ]);
    expect(searchClientsForClinicScan(clients, "1112222").map((c) => c.id)).toEqual([
      "rec-a",
    ]);
  });

  it("maps a client to iframe prefill fields", () => {
    const match = clientToClinicScanMatch(clients[0]!);
    expect(match.firstName).toBe("Jane");
    expect(match.lastName).toBe("Doe");
    expect(match.faceRegions).toContain("Eyes");
  });

  it("finds exact email or phone matches for duplicate detection", () => {
    expect(
      findClientsByContactForClinicScan(clients, {
        email: "jane@example.com",
      }).map((c) => c.id),
    ).toEqual(["rec-a"]);
    expect(
      findClientsByContactForClinicScan(clients, {
        phone: "+15551112222",
      }).map((c) => c.id),
    ).toEqual(["rec-a"]);
    expect(
      findClientsByContactForClinicScan(clients, {
        email: "jane@example.com",
        phone: "(555) 333-4444",
      }).map((c) => c.id),
    ).toEqual(["rec-a", "rec-b"]);
  });
});
