// API service for fetching data from Airtable via backend (ponce-patient-backend.vercel.app)
// All dashboard API calls go to the backend; no /api or relative routes.

import type { Offer, DoctorAdviceRequest } from "../types";

export const BACKEND_API_URL =
  import.meta.env.VITE_BACKEND_API_URL ||
  "https://ponce-patient-backend.vercel.app";
const API_BASE_URL = BACKEND_API_URL;

export interface Provider {
  id: string;
  name: string;
  code: string;
  logo?:
    | string
    | Array<{
        url: string;
        thumbnails?: { large?: { url: string }; full?: { url: string } };
      }>;
  [key: string]: any;
}

export interface AirtableRecord {
  id: string;
  fields: Record<string, any>;
  createdTime?: string;
}

export interface AirtableResponse {
  success: boolean;
  records: AirtableRecord[];
  count?: number;
}

/**
 * Fetch provider by provider code
 */
// Helper function to safely parse JSON responses
async function safeJsonParse(response: Response): Promise<any> {
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    const text = await response.text();
    throw new Error(
      `Expected JSON but got ${contentType}. Response: ${text.substring(
        0,
        100
      )}`
    );
  }
  return response.json();
}

export async function fetchProviderByCode(
  providerCode: string
): Promise<Provider> {
  const apiUrl = `${API_BASE_URL}/api/dashboard/provider?providerCode=${encodeURIComponent(providerCode)}`;

  const response = await fetch(apiUrl);

  if (!response.ok) {
    const errorData = await safeJsonParse(response).catch(() => ({}));
    throw new Error(errorData.message || `Provider not found: ${providerCode}`);
  }

  const data = await safeJsonParse(response);
  return data.provider;
}

/**
 * Notify backend of dashboard login. Backend writes to Airtable "new app logins" table.
 * Source is "analysis.ponce.ai" to distinguish from cases.ponce.ai (different app).
 * Fire-and-forget: does not block login; failures are logged only.
 */
export function notifyLoginToSlack(provider: Provider): void {
  const apiUrl = API_BASE_URL + "/api/dashboard/login-notification";

  const timestamp = new Date().toISOString();
  const sessionId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : "";

  const payload = {
    providerId: provider.id,
    providerName: provider.name ?? "",
    providerCode: provider.code ?? "",
    timestamp,
    source: "analysis.ponce.ai",
    sessionId,
    name: provider.name ?? "",
    email: (provider as { email?: string }).email ?? "",
    stage: "login",
    metadata: JSON.stringify({
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      referrer: typeof document !== "undefined" ? document.referrer || "" : "",
    }),
  };

  fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch((err) => {
    console.warn("Login notification failed (non-blocking):", err);
  });
}

/**
 * Fetch records from an Airtable table with optional filtering
 */
export async function fetchTableRecords(
  tableName: string,
  options: {
    filterFormula?: string;
    providerId?: string;
    fields?: string[];
  } = {}
): Promise<AirtableRecord[]> {
  const { filterFormula, providerId, fields } = options;

  const params = new URLSearchParams();
  params.append("tableName", tableName);

  if (filterFormula) {
    params.append("filterFormula", filterFormula);
  }

  if (providerId) {
    params.append("providerId", providerId);
  }

  if (fields) {
    fields.forEach((field) => {
      params.append("fields[]", field);
    });
  }

  const apiUrl = `${API_BASE_URL}/api/dashboard/leads?${params.toString()}`;

  const response = await fetch(apiUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorData = await safeJsonParse(response).catch(() => ({}));
    throw new Error(
      `API error for ${tableName}: ${response.status} ${
        errorData.message || response.statusText
      }`
    );
  }

  const data: AirtableResponse = await safeJsonParse(response);

  if (!data.records || !Array.isArray(data.records)) {
    return [];
  }

  return data.records;
}

/**
 * Fetch contact history for clients
 */
export async function fetchContactHistory(
  tableSource: "Web Popup Leads" | "Patients",
  options: {
    providerId?: string;
    leadIds?: string[];
  } = {}
): Promise<any[]> {
  const { providerId, leadIds } = options;

  const params = new URLSearchParams();
  params.append("tableSource", tableSource);

  if (providerId) {
    params.append("providerId", providerId);
  } else if (leadIds && leadIds.length > 0) {
    params.append("leadIds", leadIds.join(","));
  } else {
    return [];
  }

  const apiUrl = `${API_BASE_URL}/api/dashboard/contact-history?${params.toString()}`;

  const response = await fetch(apiUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 414) {
      console.warn(
        "URI too long error (414) - Contact history temporarily unavailable"
      );
      return [];
    }
    const errorData = await safeJsonParse(response).catch(() => ({}));
    console.error(`Failed to fetch contact history:`, errorData);
    return [];
  }

  const data = await safeJsonParse(response);
  const allRecords = data.records || [];

  const linkField = tableSource === "Patients" ? "Patient" : "Web Popup Lead";

  return allRecords
    .map((record: AirtableRecord) => {
      const fields = record.fields || {};
      const linkedRecordArray = fields[linkField] || [];
      const leadId =
        Array.isArray(linkedRecordArray) && linkedRecordArray.length > 0
          ? linkedRecordArray[0]
          : null;

      const contactType = (fields["Contact Type"] || "").toLowerCase();
      let normalizedType = "call";
      if (contactType.includes("email")) normalizedType = "email";
      else if (contactType.includes("text")) normalizedType = "text";
      else if (
        contactType.includes("person") ||
        contactType.includes("meeting")
      )
        normalizedType = "meeting";

      const outcome = (fields["Outcome"] || "").toLowerCase();
      let normalizedOutcome = "reached";
      if (outcome.includes("voicemail")) normalizedOutcome = "voicemail";
      else if (outcome.includes("no-show") || outcome.includes("no show"))
        normalizedOutcome = "no-show";
      else if (outcome.includes("no answer") || outcome.includes("no-answer"))
        normalizedOutcome = "no-answer";
      else if (outcome.includes("scheduled")) normalizedOutcome = "scheduled";
      else if (outcome.includes("replied")) normalizedOutcome = "replied";
      else if (outcome.includes("sent")) normalizedOutcome = "sent";
      else if (outcome.includes("attended")) normalizedOutcome = "attended";
      else if (outcome.includes("cancelled") || outcome.includes("canceled"))
        normalizedOutcome = "cancelled";

      return {
        id: record.id,
        leadId: leadId,
        type: normalizedType,
        outcome: normalizedOutcome,
        notes: fields["Notes"] || "",
        date: fields["Date"] || record.createdTime || new Date().toISOString(),
      };
    })
    .filter((entry: any) => entry.leadId !== null);
}

/**
 * Update lead/patient record in Airtable
 */
export async function updateLeadRecord(
  recordId: string,
  tableName: string,
  fields: Record<string, any>
): Promise<boolean> {
  const params = new URLSearchParams();
  params.append("recordId", recordId);
  params.append("tableName", tableName);

  const apiUrl = `${API_BASE_URL}/api/dashboard/update-record`;

  const response = await fetch(apiUrl, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      recordId,
      tableName,
      fields,
    }),
  });

  return response.ok;
}

/**
 * Send SMS notification. Backend SMS Notifications table has: Phone Number, Message, Name.
 */
export async function sendSMSNotification(
  phone: string,
  message: string,
  name?: string
): Promise<boolean> {
  const apiUrl = `${API_BASE_URL}/api/dashboard/sms`;

  const body: { phone: string; message: string; name?: string } = {
    phone,
    message,
  };
  if (name != null && name.trim() !== "") {
    body.name = name.trim();
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await safeJsonParse(response).catch(() => ({}));
    throw new Error(
      errorData.error?.message ||
        errorData.message ||
        "Failed to send SMS notification"
    );
  }
  return true;
}

/**
 * Create a new lead/patient record
 */
export async function createLeadRecord(
  _tableName: string,
  fields: Record<string, any>
): Promise<AirtableRecord> {
  const apiUrl = `${API_BASE_URL}/api/dashboard/leads`;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });

  if (!response.ok) {
    const errorData = await safeJsonParse(response).catch(() => ({}));
    throw new Error(
      errorData.error?.message || errorData.message || "Failed to create lead"
    );
  }

  const data = await safeJsonParse(response);
  return data.record || data;
}

/**
 * Submit help request
 */
export async function submitHelpRequest(
  name: string,
  email: string,
  message: string,
  providerId: string
): Promise<boolean> {
  const apiUrl = `${API_BASE_URL}/api/dashboard/help-requests`;
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        Name: name,
        Email: email,
        Message: message,
        "Provider Id": providerId,
      },
    }),
  });

  return response.ok;
}

/* ========== Treatment Recommender custom options (persisted in Airtable) ========== */

/** Option type for the treatment recommender "Where" / "What" add-to-plan form. */
export type TreatmentRecommenderOptionType =
  | "where"
  | "skincare_what"
  | "laser_what"
  | "biostimulant_what";

export interface TreatmentRecommenderCustomOption {
  id: string;
  optionType: TreatmentRecommenderOptionType;
  value: string;
}

/**
 * Fetch custom options for the treatment recommender (Where / What chips).
 * Stored in Airtable; returned options are merged with static options in the UI.
 */
export async function fetchTreatmentRecommenderCustomOptions(
  providerId: string
): Promise<TreatmentRecommenderCustomOption[]> {
  if (!providerId?.trim()) return [];
  const apiUrl = `${API_BASE_URL}/api/dashboard/treatment-recommender-options?providerId=${encodeURIComponent(providerId.trim())}`;
  const response = await fetch(apiUrl, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    const err = await safeJsonParse(response).catch(() => ({}));
    throw new Error(
      err.message || err.error?.message || "Failed to fetch recommender options"
    );
  }
  const data = await safeJsonParse(response);
  const records = data.records ?? data.options ?? [];
  const normalizedType = (raw: string): TreatmentRecommenderOptionType => {
    const t = String(raw).trim().toLowerCase().replace(/\s+/g, "_");
    if (t === "skincare_what" || t === "laser_what" || t === "biostimulant_what") return t;
    return "where";
  };
  return (Array.isArray(records) ? records : []).map((r: AirtableRecord | TreatmentRecommenderCustomOption) => {
    if ("optionType" in r && "value" in r) {
      return { id: (r as TreatmentRecommenderCustomOption).id, optionType: normalizedType((r as TreatmentRecommenderCustomOption).optionType), value: (r as TreatmentRecommenderCustomOption).value };
    }
    const f = (r as AirtableRecord).fields || {};
    return {
      id: (r as AirtableRecord).id,
      optionType: normalizedType(f["Option Type"] ?? f.optionType ?? "where"),
      value: String(f["Value"] ?? f.value ?? "").trim(),
    };
  }).filter((o: TreatmentRecommenderCustomOption) => o.value.length > 0);
}

/**
 * Create a custom option and persist it in Airtable so it appears for future sessions.
 */
export async function createTreatmentRecommenderCustomOption(
  providerId: string,
  optionType: TreatmentRecommenderOptionType,
  value: string
): Promise<TreatmentRecommenderCustomOption> {
  const trimmed = value?.trim();
  if (!trimmed || !providerId?.trim()) {
    throw new Error("Provider and option value are required");
  }
  const apiUrl = `${API_BASE_URL}/api/dashboard/treatment-recommender-options`;
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      providerId: providerId.trim(),
      optionType,
      value: trimmed,
    }),
  });
  if (!response.ok) {
    const err = await safeJsonParse(response).catch(() => ({}));
    throw new Error(
      err.message || err.error?.message || "Failed to add option"
    );
  }
  const data = await safeJsonParse(response);
  const rec = data.record ?? data;
  const f = rec?.fields ?? rec;
  if (rec?.id && (f?.Value ?? f?.value ?? rec?.value)) {
    return {
      id: rec.id,
      optionType: (f["Option Type"] ?? f.optionType ?? rec.optionType ?? optionType) as TreatmentRecommenderOptionType,
      value: String(f["Value"] ?? f.value ?? rec.value ?? trimmed).trim(),
    };
  }
  return { id: rec?.id ?? crypto.randomUUID(), optionType, value: trimmed };
}

/**
 * Delete a treatment recommender option by record ID (so providers can remove defaults or custom options).
 */
export async function deleteTreatmentRecommenderOption(recordId: string): Promise<void> {
  if (!recordId?.trim()) throw new Error("recordId is required");
  const apiUrl = `${API_BASE_URL}/api/dashboard/treatment-recommender-options/${encodeURIComponent(recordId.trim())}`;
  const response = await fetch(apiUrl, { method: "DELETE", headers: { "Content-Type": "application/json" } });
  if (!response.ok) {
    const err = await safeJsonParse(response).catch(() => ({}));
    throw new Error(err.message || err.error?.message || "Failed to delete option");
  }
}

/**
 * Update a treatment recommender option's value (rename).
 */
export async function updateTreatmentRecommenderOption(
  recordId: string,
  value: string
): Promise<TreatmentRecommenderCustomOption> {
  const trimmed = value?.trim();
  if (!recordId?.trim() || !trimmed) throw new Error("recordId and value are required");
  const apiUrl = `${API_BASE_URL}/api/dashboard/treatment-recommender-options/${encodeURIComponent(recordId.trim())}`;
  const response = await fetch(apiUrl, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value: trimmed }),
  });
  if (!response.ok) {
    const err = await safeJsonParse(response).catch(() => ({}));
    throw new Error(err.message || err.error?.message || "Failed to update option");
  }
  const data = await safeJsonParse(response);
  const rec = data.record ?? data;
  const f = rec?.fields ?? rec;
  const rawType = String(f?.["Option Type"] ?? f?.optionType ?? rec?.optionType ?? "where").trim().toLowerCase().replace(/\s+/g, "_");
  const optionType: TreatmentRecommenderOptionType =
    rawType === "skincare_what" || rawType === "laser_what" || rawType === "biostimulant_what" ? rawType : "where";
  return {
    id: rec?.id ?? recordId,
    optionType,
    value: String(f?.Value ?? f?.value ?? rec?.value ?? trimmed).trim(),
  };
}

/**
 * Seed default treatment recommender options for a provider (inserts into Airtable; skips existing).
 * Returns how many options were inserted.
 */
export async function seedTreatmentRecommenderOptions(
  providerId: string,
  options: Array<{ optionType: TreatmentRecommenderOptionType; value: string }>
): Promise<{ inserted: number }> {
  if (!providerId?.trim()) throw new Error("providerId is required");
  if (!Array.isArray(options) || options.length === 0) throw new Error("options array is required");
  const apiUrl = `${API_BASE_URL}/api/dashboard/treatment-recommender-options/seed`;
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ providerId: providerId.trim(), options }),
  });
  if (!response.ok) {
    const err = await safeJsonParse(response).catch(() => ({}));
    throw new Error(err.message || err.error?.message || "Failed to seed options");
  }
  const data = await safeJsonParse(response);
  return { inserted: data.inserted ?? 0 };
}

/**
 * Fetch Doctor Advice Requests (inbox) from the dashboard API.
 */
export async function fetchDoctorAdviceRequests(): Promise<DoctorAdviceRequest[]> {
  const apiUrl = `${API_BASE_URL}/api/dashboard/doctor-advice-requests`;
  const response = await fetch(apiUrl);
  if (!response.ok) {
    const errorData = await safeJsonParse(response).catch(() => ({}));
    throw new Error(
      errorData.error || errorData.message || "Failed to fetch doctor advice requests"
    );
  }
  const data = await safeJsonParse(response);
  const records = data.records || [];
  return records.map((r: AirtableRecord) => {
    const f = r.fields || {};
    const patients = f.Patients ?? f.patients;
    const patientId = Array.isArray(patients) && patients.length > 0 ? patients[0] : undefined;
    return {
      id: r.id,
      patientEmail: f["Patient Email"] ?? f.patientEmail ?? "",
      patientNote: f["Patient Note"] ?? f.patientNote ?? "",
      source: f.source ?? f.Source ?? "",
      patientId,
      createdTime: r.createdTime,
    };
  });
}

/**
 * Fetch offers from the dashboard offers API.
 * Returns records shaped as Offer (id + flat fields).
 */
export async function fetchOffers(): Promise<Offer[]> {
  const apiPath = "/api/dashboard/offers";
  const apiUrl = API_BASE_URL + apiPath;
  const response = await fetch(apiUrl);
  if (!response.ok) {
    const errorData = await safeJsonParse(response).catch(() => ({}));
    throw new Error(errorData.message || "Failed to fetch offers");
  }
  const data = await safeJsonParse(response);
  const records = data.records || [];
  return records.map((r: AirtableRecord) => {
    const f = r.fields || {};
    return {
      id: r.id,
      name: f.Name ?? f.name ?? "",
      heading: f.Heading ?? f.heading ?? "",
      details: f.Details ?? f.details ?? "",
      availableUntil: f["Available Until"] ?? f.availableUntil ?? "",
      redemptionPeriod: f["Redemption Period"] ?? f.redemptionPeriod ?? "",
      treatmentFilter: f["Treatment Filter"] ?? f.treatmentFilter ?? "",
      createdTime: r.createdTime,
    };
  });
}

/**
 * Update facial analysis status for a patient
 */
export async function updateFacialAnalysisStatus(
  clientId: string,
  newStatus: string
): Promise<void> {
  // Handle "not-started" - send empty string to Airtable
  const airtableStatus =
    newStatus === "not-started" || !newStatus ? "" : newStatus;

  const fields = {
    "Pending/Opened": airtableStatus,
  };

  const apiUrl = `${API_BASE_URL}/api/dashboard/records/Patients/${clientId}`;
  const method = "PATCH";
  const body = JSON.stringify({ fields });

  const response = await fetch(apiUrl, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body,
  });

  if (!response.ok) {
    const error = await safeJsonParse(response).catch(() => ({}));
    throw new Error(
      error.error?.message ||
        error.message ||
        "Failed to update facial analysis status"
    );
  }
}

/**
 * Fetch treatment photos from the Photos table.
 * Uses a minimal filter (done = TRUE when possible); filtering by treatment/area
 * is done client-side for reliability across different Airtable field types.
 *
 * The backend must paginate Airtable (pageSize 100 + offset loop) when tableName
 * is "Photos" so that all photos are returned; Airtable returns at most 100 per request.
 */
export async function fetchTreatmentPhotos(
  options: {
    treatment?: string;
    area?: string;
    /** Client-side cap; use a high value or omit to use all records the backend returns. Backend must paginate to return more than 100. */
    limit?: number;
  } = {}
): Promise<AirtableRecord[]> {
  const { limit = 2000 } = options;

  // Fetch with minimal filter so client can filter by treatment/region
  const filterFormula = "done = TRUE()";

  let records: AirtableRecord[] = [];
  try {
    records = await fetchTableRecords("Photos", {
      filterFormula,
      fields: [
        "Name",
        "Photo",
        "Treatments",
        "Name (from Treatments)",
        "General Treatments",
        "Name (from General Treatments)",
        "Area Names",
        "Surgical (from General Treatments)",
        "Caption",
        "Story Title",
        "Story Detailed",
        "Age",
        "Skin Tone",
        "Ethnic Background",
        "Skin Type",
        "Longevity (from General Treatments)",
        "Downtime (from General Treatments)",
        "Price Range (from General Treatments)",
      ],
    });
  } catch {
    // If Photos table or filter fails, try without filter to get any photos
    try {
      records = await fetchTableRecords("Photos", {
        fields: [
          "Name",
          "Photo",
          "Name (from General Treatments)",
          "Area Names",
          "Surgical (from General Treatments)",
          "Caption",
          "Story Title",
          "Story Detailed",
        ],
      });
    } catch {
      return [];
    }
  }

  return limit > 0 ? records.slice(0, limit) : records;
}

/**
 * Fetch patient mapping records (Patient-Issue/Suggestion Mapping) by patient email.
 * Used for area cropped photos on suggestion cards. Each record includes
 * "Name (from Suggestions)" and "Photo (from Area Cropped Photos)".
 * See AREA_CROPPED_IMAGE_INTEGRATION.md for response shape.
 */
export async function fetchPatientRecords(
  email: string
): Promise<AirtableRecord[]> {
  if (!email?.trim()) return [];
  const apiUrl = `${API_BASE_URL}/api/patient-records?email=${encodeURIComponent(
    email.trim().toLowerCase()
  )}`;
  const response = await fetch(apiUrl);
  if (!response.ok) return [];
  const data = await safeJsonParse(response).catch(() => ({}));
  const records = data?.records;
  return Array.isArray(records) ? records : [];
}

/** Field name for area cropped photo in patient-records response */
export const PATIENT_RECORDS_PHOTO_FIELD = "Photo (from Area Cropped Photos)";
/** Field name for suggestion name in patient-records response */
export const PATIENT_RECORDS_SUGGESTION_NAME_FIELD = "Name (from Suggestions)";
/** Area label (e.g. "Under Eyes") */
export const PATIENT_RECORDS_AREA_NAMES_FIELD = "Area Names";
/** Short "I am noticing…" copy */
export const PATIENT_RECORDS_SHORT_SUMMARY_FIELD = "short summary";
/** Longer AI summary (Learn more) */
export const PATIENT_RECORDS_AI_SUMMARY_FIELD = "ai summary test v2 copy";
/** Comma-separated issues (e.g. "Issue A, Issue B") */
export const PATIENT_RECORDS_ISSUES_STRING_FIELD = "Issues String";
/** 1 / "1" / true = focus area */
export const PATIENT_RECORDS_IS_FOCUS_FIELD = "Is an area of interest?";
export const PATIENT_RECORDS_SUGGESTION_RECORD_ID_FIELD = "Record ID (from Suggestions)";
export const PATIENT_RECORDS_PATIENT_ID_FIELD = "RECORD ID (from Patients)";
export const PATIENT_RECORDS_PATIENT_EMAIL_FIELD = "Email (from Patients)";

/** One suggestion card from patient-records (SUGGESTION_CARDS_INTEGRATION.md) */
export interface PatientSuggestionCard {
  id: string;
  suggestionName: string;
  areaNames: string;
  photoUrl: string | null;
  shortSummary: string;
  aiSummary: string;
  issuesString: string;
  isFocusArea: boolean;
  suggestionRecordId: string;
  patientId: string;
  patientEmail: string;
}

/** Normalize Airtable linked-record field (string or [string]) to a single display string */
export function toDisplayName(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    return typeof first === "string" ? first.trim() : String(first).trim();
  }
  return String(value).trim();
}

/** Parse patient-records response into suggestion cards with details (SUGGESTION_CARDS_INTEGRATION.md) */
export function parsePatientRecordsToCards(records: AirtableRecord[]): PatientSuggestionCard[] {
  const cards: PatientSuggestionCard[] = [];
  for (const record of records) {
    const fields = record.fields || {};
    const suggestionName = toDisplayName(fields[PATIENT_RECORDS_SUGGESTION_NAME_FIELD]);
    if (!suggestionName) continue;
    const areaNames = toDisplayName(fields[PATIENT_RECORDS_AREA_NAMES_FIELD]);
    const photo = fields[PATIENT_RECORDS_PHOTO_FIELD];
    const photoUrl = getAreaCroppedPhotoUrl(photo);
    const shortSummary = toDisplayName(fields[PATIENT_RECORDS_SHORT_SUMMARY_FIELD]);
    const aiSummary = toDisplayName(fields[PATIENT_RECORDS_AI_SUMMARY_FIELD]);
    const issuesString = toDisplayName(fields[PATIENT_RECORDS_ISSUES_STRING_FIELD]);
    const focusVal = fields[PATIENT_RECORDS_IS_FOCUS_FIELD];
    const isFocusArea = focusVal === 1 || focusVal === "1" || focusVal === true;
    const suggestionRecordId = toDisplayName(fields[PATIENT_RECORDS_SUGGESTION_RECORD_ID_FIELD]);
    const patientId = toDisplayName(fields[PATIENT_RECORDS_PATIENT_ID_FIELD]);
    const patientEmail = toDisplayName(fields[PATIENT_RECORDS_PATIENT_EMAIL_FIELD]);
    cards.push({
      id: record.id,
      suggestionName,
      areaNames,
      photoUrl,
      shortSummary,
      aiSummary,
      issuesString,
      isFocusArea,
      suggestionRecordId,
      patientId,
      patientEmail,
    });
  }
  return cards;
}

type PhotoField =
  | { id?: string; url: string; filename?: string }
  | { id?: string; url: string; filename?: string }[]
  | string
  | null
  | undefined;

/**
 * Extract a single image URL from the "Photo (from Area Cropped Photos)" field
 * (array of attachments, single attachment, or string URL).
 */
export function getAreaCroppedPhotoUrl(photo: PhotoField): string | null {
  if (photo == null || photo === undefined) return null;
  if (Array.isArray(photo) && photo.length > 0) {
    const first = photo[0];
    if (typeof first === "object" && first && "url" in first) return first.url;
    if (typeof first === "string") return first;
  }
  if (typeof photo === "object" && "url" in photo) return (photo as { url: string }).url;
  if (typeof photo === "string") return photo;
  return null;
}

/* ========== AI Assessment APIs ========== */

export interface AIAssessmentPayload {
  overall: number;
  categories: Array<{ name: string; score: number; tier: string }>;
  focusCount: number;
  detectedIssues: string[];
}

export interface CategoryAssessmentPayload {
  categoryOrArea: string;
  score: number;
  tier: string;
  subScores: Array<{ name: string; score: number; detected: number; total: number }>;
  detectedIssues: string[];
  strengthIssues: string[];
}

/**
 * Fetch AI-generated overview assessment from the backend.
 * Falls back to null on failure (caller should use template text as fallback).
 */
export async function fetchAIAssessment(
  payload: AIAssessmentPayload
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${API_BASE_URL}/api/assessment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = (await res.json()) as { assessment?: string };
    return data.assessment || null;
  } catch {
    return null;
  }
}

/**
 * Fetch AI-generated category/area-specific assessment from the backend.
 * Falls back to null on failure.
 */
export async function fetchCategoryAssessment(
  payload: CategoryAssessmentPayload
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${API_BASE_URL}/api/category-assessment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = (await res.json()) as { assessment?: string };
    return data.assessment || null;
  } catch {
    return null;
  }
}
