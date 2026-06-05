// Header Component

import { useState } from "react";
import { useDashboard } from "../../context/DashboardContext";
import AddClientModal from "../modals/AddClientModal";
import {
  getJotformUrl,
  formatProviderDisplayName,
} from "../../utils/providerHelpers";
import { isWellnestWellnessProviderCode } from "../../data/wellnestOfferings";
import { showToast } from "../../utils/toast";
import "./Header.css";

/** URL-encoded filename (spaces break some static hosts). */
const THE_TREATMENT_LOGO_PATH =
  "/post-visit-blueprint/videos/The%20Treatment%20Mint%20and%20Gray.png";

function getProviderLogoUrl(provider: any): string | null {
  if (!provider) return null;
  if (isWellnestWellnessProviderCode(provider.code)) {
    return "https://wellnestmd.com/wp-content/uploads/2024/12/nav-logo-5.svg";
  }
  const logo = provider.logo || provider.Logo;
  if (!logo) return null;
  if (Array.isArray(logo) && logo.length > 0) {
    return logo[0].url || logo[0].thumbnails?.large?.url || logo[0].thumbnails?.full?.url || null;
  }
  if (typeof logo === "string") return logo;
  if (logo.url) return logo.url;
  return null;
}

/** Provider codes that share one dashboard title and merged client list */
const THE_TREATMENT_CODES = ["TheTreatment250", "TheTreatment447"];
const THE_TREATMENT_DISPLAY_NAMES = [
  "The Treatment",
  "San Clemente, Henderson, and Newport Beach",
];

function isTheTreatmentProvider(provider: {
  code?: string;
  name?: string;
}): boolean {
  const codeMatch = THE_TREATMENT_CODES.some(
    (c) => c.toLowerCase() === (provider.code || "").toLowerCase(),
  );
  const nameTrimmed = (provider.name || "").trim();
  const nameMatch = THE_TREATMENT_DISPLAY_NAMES.some((n) => n === nameTrimmed);
  return codeMatch || nameMatch;
}

function getMobileLogoUrl(provider: any): string | null {
  if (!provider) return null;
  if (isTheTreatmentProvider(provider)) return THE_TREATMENT_LOGO_PATH;
  return getProviderLogoUrl(provider);
}

interface HeaderProps {
  onLogout?: () => void;
  /** Slide-out nav (phone-width viewport only). */
  showNavMenu?: boolean;
  navMenuOpen?: boolean;
  onToggleNav?: () => void;
}

export default function Header({
  onLogout,
  showNavMenu = false,
  navMenuOpen = false,
  onToggleNav,
}: HeaderProps) {
  const { provider, refreshClients, currentView, darkMode, setDarkMode } = useDashboard();
  const [showAddClient, setShowAddClient] = useState(false);
  const pageTitle =
    currentView === "user-admin"
      ? "Users and Roles"
      : provider
        ? isTheTreatmentProvider(provider)
          ? "The Treatment Provider Dashboard"
          : `${formatProviderDisplayName(provider.name)} Provider Dashboard`
        : "Clients";

  const handleScanInClinic = () => {
    if (!provider) {
      showToast("Provider information not available");
      return;
    }

    const formUrl = getJotformUrl(provider);
    window.open(formUrl, "_blank");
    showToast("Opening scan form for in-clinic scan");
  };

  const mobileLogoUrl = getMobileLogoUrl(provider);

  return (
    <>
      <header className="main-header">
        <div className="header-left">
          {showNavMenu && onToggleNav && (
            <button
              type="button"
              className={`header-nav-menu-btn${navMenuOpen ? " header-nav-menu-btn--open" : ""}`}
              onClick={onToggleNav}
              aria-label={navMenuOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={navMenuOpen}
              title={navMenuOpen ? "Close menu" : "Menu"}
            >
              {navMenuOpen ? (
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              ) : (
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <rect x="4" y="5" width="16" height="14" rx="2" />
                  <line x1="8" y1="9" x2="16" y2="9" />
                  <line x1="8" y1="13" x2="13" y2="13" />
                </svg>
              )}
            </button>
          )}
          {mobileLogoUrl && (
            <img
              src={mobileLogoUrl}
              alt=""
              className="header-mobile-logo"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
          <h2 className="page-title">{pageTitle}</h2>
        </div>
        <div className="header-right">
          {currentView !== "user-admin" && (
            <>
              <button
                className="btn-secondary scan-client-btn"
                onClick={handleScanInClinic}
              >
                Scan In-Clinic
              </button>
              <button
                className="btn-secondary"
                onClick={() => setShowAddClient(true)}
              >
                Add Client
              </button>
            </>
          )}
          <button
            type="button"
            className="dark-mode-toggle"
            onClick={() => setDarkMode(!darkMode)}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            title={darkMode ? "Light mode" : "Dark mode"}
          >
            {darkMode ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
          {onLogout && (
            <button
              type="button"
              className="header-logout-mobile"
              onClick={onLogout}
              title="Logout"
              aria-label="Logout"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              <span>Logout</span>
            </button>
          )}
        </div>
      </header>

      {showAddClient && provider && (
        <AddClientModal
          onClose={() => setShowAddClient(false)}
          onSuccess={refreshClients}
          providerId={provider.id}
        />
      )}

    </>
  );
}
