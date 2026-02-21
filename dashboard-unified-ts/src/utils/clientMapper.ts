// Utility to map Airtable records to Client format

import { Client, AirtableRecord, DiscussedItem } from "../types";

/**
 * Map Airtable status field to dashboard status
 */
function mapAirtableStatus(
  fields: Record<string, any>,
): "new" | "contacted" | "requested-consult" | "scheduled" | "converted" {
  const status = (fields["Status"] || "").toLowerCase();

  if (
    status.includes("converted") ||
    status.includes("booked") ||
    status.includes("patient")
  ) {
    return "converted";
  }
  if (status.includes("scheduled") || status.includes("consultation")) {
    return "scheduled";
  }
  if (status.includes("requested") && status.includes("consult")) {
    return "requested-consult";
  }
  if (status.includes("contacted") || status.includes("reached")) {
    return "contacted";
  }
  return "new";
}

/**
 * Format patient source value for display
 */
function formatPatientSource(sourceValue: string | null | undefined): string {
  // Handle null, undefined, or empty string
  if (
    !sourceValue ||
    (typeof sourceValue === "string" && sourceValue.trim() === "")
  ) {
    return "Patient";
  }

  const source = String(sourceValue).toLowerCase().trim();

  // Map source values to display names
  if (source === "web" || source === "website") {
    return "Facial Analysis Form";
  } else if (
    source === "treatment qr" ||
    (source.includes("treatment") && source.includes("qr"))
  ) {
    return "Treatment Room QR Code";
  } else if (source === "qr" || source.includes("qr code")) {
    return "QR Code";
  }

  // Return original value with proper capitalization if no match
  const str = String(sourceValue);
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Get facial analysis status from record fields.
 * Patients table may use "Pending/Opened" or other names; Web Popup Leads typically don't have this field.
 */
function getFacialAnalysisStatus(
  fields: Record<string, any>,
  tableName: string,
): string | null {
  if (tableName === "Patients") {
    const candidates = [
      "Pending/Opened",
      "Facial Analysis Status",
      "Analysis Status",
      "Pending Opened",
      "Status (from Analyses)",
    ];
    for (const key of candidates) {
      const v = fields[key];
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
  }
  return fields["Pending/Opened"] != null && String(fields["Pending/Opened"]).trim() !== ""
    ? String(fields["Pending/Opened"]).trim()
    : null;
}

/**
 * Determine priority based on fields
 */
function determinePriority(
  fields: Record<string, any>,
): "high" | "medium" | "low" {
  // High priority: recent activity, high engagement, or scheduled
  const lastContact = fields["Last Contact"] || fields["Contacted"];
  const photosViewed = parseInt(fields["Photos Viewed"]) || 0;
  const status = (fields["Status"] || "").toLowerCase();

  if (status.includes("scheduled") || status.includes("consultation")) {
    return "high";
  }
  if (status.includes("requested") && status.includes("consult")) {
    return "high";
  }

  if (
    photosViewed > 5 ||
    (lastContact &&
      new Date(lastContact) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
  ) {
    return "high";
  }

  if (photosViewed > 0 || lastContact) {
    return "medium";
  }

  return "low";
}

/**
 * Map Airtable record to Client format
 */
export function mapRecordToClient(
  record: AirtableRecord,
  tableName: string,
): Client {
  const fields = record.fields || {};

  const client: Client = {
    id: record.id,
    name: fields["Name"] || "",
    email:
      tableName === "Patients"
        ? fields["Email"] || ""
        : fields["Email Address"] || "",
    phone:
      tableName === "Patients"
        ? fields["Patient Phone Number"] || ""
        : fields["Phone Number"] || "",
    zipCode:
      fields["Zip Code"] || fields["Zip"] || fields["Postal Code"] || null,
    age:
      tableName === "Patients"
        ? fields["Age (from Form Submissions)"] || null
        : fields["Age Range"] || fields["Age"] || null,
    ageRange: tableName === "Patients" ? null : fields["Age Range"] || null,
    dateOfBirth:
      tableName === "Patients"
        ? fields["Birthday (from Form Submissions)"] || null
        : null,
    goals:
      tableName === "Patients"
        ? Array.isArray(fields["Name (from Interest Items)"])
          ? fields["Name (from Interest Items)"]
          : []
        : Array.isArray(fields["Goals"])
          ? fields["Goals"]
          : [],
    concerns:
      tableName === "Patients"
        ? fields["Areas of Interest (from Form Submissions)"] ||
          (Array.isArray(
            fields[
              "Which regions of your face do you want to improve? (from Form Submissions)"
            ],
          )
            ? fields[
                "Which regions of your face do you want to improve? (from Form Submissions)"
              ].join(", ")
            : "") ||
          ""
        : Array.isArray(fields["Concerns"])
          ? fields["Concerns"]
          : fields["Concerns"] || "",
    areas:
      tableName === "Patients"
        ? null
        : Array.isArray(fields["Areas"])
          ? fields["Areas"]
          : null,
    aestheticGoals: (() => {
      let value =
        tableName === "Patients"
          ? fields["What would you like to improve? (from Form Submissions)"] ||
            fields["Notes"] ||
            ""
          : fields["Aesthetic Goals"] || fields["Notes"] || "";
      if (Array.isArray(value)) {
        return value.join(", ");
      }
      return value || "";
    })(),
    skinType: tableName === "Patients" ? null : fields["Skin Type"] || null,
    skinTone: tableName === "Patients" ? null : fields["Skin Tone"] || null,
    ethnicBackground:
      tableName === "Patients" ? null : fields["Ethnic Background"] || null,
    engagementLevel:
      tableName === "Patients" ? null : fields["Engagement Level"] || null,
    casesViewedCount:
      tableName === "Patients" ? null : fields["Cases Viewed Count"] || null,
    totalCasesAvailable:
      tableName === "Patients" ? null : fields["Total Cases Available"] || null,
    concernsExplored:
      tableName === "Patients"
        ? null
        : Array.isArray(fields["Concerns Explored"])
          ? fields["Concerns Explored"]
          : null,
    photosLiked: Array.isArray(fields["Liked Photos"])
      ? fields["Liked Photos"].length
      : 0,
    photosViewed:
      tableName === "Patients"
        ? parseInt(fields["Photos Viewed"]) ||
          parseInt(fields["Interested Photos Viewed"]) ||
          0
        : Array.isArray(fields["Viewed Photos"])
          ? fields["Viewed Photos"].length
          : 0,
    treatmentsViewed: [],
    source: (() => {
      if (tableName === "Web Popup Leads") {
        return "Website";
      } else if (tableName === "Patients") {
        // Use Source field from Patients table and format it
        // Try multiple possible field name variations
        const sourceValue =
          fields["Source"] || fields["source"] || fields["SOURCE"] || "";
        return formatPatientSource(sourceValue);
      } else {
        return fields["Source"] || "AI Consult";
      }
    })(),
    status: mapAirtableStatus(fields),
    priority: determinePriority(fields),
    createdAt: record.createdTime || new Date().toISOString(),
    notes: fields["Notes"] || "",
    appointmentDate: fields["Appointment Date"] || null,
    treatmentReceived: fields["Treatment Received"] || null,
    revenue: fields["Revenue"] || null,
    lastContact: null, // Will be set from Contact History
    isReal: true,
    tableSource: tableName as "Web Popup Leads" | "Patients",
    facialAnalysisStatus: getFacialAnalysisStatus(fields, tableName),
    frontPhoto: (() => {
      // Only Patients table has Front Photo field
      // Note: frontPhoto is typed as string | null but actually contains attachment array
      // We'll store it as the array directly (type casting to match interface)
      if (tableName === "Patients") {
        const frontPhoto =
          fields["Front Photo"] ||
          fields["Front photo"] ||
          fields["frontPhoto"];
        if (frontPhoto && Array.isArray(frontPhoto) && frontPhoto.length > 0) {
          return frontPhoto as any; // Store as array, cast to match string | null type
        }
      }
      return null;
    })(),
    frontPhotoLoaded: false,
    allIssues:
      tableName === "Patients"
        ? fields["Name (from All Issues) (from Analyses)"] || ""
        : "",
    interestedIssues:
      tableName === "Patients"
        ? Array.isArray(fields["Name (from Interest Items)"])
          ? fields["Name (from Interest Items)"].join(", ")
          : fields["Name (from Interest Items)"] || ""
        : "",
    whichRegions:
      tableName === "Patients"
        ? Array.isArray(
            fields[
              "Which regions of your face do you want to improve? (from Form Submissions)"
            ],
          )
          ? fields[
              "Which regions of your face do you want to improve? (from Form Submissions)"
            ].join(", ")
          : fields[
              "Which regions of your face do you want to improve? (from Form Submissions)"
            ] || ""
        : "",
    skinComplaints:
      tableName === "Patients"
        ? Array.isArray(
            fields["Do you have any skin complaints? (from Form Submissions)"],
          )
          ? fields[
              "Do you have any skin complaints? (from Form Submissions)"
            ].join(", ")
          : fields[
              "Do you have any skin complaints? (from Form Submissions)"
            ] || ""
        : "",
    processedAreasOfInterest:
      tableName === "Patients"
        ? Array.isArray(
            fields["Processed Areas of Interest (from Form Submissions)"],
          )
          ? fields["Processed Areas of Interest (from Form Submissions)"].join(
              ", ",
            )
          : fields["Processed Areas of Interest (from Form Submissions)"] || ""
        : "",
    areasOfInterestFromForm:
      tableName === "Patients"
        ? Array.isArray(fields["Areas of Interest (from Form Submissions)"])
          ? fields["Areas of Interest (from Form Submissions)"].join(", ")
          : typeof fields["Areas of Interest (from Form Submissions)"] ===
              "string"
            ? fields["Areas of Interest (from Form Submissions)"]
            : ""
        : "",
    archived: fields["Archived"] || false,
    offerClaimed: fields["Offer Claimed"] || false,
    offerExpirationDate:
      fields["Offer Expiration"] ||
      fields["Offer Expiration Date"] ||
      fields["Coupon Expiration"] ||
      null,
    locationName:
      tableName === "Patients"
        ? fields[
            "Location name (from Boulevard Appointments) (from Form Submissions)"
          ] || null
        : null,
    appointmentStaffName: (() => {
      if (tableName !== "Patients") return null;
      const first =
        fields[
          "Appointment Service Staff First Name (from Boulevard Appointments) (from Form Submissions)"
        ];
      const last =
        fields[
          "Appointment Service Staff Last Name (from Boulevard Appointments) (from Form Submissions)"
        ];
      const parts = [first, last].filter(Boolean);
      return parts.length ? parts.join(" ").trim() : null;
    })(),
    discussedItems: (() => {
      const raw =
        fields["Treatments Discussed"] ?? fields["Discussed Treatments"];
      if (!raw || typeof raw !== "string") return undefined;
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return undefined;
        return (parsed as DiscussedItem[])
          .filter(
            (x) => x && typeof x.treatment === "string" && x.treatment.trim(),
          )
          .map((x, i) => ({ ...x, id: x.id || `disc-${record.id}-${i}` }));
      } catch {
        return undefined;
      }
    })(),
    contactHistory: [],
  };

  return client;
}
