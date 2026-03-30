import { useMemo } from "react";
import { useInViewOnce } from "../../hooks/useInViewOnce";
import { useSequentialTypewriter } from "../../hooks/useSequentialTypewriter";
import type { ChapterOverviewParts } from "../../utils/pvbOverviewNarratives";
import {
  buildChapterOverviewTypewriterLayout,
  type ChapterOverviewTypewriterRole,
} from "../../utils/pvbOverviewSpeechText";
import "./PvbNarrative.css";

export function PvbChapterOverviewTypewriter({
  chapterOverview,
}: {
  chapterOverview: ChapterOverviewParts;
}) {
  const [containerRef, inView] = useInViewOnce<HTMLDivElement>();

  const { paragraphs, roles } = useMemo(
    () => buildChapterOverviewTypewriterLayout(chapterOverview),
    [chapterOverview],
  );
  const lines = useSequentialTypewriter(paragraphs, 14, inView);

  const lineIdx = lines.findIndex((l, i) => l.length < (paragraphs[i]?.length ?? 0));

  const lineByRole = useMemo(() => {
    const map: Partial<{
      top: string;
      intro: string;
      analysis: string;
      bottom: string;
      bullets: Record<number, string>;
    }> = { bullets: {} };
    roles.forEach((role, i) => {
      const line = lines[i] ?? "";
      switch (role.kind) {
        case "top":
          map.top = line;
          break;
        case "intro":
          map.intro = line;
          break;
        case "bullet":
          map.bullets![role.bulletIndex] = line;
          break;
        case "analysis":
          map.analysis = line;
          break;
        case "bottom":
          map.bottom = line;
          break;
        default:
          break;
      }
    });
    return map;
  }, [roles, lines]);

  const paraIndexForRole = (
    kind: ChapterOverviewTypewriterRole["kind"],
    bulletIndex?: number,
  ) =>
    roles.findIndex((r) => {
      if (kind === "bullet") {
        return r.kind === "bullet" && r.bulletIndex === bulletIndex;
      }
      return r.kind === kind;
    });

  if (paragraphs.length === 0) return null;

  const hasTop = Boolean(chapterOverview.complementTop?.trim());
  const hasIntro = Boolean(chapterOverview.intro?.trim());
  const hasBullets = chapterOverview.planBullets.some((b) => b.trim());
  const hasAnalysis = Boolean(chapterOverview.analysis?.trim());
  const hasBottom = Boolean(chapterOverview.complementBottom?.trim());

  const topParaIdx = paraIndexForRole("top");
  const introParaIdx = paraIndexForRole("intro");
  const analysisParaIdx = paraIndexForRole("analysis");
  const bottomParaIdx = paraIndexForRole("bottom");

  const topLine = lineByRole.top ?? "";
  const introLine = lineByRole.intro ?? "";
  const analysisLine = lineByRole.analysis ?? "";
  const bottomLine = lineByRole.bottom ?? "";

  const visibleBulletRows = chapterOverview.planBullets
    .map((b, i) => {
      const line = lineByRole.bullets?.[i] ?? "";
      if (!b.trim() || !line) return null;
      return { i, line, paraIdx: paraIndexForRole("bullet", i) };
    })
    .filter((v): v is { i: number; line: string; paraIdx: number } => Boolean(v));

  return (
    <div ref={containerRef}>
      {hasTop && topLine ? (
        <p className="tc-overview-complement tc-overview-complement--top">
          {topLine}
          {lineIdx === topParaIdx ? <span className="pvb-typewriter-caret" aria-hidden /> : null}
        </p>
      ) : null}
      {hasIntro && introLine ? (
        <p className="tc-overview-category-intro">
          {introLine}
          {lineIdx === introParaIdx ? <span className="pvb-typewriter-caret" aria-hidden /> : null}
        </p>
      ) : null}
      {hasBullets && visibleBulletRows.length > 0 ? (
        <ul className="tc-overview-plan">
          {visibleBulletRows.map(({ i, line, paraIdx }) => (
            <li key={i}>
              {line}
              {lineIdx === paraIdx ? <span className="pvb-typewriter-caret" aria-hidden /> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {hasAnalysis && analysisLine ? (
        <p className="tc-overview-analysis">
          {analysisLine}
          {lineIdx === analysisParaIdx ? (
            <span className="pvb-typewriter-caret" aria-hidden />
          ) : null}
        </p>
      ) : null}
      {hasBottom && bottomLine ? (
        <p className="tc-overview-complement tc-overview-complement--bottom">
          {bottomLine}
          {lineIdx === bottomParaIdx ? <span className="pvb-typewriter-caret" aria-hidden /> : null}
        </p>
      ) : null}
    </div>
  );
}
