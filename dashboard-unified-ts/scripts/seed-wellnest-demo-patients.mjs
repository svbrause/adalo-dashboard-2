#!/usr/bin/env node
/**
 * Seed (or upsert) the 3 Wellnest demo patients into Airtable Patients table.
 *
 * Why:
 * - `wellnest-demo-*` rows in src/debug are session-only.
 * - This script creates real Patients rows so treatment-plan edits persist.
 *
 * Mode A — direct Airtable (local PAT):
 * - AIRTABLE_API_KEY, AIRTABLE_BASE_ID, WELLNEST_PROVIDER_ID
 *
 * Mode B — via deployed backend (no Airtable keys on this machine):
 * - BACKEND_API_URL (e.g. https://ponce-patient-backend.vercel.app)
 * - WELLNEST_PROVIDER_ID
 *
 * Optional env:
 * - AIRTABLE_PATIENTS_TABLE (defaults to "Patients")
 * - AIRTABLE_PATIENT_PHONE_FIELD — exact name of the **editable** phone column on Patients.
 *   Omit if you have no writable phone field (some bases use a computed "Patient Phone Number" only).
 * - AIRTABLE_SEED_PATIENTS_EXTRA_JSON — optional JSON object merged into each row (e.g. Source).
 *   Defaults: Name, Email, Providers, Treatments Discussed, Wellness Quiz, wellness intake text (see below).
 * - AIRTABLE_WELLNESS_INTAKE_FIELD — long-text field for comma-separated “Goals from intake” (UI reads via
 *   clientMapper → interestedIssues). Default "Aesthetic Goals". Set to false or 0 to skip.
 * - AIRTABLE_WELLNESS_GOALS_FIELD — long-text field for JSON array of goal strings (same as demo `goals`, e.g.
 *   ["Recovery","Training support"]). Default "Wellness Goals". Set to false or 0 to skip. Add this column in Airtable.
 *
 * Usage:
 *   AIRTABLE_API_KEY=... AIRTABLE_BASE_ID=... WELLNEST_PROVIDER_ID=... \
 *   node scripts/seed-wellnest-demo-patients.mjs
 *
 *   BACKEND_API_URL=https://ponce-patient-backend.vercel.app WELLNEST_PROVIDER_ID=rec... \
 *   node scripts/seed-wellnest-demo-patients.mjs
 */

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const WELLNEST_PROVIDER_ID = process.env.WELLNEST_PROVIDER_ID;
const PATIENTS_TABLE = process.env.AIRTABLE_PATIENTS_TABLE || "Patients";
/** Writable Patients phone field; computed fields like "Patient Phone Number" cannot be set via API. */
const PATIENT_PHONE_FIELD = (process.env.AIRTABLE_PATIENT_PHONE_FIELD || "").trim();
/** Maps to dashboard “Goals from intake” when Interest Items is empty (see clientMapper interestedIssues). */
const WELLNESS_INTAKE_FIELD = (() => {
  const raw = process.env.AIRTABLE_WELLNESS_INTAKE_FIELD;
  if (raw === undefined || raw === null) return "Aesthetic Goals";
  const t = String(raw).trim();
  if (!t || t === "false" || t === "0") return "";
  return t;
})();
const BACKEND_API_URL = (process.env.BACKEND_API_URL || "").replace(/\/$/, "");
const useBackend = Boolean(BACKEND_API_URL);

if (!WELLNEST_PROVIDER_ID) {
  console.error("Missing required env var: WELLNEST_PROVIDER_ID");
  process.exit(1);
}

if (useBackend) {
  // Backend must expose GET/POST/PATCH /api/dashboard/records/...
} else if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error(
    "Missing AIRTABLE_API_KEY / AIRTABLE_BASE_ID (or set BACKEND_API_URL to use the API proxy)",
  );
  process.exit(1);
}

const AIRTABLE_API =
  !useBackend && AIRTABLE_BASE_ID
    ? `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
        PATIENTS_TABLE,
      )}`
    : "";

const NOW = new Date().toISOString();

function buildDemoPatients() {
  return [
    {
      name: "Alex Rivera",
      email: "wellnest-demo-alex@demo.wellnest.local",
      phone: "+1 555 201 4401",
      goals: ["Recovery", "Training support"],
      interestedIssues: "Tendon recovery, workout inflammation, gut comfort",
      discussedItems: [
        {
          id: "wellnest-d1",
          treatment: "BPC-157",
          interest: "Recovery support",
          timeline: "Now",
          product: "SC injection preferred",
          quantity: "1",
          notes: "5-week supply discussed",
        },
        {
          id: "wellnest-d2",
          treatment: "Thymosin Beta-4 (TB-500)",
          interest: "Recovery support",
          timeline: "Add next visit",
          product: "SC injection preferred",
          quantity: "1",
        },
        {
          id: "wellnest-d3",
          treatment: "CJC-1295",
          interest: "Energy & recovery",
          timeline: "Wishlist",
          product: "SC injection",
          quantity: "1",
        },
      ],
      wellnessQuiz: {
        version: 1,
        completedAt: NOW,
        answers: {},
        suggestedTreatmentIds: ["bpc-157", "tb-500", "cjc-1295"],
      },
    },
    {
      name: "Jordan Lee",
      email: "wellnest-demo-jordan@demo.wellnest.local",
      phone: "+1 555 201 4402",
      goals: ["Sleep", "Focus", "Stress balance"],
      interestedIssues: "Brain fog, stress, sleep latency",
      discussedItems: [
        {
          id: "wellnest-d4",
          treatment: "Semax",
          interest: "Cognitive clarity",
          timeline: "Now",
          product: "Nasal spray available",
          quantity: "1",
        },
        {
          id: "wellnest-d5",
          treatment: "Selank",
          interest: "Stress balance",
          timeline: "Add next visit",
          product: "SC injection ideal",
          quantity: "1",
        },
        {
          id: "wellnest-d6",
          treatment: "Ipamorelin",
          interest: "Sleep & muscle",
          timeline: "Wishlist",
          product: "SC injection only",
          quantity: "1",
        },
      ],
      wellnessQuiz: {
        version: 1,
        completedAt: NOW,
        answers: {},
        suggestedTreatmentIds: ["semax", "selank", "ipamorelin"],
      },
    },
    {
      name: "Taylor Morgan",
      email: "wellnest-demo-taylor@demo.wellnest.local",
      phone: "+1 555 201 4403",
      goals: ["Body composition", "Metabolic support"],
      interestedIssues: "Visceral fat, joint comfort, bone health",
      discussedItems: [
        {
          id: "wellnest-d7",
          treatment: "Tesamorelin",
          interest: "Metabolic wellness",
          timeline: "Now",
          product: "SC injection",
          quantity: "1",
        },
        {
          id: "wellnest-d8",
          treatment: "AOD-9604",
          interest: "Metabolic wellness",
          timeline: "Add next visit",
          product: "SC injection",
          quantity: "1",
        },
        {
          id: "wellnest-d9",
          treatment: "Cartalax",
          interest: "Joint support",
          timeline: "Wishlist",
          product: "SC injection",
          quantity: "1",
        },
        {
          id: "wellnest-d10",
          treatment: "MK-677",
          interest: "Bone & joint",
          timeline: "Wishlist",
          product: "SC injection",
          quantity: "1",
        },
      ],
      wellnessQuiz: {
        version: 1,
        completedAt: NOW,
        answers: {},
        suggestedTreatmentIds: ["tesamorelin", "aod-9604", "cartalax", "mk-677"],
      },
    },
  ];
}

function airtableHeaders() {
  return {
    Authorization: `Bearer ${AIRTABLE_API_KEY}`,
    "Content-Type": "application/json",
  };
}

function jsonHeaders() {
  return { "Content-Type": "application/json" };
}

async function fetchByEmail(email) {
  const formula = `{Email} = "${email.replace(/"/g, '\\"')}"`;
  if (useBackend) {
    const url = `${BACKEND_API_URL}/api/dashboard/records/${encodeURIComponent(PATIENTS_TABLE)}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=1`;
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        data?.details?.error?.message ||
        data?.message ||
        data?.error ||
        `Backend list failed: HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data.records?.[0] ?? null;
  }
  const url = `${AIRTABLE_API}?maxRecords=1&filterByFormula=${encodeURIComponent(formula)}`;
  const res = await fetch(url, { headers: airtableHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Airtable fetch failed: HTTP ${res.status}`);
  }
  return data.records?.[0] ?? null;
}

function buildFields(p) {
  const phoneDigits = String(p.phone).replace(/\D/g, "");
  return {
    Name: p.name,
    Email: p.email,
    ...(PATIENT_PHONE_FIELD && phoneDigits
      ? { [PATIENT_PHONE_FIELD]: phoneDigits }
      : {}),
    Providers: [WELLNEST_PROVIDER_ID],
    "Treatments Discussed": JSON.stringify(p.discussedItems),
    "Wellness Quiz": JSON.stringify(p.wellnessQuiz),
    ...(WELLNESS_INTAKE_FIELD && p.interestedIssues
      ? { [WELLNESS_INTAKE_FIELD]: p.interestedIssues }
      : {}),
    ...(WELLNESS_GOALS_FIELD && Array.isArray(p.goals) && p.goals.length
      ? { [WELLNESS_GOALS_FIELD]: JSON.stringify(p.goals) }
      : {}),
    ...parseExtraJsonEnv(process.env.AIRTABLE_SEED_PATIENTS_EXTRA_JSON),
  };
}

/** Optional merge of static fields, e.g. {"Source":"Patients","Status":"Scheduled"} */
function parseExtraJsonEnv(raw) {
  if (!raw || typeof raw !== "string") return {};
  try {
    const o = JSON.parse(raw);
    return o && typeof o === "object" && !Array.isArray(o) ? o : {};
  } catch {
    console.warn("Ignoring invalid AIRTABLE_SEED_PATIENTS_EXTRA_JSON");
    return {};
  }
}

async function createRecord(fields) {
  if (useBackend) {
    const res = await fetch(
      `${BACKEND_API_URL}/api/dashboard/records/${encodeURIComponent(PATIENTS_TABLE)}`,
      {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ fields }),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        data?.details?.error?.message ||
        data?.message ||
        data?.error ||
        `Backend create failed: HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data.record ?? data;
  }
  const res = await fetch(AIRTABLE_API, {
    method: "POST",
    headers: airtableHeaders(),
    body: JSON.stringify({ fields }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Airtable create failed: HTTP ${res.status}`);
  }
  return data;
}

async function updateRecord(recordId, fields) {
  if (useBackend) {
    const res = await fetch(
      `${BACKEND_API_URL}/api/dashboard/records/${encodeURIComponent(PATIENTS_TABLE)}/${recordId}`,
      {
        method: "PATCH",
        headers: jsonHeaders(),
        body: JSON.stringify({ fields }),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        data?.details?.error?.message ||
        data?.message ||
        data?.error ||
        `Backend update failed: HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data.record ?? data;
  }
  const res = await fetch(`${AIRTABLE_API}/${recordId}`, {
    method: "PATCH",
    headers: airtableHeaders(),
    body: JSON.stringify({ fields }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Airtable update failed: HTTP ${res.status}`);
  }
  return data;
}

async function run() {
  const patients = buildDemoPatients();
  let created = 0;
  let updated = 0;
  for (const p of patients) {
    const existing = await fetchByEmail(p.email);
    const fields = buildFields(p);
    if (existing?.id) {
      await updateRecord(existing.id, fields);
      updated += 1;
      console.log(`Updated: ${p.name} (${existing.id})`);
    } else {
      const rec = await createRecord(fields);
      created += 1;
      console.log(`Created: ${p.name} (${rec.id})`);
    }
  }
  console.log(`Done. created=${created} updated=${updated}`);
}

run().catch((err) => {
  console.error("Seed failed:", err?.message || err);
  process.exit(1);
});

