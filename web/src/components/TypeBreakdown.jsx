import { TYPE_LABELS } from "../lib.js";

// Horizontal bars: how many events of each type, largest first.
export default function TypeBreakdown({ events }) {
  const counts = {};
  for (const e of events) counts[e.type] = (counts[e.type] || 0) + 1;
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = rows[0]?.[1] || 1;

  return (
    <section className="card">
      <div className="card-head">
        <h2>Event types</h2>
        <span className="muted">{rows.length} kinds</span>
      </div>
      {rows.length === 0 ? (
        <p className="muted pad">No events in this range.</p>
      ) : (
        <ul className="hbars">
          {rows.map(([type, n]) => (
            <li key={type} title={`${TYPE_LABELS[type] || type}: ${n}`}>
              <span className="hbar-label">{TYPE_LABELS[type] || type}</span>
              <span className="hbar-track">
                <span className={`hbar-fill${type === "error" ? " critical" : ""}`} style={{ width: `${(n / max) * 100}%` }} />
              </span>
              <span className="hbar-value">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
