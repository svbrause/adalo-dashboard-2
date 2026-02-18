// Client Detail Panel Component - Side panel version (non-modal)

import { useState, useEffect, useRef } from "react";
import { Client, DiscussedItem } from "../../types";
import { formatDate, formatRelativeDate } from "../../utils/dateFormatting";
import {
  formatFacialStatusForDisplay,
  getFacialStatusColorForDisplay,
  hasInterestedTreatments,
} from "../../utils/statusFormatting";
import { updateLeadRecord } from "../../services/api";
import { archiveClient } from "../../services/contactHistory";
import { showToast, showError } from "../../utils/toast";
import ContactHistorySection from "../modals/ContactHistorySection";
import AnalysisResultsSection from "../modals/AnalysisResultsSection";
import TelehealthSMSModal from "../modals/TelehealthSMSModal";
import ShareAnalysisModal from "../modals/ShareAnalysisModal";
import ShareTreatmentPlanModal from "../modals/ShareTreatmentPlanModal";
import PhotoViewerModal from "../modals/PhotoViewerModal";
import NewClientSMSModal from "../modals/NewClientSMSModal";
import SendSMSModal from "../modals/SendSMSModal";
import DiscussedTreatmentsModal from "../modals/DiscussedTreatmentsModal";
import TreatmentPhotosModal from "../modals/TreatmentPhotosModal";
import AnalysisOverviewModal, { type DetailView } from "../modals/AnalysisOverviewModal";
import type { TreatmentPlanPrefill } from "../modals/DiscussedTreatmentsModal/TreatmentPhotos";
import TreatmentRecommenderByTreatment from "../treatmentRecommender/TreatmentRecommenderByTreatment";
import TreatmentRecommenderBySuggestion from "../treatmentRecommender/TreatmentRecommenderBySuggestion";
import { formatTreatmentPlanRecordMetaLine, getTreatmentDisplayName, generateId } from "../modals/DiscussedTreatmentsModal/utils";
import { PLAN_SECTIONS, AIRTABLE_FIELD } from "../modals/DiscussedTreatmentsModal/constants";
import {
  getJotformUrl,
  formatProviderDisplayName,
} from "../../utils/providerHelpers";
import { splitName, cleanPhoneNumber } from "../../utils/validation";
import {
  mapAreasToFormFields,
  mapSkinComplaints,
} from "../../utils/formMapping";
import {
  shouldLoadPhotoForClient,
  fetchClientFrontPhoto,
} from "../../utils/photoLoading";
import { formatPhoneInput, formatZipCodeInput } from "../../utils/validation";
import { useDashboard } from "../../context/DashboardContext";
import "./ClientDetailPanel.css";

interface ClientDetailPanelProps {
  client: Client | null;
  onClose: () => void;
  onUpdate: () => void;
}

export default function ClientDetailPanel({
  client,
  onClose,
  onUpdate,
}: ClientDetailPanelProps) {
  const { provider } = useDashboard();
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedClient, setEditedClient] = useState<Partial<Client> | null>(
    null
  );
  // Status state - kept for potential future use
  // const [status, setStatus] = useState<Client["status"]>("new");
  const [showTelehealthSMS, setShowTelehealthSMS] = useState(false);
  const [showShareAnalysis, setShowShareAnalysis] = useState(false);
  const [showShareTreatmentPlan, setShowShareTreatmentPlan] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [photoViewerType, setPhotoViewerType] = useState<"front" | "side">(
    "front"
  );
  const [frontPhotoUrl, setFrontPhotoUrl] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [showScanDropdown, setShowScanDropdown] = useState(false);
  const [showNewClientSMS, setShowNewClientSMS] = useState(false);
  const [showSendSMS, setShowSendSMS] = useState(false);
  const [showDiscussedTreatments, setShowDiscussedTreatments] = useState(false);
  const [showAnalysisOverview, setShowAnalysisOverview] = useState(false);
  const [returnToOverviewView, setReturnToOverviewView] = useState<DetailView | null>(null);
  const [initialAddFormPrefill, setInitialAddFormPrefill] =
    useState<TreatmentPlanPrefill | null>(null);
  const [initialEditingItem, setInitialEditingItem] = useState<DiscussedItem | null>(null);
  const [issuePhotosContext, setIssuePhotosContext] = useState<{
    issue?: string;
    region?: string;
    interest?: string;
  } | null>(null);
  const [recommenderMode, setRecommenderMode] = useState<"by-treatment" | "by-suggestion" | null>(null);
  const scanDropdownRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  /** Called when treatment plan modal closes so recommenders can clear "just added" state */
  const treatmentPlanModalClosedRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (client) {
      setEditedClient({ ...client });
      // setStatus(client.status);

      // Load front photo if available and should be loaded
      let photoUrl: string | null = null;
      if (
        client.frontPhoto &&
        Array.isArray(client.frontPhoto) &&
        client.frontPhoto.length > 0
      ) {
        const attachment = client.frontPhoto[0];
        photoUrl =
          attachment.thumbnails?.large?.url ||
          attachment.thumbnails?.full?.url ||
          attachment.url;
        setFrontPhotoUrl(photoUrl);
      } else if (
        client.tableSource === "Patients" &&
        !client.frontPhotoLoaded &&
        shouldLoadPhotoForClient(client)
      ) {
        // Fetch photo on demand
        setPhotoLoading(true);
        fetchClientFrontPhoto(client.id)
          .then((photo) => {
            if (photo && Array.isArray(photo) && photo.length > 0) {
              const attachment = photo[0];
              const url =
                attachment.thumbnails?.large?.url ||
                attachment.thumbnails?.full?.url ||
                attachment.url;
              setFrontPhotoUrl(url);
            }
            setPhotoLoading(false);
          })
          .catch(() => {
            setPhotoLoading(false);
          });
      }
    }
  }, [client]);

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
          !showNewClientSMS &&
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
    showNewClientSMS,
    showSendSMS,
    showDiscussedTreatments,
    issuePhotosContext,
  ]);

  if (!client) return null;

  const lastActivityRelative = client.lastContact
    ? formatRelativeDate(client.lastContact)
    : client.createdAt
    ? formatRelativeDate(client.createdAt)
    : "No activity yet";

  const handleSave = async () => {
    if (!editedClient || !client) return;

    try {
      await updateLeadRecord(client.id, client.tableSource, {
        Name: editedClient.name,
        Email:
          client.tableSource === "Patients" ? editedClient.email : undefined,
        "Email Address":
          client.tableSource === "Web Popup Leads"
            ? editedClient.email
            : undefined,
        Phone:
          client.tableSource === "Web Popup Leads"
            ? editedClient.phone
            : undefined,
        "Patient Phone Number":
          client.tableSource === "Patients" ? editedClient.phone : undefined,
        "Zip Code": editedClient.zipCode || null,
        Age: editedClient.age || null,
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
    setEditedClient({ ...client });
    setIsEditMode(false);
  };

  // Status change handler - currently unused but kept for potential future use
  // const handleStatusChange = async (newStatus: Client["status"]) => {
  //   try {
  //     await updateClientStatus(client, newStatus);
  //     setStatus(newStatus);
  //     showToast(`Status updated to ${newStatus}`);
  //     onUpdate();
  //   } catch (error: any) {
  //     showError(error.message || "Failed to update status");
  //   }
  // };

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
    const providerName = formatProviderDisplayName(provider?.name) || "We";
    const { first, last } = splitName(client.name);
    const phoneNumber = cleanPhoneNumber(client.phone);
    const { whatAreas, faceRegions } = mapAreasToFormFields(client);
    const skinComplaints = mapSkinComplaints(client);

    const params: string[] = [];
    params.push(`provider=${encodeURIComponent(providerName)}`);
    if (first) params.push(`name[first]=${encodeURIComponent(first)}`);
    if (last) params.push(`name[last]=${encodeURIComponent(last)}`);
    if (client.email) params.push(`email=${encodeURIComponent(client.email)}`);
    if (phoneNumber)
      params.push(`phoneNumber=${encodeURIComponent(phoneNumber)}`);
    if (client.zipCode)
      params.push(`zipCode=${encodeURIComponent(client.zipCode)}`);
    if (whatAreas.length > 0)
      params.push(`whatAreas=${encodeURIComponent(whatAreas.join(","))}`);
    if (faceRegions.length > 0)
      params.push(`faceRegions=${encodeURIComponent(faceRegions.join(","))}`);
    if (skinComplaints.length > 0)
      params.push(
        `skinComplaints=${encodeURIComponent(skinComplaints.join(","))}`
      );
    params.push(
      `source=${encodeURIComponent("Provider Dashboard - In-Clinic Scan")}`
    );

    const formUrl = `${getJotformUrl(provider)}?${params.join("&")}`;
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
        (Array.isArray(client.concernsExplored) &&
        client.concernsExplored.length > 0
          ? client.concernsExplored.join(", ")
          : typeof client.concernsExplored === "string"
          ? (client.concernsExplored as string).trim()
          : String(client.concernsExplored || ""))) ||
      client.offerClaimed);

  const facialAnalysisFormHasData =
    hasFacialAnalysisForm &&
    (client.age ||
      (client.aestheticGoals &&
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
      client.facialAnalysisStatus ||
      client.allIssues ||
      client.interestedIssues);

  // Import the rest of the component content from ClientDetailModal
  // This is a large component, so I'll need to copy the JSX structure
  // but adapt it for a panel instead of modal

  return (
    <>
      <div className="client-detail-panel" ref={panelRef}>
        <div className="client-detail-panel-header">
          <div className="client-detail-panel-header-info">
            {recommenderMode && (
              <button
                type="button"
                className="client-detail-panel-back"
                onClick={() => setRecommenderMode(null)}
              >
                ← Back to client
              </button>
            )}
            <div className="client-detail-panel-header-name-row">
              <h2 className="client-detail-panel-title">{client.name}</h2>
              {recommenderMode && (
                <span className="client-detail-panel-header-subtitle">
                  Treatment recommender ({recommenderMode === "by-treatment" ? "by treatment" : "by suggestion"})
                </span>
              )}
              {!recommenderMode && (
                <div className="modal-header-activity-badge client-detail-panel-activity-inline">
                  <span className="modal-header-activity-label">
                    Last Activity:
                  </span>
                  <span className="modal-header-activity-value">
                    {lastActivityRelative}
                  </span>
                </div>
              )}
            </div>
          </div>
          <button className="client-detail-panel-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="client-detail-panel-scroll">
          <div className={`client-detail-panel-body${recommenderMode ? " client-detail-panel-body--recommender" : ""}`}>
          {recommenderMode === "by-treatment" && client && (
            <TreatmentRecommenderByTreatment
              client={client}
              onBack={() => setRecommenderMode(null)}
              onUpdate={onUpdate}
              onAddToPlanDirect={async (prefill) => {
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
                  await updateLeadRecord(client.id, client.tableSource, {
                    [AIRTABLE_FIELD]: JSON.stringify(nextItems),
                  });
                  showToast("Added to treatment plan");
                  onUpdate();
                  return newItem;
                } catch (e) {
                  showError(e instanceof Error ? e.message : "Failed to add to plan");
                  throw e;
                }
              }}
              onOpenTreatmentPlan={() => {
                setShowDiscussedTreatments(true);
                setInitialAddFormPrefill(null);
                setInitialEditingItem(null);
              }}
              onOpenTreatmentPlanWithPrefill={(prefill) => {
                setInitialAddFormPrefill(prefill);
                setInitialEditingItem(null);
                setShowDiscussedTreatments(true);
              }}
              onOpenTreatmentPlanWithItem={(item) => {
                setInitialEditingItem(item);
                setInitialAddFormPrefill(null);
                setShowDiscussedTreatments(true);
              }}
              treatmentPlanModalClosedRef={treatmentPlanModalClosedRef}
            />
          )}
          {recommenderMode === "by-suggestion" && client && (
            <TreatmentRecommenderBySuggestion
              client={client}
              onBack={() => setRecommenderMode(null)}
              onUpdate={onUpdate}
              onAddToPlanDirect={async (prefill) => {
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
                  await updateLeadRecord(client.id, client.tableSource, {
                    [AIRTABLE_FIELD]: JSON.stringify(nextItems),
                  });
                  showToast("Added to treatment plan");
                  onUpdate();
                  return newItem;
                } catch (e) {
                  showError(e instanceof Error ? e.message : "Failed to add to plan");
                  throw e;
                }
              }}
              onOpenTreatmentPlan={() => {
                setShowDiscussedTreatments(true);
                setInitialAddFormPrefill(null);
                setInitialEditingItem(null);
              }}
              onOpenTreatmentPlanWithPrefill={(prefill) => {
                setInitialAddFormPrefill(prefill);
                setInitialEditingItem(null);
                setShowDiscussedTreatments(true);
              }}
              onOpenTreatmentPlanWithItem={(item) => {
                setInitialEditingItem(item);
                setInitialAddFormPrefill(null);
                setShowDiscussedTreatments(true);
              }}
              treatmentPlanModalClosedRef={treatmentPlanModalClosedRef}
            />
          )}
          {!recommenderMode ? (
            <div className="client-detail-panel-main">
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
                <div className="modal-photo-loading-text">Loading photo...</div>
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
                <button
                  className="edit-toggle-btn"
                  onClick={() => setIsEditMode(true)}
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
                  {client.phone && (
                    <div className="detail-item">
                      <label>Phone</label>
                      {isEditMode ? (
                        <input
                          type="tel"
                          value={editedClient?.phone || ""}
                          onChange={(e) => {
                            formatPhoneInput(e.target);
                            setEditedClient({
                              ...editedClient,
                              phone: e.target.value,
                            });
                          }}
                          className="edit-input"
                        />
                      ) : (
                        <div className="detail-value">{client.phone}</div>
                      )}
                    </div>
                  )}
                  {client.ageRange && (
                    <div className="detail-item">
                      <label>Age Range</label>
                      <div className="detail-value">{client.ageRange}</div>
                    </div>
                  )}
                  {client.age && !client.ageRange && (
                    <div className="detail-item">
                      <label>Age</label>
                      <div className="detail-value">{client.age} years old</div>
                    </div>
                  )}
                  {client.dateOfBirth && (
                    <div className="detail-item">
                      <label>Date of Birth</label>
                      <div className="detail-value">
                        {formatDate(client.dateOfBirth)}
                      </div>
                    </div>
                  )}
                  {client.source && (
                    <div className="detail-item">
                      <label>Source</label>
                      {isEditMode ? (
                        <select
                          value={editedClient?.source || ""}
                          onChange={(e) =>
                            setEditedClient({
                              ...editedClient,
                              source: e.target.value,
                            })
                          }
                          className="edit-input"
                        >
                          <option value="Walk-in">Walk-in</option>
                          <option value="Phone Call">Phone Call</option>
                          <option value="Referral">Referral</option>
                          <option value="Social Media">Social Media</option>
                          <option value="Website">Website</option>
                          <option value="AI Consult">AI Consult Tool</option>
                          <option value="Other">Other</option>
                        </select>
                      ) : (
                        <div className="detail-value">{client.source}</div>
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
                                client.appointmentStaffName
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  {client.zipCode && (
                    <div className="detail-item">
                      <label>Zip Code</label>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={editedClient?.zipCode || ""}
                          maxLength={5}
                          onInput={(e) => {
                            formatZipCodeInput(e.target as HTMLInputElement);
                            setEditedClient({
                              ...editedClient,
                              zipCode: (e.target as HTMLInputElement).value,
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
                        <div className="detail-value">{client.zipCode}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {!isEditMode && (
                <div className="contact-actions-bar">
                  <div className="contact-actions-heading">Contact</div>
                  <div className="contact-actions-buttons">
                    <button
                      className="btn-secondary btn-sm"
                      onClick={handleCall}
                      disabled={!client.phone}
                    >
                      Call
                    </button>
                    <button
                      className="btn-secondary btn-sm"
                      onClick={handleEmail}
                      disabled={!client.email}
                    >
                      Email
                    </button>
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() => setShowSendSMS(true)}
                      disabled={!client.phone}
                    >
                      SMS
                    </button>
                  </div>
                </div>
              )}
              {isEditMode && (
                <div className="edit-actions">
                  <button
                    className="btn-secondary btn-sm"
                    onClick={handleCancel}
                  >
                    Cancel
                  </button>
                  <button className="btn-primary btn-sm" onClick={handleSave}>
                    Save Changes
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Web Popup Leads Form Section */}
          {webPopupFormHasData && (
            <div className="detail-section detail-section-with-border">
              <div className="detail-section-title detail-section-title-flex">
                <span>Online Treatment Finder</span>
              </div>

              {((typeof client.concerns === "string" &&
                client.concerns.trim()) ||
                (Array.isArray(client.concerns) &&
                  client.concerns.length > 0) ||
                (client.areas && client.areas.length > 0)) && (
                <div className="detail-grid-custom">
                  {((typeof client.concerns === "string" &&
                    client.concerns.trim()) ||
                    (Array.isArray(client.concerns) &&
                      client.concerns.length > 0)) && (
                    <div>
                      <div className="detail-label">Concerns</div>
                      <div className="detail-tags-container">
                        {(typeof client.concerns === "string"
                          ? client.concerns
                              .split(",")
                              .map((c) => c.trim())
                              .filter((c) => c)
                          : Array.isArray(client.concerns)
                          ? client.concerns
                          : []
                        ).map((c, i) => (
                          <span key={i} className="detail-tag">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {client.areas && client.areas.length > 0 && (
                    <div>
                      <div className="detail-label">Focus Areas</div>
                      <div className="detail-tags-container">
                        {(Array.isArray(client.areas)
                          ? client.areas
                          : [client.areas]
                        ).map((a, i) => (
                          <span key={i} className="detail-tag">
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(client.skinType ||
                client.skinTone ||
                client.ethnicBackground) && (
                <div className="detail-section-spacing">
                  <div className="detail-label">Demographics</div>
                  <div className="detail-grid detail-grid-demographics">
                    {client.skinType && (
                      <div className="detail-item">
                        <label className="detail-label-small">Skin Type</label>
                        <div className="detail-value detail-value-small">
                          {client.skinType && client.skinType.length > 0
                            ? client.skinType.charAt(0).toUpperCase() +
                              client.skinType.slice(1)
                            : client.skinType}
                        </div>
                      </div>
                    )}
                    {client.skinTone && (
                      <div className="detail-item">
                        <label className="detail-label-small">Skin Tone</label>
                        <div className="detail-value detail-value-small">
                          {client.skinTone && client.skinTone.length > 0
                            ? client.skinTone.charAt(0).toUpperCase() +
                              client.skinTone.slice(1)
                            : client.skinTone}
                        </div>
                      </div>
                    )}
                    {client.ethnicBackground && (
                      <div className="detail-item">
                        <label className="detail-label-small">
                          Ethnic Background
                        </label>
                        <div className="detail-value detail-value-small">
                          {client.ethnicBackground &&
                          client.ethnicBackground.length > 0
                            ? client.ethnicBackground.charAt(0).toUpperCase() +
                              client.ethnicBackground.slice(1)
                            : client.ethnicBackground}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {client.aestheticGoals &&
                (typeof client.aestheticGoals === "string"
                  ? client.aestheticGoals.trim()
                  : String(client.aestheticGoals).trim()) &&
                client.tableSource === "Web Popup Leads" && (
                  <div className="detail-section-spacing">
                    <div className="detail-label">Patient Goals</div>
                    <div className="detail-goals-box">
                      "{client.aestheticGoals}"
                    </div>
                  </div>
                )}

              {client.offerClaimed && (
                <div className="detail-section-spacing">
                  <div className="detail-label">Offer Status</div>
                  <div className="detail-offer-claimed-box">
                    <div className="detail-offer-claimed-content">
                      <span className="detail-offer-claimed-icon">✓</span>
                      <strong className="detail-offer-claimed-text">
                        $50 Off Offer Claimed
                      </strong>
                    </div>
                  </div>
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
                  {facialAnalysisFormHasData && client.facialAnalysisStatus && (
                    <span
                      className="status-badge detail-status-badge-dynamic"
                      style={{
                        background: getFacialStatusColorForDisplay(
                          client.facialAnalysisStatus,
                          hasInterestedTreatments(client)
                        ),
                      }}
                    >
                      {formatFacialStatusForDisplay(
                        client.facialAnalysisStatus,
                        hasInterestedTreatments(client)
                      )}
                    </span>
                  )}
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
                  <div className="scan-client-dropdown" ref={scanDropdownRef}>
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
                  <div className="detail-empty-state-text">
                    Request a facial analysis scan for this client using the
                    "Scan Patient" button above.
                  </div>
                ) : (
                  <div className="detail-empty-center">
                    This patient has not completed the Facial Analysis form.
                  </div>
                )}
              </div>
            )}

            {/* Treatments discussed in clinic (in reference to analysis findings & interests) */}
            <div className="discussed-treatments-in-facial-section">
              <div className="discussed-treatments-in-facial-title-row">
                <div className="discussed-treatments-in-facial-heading-block">
                  <span className="discussed-treatments-in-facial-heading">
                    Treatment plan
                  </span>
                  <span className="discussed-treatments-in-facial-subheading">
                    In reference to analysis findings & interests
                  </span>
                </div>
                <div className="discussed-treatments-in-facial-actions">
                  {facialAnalysisFormHasData && (
                    <>
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => setShowShareTreatmentPlan(true)}
                      >
                        Share with Patient
                      </button>
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRecommenderMode("by-treatment");
                        }}
                      >
                        Recommender (by treatment)
                      </button>
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRecommenderMode("by-suggestion");
                        }}
                      >
                        Recommender (by suggestion)
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => setShowDiscussedTreatments(true)}
                  >
                    {client.discussedItems && client.discussedItems.length > 0
                      ? "Manage"
                      : "Add"}
                  </button>
                </div>
              </div>
              <div className="discussed-treatments-in-facial-summary-row">
                {client.discussedItems && client.discussedItems.length > 0 ? (
                  <div className="discussed-treatments-plan-sections-outer">
                    {PLAN_SECTIONS.map((sectionLabel) => {
                        const sectionItems = (client.discussedItems || [])
                          .filter((item) => {
                            const t = item.timeline?.trim();
                            if (sectionLabel === "Now") return t === "Now";
                            if (sectionLabel === "Add next visit")
                              return t === "Add next visit";
                            if (sectionLabel === "Completed") return t === "Completed";
                            return t === "Wishlist" || !t; // Wishlist or empty
                          })
                          .sort((a, b) =>
                            (a.treatment || "").localeCompare(b.treatment || "")
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
                              {sectionItems.map((item) => (
                                <div
                                  key={item.id}
                                  className="discussed-treatments-record-row-outer discussed-treatments-record-row-heading-meta"
                                >
                                  <div className="discussed-treatments-record-treatment-heading-outer">
                                    {getTreatmentDisplayName(item)}
                                  </div>
                                  {formatTreatmentPlanRecordMetaLine(item) ? (
                                    <div className="discussed-treatments-record-meta-line-outer">
                                      {formatTreatmentPlanRecordMetaLine(item)}
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                ) : (
                  <span className="discussed-treatments-in-facial-summary">
                    None
                  </span>
                )}
              </div>
            </div>
          </div>

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
                <div className="detail-section-title">Conversion Details</div>
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
      </div>

      {/* Modals */}

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
      {showAnalysisOverview && client && (
        <AnalysisOverviewModal
          client={client}
          onClose={() => {
            setShowAnalysisOverview(false);
            setReturnToOverviewView(null);
          }}
          initialDetailView={returnToOverviewView ?? undefined}
          onAddToPlan={(prefill, detailView) => {
            setShowAnalysisOverview(false);
            setReturnToOverviewView(detailView ?? null);
            setInitialAddFormPrefill(prefill);
            setShowDiscussedTreatments(true);
          }}
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
      {showPhotoViewer && client && (
        <PhotoViewerModal
          client={client}
          initialPhotoType={photoViewerType}
          onClose={() => setShowPhotoViewer(false)}
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
      {showSendSMS && client && (
        <SendSMSModal
          client={client}
          onClose={() => setShowSendSMS(false)}
          onSuccess={() => {
            setShowSendSMS(false);
            onUpdate();
          }}
        />
      )}
      {showDiscussedTreatments && client && (
        <DiscussedTreatmentsModal
          client={client}
          onClose={() => {
            setShowDiscussedTreatments(false);
            setInitialAddFormPrefill(null);
            setInitialEditingItem(null);
            treatmentPlanModalClosedRef.current?.();
            onUpdate();
            if (returnToOverviewView !== null) {
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
          onAddToPlanDirect={async (prefill) => {
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
            await updateLeadRecord(client.id, client.tableSource, {
              [AIRTABLE_FIELD]: JSON.stringify(nextItems),
            });
            showToast("Added to treatment plan");
            setIssuePhotosContext(null);
            onUpdate();
          }}
          planItems={client.discussedItems ?? []}
        />
      )}
    </>
  );
}
