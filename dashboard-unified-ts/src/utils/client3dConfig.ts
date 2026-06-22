import { getAuraScanVideoUrl } from "./auraScanConfig";
import { demo3dAssetUrl } from "./demoAssetUrls";

/**
 * Maps client display names to their 3D turntable video URLs.
 * Static entries (demo clients) live here; dynamically generated models
 * are stored in localStorage under DYNAMIC_3D_KEY and merged at runtime.
 *
 * Video files live under `/public/demo-3d/` and are served at `/demo-3d/<file>.mp4`.
 */
const CLIENT_3D_VIDEO_MAP: Record<string, string> = {
  "Emily Dunhill": demo3dAssetUrl("emily-dunhill-turntable-v2.mp4"),
  "Allison Baum": demo3dAssetUrl("allison-baum-turntable-v2.mp4"),
  "Sam Test538": demo3dAssetUrl("sam-test538-turntable-seek-hq.mp4"),
};

const DYNAMIC_3D_KEY = "face3d-generated-models";

function getDynamicMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(DYNAMIC_3D_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

/** Persist a newly-generated turntable URL so it survives page reloads. */
export function setGeneratedClientGlbUrl(clientName: string, url: string): void {
  try {
    const map = getDynamicMap();
    map[clientName.trim()] = url;
    localStorage.setItem(DYNAMIC_3D_KEY, JSON.stringify(map));
  } catch {
    // localStorage may be unavailable (private browsing, storage quota, etc.)
  }
}

/** Remove a previously generated model (e.g. to regenerate). */
export function clearGeneratedClientGlbUrl(clientName: string): void {
  try {
    const map = getDynamicMap();
    delete map[clientName.trim()];
    localStorage.setItem(DYNAMIC_3D_KEY, JSON.stringify(map));
  } catch {}
}

/** Returns the turntable video URL for this client name, or null if none configured. */
export function getClientGlbUrl(clientName: string | null | undefined): string | null {
  if (!clientName) return null;
  const name = clientName.trim();
  return CLIENT_3D_VIDEO_MAP[name] ?? getDynamicMap()[name] ?? getAuraScanVideoUrl(name);
}

export function getClientsWith3DModels(): { name: string; videoUrl: string }[] {
  const merged = { ...CLIENT_3D_VIDEO_MAP, ...getDynamicMap() };
  return Object.entries(merged).map(([name, videoUrl]) => ({ name, videoUrl }));
}

/** True when this client should use the FaceMirrorPanel split layout. */
export function clientHas3DModel(clientName: string | null | undefined): boolean {
  return getClientGlbUrl(clientName) !== null;
}
