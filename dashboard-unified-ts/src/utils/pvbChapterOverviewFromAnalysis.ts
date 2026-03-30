import type { TreatmentChapter } from "./blueprintTreatmentChapters";
import { patientFacingSkincareShortName } from "./pvbSkincareDisplay";
import type {
  BlueprintAnalysisOverviewSnapshot,
  PlanTreatmentRow,
} from "./postVisitBlueprintAnalysis";
import { normalizeBlueprintAnalysisText } from "./postVisitBlueprintAnalysis";

/**
 * Chapter overview copy is built from snapshot + plan rows only (no API at view time).
 * For LLM-written blurbs, extend the blueprint payload at send time or add a backend field.
 */

/** Match scan issue labels / improvements to a dashboard treatment category */
function treatmentIssueLexicon(treatment: string): RegExp | null {
  const t = treatment.trim().toLowerCase();
  if (!t) return null;
  if (t.includes("biostimul") || t === "biostimulants") {
    return /volume|collagen|fold|cheek|jowl|temple|hollow|lax|marionette|nasolabial|skin quality|texture|wrinkle|sculptra|radiesse|skin|firm|lift|midface|lower face|neck|plla|poly/i;
  }
  if (t === "filler") {
    return /volume|fold|lip|cheek|jowl|temple|hollow|marionette|nasolabial|tear|line|wrinkle|jaw|chin|lip/i;
  }
  if (t === "neurotoxin") {
    return /forehead|frown|crow|glabella|bunny|line|wrinkle|masseter|sweat|brow|perioral|neck/i;
  }
  if (t === "energy device") {
    return /pigment|tone|texture|sun|spot|redness|vascular|pore|scar|collagen|laser|bbl|moxi|firm/i;
  }
  if (t === "laser" || t.includes("laser") || t.includes("moxi")) {
    return /pigment|tone|texture|sun|spot|redness|vascular|pore|scar|collagen|laser|bbl|moxi|firm|clarity|dull/i;
  }
  if (t === "chemical peel") {
    return /pigment|tone|texture|acne|spot|melasma|pore|scar|peel|clarity|bright/i;
  }
  if (t === "microneedling") {
    return /texture|scar|pore|acne|stretch|collagen|tone|fine line|wrinkle/i;
  }
  if (t === "skincare") {
    return /hydrat|dry|barrier|pigment|tone|acne|texture|spf|sun|retin|vitamin|serum|moist/i;
  }
  if (t === "threadlift") {
    return /lift|lax|jowl|brow|neck|midface|sag/i;
  }
  if (t === "kybella") {
    return /chin|submental|fat|jaw|neck|contour/i;
  }
  if (t === "prp" || t === "pdgf") {
    return /hair|scalp|texture|tone|collagen|scar|rejuvenat/i;
  }
  return null;
}

function filterLabelsForTreatment(
  labels: string[],
  treatment: string,
): string[] {
  const re = treatmentIssueLexicon(treatment);
  if (!re) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of labels) {
    const s = normalizeBlueprintAnalysisText(raw);
    if (!s || seen.has(s.toLowerCase())) continue;
    if (!re.test(s)) continue;
    seen.add(s.toLowerCase());
    out.push(s);
  }
  return out.slice(0, 6);
}

function filterAreaImprovementsForTreatment(
  areas: BlueprintAnalysisOverviewSnapshot["areas"],
  treatment: string,
): string[] {
  const re = treatmentIssueLexicon(treatment);
  if (!re) return [];
  if (!areas?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of areas) {
    for (const im of a.improvements ?? []) {
      const s = normalizeBlueprintAnalysisText(im);
      if (!s || seen.has(s.toLowerCase())) continue;
      if (!re.test(s)) continue;
      seen.add(s.toLowerCase());
      out.push(s);
    }
  }
  return out.slice(0, 6);
}

function dedupeStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const s = normalizeBlueprintAnalysisText(raw);
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

function formatEnglishList(items: string[]): string {
  const clean = items.map((s) => s.trim()).filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0] ?? "";
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")}, and ${clean[clean.length - 1]}`;
}

/** Treatment-specific “why this modality” line when we have assessment context */
function treatmentInsightClosing(chapter: TreatmentChapter): string {
  const t = chapter.treatment.trim().toLowerCase();
  const display = chapter.displayName.trim().toLowerCase();
  const isLaserFamily =
    t === "laser" ||
    t.includes("laser") ||
    t.includes("moxi") ||
    display.includes("laser") ||
    display.includes("moxi");
  if (t.includes("biostimul") || t === "biostimulants") {
    return "Biostimulators are built for gradual collagen and structure—useful when you want change that builds over months, not just a one-time fill.";
  }
  if (t === "filler") {
    return "Fillers add volume where structure has shifted, so they’re a direct match when hollows, folds, or definition are the priority.";
  }
  if (t === "neurotoxin") {
    return "Neuromodulators target the muscle movement behind expression lines—ideal when those lines are what you notice most in photos or animation.";
  }
  if (t === "energy device") {
    return "Energy devices focus on tone, pigment, and collagen signaling—strong options when color, texture, or sun damage are central.";
  }
  if (isLaserFamily) {
    if (display.includes("moxi")) {
      return "Moxi is a gentle non-ablative laser that targets uneven tone, early pigment, and rough texture while supporting collagen remodeling with manageable downtime.";
    }
    return "Laser treatments help reset tone and texture while encouraging collagen renewal, making them a strong fit when brightness, clarity, and surface quality are priorities.";
  }
  if (t === "chemical peel") {
    return "Peels speed up surface renewal—helpful when clarity, pigment, or acne-related texture are on your list.";
  }
  if (t === "microneedling") {
    return "Microneedling creates controlled micro-injuries to stimulate repair—often chosen for texture, scars, or fine lines.";
  }
  if (t === "skincare") {
    return "Medical-grade home care extends what you do in-office and keeps results more consistent between visits.";
  }
  if (t === "threadlift") {
    return "Threads can lift and support tissue when mild laxity—not just volume loss—is the main concern.";
  }
  if (t === "kybella") {
    return "Kybella is aimed at stubborn fat under the chin when contour—not skin tightening alone—is the goal.";
  }
  return `That’s the role ${chapter.displayName} plays in a plan like yours.`;
}

function productHintSentence(chapter: TreatmentChapter): string | null {
  const isSkincare = chapter.treatment.trim().toLowerCase() === "skincare";
  const raw = chapter.planItems
    .map((i) => (i.product ?? "").trim())
    .filter(Boolean);
  if (raw.length === 0) return null;

  const products = dedupeStrings(
    isSkincare ? raw.map((p) => patientFacingSkincareShortName(p)) : raw,
  );
  if (products.length === 0) return null;

  if (products.length === 1) {
    const area = chapter.displayArea ? ` in ${chapter.displayArea}` : "";
    return `${products[0]} is the primary ${isSkincare ? "product" : "treatment"} in this chapter${area}.`;
  }

  if (isSkincare) {
    return `This chapter lists ${products.length} medical-grade home products your provider chose to work together in your routine—details are in the lines above.`;
  }

  return `Your plan combines ${formatEnglishList(products.slice(0, 3))} to address this chapter from complementary angles.`;
}

export type ChapterOverviewAnalysisInput = {
  overviewSnapshot: BlueprintAnalysisOverviewSnapshot | null;
  planRow: PlanTreatmentRow | null;
};

/** Visit + scan signals used for “what this chapter addresses” and analysis (deduped). */
export function getChapterOverviewMergedConcerns(
  chapter: TreatmentChapter,
  options: ChapterOverviewAnalysisInput | null | undefined,
): string[] {
  const treatment = chapter.treatment;
  const planRow = options?.planRow ?? null;
  const snapshot = options?.overviewSnapshot ?? null;

  const fromVisit = dedupeStrings([
    ...(planRow?.findings ?? []),
    ...(planRow?.interest ? [planRow.interest] : []),
    ...chapter.whyRecommended,
  ]);

  let fromScan: string[] = [];
  if (snapshot) {
    fromScan = dedupeStrings([
      ...filterLabelsForTreatment(
        snapshot.detectedIssueLabels ?? [],
        treatment,
      ),
      ...filterAreaImprovementsForTreatment(snapshot.areas ?? [], treatment),
    ]);
  }

  return dedupeStrings([...fromVisit, ...fromScan]).slice(0, 8);
}

export type ChapterAnalysisParagraphOptions = {
  /** True when intro already opened with an “addressing” line (e.g. display area). */
  hadExplicitAddressingSentence?: boolean;
};

/**
 * Follow-up paragraph after the chapter intro: modality “why it fits” and fallbacks when we had no concern list.
 * When `mergedConcerns` is non-empty, the intro already states what this addresses — only the modality insight remains.
 */
export function buildChapterAnalysisParagraph(
  chapter: TreatmentChapter,
  mergedConcerns: string[],
  paragraphOpts?: ChapterAnalysisParagraphOptions,
): string {
  if (mergedConcerns.length > 0) {
    return treatmentInsightClosing(chapter);
  }

  const productHint = productHintSentence(chapter);
  if (productHint) {
    return `${productHint} ${treatmentInsightClosing(chapter)}`;
  }

  if (chapter.displayArea) {
    if (paragraphOpts?.hadExplicitAddressingSentence) {
      return treatmentInsightClosing(chapter);
    }
    return `Your plan applies this to ${chapter.displayArea}. ${treatmentInsightClosing(chapter)}`;
  }

  return `Your provider matched ${chapter.displayName} to your goals and what was reviewed during your visit. ${treatmentInsightClosing(chapter)}`;
}

/**
 * Optional second sentence for intro when scan flags issues for this modality.
 */
export function maybeAppendIntroScanBridge(
  baseIntro: string,
  chapter: TreatmentChapter,
  options: ChapterOverviewAnalysisInput | null | undefined,
): string {
  const snapshot = options?.overviewSnapshot ?? null;
  if (!snapshot) return baseIntro;
  const scan = filterLabelsForTreatment(
    snapshot.detectedIssueLabels ?? [],
    chapter.treatment,
  );
  if (scan.length === 0) return baseIntro;
  return `${baseIntro} Your scan highlighted ${formatEnglishList(scan.slice(0, 3))} among the patterns that relate to this part of your plan.`;
}
