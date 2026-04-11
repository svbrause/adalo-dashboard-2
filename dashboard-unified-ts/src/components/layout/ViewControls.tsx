// View Controls Component (Search, Filters, Sort)

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDashboard } from "../../context/DashboardContext";
import { formatProviderDisplayName } from "../../utils/providerHelpers";
import { isWellnestWellnessProviderCode } from "../../data/wellnestOfferings";
import {
  FILTER_OPT,
  getActiveFilterTags,
} from "../../utils/activeFilterSummary";
import { FilterSelect } from "./FilterSelect";
import type { FilterSelectOption } from "./FilterSelect";
import "./ViewControls.css";

const SORT_FIELD_OPTIONS: FilterSelectOption[] = [
  { value: "lastContact", label: "Last Activity" },
  { value: "name", label: "Name" },
  { value: "age", label: "Age" },
  { value: "facialAnalysisStatus", label: "Analysis status" },
  { value: "treatmentPlanBuilt", label: "Plan (complete first)" },
  { value: "quizCompleted", label: "Quiz (complete first)" },
  { value: "photosLiked", label: "Photos Liked" },
  { value: "photosViewed", label: "Photos Viewed" },
  { value: "createdAt", label: "Date Added" },
];

const SORT_ORDER_OPTIONS: FilterSelectOption[] = [
  { value: "desc", label: "Descending" },
  { value: "asc", label: "Ascending" },
];

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
      if (
        (target as HTMLElement).closest?.(".filter-select-custom-menu")
      ) {
        return;
      }
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
      if (
        (target as HTMLElement).closest?.(".filter-select-custom-menu")
      ) {
        return;
      }
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

  const filtersActive = useMemo(() => {
    const f = filters;
    return (
      Boolean(String(f.source ?? "").trim()) ||
      f.ageMin !== null ||
      f.ageMax !== null ||
      Boolean(f.analysisStatus) ||
      Boolean(f.skinAnalysisState) ||
      Boolean(f.treatmentFinderState) ||
      Boolean(f.treatmentPlanState) ||
      Boolean(f.quizState) ||
      Boolean(String(f.locationName ?? "").trim()) ||
      Boolean(String(f.providerName ?? "").trim())
    );
  }, [filters]);

  const activeFilterTags = useMemo(
    () => getActiveFilterTags(filters),
    [filters],
  );

  const analysisFilterOptions = useMemo((): FilterSelectOption[] => {
    const pendingVal = wellnestAnalysisStatusPendingLabel
      ? "Not started"
      : "Pending";
    return [
      { value: "", label: "All" },
      {
        value: pendingVal,
        label: wellnestAnalysisStatusPendingLabel
          ? `${FILTER_OPT.notStarted}Not started`
          : `${FILTER_OPT.pending}Pending`,
        swatch: wellnestAnalysisStatusPendingLabel
          ? "muted"
          : "analysis-pending",
      },
      {
        value: "Ready for Review",
        label: `${FILTER_OPT.complete}Ready for review`,
        swatch: "analysis-ready",
      },
      {
        value: "Patient Reviewed",
        label: `${FILTER_OPT.complete}Patient reviewed`,
        swatch: "analysis-reviewed",
      },
    ];
  }, [wellnestAnalysisStatusPendingLabel]);

  const sourceFilterOptions = useMemo((): FilterSelectOption[] => {
    return [
      { value: "", label: "All Sources" },
      ...sourceOptions.map((src) => ({
        value: src,
        label: src,
      })),
    ];
  }, [sourceOptions]);

  const locationFilterOptions = useMemo((): FilterSelectOption[] => {
    return [
      { value: "", label: "All Locations" },
      ...locationOptions.map((loc) => ({
        value: loc,
        label: loc,
      })),
    ];
  }, [locationOptions]);

  const providerFilterOptions = useMemo((): FilterSelectOption[] => {
    return [
      { value: "", label: "All Providers" },
      ...providerOptions.map((name) => ({
        value: name,
        label: name,
      })),
    ];
  }, [providerOptions]);

  const skinFilterOptions = useMemo(
    (): FilterSelectOption[] => [
      { value: "", label: "All" },
      {
        value: "has",
        label: `${FILTER_OPT.complete}Has analysis data`,
        swatch: "complete",
      },
      {
        value: "blank",
        label: `${FILTER_OPT.notStarted}Not started`,
        swatch: "muted",
      },
    ],
    [],
  );

  const finderFilterOptions = useMemo(
    (): FilterSelectOption[] => [
      { value: "", label: "All" },
      {
        value: "has",
        label: `${FILTER_OPT.pending}Has finder activity`,
        swatch: "pending",
      },
      {
        value: "blank",
        label: `${FILTER_OPT.notStarted}Not started`,
        swatch: "muted",
      },
    ],
    [],
  );

  const planFilterOptions = useMemo(
    (): FilterSelectOption[] => [
      { value: "", label: "All" },
      {
        value: "has",
        label: `${FILTER_OPT.complete}Complete`,
        swatch: "complete",
      },
      {
        value: "blank",
        label: `${FILTER_OPT.notStarted}Not started`,
        swatch: "muted",
      },
    ],
    [],
  );

  const quizFilterOptions = useMemo(
    (): FilterSelectOption[] => [
      { value: "", label: "All" },
      {
        value: "has",
        label: `${FILTER_OPT.complete}Complete`,
        swatch: "complete",
      },
      {
        value: "blank",
        label: `${FILTER_OPT.notStarted}Not started`,
        swatch: "muted",
      },
    ],
    [],
  );

  const clearAllFilters = useCallback(() => {
    setFilters({
      source: "",
      ageMin: null,
      ageMax: null,
      analysisStatus: "",
      skinAnalysisState: "",
      treatmentFinderState: "",
      treatmentPlanState: "",
      quizState: "",
      locationName: "",
      providerName: "",
    });
    setSort({ field: "createdAt", order: "desc" });
    setPagination({ currentPage: 1, itemsPerPage: 25 });
  }, [setFilters, setSort, setPagination]);

  const filterContent = (
    <>
      <div className="filter-group">
        <label>Source</label>
        <FilterSelect
          aria-label="Filter by source"
          value={filters.source}
          onChange={(v) => {
            setFilters({ ...filters, source: v });
            setPagination({ currentPage: 1, itemsPerPage: 25 });
          }}
          options={sourceFilterOptions}
        />
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
        <label>Analysis</label>
        <FilterSelect
          aria-label="Filter by facial analysis status"
          value={filters.analysisStatus}
          onChange={(v) => {
            setFilters({ ...filters, analysisStatus: v });
            setPagination({ currentPage: 1, itemsPerPage: 25 });
          }}
          options={analysisFilterOptions}
        />
      </div>
      <div className="filter-group">
        <label>Skin Analysis</label>
        <FilterSelect
          aria-label="Filter by skin analysis"
          value={filters.skinAnalysisState}
          onChange={(v) => {
            setFilters({
              ...filters,
              skinAnalysisState: v as "" | "has" | "blank",
            });
            setPagination({ currentPage: 1, itemsPerPage: 25 });
          }}
          options={skinFilterOptions}
        />
      </div>
      <div className="filter-group">
        <label>Treatment Finder</label>
        <FilterSelect
          aria-label="Filter by treatment finder activity"
          value={filters.treatmentFinderState}
          onChange={(v) => {
            setFilters({
              ...filters,
              treatmentFinderState: v as "" | "has" | "blank",
            });
            setPagination({ currentPage: 1, itemsPerPage: 25 });
          }}
          options={finderFilterOptions}
        />
      </div>
      <div className="filter-group">
        <label>Plan</label>
        <FilterSelect
          aria-label="Filter by treatment plan"
          value={filters.treatmentPlanState}
          onChange={(v) => {
            setFilters({
              ...filters,
              treatmentPlanState: v as "" | "has" | "blank",
            });
            setPagination({ currentPage: 1, itemsPerPage: 25 });
          }}
          options={planFilterOptions}
        />
      </div>
      <div className="filter-group">
        <label>Quiz</label>
        <FilterSelect
          aria-label="Filter by quiz completion"
          value={filters.quizState}
          onChange={(v) => {
            setFilters({ ...filters, quizState: v as "" | "has" | "blank" });
            setPagination({ currentPage: 1, itemsPerPage: 25 });
          }}
          options={quizFilterOptions}
        />
      </div>
      {locationOptions.length > 0 && (
        <div className="filter-group">
          <label>Location</label>
          <FilterSelect
            aria-label="Filter by location"
            value={filters.locationName}
            onChange={(v) => {
              setFilters({ ...filters, locationName: v });
              setPagination({ currentPage: 1, itemsPerPage: 25 });
            }}
            options={locationFilterOptions}
          />
        </div>
      )}
      {providerOptions.length > 0 && (
        <div className="filter-group">
          <label>Provider</label>
          <FilterSelect
            aria-label="Filter by provider"
            value={filters.providerName}
            onChange={(v) => {
              setFilters({ ...filters, providerName: v });
              setPagination({ currentPage: 1, itemsPerPage: 25 });
            }}
            options={providerFilterOptions}
          />
        </div>
      )}
      <button
        type="button"
        className={`btn-secondary btn-sm filter-clear-btn${
          filtersActive ? " filter-clear-btn--active" : ""
        }`}
        onClick={clearAllFilters}
      >
        Clear Filters
      </button>
    </>
  );

  const sortContent = (
    <>
      <div className="filter-group">
        <label>Sort By</label>
        <FilterSelect
          aria-label="Sort by field"
          value={sort.field}
          onChange={(v) => {
            setSort({ ...sort, field: v as typeof sort.field });
            setPagination({ currentPage: 1, itemsPerPage: 25 });
          }}
          options={SORT_FIELD_OPTIONS}
        />
      </div>
      <div className="filter-group">
        <label>Order</label>
        <FilterSelect
          aria-label="Sort order"
          value={sort.order}
          onChange={(v) => {
            setSort({ ...sort, order: v as "asc" | "desc" });
            setPagination({ currentPage: 1, itemsPerPage: 25 });
          }}
          options={SORT_ORDER_OPTIONS}
        />
      </div>
    </>
  );

  return (
    <>
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
          type="button"
          className={`control-toggle-btn${
            filtersActive ? " control-toggle-btn--filters-active" : ""
          }`}
          onClick={() => {
            setShowFilters(!showFilters);
            setShowSort(false);
          }}
          aria-label={filtersActive ? "Filters (active)" : "Filters"}
          title={filtersActive ? "Filters are applied — click to adjust" : "Filters"}
          aria-expanded={showFilters}
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
            aria-hidden
          >
            <polygon
              points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"
              fill={filtersActive ? "currentColor" : "none"}
              stroke={filtersActive ? "none" : "currentColor"}
            />
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

    {isClientView && !showFilters && activeFilterTags.length > 0 && (
      <div
        className="filter-active-summary"
        role="status"
        aria-live="polite"
        aria-label="Active filters"
      >
        <div className="filter-active-summary-inner">
          <span className="filter-active-summary-heading">Filtered by</span>
          <ul className="filter-active-summary-chips">
            {activeFilterTags.map((tag, i) => (
              <li key={`${i}-${tag}`} className="filter-active-summary-chip">
                {tag}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn-secondary btn-sm filter-clear-btn filter-clear-btn--active filter-active-summary-clear"
            onClick={clearAllFilters}
          >
            Clear filters
          </button>
        </div>
      </div>
    )}
    </>
  );
}
