// Client Detail Modal Component - Complete Version

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Client, DiscussedItem } from "../../types";
import {
  formatDate,
  formatDateOfBirth,
  formatRelativeDate,
} from "../../utils/dateFormatting";
import {
  formatFacialStatusForDisplay,
  getFacialStatusColorForDisplay,
  hasFacialInterestedTreatments,
} from "../../utils/statusFormatting";
import { WEB_POPUP_LEAD_NO_ANALYSIS_STATUS } from "../../utils/clientMapper";
import { showOnlineTreatmentFinderSection } from "../../utils/leadSource";
import { updateLeadRecord, fetchRecordQuizFields } from "../../services/api";
import {
  archiveClient,
  updateClientStatus,
  markOfferRedeemed,
} from "../../services/contactHistory";
import { showToast, showError } from "../../utils/toast";
import ContactHistorySection from "./ContactHistorySection";
import ClientSmsPopupModal from "./ClientSmsPopupModal";
import AnalysisResultsSection from "./AnalysisResultsSection";
import TelehealthSMSModal from "./TelehealthSMSModal";
import ShareAnalysisModal from "./ShareAnalysisModal";
import ShareTreatmentPlanModal from "./ShareTreatmentPlanModal";
import ShareTreatmentPlanLinkModal from "./ShareTreatmentPlanLinkModal";
import PhotoViewerModal from "./PhotoViewerModal";
import NewClientSMSModal from "./NewClientSMSModal";
import SendSMSModal from "./SendSMSModal";
import DiscussedTreatmentsModal from "./DiscussedTreatmentsModal";
import TreatmentPlanCheckoutModal, {
  prefetchCheckoutImages,
} from "./TreatmentPlanCheckoutModal";
import {
  getDiscussedPlanItemPriceLabels,
  getDiscussedItemQuoteOrderRankById,
} from "./DiscussedTreatmentsModal/TreatmentPlanCheckout";
import TreatmentPhotosModal from "./TreatmentPhotosModal";
import AnalysisOverviewModal, {
  type DetailView,
} from "./AnalysisOverviewModal";
import type {
  TreatmentPlanAddDirectOptions,
  TreatmentPlanPrefill,
} from "./DiscussedTreatmentsModal/TreatmentPhotos";
import TreatmentRecommenderByTreatment from "../treatmentRecommender/TreatmentRecommenderByTreatment";
import TreatmentRecommenderBySuggestion from "../treatmentRecommender/TreatmentRecommenderBySuggestion";
import SkinTypeQuizModal from "./SkinTypeQuizModal";
import SkinQuizProductModal, {
  type SkinQuizProduct,
} from "./SkinQuizProductModal";
import WellnessQuizModal from "./WellnessQuizModal";
import WellnessQuizResultsCards from "../wellnessQuiz/WellnessQuizResultsCards";
import {
  getSuggestedWellnessTreatments,
  getWellnessQuizResultsSMSMessage,
  WELLNESS_QUIZ_ENABLED,
} from "../../data/wellnessQuiz";
import {
  buildQuizSkincareRoutineSections,
  computeQuizScores,
  computeQuizProfile,
  SKIN_TYPE_DISPLAY_LABELS,
  SKIN_TYPE_SCORE_ORDER,
  GEMSTONE_BY_SKIN_TYPE,
} from "../../data/skinTypeQuiz";
import {
  generateId,
  getTreatmentPlanRowPrimaryLabel,
  getTreatmentPlanRowSecondaryLabel,
} from "./DiscussedTreatmentsModal/utils";
import {
  PLAN_SECTIONS,
  SKINCARE_SECTION_LABEL,
  getSkincareCarouselItems,
} from "./DiscussedTreatmentsModal/constants";
import { persistClientDiscussedItems } from "../../utils/wellnestDemoPlanPersistence";
import { getSkinQuizMessage } from "../../utils/skinQuizLink";
import {
  mergeWellnessIntakeFromField,
  parseInterestedIssuesList,
  partitionInterestedIssuesForFacialVsWellness,
} from "../../utils/partitionInterestedIssuesWellnessFacial";
import { discussedItemMatchesWellnessOffering } from "../../utils/wellnessDiscussedItems";
import {
  getJotformUrl,
  formatProviderDisplayName,
  isPostVisitBlueprintSender,
  isUniqueAestheticsProvider,
  providerShowsTheTreatmentPreviewUi,
} from "../../utils/providerHelpers";
import {
  splitName,
  cleanPhoneNumber,
  coerceToAirtableNumberAge,
  formatPhoneDisplay,
  formatPhoneInput,
} from "../../utils/validation";
import {
  mapAreasToFormFields,
  parseDateOfBirthForForm,
} from "../../utils/formMapping";
import {
  shouldLoadPhotoForClient,
  fetchClientFrontPhoto,
  getClientFrontPhotoDisplayUrl,
} from "../../utils/photoLoading";
import { formatZipCodeInput } from "../../utils/validation";
import { useDashboard } from "../../context/DashboardContext";
import "./ClientDetailModal.css";

interface ClientDetailModalProps {
  client: Client | null;
  onClose: () => void;
  onUpdate: () => void;
}

export default function ClientDetailModal({
  client,
  onClose,
  onUpdate,
}: ClientDetailModalProps) {
  const { provider } = useDashboard();
  const treatmentPreviewUiEnabled =
    providerShowsTheTreatmentPreviewUi(provider);

  const intakeIssuePartition = useMemo(() => {
    if (!client) {
      return {
        facialInterests: [] as string[],
        wellnessInterests: [] as string[],
      };
    }
    const part = partitionInterestedIssuesForFacialVsWellness(
      parseInterestedIssuesList(client),
    );
    return {
      facialInterests: part.facialInterests,
      wellnessInterests: mergeWellnessIntakeFromField(
        part.wellnessInterests,
        client.wellnessGoals,
      ),
    };
  }, [client?.id, client?.interestedIssues, client?.wellnessGoals]);
  const intakeWellnessInterests = intakeIssuePartition.wellnessInterests;
  const intakeFacialInterests = intakeIssuePartition.facialInterests;

  const wellnessPlanItems = useMemo(() => {
    if (!client?.discussedItems?.length) return [];
    return client.discussedItems.filter(discussedItemMatchesWellnessOffering);
  }, [client?.id, client?.discussedItems]);

  const discussedPlanPriceLabels = useMemo(
    () => getDiscussedPlanItemPriceLabels(client?.discussedItems ?? []),
    [client?.discussedItems],
  );

  const planQuoteOrderRank = useMemo(
    () => getDiscussedItemQuoteOrderRankById(client?.discussedItems ?? []),
    [client?.discussedItems],
  );

  const [isEditMode, setIsEditMode] = useState(false);
  const [editedClient, setEditedClient] = useState<Partial<Client> | null>(
    null,
  );
  const [status, setStatus] = useState<Client["status"]>("new");
  const [showTelehealthSMS, setShowTelehealthSMS] = useState(false);
  const [showShareAnalysis, setShowShareAnalysis] = useState(false);
  const [showShareTreatmentPlan, setShowShareTreatmentPlan] = useState(false);
  const [showShareTreatmentPlanLink, setShowShareTreatmentPlanLink] =
    useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [photoViewerType, setPhotoViewerType] = useState<"front" | "side">(
    "front",
  );
  const [frontPhotoUrl, setFrontPhotoUrl] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [showScanDropdown, setShowScanDropdown] = useState(false);
  const [showNewClientSMS, setShowNewClientSMS] = useState(false);
  const [showSendSMS, setShowSendSMS] = useState(false);
  const [showSmsPopup, setShowSmsPopup] = useState(false);
  const [smsInitialMessage, setSMSInitialMessage] = useState<string | null>(
    null,
  );
  const [showDiscussedTreatments, setShowDiscussedTreatments] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showAnalysisOverview, setShowAnalysisOverview] = useState(false);
  const [returnToOverviewView, setReturnToOverviewView] =
    useState<DetailView | null>(null);
  const [initialAddFormPrefill, setInitialAddFormPrefill] =
    useState<TreatmentPlanPrefill | null>(null);
  const [initialEditingItem, setInitialEditingItem] =
    useState<DiscussedItem | null>(null);
  const [issuePhotosContext, setIssuePhotosContext] = useState<{
    issue?: string;
    region?: string;
    interest?: string;
  } | null>(null);
  const [recommenderMode, setRecommenderMode] = useState<
    "by-treatment" | "by-suggestion" | null
  >(null);
  const [showSkinTypeQuiz, setShowSkinTypeQuiz] = useState(false);
  const [showWellnessQuiz, setShowWellnessQuiz] = useState(false);
  const [selectedSkinProduct, setSelectedSkinProduct] =
    useState<SkinQuizProduct | null>(null);
  const [enrichedSkincareQuiz, setEnrichedSkincareQuiz] =
    useState<Client["skincareQuiz"]>(undefined);
  const scanDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (client) {
      setEditedClient({
        ...client,
        phone: client.phone ? formatPhoneDisplay(client.phone) : "",
      });
      setStatus(client.status);

      // Load front photo: inline URL string, Airtable attachment array, or fetch on demand
      const resolved = getClientFrontPhotoDisplayUrl(client.frontPhoto);
      if (resolved) {
        setFrontPhotoUrl(resolved);
        setPhotoLoading(false);
      } else if (
        client.tableSource === "Patients" &&
        !client.frontPhotoLoaded &&
        shouldLoadPhotoForClient(client)
      ) {
        setFrontPhotoUrl(null);
        setPhotoLoading(true);
        fetchClientFrontPhoto(client.id)
          .then((photo) => {
            const url = getClientFrontPhotoDisplayUrl(photo);
            if (url) setFrontPhotoUrl(url);
            setPhotoLoading(false);
          })
          .catch(() => {
            setPhotoLoading(false);
          });
      } else {
        setFrontPhotoUrl(null);
        setPhotoLoading(false);
      }
    }
  }, [client]);

  // Prefetch checkout images when client has discussed items so Checkout opens with images ready
  useEffect(() => {
    if (client?.discussedItems && client.discussedItems.length > 0) {
      prefetchCheckoutImages();
    }
  }, [client?.discussedItems?.length]);

  // Load Skincare Quiz when list response didn't include it (e.g. backend omits long-text fields)
  useEffect(() => {
    if (
      !client?.id ||
      !client.tableSource ||
      (client.skincareQuiz !== undefined && client.skincareQuiz !== null)
    ) {
      setEnrichedSkincareQuiz(undefined);
      return;
    }
    let cancelled = false;
    fetchRecordQuizFields(client.id, client.tableSource)
      .then(({ skincareQuiz: quiz }) => {
        if (!cancelled) setEnrichedSkincareQuiz(quiz ?? null);
      })
      .catch(() => {
        if (!cancelled) setEnrichedSkincareQuiz(null);
      });
    return () => {
      cancelled = true;
    };
  }, [client?.id, client?.tableSource, client?.skincareQuiz]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && client) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [client, onClose]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        scanDropdownRef.current &&
        !scanDropdownRef.current.contains(event.target as Node)
      ) {
        setShowScanDropdown(false);
      }
    };

    if (showScanDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showScanDropdown]);

  const planItemsAppendRef = useRef<DiscussedItem[]>([]);
  planItemsAppendRef.current = client?.discussedItems ?? [];

  const appendDiscussedItemFromPrefill = useCallback(
    async (
      prefill: TreatmentPlanPrefill,
      options?: TreatmentPlanAddDirectOptions,
    ): Promise<DiscussedItem | void> => {
      if (!client) return;
      const newItem: DiscussedItem = {
        id: generateId(),
        addedAt: new Date().toISOString(),
        interest: prefill.interest?.trim() || undefined,
        findings: prefill.findings?.length ? prefill.findings : undefined,
        treatment: prefill.treatment?.trim() || "",
        product: prefill.treatmentProduct?.trim() || undefined,
        region: prefill.region?.trim() || undefined,
        timeline: (prefill.timeline?.trim() || "Wishlist") as string,
        quantity: prefill.quantity?.trim() || undefined,
        notes: prefill.notes?.trim() || undefined,
      };
      const nextItems = [...planItemsAppendRef.current, newItem];
      planItemsAppendRef.current = nextItems;
      try {
        await persistClientDiscussedItems(client, nextItems);
        if (!options?.skipToast) showToast("Added to treatment plan");
        onUpdate();
        return newItem;
      } catch (e) {
        showError(
          e instanceof Error ? e.message : "Failed to add to plan",
        );
        throw e;
      }
    },
    [client, onUpdate],
  );

  if (!client) return null;

  const skincareQuiz: Client["skincareQuiz"] =
    client.skincareQuiz ?? enrichedSkincareQuiz;

  const lastActivityRelative = client.lastContact
    ? formatRelativeDate(client.lastContact)
    : client.createdAt
      ? formatRelativeDate(client.createdAt)
      : "No activity yet";

  const handleSave = async () => {
    if (!editedClient || !client) return;

    try {
      const airtableAge = coerceToAirtableNumberAge(editedClient.age);
      await updateLeadRecord(client.id, client.tableSource, {
        Name: editedClient.name,
        Email:
          client.tableSource === "Patients" ? editedClient.email : undefined,
        "Email Address":
          client.tableSource === "Web Popup Leads"
            ? editedClient.email
            : undefined,
        "Phone Number":
          client.tableSource === "Web Popup Leads"
            ? editedClient.phone
              ? cleanPhoneNumber(editedClient.phone)
              : undefined
            : undefined,
        "Patient Phone Number":
          client.tableSource === "Patients"
            ? editedClient.phone
              ? cleanPhoneNumber(editedClient.phone)
              : undefined
            : undefined,
        "Zip Code": editedClient.zipCode || null,
        ...(airtableAge !== null ? { Age: airtableAge } : {}),
        Source: editedClient.source || undefined,
      });

      showToast("Client updated successfully");
      setIsEditMode(false);
      onUpdate();
    } catch (error: any) {
      showError(error.message || "Failed to update client");
    }
  };

  const handleCancel = () => {
    setEditedClient({
      ...client,
      phone: client.phone ? formatPhoneDisplay(client.phone) : "",
    });
    setIsEditMode(false);
  };

  const handleStatusChange = async (newStatus: Client["status"]) => {
    try {
      await updateClientStatus(client, newStatus);
      setStatus(newStatus);
      showToast(`Status updated to ${newStatus}`);
      onUpdate();
    } catch (error: any) {
      showError(error.message || "Failed to update status");
    }
  };

  const handleArchive = async () => {
    const action = client.archived ? "unarchive" : "archive";
    if (!window.confirm(`Are you sure you want to ${action} ${client.name}?`)) {
      return;
    }

    try {
      await archiveClient(client, !client.archived);
      showToast(`${client.name} has been ${action}d`);
      onClose();
      onUpdate();
    } catch (error: any) {
      showError(error.message || `Failed to ${action} client`);
    }
  };

  const handleCall = () => {
    if (client.phone) {
      window.location.href = `tel:${client.phone}`;
    }
  };

  const handleEmail = () => {
    if (client.email) {
      window.location.href = `mailto:${client.email}`;
    }
  };

  const handleScanPatientNow = () => {
    const { first, last } = splitName(client.name);
    const phoneNumber = cleanPhoneNumber(client.phone);
    const { whatAreas, faceRegions } = mapAreasToFormFields(client);
    const dob = parseDateOfBirthForForm(client.dateOfBirth);

    const params: string[] = [];
    if (first) params.push(`name[first]=${encodeURIComponent(first)}`);
    if (last) params.push(`name[last]=${encodeURIComponent(last)}`);
    if (client.email) params.push(`email=${encodeURIComponent(client.email)}`);
    if (phoneNumber)
      params.push(`phoneNumber=${encodeURIComponent(phoneNumber)}`);
    if (dob) {
      params.push(`dateOf[month]=${encodeURIComponent(String(dob.month))}`);
      params.push(`dateOf[day]=${encodeURIComponent(String(dob.day))}`);
      params.push(`dateOf[year]=${encodeURIComponent(String(dob.year))}`);
    }
    if (whatAreas.length > 0)
      params.push(`whatAre137=${encodeURIComponent(whatAreas[0])}`);
    else if (faceRegions.length > 0)
      params.push(`whatAre137=${encodeURIComponent("Face")}`);
    if (faceRegions.length > 0)
      params.push(
        `whichRegions138=${encodeURIComponent(faceRegions.join(","))}`,
      );

    const baseUrl = getJotformUrl(provider);
    const formUrl =
      params.length > 0 ? `${baseUrl}?${params.join("&")}` : baseUrl;
    window.open(formUrl, "_blank");
  };

  const handleScanInClinic = () => {
    setShowScanDropdown(false);
    handleScanPatientNow();
    showToast(`Opening scan form for ${client.name}`);
  };

  // Check if forms have data
  const hasWebPopupForm = client.tableSource === "Web Popup Leads";
  const hasFacialAnalysisForm = client.tableSource === "Patients";

  const webPopupFormHasData =
    hasWebPopupForm &&
    (client.ageRange ||
      client.skinType ||
      client.skinTone ||
      client.ethnicBackground ||
      (typeof client.concerns === "string" && client.concerns.trim()) ||
      (Array.isArray(client.concerns) && client.concerns.length > 0) ||
      (client.areas && client.areas.length > 0) ||
      (client.aestheticGoals &&
        (typeof client.aestheticGoals === "string"
          ? client.aestheticGoals.trim()
          : String(client.aestheticGoals).trim())) ||
      (client.concernsExplored &&
        (Array.isArray(client.concernsExplored)
          ? client.concernsExplored.length > 0
          : client.concernsExplored)) ||
      client.offerClaimed);

  const facialAnalysisFormHasData =
    hasFacialAnalysisForm &&
    ((client.aestheticGoals &&
      (typeof client.aestheticGoals === "string"
        ? client.aestheticGoals.trim()
        : String(client.aestheticGoals).trim())) ||
      client.whichRegions ||
      client.skinComplaints ||
      client.areasOfInterestFromForm ||
      client.processedAreasOfInterest ||
      (client.goals &&
        Array.isArray(client.goals) &&
        client.goals.length > 0) ||
      client.allIssues ||
      intakeFacialInterests.length > 0);

  const showTreatmentRecommenderShortcut =
    facialAnalysisFormHasData ||
    webPopupFormHasData ||
    intakeWellnessInterests.length > 0 ||
    wellnessPlanItems.length > 0;

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div
        className="modal-content client-detail-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-info">
            {recommenderMode && (
              <button
                type="button"
                className="client-detail-modal-back"
                onClick={() => setRecommenderMode(null)}
              >
                ← Back to client
              </button>
            )}
            <h2 className="modal-title">{client.name}</h2>
            {recommenderMode && (
              <span className="client-detail-modal-header-subtitle">
                Treatment Recommender
              </span>
            )}
            {!recommenderMode && (
              <div className="modal-header-activity-container">
                <div className="modal-header-activity-badge">
                  <span className="modal-header-activity-label">
                    Last Activity:
                  </span>
                  <span className="modal-header-activity-value">
                    {lastActivityRelative}
                  </span>
                </div>
              </div>
            )}
          </div>
          <button
            className="modal-close"
            onClick={recommenderMode ? () => setRecommenderMode(null) : onClose}
            aria-label={recommenderMode ? "Back to client details" : "Close"}
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          {recommenderMode === "by-treatment" && client && (
            <TreatmentRecommenderByTreatment
              client={client}
              onBack={() => setRecommenderMode(null)}
              onUpdate={onUpdate}
              onAddToPlanDirect={appendDiscussedItemFromPrefill}
              onOpenCheckout={() => setShowCheckoutModal(true)}
              onRemovePlanItem={async (itemId) => {
                const nextItems = (client.discussedItems || []).filter(
                  (i) => i.id !== itemId,
                );
                try {
                  await persistClientDiscussedItems(client, nextItems);
                  showToast("Removed from plan");
                  onUpdate();
                } catch (e) {
                  showError(
                    e instanceof Error ? e.message : "Failed to remove",
                  );
                }
              }}
              onUpdatePlanItem={async (itemId, patch) => {
                const nextItems = (client.discussedItems || []).map((i) =>
                  i.id === itemId ? { ...i, ...patch } : i,
                );
                try {
                  await persistClientDiscussedItems(client, nextItems);
                  showToast("Plan updated");
                  onUpdate();
                } catch (e) {
                  showError(
                    e instanceof Error ? e.message : "Failed to update plan",
                  );
                  throw e;
                }
              }}
              onShareTreatmentPlan={
                (client.discussedItems?.length ?? 0) > 0 &&
                (isPostVisitBlueprintSender(provider) ||
                  facialAnalysisFormHasData)
                  ? () =>
                      isPostVisitBlueprintSender(provider)
                        ? setShowShareTreatmentPlanLink(true)
                        : setShowShareTreatmentPlan(true)
                  : undefined
              }
            />
          )}
          {recommenderMode === "by-suggestion" && client && (
            <TreatmentRecommenderBySuggestion
              client={client}
              onBack={() => setRecommenderMode(null)}
              onUpdate={onUpdate}
              onAddToPlanDirect={appendDiscussedItemFromPrefill}
            />
          )}
          {!recommenderMode ? (
            <div className="client-detail-modal-main">
              {/* Contact Information Section */}
              <div
                className={`detail-section modal-contact-section ${
                  frontPhotoUrl ||
                  client.tableSource === "Patients" ||
                  client.tableSource === "Web Popup Leads"
                    ? "modal-header-with-photo"
                    : "modal-contact-section-base"
                }`}
              >
                {frontPhotoUrl && (
                  <div
                    className="modal-photo-container modal-photo-container-clickable"
                    onClick={() => {
                      setPhotoViewerType("front");
                      setShowPhotoViewer(true);
                    }}
                    title="Click to view photos"
                  >
                    <img
                      src={frontPhotoUrl}
                      alt={client.name}
                      className="modal-photo"
                      loading="eager"
                    />
                    <div className="modal-photo-overlay">Click to view</div>
                  </div>
                )}
                {photoLoading && !frontPhotoUrl && (
                  <div className="modal-photo-container modal-photo-loading">
                    <div className="modal-photo-loading-text">
                      Loading photo...
                    </div>
                  </div>
                )}
                {!frontPhotoUrl &&
                  !photoLoading &&
                  client.tableSource === "Patients" && (
                    <div className="modal-photo-placeholder modal-photo-placeholder-wrapper">
                      <div className="photo-placeholder-container">
                        <svg
                          width="80"
                          height="80"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#999"
                          strokeWidth="1.5"
                          className="photo-placeholder-icon"
                        >
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                          <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        <p className="photo-placeholder-text">
                          {client.facialAnalysisStatus &&
                          client.facialAnalysisStatus.toLowerCase().trim() ===
                            "pending"
                            ? "Photo will become available once the analysis is complete."
                            : "No profile photo available. Share the facial analysis link to help this patient complete their analysis."}
                        </p>
                        {(!client.facialAnalysisStatus ||
                          client.facialAnalysisStatus.toLowerCase().trim() !==
                            "pending") && (
                          <button
                            type="button"
                            className="btn-secondary btn-sm photo-placeholder-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowShareAnalysis(true);
                            }}
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                              <polyline points="16 6 12 2 8 6"></polyline>
                              <line x1="12" y1="2" x2="12" y2="15"></line>
                            </svg>
                            Share Analysis
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                {!frontPhotoUrl &&
                  !photoLoading &&
                  client.tableSource === "Web Popup Leads" && (
                    <div className="modal-photo-container">
                      <div className="web-popup-photo-placeholder">
                        <div className="web-popup-avatar">
                          {client.name.charAt(0).toUpperCase()}
                        </div>
                        <p className="web-popup-placeholder-text">
                          No profile photo available
                        </p>
                      </div>
                    </div>
                  )}
                <div className="detail-section-relative">
                  {!isEditMode && (
                    <div className="modal-contact-edit-toolbar">
                      <button
                        type="button"
                        className="edit-toggle-btn"
                        onClick={() => setIsEditMode(true)}
                        aria-label="Edit contact information"
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                    </div>
                  )}
                  <div className="detail-grid">
                    <div className="detail-item">
                      <label>Email</label>
                      {isEditMode ? (
                        <input
                          type="email"
                          value={editedClient?.email || ""}
                          onChange={(e) =>
                            setEditedClient({
                              ...editedClient,
                              email: e.target.value,
                            })
                          }
                          className="edit-input"
                        />
                      ) : (
                        <div className="detail-value">
                          {client.email || "N/A"}
                        </div>
                      )}
                    </div>
                    <div className="detail-item">
                      <label>Phone</label>
                      {isEditMode ? (
                        <input
                          type="tel"
                          value={editedClient?.phone ?? ""}
                          onInput={(e) => {
                            const input = e.target as HTMLInputElement;
                            formatPhoneInput(input);
                            setEditedClient({
                              ...editedClient,
                              phone: input.value,
                            });
                          }}
                          className="edit-input"
                        />
                      ) : (
                        <div className="detail-value">
                          {client.phone
                            ? formatPhoneDisplay(client.phone)
                            : "Not provided"}
                        </div>
                      )}
                    </div>
                    {client.ageRange && (
                      <div className="detail-item">
                        <label>Age Range</label>
                        <div className="detail-value">{client.ageRange}</div>
                      </div>
                    )}
                    {client.age && !client.ageRange && (
                      <div className="detail-item">
                        <label>Age</label>
                        <div className="detail-value">
                          {client.age} years old
                        </div>
                      </div>
                    )}
                    {client.dateOfBirth && (
                      <div className="detail-item">
                        <label>Date of Birth</label>
                        <div className="detail-value">
                          <span className="detail-value-date">
                            {formatDateOfBirth(client.dateOfBirth)}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="detail-item">
                      <label>Status</label>
                      <select
                        value={status}
                        onChange={(e) =>
                          handleStatusChange(e.target.value as Client["status"])
                        }
                        className="detail-status-select-full"
                      >
                        <option value="new">New Lead</option>
                        <option value="contacted">Contacted</option>
                        <option value="requested-consult">
                          Requested Consult
                        </option>
                        <option value="scheduled">
                          Consultation Scheduled
                        </option>
                        <option value="converted">Converted</option>
                        <option value="current-client">Current Client</option>
                      </select>
                    </div>
                    {(client.source || isEditMode) && (
                      <div className="detail-item">
                        <label>Source</label>
                        {isEditMode ? (
                          <select
                            value={editedClient?.source || ""}
                            onChange={(e) =>
                              setEditedClient({
                                ...editedClient,
                                source: e.target.value || undefined,
                              })
                            }
                            className="edit-input"
                          >
                            <option value="">—</option>
                            <option value="Walk-in">Walk-in</option>
                            <option value="Phone Call">Phone Call</option>
                            <option value="Referral">Referral</option>
                            <option value="Social Media">Social Media</option>
                            <option value="Website">Website</option>
                            <option value="AI Consult">AI Consult Tool</option>
                            <option value="Other">Other</option>
                          </select>
                        ) : (
                          <div className="detail-value">
                            {client.source || "Not provided"}
                          </div>
                        )}
                      </div>
                    )}
                    {client.tableSource === "Patients" &&
                      (client.locationName || client.appointmentStaffName) && (
                        <>
                          {client.locationName && (
                            <div className="detail-item">
                              <label>Location</label>
                              <div className="detail-value">
                                {client.locationName}
                              </div>
                            </div>
                          )}
                          {client.appointmentStaffName && (
                            <div className="detail-item">
                              <label>Provider name</label>
                              <div className="detail-value">
                                {formatProviderDisplayName(
                                  client.appointmentStaffName,
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    <div className="detail-item">
                      <label>Zip Code</label>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={editedClient?.zipCode || ""}
                          onChange={(e) => {
                            formatZipCodeInput(e.target);
                            setEditedClient({
                              ...editedClient,
                              zipCode: e.target.value,
                            });
                          }}
                          className="edit-input"
                          maxLength={10}
                        />
                      ) : (
                        <div className="detail-value">
                          {client.zipCode || "Not provided"}
                        </div>
                      )}
                    </div>
                    <div className="detail-item">
                      <label>Last Activity</label>
                      <div className="detail-value">{lastActivityRelative}</div>
                    </div>
                  </div>
                  {isEditMode && (
                    <div className="edit-actions">
                      <button
                        className="btn-secondary btn-sm"
                        onClick={handleCancel}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn-primary btn-sm"
                        onClick={handleSave}
                      >
                        Save Changes
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Online Treatment Finder – marketing web / popup funnel only (not Add Client or Walk-in) */}
              {showOnlineTreatmentFinderSection(client) && (
                <div className="detail-section detail-section-with-border">
                  <div className="detail-section-title detail-section-title-flex">
                    <span>Online Treatment Finder</span>
                    {client.createdAt && (
                      <span className="detail-value-muted detail-section-date">
                        Completed {formatDate(client.createdAt)}
                      </span>
                    )}
                  </div>

                  {/* $50 coupon – white box with Earned / Claimed side by side, checkbox-style Yes/No */}
                  <div className="detail-section-spacing">
                    <div className="detail-coupon-box">
                      <h4 className="detail-coupon-title">$50 coupon</h4>
                      <div className="detail-coupon-row-inline">
                        <div className="detail-coupon-cell">
                          <span className="detail-coupon-label">Earned</span>
                          <span
                            className={`detail-coupon-badge ${
                              client.offerEarned !== false
                                ? "detail-coupon-badge--yes"
                                : "detail-coupon-badge--no"
                            }`}
                            aria-label={
                              client.offerEarned !== false
                                ? "Earned: Yes"
                                : "Earned: No"
                            }
                          >
                            {client.offerEarned !== false ? (
                              <>
                                <span
                                  className="detail-coupon-check"
                                  aria-hidden
                                >
                                  ✓
                                </span>
                                <span>Yes</span>
                              </>
                            ) : (
                              <>
                                <span className="detail-coupon-x" aria-hidden>
                                  ✗
                                </span>
                                <span>No</span>
                              </>
                            )}
                          </span>
                        </div>
                        <div className="detail-coupon-cell">
                          <span className="detail-coupon-label">Claimed</span>
                          {client.offerClaimed ? (
                            <span
                              className="detail-coupon-badge detail-coupon-badge--yes"
                              aria-label="Claimed: Yes"
                            >
                              <span className="detail-coupon-check" aria-hidden>
                                ✓
                              </span>
                              <span>Yes</span>
                            </span>
                          ) : (
                            <div className="detail-coupon-claimed-wrap">
                              <span
                                className="detail-coupon-badge detail-coupon-badge--no"
                                aria-label="Claimed: No"
                              >
                                <span className="detail-coupon-x" aria-hidden>
                                  ✗
                                </span>
                                <span>No</span>
                              </span>
                              <button
                                type="button"
                                className="btn-secondary btn-sm"
                                onClick={async () => {
                                  try {
                                    await markOfferRedeemed(client);
                                    showToast("Coupon marked as redeemed");
                                    onUpdate();
                                  } catch (e) {
                                    showError(
                                      e instanceof Error
                                        ? e.message
                                        : "Failed to mark as redeemed",
                                    );
                                  }
                                }}
                              >
                                Mark as redeemed
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="detail-grid-custom">
                    <div>
                      <div className="detail-label">Concerns</div>
                      <div className="detail-tags-container">
                        {(() => {
                          const list: string[] =
                            typeof client.concerns === "string"
                              ? client.concerns
                                  .split(",")
                                  .map((c) => c.trim())
                                  .filter(Boolean)
                              : Array.isArray(client.concerns)
                                ? client.concerns.filter(
                                    (c): c is string => typeof c === "string",
                                  )
                                : [];
                          return list.length > 0 ? (
                            list.map((c, i) => (
                              <span key={i} className="detail-tag">
                                {c}
                              </span>
                            ))
                          ) : (
                            <span className="detail-value-empty">N/A</span>
                          );
                        })()}
                      </div>
                    </div>
                    <div>
                      <div className="detail-label">Focus Areas</div>
                      <div className="detail-tags-container">
                        {client.areas && client.areas.length > 0 ? (
                          (Array.isArray(client.areas)
                            ? client.areas
                            : [client.areas]
                          ).map((a, i) => (
                            <span key={i} className="detail-tag">
                              {String(a).replace(/\+/g, " ")}
                            </span>
                          ))
                        ) : (
                          <span className="detail-value-empty">N/A</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="detail-section-spacing">
                    <div className="detail-label">Demographics</div>
                    <div className="detail-grid detail-grid-demographics">
                      <div className="detail-item">
                        <label className="detail-label-small">Skin Type</label>
                        <div className="detail-value detail-value-small">
                          {client.skinType && String(client.skinType).trim()
                            ? client.skinType.length > 0
                              ? client.skinType.charAt(0).toUpperCase() +
                                client.skinType.slice(1)
                              : client.skinType
                            : "N/A"}
                        </div>
                      </div>
                      <div className="detail-item">
                        <label className="detail-label-small">Skin Tone</label>
                        <div className="detail-value detail-value-small">
                          {client.skinTone && String(client.skinTone).trim()
                            ? client.skinTone.length > 0
                              ? client.skinTone.charAt(0).toUpperCase() +
                                client.skinTone.slice(1)
                              : client.skinTone
                            : "N/A"}
                        </div>
                      </div>
                      <div className="detail-item">
                        <label className="detail-label-small">
                          Ethnic Background
                        </label>
                        <div className="detail-value detail-value-small">
                          {client.ethnicBackground &&
                          String(client.ethnicBackground).trim()
                            ? client.ethnicBackground.length > 0
                              ? client.ethnicBackground
                                  .charAt(0)
                                  .toUpperCase() +
                                client.ethnicBackground.slice(1)
                              : client.ethnicBackground
                            : "N/A"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="detail-section detail-section-treatment-plan">
                <div className="discussed-treatments-in-facial-section">
                  <div className="discussed-treatments-in-facial-title-row">
                    <div className="discussed-treatments-in-facial-heading-block">
                      <span className="discussed-treatments-in-facial-heading">
                        {client.name?.trim().split(/\s+/)[0] || "Patient"}
                        &apos;s plan
                      </span>
                      <span className="discussed-treatments-in-facial-subheading">
                        From the visit and your notes (not limited to facial
                        scan)
                      </span>
                    </div>
                    <div className="discussed-treatments-in-facial-actions">
                      {client.discussedItems &&
                        client.discussedItems.length > 0 &&
                        (isPostVisitBlueprintSender(provider) ||
                          facialAnalysisFormHasData) && (
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            onClick={() =>
                              isPostVisitBlueprintSender(provider)
                                ? setShowShareTreatmentPlanLink(true)
                                : setShowShareTreatmentPlan(true)
                            }
                          >
                            Share
                          </button>
                        )}
                      {showTreatmentRecommenderShortcut && (
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRecommenderMode("by-treatment");
                          }}
                        >
                          Treatment Recommender
                        </button>
                      )}
                      {/* Plan Manage/Add — hidden for now (re-enable when Discussed Treatments modal flow is ready). */}
                      {false && (
                        <button
                          type="button"
                          className="btn-secondary btn-sm client-detail-plan-open-modal-btn"
                          onClick={() => setShowDiscussedTreatments(true)}
                        >
                          {(client?.discussedItems?.length ?? 0) > 0
                            ? "Manage"
                            : "Add"}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="discussed-treatments-in-facial-summary-row">
                    {client.discussedItems &&
                    client.discussedItems.length > 0 ? (
                      <div className="discussed-treatments-plan-sections-outer">
                        {(() => {
                          const items = client.discussedItems || [];
                          const skincareItems = items
                            .filter((i) => i.treatment?.trim() === "Skincare")
                            .sort(
                              (a, b) =>
                                (planQuoteOrderRank.get(a.id) ?? 9999) -
                                (planQuoteOrderRank.get(b.id) ?? 9999),
                            );
                          const hasSkincare = skincareItems.length > 0;
                          const sectionLabels = hasSkincare
                            ? [SKINCARE_SECTION_LABEL, ...PLAN_SECTIONS]
                            : [...PLAN_SECTIONS];
                          return sectionLabels.map((sectionLabel) => {
                            const sectionItems =
                              sectionLabel === SKINCARE_SECTION_LABEL
                                ? skincareItems
                                : (client.discussedItems || [])
                                    .filter((item) => {
                                      if (item.treatment?.trim() === "Skincare")
                                        return false;
                                      const t = item.timeline?.trim();
                                      if (sectionLabel === "Now")
                                        return t === "Now";
                                      if (sectionLabel === "Add next visit")
                                        return t === "Add next visit";
                                      if (sectionLabel === "Completed")
                                        return t === "Completed";
                                      return t === "Wishlist" || !t;
                                    })
                                    .sort(
                                      (a, b) =>
                                        (planQuoteOrderRank.get(a.id) ??
                                          9999) -
                                        (planQuoteOrderRank.get(b.id) ??
                                          9999),
                                    );
                            if (sectionItems.length === 0) return null;
                            return (
                              <div
                                key={sectionLabel}
                                className="discussed-treatments-plan-section-outer"
                              >
                                <h4 className="discussed-treatments-plan-section-title-outer">
                                  {sectionLabel}
                                </h4>
                                <div className="discussed-treatments-records-list-outer">
                                  {sectionItems.map((item) => {
                                    const priceLabel =
                                      discussedPlanPriceLabels.get(item.id) ??
                                      null;
                                    const planSecondary =
                                      getTreatmentPlanRowSecondaryLabel(item);
                                    return (
                                      <div
                                        key={item.id}
                                        className="discussed-treatments-record-row-outer discussed-treatments-record-row-heading-meta discussed-treatments-record-row-with-price"
                                      >
                                        <div className="discussed-treatments-record-row-main">
                                          <div className="discussed-treatments-record-treatment-heading-outer">
                                            {getTreatmentPlanRowPrimaryLabel(
                                              item,
                                            )}
                                          </div>
                                          {planSecondary ? (
                                            <div className="discussed-treatments-record-meta-line-outer">
                                              {planSecondary}
                                            </div>
                                          ) : null}
                                        </div>
                                        {priceLabel ? (
                                          <div
                                            className="discussed-treatments-record-price-outer"
                                            title="From practice price list / checkout"
                                          >
                                            {priceLabel}
                                          </div>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    ) : (
                      <span className="discussed-treatments-in-facial-summary">
                        None
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {treatmentPreviewUiEnabled &&
                (intakeWellnessInterests.length > 0 ||
                  wellnessPlanItems.length > 0) && (
                  <div className="detail-section detail-section-wellness-overview">
                    <div className="detail-section-title">Wellness</div>
                    <p className="skin-analysis-description">
                      Peptide and wellness goals and plan items — separate from
                      facial analysis and scanning.
                    </p>
                    {intakeWellnessInterests.length > 0 && (
                      <div className="detail-wellness-intake-interests">
                        <div className="detail-label">Goals from intake</div>
                        <div
                          className="detail-wellness-intake-chips"
                          role="list"
                        >
                          {intakeWellnessInterests.map((label, idx) => (
                            <span
                              key={`${label}-${idx}`}
                              className="detail-wellness-intake-chip"
                              role="listitem"
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {wellnessPlanItems.length > 0 && (
                      <div className="detail-wellness-plan-excerpt">
                        <div className="detail-label">On treatment plan</div>
                        <ul className="detail-wellness-plan-list">
                          {wellnessPlanItems.map((item) => (
                            <li key={item.id}>
                              <span className="detail-wellness-plan-treatment">
                                {getTreatmentPlanRowPrimaryLabel(item)}
                              </span>
                              {item.timeline?.trim() ? (
                                <span className="detail-wellness-plan-meta">
                                  {" "}
                                  · {item.timeline.trim()}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

              {/* Facial Analysis Section */}
              <div className="detail-section detail-section-facial-analysis">
                <div className="detail-section-header-flex">
                  <div className="detail-section-title detail-section-title-inline detail-section-title-facial">
                    <div className="facial-analysis-heading-row">
                      <span>Facial Analysis</span>
                      {(() => {
                        const raw = client.facialAnalysisStatus?.trim();
                        let statusForDisplay =
                          raw ||
                          (client.tableSource === "Web Popup Leads"
                            ? WEB_POPUP_LEAD_NO_ANALYSIS_STATUS
                            : "not-started");
                        if (!facialAnalysisFormHasData) {
                          const low = (raw ?? "").toLowerCase();
                          if (!low || low === "pending") {
                            statusForDisplay = "not-started";
                          }
                        }
                        return (
                          <span
                            className="status-badge detail-status-badge-dynamic"
                            style={{
                              background: getFacialStatusColorForDisplay(
                                statusForDisplay,
                                hasFacialInterestedTreatments(client),
                                provider?.code,
                              ),
                            }}
                          >
                            {formatFacialStatusForDisplay(
                              statusForDisplay,
                              hasFacialInterestedTreatments(client),
                              provider?.code,
                            )}
                          </span>
                        );
                      })()}
                    </div>
                    {client.tableSource === "Patients" &&
                      facialAnalysisFormHasData &&
                      client.createdAt && (
                        <span className="facial-analysis-date">
                          Analysis date: {formatDate(client.createdAt)}
                        </span>
                      )}
                  </div>
                  <div className="detail-actions-inline">
                    {facialAnalysisFormHasData && (
                      <>
                        {treatmentPreviewUiEnabled && (
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowAnalysisOverview(true);
                            }}
                          >
                            Overview
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowShareAnalysis(true);
                          }}
                        >
                          Share with Patient
                        </button>
                      </>
                    )}
                    {hasWebPopupForm && (
                      <div
                        className="scan-client-dropdown"
                        ref={scanDropdownRef}
                      >
                        <button
                          className="btn-secondary btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowScanDropdown(!showScanDropdown);
                          }}
                        >
                          Scan Patient
                        </button>
                        {showScanDropdown && (
                          <div className="scan-client-dropdown-menu">
                            <button
                              className="scan-client-option"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleScanInClinic();
                              }}
                            >
                              Scan In-Clinic
                            </button>
                            {!isUniqueAestheticsProvider(provider) && (
                              <button
                                className="scan-client-option"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowScanDropdown(false);
                                  setShowNewClientSMS(true);
                                }}
                              >
                                Scan At Home
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {facialAnalysisFormHasData ? (
                  <AnalysisResultsSection
                    client={client}
                    onViewExamples={(issue, region) =>
                      setIssuePhotosContext({ issue, region })
                    }
                    onTreatmentInterestClick={(interest) =>
                      setIssuePhotosContext({ interest })
                    }
                  />
                ) : (
                  <div className="detail-empty-state">
                    {hasWebPopupForm ? (
                      <>
                        <div className="detail-empty-state-text">
                          Request a facial analysis scan for this client.
                        </div>
                        <div className="detail-actions-container">
                          <button
                            className="btn-secondary btn-sm detail-action-button"
                            onClick={() => setShowTelehealthSMS(true)}
                            disabled={!client.phone}
                          >
                            Request Telehealth Scan
                          </button>
                          <button
                            className="btn-secondary btn-sm detail-action-button"
                            onClick={handleScanPatientNow}
                          >
                            Scan Patient Now
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="detail-empty-center">
                        This patient has not completed the Facial Analysis form.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!isUniqueAestheticsProvider(provider) && (
                <>
                  {/* Skin Quiz Section */}
                  <div className="detail-section detail-section-skin-analysis">
                    <div className="detail-section-header-flex skin-analysis-header">
                      <div className="detail-section-title detail-section-title-inline skin-analysis-heading-block">
                        <span>Skin Quiz</span>
                        {skincareQuiz?.completedAt && (
                          <span className="skin-analysis-result-badge detail-value-muted">
                            · {formatDate(skincareQuiz.completedAt)}
                          </span>
                        )}
                      </div>
                      <div className="skin-analysis-quiz-actions">
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => setShowSkinTypeQuiz(true)}
                        >
                          {skincareQuiz ? "View Results" : "Take now"}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => {
                            setSMSInitialMessage(getSkinQuizMessage(client));
                            setShowSendSMS(true);
                          }}
                          disabled={!client.phone && !client.email}
                          title={
                            client.phone
                              ? "Send quiz link via SMS"
                              : client.email
                                ? "Send quiz link via email"
                                : "Add phone or email to send to patient"
                          }
                        >
                          Send to Patient
                        </button>
                      </div>
                    </div>
                    <p className="skin-analysis-description">
                      {skincareQuiz
                        ? "Skin type and product recommendations from the completed quiz."
                        : "Complete the skin type quiz to get a personalized result and product recommendations for this client."}
                    </p>
                    {skincareQuiz && (
                      <div className="skin-analysis-details">
                        <div className="skin-analysis-summary">
                          {skincareQuiz.result &&
                          GEMSTONE_BY_SKIN_TYPE[skincareQuiz.result] ? (
                            <span className="skin-analysis-summary-gemstone">
                              {GEMSTONE_BY_SKIN_TYPE[skincareQuiz.result].name}{" "}
                              {GEMSTONE_BY_SKIN_TYPE[skincareQuiz.result].emoji}{" "}
                              {
                                GEMSTONE_BY_SKIN_TYPE[skincareQuiz.result]
                                  .tagline
                              }
                            </span>
                          ) : (
                            <span className="skin-analysis-summary-type">
                              {skincareQuiz.resultLabel ??
                                (skincareQuiz.result
                                  ? skincareQuiz.result
                                      .charAt(0)
                                      .toUpperCase() +
                                    skincareQuiz.result.slice(1)
                                  : "Completed")}
                            </span>
                          )}
                        </div>
                        {skincareQuiz.resultDescription && (
                          <p className="skin-analysis-result-description">
                            {skincareQuiz.resultDescription}
                          </p>
                        )}
                        {(() => {
                          const carouselItems = getSkincareCarouselItems();
                          const routineSections = buildQuizSkincareRoutineSections(
                            skincareQuiz.recommendedProductNames,
                            skincareQuiz.result,
                            (name) =>
                              carouselItems.find((p) => p.name === name),
                          );
                          if (routineSections.length === 0) return null;
                          return (
                            <div className="skin-analysis-routine-groups">
                              {routineSections.map((section) => (
                                <div
                                  key={section.id}
                                  className="skin-analysis-products skin-analysis-products--routine-group"
                                >
                                  <span className="skin-analysis-products-label">
                                    {section.title}
                                  </span>
                                  <div className="skin-analysis-product-chips">
                                    {section.items.map((product) => {
                                      const item = carouselItems.find(
                                        (p) => p.name === product.name,
                                      );
                                      const p: SkinQuizProduct = {
                                        name: product.name,
                                        imageUrl: item?.imageUrl,
                                        productUrl: item?.productUrl,
                                        recommendedFor: product.blurb,
                                        description: item?.description,
                                        price: item?.price,
                                        imageUrls: item?.imageUrls,
                                      };
                                      return (
                                        <button
                                          key={`${section.id}-${product.name}`}
                                          type="button"
                                          className="skin-analysis-product-chip"
                                          onClick={() =>
                                            setSelectedSkinProduct(p)
                                          }
                                        >
                                          {p.imageUrl ? (
                                            <img
                                              src={p.imageUrl}
                                              alt=""
                                              className="skin-analysis-product-chip-thumb"
                                            />
                                          ) : (
                                            <span className="skin-analysis-product-chip-placeholder">
                                              ◆
                                            </span>
                                          )}
                                          <span className="skin-analysis-product-chip-name">
                                            {product.displayName}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                        {skincareQuiz.answers &&
                          Object.keys(skincareQuiz.answers).length > 0 &&
                          (() => {
                            const scores = computeQuizScores(
                              skincareQuiz!.answers,
                            );
                            const profile = computeQuizProfile(
                              skincareQuiz!.answers,
                            );
                            const maxScore = Math.max(
                              ...Object.values(scores),
                              1,
                            );
                            return (
                              <div className="skin-analysis-score-bars">
                                <span className="skin-analysis-score-bars-title">
                                  Score breakdown
                                </span>
                                {SKIN_TYPE_SCORE_ORDER.map((sectionId) => {
                                  const value = scores[sectionId] ?? 0;
                                  const pct =
                                    maxScore > 0 ? (value / maxScore) * 100 : 0;
                                  const letter =
                                    profile.sectionLetters?.[sectionId];
                                  const label = letter
                                    ? `${SKIN_TYPE_DISPLAY_LABELS[sectionId]} (${letter})`
                                    : SKIN_TYPE_DISPLAY_LABELS[sectionId];
                                  return (
                                    <div
                                      key={sectionId}
                                      className="skin-analysis-score-row"
                                    >
                                      <span className="skin-analysis-score-label">
                                        {label}
                                      </span>
                                      <div className="skin-analysis-score-bar-wrap">
                                        <div
                                          className="skin-analysis-score-bar"
                                          style={{ width: `${pct}%` }}
                                        />
                                      </div>
                                      <span className="skin-analysis-score-value">
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
                  </div>
                </>
              )}

              {/* Wellness Quiz Section (hidden when WELLNESS_QUIZ_ENABLED is false) */}
              {WELLNESS_QUIZ_ENABLED && (
                <div className="detail-section detail-section-wellness-quiz">
                  <div className="detail-section-header-flex">
                    <div className="detail-section-title detail-section-title-inline">
                      <span>Wellness Quiz</span>
                      {client.wellnessQuiz && (
                        <span className="detail-value-muted">
                          {" "}
                          · {
                            client.wellnessQuiz.suggestedTreatmentIds.length
                          }{" "}
                          suggestion
                          {client.wellnessQuiz.suggestedTreatmentIds.length !==
                          1
                            ? "s"
                            : ""}
                          {client.wellnessQuiz.completedAt &&
                            ` · ${formatDate(client.wellnessQuiz.completedAt)}`}
                        </span>
                      )}
                    </div>
                    <div className="detail-section-header-actions">
                      {client.wellnessQuiz &&
                        getSuggestedWellnessTreatments(client.wellnessQuiz)
                          .length > 0 && (
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSMSInitialMessage(
                                getWellnessQuizResultsSMSMessage(
                                  client.wellnessQuiz!,
                                ),
                              );
                              setShowSendSMS(true);
                            }}
                          >
                            Send results via SMS
                          </button>
                        )}
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowWellnessQuiz(true);
                        }}
                      >
                        {client.wellnessQuiz ? "View Results" : "Take now"}
                      </button>
                    </div>
                  </div>
                  <p className="skin-analysis-description">
                    {client.wellnessQuiz
                      ? "Peptide and wellness treatment suggestions based on the completed quiz."
                      : "Complete the wellness quiz to get personalized peptide/treatment suggestions from our offerings."}
                  </p>
                  {client.wellnessQuiz &&
                    getSuggestedWellnessTreatments(client.wellnessQuiz).length >
                      0 && (
                      <WellnessQuizResultsCards
                        suggestedTreatments={getSuggestedWellnessTreatments(
                          client.wellnessQuiz,
                        )}
                        answers={client.wellnessQuiz.answers}
                        onAddToPlan={async (prefill) => {
                          const newItem: DiscussedItem = {
                            id: generateId(),
                            addedAt: new Date().toISOString(),
                            interest: prefill.interest?.trim() || undefined,
                            findings: prefill.findings?.length
                              ? prefill.findings
                              : undefined,
                            treatment: prefill.treatment?.trim() || "",
                            product:
                              prefill.treatmentProduct?.trim() || undefined,
                            region: prefill.region?.trim() || undefined,
                            timeline: (prefill.timeline?.trim() ||
                              "Wishlist") as string,
                            quantity: prefill.quantity?.trim() || undefined,
                            notes: prefill.notes?.trim() || undefined,
                          };
                          const nextItems = [
                            ...(client.discussedItems || []),
                            newItem,
                          ];
                          try {
                            await persistClientDiscussedItems(
                              client,
                              nextItems,
                            );
                            showToast("Added to treatment plan");
                            onUpdate();
                          } catch (e) {
                            showError(
                              e instanceof Error
                                ? e.message
                                : "Failed to add to plan",
                            );
                            throw e;
                          }
                        }}
                      />
                    )}
                </div>
              )}

              {/* Appointment Info */}
              {client.appointmentDate && (
                <div className="detail-section detail-section-contact-history">
                  <div className="detail-section-title">Appointment</div>
                  <div className="detail-value">
                    {formatDate(client.appointmentDate)}
                  </div>
                </div>
              )}

              {/* Conversion Details */}
              {client.status === "converted" &&
                (client.treatmentReceived || client.revenue) && (
                  <div className="detail-section detail-section-contact-history">
                    <div className="detail-section-title">
                      Conversion Details
                    </div>
                    <div className="detail-grid">
                      {client.treatmentReceived && (
                        <div className="detail-item">
                          <label>Treatment</label>
                          <div className="detail-value">
                            {client.treatmentReceived}
                          </div>
                        </div>
                      )}
                      {client.revenue && (
                        <div className="detail-item">
                          <label>Revenue</label>
                          <div className="detail-value detail-revenue-value">
                            ${client.revenue.toLocaleString()}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              {/* Contact History */}
              <ContactHistorySection client={client} onUpdate={onUpdate} />

              {/* Archive Section */}
              <div className="detail-section detail-section-archive">
                <div className="detail-archive-header">
                  <div>
                    <div className="detail-label detail-archive-label-large">
                      Archive Client
                    </div>
                    <div className="detail-archive-description">
                      Archive this client to remove it from active lists
                    </div>
                  </div>
                  <button
                    className={
                      client.archived
                        ? "btn-primary btn-sm archive-button"
                        : "btn-secondary btn-sm archive-button"
                    }
                    onClick={handleArchive}
                  >
                    {client.archived ? "Unarchive" : "Archive"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="modal-footer">
          <div className="modal-actions-left">
            <div className="modal-contact-group">
              <span className="modal-contact-heading">Contact</span>
              <div className="modal-contact-buttons">
                <button
                  className="btn-secondary"
                  onClick={handleCall}
                  disabled={!client.phone}
                >
                  Call
                </button>
                <button
                  className="btn-secondary"
                  onClick={handleEmail}
                  disabled={!client.email}
                >
                  Email
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => setShowSmsPopup(true)}
                  disabled={!client.phone}
                >
                  Messages
                </button>
              </div>
            </div>
          </div>
          <div className="modal-actions-right">
            <button className="btn-primary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>

      {showTelehealthSMS && (
        <TelehealthSMSModal
          client={client}
          onClose={() => setShowTelehealthSMS(false)}
          onSuccess={() => {
            setShowTelehealthSMS(false);
            onUpdate();
          }}
        />
      )}
      {showShareAnalysis && client && (
        <ShareAnalysisModal
          client={client}
          onClose={() => setShowShareAnalysis(false)}
          onSuccess={() => {
            setShowShareAnalysis(false);
            onUpdate();
          }}
        />
      )}
      {showAnalysisOverview && client && treatmentPreviewUiEnabled && (
        <AnalysisOverviewModal
          client={client}
          onClose={() => {
            setShowAnalysisOverview(false);
            setReturnToOverviewView(null);
          }}
          initialDetailView={returnToOverviewView ?? undefined}
          onAddToPlanDirect={appendDiscussedItemFromPrefill}
        />
      )}
      {showShareTreatmentPlan && client && (
        <ShareTreatmentPlanModal
          client={client}
          onClose={() => setShowShareTreatmentPlan(false)}
          onSuccess={() => {
            setShowShareTreatmentPlan(false);
            onUpdate();
          }}
        />
      )}
      {showShareTreatmentPlanLink && client && (
        <ShareTreatmentPlanLinkModal
          client={client}
          discussedItems={client.discussedItems ?? []}
          onClose={() => setShowShareTreatmentPlanLink(false)}
          onSuccess={() => {
            setShowShareTreatmentPlanLink(false);
            onUpdate();
          }}
        />
      )}
      {showPhotoViewer && client && (
        <PhotoViewerModal
          client={client}
          initialPhotoType={photoViewerType}
          onClose={() => setShowPhotoViewer(false)}
          onPhotoUpdated={onUpdate}
        />
      )}
      {showNewClientSMS && (
        <NewClientSMSModal
          onClose={() => setShowNewClientSMS(false)}
          onSuccess={() => {
            setShowNewClientSMS(false);
            onUpdate();
          }}
        />
      )}
      {showSmsPopup && client && (
        <ClientSmsPopupModal
          client={client}
          onClose={() => setShowSmsPopup(false)}
          onSuccess={onUpdate}
        />
      )}
      {showSendSMS && client && (
        <SendSMSModal
          client={client}
          onClose={() => {
            setShowSendSMS(false);
            setSMSInitialMessage(null);
          }}
          onSuccess={() => {
            setShowSendSMS(false);
            setSMSInitialMessage(null);
            onUpdate();
          }}
          initialMessage={smsInitialMessage ?? undefined}
        />
      )}
      {showSkinTypeQuiz && client && (
        <SkinTypeQuizModal
          client={client}
          onClose={() => setShowSkinTypeQuiz(false)}
          onSuccess={onUpdate}
          savedQuiz={skincareQuiz ?? undefined}
          onAddToPlan={async (prefill) => {
            const newItem: DiscussedItem = {
              id: generateId(),
              addedAt: new Date().toISOString(),
              interest: prefill.interest?.trim() || undefined,
              findings: prefill.findings?.length ? prefill.findings : undefined,
              treatment: prefill.treatment?.trim() || "",
              product: prefill.treatmentProduct?.trim() || undefined,
              region: prefill.region?.trim() || undefined,
              timeline: (prefill.timeline?.trim() || "Wishlist") as string,
              quantity: prefill.quantity?.trim() || undefined,
              notes: prefill.notes?.trim() || undefined,
            };
            const nextItems = [...(client.discussedItems || []), newItem];
            await persistClientDiscussedItems(client, nextItems);
            showToast("Added to treatment plan");
            onUpdate();
          }}
        />
      )}
      {selectedSkinProduct && client && (
        <SkinQuizProductModal
          product={selectedSkinProduct}
          onClose={() => setSelectedSkinProduct(null)}
          onAddToPlan={async (prefill) => {
            const newItem: DiscussedItem = {
              id: generateId(),
              addedAt: new Date().toISOString(),
              interest: prefill.interest?.trim() || undefined,
              findings: prefill.findings?.length ? prefill.findings : undefined,
              treatment: prefill.treatment?.trim() || "",
              product: prefill.treatmentProduct?.trim() || undefined,
              region: prefill.region?.trim() || undefined,
              timeline: (prefill.timeline?.trim() || "Wishlist") as string,
              quantity: prefill.quantity?.trim() || undefined,
              notes: prefill.notes?.trim() || undefined,
            };
            const nextItems = [...(client.discussedItems || []), newItem];
            await persistClientDiscussedItems(client, nextItems);
            showToast("Added to treatment plan");
            setSelectedSkinProduct(null);
            onUpdate();
          }}
        />
      )}
      {WELLNESS_QUIZ_ENABLED && showWellnessQuiz && client && (
        <WellnessQuizModal
          client={client}
          onClose={() => setShowWellnessQuiz(false)}
          onSuccess={() => {
            setShowWellnessQuiz(false);
            onUpdate();
          }}
          savedQuiz={client.wellnessQuiz ?? undefined}
          onAddToPlan={async (prefill) => {
            const newItem: DiscussedItem = {
              id: generateId(),
              addedAt: new Date().toISOString(),
              interest: prefill.interest?.trim() || undefined,
              findings: prefill.findings?.length ? prefill.findings : undefined,
              treatment: prefill.treatment?.trim() || "",
              product: prefill.treatmentProduct?.trim() || undefined,
              region: prefill.region?.trim() || undefined,
              timeline: (prefill.timeline?.trim() || "Wishlist") as string,
              quantity: prefill.quantity?.trim() || undefined,
              notes: prefill.notes?.trim() || undefined,
            };
            const nextItems = [...(client.discussedItems || []), newItem];
            try {
              await persistClientDiscussedItems(client, nextItems);
              showToast("Added to treatment plan");
              onUpdate();
            } catch (e) {
              showError(
                e instanceof Error ? e.message : "Failed to add to plan",
              );
              throw e;
            }
          }}
        />
      )}
      {showCheckoutModal && client && (
        <TreatmentPlanCheckoutModal
          clientName={client.name ?? ""}
          client={client}
          items={client.discussedItems ?? []}
          onClose={() => setShowCheckoutModal(false)}
          onRemoveItem={async (_item, index) => {
            const nextItems = (client.discussedItems ?? []).filter(
              (_, i) => i !== index,
            );
            try {
              await persistClientDiscussedItems(client, nextItems);
              showToast("Removed from plan");
              onUpdate();
            } catch (e) {
              showError(
                e instanceof Error ? e.message : "Failed to remove from plan",
              );
            }
          }}
          onUpdateItem={async (index, patch) => {
            const current = client.discussedItems ?? [];
            const nextItems = current.map((it, i) =>
              i === index ? { ...it, ...patch } : it,
            );
            try {
              await persistClientDiscussedItems(client, nextItems);
              showToast("Plan updated");
              onUpdate();
            } catch (e) {
              showError(
                e instanceof Error ? e.message : "Failed to update plan",
              );
            }
          }}
          providerCode={provider?.code}
        />
      )}
      {showDiscussedTreatments && client && (
        <DiscussedTreatmentsModal
          client={client}
          onClose={() => {
            setShowDiscussedTreatments(false);
            setInitialAddFormPrefill(null);
            setInitialEditingItem(null);
            onUpdate();
            if (returnToOverviewView !== null && treatmentPreviewUiEnabled) {
              setShowAnalysisOverview(true);
            }
          }}
          onUpdate={onUpdate}
          initialAddFormPrefill={initialAddFormPrefill}
          onClearInitialPrefill={() => setInitialAddFormPrefill(null)}
          initialEditingItem={initialEditingItem}
        />
      )}
      {issuePhotosContext && client && (
        <TreatmentPhotosModal
          client={client}
          issue={issuePhotosContext.issue}
          region={issuePhotosContext.region}
          interest={issuePhotosContext.interest}
          onClose={() => setIssuePhotosContext(null)}
          onUpdate={onUpdate}
          onAddToPlanDirect={async (prefill, options) => {
            await appendDiscussedItemFromPrefill(prefill, options);
            setIssuePhotosContext(null);
          }}
          planItems={client.discussedItems ?? []}
        />
      )}
    </div>
  );
}
