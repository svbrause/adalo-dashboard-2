# Dashboard Login Notifications (Airtable + optional Slack)

When someone logs into the dashboard, you can **log the event in Airtable** (who, when, provider code) and optionally **get a Slack message**—without managing Slack tokens or webhooks in your backend.

**Recommended flow: Airtable first, Slack via Airtable (if you want it).**

- **Simpler:** One backend route that only writes a row to Airtable (using the same Airtable setup you already have).
- **Persistent:** Every login is stored in a table you can filter, report on, and keep.
- **Slack optional:** If you want Slack too, add an Airtable automation that runs when a new row is created and sends a message (no Slack tokens in your backend).

---

## Flow

1. User logs in on the dashboard (enters provider code).
2. Frontend calls `POST /api/dashboard/login-notification` with `{ providerId, providerName, providerCode, timestamp }`. _(Already implemented.)_
3. Backend receives the request and **creates one row** in an Airtable table (e.g. “Dashboard logins”).
4. **(Optional)** In Airtable, add an automation: “When record is created” → “Send message to Slack.” You get a Slack notification without any Slack secrets in your backend.

---

## 1. Airtable: create a table for logins

Suggested fields to store so you can **report in Airtable** and **build a clear Slack message** from the automation (e.g. “Provider: {{Provider Name}} logged in at {{Logged in at}}”).

### Recommended fields

| Field name        | Airtable type | Source   | Use in Slack / reporting                                                           |
| ----------------- | ------------- | -------- | ---------------------------------------------------------------------------------- |
| **Provider Name** | Single line   | Frontend | “Who” in the message; filter/sort in Airtable                                      |
| **Provider Code** | Single line   | Frontend | e.g. TheTreatment250; good for quick lookup                                        |
| **Provider ID**   | Single line   | Frontend | Link to Providers table if you want; audit trail                                   |
| **Logged in at**  | Date & time   | Frontend | “When”; use for reports and in Slack                                               |
| **Source**        | Single line   | Backend  | e.g. `dashboard` or `analysis.ponce.ai`; useful if you add more entry points later |

### Optional (backend only)

| Field name     | Airtable type | Source  | Use                                                |
| -------------- | ------------- | ------- | -------------------------------------------------- |
| **IP**         | Single line   | Backend | Security/audit (optional; consider privacy policy) |
| **User agent** | Long text     | Backend | “Desktop vs mobile” or troubleshooting (optional)  |

**For the Slack automation:** Map the main fields into the message, e.g.  
`Provider: {{Provider Name}} ({{Provider Code}}) logged in at {{Logged in at}}`  
and add **Source** or **IP** to the message if you store them and want them in Slack.

Note the **table name** and **base ID**; the backend will need them to write to this base/table.

---

## 2. Backend: one route that writes to Airtable

Add a serverless route that:

1. Accepts `POST /api/dashboard/login-notification` with JSON: `{ providerId, providerName, providerCode, timestamp }`.
2. Optionally reads from the request: `Origin` or `Referer` for **Source**, `x-forwarded-for` or similar for **IP**, `User-Agent` for **User agent** (if you added those fields).
3. Creates one record in your “Dashboard logins” table with those fields (and **Logged in at** from `timestamp`).

Your backend already talks to Airtable (leads, patients, etc.), so this is the same kind of call: use the Airtable API (or your existing helper) to create a record. No Slack code, no webhooks, no tokens.

**Example (conceptual):**

```js
// api/dashboard/login-notification.js
// Uses whatever Airtable client/env your backend already uses (e.g. base, API key).

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { providerId, providerName, providerCode, timestamp } =
      req.body || {};
    const origin = req.headers.origin || req.headers.referer || "";
    const base = getAirtableBase(); // your existing Airtable setup
    const tableName =
      process.env.AIRTABLE_LOGINS_TABLE_NAME || "Dashboard logins";

    await base(tableName).create({
      "Provider ID": providerId || "",
      "Provider Name": providerName || "",
      "Provider Code": providerCode || "",
      "Logged in at": timestamp || new Date().toISOString(),
      ...(origin && { Source: origin }),
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("login-notification error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}
```

If the table or base is in a different base, use the base ID for that base and the same API key (or a token with access to that base). No other services required.

---

## 3. Optional: Slack via Airtable automation

If you want a Slack message whenever someone logs in:

1. In Airtable, open **Automations** and create a new automation.
2. Trigger: **When record is created** in the “Dashboard logins” table.
3. Action: use the **Slack** action (install the Slack integration for Airtable if needed) to “Send a message to a channel.”
4. In the message, reference the new record’s fields (e.g. “Provider: {{Provider Name}}, Code: {{Provider Code}}, at {{Logged in at}}”).

Then:

- **Slack tokens/webhooks** stay inside Airtable’s Slack integration; you don’t store or manage them in your backend.
- You get both a **persistent log in Airtable** and **Slack notifications** by configuring Airtable only.

---

## Summary

| Approach                         | Backend does              | Airtable        | Slack                             | Persistence                        |
| -------------------------------- | ------------------------- | --------------- | --------------------------------- | ---------------------------------- |
| **Airtable-first (recommended)** | Write one row to Airtable | Table of logins | Optional, via Airtable automation | Yes                                |
| Backend → Slack (webhook/token)  | Post to Slack             | Optional        | Yes, from backend                 | Only if you also write to Airtable |

**Recommendation:** Use **Frontend → Backend → Airtable**. Keep the backend simple (one Airtable create). Get persistence and reporting from the table. Add Slack when you want it via an Airtable automation, without touching Slack tokens or webhooks in your code.

---

## If you prefer Slack directly from the backend

If you’d rather not use Airtable for this and want the backend to post to Slack itself:

- **Webhook:** Backend stores `SLACK_LOGIN_WEBHOOK_URL` and POSTs the login payload to that URL. No token.
- **Bot token:** Backend stores `SLACK_LOGIN_BOT_TOKEN` and `SLACK_LOGIN_CHANNEL_ID`, and calls `https://slack.com/api/chat.postMessage` with `Authorization: Bearer <token>`. See [Slack tokens](https://docs.slack.dev/authentication/tokens/) for bot tokens (`xoxb-`).

The frontend and the `POST /api/dashboard/login-notification` contract stay the same; only the backend implementation (Airtable create vs Slack POST) changes.
