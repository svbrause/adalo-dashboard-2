// Provider Login Screen Component

import { useState, FormEvent } from "react";
import { useDashboard } from "../../context/DashboardContext";
import { fetchProviderByCode, notifyLoginToSlack } from "../../services/api";
import {
  saveProviderInfo,
  hasSeenWelcome,
  markWelcomeAsSeen,
} from "../../utils/providerStorage";
import { Provider } from "../../types";
import WelcomeModal from "../modals/WelcomeModal";
import "./ProviderLoginScreen.css";

// Import images - Vite will process these and provide correct paths
import bannerImage from "../../assets/images/c7b64b22c326934b039cd1c199e0440201e31414fc13b0918fe293b61feb63dc.jpg";
import ponceLogo from "../../assets/images/ponce logo.png";

export default function ProviderLoginScreen() {
  const { setProvider } = useDashboard();
  const [providerCode, setProviderCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [loggedInProvider, setLoggedInProvider] = useState<Provider | null>(
    null,
  );
  const [showPassword, setShowPassword] = useState(false);

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
                </p>
              </div>
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
            </div>
          </div>
        </div>
      </div>

      {showWelcome && loggedInProvider && (
        <WelcomeModal onClose={() => setShowWelcome(false)} />
      )}
    </>
  );
}
