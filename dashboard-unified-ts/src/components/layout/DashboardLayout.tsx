// Main Dashboard Layout Component

// import React from 'react';
import { useState } from "react";
import { useDashboard } from "../../context/DashboardContext";
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
import "./DashboardLayout.css";

interface DashboardLayoutProps {
  onLogout: () => void;
}

function DashboardViews() {
  const { currentView } = useDashboard();

  switch (currentView) {
    case "kanban":
      return <KanbanView />;
    case "archived":
      return <ArchivedView />;
    case "offers":
      return <OffersView />;
    case "inbox":
      return <InboxView />;
    case "sms-history":
      return <SmsHistoryView />;
    case "facial-analysis":
    case "cards":
      return <FacialAnalysisView />;
    case "list":
    default:
      return <ListView />;
  }
}

const VIEWS_WITH_CONTROLS = ["list", "cards", "kanban", "facial-analysis", "archived"];

export default function DashboardLayout({ onLogout }: DashboardLayoutProps) {
  const { currentView } = useDashboard();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const showViewControls = VIEWS_WITH_CONTROLS.includes(currentView);

  return (
    <div className={`dashboard-wrapper ${sidebarCollapsed ? "dashboard-wrapper--sidebar-collapsed" : ""}`}>
      <Sidebar
        onLogout={onLogout}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
      />
      <main className="main-content">
        <Header onLogout={onLogout} />
        {showViewControls && <ViewControls />}
        <div className="dashboard-views-wrap">
          <DashboardViews />
        </div>
      </main>
    </div>
  );
}
