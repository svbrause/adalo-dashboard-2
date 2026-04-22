import { useState, FormEvent } from "react";
import { useFirebaseAuth } from "../../context/FirebaseAuthContext";
import "./ProviderLoginScreen.css";
import "./StaffForgotPasswordPage.css";

import bannerImage from "../../assets/images/c7b64b22c326934b039cd1c199e0440201e31414fc13b0918fe293b61feb63dc.jpg";

const PONCE_LOGO = "/branding/ponce-logo.png";

/**
 * Dedicated screen for Firebase staff password reset (email link).
 * Route: `/forgot-password` — linked from the staff sign-in block on `/`.
 */
export default function StaffForgotPasswordPage() {
  const { sendPasswordReset, loading, isConfigured } = useFirebaseAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }
    setBusy(true);
    try {
      await sendPasswordReset(email);
      setMessage(
        "Check your inbox — if an account exists for that address, we just sent a reset link. It may take a minute, and be sure to check your spam folder.",
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Could not send reset email.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-layout">
        <div className="login-banner">
          <img
            src={bannerImage}
            alt=""
            className="banner-image"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
        <div className="login-content">
          <div className="login-container staff-forgot-password__box">
            <div className="login-header">
              <div className="welcome-title">
                <span className="welcome-text">Forgot your password?</span>
              </div>
              <p className="welcome-subtitle staff-forgot-password__lead">
                Enter your email and we&apos;ll send you a reset link if an account exists
                for that address.
              </p>
            </div>

            {!isConfigured ? (
              <p className="staff-forgot-password__warn">
                Firebase is not configured in this build. Password reset is unavailable.{" "}
                <a href="/">Return to login</a>
              </p>
            ) : loading ? (
              <p className="staff-forgot-password__loading">Loading…</p>
            ) : (
              <form className="staff-forgot-password__form" onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="staff-forgot-email">Email</label>
                  <input
                    id="staff-forgot-email"
                    type="email"
                    autoComplete="email"
                    className="password-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>
                {error && (
                  <div className="error-message display-block" role="alert">
                    {error}
                  </div>
                )}
                {message && (
                  <p className="staff-forgot-password__success" role="status">
                    {message}
                  </p>
                )}
                <button
                  type="submit"
                  className="btn-primary btn-login"
                  disabled={busy}
                >
                  {busy ? "Sending…" : "Send reset link"}
                </button>
              </form>
            )}

            <p className="staff-forgot-password__back">
              <a href="/">← Back to dashboard login</a>
            </p>
            <div className="staff-forgot-password__logo-foot">
              <img
                src={PONCE_LOGO}
                alt="Ponce"
                className="welcome-logo staff-forgot-password__logo-small"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
