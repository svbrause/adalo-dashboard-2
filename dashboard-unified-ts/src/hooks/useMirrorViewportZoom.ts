import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

export type MirrorViewportZoomOptions = {
  viewerRef: RefObject<HTMLElement | null>;
  zoomLayerRef: RefObject<HTMLElement | null>;
  initialZoom?: number;
  initialPanX?: number;
  initialPanY?: number;
  /** Called after zoom/pan changes (e.g. redraw annotation canvas). */
  onTransformChange?: () => void;
};

export function useMirrorViewportZoom({
  viewerRef,
  zoomLayerRef,
  initialZoom = 1,
  initialPanX = 0,
  initialPanY = 0,
  onTransformChange,
}: MirrorViewportZoomOptions) {
  const minZoomRef = useRef(Math.max(MIN_ZOOM, initialZoom));
  const zoomRef = useRef(initialZoom);
  const panXRef = useRef(initialPanX);
  const panYRef = useRef(initialPanY);
  const [zoom, setZoom] = useState(initialZoom);
  const panningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  useEffect(() => {
    minZoomRef.current = Math.max(MIN_ZOOM, initialZoom);
  }, [initialZoom]);

  const applyTransform = useCallback(
    (px: number, py: number, z: number) => {
      if (zoomLayerRef.current) {
        zoomLayerRef.current.style.transform = `translate(${px}px, ${py}px) scale(${z})`;
      }
      onTransformChange?.();
    },
    [zoomLayerRef, onTransformChange],
  );

  const resetTransform = useCallback(() => {
    const z = minZoomRef.current;
    zoomRef.current = z;
    panXRef.current = initialPanX;
    panYRef.current = initialPanY;
    applyTransform(initialPanX, initialPanY, z);
    setZoom(z);
  }, [applyTransform, initialPanX, initialPanY]);

  useEffect(() => {
    zoomRef.current = initialZoom;
    panXRef.current = initialPanX;
    panYRef.current = initialPanY;
    applyTransform(initialPanX, initialPanY, initialZoom);
    setZoom(initialZoom);
  }, [initialZoom, initialPanX, initialPanY, applyTransform]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const oldZoom = zoomRef.current;
      const newZoom = Math.max(minZoomRef.current, Math.min(MAX_ZOOM, oldZoom * factor));
      if (newZoom === oldZoom) return;
      const rect = viewer.getBoundingClientRect();
      const cx = e.clientX - (rect.left + rect.width / 2);
      const cy = e.clientY - (rect.top + rect.height / 2);
      const localX = (cx - panXRef.current) / oldZoom;
      const localY = (cy - panYRef.current) / oldZoom;
      const newPanX = cx - localX * newZoom;
      const newPanY = cy - localY * newZoom;
      zoomRef.current = newZoom;
      panXRef.current = newPanX;
      panYRef.current = newPanY;
      applyTransform(newPanX, newPanY, newZoom);
      setZoom(newZoom);
    };

    viewer.addEventListener("wheel", onWheel, { passive: false });
    return () => viewer.removeEventListener("wheel", onWheel);
  }, [viewerRef, applyTransform]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || zoomRef.current <= minZoomRef.current + 0.02) return;
      if ((e.target as HTMLElement).closest("button, a, input, summary")) return;
      e.preventDefault();
      panningRef.current = true;
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
      applyTransform(panXRef.current, panYRef.current, zoomRef.current);
    };

    const endPan = (e: PointerEvent) => {
      if (!panningRef.current) return;
      panningRef.current = false;
      viewer.style.cursor = zoomRef.current > minZoomRef.current ? "grab" : "";
      try {
        viewer.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    };

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
  }, [viewerRef, applyTransform]);

  return { zoom, resetTransform, minZoom: minZoomRef.current };
}
