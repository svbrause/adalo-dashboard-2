import { useCallback, useEffect, useMemo, useState } from "react";
import type { Client, ClientPhotoSlot, DiscussedItem } from "../../types";
import type {
  TreatmentPlanAddDirectOptions,
  TreatmentPlanPrefill,
} from "../modals/DiscussedTreatmentsModal/TreatmentPhotos";
import AnalysisOverviewModal from "../modals/AnalysisOverviewModal";
import { AiMirrorCanvas } from "../postVisitBlueprint/AiMirrorCanvas";
import Face3DViewer from "./Face3DViewer";
import "./FaceMirrorPanel.css";

type ViewMode = "photo" | "3d";

/** Intake / form-submission originals — must not win the aesthetic “Side” tab. */
function isIntakeOrFormSlot(s: ClientPhotoSlot): boolean {
  const id = s.id.toLowerCase();
  const lab = (s.label ?? "").toLowerCase();
  return id.includes("form") || lab.includes("intake");
}

/** Collapse gallery slots to at most two aesthetic views: Front and Side. */
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

interface FaceMirrorPanelProps {
  photoUrl: string | null;
  /** Extra angles (front / side / intake); merged with photoUrl when empty. */
  photoSlots?: ClientPhotoSlot[];
  glbUrl?: string | null;
  highlightTerms?: string[];
  patientName?: string;
  /**
   * Opens the patient photo viewer (front/side, processed vs intake originals).
   * The panel collapses its in-window expanded layer first so the modal stacks correctly.
   */
  onOpenPatientPhotos?: (initialTab: "front" | "side") => void;
  /** When true, show the “All photos & originals” control (Airtable-backed patients). */
  showPatientPhotoGallery?: boolean;
  /** When set, element fullscreen shows this patient’s analysis overview (spider charts, etc.). */
  analysisOverviewClient?: Client | null;
  analysisOverviewOnAddToPlanDirect?: (
    prefill: TreatmentPlanPrefill,
    options?: TreatmentPlanAddDirectOptions,
  ) => Promise<void | DiscussedItem> | DiscussedItem | void;
}

export default function FaceMirrorPanel({
  photoUrl,
  photoSlots = [],
  glbUrl: videoUrl,
  highlightTerms = [],
  patientName = "Patient",
  onOpenPatientPhotos,
  showPatientPhotoGallery = false,
  analysisOverviewClient = null,
  analysisOverviewOnAddToPlanDirect,
}: FaceMirrorPanelProps) {
  const [mode, setMode] = useState<ViewMode>("photo");
  const [autoRotate3d, setAutoRotate3d] = useState(true);
  const [angleIdx, setAngleIdx] = useState(0);
  /** In-window expand (fixed overlay over the browser page — not Chrome native fullscreen). */
  const [viewportExpanded, setViewportExpanded] = useState(false);

  const angleSlots = useMemo((): ClientPhotoSlot[] => {
    if (photoSlots.length > 0) return photoSlots;
    if (photoUrl) return [{ id: "front", label: "Front", url: photoUrl }];
    return [];
  }, [photoSlots, photoUrl]);

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

  const activePhotoUrl = simplifiedSlots[angleIdx]?.url ?? null;
  const has3D = Boolean(videoUrl);
  const hasPhoto = Boolean(activePhotoUrl);
  const showAnglePicker = mode === "photo" && simplifiedSlots.length > 1;
  const showFsAnalysisOverview = Boolean(
    viewportExpanded && analysisOverviewClient,
  );

  const openPatientPhotosSafe = useCallback(
    (initialTab: "front" | "side") => {
      setViewportExpanded(false);
      onOpenPatientPhotos?.(initialTab);
    },
    [onOpenPatientPhotos],
  );

  const photoModalInitialTab = useMemo((): "front" | "side" => {
    const slot = simplifiedSlots[angleIdx];
    if (!slot) return "front";
    if (slot.label === "Side") return "side";
    return "front";
  }, [simplifiedSlots, angleIdx]);

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

  const toggleViewportExpanded = useCallback(() => {
    setViewportExpanded((v) => !v);
  }, []);

  return (
    <div
      className={`fmp-root${viewportExpanded ? " fmp-root--viewport-expanded" : ""}`}
    >
      {has3D && (
        <div className="fmp-toolbar">
          <div className="fmp-toolbar-start">
            {!showFsAnalysisOverview && (
              <div className="fmp-mode-tabs" role="tablist" aria-label="View mode">
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
                    aria-hidden="true"
                  >
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
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                  3D
                </button>
              </div>
            )}
          </div>
          <div className="fmp-toolbar-end">
            {!showFsAnalysisOverview && mode === "3d" && (
              <label className="fmp-auto-rotate">
                <input
                  type="checkbox"
                  checked={autoRotate3d}
                  onChange={(e) => setAutoRotate3d(e.target.checked)}
                />
                <span>Auto-rotate</span>
              </label>
            )}
            <button
              type="button"
              className="fmp-fullscreen-btn"
              onClick={toggleViewportExpanded}
              aria-pressed={viewportExpanded}
              title={
                analysisOverviewClient
                  ? viewportExpanded
                    ? "Exit expanded view (Esc)"
                    : "Expand to fill window — 3D + analysis overview"
                  : viewportExpanded
                    ? "Exit expanded view (Esc)"
                    : "Expand to fill window"
              }
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
                    aria-hidden="true"
                  >
                    {/* Corners → center (pairing with corner-bracket expand) */}
                    <path d="M5 5 12 12M19 5 12 12M19 19 12 12M5 19 12 12" />
                  </svg>
                  Exit expanded
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
                    aria-hidden="true"
                  >
                    {/* Four corner brackets — expand to fill window */}
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
      )}

      <div className="fmp-body">
        {showFsAnalysisOverview && analysisOverviewClient ? (
          <div className="fmp-fullscreen-split">
            {videoUrl ? (
              <div className="fmp-fullscreen-split-3d">
                <div className="fmp-fullscreen-split-3d-inner fmp-canvas-area fmp-canvas-area--3d">
                  <label className="fmp-auto-rotate fmp-auto-rotate--by-3d">
                    <input
                      type="checkbox"
                      checked={autoRotate3d}
                      onChange={(e) => setAutoRotate3d(e.target.checked)}
                    />
                    <span>Auto-rotate</span>
                  </label>
                  <Face3DViewer videoUrl={videoUrl} autoRotate={autoRotate3d} />
                </div>
              </div>
            ) : null}
            <div
              className={`fmp-fullscreen-split-overview${videoUrl ? "" : " fmp-fullscreen-split-overview--solo"}`}
            >
              <AnalysisOverviewModal
                embedded
                client={analysisOverviewClient}
                onClose={() => setViewportExpanded(false)}
                onAddToPlanDirect={analysisOverviewOnAddToPlanDirect}
              />
            </div>
          </div>
        ) : (
          <>
            <div
              className={`fmp-canvas-area${mode === "3d" && has3D ? " fmp-canvas-area--3d" : ""}`}
            >
              {mode === "photo" &&
                (hasPhoto ? (
                  <div className="fmp-photo-stage">
                    <AiMirrorCanvas
                      imageUrl={activePhotoUrl!}
                      alt={`${patientName} facial analysis`}
                      highlightTerms={highlightTerms}
                      showAnnotations={true}
                    />
                    {showPatientPhotoGallery && onOpenPatientPhotos && (
                      <button
                        type="button"
                        className="fmp-gallery-expand"
                        onClick={() =>
                          openPatientPhotosSafe(photoModalInitialTab)
                        }
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
                ) : (
                  <div className="fmp-placeholder">
                    <svg
                      width="56"
                      height="56"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#999"
                      strokeWidth="1.5"
                      aria-hidden="true"
                    >
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <p>No photo available</p>
                  </div>
                ))}

              {mode === "3d" && videoUrl && (
                <Face3DViewer videoUrl={videoUrl} autoRotate={autoRotate3d} />
              )}
            </div>

          </>
        )}
      </div>
    </div>
  );
}
