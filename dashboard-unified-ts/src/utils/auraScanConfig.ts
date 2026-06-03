/**
 * Clients that use the Aura face mirror (turntable + Aura UI overlays, no photo blend).
 * Video URL is merged into getClientGlbUrl() so the existing 3D split layout applies.
 */
import auraTurntableVideo from "../assets/images/turntable_1024_black_scrub.mp4";

/** Display names that map to the bundled Aura demo scan (Tanya plates + turntable). */
const AURA_SCAN_VIDEO_BY_CLIENT: Record<string, string> = {
  "Tanya Tan": auraTurntableVideo,
  "Aura Demo": auraTurntableVideo,
};

export const AURA_SCAN_DEMO_CLIENT_NAME = "Tanya Tan";

function auraScanVideoForName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed in AURA_SCAN_VIDEO_BY_CLIENT) {
    return AURA_SCAN_VIDEO_BY_CLIENT[trimmed];
  }
  const lower = trimmed.toLowerCase();
  if (lower === "tanya tan" || lower.startsWith("tanya tan")) {
    return auraTurntableVideo;
  }
  return null;
}

export function clientUsesAuraScan(clientName: string | null | undefined): boolean {
  if (!clientName) return false;
  return auraScanVideoForName(clientName) !== null;
}

/** True when the dashboard should use AuraFaceView (turntable + annotation UI). */
export function clientUsesAuraInterface(
  turntableVideoUrl: string | null | undefined,
): boolean {
  return Boolean(turntableVideoUrl?.trim());
}

export function getAuraScanVideoUrl(clientName: string | null | undefined): string | null {
  if (!clientName) return null;
  return auraScanVideoForName(clientName);
}
