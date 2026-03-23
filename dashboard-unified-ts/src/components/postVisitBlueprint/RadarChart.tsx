/**
 * SVG radar / spider chart — shared by Analysis Overview modal and Post-Visit Blueprint.
 */
export function RadarChart({
  data,
  size = 180,
  animate,
  showLabels = true,
  className,
  labelClassName = "ao-radar__label",
}: {
  data: { name: string; score: number }[];
  size?: number;
  animate: boolean;
  showLabels?: boolean;
  className?: string;
  /** e.g. `pvb-radar__label` on blueprint page */
  labelClassName?: string;
}) {
  /* Tight canvas; keep enough inset so axis labels don’t clip */
  const padding = showLabels ? 26 : Math.min(6, size / 10);
  const svgSize = size + padding * 2;
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const r = size / 2 - (showLabels ? 16 : 5);
  const n = data.length;
  if (n < 3) return null;
  const angleStep = (2 * Math.PI) / n;
  const rings = showLabels ? [25, 50, 75, 100] : [50, 100];

  const pointAt = (i: number, val: number) => {
    const angle = -Math.PI / 2 + i * angleStep;
    const dist = (val / 100) * r;
    return { x: cx + dist * Math.cos(angle), y: cy + dist * Math.sin(angle) };
  };

  const dataPoints = data.map((d, i) => pointAt(i, animate ? d.score : 0));
  const polygon = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className={`ao-radar ${className ?? ""}`.trim()}>
      <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
        {rings.map((ringVal) => (
          <polygon
            key={ringVal}
            points={Array.from({ length: n }, (_, i) => {
              const p = pointAt(i, ringVal);
              return `${p.x},${p.y}`;
            }).join(" ")}
            fill="none"
            stroke="rgba(0,0,0,0.08)"
            strokeWidth="1"
          />
        ))}
        {data.map((_, i) => {
          const p = pointAt(i, 100);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={p.x}
              y2={p.y}
              stroke="rgba(0,0,0,0.06)"
              strokeWidth="1"
            />
          );
        })}
        <polygon
          points={polygon}
          fill="rgba(59,130,246,0.15)"
          stroke="#3b82f6"
          strokeWidth={showLabels ? 2 : 1.5}
          style={{ transition: "all 0.6s ease-out" }}
        />
        {dataPoints.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={showLabels ? 3.5 : 2}
            fill="#3b82f6"
            style={{ transition: "all 0.6s ease-out" }}
          />
        ))}
        {showLabels &&
          data.map((d, i) => {
            const p = pointAt(i, 118);
            return (
              <text
                key={d.name}
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className={labelClassName}
              >
                {d.name}
              </text>
            );
          })}
      </svg>
    </div>
  );
}
