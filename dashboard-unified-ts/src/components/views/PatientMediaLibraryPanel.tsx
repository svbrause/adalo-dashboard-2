import { useMemo, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import type { Client, ClientPhotoSlot } from "../../types";
import type { PatientAuraAssetManifest } from "../../utils/patientAuraAssets";
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
  buildPatientProgressScans,
  defaultCompareScanPair,
  scanMetricByKey,
  type PatientProgressScan,
  type ProgressMetricKey,
} from "../../utils/patientProgressScans";
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
  auraManifest?: PatientAuraAssetManifest | null;
  compact?: boolean;
  /** @deprecated Load button removed — keep prop to avoid breaking callers. */
  onLoadAnnotation?: (record: SavedPatientAnnotation) => void;
  onCompareScans?: (scans: PatientProgressScan[]) => void;
  refreshKey?: number;
  /** When set with `onActiveScanIdChange`, scan selection is controlled by the parent (e.g. sync Aura viewer). */
  activeScanId?: string | null;
  onActiveScanIdChange?: (scanId: string) => void;
};

function kindBadge(item: PatientMediaItem): string {
  if (item.source === "user") return "Your note";
  return systemCategoryLabel(item.systemCategory);
}

export default function PatientMediaLibraryPanel({
  client,
  photoSlots,
  turntableVideoUrl,
  auraManifest,
  compact = false,
  onLoadAnnotation: _onLoadAnnotation,
  onCompareScans,
  refreshKey = 0,
  activeScanId: activeScanIdProp,
  onActiveScanIdChange,
}: PatientMediaLibraryPanelProps) {
  const [viewerItemId, setViewerItemId] = useState<string | null>(null);
  const [internalActiveScanId, setInternalActiveScanId] = useState<string | null>(
    null,
  );
  const scanSelectionControlled = onActiveScanIdChange !== undefined;
  const activeScanId = scanSelectionControlled
    ? (activeScanIdProp ?? null)
    : internalActiveScanId;
  const setActiveScanId = scanSelectionControlled
    ? onActiveScanIdChange
    : setInternalActiveScanId;
  const showTanyaLayout = isTanyaTanDemoClient(client);

  const savedAnnotations = useMemo(
    () => listPatientAnnotations(client.id),
    [client.id, refreshKey],
  );

  const scans = useMemo(
    () =>
      buildPatientProgressScans({
        client,
        photoSlots,
        turntableVideoUrl,
        auraManifest,
      }),
    [client, photoSlots, turntableVideoUrl, auraManifest],
  );

  const activeScan = useMemo(
    () => scans.find((scan) => scan.id === activeScanId) ?? scans[scans.length - 1],
    [scans, activeScanId],
  );

  const sections = useMemo(
    () =>
      buildPatientMediaLibrary({
        client,
        photoSlots: activeScan?.photoSlots ?? photoSlots,
        turntableVideoUrl: activeScan?.turntableVideoUrl ?? turntableVideoUrl,
        auraManifest: activeScan?.auraManifest ?? auraManifest,
        savedAnnotations,
      }),
    [client, activeScan, photoSlots, turntableVideoUrl, auraManifest, savedAnnotations],
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

  const defaultComparePair = useMemo(
    () => defaultCompareScanPair(scans),
    [scans],
  );

  const handleOpenCompare = (event: MouseEvent<HTMLButtonElement>) => {
    if (!defaultComparePair) return;
    event.currentTarget.blur();
    onCompareScans?.(defaultComparePair);
  };

  const viewerSections = useMemo((): PatientMediaViewerSection[] => {
    const out: PatientMediaViewerSection[] = [];
    if (sections.user.length > 0) {
      out.push({
        id: "user",
        label: "Your notes",
        items: sections.user,
      });
    }
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
          label: "From the scan",
          items: sections.system,
        });
      }
    }
    return out;
  }, [sections, showTanyaLayout, systemByCategory]);

  const openViewer = (item: PatientMediaItem) => {
    if (item.kind === "annotation" && !item.annotation && !item.url) return;
    setViewerItemId(item.id);
  };

  const allItems = [...sections.user, ...sections.system];
  const firstViewableItem = allItems.find(
    (item) => item.kind !== "annotation" || item.annotation || item.url,
  );
  const photoCount = allItems.filter((item) => item.kind === "photo").length;
  const videoCount = allItems.filter((item) => item.kind === "video").length;
  const annotationCount = sections.user.length;
  const previewItems = allItems
    .filter((item) => item.kind !== "annotation" || item.annotation || item.url)
    .slice(0, 4);
  const compareDisabled = !defaultComparePair;

  if (compact) {
    return (
      <div className="patient-media-library patient-media-library--compact">
        <div className="patient-media-library__intro">
          <div className="patient-media-library__intro-row">
            <h3 className="patient-media-library__title">Scans</h3>
            {firstViewableItem ? (
              <button
                type="button"
                className="btn-secondary btn-sm btn-sm-custom patient-media-library__view-all"
                onClick={() => openViewer(firstViewableItem)}
              >
                View Scan
              </button>
            ) : null}
          </div>
          {visibleCount === 0 ? (
            <p className="patient-media-library__desc">
              No scan media yet.
            </p>
          ) : null}
        </div>

        {visibleCount > 0 ? (
          <div className="patient-media-library__compact-body">
            <div className="patient-media-library__stats" aria-label="Media summary">
              {photoCount > 0 ? (
                <span className="patient-media-library__stat">
                  <strong>{photoCount}</strong>
                  <span>Photos</span>
                </span>
              ) : null}
              {videoCount > 0 ? (
                <span className="patient-media-library__stat">
                  <strong>{videoCount}</strong>
                  <span>Videos</span>
                </span>
              ) : null}
              {annotationCount > 0 ? (
                <span className="patient-media-library__stat">
                  <strong>{annotationCount}</strong>
                  <span>Notes</span>
                </span>
              ) : null}
            </div>
            {previewItems.length > 0 ? (
              <div className="patient-media-library__preview-strip" aria-hidden="true">
                {previewItems.map((item) => {
                  const preview =
                    item.kind === "annotation" && item.annotation
                      ? annotationPreviewUrl(item.annotation)
                      : item.url;
                  return (
                    <div
                      key={item.id}
                      className="patient-media-library__preview-thumb"
                    >
                      {item.kind === "video" && item.url ? (
                        <video src={item.url} muted playsInline preload="metadata" />
                      ) : preview ? (
                        <img src={preview} alt="" draggable={false} loading="lazy" />
                      ) : (
                        <span />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

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

  return (
    <div className="patient-media-library">
      <div className="patient-media-library__intro">
        <div className="patient-media-library__intro-row">
          <h3 className="patient-media-library__title">Scans</h3>
          <button
            type="button"
            className="patient-media-library__compare-btn"
            onClick={handleOpenCompare}
            disabled={compareDisabled}
            title={
              scans.length < 2
                ? "Add at least two scans to compare progress"
                : defaultComparePair
                  ? `Compare ${defaultComparePair[0].dateLabel} with ${defaultComparePair[1].dateLabel}. Change scans in compare view.`
                  : "Compare latest scans"
            }
          >
            Compare
          </button>
        </div>
        <p className="patient-media-library__desc">
          {showTanyaLayout
            ? "Each dated scan contains the session photos, analysis overlays, and notes you've added on the face."
            : "Each dated scan contains its photos, rotating face view, generated overlays, and notes."}
        </p>
      </div>

      <div className="patient-media-library__scroll">
        {scans.length > 0 ? (
          <section className="patient-media-library__section patient-media-library__section--scans">
            <ul className="patient-media-library__scan-list">
              {scans.map((scan) => {
                const active = activeScan?.id === scan.id;
                const scanMediaCount =
                  buildPatientMediaLibrary({
                    client,
                    photoSlots: scan.photoSlots,
                    turntableVideoUrl: scan.turntableVideoUrl,
                    auraManifest: scan.auraManifest,
                    savedAnnotations: [],
                  }).system.length;
                return (
                  <li key={scan.id}>
                    <button
                      type="button"
                      className={`patient-media-library__scan-card${active ? " patient-media-library__scan-card--active" : ""}`}
                      onClick={() => setActiveScanId(scan.id)}
                    >
                      <span className="patient-media-library__scan-main">
                        <strong>{scan.label}</strong>
                        <span>
                          {scanMediaCount} file{scanMediaCount === 1 ? "" : "s"}
                        </span>
                      </span>
                      <span className="patient-media-library__scan-metrics">
                        {(["pigmentation", "redness"] as ProgressMetricKey[]).map((key) => {
                          const metric = scanMetricByKey(scan, key);
                          if (!metric) return null;
                          return (
                            <span key={key} className="patient-media-library__scan-metric">
                              {metric.label} {metric.value}
                            </span>
                          );
                        })}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {visibleCount === 0 ? (
          <p className="patient-media-library__empty">
            No scan media yet.
          </p>
        ) : (
          <>
            {sections.user.length > 0 ? (
              <section className="patient-media-library__section">
                <h4 className="patient-media-library__section-title">Your notes</h4>
                <p className="patient-media-library__section-desc">
                  Drawings and highlights you've saved while reviewing their face.
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

            {sections.system.length > 0 ? (
              <section className="patient-media-library__section">
                <h4 className="patient-media-library__section-title">From the scan</h4>
                {showTanyaLayout
                  ? TANYA_TAN_SYSTEM_MEDIA_ORDER.map((cat) => {
                      const items = systemByCategory.get(cat) ?? [];
                      if (items.length === 0) return null;
                      return (
                        <details key={cat} className="patient-media-library__group patient-media-library__group--collapsed" open>
                          <summary className="patient-media-library__group-summary">
                            <span className="patient-media-library__group-title">
                              {systemCategoryLabel(cat)}
                            </span>
                            <span className="patient-media-library__group-count">
                              {items.length}
                            </span>
                          </summary>
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
                        </details>
                      );
                    })
                  : (
                    <details className="patient-media-library__group patient-media-library__group--collapsed" open>
                      <summary className="patient-media-library__group-summary">
                        <span className="patient-media-library__group-title">
                          Photos and video
                        </span>
                        <span className="patient-media-library__group-count">
                          {sections.system.length}
                        </span>
                      </summary>
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
                    </details>
                  )}
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
