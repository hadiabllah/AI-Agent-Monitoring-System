// Tests the Supabase store against a fake Supabase REST server (no account needed).
const test = require("node:test");
const assert = require("node:assert");
const http = require("node:http");

const requests = [];
let failNext = false;

const fake = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    requests.push({ method: req.method, url: req.url, headers: req.headers, body: body ? JSON.parse(body) : null });
    if (failNext) {
      failNext = false;
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: "violates check constraint" }));
    }
    if (req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify([
        { id: "e2", session_id: "s1", agent: "codex", type: "task_done", status: "completed", summary: "Done", created_at: "2026-11-09T10:00:02Z", sessions: { project_path: "/app" } },
        { id: "e1", session_id: "s1", agent: "codex", type: "command", status: "completed", summary: "$ ls", created_at: "2026-11-09T10:00:01Z", sessions: { project_path: "/app" } },
      ]));
    }
    res.writeHead(201);
    res.end();
  });
});

let store;
test.before(async () => {
  await new Promise((r) => fake.listen(0, r));
  process.env.SUPABASE_URL = `http://localhost:${fake.address().port}/`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  store = require("../server/store");
});
test.after(() => fake.close());
test.beforeEach(() => (requests.length = 0));

const event = (over = {}) => ({
  id: "11111111-1111-1111-1111-111111111111", agent: "codex", sessionId: "s1",
  timestamp: "2026-11-09T10:00:00Z", type: "command", status: "completed",
  summary: "$ ls", cwd: "/app", raw: { a: 1 }, ...over,
});

test("store/index picks Supabase when keys are set", () => {
  assert.match(store.name, /^Supabase/);
});

test("add() creates the session once, then inserts events with the right columns", async () => {
  await store.add(event());
  await store.add(event({ id: "22222222-2222-2222-2222-222222222222" }));
  const sessionPosts = requests.filter((r) => r.url.startsWith("/rest/v1/sessions"));
  const eventPosts = requests.filter((r) => r.url === "/rest/v1/events");
  assert.strictEqual(sessionPosts.length, 1, "session should only be created once");
  assert.match(sessionPosts[0].headers.prefer, /ignore-duplicates/);
  assert.deepStrictEqual(sessionPosts[0].body, { id: "s1", agent: "codex", project_path: "/app", started_at: "2026-11-09T10:00:00Z" });
  assert.strictEqual(eventPosts.length, 2);
  assert.strictEqual(eventPosts[0].body.session_id, "s1");
  assert.strictEqual(eventPosts[0].body.created_at, "2026-11-09T10:00:00Z");
  assert.strictEqual(eventPosts[0].headers.apikey, "test-key");
  assert.strictEqual(eventPosts[0].headers.authorization, "Bearer test-key");
});

test("task_done marks the session as ended", async () => {
  await store.add(event({ id: "33333333-3333-3333-3333-333333333333", type: "task_done" }));
  const patch = requests.find((r) => r.method === "PATCH");
  assert.ok(patch, "expected a PATCH to sessions");
  assert.strictEqual(patch.url, "/rest/v1/sessions?id=eq.s1");
  assert.deepStrictEqual(patch.body, { ended_at: "2026-11-09T10:00:00Z" });
});

test("list() returns events oldest-first in the standard format", async () => {
  const events = await store.list();
  assert.deepStrictEqual(events.map((e) => e.id), ["e1", "e2"]);
  assert.deepStrictEqual(Object.keys(events[0]).sort(), ["agent", "cwd", "id", "sessionId", "status", "summary", "timestamp", "type"]);
  assert.strictEqual(events[0].cwd, "/app");
});

test("clear() deletes events and sessions with a filter", async () => {
  await store.clear();
  const deletes = requests.filter((r) => r.method === "DELETE").map((r) => r.url);
  assert.deepStrictEqual(deletes, ["/rest/v1/events?id=not.is.null", "/rest/v1/sessions?id=not.is.null"]);
});

test("a Supabase error is thrown with its message", async () => {
  failNext = true;
  await assert.rejects(store.add(event({ sessionId: "s-new" })), /failed \(400\).*check constraint/);
});
