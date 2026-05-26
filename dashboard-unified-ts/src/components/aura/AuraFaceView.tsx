import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Face3DViewer from "../views/Face3DViewer";
import auraTurntableVideo from "../../assets/images/turntable_2048_black.mp4";
import aura90LeftIcon from "../../assets/images/aura-90degrees-left.png";
import aura45LeftIcon from "../../assets/images/aura-45degrees-left.png";
import auraFrontIcon from "../../assets/images/aura-facing-ahead.png";
import aura45RightIcon from "../../assets/images/aura-45degrees-right.png";
import aura90RightIcon from "../../assets/images/aura-90degrees-right.png";
import aura3dTurntableIcon from "../../assets/images/aura-3d-turntable.svg";
import {
  TANYA_TAN_LEFT_NAV_ORDER,
  TANYA_TAN_STUDIO_ANGLE_ASSETS,
  TANYA_TAN_VIEWER_ANGLE_ASSETS,
  type AuraTanBlendAngleAsset,
  type AuraTanViewAngle,
  type AuraTanViewerAngleAsset,
} from "../../utils/auraTanAnglePhotos";
import { tanPhotoPlateAlignStyle } from "../../utils/auraTanPhotoFraming";
import { useMirrorViewportZoom } from "../../hooks/useMirrorViewportZoom";
import { AiMirrorCanvas, hasMirrorAnnotationHighlights } from "../postVisitBlueprint/AiMirrorCanvas";
import "./AuraFaceView.css";

type AnalysisTab = "skin" | "volume" | "structure";
type ViewAngle = "profile-left" | "three-quarter-left" | "front" | "three-quarter-right" | "profile-right";

const ANALYSIS_TABS: { id: AnalysisTab; label: string }[] = [
  { id: "skin", label: "Skin" },
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

type FaceSource = "turntable" | ViewAngle;

/** Match Face3DViewer turntable framing in the dashboard left column. */
const TURNTABLE_MATCH_ZOOM = 1.42;
const TURNTABLE_MATCH_PAN_Y = -96;

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
  skin: "#ff5535",
  volume: "#60a5fa",
  structure: "#a7f36d",
};

const RADAR_DATA: { label: string; value: number }[] = [
  { label: "Texture", value: 1.3 },
  { label: "Volume", value: 1.4 },
  { label: "Structure", value: 1.2 },
  { label: "Tone", value: 1.7 },
  { label: "Pores", value: 1.5 },
];

const TAB_SCORES: Record<AnalysisTab, { label: string; val: number }[]> = {
  skin: [
    { label: "Tone", val: 65 },
    { label: "Texture", val: 52 },
    { label: "Pores", val: 47 },
  ],
  volume: [
    { label: "Midface", val: 61 },
    { label: "Temples", val: 49 },
    { label: "Jawline", val: 38 },
  ],
  structure: [
    { label: "Forehead", val: 72 },
    { label: "Periocular", val: 58 },
    { label: "Lower face", val: 44 },
  ],
};

const MINIMAP_REGION_IDS: Record<AnalysisTab, string[]> = {
  skin: ["rNose", "rLeftCheek", "rRightCheek", "rChin"],
  volume: ["rLeftCheek", "rRightCheek", "rLowerFace"],
  structure: ["rForehead", "rLeftEye", "rRightEye"],
};

type DarkSpot = { cx: number; cy: number; rx: number; ry: number; intensity: number };
type PoreSpot = { cx: number; cy: number; r: number };

const AURA_CV_ANNOTATIONS: {
  wrinkles: string[];
  darkSpots: DarkSpot[];
  redAreas: string[];
  pores: PoreSpot[];
  volume: string[];
} = {
  wrinkles: [
    "M 42.09 32.03 Q 42.77 31.73 43.46 32.03",
    "M 43.51 30.52 Q 43.97 30.22 44.43 30.52",
    "M 53.66 33.42 Q 54.15 33.12 54.64 33.42",
    "M 41.21 32.64 Q 41.65 32.34 42.09 32.64",
    "M 40.19 30.79 Q 40.58 30.49 40.97 30.79",
    "M 54.79 31.54 Q 55.2 31.24 55.62 31.54",
    "M 52.34 31.88 Q 52.73 31.58 53.12 31.88",
    "M 54.1 30.15 Q 54.52 29.85 54.93 30.15",
    "M 45.07 31.59 Q 45.51 31.29 45.95 31.59",
    "M 43.75 46.39 Q 44.31 46.09 44.87 46.39",
    "M 44.48 45.43 Q 44.82 45.13 45.17 45.43",
    "M 56.1 47.44 Q 56.67 47.14 57.23 47.44",
    "M 58.59 43.8 Q 59.01 43.5 59.42 43.8",
    "M 52.1 60.74 Q 52.64 60.44 53.17 60.74",
    "M 37.9 43.8 Q 40.6 42.35 43.5 43.55",
    "M 56.4 43.7 Q 59.5 42.3 62.45 43.55",
    "M 40.5 56.85 Q 43.25 58.2 46.35 57.55",
    "M 53.55 57.55 Q 56.7 58.2 59.6 56.85",
  ],
  volume: [
    "M 36.74 47.84 L 43.49 44.81 L 47.87 49.35 L 45.48 57.41 L 39.52 58.92 Z",
    "M 62.97 47.84 L 56.21 44.81 L 51.84 49.35 L 54.23 57.41 L 60.19 58.92 Z",
    "M 41.11 65.98 L 46.67 68.5 L 53.03 68.5 L 58.6 65.98 L 55.42 71.02 L 44.29 71.02 Z",
  ],
  redAreas: [
    "M 46.19 57.03 L 51.22 57.32 L 49.07 53.76 L 48.19 54.15 L 47.75 56.1 Z",
    "M 39.36 57.28 L 39.94 59.38 L 46.63 59.38 L 47.8 55.52 L 44.53 56.84 L 44.58 55.32 L 41.6 55.22 Z",
    "M 59.81 57.47 L 56.4 54.25 L 53.52 55.08 L 55.22 56.64 L 53.32 57.28 L 53.61 59.38 L 59.08 59.38 Z",
    "M 44.7 47.9 L 49.8 43.6 L 55.1 47.9 L 53.85 60.2 L 49.7 64.35 L 45.85 60.2 Z",
    "M 40.25 64.85 Q 49.5 61.9 59.55 64.8 Q 55.55 69.4 44.3 69.2 Z",
  ],
  darkSpots: [
    // Person's LEFT cheek (right side of image, cx > 50%) — more affected side
    { cx: 63.5, cy: 50.0, rx: 0.65, ry: 0.65, intensity: 0.68 },
    { cx: 65.8, cy: 52.0, rx: 0.62, ry: 0.62, intensity: 0.72 },
    { cx: 61.0, cy: 53.5, rx: 0.68, ry: 0.68, intensity: 0.70 },
    { cx: 64.5, cy: 55.5, rx: 0.75, ry: 0.75, intensity: 0.75 },
    { cx: 67.5, cy: 54.0, rx: 0.55, ry: 0.55, intensity: 0.65 },
    { cx: 62.0, cy: 58.0, rx: 0.62, ry: 0.62, intensity: 0.68 },
    // Person's RIGHT cheek (left side of image, cx < 50%)
    { cx: 38.5, cy: 51.0, rx: 0.62, ry: 0.62, intensity: 0.62 },
    { cx: 36.0, cy: 54.0, rx: 0.55, ry: 0.55, intensity: 0.58 },
    { cx: 39.5, cy: 57.0, rx: 0.58, ry: 0.58, intensity: 0.60 },
  ],
  pores: [
    { cx: 47.5, cy: 43.9, r: 0.28 },
    { cx: 50.0, cy: 43.4, r: 0.3 },
    { cx: 52.6, cy: 44.0, r: 0.28 },
    { cx: 48.1, cy: 47.2, r: 0.32 },
    { cx: 51.9, cy: 47.6, r: 0.32 },
    { cx: 49.5, cy: 50.8, r: 0.34 },
    { cx: 50.9, cy: 54.0, r: 0.34 },
    { cx: 47.6, cy: 57.5, r: 0.3 },
    { cx: 52.8, cy: 57.6, r: 0.3 },
    { cx: 42.0, cy: 57.2, r: 0.28 },
    { cx: 58.2, cy: 56.8, r: 0.28 },
    { cx: 44.8, cy: 62.6, r: 0.26 },
    { cx: 55.5, cy: 62.3, r: 0.26 },
    { cx: 47.8, cy: 68.1, r: 0.28 },
    { cx: 52.0, cy: 68.0, r: 0.28 },
  ],
};

const AURA_TAN_ANGLE_ASSETS: Record<ViewAngle, AuraTanBlendAngleAsset> = TANYA_TAN_STUDIO_ANGLE_ASSETS;

type ViewerAngleAssets = Record<ViewAngle, AuraTanViewerAngleAsset>;

const VIEWER_ANGLE_ICON_SRC: Record<ViewAngle, string> = {
  "profile-left": aura90RightIcon,
  "three-quarter-left": aura45RightIcon,
  front: auraFrontIcon,
  "three-quarter-right": aura45LeftIcon,
  "profile-right": aura90LeftIcon,
};

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

function closestAnchor(turntableRatio: number): { angle: ViewAngle; distance: number } {
  let best: { angle: ViewAngle; distance: number } = { angle: "front", distance: Infinity };
  for (const angle of TAN_ANGLE_ORDER) {
    const distance = Math.abs(turntableRatio - AURA_TAN_ANGLE_ASSETS[angle].timeRatio);
    if (distance < best.distance) best = { angle, distance };
  }
  return best;
}

function smootherstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function anchorPhotoStrength(turntableRatio: number, angle: ViewAngle): number {
  const distance = Math.abs(turntableRatio - AURA_TAN_ANGLE_ASSETS[angle].timeRatio);
  if (distance >= PHOTO_FADE_RADIUS) return 0;
  return smootherstep(1 - distance / PHOTO_FADE_RADIUS);
}

function angleAnchorOpacity(
  angle: ViewAngle,
  turntableRatio: number,
  photoTransition: PhotoTransition | null,
): number {
  if (photoTransition) {
    if (angle !== photoTransition.from && angle !== photoTransition.to) return 0;
    return anchorPhotoStrength(turntableRatio, angle);
  }

  const closest = closestAnchor(turntableRatio);
  if (closest.angle !== angle) return 0;
  return anchorPhotoStrength(turntableRatio, angle);
}

function maxPhotoOpacity(turntableRatio: number, photoTransition: PhotoTransition | null): number {
  return Math.max(
    ...TAN_ANGLE_ORDER.map((angle) => angleAnchorOpacity(angle, turntableRatio, photoTransition)),
  );
}

function mediaOpacityForPhotoCover(photoCover: number): number {
  const p = Math.max(0, Math.min(1, photoCover));
  // Keep both layers partially visible through the middle of the crossfade.
  if (p <= 0.12) return 1;
  if (p >= 0.88) return 0;
  return smootherstep(1 - (p - 0.12) / 0.76);
}

function displayAngleFromRatio(turntableRatio: number): ViewAngle {
  return closestAnchor(turntableRatio).angle;
}

function AuraStaticPhotoView({
  angle,
  activeTab,
  showAuraDiagnostics,
  showMirrorAnnotations,
  highlightTerms,
  highlightedRegionIds,
  viewerAssets,
}: {
  angle: ViewAngle;
  activeTab: AnalysisTab;
  showAuraDiagnostics: boolean;
  showMirrorAnnotations: boolean;
  highlightTerms: string[];
  highlightedRegionIds: string[];
  viewerAssets: ViewerAngleAssets;
}) {
  const asset = viewerAssets[angle];
  const src = asset.src;
  const viewerRef = useRef<HTMLDivElement>(null);
  const zoomLayerRef = useRef<HTMLDivElement>(null);
  const alignStyle = tanPhotoPlateAlignStyle(angle);
  const { zoom, resetTransform, minZoom } = useMirrorViewportZoom({
    viewerRef,
    zoomLayerRef,
    initialZoom: TURNTABLE_MATCH_ZOOM,
    initialPanY: TURNTABLE_MATCH_PAN_Y,
  });

  return (
    <div
      ref={viewerRef}
      className="avf-static-photo avf-zoom-viewport"
      onDoubleClick={zoom > minZoom + 0.02 ? resetTransform : undefined}
      title={zoom > minZoom + 0.02 ? "Double-click to reset zoom · scroll to zoom · drag to pan" : "Scroll to zoom"}
    >
      <div ref={zoomLayerRef} className="avf-static-photo__zoom">
        <div className="avf-photo-align" style={alignStyle}>
          {showMirrorAnnotations ? (
            <AiMirrorCanvas
              imageUrl={src}
              alt=""
              highlightTerms={highlightTerms}
              highlightedRegionIds={highlightedRegionIds}
              showAnnotations
            />
          ) : (
            <img src={src} alt="" className="avf-static-photo__img" draggable={false} />
          )}
          <AuraAnnotationOverlay
            activeTab={activeTab}
            turntableRatio={asset.timeRatio}
            visible={showAuraDiagnostics}
            includeWrinkles
            fixedAngle={angle}
          />
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
  if (angle === "three-quarter-left") return "translate(2 0) scale(0.84 1) skewY(-2)";
  if (angle === "profile-left") return "translate(6 0) scale(0.5 1) skewY(-5)";
  if (angle === "three-quarter-right") return "translate(14 0) scale(0.84 1) skewY(2)";
  return "translate(28 0) scale(0.5 1) skewY(5)";
}

function AuraAnnotationOverlay({
  activeTab,
  turntableRatio,
  visible,
  includeWrinkles = false,
  fixedAngle,
}: {
  activeTab: AnalysisTab;
  turntableRatio: number;
  visible: boolean;
  includeWrinkles?: boolean;
  /** When set (static photo view), use this angle instead of inferring from ratio. */
  fixedAngle?: ViewAngle;
}) {
  if (!visible) return null;
  const color = TAB_COLORS[activeTab];
  const displayAngle = fixedAngle ?? displayAngleFromRatio(turntableRatio);
  const side = displayAngle === "profile-left" || displayAngle === "three-quarter-left" ? "left" : "right";
  const isVisibleForAngle = (x: number) =>
    displayAngle === "front" || (side === "left" ? x <= 53 : x >= 47);

  return (
    <svg
      className={`avf-diagnostic-overlay avf-diagnostic-overlay--${activeTab}`}
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
      style={{ color }}
    >
      <defs>
        <filter id="avf_diag_glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="0.45" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="avf_diag_spot">
          <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
          <stop offset="45%" stopColor="currentColor" stopOpacity="0.62" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      {activeTab === "structure" && includeWrinkles ? (
        <g transform={angleOverlayTransform(displayAngle)} filter="url(#avf_diag_glow)">
          <g className="avf-diagnostic-overlay__wrinkles">
            {AURA_CV_ANNOTATIONS.wrinkles.map((d, index) => (
              <path key={index} d={d} />
            ))}
          </g>
        </g>
      ) : null}
      {activeTab === "volume" ? (
        <g transform={angleOverlayTransform(displayAngle)} filter="url(#avf_diag_glow)">
          <g className="avf-diagnostic-overlay__volume">
            {AURA_CV_ANNOTATIONS.volume.map((d, index) => (
              <path key={index} d={d} />
            ))}
          </g>
        </g>
      ) : null}
      {activeTab === "skin" ? (
        <g transform={angleOverlayTransform(displayAngle)}>
          <g className="avf-diagnostic-overlay__spots">
            {AURA_CV_ANNOTATIONS.darkSpots.map((spot, index) =>
              isVisibleForAngle(spot.cx) ? (
                <ellipse
                  key={index}
                  cx={spot.cx}
                  cy={spot.cy}
                  rx={spot.rx * 4.5}
                  ry={spot.ry * 4.5}
                  fill="url(#avf_diag_spot)"
                  opacity={spot.intensity}
                />
              ) : null,
            )}
          </g>
        </g>
      ) : null}
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

function IconEye() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>;
}

function IconEyeOff() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M17.9 17.9A10.1 10.1 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.1-5.9M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.2 3.2m-6.7-1.1a3 3 0 1 1-4.2-4.2" /><line x1="1" y1="1" x2="23" y2="23" /></svg>;
}

function IconAutoRotate() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12a9 9 0 0 1-15.1 6.6" />
      <path d="M3 12A9 9 0 0 1 18.1 5.4" />
      <path d="M18 9V5h4" />
      <path d="M6 15v4H2" />
    </svg>
  );
}

function IconSimple({ type }: { type: "upload" | "layers" | "pin" | "maximize" | "scan" | "grid" }) {
  const paths: Record<typeof type, JSX.Element> = {
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8 12 3 7 8" /><path d="M12 3v12" /></>,
    layers: <><path d="m12 2 10 5-10 5L2 7l10-5Z" /><path d="m2 17 10 5 10-5" /><path d="m2 12 10 5 10-5" /></>,
    pin: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" /><circle cx="12" cy="10" r="3" /></>,
    maximize: <><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" /></>,
    scan: <><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M7 12h10" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
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
  /**
   * Full-resolution angle stills for the left rail (dashboard Tanya Tan demo).
   * Defaults to bundled 2316×3088 PNGs.
   */
  viewerAngleAssets?: ViewerAngleAssets;
  /** MediaPipe region highlights (dashboard face mirror). */
  highlightTerms?: string[];
  highlightedRegionIds?: string[];
}

export default function AuraFaceView({
  className,
  showRadar = false,
  embedded = false,
  turntableOnly = false,
  videoUrl = auraTurntableVideo,
  viewerAngleAssets: viewerAngleAssetsProp,
  highlightTerms = [],
  highlightedRegionIds = [],
}: AuraFaceViewProps) {
  const viewerAngleAssets = viewerAngleAssetsProp ?? TANYA_TAN_VIEWER_ANGLE_ASSETS;
  const showMirrorAnnotations = hasMirrorAnnotationHighlights(
    highlightTerms,
    highlightedRegionIds,
  );
  const [activeTab, setActiveTab] = useState<AnalysisTab>("skin");
  const [viewAngle, setViewAngle] = useState<ViewAngle>("front");
  const [faceSource, setFaceSource] = useState<FaceSource>(
    turntableOnly ? "turntable" : "front",
  );
  const [radarMode, setRadarMode] = useState(showRadar);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [autoRotate, setAutoRotate] = useState(turntableOnly);
  const [blendRatio, setBlendRatio] = useState(0.5);
  const [photoTransition, setPhotoTransition] = useState<PhotoTransition | null>(null);
  const targetRatioRef = useRef(0.5);
  const settleTimerRef = useRef<number | null>(null);
  const prevViewAngleRef = useRef(viewAngle);

  const isTurntableView = !turntableOnly || faceSource === "turntable";
  const activePhotoAngle: ViewAngle =
    turntableOnly && faceSource !== "turntable" ? faceSource : viewAngle;
  const activeAngleMeta =
    ANGLE_CONTROLS.find((angle) => angle.id === activePhotoAngle) ?? ANGLE_CONTROLS[2];
  const activeTimeRatio = turntableOnly
    ? tanAssetsForView(activePhotoAngle, true, viewerAngleAssets).timeRatio
    : activeAngleMeta.timeRatio;
  const noIssuesMessage = TAB_NO_ISSUES[activeTab] ?? null;
  const annotationsActive = showAnnotations && !noIssuesMessage;
  const uvMode = activeTab === "skin" && annotationsActive;

  const selectTurntable = useCallback(() => {
    setFaceSource("turntable");
    setRadarMode(false);
  }, []);

  const selectPhotoAngle = useCallback((angle: ViewAngle) => {
    setAutoRotate(false);
    setFaceSource(angle);
    setViewAngle(angle);
    setRadarMode(false);
  }, []);

  const handleTimeRatioChange = useCallback((ratio: number) => {
    targetRatioRef.current = ratio;
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setBlendRatio((current) => {
        const target = targetRatioRef.current;
        const delta = target - current;
        if (Math.abs(delta) < 0.00035) return target;
        return current + delta * BLEND_RATIO_LERP;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const photoCoverOpacity = useMemo(
    () => (turntableOnly ? 0 : maxPhotoOpacity(blendRatio, photoTransition)),
    [blendRatio, photoTransition, turntableOnly],
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

        {!embedded ? <button className="avf-edit-btn">Edit Landmarks</button> : null}
      </header>

      <nav className="avf-leftnav" aria-label="View angle">
        {turntableOnly ? (
          <button
            type="button"
            className={`avf-angle-btn avf-angle-btn--3d${faceSource === "turntable" ? " avf-angle-btn--active" : ""}`}
            onClick={selectTurntable}
            aria-label="3D turntable"
            title="3D turntable"
          >
            <img
              src={aura3dTurntableIcon}
              alt=""
              className="avf-angle-icon avf-angle-icon--3d"
              draggable={false}
            />
          </button>
        ) : null}
        {(turntableOnly ? LEFT_NAV_ANGLE_ORDER : ANGLE_CONTROLS.map((a) => a.id)).map((angleId) => {
          const meta = ANGLE_CONTROLS.find((a) => a.id === angleId)!;
          const active = turntableOnly
            ? faceSource === angleId
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
                src={(turntableOnly ? VIEWER_ANGLE_ICON_SRC : ANGLE_ICON_SRC)[angleId]}
                alt=""
                className="avf-angle-icon"
                draggable={false}
              />
            </button>
          );
        })}
      </nav>

      <main className="avf-viewport">
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
                    videoUrl={videoUrl}
                    autoRotate={autoRotate}
                    controlledTimeRatio={
                      autoRotate || turntableOnly ? undefined : activeTimeRatio
                    }
                    controlledTimeAnimationMs={ANGLE_TRANSITION_MS}
                    onTimeRatioChange={handleTimeRatioChange}
                    showAnnotations={showMirrorAnnotations}
                    highlightTerms={highlightTerms}
                    highlightedAnnotationRegionIds={highlightedRegionIds}
                    showHint={false}
                    initialZoom={TURNTABLE_MATCH_ZOOM}
                    initialPanY={TURNTABLE_MATCH_PAN_Y}
                    mediaOpacity={mediaOpacity}
                    overlay={
                      <>
                        {!turntableOnly ? (
                          <AuraAnglePhotoLayer
                            activeTab={activeTab}
                            showAnnotations={annotationsActive}
                            turntableRatio={blendRatio}
                            photoTransition={photoTransition}
                          />
                        ) : null}
                        <AuraAnnotationOverlay
                          activeTab={activeTab}
                          turntableRatio={blendRatio}
                          visible={
                            annotationsActive &&
                            (turntableOnly || (activeTab !== "structure" && !autoRotate))
                          }
                          includeWrinkles={turntableOnly}
                        />
                      </>
                    }
                  />
                ) : (
                  <AuraStaticPhotoView
                    key={faceSource}
                    angle={faceSource}
                    activeTab={activeTab}
                    showAuraDiagnostics={annotationsActive}
                    showMirrorAnnotations={showMirrorAnnotations}
                    highlightTerms={highlightTerms}
                    highlightedRegionIds={highlightedRegionIds}
                    viewerAssets={viewerAngleAssets}
                  />
                )}
              </div>
            </div>
            {noIssuesMessage ? <NoIssuesMessage message={noIssuesMessage} /> : null}
            <MinimapPanel activeTab={activeTab} suppressed={!!noIssuesMessage} />
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
          </>
        )}
      </main>

      <aside className="avf-rightnav" aria-label="Tools">
        <button
          className={`avf-tool-btn${autoRotate ? " avf-tool-btn--active" : ""}`}
          title={autoRotate ? "Pause auto-rotate" : "Auto-rotate"}
          aria-label={autoRotate ? "Pause auto-rotate" : "Auto-rotate"}
          aria-pressed={autoRotate}
          disabled={turntableOnly && !isTurntableView}
          onClick={() => {
            if (turntableOnly && !isTurntableView) {
              selectTurntable();
            }
            setRadarMode(false);
            setAutoRotate((rotating) => !rotating);
          }}
        >
          <IconAutoRotate />
        </button>
        <button
          className={`avf-tool-btn${showAnnotations ? " avf-tool-btn--active" : ""}`}
          title={showAnnotations ? "Hide annotations" : "Show annotations"}
          aria-label={showAnnotations ? "Hide annotations" : "Show annotations"}
          onClick={() => setShowAnnotations((visible) => !visible)}
        >
          {showAnnotations ? <IconEye /> : <IconEyeOff />}
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
