// Main App component

import { useEffect, useState } from "react";
import { DashboardProvider, useDashboard } from "./context/DashboardContext";
import { loadProviderInfo, clearProviderInfo } from "./utils/providerStorage";
import ProviderLoginScreen from "./components/auth/ProviderLoginScreen";
import DashboardLayout from "./components/layout/DashboardLayout";
import "./styles/index.css";

function AppContent() {
  const { provider, setProvider } = useDashboard();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if provider is already logged in
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

  if (isLoading) {
    return <div className="flex-center loading-screen">Loading...</div>;
  }

  if (!provider) {
    return <ProviderLoginScreen />;
  }

  return <DashboardLayout onLogout={handleLogout} />;
}

function App() {
  return (
    <DashboardProvider>
      <AppContent />
    </DashboardProvider>
  );
}

export default App;
