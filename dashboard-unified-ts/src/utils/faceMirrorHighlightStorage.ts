const STORAGE_PREFIX = "fmp-highlight-regions:";

export function faceMirrorHighlightStorageKey(
  clientKey: string | undefined,
  fallbackName: string,
): string {
  const key = (clientKey ?? "").trim() || fallbackName.trim() || "anonymous";
  return key;
}

export function loadFaceMirrorHighlightedRegions(
  storageKey: string,
  validRegionIds: readonly string[],
): string[] {
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${storageKey}`);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = new Set(validRegionIds);
    return parsed.filter((id): id is string => typeof id === "string" && valid.has(id));
  } catch {
    return [];
  }
}

export function saveFaceMirrorHighlightedRegions(
  storageKey: string,
  regionIds: string[],
): void {
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${storageKey}`, JSON.stringify(regionIds));
  } catch {
    // Quota or private mode — ignore
  }
}
