// Filtering and sorting utilities

import { Client, FilterState, SortState } from "../types";
import { formatFacialStatus } from "./statusFormatting";
import { formatProviderDisplayName } from "./providerHelpers";

export function applyFilters(
  clients: Client[],
  filters: FilterState,
  searchQuery: string,
): Client[] {
  let filtered = [...clients];

  // Apply search query
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter((client) => {
      return (
        client.name.toLowerCase().includes(query) ||
        client.email.toLowerCase().includes(query) ||
        client.phone.includes(query)
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
      const formattedStatus = formatFacialStatus(client.facialAnalysisStatus);
      return formattedStatus === filters.analysisStatus;
    });
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
