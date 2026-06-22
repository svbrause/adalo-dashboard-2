import { createContext, useContext, type Dispatch, type SetStateAction } from "react";
import type { Client, Provider, ViewType, FilterState, SortState } from "../types";
import type {
  ClientDetailSection,
  DashboardRoute,
} from "../utils/dashboardRoutes";
import type { DashboardNavigationState } from "../hooks/useDashboardNavigation";

/** Stable context module — keeps HMR from recreating the context object when the provider logic hot-reloads. */
export interface DashboardContextType {
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  provider: Provider | null;
  setProvider: (provider: Provider | null) => void;
  effectiveProviderIds: string[];
  clients: Client[];
  setClients: Dispatch<SetStateAction<Client[]>>;
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filters: FilterState;
  setFilters: (
    filters: FilterState | ((prev: FilterState) => FilterState),
  ) => void;
  sort: SortState;
  setSort: (sort: SortState | ((prev: SortState) => SortState)) => void;
  pagination: { currentPage: number; itemsPerPage: number };
  setPagination: (pagination: {
    currentPage: number;
    itemsPerPage: number;
  }) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  refreshClients: (skipLoading?: boolean) => Promise<void>;
  cacheClientDiscussedItemTimeline: (
    clientId: string,
    itemId: string,
    timeline: string,
  ) => void;
  clearClientDiscussedItemTimelineCache: (
    clientId: string,
    itemId?: string,
    expectedTimeline?: string,
  ) => void;
  routeClientId: string | null;
  routeSection: ClientDetailSection | null;
  navigateDashboard: DashboardNavigationState["navigateDashboard"];
  openClient: DashboardNavigationState["openClient"];
  closeClient: DashboardNavigationState["closeClient"];
}

export type { ClientDetailSection, DashboardRoute };

export const DashboardContext = createContext<DashboardContextType | undefined>(
  undefined,
);

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within DashboardProvider");
  }
  return context;
}
