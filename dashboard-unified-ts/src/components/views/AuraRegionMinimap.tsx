import {
  FACE_MINIMAP_ZONES,
  type RegionSeverityHighlight,
} from "../../utils/auraSeverityDisplay";
import "./AuraRegionMinimap.css";

interface AuraRegionMinimapProps {
  highlights: RegionSeverityHighlight[];
  accent: string;
  title?: string;
}

export default function AuraRegionMinimap({
  highlights,
  accent,
  title = "Regions",
}: AuraRegionMinimapProps) {
  const highlightMap = new Map(highlights.map((h) => [h.regionId, h]));

  return (
    <div className="aura-region-minimap">
      <div className="aura-region-minimap__header">
        <span className="aura-region-minimap__title">{title}</span>
        {highlights.length > 0 ? (
          <span className="aura-region-minimap__hint">Darker = higher priority</span>
        ) : null}
      </div>
      <div className="aura-region-minimap__face">
        <svg viewBox="0 0 60 72" fill="none" aria-hidden>
          <path
            d="M30 5C20 5 13 11 13 20v26c0 11 8 21 17 21s17-10 17-21V20C47 11 40 5 30 5Z"
            fill="rgba(255,255,255,0.04)"
            stroke="rgba(0,0,0,0.12)"
            strokeWidth="0.7"
            className="aura-region-minimap__silhouette"
          />
          {Object.entries(FACE_MINIMAP_ZONES).map(([id, z]) => {
            const hit = highlightMap.get(id);
            if (!hit) return null;
            return (
              <ellipse
                key={id}
                cx={z.cx}
                cy={z.cy}
                rx={z.rx}
                ry={z.ry}
                fill={hit.color}
                fillOpacity={hit.fillOpacity}
                stroke={hit.color}
                strokeWidth="0.6"
                strokeOpacity={0.85}
              />
            );
          })}
        </svg>
      </div>
      {highlights.length > 0 ? (
        <ul className="aura-region-minimap__legend">
          {highlights.slice(0, 4).map((h) => (
            <li key={h.regionId} className="aura-region-minimap__legend-row">
              <span
                className="aura-region-minimap__swatch"
                style={{ background: h.color }}
                aria-hidden
              />
              <span className="aura-region-minimap__legend-label">{h.subScoreName}</span>
              <span className="aura-region-minimap__legend-score" style={{ color: h.color }}>
                {Math.round((1 - h.badness01) * 100)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="aura-region-minimap__empty">
          No mapped findings in this category.
        </p>
      )}
      <div
        className="aura-region-minimap__accent-bar"
        style={{ background: accent }}
        aria-hidden
      />
    </div>
  );
}
