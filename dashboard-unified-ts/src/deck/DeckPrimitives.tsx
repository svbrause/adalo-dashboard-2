import { ReactNode, useEffect, useRef } from "react";

export const assetSrc = (path: string) =>
  path.startsWith("public/") ? `/${path.slice("public/".length)}` : `/${path}`;

const defaultDashboardOrigin =
  import.meta.env.VITE_DASHBOARD_ORIGIN || "http://localhost:5173";

export const dashboardOrigin = (
  new URLSearchParams(window.location.search).get("dashboard") ||
  localStorage.getItem("ponceDemoDashboardOrigin") ||
  defaultDashboardOrigin
).replace(/\/$/, "");

export const dashboardUrl = (path: string) =>
  `${dashboardOrigin}${path.startsWith("/") ? path : `/${path}`}`;

export function encodeBlueprintForUrl(payload: unknown) {
  return btoa(encodeURIComponent(JSON.stringify(payload)));
}

export function LinkButton({
  path,
  href,
  children,
  className,
}: {
  path?: string;
  href?: string;
  children: ReactNode;
  className?: string;
}) {
  const url = href ?? dashboardUrl(path ?? "/");
  return (
    <a
      className={className ?? "launch-btn"}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}

export function Slide({
  active,
  className,
  children,
}: {
  active: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={["slide", active ? "active" : "", className ?? ""].filter(Boolean).join(" ")}
    >
      <div className="slide-inner">{children}</div>
    </section>
  );
}

export function SplitSlide({
  active,
  label,
  title,
  lead,
  chips,
  cta,
  className,
  children,
}: {
  active: boolean;
  label: string;
  title: string;
  lead: string;
  chips?: string[];
  cta?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Slide
      active={active}
      className={["slide--split", className ?? ""].filter(Boolean).join(" ")}
    >
      <div>
        <div className="label">{label}</div>
        <h1>{title}</h1>
        <p className="lead">{lead}</p>
        {chips?.length ? (
          <div className="outcome-chips">
            {chips.map((chip) => (
              <span key={chip}>{chip}</span>
            ))}
          </div>
        ) : null}
        {cta}
      </div>
      <div>{children}</div>
    </Slide>
  );
}

export function StoryVisual({
  left,
  right,
  children,
}: {
  left: ReactNode;
  right: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="story-visual">
      <div className="visual-topbar">
        <span>{left}</span>
        <span>{right}</span>
      </div>
      {children}
    </div>
  );
}

export function ParticleCanvas() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let raf = 0;

    const particles = Array.from({ length: 48 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.6 + Math.random() * 1.4,
      vx: (Math.random() - 0.5) * 0.00035,
      vy: (Math.random() - 0.5) * 0.00035,
      alpha: 0.12 + Math.random() * 0.28,
    }));

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    const tick = () => {
      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        p.x = (p.x + p.vx + 1) % 1;
        p.y = (p.y + p.vy + 1) % 1;
        ctx.beginPath();
        ctx.fillStyle = `rgba(45, 212, 191, ${p.alpha})`;
        ctx.arc(p.x * width, p.y * height, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas id="particles" ref={ref} aria-hidden />;
}

/** Seconds per half-loop (0 → end or end → 0) for deck turntable clips. */
const PING_PONG_HALF_LOOP_SEC = 7;

function safeSetPlaybackRate(video: HTMLVideoElement, rate: number): boolean {
  try {
    video.playbackRate = rate;
    return true;
  } catch {
    return false;
  }
}

function detectReversePlayback(video: HTMLVideoElement): boolean {
  const prev = video.playbackRate;
  if (!safeSetPlaybackRate(video, -1)) {
    safeSetPlaybackRate(video, prev || 1);
    return false;
  }
  const ok = video.playbackRate < 0;
  safeSetPlaybackRate(video, prev || 1);
  return ok;
}

function halfLoopRate(duration: number, direction: 1 | -1): number {
  if (!duration || !Number.isFinite(duration)) return direction;
  return (direction * duration) / PING_PONG_HALF_LOOP_SEC;
}

/**
 * Smooth turntable ping-pong: native forward play, native reverse when supported,
 * otherwise stepped reverse at the same apparent speed.
 */
export function PingPongVideo({
  src,
  active,
  className,
  ariaLabel,
  preload = "metadata",
}: {
  src: string;
  active: boolean;
  className?: string;
  ariaLabel?: string;
  preload?: "auto" | "metadata";
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef(0);
  const dirRef = useRef<1 | -1>(1);
  const reverseOkRef = useRef<boolean | null>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    const cancelTick = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };

    const playForward = () => {
      dirRef.current = 1;
      cancelTick();
      const d = video.duration;
      if (!d || !Number.isFinite(d)) {
        void video.play().catch(() => {});
        return;
      }
      const rate = halfLoopRate(d, 1);
      const doPlay = () => {
        if (dirRef.current !== 1) return;
        safeSetPlaybackRate(video, rate);
        void video.play().catch(() => {});
        const monitor = () => {
          rafRef.current = 0;
          if (dirRef.current !== 1) return;
          const duration = video.duration;
          if (!duration || !Number.isFinite(duration)) {
            rafRef.current = requestAnimationFrame(monitor);
            return;
          }
          if (video.currentTime >= duration - 0.04 || video.ended) {
            video.pause();
            video.currentTime = Math.max(0.04, duration - 0.04);
            playReverse();
            return;
          }
          rafRef.current = requestAnimationFrame(monitor);
        };
        rafRef.current = requestAnimationFrame(monitor);
      };
      if (video.currentTime >= d - 0.04) {
        video.currentTime = 0;
        video.addEventListener("seeked", doPlay, { once: true });
      } else {
        doPlay();
      }
    };

    const playReverseStepped = () => {
      dirRef.current = -1;
      cancelTick();
      video.pause();
      safeSetPlaybackRate(video, 1);
      const d = video.duration;
      if (!d || !Number.isFinite(d)) return;
      const speed = Math.abs(halfLoopRate(d, 1));
      let last = performance.now();
      const step = (now: number) => {
        rafRef.current = 0;
        if (dirRef.current !== -1) return;
        const elapsed = Math.min(0.05, (now - last) / 1000);
        last = now;
        const next = Math.max(0, video.currentTime - elapsed * speed);
        if (next <= 0.04) {
          video.currentTime = 0;
          playForward();
          return;
        }
        video.currentTime = next;
        rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    };

    const playReverse = () => {
      dirRef.current = -1;
      cancelTick();
      const d = video.duration;
      if (!d || !Number.isFinite(d)) {
        playReverseStepped();
        return;
      }
      if (reverseOkRef.current === null) {
        reverseOkRef.current = detectReversePlayback(video);
      }
      if (!reverseOkRef.current) {
        playReverseStepped();
        return;
      }
      const rate = halfLoopRate(d, -1);
      const endTime = Math.max(0.04, d - 0.04);
      const doPlay = () => {
        if (dirRef.current !== -1) return;
        if (!safeSetPlaybackRate(video, rate) || video.playbackRate >= 0) {
          reverseOkRef.current = false;
          playReverseStepped();
          return;
        }
        void video.play().catch(() => {
          reverseOkRef.current = false;
          playReverseStepped();
        });
        const monitor = () => {
          rafRef.current = 0;
          if (dirRef.current !== -1) return;
          const duration = video.duration;
          if (!duration || !Number.isFinite(duration)) {
            rafRef.current = requestAnimationFrame(monitor);
            return;
          }
          if (video.currentTime <= 0.04 || video.paused) {
            video.pause();
            safeSetPlaybackRate(video, 1);
            video.currentTime = 0;
            playForward();
            return;
          }
          rafRef.current = requestAnimationFrame(monitor);
        };
        rafRef.current = requestAnimationFrame(monitor);
      };
      if (Math.abs(video.currentTime - endTime) > 0.04) {
        video.pause();
        safeSetPlaybackRate(video, 1);
        video.currentTime = endTime;
        video.addEventListener("seeked", doPlay, { once: true });
      } else {
        doPlay();
      }
    };

    if (active) {
      reverseOkRef.current = null;
      video.currentTime = 0;
      playForward();
    } else {
      cancelTick();
      video.pause();
      video.currentTime = 0;
      safeSetPlaybackRate(video, 1);
    }
    return cancelTick;
  }, [active]);

  return (
    <video
      ref={ref}
      className={className}
      muted
      playsInline
      preload={preload}
      src={assetSrc(src)}
      aria-label={ariaLabel}
    />
  );
}
