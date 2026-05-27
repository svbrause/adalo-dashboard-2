import { useCallback, useEffect, useRef } from "react";
import type { ViewType } from "../types";
import {
  buildDashboardUrl,
  parseDashboardRoute,
  type ClientDetailSection,
  type DashboardRoute,
} from "../utils/dashboardRoutes";

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
  enabled: boolean;
};

function applyRoute(
  route: DashboardRoute,
  setCurrentView: (view: ViewType) => void,
  setRouteClientId: (id: string | null) => void,
  setRouteSection: (section: ClientDetailSection | null) => void,
) {
  setCurrentView(route.view);
  setRouteClientId(route.clientId ?? null);
  setRouteSection(route.section ?? null);
}

export function useDashboardNavigation({
  currentView,
  setCurrentView,
  routeClientId,
  setRouteClientId,
  routeSection,
  setRouteSection,
  enabled,
}: UseDashboardNavigationArgs): DashboardNavigationState {
  const suppressUrlSyncRef = useRef(false);

  const navigateDashboard = useCallback(
    (route: DashboardRoute, options?: { replace?: boolean }) => {
      suppressUrlSyncRef.current = true;
      applyRoute(route, setCurrentView, setRouteClientId, setRouteSection);
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
    [setCurrentView, setRouteClientId, setRouteSection],
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
      navigateDashboard(
        {
          view: options?.view ?? currentView,
          clientId,
          section: options?.section,
        },
        { replace: options?.replace },
      );
    },
    [currentView, navigateDashboard],
  );

  const closeClient = useCallback(
    (options?: { view?: ViewType }) => {
      navigateDashboard({ view: options?.view ?? currentView });
    },
    [currentView, navigateDashboard],
  );

  useEffect(() => {
    if (!enabled) return undefined;

    const syncFromLocation = () => {
      if (suppressUrlSyncRef.current) return;
      const parsed = parseDashboardRoute();
      if (!parsed) return;
      applyRoute(parsed, setCurrentView, setRouteClientId, setRouteSection);
    };

    syncFromLocation();

    const onPopState = () => syncFromLocation();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [enabled, setCurrentView, setRouteClientId, setRouteSection]);

  return {
    routeClientId,
    routeSection,
    navigateDashboard,
    openClient,
    closeClient,
  };
}
