// List View Component

import { useState, useMemo } from "react";
import LeadAutoReplySettingsModal from "../modals/LeadAutoReplySettingsModal";
import { useDashboard } from "../../context/DashboardContext";
import ClientDetailPanel from "./ClientDetailPanel";
import Pagination from "../common/Pagination";
import { formatRelativeDate } from "../../utils/dateFormatting";
import { applyFilters, applySorting } from "../../utils/filtering";
import { isWebsiteMarketingWebLead } from "../../utils/leadSource";
import { isTheTreatmentProvider } from "../../utils/providerHelpers";
import {
  DashboardAnalysisIcon,
  DashboardListStatusLegend,
  DashboardPlanIcon,
  DashboardQuizIcon,
} from "../common/DashboardSectionIcons";
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
    provider,
    currentView,
  } = useDashboard();
  const [selectedClient, setSelectedClient] = useState<
    (typeof clients)[0] | null
  >(null);
  const [showLeadAutoReplySettings, setShowLeadAutoReplySettings] =
    useState(false);

  // Sidebar: Clients vs Leads are two filters over the same records.
  const processedClients = useMemo(() => {
    let filtered = clients.filter((client) => !client.archived);
    filtered = filtered.filter((client) =>
      currentView === "leads"
        ? isWebsiteMarketingWebLead(client)
        : !isWebsiteMarketingWebLead(client),
    );
    filtered = applyFilters(filtered, filters, searchQuery, provider?.code);
    filtered = applySorting(filtered, sort);

    return filtered;
  }, [clients, currentView, filters, searchQuery, sort, provider?.code]);

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

  const tableColSpan = 6;

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
        {currentView === "leads" && isTheTreatmentProvider(provider) && (
          <div className="list-view-leads-toolbar">
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => setShowLeadAutoReplySettings(true)}
            >
              Auto-reply settings
            </button>
          </div>
        )}
        <DashboardListStatusLegend />
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
                <th
                  onClick={() => handleColumnSort("treatmentPlanBuilt")}
                  className="table-header-sortable table-header-icon-col"
                  title="Sort by plan"
                >
                  Plan{getSortIndicator("treatmentPlanBuilt")}
                </th>
                <th
                  onClick={() => handleColumnSort("facialAnalysisStatus")}
                  className="table-header-sortable table-header-icon-col"
                  title="Sort by analysis status"
                >
                  Analysis{getSortIndicator("facialAnalysisStatus")}
                </th>
                <th
                  onClick={() => handleColumnSort("quizCompleted")}
                  className="table-header-sortable table-header-icon-col"
                  title="Sort by quiz completed"
                >
                  Quiz{getSortIndicator("quizCompleted")}
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
                  <td colSpan={tableColSpan} className="table-cell-center">
                    <div className="spinner spinner-with-margin"></div>
                    Loading clients...
                  </td>
                </tr>
              ) : processedClients.length === 0 ? (
                <tr>
                  <td colSpan={tableColSpan} className="table-cell-center">
                    {clients.length === 0
                      ? "No clients found"
                      : currentView === "leads"
                        ? "No leads match your filters"
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
                      {client.offerClaimed && (
                        <div className="list-view-offer-claimed">
                          <span className="list-view-offer-claimed-text">
                            ✓ Offer claimed
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="table-cell-icon-col">
                      <DashboardPlanIcon client={client} />
                    </td>
                    <td className="table-cell-icon-col">
                      <DashboardAnalysisIcon
                        client={client}
                        providerCode={provider?.code}
                      />
                    </td>
                    <td className="table-cell-icon-col">
                      <DashboardQuizIcon client={client} />
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

      {showLeadAutoReplySettings && (
        <LeadAutoReplySettingsModal
          onClose={() => setShowLeadAutoReplySettings(false)}
        />
      )}
    </section>
  );
}
