import type { DiscussedItem, SkincareQuizData } from "../types";
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
  plannedForPatientLineFullDateFromDiscussedItem,
  timelineOptionDisplayLabel,
  TREATMENT_PLAN_BULLET,
} from "../components/modals/DiscussedTreatmentsModal/utils";
import { patientFacingSkincareShortName } from "./pvbSkincareDisplay";
import {
  getRecommendedProductsForSkinType,
  RECOMMENDED_PRODUCT_REASONS,
} from "../data/skinTypeQuiz";
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
import { getWellnestOfferingByTreatmentName } from "../data/wellnestOfferings";

/**
 * Meta line for blueprint "What's included" — for Other procedures / Energy Treatment sub-chapters,
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

function planItemTimingMeta(item: DiscussedItem): string | null {
  const scheduled = plannedForPatientLineFullDateFromDiscussedItem(item);
  if (scheduled) return scheduled;
  const t = (item.timeline ?? "").trim();
  if (t === "Now") return "Timing: Now";
  if (t === "Add next visit")
    return `Timing: ${timelineOptionDisplayLabel("Add next visit")}`;
  if (t === "Wishlist" || (!t && item.treatment?.trim() !== "Skincare")) {
    return "Timing: Wishlist";
  }
  if (item.treatment?.trim() === "Skincare") return "Timing: Home care";
  return t ? `Timing: ${timelineOptionDisplayLabel(t)}` : null;
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
    const rawMeta = formatChapterPlanMetaLine(item, chapter);
    const labelLower = label.trim().toLowerCase();
    const filteredMetaParts = rawMeta
      .split(TREATMENT_PLAN_BULLET)
      .filter((part) => part.trim().toLowerCase() !== labelLower);
    const meta = filteredMetaParts.join(TREATMENT_PLAN_BULLET);
    const timing = planItemTimingMeta(item);
    const fullMeta = [timing, meta].filter(Boolean).join(TREATMENT_PLAN_BULLET);
    return fullMeta ? `${label} — ${fullMeta}` : label;
  }
  const area = getDisplayAreaForItem(item);
  const metaParts: string[] = [];
  const timing = planItemTimingMeta(item);
  if (timing) metaParts.push(timing);
  if (area) metaParts.push(area);
  if (item.skincareAddOnForTreatment?.trim()) {
    metaParts.push(`Add-on for ${item.skincareAddOnForTreatment.trim()}`);
  }
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

function lowercaseGoalText(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\bai\b/g, "AI")
    .replace(/\bspf\b/g, "SPF");
}

function addYourToGoalObject(value: string): string {
  if (/^(your|the|overall)\s+/i.test(value)) return value;
  if (
    /\b(eyelids?|eyes?|brows?|forehead|skin|lips?|cheeks?|jawline|chin|neck|face|lower face|midface|temples?)\b/i.test(
      value,
    )
  ) {
    return `your ${value}`;
  }
  return value;
}

function formatPatientGoalPhrase(raw: string): string {
  const goal = lowercaseGoalText(raw);
  const verbMap: Array<[RegExp, string]> = [
    [/^rejuvenate\s+(.+)$/i, "rejuvenating"],
    [/^balance\s+(.+)$/i, "balancing"],
    [/^smoothen\s+(.+)$/i, "smoothing"],
    [/^smooth\s+(.+)$/i, "smoothing"],
    [/^even\s+(.+)$/i, "evening"],
    [/^brighten\s+(.+)$/i, "brightening"],
    [/^refresh\s+(.+)$/i, "refreshing"],
    [/^restore\s+(.+)$/i, "restoring"],
    [/^improve\s+(.+)$/i, "improving"],
    [/^soften\s+(.+)$/i, "softening"],
    [/^reduce\s+(.+)$/i, "reducing"],
    [/^lift\s+(.+)$/i, "lifting"],
    [/^contour\s+(.+)$/i, "contouring"],
  ];
  for (const [re, gerund] of verbMap) {
    const m = goal.match(re);
    if (!m?.[1]) continue;
    return `${gerund} ${addYourToGoalObject(m[1].trim())}`;
  }
  return addYourToGoalObject(goal);
}

function formatPatientGoalList(goals: string[]): string {
  return formatEnglishList(goals.map(formatPatientGoalPhrase));
}

function goalMatchesTreatmentName(goal: string, chapterName: string): boolean {
  const g = goal.toLowerCase();
  const c = chapterName.toLowerCase();
  const isSkincare =
    /skinceuticals|skincare|cleanser|serum|moistur|hyaluronic|cell cycle|retinol|spf|sunscreen|discoloration|phyto|glycolic|ferulic|cream|balm/.test(
      c,
    );
  if (isSkincare) {
    return /skin|tone|texture|pigment|spot|bright|hydrat|barrier|acne|pore|redness|even/.test(
      g,
    );
  }
  if (/neurotoxin|botox|dysport|daxxify|xeomin/i.test(chapterName)) {
    return /brow|fine line|wrinkle|smooth|forehead|frown|crow|expression/.test(
      g,
    );
  }
  if (/filler|restylane|juvederm|voluma|volux|contour|lyft/i.test(chapterName)) {
    return /lower eyelid|under.?eye|tear trough|rejuvenat|volume|hollow|lip|cheek|jaw|chin|contour|fold/.test(
      g,
    );
  }
  if (/biostimul|sculptra|radiesse|prf|ez gel/i.test(chapterName)) {
    return /collagen|skin quality|firm|volume|fold|texture|rejuvenat|fine line/.test(
      g,
    );
  }
  if (/laser|moxi|bbl|energy|peel|microneed/i.test(chapterName)) {
    return /skin|tone|texture|pigment|spot|bright|redness|pore|scar|even/.test(
      g,
    );
  }
  return false;
}

function formatChapterNameForGoalMapping(name: string): string {
  if (
    /skinceuticals|skincare|cleanser|serum|moistur|hyaluronic|cell cycle|retinol|spf|sunscreen|discoloration|phyto|glycolic|ferulic|cream|balm/i.test(
      name,
    )
  ) {
    return "your skincare products";
  }
  return name.trim();
}

function buildTreatmentGoalMappingSentence(
  chapterNames: string[],
  goals: string[],
): string | null {
  const cleanGoals = dedupeText(goals).slice(0, 4);
  if (cleanGoals.length === 0 || chapterNames.length === 0) return null;

  const usedGoals = new Set<string>();
  const rows: string[] = [];
  const labelSeen = new Set<string>();
  for (const chapterName of chapterNames) {
    const matchedGoals = cleanGoals.filter((goal) =>
      goalMatchesTreatmentName(goal, chapterName),
    );
    if (matchedGoals.length === 0) continue;
    const label = formatChapterNameForGoalMapping(chapterName);
    const labelKey = label.toLowerCase();
    if (labelSeen.has(labelKey)) continue;
    labelSeen.add(labelKey);
    matchedGoals.forEach((goal) => usedGoals.add(goal.toLowerCase()));
    rows.push(
      `${label} support${label.startsWith("your skincare products") ? "" : "s"} ${formatPatientGoalList(
        matchedGoals,
      )}`,
    );
  }

  if (rows.length === 0) {
    return `Your goals include ${formatPatientGoalList(cleanGoals)}.`;
  }

  const unmappedGoals = cleanGoals.filter(
    (goal) => !usedGoals.has(goal.toLowerCase()),
  );
  const unmappedTail =
    unmappedGoals.length > 0
      ? ` The rest of the plan also supports ${formatPatientGoalList(
          unmappedGoals,
        )}.`
      : "";
  return `Your goals include ${formatPatientGoalList(cleanGoals)}. ${formatEnglishList(
    rows,
  )}.${unmappedTail}`;
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
  // Wellnest peptide offerings
  "BPC-157":
    "It's a synthetic peptide that supports soft tissue healing, tendon and ligament recovery, and gut lining health—typically used for activity-related injuries and chronic GI issues.",
  "Thymosin Beta-4 (TB-500)":
    "It's a tissue-repair peptide that promotes muscle recovery, reduces inflammation, and improves mobility—often paired with BPC-157 for sports or injury recovery.",
  "CJC-1295":
    "It's a peptide that signals the body to produce more growth hormone naturally, supporting energy, body composition, and recovery.",
  Ipamorelin:
    "It's a peptide that gently triggers the body's own growth hormone release—often chosen for improved sleep quality and lean muscle support.",
  Semax:
    "It's a peptide that supports focus, mental clarity, and cognitive function—commonly used to help with brain fog and cognitive performance.",
  Selank:
    "It's a peptide that calms the stress response, supporting mood balance and resilience—without causing drowsiness.",
  "P-21":
    "It's a peptide that supports brain cell repair and memory function—typically considered for adults with cognitive or memory concerns.",
  Pinealon:
    "It's a short peptide that supports the brain's natural defenses against age-related decline, used to help maintain clarity and memory over time.",
  "GHRP-2 / GHRP-6":
    "They are peptides that stimulate the body's natural growth hormone production, supporting recovery and body composition—often used alongside CJC-1295.",
  "IGF-1 LR3":
    "It's a long-acting form of a natural growth factor that supports muscle building and recovery—used by adults focused on lean mass and athletic performance.",
  "GHK-Cu":
    "It's a naturally occurring copper peptide that supports tissue repair, collagen production, and overall skin and cellular health.",
  "Melanotan-2":
    "It works through the body's natural melanin system to encourage tanning and support related wellness goals.",
  "MK-677":
    "It's an oral compound that increases the body's natural growth hormone levels to support bone density, joint health, sleep quality, and lean muscle mass.",
  Sermorelin:
    "It's a peptide that prompts the body's own pituitary gland to release growth hormone naturally, supporting sleep quality, body composition, and recovery.",
  Tessamorelin:
    "It's a peptide that signals the body to release more growth hormone, helping reduce deep belly fat and support healthier body composition.",
  Epitalon:
    "It's a short peptide associated with cellular aging support—used in longevity protocols to promote healthy aging at the cellular level.",
  "AOD-9604":
    "It's a fragment of growth hormone that specifically targets fat metabolism—without raising blood sugar or causing other growth hormone side effects.",
  Cartalax:
    "It's a short peptide that supports cartilage and connective tissue repair—used for joint wear and osteoarthritis.",
  // Standard aesthetic categories
  Skincare: "It supports your home routine and helps maintain your in-office results.",
  "Energy Treatment":
    "It uses light or gentle heat to improve skin tone, texture, and collagen production.",
  Laser:
    "It refreshes tone and texture while encouraging collagen renewal over a series of sessions.",
  "Chemical Peel": "It speeds up surface renewal for better clarity and smoother fine lines.",
  Microneedling:
    "It stimulates collagen—often paired with topicals to help with texture and scarring.",
  Filler: "It restores volume and contour in areas where structure has shifted over time.",
  Neurotoxin: "It softens expression lines by relaxing the muscles that cause them.",
  Biostimulants: "It encourages your skin to gradually rebuild collagen and structure on its own.",
  Kybella: "It reduces stubborn fat pockets, most often under the chin.",
  Threadlift: "It provides lift and support in areas with mild sagging.",
  PRP: "It uses your body’s own growth factors to support skin rejuvenation.",
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
    "It uses growth-factor concentrate from your own blood—prepared in office—to support repair and skin quality where it's injected.",
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
 * matches (e.g. legacy "Skinvive II" label → Skinvive copy).
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
  "It's an in-office service your provider matched to a specific concern or comfort need from your visit.";

/**
 * Resolves the first "How it works" sentence. Sub-chapters under **Other procedures** used to
 * fall through to "focused on {displayName}" because `chapter.treatment` stays the category name.
 */
function resolveHowItWorksIntro(chapter: TreatmentChapter): string {
  const canon = canonicalPlanTreatmentName(chapter.treatment);
  const dn = chapter.displayName.trim();
  const dnLower = dn.toLowerCase();
  const skincareNarrative = skincareProductNarrative(chapter);
  if (skincareNarrative) return skincareNarrative.how;

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
  const out: string[] = [];
  out.push("Each step was chosen for a specific role in the plan.");

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

  if (!findingParts.length && focusNames.length) {
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

/** Shape of the patient's chapter list—drives holistic "whole plan" framing copy. */
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

// ── High-level overview: constructive / aspirational issue framing ───────────────
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
  [/crow['’]?s?\s*feet/i, "soften lines around the eyes"],
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
    const mappedGoals = buildTreatmentGoalMappingSentence(namedChapters, goals);
    if (framing.kind === "broad") {
      open = mappedGoals
        ? `${mappedGoals} Together, the plan is meant to ${framing.summary}.`
        : `Your provider selected these recommendations to support goals like ${formatPatientGoalList(goals)}, with the overall plan meant to ${framing.summary}.`;
    } else {
      open = mappedGoals
        ? `${mappedGoals} Together, they also help ${formatEnglishList(framing.items)}.`
        : `Your provider selected these recommendations to support goals like ${formatPatientGoalList(goals)}, including ${formatEnglishList(framing.items)}.`;
    }
  } else if (goals.length > 0) {
    const focusTail =
      focus.length > 0 && !focusAreasRedundantWithGoals(goals, focus)
        ? ` They gave extra attention to ${formatEnglishList(focus)}.`
        : "";
    const mappedGoals = buildTreatmentGoalMappingSentence(namedChapters, goals);
    open = `${mappedGoals ?? `This plan was built to support goals like ${formatPatientGoalList(goals)}.`}${focusTail}`;
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
    open = `Your provider selected these recommendations around the priorities that came up during your visit: ${formatEnglishList(interests)}.`;
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

export function sanitizeAestheticIntelligenceText(text: string): string {
  return text.replace(/\bblueprint\b/gi, (match) =>
    match[0] === match[0]?.toUpperCase() ? "Plan" : "plan",
  );
}

export type ChapterOverviewBuildOptions = {
  overviewSnapshot: BlueprintAnalysisOverviewSnapshot | null;
  planRow: PlanTreatmentRow | null;
  skincareQuiz?: SkincareQuizData | null;
  relatedSkincareAddOns?: DiscussedItem[];
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

/** When many sibling chapters exist, naming every procedure reads as redundant noise. */
const SIBLING_NAME_LIST_CAP = 2;

function formatQuizResultLabel(quiz: SkincareQuizData): string {
  if (quiz.resultLabel?.trim()) return quiz.resultLabel.trim();
  return quiz.result
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function findRecommendedProductReason(productName: string): string | null {
  const key = productName.trim();
  if (!key) return null;
  const exact = RECOMMENDED_PRODUCT_REASONS[key];
  if (exact) return exact;
  const lower = key.toLowerCase();
  const entry = Object.entries(RECOMMENDED_PRODUCT_REASONS).find(
    ([name]) => {
      const n = name.trim().toLowerCase();
      return n.includes(lower) || lower.includes(n);
    },
  );
  return entry?.[1] ?? null;
}

type SkincareProductNarrative = {
  reason: string;
  how: string;
  expect: string;
  fit: string;
};

function isSkincareChapter(chapter: TreatmentChapter): boolean {
  return chapter.treatment.trim().toLowerCase() === "skincare";
}

function skincareProductName(chapter: TreatmentChapter): string {
  const raw =
    chapter.planItems.find((item) => item.product?.trim())?.product?.trim() ??
    chapter.displayName.trim();
  return patientFacingSkincareShortName(raw);
}

function skincareProductNarrative(chapter: TreatmentChapter): SkincareProductNarrative | null {
  if (!isSkincareChapter(chapter)) return null;
  const product = skincareProductName(chapter);
  if (!product) return null;
  const text = [
    product,
    chapter.displayName,
    ...chapter.planItems.map((item) => item.product ?? ""),
  ]
    .join(" | ")
    .toLowerCase();
  const reason = findRecommendedProductReason(
    chapter.planItems.find((item) => item.product?.trim())?.product?.trim() ??
      chapter.displayName,
  );
  const reasonTail = reason ? `: ${reason.toLowerCase()}` : "";

  if (/\b(spf|sunscreen|uv defense|broad spectrum|mineral)\b/.test(text)) {
    return {
      reason: `${product} was included to protect the results you are building and reduce UV-triggered pigment, redness, and collagen breakdown${reasonTail}.`,
      how: "It forms a daily UV-protection layer so sun exposure is less likely to undo progress in tone, texture, and post-treatment healing.",
      expect: `Use ${product} every morning and reapply with real sun exposure. The goal is prevention: fewer flare-ups of discoloration and better maintenance of in-office results.`,
      fit: `${product} is the guardrail for the rest of the plan—it helps protect the skin changes your treatments and other products are trying to create.`,
    };
  }
  if (/\b(triple lipid|ceramide|barrier|hydra balm|emollience|daily moisture|renew overnight|moistur|cream|gel-cream|dry|dehydrated)\b/.test(text)) {
    return {
      reason: `${product} was included to support barrier repair and hydration${reasonTail}.`,
      how: "It reinforces the skin barrier with moisture-supporting ingredients so the surface is less dry, tight, or reactive.",
      expect: `With consistent use, ${product} should help skin feel more comfortable and resilient. It is especially useful when active treatments, weather, or procedures leave the barrier stressed.`,
      fit: `${product} gives the plan a recovery-and-maintenance layer, helping your skin tolerate active products and in-office treatments more smoothly.`,
    };
  }
  if (/\b(hyaluronic|hydrating b5|h\.?a\.?|multi-glycan|plump|hydration)\b/.test(text)) {
    return {
      reason: `${product} was selected for hydration and plumping support${reasonTail}.`,
      how: "It draws and holds water in the skin's surface layers, helping fine dehydration lines look softer and the skin feel more supple.",
      expect: `Hydration benefits from ${product} can feel fairly immediate, while smoother-looking texture depends on steady daily use.`,
      fit: `${product} supports the plan by keeping the skin hydrated, which helps procedures, brightening products, and barrier products perform better together.`,
    };
  }
  if (/\b(discoloration|dark spot|hyperpigmentation|pigment|uneven|brightening|phyto a\+)\b/.test(text)) {
    return {
      reason: `${product} was chosen to target uneven tone, discoloration, and visible dark spots${reasonTail}.`,
      how: "It works on pigment pathways and surface brightness so discoloration is less likely to look as pronounced over time.",
      expect: `Pigment improvement with ${product} is gradual. Most people need consistent use plus daily sunscreen for the result to hold.`,
      fit: `${product} handles the at-home pigment-control part of the plan, while procedures can address tone and texture from a different angle.`,
    };
  }
  if (/\b(c e ferulic|phloretin|silymarin|serum 10|aox|antioxidant|vitamin c|environmental)\b/.test(text)) {
    return {
      reason: `${product} was added for antioxidant protection and brightness support${reasonTail}.`,
      how: "Antioxidants help neutralize environmental stress that can contribute to dullness, uneven tone, and visible aging.",
      expect: `With regular morning use, ${product} supports brighter-looking skin and helps defend the results you are building with the rest of the plan.`,
      fit: `${product} is the daily protection step that pairs well with sunscreen and helps your in-office work last longer.`,
    };
  }
  if (/\b(retinol|glycolic|cell cycle|retexturing|exfoliat|resurfacing|renewal|texture)\b/.test(text)) {
    return {
      reason: `${product} was included to support cell turnover, smoother texture, and visible renewal${reasonTail}.`,
      how: "It encourages surface renewal so dull, rough, or uneven texture can gradually look more refined.",
      expect: `Start ${product} exactly as directed, since renewal products can be irritating if overused. The payoff is usually gradual improvement in smoothness and clarity.`,
      fit: `${product} brings the plan an at-home renewal step, complementing procedures that target texture, tone, and collagen.`,
    };
  }
  if (/\b(acne|blemish|lha|purifying|oily|congested|pore|clay)\b/.test(text)) {
    return {
      reason: `${product} was selected to help with oil, congestion, breakouts, or visible pores${reasonTail}.`,
      how: "It supports clearer skin by helping reduce buildup, excess oil, or congestion depending on the product type.",
      expect: `Use ${product} consistently but avoid stacking too many strong actives at once. Clearer-looking skin usually builds over several weeks.`,
      fit: `${product} keeps the breakout-control part of the plan moving at home, so office treatments are not doing all the work alone.`,
    };
  }
  if (/\b(redness|sensitive|soothing|calming|phyto corrective|epidermal repair|redness neutralizer|irritation|sensiderm)\b/.test(text)) {
    return {
      reason: `${product} was included to calm visible redness, sensitivity, or irritation${reasonTail}.`,
      how: "It supports a calmer skin environment by focusing on comfort, hydration, and visible redness control.",
      expect: `${product} should feel supportive rather than aggressive. It is meant to help the skin stay calmer while the rest of the plan does its work.`,
      fit: `${product} is the calming step in the routine, helping balance stronger active products or procedure-related sensitivity.`,
    };
  }
  if (/\b(a\.?g\.?e|rgn|p-tiox|tripeptide|anti-aging|anti aging|wrinkle|firm|firmness|loss of firmness|eye cream|eye balm)\b/.test(text)) {
    return {
      reason: `${product} was chosen for visible aging support, including firmness, fine lines, or skin quality${reasonTail}.`,
      how: "It targets visible aging from the home-care side, supporting smoother-looking texture and stronger-looking skin quality over time.",
      expect: `${product} is a consistency product: results are subtle and cumulative, not overnight. The goal is steadier skin quality between visits.`,
      fit: `${product} supports the long-game part of the plan, reinforcing skin quality while in-office treatments address structure, movement, or collagen more directly.`,
    };
  }
  if (/\b(cleanser|cleansing|wash|toner|mist)\b/.test(text)) {
    return {
      reason: `${product} was added to make the routine easier to tolerate and keep the skin prepared for treatment products${reasonTail}.`,
      how: "It helps remove oil, makeup, sunscreen, or buildup without making the rest of the routine work against irritated skin.",
      expect: `${product} should make the routine feel cleaner and more balanced. It is not the dramatic step, but it helps every leave-on product work from a better starting point.`,
      fit: `${product} is the foundation step: it prepares the skin so the active products and in-office plan can work more predictably.`,
    };
  }

  return {
    reason: `${product} was selected for the specific role it plays in your home routine${reasonTail}.`,
    how: "It supports the skin from the home-care side so your daily routine is aligned with the goals of your treatment plan.",
    expect: `Use ${product} as directed and give it time. Skincare results build through consistency more than single applications.`,
    fit: `${product} gives your plan a daily maintenance step, helping reinforce the progress from your provider's recommendations.`,
  };
}

function buildSkincareQuizFitParagraph(
  chapter: TreatmentChapter,
  quiz: SkincareQuizData | null | undefined,
): string | null {
  if (chapter.treatment.trim().toLowerCase() !== "skincare" || !quiz?.result) {
    return null;
  }
  const selectedProducts = chapter.planItems
    .map((item) => item.product?.trim() ?? "")
    .filter(Boolean);
  if (selectedProducts.length === 0) return null;

  const recommended = new Set(
    (quiz.recommendedProductNames?.length
      ? quiz.recommendedProductNames
      : getRecommendedProductsForSkinType(quiz.result)
    ).map((name) => name.trim().toLowerCase()),
  );
  const matches = selectedProducts
    .map((product) => {
      const lower = product.toLowerCase();
      const isQuizRecommended = Array.from(recommended).some(
        (rec) => rec.includes(lower) || lower.includes(rec),
      );
      const reason = findRecommendedProductReason(product);
      if (!isQuizRecommended && !reason) return null;
      const shortName = patientFacingSkincareShortName(product);
      return reason ? `${shortName} (${reason})` : shortName;
    })
    .filter((v): v is string => Boolean(v))
    .slice(0, 3);

  const addOnSources = Array.from(
    new Set(
      chapter.planItems
        .map((item) => item.skincareAddOnForTreatment?.trim() ?? "")
        .filter(Boolean),
    ),
  );

  const label = formatQuizResultLabel(quiz);
  const descSentence = quiz.resultDescription?.trim()
    ? ` ${quiz.resultDescription.trim().split(/(?<=[.!?])\s+/)[0]}`
    : "";
  const productSentence = matches.length
    ? ` In this plan, ${formatEnglishList(matches)} line up with those needs.`
    : " The skincare products in this plan were selected to support the needs reflected in that result.";
  const addOnSentence = addOnSources.length
    ? ` ${addOnSources.length === 1 ? "It is" : "They are"} also marked as add-on support for ${formatEnglishList(addOnSources)}.`
    : "";

  return `Your skin quiz result was ${label}.${descSentence}${productSentence}${addOnSentence}`;
}

function buildRelatedSkincareAddOnParagraph(
  relatedSkincareAddOns: DiscussedItem[] | undefined,
): string | null {
  const names = Array.from(
    new Set(
      (relatedSkincareAddOns ?? [])
        .map((item) => item.product?.trim() ?? "")
        .filter(Boolean)
        .map(patientFacingSkincareShortName),
    ),
  ).slice(0, 3);
  if (names.length === 0) return null;
  return `The skincare add-on${names.length > 1 ? "s" : ""} tied to this treatment ${names.length > 1 ? "are" : "is"} ${formatEnglishList(names)}, so the at-home part of the plan supports skin quality and recovery around this visit.`;
}

function formatSiblingChapterListForBridge(others: string[]): string {
  if (others.length === 0) return "";
  if (others.length <= SIBLING_NAME_LIST_CAP) {
    return formatEnglishList(others);
  }
  const head = others.slice(0, SIBLING_NAME_LIST_CAP);
  const rest = others.length - SIBLING_NAME_LIST_CAP;
  return `${formatEnglishList(head)}, and ${rest} other treatment${rest === 1 ? "" : "s"}`;
}

function wellnestAddressParts(treatment: string, limit = 3): string[] {
  const offering = getWellnestOfferingByTreatmentName(treatment);
  return (
    offering?.addresses
      .split(/[,;]/)
      .map((s) =>
        s
          .trim()
          .replace(/\s+support$/i, "")
          .replace(/\//g, " and ")
          .toLowerCase(),
      )
      .filter((s) => s.length > 0)
      .slice(0, limit) ?? []
  );
}

function wellnestRolePhrase(treatment: string): string {
  const offering = getWellnestOfferingByTreatmentName(treatment);
  if (!offering) return "wellness support";
  const category = offering.category.toLowerCase();
  const browseGroup = offering.browseGroup.toLowerCase();
  if (/cognitive|cognition/.test(category) || browseGroup === "cognition-mood") {
    if (/stress|mood/.test(category)) return "stress, mood, and cognitive support";
    return "focus and cognitive support";
  }
  if (/recovery|inflammation|gut|musculoskeletal|injury/.test(category)) {
    return "recovery, inflammation, and tissue support";
  }
  if (/sleep|muscle/.test(category)) return "sleep and muscle-support goals";
  if (/energy|recovery/.test(category)) return "energy, recovery, and body-composition goals";
  if (/longevity|aging/.test(category)) return "healthy-aging and longevity support";
  if (/weight|fat|composition/.test(category)) return "body-composition support";
  const parts = wellnestAddressParts(treatment, 2);
  return parts.length ? formatEnglishList(parts) : "wellness support";
}

function wellnestWhySentence(
  self: string,
  interest: string | undefined,
): string {
  const targets = wellnestAddressParts(self, 3);
  const role = wellnestRolePhrase(self);
  if (interest) {
    return `${self} was added for ${role}, matching the priority your provider noted: ${interest}.`;
  }
  if (targets.length > 0) {
    return `${self} was added for ${role}, especially ${formatEnglishList(targets)}.`;
  }
  return `${self} was added for ${role} based on what your provider reviewed during your visit.`;
}

function wellnestFullPlanSentence(
  self: string,
  others: string[],
  priorityTail: string,
): string {
  const selfRole = wellnestRolePhrase(self);
  if (others.length === 0) {
    return `${self} is the main peptide in this plan, focused on ${selfRole}; consistency with the schedule your provider set is what matters most.${priorityTail}`;
  }
  if (others.length === 1) {
    const other = others[0]!;
    return `${self} covers ${selfRole}, while ${other} covers ${wellnestRolePhrase(other)}—so the plan is addressing two different wellness priorities at the same time.${priorityTail}`;
  }
  const rolePhrases = Array.from(
    new Set([selfRole, ...others.map(wellnestRolePhrase)]),
  ).slice(0, 3);
  const additionalRoles = rolePhrases.filter((r) => r !== selfRole);
  if (additionalRoles.length === 0) {
    return `${self} covers ${selfRole}; the other peptide selections reinforce that same priority from complementary angles.${priorityTail}`;
  }
  return `${self} covers ${selfRole}; across the full plan, the peptide mix also supports ${formatEnglishList(additionalRoles)}.${priorityTail}`;
}

function buildChapterClientApplicationTop(
  chapter: TreatmentChapter,
  mergedConcerns: string[],
  analysisInput: ChapterOverviewAnalysisInput | undefined,
  complementCtx: ChapterComplementSandwichContext | null | undefined,
): string | undefined {
  const self = chapter.displayName.trim();
  const area = chapter.displayArea?.trim() || "";
  const skincareNarrative = skincareProductNarrative(chapter);
  if (skincareNarrative) return skincareNarrative.reason;
  if (mergedConcerns.length > 0) {
    return `${self} is in your plan to address ${formatEnglishList(
      mergedConcerns.slice(0, 5),
    )}, based on what came up during your visit.`;
  }
  const interest = analysisInput?.planRow?.interest?.trim();
  const wellnestOffering = getWellnestOfferingByTreatmentName(chapter.treatment);
  if (wellnestOffering) {
    return wellnestWhySentence(self, interest);
  }
  if (interest) {
    return `This was included based on what you discussed with your provider—${interest}.`;
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
  const priorityTail = "";
  const skincareNarrative = skincareProductNarrative(chapter);
  if (skincareNarrative) return skincareNarrative.fit;

  const wellnestOffering = getWellnestOfferingByTreatmentName(chapter.treatment);
  if (wellnestOffering) {
    const others = ctx.allChapterDisplayNames.filter(
      (_, i) => i !== ctx.chapterIndex,
    );
    return wellnestFullPlanSentence(self, others, priorityTail);
  }

  const pillars = planPillarPhraseForComplement(ctx.planShape);
  if (ctx.totalChapters <= 1) {
    return `Staying consistent with ${self} is what keeps your results building over time.${priorityTail}`;
  }
  const others = ctx.allChapterDisplayNames.filter(
    (_, i) => i !== ctx.chapterIndex,
  );
  if (others.length >= 3) {
    const focus = chapter.displayArea?.trim()
      ? `${self} focuses on ${chapter.displayArea.trim().toLowerCase()}`
      : `${self} has a specific role in your plan`;
    return `${focus}. It works alongside the other recommended steps so ${pillars} reinforce the same goals instead of feeling like separate treatments.${priorityTail}`;
  }
  if (others.length === 1) {
    return `${self} works hand-in-hand with ${others[0]}—together, ${pillars} reinforce the same goals.${priorityTail}`;
  }
  const othersList = formatSiblingChapterListForBridge(others);
  return `${self} works hand-in-hand with ${othersList}—together, ${pillars} reinforce the same goals.${priorityTail}`;
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
    [
      ...chapter.planItems.map((item) => buildChapterPlanBulletLine(item, chapter)),
      ...((options?.relatedSkincareAddOns ?? []).map(
        (item) =>
          `Skincare support: ${patientFacingSkincareShortName(
            item.product ?? "Skincare",
          )}`,
      )),
    ],
  );

  const wellnestOffering = getWellnestOfferingByTreatmentName(chapter.treatment);
  const skincareNarrative = skincareProductNarrative(chapter);
  const baseAnalysis = skincareNarrative
    ? skincareNarrative.expect
    : wellnestOffering
      ? wellnestOffering.resultsTimeline?.trim()
        ? `Most people notice changes within ${wellnestOffering.resultsTimeline.trim()}, depending on the schedule and dosing your provider set.`
        : `Your provider will guide timing and dosing so this fits safely into your broader wellness plan.`
      : buildChapterAnalysisParagraph(chapter, mergedConcerns, {
          hadExplicitAddressingSentence,
        });
  const skincareQuizFit = buildSkincareQuizFitParagraph(
    chapter,
    options?.skincareQuiz,
  );
  const relatedSkincareFit = buildRelatedSkincareAddOnParagraph(
    options?.relatedSkincareAddOns,
  );
  const analysis = [baseAnalysis, skincareQuizFit, relatedSkincareFit]
    .filter(Boolean)
    .join(" ");

  let complementBottom: string | undefined;
  if (complementContext && complementContext.totalChapters > 0) {
    complementBottom = buildChapterComplementBottom(chapter, complementContext);
  }

  return {
    complementTop: complementTop?.trim()
      ? sanitizeAestheticIntelligenceText(complementTop.trim())
      : undefined,
    intro: sanitizeAestheticIntelligenceText(intro),
    planBullets: planBullets.map(sanitizeAestheticIntelligenceText),
    analysis: sanitizeAestheticIntelligenceText(analysis),
    complementBottom: complementBottom
      ? sanitizeAestheticIntelligenceText(complementBottom)
      : undefined,
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
