import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/** Matches status key / filter-option palette in ViewControls.css */
export type FilterSelectSwatch =
  | "default"
  | "muted"
  | "analysis-pending"
  | "analysis-ready"
  | "analysis-reviewed"
  | "complete"
  | "pending";

export type FilterSelectOption = {
  value: string;
  label: ReactNode;
  swatch?: FilterSelectSwatch;
};

export type FilterSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: FilterSelectOption[];
  id?: string;
  "aria-label"?: string;
};

const TRIGGER_VALUE_CLASS: Record<FilterSelectSwatch, string> = {
  default: "",
  muted: "filter-select--value-muted",
  "analysis-pending": "filter-select--value-analysis-pending",
  "analysis-ready": "filter-select--value-analysis-ready",
  "analysis-reviewed": "filter-select--value-analysis-reviewed",
  complete: "filter-select--value-complete",
  pending: "filter-select--value-pending",
};

const OPTION_CLASS: Record<FilterSelectSwatch, string> = {
  default: "filter-select-custom-option--default",
  muted: "filter-select-custom-option--muted",
  "analysis-pending": "filter-select-custom-option--analysis-pending",
  "analysis-ready": "filter-select-custom-option--analysis-ready",
  "analysis-reviewed": "filter-select-custom-option--analysis-reviewed",
  complete: "filter-select-custom-option--complete",
  pending: "filter-select-custom-option--pending",
};

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`filter-select-custom-chevron${open ? " filter-select-custom-chevron--open" : ""}`}
      aria-hidden
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function FilterSelect({
  value,
  onChange,
  options,
  id: idProp,
  "aria-label": ariaLabel,
}: FilterSelectProps) {
  const reactId = useId();
  const baseId = idProp ?? `filter-select-${reactId}`;
  const listboxId = `${baseId}-listbox`;
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuRect, setMenuRect] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const selectedIndex = useMemo(() => {
    const i = options.findIndex((o) => o.value === value);
    return i >= 0 ? i : 0;
  }, [options, value]);

  const selected = useMemo(() => {
    const found = options.find((o) => o.value === value);
    return found ?? options[0];
  }, [options, value]);

  const selectedSwatch: FilterSelectSwatch = selected?.swatch ?? "default";
  const triggerExtra =
    TRIGGER_VALUE_CLASS[selectedSwatch] &&
    selectedSwatch !== "default"
      ? ` ${TRIGGER_VALUE_CLASS[selectedSwatch]}`
      : "";

  const updateMenuPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 4;
    const w = Math.max(r.width, 160);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    const maxHeight = Math.min(
      280,
      Math.max(120, window.innerHeight - r.bottom - gap - 12),
    );
    setMenuRect({
      top: r.bottom + gap,
      left,
      width: w,
      maxHeight,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const onResizeOrScroll = () => updateMenuPosition();
    window.addEventListener("resize", onResizeOrScroll);
    window.addEventListener("scroll", onResizeOrScroll, true);
    return () => {
      window.removeEventListener("resize", onResizeOrScroll);
      window.removeEventListener("scroll", onResizeOrScroll, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = document.getElementById(`${baseId}-opt-${highlight}`);
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight, open, baseId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (options.length === 0) return;
        setHighlight((h) => Math.min(options.length - 1, h + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (options.length === 0) return;
        setHighlight((h) => Math.max(0, h - 1));
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const opt = options[highlight];
        if (opt) {
          onChange(opt.value);
          setOpen(false);
          triggerRef.current?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, highlight, options, onChange]);

  const openMenu = useCallback(() => {
    setHighlight(selectedIndex);
    updateMenuPosition();
    setOpen(true);
  }, [selectedIndex, updateMenuPosition]);

  const menu =
    open && menuRect
      ? createPortal(
          <div
            ref={menuRef}
            id={listboxId}
            role="listbox"
            className="filter-select-custom-menu"
            style={{
              top: menuRect.top,
              left: menuRect.left,
              width: menuRect.width,
              maxHeight: menuRect.maxHeight,
            }}
          >
            {options.map((opt, i) => {
              const sw = opt.swatch ?? "default";
              const isSelected = opt.value === value;
              const isHi = i === highlight;
              return (
                <button
                  key={opt.value === "" ? "__empty__" : opt.value}
                  type="button"
                  role="option"
                  id={`${baseId}-opt-${i}`}
                  aria-selected={isSelected}
                  className={`filter-select-custom-option ${OPTION_CLASS[sw]}${
                    isSelected ? " filter-select-custom-option--selected" : ""
                  }${isHi ? " filter-select-custom-option--highlight" : ""}`}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                >
                  <span className="filter-select-custom-option-label">
                    {opt.label}
                  </span>
                  {isSelected ? (
                    <span className="filter-select-custom-check" aria-hidden>
                      ✓
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={wrapRef} className="filter-select-custom">
      <button
        ref={triggerRef}
        type="button"
        id={baseId}
        className={`filter-select filter-select-custom-trigger${triggerExtra}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            openMenu();
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!open) openMenu();
          }
        }}
      >
        <span className="filter-select-custom-trigger-text">
          {selected ? selected.label : "—"}
        </span>
        <ChevronDown open={open} />
      </button>
      {menu}
    </div>
  );
}
