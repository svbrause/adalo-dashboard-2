import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  tierColor,
  type CategoryResult,
} from "../../config/analysisOverviewConfig";
import {
  isAuraAnalysisAreaFiltered,
  type AuraSkinLens,
} from "../../utils/auraAnalysisBridge";
import { PolarAreaChart } from "../postVisitBlueprint/PolarAreaChart";
import type { RadarChartDatum } from "../postVisitBlueprint/RadarChart";

interface AuraCategoryRadarCardProps {
  activeCat: CategoryResult;
  categoryAccent: string;
  /** When set (e.g. skin lenses), replaces category sub-scores on the chart. */
  radarDataOverride?: RadarChartDatum[];
  chartAriaLabel?: string;
  /** Matches left-panel Pigmentation / Texture / Redness / Pores / Wrinkles tab. */
  activeSkinLens?: AuraSkinLens;
  /** Matches left-panel Volume / Structure area tab (Eye Area, Cheek Area, …). */
  activeAnalysisArea?: string;
}

function SubScoreBars({
  activeCat,
  animate,
  accentColor,
}: {
  activeCat: CategoryResult;
  animate: boolean;
  accentColor: string;
}) {
  return (
    <div className="aura-embedded-panel__radar-bars">
      {activeCat.subScores.map((s) => {
        return (
          <div key={s.name} className="aura-embedded-panel__radar-bar">
            <div className="aura-embedded-panel__radar-bar-head">
              <span className="aura-embedded-panel__radar-bar-label">{s.name}</span>
              <span className="aura-embedded-panel__radar-bar-score" style={{ color: accentColor }}>
                {s.score}
              </span>
            </div>
            <div className="aura-embedded-panel__radar-bar-track">
              <div
                className="aura-embedded-panel__radar-bar-fill"
                style={{
                  width: animate ? `${s.score}%` : "0%",
                  background: accentColor,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function categoryPolarRadarData(activeCat: CategoryResult): RadarChartDatum[] {
  return activeCat.subScores.map((s) => ({
    name: s.name,
    score: s.score,
    color: tierColor(s.tier),
    scoreColor: tierColor(s.tier),
  }));
}

/** Coxcomb chart for Skin / Volume / Structure (matches skin lens chart in analysis view). */
export default function AuraCategoryRadarCard({
  activeCat,
  categoryAccent,
  radarDataOverride,
  chartAriaLabel,
  activeSkinLens,
  activeAnalysisArea,
}: AuraCategoryRadarCardProps) {
  const [animate, setAnimate] = useState(false);

  const radarData = useMemo(
    () => radarDataOverride ?? categoryPolarRadarData(activeCat),
    [activeCat, radarDataOverride],
  );

  const radarKey = radarData
    .map((d) => `${d.name}:${Math.round(d.score)}`)
    .join("|");

  useEffect(() => {
    setAnimate(false);
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
  }, [radarKey]);

  const accentStyle = {
    "--aura-radar-accent": categoryAccent,
    "--aura-chart-key-high": tierColor("attention"),
    "--aura-chart-key-mid": tierColor("moderate"),
    "--aura-chart-key-low": tierColor("excellent"),
  } as CSSProperties;

  return (
    <div
      className="aura-embedded-panel__radar-wrap"
      style={accentStyle}
      aria-label={chartAriaLabel ?? `${activeCat.scoreLabel} sub-score chart`}
    >
      {radarData.length >= 2 ? (
        <>
          <PolarAreaChart
            data={radarData}
            size={320}
            animate={animate}
            className="aura-embedded-panel__polar-area"
            activeLens={activeSkinLens}
            activePetalName={
              isAuraAnalysisAreaFiltered(activeAnalysisArea) && !activeSkinLens
                ? activeAnalysisArea
                : undefined
            }
            ariaLabel={
              chartAriaLabel ??
              `${activeCat.name} health scores from 0 to 100; higher scores draw larger petals`
            }
          />
          <div className="aura-embedded-panel__chart-key" aria-label="Severity key">
            <span className="aura-embedded-panel__chart-key-gradient" aria-hidden />
            <div className="aura-embedded-panel__chart-key-copy">
              <span className="aura-embedded-panel__chart-key-title">Severity</span>
              <span className="aura-embedded-panel__chart-key-scale">
                <span className="aura-embedded-panel__chart-key-end aura-embedded-panel__chart-key-end--high">
                  High
                </span>
                <span className="aura-embedded-panel__chart-key-end aura-embedded-panel__chart-key-end--low">
                  Low
                </span>
              </span>
            </div>
          </div>
        </>
      ) : (
        <SubScoreBars
          activeCat={activeCat}
          animate={animate}
          accentColor={categoryAccent}
        />
      )}
    </div>
  );
}
