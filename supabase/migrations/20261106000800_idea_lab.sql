-- LITTLE FOUNDERS · 0008 Idea Lab (Phase 4)
-- See docs/DATABASE_SCHEMA.md "Phase 4 additions".
--
-- Builds on startup_projects (0003). Ideas are now written ONLY through SECURITY DEFINER
-- functions that act for the child in the caller's active Child Mode (public.learning_child()),
-- so no client-supplied child id or ownership is ever trusted. Guardians keep read access
-- through the existing RLS policy (Parent Dashboard).
-- Value lists mirror src/content/idea-lab.ts.

alter table public.startup_projects
  add column problem_category  text check (problem_category in ('school', 'organisation', 'hobbies', 'pets', 'environment', 'home', 'other')),
  add column problem_who       text not null default '' check (char_length(problem_who) <= 120),
  add column problem_frequency text check (problem_frequency in ('daily', 'weekly', 'monthly', 'sometimes')),
  add column solution_type     text check (solution_type in ('product', 'service', 'digital', 'event')),
  add column solution_benefit  text not null default '' check (char_length(solution_benefit) <= 160),
  add column buyer             text check (buyer in ('users', 'parents', 'schools', 'businesses', 'free')),
  add column special_tags      text[] not null default '{}',
  add column first_step        text check (first_step in ('ask-people', 'sketch', 'prototype', 'test-friends', 'work-out-costs')),
  add column wizard_step       smallint not null default 1 check (wizard_step between 1 and 6);

alter table public.startup_projects
  add constraint startup_projects_icon_check
    check (icon_key in ('lightbulb', 'rocket', 'leaf', 'paw', 'book', 'palette', 'bike', 'recycle', 'heart', 'star', 'music', 'house')),
  add constraint startup_projects_customer_tags_check
    check (target_customer_tags <@ array['kids', 'teens', 'parents', 'grandparents', 'teachers', 'pet-owners',
                                          'families', 'neighbours', 'sports-teams', 'small-businesses']::text[]),
  add constraint startup_projects_special_tags_check
    check (cardinality(special_tags) <= 4
           and special_tags <@ array['cheaper', 'faster', 'easier', 'eco-friendly', 'more-fun', 'safer', 'healthier', 'kinder']::text[]),
  add constraint startup_projects_text_lengths
    check (char_length(problem) <= 200 and char_length(solution) <= 240
           and char_length(target_customer_note) <= 160 and char_length(value_statement) <= 160),
  -- An idea can only be marked "Idea Created" (ready) when every required part is filled in.
  add constraint startup_projects_ready_complete
    check (status <> 'ready' or (
      problem_category is not null
      and char_length(btrim(problem)) >= 3
      and solution_type is not null
      and char_length(btrim(solution)) >= 3
      and cardinality(target_customer_tags) >= 1
      and buyer is not null
      and char_length(btrim(name)) >= 2
      and char_length(btrim(value_statement)) >= 3
    ));

-- Ideas are written only through the functions below.
revoke insert, update, delete on public.startup_projects from authenticated;

-- ---------------------------------------------------------------------------
-- save_idea: create (idea_id null) or update the active child's idea.
-- fields: any subset of the editable columns below. step: wizard step to resume at.
-- finish: mark the idea as created ("ready"); requires every required part.
-- ---------------------------------------------------------------------------
create or replace function public.save_idea(idea_id uuid, fields jsonb, step smallint default null, finish boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  child uuid := public.learning_child();
  proj public.startup_projects%rowtype;
  allowed text[] := array['name', 'icon_key', 'problem_category', 'problem', 'problem_who', 'problem_frequency',
                          'solution_type', 'solution', 'solution_benefit', 'target_customer_tags', 'buyer',
                          'target_customer_note', 'value_statement', 'special_tags', 'first_step'];
  constraint_hit text;
  newly text[] := '{}';
  created boolean := false;
begin
  if child is null then
    return jsonb_build_object('status', 'not_in_child_mode');
  end if;
  if fields is null or jsonb_typeof(fields) <> 'object' or octet_length(fields::text) > 6000
     or exists (select 1 from jsonb_object_keys(fields) k where k <> all (allowed))
     or exists (select 1 from jsonb_each(fields) e
                where e.key in ('target_customer_tags', 'special_tags') and jsonb_typeof(e.value) <> 'array'
                   or e.key not in ('target_customer_tags', 'special_tags') and jsonb_typeof(e.value) not in ('string', 'null'))
     or (step is not null and step not between 1 and 6) then
    return jsonb_build_object('status', 'invalid');
  end if;

  begin
    if idea_id is null then
      insert into public.startup_projects (child_id, name)
        values (child, coalesce(nullif(btrim(fields ->> 'name'), ''), 'My new idea'))
        returning * into proj;
      created := true;
    else
      select * into proj from public.startup_projects p
        where p.id = idea_id and p.child_id = child and p.status <> 'archived'
        for update;
      if not found then
        return jsonb_build_object('status', 'not_found');
      end if;
    end if;

    update public.startup_projects p set
      name                 = case when fields ? 'name' then coalesce(nullif(btrim(fields ->> 'name'), ''), 'My new idea') else p.name end,
      icon_key             = case when fields ? 'icon_key' then coalesce(fields ->> 'icon_key', 'lightbulb') else p.icon_key end,
      problem_category     = case when fields ? 'problem_category' then nullif(fields ->> 'problem_category', '') else p.problem_category end,
      problem              = case when fields ? 'problem' then btrim(coalesce(fields ->> 'problem', '')) else p.problem end,
      problem_who          = case when fields ? 'problem_who' then btrim(coalesce(fields ->> 'problem_who', '')) else p.problem_who end,
      problem_frequency    = case when fields ? 'problem_frequency' then nullif(fields ->> 'problem_frequency', '') else p.problem_frequency end,
      solution_type        = case when fields ? 'solution_type' then nullif(fields ->> 'solution_type', '') else p.solution_type end,
      solution             = case when fields ? 'solution' then btrim(coalesce(fields ->> 'solution', '')) else p.solution end,
      solution_benefit     = case when fields ? 'solution_benefit' then btrim(coalesce(fields ->> 'solution_benefit', '')) else p.solution_benefit end,
      target_customer_tags = case when fields ? 'target_customer_tags'
                               then array(select distinct jsonb_array_elements_text(fields -> 'target_customer_tags') order by 1)
                               else p.target_customer_tags end,
      buyer                = case when fields ? 'buyer' then nullif(fields ->> 'buyer', '') else p.buyer end,
      target_customer_note = case when fields ? 'target_customer_note' then btrim(coalesce(fields ->> 'target_customer_note', '')) else p.target_customer_note end,
      value_statement      = case when fields ? 'value_statement' then btrim(coalesce(fields ->> 'value_statement', '')) else p.value_statement end,
      special_tags         = case when fields ? 'special_tags'
                               then array(select distinct jsonb_array_elements_text(fields -> 'special_tags') order by 1)
                               else p.special_tags end,
      first_step           = case when fields ? 'first_step' then nullif(fields ->> 'first_step', '') else p.first_step end,
      wizard_step          = coalesce(step, p.wizard_step),
      status               = case when finish then 'ready' else p.status end
    where p.id = proj.id
    returning * into proj;
  exception
    when check_violation then
      get stacked diagnostics constraint_hit = constraint_name;
      if sqlerrm like '%at most 10 active projects%' then
        return jsonb_build_object('status', 'limit_reached');
      elsif constraint_hit = 'startup_projects_ready_complete' then
        return jsonb_build_object('status', 'incomplete');
      end if;
      return jsonb_build_object('status', 'invalid');
    when others then
      return jsonb_build_object('status', 'invalid');
  end;

  if finish then
    newly := public.evaluate_achievements(child, 'idea:' || proj.id::text);
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'id', proj.id,
    'created', created,
    'idea_status', proj.status,
    'achievements', to_jsonb(newly)
  );
end;
$$;

create or replace function public.delete_idea(idea_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  child uuid := public.learning_child();
begin
  if child is null then
    return jsonb_build_object('status', 'not_in_child_mode');
  end if;
  delete from public.startup_projects p where p.id = idea_id and p.child_id = child;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  return jsonb_build_object('status', 'ok');
end;
$$;

-- ---------------------------------------------------------------------------
-- Achievements: add the "ideas_created" rule (Idea Spark badge).
-- Same as 0007 plus one case.
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
  met boolean;
  earned text[] := '{}';
begin
  select count(*) into lessons_done
    from public.lesson_progress where child_id = p_child and status = 'completed';
  select count(*) into modules_done
    from public.modules m where public.module_completed(p_child, m.id);
  select count(*) into ideas_done
    from public.startup_projects where child_id = p_child and status = 'ready';

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

revoke execute on function
  public.save_idea(uuid, jsonb, smallint, boolean),
  public.delete_idea(uuid),
  public.evaluate_achievements(uuid, text)
from public, anon, authenticated;

grant execute on function
  public.save_idea(uuid, jsonb, smallint, boolean),
  public.delete_idea(uuid)
to authenticated;
