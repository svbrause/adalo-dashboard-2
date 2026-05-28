/**
 * Builds the React clinic deck (Vite) into deck-site/public for Vercel.
 *
 * Vercel: set project Root Directory to `deck-site`. The full repo is still
 * checked out, so `../package.json` and sources are available.
 *
 * Env: DASHBOARD_ORIGIN — dashboard URL for live demo links (default production).
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const deckSiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(deckSiteRoot, "..");
const outDir = path.join(deckSiteRoot, "public");

const DASHBOARD_ORIGIN = (
  process.env.DASHBOARD_ORIGIN || "https://dashboard-unified-ts.vercel.app"
).replace(/\/$/, "");

/** `public/…` files exposed at site root (`assetSrc` strips the `public/` prefix). */
const DECK_PUBLIC_ASSETS = [
  "public/demo-3d/dark_mode_logo.png",
  "public/demo-3d/tanya-tan-front.png",
  "public/demo/gravitas-tanya-blueprint.json",
];

/** Repo paths kept at their source URL path (e.g. `/src/assets/images/…`). */
const EXTRA_STATIC = ["src/assets/images/turntable_2048_black.mp4"];

function copyRepoFile(repoRelative, destRelative = repoRelative) {
  const from = path.join(repoRoot, repoRelative);
  const dest = path.join(outDir, destRelative);
  if (!fs.existsSync(from)) {
    throw new Error(`Missing asset: ${from}`);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(from, dest);
}

function copyPublicAsset(repoRelative) {
  if (!repoRelative.startsWith("public/")) {
    throw new Error(`Expected public/ path: ${repoRelative}`);
  }
  copyRepoFile(repoRelative, repoRelative.slice("public/".length));
}

function ensureDeps() {
  const modules = path.join(repoRoot, "node_modules", "vite");
  if (fs.existsSync(modules)) return;
  console.log("Installing dependencies (repo root)…");
  execSync("npm ci", { cwd: repoRoot, stdio: "inherit" });
}

console.log(`Dashboard origin for live links: ${DASHBOARD_ORIGIN}`);

ensureDeps();

execSync("npx vite build --config deck-site/vite.deck.config.ts", {
  cwd: repoRoot,
  stdio: "inherit",
  env: { ...process.env, DASHBOARD_ORIGIN },
});

for (const repoPath of DECK_PUBLIC_ASSETS) {
  copyPublicAsset(repoPath);
}

for (const repoPath of EXTRA_STATIC) {
  copyRepoFile(repoPath);
}

const builtHtml = path.join(
  outDir,
  "docs/presentations/clinic-demo-deck.html",
);
if (!fs.existsSync(builtHtml)) {
  throw new Error(`Vite did not emit ${builtHtml}`);
}
fs.copyFileSync(builtHtml, path.join(outDir, "index.html"));

fs.writeFileSync(
  path.join(outDir, "vercel.json"),
  `${JSON.stringify(
    {
      buildCommand: null,
      installCommand: null,
      outputDirectory: ".",
    },
    null,
    2,
  )}\n`,
);

console.log(`Built deck → ${outDir}`);
