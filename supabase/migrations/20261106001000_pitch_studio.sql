-- LITTLE FOUNDERS · 0010 Pitch Studio & Investor Room (Phase 6)
-- Rules, rubric and question sets: docs/PITCH_STUDIO.md. Personas and questions are seeded
-- from src/content/investor-room.ts; limits and the privacy check mirror src/content/pitch-studio.ts.
--
-- Trust model (same as Phases 3–5):
--   * pitch_decks / pitch_slides become read-only to clients (they were guardian-writable in 0003).
--     Every write goes through SECURITY DEFINER functions acting for the child in the caller's
--     active Child Mode (public.learning_child()); no client-supplied child id is trusted.
--   * Finishing a pitch stores an immutable pitch_versions snapshot. Investor Room practice is
--     tied to one version, so revising a pitch never changes an earlier evaluation.
--   * Investor answers are scored here, deterministically, from predefined options (scores are
--     hidden from clients by column grants). Completed practice records are immutable.
--   * Pretend investors only: no investment decisions, funding offers or real investors.
--   * Pitch text is checked for contact details, addresses and links and refused if found.

-- ---------------------------------------------------------------------------
-- Content: persona order/style, stable question keys, hints
-- ---------------------------------------------------------------------------

alter table public.investor_personas
  add column position smallint not null default 1,
  add column style    text not null default '';

alter table public.investor_questions
  add column key      text unique check (key ~ '^[a-z0-9-]+$'),
  add column position smallint not null default 1,
  add column hint     text not null default '';

-- ---------------------------------------------------------------------------
-- Pitch decks and slides
-- ---------------------------------------------------------------------------

alter table public.pitch_decks
  add column tagline      text not null default '' check (char_length(tagline) <= 160),
  add column icon_key     text not null default 'lightbulb'
    check (icon_key in ('lightbulb', 'rocket', 'leaf', 'paw', 'book', 'palette', 'bike', 'recycle', 'heart', 'star', 'music', 'house')),
  add column builder_step smallint not null default 1 check (builder_step between 1 and 6),
  add constraint pitch_decks_theme_check check (theme_key in ('sunrise', 'ocean', 'meadow', 'berry'));

create index pitch_decks_child_updated_idx on public.pitch_decks (child_id, updated_at desc);
create index pitch_decks_project_idx on public.pitch_decks (project_id);

alter table public.pitch_slides
  add constraint pitch_slides_content_shape check (
    jsonb_typeof(content) = 'object'
    and char_length(coalesce(content ->> 'main', '')) <= 280
    and char_length(coalesce(content ->> 'extra', '')) <= 200
  );

-- Pitches are written only through the functions below; parents keep read access.
revoke insert, update, delete on public.pitch_decks, public.pitch_slides from authenticated;
drop policy pitch_decks_guardian_all on public.pitch_decks;
drop policy pitch_slides_guardian_all on public.pitch_slides;
create policy pitch_decks_guardian_read on public.pitch_decks
  for select to authenticated using (public.is_guardian_of(child_id));
create policy pitch_slides_guardian_read on public.pitch_slides
  for select to authenticated
  using (exists (select 1 from public.pitch_decks d where d.id = deck_id and public.is_guardian_of(d.child_id)));

-- ---------------------------------------------------------------------------
-- Completed pitch versions (historical records)
-- ---------------------------------------------------------------------------

create table public.pitch_versions (
  id          uuid primary key default gen_random_uuid(),
  deck_id     uuid not null,
  child_id    uuid not null references public.child_profiles (id) on delete cascade,
  version     smallint not null check (version >= 1),
  snapshot    jsonb not null check (jsonb_typeof(snapshot) = 'object' and octet_length(snapshot::text) <= 8192),
  created_at  timestamptz not null default now(),
  unique (deck_id, version),
  unique (id, child_id),
  foreign key (deck_id, child_id) references public.pitch_decks (id, child_id) on delete cascade
);

create index pitch_versions_child_idx on public.pitch_versions (child_id, created_at desc);

alter table public.pitch_versions enable row level security;
revoke all on public.pitch_versions from anon, authenticated;
grant select on public.pitch_versions to authenticated;
create policy pitch_versions_guardian_read on public.pitch_versions
  for select to authenticated using (public.is_guardian_of(child_id));

create or replace function public.pitch_versions_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Completed pitch versions cannot be changed' using errcode = 'check_violation';
end;
$$;

create trigger pitch_versions_immutable
  before update on public.pitch_versions
  for each row execute function public.pitch_versions_guard();

-- ---------------------------------------------------------------------------
-- Investor Room practice records
-- ---------------------------------------------------------------------------

alter table public.investor_sessions
  add column pitch_version_id uuid not null,
  add column points smallint check (points between 0 and 20),
  add constraint investor_sessions_version_fk
    foreign key (pitch_version_id, child_id) references public.pitch_versions (id, child_id) on delete cascade,
  -- Practice only: pretend investors never make investment decisions.
  add constraint investor_sessions_no_decisions check (decision is null),
  add constraint investor_sessions_complete_shape check (
    (completed_at is null) = (total_score is null)
    and (completed_at is null) = (points is null)
    and (completed_at is null) = (band is null)
  );

create index investor_sessions_deck_idx on public.investor_sessions (deck_id, created_at desc);

-- bonus: the "own words" point. review: what the child saw after answering (question, the
-- answer they picked, its feedback), kept with the record so history never changes.
alter table public.investor_responses
  add column bonus  smallint not null default 0 check (bonus between 0 and 1),
  add column review jsonb not null default '{}'::jsonb check (octet_length(review::text) <= 4096);

create or replace function public.investor_sessions_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.completed_at is not null then
    raise exception 'Completed practice results cannot be changed' using errcode = 'check_violation';
  end if;
  if new.child_id is distinct from old.child_id or new.deck_id is distinct from old.deck_id
     or new.persona_id is distinct from old.persona_id or new.pitch_version_id is distinct from old.pitch_version_id
     or new.question_ids is distinct from old.question_ids or new.deck_snapshot is distinct from old.deck_snapshot then
    raise exception 'Practice setup cannot be changed' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger investor_sessions_immutable
  before update on public.investor_sessions
  for each row execute function public.investor_sessions_guard();

create or replace function public.investor_responses_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Practice answers cannot be changed' using errcode = 'check_violation';
end;
$$;

create trigger investor_responses_immutable
  before update on public.investor_responses
  for each row execute function public.investor_responses_guard();

-- ---------------------------------------------------------------------------
-- Validation helpers (mirrors of src/content/pitch-studio.ts)
-- ---------------------------------------------------------------------------

-- True when text looks like contact details, an address, a link or a social handle.
create or replace function public.pitch_personal_info(t text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(t, '') ~* '[a-z0-9._%+-]+@[a-z0-9-]+\.[a-z.]+'
      or coalesce(t, '') ~ '(\+?[0-9][ -]?){7,}'
      or coalesce(t, '') ~* '(https?://|www\.)'
      or coalesce(t, '') ~* '\m[a-z0-9-]+\.(com|net|org|io|co|uk|app|dev|me|info|biz)\M'
      or coalesce(t, '') ~* '\m[0-9]{1,4}\s+[a-z]+\s+(street|st|road|rd|avenue|ave|lane|close|drive)\M'
      or coalesce(t, '') ~* '(^|\s)@[a-z0-9_]{2,}';
$$;

-- "Own words" bonus: at least 6 words, at least 4 of them different (ignoring capitals).
create or replace function public.own_words_bonus(note text)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select case when count(*) >= 6 and count(distinct lower(w)) >= 4 then 1 else 0 end::smallint
  from regexp_split_to_table(btrim(coalesce(note, '')), '\s+') w
  where w ~ '[[:alpha:]]';
$$;

-- The deck as it is now, in the same shape as pitch_versions.snapshot.
create or replace function public.pitch_snapshot(p_deck uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'title', d.title, 'tagline', d.tagline, 'icon_key', d.icon_key, 'theme_key', d.theme_key,
    'sections', coalesce((select jsonb_object_agg(s.section, jsonb_build_object(
        'main', coalesce(s.content ->> 'main', ''), 'extra', coalesce(s.content ->> 'extra', '')))
      from public.pitch_slides s where s.deck_id = d.id), '{}'::jsonb))
  from public.pitch_decks d where d.id = p_deck;
$$;

-- Validates builder fields. Returns null when valid, otherwise an error status.
create or replace function public.pitch_fields_problem(fields jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  e record;
  limit_for integer;
begin
  if fields is null or jsonb_typeof(fields) <> 'object' or octet_length(fields::text) > 6000 then
    return 'invalid';
  end if;
  for e in select * from jsonb_each(fields) loop
    if jsonb_typeof(e.value) <> 'string' then
      return 'invalid';
    end if;
    limit_for := case
      when e.key = 'title' then 60
      when e.key = 'tagline' then 160
      when e.key in ('problem', 'solution', 'customer', 'business_model', 'ask') then 280
      when e.key in ('problem_extra', 'solution_extra', 'customer_extra', 'business_model_extra', 'ask_extra') then 200
      when e.key in ('icon_key', 'theme_key') then 20
      else null
    end;
    if limit_for is null or char_length(btrim(e.value #>> '{}')) > limit_for then
      return 'invalid';
    end if;
    if e.key = 'icon_key' and (e.value #>> '{}') not in
         ('lightbulb', 'rocket', 'leaf', 'paw', 'book', 'palette', 'bike', 'recycle', 'heart', 'star', 'music', 'house') then
      return 'invalid';
    end if;
    if e.key = 'theme_key' and (e.value #>> '{}') not in ('sunrise', 'ocean', 'meadow', 'berry') then
      return 'invalid';
    end if;
    if public.pitch_personal_info(e.value #>> '{}') then
      return 'personal_info';
    end if;
  end loop;
  return null;
end;
$$;

-- Applies validated fields to a deck and its slides.
create or replace function public.pitch_apply_fields(p_deck uuid, fields jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  sec text;
begin
  update public.pitch_decks d set
    title     = case when fields ? 'title' then coalesce(nullif(btrim(fields ->> 'title'), ''), 'My pitch') else d.title end,
    tagline   = case when fields ? 'tagline' then btrim(fields ->> 'tagline') else d.tagline end,
    icon_key  = case when fields ? 'icon_key' then fields ->> 'icon_key' else d.icon_key end,
    theme_key = case when fields ? 'theme_key' then fields ->> 'theme_key' else d.theme_key end
  where d.id = p_deck;
  foreach sec in array array['problem', 'solution', 'customer', 'business_model', 'ask'] loop
    if fields ? sec or fields ? (sec || '_extra') then
      update public.pitch_slides s set content = jsonb_build_object(
          'main', case when fields ? sec then btrim(fields ->> sec) else coalesce(s.content ->> 'main', '') end,
          'extra', case when fields ? (sec || '_extra') then btrim(fields ->> (sec || '_extra')) else coalesce(s.content ->> 'extra', '') end)
        where s.deck_id = p_deck and s.section = sec;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Pitch Studio
-- ---------------------------------------------------------------------------

-- Start a pitch from one of the active child's Idea Lab ideas, or resume the pitch that
-- already exists for that idea. prefill: builder fields worked out from the idea by the app
-- (validated exactly like a save).
create or replace function public.start_pitch(project_id uuid, prefill jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  child uuid := public.learning_child();
  proj public.startup_projects%rowtype;
  existing uuid;
  new_deck uuid;
  problem text;
begin
  if child is null then
    return jsonb_build_object('status', 'not_in_child_mode');
  end if;
  select * into proj from public.startup_projects p
    where p.id = start_pitch.project_id and p.child_id = child and p.status <> 'archived';
  if not found then
    return jsonb_build_object('status', 'idea_required');
  end if;

  select d.id into existing from public.pitch_decks d
    where d.child_id = child and d.project_id = proj.id order by d.created_at limit 1;
  if existing is not null then
    return jsonb_build_object('status', 'ok', 'id', existing, 'resumed', true);
  end if;

  problem := public.pitch_fields_problem(coalesce(prefill, '{}'::jsonb));
  if problem is not null then
    return jsonb_build_object('status', problem);
  end if;
  if (select count(*) from public.pitch_decks d where d.child_id = child) >= 20 then
    return jsonb_build_object('status', 'limit_reached');
  end if;
  if (select count(*) from public.pitch_decks d where d.child_id = child and d.created_at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  insert into public.pitch_decks (child_id, project_id, title, icon_key)
    values (child, proj.id, left(proj.name, 60), proj.icon_key)
    returning id into new_deck;
  insert into public.pitch_slides (deck_id, section, position, content)
    select new_deck, s.section, s.position, '{"main": "", "extra": ""}'::jsonb
    from unnest(array['problem', 'solution', 'customer', 'business_model', 'ask']) with ordinality as s(section, position);
  perform public.pitch_apply_fields(new_deck, coalesce(prefill, '{}'::jsonb));
  return jsonb_build_object('status', 'ok', 'id', new_deck, 'resumed', false);
end;
$$;

-- Save builder fields (any subset), remember the step, and optionally finish the pitch.
-- Finishing needs every required section; it stores a new immutable version when the content
-- differs from the latest one. Editing a finished pitch makes it "revising" until finished again.
create or replace function public.save_pitch(deck_id uuid, fields jsonb, step smallint default null, finish boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  child uuid := public.learning_child();
  deck public.pitch_decks%rowtype;
  problem text;
  snap jsonb;
  latest_version smallint;
  latest_snap jsonb;
  missing text[] := '{}';
  sec text;
  version_no smallint;
  newly text[] := '{}';
begin
  if child is null then
    return jsonb_build_object('status', 'not_in_child_mode');
  end if;
  problem := public.pitch_fields_problem(fields);
  if problem is not null or (step is not null and step not between 1 and 6) then
    return jsonb_build_object('status', coalesce(problem, 'invalid'));
  end if;
  select * into deck from public.pitch_decks d where d.id = save_pitch.deck_id and d.child_id = child for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  perform public.pitch_apply_fields(deck.id, fields);
  update public.pitch_decks d set builder_step = coalesce(step, d.builder_step) where d.id = deck.id;

  snap := public.pitch_snapshot(deck.id);
  select v.version, v.snapshot into latest_version, latest_snap from public.pitch_versions v
    where v.deck_id = deck.id order by v.version desc limit 1;

  if finish then
    if char_length(btrim(snap ->> 'title')) < 2 then
      missing := missing || 'title'::text;
    end if;
    foreach sec in array array['problem', 'solution', 'customer', 'business_model'] loop
      if char_length(btrim(coalesce(snap #>> array['sections', sec, 'main'], ''))) < 10 then
        missing := missing || sec;
      end if;
    end loop;
    if cardinality(missing) > 0 then
      update public.pitch_decks d set status = case when latest_snap = snap then 'ready' else 'draft' end where d.id = deck.id;
      return jsonb_build_object('status', 'incomplete', 'missing', to_jsonb(missing), 'id', deck.id);
    end if;
    if latest_snap is distinct from snap then
      if (select count(*) from public.pitch_versions v where v.child_id = child and v.created_at > now() - interval '1 hour') >= 10
         or coalesce(latest_version, 0) >= 30 then
        return jsonb_build_object('status', 'rate_limited', 'id', deck.id);
      end if;
      version_no := coalesce(latest_version, 0) + 1;
      insert into public.pitch_versions (deck_id, child_id, version, snapshot) values (deck.id, child, version_no, snap);
    else
      version_no := latest_version;
    end if;
    update public.pitch_decks d set status = 'ready' where d.id = deck.id;
    newly := public.evaluate_achievements(child, 'pitch:' || deck.id::text);
    return jsonb_build_object('status', 'ok', 'id', deck.id, 'deck_status', 'ready', 'version', version_no,
                              'achievements', to_jsonb(newly));
  end if;

  update public.pitch_decks d set status = case when latest_snap = snap then 'ready' else 'draft' end
    where d.id = deck.id returning d.status into deck.status;
  return jsonb_build_object('status', 'ok', 'id', deck.id, 'deck_status', deck.status, 'version', latest_version,
                            'achievements', '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Investor Room
-- ---------------------------------------------------------------------------

-- Start (or resume) a practice with one pretend investor, using the latest finished version.
create or replace function public.start_investor_practice(deck_id uuid, persona_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  child uuid := public.learning_child();
  ver public.pitch_versions%rowtype;
  persona public.investor_personas%rowtype;
  existing uuid;
  questions uuid[];
  session_id uuid;
begin
  if child is null then
    return jsonb_build_object('status', 'not_in_child_mode');
  end if;
  if not exists (select 1 from public.pitch_decks d where d.id = start_investor_practice.deck_id and d.child_id = child) then
    return jsonb_build_object('status', 'not_found');
  end if;
  select * into ver from public.pitch_versions v
    where v.deck_id = start_investor_practice.deck_id and v.child_id = child order by v.version desc limit 1;
  if not found then
    return jsonb_build_object('status', 'pitch_not_finished');
  end if;
  select * into persona from public.investor_personas p where p.key = persona_key;
  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;

  select s.id into existing from public.investor_sessions s
    where s.child_id = child and s.pitch_version_id = ver.id and s.persona_id = persona.id and s.completed_at is null
    order by s.created_at desc limit 1;
  if existing is not null then
    return jsonb_build_object('status', 'ok', 'id', existing, 'resumed', true);
  end if;

  if (select count(*) from public.investor_sessions s where s.child_id = child and s.created_at > now() - interval '1 hour') >= 20 then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  select array_agg(q.id order by q.position) into questions from public.investor_questions q where q.persona_id = persona.id;
  if coalesce(cardinality(questions), 0) = 0 then
    return jsonb_build_object('status', 'invalid');
  end if;

  insert into public.investor_sessions (child_id, deck_id, persona_id, pitch_version_id, question_ids, deck_snapshot)
    values (child, ver.deck_id, persona.id, ver.id, questions, ver.snapshot || jsonb_build_object('version', ver.version))
    returning id into session_id;
  return jsonb_build_object('status', 'ok', 'id', session_id, 'resumed', false);
end;
$$;

-- Answer the next question: score the chosen option and the optional "own words" note,
-- store the result, and complete the practice after the last question.
create or replace function public.answer_investor_question(session_id uuid, question_id uuid, option_id uuid, note text default '')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  child uuid := public.learning_child();
  sess public.investor_sessions%rowtype;
  q public.investor_questions%rowtype;
  opt public.investor_answer_options%rowtype;
  best text;
  clean text := btrim(coalesce(note, ''));
  bonus smallint;
  answered integer;
  total_points integer;
  subs jsonb;
  tips text[];
  pct integer;
  band_key text;
  newly text[] := '{}';
begin
  if child is null then
    return jsonb_build_object('status', 'not_in_child_mode');
  end if;
  select * into sess from public.investor_sessions s where s.id = answer_investor_question.session_id and s.child_id = child for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if sess.completed_at is not null then
    return jsonb_build_object('status', 'already_completed');
  end if;
  if char_length(clean) > 200 then
    return jsonb_build_object('status', 'invalid');
  end if;
  if public.pitch_personal_info(clean) then
    return jsonb_build_object('status', 'personal_info');
  end if;

  select count(*) into answered from public.investor_responses r where r.session_id = sess.id;
  if answered >= cardinality(sess.question_ids) then
    return jsonb_build_object('status', 'already_completed');
  end if;
  if sess.question_ids[answered + 1] is distinct from answer_investor_question.question_id then
    return jsonb_build_object('status', case when answer_investor_question.question_id = any (sess.question_ids)
                                             then 'out_of_order' else 'invalid' end);
  end if;
  select * into q from public.investor_questions x where x.id = answer_investor_question.question_id;
  select * into opt from public.investor_answer_options o
    where o.id = answer_investor_question.option_id and o.question_id = q.id;
  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;
  select o.label into best from public.investor_answer_options o where o.question_id = q.id order by o.score desc, o.position limit 1;

  bonus := public.own_words_bonus(clean);
  insert into public.investor_responses (session_id, question_id, option_id, note, score, bonus, review)
    values (sess.id, q.id, opt.id, nullif(clean, ''), opt.score, bonus, jsonb_build_object(
      'section', q.section, 'prompt', q.prompt, 'answer', opt.label, 'feedback', opt.feedback,
      'stronger', case when opt.score < 3 then best end));
  answered := answered + 1;

  if answered < cardinality(sess.question_ids) then
    return jsonb_build_object('status', 'ok', 'score', opt.score, 'bonus', bonus, 'feedback', opt.feedback,
                              'stronger', case when opt.score < 3 then best end, 'completed', false);
  end if;

  -- Last answer: work out the rubric (one criterion per section, 0–4 each).
  select sum(r.score + r.bonus), jsonb_object_agg(x.section, r.score + r.bonus),
         array_agg(x.section order by array_position(sess.question_ids, x.id)) filter (where r.score + r.bonus < 3)
    into total_points, subs, tips
    from public.investor_responses r join public.investor_questions x on x.id = r.question_id
    where r.session_id = sess.id;
  if (select count(*) from public.investor_responses r where r.session_id = sess.id and r.bonus = 0) > 0 then
    tips := coalesce(tips, '{}') || 'own-words'::text;
  end if;
  pct := round(total_points * 100.0 / (4 * cardinality(sess.question_ids)));
  band_key := case when pct >= 80 then 'ready_to_grow' when pct >= 50 then 'promising' else 'keep_building' end;

  update public.investor_sessions s
    set points = total_points, total_score = pct, sub_scores = subs, band = band_key,
        tips_keys = coalesce(tips, '{}'), completed_at = now()
    where s.id = sess.id;
  newly := public.evaluate_achievements(child, 'practice:' || sess.id::text);

  return jsonb_build_object('status', 'ok', 'score', opt.score, 'bonus', bonus, 'feedback', opt.feedback,
                            'stronger', case when opt.score < 3 then best end, 'completed', true,
                            'points', total_points, 'total_score', pct, 'band', band_key, 'sub_scores', subs,
                            'achievements', to_jsonb(newly));
end;
$$;

-- ---------------------------------------------------------------------------
-- Achievements: add "pitches_completed" (First Pitch) and "practices_completed"
-- (Confident Founder). Same as 0009 plus two cases.
-- ---------------------------------------------------------------------------
create or replace function public.evaluate_achievements(p_child uuid, p_source text)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  ach record;
  cert record;
  lessons_done integer;
  modules_done integer;
  ideas_done integer;
  sims_done integer;
  pitches_done integer;
  practices_done integer;
  met boolean;
  earned text[] := '{}';
begin
  select count(*) into lessons_done
    from public.lesson_progress where child_id = p_child and status = 'completed';
  select count(*) into modules_done
    from public.modules m where public.module_completed(p_child, m.id);
  select count(*) into ideas_done
    from public.startup_projects where child_id = p_child and status = 'ready';
  select count(*) into sims_done
    from public.simulator_sessions where child_id = p_child and status = 'completed';
  select count(distinct deck_id) into pitches_done
    from public.pitch_versions where child_id = p_child;
  select count(*) into practices_done
    from public.investor_sessions where child_id = p_child and completed_at is not null;

  for ach in
    select a.* from public.achievements a
    where not exists (
      select 1 from public.child_achievements ca where ca.child_id = p_child and ca.achievement_id = a.id
    )
  loop
    met := case ach.rule ->> 'type'
      when 'lessons_completed' then lessons_done >= (ach.rule ->> 'count')::integer
      when 'modules_completed' then modules_done >= (ach.rule ->> 'count')::integer
      when 'module_completed' then coalesce(
        (select public.module_completed(p_child, m.id) from public.modules m where m.key = ach.rule ->> 'module'), false)
      when 'perfect_quiz' then exists (
        select 1 from public.quiz_attempts qa where qa.child_id = p_child and qa.score = 100)
      when 'ideas_created' then ideas_done >= (ach.rule ->> 'count')::integer
      when 'simulations_completed' then sims_done >= (ach.rule ->> 'count')::integer
      when 'pitches_completed' then pitches_done >= (ach.rule ->> 'count')::integer
      when 'practices_completed' then practices_done >= (ach.rule ->> 'count')::integer
      else false
    end;
    if met then
      insert into public.child_achievements (child_id, achievement_id, source_event)
        values (p_child, ach.id, left(p_source, 60))
        on conflict do nothing;
      earned := earned || ach.key;
    end if;
  end loop;

  for cert in
    select ct.* from public.certificate_types ct
    where not exists (
      select 1 from public.certificates c where c.child_id = p_child and c.certificate_type_id = ct.id
    )
  loop
    if cert.requirement ->> 'type' = 'modules_completed'
       and modules_done >= (cert.requirement ->> 'count')::integer then
      insert into public.certificates (child_id, certificate_type_id, verification_code)
        values (p_child, cert.id, encode(extensions.gen_random_bytes(12), 'hex'))
        on conflict do nothing;
    end if;
  end loop;

  return earned;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke execute on function
  public.pitch_versions_guard(),
  public.investor_sessions_guard(),
  public.investor_responses_guard(),
  public.pitch_personal_info(text),
  public.own_words_bonus(text),
  public.pitch_snapshot(uuid),
  public.pitch_fields_problem(jsonb),
  public.pitch_apply_fields(uuid, jsonb),
  public.start_pitch(uuid, jsonb),
  public.save_pitch(uuid, jsonb, smallint, boolean),
  public.start_investor_practice(uuid, text),
  public.answer_investor_question(uuid, uuid, uuid, text),
  public.evaluate_achievements(uuid, text)
from public, anon, authenticated;

grant execute on function
  public.start_pitch(uuid, jsonb),
  public.save_pitch(uuid, jsonb, smallint, boolean),
  public.start_investor_practice(uuid, text),
  public.answer_investor_question(uuid, uuid, uuid, text)
to authenticated;
