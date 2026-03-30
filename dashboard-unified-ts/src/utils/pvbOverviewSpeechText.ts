import type { BlueprintAnalysisDisplay } from "./postVisitBlueprintAnalysis";
import type { ChapterOverviewParts } from "./pvbOverviewNarratives";
import type { PvbResolvedPlanGlossaryTerm } from "./pvbPlanTermGlossary";

function normalizeSpaces(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function takeFirstSentences(text: string, maxSentences: number): string {
  const clean = normalizeSpaces(text);
  if (!clean) return "";
  const parts = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (parts.length <= maxSentences) return clean;
  return parts.slice(0, maxSentences).join(" ");
}

function conciseText(text: string, opts?: { maxSentences?: number; maxChars?: number }): string {
  const maxSentences = opts?.maxSentences ?? 2;
  const maxChars = opts?.maxChars ?? 320;
  const bySentence = takeFirstSentences(text, maxSentences);
  if (bySentence.length <= maxChars) return bySentence;
  return `${bySentence.slice(0, maxChars - 1).trimEnd()}…`;
}

/** Short spoken definitions for matched plan terms (keeps listen length reasonable). */
export function buildPvbPlanGlossarySpeechAppendix(
  terms: PvbResolvedPlanGlossaryTerm[],
  maxTerms = 4,
): string {
  if (!terms.length) return "";
  const slice = terms.slice(0, maxTerms);
  const chunks = slice.map((t) => {
    const r = t.relationToYou?.trim();
    return r ? `${t.title}: ${t.body} ${r}` : `${t.title}: ${t.body}`;
  });
  let s = `Terms from your plan: ${chunks.join(" ")}`;
  if (terms.length > maxTerms) s += " More definitions are on screen.";
  return s;
}

function stripOverallScoreLanguage(text: string): string {
  const clean = normalizeSpaces(text);
  if (!clean) return "";
  const parts = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  const kept = parts.filter((raw) => {
    const t = raw.toLowerCase();
    if (t.includes("overall aesthetic score")) return false;
    if (t.includes("overall assessment")) return false;
    if (t.includes("overall score")) return false;
    if (/overall\s*[:\-]?\s*\d+/.test(t)) return false;
    return true;
  });
  return kept.join(" ").trim();
}

/** Plain text for TTS — main blueprint overview (matches on-screen narrative blocks). */
export function buildPvbMainOverviewSpeechText(
  analysisDisplay: BlueprintAnalysisDisplay,
  bridgeParagraph: string | null,
  planFramingParagraphs?: string[] | null,
  glossarySpeechAppendix?: string,
): string {
  const parts: string[] = [];

  /** Same strings and order as {@link buildPvbMainOverviewTypewriterParagraphs} (then meta below). */
  const narrativeParas = buildPvbMainOverviewTypewriterParagraphs(
    analysisDisplay,
    bridgeParagraph,
    planFramingParagraphs,
  );
  if (narrativeParas.length > 0) {
    parts.push(narrativeParas.join(". "));
  }

  if (analysisDisplay.profileLabels.length > 0) {
    parts.push(
      analysisDisplay.profileLabels.map((r) => `${r.label}, ${r.value}`).join(". "),
    );
  }
  if (analysisDisplay.goals.length > 0) {
    parts.push(`Your focus: ${analysisDisplay.goals.join(", ")}`);
  }
  const { interests, findings } = analysisDisplay.globalPlanInsights;
  if (interests.length > 0) {
    parts.push(`Interests discussed: ${interests.join(", ")}`);
  }
  if (findings.length > 0) {
    parts.push(`Observations: ${findings.join(", ")}`);
  }

  if (glossarySpeechAppendix?.trim()) {
    parts.push(glossarySpeechAppendix.trim());
  }

  return parts.filter(Boolean).join(" ");
}

/** Paragraph strings for the typewriter (holistic framing, primary narrative, bridge; meta is static below). */
export function buildPvbMainOverviewTypewriterParagraphs(
  analysisDisplay: BlueprintAnalysisDisplay,
  bridgeParagraph: string | null,
  planFramingParagraphs?: string[] | null,
): string[] {
  const out: string[] = [];

  for (const block of planFramingParagraphs ?? []) {
    const t = block.trim();
    if (t) out.push(t);
  }

  if (analysisDisplay.overviewSnapshot) {
    const concisePrimary = conciseText(
      stripOverallScoreLanguage(analysisDisplay.overviewSnapshot.assessmentParagraph),
      { maxSentences: 1, maxChars: 220 },
    );
    if (concisePrimary) out.push(concisePrimary);
    const ai = stripOverallScoreLanguage(
      analysisDisplay.overviewSnapshot.aiNarrative?.trim() ?? "",
    );
    if (ai) {
      out.push(
        `Additional perspective: ${conciseText(ai, {
          maxSentences: 1,
          maxChars: 170,
        })}`,
      );
    }
  } else {
    for (const row of analysisDisplay.clinicalSnapshotLines) {
      out.push(`${row.label}: ${row.text}`);
    }
  }

  if (bridgeParagraph?.trim()) out.push(bridgeParagraph.trim());

  return out.filter((s) => s.trim().length > 0);
}

export function buildChapterOverviewSpeechText(
  o: ChapterOverviewParts,
  glossaryTerms?: PvbResolvedPlanGlossaryTerm[],
): string {
  const paras = buildChapterOverviewTypewriterParagraphs(o);
  let s = paras.join(". ");
  if (glossaryTerms?.length) {
    const g = buildPvbPlanGlossarySpeechAppendix(glossaryTerms, 4);
    if (g) s = `${s} ${g}`;
  }
  return s;
}

export type ChapterOverviewTypewriterRole =
  | { kind: "top" }
  | { kind: "intro" }
  | { kind: "bullet"; bulletIndex: number }
  | { kind: "analysis" }
  | { kind: "bottom" };

/** Paragraph strings + roles for the chapter typewriter (keeps bullet indices correct when some lines are empty). */
export function buildChapterOverviewTypewriterLayout(o: ChapterOverviewParts): {
  paragraphs: string[];
  roles: ChapterOverviewTypewriterRole[];
} {
  const paragraphs: string[] = [];
  const roles: ChapterOverviewTypewriterRole[] = [];
  const top = o.complementTop?.trim();
  if (top) {
    paragraphs.push(top);
    roles.push({ kind: "top" });
  }
  const intro = o.intro.trim();
  if (intro) {
    paragraphs.push(intro);
    roles.push({ kind: "intro" });
  }
  o.planBullets.forEach((b, i) => {
    const t = b.trim();
    if (!t) return;
    paragraphs.push(t);
    roles.push({ kind: "bullet", bulletIndex: i });
  });
  const analysis = o.analysis.trim();
  if (analysis) {
    paragraphs.push(analysis);
    roles.push({ kind: "analysis" });
  }
  const bottom = o.complementBottom?.trim();
  if (bottom) {
    paragraphs.push(bottom);
    roles.push({ kind: "bottom" });
  }
  return { paragraphs, roles };
}

/**
 * Order matches the chapter overview typewriter:
 * complement top → intro → plan bullets → analysis → complement bottom (“complement sandwich”).
 */
export function buildChapterOverviewTypewriterParagraphs(o: ChapterOverviewParts): string[] {
  return buildChapterOverviewTypewriterLayout(o).paragraphs;
}
