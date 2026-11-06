-- LITTLE FOUNDERS · 0001 Foundation
-- Adult accounts, child profiles, consent, family-isolation helpers, operational tables.
-- See docs/DATABASE_SCHEMA.md §3, §10, §11.
--
-- Security model:
--   * Only adults have auth.users rows. Children are guardian-owned child_profiles.
--   * Every table has RLS enabled. Policies target the `authenticated` role only;
--     `anon` gets no access to private data. `service_role` (server only) bypasses RLS.

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- adult_accounts  (Private-Adult)
-- ---------------------------------------------------------------------------

create table public.adult_accounts (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null default '' check (char_length(display_name) <= 80),
  role          text not null default 'parent' check (role in ('parent', 'educator')),
  country_code  text check (country_code ~ '^[A-Z]{2}$'),
  pin_hash      text,            -- adult unlock PIN (hashed). Never readable by clients.
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger adult_accounts_updated_at
  before update on public.adult_accounts
  for each row execute function public.set_updated_at();

-- Create the adult row automatically when an auth user signs up.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.adult_accounts (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- consent_records  (Private-Adult, append-only)
-- ---------------------------------------------------------------------------

create table public.consent_records (
  id              uuid primary key default gen_random_uuid(),
  guardian_id     uuid not null references public.adult_accounts (id) on delete cascade,
  child_id        uuid,  -- FK added after child_profiles exists
  consent_type    text not null check (consent_type in ('core_processing', 'onchain_credential')),
  notice_version  text not null check (char_length(notice_version) between 1 and 40),
  method          text not null default 'email_verified_plus_affirmation'
                    check (method in ('email_verified_plus_affirmation')),
  typed_name      text not null check (char_length(typed_name) between 2 and 120),
  granted_at      timestamptz not null default now(),
  withdrawn_at    timestamptz
);

create index consent_records_guardian_idx on public.consent_records (guardian_id);

-- True while the current adult holds an active core-processing consent.
create or replace function public.has_core_consent(adult uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.consent_records c
    where c.guardian_id = adult
      and c.consent_type = 'core_processing'
      and c.withdrawn_at is null
  );
$$;

-- ---------------------------------------------------------------------------
-- child_profiles  (Private-Child)
-- No legal name, DOB, school, photo, contact details or location are stored.
-- ---------------------------------------------------------------------------

create table public.child_profiles (
  id                  uuid primary key default gen_random_uuid(),
  guardian_id         uuid not null references public.adult_accounts (id) on delete cascade,
  nickname            text not null check (char_length(nickname) between 2 and 20),
  avatar_key          text not null default 'founder-1' check (char_length(avatar_key) <= 40),
  age_band            text not null check (age_band in ('10-11', '12-13')),
  locale              text not null default 'en' check (char_length(locale) <= 10),
  is_demo             boolean not null default false,  -- fictional demo profile marker
  credentials_opt_in  boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz                       -- starts 30-day hard-delete timer
);

create index child_profiles_guardian_idx on public.child_profiles (guardian_id);

create trigger child_profiles_updated_at
  before update on public.child_profiles
  for each row execute function public.set_updated_at();

alter table public.consent_records
  add constraint consent_records_child_fk
  foreign key (child_id) references public.child_profiles (id) on delete cascade;

-- Family-isolation helper used by every child-owned table's policies.
create or replace function public.is_guardian_of(child uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.child_profiles p
    where p.id = child
      and p.guardian_id = (select auth.uid())
      and p.deleted_at is null
  );
$$;

-- ---------------------------------------------------------------------------
-- Operational tables  (Restricted-System — server only)
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid,
  action      text not null check (char_length(action) <= 60),
  target_type text check (char_length(target_type) <= 40),
  target_id   uuid,
  created_at  timestamptz not null default now()
);

create index audit_log_created_idx on public.audit_log (created_at);

create table public.deletion_jobs (
  id             uuid primary key default gen_random_uuid(),
  target_type    text not null check (target_type in ('child_profile', 'adult_account')),
  target_id      uuid not null,
  requested_by   uuid,
  scheduled_for  timestamptz not null,
  executed_at    timestamptz,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------

alter table public.adult_accounts  enable row level security;
alter table public.consent_records enable row level security;
alter table public.child_profiles  enable row level security;
alter table public.audit_log       enable row level security;
alter table public.deletion_jobs   enable row level security;

-- Defence in depth: anonymous visitors get no privileges on private tables.
revoke all on public.adult_accounts, public.consent_records, public.child_profiles,
              public.audit_log, public.deletion_jobs
  from anon;

-- audit_log / deletion_jobs: no policies → authenticated users are denied; server uses service_role.
revoke all on public.audit_log, public.deletion_jobs from authenticated;

-- adult_accounts: an adult sees and edits only their own row; pin_hash is never readable.
revoke all on public.adult_accounts from authenticated;
grant select (id, display_name, role, country_code, created_at, updated_at)
  on public.adult_accounts to authenticated;
grant update (display_name, country_code) on public.adult_accounts to authenticated;

create policy adult_accounts_select_own on public.adult_accounts
  for select to authenticated
  using (id = (select auth.uid()));

create policy adult_accounts_update_own on public.adult_accounts
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- consent_records: append-only by the guardian; withdrawal handled server-side.
revoke update, delete on public.consent_records from authenticated;

create policy consent_records_select_own on public.consent_records
  for select to authenticated
  using (guardian_id = (select auth.uid()));

create policy consent_records_insert_own on public.consent_records
  for insert to authenticated
  with check (
    guardian_id = (select auth.uid())
    and withdrawn_at is null
    and (child_id is null or public.is_guardian_of(child_id))
  );

-- child_profiles: guardian-only. Creating a profile requires active core consent.
create policy child_profiles_select_own on public.child_profiles
  for select to authenticated
  using (guardian_id = (select auth.uid()));

create policy child_profiles_insert_own on public.child_profiles
  for insert to authenticated
  with check (
    guardian_id = (select auth.uid())
    and public.has_core_consent((select auth.uid()))
  );

create policy child_profiles_update_own on public.child_profiles
  for update to authenticated
  using (guardian_id = (select auth.uid()))
  with check (guardian_id = (select auth.uid()));

-- Hard deletes happen via the server deletion job after the grace period.
revoke delete on public.child_profiles from authenticated;
