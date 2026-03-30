#!/usr/bin/env node
/**
 * Compare Wellnest **injected sample clients** (src/debug/wellnestSampleClients.ts) + seed payload
 * to **live Airtable Patients** fetched via BACKEND_API_URL (same as seed script).
 *
 * Required env:
 *   BACKEND_API_URL, WELLNEST_PROVIDER_ID
 *
 * Usage:
 *   BACKEND_API_URL=https://ponce-patient-backend.vercel.app WELLNEST_PROVIDER_ID=rec... \
 *   node scripts/compare-wellnest-demo-airtable.mjs
 */

const BACKEND_API_URL = (process.env.BACKEND_API_URL || "").replace(/\/$/, "");
const WELLNEST_PROVIDER_ID = process.env.WELLNEST_PROVIDER_ID || "";
const PATIENTS_TABLE = process.env.AIRTABLE_PATIENTS_TABLE || "Patients";
const WELLNESS_FIELD =
  process.env.AIRTABLE_WELLNESS_INTAKE_FIELD === undefined ||
  process.env.AIRTABLE_WELLNESS_INTAKE_FIELD === null
    ? "Aesthetic Goals"
    : String(process.env.AIRTABLE_WELLNESS_INTAKE_FIELD).trim() || "Aesthetic Goals";
const WELLNESS_GOALS_FIELD = (() => {
  const raw = process.env.AIRTABLE_WELLNESS_GOALS_FIELD;
  if (raw === undefined || raw === null) return "Wellness Goals";
  const t = String(raw).trim();
  if (!t || t === "false" || t === "0") return "";
  return t;
})();

if (!BACKEND_API_URL || !WELLNEST_PROVIDER_ID) {
  console.error("Need BACKEND_API_URL and WELLNEST_PROVIDER_ID");
  process.exit(1);
}

/** Mirrors scripts/seed-wellnest-demo-patients.mjs + src/debug/wellnestSampleClients.ts */
const EXPECTED = [
  {
    email: "wellnest-demo-alex@demo.wellnest.local",
    name: "Alex Rivera",
    interestedIssues: "Tendon recovery, workout inflammation, gut comfort",
    goals: ["Recovery", "Training support"],
    discussedCount: 3,
    wellnessSuggestedIds: ["bpc-157", "tb-500", "cjc-1295"],
  },
  {
    email: "wellnest-demo-jordan@demo.wellnest.local",
    name: "Jordan Lee",
    interestedIssues: "Brain fog, stress, sleep latency",
    goals: ["Sleep", "Focus", "Stress balance"],
    discussedCount: 3,
    wellnessSuggestedIds: ["semax", "selank", "ipamorelin"],
  },
  {
    email: "wellnest-demo-taylor@demo.wellnest.local",
    name: "Taylor Morgan",
    interestedIssues: "Visceral fat, joint comfort, bone health",
    goals: ["Body composition", "Metabolic support"],
    discussedCount: 4,
    wellnessSuggestedIds: ["tesamorelin", "aod-9604", "cartalax", "mk-677"],
  },
];

async function fetchByEmail(email) {
  const formula = `{Email} = "${email.replace(/"/g, '\\"')}"`;
  const url = `${BACKEND_API_URL}/api/dashboard/records/${encodeURIComponent(PATIENTS_TABLE)}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=1`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data?.details?.error?.message || data?.error || `HTTP ${res.status}`,
    );
  }
  return data.records?.[0] ?? null;
}

function safeJsonParse(s) {
  if (s == null || s === "") return null;
  if (typeof s !== "string") return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function summarizeRecord(rec) {
  if (!rec) return null;
  const f = rec.fields || {};
  const td = safeJsonParse(f["Treatments Discussed"]);
  const wq = safeJsonParse(f["Wellness Quiz"]);
  const interestItems = f["Name (from Interest Items)"];
  const interestJoined = Array.isArray(interestItems)
    ? interestItems.join(", ")
    : interestItems || "";
  return {
    id: rec.id,
    name: f.Name || "",
    email: f.Email || "",
    interestItemsJoined: interestJoined,
    wellnessIntakeField: f[WELLNESS_FIELD] || "",
    treatmentsDiscussedCount: Array.isArray(td) ? td.length : null,
    wellnessQuizSuggested: Array.isArray(wq?.suggestedTreatmentIds)
      ? wq.suggestedTreatmentIds
      : null,
    providerLinks: f.Providers,
    wellnessGoalsRaw: WELLNESS_GOALS_FIELD ? f[WELLNESS_GOALS_FIELD] || "" : "",
    wellnessGoalsParsed: (() => {
      if (!WELLNESS_GOALS_FIELD) return null;
      const raw = f[WELLNESS_GOALS_FIELD];
      if (typeof raw !== "string" || !raw.trim()) return null;
      const p = safeJsonParse(raw.trim());
      return Array.isArray(p) ? p.map(String) : null;
    })(),
  };
}

function main() {
  console.log(`Backend: ${BACKEND_API_URL}`);
  console.log(`Wellness intake Airtable field (for compare): "${WELLNESS_FIELD}"`);
  if (WELLNESS_GOALS_FIELD) {
    console.log(`Wellness goals JSON field (for compare): "${WELLNESS_GOALS_FIELD}"`);
  }
  console.log("");
}

async function run() {
  main();
  for (const exp of EXPECTED) {
    console.log("---");
    console.log(`${exp.name} <${exp.email}>`);
    let rec;
    try {
      rec = await fetchByEmail(exp.email);
    } catch (e) {
      console.log(`  FETCH ERROR: ${e.message}`);
      continue;
    }
    if (!rec) {
      console.log("  No Airtable row found for this email.");
      continue;
    }
    const s = summarizeRecord(rec);
    console.log(`  Airtable id: ${s.id}`);
    console.log(
      `  Treatments Discussed: count=${s.treatmentsDiscussedCount} (expected ${exp.discussedCount}) ${s.treatmentsDiscussedCount === exp.discussedCount ? "OK" : "MISMATCH"}`,
    );
    const ids = s.wellnessQuizSuggested || [];
    const idMatch =
      ids.length === exp.wellnessSuggestedIds.length &&
      exp.wellnessSuggestedIds.every((x) => ids.includes(x));
    console.log(
      `  Wellness Quiz suggestedTreatmentIds: ${JSON.stringify(ids)} ${idMatch ? "OK" : "MISMATCH"}`,
    );
    const intake = String(s.wellnessIntakeField || "").trim();
    const intakeOk = intake === exp.interestedIssues;
    console.log(
      `  "${WELLNESS_FIELD}" (intake text): ${intakeOk ? "OK" : "MISMATCH"}`,
    );
    if (!intakeOk) {
      console.log(`    expected: ${exp.interestedIssues}`);
      console.log(`    actual:   ${intake || "(empty)"}`);
    }
    const items = String(s.interestItemsJoined || "").trim();
    if (items) {
      console.log(
        `  Name (from Interest Items): ${items} (dashboard may prefer this over ${WELLNESS_FIELD} for intake chips)`,
      );
    }
    const prov = s.providerLinks;
    const hasProvider =
      Array.isArray(prov) && prov.includes(WELLNEST_PROVIDER_ID);
    console.log(
      `  Providers includes WELLNEST_PROVIDER_ID: ${hasProvider ? "OK" : "MISMATCH"}`,
    );
    if (WELLNESS_GOALS_FIELD) {
      const g = s.wellnessGoalsParsed;
      const goalsOk =
        g &&
        g.length === exp.goals.length &&
        exp.goals.every((x, i) => g[i] === x);
      console.log(
        `  "${WELLNESS_GOALS_FIELD}" (JSON goals): ${goalsOk ? "OK" : "MISMATCH"}`,
      );
      if (!goalsOk) {
        console.log(`    expected: ${JSON.stringify(exp.goals)}`);
        console.log(
          `    actual:   ${g ? JSON.stringify(g) : String(s.wellnessGoalsRaw || "(empty)")}`,
        );
      }
    }
  }

  console.log("");
  console.log("=== Sample-only behavior (not stored on these Airtable rows) ===");
  console.log(
    [
      "- Injected demos use id wellnest-demo-*; Airtable rows use rec* (real ids).",
      "- Demo front/side photos: public/post-visit-blueprint/videos/wellnest/patient-photos (or VITE_WELLNEST_DEMO_HEADSHOT_*). Attach Front Photo in Airtable if you want the same headshots in the grid.",
      "- Demo age / zip / status / notes / isReal:false come from baseClient() defaults; mapper fills Patients from form fields — many will be empty until you set them.",
      "- Demo `goals` array: dashboard reads Patients from Name (from Interest Items), Goals, or long-text \"Wellness Goals\" (JSON array from seed).",
      "- Treatment plan edits for wellnest-demo-* persist in sessionStorage; real rows persist via Airtable.",
    ].join("\n"),
  );
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
