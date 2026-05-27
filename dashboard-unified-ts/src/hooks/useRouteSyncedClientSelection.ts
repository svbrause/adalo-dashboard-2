import { useCallback, useEffect } from "react";
import type { Client } from "../types";
import { useDashboard } from "../context/DashboardContext";

/**
 * Keeps a view's selected client in sync with `/client-details/:id` URLs.
 */
export function useRouteSyncedClientSelection(
  selectedClient: Client | null,
  setSelectedClient: (client: Client | null) => void,
) {
  const {
    clients,
    loading,
    routeClientId,
    routeSection,
    openClient,
    closeClient,
    currentView,
  } = useDashboard();

  useEffect(() => {
    if (!routeClientId) {
      if (selectedClient) setSelectedClient(null);
      return;
    }
    if (loading && clients.length === 0) return;
    const match = clients.find((c) => c.id === routeClientId);
    if (match) {
      if (selectedClient?.id !== match.id) setSelectedClient(match);
    } else if (!loading) {
      setSelectedClient(null);
    }
  }, [
    routeClientId,
    clients,
    loading,
    selectedClient,
    setSelectedClient,
  ]);

  const selectClient = useCallback(
    (client: Client) => {
      setSelectedClient(client);
      openClient(client.id, { view: currentView });
    },
    [setSelectedClient, openClient, currentView, routeSection],
  );

  const clearClient = useCallback(() => {
    setSelectedClient(null);
    closeClient();
  }, [setSelectedClient, closeClient]);

  return { selectClient, clearClient, routeSection };
}
