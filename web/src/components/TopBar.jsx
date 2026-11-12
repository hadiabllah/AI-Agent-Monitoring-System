import { useProfile } from "../settings.jsx";

export default function TopBar({ conn, route }) {
  const { profile } = useProfile();
  const name = profile.name.trim().split(/\s+/)[0] || "";
  const initial = name[0]?.toUpperCase();
  return (
    <header className="topbar">
      <div className="brand">
        <svg className="logo" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 12h4l3-8 4 16 3-8h4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div>
          <h1>Agent Monitor</h1>
          <p className="sub">Claude Code &amp; Codex, live</p>
        </div>
      </div>
      <nav className="nav" aria-label="Main">
        <a href="#/" aria-current={route === "dashboard" ? "page" : undefined}>Dashboard</a>
        <a href="#/settings" aria-current={route === "settings" ? "page" : undefined}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Settings
        </a>
        <a href="#/user" aria-current={route === "user" ? "page" : undefined}>
          <span className={`avatar avatar-mini ${profile.color}`} aria-hidden="true">{initial || "?"}</span>
          {name || "User"}
        </a>
      </nav>
      <span className={`conn ${conn.state}`} role="status">
        <span className="conn-dot" aria-hidden="true" />
        {conn.title}
      </span>
    </header>
  );
}
