-- Schema for moving the event store to Supabase (slice 1 of the build plan).
-- Run this in the Supabase SQL editor, then replace server/store.js with a version
-- that inserts into these tables using @supabase/supabase-js.

create table if not exists sessions (
  id           text primary key,              -- agent's session / thread id
  agent        text not null check (agent in ('claude-code', 'codex')),
  project_path text,
  started_at   timestamptz not null default now(),
  ended_at     timestamptz
);

create table if not exists events (
  id          uuid primary key,
  session_id  text not null references sessions (id) on delete cascade,
  agent       text not null,
  type        text not null check (type in (
                'session_start', 'prompt', 'plan', 'file_read', 'file_edit', 'command',
                'test', 'search', 'message', 'task_done', 'error', 'other')),
  status      text check (status in ('started', 'completed', 'failed')),
  summary     text not null,
  raw         jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists events_session_time on events (session_id, created_at);
create index if not exists events_errors on events (created_at) where type = 'error';

-- Later slices
create table if not exists tasks (
  id          uuid primary key default gen_random_uuid(),
  session_id  text not null references sessions (id) on delete cascade,
  title       text not null,
  status      text not null default 'pending'
              check (status in ('pending', 'in_progress', 'completed', 'failed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists screenshots (
  id          uuid primary key default gen_random_uuid(),
  session_id  text not null references sessions (id) on delete cascade,
  task_id     uuid references tasks (id) on delete set null,
  image_path  text not null,                  -- path in Supabase Storage
  page_url    text,
  captured_at timestamptz not null default now()
);

-- Enable realtime so the dashboard can subscribe to new events
alter publication supabase_realtime add table events;
