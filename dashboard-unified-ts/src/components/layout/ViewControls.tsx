// View Controls Component (Search, Filters, Sort)

import { useMemo, useState } from "react";
import { useDashboard } from "../../context/DashboardContext";
import { formatProviderDisplayName } from "../../utils/providerHelpers";
import "./ViewControls.css";

export default function ViewControls() {
  const {
    clients,
    searchQuery,
    setSearchQuery,
    currentView,
    setCurrentView,
    filters,
    setFilters,
    sort,
    setSort,
    setPagination,
  } = useDashboard();

  const locationOptions = useMemo(() => {
    const set = new Set<string>();
    clients.forEach((c) => {
      const loc = String(c.locationName ?? "").trim();
      if (loc) set.add(loc);
    });
    return Array.from(set).sort();
  }, [clients]);

  const providerOptions = useMemo(() => {
    const set = new Set<string>();
    clients.forEach((c) => {
      const name = String(c.appointmentStaffName ?? "").trim();
      if (name) set.add(formatProviderDisplayName(name));
    });
    return Array.from(set).sort();
  }, [clients]);

  /** Source filter options: all unique source values present in the current data (not hardcoded). */
  const sourceOptions = useMemo(() => {
    const set = new Set<string>();
    clients.forEach((c) => {
      const src = String(c.source ?? "").trim();
      if (src) set.add(src);
    });
    return Array.from(set).sort();
  }, [clients]);

  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);

  const isClientView =
    currentView === "list" ||
    currentView === "cards" ||
    currentView === "kanban" ||
    currentView === "facial-analysis" ||
    currentView === "archived";

  return (
    <div className="view-controls-container">
      {isClientView && (
      <div className="control-section view-toggle-section">
        <div className="view-toggle-buttons">
          <button
            className={`view-toggle-btn ${
              currentView === "list" ? "active" : ""
            }`}
            onClick={() => setCurrentView("list")}
            title="List View"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="8" y1="6" x2="21" y2="6"></line>
              <line x1="8" y1="12" x2="21" y2="12"></line>
              <line x1="8" y1="18" x2="21" y2="18"></line>
              <line x1="3" y1="6" x2="3.01" y2="6"></line>
              <line x1="3" y1="12" x2="3.01" y2="12"></line>
              <line x1="3" y1="18" x2="3.01" y2="18"></line>
            </svg>
            <span>List</span>
          </button>
          <button
            className={`view-toggle-btn ${
              currentView === "cards" || currentView === "facial-analysis"
                ? "active"
                : ""
            }`}
            onClick={() => setCurrentView("facial-analysis")}
            title="Card View"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            <span>Cards</span>
          </button>
        </div>
      </div>
      )}

      {isClientView && (
      <div className="control-section search-section">
        <div className="search-box-main">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input-main"
          />
        </div>
      </div>
      )}

      {isClientView && (
      <>
      {/* Filter Section */}
      <div className="control-section filter-section">
        <button
          className="control-toggle-btn"
          onClick={() => setShowFilters(!showFilters)}
        >
          <span>Filters</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`filter-icon-rotate ${showFilters ? "active" : ""}`}
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        {showFilters && (
          <div className="control-content">
            <div className="filter-group">
              <label>Source</label>
              <select
                value={filters.source}
                onChange={(e) => {
                  setFilters({ ...filters, source: e.target.value });
                  setPagination({ currentPage: 1, itemsPerPage: 25 });
                }}
                className="filter-select"
              >
                <option value="">All Sources</option>
                {sourceOptions.map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Age Range</label>
              <div className="filter-age-range">
                <input
                  type="number"
                  placeholder="Min"
                  min="0"
                  max="150"
                  value={filters.ageMin || ""}
                  onChange={(e) => {
                    setFilters({
                      ...filters,
                      ageMin: e.target.value
                        ? parseInt(e.target.value, 10)
                        : null,
                    });
                    setPagination({ currentPage: 1, itemsPerPage: 25 });
                  }}
                  className="filter-input filter-input-narrow"
                />
                <span>-</span>
                <input
                  type="number"
                  placeholder="Max"
                  min="0"
                  max="150"
                  value={filters.ageMax || ""}
                  onChange={(e) => {
                    setFilters({
                      ...filters,
                      ageMax: e.target.value
                        ? parseInt(e.target.value, 10)
                        : null,
                    });
                    setPagination({ currentPage: 1, itemsPerPage: 25 });
                  }}
                  className="filter-input filter-input-narrow"
                />
              </div>
            </div>
            <div className="filter-group">
              <label>Analysis Status</label>
              <select
                value={filters.analysisStatus}
                onChange={(e) => {
                  setFilters({ ...filters, analysisStatus: e.target.value });
                  setPagination({ currentPage: 1, itemsPerPage: 25 });
                }}
                className="filter-select"
              >
                <option value="">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Ready for Review">Ready for Review</option>
                <option value="Patient Reviewed">Patient Reviewed</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Lead Stage</label>
              <select
                value={filters.leadStage}
                onChange={(e) => {
                  setFilters({ ...filters, leadStage: e.target.value });
                  setPagination({ currentPage: 1, itemsPerPage: 25 });
                }}
                className="filter-select"
              >
                <option value="">All Stages</option>
                <option value="new">New Lead</option>
                <option value="contacted">Contacted</option>
                <option value="requested-consult">Requested Consult</option>
                <option value="scheduled">Scheduled</option>
                <option value="converted">Converted</option>
              </select>
            </div>
            {locationOptions.length > 0 && (
              <div className="filter-group">
                <label>Location</label>
                <select
                  value={filters.locationName}
                  onChange={(e) => {
                    setFilters({ ...filters, locationName: e.target.value });
                    setPagination({ currentPage: 1, itemsPerPage: 25 });
                  }}
                  className="filter-select"
                >
                  <option value="">All Locations</option>
                  {locationOptions.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {providerOptions.length > 0 && (
              <div className="filter-group">
                <label>Provider</label>
                <select
                  value={filters.providerName}
                  onChange={(e) => {
                    setFilters({ ...filters, providerName: e.target.value });
                    setPagination({ currentPage: 1, itemsPerPage: 25 });
                  }}
                  className="filter-select"
                >
                  <option value="">All Providers</option>
                  {providerOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button
              className="btn-secondary btn-sm filter-clear-btn"
              onClick={() => {
                setFilters({
                  source: "",
                  ageMin: null,
                  ageMax: null,
                  analysisStatus: "",
                  leadStage: "",
                  locationName: "",
                  providerName: "",
                });
                setSort({ field: "createdAt", order: "desc" });
                setPagination({ currentPage: 1, itemsPerPage: 25 });
              }}
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Sort Section */}
      <div className="control-section sort-section">
        <button
          className="control-toggle-btn"
          onClick={() => setShowSort(!showSort)}
        >
          <span>Sort</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`sort-icon-rotate ${showSort ? "active" : ""}`}
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        {showSort && (
          <div className="control-content">
            <div className="filter-group">
              <label>Sort By</label>
              <select
                value={sort.field}
                onChange={(e) => {
                  setSort({ ...sort, field: e.target.value as any });
                  setPagination({ currentPage: 1, itemsPerPage: 25 });
                }}
                className="filter-select"
              >
                <option value="lastContact">Last Activity</option>
                <option value="name">Name</option>
                <option value="age">Age</option>
                <option value="status">Status</option>
                <option value="photosLiked">Photos Liked</option>
                <option value="photosViewed">Photos Viewed</option>
                <option value="createdAt">Date Added</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Order</label>
              <select
                value={sort.order}
                onChange={(e) => {
                  setSort({ ...sort, order: e.target.value as "asc" | "desc" });
                  setPagination({ currentPage: 1, itemsPerPage: 25 });
                }}
                className="filter-select"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}
