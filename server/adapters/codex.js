// Converts one JSON line from `codex exec --json` into the standard event format.
// Codex emits events such as:
//   thread.started, turn.started, turn.completed, turn.failed, error,
//   item.started / item.updated / item.completed  (item.type: agent_message, reasoning,
//   command_execution, file_change, mcp_tool_call, web_search, todo_list)
// The exact shape can change between Codex versions: check your own samples/ output
// and adjust this file if something shows up as "other".
const { makeEvent, isTestCommand, truncate } = require("./common");

function normalizeCodex(raw, sessionId) {
  const base = { agent: "codex", sessionId: raw.thread_id || sessionId, raw };

  switch (raw.type) {
    case "thread.started":
      return makeEvent({ ...base, type: "session_start", summary: "Session started" });
    case "turn.started":
      return makeEvent({ ...base, type: "prompt", status: "started", summary: "Working on the task" });
    case "turn.completed":
      return makeEvent({ ...base, type: "task_done", status: "completed", summary: "Agent finished the task" });
    case "session.ended": // sent by scripts/codex-run.js when the Codex process exits
      return makeEvent({ ...base, type: "session_end", status: "completed", summary: `Session ended${raw.exit_code ? ` (exit code ${raw.exit_code})` : ""}` });
    case "turn.failed":
    case "error":
      return makeEvent({
        ...base,
        type: "error",
        status: "failed",
        summary: truncate(raw.message || raw.error?.message || "Codex reported an error"),
      });
  }

  if (raw.type && raw.type.startsWith("item.") && raw.item) {
    if (raw.type === "item.updated") return null; // skip noisy partial updates
    const phase = raw.type === "item.started" ? "started" : "completed";
    return describeItem(raw.item, phase, base);
  }

  return makeEvent({ ...base, type: "other", summary: raw.type || "Unknown Codex event" });
}

function describeItem(item, phase, base) {
  // Older Codex versions use item.item_type and "assistant_message"; newer ones use item.type and "agent_message".
  const kind = item.type || item.item_type;
  switch (kind === "assistant_message" ? "agent_message" : kind) {
    case "command_execution": {
      const cmd = item.command || "";
      const failed = phase === "completed" && (item.status === "failed" || (item.exit_code ?? 0) !== 0);
      return makeEvent({
        ...base,
        type: failed ? "error" : isTestCommand(cmd) ? "test" : "command",
        status: failed ? "failed" : phase,
        summary: `${failed ? "Failed: " : ""}$ ${truncate(cmd, 120)}`,
      });
    }
    case "file_change": {
      const files = (item.changes || []).map((c) => `${c.kind || "edit"} ${c.path}`).join(", ");
      return makeEvent({ ...base, type: "file_edit", status: phase, summary: truncate(`Changed ${files || "files"}`) });
    }
    case "agent_message":
      if (phase !== "completed") return null;
      return makeEvent({ ...base, type: "message", status: phase, summary: truncate(item.text || "Message") });
    case "reasoning":
      return null; // internal thinking, not shown on the dashboard
    case "todo_list":
      return makeEvent({ ...base, type: "plan", status: phase, summary: "Updated task list" });
    case "web_search":
      return makeEvent({ ...base, type: "search", status: phase, summary: `Web search: ${truncate(item.query || "", 100)}` });
    case "mcp_tool_call":
      return makeEvent({ ...base, type: "other", status: phase, summary: `Tool: ${item.server || ""} ${item.tool || ""}`.trim() });
    default:
      return makeEvent({ ...base, type: "other", status: phase, summary: kind || "Item" });
  }
}

module.exports = { normalizeCodex };
