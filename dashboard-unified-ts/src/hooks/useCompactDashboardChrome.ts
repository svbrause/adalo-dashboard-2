import { useEffect, useState } from "react";

/**
 * Overlay nav (hamburger + slide-out) only on phone widths.
 * iPad / tablet keep the persistent sidebar — avoids dimmed screen with no visible menu.
 */
export const DASHBOARD_OVERLAY_NAV_MAX_PX = 768;

/** @deprecated Use DASHBOARD_OVERLAY_NAV_MAX_PX */
export const DASHBOARD_COMPACT_CHROME_MAX_PX = DASHBOARD_OVERLAY_NAV_MAX_PX;

const COMPACT_MQ = `(max-width: ${DASHBOARD_OVERLAY_NAV_MAX_PX}px)`;

/** True when the sidebar should be a slide-out drawer (not a persistent column). */
export function useCompactDashboardChrome(): boolean {
  const [compact, setCompact] = useState(
    () => typeof window !== "undefined" && window.matchMedia(COMPACT_MQ).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(COMPACT_MQ);
    const onChange = () => setCompact(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return compact;
}
