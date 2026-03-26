import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchBlueprintFrontPhotoFreshUrl,
  fetchPatientRecords,
  fetchPostVisitBlueprintFromServer,
  fetchTreatmentPhotos,
  parsePatientRecordsToCards,
  type AirtableRecord,
  type PatientSuggestionCard,
} from "../../services/api";
import { formatPrice } from "../../data/treatmentPricing2025";
import {
  getPostVisitBlueprintFromUrlData,
  getStoredPostVisitBlueprint,
  hasStableHeroPhotoSource,
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
  isPostVisitBlueprintAllowedForPatient,
  THE_TREATMENT_BOOKING_URL,
} from "../../utils/providerHelpers";
import { isWellnestWellnessProviderCode } from "../../data/wellnestOfferings";
import { buildWellnestBlueprintCasePhotos } from "../../utils/wellnestBlueprintCases";
import { AiMirrorCanvas } from "../postVisitBlueprint/AiMirrorCanvas";
import { PvbNarrativeAudioControls } from "../postVisitBlueprint/PvbNarrativeAudioControls";
import { PvbTypewriterParagraphs } from "../postVisitBlueprint/PvbTypewriterParagraphs";
import { TreatmentChapterView } from "../postVisitBlueprint/TreatmentChapter";
import { getPostVisitBlueprintVideoCatalog } from "../../config/postVisitBlueprintVideos";
import { buildTreatmentChapters } from "../../utils/blueprintTreatmentChapters";
import {
  getBlueprintAnalysisDisplay,
  normalizeBlueprintAnalysisText,
  PVB_ANALYSIS_SECTION_ID,
  treatmentChapterAnchorId,
} from "../../utils/postVisitBlueprintAnalysis";
import { buildPvbPlanBridgeParagraph } from "../../utils/pvbOverviewNarratives";
import {
  buildPvbMainOverviewSpeechText,
  buildPvbMainOverviewTypewriterParagraphs,
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
import { CheckoutFinancingSection } from "../modals/DiscussedTreatmentsModal/CheckoutFinancingSection";
import { partitionQuoteLineIndices } from "../../utils/pvbQuotePartition";
import { patientFacingSkincareShortName } from "../../utils/pvbSkincareDisplay";
import "./PostVisitBlueprintPage.css";

/** The Treatment Skin Boutique — patient-facing blueprint branding */
const THE_TREATMENT_BRAND_LOGO_SRC =
  "/post-visit-blueprint/videos/The%20Treatment%20Mint%20and%20Gray.png";
const WELLNEST_BRAND_LOGO_SRC =
  "https://wellnestmd.com/wp-content/uploads/2024/12/nav-logo-5.svg";
const WELLNEST_MARKETING_SITE_URL = "https://wellnestmd.com/";

function PvbBrandBar({ providerCode }: { providerCode?: string | null }) {
  const isWellnest = isWellnestWellnessProviderCode(providerCode);
  const brandLogoSrc = isWellnest
    ? WELLNEST_BRAND_LOGO_SRC
    : THE_TREATMENT_BRAND_LOGO_SRC;
  const brandLabel = isWellnest ? "Wellnest MD" : "The Treatment Skin Boutique";
  return (
    <header className="pvb-brand-bar" aria-label={brandLabel}>
      <img
        src={brandLogoSrc}
        alt={brandLabel}
        className="pvb-brand-logo"
        width={220}
        height={72}
        decoding="async"
      />
      {isWellnest && (
        <a
          href={WELLNEST_MARKETING_SITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="pvb-brand-exit-link"
          aria-label="Visit Wellnest MD website (opens in a new tab)"
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
  if (raw.includes("non-surgical") || raw.includes("non surgical"))
    return true;
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
  const shouldFetchRemoteBlueprint = !inlinePayload && !!token && !storedPayload;

  const [remoteBlueprint, setRemoteBlueprint] =
    useState<PostVisitBlueprintPayload | null>(null);
  const [remoteBlueprintResolved, setRemoteBlueprintResolved] = useState(
    !shouldFetchRemoteBlueprint,
  );

  useEffect(() => {
    if (!shouldFetchRemoteBlueprint || !token) return;
    let cancelled = false;
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

  const blueprint = inlinePayload ?? storedPayload ?? remoteBlueprint;
  const waitingForRemoteBlueprint =
    shouldFetchRemoteBlueprint && !remoteBlueprintResolved;

  /** Keep a local copy so repeat visits work with `?t=` only (same browser) after the full link was opened once. */
  useEffect(() => {
    const fromUrl = getPostVisitBlueprintFromUrlData();
    if (fromUrl) persistPostVisitBlueprint(fromUrl, { urlToken: token });
  }, [token]);

  const blueprintAllowed = useMemo(
    () => Boolean(blueprint && isPostVisitBlueprintAllowedForPatient(blueprint)),
    [blueprint],
  );

  const [selectedRows, setSelectedRows] = useState<Record<number, boolean>>({});
  const [photoPool, setPhotoPool] = useState<BlueprintCasePhoto[]>([]);
  const [patientSuggestionCards, setPatientSuggestionCards] = useState<PatientSuggestionCard[]>([]);
  const [selectedCaseDetail, setSelectedCaseDetail] =
    useState<CaseDetailPayload | null>(null);
  const [caseGalleryTracked, setCaseGalleryTracked] = useState(false);
  const videoPlayTrackedRef = useRef<Set<string>>(new Set());
  const [isQuoteOpen, setIsQuoteOpen] = useState(false);
  /** Patient can preview Mint member 10% off (defaults from plan at send time). */
  const [previewMintMember, setPreviewMintMember] = useState(false);
  /** Hero / AI Mirror image: embedded data URL, fresh API URL, or stale Airtable URL. */
  const [heroPhotoUrl, setHeroPhotoUrl] = useState<string | null>(null);
  const [overviewGaugeAnimate, setOverviewGaugeAnimate] = useState(false);
  const [analysisSubpage, setAnalysisSubpage] = useState<PvbAnalysisSubpageRoute | null>(
    null,
  );
  /** When opening treatment detail from category/area, Back returns to that screen. */
  const [treatmentReturnRoute, setTreatmentReturnRoute] = useState<
    Extract<PvbAnalysisSubpageRoute, { type: "category" } | { type: "area" }> | null
  >(null);

  useEffect(() => {
    const t = window.setTimeout(() => setOverviewGaugeAnimate(true), 380);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!blueprint) {
      setHeroPhotoUrl(null);
      return;
    }
    const resolved = resolveHeroPhotoDisplayUrl(blueprint.patient, {
      blueprintToken: blueprint.token,
    });
    setHeroPhotoUrl(resolved);
    if (hasStableHeroPhotoSource(blueprint.patient, blueprint.token)) {
      return;
    }
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
    if (!isWellnestWellnessProviderCode(blueprint.providerCode)) return photoPool;
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
  }, [blueprint, blueprintAllowed, treatmentResultCards, blueprintVideoCatalog]);

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

  const mainOverviewTwParagraphs = useMemo(() => {
    if (!analysisDisplay) return [];
    return buildPvbMainOverviewTypewriterParagraphs(
      analysisDisplay,
      overviewBridgeParagraph,
    );
  }, [analysisDisplay, overviewBridgeParagraph]);

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
    return getResolvedPlanGlossaryTerms(
      blueprint.discussedItems,
      blueprint.quote.lineItems,
      overviewSnippets,
    );
  }, [blueprint, blueprintAllowed, analysisDisplay, overviewBridgeParagraph]);

  const mainOverviewSpeechText = useMemo(() => {
    if (!analysisDisplay) return "";
    return buildPvbMainOverviewSpeechText(analysisDisplay, overviewBridgeParagraph);
  }, [analysisDisplay, overviewBridgeParagraph]);

  const quotePartition = useMemo(() => {
    if (!blueprint || !blueprintAllowed) {
      return { skincare: [] as number[], treatment: [] as number[] };
    }
    return partitionQuoteLineIndices(blueprint.quote.lineItems, blueprint.discussedItems);
  }, [blueprint, blueprintAllowed]);

  /** Open link with #fragment → scroll to chapter after load */
  useEffect(() => {
    if (chapters.length === 0) return;
    const hash = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    if (!hash) return;
    const el = document.getElementById(hash);
    if (!el) return;
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    return () => window.clearTimeout(t);
  }, [chapters]);

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
      if (analysisSubpage?.type === "category" || analysisSubpage?.type === "area") {
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
        const row = analysisDisplay.planByTreatment.find((r) => r.key === parsed.key);
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
              <strong>Private / incognito windows</strong> don&apos;t keep a saved copy, so the page has to
              fetch it again — and we couldn&apos;t load it (the server may not have it yet, or it was cleared
              after a restart).
            </p>
          ) : (
            <p>
              This link is missing your plan data (for example, the message was shortened or the address was
              copied incompletely).
            </p>
          )}
          <p>
            <strong>Try:</strong> open the same link in a <strong>normal</strong> browser window, use the{" "}
            <strong>longer</strong> link from your text if you have one, or contact your clinic for a new
            blueprint.
          </p>
        </div>
      </div>
    );
  }

  if (!blueprintAllowed) {
    return (
      <div className="pvb">
        <PvbBrandBar providerCode={blueprint?.providerCode} />
        <div className="pvb-error">
          <h1>Blueprint unavailable</h1>
          <p>
            This experience is only available for patients of an authorized clinic
            (The Treatment Skin Boutique, Wellnest MD) or links sent from an authorized
            account.
          </p>
        </div>
      </div>
    );
  }

  /* ── Derived render data ── */

  const bookingHref =
    blueprint.cta.bookingUrl?.trim() ||
    (isWellnestWellnessProviderCode(blueprint.providerCode)
      ? ""
      : THE_TREATMENT_BOOKING_URL);
  const patientFirst = blueprint.patient.name.split(/\s+/)[0] || "there";
  const providerFirst = (blueprint.providerName ?? "").split(",")[0]?.trim() || blueprint.providerName;

  const discussedHotspotLabels = Array.from(
    new Set(
      blueprint.discussedItems
        .flatMap((item) => {
          const out: string[] = [];
          if (item.region?.trim())
            out.push(normalizeBlueprintAnalysisText(item.region.trim()));
          if (item.findings?.length)
            out.push(
              ...item.findings.map((f) => normalizeBlueprintAnalysisText(f.trim())),
            );
          return out;
        })
        .filter(Boolean),
    ),
  ).slice(0, 8);

  const mirrorTermsFromRecommender =
    blueprint.recommenderFocusRegions && blueprint.recommenderFocusRegions.length > 0
      ? mapRecommenderRegionsToMirrorTerms(blueprint.recommenderFocusRegions)
      : [];
  const mirrorHighlightTerms =
    mirrorTermsFromRecommender.length > 0 ? mirrorTermsFromRecommender : discussedHotspotLabels;

  const visibleHotspots =
    blueprint.recommenderFocusRegions && blueprint.recommenderFocusRegions.length > 0
      ? blueprint.recommenderFocusRegions.slice(0, 8)
      : discussedHotspotLabels;

  const concernPills = Array.from(
    new Set([
      ...(analysisDisplay?.overviewSnapshot?.detectedIssueLabels ?? []),
      ...(analysisDisplay?.globalPlanInsights?.findings ?? []),
      ...blueprint.discussedItems.flatMap((item) => [
        ...(item.findings ?? []),
        item.interest ?? "",
      ]),
    ]),
  )
    .map((v) => normalizeBlueprintAnalysisText(String(v).trim()))
    .filter(Boolean)
    .slice(0, 8);

  const heroPills = Array.from(new Set([...visibleHotspots, ...concernPills])).slice(
    0,
    12,
  );

  const lineItems = blueprint.quote.lineItems;
  const { skincare: skincareQuoteIdxs, treatment: treatmentQuoteIdxs } = quotePartition;

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

  /** Treatments share of total after Mint discount — used only for financing examples */
  const treatmentFinancingAmount =
    toggledTotal > 0 && toggledTreatmentsSub > 0
      ? (toggledTreatmentsSub / toggledTotal) * finalTotal
      : 0;

  const hasUnknownTreatmentPrices = treatmentQuoteIdxs.some(
    (idx) =>
      lineItems[idx].isEstimate ||
      lineItems[idx].displayPrice === "Price varies",
  );

  const showTreatmentFinancingBlock = treatmentQuoteIdxs.length > 0;

  /* ── Render ── */

  return (
    <div className="pvb">
      <main className="pvb-shell" aria-label="Post Visit Blueprint">
        <PvbBrandBar providerCode={blueprint?.providerCode} />

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
              {providerFirst} put together this personalized treatment guide based
              on your visit. Scroll down to learn about each treatment, see real
              results, and watch short videos from your care team.
            </p>
          </div>

          {heroPills.length > 0 && (
            <div className="pvb-hero-pills">
              {heroPills.map((spot) => (
                <span key={spot} className="pvb-pill">{spot}</span>
              ))}
            </div>
          )}
        </section>

        {/* ═══ 2. OVERVIEW (assessment narrative + plan bridge) ═══ */}
        {analysisDisplay && (
          <section className="pvb-analysis" id={PVB_ANALYSIS_SECTION_ID}>
            <div className="pvb-overview-heading-row">
              <div className="pvb-overview-heading-brand">
                <AiSparkleLogo size={18} className="pvb-ai-sparkle" />
                <h2 className="pvb-analysis-title" id="pvb-analysis-heading">
                  Overview
                </h2>
                <GeminiWordmark />
              </div>
              <PvbNarrativeAudioControls
                text={mainOverviewSpeechText}
                ariaLabel="Listen to overview"
              />
            </div>
            <p className="pvb-analysis-lead">
              Your assessment and how the treatments in your plan connect to your visit.
            </p>
            <div className="pvb-overview-stack" role="region" aria-labelledby="pvb-analysis-heading">
              {mainOverviewTwParagraphs.length > 0 ? (
                <div className="pvb-ai-hero">
                  <div className="pvb-ai-hero__narrative">
                    <PvbTypewriterParagraphs
                      paragraphs={mainOverviewTwParagraphs}
                      paragraphClassName="pvb-ai-hero__para"
                      msPerChar={15}
                    />
                  </div>
                </div>
              ) : null}

              {analysisDisplay.profileLabels.length > 0 && (
                <div className="pvb-overview-meta">
                  <h3 className="pvb-overview-meta-title">Your profile</h3>
                  <div className="pvb-analysis-profile-strip" aria-label="Your profile">
                    {analysisDisplay.profileLabels.map((row) => (
                      <span key={row.label} className="pvb-analysis-profile-chip">
                        <span className="pvb-analysis-profile-chip-label">{row.label}</span>
                        <span className="pvb-analysis-profile-chip-val">{row.value}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {analysisDisplay.goals.length > 0 && (
                <div className="pvb-overview-meta">
                  <h3 className="pvb-overview-meta-title">Your focus</h3>
                  <div className="pvb-analysis-goal-chips" aria-label="Your focus">
                    {analysisDisplay.goals.map((g) => (
                      <span key={g} className="pvb-analysis-goal-chip">
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(analysisDisplay.globalPlanInsights.interests.length > 0 ||
                analysisDisplay.globalPlanInsights.findings.length > 0) && (
                <div className="pvb-overview-meta">
                  <div className="pvb-analysis-panel pvb-analysis-global">
                    {analysisDisplay.globalPlanInsights.interests.length > 0 && (
                      <div className="pvb-analysis-global-group">
                        <span className="pvb-analysis-global-label">Interests</span>
                        <div className="pvb-analysis-plan-chips">
                          {analysisDisplay.globalPlanInsights.interests.map((t) => (
                            <span key={t} className="pvb-analysis-mini-chip">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {analysisDisplay.globalPlanInsights.findings.length > 0 && (
                      <div className="pvb-analysis-global-group">
                        <span className="pvb-analysis-global-label">Observations</span>
                        <div className="pvb-analysis-plan-chips">
                          {analysisDisplay.globalPlanInsights.findings.map((t) => (
                            <span
                              key={t}
                              className="pvb-analysis-mini-chip pvb-analysis-mini-chip--muted"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ═══ 3. TABLE OF CONTENTS ═══ */}
        {chapters.length > 0 && (
          <section className="pvb-toc" id={PVB_TOC_ID}>
            <h2 className="pvb-toc-title">What we discussed</h2>
            <p className="pvb-toc-sub">
              {analysisDisplay ? "Overview, then " : ""}
              {chapters.length} {chapters.length !== 1 ? "treatments" : "treatment"} in your plan
            </p>
            <ol className="pvb-toc-list">
              {analysisDisplay && (
                <li className="pvb-toc-item">
                  <a
                    className="pvb-toc-link"
                    href={`#${PVB_ANALYSIS_SECTION_ID}`}
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToSection(PVB_ANALYSIS_SECTION_ID);
                    }}
                  >
                    <span className="pvb-toc-item-name">Overview</span>
                  </a>
                </li>
              )}
              {chapters.map((c) => {
                const tocId = treatmentChapterAnchorId(c.key);
                return (
                  <li key={c.key} className="pvb-toc-item">
                    <a
                      className="pvb-toc-link"
                      href={`#${tocId}`}
                      onClick={(e) => {
                        e.preventDefault();
                        scrollToChapter(c.key);
                      }}
                    >
                      <span className="pvb-toc-item-name">{c.displayName}</span>
                      {c.displayArea && (
                        <span className="pvb-toc-item-area">{c.displayArea}</span>
                      )}
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
              onCaseDetail={setSelectedCaseDetail}
              trackCaseGallery={trackCaseGalleryOnce}
            />
          ))}
        </div>

        {/* ═══ 5. CLOSING ═══ */}
        <section className="pvb-closing">
          <h2 className="pvb-closing-title">That&apos;s your plan</h2>
          <p className="pvb-closing-text">
            Questions? Tap below to view your personalized quote, check financing,
            or book directly. You can also text {providerFirst} anytime.
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
                  detectedIssueLabels={analysisDisplay.overviewSnapshot.detectedIssueLabels}
                  onBack={closeAnalysisSubpage}
                  onOpenTreatmentDetails={(r) => openTreatmentPlanSubpage(r.key)}
                  onOpenEyeAreaDetails={() => openAreaSubpage("Eyes")}
                  patientPhotoUrl={heroPhotoUrl}
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
                detectedIssueLabels={analysisDisplay.overviewSnapshot.detectedIssueLabels}
                onBack={closeAnalysisSubpage}
                onOpenTreatmentDetails={(r) => openTreatmentPlanSubpage(r.key)}
                patientPhotoUrl={heroPhotoUrl}
              />
            );
          })()
        : null}

      {/* ═══ STICKY BOTTOM BAR ═══ */}
      <div className="pvb-bar">
        <button className="pvb-bar-btn" onClick={() => setIsQuoteOpen(true)} aria-expanded={isQuoteOpen}>
          <span>View Quote &amp; Book</span>
          <span className="pvb-bar-price">{formatPrice(finalTotal)}</span>
        </button>
      </div>

      {/* ═══ QUOTE DRAWER ═══ */}
      <div
        className={`pvb-drawer-overlay${isQuoteOpen ? " is-open" : ""}`}
        onClick={() => setIsQuoteOpen(false)}
        aria-hidden={!isQuoteOpen}
      >
        <div className={`pvb-drawer${isQuoteOpen ? " is-open" : ""}`} onClick={(e) => e.stopPropagation()}>
          <div className="pvb-drawer-handle" onClick={() => setIsQuoteOpen(false)} />
          <div className="pvb-drawer-head">
            <h2>Your quote</h2>
            <button className="pvb-drawer-x" onClick={() => setIsQuoteOpen(false)}>&times;</button>
          </div>
          <div className="pvb-drawer-scroll">
            <p className="pvb-drawer-intro">
              Toggle skincare products and treatments on or off to update the total.
            </p>
            <div className="pvb-quote">
              {skincareQuoteIdxs.length > 0 ? (
                <div className="pvb-quote-section">
                  <h3 className="pvb-quote-section-title">Skincare products</h3>
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
                          onChange={(e) =>
                            setSelectedRows((prev) => ({
                              ...prev,
                              [idx]: e.target.checked,
                            }))
                          }
                        />
                        <span>
                          {patientFacingSkincareShortName(line.skuName ?? line.label)}
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
                          onChange={(e) =>
                            setSelectedRows((prev) => ({
                              ...prev,
                              [idx]: e.target.checked,
                            }))
                          }
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
                      onChange={(e) => setPreviewMintMember(e.target.checked)}
                    />
                    <span>Mint member — 10% off this plan</span>
                  </label>
                  <p className="pvb-quote-mint-hint">
                    The Treatment Mint members save on eligible services and boutique skincare.
                  </p>
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
                  <span>{showMintBreakdown ? "Total with Mint" : "Total"}</span>
                  <strong>{formatPrice(finalTotal)}</strong>
                </div>
                {showTreatmentFinancingBlock ? (
                  <CheckoutFinancingSection
                    totalAmount={treatmentFinancingAmount}
                    hasUnknownPrices={hasUnknownTreatmentPrices}
                    financingUrl={
                      blueprint.cta.financingUrl || "https://www.carecredit.com"
                    }
                    variant="integrated"
                    integratedSurface="pvb-drawer"
                    financingScope="treatments_only"
                    showFinancingLink={false}
                  />
                ) : null}
              </div>
            </div>
            <div className="pvb-drawer-ctas">
              {bookingHref ? (
                <a
                  className="pvb-cta pvb-cta--book"
                  href={bookingHref}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() =>
                    trackPostVisitBlueprintEvent("booking_clicked", {
                      token: blueprint.token,
                      patient_id: blueprint.patient.id,
                    })
                  }
                >
                  Book my plan
                </a>
              ) : (
                <span className="pvb-cta pvb-cta--book pvb-cta--muted" role="note">
                  Contact your care team to schedule your plan.
                </span>
              )}
              {blueprint.cta.textProviderPhone ? (
                <div className="pvb-drawer-ctas-row">
                  <a className="pvb-cta pvb-cta--ghost" href={`sms:${blueprint.cta.textProviderPhone}`}>Text provider</a>
                </div>
              ) : null}
            </div>
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
                      <span className="pvb-case-fact-val">{selectedCaseDetail.longevity}</span>
                    </div>
                  ) : null}
                  {selectedCaseDetail.downtime ? (
                    <div className="pvb-case-fact">
                      <span className="pvb-case-fact-label">Downtime</span>
                      <span className="pvb-case-fact-val">{selectedCaseDetail.downtime}</span>
                    </div>
                  ) : null}
                  {selectedCaseDetail.priceRange ? (
                    <div className="pvb-case-fact">
                      <span className="pvb-case-fact-label">Typical range</span>
                      <span className="pvb-case-fact-val">{selectedCaseDetail.priceRange}</span>
                    </div>
                  ) : null}
                </div>
              )}

              {selectedCaseDetail.demographics ? (
                <p className="pvb-case-demo">{selectedCaseDetail.demographics}</p>
              ) : null}

              {selectedCaseDetail.story || selectedCaseDetail.caption ? (
                <section className="pvb-case-block">
                  <h3 className="pvb-case-block-title">About this case</h3>
                  {selectedCaseDetail.story ? (
                    <p className="pvb-case-prose pvb-case-prose--headline">{selectedCaseDetail.story}</p>
                  ) : null}
                  {selectedCaseDetail.caption ? (
                    <p className="pvb-case-prose">{selectedCaseDetail.caption}</p>
                  ) : null}
                </section>
              ) : null}

              {selectedCaseDetail.tags ? (
                <section className="pvb-case-block">
                  <h3 className="pvb-case-block-title">Tags</h3>
                  <p className="pvb-case-tags-line">{selectedCaseDetail.tags}</p>
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
