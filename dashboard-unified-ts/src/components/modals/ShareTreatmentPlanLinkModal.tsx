// Share patient-facing treatment plan link (SMS) — item checkboxes + compose step

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { getTreatmentDisplayName } from "./DiscussedTreatmentsModal/utils";
import { computeQuoteSheetDataForDiscussedItems } from "./DiscussedTreatmentsModal/TreatmentPlanCheckout";
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

  const eligibleItems = useMemo(
    () => filterDiscussedItemsForPostVisitBlueprint(discussedItems),
    [discussedItems],
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

  const [step, setStep] = useState<"pick" | "send">("pick");
  const [preparingLink, setPreparingLink] = useState(false);
  const [sending, setSending] = useState(false);
  const [blueprintMessageDraft, setBlueprintMessageDraft] = useState("");
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
      setBlueprintMessageDraft(
        `Hi ${firstName}, your custom treatment plan from ${clinicName} is ready. Review it here: ${link}`,
      );
      setStep("send");
    } catch (e) {
      showError(
        e instanceof Error ? e.message : "Failed to prepare treatment plan link.",
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
    if (!blueprintMessageDraft.trim()) {
      showError("Please enter a message before sending.");
      return;
    }
    if (!isValidPhone(formatPhoneDisplay(blueprintRecipientPhone))) {
      showError("Enter a valid recipient phone number.");
      return;
    }

    setSending(true);
    try {
      await sendSMSNotification(
        cleanPhoneNumber(blueprintRecipientPhone),
        blueprintMessageDraft.trim(),
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
    blueprintMessageDraft,
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
        <h3 id="share-treatment-plan-link-title">Share treatment plan</h3>
        {step === "pick" ? (
          <>
            <p className="share-treatment-plan-link-lead">
              Choose which items appear on the patient&apos;s post-visit
              experience. Now, Add next visit, and Skincare are on by default;
              Wishlist is off unless you turn it on.
            </p>
            {eligibleItems.length === 0 ? (
              <p className="share-treatment-plan-link-empty">
                Only Now, Add next visit, Wishlist, and Skincare can be shared.
                Move items out of Completed, or add plan rows in those
                sections.
              </p>
            ) : (
              <ul className="share-treatment-plan-link-items">
                {eligibleItems.map((item) => (
                  <li key={item.id}>
                    <label className="share-treatment-plan-link-row">
                      <input
                        type="checkbox"
                        checked={Boolean(inclusionById[item.id])}
                        onChange={() => toggleInclude(item.id)}
                      />
                      <span className="share-treatment-plan-link-row-body">
                        <span className="share-treatment-plan-link-row-title">
                          {getTreatmentDisplayName(item)}
                          {item.product && item.treatment === "Skincare"
                            ? ` · ${item.product}`
                            : ""}
                        </span>
                        <span className="share-treatment-plan-link-row-meta">
                          {sectionLabelForShareRow(item)}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
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
          </>
        ) : (
          <>
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
            <label
              className="treatment-plan-checkout-blueprint-compose-label treatment-plan-checkout-blueprint-compose-label--textarea"
              htmlFor="share-tp-link-message"
            >
              Message
            </label>
            <textarea
              id="share-tp-link-message"
              className="treatment-plan-checkout-blueprint-compose-textarea"
              value={blueprintMessageDraft}
              onChange={(e) => setBlueprintMessageDraft(e.target.value)}
              rows={6}
            />
            <div className="treatment-plan-checkout-blueprint-compose-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setStep("pick");
                  setPendingBlueprintLink(null);
                  setPendingBlueprintToken(null);
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
                  !blueprintMessageDraft.trim() ||
                  !isValidPhone(formatPhoneDisplay(blueprintRecipientPhone))
                }
              >
                {sending ? "Sending…" : "Send message"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
