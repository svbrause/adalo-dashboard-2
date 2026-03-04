// Treatment plan checkout – SKU-level pricing, longevity, recovery, sessions

import { useMemo, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { DiscussedItem } from "../../../types";
import {
  getCheckoutSummaryWithSkus,
  formatPrice,
  getAddOnOptions,
  type CheckoutLineItemDetail,
  type SkincareProductInfo,
} from "../../../data/treatmentPricing2025";
import { getCheckoutDisplayName, getQuantityContext } from "./utils";
import { getSkincareCarouselItems } from "./constants";
import { RECOMMENDED_PRODUCT_REASONS } from "../../../data/skinTypeQuiz";

export interface TreatmentPlanCheckoutProps {
  items: DiscussedItem[];
  /** Optional: return a photo URL for the treatment/product to show on the card (used when no boutique/sku image) */
  getPhotoForItem?: (item: DiscussedItem) => string | null;
  /** When set (e.g. modal), render the total into this DOM id instead of inline (bottom bar) */
  totalSlotId?: string;
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
  const [selectedAddOns, setSelectedAddOns] = useState<Set<string>>(new Set());
  const carouselItems = useMemo(() => getSkincareCarouselItems(), []);
  const addOnOptions = useMemo(() => getAddOnOptions(), []);

  const effectiveItems = useMemo(
    () =>
      items.map((i, idx) => {
        const key = i.id ?? `idx-${idx}`;
        return {
          ...i,
          id: i.id ?? key,
          treatment: i.treatment ?? "",
          product: i.product,
          region: i.region,
          quantity: overrides[key] !== undefined ? overrides[key] : i.quantity,
        };
      }),
    [items, overrides]
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

  const { lineItems, total, hasUnknownPrices } = getCheckoutSummaryWithSkus(
    effectiveItems,
    (item) => getCheckoutDisplayName(item as DiscussedItem),
    getSkincareProductInfo
  );

  const { skincareSubtotal, treatmentsSubtotal } = useMemo(() => {
    let skincare = 0;
    let treatments = 0;
    effectiveItems.forEach((item, idx) => {
      const price = lineItems[idx]?.price ?? 0;
      if (item.treatment === "Skincare") skincare += price;
      else treatments += price;
    });
    return { skincareSubtotal: skincare, treatmentsSubtotal: treatments };
  }, [effectiveItems, lineItems]);

  const addOnsSubtotal = useMemo(() => {
    let sum = 0;
    addOnOptions.forEach((opt) => {
      if (selectedAddOns.has(opt.name)) sum += opt.price;
    });
    return sum;
  }, [addOnOptions, selectedAddOns]);

  const grandTotal = total + addOnsSubtotal;

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
      {addOnsSubtotal > 0 && (
        <div className="treatment-plan-checkout-subtotal">
          <span className="treatment-plan-checkout-subtotal-label">Add-ons Total</span>
          <span className="treatment-plan-checkout-subtotal-value">{formatPrice(addOnsSubtotal)}</span>
        </div>
      )}
      <div className="treatment-plan-checkout-total">
        <span className="treatment-plan-checkout-total-label">
          {hasUnknownPrices && addOnsSubtotal === 0 ? "Estimated total" : "Total"}
        </span>
        <span className="treatment-plan-checkout-total-value">
          {hasUnknownPrices && grandTotal === 0 ? "—" : formatPrice(grandTotal)}
        </span>
      </div>
    </div>
  );

  const toggleAddOn = (name: string) => {
    setSelectedAddOns((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <>
      <section
        className="treatment-plan-checkout"
        aria-label="Treatment plan price summary"
      >
        <h3 className="treatment-plan-checkout-title">Price & details</h3>
        <ul className="treatment-plan-checkout-list">
          {lineItems.map((line: CheckoutLineItemDetail, idx: number) => {
            const it = items[idx];
            const key = it?.id ?? `idx-${idx}`;
            return (
            <CheckoutCard
              key={key}
              line={line}
              item={it}
              quantityFieldId={key}
              quantityValue={effectiveItems[idx]?.quantity ?? ""}
              quantityOptions={getQuantityOptionsForCheckout(it?.treatment)}
              onQuantityChange={(value) => setOverrides((prev) => ({ ...prev, [key]: value }))}
              photoUrl={
                it?.treatment === "Skincare" && it?.product
                  ? (line.photoUrl ?? (getPhotoForItem && it ? getPhotoForItem(it) ?? undefined : undefined))
                  : undefined
              }
            />
          );})}
        </ul>
        {addOnOptions.length > 0 && (
          <div className="treatment-plan-checkout-addons">
            <h4 className="treatment-plan-checkout-addons-title">Add-ons</h4>
            <ul className="treatment-plan-checkout-addons-list" role="list">
              {addOnOptions.map((opt) => (
                <li key={opt.name} className="treatment-plan-checkout-addons-item">
                  <label className="treatment-plan-checkout-addons-label">
                    <input
                      type="checkbox"
                      checked={selectedAddOns.has(opt.name)}
                      onChange={() => toggleAddOn(opt.name)}
                      className="treatment-plan-checkout-addons-checkbox"
                      aria-label={`Add ${opt.name}, ${formatPrice(opt.price)}`}
                    />
                    <span className="treatment-plan-checkout-addons-name">{opt.name}</span>
                    {opt.note && (
                      <span className="treatment-plan-checkout-addons-note"> ({opt.note})</span>
                    )}
                    <span className="treatment-plan-checkout-addons-price">{formatPrice(opt.price)}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!totalSlotEl && totalBlock}
      </section>
      {totalSlotEl && createPortal(totalBlock, totalSlotEl)}
    </>
  );
}

function CheckoutCard({
  line,
  item,
  photoUrl,
  quantityValue,
  quantityOptions,
  onQuantityChange,
}: {
  line: CheckoutLineItemDetail;
  item?: DiscussedItem;
  photoUrl?: string;
  quantityFieldId?: string;
  quantityValue?: string;
  quantityOptions?: { label: string; options: string[] } | null;
  onQuantityChange?: (value: string) => void;
}) {
  const isSkincareProduct = Boolean(line.description || (item?.treatment === "Skincare" && item?.product));
  const recommendedFor = isSkincareProduct
    ? getRecommendedForSkincare(item?.product ?? line.label ?? "")
    : null;
  const hasMeta = !isSkincareProduct && (line.longevity || line.downtime || line.sessions);
  const showQuantitySelect = quantityOptions != null && onQuantityChange != null;

  return (
    <li className="treatment-plan-checkout-card">
      <div className="treatment-plan-checkout-card-inner">
        {isSkincareProduct && (
          <div className="treatment-plan-checkout-card-visual">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt=""
                className="treatment-plan-checkout-card-photo"
              />
            ) : (
              <div className="treatment-plan-checkout-card-placeholder">
                <span className="treatment-plan-checkout-card-placeholder-icon" aria-hidden="true">
                  ✦
                </span>
              </div>
            )}
          </div>
        )}
        <div className="treatment-plan-checkout-card-body">
          <div className="treatment-plan-checkout-card-header">
            <span className="treatment-plan-checkout-card-label">{line.label}</span>
            <span className="treatment-plan-checkout-card-price">{line.displayPrice}</span>
          </div>
          {showQuantitySelect && (
            <div className="treatment-plan-checkout-card-quantity-row">
              <span className="treatment-plan-checkout-card-quantity-label">
                {quantityOptions.label}
              </span>
              <div className="treatment-plan-checkout-card-quantity-chips" role="group" aria-label={`${quantityOptions.label} for ${line.label}`}>
                <button
                  type="button"
                  onClick={() => onQuantityChange("")}
                  className={`treatment-plan-checkout-card-quantity-chip${(quantityValue ?? "") === "" ? " treatment-plan-checkout-card-quantity-chip--selected" : ""}`}
                  aria-pressed={(quantityValue ?? "") === ""}
                >
                  —
                </button>
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
          {line.skuName && line.skuName !== line.label && (
            <p className="treatment-plan-checkout-card-sku">
              {line.skuName}
              {line.skuNote && (
                <span className="treatment-plan-checkout-card-sku-note">
                  {" "}({line.skuNote})
                </span>
              )}
              {line.isEstimate && (
                <span className="treatment-plan-checkout-card-estimate-badge"> Estimate</span>
              )}
            </p>
          )}
          {line.skuName === line.label && (line.skuNote || line.isEstimate) && (
            <p className="treatment-plan-checkout-card-sku">
              {line.skuNote && (
                <span className="treatment-plan-checkout-card-sku-note">{line.skuNote}</span>
              )}
              {line.isEstimate && (
                <span className="treatment-plan-checkout-card-estimate-badge">Boutique · price at checkout</span>
              )}
            </p>
          )}
          {isSkincareProduct && line.description && (
            <p className="treatment-plan-checkout-card-description">{line.description}</p>
          )}
          {recommendedFor != null && (
            <p className="treatment-plan-checkout-card-issues">
              <span className="treatment-plan-checkout-card-issues-label">
                Recommended for:
              </span>{" "}
              {recommendedFor}
            </p>
          )}
          {hasMeta && (
            <ul className="treatment-plan-checkout-card-meta" role="list">
              {line.longevity && (
                <li className="treatment-plan-checkout-card-meta-item">
                  <span className="treatment-plan-checkout-card-meta-icon" aria-hidden="true">
                    ◷
                  </span>
                  <span className="treatment-plan-checkout-card-meta-label">Longevity</span>
                  <span className="treatment-plan-checkout-card-meta-value">{line.longevity}</span>
                </li>
              )}
              {line.downtime && (
                <li className="treatment-plan-checkout-card-meta-item">
                  <span className="treatment-plan-checkout-card-meta-icon" aria-hidden="true">
                    ♡
                  </span>
                  <span className="treatment-plan-checkout-card-meta-label">Recovery</span>
                  <span className="treatment-plan-checkout-card-meta-value">{line.downtime}</span>
                </li>
              )}
              {line.sessions && (
                <li className="treatment-plan-checkout-card-meta-item">
                  <span className="treatment-plan-checkout-card-meta-icon" aria-hidden="true">
                    ◫
                  </span>
                  <span className="treatment-plan-checkout-card-meta-label">Sessions</span>
                  <span className="treatment-plan-checkout-card-meta-value">{line.sessions}</span>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}
