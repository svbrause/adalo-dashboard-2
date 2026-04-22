import type { DiscussedItem } from "../types";
import type { TreatmentChapter } from "./blueprintTreatmentChapters";
import type {
  BlueprintAnalysisOverviewSnapshot,
  PlanTreatmentRow,
} from "./postVisitBlueprintAnalysis";
import {
  formatTreatmentPlanRecordMetaLine,
  getCheckoutDisplayName,
  getDisplayAreaForItem,
  getPlanQuantityLabelPrefix,
  TREATMENT_PLAN_BULLET,
} from "../components/modals/DiscussedTreatmentsModal/utils";
import { patientFacingSkincareShortName } from "./pvbSkincareDisplay";
import {
  buildChapterAnalysisParagraph,
  getChapterOverviewMergedConcerns,
  maybeAppendIntroScanBridge,
  type ChapterOverviewAnalysisInput,
} from "./pvbChapterOverviewFromAnalysis";
import {
  ENERGY_TREATMENT_CATEGORY,
  LEGACY_ENERGY_DEVICE_CATEGORY,
  canonicalPlanTreatmentName,
} from "../components/modals/DiscussedTreatmentsModal/constants";
import { chapterTreatmentNormKey } from "./pvbChapterSchedule";

/**
 * Meta line for blueprint “What’s included” — for Other procedures / Energy Treatment sub-chapters,
 * omit the full multi-type `product` string; the chapter title is already the procedure name.
 */
function formatChapterPlanMetaLine(
  item: DiscussedItem,
  chapter: TreatmentChapter,
): string {
  const eb = chapterTreatmentNormKey(ENERGY_TREATMENT_CATEGORY);
  const isOpSub =
    chapter.key.startsWith("other procedures::") &&
    (item.treatment ?? "").trim() === "Other procedures";
  const isEnergySub =
    chapter.key.startsWith(`${eb}::`) &&
    ((item.treatment ?? "").trim() === ENERGY_TREATMENT_CATEGORY ||
      (item.treatment ?? "").trim() === LEGACY_ENERGY_DEVICE_CATEGORY);
  if (!isOpSub && !isEnergySub) return formatTreatmentPlanRecordMetaLine(item);
  const parts: string[] = [];
  const area = getDisplayAreaForItem(item);
  if (area) parts.push(area);
  const qLabel = getPlanQuantityLabelPrefix(
    item.treatment,
    chapter.displayName,
  );
  if (item.quantity && String(item.quantity).trim()) {
    parts.push(`${qLabel}: ${item.quantity}`);
  }
  return parts.join(TREATMENT_PLAN_BULLET);
}

/** One plan line for chapter overview: skincare uses short names and avoids repeating product in meta. */
function buildChapterPlanBulletLine(
  item: DiscussedItem,
  chapter: TreatmentChapter,
): string {
  const isSkincare = (item.treatment ?? "").trim().toLowerCase() === "skincare";
  const eb = chapterTreatmentNormKey(ENERGY_TREATMENT_CATEGORY);
  const isOpSub =
    chapter.key.startsWith("other procedures::") &&
    (item.treatment ?? "").trim() === "Other procedures";
  const isEnergySub =
    chapter.key.startsWith(`${eb}::`) &&
    ((item.treatment ?? "").trim() === ENERGY_TREATMENT_CATEGORY ||
      (item.treatment ?? "").trim() === LEGACY_ENERGY_DEVICE_CATEGORY);

  const rawLabel = isOpSub || isEnergySub
    ? chapter.displayName
    : getCheckoutDisplayName(item);
  const label = isSkincare
    ? patientFacingSkincareShortName(rawLabel)
    : rawLabel;
  if (!isSkincare) {
    const meta = formatChapterPlanMetaLine(item, chapter);
    return meta ? `${label} — ${meta}` : label;
  }
  const area = getDisplayAreaForItem(item);
  const metaParts: string[] = [];
  if (area) metaParts.push(area);
  if (item.quantity && String(item.quantity).trim()) {
    const qLabel = getPlanQuantityLabelPrefix(item.treatment, undefined);
    metaParts.push(`${qLabel}: ${item.quantity}`);
  }
  const meta = metaParts.join(TREATMENT_PLAN_BULLET);
  return meta ? `${label} — ${meta}` : label;
}

export function formatEnglishList(items: string[]): string {
  const clean = items.map((s) => s.trim()).filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0] ?? "";
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")}, and ${clean[clean.length - 1]}`;
}

/**
 * Turn treatment display-area labels (e.g. "Forehead", "Lower face") into natural in-sentence phrases.
 */
function formatAreaLabelsForProse(areas: string[]): string {
  return formatEnglishList(
    areas.map((a) => {
      const t = a.trim();
      if (!t) return t;
      if (/^(the|your)\s+/i.test(t)) return t;
      return `the ${t.charAt(0).toLowerCase()}${t.slice(1)}`;
    }),
  );
}

/** One short sentence: what this category does technically (after the client-specific lead). */
const TREATMENT_CATEGORY_INTRO: Partial<Record<string, string>> = {
  Skincare: "It supports your home routine and helps maintain your in-office results.",
  "Energy Treatment":
    "It uses light or gentle heat to improve skin tone, texture, and collagen production.",
  Laser:
    "It refreshes tone and texture while encouraging collagen renewal over a series of sessions.",
  "Chemical Peel": "It speeds up surface renewal for better clarity and smoother fine lines.",
  Microneedling:
    "It stimulates collagen\u2014often paired with topicals to help with texture and scarring.",
  Filler: "It restores volume and contour in areas where structure has shifted over time.",
  Neurotoxin: "It softens expression lines by relaxing the muscles that cause them.",
  Biostimulants: "It encourages your skin to gradually rebuild collagen and structure on its own.",
  Kybella: "It reduces stubborn fat pockets, most often under the chin.",
  Threadlift: "It provides lift and support in areas with mild sagging.",
  PRP: "It uses your body\u2019s own growth factors to support skin rejuvenation.",
  PDGF: "It supports tissue repair and skin quality in targeted areas.",
  "Facial Services":
    "It uses professional cleansing, exfoliation, and targeted esthetic steps to clarify, calm, or refresh the skin based on what your provider selected.",
  /** Catch-all when the plan lists the category without a specific procedure type. */
  "Other procedures":
    "It covers focused add-ons and small in-office services that support your main treatments or address something specific from your visit.",
};

const OTHER_PLAN_CATEGORY = "Other procedures";

/**
 * Normalized labels for {@link getOtherProcedureTypesFromPriceList} and common variants.
 * Keys must be lowercase single-spaced (see {@link normalizeHowItWorksLabel}).
 */
const OTHER_PROCEDURE_HOW_IT_WORKS_BY_LABEL: Record<string, string> = {
  "prfm injections":
    "It uses growth-factor concentrate from your own blood—prepared in office—to support repair and skin quality where it’s injected.",
  "prfm scalp (hair restoration)":
    "It applies growth-factor concentrate to the scalp to support follicle health and hair restoration as part of a broader plan.",
  "skinvive (skin booster)":
    "It places tiny microdroplets of hyaluronic acid in the skin to boost hydration, smoothness, and glow without adding volume like a traditional filler.",
  "pronox treatment":
    "It uses inhaled nitrous oxide during treatment to ease anxiety and make procedures more comfortable.",
  "vitamin b-12 shot":
    "It delivers vitamin B12 by injection when your provider wants a reliable boost beyond what diet alone may provide.",
  "cortisone shot":
    "It delivers a small dose of corticosteroid into a focused spot to quickly calm inflammation from a cyst, painful breakout, or keloid.",
  "zapping treatment (milia/sebaceous hyperplasia)":
    "It treats tiny surface cysts or overgrown oil glands with a quick, targeted in-office procedure.",
  "light stim add-on":
    "It uses LED light during or after skincare to support calmness, clarity, or healing depending on the setting your team chose.",
  "nerve block":
    "It uses a brief, targeted numbing injection so a procedure or recovery phase is more comfortable.",
  "spider vein treatment":
    "It treats small surface vessels—often on the legs—with an injected medicine that helps them fade over time.",
  "spider vein treatment package (3)":
    "It treats small surface vessels—often on the legs—with an injected medicine that helps them fade over time, typically as a short series.",
};

function normalizeHowItWorksLabel(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * "How it works" for **Other procedures** rows: exact label from the price list, then fuzzy
 * matches (e.g. "Skinvive II" → Skinvive copy).
 */
function otherProcedureHowItWorksIntro(displayName: string): string | null {
  const n = normalizeHowItWorksLabel(displayName);
  if (!n) return null;

  const direct = OTHER_PROCEDURE_HOW_IT_WORKS_BY_LABEL[n];
  if (direct) return direct;

  if (/\bskinvive\b/i.test(displayName)) {
    return OTHER_PROCEDURE_HOW_IT_WORKS_BY_LABEL["skinvive (skin booster)"]!;
  }
  if (/prfm/i.test(n) && /scalp|hair/i.test(n)) {
    return OTHER_PROCEDURE_HOW_IT_WORKS_BY_LABEL["prfm scalp (hair restoration)"]!;
  }
  if (/prfm/i.test(n)) {
    return OTHER_PROCEDURE_HOW_IT_WORKS_BY_LABEL["prfm injections"]!;
  }
  if (/cortisone/i.test(n)) {
    return OTHER_PROCEDURE_HOW_IT_WORKS_BY_LABEL["cortisone shot"]!;
  }
  if (/nerve\s*block/i.test(n)) {
    return OTHER_PROCEDURE_HOW_IT_WORKS_BY_LABEL["nerve block"]!;
  }
  if (/spider\s*vein/i.test(n)) {
    return OTHER_PROCEDURE_HOW_IT_WORKS_BY_LABEL["spider vein treatment"]!;
  }
  if (/pronox/i.test(n)) {
    return OTHER_PROCEDURE_HOW_IT_WORKS_BY_LABEL["pronox treatment"]!;
  }
  if (/b[-\s]?12|b12/i.test(n) && /shot|injection|inject/i.test(n)) {
    return OTHER_PROCEDURE_HOW_IT_WORKS_BY_LABEL["vitamin b-12 shot"]!;
  }
  if (/zapping|milia|sebaceous\s*hyperplasia/i.test(n)) {
    return OTHER_PROCEDURE_HOW_IT_WORKS_BY_LABEL[
      "zapping treatment (milia/sebaceous hyperplasia)"
    ]!;
  }
  if (/light\s*stim/i.test(n)) {
    return OTHER_PROCEDURE_HOW_IT_WORKS_BY_LABEL["light stim add-on"]!;
  }

  return null;
}

const OTHER_PROCEDURE_UNKNOWN_INTRO =
  "It’s an in-office service your provider matched to a specific concern or comfort need from your visit.";

/**
 * Resolves the first "How it works" sentence. Sub-chapters under **Other procedures** used to
 * fall through to "focused on {displayName}" because `chapter.treatment` stays the category name.
 */
function resolveHowItWorksIntro(chapter: TreatmentChapter): string {
  const canon = canonicalPlanTreatmentName(chapter.treatment);
  const dn = chapter.displayName.trim();
  const dnLower = dn.toLowerCase();

  if (canon === OTHER_PLAN_CATEGORY) {
    const baseKey = chapterTreatmentNormKey(OTHER_PLAN_CATEGORY);
    const isCategoryOnlyRow =
      chapter.key === baseKey &&
      (dnLower === baseKey || dnLower === OTHER_PLAN_CATEGORY.toLowerCase());
    if (isCategoryOnlyRow) {
      return (
        TREATMENT_CATEGORY_INTRO[OTHER_PLAN_CATEGORY] ??
        OTHER_PROCEDURE_UNKNOWN_INTRO
      );
    }

    const specific = otherProcedureHowItWorksIntro(dn);
    if (specific) return specific;

    return OTHER_PROCEDURE_UNKNOWN_INTRO;
  }

  const fromCategory =
    TREATMENT_CATEGORY_INTRO[chapter.treatment] ??
    TREATMENT_CATEGORY_INTRO[canon];
  if (fromCategory) return fromCategory;

  return `It's the part of your plan focused on ${dn}.`;
}

/**
 * Top-of-page copy: connects listed chapters to scan findings / focus areas / visit themes.
 */
export function buildPvbPlanBridgeParagraph(
  chapterDisplayNames: string[],
  snapshot: BlueprintAnalysisOverviewSnapshot | null,
  globalInsights: { interests: string[]; findings: string[] },
): string | null {
  if (chapterDisplayNames.length === 0) return null;
  const list = formatEnglishList(chapterDisplayNames);
  const out: string[] = [];
  out.push(
    `Your blueprint includes ${list}, so you can see what each step is meant to do and how the plan comes together.`,
  );

  const findingParts: string[] = [];
  if (snapshot?.detectedIssueLabels?.length) {
    findingParts.push(...snapshot.detectedIssueLabels.slice(0, 8));
  }
  for (const f of globalInsights.findings.slice(0, 6)) {
    const t = f.trim();
    if (t && !findingParts.some((x) => x.toLowerCase() === t.toLowerCase())) {
      findingParts.push(t);
    }
  }

  const focusNames =
    snapshot?.areas?.filter((a) => a.hasInterest).map((a) => a.name) ?? [];
  const extraInterests = globalInsights.interests.slice(0, 6);

  if (findingParts.length) {
    const framing = frameIssuesForOverview(findingParts);
    if (focusNames.length) {
      if (framing.kind === "broad") {
        out.push(
          `These were chosen to ${framing.summary} in the areas you and your provider decided to prioritize during your visit.`,
        );
      } else {
        out.push(
          `These were chosen to ${formatEnglishList(framing.items)} in the areas you and your provider decided to prioritize during your visit.`,
        );
      }
    } else {
      if (framing.kind === "broad") {
        out.push(
          `These were chosen to ${framing.summary} in the areas your provider felt made the most sense to prioritize during your visit.`,
        );
      } else {
        out.push(
          `These were chosen to ${formatEnglishList(framing.items)} in the areas your provider felt made the most sense to prioritize during your visit.`,
        );
      }
    }
  } else if (focusNames.length) {
    out.push(
      `These recommendations stay focused on what you wanted to prioritize during your visit.`,
    );
  } else if (extraInterests.length) {
    out.push(
      `They reflect the priorities you discussed during your visit: ${formatEnglishList(extraInterests)}.`,
    );
  }

  return out.join(" ");
}

/** Shape of the patient's chapter list\u2014drives holistic "whole plan" framing copy. */
export type PvbMainOverviewPlanShape = {
  chapterCount: number;
  /** Plan includes a Skincare chapter (home regimen / products). */
  includesSkincare: boolean;
  /** At least one non-skincare treatment chapter (procedures, injectables, devices, etc.). */
  includesInOfficeOrProcedures: boolean;
};

export type PvbMainOverviewPersonalization = {
  goals?: string[];
  findings?: string[];
  focusAreas?: string[];
  chapterNames?: string[];
  /** Per-item interests from discussed items (e.g. "wrinkle prevention", "hydration"). */
  interests?: string[];
  /** Per-item display areas (e.g. "forehead", "lower face"). */
  displayAreas?: string[];
  patientFirstName?: string;
  ageRange?: string | null;
  skinType?: string | null;
};

function dedupeText(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const t = raw.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

/** When every focus-area label is already named in goals, skip repeating the list in prose. */
function focusAreasRedundantWithGoals(goals: string[], focus: string[]): boolean {
  if (focus.length === 0) return true;
  const goalSet = new Set(
    goals.map((g) => g.trim().toLowerCase()).filter(Boolean),
  );
  if (goalSet.size === 0) return false;
  return focus.every((f) => goalSet.has(f.trim().toLowerCase()));
}

// \u2500\u2500 High-level overview: constructive / aspirational issue framing \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
//
// The top-of-page overview uses positive, solution-oriented language ("smooth
// fine lines on the forehead") instead of clinical issue labels ("forehead
// wrinkles"). When the combined issue list is long (4+), it collapses to broad
// framing ("comprehensive rejuvenation") rather than enumerating every finding.
// Per-chapter overviews keep the specific issue language.

const OVERVIEW_BROAD_THRESHOLD = 4;

const SURFACE_RE =
  /pigment|texture|tone|pore|redness|rosacea|clarity|bright|sun|acne|scar|dull|spot|melasma|vascular|barrier|hydrat|dry/i;
const STRUCTURAL_RE =
  /volume|hollow|fold|nasolabial|marionette|sag|lax|jowl|contour|structure/i;
const LINES_RE =
  /wrinkle|fine\s*line|crow|frown|expression\s*line|forehead\s*line|glabella|bunny/i;

function issueCategory(
  s: string,
): "surface" | "structural" | "lines" | "other" {
  if (SURFACE_RE.test(s)) return "surface";
  if (STRUCTURAL_RE.test(s)) return "structural";
  if (LINES_RE.test(s)) return "lines";
  return "other";
}

function broadFramingSummary(issues: string[]): string {
  const cats = new Set(issues.map(issueCategory));
  cats.delete("other");
  if (cats.size >= 2) return "refresh your overall appearance from multiple angles";
  if (cats.has("surface")) return "improve overall skin quality and clarity";
  if (cats.has("structural")) return "restore support, volume, and definition";
  if (cats.has("lines")) return "soften lines and wrinkles";
  return "refresh your overall appearance";
}

const CONSTRUCTIVE_REFRAME: [RegExp, string][] = [
  [/forehead\s+wrinkle/i, "smooth forehead lines"],
  [/crow['\u2019]?s?\s*feet/i, "soften lines around the eyes"],
  [/frown\s+line|glabella/i, "smooth frown lines"],
  [/wrinkle/i, "smooth fine lines"],
  [/fine\s*line/i, "soften fine lines"],
  [/sun\s+damage|sun\s*spot/i, "address sun-related changes"],
  [/pigment|hyperpigment|dark\s*spot|age\s*spot/i, "even out skin tone"],
  [/melasma/i, "even out discoloration"],
  [/volume\s+loss/i, "restore natural volume"],
  [/hollow/i, "restore fullness"],
  [/nasolabial/i, "soften deeper lines around the nose and mouth"],
  [/marionette/i, "soften lines around the mouth"],
  [/sag|lax/i, "improve firmness and lift"],
  [/texture/i, "refine skin texture"],
  [/acne\s*scar/i, "smooth acne-related texture"],
  [/scar/i, "improve scarring"],
  [/pore/i, "minimize pore appearance"],
  [/redness|rosacea|vascular/i, "calm redness"],
  [/tone/i, "even skin tone"],
  [/dull|bright|clar/i, "brighten the complexion"],
  [/firm|tight|elastic/i, "improve firmness"],
  [/collagen/i, "support collagen renewal"],
  [/jowl/i, "refine the jawline"],
  [/jaw/i, "define the jawline"],
  [/neck/i, "address the neck area"],
  [/under.?eye|tear\s*trough/i, "refresh the under-eye area"],
  [/lip/i, "enhance the lips"],
  [/chin|submental/i, "refine the chin and profile"],
  [/brow/i, "lift the brow area"],
];

function reframeIssue(issue: string): string {
  const t = issue.trim();
  if (!t) return t;
  for (const [re, replacement] of CONSTRUCTIVE_REFRAME) {
    if (re.test(t)) return replacement;
  }
  return `address ${t.charAt(0).toLowerCase()}${t.slice(1)}`;
}

type OverviewFraming =
  | { kind: "broad"; summary: string }
  | { kind: "specific"; items: string[] };

function frameIssuesForOverview(issues: string[]): OverviewFraming {
  const clean = issues.filter((s) => s.trim());
  if (clean.length >= OVERVIEW_BROAD_THRESHOLD) {
    return { kind: "broad", summary: broadFramingSummary(clean) };
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const issue of clean) {
    const r = reframeIssue(issue);
    const k = r.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(r);
    }
  }
  return { kind: "specific", items: out };
}

/**
 * Opening copy for the top "Personalized Treatment Overview": emphasizes that this is one
 * coordinated plan (home care, maintenance, aesthetics) rather than disconnected items.
 * Returns two short paragraphs so the typewriter paces them separately.
 */
export function buildPvbMainPlanFramingParagraphs(
  shape: PvbMainOverviewPlanShape,
  personalization?: PvbMainOverviewPersonalization | null,
): string[] {
  if (shape.chapterCount <= 0) return [];

  const goals = dedupeText(personalization?.goals ?? []).slice(0, 3);
  const findings = dedupeText(personalization?.findings ?? []).slice(0, 5);
  const focus = dedupeText(personalization?.focusAreas ?? []).slice(0, 2);
  const interests = dedupeText(personalization?.interests ?? []).slice(0, 3);
  const areas = dedupeText(personalization?.displayAreas ?? []).slice(0, 4);
  const namedChapters = dedupeText(personalization?.chapterNames ?? []).slice(
    0,
    4,
  );
  const ageRange = personalization?.ageRange?.trim() || "";
  const skinType = personalization?.skinType?.trim() || "";

  let open: string;
  if (goals.length > 0 && findings.length > 0) {
    const framing = frameIssuesForOverview(findings);
    if (framing.kind === "broad") {
      open = `Your provider built this plan around ${formatEnglishList(goals)}, choosing treatments meant to ${framing.summary}.`;
    } else {
      open = `Your provider built this plan around ${formatEnglishList(goals)}, choosing treatments meant to ${formatEnglishList(framing.items)}.`;
    }
  } else if (goals.length > 0) {
    const focusTail =
      focus.length > 0 && !focusAreasRedundantWithGoals(goals, focus)
        ? ` They gave extra attention to ${formatEnglishList(focus)}.`
        : "";
    open = `Your provider built this plan around ${formatEnglishList(goals)}.${focusTail}`;
  } else if (findings.length > 0 && areas.length > 0) {
    const areasPhrase = formatAreaLabelsForProse(areas);
    const framing = frameIssuesForOverview(findings);
    if (framing.kind === "broad") {
      open = `Your provider focused this plan on ${areasPhrase}, with treatments chosen to ${framing.summary}.`;
    } else {
      open = `Your provider focused this plan on ${areasPhrase}, with treatments chosen to ${formatEnglishList(framing.items)}.`;
    }
  } else if (findings.length > 0) {
    const framing = frameIssuesForOverview(findings);
    if (framing.kind === "broad") {
      open = `Your provider chose these treatments to ${framing.summary}.`;
    } else {
      open = `Your provider chose these treatments to ${formatEnglishList(framing.items)}.`;
    }
  } else if (interests.length > 0 && areas.length > 0) {
    open = `Your provider selected treatments for ${formatEnglishList(interests)} across ${formatAreaLabelsForProse(areas)}.`;
  } else if (interests.length > 0) {
    open = `Your provider built this plan around the priorities that came up during your visit: ${formatEnglishList(interests)}.`;
  } else if (areas.length > 0) {
    open = `Your provider centered this plan on ${formatAreaLabelsForProse(areas)} because those were the areas that made the most sense to prioritize during your visit.`;
  } else if (namedChapters.length > 0) {
    open = `Your provider put together a plan covering ${formatEnglishList(namedChapters)}, based on what you discussed during your visit.`;
  } else {
    open = `Your provider put together this plan based on what you discussed during your visit.`;
  }

  const profileParts: string[] = [];
  if (ageRange) profileParts.push(ageRange);
  if (skinType) profileParts.push(`${skinType} skin`);
  const profileNote =
    profileParts.length > 0
      ? ` The products and treatment mix were chosen with your profile in mind (${profileParts.join(", ")}).`
      : "";

  let bridge: string;
  if (shape.includesSkincare && shape.includesInOfficeOrProcedures) {
    bridge = `Your plan starts with medical-grade skincare as your daily foundation, then layers in in-office treatments so each step builds on the others and keeps momentum going between visits.${profileNote}`;
  } else if (shape.includesSkincare) {
    bridge = `Your plan centers on a strong at-home skincare routine, because steady daily care is what keeps results building and helps maintain progress over time.${profileNote}`;
  } else if (shape.includesInOfficeOrProcedures) {
    bridge = `Your plan combines in-office treatments that each play a different role, so the results build in a coordinated way over time.${profileNote}`;
  } else {
    bridge = `Each part of the plan works toward the same goals, so the path forward feels clear instead of pieced together.${profileNote}`;
  }

  return [open, bridge];
}

export type ChapterOverviewParts = {
  /** Client-first line: how this chapter applies to this patient (not generic modality marketing). */
  complementTop?: string;
  /** Short modality explainer after the client lead. */
  intro: string;
  planBullets: string[];
  analysis: string;
  /** Tie-back to the coordinated plan and other chapters. */
  complementBottom?: string;
};

export type ChapterOverviewBuildOptions = {
  overviewSnapshot: BlueprintAnalysisOverviewSnapshot | null;
  planRow: PlanTreatmentRow | null;
};

/** Per-chapter context to generate complement-sandwich bookends (top + bottom around the core overview). */
export type ChapterComplementSandwichContext = {
  chapterIndex: number;
  totalChapters: number;
  /** Display names in plan order (same order as TOC chapters). */
  allChapterDisplayNames: string[];
  planShape: PvbMainOverviewPlanShape;
  /** Patient-specific priorities from the overview (goals/findings/focus). */
  patientPriorities?: string[];
};

function planPillarPhraseForComplement(
  planShape: PvbMainOverviewPlanShape,
): string {
  if (planShape.includesSkincare && planShape.includesInOfficeOrProcedures) {
    return "your home routine and in-office treatments";
  }
  if (planShape.includesSkincare && !planShape.includesInOfficeOrProcedures) {
    return "your at-home care";
  }
  if (!planShape.includesSkincare && planShape.includesInOfficeOrProcedures) {
    return "your in-office treatments";
  }
  return "the rest of your plan";
}

/** Single-token treatment areas — avoid “goal of Forehead” (anatomy isn’t a “goal”). */
const PRIORITY_SINGLE_TOKEN_AREA = new Set([
  "forehead",
  "frown",
  "glabella",
  "brow",
  "brows",
  "temple",
  "temples",
  "cheek",
  "cheeks",
  "midface",
  "jaw",
  "chin",
  "neck",
  "chest",
  "face",
  "nose",
  "lip",
  "lips",
  "eye",
  "eyes",
  "perioral",
  "hand",
  "hands",
  "jowl",
  "jowls",
  "décolleté",
  "decollete",
]);

function areaPhraseForPriorityBridge(lower: string): string {
  switch (lower) {
    case "forehead":
      return "your forehead";
    case "frown":
    case "glabella":
      return "your frown lines";
    case "brow":
    case "brows":
      return "your brow area";
    case "eye":
    case "eyes":
      return "your eye area";
    case "lip":
    case "lips":
      return "your lips";
    case "cheek":
    case "cheeks":
      return "your cheeks";
    case "hand":
    case "hands":
      return "your hands";
    case "neck":
      return "your neck";
    case "chest":
      return "your chest";
    case "chin":
      return "your chin";
    case "jaw":
      return "your jawline";
    case "face":
      return "your face";
    case "temple":
    case "temples":
      return "your temples";
    case "midface":
      return "your mid-face";
    case "nose":
      return "your nose";
    case "perioral":
      return "the skin around your mouth";
    case "jowl":
    case "jowls":
      return "your jawline and jowls";
    case "décolleté":
    case "decollete":
      return "your chest and décolleté";
    default:
      return `your ${lower}`;
  }
}

/**
 * Copy for tying a chapter to `patientPriorities` (goals, findings, scan focus areas).
 * Returns full sentences for the top complement; trailing space + sentence for the bottom.
 */
function patientPriorityBridgeCopy(priorityRaw: string): {
  top: string;
  tail: string;
} | null {
  const t = priorityRaw.trim();
  if (!t) return null;

  if (t.length > 160 || /[\n\r]/.test(t)) return null;

  const lower = t.toLowerCase().replace(/\u2019/g, "'");

  if (!/[\s,;]/.test(t) && PRIORITY_SINGLE_TOKEN_AREA.has(lower)) {
    const phrase = areaPhraseForPriorityBridge(lower);
    const s = `This aligns with priorities for ${phrase}.`;
    return { top: s, tail: ` ${s}` };
  }

  if (/[\s,;]/.test(t) || t.length > 28) {
    const s = `This aligns with what you prioritized: ${t}.`;
    return { top: s, tail: ` ${s}` };
  }

  const s = `This aligns with your goal of ${t}.`;
  return { top: s, tail: ` ${s}` };
}

/** When many sibling chapters exist, naming every procedure reads as redundant noise. */
const SIBLING_NAME_LIST_CAP = 2;

function formatSiblingChapterListForBridge(others: string[]): string {
  if (others.length === 0) return "";
  if (others.length <= SIBLING_NAME_LIST_CAP) {
    return formatEnglishList(others);
  }
  const head = others.slice(0, SIBLING_NAME_LIST_CAP);
  const rest = others.length - SIBLING_NAME_LIST_CAP;
  return `${formatEnglishList(head)}, and ${rest} other treatment${rest === 1 ? "" : "s"}`;
}

function buildChapterClientApplicationTop(
  chapter: TreatmentChapter,
  mergedConcerns: string[],
  analysisInput: ChapterOverviewAnalysisInput | undefined,
  complementCtx: ChapterComplementSandwichContext | null | undefined,
): string | undefined {
  const self = chapter.displayName.trim();
  const area = chapter.displayArea?.trim() || "";
  if (mergedConcerns.length > 0) {
    return `${self} is in your plan to address ${formatEnglishList(
      mergedConcerns.slice(0, 5),
    )}, based on what came up during your visit.`;
  }
  const interest = analysisInput?.planRow?.interest?.trim();
  if (interest) {
    return `This was included based on what you discussed with your provider\u2014${interest}.`;
  }
  const priorityRaw =
    (complementCtx?.patientPriorities ?? []).find((p) => p.trim().length > 0) ??
    "";
  const priorityBridge = patientPriorityBridgeCopy(priorityRaw);
  if (priorityBridge) {
    return priorityBridge.top;
  }
  if (complementCtx && complementCtx.totalChapters > 1) {
    const others = complementCtx.allChapterDisplayNames.filter(
      (_, i) => i !== complementCtx.chapterIndex,
    );
    if (others.length >= 3) {
      return `${self} is part of your coordinated in-office plan alongside your other treatment chapters.`;
    }
    if (others.length > 0) {
      return `${self} is part of your overall plan, working alongside ${formatEnglishList(others)}.`;
    }
  }
  if (area) {
    return `Your provider recommended ${self.toLowerCase()} for ${area.toLowerCase()} based on your visit.`;
  }
  return `${self} was recommended based on your conversation with your provider.`;
}

function buildChapterComplementBottom(
  chapter: TreatmentChapter,
  ctx: ChapterComplementSandwichContext,
): string {
  const self = chapter.displayName.trim();
  const pillars = planPillarPhraseForComplement(ctx.planShape);
  const priorityRaw =
    (ctx.patientPriorities ?? []).find((p) => p.trim().length > 0) ?? "";
  const priorityTail = patientPriorityBridgeCopy(priorityRaw)?.tail ?? "";
  if (ctx.totalChapters <= 1) {
    return `Staying consistent with ${self} is what keeps your results building over time.${priorityTail}`;
  }
  const others = ctx.allChapterDisplayNames.filter(
    (_, i) => i !== ctx.chapterIndex,
  );
  if (others.length >= 3) {
    return `This chapter is one piece of a coordinated plan\u2014each in-office step is meant to work with the others, and together ${pillars} reinforce the same goals.${priorityTail}`;
  }
  if (others.length === 1) {
    return `${self} works hand-in-hand with ${others[0]}\u2014together, ${pillars} reinforce the same goals.${priorityTail}`;
  }
  const othersList = formatSiblingChapterListForBridge(others);
  return `${self} works hand-in-hand with ${othersList}\u2014together, ${pillars} reinforce the same goals.${priorityTail}`;
}

/**
 * Per-treatment overview: category context, plan rows (SKU / area / qty), and analysis-linked narrative.
 * Pass `options` when `analysisSummary.overviewSnapshot` + plan rows are available on the blueprint.
 */
export function buildChapterOverviewContent(
  chapter: TreatmentChapter,
  options?: ChapterOverviewBuildOptions | null,
  complementContext?: ChapterComplementSandwichContext | null,
): ChapterOverviewParts {
  const introBase = resolveHowItWorksIntro(chapter);

  const ctx: ChapterOverviewAnalysisInput | undefined =
    options != null
      ? {
          overviewSnapshot: options.overviewSnapshot,
          planRow: options.planRow,
        }
      : undefined;

  const mergedConcerns = getChapterOverviewMergedConcerns(chapter, ctx);

  const complementTop = buildChapterClientApplicationTop(
    chapter,
    mergedConcerns,
    ctx,
    complementContext ?? null,
  );

  const hadExplicitAddressingSentence =
    Boolean(complementTop) ||
    mergedConcerns.length > 0 ||
    Boolean(chapter.displayArea?.trim());

  let intro = introBase;
  if (mergedConcerns.length === 0) {
    intro = ctx ? maybeAppendIntroScanBridge(intro, chapter, ctx) : intro;
  }

  const planBullets = dedupeText(
    chapter.planItems.map((item) => buildChapterPlanBulletLine(item, chapter)),
  );

  const analysis = buildChapterAnalysisParagraph(chapter, mergedConcerns, {
    hadExplicitAddressingSentence,
  });

  let complementBottom: string | undefined;
  if (complementContext && complementContext.totalChapters > 0) {
    complementBottom = buildChapterComplementBottom(chapter, complementContext);
  }

  return {
    complementTop: complementTop?.trim() || undefined,
    intro,
    planBullets,
    analysis,
    complementBottom,
  };
}

/**
 * Builds the supporting-evidence text for the top-level overview card.
 * Uses snapshot data directly rather than the pre-generated assessmentParagraph,
 * so the output stays tight and reinforces the provider's recommendations.
 */
export function buildAssessmentFindingsSection(
  snapshot: BlueprintAnalysisOverviewSnapshot,
  goals: string[],
): string | null {
  const parts: string[] = [];

  const findings = snapshot.detectedIssueLabels.slice(0, 6);
  if (findings.length > 3) {
    parts.push(
      "Your assessment supported these recommendations by showing several patterns to work on across your skin",
    );
  } else if (findings.length > 0) {
    parts.push(
      `Your assessment supported these recommendations by highlighting ${formatEnglishList(findings)}`,
    );
  }

  const cats = [...snapshot.categories].sort((a, b) => b.score - a.score);
  if (parts.length === 0 && cats.length >= 2) {
    const strong = cats[0]!;
    const room = cats[cats.length - 1]!;
    parts.push(
      `At a high level, the assessment suggested ${room.name.toLowerCase()} deserved more attention than ${strong.name.toLowerCase()}`,
    );
  }

  const focus = snapshot.areas
    .filter((a) => a.hasInterest)
    .map((a) => a.name);
  const hasPriorities = focus.length > 0 || goals.length > 0;

  if (parts.length === 0) {
    if (!hasPriorities) return null;
    if (focus.length > 0) {
      parts.push(
        "The assessment aligned with the areas you and your provider had already agreed to prioritize",
      );
    } else {
      parts.push(
        "The assessment fit with the priorities you shared during your visit",
      );
    }
  } else if (hasPriorities) {
    if (focus.length > 0) {
      parts.push(
        "That matched the areas you and your provider had already agreed to focus on",
      );
    } else {
      parts.push("It also fit with the priorities you shared during your visit");
    }
  }

  if (parts.length === 0) return null;
  return `${parts.join(". ")}.`;
}
