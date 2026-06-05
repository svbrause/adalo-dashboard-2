import { useState } from "react";
import "./RevanceCaseGalleryPage.css";

// ── Two-treatment simplified gallery ─────────────────────────────────────

type Treatment = {
  id: string; product: string; category: string; color: string; match: number; concern: string;
  findings: string[];
  tanyaColor: string; tanyaMapUrl: string; tanyaLabel: string;
  caseBeforeUrl: string; caseAfterUrl: string;
  caseBeforePipelineUrl: string; caseAfterPipelineUrl: string;
  caseBeforeAlt: string; caseAfterAlt: string;
  caseSummary: string; caseSource: string; caseSourceUrl: string;
  stat: string; statLabel: string;
  treatment: string; timeline: string;
};

const TREATMENTS: Treatment[] = [
  {
    id: "skinpen", product: "SkinPen Precision", category: "Treatment", color: "#E879A0",
    match: 81, concern: "Skin texture irregularity",
    findings: [
      "Skin texture improvement opportunity identified",
      "Mild pigment clustering visible across cheek and T-zone",
      "Treatment case selected for similar surface-quality concerns",
    ],

    tanyaColor:    "/revance-case-gallery/tanya/tanya-tan-45-left-rembg.png",
    tanyaMapUrl:   "/revance-case-gallery/tanya/tanya-tan-45-left-pigmentation-brown.png",
    tanyaLabel:    "Moderate texture irregularity detected — left cheek + T-zone",

    caseBeforeUrl: "/revance-case-gallery/cases/skinpen-texture-before.jpg",
    caseAfterUrl:  "/revance-case-gallery/cases/skinpen-texture-after.jpg",
    caseBeforePipelineUrl: "/revance-case-gallery/processed/skinpen-texture-before-pipeline.png",
    caseAfterPipelineUrl:  "/revance-case-gallery/processed/skinpen-texture-after-pipeline.png",
    caseBeforeAlt: "Patient skin before SkinPen series",
    caseAfterAlt:  "Patient skin after 3 SkinPen sessions",
    caseSummary:   "F · 40 · Fitzpatrick III–IV · Skin texture",
    caseSource:    "DSM Coachlight Med Spa",
    caseSourceUrl: "https://www.dsmcoachlight.com/gallery/microneedling-with-skinpen-before-after-gallery/",

    stat: "+23%", statLabel: "texture score improvement",

    treatment: "SkinPen Precision · 3 sessions · 4–6 weeks apart",
    timeline:  "Results build over 3–4 months",
  },
  {
    id: "rha2", product: "RHA 2", category: "Filler", color: "#52D8C8",
    match: 73, concern: "Uneven pigmentation & sun damage",
    findings: [
      "Under-eye and periorbital improvement opportunity identified",
      "Mild-to-moderate shadowing visible in Tanya's scan",
      "Treatment case selected for a similar eye-area discussion",
    ],

    tanyaColor:    "/demo-3d/tanya-tan/tanya-tan-front-color.png",
    tanyaMapUrl:   "/revance-case-gallery/tanya/tanya-tan-front-pores-cutout.png",
    tanyaLabel:    "Moderate pigmentation clustering — cheeks + periorbital",

    caseBeforeUrl: "/revance-case-gallery/cases/rha2-undereye-before.jpg",
    caseAfterUrl:  "/revance-case-gallery/cases/rha2-undereye-after.jpg",
    caseBeforePipelineUrl: "/revance-case-gallery/processed/rha2-undereye-before-pipeline.png",
    caseAfterPipelineUrl:  "/revance-case-gallery/processed/rha2-undereye-after-pipeline.png",
    caseBeforeAlt: "Patient before RHA 2 treatment",
    caseAfterAlt:  "Patient after RHA 2 treatment",
    caseSummary:   "F · 38 · Fitzpatrick II–III · Pigmentation & tone",
    caseSource:    "Aesthetica Med Spa",
    caseSourceUrl: "https://www.aesthetica.com/rha-fillers/",

    stat: "+34%", statLabel: "pigmentation evenness",

    treatment: "RHA 2 · Periorbital rejuvenation",
    timeline:  "Immediate result · Lasts ~12 months",
  },
];

// ── Image with fallback ───────────────────────────────────────────────────

function Img({ src, alt, cls = "" }: { src: string; alt: string; cls?: string }) {
  const [err, setErr] = useState(false);
  if (err || !src) return (
    <div className={`rcg-img-err ${cls}`}>
      <svg viewBox="0 0 48 58" fill="none" style={{ width: 28, color: "rgba(255,255,255,0.15)" }}>
        <ellipse cx="24" cy="22" rx="14" ry="16" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M10 38c2 10 8 16 14 16s12-6 14-16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </div>
  );
  return <img src={src} alt={alt} className={cls} loading="eager" draggable={false} onError={() => setErr(true)} />;
}

// ── Treatment screen ──────────────────────────────────────────────────────

function TreatmentScreen({
  t, index, total, onBack, onNext,
}: {
  t: Treatment; index: number; total: number;
  onBack: () => void; onNext: () => void;
}) {
  const [mode, setMode] = useState<"photos" | "results">("photos");
  const showingResults = mode === "results";

  return (
    <div
      className="rcg-screen"
      style={{ "--tc": t.color } as React.CSSProperties}
    >
      {/* Header */}
      <div className="rcg-hdr">
        <div className="rcg-hdr-left">
          <div className="rcg-hdr-dots">
            {Array.from({ length: total }).map((_, i) => (
              <div key={i} className="rcg-hdr-dot"
                style={{ background: i < index ? `${t.color}60` : i === index ? t.color : "rgba(255,255,255,0.18)", width: i === index ? 14 : 6 }} />
            ))}
          </div>
          <span className="rcg-hdr-count">{index + 1}/{total}</span>
        </div>
        <div className="rcg-hdr-partner" aria-label="Ponce AI × Revance">
          <img src="/branding/ponce-dark-mode.png" alt="Ponce AI" className="rcg-partner-logo rcg-partner-logo--ponce" />
          <span className="rcg-partner-x" aria-hidden="true">×</span>
          <img src="/branding/revance/revance-wordmark.svg" alt="Revance" className="rcg-partner-logo rcg-partner-logo--revance" />
        </div>
      </div>

      <div className="rcg-assessment">
        <div className="rcg-assessment-photo">
          <Img
            src={showingResults ? t.tanyaMapUrl : t.tanyaColor}
            alt="Tanya M assessment photo"
            cls={`rcg-assessment-img${showingResults ? " rcg-assessment-img--map" : ""}`}
          />
          <span>Tanya M</span>
        </div>
        <div className="rcg-assessment-copy">
          <p className="rcg-assessment-kicker" style={{ color: t.color }}>Your assessment findings</p>
          <ul>
            {t.findings.map(f => <li key={f}>{f}</li>)}
          </ul>
        </div>
      </div>

      <div className="rcg-treatment-panel" style={{ borderColor: `${t.color}28` }}>
        <div className="rcg-treatment-head">
          <div>
            <span className="rcg-product-badge" style={{ color: t.color, background: `${t.color}14`, borderColor: `${t.color}44` }}>
              <span className="rcg-product-cat">{t.category}</span>
              {t.product}
            </span>
            <strong>{t.treatment}</strong>
          </div>
          <span className="rcg-match-chip" style={{ color: t.color }}>{t.match}% match</span>
        </div>

        <div className="rcg-case-summary">
          <span>{t.caseSummary}</span>
          <a href={t.caseSourceUrl} target="_blank" rel="noopener noreferrer">{t.caseSource} ↗</a>
        </div>

        <div className="rcg-ba-row">
          <figure>
            <Img
              src={showingResults ? t.caseBeforeUrl : t.caseBeforePipelineUrl}
              alt={t.caseBeforeAlt}
              cls={`rcg-ba-img${showingResults ? "" : " rcg-ba-img--analysis"}`}
            />
            <figcaption>Before</figcaption>
          </figure>
          <figure>
            <Img
              src={showingResults ? t.caseAfterUrl : t.caseAfterPipelineUrl}
              alt={t.caseAfterAlt}
              cls={`rcg-ba-img${showingResults ? "" : " rcg-ba-img--analysis"}`}
            />
            <figcaption style={{ color: t.color }}>After</figcaption>
          </figure>
        </div>
      </div>

      <div className="rcg-actions">
        <button
          className="rcg-cta"
          style={showingResults ? { background: `${t.color}18`, color: t.color, border: `1px solid ${t.color}44` } : { background: t.color, color: "#08080c" }}
          onClick={() => setMode(showingResults ? "photos" : "results")}
        >
          {showingResults ? "Back to photos" : "See Treatment Results"}
        </button>
        <div className="rcg-sec-row">
          <button className="rcg-sec" onClick={onBack} disabled={index === 0}>← back</button>
          <button className="rcg-sec" onClick={onNext}>next →</button>
        </div>
      </div>
    </div>
  );
}

// ── Done screen ───────────────────────────────────────────────────────────

function DoneScreen({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="rcg-done">
      <div className="rcg-done-icon">
        <svg width="48" height="48" viewBox="0 0 44 44" fill="none"><circle cx="22" cy="22" r="20" stroke="rgba(255,255,255,0.15)" strokeWidth="2"/><path d="M14 22h16M14 16h16M14 28h10" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round"/></svg>
      </div>
      <h2 className="rcg-done-title">All cases reviewed</h2>
      <p className="rcg-done-sub">Review the assessment and treatment results again whenever you are ready.</p>
      <div className="rcg-done-actions">
        <button className="rcg-sec" style={{ justifyContent: "center", width: "100%", padding: "13px" }} onClick={onRestart}>Review again</button>
      </div>
    </div>
  );
}

// ── Page root ─────────────────────────────────────────────────────────────

export default function RevanceCaseGalleryPage() {
  const [idx,   setIdx]   = useState(0);
  const [done,  setDone]  = useState(false);

  const advance = () => {
    if (idx + 1 >= TREATMENTS.length) setDone(true);
    else setIdx(i => i + 1);
  };

  const back = () => {
    if (idx > 0) setIdx(i => i - 1);
  };

  return (
    <div className="rcg-root">
      <div className="rcg-desktop-wrap">

        {/* Sidebar (desktop) */}
        <div className="rcg-sidebar">
          <div className="rcg-sidebar-partner" aria-label="Ponce AI × Revance">
            <img src="/branding/ponce-dark-mode.png" alt="Ponce AI" className="rcg-sidebar-ponce" />
            <span className="rcg-sidebar-partner-x" aria-hidden="true">×</span>
            <img src="/branding/revance/revance-wordmark.svg" alt="Revance" className="rcg-sidebar-revance" />
          </div>
          <div className="rcg-sidebar-div" />
          <h2 className="rcg-sidebar-title">Your Revance<br/>case gallery</h2>
          <p className="rcg-sidebar-body">
            Two treatments matched to Tanya's scan findings.
            Review Tanya's assessment findings, then compare real treatment results.
          </p>
          <div className="rcg-sidebar-list">
            {TREATMENTS.map((t, i) => (
              <div key={t.id} className={`rcg-sidebar-item${i === idx && !done ? " rcg-sidebar-item--active" : ""}`}
                style={i === idx && !done ? { borderColor: `${t.color}44` } : undefined}>
                <span className="rcg-sidebar-dot" style={{
                  background: i <= idx ? t.color : "rgba(255,255,255,0.14)"
                }} />
                <div>
                  <div className="rcg-sidebar-pname" style={{ color: i <= idx ? t.color : undefined }}>{t.product}</div>
                  <div className="rcg-sidebar-concern">{t.concern}</div>
                </div>
                {i === idx && !done && <span className="rcg-sidebar-viewing" style={{ color: t.color }}>Viewing</span>}
              </div>
            ))}
          </div>
          <p className="rcg-sidebar-note">Tap <strong>"See Treatment Results"</strong> to switch from assessment photos to the treatment outcome view.</p>
        </div>

        {/* Phone frame */}
        <div className="rcg-phone">
          <div className="rcg-phone-notch" />
          <div className="rcg-phone-inner">
            {done ? (
              <DoneScreen onRestart={() => { setIdx(0); setDone(false); }} />
            ) : (
              <TreatmentScreen
                key={TREATMENTS[idx]?.id}
                t={TREATMENTS[idx]}
                index={idx}
                total={TREATMENTS.length}
                onBack={back}
                onNext={advance}
              />
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
