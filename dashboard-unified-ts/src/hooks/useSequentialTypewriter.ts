import { useEffect, useMemo, useState } from "react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

/**
 * Reveals each paragraph character-by-character in order.
 * When `prefers-reduced-motion` is set, or `active` is false,
 * the animation is paused / returns full paragraphs immediately.
 */
export function useSequentialTypewriter(
  paragraphs: readonly string[],
  msPerChar: number,
  /** When false the typewriter stays paused. Defaults to true. */
  active = true,
): readonly string[] {
  const reducedMotion = usePrefersReducedMotion();
  const stableKey = paragraphs.join("\u0001");
  const [lineIdx, setLineIdx] = useState(0);
  const [col, setCol] = useState(0);

  useEffect(() => {
    setLineIdx(0);
    setCol(0);
  }, [stableKey]);

  useEffect(() => {
    if (reducedMotion) return;
    if (!active) return;
    if (paragraphs.length === 0) return;
    if (lineIdx >= paragraphs.length) return;

    const line = paragraphs[lineIdx] ?? "";
    if (line.length === 0) {
      if (lineIdx + 1 < paragraphs.length) {
        const t = window.setTimeout(() => {
          setLineIdx((i) => i + 1);
          setCol(0);
        }, 0);
        return () => window.clearTimeout(t);
      }
      return;
    }

    if (col < line.length) {
      const t = window.setTimeout(() => setCol((c) => c + 1), msPerChar);
      return () => window.clearTimeout(t);
    }

    if (lineIdx + 1 < paragraphs.length) {
      const t = window.setTimeout(() => {
        setLineIdx((i) => i + 1);
        setCol(0);
      }, 0);
      return () => window.clearTimeout(t);
    }
  }, [reducedMotion, active, paragraphs, stableKey, lineIdx, col, msPerChar]);

  return useMemo(() => {
    if (reducedMotion) return [...paragraphs];
    if (paragraphs.length === 0) return [];
    return paragraphs.map((p, i) =>
      i < lineIdx ? p : i === lineIdx ? p.slice(0, col) : "",
    );
  }, [reducedMotion, stableKey, paragraphs, lineIdx, col]);
}
