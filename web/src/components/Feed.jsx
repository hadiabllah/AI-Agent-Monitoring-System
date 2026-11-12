import { useState } from "react";
import { AGENT_NAMES } from "../constants.js";
import { TYPE_LABELS, timeAgo } from "../lib.js";
import { useSettings } from "../settings.jsx";

export default function Feed({ events, total, now, onSelect, selectedId }) {
  const { settings } = useSettings();
  const page = settings.pageSize;
  const [limit, setLimit] = useState(page);
  const rows = events.slice(-limit).reverse();

  return (
    <section className="card feed-card">
      <div className="card-head">
        <h2>Live feed</h2>
        <span className="muted">
          {events.length === total ? `${total} events` : `${events.length} of ${total} events`}
        </span>
      </div>

      {total === 0 ? (
        <div className="empty">
          <p><strong>Waiting for events…</strong></p>
          <p className="muted">
            Run <code>npm run samples</code> to send test data, or start Claude Code / Codex with the hooks installed.
          </p>
        </div>
      ) : events.length === 0 ? (
        <p className="muted pad">No events match these filters.</p>
      ) : (
        <ol className={`feed${settings.compact ? " compact" : ""}`}>
          {rows.map((e, i) => (
            <li key={e.id ?? i}>
              <button
                type="button"
                className={`event${e.type === "error" ? " error" : ""}${selectedId === e.id ? " selected" : ""}`}
                onClick={() => onSelect(e)}
              >
                <span className="ev-time" title={new Date(e.timestamp).toLocaleString()}>
                  {new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: settings.clock === "12h" })}
                  {settings.showRelative && <small>{timeAgo(e.timestamp, now)}</small>}
                </span>
                <span className="ev-agent">
                  <span className={`swatch ${e.agent}`} aria-hidden="true" />
                  {AGENT_NAMES[e.agent] || e.agent}
                </span>
                <span className={`badge ${e.type}`}>
                  {e.type === "error" && <span aria-hidden="true">! </span>}
                  {TYPE_LABELS[e.type] || e.type}
                </span>
                {/* React escapes text, so agent output is never injected as HTML */}
                <span className="ev-summary">{e.summary}</span>
                {e.status === "failed" && <span className="ev-status">failed</span>}
              </button>
            </li>
          ))}
        </ol>
      )}

      {events.length > limit && (
        <button type="button" className="btn ghost more" onClick={() => setLimit((l) => l + page)}>
          Show older events ({events.length - limit} more)
        </button>
      )}
    </section>
  );
}
