import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Client, ClientPhotoSlot } from "../../types";
import {
  deletePatientAnnotation,
  listPatientAnnotations,
  type SavedPatientAnnotation,
} from "../../utils/patientAnnotationsStorage";
import {
  downloadDataUrl,
  sanitizeDownloadFilename,
} from "../../utils/annotationComposite";
import {
  annotationPreviewUrl,
  buildPatientMediaLibrary,
  systemCategoryLabel,
  type PatientMediaItem,
} from "../../utils/patientMediaLibrary";
import {
  isTanyaTanDemoClient,
  TANYA_TAN_SYSTEM_MEDIA_ORDER,
  type TanyaTanSystemMediaCategory,
} from "../../utils/tanyaTanSystemMedia";
import PatientMediaViewerModal, {
  type PatientMediaViewerSection,
} from "./PatientMediaViewerModal";
import "./PatientMediaLibraryPanel.css";

export type PatientMediaLibraryPanelProps = {
  client: Client;
  photoSlots?: ClientPhotoSlot[];
  turntableVideoUrl?: string | null;
  /** @deprecated Load button removed — keep prop to avoid breaking callers. */
  onLoadAnnotation?: (record: SavedPatientAnnotation) => void;
  refreshKey?: number;
};

function kindBadge(item: PatientMediaItem): string {
  if (item.source === "user") return "Your markup";
  return systemCategoryLabel(item.systemCategory);
}

export default function PatientMediaLibraryPanel({
  client,
  photoSlots,
  turntableVideoUrl,
  onLoadAnnotation: _onLoadAnnotation,
  refreshKey = 0,
}: PatientMediaLibraryPanelProps) {
  const [viewerItemId, setViewerItemId] = useState<string | null>(null);
  const showTanyaLayout = isTanyaTanDemoClient(client);

  const savedAnnotations = useMemo(
    () => listPatientAnnotations(client.id),
    [client.id, refreshKey],
  );

  const sections = useMemo(
    () =>
      buildPatientMediaLibrary({
        client,
        photoSlots,
        turntableVideoUrl,
        savedAnnotations,
      }),
    [client, photoSlots, turntableVideoUrl, savedAnnotations],
  );

  const systemByCategory = useMemo(() => {
    const map = new Map<TanyaTanSystemMediaCategory, PatientMediaItem[]>();
    for (const cat of TANYA_TAN_SYSTEM_MEDIA_ORDER) {
      map.set(cat, []);
    }
    for (const item of sections.system) {
      const cat = item.systemCategory ?? "color_stills";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    return map;
  }, [sections.system]);

  const handleDelete = (id: string) => {
    deletePatientAnnotation(id);
    window.dispatchEvent(
      new CustomEvent("patient-annotations-changed", { detail: { clientId: client.id } }),
    );
  };

  const visibleCount = sections.system.length + sections.user.length;

  const viewerSections = useMemo((): PatientMediaViewerSection[] => {
    const out: PatientMediaViewerSection[] = [];
    if (sections.system.length > 0) {
      if (showTanyaLayout) {
        for (const cat of TANYA_TAN_SYSTEM_MEDIA_ORDER) {
          const items = systemByCategory.get(cat) ?? [];
          if (items.length === 0) continue;
          out.push({
            id: cat,
            label: systemCategoryLabel(cat),
            items,
          });
        }
      } else {
        out.push({
          id: "system",
          label: "System files",
          items: sections.system,
        });
      }
    }
    if (sections.user.length > 0) {
      out.push({
        id: "user",
        label: "Your annotations",
        items: sections.user,
      });
    }
    return out;
  }, [sections, showTanyaLayout, systemByCategory]);

  const openViewer = (item: PatientMediaItem) => {
    if (item.kind === "annotation" && !item.annotation && !item.url) return;
    setViewerItemId(item.id);
  };

  return (
    <div className="patient-media-library">
      <div className="patient-media-library__intro">
        <div className="patient-media-library__intro-row">
          <h3 className="patient-media-library__title">Patient Files</h3>
        </div>
        <p className="patient-media-library__desc">
          {showTanyaLayout
            ? "Original session photos, background-removed stills, clinical texture maps, and annotations you draw on the face."
            : "Original photos, 3D turntable video, and saved face annotations."}
        </p>
      </div>

      <div className="patient-media-library__scroll">
        {visibleCount === 0 ? (
          <p className="patient-media-library__empty">
            No patient files yet.
          </p>
        ) : (
          <>
            {sections.system.length > 0 ? (
              <section className="patient-media-library__section">
                {!showTanyaLayout ? (
                  <h4 className="patient-media-library__section-title">System files</h4>
                ) : null}
                {showTanyaLayout
                  ? TANYA_TAN_SYSTEM_MEDIA_ORDER.map((cat) => {
                      const items = systemByCategory.get(cat) ?? [];
                      if (items.length === 0) return null;
                      return (
                        <div key={cat} className="patient-media-library__group">
                          <h5 className="patient-media-library__group-title">
                            {systemCategoryLabel(cat)}
                          </h5>
                          <ul className="patient-media-library__grid">
                            {items.map((item) => (
                              <MediaCard
                                key={item.id}
                                item={item}
                                badge={kindBadge(item)}
                                onView={openViewer}
                              />
                            ))}
                          </ul>
                        </div>
                      );
                    })
                  : (
                    <ul className="patient-media-library__grid">
                      {sections.system.map((item) => (
                        <MediaCard
                          key={item.id}
                          item={item}
                          badge={kindBadge(item)}
                          onView={openViewer}
                        />
                      ))}
                    </ul>
                  )}
              </section>
            ) : null}

            {sections.user.length > 0 ? (
              <section className="patient-media-library__section">
                <h4 className="patient-media-library__section-title">Your annotations</h4>
                <p className="patient-media-library__section-desc">
                  Markup saved from the face mirror — load back onto the 3D view or download.
                </p>
                <ul className="patient-media-library__grid">
                  {sections.user.map((item) => (
                    <MediaCard
                      key={item.id}
                      item={item}
                      badge={kindBadge(item)}
                      onView={openViewer}
                      onDeleteAnnotation={handleDelete}
                    />
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </div>

      {viewerItemId && viewerSections.length > 0
        ? createPortal(
            <PatientMediaViewerModal
              sections={viewerSections}
              initialItemId={viewerItemId}
              onClose={() => setViewerItemId(null)}
            />,
            document.body,
          )
        : null}
    </div>
  );
}

function MediaCard({
  item,
  badge,
  onView,
  onDeleteAnnotation,
}: {
  item: PatientMediaItem;
  badge: string;
  onView?: (item: PatientMediaItem) => void;
  onDeleteAnnotation?: (id: string) => void;
}) {
  const preview =
    item.kind === "annotation" && item.annotation
      ? annotationPreviewUrl(item.annotation)
      : item.url;

  const handleDownloadAnnotation = () => {
    const ann = item.annotation;
    if (!ann) return;
    const url = ann.compositeDataUrl ?? annotationPreviewUrl(ann);
    if (!url) return;
    downloadDataUrl(url, `${sanitizeDownloadFilename(ann.label)}.jpg`);
  };

  const canView =
    item.kind === "annotation"
      ? Boolean(preview)
      : Boolean(item.url);

  const handleView = () => {
    if (canView) onView?.(item);
  };

  return (
    <li
      className={`patient-media-card patient-media-card--${item.kind} patient-media-card--${item.source}${canView ? " patient-media-card--viewable" : ""}`}
    >
      <div
        className="patient-media-card__thumb-wrap"
        role={canView ? "button" : undefined}
        tabIndex={canView ? 0 : undefined}
        onClick={canView ? handleView : undefined}
        onKeyDown={
          canView
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleView();
                }
              }
            : undefined
        }
        aria-label={canView ? `View ${item.title}` : undefined}
      >
        {item.kind === "video" && item.url ? (
          <video
            className="patient-media-card__thumb patient-media-card__thumb--video"
            src={item.url}
            muted
            playsInline
            preload="metadata"
          />
        ) : preview ? (
          <img
            className="patient-media-card__thumb"
            src={preview}
            alt=""
            loading="lazy"
            draggable={false}
          />
        ) : (
          <div className="patient-media-card__thumb patient-media-card__thumb--placeholder" />
        )}
        <span
          className={`patient-media-card__kind patient-media-card__kind--${item.source}`}
        >
          {badge}
        </span>
      </div>
      <div className="patient-media-card__body">
        <span className="patient-media-card__title">{item.title}</span>
        {item.subtitle ? (
          <span className="patient-media-card__subtitle">{item.subtitle}</span>
        ) : null}
        <div className="patient-media-card__actions">
          {item.kind === "annotation" && item.annotation ? (
            <>
              <button
                type="button"
                className="patient-media-card__btn"
                onClick={handleDownloadAnnotation}
              >
                Download
              </button>
            </>
          ) : null}
          {canView ? (
            <button
              type="button"
              className="patient-media-card__btn"
              onClick={handleView}
            >
              {item.kind === "video" ? "Play" : "View"}
            </button>
          ) : null}
          {item.kind === "annotation" && onDeleteAnnotation ? (
            <button
              type="button"
              className="patient-media-card__btn patient-media-card__btn--danger"
              onClick={() => onDeleteAnnotation(item.id)}
            >
              Delete
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
