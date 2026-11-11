# Agent Monitor

A unified real-time monitoring and visualization platform for AI coding agents (Claude Code and OpenAI Codex).
FYP project – Muhammad Hadi bin Ab Llah, Faculty of Computing, UTM.

This is the **Step 1 starter**: it captures real events from both agents, converts them into one standard
format, and shows them on a live dashboard. It needs only Node.js 18+ — no `npm install`.

## How it works

```
Claude Code ──hooks──► hooks/forward.js ──┐
                                          ├──► POST /events/:agent ──► adapter ──► standard event ──► store ──► SSE /stream ──► dashboard
Codex ──codex exec --json──► scripts/codex-run.js ──┘                (server/adapters)                (data/)
```

| Folder | What it is |
|---|---|
| `server/index.js` | HTTP server: receives events, serves the dashboard, streams live updates (SSE) |
| `server/adapters/` | One adapter per agent + the standard event format (`common.js`) — **Objective 1** |
| `server/store/` | Where events are saved: Supabase if `.env` has its keys, otherwise `data/events.jsonl`. Raw payloads always go to `data/raw/` |
| `web/` | Live activity dashboard — **Objective 2** (first version) |
| `hooks/forward.js` | Claude Code hook: forwards each hook payload to the server |
| `scripts/codex-run.js` | Runs a Codex task and streams its JSON events to the server |
| `scripts/install-hooks.js` | Adds the hooks to a project's `.claude/settings.json` |
| `samples/` | Example payloads from both agents, used by tests and `npm run samples` |
| `supabase/schema.sql` | Database schema for the next slice |

## Quick start

```bash
# 1. Start the server
npm start
# open http://localhost:4000

# 2. In a second terminal, send fake events to check the dashboard
npm run samples

# 3. Run the adapter tests
npm test
```

## Connect Claude Code

```bash
# Point it at the project Claude Code will work on (a small test app is best)
npm run install-hooks -- C:/path/to/your/test-project
```

Then open Claude Code in that project and give it a task. Every file read, edit, command, test and
"finished" appears on the dashboard. Restart Claude Code if it was already open. If the server is not
running, the hook does nothing and Claude Code keeps working normally.

## Connect Codex

Run this from inside the project Codex should work on:

```bash
node C:/path/to/agent-monitor/scripts/codex-run.js "add a login page with validation"
```

Extra flags are passed through to `codex exec`, e.g. `--full-auto`.

> The Codex adapter is based on the documented `codex exec --json` event types (`thread.started`,
> `item.completed`, `turn.completed`, …). Codex changes often: after your first real run, open
> `data/raw/codex.jsonl`, and if any event shows as `other` on the dashboard, update `server/adapters/codex.js`.

## Connect Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query**: paste `supabase/schema.sql`, click **Run**.
3. **Project Settings → API**: copy the **Project URL** and the **service_role** key.
4. Copy `.env.example` to `.env` and paste both values in.
5. Restart `npm start`. The second line should say `Storing events in Supabase (...)`.
6. Run `npm run samples`, then check **Table Editor → events** in Supabase.

If a save fails, the event still appears on the dashboard and the terminal prints `✗ not saved:` with
Supabase's error message. Delete the two lines from `.env` to go back to local files.

## Standard event format

```json
{
  "id": "uuid",
  "agent": "claude-code | codex",
  "sessionId": "agent session id",
  "timestamp": "ISO time",
  "type": "session_start | prompt | plan | file_read | file_edit | command | test | search | message | task_done | error | other",
  "status": "started | completed | failed | null",
  "summary": "one readable line",
  "cwd": "project folder",
  "raw": { "original payload": "kept for debugging" }
}
```

## Build plan (next slices)

1. ~~**Supabase store**~~ – done (see "Connect Supabase")
2. **React dashboard** – move `web/` to a Vite + React app using Supabase Realtime
3. **Tasks and statuses** – group events into tasks (pending / in progress / completed / failed)
4. **Timeline** – chronological view per session, errors highlighted
5. **Screenshots** – Playwright captures the app at `localhost` when a task finishes (**Objective 3**)
6. **Auth and roles** – Supabase Auth; stakeholder role is view-only

## Notes for the report

- `data/raw/*.jsonl` holds real payloads from each agent: use them in Chapter 4 to show the two formats
  differ and how the adapters standardize them.
- `npm test` runs unit tests for the integration layer and the Supabase store (against a fake Supabase server).
