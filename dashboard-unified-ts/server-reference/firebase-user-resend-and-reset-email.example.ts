/**
 * Reference routes for the Users and Roles detail panel:
 *
 * - POST /api/admin/firebase/users/:uid/resend-invite
 * - POST /api/admin/firebase/users/:uid/send-password-reset-email
 *
 * Wire into the same Express app as other `/api/admin/firebase/*` routes. Reuse your
 * existing Firebase Admin auth middleware (same as list users / invite).
 *
 * Behavior:
 *
 * **resend-invite**
 * 1. Load the user by uid; require they have an email.
 * 2. `auth.generatePasswordResetLink(email, { url: continueUrl, handleCodeInApp: false })`
 *    — same as initial invite (first-time password set).
 * 3. Send HTML with the same branding as `POST /users/invite` (see
 *    `firebase-invite.route.example.ts` → `buildInviteEmailHtml`). Resolve practice
 *    display names from `customClaims.practiceIds` + your provider directory if needed.
 * 4. Return `{ ok: true, emailSent: true, message: "Invitation email sent." }`.
 *
 * **send-password-reset-email**
 * 1. Load user by uid; require email.
 * 2. `generatePasswordResetLink` with your `APP_PUBLIC_URL` continue URL.
 * 3. Send HTML using `buildPasswordResetEmailHtml` from
 *    `firebase-invite.route.example.ts` (or shared module).
 * 4. Return `{ ok: true, emailSent: true, message: "Password reset email sent." }`.
 *
 * Resend uses the same Resend/Brevo `from` / API key env vars as invite.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Request = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Response = any;

export async function postResendInviteExample(req: Request, res: Response) {
  const { uid } = req.params;
  if (!uid) return res.status(400).json({ error: "uid required" });
  // const idToken = await verifyAdmin(req); ...
  // const auth = getFirebaseAdmin().auth();
  // const user = await auth.getUser(uid);
  // if (!user.email) return res.status(400).json({ error: "User has no email" });
  // const link = await auth.generatePasswordResetLink(user.email, { url: continueUrl, handleCodeInApp: false });
  // await sendResend({ to: user.email, subject: "You're invited — set up your account", html: buildInviteEmailHtml({ ... }) });
  return res.status(501).json({
    error: "Not implemented",
    hint: "Implement resend-invite on your API using the steps in server-reference/firebase-user-resend-and-reset-email.example.ts",
  });
}

export async function postSendPasswordResetEmailExample(req: Request, res: Response) {
  const { uid } = req.params;
  if (!uid) return res.status(400).json({ error: "uid required" });
  return res.status(501).json({
    error: "Not implemented",
    hint: "Implement send-password-reset-email on your API; same as forgot-password email HTML.",
  });
}
