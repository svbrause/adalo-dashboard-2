/**
 * HTTP entrypoint for GCP Cloud Function (2nd gen).
 * Scheduler calls this URL; we run the monitor and return 200/500.
 * Set function entry point to "monitorHttp" and trigger to HTTP.
 */

import { exec } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function monitorHttp(req, res) {
  const cwd = path.resolve(__dirname);
  exec("node run.js", { cwd, env: process.env, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
    const out = [stdout, stderr].filter(Boolean).join("\n");
    if (err && err.code !== 0) {
      res.status(500).send(out || err.message);
      return;
    }
    res.status(200).send(out || "OK");
  });
}
