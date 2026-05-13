import type { DiscussedItem } from "../types";
import type { PatientSuggestionCard } from "../services/api";
import {
  TREATMENT_META,
  canonicalPlanTreatmentName,
  ENERGY_TREATMENT_CATEGORY,
  LEGACY_ENERGY_DEVICE_CATEGORY,
} from "../components/modals/DiscussedTreatmentsModal/constants";
import { getTreatmentDisplayName } from "../components/modals/DiscussedTreatmentsModal/utils";
import {
  normalizeBlueprintAnalysisText,
  type PlanTreatmentRow,
} from "./postVisitBlueprintAnalysis";
import {
  getEffectivePriceList,
  getPriceRange2025,
  normalizePlanTreatmentCategoryForPricing,
  type DashboardTreatmentCategory,
} from "../data/treatmentPricing2025";
import { getTreatmentPhotoAreaDisplayList } from "./treatmentPhotoTitle";
import {
  buildBlueprintChapterSchedule,
  planItemsForBlueprintChapterSlot,
} from "./pvbChapterSchedule";
import { isJudgeMdProviderCode } from "../data/judgeMdPricing2026";
import {
  getJudgeMdRecommenderGalleryExhibit,
  judgeMdExhibitToDemoPhotos,
} from "../data/judgeMdGalleryExhibit";
import { getPublicBlueprintCasesForPlanItems } from "../data/publicBlueprintCases";

export type BlueprintCasePhoto = {
  id: string;
  photoUrl: string;
  treatments: string[];
  areaNames: string[];
  age?: string;
  skinType?: string;
  skinTone?: string;
  ethnicBackground?: string;
  caption?: string;
  storyTitle?: string;
  /** Photos table “Story Detailed” — longer narrative shown in Results like yours + case sheet. */
  storyDetailed?: string;
  /** Public source page for externally curated case imagery. */
  sourceUrl?: string;
  /** Short source label, e.g. "Sculptra official gallery" or "Judge MD". */
  sourceLabel?: string;
  /** Patient-facing badge when the image comes from this provider's own gallery. */
  providerResultLabel?: string;
};

export type TreatmentResultsCard = {
  /** Stable key for React / carousel state */
  key: string;
  treatment: string;
  displayName: string;
  longevity?: string;
  downtime?: string;
  priceRange?: string;
  /** Distinct plan notes: regions, products, etc. */
  planHighlights: string[];
  photos: BlueprintCasePhoto[];
};

function norm(s: string): string {
  return s.trim().toLowerCase();
}

const BLUEPRINT_CASE_COMBINATION_BLACKLIST: ReadonlyArray<{
  whenTitlesPresent: readonly string[];
  dropTitle: string;
}> = [
  {
    whenTitlesPresent: [
      "How I Brought Back Brow Symmetry with Tox",
      "Neurotoxin: Real Results, No Downtime",
    ],
    dropTitle: "Neurotoxin: Real Results, No Downtime",
  },
] as const;

function casePrimaryTitle(photo: BlueprintCasePhoto): string {
  return photo.storyTitle?.trim() || photo.caption?.trim() || "";
}

function applyBlueprintCaseCombinationBlacklist(
  photos: BlueprintCasePhoto[],
): BlueprintCasePhoto[] {
  if (photos.length < 2) return photos;

  let out = [...photos];
  for (const rule of BLUEPRINT_CASE_COMBINATION_BLACKLIST) {
    const present = new Set(
      out.map((photo) => norm(casePrimaryTitle(photo))).filter(Boolean),
    );
    const allPresent = rule.whenTitlesPresent.every((title) =>
      present.has(norm(title)),
    );
    if (!allPresent) continue;
    out = out.filter(
      (photo) => norm(casePrimaryTitle(photo)) !== norm(rule.dropTitle),
    );
  }
  return out;
}

const ENERGY_MODALITY_PHOTO_KEYWORDS = [
  "moxi",
  "bbl",
  "ipl",
  "laser",
  "halo",
  "fraxel",
  "ultherapy",
  "sofwave",
  "broadband",
  "intense pulsed",
  "pico",
  "clear + brilliant",
  "radiofrequency",
  "rf ",
  "energy",
] as const;

/** Map high-level plan treatment → keywords that appear on Treatment Explorer photo tags */
const PLAN_TREATMENT_TO_PHOTO_KEYWORDS: Record<string, string[]> = {
  "energy treatment": [...ENERGY_MODALITY_PHOTO_KEYWORDS],
  "energy device": [...ENERGY_MODALITY_PHOTO_KEYWORDS],
  "chemical peel": ["chemical", "peel", "tca", "glycolic", "jessner", "vi peel", "salicylic", "mandelic"],
  microneedling: ["microneed", "nanoneed", "prp", "prfm", "skinpen", "rf microneed"],
  filler: ["filler", "hyaluronic", "juvederm", "restylane", "versa", "belotero", "tear trough", "ha "],
  neurotoxin: ["neurotoxin", "botox", "dysport", "xeomin", "jeuveau", "daxxify", "tox"],
  biostimulants: ["biostim", "sculptra", "radiesse", "prf"],
  "other procedures": ["skinvive", "prfm injection", "hair restoration", "skin booster"],
  kybella: ["kybella", "deoxycholic"],
  "facial services": ["facial", "dermasweep", "dermaplaning", "exfoliat"],
  skincare: ["skincare", "peel", "facial"], // broad; many skincare cases won't tag — cards may have 0 photos
  prp: ["prp"],
  pdgf: ["pdgf"],
  threadlift: ["thread", "pdo"],
};

export function photoMatchesPlanTreatment(photo: BlueprintCasePhoto, planTreatment: string): boolean {
  const pt = norm(planTreatment);
  const hay = photo.treatments.map((t) => norm(t)).join(" | ");

  if (photo.treatments.some((t) => norm(t) === pt)) return true;

  const keywords = PLAN_TREATMENT_TO_PHOTO_KEYWORDS[pt];
  if (keywords?.some((kw) => hay.includes(kw))) return true;

  // Substring match on any photo tag (e.g. plan "Filler" vs tag "Dermal Filler")
  if (photo.treatments.some((t) => t.toLowerCase().includes(pt) || pt.includes(norm(t)))) return true;

  return false;
}

/** Optional patient demographics for case-photo ordering (same shape as blueprint patient). */
export type CasePhotoRankingPatient = {
  skinType?: string | null;
  skinTone?: string | null;
  ethnicBackground?: string | null;
};

export type CasePhotoRankingOptions = {
  patient?: CasePhotoRankingPatient;
};

/**
 * Map plan highlights (regions, interests) → coarse tokens we expect in Treatment Explorer tags
 * so Neurotoxin galleries prefer forehead vs lip cases when the plan says Forehead.
 */
const NEUROTOXIN_AREA_HINTS: { test: RegExp; tokens: string[] }[] = [
  {
    test: /\b(forehead|glabella|frown|11'?s?|between[\s-]the[\s-]brows?)\b/i,
    tokens: ["forehead", "glabella", "frown"],
  },
  {
    test: /\b(crow'?s?\s*feet|lateral\s*canthal|outer\s*eye)\b/i,
    tokens: ["crow", "lateral canthal"],
  },
  {
    test: /\b(under[\s-]eye|tear[\s-]trough|infraorbital)\b/i,
    tokens: ["under eye", "tear trough"],
  },
  { test: /\b(lip|perioral|philtrum|smoker'?s?)\b/i, tokens: ["lip", "perioral"] },
  { test: /\b(masseter|jawline|jaw\s*tox)\b/i, tokens: ["masseter", "jaw"] },
  { test: /\b(chin|mentum|pebble)\b/i, tokens: ["chin"] },
  { test: /\b(neck|platysma|nefertiti)\b/i, tokens: ["neck", "platysma"] },
  { test: /\b(nose|bunny\s*lines?|nasalis)\b/i, tokens: ["nose", "bunny"] },
  { test: /\b(brow|eyebrow)\b/i, tokens: ["brow"] },
];

function collectNeurotoxinAreaSearchTokens(highlightStrings: string[]): string[] {
  const blob = highlightStrings
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" | ")
    .toLowerCase();
  if (!blob) return [];
  const tokens = new Set<string>();
  for (const row of NEUROTOXIN_AREA_HINTS) {
    if (row.test.test(blob)) row.tokens.forEach((t) => tokens.add(t));
  }
  return [...tokens];
}

function neurotoxinCaseSearchHaystack(photo: BlueprintCasePhoto): string {
  return [
    ...(photo.treatments ?? []),
    ...(photo.areaNames ?? []),
    photo.storyTitle ?? "",
    photo.caption ?? "",
    photo.storyDetailed ?? "",
  ]
    .join(" | ")
    .toLowerCase();
}

function highlightBlob(highlightStrings: string[]): string {
  return highlightStrings
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .join(" | ");
}

function shouldHideNeurotoxinCaseBySelection(
  photo: BlueprintCasePhoto,
  highlightStrings: string[],
): boolean {
  const highlights = highlightBlob(highlightStrings);
  const hay = neurotoxinCaseSearchHaystack(photo);
  const gummySelected = /\bgummy\s*smile\b/i.test(highlights);
  const gummyCase = /\bgummy\s*smile\b/i.test(hay);
  if (gummyCase && !gummySelected) return true;
  return false;
}

function neurotoxinCasePhotoAreaScore(photo: BlueprintCasePhoto, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const hay = neurotoxinCaseSearchHaystack(photo);
  let score = 0;
  for (const tok of tokens) {
    if (hay.includes(tok)) score += 14;
  }
  if (
    tokens.includes("forehead") &&
    /\b(wrinkle|wrinkles|line|lines|smooth|frown|glabella|forehead)\b/i.test(hay)
  ) {
    score += 10;
  }
  return score;
}

function normalizeAreaLabel(value: string): string {
  return String(value)
    .replace(/\s*All$/i, "")
    .trim()
    .toLowerCase();
}

function collectRequestedAreaHints(highlightStrings: string[]): string[] {
  const out = new Set<string>();
  for (const raw of highlightStrings) {
    for (const seg of String(raw).split(",")) {
      const t = normalizeAreaLabel(seg);
      if (!t || t === "all") continue;
      out.add(t);
    }
  }
  return [...out];
}

function photoAreaHintScore(photo: BlueprintCasePhoto, requestedAreas: string[]): number {
  if (requestedAreas.length === 0) return 0;
  const photoAreas = getTreatmentPhotoAreaDisplayList(photo.areaNames ?? [])
    .map(normalizeAreaLabel)
    .filter(Boolean);
  if (photoAreas.length === 0) return 0;
  let score = 0;
  for (const requested of requestedAreas) {
    for (const area of photoAreas) {
      if (
        area === requested ||
        area.includes(requested) ||
        requested.includes(area)
      ) {
        score += 20;
      }
    }
  }
  return score;
}

function rankMatchingCasePhotos(
  matching: BlueprintCasePhoto[],
  treatment: string,
  highlightStrings: string[],
  patient: CasePhotoRankingPatient,
): BlueprintCasePhoto[] {
  const baseTreatment =
    treatment.split(/\s*·\s*/)[0]?.trim() || treatment;
  const isNeuro =
    planTreatmentGroupKey(canonicalPlanTreatmentName(baseTreatment)) ===
    norm("Neurotoxin");
  const tokens = isNeuro ? collectNeurotoxinAreaSearchTokens(highlightStrings) : [];
  const requestedAreas = collectRequestedAreaHints(highlightStrings);

  type Row = { p: BlueprintCasePhoto; area: number; topical: number; demo: number };
  const visibleMatching = isNeuro
    ? matching.filter((p) => !shouldHideNeurotoxinCaseBySelection(p, highlightStrings))
    : matching;

  const scored: Row[] = visibleMatching.map((p) => ({
    p,
    area: photoAreaHintScore(p, requestedAreas),
    topical: isNeuro ? neurotoxinCasePhotoAreaScore(p, tokens) : 0,
    demo: demographyScore(p, patient),
  }));

  let rows = scored;
  if (requestedAreas.length > 0) {
    const areaHits = scored.filter((x) => x.area > 0);
    if (areaHits.length > 0) rows = areaHits;
  }
  if (isNeuro && tokens.length > 0) {
    const topicalHits = scored.filter((x) => x.topical > 0);
    if (topicalHits.length > 0) rows = topicalHits;
  }

  rows.sort((a, b) => {
    if (b.area !== a.area) return b.area - a.area;
    if (b.topical !== a.topical) return b.topical - a.topical;
    return b.demo - a.demo;
  });
  const seenPhotoUrls = new Set<string>();
  const out: BlueprintCasePhoto[] = [];
  for (const row of rows) {
    const key = row.p.photoUrl.trim() || row.p.id;
    if (!key || seenPhotoUrls.has(key)) continue;
    seenPhotoUrls.add(key);
    out.push(row.p);
  }
  return applyBlueprintCaseCombinationBlacklist(out);
}

function collectSkincareProductResultTokens(values: string[]): string[] {
  const text = values.join(" | ").toLowerCase();
  const tokens = new Set<string>();
  const add = (...valuesToAdd: string[]) => {
    for (const value of valuesToAdd) tokens.add(value);
  };

  if (/\b(cleanser|cleansing|wash|pre-cleanse)\b/.test(text)) {
    add("cleanser", "cleansing", "wash", "refresh");
  }
  if (/\b(antioxidant|vitamin c|c e ferulic|phloretin|silymarin|serum 10|aox)\b/.test(text)) {
    add("antioxidant", "vitamin c", "environmental", "brightening", "radiance");
  }
  if (/\b(discoloration|dark spot|hyperpigmentation|pigment|uneven|brightening|phyto a\+)\b/.test(text)) {
    add("discoloration", "dark spot", "hyperpigmentation", "pigment", "uneven", "brightening");
  }
  if (/\b(acne|blemish|lha|purifying|oily|congested|pore)\b/.test(text)) {
    add("acne", "blemish", "oily", "congested", "pore", "clarity");
  }
  if (/\b(retinol|glycolic|cell cycle|retexturing|exfoliating|renewal|resurfacing|texture|radiance)\b/.test(text)) {
    add("retinol", "glycolic", "exfoliating", "resurfacing", "texture", "renewal", "radiance");
  }
  if (/\b(hydrat|moisture|moisturizer|triple lipid|emollience|hydra balm|b5|hyaluronic|barrier|dry|dehydrated|cream|balm)\b/.test(text)) {
    add("hydration", "hydrating", "moisture", "moisturizer", "barrier", "dry", "dehydrated");
  }
  if (/\b(redness|sensitive|soothing|calming|epidermal repair|phyto corrective|redness neutralizer|irritation)\b/.test(text)) {
    add("redness", "sensitive", "soothing", "calming", "repair", "irritation");
  }
  if (/\b(anti-aging|anti aging|wrinkle|firm|a\.?g\.?e|rgn|p-tiox|tripeptide|loss of firmness)\b/.test(text)) {
    add("anti-aging", "wrinkle", "firming", "firmness", "fine lines", "aging");
  }
  if (/\b(spf|sunscreen|uv defense|broad spectrum|mineral)\b/.test(text)) {
    add("spf", "sunscreen", "uv", "sun", "protection");
  }
  return Array.from(tokens);
}

function skincareCaseSearchHaystack(photo: BlueprintCasePhoto): string {
  return [
    ...(photo.treatments ?? []),
    ...(photo.areaNames ?? []),
    photo.storyTitle ?? "",
    photo.caption ?? "",
    photo.storyDetailed ?? "",
    photo.sourceLabel ?? "",
  ]
    .join(" | ")
    .toLowerCase();
}

function skincareProductResultScore(
  photo: BlueprintCasePhoto,
  productTokens: string[],
): number {
  if (productTokens.length === 0) return 0;
  const hay = skincareCaseSearchHaystack(photo);
  let score = 0;
  for (const token of productTokens) {
    if (hay.includes(token)) score += 1;
  }
  return score;
}

/** First explorer photo URL for a plan row (matches display name, then normalized key). */
export function pickCasePhotoUrlForPlanRow(
  row: PlanTreatmentRow,
  pool: BlueprintCasePhoto[],
  ranking?: CasePhotoRankingOptions,
): string | null {
  if (!pool.length) return null;
  const candidates = pool.filter(
    (p) =>
      photoMatchesPlanTreatment(p, row.displayName) ||
      photoMatchesPlanTreatment(p, row.key),
  );
  if (candidates.length === 0) return null;
  const highlightStrings = [
    ...planRowInterestCandidates(row),
    ...row.findings.map((f) => f.trim()).filter(Boolean),
  ];
  const patient = ranking?.patient ?? {};
  const ranked = rankMatchingCasePhotos(
    candidates,
    row.displayName,
    highlightStrings,
    patient,
  );
  return ranked[0]?.photoUrl ?? null;
}

function normSuggestionKey(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Suggestion names from a merged plan row (`interest` uses " · " between distinct interests).
 */
export function planRowInterestCandidates(row: PlanTreatmentRow): string[] {
  const raw = row.interest?.trim();
  if (!raw) return [];
  return raw
    .split(/\s*·\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Match dashboard patient-records cards to a plan row via `interest` (same names as Suggestions).
 */
export function findPatientSuggestionCardForPlanRow(
  row: PlanTreatmentRow,
  cards: PatientSuggestionCard[],
): PatientSuggestionCard | null {
  if (!cards.length) return null;
  const byKey = new Map<string, PatientSuggestionCard>();
  for (const c of cards) {
    const k = normSuggestionKey(c.suggestionName);
    if (!byKey.has(k)) byKey.set(k, c);
  }
  for (const name of planRowInterestCandidates(row)) {
    const hit = byKey.get(normSuggestionKey(name));
    if (hit) return hit;
  }
  return null;
}

/**
 * Hero image for treatment detail: area-cropped photo from patient-records when matched,
 * else Treatment Explorer case pool, else optional front-photo fallback.
 */
export function pickSuggestionOrCasePhotoForPlanRow(
  row: PlanTreatmentRow,
  pool: BlueprintCasePhoto[],
  matchedCard: PatientSuggestionCard | null,
  heroFallbackUrl: string | null | undefined,
  ranking?: CasePhotoRankingOptions,
): string | null {
  const fromCard = matchedCard?.photoUrl?.trim();
  if (fromCard) return fromCard;
  const fromCases = pickCasePhotoUrlForPlanRow(row, pool, ranking);
  if (fromCases) return fromCases;
  const hero = heroFallbackUrl?.trim();
  return hero || null;
}

function demographyScore(
  photo: BlueprintCasePhoto,
  patient: { skinType?: string | null; skinTone?: string | null; ethnicBackground?: string | null },
): number {
  let score = 0;
  const st = patient.skinType?.trim();
  const tone = patient.skinTone?.trim();
  const eth = patient.ethnicBackground?.trim();
  if (st && photo.skinType && norm(photo.skinType).includes(norm(st))) score += 3;
  if (tone && photo.skinTone && norm(photo.skinTone).includes(norm(tone))) score += 3;
  if (eth && photo.ethnicBackground && norm(photo.ethnicBackground).includes(norm(eth))) score += 1;
  return score;
}

function planTreatmentGroupKey(treatment: string): string {
  const t = treatment.trim();
  if (t === LEGACY_ENERGY_DEVICE_CATEGORY) return norm(ENERGY_TREATMENT_CATEGORY);
  return norm(t);
}

function planHighlightsForTreatment(items: DiscussedItem[], treatment: string): string[] {
  const parts = new Set<string>();
  const tKey = planTreatmentGroupKey(treatment);
  for (const item of items) {
    if (planTreatmentGroupKey(item.treatment ?? "") !== tKey) continue;
    if (item.region?.trim())
      parts.add(normalizeBlueprintAnalysisText(item.region.trim()));
    if (item.product?.trim())
      parts.add(normalizeBlueprintAnalysisText(item.product.trim()));
    if (item.interest?.trim())
      parts.add(normalizeBlueprintAnalysisText(item.interest.trim()));
    item.findings?.forEach((f) => {
      if (f.trim()) parts.add(normalizeBlueprintAnalysisText(f.trim()));
    });
  }
  return Array.from(parts).slice(0, 8);
}

function firstProductContaining(
  planItems: DiscussedItem[],
  pattern: RegExp,
): string | null {
  const item = planItems.find((pi) => pattern.test(pi.product ?? ""));
  return item?.product?.trim() || null;
}

function buildJudgeMdProviderBlueprintCases(
  slotDisplayName: string,
  treatment: string,
  planItems: DiscussedItem[],
): BlueprintCasePhoto[] {
  const productText = planItems.map((item) => item.product ?? "").join(" | ");
  const exhibit = getJudgeMdRecommenderGalleryExhibit(slotDisplayName, {
    breastSurgeryProductLine:
      firstProductContaining(planItems, /breast/i) ?? productText,
    bodySculptingProductLine:
      firstProductContaining(
        planItems,
        /abdominoplasty|tummy|liposuction|brachioplasty|arm lift/i,
      ) ?? productText,
  }) ?? getJudgeMdRecommenderGalleryExhibit(treatment, {
    breastSurgeryProductLine: productText,
    bodySculptingProductLine: productText,
  });

  if (!exhibit) return [];
  return judgeMdExhibitToDemoPhotos(slotDisplayName || treatment, exhibit).map(
    (photo, index) => ({
      id: `${photo.id}-blueprint`,
      photoUrl: photo.photoUrl,
      treatments: [...photo.treatments, treatment, slotDisplayName].filter(Boolean),
      areaNames: photo.areaNames ?? [],
      caption: "Real results from Judge MD. Individual results may vary.",
      storyTitle: `${slotDisplayName || treatment} results from Judge MD`,
      storyDetailed:
        "This example comes from Judge MD's own public before-and-after gallery, so it reflects real results from this client's provider.",
      sourceLabel: "Judge MD gallery",
      sourceUrl: exhibit.pageUrl,
      providerResultLabel: "From your provider",
      age: index === 0 ? undefined : photo.age,
      skinType: photo.skinType,
      skinTone: photo.skinTone,
      ethnicBackground: photo.ethnicBackground,
    }),
  );
}

function buildCuratedBlueprintCaseFallbacks(
  slotDisplayName: string,
  treatment: string,
  planItems: DiscussedItem[],
  providerCode?: string | null,
): BlueprintCasePhoto[] {
  const out: BlueprintCasePhoto[] = [];
  if (isJudgeMdProviderCode(providerCode ?? undefined)) {
    out.push(
      ...buildJudgeMdProviderBlueprintCases(
        slotDisplayName,
        treatment,
        planItems,
      ),
    );
  }
  out.push(...getPublicBlueprintCasesForPlanItems(planItems));
  return out;
}

/**
 * One card per treatment category in the plan, with ranked outcome photos from the explorer.
 */
export function buildTreatmentResultsCards(
  discussedItems: DiscussedItem[],
  allPhotos: BlueprintCasePhoto[],
  patient: { skinType?: string | null; skinTone?: string | null; ethnicBackground?: string | null },
  maxPhotosPerTreatment = 6,
  providerCode?: string | null,
): TreatmentResultsCard[] {
  const priceList = getEffectivePriceList(undefined, providerCode);
  const schedule = buildBlueprintChapterSchedule(discussedItems, providerCode ?? undefined);
  return schedule.map((slot) => {
    const planItems = planItemsForBlueprintChapterSlot(
      slot,
      discussedItems,
      providerCode ?? undefined,
    );
    const treatment = slot.treatment;
    const canonical = canonicalPlanTreatmentName(treatment);
    const meta = TREATMENT_META[canonical] ?? {};
    const catKey = normalizePlanTreatmentCategoryForPricing(canonical);
    const sheetRange = catKey
      ? getPriceRange2025(catKey as DashboardTreatmentCategory, priceList)
      : undefined;
    const priceRange = sheetRange ?? meta.priceRange;
    const explorerMatching = allPhotos.filter(
      (p) =>
        photoMatchesPlanTreatment(p, slot.displayName) ||
        photoMatchesPlanTreatment(p, treatment),
    );
    const curatedFallbacks = buildCuratedBlueprintCaseFallbacks(
      slot.displayName,
      treatment,
      planItems,
      providerCode,
    );
    const planHighlights = planItems.length
      ? Array.from(
          new Set(
            planItems.flatMap((item) => {
              const out: string[] = [];
              if (item.region?.trim()) out.push(normalizeBlueprintAnalysisText(item.region.trim()));
              if (item.product?.trim()) out.push(normalizeBlueprintAnalysisText(item.product.trim()));
              if (item.interest?.trim()) out.push(normalizeBlueprintAnalysisText(item.interest.trim()));
              for (const finding of item.findings ?? []) {
                if (finding.trim()) {
                  out.push(normalizeBlueprintAnalysisText(finding.trim()));
                }
              }
              return out;
            }),
          ),
        )
      : planHighlightsForTreatment(discussedItems, treatment);
    let matching = [...curatedFallbacks, ...explorerMatching];
    if (canonical === "Skincare" && slot.key.includes("::")) {
      const productTokens = collectSkincareProductResultTokens([
        slot.displayName,
        ...planHighlights,
      ]);
      if (productTokens.length > 0) {
        matching = matching.filter(
          (photo) => skincareProductResultScore(photo, productTokens) > 0,
        );
      }
    }
    const ranked = rankMatchingCasePhotos(
      matching,
      slot.displayName || treatment,
      planHighlights,
      patient,
    );
    const photos = ranked.slice(0, maxPhotosPerTreatment);
    const firstItem =
      planItems[0] ?? ({
        id: "_",
        treatment,
      } as DiscussedItem);
    const displayName = getTreatmentDisplayName(firstItem);

    return {
      key: slot.key,
      treatment,
      displayName: slot.displayName || displayName,
      longevity: meta.longevity,
      downtime: meta.downtime,
      priceRange,
      planHighlights,
      photos,
    };
  });
}

/* ── Airtable data helpers (shared by page + TreatmentChapter) ── */

const AIRTABLE_RECORD_ID_RE = /\brec[a-zA-Z0-9]{14,}\b/g;

export function scrubAirtableRecordIds(text: string): string {
  return text.replace(AIRTABLE_RECORD_ID_RE, "").replace(/\s{2,}/g, " ").trim();
}

export function looksLikeAirtableRecordId(value: string): boolean {
  return /^rec[a-zA-Z0-9]{14,}$/i.test(value.trim());
}

export function isRedundantTreatmentSubtitle(
  scrubbedText: string,
  card: TreatmentResultsCard,
): boolean {
  const t = scrubbedText.trim().toLowerCase();
  if (!t) return true;
  const title = card.displayName.trim().toLowerCase();
  const category = card.treatment.trim().toLowerCase();
  return t === title || t === category;
}

export function buildPhotoTagSummary(
  photo: BlueprintCasePhoto,
  card: TreatmentResultsCard,
): string {
  const titleL = card.displayName.trim().toLowerCase();
  const catL = card.treatment.trim().toLowerCase();
  return Array.from(
    new Set(photo.treatments.map((x) => x.trim()).filter(Boolean)),
  )
    .filter((tag) => !looksLikeAirtableRecordId(tag))
    .filter((tag) => {
      const tl = tag.toLowerCase();
      return tl !== titleL && tl !== catL;
    })
    .slice(0, 3)
    .join(" · ");
}

export type CaseDetailPayload = {
  cardTitle: string;
  treatment: string;
  photoUrl: string;
  sourceLabel?: string | null;
  sourceUrl?: string | null;
  providerResultLabel?: string | null;
  story?: string | null;
  caption?: string | null;
  storyDetailed?: string | null;
  tags?: string | null;
  demographics?: string | null;
  longevity?: string;
  downtime?: string;
  priceRange?: string;
  highlights: string[];
};
