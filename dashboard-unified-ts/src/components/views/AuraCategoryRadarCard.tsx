import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { CategoryResult } from "../../config/analysisOverviewConfig";
import type { AuraSkinLens } from "../../utils/auraAnalysisBridge";
import { PolarAreaChart } from "../postVisitBlueprint/PolarAreaChart";
import { RadarChart, type RadarChartDatum } from "../postVisitBlueprint/RadarChart";

interface AuraCategoryRadarCardProps {
  activeCat: CategoryResult;
  categoryAccent: string;
  /** When set (e.g. skin Texture / Redness / Pores), replaces category sub-scores on the chart. */
  radarDataOverride?: RadarChartDatum[];
  chartAriaLabel?: string;
  /** Skin lens Nightingale / polar area chart (Texture, Redness, Pores). */
  skinLensPolarArea?: boolean;
  /** Matches left-panel Texture / Redness / Pores / Wrinkles tab. */
  activeSkinLens?: AuraSkinLens;
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

/** Spider chart for the active Skin / Volume / Structure category (sub-score dimensions). */
export default function AuraCategoryRadarCard({
  activeCat,
  categoryAccent,
  radarDataOverride,
  chartAriaLabel,
  skinLensPolarArea = false,
  activeSkinLens,
}: AuraCategoryRadarCardProps) {
  const [animate, setAnimate] = useState(false);

  const radarData = useMemo(
    () =>
      radarDataOverride ??
      activeCat.subScores.map((s) => ({ name: s.name, score: s.score })),
    [activeCat, radarDataOverride],
  );

  const radarKey = radarDataOverride
    ? radarData.map((d) => d.name).join("|")
    : activeCat.key;

  useEffect(() => {
    setAnimate(false);
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
  }, [radarKey]);

  const accentStyle = {
    "--aura-radar-accent": categoryAccent,
  } as CSSProperties;

  return (
    <div
      className="aura-embedded-panel__radar-wrap"
      style={accentStyle}
      aria-label={chartAriaLabel ?? `${activeCat.scoreLabel} sub-score chart`}
    >
      {skinLensPolarArea && radarData.length >= 2 ? (
        <PolarAreaChart
          data={radarData}
          size={200}
          animate={animate}
          className="aura-embedded-panel__polar-area"
          activeLens={activeSkinLens}
        />
      ) : radarData.length >= 3 ? (
        <RadarChart
          data={radarData}
          size={200}
          animate={animate}
          showLabels
          className="aura-embedded-panel__radar"
          labelClassName="aura-embedded-panel__radar-label"
        />
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
