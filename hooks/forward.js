#!/usr/bin/env node
// Claude Code hook forwarder.
// Claude Code passes the hook payload as JSON on stdin; this script POSTs it to the
// Agent Monitor server. Written in Node (not curl) so it works the same on
// Windows, macOS and Linux.
//
// It never blocks or fails the agent: if the server is down, it just exits quietly.
const url = process.env.AGENT_MONITOR_URL || "http://localhost:4000/events/claude-code";

let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", async () => {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: input || "{}",
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // Server not running: ignore so the agent keeps working.
  }
  process.exit(0);
});
