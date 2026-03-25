import aiLogoUrl from "../../assets/images/ai.svg";
import "./AiGeminiBrand.css";

/** Wordmark is opt-in only (`VITE_SHOW_GEMINI_BRAND=true`). Sparkle logo stays for AI sections. */
const showGemini = import.meta.env.VITE_SHOW_GEMINI_BRAND === "true";

/** Dual-sparkle mark (same asset as Analysis Overview). */
export function AiSparkleLogo({
  size = 16,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={aiLogoUrl}
      alt=""
      aria-hidden
      className={`ai-sparkle-logo ${className}`.trim()}
      style={{ width: size, height: size }}
    />
  );
}

/** Google Gemini wordmark — shown only when `VITE_SHOW_GEMINI_BRAND=true`. */
export function GeminiWordmark({ className = "" }: { className?: string }) {
  if (!showGemini) return null;
  return (
    <span
      className={`ai-gemini-wordmark ${className}`.trim()}
      aria-label="Google Gemini"
    >
      Gemini
    </span>
  );
}

/** Compact row: sparkle + Gemini (for tight headings). */
export function AiGeminiBrandRow({
  size = 14,
  compact,
}: {
  size?: number;
  compact?: boolean;
}) {
  return (
    <span
      className={`ai-gemini-brand-row${compact ? " ai-gemini-brand-row--compact" : ""}`}
      aria-hidden={!showGemini}
    >
      <AiSparkleLogo size={size} />
      <GeminiWordmark />
    </span>
  );
}
