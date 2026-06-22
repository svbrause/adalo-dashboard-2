#!/usr/bin/env node
/**
 * Copy the upstream MediaPipe scan from test-live-mediapipe.
 *
 * The dashboard uses a simplified dark-mode fork at public/clinic-scan/index.html.
 * Upstream is saved to index-upstream.html so sync does not overwrite the fork.
 *
 * Usage:
 *   node scripts/sync-clinic-scan.mjs
 *   CLINIC_SCAN_SOURCE=../test-live-mediapipe node scripts/sync-clinic-scan.mjs
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const sourceRoot = resolve(
  process.env.CLINIC_SCAN_SOURCE ||
    join(root, "..", "test-live-mediapipe"),
);
const src = join(sourceRoot, "index.html");
const destDir = join(root, "public", "clinic-scan");
const destUpstream = join(destDir, "index-upstream.html");

mkdirSync(destDir, { recursive: true });
copyFileSync(src, destUpstream);
console.log(`Synced upstream clinic scan:\n  ${src}\n  → ${destUpstream}`);
console.log(
  "\nDashboard entry point remains public/clinic-scan/index.html (simplified fork).",
);
console.log(
  "Full upstream copy: public/clinic-scan/index-upstream.html",
);
console.log(
  "Legacy full dashboard copy: public/clinic-scan/index-full.html",
);
