// Sidebar Component

import { useState, useEffect } from "react";
import { useDashboard } from "../../context/DashboardContext";
import { ViewType } from "../../types";
import { formatProviderDisplayName } from "../../utils/providerHelpers";
import { providerHasSmsAndSettingsAccess } from "../../utils/providerPrivileges";
import { isWellnestWellnessProviderCode } from "../../data/wellnestOfferings";
import HelpRequestModal from "../modals/HelpRequestModal";
import {
  DASHBOARD_OPEN_HELP_REQUEST_EVENT,
  type DashboardOpenHelpRequestDetail,
} from "../../utils/dashboardHelpEvents";
import "./Sidebar.css";

interface SidebarProps {
  onLogout: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ onLogout, collapsed = false, onToggleCollapse, mobileOpen = false, onMobileClose }: SidebarProps) {
  const { provider, currentView, setCurrentView } = useDashboard();
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [helpModalInitialMessage, setHelpModalInitialMessage] = useState("");

  const handleViewChange = (view: ViewType) => {
    setCurrentView(view);
    onMobileClose?.();
  };

  useEffect(() => {
    const onOpenHelp = (ev: Event) => {
      const e = ev as CustomEvent<DashboardOpenHelpRequestDetail>;
      const msg = e.detail?.initialMessage?.trim() ?? "";
      if (msg) setHelpModalInitialMessage(msg);
      setShowHelpModal(true);
    };
    window.addEventListener(
      DASHBOARD_OPEN_HELP_REQUEST_EVENT,
      onOpenHelp as EventListener,
    );
    return () =>
      window.removeEventListener(
        DASHBOARD_OPEN_HELP_REQUEST_EVENT,
        onOpenHelp as EventListener,
      );
  }, []);

  const getLogoUrl = (): string | null => {
    if (!provider) return null;
    if (isWellnestWellnessProviderCode(provider.code)) {
      return "https://wellnestmd.com/wp-content/uploads/2024/12/nav-logo-5.svg";
    }

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
  const canSmsAndSettings = providerHasSmsAndSettingsAccess(provider);

  return (
    <>
    {mobileOpen && <div className="sidebar-backdrop" onClick={onMobileClose} />}
    <aside className={`sidebar ${collapsed ? "sidebar--collapsed" : ""} ${mobileOpen ? "sidebar--mobile-open" : ""}`}>
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
        {onToggleCollapse && (
          <button
            type="button"
            className="sidebar-toggle"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <svg className="sidebar-toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                {/* >| expand */}
                <path d="M10 8 L14 12 L10 16" />
                <line x1="18" y1="4" x2="18" y2="20" />
              </svg>
            ) : (
              <svg className="sidebar-toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                {/* <| collapse */}
                <path d="M14 8 L10 12 L14 16" />
                <line x1="18" y1="4" x2="18" y2="20" />
              </svg>
            )}
          </button>
        )}
      </div>

      <nav className="sidebar-nav">
        <a
          href="#"
          className={`nav-item nav-item--all-clients ${
            currentView === "list" ||
            currentView === "cards" ||
            currentView === "kanban" ||
            currentView === "facial-analysis"
              ? "active"
              : ""
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
          <span className="nav-item-label">Clients</span>
        </a>
        <a
          href="#"
          className={`nav-item nav-item--website-leads ${
            currentView === "leads" ? "active" : ""
          }`}
          onClick={(e) => {
            e.preventDefault();
            handleViewChange("leads");
          }}
        >
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
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <span className="nav-item-label">Leads</span>
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
              <span className="nav-item-label">Offers</span>
            </a>
          </>
        )}
        {canSmsAndSettings && (
          <>
            <div className="nav-divider"></div>
            <a
              href="#"
              className={`nav-item ${currentView === "sms-history" ? "active" : ""}`}
              onClick={(e) => {
                e.preventDefault();
                handleViewChange("sms-history");
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
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              <span className="nav-item-label">Messages</span>
            </a>
          </>
        )}
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
          <span className="nav-item-label">Archived</span>
        </a>
      </nav>

      <div className="sidebar-footer">
        {canSmsAndSettings && (
          <a
            href="#"
            className={`nav-item ${currentView === "settings" ? "active" : ""}`}
            onClick={(e) => {
              e.preventDefault();
              handleViewChange("settings");
            }}
            title="Settings"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span className="nav-item-label">Settings</span>
          </a>
        )}
        <a
          href="#"
          className="nav-item"
          onClick={(e) => {
            e.preventDefault();
            setHelpModalInitialMessage("");
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
          <span className="nav-item-label">Help</span>
        </a>
        <a
          href="#"
          className="nav-item"
          onClick={(e) => {
            e.preventDefault();
            onMobileClose?.();
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
          <span className="nav-item-label">Logout</span>
        </a>
      </div>

      {showHelpModal && (
        <HelpRequestModal
          initialMessage={helpModalInitialMessage || undefined}
          onClose={() => {
            setShowHelpModal(false);
            setHelpModalInitialMessage("");
          }}
        />
      )}
    </aside>
    </>
  );
}
