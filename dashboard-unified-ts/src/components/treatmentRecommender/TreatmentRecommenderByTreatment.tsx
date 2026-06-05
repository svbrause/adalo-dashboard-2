/**
 * Treatment Recommender – by treatment.
 * Full-width treatment cards with feature breakdown and Add to plan.
 */

import {
  useCallback,
  useMemo,
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  Fragment,
} from "react";
import { createPortal } from "react-dom";
import { useDashboard } from "../../context/DashboardContext";
import { Client, TreatmentPhoto, DiscussedItem } from "../../types";
import {
  fetchTreatmentPhotos,
  fetchTableRecords,
  sendSMSNotification,
  extractRecommenderOptionsFromPricingJson,
  createTreatmentRecommenderCustomOption,
  deleteTreatmentRecommenderOption,
  updateTreatmentRecommenderOption,
  updateTreatmentRecommenderOptionOrder,
  type TreatmentRecommenderOptionType,
} from "../../services/api";
import { getClientFrontPhotoDisplayUrl } from "../../utils/photoLoading";
import { getWellnestDemoPhotoUrls } from "../../debug/wellnestDemoPhotos";
import {
  getWellnestOfferingByTreatmentName,
  getWellnestProductOptionsForTreatment,
  isWellnestWellnessProviderCode,
  WELLNEST_BROWSE_GROUP_LABELS,
  WELLNEST_REGULATORY_NOTICE,
} from "../../data/wellnestOfferings";
import { isSlimStudioProvider } from "../../data/slimStudioOfferings";
import {
  getWellnessQuizMatchReasons,
  scoreIntakeGoalsAgainstWellnestCorpus,
  type IntakeGoalMatchResult,
  WELLNESS_TREATMENTS,
} from "../../data/wellnessQuiz";
import {
  getWellnestExampleTalkingPoints,
  getWellnestRecommenderImageUrl,
} from "../../data/wellnestRecommenderPresentation";
import {
  getWellnestExternalExamplesForOffering,
  WELLNEST_EXTERNAL_LINKS_DISCLAIMER,
  type WellnestExternalExample,
  type WellnestExternalExampleKind,
} from "../../data/wellnestExternalExamples";
import type { TreatmentRecommenderCustomOption } from "../../services/api";
import type { AirtableRecord } from "../../services/api";
import {
  normalizeIssue,
  scoreTier,
  tierColor,
  scoreIssues,
  CATEGORIES,
} from "../../config/analysisOverviewConfig";
import {
  DEFAULT_RECOMMENDER_FILTER_STATE,
  filterTreatmentsBySameDay,
  filterTreatmentsByRegion,
  getFindingsFromConcerns,
  getInternalRegionForFilter,
  treatmentRecommenderCatalogSearchMatches,
  type TreatmentRecommenderFilterState,
} from "../../config/treatmentRecommenderConfig";
import {
  getSuggestedTreatmentsForFindings,
  getFindingsByAreaForTreatment,
  formatTreatmentPlanRowFullLine,
  getTreatmentPlanRowPrimaryLabel,
  getTreatmentPlanRowSecondaryLabel,
  getQuantityContext,
  buildDiscussedBiostimQuantityFields,
  resolveTreatmentIntervalForPlanItem,
  shouldStoreTreatmentInterval,
  shouldShowProminentPlanQuantity,
  canonicalBiostimulantProductLabel,
  canonicalNeurotoxinProductLabel,
  stripOptionalRecommenderPriceFromLabel,
  matchProductTokensToOptionList,
  expandCommaSeparatedProductsToPlanRows,
  timelineOptionDisplayLabel,
} from "../modals/DiscussedTreatmentsModal/utils";
import {
  REGION_OPTIONS,
  REGION_OPTIONS_MICRONEEDLING,
  ENERGY_TREATMENT_WHERE_OPTIONS,
  CHEMICAL_PEEL_AREA_OPTIONS,
  MICRONEEDLING_TYPE_OPTIONS,
  TIMELINE_OPTIONS,
  TIMELINE_SKINCARE,
  PLAN_SECTIONS,
  SCHEDULED_SECTION_LABEL,
  SKINCARE_SECTION_LABEL,
  getTreatmentProductOptionsForProvider,
  getSkincareCarouselItems,
  ASSESSMENT_FINDINGS,
  OTHER_PRODUCT_LABEL,
  OTHER_FINDING_LABEL,
  SKINCARE_CATEGORY_OPTIONS,
  SKINCARE_USE_CASE_LABELS,
  getTreatmentOptionsForProvider,
  getCheckoutTreatmentTypeOptionsForProvider,
  toProviderTreatmentContext,
  ENERGY_TREATMENT_CATEGORY,
  LEGACY_ENERGY_DEVICE_CATEGORY,
  isEnergyTreatmentCategory,
  PRFM_INJECTION_WHERE_OPTIONS,
} from "../modals/DiscussedTreatmentsModal/constants";
import {
  GEMSTONE_BY_SKIN_TYPE,
  buildQuizSkincareRoutineSections,
  computeQuizScores,
  SKIN_TYPE_DISPLAY_LABELS,
  SKIN_TYPE_SCORE_ORDER,
} from "../../data/skinTypeQuiz";
import { showError, showToast } from "../../utils/toast";
import {
  cleanPhoneNumber,
  formatPhoneDisplay,
  isValidPhone,
} from "../../utils/validation";
import type {
  TreatmentPlanAddDirectOptions,
  TreatmentPlanPrefill,
} from "../modals/DiscussedTreatmentsModal/TreatmentPhotos";
import { getAlignedCheckoutLineItemsForDiscussedItems } from "../modals/DiscussedTreatmentsModal/TreatmentPlanCheckout";
import { planPricingWarningShort } from "../../utils/planPricingWarnings";
import { WELLNEST_CURATED_BLUEPRINT_CASES } from "../../data/wellnestCuratedBlueprintCases";
import {
  formatPlanScheduledDateLabel,
  isValidPlanScheduledDateIso,
  planItemsLastUpdatedShortLabel,
} from "../../utils/planScheduledDate";
import { buildPlanCalendarAgendaFromDiscussedItems } from "../../utils/pvbPlanCalendarAgenda";
import {
  photoMatchesPlanTreatment,
  type BlueprintCasePhoto,
} from "../../utils/postVisitBlueprintCases";
import {
  getEffectivePriceList,
  getBiostimulantTypeOptionLabels,
  getNeurotoxinTypeOptionLabels,
  getSkuOptionsForCategory,
  getPriceListLabelsForTreatmentRecommenderSearch,
  parseProviderPricingDocument,
  type ProviderPricingJson,
} from "../../data/treatmentPricing2025";
import {
  buildJudgeMdPlanBuilderRowSpecs,
  buildJudgeMdPlanBuilderTreatmentOrder,
  isJudgeMdNonsurgicalPlanBuilderTreatment,
  isJudgeMdProviderCode,
  isJudgeMdSurgeryPlanCategory,
  JUDGEMD_TREATMENT_SKINCARE_PAIRINGS,
} from "../../data/judgeMdPricing2026";
import {
  getJudgeMdRecommenderGalleryExhibit,
  isJudgeMdPlanBuilderGalleryEyeTreatment,
  judgeMdExhibitToDemoPhotos,
} from "../../data/judgeMdGalleryExhibit";
import { PlanQuantityStepperInput } from "./planQuantityStepper";

import TreatmentPhotosModal from "../modals/TreatmentPhotosModal";
import PhotoViewerModal from "../modals/PhotoViewerModal";
import "../modals/AnalysisOverviewModal.css";
import "./TreatmentRecommenderByTreatment.css";

/** Biostimulants before/after image for the treatment card. */

/** Safe fragment for DOM ids in optional-details sections (treatment names may include spaces). */
function planOptDomIdSuffix(treatmentName: string): string {
  const s = treatmentName
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9_-]/g, "");
  return s.length > 0 ? s : "treatment";
}

function usesJudgeMdSurgeryStructuredPlan(treatment: string): boolean {
  return isJudgeMdSurgeryPlanCategory(treatment);
}

function usesOtherProceduresStructuredPlan(treatment: string): boolean {
  return treatment === "Other procedures" || usesJudgeMdSurgeryStructuredPlan(treatment);
}

function usesOtherProceduresMultiSelectProduct(treatment: string): boolean {
  return treatment === "Other procedures" || usesJudgeMdSurgeryStructuredPlan(treatment);
}

/** Product / type string used with {@link getQuantityContext} (matches checkout labeling). */
function treatmentProductHintForQuantity(row: {
  treatment: string;
  skincareWhat?: string[];
  skincareCategoryFilter?: string[];
  laserWhat?: string[];
  biostimulantWhat?: string[];
  microneedlingType?: string[];
  facialServiceWhat?: string[];
  product?: string;
  deliveryForm?: string;
}): string | undefined {
  const isSkincare = row.treatment === "Skincare";
  const isLaser = isEnergyTreatmentCategory(row.treatment);
  const isBiostimulants = row.treatment === "Biostimulants";
  const wellnestOffering = getWellnestOfferingByTreatmentName(row.treatment);
  if (wellnestOffering) {
    return row.deliveryForm?.trim() || row.product?.trim() || undefined;
  }
  if (isSkincare) {
    return row.skincareWhat?.length
      ? row.skincareWhat.join(", ")
      : row.skincareCategoryFilter?.length
        ? row.skincareCategoryFilter.join(", ")
        : row.product?.trim() || undefined;
  }
  if (isLaser) {
    return row.laserWhat?.length
      ? row.laserWhat.join(", ")
      : row.product?.trim() || undefined;
  }
  if (isBiostimulants) {
    return row.biostimulantWhat?.length
      ? row.biostimulantWhat.join(", ")
      : row.product?.trim() || undefined;
  }
  if (row.treatment === "Microneedling") {
    return row.microneedlingType?.length
      ? row.microneedlingType.join(", ")
      : row.product?.trim() || undefined;
  }
  if (row.treatment === "Facial Services") {
    return row.facialServiceWhat?.length
      ? row.facialServiceWhat.join(", ")
      : row.product?.trim() || undefined;
  }
  return row.product?.trim() || undefined;
}

/** Free-text Product in optional details is redundant when type/area/products are chosen above the fold. */
function treatmentUsesStructuredProductSelectors(treatment: string): boolean {
  const t = (treatment ?? "").trim();
  return (
    t === "Skincare" ||
    isEnergyTreatmentCategory(t) ||
    t === "Biostimulants" ||
    t === "Microneedling" ||
    t === "Chemical Peel" ||
    t === "Facial Services" ||
    t === "Neurotoxin" ||
    t === "Filler" ||
    t === "Other procedures" ||
    isJudgeMdSurgeryPlanCategory(t)
  );
}

/** Default row when opening the inline add-to-plan form (quantity preset from checkout-style options). */
function initialAddToPlanRowForTreatment(
  treatment: string,
  wellnestOffering: ReturnType<typeof getWellnestOfferingByTreatmentName>,
  wellnestDefaultDeliveryForm: string,
  wellnestDefaultDosing: string,
) {
  const row = {
    treatment,
    where: [] as string[],
    skincareWhat: treatment === "Skincare" ? ([] as string[]) : undefined,
    skincareCategoryFilter:
      treatment === "Skincare" ? ([] as string[]) : undefined,
    laserWhat: isEnergyTreatmentCategory(treatment) ? ([] as string[]) : undefined,
    biostimulantWhat:
      treatment === "Biostimulants" ? ([] as string[]) : undefined,
    microneedlingType:
      treatment === "Microneedling" ? ([] as string[]) : undefined,
    facialServiceWhat:
      treatment === "Facial Services" ? ([] as string[]) : undefined,
    when: TIMELINE_OPTIONS[0],
    scheduledDate: undefined as string | undefined,
    detailsExpanded: false,
    product: "",
    notes: "",
    deliveryForm: wellnestOffering ? wellnestDefaultDeliveryForm : "",
    dosing: wellnestOffering ? wellnestDefaultDosing : "",
    wellnestUsedFor: [] as string[],
    findings: [] as string[],
    bioTreatmentSessions: "",
    treatmentInterval: "",
    skincareAddOns: [] as string[],
  };
  const quantity =
    treatment === "Skincare"
      ? ""
      : getQuantityContext(treatment, treatmentProductHintForQuantity(row))
          .defaultQuantity;
  return { ...row, quantity };
}

type AddPlanFormState = ReturnType<typeof initialAddToPlanRowForTreatment>;

function getWellnestDeliveryDefaults(treatment: string): {
  deliveryForm: string;
  dosing: string;
} {
  const wellnestOffering = getWellnestOfferingByTreatmentName(treatment);
  if (!wellnestOffering) return { deliveryForm: "", dosing: "" };
  const options = getWellnestProductOptionsForTreatment(treatment);
  const deliveryForm =
    options.find((o) => o.toLowerCase().includes("sc")) ??
    options.find((o) => o.toLowerCase().includes("sub")) ??
    options[0] ??
    "SubQ";
  return { deliveryForm, dosing: getWellnestDefaultDosing(wellnestOffering) };
}

function parseStructuredPlanNotes(
  notes: string | undefined,
  forWellnest: boolean,
): {
  deliveryForm: string;
  dosing: string;
  usedFor: string[];
  freeNotes: string;
} {
  if (!forWellnest) {
    return {
      deliveryForm: "",
      dosing: "",
      usedFor: [],
      freeNotes: notes?.trim() ?? "",
    };
  }
  if (!notes?.trim()) {
    return { deliveryForm: "", dosing: "", usedFor: [], freeNotes: "" };
  }
  const parts = notes
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  let deliveryForm = "";
  let dosing = "";
  let usedFor: string[] = [];
  const rest: string[] = [];
  for (const part of parts) {
    if (/^delivery form:/i.test(part)) {
      deliveryForm = part.replace(/^delivery form:\s*/i, "").trim();
    } else if (/^dosing:/i.test(part)) {
      dosing = part.replace(/^dosing:\s*/i, "").trim();
    } else if (/^used for:/i.test(part)) {
      const raw = part.replace(/^used for:\s*/i, "").trim();
      usedFor = raw
        .split(/;/)
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      rest.push(part);
    }
  }
  return {
    deliveryForm,
    dosing,
    usedFor,
    freeNotes: rest.join(" | "),
  };
}

function parseWhereFromDiscussedRegion(
  region: string,
  treatment: string,
): string[] {
  const raw = region.trim();
  if (!raw) return [];
  if (isJudgeMdSurgeryPlanCategory(treatment)) return [];
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const opts: readonly string[] =
    isEnergyTreatmentCategory(treatment)
      ? ENERGY_TREATMENT_WHERE_OPTIONS
      : treatment === "Microneedling"
      ? REGION_OPTIONS_MICRONEEDLING
      : treatment === "Chemical Peel"
        ? CHEMICAL_PEEL_AREA_OPTIONS
        : treatment === "Other procedures"
          ? [...PRFM_INJECTION_WHERE_OPTIONS]
          : REGION_OPTIONS.filter((r) => r !== "Multiple" && r !== "Other");
  const out: string[] = [];
  for (const p of parts) {
    if (opts.includes(p)) {
      if (!out.includes(p)) out.push(p);
      continue;
    }
    const found = opts.find((o) => o.toLowerCase() === p.toLowerCase());
    if (found && !out.includes(found)) out.push(found);
  }
  return out;
}

/** Map stored plan rows to split type vs Where for Other procedures (legacy compound labels). */
function normalizeLegacyOtherProcedureProduct(
  productRaw: string,
  regionRaw: string,
): { product: string; where: string[] } {
  const p = productRaw.trim();
  if (!p) return { product: "", where: [] };

  const scalpLegacy =
    /^PRFM injections\s*[–-]\s*scalp/i.test(p) ||
    p === "PRFM injections – scalp (hair restoration)";
  if (scalpLegacy) {
    return { product: "PRFM scalp (hair restoration)", where: [] };
  }
  if (/^PRFM injections\s*[–-]\s*under\s*eyes?/i.test(p)) {
    return { product: "PRFM injections", where: ["Under eyes"] };
  }
  if (/^PRFM injections\s*[–-]\s*nasolabial/i.test(p)) {
    return { product: "PRFM injections", where: ["Nasolabial folds"] };
  }
  if (p === "PRFM injections") {
    return {
      product: p,
      where: parseWhereFromDiscussedRegion(regionRaw, "Other procedures"),
    };
  }
  return { product: p, where: [] };
}

/**
 * Extra tokens merged into treatment search — category titles alone miss common queries
 * (e.g. "Voluma" under Filler, "BBL" under Energy Treatment, "pdgf" under Microneedling).
 */
function extraTextForTreatmentSearch(
  treatment: string,
  provider: import("../modals/DiscussedTreatmentsModal/constants").ProviderTreatmentContext,
  priceList: ProviderPricingJson,
): string {
  const chunks: string[] = [];

  const productOpts = getTreatmentProductOptionsForProvider(
    provider,
    treatment,
  );
  if (productOpts.length) chunks.push(...productOpts);

  const sheetLabels = getPriceListLabelsForTreatmentRecommenderSearch(
    treatment,
    priceList,
  );
  if (sheetLabels) chunks.push(sheetLabels);

  if (treatment === "Microneedling") {
    const map = getCheckoutTreatmentTypeOptionsForProvider(provider);
    const mic = map.Microneedling ?? [...MICRONEEDLING_TYPE_OPTIONS];
    chunks.push(...mic);
  }

  if (treatment === "Other procedures") {
    chunks.push(...PRFM_INJECTION_WHERE_OPTIONS);
  }

  if (treatment === "Skincare") {
    for (const row of getSkincareCarouselItems()) {
      if (row.name?.trim()) chunks.push(row.name.trim());
    }
  }

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const s of chunks) {
    const t = s.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(t);
  }
  return deduped.join(" ");
}

/** Hydrate the inline add-to-plan form from an existing plan row (for Edit). */
function discussedItemToAddPlanFormState(
  item: DiscussedItem,
  providerCode: string | undefined,
): AddPlanFormState {
  const treatment = (item.treatment ?? "").trim() || "Filler";
  const wellnestOffering = getWellnestOfferingByTreatmentName(treatment);
  const { deliveryForm: wdf, dosing: wdg } =
    getWellnestDeliveryDefaults(treatment);
  const base = initialAddToPlanRowForTreatment(
    treatment,
    wellnestOffering,
    wdf,
    wdg,
  );

  const timeline = (item.timeline ?? "").trim();
  const when =
    timeline && (TIMELINE_OPTIONS as readonly string[]).includes(timeline)
      ? timeline
      : timeline === TIMELINE_SKINCARE
        ? TIMELINE_OPTIONS[0]
        : base.when;

  const parsedNotes = parseStructuredPlanNotes(
    item.notes,
    Boolean(wellnestOffering),
  );
  const deliveryFormWellnest = parsedNotes.deliveryForm.trim() || wdf;
  const dosingWellnest = parsedNotes.dosing.trim() || wdg;
  const wellnestUsedForHydrated = wellnestOffering
    ? parsedNotes.usedFor.length > 0
      ? parsedNotes.usedFor
      : base.wellnestUsedFor
    : base.wellnestUsedFor;

  const productRaw = stripOptionalRecommenderPriceFromLabel(
    (item.product ?? "").trim(),
  );
  const isSkincare = treatment === "Skincare";
  const isLaser = isEnergyTreatmentCategory(treatment);

  let where = base.where;
  if (!isSkincare) {
    where = parseWhereFromDiscussedRegion(item.region ?? "", treatment);
  }

  let laserWhat = base.laserWhat;
  let biostimulantWhat = base.biostimulantWhat;
  let microneedlingType = base.microneedlingType;
  let facialServiceWhat = base.facialServiceWhat;
  let skincareWhat = base.skincareWhat;
  let productFree = "";

  if (isLaser) {
    const opts =
      getTreatmentProductOptionsForProvider(providerCode, ENERGY_TREATMENT_CATEGORY) ??
      [];
    const { matched, residualParts } = matchProductTokensToOptionList(
      productRaw,
      opts,
    );
    laserWhat = matched;
    productFree = residualParts.join(", ");
  } else if (treatment === "Biostimulants") {
    const opts =
      getTreatmentProductOptionsForProvider(providerCode, "Biostimulants") ??
      [];
    const { matched, residualParts } = matchProductTokensToOptionList(
      productRaw,
      opts,
    );
    biostimulantWhat = [
      ...new Set(matched.map((m) => canonicalBiostimulantProductLabel(m))),
    ];
    productFree = residualParts.join(", ");
  } else if (treatment === "Microneedling") {
    const opts = [...MICRONEEDLING_TYPE_OPTIONS];
    const { matched, residualParts } = matchProductTokensToOptionList(
      productRaw,
      opts,
    );
    microneedlingType = matched;
    productFree = residualParts.join(", ");
  } else if (treatment === "Facial Services") {
    const opts =
      getTreatmentProductOptionsForProvider(providerCode, "Facial Services") ??
      [];
    const { matched, residualParts } = matchProductTokensToOptionList(
      productRaw,
      opts,
    );
    facialServiceWhat = matched;
    productFree = residualParts.join(", ");
  } else if (isSkincare) {
    if (productRaw) {
      const parts = productRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      skincareWhat = parts.length ? parts : [productRaw];
    }
  } else if (treatment === "Filler") {
    const opts =
      getTreatmentProductOptionsForProvider(providerCode, "Filler") ?? [];
    const { matched, residualParts } = matchProductTokensToOptionList(
      productRaw,
      opts,
    );
    productFree =
      matched.length > 0
        ? matched[0]
        : residualParts.length > 0
          ? residualParts.join(", ")
          : productRaw;
  } else if (treatment === "Neurotoxin") {
    const opts =
      getTreatmentProductOptionsForProvider(providerCode, "Neurotoxin") ?? [];
    const { matched, residualParts } = matchProductTokensToOptionList(
      productRaw,
      opts,
    );
    const primary =
      matched.length > 0
        ? matched[0]
        : residualParts.length > 0
          ? residualParts.join(", ")
          : productRaw;
    productFree = canonicalNeurotoxinProductLabel(primary);
  } else if (usesOtherProceduresStructuredPlan(treatment)) {
    const otherOpts =
      getTreatmentProductOptionsForProvider(providerCode, treatment) ?? [];
    if (usesJudgeMdSurgeryStructuredPlan(treatment)) {
      if (!productRaw.includes(",")) {
        productFree = productRaw;
        where = [];
      } else {
        const { matched, residualParts } = matchProductTokensToOptionList(
          productRaw,
          otherOpts,
        );
        productFree = [...matched, ...residualParts].filter(Boolean).join(", ");
        where = [];
      }
    } else if (!productRaw.includes(",")) {
      const norm = normalizeLegacyOtherProcedureProduct(
        productRaw,
        item.region ?? "",
      );
      productFree = norm.product;
      if (norm.where.length > 0) {
        where = norm.where;
      } else if (norm.product === "PRFM injections") {
        where = parseWhereFromDiscussedRegion(item.region ?? "", treatment);
      } else {
        where = [];
      }
    } else {
      const { matched, residualParts } = matchProductTokensToOptionList(
        productRaw,
        otherOpts,
      );
      const hasFacialPrfm = matched.some(
        (m) => m.trim().toLowerCase() === "prfm injections",
      );
      productFree = [...matched, ...residualParts].filter(Boolean).join(", ");
      where = hasFacialPrfm
        ? parseWhereFromDiscussedRegion(item.region ?? "", treatment)
        : [];
    }
  } else if (!wellnestOffering) {
    productFree = productRaw;
  }

  const hintRow = {
    treatment,
    skincareWhat,
    skincareCategoryFilter: base.skincareCategoryFilter,
    laserWhat,
    biostimulantWhat,
    microneedlingType,
    facialServiceWhat,
    product: productFree,
    deliveryForm: wellnestOffering ? deliveryFormWellnest : undefined,
    dosing: wellnestOffering ? dosingWellnest : undefined,
  };
  const qtyTrim = (item.quantity ?? "").trim();
  const sessionsTrim = (item.bioTreatmentSessions ?? "").trim();
  const qtyCtxHydrate = getQuantityContext(
    treatment,
    treatmentProductHintForQuantity(hintRow),
    providerCode,
  );
  const quantity =
    treatment === "Skincare"
      ? ""
      : qtyTrim ||
        qtyCtxHydrate.defaultQuantity;
  const bioTreatmentSessions =
    treatment === "Skincare"
      ? ""
      : sessionsTrim
        ? sessionsTrim
        : qtyCtxHydrate.sculptraSessions && !qtyTrim
          ? qtyCtxHydrate.sculptraSessions.defaultSessions
          : qtyCtxHydrate.primaryDiscussedField === "bioTreatmentSessions" &&
              !sessionsTrim
            ? qtyCtxHydrate.defaultQuantity
            : "";

  const scheduledRaw = (item.scheduledDate ?? "").trim();
  const scheduledDate = isValidPlanScheduledDateIso(scheduledRaw)
    ? scheduledRaw
    : undefined;

  return {
    ...base,
    when,
    scheduledDate,
    where,
    laserWhat,
    biostimulantWhat,
    microneedlingType,
    facialServiceWhat,
    skincareWhat,
    product: productFree,
    quantity,
    bioTreatmentSessions,
    treatmentInterval: item.treatmentInterval?.trim() || "",
    notes: parsedNotes.freeNotes,
    deliveryForm: wellnestOffering ? deliveryFormWellnest : base.deliveryForm,
    dosing: wellnestOffering ? dosingWellnest : base.dosing,
    detailsExpanded: false,
    wellnestUsedFor: wellnestUsedForHydrated,
    findings: item.findings?.length ? [...item.findings] : [],
  };
}

/** Map Airtable record to TreatmentPhoto for card thumbnails. */
function mapRecordToPhoto(record: AirtableRecord): TreatmentPhoto {
  const fields = record.fields;
  const photoAttachment = fields["Photo"];
  let photoUrl = "";
  let thumbnailUrl = "";
  if (Array.isArray(photoAttachment) && photoAttachment.length > 0) {
    const att = photoAttachment[0];
    photoUrl =
      att.thumbnails?.full?.url || att.thumbnails?.large?.url || att.url || "";
    thumbnailUrl =
      att.thumbnails?.large?.url || att.thumbnails?.small?.url || att.url || "";
  }
  const treatments = Array.isArray(fields["Name (from Treatments)"])
    ? fields["Name (from Treatments)"]
    : fields["Treatments"]
      ? [fields["Treatments"]]
      : [];
  const generalTreatments = Array.isArray(
    fields["Name (from General Treatments)"],
  )
    ? fields["Name (from General Treatments)"]
    : fields["General Treatments"]
      ? [fields["General Treatments"]]
      : [];
  const areaNames = fields["Area Names"]
    ? String(fields["Area Names"])
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean)
    : [];
  const surgical = fields["Surgical (from General Treatments)"];
  return {
    id: record.id,
    name: (fields["Name"] as string) || "",
    photoUrl,
    thumbnailUrl,
    treatments,
    generalTreatments,
    areaNames,
    caption: (fields["Caption"] as string) || undefined,
    surgical: surgical != null ? String(surgical) : undefined,
  };
}

/** Treatment name aliases: e.g. photos tagged "Laser" in the API should match dashboard category Energy Treatment. */
const TREATMENT_PHOTO_ALIASES: Record<string, string[]> = {
  [ENERGY_TREATMENT_CATEGORY]: ["laser", "energy device", "energy treatment"],
  [LEGACY_ENERGY_DEVICE_CATEGORY]: ["laser", "energy device", "energy treatment"],
  "Facial Services": ["facial", "dermasweep", "dermaplaning", "facial service"],
};

function photoMatchesTreatment(
  photo: TreatmentPhoto,
  treatmentName: string,
): boolean {
  const t = treatmentName.trim().toLowerCase();
  if (!t) return false;
  const termsToMatch = [t, ...(TREATMENT_PHOTO_ALIASES[treatmentName] ?? [])];
  const inGeneral = (photo.generalTreatments || []).some((g) => {
    const gLower = String(g).toLowerCase();
    return termsToMatch.some(
      (term) => gLower.includes(term) || term.includes(gLower),
    );
  });
  const inSpecific = (photo.treatments || []).some((s) => {
    const sLower = String(s).toLowerCase();
    return termsToMatch.some(
      (term) => sLower.includes(term) || term.includes(sLower),
    );
  });
  const inName = (photo.name || "").toLowerCase();
  const nameMatch = termsToMatch.some((term) => inName.includes(term));
  return inGeneral || inSpecific || nameMatch;
}

function getDetectedIssues(client: Client): Set<string> {
  const set = new Set<string>();
  const raw = client.allIssues;
  if (!raw) return set;
  const list = Array.isArray(raw)
    ? raw
    : String(raw)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
  list.forEach((issue) => set.add(normalizeIssue(issue)));
  return set;
}

/** Circular progress + label; click selects it (detail shows in panel below). */
const CIRCLE_R = 18;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_R;

function FeatureBreakdownCircle({
  label,
  issues,
  detectedIssues,
  isSelected,
  onSelect,
}: {
  label: string;
  issues: string[];
  detectedIssues: Set<string>;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const score = scoreIssues(issues, detectedIssues);
  const color = tierColor(scoreTier(score));
  const strokeDashoffset = CIRCLE_CIRCUMFERENCE * (1 - score / 100);

  if (issues.length === 0) return null;

  return (
    <div
      className={`treatment-recommender-by-treatment__breakdown-circle ${isSelected ? "treatment-recommender-by-treatment__breakdown-circle--selected" : ""}`}
    >
      <button
        type="button"
        className="treatment-recommender-by-treatment__breakdown-circle-btn"
        onClick={onSelect}
        aria-pressed={isSelected}
        aria-expanded={isSelected}
        title={`${label}: ${score}%`}
      >
        <span className="treatment-recommender-by-treatment__breakdown-circle-svg-wrap">
          <svg
            className="treatment-recommender-by-treatment__breakdown-circle-svg"
            viewBox="0 0 44 44"
            aria-hidden
          >
            <circle
              className="treatment-recommender-by-treatment__breakdown-circle-track"
              cx="22"
              cy="22"
              r={CIRCLE_R}
              fill="none"
              strokeWidth="4"
            />
            <circle
              className="treatment-recommender-by-treatment__breakdown-circle-fill"
              cx="22"
              cy="22"
              r={CIRCLE_R}
              fill="none"
              strokeWidth="4"
              strokeDasharray={CIRCLE_CIRCUMFERENCE}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 22 22)"
              style={{ stroke: color }}
            />
          </svg>
          <span
            className="treatment-recommender-by-treatment__breakdown-circle-score"
            style={{ color }}
          >
            {score}
          </span>
        </span>
        <span className="treatment-recommender-by-treatment__breakdown-circle-label">
          {label}
        </span>
      </button>
    </div>
  );
}

/** Analysis: grid of circles + one detail panel below showing selected circle's findings. */
function FeatureBreakdownSection({
  treatment,
  getBreakdownRowsForTreatment,
  detectedIssues,
}: {
  treatment: string;
  getBreakdownRowsForTreatment: (
    t: string,
  ) => { label: string; issues: string[] }[];
  detectedIssues: Set<string>;
}) {
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const rows = getBreakdownRowsForTreatment(treatment);
  if (rows.length === 0) return null;

  const selectedRow = selectedLabel
    ? rows.find((r) => r.label === selectedLabel)
    : null;
  const goodIssues = selectedRow
    ? selectedRow.issues.filter((i) => !detectedIssues.has(normalizeIssue(i)))
    : [];
  const badIssues = selectedRow
    ? selectedRow.issues.filter((i) => detectedIssues.has(normalizeIssue(i)))
    : [];

  return (
    <div className="treatment-recommender-by-treatment__breakdown">
      <h3 className="treatment-recommender-by-treatment__breakdown-title">
        Analysis
      </h3>
      <div className="treatment-recommender-by-treatment__breakdown-circles">
        {rows.map((row, rowIdx) => (
          <FeatureBreakdownCircle
            key={`breakdown-${rowIdx}-${row.label}`}
            label={row.label}
            issues={row.issues}
            detectedIssues={detectedIssues}
            isSelected={selectedLabel === row.label}
            onSelect={() =>
              setSelectedLabel(selectedLabel === row.label ? null : row.label)
            }
          />
        ))}
      </div>
      <div className="treatment-recommender-by-treatment__breakdown-detail">
        {selectedRow ? (
          <div className="treatment-recommender-by-treatment__breakdown-expanded">
            <p className="treatment-recommender-by-treatment__breakdown-detail-heading">
              {selectedRow.label}
            </p>
            {goodIssues.length > 0 || badIssues.length > 0 ? (
              <>
                {goodIssues.length > 0 && (
                  <div className="treatment-recommender-by-treatment__breakdown-expanded-group">
                    <span className="treatment-recommender-by-treatment__breakdown-expanded-label">
                      No concerns
                    </span>
                    <div className="treatment-recommender-by-treatment__breakdown-expanded-pills">
                      {goodIssues.map((issue, issueIdx) => (
                        <span
                          key={`good-${issueIdx}-${issue}`}
                          className="treatment-recommender-by-treatment__breakdown-pill treatment-recommender-by-treatment__breakdown-pill--good"
                        >
                          <span className="treatment-recommender-by-treatment__breakdown-pill-icon">
                            ✓
                          </span>
                          {issue}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {badIssues.length > 0 && (
                  <div className="treatment-recommender-by-treatment__breakdown-expanded-group">
                    <span className="treatment-recommender-by-treatment__breakdown-expanded-label">
                      Areas of concern
                    </span>
                    <div className="treatment-recommender-by-treatment__breakdown-expanded-pills">
                      {badIssues.map((issue, issueIdx) => (
                        <span
                          key={`bad-${issueIdx}-${issue}`}
                          className="treatment-recommender-by-treatment__breakdown-pill treatment-recommender-by-treatment__breakdown-pill--concern"
                        >
                          <span className="treatment-recommender-by-treatment__breakdown-pill-icon">
                            ✕
                          </span>
                          {issue}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="treatment-recommender-by-treatment__breakdown-expanded-empty">
                No findings in this area
              </p>
            )}
          </div>
        ) : (
          <p className="treatment-recommender-by-treatment__breakdown-detail-placeholder">
            Click a circle to view analysis
          </p>
        )}
      </div>
    </div>
  );
}

const WELLNESS_TREATMENT_KEYWORDS_BY_ID: Record<string, string[]> =
  Object.fromEntries(
    WELLNESS_TREATMENTS.map((t) => [t.id, t.matchKeywords ?? []]),
  );
const WELLNESS_TREATMENT_SUMMARY_BY_ID: Record<string, string> =
  Object.fromEntries(WELLNESS_TREATMENTS.map((t) => [t.id, t.summary ?? ""]));
const WELLNEST_CASE_IMAGE_FALLBACK =
  "/post-visit-blueprint/videos/wellnest/images.jpeg";

function getWellnestPatientFriendlyAddressCopy(
  offering: ReturnType<typeof getWellnestOfferingByTreatmentName>,
): string {
  if (!offering) return "";
  const summary =
    WELLNESS_TREATMENT_SUMMARY_BY_ID[offering.wellnessQuizId ?? ""]?.trim() ??
    "";
  return summary || offering.addresses;
}

function getWellnestDefaultDosing(
  offering: ReturnType<typeof getWellnestOfferingByTreatmentName>,
): string {
  if (!offering) return "Per protocol";
  const note = offering.notes ?? "";
  const weekMatch = note.match(/(\d+\s*(?:–|-)\s*\d+\s*weeks?|\d+\s*weeks?)/i);
  if (weekMatch) return weekMatch[1].replace(/\s+/g, " ").trim();
  return "Per protocol";
}

/**
 * Sections in the unified edit modal (type before where so sheet lines align with “— Type” headings).
 * Timeline / “When” chips are not editable here for now.
 */
function getUnifiedRecommenderEditSections(
  treatment: string,
  hasWellnestOffering: boolean,
  includeSkincareAddOns = false,
): { optionType: TreatmentRecommenderOptionType; title: string }[] {
  if (hasWellnestOffering) {
    return [];
  }
  if (treatment === "Skincare") {
    return [{ optionType: "skincare_what", title: "Skincare — Products" }];
  }
  if (isEnergyTreatmentCategory(treatment)) {
    return [
      { optionType: "laser_what", title: "Energy Treatment — Type" },
      { optionType: "laser_where", title: "Energy Treatment — Where" },
    ];
  }

  const mid: { optionType: TreatmentRecommenderOptionType; title: string }[] =
    [];

  if (treatment === "Filler") {
    mid.push(
      { optionType: "filler_what", title: "Filler — Type" },
      { optionType: "where", title: "Filler — Where" },
    );
  } else if (treatment === "Neurotoxin") {
    mid.push(
      { optionType: "neurotoxin_what", title: "Neurotoxin — Type" },
      { optionType: "where", title: "Neurotoxin — Where" },
    );
  } else if (treatment === "Chemical Peel") {
    mid.push(
      { optionType: "chemical_peel_what", title: "Chemical peel — Type" },
      { optionType: "chemical_peel_where", title: "Chemical peel — Where" },
    );
  } else if (treatment === "Microneedling") {
    mid.push(
      { optionType: "microneedling_type", title: "Microneedling — Type" },
      { optionType: "microneedling_where", title: "Microneedling — Where" },
    );
  } else if (treatment === "Facial Services") {
    mid.push(
      { optionType: "facial_service_what", title: "Facial services — Type" },
      { optionType: "where", title: "Facial services — Where" },
    );
  } else if (treatment === "Biostimulants") {
    mid.push(
      { optionType: "biostimulant_what", title: "Biostimulants — Product" },
      { optionType: "where", title: "Biostimulants — Where" },
    );
  } else if (treatment === "Other procedures") {
    mid.push({
      optionType: "other_procedures_what",
      title: "Other procedures — Type",
    });
  } else if (isJudgeMdSurgeryPlanCategory(treatment)) {
    mid.push({
      optionType: "other_procedures_what",
      title: `${treatment} — Procedure`,
    });
  } else {
    mid.push({ optionType: "where", title: `${treatment} — Where` });
  }

  if (
    includeSkincareAddOns &&
    (JUDGEMD_TREATMENT_SKINCARE_PAIRINGS[treatment]?.length ?? 0) > 0
  ) {
    mid.push({
      optionType: "skincare_what",
      title: "Skincare add-ons",
    });
  }

  return mid;
}

function buildRecommenderOptionValueWithOptionalPrice(
  name: string,
  priceNote: string,
): string {
  const n = name.trim();
  if (!n) return "";
  const p = priceNote.trim();
  return p ? `${n} · ${p}` : n;
}

function applySavedRecommenderOrder<T extends { value: string }>(
  records: readonly T[],
  orderedValues: readonly string[] | undefined,
): T[] {
  if (!orderedValues?.length) return [...records];
  const byValue = new Map(records.map((record) => [record.value, record]));
  const seen = new Set<string>();
  const ordered: T[] = [];
  for (const value of orderedValues) {
    const record = byValue.get(value);
    if (record && !seen.has(value)) {
      ordered.push(record);
      seen.add(value);
    }
  }
  for (const record of records) {
    if (!seen.has(record.value)) ordered.push(record);
  }
  return ordered;
}

type SkincareCarouselRow = ReturnType<typeof getSkincareCarouselItems>[number];

function getJudgeMdSkincareAddOnsForTreatment(
  treatment: string,
  skincareItems: readonly SkincareCarouselRow[],
): SkincareCarouselRow[] {
  const keywords = JUDGEMD_TREATMENT_SKINCARE_PAIRINGS[treatment] ?? [];
  if (keywords.length === 0) return [];
  const seen = new Set<string>();
  const out: SkincareCarouselRow[] = [];
  for (const kw of keywords) {
    const lower = kw.toLowerCase();
    const match = skincareItems.find((item) =>
      item.name.toLowerCase().includes(lower),
    );
    if (match && !seen.has(match.name)) {
      seen.add(match.name);
      out.push(match);
    }
  }
  return out;
}

/** Single selectable product tile (Skincare add-to-plan grid / search). */
function TreatmentRecommenderSkincareSelectChip({
  item,
  selected,
  isQuizRecommended,
  onToggle,
}: {
  item: SkincareCarouselRow;
  selected: boolean;
  isQuizRecommended: boolean;
  onToggle: () => void;
}) {
  const displayShort = item.name.split("|")[0]?.trim() ?? item.name;
  return (
    <button
      type="button"
      className={`skin-analysis-product-chip treatment-recommender-by-treatment__skincare-catalog-chip${
        selected ? " skin-analysis-product-chip--selected" : ""
      }${
        isQuizRecommended
          ? " treatment-recommender-by-treatment__skincare-catalog-chip--recommended"
          : ""
      }${
        item.name === OTHER_PRODUCT_LABEL
          ? " treatment-recommender-by-treatment__skincare-catalog-chip--other"
          : ""
      }`}
      onClick={onToggle}
      title={item.name}
      aria-pressed={selected}
      aria-label={
        selected
          ? `Remove ${displayShort}${
              isQuizRecommended ? " (recommended from skin quiz)" : ""
            }`
          : `Add ${displayShort}${
              isQuizRecommended ? " (recommended from skin quiz)" : ""
            }`
      }
    >
      {selected ? (
        <span
          className="treatment-recommender-by-treatment__carousel-remove treatment-recommender-by-treatment__skincare-chip-remove"
          aria-hidden
          title="Remove"
        >
          ×
        </span>
      ) : null}
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt=""
          loading="lazy"
          className="skin-analysis-product-chip-thumb"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <span className="skin-analysis-product-chip-placeholder">◆</span>
      )}
      <span className="skin-analysis-product-chip-name skin-analysis-product-chip-name--grow skin-analysis-product-chip-name--compact">
        {displayShort}
      </span>
    </button>
  );
}

/** Synthetic discussed row for quote preview — mirrors {@link handleAddToPlanConfirm} patch fields. */
function discussedItemPreviewFromAddPlanForm(
  row: AddPlanFormState,
  skincareProductOverride?: string,
): DiscussedItem {
  const isSkincare = row.treatment === "Skincare";
  const wellnestOffering = getWellnestOfferingByTreatmentName(row.treatment);
  const region =
    isSkincare
      ? ""
      : row.where.length > 0
        ? row.where.join(", ")
        : "";
  const treatmentProduct = treatmentProductHintForQuantity(row);
  const productOut =
    skincareProductOverride !== undefined
      ? skincareProductOverride.trim() || undefined
      : treatmentProduct?.trim() || undefined;
  const noteParts: string[] = [];
  if (wellnestOffering && row.deliveryForm?.trim()) {
    noteParts.push(`Delivery form: ${row.deliveryForm.trim()}`);
  }
  if (wellnestOffering && row.dosing?.trim()) {
    noteParts.push(`Dosing: ${row.dosing.trim()}`);
  }
  if (row.notes?.trim()) {
    noteParts.push(row.notes.trim());
  }
  const notesJoined = noteParts.length > 0 ? noteParts.join(" | ") : undefined;
  const findingsForItem = row.findings?.filter((f) => (f ?? "").trim());
  const qtyFields = buildDiscussedBiostimQuantityFields(
    row.treatment,
    productOut,
    row.quantity,
    row.bioTreatmentSessions,
  );
  const qtyCtx = getQuantityContext(row.treatment, productOut);
  return {
    id: "__add-plan-preview__",
    treatment: row.treatment,
    timeline: row.when,
    scheduledDate: row.scheduledDate?.trim() || undefined,
    region: region || undefined,
    product: productOut,
    quantity: qtyFields.quantity,
    bioTreatmentSessions: qtyFields.bioTreatmentSessions,
    treatmentInterval: resolveTreatmentIntervalForPlanItem(
      qtyCtx,
      qtyFields.bioTreatmentSessions ?? qtyFields.quantity,
      row.treatmentInterval,
    ),
    notes: notesJoined,
    findings: findingsForItem?.length ? findingsForItem : [],
  };
}

/** Same missing-info rules as checkout / plan list — for inline add-to-plan hints. */
function getMissingPricingInfoForAddPlanDraft(
  row: AddPlanFormState,
  providerCode: string | undefined,
  priceList: ProviderPricingJson,
): string | null {
  if (row.treatment === "Skincare") {
    const names = (row.skincareWhat ?? []).map((n) => n.trim()).filter(Boolean);
    if (names.length > 1) {
      const previews = names.map((name) =>
        discussedItemPreviewFromAddPlanForm(row, name),
      );
      const lines = getAlignedCheckoutLineItemsForDiscussedItems(
        previews,
        priceList,
      );
      for (const line of lines) {
        if (line.missingInfo) return line.missingInfo;
      }
      return null;
    }
  }
  if (usesOtherProceduresStructuredPlan(row.treatment)) {
    const otherOpts =
      getTreatmentProductOptionsForProvider(providerCode, row.treatment) ?? [];
    const { matched } = matchProductTokensToOptionList(
      row.product ?? "",
      otherOpts,
    );
    if (matched.length > 1) {
      const previews = matched.map((name) =>
        discussedItemPreviewFromAddPlanForm({ ...row, product: name }),
      );
      const lines = getAlignedCheckoutLineItemsForDiscussedItems(
        previews,
        priceList,
      );
      for (const line of lines) {
        if (line.missingInfo) return line.missingInfo;
      }
      return null;
    }
  }
  const preview = discussedItemPreviewFromAddPlanForm(row);
  const line = getAlignedCheckoutLineItemsForDiscussedItems([preview], priceList)[0];
  return line?.missingInfo ?? null;
}

/** Where to show the inline pricing hint so it sits next to the field that fixes it. */
type AddPlanPricingHintPlacement =
  | "units"
  | "injectable_type"
  | "biostim_product"
  | "generic";

function inferAddPlanPricingHintPlacement(
  missingInfo: string,
): AddPlanPricingHintPlacement {
  const m = missingInfo.toLowerCase();
  if (m.includes("unit")) return "units";
  if (
    m.includes("filler type") ||
    m.includes("botox") ||
    m.includes("dysport") ||
    m.includes("procedure type")
  ) {
    return "injectable_type";
  }
  if (m.includes("radiesse") || m.includes("sculptra")) {
    return "biostim_product";
  }
  return "generic";
}

function AddPlanFieldPricingHint({ message }: { message: string }) {
  return (
    <p
      className="treatment-recommender-by-treatment__add-plan-field-pricing-hint"
      role="status"
    >
      <span className="treatment-recommender-by-treatment__add-plan-pricing-hint-label">
        Pricing:
      </span>{" "}
      {message}
    </p>
  );
}

export interface TreatmentRecommenderByTreatmentProps {
  client: Client;
  onBack: () => void;
  onUpdate?: () => void | Promise<void>;
  /** Add item directly to plan and show success. Returns the new item for immediate UI. */
  onAddToPlanDirect?: (
    prefill: TreatmentPlanPrefill,
    options?: TreatmentPlanAddDirectOptions,
  ) => Promise<DiscussedItem | void> | void;
  /**
   * When adding several plan rows at once (e.g. multiple Other procedures types), use one
   * persist so rows are not lost if `client.discussedItems` has not refetched between adds.
   */
  onAddMultipleToPlanDirect?: (
    prefills: TreatmentPlanPrefill[],
    options?: TreatmentPlanAddDirectOptions,
  ) => Promise<DiscussedItem[] | void> | void;
  /** Open the checkout (price summary) modal. Shown when plan has items (dev only). */
  onOpenCheckout?: () => void;
  /** Remove a plan item directly (e.g. from the left column X). Called with item id. */
  onRemovePlanItem?: (itemId: string) => void | Promise<void>;
  /** Persist edits to an existing plan item (inline form, same as add-to-plan). */
  onUpdatePlanItem?: (
    itemId: string,
    patch: Partial<DiscussedItem>,
  ) => void | Promise<void>;
  /** Region filter chips — used when sending post-visit blueprint (AI mirror highlights). */
  onRecommenderRegionsChange?: (regions: readonly string[]) => void;
  /** When set, shows Share next to “{name}'s plan” (same rules as client detail treatment plan). */
  onShareTreatmentPlan?: () => void;
  /** Open plan editor for this item once (e.g. “Fix in plan” from share link modal). */
  initialOpenPlanItemId?: string | null;
  onConsumedInitialOpenPlanItemId?: () => void;
  /** Scroll to and highlight this treatment card once (e.g. “Learn more” from embedded recommender). */
  initialFocusTreatmentName?: string | null;
  onConsumedInitialFocusTreatmentName?: () => void;
}

export default function TreatmentRecommenderByTreatment({
  client,
  onBack: _onBack,
  onUpdate,
  onAddToPlanDirect,
  onAddMultipleToPlanDirect,
  onOpenCheckout,
  onRemovePlanItem,
  onUpdatePlanItem,
  onRecommenderRegionsChange,
  onShareTreatmentPlan,
  initialOpenPlanItemId,
  onConsumedInitialOpenPlanItemId,
  initialFocusTreatmentName,
  onConsumedInitialFocusTreatmentName,
}: TreatmentRecommenderByTreatmentProps) {
  const { provider, setProvider } = useDashboard();
  const providerCatalogContext = useMemo(
    () => toProviderTreatmentContext(provider),
    [provider?.code, provider?.id, provider?.name],
  );

  const effectivePriceList = useMemo(
    () =>
      getEffectivePriceList(
        provider?.["Treatment Pricing"] as string | undefined,
        provider?.code,
      ),
    [provider],
  );

  /** All options (defaults + custom) from Treatment Recommender Options table; used so providers can remove any option. */
  const [optionRecords, setOptionRecords] = useState<
    TreatmentRecommenderCustomOption[]
  >([]);
  /** Item we just added so we can open it for editing when user clicks "Add additional details". Cleared when modal closes. */
  const [lastAddedItem, setLastAddedItem] = useState<DiscussedItem | null>(
    null,
  );
  const filterState = useMemo<TreatmentRecommenderFilterState>(
    () => ({
      ...DEFAULT_RECOMMENDER_FILTER_STATE,
    }),
    [],
  );

  useEffect(() => {
    onRecommenderRegionsChange?.(filterState.region);
  }, [filterState.region, onRecommenderRegionsChange]);

  const [addToPlanForTreatment, setAddToPlanForTreatment] =
    useState<AddPlanFormState | null>(null);
  /** When set, Confirm saves via {@link onUpdatePlanItem} instead of adding a row. */
  const [editingPlanItemId, setEditingPlanItemId] = useState<string | null>(
    null,
  );
  const [planViewMode, setPlanViewMode] = useState<"list" | "calendar">(
    "list",
  );
  const [planCalendarMonth, setPlanCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [planCalendarSelectedIso, setPlanCalendarSelectedIso] = useState<
    string | null
  >(null);
  /** Month grid vs compact agenda (Google Calendar–style schedule list). */
  const [planCalendarSubView, setPlanCalendarSubView] = useState<
    "month" | "schedule"
  >("schedule");
  const planCalendarInitRef = useRef(false);
  const targetTreatmentDatePanelRef = useRef<HTMLSpanElement | null>(null);
  const targetTreatmentDatePopoverRef = useRef<HTMLDivElement | null>(null);
  const targetTreatmentDateInputRef = useRef<HTMLInputElement | null>(null);
  const [targetTreatmentDatePopoverRect, setTargetTreatmentDatePopoverRect] =
    useState<{ top: number; left: number; width: number } | null>(null);
  const [targetTreatmentDatePanelOpen, setTargetTreatmentDatePanelOpen] =
    useState(false);

  useEffect(() => {
    if (!addToPlanForTreatment) {
      setTargetTreatmentDatePanelOpen(false);
    }
  }, [addToPlanForTreatment]);

  useEffect(() => {
    if (!targetTreatmentDatePanelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTargetTreatmentDatePanelOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [targetTreatmentDatePanelOpen]);

  useLayoutEffect(() => {
    if (!targetTreatmentDatePanelOpen) {
      setTargetTreatmentDatePopoverRect(null);
      return;
    }
    const el = targetTreatmentDatePanelRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      const margin = 16;
      const w = Math.min(280, Math.max(0, window.innerWidth - margin * 2));
      let left = r.right - w;
      if (left < margin) left = margin;
      if (left + w > window.innerWidth - margin) {
        left = window.innerWidth - margin - w;
      }
      setTargetTreatmentDatePopoverRect({
        top: r.bottom + 6,
        left,
        width: w,
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [targetTreatmentDatePanelOpen]);

  useEffect(() => {
    if (!targetTreatmentDatePanelOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      const trigger = targetTreatmentDatePanelRef.current;
      const shell = targetTreatmentDatePopoverRef.current;
      if (trigger?.contains(t) || shell?.contains(t)) return;
      setTargetTreatmentDatePanelOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [targetTreatmentDatePanelOpen]);

  useEffect(() => {
    if (!targetTreatmentDatePanelOpen) return;
    window.setTimeout(() => {
      targetTreatmentDateInputRef.current?.focus();
    }, 0);
  }, [targetTreatmentDatePanelOpen]);

  useEffect(() => {
    if (!initialOpenPlanItemId) return;
    /** Editing an existing item only needs onUpdatePlanItem; new adds also need onAddToPlanDirect. */
    if (!onUpdatePlanItem) {
      onConsumedInitialOpenPlanItemId?.();
      return;
    }
    const list = client.discussedItems ?? [];
    const item = list.find((i) => i.id === initialOpenPlanItemId);
    if (!item) {
      onConsumedInitialOpenPlanItemId?.();
      return;
    }
    setEditingPlanItemId(initialOpenPlanItemId);
    setAddToPlanForTreatment(
      discussedItemToAddPlanFormState(item, provider?.code),
    );
    const t = window.setTimeout(() => {
      document
        .getElementById(`treatment-plan-item-${initialOpenPlanItemId}`)
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 100);
    onConsumedInitialOpenPlanItemId?.();
    return () => window.clearTimeout(t);
  }, [
    initialOpenPlanItemId,
    client.discussedItems,
    onUpdatePlanItem,
    onConsumedInitialOpenPlanItemId,
    provider?.code,
  ]);

  const [addPlanToAddressOtherOpen, setAddPlanToAddressOtherOpen] =
    useState(false);
  const [addPlanToAddressOtherSearch, setAddPlanToAddressOtherSearch] =
    useState("");
  /** Notion-style: type to create a new option for Where/What. */
  /** Unified edit modal for the treatment row that has Add to plan open (all option types + pricing reference). */
  const [unifiedEditModalTreatment, setUnifiedEditModalTreatment] = useState<
    string | null
  >(null);
  /** In the unified edit modal: which record is being renamed (inline edit). */
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  /** Per option-type “Add” row: label + optional price note (stored as “Name · price” in Airtable). */
  const [unifiedEditNewInputs, setUnifiedEditNewInputs] = useState<
    Partial<
      Record<
        TreatmentRecommenderOptionType,
        { name: string; priceNote: string }
      >
    >
  >({});
  /** When true, show name/price/Save row at bottom of that section (starts collapsed). */
  const [unifiedEditComposerOpenByType, setUnifiedEditComposerOpenByType] =
    useState<Partial<Record<TreatmentRecommenderOptionType, boolean>>>({});
  /** Row created only to edit a default (no id); deleted on Cancel / close unless Save succeeds. */
  const unifiedEditDraftRecordIdRef = useRef<string | null>(null);
  const unifiedEditMaterializeAbortRef = useRef(false);
  const unifiedEditMaterializingKeyRef = useRef<string | null>(null);
  const [unifiedEditMaterializingKey, setUnifiedEditMaterializingKey] =
    useState<string | null>(null);

  useEffect(() => {
    unifiedEditMaterializingKeyRef.current = unifiedEditMaterializingKey;
  }, [unifiedEditMaterializingKey]);

  const disposeUnifiedEditDraftRow = useCallback(() => {
    const id = unifiedEditDraftRecordIdRef.current;
    unifiedEditDraftRecordIdRef.current = null;
    if (!id?.trim() || !provider?.id) return;
    // ID format: "custom:{optionType}:{value}"
    const parts = id.split(":");
    if (parts.length < 3) return;
    const optionType = parts[1] as TreatmentRecommenderOptionType;
    const value = parts.slice(2).join(":");
    const raw = provider?.["Treatment Pricing"] as string | undefined;
    void deleteTreatmentRecommenderOption(provider.id, optionType, value, false, raw)
      .then((updatedRaw) => {
        if (provider) setProvider({ ...provider, "Treatment Pricing": updatedRaw });
        setOptionRecords(extractRecommenderOptionsFromPricingJson(updatedRaw));
      })
      .catch(() => {});
  }, [provider, setProvider]);

  const cancelUnifiedEditInline = useCallback(() => {
    if (unifiedEditMaterializingKeyRef.current) {
      unifiedEditMaterializeAbortRef.current = true;
      setUnifiedEditMaterializingKey(null);
      return;
    }
    disposeUnifiedEditDraftRow();
    setEditingRecordId(null);
    setEditingValue("");
  }, [disposeUnifiedEditDraftRow]);

  const closeUnifiedRecommenderEditModal = useCallback(() => {
    if (unifiedEditMaterializingKeyRef.current) {
      unifiedEditMaterializeAbortRef.current = true;
      setUnifiedEditMaterializingKey(null);
    }
    disposeUnifiedEditDraftRow();
    setEditingRecordId(null);
    setEditingValue("");
    setUnifiedEditModalTreatment(null);
    setUnifiedEditNewInputs({});
    setUnifiedEditComposerOpenByType({});
  }, [disposeUnifiedEditDraftRow]);

  const openUnifiedRecommenderEditor = (treatment: string) => {
    unifiedEditMaterializeAbortRef.current = false;
    unifiedEditMaterializingKeyRef.current = null;
    setUnifiedEditMaterializingKey(null);
    cancelUnifiedEditInline();
    setUnifiedEditNewInputs({});
    setUnifiedEditComposerOpenByType({});
    setUnifiedEditModalTreatment(treatment);
  };

  const [photoExplorerContext, setPhotoExplorerContext] = useState<{
    treatment: string;
    region?: string;
    /** Judge MD: curated wp-content before/afters for this plan card + link to full gallery */
    judgeMdGallery?: { pageUrl: string; imageUrls: readonly string[] };
  } | null>(null);
  /** Full-screen educational overlay for Wellnest peptide cards (no aesthetic before/after gallery). */
  const [wellnestDetailTreatment, setWellnestDetailTreatment] = useState<
    string | null
  >(null);
  const [showWellnestArticleShare, setShowWellnestArticleShare] =
    useState(false);
  const [treatmentSearchQuery, setTreatmentSearchQuery] = useState("");
  /** Brief highlight when deep-linked from embedded recommender “Learn more”. */
  const [focusedTreatmentHighlight, setFocusedTreatmentHighlight] = useState<
    string | null
  >(null);
  const [judgeMdTreatmentFocus, setJudgeMdTreatmentFocus] = useState<
    "all" | "nonsurgical" | "surgical"
  >("all");
  const [wellnestArticleSelection, setWellnestArticleSelection] = useState<
    Record<string, boolean>
  >({});
  const [wellnestArticlePhone, setWellnestArticlePhone] = useState("");
  const [wellnestArticleDraft, setWellnestArticleDraft] = useState("");
  const [wellnestArticleSending, setWellnestArticleSending] = useState(false);
  const [wellnestSelectedResultCase, setWellnestSelectedResultCase] =
    useState<BlueprintCasePhoto | null>(null);
  const [treatmentPhotos, setTreatmentPhotos] = useState<TreatmentPhoto[]>([]);
  const [clientPhotoView, setClientPhotoView] = useState<"front" | "side">(
    "front",
  );
  const [frontPhotoUrl, setFrontPhotoUrl] = useState<string | null>(null);
  const [sidePhotoUrl, setSidePhotoUrl] = useState<string | null>(null);
  const [showClientPhotoModal, setShowClientPhotoModal] = useState(false);
  /** Skincare category accordion: labels that are collapsed. All start collapsed so preset groupings are low-emphasis. */
  const [skincareCollapsedGroups, setSkincareCollapsedGroups] = useState<
    Set<string>
  >(() => new Set(SKINCARE_CATEGORY_OPTIONS.map((c) => c.label)));
  /** When on, product list is limited to skin quiz / routine recommendations. */
  const [skincareRecommendedFilter, setSkincareRecommendedFilter] =
    useState(false);
  /** Filters Skincare product name list (full name + short display). */
  const [skincareProductSearchQuery, setSkincareProductSearchQuery] =
    useState("");
  /** Score breakdown (skin quiz bars) on Skincare card – collapsed by default */
  const [skincareScoreBreakdownCollapsed, setSkincareScoreBreakdownCollapsed] =
    useState(true);
  const cardRefsMap = useRef<Record<string, HTMLDivElement | null>>({});
  const wellnestSharePanelRef = useRef<HTMLDivElement | null>(null);
  const wellnestCasePanelRef = useRef<HTMLDivElement | null>(null);

  const wellnessIntakeGoals = useMemo(
    () =>
      Array.from(
        new Set(
          (Array.isArray(client.goals) ? client.goals : [])
            .map((g) => String(g ?? "").trim())
            .filter(Boolean),
        ),
      ),
    [client.goals],
  );

  /** Most recently added Breast Surgery plan row’s product line → Judge MD gallery variant. */
  const judgeMdBreastSurgeryProductHint = useMemo(() => {
    const items = client.discussedItems ?? [];
    const breastPlanRows = items.filter(
      (i) => i.treatment?.trim().toLowerCase() === "breast surgery",
    );
    const withProduct = breastPlanRows.filter((i) => (i.product ?? "").trim());
    if (withProduct.length === 0) return undefined;
    withProduct.sort((a, b) => {
      const ta = a.addedAt ? new Date(a.addedAt).getTime() : 0;
      const tb = b.addedAt ? new Date(b.addedAt).getTime() : 0;
      return tb - ta;
    });
    return withProduct[0]!.product!.trim();
  }, [client.discussedItems]);

  /** Most recently added Body Sculpting plan row’s product line → lipo vs abdominoplasty gallery. */
  const judgeMdBodySculptingProductHint = useMemo(() => {
    const items = client.discussedItems ?? [];
    const bodyPlanRows = items.filter(
      (i) => i.treatment?.trim().toLowerCase() === "body sculpting",
    );
    const withProduct = bodyPlanRows.filter((i) => (i.product ?? "").trim());
    if (withProduct.length === 0) return undefined;
    withProduct.sort((a, b) => {
      const ta = a.addedAt ? new Date(a.addedAt).getTime() : 0;
      const tb = b.addedAt ? new Date(b.addedAt).getTime() : 0;
      return tb - ta;
    });
    return withProduct[0]!.product!.trim();
  }, [client.discussedItems]);

  const getWellnestGoalSignalForTreatment = (
    treatmentName: string,
  ): IntakeGoalMatchResult | null => {
    const wellnestOffering = getWellnestOfferingByTreatmentName(treatmentName);
    if (!wellnestOffering || wellnessIntakeGoals.length === 0) return null;
    return scoreIntakeGoalsAgainstWellnestCorpus(
      wellnessIntakeGoals,
      [
        wellnestOffering.category,
        wellnestOffering.addresses,
        wellnestOffering.demographics,
        wellnestOffering.notes,
      ].join(" "),
      WELLNESS_TREATMENT_KEYWORDS_BY_ID[
        wellnestOffering.wellnessQuizId ?? ""
      ] ?? [],
    );
  };

  useEffect(() => {
    if (!showClientPhotoModal) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowClientPhotoModal(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [showClientPhotoModal]);

  useEffect(() => {
    if (!wellnestDetailTreatment) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWellnestDetailTreatment(null);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [wellnestDetailTreatment]);

  useEffect(() => {
    if (!wellnestSelectedResultCase) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWellnestSelectedResultCase(null);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [wellnestSelectedResultCase]);

  useEffect(() => {
    if (!showWellnestArticleShare) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !wellnestArticleSending) {
        setShowWellnestArticleShare(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [showWellnestArticleShare, wellnestArticleSending]);

  useEffect(() => {
    if (!unifiedEditModalTreatment) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (unifiedEditMaterializingKeyRef.current || editingRecordId) {
          cancelUnifiedEditInline();
        } else {
          closeUnifiedRecommenderEditModal();
        }
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [
    unifiedEditModalTreatment,
    editingRecordId,
    cancelUnifiedEditInline,
    closeUnifiedRecommenderEditModal,
  ]);

  const getUrl = (att: {
    url?: string;
    thumbnails?: { full?: { url?: string }; large?: { url?: string } };
  }) =>
    att?.thumbnails?.full?.url ??
    att?.thumbnails?.large?.url ??
    att?.url ??
    null;

  useEffect(() => {
    if (client.tableSource !== "Patients") return;
    const demoPhotos = getWellnestDemoPhotoUrls(client.id);
    const inline = getClientFrontPhotoDisplayUrl(client.frontPhoto);
    setFrontPhotoUrl(inline ?? demoPhotos?.front ?? null);
    setSidePhotoUrl(demoPhotos?.side ?? null);
    let mounted = true;
    fetchTableRecords("Patients", {
      filterFormula: `RECORD_ID() = "${client.id}"`,
      fields: [
        "Front Photo",
        "Side Photo",
        "Side Photo (from Form Submissions)",
        "Left Side Photo (from Form Submissions)",
      ],
    })
      .then((records) => {
        if (!mounted) return;
        if (records.length === 0) {
          if (demoPhotos) setSidePhotoUrl(demoPhotos.side);
          return;
        }
        const fields = records[0].fields;
        const front =
          fields["Front Photo"] ??
          fields["Front photo"] ??
          fields["frontPhoto"];
        if (front && Array.isArray(front) && front.length > 0) {
          const fresh = getClientFrontPhotoDisplayUrl(front, {
            allowExpiringAirtableCdn: true,
          });
          setFrontPhotoUrl((prev) => prev ?? fresh);
        }
        const side =
          fields["Side Photo"] ?? fields["Side photo"] ?? fields["sidePhoto"];
        const unprocessedSide = fields["Side Photo (from Form Submissions)"];
        const unprocessedLeft =
          fields["Left Side Photo (from Form Submissions)"];
        if (side && Array.isArray(side) && side.length > 0) {
          setSidePhotoUrl(getUrl(side[0]) ?? null);
        } else if (
          unprocessedSide &&
          Array.isArray(unprocessedSide) &&
          unprocessedSide.length > 0
        ) {
          setSidePhotoUrl(getUrl(unprocessedSide[0]) ?? null);
        } else if (
          unprocessedLeft &&
          Array.isArray(unprocessedLeft) &&
          unprocessedLeft.length > 0
        ) {
          setSidePhotoUrl(getUrl(unprocessedLeft[0]) ?? null);
        } else if (demoPhotos?.side) {
          setSidePhotoUrl(demoPhotos.side);
        } else {
          setSidePhotoUrl(null);
        }
      })
      .catch(() => {
        if (mounted && demoPhotos?.side) setSidePhotoUrl(demoPhotos.side);
      });
    return () => {
      mounted = false;
    };
  }, [client.id, client.tableSource, client.frontPhoto]);

  useEffect(() => {
    let mounted = true;
    fetchTreatmentPhotos({ limit: 1500 })
      .then((records) => {
        if (!mounted) return;
        const photos = records
          .map(mapRecordToPhoto)
          .filter((p) => p.photoUrl)
          .filter((p) => p.surgical !== "Surgical");
        setTreatmentPhotos(photos);
      })
      .catch(() => setTreatmentPhotos([]));
    return () => {
      mounted = false;
    };
  }, []);

  // Derive custom recommender options directly from the provider's "Treatment Pricing" JSON.
  // No separate Airtable table fetch or seed needed — options are stored inside the JSON.
  useEffect(() => {
    const raw = provider?.["Treatment Pricing"] as string | undefined;
    setOptionRecords(extractRecommenderOptionsFromPricingJson(raw));
  }, [provider?.["Treatment Pricing"]]);

  const recommenderOptionOrder = useMemo(
    () =>
      parseProviderPricingDocument(
        provider?.["Treatment Pricing"] as string | undefined,
      ).recommenderOptionOrder ?? {},
    [provider?.["Treatment Pricing"]],
  );

  const orderRecommenderRecords = useCallback(
    <T extends { value: string }>(
      optionType: TreatmentRecommenderOptionType,
      records: readonly T[],
    ): T[] =>
      applySavedRecommenderOrder(records, recommenderOptionOrder[optionType]),
    [recommenderOptionOrder],
  );

  const baseWhereOptions = useMemo(
    () => REGION_OPTIONS.filter((r) => r !== "Multiple" && r !== "Other"),
    [],
  );
  const whereOptionRecords = useMemo(
    () => optionRecords.filter((o) => o.optionType === "where"),
    [optionRecords],
  );
  /** Deduplicated by value (first occurrence wins) so we don’t show e.g. "Forehead" twice when the table has duplicate rows. */
  const whereOptionRecordsDeduped = useMemo(() => {
    const seen = new Set<string>();
    return whereOptionRecords.filter((r) => {
      if (seen.has(r.value)) return false;
      seen.add(r.value);
      return true;
    });
  }, [whereOptionRecords]);
  const whereOptions = useMemo(
    () => {
      const ordered = [...baseWhereOptions];
      for (const option of whereOptionRecordsDeduped) {
        if (!ordered.includes(option.value)) ordered.push(option.value);
      }
      return ordered;
    },
    [whereOptionRecordsDeduped, baseWhereOptions],
  );

  const skincareCarouselItems = useMemo(
    () => getSkincareCarouselItems(providerCatalogContext),
    [providerCatalogContext],
  );
  const skincareWhatOptionRecords = useMemo(
    () => optionRecords.filter((o) => o.optionType === "skincare_what"),
    [optionRecords],
  );
  const skincareWhatOptions = useMemo(
    () => {
      const configuredValues = skincareWhatOptionRecords.map((o) => o.value);
      const catalogValues = skincareCarouselItems.map((i) => i.name);
      const values =
        configuredValues.length > 0
          ? [...configuredValues, ...catalogValues]
          : catalogValues;
      return Array.from(new Set(values));
    },
    [skincareWhatOptionRecords, skincareCarouselItems],
  );
  /** Carousel items allowed by provider. JudgeMD is restricted to SkinCeuticals plus surgical recovery/scar care. */
  const skincareCarouselItemsAllowed = useMemo(() => {
    const set = new Set(skincareWhatOptions);
    const allowed = skincareCarouselItems.filter((item) => set.has(item.name));
    const providerAllowed = isJudgeMdProviderCode(provider?.code)
      ? allowed.filter((item) => {
          const lower = item.name.toLowerCase();
          return (
            lower.startsWith("skinceuticals") ||
            lower.startsWith("vitamedica") ||
            lower.startsWith("biocorneum") ||
            lower.startsWith("biodermis")
          );
        })
      : allowed;
    return orderRecommenderRecords(
      "skincare_what",
      providerAllowed.map((item) => ({ value: item.name, item })),
    ).map(({ item }) => item);
  }, [
    skincareCarouselItems,
    skincareWhatOptions,
    provider?.code,
    orderRecommenderRecords,
  ]);

  /** Same merge as product chips: catalog ∪ custom `skincare_what` rows (for unified edit modal). */
  const skincareWhatDisplayRecords = useMemo(() => {
    const valueToId = new Map(
      skincareWhatOptionRecords.map((r) => [r.value, r.id]),
    );
    const records = skincareWhatOptions.map((value) => ({
      id: valueToId.get(value) ?? "",
      value,
    }));
    return orderRecommenderRecords("skincare_what", records);
  }, [
    skincareWhatOptions,
    skincareWhatOptionRecords,
    orderRecommenderRecords,
  ]);

  const quizSkincareRoutineSections = useMemo(
    () =>
      buildQuizSkincareRoutineSections(
        client.skincareQuiz?.recommendedProductNames,
        client.skincareQuiz?.result,
        (name) => skincareCarouselItems.find((p) => p.name === name),
      ),
    [
      client.skincareQuiz?.recommendedProductNames,
      client.skincareQuiz?.result,
      skincareCarouselItems,
    ],
  );

  const quizRoutineRecommendedNameSet = useMemo(() => {
    const set = new Set<string>(
      client.skincareQuiz?.recommendedProductNames ?? [],
    );
    for (const sec of quizSkincareRoutineSections) {
      for (const it of sec.items) set.add(it.name);
    }
    return set;
  }, [
    client.skincareQuiz?.recommendedProductNames,
    quizSkincareRoutineSections,
  ]);

  /** SkinCeuticals add-on products suggested for the currently selected non-surgical JudgeMD treatment. */
  const judgemdSkincareAddOnPool = useMemo(() => {
    if (!isJudgeMdProviderCode(provider?.code)) return [];
    const treatment = addToPlanForTreatment?.treatment ?? "";
    return getJudgeMdSkincareAddOnsForTreatment(
      treatment,
      skincareCarouselItemsAllowed,
    );
  }, [
    provider?.code,
    addToPlanForTreatment?.treatment,
    skincareCarouselItemsAllowed,
  ]);

  /** Wellness quiz treatment IDs (same ids as {@link wellnestOfferings} `wellnessQuizId`). */
  const wellnessQuizSuggestedIdSet = useMemo(() => {
    const ids = client.wellnessQuiz?.suggestedTreatmentIds;
    if (!Array.isArray(ids) || ids.length === 0) return new Set<string>();
    return new Set(
      ids.map((id) => String(id ?? "").trim()).filter((id) => id.length > 0),
    );
  }, [client.wellnessQuiz?.suggestedTreatmentIds]);

  const skincareProductPoolForBrowse = useMemo(
    () =>
      skincareCarouselItemsAllowed.length > 0
        ? skincareCarouselItemsAllowed
        : skincareCarouselItems,
    [skincareCarouselItemsAllowed, skincareCarouselItems],
  );

  /** When non-null, user is searching — show flat results instead of category accordions. */
  const skincareSearchMatchesSorted = useMemo(() => {
    const q = skincareProductSearchQuery.trim().toLowerCase();
    if (!q) return null;
    const selectedSet = new Set(addToPlanForTreatment?.skincareWhat ?? []);
    let pool = skincareProductPoolForBrowse;
    if (skincareRecommendedFilter && quizRoutineRecommendedNameSet.size > 0) {
      pool = pool.filter(
        (i) =>
          quizRoutineRecommendedNameSet.has(i.name) || selectedSet.has(i.name),
      );
    }
    const matched = pool.filter((item) => {
      const n = item.name.toLowerCase();
      const short = (item.name.split("|")[0]?.trim() ?? "").toLowerCase();
      return n.includes(q) || short.includes(q);
    });
    const recommendedOrder = client.skincareQuiz?.recommendedProductNames ?? [];
    return [...matched].sort((a, b) => {
      const aRec = quizRoutineRecommendedNameSet.has(a.name);
      const bRec = quizRoutineRecommendedNameSet.has(b.name);
      if (aRec && !bRec) return -1;
      if (!aRec && bRec) return 1;
      if (aRec && bRec) {
        const ia = recommendedOrder.indexOf(a.name);
        const ib = recommendedOrder.indexOf(b.name);
        const ra = ia >= 0 ? ia : 9999;
        const rb = ib >= 0 ? ib : 9999;
        if (ra !== rb) return ra - rb;
      }
      return a.name.localeCompare(b.name);
    });
  }, [
    skincareProductSearchQuery,
    skincareProductPoolForBrowse,
    skincareRecommendedFilter,
    quizRoutineRecommendedNameSet,
    addToPlanForTreatment?.skincareWhat,
    client.skincareQuiz?.recommendedProductNames,
  ]);

  /**
   * When "Quiz recommendations" filter is on: browse list grouped by AM/PM/optional/additional
   * (not product categories). Null when filter is off.
   */
  const skincareRoutineBrowseSections = useMemo(() => {
    if (
      !skincareRecommendedFilter ||
      quizSkincareRoutineSections.length === 0
    ) {
      return null;
    }
    const selectedNames = new Set(addToPlanForTreatment?.skincareWhat ?? []);
    const recommendedOrder = client.skincareQuiz?.recommendedProductNames ?? [];

    const sortBrowsePoolItems = (items: SkincareCarouselRow[]) =>
      [...items].sort((a, b) => {
        const aRec = quizRoutineRecommendedNameSet.has(a.name);
        const bRec = quizRoutineRecommendedNameSet.has(b.name);
        if (aRec && !bRec) return -1;
        if (!aRec && bRec) return 1;
        if (aRec && bRec) {
          const ia = recommendedOrder.indexOf(a.name);
          const ib = recommendedOrder.indexOf(b.name);
          const ra = ia >= 0 ? ia : 9999;
          const rb = ib >= 0 ? ib : 9999;
          if (ra !== rb) return ra - rb;
        }
        return a.name.localeCompare(b.name);
      });

    const shownNames = new Set<string>();
    const sectionsOut: {
      key: string;
      title: string;
      items: SkincareCarouselRow[];
    }[] = [];

    for (const section of quizSkincareRoutineSections) {
      const rows = section.items
        .map((preview) =>
          skincareProductPoolForBrowse.find((p) => p.name === preview.name),
        )
        .filter((row): row is SkincareCarouselRow => Boolean(row))
        .filter(
          (item) =>
            quizRoutineRecommendedNameSet.has(item.name) ||
            selectedNames.has(item.name),
        );
      if (rows.length === 0) continue;
      for (const r of rows) shownNames.add(r.name);
      sectionsOut.push({
        key: `quiz-routine-${section.id}`,
        title: section.title,
        items: sortBrowsePoolItems(rows),
      });
    }

    const orphanRows = sortBrowsePoolItems(
      skincareProductPoolForBrowse.filter(
        (p) => selectedNames.has(p.name) && !shownNames.has(p.name),
      ),
    );
    if (orphanRows.length > 0) {
      sectionsOut.push({
        key: "quiz-routine-other-selected",
        title: "Also on plan",
        items: orphanRows,
      });
    }

    return sectionsOut;
  }, [
    skincareRecommendedFilter,
    quizSkincareRoutineSections,
    skincareProductPoolForBrowse,
    addToPlanForTreatment?.skincareWhat,
    quizRoutineRecommendedNameSet,
    client.skincareQuiz?.recommendedProductNames,
  ]);

  const laserWhatOptionRecords = useMemo(
    () => optionRecords.filter((o) => o.optionType === "laser_what"),
    [optionRecords],
  );
  /** Energy Treatment types are always constrained to pricing-sheet options for the provider (prevents stale custom values like Picosure). */
  const laserWhatOptions = useMemo(
    () =>
      getTreatmentProductOptionsForProvider(providerCatalogContext, ENERGY_TREATMENT_CATEGORY),
    [provider?.code],
  );
  /** Energy Treatment types: pricing sheet ∪ custom rows in `laser_what`. */
  const laserWhatDisplayRecords = useMemo(() => {
    const valueToId = new Map(
      laserWhatOptionRecords.map((r) => [r.value, r.id]),
    );
    const ordered: string[] = [];
    const seen = new Set<string>();
    for (const v of laserWhatOptions) {
      if (seen.has(v)) continue;
      seen.add(v);
      ordered.push(v);
    }
    for (const r of laserWhatOptionRecords) {
      if (seen.has(r.value)) continue;
      seen.add(r.value);
      ordered.push(r.value);
    }
    const records = ordered.map((value) => ({
      id: valueToId.get(value) ?? "",
      value,
    }));
    return orderRecommenderRecords("laser_what", records);
  }, [laserWhatOptionRecords, laserWhatOptions, orderRecommenderRecords]);

  const laserWhereOptionRecords = useMemo(
    () => optionRecords.filter((o) => o.optionType === "laser_where"),
    [optionRecords],
  );
  const baseLaserWhere = useMemo(
    () => [...ENERGY_TREATMENT_WHERE_OPTIONS],
    [],
  );
  const laserWhereDisplayRecords = useMemo(() => {
    const valueToId = new Map(
      laserWhereOptionRecords.map((r) => [r.value, r.id]),
    );
    const ordered: string[] = [];
    const seen = new Set<string>();
    for (const v of baseLaserWhere) {
      if (seen.has(v)) continue;
      seen.add(v);
      ordered.push(v);
    }
    for (const r of laserWhereOptionRecords) {
      if (seen.has(r.value)) continue;
      seen.add(r.value);
      ordered.push(r.value);
    }
    const records = ordered.map((value) => ({
      id: valueToId.get(value) ?? "",
      value,
    }));
    return orderRecommenderRecords("laser_where", records);
  }, [laserWhereOptionRecords, baseLaserWhere, orderRecommenderRecords]);

  const biostimulantWhatOptionRecords = useMemo(
    () => optionRecords.filter((o) => o.optionType === "biostimulant_what"),
    [optionRecords],
  );
  const biostimulantTypeBaseLabels = useMemo(
    () => {
      const base = isJudgeMdProviderCode(provider?.code)
        ? getTreatmentProductOptionsForProvider(
            provider?.code,
            "Biostimulants",
          ).filter((v) => v !== OTHER_PRODUCT_LABEL)
        : getBiostimulantTypeOptionLabels(effectivePriceList);
      return [...base, OTHER_PRODUCT_LABEL];
    },
    [effectivePriceList, provider?.code],
  );
  const biostimulantDisplayRecords = useMemo(() => {
    const valueToId = new Map<string, string>();
    for (const r of biostimulantWhatOptionRecords) {
      const canon = canonicalBiostimulantProductLabel(r.value);
      if (!valueToId.has(canon) && r.id) valueToId.set(canon, r.id);
    }
    const ordered: string[] = [];
    const seen = new Set<string>();
    for (const v of biostimulantTypeBaseLabels) {
      const c = canonicalBiostimulantProductLabel(v);
      if (seen.has(c)) continue;
      seen.add(c);
      ordered.push(c);
    }
    for (const r of biostimulantWhatOptionRecords) {
      const c = canonicalBiostimulantProductLabel(r.value);
      if (seen.has(c)) continue;
      seen.add(c);
      ordered.push(c);
    }
    const records = ordered.map((value) => ({
      id: valueToId.get(value) ?? "",
      value,
    }));
    return orderRecommenderRecords("biostimulant_what", records);
  }, [
    biostimulantWhatOptionRecords,
    biostimulantTypeBaseLabels,
    orderRecommenderRecords,
  ]);
  const fillerSkuOptions = useMemo(
    () =>
      isJudgeMdProviderCode(provider?.code)
        ? getTreatmentProductOptionsForProvider(providerCatalogContext, "Filler").filter(
            (v) => v !== OTHER_PRODUCT_LABEL,
          )
        : getSkuOptionsForCategory("Filler", effectivePriceList).map(
            (s) => s.label,
          ),
    [effectivePriceList, provider?.code],
  );
  const neurotoxinTypeBaseLabels = useMemo(
    () => {
      const base = isJudgeMdProviderCode(provider?.code)
        ? getTreatmentProductOptionsForProvider(
            provider?.code,
            "Neurotoxin",
          ).filter((v) => v !== OTHER_PRODUCT_LABEL)
        : getNeurotoxinTypeOptionLabels(effectivePriceList);
      return [...base, OTHER_PRODUCT_LABEL];
    },
    [effectivePriceList, provider?.code],
  );
  const chemicalPeelTypeOptions = useMemo(
    () =>
      getTreatmentProductOptionsForProvider(
        provider?.code,
        "Chemical Peel",
      ).filter((v) => v !== OTHER_PRODUCT_LABEL),
    [provider?.code],
  );

  const facialServiceTypeOptions = useMemo(
    () =>
      getTreatmentProductOptionsForProvider(
        provider?.code,
        "Facial Services",
      ).filter((v) => v !== OTHER_PRODUCT_LABEL),
    [provider?.code],
  );

  const otherProcedureTypeBaseTreatment = useMemo(() => {
    const fromAdd = addToPlanForTreatment?.treatment?.trim();
    if (fromAdd && isJudgeMdSurgeryPlanCategory(fromAdd)) return fromAdd;
    const fromEdit = unifiedEditModalTreatment?.trim();
    if (fromEdit && isJudgeMdSurgeryPlanCategory(fromEdit)) return fromEdit;
    return "Other procedures";
  }, [
    addToPlanForTreatment?.treatment,
    unifiedEditModalTreatment,
  ]);

  const otherProcedureTypeBaseLabels = useMemo(
    () =>
      (
        getTreatmentProductOptionsForProvider(
          provider?.code,
          otherProcedureTypeBaseTreatment,
        ) ?? []
      ).filter((v) => v !== OTHER_PRODUCT_LABEL),
    [provider?.code, otherProcedureTypeBaseTreatment],
  );
  const otherProceduresWhatOptionRecords = useMemo(
    () =>
      optionRecords.filter((o) => o.optionType === "other_procedures_what"),
    [optionRecords],
  );
  const otherProcedureDisplayRecords = useMemo(() => {
    const valueToId = new Map(
      otherProceduresWhatOptionRecords.map((r) => [r.value, r.id]),
    );
    const ordered: string[] = [];
    const seen = new Set<string>();
    for (const v of otherProcedureTypeBaseLabels) {
      if (seen.has(v)) continue;
      seen.add(v);
      ordered.push(v);
    }
    for (const r of otherProceduresWhatOptionRecords) {
      if (seen.has(r.value)) continue;
      seen.add(r.value);
      ordered.push(r.value);
    }
    const records = ordered.map((value) => ({
      id: valueToId.get(value) ?? "",
      value,
    }));
    return orderRecommenderRecords("other_procedures_what", records);
  }, [
    otherProcedureTypeBaseLabels,
    otherProceduresWhatOptionRecords,
    orderRecommenderRecords,
  ]);

  const prfmInjectionWhereDisplayRecords = useMemo(
    () => [...PRFM_INJECTION_WHERE_OPTIONS].map((value) => ({ id: "", value })),
    [],
  );

  const microneedlingWhereOptionRecords = useMemo(
    () => optionRecords.filter((o) => o.optionType === "microneedling_where"),
    [optionRecords],
  );
  const baseMicroneedlingWhere = useMemo(
    () => [...REGION_OPTIONS_MICRONEEDLING],
    [],
  );
  const microneedlingWhereDisplayRecords = useMemo(() => {
    const valueToId = new Map(
      microneedlingWhereOptionRecords.map((r) => [r.value, r.id]),
    );
    const ordered: string[] = [];
    const seen = new Set<string>();
    for (const v of baseMicroneedlingWhere) {
      if (seen.has(v)) continue;
      seen.add(v);
      ordered.push(v);
    }
    for (const r of microneedlingWhereOptionRecords) {
      if (seen.has(r.value)) continue;
      seen.add(r.value);
      ordered.push(r.value);
    }
    const records = ordered.map((value) => ({
      id: valueToId.get(value) ?? "",
      value,
    }));
    return orderRecommenderRecords("microneedling_where", records);
  }, [
    microneedlingWhereOptionRecords,
    baseMicroneedlingWhere,
    orderRecommenderRecords,
  ]);

  const microneedlingTypeOptionRecords = useMemo(
    () => optionRecords.filter((o) => o.optionType === "microneedling_type"),
    [optionRecords],
  );
  const baseMicroneedlingTypes = useMemo(
    () => [...MICRONEEDLING_TYPE_OPTIONS],
    [],
  );
  const microneedlingTypeDisplayRecords = useMemo(() => {
    const valueToId = new Map(
      microneedlingTypeOptionRecords.map((r) => [r.value, r.id]),
    );
    const ordered: string[] = [];
    const seen = new Set<string>();
    for (const v of baseMicroneedlingTypes) {
      if (seen.has(v)) continue;
      seen.add(v);
      ordered.push(v);
    }
    for (const r of microneedlingTypeOptionRecords) {
      if (seen.has(r.value)) continue;
      seen.add(r.value);
      ordered.push(r.value);
    }
    const records = ordered.map((value) => ({
      id: valueToId.get(value) ?? "",
      value,
    }));
    return orderRecommenderRecords("microneedling_type", records);
  }, [
    microneedlingTypeOptionRecords,
    baseMicroneedlingTypes,
    orderRecommenderRecords,
  ]);

  const chemicalPeelWhereOptionRecords = useMemo(
    () => optionRecords.filter((o) => o.optionType === "chemical_peel_where"),
    [optionRecords],
  );
  const baseChemicalPeelWhere = useMemo(
    () => [...CHEMICAL_PEEL_AREA_OPTIONS],
    [],
  );
  const chemicalPeelWhereDisplayRecords = useMemo(() => {
    const valueToId = new Map(
      chemicalPeelWhereOptionRecords.map((r) => [r.value, r.id]),
    );
    const ordered: string[] = [];
    const seen = new Set<string>();
    for (const v of baseChemicalPeelWhere) {
      if (seen.has(v)) continue;
      seen.add(v);
      ordered.push(v);
    }
    for (const r of chemicalPeelWhereOptionRecords) {
      if (seen.has(r.value)) continue;
      seen.add(r.value);
      ordered.push(r.value);
    }
    const records = ordered.map((value) => ({
      id: valueToId.get(value) ?? "",
      value,
    }));
    return orderRecommenderRecords("chemical_peel_where", records);
  }, [
    chemicalPeelWhereOptionRecords,
    baseChemicalPeelWhere,
    orderRecommenderRecords,
  ]);

  const timelineOptionRecords = useMemo(
    () => optionRecords.filter((o) => o.optionType === "timeline"),
    [optionRecords],
  );
  const timelineDisplayRecords = useMemo(() => {
    const valueToId = new Map(
      timelineOptionRecords.map((r) => [r.value, r.id]),
    );
    const ordered: string[] = [];
    const seen = new Set<string>();
    for (const v of TIMELINE_OPTIONS) {
      if (seen.has(v)) continue;
      seen.add(v);
      ordered.push(v);
    }
    for (const r of timelineOptionRecords) {
      if (seen.has(r.value)) continue;
      seen.add(r.value);
      ordered.push(r.value);
    }
    const records = ordered.map((value) => ({
      id: valueToId.get(value) ?? "",
      value,
    }));
    return orderRecommenderRecords("timeline", records);
  }, [timelineOptionRecords, orderRecommenderRecords]);

  const genericWhereDisplayRecords = useMemo(() => {
    const valueToId = new Map(
      whereOptionRecordsDeduped.map((r) => [r.value, r.id]),
    );
    const records = whereOptions.map((value) => ({
      id: valueToId.get(value) ?? "",
      value,
    }));
    return orderRecommenderRecords("where", records);
  }, [whereOptions, whereOptionRecordsDeduped, orderRecommenderRecords]);

  const fillerWhatOptionRecords = useMemo(
    () => optionRecords.filter((o) => o.optionType === "filler_what"),
    [optionRecords],
  );
  const fillerTypeDisplayRecords = useMemo(() => {
    const valueToId = new Map(
      fillerWhatOptionRecords.map((r) => [r.value, r.id]),
    );
    const ordered: string[] = [];
    const seen = new Set<string>();
    for (const v of fillerSkuOptions) {
      if (seen.has(v)) continue;
      seen.add(v);
      ordered.push(v);
    }
    for (const r of fillerWhatOptionRecords) {
      if (seen.has(r.value)) continue;
      seen.add(r.value);
      ordered.push(r.value);
    }
    const displayValues = isJudgeMdProviderCode(provider?.code)
      ? [...ordered].sort((a, b) => a.localeCompare(b))
      : ordered;
    const records = displayValues.map((value) => ({
      id: valueToId.get(value) ?? "",
      value,
    }));
    return orderRecommenderRecords("filler_what", records);
  }, [
    fillerSkuOptions,
    fillerWhatOptionRecords,
    provider?.code,
    orderRecommenderRecords,
  ]);

  const neurotoxinWhatOptionRecords = useMemo(
    () => optionRecords.filter((o) => o.optionType === "neurotoxin_what"),
    [optionRecords],
  );
  const neurotoxinTypeDisplayRecords = useMemo(() => {
    const valueToId = new Map<string, string>();
    for (const r of neurotoxinWhatOptionRecords) {
      const canon = canonicalNeurotoxinProductLabel(r.value);
      if (!valueToId.has(canon) && r.id) valueToId.set(canon, r.id);
    }
    const ordered: string[] = [];
    const seen = new Set<string>();
    for (const v of neurotoxinTypeBaseLabels) {
      const c = canonicalNeurotoxinProductLabel(v);
      if (seen.has(c)) continue;
      seen.add(c);
      ordered.push(c);
    }
    for (const r of neurotoxinWhatOptionRecords) {
      const c = canonicalNeurotoxinProductLabel(r.value);
      if (seen.has(c)) continue;
      seen.add(c);
      ordered.push(c);
    }
    const records = ordered.map((value) => ({
      id: valueToId.get(value) ?? "",
      value,
    }));
    return orderRecommenderRecords("neurotoxin_what", records);
  }, [
    neurotoxinTypeBaseLabels,
    neurotoxinWhatOptionRecords,
    orderRecommenderRecords,
  ]);

  const chemicalPeelWhatOptionRecords = useMemo(
    () => optionRecords.filter((o) => o.optionType === "chemical_peel_what"),
    [optionRecords],
  );
  const chemicalPeelTypeDisplayRecords = useMemo(() => {
    const valueToId = new Map(
      chemicalPeelWhatOptionRecords.map((r) => [r.value, r.id]),
    );
    const ordered: string[] = [];
    const seen = new Set<string>();
    for (const v of chemicalPeelTypeOptions) {
      if (seen.has(v)) continue;
      seen.add(v);
      ordered.push(v);
    }
    for (const r of chemicalPeelWhatOptionRecords) {
      if (seen.has(r.value)) continue;
      seen.add(r.value);
      ordered.push(r.value);
    }
    const records = ordered.map((value) => ({
      id: valueToId.get(value) ?? "",
      value,
    }));
    return orderRecommenderRecords("chemical_peel_what", records);
  }, [
    chemicalPeelTypeOptions,
    chemicalPeelWhatOptionRecords,
    orderRecommenderRecords,
  ]);

  const facialServiceWhatOptionRecords = useMemo(
    () => optionRecords.filter((o) => o.optionType === "facial_service_what"),
    [optionRecords],
  );
  const baseFacialServiceTypes = useMemo(
    () => [...facialServiceTypeOptions],
    [facialServiceTypeOptions],
  );
  const facialServiceWhatDisplayRecords = useMemo(() => {
    const valueToId = new Map(
      facialServiceWhatOptionRecords.map((r) => [r.value, r.id]),
    );
    const ordered: string[] = [];
    const seen = new Set<string>();
    for (const v of baseFacialServiceTypes) {
      if (seen.has(v)) continue;
      seen.add(v);
      ordered.push(v);
    }
    for (const r of facialServiceWhatOptionRecords) {
      if (seen.has(r.value)) continue;
      seen.add(r.value);
      ordered.push(r.value);
    }
    const records = ordered.map((value) => ({
      id: valueToId.get(value) ?? "",
      value,
    }));
    return orderRecommenderRecords("facial_service_what", records);
  }, [
    facialServiceWhatOptionRecords,
    baseFacialServiceTypes,
    orderRecommenderRecords,
  ]);

  const canEditRecommenderOptions = Boolean(provider?.id);

  const unifiedEditModalOffering = unifiedEditModalTreatment
    ? getWellnestOfferingByTreatmentName(unifiedEditModalTreatment)
    : null;
  const unifiedEditSections = useMemo(() => {
    if (!unifiedEditModalTreatment) return [];
    return getUnifiedRecommenderEditSections(
      unifiedEditModalTreatment,
      Boolean(unifiedEditModalOffering),
      isJudgeMdProviderCode(provider?.code),
    );
  }, [unifiedEditModalTreatment, unifiedEditModalOffering, provider?.code]);

  const unifiedEditSkincareAddOnPool = useMemo(() => {
    if (
      !unifiedEditModalTreatment ||
      unifiedEditModalTreatment === "Skincare" ||
      !isJudgeMdProviderCode(provider?.code)
    ) {
      return [];
    }
    return getJudgeMdSkincareAddOnsForTreatment(
      unifiedEditModalTreatment,
      skincareCarouselItemsAllowed,
    );
  }, [
    unifiedEditModalTreatment,
    provider?.code,
    skincareCarouselItemsAllowed,
  ]);

  const unifiedEditSkincareAddOnRecords = useMemo(() => {
    const byValue = new Map(
      skincareWhatDisplayRecords.map((record) => [record.value, record]),
    );
    return unifiedEditSkincareAddOnPool.map(
      (item) => byValue.get(item.name) ?? { id: "", value: item.name },
    );
  }, [skincareWhatDisplayRecords, unifiedEditSkincareAddOnPool]);

  /** Rows shown in add-to-plan chips (defaults ∪ Airtable) — unified edit uses the same list. */
  const getUnifiedEditSectionDisplayRecords = useCallback(
    (optionType: TreatmentRecommenderOptionType) => {
      switch (optionType) {
        case "skincare_what":
          if (
            unifiedEditModalTreatment &&
            unifiedEditModalTreatment !== "Skincare" &&
            unifiedEditSkincareAddOnRecords.length > 0
          ) {
            return unifiedEditSkincareAddOnRecords;
          }
          return skincareWhatDisplayRecords;
        case "laser_what":
          return laserWhatDisplayRecords;
        case "laser_where":
          return laserWhereDisplayRecords;
        case "biostimulant_what":
          return biostimulantDisplayRecords;
        case "microneedling_type":
          return microneedlingTypeDisplayRecords;
        case "microneedling_where":
          return microneedlingWhereDisplayRecords;
        case "chemical_peel_where":
          return chemicalPeelWhereDisplayRecords;
        case "chemical_peel_what":
          return chemicalPeelTypeDisplayRecords;
        case "facial_service_what":
          return facialServiceWhatDisplayRecords;
        case "other_procedures_what":
          return otherProcedureDisplayRecords;
        case "filler_what":
          return fillerTypeDisplayRecords;
        case "neurotoxin_what":
          return neurotoxinTypeDisplayRecords;
        case "where":
          return genericWhereDisplayRecords;
        default:
          return [];
      }
    },
    [
      skincareWhatDisplayRecords,
      laserWhatDisplayRecords,
      laserWhereDisplayRecords,
      biostimulantDisplayRecords,
      microneedlingTypeDisplayRecords,
      microneedlingWhereDisplayRecords,
      chemicalPeelWhereDisplayRecords,
      chemicalPeelTypeDisplayRecords,
      facialServiceWhatDisplayRecords,
      otherProcedureDisplayRecords,
      fillerTypeDisplayRecords,
      neurotoxinTypeDisplayRecords,
      genericWhereDisplayRecords,
      unifiedEditModalTreatment,
      unifiedEditSkincareAddOnRecords,
    ],
  );

  const detectedIssues = useMemo(() => getDetectedIssues(client), [client]);

  const getPhotosForTreatment = (treatmentName: string): TreatmentPhoto[] =>
    treatmentPhotos.filter((p) => photoMatchesTreatment(p, treatmentName));

  const combinedFindings = useMemo(() => {
    const fromClient = Array.from(detectedIssues);
    const fromFilter = filterState.findingsToAddress || [];
    const fromConcerns = getFindingsFromConcerns(filterState.generalConcerns);
    const set = new Set<string>([
      ...fromClient,
      ...fromFilter,
      ...fromConcerns,
    ]);
    return Array.from(set);
  }, [
    detectedIssues,
    filterState.findingsToAddress,
    filterState.generalConcerns,
  ]);

  const suggestedTreatments = useMemo(() => {
    const allowedOrdered = getTreatmentOptionsForProvider(providerCatalogContext);
    const withGoals = getSuggestedTreatmentsForFindings(
      combinedFindings,
      providerCatalogContext,
    );
    const suggestedNames = Array.from(
      new Set(withGoals.map((s) => s.treatment)),
    );
    const names = isJudgeMdProviderCode(provider?.code)
      ? buildJudgeMdPlanBuilderTreatmentOrder(suggestedNames, allowedOrdered)
      : (() => {
          const seen = new Set<string>();
          const out: string[] = [];
          for (const t of suggestedNames) {
            if (allowedOrdered.includes(t) && !seen.has(t)) {
              seen.add(t);
              out.push(t);
            }
          }
          for (const t of allowedOrdered) {
            if (!seen.has(t)) {
              seen.add(t);
              out.push(t);
            }
          }
          return out;
        })();
    const hasSkinQuizProducts =
      client.skincareQuiz?.recommendedProductNames &&
      client.skincareQuiz.recommendedProductNames.length > 0;
    if (hasSkinQuizProducts) {
      const idx = names.indexOf("Skincare");
      if (idx > 0) {
        names.splice(idx, 1);
        names.unshift("Skincare");
      } else if (idx === -1 && allowedOrdered.includes("Skincare")) {
        names.unshift("Skincare");
      }
    }
    let sameDay = filterTreatmentsBySameDay(names, filterState.sameDayAddOn);
    if (
      (isWellnestWellnessProviderCode(provider?.code) ||
        isSlimStudioProvider(providerCatalogContext)) &&
      sameDay.length === 0 &&
      names.length > 0
    ) {
      sameDay = names;
    }
    const filtered = filterTreatmentsByRegion(
      sameDay,
      filterState.region,
      (t) => getFindingsByAreaForTreatment(t).map((r) => r.area),
    );
    // Skincare first, then the rest in existing order
    const skincare = filtered.filter((t) => t === "Skincare");
    const rest = filtered.filter((t) => t !== "Skincare");
    return [...skincare, ...rest];
  }, [
    combinedFindings,
    filterState.sameDayAddOn,
    filterState.region,
    client.skincareQuiz?.recommendedProductNames,
    provider?.code,
  ]);

  /** Treatment cards to show (Skincare stays in the list so the full product carousel is always available, including after the skin quiz). */
  const treatmentsToShow = useMemo(() => {
    const base = suggestedTreatments;
    if (!isWellnestWellnessProviderCode(provider?.code)) return base;
    if (wellnessIntakeGoals.length === 0) return base;
    return [...base].sort((a, b) => {
      const aSignal = getWellnestGoalSignalForTreatment(a);
      const bSignal = getWellnestGoalSignalForTreatment(b);
      const aScore = aSignal?.score ?? -1;
      const bScore = bSignal?.score ?? -1;
      if (aScore !== bScore) return bScore - aScore;
      const aMatchedCount = aSignal?.matchedGoals.length ?? 0;
      const bMatchedCount = bSignal?.matchedGoals.length ?? 0;
      if (aMatchedCount !== bMatchedCount) return bMatchedCount - aMatchedCount;
      return 0;
    });
  }, [suggestedTreatments, provider?.code, wellnessIntakeGoals]);

  const searchedTreatmentsToShow = useMemo(() => {
    const q = treatmentSearchQuery.trim();
    if (!q) return treatmentsToShow;
    return treatmentsToShow.filter((treatment) => {
      const wellnestOffering = getWellnestOfferingByTreatmentName(treatment);
      const groupLabel = wellnestOffering?.browseGroup
        ? (WELLNEST_BROWSE_GROUP_LABELS[wellnestOffering.browseGroup] ?? "")
        : "";
      const haystack = [
        treatment,
        extraTextForTreatmentSearch(treatment, providerCatalogContext, effectivePriceList),
        wellnestOffering?.category ?? "",
        groupLabel,
        wellnestOffering?.browseGroup ?? "",
        wellnestOffering?.addresses ?? "",
        wellnestOffering?.demographics ?? "",
      ].join(" ");
      return treatmentRecommenderCatalogSearchMatches(haystack, q);
    });
  }, [
    treatmentsToShow,
    treatmentSearchQuery,
    provider?.code,
    effectivePriceList,
  ]);

  const judgeMdFocusedTreatmentsToShow = useMemo(() => {
    if (!isJudgeMdProviderCode(provider?.code)) return searchedTreatmentsToShow;
    if (judgeMdTreatmentFocus === "nonsurgical") {
      return searchedTreatmentsToShow.filter((t) =>
        isJudgeMdNonsurgicalPlanBuilderTreatment(t),
      );
    }
    if (judgeMdTreatmentFocus === "surgical") {
      return searchedTreatmentsToShow.filter((t) => isJudgeMdSurgeryPlanCategory(t));
    }
    return searchedTreatmentsToShow;
  }, [judgeMdTreatmentFocus, provider?.code, searchedTreatmentsToShow]);

  const visibleTreatmentCount = isJudgeMdProviderCode(provider?.code)
    ? judgeMdFocusedTreatmentsToShow.length
    : searchedTreatmentsToShow.length;

  /** Judge MD: section labels + cards; other providers: card-only rows. */
  const treatmentRecommenderCardSpecs = useMemo(() => {
    if (isJudgeMdProviderCode(provider?.code)) {
      return buildJudgeMdPlanBuilderRowSpecs(judgeMdFocusedTreatmentsToShow);
    }
    return searchedTreatmentsToShow.map((treatment) => ({
      kind: "card" as const,
      treatment,
    }));
  }, [judgeMdFocusedTreatmentsToShow, provider?.code, searchedTreatmentsToShow]);

  useEffect(() => {
    setJudgeMdTreatmentFocus("all");
  }, [provider?.code, client.id]);

  /** Opens the skincare add-to-plan form and activates the recommended filter so the user lands directly on their client's recommended products. */
  const handleOpenSkincareWithRecommendedFilter = useCallback(() => {
    if (!onAddToPlanDirect) {
      showError("Add to plan is not available in this view.");
      return;
    }
    const treatment = "Skincare";
    const wellnestOffering = getWellnestOfferingByTreatmentName(treatment);
    const { deliveryForm, dosing } = getWellnestDeliveryDefaults(treatment);
    setSkincareRecommendedFilter(true);
    setSkincareCollapsedGroups(new Set());
    setSkincareProductSearchQuery("");
    setAddToPlanForTreatment((prev) => {
      if (prev?.treatment === treatment) return prev;
      return initialAddToPlanRowForTreatment(
        treatment,
        wellnestOffering,
        deliveryForm,
        dosing,
      );
    });
  }, [onAddToPlanDirect]);

  const handleAddToPlanConfirm = async () => {
    if (!addToPlanForTreatment) return;
    if (editingPlanItemId && !onUpdatePlanItem) return;
    const isSkincare = addToPlanForTreatment.treatment === "Skincare";
    const wellnestOffering = getWellnestOfferingByTreatmentName(
      addToPlanForTreatment.treatment,
    );
    const region =
      isSkincare
        ? ""
        : addToPlanForTreatment.where.length > 0
          ? addToPlanForTreatment.where.join(", ")
          : "";
    const treatmentProduct = treatmentProductHintForQuantity(
      addToPlanForTreatment,
    );
    const qtyStored = buildDiscussedBiostimQuantityFields(
      addToPlanForTreatment.treatment,
      treatmentProduct ?? undefined,
      addToPlanForTreatment.quantity,
      addToPlanForTreatment.bioTreatmentSessions,
    );
    const qtyCtxStored = getQuantityContext(
      addToPlanForTreatment.treatment,
      treatmentProduct ?? undefined,
      provider?.code,
    );
    const treatmentIntervalStored = resolveTreatmentIntervalForPlanItem(
      qtyCtxStored,
      qtyStored.bioTreatmentSessions ?? qtyStored.quantity,
      addToPlanForTreatment.treatmentInterval,
    );
    const noteParts: string[] = [];
    if (wellnestOffering && addToPlanForTreatment.deliveryForm?.trim()) {
      noteParts.push(
        `Delivery form: ${addToPlanForTreatment.deliveryForm.trim()}`,
      );
    }
    if (wellnestOffering && addToPlanForTreatment.dosing?.trim()) {
      noteParts.push(`Dosing: ${addToPlanForTreatment.dosing.trim()}`);
    }
    if (addToPlanForTreatment.notes?.trim()) {
      noteParts.push(addToPlanForTreatment.notes.trim());
    }
    const notesJoined =
      noteParts.length > 0 ? noteParts.join(" | ") : undefined;
    const findingsForItem = addToPlanForTreatment.findings?.filter((f) =>
      (f ?? "").trim(),
    );
    const scheduledTrim = addToPlanForTreatment.scheduledDate?.trim();
    const scheduledForPrefill =
      scheduledTrim && isValidPlanScheduledDateIso(scheduledTrim)
        ? scheduledTrim
        : undefined;
    const skincareAddOnNames = !isSkincare
      ? (addToPlanForTreatment.skincareAddOns ?? [])
          .map((n) => n.trim())
          .filter(Boolean)
      : [];
    const addSkincareAddOns = async () => {
      if (skincareAddOnNames.length === 0 || !onAddToPlanDirect) return;
      const addOnSourceLabel =
        treatmentProduct?.trim() || addToPlanForTreatment.treatment;
      const addOnPrefills = skincareAddOnNames.map((name) => ({
        interest: "",
        region: "",
        treatment: "Skincare",
        timeline: addToPlanForTreatment.when,
        scheduledDate: scheduledForPrefill,
        treatmentProduct: name,
        skincareAddOnForTreatment: addOnSourceLabel,
      }));
      if (onAddMultipleToPlanDirect) {
        await onAddMultipleToPlanDirect(addOnPrefills, { skipToast: true });
      } else {
        for (const p of addOnPrefills) {
          await onAddToPlanDirect(p, { skipToast: true });
        }
      }
    };
    const patch: Partial<DiscussedItem> = {
      region: region || undefined,
      treatment: addToPlanForTreatment.treatment,
      timeline: addToPlanForTreatment.when,
      scheduledDate: scheduledForPrefill,
      product: treatmentProduct?.trim() || undefined,
      quantity: qtyStored.quantity,
      bioTreatmentSessions: qtyStored.bioTreatmentSessions,
      treatmentInterval: treatmentIntervalStored,
      notes: notesJoined,
      findings: findingsForItem?.length ? findingsForItem : [],
    };
    try {
      if (editingPlanItemId && onUpdatePlanItem) {
        await onUpdatePlanItem(editingPlanItemId, patch);
        await addSkincareAddOns();
        setEditingPlanItemId(null);
        setAddToPlanForTreatment(null);
      } else {
        if (!onAddToPlanDirect) return;
        const skincareProductNames = isSkincare
          ? (addToPlanForTreatment.skincareWhat ?? [])
              .map((n) => n.trim())
              .filter(Boolean)
          : [];
        const splitNonSkincareProducts = !isSkincare
          ? expandCommaSeparatedProductsToPlanRows(
              addToPlanForTreatment.treatment,
              treatmentProduct?.trim(),
              provider?.code,
            )
          : null;
        if (isSkincare && skincareProductNames.length > 1) {
          const prefills = skincareProductNames.map((productName) => ({
            interest: "",
            region,
            treatment: addToPlanForTreatment.treatment,
            timeline: addToPlanForTreatment.when,
            scheduledDate: scheduledForPrefill,
            treatmentProduct: productName,
            quantity: addToPlanForTreatment.quantity?.trim() || undefined,
            notes: notesJoined,
            findings: findingsForItem?.length ? findingsForItem : undefined,
          }));
          let lastNew: DiscussedItem | undefined;
          if (onAddMultipleToPlanDirect) {
            const results = await onAddMultipleToPlanDirect(prefills, {
              skipToast: true,
            });
            if (results?.length) lastNew = results[results.length - 1];
          } else {
            for (const prefill of prefills) {
              const result = await onAddToPlanDirect!(prefill, {
                skipToast: true,
              });
              if (result) lastNew = result as DiscussedItem;
            }
          }
          showToast(
            `${skincareProductNames.length} skincare products added to plan`,
          );
          setAddToPlanForTreatment(null);
          if (lastNew) setLastAddedItem(lastNew);
        } else if (
          !isSkincare &&
          splitNonSkincareProducts &&
          splitNonSkincareProducts.length > 1
        ) {
          const prefills = splitNonSkincareProducts.map((productName) => {
            const regionForRow =
              usesOtherProceduresStructuredPlan(addToPlanForTreatment.treatment) &&
              productName.trim().toLowerCase() !== "prfm injections"
                ? ""
                : region;
            const qf = buildDiscussedBiostimQuantityFields(
              addToPlanForTreatment.treatment,
              productName,
              addToPlanForTreatment.quantity,
              addToPlanForTreatment.bioTreatmentSessions,
            );
            return {
              interest: "",
              region: regionForRow,
              treatment: addToPlanForTreatment.treatment,
              timeline: addToPlanForTreatment.when,
              scheduledDate: scheduledForPrefill,
              treatmentProduct: productName,
              quantity: qf.quantity,
              bioTreatmentSessions: qf.bioTreatmentSessions,
              treatmentInterval: resolveTreatmentIntervalForPlanItem(
                getQuantityContext(
                  addToPlanForTreatment.treatment,
                  productName,
                  provider?.code,
                ),
                qf.bioTreatmentSessions ?? qf.quantity,
                addToPlanForTreatment.treatmentInterval,
              ),
              notes: notesJoined,
              findings: findingsForItem?.length ? findingsForItem : undefined,
            };
          });
          let lastNew: DiscussedItem | undefined;
          if (onAddMultipleToPlanDirect) {
            const results = await onAddMultipleToPlanDirect(prefills, {
              skipToast: true,
            });
            if (results?.length) lastNew = results[results.length - 1];
          } else {
            for (const prefill of prefills) {
              const result = await onAddToPlanDirect!(prefill, {
                skipToast: true,
              });
              if (result) lastNew = result as DiscussedItem;
            }
          }
          await addSkincareAddOns();
          const addOnCount = skincareAddOnNames.length;
          showToast(
            `${splitNonSkincareProducts.length} ${addToPlanForTreatment.treatment} lines${addOnCount > 0 ? ` + ${addOnCount} skincare add-on${addOnCount > 1 ? "s" : ""}` : ""} added to plan`,
          );
          setAddToPlanForTreatment(null);
          if (lastNew) setLastAddedItem(lastNew);
        } else {
          const prefill: TreatmentPlanPrefill = {
            interest: "",
            region,
            treatment: addToPlanForTreatment.treatment,
            timeline: addToPlanForTreatment.when,
            scheduledDate: scheduledForPrefill,
            treatmentProduct,
            quantity: qtyStored.quantity,
            bioTreatmentSessions: qtyStored.bioTreatmentSessions,
            treatmentInterval: treatmentIntervalStored,
            notes: notesJoined,
            findings: findingsForItem?.length ? findingsForItem : undefined,
          };
          const newItem = await onAddToPlanDirect(prefill);
          await addSkincareAddOns();
          setAddToPlanForTreatment(null);
          if (newItem) setLastAddedItem(newItem);
        }
      }
    } catch {
      /* parent shows error */
    }
  };

  const addPlanDraftPricing = useMemo(() => {
    if (!addToPlanForTreatment) {
      return {
        message: null as string | null,
        placement: null as AddPlanPricingHintPlacement | null,
      };
    }
    const message = getMissingPricingInfoForAddPlanDraft(
      addToPlanForTreatment as AddPlanFormState,
      provider?.code,
      effectivePriceList,
    );
    const placement = message
      ? inferAddPlanPricingHintPlacement(message)
      : null;
    return { message, placement };
  }, [addToPlanForTreatment, provider?.code, effectivePriceList]);

  /** Whether this treatment is already in the treatment plan (so we show "Added" and allow add-another flow). */
  const isTreatmentInPlan = (treatmentName: string): boolean => {
    if (lastAddedItem && lastAddedItem.treatment === treatmentName) return true;
    return (client.discussedItems ?? []).some(
      (i) => i.treatment === treatmentName,
    );
  };

  useEffect(() => {
    if (
      !addToPlanForTreatment ||
      addToPlanForTreatment.treatment === "Skincare"
    )
      return;
    const qtyCtx = getQuantityContext(
      addToPlanForTreatment.treatment,
      treatmentProductHintForQuantity(addToPlanForTreatment),
      provider?.code,
    );
    if (qtyCtx.quantityControl === "text") return;
    const q = (addToPlanForTreatment.quantity ?? "").trim();
    const s = (addToPlanForTreatment.bioTreatmentSessions ?? "").trim();

    if (qtyCtx.sculptraSessions) {
      const ss = qtyCtx.sculptraSessions;
      const vOk = q && qtyCtx.options.includes(q);
      const sOk = s && ss.options.includes(s);
      const nextSessions = sOk ? s : ss.defaultSessions;
      const nextInterval =
        resolveTreatmentIntervalForPlanItem(
          qtyCtx,
          nextSessions,
          addToPlanForTreatment.treatmentInterval,
        ) ?? "";
      if (
        vOk &&
        sOk &&
        (addToPlanForTreatment.treatmentInterval ?? "") === nextInterval
      )
        return;
      setAddToPlanForTreatment((prev) =>
        prev
          ? {
              ...prev,
              quantity: vOk ? q : qtyCtx.defaultQuantity,
              bioTreatmentSessions: nextSessions,
              treatmentInterval: nextInterval,
            }
          : null,
      );
      return;
    }

    if (qtyCtx.primaryDiscussedField === "bioTreatmentSessions") {
      const sOk = s && qtyCtx.options.includes(s);
      const nextSessions = sOk ? s : qtyCtx.defaultQuantity;
      const nextInterval =
        resolveTreatmentIntervalForPlanItem(
          qtyCtx,
          nextSessions,
          addToPlanForTreatment.treatmentInterval,
        ) ?? "";
      if (
        sOk &&
        (addToPlanForTreatment.treatmentInterval ?? "") === nextInterval
      )
        return;
      setAddToPlanForTreatment((prev) =>
        prev
          ? {
              ...prev,
              bioTreatmentSessions: nextSessions,
              treatmentInterval: nextInterval,
            }
          : null,
      );
      return;
    }

    const { options, defaultQuantity } = qtyCtx;
    if (q && options.includes(q)) return;
    const next = defaultQuantity;
    if (q !== next) {
      setAddToPlanForTreatment((prev) =>
        prev ? { ...prev, quantity: next } : null,
      );
    }
  }, [
    addToPlanForTreatment?.treatment,
    addToPlanForTreatment?.laserWhat,
    addToPlanForTreatment?.biostimulantWhat,
    addToPlanForTreatment?.microneedlingType,
    addToPlanForTreatment?.facialServiceWhat,
    addToPlanForTreatment?.deliveryForm,
    addToPlanForTreatment?.product,
    addToPlanForTreatment?.skincareWhat,
    addToPlanForTreatment?.skincareCategoryFilter,
    addToPlanForTreatment?.quantity,
    addToPlanForTreatment?.bioTreatmentSessions,
    addToPlanForTreatment?.treatmentInterval,
  ]);

  useEffect(() => {
    if (!editingPlanItemId) return;
    const exists = (client.discussedItems ?? []).some(
      (i) => i.id === editingPlanItemId,
    );
    if (!exists) {
      setEditingPlanItemId(null);
      setAddToPlanForTreatment(null);
    }
  }, [client.discussedItems, editingPlanItemId]);

  useEffect(() => {
    if (!editingPlanItemId || !addToPlanForTreatment) return;
    const t = addToPlanForTreatment.treatment;
    const id = requestAnimationFrame(() => {
      cardRefsMap.current[t]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
    return () => cancelAnimationFrame(id);
  }, [editingPlanItemId, addToPlanForTreatment?.treatment]);

  useEffect(() => {
    const name = initialFocusTreatmentName?.trim();
    if (!name) return;

    setTreatmentSearchQuery("");
    if (isJudgeMdProviderCode(provider?.code)) {
      if (isJudgeMdSurgeryPlanCategory(name)) {
        setJudgeMdTreatmentFocus("surgical");
      } else if (isJudgeMdNonsurgicalPlanBuilderTreatment(name)) {
        setJudgeMdTreatmentFocus("nonsurgical");
      } else {
        setJudgeMdTreatmentFocus("all");
      }
    }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 40;

    const tryFocus = () => {
      if (cancelled) return;
      attempts += 1;
      const el =
        cardRefsMap.current[name] ??
        document.getElementById(
          `treatment-recommender-card-${planOptDomIdSuffix(name)}`,
        );
      if (el) {
        setFocusedTreatmentHighlight(name);
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        window.setTimeout(() => {
          if (!cancelled) setFocusedTreatmentHighlight(null);
        }, 3200);
        onConsumedInitialFocusTreatmentName?.();
        return;
      }
      if (attempts < maxAttempts) {
        window.setTimeout(tryFocus, 50);
      } else {
        onConsumedInitialFocusTreatmentName?.();
      }
    };

    const startTimer = window.setTimeout(tryFocus, 80);
    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
    };
  }, [
    initialFocusTreatmentName,
    onConsumedInitialFocusTreatmentName,
    provider?.code,
    treatmentsToShow.length,
  ]);

  useEffect(() => {
    if (!addToPlanForTreatment) {
      setAddPlanToAddressOtherOpen(false);
      setAddPlanToAddressOtherSearch("");
    }
  }, [addToPlanForTreatment]);

  const getBreakdownRowsForTreatment = (treatment: string) => {
    if (treatment === "Filler") {
      const byArea = getFindingsByAreaForTreatment("Filler");
      return byArea.map(({ area, findings }) => ({
        label: area,
        issues: findings,
      }));
    }
    if (treatment === "Skincare") {
      const skinHealth = CATEGORIES.find((c) => c.key === "skinHealth");
      if (!skinHealth) return [];
      return skinHealth.subScores.map((sub) => ({
        label: sub.name,
        issues: sub.issues,
      }));
    }
    if (treatment === "Neurotoxin") {
      const skinHealth = CATEGORIES.find((c) => c.key === "skinHealth");
      const wrinkles = skinHealth?.subScores.find((s) => s.name === "Wrinkles");
      if (!wrinkles) return [];
      return [{ label: "Wrinkles", issues: wrinkles.issues }];
    }
    const byArea = getFindingsByAreaForTreatment(treatment);
    return byArea.map(({ area, findings }) => ({
      label: area,
      issues: findings,
    }));
  };

  /** Findings relevant to this treatment that the client actually has (for personalized copy). */
  const getRelevantFindingsForTreatment = (treatment: string): string[] => {
    const rows = getBreakdownRowsForTreatment(treatment);
    const relevant: string[] = [];
    for (const row of rows) {
      for (const issue of row.issues) {
        if (
          detectedIssues.has(normalizeIssue(issue)) &&
          !relevant.includes(issue)
        ) {
          relevant.push(issue);
        }
      }
    }
    return relevant;
  };

  const getWhyExplanation = (treatment: string): string => {
    const wellnestO = getWellnestOfferingByTreatmentName(treatment);
    if (wellnestO) {
      const demographicLead =
        wellnestO.demographics.split(/[.;,]/)[0]?.trim() ||
        "selected based on your intake goals";
      const categoryLead = wellnestO.category.trim().toLowerCase();
      return `A ${categoryLead} option often considered for ${demographicLead.toLowerCase()}.`;
    }
    const relevant = getRelevantFindingsForTreatment(treatment);
    const findingsText =
      relevant.length > 0
        ? relevant.slice(0, 4).join(", ") +
          (relevant.length > 4 ? " and more" : "")
        : combinedFindings.slice(0, 3).join(", ") || "their areas of concern";

    switch (treatment) {
      case "Neurotoxin":
        return relevant.length > 0
          ? `Your client shows ${findingsText}. Neurotoxin can soften these dynamic lines and is a strong same-day add-on.`
          : `Neurotoxin can soften dynamic wrinkles (e.g. forehead, glabella, crow's feet) and fits well as a same-day option for this visit.`;
      case "Filler":
        return relevant.length > 0
          ? `Volume and contour concerns — including ${findingsText} — make filler a good fit. Targeted placement can address these areas.`
          : `Filler can address volume loss and contour concerns. Based on this client's profile, it's a recommended option for today's visit.`;
      case "Skincare":
        return relevant.length > 0
          ? `Their skin quiz points to ${findingsText}. A tailored skincare regimen can complement today's visit and support longer-term results.`
          : `Skincare can target texture, tone, and hydration. A personalized regimen is a good complement to in-office treatments.`;
      case "Other procedures":
        return relevant.length > 0
          ? `Given ${findingsText}, some other procedures like PRFM are recommended for this client.`
          : `Based on this client's profile, some other procedures like PRFM are recommended for this client.`;
      default:
        return relevant.length > 0
          ? `Given ${findingsText}, ${treatment} is a recommended option for this client.`
          : `Based on this client's profile, ${treatment} is a recommended option.`;
    }
  };

  const currentClientPhotoUrl =
    clientPhotoView === "front" ? frontPhotoUrl : sidePhotoUrl;
  const hasFront = frontPhotoUrl != null;
  const hasSide = sidePhotoUrl != null;
  const hasAnyClientPhoto = hasFront || hasSide;

  /** Plan items grouped by section (Skincare first when present, then Now, Add next visit, Scheduled, Wishlist, Completed). */
  const planItemsBySection = useMemo(() => {
    const items = client.discussedItems ?? [];
    const skincare: DiscussedItem[] = [];
    const now: DiscussedItem[] = [];
    const addNext: DiscussedItem[] = [];
    const scheduled: DiscussedItem[] = [];
    const wishlist: DiscussedItem[] = [];
    const completed: DiscussedItem[] = [];
    for (const item of items) {
      if (item.treatment?.trim() === "Skincare") {
        skincare.push(item);
      } else if (item.scheduledDate?.trim()) {
        scheduled.push(item);
      } else {
        const t = item.timeline?.trim();
        if (t === "Now") now.push(item);
        else if (t === "Add next visit") addNext.push(item);
        else if (t === "Completed") completed.push(item);
        else wishlist.push(item);
      }
    }
    const byTreatment = (a: DiscussedItem, b: DiscussedItem) =>
      (a.treatment || "").localeCompare(b.treatment || "");
    const byProduct = (a: DiscussedItem, b: DiscussedItem) =>
      (a.product || "").localeCompare(b.product || "");
    const byScheduledThenTreatment = (a: DiscussedItem, b: DiscussedItem) => {
      const da = (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? "");
      if (da !== 0) return da;
      return byTreatment(a, b);
    };
    return {
      [SKINCARE_SECTION_LABEL]: skincare.sort(byProduct),
      Now: now.sort(byTreatment),
      "Add next visit": addNext.sort(byTreatment),
      [SCHEDULED_SECTION_LABEL]: scheduled.sort(byScheduledThenTreatment),
      Wishlist: wishlist.sort(byTreatment),
      Completed: completed.sort(byTreatment),
    };
  }, [client.discussedItems]);

  const planSectionLabels = useMemo(() => {
    const hasSkincare =
      (planItemsBySection[SKINCARE_SECTION_LABEL]?.length ?? 0) > 0;
    return hasSkincare
      ? [SKINCARE_SECTION_LABEL, ...PLAN_SECTIONS]
      : [...PLAN_SECTIONS];
  }, [planItemsBySection]);

  const planItemCount = (client.discussedItems ?? []).length;
  const planLastUpdatedShort = useMemo(
    () => planItemsLastUpdatedShortLabel(client.discussedItems),
    [client.discussedItems],
  );
  const firstName = client.name?.trim().split(/\s+/)[0] || "Patient";

  const checkoutLinesByDiscussedIndex = useMemo(
    () =>
      getAlignedCheckoutLineItemsForDiscussedItems(
        client.discussedItems ?? [],
        effectivePriceList,
      ),
    [client.discussedItems, effectivePriceList],
  );
  const discussedIndexByIdForPricing = useMemo(() => {
    const m = new Map<string, number>();
    (client.discussedItems ?? []).forEach((d, i) => m.set(d.id, i));
    return m;
  }, [client.discussedItems]);

  const planItemsByScheduledDate = useMemo(() => {
    const byDate = new Map<string, DiscussedItem[]>();
    for (const item of client.discussedItems ?? []) {
      const iso = item.scheduledDate?.trim();
      if (iso && isValidPlanScheduledDateIso(iso)) {
        const cur = byDate.get(iso) ?? [];
        cur.push(item);
        byDate.set(iso, cur);
      }
    }
    return { byDate };
  }, [client.discussedItems]);

  const planHasScheduledItems = planItemsByScheduledDate.byDate.size > 0;

  /** Dated items grouped by calendar month for schedule/agenda view. */
  const planCalendarAgenda = useMemo(
    () => buildPlanCalendarAgendaFromDiscussedItems(client.discussedItems ?? []),
    [client.discussedItems],
  );

  /** Plan calendar view shortcut: Scheduled header first, then Wishlist/Skincare fallbacks. */
  const planCalendarShortcutSection = useMemo(() => {
    if (!planHasScheduledItems) return null;
    const ps = planItemsBySection as Record<string, DiscussedItem[]>;
    if ((ps[SCHEDULED_SECTION_LABEL]?.length ?? 0) > 0)
      return SCHEDULED_SECTION_LABEL;
    if ((ps.Wishlist?.length ?? 0) > 0) return "Wishlist";
    if ((ps[SKINCARE_SECTION_LABEL]?.length ?? 0) > 0)
      return SKINCARE_SECTION_LABEL;
    return null;
  }, [planHasScheduledItems, planItemsBySection]);

  const planCalendarMonthMeta = useMemo(() => {
    const y = planCalendarMonth.getFullYear();
    const m = planCalendarMonth.getMonth();
    const firstWeekday = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const monthLabel = new Intl.DateTimeFormat(undefined, {
      month: "long",
      year: "numeric",
    }).format(new Date(y, m, 1));
    const cells: Array<{
      iso: string;
      dayNum: number;
    } | null> = [];
    for (let i = 0; i < firstWeekday; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ iso, dayNum: d });
    }
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }
    return { monthLabel, cells, y, m };
  }, [planCalendarMonth]);

  useEffect(() => {
    if (!planHasScheduledItems && planViewMode === "calendar") {
      setPlanViewMode("list");
    }
  }, [planHasScheduledItems, planViewMode]);

  useEffect(() => {
    if (!planHasScheduledItems) {
      planCalendarInitRef.current = false;
    }
  }, [planHasScheduledItems]);

  useEffect(() => {
    if (planViewMode !== "calendar" || !planHasScheduledItems) return;
    if (planCalendarInitRef.current) return;
    planCalendarInitRef.current = true;
    const t = new Date();
    const iso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
    setPlanCalendarMonth(new Date(t.getFullYear(), t.getMonth(), 1));
    setPlanCalendarSelectedIso(iso);
  }, [planViewMode, planHasScheduledItems]);

  return (
    <div className="treatment-recommender-by-treatment">
      <aside className="treatment-recommender-by-treatment__client-column">
        {hasAnyClientPhoto && (
          <>
            <div
              className={`treatment-recommender-by-treatment__client-photo-wrap ${
                currentClientPhotoUrl
                  ? "treatment-recommender-by-treatment__client-photo-wrap--clickable"
                  : ""
              }`}
              role={currentClientPhotoUrl ? "button" : undefined}
              tabIndex={currentClientPhotoUrl ? 0 : undefined}
              onClick={() =>
                currentClientPhotoUrl && setShowClientPhotoModal(true)
              }
              onKeyDown={(e) =>
                currentClientPhotoUrl &&
                (e.key === "Enter" || e.key === " ") &&
                setShowClientPhotoModal(true)
              }
              title={currentClientPhotoUrl ? "Click to expand" : undefined}
            >
              {currentClientPhotoUrl ? (
                <>
                  <img
                    src={currentClientPhotoUrl}
                    alt={`${client.name} – ${clientPhotoView}`}
                    className="treatment-recommender-by-treatment__client-photo"
                  />
                  <div className="treatment-recommender-by-treatment__client-photo-overlay">
                    Click to expand
                  </div>
                </>
              ) : (
                <div className="treatment-recommender-by-treatment__client-photo-placeholder">
                  No {clientPhotoView} photo
                </div>
              )}
            </div>
            <div className="treatment-recommender-by-treatment__client-photo-toggles">
              <button
                type="button"
                className={`treatment-recommender-by-treatment__client-toggle ${
                  clientPhotoView === "front"
                    ? "treatment-recommender-by-treatment__client-toggle--active"
                    : ""
                }`}
                onClick={() => setClientPhotoView("front")}
                disabled={!hasFront}
              >
                Front
              </button>
              <button
                type="button"
                className={`treatment-recommender-by-treatment__client-toggle ${
                  clientPhotoView === "side"
                    ? "treatment-recommender-by-treatment__client-toggle--active"
                    : ""
                }`}
                onClick={() => setClientPhotoView("side")}
                disabled={!hasSide}
              >
                Side
              </button>
            </div>
          </>
        )}

        <div
          className={`treatment-recommender-by-treatment__plan-section${
            !hasAnyClientPhoto
              ? " treatment-recommender-by-treatment__plan-section--no-client-photo"
              : ""
          }`}
        >
          <div className="treatment-recommender-by-treatment__plan-title-row">
            <div className="treatment-recommender-by-treatment__plan-title-block">
              <h3 className="treatment-recommender-by-treatment__plan-title">
                {firstName}&apos;s plan{" "}
                <span className="treatment-recommender-by-treatment__plan-item-count">
                  ({planItemCount} {planItemCount === 1 ? "item" : "items"})
                </span>
              </h3>
              {planLastUpdatedShort ? (
                <p className="treatment-recommender-by-treatment__plan-last-updated">
                  Last updated {planLastUpdatedShort}
                </p>
              ) : null}
            </div>
            {planItemCount > 0 && planHasScheduledItems && planViewMode === "calendar" ? (
              <button
                type="button"
                className="treatment-recommender-by-treatment__plan-back-to-list-btn"
                aria-label="Back to list view"
                title="List view"
                onClick={() => setPlanViewMode("list")}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <line x1="9" y1="6" x2="20" y2="6" />
                  <line x1="9" y1="12" x2="20" y2="12" />
                  <line x1="9" y1="18" x2="20" y2="18" />
                  <circle cx="4.5" cy="6" r="1.5" fill="currentColor" stroke="none" />
                  <circle cx="4.5" cy="12" r="1.5" fill="currentColor" stroke="none" />
                  <circle cx="4.5" cy="18" r="1.5" fill="currentColor" stroke="none" />
                </svg>
              </button>
            ) : null}
            {onShareTreatmentPlan ? (
              <button
                type="button"
                className="btn-secondary btn-sm treatment-recommender-by-treatment__plan-share-btn"
                onClick={() => onShareTreatmentPlan()}
              >
                Share
              </button>
            ) : null}
          </div>
          <div className="treatment-recommender-by-treatment__plan-body">
            {planItemCount === 0 ? (
              <p className="treatment-recommender-by-treatment__plan-empty">
                No plan items yet.
              </p>
            ) : planViewMode === "calendar" && planHasScheduledItems ? (
              <div className="treatment-recommender-by-treatment__plan-calendar">
                <div
                  className="treatment-recommender-by-treatment__plan-calendar-subview-toggle"
                  role="tablist"
                  aria-label="Plan calendar layout"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={planCalendarSubView === "schedule"}
                    className={`treatment-recommender-by-treatment__plan-calendar-subview-btn${
                      planCalendarSubView === "schedule"
                        ? " treatment-recommender-by-treatment__plan-calendar-subview-btn--active"
                        : ""
                    }`}
                    onClick={() => setPlanCalendarSubView("schedule")}
                  >
                    Schedule
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={planCalendarSubView === "month"}
                    className={`treatment-recommender-by-treatment__plan-calendar-subview-btn${
                      planCalendarSubView === "month"
                        ? " treatment-recommender-by-treatment__plan-calendar-subview-btn--active"
                        : ""
                    }`}
                    onClick={() => setPlanCalendarSubView("month")}
                  >
                    Month
                  </button>
                </div>
                {planCalendarSubView === "schedule" ? (
                  <div
                    className="treatment-recommender-by-treatment__plan-calendar-schedule"
                    aria-label="Scheduled treatments by month"
                  >
                    {planCalendarAgenda.length === 0 ? (
                      <p className="treatment-recommender-by-treatment__plan-calendar-schedule-empty">
                        No dated treatments.
                      </p>
                    ) : (
                      planCalendarAgenda.map((month) => (
                        <section
                          key={month.monthKey}
                          className="treatment-recommender-by-treatment__plan-calendar-schedule-month"
                        >
                          <h4 className="treatment-recommender-by-treatment__plan-calendar-schedule-month-title">
                            {month.monthLabel}
                          </h4>
                          <div className="treatment-recommender-by-treatment__plan-calendar-schedule-days">
                            {month.days.map((day) => (
                              <div
                                key={day.iso}
                                className="treatment-recommender-by-treatment__plan-calendar-schedule-day"
                              >
                                <div
                                  className="treatment-recommender-by-treatment__plan-calendar-schedule-day-date"
                                  title={
                                    formatPlanScheduledDateLabel(day.iso) ??
                                    day.iso
                                  }
                                >
                                  {day.dateShort}
                                </div>
                                <ul className="treatment-recommender-by-treatment__plan-calendar-schedule-day-items">
                                  {day.items.map((item) => (
                                    <li key={item.id}>
                                      {formatTreatmentPlanRowFullLine(item)}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </section>
                      ))
                    )}
                  </div>
                ) : (
                  <>
                    <div className="treatment-recommender-by-treatment__plan-calendar-nav">
                      <button
                        type="button"
                        className="treatment-recommender-by-treatment__plan-calendar-nav-btn"
                        aria-label="Previous month"
                        onClick={() =>
                          setPlanCalendarMonth((prev) =>
                            new Date(
                              prev.getFullYear(),
                              prev.getMonth() - 1,
                              1,
                            ),
                          )
                        }
                      >
                        ‹
                      </button>
                      <span className="treatment-recommender-by-treatment__plan-calendar-month-label">
                        {planCalendarMonthMeta.monthLabel}
                      </span>
                      <button
                        type="button"
                        className="treatment-recommender-by-treatment__plan-calendar-nav-btn"
                        aria-label="Next month"
                        onClick={() =>
                          setPlanCalendarMonth((prev) =>
                            new Date(
                              prev.getFullYear(),
                              prev.getMonth() + 1,
                              1,
                            ),
                          )
                        }
                      >
                        ›
                      </button>
                    </div>
                    <div
                      className="treatment-recommender-by-treatment__plan-calendar-weekdays"
                      aria-hidden
                    >
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                        (w) => (
                          <span key={w}>{w}</span>
                        ),
                      )}
                    </div>
                    <div
                      className="treatment-recommender-by-treatment__plan-calendar-grid"
                      role="grid"
                      aria-label={`Treatments in ${planCalendarMonthMeta.monthLabel}`}
                    >
                      {planCalendarMonthMeta.cells.map((cell, idx) => {
                        if (!cell) {
                          return (
                            <div
                              key={`pad-${idx}`}
                              className="treatment-recommender-by-treatment__plan-calendar-cell treatment-recommender-by-treatment__plan-calendar-cell--empty"
                            />
                          );
                        }
                        const dayItems =
                          planItemsByScheduledDate.byDate.get(cell.iso) ?? [];
                        const selected = planCalendarSelectedIso === cell.iso;
                        return (
                          <button
                            key={cell.iso}
                            type="button"
                            role="gridcell"
                            className={`treatment-recommender-by-treatment__plan-calendar-cell${
                              selected
                                ? " treatment-recommender-by-treatment__plan-calendar-cell--selected"
                                : ""
                            }${dayItems.length ? " treatment-recommender-by-treatment__plan-calendar-cell--has-items" : ""}`}
                            onClick={() => setPlanCalendarSelectedIso(cell.iso)}
                          >
                            <span className="treatment-recommender-by-treatment__plan-calendar-day-num">
                              {cell.dayNum}
                            </span>
                            {dayItems.length > 0 ? (
                              <span
                                className="treatment-recommender-by-treatment__plan-calendar-day-count"
                                aria-label={`${dayItems.length} treatment${dayItems.length === 1 ? "" : "s"}`}
                              >
                                {dayItems.length}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                    {planCalendarSelectedIso ? (
                      <div className="treatment-recommender-by-treatment__plan-calendar-detail">
                        <h4 className="treatment-recommender-by-treatment__plan-calendar-detail-title">
                          {formatPlanScheduledDateLabel(
                            planCalendarSelectedIso,
                          ) ?? planCalendarSelectedIso}
                        </h4>
                        {(planItemsByScheduledDate.byDate.get(
                          planCalendarSelectedIso,
                        ) ?? []
                        ).length === 0 ? (
                          <p className="treatment-recommender-by-treatment__plan-calendar-detail-empty">
                            No treatments on this day.
                          </p>
                        ) : (
                          <ul className="treatment-recommender-by-treatment__plan-calendar-detail-list">
                            {(
                              planItemsByScheduledDate.byDate.get(
                                planCalendarSelectedIso,
                              ) ?? []
                            ).map((item) => (
                              <li key={item.id}>
                                {formatTreatmentPlanRowFullLine(item)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            ) : (
              <div className="treatment-recommender-by-treatment__plan-list">
                {planSectionLabels.map((sectionLabel) => {
                const sectionItems =
                  (planItemsBySection as Record<string, DiscussedItem[]>)[
                    sectionLabel
                  ] ?? [];
                if (sectionItems.length === 0) return null;
                return (
                  <div
                    key={sectionLabel}
                    className="treatment-recommender-by-treatment__plan-group"
                  >
                    <h4
                      className={`treatment-recommender-by-treatment__plan-group-title${
                        planCalendarShortcutSection === sectionLabel &&
                        planViewMode === "list"
                          ? " treatment-recommender-by-treatment__plan-group-title--with-calendar"
                          : ""
                      }`}
                    >
                      <span>
                        {sectionLabel === "Completed"
                          ? "Completed"
                          : timelineOptionDisplayLabel(sectionLabel)}
                      </span>
                      {planCalendarShortcutSection === sectionLabel &&
                      planViewMode === "list" ? (
                        <button
                          type="button"
                          className="treatment-recommender-by-treatment__plan-group-calendar-btn"
                          aria-label="Open calendar view for scheduled treatments"
                          title="Calendar view"
                          onClick={() => setPlanViewMode("calendar")}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                          >
                            <rect
                              x="3"
                              y="4"
                              width="18"
                              height="18"
                              rx="2"
                              ry="2"
                            />
                            <path d="M16 2v4" />
                            <path d="M8 2v4" />
                            <path d="M3 10h18" />
                          </svg>
                        </button>
                      ) : null}
                    </h4>
                    {sectionItems.map((item: DiscussedItem) => {
                      const isBuilt = (item.timeline ?? "").trim() === "Completed";
                      const planPrimary = getTreatmentPlanRowPrimaryLabel(item);
                      const planSecondary = getTreatmentPlanRowSecondaryLabel(
                        item,
                        { omitTimeline: true },
                      );
                      const planFullLine = formatTreatmentPlanRowFullLine(item, {
                        omitTimeline: true,
                      });
                      const pricingIdx = discussedIndexByIdForPricing.get(item.id);
                    const pricingMissing =
                      pricingIdx !== undefined
                        ? checkoutLinesByDiscussedIndex[pricingIdx]?.missingInfo
                        : undefined;
                    const pricingWarnShort = planPricingWarningShort(pricingMissing);
                    return (
                        <div
                          key={item.id}
                          id={`treatment-plan-item-${item.id}`}
                          className={`treatment-recommender-by-treatment__plan-row-wrap${
                            editingPlanItemId === item.id
                              ? " treatment-recommender-by-treatment__plan-row-wrap--editing"
                              : ""
                          }${pricingMissing ? " treatment-recommender-by-treatment__plan-row-wrap--pricing-incomplete" : ""}${isBuilt ? " treatment-recommender-by-treatment__plan-row-wrap--built" : ""}`}
                        >
                          {onUpdatePlanItem ? (
                            <button
                              type="button"
                              className="treatment-recommender-by-treatment__plan-row treatment-recommender-by-treatment__plan-row--interactive"
                              aria-pressed={editingPlanItemId === item.id}
                              aria-label={
                                editingPlanItemId === item.id
                                  ? `Close editor for ${planFullLine}`
                                  : `Edit ${planFullLine} on plan`
                              }
                              title={
                                editingPlanItemId === item.id
                                  ? "Click to close editor"
                                  : "Click to edit this plan line"
                              }
                              onClick={() => {
                                if (editingPlanItemId === item.id) {
                                  setEditingPlanItemId(null);
                                  setAddToPlanForTreatment(null);
                                } else {
                                  setEditingPlanItemId(item.id);
                                  setAddToPlanForTreatment(
                                    discussedItemToAddPlanFormState(
                                      item,
                                      provider?.code,
                                    ),
                                  );
                                }
                              }}
                            >
                              <span className="treatment-recommender-by-treatment__plan-row-inner">
                                <span className="treatment-recommender-by-treatment__plan-row-body">
                                  <span className="treatment-recommender-by-treatment__plan-row-treatment">
                                    {isBuilt && (
                                      <span className="plan-row-built-badge" aria-label="Built">✓ </span>
                                    )}
                                    {planPrimary}
                                  </span>
                                  {planSecondary ? (
                                    <span className="treatment-recommender-by-treatment__plan-row-meta">
                                      {planSecondary}
                                    </span>
                                  ) : null}
                                  {pricingWarnShort ? (
                                    <span
                                      className="plan-pricing-warning-pill treatment-recommender-by-treatment__plan-row-pricing-badge"
                                      title={pricingMissing}
                                    >
                                      {pricingWarnShort}
                                    </span>
                                  ) : null}
                                </span>
                              </span>
                            </button>
                          ) : (
                            <div
                              className="treatment-recommender-by-treatment__plan-row treatment-recommender-by-treatment__plan-row--readonly"
                              aria-label={`${planFullLine} on plan`}
                            >
                              <span className="treatment-recommender-by-treatment__plan-row-inner">
                                <span className="treatment-recommender-by-treatment__plan-row-body">
                                  <span className="treatment-recommender-by-treatment__plan-row-treatment">
                                    {isBuilt && (
                                      <span className="plan-row-built-badge" aria-label="Built">✓ </span>
                                    )}
                                    {planPrimary}
                                  </span>
                                  {planSecondary ? (
                                    <span className="treatment-recommender-by-treatment__plan-row-meta">
                                      {planSecondary}
                                    </span>
                                  ) : null}
                                  {pricingWarnShort ? (
                                    <span
                                      className="plan-pricing-warning-pill treatment-recommender-by-treatment__plan-row-pricing-badge"
                                      title={pricingMissing}
                                    >
                                      {pricingWarnShort}
                                    </span>
                                  ) : null}
                                </span>
                              </span>
                            </div>
                          )}
                          <div className="treatment-recommender-by-treatment__plan-row-actions">
                            {onRemovePlanItem && (
                              <button
                                type="button"
                                className="treatment-recommender-by-treatment__plan-row-remove"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const message = planPrimary
                                    ? `Remove "${planPrimary}" from the treatment plan?`
                                    : "Remove this item from the treatment plan?";
                                  if (window.confirm(message)) {
                                    onRemovePlanItem(item.id);
                                  }
                                }}
                                aria-label={`Remove ${planFullLine} from plan`}
                                title="Remove from plan"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
                })}
              </div>
            )}
          </div>
          {onOpenCheckout ? (
            <div className="treatment-recommender-by-treatment__plan-actions">
              <button
                type="button"
                className="treatment-recommender-by-treatment__plan-checkout-btn"
                disabled={planItemCount === 0}
                onClick={() => onOpenCheckout()}
              >
                Quote
              </button>
            </div>
          ) : null}
        </div>
      </aside>

      <div className="treatment-recommender-by-treatment__main">
        <div className="treatment-recommender-by-treatment__body">
          <h2 className="treatment-recommender-by-treatment__screen-heading">
            Treatment recommendations
          </h2>
          <div className="treatment-recommender-by-treatment__search-row">
            <input
              type="search"
              className="treatment-recommender-by-treatment__search-input"
              placeholder="Search treatments..."
              value={treatmentSearchQuery}
              onChange={(e) => setTreatmentSearchQuery(e.target.value)}
              aria-label="Search treatments"
            />
          </div>

          {isJudgeMdProviderCode(provider?.code) ? (
            <div className="treatment-recommender-by-treatment__focus-toggle-row">
              <span className="treatment-recommender-by-treatment__focus-toggle-label">
                Considering:
              </span>
              <div
                className="treatment-recommender-by-treatment__focus-toggle-group"
                role="group"
                aria-label="Consider surgical or non-surgical options"
              >
                {[
                  { id: "all" as const, label: "All" },
                  { id: "nonsurgical" as const, label: "Non-surgical" },
                  { id: "surgical" as const, label: "Surgical" },
                ].map((option) => {
                  const selected = judgeMdTreatmentFocus === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`treatment-recommender-by-treatment__focus-toggle-btn${
                        selected
                          ? " treatment-recommender-by-treatment__focus-toggle-btn--active"
                          : ""
                      }`}
                      onClick={() => setJudgeMdTreatmentFocus(option.id)}
                      aria-pressed={selected}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <h2 className="treatment-recommender-by-treatment__results-heading">
            {visibleTreatmentCount} treatment option
            {visibleTreatmentCount !== 1 ? "s" : ""}
          </h2>

          <div className="treatment-recommender-by-treatment__cards">
            {visibleTreatmentCount === 0 ? (
              <p className="treatment-recommender-by-treatment__empty">
                No treatments match your current search or selection.
              </p>
            ) : (
              treatmentRecommenderCardSpecs.map((spec) => {
                if (spec.kind === "heading") {
                  return (
                    <h3
                      key={spec.key}
                      className="treatment-recommender-by-treatment__plan-group-label"
                    >
                      {spec.label}
                    </h3>
                  );
                }
                const treatment = spec.treatment;
                const wellnestOffering =
                  getWellnestOfferingByTreatmentName(treatment);
                const wellnestDeliveryOptions = wellnestOffering
                  ? getWellnestProductOptionsForTreatment(treatment)
                  : [];
                const wellnestDefaultDeliveryForm =
                  wellnestDeliveryOptions.find((o) =>
                    o.toLowerCase().includes("sc"),
                  ) ??
                  wellnestDeliveryOptions.find((o) =>
                    o.toLowerCase().includes("sub"),
                  ) ??
                  wellnestDeliveryOptions[0] ??
                  "SubQ";
                const wellnestDefaultDosing =
                  getWellnestDefaultDosing(wellnestOffering);
                const wellnestGoalSignal =
                  getWellnestGoalSignalForTreatment(treatment);
                const showWellnestGoalMatchBadge = Boolean(
                  wellnestGoalSignal && wellnestGoalSignal.score > 0,
                );
                const wellnestGoalMatchLabel = showWellnestGoalMatchBadge
                  ? wellnestGoalSignal!.matchedGoals.length >=
                    wellnessIntakeGoals.length
                    ? `Matches all goals: ${wellnestGoalSignal!.matchedGoals.join(", ")}`
                    : `Matches goals: ${wellnestGoalSignal!.matchedGoals.join(", ")}`
                  : "";
                const wellnessQuizTreatmentId =
                  wellnestOffering?.wellnessQuizId?.trim() ?? "";
                const showWellnessQuizTreatmentBadge = Boolean(
                  wellnessQuizSuggestedIdSet.size > 0 &&
                    wellnessQuizTreatmentId &&
                    wellnessQuizSuggestedIdSet.has(wellnessQuizTreatmentId),
                );
                const wellnessQuizMatchReasonLines =
                  client.wellnessQuiz?.answers &&
                  showWellnessQuizTreatmentBadge &&
                  wellnessQuizTreatmentId
                    ? getWellnessQuizMatchReasons(
                        client.wellnessQuiz.answers,
                        wellnessQuizTreatmentId,
                      )
                    : [];
                const wellnessQuizMatchDetailTitle =
                  wellnessQuizMatchReasonLines.length > 0
                    ? wellnessQuizMatchReasonLines.join("\n")
                    : "Suggested by this client's completed wellness quiz";
                const cardPhotos = getPhotosForTreatment(treatment);
                /** Eye: Airtable examples, Wellnest education, or Judge MD gallery (Breast/Body/Vaginal only). */
                const judgeMdGalleryOpts =
                  treatment === "Breast Surgery"
                    ? { breastSurgeryProductLine: judgeMdBreastSurgeryProductHint }
                    : treatment === "Body Sculpting"
                      ? { bodySculptingProductLine: judgeMdBodySculptingProductHint }
                      : undefined;
                const showPhotoExamplesButton =
                  Boolean(wellnestOffering) ||
                  cardPhotos.length > 0 ||
                  (isJudgeMdProviderCode(provider?.code) &&
                    !wellnestOffering &&
                    isJudgeMdPlanBuilderGalleryEyeTreatment(treatment) &&
                    getJudgeMdRecommenderGalleryExhibit(
                      treatment,
                      judgeMdGalleryOpts,
                    ) != null);
                return (
                  <div
                    key={treatment}
                    id={
                      treatment === "Skincare"
                        ? "treatment-recommender-skincare-card"
                        : `treatment-recommender-card-${planOptDomIdSuffix(treatment)}`
                    }
                    ref={(el) => {
                      cardRefsMap.current[treatment] = el;
                    }}
                    className={`treatment-recommender-by-treatment__card${
                      focusedTreatmentHighlight === treatment
                        ? " treatment-recommender-by-treatment__card--focused"
                        : ""
                    }`}
                  >
                    <div className="treatment-recommender-by-treatment__card-top">
                      <div className="treatment-recommender-by-treatment__card-head">
                        <div className="treatment-recommender-by-treatment__card-title-row">
                          <h2 className="treatment-recommender-by-treatment__card-title">
                            {treatment}
                          </h2>
                          {showPhotoExamplesButton ? (
                            <button
                              type="button"
                              className="treatment-recommender-by-treatment__examples-eye-btn"
                              onClick={() => {
                                if (wellnestOffering) {
                                  setWellnestDetailTreatment(treatment);
                                  return;
                                }
                                const region0 =
                                  filterState.region.length > 0
                                    ? getInternalRegionForFilter(
                                        filterState.region[0],
                                      )
                                    : undefined;
                                const ex =
                                  isJudgeMdProviderCode(provider?.code) &&
                                  isJudgeMdPlanBuilderGalleryEyeTreatment(
                                    treatment,
                                  ) &&
                                  getJudgeMdRecommenderGalleryExhibit(
                                    treatment,
                                    judgeMdGalleryOpts,
                                  );
                                setPhotoExplorerContext({
                                  treatment,
                                  region: region0,
                                  judgeMdGallery: ex
                                    ? {
                                        pageUrl: ex.pageUrl,
                                        imageUrls: ex.imageUrls,
                                      }
                                    : undefined,
                                });
                              }}
                              title={
                                wellnestOffering
                                  ? "Overview and examples"
                                  : treatment === "Facial Surgery"
                                    ? "View blepharoplasty before and after examples"
                                    : treatment === "Rhinoplasty"
                                      ? "View rhinoplasty before and after examples"
                                    : "View examples"
                              }
                              aria-label={
                                wellnestOffering
                                  ? "Overview and examples"
                                  : treatment === "Facial Surgery"
                                    ? "View blepharoplasty before and after examples"
                                    : treatment === "Rhinoplasty"
                                      ? "View rhinoplasty before and after examples"
                                    : "View examples"
                              }
                            >
                              <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden
                              >
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            </button>
                          ) : null}
                        </div>
                        <p className="treatment-recommender-by-treatment__card-why">
                          {getWhyExplanation(treatment)}
                        </p>
                      </div>
                    </div>

                    {treatment === "Skincare" && client.skincareQuiz ? (
                      <div className="treatment-recommender-by-treatment__breakdown treatment-recommender-by-treatment__breakdown--skin-quiz">
                        <h3 className="treatment-recommender-by-treatment__breakdown-title">
                          Skin quiz
                        </h3>
                        {client.skincareQuiz.completedAt && (
                          <p className="treatment-recommender-by-treatment__skin-quiz-meta">
                            Quiz completed{" "}
                            <time
                              dateTime={new Date(
                                client.skincareQuiz.completedAt,
                              ).toISOString()}
                            >
                              {new Date(
                                client.skincareQuiz.completedAt,
                              ).toLocaleDateString("en-US", {
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </time>
                          </p>
                        )}
                        {client.skincareQuiz.answers &&
                          Object.keys(client.skincareQuiz.answers).length >
                            0 && (
                            <div className="treatment-recommender-skin-analysis__score-breakdown-block">
                              <div className="treatment-recommender-skin-analysis__score-breakdown-header">
                                <span className="treatment-recommender-skin-analysis__score-bars-title">
                                  Score breakdown
                                </span>
                                <button
                                  type="button"
                                  className="treatment-recommender-skin-analysis__score-breakdown-toggle"
                                  onClick={() =>
                                    setSkincareScoreBreakdownCollapsed(
                                      (c) => !c,
                                    )
                                  }
                                  aria-expanded={
                                    !skincareScoreBreakdownCollapsed
                                  }
                                >
                                  {skincareScoreBreakdownCollapsed
                                    ? "Show"
                                    : "Hide"}
                                </button>
                              </div>
                              {!skincareScoreBreakdownCollapsed &&
                                (() => {
                                  const scores = computeQuizScores(
                                    client.skincareQuiz!.answers,
                                  );
                                  const maxScore = Math.max(
                                    ...Object.values(scores),
                                    1,
                                  );
                                  return (
                                    <div className="treatment-recommender-skin-analysis__score-bars">
                                      {SKIN_TYPE_SCORE_ORDER.map((type) => {
                                        const value = scores[type] ?? 0;
                                        const pct =
                                          maxScore > 0
                                            ? (value / maxScore) * 100
                                            : 0;
                                        return (
                                          <div
                                            key={type}
                                            className="treatment-recommender-skin-analysis__score-row"
                                          >
                                            <span className="treatment-recommender-skin-analysis__score-label">
                                              {SKIN_TYPE_DISPLAY_LABELS[type]}
                                            </span>
                                            <div className="treatment-recommender-skin-analysis__score-bar-wrap">
                                              <div
                                                className="treatment-recommender-skin-analysis__score-bar"
                                                style={{ width: `${pct}%` }}
                                              />
                                            </div>
                                            <span className="treatment-recommender-skin-analysis__score-value">
                                              {value}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}
                            </div>
                          )}
                        <div className="skin-analysis-summary treatment-recommender-by-treatment__skin-quiz-summary">
                          {client.skincareQuiz.result &&
                          GEMSTONE_BY_SKIN_TYPE[
                            client.skincareQuiz
                              .result as keyof typeof GEMSTONE_BY_SKIN_TYPE
                          ] ? (
                            <span className="skin-analysis-summary-gemstone">
                              {
                                GEMSTONE_BY_SKIN_TYPE[
                                  client.skincareQuiz
                                    .result as keyof typeof GEMSTONE_BY_SKIN_TYPE
                                ].name
                              }{" "}
                              {
                                GEMSTONE_BY_SKIN_TYPE[
                                  client.skincareQuiz
                                    .result as keyof typeof GEMSTONE_BY_SKIN_TYPE
                                ].emoji
                              }{" "}
                              {
                                GEMSTONE_BY_SKIN_TYPE[
                                  client.skincareQuiz
                                    .result as keyof typeof GEMSTONE_BY_SKIN_TYPE
                                ].tagline
                              }
                            </span>
                          ) : (
                            <span className="skin-analysis-summary-type">
                              {client.skincareQuiz.resultLabel ??
                                (client.skincareQuiz.result
                                  ? client.skincareQuiz.result
                                      .charAt(0)
                                      .toUpperCase() +
                                    client.skincareQuiz.result.slice(1)
                                  : "Completed")}
                            </span>
                          )}
                        </div>
                        {client.skincareQuiz.resultDescription && (
                          <p className="skin-analysis-result-description">
                            {client.skincareQuiz.resultDescription}
                          </p>
                        )}
                        {quizRoutineRecommendedNameSet.size > 0 && (
                          <div className="treatment-recommender-by-treatment__skin-quiz-rec-summary">
                            <p className="treatment-recommender-by-treatment__skin-quiz-rec-count">
                              {quizRoutineRecommendedNameSet.size} product
                              {quizRoutineRecommendedNameSet.size !== 1
                                ? "s"
                                : ""}{" "}
                              recommended for this client
                            </p>
                            <button
                              type="button"
                              className="treatment-recommender-by-treatment__skin-quiz-browse-btn"
                              onClick={handleOpenSkincareWithRecommendedFilter}
                            >
                              See recommendations
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <FeatureBreakdownSection
                        treatment={treatment}
                        getBreakdownRowsForTreatment={
                          getBreakdownRowsForTreatment
                        }
                        detectedIssues={detectedIssues}
                      />
                    )}

                    {wellnestOffering && (
                      <div className="treatment-recommender-wellnest-card">
                        <div className="treatment-recommender-wellnest-card__chips">
                          {showWellnessQuizTreatmentBadge ? (
                            <span
                              className="treatment-recommender-wellnest-card__chip treatment-recommender-wellnest-card__chip--wellness-quiz"
                              title={wellnessQuizMatchDetailTitle}
                            >
                              Wellness quiz match
                            </span>
                          ) : null}
                          {showWellnestGoalMatchBadge ? (
                            <span
                              className={`treatment-recommender-wellnest-card__chip treatment-recommender-wellnest-card__chip--goal${
                                wellnestGoalSignal &&
                                wellnestGoalSignal.matchedGoals.length >=
                                  wellnessIntakeGoals.length
                                  ? " treatment-recommender-wellnest-card__chip--goal-strong"
                                  : " treatment-recommender-wellnest-card__chip--goal-medium"
                              }`}
                              title="Matched against intake wellness goals"
                            >
                              {wellnestGoalMatchLabel}
                            </span>
                          ) : null}
                          <span className="treatment-recommender-wellnest-card__chip">
                            Visible results: {wellnestOffering.resultsTimeline}
                          </span>
                          <span className="treatment-recommender-wellnest-card__chip">
                            {wellnestOffering.pricing}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="treatment-recommender-by-treatment__card-actions">
                      <div className="treatment-recommender-by-treatment__add-section">
                        {isTreatmentInPlan(treatment) &&
                        addToPlanForTreatment?.treatment !== treatment ? (
                          <div className="treatment-recommender-by-treatment__added-state">
                            <p className="treatment-recommender-by-treatment__added-message">
                              Added to treatment plan
                            </p>
                            {onAddToPlanDirect ? (
                              <button
                                type="button"
                                className="treatment-recommender-by-treatment__add-btn treatment-recommender-by-treatment__add-btn--fit"
                                onClick={() => {
                                  setEditingPlanItemId(null);
                                  setAddToPlanForTreatment(
                                    initialAddToPlanRowForTreatment(
                                      treatment,
                                      wellnestOffering,
                                      wellnestDefaultDeliveryForm,
                                      wellnestDefaultDosing,
                                    ),
                                  );
                                }}
                              >
                                Add to plan
                              </button>
                            ) : null}
                          </div>
                        ) : addToPlanForTreatment?.treatment === treatment ? (
                          <div className="treatment-recommender-by-treatment__add-form">
                            {canEditRecommenderOptions &&
                            provider?.id &&
                            getUnifiedRecommenderEditSections(
                              treatment,
                              Boolean(wellnestOffering),
                              isJudgeMdProviderCode(provider?.code),
                            ).length > 0 ? (
                              <div className="treatment-recommender-by-treatment__add-form-toolbar">
                                <button
                                  type="button"
                                  className="edit-toggle-btn"
                                  onClick={() =>
                                    openUnifiedRecommenderEditor(treatment)
                                  }
                                  title="Edit options and pricing reference"
                                  aria-label="Edit options and pricing reference"
                                >
                                  <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    aria-hidden
                                  >
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                  </svg>
                                </button>
                              </div>
                            ) : null}
                            {treatment === "Skincare" && (
                              <>
                                {/* Recommended-only filter – only shown when quiz data is available */}
                                {quizRoutineRecommendedNameSet.size > 0 ? (
                                  <div className="treatment-recommender-by-treatment__add-row treatment-recommender-by-treatment__skincare-browse-row">
                                    <span className="treatment-recommender-by-treatment__add-row-label">
                                      Filter:
                                    </span>
                                    <div className="treatment-recommender-by-treatment__chips">
                                      <button
                                        type="button"
                                        className={`treatment-recommender-by-treatment__chip${
                                          skincareRecommendedFilter
                                            ? " treatment-recommender-by-treatment__chip--selected"
                                            : ""
                                        }`}
                                        onClick={() =>
                                          setSkincareRecommendedFilter(
                                            (v) => !v,
                                          )
                                        }
                                      >
                                        <span className="treatment-recommender-by-treatment__chip-label">
                                          Quiz recommendations
                                        </span>
                                        {skincareRecommendedFilter ? (
                                          <span
                                            className="treatment-recommender-by-treatment__chip-remove"
                                            aria-hidden
                                          >
                                            ×
                                          </span>
                                        ) : null}
                                      </button>
                                    </div>
                                  </div>
                                ) : null}
                                <div className="treatment-recommender-by-treatment__add-row treatment-recommender-by-treatment__add-row--full treatment-recommender-by-treatment__skincare-search-block">
                                  <label
                                    className="treatment-recommender-by-treatment__skincare-search-label"
                                    htmlFor="treatment-recommender-skincare-product-search"
                                  >
                                    Search products
                                  </label>
                                  <input
                                    id="treatment-recommender-skincare-product-search"
                                    type="search"
                                    className="treatment-recommender-by-treatment__skincare-search-input"
                                    placeholder="Type a product or brand…"
                                    value={skincareProductSearchQuery}
                                    onChange={(e) =>
                                      setSkincareProductSearchQuery(
                                        e.target.value,
                                      )
                                    }
                                    aria-label="Search skincare products by name"
                                  />
                                </div>
                                {skincareSearchMatchesSorted !== null ? (
                                  <div className="treatment-recommender-by-treatment__add-row treatment-recommender-by-treatment__add-row--full">
                                    <h4 className="treatment-recommender-by-treatment__skincare-search-results-heading">
                                      Search results (
                                      {skincareSearchMatchesSorted.length})
                                    </h4>
                                    {skincareSearchMatchesSorted.length ===
                                    0 ? (
                                      <p className="treatment-recommender-by-treatment__skincare-search-empty">
                                        No products match that search. Try a
                                        shorter term or clear the field to
                                        browse by category.
                                      </p>
                                    ) : (
                                      <div
                                        className="treatment-recommender-by-treatment__skincare-product-chip-grid"
                                        role="group"
                                        aria-label="Products matching search"
                                      >
                                        {skincareSearchMatchesSorted.map(
                                          (item) => (
                                            <TreatmentRecommenderSkincareSelectChip
                                              key={item.name}
                                              item={item}
                                              selected={(
                                                addToPlanForTreatment.skincareWhat ??
                                                []
                                              ).includes(item.name)}
                                              isQuizRecommended={quizRoutineRecommendedNameSet.has(
                                                item.name,
                                              )}
                                              onToggle={() =>
                                                setAddToPlanForTreatment(
                                                  (prev) => {
                                                    if (!prev) return null;
                                                    const current =
                                                      prev.skincareWhat ?? [];
                                                    const next =
                                                      current.includes(
                                                        item.name,
                                                      )
                                                        ? current.filter(
                                                            (x) =>
                                                              x !== item.name,
                                                          )
                                                        : [
                                                            ...current,
                                                            item.name,
                                                          ];
                                                    return {
                                                      ...prev,
                                                      skincareWhat: next,
                                                    };
                                                  },
                                                )
                                              }
                                            />
                                          ),
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ) : skincareRoutineBrowseSections != null ? (
                                  <div className="treatment-recommender-by-treatment__add-row treatment-recommender-by-treatment__add-row--full">
                                    <div className="treatment-recommender-by-treatment__skincare-groups">
                                      {skincareRoutineBrowseSections.length ===
                                      0 ? (
                                        <p className="treatment-recommender-by-treatment__skincare-search-empty">
                                          No quiz recommendations match your
                                          current product list.
                                        </p>
                                      ) : (
                                        (() => {
                                          const routineBrowseSelectedNames =
                                            new Set(
                                              addToPlanForTreatment.skincareWhat ??
                                                [],
                                            );
                                          return skincareRoutineBrowseSections.map(
                                            (routineSection) => {
                                              const sortedVisible =
                                                routineSection.items;
                                              const routineKey =
                                                routineSection.key;
                                              const groupLabel =
                                                routineSection.title;
                                              const selectedCount =
                                                sortedVisible.filter((item) =>
                                                  routineBrowseSelectedNames.has(
                                                    item.name,
                                                  ),
                                                ).length;
                                              const isExpanded =
                                                !skincareCollapsedGroups.has(
                                                  routineKey,
                                                );
                                              return (
                                                <div
                                                  key={routineKey}
                                                  className="treatment-recommender-by-treatment__skincare-group"
                                                >
                                                  <button
                                                    type="button"
                                                    className={`treatment-recommender-by-treatment__skincare-group-header${
                                                      isExpanded
                                                        ? " treatment-recommender-by-treatment__skincare-group-header--expanded"
                                                        : ""
                                                    }`}
                                                    onClick={() =>
                                                      setSkincareCollapsedGroups(
                                                        (prev) => {
                                                          const next = new Set(
                                                            prev,
                                                          );
                                                          if (
                                                            next.has(routineKey)
                                                          )
                                                            next.delete(
                                                              routineKey,
                                                            );
                                                          else
                                                            next.add(
                                                              routineKey,
                                                            );
                                                          return next;
                                                        },
                                                      )
                                                    }
                                                    aria-expanded={isExpanded}
                                                  >
                                                    <span className="treatment-recommender-by-treatment__skincare-group-label">
                                                      {groupLabel}
                                                    </span>
                                                    {selectedCount > 0 ? (
                                                      <span className="treatment-recommender-by-treatment__skincare-group-meta">
                                                        <span className="treatment-recommender-by-treatment__skincare-group-selected-badge">
                                                          {selectedCount} added
                                                        </span>
                                                      </span>
                                                    ) : null}
                                                    <svg
                                                      className={`treatment-recommender-by-treatment__skincare-group-chevron${
                                                        isExpanded
                                                          ? " treatment-recommender-by-treatment__skincare-group-chevron--open"
                                                          : ""
                                                      }`}
                                                      width="14"
                                                      height="14"
                                                      viewBox="0 0 24 24"
                                                      fill="none"
                                                      stroke="currentColor"
                                                      strokeWidth="2.5"
                                                      strokeLinecap="round"
                                                      strokeLinejoin="round"
                                                      aria-hidden
                                                    >
                                                      <polyline points="6 9 12 15 18 9" />
                                                    </svg>
                                                  </button>
                                                  {isExpanded ? (
                                                    <div
                                                      className="treatment-recommender-by-treatment__skincare-product-chip-grid"
                                                      role="group"
                                                      aria-label={`${groupLabel} products (multiple selectable)`}
                                                    >
                                                      {sortedVisible.map(
                                                        (item) => (
                                                          <TreatmentRecommenderSkincareSelectChip
                                                            key={item.name}
                                                            item={item}
                                                            selected={routineBrowseSelectedNames.has(
                                                              item.name,
                                                            )}
                                                            isQuizRecommended={quizRoutineRecommendedNameSet.has(
                                                              item.name,
                                                            )}
                                                            onToggle={() =>
                                                              setAddToPlanForTreatment(
                                                                (prev) => {
                                                                  if (!prev)
                                                                    return null;
                                                                  const current =
                                                                    prev.skincareWhat ??
                                                                    [];
                                                                  const next =
                                                                    current.includes(
                                                                      item.name,
                                                                    )
                                                                      ? current.filter(
                                                                          (x) =>
                                                                            x !==
                                                                            item.name,
                                                                        )
                                                                      : [
                                                                          ...current,
                                                                          item.name,
                                                                        ];
                                                                  return {
                                                                    ...prev,
                                                                    skincareWhat:
                                                                      next,
                                                                  };
                                                                },
                                                              )
                                                            }
                                                          />
                                                        ),
                                                      )}
                                                    </div>
                                                  ) : null}
                                                </div>
                                              );
                                            },
                                          );
                                        })()
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="treatment-recommender-by-treatment__add-row treatment-recommender-by-treatment__add-row--full">
                                    <div className="treatment-recommender-by-treatment__skincare-groups">
                                      {SKINCARE_CATEGORY_OPTIONS.map(
                                        (cat, catIdx) => {
                                          const groupLabel =
                                            SKINCARE_USE_CASE_LABELS[catIdx] ??
                                            cat.label;
                                          const productSet = new Set(
                                            cat.products,
                                          );
                                          const groupItems =
                                            skincareProductPoolForBrowse.filter(
                                              (item) =>
                                                productSet.has(item.name),
                                            );
                                          const selectedNames = new Set(
                                            addToPlanForTreatment.skincareWhat ??
                                              [],
                                          );
                                          const visibleItems =
                                            skincareRecommendedFilter
                                              ? groupItems.filter(
                                                  (item) =>
                                                    quizRoutineRecommendedNameSet.has(
                                                      item.name,
                                                    ) ||
                                                    selectedNames.has(
                                                      item.name,
                                                    ),
                                                )
                                              : groupItems;
                                          if (visibleItems.length === 0)
                                            return null;
                                          const selectedCount =
                                            groupItems.filter((item) =>
                                              selectedNames.has(item.name),
                                            ).length;
                                          const isExpanded =
                                            !skincareCollapsedGroups.has(
                                              cat.label,
                                            );
                                          const recommendedOrder =
                                            client.skincareQuiz
                                              ?.recommendedProductNames ?? [];
                                          const sortedVisible = [
                                            ...visibleItems,
                                          ].sort((a, b) => {
                                            const aRec =
                                              quizRoutineRecommendedNameSet.has(
                                                a.name,
                                              );
                                            const bRec =
                                              quizRoutineRecommendedNameSet.has(
                                                b.name,
                                              );
                                            if (aRec && !bRec) return -1;
                                            if (!aRec && bRec) return 1;
                                            if (aRec && bRec) {
                                              const ia =
                                                recommendedOrder.indexOf(
                                                  a.name,
                                                );
                                              const ib =
                                                recommendedOrder.indexOf(
                                                  b.name,
                                                );
                                              const ra = ia >= 0 ? ia : 9999;
                                              const rb = ib >= 0 ? ib : 9999;
                                              if (ra !== rb) return ra - rb;
                                            }
                                            return a.name.localeCompare(b.name);
                                          });
                                          return (
                                            <div
                                              key={cat.label}
                                              className="treatment-recommender-by-treatment__skincare-group"
                                            >
                                              <button
                                                type="button"
                                                className={`treatment-recommender-by-treatment__skincare-group-header${
                                                  isExpanded
                                                    ? " treatment-recommender-by-treatment__skincare-group-header--expanded"
                                                    : ""
                                                }`}
                                                onClick={() =>
                                                  setSkincareCollapsedGroups(
                                                    (prev) => {
                                                      const next = new Set(
                                                        prev,
                                                      );
                                                      if (next.has(cat.label))
                                                        next.delete(cat.label);
                                                      else next.add(cat.label);
                                                      return next;
                                                    },
                                                  )
                                                }
                                                aria-expanded={isExpanded}
                                              >
                                                <span className="treatment-recommender-by-treatment__skincare-group-label">
                                                  {groupLabel}
                                                </span>
                                                {selectedCount > 0 ? (
                                                  <span className="treatment-recommender-by-treatment__skincare-group-meta">
                                                    <span className="treatment-recommender-by-treatment__skincare-group-selected-badge">
                                                      {selectedCount} added
                                                    </span>
                                                  </span>
                                                ) : null}
                                                <svg
                                                  className={`treatment-recommender-by-treatment__skincare-group-chevron${
                                                    isExpanded
                                                      ? " treatment-recommender-by-treatment__skincare-group-chevron--open"
                                                      : ""
                                                  }`}
                                                  width="14"
                                                  height="14"
                                                  viewBox="0 0 24 24"
                                                  fill="none"
                                                  stroke="currentColor"
                                                  strokeWidth="2.5"
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                  aria-hidden
                                                >
                                                  <polyline points="6 9 12 15 18 9" />
                                                </svg>
                                              </button>
                                              {isExpanded ? (
                                                <div
                                                  className="treatment-recommender-by-treatment__skincare-product-chip-grid"
                                                  role="group"
                                                  aria-label={`${groupLabel} products (multiple selectable)`}
                                                >
                                                  {sortedVisible.map((item) => (
                                                    <TreatmentRecommenderSkincareSelectChip
                                                      key={item.name}
                                                      item={item}
                                                      selected={selectedNames.has(
                                                        item.name,
                                                      )}
                                                      isQuizRecommended={quizRoutineRecommendedNameSet.has(
                                                        item.name,
                                                      )}
                                                      onToggle={() =>
                                                        setAddToPlanForTreatment(
                                                          (prev) => {
                                                            if (!prev)
                                                              return null;
                                                            const current =
                                                              prev.skincareWhat ??
                                                              [];
                                                            const next =
                                                              current.includes(
                                                                item.name,
                                                              )
                                                                ? current.filter(
                                                                    (x) =>
                                                                      x !==
                                                                      item.name,
                                                                  )
                                                                : [
                                                                    ...current,
                                                                    item.name,
                                                                  ];
                                                            return {
                                                              ...prev,
                                                              skincareWhat:
                                                                next,
                                                            };
                                                          },
                                                        )
                                                      }
                                                    />
                                                  ))}
                                                </div>
                                              ) : null}
                                            </div>
                                          );
                                        },
                                      )}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                            {treatment === "Skincare" &&
                            addPlanDraftPricing.placement === "generic" &&
                            addPlanDraftPricing.message ? (
                              <AddPlanFieldPricingHint
                                message={addPlanDraftPricing.message}
                              />
                            ) : null}
                            {treatment !== "Skincare" &&
                              !wellnestOffering &&
                              !usesOtherProceduresStructuredPlan(treatment) && (
                              <>
                              {isEnergyTreatmentCategory(treatment) && (
                                <div className="treatment-recommender-by-treatment__add-row">
                                  <span className="treatment-recommender-by-treatment__add-row-label">
                                    Where:
                                  </span>
                                  <div className="treatment-recommender-by-treatment__chips">
                                    {laserWhereDisplayRecords.map(
                                      (rec, whereIdx) => {
                                        const r = rec.value;
                                        const whereSelected =
                                          addToPlanForTreatment.where.includes(
                                            r,
                                          );
                                        const recordId = rec.id || null;
                                        return (
                                          <button
                                            key={
                                              recordId
                                                ? String(recordId)
                                                : `energy-where-${whereIdx}-${r}`
                                            }
                                            type="button"
                                            className={`treatment-recommender-by-treatment__chip ${
                                              whereSelected
                                                ? "treatment-recommender-by-treatment__chip--selected"
                                                : ""
                                            }`}
                                            onClick={() => {
                                              setAddToPlanForTreatment(
                                                (prev) =>
                                                  prev
                                                    ? {
                                                        ...prev,
                                                        where:
                                                          prev.where.includes(r)
                                                            ? prev.where.filter(
                                                                (x) => x !== r,
                                                              )
                                                            : [
                                                                ...prev.where,
                                                                r,
                                                              ],
                                                      }
                                                    : null,
                                              );
                                            }}
                                            title={
                                              whereSelected
                                                ? `Remove ${r}`
                                                : `Add ${r}`
                                            }
                                            aria-label={
                                              whereSelected
                                                ? `Remove ${r}`
                                                : `Add ${r}`
                                            }
                                          >
                                            <span className="treatment-recommender-by-treatment__chip-label">
                                              {r}
                                            </span>
                                            {whereSelected && (
                                              <span
                                                className="treatment-recommender-by-treatment__chip-remove"
                                                aria-hidden
                                              >
                                                ×
                                              </span>
                                            )}
                                          </button>
                                        );
                                      },
                                    )}
                                  </div>
                                </div>
                              )}
                              <div className="treatment-recommender-by-treatment__add-row">
                                <span className="treatment-recommender-by-treatment__add-row-label">
                                  {isEnergyTreatmentCategory(treatment)
                                    ? "Type:"
                                    : "Where:"}
                                </span>
                                <div className="treatment-recommender-by-treatment__chips">
                                  {isEnergyTreatmentCategory(treatment)
                                    ? laserWhatDisplayRecords.map(
                                        (rec, laserIdx) => {
                                          const opt = rec.value;
                                          const selected = (
                                            addToPlanForTreatment.laserWhat ??
                                            []
                                          ).includes(opt);
                                          const recordId = rec.id || null;
                                          return (
                                            <button
                                              key={
                                                recordId
                                                  ? String(recordId)
                                                  : `laser-${laserIdx}-${opt}`
                                              }
                                              type="button"
                                              className={`treatment-recommender-by-treatment__chip ${
                                                selected
                                                  ? "treatment-recommender-by-treatment__chip--selected"
                                                  : ""
                                              }`}
                                              onClick={() =>
                                                setAddToPlanForTreatment(
                                                  (prev) => {
                                                    if (!prev) return null;
                                                    const current =
                                                      prev.laserWhat ?? [];
                                                    const next =
                                                      current.includes(opt)
                                                        ? current.filter(
                                                            (x) => x !== opt,
                                                          )
                                                        : [...current, opt];
                                                    return {
                                                      ...prev,
                                                      laserWhat: next,
                                                    };
                                                  },
                                                )
                                              }
                                              title={
                                                selected
                                                  ? `Remove ${opt}`
                                                  : `Add ${opt}`
                                              }
                                              aria-label={
                                                selected
                                                  ? `Remove ${opt}`
                                                  : `Add ${opt}`
                                              }
                                            >
                                              <span className="treatment-recommender-by-treatment__chip-label">
                                                {opt}
                                              </span>
                                              {selected && (
                                                <span
                                                  className="treatment-recommender-by-treatment__chip-remove"
                                                  aria-hidden
                                                >
                                                  ×
                                                </span>
                                              )}
                                            </button>
                                          );
                                        },
                                      )
                                    : (treatment === "Microneedling"
                                        ? microneedlingWhereDisplayRecords
                                        : treatment === "Chemical Peel"
                                          ? chemicalPeelWhereDisplayRecords
                                          : genericWhereDisplayRecords
                                      ).map((rec, whereIdx) => {
                                        const r = rec.value;
                                        const whereSelected =
                                          addToPlanForTreatment.where.includes(
                                            r,
                                          );
                                        const recordId = rec.id || null;
                                        return (
                                          <button
                                            key={
                                              recordId
                                                ? String(recordId)
                                                : `where-${whereIdx}-${r}`
                                            }
                                            type="button"
                                            className={`treatment-recommender-by-treatment__chip ${
                                              whereSelected
                                                ? "treatment-recommender-by-treatment__chip--selected"
                                                : ""
                                            }`}
                                            onClick={() => {
                                              setAddToPlanForTreatment(
                                                (prev) =>
                                                  prev
                                                    ? {
                                                        ...prev,
                                                        where:
                                                          prev.where.includes(r)
                                                            ? prev.where.filter(
                                                                (x) => x !== r,
                                                              )
                                                            : [
                                                                ...prev.where,
                                                                r,
                                                              ],
                                                      }
                                                    : null,
                                              );
                                            }}
                                            title={
                                              whereSelected
                                                ? `Remove ${r}`
                                                : `Add ${r}`
                                            }
                                            aria-label={
                                              whereSelected
                                                ? `Remove ${r}`
                                                : `Add ${r}`
                                            }
                                          >
                                            <span className="treatment-recommender-by-treatment__chip-label">
                                              {r}
                                            </span>
                                            {whereSelected && (
                                              <span
                                                className="treatment-recommender-by-treatment__chip-remove"
                                                aria-hidden
                                              >
                                                ×
                                              </span>
                                            )}
                                          </button>
                                        );
                                      })}
                                  {/* Custom (user-typed) options; click chip to remove */}
                                  {treatment === "Skincare" &&
                                    (addToPlanForTreatment.skincareWhat ?? [])
                                      .filter(
                                        (s) => !skincareWhatOptions.includes(s),
                                      )
                                      .map((customVal, customIdx) => (
                                        <button
                                          key={`skincare-custom-${customIdx}-${customVal}`}
                                          type="button"
                                          className="treatment-recommender-by-treatment__chip treatment-recommender-by-treatment__chip--selected"
                                          onClick={() =>
                                            setAddToPlanForTreatment((prev) =>
                                              prev
                                                ? {
                                                    ...prev,
                                                    skincareWhat: (
                                                      prev.skincareWhat ?? []
                                                    ).filter(
                                                      (x) => x !== customVal,
                                                    ),
                                                  }
                                                : null,
                                            )
                                          }
                                          title={`Remove ${customVal}`}
                                          aria-label={`Remove ${customVal}`}
                                        >
                                          <span className="treatment-recommender-by-treatment__chip-label">
                                            {customVal}
                                          </span>
                                          <span
                                            className="treatment-recommender-by-treatment__chip-remove"
                                            aria-hidden
                                          >
                                            ×
                                          </span>
                                        </button>
                                      ))}
                                  {isEnergyTreatmentCategory(treatment) &&
                                    (addToPlanForTreatment.laserWhat ?? [])
                                      .filter(
                                        (l) =>
                                          !laserWhatDisplayRecords.some(
                                            (r) => r.value === l,
                                          ),
                                      )
                                      .map((customVal, laserCustomIdx) => (
                                        <button
                                          key={`laser-custom-${laserCustomIdx}-${customVal}`}
                                          type="button"
                                          className="treatment-recommender-by-treatment__chip treatment-recommender-by-treatment__chip--selected"
                                          onClick={() =>
                                            setAddToPlanForTreatment((prev) =>
                                              prev
                                                ? {
                                                    ...prev,
                                                    laserWhat: (
                                                      prev.laserWhat ?? []
                                                    ).filter(
                                                      (x) => x !== customVal,
                                                    ),
                                                  }
                                                : null,
                                            )
                                          }
                                          title={`Remove ${customVal}`}
                                          aria-label={`Remove ${customVal}`}
                                        >
                                          <span className="treatment-recommender-by-treatment__chip-label">
                                            {customVal}
                                          </span>
                                          <span
                                            className="treatment-recommender-by-treatment__chip-remove"
                                            aria-hidden
                                          >
                                            ×
                                          </span>
                                        </button>
                                      ))}
                                  {treatment !== "Skincare" &&
                                    !usesOtherProceduresStructuredPlan(treatment) &&
                                    addToPlanForTreatment.where
                                      .filter((w) =>
                                        isEnergyTreatmentCategory(treatment)
                                          ? !laserWhereDisplayRecords.some(
                                              (r) => r.value === w,
                                            )
                                          : treatment === "Microneedling"
                                          ? !microneedlingWhereDisplayRecords.some(
                                              (r) => r.value === w,
                                            )
                                          : treatment === "Chemical Peel"
                                            ? !chemicalPeelWhereDisplayRecords.some(
                                                (r) => r.value === w,
                                              )
                                            : !whereOptions.includes(w),
                                      )
                                      .map((customVal, whereCustomIdx) => (
                                        <button
                                          key={`where-custom-${whereCustomIdx}-${customVal}`}
                                          type="button"
                                          className="treatment-recommender-by-treatment__chip treatment-recommender-by-treatment__chip--selected"
                                          onClick={() =>
                                            setAddToPlanForTreatment((prev) =>
                                              prev
                                                ? {
                                                    ...prev,
                                                    where: prev.where.filter(
                                                      (x) => x !== customVal,
                                                    ),
                                                  }
                                                : null,
                                            )
                                          }
                                          title={`Remove ${customVal}`}
                                          aria-label={`Remove ${customVal}`}
                                        >
                                          <span className="treatment-recommender-by-treatment__chip-label">
                                            {customVal}
                                          </span>
                                          <span
                                            className="treatment-recommender-by-treatment__chip-remove"
                                            aria-hidden
                                          >
                                            ×
                                          </span>
                                        </button>
                                      ))}
                                </div>
                              </div>
                              </>
                            )}
                            {treatment === "Biostimulants" && (
                              <div className="treatment-recommender-by-treatment__add-row">
                                <span className="treatment-recommender-by-treatment__add-row-label">
                                  Product:
                                </span>
                                <div className="treatment-recommender-by-treatment__chips">
                                  {biostimulantDisplayRecords.map(
                                    (rec, bioIdx) => {
                                      const opt = rec.value;
                                      const selected = (
                                        addToPlanForTreatment.biostimulantWhat ??
                                        []
                                      ).includes(opt);
                                      const recordId = rec.id || null;
                                      return (
                                        <button
                                          key={
                                            recordId
                                              ? String(recordId)
                                              : `bio-${bioIdx}-${opt}`
                                          }
                                          type="button"
                                          className={`treatment-recommender-by-treatment__chip ${
                                            selected
                                              ? "treatment-recommender-by-treatment__chip--selected"
                                              : ""
                                          }`}
                                          onClick={() =>
                                            setAddToPlanForTreatment((prev) => {
                                              if (!prev) return null;
                                              const current =
                                                prev.biostimulantWhat ?? [];
                                              const next = current.includes(opt)
                                                ? current.filter(
                                                    (x) => x !== opt,
                                                  )
                                                : [...current, opt];
                                              return {
                                                ...prev,
                                                biostimulantWhat: next,
                                              };
                                            })
                                          }
                                          title={
                                            selected
                                              ? `Remove ${opt}`
                                              : `Add ${opt}`
                                          }
                                          aria-label={
                                            selected
                                              ? `Remove ${opt}`
                                              : `Add ${opt}`
                                          }
                                        >
                                          <span className="treatment-recommender-by-treatment__chip-label">
                                            {stripOptionalRecommenderPriceFromLabel(
                                              opt,
                                            )}
                                          </span>
                                          {selected && (
                                            <span
                                              className="treatment-recommender-by-treatment__chip-remove"
                                              aria-hidden
                                            >
                                              ×
                                            </span>
                                          )}
                                        </button>
                                      );
                                    },
                                  )}
                                </div>
                              </div>
                            )}
                            {treatment === "Biostimulants" &&
                            addPlanDraftPricing.placement === "biostim_product" &&
                            addPlanDraftPricing.message ? (
                              <AddPlanFieldPricingHint
                                message={addPlanDraftPricing.message}
                              />
                            ) : null}
                            {treatment === "Microneedling" && (
                              <div className="treatment-recommender-by-treatment__add-row">
                                <span className="treatment-recommender-by-treatment__add-row-label">
                                  Type:
                                </span>
                                <div className="treatment-recommender-by-treatment__chips">
                                  {microneedlingTypeDisplayRecords.map(
                                    (rec, mnIdx) => {
                                      const opt = rec.value;
                                      const selected = (
                                        addToPlanForTreatment.microneedlingType ??
                                        []
                                      ).includes(opt);
                                      const recordId = rec.id || null;
                                      return (
                                        <button
                                          key={
                                            recordId
                                              ? String(recordId)
                                              : `mn-type-${mnIdx}-${opt}`
                                          }
                                          type="button"
                                          className={`treatment-recommender-by-treatment__chip ${
                                            selected
                                              ? "treatment-recommender-by-treatment__chip--selected"
                                              : ""
                                          }`}
                                          onClick={() =>
                                            setAddToPlanForTreatment((prev) => {
                                              if (!prev) return null;
                                              const current =
                                                prev.microneedlingType ?? [];
                                              const next = current.includes(opt)
                                                ? current.filter(
                                                    (x) => x !== opt,
                                                  )
                                                : [...current, opt];
                                              return {
                                                ...prev,
                                                microneedlingType: next,
                                              };
                                            })
                                          }
                                          title={
                                            selected
                                              ? `Remove ${opt}`
                                              : `Add ${opt}`
                                          }
                                          aria-label={
                                            selected
                                              ? `Remove ${opt}`
                                              : `Add ${opt}`
                                          }
                                        >
                                          <span className="treatment-recommender-by-treatment__chip-label">
                                            {opt}
                                          </span>
                                          {selected && (
                                            <span
                                              className="treatment-recommender-by-treatment__chip-remove"
                                              aria-hidden
                                            >
                                              ×
                                            </span>
                                          )}
                                        </button>
                                      );
                                    },
                                  )}
                                </div>
                              </div>
                            )}
                            {treatment === "Facial Services" && (
                              <div className="treatment-recommender-by-treatment__add-row">
                                <span className="treatment-recommender-by-treatment__add-row-label">
                                  Type:
                                </span>
                                <div className="treatment-recommender-by-treatment__chips">
                                  {facialServiceWhatDisplayRecords.map(
                                    (rec, fsIdx) => {
                                      const opt = rec.value;
                                      const selected = (
                                        addToPlanForTreatment.facialServiceWhat ??
                                        []
                                      ).includes(opt);
                                      const recordId = rec.id || null;
                                      return (
                                        <button
                                          key={
                                            recordId
                                              ? String(recordId)
                                              : `facial-type-${fsIdx}-${opt}`
                                          }
                                          type="button"
                                          className={`treatment-recommender-by-treatment__chip ${
                                            selected
                                              ? "treatment-recommender-by-treatment__chip--selected"
                                              : ""
                                          }`}
                                          onClick={() =>
                                            setAddToPlanForTreatment((prev) => {
                                              if (!prev) return null;
                                              const current =
                                                prev.facialServiceWhat ?? [];
                                              const next = current.includes(opt)
                                                ? current.filter(
                                                    (x) => x !== opt,
                                                  )
                                                : [...current, opt];
                                              return {
                                                ...prev,
                                                facialServiceWhat: next,
                                              };
                                            })
                                          }
                                          title={
                                            selected
                                              ? `Remove ${opt}`
                                              : `Add ${opt}`
                                          }
                                          aria-label={
                                            selected
                                              ? `Remove ${opt}`
                                              : `Add ${opt}`
                                          }
                                        >
                                          <span className="treatment-recommender-by-treatment__chip-label">
                                            {stripOptionalRecommenderPriceFromLabel(
                                              opt,
                                            )}
                                          </span>
                                          {selected && (
                                            <span
                                              className="treatment-recommender-by-treatment__chip-remove"
                                              aria-hidden
                                            >
                                              ×
                                            </span>
                                          )}
                                        </button>
                                      );
                                    },
                                  )}
                                </div>
                              </div>
                            )}
                            {(treatment === "Filler" ||
                              treatment === "Neurotoxin" ||
                              treatment === "Chemical Peel" ||
                              treatment === "Other procedures" ||
                              usesJudgeMdSurgeryStructuredPlan(treatment)) && (
                              <div className="treatment-recommender-by-treatment__add-row">
                                <span className="treatment-recommender-by-treatment__add-row-label">
                                  Type:
                                </span>
                                <div className="treatment-recommender-by-treatment__chips">
                                  {(treatment === "Filler"
                                    ? fillerTypeDisplayRecords
                                    : treatment === "Neurotoxin"
                                      ? neurotoxinTypeDisplayRecords
                                      : treatment === "Chemical Peel"
                                        ? chemicalPeelTypeDisplayRecords
                                        : otherProcedureDisplayRecords
                                  ).map((rec, prodIdx) => {
                                    if (!("value" in rec)) return rec;
                                    const opt = rec.value;
                                    const otherProcOpts =
                                      usesOtherProceduresMultiSelectProduct(treatment)
                                        ? otherProcedureDisplayRecords.map(
                                            (r) => r.value,
                                          )
                                        : [];
                                    const selected =
                                      usesOtherProceduresMultiSelectProduct(treatment)
                                        ? matchProductTokensToOptionList(
                                            addToPlanForTreatment.product ?? "",
                                            otherProcOpts,
                                          ).matched.includes(opt)
                                        : (addToPlanForTreatment.product ?? "") ===
                                          opt;
                                    const recordId = rec.id || null;
                                    return (
                                      <button
                                        key={
                                          recordId
                                            ? String(recordId)
                                            : `prod-${prodIdx}-${opt}`
                                        }
                                        type="button"
                                        className={`treatment-recommender-by-treatment__chip ${
                                          selected
                                            ? "treatment-recommender-by-treatment__chip--selected"
                                            : ""
                                        }`}
                                        onClick={() =>
                                          setAddToPlanForTreatment((prev) => {
                                            if (!prev) return null;
                                            if (!usesOtherProceduresMultiSelectProduct(treatment)) {
                                              const nextProduct = selected
                                                ? ""
                                                : opt;
                                              return {
                                                ...prev,
                                                product: nextProduct,
                                              };
                                            }
                                            const opts =
                                              otherProcedureDisplayRecords.map(
                                                (r) => r.value,
                                              );
                                            const { matched: m0 } =
                                              matchProductTokensToOptionList(
                                                prev.product ?? "",
                                                opts,
                                              );
                                            const wasSel = m0.includes(opt);
                                            const nextMatched = wasSel
                                              ? m0.filter((x) => x !== opt)
                                              : [...m0, opt];
                                            let nextWhere = prev.where;
                                            if (wasSel) {
                                              const stillFacialPrfm =
                                                nextMatched.some(
                                                  (x) =>
                                                    x.trim().toLowerCase() ===
                                                    "prfm injections",
                                                );
                                              if (!stillFacialPrfm) nextWhere = [];
                                            } else {
                                              const addingFacialPrfm =
                                                opt.trim().toLowerCase() ===
                                                "prfm injections";
                                              const hadFacialPrfm = m0.some(
                                                (x) =>
                                                  x.trim().toLowerCase() ===
                                                  "prfm injections",
                                              );
                                              if (addingFacialPrfm && !hadFacialPrfm) {
                                                nextWhere = [];
                                              }
                                            }
                                            return {
                                              ...prev,
                                              product: nextMatched.join(", "),
                                              where: nextWhere,
                                            };
                                          })
                                        }
                                        title={
                                          selected
                                            ? `Remove ${opt}`
                                            : `Select ${opt}`
                                        }
                                        aria-label={
                                          selected
                                            ? `Remove ${opt}`
                                            : `Select ${opt}`
                                        }
                                      >
                                        <span className="treatment-recommender-by-treatment__chip-label">
                                          {stripOptionalRecommenderPriceFromLabel(
                                            opt,
                                          )}
                                        </span>
                                        {selected && (
                                          <span
                                            className="treatment-recommender-by-treatment__chip-remove"
                                            aria-hidden
                                          >
                                            ×
                                          </span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            {treatment === "Other procedures" &&
                              matchProductTokensToOptionList(
                                addToPlanForTreatment.product ?? "",
                                otherProcedureDisplayRecords.map((r) => r.value),
                              ).matched.some(
                                (m) =>
                                  m.trim().toLowerCase() === "prfm injections",
                              ) && (
                                <div className="treatment-recommender-by-treatment__add-row">
                                  <span className="treatment-recommender-by-treatment__add-row-label">
                                    Where:
                                  </span>
                                  <div className="treatment-recommender-by-treatment__chips">
                                    {prfmInjectionWhereDisplayRecords.map(
                                      (rec, prfmWIdx) => {
                                        const r = rec.value;
                                        const whereSelected =
                                          addToPlanForTreatment.where.includes(r);
                                        return (
                                          <button
                                            key={`prfm-where-${prfmWIdx}-${r}`}
                                            type="button"
                                            className={`treatment-recommender-by-treatment__chip ${
                                              whereSelected
                                                ? "treatment-recommender-by-treatment__chip--selected"
                                                : ""
                                            }`}
                                            onClick={() => {
                                              setAddToPlanForTreatment((prev) =>
                                                prev
                                                  ? {
                                                      ...prev,
                                                      where: whereSelected
                                                        ? []
                                                        : [r],
                                                    }
                                                  : null,
                                              );
                                            }}
                                            title={
                                              whereSelected
                                                ? `Remove ${r}`
                                                : `Select ${r}`
                                            }
                                            aria-label={
                                              whereSelected
                                                ? `Remove ${r}`
                                                : `Select ${r}`
                                            }
                                          >
                                            <span className="treatment-recommender-by-treatment__chip-label">
                                              {r}
                                            </span>
                                            {whereSelected && (
                                              <span
                                                className="treatment-recommender-by-treatment__chip-remove"
                                                aria-hidden
                                              >
                                                ×
                                              </span>
                                            )}
                                          </button>
                                        );
                                      },
                                    )}
                                  </div>
                                </div>
                              )}
                            {(treatment === "Filler" ||
                              treatment === "Neurotoxin" ||
                              treatment === "Chemical Peel" ||
                              treatment === "Other procedures" ||
                              usesJudgeMdSurgeryStructuredPlan(treatment)) &&
                            addPlanDraftPricing.placement === "injectable_type" &&
                            addPlanDraftPricing.message ? (
                              <AddPlanFieldPricingHint
                                message={addPlanDraftPricing.message}
                              />
                            ) : null}
                            {judgemdSkincareAddOnPool.length > 0 && (
                              <div className="treatment-recommender-by-treatment__add-row treatment-recommender-by-treatment__add-row--skincare-addons">
                                <span className="treatment-recommender-by-treatment__add-row-label">
                                  Skincare add-ons:
                                </span>
                                <div className="treatment-recommender-by-treatment__chips">
                                  {judgemdSkincareAddOnPool.map((item) => {
                                    const selected = (addToPlanForTreatment.skincareAddOns ?? []).includes(item.name);
                                    return (
                                      <button
                                        key={item.name}
                                        type="button"
                                        className={`treatment-recommender-by-treatment__chip${selected ? " treatment-recommender-by-treatment__chip--selected" : ""}`}
                                        title={selected ? `Remove ${item.name}` : `Add ${item.name}`}
                                        aria-label={selected ? `Remove ${item.name}` : `Add ${item.name}`}
                                        onClick={() =>
                                          setAddToPlanForTreatment((prev) => {
                                            if (!prev) return null;
                                            const current = prev.skincareAddOns ?? [];
                                            return {
                                              ...prev,
                                              skincareAddOns: selected
                                                ? current.filter((n) => n !== item.name)
                                                : [...current, item.name],
                                            };
                                          })
                                        }
                                      >
                                        <span className="treatment-recommender-by-treatment__chip-label">
                                          {item.name.replace(/\s*\|.*$/, "")}
                                        </span>
                                        {selected && (
                                          <span className="treatment-recommender-by-treatment__chip-remove" aria-hidden>×</span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            <div className="treatment-recommender-by-treatment__add-row treatment-recommender-by-treatment__add-row--when-with-date">
                              <span className="treatment-recommender-by-treatment__add-row-label">
                                When:
                              </span>
                              <div className="treatment-recommender-by-treatment__chips">
                                {(() => {
                                  const wishlistTargetDateLabel =
                                    formatPlanScheduledDateLabel(
                                      addToPlanForTreatment.scheduledDate,
                                    );
                                  return timelineDisplayRecords
                                    .filter((rec) => rec.value !== "Completed")
                                    .map((rec) => {
                                      const t = rec.value;
                                      const chipOn =
                                        !addToPlanForTreatment.scheduledDate &&
                                        addToPlanForTreatment.when === t;
                                      const chipKey = rec.id
                                        ? `${rec.id}-${t}`
                                        : `when-${t}`;
                                      return (
                                        <Fragment key={chipKey}>
                                          <button
                                            type="button"
                                            className={`treatment-recommender-by-treatment__chip ${
                                              chipOn
                                                ? "treatment-recommender-by-treatment__chip--selected"
                                                : ""
                                            }`}
                                            onClick={() =>
                                              setAddToPlanForTreatment((prev) =>
                                                prev
                                                  ? {
                                                      ...prev,
                                                      when: t,
                                                      scheduledDate: undefined,
                                                    }
                                                  : null,
                                              )
                                            }
                                          >
                                            {timelineOptionDisplayLabel(t)}
                                          </button>
                                          {t === "Wishlist" ? (
                                            <span
                                              ref={targetTreatmentDatePanelRef}
                                              className="treatment-recommender-by-treatment__when-cal-slot"
                                            >
                                              <button
                                                type="button"
                                                className={`treatment-recommender-by-treatment__when-cal-icon-btn${
                                                  addToPlanForTreatment.scheduledDate
                                                    ? " treatment-recommender-by-treatment__when-cal-icon-btn--active"
                                                    : ""
                                                }`}
                                                title={
                                                  wishlistTargetDateLabel
                                                    ? wishlistTargetDateLabel
                                                    : "Target treatment date"
                                                }
                                                aria-label={
                                                  wishlistTargetDateLabel
                                                    ? `Scheduled ${wishlistTargetDateLabel}. Open target date panel.`
                                                    : "Choose target treatment date"
                                                }
                                                aria-expanded={
                                                  targetTreatmentDatePanelOpen
                                                }
                                                aria-haspopup="dialog"
                                                onClick={() =>
                                                  setTargetTreatmentDatePanelOpen(
                                                    (o) => !o,
                                                  )
                                                }
                                              >
                                                <svg
                                                  width="16"
                                                  height="16"
                                                  viewBox="0 0 24 24"
                                                  fill="none"
                                                  stroke="currentColor"
                                                  strokeWidth="2"
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                  aria-hidden
                                                >
                                                  <rect
                                                    x="3"
                                                    y="4"
                                                    width="18"
                                                    height="18"
                                                    rx="2"
                                                    ry="2"
                                                  />
                                                  <path d="M16 2v4" />
                                                  <path d="M8 2v4" />
                                                  <path d="M3 10h18" />
                                                </svg>
                                              </button>
                                              {wishlistTargetDateLabel ? (
                                                <span
                                                  className="treatment-recommender-by-treatment__when-cal-date-label"
                                                  aria-hidden
                                                >
                                                  {wishlistTargetDateLabel}
                                                </span>
                                              ) : null}
                                            </span>
                                          ) : null}
                                        </Fragment>
                                      );
                                    });
                                })()}
                              </div>
                            </div>
                            {addToPlanForTreatment.treatment !== "Skincare" &&
                              shouldShowProminentPlanQuantity(
                                addToPlanForTreatment.treatment,
                                treatmentProductHintForQuantity(
                                  addToPlanForTreatment,
                                ),
                              ) &&
                              (() => {
                                const qtyHint =
                                  treatmentProductHintForQuantity(
                                    addToPlanForTreatment,
                                  );
                                const qtyCtx = getQuantityContext(
                                  addToPlanForTreatment.treatment,
                                  qtyHint,
                                  provider?.code,
                                );
                                const renderIntervalSelector = (
                                  sessionsRaw: string | undefined,
                                ) =>
                                  shouldStoreTreatmentInterval(
                                    qtyCtx,
                                    sessionsRaw,
                                  ) ? (
                                    <label className="treatment-recommender-by-treatment__details-label treatment-recommender-by-treatment__pricing-qty">
                                      <span className="treatment-recommender-by-treatment__pricing-qty-label">
                                        Interval
                                      </span>
                                      <select
                                        className="treatment-recommender-by-treatment__details-input"
                                        value={
                                          addToPlanForTreatment.treatmentInterval ||
                                          qtyCtx.intervalOptions?.[0] ||
                                          ""
                                        }
                                        onChange={(e) =>
                                          setAddToPlanForTreatment((prev) =>
                                            prev
                                              ? {
                                                  ...prev,
                                                  treatmentInterval:
                                                    e.target.value,
                                                }
                                              : null,
                                          )
                                        }
                                      >
                                        {(qtyCtx.intervalOptions ?? []).map(
                                          (option) => (
                                            <option
                                              key={option}
                                              value={option}
                                            >
                                              {option}
                                            </option>
                                          ),
                                        )}
                                      </select>
                                    </label>
                                  ) : null;
                                return (
                                  <>
                                    {qtyCtx.sculptraSessions ? (
                                      <>
                                        <label className="treatment-recommender-by-treatment__details-label treatment-recommender-by-treatment__pricing-qty">
                                          <span className="treatment-recommender-by-treatment__pricing-qty-label">
                                            {qtyCtx.unitLabel}
                                          </span>
                                          <PlanQuantityStepperInput
                                            unitLabel={qtyCtx.unitLabel}
                                            quantity={
                                              addToPlanForTreatment.quantity ?? ""
                                            }
                                            options={qtyCtx.options}
                                            defaultQuantity={qtyCtx.defaultQuantity}
                                            inputId={`plan-qty-vials-${treatment}`}
                                            onQuantityChange={(next) =>
                                              setAddToPlanForTreatment((prev) =>
                                                prev
                                                  ? { ...prev, quantity: next }
                                                  : null,
                                              )
                                            }
                                          />
                                        </label>
                                        <label className="treatment-recommender-by-treatment__details-label treatment-recommender-by-treatment__pricing-qty">
                                          <span className="treatment-recommender-by-treatment__pricing-qty-label">
                                            {qtyCtx.sculptraSessions.unitLabel}
                                          </span>
                                          <PlanQuantityStepperInput
                                            unitLabel={
                                              qtyCtx.sculptraSessions.unitLabel
                                            }
                                            quantity={
                                              addToPlanForTreatment.bioTreatmentSessions ??
                                              ""
                                            }
                                            options={qtyCtx.sculptraSessions.options}
                                            defaultQuantity={
                                              qtyCtx.sculptraSessions.defaultSessions
                                            }
                                            inputId={`plan-qty-sessions-${treatment}`}
                                            onQuantityChange={(next) =>
                                              setAddToPlanForTreatment((prev) =>
                                                prev
                                                  ? {
                                                      ...prev,
                                                      bioTreatmentSessions: next,
                                                    }
                                                  : null,
                                              )
                                            }
                                          />
                                        </label>
                                        {renderIntervalSelector(
                                          addToPlanForTreatment.bioTreatmentSessions ||
                                            qtyCtx.sculptraSessions
                                              .defaultSessions,
                                        )}
                                      </>
                                    ) : qtyCtx.primaryDiscussedField ===
                                      "bioTreatmentSessions" ? (
                                      <>
                                        <label className="treatment-recommender-by-treatment__details-label treatment-recommender-by-treatment__pricing-qty">
                                          <span className="treatment-recommender-by-treatment__pricing-qty-label">
                                            {qtyCtx.unitLabel}
                                          </span>
                                          <PlanQuantityStepperInput
                                            unitLabel={qtyCtx.unitLabel}
                                            quantity={
                                              addToPlanForTreatment.bioTreatmentSessions ??
                                              ""
                                            }
                                            options={qtyCtx.options}
                                            defaultQuantity={qtyCtx.defaultQuantity}
                                            inputId={`plan-qty-prominent-${treatment}`}
                                            onQuantityChange={(next) =>
                                              setAddToPlanForTreatment((prev) =>
                                                prev
                                                  ? {
                                                      ...prev,
                                                      bioTreatmentSessions: next,
                                                    }
                                                  : null,
                                              )
                                            }
                                          />
                                        </label>
                                        {renderIntervalSelector(
                                          addToPlanForTreatment.bioTreatmentSessions ||
                                            qtyCtx.defaultQuantity,
                                        )}
                                      </>
                                    ) : (
                                      <label className="treatment-recommender-by-treatment__details-label treatment-recommender-by-treatment__pricing-qty">
                                        <span className="treatment-recommender-by-treatment__pricing-qty-label">
                                          {qtyCtx.unitLabel}
                                        </span>
                                        {qtyCtx.quantityControl === "text" ? (
                                          <input
                                            type="text"
                                            inputMode="numeric"
                                            className="treatment-recommender-by-treatment__details-input"
                                            aria-label={qtyCtx.unitLabel}
                                            placeholder={
                                              qtyCtx.inputPlaceholder ??
                                              qtyCtx.defaultQuantity
                                            }
                                            value={
                                              addToPlanForTreatment.quantity ?? ""
                                            }
                                            onChange={(e) => {
                                              const v = e.target.value.replace(
                                                /\D/g,
                                                "",
                                              );
                                              setAddToPlanForTreatment((prev) =>
                                                prev
                                                  ? { ...prev, quantity: v }
                                                  : null,
                                              );
                                            }}
                                          />
                                        ) : (
                                          <PlanQuantityStepperInput
                                            unitLabel={qtyCtx.unitLabel}
                                            quantity={
                                              addToPlanForTreatment.quantity ?? ""
                                            }
                                            options={qtyCtx.options}
                                            defaultQuantity={qtyCtx.defaultQuantity}
                                            inputId={`plan-qty-prominent-${treatment}`}
                                            onQuantityChange={(next) =>
                                              setAddToPlanForTreatment((prev) =>
                                                prev
                                                  ? { ...prev, quantity: next }
                                                  : null,
                                              )
                                            }
                                          />
                                        )}
                                      </label>
                                    )}
                                    {addPlanDraftPricing.placement === "units" &&
                                    addPlanDraftPricing.message ? (
                                      <AddPlanFieldPricingHint
                                        message={addPlanDraftPricing.message}
                                      />
                                    ) : null}
                                  </>
                                );
                              })()}
                            {wellnestOffering ? (
                              <section
                                className="plan-opt-section"
                                aria-labelledby={`plan-opt-delivery-${planOptDomIdSuffix(treatment)}`}
                              >
                                <h4
                                  className="plan-opt-section__title"
                                  id={`plan-opt-delivery-${planOptDomIdSuffix(treatment)}`}
                                >
                                  Delivery & dosing
                                </h4>
                                <div className="plan-opt-section__body">
                                  <label className="treatment-recommender-by-treatment__details-label">
                                    Delivery form
                                    <select
                                      className="treatment-recommender-by-treatment__details-input"
                                      value={
                                        addToPlanForTreatment.deliveryForm ?? ""
                                      }
                                      onChange={(e) =>
                                        setAddToPlanForTreatment((prev) =>
                                          prev
                                            ? {
                                                ...prev,
                                                deliveryForm: e.target.value,
                                              }
                                            : null,
                                        )
                                      }
                                    >
                                      {getWellnestProductOptionsForTreatment(
                                        treatment,
                                      ).map((opt, wIdx) => (
                                        <option
                                          key={`wellnest-opt-${wIdx}-${opt}`}
                                          value={opt}
                                        >
                                          {opt}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="treatment-recommender-by-treatment__details-label">
                                    Dosing
                                    <input
                                      type="text"
                                      className="treatment-recommender-by-treatment__details-input"
                                      placeholder="e.g. 5 weeks"
                                      value={addToPlanForTreatment.dosing ?? ""}
                                      onChange={(e) =>
                                        setAddToPlanForTreatment((prev) =>
                                          prev
                                            ? {
                                                ...prev,
                                                dosing: e.target.value,
                                              }
                                            : null,
                                        )
                                      }
                                    />
                                  </label>
                                </div>
                              </section>
                            ) : null}
                            <div
                              className={`treatment-recommender-by-treatment__details plan-opt-details${
                                addToPlanForTreatment.detailsExpanded
                                  ? " treatment-recommender-by-treatment__details--open plan-opt-details--open"
                                  : ""
                              }`}
                            >
                              <button
                                type="button"
                                className="treatment-recommender-by-treatment__details-summary plan-opt-summary"
                                aria-expanded={addToPlanForTreatment.detailsExpanded}
                                onClick={() =>
                                  setAddToPlanForTreatment((prev) =>
                                    prev
                                      ? { ...prev, detailsExpanded: !prev.detailsExpanded }
                                      : null,
                                  )
                                }
                              >
                                Optional details
                              </button>
                              {addToPlanForTreatment.detailsExpanded && (
                              <div className="treatment-recommender-by-treatment__details-fields plan-opt-fields">
                                <div className="treatment-recommender-by-treatment__details-fields-nest plan-opt-fields-inner">
                                {(() => {
                                  const byArea =
                                    getFindingsByAreaForTreatment(treatment);
                                  const selected =
                                    addToPlanForTreatment.findings ?? [];
                                  const grouped = new Set(
                                    byArea.flatMap((g) => g.findings),
                                  );
                                  const otherSelected = selected.filter(
                                    (f) => !grouped.has(f),
                                  );
                                  const qOther = addPlanToAddressOtherSearch
                                    .trim()
                                    .toLowerCase();
                                  const otherPickList =
                                    ASSESSMENT_FINDINGS.filter(
                                      (f) =>
                                        !selected.includes(f) &&
                                        (!qOther ||
                                          f.toLowerCase().includes(qOther)),
                                    ).slice(0, 60);
                                  const toggleFinding = (f: string) => {
                                    setAddToPlanForTreatment((prev) => {
                                      if (!prev) return null;
                                      const cur = prev.findings ?? [];
                                      const next = cur.includes(f)
                                        ? cur.filter((x) => x !== f)
                                        : [...cur, f];
                                      return { ...prev, findings: next };
                                    });
                                  };
                                  return (
                                    <section
                                      className="plan-opt-section plan-opt-section--concerns"
                                      aria-label="Concerns to address"
                                    >
                                    <div
                                      className="treatment-recommender-by-treatment__to-address"
                                      role="group"
                                    >
                                      <div className="treatment-recommender-by-treatment__to-address-heading">
                                        <span className="treatment-recommender-by-treatment__to-address-heading-label">
                                          Concerns to address
                                        </span>
                                        {selected.length > 0 ? (
                                          <span className="treatment-recommender-by-treatment__to-address-summary-meta">
                                            · {selected.length} selected
                                          </span>
                                        ) : null}
                                      </div>
                                      <div className="treatment-recommender-by-treatment__to-address-inner">
                                        <p className="treatment-recommender-by-treatment__to-address-hint">
                                          Concerns this treatment relates to
                                          (from analysis or clinic assessment).
                                        </p>
                                        {byArea.length > 0 ? (
                                          <div className="treatment-recommender-by-treatment__to-address-areas">
                                            {byArea.map(
                                              (
                                                { area, findings: fList },
                                                areaIdx,
                                              ) => (
                                                <div
                                                  key={`to-address-area-${areaIdx}-${area}`}
                                                  className="treatment-recommender-by-treatment__to-address-area"
                                                >
                                                  <span className="treatment-recommender-by-treatment__to-address-area-label">
                                                    {area}
                                                  </span>
                                                  <div className="treatment-recommender-by-treatment__chips">
                                                    {fList.map((f, fIdx) => {
                                                      const on =
                                                        selected.includes(f);
                                                      return (
                                                        <button
                                                          key={`finding-${areaIdx}-${fIdx}-${f}`}
                                                          type="button"
                                                          className={`treatment-recommender-by-treatment__chip ${
                                                            on
                                                              ? "treatment-recommender-by-treatment__chip--selected"
                                                              : ""
                                                          }`}
                                                          onClick={() =>
                                                            toggleFinding(f)
                                                          }
                                                        >
                                                          <span className="treatment-recommender-by-treatment__chip-label">
                                                            {f}
                                                          </span>
                                                          {on ? (
                                                            <span
                                                              className="treatment-recommender-by-treatment__chip-remove"
                                                              aria-hidden
                                                            >
                                                              ×
                                                            </span>
                                                          ) : null}
                                                        </button>
                                                      );
                                                    })}
                                                  </div>
                                                </div>
                                              ),
                                            )}
                                          </div>
                                        ) : (
                                          <p className="treatment-recommender-by-treatment__to-address-hint">
                                            No mapped concerns for this
                                            treatment—add via Other or Notes.
                                          </p>
                                        )}
                                        <div className="treatment-recommender-by-treatment__to-address-other">
                                          <span className="treatment-recommender-by-treatment__to-address-other-label">
                                            Other
                                          </span>
                                          <div className="treatment-recommender-by-treatment__chips">
                                            {otherSelected.map((f, osIdx) => (
                                              <button
                                                key={`other-sel-${osIdx}-${f}`}
                                                type="button"
                                                className="treatment-recommender-by-treatment__chip treatment-recommender-by-treatment__chip--selected"
                                                onClick={() => toggleFinding(f)}
                                              >
                                                <span className="treatment-recommender-by-treatment__chip-label">
                                                  {f}
                                                </span>
                                                <span
                                                  className="treatment-recommender-by-treatment__chip-remove"
                                                  aria-hidden
                                                >
                                                  ×
                                                </span>
                                              </button>
                                            ))}
                                            {!addPlanToAddressOtherOpen ? (
                                              <button
                                                type="button"
                                                className="treatment-recommender-by-treatment__chip treatment-recommender-by-treatment__chip--secondary"
                                                onClick={() =>
                                                  setAddPlanToAddressOtherOpen(
                                                    true,
                                                  )
                                                }
                                              >
                                                + {OTHER_FINDING_LABEL}
                                              </button>
                                            ) : (
                                              <div className="treatment-recommender-by-treatment__to-address-other-picker">
                                                <div className="treatment-recommender-by-treatment__to-address-other-picker-row">
                                                  <input
                                                    type="search"
                                                    className="treatment-recommender-by-treatment__details-input"
                                                    placeholder="Search findings…"
                                                    value={
                                                      addPlanToAddressOtherSearch
                                                    }
                                                    onChange={(e) =>
                                                      setAddPlanToAddressOtherSearch(
                                                        e.target.value,
                                                      )
                                                    }
                                                    aria-label="Search findings"
                                                  />
                                                  <button
                                                    type="button"
                                                    className="treatment-recommender-by-treatment__cancel-btn treatment-recommender-by-treatment__to-address-other-done"
                                                    onClick={() => {
                                                      setAddPlanToAddressOtherOpen(
                                                        false,
                                                      );
                                                      setAddPlanToAddressOtherSearch(
                                                        "",
                                                      );
                                                    }}
                                                  >
                                                    Done
                                                  </button>
                                                </div>
                                                <div
                                                  className="treatment-recommender-by-treatment__to-address-other-list"
                                                  role="listbox"
                                                  aria-label="Findings to add"
                                                >
                                                  {otherPickList.length ===
                                                  0 ? (
                                                    <span className="treatment-recommender-by-treatment__to-address-other-empty">
                                                      No matches.
                                                    </span>
                                                  ) : (
                                                    otherPickList.map(
                                                      (f, pickIdx) => (
                                                        <button
                                                          key={`other-pick-${pickIdx}-${f}`}
                                                          type="button"
                                                          role="option"
                                                          className="treatment-recommender-by-treatment__to-address-other-option"
                                                          onClick={() =>
                                                            toggleFinding(f)
                                                          }
                                                        >
                                                          {f}
                                                        </button>
                                                      ),
                                                    )
                                                  )}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    </section>
                                  );
                                })()}
                                {addToPlanForTreatment.treatment !== "Skincare" &&
                                !shouldShowProminentPlanQuantity(
                                  addToPlanForTreatment.treatment,
                                  treatmentProductHintForQuantity(
                                    addToPlanForTreatment,
                                  ),
                                )
                                  ? (() => {
                                      const qtyHint =
                                        treatmentProductHintForQuantity(
                                          addToPlanForTreatment,
                                        );
                                      const qtyCtx = getQuantityContext(
                                        addToPlanForTreatment.treatment,
                                        qtyHint,
                                        provider?.code,
                                      );
                                      return (
                                        <section
                                          className="plan-opt-section"
                                          aria-labelledby={`plan-opt-qty-${planOptDomIdSuffix(treatment)}`}
                                        >
                                          <h4
                                            className="plan-opt-section__title"
                                            id={`plan-opt-qty-${planOptDomIdSuffix(treatment)}`}
                                          >
                                            Quantity
                                          </h4>
                                          <div className="plan-opt-section__body">
                                            <label className="treatment-recommender-by-treatment__details-label">
                                              <span className="treatment-recommender-by-treatment__quantity-unit-label">
                                                {qtyCtx.unitLabel}
                                              </span>
                                              {qtyCtx.quantityControl === "text" ? (
                                                <input
                                                  type="text"
                                                  inputMode="numeric"
                                                  className="treatment-recommender-by-treatment__details-input"
                                                  aria-label={qtyCtx.unitLabel}
                                                  placeholder={
                                                    qtyCtx.inputPlaceholder ?? qtyCtx.defaultQuantity
                                                  }
                                                  value={
                                                    addToPlanForTreatment.quantity ??
                                                    ""
                                                  }
                                                  onChange={(e) => {
                                                    const v =
                                                      e.target.value.replace(
                                                        /\D/g,
                                                        "",
                                                      );
                                                    setAddToPlanForTreatment(
                                                      (prev) =>
                                                        prev
                                                          ? { ...prev, quantity: v }
                                                          : null,
                                                    );
                                                  }}
                                                />
                                              ) : (
                                                <PlanQuantityStepperInput
                                                  unitLabel={qtyCtx.unitLabel}
                                                  quantity={
                                                    addToPlanForTreatment.quantity ??
                                                    ""
                                                  }
                                                  options={qtyCtx.options}
                                                  defaultQuantity={
                                                    qtyCtx.defaultQuantity
                                                  }
                                                  inputId={`plan-qty-details-${treatment}`}
                                                  onQuantityChange={(next) =>
                                                    setAddToPlanForTreatment(
                                                      (prev) =>
                                                        prev
                                                          ? { ...prev, quantity: next }
                                                          : null,
                                                    )
                                                  }
                                                />
                                              )}
                                            </label>
                                            {addPlanDraftPricing.placement ===
                                              "units" &&
                                            addPlanDraftPricing.message ? (
                                              <AddPlanFieldPricingHint
                                                message={
                                                  addPlanDraftPricing.message
                                                }
                                              />
                                            ) : null}
                                          </div>
                                        </section>
                                      );
                                    })()
                                  : null}
                                {!wellnestOffering &&
                                  !treatmentUsesStructuredProductSelectors(
                                    addToPlanForTreatment.treatment,
                                  ) && (
                                    <section
                                      className="plan-opt-section"
                                      aria-labelledby={`plan-opt-product-${planOptDomIdSuffix(treatment)}`}
                                    >
                                      <h4
                                        className="plan-opt-section__title"
                                        id={`plan-opt-product-${planOptDomIdSuffix(treatment)}`}
                                      >
                                        Product
                                      </h4>
                                      <div className="plan-opt-section__body">
                                        <input
                                          type="text"
                                          className="treatment-recommender-by-treatment__details-input"
                                          placeholder="e.g. Juvederm, Botox"
                                          value={
                                            addToPlanForTreatment.product ?? ""
                                          }
                                          onChange={(e) =>
                                            setAddToPlanForTreatment((prev) =>
                                              prev
                                                ? {
                                                    ...prev,
                                                    product: e.target.value,
                                                  }
                                                : null,
                                            )
                                          }
                                          aria-labelledby={`plan-opt-product-${planOptDomIdSuffix(treatment)}`}
                                        />
                                      </div>
                                    </section>
                                  )}
                                <section
                                  className="plan-opt-section plan-opt-section--notes"
                                  aria-labelledby={`plan-opt-notes-${planOptDomIdSuffix(treatment)}`}
                                >
                                  <h4
                                    className="plan-opt-section__title"
                                    id={`plan-opt-notes-${planOptDomIdSuffix(treatment)}`}
                                  >
                                    Notes
                                  </h4>
                                  <textarea
                                    className="treatment-recommender-by-treatment__details-textarea plan-opt-textarea"
                                    placeholder="Optional notes for this line item"
                                    rows={2}
                                    value={addToPlanForTreatment.notes ?? ""}
                                    onChange={(e) =>
                                      setAddToPlanForTreatment((prev) =>
                                        prev
                                          ? { ...prev, notes: e.target.value }
                                          : null,
                                      )
                                    }
                                    aria-labelledby={`plan-opt-notes-${planOptDomIdSuffix(treatment)}`}
                                  />
                                </section>
                                </div>
                              </div>
                              )}
                            </div>
                            <div className="treatment-recommender-by-treatment__add-actions plan-add-actions">
                              {addPlanDraftPricing.placement === "generic" &&
                              addPlanDraftPricing.message &&
                              treatment !== "Skincare" ? (
                                <div className="treatment-recommender-by-treatment__add-plan-actions-pricing-hint-wrap">
                                  <AddPlanFieldPricingHint
                                    message={addPlanDraftPricing.message}
                                  />
                                </div>
                              ) : null}
                              <button
                                type="button"
                                className="treatment-recommender-by-treatment__add-btn plan-add-confirm-btn"
                                onClick={handleAddToPlanConfirm}
                              >
                                {editingPlanItemId ? "Save changes" : "Confirm"}
                              </button>
                              <button
                                type="button"
                                className="treatment-recommender-by-treatment__cancel-btn plan-add-cancel-btn"
                                onClick={() => {
                                  setEditingPlanItemId(null);
                                  setAddToPlanForTreatment(null);
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : onAddToPlanDirect ? (
                          <button
                            type="button"
                            className="treatment-recommender-by-treatment__add-btn"
                            onClick={() => {
                              setEditingPlanItemId(null);
                              setAddToPlanForTreatment(
                                initialAddToPlanRowForTreatment(
                                  treatment,
                                  wellnestOffering,
                                  wellnestDefaultDeliveryForm,
                                  wellnestDefaultDosing,
                                ),
                              );
                            }}
                          >
                            Add to plan
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {wellnestDetailTreatment &&
        (() => {
          const detailOffering = getWellnestOfferingByTreatmentName(
            wellnestDetailTreatment,
          );
          if (!detailOffering) return null;
          const detailAddressCopy =
            getWellnestPatientFriendlyAddressCopy(detailOffering);
          const detailImg = getWellnestRecommenderImageUrl(
            wellnestDetailTreatment,
          );
          const detailResultCases = WELLNEST_CURATED_BLUEPRINT_CASES.filter(
            (p) => photoMatchesPlanTreatment(p, detailOffering.treatmentName),
          ).slice(0, 6);
          const talking = getWellnestExampleTalkingPoints(detailOffering);
          const externalExamples =
            getWellnestExternalExamplesForOffering(detailOffering);
          const selectedExternalExamples = externalExamples.filter(
            (ex) => wellnestArticleSelection[ex.id],
          );
          const selectedExternalCount = selectedExternalExamples.length;
          const externalKindLabel = (k: WellnestExternalExampleKind) => {
            switch (k) {
              case "news":
                return "News";
              case "youtube":
                return "YouTube";
              case "reddit":
                return "Reddit";
              case "podcast":
                return "Podcast";
              case "government":
                return "Gov";
              case "research":
                return "Research";
              case "investigation":
                return "Report";
            }
          };
          const buildExternalShareDraft = (
            treatmentName: string,
            examples: WellnestExternalExample[],
          ) => {
            const firstName = client.name?.trim().split(/\s+/)[0] || "there";
            const lines = examples.map((ex) => `- ${ex.title}: ${ex.url}`);
            return `Hi ${firstName}, here are the ${treatmentName} resources we discussed:\n${lines.join(
              "\n",
            )}`;
          };
          const openArticleShare = () => {
            const defaults: Record<string, boolean> = {};
            for (const ex of externalExamples.slice(0, 2))
              defaults[ex.id] = true;
            const preselected = externalExamples.filter(
              (ex) => defaults[ex.id],
            );
            setWellnestArticleSelection(defaults);
            setWellnestArticlePhone(formatPhoneDisplay(client.phone));
            setWellnestArticleDraft(
              buildExternalShareDraft(
                detailOffering.treatmentName,
                preselected,
              ),
            );
            setShowWellnestArticleShare(true);
            window.setTimeout(() => {
              wellnestSharePanelRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
              });
            }, 30);
          };
          const toggleArticleSelection = (id: string) => {
            setWellnestArticleSelection((prev) => {
              const next = { ...prev, [id]: !prev[id] };
              const selected = externalExamples.filter((ex) => next[ex.id]);
              setWellnestArticleDraft(
                buildExternalShareDraft(detailOffering.treatmentName, selected),
              );
              return next;
            });
          };
          const sendSelectedArticles = async () => {
            if (selectedExternalCount === 0) {
              showError("Select at least one article to share.");
              return;
            }
            const formattedPhone = formatPhoneDisplay(wellnestArticlePhone);
            if (!isValidPhone(formattedPhone)) {
              showError("Enter a valid recipient phone number.");
              return;
            }
            if (!wellnestArticleDraft.trim()) {
              showError("Message is empty.");
              return;
            }
            setWellnestArticleSending(true);
            try {
              await sendSMSNotification(
                cleanPhoneNumber(formattedPhone),
                wellnestArticleDraft.trim(),
                client.name,
              );
              showToast("Articles sent");
              setShowWellnestArticleShare(false);
            } catch (err) {
              showError(
                err instanceof Error ? err.message : "Failed to send SMS.",
              );
            } finally {
              setWellnestArticleSending(false);
            }
          };
          return (
            <div
              className="wellnest-recommender-info-backdrop"
              role="dialog"
              aria-modal="true"
              aria-labelledby="wellnest-recommender-info-title"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setWellnestDetailTreatment(null);
                }
              }}
            >
              <div
                className="wellnest-recommender-info-dialog"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="wellnest-recommender-info-close"
                  aria-label="Close"
                  onClick={() => setWellnestDetailTreatment(null)}
                >
                  ×
                </button>
                <img
                  className="wellnest-recommender-info-hero"
                  src={detailImg}
                  alt=""
                />
                <div className="wellnest-recommender-info-body">
                  <h2 id="wellnest-recommender-info-title">
                    {detailOffering.treatmentName}
                  </h2>
                  <p className="wellnest-recommender-info-category">
                    {detailOffering.category}
                  </p>
                  <dl className="wellnest-recommender-info-dl">
                    <dt>Visible results</dt>
                    <dd>{detailOffering.resultsTimeline}</dd>
                    <dt>Price guide (from sheet)</dt>
                    <dd>{detailOffering.pricing}</dd>
                    <dt>Delivery options</dt>
                    <dd>{detailOffering.delivery}</dd>
                    <dt>Often discussed for</dt>
                    <dd>{detailOffering.demographics}</dd>
                    <dt>Supply / protocol notes</dt>
                    <dd>{detailOffering.notes}</dd>
                  </dl>
                  <h3 className="wellnest-recommender-info-subhead">
                    What it may address
                  </h3>
                  <p className="wellnest-recommender-info-para">
                    {detailAddressCopy}
                  </p>
                  <h3 className="wellnest-recommender-info-subhead">
                    Example talking points (education only)
                  </h3>
                  <ul className="wellnest-recommender-info-bullets">
                    {talking.map((line, i) => (
                      <li key={`${i}-${line.slice(0, 40)}`}>{line}</li>
                    ))}
                  </ul>
                  {detailResultCases.length > 0 ? (
                    <>
                      <h3 className="wellnest-recommender-info-subhead">
                        Relevant cases
                      </h3>
                      <div className="wellnest-recommender-info-results">
                        {detailResultCases.map((c) => (
                          <article
                            key={`wellnest-case-${c.id}`}
                            className="wellnest-recommender-info-result-card"
                          >
                            <img
                              src={c.photoUrl}
                              alt={c.storyTitle || "Illustrative wellness case"}
                              className="wellnest-recommender-info-result-image"
                              loading="lazy"
                              onError={(e) => {
                                const img = e.currentTarget;
                                img.onerror = null;
                                img.src = WELLNEST_CASE_IMAGE_FALLBACK;
                              }}
                            />
                            <div className="wellnest-recommender-info-result-body">
                              <p className="wellnest-recommender-info-result-title">
                                {c.storyTitle || "Case highlight"}
                              </p>
                              {c.caption ? (
                                <p className="wellnest-recommender-info-result-caption">
                                  {c.caption}
                                </p>
                              ) : null}
                              <button
                                type="button"
                                className="wellnest-recommender-info-result-learn-more"
                                onClick={() => {
                                  setWellnestSelectedResultCase(c);
                                  window.setTimeout(() => {
                                    wellnestCasePanelRef.current?.scrollIntoView(
                                      {
                                        behavior: "smooth",
                                        block: "nearest",
                                      },
                                    );
                                  }, 30);
                                }}
                              >
                                Learn more
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                      {wellnestSelectedResultCase && (
                        <div
                          ref={wellnestCasePanelRef}
                          className="wellnest-recommender-case-inline"
                        >
                          <div className="wellnest-recommender-case-inline-head">
                            <h4
                              id="wellnest-case-title"
                              className="wellnest-recommender-case-title"
                            >
                              {wellnestSelectedResultCase.storyTitle ||
                                "Case detail"}
                            </h4>
                            <button
                              type="button"
                              className="wellnest-recommender-case-inline-close"
                              onClick={() =>
                                setWellnestSelectedResultCase(null)
                              }
                            >
                              Close
                            </button>
                          </div>
                          <img
                            src={wellnestSelectedResultCase.photoUrl}
                            alt={
                              wellnestSelectedResultCase.storyTitle ||
                              "Wellness case"
                            }
                            className="wellnest-recommender-case-image"
                            onError={(e) => {
                              const img = e.currentTarget;
                              img.onerror = null;
                              img.src = WELLNEST_CASE_IMAGE_FALLBACK;
                            }}
                          />
                          {wellnestSelectedResultCase.caption ? (
                            <p className="wellnest-recommender-case-copy">
                              {wellnestSelectedResultCase.caption}
                            </p>
                          ) : null}
                          {wellnestSelectedResultCase.treatments?.length ? (
                            <p className="wellnest-recommender-case-tags">
                              Related:{" "}
                              {wellnestSelectedResultCase.treatments
                                .filter(Boolean)
                                .slice(0, 3)
                                .join(", ")}
                            </p>
                          ) : null}
                        </div>
                      )}
                    </>
                  ) : null}
                  <h3 className="wellnest-recommender-info-subhead">
                    Third-party perspectives (open web)
                  </h3>
                  <p className="wellnest-recommender-info-para wellnest-recommender-info-para--compact">
                    {WELLNEST_EXTERNAL_LINKS_DISCLAIMER}
                  </p>
                  <ul className="wellnest-recommender-info-external">
                    {externalExamples.map((ex) => (
                      <li key={ex.id}>
                        <span
                          className="wellnest-recommender-info-external-kind"
                          title={ex.kind}
                        >
                          {externalKindLabel(ex.kind)}
                        </span>
                        <a
                          href={ex.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="wellnest-recommender-info-external-link"
                        >
                          {ex.title}
                        </a>
                        {ex.note ? (
                          <span className="wellnest-recommender-info-external-note">
                            {ex.note}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="wellnest-recommender-info-share-btn"
                    onClick={openArticleShare}
                  >
                    Share selected articles via SMS
                  </button>
                  {showWellnestArticleShare && (
                    <div
                      ref={wellnestSharePanelRef}
                      className="wellnest-recommender-share-inline"
                    >
                      <h3 id="wellnest-share-articles-title">
                        Share articles with client
                      </h3>
                      <p className="wellnest-recommender-share-hint">
                        Choose which links to include, then send by SMS.
                      </p>
                      <ul className="wellnest-recommender-share-list">
                        {externalExamples.map((ex) => (
                          <li key={`share-${ex.id}`}>
                            <label>
                              <input
                                type="checkbox"
                                checked={Boolean(
                                  wellnestArticleSelection[ex.id],
                                )}
                                onChange={() => toggleArticleSelection(ex.id)}
                              />
                              <span>{ex.title}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                      <label
                        className="wellnest-recommender-share-label"
                        htmlFor="wellnest-share-phone"
                      >
                        Recipient phone
                      </label>
                      <input
                        id="wellnest-share-phone"
                        type="tel"
                        className="wellnest-recommender-share-input"
                        value={wellnestArticlePhone}
                        placeholder="(555) 555-5555"
                        onChange={(e) =>
                          setWellnestArticlePhone(e.target.value)
                        }
                      />
                      <label
                        className="wellnest-recommender-share-label"
                        htmlFor="wellnest-share-message"
                      >
                        Message
                      </label>
                      <textarea
                        id="wellnest-share-message"
                        className="wellnest-recommender-share-textarea"
                        value={wellnestArticleDraft}
                        onChange={(e) =>
                          setWellnestArticleDraft(e.target.value)
                        }
                        rows={7}
                      />
                      <div className="wellnest-recommender-share-actions">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setShowWellnestArticleShare(false)}
                          disabled={wellnestArticleSending}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={sendSelectedArticles}
                          disabled={
                            wellnestArticleSending ||
                            selectedExternalCount === 0 ||
                            !wellnestArticleDraft.trim() ||
                            !isValidPhone(
                              formatPhoneDisplay(wellnestArticlePhone),
                            )
                          }
                        >
                          {wellnestArticleSending ? "Sending…" : "Send SMS"}
                        </button>
                      </div>
                    </div>
                  )}
                  <p className="wellnest-recommender-info-disclaimer">
                    {WELLNEST_REGULATORY_NOTICE}
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

      {photoExplorerContext && (
        <TreatmentPhotosModal
          client={client}
          selectedTreatment={photoExplorerContext.treatment}
          selectedRegion={photoExplorerContext.region}
          onClose={() => setPhotoExplorerContext(null)}
          onUpdate={onUpdate}
          onAddToPlanDirect={
            onAddToPlanDirect
              ? async (prefill, options) => {
                  setPhotoExplorerContext(null);
                  await onAddToPlanDirect(prefill, options);
                }
              : undefined
          }
          planItems={client.discussedItems ?? []}
          demoPhotos={
            photoExplorerContext.judgeMdGallery
              ? judgeMdExhibitToDemoPhotos(photoExplorerContext.treatment, {
                  pageUrl: photoExplorerContext.judgeMdGallery.pageUrl,
                  imageUrls: photoExplorerContext.judgeMdGallery.imageUrls,
                })
              : undefined
          }
          galleryAttributionUrl={
            photoExplorerContext.judgeMdGallery?.pageUrl
          }
        />
      )}

      {unifiedEditModalTreatment && provider?.id && (
        <div
          className="treatment-recommender-by-treatment__edit-options-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-options-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeUnifiedRecommenderEditModal();
            }
          }}
        >
          <div
            className="treatment-recommender-by-treatment__edit-options-panel treatment-recommender-by-treatment__edit-options-panel--unified"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="edit-options-title"
              className="treatment-recommender-by-treatment__edit-options-title"
            >
              Edit {unifiedEditModalTreatment} options
            </h2>
            <div className="treatment-recommender-by-treatment__unified-edit-scroll">
              {unifiedEditSections.map((section) => {
                const sectionRows = getUnifiedEditSectionDisplayRecords(
                  section.optionType,
                );
                const unifiedEditRowBusy =
                  editingRecordId !== null ||
                  unifiedEditMaterializingKey !== null;
                const inputs = unifiedEditNewInputs[section.optionType] ?? {
                  name: "",
                  priceNote: "",
                };
                const composerOpen =
                  unifiedEditComposerOpenByType[section.optionType] === true;
                const showPriceField = section.optionType !== "timeline";
                const persistSectionOrder = (
                  nextRows: Array<{ value: string }>,
                ) => {
                  if (!provider?.id) return;
                  const raw = provider?.["Treatment Pricing"] as
                    | string
                    | undefined;
                  updateTreatmentRecommenderOptionOrder(
                    provider.id,
                    section.optionType,
                    nextRows.map((row) => row.value),
                    raw,
                  )
                    .then((updatedPricingRaw) => {
                      if (provider) {
                        setProvider({
                          ...provider,
                          "Treatment Pricing": updatedPricingRaw,
                        });
                      }
                      setOptionRecords(
                        extractRecommenderOptionsFromPricingJson(
                          updatedPricingRaw,
                        ),
                      );
                    })
                    .catch(() => showToast("Could not reorder"));
                };
                const moveSectionRow = (fromIndex: number, toIndex: number) => {
                  if (toIndex < 0 || toIndex >= sectionRows.length) return;
                  const nextRows = [...sectionRows];
                  const [moved] = nextRows.splice(fromIndex, 1);
                  if (!moved) return;
                  nextRows.splice(toIndex, 0, moved);
                  persistSectionOrder(nextRows);
                };
                const closeComposer = () => {
                  setUnifiedEditComposerOpenByType((prev) => ({
                    ...prev,
                    [section.optionType]: false,
                  }));
                  setUnifiedEditNewInputs((prev) => ({
                    ...prev,
                    [section.optionType]: { name: "", priceNote: "" },
                  }));
                };
                const trySaveNewOption = () => {
                  const val = buildRecommenderOptionValueWithOptionalPrice(
                    inputs.name,
                    showPriceField ? inputs.priceNote : "",
                  );
                  if (!val || !provider?.id) return;
                  const raw = provider?.["Treatment Pricing"] as string | undefined;
                  createTreatmentRecommenderCustomOption(
                    provider.id,
                    section.optionType,
                    val,
                    raw,
                  )
                    .then(({ updatedPricingRaw }) => {
                      if (provider) setProvider({ ...provider, "Treatment Pricing": updatedPricingRaw });
                      setOptionRecords(
                        extractRecommenderOptionsFromPricingJson(updatedPricingRaw),
                      );
                      closeComposer();
                    })
                    .catch((err: unknown) =>
                      showToast(
                        err instanceof Error && err.message
                          ? `Could not add: ${err.message}`
                          : "Could not add — please try again",
                      ),
                    );
                };
                return (
                  <section
                    key={section.optionType}
                    className="treatment-recommender-by-treatment__unified-edit-section"
                  >
                    <h3 className="treatment-recommender-by-treatment__unified-edit-section-title">
                      {section.title}
                    </h3>
                    {section.optionType === "microneedling_where" ? (
                      <p className="treatment-recommender-by-treatment__unified-edit-section-hint">
                        Microneedling / PRFM pricing is listed under{" "}
                        <strong>Microneedling — Type</strong> above.
                      </p>
                    ) : null}
                    {section.optionType === "where" &&
                    (unifiedEditModalTreatment === "Filler" ||
                      unifiedEditModalTreatment === "Neurotoxin" ||
                      unifiedEditModalTreatment === "Biostimulants") ? (
                      <p className="treatment-recommender-by-treatment__unified-edit-section-hint">
                        Injectable product pricing is listed under{" "}
                        <strong>
                          {unifiedEditModalTreatment === "Biostimulants"
                            ? `${unifiedEditModalTreatment} — Product`
                            : `${unifiedEditModalTreatment} — Type`}
                        </strong>{" "}
                        above.
                      </p>
                    ) : null}
                    {sectionRows.length > 0 || composerOpen ? (
                      <ul className="treatment-recommender-by-treatment__unified-edit-items">
                        {sectionRows.map((rec, rowIndex) => {
                          const rowMatKey = `${section.optionType}\u001f${rec.value}`;
                          const canMoveUp = rowIndex > 0;
                          const canMoveDown = rowIndex < sectionRows.length - 1;
                          const strippedLabel =
                            stripOptionalRecommenderPriceFromLabel(rec.value);
                          return (
                            <li
                              key={
                                rec.id ||
                                `builtin-${section.optionType}-${rec.value}`
                              }
                              className="treatment-recommender-by-treatment__unified-edit-item"
                            >
                              {!rec.id ? (
                                <>
                                  <div className="treatment-recommender-by-treatment__unified-edit-item-text">
                                    <span className="treatment-recommender-by-treatment__unified-edit-item-label">
                                      {strippedLabel}
                                    </span>
                                  </div>
                                  <div className="treatment-recommender-by-treatment__unified-edit-item-trailing">
                                    <button
                                      type="button"
                                      className="treatment-recommender-by-treatment__edit-options-btn treatment-recommender-by-treatment__edit-options-btn--arrow"
                                      disabled={
                                        !canEditRecommenderOptions ||
                                        unifiedEditRowBusy ||
                                        !canMoveUp
                                      }
                                      title={`Move ${strippedLabel} up`}
                                      aria-label={`Move ${strippedLabel} up`}
                                      onClick={() =>
                                        moveSectionRow(rowIndex, rowIndex - 1)
                                      }
                                    >
                                      <span aria-hidden="true">↑</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="treatment-recommender-by-treatment__edit-options-btn treatment-recommender-by-treatment__edit-options-btn--arrow"
                                      disabled={
                                        !canEditRecommenderOptions ||
                                        unifiedEditRowBusy ||
                                        !canMoveDown
                                      }
                                      title={`Move ${strippedLabel} down`}
                                      aria-label={`Move ${strippedLabel} down`}
                                      onClick={() =>
                                        moveSectionRow(rowIndex, rowIndex + 1)
                                      }
                                    >
                                      <span aria-hidden="true">↓</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="treatment-recommender-by-treatment__edit-options-btn"
                                      disabled={
                                        !canEditRecommenderOptions ||
                                        unifiedEditRowBusy
                                      }
                                      onClick={() => {
                                        if (!provider?.id) return;
                                        unifiedEditMaterializeAbortRef.current = false;
                                        setUnifiedEditMaterializingKey(
                                          rowMatKey,
                                        );
                                        const raw = provider?.["Treatment Pricing"] as string | undefined;
                                        createTreatmentRecommenderCustomOption(
                                          provider.id,
                                          section.optionType,
                                          rec.value,
                                          raw,
                                        )
                                          .then(({ option: created, updatedPricingRaw }) => {
                                            if (
                                              unifiedEditMaterializeAbortRef.current
                                            ) {
                                              unifiedEditMaterializeAbortRef.current = false;
                                              void deleteTreatmentRecommenderOption(
                                                provider.id,
                                                section.optionType,
                                                created.value,
                                                false,
                                                updatedPricingRaw,
                                              )
                                                .then((raw2) => {
                                                  if (provider) setProvider({ ...provider, "Treatment Pricing": raw2 });
                                                  setOptionRecords(
                                                    extractRecommenderOptionsFromPricingJson(raw2),
                                                  );
                                                })
                                                .catch(() => {});
                                              return;
                                            }
                                            if (provider) setProvider({ ...provider, "Treatment Pricing": updatedPricingRaw });
                                            setOptionRecords(
                                              extractRecommenderOptionsFromPricingJson(updatedPricingRaw),
                                            );
                                            unifiedEditDraftRecordIdRef.current =
                                              created.id;
                                            setEditingRecordId(created.id);
                                            setEditingValue(created.value);
                                          })
                                          .catch(() =>
                                            showToast("Could not start edit"),
                                          )
                                          .finally(() =>
                                            setUnifiedEditMaterializingKey(
                                              null,
                                            ),
                                          );
                                      }}
                                    >
                                      {unifiedEditMaterializingKey === rowMatKey
                                        ? "…"
                                        : "Edit"}
                                    </button>
                                    <button
                                      type="button"
                                      className="treatment-recommender-by-treatment__edit-options-btn treatment-recommender-by-treatment__edit-options-btn--danger"
                                      disabled
                                      title="Not linked to your saved list yet — refresh the page, or use Edit once to create a row you can remove."
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </>
                              ) : editingRecordId === rec.id ? (
                                <div className="treatment-recommender-by-treatment__unified-edit-item-edit treatment-recommender-by-treatment__unified-edit-item-edit--single-row">
                                  <input
                                    type="text"
                                    className="treatment-recommender-by-treatment__edit-options-input"
                                    value={editingValue}
                                    onChange={(e) =>
                                      setEditingValue(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        const raw = provider?.["Treatment Pricing"] as string | undefined;
                                        updateTreatmentRecommenderOption(
                                          provider?.id ?? "",
                                          section.optionType,
                                          rec.value,
                                          editingValue,
                                          raw,
                                        )
                                          .then(({ updatedPricingRaw }) => {
                                            unifiedEditDraftRecordIdRef.current =
                                              null;
                                            if (provider) setProvider({ ...provider, "Treatment Pricing": updatedPricingRaw });
                                            setOptionRecords(
                                              extractRecommenderOptionsFromPricingJson(updatedPricingRaw),
                                            );
                                            setEditingRecordId(null);
                                            setEditingValue("");
                                          })
                                          .catch(() =>
                                            showToast("Could not update"),
                                          );
                                      }
                                      if (e.key === "Escape") {
                                        cancelUnifiedEditInline();
                                      }
                                    }}
                                    autoFocus
                                    aria-label="New name"
                                  />
                                  <button
                                    type="button"
                                    className="treatment-recommender-by-treatment__edit-options-btn treatment-recommender-by-treatment__edit-options-btn--primary"
                                    onClick={() => {
                                      const raw = provider?.["Treatment Pricing"] as string | undefined;
                                      updateTreatmentRecommenderOption(
                                        provider?.id ?? "",
                                        section.optionType,
                                        rec.value,
                                        editingValue,
                                        raw,
                                      )
                                        .then(({ updatedPricingRaw }) => {
                                          unifiedEditDraftRecordIdRef.current =
                                            null;
                                          if (provider) setProvider({ ...provider, "Treatment Pricing": updatedPricingRaw });
                                          setOptionRecords(
                                            extractRecommenderOptionsFromPricingJson(updatedPricingRaw),
                                          );
                                          setEditingRecordId(null);
                                          setEditingValue("");
                                        })
                                        .catch(() =>
                                          showToast("Could not update"),
                                        );
                                    }}
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    className="treatment-recommender-by-treatment__edit-options-btn"
                                    onClick={cancelUnifiedEditInline}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <div className="treatment-recommender-by-treatment__unified-edit-item-text">
                                    <span className="treatment-recommender-by-treatment__unified-edit-item-label">
                                      {strippedLabel}
                                    </span>
                                  </div>
                                  <div className="treatment-recommender-by-treatment__unified-edit-item-trailing">
                                    <button
                                      type="button"
                                      className="treatment-recommender-by-treatment__edit-options-btn treatment-recommender-by-treatment__edit-options-btn--arrow"
                                      disabled={
                                        !canEditRecommenderOptions ||
                                        (unifiedEditRowBusy &&
                                          editingRecordId !== rec.id) ||
                                        !canMoveUp
                                      }
                                      title={`Move ${strippedLabel} up`}
                                      aria-label={`Move ${strippedLabel} up`}
                                      onClick={() =>
                                        moveSectionRow(rowIndex, rowIndex - 1)
                                      }
                                    >
                                      <span aria-hidden="true">↑</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="treatment-recommender-by-treatment__edit-options-btn treatment-recommender-by-treatment__edit-options-btn--arrow"
                                      disabled={
                                        !canEditRecommenderOptions ||
                                        (unifiedEditRowBusy &&
                                          editingRecordId !== rec.id) ||
                                        !canMoveDown
                                      }
                                      title={`Move ${strippedLabel} down`}
                                      aria-label={`Move ${strippedLabel} down`}
                                      onClick={() =>
                                        moveSectionRow(rowIndex, rowIndex + 1)
                                      }
                                    >
                                      <span aria-hidden="true">↓</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="treatment-recommender-by-treatment__edit-options-btn"
                                      disabled={
                                        !canEditRecommenderOptions ||
                                        (unifiedEditRowBusy &&
                                          editingRecordId !== rec.id)
                                      }
                                      onClick={() => {
                                        unifiedEditDraftRecordIdRef.current =
                                          null;
                                        setEditingRecordId(rec.id);
                                        setEditingValue(rec.value);
                                      }}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      className="treatment-recommender-by-treatment__edit-options-btn treatment-recommender-by-treatment__edit-options-btn--danger"
                                      disabled={
                                        !canEditRecommenderOptions ||
                                        (unifiedEditRowBusy &&
                                          editingRecordId !== rec.id)
                                      }
                                      onClick={() => {
                                        const raw = provider?.["Treatment Pricing"] as string | undefined;
                                        deleteTreatmentRecommenderOption(
                                          provider?.id ?? "",
                                          section.optionType,
                                          rec.value,
                                          false,
                                          raw,
                                        )
                                          .then((updatedRaw) => {
                                            if (provider) setProvider({ ...provider, "Treatment Pricing": updatedRaw });
                                            setOptionRecords(
                                              extractRecommenderOptionsFromPricingJson(updatedRaw),
                                            );
                                          })
                                          .catch(() =>
                                            showToast("Could not remove"),
                                          );
                                      }}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </>
                              )}
                            </li>
                          );
                        })}
                        {composerOpen ? (
                          <li
                            key={`composer-${section.optionType}`}
                            className="treatment-recommender-by-treatment__unified-edit-item"
                          >
                            <div className="treatment-recommender-by-treatment__unified-edit-item-edit treatment-recommender-by-treatment__unified-edit-item-edit--single-row">
                              <input
                                type="text"
                                className="treatment-recommender-by-treatment__edit-options-input"
                                placeholder="New option name"
                                value={inputs.name}
                                onChange={(e) =>
                                  setUnifiedEditNewInputs((prev) => ({
                                    ...prev,
                                    [section.optionType]: {
                                      ...(prev[section.optionType] ?? {
                                        name: "",
                                        priceNote: "",
                                      }),
                                      name: e.target.value,
                                    },
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    trySaveNewOption();
                                  }
                                  if (e.key === "Escape") {
                                    closeComposer();
                                  }
                                }}
                                autoFocus
                                aria-label={`New ${section.title} option name`}
                              />
                              {showPriceField ? (
                                <input
                                  type="text"
                                  className="treatment-recommender-by-treatment__edit-options-input treatment-recommender-by-treatment__edit-options-input--price-note"
                                  placeholder="Price (optional, e.g. $350)"
                                  value={inputs.priceNote}
                                  onChange={(e) =>
                                    setUnifiedEditNewInputs((prev) => ({
                                      ...prev,
                                      [section.optionType]: {
                                        ...(prev[section.optionType] ?? {
                                          name: "",
                                          priceNote: "",
                                        }),
                                        priceNote: e.target.value,
                                      },
                                    }))
                                  }
                                  aria-label="Optional price for new option"
                                />
                              ) : null}
                              <button
                                type="button"
                                className="treatment-recommender-by-treatment__edit-options-btn treatment-recommender-by-treatment__edit-options-btn--primary"
                                onClick={trySaveNewOption}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                className="treatment-recommender-by-treatment__edit-options-btn"
                                onClick={closeComposer}
                              >
                                Cancel
                              </button>
                            </div>
                          </li>
                        ) : null}
                      </ul>
                    ) : (
                      <p className="treatment-recommender-by-treatment__unified-edit-items-empty">
                        No options in this section yet.
                      </p>
                    )}
                    {!composerOpen ? (
                      <div className="treatment-recommender-by-treatment__unified-edit-add-trigger">
                        <button
                          type="button"
                          className="treatment-recommender-by-treatment__unified-edit-add-option"
                          disabled={
                            !canEditRecommenderOptions || unifiedEditRowBusy
                          }
                          onClick={() => {
                            setUnifiedEditComposerOpenByType((prev) => ({
                              ...prev,
                              [section.optionType]: true,
                            }));
                          }}
                        >
                          + Add option
                        </button>
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>
            <div className="treatment-recommender-by-treatment__edit-options-actions">
              <button
                type="button"
                className="treatment-recommender-by-treatment__edit-options-done"
                onClick={closeUnifiedRecommenderEditModal}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {showClientPhotoModal && (hasFront || hasSide) && (
        <PhotoViewerModal
          client={client}
          initialPhotoType={clientPhotoView}
          onClose={() => setShowClientPhotoModal(false)}
        />
      )}

      {targetTreatmentDatePanelOpen &&
        addToPlanForTreatment &&
        targetTreatmentDatePopoverRect &&
        createPortal(
          <div
            ref={targetTreatmentDatePopoverRef}
            className="treatment-recommender-by-treatment__target-date-popover"
            style={{
              position: "fixed",
              top: targetTreatmentDatePopoverRect.top,
              left: targetTreatmentDatePopoverRect.left,
              width: targetTreatmentDatePopoverRect.width,
              boxSizing: "border-box",
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="target-treatment-date-heading"
            aria-describedby="target-treatment-date-desc"
          >
            <h4
              id="target-treatment-date-heading"
              className="treatment-recommender-by-treatment__target-date-popover-title"
            >
              Target Treatment Date
            </h4>
            <p
              id="target-treatment-date-desc"
              className="treatment-recommender-by-treatment__target-date-popover-desc"
            >
              Use this for event-driven planning (for example, timing treatments
              before a wedding). The date appears on the patient&apos;s shared
              treatment plan.
            </p>
            <input
              ref={targetTreatmentDateInputRef}
              type="date"
              className="treatment-recommender-by-treatment__target-date-popover-input"
              aria-label="Select target treatment date"
              value={addToPlanForTreatment.scheduledDate ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setAddToPlanForTreatment((prev) =>
                  prev
                    ? {
                        ...prev,
                        scheduledDate: v || undefined,
                      }
                    : null,
                );
              }}
            />
            <div className="treatment-recommender-by-treatment__target-date-popover-actions">
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => setTargetTreatmentDatePanelOpen(false)}
              >
                Done
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
