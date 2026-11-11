#!/usr/bin/env node
// Runs a Codex task and streams its events to the Agent Monitor.
//
//   node scripts/codex-run.js "add a login page to this app"
//
// Run it from inside the project you want Codex to work on (or pass --cd <folder>).
// It runs `codex exec --json <prompt>`, which prints one JSON event per line, and
// POSTs each line to the server. Lines are also echoed so you can watch them.
const { spawn } = require("child_process");
const readline = require("readline");
const crypto = require("crypto");

const url = process.env.AGENT_MONITOR_URL || "http://localhost:4000/events/codex";
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/codex-run.js "<task prompt>" [extra codex exec flags]');
  process.exit(1);
}

const sessionId = `codex-${crypto.randomUUID().slice(0, 8)}`;
const child = spawn("codex", ["exec", "--json", ...args], {
  stdio: ["inherit", "pipe", "inherit"],
  shell: process.platform === "win32", // lets Windows find codex.cmd
});

const lines = readline.createInterface({ input: child.stdout });
lines.on("line", async (line) => {
  if (!line.trim()) return;
  let event;
  try { event = JSON.parse(line); } catch { return console.log(line); } // not JSON: just print it
  console.log(line);
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, event }),
    });
  } catch {
    console.error("(Agent Monitor not reachable — is `npm start` running?)");
  }
});

child.on("error", (err) => {
  console.error("Could not start Codex. Is the Codex CLI installed and on your PATH?", err.message);
  process.exit(1);
});
child.on("close", (code) => process.exit(code ?? 0));
