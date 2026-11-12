// Converts a raw Claude Code hook payload into the standard event format.
// Hook payloads arrive on stdin with fields such as:
//   session_id, cwd, hook_event_name, tool_name, tool_input, tool_response, prompt, message
const { makeEvent, isTestCommand, truncate } = require("./common");

function normalizeClaudeCode(raw) {
  const hook = raw.hook_event_name || "Unknown";
  const tool = raw.tool_name || "";
  const input = raw.tool_input || {};
  const base = { agent: "claude-code", sessionId: raw.session_id, cwd: raw.cwd, raw };

  switch (hook) {
    case "SessionStart":
      return makeEvent({ ...base, type: "session_start", summary: "Session started" });

    case "UserPromptSubmit":
      return makeEvent({ ...base, type: "prompt", summary: truncate(raw.prompt || "New prompt") });

    case "PreToolUse":
    case "PostToolUse": {
      const phase = hook === "PreToolUse" ? "started" : "completed";
      const failed = hook === "PostToolUse" && toolFailed(raw.tool_response);
      const { type, summary } = describeTool(tool, input);
      return makeEvent({
        ...base,
        type: failed ? "error" : type,
        status: failed ? "failed" : phase,
        summary: failed ? `Failed: ${summary}` : summary,
      });
    }

    case "Notification":
      // Claude Code stops and waits when it needs your permission or an answer: show
      // the session as paused until the next event arrives.
      if (isBlockingNotification(raw)) {
        return makeEvent({ ...base, type: "waiting", summary: truncate(raw.message || "Waiting for your approval") });
      }
      return makeEvent({ ...base, type: "message", summary: truncate(raw.message || "Notification") });

    case "SessionEnd":
      return makeEvent({ ...base, type: "session_end", status: "completed", summary: `Session ended${raw.reason ? ` (${raw.reason})` : ""}` });

    case "Stop":
    case "SubagentStop":
      return makeEvent({ ...base, type: "task_done", status: "completed", summary: "Agent finished responding" });

    default:
      return makeEvent({ ...base, type: "other", summary: hook });
  }
}

function describeTool(tool, input) {
  const file = input.file_path || input.path || input.notebook_path;
  switch (tool) {
    case "Read":
      return { type: "file_read", summary: `Read ${file}` };
    case "Write":
    case "Edit":
    case "MultiEdit":
    case "NotebookEdit":
      return { type: "file_edit", summary: `${tool === "Write" ? "Created" : "Edited"} ${file}` };
    case "Bash": {
      const cmd = input.command || "";
      return { type: isTestCommand(cmd) ? "test" : "command", summary: `$ ${truncate(cmd, 120)}` };
    }
    case "Grep":
    case "Glob":
    case "WebSearch":
    case "WebFetch":
      return { type: "search", summary: `${tool}: ${truncate(input.pattern || input.query || input.url || "", 100)}` };
    case "TodoWrite":
      return { type: "plan", summary: "Updated task list" };
    default:
      return { type: "other", summary: tool || "Tool call" };
  }
}

// Newer Claude Code versions send notification_type; older ones only the message text.
// "idle_prompt" ("waiting for your input") means the agent finished, so it isn't a pause.
function isBlockingNotification(raw) {
  if (raw.notification_type) return ["permission_prompt", "elicitation_dialog"].includes(raw.notification_type);
  return /permission|approv/i.test(raw.message || "");
}

function toolFailed(response) {
  if (!response || typeof response !== "object") return false;
  return response.success === false || response.is_error === true || Boolean(response.error);
}

module.exports = { normalizeClaudeCode };
