import { useMemo, useState } from "react";
import { AGENTS, AGENT_NAMES } from "../constants.js";
import { buildSessions, shortPath, timeAgo, useNow } from "../lib.js";
import { useProfile, useSettings } from "../settings.jsx";

const COLORS = [["claude", "Blue"], ["codex", "Orange"], ["ink", "Ink"]];
const HEATMAP_WEEKS = 26;
const DAY = 86400e3;

// Local calendar day, e.g. "2026-11-12".
const dayKey = (t) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const startOfDay = (t) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

function initials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export default function UserPage({ events }) {
  const { profile, update } = useProfile();
  const { settings } = useSettings();
  const now = useNow(60000);
  const stats = useMemo(() => computeStats(events, now, settings.idleMinutes * 60e3), [events, now, settings.idleMinutes]);
  const displayName = profile.name.trim() || "You";

  return (
    <div className="user-layout">
      <section className="card user-hero">
        <div className={`avatar big ${profile.color}`} aria-hidden="true">
          {initials(profile.name) || <PersonIcon />}
        </div>
        <div className="user-id">
          <h1>{displayName}</h1>
          <p className="muted">
            {profile.role.trim() && <>{profile.role.trim()} · </>}
            {stats.first ? `Using agents since ${new Date(stats.first).toLocaleDateString(undefined, { dateStyle: "medium" })}` : "No agent activity recorded yet"}
          </p>
        </div>
        <ProfileForm profile={profile} onChange={update} />
      </section>

      <section className="kpis" aria-label="Your totals">
        <Tile label="Prompts sent" value={stats.prompts} />
        <Tile label="Sessions" value={stats.sessions.length} note={`${stats.activeNow} active now`} />
        <Tile label="Projects" value={stats.projects.length} />
        <Tile label="Tasks done" value={stats.tasksDone} />
        <Tile label="Active days" value={stats.activeDays} />
        <Tile label="Current streak" value={stats.streak} unit={stats.streak === 1 ? "day" : "days"} note={`Longest ${stats.longest} ${stats.longest === 1 ? "day" : "days"}`} />
      </section>

      <Heatmap days={stats.days} now={now} />

      <div className="user-grid">
        <AgentSplit perAgent={stats.perAgent} />
        <TopProjects projects={stats.projects} now={now} />
      </div>

      <RecentPrompts prompts={stats.recentPrompts} now={now} />
    </div>
  );
}

function computeStats(events, now, idleMs) {
  const sessions = buildSessions(events, now, idleMs);
  const days = new Map();
  const perAgent = Object.fromEntries(AGENTS.map((a) => [a, { prompts: 0, sessions: 0, events: 0 }]));
  const projects = new Map();
  let prompts = 0;
  let tasksDone = 0;
  let first = null;

  for (const e of events) {
    const t = new Date(e.timestamp).getTime();
    if (first === null || t < first) first = t;
    const k = dayKey(t);
    days.set(k, (days.get(k) || 0) + 1);
    const a = (perAgent[e.agent] ||= { prompts: 0, sessions: 0, events: 0 });
    a.events++;
    if (e.type === "prompt") {
      prompts++;
      a.prompts++;
    }
    if (e.type === "task_done") tasksDone++;
  }

  for (const s of sessions) {
    (perAgent[s.agent] ||= { prompts: 0, sessions: 0, events: 0 }).sessions++;
    if (!s.cwd) continue;
    // Windows hooks report the drive letter in either case ("c:\..." and "C:\...").
    const key = s.cwd.replace(/^([a-z]):/i, (_, d) => `${d.toUpperCase()}:`);
    const p = projects.get(key) || { cwd: key, sessions: 0, events: 0, last: s.last, agents: new Set() };
    p.sessions++;
    p.events += s.count;
    p.agents.add(s.agent);
    if (s.last > p.last) p.last = s.last;
    projects.set(key, p);
  }

  // Streaks count consecutive calendar days with any activity. Today without activity
  // yet doesn't break the current streak.
  let streak = 0;
  for (let d = startOfDay(now) - (days.has(dayKey(now)) ? 0 : DAY); days.has(dayKey(d)); d -= DAY) streak++;
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const k of [...days.keys()].sort()) {
    const t = new Date(`${k}T00:00:00`).getTime();
    run = prev !== null && Math.round((t - prev) / DAY) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = t;
  }

  const recentPrompts = events.filter((e) => e.type === "prompt").slice(-8).reverse();

  return {
    sessions,
    activeNow: sessions.filter((s) => s.state === "active").length,
    days,
    perAgent,
    projects: [...projects.values()].sort((a, b) => b.sessions - a.sessions || (a.last < b.last ? 1 : -1)),
    prompts,
    tasksDone,
    first,
    activeDays: days.size,
    streak,
    longest,
    recentPrompts,
  };
}

function ProfileForm({ profile, onChange }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="btn user-edit" onClick={() => setOpen(true)}>
        Edit profile
      </button>
    );
  }
  return (
    <form className="user-form" onSubmit={(e) => { e.preventDefault(); setOpen(false); }}>
      <label>
        <span>Name</span>
        <input className="input" value={profile.name} maxLength={60} placeholder="Your name" autoFocus onChange={(e) => onChange({ name: e.target.value })} />
      </label>
      <label>
        <span>Role</span>
        <input className="input" value={profile.role} maxLength={60} placeholder="e.g. Full-stack developer" onChange={(e) => onChange({ role: e.target.value })} />
      </label>
      <div className="user-form-row">
        <span>Avatar colour</span>
        <div className="seg small" role="group" aria-label="Avatar colour">
          {COLORS.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={profile.color === id} onClick={() => onChange({ color: id })}>
              <span className={`avatar dot ${id}`} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="muted">Saved in this browser only.</p>
      <button type="submit" className="btn">Done</button>
    </form>
  );
}

function Tile({ label, value, unit, note }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">
        {value.toLocaleString()}
        {unit && <span className="kpi-unit"> {unit}</span>}
      </div>
      {note && <div className="kpi-note">{note}</div>}
    </div>
  );
}

// GitHub-style calendar: one column per week, one cell per day, shaded by event count.
function Heatmap({ days, now }) {
  const today = startOfDay(now);
  const weekday = (new Date(today).getDay() + 6) % 7; // Monday = 0
  const start = today - (weekday + (HEATMAP_WEEKS - 1) * 7) * DAY;
  const cells = [];
  let max = 0;
  for (let t = start; t <= today; t += DAY) {
    const d = startOfDay(t + DAY / 2); // stays on the right day across DST changes
    const n = days.get(dayKey(d)) || 0;
    max = Math.max(max, n);
    cells.push({ t: d, n });
  }
  const level = (n) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));
  const total = cells.reduce((s, c) => s + c.n, 0);
  const active = cells.filter((c) => c.n).length;

  const months = [];
  for (let w = 0; w < HEATMAP_WEEKS; w++) {
    const c = cells[w * 7];
    if (!c) break;
    const m = new Date(c.t).getMonth();
    if (w === 0 || m !== new Date(cells[(w - 1) * 7].t).getMonth()) {
      // A new month starting right after the first column would overlap its label.
      if (months.length && w - months[months.length - 1].w < 3) months.pop();
      months.push({ w, label: new Date(c.t).toLocaleDateString(undefined, { month: "short" }) });
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>Activity</h2>
        <span className="muted">{total.toLocaleString()} events on {active} days, last {HEATMAP_WEEKS} weeks</span>
      </div>
      <div className="heatmap-wrap">
        <div className="heatmap" style={{ "--weeks": HEATMAP_WEEKS }}>
          <div className="heatmap-months" aria-hidden="true">
            {months.map((m) => (
              <span key={m.w} style={{ gridColumn: m.w + 1 }}>{m.label}</span>
            ))}
          </div>
          <div className="heatmap-days" aria-hidden="true">
            <span>Mon</span><span /><span>Wed</span><span /><span>Fri</span><span /><span />
          </div>
          <div className="heatmap-grid" role="img" aria-label={`Activity calendar: ${total} events on ${active} days`}>
            {cells.map((c) => (
              <span
                key={c.t}
                className={`heat l${level(c.n)}`}
                title={`${c.n} ${c.n === 1 ? "event" : "events"} on ${new Date(c.t).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="heatmap-legend muted" aria-hidden="true">
        Less {[0, 1, 2, 3, 4].map((l) => <span key={l} className={`heat l${l}`} />)} More
      </div>
    </section>
  );
}

function AgentSplit({ perAgent }) {
  const rows = Object.entries(perAgent);
  const max = Math.max(1, ...rows.map(([, a]) => a.prompts));
  return (
    <section className="card">
      <div className="card-head">
        <h2>Prompts by agent</h2>
      </div>
      <ul className="hbars agent-bars">
        {rows.map(([agent, a]) => (
          <li key={agent} title={`${AGENT_NAMES[agent] || agent}: ${a.prompts} prompts, ${a.sessions} sessions`}>
            <span className="hbar-label"><span className={`swatch ${agent}`} aria-hidden="true" /> {AGENT_NAMES[agent] || agent}</span>
            <span className="hbar-track">
              <span className={`hbar-fill ${agent}`} style={{ width: `${(a.prompts / max) * 100}%` }} />
            </span>
            <span className="hbar-value">{a.prompts}</span>
            <span className="agent-sub muted">{a.sessions} sessions · {a.events.toLocaleString()} events</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TopProjects({ projects, now }) {
  return (
    <section className="card">
      <div className="card-head">
        <h2>Top projects</h2>
        <span className="muted">{projects.length} total</span>
      </div>
      {projects.length === 0 ? (
        <p className="muted pad">No projects yet.</p>
      ) : (
        <ul className="user-list">
          {projects.slice(0, 6).map((p) => (
            <li key={p.cwd}>
              <span className="user-list-main mono" title={p.cwd}>{shortPath(p.cwd)}</span>
              <span className="user-list-swatches" aria-label={[...p.agents].map((a) => AGENT_NAMES[a] || a).join(", ")}>
                {[...p.agents].map((a) => <span key={a} className={`swatch ${a}`} />)}
              </span>
              <span className="muted">{p.sessions} {p.sessions === 1 ? "session" : "sessions"}</span>
              <span className="muted right">{timeAgo(p.last, now)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentPrompts({ prompts, now }) {
  return (
    <section className="card">
      <div className="card-head">
        <h2>Recent prompts</h2>
      </div>
      {prompts.length === 0 ? (
        <p className="muted pad">Prompts you send to Claude Code or Codex show up here.</p>
      ) : (
        <ul className="user-list prompts">
          {prompts.map((e) => (
            <li key={e.id}>
              <span className={`swatch ${e.agent}`} title={AGENT_NAMES[e.agent] || e.agent} />
              <span className="user-list-main">{e.summary}</span>
              {e.cwd && <span className="muted mono hide-sm">{shortPath(e.cwd)}</span>}
              <span className="muted right">{timeAgo(e.timestamp, now)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28">
      <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
