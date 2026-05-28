import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ANALYSIS_FACE_LAYERS,
  AURA_SKIN_SPOT_DISPLAY_SCALE,
  type AnalysisConcernId,
} from "./analysisFaceAnnotations";
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

function TitleSlide({ active }: { active: boolean }) {
  return (
    <Slide active={active} className="slide--hero-bg title-slide">
      <img
        className="logo-img logo-img--hero"
        src={assetSrc("public/demo-3d/dark_mode_logo.png")}
        alt="Ponce AI"
        width={1580}
        height={456}
      />
      <div className="title-video-box">
        <PingPongVideo
          active={active}
          preload="auto"
          src="src/assets/images/turntable_2048_black.mp4"
          ariaLabel="Rotating 3D digital twin"
        />
      </div>
      <h1>
        Turn consults into plans patients{" "}
        <span className="shimmer">actually follow</span>
      </h1>
      <p className="hero-line" style={{ textAlign: "center", marginTop: "0.5rem" }}>
        Scan · plan · share · proof
      </p>
      <div style={{ display: "flex", justifyContent: "center", marginTop: "1.25rem" }}>
        <LinkButton path="/patients">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="8" cy="8" r="6" />
            <polyline points="8 5 11 8 8 11" />
            <line x1="5" y1="8" x2="11" y2="8" />
          </svg>
          Open product demo
        </LinkButton>
      </div>
      <p className="powered-by">
        Powered by <strong>Ponce AI</strong>
      </p>
    </Slide>
  );
}

const PROBLEM_STAGES = [
  {
    tone: "good",
    tag: "In chair · high intent",
    title: "Great conversation",
    body: "Provider explains concerns and options in the room.",
  },
  {
    tone: "mid",
    tag: "At home · context missing",
    title: "Interest drops",
    body: "Patient leaves with a quote, brochure, or scattered notes.",
  },
  {
    tone: "bad",
    tag: "Follow-up · confidence lost",
    title: "Cold follow-up",
    body: "Team has to resell context instead of advancing commitment.",
  },
] as const;

function ProblemGraph() {
  return (
    <StoryVisual left="Intent over time" right="Current consult flow">
      <div className="problem-flow">
        <div className="problem-chart" aria-hidden="false">
          <p className="problem-chart-y">Patient intent</p>
          <div className="problem-chart-stage">
            <svg viewBox="0 0 320 260" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
              <path
                d="M18 42 C88 18 115 90 162 104 C215 121 226 172 302 224"
                fill="none"
                stroke="rgba(201,169,98,0.22)"
                strokeWidth="16"
                strokeLinecap="round"
              />
              <path
                className="dropoff-path"
                d="M18 42 C88 18 115 90 162 104 C215 121 226 172 302 224"
                fill="none"
                stroke="rgba(45,212,191,0.9)"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <circle cx="18" cy="42" r="8" fill="#2dd4bf" />
              <circle cx="162" cy="104" r="6" fill="#c9a962" />
              <circle cx="302" cy="224" r="8" fill="#f87171" />
            </svg>
          </div>
          <div className="problem-chart-axis">
            <span>In the chair</span>
            <span>After the visit</span>
          </div>
        </div>
        <ol className="problem-story">
          {PROBLEM_STAGES.map((stage, index) => (
            <li key={stage.title} className={`problem-story-item problem-story-item--${stage.tone}`}>
              <span className="problem-story-marker">{index + 1}</span>
              <div className="problem-story-copy">
                <span className="problem-story-tag">{stage.tag}</span>
                <strong>{stage.title}</strong>
                <p>{stage.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </StoryVisual>
  );
}

function WarmIntentGraph() {
  return (
    <StoryVisual left="Ponce-supported flow" right="Intent stays consistent">
      <div className="curve-bend">
        <div className="curve-stage">
          <svg viewBox="0 0 640 360" aria-hidden="true">
            <line className="curve-axis" x1="58" y1="304" x2="590" y2="304" />
            <line className="curve-axis" x1="58" y1="54" x2="58" y2="304" />
            <path
              className="curve-before"
              d="M72 102 C178 98 214 180 302 214 C414 258 470 292 584 304"
            />
            <path
              className="curve-after"
              d="M72 102 C164 96 224 106 304 98 C414 88 496 82 584 74"
            />
          </svg>
          <span className="curve-pulse one" />
          <span className="curve-pulse two" />
          <span className="curve-pulse three" />
          <div className="curve-callout scan">
            <strong>In consult</strong>Shared visual proof.
          </div>
          <div className="curve-callout plan">
            <strong>At home</strong>The plan is easy to revisit.
          </div>
          <div className="curve-callout share">
            <strong>Follow-up</strong>Staff continues from context.
          </div>
        </div>
        <div className="curve-legend">
          <span>
            <i /> traditional drop-off
          </span>
          <span>
            <i /> Ponce keeps intent warm
          </span>
        </div>
      </div>
    </StoryVisual>
  );
}

const TANYA_STILL = assetSrc("public/demo-3d/tanya-tan-front.png");
const TANYA_PIGMENT_MAP = assetSrc(
  "public/demo-3d/tanya-tan-45-left-pigmentation-gray.png",
);

/** Landmark-ish dots for the “mesh reconstruct” phase (percent within face frame). */
const MORPH_MESH_POINTS: ReadonlyArray<readonly [number, number]> = [
  [24, 22],
  [50, 18],
  [74, 24],
  [38, 34],
  [62, 32],
  [28, 48],
  [52, 46],
  [76, 44],
  [34, 58],
  [58, 56],
  [72, 62],
  [42, 70],
  [56, 68],
  [48, 40],
  [30, 36],
  [66, 38],
  [44, 52],
  [54, 28],
];

type MorphStepIndex = 0 | 1 | 2;

const MORPH_STEPS: ReadonlyArray<{ id: MorphStepIndex; label: string; short: string }> = [
  { id: 0, label: "Capture still", short: "Capture" },
  { id: 1, label: "Reconstruct 3D", short: "Reconstruct" },
  { id: 2, label: "Digital twin ready", short: "Twin ready" },
];

function DigitalTwinMorph({ active }: { active: boolean }) {
  /** `null` = auto-play timeline; number = user-paused on that step */
  const [manualStep, setManualStep] = useState<MorphStepIndex | null>(null);
  const isManual = manualStep !== null;

  useEffect(() => {
    if (!active) setManualStep(null);
  }, [active]);

  const goToStep = useCallback((step: MorphStepIndex) => {
    setManualStep(step);
  }, []);

  const resumeAuto = useCallback(() => setManualStep(null), []);

  const stepPrev = useCallback(() => {
    setManualStep((prev) => {
      const current = prev ?? 0;
      return ((current + 2) % 3) as MorphStepIndex;
    });
  }, []);

  const stepNext = useCallback(() => {
    setManualStep((prev) => {
      const current = prev ?? 0;
      return ((current + 1) % 3) as MorphStepIndex;
    });
  }, []);

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "[" && event.key !== "]") return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "[") stepPrev();
      else stepNext();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [active, stepPrev, stepNext]);

  const videoActive = active && (!isManual || manualStep === 2);

  return (
    <StoryVisual left="Still capture → 3D twin" right="Phone · tablet · consult room">
      <div
        className={[
          "twin-morph",
          active ? "twin-morph--active" : "",
          isManual ? `twin-morph--manual twin-morph--step-${manualStep}` : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="morph-stage" aria-hidden={!active}>
          <div className="morph-face-frame">
            <div className="morph-layer morph-source">
              <img
                className="morph-face-media"
                src={TANYA_STILL}
                alt="Still patient capture"
                draggable={false}
              />
            </div>
            <div className="morph-layer morph-build" aria-hidden="true">
              <img className="morph-face-media" src={TANYA_STILL} alt="" draggable={false} />
              <div className="morph-grid" />
              <div className="morph-scan-beam" />
              <div className="morph-point-cloud">
                {MORPH_MESH_POINTS.map(([left, top], i) => (
                  <span
                    key={i}
                    style={
                      {
                        left: `${left}%`,
                        top: `${top}%`,
                        ["--i"]: i,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </div>
            </div>
            <div className="morph-layer morph-result">
              <PingPongVideo
                active={videoActive}
                className="morph-face-media"
                src="src/assets/images/turntable_2048_black.mp4"
                ariaLabel="Generated rotating 3D digital twin"
                preload="auto"
              />
            </div>
            <div className="morph-frame-chrome" aria-hidden="true">
              <span className="morph-bracket morph-bracket--tl" />
              <span className="morph-bracket morph-bracket--tr" />
              <span className="morph-bracket morph-bracket--bl" />
              <span className="morph-bracket morph-bracket--br" />
            </div>
          </div>
          <div className="morph-step-toolbar">
            <button
              type="button"
              className="morph-nav-btn"
              onClick={stepPrev}
              aria-label="Previous step"
              title="Previous step ([)"
            >
              ‹
            </button>
            <ol className="morph-steps" role="tablist" aria-label="Digital twin build steps">
              {MORPH_STEPS.map((item) => {
                const selected = isManual && manualStep === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      className={[
                        "morph-step",
                        `morph-step--${["capture", "build", "twin"][item.id]}`,
                        selected ? "morph-step--selected" : "",
                      ].join(" ")}
                      onClick={() => goToStep(item.id)}
                      title={item.label}
                    >
                      <span className="morph-step-num">{item.id + 1}</span>
                      <span className="morph-step-text">{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <button
              type="button"
              className="morph-nav-btn"
              onClick={stepNext}
              aria-label="Next step"
              title="Next step (])"
            >
              ›
            </button>
          </div>
          {isManual ? (
            <button type="button" className="morph-resume-auto" onClick={resumeAuto}>
              Resume auto-play
            </button>
          ) : (
            <p className="morph-hint">Click a step or use [ ] to explore at your own pace</p>
          )}
        </div>
      </div>
    </StoryVisual>
  );
}

function SkincareVisual() {
  return (
    <StoryVisual left="Skin quiz → routine → products" right={<span className="signal-dot" />}>
      <div className="skincare-solo-visual">
        <div className="routine-card">
          <p className="routine-profile">Dry · sensitive · pigment-prone</p>
          <h3 style={{ fontSize: "1.2rem", marginBottom: "0.75rem" }}>
            Barrier-first brightening routine
          </h3>
          <div className="routine-steps">
            <div className="routine-step">
              <i>AM</i>
              <div>
                <b>Gentle cleanse + antioxidant</b>
                <span>Preps skin for pigment and texture work</span>
              </div>
            </div>
            <div className="routine-step">
              <i>PM</i>
              <div>
                <b>Retinoid ramp</b>
                <span>Improves firmness without over-irritating</span>
              </div>
            </div>
            <div className="routine-step">
              <i>AM</i>
              <div>
                <b>Mineral sunscreen</b>
                <span>Protects treatment investment daily</span>
              </div>
            </div>
          </div>
          <div className="product-strip">
            <div className="product-mini">
              <img
                src="https://cdn.shopify.com/s/files/1/2640/6190/files/ceramide-cleanser.png?v=1762466889"
                alt="Gentle cleanser product"
              />
              <span>Gentle cleanser</span>
            </div>
            <div className="product-mini">
              <img
                src="https://cdn.shopify.com/s/files/1/2640/6190/files/ce-ferulic.png?v=1762466889"
                alt="Antioxidant serum product"
              />
              <span>Antioxidant serum</span>
            </div>
            <div className="product-mini">
              <img
                src="https://cdn.shopify.com/s/files/1/2640/6190/files/lightweight-sunscreen-1.jpg?v=1762993050"
                alt="Daily sunscreen product"
              />
              <span>Daily SPF</span>
            </div>
          </div>
        </div>
      </div>
    </StoryVisual>
  );
}

const ANALYSIS_CONCERNS: ReadonlyArray<{
  id: AnalysisConcernId;
  title: string;
  body: string;
}> = [
  {
    id: "skin",
    title: "Skin quality",
    body: "Texture, tone, and barrier readiness — what daily care should support.",
  },
  {
    id: "volume",
    title: "Structure",
    body: "Volume support and facial balance — where lift or filler may help.",
  },
  {
    id: "expression",
    title: "Expression",
    body: "Dynamic lines and prevention — neuromodulators and maintenance.",
  },
];

function AnalysisVisual({ active }: { active: boolean }) {
  const [pinnedId, setPinnedId] = useState<AnalysisConcernId | null>(null);
  const [autoId, setAutoId] = useState<AnalysisConcernId>("skin");

  useEffect(() => {
    if (!active) {
      setPinnedId(null);
      setAutoId("skin");
    }
  }, [active]);

  useEffect(() => {
    if (!active || pinnedId) return;
    let i = 0;
    const tick = () => {
      setAutoId(ANALYSIS_CONCERNS[i % ANALYSIS_CONCERNS.length].id);
      i += 1;
    };
    tick();
    const timer = window.setInterval(tick, 3200);
    return () => window.clearInterval(timer);
  }, [active, pinnedId]);

  const focusId = pinnedId ?? autoId;
  const focusLayer = ANALYSIS_FACE_LAYERS.find((layer) => layer.id === focusId);

  return (
    <StoryVisual left="Facial analysis" right="Shared visual · one conversation">
      <div
        className={`analysis-panel${active ? " analysis-panel--active" : ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="analysis-layout">
          <div
            className={`analysis-face-plate analysis-face-plate--focus-${focusId}`}
          >
            <img
              className="analysis-face-map"
              src={TANYA_PIGMENT_MAP}
              alt="Patient pigmentation map with analysis regions"
              draggable={false}
            />
            <svg
              className="analysis-regions"
              viewBox="0 0 100 100"
              preserveAspectRatio="xMidYMid meet"
              aria-hidden
            >
              <defs>
                <filter
                  id="deck-analysis-glow"
                  x="-25%"
                  y="-25%"
                  width="150%"
                  height="150%"
                >
                  <feGaussianBlur stdDeviation="0.65" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <radialGradient id="deck-analysis-spot" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(255, 120, 70, 0.95)" />
                  <stop offset="55%" stopColor="rgba(255, 90, 50, 0.55)" />
                  <stop offset="100%" stopColor="rgba(255, 90, 50, 0)" />
                </radialGradient>
              </defs>
              {ANALYSIS_FACE_LAYERS.map((layer) => (
                <g
                  key={layer.id}
                  className={`analysis-layer analysis-layer--${layer.id}`}
                >
                  {layer.paths.map((d, index) => (
                    <path
                      key={`${layer.id}-fill-${index}`}
                      d={d}
                      className="analysis-shape analysis-shape--fill"
                    />
                  ))}
                  {layer.strokes.map((d, index) => (
                    <path
                      key={`${layer.id}-stroke-${index}`}
                      d={d}
                      className="analysis-shape analysis-shape--stroke"
                    />
                  ))}
                  {layer.spots.map((spot, index) => (
                    <ellipse
                      key={`${layer.id}-spot-${index}`}
                      className="analysis-spot"
                      cx={spot.cx}
                      cy={spot.cy}
                      rx={spot.rx * AURA_SKIN_SPOT_DISPLAY_SCALE}
                      ry={spot.ry * AURA_SKIN_SPOT_DISPLAY_SCALE}
                      fill="url(#deck-analysis-spot)"
                      opacity={spot.intensity ?? 0.7}
                    />
                  ))}
                </g>
              ))}
            </svg>
            {focusLayer ? (
              <span
                className={`analysis-face-label analysis-face-label--${focusLayer.id}`}
                style={{
                  left: `${focusLayer.callout.x}%`,
                  top: `${focusLayer.callout.y}%`,
                }}
              >
                {focusLayer.label}
              </span>
            ) : null}
          </div>

          <div className="analysis-side">
            <p className="analysis-side-kicker">Three lenses for the consult</p>
            <ul className="analysis-concern-list">
              {ANALYSIS_CONCERNS.map((item) => {
                const isFocus = focusId === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`analysis-concern${isFocus ? " is-focus" : ""}`}
                      aria-pressed={isFocus}
                      onClick={() =>
                        setPinnedId((prev) => (prev === item.id ? null : item.id))
                      }
                    >
                      <span className={`analysis-concern-dot analysis-concern-dot--${item.id}`} />
                      <span className="analysis-concern-copy">
                        <strong>{item.title}</strong>
                        <span>{item.body}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <ol className="analysis-plan-flow" aria-label="How findings map to plan types">
              <li className="analysis-plan-step">
                <b>Skincare</b>
                <span>Prep & protect</span>
              </li>
              <li className="analysis-plan-step">
                <b>Devices</b>
                <span>Texture & tone</span>
              </li>
              <li className="analysis-plan-step">
                <b>Injectables</b>
                <span>Structure & expression</span>
              </li>
            </ol>
            <p className="analysis-side-hint">
              {pinnedId ? "Click again to resume auto-highlight" : "Auto-walks · click to pin a lens"}
            </p>
          </div>
        </div>
      </div>
    </StoryVisual>
  );
}

const RECOMMEND_ADDONS = [
  { title: "Lower face filler", body: "Volume and fold softening" },
  { title: "Neuromodulator", body: "Dynamic line prevention" },
] as const;

const RECOMMEND_SEQUENCE = [
  { step: "01", title: "Prep skin", phase: "2 wk" },
  { step: "02", title: "Moxi series", phase: "Core" },
  { step: "03", title: "Filler refinement", phase: "Add-on" },
  { step: "04", title: "Maintenance", phase: "Keep" },
] as const;

function RecommenderVisual() {
  return (
    <StoryVisual left="Treatment recommender" right="One plan · one read">
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

        <section className="recommend-section">
          <p className="recommend-kicker">Sequenced for the visit</p>
          <ol className="recommend-timeline">
            {RECOMMEND_SEQUENCE.map((item) => (
              <li key={item.step} className="recommend-timeline-item">
                <span className="recommend-timeline-num">{item.step}</span>
                <span className="recommend-timeline-copy">
                  <b>{item.title}</b>
                  <em>{item.phase}</em>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </StoryVisual>
  );
}

const SHARE_PLAN_SECTIONS = [
  { step: "1", title: "Your scan", detail: "Analysis summary from the consult" },
  { step: "2", title: "Recommended plan", detail: "Moxi series · skincare prep · filler options" },
  { step: "3", title: "Next step", detail: "Book a visit or explore financing" },
] as const;

function ShareVisual() {
  return (
    <StoryVisual left="Personal plan link" right="Sent after the visit">
      <div className="share-panel">
        <div className="share-link-preview">
          <div className="share-link-bar">
            <span className="share-link-url">ponce.link/tanya</span>
          </div>
          <div className="share-link-card">
            <div className="share-link-header">
              <img
                src={assetSrc("public/demo-3d/tanya-tan-front.png")}
                alt=""
                draggable={false}
              />
              <div>
                <span className="share-link-from">From your provider</span>
                <strong>Tanya&apos;s treatment plan</strong>
              </div>
            </div>
            <ol className="share-link-sections">
              {SHARE_PLAN_SECTIONS.map((item) => (
                <li key={item.step}>
                  <span className="share-link-step">{item.step}</span>
                  <span className="share-link-copy">
                    <b>{item.title}</b>
                    <span>{item.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
            <div className="share-link-cta">View my plan</div>
          </div>
        </div>
        <p className="share-footnote">
          One link on any phone — patient, partner, or front desk can pick up the same story.
        </p>
      </div>
    </StoryVisual>
  );
}

const PROOF_ENGAGEMENT = [
  ["Open plan link", "92%"],
  ["Review plan", "78%"],
  ["Watch treatment content", "64%"],
  ["Click booking or financing", "41%"],
] as const;

function ProofVisual() {
  return (
    <StoryVisual left="Commercial signal" right="Measurable · repeatable">
      <div className="proof-panel">
        <div className="proof-hero-metric">
          <p className="proof-hero-kicker">Treatment revenue uplift</p>
          <strong>
            <span className="num" data-count="30" data-suffix="%">
              0%
            </span>
          </strong>
          <p className="proof-hero-desc">When the consult becomes a scan-backed plan patients revisit</p>
        </div>

        <div className="proof-metric-row">
          <div className="proof-metric proof-metric--compact">
            <p className="proof-metric-kicker">Time in plan</p>
            <strong>
              <span className="num" data-count="4.8" data-decimals="1" data-suffix=" min">
                0.0 min
              </span>
            </strong>
            <span>Average time reviewing the plan after the visit</span>
          </div>
          <div className="proof-metric proof-metric--highlight">
            <p className="proof-metric-kicker">Signal</p>
            <strong>High intent</strong>
            <span>Patients open, review, and act while context is still warm</span>
          </div>
        </div>

        <div className="proof-chart">
          <p className="proof-chart-kicker">Plan link engagement</p>
          <div className="activity activity--proof">
            {PROOF_ENGAGEMENT.map(([label, value]) => (
              <div className="activity-row" key={label}>
                <span>{label}</span>
                <div className="activity-bar">
                  <i style={{ "--w": value } as React.CSSProperties} />
                </div>
                <span className="activity-value">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </StoryVisual>
  );
}

function FinalSlide({ active }: { active: boolean }) {
  return (
    <Slide active={active} className="slide--hero-bg title-slide">
      <PingPongVideo
        active={active}
        className="slide-bg-video"
        src="src/assets/images/turntable_2048_black.mp4"
      />
      <p
        style={{
          fontSize: "0.8rem",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "var(--accent)",
          marginBottom: "1.5rem",
        }}
      >
        Next
      </p>
      <h1>
        Let&apos;s walk through Tanya&apos;s consult — <span className="shimmer">live</span>
      </h1>
      <p className="hero-line" style={{ textAlign: "center" }}>
        Problem · scan · skincare · analysis · treatment recommender · share · proof
      </p>
      <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem", flexWrap: "wrap", marginTop: "2rem" }}>
        <LinkButton path="/patients">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 4h10M3 8h8M3 12h5" />
          </svg>
          Start with Patient List
        </LinkButton>
        <LinkButton path="/client-details/admin-demo-tanya?view=facial-analysis">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="8" cy="6" r="3" />
            <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" />
          </svg>
          Open Tanya&apos;s Profile
        </LinkButton>
      </div>
      <p className="subtitle" style={{ marginTop: "2rem" }}>
        Questions welcome · Clinic demo · <span style={{ color: "var(--accent)" }}>[Your name]</span>
      </p>
    </Slide>
  );
}

function useBlueprintUrl() {
  const [url, setUrl] = useState(`${dashboardOrigin}/tp`);

  useEffect(() => {
    let cancelled = false;
    fetch("/demo/gravitas-tanya-blueprint.json")
      .then((res) => {
        if (!res.ok) throw new Error(`Blueprint demo JSON ${res.status}`);
        return res.json();
      })
      .then((payload) => {
        if (cancelled) return;
        const token = payload.token || "clinic-demo-tanya";
        setUrl(
          `${dashboardOrigin}/tp?t=${encodeURIComponent(token)}#d=${encodeURIComponent(
            encodeBlueprintForUrl(payload),
          )}`,
        );
      })
      .catch(() => setUrl(`${dashboardOrigin}/tp`));
    return () => {
      cancelled = true;
    };
  }, []);

  return url;
}

export function ClinicDemoDeck() {
  const [index, setIndex] = useState(0);
  const blueprintUrl = useBlueprintUrl();
  const total = 10;

  const slides = useMemo(
    () => [
      <TitleSlide active={index === 0} key="title" />,
      <SplitSlide
        active={index === 1}
        key="problem"
        label="The problem"
        title="Consult momentum drops after the visit"
        lead="Context, confidence, and follow-up momentum all drop once the patient walks out the door."
        chips={["Recall fades", "Context splits", "Intent cools"]}
      >
        <ProblemGraph />
      </SplitSlide>,
      <SplitSlide
        active={index === 2}
        key="shift"
        label="The shift"
        title="With Ponce, intent stays warm"
        lead="The consult becomes a plan patients can revisit and act on — while the momentum is still fresh."
        className="slide--accent-bg"
      >
        <WarmIntentGraph />
      </SplitSlide>,
      <SplitSlide
        active={index === 3}
        key="digital-twin"
        label="The digital twin"
        title="Scan from any phone or tablet"
        lead="A shared 3D visual built from a single still — works on any phone, tablet, or consult room screen."
      >
        <DigitalTwinMorph active={index === 3} />
      </SplitSlide>,
      <SplitSlide
        active={index === 4}
        key="skincare"
        label="The skincare foundation"
        title="Make daily care part of the treatment plan"
        lead="The skin quiz matches goals and habits to a routine that reinforces the clinical plan between visits."
      >
        <SkincareVisual />
      </SplitSlide>,
      <SplitSlide
        active={index === 5}
        key="conversation"
        label="The conversation"
        title="Discuss patient concerns holistically"
        lead="Walk through findings together so the patient understands the reasoning, not just the price."
        cta={
          <div className="launch-btn-row">
            <LinkButton path="/client-details/admin-demo-tanya?view=facial-analysis&section=analysis">
              Open live analysis
            </LinkButton>
          </div>
        }
      >
        <AnalysisVisual active={index === 5} />
      </SplitSlide>,
      <SplitSlide
        active={index === 6}
        key="recommender"
        label="The treatment recommender"
        title="Turn severity into a high-confidence plan"
        lead="Each treatment is justified by the scan, then sequenced into a plan the patient can follow."
        cta={
          <div className="launch-btn-row">
            <LinkButton path="/client-details/admin-demo-tanya?section=recommender">
              Open live recommender
            </LinkButton>
          </div>
        }
      >
        <RecommenderVisual />
      </SplitSlide>,
      <SplitSlide
        active={index === 7}
        key="share"
        label="The async review"
        title="Share the plan while interest is still warm"
        lead="One personalized link with the scan, plan, and next steps — easy to revisit with a partner or on their own time."
        cta={
          <>
            <div className="sms" style={{ marginTop: "0.75rem", maxWidth: "100%" }}>
              Hi Tanya — your treatment plan from <strong>your provider</strong> is ready:{" "}
              <strong>ponce.link/…</strong>
            </div>
            <div className="launch-btn-row">
              <LinkButton href={blueprintUrl}>Preview Tanya&apos;s plan</LinkButton>
            </div>
          </>
        }
      >
        <ShareVisual />
      </SplitSlide>,
      <SplitSlide
        active={index === 8}
        key="proof"
        label="The proof"
        title="Patients keep using it, and treatment revenue moves"
        lead="Plan-link engagement is measurable — and it moves treatment revenue."
        className="slide--accent-bg slide--proof"
      >
        <ProofVisual />
      </SplitSlide>,
      <FinalSlide active={index === 9} key="final" />,
    ],
    [blueprintUrl, index],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (["ArrowRight", " ", "PageDown"].includes(event.key)) {
        event.preventDefault();
        setIndex((i) => Math.min(i + 1, total - 1));
      } else if (["ArrowLeft", "PageUp"].includes(event.key)) {
        event.preventDefault();
        setIndex((i) => Math.max(i - 1, 0));
      } else if (event.key === "Home") {
        setIndex(0);
      } else if (event.key === "End") {
        setIndex(total - 1);
      } else if (event.key === "l" || event.key === "L") {
        const activeSlide = document.querySelector(".slide.active");
        const link = activeSlide?.querySelector<HTMLAnchorElement>(".launch-btn");
        if (link) window.open(link.href, "_blank", "noopener,noreferrer");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const slide = document.querySelector(".slide.active");
    slide?.querySelectorAll<HTMLElement>(".num[data-count]").forEach((el) => {
      const target = parseFloat(el.dataset.count || "0");
      const suffix = el.dataset.suffix || "";
      const decimals = parseInt(el.dataset.decimals || "0", 10);
      const start = performance.now();
      const duration = 1300;
      const step = (now: number) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = (target * eased).toFixed(decimals) + suffix;
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, [index]);

  const onDeckClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("a, button")) return;
    if (event.clientX / window.innerWidth < 0.25) setIndex((i) => Math.max(i - 1, 0));
    else setIndex((i) => Math.min(i + 1, total - 1));
  };

  return (
    <>
      <ParticleCanvas />
      <div className="deck" id="deck" onClick={onDeckClick}>
        {slides}
      </div>
      <nav className="slide-nav" aria-label="Slide navigation">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            title={`Slide ${i + 1}`}
            aria-label={`Go to slide ${i + 1}`}
            className={i === index ? "active" : ""}
            onClick={() => setIndex(i)}
          />
        ))}
      </nav>
      <div className="progress" style={{ width: `${((index + 1) / total) * 100}%` }} />
      <span className="slide-num">
        {index + 1} / {total}
      </span>
      <span className="nav-hint">
        ← → · space · click · <strong style={{ color: "var(--accent)" }}>L</strong> = open live
        link on this slide
      </span>
    </>
  );
}
