import { useCallback, useEffect, useMemo, useState } from "react";
import { useInViewOnce } from "../../hooks/useInViewOnce";
import { createPortal } from "react-dom";
import { type TreatmentChapter } from "../../utils/blueprintTreatmentChapters";
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
import {
  trackPostVisitBlueprintEvent,
  type BlueprintPatientAnalyticsBase,
} from "../../utils/postVisitBlueprint";
import {
  buildChapterOverviewContent,
  type ChapterComplementSandwichContext,
  type ChapterOverviewBuildOptions,
} from "../../utils/pvbOverviewNarratives";
import type { PvbResolvedPlanGlossaryTerm } from "../../utils/pvbPlanTermGlossary";
import { buildChapterOverviewSpeechText } from "../../utils/pvbOverviewSpeechText";
import { AiSparkleLogo, GeminiWordmark } from "../ai/AiGeminiBrand";
import { PvbChapterOverviewTypewriter } from "./PvbChapterOverviewTypewriter";
import { PvbNarrativeAudioControls } from "./PvbNarrativeAudioControls";
import { WellnestThumbnail } from "./WellnestThumbnail";
import { buildSkincareChapterProductSlots } from "../../utils/pvbSkincareDisplay";
import { fetchTreatmentChapterOverview } from "../../services/api";
import {
  getWellnestOfferingByTreatmentName,
  WELLNEST_REGULATORY_NOTICE,
} from "../../data/wellnestOfferings";
import {
  getWellnestExternalExamplesForOffering,
  WELLNEST_EXTERNAL_LINKS_DISCLAIMER,
  type WellnestExternalExampleKind,
} from "../../data/wellnestExternalExamples";
import "./TreatmentChapter.css";

/** When Vimeo CDN poster URLs 403, swap to this local asset (Wellnest Dr. Reddy clips). */
const WELLNEST_VIMEO_POSTER_FALLBACK =
  "/post-visit-blueprint/videos/wellnest/Dr-Reddy-qr-code.png";

interface TreatmentChapterViewProps {
  chapter: TreatmentChapter;
  index: number;
  total: number;
  /** DOM id for TOC / deep links (must match PostVisitBlueprintPage TOC href) */
  anchorId: string;
  /** When set, overview copy weaves in scan findings + per-treatment plan notes */
  chapterAnalysisContext?: ChapterOverviewBuildOptions | null;
  /** Glossary entries matched to this chapter’s treatment (see pvbPlanTermGlossary chapterKeys) */
  chapterGlossaryTerms?: PvbResolvedPlanGlossaryTerm[];
  onVideoPlay: (videoId: string, title: string) => void;
  onCaseDetail: (detail: CaseDetailPayload) => void;
  trackCaseGallery: () => void;
  /** When set, chapter-level engagement is reported to PostHog. */
  blueprintPatientAnalytics?: BlueprintPatientAnalyticsBase;
  /** Overview sandwich: top = for-you / how it applies to this patient; bottom = fit with the full plan. */
  chapterComplementContext?: ChapterComplementSandwichContext | null;
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
  const detailedScrubbed = photo.storyDetailed
    ? scrubAirtableRecordIds(photo.storyDetailed)
    : "";
  const detailedTrim = detailedScrubbed.trim();
  const detailedNorm = detailedTrim.toLowerCase();
  const captionNorm = captionScrubbed.trim().toLowerCase();
  const storyNorm = storyScrubbed.trim().toLowerCase();
  let storyDetailedDisplay: string | null = null;
  if (
    detailedTrim &&
    !isRedundantTreatmentSubtitle(detailedScrubbed, card) &&
    detailedNorm !== captionNorm &&
    detailedNorm !== storyNorm
  ) {
    storyDetailedDisplay = detailedTrim;
  }
  return {
    storyDisplay,
    captionDisplay,
    storyDetailedDisplay,
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
  chapterAnalysisContext,
  chapterGlossaryTerms,
  onVideoPlay,
  onCaseDetail,
  trackCaseGallery,
  blueprintPatientAnalytics,
  chapterComplementContext,
}: TreatmentChapterViewProps) {
  const card = chapter.caseCard;
  const photos = card?.photos ?? [];
  const len = photos.length;
  const isSkincareChapter = chapter.treatment.trim().toLowerCase() === "skincare";

  const wellnestOffering = getWellnestOfferingByTreatmentName(chapter.treatment);
  const externalExamples = wellnestOffering
    ? getWellnestExternalExamplesForOffering(wellnestOffering)
    : [];
  const externalKindLabel = (k: WellnestExternalExampleKind) => {
    switch (k) {
      case "news":
        return "News";
      case "youtube":
        return "YouTube";
      case "reddit":
        return "Reddit";
      case "podcast":
        return "Podcast";
      case "government":
        return "Gov";
      case "research":
        return "Research";
      case "investigation":
        return "Report";
    }
  };
  const skincareProductSlots = useMemo(
    () => (isSkincareChapter ? buildSkincareChapterProductSlots(chapter.planItems) : []),
    [chapter.planItems, isSkincareChapter],
  );

  /** Pre-scored subset for this chapter (Wellnest: top few; aesthetic: keyword matches). */
  const catalogVideos = chapter.videos;
  const chapterOverview = useMemo(
    () =>
      buildChapterOverviewContent(
        chapter,
        chapterAnalysisContext ?? undefined,
        chapterComplementContext ?? undefined,
      ),
    [chapter, chapterAnalysisContext, chapterComplementContext],
  );
  const [aiChapterAnalysis, setAiChapterAnalysis] = useState<string | null>(null);
  const aiChapterPayload = useMemo(() => {
    const snapshot = chapterAnalysisContext?.overviewSnapshot ?? null;
    const planRow = chapterAnalysisContext?.planRow ?? null;
    const focusAreas = snapshot?.areas
      ?.filter((a) => a.hasInterest)
      .map((a) => a.name)
      .slice(0, 8) ?? [];
    const areaImprovements = snapshot?.areas
      ?.flatMap((a) => a.improvements ?? [])
      .filter(Boolean)
      .slice(0, 14) ?? [];
    return {
      treatment: chapter.treatment,
      displayName: chapter.displayName,
      displayArea: chapter.displayArea,
      whyRecommended: chapter.whyRecommended.slice(0, 10),
      planBullets: chapterOverview.planBullets.slice(0, 8),
      findings: planRow?.findings?.slice(0, 10) ?? [],
      interest: planRow?.interest,
      detectedIssues: snapshot?.detectedIssueLabels?.slice(0, 14) ?? [],
      focusAreas,
      areaImprovements,
      longevity: chapter.meta.longevity,
      downtime: chapter.meta.downtime,
      priceRange: chapter.meta.priceRange,
    };
  }, [chapter, chapterOverview.planBullets, chapterAnalysisContext]);

  const [cardRef, cardInView] = useInViewOnce<HTMLElement>("0px 0px -5% 0px", 0.05);

  useEffect(() => {
    if (!cardInView) return;
    let cancelled = false;
    setAiChapterAnalysis(null);
    void (async () => {
      const text = await fetchTreatmentChapterOverview(aiChapterPayload);
      if (cancelled) return;
      setAiChapterAnalysis(text && text.trim().length > 0 ? text.trim() : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [aiChapterPayload, cardInView]);

  const chapterOverviewResolved = useMemo(
    () => {
      if (aiChapterAnalysis) {
        return { ...chapterOverview, analysis: aiChapterAnalysis };
      }
      return chapterOverview;
    },
    [chapterOverview, aiChapterAnalysis],
  );
  const chapterOverviewSpeech = useMemo(
    () =>
      buildChapterOverviewSpeechText(chapterOverviewResolved, chapterGlossaryTerms),
    [chapterOverviewResolved, chapterGlossaryTerms],
  );
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null);
  /** Vimeo poster URLs that failed to load (e.g. CDN 403) — show branded fallback. */
  const [vimeoPosterLoadFailed, setVimeoPosterLoadFailed] = useState<
    Record<string, true>
  >({});
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
        storyDetailed: p.storyDetailedDisplay,
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
    <article
      id={anchorId}
      ref={cardRef}
      className={`tc${cardInView ? " tc--visible" : ""}`}
      aria-label={chapter.displayName}
    >
      {/* Chapter number badge */}
      <div className="tc-badge">
        <span className="tc-badge-num">{index + 1}</span>
        <span className="tc-badge-of">of {total}</span>
      </div>

      {/* Header */}
      <div className="tc-head">
        <h2 className="tc-name">{chapter.displayName}</h2>
      </div>

      {/* Regions / plan notes — high on the card so they are not buried below photos */}
      {card && card.planHighlights.length > 0 && !isSkincareChapter && (
        <div className="tc-highlights tc-highlights--top">
          <div className="pvb-chips">
            {card.planHighlights.map((h) => (
              <span key={h} className="pvb-chip">
                {h}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="tc-overview">
        <div className="tc-overview-head">
          <div className="tc-overview-brand">
            <AiSparkleLogo size={15} className="tc-overview-ai-logo pvb-ai-sparkle-glow" />
            <h3 className="tc-label pvb-aesthetic-intelligence-heading">Aesthetic Intelligence</h3>
            <GeminiWordmark />
          </div>
          <PvbNarrativeAudioControls
            text={chapterOverviewSpeech}
            ariaLabel={`Listen to Aesthetic Intelligence for ${chapter.displayName}`}
            ariaLabelStop="Stop audio"
            analytics={
              blueprintPatientAnalytics
                ? {
                    ...blueprintPatientAnalytics,
                    scope: "chapter",
                    chapter_key: chapter.key,
                    chapter_display_name: chapter.displayName,
                  }
                : undefined
            }
          />
        </div>
        <PvbChapterOverviewTypewriter chapterOverview={chapterOverviewResolved} />
      </div>

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
              <span className="tc-fact-label">
                {chapter.meta.downtimeFactLabel || "Downtime"}
              </span>
              <span className="tc-fact-val">{chapter.meta.downtime}</span>
            </div>
          )}
          {chapter.meta.priceRange && (
            <div className="tc-fact">
              <span className="tc-fact-label">
                {chapter.meta.priceFactLabel === "price" ? "Price" : "Range"}
              </span>
              <span className="tc-fact-val">{chapter.meta.priceRange}</span>
            </div>
          )}
        </div>
      )}
      {chapter.meta.notes && <p className="tc-fact-note">{chapter.meta.notes}</p>}

      {chapterGlossaryTerms && chapterGlossaryTerms.length > 0 && (
        <div className="pvb-plan-glossary tc-chapter-glossary">
          <h4 className="pvb-plan-glossary__section-title">Technical terms</h4>
          <p className="pvb-plan-glossary-lead">
            Quick definitions for abbreviations and add-ons that appear in this part of your plan.
          </p>
          <ul className="pvb-plan-glossary-list" aria-label="Technical terms for this treatment">
            {chapterGlossaryTerms.map((term) => (
              <li key={term.id} className="pvb-plan-glossary-item">
                <details className="pvb-plan-glossary-term-details">
                  <summary className="pvb-plan-glossary__term-summary">
                    <span className="pvb-plan-glossary-term">{term.title}</span>
                    <span className="pvb-plan-glossary__term-chev" aria-hidden>
                      ▼
                    </span>
                  </summary>
                  <div className="pvb-plan-glossary__term-body">
                    <p className="pvb-plan-glossary-body">{term.body}</p>
                    {term.relationToYou ? (
                      <p className="pvb-plan-glossary-relation">{term.relationToYou}</p>
                    ) : null}
                  </div>
                </details>
              </li>
            ))}
          </ul>
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
                onClick={() => {
                  if (blueprintPatientAnalytics) {
                    trackPostVisitBlueprintEvent("blueprint_video_modal_opened", {
                      ...blueprintPatientAnalytics,
                      chapter_key: chapter.key,
                      video_id: mod.id,
                      module_title: mod.title,
                    });
                  }
                  setExpandedVideoId(mod.id);
                }}
                aria-haspopup="dialog"
                aria-expanded={expandedVideoId === mod.id}
                aria-label={`Open video: ${mod.title}`}
              >
                <span className="tc-video-thumb-frame">
                  {(() => {
                    const customThumbKey = mod.wellnestThumbnailImageKey;
                    if (customThumbKey) {
                      return (
                        <WellnestThumbnail
                          imageKey={customThumbKey}
                          className="tc-video-thumb-wellnest"
                          compact
                          alt={mod.title}
                        />
                      );
                    }
                    const thumbSrc =
                      mod.vimeoId && vimeoPosterLoadFailed[mod.id]
                        ? WELLNEST_VIMEO_POSTER_FALLBACK
                        : mod.posterUrl;
                    return thumbSrc ? (
                    <img
                      className="tc-video-thumb-img"
                      src={thumbSrc}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      onError={() => {
                        if (
                          mod.vimeoId &&
                          !vimeoPosterLoadFailed[mod.id] &&
                          thumbSrc !== WELLNEST_VIMEO_POSTER_FALLBACK
                        ) {
                          setVimeoPosterLoadFailed((p) => ({
                            ...p,
                            [mod.id]: true,
                          }));
                        }
                      }}
                    />
                  ) : mod.sources?.length ? (
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
                        } catch (_error) {
                          /* seek can fail before enough data */
                        }
                      }}
                    >
                      {mod.sources.map((source) => (
                        <source key={source.src} src={source.src} type={source.mimeType} />
                      ))}
                    </video>
                  ) : mod.vimeoId ? (
                    <div className="tc-video-thumb-vimeo-placeholder" aria-hidden />
                  ) : null;
                  })()}
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
                {expandedVideo.vimeoId ? (
                  <iframe
                    key={expandedVideo.id}
                    title={expandedVideo.title}
                    src={`https://player.vimeo.com/video/${expandedVideo.vimeoId}?autoplay=1`}
                    className="tc-video-modal-player tc-video-modal-player--vimeo"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    onLoad={() =>
                      onVideoPlay(expandedVideo.id, expandedVideo.title)
                    }
                  />
                ) : (
                  <video
                    key={expandedVideo.id}
                    className="tc-video-modal-player"
                    controls
                    playsInline
                    preload="metadata"
                    poster={expandedVideo.posterUrl}
                    autoPlay
                    onPlay={() =>
                      onVideoPlay(expandedVideo.id, expandedVideo.title)
                    }
                  >
                    {(expandedVideo.sources ?? []).map((source) => (
                      <source
                        key={source.src}
                        src={source.src}
                        type={source.mimeType}
                      />
                    ))}
                  </video>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Photo carousel — omit entire section when there are no matching case photos */}
      {card && len > 0 ? (
        <div className="tc-cases-section">
          <div className="tc-cases-head">
            <h3 className="tc-section-label">Results like yours</h3>
            {len > 1 && <span className="tc-swipe-hint">Swipe &rarr;</span>}
          </div>
          <div className="tc-carousel" onScroll={() => trackCaseGallery()}>
            {photos.map((photo) => {
              const pd = processPhoto(photo, card);
              const showDemoLine = Boolean(
                pd.ageDisplay || pd.skinTypeDisplay || pd.skinToneDisplay,
              );
              return (
                <div key={photo.id} className="tc-carousel-card">
                  <div className="tc-carousel-img-wrap">
                    <img
                      src={photo.photoUrl}
                      alt={`Before and after example for ${chapter.displayName}`}
                      className="tc-carousel-img"
                      loading="lazy"
                    />
                  </div>
                  {showDemoLine ? (
                    <div className="tc-carousel-caption tc-carousel-caption--compact">
                      <p className="tc-carousel-demo">
                        {[
                          pd.ageDisplay && `Age: ${pd.ageDisplay}`,
                          pd.skinTypeDisplay && `Skin: ${pd.skinTypeDisplay}`,
                          pd.skinToneDisplay && `Tone: ${pd.skinToneDisplay}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  ) : null}
                  <button type="button" className="tc-carousel-detail-btn" onClick={() => openCaseDetail(photo, card)}>
                    View details
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Wellnest: curated articles/resources for this treatment */}
      {wellnestOffering && externalExamples.length > 0 && (
        <div className="tc-external-section">
          <h3 className="tc-section-label">Articles & resources</h3>
          <p className="tc-external-disclaimer tc-external-disclaimer--compact">
            {WELLNEST_EXTERNAL_LINKS_DISCLAIMER}
          </p>
          <ul className="tc-external-list">
            {externalExamples.map((ex) => (
              <li key={`tp-ex-${ex.id}`} className="tc-external-item">
                <span
                  className="tc-external-kind"
                  title={ex.kind}
                  aria-label={`Category: ${externalKindLabel(ex.kind)}`}
                >
                  {externalKindLabel(ex.kind)}
                </span>
                <a
                  href={ex.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tc-external-link"
                  onClick={() => {
                    if (blueprintPatientAnalytics) {
                      trackPostVisitBlueprintEvent("blueprint_external_link_clicked", {
                        ...blueprintPatientAnalytics,
                        chapter_key: chapter.key,
                        resource_id: ex.id,
                        resource_kind: ex.kind,
                      });
                    }
                  }}
                >
                  {ex.title}
                </a>
                {ex.note ? (
                  <span className="tc-external-note">{ex.note}</span>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="tc-external-disclaimer">{WELLNEST_REGULATORY_NOTICE}</p>
        </div>
      )}

      {/* Skincare: boutique product images + caption under each */}
      {isSkincareChapter && skincareProductSlots.length > 0 && (
        <div className="tc-skincare-products">
          <h3 className="tc-section-label">Products discussed</h3>
          <div className="tc-skincare-products__grid" role="list">
            {skincareProductSlots.map((slot) => {
              const caption = (
                <span className="tc-skincare-products__caption">{slot.shortName}</span>
              );
              const inner = (
                <>
                  <div className="tc-skincare-products__thumb-wrap">
                    {slot.imageUrl ? (
                      <img
                        src={slot.imageUrl}
                        alt=""
                        className="tc-skincare-products__thumb"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div
                        className="tc-skincare-products__thumb tc-skincare-products__thumb--placeholder"
                        aria-hidden
                      >
                        <span className="tc-skincare-products__ph-icon" aria-hidden>
                          ◆
                        </span>
                      </div>
                    )}
                  </div>
                  {caption}
                </>
              );
              return slot.productUrl ? (
                <a
                  key={slot.planProductLabel}
                  className="tc-skincare-products__cell tc-skincare-products__cell--link"
                  href={slot.productUrl}
                  target="_blank"
                  rel="noreferrer"
                  role="listitem"
                  aria-label={`${slot.shortName} (opens product page)`}
                >
                  {inner}
                </a>
              ) : (
                <div
                  key={slot.planProductLabel}
                  className="tc-skincare-products__cell"
                  role="listitem"
                >
                  {inner}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </article>
  );
}
