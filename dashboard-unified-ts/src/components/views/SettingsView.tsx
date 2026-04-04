import { useEffect, useMemo, useRef, useState } from "react";
import {
  SMS_SETTINGS_PRODUCTS,
  type SmsProductConfig,
  type SmsTemplateEventConfig,
} from "../../config/smsSettingsCatalog";
import {
  formatPrice,
  getDashboardCategoriesForPriceListItem,
  TREATMENT_PRICE_LIST_2025,
} from "../../data/treatmentPricing2025";
import PricingChangeRequestModal, {
  type PricingHelpSkuContext,
} from "../modals/PricingChangeRequestModal";
import SmsConfigChangeRequestModal from "../modals/SmsConfigChangeRequestModal";
import "./SettingsView.css";

type PreviewSelection = { product: SmsProductConfig; event: SmsTemplateEventConfig } | null;

type PricingHelpOpen = { sku: PricingHelpSkuContext | null };

/** Hub shows category cards; sub-panels hold the full tables without scrolling past unrelated sections. */
type SettingsActivePanel = "home" | "notifications" | "pricing";

type PricingSectionView = {
  category: string;
  sectionIndex: number;
  items: Array<{
    name: string;
    price: number;
    note?: string;
    rowKey: string;
    /** Unified treatment recommender / plan categories (0 or 1 for injectables; empty if not mapped). */
    planCategories: string[];
  }>;
};

export default function SettingsView() {
  const [activePanel, setActivePanel] = useState<SettingsActivePanel>("home");
  const [preview, setPreview] = useState<PreviewSelection>(null);
  const [changeRequest, setChangeRequest] = useState<PreviewSelection>(null);
  const [pricingHelp, setPricingHelp] = useState<PricingHelpOpen | null>(null);
  const [pricingSearch, setPricingSearch] = useState("");
  const settingsPanelScrollSkip = useRef(true);

  useEffect(() => {
    if (settingsPanelScrollSkip.current) {
      settingsPanelScrollSkip.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activePanel]);

  const pricingSections: PricingSectionView[] = useMemo(
    () =>
      TREATMENT_PRICE_LIST_2025.map((section, sectionIndex) => ({
        category: section.category,
        sectionIndex,
        items: section.items.map((item, itemIndex) => ({
          name: item.name,
          price: item.price,
          note: item.note,
          rowKey: `${sectionIndex}-${itemIndex}`,
          planCategories: getDashboardCategoriesForPriceListItem(
            section.category,
            item.name,
          ),
        })),
      })),
    [],
  );

  const pricingSectionsFiltered = useMemo(() => {
    const q = pricingSearch.trim().toLowerCase();
    return pricingSections
      .map((sec) => ({
        ...sec,
        items: q
          ? sec.items.filter((item) => {
              const hay = [
                sec.category,
                item.name,
                item.note ?? "",
                item.planCategories.join(" "),
              ]
                .join(" ")
                .toLowerCase();
              return hay.includes(q);
            })
          : sec.items,
      }))
      .filter((sec) => sec.items.length > 0);
  }, [pricingSections, pricingSearch]);

  const pricingLineTotal = useMemo(
    () => pricingSections.reduce((n, s) => n + s.items.length, 0),
    [pricingSections],
  );

  const pricingLineFilteredCount = useMemo(
    () => pricingSectionsFiltered.reduce((n, s) => n + s.items.length, 0),
    [pricingSectionsFiltered],
  );

  const notifEventCount = useMemo(
    () =>
      SMS_SETTINGS_PRODUCTS.reduce((n, p) => n + p.events.length, 0),
    [],
  );

  return (
    <div
      className={
        activePanel === "home"
          ? "settings-page"
          : "settings-page settings-page--subpanel"
      }
    >
      <header className="settings-page-header">
        {activePanel === "home" ? (
          <>
            <h1 className="settings-page-title">Settings</h1>
            <p className="settings-page-subtitle">
              Open a category below—each has its own page so you don’t scroll past long tables.
            </p>
          </>
        ) : (
          <div className="settings-subpanel-header">
            <button
              type="button"
              className="settings-back-btn"
              onClick={() => setActivePanel("home")}
            >
              ← Back to Settings
            </button>
            <h1 className="settings-page-title settings-page-title--subpanel">
              {activePanel === "notifications"
                ? "Client notifications"
                : "Treatment pricing"}
            </h1>
          </div>
        )}
      </header>

      {activePanel === "home" ? (
        <div className="settings-hub" aria-label="Settings categories">
          <ul className="settings-hub-cards">
            <li className="settings-hub-card-shell">
              <div className="settings-hub-card-body">
                <h2 className="settings-hub-card-title">Client notifications</h2>
                <p className="settings-hub-card-desc">
                  SMS templates by product—quiz, analysis, treatment plan, and more.
                </p>
                <p className="settings-hub-card-meta">
                  {SMS_SETTINGS_PRODUCTS.length} topics · {notifEventCount} events
                </p>
              </div>
              <div className="settings-hub-card-footer">
                <button
                  type="button"
                  className="btn-primary settings-hub-card-cta"
                  onClick={() => setActivePanel("notifications")}
                >
                  Open client notifications
                  <span className="settings-hub-card-cta-icon" aria-hidden>
                    →
                  </span>
                </button>
              </div>
            </li>
            <li className="settings-hub-card-shell">
              <div className="settings-hub-card-body">
                <h2 className="settings-hub-card-title">Treatment pricing</h2>
                <p className="settings-hub-card-desc">
                  2025 price list as used in quotes and checkout. Search and request changes per
                  line.
                </p>
                <p className="settings-hub-card-meta">
                  {pricingLineTotal} services · {pricingSections.length} sections
                </p>
              </div>
              <div className="settings-hub-card-footer">
                <button
                  type="button"
                  className="btn-primary settings-hub-card-cta"
                  onClick={() => setActivePanel("pricing")}
                >
                  Open treatment pricing
                  <span className="settings-hub-card-cta-icon" aria-hidden>
                    →
                  </span>
                </button>
              </div>
            </li>
          </ul>
        </div>
      ) : null}

      {activePanel === "notifications" ? (
        <section
          className="settings-card settings-subpanel-card"
          aria-labelledby="settings-client-notifications-heading"
        >
          <h2 id="settings-client-notifications-heading" className="visually-hidden">
            Client notifications
          </h2>
          <p className="settings-card-lead">
            These are the texts we send to patients by SMS. Open <strong>View</strong> to read the
            full message; use <strong>Request change</strong> there if something should be updated.
          </p>

          <details className="settings-howto">
            <summary className="settings-howto-summary">How to use this</summary>
            <ol className="settings-howto-list">
              <li>Messages are grouped by topic—quiz, facial analysis, treatment plan, and so on.</li>
              <li>
                <strong>View</strong> shows the exact wording, including spots filled in for each
                patient (like their first name).
              </li>
              <li>
                Use <strong>Request change</strong> in that window to tell our team what to adjust.
              </li>
            </ol>
          </details>

          <div className="settings-notif-product-sections">
            {SMS_SETTINGS_PRODUCTS.map((product) => (
              <section
                key={product.id}
                className="settings-notif-product-block"
                aria-labelledby={`settings-notif-product-${product.id}`}
              >
                <h3 className="settings-notif-product-title" id={`settings-notif-product-${product.id}`}>
                  {product.productName}
                </h3>
                <p className="settings-notif-product-desc">{product.description}</p>
                <div className="settings-table-scroll">
                  <table className="settings-notifications-table settings-notifications-table--compact">
                    <thead>
                      <tr>
                        <th scope="col">Event</th>
                        <th scope="col">When it sends</th>
                        <th scope="col" className="settings-col-actions">
                          View
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {product.events.map((event) => (
                        <tr key={`${product.id}-${event.id}`}>
                          <td className="settings-notif-notification-cell">
                            <div className="settings-notif-event-name">{event.eventName}</div>
                          </td>
                          <td className="settings-notif-when-cell">
                            <p className="settings-notif-trigger">{event.trigger}</p>
                            <div className="settings-notif-meta-pills" aria-label="Channel and status">
                              <span className="settings-channel-pill">
                                {event.channel.toUpperCase()}
                              </span>
                              <span
                                className={
                                  event.enabled
                                    ? "settings-status-pill settings-status-pill--on"
                                    : "settings-status-pill settings-status-pill--off"
                                }
                              >
                                {event.enabled ? "On" : "Off"}
                              </span>
                            </div>
                          </td>
                          <td className="settings-td-actions settings-td-actions--single">
                            <button
                              type="button"
                              className="settings-secondary-btn settings-notif-view-btn"
                              onClick={() => setPreview({ product, event })}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        </section>
      ) : null}

      {activePanel === "pricing" ? (
        <section
          className="settings-card settings-subpanel-card"
          aria-labelledby="settings-pricing-heading"
        >
          <h2 id="settings-pricing-heading" className="visually-hidden">
            Treatment pricing
          </h2>
          <p className="settings-card-lead">
            Prices used in quotes and checkout, grouped the same way as your printed list. When it
            applies, you will see which <strong>treatment type</strong> a line belongs to (for example
            Voluma as a filler, Sculptra as a biostimulant). Search by section, treatment type, name,
            or note. To change a price or name, use <strong>Request change</strong>—our team will
            update the list.
          </p>

          <details className="settings-howto">
            <summary className="settings-howto-summary">How to use this</summary>
            <ol className="settings-howto-list">
              <li>
                Search by section, treatment type (for example “Filler”), service name, or note.
              </li>
              <li>
                <strong>Request change</strong> on a row starts a message with that service filled in.
              </li>
              <li>
                <strong>Request other change</strong> is for many updates at once or something not on
                the list.
              </li>
            </ol>
          </details>

          <div className="settings-pricing-toolbar">
            <label className="settings-pricing-search-label" htmlFor="settings-pricing-search">
              Search pricing
            </label>
            <div className="settings-pricing-toolbar-row">
              <input
                id="settings-pricing-search"
                type="search"
                className="settings-pricing-search"
                placeholder="Section, treatment type, service, or note…"
                value={pricingSearch}
                onChange={(e) => setPricingSearch(e.target.value)}
                autoComplete="off"
              />
              <button
                type="button"
                className="settings-secondary-btn settings-pricing-toolbar-btn"
                onClick={() => setPricingHelp({ sku: null })}
              >
                Request other change
              </button>
            </div>
            <p className="settings-pricing-count" aria-live="polite">
              Showing {pricingLineFilteredCount} of {pricingLineTotal} services
              {pricingSearch.trim() ? " (filtered)" : ""}
              {pricingSearch.trim() && pricingSectionsFiltered.length > 0
                ? ` in ${pricingSectionsFiltered.length} section${pricingSectionsFiltered.length === 1 ? "" : "s"}`
                : ""}
              .
            </p>
          </div>

          {pricingSectionsFiltered.length === 0 ? (
            <p className="settings-muted settings-pricing-empty">
              Nothing matches your search. Clear the box to see everything again.
            </p>
          ) : (
            <div className="settings-pricing-sections">
              {pricingSectionsFiltered.map((section) => (
                <div
                  key={section.sectionIndex}
                  className="settings-pricing-section"
                  aria-labelledby={`settings-pricing-section-${section.sectionIndex}`}
                >
                  <h3
                    className="settings-pricing-section-title"
                    id={`settings-pricing-section-${section.sectionIndex}`}
                  >
                    {section.category}
                  </h3>
                  <div className="settings-table-scroll">
                    <table className="settings-notifications-table settings-pricing-table">
                      <thead>
                        <tr>
                          <th scope="col">Service</th>
                          <th scope="col">Treatment type</th>
                          <th scope="col">Price</th>
                          <th scope="col">Note</th>
                          <th scope="col" className="settings-col-actions">
                            Request
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.items.map((row) => (
                          <tr key={row.rowKey}>
                            <td className="settings-td-workflow">{row.name}</td>
                            <td className="settings-pricing-plan-cat-cell">
                              {row.planCategories.length > 0 ? (
                                <span
                                  className="settings-pricing-plan-cat-text"
                                  title="How this service is grouped when you build a treatment plan"
                                >
                                  {row.planCategories.join(", ")}
                                </span>
                              ) : (
                                <span
                                  className="settings-muted"
                                  title="Not a main treatment type on plans—for example a consultation or add-on"
                                >
                                  —
                                </span>
                              )}
                            </td>
                            <td className="settings-pricing-price">{formatPrice(row.price)}</td>
                            <td>
                              {row.note ? (
                                <span className="settings-pricing-note" title={row.note}>
                                  {row.note}
                                </span>
                              ) : (
                                <span className="settings-muted">—</span>
                              )}
                            </td>
                            <td className="settings-td-actions settings-td-actions--single">
                              <button
                                type="button"
                                className="settings-secondary-btn settings-notif-view-btn"
                                onClick={() =>
                                  setPricingHelp({
                                    sku: {
                                      category: section.category,
                                      name: row.name,
                                      price: row.price,
                                      note: row.note,
                                      planCategory: row.planCategories[0],
                                    },
                                  })
                                }
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
        </section>
      ) : null}

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
              <label className="settings-template-preview-label">Message text</label>
              <pre className="settings-template-preview-pre">{preview.event.template}</pre>
            </div>
            <div className="modal-footer settings-template-preview-footer">
              <button type="button" className="btn-secondary" onClick={() => setPreview(null)}>
                Close
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  const sel = preview;
                  setPreview(null);
                  setChangeRequest(sel);
                }}
              >
                Request change
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

      {pricingHelp ? (
        <PricingChangeRequestModal
          sku={pricingHelp.sku}
          onClose={() => setPricingHelp(null)}
        />
      ) : null}
    </div>
  );
}
