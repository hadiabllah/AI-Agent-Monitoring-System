export default function Stats({ events }) {
  const count = (fn) => events.filter(fn).length;
  const sessions = new Set(events.map((e) => `${e.agent}:${e.sessionId}`)).size;
  const stats = [
    ["Sessions", sessions],
    ["Events", events.length],
    ["Files edited", count((e) => e.type === "file_edit" && e.status !== "started")],
    ["Commands", count((e) => (e.type === "command" || e.type === "test") && e.status !== "started")],
    ["Tasks done", count((e) => e.type === "task_done")],
    ["Errors", count((e) => e.type === "error"), "err"],
  ];

  return (
    <section className="stats">
      {stats.map(([label, n, cls = ""]) => (
        <div key={label} className={`stat ${cls}`}>
          <div className="n">{n}</div>
          <div className="l">{label}</div>
        </div>
      ))}
    </section>
  );
}
