// Supabase event store.
// Talks to Supabase's REST API (PostgREST) with plain fetch, so no extra
// package is needed. Uses the service_role key, which is only ever used here on
// the server — never send it to the browser.
const fileStore = require("./file"); // raw payloads are still kept locally for the report

const URL_BASE = process.env.SUPABASE_URL?.replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const knownSessions = new Set();

async function rest(path, { method = "GET", body, prefer } = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Supabase ${method} ${path.split("?")[0]} failed (${res.status}): ${detail}`);
  }
  return res.status === 204 ? null : res.json().catch(() => null);
}

// events.session_id references sessions.id, so make sure the session row exists first.
async function ensureSession(event) {
  const key = `${event.agent}:${event.sessionId}`;
  if (knownSessions.has(key)) return;
  await rest("sessions?on_conflict=id", {
    method: "POST",
    prefer: "resolution=ignore-duplicates,return=minimal",
    body: { id: event.sessionId, agent: event.agent, project_path: event.cwd, started_at: event.timestamp },
  });
  knownSessions.add(key);
}

async function add(event) {
  await ensureSession(event);
  await rest("events", {
    method: "POST",
    prefer: "return=minimal",
    body: {
      id: event.id,
      session_id: event.sessionId,
      agent: event.agent,
      type: event.type,
      status: event.status,
      summary: event.summary,
      raw: event.raw,
      created_at: event.timestamp,
    },
  });
  if (event.type === "task_done") {
    await rest(`sessions?id=eq.${encodeURIComponent(event.sessionId)}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: { ended_at: event.timestamp },
    });
  }
}

async function list({ limit = 500 } = {}) {
  // raw is left out: it can be large and the dashboard doesn't need it
  const rows = await rest(
    `events?select=id,session_id,agent,type,status,summary,created_at,sessions(project_path)&order=created_at.desc&limit=${limit}`
  );
  return rows.reverse().map((r) => ({
    id: r.id,
    agent: r.agent,
    sessionId: r.session_id,
    timestamp: r.created_at,
    type: r.type,
    status: r.status,
    summary: r.summary,
    cwd: r.sessions?.project_path ?? null,
  }));
}

async function clear() {
  // PostgREST refuses a DELETE without a filter, so "id is not null" means "all rows"
  await rest("events?id=not.is.null", { method: "DELETE", prefer: "return=minimal" });
  await rest("sessions?id=not.is.null", { method: "DELETE", prefer: "return=minimal" });
  knownSessions.clear();
}

module.exports = { name: `Supabase (${URL_BASE})`, add, saveRaw: fileStore.saveRaw, list, clear };
