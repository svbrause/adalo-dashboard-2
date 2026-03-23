import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  orderBlueprintVideosForPlan,
  POST_VISIT_BLUEPRINT_VIDEOS,
} from "../../config/postVisitBlueprintVideos";
import type { TreatmentChapter } from "../../utils/blueprintTreatmentChapters";
import type {
  BlueprintCasePhoto,
  TreatmentResultsCard,
  CaseDetailPayload,
} from "../../utils/postVisitBlueprintCases";
import {
  scrubAirtableRecordIds,
  looksLikeAirtableRecordId,
  isRedundantTreatmentSubtitle,
  buildPhotoTagSummary,
} from "../../utils/postVisitBlueprintCases";
import "./TreatmentChapter.css";

interface TreatmentChapterViewProps {
  chapter: TreatmentChapter;
  index: number;
  total: number;
  /** DOM id for TOC / deep links (must match PostVisitBlueprintPage TOC href) */
  anchorId: string;
  onVideoPlay: (videoId: string, title: string) => void;
  onCaseDetail: (detail: CaseDetailPayload) => void;
  trackCaseGallery: () => void;
}

function buildDemographics(photo: BlueprintCasePhoto): string | null {
  return (
    [
      photo.age && !looksLikeAirtableRecordId(photo.age) ? `Age: ${photo.age}` : null,
      photo.skinType && !looksLikeAirtableRecordId(photo.skinType) ? `Skin: ${photo.skinType}` : null,
      photo.skinTone && !looksLikeAirtableRecordId(photo.skinTone) ? `Tone: ${photo.skinTone}` : null,
    ].filter(Boolean).join(" · ") || null
  );
}

function processPhoto(photo: BlueprintCasePhoto, card: TreatmentResultsCard) {
  const storyScrubbed = photo.storyTitle ? scrubAirtableRecordIds(photo.storyTitle) : "";
  const storyDisplay = storyScrubbed && !isRedundantTreatmentSubtitle(storyScrubbed, card) ? storyScrubbed : null;
  const captionScrubbed = photo.caption ? scrubAirtableRecordIds(photo.caption) : "";
  const captionDisplay = captionScrubbed && !isRedundantTreatmentSubtitle(captionScrubbed, card) ? captionScrubbed : null;
  return {
    storyDisplay,
    captionDisplay,
    tagSummary: buildPhotoTagSummary(photo, card).trim(),
    ageDisplay: photo.age && !looksLikeAirtableRecordId(photo.age) ? photo.age : null,
    skinTypeDisplay: photo.skinType && !looksLikeAirtableRecordId(photo.skinType) ? photo.skinType : null,
    skinToneDisplay: photo.skinTone && !looksLikeAirtableRecordId(photo.skinTone) ? photo.skinTone : null,
  };
}

export function TreatmentChapterView({
  chapter,
  index,
  total,
  anchorId,
  onVideoPlay,
  onCaseDetail,
  trackCaseGallery,
}: TreatmentChapterViewProps) {
  const card = chapter.caseCard;
  const photos = card?.photos ?? [];
  const len = photos.length;

  /** Full catalog (3) ordered by relevance to this chapter — shown as compact thumbnails */
  const catalogVideos = useMemo(
    () => orderBlueprintVideosForPlan(chapter.planItems, POST_VISIT_BLUEPRINT_VIDEOS),
    [chapter.planItems],
  );
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null);
  const expandedVideo = expandedVideoId
    ? catalogVideos.find((v) => v.id === expandedVideoId) ?? null
    : null;

  useEffect(() => {
    if (!expandedVideoId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpandedVideoId(null);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [expandedVideoId]);

  const openCaseDetail = useCallback(
    (photo: BlueprintCasePhoto, treatmentCard: TreatmentResultsCard) => {
      const p = processPhoto(photo, treatmentCard);
      onCaseDetail({
        cardTitle: treatmentCard.displayName,
        treatment: treatmentCard.treatment,
        photoUrl: photo.photoUrl,
        story: p.storyDisplay,
        caption: p.captionDisplay,
        tags: p.tagSummary || null,
        demographics: buildDemographics(photo),
        longevity: treatmentCard.longevity,
        downtime: treatmentCard.downtime,
        priceRange: treatmentCard.priceRange,
        highlights: treatmentCard.planHighlights,
      });
    },
    [onCaseDetail],
  );

  return (
    <article id={anchorId} className="tc" aria-label={chapter.displayName}>
      {/* Chapter number badge */}
      <div className="tc-badge">
        <span className="tc-badge-num">{index + 1}</span>
        <span className="tc-badge-of">of {total}</span>
      </div>

      {/* Header */}
      <div className="tc-head">
        <h2 className="tc-name">{chapter.displayName}</h2>
        {chapter.displayArea && <span className="tc-area">{chapter.displayArea}</span>}
      </div>

      {/* Why Recommended */}
      {chapter.whyRecommended.length > 0 && (
        <div className="tc-why">
          <h3 className="tc-label">Why this was recommended</h3>
          <ul className="tc-why-list">
            {chapter.whyRecommended.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Quick Facts */}
      {(chapter.meta.longevity || chapter.meta.downtime || chapter.meta.priceRange) && (
        <div className="tc-facts">
          {chapter.meta.longevity && (
            <div className="tc-fact">
              <span className="tc-fact-label">Lasts</span>
              <span className="tc-fact-val">{chapter.meta.longevity}</span>
            </div>
          )}
          {chapter.meta.downtime && (
            <div className="tc-fact">
              <span className="tc-fact-label">Downtime</span>
              <span className="tc-fact-val">{chapter.meta.downtime}</span>
            </div>
          )}
          {chapter.meta.priceRange && (
            <div className="tc-fact">
              <span className="tc-fact-label">Range</span>
              <span className="tc-fact-val">{chapter.meta.priceRange}</span>
            </div>
          )}
        </div>
      )}

      {/* Videos — all clinic clips as compact thumbnails; tap to expand & play */}
      {catalogVideos.length > 0 && (
        <div className="tc-video-section">
          <h3 className="tc-section-label">From your care team</h3>
          <p className="tc-video-hint">Tap a clip to open and play</p>
          <div className="tc-video-thumbs" role="list">
            {catalogVideos.map((mod) => (
              <button
                key={mod.id}
                type="button"
                role="listitem"
                className={`tc-video-thumb${expandedVideoId === mod.id ? " tc-video-thumb--active" : ""}`}
                onClick={() => setExpandedVideoId(mod.id)}
                aria-haspopup="dialog"
                aria-expanded={expandedVideoId === mod.id}
                aria-label={`Open video: ${mod.title}`}
              >
                <span className="tc-video-thumb-frame">
                  {mod.posterUrl ? (
                    <img
                      className="tc-video-thumb-img"
                      src={mod.posterUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <video
                      className="tc-video-thumb-video"
                      muted
                      playsInline
                      preload="auto"
                      tabIndex={-1}
                      aria-hidden
                      onLoadedMetadata={(e) => {
                        const v = e.currentTarget;
                        try {
                          v.currentTime = 0.1;
                        } catch {
                          /* seek can fail before enough data */
                        }
                      }}
                    >
                      {mod.sources.map((source) => (
                        <source key={source.src} src={source.src} type={source.mimeType} />
                      ))}
                    </video>
                  )}
                  <span className="tc-video-thumb-play" aria-hidden>
                    <span className="tc-video-thumb-play-icon">▶</span>
                  </span>
                </span>
                <span className="tc-video-thumb-title">{mod.title}</span>
              </button>
            ))}
          </div>

        </div>
      )}

      {expandedVideo &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="tc-video-modal-overlay"
            onClick={() => setExpandedVideoId(null)}
            role="presentation"
          >
            <div
              className="tc-video-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby={`tc-video-modal-title-${chapter.key}-${expandedVideo.id}`}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="tc-video-modal-close"
                onClick={() => setExpandedVideoId(null)}
                aria-label="Close video"
              >
                ×
              </button>
              <h4
                className="tc-video-modal-title"
                id={`tc-video-modal-title-${chapter.key}-${expandedVideo.id}`}
              >
                {expandedVideo.title}
              </h4>
              <p className="tc-video-modal-sub">{expandedVideo.subtitle}</p>
              <div className="tc-video-modal-frame">
                <video
                  key={expandedVideo.id}
                  className="tc-video-modal-player"
                  controls
                  playsInline
                  preload="metadata"
                  poster={expandedVideo.posterUrl}
                  autoPlay
                  onPlay={() => onVideoPlay(expandedVideo.id, expandedVideo.title)}
                >
                  {expandedVideo.sources.map((source) => (
                    <source key={source.src} src={source.src} type={source.mimeType} />
                  ))}
                </video>
              </div>
              <button
                type="button"
                className="tc-video-modal-done"
                onClick={() => setExpandedVideoId(null)}
              >
                Done
              </button>
            </div>
          </div>,
          document.body,
        )}

      {/* Photo Carousel */}
      {card && (
        <div className="tc-cases-section">
          <div className="tc-cases-head">
            <h3 className="tc-section-label">Results like yours</h3>
            {len > 1 && <span className="tc-swipe-hint">Swipe &rarr;</span>}
          </div>
          {len === 0 ? (
            <p className="tc-muted">
              We&apos;re curating more examples for this treatment. Your provider
              can show you additional cases in-office.
            </p>
          ) : (
            <div className="tc-carousel" onScroll={() => trackCaseGallery()}>
              {photos.map((photo) => {
                const pd = processPhoto(photo, card);
                const hasCaption = Boolean(pd.storyDisplay || pd.tagSummary || pd.ageDisplay || pd.skinTypeDisplay || pd.skinToneDisplay);
                return (
                  <div key={photo.id} className="tc-carousel-card">
                    <div className="tc-carousel-img-wrap">
                      <img src={photo.photoUrl} alt={pd.storyDisplay || pd.captionDisplay || `${chapter.displayName} result`} className="tc-carousel-img" loading="lazy" />
                    </div>
                    {hasCaption && (
                      <div className="tc-carousel-caption">
                        {pd.storyDisplay && <p className="tc-carousel-story">{pd.storyDisplay}</p>}
                        {pd.tagSummary && <p className="tc-carousel-tags">{pd.tagSummary}</p>}
                        {(pd.ageDisplay || pd.skinTypeDisplay || pd.skinToneDisplay) && (
                          <p className="tc-carousel-demo">
                            {[pd.ageDisplay && `Age: ${pd.ageDisplay}`, pd.skinTypeDisplay && `Skin: ${pd.skinTypeDisplay}`, pd.skinToneDisplay && `Tone: ${pd.skinToneDisplay}`].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                    )}
                    <button type="button" className="tc-carousel-detail-btn" onClick={() => openCaseDetail(photo, card)}>
                      View details
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Highlights */}
      {card && card.planHighlights.length > 0 && (
        <div className="tc-highlights">
          <div className="pvb-chips">
            {card.planHighlights.map((h) => (
              <span key={h} className="pvb-chip">{h}</span>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
