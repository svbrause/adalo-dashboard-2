// Main Dashboard Layout Component

// import React from 'react';
import { useDashboard } from '../../context/DashboardContext';
import Sidebar from './Sidebar';
import Header from './Header';
import ViewControls from './ViewControls';
import ListView from '../views/ListView';
import KanbanView from '../views/KanbanView';
import ArchivedView from '../views/ArchivedView';
import FacialAnalysisView from '../views/FacialAnalysisView';
import './DashboardLayout.css';

interface DashboardLayoutProps {
  onLogout: () => void;
}

function DashboardViews() {
  const { currentView } = useDashboard();
  
  switch (currentView) {
    case 'kanban':
      return <KanbanView />;
    case 'archived':
      return <ArchivedView />;
    case 'facial-analysis':
    case 'cards':
      return <FacialAnalysisView />;
    case 'list':
    default:
      return <ListView />;
  }
}

export default function DashboardLayout({ onLogout }: DashboardLayoutProps) {
  return (
    <div className="dashboard-wrapper">
      <Sidebar onLogout={onLogout} />
      <main className="main-content">
        <Header />
        <ViewControls />
        <DashboardViews />
      </main>
    </div>
  );
}
