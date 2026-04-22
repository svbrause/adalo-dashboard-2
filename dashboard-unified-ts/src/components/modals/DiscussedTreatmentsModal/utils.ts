// Discussed Treatments Modal – pure helpers

import type { Client, DiscussedItem } from "../../../types";
import {
  formatPlanScheduledDateLabel,
  formatPlanScheduledDateLongLabel,
  formatPlanScheduledDateShortNoYear,
  isValidPlanScheduledDateIso,
} from "../../../utils/planScheduledDate";
import { isJudgeMdSurgeryPlanCategory } from "../../../data/judgeMdPricing2026";
import {
  ASSESSMENT_FINDINGS_BY_AREA,
  FINDING_TO_GOAL_REGION_TREATMENTS,
  GOAL_TO_REGIONS,
  ALL_INTEREST_OPTIONS,
  INTEREST_TO_TREATMENTS,
  OTHER_LABEL,
  OTHER_FINDING_LABEL,
  REGION_OPTIONS,
  RECOMMENDED_PRODUCTS_BY_CONTEXT,
  TREATMENT_GOAL_ONLY,
  TREATMENT_PRODUCT_OPTIONS,
  OTHER_PRODUCT_LABEL,
  getTreatmentOptionsForProvider,
  getTreatmentProductOptionsForProvider,
  isEnergyTreatmentCategory,
  QUANTITY_QUICK_OPTIONS_DEFAULT,
  QUANTITY_OPTIONS_FILLER,
  QUANTITY_OPTIONS_TOX,
  QUANTITY_OPTIONS_BIOSTIMULANTS,
  QUANTITY_OPTIONS_RADIESSE,
  QUANTITY_OPTIONS_SCULPTRA,
  TIMELINE_SKINCARE,
} from "./constants";
import {
  getWellnestOfferingByTreatmentName,
  isWellnestDeliveryFormProductLine,
  isWellnestWellnessProviderCode,
  WELLNEST_OFFERINGS,
} from "../../../data/wellnestOfferings";
import { patientFacingSkincareShortName } from "../../../utils/pvbSkincareDisplay";
import {} from "../../../data/treatmentPricing2025";

/** Strip trailing " · $123" from recommender / Airtable option values. */
export function stripOptionalRecommenderPriceFromLabel(value: string): string {
  const v = value.trim();
  const idx = v.search(/\s·\s*\$/);
  return idx === -1 ? v : v.slice(0, idx).trim();
}

/**
 * Match comma-separated product tokens to canonical option labels (recommender + checkout).
 */
export function matchProductTokensToOptionList(
  productRaw: string,
  options: string[],
): { matched: string[]; residualParts: string[] } {
  if (!productRaw.trim()) return { matched: [], residualParts: [] };
  const parts = productRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const matched: string[] = [];
  const residualParts: string[] = [];
  for (const p of parts) {
    const exact = options.find((o) => o.toLowerCase() === p.toLowerCase());
    if (exact) {
      if (!matched.includes(exact)) matched.push(exact);
      continue;
    }
    const partial = options.find(
      (o) =>
        o.toLowerCase().includes(p.toLowerCase()) ||
        p.toLowerCase().includes(o.toLowerCase()),
    );
    if (partial) {
      if (!matched.includes(partial)) matched.push(partial);
    } else {
      residualParts.push(p);
    }
  }
  return { matched, residualParts };
}

/**
 * When one UI field lists several procedure types (comma-separated), return each as its own
 * plan row label. Returns null when a single row is correct (one token, or unknown mix).
 */
export function expandCommaSeparatedProductsToPlanRows(
  treatment: string,
  productJoined: string | undefined,
  providerCode: string | undefined,
): string[] | null {
  const t = (treatment ?? "").trim();
  const raw = (productJoined ?? "").trim();
  if (!raw) return null;
  const multiTreatment =
    t === "Other procedures" ||
    isJudgeMdSurgeryPlanCategory(t) ||
    isEnergyTreatmentCategory(t) ||
    t === "Biostimulants" ||
    t === "Microneedling" ||
    t === "Facial Services";
  if (!multiTreatment) return null;

  const opts = getTreatmentProductOptionsForProvider(providerCode, t);
  if (opts && opts.length > 0) {
    const { matched, residualParts } = matchProductTokensToOptionList(
      raw,
      opts,
    );
    if (matched.length > 1) return matched;
    if (matched.length >= 1 && residualParts.length > 0) return null;
  }
  const naive = raw
    .split(",")
    .map((s) => stripOptionalRecommenderPriceFromLabel(s.trim()))
    .filter(Boolean);
  if (naive.length > 1) return naive;
  return null;
}

/** Collapse biostimulant SKUs to Radiesse / Sculptra / Skinvive (or Other / custom). */
export function canonicalBiostimulantProductLabel(value: string): string {
  const v = stripOptionalRecommenderPriceFromLabel(value);
  if (!v) return value;
  if (v === OTHER_PRODUCT_LABEL) return OTHER_PRODUCT_LABEL;
  if (/\bradiesse\b/i.test(v)) return "Radiesse";
  if (/\bsculptra\b/i.test(v)) return "Sculptra";
  if (/\bskinvive\b/i.test(v)) return "Skinvive";
  return v;
}

/** Collapse neurotoxin per-unit SKU names to Botox / Dysport when applicable. */
export function canonicalNeurotoxinProductLabel(value: string): string {
  const v = stripOptionalRecommenderPriceFromLabel(value).trim();
  if (!v) return value;
  if (v.includes("Botox 1-Unit") || /^botox$/i.test(v)) return "Botox";
  if (v.includes("Dysport 1-Unit") || /^dysport$/i.test(v)) return "Dysport";
  return v;
}

export function getRecommendedProducts(
  treatment: string,
  contextString: string,
): string[] {
  if (!contextString.trim()) return [];
  const lower = contextString.toLowerCase();
  const allOptions = TREATMENT_PRODUCT_OPTIONS[treatment];
  if (!allOptions) return [];
  const baseList = allOptions.filter((p) => p !== OTHER_PRODUCT_LABEL);
  const recommended = new Set<string>();
  for (const row of RECOMMENDED_PRODUCTS_BY_CONTEXT) {
    if (row.treatment !== treatment) continue;
    if (row.keywords.some((k) => lower.includes(k))) {
      row.products
        .filter((p) => baseList.includes(p))
        .forEach((p) => recommended.add(p));
    }
  }
  return Array.from(recommended);
}

export function getGoalRegionTreatmentsForFinding(
  finding: string,
): { goal: string; region: string; treatments: string[] } | null {
  if (!finding || finding === OTHER_FINDING_LABEL) return null;
  const lower = finding.toLowerCase();
  for (const row of FINDING_TO_GOAL_REGION_TREATMENTS) {
    if (row.keywords.some((k) => lower.includes(k)))
      return { goal: row.goal, region: row.region, treatments: row.treatments };
  }
  return null;
}

/**
 * Suggested treatments for a list of findings/issues (e.g. from analysis).
 * Returns deduplicated entries with goal, region, and an example finding for prefill.
 * When providerCode is set and restricted to pricing sheet, only treatments in the price list are returned.
 */
export function getSuggestedTreatmentsForFindings(
  findings: string[],
  providerCode?: string | undefined,
): {
  treatment: string;
  goal: string;
  region: string;
  exampleFinding: string;
}[] {
  const allowed = new Set(getTreatmentOptionsForProvider(providerCode));
  const seen = new Set<string>();
  const result: {
    treatment: string;
    goal: string;
    region: string;
    exampleFinding: string;
  }[] = [];
  for (const finding of findings) {
    const mapped = getGoalRegionTreatmentsForFinding(finding);
    if (!mapped) continue;
    for (const treatment of mapped.treatments) {
      if (!allowed.has(treatment)) continue;
      const key = `${treatment}|${mapped.goal}|${mapped.region}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({
        treatment,
        goal: mapped.goal,
        region: mapped.region,
        exampleFinding: finding,
      });
    }
  }
  // Facial-analysis findings map to aesthetic categories only; peptide names are never returned above.
  if (isWellnestWellnessProviderCode(providerCode) && result.length === 0) {
    for (const offering of WELLNEST_OFFERINGS) {
      if (!allowed.has(offering.treatmentName)) continue;
      const key = `${offering.treatmentName}|${offering.category}|Other`;
      if (seen.has(key)) continue;
      seen.add(key);
      const firstAddress =
        offering.addresses.split(/[;,]/)[0]?.trim() || offering.category;
      result.push({
        treatment: offering.treatmentName,
        goal: offering.category,
        region: "Other",
        exampleFinding: firstAddress,
      });
    }
  }
  return result;
}

/** Findings that map to a given treatment (via getGoalRegionTreatmentsForFinding). */
export function getFindingsForTreatment(treatment: string): string[] {
  const lower = (treatment || "").toLowerCase();
  const found: string[] = [];
  for (const areaRow of ASSESSMENT_FINDINGS_BY_AREA) {
    for (const f of areaRow.findings) {
      const mapped = getGoalRegionTreatmentsForFinding(f);
      if (mapped?.treatments.some((t) => t.toLowerCase() === lower))
        found.push(f);
    }
  }
  return found;
}

/** Findings for treatment grouped by area. */
export function getFindingsByAreaForTreatment(
  treatment: string,
): { area: string; findings: string[] }[] {
  const findingsForTx = new Set(getFindingsForTreatment(treatment));
  return ASSESSMENT_FINDINGS_BY_AREA.map(({ area, findings }) => ({
    area,
    findings: findings.filter((f) => findingsForTx.has(f)),
  })).filter((g) => g.findings.length > 0);
}

/** Map treatment → suggested goals and regions (for "add by treatment" flow). */
export function getGoalsAndRegionsForTreatment(treatment: string): {
  goals: string[];
  regions: string[];
} {
  const lower = (treatment || "").toLowerCase();
  const goals = new Set<string>();
  const regions = new Set<string>();
  for (const { keywords, treatments } of INTEREST_TO_TREATMENTS) {
    if (treatments.some((t) => t.toLowerCase() === lower)) {
      for (const g of ALL_INTEREST_OPTIONS) {
        if (keywords.some((k) => g.toLowerCase().includes(k))) goals.add(g);
      }
    }
  }
  for (const { keywords, regions: regs } of GOAL_TO_REGIONS) {
    for (const g of goals) {
      if (keywords.some((k) => g.toLowerCase().includes(k)))
        regs.forEach((r) => regions.add(r));
    }
  }
  if (goals.size === 0)
    return { goals: [...ALL_INTEREST_OPTIONS], regions: [...REGION_OPTIONS] };
  if (regions.size === 0)
    return { goals: Array.from(goals), regions: [...REGION_OPTIONS] };
  return { goals: Array.from(goals), regions: Array.from(regions) };
}

/** Suggested treatments for an interest/goal. When providerCode is set and restricted to pricing sheet, only returns treatments that exist in the price list. */
export function getTreatmentsForInterest(
  interest: string,
  providerCode?: string | undefined,
): string[] {
  const allowed = getTreatmentOptionsForProvider(providerCode);
  if (!interest || interest === OTHER_LABEL) return [...allowed];
  const lower = interest.toLowerCase();
  const matched = new Set<string>();
  for (const { keywords, treatments } of INTEREST_TO_TREATMENTS) {
    if (keywords.some((k) => lower.includes(k))) {
      treatments.forEach((t) => matched.add(t));
    }
  }
  const base = matched.size > 0 ? Array.from(matched) : [...allowed];
  const filtered = base.filter((t) => allowed.includes(t));
  if (isWellnestWellnessProviderCode(providerCode) && filtered.length === 0) {
    return [...allowed];
  }
  return filtered;
}

/** Preset dropdown vs freeform text (e.g. neurotoxin units). */
export type QuantityControl = "select" | "text";

export interface QuantityContext {
  unitLabel: string;
  options: string[];
  quantityControl: QuantityControl;
  /**
   * Default value pre-filled when opening the form.
   * Empty string means the field opens blank (user must enter a value before pricing calculates).
   */
  defaultQuantity: string;
  /** Placeholder text shown in the input when empty. Separate from defaultQuantity so a blank default can still have a hint. */
  inputPlaceholder?: string;
}

/**
 * True when quantity / units / sessions typically drive line-item pricing
 * (neurotoxin units, syringes, vials, sessions, protocol supply counts).
 * Generic "Quantity" chips are treated as optional context only.
 */
export function quantityAffectsPlanPricing(ctx: QuantityContext): boolean {
  if (ctx.quantityControl === "text") return true;
  const u = ctx.unitLabel.toLowerCase();
  return (
    u.includes("syringe") ||
    u.includes("vial") ||
    u.includes("session") ||
    u.includes("supply") ||
    u.includes("protocol")
  );
}

/** Skincare omits quantity above the fold; everything else uses {@link quantityAffectsPlanPricing}. */
export function shouldShowProminentPlanQuantity(
  treatment: string | undefined,
  product?: string,
): boolean {
  const t = treatment?.trim() ?? "";
  if (!t || t === "Skincare") return false;
  return quantityAffectsPlanPricing(getQuantityContext(t, product));
}

export function getQuantityContext(
  treatment: string | undefined,
  product?: string,
): QuantityContext {
  const select = (
    unitLabel: string,
    options: readonly string[],
  ): QuantityContext => ({
    unitLabel,
    options: [...options],
    quantityControl: "select",
    defaultQuantity: options[0] ?? "",
  });

  if (!treatment || !treatment.trim()) {
    return select("Quantity", QUANTITY_QUICK_OPTIONS_DEFAULT);
  }
  const t = treatment.trim().toLowerCase();
  if (
    t === "filler" ||
    t.includes("filler") ||
    t === "hyaluronic acid" ||
    t === "ha"
  ) {
    return select("Syringes", QUANTITY_OPTIONS_FILLER);
  }
  if (
    t === "neurotoxin" ||
    t === "tox" ||
    t === "botox" ||
    t.includes("neurotoxin") ||
    t.includes("tox") ||
    t === "dysport" ||
    t === "xeomin"
  ) {
    return {
      unitLabel: "Units (Botox/Dysport)",
      options: [...QUANTITY_OPTIONS_TOX],
      quantityControl: "text",
      defaultQuantity: "",
      inputPlaceholder: "e.g. 20",
    };
  }
  if (t === "biostimulants" || t.includes("biostimulant")) {
    const p = (product ?? "").trim().toLowerCase();
    if (p.includes("radiesse")) {
      return select("Syringes", QUANTITY_OPTIONS_RADIESSE);
    }
    if (p.includes("sculptra")) {
      return select("Vials", QUANTITY_OPTIONS_SCULPTRA);
    }
    return select("Syringes / Vials", QUANTITY_OPTIONS_BIOSTIMULANTS);
  }
  if (t === "other procedures") {
    const p = (product ?? "").trim().toLowerCase();
    if (p.includes("skinvive")) {
      return select("Syringes", QUANTITY_OPTIONS_BIOSTIMULANTS);
    }
    return select("Sessions", QUANTITY_QUICK_OPTIONS_DEFAULT);
  }
  if (
    t === "laser" ||
    t.includes("laser") ||
    t === "energy device" ||
    t.includes("energy device") ||
    t === "energy treatment" ||
    t.includes("energy treatment") ||
    t === "facial services" ||
    t.includes("facial services") ||
    t === "rf" ||
    t === "radiofrequency" ||
    t.includes("radiofrequency") ||
    t === "microneedling" ||
    t.includes("microneedling") ||
    t === "prp" ||
    t === "pdgf"
  ) {
    return select("Sessions", QUANTITY_QUICK_OPTIONS_DEFAULT);
  }
  if (getWellnestOfferingByTreatmentName(treatment)) {
    return select("Supply (protocol)", QUANTITY_QUICK_OPTIONS_DEFAULT);
  }
  return select("Quantity", QUANTITY_QUICK_OPTIONS_DEFAULT);
}

/**
 * Compact label for quantity values on plan lists and meta lines (e.g. "Units: 40", "Sessions: 3").
 * Matches {@link getQuantityContext} so copy aligns with checkout / quote semantics.
 */
export function getPlanQuantityLabelPrefix(
  treatment: string | undefined,
  product?: string,
): string {
  const { unitLabel } = getQuantityContext(treatment, product);
  if (unitLabel === "Units (Botox/Dysport)") return "Units";
  if (unitLabel === "Supply (protocol)") return "Supply";
  if (unitLabel === "Quantity") return "Qty";
  return unitLabel;
}

export function parseInterestedIssues(client: Client): string[] {
  const raw = client.interestedIssues;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((i) => i && String(i).trim());
  return String(raw)
    .split(",")
    .map((i) => i.trim())
    .filter(Boolean);
}

export function generateId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `disc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Maps region/interest/finding text to a single display area (Forehead, Eyes, Lower face, …), or null if no match. */
function normalizeToDisplayArea(
  text: string | null | undefined,
): string | null {
  if (!text || !String(text).trim()) return null;
  const lower = String(text).toLowerCase().trim();
  if (lower.includes("lower face")) return "Lower face";
  if (lower.includes("forehead")) return "Forehead";
  if (
    lower.includes("under eye") ||
    lower.includes("tear trough") ||
    (lower.includes("eye") && !lower.includes("eyebrow"))
  )
    return "Eyes";
  if (
    lower.includes("eyelid") ||
    lower.includes("crow") ||
    lower.includes("bunny")
  )
    return "Eyes";
  if (lower.includes("nasolabial")) return "Nasolabial folds";
  if (lower.includes("nose") || lower.includes("nasal")) return "Nose";
  if (lower.includes("cheek") || lower.includes("mid cheek")) return "Cheeks";
  if (lower.includes("lip")) return "Lips";
  if (lower.includes("chin")) return "Chin";
  if (
    lower.includes("jaw") ||
    lower.includes("jowl") ||
    lower.includes("prejowl")
  )
    return "Jawline";
  if (lower.includes("neck") || lower.includes("platysma")) return "Neck";
  if (lower.includes("full face")) return "Full face";
  if (lower === "skin" || lower.includes("skin")) return "Skin";
  return null;
}

/** Get a single display area for an item: region (normalized), else derived from interest, else from first finding. No "—". */
export function getDisplayAreaForItem(item: DiscussedItem): string | null {
  const fromRegion = normalizeToDisplayArea(item.region);
  if (fromRegion) return fromRegion;
  const fromInterest = normalizeToDisplayArea(item.interest);
  if (fromInterest) return fromInterest;
  if (item.findings?.length) {
    for (const f of item.findings) {
      const a = normalizeToDisplayArea(f);
      if (a) return a;
    }
  }
  return null;
}

/** Bullet character used to separate attributes in one line. */
export const TREATMENT_PLAN_BULLET = " • ";

/**
 * Category-level display name for a treatment item.
 *
 * USE FOR: the detail drawer heading in DiscussedTreatmentsModal, SMS body text
 * (ShareTreatmentPlanModal), and any surface that wants the broad category
 * (e.g. "Laser", "Filler") rather than the specific product.
 *
 * For "Goal only" rows it returns the goal/interest string instead.
 * For Skincare it returns the patient-facing short product name.
 *
 * DO NOT USE for plan list rows or the share-link modal — use
 * {@link getTreatmentPlanRowPrimaryLabel} there so the product name leads.
 */
export function getTreatmentDisplayName(item: DiscussedItem): string {
  if (item.treatment === TREATMENT_GOAL_ONLY && item.interest?.trim()) {
    return item.interest.trim();
  }
  const t = (item.treatment || "").trim();
  if (t === "Skincare" && (item.product || "").trim()) {
    return patientFacingSkincareShortName(item.product!.trim());
  }
  return t || "—";
}

/**
 * Display name specifically for checkout / quote line items.
 *
 * USE FOR: the label string passed into `getCheckoutSummaryWithSkus` and
 * `getAlignedCheckoutLineItemsForDiscussedItems` (i.e. TreatmentPlanCheckout,
 * ShareTreatmentPlanLinkModal pricing lines). It leads with the chosen product
 * or device (Ultherapy, Moxi, Juvederm) — not the broad category — so the SKU
 * lookup can match correctly. Skincare rows keep the full boutique string.
 *
 * DO NOT USE for list row headings — use {@link getTreatmentPlanRowPrimaryLabel}
 * so Skincare gets the shorter patient-facing name.
 */
export function getCheckoutDisplayName(item: DiscussedItem): string {
  if (
    (item.treatment || "").trim() === "Skincare" &&
    (item.product || "").trim()
  ) {
    return item.product!.trim();
  }
  const treatment = (item.treatment || "").trim();
  const product = stripOptionalRecommenderPriceFromLabel(
    (item.product || "").trim(),
  );
  if (
    product &&
    product !== OTHER_PRODUCT_LABEL &&
    !isWellnestDeliveryFormProductLine(treatment, product)
  ) {
    return product;
  }
  return getTreatmentDisplayName(item);
}

/** Build metadata line only: area, product, quantity (no treatment name, no timeline — sections already group by timeline). */
export function formatTreatmentPlanRecordMetaLine(item: DiscussedItem): string {
  const parts: string[] = [];
  const area = getDisplayAreaForItem(item);
  if (area) parts.push(area);
  const product = stripOptionalRecommenderPriceFromLabel(
    (item.product || "").trim(),
  );
  const isSkincare = (item.treatment || "").trim() === "Skincare";
  if (product && !isSkincare) parts.push(product);
  if (item.quantity && String(item.quantity).trim()) {
    const qLabel = getPlanQuantityLabelPrefix(
      item.treatment,
      isSkincare ? undefined : product || undefined,
    );
    parts.push(`${qLabel}: ${item.quantity}`);
  }
  return parts.join(TREATMENT_PLAN_BULLET);
}

/**
 * Product-first label for plan list rows and the share-link modal.
 *
 * USE FOR: every place the treatment shows up as a named list row — [Name]'s
 * plan in DiscussedTreatmentsModal (PlanListColumn), the inline plan list in
 * TreatmentRecommenderByTreatment, and the row titles in ShareTreatmentPlanLinkModal.
 *
 * Leads with the chosen product or device (e.g. "Moxi", "Juvederm") when set,
 * falling back to the broad category. This is intentionally different from
 * {@link getTreatmentDisplayName}, which returns the category first.
 * Pair with {@link getTreatmentPlanRowSecondaryLabel} for the sub-line.
 */
export function getTreatmentPlanRowPrimaryLabel(item: DiscussedItem): string {
  if (item.treatment === TREATMENT_GOAL_ONLY && item.interest?.trim()) {
    return item.interest.trim();
  }
  const treatment = (item.treatment || "").trim();
  const product = stripOptionalRecommenderPriceFromLabel(
    (item.product || "").trim(),
  );
  if (treatment === "Skincare" && product) {
    return patientFacingSkincareShortName(product);
  }
  // Wellnest: delivery dropdown (e.g. "Nasal spray available") must not replace the peptide name.
  if (product && !isWellnestDeliveryFormProductLine(treatment, product)) {
    return product;
  }
  return treatment || "—";
}

/**
 * User-facing label for a stored timeline value or plan section key.
 * Canonical stored value stays `"Add next visit"` for persistence.
 */
export function timelineOptionDisplayLabel(stored: string): string {
  if (stored === "Add next visit") return "Next Visit";
  return stored;
}

/**
 * Short timing phrase for the plan row sub-line (with {@link getDisplayAreaForItem}).
 * Prefer scheduled date when set; otherwise maps timeline values to compact labels.
 * **Now** is omitted — the plan section already groups those rows under “Now”.
 */
export function getTreatmentPlanRowTimingLabel(
  item: DiscussedItem,
): string | null {
  const scheduled = formatPlanScheduledDateLabel(item.scheduledDate);
  if (scheduled) return scheduled;
  const t = (item.timeline ?? "").trim();
  if (t === "Now") return null;
  if (t === "Add next visit") return timelineOptionDisplayLabel("Add next visit");
  if (t === "Completed") return null;
  if (t === "Wishlist" || !t) return "Wishlist";
  if (t === TIMELINE_SKINCARE) return null;
  return t;
}

/**
 * Timeline / wishlist words for meta lines. When a **scheduled date** is set, the
 * calendar date is omitted here so it can be shown once as “Planned for …” (see
 * {@link plannedForPatientLineFromDiscussedItem}).
 */
export function getTreatmentPlanRowTimelineWordsSansScheduledDate(
  item: DiscussedItem,
): string | null {
  if (isValidPlanScheduledDateIso(item.scheduledDate)) {
    const t = (item.timeline ?? "").trim();
    if (t === "Now") return null;
    if (t === "Add next visit")
      return timelineOptionDisplayLabel("Add next visit");
    if (t === "Completed") return null;
    if (t === "Wishlist" || !t) return "Wishlist";
    if (t === TIMELINE_SKINCARE) return null;
    return t;
  }
  return getTreatmentPlanRowTimingLabel(item);
}

/** One line: “Planned for Jan 15” (no year), or null if no scheduled day. */
export function plannedForPatientLineFromDiscussedItem(
  item: DiscussedItem,
): string | null {
  if (!isValidPlanScheduledDateIso(item.scheduledDate)) return null;
  const short = formatPlanScheduledDateShortNoYear(item.scheduledDate);
  if (!short) return null;
  return `Planned for ${short}`;
}

/** Patient blueprint / summary: “Planned for July 20, 2026”, or null if no scheduled day. */
export function plannedForPatientLineFullDateFromDiscussedItem(
  item: DiscussedItem,
): string | null {
  if (!isValidPlanScheduledDateIso(item.scheduledDate)) return null;
  const full = formatPlanScheduledDateLongLabel(item.scheduledDate);
  if (!full) return null;
  return `Planned for ${full}`;
}

/** Options for plan row labels when a parent heading or line already states timing. */
export type TreatmentPlanRowLabelOpts = {
  /**
   * When true, the sub-line is **area only** (no timeline / wishlist wording).
   * Use when the row sits under a timeline section title, an SMS section header,
   * or a dedicated timing line that already shows the same timing.
   */
  omitTimeline?: boolean;
};

/**
 * Supporting sub-line shown directly under {@link getTreatmentPlanRowPrimaryLabel}.
 *
 * USE FOR: the secondary/meta text below the main label in plan list rows.
 * Shows **where** (area) and **when** (timeline or scheduled date) only — not
 * quantity or treatment category, so the primary line carries product/device.
 */
export function getTreatmentPlanRowSecondaryLabel(
  item: DiscussedItem,
  opts?: TreatmentPlanRowLabelOpts,
): string | null {
  const area = getDisplayAreaForItem(item);
  const timing = opts?.omitTimeline
    ? null
    : getTreatmentPlanRowTimelineWordsSansScheduledDate(item);
  const parts = [area, timing].filter(
    (p): p is string => typeof p === "string" && p.trim().length > 0,
  );
  return parts.length ? parts.join(TREATMENT_PLAN_BULLET) : null;
}

/** Accessible / confirm copy: primary • secondary when both exist. */
export function formatTreatmentPlanRowFullLine(
  item: DiscussedItem,
  opts?: TreatmentPlanRowLabelOpts,
): string {
  const primary = getTreatmentPlanRowPrimaryLabel(item);
  const secondary = getTreatmentPlanRowSecondaryLabel(item, opts);
  return secondary
    ? `${primary}${TREATMENT_PLAN_BULLET}${secondary}`
    : primary;
}

/** Build a single line of non-empty parts: treatment, area, product, quantity (timeline omitted; sections group by timeline). */
export function formatTreatmentPlanRecordLine(item: DiscussedItem): string {
  const heading = getTreatmentDisplayName(item);
  const meta = formatTreatmentPlanRecordMetaLine(item);
  return heading && meta
    ? `${heading}${TREATMENT_PLAN_BULLET}${meta}`
    : heading || meta;
}
