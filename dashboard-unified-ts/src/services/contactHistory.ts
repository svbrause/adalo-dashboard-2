// Contact history API service – all calls go to ponce-patient-backend.vercel.app

import { Client } from "../types";
import { BACKEND_API_URL } from "./api";

const API_BASE_URL = BACKEND_API_URL;

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

  const apiUrl = `${API_BASE_URL}/api/dashboard/contact-history`;

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

  const apiUrl = `${API_BASE_URL}/api/dashboard/records/${encodeURIComponent(tableName)}/${client.id}`;
  const method = "PATCH";
  const body = JSON.stringify({ fields: updateFields });

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

  const apiUrl = `${API_BASE_URL}/api/dashboard/records/${encodeURIComponent(tableName)}/${client.id}`;
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

  const apiUrl = `${API_BASE_URL}/api/dashboard/records/${encodeURIComponent(tableName)}/${client.id}`;
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
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error?.message ||
        error.message ||
        "Failed to mark offer as redeemed",
    );
  }
}
