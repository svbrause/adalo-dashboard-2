/**
 * Clients that use the Aura face mirror (turntable + Aura UI overlays, no photo blend).
 * Video URL is merged into getClientGlbUrl() so the existing 3D split layout applies.
 *
 * Use a stable `/public` path for blueprint share links — Vite `/assets/*` hashes and
 * `/src/assets/*` dev paths break when a stored blueprint payload is opened on staging/prod.
 */
export const TANYA_AURA_TURNTABLE_VIDEO_URL =
  "/post-visit-blueprint/videos/tanya-tan-turntable-black-scrub.mp4";

/** Display names that map to the bundled Aura demo scan (Tanya plates + turntable). */
const AURA_SCAN_VIDEO_BY_CLIENT: Record<string, string> = {
  "Tanya Tan": TANYA_AURA_TURNTABLE_VIDEO_URL,
  "Aura Demo": TANYA_AURA_TURNTABLE_VIDEO_URL,
};

export const AURA_SCAN_DEMO_CLIENT_NAME = "Tanya Tan";

function auraScanVideoForName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed in AURA_SCAN_VIDEO_BY_CLIENT) {
    return AURA_SCAN_VIDEO_BY_CLIENT[trimmed];
  }
  const lower = trimmed.toLowerCase();
  if (lower === "tanya tan" || lower.startsWith("tanya tan")) {
    return TANYA_AURA_TURNTABLE_VIDEO_URL;
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
