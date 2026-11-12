import { useState } from "react";
import { AGENT_NAMES } from "../constants.js";
import { STATE_HINTS, STATE_LABELS, formatDuration, shortPath, timeAgo } from "../lib.js";

export default function Sessions({ sessions, selected, onSelect, onDelete, now }) {
  const [deleting, setDeleting] = useState(null);

  const remove = async (s) => {
    const name = `${AGENT_NAMES[s.agent] || s.agent} session in ${shortPath(s.cwd) || s.sessionId.slice(0, 12)}`;
    if (!window.confirm(`Delete this ${name} and its ${s.count} events? This cannot be undone.`)) return;
    setDeleting(s.key);
    try {
      await onDelete(s);
    } catch (err) {
      window.alert(`Could not delete the session: ${err.message}`);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <aside className="sessions" aria-label="Sessions">
      <div className="sessions-head">
        <h2>Sessions</h2>
        <span className="count">{sessions.length}</span>
      </div>
      {sessions.length === 0 && <p className="muted pad">No sessions in this range.</p>}
      <ul>
        {sessions.map((s) => (
          <li key={s.key} className={deleting === s.key ? "deleting" : undefined}>
            <button
              type="button"
              className={`session${selected === s.key ? " selected" : ""}`}
              onClick={() => onSelect(selected === s.key ? null : s.key)}
              aria-pressed={selected === s.key}
            >
              <div className="session-top">
                <span className={`swatch ${s.agent}`} aria-hidden="true" />
                <span className="session-agent">{AGENT_NAMES[s.agent] || s.agent}</span>
                <span className={`state ${s.state}`} title={STATE_HINTS[s.state]}>{STATE_LABELS[s.state]}</span>
              </div>
              <div className="session-path" title={s.cwd || s.sessionId}>
                {shortPath(s.cwd) || s.sessionId.slice(0, 12)}
              </div>
              <div className="session-last">{s.lastSummary}</div>
              <div className="session-meta">
                <span>{s.count} events</span>
                {s.errors > 0 && <span className="err-count">! {s.errors} errors</span>}
                <span>{formatDuration(new Date(s.last) - new Date(s.first))}</span>
                <span className="right">{timeAgo(s.last, now)}</span>
              </div>
            </button>
            <button
              type="button"
              className="session-delete"
              onClick={() => remove(s)}
              disabled={deleting === s.key}
              aria-label={`Delete ${AGENT_NAMES[s.agent] || s.agent} session ${shortPath(s.cwd) || s.sessionId}`}
              title="Delete session"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
