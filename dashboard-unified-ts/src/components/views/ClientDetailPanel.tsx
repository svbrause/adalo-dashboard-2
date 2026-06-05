// Client Detail Panel Component - Side panel version (non-modal)

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Client, ClientPhotoSlot, DiscussedItem } from "../../types";
import {
  formatDate,
  formatDateTime,
  formatDateOfBirth,
  formatRelativeDate,
} from "../../utils/dateFormatting";
import { showOnlineTreatmentFinderSection } from "../../utils/leadSource";
import {
  updateLeadRecord,
  prefetchSmsForPhone,
  fetchRecordQuizFields,
} from "../../services/api";
import {
  archiveClient,
  markOfferRedeemed,
  updateClientStatus,
} from "../../services/contactHistory";
import { showToast, showError } from "../../utils/toast";
import ContactHistorySection from "../modals/ContactHistorySection";
import ClientContactMenu from "./ClientContactMenu";
import ClientSmsPopupModal from "../modals/ClientSmsPopupModal";
import AnalysisResultsSection from "../modals/AnalysisResultsSection";
import TelehealthSMSModal from "../modals/TelehealthSMSModal";
import ShareAnalysisModal from "../modals/ShareAnalysisModal";
import ShareTreatmentPlanModal from "../modals/ShareTreatmentPlanModal";
import ShareTreatmentPlanLinkModal from "../modals/ShareTreatmentPlanLinkModal";
import PhotoViewerModal from "../modals/PhotoViewerModal";
import SendSMSModal from "../modals/SendSMSModal";
import {
  FacialAnalysisStatusPill,
  PlanStatusPill,
  QuizStatusPill,
} from "../common/DetailSectionStatusPill";
import DiscussedTreatmentsModal from "../modals/DiscussedTreatmentsModal";
import TreatmentPlanCheckoutModal, {
  prefetchCheckoutImages,
} from "../modals/TreatmentPlanCheckoutModal";
import {
  getDiscussedPlanItemPriceLabels,
  getDiscussedItemQuoteOrderRankById,
  getDiscussedPlanCheckoutSubtotals,
} from "../modals/DiscussedTreatmentsModal/TreatmentPlanCheckout";
import { formatPrice, getEffectivePriceList } from "../../data/treatmentPricing2025";
import { planPricingFixActionLabel } from "../../utils/planPricingWarnings";
import TreatmentPhotosModal from "../modals/TreatmentPhotosModal";
import AnalysisOverviewModal, {
  type DetailView,
} from "../modals/AnalysisOverviewModal";
import type {
  TreatmentPlanAddDirectOptions,
  TreatmentPlanPrefill,
} from "../modals/DiscussedTreatmentsModal/TreatmentPhotos";
import { buildDiscussedItemFromTreatmentPlanPrefill } from "../modals/DiscussedTreatmentsModal/TreatmentPhotos";
import TreatmentRecommenderByTreatment from "../treatmentRecommender/TreatmentRecommenderByTreatment";
import TreatmentRecommenderBySuggestion from "../treatmentRecommender/TreatmentRecommenderBySuggestion";
import SkinTypeQuizModal from "../modals/SkinTypeQuizModal";
import SkinQuizProductModal, {
  type SkinQuizProduct,
} from "../modals/SkinQuizProductModal";
import WellnessQuizModal from "../modals/WellnessQuizModal";
import WellnessQuizResultsCards from "../wellnessQuiz/WellnessQuizResultsCards";
import {
  getSuggestedWellnessTreatments,
  getWellnessQuizDisplayCategoryScores,
  getWellnessQuizResultsSMSMessage,
  isWellnessQuizShownForDashboardProvider,
} from "../../data/wellnessQuiz";
import { isWellnestWellnessProviderCode } from "../../data/wellnestOfferings";
import {
  buildQuizSkincareRoutineSections,
  computeQuizScores,
  SKIN_TYPE_DISPLAY_LABELS,
  SKIN_TYPE_SCORE_ORDER,
  GEMSTONE_BY_SKIN_TYPE,
} from "../../data/skinTypeQuiz";
import {
  generateId,
  getTreatmentsForInterest,
  getDiscussedItemCheckedOffLabel,
  getTreatmentPlanRowPrimaryLabel,
  getTreatmentPlanRowSecondaryLabel,
  mergeDiscussedItemPatch,
  getQuantityContext,
  timelineOptionDisplayLabel,
} from "../modals/DiscussedTreatmentsModal/utils";
import {
  SKINCARE_SECTION_LABEL,
  FINDING_TO_GOAL_REGION_TREATMENTS,
  getTreatmentOptionsForProvider,
  getSkincareCarouselItems,
  getTreatmentProductOptionsForProvider,
  toProviderTreatmentContext,
  TIMELINE_OPTIONS,
  REGION_OPTIONS,
  REGION_OPTIONS_MICRONEEDLING,
  ENERGY_TREATMENT_WHERE_OPTIONS,
  CHEMICAL_PEEL_AREA_OPTIONS,
  CHECKOUT_REGION_OPTIONS_BROAD,
} from "../modals/DiscussedTreatmentsModal/constants";
import {
  clientDetailTreatmentPreviewSectionsInOrder,
  getDiscussedTreatmentsForClientDetailSection,
  planTimingLabelForDiscussedItem,
} from "../../utils/shareTreatmentPlanUi";
import { planItemsLastUpdatedShortLabel } from "../../utils/planScheduledDate";
import { persistClientDiscussedItems } from "../../utils/wellnestDemoPlanPersistence";
import { getSkinQuizMessage } from "../../utils/skinQuizLink";
import { getWellnessQuizMessage } from "../../utils/wellnessQuizLink";
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
import { isJudgeMdProviderCode } from "../../data/judgeMdPricing2026";
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
  fetchClientFrontPhoto,
  clientNeedsFreshFrontPhotoUrl,
  getClientFrontPhotoDisplayUrl,
  markPhotoDisplayUrlFailed,
  preloadClientFrontPhotoImage,
  resolveClientFrontPhotoDisplayUrl,
} from "../../utils/photoLoading";
import { formatZipCodeInput } from "../../utils/validation";
import { useDashboard } from "../../context/DashboardContext";
import { useVisitModePlanSync } from "../../hooks/useVisitModePlanSync";
import { useAddClientAcquisitionFunnelScan } from "../../hooks/useAddClientAcquisitionFunnelScan";
import { createPortal } from "react-dom";
import FaceMirrorPanel from "./FaceMirrorPanel";
import PatientMediaLibraryPanel from "./PatientMediaLibraryPanel";
import type { SavedPatientAnnotation } from "../../utils/patientAnnotationsStorage";
import { clientHas3DModel, getClientGlbUrl, setGeneratedClientGlbUrl } from "../../utils/client3dConfig";
import {
  fetchPatientAuraManifestFromConfiguredBucket,
  fetchPatientAuraManifestFromGcs,
  fetchPatientAuraManifestFromGcsPrefix,
  fetchPatientAuraManifestFromUrl,
  getPatientAuraManifest,
  setPatientAuraManifest,
  type PatientAuraAssetManifest,
} from "../../utils/patientAuraAssets";
import { clientUsesAuraInterface } from "../../utils/auraScanConfig";
import { isTanyaTanDemoClient } from "../../utils/tanyaTanSystemMedia";
import type { ClientDetailSection } from "../../utils/dashboardRoutes";
import { useClientDetailDeepLink } from "../../hooks/useClientDetailDeepLink";
import { loadClientGalleryPhotoSlots } from "../../utils/clientGalleryPhotos";
import { ponceLogoSrc } from "../../utils/ponceBrand";
import {
  getDetectedIssuesFromClient,
  getDetectedIssueDisplayStrings,
  getEffectiveSeverityIssues,
  inferSeverityBadness01,
} from "../../utils/analysisOverviewClient";
import { CATEGORIES, normalizeIssue } from "../../config/analysisOverviewConfig";
import {
  detectedIssuesForSubScore,
  type AuraOverviewCategoryKey,
} from "../../utils/auraAnalysisBridge";
import { SUGGESTION_TO_ISSUES } from "../modals/DiscussedTreatmentsModal/suggestionsMapping";
import "./ClientDetailPanel.css";

type ExpandedQuickAddDraft = {
  key: string;
  timeline: string;
  quantity: string;
  product: string;
  region: string;
  notes: string;
};

interface ClientDetailPanelProps {
  client: Client | null;
  onClose: () => void;
  onUpdate: () => void;
  /** From `/client-details/:id?section=…` */
  initialSection?: ClientDetailSection;
}

export default function ClientDetailPanel({
  client,
  onClose,
  onUpdate,
  initialSection,
}: ClientDetailPanelProps) {
  const { provider, darkMode } = useDashboard();
  const effectivePriceList = useMemo(
    () =>
      getEffectivePriceList(
        provider?.["Treatment Pricing"] as string | undefined,
        provider?.code,
      ),
    [provider],
  );
  const treatmentPreviewUiEnabled =
    providerShowsTheTreatmentPreviewUi(provider);
  const wellnestReplacesSkinQuizWithWellness =
    isWellnestWellnessProviderCode(provider?.code);
  const wellnessSectionHeading = wellnestReplacesSkinQuizWithWellness
    ? "Wellness quiz"
    : "Wellness";
  const showWellnessQuizSection =
    isWellnessQuizShownForDashboardProvider(provider?.code);

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

  const hasWellnessOverview =
    treatmentPreviewUiEnabled &&
    (intakeWellnessInterests.length > 0 || wellnessPlanItems.length > 0);
  const showMergedWellnessSection =
    hasWellnessOverview || showWellnessQuizSection;

  const discussedPlanPriceLabels = useMemo(
    () =>
      getDiscussedPlanItemPriceLabels(
        client?.discussedItems ?? [],
        effectivePriceList,
      ),
    [client?.discussedItems, effectivePriceList],
  );

  const planQuoteOrderRank = useMemo(
    () =>
      getDiscussedItemQuoteOrderRankById(
        client?.discussedItems ?? [],
        effectivePriceList,
      ),
    [client?.discussedItems, effectivePriceList],
  );

  const planCheckoutSubtotals = useMemo(
    () =>
      getDiscussedPlanCheckoutSubtotals(
        client?.discussedItems ?? [],
        effectivePriceList,
      ),
    [client?.discussedItems, effectivePriceList],
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
  const [showSendSMS, setShowSendSMS] = useState(false);
  const [showSmsPopup, setShowSmsPopup] = useState(false);
  const [smsInitialMessage, setSMSInitialMessage] = useState<string | null>(
    null,
  );
  const [showSkinTypeQuiz, setShowSkinTypeQuiz] = useState(false);
  const [showWellnessQuiz, setShowWellnessQuiz] = useState(false);
  const [selectedSkinProduct, setSelectedSkinProduct] =
    useState<SkinQuizProduct | null>(null);
  const [showDiscussedTreatments, setShowDiscussedTreatments] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [enrichedSkincareQuiz, setEnrichedSkincareQuiz] =
    useState<Client["skincareQuiz"]>(undefined);
  const [contactSectionCollapsed, setContactSectionCollapsed] = useState(true);
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
  const [expandedRecommenderCollapsed, setExpandedRecommenderCollapsed] =
    useState(true);
  const [auraActiveCategoryForPlan, setAuraActiveCategoryForPlan] =
    useState<AuraOverviewCategoryKey>("skinHealth");
  const [focusedIssueForRecommender, setFocusedIssueForRecommender] = useState<
    string | null
  >(null);
  const [expandedQuickAddDraft, setExpandedQuickAddDraft] =
    useState<ExpandedQuickAddDraft | null>(null);
  /** Region filter chips from the active plan builder — passed into post-visit blueprint for AI mirror. */
  const [recommenderFocusRegions, setRecommenderFocusRegions] = useState<
    string[]
  >([]);
  /** “Fix in plan” from share link modal opens the plan builder on this line once. */
  const [shareLinkPendingPlanEditId, setShareLinkPendingPlanEditId] = useState<
    string | null
  >(null);
  /** “Learn more” from embedded recommender scrolls to this treatment once. */
  const [pendingFocusTreatmentName, setPendingFocusTreatmentName] = useState<
    string | null
  >(null);
  /** Multi-angle URLs for the split-panel face mirror (Airtable or demo {@link Client.galleryPhotoSlots}). */
  const [faceMirrorPhotoSlots, setFaceMirrorPhotoSlots] = useState<
    ClientPhotoSlot[]
  >([]);
  const [patientFilesRefreshKey, setPatientFilesRefreshKey] = useState(0);
  const [clientAuraManifest, setClientAuraManifest] =
    useState<PatientAuraAssetManifest | null>(() =>
      getPatientAuraManifest(client?.name),
    );
  const { optimisticTimelines, handleVisitModeToggleItem } =
    useVisitModePlanSync({ client, onUpdate });
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!client?.id) return undefined;
    const onAnnotationsChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ clientId?: string }>).detail;
      if (detail?.clientId && detail.clientId !== client.id) return;
      setPatientFilesRefreshKey((k) => k + 1);
    };
    window.addEventListener("patient-annotations-changed", onAnnotationsChanged);
    return () =>
      window.removeEventListener("patient-annotations-changed", onAnnotationsChanged);
  }, [client?.id]);

  useClientDetailDeepLink(client?.id, initialSection, {
    openAnalysis: () => setShowAnalysisOverview(true),
    openRecommender: () => setRecommenderMode("by-treatment"),
    openQuiz: () => setShowSkinTypeQuiz(true),
    openBlueprint: () => setShowShareTreatmentPlanLink(true),
    focusMirror: () => setRecommenderMode(null),
  });

  useEffect(() => {
    // Load photo slots for 3D-model clients AND for any client with a front photo,
    // so FaceMirrorPanel can show the annotated photo + "Generate 3D Scan" button.
    const hasFrontPhoto = Boolean(
      frontPhotoUrl || getClientFrontPhotoDisplayUrl(client?.frontPhoto),
    );
    if (
      !client ||
      recommenderMode ||
      (isTanyaTanDemoClient(client) && client.galleryPhotoSlots?.length) ||
      (!clientHas3DModel(client.name) &&
        !client.turntableVideoUrl &&
        !hasFrontPhoto)
    ) {
      setFaceMirrorPhotoSlots([]);
      return;
    }
    let cancelled = false;
    loadClientGalleryPhotoSlots(client).then((slots) => {
      if (!cancelled) setFaceMirrorPhotoSlots(slots);
    });
    return () => {
      cancelled = true;
    };
  }, [
    client,
    client?.id,
    client?.galleryPhotoSlots,
    recommenderMode,
    frontPhotoUrl,
  ]);

  const openPatientPhotosFromFaceMirror = useCallback((initialTab: "front" | "side") => {
    setPhotoViewerType(initialTab);
    setShowPhotoViewer(true);
  }, []);

  const handleConsumedShareLinkPlanEdit = useCallback(() => {
    setShareLinkPendingPlanEditId(null);
  }, []);

  const handleConsumedPendingFocusTreatment = useCallback(() => {
    setPendingFocusTreatmentName(null);
  }, []);

  const handleShareLinkNavigateToPlanItem = useCallback(
    (discussedItemId: string) => {
      setShowShareTreatmentPlanLink(false);
      setShareLinkPendingPlanEditId(discussedItemId);
      setRecommenderMode("by-treatment");
    },
    [],
  );

  const handleShareLinkUpdateDiscussedItem = useCallback(
    async (itemId: string, patch: Partial<DiscussedItem>) => {
      if (!client) return;
      const cur = client.discussedItems ?? [];
      const next = cur.map((it) =>
        it.id === itemId ? mergeDiscussedItemPatch(it, patch) : it,
      );
      try {
        await persistClientDiscussedItems(client, next);
        showToast(
          patch.timeline === "Wishlist"
            ? "Moved to wishlist"
            : "Moved to active plan",
        );
        onUpdate();
      } catch (e: unknown) {
        showError(e instanceof Error ? e.message : "Failed to update plan");
      }
    },
    [client, onUpdate],
  );

  /** Jump from client detail plan list into plan builder with this line open for editing. */
  const openPlanBuilderForDiscussedItem = useCallback(
    (discussedItemId: string) => {
      setShareLinkPendingPlanEditId(discussedItemId);
      setRecommenderMode("by-treatment");
    },
    [],
  );

  useEffect(() => {
    if (client) {
      setEditedClient({
        ...client,
        phone: client.phone ? formatPhoneDisplay(client.phone) : "",
      });
      setStatus(client.status);

      // Use attachment from list fetch when available (no extra Airtable round-trip).
      const resolved = resolveClientFrontPhotoDisplayUrl(client);
      if (resolved) {
        preloadClientFrontPhotoImage(resolved, "high");
        client.frontPhotoLoaded = true;
        setFrontPhotoUrl(resolved);
        setPhotoLoading(false);
      } else if (clientNeedsFreshFrontPhotoUrl(client)) {
        setFrontPhotoUrl(null);
        setPhotoLoading(true);
        fetchClientFrontPhoto(client.id)
          .then((photo) => {
            const url = getClientFrontPhotoDisplayUrl(photo, {
              allowExpiringAirtableCdn: true,
            });
            if (url) {
              client.frontPhoto = (photo ?? url) as Client["frontPhoto"];
              client.frontPhotoLoaded = true;
              setFrontPhotoUrl(url);
            }
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

  useEffect(() => {
    setRecommenderFocusRegions([]);
  }, [client?.id]);

  const handleRecommenderRegionsChange = useCallback(
    (regions: readonly string[]) => {
      setRecommenderFocusRegions([...regions]);
    },
    [],
  );

  // Prefetch SMS for this client in the background so the Text popup opens with cached messages
  useEffect(() => {
    if (client?.phone) prefetchSmsForPhone(client.phone);
  }, [client?.phone]);

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

  // Handle Escape key to close panel
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Only close if no modals are open
        if (
          !showTelehealthSMS &&
          !showShareAnalysis &&
          !showAnalysisOverview &&
          !showPhotoViewer &&
          !showSendSMS &&
          !showDiscussedTreatments &&
          !issuePhotosContext
        ) {
          onClose();
        }
      }
    };

    if (client) {
      window.addEventListener("keydown", handleEscape);
    }

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [
    client,
    onClose,
    showTelehealthSMS,
    showShareAnalysis,
    showAnalysisOverview,
    showPhotoViewer,
    showSendSMS,
    showDiscussedTreatments,
    issuePhotosContext,
  ]);

  const planItemsAppendRef = useRef<DiscussedItem[]>([]);
  planItemsAppendRef.current = client?.discussedItems ?? [];

  const appendDiscussedItemFromPrefill = useCallback(
    async (
      prefill: TreatmentPlanPrefill,
      options?: TreatmentPlanAddDirectOptions,
    ): Promise<DiscussedItem | void> => {
      if (!client) return;
      const newItem = buildDiscussedItemFromTreatmentPlanPrefill(prefill);
      const nextItems = [...planItemsAppendRef.current, newItem];
      planItemsAppendRef.current = nextItems;
      try {
        await persistClientDiscussedItems(client, nextItems);
        if (!options?.skipToast) showToast("Added to treatment plan");
        onUpdate();
        return newItem;
      } catch (e) {
        showError(e instanceof Error ? e.message : "Failed to add to plan");
        throw e;
      }
    },
    [client, onUpdate],
  );

  /** One persist for multiple rows — avoids losing items when `client` has not refetched between sequential adds. */
  const appendDiscussedItemsFromPrefills = useCallback(
    async (
      prefills: TreatmentPlanPrefill[],
      options?: TreatmentPlanAddDirectOptions,
    ): Promise<DiscussedItem[] | void> => {
      if (!client || prefills.length === 0) return;
      const newItems = prefills.map((p) =>
        buildDiscussedItemFromTreatmentPlanPrefill(p),
      );
      const base = client.discussedItems ?? [];
      const nextItems = [...base, ...newItems];
      planItemsAppendRef.current = nextItems;
      try {
        await persistClientDiscussedItems(client, nextItems);
        if (!options?.skipToast) {
          showToast(
            `${newItems.length} item${newItems.length === 1 ? "" : "s"} added to treatment plan`,
          );
        }
        onUpdate();
        return newItems;
      } catch (e) {
        showError(e instanceof Error ? e.message : "Failed to add to plan");
        throw e;
      }
    },
    [client, onUpdate],
  );

  if (!client) return null;

  const skincareQuiz = client.skincareQuiz ?? enrichedSkincareQuiz;

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
    handleScanPatientNow();
    showToast(`Opening scan form for ${client.name}`);
  };

  // Check if forms have data
  const hasWebPopupForm = client.tableSource === "Web Popup Leads";
  const hasFacialAnalysisForm = client.tableSource === "Patients";

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

  const treatmentPlanSubheading = useMemo(() => {
    const planLast = planItemsLastUpdatedShortLabel(client.discussedItems);
    if (planLast && (client.discussedItems?.length ?? 0) > 0) {
      return `Last updated ${planLast}`;
    }
    return "";
  }, [client.discussedItems]);

  useAddClientAcquisitionFunnelScan(client, Boolean(facialAnalysisFormHasData));

  useEffect(() => {
    if (!client) {
      setClientAuraManifest(null);
      return;
    }
    setClientAuraManifest(getPatientAuraManifest(client.name));
    let cancelled = false;
    void (async () => {
      let manifest: PatientAuraAssetManifest | null = null;
      manifest = await fetchPatientAuraManifestFromUrl(
        client.name,
        client.auraManifestUrl,
      );
      if (!manifest) {
        manifest = await fetchPatientAuraManifestFromGcsPrefix(
          client.name,
          client.auraGcsPrefix,
        );
      }
      if (
        !manifest &&
        client.turntableVideoUrl?.startsWith("https://storage.googleapis.com")
      ) {
        manifest = await fetchPatientAuraManifestFromGcs(
          client.name,
          client.turntableVideoUrl,
        );
      }
      if (!manifest) {
        manifest = await fetchPatientAuraManifestFromConfiguredBucket(
          client.name,
        );
      }
      if (!cancelled && manifest) setClientAuraManifest(manifest);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    client?.id,
    client?.name,
    client?.auraManifestUrl,
    client?.auraGcsPrefix,
    client?.turntableVideoUrl,
  ]);

  // 3D face mirror — Airtable URL wins, then Aura manifest, then localStorage cache.
  const glbUrl =
    client.turntableVideoUrl ||
    clientAuraManifest?.turntableVideoUrl ||
    getClientGlbUrl(client.name) ||
    null;
  const photoUrlForMirrorCheck =
    frontPhotoUrl ?? getClientFrontPhotoDisplayUrl(client.frontPhoto);
  const is3DSplit = (Boolean(glbUrl) || clientHas3DModel(client.name) || faceMirrorPhotoSlots.length > 0 || Boolean(photoUrlForMirrorCheck)) && !recommenderMode;
  const [activeAnalysisTerm, setActiveAnalysisTerm] = useState<string | null>(null);

  /** Face mirror: no default overlays; user picks regions or clicks one analysis issue. */
  const effectiveMirrorTerms = useMemo(
    () => (activeAnalysisTerm ? [activeAnalysisTerm] : []),
    [activeAnalysisTerm],
  );

  const usesAuraInterface = clientUsesAuraInterface(glbUrl);
  const auraScanOnly = usesAuraInterface;
  const [auraViewportExpanded, setAuraViewportExpanded] = useState(false);

  useEffect(() => {
    setAuraViewportExpanded(false);
  }, [client.id]);
  const photoUrlForMirror = usesAuraInterface
    ? null
    : (frontPhotoUrl ?? getClientFrontPhotoDisplayUrl(client.frontPhoto));

  const handleScanGenerated = useCallback(
    (result: { videoUrl: string; auraAssets?: PatientAuraAssetManifest }) => {
      setGeneratedClientGlbUrl(client.name, result.videoUrl);
      if (result.auraAssets) {
        setPatientAuraManifest(client.name, result.auraAssets);
      }
      onUpdate();
    },
    [client.name, onUpdate],
  );


  const treatmentPlanSection = useMemo(
    () => (
                  <div className="detail-section detail-section-treatment-plan cdp-treatment-plan--primary">
                    <div className="detail-section-header-flex">
                      <div className="detail-section-title detail-section-title-inline detail-section-title-treatment-plan detail-section-header-title-group">
                        <span>Treatment plan</span>
                        <span className="treatment-plan-section-subtitle">
                          {treatmentPlanSubheading}
                        </span>
                      </div>
                      <PlanStatusPill client={client} />
                      <div className="detail-actions-inline">
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRecommenderMode("by-treatment");
                          }}
                        >
                          {(client.discussedItems?.length ?? 0) > 0
                            ? "Edit"
                            : "Build"}
                        </button>
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
                        <div className="discussed-treatments-plan-sections-outer share-tp-link-quote">
                          {(() => {
                            const items = client.discussedItems || [];
                            const skincareItems = items
                              .filter((i) => i.treatment?.trim() === "Skincare")
                              .sort(
                                (a, b) =>
                                  (planQuoteOrderRank.get(a.id) ?? 9999) -
                                  (planQuoteOrderRank.get(b.id) ?? 9999),
                              );
                            const treatmentPreviewSections =
                              clientDetailTreatmentPreviewSectionsInOrder();
                            const hasTreatmentsBlock =
                              treatmentPreviewSections.some(
                                (s) =>
                                  getDiscussedTreatmentsForClientDetailSection(
                                    client.discussedItems,
                                    s.id,
                                  ).length > 0,
                              );
                            const renderPlanRow = (item: DiscussedItem) => {
                              const priceData =
                                discussedPlanPriceLabels.get(item.id) ?? null;
                              const timing =
                                planTimingLabelForDiscussedItem(item);
                              const isDone =
                                (optimisticTimelines.get(item.id) ?? item.timeline ?? "").trim() === "Completed";
                              const planSecondary =
                                getTreatmentPlanRowSecondaryLabel(item, {
                                  omitTimeline: Boolean(
                                    !isDone && timing,
                                  ),
                                });
                              return (
                                <div
                                  key={item.id}
                                  className={`discussed-treatments-record-row-outer discussed-treatments-record-row-heading-meta discussed-treatments-record-row-with-price${isDone ? " plan-row--done" : ""}`}
                                >
                                  <button
                                    type="button"
                                    className={`plan-row-checkbox${isDone ? " plan-row-checkbox--checked" : ""}`}
                                    aria-label={isDone ? "Mark as not built" : "Mark as built"}
                                    onClick={() => handleVisitModeToggleItem(item.id)}
                                  >
                                    {isDone ? "✓" : ""}
                                  </button>
                                  <div className="discussed-treatments-record-row-main">
                                    <div className="discussed-treatments-record-treatment-heading-outer">
                                      {getTreatmentPlanRowPrimaryLabel(item)}
                                    </div>
                                    {isDone ? (
                                      <div className="discussed-treatments-record-meta-line-outer discussed-treatments-record-checked-off">
                                        {getDiscussedItemCheckedOffLabel(item)}
                                      </div>
                                    ) : null}
                                    {!isDone && (timing || planSecondary) ? (
                                      <div className="discussed-treatments-record-timing-area-row">
                                        {timing ? (
                                          <div className="discussed-treatments-record-timing-line-outer">
                                            <span className="discussed-treatments-record-timing-hint">
                                              {timing}
                                            </span>
                                          </div>
                                        ) : null}
                                        {planSecondary ? (
                                          <div className="discussed-treatments-record-meta-line-outer">
                                            {planSecondary}
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : null}
                                  </div>
                                  {priceData && !isDone ? (
                                    <div
                                      className="discussed-treatments-record-price-outer"
                                      title="From practice price list / checkout"
                                    >
                                      <span>{priceData.label}</span>
                                      {priceData.missingInfo && (
                                        <span className="plan-pricing-warning-callout discussed-treatments-record-price-missing">
                                          ⚠ {priceData.missingInfo}
                                        </span>
                                      )}
                                      {priceData.missingInfo ? (
                                        <button
                                          type="button"
                                          className="plan-pricing-fix-action-btn"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openPlanBuilderForDiscussedItem(
                                              item.id,
                                            );
                                          }}
                                        >
                                          {planPricingFixActionLabel(
                                            priceData.missingInfo,
                                          )}
                                        </button>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            };

                            return (
                              <>
                                {skincareItems.length > 0 ? (
                                  <div className="share-tp-link-quote-section">
                                    <h4 className="share-tp-link-quote-section-title">
                                      {SKINCARE_SECTION_LABEL}
                                    </h4>
                                    <div className="discussed-treatments-records-list-outer">
                                      {skincareItems.map(renderPlanRow)}
                                    </div>
                                    {planCheckoutSubtotals &&
                                    planCheckoutSubtotals.skincareLineCount >
                                      0 ? (
                                      <div className="share-tp-link-quote-subtotal">
                                        <span>Skincare subtotal</span>
                                        <strong>
                                          {formatPrice(
                                            planCheckoutSubtotals.skincareSubtotal,
                                          )}
                                        </strong>
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}
                                {hasTreatmentsBlock ? (
                                  <div className="share-tp-link-quote-section share-tp-link-quote-section--treatments">
                                    <h4 className="share-tp-link-quote-section-title">
                                      Services
                                    </h4>
                                    {treatmentPreviewSections.map(
                                      ({ id, title }) => {
                                        const sectionItems =
                                          getDiscussedTreatmentsForClientDetailSection(
                                            client.discussedItems,
                                            id,
                                          ).sort(
                                            (a, b) =>
                                              (planQuoteOrderRank.get(a.id) ??
                                                9999) -
                                              (planQuoteOrderRank.get(b.id) ??
                                                9999),
                                          );
                                        if (sectionItems.length === 0)
                                          return null;
                                        return (
                                          <div
                                            key={id}
                                            className={`share-tp-link-timeline-group share-tp-link-timeline-group--${id}`}
                                          >
                                            <h5 className="share-tp-link-timeline-group-title">
                                              {title}
                                            </h5>
                                            <div className="discussed-treatments-records-list-outer">
                                              {sectionItems.map(renderPlanRow)}
                                            </div>
                                          </div>
                                        );
                                      },
                                    )}
                                    {planCheckoutSubtotals &&
                                    planCheckoutSubtotals.treatmentLineCount >
                                      0 ? (
                                      <div className="share-tp-link-quote-subtotal">
                                        <span>Subtotal</span>
                                        <strong>
                                          {formatPrice(
                                            planCheckoutSubtotals.treatmentsSubtotal,
                                          )}
                                        </strong>
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}
                                {planCheckoutSubtotals ? (
                                  <div className="share-tp-link-quote-footer">
                                    <div className="share-tp-link-quote-total">
                                      <span>Total</span>
                                      <strong>
                                        {formatPrice(
                                          planCheckoutSubtotals.total,
                                        )}
                                      </strong>
                                    </div>
                                  </div>
                                ) : null}
                              </>
                            );
                          })()}
                        </div>
                      ) : (
                        <p className="discussed-treatments-in-facial-summary discussed-treatments-plan-empty">
                          No treatments or products on this plan yet. Use Build
                          Plan to add items from your conversation and see
                          pricing here.
                        </p>
                      )}
                    </div>
                  </div>
    ),
    [
      client,
      treatmentPlanSubheading,
      planQuoteOrderRank,
      discussedPlanPriceLabels,
      planCheckoutSubtotals,
      optimisticTimelines,
      provider,
      facialAnalysisFormHasData,
      handleVisitModeToggleItem,
      openPlanBuilderForDiscussedItem,
    ],
  );

  useEffect(() => {
    if (!focusedIssueForRecommender || expandedRecommenderCollapsed) return;
    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById("cdp-expanded-planbuilder")
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusedIssueForRecommender, expandedRecommenderCollapsed]);

  useEffect(() => {
    setExpandedQuickAddDraft(null);
  }, [focusedIssueForRecommender, expandedRecommenderCollapsed]);

  const expandedPlanBuilderPanel = useMemo(() => {
    const detectedIssueSet = client ? getDetectedIssuesFromClient(client) : new Set<string>();
    const activeCategoryDef = CATEGORIES.find((c) => c.key === auraActiveCategoryForPlan);
    const findingsFromActiveCategory = activeCategoryDef
      ? activeCategoryDef.subScores.flatMap((sub) =>
          detectedIssuesForSubScore(
            auraActiveCategoryForPlan,
            sub.name,
            detectedIssueSet,
          ),
        )
      : [];
    const fallbackAllFindings = client
      ? getDetectedIssueDisplayStrings(client).slice(0, 20)
      : [];
    const findingsBase =
      findingsFromActiveCategory.length > 0
        ? findingsFromActiveCategory
        : fallbackAllFindings;
    const findings = Array.from(
      new Map(
        findingsBase.map((finding) => {
          const label = typeof finding === "string" ? finding.trim() : String(finding ?? "").trim();
          return [normalizeIssue(label), label] as const;
        }),
      ).values(),
    );
    const severityIssues = client ? getEffectiveSeverityIssues(client) ?? {} : {};
    const availableTreatments = new Set(
      getTreatmentOptionsForProvider(toProviderTreatmentContext(provider)),
    );

    const issueEntries = Object.entries(severityIssues);
    const severityForFinding = (finding: string) =>
      issueEntries.find(
        ([name]) => normalizeIssue(name) === normalizeIssue(finding),
      )?.[1];

    const allFindingsScored = findings
      .map((finding) => {
        const severityPayload = severityForFinding(finding);
        const badness = inferSeverityBadness01(severityPayload) ?? 0;
        const level =
          typeof severityPayload?.severity_level === "string"
            ? severityPayload.severity_level
            : badness >= 0.75
              ? "severe"
              : badness >= 0.5
                ? "moderate"
                : badness >= 0.25
                  ? "mild"
                  : "low";
        return { finding, badness, level };
      })
      .sort((a, b) => b.badness - a.badness)
      .filter((f) => f.badness > 0 || severityForFinding(f.finding));

    const prioritizedFindings = (() => {
      if (!focusedIssueForRecommender) return allFindingsScored;
      const focusedNorm = normalizeIssue(focusedIssueForRecommender);
      return [
        ...allFindingsScored.filter((f) => normalizeIssue(f.finding) === focusedNorm),
        ...allFindingsScored.filter((f) => normalizeIssue(f.finding) !== focusedNorm),
      ];
    })();

    const findingsForRecommendations = focusedIssueForRecommender
      ? (() => {
          const focusedNorm = normalizeIssue(focusedIssueForRecommender);
          const match = allFindingsScored.find(
            (f) => normalizeIssue(f.finding) === focusedNorm,
          );
          return match
            ? [match]
            : [
                {
                  finding: focusedIssueForRecommender,
                  badness: 0,
                  level: "detected",
                },
              ];
        })()
      : prioritizedFindings.slice(0, 5);

    const getFallbackMappingForIssue = (finding: string) => {
      const lowered = normalizeIssue(finding);
      const suggestion = Object.entries(SUGGESTION_TO_ISSUES).find(([, issues]) =>
        issues.some((issue) => lowered.includes(normalizeIssue(issue))),
      )?.[0];
      if (!suggestion) return null;
      const treatment = getTreatmentsForInterest(
        suggestion,
        toProviderTreatmentContext(provider),
      ).find((t) =>
        availableTreatments.has(t),
      );
      if (!treatment) return null;
      const row = FINDING_TO_GOAL_REGION_TREATMENTS.find((item) =>
        item.goal.trim().toLowerCase() === suggestion.trim().toLowerCase(),
      );
      return {
        treatment,
        goal: row?.goal ?? suggestion,
        region: row?.region ?? "Skin",
      };
    };

    const treatmentReasonForFinding = (treatment: string, finding: string) => {
      const t = treatment.trim().toLowerCase();
      const f = normalizeIssue(finding);
      const pigmentationFocused =
        f.includes("dark spot") ||
        f.includes("hyperpigmentation") ||
        f.includes("pigment") ||
        f.includes("sun spot") ||
        f.includes("sun damage") ||
        f.includes("melasma");
      if (pigmentationFocused) {
        if (t === "chemical peel") {
          return "Choose this when pigment looks more superficial or blotchy and you want surface renewal with a predictable series.";
        }
        if (t === "energy treatment") {
          return "Choose this when spots look photo-driven or more discrete and you want a device-based option that can target pigment directly.";
        }
        if (t === "microneedling") {
          return "Choose this when dark marks overlap with texture, acne marks, or pores and collagen remodeling is part of the goal.";
        }
        if (t === "skincare") {
          return "Choose this as the daily maintenance layer to fade gradually, reduce recurrence risk, and support any in-office treatment.";
        }
        if (t === "facial services") {
          return "Choose this for a gentler brightening or prep option when the patient wants lower downtime or a lighter first step.";
        }
      }
      if (t === "chemical peel") {
        return "Best when exfoliation and surface clarity are the main goals.";
      }
      if (t === "energy treatment") {
        return "Best when a device-based option can target pigment, redness, or laxity more directly.";
      }
      if (t === "microneedling") {
        return "Best when texture, pores, scarring, or collagen remodeling are part of the concern.";
      }
      if (t === "skincare") {
        return "Best for maintenance, prevention, and gradual improvement between visits.";
      }
      if (t === "facial services") {
        return "Best as a lower-downtime option or supportive step before stronger treatments.";
      }
      return "A relevant option for this finding depending on depth, downtime tolerance, and treatment goals.";
    };

    const highImpactTreatments = findingsForRecommendations
      .flatMap((finding) => {
        const f = finding.finding.toLowerCase();
        const mapped = FINDING_TO_GOAL_REGION_TREATMENTS.find((row) =>
          row.keywords.some((kw) => f.includes(kw.toLowerCase())),
        );
        const directTreatments = mapped?.treatments.filter((t) =>
          availableTreatments.has(t),
        ) ?? [];
        const fallback = directTreatments.length === 0
          ? getFallbackMappingForIssue(finding.finding)
          : null;
        const treatments = focusedIssueForRecommender
          ? directTreatments
          : directTreatments.slice(0, 1);
        const treatmentRows =
          treatments.length > 0
            ? treatments
            : fallback?.treatment
              ? [fallback.treatment]
              : [];
        return treatmentRows.map((treatment) => ({
            finding: finding.finding,
            treatment,
            goal: mapped?.goal ?? fallback?.goal ?? "Skin improvement",
            region: mapped?.region ?? fallback?.region ?? "Skin",
            badness: finding.badness,
            level: finding.level,
            reason: treatmentReasonForFinding(treatment, finding.finding),
          }));
      })
      .reduce<
        Array<{
          treatment: string;
          goal: string;
          region: string;
          impactScore: number;
          reason: string;
          findings: Array<{ finding: string; level: string }>;
        }>
      >((acc, item) => {
        const existing = acc.find(
          (x) => x.treatment === item.treatment && x.goal === item.goal,
        );
        if (existing) {
          existing.impactScore += item.badness + 0.15;
          if (!existing.findings.some((f) => f.finding === item.finding)) {
            existing.findings.push({ finding: item.finding, level: item.level });
          }
          return acc;
        }
        acc.push({
          treatment: item.treatment,
          goal: item.goal,
          region: item.region,
          impactScore: item.badness + 0.15,
          reason: item.reason,
          findings: [{ finding: item.finding, level: item.level }],
        });
        return acc;
      }, [])
      .sort((a, b) => b.impactScore - a.impactScore)
      .slice(0, focusedIssueForRecommender ? 5 : 4);

    const focusedFindingEntry = focusedIssueForRecommender
      ? findingsForRecommendations[0]
      : null;
    const quickAddTimelineOptions = TIMELINE_OPTIONS.filter(
      (option) => option !== "Completed",
    );
    const quickAddKey = (qa: { treatment: string; goal: string }) =>
      `${qa.treatment}::${qa.goal}`;
    const productOptionsForQuickAdd = (treatment: string) =>
      getTreatmentProductOptionsForProvider(
        toProviderTreatmentContext(provider),
        treatment,
      ).slice(0, 8);
    const regionOptionsForQuickAdd = (treatment: string) => {
      const normalized = treatment.trim();
      if (normalized === "Energy Treatment") {
        return ENERGY_TREATMENT_WHERE_OPTIONS.length > 0
          ? [...ENERGY_TREATMENT_WHERE_OPTIONS]
          : [...CHECKOUT_REGION_OPTIONS_BROAD];
      }
      if (normalized === "Microneedling") return [...REGION_OPTIONS_MICRONEEDLING];
      if (normalized === "Chemical Peel") {
        return CHEMICAL_PEEL_AREA_OPTIONS.length > 0
          ? [...CHEMICAL_PEEL_AREA_OPTIONS]
          : ["Full Face", "Neck", "Chest"];
      }
      if (normalized === "Facial Services") return ["Face", "Neck", "Chest"];
      if (normalized === "Skincare") return ["Full face", "Face", "Neck", "Chest"];
      return REGION_OPTIONS;
    };
    const openQuickAddDraft = (qa: {
      treatment: string;
      goal: string;
      region: string;
    }) => {
      const productOptions = productOptionsForQuickAdd(qa.treatment);
      const product = productOptions[0] ?? "";
      const quantityCtx = getQuantityContext(
        qa.treatment,
        product || undefined,
        provider?.code,
      );
      const regionOptions = regionOptionsForQuickAdd(qa.treatment);
      const preferredRegion =
        qa.region && qa.region !== "Other" && regionOptions.includes(qa.region)
          ? qa.region
          : regionOptions[0] ?? qa.region ?? "";
      setExpandedQuickAddDraft({
        key: quickAddKey(qa),
        timeline: "Wishlist",
        quantity: quantityCtx.defaultQuantity ?? "",
        product,
        region: preferredRegion,
        notes: "",
      });
    };
    const updateQuickAddDraft = (patch: Partial<ExpandedQuickAddDraft>) => {
      setExpandedQuickAddDraft((current) =>
        current ? { ...current, ...patch } : current,
      );
    };
    const submitQuickAddDraft = (qa: {
      treatment: string;
      goal: string;
      findings: Array<{ finding: string; level: string }>;
    }) => {
      if (!expandedQuickAddDraft) return;
      void appendDiscussedItemFromPrefill({
        interest: qa.goal,
        region: expandedQuickAddDraft.region,
        treatment: qa.treatment,
        treatmentProduct: expandedQuickAddDraft.product || undefined,
        findings: qa.findings.map((f) => f.finding),
        timeline: expandedQuickAddDraft.timeline,
        quantity: expandedQuickAddDraft.quantity || undefined,
        notes: expandedQuickAddDraft.notes || undefined,
      });
      setExpandedQuickAddDraft(null);
    };

    return (
      <section
        id="cdp-expanded-planbuilder"
        className={`cdp-expanded-planbuilder${
          expandedRecommenderCollapsed ? " cdp-expanded-planbuilder--collapsed" : ""
        }${focusedIssueForRecommender ? " cdp-expanded-planbuilder--finding-focused" : ""}`}
        aria-label={
          focusedIssueForRecommender
            ? `Treatment recommender for ${focusedIssueForRecommender}`
            : "Embedded plan builder"
        }
      >
        <button
          type="button"
          className="cdp-expanded-planbuilder__header-btn"
          onClick={() => setExpandedRecommenderCollapsed((v) => !v)}
          aria-expanded={!expandedRecommenderCollapsed}
          aria-label={
            expandedRecommenderCollapsed
              ? "Expand treatment recommender"
              : "Collapse treatment recommender"
          }
        >
          <div className="cdp-expanded-planbuilder__header-main">
            <h4 className="cdp-expanded-planbuilder__title">
              {focusedIssueForRecommender
                ? "Treat this finding"
                : "Quick Add"}
            </h4>
            {focusedIssueForRecommender ? (
              <p className="cdp-expanded-planbuilder__subtitle cdp-expanded-planbuilder__subtitle--finding">
                Recommendations for{" "}
                <span className="cdp-expanded-planbuilder__subtitle-finding">
                  {focusedIssueForRecommender}
                </span>
              </p>
            ) : !expandedRecommenderCollapsed ? (
              <p className="cdp-expanded-planbuilder__subtitle">
                Open suggested treatments with quantity, brand, region, and details.
              </p>
            ) : null}
          </div>
          <span className="cdp-expanded-planbuilder__header-chevron" aria-hidden>
            {expandedRecommenderCollapsed ? "▴" : "▾"}
          </span>
        </button>
        <div
          className={`cdp-expanded-planbuilder__expanded-content${
            expandedRecommenderCollapsed
              ? " cdp-expanded-planbuilder__expanded-content--collapsed"
              : ""
          }`}
          aria-hidden={expandedRecommenderCollapsed}
        >
        {focusedIssueForRecommender ? (
          <div className="cdp-expanded-planbuilder__finding-context">
            <div className="cdp-expanded-planbuilder__finding-context-main">
              <span className="cdp-expanded-planbuilder__finding-context-label">
                Selected finding
              </span>
              <span className="cdp-expanded-planbuilder__finding-context-name">
                {focusedIssueForRecommender}
              </span>
              {focusedFindingEntry?.level ? (
                <span
                  className={`cdp-expanded-planbuilder__severity cdp-expanded-planbuilder__severity--${focusedFindingEntry.level.toLowerCase().replace(/\s+/g, "")}`}
                >
                  {focusedFindingEntry.level}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              className="cdp-expanded-planbuilder__finding-context-clear"
              onClick={() => setFocusedIssueForRecommender(null)}
            >
              Show all
            </button>
          </div>
        ) : null}
        {highImpactTreatments.length > 0 ? (
          <div className="cdp-expanded-planbuilder__quick-add">
            <span className="cdp-expanded-planbuilder__analysis-label">
              {focusedIssueForRecommender
                ? "Suggested treatments"
                : "Quick add with details"}
            </span>
            <div className="cdp-expanded-planbuilder__quick-add-list">
              {highImpactTreatments.map((qa) => {
                const itemKey = quickAddKey(qa);
                const isDraftOpen = expandedQuickAddDraft?.key === itemKey;
                const productOptions = productOptionsForQuickAdd(qa.treatment);
                const regionOptions = regionOptionsForQuickAdd(qa.treatment);
                const quantityCtx = getQuantityContext(
                  qa.treatment,
                  expandedQuickAddDraft?.product || undefined,
                  provider?.code,
                );
                return (
                  <div
                    key={`${qa.treatment}-${qa.goal}`}
                    className={`cdp-expanded-planbuilder__quick-add-item${
                      focusedIssueForRecommender
                        ? " cdp-expanded-planbuilder__quick-add-item--for-focused-finding"
                        : ""
                    }${isDraftOpen ? " cdp-expanded-planbuilder__quick-add-item--editing" : ""}`}
                  >
                    <span className="cdp-expanded-planbuilder__quick-add-title">
                      {qa.treatment}
                    </span>
                    <span className="cdp-expanded-planbuilder__quick-add-meta">
                      {focusedIssueForRecommender
                        ? `${qa.goal} · targets ${focusedIssueForRecommender}`
                        : `${qa.goal} · addresses ${qa.findings.length} finding${qa.findings.length !== 1 ? "s" : ""}`}
                    </span>
                    {focusedIssueForRecommender ? (
                      <p className="cdp-expanded-planbuilder__quick-add-reason">
                        {qa.reason}
                      </p>
                    ) : null}
                    <p className="cdp-expanded-planbuilder__quick-add-findings">
                      {qa.findings.slice(0, 3).map((f, i) => (
                        <span
                          key={`${qa.treatment}-${f.finding}`}
                          className={
                            focusedIssueForRecommender &&
                            normalizeIssue(f.finding) ===
                              normalizeIssue(focusedIssueForRecommender)
                              ? "cdp-expanded-planbuilder__quick-add-finding--focused"
                              : undefined
                          }
                        >
                          {i > 0 && (
                            <span className="cdp-expanded-planbuilder__quick-add-findings-sep">
                              {" "}
                              ·{" "}
                            </span>
                          )}
                          {f.finding}
                        </span>
                      ))}
                    </p>
                    {!isDraftOpen ? (
                      <div className="cdp-expanded-planbuilder__quick-add-actions">
                        <button
                          type="button"
                          className="cdp-expanded-planbuilder__mini-btn cdp-expanded-planbuilder__mini-btn--primary"
                          onClick={() => openQuickAddDraft(qa)}
                        >
                          Add details
                        </button>
                      </div>
                    ) : expandedQuickAddDraft ? (
                      <div className="cdp-expanded-planbuilder__quick-form">
                        <div className="cdp-expanded-planbuilder__quick-form-row cdp-expanded-planbuilder__quick-form-row--timeline">
                          {quickAddTimelineOptions.map((option) => (
                            <button
                              key={option}
                              type="button"
                              className={`cdp-expanded-planbuilder__seg-btn${
                                expandedQuickAddDraft.timeline === option
                                  ? " cdp-expanded-planbuilder__seg-btn--selected"
                                  : ""
                              }`}
                              onClick={() => updateQuickAddDraft({ timeline: option })}
                            >
                              {timelineOptionDisplayLabel(option)}
                            </button>
                          ))}
                        </div>
                        {productOptions.length > 0 ? (
                          <label className="cdp-expanded-planbuilder__quick-field">
                            <span>{qa.treatment === "Skincare" ? "Product" : "Type"}</span>
                            <select
                              value={expandedQuickAddDraft.product}
                              onChange={(event) => {
                                const product = event.target.value;
                                const nextCtx = getQuantityContext(
                                  qa.treatment,
                                  product || undefined,
                                  provider?.code,
                                );
                                updateQuickAddDraft({
                                  product,
                                  quantity: nextCtx.defaultQuantity ?? "",
                                });
                              }}
                            >
                              {productOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}
                        {regionOptions.length > 0 ? (
                          <label className="cdp-expanded-planbuilder__quick-field">
                            <span>Area</span>
                            <select
                              value={expandedQuickAddDraft.region}
                              onChange={(event) =>
                                updateQuickAddDraft({ region: event.target.value })
                              }
                            >
                              {regionOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}
                        <label className="cdp-expanded-planbuilder__quick-field">
                          <span>{quantityCtx.unitLabel}</span>
                          {quantityCtx.quantityControl === "select" ? (
                            <select
                              value={expandedQuickAddDraft.quantity}
                              onChange={(event) =>
                                updateQuickAddDraft({ quantity: event.target.value })
                              }
                            >
                              {quantityCtx.options.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              value={expandedQuickAddDraft.quantity}
                              placeholder={quantityCtx.inputPlaceholder ?? "Quantity"}
                              onChange={(event) =>
                                updateQuickAddDraft({ quantity: event.target.value })
                              }
                            />
                          )}
                        </label>
                        <label className="cdp-expanded-planbuilder__quick-field">
                          <span>Notes</span>
                          <input
                            value={expandedQuickAddDraft.notes}
                            placeholder="Optional details"
                            onChange={(event) =>
                              updateQuickAddDraft({ notes: event.target.value })
                            }
                          />
                        </label>
                        <div className="cdp-expanded-planbuilder__quick-form-actions">
                          <button
                            type="button"
                            className="cdp-expanded-planbuilder__mini-btn"
                            onClick={() => setExpandedQuickAddDraft(null)}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="cdp-expanded-planbuilder__mini-btn cdp-expanded-planbuilder__mini-btn--primary"
                            onClick={() => submitQuickAddDraft(qa)}
                          >
                            Add to plan
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="cdp-expanded-planbuilder__analysis-empty">
            {focusedIssueForRecommender
              ? `No mapped treatments for "${focusedIssueForRecommender}" yet. Open the full plan builder to explore options.`
              : "No treatment recommendations for this category yet."}
          </p>
        )}
        </div>
      </section>
    );
  }, [
    client,
    provider?.code,
    appendDiscussedItemFromPrefill,
    expandedRecommenderCollapsed,
    expandedQuickAddDraft,
    auraActiveCategoryForPlan,
    focusedIssueForRecommender,
  ]);

  return (
    <>
      {createPortal(
        <div className={`client-detail-panel${is3DSplit ? " client-detail-panel--3d-split" : ""}${auraViewportExpanded ? " client-detail-panel--analysis-expanded" : ""}${darkMode ? " cdp-dark" : ""}`} ref={panelRef}>
          <div className="client-detail-panel-header">
            <img
              src={ponceLogoSrc(darkMode)}
              alt="Ponce AI"
              className="cdp-ponce-logo"
            />
            <button
              className="client-detail-panel-close"
              onClick={
                recommenderMode ? () => setRecommenderMode(null) : onClose
              }
              aria-label={recommenderMode ? "Back to client details" : "Close"}
            >
              ×
            </button>
          </div>

          {/* 3D split: left face mirror column */}
          {is3DSplit && (
            <div className={`cdp-face-col${usesAuraInterface ? " cdp-face-col--aura" : ""}`}>
              <FaceMirrorPanel
                photoUrl={auraScanOnly ? null : photoUrlForMirror}
                photoSlots={faceMirrorPhotoSlots}
                glbUrl={glbUrl}
                auraManifestUrl={client.auraManifestUrl}
                auraGcsPrefix={client.auraGcsPrefix}
                initialAuraManifest={clientAuraManifest}
                highlightTerms={effectiveMirrorTerms}
                patientName={client.name}
                airtableRecordId={client.id}
                airtableTableName={client.tableSource}
                onOpenPatientPhotos={openPatientPhotosFromFaceMirror}
                showPatientPhotoGallery={
                  (client.tableSource === "Patients" ||
                    client.tableSource === "Web Popup Leads") &&
                  !client.id.startsWith("admin-demo")
                }
                analysisOverviewClient={client}
                analysisOverviewOnAddToPlanDirect={appendDiscussedItemFromPrefill}
                analysisOverviewOnOpenTreatmentRecommender={(issue, category) => {
                  if (category) setAuraActiveCategoryForPlan(category);
                  setFocusedIssueForRecommender(
                    typeof issue === "string" && issue.trim() ? issue.trim() : null,
                  );
                  setExpandedRecommenderCollapsed(false);
                }}
                expandedLowerRightContent={expandedPlanBuilderPanel}
                onOpenPlanBuilder={() => setRecommenderMode("by-treatment")}
                darkMode={darkMode}
                onAuraActiveCategoryChange={setAuraActiveCategoryForPlan}
                onViewportExpandedChange={setAuraViewportExpanded}
                onScanGenerated={handleScanGenerated}
              />
            </div>
          )}

          <div className="client-detail-panel-scroll">
            <div
              className={`client-detail-panel-body${recommenderMode ? " client-detail-panel-body--recommender" : ""}`}
            >
              {recommenderMode === "by-treatment" && client && (
                <TreatmentRecommenderByTreatment
                  client={client}
                  onBack={() => setRecommenderMode(null)}
                  onUpdate={onUpdate}
                  onRecommenderRegionsChange={handleRecommenderRegionsChange}
                  onAddToPlanDirect={appendDiscussedItemFromPrefill}
                  onAddMultipleToPlanDirect={appendDiscussedItemsFromPrefills}
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
                      i.id === itemId ? mergeDiscussedItemPatch(i, patch) : i,
                    );
                    try {
                      await persistClientDiscussedItems(client, nextItems);
                      showToast("Plan updated");
                      onUpdate();
                    } catch (e) {
                      showError(
                        e instanceof Error
                          ? e.message
                          : "Failed to update plan",
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
                  initialOpenPlanItemId={shareLinkPendingPlanEditId}
                  onConsumedInitialOpenPlanItemId={
                    handleConsumedShareLinkPlanEdit
                  }
                  initialFocusTreatmentName={pendingFocusTreatmentName}
                  onConsumedInitialFocusTreatmentName={
                    handleConsumedPendingFocusTreatment
                  }
                />
              )}
              {recommenderMode === "by-suggestion" && client && (
                <TreatmentRecommenderBySuggestion
                  client={client}
                  onBack={() => setRecommenderMode(null)}
                  onUpdate={onUpdate}
                  onRecommenderRegionsChange={handleRecommenderRegionsChange}
                  onAddToPlanDirect={appendDiscussedItemFromPrefill}
                />
              )}
              {!recommenderMode ? (
                <div className="client-detail-panel-main">
                  {/* Contact Information Section */}
                  <div
                    className={`detail-section modal-contact-section${
                      contactSectionCollapsed ? " modal-contact-section--details-collapsed" : ""
                    } ${
                      !is3DSplit && (frontPhotoUrl ||
                      (!wellnestReplacesSkinQuizWithWellness &&
                        (client.tableSource === "Patients" ||
                          client.tableSource === "Web Popup Leads")))
                        ? "modal-header-with-photo"
                        : "modal-contact-section-base"
                    }`}
                  >
                    {!is3DSplit && frontPhotoUrl && (
                      <button
                        type="button"
                        className="modal-photo-container modal-photo-container-clickable"
                        onClick={() => {
                          setPhotoViewerType("front");
                          setShowPhotoViewer(true);
                        }}
                        title="View photos"
                        aria-label="View photos"
                      >
                        <img
                          src={frontPhotoUrl}
                          alt=""
                          className="modal-photo"
                          loading="eager"
                          fetchPriority="high"
                          decoding="async"
                          draggable={false}
                          onError={() => {
                            if (!frontPhotoUrl || !client) return;
                            markPhotoDisplayUrlFailed(frontPhotoUrl);
                            setFrontPhotoUrl(null);
                            setPhotoLoading(true);
                            fetchClientFrontPhoto(client.id)
                              .then((photo) => {
                                const url = getClientFrontPhotoDisplayUrl(photo, {
                                  allowExpiringAirtableCdn: true,
                                });
                                if (url) {
                                  client.frontPhoto = (photo ?? url) as Client["frontPhoto"];
                                  client.frontPhotoLoaded = true;
                                  setFrontPhotoUrl(url);
                                }
                                setPhotoLoading(false);
                              })
                              .catch(() => setPhotoLoading(false));
                          }}
                        />
                        <span className="modal-photo-overlay">
                          Click to view
                        </span>
                      </button>
                    )}
                    {!is3DSplit && photoLoading &&
                      !frontPhotoUrl &&
                      !wellnestReplacesSkinQuizWithWellness && (
                      <div className="modal-photo-container modal-photo-loading">
                        <div className="modal-photo-loading-text">
                          Loading photo...
                        </div>
                      </div>
                    )}
                    {!is3DSplit && !frontPhotoUrl &&
                      !photoLoading &&
                      !wellnestReplacesSkinQuizWithWellness &&
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
                              client.facialAnalysisStatus
                                .toLowerCase()
                                .trim() === "pending"
                                ? "Photo will become available once the analysis is complete."
                                : "No profile photo available. Share the facial analysis link to help this patient complete their analysis."}
                            </p>
                            {(!client.facialAnalysisStatus ||
                              client.facialAnalysisStatus
                                .toLowerCase()
                                .trim() !== "pending") && (
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
                                Share
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    {!is3DSplit && !frontPhotoUrl &&
                      !photoLoading &&
                      !wellnestReplacesSkinQuizWithWellness &&
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
                      <div className="cdp-client-name-row">
                        <h2 className="client-detail-panel-title">{client.name}</h2>
                        {!recommenderMode && (
                          <button
                            type="button"
                            className="cdp-contact-collapse-btn"
                            onClick={() => setContactSectionCollapsed((c) => !c)}
                            aria-expanded={!contactSectionCollapsed}
                            aria-label={
                              contactSectionCollapsed
                                ? "Show contact details"
                                : "Hide contact details"
                            }
                            title={
                              contactSectionCollapsed
                                ? "Show contact details"
                                : "Hide contact details"
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
                              {contactSectionCollapsed ? (
                                <path d="M6 9l6 6 6-6" />
                              ) : (
                                <path d="M18 15l-6-6-6 6" />
                              )}
                            </svg>
                          </button>
                        )}
                        {recommenderMode ? (
                          <span className="client-detail-panel-header-subtitle">Plan Builder</span>
                        ) : (
                          <div className="modal-header-activity-badge client-detail-panel-activity-inline">
                            <span className="modal-header-activity-label">Last Activity:</span>
                            <span className="modal-header-activity-value">{lastActivityRelative}</span>
                          </div>
                        )}
                        {!recommenderMode && !isEditMode && (
                          <ClientContactMenu
                            phone={client.phone}
                            email={client.email}
                            onCall={handleCall}
                            onEmail={handleEmail}
                            onMessages={() => setShowSmsPopup(true)}
                          />
                        )}
                        {!isEditMode && (
                          <button
                            type="button"
                            className="edit-toggle-btn"
                            onClick={() => {
                              setContactSectionCollapsed(false);
                              setIsEditMode(true);
                            }}
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
                        )}
                      </div>
                      <div className="contact-info-with-actions">
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
                              <div className="detail-value">
                                {client.ageRange}
                              </div>
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
                                {formatDateOfBirth(client.dateOfBirth)}
                              </div>
                            </div>
                          )}
                          <div className="detail-item">
                            <label>Status</label>
                            <select
                              value={status}
                              onChange={(e) =>
                                handleStatusChange(
                                  e.target.value as Client["status"],
                                )
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
                              <option value="current-client">
                                Current Client
                              </option>
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
                                  <option value="Social Media">
                                    Social Media
                                  </option>
                                  <option value="Website">Website</option>
                                  <option value="AI Consult">
                                    AI Consult Tool
                                  </option>
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
                            (client.locationName ||
                              client.appointmentStaffName) && (
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
                                maxLength={5}
                                onInput={(e) => {
                                  formatZipCodeInput(
                                    e.target as HTMLInputElement,
                                  );
                                  setEditedClient({
                                    ...editedClient,
                                    zipCode: (e.target as HTMLInputElement)
                                      .value,
                                  });
                                }}
                                onChange={(e) => {
                                  setEditedClient({
                                    ...editedClient,
                                    zipCode: e.target.value,
                                  });
                                }}
                                className="edit-input"
                              />
                            ) : (
                              <div className="detail-value">
                                {client.zipCode || "Not provided"}
                              </div>
                            )}
                          </div>
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

                  {treatmentPlanSection}

                  {/* Online Treatment Finder – marketing web / popup funnel only (not Add Client or Walk-in) */}
                  {showOnlineTreatmentFinderSection(client) && (
                    <div className="detail-section detail-section-with-border">
                      <div className="detail-section-title detail-section-title-flex">
                        <span>Online Treatment Finder</span>
                        {client.createdAt && (
                          <span className="detail-value-muted detail-section-date">
                            Completed {formatDateTime(client.createdAt)}
                          </span>
                        )}
                      </div>

                      {/* $50 coupon – white box with Earned / Claimed side by side, checkbox-style Yes/No */}
                      <div className="detail-section-spacing">
                        <div className="detail-coupon-box">
                          <h4 className="detail-coupon-title">$50 coupon</h4>
                          <div className="detail-coupon-row-inline">
                            <div className="detail-coupon-cell">
                              <span className="detail-coupon-label">
                                Earned
                              </span>
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
                                    <span
                                      className="detail-coupon-x"
                                      aria-hidden
                                    >
                                      ✗
                                    </span>
                                    <span>No</span>
                                  </>
                                )}
                              </span>
                            </div>
                            <div className="detail-coupon-cell">
                              <span className="detail-coupon-label">
                                Claimed
                              </span>
                              {client.offerClaimed ? (
                                <span
                                  className="detail-coupon-badge detail-coupon-badge--yes"
                                  aria-label="Claimed: Yes"
                                >
                                  <span
                                    className="detail-coupon-check"
                                    aria-hidden
                                  >
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
                                    <span
                                      className="detail-coupon-x"
                                      aria-hidden
                                    >
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
                                        (c): c is string =>
                                          typeof c === "string",
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
                            <label className="detail-label-small">
                              Skin Type
                            </label>
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
                            <label className="detail-label-small">
                              Skin Tone
                            </label>
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

                  {showMergedWellnessSection && (
                    <div
                      className={`detail-section ${
                        showWellnessQuizSection
                          ? "detail-section-wellness-quiz"
                          : "detail-section-wellness-overview"
                      }`}
                    >
                      {showWellnessQuizSection ? (
                        <div className="detail-section-header-flex">
                          <div className="detail-section-title detail-section-title-inline detail-section-header-title-group">
                            <div className="detail-wellness-quiz-heading-stack">
                              <span>{wellnessSectionHeading}</span>
                              {client.wellnessQuiz && (
                                <span className="detail-value-muted">
                                  {
                                    client.wellnessQuiz.suggestedTreatmentIds
                                      .length
                                  }{" "}
                                  suggestion
                                  {client.wellnessQuiz.suggestedTreatmentIds
                                    .length !== 1
                                    ? "s"
                                    : ""}
                                  {client.wellnessQuiz.completedAt &&
                                    ` · ${formatDate(client.wellnessQuiz.completedAt)}`}
                                </span>
                              )}
                            </div>
                          </div>
                          <QuizStatusPill
                            client={client}
                            quizScope="wellness"
                          />
                          <div className="detail-section-header-actions">
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowWellnessQuiz(true);
                              }}
                            >
                              {client.wellnessQuiz
                                ? "View Results"
                                : "Take Now"}
                            </button>
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSMSInitialMessage(
                                  getWellnessQuizMessage(client),
                                );
                                setShowSendSMS(true);
                              }}
                              disabled={!client.phone && !client.email}
                              title={
                                client.wellnessQuiz
                                  ? client.phone
                                    ? "Share quiz link via SMS"
                                    : client.email
                                      ? "Share quiz link via email"
                                      : "Add phone or email to share"
                                  : client.phone
                                    ? "Request quiz via SMS"
                                    : client.email
                                      ? "Request quiz via email"
                                      : "Add phone or email to request from patient"
                              }
                            >
                              {client.wellnessQuiz
                                ? "Share"
                                : "Request with patient"}
                            </button>
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
                                  Send Results Via SMS
                                </button>
                              )}
                          </div>
                        </div>
                      ) : (
                        <div className="detail-section-title">
                          {wellnessSectionHeading}
                        </div>
                      )}
                      {hasWellnessOverview &&
                        !wellnestReplacesSkinQuizWithWellness && (
                        <>
                          <p className="skin-analysis-description">
                            Peptide and wellness goals and plan items —
                            separate from facial analysis and scanning.
                          </p>
                          {intakeWellnessInterests.length > 0 && (
                            <div className="detail-wellness-intake-interests">
                              <div className="detail-label">
                                Goals from intake
                              </div>
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
                              <div className="detail-label">
                                On treatment plan
                              </div>
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
                        </>
                      )}
                      {showWellnessQuizSection && (
                        <div
                          className={
                            hasWellnessOverview
                              ? "detail-wellness-quiz-subsection"
                              : undefined
                          }
                        >
                          {hasWellnessOverview &&
                            !wellnestReplacesSkinQuizWithWellness && (
                            <div className="detail-label">Wellness quiz</div>
                          )}
                          {wellnestReplacesSkinQuizWithWellness &&
                            intakeWellnessInterests.length > 0 && (
                              <div className="detail-wellness-intake-interests">
                                <div className="detail-label">
                                  Goals from intake
                                </div>
                                <div
                                  className="detail-wellness-intake-chips"
                                  role="list"
                                >
                                  {intakeWellnessInterests.map((label, idx) => (
                                    <span
                                      key={`quiz-goals-${label}-${idx}`}
                                      className="detail-wellness-intake-chip"
                                      role="listitem"
                                    >
                                      {label}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          <p className="skin-analysis-description">
                            {client.wellnessQuiz
                              ? wellnestReplacesSkinQuizWithWellness
                                ? "Suggested peptides combine your intake goals with quiz answers. Use Build plan to add lines to the treatment plan."
                                : "Peptide and wellness treatment suggestions based on the completed quiz."
                              : wellnestReplacesSkinQuizWithWellness
                                ? "Complete the wellness quiz for peptide suggestions tied to your goals and answers."
                                : "Complete the wellness quiz to get personalized peptide/treatment suggestions from our offerings."}
                          </p>
                          {client.wellnessQuiz &&
                            (getSuggestedWellnessTreatments(client.wellnessQuiz)
                              .length > 0 ||
                              getWellnessQuizDisplayCategoryScores(
                                client.wellnessQuiz,
                              ).length > 0) && (
                              <WellnessQuizResultsCards
                                suggestedTreatments={getSuggestedWellnessTreatments(
                                  client.wellnessQuiz,
                                )}
                                answers={client.wellnessQuiz.answers}
                                categoryScores={getWellnessQuizDisplayCategoryScores(
                                  client.wellnessQuiz,
                                )}
                                intakeWellnessGoals={
                                  wellnestReplacesSkinQuizWithWellness
                                    ? intakeWellnessInterests
                                    : undefined
                                }
                                onAddToPlan={
                                  wellnestReplacesSkinQuizWithWellness
                                    ? undefined
                                    : async (prefill) => {
                                        const newItem: DiscussedItem = {
                                          id: generateId(),
                                          addedAt: new Date().toISOString(),
                                          interest:
                                            prefill.interest?.trim() || undefined,
                                          findings: prefill.findings?.length
                                            ? prefill.findings
                                            : undefined,
                                          treatment: prefill.treatment?.trim() || "",
                                          product:
                                            prefill.treatmentProduct?.trim() ||
                                            undefined,
                                          region: prefill.region?.trim() || undefined,
                                          timeline: (prefill.timeline?.trim() ||
                                            "Wishlist") as string,
                                          quantity:
                                            prefill.quantity?.trim() || undefined,
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
                                      }
                                }
                              />
                            )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Facial Analysis Section */}
                  <div className="detail-section detail-section-facial-analysis">
                    <div className="detail-section-header-flex detail-section-facial-analysis-header">
                      <div className="detail-section-facial-analysis-header__primary">
                        <span className="detail-section-facial-analysis-header__heading">
                          <span className="detail-section-title detail-section-facial-analysis-header__title">
                            Facial Analysis
                          </span>
                          {client.tableSource === "Patients" &&
                            facialAnalysisFormHasData &&
                            client.createdAt && (
                              <span
                                className="facial-analysis-date-meta facial-analysis-date-meta--inline"
                                title={`Analysis date: ${formatDate(client.createdAt)}`}
                              >
                                {formatDate(client.createdAt)}
                              </span>
                            )}
                        </span>
                        <FacialAnalysisStatusPill
                          client={client}
                          providerCode={provider?.code}
                          facialAnalysisFormHasData={Boolean(
                            facialAnalysisFormHasData,
                          )}
                        />
                      </div>
                      <div className="detail-actions-inline detail-section-facial-analysis-header__actions">
                        {facialAnalysisFormHasData && (
                          <>
                            {treatmentPreviewUiEnabled && (
                              <button
                                type="button"
                                className="btn-secondary btn-sm"
                                title="View facial analysis"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowAnalysisOverview(true);
                                }}
                              >
                                View
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
                              Share
                            </button>
                          </>
                        )}
                        {hasWebPopupForm && (
                          <button
                            className="btn-secondary btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleScanInClinic();
                            }}
                          >
                            Scan In Clinic
                          </button>
                        )}
                      </div>
                    </div>
                    {facialAnalysisFormHasData ? (
                      <AnalysisResultsSection
                        client={client}
                        activeIssueTerm={activeAnalysisTerm}
                        onIssueActivate={(term) =>
                          setActiveAnalysisTerm((prev) => (prev === term ? null : term))
                        }
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
                          <div className="detail-empty-state-text">
                            {`Request a facial analysis scan for this client using the "Scan In Clinic" button above.`}
                          </div>
                        ) : (
                          <div className="detail-empty-center">
                            This patient has not completed the Facial Analysis
                            form.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {!isUniqueAestheticsProvider(provider) &&
                    !wellnestReplacesSkinQuizWithWellness && (
                    <>
                      {/* Skin Quiz Section (hidden for Wellnest — wellness quiz replaces it) */}
                      <div className="detail-section detail-section-skin-analysis">
                        <div className="detail-section-header-flex skin-analysis-header">
                          <div className="detail-section-title detail-section-title-inline skin-analysis-heading-block detail-section-header-title-group">
                            <span>Skin Quiz</span>
                            {skincareQuiz?.completedAt && (
                              <span className="skin-analysis-result-badge detail-value-muted">
                                · {formatDate(skincareQuiz.completedAt)}
                              </span>
                            )}
                          </div>
                          <QuizStatusPill
                            client={client}
                            quizScope="skincare"
                          />
                          <div className="skin-analysis-quiz-actions">
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              onClick={() => setShowSkinTypeQuiz(true)}
                            >
                              {skincareQuiz ? "View Results" : "Take Now"}
                            </button>
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              onClick={() => {
                                setSMSInitialMessage(
                                  getSkinQuizMessage(client),
                                );
                                setShowSendSMS(true);
                              }}
                              disabled={!client.phone && !client.email}
                              title={
                                skincareQuiz
                                  ? client.phone
                                    ? "Share Quiz Link Via SMS"
                                    : client.email
                                      ? "Share Quiz Link Via Email"
                                      : "Add Phone or Email to Share"
                                  : client.phone
                                    ? "Request Quiz Via SMS"
                                    : client.email
                                      ? "Request Quiz Via Email"
                                      : "Add Phone or Email to Request From Patient"
                              }
                            >
                              {skincareQuiz ? "Share" : "Request With Patient"}
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
                                  {
                                    GEMSTONE_BY_SKIN_TYPE[skincareQuiz.result]
                                      .name
                                  }{" "}
                                  {
                                    GEMSTONE_BY_SKIN_TYPE[skincareQuiz.result]
                                      .emoji
                                  }{" "}
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
                              const routineSections =
                                buildQuizSkincareRoutineSections(
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
                                      data-routine={section.id}
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
                                                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
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
                                const maxScore = Math.max(
                                  ...Object.values(scores),
                                  1,
                                );
                                return (
                                  <div className="skin-analysis-score-bars">
                                    <span className="skin-analysis-score-bars-title">
                                      Score breakdown
                                    </span>
                                    {SKIN_TYPE_SCORE_ORDER.map((type) => {
                                      const value = scores[type] ?? 0;
                                      const pct =
                                        maxScore > 0
                                          ? (value / maxScore) * 100
                                          : 0;
                                      const isPrimary = false;
                                      const isSecondary = false;
                                      return (
                                        <div
                                          key={type}
                                          className="skin-analysis-score-row"
                                        >
                                          <span className="skin-analysis-score-label">
                                            {SKIN_TYPE_DISPLAY_LABELS[type]}
                                            {isPrimary && (
                                              <span className="skin-analysis-score-tag">
                                                {" "}
                                                primary
                                              </span>
                                            )}
                                            {isSecondary && (
                                              <span className="skin-analysis-score-tag">
                                                {" "}
                                                tendency
                                              </span>
                                            )}
                                          </span>
                                          <div className="skin-analysis-score-bar-wrap">
                                            <div
                                              className={`skin-analysis-score-bar ${isPrimary ? "skin-analysis-score-bar-primary" : ""} ${isSecondary ? "skin-analysis-score-bar-secondary" : ""}`}
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

                  {is3DSplit && client && (
                    <div className="detail-section detail-section-patient-files">
                      <PatientMediaLibraryPanel
                        client={client}
                        photoSlots={faceMirrorPhotoSlots}
                        turntableVideoUrl={glbUrl}
                        refreshKey={patientFilesRefreshKey}
                        onLoadAnnotation={(record: SavedPatientAnnotation) => {
                          window.dispatchEvent(
                            new CustomEvent("patient-annotation-load-request", {
                              detail: { clientId: client.id, record },
                            }),
                          );
                        }}
                      />
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
          </div>
        </div>,
        document.body,
      )}

      {/* Modals: portal to body so fixed overlays stack above the portaled detail panel (WebKit / mobile) */}
      {createPortal(
        <>
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
              onAddToPlanDirect={
                wellnestReplacesSkinQuizWithWellness
                  ? undefined
                  : appendDiscussedItemFromPrefill
              }
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
              recommenderFocusRegions={recommenderFocusRegions}
              onClose={() => setShowShareTreatmentPlanLink(false)}
              onSuccess={() => {
                setShowShareTreatmentPlanLink(false);
                onUpdate();
              }}
              onNavigateToEditPlanItem={handleShareLinkNavigateToPlanItem}
              onUpdateDiscussedItem={handleShareLinkUpdateDiscussedItem}
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
          {showSkinTypeQuiz &&
            client &&
            !wellnestReplacesSkinQuizWithWellness && (
            <SkinTypeQuizModal
              client={client}
              onClose={() => setShowSkinTypeQuiz(false)}
              onSuccess={onUpdate}
              darkTheme={darkMode}
              savedQuiz={skincareQuiz ?? undefined}
              providerName={
                formatProviderDisplayName(provider?.name) || provider?.name
              }
              filterBrand={isJudgeMdProviderCode(provider?.code) ? "SkinCeuticals" : undefined}
              onAddToPlan={async (prefill) => {
                const newItem: DiscussedItem = {
                  id: generateId(),
                  addedAt: new Date().toISOString(),
                  interest: prefill.interest?.trim() || undefined,
                  findings: prefill.findings?.length
                    ? prefill.findings
                    : undefined,
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
          {selectedSkinProduct &&
            client &&
            !wellnestReplacesSkinQuizWithWellness && (
            <SkinQuizProductModal
              product={selectedSkinProduct}
              onClose={() => setSelectedSkinProduct(null)}
              onAddToPlan={async (prefill) => {
                const newItem: DiscussedItem = {
                  id: generateId(),
                  addedAt: new Date().toISOString(),
                  interest: prefill.interest?.trim() || undefined,
                  findings: prefill.findings?.length
                    ? prefill.findings
                    : undefined,
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
          {showWellnessQuizSection && showWellnessQuiz && client && (
            <WellnessQuizModal
              client={client}
              onClose={() => setShowWellnessQuiz(false)}
              onSuccess={() => {
                setShowWellnessQuiz(false);
                onUpdate();
              }}
              savedQuiz={client.wellnessQuiz ?? undefined}
              onAddToPlan={
                wellnestReplacesSkinQuizWithWellness
                  ? undefined
                  : async (prefill) => {
                      const newItem: DiscussedItem = {
                        id: generateId(),
                        addedAt: new Date().toISOString(),
                        interest: prefill.interest?.trim() || undefined,
                        findings: prefill.findings?.length
                          ? prefill.findings
                          : undefined,
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
                    }
              }
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
                    e instanceof Error
                      ? e.message
                      : "Failed to remove from plan",
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
                if (
                  returnToOverviewView !== null &&
                  treatmentPreviewUiEnabled
                ) {
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
              onAddToPlanDirect={
                wellnestReplacesSkinQuizWithWellness
                  ? undefined
                  : async (prefill, options) => {
                      await appendDiscussedItemFromPrefill(prefill, options);
                      setIssuePhotosContext(null);
                    }
              }
              planItems={client.discussedItems ?? []}
            />
          )}
        </>,
        document.body,
      )}
    </>
  );
}
