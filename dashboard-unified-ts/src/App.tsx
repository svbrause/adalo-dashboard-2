// Main App component

import { useEffect, useState } from "react";
import { DashboardProvider, useDashboard } from "./context/DashboardContext";
import {
  FirebaseAuthProvider,
  useFirebaseAuth,
} from "./context/FirebaseAuthContext";
import { loadProviderInfo, clearProviderInfo } from "./utils/providerStorage";
import ProviderLoginScreen from "./components/auth/ProviderLoginScreen";
import DashboardLayout from "./components/layout/DashboardLayout";
import DebugTreatmentExamplesPage from "./debug/DebugTreatmentExamplesPage";
import DebugTreatmentPlanPage from "./debug/DebugTreatmentPlanPage";
import DebugPatientIssuesPage from "./debug/DebugPatientIssuesPage";
import DebugIndexPage from "./debug/DebugIndexPage";
import DebugClientDetailPage from "./components/debug/DebugClientDetailPage";
import SkinQuizStandalonePage from "./components/pages/SkinQuizStandalonePage";
import PostVisitBlueprintPage from "./components/pages/PostVisitBlueprintPage";
import ProviderAdConceptsPage from "./components/pages/ProviderAdConceptsPage";
import { isSkinQuizStandalonePath } from "./utils/skinQuizLink";
import { isPostVisitBlueprintPath } from "./utils/postVisitBlueprint";
import FirebaseAdminPage from "./components/pages/FirebaseAdminPage";
import StaffForgotPasswordPage from "./components/auth/StaffForgotPasswordPage";
import AuthActionPage from "./components/auth/AuthActionPage";
import "./styles/index.css";

/** Detect debug route from pathname or ?debug= (no provider required). */
function getDebugRoute():
  | "index"
  | "treatment-examples"
  | "treatment-plan"
  | "patient-issues"
  | "client-detail"
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
  if (path === "/debug/client-detail" || q === "client-detail") return "client-detail";
  return null;
}

/** Internal marketing brainstorm — not linked from nav. */
function isProviderAdConceptsPath(): boolean {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  return path === "/internal/provider-ad-concepts";
}

/** Users and Roles (no provider-code login required). */
function isFirebaseAdminPath(): boolean {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  return path === "/admin/firebase";
}

/** Staff Firebase password reset (dedicated screen; no provider-code session required). */
function isStaffForgotPasswordPath(): boolean {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  return path === "/forgot-password";
}

/** Firebase email link handler (reset password, verify email, etc.) — set Action URL in Firebase Console. */
function isAuthActionPath(): boolean {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  return path === "/auth/action";
}

function AppContent() {
  const debugRoute = getDebugRoute();
  const { provider, setProvider } = useDashboard();
  const { user: firebaseUser, signOutFirebase } = useFirebaseAuth();
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
    if (!window.confirm("Are you sure you want to logout?")) {
      return;
    }
    if (window.posthog) {
      window.posthog.capture("user_logged_out");
      window.posthog.reset();
    }
    void (async () => {
      if (firebaseUser) {
        await signOutFirebase().catch(() => {
          /* ignore sign-out errors; still clear local session */
        });
      }
      clearProviderInfo();
      setProvider(null);
    })();
  };

  // Public standalone skin quiz (unique link from SMS) – no login
  if (isSkinQuizStandalonePath()) {
    return <SkinQuizStandalonePage />;
  }
  // Public shared treatment plan (`/tp`, `/treatment-plan`, legacy `/post-visit-blueprint`) – no login
  if (isPostVisitBlueprintPath()) {
    return <PostVisitBlueprintPage />;
  }

  if (isProviderAdConceptsPath()) {
    return <ProviderAdConceptsPage />;
  }

  if (isFirebaseAdminPath()) {
    return <FirebaseAdminPage />;
  }

  if (isAuthActionPath()) {
    return <AuthActionPage />;
  }

  if (isStaffForgotPasswordPath()) {
    return <StaffForgotPasswordPage />;
  }

  // Debug pages: same components as dashboard, dummy data, no login
  if (debugRoute === "index") return <DebugIndexPage />;
  if (debugRoute === "treatment-examples")
    return <DebugTreatmentExamplesPage />;
  if (debugRoute === "treatment-plan") return <DebugTreatmentPlanPage />;
  if (debugRoute === "patient-issues") return <DebugPatientIssuesPage />;
  if (debugRoute === "client-detail") return <DebugClientDetailPage />;

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
      <FirebaseAuthProvider>
        <AppContent />
      </FirebaseAuthProvider>
    </DashboardProvider>
  );
}

export default App;
