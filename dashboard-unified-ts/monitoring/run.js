#!/usr/bin/env node
/**
 * Pipeline monitor: hit multiple endpoints, enforce status + optional latency, alert on Slack.
 *
 * Config via env (see MONITORING.md):
 *   CHECK_*_URL, CHECK_*_NAME (optional), CHECK_*_MAX_MS (optional)
 *   SLACK_WEBHOOK_URL - if set, post failures (and optional all-OK) to Slack
 *   BACKEND_API_URL, PIPELINE_HEALTH_URL, FRONTEND_URL - shortcuts for common checks
 *
 * Exit code: 0 if all pass, 1 if any fail (for cron/GCP to alert).
 */

const TIMEOUT_MS = Number(process.env.MONITOR_TIMEOUT_MS) || 15000;

function getChecksFromEnv() {
  const checks = [];
  const seen = new Set();

  // Shortcuts (optional)
  const backendUrl = process.env.BACKEND_API_URL || process.env.VITE_BACKEND_API_URL || "https://ponce-patient-backend.vercel.app";
  const pipelineUrl = process.env.PIPELINE_HEALTH_URL;
  const frontendUrl = process.env.FRONTEND_URL;

  if (frontendUrl) {
    checks.push({
      name: "Vercel frontend",
      url: frontendUrl.replace(/\/$/, ""),
      expectedStatus: 200,
      maxLatencyMs: Number(process.env.CHECK_FRONTEND_MAX_MS) || 10000,
    });
  }

  if (backendUrl) {
    checks.push({
      name: "Dashboard backend (Vercel)",
      url: `${backendUrl.replace(/\/$/, "")}/api/health`,
      expectedStatus: 200,
      maxLatencyMs: Number(process.env.CHECK_BACKEND_MAX_MS) || 8000,
      allow404: process.env.CHECK_BACKEND_ALLOW_404 !== "0", // set to 0 once backend has /api/health
    });
  }

  if (pipelineUrl) {
    checks.push({
      name: "Realtime pipeline (GCP Cloud Run)",
      url: `${pipelineUrl.replace(/\/$/, "")}/health`,
      expectedStatus: 200,
      maxLatencyMs: Number(process.env.CHECK_PIPELINE_MAX_MS) || 10000,
    });
  }

  // Generic CHECK_*_URL / CHECK_*_NAME / CHECK_*_MAX_MS
  for (const key of Object.keys(process.env)) {
    if (!key.startsWith("CHECK_") || !key.endsWith("_URL")) continue;
    const base = key.slice(0, -4);
    const url = process.env[key];
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const nameKey = `${base}_NAME`;
    const maxMsKey = `${base}_MAX_MS`;
    checks.push({
      name: process.env[nameKey] || base.replace(/_/g, " "),
      url: url.replace(/\/$/, ""),
      expectedStatus: 200,
      maxLatencyMs: process.env[maxMsKey] ? Number(process.env[maxMsKey]) : 10000,
      allow404: process.env[`${base}_ALLOW_404`] === "1",
    });
  }

  return checks;
}

async function runOne(check) {
  const start = Date.now();
  let status;
  let body = "";
  let errMsg = null;
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), check.maxLatencyMs || TIMEOUT_MS);
    const res = await fetch(check.url, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json, text/html, */*" },
    });
    clearTimeout(id);
    status = res.status;
    body = await res.text();
    const latencyMs = Date.now() - start;

    if (check.allow404 && status === 404) {
      return { ok: true, name: check.name, status, latencyMs, note: "404 allowed (endpoint not implemented)" };
    }
    if (status !== (check.expectedStatus || 200)) {
      return { ok: false, name: check.name, status, latencyMs, body: body.slice(0, 200) };
    }
    if (check.maxLatencyMs && latencyMs > check.maxLatencyMs) {
      return { ok: false, name: check.name, status, latencyMs, body: `Latency ${latencyMs}ms > ${check.maxLatencyMs}ms` };
    }
    return { ok: true, name: check.name, status, latencyMs };
  } catch (e) {
    errMsg = e?.message || String(e);
    const latencyMs = Date.now() - start;
    return { ok: false, name: check.name, status: null, latencyMs, body: errMsg };
  }
}

async function runAll(checks) {
  const results = await Promise.all(checks.map(runOne));
  const failed = results.filter((r) => !r.ok);
  const passed = results.filter((r) => r.ok);
  return { passed, failed, results };
}

function slackMessage(failed, passed, options = {}) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return null;

  const blocks = [];
  if (failed.length > 0) {
    blocks.push({
      type: "header",
      text: { type: "plain_text", text: "Pipeline monitor: failures", emoji: true },
    });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: failed
          .map(
            (r) =>
              `• *${r.name}*: ${r.status != null ? `HTTP ${r.status}` : "error"} ${r.latencyMs ? `(${r.latencyMs}ms)` : ""}\n  ${(r.body || "").slice(0, 300).replace(/\n/g, " ")}`
          )
          .join("\n"),
      },
    });
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: `Passed: ${passed.length} | Failed: ${failed.length} | Run: ${new Date().toISOString()}` }],
    });
  } else if (process.env.SLACK_ALERT_ON_SUCCESS === "1") {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `All pipeline checks passed (${passed.length}). Run: ${new Date().toISOString()}`,
      },
    });
  }

  if (blocks.length === 0) return null;
  const text = failed.length > 0
    ? `Pipeline monitor: ${failed.length} failure(s) – ${failed.map((r) => r.name).join(", ")}`
    : `Pipeline monitor: all ${passed.length} checks passed.`;
  return { text, blocks };
}

async function postSlack(payload) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl || !payload) return;
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error("[monitor] Slack post failed:", res.status, await res.text());
  } catch (e) {
    console.error("[monitor] Slack post error:", e?.message);
  }
}

async function main() {
  const checks = getChecksFromEnv();
  if (checks.length === 0) {
    console.log("[monitor] No checks configured. Set FRONTEND_URL, BACKEND_API_URL, PIPELINE_HEALTH_URL or CHECK_*_URL.");
    process.exit(0);
  }

  console.log("[monitor] Running", checks.length, "checks...");
  const { passed, failed, results } = await runAll(checks);

  for (const r of results) {
    const icon = r.ok ? "✓" : "✗";
    const status = r.status != null ? r.status : "error";
    const lat = r.latencyMs != null ? ` ${r.latencyMs}ms` : "";
    console.log(`[monitor] ${icon} ${r.name}: ${status}${lat}${r.note ? ` (${r.note})` : ""}`);
    if (!r.ok && r.body) console.log(`[monitor]   ${r.body.slice(0, 150)}`);
  }

  const payload = slackMessage(failed, passed);
  if (payload) await postSlack(payload);

  if (failed.length > 0) {
    console.error("[monitor] Failures:", failed.length);
    process.exit(1);
  }
  console.log("[monitor] All checks passed.");
}

main().catch((e) => {
  console.error("[monitor] Fatal:", e);
  if (process.env.SLACK_WEBHOOK_URL) {
    postSlack({
      text: `Pipeline monitor fatal error: ${e?.message || String(e)}. Check GCP logs.`,
    }).catch(() => {});
  }
  process.exit(1);
});
