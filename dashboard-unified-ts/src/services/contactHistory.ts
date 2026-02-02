// Contact history API service

import { Client } from "../types";

const USE_BACKEND_API =
  typeof window !== "undefined"
    ? (window as any).USE_BACKEND_API === true ||
      import.meta.env.VITE_USE_BACKEND_API === "true"
    : import.meta.env.VITE_USE_BACKEND_API === "true";

const BACKEND_API_URL =
  import.meta.env.VITE_BACKEND_API_URL ||
  "https://ponce-patient-backend.vercel.app";
const API_BASE_URL = USE_BACKEND_API
  ? BACKEND_API_URL
  : typeof window !== "undefined" && window.location
    ? window.location.origin
    : "";

interface ContactLogEntry {
  type: "call" | "email" | "text" | "meeting";
  outcome:
    | "reached"
    | "voicemail"
    | "no-answer"
    | "scheduled"
    | "sent"
    | "replied"
    | "attended"
    | "no-show"
    | "cancelled";
  notes: string;
}

export async function saveContactLog(
  client: Client,
  entry: ContactLogEntry,
): Promise<{ recordId: string }> {
  const contactTypeMap: Record<string, string> = {
    call: "Phone Call",
    email: "Email",
    text: "Text Message",
    meeting: "In-Person",
  };

  const outcomeMap: Record<string, string> = {
    reached: "Reached",
    voicemail: "Left Voicemail",
    "no-answer": "No Answer",
    scheduled: "Scheduled Appointment",
    sent: "Sent",
    replied: "Replied",
    attended: "Attended",
    "no-show": "No-Show",
    cancelled: "Cancelled",
  };

  const linkField =
    client.tableSource === "Patients" ? "Patient" : "Web Popup Lead";
  const contactHistoryFields = {
    [linkField]: [client.id],
    "Contact Type": contactTypeMap[entry.type] || "Phone Call",
    Outcome: outcomeMap[entry.outcome] || "Reached",
    Notes: entry.notes,
    Date: new Date().toISOString(),
  };

  const apiPath = USE_BACKEND_API
    ? `/api/dashboard/contact-history`
    : `/api/airtable-contact-history`;
  const apiUrl = API_BASE_URL + apiPath;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: contactHistoryFields }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error?.message ||
        error.message ||
        "Failed to create contact history record",
    );
  }

  const result = await response.json();
  return { recordId: result.record?.id || result.id };
}

export async function updateClientStatus(
  client: Client,
  newStatus:
    | "new"
    | "contacted"
    | "requested-consult"
    | "scheduled"
    | "converted",
): Promise<void> {
  const tableName = client.tableSource || "Web Popup Leads";
  const updateFields: Record<string, any> = {};

  // Map status to Airtable format
  const statusMap: Record<string, string> = {
    new: "New",
    contacted: "Contacted",
    "requested-consult": "Requested Consult",
    scheduled: "Scheduled",
    converted: "Converted",
  };

  updateFields["Status"] = statusMap[newStatus] || newStatus;
  updateFields["Contacted"] = newStatus !== "new";

  const apiPath = USE_BACKEND_API
    ? `/api/dashboard/records/${encodeURIComponent(tableName)}/${client.id}`
    : `/api/airtable-update-record`;
  const apiUrl = USE_BACKEND_API
    ? API_BASE_URL + apiPath
    : API_BASE_URL + apiPath;

  const method = USE_BACKEND_API ? "PATCH" : "PATCH";
  const body = USE_BACKEND_API
    ? JSON.stringify({ fields: updateFields })
    : JSON.stringify({ tableName, recordId: client.id, fields: updateFields });

  const response = await fetch(apiUrl, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error?.message || error.message || "Failed to update client status",
    );
  }
}

export async function archiveClient(
  client: Client,
  archived: boolean,
): Promise<void> {
  const tableName = client.tableSource || "Web Popup Leads";
  const fields = { Archived: archived };

  const apiPath = USE_BACKEND_API
    ? `/api/dashboard/records/${encodeURIComponent(tableName)}/${client.id}`
    : `/api/airtable-update-record`;
  const apiUrl = USE_BACKEND_API
    ? API_BASE_URL + apiPath
    : API_BASE_URL + apiPath;

  const method = "PATCH";
  const body = USE_BACKEND_API
    ? JSON.stringify({ fields })
    : JSON.stringify({ tableName, recordId: client.id, fields });

  const response = await fetch(apiUrl, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error?.message ||
        error.message ||
        `Failed to ${archived ? "archive" : "unarchive"} client`,
    );
  }
}

/**
 * Mark a lead's offer (e.g. $50 off) as redeemed. Web Popup Leads only.
 */
export async function markOfferRedeemed(client: Client): Promise<void> {
  const tableName = client.tableSource || "Web Popup Leads";
  const fields = { "Offer Claimed": true };

  const apiPath = USE_BACKEND_API
    ? `/api/dashboard/records/${encodeURIComponent(tableName)}/${client.id}`
    : `/api/airtable-update-record`;
  const apiUrl = USE_BACKEND_API
    ? API_BASE_URL + apiPath
    : API_BASE_URL + apiPath;

  const method = "PATCH";
  const body = USE_BACKEND_API
    ? JSON.stringify({ fields })
    : JSON.stringify({ tableName, recordId: client.id, fields });

  const response = await fetch(apiUrl, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error?.message ||
        error.message ||
        "Failed to mark offer as redeemed",
    );
  }
}
