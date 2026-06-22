import type { Client } from "../types";

export function createOptimisticClinicScanClient(input: {
  recordId: string;
  tableName?: string;
  clientName?: string;
}): Client {
  const createdAt = new Date().toISOString();
  return {
    id: input.recordId,
    name: input.clientName?.trim() || "New scan client",
    email: "",
    phone: "",
    zipCode: null,
    age: null,
    ageRange: null,
    dateOfBirth: null,
    goals: [],
    wellnessGoals: [],
    concerns: [],
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
    source: "In-clinic scan",
    status: "new",
    priority: "medium",
    createdAt,
    notes: "",
    appointmentDate: null,
    treatmentReceived: null,
    revenue: null,
    lastContact: createdAt,
    isReal: true,
    tableSource:
      input.tableName === "Web Popup Leads" ? "Web Popup Leads" : "Patients",
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
    locationName: null,
    appointmentStaffName: null,
    contactHistory: [],
  };
}
