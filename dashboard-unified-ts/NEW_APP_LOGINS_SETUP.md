# New App Logins – Airtable Table Setup

This doc describes how to configure the **new app logins** Airtable table so dashboard (and other app) logins are logged.

**Source:** The dashboard at **analysis.ponce.ai** sends `source: "analysis.ponce.ai"` so you can distinguish these logins from **cases.ponce.ai** (different app) in the same table.

---

## 1. Airtable: Table and field names

Create or use a table named exactly:

**Table name:** `new app logins`

Add these fields with the **exact** names and types below (API and backend use these names):

| Field name        | Airtable type       | Notes                                                         |
| ----------------- | ------------------- | ------------------------------------------------------------- |
| **Provider Id**   | Single line text    | Airtable record ID of the provider (e.g. `rec8tXdyK2dGWPf3u`) |
| **Provider Name** | Single line text    | Display name of the provider                                  |
| **Provider Code** | Single line text    | Code used to log in (e.g. `TheTreatment447`)                  |
| **Logged in at**  | Date (include time) | When the login happened (ISO 8601 from frontend)              |
| **Source**        | Single line text    | App origin: `analysis.ponce.ai` or `cases.ponce.ai`           |
| **Session ID**    | Single line text    | Unique session id (UUID) for this login                       |
| **Email**         | Single line text    | Provider email if available from API                          |
| **Name**          | Single line text    | Provider display name (same as Provider Name for dashboard)   |
| **Stage**         | Single line text    | Event stage, e.g. `login`                                     |
| **Metadata**      | Long text           | JSON with userAgent, referrer, etc.                           |

- Field names are **case-sensitive** in the Airtable API; use the capitalization above.
- **Logged in at** should be “Date” with “Include time” enabled so ISO strings from the frontend are accepted.

---

## 2. Frontend: What gets sent

On successful provider login, **analysis.ponce.ai** sends a **POST** to the backend with this JSON body:

| Key            | Type              | Example                         |
| -------------- | ----------------- | ------------------------------- |
| `providerId`   | string            | `"rec8tXdyK2dGWPf3u"`           |
| `providerName` | string            | `"The Treatment"`               |
| `providerCode` | string            | `"TheTreatment447"`             |
| `timestamp`    | string (ISO 8601) | `"2026-01-28T20:00:00.000Z"`    |
| `source`       | string            | `"analysis.ponce.ai"`           |
| `sessionId`    | string            | UUID for this login             |
| `name`         | string            | Provider name                   |
| `email`        | string            | Provider email (if from API)    |
| `stage`        | string            | `"login"`                       |
| `metadata`     | string            | JSON: `{ userAgent, referrer }` |

The backend maps these to the Airtable fields above.

---

## 3. Backend: Writing to Airtable

The backend must:

1. Accept **POST** at `/api/dashboard/login-notification`.
2. Read `providerId`, `providerName`, `providerCode`, `timestamp`, `source`, `sessionId`, `name`, `email`, `stage`, `metadata` from the request body.
3. Create **one record** in the base’s **new app logins** table with the field mapping in section 1.

Use the same Airtable base and API key as your other dashboard/backend tables (e.g. `AIRTABLE_BASE_ID`, `AIRTABLE_API_KEY`). Optionally use an env var for the table name, e.g. `AIRTABLE_LOGINS_TABLE_NAME` defaulting to `new app logins`.

---

## 4. Environment variables (backend)

If using the serverless function in this repo (`api/dashboard/login-notification.js`):

| Variable                     | Required | Description                               |
| ---------------------------- | -------- | ----------------------------------------- |
| `AIRTABLE_API_KEY`           | Yes      | Airtable personal access token or API key |
| `AIRTABLE_BASE_ID`           | Yes      | Base that contains **new app logins**     |
| `AIRTABLE_LOGINS_TABLE_NAME` | No       | Default: `new app logins`                 |

Set these in your hosting (e.g. Vercel → Project → Settings → Environment Variables), then redeploy.

---

## 5. Using this repo’s backend route

This repo includes a serverless handler that writes to **new app logins**:

- **Path:** `api/dashboard/login-notification.js` (in the parent `test7` folder, not inside `dashboard-unified-ts`).
- **URL when deployed:** `https://<your-vercel-project>/api/dashboard/login-notification`.

To use it:

1. Deploy the project that contains the `api/` folder (e.g. the repo root that has both `api/` and `dashboard-unified-ts/`).
2. Set `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`, and optionally `AIRTABLE_LOGINS_TABLE_NAME`.
3. Point the dashboard frontend at this deployment by setting `VITE_API_URL` (or your build-time backend URL) to `https://<your-vercel-project>` so login requests go to `/api/dashboard/login-notification` on that host.

If you use a different backend (e.g. ponce-patient-backend), implement the same behavior there using the field names and payload above.

---

## 6. Ready to deploy

**Frontend (analysis.ponce.ai / dashboard-unified-ts):**

- [x] Sends `source: "analysis.ponce.ai"` so logins are distinguishable from cases.ponce.ai.
- [x] Sends all required and optional fields (providerId, providerName, providerCode, timestamp, source, sessionId, name, email, stage, metadata).
- [x] Login notification is fire-and-forget; it does not block the user.

**Backend (api/dashboard/login-notification.js):**

- [x] Writes to table **new app logins** with fields: Provider Id, Provider Name, Provider Code, Logged in at, Source, Session ID, Email, Name, Stage, Metadata.
- [x] Uses `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`, and optionally `AIRTABLE_LOGINS_TABLE_NAME`.

**Airtable:**

- [x] Table **new app logins** exists with the fields listed in section 1 (you have added them).

**Deploy steps:**

1. **Backend:** Deploy the project that contains `api/dashboard/login-notification.js` (e.g. the repo that has the `api/` folder). Set `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID` in that project’s environment variables. Redeploy.
2. **Frontend:** Deploy the dashboard (e.g. dashboard-unified-ts or analysis.ponce.ai). Ensure the app’s backend URL points to the same host that serves `/api/dashboard/login-notification` (or to ponce-patient-backend if that backend implements the same route).
3. **Verify:** Log in once with a provider code on analysis.ponce.ai and confirm a new row appears in **new app logins** with Source = `analysis.ponce.ai`.
