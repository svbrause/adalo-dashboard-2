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
  const lines = useSequentialTypewriter(paragraphs, msPerChar);
  const firstIncomplete = lines.findIndex((l, i) => l.length < (paragraphs[i]?.length ?? 0));

  if (paragraphs.length === 0) return null;

  return (
    <>
      {paragraphs.map((_, i) => (
        <p key={i} className={paragraphClassName}>
          {lines[i]}
          {firstIncomplete === i ? <span className="pvb-typewriter-caret" aria-hidden /> : null}
        </p>
      ))}
    </>
  );
}
