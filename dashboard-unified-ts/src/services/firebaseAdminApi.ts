/**
 * Calls backend `/api/admin/firebase/*` with Firebase ID token (see backend `firebaseAdminRoutes.ts`).
 */

import { BACKEND_API_URL } from "./api";

const BASE = BACKEND_API_URL;

export type FirebaseAdminUserRow = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  disabled: boolean;
  creationTime: string;
  lastSignInTime: string | null;
  customClaims: Record<string, unknown>;
};

export type FirebaseAdminListResponse = {
  users: FirebaseAdminUserRow[];
  pageToken: string | null;
};

export async function fetchFirebaseAdminStatus(): Promise<{
  ok: boolean;
  firebaseAdminReady: boolean;
  superadminUidsConfigured: boolean;
}> {
  const res = await fetch(`${BASE}/api/admin/firebase/status`);
  if (!res.ok) {
    throw new Error(`Status ${res.status}`);
  }
  return res.json();
}

function authHeaders(idToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${idToken}`,
    "Content-Type": "application/json",
  };
}

/**
 * Invite a user: backend should create the Firebase account, set claims, generate a
 * password-set link (`generatePasswordResetLink`), and send HTML email from your domain
 * (e.g. Brevo or Resend). See `server-reference/firebase-invite.route.example.ts`.
 */
export type InviteFirebaseUserPayload = {
  email: string;
  displayName?: string;
  initialClaims?: Record<string, unknown>;
  /** Optional note shown inside the invite email (backend template). */
  personalMessage?: string;
  /**
   * Human-readable practice / location names for the invite email (comma-separated).
   * Backend templates can show “You’re invited by …” — omit if empty.
   */
  practiceNamesForEmail?: string;
};

export type InviteFirebaseUserResponse = {
  ok: boolean;
  uid: string;
  email: string;
  emailSent?: boolean;
  /** Human-readable status for toasts. */
  message?: string;
};

export async function inviteFirebaseUser(
  idToken: string,
  payload: InviteFirebaseUserPayload,
): Promise<InviteFirebaseUserResponse> {
  const res = await fetch(`${BASE}/api/admin/firebase/users/invite`, {
    method: "POST",
    headers: authHeaders(idToken),
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof body.error === "string"
        ? body.error
        : body.message || `invite user failed (${res.status})`,
    );
  }
  return body as InviteFirebaseUserResponse;
}

export async function createFirebaseUser(
  idToken: string,
  payload: {
    email: string;
    password: string;
    displayName?: string;
    initialClaims?: Record<string, unknown>;
  },
): Promise<FirebaseAdminUserRow> {
  const res = await fetch(`${BASE}/api/admin/firebase/users`, {
    method: "POST",
    headers: authHeaders(idToken),
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof body.error === "string"
        ? body.error
        : body.message || `createUser failed (${res.status})`,
    );
  }
  return body as FirebaseAdminUserRow;
}

export async function listFirebaseUsers(
  idToken: string,
  options?: { maxResults?: number; pageToken?: string | null },
): Promise<FirebaseAdminListResponse> {
  const u = new URL(`${BASE}/api/admin/firebase/users`);
  if (options?.maxResults)
    u.searchParams.set("maxResults", String(options.maxResults));
  if (options?.pageToken)
    u.searchParams.set("pageToken", options.pageToken);
  const res = await fetch(u.toString(), { headers: authHeaders(idToken) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof body.error === "string"
        ? body.error
        : body.message || `listUsers failed (${res.status})`,
    );
  }
  return body as FirebaseAdminListResponse;
}

export async function getFirebaseUser(
  idToken: string,
  uid: string,
): Promise<FirebaseAdminUserRow> {
  const res = await fetch(`${BASE}/api/admin/firebase/users/${encodeURIComponent(uid)}`, {
    headers: authHeaders(idToken),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof body.error === "string"
        ? body.error
        : body.message || `getUser failed (${res.status})`,
    );
  }
  return body as FirebaseAdminUserRow;
}

export async function patchFirebaseUser(
  idToken: string,
  uid: string,
  patch: { disabled?: boolean; displayName?: string | null; email?: string },
): Promise<void> {
  const res = await fetch(`${BASE}/api/admin/firebase/users/${encodeURIComponent(uid)}`, {
    method: "PATCH",
    headers: authHeaders(idToken),
    body: JSON.stringify(patch),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof body.error === "string"
        ? body.error
        : body.message || `updateUser failed (${res.status})`,
    );
  }
}

/**
 * Replaces all custom claims for the user. Merge with existing claims on the caller before invoking.
 */
export async function setFirebaseUserCustomClaims(
  idToken: string,
  uid: string,
  claims: Record<string, unknown>,
): Promise<{ uid: string; customClaims: Record<string, unknown> }> {
  const res = await fetch(
    `${BASE}/api/admin/firebase/users/${encodeURIComponent(uid)}/custom-claims`,
    {
      method: "POST",
      headers: authHeaders(idToken),
      body: JSON.stringify({ claims }),
    },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof body.error === "string"
        ? body.error
        : body.message || `setCustomClaims failed (${res.status})`,
    );
  }
  return {
    uid: body.uid,
    customClaims: body.customClaims ?? {},
  };
}

export async function requestPasswordResetLink(
  idToken: string,
  uid: string,
): Promise<{ link: string; email: string; hint?: string }> {
  const res = await fetch(
    `${BASE}/api/admin/firebase/users/${encodeURIComponent(uid)}/password-reset-link`,
    { method: "POST", headers: authHeaders(idToken) },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof body.error === "string"
        ? body.error
        : body.message || `password-reset-link failed (${res.status})`,
    );
  }
  return {
    link: body.link as string,
    email: body.email as string,
    hint: typeof body.hint === "string" ? body.hint : undefined,
  };
}

/**
 * Backend sends the same branded invite/setup email again (Resend/Brevo).
 * Implement `POST /api/admin/firebase/users/:uid/resend-invite` on the API.
 */
export async function resendFirebaseUserInvite(
  idToken: string,
  uid: string,
  options?: { practiceNamesForEmail?: string },
): Promise<{ ok: boolean; message?: string; emailSent?: boolean }> {
  const res = await fetch(
    `${BASE}/api/admin/firebase/users/${encodeURIComponent(uid)}/resend-invite`,
    {
      method: "POST",
      headers: authHeaders(idToken),
      body: JSON.stringify({
        practiceNamesForEmail: options?.practiceNamesForEmail?.trim() || undefined,
      }),
    },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof body.error === "string"
        ? body.error
        : body.message || `resend-invite failed (${res.status})`,
    );
  }
  return body as { ok: boolean; message?: string; emailSent?: boolean };
}

/**
 * Backend emails a password reset link (same HTML as `/forgot-password` when configured).
 * Implement `POST /api/admin/firebase/users/:uid/send-password-reset-email` on the API.
 */
export async function sendFirebaseUserPasswordResetEmail(
  idToken: string,
  uid: string,
  options?: { practiceNamesForEmail?: string },
): Promise<{ ok: boolean; message?: string; emailSent?: boolean }> {
  const res = await fetch(
    `${BASE}/api/admin/firebase/users/${encodeURIComponent(uid)}/send-password-reset-email`,
    {
      method: "POST",
      headers: authHeaders(idToken),
      body: JSON.stringify({
        practiceNamesForEmail: options?.practiceNamesForEmail?.trim() || undefined,
      }),
    },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof body.error === "string"
        ? body.error
        : body.message || `send-password-reset-email failed (${res.status})`,
    );
  }
  return body as { ok: boolean; message?: string; emailSent?: boolean };
}

export async function requestEmailVerificationLink(
  idToken: string,
  uid: string,
): Promise<{ link: string; email: string; hint?: string }> {
  const res = await fetch(
    `${BASE}/api/admin/firebase/users/${encodeURIComponent(uid)}/email-verification-link`,
    { method: "POST", headers: authHeaders(idToken) },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof body.error === "string"
        ? body.error
        : body.message || `email-verification-link failed (${res.status})`,
    );
  }
  return {
    link: body.link as string,
    email: body.email as string,
    hint: typeof body.hint === "string" ? body.hint : undefined,
  };
}

export async function revokeUserSessions(
  idToken: string,
  uid: string,
): Promise<void> {
  const res = await fetch(
    `${BASE}/api/admin/firebase/users/${encodeURIComponent(uid)}/revoke-sessions`,
    { method: "POST", headers: authHeaders(idToken) },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof body.error === "string"
        ? body.error
        : body.message || `revoke-sessions failed (${res.status})`,
    );
  }
}
