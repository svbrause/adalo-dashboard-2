/**
 * Treatment Recommender – by treatment.
 * Full-width treatment cards with feature breakdown and Add to plan.
 */

import { useMemo, useState, useEffect, useRef } from "react";
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
  getTreatmentDisplayName,
  formatTreatmentPlanRecordMetaLine,
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
  OTHER_PRODUCT_LABEL,
  SKINCARE_CATEGORY_OPTIONS,
} from "../modals/DiscussedTreatmentsModal/constants";
import {
  GEMSTONE_BY_SKIN_TYPE,
  RECOMMENDED_PRODUCT_REASONS,
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
import type { TreatmentPlanPrefill } from "../modals/DiscussedTreatmentsModal/TreatmentPhotos";
import { WELLNEST_CURATED_BLUEPRINT_CASES } from "../../data/wellnestCuratedBlueprintCases";
import {
  photoMatchesPlanTreatment,
  type BlueprintCasePhoto,
} from "../../utils/postVisitBlueprintCases";
import TreatmentRecommenderFilters from "./TreatmentRecommenderFilters";

import TreatmentPhotosModal from "../modals/TreatmentPhotosModal";
import PhotoViewerModal from "../modals/PhotoViewerModal";
import "../modals/AnalysisOverviewModal.css";
import "./TreatmentRecommenderByTreatment.css";

/** Biostimulants before/after image for the treatment card. */
import biostimulantsBeforeAfterUrl from "../../assets/images/Biostimulators-Before-and-After-With-Pictures-1.webp";

/** Show the Checkout button in the plan sidebar. Enabled in local/dev (npm run dev); hidden in production. */
const SHOW_CHECKOUT_BUTTON = import.meta.env.DEV;

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

/** Treatment name aliases: e.g. photos tagged "Laser" in the API should match dashboard category "Energy Device". */
const TREATMENT_PHOTO_ALIASES: Record<string, string[]> = {
  "Energy Device": ["laser", "energy device"],
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
    return termsToMatch.some((term) => gLower.includes(term) || term.includes(gLower));
  });
  const inSpecific = (photo.treatments || []).some((s) => {
    const sLower = String(s).toLowerCase();
    return termsToMatch.some((term) => sLower.includes(term) || term.includes(sLower));
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
        {rows.map((row) => (
          <FeatureBreakdownCircle
            key={row.label}
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
                      {goodIssues.map((issue) => (
                        <span
                          key={issue}
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
                      {badIssues.map((issue) => (
                        <span
                          key={issue}
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

const WELLNESS_TREATMENT_KEYWORDS_BY_ID: Record<string, string[]> = Object.fromEntries(
  WELLNESS_TREATMENTS.map((t) => [t.id, t.matchKeywords ?? []]),
);
const WELLNESS_TREATMENT_SUMMARY_BY_ID: Record<string, string> = Object.fromEntries(
  WELLNESS_TREATMENTS.map((t) => [t.id, t.summary ?? ""]),
);
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
    "metabolic support": ["metabolic", "fat metabolism", "weight", "visceral fat"],
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
    WELLNESS_TREATMENT_SUMMARY_BY_ID[offering.wellnessQuizId ?? ""]?.trim() ?? "";
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

export interface TreatmentRecommenderByTreatmentProps {
  client: Client;
  onBack: () => void;
  onUpdate?: () => void | Promise<void>;
  /** Add item directly to plan and show success; then user can click "Add additional details" to open the plan modal. Returns the new item so we can open it for editing. */
  onAddToPlanDirect?: (
    prefill: TreatmentPlanPrefill,
  ) => Promise<DiscussedItem | void> | void;
  /** Open the treatment plan modal (e.g. for "Add additional details"). */
  onOpenTreatmentPlan?: () => void;
  /** Open the checkout (price summary) modal. Shown next to Open treatment plan when plan has items. */
  onOpenCheckout?: () => void;
  /** Open the treatment plan modal with prefill (e.g. from View examples → Add to plan). */
  onOpenTreatmentPlanWithPrefill?: (prefill: TreatmentPlanPrefill) => void;
  /** Open the treatment plan modal with this item selected for editing ("Add additional details"). */
  onOpenTreatmentPlanWithItem?: (item: DiscussedItem) => void;
  /** Remove a plan item directly (e.g. from the left column X). Called with item id. */
  onRemovePlanItem?: (itemId: string) => void | Promise<void>;
  /** Ref set by parent; when treatment plan modal closes, parent will call this so we clear "just added" state. */
  treatmentPlanModalClosedRef?: React.MutableRefObject<(() => void) | null>;
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
  onOpenTreatmentPlan,
  onOpenCheckout,
  onOpenTreatmentPlanWithPrefill,
  onOpenTreatmentPlanWithItem,
  onRemovePlanItem,
  treatmentPlanModalClosedRef,
  onRecommenderRegionsChange,
  onShareTreatmentPlan,
}: TreatmentRecommenderByTreatmentProps) {
  const { provider } = useDashboard();
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
    /** For Energy Device: multi-select Type options (e.g. BBL, Moxi, Sofwave, Ultherapy). */
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
  } | null>(null);
  /** Notion-style: type to create a new option for Where/What. */
  /** When set, show the Edit options modal for this treatment/optionType (iPad-friendly add/remove/rename). */
  const [editOptionsContext, setEditOptionsContext] = useState<{
    treatment: string;
    optionType: TreatmentRecommenderOptionType;
  } | null>(null);
  /** In the Edit options modal: which record is being renamed (inline edit). */
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  /** In the Edit options modal: new option input for Add. */
  const [editModalNewOptionInput, setEditModalNewOptionInput] = useState("");
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
  /** Skincare recommendations section (quiz result + product cards) collapsed by default */
  const [
    skincareRecommendationsCollapsed,
    setSkincareRecommendationsCollapsed,
  ] = useState(true);
  /** Score breakdown (skin quiz bars) inside skincare section – collapsed by default */
  const [skincareScoreBreakdownCollapsed, setSkincareScoreBreakdownCollapsed] =
    useState(true);
  /** Refs to treatment cards for scroll-into-view when opening Add to plan from recommended section */
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
      WELLNESS_TREATMENT_KEYWORDS_BY_ID[wellnestOffering.wellnessQuizId ?? ""] ??
        [],
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
    if (!editOptionsContext) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editingRecordId) {
          setEditingRecordId(null);
          setEditingValue("");
        } else {
          setEditOptionsContext(null);
          setEditModalNewOptionInput("");
        }
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [editOptionsContext, editingRecordId]);

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
        if (list.length === 0) {
          const skincareNames = getSkincareCarouselItems().map((i) => i.name);
          const baseWhere = REGION_OPTIONS.filter(
            (r) => r !== "Multiple" && r !== "Other",
          );
          const laserList = getTreatmentProductOptionsForProvider(
            provider?.code,
            "Energy Device",
          );
          const biostimulantList =
            getTreatmentProductOptionsForProvider(
              provider?.code,
              "Biostimulants",
            ) ?? [];
          const seedOptions: Array<{
            optionType: TreatmentRecommenderOptionType;
            value: string;
          }> = [
            ...baseWhere.map((v) => ({
              optionType: "where" as const,
              value: v,
            })),
            ...skincareNames.map((v) => ({
              optionType: "skincare_what" as const,
              value: v,
            })),
            ...laserList.map((v) => ({
              optionType: "laser_what" as const,
              value: v,
            })),
            ...biostimulantList.map((v) => ({
              optionType: "biostimulant_what" as const,
              value: v,
            })),
          ];
          try {
            await seedTreatmentRecommenderOptions(provider.id, seedOptions);
            if (!mounted) return;
            const refetched = await fetchTreatmentRecommenderCustomOptions(
              provider.id,
            );
            setOptionRecords(refetched);
          } catch {
            setOptionRecords(list);
          }
          return;
        }
        setOptionRecords(list);
      })
      .catch(() => setOptionRecords([]));
    return () => {
      mounted = false;
    };
  }, [provider?.id, optionRecordsVersion]);

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

  /** Carousel items to show: allowed list; when categories selected, show those products plus any already-selected so selections don’t disappear. */
  const skincareCarouselItemsFiltered = useMemo(() => {
    const categoryFilter =
      addToPlanForTreatment?.treatment === "Skincare"
        ? addToPlanForTreatment.skincareCategoryFilter
        : undefined;
    const selectedNames = new Set(addToPlanForTreatment?.skincareWhat ?? []);
    if (!categoryFilter?.length) {
      // No category filter: show full allowed list (or full list if allowed is empty so carousel isn’t blank)
      const base =
        skincareCarouselItemsAllowed.length > 0
          ? skincareCarouselItemsAllowed
          : skincareCarouselItems;
      return base;
    }
    const productSet = new Set<string>();
    for (const label of categoryFilter) {
      const cat = SKINCARE_CATEGORY_OPTIONS.find((c) => c.label === label);
      if (cat) cat.products.forEach((p) => productSet.add(p));
    }
    const inCategory = skincareCarouselItemsAllowed.filter((item) =>
      productSet.has(item.name),
    );
    const selectedStillAllowed = skincareCarouselItemsAllowed.filter((item) =>
      selectedNames.has(item.name),
    );
    const combined = new Map<
      string,
      (typeof skincareCarouselItemsAllowed)[0]
    >();
    [...inCategory, ...selectedStillAllowed].forEach((item) =>
      combined.set(item.name, item),
    );
    return Array.from(combined.values());
  }, [
    skincareCarouselItemsAllowed,
    skincareCarouselItems,
    addToPlanForTreatment?.treatment,
    addToPlanForTreatment?.skincareCategoryFilter,
    addToPlanForTreatment?.skincareWhat,
  ]);

  const laserWhatOptionRecords = useMemo(
    () => optionRecords.filter((o) => o.optionType === "laser_what"),
    [optionRecords],
  );
  /** Energy Device types are always constrained to pricing-sheet options for the provider (prevents stale custom values like Picosure). */
  const laserWhatOptions = useMemo(
    () => getTreatmentProductOptionsForProvider(provider?.code, "Energy Device"),
    [provider?.code],
  );
  /** Records used for rendering Energy Device chips: only pricing-sheet values, with record id when available. */
  const laserWhatDisplayRecords = useMemo(() => {
    const valueToId = new Map(laserWhatOptionRecords.map((r) => [r.value, r.id]));
    return laserWhatOptions.map((value) => ({
      id: valueToId.get(value) ?? "",
      value,
    }));
  }, [laserWhatOptionRecords, laserWhatOptions]);

  const biostimulantWhatOptionRecords = useMemo(
    () => optionRecords.filter((o) => o.optionType === "biostimulant_what"),
    [optionRecords],
  );
  /** Biostimulants types are constrained to pricing-sheet options only (prevents stale values like Ellanse and duplicate variants). */
  const biostimulantWhatOptions = useMemo(
    () => getTreatmentProductOptionsForProvider(provider?.code, "Biostimulants"),
    [provider?.code],
  );
  /** Records used for rendering Biostimulants chips: only pricing-sheet values, with record id when available. */
  const biostimulantDisplayRecords = useMemo(() => {
    const valueToId = new Map(biostimulantWhatOptionRecords.map((r) => [r.value, r.id]));
    return biostimulantWhatOptions.map((value) => ({
      id: valueToId.get(value) ?? "",
      value,
    }));
  }, [biostimulantWhatOptionRecords, biostimulantWhatOptions]);
  const fillerTypeOptions = useMemo(
    () =>
      getTreatmentProductOptionsForProvider(provider?.code, "Filler").filter(
        (v) => v !== OTHER_PRODUCT_LABEL,
      ),
    [provider?.code],
  );
  const neurotoxinTypeOptions = useMemo(
    () =>
      getTreatmentProductOptionsForProvider(provider?.code, "Neurotoxin").filter(
        (v) => v !== OTHER_PRODUCT_LABEL,
      ),
    [provider?.code],
  );
  const chemicalPeelTypeOptions = useMemo(
    () =>
      getTreatmentProductOptionsForProvider(provider?.code, "Chemical Peel").filter(
        (v) => v !== OTHER_PRODUCT_LABEL,
      ),
    [provider?.code],
  );

  const optionsFromTable = optionRecords.length > 0;

  /** Option records for the current Edit options modal (by optionType). */
  const editOptionRecords = useMemo(() => {
    if (!editOptionsContext) return [];
    return optionRecords.filter(
      (o) => o.optionType === editOptionsContext.optionType,
    );
  }, [editOptionsContext, optionRecords]);

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
    const withGoals = getSuggestedTreatmentsForFindings(combinedFindings, provider?.code);
    let names = Array.from(new Set(withGoals.map((s) => s.treatment)));
    // When client has skin quiz recommendations, include Skincare so "Add to plan" from top section has a card to open
    const hasSkinQuizProducts =
      client.skincareQuiz?.recommendedProductNames &&
      client.skincareQuiz.recommendedProductNames.length > 0;
    if (hasSkinQuizProducts && !names.includes("Skincare")) {
      names = ["Skincare", ...names];
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

  /** Treatment cards to show: exclude Skincare from the list when client has completed the skin quiz (Skincare lives only in the collapsible recommendations block). */
  const treatmentsToShow = useMemo(() => {
    const hasCompletedSkinQuiz = Boolean(
      client.skincareQuiz?.completedAt ?? client.skincareQuiz?.result,
    );
    const base = hasCompletedSkinQuiz
      ? suggestedTreatments.filter((t) => t !== "Skincare")
      : suggestedTreatments;
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
  }, [
    suggestedTreatments,
    client.skincareQuiz?.completedAt,
    client.skincareQuiz?.result,
    provider?.code,
    wellnessIntakeGoals,
  ]);

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

  const wellnestDeliveryFilterChips = useMemo<WellnestBrowseFilterChip[]>(() => {
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
    if (nasal > 0) chips.push({ id: "nasal", label: "Nasal option", count: nasal });
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
    if (!isWellnestWellnessProviderCode(provider?.code)) return treatmentsToShow;

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
        if (wellnestDeliveryFilter === "oral") return wellnestDeliveryHasOral(d);
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
        ? WELLNEST_BROWSE_GROUP_LABELS[wellnestOffering.browseGroup] ?? ""
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

  /** Skincare product details for the recommendations section (same shape as quiz modal cards) */
  const skincareRecommendedWithDetails = useMemo(() => {
    const names = client.skincareQuiz?.recommendedProductNames ?? [];
    if (names.length === 0) return [];
    const carouselItems = getSkincareCarouselItems();
    return names.map((name) => {
      const item = carouselItems.find((p) => p.name === name);
      return {
        name,
        imageUrl: item?.imageUrl,
        productUrl: item?.productUrl,
        recommendedFor:
          RECOMMENDED_PRODUCT_REASONS[name] ?? "Recommended for your skin type",
        description: item?.description,
        price: item?.price,
        imageUrls: item?.imageUrls,
      };
    });
  }, [client.skincareQuiz?.recommendedProductNames]);

  const handleAddToPlanConfirm = async () => {
    if (!addToPlanForTreatment || !onAddToPlanDirect) return;
    const isSkincare = addToPlanForTreatment.treatment === "Skincare";
    const isLaser = addToPlanForTreatment.treatment === "Energy Device";
    const isBiostimulants = addToPlanForTreatment.treatment === "Biostimulants";
    const wellnestOffering = getWellnestOfferingByTreatmentName(
      addToPlanForTreatment.treatment,
    );
    const region =
      isSkincare || isLaser
        ? ""
        : addToPlanForTreatment.where.length > 0
          ? addToPlanForTreatment.where.join(", ")
          : "";
    const treatmentProduct = wellnestOffering
      ? addToPlanForTreatment.deliveryForm?.trim() ||
        addToPlanForTreatment.product?.trim() ||
        undefined
      : isSkincare
      ? addToPlanForTreatment.skincareWhat?.length
        ? addToPlanForTreatment.skincareWhat.join(", ")
        : addToPlanForTreatment.skincareCategoryFilter?.length
          ? addToPlanForTreatment.skincareCategoryFilter.join(", ")
          : addToPlanForTreatment.product?.trim() || undefined
      : isLaser
        ? addToPlanForTreatment.laserWhat?.length
          ? addToPlanForTreatment.laserWhat.join(", ")
          : addToPlanForTreatment.product?.trim() || undefined
        : isBiostimulants
          ? addToPlanForTreatment.biostimulantWhat?.length
            ? addToPlanForTreatment.biostimulantWhat.join(", ")
            : addToPlanForTreatment.product?.trim() || undefined
          : addToPlanForTreatment.treatment === "Microneedling"
            ? addToPlanForTreatment.microneedlingType?.length
              ? addToPlanForTreatment.microneedlingType.join(", ")
              : addToPlanForTreatment.product?.trim() || undefined
            : addToPlanForTreatment.product?.trim() || undefined;
    const noteParts: string[] = [];
    if (wellnestOffering && addToPlanForTreatment.deliveryForm?.trim()) {
      noteParts.push(`Delivery form: ${addToPlanForTreatment.deliveryForm.trim()}`);
    }
    if (wellnestOffering && addToPlanForTreatment.dosing?.trim()) {
      noteParts.push(`Dosing: ${addToPlanForTreatment.dosing.trim()}`);
    }
    if (addToPlanForTreatment.notes?.trim()) {
      noteParts.push(addToPlanForTreatment.notes.trim());
    }
    const prefill: TreatmentPlanPrefill = {
      interest: "",
      region,
      treatment: addToPlanForTreatment.treatment,
      timeline: addToPlanForTreatment.when,
      treatmentProduct,
      quantity: addToPlanForTreatment.quantity?.trim() || undefined,
      notes: noteParts.length > 0 ? noteParts.join(" | ") : undefined,
    };
    try {
      const newItem = await onAddToPlanDirect(prefill);
      setAddToPlanForTreatment(null);
      if (newItem) setLastAddedItem(newItem);
    } catch {
      /* parent shows error */
    }
  };

  /** Whether this treatment is already in the treatment plan (so we show "Added" and "Add additional details"). */
  const isTreatmentInPlan = (treatmentName: string): boolean => {
    if (lastAddedItem && lastAddedItem.treatment === treatmentName) return true;
    return (client.discussedItems ?? []).some(
      (i) => i.treatment === treatmentName,
    );
  };

  useEffect(() => {
    if (!treatmentPlanModalClosedRef) return;
    treatmentPlanModalClosedRef.current = () => setLastAddedItem(null);
    return () => {
      if (treatmentPlanModalClosedRef)
        treatmentPlanModalClosedRef.current = null;
    };
  }, [treatmentPlanModalClosedRef]);

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
              {firstName}&apos;s plan ({planItemCount}{" "}
              {planItemCount === 1 ? "item" : "items"})
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
                    {sectionItems.map((item: DiscussedItem) => (
                      <div
                        key={item.id}
                        className="treatment-recommender-by-treatment__plan-row-wrap"
                      >
                        <button
                          type="button"
                          className="treatment-recommender-by-treatment__plan-row"
                          disabled={!onOpenTreatmentPlanWithItem}
                          onClick={() => onOpenTreatmentPlanWithItem?.(item)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onOpenTreatmentPlanWithItem?.(item);
                            }
                          }}
                          aria-label={`Edit ${getTreatmentDisplayName(item)} in plan`}
                        >
                          <span className="treatment-recommender-by-treatment__plan-row-treatment">
                            {getTreatmentDisplayName(item)}
                          </span>
                          {formatTreatmentPlanRecordMetaLine(item) ? (
                            <span className="treatment-recommender-by-treatment__plan-row-meta">
                              {formatTreatmentPlanRecordMetaLine(item)}
                            </span>
                          ) : null}
                        </button>
                        {onRemovePlanItem && (
                          <button
                            type="button"
                            className="treatment-recommender-by-treatment__plan-row-remove"
                            onClick={(e) => {
                              e.stopPropagation();
                              const name = getTreatmentDisplayName(item);
                              const message = name
                                ? `Remove "${name}" from the treatment plan?`
                                : "Remove this item from the treatment plan?";
                              if (window.confirm(message)) {
                                onRemovePlanItem(item.id);
                              }
                            }}
                            aria-label={`Remove ${getTreatmentDisplayName(item)} from plan`}
                            title="Remove from plan"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
          {(onOpenTreatmentPlan ||
            (SHOW_CHECKOUT_BUTTON && onOpenCheckout)) && (
            <div className="treatment-recommender-by-treatment__plan-actions">
              {onOpenTreatmentPlan && (
                <button
                  type="button"
                  className="treatment-recommender-by-treatment__plan-open-btn"
                  onClick={() => onOpenTreatmentPlan()}
                >
                  Open treatment plan
                </button>
              )}
              {SHOW_CHECKOUT_BUTTON && onOpenCheckout && (
                <button
                  type="button"
                  className="treatment-recommender-by-treatment__plan-checkout-btn"
                  disabled={planItemCount === 0}
                  onClick={() => onOpenCheckout()}
                >
                  Quote
                </button>
              )}
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

          {client.skincareQuiz && (
            <div
              className={`treatment-recommender-skin-analysis treatment-recommender-skin-analysis--collapsible ${
                skincareRecommendationsCollapsed
                  ? "treatment-recommender-skin-analysis--collapsed"
                  : ""
              }`}
            >
              <button
                type="button"
                className="treatment-recommender-skin-analysis__header"
                onClick={() => setSkincareRecommendationsCollapsed((c) => !c)}
                aria-expanded={!skincareRecommendationsCollapsed}
              >
                <h3 className="treatment-recommender-skin-analysis__title">
                  Skincare recommendations
                </h3>
                {client.skincareQuiz?.completedAt && (
                  <span className="treatment-recommender-skin-analysis__completed">
                    <span className="treatment-recommender-skin-analysis__completed-prefix">
                      Quiz Completed{" "}
                    </span>
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
                  </span>
                )}
                <span
                  className="treatment-recommender-skin-analysis__toggle"
                  aria-hidden
                >
                  {skincareRecommendationsCollapsed ? "▼" : "▲"}
                </span>
              </button>
              {!skincareRecommendationsCollapsed && (
                <div className="treatment-recommender-skin-analysis__body">
                  {client.skincareQuiz?.answers &&
                    Object.keys(client.skincareQuiz.answers).length > 0 && (
                      <div className="treatment-recommender-skin-analysis__score-breakdown-block">
                        <div className="treatment-recommender-skin-analysis__score-breakdown-header">
                          <span className="treatment-recommender-skin-analysis__score-bars-title">
                            Score breakdown
                          </span>
                          <button
                            type="button"
                            className="treatment-recommender-skin-analysis__score-breakdown-toggle"
                            onClick={() =>
                              setSkincareScoreBreakdownCollapsed((c) => !c)
                            }
                            aria-expanded={!skincareScoreBreakdownCollapsed}
                          >
                            {skincareScoreBreakdownCollapsed ? "Show" : "Hide"}
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
                                    maxScore > 0 ? (value / maxScore) * 100 : 0;
                                  const isPrimary = false;
                                  const isSecondary = false;
                                  return (
                                    <div
                                      key={type}
                                      className="treatment-recommender-skin-analysis__score-row"
                                    >
                                      <span className="treatment-recommender-skin-analysis__score-label">
                                        {SKIN_TYPE_DISPLAY_LABELS[type]}
                                        {isPrimary && (
                                          <span className="treatment-recommender-skin-analysis__score-tag">
                                            {" "}
                                            primary
                                          </span>
                                        )}
                                        {isSecondary && (
                                          <span className="treatment-recommender-skin-analysis__score-tag">
                                            {" "}
                                            tendency
                                          </span>
                                        )}
                                      </span>
                                      <div className="treatment-recommender-skin-analysis__score-bar-wrap">
                                        <div
                                          className={`treatment-recommender-skin-analysis__score-bar${isPrimary ? " treatment-recommender-skin-analysis__score-bar--primary" : ""}${isSecondary ? " treatment-recommender-skin-analysis__score-bar--secondary" : ""}`}
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
                  <div className="treatment-recommender-skin-analysis__summary">
                    <span className="treatment-recommender-skin-analysis__type">
                      {client.skincareQuiz.resultLabel ??
                        (client.skincareQuiz.result
                          ? client.skincareQuiz.result.charAt(0).toUpperCase() +
                            client.skincareQuiz.result.slice(1)
                          : "Completed")}
                    </span>
                    {client.skincareQuiz.result &&
                      GEMSTONE_BY_SKIN_TYPE[client.skincareQuiz.result] && (
                        <span className="treatment-recommender-skin-analysis__gemstone">
                          {" "}
                          · {GEMSTONE_BY_SKIN_TYPE[client.skincareQuiz.result].emoji}{" "}
                          {
                            GEMSTONE_BY_SKIN_TYPE[client.skincareQuiz.result]
                              .tagline
                          }
                        </span>
                      )}
                  </div>
                  {skincareRecommendedWithDetails.length > 0 && (
                    <div className="treatment-recommender-skin-analysis__products-grid">
                      {skincareRecommendedWithDetails.map((product, idx) => (
                        <div
                          key={idx}
                          className="treatment-recommender-skin-analysis__product-card"
                        >
                          <div className="treatment-recommender-skin-analysis__product-card-image-wrap">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt=""
                                className="treatment-recommender-skin-analysis__product-card-image"
                              />
                            ) : (
                              <div className="treatment-recommender-skin-analysis__product-card-placeholder">
                                <span aria-hidden>◆</span>
                              </div>
                            )}
                          </div>
                          <div className="treatment-recommender-skin-analysis__product-card-body">
                            <div className="treatment-recommender-skin-analysis__product-card-reason">
                              Recommended for: {product.recommendedFor}
                            </div>
                            <div className="treatment-recommender-skin-analysis__product-card-name">
                              {product.name.split("|")[0]?.trim() ??
                                product.name}
                            </div>
                            {onAddToPlanDirect &&
                              (() => {
                                const displayName =
                                  product.name.split("|")[0]?.trim() ??
                                  product.name;
                                const isInPlan = (
                                  client.discussedItems ?? []
                                ).some(
                                  (item) =>
                                    item.treatment?.trim() === "Skincare" &&
                                    (item.product?.trim() === displayName ||
                                      item.product?.trim() === product.name),
                                );
                                return (
                                  <button
                                    type="button"
                                    className={`treatment-recommender-skin-analysis__product-card-add-btn${isInPlan ? " treatment-recommender-skin-analysis__product-card-add-btn--added" : ""}`}
                                    onClick={async () => {
                                      if (isInPlan) return;
                                      const prefill: TreatmentPlanPrefill = {
                                        interest: "",
                                        region: "",
                                        treatment: "Skincare",
                                        treatmentProduct: displayName,
                                        timeline: TIMELINE_SKINCARE,
                                        notes:
                                          product.recommendedFor ?? undefined,
                                      };
                                      try {
                                        await onAddToPlanDirect(prefill);
                                        showToast("Added to treatment plan");
                                      } catch {
                                        showToast("Could not add to plan");
                                      }
                                    }}
                                    disabled={isInPlan}
                                  >
                                    {isInPlan ? "Added to plan" : "Add to plan"}
                                  </button>
                                );
                              })()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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
                const wellnestGoalSignal = getWellnestGoalSignalForTreatment(treatment);
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
                  ? parseWellnestWhatItAddressesChips(wellnestOffering.addresses)
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
                        <h2 className="treatment-recommender-by-treatment__card-title">
                          {treatment}
                        </h2>
                        <p className="treatment-recommender-by-treatment__card-why">
                          {getWhyExplanation(treatment)}
                        </p>
                      </div>
                    </div>

                    <FeatureBreakdownSection
                      treatment={treatment}
                      getBreakdownRowsForTreatment={
                        getBreakdownRowsForTreatment
                      }
                      detectedIssues={detectedIssues}
                    />

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
                                onClick={() =>
                                  setAddToPlanForTreatment({
                                    treatment,
                                    where: [],
                                    skincareWhat:
                                      treatment === "Skincare" ? [] : undefined,
                                    skincareCategoryFilter:
                                      treatment === "Skincare" ? [] : undefined,
                                    laserWhat:
                                      treatment === "Energy Device" ? [] : undefined,
                                    biostimulantWhat:
                                      treatment === "Biostimulants"
                                        ? []
                                        : undefined,
                                    microneedlingType:
                                      treatment === "Microneedling"
                                        ? []
                                        : undefined,
                                    when: TIMELINE_OPTIONS[0],
                                    detailsExpanded: false,
                                    product: "",
                                    quantity: "",
                                    notes: "",
                                    deliveryForm: wellnestOffering
                                      ? wellnestDefaultDeliveryForm
                                      : "",
                                    dosing: wellnestOffering
                                      ? wellnestDefaultDosing
                                      : "",
                                  })
                                }
                              >
                                Add to plan
                              </button>
                            ) : null}
                          </div>
                        ) : addToPlanForTreatment?.treatment === treatment ? (
                          <div className="treatment-recommender-by-treatment__add-form">
                            {treatment === "Skincare" && (
                              <>
                                <div className="treatment-recommender-by-treatment__add-row">
                                  <span>Category (optional):</span>
                                  <div className="treatment-recommender-by-treatment__chips">
                                    {SKINCARE_CATEGORY_OPTIONS.map((cat) => {
                                      const selected = (
                                        addToPlanForTreatment.skincareCategoryFilter ??
                                        []
                                      ).includes(cat.label);
                                      return (
                                        <button
                                          key={cat.label}
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
                                                prev.skincareCategoryFilter ??
                                                [];
                                              const next = selected
                                                ? current.filter(
                                                    (x) => x !== cat.label,
                                                  )
                                                : [...current, cat.label];
                                              return {
                                                ...prev,
                                                skincareCategoryFilter: next,
                                              };
                                            })
                                          }
                                        >
                                          <span className="treatment-recommender-by-treatment__chip-label">
                                            {cat.label}
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
                                <div className="treatment-recommender-by-treatment__add-row treatment-recommender-by-treatment__add-row--full">
                                  <h3 className="treatment-recommender-by-treatment__products-heading">
                                    Products
                                  </h3>
                                  <div className="treatment-recommender-by-treatment__skincare-carousel-wrap">
                                    <div
                                      className="discussed-treatments-product-carousel"
                                      role="group"
                                      aria-label="Select skincare products (multiple)"
                                    >
                                      <div className="discussed-treatments-product-carousel-track">
                                        {(() => {
                                          const recommended =
                                            client.skincareQuiz
                                              ?.recommendedProductNames ?? [];
                                          const recommendedSet = new Set(
                                            recommended,
                                          );
                                          const sorted = [
                                            ...skincareCarouselItemsFiltered,
                                          ].sort((a, b) => {
                                            const aRec = recommendedSet.has(
                                              a.name,
                                            );
                                            const bRec = recommendedSet.has(
                                              b.name,
                                            );
                                            if (aRec && !bRec) return -1;
                                            if (!aRec && bRec) return 1;
                                            if (aRec && bRec)
                                              return (
                                                recommended.indexOf(a.name) -
                                                recommended.indexOf(b.name)
                                              );
                                            return 0;
                                          });
                                          return sorted.map((item) => {
                                            const selected = (
                                              addToPlanForTreatment.skincareWhat ??
                                              []
                                            ).includes(item.name);
                                            const isQuizRecommended =
                                              recommendedSet.has(item.name);
                                            return (
                                              <button
                                                key={item.name}
                                                type="button"
                                                className={`discussed-treatments-product-carousel-item ${
                                                  selected ? "selected" : ""
                                                } ${item.name === OTHER_PRODUCT_LABEL ? "other-chip" : ""} ${
                                                  isQuizRecommended
                                                    ? "treatment-recommender-by-treatment__carousel-item--quiz-recommended"
                                                    : ""
                                                }`}
                                                onClick={() =>
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
                                                title={
                                                  selected
                                                    ? `Remove ${item.name}`
                                                    : `Add ${item.name}`
                                                }
                                                aria-label={
                                                  selected
                                                    ? `Remove ${item.name}`
                                                    : `Add ${item.name}`
                                                }
                                              >
                                                {selected && (
                                                  <span
                                                    className="treatment-recommender-by-treatment__carousel-remove"
                                                    aria-hidden
                                                    title="Remove"
                                                  >
                                                    ×
                                                  </span>
                                                )}
                                                <div
                                                  className="discussed-treatments-product-carousel-image"
                                                  aria-hidden
                                                >
                                                  {item.imageUrl ? (
                                                    <img
                                                      src={item.imageUrl}
                                                      alt=""
                                                      loading="lazy"
                                                      className="discussed-treatments-product-carousel-img"
                                                    />
                                                  ) : null}
                                                </div>
                                                <span className="discussed-treatments-product-carousel-label">
                                                  {item.name}
                                                </span>
                                                {isQuizRecommended && (
                                                  <span
                                                    className="treatment-recommender-by-treatment__carousel-quiz-badge"
                                                    aria-label="Recommended from skin quiz"
                                                  >
                                                    Recommended
                                                  </span>
                                                )}
                                              </button>
                                            );
                                          });
                                        })()}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </>
                            )}
                            {treatment !== "Skincare" && !wellnestOffering && (
                              <div className="treatment-recommender-by-treatment__add-row">
                                <span className="treatment-recommender-by-treatment__add-row-label">
                                  {treatment === "Energy Device"
                                    ? "Type:"
                                    : "Where:"}
                                </span>
                                {optionsFromTable &&
                                  treatment !== "Microneedling" &&
                                  treatment !== "Chemical Peel" &&
                                  treatment !== "Biostimulants" && (
                                    <span className="treatment-recommender-by-treatment__edit-options-wrap">
                                      <button
                                        type="button"
                                        className="treatment-recommender-by-treatment__edit-options-btn treatment-recommender-by-treatment__edit-options-btn--with-label"
                                        onClick={() => {
                                          setEditingRecordId(null);
                                          setEditingValue("");
                                          setEditModalNewOptionInput("");
                                          setEditOptionsContext({
                                            treatment:
                                              addToPlanForTreatment.treatment,
                                            optionType:
                                              treatment === "Skincare"
                                                ? "skincare_what"
                                                : treatment === "Energy Device"
                                                  ? "laser_what"
                                                  : treatment ===
                                                      "Biostimulants"
                                                    ? "biostimulant_what"
                                                    : "where",
                                          });
                                        }}
                                        title="Edit options"
                                        aria-label="Edit options"
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
                                          <circle cx="12" cy="12" r="3" />
                                          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                                        </svg>
                                        <span className="treatment-recommender-by-treatment__edit-options-label">
                                          Edit options
                                        </span>
                                      </button>
                                    </span>
                                  )}
                                <div className="treatment-recommender-by-treatment__chips">
                                  {treatment === "Energy Device"
                                    ? laserWhatDisplayRecords.map((rec) => {
                                        const opt = rec.value;
                                        const selected = (
                                          addToPlanForTreatment.laserWhat ?? []
                                        ).includes(opt);
                                        const recordId = rec.id || null;
                                        return (
                                          <button
                                            key={
                                              recordId ? String(recordId) : opt
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
                                                  const next = current.includes(
                                                    opt,
                                                  )
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
                                      })
                                    : (treatment === "Microneedling"
                                          ? [
                                              ...REGION_OPTIONS_MICRONEEDLING,
                                            ].map((v) => ({ id: "", value: v }))
                                          : treatment === "Chemical Peel"
                                            ? [...CHEMICAL_PEEL_AREA_OPTIONS].map((v) => ({
                                                id: "",
                                                value: v,
                                              }))
                                          : whereOptions.map((v) => ({
                                              id: "",
                                              value: v,
                                            }))
                                        ).map((rec) => {
                                          const r = rec.value;
                                          const whereSelected =
                                            addToPlanForTreatment.where.includes(
                                              r,
                                            );
                                          const recordId = rec.id || null;
                                          return (
                                            <button
                                              key={
                                                recordId ? String(recordId) : r
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
                                                            prev.where.includes(
                                                              r,
                                                            )
                                                              ? prev.where.filter(
                                                                  (x) =>
                                                                    x !== r,
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
                                      .map((customVal) => (
                                        <button
                                          key={customVal}
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
                                  {treatment === "Energy Device" &&
                                    (addToPlanForTreatment.laserWhat ?? [])
                                      .filter(
                                        (l) => !laserWhatOptions.includes(l),
                                      )
                                      .map((customVal) => (
                                        <button
                                          key={customVal}
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
                                    treatment !== "Energy Device" &&
                                    addToPlanForTreatment.where
                                      .filter((w) =>
                                        treatment === "Microneedling"
                                          ? !REGION_OPTIONS_MICRONEEDLING.includes(
                                              w as "Face" | "Neck" | "Chest",
                                            )
                                          : !whereOptions.includes(w),
                                      )
                                      .map((customVal) => (
                                        <button
                                          key={customVal}
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
                                  Type:
                                </span>
                                {optionsFromTable && (
                                  <span className="treatment-recommender-by-treatment__edit-options-wrap">
                                    <button
                                      type="button"
                                      className="treatment-recommender-by-treatment__edit-options-btn treatment-recommender-by-treatment__edit-options-btn--with-label"
                                      onClick={() => {
                                        setEditingRecordId(null);
                                        setEditingValue("");
                                        setEditModalNewOptionInput("");
                                        setEditOptionsContext({
                                          treatment:
                                            addToPlanForTreatment.treatment,
                                          optionType: "biostimulant_what",
                                        });
                                      }}
                                      title="Edit options"
                                      aria-label="Edit options"
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
                                        <circle cx="12" cy="12" r="3" />
                                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                                      </svg>
                                      <span className="treatment-recommender-by-treatment__edit-options-label">
                                        Edit options
                                      </span>
                                    </button>
                                  </span>
                                )}
                                <div className="treatment-recommender-by-treatment__chips">
                                  {biostimulantDisplayRecords.map((rec) => {
                                    const opt = rec.value;
                                    const selected = (
                                      addToPlanForTreatment.biostimulantWhat ??
                                      []
                                    ).includes(opt);
                                    const recordId = rec.id || null;
                                    return (
                                      <button
                                        key={recordId ? String(recordId) : opt}
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
                                              ? current.filter((x) => x !== opt)
                                              : [...current, opt];
                                            return {
                                              ...prev,
                                              biostimulantWhat: next,
                                            };
                                          })
                                        }
                                        title={
                                          selected ? `Remove ${opt}` : `Add ${opt}`
                                        }
                                        aria-label={
                                          selected ? `Remove ${opt}` : `Add ${opt}`
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
                                  })}
                                </div>
                              </div>
                            )}
                            {treatment === "Microneedling" && (
                              <div className="treatment-recommender-by-treatment__add-row">
                                <span className="treatment-recommender-by-treatment__add-row-label">
                                  Type:
                                </span>
                                <div className="treatment-recommender-by-treatment__chips">
                                  {[...MICRONEEDLING_TYPE_OPTIONS].map(
                                    (opt) => {
                                      const selected = (
                                        addToPlanForTreatment.microneedlingType ??
                                        []
                                      ).includes(opt);
                                      return (
                                        <button
                                          key={opt}
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
                                    ? fillerTypeOptions
                                    : treatment === "Neurotoxin"
                                      ? neurotoxinTypeOptions
                                      : chemicalPeelTypeOptions
                                  ).map((opt) => {
                                    const selected =
                                      (addToPlanForTreatment.product ?? "") === opt;
                                    return (
                                      <button
                                        key={opt}
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
                                          selected ? `Remove ${opt}` : `Select ${opt}`
                                        }
                                        aria-label={
                                          selected ? `Remove ${opt}` : `Select ${opt}`
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
                                  })}
                                </div>
                              </div>
                            )}
                            <div className="treatment-recommender-by-treatment__add-row">
                              <span>When:</span>
                              <div className="treatment-recommender-by-treatment__chips">
                                {TIMELINE_OPTIONS.filter(
                                  (t) => t !== "Completed",
                                ).map((t) => (
                                  <button
                                    key={t}
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
                                ))}
                              </div>
                            </div>
                            <details className="treatment-recommender-by-treatment__details">
                              <summary>Optional details</summary>
                              <div className="treatment-recommender-by-treatment__details-fields">
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
                                        ).map((opt) => (
                                          <option key={opt} value={opt}>
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
                                  </>
                                )}
                                {!wellnestOffering && (
                                <label className="treatment-recommender-by-treatment__details-label">
                                  Product
                                  <input
                                    type="text"
                                    className="treatment-recommender-by-treatment__details-input"
                                    placeholder="e.g. Juvederm, Botox"
                                    value={addToPlanForTreatment.product ?? ""}
                                    onChange={(e) =>
                                      setAddToPlanForTreatment((prev) =>
                                        prev
                                          ? { ...prev, product: e.target.value }
                                          : null,
                                      )
                                    }
                                  />
                                </label>
                                )}
                                <label className="treatment-recommender-by-treatment__details-label">
                                  Quantity
                                  <input
                                    type="text"
                                    className="treatment-recommender-by-treatment__details-input"
                                    placeholder="e.g. 2"
                                    value={addToPlanForTreatment.quantity ?? ""}
                                    onChange={(e) =>
                                      setAddToPlanForTreatment((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              quantity: e.target.value,
                                            }
                                          : null,
                                      )
                                    }
                                  />
                                </label>
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
                            </details>
                            <div className="treatment-recommender-by-treatment__add-actions">
                              <button
                                type="button"
                                className="treatment-recommender-by-treatment__add-btn"
                                onClick={handleAddToPlanConfirm}
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                className="treatment-recommender-by-treatment__cancel-btn"
                                onClick={() => setAddToPlanForTreatment(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : onAddToPlanDirect ? (
                          <button
                            type="button"
                            className="treatment-recommender-by-treatment__add-btn"
                            onClick={() =>
                              setAddToPlanForTreatment({
                                treatment,
                                where: [],
                                skincareWhat:
                                  treatment === "Skincare" ? [] : undefined,
                                skincareCategoryFilter:
                                  treatment === "Skincare" ? [] : undefined,
                                laserWhat:
                                  treatment === "Energy Device" ? [] : undefined,
                                biostimulantWhat:
                                  treatment === "Biostimulants"
                                    ? []
                                    : undefined,
                                microneedlingType:
                                  treatment === "Microneedling"
                                    ? []
                                    : undefined,
                                when: TIMELINE_OPTIONS[0],
                                detailsExpanded: false,
                                product: "",
                                quantity: "",
                                notes: "",
                                deliveryForm: wellnestOffering
                                  ? wellnestDefaultDeliveryForm
                                  : "",
                                dosing: wellnestOffering
                                  ? wellnestDefaultDosing
                                  : "",
                              })
                            }
                          >
                            Add to plan
                          </button>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="treatment-recommender-by-treatment__examples-btn"
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
                      >
                        {wellnestOffering
                          ? "Overview & examples"
                          : "View examples"}
                      </button>
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
          const detailResultCases = WELLNEST_CURATED_BLUEPRINT_CASES.filter((p) =>
            photoMatchesPlanTreatment(p, detailOffering.treatmentName),
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
            for (const ex of externalExamples.slice(0, 2)) defaults[ex.id] = true;
            const preselected = externalExamples.filter((ex) => defaults[ex.id]);
            setWellnestArticleSelection(defaults);
            setWellnestArticlePhone(formatPhoneDisplay(client.phone));
            setWellnestArticleDraft(
              buildExternalShareDraft(detailOffering.treatmentName, preselected),
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
              showError(err instanceof Error ? err.message : "Failed to send SMS.");
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
                                    wellnestCasePanelRef.current?.scrollIntoView({
                                      behavior: "smooth",
                                      block: "nearest",
                                    });
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
                              {wellnestSelectedResultCase.storyTitle || "Case detail"}
                            </h4>
                            <button
                              type="button"
                              className="wellnest-recommender-case-inline-close"
                              onClick={() => setWellnestSelectedResultCase(null)}
                            >
                              Close
                            </button>
                          </div>
                          <img
                            src={wellnestSelectedResultCase.photoUrl}
                            alt={
                              wellnestSelectedResultCase.storyTitle || "Wellness case"
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
                      <h3 id="wellnest-share-articles-title">Share articles with client</h3>
                      <p className="wellnest-recommender-share-hint">
                        Choose which links to include, then send by SMS.
                      </p>
                      <ul className="wellnest-recommender-share-list">
                        {externalExamples.map((ex) => (
                          <li key={`share-${ex.id}`}>
                            <label>
                              <input
                                type="checkbox"
                                checked={Boolean(wellnestArticleSelection[ex.id])}
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
                        onChange={(e) => setWellnestArticlePhone(e.target.value)}
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
                        onChange={(e) => setWellnestArticleDraft(e.target.value)}
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
                            !isValidPhone(formatPhoneDisplay(wellnestArticlePhone))
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
          onAddToPlanWithPrefill={
            onOpenTreatmentPlanWithPrefill
              ? (prefill) => {
                  setPhotoExplorerContext(null);
                  onOpenTreatmentPlanWithPrefill(prefill);
                }
              : undefined
          }
          planItems={client.discussedItems ?? []}
        />
      )}

      {editOptionsContext && provider?.id && (
        <div
          className="treatment-recommender-by-treatment__edit-options-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-options-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setEditOptionsContext(null);
              setEditingRecordId(null);
              setEditModalNewOptionInput("");
            }
          }}
        >
          <div
            className="treatment-recommender-by-treatment__edit-options-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="edit-options-title"
              className="treatment-recommender-by-treatment__edit-options-title"
            >
              Edit {editOptionsContext.treatment} options
            </h2>
            <p className="treatment-recommender-by-treatment__edit-options-hint">
              Rename, add, or remove options. Changes apply to this provider
              only.
            </p>
            <ul className="treatment-recommender-by-treatment__edit-options-list">
              {editOptionRecords.map((rec) => (
                <li
                  key={rec.id}
                  className="treatment-recommender-by-treatment__edit-options-row"
                >
                  {editingRecordId === rec.id ? (
                    <>
                      <input
                        type="text"
                        className="treatment-recommender-by-treatment__edit-options-input"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            updateTreatmentRecommenderOption(
                              rec.id,
                              editingValue,
                            )
                              .then(() => {
                                setOptionRecordsVersion((v) => v + 1);
                                setEditingRecordId(null);
                                setEditingValue("");
                              })
                              .catch(() => showToast("Could not update"));
                          }
                          if (e.key === "Escape") {
                            setEditingRecordId(null);
                            setEditingValue("");
                          }
                        }}
                        autoFocus
                        aria-label="New name"
                      />
                      <button
                        type="button"
                        className="treatment-recommender-by-treatment__edit-options-btn treatment-recommender-by-treatment__edit-options-btn--primary"
                        onClick={() =>
                          updateTreatmentRecommenderOption(rec.id, editingValue)
                            .then(() => {
                              setOptionRecordsVersion((v) => v + 1);
                              setEditingRecordId(null);
                              setEditingValue("");
                            })
                            .catch(() => showToast("Could not update"))
                        }
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="treatment-recommender-by-treatment__edit-options-btn"
                        onClick={() => {
                          setEditingRecordId(null);
                          setEditingValue("");
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="treatment-recommender-by-treatment__edit-options-label">
                        {rec.value}
                      </span>
                      <button
                        type="button"
                        className="treatment-recommender-by-treatment__edit-options-btn"
                        onClick={() => {
                          setEditingRecordId(rec.id);
                          setEditingValue(rec.value);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="treatment-recommender-by-treatment__edit-options-btn treatment-recommender-by-treatment__edit-options-btn--danger"
                        onClick={() =>
                          deleteTreatmentRecommenderOption(rec.id)
                            .then(() => setOptionRecordsVersion((v) => v + 1))
                            .catch(() => showToast("Could not remove"))
                        }
                      >
                        Remove
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <div className="treatment-recommender-by-treatment__edit-options-add">
              <input
                type="text"
                className="treatment-recommender-by-treatment__edit-options-input"
                placeholder="New option name"
                value={editModalNewOptionInput}
                onChange={(e) => setEditModalNewOptionInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const val = editModalNewOptionInput.trim();
                    if (!val) return;
                    createTreatmentRecommenderCustomOption(
                      provider.id,
                      editOptionsContext.optionType,
                      val,
                    )
                      .then(() => {
                        setOptionRecordsVersion((v) => v + 1);
                        setEditModalNewOptionInput("");
                      })
                      .catch(() => showToast("Could not add"));
                  }
                }}
                aria-label="New option name"
              />
              <button
                type="button"
                className="treatment-recommender-by-treatment__edit-options-btn treatment-recommender-by-treatment__edit-options-btn--primary"
                onClick={() => {
                  const val = editModalNewOptionInput.trim();
                  if (!val) return;
                  createTreatmentRecommenderCustomOption(
                    provider.id,
                    editOptionsContext.optionType,
                    val,
                  )
                    .then(() => {
                      setOptionRecordsVersion((v) => v + 1);
                      setEditModalNewOptionInput("");
                    })
                    .catch(() => showToast("Could not add"));
                }}
              >
                Add
              </button>
            </div>
            <div className="treatment-recommender-by-treatment__edit-options-actions">
              <button
                type="button"
                className="treatment-recommender-by-treatment__edit-options-done"
                onClick={() => {
                  setEditOptionsContext(null);
                  setEditingRecordId(null);
                  setEditModalNewOptionInput("");
                }}
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
