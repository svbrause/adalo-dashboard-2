import { useEffect, useRef, useState } from "react";
import "./ClientContactMenu.css";

export type ClientContactMenuProps = {
  phone?: string | null;
  email?: string | null;
  onCall: () => void;
  onEmail: () => void;
  onMessages: () => void;
};

function IconPhone() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

export default function ClientContactMenu({
  phone,
  email,
  onCall,
  onEmail,
  onMessages,
}: ClientContactMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const hasPhone = Boolean(phone?.trim());
  const hasEmail = Boolean(email?.trim());

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div className="cdp-contact-menu" ref={rootRef}>
      <button
        type="button"
        className={`cdp-contact-menu__trigger${open ? " cdp-contact-menu__trigger--open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Contact options"
        title="Call, email, or message"
      >
        <IconPhone />
      </button>
      {open ? (
        <div className="cdp-contact-menu__panel" role="menu">
          <button
            type="button"
            role="menuitem"
            className="cdp-contact-menu__item"
            disabled={!hasPhone}
            onClick={() => run(onCall)}
          >
            Call
            {hasPhone ? (
              <span className="cdp-contact-menu__hint cdp-contact-menu__hint--value">
                {phone!.trim()}
              </span>
            ) : (
              <span className="cdp-contact-menu__hint cdp-contact-menu__hint--muted">
                No phone
              </span>
            )}
          </button>
          <button
            type="button"
            role="menuitem"
            className="cdp-contact-menu__item"
            disabled={!hasEmail}
            onClick={() => run(onEmail)}
          >
            Email
            {hasEmail ? (
              <span className="cdp-contact-menu__hint cdp-contact-menu__hint--value">
                {email!.trim()}
              </span>
            ) : (
              <span className="cdp-contact-menu__hint cdp-contact-menu__hint--muted">
                No email
              </span>
            )}
          </button>
          <button
            type="button"
            role="menuitem"
            className="cdp-contact-menu__item"
            disabled={!hasPhone}
            onClick={() => run(onMessages)}
          >
            Messages
            <span className="cdp-contact-menu__hint">
              {hasPhone ? "SMS" : "No phone"}
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
