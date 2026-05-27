/**
 * Full-viewport dashboard surface for deck iframes (`?embed=1`).
 * Client URLs open ClientDetailPanel only; view URLs show the main view without chrome.
 */

import { useState } from "react";
import type { Client } from "../../types";
import { useDashboard } from "../../context/DashboardContext";
import { useRouteSyncedClientSelection } from "../../hooks/useRouteSyncedClientSelection";
import ClientDetailPanel from "./ClientDetailPanel";
import ListView from "./ListView";
import KanbanView from "./KanbanView";
import ArchivedView from "./ArchivedView";
import FacialAnalysisView from "./FacialAnalysisView";
import InboxView from "./InboxView";
import "./DashboardEmbedView.css";

function EmbedMainView() {
  const { currentView } = useDashboard();
  switch (currentView) {
    case "kanban":
      return <KanbanView />;
    case "inbox":
      return <InboxView />;
    case "facial-analysis":
    case "cards":
      return <FacialAnalysisView />;
    case "archived":
      return <ArchivedView />;
    case "list":
    case "leads":
    default:
      return <ListView />;
  }
}

function EmbedClientDetail() {
  const { clients, loading, routeSection, refreshClients } = useDashboard();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  useRouteSyncedClientSelection(selectedClient, setSelectedClient);

  if (!loading && !selectedClient) {
    return (
      <div className="dashboard-embed-placeholder">
        <p>Log in as <strong>Admin</strong> in the dashboard, then reload this embed.</p>
        <p className="dashboard-embed-placeholder__hint">
          Demo patient: Tanya Tan (<code>admin-demo-tanya</code>)
        </p>
      </div>
    );
  }

  if (!selectedClient) {
    return (
      <div className="dashboard-embed-placeholder">
        <p>Loading patient…</p>
      </div>
    );
  }

  return (
    <ClientDetailPanel
      client={clients.find((c) => c.id === selectedClient.id) ?? selectedClient}
      onClose={() => {}}
      onUpdate={() => refreshClients(true)}
      initialSection={routeSection ?? undefined}
    />
  );
}

export default function DashboardEmbedView() {
  const { routeClientId } = useDashboard();

  return (
    <div className="dashboard-embed-shell">
      {routeClientId ? <EmbedClientDetail /> : <EmbedMainView />}
    </div>
  );
}
