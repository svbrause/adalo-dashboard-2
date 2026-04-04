import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInViewOnce } from "../../hooks/useInViewOnce";
import {
  fetchBlueprintFrontPhotoFreshUrl,
  fetchPatientRecords,
  fetchPostVisitBlueprintFromServer,
  fetchTreatmentPhotos,
  submitPostVisitBlueprintBookingIntent,
  parsePatientRecordsToCards,
  type AirtableRecord,
  type PatientSuggestionCard,
} from "../../services/api";
import { formatPrice } from "../../data/treatmentPricing2025";
import {
  getPostVisitBlueprintFromUrlData,
  getStoredPostVisitBlueprint,
  persistPostVisitBlueprint,
  parsePostVisitBlueprintPayload,
  parsePostVisitBlueprintTokenFromUrl,
  resolveHeroPhotoDisplayUrl,
  trackPostVisitBlueprintEvent,
  type PostVisitBlueprintPayload,
} from "../../utils/postVisitBlueprint";
import {
  buildTreatmentResultsCards,
  type BlueprintCasePhoto,
  type CaseDetailPayload,
} from "../../utils/postVisitBlueprintCases";
import {
  isPostVisitBlueprintAdminSender,
  isPostVisitBlueprintAllowedForPatient,
} from "../../utils/providerHelpers";
import { isWellnestWellnessProviderCode } from "../../data/wellnestOfferings";
import { buildWellnestBlueprintCasePhotos } from "../../utils/wellnestBlueprintCases";
import { AiMirrorCanvas } from "../postVisitBlueprint/AiMirrorCanvas";
import { PvbNarrativeAudioControls } from "../postVisitBlueprint/PvbNarrativeAudioControls";
import { PvbOverviewSectionsSequentialTypewriter } from "../postVisitBlueprint/PvbTypewriterParagraphs";
import { TreatmentChapterView } from "../postVisitBlueprint/TreatmentChapter";
import { getPostVisitBlueprintVideoCatalog } from "../../config/postVisitBlueprintVideos";
import {
  buildTreatmentChapters,
  splitChapterDisplayAreas,
} from "../../utils/blueprintTreatmentChapters";
import {
  dedupeBlueprintDisplayStrings,
  derivePlanInterestsFromDiscussedItems,
  getBlueprintAnalysisDisplay,
  normalizeBlueprintAnalysisText,
  PVB_ANALYSIS_SECTION_ID,
  treatmentChapterAnchorId,
} from "../../utils/postVisitBlueprintAnalysis";
import {
  buildPvbMainPlanFramingParagraphs,
  buildPvbPlanBridgeParagraph,
} from "../../utils/pvbOverviewNarratives";
import {
  buildPvbMainOverviewSpeechText,
  buildPvbMainOverviewSections,
  type MainOverviewSection,
} from "../../utils/pvbOverviewSpeechText";
import {
  filterGlossaryTermsForChapter,
  getResolvedPlanGlossaryTerms,
} from "../../utils/pvbPlanTermGlossary";
import { mapRecommenderRegionsToMirrorTerms } from "../../utils/pvbRecommenderMirror";
import {
  buildPvbAreaSubpageHash,
  buildPvbCategorySubpageHash,
  buildPvbTreatmentSubpageHash,
  parsePvbAnalysisSubpageHash,
  type PvbAnalysisSubpageRoute,
} from "../../utils/pvbAnalysisSubpageHash";
import {
  PvbAreaDetailSubpage,
  PvbCategoryDetailSubpage,
  PvbTreatmentPlanDetailSubpage,
} from "../postVisitBlueprint/PvbAnalysisSubpages";
import { AiSparkleLogo, GeminiWordmark } from "../ai/AiGeminiBrand";
import { MintMembershipInfoTrigger } from "../shared/MintMembershipInfoTrigger";
import { partitionQuoteLineIndices } from "../../utils/pvbQuotePartition";
import { patientFacingSkincareShortName } from "../../utils/pvbSkincareDisplay";
import "../postVisitBlueprint/PvbNarrative.css";
import "./PostVisitBlueprintPage.css";
import ponceBrandLogoSrc from "../../assets/images/ponce logo.png";

/**
 * True when the hero URL is cross-origin and hosted on a domain that typically
 * does NOT send CORS headers (e.g. raw GCS bucket objects). Same-origin URLs,
 * Airtable attachment URLs, and data URLs don't need help.
 */
function heroUrlNeedsCorsHelp(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.href);
    if (parsed.origin === window.location.origin) return false;
    const h = parsed.hostname;
    return (
      h === "storage.googleapis.com" ||
      h.endsWith(".storage.googleapis.com") ||
      h === "storage.cloud.google.com"
    );
  } catch {
    return false;
  }
}

/** The Treatment Skin Boutique — patient-facing blueprint branding */
const THE_TREATMENT_BRAND_LOGO_SRC =
  "/post-visit-blueprint/videos/The%20Treatment%20Mint%20and%20Gray.png";
const WELLNEST_BRAND_LOGO_SRC =
  "https://wellnestmd.com/wp-content/uploads/2024/12/nav-logo-5.svg";
const WELLNEST_MARKETING_SITE_URL = "https://wellnestmd.com/";

function PvbBrandBar({
  providerCode,
  providerName,
  onWellnestWebsiteClick,
}: {
  providerCode?: string | null;
  providerName?: string | null;
  onWellnestWebsiteClick?: () => void;
}) {
  const isAdminSender = isPostVisitBlueprintAdminSender({
    providerCode: providerCode ?? undefined,
    providerName: providerName ?? undefined,
  });
  const isWellnest = isWellnestWellnessProviderCode(providerCode);
  const brandLogoSrc = isAdminSender
    ? ponceBrandLogoSrc
    : isWellnest
      ? WELLNEST_BRAND_LOGO_SRC
      : THE_TREATMENT_BRAND_LOGO_SRC;
  const brandLabel = isAdminSender
    ? "Ponce AI"
    : isWellnest
      ? "Wellnest MD"
      : "The Treatment Skin Boutique";
  return (
    <header className="pvb-brand-bar" aria-label={brandLabel}>
      <img
        src={brandLogoSrc}
        alt={brandLabel}
        className={`pvb-brand-logo${isAdminSender ? " pvb-brand-logo--ponce" : ""}`}
        width={isAdminSender ? 200 : 220}
        height={isAdminSender ? 48 : 72}
        decoding="async"
      />
      {isWellnest && (
        <a
          href={WELLNEST_MARKETING_SITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="pvb-brand-exit-link"
          aria-label="Visit Wellnest MD website (opens in a new tab)"
          onClick={() => onWellnestWebsiteClick?.()}
        >
          Visit Website
        </a>
      )}
    </header>
  );
}

/** Scroll target for TOC / “What we discussed”. */
const PVB_TOC_ID = "pvb-toc";

/* ── Airtable helpers (data loading) ── */

function toArray(value: unknown): string[] {
  if (Array.isArray(value))
    return value.map((v) => String(v ?? "").trim()).filter(Boolean);
  if (value == null) return [];
  const one = String(value).trim();
  return one ? [one] : [];
}

function isLikelyNonSurgical(fields: Record<string, unknown>): boolean {
  const raw = String(
    fields["Surgical (from General Treatments)"] ?? fields["Surgical"] ?? "",
  ).toLowerCase();
  if (!raw.trim()) return true;
  if (raw.includes("non-surgical") || raw.includes("non surgical")) return true;
  if (raw.includes("surgical") && !raw.includes("non")) return false;
  return true;
}

function mapPhotoRecord(record: AirtableRecord): BlueprintCasePhoto | null {
  const fields = record.fields ?? {};
  if (!isLikelyNonSurgical(fields as Record<string, unknown>)) return null;

  const photoAttachment = fields["Photo"];
  let photoUrl = "";
  if (Array.isArray(photoAttachment) && photoAttachment.length > 0) {
    const att = photoAttachment[0];
    photoUrl =
      att?.thumbnails?.full?.url ||
      att?.thumbnails?.large?.url ||
      att?.url ||
      "";
  }
  if (!photoUrl) return null;

  const caption = String(fields["Caption"] ?? "").trim() || undefined;
  const storyTitle = String(fields["Story Title"] ?? "").trim() || undefined;
  const storyDetailed =
    String(fields["Story Detailed"] ?? "").trim() || undefined;

  return {
    id: record.id,
    photoUrl,
    treatments: [
      ...toArray(fields["Name (from Treatments)"]),
      ...toArray(fields["Treatments"]),
      ...toArray(fields["Name (from General Treatments)"]),
      ...toArray(fields["General Treatments"]),
    ],
    age: String(fields["Age"] ?? "").trim() || undefined,
    skinType: String(fields["Skin Type"] ?? "").trim() || undefined,
    skinTone: String(fields["Skin Tone"] ?? "").trim() || undefined,
    ethnicBackground:
      String(fields["Ethnic Background"] ?? "").trim() || undefined,
    caption,
    storyTitle,
    storyDetailed,
  };
}

/* ── Page component ── */

export default function PostVisitBlueprintPage() {
  const token = parsePostVisitBlueprintTokenFromUrl();
  const inlinePayload = useMemo(() => getPostVisitBlueprintFromUrlData(), []);
  const storedPayload = useMemo(
    () => (token ? getStoredPostVisitBlueprint(token) : null),
    [token],
  );
  const shouldFetchRemoteBlueprint = !inlinePayload && !!token;

  const [remoteBlueprint, setRemoteBlueprint] =
    useState<PostVisitBlueprintPayload | null>(null);
  const [remoteBlueprintResolved, setRemoteBlueprintResolved] = useState(
    !shouldFetchRemoteBlueprint,
  );

  useEffect(() => {
    if (!shouldFetchRemoteBlueprint || !token) return;
    let cancelled = false;
    setRemoteBlueprint(null);
    setRemoteBlueprintResolved(false);
    void (async () => {
      const raw = await fetchPostVisitBlueprintFromServer(token);
      if (cancelled) return;
      const parsed = parsePostVisitBlueprintPayload(raw);
      if (parsed) {
        setRemoteBlueprint(parsed);
        persistPostVisitBlueprint(parsed, { urlToken: token });
      }
      setRemoteBlueprintResolved(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [shouldFetchRemoteBlueprint, token]);

  const blueprint = inlinePayload ?? remoteBlueprint ?? storedPayload;
  const waitingForRemoteBlueprint =
    shouldFetchRemoteBlueprint && !remoteBlueprintResolved && !storedPayload;

  /** Keep a local copy so repeat visits work with `?t=` only (same browser) after the full link was opened once. */
  useEffect(() => {
    const fromUrl = getPostVisitBlueprintFromUrlData();
    if (fromUrl) persistPostVisitBlueprint(fromUrl, { urlToken: token });
  }, [token]);

  const blueprintAllowed = useMemo(
    () =>
      Boolean(blueprint && isPostVisitBlueprintAllowedForPatient(blueprint)),
    [blueprint],
  );

  const [selectedRows, setSelectedRows] = useState<Record<number, boolean>>({});
  const [photoPool, setPhotoPool] = useState<BlueprintCasePhoto[]>([]);
  const [patientSuggestionCards, setPatientSuggestionCards] = useState<
    PatientSuggestionCard[]
  >([]);
  const [selectedCaseDetail, setSelectedCaseDetail] =
    useState<CaseDetailPayload | null>(null);
  const [caseGalleryTracked, setCaseGalleryTracked] = useState(false);
  const videoPlayTrackedRef = useRef<Set<string>>(new Set());
  const [isQuoteOpen, setIsQuoteOpen] = useState(false);
  /** Quote drawer: quote → confirm booking request → success. */
  const [quoteBookStep, setQuoteBookStep] = useState<
    "quote" | "booking_confirm" | "booking_sent"
  >("quote");
  /** Patient can preview Mint member 10% off (defaults from plan at send time). */
  const [previewMintMember, setPreviewMintMember] = useState(false);
  /** POST /api/post-visit-blueprint/booking-intent (Airtable row for Slack / email / SMS). */
  const [bookingIntentSubmitting, setBookingIntentSubmitting] = useState(false);
  const [bookingIntentError, setBookingIntentError] = useState<string | null>(
    null,
  );
  /** Hero / AI Mirror image: embedded data URL, fresh API URL, or stale Airtable URL. */
  const [heroPhotoUrl, setHeroPhotoUrl] = useState<string | null>(null);
  const [overviewGaugeAnimate, setOverviewGaugeAnimate] = useState(false);
  const [analysisSubpage, setAnalysisSubpage] =
    useState<PvbAnalysisSubpageRoute | null>(null);
  /** When opening treatment detail from category/area, Back returns to that screen. */
  const [treatmentReturnRoute, setTreatmentReturnRoute] = useState<Extract<
    PvbAnalysisSubpageRoute,
    { type: "category" } | { type: "area" }
  > | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setOverviewGaugeAnimate(true), 380);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!blueprint) {
      setHeroPhotoUrl(null);
      return;
    }

    const resolvedUrl = resolveHeroPhotoDisplayUrl(blueprint.patient, {
      blueprintToken: blueprint.token,
    });
    setHeroPhotoUrl(resolvedUrl ?? null);

    // Data URLs and same-origin URLs are already CORS-clean — AI Mirror works directly.
    if (resolvedUrl?.startsWith("data:")) return;
    if (resolvedUrl && !heroUrlNeedsCorsHelp(resolvedUrl)) return;

    // Cross-origin URL without CORS (e.g. raw GCS): fetch a fresh Airtable attachment URL
    // which carries CORS headers so AiMirrorCanvas can read pixel data for MediaPipe.
    let cancelled = false;
    void (async () => {
      const fresh = await fetchBlueprintFrontPhotoFreshUrl({
        token: blueprint.token,
        patientId: blueprint.patient.id,
        tableSource: blueprint.patient.tableSource,
        providerCode: blueprint.providerCode,
      });
      if (cancelled || !fresh) return;
      setHeroPhotoUrl(fresh);
    })();
    return () => {
      cancelled = true;
    };
  }, [blueprint]);

  /* ── Analytics ── */

  useEffect(() => {
    if (!blueprint || !blueprintAllowed) return;
    const key = `post_visit_blueprint_opened:${blueprint.token}`;
    if (sessionStorage.getItem(key) === "1") return;
    sessionStorage.setItem(key, "1");
    trackPostVisitBlueprintEvent("blueprint_opened", {
      token: blueprint.token,
      clinic_name: blueprint.clinicName,
      provider_name: blueprint.providerName,
      patient_id: blueprint.patient.id,
    });
  }, [blueprint, blueprintAllowed]);

  useEffect(() => {
    if (!blueprint || !blueprintAllowed) return;
    setSelectedRows(
      blueprint.quote.lineItems.reduce<Record<number, boolean>>(
        (acc, _line, idx) => {
          acc[idx] = true;
          return acc;
        },
        {},
      ),
    );
    setPreviewMintMember(blueprint.quote.isMintMember);
  }, [blueprint, blueprintAllowed]);

  useEffect(() => {
    if (!blueprint || !blueprintAllowed) return;
    let cancelled = false;
    fetchTreatmentPhotos({ limit: 500 })
      .then((records) => {
        if (cancelled) return;
        const mapped = records
          .map(mapPhotoRecord)
          .filter(Boolean) as BlueprintCasePhoto[];
        setPhotoPool(mapped);
      })
      .catch(() => {
        setPhotoPool([]);
      });
    return () => {
      cancelled = true;
    };
  }, [blueprint, blueprintAllowed]);

  useEffect(() => {
    const email = blueprint?.patient?.email?.trim();
    if (!blueprint || !blueprintAllowed || !email) {
      setPatientSuggestionCards([]);
      return;
    }
    let cancelled = false;
    fetchPatientRecords(email)
      .then((records) => {
        if (cancelled) return;
        setPatientSuggestionCards(parsePatientRecordsToCards(records));
      })
      .catch(() => {
        if (!cancelled) setPatientSuggestionCards([]);
      });
    return () => {
      cancelled = true;
    };
  }, [blueprint, blueprintAllowed]);

  /** Airtable explorer pool + Wellnest illustrative cases (peptides rarely match explorer tags). */
  const casePhotoPool = useMemo(() => {
    if (!blueprint) return photoPool;
    if (!isWellnestWellnessProviderCode(blueprint.providerCode))
      return photoPool;
    const extra = buildWellnestBlueprintCasePhotos(blueprint.discussedItems);
    if (!extra.length) return photoPool;
    return [...photoPool, ...extra];
  }, [blueprint, photoPool]);

  /* ── Derived data ── */

  const treatmentResultCards = useMemo(() => {
    if (!blueprint || !blueprintAllowed) return [];
    return buildTreatmentResultsCards(
      blueprint.discussedItems,
      casePhotoPool,
      {
        skinType: blueprint.patient.skinType,
        skinTone: blueprint.patient.skinTone,
        ethnicBackground: blueprint.patient.ethnicBackground,
      },
      8,
    );
  }, [blueprint, blueprintAllowed, casePhotoPool]);

  const blueprintVideoCatalog = useMemo(
    () => getPostVisitBlueprintVideoCatalog(blueprint?.providerCode),
    [blueprint?.providerCode],
  );

  const chapters = useMemo(() => {
    if (!blueprint || !blueprintAllowed) return [];
    return buildTreatmentChapters(
      blueprint.discussedItems,
      treatmentResultCards,
      blueprintVideoCatalog,
      blueprint.quote.lineItems,
    );
  }, [
    blueprint,
    blueprintAllowed,
    treatmentResultCards,
    blueprintVideoCatalog,
  ]);

  const analysisDisplay = useMemo(() => {
    if (!blueprint || !blueprintAllowed) return null;
    return getBlueprintAnalysisDisplay(blueprint);
  }, [blueprint, blueprintAllowed]);

  const overviewBridgeParagraph = useMemo(() => {
    if (!analysisDisplay) return null;
    const names = chapters.map((c) => c.displayName);
    return buildPvbPlanBridgeParagraph(
      names,
      analysisDisplay.overviewSnapshot,
      analysisDisplay.globalPlanInsights,
    );
  }, [analysisDisplay, chapters]);

  const mainOverviewPlanShape = useMemo(() => {
    if (chapters.length === 0) return null;
    const includesSkincare = chapters.some(
      (c) => c.treatment.trim().toLowerCase() === "skincare",
    );
    const includesInOfficeOrProcedures = chapters.some(
      (c) => c.treatment.trim().toLowerCase() !== "skincare",
    );
    return {
      chapterCount: chapters.length,
      includesSkincare,
      includesInOfficeOrProcedures,
    };
  }, [chapters]);

  const mainOverviewPersonalization = useMemo(() => {
    if (!analysisDisplay) return null;
    const focusAreas =
      analysisDisplay.overviewSnapshot?.areas
        ?.filter((a) => a.hasInterest)
        .map((a) => a.name)
        .slice(0, 4) ?? [];
    const interests = Array.from(
      new Set(
        (blueprint?.discussedItems ?? [])
          .map((i) => (i.interest ?? "").trim())
          .filter(Boolean),
      ),
    ).slice(0, 4);
    const displayAreas = Array.from(
      new Set(
        chapters.map((c) => (c.displayArea ?? "").trim()).filter(Boolean),
      ),
    ).slice(0, 4);
    /** Merge global chips, per-plan-item findings, and scan labels so the top overview matches lower sections even when global insights are empty (per-treatment mode). */
    const mergedFindings = (() => {
      const seen = new Set<string>();
      const out: string[] = [];
      const push = (raw: string) => {
        const t = normalizeBlueprintAnalysisText(raw);
        if (!t) return;
        const k = t.toLowerCase();
        if (seen.has(k)) return;
        seen.add(k);
        out.push(t);
      };
      for (const f of analysisDisplay.globalPlanInsights.findings) push(f);
      for (const f of derivePlanInterestsFromDiscussedItems(
        blueprint?.discussedItems ?? [],
      ).findings) {
        push(f);
      }
      for (const f of analysisDisplay.overviewSnapshot?.detectedIssueLabels ??
        []) {
        push(f);
      }
      return out.slice(0, 6);
    })();
    return {
      goals: analysisDisplay.goals.slice(0, 4),
      findings: mergedFindings,
      focusAreas,
      chapterNames: chapters.map((c) => c.displayName).slice(0, 5),
      interests,
      displayAreas,
      patientFirstName: blueprint?.patient.name.split(/\s+/)[0] || undefined,
      ageRange: blueprint?.patient.ageRange,
      skinType: blueprint?.patient.skinType,
    };
  }, [analysisDisplay, chapters, blueprint]);

  const mainPlanFramingParagraphs = useMemo(() => {
    if (!mainOverviewPlanShape) return [];
    return buildPvbMainPlanFramingParagraphs(
      mainOverviewPlanShape,
      mainOverviewPersonalization,
    );
  }, [mainOverviewPlanShape, mainOverviewPersonalization]);

  const chapterPatientPriorities = useMemo(() => {
    if (!analysisDisplay) return [] as string[];
    const focusAreas =
      analysisDisplay.overviewSnapshot?.areas
        ?.filter((a) => a.hasInterest)
        .map((a) => a.name)
        .slice(0, 2) ?? [];
    return [
      ...analysisDisplay.goals.slice(0, 2),
      ...analysisDisplay.globalPlanInsights.findings.slice(0, 2),
      ...focusAreas,
    ];
  }, [analysisDisplay]);

  const mainOverviewSections = useMemo((): MainOverviewSection[] => {
    if (!analysisDisplay) return [];
    return buildPvbMainOverviewSections(
      analysisDisplay,
      overviewBridgeParagraph,
      mainPlanFramingParagraphs,
    );
  }, [analysisDisplay, overviewBridgeParagraph, mainPlanFramingParagraphs]);

  const planGlossaryTerms = useMemo(() => {
    if (!blueprint || !blueprintAllowed || !analysisDisplay) return [];
    const overviewSnippets: string[] = [];
    const os = analysisDisplay.overviewSnapshot;
    if (os?.assessmentParagraph) overviewSnippets.push(os.assessmentParagraph);
    if (os?.aiNarrative) overviewSnippets.push(os.aiNarrative);
    for (const row of analysisDisplay.clinicalSnapshotLines) {
      overviewSnippets.push(`${row.label}: ${row.text}`);
    }
    if (overviewBridgeParagraph) overviewSnippets.push(overviewBridgeParagraph);
    if (mainPlanFramingParagraphs.length > 0) {
      overviewSnippets.push(mainPlanFramingParagraphs.join(" "));
    }
    return getResolvedPlanGlossaryTerms(
      blueprint.discussedItems,
      blueprint.quote.lineItems,
      overviewSnippets,
    );
  }, [
    blueprint,
    blueprintAllowed,
    analysisDisplay,
    overviewBridgeParagraph,
    mainPlanFramingParagraphs,
  ]);

  const mainOverviewSpeechText = useMemo(() => {
    if (!analysisDisplay) return "";
    return buildPvbMainOverviewSpeechText(
      analysisDisplay,
      overviewBridgeParagraph,
      mainPlanFramingParagraphs,
    );
  }, [analysisDisplay, overviewBridgeParagraph, mainPlanFramingParagraphs]);

  const quotePartition = useMemo(() => {
    if (!blueprint || !blueprintAllowed) {
      return { skincare: [] as number[], treatment: [] as number[] };
    }
    return partitionQuoteLineIndices(
      blueprint.quote.lineItems,
      blueprint.discussedItems,
    );
  }, [blueprint, blueprintAllowed]);

  const [overviewSectionRef, overviewSectionInView] =
    useInViewOnce<HTMLElement>("0px 0px -5% 0px", 0.05);

  /** Open link with #fragment → scroll to chapter after load */
  useEffect(() => {
    if (chapters.length === 0) return;
    const hash =
      typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    if (!hash) return;
    const el = document.getElementById(hash);
    if (!el) return;
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    return () => window.clearTimeout(t);
  }, [chapters]);

  useEffect(() => {
    if (isQuoteOpen) {
      setQuoteBookStep("quote");
      setBookingIntentError(null);
    }
  }, [isQuoteOpen]);

  /* ── Callbacks ── */

  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      try {
        window.history.replaceState(null, "", `#${id}`);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const scrollToChapter = useCallback(
    (key: string) => {
      scrollToSection(treatmentChapterAnchorId(key));
    },
    [scrollToSection],
  );

  const closeAnalysisSubpage = useCallback(() => {
    setAnalysisSubpage(null);
    setTreatmentReturnRoute(null);
    const { pathname, search } = window.location;
    window.history.replaceState(null, "", pathname + search);
  }, []);

  const openTreatmentPlanSubpage = useCallback(
    (key: string) => {
      if (
        analysisSubpage?.type === "category" ||
        analysisSubpage?.type === "area"
      ) {
        setTreatmentReturnRoute(analysisSubpage);
      } else {
        setTreatmentReturnRoute(null);
      }
      setAnalysisSubpage({ type: "treatment", key });
      const { pathname, search } = window.location;
      window.history.replaceState(
        null,
        "",
        `${pathname}${search}${buildPvbTreatmentSubpageHash(key)}`,
      );
    },
    [analysisSubpage],
  );

  const backFromTreatmentSubpage = useCallback(() => {
    if (treatmentReturnRoute) {
      const parent = treatmentReturnRoute;
      setTreatmentReturnRoute(null);
      setAnalysisSubpage(parent);
      const { pathname, search } = window.location;
      if (parent.type === "category") {
        window.history.replaceState(
          null,
          "",
          `${pathname}${search}${buildPvbCategorySubpageHash(parent.key)}`,
        );
      } else {
        window.history.replaceState(
          null,
          "",
          `${pathname}${search}${buildPvbAreaSubpageHash(parent.name)}`,
        );
      }
      return;
    }
    closeAnalysisSubpage();
  }, [treatmentReturnRoute, closeAnalysisSubpage]);

  const openAreaSubpage = useCallback((name: string) => {
    setTreatmentReturnRoute(null);
    setAnalysisSubpage({ type: "area", name });
    const { pathname, search } = window.location;
    window.history.replaceState(
      null,
      "",
      `${pathname}${search}${buildPvbAreaSubpageHash(name)}`,
    );
  }, []);

  const jumpToTreatmentFromSubpage = useCallback(
    (anchorId: string) => {
      closeAnalysisSubpage();
      window.setTimeout(() => {
        scrollToSection(anchorId);
      }, 80);
    },
    [closeAnalysisSubpage, scrollToSection],
  );

  useEffect(() => {
    const sync = () => {
      if (!analysisDisplay?.overviewSnapshot) {
        setAnalysisSubpage(null);
        setTreatmentReturnRoute(null);
        return;
      }
      const parsed = parsePvbAnalysisSubpageHash(window.location.hash);
      if (!parsed) {
        setAnalysisSubpage(null);
        setTreatmentReturnRoute(null);
        return;
      }
      if (parsed.type === "treatment") {
        const row = analysisDisplay.planByTreatment.find(
          (r) => r.key === parsed.key,
        );
        setAnalysisSubpage(row ? parsed : null);
        return;
      }
      setTreatmentReturnRoute(null);
      if (parsed.type === "category") {
        const cat = analysisDisplay.overviewSnapshot.categories.find(
          (c) => c.key === parsed.key,
        );
        setAnalysisSubpage(cat ? parsed : null);
      } else {
        const ar = analysisDisplay.overviewSnapshot.areas.find(
          (a) => a.name === parsed.name,
        );
        setAnalysisSubpage(ar ? parsed : null);
      }
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [analysisDisplay]);

  useEffect(() => {
    if (!analysisSubpage) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (analysisSubpage.type === "treatment") {
        backFromTreatmentSubpage();
      } else {
        closeAnalysisSubpage();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [analysisSubpage, closeAnalysisSubpage, backFromTreatmentSubpage]);

  const handleBlueprintVideoPlay = useCallback(
    (videoId: string, moduleTitle: string) => {
      if (!blueprint || !blueprintAllowed) return;
      if (videoPlayTrackedRef.current.has(videoId)) return;
      videoPlayTrackedRef.current.add(videoId);
      trackPostVisitBlueprintEvent("video_played_module_X", {
        token: blueprint.token,
        module_name: moduleTitle,
        video_id: videoId,
        patient_id: blueprint.patient.id,
      });
    },
    [blueprint, blueprintAllowed],
  );

  const trackCaseGalleryOnce = useCallback(() => {
    if (!blueprint || !blueprintAllowed || caseGalleryTracked) return;
    setCaseGalleryTracked(true);
    trackPostVisitBlueprintEvent("case_gallery_viewed", {
      token: blueprint.token,
      patient_id: blueprint.patient.id,
    });
  }, [blueprint, blueprintAllowed, caseGalleryTracked]);

  const blueprintPatientAnalytics = useMemo(() => {
    if (!blueprint || !blueprintAllowed) return null;
    return { token: blueprint.token, patient_id: blueprint.patient.id };
  }, [blueprint, blueprintAllowed]);

  const analysisSubpageTrackKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!blueprintPatientAnalytics) return;
    if (!analysisSubpage) {
      analysisSubpageTrackKeyRef.current = null;
      return;
    }
    const subKey =
      analysisSubpage.type === "area"
        ? `area:${analysisSubpage.name}`
        : `${analysisSubpage.type}:${analysisSubpage.key}`;
    if (analysisSubpageTrackKeyRef.current === subKey) return;
    analysisSubpageTrackKeyRef.current = subKey;
    trackPostVisitBlueprintEvent("blueprint_analysis_subpage_viewed", {
      ...blueprintPatientAnalytics,
      subpage_type: analysisSubpage.type,
      subpage_key:
        analysisSubpage.type === "area"
          ? analysisSubpage.name
          : analysisSubpage.key,
    });
  }, [blueprintPatientAnalytics, analysisSubpage]);

  const openQuoteDrawer = useCallback(() => {
    if (!blueprint || !blueprintAllowed) return;
    setIsQuoteOpen(true);
    trackPostVisitBlueprintEvent("blueprint_quote_opened", {
      token: blueprint.token,
      patient_id: blueprint.patient.id,
    });
  }, [blueprint, blueprintAllowed]);

  const closeQuoteDrawer = useCallback(
    (reason: "overlay" | "handle" | "x") => {
      if (!blueprint || !blueprintAllowed) return;
      setIsQuoteOpen(false);
      trackPostVisitBlueprintEvent("blueprint_quote_closed", {
        token: blueprint.token,
        patient_id: blueprint.patient.id,
        close_reason: reason,
      });
    },
    [blueprint, blueprintAllowed],
  );

  const openCaseDetailForAnalytics = useCallback(
    (detail: CaseDetailPayload) => {
      if (blueprint && blueprintAllowed) {
        trackPostVisitBlueprintEvent("blueprint_case_detail_opened", {
          token: blueprint.token,
          patient_id: blueprint.patient.id,
          card_title: detail.cardTitle,
          treatment_label: detail.treatment,
        });
      }
      setSelectedCaseDetail(detail);
    },
    [blueprint, blueprintAllowed],
  );

  /* ── Guard ── */

  if (waitingForRemoteBlueprint) {
    return (
      <div className="pvb">
        <PvbBrandBar />
        <div className="pvb-error">
          <h1>Loading your blueprint…</h1>
          <p>Fetching your plan. This only takes a moment.</p>
        </div>
      </div>
    );
  }

  if (!blueprint) {
    /** Short URL (?t= only): no `d` in address bar. Private/incognito has no localStorage, so we must load from the server — if that fails, this message. */
    const usedTokenOnlyLink = Boolean(token && !inlinePayload);
    return (
      <div className="pvb">
        <PvbBrandBar />
        <div className="pvb-error">
          <h1>Blueprint unavailable</h1>
          {usedTokenOnlyLink ? (
            <p>
              This link uses a short code that loads your plan from our systems.{" "}
              <strong>Private / incognito windows</strong> don&apos;t keep a
              saved copy, so the page has to fetch it again — and we
              couldn&apos;t load it (the server may not have it yet, or it was
              cleared after a restart).
            </p>
          ) : (
            <p>
              This link is missing your plan data (for example, the message was
              shortened or the address was copied incompletely).
            </p>
          )}
          <p>
            <strong>Try:</strong> open the same link in a{" "}
            <strong>normal</strong> browser window, use the{" "}
            <strong>longer</strong> link from your text if you have one, or
            contact your clinic for a new blueprint.
          </p>
        </div>
      </div>
    );
  }

  if (!blueprintAllowed) {
    return (
      <div className="pvb">
        <PvbBrandBar
          providerCode={blueprint?.providerCode}
          providerName={blueprint?.providerName}
        />
        <div className="pvb-error">
          <h1>Blueprint unavailable</h1>
          <p>
            This experience is only available for patients of an authorized
            clinic (The Treatment Skin Boutique, Wellnest MD) or links sent from
            an authorized account.
          </p>
        </div>
      </div>
    );
  }

  /* ── Derived render data ── */

  const patientFirst = blueprint.patient.name.split(/\s+/)[0] || "there";
  const providerFirst =
    (blueprint.providerName ?? "").split(",")[0]?.trim() ||
    blueprint.providerName;

  const discussedHotspotLabels = dedupeBlueprintDisplayStrings(
    blueprint.discussedItems.flatMap((item) => {
      const out: string[] = [];
      if (item.region?.trim()) out.push(item.region.trim());
      if (item.findings?.length)
        out.push(...item.findings.map((f) => f.trim()).filter(Boolean));
      return out;
    }),
    8,
  );

  const mirrorTermsFromRecommender =
    blueprint.recommenderFocusRegions &&
    blueprint.recommenderFocusRegions.length > 0
      ? mapRecommenderRegionsToMirrorTerms(blueprint.recommenderFocusRegions)
      : [];
  const mirrorHighlightTerms =
    mirrorTermsFromRecommender.length > 0
      ? mirrorTermsFromRecommender
      : discussedHotspotLabels;

  const visibleHotspots =
    blueprint.recommenderFocusRegions &&
    blueprint.recommenderFocusRegions.length > 0
      ? dedupeBlueprintDisplayStrings(blueprint.recommenderFocusRegions, 8)
      : discussedHotspotLabels;

  const heroPills = visibleHotspots.slice(0, 8);

  const lineItems = blueprint.quote.lineItems;
  const { skincare: skincareQuoteIdxs, treatment: treatmentQuoteIdxs } =
    quotePartition;

  const toggledSkincareSub = skincareQuoteIdxs.reduce((sum, idx) => {
    if (!selectedRows[idx]) return sum;
    return sum + (lineItems[idx].price ?? 0);
  }, 0);
  const toggledTreatmentsSub = treatmentQuoteIdxs.reduce((sum, idx) => {
    if (!selectedRows[idx]) return sum;
    return sum + (lineItems[idx].price ?? 0);
  }, 0);
  const toggledTotal = toggledSkincareSub + toggledTreatmentsSub;
  const allowMintMembership = !isWellnestWellnessProviderCode(
    blueprint.providerCode,
  );
  const effectivePreviewMintMember = allowMintMembership
    ? previewMintMember
    : false;
  const showMintBreakdown = effectivePreviewMintMember && toggledTotal > 0;
  const mintDiscountAmount = showMintBreakdown ? toggledTotal * 0.1 : 0;
  const finalTotal = effectivePreviewMintMember
    ? toggledTotal * 0.9
    : toggledTotal;

  /* ── Render ── */

  return (
    <div className="pvb">
      <main className="pvb-shell" aria-label="Post Visit Blueprint">
        <PvbBrandBar
          providerCode={blueprint?.providerCode}
          providerName={blueprint?.providerName}
          onWellnestWebsiteClick={
            blueprintPatientAnalytics
              ? () =>
                  trackPostVisitBlueprintEvent(
                    "blueprint_brand_website_clicked",
                    {
                      ...blueprintPatientAnalytics,
                    },
                  )
              : undefined
          }
        />

        {/* ═══ 1. HERO: Mirror + Welcome ═══ */}
        <section className="pvb-hero">
          <div className="pvb-hero-mirror">
            {heroPhotoUrl ? (
              <AiMirrorCanvas
                imageUrl={heroPhotoUrl}
                alt="Your facial analysis"
                highlightTerms={mirrorHighlightTerms}
              />
            ) : (
              <div className="pvb-hero-mirror-placeholder">AI Analysis</div>
            )}
            <div className="pvb-hero-gradient" />
          </div>

          <div className="pvb-hero-welcome">
            <h1 className="pvb-hero-title">Hi {patientFirst}</h1>
            <p className="pvb-hero-subtitle">
              {providerFirst} put together this personalized treatment guide
              based on your visit. Scroll down to learn about each treatment,
              see real results, and watch short videos from your care team.
            </p>
          </div>

          {heroPills.length > 0 && (
            <div className="pvb-hero-pills">
              {heroPills.map((spot) => (
                <span key={spot} className="pvb-pill">
                  {spot}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* ═══ 2. OVERVIEW (assessment narrative + plan bridge) ═══ */}
        {analysisDisplay && (
          <section
            ref={overviewSectionRef}
            className={`pvb-analysis${overviewSectionInView ? " pvb-section--visible" : ""}`}
            id={PVB_ANALYSIS_SECTION_ID}
          >
            <div className="pvb-overview-heading-row">
              <div className="pvb-overview-heading-brand">
                <AiSparkleLogo
                  size={18}
                  className="pvb-ai-sparkle pvb-ai-sparkle-glow"
                />
                <h2
                  className="pvb-analysis-title pvb-aesthetic-intelligence-heading"
                  id="pvb-analysis-heading"
                >
                  Aesthetic Intelligence
                </h2>
                <GeminiWordmark />
              </div>
              <PvbNarrativeAudioControls
                text={mainOverviewSpeechText}
                ariaLabel="Listen to Aesthetic Intelligence"
                ariaLabelStop="Stop audio"
                analytics={
                  blueprintPatientAnalytics
                    ? { ...blueprintPatientAnalytics, scope: "main_overview" }
                    : undefined
                }
              />
            </div>
            <p className="pvb-analysis-lead">
              Your assessment and how the treatments in your plan connect to
              your visit.
            </p>
            <div
              className="pvb-overview-stack"
              role="region"
              aria-labelledby="pvb-analysis-heading"
            >
              <PvbOverviewSectionsSequentialTypewriter
                sections={mainOverviewSections}
                titleClassName="pvb-overview-section-title"
                paragraphClassName="pvb-overview-section-body"
                msPerChar={15}
              />

              {analysisDisplay.profileLabels.length > 0 && (
                <section className="pvb-overview-section">
                  <h3 className="pvb-overview-section-title">About you</h3>
                  <div
                    className="pvb-analysis-profile-strip"
                    aria-label="About you"
                  >
                    {analysisDisplay.profileLabels.map((row) => (
                      <span
                        key={row.label}
                        className="pvb-analysis-profile-chip"
                      >
                        <span className="pvb-analysis-profile-chip-label">
                          {row.label}
                        </span>
                        <span className="pvb-analysis-profile-chip-val">
                          {row.value}
                        </span>
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {(analysisDisplay.globalPlanInsights.interests.length > 0 ||
                analysisDisplay.globalPlanInsights.findings.length > 0) && (
                <section className="pvb-overview-section">
                  <h3 className="pvb-overview-section-title">
                    What came up in your visit
                  </h3>
                  <div className="pvb-analysis-panel pvb-analysis-global">
                    {analysisDisplay.globalPlanInsights.interests.length >
                      0 && (
                      <div className="pvb-analysis-global-group">
                        <span className="pvb-analysis-global-label">
                          Interests
                        </span>
                        <div className="pvb-analysis-plan-chips">
                          {analysisDisplay.globalPlanInsights.interests.map(
                            (t) => (
                              <span key={t} className="pvb-analysis-mini-chip">
                                {t}
                              </span>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                    {analysisDisplay.globalPlanInsights.findings.length > 0 && (
                      <div className="pvb-analysis-global-group">
                        <span className="pvb-analysis-global-label">
                          Observations
                        </span>
                        <div className="pvb-analysis-plan-chips">
                          {analysisDisplay.globalPlanInsights.findings.map(
                            (t) => (
                              <span
                                key={t}
                                className="pvb-analysis-mini-chip pvb-analysis-mini-chip--muted"
                              >
                                {t}
                              </span>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>
          </section>
        )}

        {/* ═══ 3. TABLE OF CONTENTS ═══ */}
        {chapters.length > 0 && (
          <section className="pvb-toc" id={PVB_TOC_ID}>
            <h2 className="pvb-toc-title">What we discussed</h2>
            <p className="pvb-toc-sub">
              {chapters.length}{" "}
              {chapters.length !== 1 ? "treatments" : "treatment"} in your plan
            </p>
            <ol className="pvb-toc-list">
              {chapters.map((c) => {
                const tocId = treatmentChapterAnchorId(c.key);
                const areaPills = splitChapterDisplayAreas(c.displayArea);
                return (
                  <li key={c.key} className="pvb-toc-item">
                    <a
                      className="pvb-toc-link"
                      href={`#${tocId}`}
                      onClick={(e) => {
                        e.preventDefault();
                        if (blueprintPatientAnalytics) {
                          trackPostVisitBlueprintEvent(
                            "blueprint_toc_navigated",
                            {
                              ...blueprintPatientAnalytics,
                              chapter_key: c.key,
                              chapter_display_name: c.displayName,
                            },
                          );
                        }
                        scrollToChapter(c.key);
                      }}
                    >
                      <span className="pvb-toc-item-name">{c.displayName}</span>
                      {areaPills.length > 0 ? (
                        <span
                          className="pvb-toc-item-area-pills"
                          role="list"
                          aria-label="Treatment areas"
                        >
                          {areaPills.map((a, i) => (
                            <span
                              key={`${a}-${i}`}
                              className="pvb-toc-area-pill"
                              role="listitem"
                            >
                              {a}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </a>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {/* ═══ 4. TREATMENT CHAPTERS ═══ */}
        <div className="pvb-chapters">
          {chapters.map((chapter, i) => (
            <TreatmentChapterView
              key={chapter.key}
              chapter={chapter}
              index={i}
              total={chapters.length}
              anchorId={treatmentChapterAnchorId(chapter.key)}
              chapterAnalysisContext={
                analysisDisplay
                  ? {
                      overviewSnapshot: analysisDisplay.overviewSnapshot,
                      planRow:
                        analysisDisplay.planByTreatment.find(
                          (r) => r.key === chapter.key,
                        ) ?? null,
                    }
                  : undefined
              }
              chapterGlossaryTerms={filterGlossaryTermsForChapter(
                planGlossaryTerms,
                chapter.key,
              )}
              onVideoPlay={handleBlueprintVideoPlay}
              onCaseDetail={openCaseDetailForAnalytics}
              trackCaseGallery={trackCaseGalleryOnce}
              blueprintPatientAnalytics={blueprintPatientAnalytics ?? undefined}
              chapterComplementContext={
                mainOverviewPlanShape
                  ? {
                      chapterIndex: i,
                      totalChapters: chapters.length,
                      allChapterDisplayNames: chapters.map(
                        (c) => c.displayName,
                      ),
                      planShape: mainOverviewPlanShape,
                      patientPriorities: chapterPatientPriorities,
                    }
                  : null
              }
            />
          ))}
        </div>

        {/* ═══ 5. CLOSING ═══ */}
        <section className="pvb-closing">
          <h2 className="pvb-closing-title">That&apos;s your plan</h2>
          <p className="pvb-closing-text">
            Questions? Tap below to view your personalized plan or book
            directly. You can also text {providerFirst} anytime.
          </p>
        </section>

        <div className="pvb-bottom-spacer" />
      </main>

      {/* ═══ ANALYSIS SUBPAGES (category / area detail — hash #analysis/...) ═══ */}
      {analysisSubpage && analysisDisplay?.overviewSnapshot
        ? (() => {
            if (analysisSubpage.type === "treatment") {
              const row = analysisDisplay.planByTreatment.find(
                (r) => r.key === analysisSubpage.key,
              );
              if (!row) return null;
              return (
                <PvbTreatmentPlanDetailSubpage
                  row={row}
                  casePhotos={casePhotoPool}
                  suggestionCards={patientSuggestionCards}
                  heroPhotoFallbackUrl={heroPhotoUrl}
                  onBack={backFromTreatmentSubpage}
                  onJumpToTreatment={jumpToTreatmentFromSubpage}
                  blueprintAnalyticsBase={
                    blueprintPatientAnalytics ?? undefined
                  }
                />
              );
            }
            if (analysisSubpage.type === "category") {
              const cat = analysisDisplay.overviewSnapshot.categories.find(
                (c) => c.key === analysisSubpage.key,
              );
              if (!cat) return null;
              return (
                <PvbCategoryDetailSubpage
                  cat={cat}
                  animate={overviewGaugeAnimate}
                  planRows={analysisDisplay.planByTreatment}
                  casePhotos={casePhotoPool}
                  detectedIssueLabels={
                    analysisDisplay.overviewSnapshot.detectedIssueLabels
                  }
                  onBack={closeAnalysisSubpage}
                  onOpenTreatmentDetails={(r) =>
                    openTreatmentPlanSubpage(r.key)
                  }
                  onOpenEyeAreaDetails={() => openAreaSubpage("Eyes")}
                  patientPhotoUrl={heroPhotoUrl}
                  blueprintAnalyticsBase={
                    blueprintPatientAnalytics ?? undefined
                  }
                />
              );
            }
            const ar = analysisDisplay.overviewSnapshot.areas.find(
              (a) => a.name === analysisSubpage.name,
            );
            if (!ar) return null;
            return (
              <PvbAreaDetailSubpage
                area={ar}
                animate={overviewGaugeAnimate}
                planRows={analysisDisplay.planByTreatment}
                casePhotos={casePhotoPool}
                detectedIssueLabels={
                  analysisDisplay.overviewSnapshot.detectedIssueLabels
                }
                onBack={closeAnalysisSubpage}
                onOpenTreatmentDetails={(r) => openTreatmentPlanSubpage(r.key)}
                patientPhotoUrl={heroPhotoUrl}
                blueprintAnalyticsBase={blueprintPatientAnalytics ?? undefined}
              />
            );
          })()
        : null}

      {/* ═══ STICKY BOTTOM BAR ═══ */}
      <div className="pvb-bar">
        <button
          className="pvb-bar-btn"
          onClick={openQuoteDrawer}
          aria-expanded={isQuoteOpen}
        >
          <span>View Plan &amp; Book</span>
          <span className="pvb-bar-price">{formatPrice(finalTotal)}</span>
        </button>
      </div>

      {/* ═══ QUOTE DRAWER ═══ */}
      <div
        className={`pvb-drawer-overlay${isQuoteOpen ? " is-open" : ""}`}
        onClick={() => closeQuoteDrawer("overlay")}
        aria-hidden={!isQuoteOpen}
      >
        <div
          className={`pvb-drawer${isQuoteOpen ? " is-open" : ""}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="pvb-drawer-handle"
            onClick={() => closeQuoteDrawer("handle")}
          />
          <div className="pvb-drawer-head">
            <h2>
              {quoteBookStep === "quote"
                ? "Your plan"
                : quoteBookStep === "booking_confirm"
                  ? "Confirm booking"
                  : "Booking request"}
            </h2>
            <button
              className="pvb-drawer-x"
              onClick={() => closeQuoteDrawer("x")}
            >
              &times;
            </button>
          </div>
          <div className="pvb-drawer-scroll">
            {quoteBookStep === "quote" ? (
              <>
                <p className="pvb-drawer-intro">
                  Select what you want to include, then proceed to send a
                  booking request to your provider&apos;s team.
                </p>
                <div className="pvb-quote">
                  {skincareQuoteIdxs.length > 0 ? (
                    <div className="pvb-quote-section">
                      <h3 className="pvb-quote-section-title">
                        Skincare products
                      </h3>
                      {skincareQuoteIdxs.map((idx) => {
                        const line = lineItems[idx];
                        return (
                          <label
                            key={`${line.skuName ?? line.label}-${idx}`}
                            className="pvb-quote-row"
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(selectedRows[idx])}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setSelectedRows((prev) => ({
                                  ...prev,
                                  [idx]: checked,
                                }));
                                trackPostVisitBlueprintEvent(
                                  "blueprint_quote_line_toggled",
                                  {
                                    token: blueprint.token,
                                    patient_id: blueprint.patient.id,
                                    line_index: idx,
                                    line_category: "skincare",
                                    included: checked,
                                    label: (line.skuName ?? line.label).slice(
                                      0,
                                      200,
                                    ),
                                  },
                                );
                              }}
                            />
                            <span>
                              {patientFacingSkincareShortName(
                                line.skuName ?? line.label,
                              )}
                            </span>
                            <strong>{formatPrice(line.price ?? 0)}</strong>
                          </label>
                        );
                      })}
                      <div className="pvb-quote-subtotal">
                        <span>Skincare subtotal</span>
                        <strong>{formatPrice(toggledSkincareSub)}</strong>
                      </div>
                    </div>
                  ) : null}

                  {treatmentQuoteIdxs.length > 0 ? (
                    <div className="pvb-quote-section">
                      <h3 className="pvb-quote-section-title">Treatments</h3>
                      {treatmentQuoteIdxs.map((idx) => {
                        const line = lineItems[idx];
                        return (
                          <label
                            key={`${line.skuName ?? line.label}-${idx}`}
                            className="pvb-quote-row"
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(selectedRows[idx])}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setSelectedRows((prev) => ({
                                  ...prev,
                                  [idx]: checked,
                                }));
                                trackPostVisitBlueprintEvent(
                                  "blueprint_quote_line_toggled",
                                  {
                                    token: blueprint.token,
                                    patient_id: blueprint.patient.id,
                                    line_index: idx,
                                    line_category: "treatment",
                                    included: checked,
                                    label: (line.skuName ?? line.label).slice(
                                      0,
                                      200,
                                    ),
                                  },
                                );
                              }}
                            />
                            <span>{line.skuName ?? line.label}</span>
                            <strong>{formatPrice(line.price ?? 0)}</strong>
                          </label>
                        );
                      })}
                      <div className="pvb-quote-subtotal">
                        <span>Treatments subtotal</span>
                        <strong>{formatPrice(toggledTreatmentsSub)}</strong>
                      </div>
                    </div>
                  ) : null}

                  {allowMintMembership ? (
                    <div className="pvb-quote-mint-toggle-wrap">
                      <label className="pvb-quote-mint-toggle">
                        <input
                          type="checkbox"
                          checked={effectivePreviewMintMember}
                          disabled={toggledTotal <= 0}
                          onChange={(e) => {
                            const on = e.target.checked;
                            setPreviewMintMember(on);
                            trackPostVisitBlueprintEvent(
                              "blueprint_mint_preview_toggled",
                              {
                                token: blueprint.token,
                                patient_id: blueprint.patient.id,
                                mint_preview_enabled: on,
                              },
                            );
                          }}
                        />
                        <span className="pvb-quote-mint-toggle-label">
                          <span className="pvb-quote-mint-toggle-main">
                            Mint Member Pricing (10% off)
                          </span>
                          <MintMembershipInfoTrigger
                            zIndex={120}
                            onInfoOpen={() =>
                              trackPostVisitBlueprintEvent(
                                "blueprint_mint_info_opened",
                                {
                                  token: blueprint.token,
                                  patient_id: blueprint.patient.id,
                                },
                              )
                            }
                          />
                        </span>
                      </label>
                      {/* <p className="pvb-quote-mint-hint">
                        Mint members get 10% off services and skincare. Check
                        this box to see your discounted total—whether
                        you&apos;re already a member or considering joining.
                      </p> */}
                    </div>
                  ) : null}

                  <div className="pvb-quote-footer-totals">
                    {showMintBreakdown ? (
                      <>
                        <div className="pvb-quote-summary-row">
                          <span>Subtotal</span>
                          <strong>{formatPrice(toggledTotal)}</strong>
                        </div>
                        <div className="pvb-quote-mint-line">
                          <span>Mint member 10% off</span>
                          <strong>−{formatPrice(mintDiscountAmount)}</strong>
                        </div>
                      </>
                    ) : null}
                    <div className="pvb-quote-total">
                      <span>
                        {showMintBreakdown ? "Total with Mint" : "Total"}
                      </span>
                      <strong>{formatPrice(finalTotal)}</strong>
                    </div>
                  </div>
                </div>
                {bookingIntentError ? (
                  <p className="pvb-booking-intent-error" role="alert">
                    {bookingIntentError}
                  </p>
                ) : null}
                <div className="pvb-drawer-ctas">
                  <button
                    type="button"
                    className="pvb-cta pvb-cta--book"
                    disabled={bookingIntentSubmitting}
                    onClick={() => {
                      setBookingIntentError(null);
                      const selectedLineIndices = Object.entries(selectedRows)
                        .filter(([, on]) => on)
                        .map(([k]) => Number(k))
                        .filter((n) => Number.isInteger(n) && n >= 0)
                        .sort((a, b) => a - b);
                      if (selectedLineIndices.length === 0) {
                        setBookingIntentError(
                          "Select at least one item to include in your booking request.",
                        );
                        return;
                      }
                      trackPostVisitBlueprintEvent(
                        "blueprint_booking_confirm_viewed",
                        {
                          token: blueprint.token,
                          patient_id: blueprint.patient.id,
                        },
                      );
                      setQuoteBookStep("booking_confirm");
                    }}
                  >
                    Proceed to book
                  </button>
                  {blueprint.cta.textProviderPhone ? (
                    <div className="pvb-drawer-ctas-row">
                      <a
                        className="pvb-cta pvb-cta--ghost"
                        href={`sms:${blueprint.cta.textProviderPhone}`}
                        onClick={() =>
                          trackPostVisitBlueprintEvent(
                            "blueprint_text_provider_clicked",
                            {
                              token: blueprint.token,
                              patient_id: blueprint.patient.id,
                              source: "quote_drawer",
                            },
                          )
                        }
                      >
                        Text provider
                      </a>
                    </div>
                  ) : null}
                </div>
              </>
            ) : quoteBookStep === "booking_confirm" ? (
              <div className="pvb-drawer-book-confirm">
                <p className="pvb-drawer-intro pvb-drawer-book-confirm-lead">
                  You&rsquo;re about to send a booking request for{" "}
                  <strong>
                    {Object.values(selectedRows).filter(Boolean).length}
                  </strong>{" "}
                  {Object.values(selectedRows).filter(Boolean).length === 1
                    ? "item"
                    : "items"}{" "}
                  (
                  <strong>{formatPrice(finalTotal)}</strong>
                  {showMintBreakdown ? " with Mint pricing" : ""}
                  ). Your provider&rsquo;s office will follow up to schedule.
                </p>
                {bookingIntentError ? (
                  <p className="pvb-booking-intent-error" role="alert">
                    {bookingIntentError}
                  </p>
                ) : null}
                <div className="pvb-drawer-book-confirm-actions">
                  <button
                    type="button"
                    className="pvb-cta pvb-cta--ghost"
                    disabled={bookingIntentSubmitting}
                    onClick={() => {
                      trackPostVisitBlueprintEvent(
                        "blueprint_booking_back_to_quote",
                        {
                          token: blueprint.token,
                          patient_id: blueprint.patient.id,
                        },
                      );
                      setBookingIntentError(null);
                      setQuoteBookStep("quote");
                    }}
                  >
                    Back to quote
                  </button>
                  <button
                    type="button"
                    className="pvb-cta pvb-cta--book"
                    disabled={bookingIntentSubmitting}
                    onClick={() => {
                      void (async () => {
                        setBookingIntentError(null);
                        const selectedLineIndices = Object.entries(selectedRows)
                          .filter(([, on]) => on)
                          .map(([k]) => Number(k))
                          .filter((n) => Number.isInteger(n) && n >= 0)
                          .sort((a, b) => a - b);
                        const mintPreview = effectivePreviewMintMember;
                        setBookingIntentSubmitting(true);
                        const result =
                          await submitPostVisitBlueprintBookingIntent({
                            token: blueprint.token,
                            patientId: blueprint.patient.id,
                            selectedLineIndices,
                            mintPreview,
                          });
                        setBookingIntentSubmitting(false);
                        if (!result.ok) {
                          setBookingIntentError(
                            result.details
                              ? `${result.error} ${result.details.slice(0, 280)}`
                              : result.error,
                          );
                          return;
                        }
                        trackPostVisitBlueprintEvent("booking_clicked", {
                          token: blueprint.token,
                          patient_id: blueprint.patient.id,
                        });
                        setQuoteBookStep("booking_sent");
                      })();
                    }}
                  >
                    {bookingIntentSubmitting
                      ? "Sending…"
                      : "Send booking request"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="pvb-drawer-book-confirm">
                <h3 className="pvb-drawer-book-confirm-title">
                  You&rsquo;re all set
                </h3>
                <p className="pvb-drawer-book-confirm-text">
                  We&rsquo;ll reach out to{" "}
                  {providerFirst ? (
                    <>{providerFirst}&rsquo;s team</>
                  ) : (
                    "your provider team"
                  )}{" "}
                  with this booking request. Someone from the office will
                  connect with you shortly to help you schedule.
                </p>
                <div className="pvb-drawer-book-confirm-actions">
                  <button
                    type="button"
                    className="pvb-cta pvb-cta--ghost"
                    onClick={() => {
                      trackPostVisitBlueprintEvent(
                        "blueprint_booking_back_to_quote",
                        {
                          token: blueprint.token,
                          patient_id: blueprint.patient.id,
                        },
                      );
                      setQuoteBookStep("quote");
                    }}
                  >
                    Back to quote
                  </button>
                  <button
                    type="button"
                    className="pvb-cta pvb-cta--book"
                    onClick={() => {
                      trackPostVisitBlueprintEvent("blueprint_booking_done", {
                        token: blueprint.token,
                        patient_id: blueprint.patient.id,
                      });
                      setIsQuoteOpen(false);
                    }}
                  >
                    Done
                  </button>
                  {blueprint.cta.textProviderPhone ? (
                    <a
                      className="pvb-cta pvb-cta--ghost"
                      href={`sms:${blueprint.cta.textProviderPhone}`}
                      onClick={() =>
                        trackPostVisitBlueprintEvent(
                          "blueprint_text_provider_clicked",
                          {
                            token: blueprint.token,
                            patient_id: blueprint.patient.id,
                            source: "booking_confirm",
                          },
                        )
                      }
                    >
                      Text provider
                    </a>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ CASE DETAIL (app-style sheet) ═══ */}
      {selectedCaseDetail && (
        <div
          className="pvb-case-overlay"
          onClick={() => setSelectedCaseDetail(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Case details"
        >
          <div className="pvb-case-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="pvb-case-grab" aria-hidden="true" />
            <header className="pvb-case-top">
              <button
                type="button"
                className="pvb-case-close"
                onClick={() => setSelectedCaseDetail(null)}
                aria-label="Close"
              >
                <span aria-hidden>←</span> Back
              </button>
              <span className="pvb-case-eyebrow">Case story</span>
              <h2 className="pvb-case-title">{selectedCaseDetail.cardTitle}</h2>
              <p className="pvb-case-cat">{selectedCaseDetail.treatment}</p>
            </header>

            <div className="pvb-case-scroll">
              <div className="pvb-case-photo-frame">
                <img
                  src={selectedCaseDetail.photoUrl}
                  alt={`Before and after: ${selectedCaseDetail.cardTitle}`}
                  className="pvb-case-photo"
                />
              </div>

              {(selectedCaseDetail.longevity ||
                selectedCaseDetail.downtime ||
                selectedCaseDetail.priceRange) && (
                <div className="pvb-case-facts">
                  {selectedCaseDetail.longevity ? (
                    <div className="pvb-case-fact">
                      <span className="pvb-case-fact-label">Lasts</span>
                      <span className="pvb-case-fact-val">
                        {selectedCaseDetail.longevity}
                      </span>
                    </div>
                  ) : null}
                  {selectedCaseDetail.downtime ? (
                    <div className="pvb-case-fact">
                      <span className="pvb-case-fact-label">Downtime</span>
                      <span className="pvb-case-fact-val">
                        {selectedCaseDetail.downtime}
                      </span>
                    </div>
                  ) : null}
                  {selectedCaseDetail.priceRange ? (
                    <div className="pvb-case-fact">
                      <span className="pvb-case-fact-label">Typical range</span>
                      <span className="pvb-case-fact-val">
                        {selectedCaseDetail.priceRange}
                      </span>
                    </div>
                  ) : null}
                </div>
              )}

              {selectedCaseDetail.demographics ? (
                <p className="pvb-case-demo">
                  {selectedCaseDetail.demographics}
                </p>
              ) : null}

              {selectedCaseDetail.story ||
              selectedCaseDetail.caption ||
              selectedCaseDetail.storyDetailed ? (
                <section className="pvb-case-block">
                  <h3 className="pvb-case-block-title">About this case</h3>
                  {selectedCaseDetail.story ? (
                    <p className="pvb-case-prose pvb-case-prose--headline">
                      {selectedCaseDetail.story}
                    </p>
                  ) : null}
                  {selectedCaseDetail.caption ? (
                    <p className="pvb-case-prose">
                      {selectedCaseDetail.caption}
                    </p>
                  ) : null}
                  {selectedCaseDetail.storyDetailed ? (
                    <p className="pvb-case-prose pvb-case-prose--detailed">
                      {selectedCaseDetail.storyDetailed}
                    </p>
                  ) : null}
                </section>
              ) : null}

              {selectedCaseDetail.tags ? (
                <section className="pvb-case-block">
                  <h3 className="pvb-case-block-title">Tags</h3>
                  <p className="pvb-case-tags-line">
                    {selectedCaseDetail.tags}
                  </p>
                </section>
              ) : null}

              {selectedCaseDetail.highlights.length > 0 ? (
                <section className="pvb-case-block">
                  <h3 className="pvb-case-block-title">From your plan</h3>
                  <div className="pvb-chips pvb-chips--case">
                    {selectedCaseDetail.highlights.map((h) => (
                      <span key={h} className="pvb-chip">
                        {h}
                      </span>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>

            <div className="pvb-case-footer">
              <button
                type="button"
                className="pvb-case-done"
                onClick={() => setSelectedCaseDetail(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
