/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Semver from `package.json`, injected at build in vite.config.ts. */
  readonly VITE_APP_VERSION: string;
  /**
   * Show the “Gemini” wordmark next to AI copy. Default off; set to `true` to show.
   */
  readonly VITE_SHOW_GEMINI_BRAND?: string;
  /**
   * Local dev only (`localhost`): AI assessment calls go through Vite `/__gemini-proxy` (see vite.config.ts).
   * Key is in the bundle — use only for demos; production should use backend `GEMINI_API_KEY`.
   */
  readonly VITE_GEMINI_API_KEY?: string;
  /** e.g. `gemini-2.0-flash` (default) or `gemini-1.5-flash` */
  readonly VITE_GEMINI_MODEL?: string;
  /** Local-only fallback when Gemini is rate-limited (key is public in bundle). */
  readonly VITE_OPENAI_API_KEY?: string;
  /** Optional OpenAI model for localhost fallback (default: `gpt-4o-mini`). */
  readonly VITE_OPENAI_MODEL?: string;
  /**
   * Google Cloud Text-to-Speech — POST JSON `{ text, voiceName?, languageCode?, speakingRate? }`
   * to your backend; response `audio/mpeg`. Defaults to `{VITE_BACKEND_API_URL}/api/tts/google-cloud`.
   * Same GCP project / service account as GCS is fine.
   */
  readonly VITE_GOOGLE_TTS_PROXY_URL?: string;
  /**
   * Optional overrides for the proxy. When unset, the app defaults to British Chirp 3 HD
   * (`en-GB-Chirp3-HD-Aoede` / `en-GB`) at a calmer speaking rate.
   */
  readonly VITE_GOOGLE_TTS_VOICE_NAME?: string;
  readonly VITE_GOOGLE_TTS_LANGUAGE_CODE?: string;
  readonly VITE_GOOGLE_TTS_SPEAKING_RATE?: string;
  readonly VITE_ELEVENLABS_PROXY_URL?: string;
  readonly VITE_ELEVENLABS_API_KEY?: string;
  readonly VITE_ELEVENLABS_VOICE_ID?: string;
  /**
   * Optional deterministic GCS/CDN URL for blueprint hero photos when the backend
   * does not set `patient.frontPhotoPersistentUrl`. Placeholders: `{patientId}`, `{token}`.
   * Example: `https://storage.googleapis.com/my-bucket/blueprints/{token}/front.jpg`
   * For reliable AI Mirror / canvas use, allow your dashboard origin on that bucket (GET CORS).
   * If CORS is missing, the app retries a plain image load as a fallback.
   */
  readonly VITE_BLUEPRINT_HERO_PHOTO_URL_TEMPLATE?: string;
  /**
   * The Treatment only: enable in-beta UI (Post-Visit share link, Analysis Overview, wellness overview, …).
   * Omit or leave not `true` in production until launch.
   */
  readonly VITE_THE_TREATMENT_PREVIEW_FEATURES?: string;
  /** Wellnest1300 demo patients: `false`/`0` off, `true`/`1` on; default on in dev only. */
  readonly VITE_WELLNEST_SAMPLE_CLIENTS?: string;
  /** Optional override URLs for demo Wellnest headshots (use real demo-environment photos). */
  readonly VITE_WELLNEST_DEMO_HEADSHOT_ALEX?: string;
  readonly VITE_WELLNEST_DEMO_HEADSHOT_JORDAN?: string;
  readonly VITE_WELLNEST_DEMO_HEADSHOT_TAYLOR?: string;
  /** Slim Studio demo patients: `false`/`0` off, `true`/`1` on; default on in dev only. */
  readonly VITE_SLIM_STUDIO_SAMPLE_CLIENTS?: string;

  /** Firebase Web SDK (public client config). Copy from Firebase Console → Project settings. */
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  /** Optional; omit for HIPAA-sensitive builds — Analytics is not initialized in code regardless. */
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
  /**
   * `true`: show the Firebase email/password block on the provider login page.
   * `false`: hide it. If omitted: shown in Vite dev when Firebase is configured; hidden in production builds unless `true`.
   */
  readonly VITE_FIREBASE_SHOW_STAFF_AUTH?: string;
  /** `true`: show “Create account” on staff panel (use with care until admin-only provisioning exists). */
  readonly VITE_FIREBASE_ALLOW_SELF_SIGNUP?: string;
  /**
   * `true`: after Firebase sign-in on the login page, open the dashboard when `practiceIds`
   * claims are set (backend must expose `GET /api/dashboard/provider/by-id`).
   */
  readonly VITE_FIREBASE_STAFF_LOGIN_TO_DASHBOARD?: string;
  /**
   * `true`: `/forgot-password` calls `POST {VITE_BACKEND_API_URL}/api/auth/forgot-password`
   * so reset mail uses your Resend/Brevo HTML (same as invite). Requires backend support.
   * Omit or `false`: use Firebase client `sendPasswordResetEmail` (Firebase templates).
   */
  readonly VITE_PASSWORD_RESET_VIA_BACKEND?: string;
  /**
   * Base origin for `/api/scan/*` (no trailing slash). Unset in dev → Vercel backend.
   * @see getScanApiBaseUrl in `src/utils/scanApi.ts`
   */
  readonly VITE_SCAN_API_URL?: string;
  readonly VITE_BACKEND_API_URL?: string;
  /** GCS bucket name where patient Aura manifests are stored (e.g. "test-deploy-august25"). */
  readonly VITE_GCS_AURA_BUCKET?: string;
  /** Clinic demo deck: default dashboard origin for live links (Vercel build). */
  readonly VITE_DASHBOARD_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.css' {
  const content: string;
  export default content;
}

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.JPG' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.gif' {
  const content: string;
  export default content;
}

declare module '*.webp' {
  const content: string;
  export default content;
}
