import type { DiscussedItem } from "../types";
import type { PatientSuggestionCard } from "../services/api";
import { TREATMENT_META } from "../components/modals/DiscussedTreatmentsModal/constants";
import { getTreatmentDisplayName } from "../components/modals/DiscussedTreatmentsModal/utils";
import {
  normalizeBlueprintAnalysisText,
  type PlanTreatmentRow,
} from "./postVisitBlueprintAnalysis";

export type BlueprintCasePhoto = {
  id: string;
  photoUrl: string;
  treatments: string[];
  age?: string;
  skinType?: string;
  skinTone?: string;
  ethnicBackground?: string;
  caption?: string;
  storyTitle?: string;
  /** Photos table “Story Detailed” — longer narrative shown in Results like yours + case sheet. */
  storyDetailed?: string;
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

/** Map high-level plan treatment → keywords that appear on Treatment Explorer photo tags */
const PLAN_TREATMENT_TO_PHOTO_KEYWORDS: Record<string, string[]> = {
  "energy device": [
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
  ],
  "chemical peel": ["chemical", "peel", "tca", "glycolic", "jessner", "vi peel", "salicylic", "mandelic"],
  microneedling: ["microneed", "nanoneed", "prp", "prfm", "skinpen", "rf microneed"],
  filler: ["filler", "hyaluronic", "juvederm", "restylane", "versa", "belotero", "tear trough", "ha "],
  neurotoxin: ["neurotoxin", "botox", "dysport", "xeomin", "jeuveau", "daxxify", "tox"],
  biostimulants: ["biostim", "sculptra", "radiesse", "prf"],
  kybella: ["kybella", "deoxycholic"],
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

/** First explorer photo URL for a plan row (matches display name, then normalized key). */
export function pickCasePhotoUrlForPlanRow(
  row: PlanTreatmentRow,
  pool: BlueprintCasePhoto[],
): string | null {
  if (!pool.length) return null;
  const candidates = pool.filter(
    (p) =>
      photoMatchesPlanTreatment(p, row.displayName) ||
      photoMatchesPlanTreatment(p, row.key),
  );
  return candidates[0]?.photoUrl ?? null;
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
): string | null {
  const fromCard = matchedCard?.photoUrl?.trim();
  if (fromCard) return fromCard;
  const fromCases = pickCasePhotoUrlForPlanRow(row, pool);
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

function uniqueOrderedTreatments(items: DiscussedItem[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const t = item.treatment?.trim();
    if (!t) continue;
    const key = norm(t);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function planHighlightsForTreatment(items: DiscussedItem[], treatment: string): string[] {
  const parts = new Set<string>();
  const tNorm = norm(treatment);
  for (const item of items) {
    if (norm(item.treatment ?? "") !== tNorm) continue;
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

/**
 * One card per treatment category in the plan, with ranked outcome photos from the explorer.
 */
export function buildTreatmentResultsCards(
  discussedItems: DiscussedItem[],
  allPhotos: BlueprintCasePhoto[],
  patient: { skinType?: string | null; skinTone?: string | null; ethnicBackground?: string | null },
  maxPhotosPerTreatment = 6,
): TreatmentResultsCard[] {
  const treatments = uniqueOrderedTreatments(discussedItems);
  return treatments.map((treatment) => {
    const meta = TREATMENT_META[treatment] ?? {};
    const matching = allPhotos.filter((p) => photoMatchesPlanTreatment(p, treatment));
    matching.sort((a, b) => demographyScore(b, patient) - demographyScore(a, patient));
    const photos = matching.slice(0, maxPhotosPerTreatment);
    const firstItem =
      discussedItems.find((i) => norm(i.treatment ?? "") === norm(treatment)) ?? ({
        id: "_",
        treatment,
      } as DiscussedItem);
    const displayName = getTreatmentDisplayName(firstItem);

    return {
      key: norm(treatment),
      treatment,
      displayName,
      longevity: meta.longevity,
      downtime: meta.downtime,
      priceRange: meta.priceRange,
      planHighlights: planHighlightsForTreatment(discussedItems, treatment),
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
