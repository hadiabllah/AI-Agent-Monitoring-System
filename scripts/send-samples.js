#!/usr/bin/env node
// Sends fake events from both agents so you can test the dashboard
// without running a real agent.
//
//   node scripts/send-samples.js
const BASE = process.env.AGENT_MONITOR_BASE || "http://localhost:4000";
const claude = require("../samples/claude-code.json");
const codex = require("../samples/codex.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(agent, body) {
  const res = await fetch(`${BASE}/events/${agent}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${agent}: HTTP ${res.status}`);
}

(async () => {
  try {
    const longest = Math.max(claude.length, codex.length);
    for (let i = 0; i < longest; i++) {
      if (claude[i]) await post("claude-code", claude[i]);
      if (codex[i]) await post("codex", { sessionId: "codex-sample", event: codex[i] });
      await sleep(600);
    }
    console.log(`Sent ${claude.length} Claude Code and ${codex.length} Codex sample events.`);
  } catch (err) {
    console.error("Could not reach the server. Run `npm start` first.", err.message);
    process.exit(1);
  }
})();
