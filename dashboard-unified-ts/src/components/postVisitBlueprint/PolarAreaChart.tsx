import { useEffect, useState } from "react";
import {
  CHART_AXIS_MAX,
  CHART_AXIS_MIN,
  healthScoreToSeverityAxis,
  SCORE_VALUE_MAX,
  SCORE_VALUE_MIN,
} from "../../utils/auraAnalysisBridge";
import {
  auraSkinLensFromLabel,
  type AuraSkinLens,
} from "../../utils/auraAnalysisBridge";
import type { RadarChartDatum } from "./RadarChart";

function datumLens(d: RadarChartDatum): AuraSkinLens | undefined {
  if (d.lens) return d.lens;
  return auraSkinLensFromLabel(d.name);
}

const SCALE_RING_LEVELS = [1, 2];

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

/** Score 1.2 = green → 2.8 = warmer/red on petal. */
function roseFillFromScore(score: number): string {
  const t = Math.max(
    0,
    Math.min(1, (score - SCORE_VALUE_MIN) / (SCORE_VALUE_MAX - SCORE_VALUE_MIN)),
  );
  const r = Math.round(52 + (214 - 52) * t);
  const g = Math.round(168 + (76 - 168) * t);
  const b = Math.round(108 + (68 - 108) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Map score (1.2–2.8) onto chart axis 0–3 for petal radius. */
function axisRadius(score: number, maxR: number): number {
  const clamped = Math.max(SCORE_VALUE_MIN, Math.min(SCORE_VALUE_MAX, score));
  return (clamped / CHART_AXIS_MAX) * maxR;
}

function ringRadius(level: number, maxR: number): number {
  return (level / CHART_AXIS_MAX) * maxR;
}

/**
 * Coxcomb chart: scores 1.2–2.8 on a 0–3 axis (rings unlabeled).
 */
export function PolarAreaChart({
  data,
  size = 200,
  animate,
  className,
  activeLens,
}: {
  data: RadarChartDatum[];
  size?: number;
  animate: boolean;
  className?: string;
  /** Highlights the petal matching the left-panel skin tab. */
  activeLens?: AuraSkinLens;
}) {
  const axisForDatum = (d: RadarChartDatum) =>
    d.severityAxis ?? healthScoreToSeverityAxis(d.score);

  const [displaySeverity, setDisplaySeverity] = useState(() =>
    data.map(axisForDatum),
  );

  useEffect(() => {
    const targets = data.map(axisForDatum);
    if (!animate) {
      setDisplaySeverity(targets.map(() => CHART_AXIS_MIN));
      return undefined;
    }
    const start = performance.now();
    const durationMs = 480;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      setDisplaySeverity(
        targets.map(
          (target) =>
            Math.round((CHART_AXIS_MIN + (target - CHART_AXIS_MIN) * eased) * 10) /
              10,
        ),
      );
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animate, data]);

  const labelPad = 32;
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
        aria-label="Skin severity scores 1.2 to 2.8 on a 0 to 3 axis"
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

        {data.map((d, i) => {
          const startAngle = startOffset + i * angleStep;
          const endAngle = startOffset + (i + 1) * angleStep;
          const score = displaySeverity[i] ?? CHART_AXIS_MIN;
          const outerR = axisRadius(score, maxR);
          const path = sectorPath(cx, cy, outerR, startAngle, endAngle);
          if (!path) return null;
          const lensKey = datumLens(d);
          const isActive =
            activeLens === undefined || lensKey === undefined || lensKey === activeLens;
          return (
            <path
              key={`petal-${d.name}`}
              d={path}
              fill={roseFillFromScore(score)}
              fillOpacity={isActive ? 0.92 : 0.28}
              stroke={
                isActive && activeLens
                  ? d.color ?? "var(--ao-polar-active-stroke, #6aab7a)"
                  : "none"
              }
              strokeWidth={isActive && activeLens ? 1.5 : 0}
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
          const score = displaySeverity[i] ?? CHART_AXIS_MIN;
          const startAngle = startOffset + i * angleStep;
          const endAngle = startOffset + (i + 1) * angleStep;
          const midAngle = (startAngle + endAngle) / 2;
          const outerR = axisRadius(score, maxR);
          if (outerR < 10) return null;
          const lensKey = datumLens(d);
          const isActive =
            activeLens === undefined || lensKey === undefined || lensKey === activeLens;
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
          const lensKey = datumLens(d);
          const isActive =
            activeLens === undefined || lensKey === undefined || lensKey === activeLens;
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
