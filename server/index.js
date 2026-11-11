// Agent Monitor server: receives raw agent events, standardizes them, stores them,
// and pushes them live to the dashboard over Server-Sent Events (SSE).
// Uses only Node's built-in modules, so it runs with no `npm install`.
require("./env"); // load .env before anything reads process.env
const http = require("http");
const fs = require("fs");
const path = require("path");
const store = require("./store");
const { normalizeClaudeCode } = require("./adapters/claude-code");
const { normalizeCodex } = require("./adapters/codex");

const PORT = Number(process.env.PORT) || 4000;
const WEB_DIR = path.join(__dirname, "..", "web");
const clients = new Set(); // open SSE connections

const adapters = {
  "claude-code": (body) => normalizeClaudeCode(body),
  codex: (body) => normalizeCodex(body.event || body, body.sessionId),
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    // POST /events/:agent  ← hooks and runners send raw payloads here
    const match = url.pathname.match(/^\/events\/([\w-]+)$/);
    if (req.method === "POST" && match) {
      const agent = match[1];
      const adapter = adapters[agent];
      if (!adapter) return send(res, 404, { error: `Unknown agent "${agent}"` });

      const body = await readJson(req);
      store.saveRaw(agent, body);
      const event = adapter(body);
      if (event) {
        // Show it live even if saving fails, but report the save error clearly
        broadcast(event);
        console.log(`[${agent}] ${event.type.padEnd(13)} ${event.summary}`);
        try {
          await store.add(event);
        } catch (err) {
          console.error(`  ✗ not saved: ${err.message}`);
        }
      }
      return send(res, 200, { ok: true, id: event?.id ?? null });
    }

    // GET /api/events  ← dashboard loads history on page open
    if (req.method === "GET" && url.pathname === "/api/events") {
      return send(res, 200, await store.list());
    }

    // DELETE /api/events  ← clear the feed between test runs
    if (req.method === "DELETE" && url.pathname === "/api/events") {
      await store.clear();
      broadcast({ type: "__cleared" });
      return send(res, 200, { ok: true });
    }

    // GET /stream  ← live updates (Server-Sent Events)
    if (req.method === "GET" && url.pathname === "/stream") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(": connected\n\n");
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }

    // Anything else: serve the dashboard files from web/
    if (req.method === "GET") return serveStatic(url.pathname, res);

    send(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    send(res, 400, { error: err.message });
  }
});

function broadcast(event) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) client.write(data);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) reject(new Error("Payload too large"));
    });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error("Body is not valid JSON")); }
    });
    req.on("error", reject);
  });
}

function send(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png" };

function serveStatic(pathname, res) {
  const file = path.normalize(path.join(WEB_DIR, pathname === "/" ? "index.html" : pathname));
  if (!file.startsWith(WEB_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    return send(res, 404, { error: "Not found" });
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}

// Keep SSE connections alive through proxies
setInterval(() => clients.forEach((c) => c.write(": ping\n\n")), 25000);

server.listen(PORT, () => {
  console.log(`Agent Monitor running → http://localhost:${PORT}`);
  console.log(`  Storing events in ${store.name}`);
  console.log(`  Claude Code hooks POST to /events/claude-code`);
  console.log(`  Codex runner POSTs to    /events/codex`);
});
