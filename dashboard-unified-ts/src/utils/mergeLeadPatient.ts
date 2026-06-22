// Consolidate duplicate rows: same person as Web Popup Lead + Patient (e.g. Add Client then Scan In-Clinic).
// Merges into a single row (Patient as primary) so the table shows one entry per person.

import { Client } from "../types";
import { pickLatestIsoDate } from "./dateFormatting";

function normalizeEmail(email: string | null | undefined): string {
  if (email == null || typeof email !== "string") return "";
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string | null | undefined): string {
  if (phone == null || typeof phone !== "string") return "";
  return phone.replace(/\D/g, "");
}

function hasValue(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function hasTextValue(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) {
    return value.some((item) => hasTextValue(item));
  }
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number" || typeof value === "boolean") return true;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return false;
}

function normalizedText(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function prefer<T>(a: T, b: T): T {
  return hasValue(a) ? a : b;
}

function uniqueStrings(...groups: Array<string[] | undefined | null>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    for (const item of group || []) {
      const normalized = String(item || "").trim();
      const key = normalized.toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(normalized);
    }
  }
  return out;
}

function clientHasAnalysis(client: Client): boolean {
  return Boolean(
    client.severityScoresFromAnalyses ||
      client.auraManifestUrl ||
      client.auraGcsPrefix ||
      client.turntableVideoUrl ||
      hasTextValue(client.allIssues) ||
      (client.facialAnalysisStatus &&
        !["pending", "not started", "n/a"].includes(
          normalizedText(client.facialAnalysisStatus),
        )),
  );
}

function patientMergeScore(client: Client): number {
  let score = 0;
  if (client.severityScoresFromAnalyses) score += 100;
  if (client.auraManifestUrl || client.auraGcsPrefix) score += 70;
  if (client.turntableVideoUrl) score += 30;
  if (client.frontPhoto) score += 20;
  if (clientHasAnalysis(client)) score += 15;
  if (client.discussedItems?.length) score += 5;
  const createdMs = Date.parse(client.createdAt || "");
  if (Number.isFinite(createdMs)) score += Math.min(createdMs / 1e13, 1);
  return score;
}

/**
 * Merge two clients (lead + patient with same person) into one.
 * Patient is primary (id, tableSource, analysis fields); lead fills in blanks and provides linkedLeadId.
 */
function mergeLeadAndPatient(lead: Client, patient: Client): Client {
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
    webPopupLeadSource: lead.source ?? null,
    // Prefer patient's analysis data so merged row shows correct status (not lead's empty/pending)
    facialAnalysisStatus: prefer(patient.facialAnalysisStatus, lead.facialAnalysisStatus),
    allIssues: prefer(patient.allIssues, lead.allIssues),
    interestedIssues: prefer(patient.interestedIssues, lead.interestedIssues),
    whichRegions: prefer(patient.whichRegions, lead.whichRegions),
    skinComplaints: prefer(patient.skinComplaints, lead.skinComplaints),
    processedAreasOfInterest: prefer(patient.processedAreasOfInterest, lead.processedAreasOfInterest),
    frontPhoto: patient.frontPhoto ?? lead.frontPhoto,
    skincareQuiz: patient.skincareQuiz ?? lead.skincareQuiz ?? undefined,
    wellnessQuiz: patient.wellnessQuiz ?? lead.wellnessQuiz ?? undefined,
    turntableVideoUrl: patient.turntableVideoUrl || null,
    lastContact: pickLatestIsoDate(lead.lastContact, patient.lastContact),
  };
}

function mergePatientDuplicate(primary: Client, duplicate: Client): Client {
  return {
    ...primary,
    name: prefer(primary.name, duplicate.name),
    email: prefer(primary.email, duplicate.email),
    phone: prefer(primary.phone, duplicate.phone),
    zipCode: prefer(primary.zipCode, duplicate.zipCode),
    dateOfBirth: prefer(primary.dateOfBirth, duplicate.dateOfBirth),
    age: primary.age ?? duplicate.age ?? null,
    ageRange: prefer(primary.ageRange, duplicate.ageRange),
    goals: uniqueStrings(primary.goals, duplicate.goals),
    wellnessGoals: uniqueStrings(primary.wellnessGoals, duplicate.wellnessGoals),
    concerns: prefer(primary.concerns, duplicate.concerns),
    areas: primary.areas?.length ? primary.areas : duplicate.areas,
    aestheticGoals: prefer(primary.aestheticGoals, duplicate.aestheticGoals),
    skinType: prefer(primary.skinType, duplicate.skinType),
    skinTone: prefer(primary.skinTone, duplicate.skinTone),
    ethnicBackground: prefer(primary.ethnicBackground, duplicate.ethnicBackground),
    engagementLevel: prefer(primary.engagementLevel, duplicate.engagementLevel),
    casesViewedCount: primary.casesViewedCount ?? duplicate.casesViewedCount,
    totalCasesAvailable:
      primary.totalCasesAvailable ?? duplicate.totalCasesAvailable,
    concernsExplored:
      primary.concernsExplored?.length
        ? primary.concernsExplored
        : duplicate.concernsExplored,
    photosLiked: Math.max(primary.photosLiked || 0, duplicate.photosLiked || 0),
    photosViewed: Math.max(primary.photosViewed || 0, duplicate.photosViewed || 0),
    source: prefer(primary.source, duplicate.source),
    status:
      clientHasAnalysis(primary) || primary.status !== "new"
        ? primary.status
        : duplicate.status,
    priority: primary.priority === "high" ? primary.priority : duplicate.priority,
    createdAt:
      primary.createdAt && duplicate.createdAt
        ? primary.createdAt < duplicate.createdAt
          ? primary.createdAt
          : duplicate.createdAt
        : primary.createdAt,
    notes: prefer(primary.notes, duplicate.notes) || "",
    appointmentDate: prefer(primary.appointmentDate, duplicate.appointmentDate),
    treatmentReceived: prefer(
      primary.treatmentReceived,
      duplicate.treatmentReceived,
    ),
    revenue: primary.revenue ?? duplicate.revenue,
    lastContact: pickLatestIsoDate(primary.lastContact, duplicate.lastContact),
    facialAnalysisStatus: prefer(
      primary.facialAnalysisStatus,
      duplicate.facialAnalysisStatus,
    ),
    frontPhoto: primary.frontPhoto ?? duplicate.frontPhoto,
    frontPhotoLoaded: primary.frontPhotoLoaded || duplicate.frontPhotoLoaded,
    allIssues: prefer(primary.allIssues, duplicate.allIssues),
    interestedIssues: prefer(primary.interestedIssues, duplicate.interestedIssues),
    whichRegions: prefer(primary.whichRegions, duplicate.whichRegions),
    skinComplaints: prefer(primary.skinComplaints, duplicate.skinComplaints),
    processedAreasOfInterest: prefer(
      primary.processedAreasOfInterest,
      duplicate.processedAreasOfInterest,
    ),
    areasOfInterestFromForm: prefer(
      primary.areasOfInterestFromForm,
      duplicate.areasOfInterestFromForm,
    ),
    archived: primary.archived && duplicate.archived,
    offerClaimed: primary.offerClaimed || duplicate.offerClaimed,
    offerEarned: primary.offerEarned ?? duplicate.offerEarned,
    offerExpirationDate: prefer(
      primary.offerExpirationDate,
      duplicate.offerExpirationDate,
    ),
    locationName: prefer(primary.locationName, duplicate.locationName),
    appointmentStaffName: prefer(
      primary.appointmentStaffName,
      duplicate.appointmentStaffName,
    ),
    discussedItems:
      (primary.discussedItems?.length || 0) >=
      (duplicate.discussedItems?.length || 0)
        ? primary.discussedItems
        : duplicate.discussedItems,
    contactHistory:
      primary.contactHistory.length >= duplicate.contactHistory.length
        ? primary.contactHistory
        : duplicate.contactHistory,
    linkedLeadId: primary.linkedLeadId || duplicate.linkedLeadId,
    webPopupLeadSource:
      primary.webPopupLeadSource ?? duplicate.webPopupLeadSource ?? null,
    skincareQuiz: primary.skincareQuiz ?? duplicate.skincareQuiz ?? undefined,
    wellnessQuiz: primary.wellnessQuiz ?? duplicate.wellnessQuiz ?? undefined,
    severityScoresFromAnalyses:
      primary.severityScoresFromAnalyses ??
      duplicate.severityScoresFromAnalyses ??
      undefined,
    demoFacialAnalysisAi:
      primary.demoFacialAnalysisAi ?? duplicate.demoFacialAnalysisAi ?? undefined,
    galleryPhotoSlots:
      primary.galleryPhotoSlots?.length
        ? primary.galleryPhotoSlots
        : duplicate.galleryPhotoSlots,
    turntableVideoUrl: primary.turntableVideoUrl || duplicate.turntableVideoUrl || null,
    auraManifestUrl: primary.auraManifestUrl || duplicate.auraManifestUrl || null,
    auraGcsPrefix: primary.auraGcsPrefix || duplicate.auraGcsPrefix || null,
  };
}

function mergeDuplicatePatientsByEmail(clients: Client[]): Client[] {
  const groups = new Map<string, Client[]>();
  for (const client of clients) {
    if (client.tableSource !== "Patients") continue;
    const email = normalizeEmail(client.email);
    if (!email) continue;
    const group = groups.get(email) || [];
    group.push(client);
    groups.set(email, group);
  }

  const mergedById = new Map<string, Client>();
  const duplicateIds = new Set<string>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const [primary, ...duplicates] = [...group].sort(
      (a, b) => patientMergeScore(b) - patientMergeScore(a),
    );
    const merged = duplicates.reduce(
      (acc, duplicate) => {
        duplicateIds.add(duplicate.id);
        return mergePatientDuplicate(acc, duplicate);
      },
      primary,
    );
    mergedById.set(primary.id, merged);
  }

  if (mergedById.size === 0) return clients;
  return clients
    .filter((client) => !duplicateIds.has(client.id))
    .map((client) => mergedById.get(client.id) || client);
}

/**
 * Consolidate clients so that when the same person exists as both a Web Popup Lead and a Patient
 * (e.g. added via Add Client then scanned in-clinic), we show a single row with the Patient record
 * as primary and the Lead merged in. Also collapses duplicate Patient rows with the same email,
 * preferring the row that has processed analysis/Aura outputs.
 * Matching is by normalized email (and optionally phone if no email for lead/patient pairs).
 */
export function mergeDuplicateLeadAndPatient(clients: Client[]): Client[] {
  clients = mergeDuplicatePatientsByEmail(clients);
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
