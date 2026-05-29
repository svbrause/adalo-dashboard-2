import { useCallback, useEffect, useMemo, useState } from "react";
import AuraFaceView from "../aura/AuraFaceView";
import { AiMirrorCanvas } from "../postVisitBlueprint/AiMirrorCanvas";
import "./MerzBlueprintPage.css";

// ── MediaPipe region IDs per treatment ────────────────────────────────────

const TREATMENT_REGION_IDS: Record<string, string[]> = {
  xeomin:    ["rForehead", "rLeftEye", "rRightEye"],
  radiesse:  ["rLeftCheek", "rRightCheek"],
  belotero:  ["rLeftNasolabialFold", "rRightNasolabialFold", "rLips"],
  ultherapy: ["rChin", "rForehead"],
};

// ── Treatment data ────────────────────────────────────────────────────────

type Treatment = {
  id: string;
  number: string;
  name: string;
  genus: string;
  tagline: string;
  whyForYou: string[];
  howItWorks: string;
  facts: { label: string; value: string }[];
  area: string;
  dose: string;
  color: string;
};

const TREATMENTS: Treatment[] = [
  {
    id: "xeomin",
    number: "01",
    name: "Xeomin",
    genus: "incobotulinumtoxinA",
    tagline: "Precision neuromodulator — pure toxin, no complexing proteins",
    whyForYou: [
      "Forehead lines measured at moderate severity in your 3D scan",
      "Crow's feet visible bilaterally — early prevention recommended",
      "Glabellar complex shows a repeated fold pattern between visits",
    ],
    howItWorks:
      "Xeomin is the only approved neuromodulator free of complexing proteins. It temporarily relaxes the muscles responsible for expression lines, delivering naturally softer, rested-looking results without the \"frozen\" appearance.",
    facts: [
      { label: "Duration", value: "3–4 months" },
      { label: "Onset", value: "3–5 days" },
      { label: "Downtime", value: "None" },
      { label: "Frequency", value: "Every 3–4 mo" },
    ],
    area: "Upper Face",
    dose: "24 units",
    color: "#2dd4bf",
  },
  {
    id: "radiesse",
    number: "02",
    name: "Radiesse",
    genus: "calcium hydroxylapatite filler",
    tagline: "Structural filler that restores volume and biostimulates collagen",
    whyForYou: [
      "Midface volume assessment shows early concavity along the cheek arc",
      "Cheek contour analysis indicates reduced lateral projection",
      "CaHA formula builds collagen beyond the initial fill for lasting improvement",
    ],
    howItWorks:
      "Radiesse uses calcium hydroxylapatite microspheres in a gel carrier to immediately restore volume. It simultaneously triggers your own collagen production, delivering up to 18 months of gradual, natural improvement.",
    facts: [
      { label: "Duration", value: "12–18 months" },
      { label: "Onset", value: "Immediate" },
      { label: "Downtime", value: "Minimal (1–2 d)" },
      { label: "Frequency", value: "1–2 per year" },
    ],
    area: "Midface",
    dose: "1.5 cc",
    color: "#c9a962",
  },
  {
    id: "belotero",
    number: "03",
    name: "Belotero Plus",
    genus: "cohesive polydensified matrix HA",
    tagline: "Ultra-natural softening of surface and mid-depth lines",
    whyForYou: [
      "Nasolabial folds graded at mild-moderate depth on both sides",
      "Perioral fine lines visible in your texture scan",
      "CPM technology integrates naturally without the Tyndall effect",
    ],
    howItWorks:
      "Belotero Plus uses a unique cohesive polydensified matrix that integrates within the skin's own dermal structure. This creates exceptionally natural softening of surface and mid-depth lines with no visible product.",
    facts: [
      { label: "Duration", value: "9–12 months" },
      { label: "Onset", value: "Immediate" },
      { label: "Downtime", value: "24–48 hours" },
      { label: "Frequency", value: "1–2 per year" },
    ],
    area: "Lower Face",
    dose: "1 cc",
    color: "#a78bfa",
  },
  {
    id: "ultherapy",
    number: "04",
    name: "Ultherapy Prime",
    genus: "micro-focused ultrasound + visualization",
    tagline: "Non-surgical lift targeting the foundational SMAS layer",
    whyForYou: [
      "Jawline contour analysis shows early soft-tissue laxity",
      "Brow position measured below the ideal aesthetic range",
      "Real-time ultrasound imaging confirms precise energy delivery depth",
    ],
    howItWorks:
      "Ultherapy Prime delivers micro-focused ultrasound energy to the SMAS layer — the same layer addressed in surgical lifts. A natural collagen regeneration response builds over 90–180 days for a gradual, long-lasting lift.",
    facts: [
      { label: "Duration", value: "12–24 months" },
      { label: "Onset", value: "90–180 days" },
      { label: "Downtime", value: "None" },
      { label: "Frequency", value: "1 per year" },
    ],
    area: "Full Face + Neck",
    dose: "1 treatment",
    color: "#60a5fa",
  },
];

type QuoteItem = {
  id: string;
  name: string;
  detail: string;
  price: number;
  displayPrice: string;
  color: string;
};

const QUOTE_ITEMS: QuoteItem[] = [
  { id: "xeomin",    name: "Xeomin",         detail: "Upper Face · 24 units",  price: 600,  displayPrice: "$600",   color: "#2dd4bf" },
  { id: "radiesse",  name: "Radiesse",        detail: "Midface · 1.5 cc",       price: 1100, displayPrice: "$1,100", color: "#c9a962" },
  { id: "belotero",  name: "Belotero Plus",   detail: "Lower Face · 1 cc",      price: 850,  displayPrice: "$850",   color: "#a78bfa" },
  { id: "ultherapy", name: "Ultherapy Prime", detail: "Full Face + Neck",        price: 3200, displayPrice: "$3,200", color: "#60a5fa" },
];

function formatTotal(n: number) {
  return "$" + n.toLocaleString("en-US");
}

// ── Scroll-reveal ─────────────────────────────────────────────────────────

function useScrollReveal(selector: string) {
  useEffect(() => {
    const els = document.querySelectorAll(selector);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("mbp-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.07 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [selector]);
}

const MBP_SCROLL_HEADER_OFFSET = 60;
const MBP_SCROLL_DURATION_MS = 950;

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
}

function smoothScrollToSection(id: string) {
  const target = document.getElementById(id);
  if (!target) return;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const top =
    target.getBoundingClientRect().top + window.scrollY - MBP_SCROLL_HEADER_OFFSET;

  if (prefersReducedMotion) {
    window.scrollTo(0, top);
    return;
  }

  const start = window.scrollY;
  const distance = top - start;
  if (Math.abs(distance) < 2) return;

  const startTime = performance.now();

  function step(now: number) {
    const progress = Math.min((now - startTime) / MBP_SCROLL_DURATION_MS, 1);
    window.scrollTo(0, start + distance * easeInOutCubic(progress));
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

/** Smooth in-page scroll for treatment section links (Explore plan, header pills, etc.). */
function useSmoothSectionScroll() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest('a[href^="#treatment-"]');
      if (!(link instanceof HTMLAnchorElement)) return;

      const id = link.hash.slice(1);
      if (!id || !document.getElementById(id)) return;

      event.preventDefault();
      smoothScrollToSection(id);
      history.replaceState(null, "", `#${id}`);
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
}

// ── Face region card ──────────────────────────────────────────────────────

function TreatmentFaceCard({ treatmentId, color, dose, area }: {
  treatmentId: string; color: string; dose: string; area: string;
}) {
  return (
    <div className="mbp-face-hl">
      <div className="mbp-face-hl-inner">
        <AiMirrorCanvas
          imageUrl="/demo-3d/tanya-tan-front.png"
          alt="Tanya M — treatment area"
          highlightedRegionIds={TREATMENT_REGION_IDS[treatmentId] ?? []}
          showAnnotations
        />
        <div className="mbp-face-hl-badge">
          <span className="mbp-face-hl-badge-area">{area}</span>
          <span className="mbp-face-hl-badge-dose" style={{ color, borderColor: `${color}44` }}>
            {dose}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Treatment section ─────────────────────────────────────────────────────

function TreatmentSection({ t, index }: { t: Treatment; index: number }) {
  const isEven = index % 2 === 0;

  const textCol = (
    <div className="mbp-treatment-left">
      <div className="mbp-treatment-header">
        <div className="mbp-treatment-num-row">
          <span className="mbp-treatment-num">{t.number}</span>
          <div className="mbp-treatment-accent-line" style={{ background: t.color }} />
        </div>
        <h2
          className="mbp-treatment-name"
          style={{
            background: `linear-gradient(120deg, #f0f2f6 25%, ${t.color} 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          {t.name}
        </h2>
        <p className="mbp-treatment-genus">{t.genus}</p>
        <p className="mbp-treatment-tagline">{t.tagline}</p>
      </div>

      <p className="mbp-treatment-section-label" style={{ color: t.color }}>Why for Tanya M</p>
      <ul className="mbp-why-list">
        {t.whyForYou.map((reason) => (
          <li key={reason} className="mbp-why-item">
            <span className="mbp-why-check" style={{ background: `${t.color}20`, color: t.color, border: `1px solid ${t.color}40` }}>✓</span>
            {reason}
          </li>
        ))}
      </ul>

      <p className="mbp-treatment-section-label" style={{ color: t.color }}>How it works</p>
      <p className="mbp-how-body">{t.howItWorks}</p>

      <p className="mbp-treatment-section-label" style={{ color: t.color }}>Quick facts</p>
      <div className="mbp-facts">
        {t.facts.map((f) => (
          <div key={f.label} className="mbp-fact" style={{ borderColor: `${t.color}22` }}>
            <div className="mbp-fact-label">{f.label}</div>
            <div className="mbp-fact-value">{f.value}</div>
          </div>
        ))}
      </div>
    </div>
  );

  const faceCol = (
    <div className="mbp-treatment-right">
      <TreatmentFaceCard treatmentId={t.id} color={t.color} dose={t.dose} area={t.area} />
    </div>
  );

  return (
    <div
      className={`mbp-treatment mbp-treatment--${t.id}`}
      style={{ background: isEven ? "var(--mbp-bg)" : "linear-gradient(160deg, var(--mbp-bg2) 0%, var(--mbp-bg) 100%)" }}
    >
      {isEven ? <>{textCol}{faceCol}</> : <>{faceCol}{textCol}</>}
    </div>
  );
}

// ── Booking drawer ────────────────────────────────────────────────────────

type DrawerStep = "plan" | "contact" | "sent";

function BookingDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState<DrawerStep>("plan");
  const [selected, setSelected] = useState<Set<string>>(
    new Set(QUOTE_ITEMS.map((q) => q.id)),
  );
  const [name, setName]   = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote]   = useState("");

  const selectedItems = QUOTE_ITEMS.filter((q) => selected.has(q.id));
  const selectedTotal = useMemo(
    () => selectedItems.reduce((acc, q) => acc + q.price, 0),
    [selectedItems],
  );

  const toggleItem = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleClose = useCallback(() => {
    onClose();
    // Reset after close animation
    setTimeout(() => { setStep("plan"); setName(""); setEmail(""); setNote(""); }, 350);
  }, [onClose]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setStep("sent");
    },
    [],
  );

  // Trap body scroll when open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Overlay */}
      <div
        className={`mbp-drawer-overlay${open ? " mbp-drawer-overlay--open" : ""}`}
        onClick={handleClose}
        aria-hidden
      />

      {/* Panel */}
      <div
        className={`mbp-drawer${open ? " mbp-drawer--open" : ""}`}
        role="dialog"
        aria-modal
        aria-hidden={!open}
        inert={open ? undefined : ""}
        aria-label="Express interest in your treatment plan"
      >
        {/* Pull handle (mobile) */}
        <div className="mbp-drawer-handle" onClick={handleClose} />

        {/* Header */}
        <div className="mbp-drawer-header">
          <h2 className="mbp-drawer-title">
            {step === "plan"    ? "Your treatment plan"
              : step === "contact" ? "Your details"
              : "Request sent"}
          </h2>
          <button className="mbp-drawer-close" onClick={handleClose} aria-label="Close">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="3" y1="3" x2="13" y2="13" />
              <line x1="13" y1="3" x2="3" y2="13" />
            </svg>
          </button>
        </div>

        {/* ── Step 1: Treatment selection ── */}
        {step === "plan" && (
          <div className="mbp-drawer-body">
            <p className="mbp-drawer-intro">
              Select the treatments you'd like to discuss with your provider, then send a booking request.
            </p>

            <ul className="mbp-drawer-items">
              {QUOTE_ITEMS.map((item) => {
                const isChecked = selected.has(item.id);
                return (
                  <li key={item.id}>
                    <label className={`mbp-drawer-item${isChecked ? " mbp-drawer-item--checked" : ""}`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleItem(item.id)}
                        className="mbp-drawer-checkbox"
                      />
                      <span className="mbp-drawer-item-check" style={{ borderColor: isChecked ? item.color : undefined, background: isChecked ? `${item.color}22` : undefined }}>
                        {isChecked && (
                          <svg viewBox="0 0 12 12" fill="none" stroke={item.color} strokeWidth="2" strokeLinecap="round">
                            <polyline points="2 6 5 9 10 3" />
                          </svg>
                        )}
                      </span>
                      <span className="mbp-drawer-item-info">
                        <span className="mbp-drawer-item-name" style={{ color: isChecked ? item.color : undefined }}>
                          {item.name}
                        </span>
                        <span className="mbp-drawer-item-detail">{item.detail}</span>
                      </span>
                      <span className="mbp-drawer-item-price">{item.displayPrice}</span>
                    </label>
                  </li>
                );
              })}
            </ul>

            <div className="mbp-drawer-total">
              <span className="mbp-drawer-total-label">
                {selectedItems.length === 0
                  ? "No treatments selected"
                  : `${selectedItems.length} treatment${selectedItems.length > 1 ? "s" : ""} selected`}
              </span>
              <span className="mbp-drawer-total-amt">{formatTotal(selectedTotal)}</span>
            </div>

            <button
              className="mbp-btn mbp-btn--primary mbp-btn--full mbp-btn--lg"
              disabled={selectedItems.length === 0}
              onClick={() => setStep("contact")}
            >
              Continue →
            </button>
          </div>
        )}

        {/* ── Step 2: Contact form ── */}
        {step === "contact" && (
          <form className="mbp-drawer-body" onSubmit={handleSubmit}>
            <p className="mbp-drawer-intro">
              Your provider will reach out to schedule a consultation and confirm availability.
            </p>

            <div className="mbp-drawer-selected-summary">
              {selectedItems.map((item) => (
                <span key={item.id} className="mbp-drawer-selected-pill" style={{ color: item.color, borderColor: `${item.color}44` }}>
                  {item.name}
                </span>
              ))}
            </div>

            <div className="mbp-form-fields">
              <div className="mbp-form-field">
                <label className="mbp-form-label" htmlFor="mbp-name">Name <span aria-hidden>*</span></label>
                <input
                  id="mbp-name"
                  className="mbp-form-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  required
                  autoComplete="name"
                />
              </div>
              <div className="mbp-form-field">
                <label className="mbp-form-label" htmlFor="mbp-email">Email <span aria-hidden>*</span></label>
                <input
                  id="mbp-email"
                  className="mbp-form-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div className="mbp-form-field">
                <label className="mbp-form-label" htmlFor="mbp-note">Note <span className="mbp-form-optional">(optional)</span></label>
                <textarea
                  id="mbp-note"
                  className="mbp-form-input mbp-form-textarea"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Any questions or preferred timing…"
                  rows={3}
                />
              </div>
            </div>

            <div className="mbp-drawer-form-actions">
              <button type="button" className="mbp-btn mbp-btn--ghost" onClick={() => setStep("plan")}>
                ← Back
              </button>
              <button type="submit" className="mbp-btn mbp-btn--primary mbp-btn--lg">
                Send request
              </button>
            </div>
          </form>
        )}

        {/* ── Step 3: Success ── */}
        {step === "sent" && (
          <div className="mbp-drawer-body mbp-drawer-success">
            <div className="mbp-success-icon">
              <svg viewBox="0 0 40 40" fill="none" stroke="#2dd4bf" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="20" cy="20" r="18" stroke="#2dd4bf" strokeOpacity="0.3" />
                <polyline points="12 20 17 26 28 14" />
              </svg>
            </div>
            <h3 className="mbp-success-title">Request sent</h3>
            <p className="mbp-success-body">
              Your provider has been notified and will reach out to schedule your consultation for{" "}
              <strong>{selectedItems.map((i) => i.name).join(", ")}</strong>.
            </p>
            <button className="mbp-btn mbp-btn--ghost mbp-btn--full" onClick={handleClose}>
              Done
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ── Sticky booking bar ────────────────────────────────────────────────────

function StickyBookBar({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="mbp-book-bar">
      <div className="mbp-book-bar-info">
        <span className="mbp-book-bar-label">4 treatments · 1 visit</span>
        <span className="mbp-book-bar-total">$5,750</span>
      </div>
      <button className="mbp-book-bar-btn" onClick={onOpen}>
        Express interest
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <line x1="3" y1="8" x2="13" y2="8" />
          <polyline points="9 4 13 8 9 12" />
        </svg>
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function MerzBlueprintPage() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  useScrollReveal(".mbp-treatment");
  useScrollReveal(".mbp-investment");
  useSmoothSectionScroll();

  const openDrawer  = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <div className="mbp-root">

      {/* ── Fixed header ─────────────────────────────────────── */}
      <header className="mbp-header">
        <div className="mbp-header-brand">
          <img src="/branding/ponce-dark-mode.png" alt="Ponce AI" className="mbp-logo-img" />
          <div className="mbp-header-sep" />
          <span className="mbp-header-patient">
            Treatment plan for <strong>Tanya M</strong>
          </span>
        </div>
        <nav className="mbp-header-nav">
          {TREATMENTS.map((t) => (
            <a key={t.id} href={`#treatment-${t.id}`} className="mbp-header-pill">{t.name}</a>
          ))}
          <button className="mbp-header-pill mbp-header-pill--cta" onClick={openDrawer}>
            Express interest
          </button>
        </nav>
      </header>

      {/* ── Hero — visual first ───────────────────────────────── */}
      <section className="mbp-hero">
        {/* Face viewer dominates */}
        <div className="mbp-hero-right">
          <div className="mbp-hero-face-wrap">
            <AuraFaceView
              embedded
              turntableOnly
              disableWheelZoom
              initialZoom={1.18}
              initialPanY={-28}
            />
          </div>
        </div>

        {/* Right column — minimal text + plan items */}
        <div className="mbp-hero-left">
          <div className="mbp-hero-eyebrow">
            <span className="mbp-eyebrow-brand">Ponce AI</span>
            <div className="mbp-eyebrow-sep" />
            <span className="mbp-eyebrow-sub">Personalized treatment plan</span>
          </div>

          <h1 className="mbp-hero-name">Tanya M</h1>

          <p className="mbp-hero-tagline">
            4 scan-backed treatments · one visit
          </p>

          {/* Plan grid — desktop only (mobile uses the strip below) */}
          <div className="mbp-hero-plan-grid" aria-label="Your plan">
            {TREATMENTS.map((t) => (
              <a
                key={t.id}
                href={`#treatment-${t.id}`}
                className="mbp-hero-plan-item"
                style={{ textDecoration: "none" }}
              >
                <span className="mbp-hero-plan-num" style={{ color: t.color }}>
                  {t.number}
                </span>
                <div>
                  <div className="mbp-hero-plan-name">{t.name}</div>
                  <div className="mbp-hero-plan-area">{t.area} · {t.dose}</div>
                </div>
              </a>
            ))}
          </div>

          <div className="mbp-hero-ctas">
            <a href="#treatment-xeomin" className="mbp-btn mbp-btn--primary">
              Explore plan ↓
            </a>
            <button className="mbp-btn mbp-btn--ghost" onClick={openDrawer}>
              Express interest
            </button>
          </div>
        </div>
      </section>

      {/* ── Plan strip — mobile only ──────────────────────────── */}
      <div className="mbp-plan-strip">
        <div className="mbp-plan-strip-items">
          {TREATMENTS.map((t) => (
            <a key={t.id} href={`#treatment-${t.id}`} className="mbp-plan-strip-item" style={{ textDecoration: "none" }}>
              <span className="mbp-strip-num" style={{ color: t.color }}>{t.number}</span>
              <div>
                <div className="mbp-strip-name">{t.name}</div>
                <div className="mbp-strip-area">{t.area} · {t.dose}</div>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* ── Treatment sections ───────────────────────────────── */}
      <section className="mbp-treatments">
        {TREATMENTS.map((t, i) => (
          <div key={t.id} id={`treatment-${t.id}`}>
            <TreatmentSection t={t} index={i} />
          </div>
        ))}
      </section>

      {/* ── Investment ───────────────────────────────────────── */}
      <section id="investment" className="mbp-investment mbp-investment--single">
        <p className="mbp-section-kicker">Your investment</p>
        <h2 className="mbp-section-title">A complete plan, one visit</h2>
        <p className="mbp-section-body">
          All four treatments can be sequenced in a single appointment in the optimal order.
        </p>

        <div className="mbp-quote-items">
          {QUOTE_ITEMS.map((item) => (
            <div key={item.id} className="mbp-quote-item">
              <div className="mbp-quote-item-info">
                <span className="mbp-quote-item-name" style={{ color: item.color }}>{item.name}</span>
                <span className="mbp-quote-item-detail">{item.detail}</span>
              </div>
              <span className="mbp-quote-item-price">{item.displayPrice}</span>
            </div>
          ))}
        </div>

        <div className="mbp-quote-total">
          <span className="mbp-quote-total-label">Total investment</span>
          <span className="mbp-quote-total-amount">$5,750</span>
        </div>

        <button
          className="mbp-btn mbp-btn--primary mbp-btn--full mbp-btn--lg"
          onClick={openDrawer}
        >
          Express interest in this plan
        </button>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="mbp-footer">
        <img src="/branding/ponce-dark-mode.png" alt="Ponce AI" className="mbp-logo-img mbp-logo-img--sm" />
        <p className="mbp-footer-note">
          This treatment plan was generated based on a 3D facial analysis scan.
          All recommendations are subject to a formal clinical consultation.
          Individual results may vary.
        </p>
        <span className="mbp-footer-pow">Powered by <span>Ponce AI</span></span>
      </footer>

      {/* ── Sticky booking bar ───────────────────────────────── */}
      <StickyBookBar onOpen={openDrawer} />

      {/* ── Booking drawer ───────────────────────────────────── */}
      <BookingDrawer open={drawerOpen} onClose={closeDrawer} />

    </div>
  );
}
