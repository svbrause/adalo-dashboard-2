import { useState } from "react";
import {
  normalizeIssue,
  scoreTier,
  tierColor,
} from "../../config/analysisOverviewConfig";
import type { ThemeSummary } from "../../config/analysisOverviewConfig";
import "./FeatureBreakdownRows.css";

/** Matches Analysis Overview category drill-down — collapsible row + per-feature ✓/✕ pills */
export function SubScoreFeatureRow({
  subScore,
  issues,
  detectedIssues,
  animate,
  variant = "default",
}: {
  subScore: {
    name: string;
    score: number;
    total: number;
    detected: number;
  };
  issues: string[];
  detectedIssues: Set<string>;
  animate: boolean;
  /** default: progress bar + score; minimal: name + score only (less visual noise in modals) */
  variant?: "default" | "minimal";
}) {
  const [expanded, setExpanded] = useState(false);
  const color = tierColor(scoreTier(subScore.score));

  const goodIssues = issues.filter((i) => !detectedIssues.has(normalizeIssue(i)));
  const badIssues = issues.filter((i) => detectedIssues.has(normalizeIssue(i)));

  const minimal = variant === "minimal";

  return (
    <div
      className={`ao-subscore-row ${expanded ? "ao-subscore-row--open" : ""}${minimal ? " ao-subscore-row--minimal" : ""}`}
    >
      <button
        type="button"
        className="ao-subscore-row__header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="ao-subscore-row__name">{subScore.name}</span>
        {!minimal && (
          <div className="ao-subscore-row__bar-wrap">
            <div className="ao-subscore-row__bar-track">
              <div
                className="ao-subscore-row__bar-fill"
                style={{
                  width: animate ? `${subScore.score}%` : "0%",
                  background: color,
                  transition: animate ? "width 0.8s ease-out" : "none",
                }}
              />
            </div>
            <span className="ao-subscore-row__score" style={{ color }}>
              {subScore.score}
            </span>
          </div>
        )}
        {minimal && (
          <span className="ao-subscore-row__score ao-subscore-row__score--solo" style={{ color }}>
            {subScore.score}
          </span>
        )}
        <span className="ao-subscore-row__chev" aria-hidden>
          {expanded ? "▲" : "▼"}
        </span>
      </button>
      {expanded && (
        <div className="ao-subscore-row__pills">
          {goodIssues.map((issue) => (
            <span key={issue} className="ao-pill ao-pill--good">
              <span className="ao-pill__icon">✓</span>
              {issue}
            </span>
          ))}
          {badIssues.map((issue) => (
            <span key={issue} className="ao-pill ao-pill--concern">
              <span className="ao-pill__icon">✕</span>
              {issue}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Matches Analysis Overview area drill-down — theme row + ✓/✕ pills */
export function AreaThemeFeatureRow({
  theme,
  detectedIssues,
  variant = "default",
}: {
  theme: ThemeSummary;
  detectedIssues: Set<string>;
  variant?: "default" | "minimal";
}) {
  const [expanded, setExpanded] = useState(false);
  const score =
    theme.totalCount > 0
      ? Math.round(
          ((theme.totalCount - theme.detectedCount) / theme.totalCount) * 100,
        )
      : 100;
  const color = tierColor(scoreTier(score));
  const goodIssues = theme.issues.filter((i) => !detectedIssues.has(normalizeIssue(i)));
  const badIssues = theme.issues.filter((i) => detectedIssues.has(normalizeIssue(i)));

  const minimal = variant === "minimal";

  return (
    <div
      className={`ao-subscore-row ${expanded ? "ao-subscore-row--open" : ""}${minimal ? " ao-subscore-row--minimal" : ""}`}
    >
      <button
        type="button"
        className="ao-subscore-row__header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="ao-subscore-row__name">{theme.label}</span>
        {!minimal && (
          <div className="ao-subscore-row__bar-wrap">
            <div className="ao-subscore-row__bar-track">
              <div
                className="ao-subscore-row__bar-fill"
                style={{
                  width: `${score}%`,
                  background: color,
                }}
              />
            </div>
            <span className="ao-subscore-row__score" style={{ color }}>
              {score}
            </span>
          </div>
        )}
        {minimal && (
          <span className="ao-subscore-row__score ao-subscore-row__score--solo" style={{ color }}>
            {score}
          </span>
        )}
        <span className="ao-subscore-row__chev" aria-hidden>
          {expanded ? "▲" : "▼"}
        </span>
      </button>
      {expanded && (
        <div className="ao-subscore-row__pills">
          {goodIssues.map((issue) => (
            <span key={issue} className="ao-pill ao-pill--good">
              <span className="ao-pill__icon">✓</span>
              {issue}
            </span>
          ))}
          {badIssues.map((issue) => (
            <span key={issue} className="ao-pill ao-pill--concern">
              <span className="ao-pill__icon">✕</span>
              {issue}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
