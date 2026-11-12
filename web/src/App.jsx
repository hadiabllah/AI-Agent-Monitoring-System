import { useEffect, useMemo, useRef, useState } from "react";
import { useEvents } from "./useEvents.js";
import { AGENTS, AGENT_NAMES } from "./constants.js";
import { RANGES, buildSessions, sessionKey, useNow } from "./lib.js";
import { useRoute, useSettings } from "./settings.jsx";
import TopBar from "./components/TopBar.jsx";
import Filters from "./components/Filters.jsx";
import Kpis from "./components/Kpis.jsx";
import ActivityChart from "./components/ActivityChart.jsx";
import TypeBreakdown from "./components/TypeBreakdown.jsx";
import Sessions from "./components/Sessions.jsx";
import Feed from "./components/Feed.jsx";
import EventDrawer from "./components/EventDrawer.jsx";
import SettingsPage from "./components/SettingsPage.jsx";
import UserPage from "./components/UserPage.jsx";

export default function App() {
  const { events, conn, clear, deleteSession, loaded } = useEvents();
  const { settings } = useSettings();
  const route = useRoute();
  useErrorNotifications(events, loaded, settings.notifyErrors);

  return (
    <div className="app">
      <TopBar conn={conn} route={route} />
      {route === "settings" ? (
        <SettingsPage events={events} conn={conn} onClear={clear} />
      ) : route === "user" ? (
        <UserPage events={events} />
      ) : (
        <Dashboard events={events} onDeleteSession={deleteSession} />
      )}
    </div>
  );
}

function Dashboard({ events, onDeleteSession }) {
  const { settings } = useSettings();
  const now = useNow();

  const [range, setRange] = useState(() =>
    RANGES.some((r) => r.id === settings.defaultRange) ? settings.defaultRange : "1h"
  );
  const [agent, setAgent] = useState(settings.defaultAgent);
  const [query, setQuery] = useState("");
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [session, setSession] = useState(null);
  const [selected, setSelected] = useState(null);

  // Time range + agent scope the sessions list.
  const inScope = useMemo(() => {
    const r = RANGES.find((x) => x.id === range);
    const since = r.ms ? now - r.ms : -Infinity;
    return events.filter(
      (e) => (agent === "all" || e.agent === agent) && new Date(e.timestamp).getTime() >= since
    );
  }, [events, range, agent, now]);

  const sessions = useMemo(
    () => buildSessions(inScope, now, settings.idleMinutes * 60e3),
    [inScope, now, settings.idleMinutes]
  );

  // Session, search and errors-only further scope the stats, charts and feed.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inScope.filter(
      (e) =>
        (!session || sessionKey(e) === session) &&
        (!errorsOnly || e.type === "error") &&
        (!q || `${e.summary} ${e.type} ${e.cwd || ""}`.toLowerCase().includes(q))
    );
  }, [inScope, session, errorsOnly, query]);

  const chartWindow = useMemo(() => {
    const r = RANGES.find((x) => x.id === range);
    if (r.ms) return [now - r.ms, now];
    if (!filtered.length) return [now - 3600e3, now];
    const first = new Date(filtered[0].timestamp).getTime();
    return [Math.min(first, now - 60e3), now];
  }, [range, filtered, now]);

  const visibleAgents = agent === "all" ? AGENTS : [agent];
  const activeSession = sessions.find((s) => s.key === session) || null;

  return (
    <div className="layout">
      <Sessions
        sessions={sessions} selected={session} onSelect={setSession} now={now}
        onDelete={async (s) => {
          await onDeleteSession(s.agent, s.sessionId);
          if (session === s.key) setSession(null);
          if (selected && sessionKey(selected) === s.key) setSelected(null);
        }}
      />
      <main className="content">
        <Filters
          range={range} onRange={setRange}
          agent={agent} onAgent={(a) => { setAgent(a); setSession(null); }}
          query={query} onQuery={setQuery}
          errorsOnly={errorsOnly} onErrorsOnly={setErrorsOnly}
          activeSession={activeSession} onClearSession={() => setSession(null)}
        />
        <Kpis events={filtered} sessions={session ? [activeSession].filter(Boolean) : sessions} />
        <div className="charts">
          <ActivityChart events={filtered} window={chartWindow} agents={visibleAgents} />
          <TypeBreakdown events={filtered} />
        </div>
        <Feed events={filtered} total={events.length} now={now} onSelect={setSelected} selectedId={selected?.id} />
      </main>
      {selected && <EventDrawer event={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

// Shows a desktop notification for each error that arrives live (not for history loaded on open).
function useErrorNotifications(events, loaded, enabled) {
  const seen = useRef(null);
  useEffect(() => {
    if (!loaded) return;
    if (seen.current === null || events.length < seen.current) {
      seen.current = events.length;
      return;
    }
    const fresh = events.slice(seen.current);
    seen.current = events.length;
    if (!enabled || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    for (const e of fresh) {
      if (e.type !== "error") continue;
      new Notification(`${AGENT_NAMES[e.agent] || e.agent}: error`, { body: e.summary, tag: e.id });
    }
  }, [events, loaded, enabled]);
}
