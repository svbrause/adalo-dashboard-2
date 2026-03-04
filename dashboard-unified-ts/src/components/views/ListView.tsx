// List View Component

import { useState, useMemo } from "react";
import { useDashboard } from "../../context/DashboardContext";
import ClientDetailPanel from "./ClientDetailPanel";
import Pagination from "../common/Pagination";
import { formatRelativeDate } from "../../utils/dateFormatting";
import {
  formatFacialStatusForDisplay,
  getFacialStatusColorForDisplay,
  hasInterestedTreatments,
} from "../../utils/statusFormatting";
import { applyFilters, applySorting } from "../../utils/filtering";
import { updateClientStatus } from "../../services/contactHistory";
import { showToast, showError } from "../../utils/toast";
import "./ListView.css";

export default function ListView() {
  const {
    clients,
    searchQuery,
    loading,
    error,
    refreshClients,
    filters,
    sort,
    setSort,
    pagination,
    setPagination,
  } = useDashboard();
  const [selectedClient, setSelectedClient] = useState<
    (typeof clients)[0] | null
  >(null);

  // Filter and sort clients
  const processedClients = useMemo(() => {
    // Filter out archived clients
    let filtered = clients.filter((client) => !client.archived);

    // Apply filters
    filtered = applyFilters(filtered, filters, searchQuery);

    // Apply sorting
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

  const handleRowClick = (client: (typeof clients)[0]) => {
    setSelectedClient(client);
  };

  const handleStatusChange = async (clientId: string, newStatus: string) => {
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;

    try {
      await updateClientStatus(client, newStatus as Parameters<typeof updateClientStatus>[1]);
      showToast(`Status updated to ${newStatus}`);
      refreshClients();
    } catch (error: any) {
      showError(error.message || "Failed to update status");
    }
  };

  const handleColumnSort = (field: typeof sort.field) => {
    if (sort.field === field) {
      // Toggle sort order if clicking same column
      setSort({ ...sort, order: sort.order === "asc" ? "desc" : "asc" });
    } else {
      // New column, default to descending
      setSort({ field, order: "desc" });
    }
    // Reset to page 1 when sorting
    setPagination({ ...pagination, currentPage: 1 });
  };

  const getSortIndicator = (field: typeof sort.field) => {
    if (sort.field !== field) return null;
    return sort.order === "asc" ? " ↑" : " ↓";
  };

  if (loading) {
    return (
      <section className="list-view active">
        <div className="leads-table-container">
          <div className="loading-container">
            <div className="spinner spinner-with-margin"></div>
            Loading clients...
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="list-view active">
        <div className="leads-table-container">
          <div className="error-container">
            <p>Error loading clients: {error}</p>
            <button
              onClick={() => window.location.reload()}
              className="error-retry-button"
            >
              Retry
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="list-view active">
      <div className="list-view-content">
        <div className="leads-table-container">
          <table className="leads-table">
            <thead>
              <tr>
                <th
                  onClick={() => handleColumnSort("name")}
                  className="table-header-sortable"
                  title="Click to sort by name"
                >
                  Client{getSortIndicator("name")}
                </th>
                <th>Interested Treatments</th>
                <th
                  onClick={() => handleColumnSort("facialAnalysisStatus")}
                  className="table-header-sortable"
                  title="Click to sort by analysis status"
                >
                  Analysis Status{getSortIndicator("facialAnalysisStatus")}
                </th>
                <th
                  onClick={() => handleColumnSort("status")}
                  className="table-header-sortable"
                  title="Click to sort by lead stage"
                >
                  Lead Stage{getSortIndicator("status")}
                </th>
                <th
                  onClick={() => handleColumnSort("lastContact")}
                  className="table-header-sortable"
                  title="Click to sort by last activity"
                >
                  Last Activity{getSortIndicator("lastContact")}
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="table-cell-center">
                    <div className="spinner spinner-with-margin"></div>
                    Loading clients...
                  </td>
                </tr>
              ) : processedClients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-cell-center">
                    {clients.length === 0
                      ? "No clients found"
                      : "No clients match your search"}
                  </td>
                </tr>
              ) : (
                paginatedClients.map((client) => (
                  <tr
                    key={client.id}
                    onClick={() => handleRowClick(client)}
                    className="cursor-pointer"
                  >
                    <td>
                      <div className="table-lead-name">
                        {client.name || "N/A"}
                      </div>
                      <div className="table-lead-email">
                        {client.email || ""}
                      </div>
                    </td>
                    <td>
                      <div className="interest-tags-container">
                        {Array.isArray(client.goals)
                          ? client.goals.slice(0, 2).map((g, i) => (
                              <span
                                key={i}
                                className="interest-tag interest-tag-sm"
                              >
                                {g}
                              </span>
                            ))
                          : null}
                      </div>
                    </td>
                    <td>
                      <span
                        className="status-badge status-badge-base"
                        style={{
                          background: getFacialStatusColorForDisplay(
                            client.facialAnalysisStatus || null,
                            hasInterestedTreatments(client),
                          ),
                        }}
                      >
                        {formatFacialStatusForDisplay(
                          client.facialAnalysisStatus || null,
                          hasInterestedTreatments(client),
                        )}
                      </span>
                      {client.offerClaimed && (
                        <div className="status-badge-offer">
                          <span className="status-badge-offer-content">
                            ✓ Offer Claimed
                          </span>
                        </div>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <select
                        className="status-select-inline"
                        value={client.status}
                        onChange={(e) =>
                          handleStatusChange(client.id, e.target.value)
                        }
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="new">New Lead</option>
                        <option value="contacted">Contacted</option>
                        <option value="requested-consult">
                          Requested Consult
                        </option>
                        <option value="scheduled">Scheduled</option>
                        <option value="converted">Converted</option>
                        <option value="current-client">Current Client</option>
                      </select>
                    </td>
                    <td className="text-sm text-muted">
                      {formatRelativeDate(
                        client.lastContact || client.createdAt,
                      )}
                    </td>
                    <td>
                      <button
                        className="btn-secondary btn-view"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowClick(client);
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
          />
        )}
      </div>

      {selectedClient && (
        <ClientDetailPanel
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
