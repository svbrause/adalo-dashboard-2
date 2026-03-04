// Checkout screen – separate modal showing treatment plan price summary (2025 pricing)

import { useState, useEffect, useCallback, useMemo } from "react";
import type { DiscussedItem } from "../../types";
import { fetchTreatmentPhotos, type AirtableRecord } from "../../services/api";
import { getSkincareCarouselItems } from "./DiscussedTreatmentsModal/constants";
import TreatmentPlanCheckout from "./DiscussedTreatmentsModal/TreatmentPlanCheckout";
import "./TreatmentPlanCheckoutModal.css";

export interface TreatmentPlanCheckoutModalProps {
  clientName: string;
  items: DiscussedItem[];
  onClose: () => void;
}

/** Minimal map: Airtable record → photoUrl + treatment names for matching. */
function recordToPhotoForCheckout(record: AirtableRecord): {
  photoUrl: string;
  treatments: string[];
  generalTreatments: string[];
} {
  const fields = record.fields ?? {};
  const photoAttachment = fields["Photo"];
  let photoUrl = "";
  if (Array.isArray(photoAttachment) && photoAttachment.length > 0) {
    const att = photoAttachment[0];
    photoUrl =
      att.thumbnails?.full?.url ||
      att.thumbnails?.large?.url ||
      att.url ||
      "";
  }
  const treatments = Array.isArray(fields["Name (from Treatments)"])
    ? fields["Name (from Treatments)"]
    : fields["Treatments"]
      ? [fields["Treatments"]]
      : [];
  const generalTreatments = Array.isArray(fields["Name (from General Treatments)"])
    ? fields["Name (from General Treatments)"]
    : fields["General Treatments"]
      ? [fields["General Treatments"]]
      : [];
  return { photoUrl, treatments, generalTreatments };
}

/** Preload image URLs so they are cached before the user scrolls or opens the screen. */
function preloadCheckoutImages(urls: string[]): void {
  const seen = new Set<string>();
  urls.forEach((url) => {
    const u = (url ?? "").trim();
    if (!u || seen.has(u)) return;
    seen.add(u);
    const img = new Image();
    img.src = u;
  });
}

/** Cached treatment photos for checkout so prefetched data is ready when modal opens. */
let checkoutTreatmentPhotosCache: {
  photos: { photoUrl: string; treatments: string[]; generalTreatments: string[] }[];
  timestamp: number;
} | null = null;
const CHECKOUT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

/**
 * Call from a parent (e.g. when client has discussed items) to fetch treatment photos
 * and preload images in advance so checkout opens with images ready.
 */
export async function prefetchCheckoutImages(): Promise<void> {
  try {
    const records = await fetchTreatmentPhotos({ limit: 500 });
    const photos = records.map(recordToPhotoForCheckout).filter((p) => p.photoUrl);
    checkoutTreatmentPhotosCache = { photos, timestamp: Date.now() };
    const skincareUrls = getSkincareCarouselItems().map((p) => p.imageUrl).filter(Boolean) as string[];
    preloadCheckoutImages([...photos.map((p) => p.photoUrl), ...skincareUrls]);
  } catch {
    // ignore
  }
}

export default function TreatmentPlanCheckoutModal({
  clientName,
  items,
  onClose,
}: TreatmentPlanCheckoutModalProps) {
  const firstName = clientName?.trim().split(/\s+/)[0] || "Patient";
  const [treatmentPhotos, setTreatmentPhotos] = useState<
    { photoUrl: string; treatments: string[]; generalTreatments: string[] }[]
  >([]);

  useEffect(() => {
    const cached =
      checkoutTreatmentPhotosCache &&
      Date.now() - checkoutTreatmentPhotosCache.timestamp < CHECKOUT_CACHE_TTL_MS
        ? checkoutTreatmentPhotosCache.photos
        : null;
    if (cached?.length) setTreatmentPhotos(cached);
    let cancelled = false;
    fetchTreatmentPhotos({ limit: 500 })
      .then((records) => {
        if (cancelled) return;
        const photos = records.map(recordToPhotoForCheckout).filter((p) => p.photoUrl);
        setTreatmentPhotos(photos);
        checkoutTreatmentPhotosCache = { photos, timestamp: Date.now() };
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const skincareCarousel = useMemo(() => getSkincareCarouselItems(), []);

  // Preload all treatment + skincare images as soon as we have them so they don't load on open
  useEffect(() => {
    const urls: string[] = [];
    treatmentPhotos.forEach((p) => {
      if (p.photoUrl) urls.push(p.photoUrl);
    });
    skincareCarousel.forEach((p) => {
      if (p.imageUrl) urls.push(p.imageUrl);
    });
    if (urls.length > 0) preloadCheckoutImages(urls);
  }, [treatmentPhotos, skincareCarousel]);

  const getPhotoForItem = useCallback(
    (item: DiscussedItem): string | null => {
      const treatment = (item.treatment ?? "").trim();
      const product = (item.product ?? "").trim();
      if (treatment === "Skincare" && product) {
        const q = product.toLowerCase();
        const found = skincareCarousel.find(
          (p) =>
            p.name.trim().toLowerCase() === q ||
            p.name.trim().toLowerCase().includes(q) ||
            q.includes(p.name.trim().toLowerCase())
        );
        if (found?.imageUrl) return found.imageUrl;
      }
      if (!treatment) return null;
      const match = treatmentPhotos.find(
        (p) =>
          p.treatments.some((t) => t.trim().toLowerCase() === treatment.toLowerCase()) ||
          p.generalTreatments.some((t) => t.trim().toLowerCase() === treatment.toLowerCase())
      );
      return match?.photoUrl ?? null;
    },
    [treatmentPhotos, skincareCarousel]
  );

  return (
    <div
      className="treatment-plan-checkout-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-label="Checkout – treatment plan price summary"
    >
      <div
        className="treatment-plan-checkout-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="treatment-plan-checkout-modal-header">
          <div className="treatment-plan-checkout-modal-header-info">
            <h2 className="treatment-plan-checkout-modal-title">Checkout</h2>
            <p className="treatment-plan-checkout-modal-subtitle">
              Price summary for {firstName}&apos;s treatment plan
            </p>
          </div>
          <button
            type="button"
            className="treatment-plan-checkout-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="treatment-plan-checkout-modal-body">
          {items.length === 0 ? (
            <p className="treatment-plan-checkout-modal-empty">
              No treatments in the plan yet. Add treatments from the treatment
              plan to see an estimated total.
            </p>
          ) : (
            <TreatmentPlanCheckout
              items={items}
              getPhotoForItem={getPhotoForItem}
              totalSlotId="treatment-plan-checkout-modal-total-slot"
            />
          )}
        </div>
        <div className="treatment-plan-checkout-modal-actions">
          <div
            id="treatment-plan-checkout-modal-total-slot"
            className="treatment-plan-checkout-modal-total-slot"
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}
