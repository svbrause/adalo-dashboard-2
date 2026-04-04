import { useMemo } from "react";
import { useInViewOnce } from "../../hooks/useInViewOnce";
import { useSequentialTypewriter } from "../../hooks/useSequentialTypewriter";
import "./PvbNarrative.css";

export type PvbOverviewSectionForTypewriter = {
  heading: string;
  text: string;
};

/**
 * Types overview headings and bodies in strict order: heading₁ → body₁ → heading₂ → body₂ → …
 * (One IntersectionObserver + one typewriter stream; avoids parallel instances per section.)
 */
export function PvbOverviewSectionsSequentialTypewriter({
  sections,
  paragraphClassName,
  titleClassName,
  msPerChar = 15,
}: {
  sections: readonly PvbOverviewSectionForTypewriter[];
  paragraphClassName?: string;
  titleClassName?: string;
  msPerChar?: number;
}) {
  const paragraphs = useMemo(
    () => sections.flatMap((s) => [s.heading, s.text]),
    [sections],
  );
  const [containerRef, inView] = useInViewOnce<HTMLDivElement>();
  const lines = useSequentialTypewriter(paragraphs, msPerChar, inView);
  const firstIncomplete = lines.findIndex(
    (l, i) => l.length < (paragraphs[i]?.length ?? 0),
  );

  if (sections.length === 0) return null;

  return (
    <div ref={containerRef}>
      {sections.map((_, i) => {
        const hIdx = i * 2;
        const bIdx = i * 2 + 1;
        return (
          <section key={i} className="pvb-overview-section">
            <h3 className={titleClassName ?? "pvb-overview-section-title"}>
              {lines[hIdx]}
              {firstIncomplete === hIdx ? (
                <span className="pvb-typewriter-caret" aria-hidden />
              ) : null}
            </h3>
            <p className={paragraphClassName}>
              {lines[bIdx]}
              {firstIncomplete === bIdx ? (
                <span className="pvb-typewriter-caret" aria-hidden />
              ) : null}
            </p>
          </section>
        );
      })}
    </div>
  );
}

export function PvbTypewriterParagraphs({
  paragraphs,
  paragraphClassName,
  msPerChar = 15,
}: {
  paragraphs: readonly string[];
  paragraphClassName?: string;
  msPerChar?: number;
}) {
  const [containerRef, inView] = useInViewOnce<HTMLDivElement>();
  const lines = useSequentialTypewriter(paragraphs, msPerChar, inView);
  const firstIncomplete = lines.findIndex((l, i) => l.length < (paragraphs[i]?.length ?? 0));

  if (paragraphs.length === 0) return null;

  return (
    <div ref={containerRef}>
      {paragraphs.map((_, i) => (
        <p key={i} className={paragraphClassName}>
          {lines[i]}
          {firstIncomplete === i ? <span className="pvb-typewriter-caret" aria-hidden /> : null}
        </p>
      ))}
    </div>
  );
}
