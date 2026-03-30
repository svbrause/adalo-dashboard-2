/**
 * Builds dist-analytics/ — static site with index.html + CSV for a dedicated Vercel (or any static host) deploy.
 * Run: npm run build:analytics
 * Deploy: npx vercel dist-analytics --prod   (or set Vercel output directory to dist-analytics)
 */
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist-analytics");
const htmlSrc = join(root, "scripts", "patients-discussed-analytics.html");
/** Default export: copy of Patients-Grid view (10).csv — replace public/patients-discussed-data.csv to change. */
const csvSrc = join(root, "public", "patients-discussed-data.csv");

mkdirSync(out, { recursive: true });
copyFileSync(htmlSrc, join(out, "index.html"));
copyFileSync(csvSrc, join(out, "patients-discussed-data.csv"));

writeFileSync(
  join(out, "package.json"),
  JSON.stringify(
    {
      name: "patients-discussed-analytics-static",
      private: true,
      version: "1.0.0",
      scripts: {
        build: "node -e \"process.exit(0)\"",
      },
    },
    null,
    2
  ) + "\n"
);

writeFileSync(
  join(out, "vercel.json"),
  JSON.stringify(
    {
      $schema: "https://openapi.vercel.sh/vercel.json",
      framework: null,
      installCommand: "npm install --omit=dev --prefer-offline --no-audit --no-fund",
      buildCommand: "npm run build",
      outputDirectory: ".",
      headers: [
        {
          source: "/(.*)",
          headers: [{ key: "X-Content-Type-Options", value: "nosniff" }],
        },
      ],
    },
    null,
    2
  ) + "\n"
);

console.log("Wrote dist-analytics/ (index.html, CSV, package.json, vercel.json)");
console.log("Deploy: npx vercel dist-analytics --prod");
