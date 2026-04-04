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
import { getAlignedCheckoutLineItemsForDiscussedItems } from "../components/modals/DiscussedTreatmentsModal/TreatmentPlanCheckout";
import { getQuoteLineDiscussedItemIndexOrder } from "./pvbQuotePartition";

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

/** Patient-facing shared plan URL (SPA route). Still accepted for bookmarks and old links. */
export const POST_VISIT_BLUEPRINT_PATH = "/treatment-plan";
/** Shorter path used in new SMS / share links (same page as {@link POST_VISIT_BLUEPRINT_PATH}). */
export const POST_VISIT_BLUEPRINT_SHORT_PATH = "/tp";
/** Legacy path — still recognized so old SMS links keep working. */
export const LEGACY_POST_VISIT_BLUEPRINT_PATH = "/post-visit-blueprint";
const BLUEPRINT_STORAGE_KEY_PREFIX = "post_visit_blueprint_v1:";

export type BlueprintEventName =
  | "blueprint_delivered"
  | "blueprint_opened"
  | "video_played_module_X"
  | "case_gallery_viewed"
  | "booking_clicked"
  | "blueprint_quote_opened"
  | "blueprint_quote_closed"
  | "blueprint_quote_line_toggled"
  | "blueprint_mint_preview_toggled"
  | "blueprint_mint_info_opened"
  | "blueprint_toc_navigated"
  | "blueprint_narrative_audio_started"
  | "blueprint_narrative_audio_stopped"
  | "blueprint_case_detail_opened"
  | "blueprint_booking_confirm_viewed"
  | "blueprint_booking_back_to_quote"
  | "blueprint_booking_done"
  | "blueprint_text_provider_clicked"
  | "blueprint_analysis_subpage_viewed"
  | "blueprint_plan_feedback_reaction"
  | "blueprint_video_modal_opened"
  | "blueprint_external_link_clicked"
  | "blueprint_brand_website_clicked"
  | "blueprint_glossary_section_toggled"
  | "blueprint_subpage_jump_to_guide"
  | "blueprint_subpage_treatment_details_opened"
  | "blueprint_subpage_eye_area_cta_clicked";

/** Shared analytics ids on patient blueprint pages (PostHog). */
export type BlueprintPatientAnalyticsBase = {
  token: string;
  patient_id: string;
};

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

/** Cap narrative length when embedding in URL hash (avoids browser / SMS fragment limits). */
const BLUEPRINT_URL_EMBED_NARRATIVE_MAX_CHARS = 12_000;

/**
 * Strips the hero data URL and trims long text before putting payload in the URL.
 * Used only when server storage failed — keeps the HTTP request path short (`?t=` only)
 * and the hash fragment smaller than a giant base64 image would allow.
 */
function slimBlueprintPayloadForUrlEmbed(
  payload: PostVisitBlueprintPayload,
): PostVisitBlueprintPayload {
  const patient = { ...payload.patient, frontPhotoDataUrl: undefined };
  const as = payload.analysisSummary;
  if (!as) return { ...payload, patient };

  const os = as.overviewSnapshot;
  const narrative = os?.aiNarrative;
  if (
    typeof narrative === "string" &&
    narrative.length > BLUEPRINT_URL_EMBED_NARRATIVE_MAX_CHARS
  ) {
    return {
      ...payload,
      patient,
      analysisSummary: {
        ...as,
        overviewSnapshot: os
          ? {
              ...os,
              aiNarrative: `${narrative.slice(0, BLUEPRINT_URL_EMBED_NARRATIVE_MAX_CHARS)}…`,
            }
          : os,
      },
    };
  }
  return { ...payload, patient };
}

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
  const p = normalizePath(window.location.pathname);
  return (
    p === normalizePath(POST_VISIT_BLUEPRINT_PATH) ||
    p === normalizePath(POST_VISIT_BLUEPRINT_SHORT_PATH) ||
    p === normalizePath(LEGACY_POST_VISIT_BLUEPRINT_PATH)
  );
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
  /** Prefer `/tp` so SMS and copy-paste links stay shorter than `/treatment-plan`. */
  const query = params.toString();
  if (!payload) {
    return `${base}${POST_VISIT_BLUEPRINT_SHORT_PATH}?${query}`;
  }
  /**
   * Put embedded JSON in the fragment, not the query string. Long `?d=` URLs hit
   * reverse-proxy limits (e.g. Vercel `URI_TOO_LONG`) before the SPA loads.
   */
  const encoded = encodeBlueprintPayload(payload);
  return `${base}${POST_VISIT_BLUEPRINT_SHORT_PATH}?${query}#d=${encodeURIComponent(encoded)}`;
}

/** Try server persist a few times so we avoid the URL-embedded fallback when the API is flaky. */
async function storePostVisitBlueprintOnServerWithRetry(
  payload: Record<string, unknown>,
  maxAttempts = 3,
): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const ok = await storePostVisitBlueprintOnServer(payload);
    if (ok) return true;
    if (attempt < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
    }
  }
  return false;
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
 * Timelines omitted from the patient blueprint share picker and payload.
 * **Completed** only — items in **Now** stay eligible so recommender defaults
 * (`TIMELINE_OPTIONS[0]` = "Now") still appear when sharing the post-visit link.
 */
const PVB_EXCLUDED_TIMELINES = new Set(["completed"]);

/**
 * Whether a plan row may appear on Post Visit Blueprint: **Now**, **Add next visit**,
 * **Wishlist**, Skincare — not **Completed**. Unknown/empty timelines count as wishlist-style.
 */
export function isDiscussedItemOnPostVisitBlueprint(item: DiscussedItem): boolean {
  const treatment = (item.treatment ?? "").trim();
  if (treatment === "Skincare") return true;
  const tl = (item.timeline ?? "").trim().toLowerCase();
  return !PVB_EXCLUDED_TIMELINES.has(tl);
}

/** Preserve list order; drops Completed treatments only. */
export function filterDiscussedItemsForPostVisitBlueprint(
  items: DiscussedItem[],
): DiscussedItem[] {
  return items.filter(isDiscussedItemOnPostVisitBlueprint);
}

/**
 * Default checkbox state when sharing the patient treatment-plan link:
 * **Now**, **Add next visit**, and **Skincare** on; **Wishlist** (and empty timeline) off.
 */
export function defaultIncludeItemInSharedTreatmentPlanLink(
  item: DiscussedItem,
): boolean {
  if (!isDiscussedItemOnPostVisitBlueprint(item)) return false;
  if ((item.treatment ?? "").trim() === "Skincare") return true;
  const t = (item.timeline ?? "").trim();
  return t === "Add next visit" || t === "Now";
}

function sliceQuoteForPostVisitBlueprint(
  fullDiscussedItems: DiscussedItem[],
  quote: {
    lineItems: CheckoutLineItemDetail[];
    total: number;
    totalAfterDiscount: number;
    hasUnknownPrices: boolean;
    isMintMember: boolean;
  },
  includedDiscussedItemIds?: Set<string> | null,
): {
  lineItems: CheckoutLineItemDetail[];
  total: number;
  totalAfterDiscount: number;
  hasUnknownPrices: boolean;
  isMintMember: boolean;
} {
  const aligned = getAlignedCheckoutLineItemsForDiscussedItems(
    fullDiscussedItems,
  );
  const order = getQuoteLineDiscussedItemIndexOrder(
    fullDiscussedItems,
    aligned,
  );
  const lineItems = quote.lineItems;
  const bpLineItems: CheckoutLineItemDetail[] = [];
  const n = Math.min(lineItems.length, order.length);
  for (let i = 0; i < n; i++) {
    const d = fullDiscussedItems[order[i]!];
    if (!d || !isDiscussedItemOnPostVisitBlueprint(d)) continue;
    if (includedDiscussedItemIds && !includedDiscussedItemIds.has(d.id)) {
      continue;
    }
    bpLineItems.push(lineItems[i]!);
  }
  const bpTotal = bpLineItems.reduce((s, l) => s + (l?.price ?? 0), 0);
  const origTotal = quote.total;
  const bpTotalAfterDiscount =
    origTotal > 0
      ? (quote.totalAfterDiscount / origTotal) * bpTotal
      : quote.totalAfterDiscount;
  const hasUnknownPrices = bpLineItems.some(
    (l) =>
      l?.displayPrice === "Price varies" || (l?.price === 0 && l?.isEstimate),
  );
  return {
    lineItems: bpLineItems,
    total: bpTotal,
    totalAfterDiscount: Math.round(bpTotalAfterDiscount * 100) / 100,
    hasUnknownPrices,
    isMintMember: quote.isMintMember,
  };
}

/**
 * Start hero-photo + AI prep early (e.g. when Treatment Plan Quote opens with a valid plan).
 * Safe to call repeatedly; work is deduped per client + discussed item ids.
 */
export function warmPostVisitBlueprintForSend(
  client: Client,
  discussedItems: DiscussedItem[],
): void {
  const bp = filterDiscussedItemsForPostVisitBlueprint(discussedItems);
  if (!bp.length) return;
  void getSharedBlueprintHeavyPrep(client, bp).catch(() => {
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
  /**
   * When set, only these discussed-item ids appear on the patient link and quote.
   * Must be a non-empty subset of blueprint-eligible rows after filtering.
   */
  includedDiscussedItemIds?: Set<string>;
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
  let bpDiscussed = filterDiscussedItemsForPostVisitBlueprint(
    input.discussedItems,
  );
  if (input.includedDiscussedItemIds?.size) {
    bpDiscussed = bpDiscussed.filter((i) =>
      input.includedDiscussedItemIds!.has(i.id),
    );
  }
  if (bpDiscussed.length === 0) {
    throw new Error(
      "Choose at least one Add next visit, Wishlist, or Skincare item to include on the shared treatment plan.",
    );
  }
  const bpQuote = sliceQuoteForPostVisitBlueprint(
    input.discussedItems,
    input.quote,
    input.includedDiscussedItemIds?.size
      ? input.includedDiscussedItemIds
      : null,
  );

  const token = createBlueprintToken();
  const basePhotoUrl = normalizeFrontPhotoUrl(input.client.frontPhoto);
  const attachmentId = extractFrontPhotoAttachmentId(input.client.frontPhoto);
  const { frontPhotoDataUrl, analysisSummary } = await getSharedBlueprintHeavyPrep(
    input.client,
    bpDiscussed,
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
    discussedItems: bpDiscussed,
    quote: bpQuote,
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
  const storedRemote = await storePostVisitBlueprintOnServerWithRetry(
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
    : buildPostVisitBlueprintLink(token, slimBlueprintPayloadForUrlEmbed(payloadOut));
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
 * Does not make links work across devices if the URL was truncated — the full embedded
 * payload (`#d=` or legacy `?d=`) is still required for the first open when the server has no copy.
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
  let encoded = params.get("d")?.trim() ?? "";
  if (!encoded) {
    const hash = window.location.hash;
    if (hash.startsWith("#d=")) {
      const raw = hash.slice(3);
      try {
        encoded = decodeURIComponent(raw).trim();
      } catch {
        encoded = raw.trim();
      }
    }
  }
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
