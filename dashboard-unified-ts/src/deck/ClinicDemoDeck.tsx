import React, { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  assetSrc,
  dashboardOrigin,
  encodeBlueprintForUrl,
  LinkButton,
  ParticleCanvas,
  PingPongVideo,
  Slide,
  SplitSlide,
  StoryVisual,
} from "./DeckPrimitives";

// ─── Speaker notes ────────────────────────────────────────────────────────────

const SLIDE_NOTES = [
  // 0 — Title
  "Welcome the team. This session covers configuration, workflow, and launch planning. Goal: leave with clear decisions and a go-live date.",
  // 1 — Outcomes
  "Walk through each outcome to set expectations. By the end: patient journey mapped, scan workflow configured, catalog confirmed, and a launch date set.",
  // 2 — Big Idea
  "The core problem: consult goes well in the room, but intent fades once the patient walks out. Brochure and quote, no context. Ponce creates a scan-backed plan they can revisit — higher acceptance and stronger follow-through.",
  // 3 — Patient Journey
  "Ponce touches all four stages. Before: website and social drive discovery. During: provider uses visual findings to guide the conversation. After: patient revisits the plan at home. Follow-up: staff picks up from the same context, no cold start.",
  // 4 — Core Workflow
  "Three steps, that's the whole system. Scan from any device the clinic already has. AI maps findings to relevant treatments and skincare. Patient gets one link. Everything else is built around this loop.",
  // 5 — Digital Twin
  "One still capture creates the 3D reference both sides look at together. Works on any phone, tablet, or consult room screen. Helps explain concerns without relying on verbal description alone.",
  // 6 — In-Clinic Setup
  "Two decisions to make right now: who captures the scan and when it happens. Most clinics start with the MA capturing at rooming. Quiz goes out via SMS at the same time.",
  // 7 — Treatment Recommender
  "Each recommendation ties back to the scan. Provider can say 'here's why this makes sense for you specifically.' Replaces generic upsell with personalized rationale. Patients accept more when the reasoning is visible.",
  // 8 — Catalog
  "Confirm which treatments and products appear, in what order, and whether any should be prioritized or suppressed. Also decide pricing visibility and packages. Start with the price list.",
  // 9 — Analysis
  "Three lenses: texture, redness, pores. Each highlights specific findings on the face map. Walk through findings together so the patient understands the reasoning, not just the price.",
  // 10 — Skincare
  "The skin quiz takes under 60 seconds. Maps skin type, goals, and habits to a personalized routine. Skincare keeps patients engaged between visits and positions the clinic as a long-term care partner.",
  // 11 — Patient Plan
  "One link, works on any phone — no app required. Patient can share with a partner, revisit before booking, or reference it when a coordinator calls. Includes scan summary, recommended plan, and a next-step CTA.",
  // 12 — Follow-Up
  "Staff sees when the plan was opened and what was reviewed. Follow-up calls start with context: 'I saw you looked at the Moxi recommendation' instead of 'just checking in.' Same conversation, not cold outreach.",
  // 13 — Launch Plan
  "Four phases: Configure → Train → Soft Launch → Go Live. Soft launch starts with one provider or one day of appointments. Builds confidence before full rollout.",
  // 14 — Decisions
  "Three things needed before configure starts: catalog inputs (use price list), go-live date (schedule a call), and completed onboarding sheet. Capture an owner and target date for each right now.",
  // 15 — Closing
  "Wrap up and thank the team. Reiterate the value: scan-backed plans patients revisit, more structured consults, stronger follow-through. Next meeting: configuration review, then staff training before go-live.",
] as const;

// ─── Notes panel ─────────────────────────────────────────────────────────────

function NotesPanel({ open, notes }: { open: boolean; notes: string }) {
  return (
    <div className={`notes-panel${open ? " notes-panel--open" : ""}`} aria-hidden={!open}>
      <div className="notes-panel-inner">
        <span className="notes-label">Notes</span>
        <p className="notes-text">{notes}</p>
      </div>
    </div>
  );
}

// ─── ContentSlide — full-width, no split ──────────────────────────────────────

function ContentSlide({
  active,
  label,
  title,
  className,
  children,
}: {
  active: boolean;
  label: string;
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Slide active={active} className={["slide--content", className ?? ""].filter(Boolean).join(" ")}>
      <div className="label">{label}</div>
      <h1>{title}</h1>
      <div className="content-area">{children}</div>
    </Slide>
  );
}

// ─── Design tokens (inline, matching CSS vars) ────────────────────────────────

const TEAL   = "#2dd4bf";
const GOLD   = "#c9a962";
const MUTED  = "rgba(255,255,255,0.45)";
const TEXT   = "rgba(255,255,255,0.88)";
const BORDER = "rgba(255,255,255,0.07)";

// ─── Slide 1: Title ───────────────────────────────────────────────────────────

function TitleSlide({ active }: { active: boolean }) {
  return (
    <Slide active={active} className="slide--hero-bg title-slide">
      <img className="logo-img logo-img--hero" src={assetSrc("public/demo-3d/dark_mode_logo.png")} alt="Ponce AI" width={1580} height={456} />
      <div className="title-video-box">
        <PingPongVideo active={active} preload="auto" src="src/assets/images/turntable_2048_black.mp4" ariaLabel="Rotating 3D digital twin" />
      </div>
      <h1>Ponce AI Onboarding &amp; <span className="shimmer">Launch Workshop</span></h1>
      <p className="powered-by">Powered by <strong>Ponce AI</strong></p>
    </Slide>
  );
}

// ─── Slide 2: Outcomes ────────────────────────────────────────────────────────

const OUTCOMES = [
  { n: "01", label: "Align on the\npatient journey" },
  { n: "02", label: "Configure\nworkflows" },
  { n: "03", label: "Confirm the\ntreatment catalog" },
  { n: "04", label: "Set the\nlaunch date" },
] as const;

function OutcomesContent() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "1rem" }}>
      {OUTCOMES.map((item, i) => (
        <div
          key={item.n}
          style={{
            padding: "1.75rem 1.25rem",
            background: i % 2 === 0 ? `${TEAL}08` : `${GOLD}08`,
            border: `1px solid ${i % 2 === 0 ? TEAL : GOLD}22`,
            borderRadius: "0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            alignItems: "flex-start",
          }}
        >
          <span style={{ fontSize: "1.65rem", fontWeight: 800, color: i % 2 === 0 ? TEAL : GOLD, lineHeight: 1, letterSpacing: "-0.02em" }}>{item.n}</span>
          <span style={{ fontSize: "0.88rem", color: TEXT, lineHeight: 1.4, whiteSpace: "pre-line" }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Slide 3: Big Idea ────────────────────────────────────────────────────────

function BigIdeaContent() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
      {/* Before */}
      <div style={{ padding: "1.75rem", background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.18)", borderRadius: "0.75rem" }}>
        <p style={{ fontSize: "0.6rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "#f87171", fontWeight: 700, marginBottom: "1.25rem" }}>Traditional consult</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {["Verbal explanation only", "Brochure or scattered notes", "Intent fades after the visit"].map((t) => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ color: "#f87171", fontSize: "1.1rem", flexShrink: 0, lineHeight: 1 }}>✕</span>
              <span style={{ fontSize: "1rem", color: "rgba(255,255,255,0.5)" }}>{t}</span>
            </div>
          ))}
        </div>
      </div>
      {/* After */}
      <div style={{ padding: "1.75rem", background: `${TEAL}07`, border: `1px solid ${TEAL}28`, borderRadius: "0.75rem" }}>
        <p style={{ fontSize: "0.6rem", letterSpacing: "0.14em", textTransform: "uppercase", color: TEAL, fontWeight: 700, marginBottom: "1.25rem" }}>Ponce-supported</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {["Scan-backed visual plan", "Patient revisits the link", "Staff follows up from context"].map((t) => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ color: TEAL, fontSize: "1.1rem", flexShrink: 0, lineHeight: 1 }}>✓</span>
              <span style={{ fontSize: "1rem", color: TEXT }}>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Slide 4: Patient Journey ─────────────────────────────────────────────────

const JOURNEY_STAGES = [
  { label: "Online Discovery", sub: "Website · social · online presence", accent: GOLD },
  { label: "Consult",          sub: "Visual findings · recommender",      accent: TEAL },
  { label: "At-home Review",   sub: "Personalized plan link",             accent: GOLD },
  { label: "Follow-up",        sub: "Same context · no cold start",       accent: TEAL },
] as const;

function PatientJourneyContent() {
  return (
    <div style={{ position: "relative" }}>
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "2rem",
          left: "12.5%",
          right: "12.5%",
          height: "2px",
          background: `linear-gradient(90deg, ${GOLD}30, ${TEAL}30, ${GOLD}30, ${TEAL}30)`,
        }}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", position: "relative", zIndex: 1 }}>
        {JOURNEY_STAGES.map((stage, i) => (
          <div key={stage.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", padding: "0 0.5rem" }}>
            <div
              style={{
                width: "4rem",
                height: "4rem",
                borderRadius: "50%",
                border: `2px solid ${stage.accent}`,
                background: "#060810",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.25rem",
                fontWeight: 700,
                color: stage.accent,
              }}
            >
              {i + 1}
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "0.95rem", fontWeight: 700, color: stage.accent, marginBottom: "0.4rem" }}>{stage.label}</p>
              <p style={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.4 }}>{stage.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Slide 5: Core Workflow ───────────────────────────────────────────────────

const WORKFLOW_STEPS = [
  {
    verb: "Scan",
    from: "Any device",
    to: "Facial data captured",
    accent: TEAL,
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    ),
  },
  {
    verb: "Plan",
    from: "Facial data",
    to: "Treatments + skincare map",
    accent: GOLD,
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <line x1="8" y1="8" x2="16" y2="8" />
        <line x1="8" y1="12" x2="16" y2="12" />
        <line x1="8" y1="16" x2="13" y2="16" />
      </svg>
    ),
  },
  {
    verb: "Share",
    from: "Personalized plan",
    to: "One link to the patient",
    accent: TEAL,
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" y1="2" x2="12" y2="15" />
      </svg>
    ),
  },
] as const;

function CoreWorkflowContent() {
  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: "0.75rem" }}>
      {WORKFLOW_STEPS.map((step, i) => (
        <React.Fragment key={step.verb}>
          <div
            style={{
              flex: 1,
              padding: "2rem 1.5rem",
              background: `${step.accent}09`,
              border: `1px solid ${step.accent}30`,
              borderRadius: "1rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.85rem",
              textAlign: "center",
            }}
          >
            <span style={{ color: step.accent, opacity: 0.75 }}>{step.icon}</span>
            <strong style={{ fontSize: "2.25rem", fontWeight: 800, letterSpacing: "-0.03em", color: step.accent, lineHeight: 1 }}>
              {step.verb}
            </strong>
            <div style={{ width: "100%", borderTop: `1px solid ${step.accent}20`, paddingTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              <span style={{ fontSize: "0.72rem", color: MUTED, letterSpacing: "0.06em", textTransform: "uppercase" }}>{step.from}</span>
              <span style={{ fontSize: "0.62rem", color: step.accent, opacity: 0.55 }}>↓</span>
              <span style={{ fontSize: "0.82rem", color: TEXT }}>{step.to}</span>
            </div>
          </div>
          {i < 2 && (
            <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
              <span style={{ color: MUTED, fontSize: "1.5rem", opacity: 0.5 }}>→</span>
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Slide 6: Digital Twin (demo — SplitSlide) ────────────────────────────────

const MORPH_MESH_POINTS: ReadonlyArray<readonly [number, number]> = [
  [24, 22], [50, 18], [74, 24], [38, 34], [62, 32],
  [28, 48], [52, 46], [76, 44], [34, 58], [58, 56],
  [72, 62], [42, 70], [56, 68], [48, 40], [30, 36],
  [66, 38], [44, 52], [54, 28],
];
type MorphStepIndex = 0 | 1 | 2;
const MORPH_STEPS: ReadonlyArray<{ id: MorphStepIndex; label: string }> = [
  { id: 0, label: "Capture still" },
  { id: 1, label: "Reconstruct 3D" },
  { id: 2, label: "Digital twin ready" },
];
const TANYA_STILL = assetSrc("public/demo-3d/tanya-tan-front.png");

function DigitalTwinMorph({ active }: { active: boolean }) {
  const [manualStep, setManualStep] = useState<MorphStepIndex | null>(null);
  const isManual = manualStep !== null;
  useEffect(() => { if (!active) setManualStep(null); }, [active]);
  const goToStep = useCallback((s: MorphStepIndex) => setManualStep(s), []);
  const resumeAuto = useCallback(() => setManualStep(null), []);
  const stepPrev = useCallback(() => setManualStep((p) => (((p ?? 0) + 2) % 3) as MorphStepIndex), []);
  const stepNext = useCallback(() => setManualStep((p) => (((p ?? 0) + 1) % 3) as MorphStepIndex), []);
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "[" && e.key !== "]") return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault(); e.stopPropagation();
      if (e.key === "[") stepPrev(); else stepNext();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [active, stepPrev, stepNext]);
  const videoActive = active && (!isManual || manualStep === 2);
  return (
    <StoryVisual left="Still capture → 3D twin" right="Phone · tablet · consult room">
      <div className={["twin-morph", active ? "twin-morph--active" : "", isManual ? `twin-morph--manual twin-morph--step-${manualStep}` : ""].filter(Boolean).join(" ")} onClick={(e) => e.stopPropagation()}>
        <div className="morph-stage" aria-hidden={!active}>
          <div className="morph-face-frame">
            <div className="morph-layer morph-source"><img className="morph-face-media" src={TANYA_STILL} alt="" draggable={false} /></div>
            <div className="morph-layer morph-build" aria-hidden="true">
              <img className="morph-face-media" src={TANYA_STILL} alt="" draggable={false} />
              <div className="morph-grid" /><div className="morph-scan-beam" />
              <div className="morph-point-cloud">
                {MORPH_MESH_POINTS.map(([l, t], i) => <span key={i} style={{ left: `${l}%`, top: `${t}%`, ["--i"]: i } as React.CSSProperties} />)}
              </div>
            </div>
            <div className="morph-layer morph-result">
              <PingPongVideo active={videoActive} className="morph-face-media" src="src/assets/images/turntable_2048_black.mp4" ariaLabel="3D digital twin" preload="auto" />
            </div>
            <div className="morph-frame-chrome" aria-hidden="true">
              <span className="morph-bracket morph-bracket--tl" /><span className="morph-bracket morph-bracket--tr" />
              <span className="morph-bracket morph-bracket--bl" /><span className="morph-bracket morph-bracket--br" />
            </div>
          </div>
          <div className="morph-step-toolbar">
            <button type="button" className="morph-nav-btn" onClick={stepPrev} aria-label="Previous step">‹</button>
            <ol className="morph-steps" role="tablist">
              {MORPH_STEPS.map((item) => {
                const sel = isManual && manualStep === item.id;
                return (
                  <li key={item.id}>
                    <button type="button" role="tab" aria-selected={sel}
                      className={["morph-step", `morph-step--${["capture","build","twin"][item.id]}`, sel ? "morph-step--selected" : ""].join(" ")}
                      onClick={() => goToStep(item.id)} title={item.label}>
                      <span className="morph-step-num">{item.id + 1}</span>
                      <span className="morph-step-text">{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <button type="button" className="morph-nav-btn" onClick={stepNext} aria-label="Next step">›</button>
          </div>
          {isManual && (
            <button type="button" className="morph-resume-auto" onClick={resumeAuto}>Resume auto-play</button>
          )}
        </div>
      </div>
    </StoryVisual>
  );
}

// ─── Slide 7: In-Clinic Setup ─────────────────────────────────────────────────

const SCAN_STEPS = ["Patient arrives", "Staff captures scan", "Skin quiz sent via SMS", "Provider reviews findings", "Provider discusses treatment plan", "Patient receives plan link"] as const;
const CONFIG_Q = [
  "Who captures: front desk, MA, aesthetician, or provider?",
  "When: check-in, rooming, before provider enters, or during consult?",
] as const;

function InClinicSetupContent() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        <p style={{ fontSize: "0.6rem", letterSpacing: "0.12em", textTransform: "uppercase", color: TEAL, fontWeight: 700, marginBottom: "0.25rem" }}>Recommended flow</p>
        {SCAN_STEPS.map((step, i) => (
          <div key={step} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ flexShrink: 0, width: "1.5rem", height: "1.5rem", borderRadius: "50%", background: `${TEAL}12`, border: `1px solid ${TEAL}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: 700, color: TEAL }}>{i + 1}</span>
            <span style={{ fontSize: "0.9rem", color: TEXT }}>{step}</span>
          </div>
        ))}
      </div>
      <div style={{ padding: "1.5rem", background: `${GOLD}07`, border: `1px solid ${GOLD}20`, borderRadius: "0.75rem" }}>
        <p style={{ fontSize: "0.6rem", letterSpacing: "0.12em", textTransform: "uppercase", color: GOLD, fontWeight: 700, marginBottom: "1.25rem" }}>Decide today</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {CONFIG_Q.map((q) => (
            <div key={q} style={{ fontSize: "0.88rem", color: TEXT, lineHeight: 1.5, paddingLeft: "0.75rem", borderLeft: `2px solid ${GOLD}35` }}>{q}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Slide 8: Treatment Recommender (demo — SplitSlide) ───────────────────────

const RECOMMEND_ADDONS = [
  { title: "Lower face filler",  body: "Volume and fold softening" },
  { title: "Neuromodulator",     body: "Dynamic line prevention" },
  { title: "Medical skincare",   body: "Prep and post-treatment maintenance" },
] as const;

function RecommenderVisual() {
  return (
    <StoryVisual left="Treatment recommender" right="Justified by the scan">
      <div className="recommend-panel">
        <section className="recommend-hero">
          <p className="recommend-kicker">Primary recommendation</p>
          <h3 className="recommend-hero-title">Moxi laser</h3>
          <p className="recommend-hero-body">Texture, pigment, and glow — justified by her scan.</p>
        </section>
        <section className="recommend-section">
          <p className="recommend-kicker">Also on the plan</p>
          <ul className="recommend-addon-list">
            {RECOMMEND_ADDONS.map((item) => (
              <li key={item.title} className="recommend-addon">
                <strong>{item.title}</strong>
                <span>{item.body}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </StoryVisual>
  );
}

// ─── Slide 9: Catalog ─────────────────────────────────────────────────────────

const CATALOG_ROWS = [
  { category: "Neuromodulators",  examples: "Botox, Dysport, Daxxify" },
  { category: "Dermal Fillers",   examples: "HA filler, Sculptra, Radiesse" },
  { category: "Energy Devices",   examples: "Moxi, BBL, Fraxel, Morpheus8" },
  { category: "Medical Skincare", examples: "Retinoids, SPF, serums" },
  { category: "Packages",         examples: "3-session Moxi, new patient bundle" },
] as const;

function CatalogContent() {
  return (
    <div style={{ borderRadius: "0.75rem", overflow: "hidden", border: `1px solid ${TEAL}18` }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", background: `${TEAL}0c`, padding: "0.65rem 1rem", gap: "1rem" }}>
        {["Category", "Products & Treatments Included"].map((h) => (
          <span key={h} style={{ fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", color: TEAL, fontWeight: 700 }}>{h}</span>
        ))}
      </div>
      {CATALOG_ROWS.map((row, i) => (
        <div key={row.category} style={{ display: "grid", gridTemplateColumns: "1fr 2fr", padding: "0.85rem 1rem", gap: "1rem", background: i % 2 === 0 ? "rgba(255,255,255,0.025)" : "transparent", borderTop: `1px solid ${BORDER}` }}>
          <span style={{ fontSize: "0.92rem", fontWeight: 600, color: TEXT }}>{row.category}</span>
          <span style={{ fontSize: "0.88rem", color: MUTED }}>{row.examples}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Slide 10: Provider Analysis (demo — SplitSlide) ─────────────────────────

type AnalysisLensId = "texture" | "redness" | "pores";

const GCS_CB = "https://storage.googleapis.com/test-deploy-august25/aura/courtney-bellamy/courtney-bellamy-front";

const ANALYSIS_LENSES = [
  { id: "texture" as AnalysisLensId, label: "Texture",  body: "Surface irregularity and skin smoothness", src: `${GCS_CB}-texture.png`, bg: "#0a0a10" },
  { id: "redness" as AnalysisLensId, label: "Redness",  body: "Vascular activity and inflammation",       src: `${GCS_CB}-redness.jpg`, bg: "#d6d3d1" },
  { id: "pores"   as AnalysisLensId, label: "Pores",    body: "Pore visibility and congestion",            src: `${GCS_CB}-pores.jpg`,   bg: "#d6d3d1" },
] as const;

function AnalysisVisual({ active }: { active: boolean }) {
  const [lensIdx, setLensIdx] = useState(1); // start on redness
  const [pinned,  setPinned]  = useState(false);

  useEffect(() => {
    if (!active) { setLensIdx(1); setPinned(false); }
  }, [active]);

  useEffect(() => {
    if (!active || pinned) return;
    const t = window.setInterval(() => setLensIdx((i) => (i + 1) % ANALYSIS_LENSES.length), 2800);
    return () => window.clearInterval(t);
  }, [active, pinned]);

  const lens = ANALYSIS_LENSES[lensIdx];

  return (
    <StoryVisual left="Facial analysis" right="AI-supported findings">
      <div className="analysis-panel analysis-panel--active" onClick={(e) => e.stopPropagation()}>
        <div className="analysis-layout">
          {/* Face plate — pre-baked composite per lens, no background removal needed */}
          <div
            style={{
              width: "100%",
              maxWidth: "260px",
              margin: "0 auto",
              borderRadius: "12px",
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.12)",
              background: lens.bg,
              boxShadow: "0 18px 48px rgba(0,0,0,0.45)",
              alignSelf: "flex-start",
              transition: "background 0.4s ease",
            }}
          >
            <img
              key={lens.src}
              src={lens.src}
              alt={`${lens.label} analysis`}
              draggable={false}
              style={{
                display: "block",
                width: "100%",
                aspectRatio: "1 / 1",
                objectFit: "cover",
                objectPosition: "center 18%",
              }}
            />
          </div>

          {/* Lens selector + plan flow */}
          <div className="analysis-side">
            <p className="analysis-side-kicker">Three lenses</p>
            <ul className="analysis-concern-list">
              {ANALYSIS_LENSES.map((item, i) => {
                const dotClass = ["skin", "volume", "expression"][i];
                const isFocus = lensIdx === i;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`analysis-concern${isFocus ? " is-focus" : ""}`}
                      aria-pressed={isFocus}
                      onClick={() => { setLensIdx(i); setPinned(true); }}
                    >
                      <span className={`analysis-concern-dot analysis-concern-dot--${dotClass}`} />
                      <span className="analysis-concern-copy">
                        <strong>{item.label}</strong>
                        <span>{item.body}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <ol className="analysis-plan-flow">
              <li className="analysis-plan-step"><b>Skincare</b><span>Prep & protect</span></li>
              <li className="analysis-plan-step"><b>Devices</b><span>Texture & tone</span></li>
              <li className="analysis-plan-step"><b>Injectables</b><span>Structure & expression</span></li>
            </ol>
            <p className="analysis-side-hint">{pinned ? "Click again to resume" : "Auto-cycles · click to pin"}</p>
          </div>
        </div>
      </div>
    </StoryVisual>
  );
}

// ─── Slide 11: Skincare Foundation (demo — SplitSlide) ────────────────────────

const SKINCARE_ROWS = [
  {
    time: "AM",
    step: "Gentle cleanse + antioxidant",
    detail: "Preps skin for pigment and texture work",
    productSrc: "https://cdn.shopify.com/s/files/1/2640/6190/files/ceramide-cleanser.png?v=1762466889",
    productName: "Gentle cleanser",
  },
  {
    time: "PM",
    step: "Retinoid ramp",
    detail: "Improves firmness without over-irritating",
    productSrc: "https://cdn.shopify.com/s/files/1/2640/6190/files/ce-ferulic.png?v=1762466889",
    productName: "Antioxidant serum",
  },
  {
    time: "AM",
    step: "Mineral sunscreen",
    detail: "Protects treatment investment daily",
    productSrc: "https://cdn.shopify.com/s/files/1/2640/6190/files/lightweight-sunscreen-1.jpg?v=1762993050",
    productName: "Daily SPF",
  },
] as const;

function SkincareVisual() {
  return (
    <StoryVisual left="Skin quiz → routine → products" right={<span className="signal-dot" />}>
      <div style={{ padding: "1rem 1.1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div style={{ marginBottom: "0.25rem" }}>
          <p className="routine-profile">Dry · sensitive · pigment-prone</p>
          <h3 style={{ fontSize: "1.15rem", marginTop: "0.3rem" }}>Barrier-first brightening routine</h3>
        </div>
        {SKINCARE_ROWS.map((row) => (
          <div
            key={row.step}
            style={{
              display: "grid",
              gridTemplateColumns: "2.2rem 1fr auto",
              alignItems: "center",
              gap: "0.85rem",
              padding: "0.85rem 1rem",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(201,169,98,0.14)",
              borderRadius: "0.65rem",
            }}
          >
            <div
              style={{
                width: "2.2rem",
                height: "2.2rem",
                borderRadius: "50%",
                background: "rgba(45,212,191,0.1)",
                border: "1px solid rgba(45,212,191,0.22)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.62rem",
                fontWeight: 700,
                color: "#2dd4bf",
                flexShrink: 0,
              }}
            >
              {row.time}
            </div>
            <div>
              <b style={{ display: "block", fontSize: "0.88rem", color: TEXT }}>{row.step}</b>
              <span style={{ display: "block", fontSize: "0.72rem", color: MUTED, marginTop: "0.1rem" }}>{row.detail}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem", flexShrink: 0 }}>
              <img
                src={row.productSrc}
                alt={row.productName}
                style={{
                  width: "3.25rem",
                  height: "3.25rem",
                  objectFit: "contain",
                  borderRadius: "10px",
                  background: "rgba(255,255,255,0.08)",
                  padding: "0.3rem",
                  filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.3))",
                }}
              />
              <span style={{ fontSize: "0.6rem", color: MUTED, textAlign: "center", maxWidth: "4.5rem", lineHeight: 1.25 }}>{row.productName}</span>
            </div>
          </div>
        ))}
      </div>
    </StoryVisual>
  );
}

// ─── Slide 12: Patient Plan Link (demo — SplitSlide) ──────────────────────────

const SHARE_SECTIONS = [
  { step: "1", title: "Your scan",        detail: "Analysis summary from the consult" },
  { step: "2", title: "Recommended plan", detail: "Moxi series · skincare prep · filler options" },
  { step: "3", title: "Next step",        detail: "Book or explore financing" },
] as const;

function ShareVisual() {
  return (
    <StoryVisual left="Personal plan link" right="Sent after the visit">
      <div className="share-panel">
        <div className="share-link-preview">
          <div className="share-link-bar"><span className="share-link-url">ponce.link/tanya</span></div>
          <div className="share-link-card">
            <div className="share-link-header">
              <img src={assetSrc("public/demo-3d/tanya-tan-front.png")} alt="" draggable={false} />
              <div><span className="share-link-from">From your provider</span><strong>Tanya&apos;s treatment plan</strong></div>
            </div>
            <ol className="share-link-sections">
              {SHARE_SECTIONS.map((item) => (
                <li key={item.step}>
                  <span className="share-link-step">{item.step}</span>
                  <span className="share-link-copy"><b>{item.title}</b><span>{item.detail}</span></span>
                </li>
              ))}
            </ol>
            <div className="share-link-cta">View my plan</div>
          </div>
        </div>
      </div>
    </StoryVisual>
  );
}

// ─── Slide 13: Follow-Up ──────────────────────────────────────────────────────

const FOLLOWUP_FLOW = [
  { patient: "Opens plan link",           staff: "Staff sees activity" },
  { patient: "Reviews a treatment",       staff: '"I saw you looked at Moxi—"' },
  { patient: "Doesn\'t book immediately", staff: "Follows up from context" },
] as const;

function FollowUpContent() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
      {/* Column headers */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2.5rem 1fr", marginBottom: "0.85rem" }}>
        <p style={{ fontSize: "0.6rem", letterSpacing: "0.12em", textTransform: "uppercase", color: TEAL, fontWeight: 700, textAlign: "center" }}>Patient</p>
        <div />
        <p style={{ fontSize: "0.6rem", letterSpacing: "0.12em", textTransform: "uppercase", color: GOLD, fontWeight: 700, textAlign: "center" }}>Staff response</p>
      </div>

      {FOLLOWUP_FLOW.map((row, i) => (
        <React.Fragment key={row.patient}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2.5rem 1fr", gap: "0.5rem", alignItems: "center" }}>
            <div style={{ padding: "0.9rem 1rem", background: `${TEAL}09`, border: `1px solid ${TEAL}22`, borderRadius: "0.65rem", textAlign: "center" }}>
              <span style={{ fontSize: "0.92rem", color: TEXT }}>{row.patient}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", color: MUTED, fontSize: "1.15rem" }}>→</div>
            <div style={{ padding: "0.9rem 1rem", background: `${GOLD}09`, border: `1px solid ${GOLD}22`, borderRadius: "0.65rem", textAlign: "center" }}>
              <span style={{ fontSize: "0.92rem", color: TEXT, fontStyle: row.staff.startsWith('"') ? "italic" : "normal" }}>{row.staff}</span>
            </div>
          </div>
          {i < FOLLOWUP_FLOW.length - 1 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2.5rem 1fr" }}>
              <div style={{ display: "flex", justifyContent: "center", color: MUTED, padding: "0.35rem 0", fontSize: "1rem" }}>↓</div>
              <div />
              <div style={{ display: "flex", justifyContent: "center", color: MUTED, padding: "0.35rem 0", fontSize: "1rem" }}>↓</div>
            </div>
          )}
        </React.Fragment>
      ))}

      <div style={{ marginTop: "1.25rem", padding: "1rem 1.5rem", background: `${TEAL}07`, border: `1px solid ${TEAL}1c`, borderRadius: "0.75rem", textAlign: "center" }}>
        <p style={{ fontSize: "0.95rem", fontWeight: 600, color: TEXT }}>Same conversation, not cold outreach</p>
        <p style={{ fontSize: "0.78rem", color: MUTED, marginTop: "0.3rem" }}>The plan link gives staff the context to follow up meaningfully</p>
      </div>
    </div>
  );
}

// ─── Slide 16: Launch Plan ────────────────────────────────────────────────────

const LAUNCH_PHASES = [
  { phase: "Phase 1", name: "Configure",    items: ["Treatment catalog", "Product catalog", "Scan workflow", "User access"], accent: GOLD },
  { phase: "Phase 2", name: "Train",        items: ["Staff training", "Provider walkthrough", "Test patients"],             accent: TEAL },
  { phase: "Phase 3", name: "Soft Launch",  items: ["One provider or one day", "Build confidence"],                        accent: GOLD },
  { phase: "Phase 4", name: "Go Live",      items: ["All eligible consults"],                                               accent: TEAL },
] as const;

function LaunchPlanContent() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
      {LAUNCH_PHASES.map((phase) => (
        <div
          key={phase.phase}
          style={{
            padding: "1.5rem 1.1rem",
            background: `${phase.accent}0a`,
            border: `1px solid ${phase.accent}28`,
            borderRadius: "0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <p style={{ fontSize: "0.58rem", letterSpacing: "0.12em", textTransform: "uppercase", color: phase.accent, fontWeight: 700 }}>{phase.phase}</p>
          <p style={{ fontSize: "1.2rem", fontWeight: 700, color: TEXT, marginBottom: "0.35rem" }}>{phase.name}</p>
          {phase.items.map((item) => (
            <p key={item} style={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.4, paddingLeft: "0.6rem", borderLeft: `2px solid ${phase.accent}30` }}>{item}</p>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Slide 17: Decisions ──────────────────────────────────────────────────────

const DECISIONS = [
  { q: "Which treatments and products are included?",   hint: "Use price list as a starting point" },
  { q: "What is the target go-live date?",              hint: "We'll schedule a call to confirm" },
  { q: "Complete new client product onboarding sheet",  hint: "Required before configure phase begins" },
] as const;

function DecisionsContent() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {DECISIONS.map((item) => (
        <div
          key={item.q}
          style={{
            padding: "1.25rem 1.5rem",
            background: `${GOLD}06`,
            border: `1px solid ${GOLD}18`,
            borderRadius: "0.75rem",
            display: "flex",
            alignItems: "center",
            gap: "1.25rem",
          }}
        >
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: "1rem", fontWeight: 600, color: TEXT, marginBottom: "0.2rem" }}>{item.q}</p>
            <p style={{ fontSize: "0.78rem", color: MUTED }}>{item.hint}</p>
          </div>
          <span style={{ flexShrink: 0, padding: "0.22rem 0.65rem", borderRadius: "0.3rem", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Open</span>
        </div>
      ))}
    </div>
  );
}

// ─── Slide 16: Closing ───────────────────────────────────────────────────────

function ClosingSlide({ active }: { active: boolean }) {
  return (
    <Slide active={active} className="slide--hero-bg title-slide">
      <PingPongVideo active={active} className="slide-bg-video" src="src/assets/images/turntable_2048_black.mp4" />
      <h1>Let&apos;s build a better <span className="shimmer">consult experience</span></h1>
      <p className="hero-line" style={{ textAlign: "center" }}>More visual. More personalized. Easier to follow through.</p>
      <p className="subtitle" style={{ marginTop: "2rem" }}>
        Thank you · Next: configuration review · training · go-live
      </p>
    </Slide>
  );
}

// ─── Blueprint URL ────────────────────────────────────────────────────────────

function useBlueprintUrl() {
  const [url, setUrl] = useState(`${dashboardOrigin}/tp`);
  useEffect(() => {
    let cancelled = false;
    fetch("/demo/gravitas-tanya-blueprint.json")
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((p) => {
        if (cancelled) return;
        const token = p.token || "clinic-demo-tanya";
        setUrl(`${dashboardOrigin}/tp?t=${encodeURIComponent(token)}#d=${encodeURIComponent(encodeBlueprintForUrl(p))}`);
      })
      .catch(() => setUrl(`${dashboardOrigin}/tp`));
    return () => { cancelled = true; };
  }, []);
  return url;
}

// ─── Main deck ────────────────────────────────────────────────────────────────

export function ClinicDemoDeck() {
  const [index, setIndex]     = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const blueprintUrl          = useBlueprintUrl();
  const total = 16;

  const slides = useMemo(() => [
    // 1 — Title
    <TitleSlide active={index === 0} key="title" />,

    // 2 — Outcomes
    <ContentSlide active={index === 1} key="outcomes" label="Today's session" title="What We'll Accomplish">
      <OutcomesContent />
    </ContentSlide>,

    // 3 — Big Idea
    <ContentSlide active={index === 2} key="big-idea" label="The problem" title="Turn Consults Into Plans Patients Follow">
      <BigIdeaContent />
    </ContentSlide>,

    // 4 — Patient Journey
    <ContentSlide active={index === 3} key="journey" label="The patient journey" title="Where Ponce Fits In">
      <PatientJourneyContent />
    </ContentSlide>,

    // 5 — Core Workflow
    <ContentSlide active={index === 4} key="workflow" label="Core workflow" title="How Ponce Works">
      <CoreWorkflowContent />
    </ContentSlide>,

    // 6 — Digital Twin (demo)
    <SplitSlide active={index === 5} key="twin" label="The digital twin" title="Shared Visual Foundation" lead="Works on any camera-enabled device.">
      <DigitalTwinMorph active={index === 5} />
    </SplitSlide>,

    // 7 — In-Clinic Setup
    <ContentSlide active={index === 6} key="scan" label="In-clinic scan workflow" title="Configure the Scan">
      <InClinicSetupContent />
    </ContentSlide>,

    // 8 — Treatment Recommender (demo)
    <SplitSlide
      active={index === 7}
      key="recommender"
      label="The treatment recommender"
      title="Findings Become a Confident Plan"
      lead="Justified by the scan."
      cta={<div className="launch-btn-row"><LinkButton path="/client-details/admin-demo-tanya?section=recommender">Open live recommender</LinkButton></div>}
    >
      <RecommenderVisual />
    </SplitSlide>,

    // 9 — Catalog
    <ContentSlide active={index === 8} key="catalog" label="Treatment & product catalog" title="Configure the Catalog">
      <CatalogContent />
    </ContentSlide>,

    // 10 — Provider Analysis (demo)
    <SplitSlide
      active={index === 9}
      key="analysis"
      label="The provider experience"
      title="Observation → Explanation → Plan"
      lead="Build comprehensive plans for every patient with AI-supported findings."
      cta={<div className="launch-btn-row"><LinkButton path="/client-details/admin-demo-tanya?view=facial-analysis&section=analysis">Open live analysis</LinkButton></div>}
    >
      <AnalysisVisual active={index === 9} />
    </SplitSlide>,

    // 11 — Skincare (demo)
    <SplitSlide active={index === 10} key="skincare" label="Skincare foundation" title="Daily Care in the Plan" lead="Retention between visits.">
      <SkincareVisual />
    </SplitSlide>,

    // 12 — Patient Plan (demo)
    <SplitSlide
      active={index === 11}
      key="plan"
      label="The patient plan link"
      title="Share While Interest Is Warm"
      lead="One link. No app download required."
      cta={
        <>
          <div className="sms" style={{ marginTop: "0.75rem", maxWidth: "100%" }}>
            Hi — your treatment plan is ready: <strong>ponce.link/…</strong>
          </div>
          <div className="launch-btn-row"><LinkButton href={blueprintUrl}>Preview the patient plan</LinkButton></div>
        </>
      }
    >
      <ShareVisual />
    </SplitSlide>,

    // 13 — Follow-Up
    <ContentSlide active={index === 12} key="followup" label="The follow-up workflow" title="Follow Up From Context">
      <FollowUpContent />
    </ContentSlide>,

    // 14 — Launch Plan
    <ContentSlide active={index === 13} key="launch" label="Launch plan" title="Configure → Train → Go Live">
      <LaunchPlanContent />
    </ContentSlide>,

    // 15 — Decisions
    <ContentSlide active={index === 14} key="decisions" label="Key decisions" title="Decisions We Need Today">
      <DecisionsContent />
    </ContentSlide>,

    // 16 — Closing
    <ClosingSlide active={index === 15} key="closing" />,
  ], [blueprintUrl, index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (["ArrowRight", " ", "PageDown"].includes(e.key)) { e.preventDefault(); setIndex((i) => Math.min(i + 1, total - 1)); }
      else if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); }
      else if (e.key === "Home") setIndex(0);
      else if (e.key === "End") setIndex(total - 1);
      else if (e.key === "n" || e.key === "N") setShowNotes((v) => !v);
      else if (e.key === "l" || e.key === "L") {
        const link = document.querySelector<HTMLAnchorElement>(".slide.active .launch-btn");
        if (link) window.open(link.href, "_blank", "noopener,noreferrer");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.querySelector(".slide.active")?.querySelectorAll<HTMLElement>(".num[data-count]").forEach((el) => {
      const target = parseFloat(el.dataset.count || "0");
      const suffix = el.dataset.suffix || "";
      const decimals = parseInt(el.dataset.decimals || "0", 10);
      const start = performance.now();
      const step = (now: number) => {
        const p = Math.min((now - start) / 1300, 1);
        el.textContent = (target * (1 - Math.pow(1 - p, 3))).toFixed(decimals) + suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, [index]);

  const onDeckClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("a, button")) return;
    if (e.clientX / window.innerWidth < 0.25) setIndex((i) => Math.max(i - 1, 0));
    else setIndex((i) => Math.min(i + 1, total - 1));
  };

  return (
    <>
      <ParticleCanvas />
      <div className="deck" id="deck" onClick={onDeckClick}>{slides}</div>
      <nav className="slide-nav" aria-label="Slide navigation">
        {slides.map((_, i) => (
          <button key={i} type="button" title={`Slide ${i + 1}`} aria-label={`Go to slide ${i + 1}`} className={i === index ? "active" : ""} onClick={() => setIndex(i)} />
        ))}
      </nav>
      <div className="progress" style={{ width: `${((index + 1) / total) * 100}%` }} />
      <span className="slide-num">{index + 1} / {total}</span>
      <span className="nav-hint">← → · space · click · <strong style={{ color: "var(--accent)" }}>N</strong> notes · <strong style={{ color: "var(--accent)" }}>L</strong> open live</span>
      <button type="button" className={`notes-toggle-btn${showNotes ? " notes-toggle-btn--active" : ""}`} onClick={() => setShowNotes((v) => !v)} aria-pressed={showNotes} title="Toggle speaker notes (N)">Notes</button>
      <NotesPanel open={showNotes} notes={SLIDE_NOTES[index]} />
    </>
  );
}
