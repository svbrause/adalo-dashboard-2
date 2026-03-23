// Checkout screen – separate modal showing treatment plan price summary (2025 pricing)

import { useState, useEffect, useCallback, useMemo } from "react";
import type { Client, DiscussedItem } from "../../types";
import {
  fetchTreatmentPhotos,
  sendSMSNotification,
  type AirtableRecord,
} from "../../services/api";
import { getSkincareCarouselItems } from "./DiscussedTreatmentsModal/constants";
import TreatmentPlanCheckout from "./DiscussedTreatmentsModal/TreatmentPlanCheckout";
import type { CheckoutLineItemDetail } from "../../data/treatmentPricing2025";
import { formatPrice } from "../../data/treatmentPricing2025";
import { useDashboard } from "../../context/DashboardContext";
import { cleanPhoneNumber, formatPhoneDisplay, isValidPhone } from "../../utils/validation";
import {
  isPostVisitBlueprintSender,
  THE_TREATMENT_BOOKING_URL,
} from "../../utils/providerHelpers";
import { showError, showToast } from "../../utils/toast";
import {
  createAndStorePostVisitBlueprint,
  trackPostVisitBlueprintEvent,
  warmPostVisitBlueprintForSend,
} from "../../utils/postVisitBlueprint";
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
  client,
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
  const [sendingBlueprint, setSendingBlueprint] = useState(false);
  const [lastBlueprintLink, setLastBlueprintLink] = useState<string | null>(null);
  const [showBlueprintComposer, setShowBlueprintComposer] = useState(false);
  const [blueprintMessageDraft, setBlueprintMessageDraft] = useState("");
  /** Editable SMS recipient; prefilled from patient record when opening composer. */
  const [blueprintRecipientPhone, setBlueprintRecipientPhone] = useState("");
  const [pendingBlueprintLink, setPendingBlueprintLink] = useState<string | null>(null);
  const [pendingBlueprintToken, setPendingBlueprintToken] = useState<string | null>(null);
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

  /** Hero photo fetch + AI narrative (slow) — start early when quote is ready so "Send blueprint" feels fast */
  const discussedItemIdsKey = useMemo(
    () => items.map((i) => i.id).sort().join(","),
    [items],
  );
  useEffect(() => {
    if (!client || !isPostVisitBlueprintSender(provider)) return;
    if (!quoteData || quoteData.lineItems.length === 0) return;
    if (!discussedItemIdsKey) return;
    warmPostVisitBlueprintForSend(client, items);
  }, [
    client,
    discussedItemIdsKey,
    items,
    provider,
    quoteData?.lineItems?.length,
  ]);

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

  const clinicName = useMemo(() => {
    const raw = (provider?.name ?? "").trim();
    if (!raw) return "your clinic";
    return raw.split(",")[0]?.trim() || raw;
  }, [provider?.name]);

  const providerPhone = useMemo(() => {
    const candidate = [
      provider?.["Phone Number"],
      provider?.["Phone"],
      provider?.phone,
      provider?.["Office Phone"],
      provider?.["Text Phone"],
    ].find((value) => String(value ?? "").trim());
    const cleaned = cleanPhoneNumber(
      typeof candidate === "number" || typeof candidate === "string"
        ? candidate
        : null,
    );
    return cleaned || undefined;
  }, [provider]);

  const financingUrl = useMemo(() => {
    const val = String(
      provider?.["Financing Link"] ??
        provider?.["Financing URL"] ??
        provider?.["CareCredit Link"] ??
        provider?.["Cherry Link"] ??
        "",
    ).trim();
    return val || "https://www.carecredit.com";
  }, [provider]);

  const handleOpenBlueprintComposer = useCallback(async () => {
    if (!isPostVisitBlueprintSender(provider)) {
      showError(
        "Post-Visit Blueprint is only available for The Treatment Skin Boutique and Admin.",
      );
      return;
    }
    if (!client) {
      showError("Could not send blueprint: missing patient context.");
      return;
    }
    const formattedPhone = formatPhoneDisplay(client.phone);
    if (!isValidPhone(formattedPhone)) {
      showError("A valid patient phone number is required to send the blueprint.");
      return;
    }
    if (!quoteData || quoteData.lineItems.length === 0) {
      showError("Add at least one priced treatment before sending the blueprint.");
      return;
    }
    try {
      const totalAfterDiscount =
        isMintMember && quoteData.total > 0
          ? quoteData.total - quoteData.total * 0.1
          : quoteData.total;
      const { token, link } = await createAndStorePostVisitBlueprint({
        clinicName,
        providerName: (provider?.name ?? "").trim() || "Your provider",
        providerCode: provider?.code,
        providerPhone,
        client,
        discussedItems: items,
        quote: {
          lineItems: quoteData.lineItems,
          total: quoteData.total,
          totalAfterDiscount,
          hasUnknownPrices: quoteData.hasUnknownPrices,
          isMintMember,
        },
        cta: {
          bookingUrl: THE_TREATMENT_BOOKING_URL,
          financingUrl,
          textProviderPhone: providerPhone,
        },
      });
      setPendingBlueprintLink(link);
      setPendingBlueprintToken(token);
      setBlueprintRecipientPhone(formatPhoneDisplay(client.phone) || "");
      setBlueprintMessageDraft(
        `Hi ${firstName}, your custom treatment blueprint from ${clinicName} is ready. Review your plan here: ${link}`,
      );
      setShowBlueprintComposer(true);
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Failed to prepare blueprint message.",
      );
    }
  }, [
    client,
    clinicName,
    financingUrl,
    firstName,
    isMintMember,
    items,
    provider,
    provider?.name,
    providerPhone,
    quoteData,
  ]);

  const handleConfirmSendBlueprint = useCallback(async () => {
    if (!client) return;
    if (!pendingBlueprintLink || !pendingBlueprintToken) {
      showError("Blueprint link is missing. Please try again.");
      return;
    }
    if (!blueprintMessageDraft.trim()) {
      showError("Please enter a message before sending.");
      return;
    }
    const formattedPhone = formatPhoneDisplay(client.phone);
    if (!isValidPhone(formattedPhone)) {
      showError("A valid patient phone number is required to send the blueprint.");
      return;
    }

    setSendingBlueprint(true);
    try {
      await sendSMSNotification(
        cleanPhoneNumber(client.phone),
        blueprintMessageDraft.trim(),
        client.name,
      );
      setLastBlueprintLink(pendingBlueprintLink);
      trackPostVisitBlueprintEvent("blueprint_delivered", {
        token: pendingBlueprintToken,
        clinic_name: clinicName,
        provider_name: provider?.name ?? "",
        patient_id: client.id,
      });
      setShowBlueprintComposer(false);
      setPendingBlueprintLink(null);
      setPendingBlueprintToken(null);
      showToast(`Post-Visit Blueprint sent to ${firstName}`);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to send blueprint.");
    } finally {
      setSendingBlueprint(false);
    }
  }, [
    blueprintMessageDraft,
    blueprintRecipientPhone,
    client,
    clinicName,
    firstName,
    pendingBlueprintLink,
    pendingBlueprintToken,
    provider?.name,
  ]);

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
            {lastBlueprintLink && (
              <p className="treatment-plan-checkout-modal-blueprint-sent">
                Blueprint sent.
                <button
                  type="button"
                  className="treatment-plan-checkout-modal-link-btn"
                  onClick={() => navigator.clipboard.writeText(lastBlueprintLink)}
                >
                  Copy link
                </button>
              </p>
            )}
          </div>
          <div className="treatment-plan-checkout-modal-header-actions">
            {client && isPostVisitBlueprintSender(provider) && (
              <button
                type="button"
                className="treatment-plan-checkout-send-blueprint-btn"
                onClick={handleOpenBlueprintComposer}
                disabled={
                  sendingBlueprint ||
                  !quoteData ||
                  quoteData.lineItems.length === 0
                }
              >
                {sendingBlueprint ? "Sending..." : "Send Post-Visit Blueprint"}
              </button>
            )}
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
              isMintMember={isMintMember}
              onMintMemberChange={setIsMintMember}
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
              {isMintMember && quoteData.total > 0 && (
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
                        isMintMember && quoteData.total > 0
                          ? quoteData.total - quoteData.total * 0.1
                          : quoteData.total,
                      )}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBlueprintComposer && (
        <div
          className="treatment-plan-checkout-blueprint-compose-overlay"
          onClick={() => !sendingBlueprint && setShowBlueprintComposer(false)}
        >
          <div
            className="treatment-plan-checkout-blueprint-compose-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Edit Post-Visit Blueprint message</h3>
            <p>
              Review the recipient number and message before sending to {firstName}. The
              blueprint link is already included in the text below.
            </p>
            <label className="treatment-plan-checkout-blueprint-compose-label" htmlFor="pvb-sms-recipient-phone">
              Recipient phone
            </label>
            <input
              id="pvb-sms-recipient-phone"
              type="tel"
              autoComplete="tel"
              className="treatment-plan-checkout-blueprint-compose-phone"
              placeholder="(555) 555-5555"
              value={blueprintRecipientPhone}
              onChange={(e) => setBlueprintRecipientPhone(e.target.value)}
            />
            <label className="treatment-plan-checkout-blueprint-compose-label treatment-plan-checkout-blueprint-compose-label--textarea" htmlFor="pvb-sms-message-body">
              Message
            </label>
            <textarea
              id="pvb-sms-message-body"
              className="treatment-plan-checkout-blueprint-compose-textarea"
              value={blueprintMessageDraft}
              onChange={(e) => setBlueprintMessageDraft(e.target.value)}
              rows={6}
            />
            <div className="treatment-plan-checkout-blueprint-compose-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowBlueprintComposer(false)}
                disabled={sendingBlueprint}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleConfirmSendBlueprint}
                disabled={
                  sendingBlueprint ||
                  !blueprintMessageDraft.trim() ||
                  !isValidPhone(formatPhoneDisplay(blueprintRecipientPhone))
                }
              >
                {sendingBlueprint ? "Sending..." : "Send message"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
