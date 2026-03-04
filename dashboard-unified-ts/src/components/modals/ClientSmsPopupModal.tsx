/**
 * Popup modal for a single client: name + phone at top, message history (right-aligned),
 * and compose/send at bottom. Loads 20 most recent; scroll up to load older messages.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import type { Client } from "../../types";
import {
  fetchSmsNotifications,
  sendSMSNotification,
  invalidateSmsCache,
  type SmsNotificationRecord,
} from "../../services/api";
import { cleanPhoneNumber, formatPhoneDisplay } from "../../utils/validation";
import { showToast, showError } from "../../utils/toast";
import "./ClientSmsPopupModal.css";

function formatMessageTime(createdTime: string | undefined): string {
  if (!createdTime) return "";
  try {
    const d = new Date(createdTime);
    const now = new Date();
    const sameDay =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();
    if (sameDay) {
      return d.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
    }
    if (isYesterday) {
      return "Yesterday " + d.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
    }
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return createdTime ?? "";
  }
}

function getPhoneString(phone: string | number | null | undefined): string {
  if (phone == null) return "";
  return String(phone).trim();
}

const MESSAGES_PAGE_SIZE = 20;

interface ClientSmsPopupModalProps {
  client: Client;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ClientSmsPopupModal({
  client,
  onClose,
  onSuccess,
}: ClientSmsPopupModalProps) {
  const [records, setRecords] = useState<SmsNotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [composeMessage, setComposeMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const scrollToEndAfterRenderRef = useRef(false);
  const phoneStr = getPhoneString(client.phone);
  const displayPhone = phoneStr ? formatPhoneDisplay(phoneStr) : "";

  const loadInitial = useCallback(() => {
    if (!phoneStr) {
      setRecords([]);
      setLoading(false);
      setHasMore(false);
      return;
    }
    setLoading(true);
    scrollToEndAfterRenderRef.current = true;
    fetchSmsNotifications({ phone: phoneStr, limit: MESSAGES_PAGE_SIZE, offset: 0 })
      .then((list) => {
        const newestFirst = [...list].sort(
          (a, b) =>
            new Date(b.createdTime ?? 0).getTime() -
            new Date(a.createdTime ?? 0).getTime()
        );
        const mostRecent20 = newestFirst.slice(0, MESSAGES_PAGE_SIZE);
        const byId = new Map<string, SmsNotificationRecord>();
        mostRecent20.forEach((r) => byId.set(r.id, r));
        setRecords(Array.from(byId.values()));
        setHasMore(list.length > MESSAGES_PAGE_SIZE);
      })
      .catch(() => {
        setRecords([]);
        setHasMore(false);
      })
      .finally(() => setLoading(false));
  }, [phoneStr]);

  const loadMoreOlder = useCallback(() => {
    if (!phoneStr || loadingMore || !hasMore) return;
    const el = messagesScrollRef.current;
    const scrollTopPrev = el?.scrollTop ?? 0;
    const scrollHeightPrev = el?.scrollHeight ?? 0;
    setLoadingMore(true);
    const nextOffset = records.length;
    fetchSmsNotifications({
      phone: phoneStr,
      limit: MESSAGES_PAGE_SIZE,
      offset: nextOffset,
    })
      .then((list) => {
        setRecords((prev) => {
          const byId = new Map<string, SmsNotificationRecord>();
          [...prev, ...list].forEach((r) => byId.set(r.id, r));
          return Array.from(byId.values()).sort(
            (a, b) =>
              new Date(a.createdTime ?? 0).getTime() -
              new Date(b.createdTime ?? 0).getTime()
          );
        });
        setHasMore(list.length === MESSAGES_PAGE_SIZE);
        requestAnimationFrame(() => {
          const el2 = messagesScrollRef.current;
          if (el2 && scrollHeightPrev > 0) {
            const newScrollHeight = el2.scrollHeight;
            el2.scrollTop = scrollTopPrev + (newScrollHeight - scrollHeightPrev);
          }
        });
      })
      .catch(() => setHasMore(false))
      .finally(() => setLoadingMore(false));
  }, [phoneStr, records.length, loadingMore, hasMore]);

  useEffect(() => {
    scrollToEndAfterRenderRef.current = true;
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (!scrollToEndAfterRenderRef.current) return;
    scrollToEndAfterRenderRef.current = false;
    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToBottom);
    });
  }, [records]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleScroll = () => {
    const el = messagesScrollRef.current;
    if (!el || loadingMore || !hasMore) return;
    if (el.scrollTop < 80) loadMoreOlder();
  };

  const handleSend = async () => {
    const trimmed = composeMessage.trim();
    if (!trimmed || !phoneStr) return;
    const cleaned = cleanPhoneNumber(phoneStr);
    if (!cleaned) {
      showError("Invalid phone number");
      return;
    }
    setSending(true);
    try {
      await sendSMSNotification(cleaned, trimmed, client.name || undefined);
      showToast("Message sent");
      setComposeMessage("");
      scrollToEndAfterRenderRef.current = true;
      invalidateSmsCache(phoneStr);
      loadInitial();
      onSuccess?.();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="modal-overlay active client-sms-popup-overlay"
      onClick={onClose}
    >
      <div
        className="client-sms-popup-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-sms-popup-title"
      >
        <div className="client-sms-popup-header">
          <h2 id="client-sms-popup-title" className="client-sms-popup-title">
            {client.name}
          </h2>
          <p className="client-sms-popup-phone">{displayPhone || "No phone"}</p>
          <button
            type="button"
            className="client-sms-popup-close"
            onClick={onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div
          ref={messagesScrollRef}
          className="client-sms-popup-messages"
          onScroll={handleScroll}
        >
          {loadingMore && (
            <div className="client-sms-popup-loading client-sms-popup-loading-top">
              Loading older messages...
            </div>
          )}
          {loading ? (
            <div className="client-sms-popup-loading">Loading messages...</div>
          ) : !phoneStr ? (
            <div className="client-sms-popup-empty">No phone number on file.</div>
          ) : records.length === 0 ? (
            <div className="client-sms-popup-empty">
              No text messages yet. Send one below.
            </div>
          ) : (
            [...records]
              .sort(
                (a, b) =>
                  new Date(a.createdTime ?? 0).getTime() -
                  new Date(b.createdTime ?? 0).getTime()
              )
              .map((rec) => (
                <div
                  key={rec.id}
                  className="client-sms-popup-bubble"
                  role="listitem"
                >
                  <div className="client-sms-popup-bubble-text">{rec.message}</div>
                  <time
                    className="client-sms-popup-bubble-time"
                    dateTime={rec.createdTime}
                  >
                    {formatMessageTime(rec.createdTime)}
                  </time>
                </div>
              ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {phoneStr && (
          <div className="client-sms-popup-compose">
            <textarea
              className="client-sms-popup-input"
              placeholder="Type a message..."
              value={composeMessage}
              onChange={(e) => setComposeMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={2}
              disabled={sending}
              aria-label="Message"
            />
            <button
              type="button"
              className="client-sms-popup-send"
              onClick={handleSend}
              disabled={sending || !composeMessage.trim()}
              aria-label="Send message"
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
