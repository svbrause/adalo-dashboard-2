// Share patient-facing treatment plan link (SMS) — item checkboxes + compose step

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Client, DiscussedItem } from "../../types";
import { useDashboard } from "../../context/DashboardContext";
import { notifyTreatmentPlanShareSent, sendSMSNotification } from "../../services/api";
import {
  formatProviderDisplayName,
  getPostVisitBlueprintBookingUrl,
  isPostVisitBlueprintSender,
} from "../../utils/providerHelpers";
import { showError, showToast } from "../../utils/toast";
import { resolveProviderFinancingUrl } from "../../utils/checkoutFinancingCopy";
import {
  cleanPhoneNumber,
  formatPhoneDisplay,
  isValidPhone,
} from "../../utils/validation";
import {
  createAndStorePostVisitBlueprint,
  defaultIncludeItemInSharedTreatmentPlanLink,
  filterDiscussedItemsForPostVisitBlueprint,
  isWishlistTimelineDiscussedItem as isWishlistTimelineItem,
  showPriceOnSharedTreatmentPlanLink,
  trackPostVisitBlueprintEvent,
  warmPostVisitBlueprintForSend,
} from "../../utils/postVisitBlueprint";
import { capturePatientAcquisitionFunnelEvent } from "../../utils/patientAcquisitionAnalytics";
import { formatPrice, getEffectivePriceList } from "../../data/treatmentPricing2025";
import { planPricingFixActionLabel } from "../../utils/planPricingWarnings";
import { buildShareLinkTreatmentGroups } from "../../utils/shareTreatmentPlanUi";
import {
  getTreatmentPlanRowPrimaryLabel,
  getTreatmentPlanRowSecondaryLabel,
  plannedForPatientLineFromDiscussedItem,
} from "./DiscussedTreatmentsModal/utils";
import {
  computeQuoteSheetDataForDiscussedItems,
  getAlignedCheckoutLineItemsForDiscussedItems,
  getDiscussedItemQuoteOrderRankById,
} from "./DiscussedTreatmentsModal/TreatmentPlanCheckout";
import "./TreatmentPlanCheckoutModal.css";
import "./ShareTreatmentPlanLinkModal.css";

export interface ShareTreatmentPlanLinkModalProps {
  client: Client;
  discussedItems: DiscussedItem[];
  onClose: () => void;
  onSuccess?: () => void;
  recommenderFocusRegions?: string[];
  /**
   * When set, rows with incomplete pricing show a button that calls this with the discussed item id.
   * Parent should close this modal and open the plan editor (plan builder or Discussed modal).
   */
  onNavigateToEditPlanItem?: (discussedItemId: string) => void;
  /**
   * When set, each shareable treatment row can move between **Wishlist** and the **treatment plan**
   * (single toggle; timeline defaults to “Add next visit” when moving into the plan).
   */
  onUpdateDiscussedItem?: (
    itemId: string,
    patch: Partial<DiscussedItem>,
  ) => void | Promise<void>;
}

function isSkincarePlanItem(item: DiscussedItem): boolean {
  return (item.treatment ?? "").trim() === "Skincare";
}

/** True when quote is fuzzy or any included plan row still lacks fields for exact pricing. */
function shareQuoteHasPricingGaps(
  discussedItems: DiscussedItem[],
  includedIds: ReadonlySet<string>,
  quoteHasUnknownPrices: boolean,
  priceList: Parameters<typeof getAlignedCheckoutLineItemsForDiscussedItems>[1],
): boolean {
  if (quoteHasUnknownPrices) return true;
  const aligned = getAlignedCheckoutLineItemsForDiscussedItems(
    discussedItems,
    priceList,
  );
  for (let i = 0; i < discussedItems.length; i++) {
    if (!includedIds.has(discussedItems[i]!.id)) continue;
    if (aligned[i]?.missingInfo) return true;
  }
  return false;
}

/** Per-line amount: show line total only (no unit math) when we have a numeric total. */
function shareRowPriceDisplay(
  line:
    | { price?: number; displayPrice?: string; isEstimate?: boolean; missingInfo?: string }
    | undefined,
): { text: string; warning?: string } {
  if (!line) return { text: formatPrice(0) };
  if (line.missingInfo) return { text: "Price varies", warning: line.missingInfo };
  if (line.displayPrice === "Price varies") return { text: "Price varies" };
  if (line.isEstimate && line.displayPrice?.trim()) {
    return { text: line.displayPrice.trim() };
  }
  if (line.price != null && line.price > 0) {
    return { text: formatPrice(line.price) };
  }
  if (line.displayPrice?.trim()) return { text: line.displayPrice.trim() };
  return { text: formatPrice(0) };
}

/** Parsed dollar amount from share-modal override field; `null` = use automatic line price. */
function parseSharePatientPriceOverride(raw: string | undefined): number | null {
  const t = (raw ?? "").trim().replace(/[$,]/g, "");
  if (!t) return null;
  const n = parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function shareRowPriceDisplayWithOverride(
  line: Parameters<typeof shareRowPriceDisplay>[0],
  overrideRaw: string | undefined,
): { text: string; warning?: string } {
  const parsed = parseSharePatientPriceOverride(overrideRaw);
  if (parsed !== null) {
    const base = shareRowPriceDisplay(line);
    return { text: formatPrice(parsed), warning: base.warning };
  }
  return shareRowPriceDisplay(line);
}

type ShareQuoteLine = Parameters<typeof shareRowPriceDisplay>[0];

/** Row price: read-only by default; “Edit prices” toggles inline inputs per row. */
function ShareQuoteRowPriceBlock({
  itemId,
  line,
  include,
  showPriceOnPatient,
  patientPriceOverrideRaw,
  setPatientPriceOverride,
  inlinePriceEditMode,
}: {
  itemId: string;
  line: ShareQuoteLine | undefined;
  include: boolean;
  showPriceOnPatient: boolean;
  patientPriceOverrideRaw: string | undefined;
  setPatientPriceOverride: (value: string) => void;
  inlinePriceEditMode: boolean;
}) {
  if (include && !showPriceOnPatient) {
    return (
      <strong className="share-tp-link-quote-row-patient-price-off">
        Not shown
      </strong>
    );
  }
  const automaticPriceText = shareRowPriceDisplay(line).text;
  const p = shareRowPriceDisplayWithOverride(line, patientPriceOverrideRaw);
  const inputId = `share-tp-patient-price-${itemId}`;

  if (inlinePriceEditMode && showPriceOnPatient) {
    return (
      <>
        <div className="share-tp-link-patient-price-inline-edit">
          <input
            id={inputId}
            type="text"
            inputMode="decimal"
            className="share-tp-link-patient-price-override-input share-tp-link-patient-price-override-input--inline"
            placeholder={automaticPriceText}
            title={`Leave blank to use ${automaticPriceText} (line total).`}
            autoComplete="off"
            value={patientPriceOverrideRaw ?? ""}
            onChange={(e) => setPatientPriceOverride(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
        {p.warning ? (
          <span className="share-tp-link-quote-row-missing">⚠ {p.warning}</span>
        ) : null}
      </>
    );
  }

  return (
    <>
      <div className="share-tp-link-patient-price-readonly">
        <strong>{p.text}</strong>
      </div>
      {p.warning ? (
        <span className="share-tp-link-quote-row-missing">⚠ {p.warning}</span>
      ) : null}
    </>
  );
}

export default function ShareTreatmentPlanLinkModal({
  client,
  discussedItems,
  onClose,
  onSuccess,
  recommenderFocusRegions,
  onNavigateToEditPlanItem,
  onUpdateDiscussedItem,
}: ShareTreatmentPlanLinkModalProps) {
  const { provider } = useDashboard();
  const effectivePriceList = useMemo(
    () =>
      getEffectivePriceList(
        provider?.["Treatment Pricing"] as string | undefined,
        provider?.code,
      ),
    [provider],
  );
  const firstName = client.name?.trim().split(/\s+/)[0] || "Patient";
  const clinicName = useMemo(() => {
    const branded = formatProviderDisplayName(provider?.name);
    return branded || "your clinic";
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

  const financingUrl = useMemo(
    () => resolveProviderFinancingUrl(provider),
    [provider],
  );

  const eligibleItems = useMemo(() => {
    const filtered = filterDiscussedItemsForPostVisitBlueprint(discussedItems);
    const rank = getDiscussedItemQuoteOrderRankById(
      discussedItems,
      effectivePriceList,
    );
    return [...filtered].sort(
      (a, b) => (rank.get(a.id) ?? 9999) - (rank.get(b.id) ?? 9999),
    );
  }, [discussedItems, effectivePriceList]);

  const discussedIndexByItemId = useMemo(() => {
    const m = new Map<string, number>();
    discussedItems.forEach((d, i) => m.set(d.id, i));
    return m;
  }, [discussedItems]);

  const checkoutLinesByDiscussedIndex = useMemo(
    () =>
      getAlignedCheckoutLineItemsForDiscussedItems(
        discussedItems,
        effectivePriceList,
      ),
    [discussedItems, effectivePriceList],
  );

  const { skincareShareItems, treatmentShareItems } = useMemo(() => {
    const skincare: DiscussedItem[] = [];
    const treatment: DiscussedItem[] = [];
    for (const item of eligibleItems) {
      const idx = discussedIndexByItemId.get(item.id);
      const line =
        idx !== undefined ? checkoutLinesByDiscussedIndex[idx] : undefined;
      if (line?.quoteLineKind === "skincare") skincare.push(item);
      else treatment.push(item);
    }
    return {
      skincareShareItems: skincare,
      treatmentShareItems: treatment,
    };
  }, [eligibleItems, discussedIndexByItemId, checkoutLinesByDiscussedIndex]);

  const treatmentTimelineGroups = useMemo(
    () => buildShareLinkTreatmentGroups(treatmentShareItems),
    [treatmentShareItems],
  );

  const lineForItem = useCallback(
    (item: DiscussedItem) => {
      const idx = discussedIndexByItemId.get(item.id);
      if (idx === undefined) return undefined;
      return checkoutLinesByDiscussedIndex[idx];
    },
    [discussedIndexByItemId, checkoutLinesByDiscussedIndex],
  );

  const eligibleIdsKey = useMemo(
    () => [...eligibleItems.map((i) => i.id)].sort().join(","),
    [eligibleItems],
  );

  const [inclusionById, setInclusionById] = useState<Record<string, boolean>>(
    {},
  );
  /** Optional per-line patient dollar amount (when sharing price); empty string = use automatic price. */
  const [patientPriceOverrideInputById, setPatientPriceOverrideInputById] =
    useState<Record<string, string>>({});
  const [inlinePatientPricesEditing, setInlinePatientPricesEditing] =
    useState(false);

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const item of eligibleItems) {
      next[item.id] = defaultIncludeItemInSharedTreatmentPlanLink(item);
    }
    setInclusionById(next);
  }, [eligibleIdsKey, eligibleItems]);

  useEffect(() => {
    setPatientPriceOverrideInputById((prev) => {
      const next: Record<string, string> = {};
      for (const item of eligibleItems) {
        next[item.id] = prev[item.id] ?? "";
      }
      return next;
    });
  }, [eligibleIdsKey, eligibleItems]);

  const includedSkincareSubtotal = useMemo(() => {
    return skincareShareItems.reduce((sum, item) => {
      if (!inclusionById[item.id]) return sum;
      const ov = parseSharePatientPriceOverride(
        patientPriceOverrideInputById[item.id],
      );
      const line = lineForItem(item);
      return sum + (ov ?? line?.price ?? 0);
    }, 0);
  }, [skincareShareItems, inclusionById, patientPriceOverrideInputById, lineForItem]);

  /** Now / next-visit lines only (matches patient-facing dollar total by default). */
  const includedTreatmentsExcludingWishlistSubtotal = useMemo(() => {
    return treatmentShareItems.reduce((sum, item) => {
      if (!inclusionById[item.id]) return sum;
      if (isWishlistTimelineItem(item)) return sum;
      const ov = parseSharePatientPriceOverride(
        patientPriceOverrideInputById[item.id],
      );
      const line = lineForItem(item);
      return sum + (ov ?? line?.price ?? 0);
    }, 0);
  }, [treatmentShareItems, inclusionById, patientPriceOverrideInputById, lineForItem]);

  const includedTreatmentsWishlistSubtotal = useMemo(() => {
    return treatmentShareItems.reduce((sum, item) => {
      if (!inclusionById[item.id]) return sum;
      if (!isWishlistTimelineItem(item)) return sum;
      const ov = parseSharePatientPriceOverride(
        patientPriceOverrideInputById[item.id],
      );
      const line = lineForItem(item);
      return sum + (ov ?? line?.price ?? 0);
    }, 0);
  }, [treatmentShareItems, inclusionById, patientPriceOverrideInputById, lineForItem]);

  const hasWishlistTreatmentRows = useMemo(
    () => treatmentShareItems.some((item) => isWishlistTimelineItem(item)),
    [treatmentShareItems],
  );

  const includedTotalExcludingWishlistPrices =
    includedSkincareSubtotal + includedTreatmentsExcludingWishlistSubtotal;

  /** Wishlist is never included in the footer total (toggle removed). */
  const pickStepTotalDisplay = includedTotalExcludingWishlistPrices;

  const [step, setStep] = useState<"pick" | "send">("pick");
  const [preparingLink, setPreparingLink] = useState(false);
  const [sending, setSending] = useState(false);
  /** Greeting set when the link is prepared; not user-editable (shown with link in read-only block). */
  const [blueprintMessageIntro, setBlueprintMessageIntro] = useState("");
  /** Optional text appended after the greeting + link in the SMS. */
  const [blueprintMessageAfterLink, setBlueprintMessageAfterLink] =
    useState("");
  const [blueprintRecipientPhone, setBlueprintRecipientPhone] = useState("");
  const [pendingBlueprintLink, setPendingBlueprintLink] = useState<
    string | null
  >(null);
  const [pendingBlueprintToken, setPendingBlueprintToken] = useState<
    string | null
  >(null);
  /** When true, SMS step uses one fully editable textarea (pricing gaps / estimates on the plan). */
  const [sharePricingImperfect, setSharePricingImperfect] = useState(false);
  const [blueprintSmsFullDraft, setBlueprintSmsFullDraft] = useState("");

  useEffect(() => {
    if (!isPostVisitBlueprintSender(provider)) return;
    warmPostVisitBlueprintForSend(client, discussedItems);
  }, [client, discussedItems, provider]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !preparingLink && !sending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, preparingLink, sending]);

  const toggleInclude = useCallback((id: string) => {
    setInclusionById((prev) => {
      const nextOn = !prev[id];
      if (!nextOn) {
        setPatientPriceOverrideInputById((ov) => ({ ...ov, [id]: "" }));
      }
      return { ...prev, [id]: nextOn };
    });
  }, []);

  const renderShareRowTimelineActions = useCallback(
    (item: DiscussedItem) => {
      if (!onUpdateDiscussedItem || isSkincarePlanItem(item)) return null;
      return (
        <div className="share-tp-link-quote-row-timeline-actions">
          {!isWishlistTimelineItem(item) ? (
            <button
              type="button"
              className="share-tp-link-timeline-action-btn"
              onClick={(e) => {
                e.preventDefault();
                void onUpdateDiscussedItem(item.id, { timeline: "Wishlist" });
              }}
            >
              Move to wishlist
            </button>
          ) : (
            <button
              type="button"
              className="share-tp-link-timeline-action-btn"
              onClick={(e) => {
                e.preventDefault();
                void onUpdateDiscussedItem(item.id, {
                  timeline: "Add next visit",
                });
              }}
            >
              Add to plan
            </button>
          )}
        </div>
      );
    },
    [onUpdateDiscussedItem],
  );

  const includedIdSet = useMemo(() => {
    const s = new Set<string>();
    Object.entries(inclusionById).forEach(([id, on]) => {
      if (on) s.add(id);
    });
    return s;
  }, [inclusionById]);

  const includedLinesWithPatientPriceOverride = useMemo(() => {
    return eligibleItems.filter((i) => {
      if (!inclusionById[i.id] || !showPriceOnSharedTreatmentPlanLink(i)) {
        return false;
      }
      return parseSharePatientPriceOverride(patientPriceOverrideInputById[i.id]) !== null;
    }).length;
  }, [eligibleItems, inclusionById, patientPriceOverrideInputById]);

  const bulkEditablePriceItems = useMemo(
    () =>
      eligibleItems.filter((i) => showPriceOnSharedTreatmentPlanLink(i)),
    [eligibleItems],
  );

  const handlePrepareLink = useCallback(async () => {
    if (!isPostVisitBlueprintSender(provider)) {
      showError(
        "Sharing the treatment plan link is only available for authorized providers.",
      );
      return;
    }
    if (!client) {
      showError("Missing patient context.");
      return;
    }
    if (includedIdSet.size === 0) {
      showError("Select at least one item to include on the shared plan.");
      return;
    }
    const quoteData = computeQuoteSheetDataForDiscussedItems(
      discussedItems,
      effectivePriceList,
    );
    if (!quoteData) {
      showError("Could not build pricing context for this plan.");
      return;
    }
    const formattedPhone = formatPhoneDisplay(client.phone);
    if (!isValidPhone(formattedPhone)) {
      showError("A valid patient phone number is required.");
      return;
    }

    const sharePriceWithPatientByDiscussedId: Record<string, boolean> = {};
    for (const item of eligibleItems) {
      sharePriceWithPatientByDiscussedId[item.id] =
        showPriceOnSharedTreatmentPlanLink(item);
    }

    const patientPriceOverrideByDiscussedId: Record<string, number> = {};
    for (const id of includedIdSet) {
      const row = eligibleItems.find((x) => x.id === id);
      if (!row || !showPriceOnSharedTreatmentPlanLink(row)) continue;
      const raw = patientPriceOverrideInputById[id]?.trim() ?? "";
      if (!raw) continue;
      const n = parseSharePatientPriceOverride(raw);
      if (n === null) {
        showError(
          "Enter a valid patient price (numbers only), or clear the optional field to use the automatic price.",
        );
        return;
      }
      patientPriceOverrideByDiscussedId[id] = n;
    }

    setPreparingLink(true);
    try {
      const totalAfterDiscount = quoteData.total;
      const { token, link } = await createAndStorePostVisitBlueprint({
        clinicName,
        providerName: (provider?.name ?? "").trim() || "Your provider",
        providerCode: provider?.code,
        providerPhone,
        client,
        discussedItems,
        includedDiscussedItemIds: includedIdSet,
        recommenderFocusRegions:
          recommenderFocusRegions && recommenderFocusRegions.length > 0
            ? [...recommenderFocusRegions]
            : undefined,
        quote: {
          lineItems: quoteData.lineItems,
          total: quoteData.total,
          totalAfterDiscount,
          hasUnknownPrices: quoteData.hasUnknownPrices,
          isMintMember: false,
        },
        sharePriceWithPatientByDiscussedId,
        patientPriceOverrideByDiscussedId:
          Object.keys(patientPriceOverrideByDiscussedId).length > 0
            ? patientPriceOverrideByDiscussedId
            : undefined,
        cta: {
          bookingUrl: getPostVisitBlueprintBookingUrl(provider),
          financingUrl,
          textProviderPhone: providerPhone,
        },
      });
      setPendingBlueprintLink(link);
      setPendingBlueprintToken(token);
      setBlueprintRecipientPhone(formattedPhone || "");
      const intro = `Hi ${firstName}, your custom treatment plan from ${clinicName} is ready.`;
      setBlueprintMessageIntro(intro);
      setBlueprintMessageAfterLink("");
      const imperfect = shareQuoteHasPricingGaps(
        discussedItems,
        includedIdSet,
        quoteData.hasUnknownPrices,
        effectivePriceList,
      );
      setSharePricingImperfect(imperfect);
      setBlueprintSmsFullDraft("");
      setStep("send");
    } catch (e) {
      showError(
        e instanceof Error
          ? e.message
          : "Failed to prepare treatment plan link.",
      );
    } finally {
      setPreparingLink(false);
    }
  }, [
    client,
    clinicName,
    discussedItems,
    effectivePriceList,
    financingUrl,
    firstName,
    includedIdSet,
    provider,
    providerPhone,
    eligibleItems,
    recommenderFocusRegions,
    patientPriceOverrideInputById,
  ]);

  const handleConfirmSend = useCallback(async () => {
    if (!client || !pendingBlueprintLink || !pendingBlueprintToken) {
      showError("Link is missing. Go back and try again.");
      return;
    }
    if (!isValidPhone(formatPhoneDisplay(blueprintRecipientPhone))) {
      showError("Enter a valid recipient phone number.");
      return;
    }

    let smsText: string;
    const intro = blueprintMessageIntro.trim();
    if (!intro) {
      showError("Message is not ready. Go back and prepare the link again.");
      return;
    }
    const core = `${intro} Review it here: ${pendingBlueprintLink}`;
    if (sharePricingImperfect) {
      const extra = blueprintSmsFullDraft.trim();
      smsText = extra ? `${core}\n\n${extra}` : core;
    } else {
      const after = blueprintMessageAfterLink.trim();
      smsText = after ? `${core}\n\n${after}` : core;
    }

    setSending(true);
    try {
      await sendSMSNotification(
        cleanPhoneNumber(blueprintRecipientPhone),
        smsText,
        client.name,
      );
      trackPostVisitBlueprintEvent("blueprint_delivered", {
        token: pendingBlueprintToken,
        clinic_name: clinicName,
        provider_name: provider?.name ?? "",
        patient_id: client.id,
      });
      capturePatientAcquisitionFunnelEvent("funnel_pvs_sent", client.id, {
        token: pendingBlueprintToken,
        clinic_name: clinicName,
        provider_name: provider?.name ?? "",
      });
      notifyTreatmentPlanShareSent({
        providerId: String(provider?.id ?? ""),
        providerName: provider?.name,
        providerCode: provider?.code,
        patientId: client.id,
        patientName: client.name,
        blueprintToken: pendingBlueprintToken,
      });
      showToast(`Treatment plan link sent to ${firstName}`);
      onSuccess?.();
      onClose();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to send SMS.");
    } finally {
      setSending(false);
    }
  }, [
    blueprintMessageIntro,
    blueprintMessageAfterLink,
    blueprintRecipientPhone,
    blueprintSmsFullDraft,
    client,
    clinicName,
    firstName,
    onClose,
    onSuccess,
    pendingBlueprintLink,
    pendingBlueprintToken,
    provider?.code,
    provider?.id,
    provider?.name,
    sharePricingImperfect,
  ]);

  const handlePreviewLink = useCallback(() => {
    if (!pendingBlueprintLink) {
      showError("Link is not ready yet.");
      return;
    }
    window.open(pendingBlueprintLink, "_blank", "noopener,noreferrer");
  }, [pendingBlueprintLink]);

  if (!isPostVisitBlueprintSender(provider)) {
    return (
      <div
        className="share-treatment-plan-link-overlay"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-treatment-plan-link-title"
      >
        <div
          className="share-treatment-plan-link-dialog"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="share-tp-link-dialog-header">
            <div className="share-tp-link-dialog-header-text">
              <h2
                id="share-treatment-plan-link-title"
                className="share-tp-link-dialog-title"
              >
                Share treatment plan
              </h2>
            </div>
            <button
              type="button"
              className="modal-close share-tp-link-dialog-close"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          </header>
          <p className="share-treatment-plan-link-empty">
            Your account can&apos;t send the patient plan link. Ask an
            administrator if you need access.
          </p>
          <button type="button" className="btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="treatment-plan-checkout-blueprint-compose-overlay share-treatment-plan-link-overlay"
      onClick={() => !preparingLink && !sending && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-treatment-plan-link-title"
      aria-describedby={
        step === "pick" ? "share-treatment-plan-link-subtitle" : undefined
      }
    >
      <div
        className="treatment-plan-checkout-blueprint-compose-modal share-treatment-plan-link-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="share-tp-link-dialog-header">
          <div className="share-tp-link-dialog-header-text">
            <h3
              id="share-treatment-plan-link-title"
              className="share-tp-link-dialog-title"
            >
              Share treatment plan
            </h3>
            {step === "pick" ? (
              <p
                id="share-treatment-plan-link-subtitle"
                className="share-tp-link-dialog-subheading"
              >
                Select the plan items to share with the patient.
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="modal-close share-tp-link-dialog-close"
            onClick={() => !preparingLink && !sending && onClose()}
            disabled={preparingLink || sending}
            aria-label="Close"
          >
            ×
          </button>
        </header>
        {step === "pick" ? (
          <>
            <div className="share-tp-link-dialog-body">
                {eligibleItems.length === 0 ? (
                <p className="share-treatment-plan-link-empty">
                  Nothing here to share yet. Move items out of Completed or add
                  plan lines first.
                </p>
              ) : (
                <div className="share-tp-link-quote">
                  {skincareShareItems.length > 0 ? (
                    <div className="share-tp-link-quote-section">
                      <h4 className="share-tp-link-quote-section-title">
                        Skincare
                      </h4>
                      <ul className="share-tp-link-quote-rows">
                        {skincareShareItems.map((item) => {
                          const line = lineForItem(item);
                          const showFix =
                            Boolean(line?.missingInfo) && onNavigateToEditPlanItem;
                          const skincareSecondary =
                            getTreatmentPlanRowSecondaryLabel(item);
                          const plannedLine =
                            plannedForPatientLineFromDiscussedItem(item);
                          return (
                            <li key={item.id} className="share-tp-link-quote-row-li">
                              <label className="share-tp-link-quote-row">
                                <input
                                  type="checkbox"
                                  checked={Boolean(inclusionById[item.id])}
                                  onChange={() => toggleInclude(item.id)}
                                />
                                <span className="share-tp-link-quote-row-text">
                                  <span className="share-treatment-plan-link-row-title">
                                    {getTreatmentPlanRowPrimaryLabel(item)}
                                  </span>
                                  {skincareSecondary ? (
                                    <span className="share-treatment-plan-link-row-sub">
                                      {skincareSecondary}
                                    </span>
                                  ) : (
                                    <span className="share-treatment-plan-link-row-meta">
                                      Skincare
                                    </span>
                                  )}
                                  {plannedLine ? (
                                    <span className="share-tp-link-row-planned">
                                      {plannedLine}
                                    </span>
                                  ) : null}
                                </span>
                                <span className="share-tp-link-quote-row-price-block">
                                  <ShareQuoteRowPriceBlock
                                    itemId={item.id}
                                    line={line}
                                    include={Boolean(inclusionById[item.id])}
                                    showPriceOnPatient={showPriceOnSharedTreatmentPlanLink(
                                      item,
                                    )}
                                    patientPriceOverrideRaw={
                                      patientPriceOverrideInputById[item.id]
                                    }
                                    setPatientPriceOverride={(value) =>
                                      setPatientPriceOverrideInputById((prev) => ({
                                        ...prev,
                                        [item.id]: value,
                                      }))
                                    }
                                    inlinePriceEditMode={
                                      inlinePatientPricesEditing
                                    }
                                  />
                                </span>
                              </label>
                              {showFix ? (
                                <div className="share-tp-link-quote-row-fix">
                                  <button
                                    type="button"
                                    className="plan-pricing-fix-action-btn"
                                    onClick={() => onNavigateToEditPlanItem(item.id)}
                                  >
                                    {planPricingFixActionLabel(line?.missingInfo)}
                                  </button>
                                </div>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                      <div className="share-tp-link-quote-subtotal">
                        <span>Skincare subtotal</span>
                        <strong>{formatPrice(includedSkincareSubtotal)}</strong>
                      </div>
                    </div>
                  ) : null}
                  {treatmentTimelineGroups.length > 0 ? (
                    <div className="share-tp-link-quote-section share-tp-link-quote-section--treatments">
                      <h4 className="share-tp-link-quote-section-title">
                        Treatments
                      </h4>
                      {treatmentTimelineGroups.map((group) => (
                        <div
                          key={group.variant}
                          className={`share-tp-link-timeline-group share-tp-link-timeline-group--${group.variant}`}
                        >
                          <h5 className="share-tp-link-timeline-group-title">
                            {group.title}
                          </h5>
                          <ul className="share-tp-link-quote-rows">
                            {group.items.map((item) => {
                              const line = lineForItem(item);
                              const showFix =
                                Boolean(line?.missingInfo) && onNavigateToEditPlanItem;
                              const treatmentSecondary =
                                getTreatmentPlanRowSecondaryLabel(item, {
                                  omitTimeline: group.variant === "wishlist",
                                });
                              const plannedLine =
                                plannedForPatientLineFromDiscussedItem(item);
                              return (
                                <li key={item.id} className="share-tp-link-quote-row-li">
                                  <label className="share-tp-link-quote-row">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(inclusionById[item.id])}
                                      onChange={() => toggleInclude(item.id)}
                                    />
                                    <span className="share-tp-link-quote-row-text">
                                      <span className="share-treatment-plan-link-row-title">
                                        {getTreatmentPlanRowPrimaryLabel(item)}
                                      </span>
                                      {treatmentSecondary ? (
                                        <span className="share-treatment-plan-link-row-sub">
                                          {treatmentSecondary}
                                        </span>
                                      ) : null}
                                      {plannedLine ? (
                                        <span className="share-tp-link-row-planned">
                                          {plannedLine}
                                        </span>
                                      ) : null}
                                    </span>
                                    <span className="share-tp-link-quote-row-price-block">
                                      <ShareQuoteRowPriceBlock
                                        itemId={item.id}
                                        line={line}
                                        include={Boolean(inclusionById[item.id])}
                                        showPriceOnPatient={showPriceOnSharedTreatmentPlanLink(
                                          item,
                                        )}
                                        patientPriceOverrideRaw={
                                          patientPriceOverrideInputById[item.id]
                                        }
                                        setPatientPriceOverride={(value) =>
                                          setPatientPriceOverrideInputById((prev) => ({
                                            ...prev,
                                            [item.id]: value,
                                          }))
                                        }
                                        inlinePriceEditMode={
                                          inlinePatientPricesEditing
                                        }
                                      />
                                    </span>
                                  </label>
                                  {renderShareRowTimelineActions(item)}
                                  {showFix ? (
                                    <div className="share-tp-link-quote-row-fix">
                                      <button
                                        type="button"
                                        className="plan-pricing-fix-action-btn"
                                        onClick={() => onNavigateToEditPlanItem(item.id)}
                                      >
                                        {planPricingFixActionLabel(line?.missingInfo)}
                                      </button>
                                    </div>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                      {hasWishlistTreatmentRows ? (
                        <>
                          <div className="share-tp-link-quote-subtotal">
                            <span>Treatments (excl. wishlist)</span>
                            <strong>
                              {formatPrice(
                                includedTreatmentsExcludingWishlistSubtotal,
                              )}
                            </strong>
                          </div>
                          {includedTreatmentsWishlistSubtotal > 0 ? (
                            <div className="share-tp-link-quote-subtotal share-tp-link-quote-subtotal--muted">
                              <span>Wishlist (later)</span>
                              <strong>
                                {formatPrice(
                                  includedTreatmentsWishlistSubtotal,
                                )}
                              </strong>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <div className="share-tp-link-quote-subtotal">
                          <span>Treatments subtotal</span>
                          <strong>
                            {formatPrice(
                              includedTreatmentsExcludingWishlistSubtotal,
                            )}
                          </strong>
                        </div>
                      )}
                    </div>
                  ) : null}
                  <div className="share-tp-link-quote-footer">
                    <div className="share-tp-link-quote-total">
                      <span>Total</span>
                      <strong>{formatPrice(pickStepTotalDisplay)}</strong>
                    </div>
                    {includedLinesWithPatientPriceOverride > 0 ? (
                      <p className="share-tp-link-quote-total-note">
                        Custom prices are included in the totals and on their
                        page.
                      </p>
                    ) : null}
                  </div>
                  {bulkEditablePriceItems.length > 0 ? (
                    <div className="share-tp-link-quote-edit-prices-footer">
                      <button
                        type="button"
                        className="share-tp-link-edit-prices-link"
                        onClick={() =>
                          setInlinePatientPricesEditing((o) => !o)
                        }
                        aria-expanded={inlinePatientPricesEditing}
                      >
                        {inlinePatientPricesEditing
                          ? "Done editing prices"
                          : "Edit prices"}
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
            <div className="share-tp-link-dialog-footer">
              <div className="treatment-plan-checkout-blueprint-compose-actions share-treatment-plan-link-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={onClose}
                  disabled={preparingLink}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handlePrepareLink}
                  disabled={
                    preparingLink ||
                    eligibleItems.length === 0 ||
                    includedIdSet.size === 0
                  }
                >
                  {preparingLink ? "Preparing…" : "Continue to SMS"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="share-tp-link-dialog-body">
              <label
                className="treatment-plan-checkout-blueprint-compose-label"
                htmlFor="share-tp-link-recipient-phone"
              >
                Recipient phone
              </label>
              <input
                id="share-tp-link-recipient-phone"
                type="tel"
                autoComplete="tel"
                className="treatment-plan-checkout-blueprint-compose-phone"
                placeholder="(555) 555-5555"
                value={blueprintRecipientPhone}
                onChange={(e) =>
                  setBlueprintRecipientPhone(formatPhoneDisplay(e.target.value))
                }
              />

              {pendingBlueprintLink ? (
                <div className="share-tp-link-plan-link-block">
                  <p className="share-tp-link-sms-fixed-intro">
                    {blueprintMessageIntro.trim()}
                    {" Review it here:"}
                  </p>
                  <label
                    className="treatment-plan-checkout-blueprint-compose-label share-tp-link-plan-link-label"
                    htmlFor="share-tp-link-plan-url"
                  >
                    Plan link
                  </label>
                  <div
                    id="share-tp-link-plan-url"
                    className="share-tp-link-plan-url"
                    role="textbox"
                    aria-readonly="true"
                    tabIndex={0}
                  >
                    {pendingBlueprintLink}
                  </div>
                </div>
              ) : null}

              <div className="share-tp-link-compose-message-section">
                <label
                  className="treatment-plan-checkout-blueprint-compose-label treatment-plan-checkout-blueprint-compose-label--textarea"
                  htmlFor={
                    sharePricingImperfect
                      ? "share-tp-link-message-full"
                      : "share-tp-link-message-after"
                  }
                >
                  {sharePricingImperfect ? "Additional message" : "Message"}
                </label>
                <p
                  className="share-tp-link-compose-section-lede"
                  id="share-tp-link-sms-lede"
                >
                  {sharePricingImperfect
                    ? "Optional note after the greeting and plan link."
                    : "Optional text after the plan link."}
                </p>
                {sharePricingImperfect ? (
                  <textarea
                    id="share-tp-link-message-full"
                    className="treatment-plan-checkout-blueprint-compose-textarea share-tp-link-sms-full-textarea"
                    value={blueprintSmsFullDraft}
                    onChange={(e) => setBlueprintSmsFullDraft(e.target.value)}
                    rows={5}
                    spellCheck
                    aria-describedby="share-tp-link-sms-lede"
                    aria-label="Optional SMS note after the plan link"
                    placeholder="Add a personal note for your patient (optional)"
                  />
                ) : (
                  <textarea
                    id="share-tp-link-message-after"
                    className="treatment-plan-checkout-blueprint-compose-textarea share-tp-link-sms-full-textarea"
                    value={blueprintMessageAfterLink}
                    onChange={(e) =>
                      setBlueprintMessageAfterLink(e.target.value)
                    }
                    rows={5}
                    spellCheck
                    aria-describedby="share-tp-link-sms-lede"
                    aria-label="Optional SMS text after the plan link"
                    placeholder="Add a personal note for your patient (optional)"
                  />
                )}
              </div>
            </div>
            <div className="share-tp-link-dialog-footer">
              <div className="treatment-plan-checkout-blueprint-compose-actions share-treatment-plan-link-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setStep("pick");
                    setPendingBlueprintLink(null);
                    setPendingBlueprintToken(null);
                    setBlueprintMessageIntro("");
                    setBlueprintMessageAfterLink("");
                    setSharePricingImperfect(false);
                    setBlueprintSmsFullDraft("");
                  }}
                  disabled={sending}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handlePreviewLink}
                  disabled={sending || !pendingBlueprintLink}
                >
                  Preview link
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleConfirmSend}
                  disabled={
                    sending ||
                    !pendingBlueprintLink ||
                    !isValidPhone(formatPhoneDisplay(blueprintRecipientPhone)) ||
                    !blueprintMessageIntro.trim()
                  }
                >
                  {sending ? "Sending…" : "Send message"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
