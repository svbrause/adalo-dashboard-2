// Archived View Component

import { useState, useMemo } from "react";
import { useDashboard } from "../../context/DashboardContext";
import ClientDetailModal from "../modals/ClientDetailModal";
import Pagination from "../common/Pagination";
import { formatRelativeDate } from "../../utils/dateFormatting";
import { formatPhoneDisplay } from "../../utils/validation";
import { applyFilters, applySorting } from "../../utils/filtering";
import "./ArchivedView.css";

export default function ArchivedView() {
  const {
    clients,
    searchQuery,
    filters,
    sort,
    pagination,
    setPagination,
    loading,
    refreshClients,
  } = useDashboard();
  const [selectedClient, setSelectedClient] = useState<
    (typeof clients)[0] | null
  >(null);

  // Filter archived clients
  const processedClients = useMemo(() => {
    let filtered = clients.filter((client) => client.archived);
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

  return (
    <section className="archived-view">
      <div className="section-container">
        <h2 className="section-title-large">Archived Leads</h2>

        {loading ? (
          <div className="loading-container">
            <div className="spinner spinner-with-margin"></div>
            Loading archived clients...
          </div>
        ) : (
          <>
            <table className="leads-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Archived Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {processedClients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="table-cell-center">
                      No archived clients
                    </td>
                  </tr>
                ) : (
                  paginatedClients.map((client) => (
                    <tr
                      key={client.id}
                      onClick={() => setSelectedClient(client)}
                      className="cursor-pointer"
                    >
                      <td>{client.name}</td>
                      <td>{client.email || "N/A"}</td>
                      <td>{client.phone ? formatPhoneDisplay(client.phone) : "N/A"}</td>
                      <td>
                        <span className="status-badge status-badge-base status-badge-capitalize">
                          {client.status}
                        </span>
                      </td>
                      <td>{formatRelativeDate(client.createdAt)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn-secondary btn-view"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedClient(client);
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

            {totalPages > 1 && (
              <Pagination
                currentPage={pagination.currentPage}
                totalPages={totalPages}
                totalItems={processedClients.length}
                itemsPerPage={pagination.itemsPerPage}
                onPageChange={(page) =>
                  setPagination({ ...pagination, currentPage: page })
                }
                prefix="archived"
              />
            )}
          </>
        )}
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
