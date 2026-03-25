import type { Client, DiscussedItem } from "../types";
import type { CheckoutLineItemDetail } from "../data/treatmentPricing2025";
import {
  fetchAIAssessment,
  fetchPostVisitBlueprintFromServer,
  storePostVisitBlueprintOnServer,
} from "../services/api";
import type { BlueprintAnalysisSummary } from "./postVisitBlueprintAnalysis";
import { buildAnalysisSummaryFromClient } from "./postVisitBlueprintAnalysis";
import { getDetectedIssueDisplayStrings } from "./analysisOverviewClient";

/** Keep SMS / localStorage payload reasonable if the model returns a long essay. */
const MAX_AI_NARRATIVE_CHARS = 10_000;

/**
 * Calls the same `/api/assessment` endpoint as Analysis Overview and stores the text on the snapshot.
 */
async function enrichAnalysisSummaryWithAiNarrative(
  client: Client,
  summary: BlueprintAnalysisSummary | undefined,
): Promise<BlueprintAnalysisSummary | undefined> {
  if (!summary?.overviewSnapshot) return summary;
  const os = summary.overviewSnapshot;
  const focusCount = os.areas.filter((a) => a.hasInterest).length;
  const detectedIssues = getDetectedIssueDisplayStrings(client);
  if (detectedIssues.length === 0) return summary;

  const aiText = await fetchAIAssessment({
    overall: os.overallScore,
    categories: os.categories.map((c) => ({
      name: c.name,
      score: c.score,
      tier: c.tier,
    })),
    focusCount,
    detectedIssues: detectedIssues.slice(0, 50),
    patientOverviewSummary: os.assessmentParagraph,
  });

  if (!aiText?.trim()) return summary;

  const t = aiText.trim();
  const aiNarrative =
    t.length > MAX_AI_NARRATIVE_CHARS
      ? `${t.slice(0, MAX_AI_NARRATIVE_CHARS)}…`
      : t;

  return {
    ...summary,
    overviewSnapshot: {
      ...os,
      aiNarrative,
    },
  };
}

export const POST_VISIT_BLUEPRINT_PATH = "/post-visit-blueprint";
const BLUEPRINT_STORAGE_KEY_PREFIX = "post_visit_blueprint_v1:";

export type BlueprintEventName =
  | "blueprint_delivered"
  | "blueprint_opened"
  | "video_played_module_X"
  | "case_gallery_viewed"
  | "financing_clicked"
  | "booking_clicked";

export interface PostVisitBlueprintPayload {
  version: 1;
  token: string;
  createdAt: string;
  clinicName: string;
  providerName: string;
  /** Set when sending from dashboard — used to gate patient page (The Treatment + Admin). */
  providerCode?: string;
  providerPhone?: string;
  patient: {
    id: string;
    name: string;
    /** When present, enables patient-records API (AI suggestion copy + area-cropped photos) on the patient page. */
    email?: string | null;
    phone?: string;
    tableSource: "Patients" | "Web Popup Leads";
    ageRange?: string | null;
    skinType?: string | null;
    skinTone?: string | null;
    ethnicBackground?: string | null;
    /**
     * Airtable expiring download URL (often ~2h). Kept for fallback / future refresh.
     * @see https://support.airtable.com/docs/en/airtable-attachment-url-behavior
     */
    frontPhoto?: string | null;
    /**
     * When the dashboard can `fetch` the image at send time, we embed a data URL so the
     * patient link works long after Airtable URLs expire. Omitted if CORS blocks fetch or file is too large.
     */
    frontPhotoDataUrl?: string | null;
    /**
     * Long-lived HTTPS URL (e.g. GCS object or CDN) written by the backend when the blueprint is stored.
     * Prefer this over `frontPhoto` when present so the patient page does not depend on expiring Airtable links.
     */
    frontPhotoPersistentUrl?: string | null;
    /** Airtable attachment id — for server-side refresh or GCS upload (optional). */
    frontPhotoAttachmentId?: string | null;
  };
  discussedItems: DiscussedItem[];
  quote: {
    lineItems: CheckoutLineItemDetail[];
    total: number;
    totalAfterDiscount: number;
    hasUnknownPrices: boolean;
    isMintMember: boolean;
  };
  cta: {
    bookingUrl?: string;
    financingUrl?: string;
    textProviderPhone?: string;
  };
  /**
   * Goals / concerns / analysis fields copied from the client at send time.
   * Older links may omit this — the page still derives plan interests from `discussedItems`.
   */
  analysisSummary?: BlueprintAnalysisSummary;
  /**
   * Region filters selected in the treatment recommender (e.g. "Forehead/Brows", "Eyes").
   * Drives AI mirror highlights on the patient page when present.
   */
  recommenderFocusRegions?: string[];
}

/** Max bytes to embed as base64 in the blueprint payload (keeps SMS links usable). */
export const BLUEPRINT_HERO_PHOTO_MAX_EMBED_BYTES = 150 * 1024;

export function normalizeFrontPhotoUrl(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0] as
      | { url?: string; thumbnails?: { full?: { url?: string }; large?: { url?: string } } }
      | null
      | undefined;
    const url =
      first?.thumbnails?.full?.url ||
      first?.thumbnails?.large?.url ||
      first?.url ||
      "";
    return url.trim() || null;
  }
  if (value && typeof value === "object") {
    const obj = value as {
      url?: string;
      thumbnails?: { full?: { url?: string }; large?: { url?: string } };
    };
    const url =
      obj.thumbnails?.full?.url || obj.thumbnails?.large?.url || obj.url || "";
    return url.trim() || null;
  }
  return null;
}

/** Airtable attachment id from the client record (for backend refresh / GCS). */
export function extractFrontPhotoAttachmentId(frontPhoto: unknown): string | null {
  if (!Array.isArray(frontPhoto) || frontPhoto.length === 0) return null;
  const first = frontPhoto[0] as { id?: string } | null | undefined;
  const id = typeof first?.id === "string" ? first.id.trim() : "";
  return id || null;
}

/**
 * Fetches the image bytes while the Airtable URL is still valid and returns a data URL
 * for embedding in the blueprint (Airtable’s recommended “download before sharing” pattern).
 * Returns null if fetch fails (CORS, network) or file exceeds {@link BLUEPRINT_HERO_PHOTO_MAX_EMBED_BYTES}.
 */
export async function tryFetchHeroPhotoAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.size > BLUEPRINT_HERO_PHOTO_MAX_EMBED_BYTES) return null;
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const r = reader.result;
        resolve(typeof r === "string" ? r : null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * When `VITE_BLUEPRINT_HERO_PHOTO_URL_TEMPLATE` is set, resolve a public URL without
 * waiting for `frontPhotoPersistentUrl` in the JSON (same path your backend uses for GCS).
 */
export function resolveHeroPhotoUrlFromEnvTemplate(
  patient: PostVisitBlueprintPayload["patient"],
  blueprintToken: string,
): string | null {
  const raw = import.meta.env.VITE_BLUEPRINT_HERO_PHOTO_URL_TEMPLATE;
  if (typeof raw !== "string" || !raw.trim()) return null;
  const pid = String(patient.id ?? "").trim();
  const tok = String(blueprintToken ?? "").trim();
  if (!pid || !tok) return null;
  const url = raw
    .split("{patientId}")
    .join(encodeURIComponent(pid))
    .split("{token}")
    .join(encodeURIComponent(tok))
    .trim();
  return url || null;
}

/** True when hero can be shown without calling the Airtable refresh endpoint. */
export function hasStableHeroPhotoSource(
  patient: PostVisitBlueprintPayload["patient"],
  blueprintToken: string,
): boolean {
  if (patient.frontPhotoDataUrl?.trim()) return true;
  if (patient.frontPhotoPersistentUrl?.trim()) return true;
  if (resolveHeroPhotoUrlFromEnvTemplate(patient, blueprintToken)) return true;
  return false;
}

/** Prefer embedded data URL, then stable bucket/CDN URL, env template, then Airtable attachment URL. */
export function resolveHeroPhotoDisplayUrl(
  patient: PostVisitBlueprintPayload["patient"],
  options?: { blueprintToken?: string },
): string | null {
  const embedded = patient.frontPhotoDataUrl?.trim();
  if (embedded) return embedded;
  const persistent = patient.frontPhotoPersistentUrl?.trim();
  if (persistent) return persistent;
  const token = options?.blueprintToken?.trim();
  if (token) {
    const fromEnv = resolveHeroPhotoUrlFromEnvTemplate(patient, token);
    if (fromEnv) return fromEnv;
  }
  return normalizeFrontPhotoUrl(patient.frontPhoto);
}

function normalizePath(path: string): string {
  return path.replace(/\/$/, "") || "/";
}

export function isPostVisitBlueprintPath(): boolean {
  if (typeof window === "undefined") return false;
  return normalizePath(window.location.pathname) === POST_VISIT_BLUEPRINT_PATH;
}

export function parsePostVisitBlueprintTokenFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const token = params.get("t")?.trim() ?? "";
  return token || null;
}

function encodeBlueprintPayload(payload: PostVisitBlueprintPayload): string {
  const json = JSON.stringify(payload);
  return btoa(encodeURIComponent(json));
}

function decodeBlueprintPayload(value: string): PostVisitBlueprintPayload | null {
  try {
    const decoded = decodeURIComponent(atob(value));
    const parsed = JSON.parse(decoded) as PostVisitBlueprintPayload;
    if (parsed?.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function buildPostVisitBlueprintLink(
  token: string,
  payload?: PostVisitBlueprintPayload,
): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const params = new URLSearchParams();
  params.set("t", token);
  if (payload) params.set("d", encodeBlueprintPayload(payload));
  return `${base}${POST_VISIT_BLUEPRINT_PATH}?${params.toString()}`;
}

function getStorageKey(token: string): string {
  return `${BLUEPRINT_STORAGE_KEY_PREFIX}${token}`;
}

function createBlueprintToken(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `bp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Dedupe discussed items for prep cache keys */
function blueprintPrepCacheKey(clientId: string, discussedItems: DiscussedItem[]): string {
  return `${clientId}:${[...discussedItems].map((i) => i.id).sort().join(",")}`;
}

type BlueprintHeavyPrep = {
  frontPhotoDataUrl: string | null;
  analysisSummary: BlueprintAnalysisSummary | undefined;
};

const BLUEPRINT_PREP_CACHE_TTL_MS = 120_000;
const blueprintPrepResultCache = new Map<
  string,
  { result: BlueprintHeavyPrep; storedAt: number }
>();
const blueprintPrepInflight = new Map<string, Promise<BlueprintHeavyPrep>>();

/**
 * Photo fetch + AI narrative run in parallel (was sequential — often doubled wait time).
 */
async function runBlueprintHeavyPrep(client: Client): Promise<BlueprintHeavyPrep> {
  const basePhotoUrl = normalizeFrontPhotoUrl(client.frontPhoto);
  let analysisSummary = buildAnalysisSummaryFromClient(client);
  const [frontPhotoDataUrl, enriched] = await Promise.all([
    basePhotoUrl ? tryFetchHeroPhotoAsDataUrl(basePhotoUrl) : Promise.resolve(null),
    enrichAnalysisSummaryWithAiNarrative(client, analysisSummary),
  ]);
  analysisSummary = enriched ?? analysisSummary;
  return { frontPhotoDataUrl, analysisSummary };
}

async function getSharedBlueprintHeavyPrep(
  client: Client,
  discussedItems: DiscussedItem[],
): Promise<BlueprintHeavyPrep> {
  const key = blueprintPrepCacheKey(client.id, discussedItems);
  const cached = blueprintPrepResultCache.get(key);
  if (cached && Date.now() - cached.storedAt < BLUEPRINT_PREP_CACHE_TTL_MS) {
    blueprintPrepResultCache.delete(key);
    return cached.result;
  }
  let inflight = blueprintPrepInflight.get(key);
  if (!inflight) {
    inflight = runBlueprintHeavyPrep(client).then((result) => {
      blueprintPrepResultCache.set(key, { result, storedAt: Date.now() });
      blueprintPrepInflight.delete(key);
      return result;
    });
    blueprintPrepInflight.set(key, inflight);
  }
  const result = await inflight;
  return result;
}

/**
 * Start hero-photo + AI prep early (e.g. when Treatment Plan Quote opens with a valid plan).
 * Safe to call repeatedly; work is deduped per client + discussed item ids.
 */
export function warmPostVisitBlueprintForSend(
  client: Client,
  discussedItems: DiscussedItem[],
): void {
  if (!discussedItems.length) return;
  void getSharedBlueprintHeavyPrep(client, discussedItems).catch(() => {
    /* warm is best-effort */
  });
}

export async function createAndStorePostVisitBlueprint(input: {
  clinicName: string;
  providerName: string;
  providerCode?: string;
  providerPhone?: string;
  client: Client;
  discussedItems: DiscussedItem[];
  /** Treatment recommender "region" filter chips at send time — optional. */
  recommenderFocusRegions?: string[];
  quote: {
    lineItems: CheckoutLineItemDetail[];
    total: number;
    totalAfterDiscount: number;
    hasUnknownPrices: boolean;
    isMintMember: boolean;
  };
  cta: {
    bookingUrl?: string;
    financingUrl?: string;
    textProviderPhone?: string;
  };
}): Promise<{ token: string; link: string; payload: PostVisitBlueprintPayload }> {
  const token = createBlueprintToken();
  const basePhotoUrl = normalizeFrontPhotoUrl(input.client.frontPhoto);
  const attachmentId = extractFrontPhotoAttachmentId(input.client.frontPhoto);
  const { frontPhotoDataUrl, analysisSummary } = await getSharedBlueprintHeavyPrep(
    input.client,
    input.discussedItems,
  );

  const payload: PostVisitBlueprintPayload = {
    version: 1,
    token,
    createdAt: new Date().toISOString(),
    clinicName: input.clinicName,
    providerName: input.providerName,
    providerCode: input.providerCode?.trim() || undefined,
    providerPhone: input.providerPhone,
    patient: {
      id: input.client.id,
      name: input.client.name,
      email: input.client.email?.trim() || undefined,
      phone: input.client.phone,
      tableSource: input.client.tableSource,
      ageRange: input.client.ageRange,
      skinType: input.client.skinType,
      skinTone: input.client.skinTone,
      ethnicBackground: input.client.ethnicBackground,
      frontPhoto: basePhotoUrl,
      frontPhotoDataUrl: frontPhotoDataUrl || undefined,
      frontPhotoAttachmentId: attachmentId || undefined,
    },
    discussedItems: input.discussedItems,
    quote: input.quote,
    cta: input.cta,
    ...(analysisSummary ? { analysisSummary } : {}),
    ...(input.recommenderFocusRegions?.length
      ? {
          recommenderFocusRegions: [...input.recommenderFocusRegions],
        }
      : {}),
  };
  let payloadOut: PostVisitBlueprintPayload = payload;
  localStorage.setItem(getStorageKey(token), JSON.stringify(payloadOut));
  const storedRemote = await storePostVisitBlueprintOnServer(
    payloadOut as unknown as Record<string, unknown>,
  );
  if (storedRemote) {
    const remoteRaw = await fetchPostVisitBlueprintFromServer(token);
    const remoteParsed = parsePostVisitBlueprintPayload(remoteRaw);
    const pUrl = remoteParsed?.patient?.frontPhotoPersistentUrl?.trim();
    if (pUrl && remoteParsed) {
      payloadOut = {
        ...payloadOut,
        patient: { ...payloadOut.patient, frontPhotoPersistentUrl: pUrl },
      };
      localStorage.setItem(getStorageKey(token), JSON.stringify(payloadOut));
    }
  }
  const link = storedRemote
    ? buildPostVisitBlueprintLink(token)
    : buildPostVisitBlueprintLink(token, payloadOut);
  return { token, link, payload: payloadOut };
}

export function getStoredPostVisitBlueprint(
  token: string,
): PostVisitBlueprintPayload | null {
  if (!token) return null;
  const raw = localStorage.getItem(getStorageKey(token));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PostVisitBlueprintPayload;
    if (parsed?.version !== 1) return null;
    if (!parsed.patient?.id || !parsed.patient?.name) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Saves a decoded blueprint to localStorage so the same link keeps working on repeat visits
 * (and short `?t=` links work on this device after the patient has opened the full link once).
 * Does not make links work across devices if the URL was truncated — the full `d` param is still required for the first open.
 */
export function persistPostVisitBlueprint(
  payload: PostVisitBlueprintPayload,
  options?: { urlToken?: string | null },
): void {
  if (payload?.version !== 1 || !payload.token?.trim()) return;
  if (!payload.patient?.id || !payload.patient?.name) return;
  try {
    const raw = JSON.stringify(payload);
    localStorage.setItem(getStorageKey(payload.token), raw);
    const alt = options?.urlToken?.trim();
    if (alt && alt !== payload.token) {
      localStorage.setItem(getStorageKey(alt), raw);
    }
  } catch {
    /* quota / private mode */
  }
}

export function getPostVisitBlueprintFromUrlData():
  | PostVisitBlueprintPayload
  | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get("d")?.trim() ?? "";
  if (!encoded) return null;
  return decodeBlueprintPayload(encoded);
}

/** Validate JSON from GET /api/dashboard/blueprint (or similar). */
export function parsePostVisitBlueprintPayload(
  data: unknown,
): PostVisitBlueprintPayload | null {
  if (data == null || typeof data !== "object") return null;
  const p = data as PostVisitBlueprintPayload;
  if (p.version !== 1) return null;
  const tok = typeof p.token === "string" ? p.token.trim() : "";
  if (!tok) return null;
  if (!p.patient?.id || !p.patient?.name) return null;
  return p;
}

export function trackPostVisitBlueprintEvent(
  eventName: BlueprintEventName,
  properties?: Record<string, unknown>,
): void {
  if (!window.posthog) return;
  window.posthog.capture(eventName, properties ?? {});
}
