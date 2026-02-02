// Discussed Treatments Modal – hooks

import { useState, useEffect } from "react";

/** Hook: true when viewport is narrow (e.g. mobile). Use for native select fallbacks. */
export function useIsNarrowScreen(maxWidthPx = 768): boolean {
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia(`(max-width: ${maxWidthPx}px)`).matches
      : false
  );
  useEffect(() => {
    const m = window.matchMedia(`(max-width: ${maxWidthPx}px)`);
    const onChange = () => setIsNarrow(m.matches);
    m.addEventListener("change", onChange);
    return () => m.removeEventListener("change", onChange);
  }, [maxWidthPx]);
  return isNarrow;
}
