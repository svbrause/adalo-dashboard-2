import { useMemo, useState } from "react";
import type { CategoryResult } from "../../config/analysisOverviewConfig";
import type { AnalysisSeverityIssue } from "../../types";
import { useRegionalFaceLandmarks } from "../../hooks/useRegionalFaceLandmarks";
import {
  AURA_FIVE_REGION_IDS,
  badnessToPlusMinus,
  fiveRegionalScoresForCategory,
  type AuraRegionalZoneScore,
} from "../../utils/auraRegionalDisplay";
import {
  REGIONAL_FACE_PAN_VIEW,
  REGIONAL_FACE_VIEW_IMAGE,
  REGIONAL_FACE_VIEWPORT_ASPECT,
  regionalFaceMediaStyle,
} from "../../utils/regionalFaceGrid";
import { polygonPointsAttr } from "../../utils/regionalFaceZonePolygons";
import "./AuraRegionalFaceCard.css";

export type RegionalScoreMode = "scale15" | "plusMinus";

/** Fixed overlay strength (opacity slider removed). */
const REGIONAL_OVERLAY_OPACITY = 0.72;

interface AuraRegionalFaceCardProps {
  activeCat: CategoryResult | undefined;
  detectedIssues: Set<string>;
  severityIssues: Record<string, AnalysisSeverityIssue> | undefined;
  hasSeverity: boolean;
}

function RegionalOverlaySvg({
  scoreByZone,
  formatZoneScore,
  zonesByView,
  landmarkStatus,
}: {
  scoreByZone: Map<string, AuraRegionalZoneScore>;
  formatZoneScore: (zone: AuraRegionalZoneScore) => string;
  zonesByView: ReturnType<typeof useRegionalFaceLandmarks>["zonesByView"];
  landmarkStatus: ReturnType<typeof useRegionalFaceLandmarks>["status"];
}) {
  const viewZones = zonesByView[REGIONAL_FACE_PAN_VIEW];
  const useCv = landmarkStatus === "ready" && viewZones;

  return (
    <svg
      className="aura-regional-card__overlay-svg"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      {AURA_FIVE_REGION_IDS.map((id) => {
        const zone = scoreByZone.get(id);
        if (!zone) return null;

        const cv = useCv ? viewZones?.[id] : null;
        if (cv && cv.points.length >= 3) {
          return (
            <g key={id}>
              <polygon
                points={polygonPointsAttr(cv.points)}
                fill={zone.color}
                fillOpacity={REGIONAL_OVERLAY_OPACITY}
                stroke={zone.color}
                strokeWidth="0.4"
                strokeOpacity={0.85}
              />
              <text
                x={cv.score.x}
                y={cv.score.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="aura-regional-card__zone-score"
              >
                {formatZoneScore(zone)}
              </text>
            </g>
          );
        }
        return null;
      })}
    </svg>
  );
}

export default function AuraRegionalFaceCard({
  activeCat,
  detectedIssues,
  severityIssues,
  hasSeverity,
}: AuraRegionalFaceCardProps) {
  const [scoreMode, setScoreMode] = useState<RegionalScoreMode>("scale15");

  const { status: landmarkStatus, zonesByView } = useRegionalFaceLandmarks();

  const zoneScores = useMemo(
    () => fiveRegionalScoresForCategory(activeCat, detectedIssues, severityIssues),
    [activeCat, detectedIssues, severityIssues],
  );

  const scoreByZone = useMemo(
    () => new Map(zoneScores.map((z) => [z.id, z])),
    [zoneScores],
  );

  const formatZoneScore = (zone: AuraRegionalZoneScore) => {
    if (scoreMode === "plusMinus") return badnessToPlusMinus(zone.badness01);
    return zone.score15.toFixed(1);
  };

  const showOverlays = landmarkStatus === "ready" && zoneScores.length > 0;

  return (
    <div className="aura-regional-card">
      <div className="aura-regional-card__stage">
        <div className="aura-regional-card__face-wrap">
          <div
            className="aura-regional-card__viewport"
            style={{ aspectRatio: String(REGIONAL_FACE_VIEWPORT_ASPECT) }}
            role="img"
            aria-label="Front face regional severity map"
          >
            <div className="aura-regional-card__media" style={regionalFaceMediaStyle()}>
              <img
                src={REGIONAL_FACE_VIEW_IMAGE}
                alt=""
                className="aura-regional-card__photo"
                draggable={false}
              />
              {showOverlays && (
                <div className="aura-regional-card__overlay-layer">
                  <RegionalOverlaySvg
                    scoreByZone={scoreByZone}
                    formatZoneScore={formatZoneScore}
                    zonesByView={zonesByView}
                    landmarkStatus={landmarkStatus}
                  />
                </div>
              )}
            </div>
            {landmarkStatus === "loading" && (
              <span className="aura-regional-card__cv-status" aria-live="polite">
                Mapping regions…
              </span>
            )}
            <div
              className="aura-regional-card__mode-toggle"
              role="group"
              aria-label="Score display"
            >
              <button
                type="button"
                className={`aura-regional-card__mode-btn${scoreMode === "scale15" ? " aura-regional-card__mode-btn--active" : ""}`}
                onClick={() => setScoreMode("scale15")}
              >
                1–5
              </button>
              <button
                type="button"
                className={`aura-regional-card__mode-btn${scoreMode === "plusMinus" ? " aura-regional-card__mode-btn--active" : ""}`}
                onClick={() => setScoreMode("plusMinus")}
                title="Relative intensity"
              >
                +/−
              </button>
            </div>
          </div>

          {zoneScores.length === 0 && (
            <p className="aura-regional-card__no-data">
              {hasSeverity
                ? "No regional findings in this category."
                : "No detected issues mapped to regions."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
