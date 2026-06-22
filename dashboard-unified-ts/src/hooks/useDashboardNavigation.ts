import { useCallback, useEffect, useRef } from "react";
import type { ViewType } from "../types";
import {
  buildDashboardUrl,
  parseDashboardRoute,
  type ClientDetailSection,
  type DashboardRoute,
} from "../utils/dashboardRoutes";

/** Views that show the patient list search / filter / sort bar and highlight Clients in the sidebar. */
const PATIENT_LIST_VIEWS = new Set<ViewType>([
  "list",
  "leads",
  "cards",
  "kanban",
  "facial-analysis",
  "archived",
]);

export type DashboardNavigationState = {
  routeClientId: string | null;
  routeSection: ClientDetailSection | null;
  navigateDashboard: (route: DashboardRoute, options?: { replace?: boolean }) => void;
  openClient: (
    clientId: string,
    options?: { view?: ViewType; section?: ClientDetailSection; replace?: boolean },
  ) => void;
  closeClient: (options?: { view?: ViewType }) => void;
};

type UseDashboardNavigationArgs = {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  routeClientId: string | null;
  setRouteClientId: (id: string | null) => void;
  routeSection: ClientDetailSection | null;
  setRouteSection: (section: ClientDetailSection | null) => void;
  /** Current paginated list page (Clients / Leads / etc.). */
  listPage?: number;
  onRouteApplied?: (route: DashboardRoute) => void;
  enabled: boolean;
};

function applyRoute(
  route: DashboardRoute,
  setCurrentView: (view: ViewType) => void,
  setRouteClientId: (id: string | null) => void,
  setRouteSection: (section: ClientDetailSection | null) => void,
  onRouteApplied?: (route: DashboardRoute) => void,
) {
  setCurrentView(route.view);
  setRouteClientId(route.clientId ?? null);
  setRouteSection(route.section ?? null);
  onRouteApplied?.(route);
}

export function useDashboardNavigation({
  currentView,
  setCurrentView,
  routeClientId,
  setRouteClientId,
  routeSection,
  setRouteSection,
  onRouteApplied,
  listPage = 1,
  enabled,
}: UseDashboardNavigationArgs): DashboardNavigationState {
  const suppressUrlSyncRef = useRef(false);
  const viewBeforeClientRef = useRef<ViewType>("list");
  const pageBeforeClientRef = useRef(1);

  const navigateDashboard = useCallback(
    (route: DashboardRoute, options?: { replace?: boolean }) => {
      suppressUrlSyncRef.current = true;
      applyRoute(route, setCurrentView, setRouteClientId, setRouteSection, onRouteApplied);
      const url = buildDashboardUrl(route);
      if (options?.replace) {
        window.history.replaceState({ dashboardRoute: route }, "", url);
      } else {
        window.history.pushState({ dashboardRoute: route }, "", url);
      }
      queueMicrotask(() => {
        suppressUrlSyncRef.current = false;
      });
    },
    [setCurrentView, setRouteClientId, setRouteSection, onRouteApplied],
  );

  const openClient = useCallback(
    (
      clientId: string,
      options?: {
        view?: ViewType;
        section?: ClientDetailSection;
        replace?: boolean;
      },
    ) => {
      if (PATIENT_LIST_VIEWS.has(currentView)) {
        viewBeforeClientRef.current = currentView;
        pageBeforeClientRef.current = listPage;
      }
      navigateDashboard(
        {
          view: options?.view ?? currentView,
          clientId,
          section: options?.section,
        },
        { replace: options?.replace },
      );
    },
    [currentView, listPage, navigateDashboard],
  );

  const closeClient = useCallback(
    (options?: { view?: ViewType }) => {
      let view = options?.view ?? viewBeforeClientRef.current ?? currentView;
      if (!PATIENT_LIST_VIEWS.has(view)) {
        view = PATIENT_LIST_VIEWS.has(currentView) ? currentView : "list";
      }
      const page = pageBeforeClientRef.current;
      navigateDashboard({
        view,
        page: page > 1 ? page : undefined,
      });
    },
    [currentView, navigateDashboard],
  );

  useEffect(() => {
    if (!enabled) return undefined;

    const syncFromLocation = () => {
      if (suppressUrlSyncRef.current) return;
      const parsed = parseDashboardRoute();
      if (!parsed) return;
      applyRoute(parsed, setCurrentView, setRouteClientId, setRouteSection, onRouteApplied);
    };

    syncFromLocation();

    const onPopState = () => syncFromLocation();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [enabled, setCurrentView, setRouteClientId, setRouteSection, onRouteApplied]);

  return {
    routeClientId,
    routeSection,
    navigateDashboard,
    openClient,
    closeClient,
  };
}
