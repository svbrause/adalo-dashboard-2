import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { Client, ClientPhotoSlot, DiscussedItem } from "../../types";
import type {
  TreatmentPlanAddDirectOptions,
  TreatmentPlanPrefill,
} from "../modals/DiscussedTreatmentsModal/TreatmentPhotos";
import AnalysisOverviewModal from "../modals/AnalysisOverviewModal";
import {
  AiMirrorCanvas,
  hasMirrorAnnotationHighlights,
} from "../postVisitBlueprint/AiMirrorCanvas";
import {
  ADDITIONAL_AI_MIRROR_REGIONS,
  AI_MIRROR_REGIONS,
} from "../postVisitBlueprint/aiMirrorRegions";
import Face3DViewer from "./Face3DViewer";
import AuraFaceView from "../aura/AuraFaceView";
import { clientUsesAuraScan } from "../../utils/auraScanConfig";
import { TANYA_TAN_VIEWER_ANGLE_ASSETS } from "../../utils/auraTanAnglePhotos";
import {
  AURA_OVERVIEW_TABS,
  issueToMirrorHighlightTerm,
  type AuraOverviewCategoryKey,
} from "../../utils/auraAnalysisBridge";
import type { AuraMirrorHighlightBridge } from "./AuraEmbeddedAnalysisPanel";
import {
  faceMirrorHighlightStorageKey,
  loadFaceMirrorHighlightedRegions,
  saveFaceMirrorHighlightedRegions,
} from "../../utils/faceMirrorHighlightStorage";
import { getScanApiBaseUrl } from "../../utils/scanApi";
import "./FaceMirrorPanel.css";

// ---------------------------------------------------------------------------
// 3D Scan generation types
// ---------------------------------------------------------------------------
type ScanQuality = "ultra" | "draft" | "standard" | "high";

const QUALITY_LABELS: Record<ScanQuality, { label: string; time: string; desc: string }> = {
  ultra:    { label: "Ultra-fast", time: "~1 min",   desc: "Fastest — lower fidelity, warm GPU required" },
  draft:    { label: "Draft",      time: "~2 min",   desc: "Faster, lower fidelity" },
  standard: { label: "Standard",   time: "~3–4 min", desc: "Balanced quality (recommended)" },
  high:     { label: "High",       time: "~5–6 min", desc: "Best detail, longest wait" },
};

type ScanState =
  | { phase: "idle" }
  | { phase: "config" }
  | { phase: "submitting" }
  | { phase: "running"; jobId: string; progress: number; message: string; remaining: number }
  | { phase: "done"; videoUrl: string }
  | { phase: "error"; message: string };

// ---------------------------------------------------------------------------
// Scan-job localStorage persistence (survives page navigations)
// ---------------------------------------------------------------------------
type PersistedScanJob = {
  jobId: string;
  quality: ScanQuality;
  estimatedSeconds: number;
  startedAt: number; // Date.now()
};

const SCAN_JOB_MAX_AGE_MS = 30 * 60 * 1000; // 30 min — abandon stale jobs

function scanJobKey(recordId: string): string {
  return `fmp-scan-job:${recordId}`;
}

function savePersistedJob(recordId: string, job: PersistedScanJob): void {
  try { localStorage.setItem(scanJobKey(recordId), JSON.stringify(job)); } catch { /* storage full */ }
}

function loadPersistedJob(recordId: string): PersistedScanJob | null {
  try {
    const raw = localStorage.getItem(scanJobKey(recordId));
    if (!raw) return null;
    const job = JSON.parse(raw) as PersistedScanJob;
    if (Date.now() - job.startedAt > SCAN_JOB_MAX_AGE_MS) {
      localStorage.removeItem(scanJobKey(recordId));
      return null;
    }
    return job;
  } catch { return null; }
}

function clearPersistedJob(recordId: string): void {
  try { localStorage.removeItem(scanJobKey(recordId)); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Photo slot → Modal photo-key mapping
// ---------------------------------------------------------------------------
function mapSlotsToModalPhotos(slots: ClientPhotoSlot[]): Record<string, string> {
  const photos: Record<string, string> = {};

  // Drop form/document slots but keep "original" photos
  const photoSlots = slots.filter((s) => {
    const blob = `${s.id} ${s.label ?? ""}`.toLowerCase();
    return !blob.includes("form") && !blob.includes("consent");
  });

  if (photoSlots.length === 0) return {};

  // Pick best front
  const frontSlot =
    photoSlots.find((s) => {
      const b = `${s.id} ${s.label ?? ""}`.toLowerCase();
      return s.id === "front" || b.includes("front");
    }) ?? photoSlots[0];

  photos["front"] = frontSlot.url;

  // Map every other slot — multiple photos of the same angle get _1, _2 suffixes
  // so Modal receives all of them and can pick the best view.
  const keyCount: Record<string, number> = {};

  for (const slot of photoSlots) {
    if (slot.url === frontSlot.url) continue;
    const blob = `${slot.id} ${slot.label ?? ""}`.toLowerCase();

    let base: string;
    if      (blob.includes("left")  && blob.includes("90")) base = "left90";
    else if (blob.includes("right") && blob.includes("90")) base = "right90";
    else if (blob.includes("left")  && blob.includes("45")) base = "left45";
    else if (blob.includes("right") && blob.includes("45")) base = "right45";
    else if (blob.includes("left"))                          base = "left90";
    else if (blob.includes("right"))                         base = "right90";
    else                                                     base = "extra";

    const n = keyCount[base] ?? 0;
    photos[n === 0 ? base : `${base}_${n}`] = slot.url;
    keyCount[base] = n + 1;
  }

  return photos;
}

function formatRemaining(seconds: number): string {
  if (seconds <= 0) return "almost done…";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s remaining` : `${s}s remaining`;
}

// ---------------------------------------------------------------------------
// Helpers copied from original FaceMirrorPanel
// ---------------------------------------------------------------------------
type ViewMode = "photo" | "3d";

const ANNOTATION_REGION_LABELS: Record<string, string> = {
  rForehead: "Forehead",
  rLeftEye: "Left eye",
  rRightEye: "Right eye",
  rNose: "Nose",
  rLeftCheek: "Left cheek",
  rRightCheek: "Right cheek",
  rLips: "Lips",
  rChin: "Chin",
  rLeftUnderEye: "Left under eye",
  rRightUnderEye: "Right under eye",
  rLeftNasolabialFold: "Left nasolabial",
  rRightNasolabialFold: "Right nasolabial",
  rLeftMarionetteLine: "Left marionette",
  rRightMarionetteLine: "Right marionette",
  rLowerFace: "Lower face",
};

const MIRROR_ANNOTATION_REGIONS = [
  ...AI_MIRROR_REGIONS,
  ...ADDITIONAL_AI_MIRROR_REGIONS,
];

const ALL_ANNOTATION_REGION_IDS = MIRROR_ANNOTATION_REGIONS.map((region) => region.id);

function isIntakeOrFormSlot(s: ClientPhotoSlot): boolean {
  const id = s.id.toLowerCase();
  const lab = (s.label ?? "").toLowerCase();
  return id.includes("form") || lab.includes("intake");
}

function simplifyToFrontSideSlots(slots: ClientPhotoSlot[]): ClientPhotoSlot[] {
  if (slots.length === 0) return [];
  if (slots.length === 1) return [{ ...slots[0], label: "Front" }];
  const lower = (s: string) => s.toLowerCase();

  const front =
    slots.find((s) => lower(s.id) === "front") ??
    slots.find(
      (s) =>
        !isIntakeOrFormSlot(s) &&
        (lower(s.id).includes("front") || (s.label && lower(s.label).includes("front"))),
    ) ??
    slots.find((s) => lower(s.id).includes("front")) ??
    slots[0];

  const others = slots.filter((s) => s.url !== front.url);
  if (others.length === 0) return [{ ...front, label: "Front" }];

  const sideNonIntake =
    others.find((s) => lower(s.id) === "side") ??
    others.find((s) => {
      if (isIntakeOrFormSlot(s)) return false;
      if (lower(s.id).includes("front")) return false;
      const blob = lower(`${s.id} ${s.label ?? ""}`);
      return /(\bleft\b|\bright\b|profile|\b45\b|\b90\b|side)/.test(blob);
    });

  const side = sideNonIntake ?? others.find((s) => lower(s.id).startsWith("side")) ?? others[0];
  return [{ ...front, label: "Front" }, { ...side, label: "Side" }];
}

// ---------------------------------------------------------------------------
// Photo stage sub-component (unchanged from original)
// ---------------------------------------------------------------------------
function FaceMirrorPhotoStage({
  activePhotoUrl,
  patientName,
  highlightTerms,
  highlightedRegionIds,
  showAnnotations,
  showPatientPhotoGallery,
  onOpenPatientPhotos,
  openPatientPhotosSafe,
  photoModalInitialTab,
  simplifiedSlots,
  angleIdx,
  setAngleIdx,
  showAnglePicker,
  wrapClassName,
}: {
  activePhotoUrl: string;
  patientName: string;
  highlightTerms: string[];
  highlightedRegionIds: string[];
  showAnnotations: boolean;
  showPatientPhotoGallery: boolean;
  onOpenPatientPhotos?: (initialTab: "front" | "side") => void;
  openPatientPhotosSafe: (initialTab: "front" | "side") => void;
  photoModalInitialTab: "front" | "side";
  simplifiedSlots: ClientPhotoSlot[];
  angleIdx: number;
  setAngleIdx: (i: number) => void;
  showAnglePicker: boolean;
  wrapClassName?: string;
}) {
  return (
    <div className={wrapClassName ? `fmp-photo-stage ${wrapClassName}` : "fmp-photo-stage"}>
      <AiMirrorCanvas
        imageUrl={activePhotoUrl}
        alt={`${patientName} facial analysis`}
        highlightTerms={highlightTerms}
        highlightedRegionIds={highlightedRegionIds}
        showAnnotations={showAnnotations}
      />
      {showPatientPhotoGallery && onOpenPatientPhotos && (
        <button
          type="button"
          className="fmp-gallery-expand"
          onClick={() => openPatientPhotosSafe(photoModalInitialTab)}
          aria-label="Open all photos and originals"
          title="All photos and originals"
        >
          <img
            className="fmp-gallery-expand-icon"
            src={`${import.meta.env.BASE_URL}expand.png`}
            alt=""
            width={18}
            height={18}
            draggable={false}
          />
        </button>
      )}
      {showAnglePicker && (
        <div
          className="fmp-angle-bar fmp-angle-bar--under-photo"
          role="tablist"
          aria-label="Photo angle"
        >
          {simplifiedSlots.map((slot, i) => (
            <button
              key={`${slot.url}-${i}`}
              type="button"
              role="tab"
              aria-selected={i === angleIdx}
              className={`fmp-angle-tab${i === angleIdx ? " fmp-angle-tab--active" : ""}`}
              onClick={() => setAngleIdx(i)}
            >
              {slot.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overlay controls (auto-rotate, highlight) on photo / 3D viewport
// ---------------------------------------------------------------------------
function FaceMirrorViewportShell({
  children,
  showAutoRotate,
  autoRotate,
  onToggleAutoRotate,
  showHighlightPicker,
  manualHighlightedRegionIds,
  onSetManualHighlightedRegionIds,
  onToggleAnnotationRegionHighlight,
}: {
  children: ReactNode;
  showAutoRotate: boolean;
  autoRotate: boolean;
  onToggleAutoRotate: () => void;
  showHighlightPicker: boolean;
  manualHighlightedRegionIds: string[];
  onSetManualHighlightedRegionIds: (ids: string[]) => void;
  onToggleAnnotationRegionHighlight: (regionId: string) => void;
}) {
  const showOverlays = showAutoRotate || showHighlightPicker;
  if (!showOverlays) return <>{children}</>;

  return (
    <div className="fmp-viewport">
      {children}
      <div className="fmp-viewport-overlays" aria-label="View controls">
        {showAutoRotate && (
          <button
            type="button"
            className={`fmp-overlay-btn${autoRotate ? " fmp-overlay-btn--active" : ""}`}
            onClick={onToggleAutoRotate}
            aria-pressed={autoRotate}
            title={autoRotate ? "Pause auto-rotate" : "Auto-rotate"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 12a9 9 0 1 1-3-6.7" />
              <polyline points="21 3 21 9 15 9" />
            </svg>
            <span className="fmp-overlay-btn__label">Rotate</span>
          </button>
        )}
        {showHighlightPicker && (
          <details className="fmp-annotation-regions fmp-annotation-regions--overlay">
            <summary>Regions</summary>
            <div className="fmp-annotation-regions__panel">
              <div className="fmp-annotation-regions__actions">
                <button
                  type="button"
                  onClick={() => onSetManualHighlightedRegionIds(ALL_ANNOTATION_REGION_IDS)}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => onSetManualHighlightedRegionIds([])}
                >
                  None
                </button>
              </div>
              <div className="fmp-annotation-regions__grid">
                {MIRROR_ANNOTATION_REGIONS.map((region) => (
                  <label key={region.id} className="fmp-annotation-regions__item">
                    <input
                      type="checkbox"
                      checked={manualHighlightedRegionIds.includes(region.id)}
                      onChange={() => onToggleAnnotationRegionHighlight(region.id)}
                    />
                    <span>{ANNOTATION_REGION_LABELS[region.id] ?? region.id}</span>
                  </label>
                ))}
              </div>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scan generation config panel
// ---------------------------------------------------------------------------
function ScanConfigPanel({
  slots,
  quality,
  onQualityChange,
  onStart,
  onCancel,
  submitting,
}: {
  slots: ClientPhotoSlot[];
  quality: ScanQuality;
  onQualityChange: (q: ScanQuality) => void;
  onStart: () => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const photoMap = mapSlotsToModalPhotos(slots);
  const photoCount = Object.keys(photoMap).length;

  return (
    <div className="fmp-scan-config">
      <div className="fmp-scan-config-header">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
        Generate 3D Scan
      </div>

      <div className="fmp-scan-config-row">
        <span className="fmp-scan-config-label">Quality</span>
        <div className="fmp-scan-quality-options">
          {(["ultra", "draft", "standard", "high"] as ScanQuality[]).map((q) => (
            <label
              key={q}
              className={`fmp-scan-quality-option${quality === q ? " fmp-scan-quality-option--active" : ""}`}
            >
              <input
                type="radio"
                name="scan-quality"
                value={q}
                checked={quality === q}
                onChange={() => onQualityChange(q)}
              />
              <span className="fmp-scan-quality-name">{QUALITY_LABELS[q].label}</span>
              <span className="fmp-scan-quality-time">{QUALITY_LABELS[q].time}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="fmp-scan-config-row">
        <span className="fmp-scan-config-label">Photos</span>
        <span className="fmp-scan-config-value">
          {photoCount} angle{photoCount !== 1 ? "s" : ""} available
          {" · "}
          {Object.keys(photoMap).join(", ")}
        </span>
      </div>

      <div className="fmp-scan-config-actions">
        <button type="button" className="fmp-scan-cancel-btn" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="button" className="fmp-scan-start-btn" onClick={onStart} disabled={submitting || photoCount === 0}>
          {submitting ? "Submitting…" : "Start 3D Scan"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FaceMirrorPanel — main component
// ---------------------------------------------------------------------------
interface FaceMirrorPanelProps {
  photoUrl: string | null;
  photoSlots?: ClientPhotoSlot[];
  glbUrl?: string | null;
  highlightTerms?: string[];
  patientName?: string;
  /** Airtable record ID — used to persist the generated turntable URL back to Airtable via /api/scan/save-video. */
  airtableRecordId?: string;
  /** Airtable table name for the patient record (e.g. "Patients"). */
  airtableTableName?: string;
  onOpenPatientPhotos?: (initialTab: "front" | "side") => void;
  showPatientPhotoGallery?: boolean;
  analysisOverviewClient?: Client | null;
  analysisOverviewOnAddToPlanDirect?: (
    prefill: TreatmentPlanPrefill,
    options?: TreatmentPlanAddDirectOptions,
  ) => Promise<void | DiscussedItem> | DiscussedItem | void;
  /** Called when a new turntable video has been generated for this client. */
  onScanGenerated?: (videoUrl: string) => void;
}

export default function FaceMirrorPanel({
  photoUrl,
  photoSlots = [],
  glbUrl: videoUrlProp,
  highlightTerms = [],
  patientName = "Patient",
  airtableRecordId,
  airtableTableName,
  onOpenPatientPhotos,
  showPatientPhotoGallery = false,
  analysisOverviewClient = null,
  analysisOverviewOnAddToPlanDirect,
  onScanGenerated,
}: FaceMirrorPanelProps) {
  // --- Existing state ---
  const [mode, setMode] = useState<ViewMode>("photo");
  const [autoRotate3d, setAutoRotate3d] = useState(true);
  const highlightStorageKey = faceMirrorHighlightStorageKey(
    airtableRecordId,
    patientName,
  );
  const [manualHighlightedRegionIds, setManualHighlightedRegionIds] = useState<string[]>(
    () => loadFaceMirrorHighlightedRegions(highlightStorageKey, ALL_ANNOTATION_REGION_IDS),
  );
  const [angleIdx, setAngleIdx] = useState(0);
  const [viewportExpanded, setViewportExpanded] = useState(false);
  const [auraPanelCollapsed, setAuraPanelCollapsed] = useState(false);
  const [auraActiveCategory, setAuraActiveCategory] =
    useState<AuraOverviewCategoryKey>("volumeLoss");
  const [auraIssueHighlights, setAuraIssueHighlights] = useState<string[]>([]);

  // --- Scan generation state ---
  const [scanState, setScanState] = useState<ScanState>({ phase: "idle" });
  const [scanQuality, setScanQuality] = useState<ScanQuality>("standard");
  const [overrideGlbUrl, setOverrideGlbUrl] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const effectiveVideoUrl = overrideGlbUrl ?? videoUrlProp ?? null;
  const has3D = Boolean(effectiveVideoUrl);
  const useAuraScan = clientUsesAuraScan(patientName) && Boolean(effectiveVideoUrl);

  useEffect(() => {
    setManualHighlightedRegionIds(
      loadFaceMirrorHighlightedRegions(highlightStorageKey, ALL_ANNOTATION_REGION_IDS),
    );
  }, [highlightStorageKey]);

  useEffect(() => {
    saveFaceMirrorHighlightedRegions(highlightStorageKey, manualHighlightedRegionIds);
  }, [highlightStorageKey, manualHighlightedRegionIds]);

  const useAuraExpandedAnalysis = Boolean(
    viewportExpanded && analysisOverviewClient,
  );
  const auraMirrorHighlightsActive = useAuraExpandedAnalysis && !useAuraScan;

  const auraHighlightTermsForView = useMemo(() => {
    if (!auraMirrorHighlightsActive) return [];
    return auraIssueHighlights;
  }, [auraMirrorHighlightsActive, auraIssueHighlights]);

  /**
   * Collapsed split: manual regions only (no bulk interested-issues overlay).
   * Expanded: Aura issue highlights or parent terms.
   * Single term from analysis row click works in both layouts.
   */
  const highlightTermsForView = useMemo(() => {
    if (auraMirrorHighlightsActive) return auraHighlightTermsForView;
    if (viewportExpanded) return highlightTerms;
    return highlightTerms.length === 1 ? highlightTerms : [];
  }, [
    auraMirrorHighlightsActive,
    auraHighlightTermsForView,
    viewportExpanded,
    highlightTerms,
  ]);

  /** Manual region picker (photo + 3D + Aura) in split and expanded views. */
  const manualRegionsForView = manualHighlightedRegionIds;

  const hasAnnotations = useMemo(
    () => hasMirrorAnnotationHighlights(highlightTermsForView, manualRegionsForView),
    [highlightTermsForView, manualRegionsForView],
  );

  const toggleAuraIssueHighlight = useCallback((issueName: string, enabled: boolean) => {
    const term = issueToMirrorHighlightTerm(issueName);
    const lower = term.toLowerCase();
    setAuraIssueHighlights((current) => {
      if (enabled) {
        if (current.some((t) => t.toLowerCase() === lower)) return current;
        return [...current, term];
      }
      return current.filter((t) => t.toLowerCase() !== lower);
    });
  }, []);

  const clearAuraIssueHighlights = useCallback(() => {
    setAuraIssueHighlights([]);
  }, []);

  const auraBridge = useMemo((): AuraMirrorHighlightBridge | undefined => {
    if (!useAuraExpandedAnalysis) return undefined;
    return {
      highlightTerms: auraIssueHighlights,
      onToggleIssueHighlight: toggleAuraIssueHighlight,
      onClearIssueHighlights: clearAuraIssueHighlights,
      activeCategory: auraActiveCategory,
      onActiveCategoryChange: setAuraActiveCategory,
      panelCollapsed: auraPanelCollapsed,
      onPanelCollapsedChange: setAuraPanelCollapsed,
    };
  }, [
    useAuraExpandedAnalysis,
    auraIssueHighlights,
    auraActiveCategory,
    auraPanelCollapsed,
    toggleAuraIssueHighlight,
    clearAuraIssueHighlights,
  ]);

  const angleSlots = useMemo((): ClientPhotoSlot[] => {
    if (photoSlots.length > 0) return photoSlots;
    if (photoUrl) return [{ id: "front", label: "Front", url: photoUrl }];
    return [];
  }, [photoSlots, photoUrl]);

  const simplifiedSlots = useMemo(() => simplifyToFrontSideSlots(angleSlots), [angleSlots]);

  const slotKey = useMemo(
    () => simplifiedSlots.map((s) => `${s.id}:${s.url}`).join("|"),
    [simplifiedSlots],
  );

  useEffect(() => { setAngleIdx(0); }, [slotKey]);

  useEffect(() => {
    if (useAuraScan && has3D) setMode("3d");
  }, [useAuraScan, has3D, patientName]);

  const activePhotoUrl = simplifiedSlots[angleIdx]?.url ?? null;
  const hasPhoto = Boolean(activePhotoUrl);
  const showAnglePicker = mode === "photo" && simplifiedSlots.length > 1;
  const canGenerate = !has3D && angleSlots.length > 0 && Boolean(onScanGenerated !== undefined || true);
  const showFsAnalysisOverview = Boolean(viewportExpanded && analysisOverviewClient);
  const overviewSoloSpan = showFsAnalysisOverview && !effectiveVideoUrl && !hasPhoto;

  const photoModalInitialTab = useMemo((): "front" | "side" => {
    const slot = simplifiedSlots[angleIdx];
    if (!slot) return "front";
    return slot.label === "Side" ? "side" : "front";
  }, [simplifiedSlots, angleIdx]);

  const openPatientPhotosSafe = useCallback(
    (initialTab: "front" | "side") => {
      setViewportExpanded(false);
      onOpenPatientPhotos?.(initialTab);
    },
    [onOpenPatientPhotos],
  );

  const toggleAnnotationRegionHighlight = useCallback((regionId: string) => {
    setManualHighlightedRegionIds((current) =>
      current.includes(regionId)
        ? current.filter((id) => id !== regionId)
        : [...current, regionId],
    );
  }, []);

  const toggleAutoRotate3d = useCallback(() => {
    setAutoRotate3d((v) => !v);
  }, []);

  const viewportOverlayProps = {
    showAutoRotate: mode === "3d" && has3D && !useAuraScan,
    autoRotate: autoRotate3d,
    onToggleAutoRotate: toggleAutoRotate3d,
    showHighlightPicker: hasPhoto || has3D,
    manualHighlightedRegionIds,
    onSetManualHighlightedRegionIds: setManualHighlightedRegionIds,
    onToggleAnnotationRegionHighlight: toggleAnnotationRegionHighlight,
  };

  // Keyboard: Escape closes viewport-expanded
  useEffect(() => {
    if (!viewportExpanded) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewportExpanded(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [viewportExpanded]);

  const toggleViewportExpanded = useCallback(() => setViewportExpanded((v) => !v), []);

  // --- Scan generation flow ---

  const SCAN_API = getScanApiBaseUrl();

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  /** Start polling /api/scan/status/:jobId. Call after submit or on remount to resume. */
  const startPolling = useCallback((jobId: string) => {
    type ProgressEvent = {
      status: string;
      progress?: number;
      message?: string;
      remaining?: number;
      videoUrl?: string;
      videoBase64?: string;
      error?: string;
    };

    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${SCAN_API}/api/scan/status/${jobId}`);
        const d = await r.json() as ProgressEvent;

        if (d.status === "done") {
          stopPolling();
          if (airtableRecordId) clearPersistedJob(airtableRecordId);
          let videoUrl = d.videoUrl;
          if (!videoUrl && d.videoBase64) {
            const bytes = Uint8Array.from(atob(d.videoBase64), (c) => c.charCodeAt(0));
            videoUrl = URL.createObjectURL(new Blob([bytes], { type: "video/mp4" }));
          }
          if (videoUrl) {
            setOverrideGlbUrl(videoUrl);
            setScanState({ phase: "done", videoUrl });
            setMode("3d");
            onScanGenerated?.(videoUrl);
            if (airtableRecordId && airtableTableName) {
              fetch(`${SCAN_API}/api/scan/save-video`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jobId, recordId: airtableRecordId, tableName: airtableTableName }),
              })
                .then((r) => r.json())
                .then((saved: { videoUrl?: string }) => {
                  if (saved.videoUrl) {
                    setOverrideGlbUrl(saved.videoUrl);
                    onScanGenerated?.(saved.videoUrl);
                  }
                })
                .catch(() => { /* non-fatal */ });
            }
          }
        } else if (d.status === "error") {
          stopPolling();
          if (airtableRecordId) clearPersistedJob(airtableRecordId);
          setScanState({ phase: "error", message: d.error ?? "Unknown error" });
        } else {
          setScanState({
            phase: "running",
            jobId,
            progress: d.progress ?? 0,
            message: d.message ?? "Working…",
            remaining: d.remaining ?? 0,
          });
        }
      } catch {
        // transient network error — keep polling
      }
    }, 2500);
  }, [SCAN_API, stopPolling, airtableRecordId, airtableTableName, onScanGenerated]);

  /** Submit photos to /api/scan/submit, then poll for progress. */
  const startScan = useCallback(async () => {
    setScanState({ phase: "submitting" });

    const photoMap = mapSlotsToModalPhotos(angleSlots);
    if (Object.keys(photoMap).length === 0) {
      setScanState({ phase: "error", message: "No photos available to submit." });
      return;
    }

    let jobId: string;
    let estimatedSeconds: number;
    try {
      const res = await fetch(`${SCAN_API}/api/scan/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName: patientName, quality: scanQuality, photos: photoMap }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error((body as { error?: string }).error ?? res.statusText);
      }
      const data = await res.json() as { jobId: string; estimatedSeconds: number };
      jobId = data.jobId;
      estimatedSeconds = data.estimatedSeconds ?? 420;
    } catch (err) {
      setScanState({ phase: "error", message: String(err) });
      return;
    }

    setScanState({ phase: "running", jobId, progress: 0.01, message: "Starting…", remaining: estimatedSeconds });

    // Persist so the job survives page navigations
    if (airtableRecordId) {
      savePersistedJob(airtableRecordId, { jobId, quality: scanQuality, estimatedSeconds, startedAt: Date.now() });
    }

    startPolling(jobId);
  }, [angleSlots, patientName, scanQuality, SCAN_API, airtableRecordId, startPolling]);

  // Resume an in-progress scan after remount (e.g. user navigated away and came back)
  const resumeAttemptedRef = useRef(false);
  useEffect(() => {
    if (resumeAttemptedRef.current || !airtableRecordId) return;
    resumeAttemptedRef.current = true;
    const saved = loadPersistedJob(airtableRecordId);
    if (!saved) return;
    const ageSec = (Date.now() - saved.startedAt) / 1000;
    const remaining = Math.max(0, saved.estimatedSeconds - ageSec);
    setScanQuality(saved.quality);
    setScanState({ phase: "running", jobId: saved.jobId, progress: 0.05, message: "Reconnecting…", remaining });
    startPolling(saved.jobId);
  }, [airtableRecordId, startPolling]);

  // Cleanup poll on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const cancelScan = useCallback(() => {
    stopPolling();
    if (airtableRecordId) clearPersistedJob(airtableRecordId);
    setScanState({ phase: "idle" });
  }, [stopPolling, airtableRecordId]);

  // --- Toolbar rendering helper ---

  const expandBtnLabel = analysisOverviewClient
    ? viewportExpanded ? "Exit expanded view (Esc)" : "Expand to fill window — toggle Photo / 3D beside analysis"
    : viewportExpanded ? "Exit expanded view (Esc)" : "Expand to fill window";

  const scanning = scanState.phase === "running" || scanState.phase === "submitting";

  const toolbar = (
    <div className="fmp-toolbar">
      <div className="fmp-toolbar-start">
        {useAuraScan ? (
          <span className="fmp-aura-badge" title="3D turntable scan">
            3D scan
          </span>
        ) : null}
        {has3D && !useAuraScan && scanState.phase !== "running" && (
          <div className="fmp-mode-tabs" role="tablist" aria-label="View mode">
            <button
              role="tab"
              aria-selected={mode === "photo"}
              className={`fmp-tab${mode === "photo" ? " fmp-tab--active" : ""}`}
              onClick={() => setMode("photo")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              Photo
            </button>
            <button
              role="tab"
              aria-selected={mode === "3d"}
              className={`fmp-tab${mode === "3d" ? " fmp-tab--active" : ""}`}
              onClick={() => setMode("3d")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              3D
            </button>
          </div>
        )}

        {/* Progress bar when scan is running */}
        {scanning && (
          <div className="fmp-scan-progress-bar-wrap">
            <div
              className="fmp-scan-progress-bar"
              style={{
                width: `${Math.round(
                  (scanState.phase === "submitting" ? 0.02 : (scanState as { progress: number }).progress) * 100,
                )}%`,
              }}
            />
            <span className="fmp-scan-progress-label">
              {scanState.phase === "submitting"
                ? "Submitting…"
                : `${(scanState as { message: string }).message}  ${formatRemaining((scanState as { remaining: number }).remaining)}`}
            </span>
          </div>
        )}

        {/* Generate button when no 3D and not already scanning */}
        {canGenerate && !has3D && !scanning && scanState.phase !== "config" && (
          <button
            type="button"
            className="fmp-generate-3d-btn"
            onClick={() => setScanState({ phase: "config" })}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            Generate 3D Scan
          </button>
        )}

        {/* Regenerate button when a 3D scan already exists */}
        {has3D && !useAuraScan && angleSlots.length > 0 && !scanning && scanState.phase !== "config" && (
          <button
            type="button"
            className="fmp-regenerate-3d-btn"
            onClick={() => setScanState({ phase: "config" })}
            title="Generate a new 3D scan at a different quality"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 .49-3.93" />
            </svg>
            Regenerate
          </button>
        )}

        {/* Error state */}
        {scanState.phase === "error" && (
          <span className="fmp-scan-error-label" title={scanState.message}>
            Scan failed — <button type="button" className="fmp-scan-retry-link" onClick={() => setScanState({ phase: "idle" })}>retry</button>
          </span>
        )}
      </div>

      <div className="fmp-toolbar-end">
        {scanning && (
          <button type="button" className="fmp-fullscreen-btn" onClick={cancelScan}>
            Cancel
          </button>
        )}
        <button
          type="button"
          className="fmp-fullscreen-btn"
          onClick={toggleViewportExpanded}
          aria-pressed={viewportExpanded}
          title={expandBtnLabel}
        >
          {viewportExpanded ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 5 12 12M19 5 12 12M19 19 12 12M5 19 12 12" />
              </svg>
              Exit expanded
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 3h6v6" />
                <path d="M9 21H3v-6" />
                <path d="M21 15v6h-6" />
                <path d="M3 9V3h6" />
              </svg>
              Expand
            </>
          )}
        </button>
      </div>
    </div>
  );

  // --- Canvas area helpers ---

  const photoStageProps = {
    activePhotoUrl: activePhotoUrl!,
    patientName,
    highlightTerms: highlightTermsForView,
    highlightedRegionIds: manualRegionsForView,
    showAnnotations: hasAnnotations,
    showPatientPhotoGallery,
    onOpenPatientPhotos,
    openPatientPhotosSafe,
    photoModalInitialTab,
    simplifiedSlots,
    angleIdx,
    setAngleIdx,
    showAnglePicker,
  };

  const viewer3D = effectiveVideoUrl ? (
    useAuraScan ? (
      <AuraFaceView
        embedded
        turntableOnly
        videoUrl={effectiveVideoUrl}
        viewerAngleAssets={TANYA_TAN_VIEWER_ANGLE_ASSETS}
        highlightTerms={highlightTermsForView}
        highlightedRegionIds={manualRegionsForView}
      />
    ) : (
      <Face3DViewer
        videoUrl={effectiveVideoUrl}
        autoRotate={autoRotate3d}
        showAnnotations={hasAnnotations}
        highlightTerms={highlightTermsForView}
        highlightedAnnotationRegionIds={manualRegionsForView}
        initialZoom={1.3}
        initialPanY={-70}
      />
    )
  ) : null;

  const placeholderEl = (
    <div className="fmp-placeholder">
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5" aria-hidden>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
      <p>{mode === "photo" ? "No photo available" : "No 3D preview"}</p>
    </div>
  );

  // --- Render ---
  return (
    <div
      className={`fmp-root${viewportExpanded ? " fmp-root--viewport-expanded" : ""}${useAuraScan ? " fmp-root--aura" : ""}`}
    >
      {/* Toolbar: always visible when there's content (has3D or photos or can generate) */}
      {(has3D || hasPhoto || canGenerate) && toolbar}

      {/* Config sheet: slides in between toolbar and body */}
      {scanState.phase === "config" && (
        <ScanConfigPanel
          slots={angleSlots}
          quality={scanQuality}
          onQualityChange={setScanQuality}
          onStart={startScan}
          onCancel={() => setScanState({ phase: "idle" })}
          submitting={false}
        />
      )}

      <div className="fmp-body">
        {showFsAnalysisOverview && analysisOverviewClient ? (
          <div
            className={`fmp-fullscreen-split${auraPanelCollapsed ? " fmp-fullscreen-split--panel-collapsed" : ""}`}
          >
            {mode === "photo" && hasPhoto && activePhotoUrl ? (
              <div className="fmp-fullscreen-split-photo fmp-fullscreen-split-face">
                <div className="fmp-fullscreen-split-photo-inner fmp-canvas-area">
                  <FaceMirrorViewportShell {...viewportOverlayProps}>
                    <FaceMirrorPhotoStage {...photoStageProps} wrapClassName="fmp-photo-stage--in-expanded-split" />
                  </FaceMirrorViewportShell>
                  {auraPanelCollapsed && auraBridge && (
                    <div className="fmp-aura-float-tabs" role="tablist" aria-label="Analysis categories">
                      {AURA_OVERVIEW_TABS.map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          role="tab"
                          aria-selected={auraActiveCategory === tab.key}
                          className={`fmp-aura-float-tab${auraActiveCategory === tab.key ? " fmp-aura-float-tab--active" : ""}`}
                          style={
                            auraActiveCategory === tab.key
                              ? ({ "--aura-tab-accent": tab.accent } as CSSProperties)
                              : undefined
                          }
                          onClick={() => {
                            setAuraActiveCategory(tab.key);
                            setAuraPanelCollapsed(false);
                          }}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : mode === "3d" && effectiveVideoUrl ? (
              <div className="fmp-fullscreen-split-3d fmp-fullscreen-split-face">
                <div className="fmp-fullscreen-split-3d-inner fmp-canvas-area fmp-canvas-area--3d">
                  <FaceMirrorViewportShell {...viewportOverlayProps}>
                    {viewer3D}
                  </FaceMirrorViewportShell>
                  {auraPanelCollapsed && auraBridge && (
                    <div className="fmp-aura-float-tabs" role="tablist" aria-label="Analysis categories">
                      {AURA_OVERVIEW_TABS.map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          role="tab"
                          aria-selected={auraActiveCategory === tab.key}
                          className={`fmp-aura-float-tab${auraActiveCategory === tab.key ? " fmp-aura-float-tab--active" : ""}`}
                          style={
                            auraActiveCategory === tab.key
                              ? ({ "--aura-tab-accent": tab.accent } as CSSProperties)
                              : undefined
                          }
                          onClick={() => {
                            setAuraActiveCategory(tab.key);
                            setAuraPanelCollapsed(false);
                          }}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="fmp-fullscreen-split-placeholder fmp-canvas-area fmp-fullscreen-split-face">
                <div className="fmp-placeholder">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5" aria-hidden>
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <p>{mode === "photo" ? "No photo available" : "No 3D preview"}</p>
                </div>
              </div>
            )}
            <div className={`fmp-fullscreen-split-overview${overviewSoloSpan ? " fmp-fullscreen-split-overview--solo" : ""}`}>
              <AnalysisOverviewModal
                embedded
                client={analysisOverviewClient}
                onClose={() => setViewportExpanded(false)}
                onAddToPlanDirect={analysisOverviewOnAddToPlanDirect}
                auraBridge={auraBridge}
              />
            </div>
          </div>
        ) : (
          <div className={`fmp-canvas-area${mode === "3d" && has3D ? " fmp-canvas-area--3d" : ""}`}>
            {mode === "photo" && (
              hasPhoto && activePhotoUrl
                ? (
                  <FaceMirrorViewportShell {...viewportOverlayProps}>
                    <FaceMirrorPhotoStage {...photoStageProps} />
                  </FaceMirrorViewportShell>
                )
                : placeholderEl
            )}
            {mode === "3d" && has3D && (
              <FaceMirrorViewportShell {...viewportOverlayProps}>
                {viewer3D}
              </FaceMirrorViewportShell>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
