import { useEffect, useState } from "react";

export const sessionKey = (e) => `${e.agent}:${e.sessionId}`;

export const TYPE_LABELS = {
  session_start: "Session start",
  prompt: "Prompt",
  plan: "Plan",
  file_read: "File read",
  file_edit: "File edit",
  command: "Command",
  test: "Test",
  search: "Search",
  message: "Message",
  waiting: "Waiting",
  task_done: "Task done",
  session_end: "Session end",
  error: "Error",
  other: "Other",
};

export const RANGES = [
  { id: "15m", label: "15 min", ms: 15 * 60e3 },
  { id: "1h", label: "1 hour", ms: 60 * 60e3 },
  { id: "24h", label: "24 hours", ms: 24 * 60 * 60e3 },
  { id: "all", label: "All time", ms: null },
];

// Re-renders every `ms` so relative times ("2m ago") stay current.
export function useNow(ms = 15000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function timeAgo(ts, now) {
  const s = Math.max(0, Math.round((now - new Date(ts).getTime()) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function formatDuration(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// Session states, in the words shown on the dashboard:
//   active  events arrived recently
//   paused  the agent stopped to wait for your permission or answer
//   idle    no events for a while, but the session never said it finished
//   done    the agent finished its last task and is ready for another prompt
//   ended   the session was closed (Claude Code exited / the Codex run finished)
export const STATE_LABELS = { active: "Active", paused: "Paused", idle: "Idle", done: "Done", ended: "Ended" };
export const STATE_HINTS = {
  active: "Working: events arrived in the last few minutes",
  paused: "Paused: waiting for your permission or input",
  idle: "Idle: no new events for a while",
  done: "Done: finished its last task",
  ended: "Ended: the session was closed",
};

// Groups events into sessions, newest activity first.
export function buildSessions(events, now, idleMs = 5 * 60e3) {
  const map = new Map();
  for (const e of events) {
    const k = sessionKey(e);
    let s = map.get(k);
    if (!s) {
      s = { key: k, agent: e.agent, sessionId: e.sessionId, cwd: null, count: 0, errors: 0, done: false, first: e.timestamp, last: e.timestamp, lastSummary: "", lastType: e.type };
      map.set(k, s);
    }
    s.count++;
    if (e.cwd) s.cwd = e.cwd;
    if (e.type === "error") s.errors++;
    if (e.type === "task_done") s.done = true;
    else if (e.type === "prompt") s.done = false;
    if (e.timestamp < s.first) s.first = e.timestamp;
    if (e.timestamp >= s.last) {
      s.last = e.timestamp;
      s.lastSummary = e.summary;
      s.lastType = e.type;
    }
  }
  return [...map.values()]
    .map((s) => {
      const idle = now - new Date(s.last).getTime();
      // The latest event decides paused/ended; any later event (approval given,
      // session resumed) moves the session back to its normal state.
      s.state =
        s.lastType === "session_end" ? "ended"
        : s.lastType === "waiting" ? "paused"
        : s.done ? "done"
        : idle < idleMs ? "active"
        : "idle";
      return s;
    })
    .sort((a, b) => (a.last < b.last ? 1 : -1));
}

// Splits [start, end] into ~`count` buckets and counts events per agent.
export function bucketize(events, start, end, agents, count = 36) {
  const span = Math.max(end - start, 60e3);
  const size = span / count;
  const buckets = Array.from({ length: count }, (_, i) => {
    const b = { start: start + i * size, end: start + (i + 1) * size, total: 0 };
    for (const a of agents) b[a] = 0;
    return b;
  });
  for (const e of events) {
    const t = new Date(e.timestamp).getTime();
    let i = Math.floor((t - start) / size);
    if (i === count) i = count - 1;
    if (i < 0 || i >= count) continue;
    buckets[i][e.agent] = (buckets[i][e.agent] || 0) + 1;
    buckets[i].total++;
  }
  return buckets;
}

export function shortPath(p) {
  if (!p) return "";
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts.slice(-2).join("/");
}
