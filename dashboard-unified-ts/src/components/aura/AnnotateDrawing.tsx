import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent,
} from "react";
import { createPortal } from "react-dom";
import "./AnnotateDrawing.css";

export type AnnotateTool = "pen" | "highlighter" | "eraser" | "text";

export type AnnotateInkStroke = {
  kind?: "stroke";
  d: string;
  color: string;
  width: number;
  opacity: number;
  tool: Exclude<AnnotateTool, "text">;
};

export type AnnotateTextMark = {
  kind: "text";
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
  opacity: number;
  tool: "text";
};

export type AnnotateStroke = AnnotateInkStroke | AnnotateTextMark;

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
const TEXT_EDITOR_WIDTH = 38;

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

type Point = [number, number];

type HistoryEntry =
  | { type: "add"; stroke: AnnotateStroke }
  | { type: "erase"; strokes: AnnotateInkStroke[] };

/** Parse M/L paths produced by this canvas (viewBox 0–100). */
function pathToPoints(d: string): Point[] {
  const points: Point[] = [];
  const tokens = d.trim().split(/\s+/);
  for (let i = 0; i < tokens.length; ) {
    const cmd = tokens[i];
    if (cmd === "M" || cmd === "L") {
      const x = Number.parseFloat(tokens[i + 1] ?? "");
      const y = Number.parseFloat(tokens[i + 2] ?? "");
      if (Number.isFinite(x) && Number.isFinite(y)) points.push([x, y]);
      i += 3;
    } else {
      i += 1;
    }
  }
  return points;
}

function minDistanceBetweenPolylines(a: Point[], b: Point[]): number {
  let min = Infinity;
  for (const [ax, ay] of a) {
    for (const [bx, by] of b) {
      min = Math.min(min, Math.hypot(ax - bx, ay - by));
    }
  }
  return min;
}

/** Screen-pixel widths → approximate hit radius in viewBox units. */
function eraserHitRadius(inkWidth: number, eraserWidth: number): number {
  const pxToViewBox = 0.22;
  return Math.max(1, ((inkWidth + eraserWidth) / 2) * pxToViewBox);
}

function strokeHitByEraser(
  stroke: AnnotateInkStroke,
  eraserPath: string,
  eraserWidth: number,
): boolean {
  if (eraserPath.length < 4) return false;
  const inkPts = pathToPoints(stroke.d);
  const eraserPts = pathToPoints(eraserPath);
  if (inkPts.length === 0 || eraserPts.length === 0) return false;
  return (
    minDistanceBetweenPolylines(inkPts, eraserPts) <=
    eraserHitRadius(stroke.width, eraserWidth)
  );
}

function isInkStroke(mark: AnnotateStroke): mark is AnnotateInkStroke {
  return mark.kind !== "text";
}

function isVisibleMark(mark: AnnotateStroke): boolean {
  return mark.tool !== "eraser";
}

function textFontSize(width: number): number {
  if (width <= 3) return 2.25;
  if (width <= 6) return 2.75;
  if (width <= 11) return 3.35;
  return 4.15;
}

function clampTextX(x: number): number {
  return Math.min(88, Math.max(4, x));
}

function clampTextY(y: number): number {
  return Math.min(94, Math.max(6, y));
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
  const [tool, setTool] = useState<AnnotateTool>("pen");
  const [color, setColor] = useState<string>(DEFAULT_COLOR);
  const [width, setWidth] = useState<number>(DEFAULT_WIDTH);
  const [internalStrokes, setInternalStrokes] = useState<AnnotateStroke[]>([]);
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);
  const [current, setCurrent] = useState<AnnotateInkStroke | null>(null);
  const [draftText, setDraftText] = useState<{
    x: number;
    y: number;
    value: string;
  } | null>(null);
  const drawingRef = useRef(false);
  const eraseGestureRemovedRef = useRef<AnnotateInkStroke[]>([]);

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

  const visibleMarks = strokes.filter(isVisibleMark);
  const inkStrokes = strokes.filter((s): s is AnnotateInkStroke => isInkStroke(s) && s.tool !== "eraser");
  const textMarks = strokes.filter((s): s is AnnotateTextMark => s.kind === "text");
  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;
  const activeTextFontSize = textFontSize(width);
  const activeTextEditorHeight = Math.max(4.2, activeTextFontSize * 1.65);

  const eraseAlongPath = useCallback(
    (eraserPath: string, eraserWidth: number) => {
      setStrokes((prev) => {
        const ink = prev.filter((s) => s.tool !== "eraser");
        const removed: AnnotateInkStroke[] = [];
        const kept = ink.filter((stroke) => {
          if (!isInkStroke(stroke)) return true;
          if (strokeHitByEraser(stroke, eraserPath, eraserWidth)) {
            removed.push(stroke);
            return false;
          }
          return true;
        });
        if (removed.length === 0) return prev;
        eraseGestureRemovedRef.current.push(...removed);
        return kept;
      });
    },
    [setStrokes],
  );

  const finishStroke = useCallback(() => {
    drawingRef.current = false;
    setCurrent((stroke) => {
      if (!stroke) return null;

      if (stroke.tool === "eraser") {
        if (eraseGestureRemovedRef.current.length > 0) {
          setUndoStack((u) => [
            ...u,
            {
              type: "erase",
              strokes: [...eraseGestureRemovedRef.current],
            },
          ]);
          setRedoStack([]);
          eraseGestureRemovedRef.current = [];
        }
        return null;
      }

      if (stroke.d.length > 3) {
        setStrokes((prev) => [...prev, stroke]);
        setUndoStack((u) => [...u, { type: "add", stroke }]);
        setRedoStack([]);
      }
      return null;
    });
  }, [setStrokes]);

  const undo = useCallback(() => {
    setUndoStack((u) => {
      const entry = u[u.length - 1];
      if (!entry) return u;
      if (entry.type === "add") {
        setStrokes((prev) => {
          const idx = prev.lastIndexOf(entry.stroke);
          if (idx === -1) return prev.slice(0, -1);
          return prev.filter((_, i) => i !== idx);
        });
      } else {
        setStrokes((prev) => [...prev, ...entry.strokes]);
      }
      setRedoStack((r) => [...r, entry]);
      return u.slice(0, -1);
    });
    setCurrent(null);
  }, [setStrokes]);

  const redo = useCallback(() => {
    setRedoStack((r) => {
      const entry = r[r.length - 1];
      if (!entry) return r;
      if (entry.type === "add") {
        setStrokes((prev) => [...prev, entry.stroke]);
      } else {
        setStrokes((prev) => {
          const removeSet = new Set<AnnotateStroke>(entry.strokes);
          return prev.filter((s) => !removeSet.has(s));
        });
      }
      setUndoStack((u) => [...u, entry]);
      return r.slice(0, -1);
    });
  }, [setStrokes]);

  const clearAll = useCallback(() => {
    if (strokes.length === 0) return;
    setStrokes([]);
    setUndoStack([]);
    setRedoStack([]);
    eraseGestureRemovedRef.current = [];
    setCurrent(null);
    setDraftText(null);
  }, [strokes.length, setStrokes]);

  const commitDraftText = useCallback(() => {
    setDraftText((draft) => {
      const text = draft?.value.trim();
      if (!draft || !text) return null;
      const mark: AnnotateTextMark = {
        kind: "text",
        x: draft.x,
        y: draft.y,
        text,
        color,
        fontSize: textFontSize(width),
        opacity: 0.94,
        tool: "text",
      };
      setStrokes((prev) => [...prev, mark]);
      setUndoStack((u) => [...u, { type: "add", stroke: mark }]);
      setRedoStack([]);
      return null;
    });
  }, [color, setStrokes, width]);

  const cancelDraftText = useCallback(() => {
    setDraftText(null);
  }, []);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
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
      else if (k === "t") setTool("text");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, undo, redo]);

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (!active) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = svgPointFromPointer(e.currentTarget, e.clientX, e.clientY);
    if (tool === "text") {
      setDraftText({ x: clampTextX(x), y: clampTextY(y), value: "" });
      drawingRef.current = false;
      setCurrent(null);
      return;
    }

    commitDraftText();
    drawingRef.current = true;
    if (tool === "eraser") {
      eraseGestureRemovedRef.current = [];
      setCurrent({
        d: `M ${x} ${y}`,
        color: "#000000",
        width: width * 2.4,
        opacity: 1,
        tool: "eraser",
      });
      return;
    }

    setCurrent({
      d: `M ${x} ${y}`,
      color,
      width: tool === "highlighter" ? width * 1.75 : width,
      opacity: strokeOpacity(tool),
      tool,
    });
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!active || !drawingRef.current) return;
    const { x, y } = svgPointFromPointer(e.currentTarget, e.clientX, e.clientY);
    setCurrent((stroke) => {
      if (!stroke) return null;
      const nextPath = `${stroke.d} L ${x} ${y}`;
      if (stroke.tool === "eraser") {
        const next = { ...stroke, d: nextPath };
        eraseAlongPath(next.d, next.width);
        return next;
      }
      return { ...stroke, d: nextPath };
    });
  };

  const onDraftKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitDraftText();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      cancelDraftText();
    }
  };

  const showCanvas = active || strokes.length > 0;
  const showToolbar =
    active || (visibleMarks.length > 0 && Boolean(onSave || onDownload));

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
                className={`avf-annotate-tool${tool === "text" ? " avf-annotate-tool--active" : ""}`}
                title="Text (T)"
                aria-pressed={tool === "text"}
                onClick={() => setTool("text")}
              >
                <IconText />
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
          disabled={visibleMarks.length === 0}
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
            disabled={visibleMarks.length === 0}
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
            disabled={visibleMarks.length === 0}
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
          data-pan-gesture="ignore"
          aria-hidden={!active}
          aria-label={active ? "Draw on face" : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
          onLostPointerCapture={finishStroke}
        >
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
          {textMarks.map((mark, i) => (
            <text
              key={`text-${i}`}
              x={mark.x}
              y={mark.y}
              fill={mark.color}
              fillOpacity={mark.opacity}
              fontSize={mark.fontSize}
              fontWeight={650}
              stroke="rgba(0, 0, 0, 0.74)"
              strokeWidth={0.26}
              paintOrder="stroke"
              className="avf-drawing-layer__text"
            >
              {mark.text}
            </text>
          ))}
          {draftText ? (
            <foreignObject
              x={draftText.x}
              y={Math.max(1, draftText.y - activeTextEditorHeight + 0.5)}
              width={Math.min(TEXT_EDITOR_WIDTH, 98 - draftText.x)}
              height={activeTextEditorHeight}
              className="avf-drawing-layer__text-editor-wrap"
            >
              <input
                className="avf-drawing-layer__text-editor"
                value={draftText.value}
                placeholder="Text"
                style={{
                  color,
                  fontSize: `${Math.max(11, activeTextFontSize * 4.3)}px`,
                }}
                autoFocus
                onPointerDown={(e) => {
                  e.stopPropagation();
                }}
                onChange={(e) => setDraftText((draft) => draft ? { ...draft, value: e.target.value } : draft)}
                onKeyDown={onDraftKeyDown}
                onBlur={commitDraftText}
              />
            </foreignObject>
          ) : null}
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
          {current?.tool === "eraser" ? (
            <path
              d={current.d}
              fill="none"
              stroke="rgba(255, 255, 255, 0.55)"
              strokeWidth={current.width}
              strokeOpacity={0.9}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
              className="avf-drawing-layer__eraser-preview"
            />
          ) : null}
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

function IconText() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M5 5h14" strokeLinecap="round" />
      <path d="M12 5v14" strokeLinecap="round" />
      <path d="M9 19h6" strokeLinecap="round" />
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
