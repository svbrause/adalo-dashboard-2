// Issue Photo Carousel Component
// Displays a horizontal carousel of treatment photos for a specific issue/region

import { useState, useEffect, useMemo } from 'react';
import { Client, TreatmentPhoto } from '../../types';
import { fetchTreatmentPhotos, AirtableRecord } from '../../services/api';
import './IssuePhotoCarousel.css';

interface IssuePhotoCarouselProps {
  issue: string;
  region: string;
  client?: Client;
  onPhotoClick?: (photo: TreatmentPhoto) => void;
  maxPhotos?: number;
  /** Optional demo photos for debug pages (skip API fetch) */
  demoPhotos?: TreatmentPhoto[] | null;
}

function mapRecordToPhoto(record: AirtableRecord): TreatmentPhoto {
  const fields = record.fields;
  const photoAttachment = fields['Photo'];
  let photoUrl = '';
  let thumbnailUrl = '';
  if (Array.isArray(photoAttachment) && photoAttachment.length > 0) {
    const attachment = photoAttachment[0];
    photoUrl = attachment.thumbnails?.full?.url || attachment.thumbnails?.large?.url || attachment.url || '';
    thumbnailUrl = attachment.thumbnails?.large?.url || attachment.thumbnails?.small?.url || attachment.url || '';
  }
  const treatments = Array.isArray(fields['Name (from Treatments)']) ? fields['Name (from Treatments)'] : fields['Treatments'] ? [fields['Treatments']] : [];
  const generalTreatments = Array.isArray(fields['Name (from General Treatments)']) ? fields['Name (from General Treatments)'] : fields['General Treatments'] ? [fields['General Treatments']] : [];
  const areaNames = fields['Area Names'] ? String(fields['Area Names']).split(',').map((s: string) => s.trim()).filter(Boolean) : [];
  return {
    id: record.id,
    name: fields['Name'] || '',
    photoUrl,
    thumbnailUrl,
    treatments,
    generalTreatments,
    areaNames,
    surgical: fields['Surgical (from General Treatments)'] != null ? String(fields['Surgical (from General Treatments)']) : undefined,
    caption: fields['Caption'] || undefined,
    storyTitle: fields['Story Title'] || undefined,
    storyDetailed: fields['Story Detailed'] || undefined,
  };
}

// Map issues to likely treatment types
const ISSUE_TO_TREATMENT: Record<string, string[]> = {
  'wrinkles': ['Neurotoxin', 'Laser', 'Chemical Peel'],
  'fine lines': ['Neurotoxin', 'Laser', 'Skincare'],
  'crow\'s feet': ['Neurotoxin', 'Laser'],
  'forehead lines': ['Neurotoxin'],
  'frown lines': ['Neurotoxin'],
  'volume loss': ['Filler'],
  'hollow cheeks': ['Filler'],
  'thin lips': ['Filler'],
  'nasolabial folds': ['Filler'],
  'marionette lines': ['Filler'],
  'under eye bags': ['Filler', 'Laser'],
  'dark circles': ['Filler', 'Skincare'],
  'acne': ['Chemical Peel', 'Laser', 'Skincare'],
  'acne scars': ['Microneedling', 'Laser', 'Chemical Peel', 'PRP', 'PDGF'],
  'hyperpigmentation': ['Chemical Peel', 'Laser', 'Skincare'],
  'dark spots': ['Chemical Peel', 'Laser', 'Skincare'],
  'sun damage': ['Laser', 'Chemical Peel'],
  'redness': ['Laser', 'Skincare'],
  'rosacea': ['Laser', 'Skincare'],
  'skin laxity': ['Laser', 'Microneedling'],
  'sagging skin': ['Laser', 'Microneedling'],
  'double chin': ['Filler', 'Laser'],
  'jowls': ['Filler', 'Laser', 'Microneedling'],
  'uneven skin tone': ['Chemical Peel', 'Laser', 'Skincare'],
  'texture': ['Microneedling', 'Chemical Peel', 'Laser', 'PRP', 'PDGF'],
  'pores': ['Microneedling', 'Chemical Peel'],
  'droopy eyelids': ['Laser', 'Neurotoxin'],
};

export default function IssuePhotoCarousel({
  issue,
  region,
  client: _client,
  onPhotoClick,
  maxPhotos = 6,
  demoPhotos,
}: IssuePhotoCarouselProps) {
  const [allPhotos, setAllPhotos] = useState<TreatmentPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scrollIndex, setScrollIndex] = useState(0);

  const useDemo = Array.isArray(demoPhotos) && demoPhotos.length > 0;

  // Fetch photos on mount (skip if demo photos provided)
  useEffect(() => {
    if (useDemo) {
      setAllPhotos(demoPhotos!);
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);
    fetchTreatmentPhotos()
      .then((records) => {
        if (mounted) {
          const photos = records.map(mapRecordToPhoto).filter((p) => p.photoUrl);
          setAllPhotos(photos);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message || 'Failed to load photos');
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [useDemo, demoPhotos]);

  // Filter photos by issue/region
  const filteredPhotos = useMemo(() => {
    if (!allPhotos.length) return [];

    const issueLower = issue.toLowerCase();
    const regionLower = region.toLowerCase();

    // Find likely treatment types for this issue
    const likelyTreatments = Object.entries(ISSUE_TO_TREATMENT).find(([key]) =>
      issueLower.includes(key.toLowerCase())
    )?.[1] || [];

    // Extract potential region from issue name (e.g., "Forehead Wrinkles" -> "forehead")
    const issueRegions: string[] = [];
    const regionKeywords = ['forehead', 'eye', 'cheek', 'nose', 'lip', 'jaw', 'chin', 'neck', 'brow'];
    regionKeywords.forEach((kw) => {
      if (issueLower.includes(kw)) {
        issueRegions.push(kw);
      }
    });

    // Categories that are too broad to filter by region
    const broadCategories = ['skin', 'other', 'body'];
    const isBroadCategory = broadCategories.includes(regionLower);

    return allPhotos.filter((photo) => {
      // Match by region - check both passed region and issue-derived regions
      const matchesPassedRegion = photo.areaNames.some(
        (a) => a.toLowerCase().includes(regionLower) || regionLower === 'all'
      );
      
      const matchesIssueRegion = issueRegions.length > 0 && photo.areaNames.some((a) =>
        issueRegions.some((ir) => a.toLowerCase().includes(ir))
      );
      
      const matchesRegion = matchesPassedRegion || matchesIssueRegion || isBroadCategory;

      // Match by treatment type if we have likely treatments
      const matchesTreatment =
        likelyTreatments.length === 0 ||
        photo.generalTreatments.some((t) =>
          likelyTreatments.some((lt) =>
            String(t).toLowerCase().includes(lt.toLowerCase())
          )
        );

      // For broad categories, require treatment match; otherwise require region match
      if (isBroadCategory) {
        return matchesTreatment;
      }
      return matchesRegion && matchesTreatment;
    }).slice(0, maxPhotos);
  }, [allPhotos, issue, region, maxPhotos]);

  const canScrollLeft = scrollIndex > 0;
  const canScrollRight = scrollIndex < filteredPhotos.length - 3;

  const handleScroll = (direction: 'left' | 'right') => {
    if (direction === 'left' && canScrollLeft) {
      setScrollIndex((prev) => Math.max(0, prev - 1));
    } else if (direction === 'right' && canScrollRight) {
      setScrollIndex((prev) => Math.min(filteredPhotos.length - 3, prev + 1));
    }
  };

  if (loading) {
    return (
      <div className="issue-photo-carousel-loading">
        <div className="issue-photo-carousel-spinner" />
        <span>Loading examples...</span>
      </div>
    );
  }

  if (error) {
    return <div className="issue-photo-carousel-error">{error}</div>;
  }

  if (filteredPhotos.length === 0) {
    return (
      <div className="issue-photo-carousel-empty">
        No treatment examples available for this issue.
      </div>
    );
  }

  return (
    <div className="issue-photo-carousel">
      <div className="issue-photo-carousel-header">
        <span className="issue-photo-carousel-title">Treatment Examples</span>
        <span className="issue-photo-carousel-count">
          {filteredPhotos.length} photos
        </span>
      </div>
      <div className="issue-photo-carousel-container">
        {canScrollLeft && (
          <button
            type="button"
            className="issue-photo-carousel-nav issue-photo-carousel-nav-left"
            onClick={() => handleScroll('left')}
            aria-label="Scroll left"
          >
            ‹
          </button>
        )}
        <div
          className="issue-photo-carousel-track"
          style={{
            transform: `translateX(-${scrollIndex * 140}px)`,
          }}
        >
          {filteredPhotos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              className="issue-photo-carousel-item"
              onClick={() => onPhotoClick?.(photo)}
            >
              <img
                src={photo.thumbnailUrl || photo.photoUrl}
                alt={photo.name?.trim() || photo.caption || 'Treatment example'}
                className="issue-photo-carousel-image"
                loading="lazy"
              />
              <div className="issue-photo-carousel-treatment">
                {photo.generalTreatments[0]}
              </div>
            </button>
          ))}
        </div>
        {canScrollRight && (
          <button
            type="button"
            className="issue-photo-carousel-nav issue-photo-carousel-nav-right"
            onClick={() => handleScroll('right')}
            aria-label="Scroll right"
          >
            ›
          </button>
        )}
      </div>
    </div>
  );
}
