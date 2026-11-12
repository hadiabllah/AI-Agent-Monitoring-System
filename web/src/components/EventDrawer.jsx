import { useEffect, useRef } from "react";
import { AGENT_NAMES } from "../constants.js";
import { TYPE_LABELS } from "../lib.js";

export default function EventDrawer({ event: e, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (ev) => ev.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fields = [
    ["Time", new Date(e.timestamp).toLocaleString()],
    ["Agent", AGENT_NAMES[e.agent] || e.agent],
    ["Type", TYPE_LABELS[e.type] || e.type],
    ["Status", e.status || "—"],
    ["Session", e.sessionId],
    ["Folder", e.cwd || "—"],
  ];

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Event details" onClick={(ev) => ev.stopPropagation()}>
        <div className="drawer-head">
          <span className={`badge ${e.type}`}>{TYPE_LABELS[e.type] || e.type}</span>
          <button ref={closeRef} type="button" className="btn ghost" onClick={onClose} aria-label="Close details">×</button>
        </div>
        <p className="drawer-summary">{e.summary}</p>
        <dl className="fields">
          {fields.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <h3>Raw payload</h3>
        <pre className="raw">{e.raw ? JSON.stringify(e.raw, null, 2) : "Not stored for this event."}</pre>
      </aside>
    </div>
  );
}
