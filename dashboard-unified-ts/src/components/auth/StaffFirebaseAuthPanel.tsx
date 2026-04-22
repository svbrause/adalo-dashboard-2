import { useState, FormEvent } from "react";
import {
  allowFirebaseSelfSignUp,
  firebaseStaffLoginOpensDashboard,
} from "../../firebase/config";
import { useFirebaseAuth } from "../../context/FirebaseAuthContext";
import "./StaffFirebaseAuthPanel.css";

export type StaffFirebaseAuthPanelProps = {
  /** Parent is loading provider from Firebase `practiceIds` (same path as provider-code login). */
  openingDashboard?: boolean;
  /** Multi-practice user must pick a practice in the parent modal. */
  awaitingPracticeChoice?: boolean;
  /** Token had no `practiceIds`; user can still use provider code above. */
  noPracticeAssignment?: boolean;
  /** Parent finished reading claims (avoids flashing wrong hints while checking). */
  dashboardClaimCheckDone?: boolean;
};

/**
 * Optional email/password UI for Firebase Auth. When `VITE_FIREBASE_STAFF_LOGIN_TO_DASHBOARD`
 * is set, sign-in can open the main dashboard from `practiceIds` claims (parallel to provider code).
 */
export default function StaffFirebaseAuthPanel({
  openingDashboard = false,
  awaitingPracticeChoice = false,
  noPracticeAssignment = false,
  dashboardClaimCheckDone = false,
}: StaffFirebaseAuthPanelProps) {
  const {
    user,
    loading,
    signInWithEmailPassword,
    createUserWithEmailPassword,
    signOutFirebase,
  } = useFirebaseAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const allowSignUp = allowFirebaseSelfSignUp();
  const staffDashFromFirebase = firebaseStaffLoginOpensDashboard();

  const resetFeedback = () => {
    setMessage(null);
    setError(null);
  };

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    resetFeedback();
    if (!email.trim() || !password) {
      setError("Enter email and password.");
      return;
    }
    setBusy(true);
    try {
      await signInWithEmailPassword(email, password);
      setMessage("Signed in.");
      setPassword("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    resetFeedback();
    if (!email.trim() || !password) {
      setError("Enter email and password.");
      return;
    }
    setBusy(true);
    try {
      await createUserWithEmailPassword(email, password);
      setMessage("Account created and signed in.");
      setPassword("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create account.");
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    resetFeedback();
    setBusy(true);
    try {
      await signOutFirebase();
      setMessage("Signed out.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign-out failed.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="staff-firebase-auth staff-firebase-auth--loading">
        <p className="staff-firebase-auth__note">Loading account session…</p>
      </div>
    );
  }

  if (user) {
    return (
      <div className="staff-firebase-auth">
        <h3 className="staff-firebase-auth__title">Staff account</h3>
        <p className="staff-firebase-auth__signed-in">
          Signed in as <strong>{user.email ?? user.uid}</strong>
        </p>
        {openingDashboard && (
          <p className="staff-firebase-auth__hint staff-firebase-auth__hint--emphasis">
            Opening your dashboard…
          </p>
        )}
        {!openingDashboard && awaitingPracticeChoice && staffDashFromFirebase && (
          <p className="staff-firebase-auth__hint">
            Choose which practice to open in the dialog above.
          </p>
        )}
        {!openingDashboard &&
          !awaitingPracticeChoice &&
          noPracticeAssignment &&
          staffDashFromFirebase &&
          dashboardClaimCheckDone && (
            <p className="staff-firebase-auth__hint">
              No practice is linked to this account yet. An admin must attach your allowed
              practices in <strong>Users and Roles</strong> (stored as{" "}
              <code className="staff-firebase-auth__code">practiceIds</code> on your
              login). Or use the provider code above; then sign out and back in after an
              admin updates your account.
            </p>
          )}
        {!staffDashFromFirebase && (
          <p className="staff-firebase-auth__hint">
            Provider dashboard access uses the provider code above. Per-user roles and admin
            tools can use this sign-in when enabled.
          </p>
        )}
        <button
          type="button"
          className="btn-secondary staff-firebase-auth__btn"
          onClick={handleSignOut}
          disabled={busy}
        >
          Sign out of staff account
        </button>
        {message && (
          <p className="staff-firebase-auth__success" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="staff-firebase-auth__error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="staff-firebase-auth">
      <h3 className="staff-firebase-auth__title">Staff account</h3>
      <p className="staff-firebase-auth__note">
        {staffDashFromFirebase ? (
          <>
            Sign in with the email and password tied to your staff account. If your profile
            has practice assignments, you&apos;ll go straight to that provider&apos;s
            dashboard (same as entering the provider code and clicking Access Dashboard).
          </>
        ) : (
          <>
            Optional email/password for staff. Dashboard access uses the provider code above
            unless staff-to-dashboard is enabled in environment settings.
          </>
        )}
      </p>
      <form className="staff-firebase-auth__form" onSubmit={handleSignIn}>
        <label className="staff-firebase-auth__label" htmlFor="staff-firebase-email">
          Email
        </label>
        <input
          id="staff-firebase-email"
          type="email"
          autoComplete="username"
          className="staff-firebase-auth__input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label className="staff-firebase-auth__label" htmlFor="staff-firebase-password">
          Password
        </label>
        <input
          id="staff-firebase-password"
          type="password"
          autoComplete="current-password"
          className="staff-firebase-auth__input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="staff-firebase-auth__actions">
          <button
            type="submit"
            className="btn-primary staff-firebase-auth__btn"
            disabled={busy}
          >
            Sign in
          </button>
          {allowSignUp && (
            <button
              type="button"
              className="btn-secondary staff-firebase-auth__btn"
              disabled={busy}
              onClick={handleSignUp}
            >
              Create account
            </button>
          )}
          <a
            href="/forgot-password"
            className="staff-firebase-auth__forgot-link"
          >
            Forgot password?
          </a>
        </div>
      </form>
      {message && (
        <p className="staff-firebase-auth__success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="staff-firebase-auth__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
