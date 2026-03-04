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
  fetchTreatmentRecommenderCustomOptions,
  createTreatmentRecommenderCustomOption,
  deleteTreatmentRecommenderOption,
  updateTreatmentRecommenderOption,
  seedTreatmentRecommenderOptions,
  type TreatmentRecommenderOptionType,
} from "../../services/api";
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
  MICRONEEDLING_TYPE_OPTIONS,
  TIMELINE_OPTIONS,
  TIMELINE_SKINCARE,
  PLAN_SECTIONS,
  SKINCARE_SECTION_LABEL,
  LASER_DEVICES,
  TREATMENT_PRODUCT_OPTIONS,
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
import { showToast } from "../../utils/toast";
import type { TreatmentPlanPrefill } from "../modals/DiscussedTreatmentsModal/TreatmentPhotos";
import TreatmentRecommenderFilters from "./TreatmentRecommenderFilters";

import TreatmentPhotosModal from "../modals/TreatmentPhotosModal";
import PhotoViewerModal from "../modals/PhotoViewerModal";
import "../modals/AnalysisOverviewModal.css";
import "./TreatmentRecommenderByTreatment.css";

/** Biostimulants before/after image for the treatment card. */
import biostimulantsBeforeAfterUrl from "../../assets/images/Biostimulators-Before-and-After-With-Pictures-1.webp";

/** Set to true to show the Checkout button in the plan sidebar. Temporarily hidden. */
const SHOW_CHECKOUT_BUTTON = false;

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

function photoMatchesTreatment(
  photo: TreatmentPhoto,
  treatmentName: string,
): boolean {
  const t = treatmentName.trim().toLowerCase();
  if (!t) return false;
  const inGeneral = (photo.generalTreatments || []).some((g) =>
    String(g).toLowerCase().includes(t),
  );
  const inSpecific = (photo.treatments || []).some((s) =>
    String(s).toLowerCase().includes(t),
  );
  const inName = (photo.name || "").toLowerCase().includes(t);
  return inGeneral || inSpecific || inName;
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
  const [addToPlanForTreatment, setAddToPlanForTreatment] = useState<{
    treatment: string;
    where: string[];
    /** For Skincare: multi-select "What" options (product names). */
    skincareWhat?: string[];
    /** For Skincare: selected category labels to filter the product carousel. */
    skincareCategoryFilter?: string[];
    /** For Laser: multi-select "What" options (e.g. BBL, Moxi, Halo). */
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

  useEffect(() => {
    if (!showClientPhotoModal) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowClientPhotoModal(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [showClientPhotoModal]);

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
    if (
      client.frontPhoto &&
      Array.isArray(client.frontPhoto) &&
      client.frontPhoto.length > 0
    ) {
      setFrontPhotoUrl(getUrl(client.frontPhoto[0]) ?? null);
    }
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
        if (!mounted || records.length === 0) return;
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
        } else {
          setSidePhotoUrl(null);
        }
      })
      .catch(() => {});
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
          const biostimulantList =
            TREATMENT_PRODUCT_OPTIONS["Biostimulants"] ?? [];
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
            ...LASER_DEVICES.map((v) => ({
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
  const laserWhatOptions = useMemo(
    () =>
      laserWhatOptionRecords.length > 0
        ? laserWhatOptionRecords.map((o) => o.value)
        : [...LASER_DEVICES],
    [laserWhatOptionRecords],
  );

  const biostimulantWhatOptionRecords = useMemo(
    () => optionRecords.filter((o) => o.optionType === "biostimulant_what"),
    [optionRecords],
  );
  const biostimulantWhatOptions = useMemo(
    () =>
      biostimulantWhatOptionRecords.length > 0
        ? biostimulantWhatOptionRecords.map((o) => o.value)
        : [...(TREATMENT_PRODUCT_OPTIONS["Biostimulants"] ?? [])],
    [biostimulantWhatOptionRecords],
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
    const withGoals = getSuggestedTreatmentsForFindings(combinedFindings);
    let names = Array.from(new Set(withGoals.map((s) => s.treatment)));
    // When client has skin quiz recommendations, include Skincare so "Add to plan" from top section has a card to open
    const hasSkinQuizProducts =
      client.skincareQuiz?.recommendedProductNames &&
      client.skincareQuiz.recommendedProductNames.length > 0;
    if (hasSkinQuizProducts && !names.includes("Skincare")) {
      names = ["Skincare", ...names];
    }
    const sameDay = filterTreatmentsBySameDay(names, filterState.sameDayAddOn);
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
  ]);

  /** Treatment cards to show: exclude Skincare from the list when client has completed the skin quiz (Skincare lives only in the collapsible recommendations block). */
  const treatmentsToShow = useMemo(() => {
    const hasCompletedSkinQuiz = Boolean(
      client.skincareQuiz?.completedAt ?? client.skincareQuiz?.result,
    );
    return hasCompletedSkinQuiz
      ? suggestedTreatments.filter((t) => t !== "Skincare")
      : suggestedTreatments;
  }, [
    suggestedTreatments,
    client.skincareQuiz?.completedAt,
    client.skincareQuiz?.result,
  ]);

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
    const isLaser = addToPlanForTreatment.treatment === "Laser";
    const isBiostimulants = addToPlanForTreatment.treatment === "Biostimulants";
    const region =
      isSkincare || isLaser || isBiostimulants
        ? ""
        : addToPlanForTreatment.where.length > 0
          ? addToPlanForTreatment.where.join(", ")
          : "";
    const treatmentProduct = isSkincare
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
    const prefill: TreatmentPlanPrefill = {
      interest: "",
      region,
      treatment: addToPlanForTreatment.treatment,
      timeline: addToPlanForTreatment.when,
      treatmentProduct,
      quantity: addToPlanForTreatment.quantity?.trim() || undefined,
      notes: addToPlanForTreatment.notes?.trim() || undefined,
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
          <h3 className="treatment-recommender-by-treatment__plan-title">
            {firstName}&apos;s plan ({planItemCount}{" "}
            {planItemCount === 1 ? "item" : "items"})
          </h3>
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
                              onRemovePlanItem(item.id);
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
              {SHOW_CHECKOUT_BUTTON && onOpenCheckout && planItemCount > 0 && (
                <button
                  type="button"
                  className="treatment-recommender-by-treatment__plan-checkout-btn"
                  onClick={() => onOpenCheckout()}
                >
                  Checkout
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
                    Quiz Completed{" "}
                    {new Date(
                      client.skincareQuiz.completedAt,
                    ).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
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
                          · 💎{" "}
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

          <h2 className="treatment-recommender-by-treatment__results-heading">
            {treatmentsToShow.length} treatment option
            {treatmentsToShow.length !== 1 ? "s" : ""}
          </h2>

          <div className="treatment-recommender-by-treatment__cards">
            {treatmentsToShow.length === 0 ? (
              <p className="treatment-recommender-by-treatment__empty">
                No treatments match the current filters. Select &quot;What are
                you here for?&quot; and optionally findings, regions, or general
                concerns.
              </p>
            ) : (
              treatmentsToShow.map((treatment) => {
                const cardPhotos = getPhotosForTreatment(treatment);
                const cardPhoto = cardPhotos[0];
                return (
                  <div
                    key={treatment}
                    ref={(el) => {
                      cardRefsMap.current[treatment] = el;
                    }}
                    className="treatment-recommender-by-treatment__card"
                  >
                    <div className="treatment-recommender-by-treatment__card-top">
                      {(cardPhoto || treatment === "Biostimulants") && (
                        <div className="treatment-recommender-by-treatment__card-photo-wrap">
                          {cardPhoto ? (
                            <img
                              src={cardPhoto.thumbnailUrl || cardPhoto.photoUrl}
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
                                      treatment === "Laser" ? [] : undefined,
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
                            {treatment !== "Skincare" && (
                              <div className="treatment-recommender-by-treatment__add-row">
                                <span className="treatment-recommender-by-treatment__add-row-label">
                                  {treatment === "Laser" ||
                                  treatment === "Biostimulants"
                                    ? "What:"
                                    : "Where:"}
                                </span>
                                {optionsFromTable &&
                                  treatment !== "Microneedling" && (
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
                                                : treatment === "Laser"
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
                                  {treatment === "Laser"
                                    ? (optionsFromTable
                                        ? laserWhatOptionRecords
                                        : laserWhatOptions.map((v) => ({
                                            id: "",
                                            value: v,
                                          }))
                                      ).map((rec) => {
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
                                    : treatment === "Biostimulants"
                                      ? (optionsFromTable
                                          ? biostimulantWhatOptionRecords
                                          : biostimulantWhatOptions.map(
                                              (v) => ({ id: "", value: v }),
                                            )
                                        ).map((rec) => {
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
                                                  : opt
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
                                                      prev.biostimulantWhat ??
                                                      [];
                                                    const next =
                                                      current.includes(opt)
                                                        ? current.filter(
                                                            (x) => x !== opt,
                                                          )
                                                        : [...current, opt];
                                                    return {
                                                      ...prev,
                                                      biostimulantWhat: next,
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
                                          : optionsFromTable
                                            ? whereOptionRecordsDeduped
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
                                  {treatment === "Laser" &&
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
                                  {treatment === "Biostimulants" &&
                                    (
                                      addToPlanForTreatment.biostimulantWhat ??
                                      []
                                    )
                                      .filter(
                                        (b) =>
                                          !biostimulantWhatOptions.includes(b),
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
                                                    biostimulantWhat: (
                                                      prev.biostimulantWhat ??
                                                      []
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
                                    treatment !== "Laser" &&
                                    treatment !== "Biostimulants" &&
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
                                  treatment === "Laser" ? [] : undefined,
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
                          setPhotoExplorerContext({
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
                        View examples
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {photoExplorerContext && (
        <TreatmentPhotosModal
          client={client}
          selectedTreatment={photoExplorerContext.treatment}
          selectedRegion={photoExplorerContext.region}
          onClose={() => setPhotoExplorerContext(null)}
          onUpdate={onUpdate}
          onAddToPlanWithPrefill={(prefill) => {
            setPhotoExplorerContext(null);
            onOpenTreatmentPlanWithPrefill?.(prefill);
          }}
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
