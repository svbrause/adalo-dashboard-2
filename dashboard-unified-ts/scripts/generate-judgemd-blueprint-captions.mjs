import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = join(root, "src/config/postVisitBlueprintVideos.ts");
const preparedVideoDir = join(root, "training_output/gcs/judgemd-blueprint-videos/videos");
const outRoot = join(root, "training_output/gcs/judgemd-blueprint-captions");
const audioOutDir = join(outRoot, "audio");
const captionsOutDir = join(outRoot, "captions");
const responsesOutDir = join(outRoot, "speech-responses");
const manifestPath = join(outRoot, "manifest.json");
const bucketBase = "gs://test-deploy-august25/post-visit-blueprint/videos/judgemd";
const publicBase = "https://storage.googleapis.com/test-deploy-august25/post-visit-blueprint/videos/judgemd";
const gcpProject = process.env.GOOGLE_CLOUD_PROJECT || runCapture("gcloud", ["config", "get-value", "project"], "reading gcloud project");

const args = new Set(process.argv.slice(2));
const force = args.has("--force");
const all = args.has("--all") || process.argv.length <= 2;
const shouldExtractAudio = all || args.has("--extract-audio");
const shouldUploadAudio = all || args.has("--upload-audio");
const shouldTranscribe = all || args.has("--transcribe");
const shouldUploadCaptions = all || args.has("--upload-captions");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : Number.POSITIVE_INFINITY;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function nonEmptyFile(path) {
  return existsSync(path) && statSync(path).size > 0;
}

function run(command, args, label) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    fail(`${command} failed while ${label}`);
  }
}

function runCapture(command, args, label) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    fail(`${command} failed while ${label}: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
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

function secondsFromDuration(value, fallback = 0) {
  if (!value) return fallback;
  if (typeof value === "string") return Number(value.replace(/s$/, "")) || fallback;
  const seconds = Number(value.seconds ?? 0);
  const nanos = Number(value.nanos ?? 0);
  return seconds + nanos / 1_000_000_000;
}

function vttTimestamp(seconds) {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const wholeSeconds = Math.floor(safe % 60);
  const millis = Math.round((safe - Math.floor(safe)) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(
    wholeSeconds,
  ).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

function normalizeCaptionText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function buildCues(words) {
  const cues = [];
  let current = [];
  let cueStart = 0;
  let lastEnd = 0;

  function flush() {
    if (!current.length) return;
    cues.push({
      start: cueStart,
      end: Math.max(lastEnd, cueStart + 0.75),
      text: normalizeCaptionText(current.join(" ")),
    });
    current = [];
  }

  for (const wordInfo of words) {
    const word = String(wordInfo.word ?? "").trim();
    if (!word) continue;
    const start = secondsFromDuration(wordInfo.startTime, lastEnd);
    const end = secondsFromDuration(wordInfo.endTime, start + 0.4);
    const nextText = normalizeCaptionText([...current, word].join(" "));
    const duration = current.length ? end - cueStart : 0;
    const shouldBreak =
      current.length > 0 &&
      (duration >= 5.5 || nextText.length > 58 || /[.!?]$/.test(current[current.length - 1]));

    if (shouldBreak) flush();
    if (!current.length) cueStart = start;
    current.push(word);
    lastEnd = end;
  }
  flush();
  return cues;
}

function speechResponseToVtt(response) {
  const words = [];
  for (const result of response.results ?? []) {
    const alternative = result.alternatives?.[0];
    if (alternative?.words?.length) {
      words.push(...alternative.words);
    }
  }

  const cues = buildCues(words);
  if (!cues.length) return "WEBVTT\n\n";

  return `WEBVTT\n\n${cues
    .map((cue, index) => `${index + 1}\n${vttTimestamp(cue.start)} --> ${vttTimestamp(cue.end)}\n${cue.text}`)
    .join("\n\n")}\n`;
}

async function apiFetch(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "x-goog-user-project": gcpProject,
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch (_error) {
    body = { raw: text };
  }
  if (!response.ok) {
    fail(`Speech API request failed (${response.status}): ${JSON.stringify(body, null, 2)}`);
  }
  return body;
}

async function transcribeAudio(id, audioUri, responseOut, captionOut) {
  const token = runCapture("gcloud", ["auth", "print-access-token"], "getting an access token");
  const request = {
    config: {
      languageCode: "en-US",
      enableAutomaticPunctuation: true,
      enableWordTimeOffsets: true,
      model: "video",
      useEnhanced: true,
    },
    audio: {
      uri: audioUri,
    },
  };

  console.log(`Submitting Speech-to-Text job for ${id}`);
  const operation = await apiFetch("https://speech.googleapis.com/v1/speech:longrunningrecognize", token, {
    method: "POST",
    body: JSON.stringify(request),
  });
  const operationName = operation.name;
  if (!operationName) fail(`Speech API did not return an operation name for ${id}`);

  let done = false;
  let pollCount = 0;
  let result = operation;
  while (!done) {
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    pollCount += 1;
    result = await apiFetch(
      `https://speech.googleapis.com/v1/operations/${encodeURIComponent(operationName)}`,
      token,
    );
    done = Boolean(result.done);
    const progress = result.metadata?.progressPercent;
    console.log(`Polling ${id}: ${progress ?? "?"}%${done ? " done" : ""}`);
    if (pollCount > 180) fail(`Timed out waiting for Speech-to-Text job ${operationName}`);
  }

  if (result.error) {
    fail(`Speech-to-Text failed for ${id}: ${JSON.stringify(result.error, null, 2)}`);
  }

  writeFileSync(responseOut, `${JSON.stringify(result.response ?? {}, null, 2)}\n`);
  writeFileSync(captionOut, speechResponseToVtt(result.response ?? {}));
}

mkdirSync(audioOutDir, { recursive: true });
mkdirSync(captionsOutDir, { recursive: true });
mkdirSync(responsesOutDir, { recursive: true });

const reelFiles = extractReelFiles().slice(0, limit);
const manifest = [];

for (const rel of reelFiles) {
  const id = judgeMdVideoIdFromPath(rel);
  const preparedVideo = join(preparedVideoDir, `${id}.mp4`);
  const sourceVideo = nonEmptyFile(preparedVideo) ? preparedVideo : join(root, rel);
  const audioOut = join(audioOutDir, `${id}.flac`);
  const responseOut = join(responsesOutDir, `${id}.json`);
  const captionOut = join(captionsOutDir, `${id}.vtt`);
  const audioUri = `${bucketBase}/caption-audio/${id}.flac`;
  const captionUri = `${bucketBase}/captions/${id}.vtt`;

  if (!existsSync(sourceVideo)) fail(`Missing source video for ${id}: ${sourceVideo}`);

  if (shouldExtractAudio && (force || !nonEmptyFile(audioOut))) {
    console.log(`Extracting audio ${id}.flac`);
    run(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "warning",
        "-y",
        "-i",
        sourceVideo,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-sample_fmt",
        "s16",
        "-c:a",
        "flac",
        audioOut,
      ],
      `extracting audio for ${id}`,
    );
  } else if (shouldExtractAudio) {
    console.log(`Skipping existing audio ${id}.flac`);
  }

  if (shouldUploadAudio) {
    run(
      "gsutil",
      ["-h", "Cache-Control:private, max-age=31536000", "cp", audioOut, `${bucketBase}/caption-audio/`],
      `uploading audio for ${id}`,
    );
  }

  if (shouldTranscribe && (force || !nonEmptyFile(captionOut))) {
    await transcribeAudio(id, audioUri, responseOut, captionOut);
  } else if (shouldTranscribe) {
    console.log(`Skipping existing caption ${id}.vtt`);
  }

  if (shouldUploadCaptions) {
    run(
      "gsutil",
      ["-h", "Cache-Control:public, max-age=31536000, immutable", "-h", "Content-Type:text/vtt", "cp", captionOut, `${bucketBase}/captions/`],
      `uploading caption for ${id}`,
    );
  }

  manifest.push({
    id,
    source: rel,
    audio: audioUri,
    caption: captionUri,
    publicCaption: `${publicBase}/captions/${id}.vtt`,
  });
}

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Prepared JudgeMD captions manifest at ${manifestPath}`);
