/**
 * Debug page: renders ClientDetailPanel for a specific Web Popup Lead record
 * so we can verify the Online Treatment Finder section is present in the DOM.
 *
 * Usage: Log in at http://localhost:5173/, then open:
 *   http://localhost:5173/?debug=client-detail
 *   or http://localhost:5173/debug/client-detail
 *
 * Expected: "Online Treatment Finder" is the first section (and has data-debug-section="online-treatment-finder" in DevTools).
 */

import { useEffect, useMemo } from "react";
import { useDashboard } from "../../context/DashboardContext";
import { loadProviderInfo } from "../../utils/providerStorage";
import ClientDetailPanel from "../views/ClientDetailPanel";

const DEBUG_RECORD_ID = "recVYfQmOGDfqZt6b";

export default function DebugClientDetailPage() {
  const { provider, setProvider, clients, refreshClients, loading } =
    useDashboard();

  // Load provider from storage (same as App) so debug page works after login
  useEffect(() => {
    const saved = loadProviderInfo();
    if (saved?.info) setProvider(saved.info);
  }, [setProvider]);

  const client = useMemo(
    () => clients.find((c) => c.id === DEBUG_RECORD_ID),
    [clients],
  );

  useEffect(() => {
    if (provider?.id) refreshClients();
  }, [provider?.id, refreshClients]);

  const exitDebug = () => {
    window.location.search = "";
  };

  if (!provider) {
    return (
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        <h1>Debug: Client Detail</h1>
        <p>
          Log in first at <a href="/">the main app</a>, then open{" "}
          <code>?debug=client-detail</code> again.
        </p>
      </div>
    );
  }

  if (loading && clients.length === 0) {
    return (
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        <h1>Debug: Loading clients…</h1>
      </div>
    );
  }

  if (!client) {
    return (
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        <h1>Debug: Client Detail</h1>
        <p>
          Record <code>{DEBUG_RECORD_ID}</code> not found in current data.
        </p>
        <p>
          Make sure this record is in the Web Popup Leads table and linked to
          your provider. Loaded {clients.length} clients.
        </p>
        <p>
          <button type="button" onClick={() => refreshClients()}>
            Retry load
          </button>{" "}
          <button type="button" onClick={exitDebug}>
            Exit debug
          </button>
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div
        style={{
          background: "#c00",
          color: "#fff",
          padding: "12px 24px",
          fontFamily: "sans-serif",
          fontSize: 14,
          flexShrink: 0,
        }}
        role="banner"
      >
        <strong>DEBUG MODE</strong> — Online Treatment Finder should be the
        first section below. In DevTools, search for{" "}
        <code>data-debug-section="online-treatment-finder"</code> to confirm the
        node exists.{" "}
        <button
          type="button"
          onClick={exitDebug}
          style={{ marginLeft: 12, padding: "4px 8px" }}
        >
          Exit debug
        </button>
      </div>
      <div style={{ flex: 1, overflow: "hidden" }}>
        <ClientDetailPanel
          client={client}
          onClose={exitDebug}
          onUpdate={refreshClients}
        />
      </div>
    </div>
  );
}
