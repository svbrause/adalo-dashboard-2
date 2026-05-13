import { useEffect, useRef } from "react";
import "./Face3DViewer.css";

/** Hint for layout; intrinsic size comes from the MP4 (512×488 … 1024×976, same aspect). */
const VIDEO_W = 1024;
const VIDEO_H = 976;

interface Face3DViewerProps {
  videoUrl: string;
  /** When false, angle stays fixed until the user drags again. */
  autoRotate: boolean;
}

const MAX_ANGLE = 85;
const DEG_PER_PX = 360 / 380;
const AUTO_SPEED = 36;

function angleToTime(angle: number, duration: number): number {
  return (((angle / 360) * duration + duration) % duration);
}

export default function Face3DViewer({ videoUrl, autoRotate }: Face3DViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const autoRotateRef = useRef(autoRotate);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const el = video;

    let angle = 0;
    let autoDir = 1;
    let dragging = false;
    let dragStartX = 0;
    let dragStartAngle = 0;
    let rafId: number;
    let lastTs = 0;

    function tick(now: number) {
      const dt = lastTs ? (now - lastTs) / 1000 : 0;
      lastTs = now;

      if (!dragging && autoRotateRef.current) {
        angle += AUTO_SPEED * dt * autoDir;
        if (angle >= MAX_ANGLE) {
          angle = MAX_ANGLE;
          autoDir = -1;
        } else if (angle <= -MAX_ANGLE) {
          angle = -MAX_ANGLE;
          autoDir = 1;
        }
      }

      if (el.readyState >= 2 && el.duration) {
        el.currentTime = angleToTime(angle, el.duration);
      }

      rafId = requestAnimationFrame(tick);
    }

    function onPointerDown(e: PointerEvent) {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragging = true;
      dragStartX = e.clientX;
      dragStartAngle = angle;
      el.style.cursor = "grabbing";
    }

    function onPointerMove(e: PointerEvent) {
      if (!dragging) return;
      const dx = e.clientX - dragStartX;
      angle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, dragStartAngle - dx * DEG_PER_PX));
    }

    function onPointerUp() {
      if (!dragging) return;
      dragging = false;
      el.style.cursor = "grab";
      autoDir = angle >= 0 ? 1 : -1;
    }

    el.pause();
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
    };
  }, [videoUrl]);

  return (
    <div className="face3d-wrap">
      <div className="face3d-viewer">
        <video
          ref={videoRef}
          className="face3d-video"
          src={videoUrl}
          width={VIDEO_W}
          height={VIDEO_H}
          preload="auto"
          muted
          playsInline
        />
      </div>
      <p className="face3d-hint">Drag to rotate</p>
    </div>
  );
}
