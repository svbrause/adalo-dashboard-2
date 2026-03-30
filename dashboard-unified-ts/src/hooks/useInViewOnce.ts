import { useEffect, useRef, useState } from "react";

/**
 * Returns [ref, inView] where `inView` becomes true once the element
 * enters the viewport (via IntersectionObserver) and stays true.
 *
 * Falls back to `true` immediately when IntersectionObserver is unavailable.
 */
export function useInViewOnce<T extends Element>(
  rootMargin = "0px 0px -10% 0px",
  threshold = 0.1,
): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(() => {
    // SSR / very old browsers — treat as visible
    return typeof IntersectionObserver === "undefined";
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (inView) return; // already triggered, skip

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView, rootMargin, threshold]);

  return [ref, inView];
}
