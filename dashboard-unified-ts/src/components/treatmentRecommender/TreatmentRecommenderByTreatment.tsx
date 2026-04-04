/**
 * Treatment Recommender – by treatment.
 * Full-width treatment cards with feature breakdown and Add to plan.
 */

import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { useDashboard } from "../../context/DashboardContext";
import { Client, TreatmentPhoto, DiscussedItem } from "../../types";
import {
  fetchTreatmentPhotos,
  fetchTableRecords,
  sendSMSNotification,
  fetchTreatmentRecommenderCustomOptions,
  createTreatmentRecommenderCustomOption,
  deleteTreatmentRecommenderOption,
  updateTreatmentRecommenderOption,
  seedTreatmentRecommenderOptions,
  type TreatmentRecommenderOptionType,
} from "../../services/api";
import { getClientFrontPhotoDisplayUrl } from "../../utils/photoLoading";
import { getWellnestDemoPhotoUrls } from "../../debug/wellnestDemoPhotos";
import {
  getWellnestOfferingByTreatmentName,
  getWellnestProductOptionsForTreatment,
  getWellnestPriceBand,
  isWellnestWellnessProviderCode,
  parseWellnestWhatItAddressesChips,
  WELLNEST_BROWSE_GROUP_LABELS,
  WELLNEST_BROWSE_GROUP_ORDER,
  WELLNEST_REGULATORY_NOTICE,
  wellnestDeliveryHasNasal,
  wellnestDeliveryHasOral,
  wellnestDeliveryHasTopical,
} from "../../data/wellnestOfferings";
import { WELLNESS_TREATMENTS } from "../../data/wellnessQuiz";
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
  type TreatmentRecommenderFilterState,
} from "../../config/treatmentRecommenderConfig";
import {
  getSuggestedTreatmentsForFindings,
  getFindingsByAreaForTreatment,
  formatTreatmentPlanRowFullLine,
  getTreatmentPlanRowPrimaryLabel,
  getTreatmentPlanRowSecondaryLabel,
  getQuantityContext,
  shouldShowProminentPlanQuantity,
  canonicalBiostimulantProductLabel,
  canonicalNeurotoxinProductLabel,
  stripOptionalRecommenderPriceFromLabel,
} from "../modals/DiscussedTreatmentsModal/utils";
import {
  REGION_OPTIONS,
  REGION_OPTIONS_MICRONEEDLING,
  CHEMICAL_PEEL_AREA_OPTIONS,
  MICRONEEDLING_TYPE_OPTIONS,
  TIMELINE_OPTIONS,
  TIMELINE_SKINCARE,
  PLAN_SECTIONS,
  SKINCARE_SECTION_LABEL,
  getTreatmentProductOptionsForProvider,
  getSkincareCarouselItems,
  ASSESSMENT_FINDINGS,
  OTHER_PRODUCT_LABEL,
  OTHER_FINDING_LABEL,
  SKINCARE_CATEGORY_OPTIONS,
  SKINCARE_USE_CASE_LABELS,
  getTreatmentOptionsForProvider,
  ENERGY_TREATMENT_CATEGORY,
  LEGACY_ENERGY_DEVICE_CATEGORY,
  isEnergyTreatmentCategory,
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
import { WELLNEST_CURATED_BLUEPRINT_CASES } from "../../data/wellnestCuratedBlueprintCases";
import {
  photoMatchesPlanTreatment,
  type BlueprintCasePhoto,
} from "../../utils/postVisitBlueprintCases";
import {
  getEffectivePriceList,
  getBiostimulantTypeOptionLabels,
  getNeurotoxinTypeOptionLabels,
  getSkuOptionsForCategory,
  type ProviderPricingJson,
} from "../../data/treatmentPricing2025";
import TreatmentRecommenderFilters from "./TreatmentRecommenderFilters";
import { PlanQuantityStepperInput } from "./planQuantityStepper";

import TreatmentPhotosModal from "../modals/TreatmentPhotosModal";
import PhotoViewerModal from "../modals/PhotoViewerModal";
import "../modals/AnalysisOverviewModal.css";
import "./TreatmentRecommenderByTreatment.css";

/** Biostimulants before/after image for the treatment card. */
import biostimulantsBeforeAfterUrl from "../../assets/images/Biostimulators-Before-and-After-With-Pictures-1.webp";

/** Show the Checkout button in the plan sidebar. Enabled in local/dev (npm run dev); hidden in production. */
const SHOW_CHECKOUT_BUTTON = import.meta.env.DEV;

/** Product / type string used with {@link getQuantityContext} (matches checkout labeling). */
function treatmentProductHintForQuantity(row: {
  treatment: string;
  skincareWhat?: string[];
  skincareCategoryFilter?: string[];
  laserWhat?: string[];
  biostimulantWhat?: string[];
  microneedlingType?: string[];
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
    t === "Chemical Peel"
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
    when: TIMELINE_OPTIONS[0],
    detailsExpanded: true,
    product: "",
    notes: "",
    deliveryForm: wellnestOffering ? wellnestDefaultDeliveryForm : "",
    dosing: wellnestOffering ? wellnestDefaultDosing : "",
    findings: [] as string[],
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
): { deliveryForm: string; dosing: string; freeNotes: string } {
  if (!forWellnest) {
    return { deliveryForm: "", dosing: "", freeNotes: notes?.trim() ?? "" };
  }
  if (!notes?.trim()) {
    return { deliveryForm: "", dosing: "", freeNotes: "" };
  }
  const parts = notes
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  let deliveryForm = "";
  let dosing = "";
  const rest: string[] = [];
  for (const part of parts) {
    if (/^delivery form:/i.test(part)) {
      deliveryForm = part.replace(/^delivery form:\s*/i, "").trim();
    } else if (/^dosing:/i.test(part)) {
      dosing = part.replace(/^dosing:\s*/i, "").trim();
    } else {
      rest.push(part);
    }
  }
  return {
    deliveryForm,
    dosing,
    freeNotes: rest.join(" | "),
  };
}

function parseWhereFromDiscussedRegion(
  region: string,
  treatment: string,
): string[] {
  const raw = region.trim();
  if (!raw) return [];
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const opts: readonly string[] =
    treatment === "Microneedling"
      ? REGION_OPTIONS_MICRONEEDLING
      : treatment === "Chemical Peel"
        ? CHEMICAL_PEEL_AREA_OPTIONS
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

function matchProductTokensToOptionList(
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

  const productRaw = stripOptionalRecommenderPriceFromLabel(
    (item.product ?? "").trim(),
  );
  const isSkincare = treatment === "Skincare";
  const isLaser = isEnergyTreatmentCategory(treatment);

  let where = base.where;
  if (!isSkincare && !isLaser) {
    where = parseWhereFromDiscussedRegion(item.region ?? "", treatment);
  }

  let laserWhat = base.laserWhat;
  let biostimulantWhat = base.biostimulantWhat;
  let microneedlingType = base.microneedlingType;
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
    product: productFree,
    deliveryForm: wellnestOffering ? deliveryFormWellnest : undefined,
    dosing: wellnestOffering ? dosingWellnest : undefined,
  };
  const qtyTrim = (item.quantity ?? "").trim();
  const quantity =
    treatment === "Skincare"
      ? ""
      : qtyTrim ||
        getQuantityContext(treatment, treatmentProductHintForQuantity(hintRow))
          .defaultQuantity;

  return {
    ...base,
    when,
    where,
    laserWhat,
    biostimulantWhat,
    microneedlingType,
    skincareWhat,
    product: productFree,
    quantity,
    notes: parsedNotes.freeNotes,
    deliveryForm: wellnestOffering ? deliveryFormWellnest : base.deliveryForm,
    dosing: wellnestOffering ? dosingWellnest : base.dosing,
    detailsExpanded: true,
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

type WellnestGoalSignal = {
  score: number;
  matchedGoals: string[];
};

type WellnestBrowseFilterChip = {
  id: string;
  label: string;
  count: number;
};

const WELLNESS_TREATMENT_KEYWORDS_BY_ID: Record<string, string[]> =
  Object.fromEntries(
    WELLNESS_TREATMENTS.map((t) => [t.id, t.matchKeywords ?? []]),
  );
const WELLNESS_TREATMENT_SUMMARY_BY_ID: Record<string, string> =
  Object.fromEntries(WELLNESS_TREATMENTS.map((t) => [t.id, t.summary ?? ""]));
const WELLNEST_CASE_IMAGE_FALLBACK =
  "/post-visit-blueprint/videos/wellnest/images.jpeg";

function normalizeGoalToken(value: string): string {
  return value.trim().toLowerCase();
}

function expandGoalAliases(goal: string): string[] {
  const g = normalizeGoalToken(goal);
  const aliases: Record<string, string[]> = {
    recovery: ["recovery", "injury", "muscle", "mobility", "training"],
    "training support": ["training", "recovery", "muscle", "performance"],
    energy: ["energy", "fatigue", "metabolic"],
    sleep: ["sleep", "rest"],
    focus: ["focus", "memory", "cognitive", "brain fog"],
    longevity: ["longevity", "anti-aging", "cellular aging", "metabolism"],
    "stress balance": ["stress", "anxiety", "mood"],
    "body composition": ["body composition", "fat", "weight", "metabolic"],
    "metabolic support": [
      "metabolic",
      "fat metabolism",
      "weight",
      "visceral fat",
    ],
    gut: ["gut", "gi", "inflammation"],
    "gut comfort": ["gut", "gi", "inflammation"],
  };
  const mapped = aliases[g] ?? [];
  return Array.from(new Set([g, ...mapped]));
}

function scoreWellnestGoalMatch(
  goals: string[],
  treatmentCorpus: string,
  matchKeywords: string[],
): WellnestGoalSignal {
  const matchedGoals = new Set<string>();
  const normalizedCorpus = normalizeGoalToken(treatmentCorpus);
  const keywords = (matchKeywords ?? [])
    .map((k) => normalizeGoalToken(k))
    .filter((k) => k.length >= 3);
  let score = 0;
  for (const rawGoal of goals) {
    const goal = rawGoal.trim();
    const goalL = normalizeGoalToken(goal);
    if (!goalL) continue;
    const goalCandidates = expandGoalAliases(goal);
    let matched = false;
    for (const candidate of goalCandidates) {
      if (candidate.length >= 3 && normalizedCorpus.includes(candidate)) {
        score += 2;
        matched = true;
        break;
      }
      for (const kw of keywords) {
        if (
          candidate.includes(kw) ||
          kw.includes(candidate) ||
          candidate
            .split(/\s+/)
            .some((part) => part.length >= 3 && kw.includes(part))
        ) {
          score += 1;
          matched = true;
          break;
        }
      }
      if (matched) break;
    }
    if (matched) matchedGoals.add(goal);
  }
  return { score, matchedGoals: Array.from(matchedGoals) };
}

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
): { optionType: TreatmentRecommenderOptionType; title: string }[] {
  if (hasWellnestOffering) {
    return [];
  }
  if (treatment === "Skincare") {
    return [{ optionType: "skincare_what", title: "Skincare — Products" }];
  }
  if (isEnergyTreatmentCategory(treatment)) {
    return [{ optionType: "laser_what", title: "Energy Treatment — Type" }];
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
  } else if (treatment === "Biostimulants") {
    mid.push(
      { optionType: "biostimulant_what", title: "Biostimulants — Product" },
      { optionType: "where", title: "Biostimulants — Where" },
    );
  } else {
    mid.push({ optionType: "where", title: `${treatment} — Where` });
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

/**
 * Full catalog of recommender defaults to upsert via seed (server skips existing rows).
 * Keeps Airtable aligned with in-app chips so every option has a record id when possible.
 */
function buildTreatmentRecommenderSeedOptionsForProvider(
  providerCode: string | undefined,
  priceList?: ProviderPricingJson,
): Array<{ optionType: TreatmentRecommenderOptionType; value: string }> {
  const skincareNames = getSkincareCarouselItems().map((i) => i.name);
  const baseWhere = REGION_OPTIONS.filter(
    (r) => r !== "Multiple" && r !== "Other",
  );
  const laserList = getTreatmentProductOptionsForProvider(
    providerCode,
    ENERGY_TREATMENT_CATEGORY,
  );
  const biostimulantTypeLabels = [
    ...getBiostimulantTypeOptionLabels(priceList),
    OTHER_PRODUCT_LABEL,
  ];
  const fillerSkus = getSkuOptionsForCategory("Filler", priceList);
  const neurotoxinTypeLabels = [
    ...getNeurotoxinTypeOptionLabels(priceList),
    OTHER_PRODUCT_LABEL,
  ];
  const chemPeelTypes = getTreatmentProductOptionsForProvider(
    providerCode,
    "Chemical Peel",
  ).filter((v) => v !== OTHER_PRODUCT_LABEL);
  return [
    ...baseWhere.map((v) => ({ optionType: "where" as const, value: v })),
    ...skincareNames.map((v) => ({
      optionType: "skincare_what" as const,
      value: v,
    })),
    ...laserList.map((v) => ({ optionType: "laser_what" as const, value: v })),
    ...biostimulantTypeLabels.map((v) => ({
      optionType: "biostimulant_what" as const,
      value: v,
    })),
    ...REGION_OPTIONS_MICRONEEDLING.map((v) => ({
      optionType: "microneedling_where" as const,
      value: v,
    })),
    ...MICRONEEDLING_TYPE_OPTIONS.map((v) => ({
      optionType: "microneedling_type" as const,
      value: v,
    })),
    ...CHEMICAL_PEEL_AREA_OPTIONS.map((v) => ({
      optionType: "chemical_peel_where" as const,
      value: v,
    })),
    ...fillerSkus.map((s) => ({
      optionType: "filler_what" as const,
      value: s.label,
    })),
    ...neurotoxinTypeLabels.map((v) => ({
      optionType: "neurotoxin_what" as const,
      value: v,
    })),
    ...chemPeelTypes.map((v) => ({
      optionType: "chemical_peel_what" as const,
      value: v,
    })),
    ...TIMELINE_OPTIONS.map((v) => ({
      optionType: "timeline" as const,
      value: v,
    })),
  ];
}

type SkincareCarouselRow = ReturnType<typeof getSkincareCarouselItems>[number];

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

export interface TreatmentRecommenderByTreatmentProps {
  client: Client;
  onBack: () => void;
  onUpdate?: () => void | Promise<void>;
  /** Add item directly to plan and show success. Returns the new item for immediate UI. */
  onAddToPlanDirect?: (
    prefill: TreatmentPlanPrefill,
    options?: TreatmentPlanAddDirectOptions,
  ) => Promise<DiscussedItem | void> | void;
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
}

export default function TreatmentRecommenderByTreatment({
  client,
  onBack: _onBack,
  onUpdate,
  onAddToPlanDirect,
  onOpenCheckout,
  onRemovePlanItem,
  onUpdatePlanItem,
  onRecommenderRegionsChange,
  onShareTreatmentPlan,
}: TreatmentRecommenderByTreatmentProps) {
  const { provider } = useDashboard();

  const effectivePriceList = useMemo(
    () =>
      getEffectivePriceList(
        provider?.["Treatment Pricing"] as string | undefined,
      ),
    [provider],
  );

  /** All options (defaults + custom) from Treatment Recommender Options table; used so providers can remove any option. */
  const [optionRecords, setOptionRecords] = useState<
    TreatmentRecommenderCustomOption[]
  >([]);
  /** Bump to refetch options after add/delete. */
  const [optionRecordsVersion, setOptionRecordsVersion] = useState(0);
  /** Item we just added so we can open it for editing when user clicks "Add additional details". Cleared when modal closes. */
  const [lastAddedItem, setLastAddedItem] = useState<DiscussedItem | null>(
    null,
  );
  const [filterState, setFilterState] =
    useState<TreatmentRecommenderFilterState>(() => ({
      ...DEFAULT_RECOMMENDER_FILTER_STATE,
    }));

  useEffect(() => {
    onRecommenderRegionsChange?.(filterState.region);
  }, [filterState.region, onRecommenderRegionsChange]);

  const [addToPlanForTreatment, setAddToPlanForTreatment] = useState<{
    treatment: string;
    where: string[];
    /** For Skincare: multi-select "What" options (product names). */
    skincareWhat?: string[];
    /** For Skincare: selected category labels to filter the product carousel. */
    skincareCategoryFilter?: string[];
    /** For Energy Treatment: multi-select Type options (e.g. BBL, Moxi, Sofwave, Ultherapy). */
    laserWhat?: string[];
    /** For Biostimulants: multi-select "What" options (e.g. Sculptra, Radiesse, Ellansé). */
    biostimulantWhat?: string[];
    /** For Microneedling: multi-select type options (e.g. PRP, TCA, TXA, PDGF, Subcision). */
    microneedlingType?: string[];
    when: string;
    detailsExpanded: boolean;
    product?: string;
    quantity?: string;
    notes?: string;
    dosing?: string;
    deliveryForm?: string;
    /** Assessment findings (same as main plan modal “To address”). */
    findings: string[];
  } | null>(null);
  /** When set, Confirm saves via {@link onUpdatePlanItem} instead of adding a row. */
  const [editingPlanItemId, setEditingPlanItemId] = useState<string | null>(
    null,
  );
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
    if (!id?.trim()) return;
    void deleteTreatmentRecommenderOption(id.trim())
      .then(() => setOptionRecordsVersion((v) => v + 1))
      .catch(() => {});
  }, []);

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
  } | null>(null);
  /** Full-screen educational overlay for Wellnest peptide cards (no aesthetic before/after gallery). */
  const [wellnestDetailTreatment, setWellnestDetailTreatment] = useState<
    string | null
  >(null);
  const [showWellnestArticleShare, setShowWellnestArticleShare] =
    useState(false);
  const [wellnestBrowseFilter, setWellnestBrowseFilter] = useState("all");
  const [wellnestDeliveryFilter, setWellnestDeliveryFilter] =
    useState<string>("all");
  const [wellnestPriceFilter, setWellnestPriceFilter] = useState<string>("all");
  const [treatmentSearchQuery, setTreatmentSearchQuery] = useState("");
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

  const getWellnestGoalSignalForTreatment = (treatmentName: string) => {
    const wellnestOffering = getWellnestOfferingByTreatmentName(treatmentName);
    if (!wellnestOffering || wellnessIntakeGoals.length === 0) return null;
    return scoreWellnestGoalMatch(
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
          setFrontPhotoUrl((prev) => prev ?? getUrl(front[0]) ?? null);
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

  useEffect(() => {
    if (!provider?.id) return;
    let mounted = true;
    fetchTreatmentRecommenderCustomOptions(provider.id)
      .then(async (list) => {
        if (!mounted) return;
        const seedOptions = buildTreatmentRecommenderSeedOptionsForProvider(
          provider?.code,
          effectivePriceList,
        );
        try {
          await seedTreatmentRecommenderOptions(provider.id, seedOptions);
          if (!mounted) return;
          const refetched = await fetchTreatmentRecommenderCustomOptions(
            provider.id,
          );
          if (!mounted) return;
          setOptionRecords(refetched);
        } catch {
          if (!mounted) return;
          setOptionRecords(list);
        }
      })
      .catch(() => setOptionRecords([]));
    return () => {
      mounted = false;
    };
  }, [provider?.id, optionRecordsVersion, effectivePriceList]);

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
    () =>
      whereOptionRecordsDeduped.length > 0
        ? whereOptionRecordsDeduped.map((o) => o.value)
        : baseWhereOptions,
    [whereOptionRecordsDeduped, baseWhereOptions],
  );

  const skincareCarouselItems = useMemo(() => getSkincareCarouselItems(), []);
  const skincareWhatOptionRecords = useMemo(
    () => optionRecords.filter((o) => o.optionType === "skincare_what"),
    [optionRecords],
  );
  const skincareWhatOptions = useMemo(
    () =>
      skincareWhatOptionRecords.length > 0
        ? skincareWhatOptionRecords.map((o) => o.value)
        : skincareCarouselItems.map((i) => i.name),
    [skincareWhatOptionRecords, skincareCarouselItems],
  );
  /** Carousel items allowed by provider (from table when seeded, or full list when not yet). */
  const skincareCarouselItemsAllowed = useMemo(() => {
    const set = new Set(skincareWhatOptions);
    return skincareCarouselItems.filter((item) => set.has(item.name));
  }, [skincareCarouselItems, skincareWhatOptions]);

  /** Same merge as product chips: catalog ∪ custom `skincare_what` rows (for unified edit modal). */
  const skincareWhatDisplayRecords = useMemo(() => {
    const valueToId = new Map(
      skincareWhatOptionRecords.map((r) => [r.value, r.id]),
    );
    return skincareWhatOptions.map((value) => ({
      id: valueToId.get(value) ?? "",
      value,
    }));
  }, [skincareWhatOptions, skincareWhatOptionRecords]);

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
      getTreatmentProductOptionsForProvider(provider?.code, ENERGY_TREATMENT_CATEGORY),
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
    return ordered.map((value) => ({
      id: valueToId.get(value) ?? "",
      value,
    }));
  }, [laserWhatOptionRecords, laserWhatOptions]);

  const biostimulantWhatOptionRecords = useMemo(
    () => optionRecords.filter((o) => o.optionType === "biostimulant_what"),
    [optionRecords],
  );
  const biostimulantTypeBaseLabels = useMemo(
    () => [
      ...getBiostimulantTypeOptionLabels(effectivePriceList),
      OTHER_PRODUCT_LABEL,
    ],
    [effectivePriceList],
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
    return ordered.map((value) => ({
      id: valueToId.get(value) ?? "",
      value,
    }));
  }, [biostimulantWhatOptionRecords, biostimulantTypeBaseLabels]);
  const fillerSkuOptions = useMemo(
    () => getSkuOptionsForCategory("Filler", effectivePriceList).map((s) => s.label),
    [effectivePriceList],
  );
  const neurotoxinTypeBaseLabels = useMemo(
    () => [
      ...getNeurotoxinTypeOptionLabels(effectivePriceList),
      OTHER_PRODUCT_LABEL,
    ],
    [effectivePriceList],
  );
  const chemicalPeelTypeOptions = useMemo(
    () =>
      getTreatmentProductOptionsForProvider(
        provider?.code,
        "Chemical Peel",
      ).filter((v) => v !== OTHER_PRODUCT_LABEL),
    [provider?.code],
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
    return ordered.map((value) => ({
      id: valueToId.get(value) ?? "",
      value,
    }));
  }, [microneedlingWhereOptionRecords, baseMicroneedlingWhere]);

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
    return ordered.map((value) => ({
      id: valueToId.get(value) ?? "",
      value,
    }));
  }, [microneedlingTypeOptionRecords, baseMicroneedlingTypes]);

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
    return ordered.map((value) => ({
      id: valueToId.get(value) ?? "",
      value,
    }));
  }, [chemicalPeelWhereOptionRecords, baseChemicalPeelWhere]);

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
    return ordered.map((value) => ({
      id: valueToId.get(value) ?? "",
      value,
    }));
  }, [timelineOptionRecords]);

  const genericWhereDisplayRecords = useMemo(() => {
    const valueToId = new Map(
      whereOptionRecordsDeduped.map((r) => [r.value, r.id]),
    );
    return whereOptions.map((value) => ({
      id: valueToId.get(value) ?? "",
      value,
    }));
  }, [whereOptions, whereOptionRecordsDeduped]);

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
    return ordered.map((value) => ({
      id: valueToId.get(value) ?? "",
      value,
    }));
  }, [fillerSkuOptions, fillerWhatOptionRecords]);

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
    return ordered.map((value) => ({
      id: valueToId.get(value) ?? "",
      value,
    }));
  }, [neurotoxinTypeBaseLabels, neurotoxinWhatOptionRecords]);

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
    return ordered.map((value) => ({
      id: valueToId.get(value) ?? "",
      value,
    }));
  }, [chemicalPeelTypeOptions, chemicalPeelWhatOptionRecords]);

  const canEditRecommenderOptions = Boolean(provider?.id);

  const unifiedEditModalOffering = unifiedEditModalTreatment
    ? getWellnestOfferingByTreatmentName(unifiedEditModalTreatment)
    : null;
  const unifiedEditSections = useMemo(() => {
    if (!unifiedEditModalTreatment) return [];
    return getUnifiedRecommenderEditSections(
      unifiedEditModalTreatment,
      Boolean(unifiedEditModalOffering),
    );
  }, [unifiedEditModalTreatment, unifiedEditModalOffering]);

  /** Rows shown in add-to-plan chips (defaults ∪ Airtable) — unified edit uses the same list. */
  const getUnifiedEditSectionDisplayRecords = useCallback(
    (optionType: TreatmentRecommenderOptionType) => {
      switch (optionType) {
        case "skincare_what":
          return skincareWhatDisplayRecords;
        case "laser_what":
          return laserWhatDisplayRecords;
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
      biostimulantDisplayRecords,
      microneedlingTypeDisplayRecords,
      microneedlingWhereDisplayRecords,
      chemicalPeelWhereDisplayRecords,
      chemicalPeelTypeDisplayRecords,
      fillerTypeDisplayRecords,
      neurotoxinTypeDisplayRecords,
      genericWhereDisplayRecords,
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
    const allowedOrdered = getTreatmentOptionsForProvider(provider?.code);
    const withGoals = getSuggestedTreatmentsForFindings(
      combinedFindings,
      provider?.code,
    );
    const suggestedNames = Array.from(
      new Set(withGoals.map((s) => s.treatment)),
    );
    const seen = new Set<string>();
    const names: string[] = [];
    for (const t of suggestedNames) {
      if (allowedOrdered.includes(t) && !seen.has(t)) {
        seen.add(t);
        names.push(t);
      }
    }
    for (const t of allowedOrdered) {
      if (!seen.has(t)) {
        seen.add(t);
        names.push(t);
      }
    }
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
      isWellnestWellnessProviderCode(provider?.code) &&
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

  const wellnestBrowseChips = useMemo<WellnestBrowseFilterChip[]>(() => {
    if (!isWellnestWellnessProviderCode(provider?.code)) return [];
    const all = treatmentsToShow;
    const goalMatched = all.filter(
      (t) => (getWellnestGoalSignalForTreatment(t)?.score ?? 0) > 0,
    );
    const chips: WellnestBrowseFilterChip[] = [
      { id: "all", label: "All peptides", count: all.length },
      { id: "goal", label: "Goal matches", count: goalMatched.length },
    ];
    const byGroup = new Map<string, number>();
    for (const t of all) {
      const o = getWellnestOfferingByTreatmentName(t);
      if (!o) continue;
      const g = o.browseGroup;
      byGroup.set(g, (byGroup.get(g) ?? 0) + 1);
    }
    const ordered = WELLNEST_BROWSE_GROUP_ORDER as readonly string[];
    for (const gid of ordered) {
      const count = byGroup.get(gid);
      if (!count) continue;
      chips.push({
        id: `group:${gid}`,
        label: WELLNEST_BROWSE_GROUP_LABELS[gid] ?? gid,
        count,
      });
    }
    for (const [gid, count] of byGroup) {
      if (ordered.includes(gid)) continue;
      chips.push({
        id: `group:${gid}`,
        label: WELLNEST_BROWSE_GROUP_LABELS[gid] ?? gid,
        count,
      });
    }
    return chips;
  }, [provider?.code, treatmentsToShow, wellnessIntakeGoals]);

  const wellnestDeliveryFilterChips = useMemo<
    WellnestBrowseFilterChip[]
  >(() => {
    if (!isWellnestWellnessProviderCode(provider?.code)) return [];
    const all = treatmentsToShow;
    let nasal = 0;
    let oral = 0;
    let topical = 0;
    let multi = 0;
    for (const t of all) {
      const o = getWellnestOfferingByTreatmentName(t);
      if (!o) continue;
      if (wellnestDeliveryHasNasal(o.delivery)) nasal += 1;
      if (wellnestDeliveryHasOral(o.delivery)) oral += 1;
      if (wellnestDeliveryHasTopical(o.delivery)) topical += 1;
      if (getWellnestProductOptionsForTreatment(t).length >= 2) multi += 1;
    }
    const chips: WellnestBrowseFilterChip[] = [
      { id: "all", label: "Any delivery", count: all.length },
    ];
    if (nasal > 0)
      chips.push({ id: "nasal", label: "Nasal option", count: nasal });
    if (oral > 0) chips.push({ id: "oral", label: "Oral option", count: oral });
    if (topical > 0)
      chips.push({ id: "topical", label: "Topical / cream", count: topical });
    if (multi > 0)
      chips.push({ id: "multi", label: "Multiple routes", count: multi });
    return chips;
  }, [provider?.code, treatmentsToShow]);

  const wellnestPriceFilterChips = useMemo<WellnestBrowseFilterChip[]>(() => {
    if (!isWellnestWellnessProviderCode(provider?.code)) return [];
    const all = treatmentsToShow;
    let budget = 0;
    let mid = 0;
    let premium = 0;
    let variable = 0;
    for (const t of all) {
      const o = getWellnestOfferingByTreatmentName(t);
      if (!o) continue;
      const b = getWellnestPriceBand(o.pricing);
      if (b === "budget") budget += 1;
      else if (b === "mid") mid += 1;
      else if (b === "premium") premium += 1;
      else variable += 1;
    }
    const chips: WellnestBrowseFilterChip[] = [
      { id: "all", label: "Any price", count: all.length },
    ];
    if (budget > 0)
      chips.push({ id: "budget", label: "Under ~$300", count: budget });
    if (mid > 0) chips.push({ id: "mid", label: "$300–499", count: mid });
    if (premium > 0)
      chips.push({ id: "premium", label: "$500+", count: premium });
    if (variable > 0)
      chips.push({ id: "variable", label: "Variable / ask", count: variable });
    return chips;
  }, [provider?.code, treatmentsToShow]);

  const visibleTreatmentsToShow = useMemo(() => {
    if (!isWellnestWellnessProviderCode(provider?.code))
      return treatmentsToShow;

    let list = treatmentsToShow;

    if (wellnestBrowseFilter === "goal") {
      list = list.filter(
        (t) => (getWellnestGoalSignalForTreatment(t)?.score ?? 0) > 0,
      );
    } else if (wellnestBrowseFilter.startsWith("group:")) {
      const gid = wellnestBrowseFilter.slice(6);
      list = list.filter((t) => {
        const o = getWellnestOfferingByTreatmentName(t);
        return o?.browseGroup === gid;
      });
    }

    if (wellnestDeliveryFilter !== "all") {
      list = list.filter((t) => {
        const o = getWellnestOfferingByTreatmentName(t);
        if (!o) return true;
        const d = o.delivery;
        if (wellnestDeliveryFilter === "nasal")
          return wellnestDeliveryHasNasal(d);
        if (wellnestDeliveryFilter === "oral")
          return wellnestDeliveryHasOral(d);
        if (wellnestDeliveryFilter === "topical")
          return wellnestDeliveryHasTopical(d);
        if (wellnestDeliveryFilter === "multi")
          return getWellnestProductOptionsForTreatment(t).length >= 2;
        return true;
      });
    }

    if (wellnestPriceFilter !== "all") {
      list = list.filter((t) => {
        const o = getWellnestOfferingByTreatmentName(t);
        if (!o) return true;
        return getWellnestPriceBand(o.pricing) === wellnestPriceFilter;
      });
    }

    return list;
  }, [
    provider?.code,
    treatmentsToShow,
    wellnestBrowseFilter,
    wellnestDeliveryFilter,
    wellnestPriceFilter,
    wellnessIntakeGoals,
  ]);

  const searchedTreatmentsToShow = useMemo(() => {
    const q = treatmentSearchQuery.trim().toLowerCase();
    if (!q) return visibleTreatmentsToShow;
    return visibleTreatmentsToShow.filter((treatment) => {
      const wellnestOffering = getWellnestOfferingByTreatmentName(treatment);
      const groupLabel = wellnestOffering?.browseGroup
        ? (WELLNEST_BROWSE_GROUP_LABELS[wellnestOffering.browseGroup] ?? "")
        : "";
      const haystack = [
        treatment,
        wellnestOffering?.category ?? "",
        groupLabel,
        wellnestOffering?.browseGroup ?? "",
        wellnestOffering?.addresses ?? "",
        wellnestOffering?.demographics ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [visibleTreatmentsToShow, treatmentSearchQuery]);

  useEffect(() => {
    setWellnestBrowseFilter("all");
    setWellnestDeliveryFilter("all");
    setWellnestPriceFilter("all");
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
      return {
        ...initialAddToPlanRowForTreatment(
          treatment,
          wellnestOffering,
          deliveryForm,
          dosing,
        ),
        detailsExpanded: true,
      };
    });
  }, [onAddToPlanDirect]);

  const handleAddToPlanConfirm = async () => {
    if (!addToPlanForTreatment) return;
    if (editingPlanItemId && !onUpdatePlanItem) return;
    const isSkincare = addToPlanForTreatment.treatment === "Skincare";
    const isLaser = isEnergyTreatmentCategory(addToPlanForTreatment.treatment);
    const wellnestOffering = getWellnestOfferingByTreatmentName(
      addToPlanForTreatment.treatment,
    );
    const region =
      isSkincare || isLaser
        ? ""
        : addToPlanForTreatment.where.length > 0
          ? addToPlanForTreatment.where.join(", ")
          : "";
    const treatmentProduct = treatmentProductHintForQuantity(
      addToPlanForTreatment,
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
    const patch: Partial<DiscussedItem> = {
      region: region || undefined,
      treatment: addToPlanForTreatment.treatment,
      timeline: addToPlanForTreatment.when,
      product: treatmentProduct?.trim() || undefined,
      quantity: addToPlanForTreatment.quantity?.trim() || undefined,
      notes: notesJoined,
      findings: findingsForItem?.length ? findingsForItem : [],
    };
    try {
      if (editingPlanItemId && onUpdatePlanItem) {
        await onUpdatePlanItem(editingPlanItemId, patch);
        setEditingPlanItemId(null);
        setAddToPlanForTreatment(null);
      } else {
        if (!onAddToPlanDirect) return;
        const skincareProductNames = isSkincare
          ? (addToPlanForTreatment.skincareWhat ?? [])
              .map((n) => n.trim())
              .filter(Boolean)
          : [];

        if (skincareProductNames.length > 1) {
          let lastNew: DiscussedItem | undefined;
          for (const productName of skincareProductNames) {
            const prefill: TreatmentPlanPrefill = {
              interest: "",
              region,
              treatment: addToPlanForTreatment.treatment,
              timeline: addToPlanForTreatment.when,
              treatmentProduct: productName,
              quantity: addToPlanForTreatment.quantity?.trim() || undefined,
              notes: notesJoined,
              findings: findingsForItem?.length ? findingsForItem : undefined,
            };
            const result = await onAddToPlanDirect(prefill, {
              skipToast: true,
            });
            if (result) lastNew = result;
          }
          showToast(
            `${skincareProductNames.length} skincare products added to plan`,
          );
          setAddToPlanForTreatment(null);
          if (lastNew) setLastAddedItem(lastNew);
        } else {
          const prefill: TreatmentPlanPrefill = {
            interest: "",
            region,
            treatment: addToPlanForTreatment.treatment,
            timeline: addToPlanForTreatment.when,
            treatmentProduct,
            quantity: addToPlanForTreatment.quantity?.trim() || undefined,
            notes: notesJoined,
            findings: findingsForItem?.length ? findingsForItem : undefined,
          };
          const newItem = await onAddToPlanDirect(prefill);
          setAddToPlanForTreatment(null);
          if (newItem) setLastAddedItem(newItem);
        }
      }
    } catch {
      /* parent shows error */
    }
  };

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
    );
    if (qtyCtx.quantityControl === "text") return;
    const { options, defaultQuantity } = qtyCtx;
    const q = (addToPlanForTreatment.quantity ?? "").trim();
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
    addToPlanForTreatment?.deliveryForm,
    addToPlanForTreatment?.product,
    addToPlanForTreatment?.skincareWhat,
    addToPlanForTreatment?.skincareCategoryFilter,
    addToPlanForTreatment?.quantity,
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

  /** Plan items grouped by section (Skincare first when present, then Now, Add next visit, Wishlist, Completed). */
  const planItemsBySection = useMemo(() => {
    const items = client.discussedItems ?? [];
    const skincare: DiscussedItem[] = [];
    const now: DiscussedItem[] = [];
    const addNext: DiscussedItem[] = [];
    const wishlist: DiscussedItem[] = [];
    const completed: DiscussedItem[] = [];
    for (const item of items) {
      if (item.treatment?.trim() === "Skincare") {
        skincare.push(item);
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
    return {
      [SKINCARE_SECTION_LABEL]: skincare.sort(byProduct),
      Now: now.sort(byTreatment),
      "Add next visit": addNext.sort(byTreatment),
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
  const firstName = client.name?.trim().split(/\s+/)[0] || "Patient";

  return (
    <div className="treatment-recommender-by-treatment">
      <aside className="treatment-recommender-by-treatment__client-column">
        <div
          className={`treatment-recommender-by-treatment__client-photo-wrap ${currentClientPhotoUrl ? "treatment-recommender-by-treatment__client-photo-wrap--clickable" : ""}`}
          role={currentClientPhotoUrl ? "button" : undefined}
          tabIndex={currentClientPhotoUrl ? 0 : undefined}
          onClick={() => currentClientPhotoUrl && setShowClientPhotoModal(true)}
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

        <div className="treatment-recommender-by-treatment__plan-section">
          <div className="treatment-recommender-by-treatment__plan-title-row">
            <h3 className="treatment-recommender-by-treatment__plan-title">
              {firstName}&apos;s plan{" "}
              <span className="treatment-recommender-by-treatment__plan-item-count">
                ({planItemCount} {planItemCount === 1 ? "item" : "items"})
              </span>
            </h3>
            {onShareTreatmentPlan ? (
              <button
                type="button"
                className="treatment-recommender-by-treatment__plan-share-btn"
                onClick={() => onShareTreatmentPlan()}
              >
                Share
              </button>
            ) : null}
          </div>
          {planItemCount === 0 ? (
            <p className="treatment-recommender-by-treatment__plan-empty">
              No plan items yet.
            </p>
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
                    <h4 className="treatment-recommender-by-treatment__plan-group-title">
                      {sectionLabel}
                    </h4>
                    {sectionItems.map((item: DiscussedItem) => {
                      const planPrimary = getTreatmentPlanRowPrimaryLabel(item);
                      const planSecondary =
                        getTreatmentPlanRowSecondaryLabel(item);
                      const planFullLine = formatTreatmentPlanRowFullLine(item);
                      return (
                        <div
                          key={item.id}
                          className={`treatment-recommender-by-treatment__plan-row-wrap${
                            editingPlanItemId === item.id
                              ? " treatment-recommender-by-treatment__plan-row-wrap--editing"
                              : ""
                          }`}
                        >
                          {onUpdatePlanItem && onAddToPlanDirect ? (
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
                                  : "Click to edit on treatment card"
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
                              <span className="treatment-recommender-by-treatment__plan-row-treatment">
                                {planPrimary}
                              </span>
                              {planSecondary ? (
                                <span className="treatment-recommender-by-treatment__plan-row-meta">
                                  {planSecondary}
                                </span>
                              ) : null}
                            </button>
                          ) : (
                            <div
                              className="treatment-recommender-by-treatment__plan-row treatment-recommender-by-treatment__plan-row--readonly"
                              aria-label={`${planFullLine} on plan`}
                            >
                              <span className="treatment-recommender-by-treatment__plan-row-treatment">
                                {planPrimary}
                              </span>
                              {planSecondary ? (
                                <span className="treatment-recommender-by-treatment__plan-row-meta">
                                  {planSecondary}
                                </span>
                              ) : null}
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
          {SHOW_CHECKOUT_BUTTON && onOpenCheckout && (
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
          )}
        </div>
      </aside>

      <div className="treatment-recommender-by-treatment__main">
        <div className="treatment-recommender-by-treatment__body">
          <TreatmentRecommenderFilters
            state={filterState}
            onStateChange={(next) => setFilterState((s) => ({ ...s, ...next }))}
          />
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

          {wellnestBrowseChips.length > 0 && (
            <div
              className="treatment-recommender-wellnest-filters"
              role="region"
              aria-label="Peptide browse filters"
            >
              <div className="treatment-recommender-wellnest-filters__row">
                <span
                  className="treatment-recommender-wellnest-filters__label"
                  id="wellnest-filter-focus-label"
                >
                  Focus
                </span>
                <div
                  className="treatment-recommender-by-treatment__wellnest-browse-chips"
                  aria-labelledby="wellnest-filter-focus-label"
                >
                  {wellnestBrowseChips.map((chip) => {
                    const selected = wellnestBrowseFilter === chip.id;
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        className={`treatment-recommender-by-treatment__chip ${
                          selected
                            ? "treatment-recommender-by-treatment__chip--selected"
                            : ""
                        }`}
                        onClick={() => setWellnestBrowseFilter(chip.id)}
                      >
                        {chip.label}{" "}
                        <span className="treatment-recommender-wellnest-filters__count">
                          ({chip.count})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {wellnestDeliveryFilterChips.length > 1 && (
                <div className="treatment-recommender-wellnest-filters__row">
                  <span
                    className="treatment-recommender-wellnest-filters__label"
                    id="wellnest-filter-delivery-label"
                  >
                    Delivery
                  </span>
                  <div
                    className="treatment-recommender-by-treatment__wellnest-browse-chips"
                    aria-labelledby="wellnest-filter-delivery-label"
                  >
                    {wellnestDeliveryFilterChips.map((chip) => {
                      const selected = wellnestDeliveryFilter === chip.id;
                      return (
                        <button
                          key={`del-${chip.id}`}
                          type="button"
                          className={`treatment-recommender-by-treatment__chip treatment-recommender-by-treatment__chip--secondary ${
                            selected
                              ? "treatment-recommender-by-treatment__chip--selected"
                              : ""
                          }`}
                          onClick={() => setWellnestDeliveryFilter(chip.id)}
                        >
                          {chip.label}{" "}
                          <span className="treatment-recommender-wellnest-filters__count">
                            ({chip.count})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {wellnestPriceFilterChips.length > 1 && (
                <div className="treatment-recommender-wellnest-filters__row">
                  <span
                    className="treatment-recommender-wellnest-filters__label"
                    id="wellnest-filter-price-label"
                  >
                    Price band
                  </span>
                  <div
                    className="treatment-recommender-by-treatment__wellnest-browse-chips"
                    aria-labelledby="wellnest-filter-price-label"
                  >
                    {wellnestPriceFilterChips.map((chip) => {
                      const selected = wellnestPriceFilter === chip.id;
                      return (
                        <button
                          key={`price-${chip.id}`}
                          type="button"
                          className={`treatment-recommender-by-treatment__chip treatment-recommender-by-treatment__chip--secondary ${
                            selected
                              ? "treatment-recommender-by-treatment__chip--selected"
                              : ""
                          }`}
                          onClick={() => setWellnestPriceFilter(chip.id)}
                        >
                          {chip.label}{" "}
                          <span className="treatment-recommender-wellnest-filters__count">
                            ({chip.count})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          <h2 className="treatment-recommender-by-treatment__results-heading">
            {searchedTreatmentsToShow.length} treatment option
            {searchedTreatmentsToShow.length !== 1 ? "s" : ""}
          </h2>

          <div className="treatment-recommender-by-treatment__cards">
            {searchedTreatmentsToShow.length === 0 ? (
              <p className="treatment-recommender-by-treatment__empty">
                No treatments match your current filters/search.
              </p>
            ) : (
              searchedTreatmentsToShow.map((treatment) => {
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
                const wellnestAddressChips = wellnestOffering
                  ? parseWellnestWhatItAddressesChips(
                      wellnestOffering.addresses,
                    )
                  : [];
                const cardPhotos = getPhotosForTreatment(treatment);
                const cardPhoto = cardPhotos[0];
                const wellnestHeroUrl = wellnestOffering
                  ? getWellnestRecommenderImageUrl(treatment)
                  : null;
                const displayCardPhotoSrc =
                  wellnestHeroUrl ??
                  (cardPhoto
                    ? cardPhoto.thumbnailUrl || cardPhoto.photoUrl
                    : null);
                return (
                  <div
                    key={treatment}
                    id={
                      treatment === "Skincare"
                        ? "treatment-recommender-skincare-card"
                        : undefined
                    }
                    ref={(el) => {
                      cardRefsMap.current[treatment] = el;
                    }}
                    className="treatment-recommender-by-treatment__card"
                  >
                    <div className="treatment-recommender-by-treatment__card-top">
                      {(displayCardPhotoSrc ||
                        treatment === "Biostimulants") && (
                        <div
                          className={`treatment-recommender-by-treatment__card-photo-wrap${
                            wellnestOffering
                              ? " treatment-recommender-by-treatment__card-photo-wrap--wellnest"
                              : ""
                          }`}
                        >
                          {displayCardPhotoSrc ? (
                            <img
                              src={displayCardPhotoSrc}
                              alt=""
                              className="treatment-recommender-by-treatment__card-photo"
                            />
                          ) : (
                            <img
                              src={biostimulantsBeforeAfterUrl}
                              alt="Biostimulants before and after"
                              className="treatment-recommender-by-treatment__card-photo"
                            />
                          )}
                        </div>
                      )}
                      <div className="treatment-recommender-by-treatment__card-head">
                        <div className="treatment-recommender-by-treatment__card-title-row">
                          <h2 className="treatment-recommender-by-treatment__card-title">
                            {treatment}
                          </h2>
                          <button
                            type="button"
                            className="treatment-recommender-by-treatment__examples-eye-btn"
                            onClick={() =>
                              wellnestOffering
                                ? setWellnestDetailTreatment(treatment)
                                : setPhotoExplorerContext({
                                    treatment,
                                    region:
                                      filterState.region.length > 0
                                        ? getInternalRegionForFilter(
                                            filterState.region[0],
                                          )
                                        : undefined,
                                  })
                            }
                            title={
                              wellnestOffering
                                ? "Overview and examples"
                                : "View examples"
                            }
                            aria-label={
                              wellnestOffering
                                ? "Overview and examples"
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
                          {wellnestAddressChips.map((chipLabel, chipIdx) => (
                            <span
                              key={`wellnest-addr-${treatment}-${chipIdx}`}
                              className="treatment-recommender-wellnest-card__chip treatment-recommender-wellnest-card__chip--addresses"
                              title="What it addresses (Dr Reddy treatment offerings)"
                            >
                              {chipLabel}
                            </span>
                          ))}
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
                            {treatment !== "Skincare" && !wellnestOffering && (
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
                                    !isEnergyTreatmentCategory(treatment) &&
                                    addToPlanForTreatment.where
                                      .filter((w) =>
                                        treatment === "Microneedling"
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
                            {(treatment === "Filler" ||
                              treatment === "Neurotoxin" ||
                              treatment === "Chemical Peel") && (
                              <div className="treatment-recommender-by-treatment__add-row">
                                <span className="treatment-recommender-by-treatment__add-row-label">
                                  Type:
                                </span>
                                <div className="treatment-recommender-by-treatment__chips">
                                  {(treatment === "Filler"
                                    ? fillerTypeDisplayRecords
                                    : treatment === "Neurotoxin"
                                      ? neurotoxinTypeDisplayRecords
                                      : chemicalPeelTypeDisplayRecords
                                  ).map((rec, prodIdx) => {
                                    const opt = rec.value;
                                    const selected =
                                      (addToPlanForTreatment.product ?? "") ===
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
                                          setAddToPlanForTreatment((prev) =>
                                            prev
                                              ? {
                                                  ...prev,
                                                  product: selected ? "" : opt,
                                                }
                                              : null,
                                          )
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
                            <div className="treatment-recommender-by-treatment__add-row">
                              <span>When:</span>
                              <div className="treatment-recommender-by-treatment__chips">
                                {timelineDisplayRecords
                                  .filter((rec) => rec.value !== "Completed")
                                  .map((rec) => {
                                    const t = rec.value;
                                    return (
                                      <button
                                        key={
                                          rec.id
                                            ? `${rec.id}-${t}`
                                            : `when-${t}`
                                        }
                                        type="button"
                                        className={`treatment-recommender-by-treatment__chip ${
                                          addToPlanForTreatment.when === t
                                            ? "treatment-recommender-by-treatment__chip--selected"
                                            : ""
                                        }`}
                                        onClick={() =>
                                          setAddToPlanForTreatment((prev) =>
                                            prev ? { ...prev, when: t } : null,
                                          )
                                        }
                                      >
                                        {t}
                                      </button>
                                    );
                                  })}
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
                                );
                                return (
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
                                        placeholder={qtyCtx.defaultQuantity}
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
                                );
                              })()}
                            <details
                              className="treatment-recommender-by-treatment__details"
                              open={addToPlanForTreatment.detailsExpanded}
                              onToggle={(e) => {
                                const el =
                                  e.currentTarget as HTMLDetailsElement | null;
                                if (!el) return;
                                const nextOpen = el.open;
                                setAddToPlanForTreatment((prev) =>
                                  prev
                                    ? { ...prev, detailsExpanded: nextOpen }
                                    : null,
                                );
                              }}
                            >
                              <summary className="treatment-recommender-by-treatment__details-summary">
                                Optional details
                              </summary>
                              <div className="treatment-recommender-by-treatment__details-fields">
                                <div className="treatment-recommender-by-treatment__details-fields-nest">
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
                                    <details className="treatment-recommender-by-treatment__to-address treatment-recommender-by-treatment__to-address-details">
                                      <summary className="treatment-recommender-by-treatment__to-address-summary">
                                        <span className="treatment-recommender-by-treatment__to-address-summary-label">
                                          Concerns to address
                                        </span>
                                        {selected.length > 0 ? (
                                          <span className="treatment-recommender-by-treatment__to-address-summary-meta">
                                            {" "}
                                            · {selected.length} selected
                                          </span>
                                        ) : null}
                                      </summary>
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
                                    </details>
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
                                      );
                                      return (
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
                                                qtyCtx.defaultQuantity
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
                                      );
                                    })()
                                  : null}
                                {wellnestOffering && (
                                  <>
                                    <label className="treatment-recommender-by-treatment__details-label">
                                      Delivery form
                                      <select
                                        className="treatment-recommender-by-treatment__details-input"
                                        value={
                                          addToPlanForTreatment.deliveryForm ??
                                          ""
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
                                        value={
                                          addToPlanForTreatment.dosing ?? ""
                                        }
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
                                  </>
                                )}
                                {!wellnestOffering &&
                                  !treatmentUsesStructuredProductSelectors(
                                    addToPlanForTreatment.treatment,
                                  ) && (
                                    <label className="treatment-recommender-by-treatment__details-label">
                                      Product
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
                                      />
                                    </label>
                                  )}
                                <label className="treatment-recommender-by-treatment__details-label">
                                  Notes
                                  <textarea
                                    className="treatment-recommender-by-treatment__details-textarea"
                                    placeholder="Optional notes"
                                    rows={2}
                                    value={addToPlanForTreatment.notes ?? ""}
                                    onChange={(e) =>
                                      setAddToPlanForTreatment((prev) =>
                                        prev
                                          ? { ...prev, notes: e.target.value }
                                          : null,
                                      )
                                    }
                                  />
                                </label>
                                </div>
                              </div>
                            </details>
                            <div className="treatment-recommender-by-treatment__add-actions">
                              <button
                                type="button"
                                className="treatment-recommender-by-treatment__add-btn"
                                onClick={handleAddToPlanConfirm}
                              >
                                {editingPlanItemId ? "Save changes" : "Confirm"}
                              </button>
                              <button
                                type="button"
                                className="treatment-recommender-by-treatment__cancel-btn"
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
                  if (!val) return;
                  createTreatmentRecommenderCustomOption(
                    provider.id,
                    section.optionType,
                    val,
                  )
                    .then(() => {
                      setOptionRecordsVersion((v) => v + 1);
                      closeComposer();
                    })
                    .catch(() => showToast("Could not add"));
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
                        {sectionRows.map((rec) => {
                          const rowMatKey = `${section.optionType}\u001f${rec.value}`;
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
                                      {stripOptionalRecommenderPriceFromLabel(
                                        rec.value,
                                      )}
                                    </span>
                                  </div>
                                  <div className="treatment-recommender-by-treatment__unified-edit-item-trailing">
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
                                        createTreatmentRecommenderCustomOption(
                                          provider.id,
                                          section.optionType,
                                          rec.value,
                                        )
                                          .then((created) => {
                                            if (
                                              unifiedEditMaterializeAbortRef.current
                                            ) {
                                              unifiedEditMaterializeAbortRef.current = false;
                                              void deleteTreatmentRecommenderOption(
                                                created.id,
                                              )
                                                .then(() =>
                                                  setOptionRecordsVersion(
                                                    (v) => v + 1,
                                                  ),
                                                )
                                                .catch(() => {});
                                              return;
                                            }
                                            setOptionRecords((prev) =>
                                              prev.some(
                                                (o) => o.id === created.id,
                                              )
                                                ? prev
                                                : [...prev, created],
                                            );
                                            setOptionRecordsVersion(
                                              (v) => v + 1,
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
                                        updateTreatmentRecommenderOption(
                                          rec.id,
                                          editingValue,
                                        )
                                          .then(() => {
                                            unifiedEditDraftRecordIdRef.current =
                                              null;
                                            setOptionRecordsVersion(
                                              (v) => v + 1,
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
                                    onClick={() =>
                                      updateTreatmentRecommenderOption(
                                        rec.id,
                                        editingValue,
                                      )
                                        .then(() => {
                                          unifiedEditDraftRecordIdRef.current =
                                            null;
                                          setOptionRecordsVersion((v) => v + 1);
                                          setEditingRecordId(null);
                                          setEditingValue("");
                                        })
                                        .catch(() =>
                                          showToast("Could not update"),
                                        )
                                    }
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
                                      {stripOptionalRecommenderPriceFromLabel(
                                        rec.value,
                                      )}
                                    </span>
                                  </div>
                                  <div className="treatment-recommender-by-treatment__unified-edit-item-trailing">
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
                                      onClick={() =>
                                        deleteTreatmentRecommenderOption(rec.id)
                                          .then(() =>
                                            setOptionRecordsVersion(
                                              (v) => v + 1,
                                            ),
                                          )
                                          .catch(() =>
                                            showToast("Could not remove"),
                                          )
                                      }
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
    </div>
  );
}
