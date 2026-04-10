/**
 * Internal marketing brainstorm: Meta ad visuals + copy ideas for providers.
 * Not linked from the app — open /internal/provider-ad-concepts
 */

import {
  WebinarAd1080Portrait,
  WebinarAd1080Square,
  WebinarAd1080Story,
  WebinarCarouselPreview,
} from "./metaAdGraphics/WebinarPromoFrames";
import {
  WebinarAdPhotoPortrait,
  WebinarAdPhotoSquare,
  WebinarAdPhotoStory,
  type SpeakerKey,
} from "./metaAdGraphics/WebinarAdPhotoFrames";
import {
  FacebookAdMock,
  InstagramAdMock,
  InstagramStoryMock,
} from "./metaAdGraphics/SocialPostMock";
import "./ProviderAdConceptsPage.css";

const SPEAKER_COPY: Record<SpeakerKey, { caption: string; ctaText: string }> = {
  erin: {
    caption: `Erin Jensen, PA-C runs The Treatment Skin Boutique in LA — she's going live to share how she used AI to 2× patient revenue. Free. Tuesday 7PM ET. Spots are limited. #medspa #aestheticbusiness`,
    ctaText: "Save My Seat",
  },
  reddy: {
    caption: `Dr. Reddy, founder of Wellnest MD in Atlanta, is sharing the exact AI system he used to grow patient spend. Free live webinar. Tuesday 7PM ET. #medspagrowth #wellnessmd`,
    ctaText: "Register Free",
  },
  tanya: {
    caption: `Dr. Tanya Judge, plastic surgeon and founder of JudgeMD in SF, is going live to share how AI changed her patient communication and revenue. Free. Tuesday 7PM ET. #judgemd #plasticsurgery`,
    ctaText: "Save My Seat",
  },
};

type FeedImageAd = {
  id: string;
  format: "1:1" | "4:5";
  gradient: string;
  headline: string;
  subline: string;
  visualBrief: string;
};

type StoryVideoAd = {
  id: string;
  title: string;
  gradient: string;
  hook: string;
  beats: string[];
};

const FEED_IMAGE_ADS: FeedImageAd[] = [
  {
    id: "1",
    format: "4:5",
    gradient: "linear-gradient(165deg, #0f766e 0%, #134e4a 45%, #0c4a6e 100%)",
    headline: "Your treatment plan, finally in one place.",
    subline: "Recommendations, checkout, and follow-up—without the spreadsheet chaos.",
    visualBrief:
      "Hero: clean tablet or laptop on a bright treatment room counter; soft depth-of-field on a provider's hands. UI hint: a polished plan or client timeline (blur OK). Mood: calm, premium, modern med spa.",
  },
  {
    id: "2",
    format: "1:1",
    gradient: "linear-gradient(145deg, #1e1b4b 0%, #4c1d95 50%, #831843 100%)",
    headline: "Turn consults into clear next steps.",
    subline: "Patients leave knowing what to book—and you stay organized.",
    visualBrief:
      `Split visual: left "before" sticky notes / messy notes app, right a single elegant dashboard card stack. High contrast, aspirational—not cluttered.`,
  },
  {
    id: "3",
    format: "4:5",
    gradient: "linear-gradient(180deg, #fef3c7 0%, #fcd34d 35%, #ea580c 100%)",
    headline: "Stop re-explaining the plan.",
    subline: "Share a link patients actually open. SMS that matches your voice.",
    visualBrief:
      `Phone mockup showing a shareable plan or SMS thread; warm sunrise palette suggests "new day" for the practice. Include a subtle notification or link icon.`,
  },
  {
    id: "4",
    format: "1:1",
    gradient: "linear-gradient(135deg, #ecfdf5 0%, #99f6e4 40%, #0d9488 100%)",
    headline: "Built for injectors & aesthetic teams.",
    subline: "Less admin. More chair time. Fewer dropped opportunities.",
    visualBrief:
      `Team shot: diverse providers in scrubs smiling (stock-appropriate). Overlay a simple stat callout like "Fewer no-shows" or "Faster follow-up" in a pill shape.`,
  },
  {
    id: "5",
    format: "4:5",
    gradient: "linear-gradient(160deg, #18181b 0%, #3f3f46 100%)",
    headline: "The modern practice runs on clarity.",
    subline: "One dashboard: clients, plans, pricing, and communication.",
    visualBrief:
      `Minimal dark UI chrome with one glowing accent line (teal or gold). Typography-forward—almost Apple-keynote clean. Feels "software you'd be proud to show investors."`,
  },
  {
    id: "6",
    format: "1:1",
    gradient: "linear-gradient(135deg, #fdf4ff 0%, #e879f9 45%, #7c3aed 100%)",
    headline: `From "maybe later" to booked.`,
    subline: "Make the recommended path obvious—before they walk out.",
    visualBrief:
      `Before/after energy: left hesitant emoji or "later" sticky note (tasteful), right calendar block or checkmark. Keep it premium—no clip-art.`,
  },
];

const STORY_VIDEO_ADS: StoryVideoAd[] = [
  {
    id: "v1",
    title: `9:16 — "Day in the life" (15–30s)`,
    gradient: "linear-gradient(180deg, #0c4a6e 0%, #0f766e 100%)",
    hook: "POV: you're behind on notes and three patients text at once.",
    beats: [
      "0–2s: Quick cuts—phone buzzes, desk clutter, sigh (relatable).",
      "3–8s: Transition to calm: one screen, organized client, clear next step.",
      `9–12s: Show share/SMS moment—patient nodding or "booked" animation.`,
      `13–15s: Logo + CTA: "See the dashboard" / "Book a demo".`,
      "On-screen text: short phrases only; captions always on.",
    ],
  },
  {
    id: "v2",
    title: `9:16 — "The invisible revenue leak" (20s)`,
    gradient: "linear-gradient(180deg, #1c1917 0%, #44403c 100%)",
    hook: `Every "I'll think about it" without a follow-up plan costs you.`,
    beats: [
      `0–3s: Bold text: "Where did that patient go?"`,
      "4–10s: Simple diagram: consult → plan → SMS → booking (animated arrows).",
      "11–17s: Product glimpse—treatment plan or client detail (blur sensitive data).",
      `18–20s: CTA + benefit line: "Turn recommendations into revenue."`,
    ],
  },
  {
    id: "v3",
    title: `9:16 — "Provider testimonial style" (30s)`,
    gradient: "linear-gradient(180deg, #fefce8 0%, #fde68a 50%, #f59e0b 100%)",
    hook: `Face to camera (or voiceover): "We used to lose track of treatment plans…"`,
    beats: [
      "Film in real office; natural light; lav mic.",
      "B-roll: dashboard scrolling, sending a link, patient phone receiving SMS.",
      `End card: practice name + "Ask us how we use [product name]" if you have a partner site.`,
    ],
  },
];

function AdVisualCard({ ad }: { ad: FeedImageAd }) {
  return (
    <article className="ad-visual-card">
      <div
        className={
          ad.format === "4:5"
            ? "ad-visual-card__frame ad-visual-card__frame--portrait"
            : "ad-visual-card__frame"
        }
        style={{ background: ad.gradient }}
      >
        <span className="ad-visual-card__badge">Feed · {ad.format}</span>
        <div className="ad-visual-card__overlay">{ad.headline}</div>
        <div className="ad-visual-card__sub">{ad.subline}</div>
      </div>
      <div className="ad-visual-card__body">
        <div className="ad-visual-card__label">Visual brief (for design / shoot)</div>
        <p className="ad-visual-card__brief">{ad.visualBrief}</p>
      </div>
    </article>
  );
}

function AdVideoCard({ ad }: { ad: StoryVideoAd }) {
  return (
    <article className="ad-video-card">
      <div className="ad-video-card__frame" style={{ background: ad.gradient }}>
        <span className="ad-visual-card__badge" style={{ top: 8, left: 8 }}>
          Reels / Stories · 9:16
        </span>
        <div className="ad-video-card__play" aria-hidden>
          ▶
        </div>
      </div>
      <div className="ad-video-card__body">
        <div className="ad-video-card__title">{ad.title}</div>
        <p
          style={{
            fontSize: "var(--font-sm)",
            margin: "0 0 8px",
            color: "var(--theme-text-muted)",
          }}
        >
          <strong style={{ color: "var(--theme-text-secondary)" }}>Hook: </strong>
          {ad.hook}
        </p>
        <ul className="ad-video-card__beats">
          {ad.beats.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}

export default function ProviderAdConceptsPage() {
  return (
    <div className="provider-ad-concepts">
      <header className="provider-ad-concepts__header">
        <h1>Provider acquisition — Meta ad concepts</h1>
        <p>
          Internal brainstorm: SVG mocks aligned with <code>metaAdIdeas.md</code> (webinar
          experiment), plus generic product angles. Ads are shown in realistic Instagram &amp;
          Facebook post chrome so you can see them in context. Not linked in the app; open at{" "}
          <code>/internal/provider-ad-concepts</code>.
        </p>
      </header>

      <main className="provider-ad-concepts__main">
        <section className="provider-ad-concepts__section" aria-labelledby="sec-webinar">
          <h2 id="sec-webinar" className="provider-ad-concepts__section-title">
            Webinar experiment — ad frames in social context
          </h2>
          <p className="provider-ad-concepts__section-lede">
            Vector graphics built in code — bold, minimal, scroll-stopping. ViewBox sizes match Meta
            exports: 1080×1080, 1080×1350, 1080×1920. Each frame is shown inside a realistic
            Instagram or Facebook post mock. Replace the "E" headshot placeholder with Erin's photo
            in Figma/Canva before exporting.
          </p>

          <div className="provider-ad-concepts__webinar-grid">
            <div className="provider-ad-concepts__webinar-item">
              <h3 className="provider-ad-concepts__webinar-label">
                Feed 1:1 — warm / retargeting · Instagram
              </h3>
              <InstagramAdMock format="square" ctaText="Save My Seat">
                <WebinarAd1080Square variant="default" />
              </InstagramAdMock>
            </div>

            <div className="provider-ad-concepts__webinar-item">
              <h3 className="provider-ad-concepts__webinar-label">
                Feed 1:1 — cold / local hook · Facebook
              </h3>
              <FacebookAdMock
                primaryText="If you own a MedSpa near us, Erin is going live Tuesday to share the AI system she used to double patient revenue. It's free. Spots are limited."
                linkTitle="Local MedSpa owner shares her full AI system — free"
                ctaText="Save My Seat"
              >
                <WebinarAd1080Square variant="cold-local" />
              </FacebookAdMock>
            </div>

            <div className="provider-ad-concepts__webinar-item">
              <h3 className="provider-ad-concepts__webinar-label">
                Feed 4:5 — speaker-forward · Instagram
              </h3>
              <InstagramAdMock format="portrait" ctaText="Register Free">
                <WebinarAd1080Portrait variant="default" />
              </InstagramAdMock>
            </div>

            <div className="provider-ad-concepts__webinar-item">
              <h3 className="provider-ad-concepts__webinar-label">Stories / Reels 9:16 · Instagram</h3>
              <InstagramStoryMock progress={62}>
                <WebinarAd1080Story variant="default" />
              </InstagramStoryMock>
            </div>

            <div className="provider-ad-concepts__webinar-item">
              <h3 className="provider-ad-concepts__webinar-label">Stories — geo variant · Instagram</h3>
              <InstagramStoryMock progress={38}>
                <WebinarAd1080Story variant="cold-local" />
              </InstagramStoryMock>
            </div>
          </div>

          <h3 className="provider-ad-concepts__subsection-title">
            Carousel (optional — 3 takeaways)
          </h3>
          <p
            className="provider-ad-concepts__section-lede"
            style={{ marginBottom: "var(--space-md)" }}
          >
            Three-panel preview for a carousel ad; swap headlines for your exact teaching beats.
          </p>
          <WebinarCarouselPreview />
        </section>

        <section className="provider-ad-concepts__section" aria-labelledby="sec-photo">
          <h2 id="sec-photo" className="provider-ad-concepts__section-title">
            Photo variants — speaker cutouts (A/B vs. no-photo above)
          </h2>
          <p className="provider-ad-concepts__section-lede">
            Same layouts, real speaker photos with transparent backgrounds. Run these head-to-head
            against the text-only versions to see which cost-per-registration wins. Each speaker
            gets their own accent palette so you can geo-target with a matching visual feel.
          </p>

          {/* ── Square 1:1 — all 3 speakers ── */}
          <h3 className="provider-ad-concepts__subsection-title">Feed 1:1 — three speakers</h3>
          <div className="provider-ad-concepts__webinar-grid">
            {(["erin", "reddy", "tanya"] as SpeakerKey[]).map((sp) => (
              <div key={sp} className="provider-ad-concepts__webinar-item">
                <h3 className="provider-ad-concepts__webinar-label" style={{ textTransform: "capitalize" }}>
                  {sp} — Instagram feed
                </h3>
                <InstagramAdMock
                  format="square"
                  caption={SPEAKER_COPY[sp].caption}
                  ctaText={SPEAKER_COPY[sp].ctaText}
                >
                  <WebinarAdPhotoSquare speaker={sp} />
                </InstagramAdMock>
              </div>
            ))}
          </div>

          {/* ── Portrait 4:5 — all 3 speakers ── */}
          <h3 className="provider-ad-concepts__subsection-title" style={{ marginTop: "var(--space-2xl)" }}>Feed 4:5 — three speakers</h3>
          <div className="provider-ad-concepts__webinar-grid">
            {(["erin", "reddy", "tanya"] as SpeakerKey[]).map((sp) => (
              <div key={sp} className="provider-ad-concepts__webinar-item">
                <h3 className="provider-ad-concepts__webinar-label" style={{ textTransform: "capitalize" }}>
                  {sp} — Instagram portrait
                </h3>
                <InstagramAdMock
                  format="portrait"
                  caption={SPEAKER_COPY[sp].caption}
                  ctaText={SPEAKER_COPY[sp].ctaText}
                >
                  <WebinarAdPhotoPortrait speaker={sp} />
                </InstagramAdMock>
              </div>
            ))}
          </div>

          {/* ── Stories 9:16 — all 3 speakers ── */}
          <h3 className="provider-ad-concepts__subsection-title" style={{ marginTop: "var(--space-2xl)" }}>Stories / Reels 9:16 — three speakers</h3>
          <div className="provider-ad-concepts__webinar-grid">
            {(["erin", "reddy", "tanya"] as SpeakerKey[]).map((sp) => (
              <div key={sp} className="provider-ad-concepts__webinar-item">
                <h3 className="provider-ad-concepts__webinar-label" style={{ textTransform: "capitalize" }}>
                  {sp} — Instagram story
                </h3>
                <InstagramStoryMock progress={sp === "erin" ? 55 : sp === "reddy" ? 40 : 70}>
                  <WebinarAdPhotoStory speaker={sp} />
                </InstagramStoryMock>
              </div>
            ))}
          </div>
        </section>

        <section className="provider-ad-concepts__section" aria-labelledby="sec-feed">
          <h2 id="sec-feed" className="provider-ad-concepts__section-title">
            Feed &amp; static image directions
          </h2>
          <p className="provider-ad-concepts__section-lede">
            Gradient panels stand in for photography. Replace with brand photography, UI captures,
            or designer comps. Export 1080×1080 (1:1) and 1080×1350 (4:5) for Facebook/Instagram.
          </p>
          <div className="provider-ad-concepts__grid">
            {FEED_IMAGE_ADS.map((ad) => (
              <AdVisualCard key={ad.id} ad={ad} />
            ))}
          </div>
        </section>

        <section className="provider-ad-concepts__section" aria-labelledby="sec-video">
          <h2 id="sec-video" className="provider-ad-concepts__section-title">
            Video (Reels / Stories) concepts
          </h2>
          <p className="provider-ad-concepts__section-lede">
            Vertical 9:16, 15–30s, native feel beats polished corporate ads. Always burn captions;
            hook in the first 2 seconds.
          </p>
          <div className="provider-ad-concepts__grid provider-ad-concepts__grid--stories">
            {STORY_VIDEO_ADS.map((ad) => (
              <AdVideoCard key={ad.id} ad={ad} />
            ))}
          </div>
        </section>

        <section className="provider-ad-concepts__section" aria-labelledby="sec-copy">
          <h2 id="sec-copy" className="provider-ad-concepts__section-title">
            Copy bank (primary text, headlines, CTAs)
          </h2>
          <p className="provider-ad-concepts__section-lede">
            Mix and match for A/B tests. Adjust the product name to match your go-to-market wording.
          </p>
          <div className="copy-bank">
            <div className="copy-bank__block">
              <h3>Headlines (short)</h3>
              <ul className="copy-bank__list">
                <li>Your consult deserves a better follow-up than a sticky note.</li>
                <li>One place for plans, pricing, and patient communication.</li>
                <li>Less chasing. More bookings.</li>
                <li>Built for busy injectors and aesthetic teams.</li>
                <li>Turn recommendations into the next appointment.</li>
              </ul>
            </div>
            <div className="copy-bank__block">
              <h3>Primary text (longer)</h3>
              <ul className="copy-bank__list">
                <li>
                  Between charting, texts, and follow-ups, the "perfect" treatment plan can still
                  fall through the cracks. See how practices keep recommendations, checkout, and SMS
                  in one workflow—so patients know exactly what to book next.
                </li>
                <li>
                  If your front desk and clinical team are juggling three tools just to close a
                  plan, you're not alone. This dashboard is built for aesthetic workflows: clear next
                  steps for patients, less back-and-forth for your team.
                </li>
              </ul>
            </div>
            <div className="copy-bank__block">
              <h3>Value props (bullets for ads or landing)</h3>
              <ul className="copy-bank__list">
                <li>Shareable treatment plans patients can open on their phone</li>
                <li>SMS and notifications that match how you already communicate</li>
                <li>Fewer dropped plans between consult and booking</li>
                <li>One source of truth for the team—no more mystery pricing in the group chat</li>
              </ul>
            </div>
            <div className="copy-bank__block">
              <h3>CTAs</h3>
              <ul className="copy-bank__list">
                <li>
                  <strong>Learn more</strong>
                  <span>See how it works</span>
                </li>
                <li>
                  <strong>Lead gen</strong>
                  <span>Get the provider overview</span>
                </li>
                <li>
                  <strong>Demo</strong>
                  <span>Book a 15-minute walkthrough</span>
                </li>
                <li>
                  <strong>Social proof</strong>
                  <span>Join practices streamlining the consult-to-booking path</span>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
