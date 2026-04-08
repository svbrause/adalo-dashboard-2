import { useMemo, useState } from "react";
import {
  AUTOMATED_EMAILS,
  EMAIL_CATEGORY_LABELS,
  getActiveTeamRecipients,
  type AutomatedEmail,
  type EmailCategory,
} from "../../config/emailNotificationCatalog";
import "./ProviderTeamNotificationEmails.css";

type Props = {
  onRequestChange: (entry: AutomatedEmail | null) => void;
};

type ViewMode = "by-email" | "by-recipient";

export default function ProviderTeamNotificationEmails({
  onRequestChange,
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("by-email");
  const [categoryFilter, setCategoryFilter] = useState<EmailCategory | "all">("all");
  const [showInactive, setShowInactive] = useState(false);

  const activeRecipients = useMemo(() => getActiveTeamRecipients(), []);

  const filteredEmails = useMemo(() => {
    let list = AUTOMATED_EMAILS;
    if (!showInactive) list = list.filter((e) => e.active);
    if (categoryFilter !== "all")
      list = list.filter((e) => e.category === categoryFilter);
    return list;
  }, [categoryFilter, showInactive]);

  const emailsByRecipient = useMemo(() => {
    const map = new Map<string, { label: string; emails: AutomatedEmail[] }>();
    for (const r of activeRecipients) {
      map.set(r.email, { label: r.label, emails: [] });
    }
    map.set("__patient__", { label: "Patients", emails: [] });

    for (const email of AUTOMATED_EMAILS.filter((e) => e.active)) {
      if (email.goesToPatient) {
        map.get("__patient__")!.emails.push(email);
      }
      for (const r of email.teamRecipients) {
        const entry = map.get(r.email);
        if (entry) entry.emails.push(email);
      }
    }
    return [...map.entries()]
      .filter(([, v]) => v.emails.length > 0)
      .sort((a, b) => b[1].emails.length - a[1].emails.length);
  }, [activeRecipients]);

  const categories = useMemo(() => {
    const cats = new Set<EmailCategory>();
    for (const e of AUTOMATED_EMAILS) cats.add(e.category);
    return [...cats];
  }, []);

  const activeCount = AUTOMATED_EMAILS.filter((e) => e.active).length;
  const inactiveCount = AUTOMATED_EMAILS.length - activeCount;

  return (
    <div className="email-routing-dashboard">
      {/* Summary banner */}
      <div className="erd-summary">
        <div className="erd-summary-stats">
          <div className="erd-stat">
            <span className="erd-stat-number">{activeCount}</span>
            <span className="erd-stat-label">Active email types</span>
          </div>
          <div className="erd-stat">
            <span className="erd-stat-number">{activeRecipients.length}</span>
            <span className="erd-stat-label">Team recipients</span>
          </div>
          <div className="erd-stat">
            <span className="erd-stat-number">{categories.length}</span>
            <span className="erd-stat-label">Categories</span>
          </div>
        </div>
        <p className="erd-summary-text">
          These automated emails go out when patients interact with your practice —
          completing the Treatment Finder, receiving their facial analysis, requesting
          consultations, and more. Below you can see exactly which emails are active,
          who receives them, and how often they send.
        </p>
      </div>

      {/* View toggle + filters */}
      <div className="erd-controls">
        <div className="erd-view-toggle" role="tablist" aria-label="View mode">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "by-email"}
            className={`erd-view-tab${viewMode === "by-email" ? " erd-view-tab--active" : ""}`}
            onClick={() => setViewMode("by-email")}
          >
            By email type
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "by-recipient"}
            className={`erd-view-tab${viewMode === "by-recipient" ? " erd-view-tab--active" : ""}`}
            onClick={() => setViewMode("by-recipient")}
          >
            By recipient
          </button>
        </div>

        {viewMode === "by-email" && (
          <div className="erd-filters">
            <div className="erd-category-chips" role="group" aria-label="Filter by category">
              <button
                type="button"
                className={`erd-chip${categoryFilter === "all" ? " erd-chip--active" : ""}`}
                onClick={() => setCategoryFilter("all")}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`erd-chip${categoryFilter === cat ? " erd-chip--active" : ""}`}
                  onClick={() => setCategoryFilter(cat)}
                >
                  {EMAIL_CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
            {inactiveCount > 0 && (
              <label className="erd-inactive-toggle">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                />
                <span>Show inactive ({inactiveCount})</span>
              </label>
            )}
          </div>
        )}
      </div>

      {/* ── By-email view ───────────────────────────────────────────────── */}
      {viewMode === "by-email" && (
        <div className="erd-email-list">
          {filteredEmails.length === 0 && (
            <p className="erd-empty">No emails match the current filters.</p>
          )}
          {filteredEmails.map((entry) => (
            <div
              key={entry.id}
              className={`erd-email-card${!entry.active ? " erd-email-card--inactive" : ""}`}
            >
              <div className="erd-email-card-top">
                <div className="erd-email-card-header">
                  <div className="erd-email-card-title-row">
                    <h3 className="erd-email-card-name">{entry.name}</h3>
                    <span className={`erd-status-dot${entry.active ? " erd-status-dot--active" : ""}`}>
                      {entry.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <span className="erd-category-label">
                    {EMAIL_CATEGORY_LABELS[entry.category]}
                  </span>
                </div>
                <p className="erd-email-card-trigger">
                  <strong>When:</strong> {entry.trigger}
                </p>
                <p className="erd-email-card-desc">{entry.description}</p>
                <p className="erd-email-card-subject">
                  <span className="erd-subject-label">Subject line: </span>
                  {entry.exampleSubject}
                </p>
              </div>

              <div className="erd-email-card-routing">
                <div className="erd-routing-section">
                  <span className="erd-routing-label">Delivered to</span>
                  <div className="erd-routing-chips">
                    {entry.goesToPatient && (
                      <span className="erd-recipient-chip erd-recipient-chip--patient">
                        Patient
                      </span>
                    )}
                    {entry.teamRecipients.map((r) => (
                      <span
                        key={r.email}
                        className="erd-recipient-chip erd-recipient-chip--team"
                        title={r.email}
                      >
                        {r.label}
                        <span className="erd-recipient-chip-email">{r.email}</span>
                      </span>
                    ))}
                    {!entry.goesToPatient && entry.teamRecipients.length === 0 && (
                      <span className="erd-recipient-chip erd-recipient-chip--none">
                        Not currently routed
                      </span>
                    )}
                  </div>
                </div>
                {entry.recentVolumePerMonth != null && (
                  <div className="erd-volume">
                    ~{entry.recentVolumePerMonth}/mo
                  </div>
                )}
              </div>

              <div className="erd-email-card-actions">
                <button
                  type="button"
                  className="erd-change-btn"
                  onClick={() => onRequestChange(entry)}
                >
                  Request change
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── By-recipient view ───────────────────────────────────────────── */}
      {viewMode === "by-recipient" && (
        <div className="erd-recipient-list">
          {emailsByRecipient.map(([key, { label, emails }]) => (
            <div key={key} className="erd-recipient-section">
              <div className="erd-recipient-section-header">
                <h3 className="erd-recipient-section-name">
                  {label}
                  {key !== "__patient__" && (
                    <span className="erd-recipient-section-email">{key}</span>
                  )}
                </h3>
                <span className="erd-recipient-section-count">
                  {emails.length} email{emails.length !== 1 ? " types" : " type"}
                </span>
              </div>
              <div className="erd-recipient-email-table">
                <table>
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Trigger</th>
                      <th>Volume</th>
                      <th className="erd-col-action" />
                    </tr>
                  </thead>
                  <tbody>
                    {emails.map((entry) => (
                      <tr key={entry.id}>
                        <td className="erd-td-name">
                          <span className="erd-table-email-name">{entry.name}</span>
                          <span className="erd-table-category-hint">
                            {EMAIL_CATEGORY_LABELS[entry.category]}
                          </span>
                        </td>
                        <td className="erd-td-trigger">{entry.trigger}</td>
                        <td className="erd-td-volume">
                          {entry.recentVolumePerMonth != null
                            ? `~${entry.recentVolumePerMonth}/mo`
                            : "—"}
                        </td>
                        <td className="erd-td-action">
                          <button
                            type="button"
                            className="erd-change-btn erd-change-btn--sm"
                            onClick={() => onRequestChange(entry)}
                          >
                            Request change
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Global change request */}
      <div className="erd-footer-cta">
        <p className="erd-footer-text">
          Need to add a recipient, turn off an email type, or change how something is worded?
        </p>
        <button
          type="button"
          className="erd-footer-btn"
          onClick={() => onRequestChange(null)}
        >
          Request a routing change
        </button>
      </div>
    </div>
  );
}
