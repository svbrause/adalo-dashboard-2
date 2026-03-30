import { useCallback, useEffect, useState } from "react";
import {
  trackPostVisitBlueprintEvent,
  type BlueprintPatientAnalyticsBase,
} from "../../utils/postVisitBlueprint";
import { cancelSpeech, isTtsAvailable, speakPlainText } from "../../utils/pvbSpeech";
import "./PvbNarrative.css";

export type PvbNarrativeAudioAnalytics = BlueprintPatientAnalyticsBase & {
  scope: "main_overview" | "chapter";
  chapter_key?: string;
  chapter_display_name?: string;
};

function SpeakerGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function StopGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
  );
}

export function PvbNarrativeAudioControls({
  text,
  label = "Listen",
  stopLabel = "Stop",
  ariaLabel,
  ariaLabelStop,
  variant = "icon",
  analytics,
}: {
  text: string;
  label?: string;
  stopLabel?: string;
  /** Announced when idle (play action). */
  ariaLabel?: string;
  /** Announced while playing (stop action). Defaults to `stopLabel`. */
  ariaLabelStop?: string;
  variant?: "label" | "icon";
  /** When set, play/stop is reported to PostHog. */
  analytics?: PvbNarrativeAudioAnalytics;
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
      if (analytics) {
        trackPostVisitBlueprintEvent("blueprint_narrative_audio_stopped", {
          token: analytics.token,
          patient_id: analytics.patient_id,
          scope: analytics.scope,
          chapter_key: analytics.chapter_key,
          chapter_display_name: analytics.chapter_display_name,
          stop_reason: "user",
        });
      }
      return;
    }
    speakPlainText(text, {
      onEnd: () => {
        setPlaying(false);
        if (analytics) {
          trackPostVisitBlueprintEvent("blueprint_narrative_audio_stopped", {
            token: analytics.token,
            patient_id: analytics.patient_id,
            scope: analytics.scope,
            chapter_key: analytics.chapter_key,
            chapter_display_name: analytics.chapter_display_name,
            stop_reason: "completed",
          });
        }
      },
      onError: () => {
        setPlaying(false);
        if (analytics) {
          trackPostVisitBlueprintEvent("blueprint_narrative_audio_stopped", {
            token: analytics.token,
            patient_id: analytics.patient_id,
            scope: analytics.scope,
            chapter_key: analytics.chapter_key,
            chapter_display_name: analytics.chapter_display_name,
            stop_reason: "error",
          });
        }
      },
    });
    setPlaying(true);
    if (analytics) {
      trackPostVisitBlueprintEvent("blueprint_narrative_audio_started", {
        token: analytics.token,
        patient_id: analytics.patient_id,
        scope: analytics.scope,
        chapter_key: analytics.chapter_key,
        chapter_display_name: analytics.chapter_display_name,
      });
    }
  }, [text, playing, supported, analytics]);

  if (!supported || !text.trim()) return null;

  const accessibleLabel = playing
    ? (ariaLabelStop ?? stopLabel)
    : (ariaLabel ?? label);

  return (
    <button
      type="button"
      className={`pvb-narrative-audio${variant === "icon" ? " pvb-narrative-audio--icon" : ""}${playing ? " pvb-narrative-audio--playing" : ""}`}
      onClick={toggle}
      aria-pressed={playing}
      title={accessibleLabel}
      aria-label={accessibleLabel}
    >
      {variant === "icon" ? (
        playing ? (
          <StopGlyph className="pvb-narrative-audio__glyph" />
        ) : (
          <SpeakerGlyph className="pvb-narrative-audio__glyph" />
        )
      ) : playing ? (
        stopLabel
      ) : (
        label
      )}
    </button>
  );
}
