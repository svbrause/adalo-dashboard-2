/**
 * Generate cached facial-analysis AI copy for Tanya Tan using OpenAI.
 * Reads VITE_OPENAI_API_KEY from .env.local (via Vite loadEnv).
 *
 *   npx tsx scripts/revise-tanya-analysis-openai.ts
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnv } from "vite";
import {
  CATEGORIES,
  computeCategories,
  computeOverall,
  normalizeIssue,
} from "../src/config/analysisOverviewConfig";
import type { Client, DemoFacialAnalysisAi } from "../src/types";
import { getDetectedIssuesFromClient } from "../src/utils/analysisOverviewClient";
import tanyaSeverity from "../src/debug/tanya-tan-severity-scores.json";

const env = loadEnv("development", process.cwd(), "");
const apiKey = env.VITE_OPENAI_API_KEY?.trim();
const model = env.VITE_OPENAI_MODEL?.trim() || "gpt-4o-mini";

if (!apiKey) {
  console.error(
    "Missing VITE_OPENAI_API_KEY. Add it to .env.local (not .env.example).",
  );
  process.exit(1);
}

const mockClient = {
  id: "admin-demo-tanya",
  name: "Tanya Tan",
  allIssues: "",
  severityScoresFromAnalyses: tanyaSeverity,
} as Client;

const detectedIssues = getDetectedIssuesFromClient(mockClient);
const categories = computeCategories(detectedIssues);
const overall = computeOverall(categories);
const detectedList = Array.from(detectedIssues);

async function callOpenAi(prompt: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.65,
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI ${res.status}: ${body.slice(0, 400)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenAI returned empty content");
  return text;
}

function buildOverviewPrompt(): string {
  const cats = categories
    .map((c) => `${c.name}: ${c.score} (${c.tier})`)
    .join("; ");
  const issues = detectedList.join("; ");
  return `You are a caring medical aesthetics educator. Write 2–3 short paragraphs of patient-facing copy summarizing this facial analysis overview. Tone: supportive, clear, minimal jargon, no medical diagnosis or guarantees. Use "you" naturally.

Important context: Most flagged items are mild to moderate (not severe). Balance honesty about opportunities with reassurance about overall facial harmony and strengths. Mention specific findings when relevant (e.g. whiteheads, forehead lines, crow's feet) without alarmism.

Numbers are relative scores from the clinic's analysis tools, not medical tests.

Overall: ${overall}
Categories: ${cats}
Detected improvement areas: ${issues}

Output plain paragraphs only. No title line. No bullet lists unless essential.`;
}

function buildCategoryPrompt(categoryKey: string): string {
  const catResult = categories.find((c) => c.key === categoryKey);
  const catDef = CATEGORIES.find((c) => c.key === categoryKey);
  if (!catResult || !catDef) throw new Error(`Unknown category ${categoryKey}`);

  const detectedIssueNames = catDef.subScores
    .flatMap((s) => s.issues)
    .filter((issue) => detectedIssues.has(normalizeIssue(issue)));
  const strengthIssueNames = catDef.subScores
    .flatMap((s) => s.issues)
    .filter((issue) => !detectedIssues.has(normalizeIssue(issue)));

  return `Write 1–2 short paragraphs for a patient about this single facial analysis category. Tone: supportive, educational, no diagnosis or guarantees. Balance mild/moderate findings with strengths.

Category: ${catResult.name}
Score: ${catResult.score}, tier: ${catResult.tier}
Sub-scores (JSON): ${JSON.stringify(
    catResult.subScores.map((s) => ({
      name: s.name,
      score: s.score,
      detected: s.detected,
      total: s.total,
    })),
  )}
Areas flagged for attention: ${detectedIssueNames.join("; ") || "(none flagged)"}
Features in good shape (strengths): ${strengthIssueNames.slice(0, 8).join("; ") || "(general balance)"}

Plain text only. No greeting. No long disclaimer.`;
}

async function main() {
  console.log(`Generating Tanya Tan analysis copy (${model})…`);
  console.log(`Overall score: ${overall}, detected issues: ${detectedList.length}`);

  const overview = await callOpenAi(buildOverviewPrompt());
  console.log("✓ Overview");

  const categoryKeys = ["skinHealth", "volumeLoss", "proportions"] as const;
  const categoriesOut: DemoFacialAnalysisAi["categories"] = {};

  for (const key of categoryKeys) {
    categoriesOut[key] = await callOpenAi(buildCategoryPrompt(key));
    console.log(`✓ Category ${key}`);
  }

  const payload: DemoFacialAnalysisAi = {
    overview,
    categories: categoriesOut,
    generatedAt: new Date().toISOString(),
  };

  const outPath = resolve(
    process.cwd(),
    "src/debug/tanya-tan-analysis-ai.json",
  );
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
