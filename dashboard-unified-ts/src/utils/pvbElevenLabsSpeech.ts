/**
 * Optional ElevenLabs TTS for Post-Visit Blueprint “Listen” controls.
 *
 * Configure either:
 * - `VITE_ELEVENLABS_PROXY_URL` — POST JSON `{ text, voiceId? }`, returns `audio/mpeg` (recommended: key stays on server), or
 * - `VITE_ELEVENLABS_API_KEY` — direct API calls from the browser (key is visible in the bundle; use only if acceptable).
 *
 * Optional: `VITE_ELEVENLABS_VOICE_ID` (default: ElevenLabs “Rachel”).
 */

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
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

export function cancelElevenLabsPlayback(): void {
  fetchAbort?.abort();
  fetchAbort = null;
  cleanupAudio();
}

export function isElevenLabsConfigured(): boolean {
  const proxy = import.meta.env.VITE_ELEVENLABS_PROXY_URL?.trim();
  const key = import.meta.env.VITE_ELEVENLABS_API_KEY?.trim();
  return Boolean(proxy || key);
}

function truncateForApi(text: string): string {
  if (text.length <= MAX_CHARS) return text;
  return `${text.slice(0, MAX_CHARS - 1).trimEnd()}…`;
}

export type ElevenLabsSpeechResult = "ok" | "aborted" | "error";

/**
 * Fetches audio and plays it. `aborted` means the user cancelled — do not fall back to browser TTS.
 */
export async function speakPlainTextElevenLabs(
  text: string,
  opts?: { onEnd?: () => void; onError?: () => void },
): Promise<ElevenLabsSpeechResult> {
  const trimmed = truncateForApi(text.trim());
  if (!trimmed) {
    opts?.onEnd?.();
    return "ok";
  }

  cancelElevenLabsPlayback();
  fetchAbort = new AbortController();
  const signal = fetchAbort.signal;

  const proxy = import.meta.env.VITE_ELEVENLABS_PROXY_URL?.trim();
  const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY?.trim();
  const voiceId =
    import.meta.env.VITE_ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID;

  try {
    let blob: Blob;
    if (proxy) {
      const res = await fetch(proxy, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, voiceId }),
        signal,
      });
      if (!res.ok) throw new Error(`TTS proxy ${res.status}`);
      blob = await res.blob();
    } else if (apiKey) {
      // Direct browser calls to api.elevenlabs.io are blocked by CORS. Vite injects the key via
      // `/__elevenlabs-proxy` on the dev/preview server (see vite.config.ts). `import.meta.env.DEV`
      // is false under `vite preview`, so we also match localhost. Deployed static hosts should set
      // `VITE_ELEVENLABS_PROXY_URL` to a backend that forwards to ElevenLabs.
      const useSameOriginProxy =
        typeof window !== "undefined" &&
        (import.meta.env.DEV ||
          window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1");
      const ttsUrl = useSameOriginProxy
        ? `/__elevenlabs-proxy/v1/text-to-speech/${encodeURIComponent(voiceId)}`
        : `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      };
      if (!useSameOriginProxy) {
        headers["xi-api-key"] = apiKey;
      }
      const res = await fetch(ttsUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          text: trimmed,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
        signal,
      });
      if (!res.ok) throw new Error(`ElevenLabs ${res.status}`);
      blob = await res.blob();
    } else {
      return "error";
    }

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
