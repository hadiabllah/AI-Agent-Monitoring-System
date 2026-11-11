#!/usr/bin/env node
// Adds the Agent Monitor hooks to a project's .claude/settings.json.
//
//   node scripts/install-hooks.js <path-to-the-project-Claude-Code-will-work-on>
//
// Existing settings and hooks in that file are kept; running it twice does not
// add duplicates.
const fs = require("fs");
const path = require("path");

const target = process.argv[2];
if (!target) {
  console.error("Usage: node scripts/install-hooks.js <project folder>");
  process.exit(1);
}

const forwarder = path.resolve(__dirname, "..", "hooks", "forward.js").replace(/\\/g, "/");
const command = `node "${forwarder}"`;
const HOOK_EVENTS = ["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "Notification", "Stop", "SubagentStop"];
const TOOL_EVENTS = new Set(["PreToolUse", "PostToolUse"]);

const settingsDir = path.join(path.resolve(target), ".claude");
const settingsFile = path.join(settingsDir, "settings.json");
fs.mkdirSync(settingsDir, { recursive: true });

const settings = fs.existsSync(settingsFile) ? JSON.parse(fs.readFileSync(settingsFile, "utf8")) : {};
settings.hooks = settings.hooks || {};

for (const name of HOOK_EVENTS) {
  const groups = (settings.hooks[name] = settings.hooks[name] || []);
  const already = groups.some((g) => (g.hooks || []).some((h) => h.command === command));
  if (already) continue;
  const group = { hooks: [{ type: "command", command }] };
  if (TOOL_EVENTS.has(name)) group.matcher = "*";
  groups.push(group);
}

fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + "\n");
console.log(`Hooks written to ${settingsFile}`);
console.log("Start (or restart) Claude Code in that folder and its activity will appear on the dashboard.");
