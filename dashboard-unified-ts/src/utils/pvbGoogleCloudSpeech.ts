import { BACKEND_API_URL } from "../services/api";

/**
 * Google Cloud Text-to-Speech for Post-Visit Blueprint “Listen” controls.
 *
 * The browser cannot call the Cloud TTS API with a service account safely — use a small backend
 * endpoint and point the dashboard at it with `VITE_GOOGLE_TTS_PROXY_URL`.
 *
 * POST JSON `{ text, voiceName?, languageCode?, speakingRate? }` → `audio/mpeg`.
 *
 * Optional env (see `vite-env.d.ts`):
 * - `VITE_GOOGLE_TTS_PROXY_URL` — full URL to that endpoint.
 * - `VITE_GOOGLE_TTS_VOICE_NAME` — defaults to `en-GB-Chirp3-HD-Aoede`, a natural British female voice.
 * - `VITE_GOOGLE_TTS_SPEAKING_RATE` — defaults to `0.96` for calmer narration.
 */

const MAX_CHARS = 4500;
const DEFAULT_VOICE_NAME = "en-GB-Chirp3-HD-Aoede";
const DEFAULT_LANGUAGE_CODE = "en-GB";
const DEFAULT_SPEAKING_RATE = 0.96;
const DEFAULT_GOOGLE_TTS_PROXY_PATH = "/api/tts/google-cloud";

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
  return Boolean(getGoogleCloudTtsProxyUrl());
}

function getGoogleCloudTtsProxyUrl(): string {
  const configured = import.meta.env.VITE_GOOGLE_TTS_PROXY_URL?.trim();
  if (configured) return configured;
  return `${BACKEND_API_URL.replace(/\/$/, "")}${DEFAULT_GOOGLE_TTS_PROXY_PATH}`;
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
  opts?: { onStart?: () => void; onEnd?: () => void; onError?: () => void },
): Promise<GoogleCloudSpeechResult> {
  const trimmed = truncateForApi(text.trim());
  if (!trimmed) {
    opts?.onEnd?.();
    return "ok";
  }

  cancelGoogleCloudPlayback();
  fetchAbort = new AbortController();
  const signal = fetchAbort.signal;

  const proxy = getGoogleCloudTtsProxyUrl();
  const voiceName =
    import.meta.env.VITE_GOOGLE_TTS_VOICE_NAME?.trim() || DEFAULT_VOICE_NAME;
  const languageCode =
    import.meta.env.VITE_GOOGLE_TTS_LANGUAGE_CODE?.trim() || DEFAULT_LANGUAGE_CODE;
  const speakingRate = Number(
    import.meta.env.VITE_GOOGLE_TTS_SPEAKING_RATE?.trim() || DEFAULT_SPEAKING_RATE,
  );

  if (!proxy) {
    return "error";
  }

  try {
    const body: Record<string, unknown> = { text: trimmed };
    body.voiceName = voiceName;
    body.languageCode = languageCode;
    if (Number.isFinite(speakingRate) && speakingRate > 0) {
      body.speakingRate = speakingRate;
    }

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
    opts?.onStart?.();
    return "ok";
  } catch {
    if (signal.aborted) return "aborted";
    cleanupAudio();
    fetchAbort = null;
    return "error";
  }
}
