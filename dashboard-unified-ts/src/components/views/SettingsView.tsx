import { useMemo, useState } from "react";
import { useDashboard } from "../../context/DashboardContext";
import {
  SMS_SETTINGS_PRODUCTS,
  type SmsProductConfig,
  type SmsTemplateEventConfig,
} from "../../config/smsSettingsCatalog";
import { formatProviderDisplayName } from "../../utils/providerHelpers";
import { providerHasSmsAndSettingsAccess } from "../../utils/providerPrivileges";
import SmsConfigChangeRequestModal from "../modals/SmsConfigChangeRequestModal";
import "./SettingsView.css";

type Row = {
  product: SmsProductConfig;
  event: SmsTemplateEventConfig;
};

type PreviewSelection = { product: SmsProductConfig; event: SmsTemplateEventConfig } | null;

export default function SettingsView() {
  const { provider, setCurrentView } = useDashboard();
  const [preview, setPreview] = useState<PreviewSelection>(null);
  const [changeRequest, setChangeRequest] = useState<PreviewSelection>(null);

  const rows: Row[] = useMemo(
    () =>
      SMS_SETTINGS_PRODUCTS.flatMap((product) =>
        product.events.map((event) => ({ product, event })),
      ),
    [],
  );

  const providerLabel = formatProviderDisplayName(provider?.name) || "Your clinic";
  const canOpenMessages = providerHasSmsAndSettingsAccess(provider);

  return (
    <div className="settings-page">
      <header className="settings-page-header">
        <h1 className="settings-page-title">Settings</h1>
        <p className="settings-page-subtitle">
          Preferences and reference information for your workspace.
        </p>
      </header>

      <section className="settings-card" aria-labelledby="settings-client-notifications-heading">
        <h2 id="settings-client-notifications-heading" className="settings-card-title">
          Client notifications
        </h2>
        <p className="settings-card-lead">
          Read-only reference for patient-facing SMS templates and when each message applies. Long
          message text opens in a window. To change copy or automation, submit a request.
        </p>

        <details className="settings-howto">
          <summary className="settings-howto-summary">How to use this</summary>
          <ol className="settings-howto-list">
            <li>Scan the table by workflow, then event name.</li>
            <li>Use <strong>View message</strong> to read the full template (including merge fields).</li>
            <li>
              Use <strong>Request change</strong> if something should be updated — our team will
              handle backend and Airtable configuration.
            </li>
          </ol>
        </details>

        <div className="settings-table-scroll">
          <table className="settings-notifications-table">
            <thead>
              <tr>
                <th scope="col">Workflow</th>
                <th scope="col">Event</th>
                <th scope="col">When it sends</th>
                <th scope="col">Channel</th>
                <th scope="col">Status</th>
                <th scope="col" className="settings-col-actions">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ product, event }) => (
                <tr key={`${product.id}-${event.id}`}>
                  <td className="settings-td-workflow">{product.productName}</td>
                  <td>{event.eventName}</td>
                  <td>
                    <span className="settings-trigger-cell" title={event.trigger}>
                      {event.trigger}
                    </span>
                  </td>
                  <td>
                    <span className="settings-channel-pill">{event.channel.toUpperCase()}</span>
                  </td>
                  <td>
                    <span
                      className={
                        event.enabled ? "settings-status-pill settings-status-pill--on" : "settings-status-pill settings-status-pill--off"
                      }
                    >
                      {event.enabled ? "On" : "Off"}
                    </span>
                  </td>
                  <td className="settings-td-actions">
                    <button
                      type="button"
                      className="settings-link-btn"
                      onClick={() => setPreview({ product, event })}
                    >
                      View message
                    </button>
                    <button
                      type="button"
                      className="settings-link-btn"
                      onClick={() => setChangeRequest({ product, event })}
                    >
                      Request change
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="settings-card" aria-labelledby="settings-messaging-heading">
        <h2 id="settings-messaging-heading" className="settings-card-title">
          Messaging
        </h2>
        <p className="settings-card-lead">
          Read threads, search, and send texts to clients from one place.
        </p>
        <button
          type="button"
          className="settings-secondary-btn"
          disabled={!canOpenMessages}
          title={
            !canOpenMessages
              ? "Text messages are only available for The Treatment or admin login."
              : undefined
          }
          onClick={() => {
            if (canOpenMessages) setCurrentView("sms-history");
          }}
        >
          Open text messages
        </button>
        {!canOpenMessages ? (
          <p className="settings-muted" style={{ marginTop: "0.75rem" }}>
            Text messages are only available when signed in with The Treatment or the admin login.
          </p>
        ) : null}
      </section>

      <section className="settings-card" aria-labelledby="settings-workspace-heading">
        <h2 id="settings-workspace-heading" className="settings-card-title">
          Workspace
        </h2>
        <p className="settings-card-lead">
          You are working in <strong>{providerLabel}</strong>
          {provider?.code ? (
            <>
              {" "}
              <span className="settings-muted">({provider.code})</span>
            </>
          ) : null}
          .
        </p>
        <p className="settings-muted settings-workspace-hint">
          Account and login options are available from the header and sidebar.
        </p>
      </section>

      {preview ? (
        <div className="modal-overlay active" onClick={() => setPreview(null)}>
          <div
            className="modal-content settings-template-preview-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-template-preview-title"
          >
            <div className="modal-header">
              <div className="modal-header-info">
                <h2 id="settings-template-preview-title" className="modal-title">
                  {preview.event.eventName}
                </h2>
                <p className="settings-template-preview-meta">
                  {preview.product.productName}
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setPreview(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p className="settings-template-preview-trigger">
                <strong>When:</strong> {preview.event.trigger}
              </p>
              <label className="settings-template-preview-label">Message template</label>
              <pre className="settings-template-preview-pre">{preview.event.template}</pre>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-primary" onClick={() => setPreview(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {changeRequest ? (
        <SmsConfigChangeRequestModal
          product={changeRequest.product}
          eventConfig={changeRequest.event}
          onClose={() => setChangeRequest(null)}
        />
      ) : null}
    </div>
  );
}
