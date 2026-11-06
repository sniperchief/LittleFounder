-- LITTLE FOUNDERS · 0005 Parent accounts, parent PIN, Child Mode, deletion & audit
-- Phase 2. See docs/TECHNICAL_ARCHITECTURE.md §3 and docs/CHILD_SAFETY_AND_PRIVACY.md §3, §9.
--
-- Design notes:
--   * Child Mode is stored in the DATABASE (adult_accounts.child_mode_child_id), not in a
--     cookie, so clearing cookies or opening parent URLs cannot bypass the parent PIN.
--   * The PIN is bcrypt-hashed with pgcrypto and only ever handled by SECURITY DEFINER
--     functions. Clients can never read or write pin_hash directly.
--   * Real child data is gated in the database: until app_settings.real_child_data_enabled
--     is switched on (after the legal/privacy review), every child profile must be is_demo.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- App settings (server-only)
-- ---------------------------------------------------------------------------

create table public.app_settings (
  id                       boolean primary key default true check (id),  -- single row
  real_child_data_enabled  boolean not null default false,
  updated_at               timestamptz not null default now()
);

insert into public.app_settings (id) values (true);

alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;

create or replace function public.real_child_data_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select real_child_data_enabled from public.app_settings where id), false);
$$;

-- ---------------------------------------------------------------------------
-- adult_accounts: PIN lockout + Child Mode state
-- ---------------------------------------------------------------------------

alter table public.adult_accounts
  add column pin_failed_attempts  smallint not null default 0,
  add column pin_locked_until     timestamptz,
  add column child_mode_child_id  uuid references public.child_profiles (id) on delete set null,
  add column child_mode_started_at timestamptz;

-- Clients may read Child Mode state and lockout time, never the hash or counters.
grant select (child_mode_child_id, child_mode_started_at, pin_locked_until)
  on public.adult_accounts to authenticated;

-- Has this adult set a PIN? (pin_hash itself is never exposed.)
create or replace function public.adult_has_pin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select a.pin_hash is not null from public.adult_accounts a where a.id = (select auth.uid())),
    false
  );
$$;

-- Set or change the parent PIN. Changing an existing PIN requires the current PIN.
-- Not allowed while Child Mode is active.
create or replace function public.set_adult_pin(new_pin text, current_pin text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  acct public.adult_accounts%rowtype;
begin
  select * into acct from public.adult_accounts where id = (select auth.uid()) for update;
  if not found then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if acct.child_mode_child_id is not null then
    return 'child_mode_active';
  end if;
  if new_pin is null or new_pin !~ '^[0-9]{4,6}$' then
    return 'invalid_format';
  end if;
  if new_pin ~ '^([0-9])\1+$' or new_pin in ('1234', '12345', '123456', '4321', '654321') then
    return 'too_simple';
  end if;

  if acct.pin_hash is not null then
    if acct.pin_locked_until is not null and acct.pin_locked_until > now() then
      return 'locked';
    end if;
    if current_pin is null or extensions.crypt(current_pin, acct.pin_hash) <> acct.pin_hash then
      update public.adult_accounts
        set pin_failed_attempts = acct.pin_failed_attempts + 1,
            pin_locked_until = case when acct.pin_failed_attempts + 1 >= 5
                                    then now() + interval '15 minutes' end
        where id = acct.id;
      return 'wrong_pin';
    end if;
  end if;

  update public.adult_accounts
    set pin_hash = extensions.crypt(new_pin, extensions.gen_salt('bf', 10)),
        pin_failed_attempts = 0,
        pin_locked_until = null
    where id = acct.id;

  insert into public.audit_log (actor_id, action, target_type, target_id)
    values (acct.id, case when acct.pin_hash is null then 'pin.set' else 'pin.changed' end, 'adult_account', acct.id);
  return 'ok';
end;
$$;

-- Enter Child Mode for one of the adult's own (non-removed) children.
create or replace function public.enter_child_mode(child uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  acct public.adult_accounts%rowtype;
begin
  select * into acct from public.adult_accounts where id = (select auth.uid()) for update;
  if not found then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.is_guardian_of(child) then
    return 'not_found';
  end if;
  if acct.pin_hash is null then
    return 'pin_required';
  end if;
  if acct.child_mode_child_id is not null and acct.child_mode_child_id <> child then
    return 'child_mode_active';  -- switching profiles requires the PIN first
  end if;

  update public.adult_accounts
    set child_mode_child_id = child,
        child_mode_started_at = coalesce(acct.child_mode_started_at, now())
    where id = acct.id;
  return 'ok';
end;
$$;

-- Leave Child Mode. Requires the parent PIN; 5 wrong attempts lock for 15 minutes.
create or replace function public.exit_child_mode(pin text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  acct public.adult_accounts%rowtype;
begin
  select * into acct from public.adult_accounts where id = (select auth.uid()) for update;
  if not found then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if acct.child_mode_child_id is null then
    return 'ok';
  end if;
  if acct.pin_locked_until is not null and acct.pin_locked_until > now() then
    return 'locked';
  end if;
  if acct.pin_hash is null or pin is null or extensions.crypt(pin, acct.pin_hash) <> acct.pin_hash then
    update public.adult_accounts
      set pin_failed_attempts = acct.pin_failed_attempts + 1,
          pin_locked_until = case when acct.pin_failed_attempts + 1 >= 5
                                  then now() + interval '15 minutes' end
      where id = acct.id;
    return case when acct.pin_failed_attempts + 1 >= 5 then 'locked' else 'wrong_pin' end;
  end if;

  update public.adult_accounts
    set child_mode_child_id = null,
        child_mode_started_at = null,
        pin_failed_attempts = 0,
        pin_locked_until = null
    where id = acct.id;
  return 'ok';
end;
$$;

-- Forgotten PIN: a FRESH password sign-in (within 5 minutes, per the JWT `amr` claim)
-- proves the adult is present. Clears the PIN and Child Mode; a new PIN must be set.
create or replace function public.reset_pin_after_password_auth()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  fresh boolean;
begin
  select exists (
    select 1
    from jsonb_array_elements(coalesce((select auth.jwt()) -> 'amr', '[]'::jsonb)) as m
    where m ->> 'method' in ('password', 'recovery')
      and (m ->> 'timestamp')::bigint >= extract(epoch from now())::bigint - 300
  ) into fresh;

  if not fresh then
    return 'reauth_required';
  end if;

  update public.adult_accounts
    set pin_hash = null,
        pin_failed_attempts = 0,
        pin_locked_until = null,
        child_mode_child_id = null,
        child_mode_started_at = null
    where id = (select auth.uid());

  insert into public.audit_log (actor_id, action, target_type, target_id)
    values ((select auth.uid()), 'pin.reset_after_reauth', 'adult_account', (select auth.uid()));
  return 'ok';
end;
$$;

-- ---------------------------------------------------------------------------
-- child_profiles: tighter write rules
-- ---------------------------------------------------------------------------

-- Clients may only change these columns. guardian_id, is_demo and
-- credentials_opt_in are fixed or server-controlled.
revoke update on public.child_profiles from authenticated;
grant update (nickname, avatar_key, age_band, deleted_at) on public.child_profiles to authenticated;

-- Real-data gate + consent gate, enforced in the database.
drop policy child_profiles_insert_own on public.child_profiles;
create policy child_profiles_insert_own on public.child_profiles
  for insert to authenticated
  with check (
    guardian_id = (select auth.uid())
    and public.has_core_consent((select auth.uid()))
    and (is_demo or public.real_child_data_enabled())
    and deleted_at is null
    and credentials_opt_in = false
  );

-- Up to 8 active child profiles per family.
create or replace function public.enforce_child_profile_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.child_profiles p
      where p.guardian_id = new.guardian_id and p.deleted_at is null) >= 8 then
    raise exception 'A family can have at most 8 child profiles' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger child_profiles_limit
  before insert on public.child_profiles
  for each row execute function public.enforce_child_profile_limit();

-- ---------------------------------------------------------------------------
-- Deletion policy: soft delete → 30-day grace → permanent purge
-- ---------------------------------------------------------------------------

create or replace function public.on_child_profile_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (actor_id, action, target_type, target_id)
      values (new.guardian_id, 'child.created', 'child_profile', new.id);
    return new;
  end if;

  if old.deleted_at is null and new.deleted_at is not null then
    new.deleted_at := now();  -- server clock, not client-supplied
    insert into public.deletion_jobs (target_type, target_id, requested_by, scheduled_for)
      values ('child_profile', new.id, new.guardian_id, now() + interval '30 days');
    update public.adult_accounts
      set child_mode_child_id = null, child_mode_started_at = null
      where child_mode_child_id = new.id;
    insert into public.audit_log (actor_id, action, target_type, target_id)
      values (new.guardian_id, 'child.removed', 'child_profile', new.id);
  elsif old.deleted_at is not null and new.deleted_at is null then
    delete from public.deletion_jobs
      where target_type = 'child_profile' and target_id = new.id and executed_at is null;
    insert into public.audit_log (actor_id, action, target_type, target_id)
      values (new.guardian_id, 'child.restored', 'child_profile', new.id);
  elsif old.deleted_at is not null and new.deleted_at is distinct from old.deleted_at then
    new.deleted_at := old.deleted_at;  -- cannot move the deletion clock
  end if;
  return new;
end;
$$;

create trigger child_profiles_insert_audit
  after insert on public.child_profiles
  for each row execute function public.on_child_profile_change();

create trigger child_profiles_soft_delete
  before update of deleted_at on public.child_profiles
  for each row execute function public.on_child_profile_change();

-- Permanently delete profiles whose 30-day grace period has passed. Server/cron only.
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
  for job in
    select * from public.deletion_jobs
    where executed_at is null and scheduled_for <= now() and target_type = 'child_profile'
    for update skip locked
  loop
    delete from public.child_profiles where id = job.target_id and deleted_at is not null;
    update public.deletion_jobs set executed_at = now() where id = job.id;
    insert into public.audit_log (actor_id, action, target_type, target_id)
      values (null, 'child.purged', 'child_profile', job.target_id);
    purged := purged + 1;
  end loop;
  return purged;
end;
$$;

-- Audit consent grants.
create or replace function public.on_consent_recorded()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (actor_id, action, target_type, target_id)
    values (new.guardian_id, 'consent.granted', 'consent_record', new.id);
  return new;
end;
$$;

create trigger consent_records_audit
  after insert on public.consent_records
  for each row execute function public.on_consent_recorded();

-- Schedule the daily purge when pg_cron is available (it is on hosted Supabase once enabled).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
      perform cron.schedule('lf-purge-deleted-children', '17 3 * * *', 'select public.purge_due_deletions()');
    exception when others then
      raise notice 'pg_cron not scheduled (%). Run public.purge_due_deletions() daily from the server.', sqlerrm;
    end;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges: nothing for anonymous visitors; purge is server-only.
-- ---------------------------------------------------------------------------

revoke execute on function
  public.adult_has_pin(),
  public.set_adult_pin(text, text),
  public.enter_child_mode(uuid),
  public.exit_child_mode(text),
  public.reset_pin_after_password_auth(),
  public.real_child_data_enabled(),
  public.purge_due_deletions(),
  public.enforce_child_profile_limit(),
  public.on_child_profile_change(),
  public.on_consent_recorded(),
  public.handle_new_auth_user(),
  public.has_core_consent(uuid),
  public.is_guardian_of(uuid)
from public, anon;

revoke execute on function public.purge_due_deletions() from authenticated;

grant execute on function
  public.adult_has_pin(),
  public.set_adult_pin(text, text),
  public.enter_child_mode(uuid),
  public.exit_child_mode(text),
  public.reset_pin_after_password_auth(),
  public.real_child_data_enabled(),  -- evaluated inside the child_profiles insert policy
  public.has_core_consent(uuid),
  public.is_guardian_of(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Explicit table privileges for signed-in parents.
-- Supabase projects may not auto-grant new tables to `authenticated`, so state the
-- intended privileges outright. RLS still decides WHICH rows are visible.
-- ---------------------------------------------------------------------------

grant select, insert on public.consent_records to authenticated;
grant select, insert on public.child_profiles to authenticated;

grant select, insert, update, delete
  on public.lesson_progress, public.activity_responses, public.startup_projects,
     public.pitch_decks, public.pitch_slides
  to authenticated;

grant select
  on public.quiz_attempts, public.simulator_sessions, public.simulator_rounds,
     public.investor_sessions, public.investor_responses, public.child_achievements,
     public.certificates, public.credential_issuances
  to authenticated;
