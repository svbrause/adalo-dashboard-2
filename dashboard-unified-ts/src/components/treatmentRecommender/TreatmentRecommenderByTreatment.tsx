/**
 * Treatment Recommender – by treatment.
 * Full-width treatment cards with feature breakdown and Add to plan.
 */

import { useMemo, useState, useEffect } from "react";
import { useDashboard } from "../../context/DashboardContext";
import { Client, TreatmentPhoto, DiscussedItem } from "../../types";
import {
  fetchTreatmentPhotos,
  fetchTableRecords,
  fetchTreatmentRecommenderCustomOptions,
  createTreatmentRecommenderCustomOption,
  type TreatmentRecommenderOptionType,
} from "../../services/api";
import type { AirtableRecord } from "../../services/api";
import { normalizeIssue, scoreTier, tierColor, scoreIssues, CATEGORIES } from "../../config/analysisOverviewConfig";
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
import { REGION_OPTIONS, TIMELINE_OPTIONS, PLAN_SECTIONS, LASER_DEVICES, TREATMENT_PRODUCT_OPTIONS } from "../modals/DiscussedTreatmentsModal/constants";
import { showToast } from "../../utils/toast";
import type { TreatmentPlanPrefill } from "../modals/DiscussedTreatmentsModal/TreatmentPhotos";
import TreatmentRecommenderFilters from "./TreatmentRecommenderFilters";

/** Skincare "What" options in by-treatment add form (replaces Where/region). */
const SKINCARE_WHAT_OPTIONS = [
  "Anti-aging cream",
  "Moisturizer",
  "Sunscreen",
  "Vitamin C serum",
  "HLA serum",
  "Anti-aging serum",
  "Anti-oxidants",
  "Exfoliators",
  "Cleansers",
  "Toners/mists",
  "Face masks",
  "Retinols",
  "Eye care",
  "Lip care",
];
import TreatmentPhotosModal from "../modals/TreatmentPhotosModal";
import "../modals/AnalysisOverviewModal.css";
import "./TreatmentRecommenderByTreatment.css";

/** Biostimulants before/after image for the treatment card. */
import biostimulantsBeforeAfterUrl from "../../assets/images/Biostimulators-Before-and-After-With-Pictures-1.webp";

/** Map Airtable record to TreatmentPhoto for card thumbnails. */
function mapRecordToPhoto(record: AirtableRecord): TreatmentPhoto {
  const fields = record.fields;
  const photoAttachment = fields["Photo"];
  let photoUrl = "";
  let thumbnailUrl = "";
  if (Array.isArray(photoAttachment) && photoAttachment.length > 0) {
    const att = photoAttachment[0];
    photoUrl =
      att.thumbnails?.full?.url ||
      att.thumbnails?.large?.url ||
      att.url ||
      "";
    thumbnailUrl =
      att.thumbnails?.large?.url ||
      att.thumbnails?.small?.url ||
      att.url ||
      "";
  }
  const treatments = Array.isArray(fields["Name (from Treatments)"])
    ? fields["Name (from Treatments)"]
    : fields["Treatments"]
      ? [fields["Treatments"]]
      : [];
  const generalTreatments = Array.isArray(fields["Name (from General Treatments)"])
    ? fields["Name (from General Treatments)"]
    : fields["General Treatments"]
      ? [fields["General Treatments"]]
      : [];
  const areaNames = fields["Area Names"]
    ? String(fields["Area Names"]).split(",").map((s: string) => s.trim()).filter(Boolean)
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

function photoMatchesTreatment(photo: TreatmentPhoto, treatmentName: string): boolean {
  const t = treatmentName.trim().toLowerCase();
  if (!t) return false;
  const inGeneral = (photo.generalTreatments || []).some((g) =>
    String(g).toLowerCase().includes(t)
  );
  const inSpecific = (photo.treatments || []).some((s) =>
    String(s).toLowerCase().includes(t)
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
    <div className={`treatment-recommender-by-treatment__breakdown-circle ${isSelected ? "treatment-recommender-by-treatment__breakdown-circle--selected" : ""}`}>
      <button
        type="button"
        className="treatment-recommender-by-treatment__breakdown-circle-btn"
        onClick={onSelect}
        aria-pressed={isSelected}
        aria-expanded={isSelected}
        title={`${label}: ${score}%`}
      >
        <span className="treatment-recommender-by-treatment__breakdown-circle-svg-wrap">
          <svg className="treatment-recommender-by-treatment__breakdown-circle-svg" viewBox="0 0 44 44" aria-hidden>
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
          <span className="treatment-recommender-by-treatment__breakdown-circle-score" style={{ color }}>
            {score}
          </span>
        </span>
        <span className="treatment-recommender-by-treatment__breakdown-circle-label">{label}</span>
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
  getBreakdownRowsForTreatment: (t: string) => { label: string; issues: string[] }[];
  detectedIssues: Set<string>;
}) {
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const rows = getBreakdownRowsForTreatment(treatment);
  if (rows.length === 0) return null;

  const selectedRow = selectedLabel ? rows.find((r) => r.label === selectedLabel) : null;
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
            onSelect={() => setSelectedLabel(selectedLabel === row.label ? null : row.label)}
          />
        ))}
      </div>
      <div className="treatment-recommender-by-treatment__breakdown-detail">
        {selectedRow ? (
          <div className="treatment-recommender-by-treatment__breakdown-expanded">
            <p className="treatment-recommender-by-treatment__breakdown-detail-heading">
              {selectedRow.label}
            </p>
            {(goodIssues.length > 0 || badIssues.length > 0) ? (
              <>
                {goodIssues.length > 0 && (
                  <div className="treatment-recommender-by-treatment__breakdown-expanded-group">
                    <span className="treatment-recommender-by-treatment__breakdown-expanded-label">No concerns</span>
                    <div className="treatment-recommender-by-treatment__breakdown-expanded-pills">
                      {goodIssues.map((issue) => (
                        <span key={issue} className="treatment-recommender-by-treatment__breakdown-pill treatment-recommender-by-treatment__breakdown-pill--good">
                          <span className="treatment-recommender-by-treatment__breakdown-pill-icon">✓</span>
                          {issue}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {badIssues.length > 0 && (
                  <div className="treatment-recommender-by-treatment__breakdown-expanded-group">
                    <span className="treatment-recommender-by-treatment__breakdown-expanded-label">Areas of concern</span>
                    <div className="treatment-recommender-by-treatment__breakdown-expanded-pills">
                      {badIssues.map((issue) => (
                        <span key={issue} className="treatment-recommender-by-treatment__breakdown-pill treatment-recommender-by-treatment__breakdown-pill--concern">
                          <span className="treatment-recommender-by-treatment__breakdown-pill-icon">✕</span>
                          {issue}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="treatment-recommender-by-treatment__breakdown-expanded-empty">No findings in this area</p>
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
  onAddToPlanDirect?: (prefill: TreatmentPlanPrefill) => Promise<DiscussedItem | void> | void;
  /** Open the treatment plan modal (e.g. for "Add additional details"). */
  onOpenTreatmentPlan?: () => void;
  /** Open the treatment plan modal with prefill (e.g. from View examples → Add to plan). */
  onOpenTreatmentPlanWithPrefill?: (prefill: TreatmentPlanPrefill) => void;
  /** Open the treatment plan modal with this item selected for editing ("Add additional details"). */
  onOpenTreatmentPlanWithItem?: (item: DiscussedItem) => void;
  /** Ref set by parent; when treatment plan modal closes, parent will call this so we clear "just added" state. */
  treatmentPlanModalClosedRef?: React.MutableRefObject<(() => void) | null>;
}

export default function TreatmentRecommenderByTreatment({
  client,
  onBack: _onBack,
  onUpdate,
  onAddToPlanDirect,
  onOpenTreatmentPlan,
  onOpenTreatmentPlanWithPrefill,
  onOpenTreatmentPlanWithItem,
  treatmentPlanModalClosedRef,
}: TreatmentRecommenderByTreatmentProps) {
  const { provider } = useDashboard();
  /** Persisted custom options (Where / What) loaded from Airtable; merged with static options in the UI. */
  const [customOptions, setCustomOptions] = useState<{
    where: string[];
    skincareWhat: string[];
    laserWhat: string[];
    biostimulantWhat: string[];
  }>({ where: [], skincareWhat: [], laserWhat: [], biostimulantWhat: [] });
  /** Item we just added so we can open it for editing when user clicks "Add additional details". Cleared when modal closes. */
  const [lastAddedItem, setLastAddedItem] = useState<DiscussedItem | null>(null);
  const [filterState, setFilterState] = useState<TreatmentRecommenderFilterState>(
    () => ({ ...DEFAULT_RECOMMENDER_FILTER_STATE })
  );
  const [addToPlanForTreatment, setAddToPlanForTreatment] = useState<{
    treatment: string;
    where: string[];
    /** For Skincare: multi-select "What" options (e.g. Sunscreen, Moisturizer). */
    skincareWhat?: string[];
    /** For Laser: multi-select "What" options (e.g. BBL, Moxi, Halo). */
    laserWhat?: string[];
    /** For Biostimulants: multi-select "What" options (e.g. Sculptra, Radiesse, Ellansé). */
    biostimulantWhat?: string[];
    when: string;
    detailsExpanded: boolean;
    product?: string;
    quantity?: string;
    notes?: string;
  } | null>(null);
  /** Notion-style: type to create a new option for Where/What. */
  const [customOptionInput, setCustomOptionInput] = useState("");
  const [photoExplorerContext, setPhotoExplorerContext] = useState<{
    treatment: string;
    region?: string;
  } | null>(null);
  const [treatmentPhotos, setTreatmentPhotos] = useState<TreatmentPhoto[]>([]);
  const [clientPhotoView, setClientPhotoView] = useState<"front" | "side">("front");
  const [frontPhotoUrl, setFrontPhotoUrl] = useState<string | null>(null);
  const [sidePhotoUrl, setSidePhotoUrl] = useState<string | null>(null);
  const [showClientPhotoModal, setShowClientPhotoModal] = useState(false);

  useEffect(() => {
    if (!showClientPhotoModal) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowClientPhotoModal(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [showClientPhotoModal]);

  const getUrl = (att: { url?: string; thumbnails?: { full?: { url?: string }; large?: { url?: string } } }) =>
    att?.thumbnails?.full?.url ?? att?.thumbnails?.large?.url ?? att?.url ?? null;

  useEffect(() => {
    if (client.tableSource !== "Patients") return;
    if (client.frontPhoto && Array.isArray(client.frontPhoto) && client.frontPhoto.length > 0) {
      setFrontPhotoUrl(getUrl(client.frontPhoto[0]) ?? null);
    }
    let mounted = true;
    fetchTableRecords("Patients", {
      filterFormula: `RECORD_ID() = "${client.id}"`,
      fields: ["Front Photo", "Side Photo"],
    })
      .then((records) => {
        if (!mounted || records.length === 0) return;
        const fields = records[0].fields;
        const front = fields["Front Photo"] ?? fields["Front photo"] ?? fields["frontPhoto"];
        if (front && Array.isArray(front) && front.length > 0) {
          setFrontPhotoUrl((prev) => prev ?? getUrl(front[0]) ?? null);
        }
        const side = fields["Side Photo"] ?? fields["Side photo"] ?? fields["sidePhoto"];
        if (side && Array.isArray(side) && side.length > 0) {
          setSidePhotoUrl(getUrl(side[0]) ?? null);
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
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!provider?.id) return;
    let mounted = true;
    fetchTreatmentRecommenderCustomOptions(provider.id)
      .then((list) => {
        if (!mounted) return;
        const where: string[] = [];
        const skincareWhat: string[] = [];
        const laserWhat: string[] = [];
        const biostimulantWhat: string[] = [];
        for (const o of list) {
          if (o.optionType === "where") where.push(o.value);
          else if (o.optionType === "skincare_what") skincareWhat.push(o.value);
          else if (o.optionType === "laser_what") laserWhat.push(o.value);
          else if (o.optionType === "biostimulant_what") biostimulantWhat.push(o.value);
        }
        setCustomOptions({ where, skincareWhat, laserWhat, biostimulantWhat });
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [provider?.id]);

  const baseWhereOptions = useMemo(
    () => REGION_OPTIONS.filter((r) => r !== "Multiple" && r !== "Other"),
    []
  );
  const whereOptions = useMemo(
    () => [...baseWhereOptions, ...customOptions.where],
    [baseWhereOptions, customOptions.where]
  );
  const skincareWhatOptions = useMemo(
    () => [...SKINCARE_WHAT_OPTIONS, ...customOptions.skincareWhat],
    [customOptions.skincareWhat]
  );
  const laserWhatOptions = useMemo(
    () => [...LASER_DEVICES, ...customOptions.laserWhat],
    [customOptions.laserWhat]
  );
  const biostimulantWhatOptions = useMemo(
    () => [...(TREATMENT_PRODUCT_OPTIONS["Biostimulants"] ?? []), ...customOptions.biostimulantWhat],
    [customOptions.biostimulantWhat]
  );

  const detectedIssues = useMemo(() => getDetectedIssues(client), [client]);

  const getPhotosForTreatment = (treatmentName: string): TreatmentPhoto[] =>
    treatmentPhotos.filter((p) => photoMatchesTreatment(p, treatmentName));

  const combinedFindings = useMemo(() => {
    const fromClient = Array.from(detectedIssues);
    const fromFilter = filterState.findingsToAddress || [];
    const fromConcerns = getFindingsFromConcerns(filterState.generalConcerns);
    const set = new Set<string>([...fromClient, ...fromFilter, ...fromConcerns]);
    return Array.from(set);
  }, [detectedIssues, filterState.findingsToAddress, filterState.generalConcerns]);

  const suggestedTreatments = useMemo(() => {
    const withGoals = getSuggestedTreatmentsForFindings(combinedFindings);
    const names = Array.from(new Set(withGoals.map((s) => s.treatment)));
    const sameDay = filterTreatmentsBySameDay(names, filterState.sameDayAddOn);
    const filtered = filterTreatmentsByRegion(
      sameDay,
      filterState.region,
      (t) => getFindingsByAreaForTreatment(t).map((r) => r.area)
    );
    // Skincare first, then the rest in existing order
    const skincare = filtered.filter((t) => t === "Skincare");
    const rest = filtered.filter((t) => t !== "Skincare");
    return [...skincare, ...rest];
  }, [combinedFindings, filterState.sameDayAddOn, filterState.region]);

  const handleAddToPlanConfirm = async () => {
    if (!addToPlanForTreatment || !onAddToPlanDirect) return;
    const isSkincare = addToPlanForTreatment.treatment === "Skincare";
    const isLaser = addToPlanForTreatment.treatment === "Laser";
    const isBiostimulants = addToPlanForTreatment.treatment === "Biostimulants";
    const region = isSkincare || isLaser || isBiostimulants
      ? ""
      : (addToPlanForTreatment.where.length > 0 ? addToPlanForTreatment.where.join(", ") : "");
    const treatmentProduct = isSkincare
      ? (addToPlanForTreatment.skincareWhat?.length ? addToPlanForTreatment.skincareWhat.join(", ") : addToPlanForTreatment.product?.trim() || undefined)
      : isLaser
        ? (addToPlanForTreatment.laserWhat?.length ? addToPlanForTreatment.laserWhat.join(", ") : addToPlanForTreatment.product?.trim() || undefined)
        : isBiostimulants
          ? (addToPlanForTreatment.biostimulantWhat?.length ? addToPlanForTreatment.biostimulantWhat.join(", ") : addToPlanForTreatment.product?.trim() || undefined)
          : (addToPlanForTreatment.product?.trim() || undefined);
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
      setCustomOptionInput("");
      if (newItem) setLastAddedItem(newItem);
    } catch {
      /* parent shows error */
    }
  };

  /** Notion-style: add a custom option (typed by user) to Where or What; persist to Airtable when provider is set. */
  const addCustomOption = async () => {
    const val = customOptionInput.trim();
    if (!val || !addToPlanForTreatment) return;
    const treatment = addToPlanForTreatment.treatment;
    let optionType: TreatmentRecommenderOptionType = "where";
    if (treatment === "Skincare") {
      const current = addToPlanForTreatment.skincareWhat ?? [];
      if (current.includes(val)) return;
      optionType = "skincare_what";
      setAddToPlanForTreatment((prev) => prev ? { ...prev, skincareWhat: [...current, val] } : null);
    } else if (treatment === "Laser") {
      const current = addToPlanForTreatment.laserWhat ?? [];
      if (current.includes(val)) return;
      optionType = "laser_what";
      setAddToPlanForTreatment((prev) => prev ? { ...prev, laserWhat: [...current, val] } : null);
    } else if (treatment === "Biostimulants") {
      const current = addToPlanForTreatment.biostimulantWhat ?? [];
      if (current.includes(val)) return;
      optionType = "biostimulant_what";
      setAddToPlanForTreatment((prev) => prev ? { ...prev, biostimulantWhat: [...current, val] } : null);
    } else {
      const current = addToPlanForTreatment.where;
      if (current.includes(val)) return;
      setAddToPlanForTreatment((prev) => prev ? { ...prev, where: [...current, val] } : null);
    }
    setCustomOptionInput("");
    if (provider?.id) {
      try {
        await createTreatmentRecommenderCustomOption(provider.id, optionType, val);
        setCustomOptions((prev) => ({
          ...prev,
          [optionType === "skincare_what" ? "skincareWhat" : optionType === "laser_what" ? "laserWhat" : optionType === "biostimulant_what" ? "biostimulantWhat" : "where"]:
            optionType === "skincare_what" ? [...prev.skincareWhat, val]
            : optionType === "laser_what" ? [...prev.laserWhat, val]
            : optionType === "biostimulant_what" ? [...prev.biostimulantWhat, val]
            : [...prev.where, val],
        }));
      } catch {
        showToast("Option added here; could not save for future use.");
      }
    }
  };

  /** Whether this treatment is already in the treatment plan (so we show "Added" and "Add additional details"). */
  const isTreatmentInPlan = (treatmentName: string): boolean => {
    if (lastAddedItem && lastAddedItem.treatment === treatmentName) return true;
    return (client.discussedItems ?? []).some((i) => i.treatment === treatmentName);
  };

  useEffect(() => {
    if (!treatmentPlanModalClosedRef) return;
    treatmentPlanModalClosedRef.current = () => setLastAddedItem(null);
    return () => {
      if (treatmentPlanModalClosedRef) treatmentPlanModalClosedRef.current = null;
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
    return byArea.map(({ area, findings }) => ({ label: area, issues: findings }));
  };

  /** Findings relevant to this treatment that the client actually has (for personalized copy). */
  const getRelevantFindingsForTreatment = (treatment: string): string[] => {
    const rows = getBreakdownRowsForTreatment(treatment);
    const relevant: string[] = [];
    for (const row of rows) {
      for (const issue of row.issues) {
        if (detectedIssues.has(normalizeIssue(issue)) && !relevant.includes(issue)) {
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
        ? relevant.slice(0, 4).join(", ") + (relevant.length > 4 ? " and more" : "")
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
          ? `Their skin analysis points to ${findingsText}. A tailored skincare regimen can complement today's visit and support longer-term results.`
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

  /** Plan items grouped by section (same order as treatment plan builder left column). */
  const planItemsBySection = useMemo(() => {
    const items = client.discussedItems ?? [];
    const now: DiscussedItem[] = [];
    const addNext: DiscussedItem[] = [];
    const wishlist: DiscussedItem[] = [];
    const completed: DiscussedItem[] = [];
    for (const item of items) {
      const t = item.timeline?.trim();
      if (t === "Now") now.push(item);
      else if (t === "Add next visit") addNext.push(item);
      else if (t === "Completed") completed.push(item);
      else wishlist.push(item);
    }
    const byTreatment = (a: DiscussedItem, b: DiscussedItem) =>
      (a.treatment || "").localeCompare(b.treatment || "");
    return {
      Now: now.sort(byTreatment),
      "Add next visit": addNext.sort(byTreatment),
      Wishlist: wishlist.sort(byTreatment),
      Completed: completed.sort(byTreatment),
    };
  }, [client.discussedItems]);

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
          onKeyDown={(e) => currentClientPhotoUrl && (e.key === "Enter" || e.key === " ") && setShowClientPhotoModal(true)}
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
              clientPhotoView === "front" ? "treatment-recommender-by-treatment__client-toggle--active" : ""
            }`}
            onClick={() => setClientPhotoView("front")}
            disabled={!hasFront}
          >
            Front
          </button>
          <button
            type="button"
            className={`treatment-recommender-by-treatment__client-toggle ${
              clientPhotoView === "side" ? "treatment-recommender-by-treatment__client-toggle--active" : ""
            }`}
            onClick={() => setClientPhotoView("side")}
            disabled={!hasSide}
          >
            Side
          </button>
        </div>

        <div className="treatment-recommender-by-treatment__plan-section">
          <h3 className="treatment-recommender-by-treatment__plan-title">
            {firstName}&apos;s plan ({planItemCount} {planItemCount === 1 ? "item" : "items"})
          </h3>
          {planItemCount === 0 ? (
            <p className="treatment-recommender-by-treatment__plan-empty">
              No plan items yet.
            </p>
          ) : (
            <div className="treatment-recommender-by-treatment__plan-list">
              {PLAN_SECTIONS.map((sectionLabel) => {
                const sectionItems = planItemsBySection[sectionLabel] ?? [];
                if (sectionItems.length === 0) return null;
                return (
                  <div
                    key={sectionLabel}
                    className="treatment-recommender-by-treatment__plan-group"
                  >
                    <h4 className="treatment-recommender-by-treatment__plan-group-title">
                      {sectionLabel}
                    </h4>
                    {sectionItems.map((item) => (
                      <button
                        key={item.id}
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
                    ))}
                  </div>
                );
              })}
            </div>
          )}
          {onOpenTreatmentPlan && (
            <button
              type="button"
              className="treatment-recommender-by-treatment__plan-open-btn"
              onClick={() => onOpenTreatmentPlan()}
            >
              {planItemCount === 0 ? "Open treatment plan" : "Open treatment plan"}
            </button>
          )}
        </div>
      </aside>

      <div className="treatment-recommender-by-treatment__main">
        <div className="treatment-recommender-by-treatment__body">
        <TreatmentRecommenderFilters
          state={filterState}
          onStateChange={(next) => setFilterState((s) => ({ ...s, ...next }))}
        />

        <h2 className="treatment-recommender-by-treatment__results-heading">
          {suggestedTreatments.length} treatment option{suggestedTreatments.length !== 1 ? "s" : ""}
        </h2>

        <div className="treatment-recommender-by-treatment__cards">
          {suggestedTreatments.length === 0 ? (
            <p className="treatment-recommender-by-treatment__empty">
              No treatments match the current filters. Select &quot;What are you here for?&quot; and optionally findings, regions, or general concerns.
            </p>
          ) : (
            suggestedTreatments.map((treatment) => {
              const cardPhotos = getPhotosForTreatment(treatment);
              const cardPhoto = cardPhotos[0];
              return (
              <div
                key={treatment}
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
                  getBreakdownRowsForTreatment={getBreakdownRowsForTreatment}
                  detectedIssues={detectedIssues}
                />

                <div className="treatment-recommender-by-treatment__card-actions">
                  <div className="treatment-recommender-by-treatment__add-section">
                    {isTreatmentInPlan(treatment) && addToPlanForTreatment?.treatment !== treatment ? (
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
                                skincareWhat: treatment === "Skincare" ? [] : undefined,
                                laserWhat: treatment === "Laser" ? [] : undefined,
                                biostimulantWhat: treatment === "Biostimulants" ? [] : undefined,
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
                        <div className="treatment-recommender-by-treatment__add-row">
                          <span>{treatment === "Skincare" || treatment === "Laser" || treatment === "Biostimulants" ? "What:" : "Where:"}</span>
                          <div className="treatment-recommender-by-treatment__chips">
                            {treatment === "Skincare"
                              ? skincareWhatOptions.map((opt) => {
                                  const selected = (addToPlanForTreatment.skincareWhat ?? []).includes(opt);
                                  return (
                                    <button
                                      key={opt}
                                      type="button"
                                      className={`treatment-recommender-by-treatment__chip ${
                                        selected ? "treatment-recommender-by-treatment__chip--selected" : ""
                                      }`}
                                      onClick={() =>
                                        setAddToPlanForTreatment((prev) => {
                                          if (!prev) return null;
                                          const current = prev.skincareWhat ?? [];
                                          const next = current.includes(opt)
                                            ? current.filter((x) => x !== opt)
                                            : [...current, opt];
                                          return { ...prev, skincareWhat: next };
                                        })
                                      }
                                    >
                                      {opt}
                                    </button>
                                  );
                                })
                              : treatment === "Laser"
                                ? laserWhatOptions.map((opt) => {
                                    const selected = (addToPlanForTreatment.laserWhat ?? []).includes(opt);
                                    return (
                                      <button
                                        key={opt}
                                        type="button"
                                        className={`treatment-recommender-by-treatment__chip ${
                                          selected ? "treatment-recommender-by-treatment__chip--selected" : ""
                                        }`}
                                        onClick={() =>
                                          setAddToPlanForTreatment((prev) => {
                                            if (!prev) return null;
                                            const current = prev.laserWhat ?? [];
                                            const next = current.includes(opt)
                                              ? current.filter((x) => x !== opt)
                                              : [...current, opt];
                                            return { ...prev, laserWhat: next };
                                          })
                                        }
                                      >
                                        {opt}
                                      </button>
                                    );
                                  })
                                : treatment === "Biostimulants"
                                  ? biostimulantWhatOptions.map((opt) => {
                                      const selected = (addToPlanForTreatment.biostimulantWhat ?? []).includes(opt);
                                      return (
                                        <button
                                          key={opt}
                                          type="button"
                                          className={`treatment-recommender-by-treatment__chip ${
                                            selected ? "treatment-recommender-by-treatment__chip--selected" : ""
                                          }`}
                                          onClick={() =>
                                            setAddToPlanForTreatment((prev) => {
                                              if (!prev) return null;
                                              const current = prev.biostimulantWhat ?? [];
                                              const next = current.includes(opt)
                                                ? current.filter((x) => x !== opt)
                                                : [...current, opt];
                                              return { ...prev, biostimulantWhat: next };
                                            })
                                          }
                                        >
                                          {opt}
                                        </button>
                                      );
                                    })
                                  : whereOptions.map((r) => (
                                  <button
                                    key={r}
                                    type="button"
                                    className={`treatment-recommender-by-treatment__chip ${
                                      addToPlanForTreatment.where.includes(r)
                                        ? "treatment-recommender-by-treatment__chip--selected"
                                        : ""
                                    }`}
                                    onClick={() => {
                                      setAddToPlanForTreatment((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              where: prev.where.includes(r)
                                                ? prev.where.filter((x) => x !== r)
                                                : [...prev.where, r],
                                            }
                                          : null
                                      );
                                    }}
                                  >
                                    {r}
                                  </button>
                                ))}
                            {/* Custom (user-typed) options; click chip to remove */}
                            {treatment === "Skincare" &&
                              (addToPlanForTreatment.skincareWhat ?? [])
                                .filter((s) => !skincareWhatOptions.includes(s))
                                .map((customVal) => (
                                  <button
                                    key={customVal}
                                    type="button"
                                    className="treatment-recommender-by-treatment__chip treatment-recommender-by-treatment__chip--selected"
                                    onClick={() =>
                                      setAddToPlanForTreatment((prev) =>
                                        prev ? { ...prev, skincareWhat: (prev.skincareWhat ?? []).filter((x) => x !== customVal) } : null
                                      )
                                    }
                                  >
                                    {customVal}
                                  </button>
                                ))}
                            {treatment === "Laser" &&
                              (addToPlanForTreatment.laserWhat ?? [])
                                .filter((l) => !laserWhatOptions.includes(l))
                                .map((customVal) => (
                                  <button
                                    key={customVal}
                                    type="button"
                                    className="treatment-recommender-by-treatment__chip treatment-recommender-by-treatment__chip--selected"
                                    onClick={() =>
                                      setAddToPlanForTreatment((prev) =>
                                        prev ? { ...prev, laserWhat: (prev.laserWhat ?? []).filter((x) => x !== customVal) } : null
                                      )
                                    }
                                  >
                                    {customVal}
                                  </button>
                                ))}
                            {treatment === "Biostimulants" &&
                              (addToPlanForTreatment.biostimulantWhat ?? [])
                                .filter((b) => !biostimulantWhatOptions.includes(b))
                                .map((customVal) => (
                                  <button
                                    key={customVal}
                                    type="button"
                                    className="treatment-recommender-by-treatment__chip treatment-recommender-by-treatment__chip--selected"
                                    onClick={() =>
                                      setAddToPlanForTreatment((prev) =>
                                        prev ? { ...prev, biostimulantWhat: (prev.biostimulantWhat ?? []).filter((x) => x !== customVal) } : null
                                      )
                                    }
                                  >
                                    {customVal}
                                  </button>
                                ))}
                            {treatment !== "Skincare" &&
                              treatment !== "Laser" &&
                              treatment !== "Biostimulants" &&
                              addToPlanForTreatment.where
                                .filter((w) => !whereOptions.includes(w))
                                .map((customVal) => (
                                  <button
                                    key={customVal}
                                    type="button"
                                    className="treatment-recommender-by-treatment__chip treatment-recommender-by-treatment__chip--selected"
                                    onClick={() =>
                                      setAddToPlanForTreatment((prev) =>
                                        prev ? { ...prev, where: prev.where.filter((x) => x !== customVal) } : null
                                      )
                                    }
                                  >
                                    {customVal}
                                  </button>
                                ))}
                          </div>
                          <div className="treatment-recommender-by-treatment__add-custom">
                            <input
                              type="text"
                              className="treatment-recommender-by-treatment__custom-input"
                              placeholder="Type to add option..."
                              value={customOptionInput}
                              onChange={(e) => setCustomOptionInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  addCustomOption();
                                }
                              }}
                              aria-label="Add custom option"
                            />
                            <button
                              type="button"
                              className="treatment-recommender-by-treatment__custom-add-btn"
                              onClick={addCustomOption}
                            >
                              Add
                            </button>
                          </div>
                        </div>
                        <div className="treatment-recommender-by-treatment__add-row">
                          <span>When:</span>
                          <div className="treatment-recommender-by-treatment__chips">
                            {TIMELINE_OPTIONS.filter((t) => t !== "Completed").map((t) => (
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
                                    prev ? { ...prev, when: t } : null
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
                                    prev ? { ...prev, product: e.target.value } : null
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
                                    prev ? { ...prev, quantity: e.target.value } : null
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
                                    prev ? { ...prev, notes: e.target.value } : null
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
                            onClick={() => {
                              setAddToPlanForTreatment(null);
                              setCustomOptionInput("");
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
                        onClick={() =>
                          setAddToPlanForTreatment({
                            treatment,
                            where: [],
                            skincareWhat: treatment === "Skincare" ? [] : undefined,
                            laserWhat: treatment === "Laser" ? [] : undefined,
                            biostimulantWhat: treatment === "Biostimulants" ? [] : undefined,
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
                            ? getInternalRegionForFilter(filterState.region[0])
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

      {showClientPhotoModal && (hasFront || hasSide) && (
        <div
          className="treatment-recommender-by-treatment__photo-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={`${client.name} – ${clientPhotoView} photo`}
          onClick={() => setShowClientPhotoModal(false)}
        >
          <div
            className="treatment-recommender-by-treatment__photo-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="treatment-recommender-by-treatment__photo-modal-img-wrap">
              <button
                type="button"
                className="treatment-recommender-by-treatment__photo-modal-close"
                onClick={() => setShowClientPhotoModal(false)}
                aria-label="Close"
              >
                ×
              </button>
              {currentClientPhotoUrl && (
                <img
                  src={currentClientPhotoUrl}
                  alt={`${client.name} – ${clientPhotoView}`}
                  className="treatment-recommender-by-treatment__photo-modal-img"
                />
              )}
            </div>
            <div className="treatment-recommender-by-treatment__photo-modal-toggles">
              <button
                type="button"
                className={`treatment-recommender-by-treatment__photo-modal-toggle ${
                  clientPhotoView === "front" ? "treatment-recommender-by-treatment__photo-modal-toggle--active" : ""
                }`}
                onClick={() => setClientPhotoView("front")}
                disabled={!hasFront}
              >
                Front
              </button>
              <button
                type="button"
                className={`treatment-recommender-by-treatment__photo-modal-toggle ${
                  clientPhotoView === "side" ? "treatment-recommender-by-treatment__photo-modal-toggle--active" : ""
                }`}
                onClick={() => setClientPhotoView("side")}
                disabled={!hasSide}
              >
                Side
              </button>
            </div>
            <p className="treatment-recommender-by-treatment__photo-modal-caption">
              {client.name} – {clientPhotoView}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
