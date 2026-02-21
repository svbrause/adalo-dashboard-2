// Kanban View Component

import React, { useMemo, useState, useEffect } from "react";
import { useDashboard } from "../../context/DashboardContext";
import { applyFilters, applySorting } from "../../utils/filtering";
import { formatRelativeDate } from "../../utils/dateFormatting";
import { formatPhoneDisplay } from "../../utils/validation";
import { updateClientStatus } from "../../services/contactHistory";
import { showToast, showError } from "../../utils/toast";
import { preloadVisiblePhotos } from "../../utils/photoLoading";
import ClientDetailModal from "../modals/ClientDetailModal";
import "./KanbanView.css";

export default function KanbanView() {
  const {
    clients,
    searchQuery,
    filters,
    sort,
    loading,
    refreshClients,
    provider,
    effectiveProviderIds,
  } = useDashboard();
  const [selectedClient, setSelectedClient] = useState<
    (typeof clients)[0] | null
  >(null);
  const [draggedClientId, setDraggedClientId] = useState<string | null>(null);
  const [clientPhotos, setClientPhotos] = useState<Record<string, string>>({});

  // Filter and sort clients
  const processedClients = useMemo(() => {
    let filtered = clients.filter((client) => !client.archived);
    filtered = applyFilters(filtered, filters, searchQuery);
    filtered = applySorting(filtered, sort);
    return filtered;
  }, [clients, filters, searchQuery, sort]);

  const statuses: Array<
    "new" | "contacted" | "requested-consult" | "scheduled" | "converted"
  > = ["new", "contacted", "requested-consult", "scheduled", "converted"];

  const getClientsByStatus = (status: (typeof statuses)[0]) => {
    return processedClients.filter((client) => client.status === status);
  };

  // Load photos for visible clients in Kanban using batch loading
  useEffect(() => {
    if (processedClients.length === 0 || !provider?.id) return;

    // Debounce photo loading
    const timeout = setTimeout(async () => {
      const providerIdParam =
        effectiveProviderIds.length > 0
          ? effectiveProviderIds.join(",")
          : provider.id;
      await preloadVisiblePhotos(processedClients, providerIdParam);
      // Update local photo state from loaded client photos
      const updatedPhotos: Record<string, string> = {};
      processedClients.forEach((client) => {
        if (
          client.frontPhoto &&
          Array.isArray(client.frontPhoto) &&
          client.frontPhoto.length > 0
        ) {
          const attachment = client.frontPhoto[0];
          const url =
            attachment.thumbnails?.large?.url ||
            attachment.thumbnails?.full?.url ||
            attachment.url;
          updatedPhotos[client.id] = url;
        }
      });
      if (Object.keys(updatedPhotos).length > 0) {
        setClientPhotos((prev) => ({ ...prev, ...updatedPhotos }));
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [processedClients, provider?.id, effectiveProviderIds]);

  const handleCardClick = (client: (typeof clients)[0]) => {
    setSelectedClient(client);
  };

  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    clientId: string,
  ) => {
    setDraggedClientId(clientId);
    e.dataTransfer.effectAllowed = "move";
    e.currentTarget.classList.add("dragging");
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove("dragging");
    setDraggedClientId(null);
    document.querySelectorAll(".kanban-cards").forEach((col) => {
      col.classList.remove("drag-over");
    });
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.add("drag-over");
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove("drag-over");
  };

  const handleDrop = async (
    e: React.DragEvent<HTMLDivElement>,
    newStatus: (typeof statuses)[0],
  ) => {
    e.preventDefault();
    e.currentTarget.classList.remove("drag-over");

    if (!draggedClientId) return;

    const client = clients.find((c) => c.id === draggedClientId);
    if (!client || client.status === newStatus) {
      setDraggedClientId(null);
      return;
    }

    try {
      await updateClientStatus(client, newStatus);
      const statusDisplayNames: Record<typeof newStatus, string> = {
        new: "New Leads",
        contacted: "Contacted",
        "requested-consult": "Requested Consult",
        scheduled: "Consultation Scheduled",
        converted: "Converted",
      };
      showToast(`Moved ${client.name} to ${statusDisplayNames[newStatus]}`);
      refreshClients();
    } catch (error: any) {
      showError(error.message || "Failed to update status");
    } finally {
      setDraggedClientId(null);
    }
  };

  return (
    <section className="kanban-view">
      <div className="kanban-board">
        {statuses.map((status) => {
          const statusClients = getClientsByStatus(status);
          const statusLabels = {
            new: "New Leads",
            contacted: "Contacted",
            "requested-consult": "Requested Consult",
            scheduled: "Consultation Scheduled",
            converted: "Converted",
          };

          return (
            <div key={status} className="kanban-column" data-status={status}>
              <div className="kanban-column-header">
                <div className="column-title">
                  <span className={`column-dot ${status}`}></span>
                  <h3>{statusLabels[status]}</h3>
                  <span className="column-count">{statusClients.length}</span>
                </div>
              </div>
              <div
                className="kanban-cards"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, status)}
              >
                {loading ? (
                  <div className="empty-state">
                    <div className="loading-spinner"></div>
                    <p className="empty-state-text">Loading clients...</p>
                  </div>
                ) : statusClients.length === 0 ? (
                  <div className="empty-state">
                    <p className="empty-state-text">No clients yet</p>
                  </div>
                ) : (
                  statusClients.map((client) => {
                    // Get photo URL from client data or loaded photos
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
                    } else if (clientPhotos[client.id]) {
                      photoUrl = clientPhotos[client.id];
                    }

                    return (
                      <div
                        key={client.id}
                        className={`client-card ${draggedClientId === client.id ? "dragging" : ""}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, client.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleCardClick(client)}
                      >
                        {photoUrl && (
                          <div className="lead-photo">
                            <img
                              src={photoUrl}
                              alt={client.name}
                              className="client-photo-img"
                              draggable={false}
                              loading="lazy"
                            />
                          </div>
                        )}
                        <div className="lead-card-header">
                          <div>
                            <div className="client-name">{client.name}</div>
                            <div className="lead-contact-info">
                              {client.phone && (
                                <div className="lead-contact">
                                  Phone: {formatPhoneDisplay(client.phone)}
                                </div>
                              )}
                              {client.email && (
                                <div className="lead-contact">
                                  Email:{" "}
                                  {client.email.length > 22
                                    ? client.email.substring(0, 20) + "..."
                                    : client.email}
                                </div>
                              )}
                              {client.zipCode && (
                                <div className="lead-contact">
                                  Zip: {client.zipCode}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="lead-card-footer">
                          <span className="lead-date">
                            {formatRelativeDate(client.createdAt)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedClient && (
        <ClientDetailModal
          client={
            clients.find((c) => c.id === selectedClient.id) ?? selectedClient
          }
          onClose={() => setSelectedClient(null)}
          onUpdate={() => refreshClients(true)}
        />
      )}
    </section>
  );
}
