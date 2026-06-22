import { useEffect, useState } from "react";
import {
  auraSkinLensFromLabel,
  type AuraSkinLens,
} from "../../utils/auraAnalysisBridge";
import type { RadarChartDatum } from "./RadarChart";

function datumLens(d: RadarChartDatum): AuraSkinLens | undefined {
  if (d.lens) return d.lens;
  return auraSkinLensFromLabel(d.name);
}

const HEALTH_SCORE_MIN = 0;
const HEALTH_SCORE_MAX = 100;
const SCALE_RING_LEVELS = [50, 75];

function polarPoint(cx: number, cy: number, radius: number, angleRad: number) {
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

function sectorPath(
  cx: number,
  cy: number,
  outerR: number,
  startAngle: number,
  endAngle: number,
): string {
  if (outerR < 1) return "";
  const startOuter = polarPoint(cx, cy, outerR, startAngle);
  const endOuter = polarPoint(cx, cy, outerR, endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return [
    `M ${cx} ${cy}`,
    `L ${startOuter.x} ${startOuter.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
    "Z",
  ].join(" ");
}

function fallbackFillFromHealthScore(score: number): string {
  if (score >= 90) return "#43a047";
  if (score >= 70) return "#66bb6a";
  if (score >= 50) return "#f9a825";
  return "#ef6c00";
}

/** Map the displayed health score (0-100) onto petal radius. */
function scoreRadius(score: number, maxR: number): number {
  const clamped = Math.max(HEALTH_SCORE_MIN, Math.min(HEALTH_SCORE_MAX, score));
  return (clamped / HEALTH_SCORE_MAX) * maxR;
}

function ringRadius(level: number, maxR: number): number {
  return (level / HEALTH_SCORE_MAX) * maxR;
}

/**
 * Coxcomb chart: displayed health scores (0-100) also control petal radius.
 */
export function PolarAreaChart({
  data,
  size = 200,
  animate,
  className,
  activeLens,
  activePetalName,
  ariaLabel = "Health scores from 0 to 100; higher scores draw larger petals",
}: {
  data: RadarChartDatum[];
  size?: number;
  animate: boolean;
  className?: string;
  /** Highlights the petal matching the left-panel skin tab. */
  activeLens?: AuraSkinLens;
  /** Highlights the petal whose datum name matches (Volume / Structure area tabs). */
  activePetalName?: string;
  ariaLabel?: string;
}) {
  const isPetalActive = (d: RadarChartDatum) => {
    if (activePetalName) {
      return d.name === activePetalName;
    }
    if (activeLens === undefined) return true;
    const lensKey = datumLens(d);
    return lensKey === undefined || lensKey === activeLens;
  };
  const scoreForDatum = (d: RadarChartDatum) =>
    Math.max(HEALTH_SCORE_MIN, Math.min(HEALTH_SCORE_MAX, d.score));

  const [displayScores, setDisplayScores] = useState(() =>
    data.map(scoreForDatum),
  );

  useEffect(() => {
    const targets = data.map(scoreForDatum);
    if (!animate) {
      setDisplayScores(targets.map(() => HEALTH_SCORE_MIN));
      return undefined;
    }
    const start = performance.now();
    const durationMs = 480;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      setDisplayScores(
        targets.map(
          (target) =>
            Math.round(
              (HEALTH_SCORE_MIN + (target - HEALTH_SCORE_MIN) * eased) * 10,
            ) / 10,
        ),
      );
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animate, data]);

  const labelPad = 44;
  const svgSize = size + labelPad * 2;
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const maxR = size / 2 - 2;
  const n = data.length;
  if (n < 2) return null;

  const angleStep = (2 * Math.PI) / n;
  const startOffset = -Math.PI / 2;
  const labelTextAnchor = (px: number): "start" | "middle" | "end" => {
    if (px < cx - 6) return "end";
    if (px > cx + 6) return "start";
    return "middle";
  };

  return (
    <div className={`ao-polar-area ao-polar-area--rose ${className ?? ""}`.trim()}>
      <svg
        width={svgSize}
        height={svgSize}
        viewBox={`0 0 ${svgSize} ${svgSize}`}
        overflow="visible"
        aria-label={ariaLabel}
        role="img"
      >
        <circle
          cx={cx}
          cy={cy}
          r={maxR}
          fill="none"
          stroke="var(--ao-polar-ring-stroke, #ebe6df)"
          strokeWidth="1"
        />
        {SCALE_RING_LEVELS.map((level) => (
          <circle
            key={level}
            cx={cx}
            cy={cy}
            r={ringRadius(level, maxR)}
            fill="none"
            stroke="var(--ao-polar-ring-stroke, #ebe6df)"
            strokeWidth="1"
          />
        ))}
        {[...SCALE_RING_LEVELS, HEALTH_SCORE_MAX].map((level) => {
          const p = polarPoint(cx, cy, ringRadius(level, maxR), -Math.PI / 2);
          return (
            <text
              key={`ring-label-${level}`}
              x={p.x - 7}
              y={p.y}
              textAnchor="end"
              dominantBaseline="middle"
              className="ao-polar-area__tick"
            >
              {level}
            </text>
          );
        })}

        {data.map((d, i) => {
          const startAngle = startOffset + i * angleStep;
          const endAngle = startOffset + (i + 1) * angleStep;
          const score = displayScores[i] ?? HEALTH_SCORE_MIN;
          const outerR = scoreRadius(score, maxR);
          const path = sectorPath(cx, cy, outerR, startAngle, endAngle);
          if (!path) return null;
          const isActive = isPetalActive(d);
          return (
            <path
              key={`petal-${d.name}`}
              d={path}
              fill={d.scoreColor ?? fallbackFillFromHealthScore(d.score)}
              fillOpacity={isActive ? 0.92 : 0.28}
              stroke={
                isActive && (activePetalName || activeLens)
                  ? d.color ?? "var(--ao-polar-active-stroke, #6aab7a)"
                  : "none"
              }
              strokeWidth={isActive && (activePetalName || activeLens) ? 1.5 : 0}
              className={isActive ? "ao-polar-area__petal--active" : "ao-polar-area__petal--inactive"}
            />
          );
        })}

        {Array.from({ length: n }, (_, i) => {
          const angle = startOffset + i * angleStep;
          const p = polarPoint(cx, cy, maxR, angle);
          return (
            <line
              key={`spoke-${i}`}
              x1={cx}
              y1={cy}
              x2={p.x}
              y2={p.y}
              stroke="var(--ao-polar-spoke-stroke, #d5cdc3)"
              strokeWidth="1"
            />
          );
        })}

        {data.map((d, i) => {
          const score = displayScores[i] ?? HEALTH_SCORE_MIN;
          const startAngle = startOffset + i * angleStep;
          const endAngle = startOffset + (i + 1) * angleStep;
          const midAngle = (startAngle + endAngle) / 2;
          const outerR = scoreRadius(score, maxR);
          if (outerR < 10) return null;
          const isActive = isPetalActive(d);
          const vp = polarPoint(cx, cy, outerR * 0.52, midAngle);
          return (
            <text
              key={`value-${d.name}`}
              x={vp.x}
              y={vp.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className={`ao-polar-area__value${isActive ? " ao-polar-area__value--active" : " ao-polar-area__value--inactive"}`}
              fillOpacity={isActive ? 1 : 0.45}
            >
              {Math.round(d.score)}
            </text>
          );
        })}

        {data.map((d, i) => {
          const startAngle = startOffset + i * angleStep;
          const endAngle = startOffset + (i + 1) * angleStep;
          const midAngle = (startAngle + endAngle) / 2;
          const lp = polarPoint(cx, cy, maxR + labelPad * 0.62, midAngle);
          const isActive = isPetalActive(d);
          return (
            <text
              key={`label-${d.name}`}
              x={lp.x}
              y={lp.y}
              textAnchor={labelTextAnchor(lp.x)}
              dominantBaseline="middle"
              className={`ao-polar-area__label${isActive ? " ao-polar-area__label--active" : " ao-polar-area__label--inactive"}`}
              fill={isActive && d.color ? d.color : undefined}
            >
              {d.name}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
