import { AGENT_NAMES } from "../constants.js";
import { RANGES, shortPath } from "../lib.js";

export default function Filters({ range, onRange, agent, onAgent, query, onQuery, errorsOnly, onErrorsOnly, activeSession, onClearSession }) {
  return (
    <div className="filters">
      <div className="seg" role="group" aria-label="Time range">
        {RANGES.map((r) => (
          <button key={r.id} type="button" aria-pressed={range === r.id} onClick={() => onRange(r.id)}>
            {r.label}
          </button>
        ))}
      </div>

      <div className="seg" role="group" aria-label="Agent">
        <button type="button" aria-pressed={agent === "all"} onClick={() => onAgent("all")}>All agents</button>
        {Object.entries(AGENT_NAMES).map(([id, name]) => (
          <button key={id} type="button" aria-pressed={agent === id} onClick={() => onAgent(id)}>
            <span className={`swatch ${id}`} aria-hidden="true" />
            {name}
          </button>
        ))}
      </div>

      <label className="search">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input type="search" placeholder="Search events…" value={query} onChange={(e) => onQuery(e.target.value)} aria-label="Search events" />
      </label>

      <label className="toggle">
        <input type="checkbox" checked={errorsOnly} onChange={(e) => onErrorsOnly(e.target.checked)} />
        <span className="track" aria-hidden="true" />
        Errors only
      </label>

      {activeSession && (
        <span className="chip">
          Session: {shortPath(activeSession.cwd) || activeSession.sessionId.slice(0, 8)}
          <button type="button" onClick={onClearSession} aria-label="Show all sessions">×</button>
        </span>
      )}
    </div>
  );
}
