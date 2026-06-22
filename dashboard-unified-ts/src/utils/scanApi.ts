/** Backend scan proxy. It forwards work to GCP and owns Airtable persistence. */
const DEFAULT_SCAN_BACKEND =
  import.meta.env.VITE_BACKEND_API_URL?.trim().replace(/\/$/, "") ||
  "https://ponce-patient-backend.vercel.app";

function resolveScanApiBase(): string {
  const explicit = normalizeApiBase(import.meta.env.VITE_SCAN_API_URL);
  if (explicit) return explicit;

  return DEFAULT_SCAN_BACKEND;
}

function normalizeApiBase(url: string | undefined): string {
  return url?.trim().replace(/\/$/, "") ?? "";
}

export type ScanProgressEvent = {
  status: string;
  progress?: number;
  message?: string;
  remaining?: number;
  elapsed?: number;
  estimatedSeconds?: number;
  analysisComplete?: boolean;
  analysisStatus?: string;
  analysisMessage?: string;
  assetStatus?: string;
  assetProgress?: number;
  assetRemaining?: number;
  assetMessage?: string;
  videoUrl?: string;
  videoBase64?: string;
  auraAssets?: Record<string, unknown>;
  severityScores?: Record<string, unknown>;
  error?: string;
};

async function parseScanStatusResponse(
  response: Response,
): Promise<ScanProgressEvent | null> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream")) {
    const text = await response.text();
    const dataLines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("data: "));
    if (dataLines.length === 0) return null;
    try {
      return JSON.parse(dataLines[dataLines.length - 1]!.slice(6)) as ScanProgressEvent;
    } catch {
      return null;
    }
  }
  if (!response.ok) return null;
  try {
    return (await response.json()) as ScanProgressEvent;
  } catch {
    return null;
  }
}

/** True when polling local `server.py` (localhost / 127.0.0.1 only). */
function isLocalScanServer(apiBase: string): boolean {
  try {
    const host = new URL(apiBase).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

/**
 * Poll scan job progress. Works with:
 * - Vercel backend: GET /api/scan/status/:jobId → JSON
 * - Local server.py: GET /api/scan/status/:jobId/json → JSON, or SSE on /status/:jobId
 */
export async function fetchScanJobStatus(
  apiBase: string,
  jobId: string,
): Promise<ScanProgressEvent | null> {
  const base = normalizeApiBase(apiBase);
  const paths = isLocalScanServer(base)
    ? [`/api/scan/status/${jobId}/json`, `/api/scan/status/${jobId}`]
    : [`/api/scan/status/${jobId}`];

  for (const path of paths) {
    try {
      const response = await fetch(`${base}${path}`);
      if (response.status === 404 && path.endsWith("/json")) continue;
      const parsed = await parseScanStatusResponse(response);
      if (parsed) return parsed;
    } catch {
      // try next path (local fallback only)
    }
  }
  return null;
}

/**
 * Base URL for `/api/scan/*` (submit, status, save-video).
 *
 * - `VITE_SCAN_API_URL` — explicit override (e.g. local `server.py` on 8787).
 * - Defaults to the backend scan proxy, which forwards to GCP and persists outputs.
 */
export function getScanApiBaseUrl(): string {
  return resolveScanApiBase();
}

/**
 * Base URL for in-clinic scan submit + job polling.
 * Defaults to the backend scan proxy so clinic scans avoid local Modal fallback.
 * Set `VITE_SCAN_API_URL=http://localhost:8787` to opt into local `server.py`.
 */
export function getClinicScanSubmitApiBase(): string {
  const explicit = normalizeApiBase(import.meta.env.VITE_SCAN_API_URL);
  if (explicit) return explicit;
  return resolveScanApiBase();
}
