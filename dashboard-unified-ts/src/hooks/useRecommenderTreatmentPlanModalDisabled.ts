import { useEffect, useState } from "react";

/** Matches `max-width: 768px` mobile rules elsewhere in the dashboard. */
const MQ = "(max-width: 768px)";

/**
 * When true, treatment recommender should not open DiscussedTreatmentsModal
 * (full treatment plan screen) — not yet optimised for mobile.
 */
export function useRecommenderTreatmentPlanModalDisabled(): boolean {
  const [disabled, setDisabled] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(MQ).matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(MQ);
    const onChange = () => setDisabled(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return disabled;
}
