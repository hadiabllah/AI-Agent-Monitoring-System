// Run with: npm test
const test = require("node:test");
const assert = require("node:assert");
const { normalizeClaudeCode } = require("../server/adapters/claude-code");
const { normalizeCodex } = require("../server/adapters/codex");
const claudeSamples = require("../samples/claude-code.json");
const codexSamples = require("../samples/codex.json");

const REQUIRED = ["id", "agent", "sessionId", "timestamp", "type", "summary"];

test("every Claude Code sample becomes a valid standard event", () => {
  for (const raw of claudeSamples) {
    const e = normalizeClaudeCode(raw);
    for (const key of REQUIRED) assert.ok(e[key], `missing ${key} for ${raw.hook_event_name}`);
    assert.strictEqual(e.agent, "claude-code");
  }
});

test("Claude Code: file edits, tests and failures are classified", () => {
  const types = claudeSamples.map((r) => normalizeClaudeCode(r).type);
  assert.ok(types.includes("file_edit"));
  assert.ok(types.includes("test"));
  assert.ok(types.includes("error"), "failed npm test should become an error");
  assert.strictEqual(types.at(-1), "task_done");
});

test("every Codex sample becomes a valid standard event (or is skipped)", () => {
  for (const raw of codexSamples) {
    const e = normalizeCodex(raw, "s1");
    if (e === null) continue;
    for (const key of REQUIRED) assert.ok(e[key], `missing ${key} for ${raw.type}`);
    assert.strictEqual(e.agent, "codex");
  }
});

test("Codex: non-zero exit code becomes an error", () => {
  const e = normalizeCodex(
    { type: "item.completed", item: { type: "command_execution", command: "npm test", exit_code: 1, status: "failed" } },
    "s1"
  );
  assert.strictEqual(e.type, "error");
  assert.strictEqual(e.status, "failed");
});

test("both agents produce the same set of fields", () => {
  const a = Object.keys(normalizeClaudeCode(claudeSamples[0])).sort();
  const b = Object.keys(normalizeCodex(codexSamples[0], "s1")).sort();
  assert.deepStrictEqual(a, b);
});

test("Codex: older item_type / assistant_message format is understood", () => {
  const e = normalizeCodex({ type: "item.completed", item: { id: "i", item_type: "assistant_message", text: "Done" } }, "s1");
  assert.strictEqual(e.type, "message");
  const c = normalizeCodex({ type: "item.completed", item: { id: "c", item_type: "command_execution", command: "ls", exit_code: 0 } }, "s1");
  assert.strictEqual(c.type, "command");
});

test("Claude Code: a permission prompt pauses the session, an idle prompt does not", () => {
  const base = { session_id: "s1", cwd: "/app", hook_event_name: "Notification" };
  assert.strictEqual(normalizeClaudeCode({ ...base, notification_type: "permission_prompt", message: "Claude needs your permission to use Bash" }).type, "waiting");
  assert.strictEqual(normalizeClaudeCode({ ...base, notification_type: "idle_prompt", message: "Claude is waiting for your input" }).type, "message");
  // Older Claude Code versions send no notification_type
  assert.strictEqual(normalizeClaudeCode({ ...base, message: "Claude needs your permission to use Write" }).type, "waiting");
});

test("session end events from both agents", () => {
  const cc = normalizeClaudeCode({ session_id: "s1", hook_event_name: "SessionEnd", reason: "prompt_input_exit" });
  assert.strictEqual(cc.type, "session_end");
  assert.match(cc.summary, /prompt_input_exit/);
  const cx = normalizeCodex({ type: "session.ended", exit_code: 0 }, "codex-1");
  assert.strictEqual(cx.type, "session_end");
  assert.strictEqual(cx.sessionId, "codex-1");
});
