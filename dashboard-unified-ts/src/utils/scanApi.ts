/** Same origin as `api.ts` default — Modal / scan routes on ponce-patient-backend. */
const DEFAULT_SCAN_BACKEND = "https://ponce-patient-backend.vercel.app";

function normalizeApiBase(url: string | undefined): string {
  return url?.trim().replace(/\/$/, "") ?? "";
}

/**
 * Base URL for `/api/scan/*` (submit, status, save-video).
 *
 * - `VITE_SCAN_API_URL` — explicit override (e.g. local `server.py` on 8787).
 * - Local dev (`import.meta.env.DEV`): defaults to Vercel so Generate 3D works without `server.py`.
 * - Production build: `VITE_BACKEND_API_URL` or the Vercel default.
 */
export function getScanApiBaseUrl(): string {
  const explicit = normalizeApiBase(import.meta.env.VITE_SCAN_API_URL);
  if (explicit) return explicit;

  if (import.meta.env.DEV) {
    return DEFAULT_SCAN_BACKEND;
  }

  return (
    normalizeApiBase(import.meta.env.VITE_BACKEND_API_URL) || DEFAULT_SCAN_BACKEND
  );
}
