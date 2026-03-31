/**
 * Local dev: call Gemini through Vite's `/__gemini-proxy` (see vite.config.ts).
 * Google’s API blocks browser CORS; the proxy adds the API key server-side.
 *
 * Enable with `VITE_GEMINI_API_KEY` in `.env.local`. Only runs on localhost dev/preview
 * so production builds are not left calling a missing proxy.
 */

/** Mirrors `AIAssessmentPayload` in api.ts (avoid circular import). */
export interface DevGeminiOverviewPayload {
  overall: number;
  categories: Array<{ name: string; score: number; tier: string }>;
  focusCount: number;
  detectedIssues: string[];
  patientOverviewSummary?: string;
}

/** Mirrors `CategoryAssessmentPayload` in api.ts */
export interface DevGeminiCategoryPayload {
  categoryOrArea: string;
  score: number;
  tier: string;
  subScores: Array<{
    name: string;
    score: number;
    detected: number;
    total: number;
  }>;
  detectedIssues: string[];
  strengthIssues: string[];
}

/** Inputs for treatment chapter-level overview text on Post-Visit Blueprint page. */
export interface DevGeminiTreatmentChapterPayload {
  treatment: string;
  displayName: string;
  displayArea?: string | null;
  whyRecommended: string[];
  planBullets: string[];
  findings: string[];
  interest?: string;
  detectedIssues: string[];
  focusAreas: string[];
  areaImprovements: string[];
  longevity?: string;
  downtime?: string;
  priceRange?: string;
}

const DEFAULT_MODEL = "gemini-2.0-flash";
const chapterOverviewCache = new Map<string, string | null>();
const chapterOverviewInFlight = new Map<string, Promise<string | null>>();
let geminiRateLimitedUntilMs = 0;
let openAiRateLimitedUntilMs = 0;

function devGeminiModel(): string {
  return (
    import.meta.env.VITE_GEMINI_MODEL?.trim() || DEFAULT_MODEL
  );
}

function devOpenAiModel(): string {
  return import.meta.env.VITE_OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

/** True when we should prefer the Vite Gemini proxy over the backend. */
export function shouldUseDevGeminiProxy(): boolean {
  const key = import.meta.env.VITE_GEMINI_API_KEY?.trim();
  if (!key) return false;
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}

/** Optional localhost fallback when Gemini is rate-limited. */
export function shouldUseDevOpenAiDirect(): boolean {
  const key = import.meta.env.VITE_OPENAI_API_KEY?.trim();
  if (!key) return false;
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}

function extractGeminiText(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const root = data as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
    error?: { message?: string };
  };
  if (root.error?.message) return null;
  const parts = root.candidates?.[0]?.content?.parts;
  if (!parts?.length) return null;
  const text = parts.map((p) => p.text ?? "").join("").trim();
  return text || null;
}

async function generateContentDev(prompt: string): Promise<string | null> {
  const model = devGeminiModel();
  const url = `/__gemini-proxy/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 25_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.65,
          maxOutputTokens: 2048,
        },
      }),
    });
    clearTimeout(timeout);
    if (!res.ok) {
      if (res.status === 429) {
        const retryAfterSec = Number(res.headers.get("retry-after"));
        const retryMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0
          ? retryAfterSec * 1000
          : 60_000;
        geminiRateLimitedUntilMs = Date.now() + retryMs;
      }
      return null;
    }
    const data = (await res.json()) as unknown;
    return extractGeminiText(data);
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

async function generateContentOpenAi(prompt: string): Promise<string | null> {
  if (!shouldUseDevOpenAiDirect()) return null;
  if (Date.now() < openAiRateLimitedUntilMs) return null;
  const key = import.meta.env.VITE_OPENAI_API_KEY?.trim();
  if (!key) return null;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: devOpenAiModel(),
        temperature: 0.65,
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    clearTimeout(timeout);
    if (!res.ok) {
      if (res.status === 429) {
        openAiRateLimitedUntilMs = Date.now() + 60_000;
      }
      return null;
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim() || "";
    return text || null;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

function buildOverviewPrompt(p: DevGeminiOverviewPayload): string {
  const cats = p.categories
    .map((c) => `${c.name}: ${c.score} (${c.tier})`)
    .join("; ");
  const issues = p.detectedIssues.join("; ");
  const extra = p.patientOverviewSummary?.trim()
    ? `\nExisting clinic overview to complement (do not repeat verbatim):\n${p.patientOverviewSummary.trim()}\n`
    : "";
  return `You are a caring medical aesthetics educator. Write 2–3 short paragraphs of patient-facing copy summarizing this facial analysis overview. Tone: supportive, clear, minimal jargon, no medical diagnosis or guarantees. Use "you" naturally.

Numbers are relative scores from the clinic's analysis tools, not medical tests.

Overall: ${p.overall}
Categories: ${cats}
Areas the patient marked as interest: ${p.focusCount}
Detected improvement areas: ${issues}
${extra}
Output plain paragraphs only. No title line. No bullet lists unless essential.`;
}

function buildCategoryPrompt(p: DevGeminiCategoryPayload): string {
  return `Write 1–2 short paragraphs for a patient about this single facial analysis category. Tone: supportive, educational, no diagnosis or guarantees.

Category: ${p.categoryOrArea}
Score: ${p.score}, tier: ${p.tier}
Sub-scores (JSON): ${JSON.stringify(p.subScores)}
Areas flagged for attention: ${p.detectedIssues.join("; ")}
Features in good shape (strengths): ${p.strengthIssues.join("; ")}

Plain text only. No greeting. No long disclaimer.`;
}

function buildTreatmentChapterPrompt(
  p: DevGeminiTreatmentChapterPayload,
): string {
  const contextChunks: string[] = [];
  if (p.whyRecommended.length) {
    contextChunks.push(`Why recommended: ${p.whyRecommended.join("; ")}`);
  }
  if (p.findings.length) {
    contextChunks.push(`Consult findings: ${p.findings.join("; ")}`);
  }
  if (p.interest?.trim()) {
    contextChunks.push(`Patient interest: ${p.interest.trim()}`);
  }
  if (p.detectedIssues.length) {
    contextChunks.push(
      `Detected assessment patterns: ${p.detectedIssues.slice(0, 10).join("; ")}`,
    );
  }
  if (p.areaImprovements.length) {
    contextChunks.push(
      `Area-specific improvements: ${p.areaImprovements.slice(0, 10).join("; ")}`,
    );
  }
  if (p.focusAreas.length) {
    contextChunks.push(`Focus areas: ${p.focusAreas.join("; ")}`);
  }

  const quickFacts = [
    p.longevity ? `Longevity: ${p.longevity}` : null,
    p.downtime ? `Downtime: ${p.downtime}` : null,
    p.priceRange ? `Price range: ${p.priceRange}` : null,
  ]
    .filter(Boolean)
    .join("; ");

  return `Write one concise patient-facing overview paragraph (4-6 sentences) for a treatment chapter in a cosmetic care plan.

Treatment label: ${p.displayName}
Treatment type: ${p.treatment}
Target area: ${p.displayArea || "not specified"}
Plan details: ${p.planBullets.join(" | ") || "not specified"}
Quick facts: ${quickFacts || "not specified"}
Context: ${contextChunks.join(" | ") || "none"}

Requirements:
- This paragraph sits after a short client-specific opening and a one-line modality explainer, then plan bullets, then a brief plan-level closing. Write the “why it fits this patient” layer: concrete ways this treatment moves the needle for their situation (appearance, confidence, practical expectations)—without repeating the opening “for you…” line, the one-line explainer, or the closing verbatim.
- Add nuance (mechanism, timeline, sessions, what tends to change first) rather than restating the same concern list.
- Use at least 2 specific context details from the inputs.
- Include a practical expectation (timeline, sessions, downtime, or maintenance) when possible.
- Keep tone warm, specific, and insightful; avoid generic filler language.
- Do NOT use bullets, headings, emojis, or diagnosis claims.
- Output plain text only.`;
}

export async function fetchAIAssessmentViaDevGemini(
  payload: DevGeminiOverviewPayload,
): Promise<string | null> {
  if (!shouldUseDevGeminiProxy()) return null;
  return generateContentDev(buildOverviewPrompt(payload));
}

export async function fetchCategoryAssessmentViaDevGemini(
  payload: DevGeminiCategoryPayload,
): Promise<string | null> {
  if (!shouldUseDevGeminiProxy()) return null;
  return generateContentDev(buildCategoryPrompt(payload));
}

export async function fetchTreatmentChapterOverviewViaDevGemini(
  payload: DevGeminiTreatmentChapterPayload,
): Promise<string | null> {
  const canUseGemini = shouldUseDevGeminiProxy();
  const canUseOpenAi = shouldUseDevOpenAiDirect();
  if (!canUseGemini && !canUseOpenAi) return null;
  const cacheKey = JSON.stringify({
    provider: canUseGemini ? "gemini-first" : "openai-only",
    model: devGeminiModel(),
    openAiModel: devOpenAiModel(),
    ...payload,
  });
  if (chapterOverviewCache.has(cacheKey)) {
    return chapterOverviewCache.get(cacheKey) ?? null;
  }
  const existing = chapterOverviewInFlight.get(cacheKey);
  if (existing) return existing;

  const pending = (async (): Promise<string | null> => {
    const prompt = buildTreatmentChapterPrompt(payload);
    let text: string | null = null;

    // Prefer Gemini, then fail over to OpenAI when Gemini is quota/rate-limited.
    if (canUseGemini && Date.now() >= geminiRateLimitedUntilMs) {
      text = await generateContentDev(prompt);
    }
    if (!text && canUseOpenAi) {
      text = await generateContentOpenAi(prompt);
    }

    if (!text) {
      // Cache failures briefly to avoid hammering Gemini in React StrictMode/double effects.
      chapterOverviewCache.set(cacheKey, null);
      return null;
    }
    const normalized = text.replace(/\s+/g, " ").trim();
    if (!normalized) {
      chapterOverviewCache.set(cacheKey, null);
      return null;
    }
    const result =
      normalized.length > 900 ? `${normalized.slice(0, 900).trimEnd()}…` : normalized;
    chapterOverviewCache.set(cacheKey, result);
    return result;
  })();

  chapterOverviewInFlight.set(cacheKey, pending);
  try {
    return await pending;
  } finally {
    chapterOverviewInFlight.delete(cacheKey);
  }
}
