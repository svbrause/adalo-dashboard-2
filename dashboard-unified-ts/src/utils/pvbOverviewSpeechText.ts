import type { BlueprintAnalysisDisplay } from "./postVisitBlueprintAnalysis";
import {
  buildAssessmentFindingsSection,
  formatEnglishList,
  type ChapterOverviewParts,
} from "./pvbOverviewNarratives";
import type { PvbResolvedPlanGlossaryTerm } from "./pvbPlanTermGlossary";

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
      analysisDisplay.profileLabels
        .map((r) => `${r.label}, ${r.value}`)
        .join(". "),
    );
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

export type MainOverviewSection = { heading: string; text: string };

/** Structured paragraphs with section headings for the top-level Aesthetic Intelligence card. */
export function buildPvbMainOverviewSections(
  analysisDisplay: BlueprintAnalysisDisplay,
  bridgeParagraph: string | null,
  planFramingParagraphs?: string[] | null,
): MainOverviewSection[] {
  const out: MainOverviewSection[] = [];
  const framing = (planFramingParagraphs ?? [])
    .map((s) => s.trim())
    .filter(Boolean);
  const providerWhy = [framing[0], bridgeParagraph?.trim()]
    .filter(Boolean)
    .join(" ");
  const coordination = framing.slice(1).join(" ");
  const goalsLead = analysisDisplay.goals
    .map((g) => g.trim())
    .filter(Boolean)
    .slice(0, 4);
  const providerWhyWithGoals = [
    goalsLead.length > 0
      ? `Your goals are ${formatEnglishList(goalsLead)}.`
      : null,
    providerWhy,
  ]
    .filter(Boolean)
    .join(" ");

  if (providerWhyWithGoals) {
    out.push({
      heading: "Why your provider built this plan",
      text: providerWhyWithGoals,
    });
  }

  if (analysisDisplay.overviewSnapshot) {
    const findingsText = buildAssessmentFindingsSection(
      analysisDisplay.overviewSnapshot,
      analysisDisplay.goals,
    );
    if (findingsText) {
      out.push({
        heading: "What supported those recommendations",
        text: findingsText,
      });
    }
  } else {
    const fallbackSupportText = analysisDisplay.clinicalSnapshotLines
      .map((row) => `${row.label}: ${row.text}`)
      .join(" ");
    if (fallbackSupportText) {
      out.push({
        heading: "What supported those recommendations",
        text: fallbackSupportText,
      });
    }
  }

  if (coordination) {
    out.push({
      heading: "How your plan works together",
      text: coordination,
    });
  }

  return out;
}

/** Paragraph strings for the typewriter (holistic framing, primary narrative, bridge; meta is static below). */
export function buildPvbMainOverviewTypewriterParagraphs(
  analysisDisplay: BlueprintAnalysisDisplay,
  bridgeParagraph: string | null,
  planFramingParagraphs?: string[] | null,
): string[] {
  return buildPvbMainOverviewSections(
    analysisDisplay,
    bridgeParagraph,
    planFramingParagraphs,
  ).map((s) => s.text);
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
export function buildChapterOverviewTypewriterParagraphs(
  o: ChapterOverviewParts,
): string[] {
  return buildChapterOverviewTypewriterLayout(o).paragraphs;
}
