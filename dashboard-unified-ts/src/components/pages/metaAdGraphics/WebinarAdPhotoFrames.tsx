/**
 * Photo-variant webinar ad frames.
 * Uses transparent-background PNG cutouts of real speakers floating over
 * solid/gradient SVG backgrounds — a common high-performing ad pattern.
 *
 * Speaker images live in /public/post-visit-blueprint/videos/wellnest/
 * All photos have transparent backgrounds.
 */

import { useId } from "react";
import "./WebinarPromoFrames.css"; // reuse same sizing rules

const G = {
  black: "#0a0a0a",
  white: "#ffffff",
  electric: "#00c4b4",
  electricDark: "#0d7a6f",
  cream: "#f7f2ec",
  ink: "#111111",
};

const FONT = "Montserrat, 'Helvetica Neue', Arial, sans-serif";

// Image paths (public folder → root-relative)
const PHOTOS = {
  erin: "/post-visit-blueprint/videos/wellnest/IMG_2476%202.png",
  reddy: "/post-visit-blueprint/videos/wellnest/Dr-Reddy-qr-code.png",
  tanya: "/post-visit-blueprint/videos/wellnest/dr-bio.png",
};

export type SpeakerKey = "erin" | "reddy" | "tanya";

const SPEAKERS: Record<SpeakerKey, {
  name: string;
  title: string;
  practice: string;
  city: string;
  bg: string;
  accent: string;
  accentDark: string;
  /** true = full-body shot; false = tight headshot (affects positioning) */
  fullBody: boolean;
}> = {
  erin: {
    name: "Erin Jensen, PA-C",
    title: "Founder & Injector",
    practice: "The Treatment Skin Boutique",
    city: "Los Angeles",
    bg: G.black,
    accent: G.electric,
    accentDark: G.electricDark,
    fullBody: true,
  },
  reddy: {
    name: "Dr. Reddy",
    title: "Founder & Medical Director",
    practice: "Wellnest MD",
    city: "Atlanta",
    bg: "#0a0f1a",          // deep navy-black
    accent: "#38bdf8",      // sky blue
    accentDark: "#0369a1",
    fullBody: true,
  },
  tanya: {
    name: "Dr. Tanya Judge",
    title: "Plastic Surgeon & Founder",
    practice: "JudgeMD",
    city: "San Francisco",
    bg: "#100a0f",           // deep plum-black
    accent: "#f0abfc",       // soft orchid
    accentDark: "#a21caf",
    fullBody: false,
  },
};

function safeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, "");
}

// ─── 1:1 Square photo variant ──────────────────────────────────────────────
// Layout: speaker photo anchored right (full bleed height), headline left.
// Pattern: cutout-on-color — same technique Apple, Glossier, Fenty use.

export function WebinarAdPhotoSquare({ speaker }: { speaker: SpeakerKey }) {
  const uid = safeId(useId());
  const shadowId = `${uid}-sh`;
  const sp = SPEAKERS[speaker];

  return (
    <svg
      className="webinar-ad-svg"
      viewBox="0 0 1080 1080"
      role="img"
      aria-label={`Webinar ad, ${sp.name}`}
    >
      <defs>
        <filter id={shadowId} x="-40%" y="-20%" width="180%" height="160%">
          <feDropShadow dx="0" dy="20" stdDeviation="32" floodOpacity="0.28" />
        </filter>
        {/* Soft vignette to let the right edge blend */}
        <linearGradient id={`${uid}-fade`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={sp.bg} stopOpacity="0" />
          <stop offset="100%" stopColor={sp.bg} stopOpacity="0.55" />
        </linearGradient>
      </defs>

      {/* Background */}
      <rect width="1080" height="1080" fill={sp.bg} />

      {/* Accent bar — left edge */}
      <rect x="0" y="0" width="5" height="1080" fill={sp.accent} />

      {/* Faint radial glow behind where person will be */}
      <radialGradient id={`${uid}-glow`} cx="75%" cy="60%" r="45%">
        <stop offset="0%" stopColor={sp.accent} stopOpacity="0.1" />
        <stop offset="100%" stopColor={sp.accent} stopOpacity="0" />
      </radialGradient>
      <rect width="1080" height="1080" fill={`url(#${uid}-glow)`} />

      {/* Speaker photo — right half, anchored to bottom */}
      <image
        href={PHOTOS[speaker]}
        x={sp.fullBody ? 460 : 380}
        y={sp.fullBody ? 0 : 140}
        width={sp.fullBody ? 660 : 700}
        height={sp.fullBody ? 1080 : 760}
        preserveAspectRatio={sp.fullBody ? "xMidYMax meet" : "xMidYMid meet"}
      />

      {/* Subtle right-edge fade to blend photo into bg */}
      <rect x="860" y="0" width="220" height="1080" fill={`url(#${uid}-fade)`} />

      {/* ── Left text column ── */}

      {/* FREE LIVE WEBINAR chip */}
      <rect x="58" y="68" width="272" height="44" rx="22" fill={sp.accent} opacity="0.12" />
      <text x="194" y="97" textAnchor="middle" fill={sp.accent} fontSize="17" fontWeight="700" fontFamily={FONT} letterSpacing="3">FREE LIVE WEBINAR</text>

      {/* Headline */}
      <text x="58" y="280" fill={G.white} fontSize="86" fontWeight="900" fontFamily={FONT} letterSpacing="-1">Double</text>
      <text x="58" y="376" fill={G.white} fontSize="86" fontWeight="900" fontFamily={FONT} letterSpacing="-1">patient</text>
      <text x="58" y="472" fill={sp.accent} fontSize="86" fontWeight="900" fontFamily={FONT} letterSpacing="-1">spend.</text>

      {/* Thin divider */}
      <rect x="58" y="504" width="180" height="2" rx="1" fill={sp.accent} opacity="0.35" />

      {/* Speaker credit */}
      <text x="58" y="548" fill="rgba(255,255,255,0.9)" fontSize="24" fontWeight="700" fontFamily={FONT}>{sp.name}</text>
      <text x="58" y="578" fill="rgba(255,255,255,0.45)" fontSize="20" fontFamily={FONT}>{sp.title}</text>
      <text x="58" y="604" fill="rgba(255,255,255,0.35)" fontSize="18" fontFamily={FONT}>{sp.practice} · {sp.city}</text>

      {/* CTA */}
      <rect x="58" y="680" width="340" height="78" rx="39" fill={sp.accent} filter={`url(#${shadowId})`} />
      <text x="228" y="729" textAnchor="middle" fill={G.black} fontSize="28" fontWeight="700" fontFamily={FONT}>Save My Seat →</text>

      {/* Date line */}
      <text x="58" y="820" fill="rgba(255,255,255,0.22)" fontSize="20" fontFamily={FONT} letterSpacing="0.5">Tue · 7:00 PM ET · Free · 45 min</text>
    </svg>
  );
}

// ─── 4:5 Portrait photo variant ────────────────────────────────────────────
// Layout: speaker photo bottom-anchored over teal-to-black gradient,
// headline + CTA in lower solid strip. Feels like a magazine cover.

export function WebinarAdPhotoPortrait({ speaker }: { speaker: SpeakerKey }) {
  const uid = safeId(useId());
  const shadowId = `${uid}-sh`;
  const sp = SPEAKERS[speaker];

  return (
    <svg
      className="webinar-ad-svg"
      viewBox="0 0 1080 1350"
      role="img"
      aria-label={`Webinar ad portrait, ${sp.name}`}
    >
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={sp.accentDark} stopOpacity="0.85" />
          <stop offset="50%" stopColor={sp.bg} stopOpacity="1" />
          <stop offset="100%" stopColor={sp.bg} stopOpacity="1" />
        </linearGradient>
        <linearGradient id={`${uid}-textfade`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={sp.bg} stopOpacity="0" />
          <stop offset="100%" stopColor={sp.bg} stopOpacity="1" />
        </linearGradient>
        <filter id={shadowId} x="-40%" y="-20%" width="180%" height="160%">
          <feDropShadow dx="0" dy="20" stdDeviation="32" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Background gradient */}
      <rect width="1080" height="1350" fill={`url(#${uid}-bg)`} />

      {/* Accent bar top */}
      <rect x="0" y="0" width="1080" height="5" fill={sp.accent} />

      {/* FREE LIVE WEBINAR — top */}
      <text x="540" y="96" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="22" fontWeight="700" fontFamily={FONT} letterSpacing="5">FREE LIVE WEBINAR</text>

      {/* Speaker photo — centered, anchored to bottom of photo zone */}
      <image
        href={PHOTOS[speaker]}
        x={sp.fullBody ? 80 : 215}
        y={sp.fullBody ? 100 : 260}
        width={sp.fullBody ? 920 : 650}
        height={sp.fullBody ? 950 : 560}
        preserveAspectRatio={sp.fullBody ? "xMidYMax meet" : "xMidYMid meet"}
      />

      {/* Bottom fade — creates reading area */}
      <rect x="0" y="760" width="1080" height="590" fill={`url(#${uid}-textfade)`} />
      <rect x="0" y="960" width="1080" height="390" fill={sp.bg} />

      {/* Speaker name + title */}
      <text x="540" y="1008" textAnchor="middle" fill="rgba(255,255,255,0.9)" fontSize="26" fontWeight="700" fontFamily={FONT}>{sp.name}</text>
      <text x="540" y="1042" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="21" fontFamily={FONT}>{sp.practice} · {sp.city}</text>

      {/* Headline */}
      <text x="540" y="1122" textAnchor="middle" fill={G.white} fontSize="74" fontWeight="900" fontFamily={FONT} letterSpacing="-1">Double patient</text>
      <text x="540" y="1204" textAnchor="middle" fill={sp.accent} fontSize="74" fontWeight="900" fontFamily={FONT} letterSpacing="-1">spend with AI</text>

      {/* CTA */}
      <rect x="190" y="1246" width="700" height="82" rx="41" fill={sp.accent} filter={`url(#${shadowId})`} />
      <text x="540" y="1299" textAnchor="middle" fill={G.black} fontSize="32" fontWeight="700" fontFamily={FONT}>Register Free →</text>
    </svg>
  );
}

// ─── 9:16 Story photo variant ──────────────────────────────────────────────
// Layout: large photo left/center, bold text right side of upper area,
// full-width CTA strip near bottom. Inspired by fitness app / beauty brand
// story ads that let the person dominate.

export function WebinarAdPhotoStory({ speaker }: { speaker: SpeakerKey }) {
  const uid = safeId(useId());
  const shadowId = `${uid}-sh`;
  const sp = SPEAKERS[speaker];

  return (
    <svg
      className="webinar-ad-svg webinar-ad-svg--story"
      viewBox="0 0 1080 1920"
      role="img"
      aria-label={`Webinar story ad, ${sp.name}`}
    >
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0%" y1="0%" x2="30%" y2="100%">
          <stop offset="0%" stopColor={sp.accentDark} />
          <stop offset="60%" stopColor={sp.bg} />
          <stop offset="100%" stopColor={sp.bg} />
        </linearGradient>
        <linearGradient id={`${uid}-btm`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={sp.bg} stopOpacity="0" />
          <stop offset="100%" stopColor={sp.bg} stopOpacity="1" />
        </linearGradient>
        <filter id={shadowId} x="-40%" y="-20%" width="180%" height="160%">
          <feDropShadow dx="0" dy="20" stdDeviation="32" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Background */}
      <rect width="1080" height="1920" fill={`url(#${uid}-bg)`} />

      {/* Faint glow behind person */}
      <radialGradient id={`${uid}-glow`} cx="40%" cy="55%" r="40%">
        <stop offset="0%" stopColor={sp.accent} stopOpacity="0.12" />
        <stop offset="100%" stopColor={sp.accent} stopOpacity="0" />
      </radialGradient>
      <rect width="1080" height="1920" fill={`url(#${uid}-glow)`} />

      {/* Left accent bar */}
      <rect x="0" y="0" width="5" height="1920" fill={sp.accent} />

      {/* Speaker photo — left-anchored, large */}
      <image
        href={PHOTOS[speaker]}
        x={sp.fullBody ? -60 : 0}
        y={sp.fullBody ? 280 : 480}
        width={sp.fullBody ? 800 : 1080}
        height={sp.fullBody ? 1300 : 800}
        preserveAspectRatio={sp.fullBody ? "xMinYMax meet" : "xMidYMid meet"}
      />

      {/* Bottom gradient to ensure CTA readability */}
      <rect x="0" y="1300" width="1080" height="620" fill={`url(#${uid}-btm)`} />
      <rect x="0" y="1560" width="1080" height="360" fill={sp.bg} />

      {/* TOP: headline — right side, large */}
      <text x="1040" y="380" textAnchor="end" fill={G.white} fontSize="88" fontWeight="900" fontFamily={FONT} letterSpacing="-1">Double</text>
      <text x="1040" y="480" textAnchor="end" fill={G.white} fontSize="88" fontWeight="900" fontFamily={FONT} letterSpacing="-1">patient</text>
      <text x="1040" y="580" textAnchor="end" fill={sp.accent} fontSize="88" fontWeight="900" fontFamily={FONT} letterSpacing="-1">spend.</text>

      {/* FREE chip — top right */}
      <rect x="720" y="200" width="320" height="48" rx="24" fill={sp.accent} opacity="0.14" />
      <text x="880" y="232" textAnchor="middle" fill={sp.accent} fontSize="18" fontWeight="700" fontFamily={FONT} letterSpacing="3">FREE LIVE WEBINAR</text>

      {/* Bottom: speaker + CTA */}
      <text x="540" y="1620" textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize="26" fontWeight="700" fontFamily={FONT}>{sp.name}</text>
      <text x="540" y="1654" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="21" fontFamily={FONT}>{sp.practice} · {sp.city}</text>

      <rect x="100" y="1694" width="880" height="96" rx="48" fill={sp.accent} filter={`url(#${shadowId})`} />
      <text x="540" y="1754" textAnchor="middle" fill={G.black} fontSize="38" fontWeight="700" fontFamily={FONT}>Save My Seat →</text>

      <text x="540" y="1848" textAnchor="middle" fill="rgba(255,255,255,0.22)" fontSize="24" fontFamily={FONT}>Tue · 7:00 PM ET · 45 min · Free</text>
    </svg>
  );
}
