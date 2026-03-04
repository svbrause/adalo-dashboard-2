# Full pipeline monitoring (GCP + Slack)

This folder runs scheduled checks across your stack and sends **Slack alerts** on failures (404, 500, 503, timeouts, or latency over threshold).

## What gets checked

| Component | How it’s checked | Notes |
|-----------|------------------|--------|
| **Vercel frontend** | `GET FRONTEND_URL` → expect 200 | Set `FRONTEND_URL` (e.g. `https://your-app.vercel.app`) |
| **Dashboard backend** (Vercel) | `GET BACKEND_API_URL/api/health` → expect 200 | Backend currently returns 404 (no `/api/health`). Add that route to fail the check when backend is down. Until then, 404 is treated as “allowed”. |
| **Realtime pipeline** (GCP Cloud Run) | `GET PIPELINE_HEALTH_URL/health` → expect 200 | Your Jotform webhook service already has `/health`; use its Cloud Run URL. |
| **Jotform** | Optional: `CHECK_JOTFORM_STATUS_URL` or your form’s public URL | Jotform doesn’t expose a health API; you can ping a public form URL or their status page. |
| **Airtable** | Via pipeline only | The pipeline’s `/health` response includes `airtable_configured`. We only check that the pipeline is up; for full “Airtable writable” you’d add a backend endpoint that does a minimal read. |
| **GCP** | Pipeline and (optional) Cloud Run /health | Covered by pipeline URL. |
| **Zapier / OpenPhone / Boulevard / Brevo** | Not directly | No public health endpoints. **Recommendation:** add a single **backend health route** (e.g. `GET /api/health`) that (1) pings Airtable, (2) optionally calls Zapier/OpenPhone/Boulevard/Brevo with a no-op or minimal request, and (3) returns 200 only if all are OK. Then the monitor only needs to check that one URL. |

## Why you saw 404 on the current healthcheck

The **dashboard repo** `npm run healthcheck` script only calls your **dashboard backend** at `GET .../api/health`. The **ponce-patient-backend** (Vercel) does **not** implement `/api/health`, so the backend returns **404**. That’s a **backend gap**, not a bug in the test. The script is written so that a failed backend check does **not** fail the run (so CI doesn’t block until you add the route). Once you add `GET /api/health` on the backend (and optionally make it check Airtable / integrations), you can treat a non-200 as a real failure and get Slack alerts.

The **realtime pipeline** (GCP Cloud Run, in `my_project_cursor`) **does** have `GET /health`; the monitor uses that when you set `PIPELINE_HEALTH_URL`.

## Env vars (for local or GCP)

```bash
# Required for Slack alerts
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Endpoints (optional; use at least one or ADD_CHECK_*)
FRONTEND_URL=https://your-dashboard.vercel.app
BACKEND_API_URL=https://ponce-patient-backend.vercel.app
PIPELINE_HEALTH_URL=https://jotform-webhook-service-XXXXX.run.app   # your GCP Cloud Run URL

# Optional: fail if backend returns 404 (set after you add /api/health)
# CHECK_BACKEND_ALLOW_404=0

# Optional: max latency (ms) per check
CHECK_FRONTEND_MAX_MS=10000
CHECK_BACKEND_MAX_MS=8000
CHECK_PIPELINE_MAX_MS=10000

# Optional: send Slack message when all pass (default: only on failure)
SLACK_ALERT_ON_SUCCESS=1

# Optional: extra checks (any CHECK_*_URL)
CHECK_JOTFORM_STATUS_URL=https://status.jotform.com/
CHECK_JOTFORM_STATUS_NAME=Jotform status
CHECK_AIRTABLE_STATUS_URL=https://status.airtable.com/
CHECK_AIRTABLE_STATUS_NAME=Airtable status
```

## Run locally

From repo root:

```bash
cd monitoring
export SLACK_WEBHOOK_URL="..."
export FRONTEND_URL="https://your-app.vercel.app"
export BACKEND_API_URL="https://ponce-patient-backend.vercel.app"
export PIPELINE_HEALTH_URL="https://YOUR-CLOUD-RUN-URL.run.app"
node run.js
```

Exit code 0 = all pass, 1 = at least one failure (for cron/GCP).

## Deploy to GCP (Cloud Scheduler + Cloud Function)

1. **Create a Cloud Function (2nd gen)** that runs the monitor and posts to Slack:
   - Runtime: Node 20.
   - Entry: deploy the `monitoring/` folder as the function source (or copy `run.js` into the function).
   - Env vars: set `SLACK_WEBHOOK_URL`, `FRONTEND_URL`, `BACKEND_API_URL`, `PIPELINE_HEALTH_URL` (and any `CHECK_*`) in the function’s environment.
   - Trigger: HTTP (so Scheduler can call it).

2. **Create a Cloud Scheduler job** that calls the function’s URL every 5–15 minutes (e.g. `*/10 * * * *`).

3. **Optional:** Use a **Cloud Run Job** instead of a function: build a small Docker image that runs `node run.js`, schedule the job with Cloud Scheduler. Same env vars; no HTTP endpoint needed.

Example (Cloud Function 2nd gen, from repo root):

```bash
cd monitoring
gcloud functions deploy pipeline-monitor \
  --gen2 \
  --runtime=nodejs20 \
  --region=us-central1 \
  --source=. \
  --entry-point=run \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars SLACK_WEBHOOK_URL=xxx,FRONTEND_URL=xxx,BACKEND_API_URL=xxx,PIPELINE_HEALTH_URL=xxx
```

Then create a Scheduler job that HTTP GETs the function URL on a schedule. If you use `--allow-unauthenticated`, consider protecting the URL (e.g. VPC or a secret query param) so only Scheduler can call it.

## Slack message format

- **On failure:** one message per run listing failed checks (name, HTTP status or error, latency).
- **On success:** only if `SLACK_ALERT_ON_SUCCESS=1`.

## Real-time pipeline “return time”

The monitor does **not** submit a real form through Jotform → pipeline. To alert when “the realtime pipeline doesn’t return in expected time,” you have two options:

1. **Synthetic submission:** Add a separate scheduled job (e.g. daily) that POSTs a minimal test payload to your pipeline’s webhook (or a dedicated `/test` endpoint), measures end-to-end time, and alerts to Slack if it exceeds a threshold. That would live in the same GCP project (or in the pipeline repo) and use the same Slack webhook.
2. **Latency on /health:** We only check that `GET /health` returns 200 within `CHECK_PIPELINE_MAX_MS`. That doesn’t measure full pipeline latency; for that you need (1) or backend metrics (e.g. Cloud Monitoring) on the pipeline service.

## Summary

- **Current `npm run healthcheck`:** Only hits dashboard backend `/api/health`. It does **not** test Jotform, Airtable, GCP, Zapier, OpenPhone, Boulevard, or Brevo. The 404 is because the backend doesn’t implement that route yet.
- **This monitor:** Checks frontend, backend, and pipeline (and optional status URLs). It does **not** directly test Jotform→Airtable→GCP→Zapier→OpenPhone→Boulevard→Brevo; for that, add a single **backend `/api/health`** that verifies each integration and have the monitor rely on that one URL.
- **Slack:** Set `SLACK_WEBHOOK_URL`; the script posts on any failure (and optionally on success).
- **GCP:** Run the script on a schedule via Cloud Scheduler + Cloud Function (or Cloud Run Job).
