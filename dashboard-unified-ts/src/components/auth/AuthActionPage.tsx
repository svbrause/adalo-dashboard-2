import { useEffect, useMemo, useState, FormEvent } from "react";
import {
  applyActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from "firebase/auth";
import { getFirebaseAuth } from "../../firebase/client";
import { isFirebaseConfigured } from "../../firebase/config";
import "./ProviderLoginScreen.css";
import "./StaffForgotPasswordPage.css";

import bannerImage from "../../assets/images/c7b64b22c326934b039cd1c199e0440201e31414fc13b0918fe293b61feb63dc.jpg";

const PONCE_LOGO = "/branding/ponce-logo.png";

type AuthActionMode =
  | "resetPassword"
  | "verifyEmail"
  | "recoverEmail"
  | "revertSecondFactorAddition"
  | "signIn"
  | null;

function parseMode(raw: string | null): AuthActionMode {
  if (!raw) return null;
  switch (raw) {
    case "resetPassword":
    case "verifyEmail":
    case "recoverEmail":
    case "revertSecondFactorAddition":
    case "signIn":
      return raw;
    default:
      return null;
  }
}

/** Dedupe concurrent applyActionCode for the same oob (e.g. React Strict Mode). */
const applyActionCodeInflight = new Map<
  string,
  Promise<void>
>();

function friendlyAuthError(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) {
    const code = String((err as { code?: string }).code ?? "");
    if (code === "auth/expired-action-code")
      return "This link has expired. Request a new email from the sign-in page.";
    if (code === "auth/invalid-action-code")
      return "This link is invalid or was already used.";
    if (code === "auth/user-disabled")
      return "This account has been disabled. Contact support.";
    if (code === "auth/weak-password")
      return "Password is too weak. Use at least 6 characters.";
  }
  return err instanceof Error ? err.message : "Something went wrong.";
}

/**
 * Custom handler for Firebase Auth email links (password reset, verify email, etc.).
 * Configure Firebase Console → Authentication → Templates → Action URL to:
 * `https://<your-dashboard-host>/auth/action`
 *
 * @see https://firebase.google.com/docs/auth/custom-email-handler
 */
export default function AuthActionPage() {
  const params = useMemo(
    () => new URLSearchParams(window.location.search),
    [],
  );
  const mode = parseMode(params.get("mode"));
  const oobCode = params.get("oobCode");
  const urlApiKey = params.get("apiKey");
  const continueUrl = params.get("continueUrl");

  const configured = isFirebaseConfigured();
  const configApiKey = import.meta.env.VITE_FIREBASE_API_KEY as
    | string
    | undefined;
  const apiKeyMismatch =
    configured &&
    urlApiKey &&
    configApiKey &&
    urlApiKey !== configApiKey;

  const auth = getFirebaseAuth();

  const [resetEmail, setResetEmail] = useState<string | null>(null);
  const [resetChecking, setResetChecking] = useState(
    mode === "resetPassword" && Boolean(oobCode),
  );
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [autoBusy, setAutoBusy] = useState(
    mode === "verifyEmail" ||
      mode === "recoverEmail" ||
      mode === "revertSecondFactorAddition",
  );

  useEffect(() => {
    if (!auth || mode !== "resetPassword" || !oobCode) return;
    let cancelled = false;
    (async () => {
      setResetChecking(true);
      setError(null);
      try {
        const email = await verifyPasswordResetCode(auth, oobCode);
        if (!cancelled) setResetEmail(email);
      } catch (err) {
        if (!cancelled) setError(friendlyAuthError(err));
      } finally {
        if (!cancelled) setResetChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth, mode, oobCode]);

  useEffect(() => {
    if (
      !auth ||
      !oobCode ||
      !(
        mode === "verifyEmail" ||
        mode === "recoverEmail" ||
        mode === "revertSecondFactorAddition"
      )
    ) {
      return;
    }

    const storageKey = `firebase-auth-action-apply:${oobCode}`;
    if (sessionStorage.getItem(storageKey) === "ok") {
      setAutoBusy(false);
      if (mode === "verifyEmail") {
        setSuccess(
          "Your email address is verified. You can close this tab and sign in.",
        );
      } else if (mode === "recoverEmail") {
        setSuccess(
          "Your sign-in email was restored. You can close this tab and sign in.",
        );
      } else if (mode === "revertSecondFactorAddition") {
        setSuccess("The change was applied. You can close this tab.");
      } else {
        setSuccess("Done. You can close this tab.");
      }
      return;
    }

    let inflight = applyActionCodeInflight.get(oobCode);
    if (!inflight) {
      inflight = (async () => {
        await applyActionCode(auth, oobCode);
        sessionStorage.setItem(storageKey, "ok");
      })().finally(() => {
        applyActionCodeInflight.delete(oobCode);
      });
      applyActionCodeInflight.set(oobCode, inflight);
    }

    void (async () => {
      setAutoBusy(true);
      setError(null);
      try {
        await inflight;
        if (mode === "verifyEmail") {
          setSuccess(
            "Your email address is verified. You can close this tab and sign in.",
          );
        } else if (mode === "recoverEmail") {
          setSuccess(
            "Your sign-in email was restored. You can close this tab and sign in.",
          );
        } else if (mode === "revertSecondFactorAddition") {
          setSuccess("The change was applied. You can close this tab.");
        } else {
          setSuccess("Done. You can close this tab.");
        }
      } catch (err) {
        sessionStorage.removeItem(storageKey);
        setError(friendlyAuthError(err));
      } finally {
        setAutoBusy(false);
      }
    })();
  }, [auth, oobCode, mode]);

  const handleResetSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!auth || !oobCode) return;
    if (password.length < 6) {
      setError("Use at least 6 characters.");
      return;
    }
    if (password !== password2) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setSuccess("Your password was updated. You can sign in with your new password.");
      setPassword("");
      setPassword2("");
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const homeHref = continueUrl && /^https?:\/\//i.test(continueUrl)
    ? continueUrl
    : "/";

  const title =
    mode === "resetPassword"
      ? "Reset your password"
      : mode === "verifyEmail"
        ? "Verify email"
        : mode === "recoverEmail"
          ? "Restore email"
          : mode === "revertSecondFactorAddition"
            ? "Confirm account change"
            : mode === "signIn"
              ? "Email action"
              : "Account action";

  const subtitle =
    mode === "resetPassword"
      ? resetEmail
        ? `Choose a new password for ${resetEmail}.`
        : "Choose a new password for your Ponce AI account."
      : mode === "verifyEmail"
        ? "Just a moment — confirming your email address."
        : mode === "recoverEmail"
          ? "Restoring your previous sign-in email…"
          : mode === "revertSecondFactorAddition"
            ? "Applying your security change…"
            : mode === "signIn"
              ? "This sign-in link type is not handled on this page. Use the link from your device or contact support."
              : "This link is missing required parameters.";

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
              {mode === "resetPassword" && (
                <div className="staff-forgot-password__brand-mark" aria-hidden>
                  <img
                    src={PONCE_LOGO}
                    alt=""
                    className="staff-forgot-password__brand-logo"
                  />
                </div>
              )}
              <div className="welcome-title">
                <span className="welcome-text">{title}</span>
              </div>
              <p className="welcome-subtitle staff-forgot-password__lead">
                {subtitle}
              </p>
            </div>

            {!configured || !auth ? (
              <p className="staff-forgot-password__warn">
                Firebase is not configured in this build.{" "}
                <a href="/">Return to login</a>
              </p>
            ) : apiKeyMismatch ? (
              <p className="staff-forgot-password__warn" role="alert">
                This link is for a different Firebase project than this app is
                configured for. Open the link from an environment that matches
                your project, or ask an admin to fix{" "}
                <code className="text-sm">VITE_FIREBASE_*</code> settings.
              </p>
            ) : !mode || !oobCode ? (
              <p className="staff-forgot-password__warn" role="alert">
                Invalid or incomplete link. Request a new email from the app, or{" "}
                <a href="/">return to login</a>.
              </p>
            ) : mode === "signIn" ? (
              <p className="staff-forgot-password__warn">
                <a href="/">← Back to dashboard login</a>
              </p>
            ) : success ? (
              <>
                <p className="staff-forgot-password__success" role="status">
                  {success}
                </p>
                <p className="staff-forgot-password__back">
                  <a href={homeHref}>
                    {continueUrl ? "Continue →" : "← Back to dashboard login"}
                  </a>
                </p>
              </>
            ) : mode === "resetPassword" ? (
              resetChecking ? (
                <p className="staff-forgot-password__loading">Checking link…</p>
              ) : error && !resetEmail ? (
                <p className="staff-forgot-password__warn" role="alert">
                  {error}{" "}
                  <a href="/forgot-password">Request a new reset link</a> or{" "}
                  <a href="/">return to login</a>.
                </p>
              ) : (
                <form
                  className="staff-forgot-password__form"
                  onSubmit={handleResetSubmit}
                >
                  <div className="form-group">
                    <label htmlFor="auth-action-password">New password</label>
                    <input
                      id="auth-action-password"
                      type="password"
                      autoComplete="new-password"
                      className="password-input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={6}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="auth-action-password2">
                      Confirm password
                    </label>
                    <input
                      id="auth-action-password2"
                      type="password"
                      autoComplete="new-password"
                      className="password-input"
                      value={password2}
                      onChange={(e) => setPassword2(e.target.value)}
                      minLength={6}
                      required
                    />
                  </div>
                  {error && (
                    <div className="error-message display-block" role="alert">
                      {error}
                    </div>
                  )}
                  <button
                    type="submit"
                    className="btn-primary btn-login"
                    disabled={busy}
                  >
                    {busy ? "Saving…" : "Update password"}
                  </button>
                </form>
              )
            ) : (
              <>
                {autoBusy && (
                  <p className="staff-forgot-password__loading">Working…</p>
                )}
                {error && (
                  <p className="staff-forgot-password__warn" role="alert">
                    {error}{" "}
                    <a href="/">Return to login</a>
                  </p>
                )}
              </>
            )}

            {!success &&
              configured &&
              auth &&
              mode &&
              mode !== "signIn" &&
              oobCode &&
              !apiKeyMismatch &&
              (mode === "resetPassword" ? !resetChecking && resetEmail : true) && (
              <p className="staff-forgot-password__back">
                <a href="/">← Back to dashboard login</a>
              </p>
            )}

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
