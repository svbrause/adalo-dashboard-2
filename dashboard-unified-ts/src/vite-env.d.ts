/// <reference types="vite/client" />

interface ImportMetaEnv {
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
   * to your backend; response `audio/mpeg`. Same GCP project / service account as GCS is fine.
   */
  readonly VITE_GOOGLE_TTS_PROXY_URL?: string;
  /** Optional defaults forwarded to the proxy (e.g. `en-US-Neural2-F`, `en-US`). */
  readonly VITE_GOOGLE_TTS_VOICE_NAME?: string;
  readonly VITE_GOOGLE_TTS_LANGUAGE_CODE?: string;
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
