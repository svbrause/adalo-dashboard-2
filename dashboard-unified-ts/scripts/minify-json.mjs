#!/usr/bin/env node
/**
 * Minify JSON to one line (e.g. GCP service account for Vercel GCS_SERVICE_ACCOUNT_JSON).
 *
 *   node scripts/minify-json.mjs ./plasma-matter-469702-s1-1a4bffa04341.json
 *   node scripts/minify-json.mjs ./key.json | pbcopy   # macOS → clipboard
 */

import fs from "node:fs";

/** @param {string} jsonString @returns {string} */
export function minifyJson(jsonString) {
  return JSON.stringify(JSON.parse(jsonString));
}

const path = process.argv[2];
if (!path) {
  console.error("Usage: node scripts/minify-json.mjs <file.json>");
  process.exit(1);
}

const raw = fs.readFileSync(path, "utf8");
process.stdout.write(minifyJson(raw));
