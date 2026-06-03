import type { AuraSkinLens } from "../../utils/auraAnalysisBridge";

export type RadarChartDatum = {
  name: string;
  score: number;
  /** Plotted petal score on 1.2–2.8 axis when set (skin lens coxcomb). */
  severityAxis?: number;
  /** Per-axis color (skin lens radar). */
  color?: string;
  /** Score number color (tier); defaults to `color`. */
  scoreColor?: string;
  /** Skin scan lens key (Texture / Redness / Pores / Wrinkles). */
  lens?: AuraSkinLens;
};

/**
 * SVG radar chart — shared by Analysis Overview modal and Post-Visit Blueprint.
 * When every datum has `color`, renders color-coded wedges per axis (skin lens mode).
 */
export function RadarChart({
  data,
  size = 180,
  animate,
  showLabels = true,
  className,
  labelClassName = "ao-radar__label",
  showRingValues = false,
}: {
  data: RadarChartDatum[];
  size?: number;
  animate: boolean;
  showLabels?: boolean;
  className?: string;
  /** e.g. `pvb-radar__label` on blueprint page */
  labelClassName?: string;
  /** Show 25/50/75/100 ring labels (skin lens radar). */
  showRingValues?: boolean;
}) {
  /* Extra inset when labeled: side anchors need room for text (textAnchor middle extends both ways). */
  const padding = showLabels
    ? Math.max(44, Math.round(size * 0.22))
    : Math.min(6, size / 10);
  const svgSize = size + padding * 2;
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const r = size / 2 - (showLabels ? 16 : 5);
  /** Just past the 100% ring + vertex dots, without pushing labels into the clip edge */
  const labelRadiusPct = 112;
  const n = data.length;
  if (n < 3) return null;
  const angleStep = (2 * Math.PI) / n;
  const rings = showLabels ? [25, 50, 75, 100] : [50, 100];

  const pointAt = (i: number, val: number) => {
    const angle = -Math.PI / 2 + i * angleStep;
    const dist = (val / 100) * r;
    return { x: cx + dist * Math.cos(angle), y: cy + dist * Math.sin(angle) };
  };

  /** Keep label copy outside the web: left → text flows left; right → flows right; top/bottom stay centered. */
  const labelTextAnchor = (px: number): "start" | "middle" | "end" => {
    const eps = 6;
    if (px < cx - eps) return "end";
    if (px > cx + eps) return "start";
    return "middle";
  };

  const lensColored = data.length > 0 && data.every((d) => d.color);
  const dataPoints = data.map((d, i) => pointAt(i, animate ? d.score : 0));
  const polygon = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div
      className={`ao-radar${lensColored ? " ao-radar--skin-lens" : ""} ${className ?? ""}`.trim()}
    >
      <svg
        width={svgSize}
        height={svgSize}
        viewBox={`0 0 ${svgSize} ${svgSize}`}
        overflow="visible"
      >
        {rings.map((ringVal) => (
          <polygon
            key={ringVal}
            points={Array.from({ length: n }, (_, i) => {
              const p = pointAt(i, ringVal);
              return `${p.x},${p.y}`;
            }).join(" ")}
            fill="none"
            stroke="var(--ao-radar-grid-stroke, rgba(0, 0, 0, 0.1))"
            strokeWidth="1"
          />
        ))}
        {showRingValues &&
          rings.map((ringVal) => {
            const p = pointAt(0, ringVal);
            return (
              <text
                key={`ring-${ringVal}`}
                x={p.x - 10}
                y={p.y}
                textAnchor="end"
                dominantBaseline="middle"
                className="ao-radar__ring-value"
                fontSize="9"
                fill="var(--ao-radar-ring-label, rgba(100, 116, 139, 0.85))"
              >
                {ringVal}
              </text>
            );
          })}
        {lensColored
          ? data.map((d, i) => {
              const pScore = dataPoints[i];
              const pNext = dataPoints[(i + 1) % n];
              return (
                <path
                  key={`wedge-${d.name}`}
                  d={`M ${cx} ${cy} L ${pScore.x} ${pScore.y} L ${pNext.x} ${pNext.y} Z`}
                  fill={d.color}
                  fillOpacity={animate ? 0.2 : 0}
                  stroke="none"
                  style={{ transition: "fill-opacity 0.6s ease-out" }}
                />
              );
            })
          : null}
        {data.map((d, i) => {
          const p = pointAt(i, 100);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={p.x}
              y2={p.y}
              stroke={d.color ?? "var(--ao-radar-axis-stroke, rgba(0, 0, 0, 0.12))"}
              strokeWidth={lensColored ? 1.25 : 1}
              strokeOpacity={lensColored ? 0.55 : 1}
            />
          );
        })}
        <polygon
          points={polygon}
          fill={
            lensColored
              ? "rgba(255, 255, 255, 0.06)"
              : "var(--ao-radar-data-fill, rgba(59, 130, 246, 0.15))"
          }
          stroke={
            lensColored
              ? "rgba(148, 163, 184, 0.45)"
              : "var(--ao-radar-data-stroke, #3b82f6)"
          }
          strokeWidth={showLabels ? 2 : 1.5}
          style={{ transition: "all 0.6s ease-out" }}
        />
        {dataPoints.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={showLabels ? 4 : 2}
            fill={data[i].color ?? "var(--ao-radar-point-fill, #3b82f6)"}
            stroke={lensColored ? "#fff" : "none"}
            strokeWidth={lensColored ? 1.5 : 0}
            style={{ transition: "all 0.6s ease-out" }}
          />
        ))}
        {showLabels &&
          data.map((d, i) => {
            const p = pointAt(i, labelRadiusPct);
            const anchor = labelTextAnchor(p.x);
            const scoreFill = d.scoreColor ?? d.color ?? "currentColor";
            return (
              <text
                key={d.name}
                x={p.x}
                y={p.y}
                textAnchor={anchor}
                dominantBaseline="middle"
                className={labelClassName}
              >
                <tspan x={p.x} dy={lensColored ? "-0.45em" : 0} fill={d.color ?? "currentColor"}>
                  {d.name}
                </tspan>
                {lensColored ? (
                  <tspan
                    x={p.x}
                    dy="1.15em"
                    fill={scoreFill}
                    fontWeight={700}
                    className="ao-radar__score-value"
                  >
                    {Math.round(animate ? d.score : 0)}
                  </tspan>
                ) : null}
              </text>
            );
          })}
      </svg>
    </div>
  );
}
