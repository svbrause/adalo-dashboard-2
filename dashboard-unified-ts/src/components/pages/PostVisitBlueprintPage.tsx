import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
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
  persistPostVisitBlueprint,
  normalizeFrontPhotoUrl,
  parsePostVisitBlueprintPayload,
  parsePostVisitBlueprintTokenFromUrl,
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
import { AiMirrorCanvas } from "../postVisitBlueprint/AiMirrorCanvas";
import { RadarChart } from "../postVisitBlueprint/RadarChart";
import { TreatmentChapterView } from "../postVisitBlueprint/TreatmentChapter";
import { buildTreatmentChapters } from "../../utils/blueprintTreatmentChapters";
import {
  getBlueprintAnalysisDisplay,
  normalizeBlueprintAnalysisText,
  PVB_ANALYSIS_SECTION_ID,
  treatmentChapterAnchorId,
} from "../../utils/postVisitBlueprintAnalysis";
import aiLogoUrl from "../../assets/images/ai.svg";
import {
  CATEGORIES,
  splitStrengthsAndImprovements,
  scoreTier,
  tierColor,
  tierLabel,
} from "../../config/analysisOverviewConfig";
import type { BlueprintAnalysisOverviewSnapshot } from "../../utils/postVisitBlueprintAnalysis";
import { resolveBlueprintCategorySubScores } from "../../utils/pvbBlueprintCategorySubScores";
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
import "./PostVisitBlueprintPage.css";

/** Collapsible block with chevron toggle (matches Analysis Overview pattern). */
function PvbFacialAnalysisCollapsible({
  sectionId,
  title,
  open,
  onToggle,
  icon,
  children,
  domId,
}: {
  sectionId: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  icon?: ReactNode;
  children: ReactNode;
  /** Optional root id (e.g. in-page anchor) */
  domId?: string;
}) {
  return (
    <section
      className="pvb-ao-ai-summary"
      id={domId}
      aria-labelledby={`${sectionId}-btn`}
    >
      <button
        type="button"
        id={`${sectionId}-btn`}
        className="pvb-ao-ai-summary__toggle"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`${sectionId}-panel`}
      >
        <div className="pvb-ao-ai-summary__brand">
          {icon}
          <span className="pvb-ao-ai-summary__label">{title}</span>
        </div>
        <span className="pvb-ao-ai-summary__chev" aria-hidden>
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open ? (
        <div className="pvb-ao-ai-summary__body" id={`${sectionId}-panel`} role="region">
          {children}
        </div>
      ) : null}
    </section>
  );
}

/** Scroll target for “explore” CTAs (match DOM id below). */
const PVB_TOC_ID = "pvb-toc";

/** Circular score ring (same math as Analysis Overview modal gauge). */
function PvbOverallGauge({
  score,
  animate,
  size = 100,
}: {
  score: number;
  animate: boolean;
  size?: number;
}) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = animate ? (score / 100) * circumference : 0;
  const offset = circumference - progress;
  const color = tierColor(scoreTier(score));

  return (
    <div
      className="pvb-overall-gauge"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(0,0,0,0.08)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{
            transition: animate ? "stroke-dashoffset 1.1s ease-out" : "none",
          }}
        />
      </svg>
      <div className="pvb-overall-gauge__inner">
        <span className="pvb-overall-gauge__value">{animate ? score : 0}</span>
        <span className="pvb-overall-gauge__label">Aesthetic score</span>
      </div>
    </div>
  );
}

/** Matches Analysis Overview `DetailBar` when a category has &lt; 3 sub-axes for a radar. */
function PvbSubScoreBar({
  label,
  score,
  animate,
}: {
  label: string;
  score: number;
  animate: boolean;
}) {
  const color = tierColor(scoreTier(score));
  return (
    <div className="pvb-subscore-bar">
      <div className="pvb-subscore-bar__header">
        <span className="pvb-subscore-bar__label">{label}</span>
        <span className="pvb-subscore-bar__score" style={{ color }}>
          {score}
        </span>
      </div>
      <div className="pvb-subscore-bar__track">
        <div
          className="pvb-subscore-bar__fill"
          style={{
            width: animate ? `${score}%` : "0%",
            background: color,
            transition: animate ? "width 0.8s ease-out" : "none",
          }}
        />
      </div>
    </div>
  );
}

type SnapshotCategory = BlueprintAnalysisOverviewSnapshot["categories"][number];
type SnapshotArea = BlueprintAnalysisOverviewSnapshot["areas"][number];

/** Infer detected/total for older snapshots so strengths vs focus pills still work. */
function enrichSubScoreForPills(
  sub: NonNullable<SnapshotCategory["subScores"]>[number],
  categoryKey: string,
): { name: string; score: number; total: number; detected: number } {
  if (sub.total != null && sub.detected != null) {
    const total = Math.max(1, sub.total);
    const detected = Math.min(total, Math.max(0, sub.detected));
    return {
      name: sub.name,
      score: sub.score,
      total,
      detected,
    };
  }
  const catDef = CATEGORIES.find((c) => c.key === categoryKey);
  const subDef = catDef?.subScores.find((ss) => ss.name === sub.name);
  const total = Math.max(1, subDef?.issues.length ?? 1);
  const detected = Math.min(
    total,
    Math.max(0, Math.round(((100 - sub.score) / 100) * total)),
  );
  return { name: sub.name, score: sub.score, total, detected };
}

/** Expandable pillar — radar + strengths / focus pills + explore (patient-overview v0 style). */
function PvbCategoryExploreCard({
  cat,
  defaultOpen,
  animate,
  onExplorePlan,
  onOpenDetails,
}: {
  cat: SnapshotCategory;
  defaultOpen: boolean;
  animate: boolean;
  onExplorePlan: () => void;
  onOpenDetails: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const resolvedSubs = resolveBlueprintCategorySubScores(cat);
  const subs = resolvedSubs.map((s) => enrichSubScoreForPills(s, cat.key));
  const { strengths, improvements } = splitStrengthsAndImprovements(
    subs,
    (s) => s.total - s.detected,
    (s) => s.detected,
  );
  const tierC = tierColor(cat.tier);
  const radarData = resolvedSubs.map((s) => ({
    name: s.name,
    score: s.score,
  }));

  return (
    <div className={`pvb-explore-cat ${open ? "pvb-explore-cat--open" : ""}`}>
      <button
        type="button"
        className="pvb-explore-cat__header"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="pvb-explore-cat__name">{cat.scoreLabel}</span>
        <div className="pvb-explore-cat__header-right">
          <span
            className="pvb-explore-cat__score-pill"
            style={{ background: tierC }}
          >
            {cat.score}
          </span>
          <span className="pvb-explore-cat__chev" aria-hidden>
            {open ? "▲" : "▼"}
          </span>
        </div>
      </button>
      {open && (
        <div className="pvb-explore-cat__body">
          {cat.description ? (
            <p className="pvb-explore-cat__desc">{cat.description}</p>
          ) : null}
          {radarData.length >= 3 ? (
            <div className="pvb-explore-cat__radar">
              <RadarChart
                data={radarData}
                size={176}
                animate={animate}
                showLabels
                className="pvb-radar pvb-radar--pillar"
                labelClassName="pvb-radar__label"
              />
            </div>
          ) : radarData.length > 0 ? (
            <div className="pvb-explore-cat__bars">
              {radarData.map((s) => (
                <PvbSubScoreBar
                  key={s.name}
                  label={s.name}
                  score={s.score}
                  animate={animate}
                />
              ))}
            </div>
          ) : (
            <p className="pvb-explore-cat__empty">No sub-area breakdown.</p>
          )}

          <div className="pvb-explore-cat__split" aria-label="Sub-area summary">
            <section
              className="pvb-explore-cat__panel pvb-explore-cat__panel--good"
              aria-labelledby={`pvb-strengths-${cat.key}`}
            >
              <h5 className="pvb-explore-cat__panel-title" id={`pvb-strengths-${cat.key}`}>
                Strengths
              </h5>
              <ul className="pvb-explore-cat__list">
                {strengths.length > 0 ? (
                  strengths.map((s) => (
                    <li key={s.name} className="pvb-explore-cat__row pvb-explore-cat__row--good">
                      <span className="pvb-explore-cat__row-label">{s.name}</span>
                      <span className="pvb-explore-cat__row-meta">
                        {s.total - s.detected}/{s.total} look good
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="pvb-explore-cat__row pvb-explore-cat__row--empty">
                    All sub-areas here need attention
                  </li>
                )}
              </ul>
            </section>
            <section
              className="pvb-explore-cat__panel pvb-explore-cat__panel--imp"
              aria-labelledby={`pvb-focus-${cat.key}`}
            >
              <h5 className="pvb-explore-cat__panel-title" id={`pvb-focus-${cat.key}`}>
                Areas for improvement
              </h5>
              <ul className="pvb-explore-cat__list">
                {improvements.length > 0 ? (
                  improvements.map((s) => (
                    <li key={s.name} className="pvb-explore-cat__row pvb-explore-cat__row--imp">
                      <span className="pvb-explore-cat__row-label">{s.name}</span>
                      <span className="pvb-explore-cat__row-meta">
                        {s.detected}/{s.total} noted
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="pvb-explore-cat__row pvb-explore-cat__row--empty">
                    None — looking good
                  </li>
                )}
              </ul>
            </section>
          </div>

          <div className="pvb-explore-cat__cta-row">
            <button
              type="button"
              className="pvb-explore-cat__cta pvb-explore-cat__cta--primary"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetails();
              }}
            >
              View details
              <span aria-hidden> →</span>
            </button>
            <button
              type="button"
              className="pvb-explore-cat__cta pvb-explore-cat__cta--secondary"
              onClick={(e) => {
                e.stopPropagation();
                onExplorePlan();
              }}
            >
              Treatment plan
              <span aria-hidden> →</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Expandable face-area row — strengths vs findings (v0 AreaCard style). */
function PvbAreaExploreCard({
  area,
  defaultOpen,
  onOpenDetails,
}: {
  area: SnapshotArea;
  defaultOpen: boolean;
  onOpenDetails: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const color = tierColor(area.tier);
  const strengths = area.strengths ?? [];
  const improvements = area.improvements ?? [];
  const idSlug = area.name.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "area";

  return (
    <div className={`pvb-explore-area ${open ? "pvb-explore-area--open" : ""}`}>
      <button
        type="button"
        className="pvb-explore-area__header"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="pvb-explore-area__left">
          {area.hasInterest ? (
            <span className="pvb-explore-area__star" title="You highlighted this area">
              ★
            </span>
          ) : null}
          <span className="pvb-explore-area__name">{area.name}</span>
        </span>
        <div className="pvb-explore-area__header-right">
          <span
            className="pvb-explore-cat__score-pill pvb-explore-area__score-pill"
            style={{ background: color }}
          >
            {area.score}
          </span>
          <span className="pvb-explore-cat__chev" aria-hidden>
            {open ? "▲" : "▼"}
          </span>
        </div>
      </button>
      {open && (
        <div className="pvb-explore-area__body">
          <div className="pvb-explore-cat__split" aria-label={`${area.name} summary`}>
            <section
              className="pvb-explore-cat__panel pvb-explore-cat__panel--good"
              aria-labelledby={`pvb-area-str-${idSlug}`}
            >
              <h5 className="pvb-explore-cat__panel-title" id={`pvb-area-str-${idSlug}`}>
                Strengths
              </h5>
              <ul className="pvb-explore-cat__list">
                {strengths.length > 0 ? (
                  strengths.map((t, i) => (
                    <li
                      key={`s-${i}-${t}`}
                      className="pvb-explore-cat__row pvb-explore-cat__row--good pvb-explore-cat__row--text-only"
                    >
                      <span className="pvb-explore-cat__row-label">{t}</span>
                    </li>
                  ))
                ) : (
                  <li className="pvb-explore-cat__row pvb-explore-cat__row--empty">
                    {improvements.length > 0
                      ? "Compared with our full checklist for this region, every feature we evaluate showed up on your scan — see Areas for improvement."
                      : "Open View details for the full regional breakdown."}
                  </li>
                )}
              </ul>
            </section>
            <section
              className="pvb-explore-cat__panel pvb-explore-cat__panel--imp"
              aria-labelledby={`pvb-area-imp-${idSlug}`}
            >
              <h5 className="pvb-explore-cat__panel-title" id={`pvb-area-imp-${idSlug}`}>
                Areas for improvement
              </h5>
              <ul className="pvb-explore-cat__list">
                {improvements.length > 0 ? (
                  improvements.map((t, i) => (
                    <li
                      key={`f-${i}-${t}`}
                      className="pvb-explore-cat__row pvb-explore-cat__row--imp pvb-explore-cat__row--text-only"
                    >
                      <span className="pvb-explore-cat__row-label">{t}</span>
                    </li>
                  ))
                ) : (
                  <li className="pvb-explore-cat__row pvb-explore-cat__row--empty">
                    None noted in this region.
                  </li>
                )}
              </ul>
            </section>
          </div>
          <button
            type="button"
            className="pvb-explore-area__details-btn"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetails();
            }}
          >
            View details
            <span aria-hidden> →</span>
          </button>
        </div>
      )}
    </div>
  );
}

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
  /** Hero / AI Mirror image: embedded data URL, fresh API URL, or stale Airtable URL. */
  const [heroPhotoUrl, setHeroPhotoUrl] = useState<string | null>(null);
  const [aestheticIntelOpen, setAestheticIntelOpen] = useState(true);
  const [analysisSnapshotOpen, setAnalysisSnapshotOpen] = useState(true);
  const [profileStripOpen, setProfileStripOpen] = useState(true);
  const [focusGoalsOpen, setFocusGoalsOpen] = useState(true);
  const [visitThemesOpen, setVisitThemesOpen] = useState(true);
  /** Whole “Facial analysis” card — collapsed shows title + chevron only */
  const [facialAnalysisOpen, setFacialAnalysisOpen] = useState(true);
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
    const embedded = blueprint.patient.frontPhotoDataUrl?.trim();
    if (embedded) {
      setHeroPhotoUrl(embedded);
      return;
    }
    const staticUrl = normalizeFrontPhotoUrl(blueprint.patient.frontPhoto);
    setHeroPhotoUrl(staticUrl);
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

  /* ── Derived data ── */

  const treatmentResultCards = useMemo(() => {
    if (!blueprint || !blueprintAllowed) return [];
    return buildTreatmentResultsCards(
      blueprint.discussedItems,
      photoPool,
      {
        skinType: blueprint.patient.skinType,
        skinTone: blueprint.patient.skinTone,
        ethnicBackground: blueprint.patient.ethnicBackground,
      },
      8,
    );
  }, [blueprint, blueprintAllowed, photoPool]);

  const chapters = useMemo(() => {
    if (!blueprint || !blueprintAllowed) return [];
    return buildTreatmentChapters(blueprint.discussedItems, treatmentResultCards);
  }, [blueprint, blueprintAllowed, treatmentResultCards]);

  const analysisDisplay = useMemo(() => {
    if (!blueprint || !blueprintAllowed) return null;
    return getBlueprintAnalysisDisplay(blueprint);
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

  /** Deep link / hash → #pvb-analysis opens the full facial analysis card */
  useEffect(() => {
    const sync = () => {
      const h = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
      if (h === PVB_ANALYSIS_SECTION_ID) setFacialAnalysisOpen(true);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  /* ── Callbacks ── */

  const scrollToSection = useCallback((id: string) => {
    if (id === PVB_ANALYSIS_SECTION_ID) {
      setFacialAnalysisOpen(true);
    }
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

  const scrollToExploreTarget = useCallback(() => {
    if (chapters.length > 0) {
      scrollToSection(PVB_TOC_ID);
    } else if (analysisDisplay && analysisDisplay.planByTreatment.length > 0) {
      scrollToSection(analysisDisplay.planByTreatment[0].anchorId);
    }
  }, [analysisDisplay, chapters.length, scrollToSection]);

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

  const openCategorySubpage = useCallback((key: string) => {
    setTreatmentReturnRoute(null);
    setAnalysisSubpage({ type: "category", key });
    const { pathname, search } = window.location;
    window.history.replaceState(
      null,
      "",
      `${pathname}${search}${buildPvbCategorySubpageHash(key)}`,
    );
  }, []);

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
        <div className="pvb-error">
          <h1>Loading your blueprint…</h1>
          <p>Fetching your plan. This only takes a moment.</p>
        </div>
      </div>
    );
  }

  if (!blueprint) {
    return (
      <div className="pvb">
        <div className="pvb-error">
          <h1>Blueprint unavailable</h1>
          <p>
            This link is missing your plan data (for example, the message was shortened or you&apos;re on a new
            device). Open the <strong>full</strong> link from your text, or contact your clinic for a new blueprint.
          </p>
        </div>
      </div>
    );
  }

  if (!blueprintAllowed) {
    return (
      <div className="pvb">
        <div className="pvb-error">
          <h1>Blueprint unavailable</h1>
          <p>This experience is only available for patients of The Treatment Skin Boutique or links sent from an authorized account.</p>
        </div>
      </div>
    );
  }

  /* ── Derived render data ── */

  const bookingHref = blueprint.cta.bookingUrl?.trim() || THE_TREATMENT_BOOKING_URL;
  const patientFirst = blueprint.patient.name.split(/\s+/)[0] || "there";
  const providerFirst = (blueprint.providerName ?? "").split(",")[0]?.trim() || blueprint.providerName;

  const visibleHotspots = Array.from(
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

  const toggledTotal = blueprint.quote.lineItems.reduce((sum, line, idx) => {
    if (!selectedRows[idx]) return sum;
    return sum + (line.price ?? 0);
  }, 0);
  const finalTotal = blueprint.quote.isMintMember
    ? toggledTotal * 0.9
    : toggledTotal;
  /* ── Render ── */

  return (
    <div className="pvb">
      <main className="pvb-shell" aria-label="Post Visit Blueprint">

        {/* ═══ 1. HERO: Mirror + Welcome ═══ */}
        <section className="pvb-hero">
          <div className="pvb-hero-mirror">
            {heroPhotoUrl ? (
              <AiMirrorCanvas
                imageUrl={heroPhotoUrl}
                alt="Your facial analysis"
                highlightTerms={visibleHotspots}
              />
            ) : (
              <div className="pvb-hero-mirror-placeholder">AI Analysis</div>
            )}
            <div className="pvb-hero-gradient" />
          </div>

          <div className="pvb-hero-welcome">
            <span className="pvb-hero-clinic">{blueprint.clinicName}</span>
            <h1 className="pvb-hero-title">Hi {patientFirst}</h1>
            <p className="pvb-hero-subtitle">
              {providerFirst} put together this personalized treatment guide based
              on your visit. Scroll down to learn about each treatment, see real
              results, and watch short videos from your care team.
            </p>
          </div>

          {visibleHotspots.length > 0 && (
            <div className="pvb-hero-pills">
              {visibleHotspots.map((spot) => (
                <span key={spot} className="pvb-pill">{spot}</span>
              ))}
            </div>
          )}
        </section>

        {/* ═══ 2. FACIAL ANALYSIS (same narrative pattern as dashboard Analysis Overview) ═══ */}
        {analysisDisplay && (
          <section className="pvb-analysis" id={PVB_ANALYSIS_SECTION_ID}>
            <h2 className="pvb-analysis-title pvb-analysis-title--accordion" id="pvb-analysis-heading">
              <button
                type="button"
                className="pvb-analysis__accordion-btn"
                aria-expanded={facialAnalysisOpen}
                aria-controls="pvb-facial-analysis-panel"
                onClick={() => setFacialAnalysisOpen((o) => !o)}
              >
                <span className="pvb-analysis__accordion-btn-label">Facial analysis</span>
                <span className="pvb-analysis__accordion-chev" aria-hidden>
                  {facialAnalysisOpen ? "▲" : "▼"}
                </span>
              </button>
            </h2>
            {facialAnalysisOpen ? (
              <>
                <p className="pvb-analysis-lead pvb-analysis-lead--panel">
                  Highlights from your visit and assessment. Your plan sections below go deeper on
                  each treatment.
                </p>
                <div
                  id="pvb-facial-analysis-panel"
                  className="pvb-analysis-stack"
                  role="region"
                  aria-labelledby="pvb-analysis-heading"
                >
              {analysisDisplay.overviewSnapshot && (
                <PvbFacialAnalysisCollapsible
                  sectionId="pvb-aesthetic-intel"
                  title="Aesthetic Intelligence"
                  open={aestheticIntelOpen}
                  onToggle={() => setAestheticIntelOpen((o) => !o)}
                  icon={
                    <img
                      src={aiLogoUrl}
                      alt=""
                      className="pvb-ao-ai-summary__icon"
                      width={16}
                      height={16}
                    />
                  }
                >
                  <div className="pvb-ai-hero pvb-ai-hero--in-collapsible">
                    <div className="pvb-ai-hero__narrative">
                      {analysisDisplay.overviewSnapshot.assessmentParagraph
                        .split(/\n\n+/)
                        .map((p) => p.trim())
                        .filter(Boolean)
                        .map((para, idx) => (
                          <p key={idx} className="pvb-ai-hero__para">
                            {para}
                          </p>
                        ))}
                    </div>
                    {analysisDisplay.overviewSnapshot.aiNarrative?.trim() ? (
                      <div className="pvb-ai-hero__supplement">
                        <p className="pvb-ai-hero__supplement-label">
                          Additional perspective
                        </p>
                        <p className="pvb-ai-hero__supplement-text">
                          {analysisDisplay.overviewSnapshot.aiNarrative.trim()}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </PvbFacialAnalysisCollapsible>
              )}

              {analysisDisplay.overviewSnapshot && (
                <PvbFacialAnalysisCollapsible
                  sectionId="pvb-analysis-snapshot"
                  title="Analysis snapshot"
                  open={analysisSnapshotOpen}
                  onToggle={() => setAnalysisSnapshotOpen((o) => !o)}
                >
                  <div className="pvb-analysis-overview">
                  <div className="pvb-analysis-overview-hero">
                    {heroPhotoUrl ? (
                      <div className="pvb-analysis-overview-hero-photo">
                        <img
                          src={heroPhotoUrl}
                          alt=""
                          className="pvb-analysis-overview-hero-photo-img"
                          loading="lazy"
                        />
                        <span className="pvb-analysis-overview-hero-photo-caption">Your photo</span>
                      </div>
                    ) : null}
                    <PvbOverallGauge
                      score={analysisDisplay.overviewSnapshot.overallScore}
                      animate={overviewGaugeAnimate}
                      size={100}
                    />
                    <div className="pvb-analysis-overview-hero-text">
                      <p
                        className="pvb-analysis-tier-badge"
                        style={{
                          color: tierColor(
                            analysisDisplay.overviewSnapshot.overallTier,
                          ),
                        }}
                      >
                        {tierLabel(analysisDisplay.overviewSnapshot.overallTier)}
                      </p>
                      <p className="pvb-analysis-overview-lead">
                        Your aesthetic score combines skin health, volume, and facial structure.
                      </p>
                    </div>
                  </div>
                  <h4 className="pvb-analysis-subsection-title">
                    Skin, volume &amp; structure
                  </h4>
                  <p className="pvb-pillar-radars-intro">
                    Tap a pillar to expand — <strong>View details</strong> opens the full category
                    page. From there, categories that include <strong>Eye Area</strong> or{" "}
                    <strong>Brow &amp; Eyes</strong> can open <strong>View Eye area details</strong> for
                    the Eyes region. <strong>What we discussed</strong> lists each treatment in your plan
                    below.
                  </p>
                  <div
                    className="pvb-explore-cat-list"
                    role="list"
                    aria-label="Category exploration"
                  >
                    {analysisDisplay.overviewSnapshot.categories.map((c) => (
                      <PvbCategoryExploreCard
                        key={c.key}
                        cat={c}
                        defaultOpen={false}
                        animate={overviewGaugeAnimate}
                        onExplorePlan={scrollToExploreTarget}
                        onOpenDetails={() => openCategorySubpage(c.key)}
                      />
                    ))}
                  </div>
                  <h4 className="pvb-analysis-subsection-title pvb-analysis-subsection-title--tight">
                    Face areas
                  </h4>
                  <p className="pvb-analysis-subsection-lead">
                    By region — lower scores mean more features were noted in your analysis.
                  </p>
                  {(() => {
                    const areas = analysisDisplay.overviewSnapshot.areas;
                    const focusAreas = [...areas]
                      .filter((a) => a.hasInterest)
                      .sort((x, y) => x.score - y.score);
                    const otherAreas = [...areas]
                      .filter((a) => !a.hasInterest)
                      .sort((x, y) => x.score - y.score);
                    return (
                      <div className="pvb-explore-area-wrap">
                        {focusAreas.length > 0 ? (
                          <div className="pvb-explore-area-group">
                            <h5 className="pvb-explore-area-group-title">
                              <span className="pvb-explore-area-group-star" aria-hidden>
                                ★
                              </span>{" "}
                              Focus areas
                            </h5>
                            <div className="pvb-explore-area-list" role="list">
                              {focusAreas.map((ar) => (
                                <PvbAreaExploreCard
                                  key={ar.name}
                                  area={ar}
                                  defaultOpen={false}
                                  onOpenDetails={() => openAreaSubpage(ar.name)}
                                />
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {otherAreas.length > 0 ? (
                          <div className="pvb-explore-area-group">
                            <h5 className="pvb-explore-area-group-title">All areas</h5>
                            <div className="pvb-explore-area-list" role="list">
                              {otherAreas.map((ar) => (
                                <PvbAreaExploreCard
                                  key={ar.name}
                                  area={ar}
                                  defaultOpen={false}
                                  onOpenDetails={() => openAreaSubpage(ar.name)}
                                />
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })()}
                  {analysisDisplay.overviewSnapshot.detectedIssueLabels.length > 0 && (
                    <>
                      <h4 className="pvb-analysis-subsection-title">
                        All findings from your scan
                      </h4>
                      <div className="pvb-analysis-findings-chips">
                        {analysisDisplay.overviewSnapshot.detectedIssueLabels.map(
                          (label, idx) => (
                            <span
                              key={`${label}-${idx}`}
                              className="pvb-analysis-findings-chip"
                            >
                              {label}
                            </span>
                          ),
                        )}
                      </div>
                    </>
                  )}
                  </div>
                </PvbFacialAnalysisCollapsible>
              )}

              {analysisDisplay.profileLabels.length > 0 && (
                <PvbFacialAnalysisCollapsible
                  sectionId="pvb-profile-strip"
                  title="Your profile"
                  open={profileStripOpen}
                  onToggle={() => setProfileStripOpen((o) => !o)}
                >
                  <div className="pvb-analysis-profile-strip" aria-label="Your profile">
                    {analysisDisplay.profileLabels.map((row) => (
                      <span key={row.label} className="pvb-analysis-profile-chip">
                        <span className="pvb-analysis-profile-chip-label">{row.label}</span>
                        <span className="pvb-analysis-profile-chip-val">{row.value}</span>
                      </span>
                    ))}
                  </div>
                </PvbFacialAnalysisCollapsible>
              )}

              {analysisDisplay.goals.length > 0 && (
                <PvbFacialAnalysisCollapsible
                  sectionId="pvb-focus-goals"
                  title="Client's focus"
                  open={focusGoalsOpen}
                  onToggle={() => setFocusGoalsOpen((o) => !o)}
                >
                  <section className="pvb-analysis-panel pvb-analysis-panel--in-collapsible" aria-label="Client focus">
                    <div className="pvb-analysis-goal-chips">
                      {analysisDisplay.goals.map((g) => (
                        <span key={g} className="pvb-analysis-goal-chip">
                          {g}
                        </span>
                      ))}
                    </div>
                  </section>
                </PvbFacialAnalysisCollapsible>
              )}

              {(analysisDisplay.globalPlanInsights.interests.length > 0 ||
                analysisDisplay.globalPlanInsights.findings.length > 0) && (
                <PvbFacialAnalysisCollapsible
                  sectionId="pvb-visit-themes"
                  title="Visit themes"
                  open={visitThemesOpen}
                  onToggle={() => setVisitThemesOpen((o) => !o)}
                >
                  <div className="pvb-analysis-panel pvb-analysis-global pvb-analysis-panel--in-collapsible">
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
                </PvbFacialAnalysisCollapsible>
              )}
                </div>
              </>
            ) : null}
          </section>
        )}

        {/* ═══ 3. TABLE OF CONTENTS ═══ */}
        {chapters.length > 0 && (
          <section className="pvb-toc" id={PVB_TOC_ID}>
            <h2 className="pvb-toc-title">What we discussed</h2>
            <p className="pvb-toc-sub">
              {analysisDisplay ? "Analysis, then " : ""}
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
                    <span className="pvb-toc-item-name">Your analysis highlights</span>
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
                  casePhotos={photoPool}
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
                  casePhotos={photoPool}
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
                casePhotos={photoPool}
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
            <p className="pvb-drawer-intro">Toggle treatments on or off to update the total.</p>
            <div className="pvb-quote">
              {blueprint.quote.lineItems.map((line, idx) => (
                <label key={`${line.skuName ?? line.label}-${idx}`} className="pvb-quote-row">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedRows[idx])}
                    onChange={(e) => setSelectedRows((prev) => ({ ...prev, [idx]: e.target.checked }))}
                  />
                  <span>{line.skuName ?? line.label}</span>
                  <strong>{formatPrice(line.price ?? 0)}</strong>
                </label>
              ))}
              {blueprint.quote.isMintMember && (
                <p className="pvb-quote-note">Mint member discount (10%) applied.</p>
              )}
              <div className="pvb-quote-total">
                <span>Total</span>
                <strong>{formatPrice(finalTotal)}</strong>
              </div>
            </div>
            <div className="pvb-drawer-ctas">
              <a
                className="pvb-cta pvb-cta--book"
                href={bookingHref}
                target="_blank"
                rel="noreferrer"
                onClick={() => trackPostVisitBlueprintEvent("booking_clicked", { token: blueprint.token, patient_id: blueprint.patient.id })}
              >Book my plan</a>
              <div className="pvb-drawer-ctas-row">
                <a
                  className="pvb-cta pvb-cta--ghost"
                  href={blueprint.cta.financingUrl || "https://www.carecredit.com"}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => trackPostVisitBlueprintEvent("financing_clicked", { token: blueprint.token, patient_id: blueprint.patient.id })}
                >Check financing</a>
                {blueprint.cta.textProviderPhone && (
                  <a className="pvb-cta pvb-cta--ghost" href={`sms:${blueprint.cta.textProviderPhone}`}>Text provider</a>
                )}
              </div>
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
              <span className="pvb-case-eyebrow">Real patient result</span>
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

              {selectedCaseDetail.story ? (
                <section className="pvb-case-block">
                  <h3 className="pvb-case-block-title">About this case</h3>
                  <p className="pvb-case-prose">{selectedCaseDetail.story}</p>
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
