// Provider Login Screen Component

import { useState, useEffect, useCallback, FormEvent } from "react";
import { useDashboard } from "../../context/DashboardContext";
import { useFirebaseAuth } from "../../context/FirebaseAuthContext";
import {
  fetchProviderByCode,
  fetchProviderByRecordId,
  notifyLoginToSlack,
} from "../../services/api";
import { fetchAllPracticesForAdmin } from "../../services/providersDirectory";
import {
  saveProviderInfo,
  hasSeenWelcome,
  markWelcomeAsSeen,
} from "../../utils/providerStorage";
import { Provider } from "../../types";
import WelcomeModal from "../modals/WelcomeModal";
import {
  showStaffFirebaseAuthUi,
  firebaseStaffLoginOpensDashboard,
} from "../../firebase/config";
import StaffFirebaseAuthPanel from "./StaffFirebaseAuthPanel";
import "./ProviderLoginScreen.css";

// Import images - Vite will process these and provide correct paths
import bannerImage from "../../assets/images/c7b64b22c326934b039cd1c199e0440201e31414fc13b0918fe293b61feb63dc.jpg";
import ponceLogo from "../../assets/images/ponce logo.png";

/** Custom claim `admin: true` — user can pick any practice when `practiceIds` is missing. */
function idTokenClaimsAreAdmin(claims: Record<string, unknown>): boolean {
  return claims.admin === true || claims.admin === "true";
}

export default function ProviderLoginScreen() {
  const { setProvider } = useDashboard();
  const { user: firebaseUser, loading: firebaseAuthLoading } = useFirebaseAuth();
  const [providerCode, setProviderCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [loggedInProvider, setLoggedInProvider] = useState<Provider | null>(
    null,
  );
  const [showPassword, setShowPassword] = useState(false);

  const [staffDashResolving, setStaffDashResolving] = useState(false);
  const [practicePickOpen, setPracticePickOpen] = useState(false);
  const [practicePickOptions, setPracticePickOptions] = useState<
    { id: string; label: string }[]
  >([]);
  const [staffNoPracticeIds, setStaffNoPracticeIds] = useState(false);
  const [staffFirebaseGateDone, setStaffFirebaseGateDone] = useState(false);

  const finalizeStaffProviderLogin = useCallback(
    async (providerRecordId: string) => {
      const provider = await fetchProviderByRecordId(providerRecordId);
      saveProviderInfo(provider);
      setProvider(provider);
      setLoggedInProvider(provider);
      notifyLoginToSlack(provider);
      if (!hasSeenWelcome(provider.id)) {
        markWelcomeAsSeen(provider.id);
        setTimeout(() => setShowWelcome(true), 500);
      }
    },
    [setProvider],
  );

  useEffect(() => {
    if (!firebaseStaffLoginOpensDashboard()) {
      setStaffNoPracticeIds(false);
      setStaffFirebaseGateDone(true);
      return;
    }

    const user = firebaseUser;
    if (firebaseAuthLoading || !user) {
      setStaffNoPracticeIds(false);
      setStaffFirebaseGateDone(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setStaffNoPracticeIds(false);
      setStaffFirebaseGateDone(false);
      setStaffDashResolving(true);
      setError("");
      try {
        const { claims: tokenClaims } = await user.getIdTokenResult(true);
        if (cancelled) return;
        const claims = tokenClaims as Record<string, unknown>;

        const idsRaw = claims.practiceIds;
        const practiceIds = Array.isArray(idsRaw)
          ? idsRaw.filter(
              (x): x is string => typeof x === "string" && x.trim().length > 0,
            )
          : [];

        const isAdmin = idTokenClaimsAreAdmin(claims);

        if (practiceIds.length === 1) {
          if (cancelled) return;
          await finalizeStaffProviderLogin(practiceIds[0]);
          return;
        }

        if (practiceIds.length > 1) {
          const practices = await fetchAllPracticesForAdmin();
          if (cancelled) return;
          const opts = practiceIds.map((id) => {
            const p = practices.find((x) => x.id === id);
            const label = p
              ? `${p.name || "Practice"} (${p.code || id})`
              : `Provider ${id.slice(0, 8)}…`;
            return { id, label };
          });
          setPracticePickOptions(opts);
          setPracticePickOpen(true);
          return;
        }

        // No practiceIds on token: Firebase admins can choose any practice (same list as /admin/firebase).
        if (practiceIds.length === 0 && isAdmin) {
          const practices = await fetchAllPracticesForAdmin();
          if (cancelled) return;
          if (practices.length === 0) {
            if (!cancelled) setStaffNoPracticeIds(true);
            return;
          }
          const opts = practices.map((p) => ({
            id: p.id,
            label: `${p.name || "Practice"} (${p.code || p.id})`,
          }));
          setPracticePickOptions(opts);
          setPracticePickOpen(true);
          return;
        }

        if (practiceIds.length === 0) {
          if (!cancelled) setStaffNoPracticeIds(true);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "Could not open dashboard from staff account.",
          );
        }
      } finally {
        if (!cancelled) {
          setStaffDashResolving(false);
          setStaffFirebaseGateDone(true);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [firebaseUser?.uid, firebaseAuthLoading, finalizeStaffProviderLogin]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!providerCode.trim()) {
      setError("Please enter a provider code");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const provider = await fetchProviderByCode(providerCode.trim());
      // Ensure the code the user typed is on the provider (API may not return it).
      // This is required so the dashboard can merge patients for TheTreatment250/TheTreatment447.
      const providerWithCode = { ...provider, code: providerCode.trim() };

      // Save provider info (including code so merge works after refresh)
      saveProviderInfo(providerWithCode);
      setProvider(providerWithCode);
      setLoggedInProvider(providerWithCode);

      // Notify backend (e.g. for Slack); fire-and-forget, does not block login
      notifyLoginToSlack(providerWithCode);

      // Check if welcome modal should be shown
      if (!hasSeenWelcome(providerWithCode.id)) {
        markWelcomeAsSeen(providerWithCode.id);
        setTimeout(() => {
          setShowWelcome(true);
        }, 500);
      }
    } catch (err: any) {
      setError(err.message || "Invalid provider code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="login-screen">
        <div className="login-layout">
          {/* Left side: Banner Image */}
          <div className="login-banner">
            <img
              src={bannerImage}
              alt="Welcome Banner"
              className="banner-image"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>

          {/* Right side: Welcome Content and Login Form */}
          <div className="login-content">
            <div className="login-container">
              <div className="login-header">
                <div className="welcome-title">
                  <span className="welcome-text">Welcome to </span>
                  <img
                    src={ponceLogo}
                    alt="Ponce Logo"
                    className="welcome-logo"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
                <p className="welcome-subtitle">
                  Please enter your provider code to access your dashboard
                  {firebaseStaffLoginOpensDashboard() &&
                    showStaffFirebaseAuthUi() && (
                      <span className="login-subtitle-extra">
                        {" "}
                        Or sign in below with your staff email and password if your
                        account has been assigned to a practice.
                      </span>
                    )}
                </p>
              </div>
              {(staffDashResolving || practicePickOpen) && (
                <p className="staff-dash-status" aria-live="polite">
                  {practicePickOpen
                    ? "Choose which practice dashboard to open."
                    : "Opening your dashboard…"}
                </p>
              )}
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="provider-code">Provider Code</label>
                  <div className="password-input-wrapper">
                    <input
                      type={showPassword ? "text" : "password"}
                      id="provider-code"
                      name="providerCode"
                      required
                      placeholder="Enter your provider code"
                      autoComplete="off"
                      value={providerCode}
                      onChange={(e) => setProviderCode(e.target.value)}
                      className="password-input"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? (
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                          <line x1="1" y1="1" x2="23" y2="23"></line>
                        </svg>
                      ) : (
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                          <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                      )}
                    </button>
                  </div>
                  {error && (
                    <div className="error-message display-block">{error}</div>
                  )}
                </div>
                <button
                  type="submit"
                  className="btn-primary btn-login"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner spinner-inline"></span>
                      Loading...
                    </>
                  ) : (
                    "Access Dashboard"
                  )}
                </button>
              </form>
              {showStaffFirebaseAuthUi() && (
                <StaffFirebaseAuthPanel
                  openingDashboard={staffDashResolving}
                  awaitingPracticeChoice={practicePickOpen}
                  noPracticeAssignment={staffNoPracticeIds}
                  dashboardClaimCheckDone={
                    !firebaseStaffLoginOpensDashboard() ||
                    !firebaseUser ||
                    staffFirebaseGateDone
                  }
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {practicePickOpen && (
        <div
          className="practice-pick-backdrop"
          role="presentation"
          onClick={() => setPracticePickOpen(false)}
        >
          <div
            className="practice-pick-modal"
            role="dialog"
            aria-labelledby="practice-pick-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="practice-pick-title">Which practice?</h2>
            <p className="practice-pick-lead">
              Your account can access more than one. Pick one to load the
              dashboard.
            </p>
            <ul className="practice-pick-list">
              {practicePickOptions.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    className="practice-pick-btn"
                    onClick={() => {
                      void (async () => {
                        setPracticePickOpen(false);
                        setStaffDashResolving(true);
                        setError("");
                        try {
                          await finalizeStaffProviderLogin(o.id);
                        } catch (err) {
                          setError(
                            err instanceof Error
                              ? err.message
                              : "Could not load provider.",
                          );
                        } finally {
                          setStaffDashResolving(false);
                        }
                      })();
                    }}
                  >
                    {o.label}
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn-secondary practice-pick-cancel"
              onClick={() => setPracticePickOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showWelcome && loggedInProvider && (
        <WelcomeModal onClose={() => setShowWelcome(false)} />
      )}
    </>
  );
}
