// Filtering and sorting utilities

import { Client, FilterState, SortState } from "../types";
import { formatFacialStatus } from "./statusFormatting";
import { formatProviderDisplayName } from "./providerHelpers";

function hasSkinAnalysis(client: Client): boolean {
  const status = String(client.facialAnalysisStatus ?? "").trim().toLowerCase();
  if (status && status !== "not-started" && status !== "not started") return true;
  const hasFrontPhoto = Boolean(client.frontPhoto);
  const hasIssueSignals = Boolean(
    String(client.allIssues ?? "").trim() ||
      String(client.interestedIssues ?? "").trim() ||
      String(client.processedAreasOfInterest ?? "").trim(),
  );
  return hasFrontPhoto || hasIssueSignals;
}

function hasTreatmentPlan(client: Client): boolean {
  return (client.discussedItems ?? []).length > 0;
}

function hasTreatmentFinder(client: Client): boolean {
  if (client.offerEarned === true) return true;
  const hasFinderSignals = Boolean(
    (client.goals ?? []).length > 0 ||
      (Array.isArray(client.concerns)
        ? client.concerns.length > 0
        : String(client.concerns ?? "").trim().length > 0) ||
      (Array.isArray(client.areas) ? client.areas.length > 0 : false) ||
      String(client.aestheticGoals ?? "").trim().length > 0 ||
      Number(client.photosViewed ?? 0) > 0 ||
      Number(client.photosLiked ?? 0) > 0 ||
      Number(client.casesViewedCount ?? 0) > 0 ||
      Number(client.totalCasesAvailable ?? 0) > 0 ||
      (client.concernsExplored ?? []).length > 0,
  );
  return hasFinderSignals;
}

export function applyFilters(
  clients: Client[],
  filters: FilterState,
  searchQuery: string,
  providerCode?: string | null,
): Client[] {
  let filtered = [...clients];

  // Apply search query
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase().trim();
    const normalizedDigits = query.replace(/\D/g, "");
    filtered = filtered.filter((client) => {
      const name = String(client.name ?? "").toLowerCase();
      const email = String(client.email ?? "").toLowerCase();
      const phone = String(client.phone ?? "");
      const phoneDigits = phone.replace(/\D/g, "");

      return (
        name.includes(query) ||
        email.includes(query) ||
        phone.toLowerCase().includes(query) ||
        (normalizedDigits.length > 0 && phoneDigits.includes(normalizedDigits))
      );
    });
  }

  // Apply source filter
  if (filters.source) {
    // Match against the formatted source values
    filtered = filtered.filter((client) => {
      // Direct match with formatted source
      if (client.source === filters.source) {
        return true;
      }

      // Legacy support: "Online Treatment Finder" maps to Web Popup Leads
      if (filters.source === "Online Treatment Finder") {
        return (
          client.tableSource === "Web Popup Leads" ||
          client.source === "Website" ||
          client.source === "AI Consult"
        );
      }

      // Legacy support: "Facial Analysis" maps to Patients table
      if (filters.source === "Facial Analysis") {
        return client.tableSource === "Patients";
      }

      return false;
    });
  }

  // Apply age range filter
  if (filters.ageMin !== null || filters.ageMax !== null) {
    filtered = filtered.filter((client) => {
      if (client.age === null || client.age === undefined) return false;
      const age =
        typeof client.age === "string"
          ? parseFloat(client.age)
          : Number(client.age);
      if (isNaN(age)) return false;
      if (filters.ageMin !== null && age < filters.ageMin) return false;
      if (filters.ageMax !== null && age > filters.ageMax) return false;
      return true;
    });
  }

  // Apply analysis status filter
  if (filters.analysisStatus) {
    filtered = filtered.filter((client) => {
      const formattedStatus = formatFacialStatus(
        client.facialAnalysisStatus,
        providerCode,
      );
      return formattedStatus === filters.analysisStatus;
    });
  }

  // Apply "has/blank" completion filters
  if (filters.skinAnalysisState) {
    filtered = filtered.filter((client) =>
      filters.skinAnalysisState === "has"
        ? hasSkinAnalysis(client)
        : !hasSkinAnalysis(client),
    );
  }
  if (filters.treatmentFinderState) {
    filtered = filtered.filter((client) =>
      filters.treatmentFinderState === "has"
        ? hasTreatmentFinder(client)
        : !hasTreatmentFinder(client),
    );
  }
  if (filters.treatmentPlanState) {
    filtered = filtered.filter((client) =>
      filters.treatmentPlanState === "has"
        ? hasTreatmentPlan(client)
        : !hasTreatmentPlan(client),
    );
  }

  // Apply lead stage filter
  if (filters.leadStage) {
    filtered = filtered.filter((client) => client.status === filters.leadStage);
  }

  // Apply location filter (Patients: locationName from Boulevard/Form)
  if (filters.locationName) {
    filtered = filtered.filter(
      (client) =>
        String(client.locationName ?? "").trim() === filters.locationName,
    );
  }

  // Apply provider/staff name filter (Patients: appointmentStaffName; compare using formatted display name)
  if (filters.providerName) {
    filtered = filtered.filter(
      (client) =>
        formatProviderDisplayName(String(client.appointmentStaffName ?? "")) ===
        filters.providerName,
    );
  }

  return filtered;
}

export function applySorting(clients: Client[], sort: SortState): Client[] {
  const sorted = [...clients];

  sorted.sort((a, b) => {
    let aVal: any = a[sort.field];
    let bVal: any = b[sort.field];

    // Handle null/undefined values
    if (aVal === null || aVal === undefined) aVal = "";
    if (bVal === null || bVal === undefined) bVal = "";

    // Handle different data types
    if (
      sort.field === "name" ||
      sort.field === "status" ||
      sort.field === "facialAnalysisStatus"
    ) {
      aVal = String(aVal || "").toLowerCase();
      bVal = String(bVal || "").toLowerCase();
    } else if (
      sort.field === "age" ||
      sort.field === "photosLiked" ||
      sort.field === "photosViewed"
    ) {
      aVal = typeof aVal === "string" ? parseFloat(aVal) : Number(aVal) || 0;
      bVal = typeof bVal === "string" ? parseFloat(bVal) : Number(bVal) || 0;
    } else if (sort.field === "createdAt") {
      aVal = aVal ? new Date(aVal).getTime() : 0;
      bVal = bVal ? new Date(bVal).getTime() : 0;
    } else if (sort.field === "lastContact") {
      const aDate = a.lastContact || a.createdAt;
      const bDate = b.lastContact || b.createdAt;
      aVal = aDate ? new Date(aDate).getTime() : 0;
      bVal = bDate ? new Date(bDate).getTime() : 0;
    }

    // Compare values
    if (aVal < bVal) return sort.order === "asc" ? -1 : 1;
    if (aVal > bVal) return sort.order === "asc" ? 1 : -1;
    return 0;
  });

  return sorted;
}
