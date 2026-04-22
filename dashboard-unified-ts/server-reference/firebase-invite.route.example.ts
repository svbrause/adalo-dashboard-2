/**
 * Reference implementation for: POST /api/admin/firebase/users/invite
 * (and the same HTML patterns for POST /api/auth/forgot-password when using
 * VITE_PASSWORD_RESET_VIA_BACKEND=true).
 *
 * Wire this into your Express API (same server that serves other
 * /api/admin/firebase/* routes). Adjust imports, auth middleware, and env names
 * to match your project.
 *
 * Flow:
 * 1. Verify the caller is a Firebase-authenticated dashboard admin (reuse your
 *    existing middleware for other admin routes).
 * 2. Create the user with a random temporary password (user will never know it).
 * 3. Set custom claims from `initialClaims` (same shape as create-user).
 * 4. Call `auth.generatePasswordResetLink` — this link lets them choose a password
 *    on first use (same mechanism as forgot-password).
 * 5. Send HTML email via your provider (Resend, SendGrid, SES) from a verified
 *    domain so mail is on-brand and not from noreply@firebase...
 *
 * Branding (invite + password reset):
 * - The dashboard sends optional `practiceNamesForEmail` (comma-separated names).
 * - Use a **public HTTPS URL** for the logo. Do not reference local paths or Vite
 *   hashed asset names — email clients need a stable absolute URL.
 * - This repo serves `public/branding/ponce-logo.png` at
 *   `{APP_PUBLIC_URL}/branding/ponce-logo.png` after deploy (or copy that file to
 *   your CDN).
 *
 * Env (example):
 *   BREVO_API_KEY=xkeysib-...   (or legacy SENDINBLUE_API_KEY; Brevo tried first in production backend)
 *   RESEND_API_KEY=re_...       (optional alternative)
 *   APP_PUBLIC_URL=https://app.yourdomain.com   (continue URL host for Firebase + default logo base)
 *   EMAIL_BRAND_LOGO_URL=https://app.yourdomain.com/branding/ponce-logo.png   (optional override)
 *   INVITE_FROM_EMAIL=Team <noreply@yourdomain.com>
 *
 * Forgot password (two paths):
 * - **Client `sendPasswordResetEmail`** (VITE_PASSWORD_RESET_VIA_BACKEND not true):
 *   Firebase Console → Authentication → Templates → Password reset — edit subject/body
 *   and set Action URL to your `/auth/action` page. For images, host the logo at a
 *   public URL and use `<img src="https://...">` in the custom HTML if the template
 *   allows it (Firebase template editor is limited; Custom SMTP unlocks full HTML).
 * - **Backend** (`VITE_PASSWORD_RESET_VIA_BACKEND=true`): implement
 *   `POST /api/auth/forgot-password` using `generatePasswordResetLink` + the same
 *   `buildPasswordResetEmailHtml` styling as below.
 */

import crypto from "node:crypto";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Request = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Response = any;

const PRODUCT_LINE = "Ponce AI Facial Analysis System";

/** Example: plug into express — app.post("/api/admin/firebase/users/invite", ...) */
export async function postInviteFirebaseUserExample(req: Request, res: Response) {
  const {
    email,
    displayName,
    initialClaims,
    personalMessage,
    practiceNamesForEmail,
  } = req.body ?? {};

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ error: "Valid email is required." });
  }

  // const admin = getFirebaseAdmin(); // your singleton
  // const auth = admin.auth();

  const tempPassword = crypto.randomBytes(24).toString("base64url").slice(0, 32);

  // const userRecord = await auth.createUser({
  //   email: email.trim().toLowerCase(),
  //   password: tempPassword,
  //   displayName: typeof displayName === "string" ? displayName : undefined,
  //   emailVerified: false,
  // });

  // await auth.setCustomUserClaims(userRecord.uid, initialClaims ?? {});

  const appPublicUrl =
    process.env.APP_PUBLIC_URL ?? "https://your-app.example.com";
  const continueUrl = `${appPublicUrl.replace(/\/$/, "")}/`;

  // const link = await auth.generatePasswordResetLink(email.trim().toLowerCase(), {
  //   url: continueUrl,
  //   handleCodeInApp: false,
  // });

  const link = "https://example.invalid/firebase-invite-link-placeholder";

  const logoUrl =
    process.env.EMAIL_BRAND_LOGO_URL?.trim() ||
    `${appPublicUrl.replace(/\/$/, "")}/branding/ponce-logo.png`;

  const providerLine =
    typeof practiceNamesForEmail === "string" && practiceNamesForEmail.trim()
      ? practiceNamesForEmail.trim()
      : undefined;

  const html = buildInviteEmailHtml({
    setPasswordUrl: link,
    logoUrl,
    providerNames: providerLine,
    personalMessage:
      typeof personalMessage === "string" && personalMessage.trim()
        ? personalMessage.trim()
        : undefined,
  });

  // --- Brevo (example) — POST https://api.brevo.com/v3/smtp/email, header api-key ---
  // await fetch("https://api.brevo.com/v3/smtp/email", {
  //   method: "POST",
  //   headers: { "api-key": process.env.BREVO_API_KEY!, "Content-Type": "application/json" },
  //   body: JSON.stringify({
  //     sender: { name: "Team", email: "onboarding@yourdomain.com" },
  //     to: [{ email: email.trim() }],
  //     subject: "You're invited — set up your account",
  //     htmlContent: html,
  //   }),
  // });

  // --- Resend (example) ---
  // const resendKey = process.env.RESEND_API_KEY;
  // if (!resendKey) { ... return 500 ... }
  // await fetch("https://api.resend.com/emails", {
  //   method: "POST",
  //   headers: {
  //     Authorization: `Bearer ${resendKey}`,
  //     "Content-Type": "application/json",
  //   },
  //   body: JSON.stringify({
  //     from: process.env.INVITE_FROM_EMAIL ?? "App <onboarding@yourdomain.com>",
  //     to: [email.trim()],
  //     subject: "You're invited — set up your account",
  //     html,
  //   }),
  // });

  const emailSent = false; // set true after successful provider send

  return res.json({
    ok: true,
    uid: "placeholder-uid",
    email: email.trim().toLowerCase(),
    emailSent,
    message: emailSent
      ? `Invitation sent to ${email.trim()}.`
      : "User created; configure RESEND (or similar) to send branded email.",
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function brandHeader(opts: { logoUrl: string; eyebrow: string; title: string }): string {
  // Only absolute http(s) URLs — relative paths are skipped (no broken relative src in mail).
  // Even with http://localhost/... here, Gmail/Apple Mail/etc. fetch images from the public
  // internet; localhost never resolves to your dev machine, so the logo appears broken in test.
  // Use APP_PUBLIC_URL / EMAIL_BRAND_LOGO_URL pointing at a deployed HTTPS host (or CDN).
  const logo =
    opts.logoUrl && /^https?:\/\//i.test(opts.logoUrl)
      ? `<img src="${escapeHtml(opts.logoUrl)}" alt="Ponce AI" width="160" height="auto" style="display:block;max-width:160px;height:auto;border:0;margin:0 auto 16px;" />`
      : "";

  return `
          <tr>
            <td style="padding:28px 28px 8px;text-align:center;">
              ${logo}
              <p style="margin:0;font-size:12px;font-weight:600;letter-spacing:0.08em;color:#64748b;text-transform:uppercase;">${escapeHtml(
                opts.eyebrow,
              )}</p>
              <h1 style="margin:10px 0 0;font-size:22px;line-height:1.3;color:#0f172a;">${escapeHtml(
                opts.title,
              )}</h1>
              <p style="margin:10px 0 0;font-size:14px;line-height:1.45;color:#475569;">${escapeHtml(
                PRODUCT_LINE,
              )}</p>
            </td>
          </tr>`;
}

/**
 * Invite: includes optional provider / location names from the dashboard (`practiceNamesForEmail`).
 */
function buildInviteEmailHtml(opts: {
  setPasswordUrl: string;
  logoUrl: string;
  providerNames?: string;
  personalMessage?: string;
}): string {
  const note = opts.personalMessage
    ? `<p style="margin:16px 28px 0;font-size:15px;line-height:1.5;color:#334155;">${escapeHtml(
        opts.personalMessage,
      )}</p>`
    : "";

  const providerBlock = opts.providerNames
    ? `<p style="margin:16px 28px 0;font-size:15px;line-height:1.5;color:#334155;"><strong>Organization / location:</strong> ${escapeHtml(
        opts.providerNames,
      )}</p>`
    : "";

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:system-ui,-apple-system,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
          ${brandHeader({
            logoUrl: opts.logoUrl,
            eyebrow: "Invitation",
            title: "Set up your account",
          })}
          <tr>
            <td style="padding:0 28px 8px;">
              ${providerBlock}
              ${note}
              <p style="margin:20px 0 0;font-size:15px;line-height:1.55;color:#475569;">
                You’ve been invited to access the dashboard for <strong>${escapeHtml(
                  PRODUCT_LINE,
                )}</strong>. Click the button below to choose a password and sign in.
              </p>
              <p style="margin:28px 0 0;text-align:center;">
                <a href="${opts.setPasswordUrl}" style="display:inline-block;background:#0f172a;color:#fefce8;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:8px;">
                  Set password &amp; sign in
                </a>
              </p>
              <p style="margin:20px 0 24px;font-size:13px;line-height:1.5;color:#94a3b8;">
                If the button doesn’t work, paste this link into your browser:<br/>
                <span style="word-break:break-all;color:#64748b;">${escapeHtml(opts.setPasswordUrl)}</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;border-top:1px solid #e2e8f0;background:#f8fafc;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">This link expires for security reasons; request a new one from your admin if needed.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Password reset (use when backend sends mail — same visual system as invite).
 * Optional `providerNames`: resolve from the user’s custom claims + provider directory if you want parity with invites.
 */
export function buildPasswordResetEmailHtml(opts: {
  resetUrl: string;
  logoUrl: string;
  providerNames?: string;
}): string {
  const providerBlock = opts.providerNames
    ? `<p style="margin:16px 28px 0;font-size:15px;line-height:1.5;color:#334155;"><strong>Organization / location:</strong> ${escapeHtml(
        opts.providerNames,
      )}</p>`
    : "";

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:system-ui,-apple-system,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
          ${brandHeader({
            logoUrl: opts.logoUrl,
            eyebrow: "Password reset",
            title: "Reset your password",
          })}
          <tr>
            <td style="padding:0 28px 8px;">
              ${providerBlock}
              <p style="margin:20px 0 0;font-size:15px;line-height:1.55;color:#475569;">
                We received a request to reset your password for <strong>${escapeHtml(
                  PRODUCT_LINE,
                )}</strong>. Click the button below to choose a new password.
              </p>
              <p style="margin:28px 0 0;text-align:center;">
                <a href="${opts.resetUrl}" style="display:inline-block;background:#0f172a;color:#fefce8;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:8px;">
                  Reset password
                </a>
              </p>
              <p style="margin:20px 0 24px;font-size:13px;line-height:1.5;color:#94a3b8;">
                If you didn’t request this, you can ignore this email.<br/>
                If the button doesn’t work, paste this link into your browser:<br/>
                <span style="word-break:break-all;color:#64748b;">${escapeHtml(opts.resetUrl)}</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;border-top:1px solid #e2e8f0;background:#f8fafc;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">This link expires for security reasons.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
