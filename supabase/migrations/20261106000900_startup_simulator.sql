-- LITTLE FOUNDERS · 0009 Startup Simulator (Phase 5)
-- Rules and formulas: docs/STARTUP_SIMULATOR.md. Options are seeded from src/content/simulator.ts
-- into simulator_scenarios.demand_params.
--
-- Trust model (same as Phases 3–4):
--   * simulator_sessions / simulator_rounds stay read-only to clients (0003). All writes go
--     through SECURITY DEFINER functions acting for the child in the caller's active Child Mode.
--   * Every result is calculated here, deterministically (no randomness), from predefined options.
--   * Completed attempts are immutable (triggers below); only a reflection answer may be added once.
-- Founder Bucks are pretend, virtual units for learning — never real money.

alter table public.simulator_sessions
  add column draft      jsonb not null default '{}'::jsonb check (octet_length(draft::text) <= 300),
  add column reflection text check (reflection in ('price', 'quantity', 'marketing', 'same'));

create index if not exists simulator_sessions_child_created_idx on public.simulator_sessions (child_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Immutability of completed attempts
-- ---------------------------------------------------------------------------

create or replace function public.simulator_sessions_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'completed' and (
       new.status is distinct from old.status
    or new.final_summary is distinct from old.final_summary
    or new.completed_at is distinct from old.completed_at
    or new.current_round is distinct from old.current_round
    or new.starting_budget is distinct from old.starting_budget
    or new.scenario_id is distinct from old.scenario_id
    or new.project_id is distinct from old.project_id
    or new.child_id is distinct from old.child_id
    or new.draft is distinct from old.draft
    or (old.reflection is not null and new.reflection is distinct from old.reflection)
  ) then
    raise exception 'Completed simulations cannot be changed' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger simulator_sessions_immutable
  before update on public.simulator_sessions
  for each row execute function public.simulator_sessions_guard();

create or replace function public.simulator_rounds_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Simulation results cannot be changed' using errcode = 'check_violation';
end;
$$;

create trigger simulator_rounds_immutable
  before update on public.simulator_rounds
  for each row execute function public.simulator_rounds_guard();

-- ---------------------------------------------------------------------------
-- The calculation (pure, deterministic). See docs/STARTUP_SIMULATOR.md.
-- ---------------------------------------------------------------------------

create or replace function public.simulator_outcome(params jsonb, price integer, quantity integer, marketing_key text)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  budget integer := (params ->> 'startingBudget')::integer;
  unit_cost integer := (params ->> 'unitCost')::integer;
  mkt jsonb;
  base_interest integer;
  interested integer;
  sold integer;
  production_cost integer;
  marketing_cost integer;
  total_cost integer;
  revenue integer;
  profit integer;
  sold_without_marketing integer;
  feedback text[] := '{}';
begin
  if price is null or quantity is null or marketing_key is null
     or not (params -> 'prices') @> to_jsonb(price)
     or not (params -> 'quantities') @> to_jsonb(quantity) then
    return jsonb_build_object('status', 'invalid');
  end if;
  select m into mkt from jsonb_array_elements(params -> 'marketing') m where m ->> 'key' = marketing_key;
  if mkt is null then
    return jsonb_build_object('status', 'invalid');
  end if;

  production_cost := quantity * unit_cost;
  marketing_cost := (mkt ->> 'cost')::integer;
  total_cost := production_cost + marketing_cost;
  if total_cost > budget then
    return jsonb_build_object('status', 'over_budget', 'total_cost', total_cost, 'starting_budget', budget,
                              'over_by', total_cost - budget);
  end if;

  base_interest := (params -> 'interestedAtPrice' ->> price::text)::integer;
  interested := base_interest + (mkt ->> 'reach')::integer;
  sold := least(quantity, interested);
  revenue := sold * price;
  profit := revenue - total_cost;
  sold_without_marketing := least(quantity, base_interest);

  feedback := feedback || case when profit > 0 then 'profit' when profit < 0 then 'loss' else 'break-even' end;
  if interested > quantity then feedback := feedback || 'sold-out'::text; end if;
  if quantity > interested then feedback := feedback || 'leftover'::text; end if;
  if price = (select min(p::integer) from jsonb_array_elements_text(params -> 'prices') p) then
    feedback := feedback || 'price-low'::text;
  elsif price = (select max(p::integer) from jsonb_array_elements_text(params -> 'prices') p) then
    feedback := feedback || 'price-high'::text;
  end if;
  if marketing_cost > 0 then
    feedback := feedback || case when (sold - sold_without_marketing) * price > marketing_cost
                                 then 'marketing-paid-off' else 'marketing-not-worth-it' end;
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'starting_budget', budget,
    'unit_cost', unit_cost,
    'price', price,
    'quantity', quantity,
    'marketing_key', marketing_key,
    'marketing_label', mkt ->> 'label',
    'marketing_cost', marketing_cost,
    'marketing_reach', (mkt ->> 'reach')::integer,
    'interested', interested,
    'units_sold', sold,
    'unsold', quantity - sold,
    'missed_customers', greatest(interested - quantity, 0),
    'production_cost', production_cost,
    'total_cost', total_cost,
    'revenue', revenue,
    'profit', profit,
    'cash_remaining', budget - total_cost + revenue,
    'outcome', case when profit > 0 then 'profit' when profit < 0 then 'loss' else 'break-even' end,
    'feedback', to_jsonb(feedback)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Session lifecycle
-- ---------------------------------------------------------------------------

-- Start (or resume) an attempt. EcoBottle takes no project; "my-idea" needs one of the
-- active child's created ideas.
create or replace function public.start_simulation(scenario_key text, project_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  child uuid := public.learning_child();
  scen public.simulator_scenarios%rowtype;
  existing uuid;
  session_id uuid;
begin
  if child is null then
    return jsonb_build_object('status', 'not_in_child_mode');
  end if;
  select * into scen from public.simulator_scenarios s where s.key = scenario_key;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if coalesce((scen.demand_params ->> 'usesIdea')::boolean, false) then
    if project_id is null or not exists (
      select 1 from public.startup_projects p
      where p.id = project_id and p.child_id = child and p.status = 'ready') then
      return jsonb_build_object('status', 'idea_required');
    end if;
  elsif project_id is not null then
    return jsonb_build_object('status', 'invalid');
  end if;

  -- Resume an unfinished attempt for the same challenge instead of starting a duplicate.
  select s.id into existing from public.simulator_sessions s
    where s.child_id = child and s.scenario_id = scen.id and s.status = 'active'
      and s.project_id is not distinct from start_simulation.project_id
    order by s.created_at desc limit 1;
  if existing is not null then
    return jsonb_build_object('status', 'ok', 'id', existing, 'resumed', true);
  end if;

  if (select count(*) from public.simulator_sessions s
      where s.child_id = child and s.created_at > now() - interval '1 hour') >= 20 then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  insert into public.simulator_sessions (child_id, project_id, scenario_id, seed, starting_budget)
    values (child, start_simulation.project_id, scen.id, 0, scen.starting_budget)
    returning id into session_id;
  return jsonb_build_object('status', 'ok', 'id', session_id, 'resumed', false);
end;
$$;

-- Remember choices so far (resume support). Only predefined values are accepted.
create or replace function public.save_simulation_draft(session_id uuid, draft jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  child uuid := public.learning_child();
  sess record;
  params jsonb;
begin
  if child is null then
    return jsonb_build_object('status', 'not_in_child_mode');
  end if;
  select s.*, sc.demand_params into sess
    from public.simulator_sessions s join public.simulator_scenarios sc on sc.id = s.scenario_id
    where s.id = session_id and s.child_id = child
    for update of s;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if sess.status <> 'active' then
    return jsonb_build_object('status', 'already_completed');
  end if;
  params := sess.demand_params;
  if draft is null or jsonb_typeof(draft) <> 'object'
     or exists (select 1 from jsonb_object_keys(draft) k where k not in ('price', 'quantity', 'marketing', 'step'))
     or (draft ? 'price' and jsonb_typeof(draft -> 'price') <> 'null' and not (params -> 'prices') @> (draft -> 'price'))
     or (draft ? 'quantity' and jsonb_typeof(draft -> 'quantity') <> 'null' and not (params -> 'quantities') @> (draft -> 'quantity'))
     or (draft ? 'marketing' and jsonb_typeof(draft -> 'marketing') <> 'null'
         and not exists (select 1 from jsonb_array_elements(params -> 'marketing') m where m -> 'key' = draft -> 'marketing'))
     or (draft ? 'step' and (jsonb_typeof(draft -> 'step') <> 'number' or (draft ->> 'step') not in ('1', '2', '3', '4', '5'))) then
    return jsonb_build_object('status', 'invalid');
  end if;
  update public.simulator_sessions s set draft = save_simulation_draft.draft where s.id = sess.id;
  return jsonb_build_object('status', 'ok');
end;
$$;

-- Run the season: validate the decisions, calculate, store the result and complete the attempt.
create or replace function public.run_simulation(session_id uuid, price integer, quantity integer, marketing_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  child uuid := public.learning_child();
  sess record;
  result jsonb;
  newly text[];
begin
  if child is null then
    return jsonb_build_object('status', 'not_in_child_mode');
  end if;
  select s.*, sc.demand_params into sess
    from public.simulator_sessions s join public.simulator_scenarios sc on sc.id = s.scenario_id
    where s.id = session_id and s.child_id = child
    for update of s;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if sess.status <> 'active' then
    return jsonb_build_object('status', 'already_completed');
  end if;

  result := public.simulator_outcome(sess.demand_params, price, quantity, marketing_key);
  if result ->> 'status' <> 'ok' then
    return result;
  end if;

  insert into public.simulator_rounds
    (session_id, round, quantity, unit_price, marketing_spend, units_sold, revenue, cost, profit, budget_after, feedback_keys)
  values
    (sess.id, 1, quantity, price, (result ->> 'marketing_cost')::numeric, (result ->> 'units_sold')::integer,
     (result ->> 'revenue')::numeric, (result ->> 'total_cost')::numeric, (result ->> 'profit')::numeric,
     (result ->> 'cash_remaining')::numeric,
     array(select jsonb_array_elements_text(result -> 'feedback')));

  update public.simulator_sessions s
    set status = 'completed', current_round = 1, final_summary = result - 'status',
        completed_at = now(), draft = '{}'::jsonb
    where s.id = sess.id;

  newly := public.evaluate_achievements(child, 'simulation:' || sess.id::text);
  return result || jsonb_build_object('id', sess.id, 'achievements', to_jsonb(newly));
end;
$$;

-- Save the reflection answer once, after the attempt is complete.
create or replace function public.set_simulation_reflection(session_id uuid, reflection text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  child uuid := public.learning_child();
  sess public.simulator_sessions%rowtype;
begin
  if child is null then
    return jsonb_build_object('status', 'not_in_child_mode');
  end if;
  if reflection is null or reflection not in ('price', 'quantity', 'marketing', 'same') then
    return jsonb_build_object('status', 'invalid');
  end if;
  select * into sess from public.simulator_sessions s where s.id = session_id and s.child_id = child for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if sess.status <> 'completed' then
    return jsonb_build_object('status', 'not_completed');
  end if;
  if sess.reflection is not null then
    return jsonb_build_object('status', 'already_answered');
  end if;
  update public.simulator_sessions s set reflection = set_simulation_reflection.reflection where s.id = sess.id;
  return jsonb_build_object('status', 'ok');
end;
$$;

-- ---------------------------------------------------------------------------
-- Achievements: add "simulations_completed" (First Business Run). Same as 0008 plus one case.
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
  public.simulator_sessions_guard(),
  public.simulator_rounds_guard(),
  public.simulator_outcome(jsonb, integer, integer, text),
  public.start_simulation(text, uuid),
  public.save_simulation_draft(uuid, jsonb),
  public.run_simulation(uuid, integer, integer, text),
  public.set_simulation_reflection(uuid, text),
  public.evaluate_achievements(uuid, text)
from public, anon, authenticated;

grant execute on function
  public.start_simulation(text, uuid),
  public.save_simulation_draft(uuid, jsonb),
  public.run_simulation(uuid, integer, integer, text),
  public.set_simulation_reflection(uuid, text)
to authenticated;
