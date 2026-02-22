// Sidebar Component

import { useState } from "react";
import { useDashboard } from "../../context/DashboardContext";
import { ViewType } from "../../types";
import { formatProviderDisplayName } from "../../utils/providerHelpers";
import HelpRequestModal from "../modals/HelpRequestModal";
import "./Sidebar.css";

interface SidebarProps {
  onLogout: () => void;
}

export default function Sidebar({ onLogout }: SidebarProps) {
  const { provider, currentView, setCurrentView } = useDashboard();
  const [showHelpModal, setShowHelpModal] = useState(false);

  const handleViewChange = (view: ViewType) => {
    setCurrentView(view);
  };

  const getLogoUrl = (): string | null => {
    if (!provider) return null;

    const logo = provider.logo || provider.Logo;
    if (!logo) return null;

    if (Array.isArray(logo) && logo.length > 0) {
      return (
        logo[0].url ||
        logo[0].thumbnails?.large?.url ||
        logo[0].thumbnails?.full?.url ||
        null
      );
    }
    if (typeof logo === "string") {
      return logo;
    }
    if (logo.url) {
      return logo.url;
    }
    return null;
  };

  const logoUrl = getLogoUrl();
  const displayName = formatProviderDisplayName(provider?.name);
  const providerInitial = displayName?.charAt(0).toUpperCase() || "P";

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={`${displayName || "Provider"} Logo`}
              className="logo-image"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                // Show fallback when image fails to load
                const logoContainer = (e.target as HTMLImageElement)
                  .parentElement;
                if (logoContainer) {
                  const fallback = document.createElement("div");
                  fallback.className = "logo-fallback";
                  fallback.innerHTML = `<span class="logo-icon">${providerInitial}</span>`;
                  logoContainer.appendChild(fallback);
                }
              }}
            />
          ) : (
            <div className="logo-fallback">
              <span className="logo-icon">{providerInitial}</span>
            </div>
          )}
        </div>
      </div>

      <nav className="sidebar-nav">
        <a
          href="#"
          className={`nav-item nav-item--all-clients ${
            currentView === "list" || currentView === "cards" ? "active" : ""
          }`}
          onClick={(e) => {
            e.preventDefault();
            handleViewChange("list");
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="8" y1="6" x2="21" y2="6"></line>
            <line x1="8" y1="12" x2="21" y2="12"></line>
            <line x1="8" y1="18" x2="21" y2="18"></line>
            <line x1="3" y1="6" x2="3.01" y2="6"></line>
            <line x1="3" y1="12" x2="3.01" y2="12"></line>
            <line x1="3" y1="18" x2="3.01" y2="18"></line>
          </svg>
          All Clients
        </a>
        {(provider?.code || "").trim().toLowerCase() === "lakeshore153" && (
          <>
            <div className="nav-divider"></div>
            <a
              href="#"
              className={`nav-item ${currentView === "offers" ? "active" : ""}`}
              onClick={(e) => {
                e.preventDefault();
                handleViewChange("offers");
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                <line x1="7" y1="7" x2="7.01" y2="7"></line>
              </svg>
              Offers
            </a>
          </>
        )}
        <div className="nav-divider"></div>
        <a
          href="#"
          className={`nav-item ${currentView === "inbox" ? "active" : ""}`}
          onClick={(e) => {
            e.preventDefault();
            handleViewChange("inbox");
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
          Inbox
        </a>
        <div className="nav-divider"></div>
        <a
          href="#"
          className={`nav-item ${currentView === "archived" ? "active" : ""}`}
          onClick={(e) => {
            e.preventDefault();
            handleViewChange("archived");
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
          Archived Clients
        </a>
      </nav>

      <div className="sidebar-footer">
        <a
          href="#"
          className="nav-item"
          onClick={(e) => {
            e.preventDefault();
            setShowHelpModal(true);
          }}
          title="Request Help"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          Help
        </a>
        <a
          href="#"
          className="nav-item"
          onClick={(e) => {
            e.preventDefault();
            onLogout();
          }}
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
          Logout
        </a>
      </div>

      {showHelpModal && (
        <HelpRequestModal onClose={() => setShowHelpModal(false)} />
      )}
    </aside>
  );
}
