import "./FirebaseAdminGuide.css";

function FirebaseAdminGuideSections() {
  return (
    <>
      <section>
        <h3 className="firebase-admin-guide__h">What are &quot;claims&quot;?</h3>
        <p className="firebase-admin-guide__p">
          In Firebase Auth, <strong>custom claims</strong> are small pieces of data your{" "}
          <strong>backend</strong> stores on a user—such as <code>admin: true</code>, a{" "}
          <code>role</code>, or which locations they belong to. After that person signs in,
          those values ride along in their <strong>ID token</strong> (their session). Apps
          read them to decide who can do what. On this page you set them from{" "}
          <strong>View</strong> on a user row, then <strong>Edit permissions</strong> in
          the detail panel; you are not editing the table cells directly.
        </p>
      </section>

      <section>
        <h3 className="firebase-admin-guide__h">Who can access</h3>
        <ul className="firebase-admin-guide__list">
          <li>
            Sign in here with <strong>Firebase</strong> email/password (not the
            provider code on the main login).
          </li>
          <li>
            Your account must be allowed to call the backend admin API: your UID in{" "}
            <code>FIREBASE_SUPERADMIN_UIDS</code> on the server, or the permission flag{" "}
            <code>admin: true</code> on your Firebase user.
          </li>
          <li>
            The API needs the <strong>Firebase Admin SDK</strong> (
            <code>FIREBASE_SERVICE_ACCOUNT_JSON</code> or{" "}
            <code>GOOGLE_APPLICATION_CREDENTIALS</code>).
          </li>
        </ul>
      </section>

      <section>
        <h3 className="firebase-admin-guide__h">Backend URL</h3>
        <p className="firebase-admin-guide__p">
          Dashboard env <code>VITE_BACKEND_API_URL</code> must point at the same
          host that serves <code>/api/admin/firebase/*</code> (e.g.{" "}
          <code>http://localhost:3001</code> locally — the Express API, not Vite).
        </p>
      </section>

      <section>
        <h3 className="firebase-admin-guide__h">Roles &amp; what we store</h3>
        <p className="firebase-admin-guide__p">
          After you save changes here, the updated data appears in the user&apos;s token when
          they <strong>sign out and back in</strong> (or when the token refreshes).{" "}
          <code>practiceIds</code> are provider directory record IDs. When{" "}
          <code>VITE_FIREBASE_STAFF_LOGIN_TO_DASHBOARD</code> is <code>true</code>, staff with
          the right practice ids on their profile can open the main dashboard from the public
          login page using email and password (no provider code).
        </p>
        <table className="firebase-admin-guide__table">
          <thead>
            <tr>
              <th>Template</th>
              <th>Stored</th>
              <th>Use</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Super admin</td>
              <td>
                <code>admin: true</code>
              </td>
              <td>Full access to this admin UI and API.</td>
            </tr>
            <tr>
              <td>Admin</td>
              <td>
                <code>role: &quot;practice_admin&quot;</code> +{" "}
                <code>practiceIds</code>
              </td>
              <td>
                Administrative privileges within the selected practices only (enforce
                in your app/API).
              </td>
            </tr>
            <tr>
              <td>Staff</td>
              <td>
                <code>role: &quot;staff&quot;</code> + <code>practiceIds</code>
              </td>
              <td>
                Default role for day-to-day users. Older accounts may have only{" "}
                <code>practiceIds</code> without <code>role</code>; they are treated
                the same when you view or edit them here.
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h3 className="firebase-admin-guide__h">Common tasks</h3>
        <ul className="firebase-admin-guide__list">
          <li>
            <strong>Add user</strong> — use the button above; password min. 6
            characters (Firebase).
          </li>
          <li>
            <strong>Invite user</strong> — creates the account with the chosen role;
            practice locations follow your admin account (or the full directory for
            technical super admins), then (when the backend is configured) emails a link to set
            their password. Branded HTML and sending from your domain are handled on
            the API server, not in this app.
          </li>
          <li>
            <strong>Onboarding column</strong> — <strong>Pending first sign-in</strong>{" "}
            means Firebase has no successful sign-in yet (typical for an open invite
            or a manually created account that hasn&apos;t been used). It clears after
            their first login. Use the <strong>First sign-in</strong> filter to list
            pending users only.
          </li>
          <li>
            <strong>Edit role</strong> — open <strong>Manage</strong>, set access level, then save.
            Practice locations are applied automatically from your org (not chosen per user here).
          </li>
          <li>
            <strong>Password reset link</strong> — generates a link to copy. Send
            only over a trusted channel. It does not send email by itself; use
            Firebase Auth email templates + <code>sendPasswordResetEmail</code> on
            the client — unless <code>VITE_PASSWORD_RESET_VIA_BACKEND=true</code>, in
            which case the backend sends the same HTML as invites via Resend/Brevo.
          </li>
          <li>
            <strong>Email verification link</strong> — for users not yet verified.
          </li>
          <li>
            <strong>Revoke sessions</strong> — signs the user out on every device.
          </li>
          <li>
            <strong>Disable / enable account</strong> — disabled users cannot sign
            in.
          </li>
        </ul>
      </section>

      <section>
        <h3 className="firebase-admin-guide__h">Production: main login page</h3>
        <p className="firebase-admin-guide__p">
          Set <code>VITE_FIREBASE_SHOW_STAFF_AUTH</code> to <code>true</code> to show
          staff email/password on the main login in production builds; use{" "}
          <code>false</code> or omit it to show <strong>only</strong> the provider code
          there. Local <code>npm run dev</code> may show the staff block when Firebase
          is configured and this variable is omitted. From the signed-in dashboard, use{" "}
          <strong>Settings</strong> → <strong>Open Users and Roles</strong>. The URL{" "}
          <code>/admin/firebase</code> still works when opened directly.
        </p>
      </section>

      <section>
        <h3 className="firebase-admin-guide__h">Troubleshooting</h3>
        <ul className="firebase-admin-guide__list firebase-admin-guide__list--compact">
          <li>
            <strong>Admin SDK not configured</strong> — service account on the API;
            restart the API.
          </li>
          <li>
            <strong>403</strong> — check superadmin UID list or that your user has{" "}
            <code>admin: true</code> in Firebase.
          </li>
          <li>
            <strong>curl shows HTML</strong> — port 3001 must be Express, not Vite.
          </li>
          <li>
            <strong>Permissions not updating</strong> — after edits here, the user must
            sign out and sign in again so their session picks up the new data.
          </li>
          <li>
            <strong>CORS</strong> — API allows your dashboard origin (e.g.{" "}
            <code>http://localhost:5173</code>).
          </li>
        </ul>
      </section>

      <section>
        <h3 className="firebase-admin-guide__h">Security</h3>
        <p className="firebase-admin-guide__p">
          Treat reset and verification links as secrets. Do not commit service
          account JSON to git. Consider audit logging for admin actions in production.
        </p>
      </section>
    </>
  );
}

/** Short help for practice-level admins (no account security / UID tools). */
function FirebaseAdminGuideSimplifiedSections() {
  return (
    <>
      <section>
        <h3 className="firebase-admin-guide__h">What you can do here</h3>
        <p className="firebase-admin-guide__p">
          Practice <strong>Admins</strong> can invite people, set whether someone is an{" "}
          <strong>Admin</strong> or <strong>Staff</strong> (practice locations match your
          organization automatically), and disable accounts. <strong>Staff</strong> can invite and edit access too, but cannot disable
          accounts—ask an Admin if someone should lose access. After permission changes, users
          may need to sign out and back in.
        </p>
      </section>
      <section>
        <h3 className="firebase-admin-guide__h">Need more help?</h3>
        <p className="firebase-admin-guide__p">
          Technical IDs, session revoke, and verification links are for super admins. If you are
          Staff and need an account disabled, ask a practice Admin.
        </p>
      </section>
    </>
  );
}

type FirebaseAdminGuideProps = {
  /** When true, render as a sticky sidebar panel (signed-in admin layout). */
  sidebar?: boolean;
  /** Text for the collapsible summary (default: “Documentation”). */
  summaryLabel?: string;
  /** Practice-facing view: shorter copy, no backend/env troubleshooting. */
  variant?: "full" | "simplified";
};

/**
 * In-page help for /admin/firebase (was docs/FIREBASE_USER_ADMIN.md).
 */
export default function FirebaseAdminGuide({
  sidebar = false,
  summaryLabel = "Documentation",
  variant = "full",
}: FirebaseAdminGuideProps) {
  const body =
    variant === "simplified" ? (
      <FirebaseAdminGuideSimplifiedSections />
    ) : (
      <FirebaseAdminGuideSections />
    );

  if (sidebar) {
    return (
      <div className="firebase-admin-guide firebase-admin-guide--sidebar-panel">
        <div className="firebase-admin-guide__sidebar-head">
          <h2 className="firebase-admin-guide__sidebar-title">Help</h2>
          <p className="firebase-admin-guide__sidebar-lead">
            {variant === "simplified"
              ? "Invites and access for your team."
              : "Roles, env vars, and common tasks for this page."}
          </p>
        </div>
        <div className="firebase-admin-guide__sidebar-scroll">
          <div className="firebase-admin-guide__body firebase-admin-guide__body--sidebar">
            {body}
          </div>
        </div>
      </div>
    );
  }

  return (
    <details className="firebase-admin-guide">
      <summary className="firebase-admin-guide__summary">{summaryLabel}</summary>
      <div className="firebase-admin-guide__body">{body}</div>
    </details>
  );
}
