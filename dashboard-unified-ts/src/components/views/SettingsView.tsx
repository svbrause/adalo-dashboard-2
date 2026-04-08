import { useEffect, useMemo, useRef, useState } from "react";
import { useDashboard } from "../../context/DashboardContext";
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
import { TREATMENT_BOUTIQUE_SKINCARE } from "../modals/DiscussedTreatmentsModal/treatmentBoutiqueProducts";
import {
  EMAIL_NOTIFICATION_CATALOG,
  EMAIL_NOTIFICATION_CATEGORY_COUNT,
  EMAIL_NOTIFICATION_TOTAL_COUNT,
  type EmailNotificationEntry,
} from "../../config/emailNotificationCatalog";
import PricingChangeRequestModal, {
  type PricingHelpSkuContext,
} from "../modals/PricingChangeRequestModal";
import SmsConfigChangeRequestModal from "../modals/SmsConfigChangeRequestModal";
import ProviderTeamNotificationEmails from "../settings/ProviderTeamNotificationEmails";
import "./SettingsView.css";

type PreviewSelection = { product: SmsProductConfig; event: SmsTemplateEventConfig } | null;

type PricingHelpOpen = { sku: PricingHelpSkuContext | null };

/** Hub shows category cards; sub-panels hold the full tables without scrolling past unrelated sections. */
type SettingsActivePanel = "home" | "notifications" | "pricing" | "team-emails" | "skincare-products";

// ── Skincare product display helpers ────────────────────────────────────────

/** Strip SEO suffix after | or – to get a clean display name. */
function skincareDisplayName(fullName: string): string {
  return fullName.split(/\s*[|–—]\s*/)[0]?.trim() ?? fullName;
}

function skincareProductBrand(name: string): string {
  if (/^the treat/i.test(name)) return "The Treatment";
  if (/^skinceuticals/i.test(name)) return "SkinCeuticals";
  if (/^gm collin/i.test(name)) return "G.M. Collin";
  if (/^omnilux/i.test(name)) return "Omnilux";
  if (/^plated/i.test(name)) return "Plated";
  return "Other";
}

/** Parse "$68.00" → 68 for use with formatPrice. Returns null if unparseable. */
function parseSkincarePrice(priceStr: string | undefined): number | null {
  if (!priceStr) return null;
  const n = parseFloat(priceStr.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? null : n;
}

type SkincareProductRow = {
  name: string;
  displayName: string;
  brand: string;
  price: string | undefined;
  priceNum: number | null;
  imageUrl: string | undefined;
  productUrl: string | undefined;
  description: string | undefined;
};

const BRAND_ORDER = ["The Treatment", "SkinCeuticals", "G.M. Collin", "Omnilux", "Plated"];

type SkincareBrandGroup = { brand: string; products: SkincareProductRow[] };

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
  const { provider } = useDashboard();
  const [activePanel, setActivePanel] = useState<SettingsActivePanel>("home");
  const [preview, setPreview] = useState<PreviewSelection>(null);
  const [changeRequest, setChangeRequest] = useState<PreviewSelection>(null);
  const [pricingHelp, setPricingHelp] = useState<PricingHelpOpen | null>(null);
  const [pricingSearch, setPricingSearch] = useState("");
  const [skincareSearch, setSkincareSearch] = useState("");
  const [skincareProductHelp, setSkincareProductHelp] = useState<PricingHelpOpen | null>(null);
  const [emailNotifHelp, setEmailNotifHelp] = useState<{ entry: EmailNotificationEntry | null } | null>(null);
  const [emailNotifPreview, setEmailNotifPreview] = useState<EmailNotificationEntry | null>(null);
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

  const skincareAllProducts = useMemo<SkincareProductRow[]>(() =>
    TREATMENT_BOUTIQUE_SKINCARE
      .filter((p) => p.name !== "Other")
      .map((p) => ({
        name: p.name,
        displayName: skincareDisplayName(p.name),
        brand: skincareProductBrand(p.name),
        price: p.price,
        priceNum: parseSkincarePrice(p.price),
        imageUrl: p.imageUrl,
        productUrl: p.productUrl,
        description: p.description,
      })),
    [],
  );

  const skincareGroupsFiltered = useMemo<SkincareBrandGroup[]>(() => {
    const q = skincareSearch.trim().toLowerCase();
    const filtered = q
      ? skincareAllProducts.filter((p) => {
          const hay = [p.name, p.brand, p.description ?? ""].join(" ").toLowerCase();
          return hay.includes(q);
        })
      : skincareAllProducts;

    const byBrand = new Map<string, SkincareProductRow[]>();
    for (const p of filtered) {
      const arr = byBrand.get(p.brand) ?? [];
      arr.push(p);
      byBrand.set(p.brand, arr);
    }
    const groups: SkincareBrandGroup[] = [];
    for (const brand of BRAND_ORDER) {
      const products = byBrand.get(brand);
      if (products?.length) groups.push({ brand, products });
    }
    for (const [brand, products] of byBrand) {
      if (!BRAND_ORDER.includes(brand)) groups.push({ brand, products });
    }
    return groups;
  }, [skincareAllProducts, skincareSearch]);

  const skincareProductTotal = skincareAllProducts.length;
  const skincareProductFilteredCount = skincareGroupsFiltered.reduce(
    (n, g) => n + g.products.length,
    0,
  );

  return (
    <div
      className={
        activePanel === "home"
          ? "settings-page"
          : activePanel === "skincare-products"
            ? "settings-page settings-page--products"
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
                : activePanel === "team-emails"
                  ? "Team notifications"
                  : activePanel === "skincare-products"
                    ? "Skincare products"
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
            <li className="settings-hub-card-shell">
              <div className="settings-hub-card-body">
                <h2 className="settings-hub-card-title">Team notifications</h2>
                <p className="settings-hub-card-desc">
                  All automated emails your system sends — to patients and your team — plus the
                  recipient addresses for team-facing alerts.
                </p>
                <p className="settings-hub-card-meta">
                  {EMAIL_NOTIFICATION_TOTAL_COUNT} email types · {EMAIL_NOTIFICATION_CATEGORY_COUNT} categories
                </p>
              </div>
              <div className="settings-hub-card-footer">
                <button
                  type="button"
                  className="btn-primary settings-hub-card-cta"
                  onClick={() => setActivePanel("team-emails")}
                >
                  Open team notifications
                  <span className="settings-hub-card-cta-icon" aria-hidden>
                    →
                  </span>
                </button>
              </div>
            </li>
            <li className="settings-hub-card-shell">
              <div className="settings-hub-card-body">
                <h2 className="settings-hub-card-title">Skincare products</h2>
                <p className="settings-hub-card-desc">
                  Full boutique catalog with photos, pricing, and shop links. Browse by brand and
                  request a change if anything needs updating.
                </p>
                <p className="settings-hub-card-meta">
                  {skincareProductTotal} products · {BRAND_ORDER.length} brands
                </p>
              </div>
              <div className="settings-hub-card-footer">
                <button
                  type="button"
                  className="btn-primary settings-hub-card-cta"
                  onClick={() => setActivePanel("skincare-products")}
                >
                  Open skincare products
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

      {activePanel === "team-emails" ? (
        <section
          className="settings-card settings-subpanel-card settings-email-notif-panel"
          aria-labelledby="settings-team-emails-heading"
        >
          <h2 id="settings-team-emails-heading" className="visually-hidden">
            Team notifications
          </h2>

          {/* ── Section 1: Recipient configuration ──────────────────────── */}
          <div className="settings-email-notif-recipients">
            <h3 className="settings-email-notif-section-title">
              Team recipient emails
            </h3>
            <p className="settings-card-lead" style={{ marginBottom: 0 }}>
              These addresses are CC'd on every team-facing notification (new leads, consultation
              requests, patient activity alerts). Seeded from the{" "}
              <strong>Booking Email</strong> field in your provider record — edit and save to
              override for this browser.
            </p>
            <ProviderTeamNotificationEmails
              providerId={provider?.id ?? ""}
              provider={provider}
            />
          </div>

          <hr className="settings-email-notif-divider" />

          {/* ── Section 2: Email notification catalog ──────────────────── */}
          <div className="settings-email-notif-catalog">
            <h3 className="settings-email-notif-section-title">
              Email notification catalog
            </h3>
            <p className="settings-card-lead" style={{ marginBottom: 12 }}>
              Every automated email your system sends, sourced from the Email Notifications table
              in Airtable. Use <strong>Request change</strong> on any row to ask our team for
              updates to subject lines, body copy, or routing.
            </p>

            <div className="settings-email-notif-categories">
              {EMAIL_NOTIFICATION_CATALOG.map((category) => (
                <div key={category.id} className="settings-email-notif-category">
                  <div className="settings-email-notif-category-header">
                    <h4 className="settings-email-notif-category-title">{category.label}</h4>
                    <p className="settings-email-notif-category-desc">{category.description}</p>
                  </div>
                  <div className="settings-table-scroll">
                    <table className="settings-notifications-table settings-email-notif-table">
                      <thead>
                        <tr>
                          <th scope="col">Notification</th>
                          <th scope="col">Trigger</th>
                          <th scope="col" className="settings-email-notif-col-audience">
                            Sent to
                          </th>
                          <th scope="col" className="settings-col-actions">
                            Request
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {category.entries.map((entry) => (
                          <tr key={entry.id}>
                            <td className="settings-email-notif-name-cell">
                              <p className="settings-email-notif-name">{entry.name}</p>
                              <p className="settings-email-notif-subject">
                                <span className="settings-email-notif-subject-label">Subject: </span>
                                {entry.subjectTemplate}
                              </p>
                              {entry.note ? (
                                <p className="settings-email-notif-note">{entry.note}</p>
                              ) : null}
                              {entry.examplesAtGetTheTreatment ? (
                                <p className="settings-email-notif-gtt">
                                  <span className="settings-email-notif-gtt-label">
                                    getthetreatment.com (from logs):
                                  </span>{" "}
                                  {entry.examplesAtGetTheTreatment}
                                </p>
                              ) : null}
                            </td>
                            <td className="settings-email-notif-trigger-cell">
                              {entry.trigger}
                            </td>
                            <td className="settings-email-notif-col-audience">
                              <span
                                className={`settings-email-audience-pill settings-email-audience-pill--${entry.audience}`}
                              >
                                {entry.audience === "both"
                                  ? "Patient + Team"
                                  : entry.audience === "team"
                                    ? "Team"
                                    : "Patient"}
                              </span>
                            </td>
                            <td className="settings-td-actions">
                              <button
                                type="button"
                                className="settings-secondary-btn settings-notif-view-btn"
                                onClick={() => setEmailNotifPreview(entry)}
                              >
                                View
                              </button>
                              <button
                                type="button"
                                className="settings-secondary-btn settings-notif-view-btn"
                                onClick={() => setEmailNotifHelp({ entry })}
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
          </div>
        </section>
      ) : null}

      {emailNotifPreview ? (
        <div
          className="modal-overlay active"
          onClick={() => setEmailNotifPreview(null)}
        >
          <div
            className="modal-content settings-template-preview-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="email-notif-preview-title"
          >
            <div className="modal-header">
              <div className="modal-header-info">
                <h2 id="email-notif-preview-title" className="modal-title">
                  {emailNotifPreview.name}
                </h2>
                <p className="settings-template-preview-meta">
                  <span
                    className={`settings-email-audience-pill settings-email-audience-pill--${emailNotifPreview.audience}`}
                    style={{ marginRight: 8 }}
                  >
                    {emailNotifPreview.audience === "both"
                      ? "Patient + Team"
                      : emailNotifPreview.audience === "team"
                        ? "Team"
                        : "Patient"}
                  </span>
                  {emailNotifPreview.subjectTemplate}
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setEmailNotifPreview(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p className="settings-template-preview-trigger">
                <strong>When:</strong> {emailNotifPreview.trigger}
              </p>
              <label className="settings-template-preview-label">Email body</label>
              <pre className="settings-template-preview-pre">{emailNotifPreview.templatePreview}</pre>
              {emailNotifPreview.examplesAtGetTheTreatment ? (
                <>
                  <label className="settings-template-preview-label">
                    Examples (@getthetreatment.com from Email Notifications logs)
                  </label>
                  <p className="settings-email-notif-gtt settings-email-notif-gtt--modal">
                    {emailNotifPreview.examplesAtGetTheTreatment}
                  </p>
                </>
              ) : null}
              {emailNotifPreview.note ? (
                <p className="settings-owner-note">{emailNotifPreview.note}</p>
              ) : null}
            </div>
            <div className="modal-footer settings-template-preview-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setEmailNotifPreview(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  const entry = emailNotifPreview;
                  setEmailNotifPreview(null);
                  setEmailNotifHelp({ entry });
                }}
              >
                Request change
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {emailNotifHelp ? (
        <PricingChangeRequestModal
          sku={
            emailNotifHelp.entry
              ? {
                  category: "Email notifications",
                  name: emailNotifHelp.entry.name,
                  price: 0,
                  note: `Subject: ${emailNotifHelp.entry.subjectTemplate} · Trigger: ${emailNotifHelp.entry.trigger}`,
                }
              : null
          }
          onClose={() => setEmailNotifHelp(null)}
        />
      ) : null}

      {activePanel === "skincare-products" ? (
        <section
          className="settings-card settings-subpanel-card"
          aria-labelledby="settings-skincare-heading"
        >
          <h2 id="settings-skincare-heading" className="visually-hidden">
            Skincare products
          </h2>
          <p className="settings-card-lead">
            Every product in the boutique catalog, organized by brand. Click{" "}
            <strong>View on shop</strong> to open the product page and use{" "}
            <strong>Request change</strong> if a price or detail needs updating.
          </p>

          <div className="settings-pricing-toolbar">
            <label className="settings-pricing-search-label" htmlFor="settings-skincare-search">
              Search products
            </label>
            <div className="settings-pricing-toolbar-row">
              <input
                id="settings-skincare-search"
                type="search"
                className="settings-pricing-search"
                placeholder="Brand, product name, or description…"
                value={skincareSearch}
                onChange={(e) => setSkincareSearch(e.target.value)}
                autoComplete="off"
              />
              <button
                type="button"
                className="settings-secondary-btn settings-pricing-toolbar-btn"
                onClick={() => setSkincareProductHelp({ sku: null })}
              >
                Request other change
              </button>
            </div>
            <p className="settings-pricing-count" aria-live="polite">
              Showing {skincareProductFilteredCount} of {skincareProductTotal} products
              {skincareSearch.trim() ? " (filtered)" : ""}
              {skincareSearch.trim() && skincareGroupsFiltered.length > 0
                ? ` across ${skincareGroupsFiltered.length} brand${skincareGroupsFiltered.length === 1 ? "" : "s"}`
                : ""}
              .
            </p>
          </div>

          {skincareGroupsFiltered.length === 0 ? (
            <p className="settings-muted settings-pricing-empty">
              Nothing matches your search. Clear the box to see all products.
            </p>
          ) : (
            <div className="settings-skincare-brands">
              {skincareGroupsFiltered.map((group) => (
                <div key={group.brand} className="settings-skincare-brand-section">
                  <h3 className="settings-pricing-section-title">{group.brand}</h3>
                  <div className="settings-skincare-grid">
                    {group.products.map((product) => (
                      <div key={product.name} className="settings-skincare-card">
                        <div className="settings-skincare-card-img-wrap">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.displayName}
                              className="settings-skincare-card-img"
                              loading="lazy"
                            />
                          ) : (
                            <div className="settings-skincare-card-img-placeholder" aria-hidden />
                          )}
                        </div>
                        <div className="settings-skincare-card-body">
                          <p className="settings-skincare-card-name" title={product.name}>
                            {product.displayName}
                          </p>
                          {product.price ? (
                            <p className="settings-skincare-card-price">{product.price}</p>
                          ) : null}
                          {product.description ? (
                            <p className="settings-skincare-card-desc">{product.description}</p>
                          ) : null}
                          <div className="settings-skincare-card-actions">
                            {product.productUrl ? (
                              <a
                                href={product.productUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="settings-secondary-btn settings-skincare-shop-link"
                              >
                                View on shop ↗
                              </a>
                            ) : null}
                            <button
                              type="button"
                              className="settings-secondary-btn settings-notif-view-btn"
                              onClick={() =>
                                setSkincareProductHelp({
                                  sku: {
                                    category: group.brand,
                                    name: product.displayName,
                                    price: product.priceNum ?? 0,
                                    note: product.productUrl
                                      ? `Shop URL: ${product.productUrl}`
                                      : undefined,
                                  },
                                })
                              }
                            >
                              Request change
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {skincareProductHelp ? (
        <PricingChangeRequestModal
          sku={skincareProductHelp.sku}
          onClose={() => setSkincareProductHelp(null)}
        />
      ) : null}
    </div>
  );
}
