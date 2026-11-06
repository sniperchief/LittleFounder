-- LITTLE FOUNDERS · 0007 Founder Academy & Founder Passport (Phase 3)
-- See docs/DATABASE_SCHEMA.md "Phase 3 additions".
--
-- Trust model:
--   * Curriculum is seeded from src/content/academy (supabase/seed.sql is generated).
--   * Clients can read lessons, activity prompts, quiz questions and option labels — never
--     answer keys, explanations or feedback until after the server has scored an attempt.
--   * Learning progress, activity responses, quiz attempts, achievements and certificates
--     are written ONLY by the SECURITY DEFINER functions below. Clients lose direct
--     INSERT/UPDATE/DELETE on lesson_progress and activity_responses.
--   * The functions act for the child in the caller's ACTIVE Child Mode (from
--     adult_accounts), so a request can never record progress for another child.

-- ---------------------------------------------------------------------------
-- Content schema additions
-- ---------------------------------------------------------------------------

alter table public.modules
  add column tone text not null default 'sun'
    check (tone in ('sun', 'coral', 'sky', 'mint', 'grape', 'rose'));

alter table public.quiz_questions
  add column key text unique check (key ~ '^[a-z0-9-]+$');

alter table public.lesson_activities
  add constraint lesson_activities_one_per_lesson unique (lesson_id);

-- Explanations reveal answers: hide them until the quiz is scored.
revoke select on public.quiz_questions from anon, authenticated;
grant select (id, quiz_id, key, position, kind, prompt) on public.quiz_questions to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Learning records become server-written only
-- ---------------------------------------------------------------------------

revoke insert, update, delete on public.lesson_progress, public.activity_responses from authenticated;

create index if not exists lesson_progress_child_idx on public.lesson_progress (child_id, status);

-- ---------------------------------------------------------------------------
-- Helpers (internal; not executable by clients)
-- ---------------------------------------------------------------------------

-- The child currently learning on this account: active Child Mode, profile not removed,
-- core consent in place.
create or replace function public.learning_child()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
  from public.adult_accounts a
  join public.child_profiles c
    on c.id = a.child_mode_child_id and c.guardian_id = a.id and c.deleted_at is null
  where a.id = (select auth.uid())
    and public.has_core_consent(a.id);
$$;

-- Lessons in a module must be completed in order.
create or replace function public.lesson_unlocked(p_child uuid, p_lesson uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.lessons target
    join public.lessons earlier
      on earlier.module_id = target.module_id and earlier.position < target.position
    where target.id = p_lesson
      and not exists (
        select 1 from public.lesson_progress p
        where p.child_id = p_child and p.lesson_id = earlier.id and p.status = 'completed'
      )
  );
$$;

create or replace function public.module_lessons_completed(p_child uuid, p_module uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.lessons l where l.module_id = p_module)
     and not exists (
       select 1 from public.lessons l
       where l.module_id = p_module
         and not exists (
           select 1 from public.lesson_progress p
           where p.child_id = p_child and p.lesson_id = l.id and p.status = 'completed'
         )
     );
$$;

-- A module is complete when every lesson is complete and its quiz (if any) is passed.
create or replace function public.module_completed(p_child uuid, p_module uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.module_lessons_completed(p_child, p_module)
     and (
       not exists (select 1 from public.quizzes q where q.module_id = p_module)
       or exists (
         select 1 from public.quizzes q
         join public.quiz_attempts a on a.quiz_id = q.id and a.child_id = p_child and a.passed
         where q.module_id = p_module
       )
     );
$$;

-- Award every achievement / certificate whose rule is now met. Returns new achievement keys.
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
  met boolean;
  earned text[] := '{}';
begin
  select count(*) into lessons_done
    from public.lesson_progress where child_id = p_child and status = 'completed';
  select count(*) into modules_done
    from public.modules m where public.module_completed(p_child, m.id);

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
-- Lesson activities
-- ---------------------------------------------------------------------------

-- Response shapes:  choose → {"selected": [int, ...]}
--                   sort   → {"placements": [0|1, ...]}   (one per item, in order)
--                   fill   → {"value": number}
create or replace function public.submit_lesson_activity(activity_key text, response jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  child uuid := public.learning_child();
  act record;
  n integer;
  selected integer[];
  expected integer[];
  placements integer[];
  wrong integer[] := '{}';
  correct boolean := false;
  feedback jsonb := '[]'::jsonb;
  val numeric;
begin
  if child is null then
    return jsonb_build_object('status', 'not_in_child_mode');
  end if;

  select a.*, l.id as lesson_id
    into act
    from public.lesson_activities a join public.lessons l on l.id = a.lesson_id
    where a.key = activity_key;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if not public.lesson_unlocked(child, act.lesson_id) then
    return jsonb_build_object('status', 'locked');
  end if;
  if (select count(*) from public.activity_responses r
      where r.child_id = child and r.created_at > now() - interval '10 minutes') >= 120 then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  if response is null or jsonb_typeof(response) <> 'object' or octet_length(response::text) > 1000 then
    return jsonb_build_object('status', 'invalid');
  end if;

  if act.kind = 'choose' then
    n := jsonb_array_length(act.config -> 'options');
    if jsonb_typeof(response -> 'selected') <> 'array'
       or exists (select 1 from jsonb_array_elements(response -> 'selected') e
                  where case when jsonb_typeof(e) = 'number'
                             then (e #>> '{}')::numeric not in (select generate_series(0, n - 1))
                             else true end) then
      return jsonb_build_object('status', 'invalid');
    end if;
    selected := array(select distinct (e #>> '{}')::integer from jsonb_array_elements(response -> 'selected') e order by 1);
    if cardinality(selected) = 0
       or (not coalesce((act.config ->> 'multi')::boolean, false) and cardinality(selected) <> 1) then
      return jsonb_build_object('status', 'invalid');
    end if;
    expected := array(select (e #>> '{}')::integer from jsonb_array_elements(act.answer_key -> 'correct') e order by 1);
    correct := selected = expected;
    select coalesce(jsonb_agg(jsonb_build_object(
             'option', i,
             'correct', i = any (expected),
             'text', act.answer_key -> 'feedback' ->> i) order by i), '[]'::jsonb)
      into feedback
      from unnest(selected) as i;
    response := jsonb_build_object('selected', to_jsonb(selected));

  elsif act.kind = 'sort' then
    n := jsonb_array_length(act.config -> 'items');
    if jsonb_typeof(response -> 'placements') <> 'array'
       or jsonb_array_length(response -> 'placements') <> n
       or exists (select 1 from jsonb_array_elements(response -> 'placements') e
                  where jsonb_typeof(e) <> 'number' or (e #>> '{}') not in ('0', '1')) then
      return jsonb_build_object('status', 'invalid');
    end if;
    placements := array(select (e #>> '{}')::integer from jsonb_array_elements(response -> 'placements') with ordinality t(e, i) order by i);
    expected := array(select (e #>> '{}')::integer from jsonb_array_elements(act.answer_key -> 'placements') with ordinality t(e, i) order by i);
    wrong := array(select i - 1 from generate_subscripts(placements, 1) i where placements[i] <> expected[i]);
    correct := cardinality(wrong) = 0;
    response := jsonb_build_object('placements', to_jsonb(placements));

  elsif act.kind = 'fill' then
    if jsonb_typeof(response -> 'value') <> 'number' then
      return jsonb_build_object('status', 'invalid');
    end if;
    val := (response ->> 'value')::numeric;
    correct := abs(val - (act.answer_key ->> 'answer')::numeric) < 0.005;
    response := jsonb_build_object('value', val);

  else
    return jsonb_build_object('status', 'invalid');
  end if;

  insert into public.activity_responses (child_id, activity_id, response, is_correct)
    values (child, act.id, response, correct);

  return jsonb_build_object(
    'status', 'ok',
    'correct', correct,
    'feedback', feedback,
    'wrong', to_jsonb(wrong),
    'explanation', case when correct then act.answer_key ->> 'explanation' end,
    'hint', case when not correct then act.answer_key ->> 'hint' end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Lesson completion
-- ---------------------------------------------------------------------------

create or replace function public.complete_lesson(lesson_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  child uuid := public.learning_child();
  les record;
  newly text[];
begin
  if child is null then
    return jsonb_build_object('status', 'not_in_child_mode');
  end if;
  select l.* into les from public.lessons l where l.key = lesson_key;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if not public.lesson_unlocked(child, les.id) then
    return jsonb_build_object('status', 'locked');
  end if;
  if exists (
    select 1 from public.lesson_activities a
    where a.lesson_id = les.id
      and not exists (
        select 1 from public.activity_responses r
        where r.child_id = child and r.activity_id = a.id and r.is_correct
      )
  ) then
    return jsonb_build_object('status', 'activity_required');
  end if;

  insert into public.lesson_progress (child_id, lesson_id, status, completed_at)
    values (child, les.id, 'completed', now())
    on conflict (child_id, lesson_id) do update
      set status = 'completed',
          completed_at = coalesce(public.lesson_progress.completed_at, now());

  newly := public.evaluate_achievements(child, 'lesson:' || lesson_key);
  return jsonb_build_object('status', 'ok', 'achievements', to_jsonb(newly));
end;
$$;

-- ---------------------------------------------------------------------------
-- Quizzes
-- ---------------------------------------------------------------------------

-- Per-question results for a set of answers {"<question_id>": "<option_id>"}.
create or replace function public.quiz_results(p_quiz uuid, p_answers jsonb)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'question_id', q.id,
           'chosen_option_id', chosen.id,
           'correct_option_id', right_opt.id,
           'is_correct', coalesce(chosen.is_correct, false),
           'feedback', chosen.feedback,
           'explanation', q.explanation) order by q.position), '[]'::jsonb)
  from public.quiz_questions q
  left join public.quiz_options chosen
    on chosen.question_id = q.id and chosen.id::text = p_answers ->> q.id::text
  left join public.quiz_options right_opt
    on right_opt.question_id = q.id and right_opt.is_correct
  where q.quiz_id = p_quiz;
$$;

create or replace function public.submit_quiz(module_key text, answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  child uuid := public.learning_child();
  quiz record;
  total integer;
  right_count integer;
  clean jsonb;
  score smallint;
  passed boolean;
  newly text[];
begin
  if child is null then
    return jsonb_build_object('status', 'not_in_child_mode');
  end if;
  select q.* into quiz
    from public.quizzes q join public.modules m on m.id = q.module_id
    where m.key = module_key;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if not public.module_lessons_completed(child, quiz.module_id) then
    return jsonb_build_object('status', 'locked');
  end if;
  if (select count(*) from public.quiz_attempts a
      where a.child_id = child and a.quiz_id = quiz.id and a.started_at > now() - interval '1 hour') >= 20 then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  if answers is null or jsonb_typeof(answers) <> 'object' or octet_length(answers::text) > 4000 then
    return jsonb_build_object('status', 'invalid');
  end if;

  -- Keep only valid answers: one existing option per question of this quiz.
  select count(*),
         count(*) filter (where o.is_correct),
         coalesce(jsonb_object_agg(q.id::text, o.id::text) filter (where o.id is not null), '{}'::jsonb)
    into total, right_count, clean
    from public.quiz_questions q
    left join public.quiz_options o
      on o.question_id = q.id and o.id::text = answers ->> q.id::text
    where q.quiz_id = quiz.id;

  if total = 0 then
    return jsonb_build_object('status', 'not_found');
  end if;
  if (select count(*) from jsonb_object_keys(clean)) <> total then
    return jsonb_build_object('status', 'incomplete');
  end if;

  score := round(100.0 * right_count / total);
  passed := score >= quiz.pass_mark;

  insert into public.quiz_attempts (child_id, quiz_id, answers, score, passed, started_at, submitted_at)
    values (child, quiz.id, clean, score, passed, now(), now());

  newly := public.evaluate_achievements(child, 'quiz:' || module_key);
  return jsonb_build_object(
    'status', 'ok',
    'score', score,
    'passed', passed,
    'correct', right_count,
    'total', total,
    'pass_mark', quiz.pass_mark,
    'results', public.quiz_results(quiz.id, clean),
    'achievements', to_jsonb(newly)
  );
end;
$$;

-- Review the latest submitted attempt for the child in Child Mode.
create or replace function public.quiz_review(module_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  child uuid := public.learning_child();
  att record;
begin
  if child is null then
    return jsonb_build_object('status', 'not_in_child_mode');
  end if;
  select a.*, q.pass_mark,
         (select count(*) from public.quiz_questions qq where qq.quiz_id = q.id) as total
    into att
    from public.quiz_attempts a
    join public.quizzes q on q.id = a.quiz_id
    join public.modules m on m.id = q.module_id
    where m.key = module_key and a.child_id = child and a.submitted_at is not null
    order by a.submitted_at desc
    limit 1;
  if not found then
    return jsonb_build_object('status', 'none');
  end if;
  return jsonb_build_object(
    'status', 'ok',
    'score', att.score,
    'passed', att.passed,
    'total', att.total,
    'correct', (select count(*) from jsonb_array_elements(public.quiz_results(att.quiz_id, att.answers)) r
                where (r ->> 'is_correct')::boolean),
    'pass_mark', att.pass_mark,
    'submitted_at', att.submitted_at,
    'results', public.quiz_results(att.quiz_id, att.answers)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke execute on function
  public.learning_child(),
  public.lesson_unlocked(uuid, uuid),
  public.module_lessons_completed(uuid, uuid),
  public.module_completed(uuid, uuid),
  public.evaluate_achievements(uuid, text),
  public.quiz_results(uuid, jsonb),
  public.submit_lesson_activity(text, jsonb),
  public.complete_lesson(text),
  public.submit_quiz(text, jsonb),
  public.quiz_review(text)
from public, anon, authenticated;

grant execute on function
  public.submit_lesson_activity(text, jsonb),
  public.complete_lesson(text),
  public.submit_quiz(text, jsonb),
  public.quiz_review(text)
to authenticated;
