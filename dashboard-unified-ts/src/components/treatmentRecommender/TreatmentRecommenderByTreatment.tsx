/**
 * Treatment Recommender – by treatment.
 * Full-width treatment cards with feature breakdown and Add to plan.
 */

import { useMemo, useState, useEffect } from "react";
import { Client, TreatmentPhoto, DiscussedItem } from "../../types";
import { fetchTreatmentPhotos, fetchTableRecords } from "../../services/api";
import type { AirtableRecord } from "../../services/api";
import { normalizeIssue, scoreTier, tierColor, scoreIssues, CATEGORIES } from "../../config/analysisOverviewConfig";
import {
  DEFAULT_RECOMMENDER_FILTER_STATE,
  filterTreatmentsBySameDay,
  getInternalRegionForFilter,
  type TreatmentRecommenderFilterState,
} from "../../config/treatmentRecommenderConfig";
import { getSuggestedTreatmentsForFindings } from "../modals/DiscussedTreatmentsModal/utils";
import { getFindingsByAreaForTreatment } from "../modals/DiscussedTreatmentsModal/utils";
import { REGION_OPTIONS, TIMELINE_OPTIONS } from "../modals/DiscussedTreatmentsModal/constants";
import type { TreatmentPlanPrefill } from "../modals/DiscussedTreatmentsModal/TreatmentPhotos";
import TreatmentRecommenderFilters from "./TreatmentRecommenderFilters";
import TreatmentPhotosModal from "../modals/TreatmentPhotosModal";
import "../modals/AnalysisOverviewModal.css";
import "./TreatmentRecommenderByTreatment.css";

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

/** Collapsible feature breakdown row (check/x pills + bar) – same pattern as AnalysisOverviewModal SubScoreRow. */
function FeatureBreakdownRow({
  label,
  issues,
  detectedIssues,
}: {
  label: string;
  issues: string[];
  detectedIssues: Set<string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const score = scoreIssues(issues, detectedIssues);
  const color = tierColor(scoreTier(score));
  const goodIssues = issues.filter((i) => !detectedIssues.has(normalizeIssue(i)));
  const badIssues = issues.filter((i) => detectedIssues.has(normalizeIssue(i)));

  if (issues.length === 0) return null;

  return (
    <div className={`ao-subscore-row ${expanded ? "ao-subscore-row--open" : ""}`}>
      <button
        type="button"
        className="ao-subscore-row__header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="ao-subscore-row__name">{label}</span>
        <div className="ao-subscore-row__bar-wrap">
          <div className="ao-subscore-row__bar-track">
            <div
              className="ao-subscore-row__bar-fill"
              style={{ width: `${score}%`, background: color }}
            />
          </div>
          <span className="ao-subscore-row__score" style={{ color }}>
            {score}
          </span>
        </div>
        <span className="ao-subscore-row__chev" aria-hidden>
          {expanded ? "▲" : "▼"}
        </span>
      </button>
      {expanded && (
        <div className="ao-subscore-row__pills">
          {goodIssues.map((issue) => (
            <span key={issue} className="ao-pill ao-pill--good">
              <span className="ao-pill__icon">✓</span>
              {issue}
            </span>
          ))}
          {badIssues.map((issue) => (
            <span key={issue} className="ao-pill ao-pill--concern">
              <span className="ao-pill__icon">✕</span>
              {issue}
            </span>
          ))}
        </div>
      )}
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
  onBack,
  onUpdate,
  onAddToPlanDirect,
  onOpenTreatmentPlan,
  onOpenTreatmentPlanWithPrefill,
  onOpenTreatmentPlanWithItem,
  treatmentPlanModalClosedRef,
}: TreatmentRecommenderByTreatmentProps) {
  /** Item we just added so we can open it for editing when user clicks "Add additional details". Cleared when modal closes. */
  const [lastAddedItem, setLastAddedItem] = useState<DiscussedItem | null>(null);
  const [filterState, setFilterState] = useState<TreatmentRecommenderFilterState>(
    () => ({ ...DEFAULT_RECOMMENDER_FILTER_STATE })
  );
  const [addToPlanForTreatment, setAddToPlanForTreatment] = useState<{
    treatment: string;
    where: string[];
    when: string;
    detailsExpanded: boolean;
    product?: string;
    quantity?: string;
    notes?: string;
  } | null>(null);
  const [photoExplorerContext, setPhotoExplorerContext] = useState<{
    treatment: string;
    region?: string;
  } | null>(null);
  const [treatmentPhotos, setTreatmentPhotos] = useState<TreatmentPhoto[]>([]);
  const [clientPhotoView, setClientPhotoView] = useState<"front" | "side">("front");
  const [frontPhotoUrl, setFrontPhotoUrl] = useState<string | null>(null);
  const [sidePhotoUrl, setSidePhotoUrl] = useState<string | null>(null);

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

  const detectedIssues = useMemo(() => getDetectedIssues(client), [client]);

  const getPhotosForTreatment = (treatmentName: string): TreatmentPhoto[] =>
    treatmentPhotos.filter((p) => photoMatchesTreatment(p, treatmentName));

  const combinedFindings = useMemo(() => {
    const fromClient = Array.from(detectedIssues);
    const fromFilter = filterState.findingsToAddress || [];
    const set = new Set<string>([...fromClient, ...fromFilter]);
    return Array.from(set);
  }, [detectedIssues, filterState.findingsToAddress]);

  const suggestedTreatments = useMemo(() => {
    const withGoals = getSuggestedTreatmentsForFindings(combinedFindings);
    const names = Array.from(new Set(withGoals.map((s) => s.treatment)));
    return filterTreatmentsBySameDay(names, filterState.sameDayAddOn);
  }, [combinedFindings, filterState.sameDayAddOn]);

  const handleAddToPlanConfirm = async () => {
    if (!addToPlanForTreatment || !onAddToPlanDirect) return;
    const region = addToPlanForTreatment.where.length > 0
      ? addToPlanForTreatment.where.join(", ")
      : "";
    const prefill: TreatmentPlanPrefill = {
      interest: "",
      region,
      treatment: addToPlanForTreatment.treatment,
      timeline: addToPlanForTreatment.when,
      treatmentProduct: addToPlanForTreatment.product?.trim() || undefined,
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

  return (
    <div className="treatment-recommender-by-treatment">
      <aside className="treatment-recommender-by-treatment__client-column">
        <div className="treatment-recommender-by-treatment__client-photo-wrap">
          {currentClientPhotoUrl ? (
            <img
              src={currentClientPhotoUrl}
              alt={`${client.name} – ${clientPhotoView}`}
              className="treatment-recommender-by-treatment__client-photo"
            />
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
      </aside>

      <div className="treatment-recommender-by-treatment__main">
        <header className="treatment-recommender-by-treatment__header">
          <button
            type="button"
            className="treatment-recommender-by-treatment__back"
            onClick={onBack}
          >
            ← Back to client
          </button>
          <h1 className="treatment-recommender-by-treatment__title">
            Treatment recommender (by treatment)
          </h1>
        </header>

        <div className="treatment-recommender-by-treatment__body">
        <TreatmentRecommenderFilters
          state={filterState}
          onStateChange={(next) => setFilterState((s) => ({ ...s, ...next }))}
        />

        <div className="treatment-recommender-by-treatment__cards">
          {suggestedTreatments.length === 0 ? (
            <p className="treatment-recommender-by-treatment__empty">
              Select "What are you here for?" and optionally findings to see suggested treatments.
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
                  {cardPhoto && (
                    <div className="treatment-recommender-by-treatment__card-photo-wrap">
                      <img
                        src={cardPhoto.thumbnailUrl || cardPhoto.photoUrl}
                        alt=""
                        className="treatment-recommender-by-treatment__card-photo"
                      />
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

                <div className="treatment-recommender-by-treatment__breakdown">
                  <h3 className="treatment-recommender-by-treatment__breakdown-title">
                    Feature breakdown
                  </h3>
                  {getBreakdownRowsForTreatment(treatment).map((row) => (
                    <FeatureBreakdownRow
                      key={row.label}
                      label={row.label}
                      issues={row.issues}
                      detectedIssues={detectedIssues}
                    />
                  ))}
                </div>

                <div className="treatment-recommender-by-treatment__card-actions">
                  <div className="treatment-recommender-by-treatment__add-section">
                    {isTreatmentInPlan(treatment) ? (
                      <div className="treatment-recommender-by-treatment__added-state">
                        <p className="treatment-recommender-by-treatment__added-message">
                          Added to treatment plan
                        </p>
                        {onOpenTreatmentPlanWithItem ? (
                          <button
                            type="button"
                            className="treatment-recommender-by-treatment__add-details-btn"
                            onClick={() => {
                              const itemToEdit =
                                lastAddedItem && lastAddedItem.treatment === treatment
                                  ? lastAddedItem
                                  : [...(client.discussedItems ?? [])].reverse().find((i) => i.treatment === treatment);
                              if (itemToEdit) onOpenTreatmentPlanWithItem(itemToEdit);
                              else if (onOpenTreatmentPlan) onOpenTreatmentPlan();
                            }}
                          >
                            Add additional details
                          </button>
                        ) : onOpenTreatmentPlan ? (
                          <button
                            type="button"
                            className="treatment-recommender-by-treatment__add-details-btn"
                            onClick={() => onOpenTreatmentPlan()}
                          >
                            Add additional details
                          </button>
                        ) : null}
                      </div>
                    ) : addToPlanForTreatment?.treatment === treatment ? (
                      <div className="treatment-recommender-by-treatment__add-form">
                        <div className="treatment-recommender-by-treatment__add-row">
                          <span>Where:</span>
                          <div className="treatment-recommender-by-treatment__chips">
                            {REGION_OPTIONS.filter((r) => r !== "Multiple" && r !== "Other").map((r) => (
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
    </div>
  );
}
