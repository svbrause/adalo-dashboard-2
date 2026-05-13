/**
 * Mini circular gauge styled like Analysis Overview `ScoreGauge`: thick stroke, tier color,
 * arc length = health (100 − badness), score 0–100 centered inside.
 */
import { scoreTier, tierColor } from "../../config/analysisOverviewConfig";
import "./SeverityNormRing.css";

export function SeverityNormRing({
  badness01,
  fraction,
  size = 56,
  strokeWidth: strokeWidthProp,
}: {
  /** Detector “badness” 0–1; health score inside ring = round((1 − badness) × 100) */
  badness01?: number;
  /** @deprecated same as badness01 */
  fraction?: number;
  size?: number;
  strokeWidth?: number;
}) {
  const raw = badness01 ?? fraction;
  const b = Math.max(
    0,
    Math.min(1, typeof raw === "number" && Number.isFinite(raw) ? raw : 0),
  );
  const healthScore = Math.round(Math.max(0, Math.min(100, (1 - b) * 100)));
  const strokeWidth =
    strokeWidthProp ?? Math.max(5, (10 * size) / 120);

  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (healthScore / 100) * circumference;
  const offset = circumference - progress;
  const color = tierColor(scoreTier(healthScore));

  const valueFontPx = Math.max(13, Math.min(22, Math.round(size * 0.31)));

  return (
    <div
      className="ao-modal-gauge ao-severity-norm-ring"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(0,0,0,0.08)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ao-modal-gauge__inner ao-severity-norm-ring__inner">
        <span
          className="ao-modal-gauge__value ao-severity-norm-ring__value"
          style={{ fontSize: valueFontPx }}
        >
          {healthScore}
        </span>
      </div>
    </div>
  );
}
