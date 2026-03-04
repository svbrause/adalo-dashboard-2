# Testing and Monitoring

This doc describes how we get visibility into the full pipeline (forms, Airtable, backend, realtime) and catch issues before they reach customers.

## Does the healthcheck test Jotform, Airtable, GCP, etc.?

**No.** The script `scripts/healthcheck.js` (run with `npm run healthcheck`) only calls **one** URL: your **dashboard backend** at `GET {BACKEND_API_URL}/api/health`. It does **not** test Jotform, Airtable, GCP Cloud Run, Zapier, OpenPhone, Boulevard, Brevo, or the realtime pipeline.

**Why you see 404:** The **dashboard backend** (ponce-patient-backend on Vercel) does **not** implement `/api/health`, so the backend returns **404**. That’s a **missing endpoint on the backend**, not a bug in the test. The script is written so that a failed backend check does not fail the run (so CI doesn’t block). Your **realtime pipeline** (GCP Cloud Run, in `my_project_cursor`) **does** expose `GET /health`; the separate **pipeline monitor** (below) uses that.

**Full pipeline + Slack:** For one place that checks frontend, backend, GCP pipeline, and (optionally) other URLs, and **sends Slack alerts** on 404/500/503/timeouts, use the **pipeline monitor** in the `monitoring/` folder. It is designed to run on a schedule (e.g. GCP Cloud Scheduler + Cloud Function). See **`monitoring/MONITORING.md`** for env vars, what it checks, and how to deploy to GCP.

## Overview

- **Unit tests** – Critical logic (skin quiz scoring, quiz link utils) so regressions are caught on every PR.
- **E2E smoke tests** – App and key pages load; run in CI and optionally against production.
- **Error boundary** – React render errors are caught and reported (PostHog + optional Sentry).
- **Health check script** – Backend reachability and optional frontend build; usable from cron or CI.

## Running tests locally

```bash
# Unit tests (Vitest)
npm run test          # single run
npm run test:watch    # watch mode

# E2E tests (Playwright) – starts dev server automatically
npm run test:e2e      # headless
npm run test:e2e:ui   # UI mode for debugging

# Health check (backend + optional build)
npm run healthcheck
npm run healthcheck -- --build          # also run `npm run build`
npm run healthcheck -- --skip-backend   # only build, no backend ping
```

## Unit tests (Vitest)

- **Location:** `src/**/*.test.ts` and `src/**/*.spec.ts`
- **Coverage:** Focus on `src/data/skinTypeQuiz.ts` and `src/utils/skinQuizLink.ts`; extend as needed.
- **What’s covered:** Quiz scoring, result/profile, payload building, quiz link parsing and path helpers.

Add tests for new critical logic (e.g. new API payload shapes, new quiz or form logic) so CI keeps protecting you.

## E2E tests (Playwright)

- **Location:** `e2e/*.spec.ts`
- **Config:** `playwright.config.ts` (dev server auto-started when not in CI).
- **Current smoke tests:**
  - App loads and shows either login (“Access Dashboard”) or dashboard (nav link).
  - Standalone skin quiz page loads at `/skin-quiz?r=...&t=...`.

To run against a deployed URL (e.g. production smoke):

```bash
PLAYWRIGHT_BASE_URL=https://your-app.vercel.app npm run test:e2e
```

Do not set `webServer` when using `PLAYWRIGHT_BASE_URL` for production; the config already skips starting the dev server when a base URL is used for the tests. For scheduled production checks, run this in a cron job or scheduled workflow and alert on failure.

## Error boundary and reporting

- **Component:** `src/components/ErrorBoundary.tsx` wraps the app in `main.tsx`.
- **Behavior:** Catches React render errors, logs to console, and sends an `application_error` event to PostHog (when initialized) with message and component stack.
- **Optional Sentry (or other):** Implement `window.reportError(error, errorInfo)` and the boundary will call it. Example with Sentry:

  ```ts
  // In main.tsx or a small init module, after Sentry init:
  window.reportError = (error: Error, info: { componentStack?: string }) => {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  };
  ```

Use PostHog (or Sentry) to set up alerts on `application_error` / exceptions so you see breakage before users report it.

## Health check script

- **Script:** `scripts/healthcheck.js`
- **Backend:** Requests `GET {BACKEND_URL}/api/health`. If your backend doesn’t have `/api/health`, the script still runs and only logs a warning (CI does not fail by default). Add a health route on the backend for real reachability checks.
- **Env:** `VITE_BACKEND_API_URL` or `BACKEND_API_URL` for backend base URL.
- **Use cases:**
  - CI: `npm run healthcheck -- --build` to ensure build and optionally backend are OK.
  - Cron / scheduled job: run `node scripts/healthcheck.js` (with or without `--build`) and alert on exit code 1. To fail when the backend is down, uncomment the `failed = true` line in the script when the health request fails.

## CI (GitHub Actions)

- **Workflow:** `.github/workflows/ci.yml`
- **Triggers:** Push and PRs to `main` / `master`.
- **Jobs:**
  1. **lint-and-test:** Lint, unit tests, build.
  2. **e2e:** Playwright smoke tests (after lint-and-test), using Chromium.

Failing lint, tests, or build blocks the run; fix before merging.

## Full pipeline visibility (forms, Airtable, realtime)

- **Frontend:** Covered by unit tests (quiz, links), E2E smoke (app + quiz page), and the error boundary. Add more E2E tests for critical flows (e.g. “Send to Patient” with quiz link, opening client detail) as needed.
- **Backend / Airtable:** Not in this repo. Recommended:
  - Add a **health endpoint** (e.g. `GET /api/health`) on the dashboard backend that checks Airtable (and optionally Zapier/OpenPhone/Boulevard/Brevo) and returns 200 only when OK.
  - Run the **health check script** or the **pipeline monitor** on a schedule and alert on failure.
- **Realtime pipeline (GCP):** The pipeline in `my_project_cursor` (Jotform webhook on Cloud Run) already has `GET /health`. The **pipeline monitor** in `monitoring/` can check that URL plus frontend and backend; deploy it to GCP and point Cloud Scheduler at it for Slack alerts on 404/500/503 and timeouts.

### Pipeline monitor (GCP + Slack)

- **Location:** `monitoring/` (run with `node monitoring/run.js`).
- **Config:** Env vars: `SLACK_WEBHOOK_URL`, `FRONTEND_URL`, `BACKEND_API_URL`, `PIPELINE_HEALTH_URL`, and optional `CHECK_*_URL` for extra endpoints.
- **Behavior:** Hits each configured URL; expects 200 (and optional max latency). On any failure, posts to Slack and exits with code 1.
- **Deploy:** GCP Cloud Scheduler + Cloud Function (or Cloud Run Job). See **`monitoring/MONITORING.md`** for step-by-step and what each part of the pipeline (Jotform, Airtable, GCP, Zapier, OpenPhone, Boulevard, Brevo) can and can’t be checked.

## Quick checklist

- [ ] Run `npm run test` and `npm run test:e2e` before merging.
- [ ] In PostHog (or Sentry), set up alerts for `application_error` / exceptions.
- [ ] Add `GET /api/health` on the dashboard backend (and optionally have it verify Airtable / integrations).
- [ ] Set up the **pipeline monitor** (`monitoring/`) with `SLACK_WEBHOOK_URL` and deploy to GCP; add a Cloud Scheduler job to run it every 5–15 minutes.
- [ ] Use scheduled runs of the health script and/or E2E against production for ongoing visibility.
