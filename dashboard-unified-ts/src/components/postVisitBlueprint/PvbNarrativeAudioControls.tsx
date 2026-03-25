import { useCallback, useEffect, useState } from "react";
import { cancelSpeech, isTtsAvailable, speakPlainText } from "../../utils/pvbSpeech";
import "./PvbNarrative.css";

export function PvbNarrativeAudioControls({
  text,
  label = "Listen",
  stopLabel = "Stop",
  ariaLabel,
}: {
  text: string;
  label?: string;
  stopLabel?: string;
  ariaLabel?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const supported = typeof window !== "undefined" && isTtsAvailable();

  useEffect(() => () => cancelSpeech(), []);

  useEffect(() => {
    cancelSpeech();
    setPlaying(false);
  }, [text]);

  const toggle = useCallback(() => {
    if (!supported) return;
    if (playing) {
      cancelSpeech();
      setPlaying(false);
      return;
    }
    speakPlainText(text, {
      onEnd: () => setPlaying(false),
      onError: () => setPlaying(false),
    });
    setPlaying(true);
  }, [text, playing, supported]);

  if (!supported || !text.trim()) return null;

  return (
    <button
      type="button"
      className={`pvb-narrative-audio${playing ? " pvb-narrative-audio--playing" : ""}`}
      onClick={toggle}
      aria-pressed={playing}
      aria-label={ariaLabel ?? (playing ? stopLabel : label)}
    >
      {playing ? stopLabel : label}
    </button>
  );
}
