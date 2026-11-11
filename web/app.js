// Live feed: loads past events, then listens on /stream for new ones.
const feed = document.getElementById("feed");
const empty = document.getElementById("empty");
const statsEl = document.getElementById("stats");
const conn = document.getElementById("conn");
const agentFilter = document.getElementById("agentFilter");
const errorsOnly = document.getElementById("errorsOnly");

const AGENT_NAMES = { "claude-code": "Claude Code", codex: "Codex" };
let events = [];

async function init() {
  const res = await fetch("/api/events");
  events = await res.json();
  render();
  connect();
}

function connect() {
  const source = new EventSource("/stream");
  source.onopen = () => setConn("live", "Connected");
  source.onerror = () => setConn("down", "Disconnected, retrying…");
  source.onmessage = (msg) => {
    const event = JSON.parse(msg.data);
    if (event.type === "__cleared") { events = []; return render(); }
    events.push(event);
    if (matches(event)) feed.prepend(row(event));
    renderStats();
    empty.hidden = events.length > 0;
  };
}

function setConn(state, title) {
  conn.className = `dot ${state}`;
  conn.title = title;
}

function matches(e) {
  if (agentFilter.value !== "all" && e.agent !== agentFilter.value) return false;
  if (errorsOnly.checked && e.type !== "error") return false;
  return true;
}

function render() {
  feed.replaceChildren(...events.filter(matches).reverse().map(row));
  empty.hidden = events.length > 0;
  renderStats();
}

function row(e) {
  const li = document.createElement("li");
  li.className = `event ${e.agent} ${e.type === "error" ? "error" : ""}`;
  li.innerHTML = `
    <span class="time">${new Date(e.timestamp).toLocaleTimeString()}</span>
    <span class="agent">${AGENT_NAMES[e.agent] || e.agent}</span>
    <span class="type ${e.type}">${e.type.replace("_", " ")}</span>
    <span class="summary"></span>`;
  li.querySelector(".summary").textContent = e.summary; // textContent: never inject agent output as HTML
  li.title = `Session ${e.sessionId}${e.cwd ? " · " + e.cwd : ""}`;
  return li;
}

function renderStats() {
  const count = (fn) => events.filter(fn).length;
  const sessions = new Set(events.map((e) => `${e.agent}:${e.sessionId}`)).size;
  const stats = [
    ["Sessions", sessions],
    ["Events", events.length],
    ["Files edited", count((e) => e.type === "file_edit" && e.status !== "started")],
    ["Commands", count((e) => (e.type === "command" || e.type === "test") && e.status !== "started")],
    ["Tasks done", count((e) => e.type === "task_done")],
    ["Errors", count((e) => e.type === "error"), "err"],
  ];
  statsEl.innerHTML = stats
    .map(([l, n, cls = ""]) => `<div class="stat ${cls}"><div class="n">${n}</div><div class="l">${l}</div></div>`)
    .join("");
}

agentFilter.addEventListener("change", render);
errorsOnly.addEventListener("change", render);
document.getElementById("clearBtn").addEventListener("click", async () => {
  if (events.length) await fetch("/api/events", { method: "DELETE" });
});

init();
