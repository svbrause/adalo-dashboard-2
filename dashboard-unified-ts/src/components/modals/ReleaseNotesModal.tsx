// Release Notes Modal — v2.5.0 (April 2026)
// High-level highlights + icons; copy aligned with RELEASE_NOTES_v2.5.0.md

import { useEffect, type ReactNode } from "react";
import "./ReleaseNotesModal.css";

const VERSION = "v2.5.0";
const RELEASE_LABEL = "April 2026";
/** UTC timestamp after which the popup stops auto-appearing (7 days from release: 2026-04-20). */
const RELEASE_EXPIRES_AT = new Date("2026-04-20T00:00:00Z").getTime();
const LS_KEY = "rn_v2_5_0_dismissed";

export function shouldShowReleaseNotes(): boolean {
  if (Date.now() > RELEASE_EXPIRES_AT) return false;
  try {
    return localStorage.getItem(LS_KEY) !== "1";
  } catch {
    return false;
  }
}

export function dismissReleaseNotes(): void {
  try {
    localStorage.setItem(LS_KEY, "1");
  } catch {
    // ignore private-mode failures
  }
}

const INTRO =
  "This release focuses on Settings, the treatment plan experience, how leads appear alongside clients, and at-a-glance status on each client row.";

type HighlightIcon = "settings" | "list" | "plan" | "quiz" | "leads";

const HIGHLIGHTS: {
  icon: HighlightIcon;
  title: string;
  body: ReactNode;
}[] = [
  {
    icon: "settings",
    title: "Settings hub for notifications & pricing",
    body: (
      <>
        Notifications and treatment pricing each have their own page, with live
        previews and <strong>Request changes</strong> when you need updates from
        support.
      </>
    ),
  },
  {
    icon: "list",
    title: "Section icons on the client list",
    body: (
      <>
        Each row shows three icons for <strong>Plan</strong>, <strong>Analysis</strong>, and{" "}
        <strong>Quiz</strong> (in that order). A <strong>check</strong> means that area is complete
        or on track (e.g. plan has items, quiz finished, analysis ready). A <strong>minus</strong>{" "}
        means not started, or no plan items yet. Facial analysis can show a <strong>clock</strong>{" "}
        while it&rsquo;s still pending.
      </>
    ),
  },
  {
    icon: "plan",
    title: "Unified edit panel for each treatment",
    body: (
      <>
        Quantity, areas, notes, and other optional fields live in <strong>one panel</strong> with
        labelled sections—only what applies to that treatment appears.
      </>
    ),
  },
  {
    icon: "quiz",
    title: "Skincare quiz on the recommender",
    body: "Client quiz results (skin type and sensitivities) stay visible above treatment suggestions while you build a plan.",
  },
  {
    icon: "leads",
    title: "Leads on their own screen",
    body: (
      <>
        Treatment Finder leads use a dedicated <strong>Leads</strong> view, separate
        from your in-clinic client list.
      </>
    ),
  },
];

const STAFF_NOTE =
  "Change requests sent from Settings go to the support team—allow a little time after approval for everything to update.";

function HighlightIconSvg({ kind }: { kind: HighlightIcon }) {
  const common = {
    className: "rn-highlight-icon-svg",
    viewBox: "0 0 24 24",
    width: 22,
    height: 22,
    fill: "none" as const,
    "aria-hidden": true as const,
  };
  switch (kind) {
    case "settings":
      return (
        <svg {...common}>
          <path
            d="M4 7h16M4 12h16M4 17h16"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <circle cx="15" cy="7" r="2.25" fill="currentColor" />
          <circle cx="9" cy="12" r="2.25" fill="currentColor" />
          <circle cx="14" cy="17" r="2.25" fill="currentColor" />
        </svg>
      );
    case "list":
      return (
        <svg {...common}>
          <circle cx="6" cy="7" r="1.75" fill="currentColor" />
          <path
            d="M10 7h11"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <circle cx="6" cy="12" r="1.75" fill="currentColor" />
          <path
            d="M10 12h11"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <circle cx="6" cy="17" r="1.75" fill="currentColor" />
          <path
            d="M10 17h11"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      );
    case "plan":
      return (
        <svg {...common}>
          <rect
            x="3"
            y="4"
            width="18"
            height="16"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <path d="M3 9h18" stroke="currentColor" strokeWidth="1.75" />
          <path
            d="M7 13h6M7 17h4"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      );
    case "quiz":
      return (
        <svg {...common}>
          <path
            d="M9 3h4l3 3v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          <path
            d="M9 11h6M9 15h4"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <path
            d="m21 21-3-3"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      );
    case "leads":
      return (
        <svg {...common}>
          <path
            d="M8 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3Z"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <path
            d="M4 21v-1a4 4 0 0 1 4-4h.5M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3Z"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <path
            d="M20 21v-1a4 4 0 0 0-3-3.87M13 7.5a3 3 0 0 0-6 0"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

interface ReleaseNotesModalProps {
  onClose: () => void;
}

export default function ReleaseNotesModal({ onClose }: ReleaseNotesModalProps) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  return (
    <div
      className="rn-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-labelledby="rn-dialog-title"
    >
      <div className="rn-modal rn-modal--simple" onClick={(e) => e.stopPropagation()}>
        <div className="rn-accent-bar" aria-hidden />
        <div className="rn-header">
          <div className="rn-header-left">
            <span className="rn-version-badge">{VERSION}</span>
            <div>
              <h2 id="rn-dialog-title" className="rn-title">
                What&rsquo;s new
              </h2>
              <p className="rn-subtitle">
                {RELEASE_LABEL} &middot; Provider Dashboard
              </p>
            </div>
          </div>
          <button type="button" className="rn-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="rn-simple-body">
          <p className="rn-intro">{INTRO}</p>

          <ul className="rn-highlights" role="list">
            {HIGHLIGHTS.map((h) => (
              <li key={h.title} className="rn-highlight">
                <div className="rn-highlight-icon" aria-hidden>
                  <HighlightIconSvg kind={h.icon} />
                </div>
                <div className="rn-highlight-copy">
                  <h3 className="rn-highlight-title">{h.title}</h3>
                  <p className="rn-highlight-text">{h.body}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="rn-staff-note">
            <p className="rn-staff-note-label">Notes for staff</p>
            <p className="rn-staff-note-text">{STAFF_NOTE}</p>
          </div>
        </div>

        <div className="rn-footer">
          <p className="rn-footer-note">
            Reach us at{" "}
            <a href="mailto:support@ponce.ai" className="rn-footer-link">
              support@ponce.ai
            </a>{" "}
            or use <strong>Get Support</strong> in the left sidebar.
          </p>
          <button type="button" className="btn-primary rn-cta" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
