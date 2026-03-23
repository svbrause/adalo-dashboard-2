#!/usr/bin/env node
/**
 * Extracts a single JPEG frame from each Post-Visit Blueprint hero video for use as
 * `posterUrl` thumbnails (see `src/config/postVisitBlueprintVideos.ts`).
 *
 * Requires ffmpeg on PATH: https://ffmpeg.org/
 *   macOS: brew install ffmpeg
 *
 * Usage: node scripts/extract-blueprint-posters.mjs
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "public/post-visit-blueprint/videos/posters");

/** MP4 inputs only (first source per clip is enough for a still). */
const jobs = [
  {
    input: "public/post-visit-blueprint/videos/moxi-laser.mp4",
    output: "public/post-visit-blueprint/videos/posters/moxi-laser.jpg",
    atSeconds: 1,
  },
  {
    input: "public/post-visit-blueprint/videos/lower-face-filler-wrinkles.mp4",
    output: "public/post-visit-blueprint/videos/posters/lower-face-filler-wrinkles.jpg",
    atSeconds: 1,
  },
  {
    input: "public/post-visit-blueprint/videos/filler-faq.mp4",
    output: "public/post-visit-blueprint/videos/posters/filler-faq.jpg",
    atSeconds: 1,
  },
];

function ffmpeg() {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "pipe" });
  } catch {
    console.error("ffmpeg not found. Install: https://ffmpeg.org/  (macOS: brew install ffmpeg)");
    process.exit(1);
  }
}

ffmpeg();
mkdirSync(outDir, { recursive: true });

for (const job of jobs) {
  const inputPath = join(root, job.input);
  const outputPath = join(root, job.output);
  if (!existsSync(inputPath)) {
    console.warn(`Skip (missing): ${job.input}`);
    continue;
  }
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-ss",
      String(job.atSeconds),
      "-i",
      inputPath,
      "-vframes",
      "1",
      "-q:v",
      "2",
      "-update",
      "1",
      outputPath,
    ],
    { stdio: "inherit" },
  );
  console.log(`Wrote ${job.output}`);
}

console.log("Done. Commit the JPGs under public/post-visit-blueprint/videos/posters/ if desired.");
