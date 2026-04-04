// View Controls Component (Search, Filters, Sort)

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDashboard } from "../../context/DashboardContext";
import { formatProviderDisplayName } from "../../utils/providerHelpers";
import { isWellnestWellnessProviderCode } from "../../data/wellnestOfferings";
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
    pagination,
    provider,
  } = useDashboard();

  const wellnestAnalysisStatusPendingLabel = isWellnestWellnessProviderCode(
    provider?.code,
  );

  /** Filter dropdown options: all non-archived rows (patients + web leads). */
  const clientsForFilters = useMemo(
    () => clients.filter((c) => !c.archived),
    [clients],
  );

  const locationOptions = useMemo(() => {
    const set = new Set<string>();
    clientsForFilters.forEach((c) => {
      const loc = String(c.locationName ?? "").trim();
      if (loc) set.add(loc);
    });
    return Array.from(set).sort();
  }, [clientsForFilters]);

  const providerOptions = useMemo(() => {
    const set = new Set<string>();
    clientsForFilters.forEach((c) => {
      const name = String(c.appointmentStaffName ?? "").trim();
      if (name) set.add(formatProviderDisplayName(name));
    });
    return Array.from(set).sort();
  }, [clientsForFilters]);

  /** Source filter options: all unique source values present in the current data (not hardcoded). */
  const sourceOptions = useMemo(() => {
    const set = new Set<string>();
    clientsForFilters.forEach((c) => {
      const src = String(c.source ?? "").trim();
      if (src) set.add(src);
    });
    return Array.from(set).sort();
  }, [clientsForFilters]);

  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const filterSectionRef = useRef<HTMLDivElement | null>(null);
  const sortSectionRef = useRef<HTMLDivElement | null>(null);
  const filterContentRef = useRef<HTMLDivElement | null>(null);
  const sortContentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showFilters) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (filterSectionRef.current?.contains(target)) return;
      if (filterContentRef.current?.contains(target)) return;
      setShowFilters(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [showFilters]);

  useEffect(() => {
    if (!showSort) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (sortSectionRef.current?.contains(target)) return;
      if (sortContentRef.current?.contains(target)) return;
      setShowSort(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [showSort]);

  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 768px)").matches
      : false,
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const sync = () => setIsMobileLayout(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const isClientView =
    currentView === "list" ||
    currentView === "leads" ||
    currentView === "cards" ||
    currentView === "kanban" ||
    currentView === "facial-analysis" ||
    currentView === "archived";

  /** Show List/Cards toggle only on Clients tab (not on Leads tab). */
  const isAllClientsView =
    currentView === "list" ||
    currentView === "cards" ||
    currentView === "kanban" ||
    currentView === "facial-analysis";

  const filterContent = (
    <>
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
            <option key={src} value={src}>{src}</option>
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
              setFilters({ ...filters, ageMin: e.target.value ? parseInt(e.target.value, 10) : null });
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
              setFilters({ ...filters, ageMax: e.target.value ? parseInt(e.target.value, 10) : null });
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
          <option value={wellnestAnalysisStatusPendingLabel ? "Not started" : "Pending"}>
            {wellnestAnalysisStatusPendingLabel ? "Not started" : "Pending"}
          </option>
          <option value="Ready for Review">Ready for Review</option>
          <option value="Patient Reviewed">Patient Reviewed</option>
        </select>
      </div>
      <div className="filter-group">
        <label>Skin Analysis</label>
        <select
          value={filters.skinAnalysisState}
          onChange={(e) => {
            setFilters({ ...filters, skinAnalysisState: e.target.value as "" | "has" | "blank" });
            setPagination({ currentPage: 1, itemsPerPage: 25 });
          }}
          className="filter-select"
        >
          <option value="">All</option>
          <option value="has">Has Skin Analysis</option>
          <option value="blank">Skin Analysis Blank</option>
        </select>
      </div>
      <div className="filter-group">
        <label>Treatment Finder</label>
        <select
          value={filters.treatmentFinderState}
          onChange={(e) => {
            setFilters({ ...filters, treatmentFinderState: e.target.value as "" | "has" | "blank" });
            setPagination({ currentPage: 1, itemsPerPage: 25 });
          }}
          className="filter-select"
        >
          <option value="">All</option>
          <option value="has">Has Treatment Finder</option>
          <option value="blank">Treatment Finder Blank</option>
        </select>
      </div>
      <div className="filter-group">
        <label>Treatment Plan</label>
        <select
          value={filters.treatmentPlanState}
          onChange={(e) => {
            setFilters({ ...filters, treatmentPlanState: e.target.value as "" | "has" | "blank" });
            setPagination({ currentPage: 1, itemsPerPage: 25 });
          }}
          className="filter-select"
        >
          <option value="">All</option>
          <option value="has">Plan Built</option>
          <option value="blank">Plan Blank</option>
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
          <option value="current-client">Current Client</option>
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
              <option key={loc} value={loc}>{loc}</option>
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
              <option key={name} value={name}>{name}</option>
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
            skinAnalysisState: "",
            treatmentFinderState: "",
            treatmentPlanState: "",
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
    </>
  );

  const sortContent = (
    <>
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
    </>
  );

  return (
    <div className="view-controls-container">
      {isAllClientsView && !isMobileLayout && (
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
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPagination({ currentPage: 1, itemsPerPage: pagination.itemsPerPage });
            }}
            className={`search-input-main${searchQuery.trim() ? " search-input-main--has-clear" : ""}`}
          />
          {searchQuery.trim() ? (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => {
                setSearchQuery("");
                setPagination({ currentPage: 1, itemsPerPage: pagination.itemsPerPage });
              }}
              aria-label="Clear search"
              title="Clear search"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          ) : null}
        </div>
      </div>
      )}

      {isClientView && (
      <>
      {/* Filter Section */}
      <div className="control-section filter-section" ref={filterSectionRef}>
        <button
          className="control-toggle-btn"
          onClick={() => { setShowFilters(!showFilters); setShowSort(false); }}
          aria-label="Filter"
        >
          <span>Filters</span>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="control-toggle-icon"
          >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
          </svg>
        </button>
        {showFilters && !isMobileLayout && (
          <div className="control-content">
            {filterContent}
          </div>
        )}
      </div>

      {/* Sort Section */}
      <div className="control-section sort-section" ref={sortSectionRef}>
        <button
          className="control-toggle-btn"
          onClick={() => { setShowSort(!showSort); setShowFilters(false); }}
          aria-label="Sort"
        >
          <span>Sort</span>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="control-toggle-icon"
          >
            <line x1="4" y1="6" x2="16" y2="6"></line>
            <line x1="4" y1="12" x2="13" y2="12"></line>
            <line x1="4" y1="18" x2="10" y2="18"></line>
            <polyline points="18 15 21 18 18 21"></polyline>
            <line x1="21" y1="18" x2="21" y2="9"></line>
          </svg>
        </button>
        {showSort && !isMobileLayout && (
          <div className="control-content">
            {sortContent}
          </div>
        )}
      </div>

      {/* Mobile: render bottom sheets via portal to escape overflow:hidden */}
      {isMobileLayout && showFilters && createPortal(
        <div className="mobile-sheet-portal">
          <div className="mobile-sheet-backdrop" onClick={() => setShowFilters(false)} />
          <div className="mobile-sheet-panel" ref={filterContentRef}>
            <div className="mobile-sheet-handle" />
            {filterContent}
          </div>
        </div>,
        document.body,
      )}
      {isMobileLayout && showSort && createPortal(
        <div className="mobile-sheet-portal">
          <div className="mobile-sheet-backdrop" onClick={() => setShowSort(false)} />
          <div className="mobile-sheet-panel" ref={sortContentRef}>
            <div className="mobile-sheet-handle" />
            {sortContent}
          </div>
        </div>,
        document.body,
      )}
      </>
      )}
    </div>
  );
}
