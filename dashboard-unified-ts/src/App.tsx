// Main App component

import { useEffect, useState } from "react";
import { DashboardProvider, useDashboard } from "./context/DashboardContext";
import { loadProviderInfo, clearProviderInfo } from "./utils/providerStorage";
import ProviderLoginScreen from "./components/auth/ProviderLoginScreen";
import DashboardLayout from "./components/layout/DashboardLayout";
import DebugTreatmentExamplesPage from "./debug/DebugTreatmentExamplesPage";
import DebugTreatmentPlanPage from "./debug/DebugTreatmentPlanPage";
import DebugPatientIssuesPage from "./debug/DebugPatientIssuesPage";
import DebugIndexPage from "./debug/DebugIndexPage";
import "./styles/index.css";

/** Detect debug route from pathname or ?debug= (no provider required). */
function getDebugRoute():
  | "index"
  | "treatment-examples"
  | "treatment-plan"
  | "patient-issues"
  | null {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  const params = new URLSearchParams(window.location.search);
  const q = params.get("debug");
  if (path === "/debug" || path === "/debug/") return "index";
  if (path === "/debug/treatment-examples" || q === "treatment-examples")
    return "treatment-examples";
  if (path === "/debug/treatment-plan" || q === "treatment-plan")
    return "treatment-plan";
  if (path === "/debug/patient-issues" || q === "patient-issues")
    return "patient-issues";
  return null;
}

function AppContent() {
  const debugRoute = getDebugRoute();
  const { provider, setProvider } = useDashboard();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedProvider = loadProviderInfo();
    if (savedProvider) {
      setProvider(savedProvider.info);
      if (window.posthog && savedProvider.info) {
        window.posthog.identify(savedProvider.info.id, {
          email: savedProvider.info.email,
          name: savedProvider.info.name,
        });
      }
    }
    setIsLoading(false);
  }, [setProvider]);

  useEffect(() => {
    if (provider && window.posthog) {
      window.posthog.capture("dashboard_viewed", {
        provider_id: provider.id,
        provider_name: provider.name,
      });
    }
  }, [provider]);

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      if (window.posthog) {
        window.posthog.capture("user_logged_out");
        window.posthog.reset();
      }
      clearProviderInfo();
      setProvider(null);
    }
  };

  // Debug pages: same components as dashboard, dummy data, no login
  if (debugRoute === "index") return <DebugIndexPage />;
  if (debugRoute === "treatment-examples")
    return <DebugTreatmentExamplesPage />;
  if (debugRoute === "treatment-plan") return <DebugTreatmentPlanPage />;
  if (debugRoute === "patient-issues") return <DebugPatientIssuesPage />;

  if (isLoading) {
    return <div className="flex-center loading-screen">Loading...</div>;
  }

  if (!provider) {
    return <ProviderLoginScreen />;
  }

  return <DashboardLayout onLogout={handleLogout} />;
}

function App() {
  useEffect(() => {
    document.body.classList.add("pastel-teal-theme");
    return () => document.body.classList.remove("pastel-teal-theme");
  }, []);
  return (
    <DashboardProvider>
      <AppContent />
    </DashboardProvider>
  );
}

export default App;
