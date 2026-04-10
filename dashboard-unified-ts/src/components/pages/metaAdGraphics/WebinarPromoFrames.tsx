/**
 * SVG "export-ready" webinar promo frames.
 * Redesigned: bold, minimal, high-contrast — built to stop the scroll.
 * ViewBox sizes match Meta exports: 1080×1080, 1080×1350, 1080×1920.
 */

import { useId } from "react";
import "./WebinarPromoFrames.css";

const G = {
  black: "#0a0a0a",
  white: "#ffffff",
  electric: "#00c4b4",
  electricDark: "#0d7a6f",
  cream: "#f7f2ec",
  ink: "#111111",
};

const FONT = "Montserrat, 'Helvetica Neue', Arial, sans-serif";

type FrameProps = {
  variant?: "default" | "cold-local";
};

function safeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, "");
}

/** 1:1 — 1080×1080 */
export function WebinarAd1080Square({ variant = "default" }: FrameProps) {
  const uid = safeId(useId());
  const shadowId = `${uid}-sh`;

  if (variant === "cold-local") {
    // Editorial: warm cream, bold black headline, teal punch word
    return (
      <svg
        className="webinar-ad-svg"
        viewBox="0 0 1080 1080"
        role="img"
        aria-label="Webinar promo, cold local variant"
      >
        <defs>
          <filter id={shadowId} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="16" stdDeviation="28" floodOpacity="0.1" />
          </filter>
        </defs>

        {/* Warm cream background */}
        <rect width="1080" height="1080" fill={G.cream} />

        {/* Decorative circle — top right, outline only */}
        <circle cx="960" cy="140" r="320" fill="none" stroke={G.electric} strokeWidth="2" opacity="0.22" />
        <circle cx="960" cy="140" r="200" fill="none" stroke={G.electric} strokeWidth="1" opacity="0.14" />

        {/* Thin teal top edge */}
        <rect x="0" y="0" width="1080" height="5" fill={G.electric} />

        {/* FREE LIVE WEBINAR chip */}
        <rect x="68" y="72" width="265" height="44" rx="22" fill={G.electric} opacity="0.12" />
        <text x="200" y="101" textAnchor="middle" fill={G.electricDark} fontSize="18" fontWeight="700" fontFamily={FONT} letterSpacing="3.5">FREE LIVE WEBINAR</text>

        {/* Main headline — bold editorial */}
        <text x="68" y="420" fill={G.ink} fontSize="94" fontWeight="900" fontFamily={FONT} letterSpacing="-1">She doubled</text>
        <text x="68" y="530" fill={G.ink} fontSize="94" fontWeight="900" fontFamily={FONT} letterSpacing="-1">her MedSpa</text>
        <text x="68" y="640" fill={G.electricDark} fontSize="94" fontWeight="900" fontFamily={FONT} letterSpacing="-1">revenue.</text>

        {/* Sublines */}
        <text x="68" y="718" fill="rgba(0,0,0,0.38)" fontSize="27" fontFamily={FONT}>Free live training · Tuesday 7PM ET</text>
        <text x="68" y="756" fill="rgba(0,0,0,0.3)" fontSize="24" fontFamily={FONT}>A local MedSpa owner shares her full system.</text>

        {/* CTA button */}
        <rect x="68" y="826" width="362" height="82" rx="41" fill={G.ink} filter={`url(#${shadowId})`} />
        <text x="249" y="878" textAnchor="middle" fill={G.white} fontSize="30" fontWeight="700" fontFamily={FONT}>Register Free →</text>

        {/* Logo placeholder */}
        <rect x="68" y="964" width="110" height="44" rx="8" fill="rgba(0,0,0,0.06)" />
        <text x="123" y="992" textAnchor="middle" fill="rgba(0,0,0,0.28)" fontSize="18" fontFamily={FONT}>LOGO</text>
      </svg>
    );
  }

  // Default: dark bg, massive "2×" stat, electric teal accent
  return (
    <svg
      className="webinar-ad-svg"
      viewBox="0 0 1080 1080"
      role="img"
      aria-label="Webinar promo, retargeting variant"
    >
      <defs>
        <filter id={shadowId} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="16" stdDeviation="28" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* Near-black background */}
      <rect width="1080" height="1080" fill={G.black} />

      {/* Left teal accent bar */}
      <rect x="0" y="0" width="6" height="1080" fill={G.electric} />

      {/* Subtle grid texture — faint horizontal lines */}
      <line x1="0" y1="360" x2="1080" y2="360" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
      <line x1="0" y1="720" x2="1080" y2="720" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />

      {/* FREE LIVE WEBINAR chip */}
      <rect x="68" y="68" width="275" height="44" rx="22" fill={G.electric} opacity="0.1" />
      <text x="205" y="97" textAnchor="middle" fill={G.electric} fontSize="18" fontWeight="700" fontFamily={FONT} letterSpacing="3.5">FREE LIVE WEBINAR</text>

      {/* Hero stat — massive "2×" */}
      <text x="56" y="590" fill={G.white} fontSize="460" fontWeight="900" fontFamily={FONT} letterSpacing="-12">2×</text>

      {/* Label below number */}
      <text x="68" y="668" fill={G.electric} fontSize="54" fontWeight="700" fontFamily={FONT} letterSpacing="-0.5">patient revenue</text>

      {/* Thin accent line under label */}
      <rect x="68" y="690" width="220" height="3" rx="1.5" fill={G.electric} opacity="0.3" />

      {/* Subline */}
      <text x="68" y="748" fill="rgba(255,255,255,0.38)" fontSize="26" fontFamily={FONT}>How? Free live training for MedSpa owners.</text>

      {/* CTA button */}
      <rect x="68" y="816" width="372" height="82" rx="41" fill={G.electric} filter={`url(#${shadowId})`} />
      <text x="254" y="868" textAnchor="middle" fill={G.black} fontSize="30" fontWeight="700" fontFamily={FONT}>Save My Seat →</text>

      {/* Date / details */}
      <text x="68" y="972" fill="rgba(255,255,255,0.18)" fontSize="20" fontFamily={FONT} letterSpacing="0.5">Tuesday · 7:00 PM ET · 45 min</text>
    </svg>
  );
}

/** 4:5 — 1080×1350 — speaker-forward */
export function WebinarAd1080Portrait({ variant = "default" }: FrameProps) {
  const uid = safeId(useId());
  const shadowId = `${uid}-sh`;
  const speakerGrad = `${uid}-sp`;

  return (
    <svg
      className="webinar-ad-svg"
      viewBox="0 0 1080 1350"
      role="img"
      aria-label="Webinar promo graphic, portrait format"
    >
      <defs>
        <radialGradient id={speakerGrad} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#1a7a72" />
          <stop offset="100%" stopColor="#0d4f4a" />
        </radialGradient>
        <filter id={shadowId} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="20" stdDeviation="32" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Upper teal section */}
      <rect width="1080" height="780" fill="#0d5c55" />

      {/* Bottom black section */}
      <rect y="780" width="1080" height="570" fill={G.black} />

      {/* Decorative arc in upper section */}
      <ellipse cx="1100" cy="200" rx="400" ry="400" fill="rgba(0,196,180,0.07)" />

      {/* FREE LIVE WEBINAR — top */}
      <text x="540" y="100" textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="22" fontWeight="700" fontFamily={FONT} letterSpacing="5">FREE LIVE WEBINAR</text>

      {/* Speaker name (upper section) */}
      <text x="540" y="210" textAnchor="middle" fill={G.white} fontSize="30" fontWeight="600" fontFamily={FONT}>Erin · The Treatment MedSpa</text>
      <text x="540" y="252" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="22" fontFamily={FONT}>Founder & Injector</text>

      {/* Speaker circle — centered at split y=780 */}
      <circle cx="540" cy="780" r="200" fill={`url(#${speakerGrad})`} stroke={G.white} strokeWidth="7" filter={`url(#${shadowId})`} />
      {/* Placeholder initial */}
      <text x="540" y="815" textAnchor="middle" fill="rgba(255,255,255,0.9)" fontSize="130" fontWeight="700" fontFamily={FONT}>E</text>
      <text x="540" y="1010" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="20" fontFamily={FONT} letterSpacing="1">↑ Replace with headshot in Figma</text>

      {/* Bottom headline */}
      <text x="540" y="1070" textAnchor="middle" fill={G.white} fontSize="80" fontWeight="900" fontFamily={FONT} letterSpacing="-1">
        {variant === "cold-local" ? "Local owner." : "Double your"}
      </text>
      <text x="540" y="1162" textAnchor="middle" fill={G.electric} fontSize="80" fontWeight="900" fontFamily={FONT} letterSpacing="-1">
        {variant === "cold-local" ? "Real numbers." : "patient spend"}
      </text>
      <text x="540" y="1228" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="36" fontFamily={FONT}>
        {variant === "cold-local" ? "Free live webinar · Tue 7PM ET" : "with AI — free live training"}
      </text>

      {/* CTA */}
      <rect x="215" y="1266" width="650" height="84" rx="42" fill={G.electric} filter={`url(#${shadowId})`} />
      <text x="540" y="1319" textAnchor="middle" fill={G.black} fontSize="32" fontWeight="700" fontFamily={FONT}>Register Free →</text>
    </svg>
  );
}

/** 9:16 — 1080×1920 — Stories / Reels */
export function WebinarAd1080Story({ variant = "default" }: FrameProps) {
  const uid = safeId(useId());
  const shadowId = `${uid}-sh`;

  if (variant === "cold-local") {
    // Split: cream top / dark teal bottom — "Your city. Her system."
    return (
      <svg
        className="webinar-ad-svg webinar-ad-svg--story"
        viewBox="0 0 1080 1920"
        role="img"
        aria-label="Webinar promo, stories cold-local variant"
      >
        <defs>
          <filter id={shadowId} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="18" stdDeviation="30" floodOpacity="0.2" />
          </filter>
        </defs>

        {/* Cream top half */}
        <rect width="1080" height="960" fill={G.cream} />
        {/* Dark teal bottom half */}
        <rect y="960" width="1080" height="960" fill="#0d4f4a" />

        {/* Decorative circle top-right */}
        <circle cx="960" cy="200" r="350" fill="none" stroke={G.electric} strokeWidth="2" opacity="0.18" />

        {/* Thin teal accent line at split */}
        <rect x="0" y="955" width="1080" height="6" fill={G.electric} />

        {/* Top headline (dark on cream) */}
        <text x="540" y="580" textAnchor="middle" fill={G.ink} fontSize="110" fontWeight="900" fontFamily={FONT} letterSpacing="-2">Your city.</text>
        <text x="540" y="706" textAnchor="middle" fill={G.ink} fontSize="110" fontWeight="900" fontFamily={FONT} letterSpacing="-2">Her system.</text>

        {/* Sub (still on cream) */}
        <text x="540" y="840" textAnchor="middle" fill="rgba(0,0,0,0.4)" fontSize="36" fontFamily={FONT}>A local MedSpa owner shares</text>
        <text x="540" y="886" textAnchor="middle" fill="rgba(0,0,0,0.4)" fontSize="36" fontFamily={FONT}>the AI workflow she uses daily.</text>

        {/* CTA — spanning the split */}
        <rect x="140" y="1028" width="800" height="104" rx="52" fill={G.electric} filter={`url(#${shadowId})`} />
        <text x="540" y="1093" textAnchor="middle" fill={G.black} fontSize="40" fontWeight="700" fontFamily={FONT}>Save My Seat →</text>

        {/* Lower details (white on teal) */}
        <text x="540" y="1250" textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="32" fontFamily={FONT}>Free · Tuesday 7PM ET · 45 min</text>
        <text x="540" y="1300" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="28" fontFamily={FONT}>Zoom · Limited spots</text>

        {/* Logo placeholder */}
        <rect x="440" y="1730" width="200" height="56" rx="10" fill="rgba(255,255,255,0.1)" />
        <text x="540" y="1766" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="24" fontFamily={FONT}>LOGO</text>
      </svg>
    );
  }

  // Default: near-black, "2×" ghost watermark, bold centered content
  return (
    <svg
      className="webinar-ad-svg webinar-ad-svg--story"
      viewBox="0 0 1080 1920"
      role="img"
      aria-label="Webinar promo graphic, stories format"
    >
      <defs>
        <filter id={shadowId} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="18" stdDeviation="30" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* Near-black background */}
      <rect width="1080" height="1920" fill={G.black} />

      {/* Ghost "2×" — massive, barely visible watermark */}
      <text x="540" y="1120" textAnchor="middle" fill="rgba(255,255,255,0.025)" fontSize="1000" fontWeight="900" fontFamily={FONT}>2×</text>

      {/* Thin teal left bar */}
      <rect x="0" y="0" width="6" height="1920" fill={G.electric} />

      {/* Content block — centered vertically */}
      <text x="540" y="660" textAnchor="middle" fill={G.white} fontSize="92" fontWeight="900" fontFamily={FONT} letterSpacing="2">DOUBLE YOUR</text>
      <text x="540" y="764" textAnchor="middle" fill={G.electric} fontSize="92" fontWeight="900" fontFamily={FONT} letterSpacing="2">PATIENT SPEND</text>
      <text x="540" y="848" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="44" fontFamily={FONT}>with AI</text>

      {/* Divider */}
      <rect x="440" y="896" width="200" height="2" rx="1" fill="rgba(255,255,255,0.12)" />

      {/* Details */}
      <text x="540" y="970" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="32" fontFamily={FONT}>Free · Tuesday 7:00 PM ET · 45 min</text>

      {/* CTA button */}
      <rect x="140" y="1060" width="800" height="104" rx="52" fill={G.electric} filter={`url(#${shadowId})`} />
      <text x="540" y="1125" textAnchor="middle" fill={G.black} fontSize="40" fontWeight="700" fontFamily={FONT}>Save My Seat →</text>

      {/* Supporting text */}
      <text x="540" y="1280" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="26" fontFamily={FONT}>Erin · The Treatment MedSpa</text>
      <text x="540" y="1318" textAnchor="middle" fill="rgba(255,255,255,0.22)" fontSize="24" fontFamily={FONT}>Spots are limited</text>

      {/* Logo placeholder */}
      <rect x="440" y="1730" width="200" height="56" rx="10" fill="rgba(255,255,255,0.06)" />
      <text x="540" y="1766" textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="24" fontFamily={FONT}>LOGO</text>
    </svg>
  );
}

/** Carousel slide previews (3 takeaways) */
export function WebinarCarouselPreview() {
  const slides = [
    {
      k: "1",
      accent: G.electric,
      bg: "#0a0a0a",
      label: "01 / 03",
      t1: "The AI workflow",
      t2: "End-to-end in your practice",
      dark: true,
    },
    {
      k: "2",
      accent: G.electricDark,
      bg: G.cream,
      label: "02 / 03",
      t1: "2× patient spend",
      t2: "What actually changed",
      dark: false,
    },
    {
      k: "3",
      accent: "#0a0a0a",
      bg: "#e8f8f6",
      label: "03 / 03",
      t1: "Live Q&A",
      t2: "Bring your numbers",
      dark: false,
    },
  ] as const;

  return (
    <div className="webinar-carousel-preview">
      {slides.map((s) => (
        <svg
          key={s.k}
          className="webinar-ad-svg webinar-ad-svg--carousel"
          viewBox="0 0 600 600"
          role="img"
          aria-label={`Carousel slide ${s.k}`}
        >
          <rect width="600" height="600" fill={s.bg} />
          <rect x="0" y="0" width="4" height="600" fill={s.accent} />
          <text
            x="48"
            y="76"
            fill={s.dark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.28)"}
            fontSize="20"
            fontWeight="700"
            fontFamily={FONT}
            letterSpacing="2"
          >
            {s.label}
          </text>
          <text
            x="48"
            y="340"
            fill={s.dark ? G.white : G.ink}
            fontSize="48"
            fontWeight="900"
            fontFamily={FONT}
            letterSpacing="-0.5"
          >
            {s.t1}
          </text>
          <text
            x="48"
            y="400"
            fill={s.dark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)"}
            fontSize="26"
            fontFamily={FONT}
          >
            {s.t2}
          </text>
          <text
            x="48"
            y="540"
            fill={s.accent}
            fontSize="22"
            fontWeight="700"
            fontFamily={FONT}
            letterSpacing="1"
            opacity="0.85"
          >
            FREE WEBINAR SERIES
          </text>
        </svg>
      ))}
    </div>
  );
}
