import { useState, useEffect, useMemo } from "react";
import { fetchDoctorAdviceRequests } from "../../services/api";
import type { Client, DoctorAdviceRequest } from "../../types";
import { useDashboard } from "../../context/DashboardContext";
import { formatProviderDisplayName } from "../../utils/providerHelpers";
import { formatDate } from "../../utils/dateFormatting";
import { formatPhoneDisplay, cleanPhoneNumber } from "../../utils/validation";
import ClientDetailPanel from "./ClientDetailPanel";
import SendSMSModal from "../modals/SendSMSModal";
import "./InboxView.css";

function formatInboxDate(createdTime: string | undefined): string {
  if (!createdTime) return "";
  try {
    const d = new Date(createdTime);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return createdTime;
  }
}

function getFrontPhotoUrl(client: Client | undefined): string | null {
  if (!client?.frontPhoto || !Array.isArray(client.frontPhoto) || client.frontPhoto.length === 0) return null;
  const attachment = client.frontPhoto[0] as { thumbnails?: { large?: { url: string }; full?: { url: string } }; url?: string };
  return attachment.thumbnails?.large?.url ?? attachment.thumbnails?.full?.url ?? attachment.url ?? null;
}

/** Collect treatment interests for display: goals + discussed treatment names. */
function getInterestedTreatments(client: Client | undefined): string[] {
  if (!client) return [];
  const fromGoals = Array.isArray(client.goals) ? client.goals.filter(Boolean) : [];
  const fromDiscussed = (client.discussedItems ?? [])
    .map((d) => d.treatment)
    .filter(Boolean);
  const seen = new Set<string>();
  [...fromGoals, ...fromDiscussed].forEach((t) => {
    const key = String(t).trim();
    if (key) seen.add(key);
  });
  return Array.from(seen);
}

const DEDUPE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/** One display entry: representative request plus optional merged message and count. */
export interface DedupedInboxEntry {
  request: DoctorAdviceRequest;
  duplicateCount: number;
  mergedMessage: string;
}

/**
 * Deduplicate requests: same patient (by patientId or email) with submissions within 5 minutes
 * are collapsed into one entry. Uses the most recent request; merges message text from others in the window.
 */
function deduplicateRequests(requests: DoctorAdviceRequest[]): DedupedInboxEntry[] {
  function patientKey(r: DoctorAdviceRequest): string {
    if (r.patientId) return `patient:${r.patientId}`;
    return `email:${(r.patientEmail || "").trim().toLowerCase()}`;
  }

  const byPatient = new Map<string, DoctorAdviceRequest[]>();
  for (const r of requests) {
    const key = patientKey(r);
    if (!byPatient.has(key)) byPatient.set(key, []);
    byPatient.get(key)!.push(r);
  }

  const entries: DedupedInboxEntry[] = [];
  for (const group of byPatient.values()) {
    const sorted = [...group].sort((a, b) => {
      const tA = a.createdTime ? new Date(a.createdTime).getTime() : 0;
      const tB = b.createdTime ? new Date(b.createdTime).getTime() : 0;
      return tB - tA; // newest first
    });
    let i = 0;
    while (i < sorted.length) {
      const newest = sorted[i];
      const newestTime = newest.createdTime ? new Date(newest.createdTime).getTime() : 0;
      const cluster: DoctorAdviceRequest[] = [newest];
      for (let j = i + 1; j < sorted.length; j++) {
        const other = sorted[j];
        const otherTime = other.createdTime ? new Date(other.createdTime).getTime() : 0;
        if (newestTime - otherTime <= DEDUPE_WINDOW_MS) cluster.push(other);
        else break;
      }
      i += cluster.length;
      const messages = cluster.map((r) => (r.patientNote || "").trim()).filter(Boolean);
      const mergedMessage = messages.length > 0 ? messages.join("\n\n---\n\n") : "";
      entries.push({
        request: newest,
        duplicateCount: cluster.length,
        mergedMessage: mergedMessage || (newest.patientNote || ""),
      });
    }
  }
  entries.sort((a, b) => {
    const tA = a.request.createdTime ? new Date(a.request.createdTime).getTime() : 0;
    const tB = b.request.createdTime ? new Date(b.request.createdTime).getTime() : 0;
    return tB - tA;
  });
  return entries;
}

export default function InboxView() {
  const { clients, refreshClients } = useDashboard();
  const [requests, setRequests] = useState<DoctorAdviceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [smsClient, setSmsClient] = useState<Client | null>(null);

  const dedupedEntries = useMemo(() => deduplicateRequests(requests), [requests]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await fetchDoctorAdviceRequests();
      const sorted = [...data].sort((a, b) => {
        const tA = a.createdTime ? new Date(a.createdTime).getTime() : 0;
        const tB = b.createdTime ? new Date(b.createdTime).getTime() : 0;
        return tB - tA;
      });
      setRequests(sorted);
      setError(null);
    } catch (err: unknown) {
      console.error("Failed to load inbox requests:", err);
      setError(err instanceof Error ? err.message : "Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  if (loading) {
    return (
      <div className="inbox-view">
        <div className="inbox-loading">
          <div className="spinner spinner-with-margin" />
          <p>Loading inbox...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="inbox-view">
        <div className="inbox-error">
          <p>Error: {error}</p>
          <button type="button" className="inbox-retry-btn" onClick={loadRequests}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="inbox-view">
      <div className="inbox-header">
        <h1 className="inbox-title">Inbox</h1>
        <button
          type="button"
          className="inbox-refresh-btn"
          onClick={loadRequests}
          aria-label="Refresh"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Refresh
        </button>
      </div>

      <p className="inbox-description">
        Patient requests for advice or follow-up. Reply to the patient directly using the email shown.
      </p>

      <div className="inbox-list">
        {dedupedEntries.length === 0 ? (
          <div className="inbox-empty">
            No requests yet. When patients submit a request for advice, it will appear here.
          </div>
        ) : (
          dedupedEntries.map((entry) => {
            const req = entry.request;
            const linkedClient = req.patientId ? clients.find((c) => c.id === req.patientId) : undefined;
            const photoUrl = getFrontPhotoUrl(linkedClient);
            const interestedTreatments = getInterestedTreatments(linkedClient);
            return (
              <article key={req.id} className="inbox-card">
                <div className="inbox-card-top">
                  {req.createdTime && (
                    <time className="inbox-card-date" dateTime={req.createdTime}>
                      Request received {formatInboxDate(req.createdTime)}
                    </time>
                  )}
                  {entry.duplicateCount > 1 && (
                    <span className="inbox-card-duplicate-badge" title={`${entry.duplicateCount} requests within 5 minutes`}>
                      {entry.duplicateCount} requests
                    </span>
                  )}
                </div>
                <div className="inbox-card-layout">
                  {photoUrl && (
                    <div className="inbox-card-photo-wrap">
                      <img src={photoUrl} alt="" className="inbox-card-photo" />
                    </div>
                  )}
                  <div className="inbox-card-main">
                    {/* Contact section: heading = client name, then phone/email + actions */}
                    <section className="inbox-contact-section">
                      <h3 className="inbox-contact-heading">
                        {linkedClient?.name || req.patientEmail || "Contact"}
                      </h3>
                      <div className="inbox-contact-details">
                        {(linkedClient?.phone || req.patientEmail) && (
                          <div className="inbox-contact-row">
                            {linkedClient?.phone && (
                              <span className="inbox-contact-phone">
                                {formatPhoneDisplay(linkedClient.phone)}
                              </span>
                            )}
                            <span className="inbox-contact-email">
                              <a href={`mailto:${req.patientEmail}`} className="inbox-card-email">
                                {req.patientEmail || "—"}
                              </a>
                            </span>
                          </div>
                        )}
                        <div className="inbox-contact-actions">
                          {linkedClient?.phone && (
                            <>
                              <a
                                href={`tel:+1${cleanPhoneNumber(linkedClient.phone)}`}
                                className="inbox-action-btn inbox-action-call"
                                title="Call"
                              >
                                Call
                              </a>
                              <button
                                type="button"
                                className="inbox-action-btn inbox-action-sms"
                                onClick={() => setSmsClient(linkedClient)}
                                title="Send SMS"
                              >
                                SMS
                              </button>
                            </>
                          )}
                          <a
                            href={`mailto:${req.patientEmail}`}
                            className="inbox-action-btn inbox-action-email"
                            title="Email"
                          >
                            Email
                          </a>
                          {linkedClient && (
                            <button
                              type="button"
                              className="inbox-action-btn inbox-action-view"
                              onClick={() => setSelectedClient(clients.find((c) => c.id === linkedClient.id) ?? linkedClient)}
                              title="View client details"
                            >
                              View client
                            </button>
                          )}
                        </div>
                      </div>
                    </section>
                    <dl className="inbox-card-details">
                      {req.source && (
                        <div className="inbox-detail-row">
                          <dt>Source</dt>
                          <dd><span className="inbox-card-source">{req.source}</span></dd>
                        </div>
                      )}
                      {linkedClient?.appointmentStaffName && (
                        <div className="inbox-detail-row">
                          <dt>Provider</dt>
                          <dd>{formatProviderDisplayName(linkedClient.appointmentStaffName)}</dd>
                        </div>
                      )}
                      {linkedClient?.locationName && (
                        <div className="inbox-detail-row">
                          <dt>Location</dt>
                          <dd>{linkedClient.locationName}</dd>
                        </div>
                      )}
                      {linkedClient?.appointmentDate && (
                        <div className="inbox-detail-row">
                          <dt>Appointment</dt>
                          <dd>{formatDate(linkedClient.appointmentDate)}</dd>
                        </div>
                      )}
                    </dl>
                    {interestedTreatments.length > 0 && (
                      <div className="inbox-interests">
                        <span className="inbox-interests-label">Interested in:</span>
                        <span className="inbox-interests-list">{interestedTreatments.join(", ")}</span>
                      </div>
                    )}
                    {entry.mergedMessage ? (
                      <div className="inbox-card-note-block">
                        <span className="inbox-card-note-label">Message</span>
                        <div className="inbox-card-note">{entry.mergedMessage}</div>
                      </div>
                    ) : (
                      <div className="inbox-card-note-block">
                        <span className="inbox-card-note-label">Message</span>
                        <div className="inbox-card-note inbox-card-note-empty">No message provided.</div>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      {selectedClient && (
        <ClientDetailPanel
          client={clients.find((c) => c.id === selectedClient.id) ?? selectedClient}
          onClose={() => setSelectedClient(null)}
          onUpdate={() => refreshClients(true)}
        />
      )}

      {smsClient && (
        <SendSMSModal
          client={smsClient}
          onClose={() => setSmsClient(null)}
          onSuccess={() => setSmsClient(null)}
        />
      )}
    </div>
  );
}
