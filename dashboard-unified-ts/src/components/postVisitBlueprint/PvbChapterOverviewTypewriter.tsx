import { useMemo } from "react";
import { useSequentialTypewriter } from "../../hooks/useSequentialTypewriter";
import type { ChapterOverviewParts } from "../../utils/pvbOverviewNarratives";
import { buildChapterOverviewTypewriterParagraphs } from "../../utils/pvbOverviewSpeechText";
import "./PvbNarrative.css";

export function PvbChapterOverviewTypewriter({
  chapterOverview,
}: {
  chapterOverview: ChapterOverviewParts;
}) {
  const paragraphs = useMemo(
    () => buildChapterOverviewTypewriterParagraphs(chapterOverview),
    [chapterOverview],
  );
  const lines = useSequentialTypewriter(paragraphs, 14);
  const bulletCount = chapterOverview.planBullets.length;
  const lineIdx = lines.findIndex((l, i) => l.length < (paragraphs[i]?.length ?? 0));

  const bulletLines = chapterOverview.planBullets.map((_, i) => lines[i] ?? "");
  const analysisLine = lines[bulletCount] ?? "";

  return (
    <>
      {bulletCount > 0 ? (
        <ul className="tc-overview-plan">
          {chapterOverview.planBullets.map((_, i) => (
            <li key={i}>
              {bulletLines[i]}
              {lineIdx === i ? <span className="pvb-typewriter-caret" aria-hidden /> : null}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="tc-overview-analysis">
        {analysisLine}
        {lineIdx === bulletCount ? <span className="pvb-typewriter-caret" aria-hidden /> : null}
      </p>
    </>
  );
}
