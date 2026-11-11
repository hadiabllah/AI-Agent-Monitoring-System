import { AGENT_NAMES } from "../constants.js";

export default function Feed({ events }) {
  return (
    <ol className="feed">
      {events.map((e, i) => (
        <EventRow key={e.id ?? i} event={e} />
      ))}
    </ol>
  );
}

function EventRow({ event: e }) {
  const isError = e.type === "error";
  return (
    <li
      className={`event ${e.agent}${isError ? " error" : ""}`}
      title={`Session ${e.sessionId}${e.cwd ? " · " + e.cwd : ""}`}
    >
      <span className="time">{new Date(e.timestamp).toLocaleTimeString()}</span>
      <span className="agent">{AGENT_NAMES[e.agent] || e.agent}</span>
      <span className={`type ${e.type}`}>{e.type.replace("_", " ")}</span>
      {/* React escapes text, so agent output is never injected as HTML */}
      <span className="summary">{e.summary}</span>
    </li>
  );
}
