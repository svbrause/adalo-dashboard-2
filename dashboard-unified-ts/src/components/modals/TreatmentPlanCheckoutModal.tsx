// Checkout screen – separate modal showing treatment plan price summary (2025 pricing)

import { useState, useEffect, useCallback, useMemo } from "react";
import type { Client, DiscussedItem } from "../../types";
import { fetchTreatmentPhotos, type AirtableRecord } from "../../services/api";
import { getSkincareCarouselItems } from "./DiscussedTreatmentsModal/constants";
import TreatmentPlanCheckout from "./DiscussedTreatmentsModal/TreatmentPlanCheckout";
import type { CheckoutLineItemDetail } from "../../data/treatmentPricing2025";
import { formatPrice } from "../../data/treatmentPricing2025";
import { useDashboard } from "../../context/DashboardContext";
import { isWellnestWellnessProviderCode } from "../../data/wellnestOfferings";
import "./TreatmentPlanCheckoutModal.css";
import "../treatmentRecommender/TreatmentRecommenderByTreatment.css";

export interface TreatmentPlanCheckoutModalProps {
  clientName: string;
  items: DiscussedItem[];
  client?: Client | null;
  onClose: () => void;
  /** When provided, each row shows a remove button; called with the item and its index in the list. */
  onRemoveItem?: (item: DiscussedItem, index: number) => void;
  /** When provided, move-to-wishlist / move-to-now links are shown; called with index and partial item (e.g. { timeline }). */
  onUpdateItem?: (index: number, patch: Partial<DiscussedItem>) => void;
  /** When set (e.g. TheTreatment250), treatment type options are restricted to those in the pricing sheet. */
  providerCode?: string;
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
      att.thumbnails?.full?.url || att.thumbnails?.large?.url || att.url || "";
  }
  const treatments = Array.isArray(fields["Name (from Treatments)"])
    ? fields["Name (from Treatments)"]
    : fields["Treatments"]
      ? [fields["Treatments"]]
      : [];
  const generalTreatments = Array.isArray(
    fields["Name (from General Treatments)"],
  )
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
  photos: {
    photoUrl: string;
    treatments: string[];
    generalTreatments: string[];
  }[];
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
    const photos = records
      .map(recordToPhotoForCheckout)
      .filter((p) => p.photoUrl);
    checkoutTreatmentPhotosCache = { photos, timestamp: Date.now() };
    const skincareUrls = getSkincareCarouselItems()
      .map((p) => p.imageUrl)
      .filter(Boolean) as string[];
    preloadCheckoutImages([...photos.map((p) => p.photoUrl), ...skincareUrls]);
  } catch {
    // ignore
  }
}

export default function TreatmentPlanCheckoutModal({
  clientName,
  items,
  client: _client,
  onClose,
  onRemoveItem,
  onUpdateItem,
  providerCode,
}: TreatmentPlanCheckoutModalProps) {
  const { provider } = useDashboard();
  const firstName = clientName?.trim().split(/\s+/)[0] || "Patient";
  const [quoteData, setQuoteData] = useState<{
    lineItems: CheckoutLineItemDetail[];
    total: number;
    hasUnknownPrices: boolean;
  } | null>(null);
  const [showQuoteSheet, setShowQuoteSheet] = useState(false);
  const [isMintMember, setIsMintMember] = useState(false);
  const [treatmentPhotos, setTreatmentPhotos] = useState<
    { photoUrl: string; treatments: string[]; generalTreatments: string[] }[]
  >([]);

  useEffect(() => {
    const cached =
      checkoutTreatmentPhotosCache &&
      Date.now() - checkoutTreatmentPhotosCache.timestamp <
        CHECKOUT_CACHE_TTL_MS
        ? checkoutTreatmentPhotosCache.photos
        : null;
    if (cached?.length) setTreatmentPhotos(cached);
    let cancelled = false;
    fetchTreatmentPhotos({ limit: 500 })
      .then((records) => {
        if (cancelled) return;
        const photos = records
          .map(recordToPhotoForCheckout)
          .filter((p) => p.photoUrl);
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
            q.includes(p.name.trim().toLowerCase()),
        );
        if (found?.imageUrl) return found.imageUrl;
      }
      if (!treatment) return null;
      const match = treatmentPhotos.find(
        (p) =>
          p.treatments.some(
            (t) => t.trim().toLowerCase() === treatment.toLowerCase(),
          ) ||
          p.generalTreatments.some(
            (t) => t.trim().toLowerCase() === treatment.toLowerCase(),
          ),
      );
      return match?.photoUrl ?? null;
    },
    [treatmentPhotos, skincareCarousel],
  );

  const allowMintMembership = !isWellnestWellnessProviderCode(
    providerCode ?? provider?.code,
  );
  const effectiveMintMember = allowMintMembership ? isMintMember : false;

  return (
    <div
      className="treatment-plan-checkout-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-label="Treatment Plan Quote"
    >
      <div
        className="treatment-plan-checkout-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="treatment-plan-checkout-modal-header">
          <div className="treatment-plan-checkout-modal-header-info">
            <h2 className="treatment-plan-checkout-modal-title">
              Treatment Plan Quote
            </h2>
            <p className="treatment-plan-checkout-modal-subtitle">
              Price summary for {firstName}&apos;s treatment plan
            </p>
          </div>
          <div className="treatment-plan-checkout-modal-header-actions">
            {quoteData && quoteData.lineItems.length > 0 && (
              <button
                type="button"
                className="treatment-plan-checkout-quote-btn"
                onClick={() => setShowQuoteSheet(true)}
              >
                Quote Summary
              </button>
            )}
            <button
              type="button"
              className="treatment-plan-checkout-modal-close"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          </div>
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
              onCheckoutDataChange={setQuoteData}
              onRemoveItem={onRemoveItem}
              onUpdateItem={onUpdateItem}
              isMintMember={effectiveMintMember}
              onMintMemberChange={
                allowMintMembership ? setIsMintMember : undefined
              }
              providerCode={providerCode}
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

      {showQuoteSheet && quoteData && (
        <div
          className="treatment-plan-quote-sheet-overlay"
          onClick={() => setShowQuoteSheet(false)}
          role="dialog"
          aria-label="Treatment plan quote – treatment summary for patient review"
        >
          <div
            className="treatment-plan-quote-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="treatment-plan-quote-sheet-header">
              <h2 className="treatment-plan-quote-sheet-title">Summary</h2>
              <p className="treatment-plan-quote-sheet-subtitle">
                For {clientName?.trim() || "Patient"} – review with patient
              </p>
              <button
                type="button"
                className="treatment-plan-quote-sheet-close"
                onClick={() => setShowQuoteSheet(false)}
                aria-label="Close quote sheet"
              >
                ×
              </button>
            </div>
            <div className="treatment-plan-quote-sheet-body">
              <table className="treatment-plan-quote-sheet-table">
                <thead>
                  <tr>
                    <th className="treatment-plan-quote-sheet-th">Treatment</th>
                    <th className="treatment-plan-quote-sheet-th treatment-plan-quote-sheet-th--right">
                      Price
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {quoteData.lineItems.map((line, idx) => {
                    const isPerUnitBreakdown =
                      line.displayPrice.includes(" × ") &&
                      line.displayPrice.includes(" = ");
                    const quotePrice = isPerUnitBreakdown
                      ? formatPrice(line.price)
                      : line.displayPrice;
                    return (
                      <tr key={idx}>
                        <td className="treatment-plan-quote-sheet-td">
                          {line.skuName ?? line.label}
                        </td>
                        <td className="treatment-plan-quote-sheet-td treatment-plan-quote-sheet-td--right">
                          {quotePrice}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="treatment-plan-quote-sheet-footer">
              {allowMintMembership && effectiveMintMember && quoteData.total > 0 && (
                <div className="treatment-plan-quote-sheet-total-row treatment-plan-quote-sheet-mint-line">
                  <span className="treatment-plan-quote-sheet-total-label">
                    Mint member 10% off
                  </span>
                  <span className="treatment-plan-quote-sheet-total-value">
                    −{formatPrice(quoteData.total * 0.1)}
                  </span>
                </div>
              )}
              <div className="treatment-plan-quote-sheet-total-row">
                <span className="treatment-plan-quote-sheet-total-label">
                  {quoteData.hasUnknownPrices ? "Estimated total" : "Total"}
                </span>
                <span className="treatment-plan-quote-sheet-total-value">
                  {quoteData.hasUnknownPrices && quoteData.total === 0
                    ? "—"
                    : formatPrice(
                        allowMintMembership &&
                          effectiveMintMember &&
                          quoteData.total > 0
                          ? quoteData.total - quoteData.total * 0.1
                          : quoteData.total,
                      )}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
