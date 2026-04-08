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
import { TREATMENT_BOUTIQUE_SKINCARE } from "../modals/DiscussedTreatmentsModal/treatmentBoutiqueProducts";
import {
  ACTIVE_EMAIL_COUNT,
  AUTOMATED_EMAILS,
  type AutomatedEmail,
} from "../../config/emailNotificationCatalog";
import PricingChangeRequestModal, {
  type PricingHelpSkuContext,
} from "../modals/PricingChangeRequestModal";
import SmsConfigChangeRequestModal from "../modals/SmsConfigChangeRequestModal";
import { useDashboard } from "../../context/DashboardContext";
import {
  isTheTreatmentProvider,
  isAdminBlueprintProvider,
} from "../../utils/providerHelpers";
import { renderTemplateVars } from "../../utils/renderTemplateVars";
import "./SettingsView.css";

type PreviewSelection = { product: SmsProductConfig; event: SmsTemplateEventConfig } | null;

type PricingHelpOpen = { sku: PricingHelpSkuContext | null };

/** Hub shows category cards; sub-panels hold the full tables without scrolling past unrelated sections. */
type SettingsActivePanel =
  | "home"
  | "notifications"
  | "pricing"
  | "skincare-products";

// ── Skincare product display helpers ────────────────────────────────────────

/** Strip SEO suffix after | or – to get a clean display name. */
function skincareDisplayName(fullName: string): string {
  return fullName.split(/\s*[|–—]\s*/)[0]?.trim() ?? fullName;
}

function skincareProductBrand(name: string): string {
  if (/^the treat/i.test(name)) return "The Treatment";
  /* Multi-product routines (shop bundles; mostly SkinCeuticals + SPF pairings) */
  if (
    /^(Anti-Aging Routine|Corrective Serum Bundle|Morning Defense Routine|Oily Skin Routine Set|Post-Injectable Serum Routine|Signature Routine Bundle)\b/i.test(
      name,
    )
  ) {
    return "SkinCeuticals";
  }
  if (/^skinceuticals/i.test(name)) return "SkinCeuticals";
  if (/^gm collin/i.test(name)) return "G.M. Collin";
  if (/^omnilux/i.test(name)) return "Omnilux";
  if (/^plated/i.test(name)) return "Plated";
  return "Other";
}

const BRAND_ORDER = ["The Treatment", "SkinCeuticals", "G.M. Collin", "Omnilux", "Plated"];

type SkincareProductRow = {
  name: string;
  displayName: string;
  brand: string;
  price: string | undefined;
  imageUrl: string | undefined;
  productUrl: string | undefined;
  description: string | undefined;
};

type SkincareBrandGroup = { brand: string; products: SkincareProductRow[] };

type SkincareSortId = "brand" | "name-asc" | "name-desc" | "price-asc" | "price-desc";

function skincarePriceNumber(price: string | undefined): number | null {
  if (!price?.trim()) return null;
  const n = parseFloat(price.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function buildSkincareBrandGroups(products: SkincareProductRow[]): SkincareBrandGroup[] {
  const byBrand = new Map<string, SkincareProductRow[]>();
  for (const p of products) {
    const arr = byBrand.get(p.brand) ?? [];
    arr.push(p);
    byBrand.set(p.brand, arr);
  }
  const groups: SkincareBrandGroup[] = [];
  for (const brand of BRAND_ORDER) {
    const prods = byBrand.get(brand);
    if (prods?.length) groups.push({ brand, products: prods });
  }
  for (const [brand, prods] of byBrand) {
    if (!BRAND_ORDER.includes(brand)) groups.push({ brand, products: prods });
  }
  return groups;
}

type SettingsSkincareProductCardProps = {
  product: SkincareProductRow;
  showBrandSubtitle: boolean;
  onRequestChange: () => void;
};

function SettingsSkincareProductCard({
  product,
  showBrandSubtitle,
  onRequestChange,
}: SettingsSkincareProductCardProps) {
  return (
    <div className="settings-skincare-card">
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
        {showBrandSubtitle ? (
          <p className="settings-skincare-card-brand">{product.brand}</p>
        ) : null}
        <p className="settings-skincare-card-name" title={product.name}>
          {product.displayName}
        </p>
        {product.price ? <p className="settings-skincare-card-price">{product.price}</p> : null}
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
            onClick={onRequestChange}
          >
            Request change
          </button>
        </div>
      </div>
    </div>
  );
}

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

type PricingSortId = "section" | "name-asc" | "name-desc" | "price-asc" | "price-desc";

type PricingRowWithSection = PricingSectionView["items"][number] & { category: string };

export default function SettingsView() {
  const { provider } = useDashboard();
  /**
   * Treatment-specific settings (email notifications with @getthetreatment.com addresses,
   * The Treatment 2025 price list, and the boutique skincare catalog) should only be visible
   * when the logged-in account is The Treatment or the admin login.
   * New providers get a placeholder until their own config is set up.
   */
  const isTreatmentContext =
    isTheTreatmentProvider(provider) || isAdminBlueprintProvider(provider);

  const [activePanel, setActivePanel] = useState<SettingsActivePanel>("home");
  const [preview, setPreview] = useState<PreviewSelection>(null);
  const [changeRequest, setChangeRequest] = useState<PreviewSelection>(null);
  const [pricingHelp, setPricingHelp] = useState<PricingHelpOpen | null>(null);
  const [pricingSearch, setPricingSearch] = useState("");
  const [pricingSort, setPricingSort] = useState<PricingSortId>("section");
  const [skincareSearch, setSkincareSearch] = useState("");
  const [skincareSort, setSkincareSort] = useState<SkincareSortId>("brand");
  const [emailNotifHelp, setEmailNotifHelp] = useState<{ entry: AutomatedEmail | null } | null>(null);
  const [emailChangeRequest, setEmailChangeRequest] = useState<AutomatedEmail | null>(null);
  const settingsPanelScrollSkip = useRef(true);

  useEffect(() => {
    if (settingsPanelScrollSkip.current) {
      settingsPanelScrollSkip.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activePanel]);

  // If a non-Treatment provider lands on a Treatment-specific sub-panel (e.g. via
  // browser history), send them back to the home hub so they don't see Treatment data.
  useEffect(() => {
    if (!isTreatmentContext && activePanel !== "home") {
      setActivePanel("home");
    }
  }, [isTreatmentContext, activePanel]);

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

  const pricingDisplay = useMemo(() => {
    const q = pricingSearch.trim().toLowerCase();
    const filteredSections = pricingSections
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
          : [...sec.items],
      }))
      .filter((sec) => sec.items.length > 0);

    if (pricingSort === "section") {
      return { mode: "sections" as const, sections: filteredSections };
    }

    const flat: PricingRowWithSection[] = [];
    for (const sec of filteredSections) {
      for (const item of sec.items) {
        flat.push({ ...item, category: sec.category });
      }
    }

    if (pricingSort === "name-asc") {
      flat.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    } else if (pricingSort === "name-desc") {
      flat.sort((a, b) => b.name.localeCompare(a.name, undefined, { sensitivity: "base" }));
    } else if (pricingSort === "price-asc") {
      flat.sort((a, b) =>
        a.price !== b.price ? a.price - b.price : a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );
    } else if (pricingSort === "price-desc") {
      flat.sort((a, b) =>
        a.price !== b.price ? b.price - a.price : a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );
    }

    return { mode: "flat" as const, rows: flat };
  }, [pricingSections, pricingSearch, pricingSort]);

  const pricingLineTotal = useMemo(
    () => pricingSections.reduce((n, s) => n + s.items.length, 0),
    [pricingSections],
  );

  const pricingLineFilteredCount =
    pricingDisplay.mode === "sections"
      ? pricingDisplay.sections.reduce((n, s) => n + s.items.length, 0)
      : pricingDisplay.rows.length;

  const pricingFilteredSectionCount =
    pricingDisplay.mode === "sections" ? pricingDisplay.sections.length : 0;

  const skincareAllProducts = useMemo<SkincareProductRow[]>(() =>
    TREATMENT_BOUTIQUE_SKINCARE
      .filter((p) => p.name !== "Other")
      .map((p) => ({
        name: p.name,
        displayName: skincareDisplayName(p.name),
        brand: skincareProductBrand(p.name),
        price: p.price,
        imageUrl: p.imageUrl,
        productUrl: p.productUrl,
        description: p.description,
      })),
    [],
  );

  const skincareDisplay = useMemo(() => {
    const q = skincareSearch.trim().toLowerCase();
    const filtered = q
      ? skincareAllProducts.filter((p) => {
          const hay = [p.name, p.displayName, p.brand, p.description ?? "", p.price ?? ""]
            .join(" ")
            .toLowerCase();
          return hay.includes(q);
        })
      : [...skincareAllProducts];

    if (skincareSort === "brand") {
      const groups = buildSkincareBrandGroups(filtered).map((g) => ({
        ...g,
        products: [...g.products].sort((a, b) =>
          a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }),
        ),
      }));
      return { mode: "groups" as const, groups };
    }

    const flat = filtered;
    if (skincareSort === "name-asc") {
      flat.sort((a, b) =>
        a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }),
      );
    } else if (skincareSort === "name-desc") {
      flat.sort((a, b) =>
        b.displayName.localeCompare(a.displayName, undefined, { sensitivity: "base" }),
      );
    } else if (skincareSort === "price-asc") {
      flat.sort((a, b) => {
        const pa = skincarePriceNumber(a.price);
        const pb = skincarePriceNumber(b.price);
        if (pa == null && pb == null) {
          return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" });
        }
        if (pa == null) return 1;
        if (pb == null) return -1;
        if (pa !== pb) return pa - pb;
        return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" });
      });
    } else if (skincareSort === "price-desc") {
      flat.sort((a, b) => {
        const pa = skincarePriceNumber(a.price);
        const pb = skincarePriceNumber(b.price);
        if (pa == null && pb == null) {
          return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" });
        }
        if (pa == null) return 1;
        if (pb == null) return -1;
        if (pa !== pb) return pb - pa;
        return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" });
      });
    }

    return { mode: "flat" as const, products: flat };
  }, [skincareAllProducts, skincareSearch, skincareSort]);

  const skincareProductTotal = skincareAllProducts.length;
  const skincareProductFilteredCount =
    skincareDisplay.mode === "groups"
      ? skincareDisplay.groups.reduce((n, g) => n + g.products.length, 0)
      : skincareDisplay.products.length;
  const skincareBrandSectionCount =
    skincareDisplay.mode === "groups" ? skincareDisplay.groups.length : 0;

  const unifiedNotificationSections = useMemo(() => {
    const UNIFIED_PRODUCTS_CONFIG: Array<{
      id: string;
      name: string;
      description: string;
      smsId: string | null;
      emailCategories: string[];
      emailIds: string[];
    }> = [
      {
        id: "treatment-finder",
        name: "Website quiz leads",
        description: "Messages and alerts for people who take the treatment quiz on your website.",
        smsId: "treatment-finder",
        emailCategories: ["new-leads"],
        emailIds: [],
      },
      {
        id: "skincare-quiz",
        name: "Skincare Quiz",
        description: "Skincare product recommendation flow and quiz follow-through messaging.",
        smsId: "skincare-quiz",
        emailCategories: [],
        emailIds: [],
      },
      {
        id: "skin-analysis",
        name: "At-Home Facial Analysis",
        description: "At-home AI facial scan and analysis lifecycle messaging and team alerts.",
        smsId: "skin-analysis",
        emailCategories: ["facial-analysis"],
        emailIds: ["patient-opened-report"],
      },
      {
        id: "treatment-plan",
        name: "Treatment Plan / Post-Visit Blueprint",
        description: "Personalized plan sharing and alerts after provider consultation.",
        smsId: "treatment-plan",
        emailCategories: [],
        emailIds: ["high-value-interest"],
      },
      {
        id: "scheduling",
        name: "Consultations & Scheduling",
        description: "Operational messages and alerts tied to consults and appointments.",
        smsId: "scheduling",
        emailCategories: ["consultations"],
        emailIds: [],
      },
      {
        id: "referrals",
        name: "Referrals",
        description: "Inbound and outbound patient referral notices and alerts.",
        smsId: null,
        emailCategories: ["referrals"],
        emailIds: [],
      },
      {
        id: "manual-messaging",
        name: "Manual SMS (Staff Initiated)",
        description: "Messages sent directly by staff from chat/popups using custom text.",
        smsId: "manual-messaging",
        emailCategories: [],
        emailIds: [],
      },
    ];

    return UNIFIED_PRODUCTS_CONFIG.map((config) => {
      const smsProduct = config.smsId ? SMS_SETTINGS_PRODUCTS.find((p) => p.id === config.smsId) : null;
      const emails = AUTOMATED_EMAILS.filter(
        (e) => config.emailCategories.includes(e.category) || config.emailIds.includes(e.id)
      );

      const items: Array<
        | { type: "sms"; event: SmsTemplateEventConfig; product: SmsProductConfig }
        | { type: "email"; email: AutomatedEmail }
      > = [];

      if (smsProduct) {
        items.push(
          ...smsProduct.events
            .filter((event) => event.enabled)
            .map((event) => ({ type: "sms" as const, event, product: smsProduct })),
        );
      }
      items.push(
        ...emails
          .filter((email) => email.active)
          .map((email) => ({ type: "email" as const, email })),
      );

      return {
        id: config.id,
        name: config.name,
        description: config.description,
        items,
      };
    }).filter((section) => section.items.length > 0);
  }, []);

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
                ? "Notifications"
                : activePanel === "skincare-products"
                  ? "Skincare products"
                  : "Treatment pricing"}
            </h1>
          </div>
        )}
      </header>

      {activePanel === "home" ? (
        <div className="settings-hub" aria-label="Settings categories">
          {isTreatmentContext ? (
            <ul className="settings-hub-cards">
              <li className="settings-hub-card-shell">
                <div className="settings-hub-card-body">
                  <h2 className="settings-hub-card-title">Notifications</h2>
                  <p className="settings-hub-card-desc">
                    Manage automated SMS templates for patients and internal email routing.
                  </p>
                  <p className="settings-hub-card-meta">
                    {SMS_SETTINGS_PRODUCTS.length} SMS topics · {ACTIVE_EMAIL_COUNT} active emails
                  </p>
                </div>
                <div className="settings-hub-card-footer">
                  <button
                    type="button"
                    className="btn-primary settings-hub-card-cta"
                    onClick={() => setActivePanel("notifications")}
                  >
                    Open notifications
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
          ) : (
            <div className="settings-hub-placeholder">
              <p className="settings-hub-placeholder-text">
                Settings for your practice are being configured. Contact your Ponce AI
                representative if you need to update notifications or pricing.
              </p>
            </div>
          )}
        </div>
      ) : null}

      {activePanel === "notifications" && isTreatmentContext ? (
        <section
          className="settings-card settings-subpanel-card"
          aria-labelledby="settings-notifications-heading"
        >
          <h2 id="settings-notifications-heading" className="visually-hidden">
            Notifications
          </h2>
          <p className="settings-card-lead">
            These are the automated texts and emails sent to patients and your team. Open <strong>View SMS</strong> or <strong>View Email</strong> to see the full details, and use <strong>Request change</strong> if something needs updating.
          </p>

          <details className="settings-howto">
            <summary className="settings-howto-summary">How to use this</summary>
            <ol className="settings-howto-list">
              <li>Notifications are grouped by workflow (e.g. facial analysis, website leads).</li>
              <li>You can see both <strong>SMS</strong> and <strong>EMAIL</strong> messages here.</li>
              <li>
                Click <strong>View SMS</strong> or <strong>View Email</strong> to see the exact message and who it sends to.
              </li>
            </ol>
          </details>

          <div className="settings-notif-product-sections">
            {unifiedNotificationSections.map((section) => (
              <section
                key={section.id}
                className="settings-notif-product-block"
                aria-labelledby={`settings-notif-product-${section.id}`}
              >
                <h3 className="settings-notif-product-title" id={`settings-notif-product-${section.id}`}>
                  {section.name}
                </h3>
                <p className="settings-notif-product-desc">{section.description}</p>
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
                      {section.items.map((item) => {
                        if (item.type === "sms") {
                          const { event, product } = item;
                          return (
                            <tr key={`sms-${event.id}`}>
                              <td className="settings-notif-notification-cell">
                                <div className="settings-notif-event-name">{event.eventName}</div>
                              </td>
                              <td className="settings-notif-when-cell">
                                <p className="settings-notif-trigger">{event.trigger}</p>
                                <div className="settings-notif-meta-pills" aria-label="Channel and status">
                                  <span className="settings-channel-pill">{event.channel.toUpperCase()}</span>
                                  <span className="settings-recipient-pill settings-recipient-pill--patient">
                                    Patient
                                  </span>
                                </div>
                              </td>
                              <td className="settings-td-actions settings-td-actions--single">
                                <button
                                  type="button"
                                  className="settings-secondary-btn settings-notif-view-btn"
                                  onClick={() => setPreview({ product, event })}
                                >
                                  View SMS
                                </button>
                              </td>
                            </tr>
                          );
                        } else {
                          const { email } = item;
                          return (
                            <tr key={`email-${email.id}`}>
                              <td className="settings-notif-notification-cell">
                                <div className="settings-notif-event-name">{email.name}</div>
                              </td>
                              <td className="settings-notif-when-cell">
                                <p className="settings-notif-trigger">{email.trigger}</p>
                                <div className="settings-notif-meta-pills" aria-label="Channel and status">
                                  <span className="settings-channel-pill">EMAIL</span>
                                  {email.goesToPatient && (
                                    <span className="settings-recipient-pill settings-recipient-pill--patient">
                                      Patient
                                    </span>
                                  )}
                                  {email.teamRecipients[0] && (
                                    <span
                                      className="settings-recipient-pill"
                                      title={email.teamRecipients[0].label}
                                    >
                                      {email.teamRecipients[0].email}
                                    </span>
                                  )}
                                  {email.teamRecipients.length > 1 && (
                                    <span
                                      className="settings-recipient-pill settings-recipient-pill--overflow"
                                      title={email.teamRecipients.slice(1).map((r) => r.email).join(", ")}
                                    >
                                      +{email.teamRecipients.length - 1}
                                    </span>
                                  )}
                                  {!email.goesToPatient && email.teamRecipients.length === 0 && (
                                    <span className="settings-muted" style={{ fontSize: "0.75rem" }}>
                                      Not routed
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="settings-td-actions settings-td-actions--single">
                                <button
                                  type="button"
                                  className="settings-secondary-btn settings-notif-view-btn"
                                  onClick={() => setEmailNotifHelp({ entry: email })}
                                >
                                  View Email
                                </button>
                              </td>
                            </tr>
                          );
                        }
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        </section>
      ) : null}

      {emailNotifHelp?.entry ? (
        <div className="modal-overlay active" onClick={() => setEmailNotifHelp(null)}>
          <div
            className="modal-content settings-template-preview-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-email-preview-title"
          >
            <div className="modal-header">
              <div className="modal-header-info">
                <h2 id="settings-email-preview-title" className="modal-title">
                  {emailNotifHelp.entry.name}
                </h2>
                <p className="settings-template-preview-meta">Automated email</p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setEmailNotifHelp(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p className="settings-template-preview-trigger">
                <strong>When:</strong> {emailNotifHelp.entry.trigger}
              </p>
              <p className="settings-template-preview-trigger">
                <strong>Subject:</strong> {renderTemplateVars(emailNotifHelp.entry.exampleSubject)}
              </p>
              <label className="settings-template-preview-label">Sent to</label>
              <div className="settings-notif-meta-pills" style={{ marginTop: 6, marginBottom: 16 }}>
                {emailNotifHelp.entry.goesToPatient && (
                  <span className="settings-recipient-pill settings-recipient-pill--patient">
                    Patient
                  </span>
                )}
                {emailNotifHelp.entry.teamRecipients.map((r) => (
                  <span key={r.email} className="settings-recipient-pill" title={r.label}>
                    {r.email}
                  </span>
                ))}
                {!emailNotifHelp.entry.goesToPatient && emailNotifHelp.entry.teamRecipients.length === 0 && (
                  <span className="settings-muted" style={{ fontSize: "0.8rem" }}>Not routed</span>
                )}
              </div>
              {emailNotifHelp.entry.body && (
                <>
                  <label className="settings-template-preview-label">Email body</label>
                  <div className="settings-template-preview-body">{renderTemplateVars(emailNotifHelp.entry.body)}</div>
                </>
              )}
              {emailNotifHelp.entry.recentVolumePerMonth != null && (
                <p className="settings-template-preview-trigger" style={{ marginTop: 14 }}>
                  <strong>Volume:</strong> ~{emailNotifHelp.entry.recentVolumePerMonth}/month
                </p>
              )}
            </div>
            <div className="modal-footer settings-template-preview-footer">
              <button type="button" className="btn-secondary" onClick={() => setEmailNotifHelp(null)}>
                Close
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  const entry = emailNotifHelp.entry;
                  setEmailNotifHelp(null);
                  setEmailChangeRequest(entry);
                }}
              >
                Request change
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activePanel === "pricing" && isTreatmentContext ? (
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
                Search by section, treatment type (for example “Filler”), service name, or note. Use{" "}
                <strong>Sort by</strong> to keep catalog sections or list all matching rows by name or
                price.
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
            <div className="settings-skincare-toolbar-row">
              <div className="settings-skincare-field settings-skincare-field--grow">
                <label className="settings-pricing-search-label" htmlFor="settings-pricing-search">
                  Search pricing
                </label>
                <input
                  id="settings-pricing-search"
                  type="search"
                  className="settings-pricing-search settings-pricing-search--block"
                  placeholder="Section, treatment type, service, or note…"
                  value={pricingSearch}
                  onChange={(e) => setPricingSearch(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="settings-skincare-field">
                <label className="settings-pricing-search-label" htmlFor="settings-pricing-sort">
                  Sort by
                </label>
                <select
                  id="settings-pricing-sort"
                  className="settings-pricing-sort-select"
                  value={pricingSort}
                  onChange={(e) => setPricingSort(e.target.value as PricingSortId)}
                >
                  <option value="section">Section (catalog order)</option>
                  <option value="name-asc">Service name (A–Z)</option>
                  <option value="name-desc">Service name (Z–A)</option>
                  <option value="price-asc">Price (low to high)</option>
                  <option value="price-desc">Price (high to low)</option>
                </select>
              </div>
              <div className="settings-skincare-field settings-skincare-field--action">
                <button
                  type="button"
                  className="settings-secondary-btn settings-pricing-toolbar-btn"
                  onClick={() => setPricingHelp({ sku: null })}
                >
                  Request other change
                </button>
              </div>
            </div>
            <p className="settings-pricing-count" aria-live="polite">
              Showing {pricingLineFilteredCount} of {pricingLineTotal} services
              {pricingSearch.trim() ? " (filtered)" : ""}
              {pricingDisplay.mode === "sections" && pricingFilteredSectionCount > 0
                ? ` in ${pricingFilteredSectionCount} section${pricingFilteredSectionCount === 1 ? "" : "s"}`
                : pricingDisplay.mode === "flat"
                  ? " (one table, sorted)"
                  : ""}
              .
            </p>
          </div>

          {pricingLineFilteredCount === 0 ? (
            <p className="settings-muted settings-pricing-empty">
              Nothing matches your search. Clear the box to see everything again.
            </p>
          ) : pricingDisplay.mode === "sections" ? (
            <div className="settings-pricing-sections">
              {pricingDisplay.sections.map((section) => (
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
          ) : (
            <div className="settings-pricing-section settings-pricing-section--flat">
              <div className="settings-table-scroll">
                <table className="settings-notifications-table settings-pricing-table">
                  <thead>
                    <tr>
                      <th scope="col">Section</th>
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
                    {pricingDisplay.rows.map((row) => (
                      <tr key={row.rowKey}>
                        <td className="settings-pricing-flat-section-cell">{row.category}</td>
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
                                  category: row.category,
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
          )}
        </section>
      ) : null}

      {activePanel === "skincare-products" && isTreatmentContext ? (
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
            <div className="settings-skincare-toolbar-row">
              <div className="settings-skincare-field settings-skincare-field--grow">
                <label className="settings-pricing-search-label" htmlFor="settings-skincare-search">
                  Search products
                </label>
                <input
                  id="settings-skincare-search"
                  type="search"
                  className="settings-pricing-search settings-pricing-search--block"
                  placeholder="Brand, name, description, or price…"
                  value={skincareSearch}
                  onChange={(e) => setSkincareSearch(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="settings-skincare-field">
                <label className="settings-pricing-search-label" htmlFor="settings-skincare-sort">
                  Sort by
                </label>
                <select
                  id="settings-skincare-sort"
                  className="settings-pricing-sort-select"
                  value={skincareSort}
                  onChange={(e) => setSkincareSort(e.target.value as SkincareSortId)}
                >
                  <option value="brand">Brand (grouped)</option>
                  <option value="name-asc">Product name (A–Z)</option>
                  <option value="name-desc">Product name (Z–A)</option>
                  <option value="price-asc">Price (low to high)</option>
                  <option value="price-desc">Price (high to low)</option>
                </select>
              </div>
              <div className="settings-skincare-field settings-skincare-field--action">
                <button
                  type="button"
                  className="settings-secondary-btn settings-pricing-toolbar-btn"
                  onClick={() =>
                    setPricingHelp({
                      sku: {
                        category: "Skincare boutique",
                        name: "(Multiple products or catalog update)",
                        price: 0,
                        priceDisplayOverride: "—",
                        rowKind: "product",
                      },
                    })
                  }
                >
                  Request other change
                </button>
              </div>
            </div>
            <p className="settings-pricing-count" aria-live="polite">
              Showing {skincareProductFilteredCount} of {skincareProductTotal} products
              {skincareSearch.trim() ? " (filtered)" : ""}
              {skincareDisplay.mode === "groups" && skincareBrandSectionCount > 0
                ? ` in ${skincareBrandSectionCount} brand${skincareBrandSectionCount === 1 ? "" : "s"}`
                : skincareDisplay.mode === "flat"
                  ? " (all products in one list)"
                  : ""}
              .
            </p>
          </div>

          {skincareProductFilteredCount === 0 ? (
            <p className="settings-muted settings-pricing-empty">
              Nothing matches your search. Clear the box to see all products.
            </p>
          ) : skincareDisplay.mode === "groups" ? (
            <div className="settings-skincare-brands">
              {skincareDisplay.groups.map((group) => (
                <div key={group.brand} className="settings-skincare-brand-section">
                  <h3 className="settings-pricing-section-title">{group.brand}</h3>
                  <div className="settings-skincare-grid">
                    {group.products.map((product) => (
                      <SettingsSkincareProductCard
                        key={product.name}
                        product={product}
                        showBrandSubtitle={false}
                        onRequestChange={() =>
                          setPricingHelp({
                            sku: {
                              category: group.brand,
                              name: product.displayName,
                              price: 0,
                              priceDisplayOverride: product.price ?? "Not listed",
                              rowKind: "product",
                              productUrl: product.productUrl,
                              descriptionSnippet: product.description?.trim(),
                            },
                          })
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="settings-skincare-grid settings-skincare-grid--flat">
              {skincareDisplay.products.map((product) => (
                <SettingsSkincareProductCard
                  key={product.name}
                  product={product}
                  showBrandSubtitle
                  onRequestChange={() =>
                    setPricingHelp({
                      sku: {
                        category: product.brand,
                        name: product.displayName,
                        price: 0,
                        priceDisplayOverride: product.price ?? "Not listed",
                        rowKind: "product",
                        productUrl: product.productUrl,
                        descriptionSnippet: product.description?.trim(),
                      },
                    })
                  }
                />
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
              <div className="settings-template-preview-body">{renderTemplateVars(preview.event.template)}</div>
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

      {emailChangeRequest ? (
        <PricingChangeRequestModal
          sku={{
            category: "Email routing",
            name: emailChangeRequest.name,
            price: 0,
            rowKind: "email-routing",
            emailTrigger: emailChangeRequest.trigger,
            emailSubject: emailChangeRequest.exampleSubject,
            emailRecipients: [
              emailChangeRequest.goesToPatient ? "Patient" : "",
              ...emailChangeRequest.teamRecipients.map((r) => r.email),
            ].filter(Boolean).join(", "),
            emailBody: emailChangeRequest.body,
          }}
          onClose={() => setEmailChangeRequest(null)}
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
