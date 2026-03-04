/**
 * Modal showing skincare product detail with option to add to treatment plan
 * (replaces direct links to shop.getthetreatment.com in skin quiz flows).
 * Shows image gallery, description, pricing, and Add to plan / Open in shop.
 */

import { useEffect, useState } from "react";
import type { TreatmentPlanPrefill } from "./DiscussedTreatmentsModal/TreatmentPhotos";
import { TIMELINE_SKINCARE } from "./DiscussedTreatmentsModal/constants";
import "./SkinQuizProductModal.css";

export interface SkinQuizProduct {
  name: string;
  imageUrl?: string;
  productUrl?: string;
  recommendedFor?: string;
  /** Short or full description from the shop. */
  description?: string;
  /** Display price e.g. "$47". */
  price?: string;
  /** All product image URLs for gallery. */
  imageUrls?: string[];
}

interface SkinQuizProductModalProps {
  product: SkinQuizProduct;
  onClose: () => void;
  /** When provided, show "Add to treatment plan" and call with prefill on click. */
  onAddToPlan?: (prefill: TreatmentPlanPrefill) => void | Promise<void>;
}

function displayName(name: string): string {
  return name.split("|")[0]?.trim() ?? name;
}

export default function SkinQuizProductModal({
  product,
  onClose,
  onAddToPlan,
}: SkinQuizProductModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleAddToPlan = async () => {
    if (!onAddToPlan) return;
    const prefill: TreatmentPlanPrefill = {
      interest: "",
      region: "",
      treatment: "Skincare",
      treatmentProduct: displayName(product.name),
      timeline: TIMELINE_SKINCARE,
      notes: product.recommendedFor ?? undefined,
    };
    await onAddToPlan(prefill);
    onClose();
  };

  const galleryUrls = product.imageUrls?.length
    ? product.imageUrls
    : product.imageUrl
      ? [product.imageUrl]
      : [];
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const mainImageUrl = galleryUrls[selectedImageIndex] ?? product.imageUrl;

  return (
    <div
      className="modal-overlay active skin-quiz-product-modal-overlay"
      onClick={onClose}
    >
      <div
        className="skin-quiz-product-modal-content modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="skin-quiz-product-modal-header">
          <h2 className="skin-quiz-product-modal-title">Product details</h2>
          <button
            type="button"
            className="skin-quiz-product-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="skin-quiz-product-modal-body">
          <div className="skin-quiz-product-modal-gallery">
            <div className="skin-quiz-product-modal-image-wrap">
              {mainImageUrl ? (
                <img
                  src={mainImageUrl}
                  alt=""
                  className="skin-quiz-product-modal-image"
                />
              ) : (
                <div className="skin-quiz-product-modal-placeholder">
                  <span className="skin-quiz-product-modal-placeholder-icon">◆</span>
                </div>
              )}
            </div>
            {galleryUrls.length > 1 && (
              <div className="skin-quiz-product-modal-thumbs">
                {galleryUrls.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`skin-quiz-product-modal-thumb${i === selectedImageIndex ? " skin-quiz-product-modal-thumb--selected" : ""}`}
                    onClick={() => setSelectedImageIndex(i)}
                    aria-label={`View image ${i + 1}`}
                  >
                    <img src={url} alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="skin-quiz-product-modal-info">
            <h3 className="skin-quiz-product-modal-name">
              {displayName(product.name)}
            </h3>
            {product.price && (
              <p className="skin-quiz-product-modal-price">{product.price}</p>
            )}
            {product.recommendedFor && (
              <p className="skin-quiz-product-modal-reason">
                Recommended for: {product.recommendedFor}
              </p>
            )}
            {product.description && (
              <div className="skin-quiz-product-modal-description-wrap">
                <p className="skin-quiz-product-modal-description">
                  {product.description}
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="skin-quiz-product-modal-footer">
          {onAddToPlan && (
            <button
              type="button"
              className="skin-quiz-product-modal-btn skin-quiz-product-modal-btn--primary"
              onClick={handleAddToPlan}
            >
              Add to treatment plan
            </button>
          )}
          {product.productUrl && (
            <a
              href={product.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="skin-quiz-product-modal-btn skin-quiz-product-modal-btn--secondary"
            >
              {onAddToPlan ? "Open in shop" : "View product in shop"}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
