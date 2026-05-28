/**
 * Local static server for the clinic deck (replaces python3 -m http.server).
 * - Serves repo root so /docs/presentations/clinic-demo-deck.html works
 * - HTTP Range support for video (fewer aborted full-file transfers)
 * - Ignores client disconnects (no BrokenPipe stack traces)
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.DECK_PORT || 4177);
const DECK_PATH = "/docs/presentations/clinic-demo-deck.html";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const rel = decoded.replace(/^\/+/, "") || "index.html";
  const abs = path.resolve(ROOT, rel);
  if (!abs.startsWith(ROOT)) return null;
  return abs;
}

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  if (body) res.end(body);
  else res.end();
}

function pipeWithDisconnectGuard(res, stream) {
  stream.on("error", (err) => {
    if (err.code === "ENOENT") {
      if (!res.headersSent) send(res, 404, { "Content-Type": "text/plain" }, "Not found");
      else res.end();
      return;
    }
    if (!res.headersSent) send(res, 500, { "Content-Type": "text/plain" }, "Server error");
    else res.end();
  });
  stream.on("open", () => stream.pipe(res));
  res.on("close", () => {
    if (!stream.destroyed) stream.destroy();
  });
  res.on("error", () => {
    if (!stream.destroyed) stream.destroy();
  });
}

function serveFile(req, res, filePath) {
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    send(res, 404, { "Content-Type": "text/plain" }, "Not found");
    return;
  }
  if (stat.isDirectory()) {
    send(res, 404, { "Content-Type": "text/plain" }, "Not found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  const range = req.headers.range;

  if (range && /^bytes=\d*-\d*$/.test(range)) {
    const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
    const start = startStr ? parseInt(startStr, 10) : 0;
    const end = endStr ? parseInt(endStr, 10) : stat.size - 1;
    if (start >= stat.size || end >= stat.size || start > end) {
      send(res, 416, {
        "Content-Range": `bytes */${stat.size}`,
        "Content-Type": type,
      });
      return;
    }
    const chunkSize = end - start + 1;
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": type,
    });
    const stream = fs.createReadStream(filePath, { start, end });
    pipeWithDisconnectGuard(res, stream);
    return;
  }

  res.writeHead(200, {
    "Content-Type": type,
    "Content-Length": stat.size,
    "Accept-Ranges": "bytes",
  });
  pipeWithDisconnectGuard(res, fs.createReadStream(filePath));
}

const server = http.createServer((req, res) => {
  if (req.url === "/" || req.url === "/deck") {
    res.writeHead(302, { Location: DECK_PATH });
    res.end();
    return;
  }

  const filePath = safePath(req.url || "/");
  if (!filePath) {
    send(res, 403, { "Content-Type": "text/plain" }, "Forbidden");
    return;
  }

  serveFile(req, res, filePath);
});

server.listen(PORT, () => {
  console.log(`Deck server → http://localhost:${PORT}${DECK_PATH}`);
  console.log(`(Production build: npm run deck:preview → http://localhost:${PORT}/)`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is in use. Stop the other server (Ctrl+C) or run: DECK_PORT=4178 npm run deck`,
    );
    process.exit(1);
  }
  throw err;
});

server.on("clientError", () => {
  /* browser cancelled a connection */
});
