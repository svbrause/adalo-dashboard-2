/**
 * SMS History view – messaging-app style: left = recipients (searchable), right = thread + send.
 * Cross-referenced by phone number with Patients and Web Popup Leads.
 */

import { useState, useEffect, useMemo, useRef } from "react";
import { useDashboard } from "../../context/DashboardContext";
import {
  fetchSmsNotifications,
  sendSMSNotification,
  type SmsNotificationRecord,
} from "../../services/api";
import {
  cleanPhoneNumber,
  formatPhoneDisplay,
  isValidPhone,
} from "../../utils/validation";
import { showToast, showError } from "../../utils/toast";
import type { Client } from "../../types";
import "./SmsHistoryView.css";

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

function getClientNameByPhone(phone: string, clients: Client[]): string | null {
  const normalized = cleanPhoneNumber(phone);
  if (!normalized) return null;
  const client = clients.find((c) => cleanPhoneNumber(c.phone) === normalized);
  return client?.name ?? null;
}

export interface SmsThread {
  phone: string;
  displayName: string;
  displayPhone: string;
  messages: SmsNotificationRecord[];
  lastTime: string;
}

function buildThreads(
  records: SmsNotificationRecord[],
  clients: Client[],
): SmsThread[] {
  const byPhone = new Map<string, SmsNotificationRecord[]>();
  for (const rec of records) {
    const key = cleanPhoneNumber(rec.phone) || rec.phone;
    if (!key) continue;
    const list = byPhone.get(key) ?? [];
    list.push(rec);
    byPhone.set(key, list);
  }
  const threads: SmsThread[] = [];
  byPhone.forEach((messages, phone) => {
    const sorted = [...messages].sort(
      (a, b) =>
        new Date(b.createdTime ?? 0).getTime() -
        new Date(a.createdTime ?? 0).getTime(),
    );
    const name =
      (getClientNameByPhone(phone, clients) ??
        (sorted[0]?.name?.trim() || "")) ||
      formatPhoneDisplay(phone);
    threads.push({
      phone,
      displayName: name || formatPhoneDisplay(phone),
      displayPhone: formatPhoneDisplay(phone) || phone,
      messages: sorted.reverse(),
      lastTime: sorted[sorted.length - 1]?.createdTime ?? "",
    });
  });
  threads.sort(
    (a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime(),
  );
  return threads;
}

const RECORDS_PAGE_SIZE = 500;
const CONVERSATIONS_PAGE_SIZE = 50;

export default function SmsHistoryView() {
  const { provider, clients } = useDashboard();
  const [records, setRecords] = useState<SmsNotificationRecord[]>([]);
  const [recordOffset, setRecordOffset] = useState(0);
  const [hasMoreRecords, setHasMoreRecords] = useState(false);
  const [conversationsToShow, setConversationsToShow] = useState(
    CONVERSATIONS_PAGE_SIZE,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const [searchRecords, setSearchRecords] = useState<SmsNotificationRecord[]>(
    [],
  );
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [composingNewMessage, setComposingNewMessage] = useState(false);
  const [newMessagePhone, setNewMessagePhone] = useState("");
  const [newMessageName, setNewMessageName] = useState("");
  const [composeMessage, setComposeMessage] = useState("");
  const [sending, setSending] = useState(false);
  const threadMessagesEndRef = useRef<HTMLDivElement>(null);

  const loadSms = async (offset = 0, append = false) => {
    if (!provider?.id) {
      if (!append) {
        setRecords([]);
        setLoading(false);
      }
      return;
    }
    try {
      if (!append) setLoading(true);
      setError(null);
      const list = await fetchSmsNotifications({
        providerId: provider.id,
        limit: RECORDS_PAGE_SIZE,
        offset,
      });
      if (append) {
        setRecords((prev) => [...prev, ...list]);
      } else {
        setRecords(list);
        setConversationsToShow(CONVERSATIONS_PAGE_SIZE);
      }
      setHasMoreRecords(list.length === RECORDS_PAGE_SIZE);
      setRecordOffset(offset + list.length);
    } catch (err) {
      console.error("Failed to load SMS history:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load text message history",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSms();
  }, [provider?.id]);

  const runSearch = async () => {
    const q = searchInput.trim();
    if (!q || !provider?.id) {
      setSearchQuery(null);
      setSearchRecords([]);
      return;
    }
    setSearchQuery(q);
    setSearchLoading(true);
    try {
      const list = await fetchSmsNotifications({
        providerId: provider.id,
        search: q,
      });
      setSearchRecords(list);
    } catch {
      setSearchRecords([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearchQuery(null);
    setSearchRecords([]);
  };

  const threads = useMemo(
    () => buildThreads(records, clients),
    [records, clients],
  );
  const searchThreads = useMemo(
    () => buildThreads(searchRecords, clients),
    [searchRecords, clients],
  );
  const listThreads = searchQuery !== null ? searchThreads : threads;
  const visibleThreads =
    searchQuery !== null
      ? listThreads
      : listThreads.slice(0, conversationsToShow);
  const hasMoreConversations =
    searchQuery === null &&
    (conversationsToShow < listThreads.length || hasMoreRecords);

  const loadMore = async () => {
    if (conversationsToShow < listThreads.length) {
      setConversationsToShow((n) => n + CONVERSATIONS_PAGE_SIZE);
      return;
    }
    if (hasMoreRecords && provider?.id) {
      setLoading(true);
      try {
        const list = await fetchSmsNotifications({
          providerId: provider.id,
          limit: RECORDS_PAGE_SIZE,
          offset: recordOffset,
        });
        setRecords((prev) => [...prev, ...list]);
        setHasMoreRecords(list.length === RECORDS_PAGE_SIZE);
        setRecordOffset((o) => o + list.length);
        setConversationsToShow((n) => n + CONVERSATIONS_PAGE_SIZE);
      } catch (err) {
        console.error("Failed to load more:", err);
      } finally {
        setLoading(false);
      }
    }
  };

  const selectedThread = useMemo(
    () =>
      selectedPhone
        ? listThreads.find(
            (t) =>
              cleanPhoneNumber(t.phone) === cleanPhoneNumber(selectedPhone),
          )
        : null,
    [listThreads, selectedPhone],
  );

  const newMessagePhoneClean = cleanPhoneNumber(newMessagePhone);
  const newMessageMatchesThread = useMemo(
    () =>
      newMessagePhoneClean && isValidPhone(newMessagePhoneClean)
        ? listThreads.find(
            (t) => cleanPhoneNumber(t.phone) === newMessagePhoneClean,
          )
        : null,
    [listThreads, newMessagePhoneClean],
  );

  useEffect(() => {
    if (!selectedThread && !newMessageMatchesThread) return;
    const scrollToBottom = () => {
      threadMessagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToBottom);
    });
  }, [selectedPhone, selectedThread?.phone, newMessageMatchesThread?.phone]);

  const handleSend = async () => {
    const msg = composeMessage.trim();
    if (!msg) return;

    if (composingNewMessage) {
      if (!newMessagePhoneClean || !isValidPhone(newMessagePhoneClean)) {
        showError("Please enter a valid 10-digit phone number.");
        return;
      }
      setSending(true);
      try {
        await sendSMSNotification(
          newMessagePhoneClean,
          msg,
          newMessageName.trim() || undefined,
        );
        showToast("Message sent.");
        setComposeMessage("");
        await loadSms(0, false);
        if (searchQuery) runSearch();
        setSelectedPhone(newMessagePhoneClean);
        setComposingNewMessage(false);
        setNewMessagePhone("");
        setNewMessageName("");
      } catch (err) {
        showError(
          err instanceof Error ? err.message : "Failed to send message",
        );
      } finally {
        setSending(false);
      }
      return;
    }

    if (!selectedThread) return;
    if (!isValidPhone(selectedThread.phone)) {
      showError("Invalid phone number for this recipient.");
      return;
    }
    setSending(true);
    try {
      await sendSMSNotification(
        selectedThread.phone,
        msg,
        selectedThread.displayName || undefined,
      );
      showToast(`Message sent to ${selectedThread.displayName}`);
      setComposeMessage("");
      await loadSms(0, false);
      if (searchQuery) runSearch();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="sms-history-view">
        <div className="sms-history-loading">
          <div className="spinner spinner-with-margin" />
          <p>Loading text message history…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sms-history-view">
        <div className="sms-history-error">
          <p>{error}</p>
          <button
            type="button"
            className="sms-history-retry-btn"
            onClick={() => loadSms()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sms-history-view">
      <div className="sms-history-layout">
        {/* Left: recipient list */}
        <aside className="sms-history-sidebar">
          <div className="sms-history-sidebar-header">
            <h1 className="sms-history-title">Messages</h1>
            <div className="sms-history-header-buttons">
              <button
                type="button"
                className={`sms-history-refresh-btn ${composingNewMessage ? "active" : ""}`}
                onClick={() => {
                  setComposingNewMessage(true);
                  setSelectedPhone(null);
                }}
                aria-label="New"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New
              </button>
              <button
                type="button"
                className="sms-history-refresh-btn"
                onClick={() => loadSms()}
                aria-label="Refresh"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                Refresh
              </button>
            </div>
          </div>
          <div className="sms-history-search-wrap">
            <input
              type="text"
              className="sms-history-search"
              placeholder="Search by name or phone…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") runSearch();
              }}
              aria-label="Search recipients"
            />
            {searchQuery !== null ? (
              <button
                type="button"
                className="sms-history-search-clear"
                onClick={clearSearch}
                aria-label="Clear search"
              >
                Clear search
              </button>
            ) : (
              <button
                type="button"
                className="sms-history-search-btn"
                onClick={runSearch}
                disabled={searchLoading || !searchInput.trim()}
                aria-label="Search"
              >
                {searchLoading ? "Searching…" : "Search"}
              </button>
            )}
          </div>
          <div className="sms-history-recipient-list">
            {searchLoading ? (
              <p className="sms-history-empty-sidebar">Searching…</p>
            ) : visibleThreads.length === 0 ? (
              <p className="sms-history-empty-sidebar">
                {searchQuery !== null
                  ? "No recipients match your search."
                  : "No conversations yet. Click New message to send to a number."}
              </p>
            ) : (
              visibleThreads.map((thread) => (
                <button
                  type="button"
                  key={thread.phone}
                  className={`sms-history-recipient-item ${
                    !composingNewMessage &&
                    selectedPhone &&
                    cleanPhoneNumber(thread.phone) ===
                      cleanPhoneNumber(selectedPhone)
                      ? "active"
                      : ""
                  }`}
                  onClick={() => {
                    setSelectedPhone(thread.phone);
                    setComposingNewMessage(false);
                  }}
                >
                  <div className="sms-history-recipient-info">
                    <span className="sms-history-recipient-name">
                      {thread.displayName}
                    </span>
                    <span className="sms-history-recipient-phone">
                      {thread.displayPhone}
                    </span>
                  </div>
                  <span className="sms-history-recipient-time">
                    {formatMessageTime(thread.lastTime)}
                  </span>
                </button>
              ))
            )}
            {hasMoreConversations && (
              <button
                type="button"
                className="sms-history-load-more"
                onClick={loadMore}
                disabled={loading}
                aria-label="Load more conversations"
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            )}
          </div>
        </aside>

        {/* Right: thread + compose or new message flow */}
        <main className="sms-history-main">
          {composingNewMessage ? (
            <>
              <div className="sms-history-thread-header">
                <div className="sms-history-new-message-header">
                  <h2 className="sms-history-thread-name">New message</h2>
                  <span className="sms-history-thread-phone">
                    Enter a phone number to find an existing conversation or
                    send to a new recipient.
                  </span>
                </div>
              </div>
              <div className="sms-history-new-message-form">
                <div className="sms-history-new-message-field">
                  <label
                    htmlFor="sms-new-phone"
                    className="sms-history-new-message-label"
                  >
                    Phone number
                  </label>
                  <input
                    id="sms-new-phone"
                    type="tel"
                    className="sms-history-new-message-input"
                    placeholder="(555) 555-5555"
                    value={newMessagePhone}
                    onInput={(e) => {
                      const raw = (e.target as HTMLInputElement).value
                        .replace(/\D/g, "")
                        .slice(0, 10);
                      if (raw.length >= 6) {
                        setNewMessagePhone(
                          `(${raw.slice(0, 3)}) ${raw.slice(3, 6)}-${raw.slice(6)}`,
                        );
                      } else if (raw.length >= 3) {
                        setNewMessagePhone(
                          `(${raw.slice(0, 3)}) ${raw.slice(3)}`,
                        );
                      } else {
                        setNewMessagePhone(raw);
                      }
                    }}
                    aria-label="Phone number"
                  />
                </div>
                {newMessagePhoneClean &&
                  isValidPhone(newMessagePhoneClean) &&
                  !newMessageMatchesThread && (
                    <div className="sms-history-new-message-field">
                      <label
                        htmlFor="sms-new-name"
                        className="sms-history-new-message-label"
                      >
                        Recipient name{" "}
                        <span className="sms-history-optional">(optional)</span>
                      </label>
                      <input
                        id="sms-new-name"
                        type="text"
                        className="sms-history-new-message-input"
                        placeholder="e.g. Jane Smith"
                        value={newMessageName}
                        onChange={(e) => setNewMessageName(e.target.value)}
                        aria-label="Recipient name"
                      />
                    </div>
                  )}
              </div>
              {(newMessageMatchesThread ||
                (newMessagePhoneClean &&
                  isValidPhone(newMessagePhoneClean))) && (
                <>
                  {newMessageMatchesThread && (
                    <>
                      <div className="sms-history-thread-header sms-history-thread-header-sub">
                        <div className="sms-history-thread-header-info">
                          <h2 className="sms-history-thread-name">
                            {newMessageMatchesThread.displayName}
                          </h2>
                          <span className="sms-history-thread-phone">
                            {newMessageMatchesThread.displayPhone}
                          </span>
                        </div>
                      </div>
                      <div className="sms-history-thread-messages">
                        {newMessageMatchesThread.messages.map((msg) => (
                          <div
                            key={msg.id}
                            className="sms-history-message-bubble"
                            role="listitem"
                          >
                            <div className="sms-history-message-text">
                              {msg.message}
                            </div>
                            <time
                              className="sms-history-message-time"
                              dateTime={msg.createdTime}
                            >
                              {formatMessageTime(msg.createdTime)}
                            </time>
                          </div>
                        ))}
                        <div ref={threadMessagesEndRef} />
                      </div>
                    </>
                  )}
                  <div className="sms-history-compose">
                    <textarea
                      className="sms-history-compose-input"
                      placeholder="Type a message…"
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
                      className="sms-history-send-btn"
                      onClick={handleSend}
                      disabled={sending || !composeMessage.trim()}
                      aria-label="Send message"
                    >
                      {sending ? (
                        <span className="sms-history-send-btn-text">
                          Sending…
                        </span>
                      ) : (
                        <>
                          <span className="sms-history-send-btn-text">
                            Send
                          </span>
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            aria-hidden
                          >
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                          </svg>
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </>
          ) : selectedThread ? (
            <>
              <div className="sms-history-thread-header">
                <div className="sms-history-thread-header-info">
                  <h2 className="sms-history-thread-name">
                    {selectedThread.displayName}
                  </h2>
                  <span className="sms-history-thread-phone">
                    {selectedThread.displayPhone}
                  </span>
                </div>
              </div>
              <div className="sms-history-thread-messages">
                {selectedThread.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className="sms-history-message-bubble"
                    role="listitem"
                  >
                    <div className="sms-history-message-text">
                      {msg.message}
                    </div>
                    <time
                      className="sms-history-message-time"
                      dateTime={msg.createdTime}
                    >
                      {formatMessageTime(msg.createdTime)}
                    </time>
                  </div>
                ))}
                <div ref={threadMessagesEndRef} />
              </div>
              <div className="sms-history-compose">
                <textarea
                  className="sms-history-compose-input"
                  placeholder="Type a message…"
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
                  className="sms-history-send-btn"
                  onClick={handleSend}
                  disabled={sending || !composeMessage.trim()}
                  aria-label="Send message"
                >
                  {sending ? (
                    <span className="sms-history-send-btn-text">Sending…</span>
                  ) : (
                    <>
                      <span className="sms-history-send-btn-text">Send</span>
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden
                      >
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="sms-history-welcome">
              <div className="sms-history-welcome-icon">
                <svg
                  width="64"
                  height="64"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="sms-history-welcome-title">Text messages</p>
              <p className="sms-history-welcome-text">
                Click <strong>New message</strong> to send to a phone number, or
                select a recipient from the list to view the conversation.
                Search by name or phone to find someone quickly.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
