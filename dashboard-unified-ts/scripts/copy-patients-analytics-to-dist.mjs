/**
 * Optional post-build step: copy static analytics HTML into dist/ when present.
 * CI and fresh clones may not have generated this file yet (see `npm run build:analytics`).
 */
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const src = join(root, "scripts", "patients-discussed-analytics.html");
const dest = join(root, "dist", "patients-discussed-analytics.html");

if (!existsSync(src)) {
  console.warn(
    "[build] scripts/patients-discussed-analytics.html not found — skipping copy (run npm run build:analytics locally if you need it in dist/)",
  );
  process.exit(0);
}

copyFileSync(src, dest);
console.log("[build] copied patients-discussed-analytics.html → dist/");
