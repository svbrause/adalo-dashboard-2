#!/usr/bin/env node
/**
 * Seed the Treatment Recommender Options table with default options for a provider.
 * This allows providers to then remove any option on a per-provider basis.
 *
 * Usage:
 *   node scripts/seed-treatment-recommender-options.mjs <providerId>
 *   BACKEND_API_URL=https://your-backend.vercel.app node scripts/seed-treatment-recommender-options.mjs <providerId>
 *
 * Defaults seeded: Where (regions), Laser What (devices), Biostimulant What.
 * Skincare What is seeded automatically when the provider first opens the Treatment Recommender in the dashboard.
 *
 * Get provider IDs from your Airtable Providers table (Record ID column).
 */

const BASE_URL = process.env.BACKEND_API_URL || process.env.VITE_BACKEND_API_URL || "https://ponce-patient-backend.vercel.app";

const REGION_OPTIONS = [
  "Forehead", "Glabella", "Crow's feet", "Lips", "Cheeks", "Nasolabial",
  "Marionette lines", "Prejowl sulcus", "Jawline", "Lower face", "Under eyes",
];
const LASER_DEVICES = [
  "Moxi", "Halo", "BBL (BroadBand Light)", "Moxi + BBL", "PicoSure", "PicoWay",
  "Fraxel", "Clear + Brilliant", "IPL (Intense Pulsed Light)", "Sciton ProFractional",
  "Laser Genesis", "VBeam (Pulsed Dye)", "Excel V", "AcuPulse", "Other",
];
const BIOSTIMULANT_OPTIONS = [
  "PLLA (e.g. Sculptra)", "Calcium hydroxyapatite (e.g. Radiesse)",
  "Polycaprolactone (e.g. Ellansé)", "Other collagen stimulator", "Other",
];

function buildSeedOptions() {
  const options = [];
  for (const value of REGION_OPTIONS) {
    options.push({ optionType: "where", value });
  }
  for (const value of LASER_DEVICES) {
    options.push({ optionType: "laser_what", value });
  }
  for (const value of BIOSTIMULANT_OPTIONS) {
    options.push({ optionType: "biostimulant_what", value });
  }
  return options;
}

async function seed(providerId) {
  const url = `${BASE_URL}/api/dashboard/treatment-recommender-options/seed`;
  const options = buildSeedOptions();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ providerId, options }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.error || `HTTP ${res.status}`);
  }
  return data;
}

const providerId = process.argv[2];
if (!providerId) {
  console.error("Usage: node scripts/seed-treatment-recommender-options.mjs <providerId>");
  console.error("Example: node scripts/seed-treatment-recommender-options.mjs recXXXXXXXXXXXXXX");
  process.exit(1);
}

seed(providerId)
  .then((data) => {
    console.log(`Seeded ${data.inserted ?? 0} options for provider ${providerId}`);
    if (data.inserted === 0) {
      console.log("(No new options; provider may already have defaults.)");
    }
  })
  .catch((err) => {
    console.error("Seed failed:", err.message);
    process.exit(1);
  });
