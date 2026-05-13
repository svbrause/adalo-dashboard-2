import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = join(root, "src/config/postVisitBlueprintVideos.ts");
const outRoot = join(root, "training_output/gcs/judgemd-blueprint-videos");
const videoOutDir = join(outRoot, "videos");
const posterOutDir = join(outRoot, "posters");
const manifestPath = join(outRoot, "manifest.json");
const bucketBase = "gs://test-deploy-august25/post-visit-blueprint/videos/judgemd";
const force = process.argv.includes("--force");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function extractReelFiles() {
  const config = readFileSync(configPath, "utf8");
  const match = config.match(/const JUDGEMD_REEL_FILES = \[([\s\S]*?)\] as const;/);
  if (!match) fail("Could not find JUDGEMD_REEL_FILES in postVisitBlueprintVideos.ts");
  return Array.from(match[1].matchAll(/"([^"]+)"/g), (m) => m[1]);
}

function judgeMdVideoIdFromPath(path) {
  return `judgemd_${path
    .replace(/\.[^.]+$/, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")}`;
}

function nonEmptyFile(path) {
  return existsSync(path) && statSync(path).size > 0;
}

function runFfmpeg(args, label) {
  const result = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "warning", ...args], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    fail(`ffmpeg failed while ${label}`);
  }
}

mkdirSync(videoOutDir, { recursive: true });
mkdirSync(posterOutDir, { recursive: true });

const reelFiles = extractReelFiles();
const manifest = [];

for (const rel of reelFiles) {
  const input = join(root, rel);
  if (!existsSync(input)) fail(`Missing input video: ${rel}`);

  const id = judgeMdVideoIdFromPath(rel);
  const videoOut = join(videoOutDir, `${id}.mp4`);
  const posterOut = join(posterOutDir, `${id}.jpg`);

  if (force || !nonEmptyFile(videoOut)) {
    console.log(`Transcoding ${rel}`);
    runFfmpeg(
      [
        "-y",
        "-i",
        input,
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
        "-vf",
        "scale='min(1080,iw)':-2",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        videoOut,
      ],
      `transcoding ${rel}`,
    );
  } else {
    console.log(`Skipping existing MP4 ${id}.mp4`);
  }

  if (force || !nonEmptyFile(posterOut)) {
    console.log(`Creating poster ${id}.jpg`);
    runFfmpeg(
      [
        "-y",
        "-ss",
        "1",
        "-i",
        videoOut,
        "-frames:v",
        "1",
        "-vf",
        "scale=720:-2",
        "-q:v",
        "3",
        "-update",
        "1",
        posterOut,
      ],
      `creating poster for ${rel}`,
    );
  } else {
    console.log(`Skipping existing poster ${id}.jpg`);
  }

  manifest.push({
    id,
    source: rel,
    video: `${bucketBase}/videos/${id}.mp4`,
    poster: `${bucketBase}/posters/${id}.jpg`,
  });
}

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Prepared ${manifest.length} JudgeMD videos in ${outRoot}`);
console.log("Upload with:");
console.log(
  `gsutil -m -h "Cache-Control:public, max-age=31536000, immutable" cp ${videoOutDir}/*.mp4 ${bucketBase}/videos/`,
);
console.log(
  `gsutil -m -h "Cache-Control:public, max-age=31536000, immutable" cp ${posterOutDir}/*.jpg ${bucketBase}/posters/`,
);
