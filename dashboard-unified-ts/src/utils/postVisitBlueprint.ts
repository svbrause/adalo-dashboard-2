import type { Client, DiscussedItem } from "../types";
import type { SkincareQuizData } from "../types";
import { isPlanQuoteCoreDiscussedItem } from "./discussedPlanQuoteRole";
import {
  formatPrice,
  type CheckoutLineItemDetail,
} from "../data/treatmentPricing2025";
import {
  fetchAIAssessment,
  fetchPostVisitBlueprintFromServer,
  storePostVisitBlueprintOnServer,
} from "../services/api";
import type { BlueprintAnalysisSummary } from "./postVisitBlueprintAnalysis";
import {
  buildAnalysisSummaryFromClient,
  type BlueprintAnalysisOverviewSnapshot,
} from "./postVisitBlueprintAnalysis";
import { getDetectedIssueDisplayStrings } from "./analysisOverviewClient";
import { getAlignedCheckoutLineItemsForDiscussedItems } from "../components/modals/DiscussedTreatmentsModal/TreatmentPlanCheckout";
import {
  getEffectivePriceList,
  TREATMENT_PRICE_LIST_2025,
  type TreatmentPriceItem,
} from "../data/treatmentPricing2025";
import { isWellnestWellnessProviderCode } from "../data/wellnestOfferings";
import { getQuoteLineDiscussedItemIndexOrder } from "./pvbQuotePartition";
import { isValidPlanScheduledDateIso } from "./planScheduledDate";
import { getClientGlbUrl } from "./client3dConfig";

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
/** Wellnest token-in-path route: avoids query/hash payloads in patient SMS links. */
export const POST_VISIT_BLUEPRINT_WELLNEST_PATH = "/tpw";
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
    skincareQuiz?: SkincareQuizData | null;
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
    /** GCS turntable MP4 when captured at send time (patient-facing 3D hero). */
    turntableVideoUrl?: string | null;
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

const BLUEPRINT_SERVER_STORE_NARRATIVE_MAX_CHARS = 4_000;
const BLUEPRINT_URL_EMBED_ASSESSMENT_MAX_CHARS = 800;
const BLUEPRINT_SERVER_STORE_ASSESSMENT_MAX_CHARS = 2_500;
const BLUEPRINT_URL_EMBED_GOAL_MAX_CHARS = 120;
const BLUEPRINT_URL_EMBED_AREA_IMPROVEMENTS_MAX = 5;

type CompactBlueprintOptions = {
  /** Drop fields that inflate URL hash when server storage fails. */
  forUrlEmbed?: boolean;
  /** Omit analysis entirely (Wellnest server store). */
  omitAnalysis?: boolean;
  /** Rewrite patient id for public Wellnest links. */
  publicPatientId?: string;
};

function truncateText(value: string | null | undefined, max: number): string | undefined {
  const s = value?.trim();
  if (!s) return undefined;
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

function minimalSkincareQuizForShare(
  quiz: SkincareQuizData | null | undefined,
): SkincareQuizData | undefined {
  if (!quiz?.result) return undefined;
  return {
    version: 1,
    completedAt: quiz.completedAt,
    answers: {},
    result: quiz.result,
    resultLabel: quiz.resultLabel,
    resultDescription: truncateText(quiz.resultDescription, 240),
  };
}

function compactDiscussedItemsForShare(
  items: DiscussedItem[],
): DiscussedItem[] {
  return items.map((item) => ({
    id: item.id,
    addedAt: item.addedAt,
    interest: item.interest,
    findings: item.findings,
    treatment: item.treatment,
    product: item.product,
    skincareAddOnForTreatment: item.skincareAddOnForTreatment,
    brand: item.brand,
    region: item.region,
    timeline: item.timeline,
    scheduledDate: item.scheduledDate,
    quantity: item.quantity,
    recurring: item.recurring,
    planQuoteRole: item.planQuoteRole,
  }));
}

function compactQuoteLineItemsForShare(
  lineItems: CheckoutLineItemDetail[],
): CheckoutLineItemDetail[] {
  return lineItems.map((line) => ({
    label: line.label,
    skuName: line.skuName,
    skuNote: line.skuNote,
    price: line.price,
    displayPrice: line.displayPrice,
    longevity: line.longevity,
    downtime: line.downtime,
    sessions: line.sessions,
    isEstimate: line.isEstimate,
    description: line.description,
    missingInfo: line.missingInfo,
    quoteLineKind: line.quoteLineKind,
    hidePriceFromPatient: line.hidePriceFromPatient,
    patientPriceOverride: line.patientPriceOverride,
  }));
}

function compactOverviewSnapshotForShare(
  snapshot: BlueprintAnalysisOverviewSnapshot,
  options: { forUrlEmbed: boolean },
): BlueprintAnalysisOverviewSnapshot {
  const narrativeMax = options.forUrlEmbed
    ? 0
    : BLUEPRINT_SERVER_STORE_NARRATIVE_MAX_CHARS;
  const assessmentMax = options.forUrlEmbed
    ? BLUEPRINT_URL_EMBED_ASSESSMENT_MAX_CHARS
    : BLUEPRINT_SERVER_STORE_ASSESSMENT_MAX_CHARS;
  const aiNarrative =
    narrativeMax > 0
      ? truncateText(snapshot.aiNarrative, narrativeMax)
      : undefined;
  return {
    overallScore: snapshot.overallScore,
    overallTier: snapshot.overallTier,
    assessmentParagraph:
      truncateText(snapshot.assessmentParagraph, assessmentMax) ??
      snapshot.assessmentParagraph,
    categories: snapshot.categories.map((c) => ({
      key: c.key,
      name: c.name,
      scoreLabel: c.scoreLabel,
      score: c.score,
      tier: c.tier,
      description: options.forUrlEmbed ? "" : c.description,
      subScores: c.subScores?.map((s) => ({
        name: s.name,
        score: s.score,
        total: s.total,
        detected: s.detected,
      })),
    })),
    areas: snapshot.areas.map((a) => ({
      name: a.name,
      score: a.score,
      tier: a.tier,
      hasInterest: a.hasInterest,
      improvements: a.improvements.slice(0, BLUEPRINT_URL_EMBED_AREA_IMPROVEMENTS_MAX),
      ...(options.forUrlEmbed ? {} : { strengths: a.strengths }),
    })),
    detectedIssueLabels: snapshot.detectedIssueLabels,
    ...(aiNarrative ? { aiNarrative } : {}),
  };
}

function compactAnalysisSummaryForShare(
  summary: BlueprintAnalysisSummary | undefined,
  options: { forUrlEmbed: boolean; omitAnalysis: boolean },
): BlueprintAnalysisSummary | undefined {
  if (!summary || options.omitAnalysis) return undefined;
  const os = summary.overviewSnapshot;
  if (os) {
    const compactSnapshot = compactOverviewSnapshotForShare(os, {
      forUrlEmbed: options.forUrlEmbed,
    });
    if (options.forUrlEmbed) {
      return {
        goals: summary.goals
          ?.slice(0, 4)
          .map((g) => truncateText(g, BLUEPRINT_URL_EMBED_GOAL_MAX_CHARS) ?? g),
        concerns: null,
        aestheticGoals: null,
        interestedIssues: null,
        whichRegions: null,
        skinComplaints: null,
        processedAreasOfInterest: null,
        overviewSnapshot: compactSnapshot,
      };
    }
    return {
      goals: summary.goals,
      overviewSnapshot: compactSnapshot,
      concerns: truncateText(summary.concerns, 400) ?? summary.concerns,
      aestheticGoals:
        truncateText(summary.aestheticGoals, 400) ?? summary.aestheticGoals,
      interestedIssues: truncateText(summary.interestedIssues, 650) ?? summary.interestedIssues,
      whichRegions: truncateText(summary.whichRegions, 650) ?? summary.whichRegions,
      skinComplaints: truncateText(summary.skinComplaints, 650) ?? summary.skinComplaints,
      processedAreasOfInterest:
        truncateText(summary.processedAreasOfInterest, 650) ??
        summary.processedAreasOfInterest,
    };
  }
  return {
    goals: summary.goals?.slice(0, options.forUrlEmbed ? 4 : undefined),
    concerns:
      truncateText(summary.concerns, options.forUrlEmbed ? 300 : 650) ?? null,
    aestheticGoals: truncateText(
      summary.aestheticGoals,
      options.forUrlEmbed ? 300 : 650,
    ) ?? null,
    interestedIssues: truncateText(
      summary.interestedIssues,
      options.forUrlEmbed ? 200 : 650,
    ) ?? null,
    whichRegions: truncateText(
      summary.whichRegions,
      options.forUrlEmbed ? 200 : 650,
    ) ?? null,
    skinComplaints: truncateText(
      summary.skinComplaints,
      options.forUrlEmbed ? 200 : 650,
    ) ?? null,
    processedAreasOfInterest: truncateText(
      summary.processedAreasOfInterest,
      options.forUrlEmbed ? 200 : 650,
    ) ?? null,
  };
}

function compactPatientForShare(
  patient: PostVisitBlueprintPayload["patient"],
  options: { forUrlEmbed: boolean },
): PostVisitBlueprintPayload["patient"] {
  const base = {
    ...patient,
    frontPhotoDataUrl: undefined,
  };
  if (!options.forUrlEmbed) return base;
  return {
    id: base.id,
    name: base.name,
    phone: base.phone,
    tableSource: base.tableSource,
    ageRange: base.ageRange,
    skinType: base.skinType,
    skinTone: base.skinTone,
    frontPhoto: base.frontPhoto,
    frontPhotoPersistentUrl: base.frontPhotoPersistentUrl,
    frontPhotoAttachmentId: base.frontPhotoAttachmentId,
    skincareQuiz: minimalSkincareQuizForShare(base.skincareQuiz),
  };
}

/**
 * Shrinks blueprint JSON before server POST or URL hash embed so links stay short and storage succeeds.
 * Full payload remains in provider localStorage for dashboard preview.
 */
function compactBlueprintPayload(
  payload: PostVisitBlueprintPayload,
  options: CompactBlueprintOptions = {},
): PostVisitBlueprintPayload {
  const forUrlEmbed = options.forUrlEmbed ?? false;
  const patient = compactPatientForShare(payload.patient, { forUrlEmbed });
  if (options.publicPatientId !== undefined) {
    patient.id = options.publicPatientId;
  }
  return {
    version: payload.version,
    token: payload.token,
    createdAt: payload.createdAt,
    clinicName: payload.clinicName,
    providerName: payload.providerName,
    providerCode: payload.providerCode,
    providerPhone: payload.providerPhone,
    patient,
    discussedItems: compactDiscussedItemsForShare(payload.discussedItems),
    quote: {
      ...payload.quote,
      lineItems: compactQuoteLineItemsForShare(payload.quote.lineItems),
    },
    cta: payload.cta,
    analysisSummary: compactAnalysisSummaryForShare(payload.analysisSummary, {
      forUrlEmbed,
      omitAnalysis: options.omitAnalysis ?? false,
    }),
    ...(forUrlEmbed || options.omitAnalysis
      ? {}
      : payload.recommenderFocusRegions?.length
        ? { recommenderFocusRegions: [...payload.recommenderFocusRegions] }
        : {}),
  };
}

/**
 * Strip embedded photo bytes and trim long prose before POSTing blueprint JSON so
 * server storage succeeds and SMS links stay short (`/tp?t=` only).
 */
function slimBlueprintPayloadForServerStore(
  payload: PostVisitBlueprintPayload,
): PostVisitBlueprintPayload {
  return compactBlueprintPayload(payload, { forUrlEmbed: false });
}

/**
 * include embedded photo bytes or long analysis prose. Store the durable clinical plan
 * snapshot server-side, but let the patient page resolve media from stable/public sources.
 */
function slimWellnestBlueprintPayloadForServerStore(
  payload: PostVisitBlueprintPayload,
  options?: { publicPatientId?: string },
): PostVisitBlueprintPayload {
  if (!isWellnestWellnessProviderCode(payload.providerCode)) return payload;
  const originalPatientId = payload.patient.id.trim();
  const publicPatientId =
    options?.publicPatientId ??
    (originalPatientId.startsWith("wellnest-")
      ? originalPatientId
      : `wellnest-${originalPatientId}`);
  return compactBlueprintPayload(payload, {
    forUrlEmbed: false,
    omitAnalysis: true,
    publicPatientId,
  });
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

/** Turntable MP4 for patient-facing 3D hero (stored on send, or demo name map). */
export function isBrokenTurntableVideoUrl(url: string | null | undefined): boolean {
  const u = (url ?? "").trim();
  if (!u) return true;
  if (u.startsWith("/src/") || u.includes("/src/assets/")) return true;
  return false;
}

/** Turntable MP4 for patient-facing 3D hero (stored on send, or demo name map). */
export function resolveBlueprintTurntableVideoUrl(
  patient: {
    id?: string;
    name: string;
    turntableVideoUrl?: string | null;
  },
): string | null {
  const fromName = getClientGlbUrl(patient.name);
  if (fromName) return fromName;

  const stored = patient.turntableVideoUrl?.trim();
  if (stored && !isBrokenTurntableVideoUrl(stored)) return stored;
  return null;
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
    p === normalizePath(POST_VISIT_BLUEPRINT_WELLNEST_PATH) ||
    p.startsWith(`${normalizePath(POST_VISIT_BLUEPRINT_WELLNEST_PATH)}/`) ||
    p === normalizePath(LEGACY_POST_VISIT_BLUEPRINT_PATH)
  );
}

export function parsePostVisitBlueprintTokenFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const path = normalizePath(window.location.pathname);
  const wellnestPrefix = `${normalizePath(POST_VISIT_BLUEPRINT_WELLNEST_PATH)}/`;
  if (path.startsWith(wellnestPrefix)) {
    const tokenFromPath = decodeURIComponent(path.slice(wellnestPrefix.length)).trim();
    if (tokenFromPath) return tokenFromPath;
  }
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
  options?: { wellnestPath?: boolean },
): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  if (options?.wellnestPath) {
    return `${base}${POST_VISIT_BLUEPRINT_WELLNEST_PATH}/${encodeURIComponent(token)}`;
  }
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
 * Whether a plan row may appear on Post Visit Blueprint: **Now**, **Add next visit**,
 * **Scheduled** (calendar date or Scheduled section), **Wishlist** (or unset timeline),
 * and **Skincare** — not **Completed** or other timelines.
 */
export function isDiscussedItemOnPostVisitBlueprint(item: DiscussedItem): boolean {
  const treatment = (item.treatment ?? "").trim();
  if (treatment === "Skincare") return true;
  const tl = (item.timeline ?? "").trim().toLowerCase();
  if (tl === "completed") return false;
  if (isValidPlanScheduledDateIso((item.scheduledDate ?? "").trim())) return true;
  if (tl === "scheduled") return true;
  return (
    tl === "" ||
    tl === "now" ||
    tl === "add next visit" ||
    tl === "wishlist"
  );
}

/**
 * Wishlist bucket for non-skincare treatments: explicit Wishlist or missing timeline.
 */
export function isWishlistTimelineDiscussedItem(item: DiscussedItem): boolean {
  if ((item.treatment ?? "").trim() === "Skincare") return false;
  if (item.scheduledDate?.trim()) return false;
  const t = (item.timeline ?? "").trim();
  return t === "Wishlist" || !t;
}

/**
 * Patient link shows a dollar amount for **Now** / **Add next visit** / Skincare;
 * **Wishlist** (and unset timeline) lines omit price on the shared page.
 */
export function showPriceOnSharedTreatmentPlanLink(item: DiscussedItem): boolean {
  if ((item.treatment ?? "").trim() === "Skincare") return true;
  return !isWishlistTimelineDiscussedItem(item);
}

/** Preserve list order; drops Completed treatments only. */
export function filterDiscussedItemsForPostVisitBlueprint(
  items: DiscussedItem[],
): DiscussedItem[] {
  return items.filter(isDiscussedItemOnPostVisitBlueprint);
}

/**
 * Default checkbox when sharing the patient treatment-plan link: active plan lines
 * (Now, Add next visit, Scheduled, Skincare) are included; Wishlist lines are not.
 */
export function defaultIncludeItemInSharedTreatmentPlanLink(
  item: DiscussedItem,
): boolean {
  return !isWishlistTimelineDiscussedItem(item);
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
  /** When set, `false` for a discussed-item id hides that line’s price on the patient plan. */
  sharePriceWithPatientByDiscussedId?: Readonly<Record<string, boolean>> | null,
  /** When set, per discussed-item id: patient-facing dollar amount for that quote line (share price on). */
  patientPriceOverrideByDiscussedId?: Readonly<Record<string, number>> | null,
  priceList: { category: string; items: TreatmentPriceItem[] }[] = TREATMENT_PRICE_LIST_2025,
): {
  lineItems: CheckoutLineItemDetail[];
  total: number;
  totalAfterDiscount: number;
  hasUnknownPrices: boolean;
  isMintMember: boolean;
} {
  const aligned = getAlignedCheckoutLineItemsForDiscussedItems(
    fullDiscussedItems,
    priceList,
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
    const line = lineItems[i]!;
    const hide =
      sharePriceWithPatientByDiscussedId &&
      sharePriceWithPatientByDiscussedId[d.id] === false;
    const ovRaw = patientPriceOverrideByDiscussedId?.[d.id];
    const override =
      !hide &&
      typeof ovRaw === "number" &&
      Number.isFinite(ovRaw) &&
      ovRaw >= 0
        ? Math.round(ovRaw * 100) / 100
        : undefined;
    let next: CheckoutLineItemDetail = { ...line };
    if (hide) {
      next = { ...next, hidePriceFromPatient: true };
    } else if (override !== undefined) {
      next = {
        ...next,
        patientPriceOverride: override,
        displayPrice: formatPrice(override),
      };
    }
    bpLineItems.push(next);
  }
  const bpTotal = bpLineItems.reduce((s, l) => {
    if (l?.hidePriceFromPatient) return s;
    const o = l.patientPriceOverride;
    if (typeof o === "number" && Number.isFinite(o) && o >= 0) return s + o;
    return s + (l?.price ?? 0);
  }, 0);
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
  /**
   * Per discussed-item id: `false` hides that line’s price on the patient plan (omitted = show).
   */
  sharePriceWithPatientByDiscussedId?: Readonly<Record<string, boolean>>;
  /**
   * Per discussed-item id: optional patient-facing line total when sharing price (corrects wrong auto price).
   */
  patientPriceOverrideByDiscussedId?: Readonly<Record<string, number>>;
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
      "Choose at least one treatment-plan, wishlist, or Skincare item to include on the shared treatment plan.",
    );
  }
  const priceList = getEffectivePriceList(undefined, input.providerCode);
  const bpQuote = sliceQuoteForPostVisitBlueprint(
    input.discussedItems,
    input.quote,
    input.includedDiscussedItemIds?.size
      ? input.includedDiscussedItemIds
      : null,
    input.sharePriceWithPatientByDiscussedId ?? null,
    input.patientPriceOverrideByDiscussedId ?? null,
    priceList,
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
      skincareQuiz: input.client.skincareQuiz ?? undefined,
      skinTone: input.client.skinTone,
      ethnicBackground: input.client.ethnicBackground,
      frontPhoto: basePhotoUrl,
      frontPhotoDataUrl: frontPhotoDataUrl || undefined,
      frontPhotoAttachmentId: attachmentId || undefined,
      turntableVideoUrl:
        resolveBlueprintTurntableVideoUrl({
          name: input.client.name,
          turntableVideoUrl: input.client.turntableVideoUrl,
        }) || undefined,
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
  const isWellnestBlueprint = isWellnestWellnessProviderCode(input.providerCode);
  // Wellnest patient IDs get a "wellnest-" prefix which Airtable always rejects as an invalid
  // record ID. Skip the linked attempt and store without a patient link directly.
  let storedRemote: boolean;
  if (isWellnestBlueprint) {
    const unlinkedStorePayload = slimWellnestBlueprintPayloadForServerStore(
      payloadOut,
      { publicPatientId: "" },
    );
    storedRemote = await storePostVisitBlueprintOnServerWithRetry(
      unlinkedStorePayload as unknown as Record<string, unknown>,
    );
  } else {
    storedRemote = await storePostVisitBlueprintOnServerWithRetry(
      slimBlueprintPayloadForServerStore(payloadOut) as unknown as Record<
        string,
        unknown
      >,
    );
  }
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
  if (isWellnestBlueprint && !storedRemote) {
    throw new Error(
      "Could not prepare a short Wellnest treatment plan link. Please try again in a moment.",
    );
  }
  const link = buildPostVisitBlueprintLink(token, undefined, {
    wellnestPath: isWellnestBlueprint,
  });
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
  if (!p.patient?.name) return null;
  if (!p.patient?.id && isWellnestWellnessProviderCode(p.providerCode)) {
    return {
      ...p,
      patient: {
        ...p.patient,
        id: `wellnest-${tok}`,
      },
    };
  }
  if (!p.patient?.id) return null;
  return p;
}

/** @internal Exported for unit tests — compacts blueprint JSON before server POST or URL embed. */
export function compactPostVisitBlueprintPayloadForShare(
  payload: PostVisitBlueprintPayload,
  options?: CompactBlueprintOptions,
): PostVisitBlueprintPayload {
  return compactBlueprintPayload(payload, options ?? {});
}

export function trackPostVisitBlueprintEvent(
  eventName: BlueprintEventName,
  properties?: Record<string, unknown>,
): void {
  if (!window.posthog) return;
  window.posthog.capture(eventName, properties ?? {});
}

export { isPlanQuoteCoreDiscussedItem };
