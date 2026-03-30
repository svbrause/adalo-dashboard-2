import { useInViewOnce } from "../../hooks/useInViewOnce";
import { useSequentialTypewriter } from "../../hooks/useSequentialTypewriter";
import "./PvbNarrative.css";

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
