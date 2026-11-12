// The standard event format shared by every agent adapter.
//
// {
//   id:        unique id
//   agent:     "claude-code" | "codex"
//   sessionId: the agent's session / thread id
//   timestamp: ISO string
//   type:      session_start | prompt | plan | file_read | file_edit | command | test
//              | search | message | waiting | task_done | session_end | error | other
//   status:    started | completed | failed | null
//   summary:   one human-readable line for the dashboard
//   cwd:       project folder the agent is working in (if known)
//   raw:       the original payload, kept for debugging and the report
// }
const crypto = require("crypto");

function makeEvent({ agent, sessionId, type, status = null, summary, cwd = null, raw }) {
  return {
    id: crypto.randomUUID(),
    agent,
    sessionId: sessionId || "unknown",
    timestamp: new Date().toISOString(),
    type,
    status,
    summary: summary || type,
    cwd,
    raw,
  };
}

function isTestCommand(cmd = "") {
  return /\b(npm (run )?test|yarn test|pnpm test|jest|vitest|pytest|mocha|playwright test|go test|cargo test)\b/.test(cmd);
}

function truncate(text = "", max = 160) {
  const oneLine = String(text).replace(/\s+/g, " ").trim();
  return oneLine.length > max ? oneLine.slice(0, max - 1) + "…" : oneLine;
}

module.exports = { makeEvent, isTestCommand, truncate };
