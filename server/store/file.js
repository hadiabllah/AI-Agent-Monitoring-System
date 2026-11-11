// Simple event store: keeps events in memory and appends them to data/events.jsonl.
// Swap this file for a Supabase version later (see supabase/schema.sql); the rest of
// the server only calls add() and list().
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const EVENTS_FILE = path.join(DATA_DIR, "events.jsonl");
const RAW_DIR = path.join(DATA_DIR, "raw");

fs.mkdirSync(RAW_DIR, { recursive: true });

const events = loadExisting();

function loadExisting() {
  if (!fs.existsSync(EVENTS_FILE)) return [];
  return fs
    .readFileSync(EVENTS_FILE, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter(Boolean);
}

function add(event) {
  events.push(event);
  fs.appendFileSync(EVENTS_FILE, JSON.stringify(event) + "\n");
}

// Keep every raw payload exactly as received, one file per agent: useful for
// improving the adapters and as evidence for the FYP report.
function saveRaw(agent, raw) {
  fs.appendFileSync(path.join(RAW_DIR, `${agent}.jsonl`), JSON.stringify(raw) + "\n");
}

function list({ limit = 500 } = {}) {
  return events.slice(-limit);
}

function clear() {
  events.length = 0;
  if (fs.existsSync(EVENTS_FILE)) fs.unlinkSync(EVENTS_FILE);
}

module.exports = { name: "local files (data/events.jsonl)", add, saveRaw, list, clear };
