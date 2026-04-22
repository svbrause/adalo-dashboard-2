/**
 * Firebase Web SDK configuration (public `apiKey` is expected in the client bundle).
 *
 * HIPAA / regulated health data — you must complete organizational and technical steps
 * outside this repo, for example:
 * - Execute a Business Associate Agreement (BAA) with Google for eligible Google Cloud /
 *   Firebase services used with PHI, and use only services/operating modes covered by that agreement.
 * - Follow Google’s HIPAA implementation guidance for Firebase/Google Cloud (networking, access
 *   controls, audit logs, minimum necessary, etc.).
 * - Do not initialize Google Analytics / measurement for flows that touch PHI unless your
 *   compliance review explicitly allows it; this app does not enable Analytics from the
 *   Firebase config below.
 *
 * @see https://firebase.google.com/support/privacy
 */

import type { FirebaseOptions } from "firebase/app";

function trimEnv(key: keyof ImportMetaEnv): string | undefined {
  const v = import.meta.env[key];
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

/** Returns Firebase options when all required `VITE_FIREBASE_*` vars are set; otherwise null. */
export function getFirebaseConfig(): FirebaseOptions | null {
  const apiKey = trimEnv("VITE_FIREBASE_API_KEY");
  const authDomain = trimEnv("VITE_FIREBASE_AUTH_DOMAIN");
  const projectId = trimEnv("VITE_FIREBASE_PROJECT_ID");
  const storageBucket = trimEnv("VITE_FIREBASE_STORAGE_BUCKET");
  const messagingSenderId = trimEnv("VITE_FIREBASE_MESSAGING_SENDER_ID");
  const appId = trimEnv("VITE_FIREBASE_APP_ID");
  if (
    !apiKey ||
    !authDomain ||
    !projectId ||
    !storageBucket ||
    !messagingSenderId ||
    !appId
  ) {
    return null;
  }
  const measurementId = trimEnv("VITE_FIREBASE_MEASUREMENT_ID");
  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
    ...(measurementIdOptional(measurementId)),
  };
}

function measurementIdOptional(
  measurementId: string | undefined,
): Pick<FirebaseOptions, "measurementId"> | undefined {
  if (!measurementId) return undefined;
  return { measurementId };
}

export function isFirebaseConfigured(): boolean {
  return getFirebaseConfig() !== null;
}

/**
 * Master switch for staff email/password on `/` and the Settings “Users and Roles” hub card.
 * Set to `true` when launching that flow. `/admin/firebase` is unaffected so you can still
 * manage users directly by URL before the public login rollout.
 */
export const FIREBASE_STAFF_EMAIL_PASSWORD_LOGIN_UI_ENABLED = true;

/**
 * When true, show email/password UI on the provider login page (Firebase runs in parallel).
 * Requires {@link FIREBASE_STAFF_EMAIL_PASSWORD_LOGIN_UI_ENABLED} and Firebase env config.
 * - Production: set `VITE_FIREBASE_SHOW_STAFF_AUTH` to `"true"` to show, or `"false"` to hide.
 * - Local dev: if the env var is omitted, the UI still shows when `import.meta.env.DEV` is true.
 */
export function showStaffFirebaseAuthUi(): boolean {
  if (!FIREBASE_STAFF_EMAIL_PASSWORD_LOGIN_UI_ENABLED || !isFirebaseConfigured()) {
    return false;
  }
  const v = import.meta.env.VITE_FIREBASE_SHOW_STAFF_AUTH;
  if (v === "false") return false;
  if (v === "true") return true;
  return import.meta.env.DEV;
}

/** When true, show “Create account” on the staff panel (leave off until you have admin-only provisioning or rules). */
export function allowFirebaseSelfSignUp(): boolean {
  return import.meta.env.VITE_FIREBASE_ALLOW_SELF_SIGNUP === "true";
}

/**
 * When true, after staff sign-in on the login page, if the Firebase user has custom claim
 * `practiceIds`, load that Airtable provider and open the main dashboard (no provider code).
 * Set to `true` when you are ready to roll out email/password dashboard access.
 */
export function firebaseStaffLoginOpensDashboard(): boolean {
  return (
    isFirebaseConfigured() &&
    import.meta.env.VITE_FIREBASE_STAFF_LOGIN_TO_DASHBOARD === "true"
  );
}
