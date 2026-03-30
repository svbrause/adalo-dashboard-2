// Main Dashboard Layout Component

// import React from 'react';
import { useState, useEffect } from "react";
import { useDashboard } from "../../context/DashboardContext";
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
import "./DashboardLayout.css";

interface DashboardLayoutProps {
  onLogout: () => void;
}

function DashboardViews() {
  const { currentView } = useDashboard();

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
    case "facial-analysis":
    case "cards":
      return <FacialAnalysisView />;
    case "list":
    default:
      return <ListView />;
  }
}

const VIEWS_WITH_CONTROLS = ["list", "cards", "kanban", "facial-analysis", "leads", "archived"];

function MobileTabBar({ onMoreTap }: { onMoreTap: () => void }) {
  const { currentView, setCurrentView } = useDashboard();

  const isClientsTab = ["list", "cards", "kanban", "facial-analysis"].includes(currentView);
  const isLeadsTab = currentView === "leads";
  const isArchivedTab = currentView === "archived";

  return (
    <nav className="mobile-tab-bar">
      <button
        type="button"
        className={`mobile-tab ${isClientsTab ? "mobile-tab--active" : ""}`}
        onClick={() => setCurrentView("list")}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <span>Clients</span>
      </button>
      <button
        type="button"
        className={`mobile-tab ${isLeadsTab ? "mobile-tab--active" : ""}`}
        onClick={() => setCurrentView("leads")}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
        <span>Leads</span>
      </button>
      <button
        type="button"
        className={`mobile-tab ${isArchivedTab ? "mobile-tab--active" : ""}`}
        onClick={() => setCurrentView("archived")}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 8v13H3V8" />
          <path d="M1 3h22v5H1z" />
          <path d="M10 12h4" />
        </svg>
        <span>Archived</span>
      </button>
      <button
        type="button"
        className="mobile-tab"
        onClick={onMoreTap}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
        <span>More</span>
      </button>
    </nav>
  );
}

export default function DashboardLayout({ onLogout }: DashboardLayoutProps) {
  const { currentView, setCurrentView, provider } = useDashboard();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const showViewControls = VIEWS_WITH_CONTROLS.includes(currentView);

  useEffect(() => {
    if (!providerHasSmsAndSettingsAccess(provider)) {
      if (currentView === "settings" || currentView === "sms-history") {
        setCurrentView("list");
      }
    }
  }, [provider, currentView, setCurrentView]);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [currentView]);

  return (
    <div className={`dashboard-wrapper ${sidebarCollapsed ? "dashboard-wrapper--sidebar-collapsed" : ""}`}>
      <Sidebar
        onLogout={onLogout}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />
      <main className="main-content">
        <Header onLogout={onLogout} />
        {showViewControls && <ViewControls />}
        <div className="dashboard-views-wrap">
          <DashboardViews />
        </div>
        <MobileTabBar onMoreTap={() => setMobileSidebarOpen(true)} />
      </main>
    </div>
  );
}
