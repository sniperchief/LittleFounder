-- LITTLE FOUNDERS · 0006 Reliable permanent deletion of removed child profiles
-- Phase 2 hardening. See docs/CHILD_SAFETY_AND_PRIVACY.md §9.
--
-- Builds on 0005 (soft delete → deletion_jobs row 30 days out → purge_due_deletions()):
--   * one failing job no longer aborts the whole run; failures are recorded and retried
--   * safety net: any removed profile without a pending job gets one (removal time + 30 days)
--   * restored profiles never get purged, even if a stale job remained
--   * at most one pending job per target
--   * runs hourly (was daily) so a missed or failed run is retried within the hour
--   * public.deletion_health() reports backlog, failures and the last scheduler runs

alter table public.deletion_jobs
  add column attempts         smallint not null default 0,
  add column last_attempt_at  timestamptz,
  add column last_error       text check (char_length(last_error) <= 500);

create unique index deletion_jobs_one_pending
  on public.deletion_jobs (target_type, target_id) where executed_at is null;

create index deletion_jobs_due_idx
  on public.deletion_jobs (scheduled_for) where executed_at is null;

create or replace function public.purge_due_deletions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  job record;
  purged integer := 0;
begin
  -- Safety net: removed profiles that somehow have no pending job.
  insert into public.deletion_jobs (target_type, target_id, requested_by, scheduled_for)
    select 'child_profile', p.id, p.guardian_id, p.deleted_at + interval '30 days'
    from public.child_profiles p
    where p.deleted_at is not null
      and not exists (
        select 1 from public.deletion_jobs j
        where j.target_type = 'child_profile' and j.target_id = p.id and j.executed_at is null
      )
  on conflict do nothing;

  for job in
    select * from public.deletion_jobs
    where executed_at is null and scheduled_for <= now() and target_type = 'child_profile'
    order by scheduled_for
    for update skip locked
  loop
    begin
      if exists (select 1 from public.child_profiles
                 where id = job.target_id and deleted_at is null) then
        -- Restored: never purge an active profile.
        delete from public.deletion_jobs where id = job.id;
        continue;
      end if;

      -- Cascades to every child-owned table (progress, projects, decks, sessions, ...).
      delete from public.child_profiles where id = job.target_id;

      update public.deletion_jobs
        set executed_at = now(), attempts = attempts + 1, last_attempt_at = now(), last_error = null
        where id = job.id;
      insert into public.audit_log (actor_id, action, target_type, target_id)
        values (null, 'child.purged', 'child_profile', job.target_id);
      purged := purged + 1;
    exception when others then
      -- Roll back this job only; record the failure and retry on the next run.
      update public.deletion_jobs
        set attempts = attempts + 1, last_attempt_at = now(), last_error = left(sqlerrm, 500)
        where id = job.id;
    end;
  end loop;
  return purged;
end;
$$;

-- Operational check for the server/maintainers (no personal data is returned).
create or replace function public.deletion_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
  runs jsonb := null;
begin
  select jsonb_build_object(
    'pending',  count(*) filter (where executed_at is null),
    'overdue',  count(*) filter (where executed_at is null and scheduled_for < now() - interval '2 hours'),
    'failing',  count(*) filter (where executed_at is null and last_error is not null),
    'oldest_overdue', min(scheduled_for) filter (where executed_at is null and scheduled_for < now() - interval '2 hours'),
    'purged_last_30_days', count(*) filter (where executed_at > now() - interval '30 days')
  ) into result
  from public.deletion_jobs;

  if to_regclass('cron.job') is not null then
    execute $q$
      select jsonb_build_object(
        'scheduled', exists (select 1 from cron.job where jobname = 'lf-purge-deleted-children' and active),
        'schedule',  (select schedule from cron.job where jobname = 'lf-purge-deleted-children'),
        'recent_runs', coalesce((
          select jsonb_agg(jsonb_build_object('status', d.status, 'start', d.start_time) order by d.start_time desc)
          from (select r.status, r.start_time from cron.job_run_details r
                join cron.job j on j.jobid = r.jobid
                where j.jobname = 'lf-purge-deleted-children'
                order by r.start_time desc limit 5) d), '[]'::jsonb))
    $q$ into runs;
  end if;

  return result || jsonb_build_object('scheduler', coalesce(runs, jsonb_build_object('scheduled', false)));
end;
$$;

-- Server-only: never anonymous visitors or signed-in parents.
revoke execute on function public.purge_due_deletions(), public.deletion_health() from public, anon, authenticated;
grant execute on function public.purge_due_deletions(), public.deletion_health() to service_role;

-- Re-schedule hourly (cron.schedule replaces a job with the same name).
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
    exception when others then
      raise notice 'pg_cron could not be enabled (%).', sqlerrm;
    end;
  end if;

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('lf-purge-deleted-children', '17 * * * *', 'select public.purge_due_deletions()');
  else
    raise warning 'pg_cron is unavailable: run public.purge_due_deletions() hourly from the server.';
  end if;
end;
$$;
