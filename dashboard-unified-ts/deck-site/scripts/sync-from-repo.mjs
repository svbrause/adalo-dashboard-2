/**
 * Copies deck HTML + assets into deck-site/staging for offline / CLI-only Vercel uploads.
 * Run from repo root: npm run deck:sync
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const deckSiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(deckSiteRoot, "..");
const stagingDir = path.join(deckSiteRoot, "staging");

const ASSET_MANIFEST = [
  "public/demo/gravitas-medspa-logo.png",
  "public/demo/gravitas-tanya-blueprint.json",
  "public/demo-3d/dark_mode_logo.png",
  "src/assets/images/turntable_2048_black.mp4",
  "src/assets/images/aura-tan-front.webp",
  "src/assets/images/aura-tan-three-quarter-left.webp",
  "src/assets/images/aura-tan-three-quarter-right.webp",
  "src/assets/images/aura-tan-profile-right.webp",
];

function mapDestPath(repoRelative) {
  if (repoRelative.startsWith("public/")) {
    return repoRelative.slice("public/".length);
  }
  if (repoRelative.startsWith("src/assets/images/")) {
    return repoRelative.slice("src/".length);
  }
  return repoRelative;
}

const sourceHtml = path.join(repoRoot, "docs/presentations/clinic-demo-deck.html");
if (!fs.existsSync(sourceHtml)) {
  throw new Error(`Missing ${sourceHtml}`);
}

fs.rmSync(stagingDir, { recursive: true, force: true });
fs.mkdirSync(stagingDir, { recursive: true });
fs.copyFileSync(sourceHtml, path.join(stagingDir, "clinic-demo-deck.html"));

for (const repoPath of ASSET_MANIFEST) {
  const src = path.join(repoRoot, repoPath);
  const dest = path.join(stagingDir, "assets", mapDestPath(repoPath));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

console.log(`Synced deck staging → ${stagingDir}`);
