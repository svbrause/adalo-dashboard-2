/**
 * Clinically curate Tanya Tan's Modal severity JSON using OpenAI vision.
 * Downgrades/removes false positives (e.g. platysmal bands) and keeps visible findings.
 *
 *   npx tsx scripts/revise-tanya-severity-openai.ts
 *   npx tsx scripts/revise-tanya-analysis-openai.ts   # refresh narrative after
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnv } from "vite";
import type { AnalysisSeverityScoresData } from "../src/types";
import severityRaw from "../src/debug/tanya-tan-severity-scores.json";

const env = loadEnv("development", process.cwd(), "");
const apiKey = env.VITE_OPENAI_API_KEY?.trim();
/** Vision curation — use a vision-capable model (not mini-only workflows). */
const model = env.VITE_OPENAI_VISION_MODEL?.trim() || "gpt-4o";

if (!apiKey) {
  console.error("Missing VITE_OPENAI_API_KEY in .env.local");
  process.exit(1);
}

const IMAGE_PATHS = [
  "src/assets/images/tan_front.JPG",
  "src/assets/images/tan_45_left.JPG",
  "src/assets/images/tan_45_right.JPG",
  "src/assets/images/tan_90_left.JPG",
  "src/assets/images/tan_90_right.JPG",
];

const severity = structuredClone(
  severityRaw,
) as AnalysisSeverityScoresData & {
  demo_clinical_curation?: string;
};

const predictedIssues = Object.entries(severity.issues)
  .filter(([, row]) => row.predicted)
  .sort(
    (a, b) =>
      (b[1].severity_normalized_0_1 ?? 0) -
      (a[1].severity_normalized_0_1 ?? 0),
  )
  .map(([name, row]) => ({
    name,
    severity_level: row.severity_level,
    severity_normalized_0_1: row.severity_normalized_0_1,
    probability: row.probability,
  }));

function imageContentPart(absPath: string, label: string) {
  const buf = readFileSync(absPath);
  const b64 = buf.toString("base64");
  return [
    { type: "text" as const, text: `Photo angle: ${label}` },
    {
      type: "image_url" as const,
      image_url: { url: `data:image/jpeg;base64,${b64}`, detail: "high" as const },
    },
  ];
}

function buildPrompt(): string {
  return `You are an experienced aesthetic physician reviewing automated facial analysis for a demo patient (woman, late 30s, combination skin). You will see 5 clinical-style photos (front, 45° L/R, profile L/R).

The computer vision model over-detected many issues. Your job is to produce a REALISTIC curated list of findings that are actually visible or very likely from these photos — suitable for a medspa dashboard demo.

Detector flagged these ${predictedIssues.length} issues (name, model severity_level, normalized 0-1):
${JSON.stringify(predictedIssues, null, 2)}

Rules:
- EXCLUDE findings you cannot see or that are clearly wrong (e.g. platysmal bands on a smooth neck, severe nasal deformities on a straight nose, extreme asymmetry not visible).
- INCLUDE common treatable demo findings when visible or plausible: e.g. forehead lines, crow's feet, under-eye concerns, whiteheads/texture, mild jawline softness, nasolabial folds, skin tone unevenness — only if appropriate.
- Target roughly 12–22 confirmed issues (not 40+).
- Severity must be honest: most should be none-to-mild or mild-to-moderate; reserve "severe" for unmistakable findings.
- Use exact issue names from the list above when possible.

Respond with JSON only (no markdown):
{
  "confirmed_issues": [
    {
      "name": "Forehead Wrinkles",
      "severity_level": "mild",
      "severity_normalized_0_1": 0.38,
      "rationale": "visible horizontal lines on front view"
    }
  ],
  "summary": "one sentence on overall impression"
}`;
}

type ConfirmedIssue = {
  name: string;
  severity_level: string;
  severity_normalized_0_1: number;
  rationale?: string;
};

type CurationResponse = {
  confirmed_issues: ConfirmedIssue[];
  summary?: string;
};

function parseJsonResponse(text: string): CurationResponse {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1].trim() : trimmed;
  return JSON.parse(raw) as CurationResponse;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, Number(n)));
}

function applyCuration(data: CurationResponse) {
  const confirmedByName = new Map<string, ConfirmedIssue>();
  for (const row of data.confirmed_issues) {
    const name = row.name?.trim();
    if (!name) continue;
    confirmedByName.set(name, row);
  }

  let confirmedCount = 0;
  for (const [issueName, row] of Object.entries(severity.issues)) {
    const confirmed = confirmedByName.get(issueName);
    if (confirmed) {
      const norm = clamp01(confirmed.severity_normalized_0_1);
      const level = confirmed.severity_level?.trim().toLowerCase() || "mild";
      row.predicted = true;
      row.probability = norm;
      row.severity = norm;
      row.severity_normalized_0_1 = norm;
      row.severity_level =
        level === "none" || level === "minimal"
          ? "minimal"
          : confirmed.severity_level;
      row.source = "severity_v3+demo_openai_curation";
      confirmedCount += 1;
      confirmedByName.delete(issueName);
    } else if (row.predicted) {
      row.predicted = false;
      row.probability = 0;
      row.severity = 0.04;
      row.severity_normalized_0_1 = 0.04;
      row.severity_level = "none";
      row.source = "severity_v3+demo_openai_curation_rejected";
    }
  }

  const unmatched = [...confirmedByName.keys()];
  if (unmatched.length) {
    console.warn("Confirmed issues not in severity map:", unmatched.join(", "));
  }

  severity.demo_clinical_curation = data.summary?.trim() || "OpenAI vision curation";
  if ("v3_issue_count" in severity) {
    (severity as { v3_issue_count?: number }).v3_issue_count = Object.keys(
      severity.issues,
    ).length;
  }

  return confirmedCount;
}

async function main() {
  const imageParts = IMAGE_PATHS.flatMap((rel) => {
    const abs = resolve(process.cwd(), rel);
    const label = rel.split("/").pop()?.replace(/\.JPG$/i, "") ?? rel;
    return imageContentPart(abs, label);
  });

  console.log(`Calling OpenAI (${model}) with ${IMAGE_PATHS.length} photos…`);
  console.log(`Input predicted issues: ${predictedIssues.length}`);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 4000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: buildPrompt() }, ...imageParts],
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }

  const payload = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty OpenAI response");

  const curation = parseJsonResponse(text);
  const confirmedCount = applyCuration(curation);

  const outPath = resolve(
    process.cwd(),
    "src/debug/tanya-tan-severity-scores.json",
  );
  writeFileSync(outPath, `${JSON.stringify(severity, null, 2)}\n`, "utf8");

  console.log(`✓ Confirmed ${confirmedCount} issues`);
  console.log(`✓ Summary: ${curation.summary ?? "(none)"}`);
  console.log(`Wrote ${outPath}`);
  console.log("\nNext: npx tsx scripts/revise-tanya-analysis-openai.ts");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
