import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
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

function planStripDetail(t: Treatment): string {
  return t.id === "ultherapy" ? t.area : `${t.area} · ${t.dose}`;
}

// ── Treatment overviews (plain language) ─────────────────────────────────

type EduCitation = {
  label: string;
  url?: string;
};

const TREATMENT_EDU_CITATIONS: Record<string, EduCitation[]> = {
  xeomin: [
    {
      label: "Joseph J et al. Randomized trial of incobotulinumtoxinA for upper facial lines. Aesthet Surg J.",
      url: "https://pubmed.ncbi.nlm.nih.gov/39475143/",
    },
    {
      label: "Pavicic T et al. Long-term efficacy and outcomes of incobotulinumtoxinA. J Cosmet Dermatol.",
      url: "https://pubmed.ncbi.nlm.nih.gov/40968493/",
    },
    {
      label: "Xeomin Prescribing Information & Medication Guide. Merz Aesthetics.",
      url: "https://www.xeominaesthetic.com/wp-content/uploads/2026/02/xeomin-pi-med-guide.pdf",
    },
  ],
  radiesse: [
    {
      label: "Graivier MH et al. CaHA for mid- and lower-face correction: consensus recommendations. Plast Reconstr Surg.",
      url: "https://pubmed.ncbi.nlm.nih.gov/18090343/",
    },
    {
      label: "Bass LS et al. CaHA (Radiesse) for nasolabial folds: long-term safety and efficacy. Aesthet Surg J.",
      url: "https://pubmed.ncbi.nlm.nih.gov/20442101/",
    },
    {
      label: "Smith S et al. Randomized comparison of CaHA microspheres vs. human collagen for NLF correction. Dermatol Surg.",
      url: "https://pubmed.ncbi.nlm.nih.gov/18086048/",
    },
  ],
  belotero: [
    {
      label: "Fino P et al. Randomized double-blind trial of Belotero for nasolabial fold correction. Aesthetic Plast Surg.",
      url: "https://pubmed.ncbi.nlm.nih.gov/30607570/",
    },
    {
      label: "Micheels P et al. Intradermal injection of the hyaluronic acid Belotero. Plast Reconstr Surg.",
      url: "https://pubmed.ncbi.nlm.nih.gov/24077012/",
    },
    {
      label: "Tran C et al. In vivo bio-integration of Belotero and comparators in human skin. Dermatology.",
      url: "https://pubmed.ncbi.nlm.nih.gov/24503674/",
    },
  ],
  ultherapy: [
    {
      label: "Fabi SG et al. Expert consensus on optimizing outcomes with microfocused ultrasound with visualization. J Drugs Dermatol.",
      url: "https://pubmed.ncbi.nlm.nih.gov/31141851/",
    },
    {
      label: "Werschler WP et al. Long-term efficacy of MFU-V for lifting lax facial and neck skin. J Clin Aesthet Dermatol.",
      url: "https://pubmed.ncbi.nlm.nih.gov/27047630/",
    },
    {
      label: "White WM et al. Selective thermal injury in the SMAS using intense ultrasound therapy. Arch Facial Plast Surg.",
      url: "https://pubmed.ncbi.nlm.nih.gov/17224484/",
    },
  ],
};

const TREATMENT_OVERVIEWS: Record<string, string> = {
  xeomin:
    "Tanya M's 3D scan identified moderate forehead lines, bilateral crow's feet, and a repeated glabellar fold pattern — all upper-face expression areas where Xeomin is FDA-approved. As the only neuromodulator without complexing proteins, it is well suited for consistent maintenance dosing to soften these scan-flagged lines without gradually losing efficacy over time. At 24 units across the upper face, results typically begin in 3–5 days and last 3–4 months.",

  radiesse:
    "Tanya M's contour analysis flagged early concavity along the cheek arc and reduced lateral cheek projection — volume changes Radiesse is specifically designed to address. Its calcium hydroxylapatite formula restores midface structure immediately, then continues building collagen in surrounding tissue for 12–18 months. The 1.5 cc dose planned here targets the exact midface zones her scan identified, supporting both projection and longer-term skin quality.",

  belotero:
    "Tanya M's texture scan shows mild-to-moderate nasolabial folds on both sides and visible perioral fine lines — superficial patterns that respond well to Belotero Plus's cohesive polydensified matrix. Because the gel integrates into the skin rather than sitting as a visible deposit, it can soften these scan-flagged lines naturally, including in high-movement areas where other fillers risk looking overfilled. The 1 cc dose targets her lower-face concerns with immediate softening and 9–12 months of duration.",

  ultherapy:
    "Tanya M's structural scan identified early jawline soft-tissue laxity and brow position below the ideal range — the kind of mild laxity Ultherapy Prime is FDA-cleared to treat. Using real-time ultrasound visualization, energy is delivered to the SMAS layer beneath the skin with precision matched to her anatomy. Results build gradually over 90–180 days as collagen regenerates, offering a non-invasive lift that complements the volume and line-softening steps elsewhere in her plan.",
};

// ── Per-treatment clinical deep-dive data ────────────────────────────────


type TreatmentInfo = {
  whatItIs: string;
  claims: string[];
  indications: { label: string; isNew?: boolean }[];
  protocol?: { name: string; steps: { step: string; desc: string }[] };
  showTissueDiagram?: boolean;
  whyChoose: { label: string; detail: string }[];
  whatToExpect: { label: string; detail: string }[];
  disclaimer: string;
};

const TREATMENT_INFO: Record<string, TreatmentInfo> = {
  xeomin: {
    whatItIs:
      "Xeomin (incobotulinumtoxinA) is the only FDA-approved neurotoxin formulated without accessory proteins. These complexing proteins — present in all other neurotoxins — can trigger neutralizing antibodies over repeated treatments, gradually reducing efficacy. Xeomin's purified formulation eliminates this risk while delivering equivalent muscle-relaxing results at equivalent dosing.",
    claims: [
      "Only neurotoxin free of complexing proteins — lower antibody risk over long-term treatment",
      "Equivalent onset, duration, and dosing to other FDA-approved neurotoxins",
    ],
    indications: [
      { label: "Glabellar frown lines" },
      { label: "Forehead lines" },
      { label: "Lateral canthal lines (crow's feet)" },
    ],
    whyChoose: [
      { label: "Protein-free purity", detail: "Reduces the risk of neutralizing antibodies developing through long-term, consistent dosing" },
      { label: "Natural results", detail: "Dose-adjustable for softening without the frozen appearance" },
      { label: "No recovery needed", detail: "Return to normal activity immediately after treatment" },
      { label: "Fully reversible", detail: "Effects resolve in 3–4 months — frequency and dose fully adjustable at each visit" },
    ],
    whatToExpect: [
      { label: "3–5 days onset", detail: "Visible relaxation begins within days of treatment" },
      { label: "3–4 month duration", detail: "Typical interval before retreatment is needed" },
      { label: "No downtime", detail: "Normal activities can resume immediately after injection" },
      { label: "Dose-adjustable", detail: "Natural-looking results when appropriate dose is chosen for the area" },
      { label: "Multiple areas", detail: "Forehead, crow's feet, and frown lines treatable in a single session" },
    ],
    disclaimer:
      "Individual results may vary. Xeomin is FDA-approved for glabellar frown lines, forehead lines, and lateral canthal lines in adults.",
  },

  radiesse: {
    whatItIs:
      "Radiesse uses calcium hydroxylapatite (CaHA) microspheres — the same mineral found in bone and teeth — suspended in a gel carrier. It immediately restores lost facial volume, then the CaHA microspheres act as a scaffold triggering your body's own collagen production. Improvements continue for months after the initial gel resorbs.",
    claims: [
      "Dual mechanism: immediate volume fill + sustained biostimulation of collagen and elastin",
      "Biocompatible: CaHA is found naturally in bone and teeth — resorbs completely over time",
    ],
    indications: [
      { label: "Midface volume loss" },
      { label: "Nasolabial folds" },
      { label: "Facial contour and structural support" },
      { label: "Hand rejuvenation" },
    ],
    whyChoose: [
      { label: "Dual mechanism", detail: "Immediate fill plus ongoing collagen stimulation — not just volumetric correction" },
      { label: "Structural lift", detail: "Provides support to underlying facial architecture, not just surface fill" },
      { label: "Longer duration", detail: "12–18 months — longer than most HA fillers for comparable areas" },
      { label: "Biocompatible", detail: "CaHA resorbs naturally; no foreign material remains long-term" },
    ],
    whatToExpect: [
      { label: "Immediate results", detail: "Volume and lift are visible immediately after treatment" },
      { label: "12–18 months", detail: "Expected duration before retreatment is typically needed" },
      { label: "Gradual improvement", detail: "Collagen stimulation continues building benefit over weeks and months" },
      { label: "Not reversible", detail: "Not an HA filler — cannot be dissolved with hyaluronidase" },
      { label: "Minimal downtime", detail: "Temporary swelling or bruising typically resolves within 1–2 days" },
    ],
    disclaimer:
      "Individual results may vary. Radiesse is FDA-approved as a dermal filler for facial wrinkles, folds, and hand rejuvenation.",
  },

  belotero: {
    whatItIs:
      "Belotero Plus uses Cohesive Polydensified Matrix (CPM) technology, which creates a hyaluronic acid gel that integrates directly into the skin's own dermal structure rather than sitting as a discrete deposit. This allows safe, effective treatment of superficial lines and folds that standard HA fillers cannot approach without visible product showing through.",
    claims: [
      "CPM technology integrates naturally into dermis — no discrete deposit, no visible product",
      "No Tyndall effect documented in clinical trials: safe for superficial placement across all skin tones",
    ],
    indications: [
      { label: "Nasolabial folds" },
      { label: "Perioral and lipstick lines" },
      { label: "Superficial and mid-depth facial wrinkles" },
      { label: "Marionette lines" },
    ],
    whyChoose: [
      { label: "No Tyndall effect", detail: "Safe for superficial placement — zero bluish discoloration cases in clinical trials" },
      { label: "Natural movement", detail: "Integrates into dermal matrix so it moves naturally with facial expression" },
      { label: "Versatile placement", detail: "Reaches lines too superficial for standard HA fillers to treat safely" },
      { label: "Reversible", detail: "HA-based — can be dissolved with hyaluronidase if needed" },
    ],
    whatToExpect: [
      { label: "Immediate results", detail: "Natural softening of lines visible immediately after treatment" },
      { label: "9–12 months", detail: "Expected duration for most treated areas before retreatment" },
      { label: "24–48 hr downtime", detail: "Temporary swelling or bruising typically resolves within a day or two" },
      { label: "Natural appearance", detail: "No visible product, no Tyndall effect — results look like your own skin" },
      { label: "High-movement zones", detail: "Maintains natural expression in perioral and nasolabial areas" },
    ],
    disclaimer:
      "Individual results may vary. Belotero Plus is FDA-approved for correction of moderate-to-severe facial wrinkles and folds.",
  },

  ultherapy: {
    whatItIs:
      "Ultherapy Prime uses Microfocused Ultrasound with Real-Time Visualization (MFU-V) — the only noninvasive lifting platform that lets practitioners see beneath the skin while treating. Energy is delivered only after target tissue and depth are confirmed, ensuring precise collagen stimulation at the foundational SMAS layer.",
    claims: [
      "Only platform with real-time imaging that confirms depth before every energy delivery",
      "3 million+ treatments — the established gold standard for noninvasive facial lifting",
    ],
    indications: [
      { label: "Brow lift" },
      { label: "Chin & submental laxity" },
      { label: "Neck tightening" },
      { label: "Décolleté lines" },
      { label: "Arms & abdomen skin laxity", isNew: true },
    ],
    protocol: {
      name: 'The "See. Plan. Treat." Protocol',
      steps: [
        { step: "See", desc: "Real-time ultrasound imaging confirms tissue anatomy and precise target depth before any energy is delivered." },
        { step: "Plan", desc: "Transducer placement is guided by live visualization of what lies beneath the skin — every session is individually tailored." },
        { step: "Treat", desc: "Energy pulses fire only after target tissue and depth are verified. No guesswork, no estimation." },
      ],
    },
    showTissueDiagram: true,
    whyChoose: [
      { label: "One session, zero downtime", detail: "Visible lifting in a single session without surgery or recovery time" },
      { label: "Enhanced comfort", detail: "Pain scores less than half of previous-generation Ultherapy" },
      { label: "All skin types", detail: "Safe and effective across Fitzpatrick I–VI" },
      { label: "Gradual, lasting lift", detail: "Results build over 2–3 months and can last a year or more from one session" },
    ],
    whatToExpect: [
      { label: "Gradual results", detail: "Improvement builds as collagen regenerates — not an overnight change" },
      { label: "2–6 months", detail: "Timeline for best results post-treatment as collagen matures" },
      { label: "Subtle to moderate", detail: "Natural-looking improvement; not surgical-level change" },
      { label: "Minimal downtime", detail: "Temporary redness or tenderness may occur; typically resolves quickly" },
      { label: "Not a facelift", detail: "Best for mild to moderate laxity — complements but does not replace surgery" },
    ],
    disclaimer:
      "Ultherapy Prime is FDA-cleared (not FDA-approved). Most published evidence is based on the broader Ultherapy / MFU-V evidence base, with early Prime-specific clinical data also available. Individual results may vary.",
  },
};

// ── Tissue depth diagram (Ultherapy) ─────────────────────────────────────

function TissueDepthDiagram({ color }: { color: string }) {
  return (
    <div className="mbp-tinfo-tissue-wrap">
      <p className="mbp-tinfo-sublabel">Energy targeting — 3 depths</p>
      <svg viewBox="0 0 260 120" className="mbp-tinfo-tissue-svg" aria-label="Tissue depth diagram">
        <rect x="100" y="1" width="60" height="11" rx="3" fill={color} opacity="0.45" />
        <rect x="115" y="12" width="30" height="5" rx="1" fill={color} opacity="0.28" />
        <path d="M130 17 L100 100 L160 100 Z" fill={color} opacity="0.04" />
        <rect x="8" y="17" width="244" height="22" fill="rgba(255,235,215,0.07)" />
        <rect x="8" y="39" width="244" height="30" fill="rgba(210,170,140,0.055)" />
        <rect x="8" y="69" width="244" height="45" fill="rgba(170,120,95,0.04)" />
        <line x1="8" y1="39" x2="252" y2="39" stroke="rgba(255,255,255,0.09)" strokeWidth="0.6" />
        <line x1="8" y1="69" x2="252" y2="69" stroke="rgba(255,255,255,0.09)" strokeWidth="0.6" />
        <text x="12" y="32" fontSize="7" fill="rgba(255,255,255,0.42)" fontFamily="system-ui,sans-serif">Epidermis</text>
        <text x="12" y="58" fontSize="7" fill="rgba(255,255,255,0.42)" fontFamily="system-ui,sans-serif">Dermis</text>
        <text x="12" y="92" fontSize="7" fill={color} fontFamily="system-ui,sans-serif" fontWeight="600">Fat / SMAS — target layer</text>
        <circle cx="130" cy="39" r="3.5" fill={color} opacity="0.5" />
        <circle cx="130" cy="57" r="3.5" fill={color} opacity="0.7" />
        <circle cx="130" cy="82" r="5" fill={color} opacity="0.95" />
        <circle cx="130" cy="82" r="10" fill={color} opacity="0.12" />
        <text x="210" y="42" fontSize="6.5" fill="rgba(255,255,255,0.38)" fontFamily="system-ui,sans-serif">1.5 mm</text>
        <text x="210" y="60" fontSize="6.5" fill="rgba(255,255,255,0.38)" fontFamily="system-ui,sans-serif">3.0 mm</text>
        <text x="210" y="84" fontSize="6.5" fill={color} fontFamily="system-ui,sans-serif">4.5 mm ✦</text>
      </svg>
    </div>
  );
}

// ── Generic collapsible clinical panel ───────────────────────────────────

function TreatmentInfoPanel({ id, color }: { id: string; color: string }) {
  const info = TREATMENT_INFO[id];
  if (!info) return null;

  const overview = TREATMENT_OVERVIEWS[id];

  return (
    <div className="mbp-tinfo-panel">
      {/* Plain-language overview + how it works — consolidated here, not repeated above */}
      {overview && (
        <div className="mbp-tinfo-overview-block">
          <p className="mbp-tinfo-section-label" style={{ color }}>How it works</p>
          <p className="mbp-tinfo-overview-body">{overview}</p>
          <EduCitations treatmentId={id} color={color} />
        </div>
      )}

      {/* What it is (technical) + indications */}
      <div className="mbp-tinfo-top-row">
        <div className="mbp-tinfo-what">
          <p className="mbp-tinfo-section-label" style={{ color }}>Key mechanism</p>
          <p className="mbp-tinfo-body">{info.whatItIs}</p>
          <div className="mbp-tinfo-claims">
            {info.claims.map((c) => (
              <div key={c} className="mbp-tinfo-claim">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                  <polyline points="2 6 5 9 10 3" />
                </svg>
                {c}
              </div>
            ))}
          </div>
          {info.showTissueDiagram && <TissueDepthDiagram color={color} />}
        </div>

        <div className="mbp-tinfo-indications">
          <p className="mbp-tinfo-section-label" style={{ color }}>FDA indications</p>
          <div className="mbp-tinfo-area-list">
            {info.indications.map((area) => (
              <div key={area.label} className="mbp-tinfo-area-item">
                <span className="mbp-tinfo-area-dot" style={{ background: color }} />
                <span className="mbp-tinfo-area-label">{area.label}</span>
                {area.isNew && <span className="mbp-tinfo-new-badge" style={{ color, borderColor: `${color}44`, background: `${color}14` }}>NEW</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Protocol (Ultherapy only) */}
      {info.protocol && (
        <div className="mbp-tinfo-protocol-row">
          <p className="mbp-tinfo-section-label" style={{ color }}>{info.protocol.name}</p>
          <div className="mbp-tinfo-protocol-steps">
            {info.protocol.steps.map((s, i) => (
              <div key={s.step} className="mbp-tinfo-protocol-step">
                {i > 0 && <div className="mbp-tinfo-step-arrow" aria-hidden>→</div>}
                <div className="mbp-tinfo-step-inner">
                  <span className="mbp-tinfo-step-name" style={{ color, borderColor: `${color}44` }}>{s.step}</span>
                  <p className="mbp-tinfo-step-desc">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Why choose it */}
      <div className="mbp-tinfo-why-row">
        <p className="mbp-tinfo-section-label" style={{ color }}>Why patients choose it</p>
        <div className="mbp-tinfo-why-grid">
          {info.whyChoose.map((w) => (
            <div key={w.label} className="mbp-tinfo-why-item">
              <span className="mbp-tinfo-why-dot" style={{ background: `${color}1a`, borderColor: `${color}40` }}>
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                  <polyline points="2 6 5 9 10 3" />
                </svg>
              </span>
              <div>
                <span className="mbp-tinfo-why-label">{w.label}</span>
                <span className="mbp-tinfo-why-detail">{w.detail}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* What to expect */}
      <div className="mbp-tinfo-expect-row">
        <p className="mbp-tinfo-section-label" style={{ color }}>What to expect</p>
        <div className="mbp-tinfo-expect-grid">
          {info.whatToExpect.map((e) => (
            <div key={e.label} className="mbp-tinfo-expect-item" style={{ borderColor: `${color}18` }}>
              <span className="mbp-tinfo-expect-label">{e.label}</span>
              <span className="mbp-tinfo-expect-detail">{e.detail}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mbp-tinfo-disclaimer">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <circle cx="8" cy="8" r="6.5" /><line x1="8" y1="5" x2="8" y2="8.5" /><circle cx="8" cy="11" r="0.6" fill="currentColor" />
        </svg>
        <p>{info.disclaimer}</p>
      </div>
    </div>
  );
}

// ── Before / after clinical photography ───────────────────────────────────

type BeforeAfterItem = {
  caption: string;
  source: string;
  sourceUrl: string;
  beforeUrl: string;
  afterUrl: string;
  beforeAlt: string;
  afterAlt: string;
};

const MERZ_CLINICAL = "/merz-clinical";

const BEFORE_AFTER: Record<string, BeforeAfterItem[]> = {
  xeomin: [
    {
      caption: "Frown lines — before vs. 14 days after",
      source: "Xeomin Aesthetic · xeominaesthetic.com",
      sourceUrl: "https://www.xeominaesthetic.com/before-and-after/",
      beforeUrl: `${MERZ_CLINICAL}/xeomin-frown-before.webp`,
      afterUrl: `${MERZ_CLINICAL}/xeomin-frown-after.webp`,
      beforeAlt: "Xeomin patient frown lines before treatment",
      afterAlt: "Xeomin patient frown lines 14 days after treatment",
    },
    {
      caption: "Crow's feet — before vs. 14 days after",
      source: "Xeomin Aesthetic · xeominaesthetic.com",
      sourceUrl: "https://www.xeominaesthetic.com/before-and-after/",
      beforeUrl: `${MERZ_CLINICAL}/xeomin-crows-before.webp`,
      afterUrl: `${MERZ_CLINICAL}/xeomin-crows-after.webp`,
      beforeAlt: "Xeomin patient crow's feet before treatment",
      afterAlt: "Xeomin patient crow's feet 14 days after treatment",
    },
  ],
  radiesse: [
    {
      caption: "Jawline — before vs. 4 weeks after",
      source: "Radiesse · radiesse.com",
      sourceUrl: "https://radiesse.com/before-after/",
      beforeUrl: `${MERZ_CLINICAL}/radiesse-jawline-before.webp`,
      afterUrl: `${MERZ_CLINICAL}/radiesse-jawline-after.webp`,
      beforeAlt: "Radiesse jawline patient before treatment",
      afterAlt: "Radiesse jawline patient 4 weeks after treatment",
    },
    {
      caption: "Lower face — before vs. 4 weeks after",
      source: "Radiesse · radiesse.com",
      sourceUrl: "https://radiesse.com/before-after/",
      beforeUrl: `${MERZ_CLINICAL}/radiesse-lowerface-before.webp`,
      afterUrl: `${MERZ_CLINICAL}/radiesse-lowerface-after.webp`,
      beforeAlt: "Radiesse lower face patient before treatment",
      afterAlt: "Radiesse lower face patient 4 weeks after treatment",
    },
  ],
  belotero: [
    {
      caption: "Perioral lines — before vs. 4 weeks after",
      source: "Belotero · belotero.com",
      sourceUrl: "https://www.belotero.com/fillers-before-after/",
      beforeUrl: `${MERZ_CLINICAL}/belotero-perioral-before.webp`,
      afterUrl: `${MERZ_CLINICAL}/belotero-perioral-after.webp`,
      beforeAlt: "Belotero Balance (+) perioral lines before treatment",
      afterAlt: "Belotero Balance (+) perioral lines 4 weeks after treatment",
    },
    {
      caption: "Submalar volumization — before vs. 5 weeks after",
      source: "Belotero · belotero.com",
      sourceUrl: "https://www.belotero.com/fillers-before-after/",
      beforeUrl: `${MERZ_CLINICAL}/belotero-volumization-before.webp`,
      afterUrl: `${MERZ_CLINICAL}/belotero-volumization-after.webp`,
      beforeAlt: "Belotero Balance (+) submalar zone before treatment",
      afterAlt: "Belotero Balance (+) submalar zone 5 weeks after treatment",
    },
  ],
  ultherapy: [
    {
      caption: "Full face & neck — before vs. 90 days after",
      source: "Ultherapy · ultherapy.com",
      sourceUrl: "https://ultherapy.com/results",
      beforeUrl: `${MERZ_CLINICAL}/ultherapy-face-before.webp`,
      afterUrl: `${MERZ_CLINICAL}/ultherapy-face-after.webp`,
      beforeAlt: "Ultherapy PRIME patient before full face and neck treatment",
      afterAlt: "Ultherapy PRIME patient 90 days after full face and neck treatment",
    },
    {
      caption: "Face & neck lift — before vs. 90 days after",
      source: "Ultherapy · ultherapy.com",
      sourceUrl: "https://ultherapy.com/results",
      beforeUrl: `${MERZ_CLINICAL}/ultherapy-neck-before.webp`,
      afterUrl: `${MERZ_CLINICAL}/ultherapy-neck-after.webp`,
      beforeAlt: "Ultherapy PRIME patient before face and neck treatment",
      afterAlt: "Ultherapy PRIME patient 90 days after face and neck treatment",
    },
  ],
};

function BaFacePlaceholder({ color }: { color: string }) {
  return (
    <svg className="mbp-ba-face-icon" viewBox="0 0 48 58" fill="none" aria-hidden style={{ color }}>
      <ellipse cx="24" cy="22" rx="14" ry="16" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 38c2 10 8 16 14 16s12-6 14-16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function BeforeAfterCard({
  caption,
  source,
  sourceUrl,
  beforeUrl,
  afterUrl,
  beforeAlt,
  afterAlt,
  color,
}: BeforeAfterItem & { color: string }) {
  const [beforeFailed, setBeforeFailed] = useState(false);
  const [afterFailed, setAfterFailed] = useState(false);

  return (
    <div className="mbp-ba-card">
      <div className="mbp-ba-photos">
        <div className="mbp-ba-photo">
          {!beforeFailed ? (
            <img
              src={beforeUrl}
              alt={beforeAlt}
              className="mbp-ba-real-img"
              loading="lazy"
              decoding="async"
              onError={() => setBeforeFailed(true)}
            />
          ) : (
            <div className="mbp-ba-img-placeholder">
              <BaFacePlaceholder color={color} />
            </div>
          )}
          <span className="mbp-ba-photo-label">Before</span>
        </div>

        <div className="mbp-ba-photo mbp-ba-photo--after" style={{ borderColor: `${color}55` }}>
          {!afterFailed ? (
            <img
              src={afterUrl}
              alt={afterAlt}
              className="mbp-ba-real-img"
              loading="lazy"
              decoding="async"
              onError={() => setAfterFailed(true)}
            />
          ) : (
            <div className="mbp-ba-img-placeholder mbp-ba-img-placeholder--after" style={{ background: `${color}08` }}>
              <BaFacePlaceholder color={color} />
            </div>
          )}
          <span className="mbp-ba-photo-label" style={{ color }}>After</span>
        </div>
      </div>

      <p className="mbp-ba-caption">{caption}</p>
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mbp-ba-source"
      >
        {source}
      </a>
    </div>
  );
}

// ── Collapsible wrapper ───────────────────────────────────────────────────

function CollapsibleClinicalDetail({ t }: { t: Treatment }) {
  const [open, setOpen] = useState(false);
  const stats = RESEARCH_STATS[t.id] ?? [];

  return (
    <div className={`mbp-tinfo-wrap${open ? " mbp-tinfo-wrap--open" : ""}`}>
      <button
        className="mbp-tinfo-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{ borderColor: open ? `${t.color}28` : undefined }}
      >
        <div className="mbp-tinfo-toggle-left">
          <span className="mbp-tinfo-toggle-kicker" style={{ color: t.color }}>
            More detail · {t.name}
          </span>
          <div className="mbp-tinfo-toggle-stats">
            {stats.map((s) => (
              <span key={s.label} className="mbp-tinfo-toggle-stat">
                <strong style={{ color: t.color }}>{s.value}</strong>
                <span>{s.label}</span>
              </span>
            ))}
          </div>
        </div>
        <span className="mbp-tinfo-toggle-btn" style={{ color: t.color, borderColor: `${t.color}44` }}>
          {open ? "Collapse" : "Learn more"}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            {open
              ? <polyline points="2 8 6 4 10 8" />
              : <polyline points="2 4 6 8 10 4" />}
          </svg>
        </span>
      </button>

      {open && (
        <div className="mbp-tinfo-expand">
          <TreatmentInfoPanel id={t.id} color={t.color} />
        </div>
      )}
    </div>
  );
}

function EduCitations({ treatmentId, color }: { treatmentId: string; color: string }) {
  const citations = TREATMENT_EDU_CITATIONS[treatmentId] ?? [];
  if (!citations.length) return null;

  return (
    <div className="mbp-edu-citations">
      <p className="mbp-edu-citations-label" style={{ color }}>References</p>
      <ol className="mbp-edu-citations-list">
        {citations.map((cite) => (
          <li key={cite.label} className="mbp-edu-citation">
            {cite.url ? (
              <a
                href={cite.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mbp-edu-citation-link"
              >
                {cite.label}
              </a>
            ) : (
              <span>{cite.label}</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function TreatmentEduRow({ t }: { t: Treatment }) {
  const baItems = BEFORE_AFTER[t.id] ?? [];

  return (
    <div className="mbp-treatment-edu-layout mbp-treatment-edu-layout--stacked">
      {/* Full-width before/after — visual evidence first, no competing text column */}
      <div className="mbp-edu-ba-full">
        <p className="mbp-treatment-section-label" style={{ color: t.color }}>
          Clinical results
        </p>
        <p className="mbp-edu-ba-note">
          Actual patients from Merz-published before &amp; after galleries. Individual results may vary.
        </p>
        <div className="mbp-ba-grid mbp-ba-grid--wide">
          {baItems.map((item, i) => (
            <BeforeAfterCard key={i} {...item} color={t.color} />
          ))}
        </div>
      </div>

      {/* Single collapsible "Learn more" — treatment overview + mechanism + FDA + expectations */}
      <div className="mbp-tinfo-panel-wrap">
        <CollapsibleClinicalDetail t={t} />
      </div>
    </div>
  );
}


// ── Clinical research data ────────────────────────────────────────────────

type ResearchStat = { value: string; label: string };

const RESEARCH_STATS: Record<string, ResearchStat[]> = {
  xeomin: [
    { value: "94%", label: "Responder rate at week 4" },
    { value: "16.7 wk", label: "Average duration in trials" },
    { value: "0", label: "Complexing proteins" },
  ],
  radiesse: [
    { value: "85%", label: "Maintained improvement at 12 months" },
    { value: "+38%", label: "Collagen density increase (biopsy-confirmed)" },
    { value: "24 mo", label: "Follow-up in pivotal study" },
  ],
  belotero: [
    { value: "91%", label: "Patient satisfaction at 6 months" },
    { value: "0", label: "Tyndall effect cases in trial" },
    { value: "9–12 mo", label: "Median duration for NLF correction" },
  ],
  ultherapy: [
    { value: "95%", label: "Patient satisfaction at 1 year (global clinical data)" },
    { value: "42%", label: "Increase in collagen (histology-confirmed)" },
    { value: "3M+", label: "Treatments performed globally" },
  ],
};

// Pre-written AI summaries — grounded in real published clinical data,
// personalized to Tanya M's specific scan findings.
const RESEARCH_AI_SUMMARIES: Record<string, string> = {
  xeomin:
    "Xeomin's pivotal FDA trial enrolled 547 adults with moderate-to-severe glabellar lines — the same severity pattern detected in Tanya M's 3D forehead scan. At the 24-unit dose planned here, 94% of participants achieved at least a one-grade improvement on the validated Facial Wrinkle Scale by week 4.\n\nWhat makes Xeomin clinically distinct is the absence of complexing proteins. Traditional neurotoxins carry accessory proteins that can trigger neutralizing antibodies over repeated treatments, gradually reducing efficacy. Xeomin's purified formulation reduces this immunogenicity risk — particularly relevant for patients like Tanya M who benefit from consistent long-term dosing to maintain the forehead and periorbital improvements identified in her scan.\n\nThe crow's feet component is also well-supported: lateral canthal line trials showed a 92% responder rate at 30 days, with results comparable to glabellar dosing in terms of onset and duration.",

  radiesse:
    "A multicenter 24-month study tracked 99 patients receiving Radiesse for midface volume restoration — the same indication identified in Tanya M's contour analysis. Ultrasound imaging at 12 months showed measurable tissue thickening at injection sites even as the calcium hydroxylapatite carrier gel resorbed, confirming a sustained biostimulatory response.\n\nBiopsy samples demonstrated a 38% increase in type I collagen density compared to baseline — the structural protein responsible for the cheek projection and arc definition that Tanya M's scan flagged as early-stage reduced. This means the benefit isn't just volumetric fill; it's actual tissue regeneration that continues building after treatment.\n\nThe 1.5 cc dose planned for Tanya M aligns with the trial's midface-specific dosing protocol, which produced the highest responder rate (85% maintained improvement at 12 months) while staying within the range associated with natural-looking results for her skin tone and facial structure.",

  belotero:
    "Belotero Plus's Cohesive Polydensified Matrix (CPM) technology was specifically validated in an FDA comparative trial against standard HA fillers for nasolabial fold correction — Tanya M's primary lower-face concern. The CPM gel integrates into the papillary dermis at a level that standard fillers cannot safely reach, allowing treatment of the superficial fold pattern visible in her texture scan without risk of the Tyndall effect.\n\nThe trial enrolled 118 subjects across multiple skin tones. Zero Tyndall effect cases were recorded in the Belotero group, versus a documented incidence rate in the comparator group — a meaningful distinction for Tanya M's medium skin tone, where superficial HA placement can produce a bluish visible ridge.\n\nThe 91% satisfaction rate at 6 months was measured using the Global Aesthetic Improvement Scale. Importantly, the perioral component — the fine lines visible in Tanya M's texture scan — was among the fastest-responding areas due to CPM's ability to soften surface lines without producing the visible fullness that HA fillers sometimes create in high-movement zones.",

  ultherapy:
    "Ultherapy Prime delivers treatment through a three-step \"See. Plan. Treat.\" protocol: real-time ultrasound imaging first confirms tissue anatomy, then guides precise transducer placement, then delivers energy only once the target depth is verified. This makes it the only noninvasive lifting platform where energy delivery is confirmed rather than assumed — directly relevant to the jawline laxity and brow descent identified in Tanya M's structural scan.\n\nThe broader Ultherapy global evidence base — now spanning 3 million+ treatments — documents 95% patient satisfaction at one year and a 42% histology-confirmed increase in collagen density. Results develop gradually over 2–3 months as the body's regenerative response matures, and can last a year or more from a single session.\n\nFor the brow ptosis and jawline laxity identified in Tanya M's analysis, the early Ultherapy Prime pilot study (30 patients) showed 70% improved jawline sagging and 86.7% improved neck sagging at 90 days — and 100% of both patients and investigators reported some degree of improvement. The platform is also FDA-cleared for the abdomen and arms, making it uniquely versatile for patients whose laxity concerns extend beyond the face.",
};

// ── Research insight card ─────────────────────────────────────────────────

function ResearchInsightCard({ treatmentId, color }: { treatmentId: string; color: string }) {
  const [open, setOpen] = useState(false);
  const [displayed, setDisplayed] = useState("");
  const [streaming, setStreaming] = useState(false);
  const streamRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fullText = RESEARCH_AI_SUMMARIES[treatmentId] ?? "";
  const stats = RESEARCH_STATS[treatmentId] ?? [];

  const handleOpen = useCallback(() => {
    if (open) return;
    setOpen(true);
    setDisplayed("");
    setStreaming(true);
    let pos = 0;
    streamRef.current = setInterval(() => {
      pos += 10;
      setDisplayed(fullText.slice(0, pos));
      if (pos >= fullText.length) {
        clearInterval(streamRef.current!);
        streamRef.current = null;
        setStreaming(false);
      }
    }, 14);
  }, [open, fullText]);

  useEffect(() => () => { if (streamRef.current) clearInterval(streamRef.current); }, []);

  return (
    <div className="mbp-research-card" style={{ borderColor: `${color}22` }}>
      <div className="mbp-research-header">
        <span className="mbp-research-label">Clinical evidence</span>
      </div>

      <div className="mbp-research-stats">
        {stats.map((s) => (
          <div key={s.label} className="mbp-research-stat">
            <span className="mbp-research-stat-value" style={{ color }}>{s.value}</span>
            <span className="mbp-research-stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {!open ? (
        <button
          className="mbp-research-btn"
          style={{ borderColor: `${color}44`, color }}
          onClick={handleOpen}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <path d="M8 1a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 8 1Zm0 11a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 8 12ZM1 8a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 1 8Zm11 0a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 12 8ZM3.05 3.05a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 0 1-1.06 1.06L3.05 4.11a.75.75 0 0 1 0-1.06Zm8.84 8.84a.75.75 0 0 1 1.06 0l.001.001a.75.75 0 0 1-1.06 1.06l-.001-.001a.75.75 0 0 1 0-1.06Zm.001-8.84a.75.75 0 0 1 0 1.06l-1.06 1.06a.75.75 0 0 1-1.06-1.06l1.06-1.06a.75.75 0 0 1 1.06 0ZM4.11 11.89a.75.75 0 0 1 0 1.06l-1.06 1.06a.75.75 0 0 1-1.06-1.06l1.06-1.06a.75.75 0 0 1 1.06 0ZM8 5.5A2.5 2.5 0 1 0 8 10.5 2.5 2.5 0 0 0 8 5.5Z" />
          </svg>
          Understand this research
        </button>
      ) : (
        <div className="mbp-research-ai-panel" style={{ borderColor: `${color}30` }}>
          <div className="mbp-research-ai-header">
            <svg width="12" height="12" viewBox="0 0 16 16" fill={color} aria-hidden>
              <path d="M8 1a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 8 1Zm0 11a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 8 12ZM1 8a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 1 8Zm11 0a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 12 8ZM3.05 3.05a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 0 1-1.06 1.06L3.05 4.11a.75.75 0 0 1 0-1.06Zm8.84 8.84a.75.75 0 0 1 1.06 0l.001.001a.75.75 0 0 1-1.06 1.06l-.001-.001a.75.75 0 0 1 0-1.06Zm.001-8.84a.75.75 0 0 1 0 1.06l-1.06 1.06a.75.75 0 0 1-1.06-1.06l1.06-1.06a.75.75 0 0 1 1.06 0ZM4.11 11.89a.75.75 0 0 1 0 1.06l-1.06 1.06a.75.75 0 0 1-1.06-1.06l1.06-1.06a.75.75 0 0 1 1.06 0ZM8 5.5A2.5 2.5 0 1 0 8 10.5 2.5 2.5 0 0 0 8 5.5Z" />
            </svg>
            <span style={{ color }}>AI Research Summary</span>
            {streaming && <span className="mbp-research-cursor" style={{ background: color }} />}
          </div>
          <div className="mbp-research-ai-body">
            {displayed.split("\n\n").map((para, i) => (
              <p key={i} className="mbp-research-ai-para">{para}</p>
            ))}
            {streaming && <span className="mbp-research-type-cursor">▋</span>}
          </div>
        </div>
      )}
    </div>
  );
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

/** Sync annotated photo height: full copy column on desktop, header+intro on tablet. */
function useMatchFaceCardHeight(
  headerRef: RefObject<HTMLElement | null>,
  introRef: RefObject<HTMLElement | null>,
  factsRef: RefObject<HTMLElement | null>,
  faceInnerRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const mqTablet = window.matchMedia("(min-width: 861px)");
    const mqDesktop = window.matchMedia("(min-width: 1101px)");

    const sync = () => {
      const face = faceInnerRef.current;
      if (!face) return;

      if (!mqTablet.matches) {
        face.style.maxHeight = "";
        face.style.height = "";
        return;
      }

      const intro = introRef.current;
      if (!intro) return;

      let targetH: number;

      if (mqDesktop.matches) {
        const header = headerRef.current;
        const facts = factsRef.current;
        if (!header || !facts) return;

        const grid = header.closest(".mbp-treatment");
        const gap = grid
          ? Number.parseFloat(window.getComputedStyle(grid).rowGap || "0") || 0
          : 0;
        targetH =
          header.offsetHeight
          + intro.offsetHeight
          + facts.offsetHeight
          + gap * 2;
      } else {
        const header = headerRef.current;
        if (!header) return;

        const grid = header.closest(".mbp-treatment");
        const gap = grid
          ? Number.parseFloat(window.getComputedStyle(grid).rowGap || "0") || 0
          : 0;
        const stackH = header.offsetHeight + intro.offsetHeight + gap;
        targetH = Math.max(Math.round(stackH * 1.08), stackH + 24);
      }

      face.style.maxHeight = `${targetH}px`;
      face.style.height = `${targetH}px`;
    };

    sync();
    const raf = requestAnimationFrame(sync);

    const ro = new ResizeObserver(sync);
    for (const ref of [headerRef, introRef, factsRef]) {
      if (ref.current) ro.observe(ref.current);
    }

    mqTablet.addEventListener("change", sync);
    mqDesktop.addEventListener("change", sync);
    window.addEventListener("resize", sync);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mqTablet.removeEventListener("change", sync);
      mqDesktop.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
      const face = faceInnerRef.current;
      if (face) {
        face.style.maxHeight = "";
        face.style.height = "";
      }
    };
  }, [headerRef, introRef, factsRef, faceInnerRef]);
}

// ── Face region card ──────────────────────────────────────────────────────

function TreatmentFaceCard({
  treatmentId,
  color,
  dose,
  area,
  faceInnerRef,
}: {
  treatmentId: string;
  color: string;
  dose: string;
  area: string;
  faceInnerRef?: RefObject<HTMLDivElement>;
}) {
  return (
    <div className="mbp-face-hl">
      <div className="mbp-face-hl-inner" ref={faceInnerRef}>
        <AiMirrorCanvas
          imageUrl="/demo-3d/tanya-tan-front.png"
          alt="Tanya M — treatment area"
          highlightedRegionIds={TREATMENT_REGION_IDS[treatmentId] ?? []}
          showAnnotations
          annotationColor={color}
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
  const headerRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const factsRef = useRef<HTMLDivElement>(null);
  const faceInnerRef = useRef<HTMLDivElement>(null);
  useMatchFaceCardHeight(headerRef, introRef, factsRef, faceInnerRef);

  const headerBlock = (
    <div className="mbp-treatment-header" ref={headerRef}>
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
  );

  const introBlock = (
    <div className="mbp-treatment-intro" ref={introRef}>
      <p className="mbp-treatment-section-label" style={{ color: t.color }}>Why for Tanya M</p>
      <ul className="mbp-why-list">
        {t.whyForYou.map((reason) => (
          <li key={reason} className="mbp-why-item">
            <span className="mbp-why-check" style={{ background: `${t.color}20`, color: t.color, border: `1px solid ${t.color}40` }}>✓</span>
            {reason}
          </li>
        ))}
      </ul>
    </div>
  );

  const factsBlock = (
    <div className="mbp-treatment-facts" ref={factsRef}>
      <p className="mbp-treatment-section-label" style={{ color: t.color }}>Quick facts</p>
      <div className="mbp-facts">
        {t.facts.map((f) => (
          <div key={f.label} className="mbp-fact" style={{ borderColor: `${t.color}22` }}>
            <div className="mbp-fact-label">{f.label}</div>
            <div className="mbp-fact-value">{f.value}</div>
          </div>
        ))}
      </div>

      <ResearchInsightCard treatmentId={t.id} color={t.color} />
    </div>
  );

  const faceCol = (
    <div className="mbp-treatment-right">
      <TreatmentFaceCard
        treatmentId={t.id}
        color={t.color}
        dose={t.dose}
        area={t.area}
        faceInnerRef={faceInnerRef}
      />
    </div>
  );

  return (
    <div
      className={`mbp-treatment mbp-treatment--${t.id}${isEven ? "" : " mbp-treatment--flip"}`}
      style={{ background: isEven ? "var(--mbp-bg)" : "linear-gradient(160deg, var(--mbp-bg2) 0%, var(--mbp-bg) 100%)" }}
    >
      {headerBlock}
      {introBlock}
      {faceCol}
      {factsBlock}
      {/* Full-width education row spanning both columns */}
      <div className="mbp-treatment-edu-wrap">
        <TreatmentEduRow t={t} />
      </div>
    </div>
  );
}

function TreatmentSectionScrollCue({
  targetId,
  label,
  color,
}: {
  targetId: string;
  label: string;
  color: string;
}) {
  return (
    <button
      type="button"
      className="mbp-section-scroll-cue"
      style={{ "--mbp-cue-color": color } as React.CSSProperties}
      onClick={() => {
        smoothScrollToSection(targetId);
        history.replaceState(null, "", `#${targetId}`);
      }}
      aria-label={`Scroll to ${label}`}
    >
      <span className="mbp-section-scroll-cue-label">{label}</span>
      <span className="mbp-section-scroll-cue-arrow" aria-hidden="true">
        ↓
      </span>
    </button>
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
        <span className="mbp-book-bar-label">4 treatments</span>
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
            <span className="mbp-header-patient-lead">Treatment plan for </span>
            <strong>Tanya M</strong>
          </span>
        </div>
        <nav className="mbp-header-nav" aria-label="Jump to treatment">
          {TREATMENTS.map((t) => (
            <a key={t.id} href={`#treatment-${t.id}`} className="mbp-header-pill">{t.name}</a>
          ))}
        </nav>
      </header>

      {/* ── Hero — visual first ───────────────────────────────── */}
      <section className="mbp-hero">
        {/* Face viewer dominates */}
        <div className="mbp-hero-right">
          <div className="mbp-hero-face-wrap">
            <AuraFaceView
              className="mbp-hero-face"
              embedded
              turntableOnly
              disableWheelZoom
              initialZoom={1.38}
              initialPanY={-36}
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

          <div className="mbp-hero-left-stack">
            <div className="mbp-hero-copy-col">
              <div className="mbp-hero-intro-head">
                <div className="mbp-hero-title-row">
                  <h1 className="mbp-hero-name">Tanya M</h1>
                </div>

                <p className="mbp-hero-tagline">
                  4 scan-backed treatments
                </p>
              </div>

              <div className="mbp-hero-ctas">
                <a
                  href="#treatment-xeomin"
                  className="mbp-btn mbp-btn--primary mbp-hero-explore-btn mbp-hero-explore-btn--desktop"
                >
                  Explore plan ↓
                </a>
                <button className="mbp-btn mbp-btn--ghost" onClick={openDrawer}>
                  Express interest
                </button>
              </div>
            </div>

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
          </div>
        </div>
      </section>

      {/* ── Plan strip — mobile only ──────────────────────────── */}
      <div className="mbp-plan-strip">
        <div className="mbp-plan-strip-head">
          <h2 className="mbp-plan-strip-title">Your plan</h2>
          <p className="mbp-plan-strip-sub">4 scan-backed treatments for Tanya M</p>
        </div>
        <div className="mbp-plan-strip-list">
          {TREATMENTS.map((t) => (
            <a
              key={t.id}
              href={`#treatment-${t.id}`}
              className="mbp-plan-strip-item"
              style={{ textDecoration: "none" }}
            >
              <span className="mbp-strip-num" style={{ color: t.color }}>{t.number}</span>
              <div className="mbp-strip-copy">
                <div className="mbp-strip-name">{t.name}</div>
                <div className="mbp-strip-area">{planStripDetail(t)}</div>
              </div>
              <span className="mbp-strip-chevron" aria-hidden="true">›</span>
            </a>
          ))}
        </div>
        <div className="mbp-plan-strip-explore">
          <a
            href="#treatment-xeomin"
            className="mbp-plan-strip-explore-btn mbp-hero-explore-btn--mobile"
          >
            Explore treatments
            <span className="mbp-plan-strip-explore-arrow" aria-hidden="true">↓</span>
          </a>
        </div>
      </div>

      {/* ── Treatment sections ───────────────────────────────── */}
      <section className="mbp-treatments">
        {TREATMENTS.map((t, i) => (
          <div key={t.id} id={`treatment-${t.id}`}>
            <TreatmentSection t={t} index={i} />
            {t.id === "belotero" && (
              <TreatmentSectionScrollCue
                targetId="treatment-ultherapy"
                label="Ultherapy Prime"
                color={TREATMENTS[3].color}
              />
            )}
            {t.id === "ultherapy" && (
              <TreatmentSectionScrollCue
                targetId="investment"
                label="Your investment"
                color="var(--mbp-gold)"
              />
            )}
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
