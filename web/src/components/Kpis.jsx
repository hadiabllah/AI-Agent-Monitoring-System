export default function Kpis({ events, sessions }) {
  const count = (fn) => events.filter(fn).length;
  const errors = count((e) => e.type === "error");
  const active = sessions.filter((s) => s.state === "active").length;
  const paused = sessions.filter((s) => s.state === "paused").length;
  const errorRate = events.length ? ((errors / events.length) * 100).toFixed(1) : "0.0";

  const tiles = [
    { label: "Sessions", value: sessions.length, note: `${active} active now${paused ? `, ${paused} paused` : ""}` },
    { label: "Events", value: events.length },
    { label: "Files edited", value: count((e) => e.type === "file_edit" && e.status !== "started") },
    { label: "Commands & tests", value: count((e) => (e.type === "command" || e.type === "test") && e.status !== "started") },
    { label: "Tasks done", value: count((e) => e.type === "task_done") },
    { label: "Errors", value: errors, note: `${errorRate}% of events`, alert: errors > 0 },
  ];

  return (
    <section className="kpis" aria-label="Summary">
      {tiles.map((t) => (
        <div key={t.label} className={`kpi${t.alert ? " alert" : ""}`}>
          <div className="kpi-label">
            {t.alert && <span className="status-icon" aria-hidden="true">!</span>}
            {t.label}
          </div>
          <div className="kpi-value">{t.value.toLocaleString()}</div>
          {t.note && <div className="kpi-note">{t.note}</div>}
        </div>
      ))}
    </section>
  );
}
