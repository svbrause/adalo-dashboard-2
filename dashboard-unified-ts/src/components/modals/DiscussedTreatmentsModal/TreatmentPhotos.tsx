// Treatment Photos Browser - Unified before/after photos for treatments (issue, interest, or treatment+region)

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { TreatmentPhoto, DiscussedItem } from "../../../types";
import type { Client } from "../../../types";
import { fetchTreatmentPhotos, AirtableRecord } from "../../../services/api";
import { fetchTableRecords, updateLeadRecord } from "../../../services/api";
import { TREATMENT_META, SURGICAL_TREATMENTS } from "./constants";
import { issueToSuggestionMap, getIssueArea } from "../../../utils/issueMapping";
import { getTreatmentsForInterest } from "./utils";
import { generateId } from "./utils";
import { AIRTABLE_FIELD, REGION_OPTIONS, TIMELINE_OPTIONS, SKINCARE_QUICK_ADD_WHAT_OPTIONS } from "./constants";
import { SUGGESTION_TO_AREA, ALL_TREATMENT_INTERESTS } from "./suggestionsMapping";
import { showToast, showError } from "../../../utils/toast";

/** Map issue to treatment types for filtering (when opened from an issue) */
const ISSUE_TO_TREATMENT: Record<string, string[]> = {
  wrinkles: ["Neurotoxin", "Laser", "Chemical Peel"],
  "fine lines": ["Neurotoxin", "Laser", "Skincare"],
  "crow's feet": ["Neurotoxin", "Laser"],
  "forehead lines": ["Neurotoxin"],
  "frown lines": ["Neurotoxin"],
  "volume loss": ["Filler"],
  "hollow cheeks": ["Filler"],
  "thin lips": ["Filler"],
  "nasolabial folds": ["Filler"],
  "marionette lines": ["Filler"],
  "under eye bags": ["Filler", "Laser"],
  "dark circles": ["Filler", "Skincare"],
  acne: ["Chemical Peel", "Laser", "Skincare"],
  "acne scars": ["Microneedling", "Laser", "Chemical Peel", "PRP", "PDGF"],
  hyperpigmentation: ["Chemical Peel", "Laser", "Skincare"],
  "dark spots": ["Chemical Peel", "Laser", "Skincare"],
  "sun damage": ["Laser", "Chemical Peel"],
  redness: ["Laser", "Skincare"],
  rosacea: ["Laser", "Skincare"],
  "skin laxity": ["Laser", "Microneedling"],
  "sagging skin": ["Laser", "Microneedling"],
  "double chin": ["Filler", "Laser"],
  jowls: ["Filler", "Laser", "Microneedling"],
  "uneven skin tone": ["Chemical Peel", "Laser", "Skincare"],
  texture: ["Microneedling", "Chemical Peel", "Laser", "PRP", "PDGF"],
  pores: ["Microneedling", "Chemical Peel"],
  "droopy eyelids": ["Laser", "Neurotoxin"],
};

interface TreatmentPhotosProps {
  /** Current client – show their photo on the left (toggle front/side) */
  client?: Client | null;
  /** Pre-selected treatment to filter by */
  selectedTreatment?: string;
  /** Pre-selected region to filter by */
  selectedRegion?: string;
  /** When opened from an issue in View Details – filters by issue + region */
  issue?: string;
  /** Region/area when opened from an issue */
  region?: string;
  /** When opened from an interested treatment (suggestion name) – filters by interest */
  interest?: string;
  /** Called when user wants to close the photo browser */
  onClose?: () => void;
  /** When provided with client, enables Add to plan and calls after update */
  onUpdate?: () => void | Promise<void>;
  /** When provided, "Add to plan" opens the treatment planning form prefilled instead of adding directly */
  onAddToPlanWithPrefill?: (prefilled: TreatmentPlanPrefill) => void;
  /** When provided, "Add to plan" shows Where/When form and on confirm adds directly (no full modal) */
  onAddToPlanDirect?: (prefill: TreatmentPlanPrefill) => void | Promise<void>;
  /** Current plan items – used to show "Added to plan" when this photo's treatment is already in the plan */
  planItems?: DiscussedItem[];
  /** When provided, use these photos instead of fetching (e.g. for /debug/treatment-examples) */
  demoPhotos?: TreatmentPhoto[] | null;
}

/** Data to prefill the treatment planning form when adding from a photo or recommender */
export interface TreatmentPlanPrefill {
  interest: string;
  region: string;
  /** Normalized treatment type (e.g. "Laser", "Filler") */
  treatment: string;
  /** Specific product/device name if available (e.g. "Heat/Energy") */
  treatmentProduct?: string;
  /** Issue/finding when opened from an issue */
  findings?: string[];
  timeline?: string;
  /** Optional quantity (e.g. "2" or "2 Syringes") – prefilled from recommender optional details */
  quantity?: string;
  /** Optional notes – prefilled from recommender optional details */
  notes?: string;
}

/** Map Airtable record to TreatmentPhoto type */
function mapRecordToPhoto(record: AirtableRecord): TreatmentPhoto {
  const fields = record.fields;

  const photoAttachment = fields["Photo"];
  let photoUrl = "";
  let thumbnailUrl = "";

  if (Array.isArray(photoAttachment) && photoAttachment.length > 0) {
    const attachment = photoAttachment[0];
    photoUrl =
      attachment.thumbnails?.full?.url ||
      attachment.thumbnails?.large?.url ||
      attachment.url ||
      "";
    thumbnailUrl =
      attachment.thumbnails?.large?.url ||
      attachment.thumbnails?.small?.url ||
      attachment.url ||
      "";
  }

  const treatments = Array.isArray(fields["Name (from Treatments)"])
    ? fields["Name (from Treatments)"]
    : fields["Treatments"]
    ? [fields["Treatments"]]
    : [];

  const generalTreatments = Array.isArray(
    fields["Name (from General Treatments)"]
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
  const longevity = fields["Longevity (from General Treatments)"];
  const downtime = fields["Downtime (from General Treatments)"];
  const priceRange = fields["Price Range (from General Treatments)"];

  return {
    id: record.id,
    name: fields["Name"] || "",
    photoUrl,
    thumbnailUrl,
    treatments,
    generalTreatments,
    areaNames,
    surgical: surgical != null ? String(surgical) : undefined,
    caption: fields["Caption"] || undefined,
    storyTitle: fields["Story Title"] || undefined,
    storyDetailed: fields["Story Detailed"] || undefined,
    longevity: longevity != null ? String(longevity) : undefined,
    downtime: downtime != null ? String(downtime) : undefined,
    priceRange: priceRange != null ? String(priceRange) : undefined,
    age: fields["Age"] || undefined,
    skinTone: fields["Skin Tone"] || undefined,
    ethnicBackground: fields["Ethnic Background"] || undefined,
    skinType: fields["Skin Type"] || undefined,
  };
}

/** Area names for display: remove trailing " All" and omit standalone "All". */
function getDisplayAreaNames(areaNames: string[]): string[] {
  return areaNames
    .map((a) => String(a).replace(/\s*All$/i, "").trim())
    .filter((a) => a && a.toLowerCase() !== "all");
}

/** True if photo's areaNames match the selected region (e.g. "Skin All" matches "Skin"). */
function photoMatchesRegion(areaNames: string[], filterRegion: string): boolean {
  if (!filterRegion) return true;
  const regionLower = filterRegion.trim().toLowerCase();
  return areaNames.some((a) => {
    const display = String(a).replace(/\s*All$/i, "").trim().toLowerCase();
    return display === "all" || display === regionLower;
  });
}

/** Allowed region options in the UI - always show these regardless of photo data. */
const REGION_CANONICAL = [
  "Eyes",
  "Forehead",
  "Cheeks",
  "Nose",
  "Lips",
  "Jawline",
  "Skin",
] as const;

/** Treatment name normalization: map various names to canonical display names. */
const TREATMENT_NORMALIZATION: Record<string, string> = {
  "heat/energy": "Laser",
  "heat energy": "Laser",
  "oral/topical": "Skincare",
  "topical/skincare": "Skincare",
  "topical skincare": "Skincare",
  "chemical peels": "Chemical Peel",
  "liquid rhinoplasty": "", // exclude (surgical)
};

/** Treatments to exclude from the filter (surgical or not relevant). */
const EXCLUDED_TREATMENTS = new Set([
  "liquid rhinoplasty",
  "surgical",
  ...SURGICAL_TREATMENTS.map((t) => t.toLowerCase()),
]);

/** Normalize treatment name (merge duplicates, rename categories). */
function normalizeTreatment(name: string): string {
  const lower = name.toLowerCase().trim();
  if (EXCLUDED_TREATMENTS.has(lower)) return "";
  return TREATMENT_NORMALIZATION[lower] || name.trim();
}

/** Collect unique treatment names from photos, normalized and sorted. */
function getTreatmentOptionsFromPhotos(photos: TreatmentPhoto[]): string[] {
  const set = new Set<string>();
  for (const p of photos) {
    for (const t of p.generalTreatments) {
      const normalized = normalizeTreatment(String(t));
      if (normalized) set.add(normalized);
    }
    for (const t of p.treatments) {
      const normalized = normalizeTreatment(String(t));
      if (normalized) set.add(normalized);
    }
  }
  // Preferred order: Skincare, Laser, then alphabetical for the rest
  const order = [
    "Skincare",
    "Laser",
    "Filler",
    "Neurotoxin",
    "Microneedling",
    "Chemical Peel",
  ];
  return Array.from(set).sort((a, b) => {
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return a.localeCompare(b);
  });
}

/** Always show canonical regions - they're relevant even if current photos don't have them. */
function getRegionOptionsFromPhotos(_photos: TreatmentPhoto[]): string[] {
  // Always return the canonical regions in preferred order
  return [...REGION_CANONICAL];
}

export default function TreatmentPhotos({
  client,
  selectedTreatment,
  selectedRegion,
  issue,
  region,
  interest,
  onClose,
  onUpdate,
  onAddToPlanWithPrefill,
  onAddToPlanDirect,
  planItems = [],
  demoPhotos,
}: TreatmentPhotosProps) {
  const effectiveRegion = region || (issue ? getIssueArea(issue) : "");

  const [allPhotos, setAllPhotos] = useState<TreatmentPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Treatment Interest (suggestion) – when set, preselects area and limits treatment options to those with photos */
  const [filterInterest, setFilterInterest] = useState(interest || (issue ? issueToSuggestionMap[issue] || "" : ""));
  /** When opened from an issue, show this temporary selector so user sees context; also limits treatments */
  const [filterIssue, setFilterIssue] = useState(issue ?? null);
  const [filterTreatment, setFilterTreatment] = useState(
    selectedTreatment || ""
  );
  const [filterRegion, setFilterRegion] = useState(
    selectedRegion || (interest ? SUGGESTION_TO_AREA[interest] || effectiveRegion : effectiveRegion) || ""
  );
  const [selectedPhoto, setSelectedPhoto] = useState<TreatmentPhoto | null>(
    null
  );
  const [addingId, setAddingId] = useState<string | null>(null);
  const [interestDropdownOpen, setInterestDropdownOpen] = useState(false);
  /** Inline Where/When form when adding this photo to plan (same UX as recommender) */
  const [addToPlanForm, setAddToPlanForm] = useState<{
    photo: TreatmentPhoto;
    where: string[];
    when: string;
    product?: string;
    quantity?: string;
    notes?: string;
  } | null>(null);

  // Client photo (front/side toggle; side can be processed or unprocessed from form)
  const [clientPhotoType, setClientPhotoType] = useState<"front" | "side">(
    "front"
  );
  type SidePhotoSource = "processed" | "unprocessedSide" | "unprocessedLeft";
  const [sidePhotoSource, setSidePhotoSource] = useState<SidePhotoSource>("processed");
  const [clientFrontUrl, setClientFrontUrl] = useState<string | null>(null);
  const [clientSideUrl, setClientSideUrl] = useState<string | null>(null);
  const [clientSideUnprocessedSideUrl, setClientSideUnprocessedSideUrl] = useState<string | null>(null);
  const [clientSideUnprocessedLeftUrl, setClientSideUnprocessedLeftUrl] = useState<string | null>(null);
  const [showSideSourceMenuCard, setShowSideSourceMenuCard] = useState(false);
  const [showSideSourceMenuModal, setShowSideSourceMenuModal] = useState(false);
  const sideSourceMenuCardRef = useRef<HTMLDivElement>(null);
  const sideSourceMenuModalRef = useRef<HTMLDivElement>(null);

  const useDemo = Array.isArray(demoPhotos) && demoPhotos.length > 0;

  // Fetch all photos once (no server filter), unless demo data provided
  useEffect(() => {
    if (useDemo) {
      setAllPhotos(demoPhotos!);
      setLoading(false);
      setError(null);
      return;
    }
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const records = await fetchTreatmentPhotos({ limit: 2000 });
        const mapped = records
          .map(mapRecordToPhoto)
          .filter((p) => p.photoUrl)
          .filter((p) => p.surgical !== "Surgical"); // only non-surgical photos
        setAllPhotos(mapped);
      } catch (err) {
        console.error("Error fetching treatment photos:", err);
        setError("Failed to load photos. Please try again.");
        setAllPhotos([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [useDemo, demoPhotos]);

  // Helper: filter photos by treatment interest (suggestion) and/or issue (treatment types only); then by region
  const photosAfterInterestAndIssue = useMemo(() => {
    let base = allPhotos;
    const interestOrIssue = filterInterest || (filterIssue ?? "");

    if (interestOrIssue) {
      let allowedTreatments: string[] = [];
      if (filterInterest) {
        allowedTreatments = getTreatmentsForInterest(filterInterest).map((t) => t.toLowerCase());
      }
      if (filterIssue) {
        const issueLower = filterIssue.toLowerCase();
        const entry = Object.entries(ISSUE_TO_TREATMENT).find(([key]) =>
          issueLower.includes(key.toLowerCase())
        );
        const fromIssue = (entry?.[1] || []).map((t) => t.toLowerCase());
        allowedTreatments = allowedTreatments.length
          ? allowedTreatments.filter((t) => fromIssue.includes(t))
          : fromIssue;
      }
      const allowedSet = new Set(allowedTreatments);
      base = base.filter((photo) => {
        if (allowedSet.size === 0) return true;
        const photoMatches = (t: string) => {
          const normalized = normalizeTreatment(String(t));
          return normalized && allowedSet.has(normalized.toLowerCase());
        };
        return (
          photo.generalTreatments.some(photoMatches) ||
          photo.treatments.some(photoMatches)
        );
      });
    }

    return base.filter((photo) => photoMatchesRegion(photo.areaNames, filterRegion));
  }, [allPhotos, filterInterest, filterIssue, filterRegion]);

  // Then apply treatment and region chip filters for final displayed list
  const photos = useMemo(() => {
    return photosAfterInterestAndIssue.filter((photo) => {
      const matchTreatment =
        !filterTreatment ||
        photo.generalTreatments.some((t) => {
          const normalized = normalizeTreatment(String(t));
          return normalized && normalized.toLowerCase() === filterTreatment.toLowerCase();
        }) ||
        photo.treatments.some((t) => {
          const normalized = normalizeTreatment(String(t));
          return normalized && normalized.toLowerCase() === filterTreatment.toLowerCase();
        });
      return matchTreatment && photoMatchesRegion(photo.areaNames, filterRegion);
    });
  }, [photosAfterInterestAndIssue, filterTreatment, filterRegion]);

  /** Criteria from selected filters (interest and/or issue) – used to score how well photo name matches */
  const matchCriteriaTerms = useMemo(() => {
    const terms: string[] = [];
    if (filterInterest?.trim()) terms.push(filterInterest.trim());
    if (filterIssue?.trim()) terms.push(filterIssue.trim());
    return terms;
  }, [filterInterest, filterIssue]);

  /** Number of match criteria terms that appear in the photo name (0 = close, all = exact) */
  const getMatchScore = useCallback(
    (photo: TreatmentPhoto): number => {
      if (matchCriteriaTerms.length === 0) return 0;
      const nameLower = (photo.name || "").toLowerCase();
      return matchCriteriaTerms.filter((term) =>
        nameLower.includes(term.toLowerCase())
      ).length;
    },
    [matchCriteriaTerms]
  );

  /** "exact" = all selected criteria (interest/issue) appear in photo name; "close" = passes filter but not all in name */
  const getMatchType = useCallback(
    (photo: TreatmentPhoto): "exact" | "close" | null => {
      if (matchCriteriaTerms.length === 0) return null;
      const score = getMatchScore(photo);
      if (score >= matchCriteriaTerms.length) return "exact";
      return "close";
    },
    [matchCriteriaTerms, getMatchScore]
  );

  /** Human-readable reason for why a photo matches: "Exact match" or "✓ Matches Issue/Interest/Area: [value]" for close matches */
  const getMatchReason = useCallback(
    (photo: TreatmentPhoto): string => {
      const matchType = getMatchType(photo);
      if (!matchType) return "";
      if (matchType === "exact") return "Exact match";
      const nameLower = (photo.name || "").toLowerCase();
      if (filterIssue?.trim() && nameLower.includes(filterIssue.trim().toLowerCase())) {
        return `✓ Matches Issue: ${filterIssue.trim()}`;
      }
      if (filterInterest?.trim() && nameLower.includes(filterInterest.trim().toLowerCase())) {
        return `✓ Matches Interest: ${filterInterest.trim()}`;
      }
      if (filterRegion?.trim() && photoMatchesRegion(photo.areaNames, filterRegion)) {
        return `✓ Matches Area: ${filterRegion.trim()}`;
      }
      return "Close match";
    },
    [getMatchType, filterIssue, filterInterest, filterRegion]
  );

  /** Photos sorted by match quality: exact matches first (all criteria in name), then close matches (fewer in name), then by name */
  const sortedPhotos = useMemo(() => {
    return [...photos].sort((a, b) => {
      const scoreA = getMatchScore(a);
      const scoreB = getMatchScore(b);
      if (scoreB !== scoreA) return scoreB - scoreA; // higher score first
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [photos, getMatchScore]);

  /** Split into exact vs close only when we have criteria (interest or issue selected) */
  const { exactMatches, closeMatches } = useMemo(() => {
    if (matchCriteriaTerms.length === 0) {
      return { exactMatches: sortedPhotos, closeMatches: [] };
    }
    const exact: TreatmentPhoto[] = [];
    const close: TreatmentPhoto[] = [];
    for (const photo of sortedPhotos) {
      if (getMatchType(photo) === "exact") exact.push(photo);
      else close.push(photo);
    }
    return { exactMatches: exact, closeMatches: close };
  }, [sortedPhotos, matchCriteriaTerms.length, getMatchType]);

  // Load client front/side photo (processed + unprocessed from form) when client is provided
  useEffect(() => {
    if (!client || client.tableSource !== "Patients") return;
    const getUrl = (att: { thumbnails?: { full?: { url: string }; large?: { url: string } }; url?: string }) =>
      att?.thumbnails?.full?.url || att?.thumbnails?.large?.url || att?.url || null;
    const loadClientPhotos = async () => {
      try {
        const records = await fetchTableRecords("Patients", {
          filterFormula: `RECORD_ID() = "${client.id}"`,
          fields: [
            "Front Photo",
            "Side Photo",
            "Side Photo (from Form Submissions)",
            "Left Side Photo (from Form Submissions)",
          ],
        });
        if (records.length > 0) {
          const fields = records[0].fields as Record<string, unknown>;
          const front = fields["Front Photo"] || fields["Front photo"];
          const side = fields["Side Photo"] || fields["Side photo"];
          if (front && Array.isArray(front) && front.length > 0) {
            setClientFrontUrl(getUrl(front[0] as { thumbnails?: { full?: { url: string }; large?: { url: string } }; url?: string }) || null);
          }
          if (side && Array.isArray(side) && side.length > 0) {
            setClientSideUrl(getUrl(side[0] as { thumbnails?: { full?: { url: string }; large?: { url: string } }; url?: string }) || null);
          }
          const unprocessedSide = fields["Side Photo (from Form Submissions)"];
          const unprocessedLeft = fields["Left Side Photo (from Form Submissions)"];
          if (unprocessedSide && Array.isArray(unprocessedSide) && unprocessedSide.length > 0) {
            setClientSideUnprocessedSideUrl(getUrl((unprocessedSide as { thumbnails?: { full?: { url: string }; large?: { url: string } }; url?: string }[])[0]) || null);
          } else {
            setClientSideUnprocessedSideUrl(null);
          }
          if (unprocessedLeft && Array.isArray(unprocessedLeft) && unprocessedLeft.length > 0) {
            setClientSideUnprocessedLeftUrl(getUrl((unprocessedLeft as { thumbnails?: { full?: { url: string }; large?: { url: string } }; url?: string }[])[0]) || null);
          } else {
            setClientSideUnprocessedLeftUrl(null);
          }
        }
      } catch {
        // ignore
      }
    };
    loadClientPhotos();
  }, [client]);

  // Default side source to first available (processed or unprocessed)
  useEffect(() => {
    if (sidePhotoSource === "processed" && !clientSideUrl && (clientSideUnprocessedSideUrl || clientSideUnprocessedLeftUrl)) {
      setSidePhotoSource(clientSideUnprocessedSideUrl ? "unprocessedSide" : "unprocessedLeft");
    } else if (sidePhotoSource === "unprocessedSide" && !clientSideUnprocessedSideUrl) {
      setSidePhotoSource(clientSideUrl ? "processed" : clientSideUnprocessedLeftUrl ? "unprocessedLeft" : "processed");
    } else if (sidePhotoSource === "unprocessedLeft" && !clientSideUnprocessedLeftUrl) {
      setSidePhotoSource(clientSideUrl ? "processed" : clientSideUnprocessedSideUrl ? "unprocessedSide" : "processed");
    }
  }, [clientSideUrl, clientSideUnprocessedSideUrl, clientSideUnprocessedLeftUrl, sidePhotoSource]);

  useEffect(() => {
    if (interest) {
      setFilterInterest(interest);
      const area = SUGGESTION_TO_AREA[interest];
      if (area) setFilterRegion(area);
    }
  }, [interest]);

  useEffect(() => {
    if (issue) {
      setFilterIssue(issue);
      setFilterInterest(issueToSuggestionMap[issue] || issue);
      setFilterRegion(effectiveRegion || getIssueArea(issue));
    }
  }, [issue, effectiveRegion]);

  useEffect(() => {
    if (selectedTreatment !== undefined) setFilterTreatment(selectedTreatment);
  }, [selectedTreatment]);

  useEffect(() => {
    if (selectedRegion !== undefined) setFilterRegion(selectedRegion);
  }, [selectedRegion]);

  const currentSideUrl =
    sidePhotoSource === "processed"
      ? clientSideUrl
      : sidePhotoSource === "unprocessedSide"
        ? clientSideUnprocessedSideUrl
        : clientSideUnprocessedLeftUrl;
  const clientPhotoUrl =
    clientPhotoType === "front" ? clientFrontUrl : currentSideUrl;
  const hasClientPhotos = !!(
    clientFrontUrl ||
    clientSideUrl ||
    clientSideUnprocessedSideUrl ||
    clientSideUnprocessedLeftUrl
  );
  const hasProcessedSide = clientSideUrl != null;
  const hasUnprocessedSide = clientSideUnprocessedSideUrl != null;
  const hasUnprocessedLeft = clientSideUnprocessedLeftUrl != null;
  const hasMultipleSideOptions = [hasProcessedSide, hasUnprocessedSide, hasUnprocessedLeft].filter(Boolean).length > 1;

  useEffect(() => {
    if (!showSideSourceMenuCard) return;
    const handleClick = (e: MouseEvent) => {
      if (sideSourceMenuCardRef.current && !sideSourceMenuCardRef.current.contains(e.target as Node)) {
        setShowSideSourceMenuCard(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showSideSourceMenuCard]);

  useEffect(() => {
    if (!showSideSourceMenuModal) return;
    const handleClick = (e: MouseEvent) => {
      if (sideSourceMenuModalRef.current && !sideSourceMenuModalRef.current.contains(e.target as Node)) {
        setShowSideSourceMenuModal(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showSideSourceMenuModal]);

  const treatmentMeta = filterTreatment
    ? TREATMENT_META[filterTreatment]
    : undefined;

  /** Treatment options: only treatments that have at least one photo in the current interest/issue/region filter; when a Treatment Interest is selected, further restrict to treatments applicable to that interest */
  const treatmentOptions = useMemo(() => {
    const fromPhotos = getTreatmentOptionsFromPhotos(photosAfterInterestAndIssue);
    if (!filterInterest) return fromPhotos;
    const forInterest = new Set(
      getTreatmentsForInterest(filterInterest).map((t) => t.toLowerCase())
    );
    return fromPhotos.filter((t) => forInterest.has(t.toLowerCase()));
  }, [photosAfterInterestAndIssue, filterInterest]);
  const regionOptions = useMemo(
    () => getRegionOptionsFromPhotos(allPhotos),
    [allPhotos]
  );

  /** Title for a photo: use Name field (clinical) from Photos table. */
  const getPhotoTitle = useCallback((photo: TreatmentPhoto): string => {
    if (photo.name?.trim()) return photo.name.trim();
    const tx = photo.generalTreatments.join(", ");
    const area = getDisplayAreaNames(photo.areaNames).join(", ");
    if (tx && area) return `${tx} – ${area}`;
    if (tx) return tx;
    if (area) return area;
    return "Treatment example";
  }, []);

  /** Open the inline Where/When form for adding this photo to plan */
  const openAddToPlanForm = useCallback((photo: TreatmentPhoto) => {
    setAddToPlanForm({
      photo,
      where: [],
      when: "Wishlist",
      product: "",
      quantity: "",
      notes: "",
    });
  }, []);

  /** Build prefill from current add form or photo defaults */
  const buildPrefillFromForm = useCallback(
    (photo: TreatmentPhoto, form: { where: string[]; when: string; product?: string; quantity?: string; notes?: string }): TreatmentPlanPrefill => {
      const rawTreatment = photo.generalTreatments[0] || photo.treatments[0] || "";
      const normalizedTreatment = normalizeTreatment(rawTreatment) || rawTreatment || "Treatment";
      const regionName = form.where.length > 0 ? form.where.join(", ") : (getDisplayAreaNames(photo.areaNames)[0] || filterRegion || effectiveRegion || "");
      return {
        interest: filterInterest || "",
        region: regionName,
        treatment: normalizedTreatment,
        treatmentProduct: form.product?.trim() || photo.treatments[0]?.trim() || (rawTreatment !== normalizedTreatment ? rawTreatment : undefined),
        findings: filterIssue ? [filterIssue] : issue ? [issue] : undefined,
        timeline: form.when,
        quantity: form.quantity?.trim() || undefined,
        notes: form.notes?.trim() || undefined,
      };
    },
    [filterInterest, filterIssue, filterRegion, issue, effectiveRegion]
  );

  /** Confirm add to plan from inline form */
  const confirmAddToPlanForm = useCallback(
    async () => {
      if (!addToPlanForm || !client) return;
      const prefill = buildPrefillFromForm(addToPlanForm.photo, addToPlanForm);
      setAddingId(addToPlanForm.photo.id);
      try {
        if (onAddToPlanDirect) {
          await onAddToPlanDirect(prefill);
          onUpdate?.();
          setAddToPlanForm(null);
        } else if (onAddToPlanWithPrefill) {
          onAddToPlanWithPrefill(prefill);
          setAddToPlanForm(null);
          setSelectedPhoto(null);
          onClose?.();
        }
      } catch (e) {
        showError(e instanceof Error ? e.message : "Failed to add to plan");
      } finally {
        setAddingId(null);
      }
    },
    [addToPlanForm, client, buildPrefillFromForm, onAddToPlanDirect, onAddToPlanWithPrefill, onUpdate, onClose]
  );

  /** Add this photo to plan: with callback(s) show inline form; otherwise add directly (legacy) */
  const handleAddToPlan = useCallback(
    async (photo: TreatmentPhoto) => {
      if (!client) return;
      if (onAddToPlanDirect || onAddToPlanWithPrefill) {
        openAddToPlanForm(photo);
        return;
      }
      const rawTreatment = photo.generalTreatments[0] || photo.treatments[0] || "";
      const normalizedTreatment = normalizeTreatment(rawTreatment) || rawTreatment || "Treatment";
      const regionName = getDisplayAreaNames(photo.areaNames)[0] || filterRegion || effectiveRegion || "";
      if (!onUpdate) return;
      const newItem: DiscussedItem = {
        id: generateId(),
        addedAt: new Date().toISOString(),
        interest: filterInterest || undefined,
        findings: filterIssue ? [filterIssue] : issue ? [issue] : undefined,
        treatment: normalizedTreatment,
        region: regionName || undefined,
        timeline: "Wishlist",
      };
      const nextItems = [...(client.discussedItems || []), newItem];
      setAddingId(photo.id);
      try {
        await updateLeadRecord(client.id, client.tableSource, {
          [AIRTABLE_FIELD]: nextItems.length > 0 ? JSON.stringify(nextItems) : "",
        });
        showToast(`Added ${normalizedTreatment} to plan`);
        await onUpdate();
      } catch (e) {
        showError(e instanceof Error ? e.message : "Failed to add to plan");
      } finally {
        setAddingId(null);
      }
    },
    [
      client,
      onUpdate,
      onAddToPlanDirect,
      onAddToPlanWithPrefill,
      onClose,
      filterInterest,
      filterIssue,
      filterRegion,
      issue,
      effectiveRegion,
      openAddToPlanForm,
    ]
  );

  /** True if the plan already contains an item matching this photo (same treatment + interest + region). */
  const isPhotoInPlan = useCallback(
    (photo: TreatmentPhoto): boolean => {
      if (!planItems.length) return false;
      const rawTreatment =
        photo.generalTreatments[0] || photo.treatments[0] || "";
      const normalizedTreatment =
        normalizeTreatment(rawTreatment) || rawTreatment || "";
      const regionName =
        getDisplayAreaNames(photo.areaNames)[0] || filterRegion || effectiveRegion || "";
      const interestVal = filterInterest || "";
      return planItems.some((item) => {
        const treatmentMatch =
          (item.treatment?.trim().toLowerCase() ?? "") ===
          normalizedTreatment.trim().toLowerCase();
        const regionMatch =
          !regionName ||
          (item.region?.trim().toLowerCase() ?? "") === regionName.trim().toLowerCase();
        const interestMatch =
          !interestVal ||
          (item.interest?.trim().toLowerCase() ?? "") === interestVal.trim().toLowerCase();
        return treatmentMatch && regionMatch && interestMatch;
      });
    },
    [planItems, filterInterest, filterRegion, effectiveRegion]
  );

  /** Check why a photo is relevant to the patient (matching attributes). */
  const getRelevanceMatches = useCallback(
    (photo: TreatmentPhoto): string[] => {
      if (!client) return [];
      const matches: string[] = [];
      // Match skin type if both are defined
      if (photo.skinType && client.skinType) {
        const photoSkin = String(photo.skinType).toLowerCase();
        const clientSkin = String(client.skinType).toLowerCase();
        if (photoSkin.includes(clientSkin) || clientSkin.includes(photoSkin)) {
          matches.push("Similar skin type");
        }
      }
      // Match skin tone if both are defined
      if (photo.skinTone && client.skinTone) {
        const photoTone = String(photo.skinTone).toLowerCase();
        const clientTone = String(client.skinTone).toLowerCase();
        if (photoTone === clientTone || photoTone.includes(clientTone)) {
          matches.push("Similar skin tone");
        }
      }
      return matches;
    },
    [client]
  );

  return (
    <div className="treatment-photos-browser">
      <div className="treatment-photos-header">
        <h3 className="treatment-photos-title">Treatment Explorer</h3>
        {onClose && (
          <button
            type="button"
            className="treatment-photos-close-btn"
            onClick={onClose}
            aria-label="Close photo browser"
          >
            ×
          </button>
        )}
      </div>

      <div className="treatment-photos-layout">
        {/* Left: current client photo (toggle front/side) */}
        <aside className="treatment-photos-client-column">
          {client && (
            <div className="treatment-photos-client-card">
              <h4 className="treatment-photos-client-title">{client.name}</h4>
              {hasClientPhotos ? (
                <>
                  <div className="treatment-photos-client-toggle">
                    <button
                      type="button"
                      className={`treatment-photos-toggle-btn${
                        clientPhotoType === "front" ? " active" : ""
                      }`}
                      onClick={() => setClientPhotoType("front")}
                      disabled={!clientFrontUrl}
                    >
                      Front
                    </button>
                    <button
                      type="button"
                      className={`treatment-photos-toggle-btn${
                        clientPhotoType === "side" ? " active" : ""
                      }`}
                      onClick={() => setClientPhotoType("side")}
                      disabled={!(clientSideUrl || clientSideUnprocessedSideUrl || clientSideUnprocessedLeftUrl)}
                    >
                      Side
                    </button>
                    {clientPhotoType === "side" && hasMultipleSideOptions && (
                      <div className="treatment-photos-side-source-wrap" ref={sideSourceMenuCardRef}>
                        <button
                          type="button"
                          className="treatment-photos-side-source-edit-btn"
                          onClick={() => setShowSideSourceMenuCard((v) => !v)}
                          title="Choose side photo"
                          aria-label="Choose which side photo to show"
                          aria-expanded={showSideSourceMenuCard}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        {showSideSourceMenuCard && (
                          <div className="treatment-photos-side-source-menu" role="menu">
                            {hasProcessedSide && (
                              <button
                                type="button"
                                role="menuitem"
                                className={`treatment-photos-side-source-item${sidePhotoSource === "processed" ? " active" : ""}`}
                                onClick={() => { setSidePhotoSource("processed"); setShowSideSourceMenuCard(false); }}
                              >
                                Processed
                              </button>
                            )}
                            {hasUnprocessedSide && (
                              <button
                                type="button"
                                role="menuitem"
                                className={`treatment-photos-side-source-item${sidePhotoSource === "unprocessedSide" ? " active" : ""}`}
                                onClick={() => { setSidePhotoSource("unprocessedSide"); setShowSideSourceMenuCard(false); }}
                              >
                                Original (right)
                              </button>
                            )}
                            {hasUnprocessedLeft && (
                              <button
                                type="button"
                                role="menuitem"
                                className={`treatment-photos-side-source-item${sidePhotoSource === "unprocessedLeft" ? " active" : ""}`}
                                onClick={() => { setSidePhotoSource("unprocessedLeft"); setShowSideSourceMenuCard(false); }}
                              >
                                Original (left)
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="treatment-photos-client-image-wrap">
                    <img
                      src={clientPhotoUrl || undefined}
                      alt={clientPhotoType === "front" ? "Front" : "Side"}
                      className="treatment-photos-client-image"
                    />
                  </div>
                </>
              ) : (
                <div className="treatment-photos-client-placeholder">
                  No patient photo
                </div>
              )}
            </div>
          )}

          {/* Treatment meta when a treatment is selected */}
          {filterTreatment && treatmentMeta && (
            <div className="treatment-photos-meta-card">
              <h4 className="treatment-photos-meta-title">{filterTreatment}</h4>
              {(treatmentMeta.longevity ||
                treatmentMeta.downtime ||
                treatmentMeta.priceRange) && (
                <dl className="treatment-photos-meta-list">
                  {treatmentMeta.longevity && (
                    <>
                      <dt>Longevity</dt>
                      <dd>{treatmentMeta.longevity}</dd>
                    </>
                  )}
                  {treatmentMeta.downtime && (
                    <>
                      <dt>Downtime</dt>
                      <dd>{treatmentMeta.downtime}</dd>
                    </>
                  )}
                  {treatmentMeta.priceRange && (
                    <>
                      <dt>Price range</dt>
                      <dd>{treatmentMeta.priceRange}</dd>
                    </>
                  )}
                </dl>
              )}
            </div>
          )}
        </aside>

        {/* Right: filters (chips) + gallery */}
        <div className="treatment-photos-gallery-column">
          {/* Treatment Interest: All, selected chip only, and Other (dropdown) */}
          <div className="treatment-photos-filters">
            <span className="treatment-photos-filter-label">Treatment Interest</span>
            <div className="treatment-photos-chips">
              <button
                type="button"
                className={`treatment-photos-chip${
                  !filterInterest ? " active" : ""
                }`}
                onClick={() => {
                  setFilterInterest("");
                  setFilterRegion("");
                  setInterestDropdownOpen(false);
                }}
              >
                All
              </button>
              {filterInterest && (
                <button
                  type="button"
                  className="treatment-photos-chip active"
                  onClick={() => {
                    setFilterInterest("");
                    setFilterRegion("");
                  }}
                >
                  {filterInterest}
                </button>
              )}
              <div className="treatment-photos-interest-other-wrap">
                <button
                  type="button"
                  className={`treatment-photos-chip treatment-photos-chip-other${
                    interestDropdownOpen ? " open" : ""
                  }`}
                  onClick={() => setInterestDropdownOpen((o) => !o)}
                  aria-expanded={interestDropdownOpen}
                  aria-haspopup="listbox"
                >
                  Other
                </button>
                {interestDropdownOpen && (
                  <div
                    className="treatment-photos-interest-dropdown"
                    role="listbox"
                  >
                    {ALL_TREATMENT_INTERESTS.filter((name) => name !== filterInterest).map((name) => (
                      <button
                        key={name}
                        type="button"
                        role="option"
                        className="treatment-photos-interest-dropdown-item"
                        onClick={() => {
                          setFilterInterest(name);
                          const area = SUGGESTION_TO_AREA[name];
                          if (area) setFilterRegion(area);
                          setInterestDropdownOpen(false);
                        }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Issue selector – only when opened from an issue (temporary fourth filter) */}
          {filterIssue != null && (
            <div className="treatment-photos-filters">
              <span className="treatment-photos-filter-label">Issue</span>
              <div className="treatment-photos-chips">
                <button
                  type="button"
                  className="treatment-photos-chip active"
                  title={filterIssue}
                >
                  {filterIssue}
                </button>
                <button
                  type="button"
                  className="treatment-photos-chip"
                  onClick={() => {
                    setFilterIssue(null);
                    setFilterInterest("");
                    setFilterRegion("");
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
          )}
          <div className="treatment-photos-filters">
            <span className="treatment-photos-filter-label">Region</span>
            <div className="treatment-photos-chips">
              <button
                type="button"
                className={`treatment-photos-chip${
                  !filterRegion ? " active" : ""
                }`}
                onClick={() => setFilterRegion("")}
              >
                All
              </button>
              {regionOptions.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`treatment-photos-chip${
                    filterRegion === r ? " active" : ""
                  }`}
                  onClick={() => setFilterRegion(filterRegion === r ? "" : r)}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="treatment-photos-filters">
            <span className="treatment-photos-filter-label">Treatment</span>
            <div className="treatment-photos-chips">
              <button
                type="button"
                className={`treatment-photos-chip${
                  !filterTreatment ? " active" : ""
                }`}
                onClick={() => setFilterTreatment("")}
              >
                All
              </button>
              {treatmentOptions.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`treatment-photos-chip${
                    filterTreatment === t ? " active" : ""
                  }`}
                  onClick={() =>
                    setFilterTreatment(filterTreatment === t ? "" : t)
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {loading && (
            <div className="treatment-photos-loading">Loading photos...</div>
          )}
          {error && <div className="treatment-photos-error">{error}</div>}

          {!loading && !error && (
            <div className="treatment-photos-gallery-sections">
              {sortedPhotos.length === 0 ? (
                <div className="treatment-photos-empty">
                  No photos found for the selected filters.
                </div>
              ) : matchCriteriaTerms.length > 0 ? (
                <>
                  {exactMatches.length > 0 && (
                    <div className="treatment-photos-section">
                      <h4 className="treatment-photos-section-title">
                        Exact matches
                      </h4>
                      <p className="treatment-photos-section-desc">
                        Photos whose name matches your selected filters
                        {matchCriteriaTerms.length > 0 && (
                          <> (e.g. {matchCriteriaTerms.join(", ")})</>
                        )}
                      </p>
                      <div className="treatment-photos-grid treatment-photos-grid-square">
                        {exactMatches.map((photo) => {
                          const relevance = getRelevanceMatches(photo);
                          const matchType = getMatchType(photo);
                          return (
                            <button
                              key={photo.id}
                              type="button"
                              className={`treatment-photo-card treatment-photo-card-wide${
                                relevance.length > 0
                                  ? " treatment-photo-card-relevant"
                                  : ""
                              }`}
                              onClick={() => setSelectedPhoto(photo)}
                            >
                              <div className="treatment-photo-image-wrap treatment-photo-image-wrap-wide">
                                <img
                                  src={photo.thumbnailUrl || photo.photoUrl}
                                  alt={getPhotoTitle(photo)}
                                  className="treatment-photo-image"
                                  loading="lazy"
                                />
                                {getMatchReason(photo) && (
                                  <div
                                    className={`treatment-photo-match-badge treatment-photo-match-badge-${matchType}`}
                                    title="Why this photo matches your filters"
                                  >
                                    <span className="treatment-photo-match-text">
                                      {getMatchReason(photo)}
                                    </span>
                                  </div>
                                )}
                                {relevance.length > 0 && (
                                  <div className="treatment-photo-relevance-badge">
                                    <span className="treatment-photo-relevance-icon">
                                      ✓
                                    </span>
                                    <span className="treatment-photo-relevance-text">
                                      {relevance[0]}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="treatment-photo-card-label">
                                {getPhotoTitle(photo)}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {closeMatches.length > 0 && (
                    <div className="treatment-photos-section">
                      <h4 className="treatment-photos-section-title">
                        Close matches
                      </h4>
                      <p className="treatment-photos-section-desc">
                        Related photos that pass your filters but don’t include all selected terms in the name
                      </p>
                      <div className="treatment-photos-grid treatment-photos-grid-square">
                        {closeMatches.map((photo) => {
                          const relevance = getRelevanceMatches(photo);
                          const matchType = getMatchType(photo);
                          return (
                            <button
                              key={photo.id}
                              type="button"
                              className={`treatment-photo-card treatment-photo-card-wide${
                                relevance.length > 0
                                  ? " treatment-photo-card-relevant"
                                  : ""
                              }`}
                              onClick={() => setSelectedPhoto(photo)}
                            >
                              <div className="treatment-photo-image-wrap treatment-photo-image-wrap-wide">
                                <img
                                  src={photo.thumbnailUrl || photo.photoUrl}
                                  alt={getPhotoTitle(photo)}
                                  className="treatment-photo-image"
                                  loading="lazy"
                                />
                                {getMatchReason(photo) && (
                                  <div
                                    className={`treatment-photo-match-badge treatment-photo-match-badge-${matchType}`}
                                    title="Why this photo matches your filters"
                                  >
                                    <span className="treatment-photo-match-text">
                                      {getMatchReason(photo)}
                                    </span>
                                  </div>
                                )}
                                {relevance.length > 0 && (
                                  <div className="treatment-photo-relevance-badge">
                                    <span className="treatment-photo-relevance-icon">
                                      ✓
                                    </span>
                                    <span className="treatment-photo-relevance-text">
                                      {relevance[0]}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="treatment-photo-card-label">
                                {getPhotoTitle(photo)}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="treatment-photos-grid treatment-photos-grid-square">
                  {sortedPhotos.map((photo) => {
                    const relevance = getRelevanceMatches(photo);
                    return (
                      <button
                        key={photo.id}
                        type="button"
                        className={`treatment-photo-card treatment-photo-card-wide${
                          relevance.length > 0
                            ? " treatment-photo-card-relevant"
                            : ""
                        }`}
                        onClick={() => setSelectedPhoto(photo)}
                      >
                        <div className="treatment-photo-image-wrap treatment-photo-image-wrap-wide">
                          <img
                            src={photo.thumbnailUrl || photo.photoUrl}
                            alt={getPhotoTitle(photo)}
                            className="treatment-photo-image"
                            loading="lazy"
                          />
                          {relevance.length > 0 && (
                            <div className="treatment-photo-relevance-badge">
                              <span className="treatment-photo-relevance-icon">
                                ✓
                              </span>
                              <span className="treatment-photo-relevance-text">
                                {relevance[0]}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="treatment-photo-card-label">
                          {getPhotoTitle(photo)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Photo detail modal */}
      {selectedPhoto && (
        <div
          className="treatment-photo-detail-overlay"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="treatment-photo-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="treatment-photo-detail-close"
              onClick={() => setSelectedPhoto(null)}
              aria-label="Close"
            >
              ×
            </button>
            <div className="treatment-photo-detail-content treatment-photo-detail-side-by-side">
              {/* Client photo for comparison */}
              {(clientFrontUrl || clientSideUrl || clientSideUnprocessedSideUrl || clientSideUnprocessedLeftUrl) && (
                <div className="treatment-photo-detail-client">
                  <div className="treatment-photo-detail-client-header">
                    <span className="treatment-photo-detail-client-label">
                      {client?.name || "Patient"}
                    </span>
                    <div className="treatment-photo-detail-client-toggle">
                      <button
                        type="button"
                        className={`treatment-photo-detail-toggle-btn${clientPhotoType === "front" ? " active" : ""}`}
                        onClick={() => setClientPhotoType("front")}
                        disabled={!clientFrontUrl}
                      >
                        Front
                      </button>
                      <button
                        type="button"
                        className={`treatment-photo-detail-toggle-btn${clientPhotoType === "side" ? " active" : ""}`}
                        onClick={() => setClientPhotoType("side")}
                        disabled={!(clientSideUrl || clientSideUnprocessedSideUrl || clientSideUnprocessedLeftUrl)}
                      >
                        Side
                      </button>
                      {clientPhotoType === "side" && hasMultipleSideOptions && (
                        <div className="treatment-photos-side-source-wrap" ref={sideSourceMenuModalRef}>
                          <button
                            type="button"
                            className="treatment-photos-side-source-edit-btn treatment-photos-side-source-edit-btn--sm"
                            onClick={() => setShowSideSourceMenuModal((v) => !v)}
                            title="Choose side photo"
                            aria-label="Choose which side photo to show"
                            aria-expanded={showSideSourceMenuModal}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          {showSideSourceMenuModal && (
                            <div className="treatment-photos-side-source-menu" role="menu">
                              {hasProcessedSide && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  className={`treatment-photos-side-source-item${sidePhotoSource === "processed" ? " active" : ""}`}
                                  onClick={() => { setSidePhotoSource("processed"); setShowSideSourceMenuModal(false); }}
                                >
                                  Processed
                                </button>
                              )}
                              {hasUnprocessedSide && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  className={`treatment-photos-side-source-item${sidePhotoSource === "unprocessedSide" ? " active" : ""}`}
                                  onClick={() => { setSidePhotoSource("unprocessedSide"); setShowSideSourceMenuModal(false); }}
                                >
                                  Original (right)
                                </button>
                              )}
                              {hasUnprocessedLeft && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  className={`treatment-photos-side-source-item${sidePhotoSource === "unprocessedLeft" ? " active" : ""}`}
                                  onClick={() => { setSidePhotoSource("unprocessedLeft"); setShowSideSourceMenuModal(false); }}
                                >
                                  Original (left)
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <img
                    src={clientPhotoUrl || undefined}
                    alt={`${client?.name || "Patient"} - ${clientPhotoType}`}
                    className="treatment-photo-detail-client-image"
                  />
                </div>
              )}
              {/* Treatment example photo */}
              <div className="treatment-photo-detail-example">
                <div className="treatment-photo-detail-example-header">
                  <span className="treatment-photo-detail-example-label">Treatment Example</span>
                </div>
                <img
                  src={selectedPhoto.photoUrl}
                  alt={getPhotoTitle(selectedPhoto)}
                  className="treatment-photo-detail-image"
                />
              </div>
            </div>
            <div className="treatment-photo-detail-info-row">
              <div className="treatment-photo-detail-info">
                <div className="treatment-photo-detail-title-row">
                  <h4 className="treatment-photo-detail-title">
                    {getPhotoTitle(selectedPhoto)}
                  </h4>
                  {getMatchReason(selectedPhoto) && (
                    <span
                      className={`treatment-photo-detail-match treatment-photo-detail-match-${getMatchType(selectedPhoto)}`}
                      title="Why this photo matches your filters"
                    >
                      {getMatchReason(selectedPhoto)}
                    </span>
                  )}
                </div>
                <div className="treatment-photo-detail-meta">
                  {selectedPhoto.generalTreatments.length > 0 && (
                    <div className="treatment-photo-detail-meta-item">
                      <strong>Treatment:</strong>{" "}
                      {selectedPhoto.generalTreatments.join(", ")}
                    </div>
                  )}
                  {getDisplayAreaNames(selectedPhoto.areaNames).length > 0 && (
                    <div className="treatment-photo-detail-meta-item">
                      <strong>Area:</strong>{" "}
                      {getDisplayAreaNames(selectedPhoto.areaNames).join(", ")}
                    </div>
                  )}
                  {selectedPhoto.longevity && (
                    <div className="treatment-photo-detail-meta-item">
                      <strong>Longevity:</strong> {selectedPhoto.longevity}
                    </div>
                  )}
                  {selectedPhoto.downtime && (
                    <div className="treatment-photo-detail-meta-item">
                      <strong>Downtime:</strong> {selectedPhoto.downtime}
                    </div>
                  )}
                  {selectedPhoto.priceRange && (
                    <div className="treatment-photo-detail-meta-item">
                      <strong>Price range:</strong> {selectedPhoto.priceRange}
                    </div>
                  )}
                  {selectedPhoto.age && (
                    <div className="treatment-photo-detail-meta-item">
                      <strong>Age:</strong> {selectedPhoto.age}
                    </div>
                  )}
                  {selectedPhoto.skinType && (
                    <div className="treatment-photo-detail-meta-item">
                      <strong>Skin Type:</strong> {selectedPhoto.skinType}
                    </div>
                  )}
                  {selectedPhoto.skinTone && (
                    <div className="treatment-photo-detail-meta-item">
                      <strong>Skin Tone:</strong> {selectedPhoto.skinTone}
                    </div>
                  )}
                </div>
                {client && (onUpdate || onAddToPlanWithPrefill || onAddToPlanDirect) && (
                  addToPlanForm?.photo.id === selectedPhoto.id ? (
                    <div className="treatment-photo-detail-add-form">
                      <div className="treatment-photo-detail-add-row">
                        <span>Where:</span>
                        <div className="treatment-photo-detail-add-chips">
                          {REGION_OPTIONS.filter((r) => r !== "Multiple" && r !== "Other").map((r) => (
                            <button
                              key={r}
                              type="button"
                              className={`treatment-photo-detail-add-chip ${
                                addToPlanForm.where.includes(r) ? "treatment-photo-detail-add-chip--selected" : ""
                              }`}
                              onClick={() =>
                                setAddToPlanForm((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        where: prev.where.includes(r)
                                          ? prev.where.filter((x) => x !== r)
                                          : [...prev.where, r],
                                      }
                                    : null
                                )
                              }
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      </div>
                      {(() => {
                        const rawTx = addToPlanForm.photo.generalTreatments[0] || addToPlanForm.photo.treatments[0] || "";
                        const isSkincare = normalizeTreatment(rawTx)?.toLowerCase() === "skincare";
                        if (!isSkincare) return null;
                        return (
                          <div className="treatment-photo-detail-add-row">
                            <span>What:</span>
                            <div className="treatment-photo-detail-add-chips">
                              {SKINCARE_QUICK_ADD_WHAT_OPTIONS.map((opt) => (
                                <button
                                  key={opt}
                                  type="button"
                                  className={`treatment-photo-detail-add-chip ${
                                    addToPlanForm.product === opt ? "treatment-photo-detail-add-chip--selected" : ""
                                  }`}
                                  onClick={() =>
                                    setAddToPlanForm((prev) =>
                                      prev ? { ...prev, product: opt } : null
                                    )
                                  }
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                      <div className="treatment-photo-detail-add-row">
                        <span>When:</span>
                        <div className="treatment-photo-detail-add-chips">
                          {TIMELINE_OPTIONS.filter((t) => t !== "Completed").map((t) => (
                            <button
                              key={t}
                              type="button"
                              className={`treatment-photo-detail-add-chip ${
                                addToPlanForm.when === t ? "treatment-photo-detail-add-chip--selected" : ""
                              }`}
                              onClick={() =>
                                setAddToPlanForm((prev) => (prev ? { ...prev, when: t } : null))
                              }
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                      <details className="treatment-photo-detail-add-optional">
                        <summary>Optional details</summary>
                        <div className="treatment-photo-detail-add-optional-fields">
                          <label>
                            Product
                            <input
                              type="text"
                              placeholder="e.g. Juvederm, Botox"
                              value={addToPlanForm.product ?? ""}
                              onChange={(e) =>
                                setAddToPlanForm((prev) =>
                                  prev ? { ...prev, product: e.target.value } : null
                                )
                              }
                            />
                          </label>
                          <label>
                            Quantity
                            <input
                              type="text"
                              placeholder="e.g. 2"
                              value={addToPlanForm.quantity ?? ""}
                              onChange={(e) =>
                                setAddToPlanForm((prev) =>
                                  prev ? { ...prev, quantity: e.target.value } : null
                                )
                              }
                            />
                          </label>
                          <label>
                            Notes
                            <textarea
                              placeholder="Optional notes"
                              rows={2}
                              value={addToPlanForm.notes ?? ""}
                              onChange={(e) =>
                                setAddToPlanForm((prev) =>
                                  prev ? { ...prev, notes: e.target.value } : null
                                )
                              }
                            />
                          </label>
                        </div>
                      </details>
                      <div className="treatment-photo-detail-add-actions">
                        <button
                          type="button"
                          className="treatment-photo-detail-add-btn-confirm"
                          onClick={() => confirmAddToPlanForm()}
                          disabled={addingId === selectedPhoto.id}
                        >
                          {addingId === selectedPhoto.id ? "Adding…" : "Confirm"}
                        </button>
                        <button
                          type="button"
                          className="treatment-photo-detail-add-btn-cancel"
                          onClick={() => setAddToPlanForm(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={`treatment-photo-detail-add-btn${
                        isPhotoInPlan(selectedPhoto)
                          ? " treatment-photo-detail-add-btn-added"
                          : ""
                      }`}
                      onClick={() => !isPhotoInPlan(selectedPhoto) && handleAddToPlan(selectedPhoto)}
                      disabled={
                        addingId === selectedPhoto.id || isPhotoInPlan(selectedPhoto)
                      }
                      title={
                        isPhotoInPlan(selectedPhoto)
                          ? "This treatment is already in the plan"
                          : "Add to plan with Where and When"
                      }
                    >
                      {addingId === selectedPhoto.id
                        ? "Adding…"
                        : isPhotoInPlan(selectedPhoto)
                          ? "Added to plan"
                          : "Add to plan"}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
