// Treatment plan checkout – two-panel: list left, expandable detail right (What / Where / When / Quantity); price reflects options

import { useMemo, useEffect, useState, useRef } from "react";
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
  getCheckoutTreatmentTypeOptionsForProvider,
  CHECKOUT_REGION_OPTIONS_BROAD,
  CHEMICAL_PEEL_AREA_OPTIONS,
  TREATMENTS_WITH_BROAD_REGION,
  TREATMENTS_WITH_NO_REGION,
} from "./constants";
import { REGION_OPTIONS, TIMELINE_OPTIONS } from "./constants";
import {
  getWellnestOfferingByTreatmentName,
  isWellnestWellnessProviderCode,
} from "../../../data/wellnestOfferings";
import { RECOMMENDED_PRODUCT_REASONS } from "../../../data/skinTypeQuiz";
import { MintMembershipInfoTrigger } from "../../shared/MintMembershipInfoTrigger";

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
  /** When provided, move-to-wishlist / move-to-now links are shown; called with index and partial item. */
  onUpdateItem?: (index: number, patch: Partial<DiscussedItem>) => void;
  /** When true, order summary shows Mint member 10% off and discounted total. */
  isMintMember?: boolean;
  onMintMemberChange?: (value: boolean) => void;
  /** When set (e.g. TheTreatment250), treatment type options are restricted to those in the pricing sheet. */
  providerCode?: string;
}

function matchSkincareProduct(
  productName: string,
  carouselItems: {
    name: string;
    imageUrl?: string;
    price?: string;
    description?: string;
  }[],
): {
  name: string;
  imageUrl?: string;
  price?: string;
  description?: string;
} | null {
  const q = (productName ?? "").trim().toLowerCase();
  if (!q) return null;
  const exact = carouselItems.find((p) => p.name.trim().toLowerCase() === q);
  if (exact) return exact;
  const contains = carouselItems.find(
    (p) =>
      p.name.trim().toLowerCase().includes(q) ||
      q.includes(p.name.trim().toLowerCase()),
  );
  return contains ?? null;
}

/** Options for quantity/sessions select by treatment type (same as elsewhere in app). Pass product for Biostimulants so unit pre-fills: Radiesse → Syringes, Sculptra → Vials. */
function getQuantityOptionsForCheckout(
  treatment: string | undefined,
  product?: string,
): { label: string; options: string[] } | null {
  const t = (treatment ?? "").trim();
  if (t === "Skincare") return null;
  const result = getQuantityContext(treatment ?? "", product);
  return { label: result.unitLabel, options: result.options };
}

/** Options for Where dropdown: broad (Face/Neck/Chest) or specific (Forehead, etc.). Empty for treatments with no region (e.g. Chemical Peel = full face only). */
function getRegionOptionsForTreatment(treatment: string): readonly string[] {
  const t = (treatment ?? "").trim();
  if (getWellnestOfferingByTreatmentName(t)) return [];
  if (TREATMENTS_WITH_NO_REGION.includes(t as (typeof TREATMENTS_WITH_NO_REGION)[number])) {
    return [];
  }
  if (t === "Chemical Peel") return CHEMICAL_PEEL_AREA_OPTIONS;
  return TREATMENTS_WITH_BROAD_REGION.includes(
    t as (typeof TREATMENTS_WITH_BROAD_REGION)[number],
  )
    ? CHECKOUT_REGION_OPTIONS_BROAD
    : REGION_OPTIONS;
}

/** First region that appears in the given options list (recommender may send "Forehead, Cheeks" or "Face, Neck & Chest"). */
function getDisplayRegionForCheckout(
  region: string | null | undefined,
  options: readonly string[],
): string {
  const r = (region ?? "").trim();
  if (!r) return "";
  const optList = [...options];
  if (optList.includes(r)) return r;
  const lower = r.toLowerCase();
  if (
    optList.includes("Face") &&
    (lower.includes("face") ||
      lower.includes("forehead") ||
      lower.includes("full face"))
  )
    return "Face";
  if (optList.includes("Neck") && lower.includes("neck")) return "Neck";
  if (optList.includes("Chest") && lower.includes("chest")) return "Chest";
  const parts = r
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const found = parts.find((p) => optList.includes(p));
  return found ?? parts[0] ?? "";
}

/** First type option that appears in the product string (recommender may send "Moxi, BBL" for laser). */
function getDisplayProductForTypeSelect(
  product: string | null | undefined,
  typeOptions: string[],
): string {
  const p = (product ?? "").trim();
  if (!p || !typeOptions?.length) return "";
  if (typeOptions.includes(p)) return p;
  const parts = p
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const found = parts.find((part) =>
    typeOptions.some(
      (opt) => opt === part || opt.includes(part) || part.includes(opt),
    ),
  );
  if (found)
    return (
      typeOptions.find(
        (opt) => opt === found || opt.includes(found) || found.includes(opt),
      ) ?? found
    );
  const firstOptInProduct = typeOptions.find(
    (opt) => p.includes(opt) || opt.includes(parts[0]),
  );
  return firstOptInProduct ?? "";
}

/** "Recommended for" label for a skincare product (matches skincare recommendations screen). */
function getRecommendedForSkincare(productName: string): string {
  const key = (productName ?? "").trim();
  if (!key) return "redness and sensitivity";
  const exact = RECOMMENDED_PRODUCT_REASONS[key];
  if (exact) return exact;
  const lower = key.toLowerCase();
  const entry = Object.entries(RECOMMENDED_PRODUCT_REASONS).find(
    ([k]) =>
      k.trim().toLowerCase().includes(lower) ||
      lower.includes(k.trim().toLowerCase()),
  );
  return entry ? entry[1] : "redness and sensitivity";
}

export default function TreatmentPlanCheckout({
  items,
  getPhotoForItem,
  totalSlotId: _totalSlotId,
  onCheckoutDataChange,
  onRemoveItem,
  onUpdateItem,
  isMintMember = false,
  onMintMemberChange,
  providerCode,
}: TreatmentPlanCheckoutProps) {
  const checkoutTypeOptions = useMemo(
    () => getCheckoutTreatmentTypeOptionsForProvider(providerCode),
    [providerCode],
  );
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [overrideRegion, setOverrideRegion] = useState<Record<string, string>>(
    {},
  );
  const [overrideTimeline, setOverrideTimeline] = useState<
    Record<string, string>
  >({});
  const [overrideProduct, setOverrideProduct] = useState<
    Record<string, string>
  >({});
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{
    item: DiscussedItem;
    index: number;
    label: string;
  } | null>(null);
  const carouselItems = useMemo(() => getSkincareCarouselItems(), []);

  useEffect(() => {
    if (items.length === 0) {
      setEditingIndex(null);
      return;
    }
    if (editingIndex !== null && editingIndex >= items.length) {
      setEditingIndex(Math.max(0, items.length - 1));
    }
  }, [items.length, editingIndex]);

  const effectiveItems = useMemo(
    () =>
      items.map((i, idx) => {
        const key = i.id ?? `idx-${idx}`;
        return {
          ...i,
          id: i.id ?? key,
          treatment: i.treatment ?? "",
          product:
            overrideProduct[key] !== undefined
              ? overrideProduct[key]
              : i.product,
          region:
            overrideRegion[key] !== undefined ? overrideRegion[key] : i.region,
          timeline:
            overrideTimeline[key] !== undefined
              ? overrideTimeline[key]
              : i.timeline,
          quantity: overrides[key] !== undefined ? overrides[key] : i.quantity,
        };
      }),
    [items, overrides, overrideRegion, overrideTimeline, overrideProduct],
  );

  const getSkincareProductInfo = useMemo((): ((
    productName: string,
  ) => SkincareProductInfo | null) => {
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
    getSkincareProductInfo,
  );

  /** Indices into items/effectiveItems/lineItems for left-panel sections */
  const { skincareIndices, treatmentIndices, wishlistIndices } = useMemo(() => {
    const skincare: number[] = [];
    const treatment: number[] = [];
    const wishlist: number[] = [];
    effectiveItems.forEach((eff, idx) => {
      const isWishlist =
        (eff.timeline ?? "").trim().toLowerCase() === "wishlist";
      if (isWishlist) {
        wishlist.push(idx);
      } else if (lineItems[idx]?.quoteLineKind === "skincare") {
        skincare.push(idx);
      } else {
        treatment.push(idx);
      }
    });
    return {
      skincareIndices: skincare,
      treatmentIndices: treatment,
      wishlistIndices: wishlist,
    };
  }, [effectiveItems, lineItems]);

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
    const quoteLineItems = activeIndices
      .map((idx) => lineItems[idx])
      .filter(Boolean);
    const quoteTotal = quoteLineItems.reduce(
      (sum, l) => sum + (l?.price ?? 0),
      0,
    );
    const quoteHasUnknown = quoteLineItems.some(
      (l) =>
        l?.displayPrice === "Price varies" || (l?.price === 0 && l?.isEstimate),
    );
    return {
      lineItems: quoteLineItems,
      total: quoteTotal,
      hasUnknownPrices: quoteHasUnknown,
    };
  }, [skincareIndices, treatmentIndices, lineItems]);

  const prevQuoteKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!onCheckoutDataChange) return;
    const key = `${quoteData.total}-${quoteData.hasUnknownPrices}-${quoteData.lineItems.length}-${quoteData.lineItems.map((l) => `${l.skuName ?? l.label}:${l.displayPrice}`).join(",")}`;
    if (key === prevQuoteKeyRef.current) return;
    prevQuoteKeyRef.current = key;
    onCheckoutDataChange(quoteData);
  }, [onCheckoutDataChange, quoteData]);

  if (items.length === 0) return null;

  const allowMintMembership = !isWellnestWellnessProviderCode(providerCode);
  const effectiveMintMember = allowMintMembership ? isMintMember : false;
  const subtotal = quoteData.total;
  const mintDiscount = effectiveMintMember && subtotal > 0 ? subtotal * 0.1 : 0;
  const totalAfterMint = subtotal - mintDiscount;

  const orderSummaryBlock = (
    <div className="treatment-plan-checkout-summary treatment-plan-checkout-order-summary">
      {allowMintMembership && onMintMemberChange && (
        <label className="treatment-plan-checkout-mint-toggle">
          <input
            type="checkbox"
            checked={effectiveMintMember}
            onChange={(e) => onMintMemberChange(e.target.checked)}
          />
          <span className="treatment-plan-checkout-mint-toggle-label">
            <span>Mint member</span>
            <MintMembershipInfoTrigger zIndex={12000} />
          </span>
        </label>
      )}
      {skincareSubtotal > 0 && (
        <div className="treatment-plan-checkout-subtotal">
          <span className="treatment-plan-checkout-subtotal-label">
            Skincare Total
          </span>
          <span className="treatment-plan-checkout-subtotal-value">
            {formatPrice(skincareSubtotal)}
          </span>
        </div>
      )}
      {treatmentsSubtotal > 0 && (
        <div className="treatment-plan-checkout-subtotal">
          <span className="treatment-plan-checkout-subtotal-label">
            Treatments Total
          </span>
          <span className="treatment-plan-checkout-subtotal-value">
            {formatPrice(treatmentsSubtotal)}
          </span>
        </div>
      )}
      {mintDiscount > 0 && (
        <div className="treatment-plan-checkout-subtotal treatment-plan-checkout-mint-line">
          <span className="treatment-plan-checkout-subtotal-label">
            Mint member 10% off
          </span>
          <span className="treatment-plan-checkout-subtotal-value">
            −{formatPrice(mintDiscount)}
          </span>
        </div>
      )}
      <div className="treatment-plan-checkout-total">
        <span className="treatment-plan-checkout-total-label">
          {quoteData.hasUnknownPrices ? "Estimated total" : "Total"}
        </span>
        <span className="treatment-plan-checkout-total-value">
          {quoteData.hasUnknownPrices && quoteData.total === 0
            ? "—"
            : formatPrice(totalAfterMint)}
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

  const editingItem =
    editingIndex != null && editingIndex >= 0 && editingIndex < items.length
      ? effectiveItems[editingIndex]
      : null;
  const editingLine =
    editingIndex != null && editingIndex >= 0 && editingIndex < lineItems.length
      ? lineItems[editingIndex]
      : null;
  const editingKey =
    editingItem?.id ?? (editingIndex != null ? `idx-${editingIndex}` : null);
  const isWishlist = (idx: number) => wishlistIndices.includes(idx);

  const renderRow = (idx: number) => {
    const line = lineItems[idx];
    const eff = effectiveItems[idx];
    const key = eff?.id ?? `idx-${idx}`;
    const isSkincare = (eff?.treatment ?? "").trim() === "Skincare";
    const inWishlist = isWishlist(idx);
    const photoUrl =
      isSkincare && getPhotoForItem && eff
        ? getPhotoForItem(eff)
        : isSkincare
          ? (line?.photoUrl ?? null)
          : null;
    const handleRemoveClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!onRemoveItem) return;
      setConfirmRemove({
        item: eff as DiscussedItem,
        index: idx,
        label: getListLabel(eff as DiscussedItem) || "this item",
      });
    };
    const handleMoveToWishlist = (e: React.MouseEvent) => {
      e.stopPropagation();
      onUpdateItem?.(idx, { timeline: "Wishlist" });
    };
    const handleMoveToNow = (e: React.MouseEvent) => {
      e.stopPropagation();
      onUpdateItem?.(idx, { timeline: "Add next visit" });
    };
    const showInlineEdit = editingIndex === idx;
    return (
      <li key={key} className="treatment-plan-checkout-row-wrap">
        <div className="treatment-plan-checkout-row-top">
          <div
            className={`treatment-plan-checkout-row ${showInlineEdit ? "treatment-plan-checkout-row--selected" : ""}`}
          >
            {photoUrl ? (
              <div className="treatment-plan-checkout-row-thumb" aria-hidden>
                <img src={photoUrl} alt="" loading="lazy" />
              </div>
            ) : null}
            <div className="treatment-plan-checkout-row-body">
              <span className="treatment-plan-checkout-row-label">
                {getListLabel(eff)}
              </span>
              <div className="treatment-plan-checkout-row-actions">
                {onUpdateItem && !inWishlist && (
                  <button
                    type="button"
                    className="treatment-plan-checkout-row-link"
                    onClick={handleMoveToWishlist}
                  >
                    Move to wishlist
                  </button>
                )}
                {onUpdateItem && inWishlist && (
                  <button
                    type="button"
                    className="treatment-plan-checkout-row-link"
                    onClick={handleMoveToNow}
                  >
                    Add to plan
                  </button>
                )}
                <button
                  type="button"
                  className="treatment-plan-checkout-row-edit"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingIndex(showInlineEdit ? null : idx);
                  }}
                >
                  Edit
                </button>
              </div>
            </div>
            <span className="treatment-plan-checkout-row-price">
              {line.displayPrice}
            </span>
          </div>
          {onRemoveItem && (
            <button
              type="button"
              className="treatment-plan-checkout-row-remove"
              onClick={handleRemoveClick}
              aria-label="Remove from plan"
              title="Remove from plan"
            >
              ×
            </button>
          )}
        </div>
        {showInlineEdit && editingItem && editingLine && editingKey && (
          <div className="treatment-plan-checkout-inline-edit">
            <CheckoutDetailPanel
              line={editingLine}
              item={editingItem}
              itemKey={editingKey}
              quantityValue={
                overrides[editingKey] ?? editingItem.quantity ?? ""
              }
              quantityOptions={getQuantityOptionsForCheckout(
                editingItem.treatment,
                editingItem.product ?? undefined,
              )}
              checkoutTypeOptions={checkoutTypeOptions}
              onQuantityChange={(value) =>
                setOverrides((prev) => ({ ...prev, [editingKey]: value }))
              }
              onRegionChange={(value) =>
                setOverrideRegion((prev) => ({ ...prev, [editingKey]: value }))
              }
              onTimelineChange={(value) =>
                setOverrideTimeline((prev) => ({
                  ...prev,
                  [editingKey]: value,
                }))
              }
              onProductChange={(value) =>
                setOverrideProduct((prev) => ({ ...prev, [editingKey]: value }))
              }
              getRecommendedForSkincare={getRecommendedForSkincare}
              whenOneClick
              onMoveToWishlist={() => {
                onUpdateItem?.(idx, { timeline: "Wishlist" });
                setEditingIndex(null);
              }}
              onMoveToNow={() => {
                onUpdateItem?.(idx, { timeline: "Add next visit" });
                setEditingIndex(null);
              }}
              variant="add-form"
              onDone={() => setEditingIndex(null)}
              onCancel={() => {
                setOverrides((prev) => {
                  const next = { ...prev };
                  delete next[editingKey];
                  return next;
                });
                setOverrideRegion((prev) => {
                  const next = { ...prev };
                  delete next[editingKey];
                  return next;
                });
                setOverrideTimeline((prev) => {
                  const next = { ...prev };
                  delete next[editingKey];
                  return next;
                });
                setOverrideProduct((prev) => {
                  const next = { ...prev };
                  delete next[editingKey];
                  return next;
                });
                setEditingIndex(null);
              }}
            />
          </div>
        )}
      </li>
    );
  };

  return (
    <>
      <div className="treatment-plan-checkout-modal-two-panel">
        <div className="treatment-plan-checkout-modal-left">
          <div className="treatment-plan-checkout-modal-left-list">
            {/* Main cart: Skincare + Treatments */}
            {(skincareIndices.length > 0 || treatmentIndices.length > 0) && (
              <div className="treatment-plan-checkout-main-cart">
                <h3 className="treatment-plan-checkout-plan-heading">
                  Treatment plan
                </h3>
                {skincareIndices.length > 0 && (
                  <div className="treatment-plan-checkout-left-section">
                    <h4 className="treatment-plan-checkout-left-section-title">
                      Skincare
                    </h4>
                    <ul
                      className="treatment-plan-checkout-left-section-list"
                      role="list"
                    >
                      {skincareIndices.map(renderRow)}
                    </ul>
                  </div>
                )}
                {treatmentIndices.length > 0 && (
                  <div className="treatment-plan-checkout-left-section">
                    <h4 className="treatment-plan-checkout-left-section-title">
                      Treatments
                    </h4>
                    <ul
                      className="treatment-plan-checkout-left-section-list"
                      role="list"
                    >
                      {treatmentIndices.map(renderRow)}
                    </ul>
                  </div>
                )}
              </div>
            )}
            {/* Big gap then Wishlist (Save for later style) */}
            {wishlistIndices.length > 0 && (
              <div className="treatment-plan-checkout-left-section treatment-plan-checkout-wishlist-section">
                <h4 className="treatment-plan-checkout-left-section-title">
                  Wishlist
                </h4>
                <ul
                  className="treatment-plan-checkout-left-section-list"
                  role="list"
                >
                  {wishlistIndices.map(renderRow)}
                </ul>
              </div>
            )}
          </div>
        </div>
        <div className="treatment-plan-checkout-modal-right">
          <div className="treatment-plan-checkout-modal-right-inner treatment-plan-checkout-order-summary-wrap">
            <h3 className="treatment-plan-checkout-order-summary-title">
              Order summary
            </h3>
            {orderSummaryBlock}
          </div>
        </div>
      </div>
      {confirmRemove && (
        <div
          className="treatment-plan-checkout-confirm-overlay"
          role="dialog"
          aria-labelledby="treatment-plan-checkout-confirm-title"
          aria-modal="true"
        >
          <div className="treatment-plan-checkout-confirm-card">
            <h3
              id="treatment-plan-checkout-confirm-title"
              className="treatment-plan-checkout-confirm-title"
            >
              Remove from plan?
            </h3>
            <p className="treatment-plan-checkout-confirm-message">
              Remove &quot;{confirmRemove.label}&quot; from the treatment plan?
            </p>
            <div className="treatment-plan-checkout-confirm-actions">
              <button
                type="button"
                className="treatment-plan-checkout-confirm-cancel"
                onClick={() => setConfirmRemove(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="treatment-plan-checkout-confirm-remove"
                onClick={() => {
                  onRemoveItem?.(confirmRemove.item, confirmRemove.index);
                  setConfirmRemove(null);
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Right-panel or inline detail: What, Where, When, Quantity; then price.
 * When variant="add-form" (inline edit), uses same row/chip layout as treatment recommender Add to plan. */
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
  whenOneClick,
  onMoveToWishlist,
  onMoveToNow,
  variant = "panel",
  onDone,
  onCancel,
  checkoutTypeOptions,
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
  whenOneClick?: boolean;
  onMoveToWishlist?: () => void;
  onMoveToNow?: () => void;
  variant?: "panel" | "add-form";
  onDone?: () => void;
  onCancel?: () => void;
  checkoutTypeOptions: Record<string, string[]>;
}) {
  const isSkincare = (item.treatment ?? "").trim() === "Skincare";
  const recommendedFor = isSkincare
    ? getRecommendedForSkincare(item?.product ?? line.label ?? "")
    : null;
  const treatmentKey = (item.treatment ?? "").trim();
  const typeOptions = checkoutTypeOptions[treatmentKey];
  const showTypeSelect = !isSkincare && typeOptions && typeOptions.length > 0;
  const regionOptions = getRegionOptionsForTreatment(item.treatment ?? "");

  const isAddForm = variant === "add-form";

  if (isAddForm) {
    return (
      <div
        className="treatment-recommender-by-treatment__add-form"
        aria-label="Edit item"
      >
        {/* Energy Device: Type chips only (no Where). */}
        {treatmentKey === "Energy Device" && showTypeSelect && (
          <div className="treatment-recommender-by-treatment__add-row">
            <span className="treatment-recommender-by-treatment__add-row-label">
              Type:
            </span>
            <div className="treatment-recommender-by-treatment__chips">
              {typeOptions.map((opt) => {
                const currentWhat =
                  getDisplayProductForTypeSelect(item.product, typeOptions) || "";
                const selected = currentWhat === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    className={`treatment-recommender-by-treatment__chip${selected ? " treatment-recommender-by-treatment__chip--selected" : ""}`}
                    onClick={() => onProductChange(opt)}
                    title={selected ? `Selected: ${opt}` : `Select ${opt}`}
                    aria-label={selected ? `Selected: ${opt}` : `Select ${opt}`}
                  >
                    <span className="treatment-recommender-by-treatment__chip-label">
                      {opt}
                    </span>
                    {selected && (
                      <span
                        className="treatment-recommender-by-treatment__chip-remove"
                        aria-hidden
                      >
                        ×
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {/* Biostimulants: "Where" (area) then "Type", like Filler/Neurotoxin. */}
        {treatmentKey === "Biostimulants" && !isSkincare && (
          <>
            {regionOptions.length > 0 && (
              <div className="treatment-recommender-by-treatment__add-row">
                <span className="treatment-recommender-by-treatment__add-row-label">
                  Where:
                </span>
                <div className="treatment-recommender-by-treatment__chips">
                  {regionOptions.map((r) => {
                    const currentWhere =
                      getDisplayRegionForCheckout(item.region, regionOptions) || "";
                    const selected = currentWhere === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        className={`treatment-recommender-by-treatment__chip${selected ? " treatment-recommender-by-treatment__chip--selected" : ""}`}
                        onClick={() => onRegionChange(r)}
                        title={selected ? `Selected: ${r}` : `Select ${r}`}
                        aria-label={selected ? `Selected: ${r}` : `Select ${r}`}
                      >
                        <span className="treatment-recommender-by-treatment__chip-label">
                          {r}
                        </span>
                        {selected && (
                          <span
                            className="treatment-recommender-by-treatment__chip-remove"
                            aria-hidden
                          >
                            ×
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {showTypeSelect && (
              <div className="treatment-recommender-by-treatment__add-row">
                <span className="treatment-recommender-by-treatment__add-row-label">
                  Type:
                </span>
                <div className="treatment-recommender-by-treatment__chips">
                  {typeOptions.map((opt) => {
                    const currentWhat =
                      getDisplayProductForTypeSelect(item.product, typeOptions) || "";
                    const selected = currentWhat === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        className={`treatment-recommender-by-treatment__chip${selected ? " treatment-recommender-by-treatment__chip--selected" : ""}`}
                        onClick={() => onProductChange(opt)}
                        title={selected ? `Selected: ${opt}` : `Select ${opt}`}
                        aria-label={selected ? `Selected: ${opt}` : `Select ${opt}`}
                      >
                        <span className="treatment-recommender-by-treatment__chip-label">
                          {opt}
                        </span>
                        {selected && (
                          <span
                            className="treatment-recommender-by-treatment__chip-remove"
                            aria-hidden
                          >
                            ×
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
        {/* Microneedling: "Where" (region) then "Type" chips, like recommender */}
        {treatmentKey === "Microneedling" && !isSkincare && (
          <>
            <div className="treatment-recommender-by-treatment__add-row">
              <span className="treatment-recommender-by-treatment__add-row-label">
                Where:
              </span>
              <div className="treatment-recommender-by-treatment__chips">
                {regionOptions.map((r) => {
                  const currentWhere =
                    getDisplayRegionForCheckout(item.region, regionOptions) || "";
                  const selected = currentWhere === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      className={`treatment-recommender-by-treatment__chip${selected ? " treatment-recommender-by-treatment__chip--selected" : ""}`}
                      onClick={() => onRegionChange(r)}
                      title={selected ? `Selected: ${r}` : `Select ${r}`}
                      aria-label={selected ? `Selected: ${r}` : `Select ${r}`}
                    >
                      <span className="treatment-recommender-by-treatment__chip-label">
                        {r}
                      </span>
                      {selected && (
                        <span
                          className="treatment-recommender-by-treatment__chip-remove"
                          aria-hidden
                        >
                          ×
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="treatment-recommender-by-treatment__add-row">
              <span className="treatment-recommender-by-treatment__add-row-label">
                Type:
              </span>
              <div className="treatment-recommender-by-treatment__chips">
                {typeOptions.map((opt) => {
                  const currentWhat =
                    getDisplayProductForTypeSelect(item.product, typeOptions) || "";
                  const selected = currentWhat === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      className={`treatment-recommender-by-treatment__chip${selected ? " treatment-recommender-by-treatment__chip--selected" : ""}`}
                      onClick={() => onProductChange(opt)}
                      title={selected ? `Selected: ${opt}` : `Select ${opt}`}
                      aria-label={selected ? `Selected: ${opt}` : `Select ${opt}`}
                    >
                      <span className="treatment-recommender-by-treatment__chip-label">
                        {opt}
                      </span>
                      {selected && (
                        <span
                          className="treatment-recommender-by-treatment__chip-remove"
                          aria-hidden
                        >
                          ×
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
        {/* Other treatments: "Where" (region) chips when options exist; optional "What" (type) if type options exist */}
        {!isSkincare &&
          treatmentKey !== "Energy Device" &&
          treatmentKey !== "Biostimulants" &&
          treatmentKey !== "Microneedling" && (
            <>
              {regionOptions.length > 0 && (
              <div className="treatment-recommender-by-treatment__add-row">
                <span className="treatment-recommender-by-treatment__add-row-label">
                  Where:
                </span>
                <div className="treatment-recommender-by-treatment__chips">
                  {regionOptions.map((r) => {
                    const currentWhere =
                      getDisplayRegionForCheckout(item.region, regionOptions) || "";
                    const selected = currentWhere === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        className={`treatment-recommender-by-treatment__chip${selected ? " treatment-recommender-by-treatment__chip--selected" : ""}`}
                        onClick={() => onRegionChange(r)}
                        title={selected ? `Selected: ${r}` : `Select ${r}`}
                        aria-label={selected ? `Selected: ${r}` : `Select ${r}`}
                      >
                        <span className="treatment-recommender-by-treatment__chip-label">
                          {r}
                        </span>
                        {selected && (
                          <span
                            className="treatment-recommender-by-treatment__chip-remove"
                            aria-hidden
                          >
                            ×
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              )}
              {showTypeSelect && (
                <div className="treatment-recommender-by-treatment__add-row">
                  <span className="treatment-recommender-by-treatment__add-row-label">
                    Type:
                  </span>
                  <div className="treatment-recommender-by-treatment__chips">
                    {typeOptions.map((opt) => {
                      const currentWhat =
                        getDisplayProductForTypeSelect(item.product, typeOptions) || "";
                      const selected = currentWhat === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          className={`treatment-recommender-by-treatment__chip${selected ? " treatment-recommender-by-treatment__chip--selected" : ""}`}
                          onClick={() => onProductChange(opt)}
                          title={selected ? `Selected: ${opt}` : `Select ${opt}`}
                          aria-label={selected ? `Selected: ${opt}` : `Select ${opt}`}
                        >
                          <span className="treatment-recommender-by-treatment__chip-label">
                            {opt}
                          </span>
                          {selected && (
                            <span
                              className="treatment-recommender-by-treatment__chip-remove"
                              aria-hidden
                            >
                              ×
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        {/* Skincare or no type/region: read-only label */}
        {isSkincare && (
          <div className="treatment-recommender-by-treatment__add-row">
            <span className="treatment-recommender-by-treatment__add-row-label">
                    Type:
            </span>
            <span
              style={{
                fontSize: "0.875rem",
                color: "var(--theme-text-primary, #212121)",
              }}
            >
              {getCheckoutDisplayName(item as DiscussedItem)}
              {item.product &&
                item.treatment === "Skincare" &&
                ` · ${item.product}`}
            </span>
          </div>
        )}
        {quantityOptions != null && (
          <div className="treatment-recommender-by-treatment__add-row">
            <span>{quantityOptions.label}:</span>
            <div className="treatment-recommender-by-treatment__chips">
              {!quantityOptions.label.includes("Units") && (
                <button
                  type="button"
                  className={`treatment-recommender-by-treatment__chip${(quantityValue ?? "") === "" ? " treatment-recommender-by-treatment__chip--selected" : ""}`}
                  onClick={() => onQuantityChange("")}
                >
                  <span className="treatment-recommender-by-treatment__chip-label">
                    —
                  </span>
                </button>
              )}
              {quantityOptions.label.includes("Units") && (
                <div
                  className="treatment-plan-checkout-units-stepper"
                  style={{ margin: 0 }}
                >
                  <button
                    type="button"
                    className="treatment-plan-checkout-units-stepper-btn"
                    onClick={() => {
                      const n = Math.max(
                        0,
                        (parseInt(quantityValue ?? "", 10) || 0) - 1,
                      );
                      onQuantityChange(n > 0 ? String(n) : "");
                    }}
                    aria-label="Decrease by 1"
                  >
                    −
                  </button>
                  <span
                    className="treatment-plan-checkout-units-stepper-value"
                    aria-live="polite"
                  >
                    {quantityValue && /^\d+$/.test(quantityValue)
                      ? quantityValue
                      : "—"}
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
              {!quantityOptions.label.includes("Units") &&
                quantityOptions.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={`treatment-recommender-by-treatment__chip${(quantityValue ?? "") === opt ? " treatment-recommender-by-treatment__chip--selected" : ""}`}
                    onClick={() => onQuantityChange(opt)}
                  >
                    <span className="treatment-recommender-by-treatment__chip-label">
                      {opt}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        )}
        <div className="treatment-recommender-by-treatment__add-row">
          <span>Price:</span>
          <span
            style={{ fontWeight: 600, color: "var(--theme-accent, #0d9488)" }}
          >
            {line.displayPrice}
            {line.isEstimate ? " (estimate)" : ""}
          </span>
        </div>
        {onDone != null && onCancel != null && (
          <div className="treatment-recommender-by-treatment__add-actions">
            <button
              type="button"
              className="treatment-recommender-by-treatment__add-btn"
              onClick={onDone}
            >
              Done
            </button>
            <button
              type="button"
              className="treatment-recommender-by-treatment__cancel-btn"
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="treatment-plan-checkout" aria-label="Item details">
      <h3 className="treatment-plan-checkout-title">Details & price</h3>
      <div className="treatment-plan-checkout-detail-section">
        <span className="treatment-plan-checkout-detail-label">What</span>
        {showTypeSelect ? (
          <select
            id={`checkout-type-${itemKey}`}
            className="treatment-plan-checkout-detail-select"
            value={
              getDisplayProductForTypeSelect(item.product, typeOptions) || ""
            }
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
            {item.product &&
              item.treatment !== "Skincare" &&
              ` · ${item.product}`}
          </p>
        )}
      </div>
      {!isSkincare && regionOptions.length > 0 && (
        <div className="treatment-plan-checkout-detail-section">
          <label
            htmlFor={`checkout-where-${itemKey}`}
            className="treatment-plan-checkout-detail-label"
          >
            Where
          </label>
          <select
            id={`checkout-where-${itemKey}`}
            className="treatment-plan-checkout-detail-select"
            value={
              getDisplayRegionForCheckout(item.region, regionOptions) || ""
            }
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
          <span className="treatment-plan-checkout-detail-label">When</span>
          {whenOneClick && onMoveToWishlist && onMoveToNow ? (
            <div className="treatment-plan-checkout-when-one-click">
              <button
                type="button"
                className="treatment-plan-checkout-when-btn"
                onClick={onMoveToWishlist}
              >
                Move to wishlist
              </button>
              <button
                type="button"
                className="treatment-plan-checkout-when-btn"
                onClick={onMoveToNow}
              >
                Add to plan
              </button>
            </div>
          ) : (
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
          )}
        </div>
      )}
      {quantityOptions != null && (
        <div className="treatment-plan-checkout-detail-section">
          <span className="treatment-plan-checkout-detail-label">
            {quantityOptions.label}
          </span>
          {quantityOptions.label.includes("Units") && (
            <div
              className="treatment-plan-checkout-units-stepper"
              role="group"
              aria-label="Adjust units by one"
            >
              <button
                type="button"
                className="treatment-plan-checkout-units-stepper-btn"
                onClick={() => {
                  const n = Math.max(
                    0,
                    (parseInt(quantityValue ?? "", 10) || 0) - 1,
                  );
                  onQuantityChange(n > 0 ? String(n) : "");
                }}
                aria-label="Decrease by 1"
              >
                −
              </button>
              <span
                className="treatment-plan-checkout-units-stepper-value"
                aria-live="polite"
              >
                {quantityValue && /^\d+$/.test(quantityValue)
                  ? quantityValue
                  : "—"}
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
          <div
            className="treatment-plan-checkout-card-quantity-chips"
            role="group"
            style={{ marginTop: 6 }}
          >
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
        <p
          className="treatment-plan-checkout-detail-value"
          style={{ fontWeight: 600, color: "var(--theme-accent, #6366f1)" }}
        >
          {line.displayPrice}
          {line.isEstimate && " (estimate)"}
        </p>
      </div>
      {line.skuName && line.skuName !== line.label && (
        <p
          className="treatment-plan-checkout-card-sku"
          style={{ marginTop: 8 }}
        >
          {line.skuName}
          {line.skuNote && (
            <span className="treatment-plan-checkout-card-sku-note">
              {" "}
              ({line.skuNote})
            </span>
          )}
        </p>
      )}
      {isSkincare && line.description && (
        <p
          className="treatment-plan-checkout-card-description"
          style={{ marginTop: 8 }}
        >
          {line.description}
        </p>
      )}
      {recommendedFor != null && (
        <p
          className="treatment-plan-checkout-card-issues"
          style={{ marginTop: 6 }}
        >
          <span className="treatment-plan-checkout-card-issues-label">
            Recommended for:
          </span>{" "}
          {recommendedFor}
        </p>
      )}
    </section>
  );
}

function matchSkincareProductForQuote(
  productName: string,
  carouselItems: {
    name: string;
    imageUrl?: string;
    price?: string;
    description?: string;
  }[],
): {
  name: string;
  imageUrl?: string;
  price?: string;
  description?: string;
} | null {
  const q = (productName ?? "").trim().toLowerCase();
  if (!q) return null;
  const exact = carouselItems.find((p) => p.name.trim().toLowerCase() === q);
  if (exact) return exact;
  const contains = carouselItems.find(
    (p) =>
      p.name.trim().toLowerCase().includes(q) ||
      q.includes(p.name.trim().toLowerCase()),
  );
  return contains ?? null;
}

/**
 * Quote line items and total for non-wishlist rows — matches the checkout "quote" payload
 * (no per-row UI overrides; uses stored plan fields only).
 */
export function computeQuoteSheetDataForDiscussedItems(
  items: DiscussedItem[],
): {
  lineItems: CheckoutLineItemDetail[];
  total: number;
  hasUnknownPrices: boolean;
} | null {
  if (items.length === 0) return null;
  const carouselItems = getSkincareCarouselItems();
  const getSkincareProductInfo = (productName: string): SkincareProductInfo | null => {
    const found = matchSkincareProductForQuote(productName, carouselItems);
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
  const { lineItems } = getCheckoutSummaryWithSkus(
    items,
    (item) => getCheckoutDisplayName(item as DiscussedItem),
    getSkincareProductInfo,
  );
  const skincareIndices: number[] = [];
  const treatmentIndices: number[] = [];
  items.forEach((eff, idx) => {
    const isWishlist =
      (eff.timeline ?? "").trim().toLowerCase() === "wishlist";
    if (isWishlist) return;
    if (lineItems[idx]?.quoteLineKind === "skincare") skincareIndices.push(idx);
    else treatmentIndices.push(idx);
  });
  const activeIndices = [...skincareIndices, ...treatmentIndices];
  const quoteLineItems = activeIndices
    .map((idx) => lineItems[idx])
    .filter(Boolean) as CheckoutLineItemDetail[];
  const quoteTotal = quoteLineItems.reduce(
    (sum, l) => sum + (l?.price ?? 0),
    0,
  );
  const quoteHasUnknown = quoteLineItems.some(
    (l) =>
      l?.displayPrice === "Price varies" || (l?.price === 0 && l?.isEstimate),
  );
  return {
    lineItems: quoteLineItems,
    total: quoteTotal,
    hasUnknownPrices: quoteHasUnknown,
  };
}
