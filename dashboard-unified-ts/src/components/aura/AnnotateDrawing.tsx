import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { createPortal } from "react-dom";
import "./AnnotateDrawing.css";

export type AnnotateTool = "pen" | "highlighter" | "eraser";

export type AnnotateStroke = {
  d: string;
  color: string;
  width: number;
  opacity: number;
  tool: AnnotateTool;
};

export const ANNOTATE_COLOR_PRESETS = [
  { id: "coral", label: "Coral", value: "#ff7a45" },
  { id: "amber", label: "Amber", value: "#fbbf24" },
  { id: "mint", label: "Mint", value: "#5eead4" },
  { id: "sky", label: "Sky", value: "#38bdf8" },
  { id: "rose", label: "Rose", value: "#fb7185" },
  { id: "white", label: "White", value: "#f8fafc" },
] as const;

/** Screen-pixel stroke widths (`vectorEffect="non-scaling-stroke"` on the SVG layer). */
const WIDTH_PRESETS = [
  { id: "thin", label: "Thin", value: 3 },
  { id: "medium", label: "Medium", value: 6 },
  { id: "thick", label: "Thick", value: 11 },
  { id: "bold", label: "Bold", value: 18 },
] as const;

const DEFAULT_COLOR = ANNOTATE_COLOR_PRESETS[0].value;
const DEFAULT_WIDTH = WIDTH_PRESETS[1].value;

function svgPointFromPointer(svg: SVGSVGElement, clientX: number, clientY: number) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const mapped = pt.matrixTransform(svg.getScreenCTM()?.inverse());
  return { x: Math.round(mapped.x * 10) / 10, y: Math.round(mapped.y * 10) / 10 };
}

function strokeOpacity(tool: AnnotateTool): number {
  if (tool === "highlighter") return 0.42;
  return 0.92;
}

type AnnotateDrawingProps = {
  /** When false, toolbar hides and canvas ignores input (marks remain visible). */
  active: boolean;
  /** Controlled ink (optional — lifts state to parent for save / reload). */
  strokes?: AnnotateStroke[];
  onStrokesChange?: (strokes: AnnotateStroke[]) => void;
  onSave?: () => void;
  onDownload?: () => void;
  saveLabel?: string;
  /**
   * Mount toolbar on viewport (avoids clipping inside Face3D zoom layer).
   * `undefined` = render inline; `null` = wait for host; `HTMLElement` = portal target.
   */
  toolbarContainer?: HTMLElement | null | undefined;
};

export default function AnnotateDrawing({
  active,
  strokes: strokesProp,
  onStrokesChange,
  onSave,
  onDownload,
  saveLabel = "Save",
  toolbarContainer,
}: AnnotateDrawingProps) {
  const maskId = useId().replace(/:/g, "");
  const [tool, setTool] = useState<AnnotateTool>("pen");
  const [color, setColor] = useState<string>(DEFAULT_COLOR);
  const [width, setWidth] = useState<number>(DEFAULT_WIDTH);
  const [internalStrokes, setInternalStrokes] = useState<AnnotateStroke[]>([]);
  const [redoStack, setRedoStack] = useState<AnnotateStroke[]>([]);
  const [current, setCurrent] = useState<AnnotateStroke | null>(null);
  const drawingRef = useRef(false);

  const controlled = onStrokesChange !== undefined;
  const strokes = controlled ? (strokesProp ?? []) : internalStrokes;

  const setStrokes = useCallback(
    (updater: AnnotateStroke[] | ((prev: AnnotateStroke[]) => AnnotateStroke[])) => {
      const next = typeof updater === "function" ? updater(strokes) : updater;
      if (controlled) onStrokesChange!(next);
      else setInternalStrokes(next);
    },
    [controlled, onStrokesChange, strokes],
  );

  const inkStrokes = strokes.filter((s) => s.tool !== "eraser");
  const eraserStrokes = strokes.filter((s) => s.tool === "eraser");
  const canUndo = strokes.length > 0;
  const canRedo = redoStack.length > 0;

  const commitStroke = useCallback(
    (stroke: AnnotateStroke) => {
      setStrokes((prev) => [...prev, stroke]);
      setRedoStack([]);
    },
    [setStrokes],
  );

  const finishStroke = useCallback(() => {
    drawingRef.current = false;
    setCurrent((stroke) => {
      if (stroke && stroke.d.length > 3) commitStroke(stroke);
      return null;
    });
  }, [commitStroke, setStrokes]);

  const undo = useCallback(() => {
    setStrokes((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const removed = next.pop()!;
      setRedoStack((r) => [...r, removed]);
      return next;
    });
    setCurrent(null);
  }, [setStrokes]);

  const redo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const restored = next.pop()!;
      setStrokes((s) => [...s, restored]);
      return next;
    });
  }, [setStrokes]);

  const clearAll = useCallback(() => {
    if (strokes.length === 0) return;
    setStrokes([]);
    setRedoStack([]);
    setCurrent(null);
  }, [strokes.length, setStrokes]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (mod && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (k === "p") setTool("pen");
      else if (k === "h") setTool("highlighter");
      else if (k === "e") setTool("eraser");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, undo, redo]);

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (!active) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const { x, y } = svgPointFromPointer(e.currentTarget, e.clientX, e.clientY);
    setCurrent({
      d: `M ${x} ${y}`,
      color: tool === "eraser" ? "#000000" : color,
      width:
        tool === "eraser"
          ? width * 2.4
          : tool === "highlighter"
            ? width * 1.75
            : width,
      opacity: strokeOpacity(tool),
      tool,
    });
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!active || !drawingRef.current) return;
    const { x, y } = svgPointFromPointer(e.currentTarget, e.clientX, e.clientY);
    setCurrent((stroke) =>
      stroke ? { ...stroke, d: `${stroke.d} L ${x} ${y}` } : null,
    );
  };

  const showCanvas = active || strokes.length > 0;
  const showToolbar =
    active || (inkStrokes.length > 0 && Boolean(onSave || onDownload));

  const toolbar = showToolbar ? (
    <div
      className={`avf-annotate-toolbar${active ? "" : " avf-annotate-toolbar--compact"}`}
      role="toolbar"
      aria-label="Annotation tools"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {active ? (
        <>
          <div className="avf-annotate-toolbar__cluster">
            <div className="avf-annotate-toolbar__tools">
              <button
                type="button"
                className="avf-annotate-tool avf-annotate-tool--history"
                title="Undo (⌘Z)"
                aria-label="Undo"
                disabled={!canUndo}
                onClick={undo}
              >
                <IconUndo />
              </button>
              <button
                type="button"
                className="avf-annotate-tool avf-annotate-tool--history"
                title="Redo (⌘⇧Z)"
                aria-label="Redo"
                disabled={!canRedo}
                onClick={redo}
              >
                <IconRedo />
              </button>
              <span className="avf-annotate-toolbar__tools-divider" aria-hidden />
              <button
                type="button"
                className={`avf-annotate-tool${tool === "pen" ? " avf-annotate-tool--active" : ""}`}
                title="Pen (P)"
                aria-pressed={tool === "pen"}
                onClick={() => setTool("pen")}
              >
                <IconPen />
              </button>
              <button
                type="button"
                className={`avf-annotate-tool${tool === "highlighter" ? " avf-annotate-tool--active" : ""}`}
                title="Highlighter (H)"
                aria-pressed={tool === "highlighter"}
                onClick={() => setTool("highlighter")}
              >
                <IconHighlighter />
              </button>
              <button
                type="button"
                className={`avf-annotate-tool${tool === "eraser" ? " avf-annotate-tool--active" : ""}`}
                title="Eraser (E)"
                aria-pressed={tool === "eraser"}
                onClick={() => setTool("eraser")}
              >
                <IconEraser />
              </button>
            </div>
          </div>
          <span className="avf-annotate-toolbar__divider" aria-hidden />
          <div
            className="avf-annotate-toolbar__cluster avf-annotate-toolbar__colors"
            role="list"
            aria-label="Marker colors"
          >
            {ANNOTATE_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                role="listitem"
                className={`avf-annotate-swatch${color === preset.value ? " avf-annotate-swatch--active" : ""}`}
                style={{ "--swatch": preset.value } as CSSProperties}
                title={preset.label}
                aria-label={preset.label}
                aria-pressed={color === preset.value}
                disabled={tool === "eraser"}
                onClick={() => setColor(preset.value)}
              />
            ))}
            <label className="avf-annotate-color-input" title="Custom color">
              <span className="sr-only">Custom color</span>
              <input
                type="color"
                value={color}
                disabled={tool === "eraser"}
                onChange={(e) => setColor(e.target.value)}
              />
            </label>
          </div>
          <span className="avf-annotate-toolbar__divider" aria-hidden />
          <div
            className="avf-annotate-toolbar__cluster avf-annotate-width-presets"
            role="group"
            aria-label="Line thickness"
          >
            {WIDTH_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`avf-annotate-width-preset${width === preset.value ? " avf-annotate-width-preset--active" : ""}`}
                title={`${preset.label} (${preset.value}px)`}
                aria-label={preset.label}
                aria-pressed={width === preset.value}
                onClick={() => setWidth(preset.value)}
              >
                <span
                  className="avf-annotate-width-dot"
                  style={{
                    width: 4 + preset.value * 0.5,
                    height: 4 + preset.value * 0.5,
                  }}
                />
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="avf-annotate-toolbar__cluster">
          <div className="avf-annotate-toolbar__tools">
            <button
              type="button"
              className="avf-annotate-tool avf-annotate-tool--history"
              title="Undo (⌘Z)"
              aria-label="Undo"
              disabled={!canUndo}
              onClick={undo}
            >
              <IconUndo />
            </button>
            <button
              type="button"
              className="avf-annotate-tool avf-annotate-tool--history"
              title="Redo (⌘⇧Z)"
              aria-label="Redo"
              disabled={!canRedo}
              onClick={redo}
            >
              <IconRedo />
            </button>
          </div>
        </div>
      )}

      <span className="avf-annotate-toolbar__divider" aria-hidden />

      <div className="avf-annotate-toolbar__cluster avf-annotate-toolbar__actions avf-annotate-toolbar__actions--secondary">
        <button
          type="button"
          className="avf-annotate-action avf-annotate-action--danger"
          title="Clear all marks"
          aria-label="Clear all"
          disabled={strokes.length === 0}
          onClick={clearAll}
        >
          <IconTrash />
        </button>
        {onDownload ? (
          <button
            type="button"
            className="avf-annotate-action avf-annotate-action--download"
            title="Download annotated image"
            aria-label="Download"
            disabled={inkStrokes.length === 0}
            onClick={onDownload}
          >
            <IconDownload />
          </button>
        ) : null}
        {onSave ? (
          <button
            type="button"
            className="avf-annotate-action avf-annotate-action--save"
            title="Save to patient files"
            disabled={inkStrokes.length === 0}
            onClick={onSave}
          >
            {saveLabel}
          </button>
        ) : null}
      </div>
    </div>
  ) : null;

  const toolbarMount =
    toolbar === null
      ? null
      : toolbarContainer === undefined
        ? toolbar
        : toolbarContainer
          ? createPortal(toolbar, toolbarContainer)
          : null;

  return (
    <>
      {toolbarMount}

      {showCanvas ? (
        <svg
          className={`avf-drawing-layer${active ? " avf-drawing-layer--active" : ""}`}
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden={!active}
          aria-label={active ? "Draw on face" : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
          onLostPointerCapture={finishStroke}
        >
          <defs>
            <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
              <rect x="0" y="0" width="100" height="100" fill="white" />
              {eraserStrokes.map((stroke, i) => (
                <path
                  key={`eraser-${i}`}
                  d={stroke.d}
                  fill="none"
                  stroke="black"
                  strokeWidth={stroke.width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {current?.tool === "eraser" ? (
                <path
                  d={current.d}
                  fill="none"
                  stroke="black"
                  strokeWidth={current.width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
            </mask>
          </defs>
          <g mask={`url(#${maskId})`}>
            {inkStrokes.map((stroke, i) => (
              <path
                key={i}
                d={stroke.d}
                fill="none"
                stroke={stroke.color}
                strokeWidth={stroke.width}
                strokeOpacity={stroke.opacity}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                className="avf-drawing-layer__stroke"
              />
            ))}
            {current && current.tool !== "eraser" ? (
              <path
                d={current.d}
                fill="none"
                stroke={current.color}
                strokeWidth={current.width}
                strokeOpacity={current.opacity}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                className="avf-drawing-layer__stroke avf-drawing-layer__stroke--live"
              />
            ) : null}
          </g>
        </svg>
      ) : null}
    </>
  );
}

function IconPen() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M12 19l7-7 3 3-7 7-3-3z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 13l-1.5-1.5" />
      <path d="M2 22l4-1 9-9-3-3-9 9-1 4z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconHighlighter() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M9 11l-6 6v3h3l6-6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m22 2-7 7-3-3 7-7 3 3z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconEraser() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="m7 21-4-4 9-9 4 4-9 9z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 4l6 6" />
    </svg>
  );
}

function IconUndo() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M9 14 4 9l5-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" strokeLinecap="round" />
    </svg>
  );
}

function IconRedo() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M15 14l5-5-5-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13" strokeLinecap="round" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M3 6h18" strokeLinecap="round" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M12 3v12" strokeLinecap="round" />
      <path d="m7 10 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 21h14" strokeLinecap="round" />
    </svg>
  );
}
