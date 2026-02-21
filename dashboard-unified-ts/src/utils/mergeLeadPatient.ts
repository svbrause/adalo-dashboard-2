// Consolidate duplicate rows: same person as Web Popup Lead + Patient (e.g. Add Client then Scan In-Clinic).
// Merges into a single row (Patient as primary) so the table shows one entry per person.

import { Client } from "../types";

function normalizeEmail(email: string | null | undefined): string {
  if (email == null || typeof email !== "string") return "";
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string | null | undefined): string {
  if (phone == null || typeof phone !== "string") return "";
  return phone.replace(/\D/g, "");
}

/**
 * Merge two clients (lead + patient with same person) into one.
 * Patient is primary (id, tableSource, analysis fields); lead fills in blanks and provides linkedLeadId.
 */
function mergeLeadAndPatient(lead: Client, patient: Client): Client {
  const prefer = <T>(a: T, b: T): T =>
    a !== null && a !== undefined && a !== "" ? a : b;
  return {
    ...patient,
    id: patient.id,
    tableSource: "Patients",
    name: prefer(patient.name, lead.name),
    email: prefer(patient.email, lead.email),
    phone: prefer(patient.phone, lead.phone),
    zipCode: prefer(patient.zipCode, lead.zipCode),
    dateOfBirth: prefer(patient.dateOfBirth, lead.dateOfBirth),
    age: patient.age ?? lead.age ?? null,
    ageRange: prefer(patient.ageRange, lead.ageRange),
    createdAt:
      lead.createdAt && patient.createdAt
        ? lead.createdAt < patient.createdAt
          ? lead.createdAt
          : patient.createdAt
        : patient.createdAt,
    notes: prefer(patient.notes, lead.notes) || "",
    source: prefer(patient.source, lead.source),
    linkedLeadId: lead.id,
    // Prefer patient's analysis data so merged row shows correct status (not lead's empty/pending)
    facialAnalysisStatus: prefer(patient.facialAnalysisStatus, lead.facialAnalysisStatus),
    allIssues: prefer(patient.allIssues, lead.allIssues),
    interestedIssues: prefer(patient.interestedIssues, lead.interestedIssues),
    whichRegions: prefer(patient.whichRegions, lead.whichRegions),
    skinComplaints: prefer(patient.skinComplaints, lead.skinComplaints),
    processedAreasOfInterest: prefer(patient.processedAreasOfInterest, lead.processedAreasOfInterest),
    frontPhoto: patient.frontPhoto ?? lead.frontPhoto,
  };
}

/**
 * Consolidate clients so that when the same person exists as both a Web Popup Lead and a Patient
 * (e.g. added via Add Client then scanned in-clinic), we show a single row with the Patient record
 * as primary and the Lead merged in. Matching is by normalized email (and optionally phone if no email).
 */
export function mergeDuplicateLeadAndPatient(clients: Client[]): Client[] {
  const byEmail = new Map<string, { lead?: Client; patient?: Client }>();

  for (const c of clients) {
    const email = normalizeEmail(c.email);
    const key = email || (c.phone ? `phone:${normalizePhone(c.phone)}` : null);
    if (!key) continue;

    if (!byEmail.has(key)) byEmail.set(key, {});
    const entry = byEmail.get(key)!;

    if (c.tableSource === "Web Popup Leads") {
      if (!entry.lead) entry.lead = c;
    } else if (c.tableSource === "Patients") {
      if (!entry.patient) entry.patient = c;
    }
  }

  const leadIdsToDrop = new Set<string>();
  const merged: Client[] = [];

  for (const [, entry] of byEmail) {
    if (entry.lead && entry.patient) {
      leadIdsToDrop.add(entry.lead.id);
      merged.push(mergeLeadAndPatient(entry.lead, entry.patient));
    }
  }

  if (merged.length === 0) return clients;

  const mergedPatientIds = new Set(merged.map((c) => c.id));
  return clients
    .filter(
      (c) =>
        !leadIdsToDrop.has(c.id) &&
        !(c.tableSource === "Patients" && mergedPatientIds.has(c.id)),
    )
    .concat(merged);
}
