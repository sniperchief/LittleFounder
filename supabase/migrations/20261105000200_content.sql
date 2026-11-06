-- LITTLE FOUNDERS · 0002 Curriculum & game content (Public-Content)
-- Authored in the repository and seeded by the server. Read-only to clients.
-- Answer keys, correctness flags and rubric scores are never exposed to clients:
-- they are excluded via column-level grants. See docs/DATABASE_SCHEMA.md §4.

create table public.modules (
  id               uuid primary key default gen_random_uuid(),
  key              text not null unique check (key ~ '^[a-z0-9-]+$'),
  position         smallint not null unique check (position between 1 and 50),
  title            text not null,
  summary          text not null,
  icon_key         text not null,
  content_version  smallint not null default 1
);

create table public.lessons (
  id           uuid primary key default gen_random_uuid(),
  module_id    uuid not null references public.modules (id) on delete cascade,
  key          text not null unique check (key ~ '^[a-z0-9-]+$'),
  position     smallint not null,
  title        text not null,
  est_minutes  smallint not null default 5 check (est_minutes between 1 and 30),
  body         jsonb not null default '[]'::jsonb,
  unique (module_id, position)
);

create table public.lesson_activities (
  id          uuid primary key default gen_random_uuid(),
  lesson_id   uuid not null references public.lessons (id) on delete cascade,
  key         text not null unique,
  kind        text not null check (kind in ('sort', 'match', 'choose', 'fill')),
  config      jsonb not null default '{}'::jsonb,
  answer_key  jsonb not null default '{}'::jsonb   -- hidden from clients
);

create table public.quizzes (
  id         uuid primary key default gen_random_uuid(),
  module_id  uuid not null unique references public.modules (id) on delete cascade,
  pass_mark  smallint not null default 60 check (pass_mark between 0 and 100)
);

create table public.quiz_questions (
  id           uuid primary key default gen_random_uuid(),
  quiz_id      uuid not null references public.quizzes (id) on delete cascade,
  position     smallint not null,
  kind         text not null check (kind in ('single', 'true_false', 'order')),
  prompt       text not null,
  explanation  text not null default '',   -- shown after server scoring
  unique (quiz_id, position)
);

create table public.quiz_options (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references public.quiz_questions (id) on delete cascade,
  position     smallint not null,
  label        text not null,
  is_correct   boolean not null default false,  -- hidden from clients
  feedback     text not null default '',        -- hidden until scored
  unique (question_id, position)
);

create table public.simulator_scenarios (
  id               uuid primary key default gen_random_uuid(),
  key              text not null unique,
  title            text not null,
  product_kind     text not null,
  starting_budget  integer not null check (starting_budget > 0),  -- fictional currency units
  unit_cost_base   numeric(10, 2) not null check (unit_cost_base >= 0),
  demand_params    jsonb not null default '{}'::jsonb,
  rounds           smallint not null default 6 check (rounds between 1 and 20)
);

create table public.simulator_events (
  id             uuid primary key default gen_random_uuid(),
  scenario_id    uuid references public.simulator_scenarios (id) on delete cascade,  -- null = any scenario
  key            text not null unique,
  trigger_round  smallint,
  choices        jsonb not null default '[]'::jsonb,
  effects        jsonb not null default '{}'::jsonb,
  lesson_text    text not null default ''
);

create table public.investor_personas (
  id              uuid primary key default gen_random_uuid(),
  key             text not null unique,
  name            text not null,
  avatar_key      text not null,
  focus           text not null,
  rubric_weights  jsonb not null default '{}'::jsonb,
  intro_text      text not null default ''
);

create table public.investor_questions (
  id          uuid primary key default gen_random_uuid(),
  persona_id  uuid references public.investor_personas (id) on delete cascade,  -- null = shared bank
  section     text not null check (section in ('problem', 'solution', 'customer', 'business_model', 'ask')),
  difficulty  smallint not null default 1 check (difficulty between 1 and 3),
  prompt      text not null
);

create table public.investor_answer_options (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references public.investor_questions (id) on delete cascade,
  position     smallint not null,
  label        text not null,
  score        smallint not null check (score between 0 and 3),  -- hidden from clients
  feedback     text not null default '',                          -- hidden until scored
  unique (question_id, position)
);

create table public.achievements (
  id           uuid primary key default gen_random_uuid(),
  key          text not null unique,
  title        text not null,
  description  text not null,
  icon_key     text not null,
  rule         jsonb not null default '{}'::jsonb,
  tier         smallint not null default 1 check (tier between 1 and 3)
);

create table public.certificate_types (
  id                uuid primary key default gen_random_uuid(),
  key               text not null unique,
  title             text not null,
  requirement       jsonb not null default '{}'::jsonb,
  onchain_eligible  boolean not null default false
);

-- ---------------------------------------------------------------------------
-- RLS: everyone may read content; nobody but the server may write it.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'modules', 'lessons', 'lesson_activities', 'quizzes', 'quiz_questions', 'quiz_options',
    'simulator_scenarios', 'simulator_events', 'investor_personas', 'investor_questions',
    'investor_answer_options', 'achievements', 'certificate_types'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      t || '_read', t
    );
  end loop;
end;
$$;

-- Whole-table read access for non-sensitive content.
grant select on public.modules, public.lessons, public.quizzes, public.quiz_questions,
                public.simulator_scenarios, public.simulator_events, public.investor_personas,
                public.investor_questions, public.achievements, public.certificate_types
  to anon, authenticated;

-- Column-level read access where a table holds answer keys or scores.
grant select (id, lesson_id, key, kind, config)
  on public.lesson_activities to anon, authenticated;
grant select (id, question_id, position, label)
  on public.quiz_options to anon, authenticated;
grant select (id, question_id, position, label)
  on public.investor_answer_options to anon, authenticated;
