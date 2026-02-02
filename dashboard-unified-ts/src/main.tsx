// Main entry point

import React from "react";
import ReactDOM from "react-dom/client";
import posthog from "posthog-js";
import App from "./App";

// All API calls go through the secure backend proxy
// Frontend doesn't need any Airtable configuration - backend handles everything
declare global {
  interface Window {
    USE_BACKEND_API?: boolean;
    posthog?: typeof posthog;
  }
}

window.USE_BACKEND_API = true; // Always use backend API proxy

// Initialize PostHog when VITE_POSTHOG_KEY is set (analytics + session recording)
// Vite bakes env vars at BUILD time — set VITE_POSTHOG_KEY in Vercel and redeploy
const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
if (posthogKey) {
  posthog.init(posthogKey, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
    capture_pageview: true,
    capture_pageleave: true,
    // Session recording is ON by default; do not set disable_session_recording
    person_profiles: "identified_only", // create person on identify (e.g. login)
  });
  window.posthog = posthog;
  if (import.meta.env.DEV) console.log("[PostHog] initialized");
} else {
  console.warn(
    "[PostHog] Not loaded: VITE_POSTHOG_KEY was not set at build time. Add it in Vercel → Project → Settings → Environment Variables, then redeploy.",
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
