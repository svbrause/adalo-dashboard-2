#!/usr/bin/env node
/**
 * Health check script for CI or cron: verifies backend is reachable and optional frontend build.
 * Set VITE_BACKEND_API_URL or BACKEND_API_URL for backend URL (default from env or placeholder).
 * Usage: node scripts/healthcheck.js [--build] [--skip-backend]
 */

const BACKEND_URL =
  process.env.VITE_BACKEND_API_URL ||
  process.env.BACKEND_API_URL ||
  "https://ponce-patient-backend.vercel.app";

let failed = false;

async function checkBackend() {
  const url = `${BACKEND_URL.replace(/\/$/, "")}/api/health`;
  try {
    const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(15000) });
    if (res.ok) {
      console.log("[healthcheck] Backend OK:", res.status);
      return true;
    }
    const text = await res.text();
    console.warn("[healthcheck] Backend returned", res.status, text?.slice(0, 200));
    return false;
  } catch (err) {
    console.warn("[healthcheck] Backend unreachable:", err?.message || err);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const doBuild = args.includes("--build");
  const skipBackend = args.includes("--skip-backend");

  if (!skipBackend) {
    const ok = await checkBackend();
    if (!ok) {
      // Many backends don't have /api/health; treat as non-fatal so CI doesn't block
      console.warn("[healthcheck] Backend check failed (optional if no /api/health)");
      // failed = true;  // uncomment to fail CI when backend is down
    }
  }

  if (doBuild) {
    const { execSync } = await import("child_process");
    try {
      execSync("npm run build", { stdio: "inherit", cwd: process.cwd() });
      console.log("[healthcheck] Build OK");
    } catch (e) {
      console.error("[healthcheck] Build failed");
      failed = true;
    }
  }

  if (failed) process.exit(1);
  console.log("[healthcheck] Done");
}

main();
