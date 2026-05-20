import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Client, ClientPhotoSlot, DiscussedItem } from "../../types";
import type {
  TreatmentPlanAddDirectOptions,
  TreatmentPlanPrefill,
} from "../modals/DiscussedTreatmentsModal/TreatmentPhotos";
import AnalysisOverviewModal from "../modals/AnalysisOverviewModal";
import { AiMirrorCanvas } from "../postVisitBlueprint/AiMirrorCanvas";
import {
  ADDITIONAL_AI_MIRROR_REGIONS,
  AI_MIRROR_REGIONS,
} from "../postVisitBlueprint/aiMirrorRegions";
import Face3DViewer from "./Face3DViewer";
import blackBgVideoUrl from "../../assets/images/turntable_2048_black.mp4";
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

const DEBUG_ANNOTATION_REGIONS = [
  ...AI_MIRROR_REGIONS,
  ...ADDITIONAL_AI_MIRROR_REGIONS,
];

const ALL_ANNOTATION_REGION_IDS = DEBUG_ANNOTATION_REGIONS.map((region) => region.id);

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
        showAnnotations={true}
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
  const [show3DAnnotations, setShow3DAnnotations] = useState(false);
  const [debugHighlighted3DRegionIds, setDebugHighlighted3DRegionIds] = useState<string[]>([]);
  const [angleIdx, setAngleIdx] = useState(0);
  const [viewportExpanded, setViewportExpanded] = useState(false);

  // --- Scan generation state ---
  const [scanState, setScanState] = useState<ScanState>({ phase: "idle" });
  const [scanQuality, setScanQuality] = useState<ScanQuality>("standard");
  const [overrideGlbUrl, setOverrideGlbUrl] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Test toggle: swap the normal video for the black-bg version to preview dark mode
  const [useBlackBgVideo, setUseBlackBgVideo] = useState(false);

  // The effective video URL: override (from a just-completed generation) wins over the prop
  const baseVideoUrl = overrideGlbUrl ?? videoUrlProp ?? null;
  const effectiveVideoUrl = useBlackBgVideo && baseVideoUrl ? blackBgVideoUrl : baseVideoUrl;
  const has3D = Boolean(effectiveVideoUrl);

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

  const toggle3DAnnotationRegionHighlight = useCallback((regionId: string) => {
    setDebugHighlighted3DRegionIds((current) =>
      current.includes(regionId)
        ? current.filter((id) => id !== regionId)
        : [...current, regionId],
    );
  }, []);

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

  // In production VITE_SCAN_API_URL = "https://ponce-patient-backend.vercel.app"
  // In local dev leave it unset — the Vite proxy forwards /api/* to server.py on port 8787
  const SCAN_API = (import.meta.env.VITE_SCAN_API_URL as string | undefined) ?? "";

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  /** Submit photos to /api/scan/submit, then poll /api/scan/status/:jobId for progress. */
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
        body: JSON.stringify({
          clientName: patientName,
          quality: scanQuality,
          photos: photoMap,
        }),
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

    // Poll for progress every 2.5 s (works with both local server.py and Modal via backend)
    stopPolling();
    pollRef.current = setInterval(async () => {
      type ProgressEvent = {
        status: string;
        progress?: number;
        message?: string;
        remaining?: number;
        videoUrl?: string;
        videoBase64?: string;
        error?: string;
      };
      try {
        const r = await fetch(`${SCAN_API}/api/scan/status/${jobId}`);
        const d = await r.json() as ProgressEvent;

        if (d.status === "done") {
          stopPolling();
          // Local server.py returns videoUrl; Modal endpoint returns videoBase64
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
            // Persist to GCS + Airtable so the scan survives page reloads and works across devices
            if (airtableRecordId && airtableTableName && airtableTableName === "Patients") {
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
                .catch(() => { /* non-fatal — blob URL still works locally */ });
            }
          }
        } else if (d.status === "error") {
          stopPolling();
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
  }, [angleSlots, patientName, scanQuality, onScanGenerated, SCAN_API, stopPolling]);

  // Cleanup poll on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const cancelScan = useCallback(() => {
    stopPolling();
    setScanState({ phase: "idle" });
  }, [stopPolling]);

  // --- Toolbar rendering helper ---

  const expandBtnLabel = analysisOverviewClient
    ? viewportExpanded ? "Exit expanded view (Esc)" : "Expand to fill window — toggle Photo / 3D beside analysis"
    : viewportExpanded ? "Exit expanded view (Esc)" : "Expand to fill window";

  const scanning = scanState.phase === "running" || scanState.phase === "submitting";

  const toolbar = (
    <div className="fmp-toolbar">
      <div className="fmp-toolbar-start">
        {has3D && scanState.phase !== "running" && (
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
        {has3D && angleSlots.length > 0 && !scanning && scanState.phase !== "config" && (
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
        {mode === "3d" && has3D && (
          <>
            <label className="fmp-auto-rotate">
              <input type="checkbox" checked={autoRotate3d} onChange={(e) => setAutoRotate3d(e.target.checked)} />
              <span>Auto-rotate</span>
            </label>
            <label className="fmp-auto-rotate">
              <input type="checkbox" checked={show3DAnnotations} onChange={(e) => setShow3DAnnotations(e.target.checked)} />
              <span>Annotate</span>
            </label>
            <button
              type="button"
              className={`fmp-fullscreen-btn${useBlackBgVideo ? " fmp-fullscreen-btn--active" : ""}`}
              onClick={() => setUseBlackBgVideo((v) => !v)}
              title={useBlackBgVideo ? "Switch to normal video" : "Switch to black-bg video"}
            >
              {useBlackBgVideo ? "⬛ Black bg" : "⬜ Black bg"}
            </button>
            {show3DAnnotations && (
              <details className="fmp-annotation-regions">
                <summary>Highlight</summary>
                <div className="fmp-annotation-regions__panel">
                  <div className="fmp-annotation-regions__actions">
                    <button
                      type="button"
                      onClick={() => setDebugHighlighted3DRegionIds(ALL_ANNOTATION_REGION_IDS)}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setDebugHighlighted3DRegionIds([])}
                    >
                      None
                    </button>
                  </div>
                  <div className="fmp-annotation-regions__grid">
                    {DEBUG_ANNOTATION_REGIONS.map((region) => (
                      <label key={region.id} className="fmp-annotation-regions__item">
                        <input
                          type="checkbox"
                          checked={debugHighlighted3DRegionIds.includes(region.id)}
                          onChange={() => toggle3DAnnotationRegionHighlight(region.id)}
                        />
                        <span>{ANNOTATION_REGION_LABELS[region.id] ?? region.id}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </details>
            )}
          </>
        )}
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
    highlightTerms,
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
    <Face3DViewer
      videoUrl={effectiveVideoUrl}
      autoRotate={autoRotate3d}
      showAnnotations={show3DAnnotations}
      highlightTerms={highlightTerms}
      highlightedAnnotationRegionIds={debugHighlighted3DRegionIds}
      pingPongLoop={useBlackBgVideo}
    />
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
    <div className={`fmp-root${viewportExpanded ? " fmp-root--viewport-expanded" : ""}`}>
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
          <div className="fmp-fullscreen-split">
            {mode === "photo" && hasPhoto && activePhotoUrl ? (
              <div className="fmp-fullscreen-split-photo">
                <div className="fmp-fullscreen-split-photo-inner fmp-canvas-area">
                  <FaceMirrorPhotoStage {...photoStageProps} wrapClassName="fmp-photo-stage--in-expanded-split" />
                </div>
              </div>
            ) : mode === "3d" && effectiveVideoUrl ? (
              <div className="fmp-fullscreen-split-3d">
                <div className="fmp-fullscreen-split-3d-inner fmp-canvas-area fmp-canvas-area--3d">
                  {viewer3D}
                </div>
              </div>
            ) : (
              <div className="fmp-fullscreen-split-placeholder fmp-canvas-area">
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
              />
            </div>
          </div>
        ) : (
          <div className={`fmp-canvas-area${mode === "3d" && has3D ? " fmp-canvas-area--3d" : ""}`}>
            {mode === "photo" && (
              hasPhoto && activePhotoUrl
                ? <FaceMirrorPhotoStage {...photoStageProps} />
                : placeholderEl
            )}
            {mode === "3d" && has3D && viewer3D}
          </div>
        )}
      </div>
    </div>
  );
}
