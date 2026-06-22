// Main Dashboard Layout Component

// import React from 'react';
import { useState, useEffect, useCallback } from "react";
import { useDashboard } from "../../context/DashboardContext";
import { useCompactDashboardChrome } from "../../hooks/useCompactDashboardChrome";
import { providerHasSmsAndSettingsAccess } from "../../utils/providerPrivileges";
import Sidebar from "./Sidebar";
import Header from "./Header";
import ViewControls from "./ViewControls";
import ListView from "../views/ListView";
import KanbanView from "../views/KanbanView";
import ArchivedView from "../views/ArchivedView";
import FacialAnalysisView from "../views/FacialAnalysisView";
import OffersView from "../views/OffersView";
import InboxView from "../views/InboxView";
import SmsHistoryView from "../views/SmsHistoryView";
import SettingsView from "../views/SettingsView";
import FirebaseAdminPage from "../pages/FirebaseAdminPage";
import ClientDetailPanel from "../views/ClientDetailPanel";
import ReleaseNotesModal, {
  shouldShowReleaseNotes,
  dismissReleaseNotes,
} from "../modals/ReleaseNotesModal";
import ClinicScanHost from "../modals/ClinicScanHost";
import DashboardEmbedView from "../views/DashboardEmbedView";
import { isDashboardEmbedMode } from "../../utils/dashboardRoutes";
import "./DashboardLayout.css";

interface DashboardLayoutProps {
  onLogout: () => void;
}

function DashboardViews() {
  const { currentView, navigateDashboard } = useDashboard();

  switch (currentView) {
    case "kanban":
      return <KanbanView />;
    case "leads":
      return <ListView />;
    case "archived":
      return <ArchivedView />;
    case "offers":
      return <OffersView />;
    case "inbox":
      return <InboxView />;
    case "sms-history":
      return <SmsHistoryView />;
    case "settings":
      return <SettingsView />;
    case "user-admin":
      return (
        <FirebaseAdminPage
          embedded
          onLeaveEmbedded={() => navigateDashboard({ view: "list" })}
        />
      );
    case "facial-analysis":
    case "cards":
      return <FacialAnalysisView />;
    case "list":
    default:
      return <ListView />;
  }
}

function DashboardClientDetailRoute() {
  const {
    clients,
    closeClient,
    loading,
    provider,
    refreshClients,
    routeClientId,
    routeSection,
  } = useDashboard();
  const client = routeClientId
    ? clients.find((candidate) => candidate.id === routeClientId)
    : null;
  const handleClientDetailUpdate = useCallback(() => {
    void refreshClients(true);
  }, [refreshClients]);

  if (!routeClientId) return <DashboardViews />;

  if (!client && (loading || !provider)) {
    return (
      <div className="dashboard-client-detail-placeholder" aria-live="polite">
        <div className="spinner spinner-with-margin" />
        <p>Loading patient...</p>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="dashboard-client-detail-placeholder">
        <div className="dashboard-client-detail-placeholder__card">
          <h2>Patient not found</h2>
          <p>This patient is not available for the current provider login.</p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => closeClient()}
          >
            Back to patients
          </button>
        </div>
      </div>
    );
  }

  return (
    <ClientDetailPanel
      client={client}
      onClose={closeClient}
      onUpdate={handleClientDetailUpdate}
      initialSection={routeSection ?? undefined}
    />
  );
}

const VIEWS_WITH_CONTROLS = [
  "list",
  "leads",
  "cards",
  "kanban",
  "facial-analysis",
  "archived",
];

export default function DashboardLayout({ onLogout }: DashboardLayoutProps) {
  const { currentView, navigateDashboard, provider, routeClientId } =
    useDashboard();
  const embedMode = isDashboardEmbedMode();
  const compactChrome = useCompactDashboardChrome();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);
  const showViewControls = VIEWS_WITH_CONTROLS.includes(currentView);

  useEffect(() => {
    if (!compactChrome) setNavDrawerOpen(false);
  }, [compactChrome]);

  useEffect(() => {
    if (!navDrawerOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [navDrawerOpen]);

  const toggleNavDrawer = () => setNavDrawerOpen((open) => !open);

  useEffect(() => {
    if (!providerHasSmsAndSettingsAccess(provider)) {
      if (
        currentView === "settings" ||
        currentView === "sms-history" ||
        currentView === "user-admin"
      ) {
        navigateDashboard({ view: "list" });
      }
    }
  }, [provider, currentView, navigateDashboard]);

  // Show release notes once per session, within the 1-week window, for logged-in users.
  useEffect(() => {
    if (provider && shouldShowReleaseNotes()) {
      setShowReleaseNotes(true);
    }
  }, [provider]);

  const handleCloseReleaseNotes = () => {
    dismissReleaseNotes();
    setShowReleaseNotes(false);
  };

  if (embedMode) {
    return <DashboardEmbedView />;
  }

  return (
    <div
      className={`dashboard-wrapper ${sidebarCollapsed ? "dashboard-wrapper--sidebar-collapsed" : ""}`}
    >
      <Sidebar
        onLogout={onLogout}
        overlayNav={compactChrome}
        collapsed={compactChrome ? false : sidebarCollapsed}
        onToggleCollapse={
          compactChrome ? undefined : () => setSidebarCollapsed((c) => !c)
        }
        mobileOpen={compactChrome && navDrawerOpen}
        onMobileClose={() => setNavDrawerOpen(false)}
      />
      <main className="main-content">
        <div className="dashboard-top-chrome">
          <Header
            onLogout={onLogout}
            showNavMenu={compactChrome}
            navMenuOpen={navDrawerOpen}
            onToggleNav={toggleNavDrawer}
          />
          {showViewControls && (
            <div className={routeClientId ? "view-controls-hidden" : undefined}>
              <ViewControls />
            </div>
          )}
        </div>
        <div className="dashboard-views-wrap">
          {routeClientId ? <DashboardClientDetailRoute /> : <DashboardViews />}
        </div>
      </main>
      {showReleaseNotes && (
        <ReleaseNotesModal onClose={handleCloseReleaseNotes} />
      )}
      <ClinicScanHost />
    </div>
  );
}
