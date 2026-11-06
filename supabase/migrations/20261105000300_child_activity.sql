-- LITTLE FOUNDERS · 0003 Child activity (Private-Child)
-- Learning progress, Idea Lab projects, simulator, pitch decks, investor sessions.
-- See docs/DATABASE_SCHEMA.md §5–§8 and §11.
--
-- Write model:
--   * Child-created work (progress, activity responses, projects, decks, slides) is
--     writable by the guardian's session (Child Mode runs under the guardian's JWT).
--   * Scored / engine-computed records (quiz attempts, simulator sessions & rounds,
--     investor sessions & responses) are READ-ONLY to clients and written by server
--     code after re-scoring, so results and achievements cannot be forged.
--
-- Cross-child references use composite foreign keys (id, child_id) so a row can
-- never point at another child's (or another family's) data.

-- ---------------------------------------------------------------------------
-- Learning progress
-- ---------------------------------------------------------------------------

create table public.lesson_progress (
  child_id      uuid not null references public.child_profiles (id) on delete cascade,
  lesson_id     uuid not null references public.lessons (id) on delete cascade,
  status        text not null default 'started' check (status in ('started', 'completed')),
  started_at    timestamptz not null default now(),
  completed_at  timestamptz,
  primary key (child_id, lesson_id),
  check ((status = 'completed') = (completed_at is not null))
);

create table public.activity_responses (
  id           uuid primary key default gen_random_uuid(),
  child_id     uuid not null references public.child_profiles (id) on delete cascade,
  activity_id  uuid not null references public.lesson_activities (id) on delete cascade,
  response     jsonb not null,
  is_correct   boolean,
  created_at   timestamptz not null default now()
);

create index activity_responses_child_idx on public.activity_responses (child_id, activity_id, created_at desc);

create table public.quiz_attempts (
  id            uuid primary key default gen_random_uuid(),
  child_id      uuid not null references public.child_profiles (id) on delete cascade,
  quiz_id       uuid not null references public.quizzes (id) on delete cascade,
  answers       jsonb not null default '{}'::jsonb,
  score         smallint check (score between 0 and 100),
  passed        boolean,
  started_at    timestamptz not null default now(),
  submitted_at  timestamptz
);

create index quiz_attempts_child_idx on public.quiz_attempts (child_id, quiz_id);

-- ---------------------------------------------------------------------------
-- Idea Lab
-- ---------------------------------------------------------------------------

create table public.startup_projects (
  id                    uuid primary key default gen_random_uuid(),
  child_id              uuid not null references public.child_profiles (id) on delete cascade,
  name                  text not null check (char_length(name) between 1 and 40),
  icon_key              text not null default 'lightbulb',
  problem               text not null default '' check (char_length(problem) <= 400),
  solution              text not null default '' check (char_length(solution) <= 400),
  target_customer_tags  text[] not null default '{}' check (cardinality(target_customer_tags) <= 8),
  target_customer_note  text not null default '' check (char_length(target_customer_note) <= 200),
  value_statement       text not null default '' check (char_length(value_statement) <= 200),
  status                text not null default 'draft' check (status in ('draft', 'ready', 'archived')),
  -- Projects are private in the MVP. The column exists to make the rule explicit.
  visibility            text not null default 'private' check (visibility = 'private'),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (id, child_id)
);

create index startup_projects_child_idx on public.startup_projects (child_id);

create trigger startup_projects_updated_at
  before update on public.startup_projects
  for each row execute function public.set_updated_at();

-- Maximum 10 active (non-archived) projects per child.
create or replace function public.enforce_active_project_limit()
returns trigger
language plpgsql
as $$
begin
  if new.status <> 'archived' and (
    select count(*) from public.startup_projects p
    where p.child_id = new.child_id and p.status <> 'archived' and p.id <> new.id
  ) >= 10 then
    raise exception 'A founder can have at most 10 active projects'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger startup_projects_active_limit
  before insert or update of status on public.startup_projects
  for each row execute function public.enforce_active_project_limit();

-- ---------------------------------------------------------------------------
-- Startup Simulator (amounts are fictional virtual currency)
-- ---------------------------------------------------------------------------

create table public.simulator_sessions (
  id               uuid primary key default gen_random_uuid(),
  child_id         uuid not null references public.child_profiles (id) on delete cascade,
  project_id       uuid,
  scenario_id      uuid not null references public.simulator_scenarios (id),
  seed             integer not null,
  starting_budget  integer not null check (starting_budget > 0),
  current_round    smallint not null default 0,
  status           text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  final_summary    jsonb,
  created_at       timestamptz not null default now(),
  completed_at     timestamptz,
  unique (id, child_id),
  foreign key (project_id, child_id)
    references public.startup_projects (id, child_id) on delete cascade
);

create index simulator_sessions_child_idx on public.simulator_sessions (child_id);

create table public.simulator_rounds (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references public.simulator_sessions (id) on delete cascade,
  round            smallint not null check (round >= 1),
  quantity         integer not null check (quantity >= 0),
  unit_price       numeric(10, 2) not null check (unit_price >= 0),
  marketing_spend  numeric(10, 2) not null default 0 check (marketing_spend >= 0),
  event_key        text,
  event_choice     text,
  units_sold       integer not null check (units_sold >= 0),
  revenue          numeric(12, 2) not null,
  cost             numeric(12, 2) not null,
  profit           numeric(12, 2) not null,
  budget_after     numeric(12, 2) not null,
  feedback_keys    text[] not null default '{}',
  created_at       timestamptz not null default now(),
  unique (session_id, round)
);

-- ---------------------------------------------------------------------------
-- Pitch Studio
-- ---------------------------------------------------------------------------

create table public.pitch_decks (
  id                    uuid primary key default gen_random_uuid(),
  child_id              uuid not null references public.child_profiles (id) on delete cascade,
  project_id            uuid,
  simulator_session_id  uuid,
  title                 text not null check (char_length(title) between 1 and 60),
  theme_key             text not null default 'sunrise',
  status                text not null default 'draft' check (status in ('draft', 'ready')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (id, child_id),
  foreign key (project_id, child_id)
    references public.startup_projects (id, child_id) on delete set null (project_id),
  foreign key (simulator_session_id, child_id)
    references public.simulator_sessions (id, child_id) on delete set null (simulator_session_id)
);

create index pitch_decks_child_idx on public.pitch_decks (child_id);

create trigger pitch_decks_updated_at
  before update on public.pitch_decks
  for each row execute function public.set_updated_at();

create table public.pitch_slides (
  id          uuid primary key default gen_random_uuid(),
  deck_id     uuid not null references public.pitch_decks (id) on delete cascade,
  section     text not null check (section in ('problem', 'solution', 'customer', 'business_model', 'ask')),
  layout_key  text not null default 'classic',
  content     jsonb not null default '{}'::jsonb check (pg_column_size(content) <= 8192),
  position    smallint not null check (position between 1 and 5),
  unique (deck_id, section),
  unique (deck_id, position)
);

-- ---------------------------------------------------------------------------
-- Investor Room (scripted personas; no real investors or money)
-- ---------------------------------------------------------------------------

create table public.investor_sessions (
  id             uuid primary key default gen_random_uuid(),
  child_id       uuid not null references public.child_profiles (id) on delete cascade,
  deck_id        uuid not null,
  persona_id     uuid not null references public.investor_personas (id),
  question_ids   uuid[] not null default '{}',
  total_score    smallint check (total_score between 0 and 100),
  sub_scores     jsonb,
  band           text check (band in ('keep_building', 'promising', 'ready_to_grow')),
  decision       text check (decision in ('invest', 'come_back')),
  tips_keys      text[] not null default '{}',
  deck_snapshot  jsonb not null,
  created_at     timestamptz not null default now(),
  completed_at   timestamptz,
  foreign key (deck_id, child_id)
    references public.pitch_decks (id, child_id) on delete cascade
);

create index investor_sessions_child_idx on public.investor_sessions (child_id);

create table public.investor_responses (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.investor_sessions (id) on delete cascade,
  question_id  uuid not null references public.investor_questions (id),
  option_id    uuid not null references public.investor_answer_options (id),
  note         text check (char_length(note) <= 200),  -- optional, never scored
  score        smallint not null check (score between 0 and 3),
  created_at   timestamptz not null default now(),
  unique (session_id, question_id)
);

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------

alter table public.lesson_progress     enable row level security;
alter table public.activity_responses  enable row level security;
alter table public.quiz_attempts       enable row level security;
alter table public.startup_projects    enable row level security;
alter table public.simulator_sessions  enable row level security;
alter table public.simulator_rounds    enable row level security;
alter table public.pitch_decks         enable row level security;
alter table public.pitch_slides        enable row level security;
alter table public.investor_sessions   enable row level security;
alter table public.investor_responses  enable row level security;

revoke all on public.lesson_progress, public.activity_responses, public.quiz_attempts,
              public.startup_projects, public.simulator_sessions, public.simulator_rounds,
              public.pitch_decks, public.pitch_slides, public.investor_sessions,
              public.investor_responses
  from anon;

-- Guardian-writable tables keyed directly by child_id.
do $$
declare
  t text;
begin
  foreach t in array array['lesson_progress', 'activity_responses', 'startup_projects', 'pitch_decks']
  loop
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (public.is_guardian_of(child_id))
         with check (public.is_guardian_of(child_id))',
      t || '_guardian_all', t
    );
  end loop;
end;
$$;

-- Server-written tables keyed directly by child_id: guardian may only read.
do $$
declare
  t text;
begin
  foreach t in array array['quiz_attempts', 'simulator_sessions', 'investor_sessions']
  loop
    execute format('revoke insert, update, delete on public.%I from authenticated', t);
    execute format(
      'create policy %I on public.%I for select to authenticated
         using (public.is_guardian_of(child_id))',
      t || '_guardian_read', t
    );
  end loop;
end;
$$;

-- Child tables reached through a parent row.
create policy pitch_slides_guardian_all on public.pitch_slides
  for all to authenticated
  using (exists (
    select 1 from public.pitch_decks d
    where d.id = deck_id and public.is_guardian_of(d.child_id)
  ))
  with check (exists (
    select 1 from public.pitch_decks d
    where d.id = deck_id and public.is_guardian_of(d.child_id)
  ));

revoke insert, update, delete on public.simulator_rounds, public.investor_responses from authenticated;

create policy simulator_rounds_guardian_read on public.simulator_rounds
  for select to authenticated
  using (exists (
    select 1 from public.simulator_sessions s
    where s.id = session_id and public.is_guardian_of(s.child_id)
  ));

create policy investor_responses_guardian_read on public.investor_responses
  for select to authenticated
  using (exists (
    select 1 from public.investor_sessions s
    where s.id = session_id and public.is_guardian_of(s.child_id)
  ));
