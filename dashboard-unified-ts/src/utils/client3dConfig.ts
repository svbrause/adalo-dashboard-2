/**
 * Maps client display names to their 3D turntable video URLs.
 * When a client's name is present here, the ClientDetailPanel shows the
 * FaceMirrorPanel split layout (annotated photo ↔ 3D turntable video toggle).
 *
 * Video files live under `/public/demo-3d/` and are served at `/demo-3d/<file>.mp4`.
 */
const CLIENT_3D_VIDEO_MAP: Record<string, string> = {
  "Emily Dunhill": "/demo-3d/emily-dunhill-turntable-v2.mp4",
  "Allison Baum": "/demo-3d/allison-baum-turntable-v2.mp4",
};

/** Returns the turntable video URL for this client name, or null if none configured. */
export function getClientGlbUrl(clientName: string | null | undefined): string | null {
  if (!clientName) return null;
  return CLIENT_3D_VIDEO_MAP[clientName.trim()] ?? null;
}

/** True when this client should use the FaceMirrorPanel split layout. */
export function clientHas3DModel(clientName: string | null | undefined): boolean {
  return getClientGlbUrl(clientName) !== null;
}
