import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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
import AutoRotateHeadIcon from "../common/AutoRotateHeadIcon";
import Face3DViewer from "./Face3DViewer";
import FaceMirrorRegionsPicker, {
  ALL_MIRROR_ANNOTATION_REGION_IDS,
} from "./FaceMirrorRegionsPicker";
import AuraFaceView, { type AnnotateSavePayload } from "../aura/AuraFaceView";
import type { AnnotateStroke } from "../aura/AnnotateDrawing";
import {
  clientUsesAuraInterface,
  clientUsesAuraScan,
} from "../../utils/auraScanConfig";
import {
  savePatientAnnotation,
  type SavedPatientAnnotation,
} from "../../utils/patientAnnotationsStorage";
import {
  buildViewerAngleAssetsFromManifest,
  fetchPatientAuraManifestFromConfiguredBucket,
  fetchPatientAuraManifestFromDisk,
  fetchPatientAuraManifestFromGcs,
  fetchPatientAuraManifestFromGcsPrefix,
  fetchPatientAuraManifestFromUrl,
  getAvailableViewAngles,
  getPatientAuraManifest,
  setPatientAuraManifest,
  type PatientAuraAssetManifest,
} from "../../utils/patientAuraAssets";
import {
  buildViewerAngleAssetsFromPhotoSlots,
  inferAvailableViewAnglesFromPhotoSlots,
  TANYA_TAN_VIEWER_ANGLE_ASSETS,
} from "../../utils/auraTanAnglePhotos";
import {
  issueToMirrorHighlightTerm,
  type AuraOverviewCategoryKey,
  type AuraSkinLens,
} from "../../utils/auraAnalysisBridge";
import type { AuraMirrorHighlightBridge } from "./AuraEmbeddedAnalysisPanel";
import {
  faceMirrorHighlightStorageKey,
  loadFaceMirrorHighlightedRegions,
  saveFaceMirrorHighlightedRegions,
} from "../../utils/faceMirrorHighlightStorage";
import { fetchScanJobStatus, getScanApiBaseUrl } from "../../utils/scanApi";
import "./FaceMirrorPanel.css";

// ---------------------------------------------------------------------------
// 3D Scan generation types
// ---------------------------------------------------------------------------
/** Set to true to re-enable the Generate 3D Scan toolbar button and config panel. */
const GENERATE_3D_SCAN_ENABLED = true;

type ScanQuality = "ultra" | "draft" | "standard" | "high";

const QUALITY_LABELS: Record<
  ScanQuality,
  { label: string; time: string; desc: string }
> = {
  ultra: {
    label: "Ultra-fast",
    time: "~1 min",
    desc: "Fastest — lower fidelity, warm GPU required",
  },
  draft: { label: "Draft", time: "~2 min", desc: "Faster, lower fidelity" },
  standard: {
    label: "Standard",
    time: "~3–4 min",
    desc: "Balanced quality (recommended)",
  },
  high: { label: "High", time: "~5–6 min", desc: "Best detail, longest wait" },
};

type ScanState =
  | { phase: "idle" }
  | { phase: "config" }
  | { phase: "submitting" }
  | {
      phase: "running";
      jobId: string;
      progress: number;
      message: string;
      remaining: number;
    }
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
  try {
    localStorage.setItem(scanJobKey(recordId), JSON.stringify(job));
  } catch {
    /* storage full */
  }
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
  } catch {
    return null;
  }
}

function clearPersistedJob(recordId: string): void {
  try {
    localStorage.removeItem(scanJobKey(recordId));
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Photo slot → Modal photo-key mapping
// ---------------------------------------------------------------------------
function mapSlotsToModalPhotos(
  slots: ClientPhotoSlot[],
): Record<string, string> {
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
    if (blob.includes("left") && blob.includes("90")) base = "left90";
    else if (blob.includes("right") && blob.includes("90")) base = "right90";
    else if (blob.includes("left") && blob.includes("45")) base = "left45";
    else if (blob.includes("right") && blob.includes("45")) base = "right45";
    else if (blob.includes("left")) base = "left90";
    else if (blob.includes("right")) base = "right90";
    else base = "extra";

    const n = keyCount[base] ?? 0;
    photos[n === 0 ? base : `${base}_${n}`] = slot.url;
    keyCount[base] = n + 1;
  }

  return photos;
}

function formatRemaining(seconds: number): string {
  if (seconds <= 0) return "still working…";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s remaining` : `${s}s remaining`;
}

// ---------------------------------------------------------------------------
// Helpers copied from original FaceMirrorPanel
// ---------------------------------------------------------------------------
type ViewMode = "photo" | "3d";

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
        (lower(s.id).includes("front") ||
          (s.label && lower(s.label).includes("front"))),
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

  const side =
    sideNonIntake ??
    others.find((s) => lower(s.id).startsWith("side")) ??
    others[0];
  return [
    { ...front, label: "Front" },
    { ...side, label: "Side" },
  ];
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
  wrapClassName,
}: {
  activePhotoUrl: string;
  patientName: string;
  highlightTerms: string[];
  highlightedRegionIds: string[];
  showAnnotations: boolean;
  wrapClassName?: string;
}) {
  return (
    <div
      className={
        wrapClassName ? `fmp-photo-stage ${wrapClassName}` : "fmp-photo-stage"
      }
    >
      <AiMirrorCanvas
        imageUrl={activePhotoUrl}
        alt={`${patientName} facial analysis`}
        highlightTerms={highlightTerms}
        highlightedRegionIds={highlightedRegionIds}
        showAnnotations={showAnnotations}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overlay controls (auto-rotate, highlight) on photo / 3D viewport
// ---------------------------------------------------------------------------
function FaceMirrorViewportShell({ children }: { children: ReactNode }) {
  return <div className="fmp-viewport">{children}</div>;
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
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
        Generate 3D Scan
      </div>

      <div className="fmp-scan-config-row">
        <span className="fmp-scan-config-label">Quality</span>
        <div className="fmp-scan-quality-options">
          {(["ultra", "draft", "standard", "high"] as ScanQuality[]).map(
            (q) => (
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
                <span className="fmp-scan-quality-name">
                  {QUALITY_LABELS[q].label}
                </span>
                <span className="fmp-scan-quality-time">
                  {QUALITY_LABELS[q].time}
                </span>
              </label>
            ),
          )}
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
        <button
          type="button"
          className="fmp-scan-cancel-btn"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="button"
          className="fmp-scan-start-btn"
          onClick={onStart}
          disabled={submitting || photoCount === 0}
        >
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
  analysisOverviewOnOpenTreatmentRecommender?: (
    issue?: string,
    category?: AuraOverviewCategoryKey,
  ) => void;
  /** Optional lower-right content rendered under embedded Analysis Overview in expanded split mode. */
  expandedLowerRightContent?: ReactNode;
  onOpenPlanBuilder?: () => void;
  /** Fires whenever the Aura analysis tab (Skin / Volume / Structure) changes. */
  onAuraActiveCategoryChange?: (category: AuraOverviewCategoryKey) => void;
  /** Called when a new turntable video has been generated for this client. */
  onScanGenerated?: (result: {
    videoUrl: string;
    auraAssets?: PatientAuraAssetManifest;
  }) => void;
  auraManifestUrl?: string | null;
  auraGcsPrefix?: string | null;
  initialAuraManifest?: PatientAuraAssetManifest | null;
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
  analysisOverviewOnOpenTreatmentRecommender,
  expandedLowerRightContent,
  onOpenPlanBuilder,
  onAuraActiveCategoryChange,
  onScanGenerated,
  auraManifestUrl,
  auraGcsPrefix,
  initialAuraManifest,
}: FaceMirrorPanelProps) {
  // --- Existing state ---
  const [mode, setMode] = useState<ViewMode>("photo");
  const [autoRotate3d, setAutoRotate3d] = useState(true);
  const highlightStorageKey = faceMirrorHighlightStorageKey(
    airtableRecordId,
    patientName,
  );
  const [manualHighlightedRegionIds, setManualHighlightedRegionIds] = useState<
    string[]
  >(() =>
    loadFaceMirrorHighlightedRegions(
      highlightStorageKey,
      ALL_MIRROR_ANNOTATION_REGION_IDS,
    ),
  );
  const [angleIdx, setAngleIdx] = useState(0);
  const [viewportExpanded, setViewportExpanded] = useState(false);
  const [auraPanelCollapsed, setAuraPanelCollapsed] = useState(false);
  const [auraActiveCategory, setAuraActiveCategory] =
    useState<AuraOverviewCategoryKey>("skinHealth");
  const [auraActiveSkinLens, setAuraActiveSkinLens] =
    useState<AuraSkinLens>("texture");
  const [auraIssueHighlights, setAuraIssueHighlights] = useState<string[]>([]);
  const [annotateStrokes, setAnnotateStrokes] = useState<AnnotateStroke[]>([]);
  const [annotationsRefreshKey, setAnnotationsRefreshKey] = useState(0);
  // --- Scan generation state ---
  const [scanState, setScanState] = useState<ScanState>({ phase: "idle" });
  const [scanQuality, setScanQuality] = useState<ScanQuality>("draft");
  const [overrideGlbUrl, setOverrideGlbUrl] = useState<string | null>(null);
  const [patientAuraManifest, setPatientAuraManifestState] =
    useState<PatientAuraAssetManifest | null>(() =>
      initialAuraManifest ?? getPatientAuraManifest(patientName),
    );
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewVideoUrlRef = useRef<string | null>(null);

  const applyPreviewVideo = useCallback((videoUrl: string) => {
    if (previewVideoUrlRef.current === videoUrl) return;
    previewVideoUrlRef.current = videoUrl;
    setOverrideGlbUrl(videoUrl);
    setMode("3d");
    // Don't expand the viewport here — the progress bar and the AuraFaceView
    // topbar would overlap. Expansion happens when the scan fully completes.
    const preload = document.createElement("video");
    preload.preload = "auto";
    preload.src = videoUrl;
  }, []);

  useEffect(() => {
    setPatientAuraManifestState(initialAuraManifest ?? getPatientAuraManifest(patientName));
  }, [patientName, initialAuraManifest]);

  useEffect(() => {
    const onAuraAssetsChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ clientName?: string }>).detail;
      if (detail?.clientName === patientName.trim()) {
        setPatientAuraManifestState(getPatientAuraManifest(patientName));
      }
    };
    window.addEventListener("patient-aura-assets-changed", onAuraAssetsChanged);
    return () =>
      window.removeEventListener(
        "patient-aura-assets-changed",
        onAuraAssetsChanged,
      );
  }, [patientName]);

  const effectiveVideoUrl = overrideGlbUrl ?? videoUrlProp ?? null;
  const has3D = Boolean(effectiveVideoUrl);
  const useAuraScan = clientUsesAuraInterface(effectiveVideoUrl);
  // Also activate the Aura UI when the patient has a pre-generated manifest
  // with angle photos (e.g. photos-only patient before the turntable is ready).
  const hasAuraManifestPhotos = Boolean(
    patientAuraManifest?.angles &&
    Object.keys(patientAuraManifest.angles).length > 0,
  );
  const useAuraView = useAuraScan || hasAuraManifestPhotos;
  const patientGeneratedAura = useAuraView && !clientUsesAuraScan(patientName);

  useEffect(() => {
    if (clientUsesAuraScan(patientName)) return;
    // Always refetch when a manifest URL is known so localStorage cannot hide new wrinkle assets.
    const hasPhotos = photoSlots.length > 0 || Boolean(photoUrl);
    const hasAuraAssetLink = Boolean(auraManifestUrl?.trim() || auraGcsPrefix?.trim());
    if (!effectiveVideoUrl && !hasPhotos && !hasAuraAssetLink) return;
    let cancelled = false;
    const isGcsUrl = effectiveVideoUrl?.startsWith("https://storage.googleapis.com");
    void (async () => {
      let manifest: PatientAuraAssetManifest | null = null;
      if (auraManifestUrl?.trim()) {
        manifest = await fetchPatientAuraManifestFromUrl(patientName, auraManifestUrl);
      }
      if (!manifest) {
        manifest = await fetchPatientAuraManifestFromGcsPrefix(patientName, auraGcsPrefix);
      }
      if (isGcsUrl) {
        manifest = manifest ?? await fetchPatientAuraManifestFromGcs(patientName, effectiveVideoUrl!);
      }
      if (!manifest) {
        manifest = await fetchPatientAuraManifestFromConfiguredBucket(patientName);
      }
      if (!manifest) {
        manifest = await fetchPatientAuraManifestFromDisk(patientName);
      }
      if (!cancelled && manifest) {
        setPatientAuraManifestState(manifest);
        if (!videoUrlProp && manifest.turntableVideoUrl) {
          setOverrideGlbUrl(manifest.turntableVideoUrl);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    patientName,
    effectiveVideoUrl,
    videoUrlProp,
    auraManifestUrl,
    auraGcsPrefix,
    photoSlots.length,
    photoUrl,
  ]);

  useEffect(() => {
    setManualHighlightedRegionIds(
      loadFaceMirrorHighlightedRegions(
        highlightStorageKey,
        ALL_MIRROR_ANNOTATION_REGION_IDS,
      ),
    );
  }, [highlightStorageKey]);

  useEffect(() => {
    saveFaceMirrorHighlightedRegions(
      highlightStorageKey,
      manualHighlightedRegionIds,
    );
  }, [highlightStorageKey, manualHighlightedRegionIds]);

  useEffect(() => {
    onAuraActiveCategoryChange?.(auraActiveCategory);
  }, [auraActiveCategory, onAuraActiveCategoryChange]);

  const useAuraExpandedAnalysis = Boolean(
    viewportExpanded && analysisOverviewClient,
  );
  /** Expanded analysis panel: issue eye toggles → mirror / 3D region highlights. */
  const auraMirrorHighlightsActive = useAuraExpandedAnalysis;

  const auraHighlightTermsForView = useMemo(() => {
    if (!auraMirrorHighlightsActive) return [];
    return auraIssueHighlights;
  }, [auraMirrorHighlightsActive, auraIssueHighlights]);

  /**
   * Collapsed split: manual regions only (no bulk interested-issues overlay).
   * Expanded: issue eye toggles (Aura panel) or parent terms.
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
    () =>
      hasMirrorAnnotationHighlights(
        highlightTermsForView,
        manualRegionsForView,
      ),
    [highlightTermsForView, manualRegionsForView],
  );

  const toggleAuraIssueHighlight = useCallback(
    (issueName: string, enabled: boolean) => {
      const term = issueToMirrorHighlightTerm(issueName);
      const lower = term.toLowerCase();
      setAuraIssueHighlights((current) => {
        if (enabled) {
          if (current.some((t) => t.toLowerCase() === lower)) return current;
          return [...current, term];
        }
        return current.filter((t) => t.toLowerCase() !== lower);
      });
    },
    [],
  );

  const clearAuraIssueHighlights = useCallback(() => {
    setAuraIssueHighlights([]);
  }, []);

  const handleSaveAnnotation = useCallback(
    (payload: AnnotateSavePayload) => {
      const clientId = analysisOverviewClient?.id;
      if (!clientId) return;
      const stamp = new Date().toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
      savePatientAnnotation({
        clientId,
        label: `${payload.viewContext} · ${stamp}`,
        viewContext: payload.viewContext,
        strokes: payload.strokes,
        faceImageUrl: payload.faceImageUrl,
        compositeDataUrl: payload.compositeDataUrl,
      });
      setAnnotationsRefreshKey((k) => k + 1);
      window.dispatchEvent(
        new CustomEvent("patient-annotations-changed", {
          detail: { clientId },
        }),
      );
    },
    [analysisOverviewClient?.id],
  );

  const handleLoadAnnotation = useCallback((record: SavedPatientAnnotation) => {
    setAnnotateStrokes(record.strokes);
  }, []);

  useEffect(() => {
    const clientId = analysisOverviewClient?.id;
    if (!clientId) return undefined;
    const onChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ clientId?: string }>).detail;
      if (detail?.clientId && detail.clientId !== clientId) return;
      setAnnotationsRefreshKey((k) => k + 1);
    };
    const onLoadRequest = (e: Event) => {
      const detail = (
        e as CustomEvent<{ clientId: string; record: SavedPatientAnnotation }>
      ).detail;
      if (!detail || detail.clientId !== clientId) return;
      handleLoadAnnotation(detail.record);
      setViewportExpanded(true);
    };
    window.addEventListener("patient-annotations-changed", onChanged);
    window.addEventListener("patient-annotation-load-request", onLoadRequest);
    return () => {
      window.removeEventListener("patient-annotations-changed", onChanged);
      window.removeEventListener(
        "patient-annotation-load-request",
        onLoadRequest,
      );
    };
  }, [analysisOverviewClient?.id, handleLoadAnnotation]);

  const angleSlots = useMemo((): ClientPhotoSlot[] => {
    if (photoSlots.length > 0) return photoSlots;
    if (photoUrl) return [{ id: "front", label: "Front", url: photoUrl }];
    return [];
  }, [photoSlots, photoUrl]);

  const viewerAngleAssets = useMemo(() => {
    if (clientUsesAuraScan(patientName)) return TANYA_TAN_VIEWER_ANGLE_ASSETS;
    const slotAssets = buildViewerAngleAssetsFromPhotoSlots(angleSlots);
    if (!patientAuraManifest?.angles) return slotAssets;

    const fallback = angleSlots.find((s) => s.url)?.url ?? "";
    const assets = buildViewerAngleAssetsFromManifest(
      patientAuraManifest,
      fallback,
    );
    const photoBackedAngles = new Set(
      inferAvailableViewAnglesFromPhotoSlots(angleSlots),
    );
    const avail = getAvailableViewAngles(patientAuraManifest, angleSlots);
    for (const angle of avail ?? []) {
      const slotSrc = slotAssets[angle]?.src;
      if (!slotSrc) continue;
      const manifestAngle = patientAuraManifest.angles[angle];
      if (photoBackedAngles.has(angle)) {
        if (manifestAngle?.fromPhoto) continue;
        assets[angle] = {
          ...assets[angle],
          src: slotSrc,
          srcTexture: slotSrc,
          srcPigmentation: slotSrc,
        };
        continue;
      }
      if (manifestAngle?.fromPhoto) continue;
      if (manifestAngle?.src && manifestAngle.src !== fallback) continue;
      assets[angle] = {
        ...assets[angle],
        src: slotSrc,
        srcTexture: assets[angle].srcTexture ?? slotSrc,
      };
    }
    return assets;
  }, [patientName, angleSlots, patientAuraManifest]);

  const availableViewAngles = useMemo(
    () =>
      clientUsesAuraScan(patientName)
        ? undefined
        : getAvailableViewAngles(patientAuraManifest, angleSlots),
    [patientName, patientAuraManifest, angleSlots],
  );

  const simplifiedSlots = useMemo(
    () => simplifyToFrontSideSlots(angleSlots),
    [angleSlots],
  );

  const slotKey = useMemo(
    () => simplifiedSlots.map((s) => `${s.id}:${s.url}`).join("|"),
    [simplifiedSlots],
  );

  useEffect(() => {
    setAngleIdx(0);
  }, [slotKey]);

  useEffect(() => {
    if (useAuraView && has3D) setMode("3d");
  }, [useAuraView, has3D, patientName]);

  const activePhotoUrl = simplifiedSlots[angleIdx]?.url ?? null;
  const hasPhoto = Boolean(activePhotoUrl);
  const showAnglePicker = mode === "photo" && simplifiedSlots.length > 1;
  const canGenerate =
    !has3D &&
    angleSlots.length > 0 &&
    Boolean(onScanGenerated !== undefined || true);
  const showFsAnalysisOverview = Boolean(
    viewportExpanded && analysisOverviewClient,
  );
  const overviewSoloSpan =
    showFsAnalysisOverview && !effectiveVideoUrl && !hasPhoto;

  const photoModalInitialTab = useMemo((): "front" | "side" => {
    const slot = simplifiedSlots[angleIdx];
    if (!slot) return "front";
    return slot.label === "Side" ? "side" : "front";
  }, [simplifiedSlots, angleIdx]);

  const auraBridge = useMemo((): AuraMirrorHighlightBridge | undefined => {
    if (!useAuraExpandedAnalysis || !analysisOverviewClient) return undefined;
    return {
      highlightTerms: auraIssueHighlights,
      onToggleIssueHighlight: toggleAuraIssueHighlight,
      onClearIssueHighlights: clearAuraIssueHighlights,
      activeCategory: auraActiveCategory,
      onActiveCategoryChange: setAuraActiveCategory,
      activeSkinLens: auraActiveSkinLens,
      onActiveSkinLensChange: setAuraActiveSkinLens,
      panelCollapsed: auraPanelCollapsed,
      onPanelCollapsedChange: setAuraPanelCollapsed,
      patientFiles: {
        photoSlots: angleSlots,
        turntableVideoUrl: effectiveVideoUrl,
        annotationsRefreshKey,
        onLoadAnnotation: handleLoadAnnotation,
      },
    };
  }, [
    useAuraExpandedAnalysis,
    analysisOverviewClient,
    auraIssueHighlights,
    auraActiveCategory,
    auraActiveSkinLens,
    auraPanelCollapsed,
    toggleAuraIssueHighlight,
    clearAuraIssueHighlights,
    angleSlots,
    effectiveVideoUrl,
    annotationsRefreshKey,
    handleLoadAnnotation,
  ]);

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

  const showToolbarRegions = (hasPhoto || has3D) && !useAuraView;
  const showToolbarRotate = mode === "3d" && has3D && !useAuraView;
  const showToolbarAnglePicker = mode === "photo" && showAnglePicker;
  const showToolbarGallery = Boolean(
    showPatientPhotoGallery && onOpenPatientPhotos,
  );
  const showToolbarTools =
    showToolbarRegions || showToolbarRotate || showToolbarGallery;

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

  const toggleViewportExpanded = useCallback(
    () => setViewportExpanded((v) => !v),
    [],
  );

  // --- Scan generation flow ---

  const SCAN_API = getScanApiBaseUrl();

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  /** Start polling /api/scan/status/:jobId. Call after submit or on remount to resume. */
  const startPolling = useCallback(
    (jobId: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const d = await fetchScanJobStatus(SCAN_API, jobId);
          if (!d) return;

          if (d.status === "done") {
            stopPolling();
            if (airtableRecordId) clearPersistedJob(airtableRecordId);
            let videoUrl = d.videoUrl;
            if (!videoUrl && d.videoBase64) {
              const bytes = Uint8Array.from(atob(d.videoBase64), (c) =>
                c.charCodeAt(0),
              );
              videoUrl = URL.createObjectURL(
                new Blob([bytes], { type: "video/mp4" }),
              );
            }
            if (videoUrl) {
              const auraAssets = d.auraAssets as
                | PatientAuraAssetManifest
                | undefined;
              if (auraAssets) {
                setPatientAuraManifestState(auraAssets);
                setPatientAuraManifest(patientName, auraAssets);
              }
              setOverrideGlbUrl(videoUrl);
              setScanState({ phase: "done", videoUrl });
              setMode("3d");
              setViewportExpanded(true);
              onScanGenerated?.({ videoUrl, auraAssets });
              const savedAuraAssets = auraAssets;
              if (airtableRecordId && airtableTableName) {
                fetch(`${SCAN_API}/api/scan/save-video`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    jobId,
                    recordId: airtableRecordId,
                    tableName: airtableTableName,
                  }),
                })
                  .then((r) => r.json())
                  .then(
                    (saved: {
                      videoUrl?: string;
                      auraAssets?: PatientAuraAssetManifest;
                    }) => {
                      if (saved.auraAssets) {
                        setPatientAuraManifestState(saved.auraAssets);
                        setPatientAuraManifest(patientName, saved.auraAssets);
                      }
                      if (saved.videoUrl) {
                        setOverrideGlbUrl(saved.videoUrl);
                        onScanGenerated?.({
                          videoUrl: saved.videoUrl,
                          auraAssets: saved.auraAssets ?? savedAuraAssets,
                        });
                      }
                    },
                  )
                  .catch(() => {
                    /* non-fatal */
                  });
              }
            }
          } else if (d.status === "error") {
            stopPolling();
            if (airtableRecordId) clearPersistedJob(airtableRecordId);
            setScanState({
              phase: "error",
              message: d.error ?? "Unknown error",
            });
          } else {
            if (d.videoUrl) {
              applyPreviewVideo(d.videoUrl);
            }
            if (d.auraAssets) {
              const partialAura = d.auraAssets as PatientAuraAssetManifest;
              setPatientAuraManifestState(partialAura);
              setPatientAuraManifest(patientName, partialAura);
            }
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
      }, 1000);
    },
    [
      SCAN_API,
      stopPolling,
      airtableRecordId,
      airtableTableName,
      onScanGenerated,
      patientName,
      applyPreviewVideo,
    ],
  );

  /** Submit photos to /api/scan/submit, then poll for progress. */
  const startScan = useCallback(async (qualityOverride?: ScanQuality) => {
    const quality = qualityOverride ?? scanQuality;
    previewVideoUrlRef.current = null;
    setScanState({ phase: "submitting" });

    const photoMap = mapSlotsToModalPhotos(angleSlots);
    if (Object.keys(photoMap).length === 0) {
      setScanState({
        phase: "error",
        message: "No photos available to submit.",
      });
      return;
    }

    // Resolve relative URLs to absolute so the Modal pipeline can download them.
    const absolutePhotoMap = Object.fromEntries(
      Object.entries(photoMap).map(([key, url]) => [
        key,
        url.startsWith("http") ? url : new URL(url, window.location.href).href,
      ]),
    );

    let jobId: string;
    let estimatedSeconds: number;
    try {
      const res = await fetch(`${SCAN_API}/api/scan/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: patientName,
          quality,
          photos: absolutePhotoMap,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error((body as { error?: string }).error ?? res.statusText);
      }
      const data = (await res.json()) as {
        jobId: string;
        estimatedSeconds: number;
      };
      jobId = data.jobId;
      estimatedSeconds = data.estimatedSeconds ?? 420;
    } catch (err) {
      setScanState({ phase: "error", message: String(err) });
      return;
    }

    setScanState({
      phase: "running",
      jobId,
      progress: 0.01,
      message: "Starting…",
      remaining: estimatedSeconds,
    });

    // Persist so the job survives page navigations
    if (airtableRecordId) {
      savePersistedJob(airtableRecordId, {
        jobId,
        quality,
        estimatedSeconds,
        startedAt: Date.now(),
      });
    }

    startPolling(jobId);
  }, [
    angleSlots,
    patientName,
    scanQuality,
    SCAN_API,
    airtableRecordId,
    startPolling,
  ]);

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
    setScanState({
      phase: "running",
      jobId: saved.jobId,
      progress: 0.05,
      message: "Reconnecting…",
      remaining,
    });
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

  const expandBtnLabel = viewportExpanded
    ? "Hide analysis (Esc)"
    : "Show analysis";

  const expandAnalysisButton = (
    <button
      type="button"
      className="fmp-fullscreen-btn"
      onClick={toggleViewportExpanded}
      aria-pressed={viewportExpanded}
      title={expandBtnLabel}
    >
      {viewportExpanded ? (
        <>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M5 5 12 12M19 5 12 12M19 19 12 12M5 19 12 12" />
          </svg>
          Hide analysis
        </>
      ) : (
        <>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M15 3h6v6" />
            <path d="M9 21H3v-6" />
            <path d="M21 15v6h-6" />
            <path d="M3 9V3h6" />
          </svg>
          Show analysis
        </>
      )}
    </button>
  );

  const auraExpandedTopbarEnd =
    useAuraView && viewportExpanded ? expandAnalysisButton : undefined;

  const scanning =
    scanState.phase === "running" || scanState.phase === "submitting";

  const showOverlayToolbar =
    (has3D || hasPhoto || canGenerate) &&
    // For bundled-demo patients (Tanya) collapse the toolbar chrome in the
    // expanded analysis view; real patients always need the toolbar so they
    // can regenerate their scan.
    !(clientUsesAuraScan(patientName) && viewportExpanded && !scanning);

  const toolbar = (
    <div className="fmp-toolbar">
      <div className="fmp-toolbar-start">
        {useAuraView && !has3D && !hasAuraManifestPhotos ? (
          <span className="fmp-aura-badge" title="3D turntable scan">
            3D scan
          </span>
        ) : null}
        {has3D && !useAuraView && scanState.phase !== "running" && (
          <div className="fmp-mode-tabs" role="tablist" aria-label="View mode">
            <button
              role="tab"
              aria-selected={mode === "3d"}
              className={`fmp-tab${mode === "3d" ? " fmp-tab--active" : ""}`}
              onClick={() => setMode("3d")}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              3D
            </button>
            <button
              role="tab"
              aria-selected={mode === "photo"}
              className={`fmp-tab${mode === "photo" ? " fmp-tab--active" : ""}`}
              onClick={() => setMode("photo")}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              Photo
            </button>
          </div>
        )}

        {showToolbarAnglePicker ? (
          <>
            {has3D && !useAuraView ? (
              <span className="fmp-toolbar-divider" aria-hidden />
            ) : null}
            <div
              className="fmp-mode-tabs"
              role="tablist"
              aria-label="Photo angle"
            >
              {simplifiedSlots.map((slot, i) => (
                <button
                  key={`${slot.url}-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={i === angleIdx}
                  className={`fmp-tab${i === angleIdx ? " fmp-tab--active" : ""}`}
                  onClick={() => setAngleIdx(i)}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          </>
        ) : null}

        {scanning && (
          <div className="fmp-scan-progress-bar-wrap">
            <div
              className="fmp-scan-progress-bar"
              style={{
                width: `${Math.round(
                  (scanState.phase === "submitting"
                    ? 0.02
                    : (scanState as { progress: number }).progress) * 100,
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

        {GENERATE_3D_SCAN_ENABLED &&
          angleSlots.length > 0 &&
          !clientUsesAuraScan(patientName) &&
          !scanning &&
          scanState.phase !== "config" && (
            <button
              type="button"
              className={
                has3D ? "fmp-regenerate-3d-btn" : "fmp-generate-3d-btn"
              }
              onClick={() => {
                setScanState({ phase: "config" });
              }}
              title={has3D ? "Generate a new 3D scan" : "Generate 3D scan"}
            >
              {has3D ? (
                <>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <polyline points="1 4 1 10 7 10" />
                    <path d="M3.51 15a9 9 0 1 0 .49-3.93" />
                  </svg>
                  Regenerate
                </>
              ) : (
                <>
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                  Generate 3D Scan
                </>
              )}
            </button>
          )}

        {useAuraView && showToolbarGallery && !scanning ? (
          <button
            type="button"
            className="fmp-regenerate-3d-btn"
            onClick={() => openPatientPhotosSafe(photoModalInitialTab)}
            title="All photos and originals"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            Photos
          </button>
        ) : null}

        {scanState.phase === "error" && (
          <span className="fmp-scan-error-label" title={scanState.message}>
            Scan failed —{" "}
            <button
              type="button"
              className="fmp-scan-retry-link"
              onClick={() => setScanState({ phase: "idle" })}
            >
              retry
            </button>
          </span>
        )}
      </div>

      <div className="fmp-toolbar-end">
        {scanning && (
          <button
            type="button"
            className="fmp-fullscreen-btn"
            onClick={cancelScan}
          >
            Cancel
          </button>
        )}

        {!useAuraView && showToolbarTools ? (
          <div className="fmp-toolbar-tools" aria-label="View tools">
            {showToolbarRegions ? (
              <FaceMirrorRegionsPicker
                variant="toolbar"
                manualHighlightedRegionIds={manualHighlightedRegionIds}
                onSetManualHighlightedRegionIds={setManualHighlightedRegionIds}
                onToggleAnnotationRegionHighlight={
                  toggleAnnotationRegionHighlight
                }
              />
            ) : null}
            {showToolbarRotate ? (
              <button
                type="button"
                className={`fmp-toolbar-tool-btn${autoRotate3d ? " fmp-toolbar-tool-btn--active" : ""}`}
                onClick={toggleAutoRotate3d}
                aria-pressed={autoRotate3d}
                title={
                  autoRotate3d ? "Pause auto-rotate" : "Auto-rotate 3D view"
                }
              >
                <AutoRotateHeadIcon size={14} />
                Rotate
              </button>
            ) : null}
            {showToolbarGallery ? (
              <button
                type="button"
                className="fmp-toolbar-tool-btn"
                onClick={() => openPatientPhotosSafe(photoModalInitialTab)}
                title="All photos and originals"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
                Photos
              </button>
            ) : null}
          </div>
        ) : null}

        {!auraExpandedTopbarEnd ? expandAnalysisButton : null}
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
  };

  const auraViewerFraming = useMemo(
    () => ({
      initialZoom: patientAuraManifest?.viewerTurntableZoom,
      photoInitialZoom: patientAuraManifest?.viewerPhotoZoom,
      initialPanY: patientAuraManifest?.viewerInitialPanY,
    }),
    [patientAuraManifest],
  );

  // Shared AuraFaceView props — used for both turntable and photos-only modes.
  const auraFaceViewProps = {
    embedded: true as const,
    viewerAngleAssets: viewerAngleAssets,
    useBundledCvAnnotations: clientUsesAuraScan(patientName),
    cvAnnotations: patientAuraManifest?.cvAnnotations,
    availableViewAngles: availableViewAngles,
    ...auraViewerFraming,
    highlightTerms: highlightTermsForView,
    highlightedRegionIds: manualRegionsForView,
    overviewCategory: useAuraExpandedAnalysis ? auraActiveCategory : undefined,
    onOverviewCategoryChange: useAuraExpandedAnalysis
      ? setAuraActiveCategory
      : undefined,
    activeSkinLens: useAuraExpandedAnalysis ? auraActiveSkinLens : undefined,
    onActiveSkinLensChange: useAuraExpandedAnalysis
      ? setAuraActiveSkinLens
      : undefined,
    annotateStrokes: annotateStrokes,
    onAnnotateStrokesChange: setAnnotateStrokes,
    onAnnotateSave: analysisOverviewClient ? handleSaveAnnotation : undefined,
    regionPicker: useAuraView
      ? {
          manualHighlightedRegionIds,
          onSetManualHighlightedRegionIds: setManualHighlightedRegionIds,
          onToggleAnnotationRegionHighlight: toggleAnnotationRegionHighlight,
        }
      : undefined,
    topbarEnd: auraExpandedTopbarEnd,
  };

  const viewer3D =
    useAuraView && !has3D ? (
      // Photos-only Aura view: no turntable video, show angle stills with annotation overlays.
      <AuraFaceView
        {...auraFaceViewProps}
        turntableOnly={false}
        videoUrl=""
        disableDemoTurntableFallback
      />
    ) : effectiveVideoUrl ? (
      useAuraView ? (
        <AuraFaceView
          {...auraFaceViewProps}
          turntableOnly
          videoUrl={effectiveVideoUrl}
          textureVideoUrl={
            clientUsesAuraScan(patientName)
              ? undefined
              : patientAuraManifest?.textureVideoUrl
          }
          pigmentationVideoUrl={
            clientUsesAuraScan(patientName)
              ? undefined
              : patientAuraManifest?.pigmentationVideoUrl
          }
          rednessVideoUrl={
            clientUsesAuraScan(patientName)
              ? undefined
              : patientAuraManifest?.rednessVideoUrl
          }
          poresVideoUrl={
            clientUsesAuraScan(patientName)
              ? undefined
              : patientAuraManifest?.poresVideoUrl
          }
          wrinklesVideoUrl={
            clientUsesAuraScan(patientName)
              ? undefined
              : patientAuraManifest?.wrinklesVideoUrl
          }
          disableDemoTurntableFallback={patientGeneratedAura}
        />
      ) : (
        <Face3DViewer
          videoUrl={effectiveVideoUrl}
          autoRotate={autoRotate3d}
          showAnnotations={hasAnnotations}
          highlightTerms={highlightTermsForView}
          highlightedAnnotationRegionIds={manualRegionsForView}
          initialZoom={1.75}
          initialPanY={-88}
        />
      )
    ) : null;

  const placeholderEl = (
    <div className="fmp-placeholder">
      <svg
        width="56"
        height="56"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#999"
        strokeWidth="1.5"
        aria-hidden
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
      <p>{mode === "photo" ? "No photo available" : "No 3D preview"}</p>
    </div>
  );

  // --- Render ---
  return (
    <div
      className={`fmp-root${viewportExpanded ? " fmp-root--viewport-expanded" : ""}${useAuraView ? " fmp-root--aura" : ""}`}
    >
      {/* Toolbar: expand always available; Aura collapsed hides extra chrome via CSS */}
      {(has3D || hasPhoto || canGenerate) && showOverlayToolbar && toolbar}

      {/* Config sheet: slides in between toolbar and body */}
      {GENERATE_3D_SCAN_ENABLED && scanState.phase === "config" && (
        <ScanConfigPanel
          slots={angleSlots}
          quality={scanQuality}
          onQualityChange={setScanQuality}
          onStart={() => startScan()}
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
                  <FaceMirrorViewportShell>
                    <FaceMirrorPhotoStage
                      {...photoStageProps}
                      wrapClassName="fmp-photo-stage--in-expanded-split"
                    />
                  </FaceMirrorViewportShell>
                </div>
              </div>
            ) : mode === "3d" && effectiveVideoUrl ? (
              <div className="fmp-fullscreen-split-3d fmp-fullscreen-split-face">
                <div className="fmp-fullscreen-split-3d-inner fmp-canvas-area fmp-canvas-area--3d">
                  <FaceMirrorViewportShell>{viewer3D}</FaceMirrorViewportShell>
                </div>
              </div>
            ) : (
              <div className="fmp-fullscreen-split-placeholder fmp-canvas-area fmp-fullscreen-split-face">
                <div className="fmp-placeholder">
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#999"
                    strokeWidth="1.5"
                    aria-hidden
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <p>
                    {mode === "photo" ? "No photo available" : "No 3D preview"}
                  </p>
                </div>
              </div>
            )}
            <div
              className={`fmp-fullscreen-split-overview${overviewSoloSpan ? " fmp-fullscreen-split-overview--solo" : ""}`}
            >
              <div className="fmp-fullscreen-split-overview-main">
                <AnalysisOverviewModal
                  embedded
                  client={analysisOverviewClient}
                  onClose={() => setViewportExpanded(false)}
                  onAddToPlanDirect={analysisOverviewOnAddToPlanDirect}
                  auraBridge={auraBridge}
                  onOpenTreatmentRecommender={
                    analysisOverviewOnOpenTreatmentRecommender
                  }
                />
              </div>
              {expandedLowerRightContent ? (
                <div className="fmp-fullscreen-split-overview-lower">
                  {expandedLowerRightContent}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div
            className={`fmp-canvas-area${mode === "3d" && has3D ? " fmp-canvas-area--3d" : ""}`}
          >
            {mode === "photo" &&
              (hasPhoto && activePhotoUrl ? (
                <FaceMirrorViewportShell>
                  <FaceMirrorPhotoStage {...photoStageProps} />
                </FaceMirrorViewportShell>
              ) : (
                placeholderEl
              ))}
            {mode === "3d" && has3D && (
              <FaceMirrorViewportShell>{viewer3D}</FaceMirrorViewportShell>
            )}
          </div>
        )}
      </div>
      {showFsAnalysisOverview &&
      onOpenPlanBuilder &&
      !expandedLowerRightContent ? (
        <button
          type="button"
          className="fmp-planbuilder-launcher"
          onClick={() => onOpenPlanBuilder()}
          title="Open full plan builder"
        >
          Plan Builder
        </button>
      ) : null}
    </div>
  );
}
