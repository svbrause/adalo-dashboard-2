// Header Component

import { useState, useEffect, useRef } from "react";
import { useDashboard } from "../../context/DashboardContext";
import AddClientModal from "../modals/AddClientModal";
import NewClientSMSModal from "../modals/NewClientSMSModal";
import {
  getJotformUrl,
  formatProviderDisplayName,
  isUniqueAestheticsProvider,
} from "../../utils/providerHelpers";
import { isWellnestWellnessProviderCode } from "../../data/wellnestOfferings";
import { showToast } from "../../utils/toast";
import "./Header.css";

const THE_TREATMENT_LOGO_PATH = "/post-visit-blueprint/videos/The Treatment Mint and Gray.png";

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
}

export default function Header({ onLogout }: HeaderProps) {
  const { provider, refreshClients } = useDashboard();
  const [showAddClient, setShowAddClient] = useState(false);
  const [showScanDropdown, setShowScanDropdown] = useState(false);
  const [showNewClientSMS, setShowNewClientSMS] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pageTitle = provider
    ? isTheTreatmentProvider(provider)
      ? "The Treatment Provider Dashboard"
      : `${formatProviderDisplayName(provider.name)} Provider Dashboard`
    : "All Clients";

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowScanDropdown(false);
      }
    };

    if (showScanDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showScanDropdown]);

  const handleScanInClinic = () => {
    setShowScanDropdown(false);
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
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              <span>Logout</span>
            </button>
          )}
          <div className="scan-client-dropdown" ref={dropdownRef}>
            <button
              className="btn-secondary scan-client-btn"
              onClick={() => setShowScanDropdown(!showScanDropdown)}
            >
              New Scan
            </button>
            {showScanDropdown && (
              <div className="scan-client-dropdown-menu">
                <button
                  className="scan-client-option"
                  onClick={handleScanInClinic}
                >
                  Scan In-Clinic
                </button>
                {!isUniqueAestheticsProvider(provider) && (
                  <button
                    className="scan-client-option"
                    onClick={() => {
                      setShowScanDropdown(false);
                      setShowNewClientSMS(true);
                    }}
                  >
                    Scan At Home
                  </button>
                )}
              </div>
            )}
          </div>
          <button
            className="btn-secondary"
            onClick={() => setShowAddClient(true)}
          >
            Add Client
          </button>
        </div>
      </header>

      {showAddClient && provider && (
        <AddClientModal
          onClose={() => setShowAddClient(false)}
          onSuccess={refreshClients}
          providerId={provider.id}
        />
      )}

      {showNewClientSMS && (
        <NewClientSMSModal
          onClose={() => setShowNewClientSMS(false)}
          onSuccess={refreshClients}
        />
      )}
    </>
  );
}
