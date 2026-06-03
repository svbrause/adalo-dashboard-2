import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Face3DViewer from "../views/Face3DViewer";
import auraTurntableVideo from "../../assets/images/turntable_1024_black_scrub.mp4";
import auraTurntableSkinGrayVideo from "../../assets/images/turntable_1024_black_skin_gray_scrub.mp4";
import auraTurntablePigmentationVideo from "../../assets/images/turntable_1024_black_pigmentation_brown_scrub.mp4";
import auraTurntableWrinklesVideo from "../../assets/images/turntable_1024_black_wrinkles_scrub.mp4";
import aura90LeftIcon from "../../assets/images/aura-90degrees-left.png";
import aura45LeftIcon from "../../assets/images/aura-45degrees-left.png";
import aura45LeftSkinIcon from "../../assets/images/45-left-rembg.png";
import auraFrontIcon from "../../assets/images/aura-facing-ahead.png";
import aura45RightIcon from "../../assets/images/aura-45degrees-right.png";
import aura90RightIcon from "../../assets/images/aura-90degrees-right.png";
import {
  TANYA_TAN_LEFT_NAV_ORDER,
  TANYA_TAN_STUDIO_ANGLE_ASSETS,
  TANYA_TAN_VIEWER_ANGLE_ASSETS,
  type AuraTanBlendAngleAsset,
  type AuraTanViewAngle,
  type AuraTanViewerAngleAsset,
} from "../../utils/auraTanAnglePhotos";
import {
  EMPTY_AURA_CV_ANNOTATIONS,
  TANYA_AURA_CV_ANNOTATIONS,
  wrinklePathsForAngle,
  type AuraCvAnnotations,
} from "../../utils/auraCvAnnotations";
import { tanPhotoPlateAlignStyle } from "../../utils/auraTanPhotoFraming";
import {
  auraFaceTabToOverviewCategory,
  overviewCategoryToAuraFaceTab,
  type AuraOverviewCategoryKey,
} from "../../utils/auraAnalysisBridge";
import { useMirrorViewportZoom } from "../../hooks/useMirrorViewportZoom";
import { AiMirrorCanvas, hasMirrorAnnotationHighlights } from "../postVisitBlueprint/AiMirrorCanvas";
import AnnotateDrawing, { type AnnotateStroke } from "./AnnotateDrawing";
import FaceMirrorRegionsPicker, {
  type FaceMirrorRegionsPickerProps,
} from "../views/FaceMirrorRegionsPicker";
import {
  captureVideoFrameDataUrl,
  compositeAnnotationOnImage,
  downloadDataUrl,
  measureAnnotateContentRect,
  sanitizeDownloadFilename,
} from "../../utils/annotationComposite";
import AutoRotateHeadIcon from "../common/AutoRotateHeadIcon";
import "./AuraFaceView.css";

export type AnnotateSavePayload = {
  faceImageUrl: string;
  compositeDataUrl: string;
  strokes: AnnotateStroke[];
  /** Angle + layer (color/texture) + still vs 3D — captured at save/download time. */
  viewContext: string;
};

type AnalysisTab = "texture" | "pigmentation" | "volume" | "structure";
type SkinSubMode = "texture" | "redness" | "pores" | "wrinkles";
type ViewAngle = "profile-left" | "three-quarter-left" | "front" | "three-quarter-right" | "profile-right";

function isTexturePlateMode(mode: SkinSubMode): boolean {
  return mode === "texture";
}

const ANALYSIS_TABS: { id: AnalysisTab; label: string }[] = [
  { id: "texture", label: "Skin" },
  { id: "volume", label: "Volume" },
  { id: "structure", label: "Structure" },
];

const ANGLE_CONTROLS: { id: ViewAngle; label: string; timeRatio: number }[] = [
  { id: "profile-left", label: "Left profile", timeRatio: 0.99 },
  { id: "three-quarter-left", label: "Left three-quarter", timeRatio: 0.76 },
  { id: "front", label: "Front", timeRatio: 0.5 },
  { id: "three-quarter-right", label: "Right three-quarter", timeRatio: 0.24 },
  { id: "profile-right", label: "Right profile", timeRatio: 0 },
];

/** Left rail order: 3D on top, then viewer L → R around the turntable. */
const LEFT_NAV_ANGLE_ORDER: ViewAngle[] = TANYA_TAN_LEFT_NAV_ORDER;

/** Glowing head silhouette — left-rail 3D turntable control (public/demo-3d). */
const AURA_3D_TURNTABLE_ICON = "/demo-3d/aura-3d-turntable-icon.png";
const TANYA_TAN_REDNESS_TURNTABLE_VIDEO = "/demo-3d/tanya-tan/tanya-tan-turntable-redness.mp4";
const TANYA_TAN_PORES_TURNTABLE_VIDEO = "/demo-3d/tanya-tan/tanya-tan-turntable-pores.mp4";
type FaceSource = "turntable" | ViewAngle;

/** Fill the panel without clipping the nose tip at profile extremes. */
const TURNTABLE_MATCH_ZOOM = 1.42;
const TURNTABLE_MATCH_PAN_Y = -72;
/** Photo-backed patients often use tight crops; generic turntables need extra zoom. */
const PHOTO_PATIENT_TURNTABLE_ZOOM = 1.9;

const ANGLE_ICON_SRC: Record<ViewAngle, string> = {
  "profile-left": aura90LeftIcon,
  "three-quarter-left": aura45LeftIcon,
  front: auraFrontIcon,
  "three-quarter-right": aura45RightIcon,
  "profile-right": aura90RightIcon,
};

const TAB_NO_ISSUES: Partial<Record<AnalysisTab, string>> = {
  volume: "No volume loss detected",
  structure: "No significant structural changes detected",
};

const TAB_COLORS: Record<AnalysisTab, string> = {
  texture: "#22d3ee",
  pigmentation: "#8b5cf6",
  volume: "#60a5fa",
  structure: "#a7f36d",
};

/** Fine crease highlights on grayscale texture / wrinkles lens (not pore dots). */
const WRINKLE_LENS_COLOR = "#f2e2c8";

const RADAR_DATA: { label: string; value: number }[] = [
  { label: "Texture", value: 1.3 },
  { label: "Volume", value: 1.4 },
  { label: "Structure", value: 1.2 },
  { label: "Tone", value: 1.7 },
  { label: "Pores", value: 1.5 },
];

const TAB_SCORES: Record<AnalysisTab, { label: string; val: number }[]> = {
  texture: [
    { label: "Texture", val: 81 },
    { label: "Pores", val: 79 },
    { label: "Smoothness", val: 83 },
  ],
  pigmentation: [
    { label: "Pigment", val: 86 },
    { label: "Melasma", val: 83 },
    { label: "Sun spots", val: 84 },
  ],
  volume: [
    { label: "Midface", val: 84 },
    { label: "Temples", val: 80 },
    { label: "Jawline", val: 75 },
  ],
  structure: [
    { label: "Forehead", val: 89 },
    { label: "Periocular", val: 83 },
    { label: "Lower face", val: 78 },
  ],
};

const MINIMAP_REGION_IDS: Record<AnalysisTab, string[]> = {
  texture: ["rNose", "rLeftCheek", "rRightCheek", "rChin"],
  pigmentation: ["rLeftCheek", "rRightCheek", "rNose"],
  volume: ["rLeftCheek", "rRightCheek", "rLowerFace"],
  structure: ["rForehead", "rLeftEye", "rRightEye"],
};

const AURA_TAN_ANGLE_ASSETS: Record<ViewAngle, AuraTanBlendAngleAsset> = TANYA_TAN_STUDIO_ANGLE_ASSETS;

type ViewerAngleAssets = Record<ViewAngle, AuraTanViewerAngleAsset>;

function tanAssetsForView(
  angle: ViewAngle,
  viewerMode: boolean,
  viewerAssets: ViewerAngleAssets,
) {
  return viewerMode ? viewerAssets[angle] : AURA_TAN_ANGLE_ASSETS[angle];
}

const ANGLE_TRANSITION_MS = 1150;

const TAN_ANGLE_ORDER: ViewAngle[] = ["profile-right", "three-quarter-right", "front", "three-quarter-left", "profile-left"];

/** Turntable ratio window where a real photo fades in/out (~±20° around each anchor). */
const PHOTO_FADE_RADIUS = 0.082;

/** How quickly blend opacity catches up to the live turntable ratio (0–1 per frame). */
const BLEND_RATIO_LERP = 0.18;

type PhotoTransition = { from: ViewAngle; to: ViewAngle };

type AngleTimings = Record<ViewAngle, { timeRatio: number }>;

function closestAnchor(
  turntableRatio: number,
  timings: AngleTimings = AURA_TAN_ANGLE_ASSETS,
): { angle: ViewAngle; distance: number } {
  let best: { angle: ViewAngle; distance: number } = { angle: "front", distance: Infinity };
  for (const angle of TAN_ANGLE_ORDER) {
    const distance = Math.abs(turntableRatio - timings[angle].timeRatio);
    if (distance < best.distance) best = { angle, distance };
  }
  return best;
}

/** Neighboring anchor poses + 0–1 blend for smooth overlay crossfade while the turntable spins. */
function bracketingAnchors(
  turntableRatio: number,
  timings: AngleTimings,
): { from: ViewAngle; to: ViewAngle; blend: number } {
  const ordered = [...TAN_ANGLE_ORDER].sort(
    (a, b) => timings[a].timeRatio - timings[b].timeRatio,
  );
  const r = Math.max(0, Math.min(1, turntableRatio));
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  if (r <= timings[first].timeRatio) return { from: first, to: first, blend: 0 };
  if (r >= timings[last].timeRatio) return { from: last, to: last, blend: 0 };
  for (let i = 0; i < ordered.length - 1; i++) {
    const from = ordered[i];
    const to = ordered[i + 1];
    const t0 = timings[from].timeRatio;
    const t1 = timings[to].timeRatio;
    if (r >= t0 && r <= t1) {
      return { from, to, blend: t1 > t0 ? (r - t0) / (t1 - t0) : 0 };
    }
  }
  return { from: last, to: last, blend: 0 };
}

function smootherstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function anchorPhotoStrength(
  turntableRatio: number,
  angle: ViewAngle,
  timings: AngleTimings = AURA_TAN_ANGLE_ASSETS,
): number {
  const distance = Math.abs(turntableRatio - timings[angle].timeRatio);
  if (distance >= PHOTO_FADE_RADIUS) return 0;
  return smootherstep(1 - distance / PHOTO_FADE_RADIUS);
}

function angleAnchorOpacity(
  angle: ViewAngle,
  turntableRatio: number,
  photoTransition: PhotoTransition | null,
  timings: AngleTimings = AURA_TAN_ANGLE_ASSETS,
): number {
  if (photoTransition) {
    if (angle !== photoTransition.from && angle !== photoTransition.to) return 0;
    return anchorPhotoStrength(turntableRatio, angle, timings);
  }

  const closest = closestAnchor(turntableRatio, timings);
  if (closest.angle !== angle) return 0;
  return anchorPhotoStrength(turntableRatio, angle, timings);
}

function maxPhotoOpacity(
  turntableRatio: number,
  photoTransition: PhotoTransition | null,
  timings: AngleTimings = AURA_TAN_ANGLE_ASSETS,
): number {
  return Math.max(
    ...TAN_ANGLE_ORDER.map((angle) => angleAnchorOpacity(angle, turntableRatio, photoTransition, timings)),
  );
}

function mediaOpacityForPhotoCover(photoCover: number): number {
  const p = Math.max(0, Math.min(1, photoCover));
  // Keep both layers partially visible through the middle of the crossfade.
  if (p <= 0.12) return 1;
  if (p >= 0.88) return 0;
  return smootherstep(1 - (p - 0.12) / 0.76);
}

function buildAnnotateViewContext(input: {
  angleLabel: string;
  layer: "Color" | "Texture";
  mode: "Still" | "3D";
}): string {
  return `${input.angleLabel} · ${input.layer} · ${input.mode}`;
}

function staticPhotoSrcForView({
  asset,
  activeTab,
  photoVariant,
  skinSubMode,
}: {
  asset: AuraTanViewerAngleAsset;
  activeTab: AnalysisTab;
  photoVariant?: "normal" | "texture" | "pigmentation";
  skinSubMode: SkinSubMode;
}): string {
  const wrinkleLensActive =
    activeTab === "texture" && skinSubMode === "wrinkles";
  if (activeTab === "texture" && skinSubMode === "redness" && asset.srcRedness) {
    return asset.srcRedness;
  }
  if (activeTab === "texture" && skinSubMode === "pores" && asset.srcPores) {
    return asset.srcPores;
  }
  if (wrinkleLensActive && asset.srcWrinklesView) return asset.srcWrinklesView;
  if (wrinkleLensActive && asset.srcCutout) return asset.srcCutout;
  if (photoVariant === "texture") return asset.srcTexture ?? asset.src;
  if (photoVariant === "pigmentation") return asset.srcPigmentation ?? asset.srcTexture ?? asset.src;
  if (photoVariant === "normal") return asset.src;
  if (activeTab === "pigmentation") return asset.srcPigmentation ?? asset.srcTexture ?? asset.src;
  if (activeTab === "texture" && isTexturePlateMode(skinSubMode)) {
    return asset.srcTexture ?? asset.src;
  }
  return asset.src;
}

function AuraStaticPhotoView({
  angle,
  activeTab,
  showAuraDiagnostics,
  showMirrorAnnotations,
  highlightTerms,
  highlightedRegionIds,
  viewerAssets,
  photoVariant,
  skinSubMode = "texture",
  drawOverlay,
  measureRootRef,
  cvAnnotations,
  disableWheelZoom = false,
  photoInitialZoom,
  initialPanY: initialPanYProp,
}: {
  angle: ViewAngle;
  activeTab: AnalysisTab;
  showAuraDiagnostics: boolean;
  showMirrorAnnotations: boolean;
  highlightTerms: string[];
  highlightedRegionIds: string[];
  viewerAssets: ViewerAngleAssets;
  /** Dashboard toggles: color still vs clinical texture plate (overrides tab default). */
  photoVariant?: "normal" | "texture" | "pigmentation";
  skinSubMode?: SkinSubMode;
  drawOverlay?: ReactNode;
  measureRootRef?: (el: HTMLDivElement | null) => void;
  cvAnnotations: AuraCvAnnotations;
  disableWheelZoom?: boolean;
  photoInitialZoom?: number;
  initialPanY?: number;
}) {
  const asset = viewerAssets[angle];
  // When baked images exist (srcRedness / srcPores), use them directly — they
  // already have the overlay composited at full quality, like the contact sheet.
  const hasBakedRedness = Boolean(asset.srcRedness);
  const hasBakedPores = Boolean(asset.srcPores);
  const hasBakedWrinkles = Boolean(asset.srcWrinkles || asset.srcWrinklesView);
  const hasWrinkleView = Boolean(asset.srcWrinklesView);
  const wrinkleLensActive =
    activeTab === "texture" && skinSubMode === "wrinkles";
  const wrinkleLineOverlay =
    wrinkleLensActive && hasBakedWrinkles && !hasWrinkleView;
  const src = staticPhotoSrcForView({
    asset,
    activeTab,
    photoVariant,
    skinSubMode,
  });
  const viewerRef = useRef<HTMLDivElement>(null);
  const zoomLayerRef = useRef<HTMLDivElement>(null);
  const alignStyle = asset.cssTransform
    ? { transform: asset.cssTransform, transformOrigin: "center center" }
    : tanPhotoPlateAlignStyle(angle);
  const stillZoom =
    asset.photoZoom ?? photoInitialZoom ?? TURNTABLE_MATCH_ZOOM;
  const stillPanX = asset.initialPanX ?? 0;
  const stillPanY = asset.initialPanY ?? initialPanYProp ?? TURNTABLE_MATCH_PAN_Y;
  const displaySrc =
    wrinkleLensActive && asset.srcWrinklesView
      ? `${src}${src.includes("?") ? "&" : "?"}v=4`
      : src;
  const { zoom, resetTransform, minZoom } = useMirrorViewportZoom({
    viewerRef,
    zoomLayerRef,
    initialZoom: stillZoom,
    initialPanX: stillPanX,
    initialPanY: stillPanY,
    allowPanAtMinZoom: true,
    wheelZoomEnabled: !disableWheelZoom,
  });
  const panHint = "Double-click to reset zoom · scroll to zoom · drag to pan";

  return (
    <div
      ref={viewerRef}
      className="avf-static-photo avf-zoom-viewport"
      onDoubleClick={zoom > minZoom + 0.02 ? resetTransform : undefined}
      title={panHint}
    >
      <div ref={zoomLayerRef} className="avf-static-photo__zoom">
        <div ref={measureRootRef} className="avf-photo-align" style={alignStyle}>
          {showMirrorAnnotations ? (
            <AiMirrorCanvas
              imageUrl={displaySrc}
              alt=""
              highlightTerms={highlightTerms}
              highlightedRegionIds={highlightedRegionIds}
              showAnnotations
            />
          ) : wrinkleLineOverlay ? (
            <div className="avf-photo-stack">
              <img src={displaySrc} alt="" className="avf-static-photo__img" draggable={false} />
              <img
                src={`${asset.srcWrinkles!}${asset.srcWrinkles!.includes("?") ? "&" : "?"}v=2`}
                alt=""
                className="avf-photo-stack__overlay avf-photo-mask-overlay--wrinkles"
                aria-hidden
                draggable={false}
              />
            </div>
          ) : (
            <img src={displaySrc} alt="" className="avf-static-photo__img" draggable={false} />
          )}
          {/* Redness / pore masks rendered as img elements so they inherit the
              photo's object-fit layout and align correctly regardless of aspect ratio. */}
          {showAuraDiagnostics && activeTab === "texture" && skinSubMode === "redness" && !hasBakedRedness && cvAnnotations.redMaskByAngle?.[angle] ? (
            <img
              src={cvAnnotations.redMaskByAngle[angle]}
              alt=""
              className="avf-photo-mask-overlay"
              aria-hidden
              draggable={false}
            />
          ) : null}
          {showAuraDiagnostics && activeTab === "texture" && skinSubMode === "pores" && !hasBakedPores && cvAnnotations.poreMaskByAngle?.[angle] ? (
            <img
              src={cvAnnotations.poreMaskByAngle[angle]}
              alt=""
              className="avf-photo-mask-overlay avf-photo-mask-overlay--pores"
              aria-hidden
              draggable={false}
            />
          ) : null}
          <AuraAnnotationOverlay
            activeTab={activeTab}
            turntableRatio={asset.timeRatio}
            visible={
              showAuraDiagnostics &&
              (skinSubMode === "texture" ||
                (skinSubMode === "wrinkles" && !hasBakedWrinkles))
            }
            includeWrinkles
            skinSubMode={skinSubMode}
            fixedAngle={angle}
            annotations={cvAnnotations}
            hasBakedWrinklePlate={(a) =>
              Boolean(viewerAssets[a]?.srcWrinkles || viewerAssets[a]?.srcWrinklesView)
            }
          />
          {drawOverlay}
        </div>
      </div>
      {zoom > minZoom + 0.02 ? (
        <span className="avf-zoom-hint" aria-hidden>
          {Math.round(zoom * 100)}%
        </span>
      ) : null}
    </div>
  );
}

function AuraTexturePhotoLayer({
  turntableRatio,
  photoTransition,
  viewerAssets,
}: {
  turntableRatio: number;
  photoTransition: PhotoTransition | null;
  viewerAssets: ViewerAngleAssets;
}) {
  const timings = viewerAssets as AngleTimings;

  return (
    <div className="avf-angle-photo-layer avf-texture-photo-layer" aria-hidden>
      {LEFT_NAV_ANGLE_ORDER.map((angle) => {
        const opacity = angleAnchorOpacity(angle, turntableRatio, photoTransition, timings);
        const asset = viewerAssets[angle];
        const alignStyle = asset.cssTransform
          ? { transform: asset.cssTransform, transformOrigin: "center center" }
          : tanPhotoPlateAlignStyle(angle as AuraTanViewAngle);
        return (
          <div
            key={`texture-${angle}`}
            className="avf-angle-photo-layer__plate"
            style={{ opacity }}
          >
            <div className="avf-photo-align" style={alignStyle}>
              <img src={asset.srcTexture ?? asset.src} alt="" draggable={false} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AuraAnglePhotoLayer({
  activeTab,
  showAnnotations,
  turntableRatio,
  photoTransition,
}: {
  activeTab: AnalysisTab;
  showAnnotations: boolean;
  turntableRatio: number;
  photoTransition: PhotoTransition | null;
}) {
  const useWrinklePlate = activeTab === "structure" && showAnnotations;

  return (
    <div className="avf-angle-photo-layer" aria-hidden>
      {TAN_ANGLE_ORDER.map((angle) => {
        const opacity = angleAnchorOpacity(angle, turntableRatio, photoTransition);
        const asset = AURA_TAN_ANGLE_ASSETS[angle];
        const alignStyle = tanPhotoPlateAlignStyle(angle as AuraTanViewAngle);
        return (
          <div
            key={angle}
            className="avf-angle-photo-layer__plate"
            style={{ opacity }}
          >
            <div className="avf-photo-align" style={alignStyle}>
              <img
                src={useWrinklePlate ? asset.srcWrinkles : asset.src}
                alt=""
                draggable={false}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function angleOverlayTransform(angle: ViewAngle): string {
  if (angle === "front") return "";
  if (angle === "three-quarter-left") return "matrix(1.0364,-0.0031,-0.0464,1.1905,-10.46,-23.43)";
  if (angle === "profile-left") return "translate(6 0) scale(0.5 1) skewY(-5)";
  if (angle === "three-quarter-right") return "matrix(0.9738,-0.0001,0.0280,1.0927,-1.33,-11.67)";
  return "translate(28 0) scale(0.5 1) skewY(5)";
}

function AnnotationAngleContent({
  activeTab,
  angle,
  includeWrinkles,
  glowId,
  annotations,
  skinSubMode = "texture",
  bakedWrinklePlate = false,
}: {
  activeTab: AnalysisTab;
  angle: ViewAngle;
  includeWrinkles: boolean;
  glowId: string;
  annotations: AuraCvAnnotations;
  skinSubMode?: SkinSubMode;
  /** Baked wrinkle still is shown — skip duplicate SVG creases. */
  bakedWrinklePlate?: boolean;
}) {
  const transform = angleOverlayTransform(angle);
  const redMask = annotations.redMaskByAngle?.[angle];
  const poreMask = annotations.poreMaskByAngle?.[angle];
  const wrinkleLensMode = activeTab === "texture" && skinSubMode === "wrinkles";
  const wrinklePaths = wrinklePathsForAngle(annotations, angle);
  const showWrinkleLines =
    !bakedWrinklePlate &&
    wrinklePaths.length > 0 &&
    ((activeTab === "structure" && includeWrinkles) || wrinkleLensMode);
  const wrinkleFilterId = wrinkleLensMode ? `${glowId}_wrinkle` : glowId;

  return (
    <>
      {showWrinkleLines ? (
        <g transform={transform} filter={`url(#${wrinkleFilterId})`}>
          <g
            className={`avf-diagnostic-overlay__wrinkles${wrinkleLensMode ? " avf-diagnostic-overlay__wrinkles--lens" : ""}`}
          >
            {wrinklePaths.map((d, index) => (
              <path key={index} d={d} />
            ))}
          </g>
        </g>
      ) : null}
      {activeTab === "volume" ? (
        <g transform={transform} filter={`url(#${glowId})`}>
          <g className="avf-diagnostic-overlay__volume">
            {annotations.volume.map((d, index) => (
              <path key={index} d={d} />
            ))}
          </g>
        </g>
      ) : null}
      {activeTab === "texture" ? (
        <>
          {skinSubMode === "texture" &&
          annotations.pores.length > 0 &&
          !Object.values(annotations.poreMaskByAngle ?? {}).some(Boolean) ? (
            <g transform={transform} filter={`url(#${glowId})`}>
              <g className="avf-diagnostic-overlay__pores">
                {annotations.pores.map((pore, index) => (
                  <circle
                    key={`texture-pore-${index}`}
                    cx={pore.cx}
                    cy={pore.cy}
                    r={pore.r * 1.35}
                  />
                ))}
              </g>
            </g>
          ) : null}
          {skinSubMode === "redness" && redMask ? (
            <image
              className="avf-diagnostic-overlay__red-mask"
              href={redMask}
              x={0}
              y={0}
              width={100}
              height={100}
              preserveAspectRatio="xMidYMid meet"
            />
          ) : null}
          {skinSubMode === "pores" && poreMask ? (
            <image
              className="avf-diagnostic-overlay__pore-mask"
              href={poreMask}
              x={0}
              y={0}
              width={100}
              height={100}
              preserveAspectRatio="xMidYMid meet"
            />
          ) : null}
        </>
      ) : null}
      {activeTab === "pigmentation" ? (
        <g transform={transform} filter={`url(#${glowId})`}>
          <g className="avf-diagnostic-overlay__spots">
            {(annotations.darkSpotsByAngle[angle] ?? []).map((spot, index) => (
              <ellipse
                key={`pigment-spot-${index}`}
                cx={spot.cx}
                cy={spot.cy}
                rx={spot.rx * 1.35}
                ry={spot.ry * 1.35}
                fillOpacity={0.38 + spot.intensity * 0.28}
              />
            ))}
          </g>
        </g>
      ) : null}
    </>
  );
}

function AuraAnnotationOverlay({
  activeTab,
  turntableRatio,
  visible,
  includeWrinkles = false,
  skinSubMode = "texture",
  fixedAngle,
  angleTimings = AURA_TAN_ANGLE_ASSETS,
  annotations,
  hasBakedWrinklePlate,
}: {
  activeTab: AnalysisTab;
  turntableRatio: number;
  visible: boolean;
  includeWrinkles?: boolean;
  skinSubMode?: SkinSubMode;
  /** When set (static photo view), use this angle instead of inferring from ratio. */
  fixedAngle?: ViewAngle;
  /** Turntable anchor times (dashboard viewer vs /aura studio plates). */
  angleTimings?: AngleTimings;
  annotations: AuraCvAnnotations;
  hasBakedWrinklePlate?: (angle: ViewAngle) => boolean;
}) {
  if (!visible) return null;
  const wrinkleLensMode = activeTab === "texture" && skinSubMode === "wrinkles";
  const color = wrinkleLensMode ? WRINKLE_LENS_COLOR : TAB_COLORS[activeTab];
  const overlayTone = wrinkleLensMode ? "wrinkles-lens" : activeTab;
  const glowId = "avf_diag_glow";
  const wrinkleGlowId = `${glowId}_wrinkle`;

  const renderAtAngle = (angle: ViewAngle, opacity: number, layerKey: string) => (
    <g key={layerKey} opacity={opacity} style={{ pointerEvents: "none" }}>
      <AnnotationAngleContent
        activeTab={activeTab}
        angle={angle}
        includeWrinkles={includeWrinkles}
        glowId={glowId}
        annotations={annotations}
        skinSubMode={skinSubMode}
        bakedWrinklePlate={hasBakedWrinklePlate?.(angle) ?? false}
      />
    </g>
  );

  let layers: ReactNode;
  if (fixedAngle) {
    layers = renderAtAngle(fixedAngle, 1, fixedAngle);
  } else {
    const { from, to, blend } = bracketingAnchors(turntableRatio, angleTimings);
    if (from === to || blend < 0.02) {
      layers = renderAtAngle(from, 1, from);
    } else if (blend > 0.98) {
      layers = renderAtAngle(to, 1, to);
    } else {
      const fadeIn = smootherstep(blend);
      const fadeOut = 1 - fadeIn;
      layers = (
        <>
          {renderAtAngle(from, fadeOut, from)}
          {renderAtAngle(to, fadeIn, to)}
        </>
      );
    }
  }

  return (
    <svg
      className={`avf-diagnostic-overlay avf-diagnostic-overlay--${overlayTone}`}
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
      style={{ color }}
    >
      <defs>
        <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="0.45" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={wrinkleGlowId} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="0.22" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {layers}
    </svg>
  );
}

function NoIssuesMessage({ message }: { message: string }) {
  return (
    <div className="avf-no-issues" aria-live="polite">
      <svg className="avf-no-issues__icon" viewBox="0 0 20 20" fill="none" aria-hidden>
        <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.4" />
        <path d="M6.5 10.2l2.3 2.3 4.7-4.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{message}</span>
    </div>
  );
}

function IconGear() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5v.2a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1h.2a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.4 1.1Z" />
    </svg>
  );
}

function IconClearHighlights() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m16.5 4.5 3 3-8.8 8.8a2 2 0 0 1-1.4.6H6.7l-2.2-2.2v-2.6a2 2 0 0 1 .6-1.4l8.4-8.4a2.1 2.1 0 0 1 3 0Z" />
      <path d="m11.5 5.5 7 7" />
      <path d="M4 20h9" />
      <path d="M18 16.5h3" />
      <path d="M19.5 15v3" />
    </svg>
  );
}

function IconSimple({
  type,
}: {
  type: "upload" | "layers" | "pin" | "maximize" | "scan" | "grid" | "draw";
}) {
  const paths: Record<typeof type, JSX.Element> = {
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8 12 3 7 8" /><path d="M12 3v12" /></>,
    layers: <><path d="m12 2 10 5-10 5L2 7l10-5Z" /><path d="m2 17 10 5 10-5" /><path d="m2 12 10 5 10-5" /></>,
    pin: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" /><circle cx="12" cy="10" r="3" /></>,
    maximize: <><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" /></>,
    scan: <><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M7 12h10" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
    draw: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
      </>
    ),
  };
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{paths[type]}</svg>;
}

function RadarChart() {
  const cx = 50, cy = 50, maxR = 38, rings = 5, maxVal = 5;
  const n = RADAR_DATA.length;
  const point = (i: number, val: number): [number, number] => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const r = (val / maxVal) * maxR;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  };
  const ringPath = (r: number) => Array.from({ length: n }, (_, i) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return `${i === 0 ? "M" : "L"} ${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
  }).join(" ") + " Z";
  const dataPath = RADAR_DATA.map((d, i) => {
    const [x, y] = point(i, d.value);
    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ") + " Z";

  return (
    <svg viewBox="0 0 100 100" className="avf-radar-svg" aria-label="Skin analysis radar">
      {Array.from({ length: rings }, (_, ri) => <path key={ri} d={ringPath(maxR * (ri + 1) / rings)} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.35" />)}
      {RADAR_DATA.map((_, i) => {
        const [x, y] = point(i, maxVal);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.16)" strokeWidth="0.35" />;
      })}
      <path d={dataPath} fill="rgba(127,243,109,0.24)" />
      <path d={dataPath} fill="none" stroke="#a7f36d" strokeWidth="0.65" />
      {RADAR_DATA.map((d, i) => {
        const [lx, ly] = point(i, maxVal + 0.9);
        const anchor = lx < cx - 2 ? "end" : lx > cx + 2 ? "start" : "middle";
        return <text key={d.label} x={lx} y={ly + 0.5} textAnchor={anchor} fontSize="4.2" fill="rgba(255,255,255,0.74)" fontFamily="system-ui, sans-serif">{d.label}</text>;
      })}
    </svg>
  );
}

function MinimapPanel({ activeTab, suppressed = false }: { activeTab: AnalysisTab; suppressed?: boolean }) {
  const color = TAB_COLORS[activeTab];
  const scores = suppressed ? [] : TAB_SCORES[activeTab];

  return (
    <div className="avf-minimap">
      <div className="avf-minimap-header">
        <span className="avf-minimap-title">Regions</span>
      </div>
      <div className="avf-minimap-face">
        <svg viewBox="0 0 60 72" fill="none" aria-hidden>
          <path d="M30 5C20 5 13 11 13 20v26c0 11 8 21 17 21s17-10 17-21V20C47 11 40 5 30 5Z" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.18)" strokeWidth="0.7" />
          {(!suppressed ? MINIMAP_REGION_IDS[activeTab] : []).map((id) => {
            const zones: Record<string, { cx: number; cy: number; rx: number; ry: number }> = {
              rForehead: { cx: 30, cy: 18, rx: 12, ry: 4 },
              rLeftEye: { cx: 22, cy: 29, rx: 5, ry: 3 },
              rRightEye: { cx: 38, cy: 29, rx: 5, ry: 3 },
              rNose: { cx: 30, cy: 39, rx: 5, ry: 8 },
              rLeftCheek: { cx: 22, cy: 42, rx: 5, ry: 7 },
              rRightCheek: { cx: 38, cy: 42, rx: 5, ry: 7 },
              rLowerFace: { cx: 30, cy: 53, rx: 11, ry: 7 },
              rChin: { cx: 30, cy: 57, rx: 7, ry: 4 },
            };
            const z = zones[id];
            return z ? <ellipse key={id} {...z} fill={color} fillOpacity="0.58" /> : null;
          })}
        </svg>
      </div>
      <div className="avf-minimap-scores">
        {scores.map((s) => (
          <div key={s.label} className="avf-minimap-score-row">
            <span className="avf-minimap-score-label">{s.label}</span>
            <div className="avf-minimap-score-bar">
              <div className="avf-minimap-score-fill" style={{ width: `${s.val}%`, background: color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface AuraFaceViewProps {
  className?: string;
  showRadar?: boolean;
  /** Fits the dashboard client-detail face column (compact chrome). */
  embedded?: boolean;
  /**
   * Dashboard face mirror: Aura UI + turntable only (no photo anchor blend).
   * Does not affect the standalone `/aura` page.
   */
  turntableOnly?: boolean;
  /** Turntable video; defaults to the bundled Aura demo export. */
  videoUrl?: string;
  /** Patient-specific skin-gray turntable (Texture tab). Falls back to bundled Tanya demo. */
  textureVideoUrl?: string;
  /** Patient-specific pigmentation turntable (Pigmentation tab). Falls back to bundled Tanya demo. */
  pigmentationVideoUrl?: string;
  /** Turntable with redness baked per-frame (Skin → Redness sub-mode). */
  rednessVideoUrl?: string;
  /** Turntable with pore darkening baked per-frame (Skin → Pores sub-mode). */
  poresVideoUrl?: string;
  /** Turntable with wrinkle creases baked per-frame (Skin → Wrinkles sub-mode). */
  wrinklesVideoUrl?: string;
  /**
   * Full-resolution angle stills for the left rail (dashboard Tanya Tan demo).
   * Defaults to bundled 2316×3088 PNGs.
   */
  viewerAngleAssets?: ViewerAngleAssets;
  /** Tanya demo: bundled wrinkle/pore/pigment geometry. Off for generated patient scans. */
  useBundledCvAnnotations?: boolean;
  /** Patient-specific diagnostic overlay from the scan pipeline manifest. */
  cvAnnotations?: AuraCvAnnotations;
  /**
   * When true, never fall back to bundled Tanya turntable/skin videos.
   * Uses patient texture/pigmentation URLs, or the color turntable as last resort.
   */
  disableDemoTurntableFallback?: boolean;
  /** Left-rail photo angles to show (omit ¾ when patient only submitted front + profiles). */
  availableViewAngles?: ViewAngle[];
  /** MediaPipe region highlights (dashboard face mirror). */
  highlightTerms?: string[];
  highlightedRegionIds?: string[];
  /** Dashboard action for clearing issue/region highlights in the face viewer. */
  hasHighlights?: boolean;
  onClearHighlights?: () => void;
  /**
   * Expanded client detail: Skin / Volume / Structure pills drive the analysis panel
   * category on the right (controlled from FaceMirrorPanel).
   */
  overviewCategory?: AuraOverviewCategoryKey;
  onOverviewCategoryChange?: (key: AuraOverviewCategoryKey) => void;
  /** Synced with embedded analysis panel scan lens chips (Skin → Texture / Redness / Pores). */
  activeSkinLens?: SkinSubMode;
  onActiveSkinLensChange?: (lens: SkinSubMode) => void;
  /** Lifted ink for save / reload from patient files. */
  annotateStrokes?: AnnotateStroke[];
  onAnnotateStrokesChange?: (strokes: AnnotateStroke[]) => void;
  onAnnotateSave?: (payload: AnnotateSavePayload) => void;
  /** Dashboard: region highlight picker on the right tool rail (Aura clients). */
  regionPicker?: Omit<FaceMirrorRegionsPickerProps, "variant">;
  /** Embedded expanded split: actions aligned in the top bar row (e.g. Hide analysis). */
  topbarEnd?: ReactNode;
  /** Override default turntable zoom (default: TURNTABLE_MATCH_ZOOM). */
  initialZoom?: number;
  /** Viewport zoom for angle stills (defaults to initialZoom / TURNTABLE_MATCH_ZOOM). */
  photoInitialZoom?: number;
  /** Override default turntable pan-Y in px (default: TURNTABLE_MATCH_PAN_Y). */
  initialPanY?: number;
  /** Public blueprint pages: let wheel scroll the page instead of zooming the face. */
  disableWheelZoom?: boolean;
  /** Embedded/public views can suppress the diagnostic status chip while keeping the selected tab/video. */
  showNoIssuesMessage?: boolean;
  /**
   * Override the initial analysis tab without controlling it. Defaults to "texture"
   * (skin-gray turntable). Pass "volume" or "structure" to start on the color video.
   */
  defaultTab?: "texture" | "volume" | "structure";
}

export default function AuraFaceView({
  className,
  showRadar = false,
  embedded = false,
  turntableOnly = false,
  videoUrl = auraTurntableVideo,
  textureVideoUrl,
  pigmentationVideoUrl,
  rednessVideoUrl,
  poresVideoUrl,
  wrinklesVideoUrl,
  viewerAngleAssets: viewerAngleAssetsProp,
  useBundledCvAnnotations = true,
  cvAnnotations: cvAnnotationsProp,
  disableDemoTurntableFallback = false,
  availableViewAngles,
  highlightTerms = [],
  highlightedRegionIds = [],
  hasHighlights = false,
  onClearHighlights,
  overviewCategory,
  onOverviewCategoryChange,
  activeSkinLens,
  onActiveSkinLensChange,
  annotateStrokes,
  onAnnotateStrokesChange,
  onAnnotateSave,
  regionPicker,
  topbarEnd,
  initialZoom: initialZoomProp,
  photoInitialZoom: photoInitialZoomProp,
  initialPanY: initialPanYProp,
  disableWheelZoom = false,
  showNoIssuesMessage = true,
  defaultTab,
}: AuraFaceViewProps) {
  const turntableZoom =
    initialZoomProp ??
    (disableDemoTurntableFallback
      ? PHOTO_PATIENT_TURNTABLE_ZOOM
      : TURNTABLE_MATCH_ZOOM);
  const photoZoom = photoInitialZoomProp ?? TURNTABLE_MATCH_ZOOM;
  const viewerAngleAssets = viewerAngleAssetsProp ?? TANYA_TAN_VIEWER_ANGLE_ASSETS;
  const effectiveCvAnnotations = useMemo(
    () =>
      useBundledCvAnnotations
        ? TANYA_AURA_CV_ANNOTATIONS
        : (cvAnnotationsProp ?? EMPTY_AURA_CV_ANNOTATIONS),
    [useBundledCvAnnotations, cvAnnotationsProp],
  );
  const navViewAngles = useMemo(
    () => availableViewAngles ?? LEFT_NAV_ANGLE_ORDER,
    [availableViewAngles],
  );
  const showMirrorAnnotations = hasMirrorAnnotationHighlights(
    highlightTerms,
    highlightedRegionIds,
  );
  const overviewControlled =
    overviewCategory !== undefined && onOverviewCategoryChange !== undefined;
  const [internalActiveTab, setInternalActiveTab] = useState<AnalysisTab>(defaultTab ?? "texture");
  const activeTab = overviewControlled
    ? overviewCategoryToAuraFaceTab(overviewCategory)
    : internalActiveTab;
  const setActiveTab = useCallback(
    (tab: AnalysisTab) => {
      if (overviewControlled) {
        onOverviewCategoryChange!(auraFaceTabToOverviewCategory(tab));
      } else {
        setInternalActiveTab(tab);
      }
    },
    [overviewControlled, onOverviewCategoryChange],
  );
  const [viewAngle, setViewAngle] = useState<ViewAngle>("front");
  const [faceSource, setFaceSource] = useState<FaceSource>(
    turntableOnly ? "turntable" : "front",
  );
  const [turntableSelected, setTurntableSelected] = useState(turntableOnly);
  const [radarMode, setRadarMode] = useState(showRadar);
  const [showAnnotations] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);
  const skinLensControlled =
    activeSkinLens !== undefined && onActiveSkinLensChange !== undefined;
  const [internalSkinSubMode, setInternalSkinSubMode] =
    useState<SkinSubMode>("texture");
  const skinSubMode = skinLensControlled ? activeSkinLens : internalSkinSubMode;
  const setSkinSubMode = useCallback(
    (mode: SkinSubMode) => {
      if (skinLensControlled) onActiveSkinLensChange!(mode);
      else setInternalSkinSubMode(mode);
    },
    [skinLensControlled, onActiveSkinLensChange],
  );
  const [drawingMode, setDrawingMode] = useState(false);
  const [annotateSaveStatus, setAnnotateSaveStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [blendRatio, setBlendRatio] = useState(0.5);
  const [photoTransition, setPhotoTransition] = useState<PhotoTransition | null>(null);
  const autoRotateRef = useRef(autoRotate);
  const targetRatioRef = useRef(0.5);
  const settleTimerRef = useRef<number | null>(null);
  const prevViewAngleRef = useRef(viewAngle);
  const [annotateToolbarHost, setAnnotateToolbarHost] =
    useState<HTMLDivElement | null>(null);
  const annotateMeasureRef = useRef<HTMLElement | null>(null);
  const setAnnotateMeasureRoot = useCallback((el: HTMLElement | null) => {
    annotateMeasureRef.current = el;
  }, []);

  /** Dashboard turntable uses viewer anchor times; /aura studio page uses studio plates. */
  const angleTimings = useMemo<AngleTimings>(
    () => (turntableOnly ? viewerAngleAssets : AURA_TAN_ANGLE_ASSETS),
    [turntableOnly, viewerAngleAssets],
  );

  const activeTurntableAngle = useMemo(
    () => closestAnchor(blendRatio, angleTimings).angle,
    [blendRatio, angleTimings],
  );

  const embeddedPhotoStills =
    embedded && turntableOnly && !turntableSelected;
  /** Skin tab → texture stills only in texture sub-mode; redness/pores use colour stills. */
  const embeddedStillVariant: "normal" | "texture" | "pigmentation" =
    activeTab === "texture" && isTexturePlateMode(skinSubMode)
      ? "texture"
      : activeTab === "pigmentation"
        ? "pigmentation"
        : "normal";
  const isTurntableView =
    turntableOnly && embedded
      ? turntableSelected
      : !turntableOnly || faceSource === "turntable";
  const activePhotoAngle: ViewAngle =
    turntableOnly && !turntableSelected
      ? viewAngle
      : embeddedPhotoStills
        ? viewAngle
        : viewAngle;
  const activeAngleMeta =
    ANGLE_CONTROLS.find((angle) => angle.id === activePhotoAngle) ?? ANGLE_CONTROLS[2];
  const activeTimeRatio = turntableOnly
    ? tanAssetsForView(activePhotoAngle, true, viewerAngleAssets).timeRatio
    : activeAngleMeta.timeRatio;
  const noIssuesMessage = TAB_NO_ISSUES[activeTab] ?? null;
  /** Tanya demo texture turntable already has its own pipeline look; avoid bright SVG dot overlay there. */
  const patientHasBakedSkinMaps = Boolean(
    cvAnnotationsProp?.poreMaskByAngle &&
      Object.values(cvAnnotationsProp.poreMaskByAngle).some(Boolean),
  );
  const showSkinTabDiagnostics =
    !useBundledCvAnnotations && !patientHasBakedSkinMaps;
  const annotationsActive = showAnnotations && !noIssuesMessage;
  /** UV grayscale helps on still /aura page; on live turntable it muddies pigment marks. */
  const uvMode = activeTab === "texture" && annotationsActive && !turntableOnly;
  /** Client-detail turntable: video only. Full /aura page may still blend plates when on texture. */
  const texturePlateMode =
    turntableOnly ? false : isTurntableView && activeTab === "texture";
  const scanOverlayVisible =
    annotationsActive && (!texturePlateMode || isTexturePlateMode(skinSubMode) || skinSubMode === "wrinkles");
  const textureTurntableMode =
    isTurntableView && activeTab === "texture" && skinSubMode === "texture";
  const wrinkleTurntableMode =
    isTurntableView && activeTab === "texture" && skinSubMode === "wrinkles";
  const redednessTurntableMode = isTurntableView && activeTab === "texture" && skinSubMode === "redness";
  const poresTurntableMode = isTurntableView && activeTab === "texture" && skinSubMode === "pores";
  const pigmentationTurntableMode = isTurntableView && activeTab === "pigmentation";
  const activeVideoUrl =
    textureTurntableMode
      ? (textureVideoUrl ??
          (disableDemoTurntableFallback ? videoUrl : auraTurntableSkinGrayVideo))
      : wrinkleTurntableMode
        ? (wrinklesVideoUrl ??
            (disableDemoTurntableFallback
              ? videoUrl
              : auraTurntableWrinklesVideo))
        : redednessTurntableMode
          ? (rednessVideoUrl ??
              (disableDemoTurntableFallback ? videoUrl : TANYA_TAN_REDNESS_TURNTABLE_VIDEO))
          : poresTurntableMode
            ? (poresVideoUrl ??
                (disableDemoTurntableFallback ? videoUrl : TANYA_TAN_PORES_TURNTABLE_VIDEO))
            : pigmentationTurntableMode
              ? (pigmentationVideoUrl ??
                  (disableDemoTurntableFallback ? videoUrl : auraTurntablePigmentationVideo))
              : videoUrl;
  // Bundled demo videos are already forward+reverse encoded. Patient GCS videos
  // may be one-way sweeps, so Face3DViewer should ping-pong those in code.
  const activeIsBundledTurntable =
    activeVideoUrl === auraTurntableVideo ||
    activeVideoUrl === auraTurntableSkinGrayVideo ||
    activeVideoUrl === auraTurntablePigmentationVideo ||
    activeVideoUrl === auraTurntableWrinklesVideo;
  const activeIsPingPong =
    activeIsBundledTurntable;

  const annotateExportAngle = embeddedPhotoStills ? activePhotoAngle : activeTurntableAngle;
  const annotateAngleLabel =
    viewerAngleAssets[annotateExportAngle]?.label ??
    ANGLE_CONTROLS.find((a) => a.id === annotateExportAngle)?.label ??
    "Face";

  const currentFaceImageUrl = useMemo(() => {
    const asset = viewerAngleAssets[annotateExportAngle];
    const left45SkinOverride =
      annotateExportAngle === "three-quarter-left" && activeTab === "texture"
        ? aura45LeftSkinIcon
        : null;
    if (embeddedPhotoStills) {
      const src = staticPhotoSrcForView({
        asset,
        activeTab,
        photoVariant: embeddedStillVariant,
        skinSubMode,
      });
      return embeddedStillVariant === "texture" ? left45SkinOverride ?? src : src;
    }
    if (textureTurntableMode) {
      return left45SkinOverride ?? asset.srcTexture ?? asset.src;
    }
    if (wrinkleTurntableMode) {
      return asset.srcWrinklesView ?? asset.src;
    }
    if (pigmentationTurntableMode) {
      return asset.srcPigmentation ?? asset.srcTexture ?? asset.src;
    }
    return asset.src;
  }, [
    annotateExportAngle,
    embeddedPhotoStills,
    viewerAngleAssets,
    embeddedStillVariant,
    textureTurntableMode,
    wrinkleTurntableMode,
    skinSubMode,
    pigmentationTurntableMode,
  ]);

  const annotateViewContext = useMemo(() => {
    const layer: "Color" | "Texture" = embeddedPhotoStills
      ? embeddedStillVariant === "texture" || embeddedStillVariant === "pigmentation"
        ? "Texture"
        : "Color"
      : textureTurntableMode || pigmentationTurntableMode || activeTab === "texture" || activeTab === "pigmentation"
        ? "Texture"
        : "Color";
    const mode: "Still" | "3D" = embeddedPhotoStills ? "Still" : "3D";
    return buildAnnotateViewContext({ angleLabel: annotateAngleLabel, layer, mode });
  }, [
    annotateAngleLabel,
    embeddedPhotoStills,
    embeddedStillVariant,
    textureTurntableMode,
    pigmentationTurntableMode,
    activeTab,
  ]);

  const buildAnnotatePayload = useCallback(async (): Promise<AnnotateSavePayload | null> => {
    const strokes = annotateStrokes ?? [];
    if (strokes.filter((s) => s.tool !== "eraser").length === 0) return null;

    const measureRoot = annotateMeasureRef.current;
    const contentRect = measureRoot ? measureAnnotateContentRect(measureRoot) : undefined;

    let faceImageUrl = currentFaceImageUrl;
    if (!embeddedPhotoStills && measureRoot) {
      const video = measureRoot.querySelector<HTMLVideoElement>(".face3d-display");
      const frame = video ? captureVideoFrameDataUrl(video) : null;
      if (frame) faceImageUrl = frame;
    }
    if (!faceImageUrl) return null;

    try {
      const compositeDataUrl = await compositeAnnotationOnImage(
        faceImageUrl,
        strokes,
        contentRect,
      );
      return {
        faceImageUrl,
        compositeDataUrl,
        strokes,
        viewContext: annotateViewContext,
      };
    } catch {
      return null;
    }
  }, [
    annotateStrokes,
    currentFaceImageUrl,
    annotateViewContext,
    embeddedPhotoStills,
  ]);

  const handleAnnotateSave = useCallback(async () => {
    setAnnotateSaveStatus("saving");
    const payload = await buildAnnotatePayload();
    if (!payload) {
      setAnnotateSaveStatus("failed");
      return;
    }
    onAnnotateSave?.(payload);
    setAnnotateSaveStatus("saved");
  }, [buildAnnotatePayload, onAnnotateSave]);

  const handleAnnotateDownload = useCallback(async () => {
    const payload = await buildAnnotatePayload();
    if (!payload) return;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadDataUrl(
      payload.compositeDataUrl,
      `${sanitizeDownloadFilename(payload.viewContext)}-${stamp}.jpg`,
    );
  }, [buildAnnotatePayload]);

  useEffect(() => {
    if (annotateSaveStatus === "idle") return undefined;
    const timer = window.setTimeout(() => setAnnotateSaveStatus("idle"), 1600);
    return () => window.clearTimeout(timer);
  }, [annotateSaveStatus]);

  const annotateSaveLabel =
    annotateSaveStatus === "saving"
      ? "Saving"
      : annotateSaveStatus === "saved"
        ? "Saved"
        : annotateSaveStatus === "failed"
          ? "Failed"
          : "Save";

  const annotateOverlay = (
    <AnnotateDrawing
      active={drawingMode}
      strokes={annotateStrokes}
      onStrokesChange={onAnnotateStrokesChange}
      onSave={onAnnotateSave ? handleAnnotateSave : undefined}
      onDownload={handleAnnotateDownload}
      saveLabel={annotateSaveLabel}
      toolbarContainer={embedded ? annotateToolbarHost : undefined}
    />
  );

  const selectTurntable = useCallback(() => {
    setTurntableSelected(true);
    setFaceSource("turntable");
    setRadarMode(false);
  }, []);

  const selectPhotoAngle = useCallback((angle: ViewAngle) => {
    setAutoRotate(false);
    setRadarMode(false);
    if (turntableOnly) {
      const ratio = tanAssetsForView(angle, true, viewerAngleAssets).timeRatio;
      targetRatioRef.current = ratio;
      setBlendRatio(ratio);
      setTurntableSelected(false);
      setFaceSource(angle);
      setViewAngle(angle);
      return;
    }
    setFaceSource(angle);
    setViewAngle(angle);
  }, [turntableOnly, viewerAngleAssets]);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    if (turntableOnly) {
      if (turntableSelected || navViewAngles.includes(viewAngle)) return;
      const fallback = navViewAngles.includes("front")
        ? "front"
        : (navViewAngles[0] ?? "front");
      setFaceSource(fallback);
      setViewAngle(fallback);
      return;
    }
    if (faceSource === "turntable") return;
    if (navViewAngles.includes(faceSource)) return;
    const fallback = navViewAngles.includes("front")
      ? "front"
      : (navViewAngles[0] ?? "front");
    setFaceSource(fallback);
    setViewAngle(fallback);
  }, [faceSource, navViewAngles, turntableOnly, turntableSelected, viewAngle]);

  const handleTimeRatioChange = useCallback((ratio: number) => {
    targetRatioRef.current = ratio;
    // Snap immediately while scrubbing so Face3DViewer isn't fighting controlledTimeRatio.
    if (!autoRotateRef.current) {
      setBlendRatio(ratio);
    }
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setBlendRatio((current) => {
        const target = targetRatioRef.current;
        if (autoRotateRef.current || turntableOnly) return target;
        const delta = target - current;
        if (Math.abs(delta) < 0.00035) return target;
        return current + delta * BLEND_RATIO_LERP;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [turntableOnly]);

  const photoCoverOpacity = useMemo(
    () =>
      turntableOnly
        ? 0
        : maxPhotoOpacity(blendRatio, photoTransition, angleTimings),
    [blendRatio, photoTransition, turntableOnly, angleTimings],
  );
  const mediaOpacity = useMemo(
    () => (turntableOnly ? 1 : mediaOpacityForPhotoCover(photoCoverOpacity)),
    [photoCoverOpacity, turntableOnly],
  );

  useEffect(() => {
    if (turntableOnly) return;
    if (autoRotate) {
      setPhotoTransition(null);
      prevViewAngleRef.current = viewAngle;
      return;
    }
    if (prevViewAngleRef.current === viewAngle) return;

    setPhotoTransition({ from: prevViewAngleRef.current, to: viewAngle });
    prevViewAngleRef.current = viewAngle;

    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    settleTimerRef.current = window.setTimeout(() => {
      settleTimerRef.current = null;
      setPhotoTransition(null);
    }, ANGLE_TRANSITION_MS + 40);
    return () => {
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
    };
  }, [viewAngle, autoRotate, turntableOnly]);

  const rootClass = [
    "avf-root",
    embedded ? "avf-root--embedded" : "",
    turntableOnly ? "avf-root--turntable-only" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass}>
      <header className="avf-topbar">
        {!embedded ? (
          <button
            className={`avf-gear-btn${radarMode ? " avf-gear-btn--active" : ""}`}
            onClick={() => setRadarMode((mode) => !mode)}
            title="Skin analysis overview"
            aria-label="Toggle skin analysis radar"
          >
            <IconGear />
          </button>
        ) : null}

        <nav className="avf-pills" role="tablist" aria-label="Analysis mode">
          {ANALYSIS_TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id && !radarMode}
              className={`avf-pill${activeTab === tab.id && !radarMode ? " avf-pill--active" : ""}`}
              onClick={() => {
                setActiveTab(tab.id);
                setRadarMode(false);
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {topbarEnd ? <div className="avf-topbar-end">{topbarEnd}</div> : null}

        {!embedded ? <button className="avf-edit-btn">Edit Landmarks</button> : null}
      </header>

      <nav className="avf-leftnav" aria-label="View angle">
        {turntableOnly && embedded ? (
          <button
            type="button"
            className={`avf-angle-btn avf-angle-btn--3d${
              turntableSelected ? " avf-angle-btn--active" : ""
            }`}
            onClick={selectTurntable}
            aria-label="3D turntable"
            title="3D turntable"
          >
            <img
              src={AURA_3D_TURNTABLE_ICON}
              alt=""
              className="avf-angle-icon avf-angle-icon--turntable-face"
              draggable={false}
            />
          </button>
        ) : null}
        {(turntableOnly || availableViewAngles != null
          ? [...navViewAngles]
          : [...ANGLE_CONTROLS].reverse().map((a) => a.id)
        ).map((angleId) => {
          const meta = ANGLE_CONTROLS.find((a) => a.id === angleId)!;
          const active =
            turntableOnly && embedded
              ? !turntableSelected && viewAngle === angleId
              : turntableOnly
                ? faceSource === "turntable" && activeTurntableAngle === angleId
                : viewAngle === angleId;
          return (
            <button
              key={angleId}
              type="button"
              className={`avf-angle-btn${active ? " avf-angle-btn--active" : ""}`}
              onClick={() => {
                if (turntableOnly) {
                  selectPhotoAngle(angleId);
                } else {
                  setAutoRotate(false);
                  setViewAngle(angleId);
                  setRadarMode(false);
                }
              }}
              aria-label={viewerAngleAssets[angleId]?.label ?? meta.label}
              title={viewerAngleAssets[angleId]?.label ?? meta.label}
            >
              <img
                src={ANGLE_ICON_SRC[angleId]}
                alt=""
                className="avf-angle-icon"
                draggable={false}
              />
            </button>
          );
        })}
      </nav>

      <main className="avf-viewport">
        {activeTab === "texture" && !radarMode ? (
          <nav className="avf-skin-sub-tabs" aria-label="Skin analysis mode">
            {(
              [
                { mode: "texture", label: "Texture" },
                { mode: "redness", label: "Redness" },
                { mode: "pores", label: "Pores" },
                { mode: "wrinkles", label: "Wrinkles" },
              ] as const
            ).map(({ mode, label }) => (
              <button
                key={mode}
                className={`avf-skin-sub-tab${skinSubMode === mode ? " avf-skin-sub-tab--active" : ""}`}
                onClick={() => setSkinSubMode(mode)}
              >
                {label}
              </button>
            ))}
          </nav>
        ) : null}
        {radarMode ? (
          <div className="avf-radar-wrap">
            <RadarChart />
          </div>
        ) : (
          <>
            <div className="avf-3d-stage">
              <div
                className={[
                  "avf-3d-frame",
                  turntableOnly ? "avf-3d-frame--turntable-only" : "",
                  uvMode ? "avf-3d-frame--uv" : "",
                ].filter(Boolean).join(" ")}
              >
                {isTurntableView ? (
                  <Face3DViewer
                    key={activeVideoUrl}
                    videoUrl={activeVideoUrl}
                    pingPong={activeIsPingPong}
                    autoRotate={autoRotate}
                    controlledTimeRatio={
                      autoRotate ? undefined : turntableOnly ? blendRatio : activeTimeRatio
                    }
                    controlledTimeAnimationMs={turntableOnly ? 0 : ANGLE_TRANSITION_MS}
                    onTimeRatioChange={handleTimeRatioChange}
                    showAnnotations={showMirrorAnnotations}
                    highlightTerms={highlightTerms}
                    highlightedAnnotationRegionIds={highlightedRegionIds}
                    showHint={false}
                    initialZoom={turntableZoom}
                    initialPanY={initialPanYProp ?? TURNTABLE_MATCH_PAN_Y}
                    wheelZoomEnabled={!disableWheelZoom}
                    mediaOpacity={mediaOpacity}
                    drawOverlay={annotateOverlay}
                    annotateMeasureRootRef={setAnnotateMeasureRoot}
                    overlay={
                      <>
                        {texturePlateMode ? (
                          <AuraTexturePhotoLayer
                            turntableRatio={blendRatio}
                            photoTransition={photoTransition}
                            viewerAssets={viewerAngleAssets}
                          />
                        ) : null}
                        {!turntableOnly ? (
                          <AuraAnglePhotoLayer
                            activeTab={activeTab}
                            showAnnotations={scanOverlayVisible}
                            turntableRatio={blendRatio}
                            photoTransition={photoTransition}
                          />
                        ) : null}
                        <AuraAnnotationOverlay
                          activeTab={activeTab}
                          turntableRatio={blendRatio}
                          angleTimings={angleTimings}
                          visible={
                            scanOverlayVisible &&
                            // Redness/pores/wrinkles are baked into the video — no SVG overlay needed.
                            !redednessTurntableMode &&
                            !poresTurntableMode &&
                            !wrinkleTurntableMode &&
                            (turntableOnly || (activeTab !== "structure" && !autoRotate)) &&
                            !(
                              activeTab === "texture" &&
                              !showSkinTabDiagnostics &&
                              skinSubMode === "texture"
                            )
                          }
                          includeWrinkles={
                            turntableOnly && !wrinkleTurntableMode
                          }
                          skinSubMode={skinSubMode}
                          annotations={effectiveCvAnnotations}
                          hasBakedWrinklePlate={(angle) =>
                            Boolean(
                              viewerAngleAssets[angle]?.srcWrinkles ||
                                viewerAngleAssets[angle]?.srcWrinklesView,
                            )
                          }
                        />
                      </>
                    }
                  />
                ) : embeddedPhotoStills ? (
                  <AuraStaticPhotoView
                    key={`${activeTab}-${skinSubMode}-${activePhotoAngle}`}
                    angle={activePhotoAngle}
                    activeTab={activeTab}
                    showAuraDiagnostics={
                      annotationsActive &&
                      (activeTab !== "texture" ||
                        showSkinTabDiagnostics ||
                        skinSubMode === "wrinkles" ||
                        skinSubMode !== "texture")
                    }
                    showMirrorAnnotations={showMirrorAnnotations}
                    highlightTerms={highlightTerms}
                    highlightedRegionIds={highlightedRegionIds}
                    viewerAssets={viewerAngleAssets}
                    photoVariant={embeddedStillVariant}
                    skinSubMode={skinSubMode}
                    drawOverlay={annotateOverlay}
                    measureRootRef={setAnnotateMeasureRoot}
                    cvAnnotations={effectiveCvAnnotations}
                    disableWheelZoom={disableWheelZoom}
                    photoInitialZoom={photoZoom}
                    initialPanY={initialPanYProp}
                  />
                ) : (
                  <AuraStaticPhotoView
                    key={`${faceSource}-${skinSubMode}`}
                    angle={faceSource === "turntable" ? viewAngle : faceSource}
                    activeTab={activeTab}
                    showAuraDiagnostics={
                      annotationsActive &&
                      (activeTab !== "texture" ||
                        showSkinTabDiagnostics ||
                        skinSubMode === "wrinkles" ||
                        skinSubMode !== "texture")
                    }
                    showMirrorAnnotations={showMirrorAnnotations}
                    highlightTerms={highlightTerms}
                    highlightedRegionIds={highlightedRegionIds}
                    viewerAssets={viewerAngleAssets}
                    skinSubMode={skinSubMode}
                    drawOverlay={annotateOverlay}
                    measureRootRef={setAnnotateMeasureRoot}
                    cvAnnotations={effectiveCvAnnotations}
                    disableWheelZoom={disableWheelZoom}
                    photoInitialZoom={photoZoom}
                    initialPanY={initialPanYProp}
                  />
                )}
              </div>
            </div>
            {showNoIssuesMessage && noIssuesMessage ? <NoIssuesMessage message={noIssuesMessage} /> : null}
            {!embedded ? (
              <MinimapPanel activeTab={activeTab} suppressed={!!noIssuesMessage} />
            ) : null}
            {!embedded ? (
              <>
                <div className="avf-subject-toggle">
                  <button className="avf-subject-btn avf-subject-btn--active" aria-label="Current 3D client" title="Current 3D client">
                    <span>3D</span>
                  </button>
                </div>
                <span className="avf-wordmark">aura</span>
              </>
            ) : null}
            {embedded ? (
              <div
                ref={setAnnotateToolbarHost}
                className="avf-annotate-toolbar-portal"
              />
            ) : null}
            {embedded && onClearHighlights && hasHighlights ? (
              <button
                type="button"
                className="avf-clear-highlights-btn"
                onClick={() => {
                  setRadarMode(false);
                  onClearHighlights();
                }}
              >
                <IconClearHighlights />
                <span>Clear highlights</span>
              </button>
            ) : null}
          </>
        )}
      </main>

      <aside className="avf-rightnav" aria-label="Tools">
        <button
          className={`avf-tool-btn${autoRotate ? " avf-tool-btn--active" : ""}`}
          title={autoRotate ? "Pause auto-rotate" : "Auto-rotate"}
          aria-label={autoRotate ? "Pause auto-rotate" : "Auto-rotate"}
          aria-pressed={autoRotate}
          onClick={() => {
            if (turntableOnly && !isTurntableView) {
              selectTurntable();
              setAutoRotate(true);
              setRadarMode(false);
              return;
            }
            setRadarMode(false);
            setAutoRotate((rotating) => !rotating);
          }}
        >
          <AutoRotateHeadIcon />
        </button>
        {embedded && regionPicker ? (
          <FaceMirrorRegionsPicker variant="aura-rail" {...regionPicker} />
        ) : null}
        <button
          className={`avf-tool-btn${drawingMode ? " avf-tool-btn--active" : ""}`}
          title={drawingMode ? "Stop drawing" : "Draw annotation"}
          aria-label={drawingMode ? "Stop drawing" : "Draw annotation"}
          aria-pressed={drawingMode}
          onClick={() => {
            setRadarMode(false);
            setAutoRotate(false);
            setDrawingMode((active) => !active);
          }}
        >
          <IconSimple type="draw" />
        </button>
        {!embedded
          ? [
              { type: "upload" as const, label: "Export" },
              { type: "layers" as const, label: "Layers" },
              { type: "pin" as const, label: "Markers" },
              { type: "maximize" as const, label: "Expand" },
              { type: "scan" as const, label: "Scan" },
              { type: "grid" as const, label: "Compare" },
            ].map(({ type, label }) => (
              <button key={label} className="avf-tool-btn" title={label} aria-label={label}>
                <IconSimple type={type} />
              </button>
            ))
          : null}
      </aside>
    </div>
  );
}
