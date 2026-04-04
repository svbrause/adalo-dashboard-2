// Share patient-facing treatment plan link (SMS) — item checkboxes + compose step

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { Client, DiscussedItem } from "../../types";
import { useDashboard } from "../../context/DashboardContext";
import { sendSMSNotification } from "../../services/api";
import {
  getPostVisitBlueprintBookingUrl,
  isPostVisitBlueprintSender,
} from "../../utils/providerHelpers";
import { showError, showToast } from "../../utils/toast";
import {
  cleanPhoneNumber,
  formatPhoneDisplay,
  isValidPhone,
} from "../../utils/validation";
import {
  createAndStorePostVisitBlueprint,
  defaultIncludeItemInSharedTreatmentPlanLink,
  filterDiscussedItemsForPostVisitBlueprint,
  trackPostVisitBlueprintEvent,
  warmPostVisitBlueprintForSend,
} from "../../utils/postVisitBlueprint";
import { formatPrice } from "../../data/treatmentPricing2025";
import { patientFacingSkincareShortName } from "../../utils/pvbSkincareDisplay";
import { getTreatmentDisplayName } from "./DiscussedTreatmentsModal/utils";
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
}

function sectionLabelForShareRow(item: DiscussedItem): string {
  if ((item.treatment ?? "").trim() === "Skincare") return "Skincare";
  const t = (item.timeline ?? "").trim();
  if (t === "Add next visit") return "Add next visit";
  if (t === "Wishlist" || !t) return "Wishlist";
  return t;
}

/** Same order as the plan modal / checkout (Now before Wishlist, etc.). */
const SHARE_LINK_TIMELINE_SECTION_ORDER = [
  "Now",
  "Add next visit",
  "Wishlist",
  "Completed",
] as const;

function shareTimelineGroupSortIndex(title: string): number {
  const idx = (
    SHARE_LINK_TIMELINE_SECTION_ORDER as readonly string[]
  ).indexOf(title);
  return idx >= 0 ? idx : 999;
}

/** Per-line amount: show line total only (no unit math) when we have a numeric total. */
function shareRowPriceDisplay(
  line:
    | { price?: number; displayPrice?: string; isEstimate?: boolean }
    | undefined,
): string {
  if (!line) return formatPrice(0);
  if (line.displayPrice === "Price varies") return "Price varies";
  if (line.isEstimate && line.displayPrice?.trim()) {
    return line.displayPrice.trim();
  }
  if (line.price != null && line.price > 0) {
    return formatPrice(line.price);
  }
  if (line.displayPrice?.trim()) return line.displayPrice.trim();
  return formatPrice(0);
}

function shareRowPrimaryLabel(
  item: DiscussedItem,
  line:
    | {
        skuName?: string;
        label: string;
        quoteLineKind?: "skincare" | "treatment";
      }
    | undefined,
): string {
  if (!line) return getTreatmentDisplayName(item);
  const raw = (line.skuName ?? line.label ?? "").trim();
  if (line.quoteLineKind === "skincare" && raw) {
    return patientFacingSkincareShortName(raw);
  }
  if (raw) return raw;
  return getTreatmentDisplayName(item);
}

export default function ShareTreatmentPlanLinkModal({
  client,
  discussedItems,
  onClose,
  onSuccess,
  recommenderFocusRegions,
}: ShareTreatmentPlanLinkModalProps) {
  const { provider } = useDashboard();
  const firstName = client.name?.trim().split(/\s+/)[0] || "Patient";
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

  const eligibleItems = useMemo(() => {
    const filtered = filterDiscussedItemsForPostVisitBlueprint(discussedItems);
    const rank = getDiscussedItemQuoteOrderRankById(discussedItems);
    return [...filtered].sort(
      (a, b) => (rank.get(a.id) ?? 9999) - (rank.get(b.id) ?? 9999),
    );
  }, [discussedItems]);

  const discussedIndexByItemId = useMemo(() => {
    const m = new Map<string, number>();
    discussedItems.forEach((d, i) => m.set(d.id, i));
    return m;
  }, [discussedItems]);

  const checkoutLinesByDiscussedIndex = useMemo(
    () => getAlignedCheckoutLineItemsForDiscussedItems(discussedItems),
    [discussedItems],
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

  const treatmentTimelineGroups = useMemo(() => {
    const byTitle = new Map<string, DiscussedItem[]>();
    for (const item of treatmentShareItems) {
      const title = sectionLabelForShareRow(item);
      if (!byTitle.has(title)) byTitle.set(title, []);
      byTitle.get(title)!.push(item);
    }
    const titles = Array.from(byTitle.keys()).sort(
      (a, b) => shareTimelineGroupSortIndex(a) - shareTimelineGroupSortIndex(b),
    );
    return titles.map((title) => ({
      title,
      items: byTitle.get(title)!,
    }));
  }, [treatmentShareItems]);

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

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const item of eligibleItems) {
      next[item.id] = defaultIncludeItemInSharedTreatmentPlanLink(item);
    }
    setInclusionById(next);
  }, [eligibleIdsKey, eligibleItems]);

  const includedSkincareSubtotal = useMemo(() => {
    return skincareShareItems.reduce((sum, item) => {
      if (!inclusionById[item.id]) return sum;
      return sum + (lineForItem(item)?.price ?? 0);
    }, 0);
  }, [skincareShareItems, inclusionById, lineForItem]);

  const includedTreatmentSubtotal = useMemo(() => {
    return treatmentShareItems.reduce((sum, item) => {
      if (!inclusionById[item.id]) return sum;
      return sum + (lineForItem(item)?.price ?? 0);
    }, 0);
  }, [treatmentShareItems, inclusionById, lineForItem]);

  const includedSelectionTotal =
    includedSkincareSubtotal + includedTreatmentSubtotal;

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
    setInclusionById((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const includedIdSet = useMemo(() => {
    const s = new Set<string>();
    Object.entries(inclusionById).forEach(([id, on]) => {
      if (on) s.add(id);
    });
    return s;
  }, [inclusionById]);

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
    const quoteData = computeQuoteSheetDataForDiscussedItems(discussedItems);
    if (!quoteData) {
      showError("Could not build pricing context for this plan.");
      return;
    }
    const formattedPhone = formatPhoneDisplay(client.phone);
    if (!isValidPhone(formattedPhone)) {
      showError("A valid patient phone number is required.");
      return;
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
        cta: {
          bookingUrl: getPostVisitBlueprintBookingUrl(provider),
          financingUrl,
          textProviderPhone: providerPhone,
        },
      });
      setPendingBlueprintLink(link);
      setPendingBlueprintToken(token);
      setBlueprintRecipientPhone(formattedPhone || "");
      setBlueprintMessageIntro(
        `Hi ${firstName}, your custom treatment plan from ${clinicName} is ready.`,
      );
      setBlueprintMessageAfterLink("");
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
    financingUrl,
    firstName,
    includedIdSet,
    provider,
    providerPhone,
    recommenderFocusRegions,
  ]);

  const handleConfirmSend = useCallback(async () => {
    if (!client || !pendingBlueprintLink || !pendingBlueprintToken) {
      showError("Link is missing. Go back and try again.");
      return;
    }
    const intro = blueprintMessageIntro.trim();
    if (!intro) {
      showError("Message is not ready. Go back and prepare the link again.");
      return;
    }
    if (!isValidPhone(formatPhoneDisplay(blueprintRecipientPhone))) {
      showError("Enter a valid recipient phone number.");
      return;
    }

    const core = `${intro} Review it here: ${pendingBlueprintLink}`;
    const after = blueprintMessageAfterLink.trim();
    const smsText = after ? `${core}\n\n${after}` : core;

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
    client,
    clinicName,
    firstName,
    onClose,
    onSuccess,
    pendingBlueprintLink,
    pendingBlueprintToken,
    provider?.name,
  ]);

  const handlePreviewLink = useCallback(() => {
    if (!pendingBlueprintLink) {
      showError("Link is not ready yet.");
      return;
    }
    window.open(pendingBlueprintLink, "_blank", "noopener,noreferrer");
  }, [pendingBlueprintLink]);

  const lockedSmsPrefix = useMemo(() => {
    const intro = blueprintMessageIntro.trim();
    if (!intro || !pendingBlueprintLink) return "";
    return `${intro} Review it here: ${pendingBlueprintLink}`;
  }, [blueprintMessageIntro, pendingBlueprintLink]);

  const smsTextareaValue = useMemo(() => {
    if (!lockedSmsPrefix) return "";
    return `${lockedSmsPrefix}${blueprintMessageAfterLink}`;
  }, [lockedSmsPrefix, blueprintMessageAfterLink]);

  const smsTextareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSmsTextareaChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const v = e.target.value;
      if (!lockedSmsPrefix || !v.startsWith(lockedSmsPrefix)) return;
      setBlueprintMessageAfterLink(v.slice(lockedSmsPrefix.length));
    },
    [lockedSmsPrefix],
  );

  const clampSmsCaretToEditable = useCallback(() => {
    const el = smsTextareaRef.current;
    if (!el || !lockedSmsPrefix) return;
    const lockLen = lockedSmsPrefix.length;
    let { selectionStart: s, selectionEnd: end } = el;
    if (s === end && s < lockLen) {
      el.setSelectionRange(lockLen, lockLen);
      return;
    }
    if (s < end && end <= lockLen) {
      el.setSelectionRange(lockLen, lockLen);
    }
  }, [lockedSmsPrefix]);

  const handleSmsTextareaKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (!lockedSmsPrefix) return;
      const lockLen = lockedSmsPrefix.length;
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;

      const isNav =
        e.key.startsWith("Arrow") ||
        e.key === "Home" ||
        e.key === "End" ||
        e.key === "Tab" ||
        e.key === "Escape" ||
        e.key === "Shift" ||
        e.key === "Meta" ||
        e.key === "Control" ||
        e.key === "Alt" ||
        e.key === "ContextMenu";

      if (isNav) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x") {
        if (start < lockLen || end < lockLen) {
          e.preventDefault();
          el.setSelectionRange(lockLen, lockLen);
        }
        return;
      }

      if (e.key === "Backspace") {
        if (end <= lockLen) {
          e.preventDefault();
          el.setSelectionRange(lockLen, lockLen);
          return;
        }
        if (start !== end && start < lockLen) {
          e.preventDefault();
          el.setSelectionRange(lockLen, end);
          return;
        }
        if (start === end && start === lockLen) {
          e.preventDefault();
          return;
        }
      }

      if (e.key === "Delete" && start < lockLen) {
        e.preventDefault();
        el.setSelectionRange(Math.max(start, lockLen), Math.max(end, lockLen));
      }

      const wouldTypeInLocked =
        start < lockLen || (start === end && start < lockLen);
      if (
        wouldTypeInLocked &&
        (e.key.length === 1 || e.key === "Enter") &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        e.preventDefault();
        el.setSelectionRange(lockLen, lockLen);
      }
    },
    [lockedSmsPrefix],
  );

  const handleSmsTextareaPaste = useCallback(
    (e: ClipboardEvent<HTMLTextAreaElement>) => {
      if (!lockedSmsPrefix) return;
      const lockLen = lockedSmsPrefix.length;
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      if (start >= lockLen && end >= lockLen) return;

      e.preventDefault();
      const paste = e.clipboardData.getData("text");
      const insertAt = Math.max(start, lockLen);
      const before = el.value.slice(0, insertAt);
      const afterSlice = el.value.slice(end);
      const merged = before + paste + afterSlice;
      if (!merged.startsWith(lockedSmsPrefix)) return;
      setBlueprintMessageAfterLink(merged.slice(lockLen));
      const caret = insertAt + paste.length;
      requestAnimationFrame(() => {
        el.setSelectionRange(caret, caret);
      });
    },
    [lockedSmsPrefix],
  );

  const handleSmsTextareaClickMouseUp = useCallback(() => {
    requestAnimationFrame(() => clampSmsCaretToEditable());
  }, [clampSmsCaretToEditable]);

  const handleSmsTextareaKeyUp = useCallback(
    (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (
        e.key.startsWith("Arrow") ||
        e.key === "Home" ||
        e.key === "End"
      ) {
        requestAnimationFrame(() => clampSmsCaretToEditable());
      }
    },
    [clampSmsCaretToEditable],
  );

  const handleSmsTextareaFocus = useCallback(() => {
    requestAnimationFrame(() => clampSmsCaretToEditable());
  }, [clampSmsCaretToEditable]);

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
          <h2 id="share-treatment-plan-link-title">Share treatment plan</h2>
          <p>Your account cannot send the patient treatment plan link.</p>
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
    >
      <div
        className="treatment-plan-checkout-blueprint-compose-modal share-treatment-plan-link-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id="share-treatment-plan-link-title"
          className="share-tp-link-dialog-title"
        >
          Share treatment plan
        </h3>
        {step === "pick" ? (
          <>
            <p className="share-tp-link-dialog-subtitle">
              Choose items for the patient link—pricing matches their plan. Now,
              next visit &amp; Skincare default on; Wishlist off.
            </p>
            <div className="share-tp-link-dialog-body">
              {eligibleItems.length === 0 ? (
                <p className="share-treatment-plan-link-empty">
                  Only Now, Add next visit, Wishlist, and Skincare can be
                  shared. Move items out of Completed, or add plan rows in those
                  sections.
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
                          return (
                            <li key={item.id}>
                              <label className="share-tp-link-quote-row">
                                <input
                                  type="checkbox"
                                  checked={Boolean(inclusionById[item.id])}
                                  onChange={() => toggleInclude(item.id)}
                                />
                                <span className="share-tp-link-quote-row-text">
                                  <span className="share-treatment-plan-link-row-title">
                                    {shareRowPrimaryLabel(item, line)}
                                  </span>
                                  <span className="share-treatment-plan-link-row-meta">
                                    {sectionLabelForShareRow(item)}
                                  </span>
                                </span>
                                <strong className="share-tp-link-quote-row-price">
                                  {shareRowPriceDisplay(line)}
                                </strong>
                              </label>
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
                          key={group.title}
                          className="share-tp-link-timeline-group"
                        >
                          <h5 className="share-tp-link-timeline-group-title">
                            {group.title}
                          </h5>
                          <ul className="share-tp-link-quote-rows">
                            {group.items.map((item) => {
                              const line = lineForItem(item);
                              return (
                                <li key={item.id}>
                                  <label className="share-tp-link-quote-row">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(inclusionById[item.id])}
                                      onChange={() => toggleInclude(item.id)}
                                    />
                                    <span className="share-tp-link-quote-row-text">
                                      <span className="share-treatment-plan-link-row-title">
                                        {shareRowPrimaryLabel(item, line)}
                                      </span>
                                    </span>
                                    <strong className="share-tp-link-quote-row-price">
                                      {shareRowPriceDisplay(line)}
                                    </strong>
                                  </label>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                      <div className="share-tp-link-quote-subtotal">
                        <span>Treatments subtotal</span>
                        <strong>
                          {formatPrice(includedTreatmentSubtotal)}
                        </strong>
                      </div>
                    </div>
                  ) : null}
                  <div className="share-tp-link-quote-footer">
                    <div className="share-tp-link-quote-total">
                      <span>Total</span>
                      <strong>{formatPrice(includedSelectionTotal)}</strong>
                    </div>
                  </div>
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
                onChange={(e) => setBlueprintRecipientPhone(e.target.value)}
              />

              <div className="share-tp-link-compose-message-section">
                <label
                  className="treatment-plan-checkout-blueprint-compose-label treatment-plan-checkout-blueprint-compose-label--textarea"
                  htmlFor="share-tp-link-message-after"
                >
                  Message
                </label>
                <p
                  className="share-tp-link-compose-section-lede"
                  id="share-tp-link-sms-lede"
                >
                  One text to the patient. The greeting and link at the start
                  can&apos;t be changed—click after the link and type only if
                  you want to add more.
                </p>
                <textarea
                  ref={smsTextareaRef}
                  id="share-tp-link-message-after"
                  className="treatment-plan-checkout-blueprint-compose-textarea share-tp-link-sms-full-textarea"
                  value={smsTextareaValue}
                  onChange={handleSmsTextareaChange}
                  onKeyDown={handleSmsTextareaKeyDown}
                  onKeyUp={handleSmsTextareaKeyUp}
                  onPaste={handleSmsTextareaPaste}
                  onClick={handleSmsTextareaClickMouseUp}
                  onMouseUp={handleSmsTextareaClickMouseUp}
                  onFocus={handleSmsTextareaFocus}
                  rows={8}
                  spellCheck
                  aria-describedby="share-tp-link-sms-lede"
                  aria-label="SMS including fixed greeting and plan link; type after the link to add text"
                />
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
                    !blueprintMessageIntro.trim() ||
                    !isValidPhone(formatPhoneDisplay(blueprintRecipientPhone))
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
