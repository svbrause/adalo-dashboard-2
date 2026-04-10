/**
 * Realistic Facebook + Instagram ad post chrome for previewing
 * ad creatives in context on the concepts page.
 */

import "./SocialPostMock.css";

function MockAvatar({ size = 36 }: { size?: number }) {
  return (
    <div
      className="sm-avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.44) }}
      aria-hidden
    >
      P
    </div>
  );
}

// ─── Facebook ──────────────────────────────────────────────────────────────

type FbProps = {
  children: React.ReactNode;
  primaryText?: string;
  linkTitle?: string;
  ctaText?: string;
};

export function FacebookAdMock({
  children,
  primaryText = "Free live webinar for MedSpa owners — Erin shares the exact AI system she used to 2× patient revenue. Limited spots.",
  linkTitle = "How to Double Patient Spend Using AI — Free Live Webinar",
  ctaText = "Learn More",
}: FbProps) {
  return (
    <div className="fb-mock">
      <div className="fb-mock__header">
        <MockAvatar size={40} />
        <div className="fb-mock__meta">
          <div className="fb-mock__name">Ponce AI</div>
          <div className="fb-mock__sponsored">
            Sponsored&nbsp;·&nbsp;<span className="fb-mock__globe">🌐</span>
          </div>
        </div>
        <button className="fb-mock__more" aria-label="More options">···</button>
      </div>

      <p className="fb-mock__primary-text">{primaryText}</p>

      <div className="fb-mock__media">{children}</div>

      <div className="fb-mock__link-row">
        <div className="fb-mock__link-info">
          <span className="fb-mock__link-domain">PONCE.AI</span>
          <span className="fb-mock__link-title">{linkTitle}</span>
        </div>
        <button className="fb-mock__cta">{ctaText}</button>
      </div>

      <div className="fb-mock__engage">
        <div className="fb-mock__react-summary">
          <span className="fb-mock__react-icons">👍 ❤️</span>
          <span className="fb-mock__react-count">148 · 23 comments · 12 shares</span>
        </div>
        <div className="fb-mock__divider" />
        <div className="fb-mock__action-row">
          <button className="fb-mock__action">👍 Like</button>
          <button className="fb-mock__action">💬 Comment</button>
          <button className="fb-mock__action">↗ Share</button>
        </div>
      </div>
    </div>
  );
}

// ─── Instagram ─────────────────────────────────────────────────────────────

type IgProps = {
  children: React.ReactNode;
  caption?: string;
  ctaText?: string;
  format?: "square" | "portrait";
};

export function InstagramAdMock({
  children,
  caption = "Free live training for MedSpa owners. Erin shares her full AI system. Link in bio. ✨ #medspa #aestheticbusiness #medspagrowth",
  ctaText = "Register Now",
  format = "square",
}: IgProps) {
  return (
    <div className="ig-mock">
      <div className="ig-mock__header">
        <div className="ig-mock__avatar-ring">
          <MockAvatar size={32} />
        </div>
        <div className="ig-mock__meta">
          <span className="ig-mock__username">ponce.ai</span>
          <span className="ig-mock__sponsored">Sponsored</span>
        </div>
        <button className="ig-mock__more" aria-label="More">···</button>
      </div>

      <div className={`ig-mock__media${format === "portrait" ? " ig-mock__media--portrait" : ""}`}>
        {children}
      </div>

      <div className="ig-mock__cta-strip">
        <div className="ig-mock__cta-info">
          <span className="ig-mock__cta-domain">ponce.ai</span>
          <span className="ig-mock__cta-label">Free webinar for MedSpa owners</span>
        </div>
        <button className="ig-mock__cta-btn">{ctaText}</button>
      </div>

      <div className="ig-mock__actions">
        <div className="ig-mock__left-actions">
          <button aria-label="Like" className="ig-mock__icon-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </button>
          <button aria-label="Comment" className="ig-mock__icon-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </button>
          <button aria-label="Share" className="ig-mock__icon-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
        <button aria-label="Save" className="ig-mock__icon-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><polygon points="19 21 12 16 5 21 5 3 19 3 19 21"/></svg>
        </button>
      </div>

      <div className="ig-mock__below">
        <p className="ig-mock__likes">1,247 likes</p>
        <p className="ig-mock__caption"><strong>ponce.ai</strong> {caption}</p>
        <p className="ig-mock__view-comments">View all 47 comments</p>
        <p className="ig-mock__timestamp">2 HOURS AGO</p>
      </div>
    </div>
  );
}

// ─── Instagram Story ────────────────────────────────────────────────────────

type StoryProps = {
  children: React.ReactNode;
  progress?: number;
};

export function InstagramStoryMock({ children, progress = 62 }: StoryProps) {
  return (
    <div className="ig-story-mock">
      <div className="ig-story-mock__content">{children}</div>

      <div className="ig-story-mock__top">
        <div className="ig-story-mock__progress-row">
          <div className="ig-story-mock__seg ig-story-mock__seg--done" />
          <div className="ig-story-mock__seg">
            <div className="ig-story-mock__seg-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="ig-story-mock__seg" />
        </div>
        <div className="ig-story-mock__user-row">
          <div className="ig-story-mock__user-info">
            <MockAvatar size={28} />
            <span className="ig-story-mock__username">ponce.ai</span>
            <span className="ig-story-mock__dot">·</span>
            <span className="ig-story-mock__sponsored">Sponsored</span>
          </div>
          <div className="ig-story-mock__right-controls">
            <button aria-label="Mute" className="ig-story-mock__ctrl">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="2" aria-hidden><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
            </button>
            <button aria-label="Close" className="ig-story-mock__ctrl">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="2" aria-hidden><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      </div>

      <div className="ig-story-mock__bottom">
        <div className="ig-story-mock__swipe-cta">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="white" aria-hidden><polyline points="18 15 12 9 6 15"/></svg>
          <span>Learn More</span>
        </div>
        <div className="ig-story-mock__reply-row">
          <div className="ig-story-mock__reply-input">Reply to ponce.ai…</div>
          <button aria-label="Send" className="ig-story-mock__send-btn">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" strokeWidth="2" aria-hidden><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
