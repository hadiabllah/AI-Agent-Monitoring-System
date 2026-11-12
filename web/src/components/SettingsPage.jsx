import { useState } from "react";
import { AGENT_NAMES } from "../constants.js";
import { RANGES } from "../lib.js";
import { DEFAULT_SETTINGS, useSettings } from "../settings.jsx";

const SECTIONS = [
  ["appearance", "Appearance"],
  ["defaults", "Dashboard defaults"],
  ["feed", "Feed"],
  ["notifications", "Notifications"],
  ["data", "Data"],
  ["about", "About"],
];

export default function SettingsPage({ events, conn, onClear }) {
  const { settings, update, reset } = useSettings();
  const isDefault = JSON.stringify(settings) === JSON.stringify(DEFAULT_SETTINGS);

  return (
    <div className="settings-layout">
      <nav className="settings-nav" aria-label="Settings sections">
        <h2>Settings</h2>
        <ul>
          {SECTIONS.map(([id, label]) => (
            <li key={id}>
              <a href={`#/settings`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); }}>
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <main className="settings-main">
        <header className="settings-header">
          <div>
            <h1>Settings</h1>
            <p className="muted">Saved in this browser and applied right away.</p>
          </div>
          <button type="button" className="btn" onClick={reset} disabled={isDefault}>Reset to defaults</button>
        </header>

        <Section id="appearance" title="Appearance">
          <Row label="Theme" hint="Auto follows your operating system.">
            <Segmented
              value={settings.theme}
              onChange={(theme) => update({ theme })}
              options={[["system", "Auto"], ["light", "Light"], ["dark", "Dark"]]}
              label="Theme"
            />
          </Row>
          <Row label="Compact feed" hint="Tighter rows so more events fit on screen.">
            <Switch checked={settings.compact} onChange={(compact) => update({ compact })} label="Compact feed" />
          </Row>
        </Section>

        <Section id="defaults" title="Dashboard defaults" note="Used each time the dashboard opens.">
          <Row label="Time range">
            <Segmented
              value={settings.defaultRange}
              onChange={(defaultRange) => update({ defaultRange })}
              options={RANGES.map((r) => [r.id, r.label])}
              label="Default time range"
            />
          </Row>
          <Row label="Agent">
            <Segmented
              value={settings.defaultAgent}
              onChange={(defaultAgent) => update({ defaultAgent })}
              options={[["all", "All agents"], ...Object.entries(AGENT_NAMES)]}
              label="Default agent"
            />
          </Row>
          <Row label="Idle after" hint="A session with no new events for this long is marked Idle instead of Active.">
            <NumberInput value={settings.idleMinutes} min={1} max={120} unit="minutes" onChange={(idleMinutes) => update({ idleMinutes })} label="Idle after (minutes)" />
          </Row>
        </Section>

        <Section id="feed" title="Feed">
          <Row label="Rows per page" hint="How many events show before “Show older events”.">
            <select className="select" value={settings.pageSize} onChange={(e) => update({ pageSize: Number(e.target.value) })} aria-label="Rows per page">
              {[50, 100, 200, 500, 1000].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Row>
          <Row label="Clock">
            <Segmented
              value={settings.clock}
              onChange={(clock) => update({ clock })}
              options={[["24h", "24-hour"], ["12h", "12-hour"]]}
              label="Clock format"
            />
          </Row>
          <Row label="Relative time" hint="Show “2m ago” under each timestamp.">
            <Switch checked={settings.showRelative} onChange={(showRelative) => update({ showRelative })} label="Relative time" />
          </Row>
        </Section>

        <Section id="notifications" title="Notifications">
          <NotificationRow enabled={settings.notifyErrors} onChange={(notifyErrors) => update({ notifyErrors })} />
        </Section>

        <Section id="data" title="Data">
          <Row label="Export events" hint={`Download all ${events.length} recorded events.`}>
            <div className="btn-row">
              <button type="button" className="btn" disabled={!events.length} onClick={() => exportJson(events)}>JSON</button>
              <button type="button" className="btn" disabled={!events.length} onClick={() => exportCsv(events)}>CSV</button>
            </div>
          </Row>
          <Row label="Clear all events" hint="Deletes every recorded event from the server's store. This cannot be undone." danger>
            <button
              type="button"
              className="btn danger"
              disabled={!events.length}
              onClick={() => window.confirm(`Delete all ${events.length} events? This cannot be undone.`) && onClear()}
            >
              Clear events
            </button>
          </Row>
        </Section>

        <Section id="about" title="About">
          <dl className="about">
            <div><dt>Connection</dt><dd><span className={`conn ${conn.state}`}><span className="conn-dot" aria-hidden="true" />{conn.title}</span></dd></div>
            <div><dt>Server</dt><dd className="mono">{window.location.origin}</dd></div>
            <div><dt>Events in memory</dt><dd>{events.length.toLocaleString()}</dd></div>
            <div><dt>Claude Code hooks post to</dt><dd className="mono">/events/claude-code</dd></div>
            <div><dt>Codex runner posts to</dt><dd className="mono">/events/codex</dd></div>
            <div><dt>Live stream</dt><dd className="mono">/stream</dd></div>
          </dl>
        </Section>
      </main>
    </div>
  );
}

function Section({ id, title, note, children }) {
  return (
    <section id={id} className="card settings-section">
      <div className="settings-section-head">
        <h2>{title}</h2>
        {note && <p className="muted">{note}</p>}
      </div>
      <div className="settings-rows">{children}</div>
    </section>
  );
}

function Row({ label, hint, danger, children }) {
  return (
    <div className={`settings-row${danger ? " danger" : ""}`}>
      <div className="settings-label">
        <div>{label}</div>
        {hint && <p className="muted">{hint}</p>}
      </div>
      <div className="settings-control">{children}</div>
    </div>
  );
}

function Segmented({ value, onChange, options, label }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([id, text]) => (
        <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)}>{text}</button>
      ))}
    </div>
  );
}

function Switch({ checked, onChange, label }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span className="track on-accent" aria-hidden="true" />
    </label>
  );
}

function NumberInput({ value, min, max, unit, onChange, label }) {
  const [draft, setDraft] = useState(String(value));
  const commit = () => {
    const n = Math.round(Number(draft));
    const clamped = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : value;
    setDraft(String(clamped));
    onChange(clamped);
  };
  return (
    <span className="number">
      <input
        type="number" min={min} max={max} value={draft} aria-label={label}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
      <span className="muted">{unit}</span>
    </span>
  );
}

function NotificationRow({ enabled, onChange }) {
  const supported = typeof Notification !== "undefined";
  const [permission, setPermission] = useState(supported ? Notification.permission : "unsupported");

  const toggle = async (on) => {
    if (on && supported && Notification.permission === "default") {
      const p = await Notification.requestPermission();
      setPermission(p);
      if (p !== "granted") return;
    }
    onChange(on);
  };

  const hint =
    permission === "unsupported" ? "This browser does not support desktop notifications."
    : permission === "denied" ? "Notifications are blocked for this site. Allow them in your browser's site settings."
    : "Pop up a desktop notification when an agent reports an error, even if this tab is in the background.";

  return (
    <Row label="Error alerts" hint={hint}>
      <Switch
        checked={enabled && permission === "granted"}
        onChange={toggle}
        label="Desktop notifications for errors"
      />
    </Row>
  );
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

function exportJson(events) {
  download(`agent-events-${stamp()}.json`, JSON.stringify(events, null, 2), "application/json");
}

function exportCsv(events) {
  const cols = ["timestamp", "agent", "sessionId", "type", "status", "summary", "cwd"];
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    // Quote every field; prefix formula-like values so spreadsheets don't execute them.
    return `"${(/^[=+\-@]/.test(s) ? "'" + s : s).replace(/"/g, '""')}"`;
  };
  const rows = [cols.join(","), ...events.map((e) => cols.map((c) => esc(e[c])).join(","))];
  download(`agent-events-${stamp()}.csv`, rows.join("\r\n"), "text/csv");
}
