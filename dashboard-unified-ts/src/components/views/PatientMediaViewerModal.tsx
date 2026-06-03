import { useCallback, useEffect, useMemo, useState } from "react";
import type { SavedPatientAnnotation } from "../../utils/patientAnnotationsStorage";
import {
  annotationPreviewUrl,
  type PatientMediaItem,
} from "../../utils/patientMediaLibrary";
import "./PatientMediaViewerModal.css";

export type PatientMediaViewerSection = {
  id: string;
  label: string;
  items: PatientMediaItem[];
};

export type PatientMediaViewerModalProps = {
  sections: PatientMediaViewerSection[];
  initialItemId: string;
  onClose: () => void;
  onLoadAnnotation?: (record: SavedPatientAnnotation) => void;
};

function previewUrlForItem(item: PatientMediaItem): string | undefined {
  if (item.kind === "annotation" && item.annotation) {
    return annotationPreviewUrl(item.annotation) || undefined;
  }
  return item.url;
}

export default function PatientMediaViewerModal({
  sections,
  initialItemId,
  onClose,
  onLoadAnnotation: _onLoadAnnotation,
}: PatientMediaViewerModalProps) {
  const flatIndex = useMemo(() => {
    for (let s = 0; s < sections.length; s++) {
      const section = sections[s]!;
      const idx = section.items.findIndex((item) => item.id === initialItemId);
      if (idx >= 0) return { sectionIndex: s, itemIndex: idx };
    }
    return { sectionIndex: 0, itemIndex: 0 };
  }, [sections, initialItemId]);

  const [sectionIndex, setSectionIndex] = useState(flatIndex.sectionIndex);
  const [itemIndex, setItemIndex] = useState(flatIndex.itemIndex);

  const activeSection = sections[sectionIndex] ?? sections[0];
  const items = activeSection?.items ?? [];
  const item = items[itemIndex] ?? items[0];
  const previewUrl = item ? previewUrlForItem(item) : undefined;

  const goPrev = useCallback(() => {
    if (items.length <= 1) return;
    setItemIndex((i) => (i - 1 + items.length) % items.length);
  }, [items.length]);

  const goNext = useCallback(() => {
    if (items.length <= 1) return;
    setItemIndex((i) => (i + 1) % items.length);
  }, [items.length]);

  const selectSection = useCallback((nextIndex: number) => {
    setSectionIndex(nextIndex);
    setItemIndex(0);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [goNext, goPrev, onClose]);

  useEffect(() => {
    if (itemIndex >= items.length) setItemIndex(0);
  }, [itemIndex, items.length]);

  if (!item || sections.length === 0) return null;

  return (
    <div
      className="patient-media-viewer-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`View ${item.title}`}
      onClick={onClose}
    >
      <div
        className="patient-media-viewer"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="patient-media-viewer__header">
          <div className="patient-media-viewer__title-block">
            <h2 className="patient-media-viewer__title">{item.title}</h2>
            {item.subtitle ? (
              <p className="patient-media-viewer__subtitle">{item.subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="patient-media-viewer__close"
            onClick={onClose}
            aria-label="Close viewer"
          >
            ×
          </button>
        </header>

        {sections.length > 1 ? (
          <nav
            className="patient-media-viewer__sections"
            role="tablist"
            aria-label="Photo categories"
          >
            {sections.map((section, idx) => (
              <button
                key={section.id}
                type="button"
                role="tab"
                aria-selected={idx === sectionIndex}
                className={`patient-media-viewer__section-tab${
                  idx === sectionIndex ? " patient-media-viewer__section-tab--active" : ""
                }`}
                onClick={() => selectSection(idx)}
              >
                {section.label}
                <span className="patient-media-viewer__section-count">
                  {section.items.length}
                </span>
              </button>
            ))}
          </nav>
        ) : null}

        <div className="patient-media-viewer__stage-wrap">
          {items.length > 1 ? (
            <button
              type="button"
              className="patient-media-viewer__nav patient-media-viewer__nav--prev"
              onClick={goPrev}
              aria-label="Previous photo"
            >
              ‹
            </button>
          ) : null}

          <div className="patient-media-viewer__stage">
            {item.kind === "video" && item.url ? (
              <video
                key={item.id}
                className="patient-media-viewer__media patient-media-viewer__media--video"
                src={item.url}
                controls
                autoPlay
                playsInline
              />
            ) : previewUrl ? (
              <img
                key={item.id}
                className="patient-media-viewer__media"
                src={previewUrl}
                alt={item.title}
                draggable={false}
              />
            ) : (
              <p className="patient-media-viewer__empty">No preview available.</p>
            )}
          </div>

          {items.length > 1 ? (
            <button
              type="button"
              className="patient-media-viewer__nav patient-media-viewer__nav--next"
              onClick={goNext}
              aria-label="Next photo"
            >
              ›
            </button>
          ) : null}
        </div>

        {items.length > 1 ? (
          <p className="patient-media-viewer__counter" aria-live="polite">
            {itemIndex + 1} of {items.length}
          </p>
        ) : null}

        {items.length > 1 ? (
          <ul className="patient-media-viewer__thumbs" aria-label="Photos in this section">
            {items.map((thumb, idx) => {
              const thumbUrl = previewUrlForItem(thumb);
              return (
                <li key={thumb.id}>
                  <button
                    type="button"
                    className={`patient-media-viewer__thumb${
                      idx === itemIndex ? " patient-media-viewer__thumb--active" : ""
                    }`}
                    onClick={() => setItemIndex(idx)}
                    aria-label={`View ${thumb.title}`}
                    aria-current={idx === itemIndex ? "true" : undefined}
                  >
                    {thumb.kind === "video" && thumb.url ? (
                      <video src={thumb.url} muted playsInline preload="metadata" />
                    ) : thumbUrl ? (
                      <img src={thumbUrl} alt="" draggable={false} />
                    ) : (
                      <span className="patient-media-viewer__thumb-placeholder" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        {null}
      </div>
    </div>
  );
}
