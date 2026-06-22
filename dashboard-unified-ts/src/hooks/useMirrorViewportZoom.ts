import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import {
  clampViewportZoom,
  VIEWPORT_MIN_ZOOM,
  type ViewportTransform,
  wheelZoomFactor,
  zoomViewportAboutPoint,
} from "../utils/mirrorViewportZoomMath";

export type { ViewportTransform };

export type CompareViewportPaneApi = {
  getTransform: () => ViewportTransform;
  applyTransform: (transform: ViewportTransform) => void;
};

const PAN_IGNORE_SELECTOR =
  "button, a, input, textarea, select, summary, [data-pan-gesture='ignore'], .avf-drawing-layer, .avf-annotate-toolbar";

export type MirrorViewportZoomOptions = {
  viewerRef: RefObject<HTMLElement | null>;
  zoomLayerRef: RefObject<HTMLElement | null>;
  initialZoom?: number;
  /** Floor for wheel zoom-out; defaults to max(VIEWPORT_MIN_ZOOM, initialZoom). */
  minZoom?: number;
  initialPanX?: number;
  initialPanY?: number;
  /** When true, drag pans even at the minimum zoom (default false). */
  allowPanAtMinZoom?: boolean;
  /** When false, wheel events pass through for page scroll (public blueprint pages). */
  wheelZoomEnabled?: boolean;
  /** Called after zoom/pan changes (e.g. redraw annotation canvas). */
  onTransformChange?: () => void;
  /** Fired on every pan/zoom change including during drag, for linked compare panes. */
  onViewportTransformChange?: (transform: ViewportTransform) => void;
};

export function useMirrorViewportZoom({
  viewerRef,
  zoomLayerRef,
  initialZoom = 1,
  minZoom: minZoomOption,
  initialPanX = 0,
  initialPanY = 0,
  allowPanAtMinZoom = false,
  wheelZoomEnabled = true,
  onTransformChange,
  onViewportTransformChange,
}: MirrorViewportZoomOptions) {
  const resolvedMinZoom =
    minZoomOption ?? Math.max(VIEWPORT_MIN_ZOOM, initialZoom);
  const minZoomRef = useRef(resolvedMinZoom);
  const zoomRef = useRef(initialZoom);
  const panXRef = useRef(initialPanX);
  const panYRef = useRef(initialPanY);
  const [zoom, setZoom] = useState(initialZoom);
  const panningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const onViewportTransformChangeRef = useRef(onViewportTransformChange);
  onViewportTransformChangeRef.current = onViewportTransformChange;

  useEffect(() => {
    minZoomRef.current =
      minZoomOption ?? Math.max(VIEWPORT_MIN_ZOOM, initialZoom);
  }, [initialZoom, minZoomOption]);

  const applyTransformDOM = useCallback(
    (px: number, py: number, z: number) => {
      if (zoomLayerRef.current) {
        const x = Math.round(px);
        const y = Math.round(py);
        zoomLayerRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${z})`;
      }
      onTransformChange?.();
    },
    [zoomLayerRef, onTransformChange],
  );

  const commitTransform = useCallback(
    (transform: ViewportTransform) => {
      zoomRef.current = transform.zoom;
      panXRef.current = transform.panX;
      panYRef.current = transform.panY;
      applyTransformDOM(transform.panX, transform.panY, transform.zoom);
      setZoom(transform.zoom);
      onViewportTransformChangeRef.current?.(transform);
    },
    [applyTransformDOM],
  );

  const resetTransform = useCallback(() => {
    commitTransform({
      zoom: initialZoom,
      panX: initialPanX,
      panY: initialPanY,
    });
  }, [commitTransform, initialPanX, initialPanY, initialZoom]);

  const getViewportTransform = useCallback((): ViewportTransform => {
    return {
      zoom: zoomRef.current,
      panX: panXRef.current,
      panY: panYRef.current,
    };
  }, []);

  /** Imperatively apply a transform without firing onViewportTransformChange (used by linked follower pane). */
  const applyViewportTransform = useCallback(
    (transform: ViewportTransform) => {
      zoomRef.current = transform.zoom;
      panXRef.current = transform.panX;
      panYRef.current = transform.panY;
      applyTransformDOM(transform.panX, transform.panY, transform.zoom);
      setZoom(transform.zoom);
    },
    [applyTransformDOM],
  );

  // Keep a stable ref to applyTransformDOM so the mount-only layout effect
  // below can call the latest version without needing it as a dependency.
  const applyTransformDOMRef = useRef(applyTransformDOM);
  applyTransformDOMRef.current = applyTransformDOM;

  // Apply the initial CSS transform synchronously before the first paint.
  // Without this the zoom layer has no inline transform on mount, so it
  // renders at scale(1) even when initialZoom != 1. The existing useEffect
  // guard (refs already equal initialZoom) would skip the update entirely,
  // causing a visible jump on the very first wheel/zoom interaction.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    applyTransformDOMRef.current(panXRef.current, panYRef.current, zoomRef.current);
  }, []);

  useEffect(() => {
    // Skip if the viewport is already at the target to avoid flashing when
    // props like highlightedRegionIds re-render but framing hasn't changed.
    if (
      Math.abs(zoomRef.current - initialZoom) < 0.0001 &&
      Math.abs(panXRef.current - initialPanX) < 0.01 &&
      Math.abs(panYRef.current - initialPanY) < 0.01
    ) {
      return;
    }
    zoomRef.current = initialZoom;
    panXRef.current = initialPanX;
    panYRef.current = initialPanY;
    applyTransformDOM(initialPanX, initialPanY, initialZoom);
    setZoom(initialZoom);
  }, [initialZoom, initialPanX, initialPanY, applyTransformDOM]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !wheelZoomEnabled) return;

    const onWheel = (e: WheelEvent) => {
      const factor = wheelZoomFactor(e.deltaY, e.deltaMode);
      const oldZoom = zoomRef.current;
      const newZoom = clampViewportZoom(oldZoom * factor, minZoomRef.current);
      if (Math.abs(newZoom - oldZoom) < 0.0001) return;
      e.preventDefault();
      const rect = viewer.getBoundingClientRect();
      const cx = e.clientX - (rect.left + rect.width / 2);
      const cy = e.clientY - (rect.top + rect.height / 2);
      const { panX: newPanX, panY: newPanY } = zoomViewportAboutPoint({
        oldZoom,
        newZoom,
        panX: panXRef.current,
        panY: panYRef.current,
        focalX: cx,
        focalY: cy,
      });
      commitTransform({ zoom: newZoom, panX: newPanX, panY: newPanY });
    };

    viewer.addEventListener("wheel", onWheel, { passive: false });
    return () => viewer.removeEventListener("wheel", onWheel);
  }, [viewerRef, commitTransform, wheelZoomEnabled]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (
        !allowPanAtMinZoom &&
        zoomRef.current <= minZoomRef.current + 0.02
      ) {
        return;
      }
      if ((e.target as HTMLElement).closest(PAN_IGNORE_SELECTOR)) return;
      e.preventDefault();
      panningRef.current = true;
      viewer.classList.add("avf-zoom-viewport--panning");
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: panXRef.current,
        panY: panYRef.current,
      };
      viewer.setPointerCapture(e.pointerId);
      viewer.style.cursor = "grabbing";
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!panningRef.current) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      panXRef.current = panStartRef.current.panX + dx;
      panYRef.current = panStartRef.current.panY + dy;
      const next = {
        zoom: zoomRef.current,
        panX: panXRef.current,
        panY: panYRef.current,
      };
      // Apply locally (no onTransformChange needed mid-drag)
      if (zoomLayerRef.current) {
        const x = Math.round(next.panX);
        const y = Math.round(next.panY);
        zoomLayerRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${next.zoom})`;
      }
      // Always fire change callback so linked panes can follow in real time
      onViewportTransformChangeRef.current?.(next);
    };

    const endPan = (e: PointerEvent) => {
      if (!panningRef.current) return;
      panningRef.current = false;
      viewer.classList.remove("avf-zoom-viewport--panning");
      commitTransform({
        zoom: zoomRef.current,
        panX: panXRef.current,
        panY: panYRef.current,
      });
      viewer.style.cursor =
        allowPanAtMinZoom || zoomRef.current > minZoomRef.current + 0.02
          ? "grab"
          : "";
      try {
        viewer.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    };

    viewer.style.cursor =
      allowPanAtMinZoom || zoomRef.current > minZoomRef.current + 0.02
        ? "grab"
        : "";

    viewer.addEventListener("pointerdown", onPointerDown);
    viewer.addEventListener("pointermove", onPointerMove);
    viewer.addEventListener("pointerup", endPan);
    viewer.addEventListener("pointercancel", endPan);
    return () => {
      viewer.removeEventListener("pointerdown", onPointerDown);
      viewer.removeEventListener("pointermove", onPointerMove);
      viewer.removeEventListener("pointerup", endPan);
      viewer.removeEventListener("pointercancel", endPan);
    };
  }, [viewerRef, commitTransform, allowPanAtMinZoom, zoomLayerRef]);

  return {
    zoom,
    resetTransform,
    minZoom: minZoomRef.current,
    getViewportTransform,
    applyViewportTransform,
  };
}
