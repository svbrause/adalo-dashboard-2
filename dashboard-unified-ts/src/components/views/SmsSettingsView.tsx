import { useMemo, useState } from "react";
import {
  SMS_SETTINGS_PRODUCTS,
  type SmsProductConfig,
  type SmsTemplateEventConfig,
} from "../../config/smsSettingsCatalog";
import SmsConfigChangeRequestModal from "../modals/SmsConfigChangeRequestModal";
import "./SmsSettingsView.css";

type SelectedConfig = {
  product: SmsProductConfig;
  eventConfig: SmsTemplateEventConfig;
} | null;

export default function SmsSettingsView() {
  const [selectedConfig, setSelectedConfig] = useState<SelectedConfig>(null);

  const totals = useMemo(() => {
    const allEvents = SMS_SETTINGS_PRODUCTS.flatMap((p) => p.events);
    const enabled = allEvents.filter((e) => e.enabled).length;
    const disabled = allEvents.length - enabled;
    return { products: SMS_SETTINGS_PRODUCTS.length, events: allEvents.length, enabled, disabled };
  }, []);

  return (
    <div className="sms-settings-page">
      <header className="sms-settings-header card">
        <h2>SMS Configuration Settings</h2>
        <p>
          This is a read-only map of what patient messages we send, the template used, and which
          event triggers each message.
        </p>
        <div className="sms-settings-kpis">
          <div>
            <span>Products</span>
            <strong>{totals.products}</strong>
          </div>
          <div>
            <span>Events</span>
            <strong>{totals.events}</strong>
          </div>
          <div>
            <span>Enabled</span>
            <strong>{totals.enabled}</strong>
          </div>
          <div>
            <span>Disabled</span>
            <strong>{totals.disabled}</strong>
          </div>
        </div>
      </header>

      <section className="sms-settings-guide card">
        <h3>How to use this page</h3>
        <ol>
          <li>Review the product section to see what SMS events exist for that workflow.</li>
          <li>Check each event’s status (ON/OFF), trigger condition, and template text.</li>
          <li>
            Click <b>Request change</b> for any event that needs updates. We will handle the config
            change for you.
          </li>
        </ol>
      </section>

      <div className="sms-settings-products">
        {SMS_SETTINGS_PRODUCTS.map((product) => (
          <article key={product.id} className="sms-settings-product card">
            <div className="sms-settings-product-head">
              <div>
                <h3>{product.productName}</h3>
                <p>{product.description}</p>
              </div>
              <span className="sms-settings-owner">{product.owner}</span>
            </div>

            <div className="sms-settings-events">
              {product.events.map((eventConfig) => (
                <div key={eventConfig.id} className="sms-settings-event">
                  <div className="sms-settings-event-meta">
                    <h4>{eventConfig.eventName}</h4>
                    <p>{eventConfig.trigger}</p>
                    <div className="sms-settings-badges">
                      <span
                        className={`sms-status-badge ${
                          eventConfig.enabled ? "sms-status-badge--on" : "sms-status-badge--off"
                        }`}
                      >
                        {eventConfig.enabled ? "ON" : "OFF"}
                      </span>
                      <span className="sms-channel-badge">{eventConfig.channel.toUpperCase()}</span>
                    </div>
                  </div>

                  <div className="sms-settings-template">
                    <label>Template</label>
                    <pre>{eventConfig.template}</pre>
                  </div>

                  <div className="sms-settings-actions">
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => setSelectedConfig({ product, eventConfig })}
                    >
                      Request change
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      {selectedConfig ? (
        <SmsConfigChangeRequestModal
          product={selectedConfig.product}
          eventConfig={selectedConfig.eventConfig}
          onClose={() => setSelectedConfig(null)}
        />
      ) : null}
    </div>
  );
}

