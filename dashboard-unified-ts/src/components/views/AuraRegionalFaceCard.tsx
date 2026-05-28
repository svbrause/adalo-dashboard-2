import { useMemo, useState } from "react";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { CategoryResult } from "../../config/analysisOverviewConfig";
import type { AnalysisSeverityIssue } from "../../types";
import { useRegionalFaceLandmarks } from "../../hooks/useRegionalFaceLandmarks";
import {
  regionHighlightsFromCategoryIssues,
  type AuraIssueMapHighlight,
} from "../../utils/auraRegionalDisplay";
import { mirrorRegionPolygonInViewBox } from "../../utils/mirrorRegionPolygons";
import {
  REGIONAL_FACE_VIEW_IMAGE,
  REGIONAL_FACE_VIEWPORT_ASPECT,
  regionalFaceMediaStyle,
} from "../../utils/regionalFaceGrid";
import { polygonPointsAttr } from "../../utils/regionalFaceZonePolygons";
import "./AuraRegionalFaceCard.css";

export type RegionalScoreMode = "scale15" | "plusMinus";

interface AuraRegionalFaceCardProps {
  activeCat: CategoryResult | undefined;
  detectedIssues: Set<string>;
  severityIssues: Record<string, AnalysisSeverityIssue> | undefined;
  hasSeverity: boolean;
  categoryAccent: string;
  /** Embedded right panel: color zones only, no numeric scores or mode toggle. */
  compact?: boolean;
}

function IssueRegionalOverlaySvg({
  issueHighlights,
  landmarks,
  detectWidth,
  detectHeight,
}: {
  issueHighlights: AuraIssueMapHighlight[];
  landmarks: NormalizedLandmark[];
  detectWidth: number;
  detectHeight: number;
}) {
  const shapes = useMemo(() => {
    if (!landmarks.length || detectWidth <= 0 || detectHeight <= 0) return [];
    return issueHighlights
      .map((h) => {
        const poly = mirrorRegionPolygonInViewBox(
          h.regionId,
          landmarks,
          detectWidth,
          detectHeight,
        );
        if (!poly || poly.points.length < 3) return null;
        return { key: h.regionId, poly, highlight: h };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);
  }, [issueHighlights, landmarks, detectWidth, detectHeight]);

  return (
    <svg
      className="aura-regional-card__overlay-svg"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      {shapes.map(({ key, poly, highlight }) => (
        <polygon
          key={key}
          points={polygonPointsAttr(poly.points)}
          fill={highlight.color}
          fillOpacity={highlight.fillOpacity}
          stroke={highlight.color}
          strokeWidth="0.45"
          strokeOpacity={0.9}
        />
      ))}
    </svg>
  );
}

export default function AuraRegionalFaceCard({
  activeCat,
  detectedIssues,
  severityIssues,
  hasSeverity,
  categoryAccent,
  compact = false,
}: AuraRegionalFaceCardProps) {
  const [scoreMode, setScoreMode] = useState<RegionalScoreMode>("scale15");

  const {
    status: landmarkStatus,
    landmarks,
    detectWidth,
    detectHeight,
  } = useRegionalFaceLandmarks();

  const issueHighlights = useMemo(
    () =>
      regionHighlightsFromCategoryIssues(
        activeCat,
        detectedIssues,
        severityIssues,
        categoryAccent,
      ),
    [activeCat, detectedIssues, severityIssues, categoryAccent],
  );

  const showIssueOverlays =
    landmarkStatus === "ready" &&
    issueHighlights.length > 0 &&
    !!landmarks?.length &&
    detectWidth > 0;

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
              {showIssueOverlays && landmarks ? (
                <div className="aura-regional-card__overlay-layer">
                  <IssueRegionalOverlaySvg
                    issueHighlights={issueHighlights}
                    landmarks={landmarks}
                    detectWidth={detectWidth}
                    detectHeight={detectHeight}
                  />
                </div>
              ) : null}
            </div>
            {landmarkStatus === "loading" && (
              <span className="aura-regional-card__cv-status" aria-live="polite">
                Mapping regions…
              </span>
            )}
            {!compact ? (
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
            ) : null}
          </div>

          {issueHighlights.length === 0 && (
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
