// Facial Analysis View Component (Card Grid)

import { useState, useMemo, useEffect } from "react";
import { useDashboard } from "../../context/DashboardContext";
import ClientDetailPanel from "./ClientDetailPanel";
import PatientIssuesModal from "../modals/PatientIssuesModal";
import TreatmentPhotosModal from "../modals/TreatmentPhotosModal";
import { getIssueArea } from "../../utils/issueMapping";
import Pagination from "../common/Pagination";
import { formatRelativeDate } from "../../utils/dateFormatting";
import { formatPhoneDisplay } from "../../utils/validation";
import {
  formatFacialStatusForDisplay,
  getFacialStatusColorForDisplay,
  getFacialStatusBorderColorForDisplay,
  hasInterestedTreatments,
} from "../../utils/statusFormatting";
import { applyFilters, applySorting } from "../../utils/filtering";
// Unused imports - kept for potential future drag-and-drop functionality
// import { updateFacialAnalysisStatus } from '../../services/api';
// import { showToast, showError } from '../../utils/toast';
import { preloadVisiblePhotos } from "../../utils/photoLoading";
import "./FacialAnalysisView.css";

export default function FacialAnalysisView() {
  const {
    clients,
    searchQuery,
    filters,
    sort,
    pagination,
    setPagination,
    loading,
    refreshClients,
    provider,
    effectiveProviderIds,
  } = useDashboard();
  const [selectedClient, setSelectedClient] = useState<
    (typeof clients)[0] | null
  >(null);
  const [showPatientIssues, setShowPatientIssues] = useState<
    (typeof clients)[0] | null
  >(null);
  const [issuePhotosContext, setIssuePhotosContext] = useState<{
    client: (typeof clients)[0];
    issue?: string;
    region?: string;
    interest?: string;
  } | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [draggedClientId, setDraggedClientId] = useState<string | null>(null);
  const [clientPhotos, setClientPhotos] = useState<Record<string, string>>({});

  // Filter and sort clients
  const processedClients = useMemo(() => {
    let filtered = clients.filter((client) => !client.archived);
    filtered = applyFilters(filtered, filters, searchQuery);
    filtered = applySorting(filtered, sort);
    return filtered;
  }, [clients, filters, searchQuery, sort]);

  // Paginate
  const paginatedClients = useMemo(() => {
    const startIndex = (pagination.currentPage - 1) * pagination.itemsPerPage;
    const endIndex = startIndex + pagination.itemsPerPage;
    return processedClients.slice(startIndex, endIndex);
  }, [processedClients, pagination]);

  const totalPages = Math.ceil(
    processedClients.length / pagination.itemsPerPage,
  );

  // Load photos for visible clients using batch loading
  useEffect(() => {
    if (paginatedClients.length === 0 || !provider?.id) return;

    // Helper function to extract photo URL from frontPhoto (handles both array and JSON string)
    const extractPhotoUrl = (frontPhoto: any): string | null => {
      if (!frontPhoto) return null;

      let frontPhotoArray: any[] | null = null;
      if (Array.isArray(frontPhoto)) {
        frontPhotoArray = frontPhoto;
      } else if (typeof frontPhoto === "string") {
        try {
          const parsed = JSON.parse(frontPhoto);
          if (Array.isArray(parsed)) {
            frontPhotoArray = parsed;
          }
        } catch (e) {
          // Not JSON, ignore
        }
      }

      if (frontPhotoArray && frontPhotoArray.length > 0) {
        const attachment = frontPhotoArray[0];
        return (
          attachment.thumbnails?.large?.url ||
          attachment.thumbnails?.full?.url ||
          attachment.url ||
          null
        );
      }
      return null;
    };

    // First, extract photos that are already in client data
    const updatedPhotos: Record<string, string> = {};
    paginatedClients.forEach((client) => {
      const url = extractPhotoUrl(client.frontPhoto);
      if (url) {
        updatedPhotos[client.id] = url;
      }
    });
    if (Object.keys(updatedPhotos).length > 0) {
      setClientPhotos((prev) => ({ ...prev, ...updatedPhotos }));
    }

    // Then, load photos for clients that don't have them yet
    const timeout = setTimeout(async () => {
      const providerIdParam =
        effectiveProviderIds.length > 0
          ? effectiveProviderIds.join(",")
          : provider.id;
      await preloadVisiblePhotos(paginatedClients, providerIdParam);
      // Update local photo state from loaded client photos after preload
      const postLoadPhotos: Record<string, string> = {};
      paginatedClients.forEach((client) => {
        const url = extractPhotoUrl(client.frontPhoto);
        if (url) {
          postLoadPhotos[client.id] = url;
        }
      });
      if (Object.keys(postLoadPhotos).length > 0) {
        setClientPhotos((prev) => ({ ...prev, ...postLoadPhotos }));
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [paginatedClients, provider?.id, effectiveProviderIds]);

  const toggleCardExpansion = (clientId: string) => {
    setExpandedCardId(expandedCardId === clientId ? null : clientId);
  };

  const handleCardClick = (
    client: (typeof clients)[0],
    e: React.MouseEvent,
  ) => {
    // Don't open modal if clicking expand button
    if ((e.target as HTMLElement).closest(".expand-card-btn")) {
      return;
    }
    // For Patients with facial analysis data, show Patient Issues Modal
    if (client.tableSource === "Patients" && client.allIssues) {
      setShowPatientIssues(client);
    } else {
      setSelectedClient(client);
    }
  };

  const handleDragStart = (e: React.DragEvent, clientId: string) => {
    setDraggedClientId(clientId);
    e.dataTransfer.effectAllowed = "move";
    e.currentTarget.classList.add("dragging");
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("dragging");
    setDraggedClientId(null);
  };

  // Drag handlers - currently unused but kept for potential future drag-and-drop functionality
  // const handleDragOver = (e: React.DragEvent) => {
  //   e.preventDefault();
  //   e.currentTarget.classList.add('drag-over');
  // };

  // const handleDragLeave = (e: React.DragEvent) => {
  //   e.currentTarget.classList.remove('drag-over');
  // };

  // Drag and drop handler - currently unused but kept for potential future use
  // const handleDrop = async (e: React.DragEvent, newStatus: string) => {
  //   e.preventDefault();
  //   e.currentTarget.classList.remove('drag-over');
  //
  //   if (!draggedClientId) return;
  //
  //   const client = clients.find(c => c.id === draggedClientId);
  //   if (!client || client.tableSource !== 'Patients') {
  //     setDraggedClientId(null);
  //     if (client && client.tableSource === 'Web Popup Leads') {
  //       showError('Web Popup Leads cannot be moved to other statuses. They must be in the Patients table first.');
  //     }
  //     return;
  //   }
  //
  //   try {
  //     const airtableStatus = newStatus === 'not-started' ? '' : newStatus;
  //     await updateFacialAnalysisStatus(client.id, airtableStatus);
  //     showToast(`Moved ${client.name} to ${formatFacialStatus(airtableStatus)}`);
  //     refreshClients();
  //   } catch (error: any) {
  //     showError(error.message || 'Failed to update facial analysis status');
  //   } finally {
  //     setDraggedClientId(null);
  //   }
  // };

  if (loading) {
    return (
      <section className="facial-analysis-view">
        <div className="loading-state-center">
          <div className="spinner spinner-with-margin"></div>
          Loading clients...
        </div>
      </section>
    );
  }

  if (processedClients.length === 0) {
    return (
      <section className="facial-analysis-view">
        <div className="empty-state-center">
          <p className="empty-state-text">
            {clients.length === 0
              ? "No clients yet."
              : searchQuery ||
                  Object.values(filters).some((v) => v !== "" && v !== null)
                ? "No clients found matching your search or filters."
                : "No active clients to display."}
          </p>
        </div>
      </section>
    );
  }

  // Pre-process client data to avoid expensive operations during render
  const processedClientsData = useMemo(() => {
    return paginatedClients.map((client) => {
      const isPatient = client.tableSource === "Patients";

      // Parse issues
      const allIssues =
        isPatient && client.allIssues
          ? typeof client.allIssues === "string"
            ? client.allIssues
                .split(",")
                .map((i) => i.trim())
                .filter((i) => i)
            : []
          : [];
      const interestedIssues =
        isPatient && client.interestedIssues
          ? typeof client.interestedIssues === "string"
            ? client.interestedIssues
                .split(",")
                .map((i) => i.trim())
                .filter((i) => i)
            : []
          : [];
      const whichRegions =
        isPatient && client.whichRegions ? client.whichRegions : "";
      const skinComplaints =
        isPatient && client.skinComplaints ? client.skinComplaints : "";
      const processedAreas =
        isPatient && client.processedAreasOfInterest
          ? typeof client.processedAreasOfInterest === "string"
            ? client.processedAreasOfInterest
                .split(",")
                .map((a) => a.trim())
                .filter((a) => a)
            : []
          : [];

      const hasFacialAnalysisData =
        isPatient &&
        (allIssues.length > 0 ||
          interestedIssues.length > 0 ||
          whichRegions ||
          skinComplaints ||
          processedAreas.length > 0);

      const findings =
        typeof client.concerns === "string"
          ? client.concerns
              .split(",")
              .map((c) => c.trim())
              .filter((c) => c)
          : Array.isArray(client.concerns)
            ? client.concerns
            : [];
      const interests = client.goals || [];

      const cardDate =
        client.lastContact || client.createdAt || new Date().toISOString();
      const borderColor = getFacialStatusBorderColorForDisplay(
        client.facialAnalysisStatus,
        hasInterestedTreatments(client),
      );

      return {
        client,
        isPatient,
        allIssues,
        interestedIssues,
        whichRegions,
        skinComplaints,
        processedAreas,
        hasFacialAnalysisData,
        findings,
        interests,
        cardDate,
        borderColor,
      };
    });
  }, [paginatedClients]);

  return (
    <section className="facial-analysis-view">
      <div className="facial-analysis-cards-grid">
        {processedClientsData.map(
          ({
            client,
            isPatient,
            allIssues,
            interestedIssues,
            whichRegions: _whichRegions,
            skinComplaints,
            processedAreas,
            hasFacialAnalysisData,
            findings,
            interests,
            cardDate,
            borderColor,
          }) => {
            const isExpanded = expandedCardId === client.id;

            return (
              <div
                key={client.id}
                className={`facial-analysis-card ${isExpanded ? "expanded" : ""} ${draggedClientId === client.id ? "dragging" : ""}`}
                style={{ borderLeftColor: borderColor }}
                draggable={client.tableSource === "Patients"}
                onDragStart={(e) =>
                  client.tableSource === "Patients" &&
                  handleDragStart(e, client.id)
                }
                onDragEnd={handleDragEnd}
                onClick={(e) => handleCardClick(client, e)}
              >
                <div className="facial-card-content">
                  <div className="facial-card-photo-container">
                    <div className="facial-card-photo">
                      {clientPhotos[client.id] ? (
                        <img
                          src={clientPhotos[client.id]}
                          alt={client.name}
                          loading="lazy"
                          className="facial-card-photo-img"
                        />
                      ) : (
                        <div className="facial-card-photo-placeholder">
                          {client.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="facial-card-status">
                      <span
                        className="status-badge status-badge-base"
                        style={{
                          background: getFacialStatusColorForDisplay(
                            client.facialAnalysisStatus,
                            hasInterestedTreatments(client),
                          ),
                        }}
                      >
                        {formatFacialStatusForDisplay(
                          client.facialAnalysisStatus,
                          hasInterestedTreatments(client),
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="facial-card-details">
                    <div className="facial-card-name">{client.name}</div>
                    <div className="facial-card-info">
                      <div className="facial-card-email">
                        {client.email || "No email"}
                      </div>
                      {client.phone && (
                        <div className="facial-card-phone">{formatPhoneDisplay(client.phone)}</div>
                      )}
                      <div className="facial-card-date">
                        {formatRelativeDate(cardDate)}
                      </div>
                    </div>
                  </div>
                  <button
                    className="expand-card-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCardExpansion(client.id);
                    }}
                  >
                    {isExpanded ? "▼" : "▶"}
                  </button>
                </div>
                {isExpanded && (
                  <div className="facial-card-expanded">
                    {isPatient && hasFacialAnalysisData ? (
                      <>
                        {allIssues.length > 0 && (
                          <div className="facial-card-section">
                            <div className="facial-card-section-title">
                              Issues Detected
                            </div>
                            <div className="facial-card-tags">
                              {allIssues.map((issueName, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  className="facial-tag facial-tag-button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIssuePhotosContext({
                                      client,
                                      issue: issueName,
                                      region: getIssueArea(issueName),
                                    });
                                  }}
                                >
                                  {issueName}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="facial-card-section">
                          <div className="facial-card-section-title">
                            Interested Treatments
                          </div>
                          {interestedIssues.length > 0 ? (
                            <div className="facial-card-tags">
                              {interestedIssues.map((interestName, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  className="facial-tag interest facial-tag-button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIssuePhotosContext({
                                      client,
                                      interest: interestName,
                                    });
                                  }}
                                >
                                  {interestName}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        {processedAreas.length > 0 && (
                          <div className="facial-card-section">
                            <div className="facial-card-section-title">
                              Focus Areas
                            </div>
                            <div className="facial-card-text facial-card-text-focus">
                              {processedAreas.join(", ")}
                            </div>
                          </div>
                        )}
                        {skinComplaints && (
                          <div className="facial-card-section">
                            <div className="facial-card-section-title">
                              Skin Complaints
                            </div>
                            <div className="facial-card-text">
                              {skinComplaints}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {findings.length > 0 || interests.length > 0 ? (
                          <>
                            {findings.length > 0 && (
                              <div className="facial-card-section">
                                <div className="facial-card-section-title">
                                  FOCUS AREAS
                                </div>
                                <div className="facial-card-tags">
                                  {findings.map((f, i) => (
                                    <span key={i} className="facial-tag">
                                      {f}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {interests.length > 0 && (
                              <div className="facial-card-section">
                                <div className="facial-card-section-title">
                                  Interests
                                </div>
                                <div className="facial-card-tags">
                                  {interests.map((i, idx) => (
                                    <span
                                      key={idx}
                                      className="facial-tag interest"
                                    >
                                      {i}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="facial-card-section">
                            <div className="facial-card-text facial-card-text-empty">
                              {isPatient
                                ? "No facial analysis data available yet."
                                : "No data recorded."}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          },
        )}
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={totalPages}
          totalItems={processedClients.length}
          itemsPerPage={pagination.itemsPerPage}
          onPageChange={(page) =>
            setPagination({ ...pagination, currentPage: page })
          }
          prefix="facial"
        />
      )}

      {selectedClient && (
        <ClientDetailPanel
          client={
            clients.find((c) => c.id === selectedClient.id) ?? selectedClient
          }
          onClose={() => setSelectedClient(null)}
          onUpdate={() => refreshClients(true)}
        />
      )}

      {showPatientIssues && (
        <PatientIssuesModal
          client={showPatientIssues}
          onClose={() => setShowPatientIssues(null)}
        />
      )}

      {issuePhotosContext && (
        <TreatmentPhotosModal
          client={issuePhotosContext.client}
          issue={issuePhotosContext.issue}
          region={issuePhotosContext.region}
          interest={issuePhotosContext.interest}
          onClose={() => setIssuePhotosContext(null)}
          onUpdate={() => refreshClients(true)}
        />
      )}
    </section>
  );
}
