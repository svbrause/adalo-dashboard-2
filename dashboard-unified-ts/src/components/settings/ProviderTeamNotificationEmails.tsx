import { useCallback, useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import type { Provider } from "../../types";
import { isValidEmail } from "../../utils/validation";
import {
  clearSavedTeamNotificationEmails,
  defaultTeamNotificationEmailsFromProvider,
  getEffectiveTeamNotificationEmails,
  loadSavedTeamNotificationEmails,
  saveTeamNotificationEmails,
} from "../../utils/providerNotificationEmails";
import { showToast } from "../../utils/toast";
import "./ProviderTeamNotificationEmails.css";

type ProviderTeamNotificationEmailsProps = {
  providerId: string;
  provider: Provider | null;
};

export default function ProviderTeamNotificationEmails({
  providerId,
  provider,
}: ProviderTeamNotificationEmailsProps) {
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const syncFromStorage = useCallback(() => {
    setEmails(getEffectiveTeamNotificationEmails(providerId, provider));
    setDraft("");
    setDraftError(null);
  }, [providerId, provider]);

  useEffect(() => {
    syncFromStorage();
  }, [syncFromStorage]);

  const addEmail = useCallback(
    (raw: string) => {
      const t = raw.trim();
      if (!t) return;
      if (!isValidEmail(t)) {
        setDraftError("Enter a valid email address.");
        return;
      }
      setDraftError(null);
      setEmails((prev) => {
        const lower = t.toLowerCase();
        if (prev.some((e) => e.toLowerCase() === lower)) return prev;
        return [...prev, t];
      });
      setDraft("");
    },
    [],
  );

  const removeEmail = useCallback((addr: string) => {
    setEmails((prev) => prev.filter((e) => e !== addr));
  }, []);

  const onSubmitPillForm = (e: FormEvent) => {
    e.preventDefault();
    addEmail(draft);
  };

  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addEmail(draft);
    }
    if (e.key === "Backspace" && !draft && emails.length > 0) {
      removeEmail(emails[emails.length - 1]!);
    }
  };

  const handleSave = () => {
    if (!providerId.trim()) return;
    saveTeamNotificationEmails(providerId, emails);
    setJustSaved(true);
    showToast("Team notification emails saved on this device.");
    window.setTimeout(() => setJustSaved(false), 2500);
  };

  const handleRestoreDefaults = () => {
    if (!providerId.trim()) return;
    clearSavedTeamNotificationEmails(providerId);
    const next = defaultTeamNotificationEmailsFromProvider(provider);
    setEmails(next);
    setDraft("");
    setDraftError(null);
    setJustSaved(false);
    showToast(
      next.length
        ? "Restored — showing Booking Email from your provider record."
        : "Cleared saved list. Add emails below and save.",
    );
  };

  const usingDefaults =
    loadSavedTeamNotificationEmails(providerId) === undefined;

  return (
    <div className="provider-team-email-settings">
      <p className="provider-team-email-settings__lead">
        When you send <strong>help</strong>, <strong>pricing change</strong>,{" "}
        <strong>SMS template</strong>, or <strong>offer</strong> requests from this dashboard, we
        append this list so your team knows who to keep in the loop. Stored on this browser per
        provider code (sign-in).
      </p>
      {usingDefaults ? (
        <p className="provider-team-email-settings__hint">
          Showing the <strong>Booking Email</strong> from your provider record. Save to lock this
          list in, or edit and save to use a different set.
        </p>
      ) : null}

      <form onSubmit={onSubmitPillForm}>
        <label className="visually-hidden" htmlFor="provider-team-email-input">
          Add notification email
        </label>
        <div
          className="provider-team-email-settings__pill-wrap"
          role="group"
          aria-label="Team notification email addresses"
        >
          {emails.map((addr) => (
            <span key={addr} className="provider-team-email-pill">
              <span className="provider-team-email-pill__addr" title={addr}>
                {addr}
              </span>
              <button
                type="button"
                className="provider-team-email-pill__remove"
                onClick={() => removeEmail(addr)}
                aria-label={`Remove ${addr}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            id="provider-team-email-input"
            type="email"
            autoComplete="email"
            className="provider-team-email-settings__input"
            placeholder={emails.length ? "Add another…" : "Add email, then Enter"}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setDraftError(null);
            }}
            onKeyDown={onInputKeyDown}
          />
        </div>
        {draftError ? (
          <p className="settings-muted" style={{ margin: "6px 0 0", fontSize: "0.85rem" }}>
            {draftError}
          </p>
        ) : null}
      </form>

      <div className="provider-team-email-settings__actions">
        <button type="button" className="btn-primary" onClick={handleSave}>
          Save notification list
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={handleRestoreDefaults}
        >
          Restore defaults
        </button>
        {justSaved ? (
          <p className="provider-team-email-settings__saved" role="status">
            Saved
          </p>
        ) : null}
      </div>
    </div>
  );
}
