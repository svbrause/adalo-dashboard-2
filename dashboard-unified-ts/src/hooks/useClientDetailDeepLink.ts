import { useEffect, useRef } from "react";
import type { ClientDetailSection } from "../utils/dashboardRoutes";

type DeepLinkActions = {
  openAnalysis: () => void;
  openRecommender: () => void;
  openQuiz: () => void;
  openBlueprint: () => void;
  focusMirror: () => void;
};

/** Applies `?section=` deep link once per client+section. */
export function useClientDetailDeepLink(
  clientId: string | undefined,
  initialSection: ClientDetailSection | undefined,
  actions: DeepLinkActions,
) {
  const appliedRef = useRef<string | null>(null);
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    if (!clientId || !initialSection) return;
    const key = `${clientId}:${initialSection}`;
    if (appliedRef.current === key) return;
    appliedRef.current = key;

    const a = actionsRef.current;
    switch (initialSection) {
      case "analysis":
        a.openAnalysis();
        break;
      case "recommender":
        a.openRecommender();
        break;
      case "quiz":
        a.openQuiz();
        break;
      case "blueprint":
        a.openBlueprint();
        break;
      case "mirror":
        a.focusMirror();
        break;
      default:
        break;
    }
  }, [clientId, initialSection]);
}
