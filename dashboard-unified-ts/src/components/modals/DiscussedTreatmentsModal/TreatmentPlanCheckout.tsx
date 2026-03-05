// Treatment plan checkout – two-panel: list left, expandable detail right (What / Where / When / Quantity); price reflects options

import { useMemo, useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import type { DiscussedItem } from "../../../types";
import {
  getCheckoutSummaryWithSkus,
  formatPrice,
  type CheckoutLineItemDetail,
  type SkincareProductInfo,
} from "../../../data/treatmentPricing2025";
import { getCheckoutDisplayName, getQuantityContext } from "./utils";
import {
  getSkincareCarouselItems,
  CHECKOUT_TREATMENT_TYPE_OPTIONS,
  CHECKOUT_REGION_OPTIONS_BROAD,
  TREATMENTS_WITH_BROAD_REGION,
} from "./constants";
import { REGION_OPTIONS, TIMELINE_OPTIONS } from "./constants";
import { RECOMMENDED_PRODUCT_REASONS } from "../../../data/skinTypeQuiz";

export interface TreatmentPlanCheckoutProps {
  items: DiscussedItem[];
  /** Optional: return a photo URL for the treatment/product to show on the card (used when no boutique/sku image) */
  getPhotoForItem?: (item: DiscussedItem) => string | null;
  /** When set (e.g. modal), render the total into this DOM id instead of inline (bottom bar) */
  totalSlotId?: string;
  /** Called when checkout summary changes so parent can show quote sheet (lineItems use skuName from pricing e.g. "Moxi Full Face") */
  onCheckoutDataChange?: (data: {
    lineItems: CheckoutLineItemDetail[];
    total: number;
    hasUnknownPrices: boolean;
  }) => void;
  /** When provided, each row shows a remove button; called with the item and its index. */
  onRemoveItem?: (item: DiscussedItem, index: number) => void;
}

function matchSkincareProduct(productName: string, carouselItems: { name: string; imageUrl?: string; price?: string; description?: string }[]): { name: string; imageUrl?: string; price?: string; description?: string } | null {
  const q = (productName ?? "").trim().toLowerCase();
  if (!q) return null;
  const exact = carouselItems.find((p) => p.name.trim().toLowerCase() === q);
  if (exact) return exact;
  const contains = carouselItems.find(
    (p) =>
      p.name.trim().toLowerCase().includes(q) ||
      q.includes(p.name.trim().toLowerCase())
  );
  return contains ?? null;
}

/** Options for quantity/sessions select by treatment type (same as elsewhere in app). */
function getQuantityOptionsForCheckout(treatment: string | undefined): { label: string; options: string[] } | null {
  const t = (treatment ?? "").trim();
  if (t === "Skincare") return null;
  const result = getQuantityContext(treatment ?? "");
  return { label: result.unitLabel, options: result.options };
}

/** Options for Where dropdown: broad (Face/Neck/Chest) or specific (Forehead, etc.). */
function getRegionOptionsForTreatment(treatment: string): readonly string[] {
  const t = (treatment ?? "").trim();
  return TREATMENTS_WITH_BROAD_REGION.includes(t as (typeof TREATMENTS_WITH_BROAD_REGION)[number])
    ? CHECKOUT_REGION_OPTIONS_BROAD
    : REGION_OPTIONS;
}

/** First region that appears in the given options list (recommender may send "Forehead, Cheeks" or "Face, Neck & Chest"). */
function getDisplayRegionForCheckout(
  region: string | null | undefined,
  options: readonly string[]
): string {
  const r = (region ?? "").trim();
  if (!r) return "";
  const optList = [...options];
  if (optList.includes(r)) return r;
  const lower = r.toLowerCase();
  if (optList.includes("Face") && (lower.includes("face") || lower.includes("forehead") || lower.includes("full face"))) return "Face";
  if (optList.includes("Neck") && lower.includes("neck")) return "Neck";
  if (optList.includes("Chest") && lower.includes("chest")) return "Chest";
  const parts = r.split(",").map((p) => p.trim()).filter(Boolean);
  const found = parts.find((p) => optList.includes(p));
  return found ?? parts[0] ?? "";
}

/** First type option that appears in the product string (recommender may send "Moxi, BBL" for laser). */
function getDisplayProductForTypeSelect(product: string | null | undefined, typeOptions: string[]): string {
  const p = (product ?? "").trim();
  if (!p || !typeOptions?.length) return "";
  if (typeOptions.includes(p)) return p;
  const parts = p.split(",").map((s) => s.trim()).filter(Boolean);
  const found = parts.find((part) => typeOptions.some((opt) => opt === part || opt.includes(part) || part.includes(opt)));
  if (found) return typeOptions.find((opt) => opt === found || opt.includes(found) || found.includes(opt)) ?? found;
  const firstOptInProduct = typeOptions.find((opt) => p.includes(opt) || opt.includes(parts[0]));
  return firstOptInProduct ?? "";
}

/** "Recommended for" label for a skincare product (matches skincare recommendations screen). */
function getRecommendedForSkincare(productName: string): string {
  const key = (productName ?? "").trim();
  if (!key) return "redness and sensitivity";
  const exact = RECOMMENDED_PRODUCT_REASONS[key];
  if (exact) return exact;
  const lower = key.toLowerCase();
  const entry = Object.entries(RECOMMENDED_PRODUCT_REASONS).find(([k]) =>
    k.trim().toLowerCase().includes(lower) || lower.includes(k.trim().toLowerCase())
  );
  return entry ? entry[1] : "redness and sensitivity";
}

export default function TreatmentPlanCheckout({
  items,
  getPhotoForItem,
  totalSlotId,
  onCheckoutDataChange,
  onRemoveItem,
}: TreatmentPlanCheckoutProps) {
  const [totalSlotEl, setTotalSlotEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!totalSlotId || typeof document === "undefined") {
      setTotalSlotEl(null);
      return;
    }
    const el = document.getElementById(totalSlotId);
    setTotalSlotEl(el);
  }, [totalSlotId]);

  if (items.length === 0) return null;

  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [overrideRegion, setOverrideRegion] = useState<Record<string, string>>({});
  const [overrideTimeline, setOverrideTimeline] = useState<Record<string, string>>({});
  const [overrideProduct, setOverrideProduct] = useState<Record<string, string>>({});
  const [selectedIndex, setSelectedIndex] = useState<number | null>(0);
  const carouselItems = useMemo(() => getSkincareCarouselItems(), []);

  useEffect(() => {
    if (items.length === 0) {
      setSelectedIndex(null);
      return;
    }
    if (selectedIndex !== null && selectedIndex >= items.length) {
      setSelectedIndex(Math.max(0, items.length - 1));
    }
  }, [items.length, selectedIndex]);

  const effectiveItems = useMemo(
    () =>
      items.map((i, idx) => {
        const key = i.id ?? `idx-${idx}`;
        return {
          ...i,
          id: i.id ?? key,
          treatment: i.treatment ?? "",
          product: overrideProduct[key] !== undefined ? overrideProduct[key] : i.product,
          region: overrideRegion[key] !== undefined ? overrideRegion[key] : i.region,
          timeline: overrideTimeline[key] !== undefined ? overrideTimeline[key] : i.timeline,
          quantity: overrides[key] !== undefined ? overrides[key] : i.quantity,
        };
      }),
    [items, overrides, overrideRegion, overrideTimeline, overrideProduct]
  );

  const getSkincareProductInfo = useMemo((): ((productName: string) => SkincareProductInfo | null) => {
    return (productName: string) => {
      const found = matchSkincareProduct(productName, carouselItems);
      if (!found) return null;
      const priceStr = found.price;
      const price = priceStr
        ? parseFloat(priceStr.replace(/[$,]/g, ""))
        : undefined;
      const displayPrice =
        price != null && Number.isFinite(price)
          ? `$${Math.round(price)}`
          : (priceStr?.trim() ?? "See boutique");
      return {
        price: Number.isFinite(price) ? price : undefined,
        displayPrice,
        imageUrl: found.imageUrl,
        productLabel: found.name,
        description: found.description,
      };
    };
  }, [carouselItems]);

  const { lineItems } = getCheckoutSummaryWithSkus(
    effectiveItems,
    (item) => getCheckoutDisplayName(item as DiscussedItem),
    getSkincareProductInfo
  );

  /** Indices into items/effectiveItems/lineItems for left-panel sections */
  const { skincareIndices, treatmentIndices, wishlistIndices } = useMemo(() => {
    const skincare: number[] = [];
    const treatment: number[] = [];
    const wishlist: number[] = [];
    effectiveItems.forEach((eff, idx) => {
      const isWishlist = (eff.timeline ?? "").trim().toLowerCase() === "wishlist";
      if (isWishlist) {
        wishlist.push(idx);
      } else if ((eff.treatment ?? "").trim() === "Skincare") {
        skincare.push(idx);
      } else {
        treatment.push(idx);
      }
    });
    return { skincareIndices: skincare, treatmentIndices: treatment, wishlistIndices: wishlist };
  }, [effectiveItems]);

  /** Subtotals and total exclude wishlist (same as quote sheet) */
  const { skincareSubtotal, treatmentsSubtotal } = useMemo(() => {
    let skincare = 0;
    let treatments = 0;
    skincareIndices.forEach((idx) => {
      skincare += lineItems[idx]?.price ?? 0;
    });
    treatmentIndices.forEach((idx) => {
      treatments += lineItems[idx]?.price ?? 0;
    });
    return { skincareSubtotal: skincare, treatmentsSubtotal: treatments };
  }, [skincareIndices, treatmentIndices, lineItems]);

  /** Quote sheet: only non-wishlist items and their total */
  const quoteData = useMemo(() => {
    const activeIndices = [...skincareIndices, ...treatmentIndices];
    const quoteLineItems = activeIndices.map((idx) => lineItems[idx]).filter(Boolean);
    const quoteTotal = quoteLineItems.reduce((sum, l) => sum + (l?.price ?? 0), 0);
    const quoteHasUnknown = quoteLineItems.some((l) => l?.displayPrice === "Price varies" || (l?.price === 0 && l?.isEstimate));
    return { lineItems: quoteLineItems, total: quoteTotal, hasUnknownPrices: quoteHasUnknown };
  }, [skincareIndices, treatmentIndices, lineItems]);

  const prevQuoteKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!onCheckoutDataChange) return;
    const key = `${quoteData.total}-${quoteData.hasUnknownPrices}-${quoteData.lineItems.length}-${quoteData.lineItems.map((l) => `${l.skuName ?? l.label}:${l.displayPrice}`).join(",")}`;
    if (key === prevQuoteKeyRef.current) return;
    prevQuoteKeyRef.current = key;
    onCheckoutDataChange(quoteData);
  }, [onCheckoutDataChange, quoteData]);

  const totalBlock = (
    <div className="treatment-plan-checkout-summary">
      {skincareSubtotal > 0 && (
        <div className="treatment-plan-checkout-subtotal">
          <span className="treatment-plan-checkout-subtotal-label">Skincare Total</span>
          <span className="treatment-plan-checkout-subtotal-value">{formatPrice(skincareSubtotal)}</span>
        </div>
      )}
      {treatmentsSubtotal > 0 && (
        <div className="treatment-plan-checkout-subtotal">
          <span className="treatment-plan-checkout-subtotal-label">Treatments Total</span>
          <span className="treatment-plan-checkout-subtotal-value">{formatPrice(treatmentsSubtotal)}</span>
        </div>
      )}
      <div className="treatment-plan-checkout-total">
        <span className="treatment-plan-checkout-total-label">
          {quoteData.hasUnknownPrices ? "Estimated total" : "Total"}
        </span>
        <span className="treatment-plan-checkout-total-value">
          {quoteData.hasUnknownPrices && quoteData.total === 0 ? "—" : formatPrice(quoteData.total)}
        </span>
      </div>
    </div>
  );

  /** List label for left panel: treatment/product; add region only for non-skincare (no post-divider skincare product/region text). */
  const getListLabel = (eff: DiscussedItem) => {
    const base = getCheckoutDisplayName(eff as DiscussedItem);
    const isSkincare = (eff.treatment ?? "").trim() === "Skincare";
    if (isSkincare) return base;
    const region = (eff.region ?? "").trim();
    return region ? `${base} • ${region}` : base;
  };

  const selectedItem = selectedIndex != null && selectedIndex >= 0 && selectedIndex < items.length ? effectiveItems[selectedIndex] : null;
  const selectedLine = selectedIndex != null && selectedIndex >= 0 && selectedIndex < lineItems.length ? lineItems[selectedIndex] : null;
  const selectedKey = selectedItem?.id ?? (selectedIndex != null ? `idx-${selectedIndex}` : null);

  const renderRow = (idx: number) => {
    const line = lineItems[idx];
    const eff = effectiveItems[idx];
    const key = eff?.id ?? `idx-${idx}`;
    const isSkincare = (eff?.treatment ?? "").trim() === "Skincare";
    const photoUrl =
      isSkincare && getPhotoForItem && eff ? getPhotoForItem(eff) : isSkincare ? line?.photoUrl ?? null : null;
    const handleRemove = (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemoveItem?.(eff as DiscussedItem, idx);
    };
    return (
      <li key={key} className="treatment-plan-checkout-row-wrap">
        <button
          type="button"
          className={`treatment-plan-checkout-row ${selectedIndex === idx ? "treatment-plan-checkout-row--selected" : ""}`}
          onClick={() => setSelectedIndex(idx)}
        >
          {photoUrl ? (
            <div className="treatment-plan-checkout-row-thumb" aria-hidden>
              <img src={photoUrl} alt="" loading="lazy" />
            </div>
          ) : null}
          <div className="treatment-plan-checkout-row-body">
            <span className="treatment-plan-checkout-row-label">{getListLabel(eff)}</span>
            {!isSkincare && eff?.timeline && eff.timeline.toLowerCase() !== "wishlist" && (
              <span className="treatment-plan-checkout-row-meta">{eff.timeline}</span>
            )}
          </div>
          <span className="treatment-plan-checkout-row-price">{line.displayPrice}</span>
        </button>
        {onRemoveItem && (
          <button
            type="button"
            className="treatment-plan-checkout-row-remove"
            onClick={handleRemove}
            aria-label="Remove from plan"
            title="Remove from plan"
          >
            ×
          </button>
        )}
      </li>
    );
  };

  return (
    <>
      <div className="treatment-plan-checkout-modal-two-panel">
        <div className="treatment-plan-checkout-modal-left">
          <div className="treatment-plan-checkout-modal-left-list">
            {skincareIndices.length > 0 && (
              <div className="treatment-plan-checkout-left-section">
                <h4 className="treatment-plan-checkout-left-section-title">Skincare</h4>
                <ul className="treatment-plan-checkout-left-section-list" role="list">
                  {skincareIndices.map(renderRow)}
                </ul>
              </div>
            )}
            {treatmentIndices.length > 0 && (
              <div className="treatment-plan-checkout-left-section">
                <h4 className="treatment-plan-checkout-left-section-title">Treatments</h4>
                <ul className="treatment-plan-checkout-left-section-list" role="list">
                  {treatmentIndices.map(renderRow)}
                </ul>
              </div>
            )}
            {wishlistIndices.length > 0 && (
              <div className="treatment-plan-checkout-left-section treatment-plan-checkout-left-section--wishlist">
                <h4 className="treatment-plan-checkout-left-section-title">Wishlist</h4>
                <ul className="treatment-plan-checkout-left-section-list" role="list">
                  {wishlistIndices.map(renderRow)}
                </ul>
              </div>
            )}
          </div>
        </div>
        <div className="treatment-plan-checkout-modal-right">
          {selectedItem == null || selectedLine == null || selectedKey == null ? (
            <div className="treatment-plan-checkout-modal-right-empty">
              Select an item from the list to edit details and see price options.
            </div>
          ) : (
            <div className="treatment-plan-checkout-modal-right-inner">
              <CheckoutDetailPanel
                line={selectedLine}
                item={selectedItem}
                itemKey={selectedKey}
                quantityValue={selectedItem.quantity ?? ""}
                quantityOptions={getQuantityOptionsForCheckout(selectedItem.treatment)}
                onQuantityChange={(value) => setOverrides((prev) => ({ ...prev, [selectedKey]: value }))}
                onRegionChange={(value) => setOverrideRegion((prev) => ({ ...prev, [selectedKey]: value }))}
                onTimelineChange={(value) => setOverrideTimeline((prev) => ({ ...prev, [selectedKey]: value }))}
                onProductChange={(value) => setOverrideProduct((prev) => ({ ...prev, [selectedKey]: value }))}
                getRecommendedForSkincare={getRecommendedForSkincare}
              />
            </div>
          )}
        </div>
      </div>
      {!totalSlotEl && totalBlock}
      {totalSlotEl && createPortal(totalBlock, totalSlotEl)}
    </>
  );
}

/** Right-panel detail: What (read-only or Type select), Where, When, Quantity; then price */
function CheckoutDetailPanel({
  line,
  item,
  itemKey,
  quantityValue,
  quantityOptions,
  onQuantityChange,
  onRegionChange,
  onTimelineChange,
  onProductChange,
  getRecommendedForSkincare,
}: {
  line: CheckoutLineItemDetail;
  item: DiscussedItem;
  itemKey: string;
  quantityValue: string;
  quantityOptions: { label: string; options: string[] } | null;
  onQuantityChange: (value: string) => void;
  onRegionChange: (value: string) => void;
  onTimelineChange: (value: string) => void;
  onProductChange: (value: string) => void;
  getRecommendedForSkincare: (productName: string) => string;
}) {
  const isSkincare = (item.treatment ?? "").trim() === "Skincare";
  const recommendedFor = isSkincare ? getRecommendedForSkincare(item?.product ?? line.label ?? "") : null;
  const treatmentKey = (item.treatment ?? "").trim();
  const typeOptions = CHECKOUT_TREATMENT_TYPE_OPTIONS[treatmentKey];
  const showTypeSelect = !isSkincare && typeOptions && typeOptions.length > 0;
  const regionOptions = getRegionOptionsForTreatment(item.treatment ?? "");

  return (
    <section className="treatment-plan-checkout" aria-label="Item details">
      <h3 className="treatment-plan-checkout-title">Details & price</h3>
      <div className="treatment-plan-checkout-detail-section">
        <span className="treatment-plan-checkout-detail-label">What</span>
        {showTypeSelect ? (
          <select
            id={`checkout-type-${itemKey}`}
            className="treatment-plan-checkout-detail-select"
            value={getDisplayProductForTypeSelect(item.product, typeOptions) || ""}
            onChange={(e) => onProductChange(e.target.value)}
          >
            <option value="">— Select type —</option>
            {typeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : (
          <p className="treatment-plan-checkout-detail-value">
            {getCheckoutDisplayName(item as DiscussedItem)}
            {item.product && item.treatment !== "Skincare" && ` · ${item.product}`}
          </p>
        )}
      </div>
      {!isSkincare && (
        <div className="treatment-plan-checkout-detail-section">
          <label htmlFor={`checkout-where-${itemKey}`} className="treatment-plan-checkout-detail-label">
            Where
          </label>
          <select
            id={`checkout-where-${itemKey}`}
            className="treatment-plan-checkout-detail-select"
            value={getDisplayRegionForCheckout(item.region, regionOptions) || ""}
            onChange={(e) => onRegionChange(e.target.value)}
          >
            <option value="">—</option>
            {regionOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      )}
      {!isSkincare && (
        <div className="treatment-plan-checkout-detail-section">
          <label htmlFor={`checkout-when-${itemKey}`} className="treatment-plan-checkout-detail-label">
            When
          </label>
          <select
            id={`checkout-when-${itemKey}`}
            className="treatment-plan-checkout-detail-select"
            value={(item.timeline ?? "").trim() || ""}
            onChange={(e) => onTimelineChange(e.target.value)}
          >
            <option value="">—</option>
            {TIMELINE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      )}
      {quantityOptions != null && (
        <div className="treatment-plan-checkout-detail-section">
          <span className="treatment-plan-checkout-detail-label">{quantityOptions.label}</span>
          {quantityOptions.label.includes("Units") && (
            <div className="treatment-plan-checkout-units-stepper" role="group" aria-label="Adjust units by one">
              <button
                type="button"
                className="treatment-plan-checkout-units-stepper-btn"
                onClick={() => {
                  const n = Math.max(0, (parseInt(quantityValue ?? "", 10) || 0) - 1);
                  onQuantityChange(n > 0 ? String(n) : "");
                }}
                aria-label="Decrease by 1"
              >
                −
              </button>
              <span className="treatment-plan-checkout-units-stepper-value" aria-live="polite">
                {quantityValue && /^\d+$/.test(quantityValue) ? quantityValue : "—"}
              </span>
              <button
                type="button"
                className="treatment-plan-checkout-units-stepper-btn"
                onClick={() => {
                  const n = (parseInt(quantityValue ?? "", 10) || 0) + 1;
                  onQuantityChange(String(n));
                }}
                aria-label="Increase by 1"
              >
                +
              </button>
            </div>
          )}
          <div className="treatment-plan-checkout-card-quantity-chips" role="group" style={{ marginTop: 6 }}>
            {!quantityOptions.label.includes("Units") && (
              <button
                type="button"
                onClick={() => onQuantityChange("")}
                className={`treatment-plan-checkout-card-quantity-chip${(quantityValue ?? "") === "" ? " treatment-plan-checkout-card-quantity-chip--selected" : ""}`}
                aria-pressed={(quantityValue ?? "") === ""}
              >
                —
              </button>
            )}
            {quantityOptions.options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onQuantityChange(opt)}
                className={`treatment-plan-checkout-card-quantity-chip${(quantityValue ?? "") === opt ? " treatment-plan-checkout-card-quantity-chip--selected" : ""}`}
                aria-pressed={(quantityValue ?? "") === opt}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="treatment-plan-checkout-detail-section">
        <span className="treatment-plan-checkout-detail-label">Price</span>
        <p className="treatment-plan-checkout-detail-value" style={{ fontWeight: 600, color: "var(--theme-accent, #6366f1)" }}>
          {line.displayPrice}
          {line.isEstimate && " (estimate)"}
        </p>
      </div>
      {line.skuName && line.skuName !== line.label && (
        <p className="treatment-plan-checkout-card-sku" style={{ marginTop: 8 }}>
          {line.skuName}
          {line.skuNote && <span className="treatment-plan-checkout-card-sku-note"> ({line.skuNote})</span>}
        </p>
      )}
      {isSkincare && line.description && (
        <p className="treatment-plan-checkout-card-description" style={{ marginTop: 8 }}>{line.description}</p>
      )}
      {recommendedFor != null && (
        <p className="treatment-plan-checkout-card-issues" style={{ marginTop: 6 }}>
          <span className="treatment-plan-checkout-card-issues-label">Recommended for:</span> {recommendedFor}
        </p>
      )}
    </section>
  );
}
