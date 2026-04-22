import { useCallback, useEffect, useRef, useState } from "react";
import type { Client, DiscussedItem } from "../types";
import { useDashboard } from "../context/DashboardContext";
import { persistClientDiscussedItems } from "../utils/wellnestDemoPlanPersistence";
import { showError } from "../utils/toast";

type OnUpdate = () => void | Promise<void>;

interface UseVisitModePlanSyncArgs {
  client: Client | null;
  onUpdate: OnUpdate;
}

function applyTimelineOverrides(
  items: DiscussedItem[],
  overrides: Map<string, string>,
): DiscussedItem[] {
  if (overrides.size === 0) return items;

  let changed = false;
  const nextItems = items.map((item) => {
    const timeline = overrides.get(item.id);
    if (timeline === undefined || item.timeline === timeline) return item;
    changed = true;
    return { ...item, timeline };
  });

  return changed ? nextItems : items;
}

export function useVisitModePlanSync({
  client,
  onUpdate,
}: UseVisitModePlanSyncArgs) {
  const {
    cacheClientDiscussedItemTimeline,
    clearClientDiscussedItemTimelineCache,
  } = useDashboard();
  const [optimisticTimelines, setOptimisticTimelines] = useState<
    Map<string, string>
  >(() => new Map());
  const clientRef = useRef<Client | null>(client);
  const latestPlanItemsRef = useRef<DiscussedItem[]>(
    client?.discussedItems ?? [],
  );
  const optimisticTimelinesRef = useRef<Map<string, string>>(new Map());
  const persistQueueRef = useRef<Promise<void>>(Promise.resolve());
  const mutationSequenceRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    clientRef.current = client;
    latestPlanItemsRef.current = applyTimelineOverrides(
      client?.discussedItems ?? [],
      optimisticTimelinesRef.current,
    );
  }, [client]);

  // Keep local overrides only until the shared dashboard cache or backend has the same value.
  useEffect(() => {
    const serverItems = client?.discussedItems ?? [];
    if (optimisticTimelinesRef.current.size === 0) {
      latestPlanItemsRef.current = serverItems;
      return;
    }

    setOptimisticTimelines((prev) => {
      if (prev.size === 0) {
        optimisticTimelinesRef.current = prev;
        latestPlanItemsRef.current = serverItems;
        return prev;
      }

      let changed = false;
      const next = new Map(prev);
      for (const [id, optimisticTimeline] of prev) {
        const serverItem = serverItems.find((item) => item.id === id);
        if (
          serverItem &&
          (serverItem.timeline ?? "").trim() === optimisticTimeline.trim()
        ) {
          next.delete(id);
          changed = true;
        }
      }

      const nextOverrides = changed ? next : prev;
      optimisticTimelinesRef.current = nextOverrides;
      latestPlanItemsRef.current = applyTimelineOverrides(
        serverItems,
        nextOverrides,
      );
      return changed ? next : prev;
    });
  }, [client?.discussedItems]);

  const handleVisitModeToggleItem = useCallback(
    (itemId: string) => {
      const currentClient = clientRef.current;
      if (!currentClient) return;

      const currentItems = latestPlanItemsRef.current;
      const item = currentItems.find((it) => it.id === itemId);
      if (!item) return;

      const isNowCompleted = (item.timeline ?? "").trim() === "Completed";
      const nextTimeline = isNowCompleted ? "Now" : "Completed";
      const nextItems = currentItems.map((it) =>
        it.id === itemId ? { ...it, timeline: nextTimeline } : it,
      );

      latestPlanItemsRef.current = nextItems;
      cacheClientDiscussedItemTimeline(
        currentClient.id,
        itemId,
        nextTimeline,
      );

      setOptimisticTimelines((prev) => {
        const next = new Map(prev);
        next.set(itemId, nextTimeline);
        optimisticTimelinesRef.current = next;
        return next;
      });

      const mutationSequence = ++mutationSequenceRef.current;
      const clientIdentity = {
        id: currentClient.id,
        tableSource: currentClient.tableSource,
      };

      persistQueueRef.current = persistQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          await persistClientDiscussedItems(clientIdentity, nextItems);
          try {
            await Promise.resolve(onUpdate());
          } catch (error) {
            console.error(
              "Failed to refresh clients after visit update:",
              error,
            );
          }

          setTimeout(() => {
            nextItems.forEach((item) => {
              clearClientDiscussedItemTimelineCache(
                clientIdentity.id,
                item.id,
                item.timeline ?? "",
              );
            });
          }, 5000);
        })
        .catch((error: unknown) => {
          if (
            mutationSequence !== mutationSequenceRef.current ||
            clientRef.current?.id !== clientIdentity.id
          ) {
            return;
          }

          clearClientDiscussedItemTimelineCache(clientIdentity.id);
          optimisticTimelinesRef.current = new Map();
          latestPlanItemsRef.current = clientRef.current?.discussedItems ?? [];
          if (mountedRef.current) {
            setOptimisticTimelines(new Map());
          }
          void Promise.resolve(onUpdate()).catch((refreshError) => {
            console.error(
              "Failed to refresh clients after visit update error:",
              refreshError,
            );
          });
          showError(
            error instanceof Error ? error.message : "Failed to update plan",
          );
        });
    },
    [
      cacheClientDiscussedItemTimeline,
      clearClientDiscussedItemTimelineCache,
      onUpdate,
    ],
  );

  return { optimisticTimelines, handleVisitModeToggleItem };
}
