import { useMemo, useState } from "react";
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
  flattenPatientMediaLibrary,
  systemCategoryLabel,
  type PatientMediaItem,
} from "../../utils/patientMediaLibrary";
import {
  isTanyaTanDemoClient,
  TANYA_TAN_SYSTEM_MEDIA_ORDER,
  type TanyaTanSystemMediaCategory,
} from "../../utils/tanyaTanSystemMedia";
import "./PatientMediaLibraryPanel.css";

export type PatientMediaLibraryPanelProps = {
  client: Client;
  photoSlots?: ClientPhotoSlot[];
  turntableVideoUrl?: string | null;
  onLoadAnnotation?: (record: SavedPatientAnnotation) => void;
  onOpenPhoto?: (url: string) => void;
  refreshKey?: number;
};

type SourceFilter = "all" | "system" | "user";

function kindBadge(item: PatientMediaItem): string {
  if (item.source === "user") return "Your markup";
  return systemCategoryLabel(item.systemCategory);
}

export default function PatientMediaLibraryPanel({
  client,
  photoSlots,
  turntableVideoUrl,
  onLoadAnnotation,
  onOpenPhoto,
  refreshKey = 0,
}: PatientMediaLibraryPanelProps) {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [collapsed, setCollapsed] = useState(false);
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

  const allItems = useMemo(() => flattenPatientMediaLibrary(sections), [sections]);

  const filteredSections = useMemo(() => {
    if (sourceFilter === "system") {
      return { system: sections.system, user: [] as PatientMediaItem[] };
    }
    if (sourceFilter === "user") {
      return { system: [] as PatientMediaItem[], user: sections.user };
    }
    return sections;
  }, [sections, sourceFilter]);

  const systemByCategory = useMemo(() => {
    const map = new Map<TanyaTanSystemMediaCategory, PatientMediaItem[]>();
    for (const cat of TANYA_TAN_SYSTEM_MEDIA_ORDER) {
      map.set(cat, []);
    }
    for (const item of filteredSections.system) {
      const cat = item.systemCategory ?? "color_stills";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    return map;
  }, [filteredSections.system]);

  const handleDelete = (id: string) => {
    deletePatientAnnotation(id);
    window.dispatchEvent(
      new CustomEvent("patient-annotations-changed", { detail: { clientId: client.id } }),
    );
  };

  const counts = {
    system: sections.system.length,
    user: sections.user.length,
    all: allItems.length,
  };

  const visibleCount =
    filteredSections.system.length + filteredSections.user.length;

  return (
    <div className={`patient-media-library${collapsed ? " patient-media-library--collapsed" : ""}`}>
      <div className="patient-media-library__intro">
        <div className="patient-media-library__intro-row">
          <h3 className="patient-media-library__title">Patient files</h3>
          <button
            type="button"
            className="patient-media-library__collapse-btn"
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand files section" : "Collapse files section"}
            title={collapsed ? "Expand files section" : "Collapse files section"}
            onClick={() => setCollapsed((v) => !v)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              {collapsed ? <path d="M6 9l6 6 6-6" /> : <path d="M18 15l-6-6-6 6" />}
            </svg>
          </button>
        </div>
        {!collapsed ? (
          <p className="patient-media-library__desc">
            {showTanyaLayout
              ? "Original session photos, processed stills, clinical texture maps, and annotations you draw on the face."
              : "Original photos, 3D turntable video, and saved face annotations."}
          </p>
        ) : null}
      </div>

      {!collapsed ? (
        <div className="patient-media-library__filters" role="tablist" aria-label="File source">
          {(
            [
              ["all", `All (${counts.all})`],
              ["system", `System (${counts.system})`],
              ["user", `Yours (${counts.user})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={sourceFilter === key}
              className={`patient-media-library__filter${sourceFilter === key ? " patient-media-library__filter--active" : ""}`}
              onClick={() => setSourceFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {!collapsed ? (
        <div className="patient-media-library__scroll">
        {visibleCount === 0 ? (
          <p className="patient-media-library__empty">
            {sourceFilter === "user"
              ? "No saved annotations yet. Draw on the face and tap Save in the annotation toolbar."
              : "No files in this category yet."}
          </p>
        ) : (
          <>
            {filteredSections.system.length > 0 ? (
              <section className="patient-media-library__section">
                <h4 className="patient-media-library__section-title">System files</h4>
                <p className="patient-media-library__section-desc">
                  Scan session assets from the Aura pipeline — not edited by staff.
                </p>
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
                                onOpenPhoto={onOpenPhoto}
                              />
                            ))}
                          </ul>
                        </div>
                      );
                    })
                  : (
                    <ul className="patient-media-library__grid">
                      {filteredSections.system.map((item) => (
                        <MediaCard
                          key={item.id}
                          item={item}
                          badge={kindBadge(item)}
                          onOpenPhoto={onOpenPhoto}
                        />
                      ))}
                    </ul>
                  )}
              </section>
            ) : null}

            {filteredSections.user.length > 0 ? (
              <section className="patient-media-library__section">
                <h4 className="patient-media-library__section-title">Your annotations</h4>
                <p className="patient-media-library__section-desc">
                  Markup saved from the face mirror — load back onto the 3D view or download.
                </p>
                <ul className="patient-media-library__grid">
                  {filteredSections.user.map((item) => (
                    <MediaCard
                      key={item.id}
                      item={item}
                      badge={kindBadge(item)}
                      onOpenPhoto={onOpenPhoto}
                      onLoadAnnotation={onLoadAnnotation}
                      onDeleteAnnotation={handleDelete}
                    />
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
        </div>
      ) : null}
    </div>
  );
}

function MediaCard({
  item,
  badge,
  onOpenPhoto,
  onLoadAnnotation,
  onDeleteAnnotation,
}: {
  item: PatientMediaItem;
  badge: string;
  onOpenPhoto?: (url: string) => void;
  onLoadAnnotation?: (record: SavedPatientAnnotation) => void;
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

  return (
    <li
      className={`patient-media-card patient-media-card--${item.kind} patient-media-card--${item.source}`}
    >
      <div className="patient-media-card__thumb-wrap">
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
              {onLoadAnnotation ? (
                <button
                  type="button"
                  className="patient-media-card__btn patient-media-card__btn--primary"
                  onClick={() => onLoadAnnotation(item.annotation!)}
                >
                  Load
                </button>
              ) : null}
              <button
                type="button"
                className="patient-media-card__btn"
                onClick={handleDownloadAnnotation}
              >
                Download
              </button>
            </>
          ) : null}
          {item.url && item.kind !== "annotation" ? (
            <button
              type="button"
              className="patient-media-card__btn"
              onClick={() => onOpenPhoto?.(item.url!)}
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
