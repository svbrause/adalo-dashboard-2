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

/** Plain text for TTS — main blueprint overview (matches on-screen narrative blocks). */
export function buildPvbMainOverviewSpeechText(
  analysisDisplay: BlueprintAnalysisDisplay,
  bridgeParagraph: string | null,
  glossarySpeechAppendix?: string,
): string {
  const parts: string[] = [];

  if (analysisDisplay.overviewSnapshot) {
    parts.push(
      conciseText(analysisDisplay.overviewSnapshot.assessmentParagraph, {
        maxSentences: 2,
        maxChars: 320,
      }),
    );
    const ai = analysisDisplay.overviewSnapshot.aiNarrative?.trim();
    if (ai) {
      parts.push(
        `Additional perspective: ${conciseText(ai, {
          maxSentences: 1,
          maxChars: 220,
        })}`,
      );
    }
  } else {
    for (const row of analysisDisplay.clinicalSnapshotLines) {
      parts.push(`${row.label}: ${row.text}`);
    }
  }

  if (bridgeParagraph?.trim()) parts.push(bridgeParagraph.trim());

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

/** Paragraph strings for the typewriter (primary narrative + bridge; meta is static below). */
export function buildPvbMainOverviewTypewriterParagraphs(
  analysisDisplay: BlueprintAnalysisDisplay,
  bridgeParagraph: string | null,
): string[] {
  const out: string[] = [];

  if (analysisDisplay.overviewSnapshot) {
    const concisePrimary = conciseText(
      analysisDisplay.overviewSnapshot.assessmentParagraph,
      { maxSentences: 2, maxChars: 320 },
    );
    if (concisePrimary) out.push(concisePrimary);
    const ai = analysisDisplay.overviewSnapshot.aiNarrative?.trim();
    if (ai) {
      out.push(
        `Additional perspective: ${conciseText(ai, {
          maxSentences: 1,
          maxChars: 220,
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
  const chunks = [o.intro, ...o.planBullets, o.analysis].map((s) => s.trim()).filter(Boolean);
  let s = chunks.join(" ");
  if (glossaryTerms?.length) {
    const g = buildPvbPlanGlossarySpeechAppendix(glossaryTerms, 4);
    if (g) s = `${s} ${g}`;
  }
  return s;
}

export function buildChapterOverviewTypewriterParagraphs(o: ChapterOverviewParts): string[] {
  const lines: string[] = [];
  for (const b of o.planBullets) {
    const t = b.trim();
    if (t) lines.push(t);
  }
  lines.push(o.analysis.trim());
  return lines.filter((s) => s.length > 0);
}
