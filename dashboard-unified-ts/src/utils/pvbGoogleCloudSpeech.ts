/**
 * Google Cloud Text-to-Speech for Post-Visit Blueprint “Listen” controls.
 *
 * The browser cannot call the Cloud TTS API with a service account safely — use a small backend
 * endpoint and point the dashboard at it with `VITE_GOOGLE_TTS_PROXY_URL`.
 *
 * POST JSON `{ text, voiceName?, languageCode?, speakingRate? }` → `audio/mpeg`.
 *
 * Optional env (see `vite-env.d.ts`):
 * - `VITE_GOOGLE_TTS_PROXY_URL` — full URL to that endpoint (required to enable GCP TTS in the app).
 */

const MAX_CHARS = 4500;

let currentAudio: HTMLAudioElement | null = null;
let currentObjectUrl: string | null = null;
let fetchAbort: AbortController | null = null;

function cleanupAudio(): void {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.src = "";
    } catch {
      /* ignore */
    }
    currentAudio = null;
  }
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
}

export function cancelGoogleCloudPlayback(): void {
  fetchAbort?.abort();
  fetchAbort = null;
  cleanupAudio();
}

export function isGoogleCloudTtsConfigured(): boolean {
  return Boolean(import.meta.env.VITE_GOOGLE_TTS_PROXY_URL?.trim());
}

function truncateForApi(text: string): string {
  if (text.length <= MAX_CHARS) return text;
  return `${text.slice(0, MAX_CHARS - 1).trimEnd()}…`;
}

export type GoogleCloudSpeechResult = "ok" | "aborted" | "error";

/**
 * Fetches audio and plays it. `aborted` means the user cancelled — do not fall back to other TTS.
 */
export async function speakPlainTextGoogleCloud(
  text: string,
  opts?: { onEnd?: () => void; onError?: () => void },
): Promise<GoogleCloudSpeechResult> {
  const trimmed = truncateForApi(text.trim());
  if (!trimmed) {
    opts?.onEnd?.();
    return "ok";
  }

  cancelGoogleCloudPlayback();
  fetchAbort = new AbortController();
  const signal = fetchAbort.signal;

  const proxy = import.meta.env.VITE_GOOGLE_TTS_PROXY_URL?.trim();
  const voiceName = import.meta.env.VITE_GOOGLE_TTS_VOICE_NAME?.trim();
  const languageCode = import.meta.env.VITE_GOOGLE_TTS_LANGUAGE_CODE?.trim();

  if (!proxy) {
    return "error";
  }

  try {
    const body: Record<string, unknown> = { text: trimmed };
    if (voiceName) body.voiceName = voiceName;
    if (languageCode) body.languageCode = languageCode;

    const res = await fetch(proxy, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) throw new Error(`Google TTS proxy ${res.status}`);
    const blob = await res.blob();

    if (signal.aborted) return "aborted";

    const url = URL.createObjectURL(blob);
    currentObjectUrl = url;
    const audio = new Audio(url);
    currentAudio = audio;

    audio.onended = () => {
      cleanupAudio();
      fetchAbort = null;
      opts?.onEnd?.();
    };
    audio.onerror = () => {
      cleanupAudio();
      fetchAbort = null;
      opts?.onError?.();
    };

    await audio.play();
    return "ok";
  } catch {
    if (signal.aborted) return "aborted";
    cleanupAudio();
    fetchAbort = null;
    return "error";
  }
}
