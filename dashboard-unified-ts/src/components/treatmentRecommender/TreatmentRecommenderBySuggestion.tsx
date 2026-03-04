/**
 * Treatment Recommender – by suggestion.
 * Full-width suggestion cards with client photo, feature breakdown, and View examples.
 */

import { useMemo, useState, useEffect } from "react";
import { Client, DiscussedItem } from "../../types";
import {
  fetchTableRecords,
  fetchPatientRecords,
  getAreaCroppedPhotoUrl,
  parsePatientRecordsToCards,
  type PatientSuggestionCard,
  PATIENT_RECORDS_PHOTO_FIELD,
  PATIENT_RECORDS_SUGGESTION_NAME_FIELD,
} from "../../services/api";
import {
  normalizeIssue,
  scoreTier,
  tierColor,
  scoreIssues,
} from "../../config/analysisOverviewConfig";
import {
  DEFAULT_RECOMMENDER_FILTER_STATE,
  filterSuggestionsByRegion,
  filterSuggestionsByFindings,
  getFindingsFromConcerns,
  AREA_CROPPED_PHOTO_FIELDS,
  type TreatmentRecommenderFilterState,
} from "../../config/treatmentRecommenderConfig";
import { SAME_DAY_TREATMENTS } from "../../config/treatmentRecommenderConfig";
import {
  ALL_TREATMENT_INTERESTS,
  SUGGESTION_TO_AREA,
  SUGGESTION_TO_ISSUES,
} from "../modals/DiscussedTreatmentsModal/suggestionsMapping";
import { getTreatmentsForInterest } from "../modals/DiscussedTreatmentsModal/utils";
import {
  REGION_OPTIONS,
  TIMELINE_OPTIONS,
  getSkincareCarouselItems,
} from "../modals/DiscussedTreatmentsModal/constants";
import {
  GEMSTONE_BY_SKIN_TYPE,
  RECOMMENDED_PRODUCT_REASONS,
} from "../../data/skinTypeQuiz";
import { showToast } from "../../utils/toast";
import { groupIssuesByConcern } from "../../config/issueToConcernMapping";
import type { TreatmentPlanPrefill } from "../modals/DiscussedTreatmentsModal/TreatmentPhotos";
import TreatmentRecommenderFilters from "./TreatmentRecommenderFilters";
import TreatmentPhotosModal from "../modals/TreatmentPhotosModal";
import "../modals/AnalysisOverviewModal.css";
import "./TreatmentRecommenderBySuggestion.css";

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

/** Collapsible feature breakdown row – same pattern as by-treatment. */
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
  const goodIssues = issues.filter(
    (i) => !detectedIssues.has(normalizeIssue(i)),
  );
  const badIssues = issues.filter((i) => detectedIssues.has(normalizeIssue(i)));

  if (issues.length === 0) return null;

  return (
    <div
      className={`ao-subscore-row ${expanded ? "ao-subscore-row--open" : ""}`}
    >
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

/** Issues for a suggestion: CSV list when available, else empty (breakdown will use API issuesString when present). */
function getIssuesForSuggestion(suggestionName: string): string[] {
  return SUGGESTION_TO_ISSUES[suggestionName] ?? [];
}

export interface TreatmentRecommenderBySuggestionProps {
  client: Client;
  onBack: () => void;
  onUpdate?: () => void | Promise<void>;
  /** Add item directly to plan and show success; then user can click "Add additional details" to open the plan modal. Returns the new item so we can open it for editing. */
  onAddToPlanDirect?: (
    prefill: TreatmentPlanPrefill,
  ) => Promise<DiscussedItem | void> | void;
  /** Open the treatment plan modal (e.g. for "Add additional details"). */
  onOpenTreatmentPlan?: () => void;
  /** Open the treatment plan modal with prefill (e.g. from View examples → Add to plan). */
  onOpenTreatmentPlanWithPrefill?: (prefill: TreatmentPlanPrefill) => void;
  /** Open the treatment plan modal with this item selected for editing ("Add additional details"). */
  onOpenTreatmentPlanWithItem?: (item: DiscussedItem) => void;
  /** Ref set by parent; when treatment plan modal closes, parent will call this so we clear "just added" state. */
  treatmentPlanModalClosedRef?: React.MutableRefObject<(() => void) | null>;
}

export default function TreatmentRecommenderBySuggestion({
  client,
  onBack: _onBack,
  onUpdate,
  onAddToPlanDirect,
  onOpenTreatmentPlan,
  onOpenTreatmentPlanWithPrefill,
  onOpenTreatmentPlanWithItem,
  treatmentPlanModalClosedRef,
}: TreatmentRecommenderBySuggestionProps) {
  /** Item we just added so we can open it for editing when user clicks "Add additional details". Cleared when modal closes. */
  const [lastAddedItem, setLastAddedItem] = useState<DiscussedItem | null>(
    null,
  );
  const [filterState, setFilterState] =
    useState<TreatmentRecommenderFilterState>(() => ({
      ...DEFAULT_RECOMMENDER_FILTER_STATE,
    }));
  const [clientFrontPhotoUrl, setClientFrontPhotoUrl] = useState<string | null>(
    null,
  );
  /** Area name -> URL for area cropped photos from Patients table (fallback). */
  const [areaPhotoUrls, setAreaPhotoUrls] = useState<Record<string, string>>(
    {},
  );
  /** Suggestion name -> URL from patient-records API (Area Cropped Photos). Takes precedence when set. */
  const [suggestionPhotoUrls, setSuggestionPhotoUrls] = useState<
    Record<string, string>
  >({});
  /** Cards from patient-records API (one per suggestion with short summary, AI summary, etc.). When set, we use these as the card list. */
  const [apiCards, setApiCards] = useState<PatientSuggestionCard[]>([]);
  const [failedPhotoUrls, setFailedPhotoUrls] = useState<Set<string>>(
    new Set(),
  );
  const [photoExplorerInterest, setPhotoExplorerInterest] = useState<
    string | null
  >(null);
  const [addToPlanForSuggestion, setAddToPlanForSuggestion] = useState<{
    suggestionName: string;
    what: string;
    where: string[];
    when: string;
    product?: string;
    quantity?: string;
    notes?: string;
  } | null>(null);

  const getUrlFromAttachment = (att: {
    thumbnails?: { full?: { url?: string }; large?: { url?: string } };
    url?: string;
  }) =>
    att?.thumbnails?.full?.url ??
    att?.thumbnails?.large?.url ??
    att?.url ??
    null;

  const detectedIssues = useMemo(() => getDetectedIssues(client), [client]);

  /** All selected findings (explicit + from general concerns) used to filter suggestions. */
  const effectiveFindings = useMemo(() => {
    const fromConcerns = getFindingsFromConcerns(filterState.generalConcerns);
    const set = new Set([...filterState.findingsToAddress, ...fromConcerns]);
    return Array.from(set);
  }, [filterState.findingsToAddress, filterState.generalConcerns]);

  const staticSuggestionList = useMemo(() => {
    let list = [...ALL_TREATMENT_INTERESTS];
    if (filterState.region.length > 0) {
      list = filterSuggestionsByRegion(list, filterState.region);
    }
    if (effectiveFindings.length > 0) {
      list = filterSuggestionsByFindings(
        list,
        effectiveFindings,
        SUGGESTION_TO_ISSUES,
      );
    }
    if (filterState.sameDayAddOn) {
      list = list.filter((name) => {
        const treatments = getTreatmentsForInterest(name);
        return treatments.some((t) =>
          (SAME_DAY_TREATMENTS as readonly string[]).includes(t),
        );
      });
    }
    return list;
  }, [filterState.region, filterState.sameDayAddOn, effectiveFindings]);

  /** When we have API cards, filter and sort them (focus first, then by name). Otherwise use static list. */
  const displayCards = useMemo(():
    | { type: "api"; cards: PatientSuggestionCard[] }
    | { type: "static"; names: string[] } => {
    if (apiCards.length === 0) {
      return { type: "static", names: staticSuggestionList };
    }
    let list = apiCards;
    if (filterState.region.length > 0) {
      const allowedNames = new Set(
        filterSuggestionsByRegion(
          apiCards.map((c) => c.suggestionName),
          filterState.region,
        ),
      );
      list = list.filter((c) => allowedNames.has(c.suggestionName));
    }
    if (effectiveFindings.length > 0) {
      const allowedNames = new Set(
        filterSuggestionsByFindings(
          list.map((c) => c.suggestionName),
          effectiveFindings,
          SUGGESTION_TO_ISSUES,
        ),
      );
      list = list.filter((c) => allowedNames.has(c.suggestionName));
    }
    if (filterState.sameDayAddOn) {
      list = list.filter((c) => {
        const treatments = getTreatmentsForInterest(c.suggestionName);
        return treatments.some((t) =>
          (SAME_DAY_TREATMENTS as readonly string[]).includes(t),
        );
      });
    }
    const sorted = [...list].sort((a, b) => {
      if (a.isFocusArea !== b.isFocusArea) return a.isFocusArea ? -1 : 1;
      return a.suggestionName.localeCompare(b.suggestionName);
    });
    return { type: "api", cards: sorted };
  }, [
    apiCards,
    filterState.region,
    filterState.sameDayAddOn,
    effectiveFindings,
    staticSuggestionList,
  ]);

  type CardViewItem =
    | { source: "api"; card: PatientSuggestionCard }
    | { source: "static"; suggestionName: string };
  const viewItems: CardViewItem[] = useMemo(() => {
    if (displayCards.type === "api") {
      return displayCards.cards.map((card) => ({
        source: "api" as const,
        card,
      }));
    }
    return displayCards.names.map((suggestionName) => ({
      source: "static" as const,
      suggestionName,
    }));
  }, [displayCards]);

  const handleAddToPlanConfirm = async () => {
    if (!addToPlanForSuggestion || !onAddToPlanDirect) return;
    const region =
      addToPlanForSuggestion.where.length > 0
        ? addToPlanForSuggestion.where.join(", ")
        : (SUGGESTION_TO_AREA[addToPlanForSuggestion.suggestionName] ?? "");
    const prefill: TreatmentPlanPrefill = {
      interest: addToPlanForSuggestion.suggestionName,
      region,
      treatment:
        (addToPlanForSuggestion.what?.trim() ||
          getTreatmentsForInterest(addToPlanForSuggestion.suggestionName)[0]) ??
        "",
      timeline: addToPlanForSuggestion.when,
      treatmentProduct: addToPlanForSuggestion.product?.trim() || undefined,
      quantity: addToPlanForSuggestion.quantity?.trim() || undefined,
      notes: addToPlanForSuggestion.notes?.trim() || undefined,
    };
    try {
      const newItem = await onAddToPlanDirect(prefill);
      setAddToPlanForSuggestion(null);
      if (newItem) setLastAddedItem(newItem);
    } catch {
      /* parent shows error */
    }
  };

  /** Whether this suggestion is already in the treatment plan (so we show "Added" and "Add additional details"). */
  const isSuggestionInPlan = (suggestionName: string): boolean => {
    if (lastAddedItem && lastAddedItem.interest === suggestionName) return true;
    return (client.discussedItems ?? []).some(
      (i) => i.interest === suggestionName,
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

  const isInPlanOrInterests = (suggestionName: string): boolean => {
    const interested = client.interestedIssues;
    if (interested && typeof interested === "string") {
      const list = interested.split(",").map((s) => s.trim());
      if (list.some((s) => s.toLowerCase() === suggestionName.toLowerCase()))
        return true;
    }
    const items = client.discussedItems ?? [];
    if (
      items.some(
        (item) =>
          (item.interest?.trim().toLowerCase() ?? "") ===
          suggestionName.toLowerCase(),
      )
    )
      return true;
    return false;
  };

  useEffect(() => {
    const areaPhotoFieldList = [
      ...new Set(Object.values(AREA_CROPPED_PHOTO_FIELDS)),
    ];

    if (!client || client.tableSource !== "Patients") {
      if (
        client?.frontPhoto &&
        Array.isArray(client.frontPhoto) &&
        client.frontPhoto.length > 0
      ) {
        const url = getUrlFromAttachment(client.frontPhoto[0]);
        setClientFrontPhotoUrl(url ?? null);
      } else {
        setClientFrontPhotoUrl(null);
      }
      setAreaPhotoUrls({});
      return;
    }

    let mounted = true;
    const fieldsToFetch = ["Front Photo", ...areaPhotoFieldList];
    fetchTableRecords("Patients", {
      filterFormula: `RECORD_ID() = "${client.id}"`,
      fields: fieldsToFetch,
    })
      .then((records) => {
        if (!mounted || records.length === 0) return;
        const fields = records[0].fields;

        const front = fields["Front Photo"] ?? fields["Front photo"];
        if (front && Array.isArray(front) && front.length > 0) {
          const url = getUrlFromAttachment(front[0]);
          setClientFrontPhotoUrl(url ?? null);
        } else {
          setClientFrontPhotoUrl(null);
        }

        const areaUrls: Record<string, string> = {};
        for (const [areaName, fieldName] of Object.entries(
          AREA_CROPPED_PHOTO_FIELDS,
        )) {
          const val = fields[fieldName];
          if (val && Array.isArray(val) && val.length > 0) {
            const url = getUrlFromAttachment(val[0]);
            if (url) areaUrls[areaName] = url;
          }
        }
        setAreaPhotoUrls(areaUrls);
      })
      .catch(() => {
        setClientFrontPhotoUrl(null);
        setAreaPhotoUrls({});
      });
    return () => {
      mounted = false;
    };
  }, [client]);

  // Fetch patient-records (Patient-Issue/Suggestion Mapping) for cards + photo map (SUGGESTION_CARDS_INTEGRATION.md).
  useEffect(() => {
    const email = client?.email?.trim();
    if (!email) {
      setSuggestionPhotoUrls({});
      setApiCards([]);
      return;
    }
    let mounted = true;
    fetchPatientRecords(email)
      .then((records) => {
        if (!mounted) return;
        const map: Record<string, string> = {};
        for (const record of records) {
          const fields = record.fields || {};
          const suggestionName = fields[PATIENT_RECORDS_SUGGESTION_NAME_FIELD];
          const photo = fields[PATIENT_RECORDS_PHOTO_FIELD];
          const url = getAreaCroppedPhotoUrl(photo);
          if (suggestionName && url) {
            const name =
              typeof suggestionName === "string"
                ? suggestionName
                : String(suggestionName);
            map[name] = url;
          }
        }
        setSuggestionPhotoUrls(map);
        setApiCards(parsePatientRecordsToCards(records));
      })
      .catch(() => {
        setSuggestionPhotoUrls({});
        setApiCards([]);
      });
    return () => {
      mounted = false;
    };
  }, [client?.email]);

  /**
   * Photo for a suggestion uses the same logic for all cards:
   * 1) patient-records API (exact or case-insensitive match on "Name (from Suggestions)");
   * 2) else Patients table area crop (by SUGGESTION_TO_AREA, e.g. Balance Brows → Forehead);
   * 3) else client front photo.
   * Missing photos usually mean no record/photo in patient-records for that suggestion and no area crop on the Patient.
   */
  const getPhotoUrlForSuggestion = (
    suggestionName: string,
    area: string | undefined,
  ): string | null => {
    const fromApi =
      suggestionPhotoUrls[suggestionName] ??
      Object.entries(suggestionPhotoUrls).find(
        ([key]) =>
          key.trim().toLowerCase() === suggestionName.trim().toLowerCase(),
      )?.[1];
    if (fromApi) return fromApi;
    if (area && areaPhotoUrls[area]) return areaPhotoUrls[area];
    return clientFrontPhotoUrl;
  };

  return (
    <div className="treatment-recommender-by-suggestion">
      <div className="treatment-recommender-by-suggestion__body">
        <TreatmentRecommenderFilters
          state={filterState}
          onStateChange={(next) => setFilterState((s) => ({ ...s, ...next }))}
        />

        {client.skincareQuiz && (
          <div className="treatment-recommender-skin-analysis">
            <h3 className="treatment-recommender-skin-analysis__title">
              Recommended for you
            </h3>
            {client.skincareQuiz.completedAt && (
              <p className="treatment-recommender-skin-analysis__completed">
                Quiz Completed{" "}
                {new Date(client.skincareQuiz.completedAt).toLocaleDateString(
                  "en-US",
                  {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  },
                )}
              </p>
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
                    · {
                      GEMSTONE_BY_SKIN_TYPE[client.skincareQuiz.result].name
                    }{" "}
                    💎{" "}
                    {GEMSTONE_BY_SKIN_TYPE[client.skincareQuiz.result].tagline}
                  </span>
                )}
            </div>
            {client.skincareQuiz.recommendedProductNames &&
              client.skincareQuiz.recommendedProductNames.length > 0 &&
              (() => {
                const carouselItems = getSkincareCarouselItems();
                const products =
                  client.skincareQuiz!.recommendedProductNames!.map((name) => {
                    const item = carouselItems.find((p) => p.name === name);
                    const context = RECOMMENDED_PRODUCT_REASONS[name] ?? "";
                    return item
                      ? { name, imageUrl: item.imageUrl, context }
                      : {
                          name,
                          imageUrl: undefined,
                          context: RECOMMENDED_PRODUCT_REASONS[name] ?? "",
                        };
                  });
                return (
                  <div className="treatment-recommender-skin-analysis__products">
                    <span className="treatment-recommender-skin-analysis__products-label">
                      Skincare (from skin quiz)
                    </span>
                    <div className="treatment-recommender-skin-analysis__chips">
                      {products.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="treatment-recommender-skin-analysis__chip treatment-recommender-skin-analysis__chip--add"
                          onClick={async () => {
                            if (!onAddToPlanDirect) return;
                            const prefill: TreatmentPlanPrefill = {
                              interest: "",
                              region: "",
                              treatment: "Skincare",
                              treatmentProduct:
                                p.name.split("|")[0]?.trim() ?? p.name,
                              timeline: TIMELINE_OPTIONS[0],
                              notes: p.context || undefined,
                            };
                            try {
                              await onAddToPlanDirect(prefill);
                              showToast("Added to treatment plan");
                            } catch {
                              showToast("Could not add to plan");
                            }
                          }}
                          title={
                            p.context
                              ? `Add to plan – ${p.context}`
                              : "Add to treatment plan"
                          }
                        >
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt=""
                              className="treatment-recommender-skin-analysis__chip-thumb"
                            />
                          ) : (
                            <span className="treatment-recommender-skin-analysis__chip-placeholder">
                              ◆
                            </span>
                          )}
                          <span className="treatment-recommender-skin-analysis__chip-name">
                            {p.name.split("|")[0]?.trim() ?? p.name}
                          </span>
                          {p.context && (
                            <span className="treatment-recommender-skin-analysis__chip-context">
                              {p.context}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
          </div>
        )}

        <h2 className="treatment-recommender-by-suggestion__results-heading">
          {viewItems.length} suggestion{viewItems.length !== 1 ? "s" : ""}
        </h2>

        <div className="treatment-recommender-by-suggestion__cards">
          {viewItems.length === 0 ? (
            <p className="treatment-recommender-by-suggestion__empty">
              No suggestions match the current filters. Try expanding filters or
              changing region, findings, or same-day.
            </p>
          ) : (
            viewItems.map((item) => {
              const suggestionName =
                item.source === "api"
                  ? item.card.suggestionName
                  : item.suggestionName;
              const areaNamesRaw =
                item.source === "api" ? item.card.areaNames : undefined;
              const areaNamesArr =
                areaNamesRaw == null
                  ? []
                  : Array.isArray(areaNamesRaw)
                    ? areaNamesRaw
                    : String(areaNamesRaw)
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean);
              const area =
                item.source === "api"
                  ? (areaNamesArr[0] ?? SUGGESTION_TO_AREA[suggestionName])
                  : SUGGESTION_TO_AREA[suggestionName];
              const cardPhotoUrl =
                item.source === "api" && item.card.photoUrl
                  ? item.card.photoUrl
                  : getPhotoUrlForSuggestion(suggestionName, area ?? undefined);
              const fullSuggestionIssues =
                getIssuesForSuggestion(suggestionName);
              const issuesList =
                fullSuggestionIssues.length > 0
                  ? fullSuggestionIssues
                  : item.source === "api" && item.card.issuesString
                    ? item.card.issuesString
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean)
                    : [];
              const breakdownRows = groupIssuesByConcern(issuesList);
              const inPlan = isInPlanOrInterests(suggestionName);
              const showPhoto =
                cardPhotoUrl && !failedPhotoUrls.has(cardPhotoUrl);
              const detectedForCard = (() => {
                const set = new Set(detectedIssues);
                if (item.source === "api" && item.card.issuesString) {
                  const fromApi = item.card.issuesString
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                  fromApi.forEach((issue) => set.add(normalizeIssue(issue)));
                }
                return set;
              })();
              return (
                <div
                  key={suggestionName}
                  className="treatment-recommender-by-suggestion__card"
                >
                  <div className="treatment-recommender-by-suggestion__card-top">
                    <div className="treatment-recommender-by-suggestion__photo-wrap">
                      {showPhoto ? (
                        <img
                          src={cardPhotoUrl}
                          alt={client.name}
                          className="treatment-recommender-by-suggestion__photo"
                          onError={() =>
                            cardPhotoUrl &&
                            setFailedPhotoUrls((prev) =>
                              new Set(prev).add(cardPhotoUrl),
                            )
                          }
                        />
                      ) : (
                        <div className="treatment-recommender-by-suggestion__photo-placeholder">
                          No photo
                        </div>
                      )}
                    </div>
                    <div className="treatment-recommender-by-suggestion__card-main">
                      <h2 className="treatment-recommender-by-suggestion__card-title">
                        {suggestionName}
                      </h2>
                      {inPlan && (
                        <p className="treatment-recommender-by-suggestion__in-plan">
                          Added to treatment interests
                        </p>
                      )}
                      {item.source === "api" &&
                        (item.card.shortSummary ?? item.card.aiSummary) && (
                          <div className="treatment-recommender-by-suggestion__summary">
                            {item.card.shortSummary && (
                              <p className="treatment-recommender-by-suggestion__short-summary">
                                {item.card.shortSummary}
                              </p>
                            )}
                            {item.card.aiSummary && (
                              <details className="treatment-recommender-by-suggestion__ai-summary">
                                <summary>Learn more</summary>
                                <p className="treatment-recommender-by-suggestion__ai-summary-text">
                                  {item.card.aiSummary}
                                </p>
                              </details>
                            )}
                          </div>
                        )}
                      <div className="treatment-recommender-by-suggestion__breakdown">
                        <h3 className="treatment-recommender-by-suggestion__breakdown-title">
                          Feature breakdown
                        </h3>
                        {breakdownRows.length > 0 ? (
                          breakdownRows.map((row) => (
                            <FeatureBreakdownRow
                              key={row.label}
                              label={row.label}
                              issues={row.issues}
                              detectedIssues={detectedForCard}
                            />
                          ))
                        ) : (
                          <p className="treatment-recommender-by-suggestion__no-breakdown">
                            No findings mapped for this suggestion.
                          </p>
                        )}
                      </div>
                      <div className="treatment-recommender-by-suggestion__card-actions">
                        <div className="treatment-recommender-by-suggestion__add-section">
                          {isSuggestionInPlan(suggestionName) ? (
                            <div className="treatment-recommender-by-suggestion__added-state">
                              <p className="treatment-recommender-by-suggestion__added-message">
                                Added to treatment plan
                              </p>
                              {onOpenTreatmentPlanWithItem ? (
                                <button
                                  type="button"
                                  className="treatment-recommender-by-suggestion__add-details-btn"
                                  onClick={() => {
                                    const itemToEdit =
                                      lastAddedItem &&
                                      lastAddedItem.interest === suggestionName
                                        ? lastAddedItem
                                        : [...(client.discussedItems ?? [])]
                                            .reverse()
                                            .find(
                                              (i) =>
                                                i.interest === suggestionName,
                                            );
                                    if (itemToEdit)
                                      onOpenTreatmentPlanWithItem(itemToEdit);
                                    else if (onOpenTreatmentPlan)
                                      onOpenTreatmentPlan();
                                  }}
                                >
                                  Add additional details
                                </button>
                              ) : onOpenTreatmentPlan ? (
                                <button
                                  type="button"
                                  className="treatment-recommender-by-suggestion__add-details-btn"
                                  onClick={() => onOpenTreatmentPlan()}
                                >
                                  Add additional details
                                </button>
                              ) : null}
                            </div>
                          ) : addToPlanForSuggestion?.suggestionName ===
                            suggestionName ? (
                            <div className="treatment-recommender-by-suggestion__add-form">
                              <div className="treatment-recommender-by-suggestion__add-row">
                                <span>What:</span>
                                <div className="treatment-recommender-by-suggestion__chips">
                                  {getTreatmentsForInterest(
                                    addToPlanForSuggestion.suggestionName,
                                  ).map((t) => (
                                    <button
                                      key={t}
                                      type="button"
                                      className={`treatment-recommender-by-suggestion__chip ${
                                        addToPlanForSuggestion.what === t
                                          ? "treatment-recommender-by-suggestion__chip--selected"
                                          : ""
                                      }`}
                                      onClick={() =>
                                        setAddToPlanForSuggestion((prev) =>
                                          prev ? { ...prev, what: t } : null,
                                        )
                                      }
                                    >
                                      {t}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="treatment-recommender-by-suggestion__add-row">
                                <span>Where:</span>
                                <div className="treatment-recommender-by-suggestion__chips">
                                  {REGION_OPTIONS.filter(
                                    (r) => r !== "Multiple" && r !== "Other",
                                  ).map((r) => (
                                    <button
                                      key={r}
                                      type="button"
                                      className={`treatment-recommender-by-suggestion__chip ${
                                        addToPlanForSuggestion.where.includes(r)
                                          ? "treatment-recommender-by-suggestion__chip--selected"
                                          : ""
                                      }`}
                                      onClick={() => {
                                        setAddToPlanForSuggestion((prev) =>
                                          prev
                                            ? {
                                                ...prev,
                                                where: prev.where.includes(r)
                                                  ? prev.where.filter(
                                                      (x) => x !== r,
                                                    )
                                                  : [...prev.where, r],
                                              }
                                            : null,
                                        );
                                      }}
                                    >
                                      {r}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="treatment-recommender-by-suggestion__add-row">
                                <span>When:</span>
                                <div className="treatment-recommender-by-suggestion__chips">
                                  {TIMELINE_OPTIONS.filter(
                                    (t) => t !== "Completed",
                                  ).map((t) => (
                                    <button
                                      key={t}
                                      type="button"
                                      className={`treatment-recommender-by-suggestion__chip ${
                                        addToPlanForSuggestion.when === t
                                          ? "treatment-recommender-by-suggestion__chip--selected"
                                          : ""
                                      }`}
                                      onClick={() =>
                                        setAddToPlanForSuggestion((prev) =>
                                          prev ? { ...prev, when: t } : null,
                                        )
                                      }
                                    >
                                      {t}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <details className="treatment-recommender-by-suggestion__details">
                                <summary>Optional details</summary>
                                <div className="treatment-recommender-by-suggestion__details-fields">
                                  <label className="treatment-recommender-by-suggestion__details-label">
                                    Product
                                    <input
                                      type="text"
                                      className="treatment-recommender-by-suggestion__details-input"
                                      placeholder="e.g. Juvederm, Botox"
                                      value={
                                        addToPlanForSuggestion.product ?? ""
                                      }
                                      onChange={(e) =>
                                        setAddToPlanForSuggestion((prev) =>
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
                                  <label className="treatment-recommender-by-suggestion__details-label">
                                    Quantity
                                    <input
                                      type="text"
                                      className="treatment-recommender-by-suggestion__details-input"
                                      placeholder="e.g. 2"
                                      value={
                                        addToPlanForSuggestion.quantity ?? ""
                                      }
                                      onChange={(e) =>
                                        setAddToPlanForSuggestion((prev) =>
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
                                  <label className="treatment-recommender-by-suggestion__details-label">
                                    Notes
                                    <textarea
                                      className="treatment-recommender-by-suggestion__details-textarea"
                                      placeholder="Optional notes"
                                      rows={2}
                                      value={addToPlanForSuggestion.notes ?? ""}
                                      onChange={(e) =>
                                        setAddToPlanForSuggestion((prev) =>
                                          prev
                                            ? { ...prev, notes: e.target.value }
                                            : null,
                                        )
                                      }
                                    />
                                  </label>
                                </div>
                              </details>
                              <div className="treatment-recommender-by-suggestion__add-actions">
                                <button
                                  type="button"
                                  className="treatment-recommender-by-suggestion__add-btn"
                                  onClick={handleAddToPlanConfirm}
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  className="treatment-recommender-by-suggestion__cancel-btn"
                                  onClick={() =>
                                    setAddToPlanForSuggestion(null)
                                  }
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : onAddToPlanDirect ? (
                            <button
                              type="button"
                              className="treatment-recommender-by-suggestion__add-btn"
                              onClick={() => {
                                const treatments =
                                  getTreatmentsForInterest(suggestionName);
                                setAddToPlanForSuggestion({
                                  suggestionName,
                                  what: treatments[0] ?? "",
                                  where: [],
                                  when: TIMELINE_OPTIONS[0],
                                  product: "",
                                  quantity: "",
                                  notes: "",
                                });
                              }}
                            >
                              Add to plan
                            </button>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="treatment-recommender-by-suggestion__examples-btn"
                          onClick={() =>
                            setPhotoExplorerInterest(suggestionName)
                          }
                        >
                          View examples
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {photoExplorerInterest && (
        <TreatmentPhotosModal
          client={client}
          interest={photoExplorerInterest}
          selectedRegion={SUGGESTION_TO_AREA[photoExplorerInterest]}
          onClose={() => setPhotoExplorerInterest(null)}
          onUpdate={onUpdate}
          onAddToPlanWithPrefill={(prefill) => {
            setPhotoExplorerInterest(null);
            onOpenTreatmentPlanWithPrefill?.(prefill);
          }}
          planItems={client.discussedItems ?? []}
        />
      )}
    </div>
  );
}
