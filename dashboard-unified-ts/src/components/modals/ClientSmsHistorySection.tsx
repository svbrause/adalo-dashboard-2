/**
 * Client-level text message history – SMS notifications sent to this client (matched by phone).
 * Collapsible section with message-bubble styling aligned with the all-clients SMS view.
 */

import { useState, useEffect } from "react";
import type { Client } from "../../types";
import { fetchSmsNotifications, type SmsNotificationRecord } from "../../services/api";
import "./ClientSmsHistorySection.css";

/** Same relative time formatting as SmsHistoryView (Today, Yesterday, or short date). */
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
      return `Yesterday ${d.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })}`;
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

/** Phone can be string or number from Airtable. */
function getPhoneString(phone: string | number | null | undefined): string {
  if (phone == null) return "";
  return String(phone).trim();
}

interface ClientSmsHistorySectionProps {
  client: Client;
}

/** When there are more than this many messages, section starts collapsed. */
const COLLAPSE_THRESHOLD = 5;

export default function ClientSmsHistorySection({ client }: ClientSmsHistorySectionProps) {
  const [records, setRecords] = useState<SmsNotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const phoneStr = getPhoneString(client.phone);

  const hasMessages = records.length > 0;
  const defaultExpanded = !hasMessages || records.length <= COLLAPSE_THRESHOLD;
  const isCollapsible = hasMessages && records.length > COLLAPSE_THRESHOLD;
  const isExpanded = isCollapsible ? expanded : defaultExpanded;
  const lastMessage = records.length > 0 ? records[records.length - 1] : null;

  useEffect(() => {
    if (!phoneStr) {
      setRecords([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchSmsNotifications({ phone: phoneStr })
      .then((list) => {
        if (!cancelled) setRecords(list);
      })
      .catch(() => {
        if (!cancelled) setRecords([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [phoneStr]);

  return (
    <div className="detail-section detail-section-sms-history">
      <div
        className={`client-sms-history-header ${isCollapsible ? "client-sms-history-header-clickable" : ""}`}
        onClick={isCollapsible ? () => setExpanded((e) => !e) : undefined}
        role={isCollapsible ? "button" : undefined}
        aria-expanded={isCollapsible ? isExpanded : undefined}
        aria-label={isCollapsible ? (isExpanded ? "Collapse text message history" : "Expand text message history") : undefined}
      >
        <span className="detail-section-title">Text message history</span>
        {!phoneStr ? null : loading ? (
          <span className="client-sms-history-summary">Loading…</span>
        ) : !hasMessages ? (
          <span className="client-sms-history-summary client-sms-history-summary-muted">No messages</span>
        ) : (
          <span className="client-sms-history-summary">
            {records.length} {records.length === 1 ? "message" : "messages"}
            {lastMessage && (
              <> · Last {formatMessageTime(lastMessage.createdTime)}</>
            )}
          </span>
        )}
        {isCollapsible && (
          <span className="client-sms-history-chevron" aria-hidden>
            {isExpanded ? "▼" : "▶"}
          </span>
        )}
      </div>

      {!phoneStr ? (
        <p className="client-sms-history-empty">No phone number on file.</p>
      ) : loading ? (
        <p className="client-sms-history-loading">Loading…</p>
      ) : !hasMessages ? (
        <p className="client-sms-history-empty">No text messages sent to this client yet.</p>
      ) : isExpanded ? (
        <div className="client-sms-history-thread">
          <div className="client-sms-history-messages" role="list">
            {records.map((rec) => (
              <div
                key={rec.id}
                className="client-sms-history-bubble"
                role="listitem"
              >
                <div className="client-sms-history-bubble-text">{rec.message}</div>
                <time
                  className="client-sms-history-bubble-time"
                  dateTime={rec.createdTime}
                >
                  {formatMessageTime(rec.createdTime)}
                </time>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
