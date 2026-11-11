export default function Header({ conn, agent, onAgentChange, errorsOnly, onErrorsOnlyChange, onClear }) {
  return (
    <header>
      <div className="brand">
        <span className={`dot ${conn.state}`} title={conn.title}></span>
        <h1>Agent Monitor</h1>
        <span className="sub">Live activity from Claude Code and Codex</span>
      </div>
      <div className="controls">
        <select aria-label="Filter by agent" value={agent} onChange={(e) => onAgentChange(e.target.value)}>
          <option value="all">All agents</option>
          <option value="claude-code">Claude Code</option>
          <option value="codex">Codex</option>
        </select>
        <label className="check">
          <input type="checkbox" checked={errorsOnly} onChange={(e) => onErrorsOnlyChange(e.target.checked)} />{" "}
          Errors only
        </label>
        <button type="button" onClick={onClear}>Clear</button>
      </div>
    </header>
  );
}
