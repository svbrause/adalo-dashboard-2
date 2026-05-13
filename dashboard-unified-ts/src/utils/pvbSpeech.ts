import {
  cancelElevenLabsPlayback,
  isElevenLabsConfigured,
  speakPlainTextElevenLabs,
} from "./pvbElevenLabsSpeech";
import {
  cancelGoogleCloudPlayback,
  isGoogleCloudTtsConfigured,
  speakPlainTextGoogleCloud,
} from "./pvbGoogleCloudSpeech";

export function isSpeechSynthesisSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.speechSynthesis?.speak === "function"
  );
}

/** True when Google Cloud TTS proxy, ElevenLabs, or browser `SpeechSynthesis` is available. */
export function isTtsAvailable(): boolean {
  return (
    isGoogleCloudTtsConfigured() ||
    isElevenLabsConfigured() ||
    isSpeechSynthesisSupported()
  );
}

export function cancelSpeech(): void {
  cancelGoogleCloudPlayback();
  cancelElevenLabsPlayback();
  if (!isSpeechSynthesisSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

let cachedPreferredVoice: SpeechSynthesisVoice | null | undefined;

const FEMALE_VOICE_NAME_RE =
  /\bfemale\b|woman|martha|kate|serena|fiona|tessa|moira|sonia|libby|maisie|sophie|nancy|samantha|karen|victoria|allison|nicky|susan|flo|ava|zira|jenny|aria/i;
const MALE_VOICE_NAME_RE =
  /\bmale\b|man|arthur|daniel|oliver|thomas|ryan|aaron|david|mark|alex|george|fred|ralph|albert|eddy|reed|rocko|shelley/i;

/** Reset when the browser’s voice list may have changed. */
function clearPreferredVoiceCache(): void {
  cachedPreferredVoice = undefined;
}

/**
 * Pick a clear British English voice when available, else high-quality en-* .
 * Quality varies by browser/OS; local / enhanced / neural-style voices score higher.
 */
function pickPreferredEnglishVoice(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  const english = voices.filter((v) => {
    const lang = (v.lang ?? "").toLowerCase();
    return lang.startsWith("en");
  });
  if (english.length === 0) return voices[0] ?? null;

  const score = (v: SpeechSynthesisVoice): number => {
    let s = 0;
    const lang = (v.lang ?? "").toLowerCase();
    const name = (v.name ?? "").toLowerCase();

    /** Prefer UK English for Post-Visit Blueprint narration. */
    if (lang === "en-gb") s += 18;
    else if (lang.startsWith("en-gb")) s += 16;
    else if (lang === "en-us") s += 5;
    else if (lang.startsWith("en")) s += 4;

    if (v.localService) s += 5;

    // If Google Cloud is not configured or reachable, the browser fallback should still
    // avoid the common "Google UK English Male" / Daniel-style voices for patient narration.
    if (FEMALE_VOICE_NAME_RE.test(name)) s += 30;
    if (MALE_VOICE_NAME_RE.test(name)) s -= 24;

    if (/enhanced|premium|neural|natural|wavenet|neural2/i.test(name)) s += 10;
    if (
      /martha|kate|serena|fiona|tessa|moira|sonia|libby|maisie|sophie|nancy/i.test(
        name,
      )
    )
      s += 9;
    if (
      /samantha|karen|victoria|allison|nicky|susan|flo|ava/i.test(
        name,
      )
    )
      s += 5;
    if (/google\s+uk\s+english|google\s+us\s+english|google\s+english/i.test(name))
      s += lang.includes("gb") ? 10 : 6;
    if (/siri|alex/i.test(name)) s += 8;

    // Common Windows/macOS defaults — usable but often flatter than the above
    if (/microsoft\s+(zira|david|mark|jenny|aria|sonia|libby)/i.test(name)) s += 2;

    // Deprioritize known compact / legacy bundled voices when alternatives exist
    if (/compact|legacy|novelty/i.test(name)) s -= 6;

    return s;
  };

  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -Infinity;
  for (const v of english) {
    const sc = score(v);
    if (sc > bestScore) {
      bestScore = sc;
      best = v;
    }
  }
  return best;
}

function getPreferredVoice(): SpeechSynthesisVoice | null {
  if (!isSpeechSynthesisSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  /** Voices often load async; don’t cache until the list is non-empty. */
  if (voices.length === 0) return null;
  if (cachedPreferredVoice !== undefined) return cachedPreferredVoice;
  cachedPreferredVoice = pickPreferredEnglishVoice(voices);
  return cachedPreferredVoice;
}

/**
 * Some browsers populate voices asynchronously. Wait until at least one voice exists.
 */
function whenVoicesReady(cb: () => void): void {
  if (!isSpeechSynthesisSupported()) return;
  const synth = window.speechSynthesis;
  if (synth.getVoices().length > 0) {
    clearPreferredVoiceCache();
    cb();
    return;
  }
  const onVoices = () => {
    synth.removeEventListener("voiceschanged", onVoices);
    window.clearTimeout(fallbackTimer);
    clearPreferredVoiceCache();
    cb();
  };
  synth.addEventListener("voiceschanged", onVoices);
  /** If `voiceschanged` never fires (rare), still speak with default voice */
  const fallbackTimer = window.setTimeout(() => {
    synth.removeEventListener("voiceschanged", onVoices);
    clearPreferredVoiceCache();
    cb();
  }, 1500);
}

function speakPlainTextBrowser(
  trimmed: string,
  opts?: {
    rate?: number;
    pitch?: number;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: () => void;
  },
): void {
  if (!isSpeechSynthesisSupported()) return;

  const speakNow = () => {
    const u = new SpeechSynthesisUtterance(trimmed);
    const voice = getPreferredVoice();
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang || "en-GB";
    } else {
      u.lang = "en-GB";
    }
    // Slightly slower than default — clearer; pitch near 1 avoids chipmunk/flat extremes
    u.rate = opts?.rate ?? 0.92;
    u.pitch = opts?.pitch ?? 1;
    u.volume = 1;
    u.onstart = () => opts?.onStart?.();
    u.onend = () => opts?.onEnd?.();
    u.onerror = () => opts?.onError?.();
    try {
      window.speechSynthesis.speak(u);
    } catch {
      opts?.onError?.();
    }
  };

  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    speakNow();
  } else {
    whenVoicesReady(speakNow);
  }
}

export function speakPlainText(
  text: string,
  opts?: {
    rate?: number;
    pitch?: number;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: () => void;
  },
): void {
  const trimmed = text.trim();
  if (!trimmed) {
    opts?.onEnd?.();
    return;
  }
  cancelSpeech();

  if (isGoogleCloudTtsConfigured()) {
    void (async () => {
      const result = await speakPlainTextGoogleCloud(trimmed, opts);
      if (result === "aborted" || result === "ok") return;
      if (isElevenLabsConfigured()) {
        const r2 = await speakPlainTextElevenLabs(trimmed, opts);
        if (r2 === "aborted" || r2 === "ok") return;
      }
      if (isSpeechSynthesisSupported()) {
        speakPlainTextBrowser(trimmed, opts);
      } else {
        opts?.onError?.();
      }
    })();
    return;
  }

  if (isElevenLabsConfigured()) {
    void (async () => {
      const result = await speakPlainTextElevenLabs(trimmed, opts);
      if (result === "aborted" || result === "ok") return;
      if (isSpeechSynthesisSupported()) {
        speakPlainTextBrowser(trimmed, opts);
      } else {
        opts?.onError?.();
      }
    })();
    return;
  }

  if (!isSpeechSynthesisSupported()) return;
  speakPlainTextBrowser(trimmed, opts);
}
