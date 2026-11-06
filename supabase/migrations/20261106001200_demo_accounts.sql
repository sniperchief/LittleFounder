-- LITTLE FOUNDERS · 0012 One-click demo accounts (judging / evaluation)
-- A "Try the demo" button creates a fresh, already-confirmed fictional parent account with one
-- demo child, so evaluators don't need a confirmation email. Switched on per deployment with the
-- server-only DEMO_ACCOUNTS_ENABLED flag. See README §2.
--
--   * Which users are demo accounts is recorded HERE (server-written), never trusted from
--     user-editable auth metadata.
--   * Rate limits: 3 per visitor per hour (visitor = keyed hash of the IP, never the raw IP),
--     200 per day in total.
--   * Demo accounts and everything in them are deleted automatically 48 hours after creation.
--   * The real-child-data gate is untouched: demo children are is_demo profiles.

create table public.demo_accounts (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  client_hash  text not null check (client_hash ~ '^[0-9a-f]{64}$'),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '48 hours'
);

create index demo_accounts_client_idx on public.demo_accounts (client_hash, created_at);
create index demo_accounts_expiry_idx on public.demo_accounts (expires_at);

alter table public.demo_accounts enable row level security;
revoke all on public.demo_accounts from anon, authenticated;

-- 'ok' | 'rate_limited' | 'capacity'
create or replace function public.demo_account_allowed(client_hash text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select count(*) from public.demo_accounts d
          where d.client_hash = demo_account_allowed.client_hash and d.created_at > now() - interval '1 hour') >= 3 then 'rate_limited'
    when (select count(*) from public.demo_accounts d where d.created_at > now() - interval '24 hours') >= 200 then 'capacity'
    else 'ok'
  end;
$$;

-- Marks a just-created auth user as a demo account (only users created in the last 5 minutes).
create or replace function public.register_demo_account(user_id uuid, client_hash text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if register_demo_account.client_hash is null or register_demo_account.client_hash !~ '^[0-9a-f]{64}$' then
    return 'invalid';
  end if;
  if not exists (select 1 from auth.users u where u.id = register_demo_account.user_id) then
    return 'not_found';
  end if;
  if exists (select 1 from public.adult_accounts a where a.id = register_demo_account.user_id and a.created_at < now() - interval '5 minutes') then
    return 'too_old';
  end if;
  insert into public.demo_accounts (user_id, client_hash) values (register_demo_account.user_id, register_demo_account.client_hash)
    on conflict (user_id) do nothing;
  return 'ok';
end;
$$;

-- For the signed-in adult: is this a demo account? (Shows the demo banner and demo PIN hint.)
create or replace function public.is_demo_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.demo_accounts d where d.user_id = (select auth.uid()));
$$;

-- Deletes expired demo accounts. Deleting the auth user cascades to the adult account, consent
-- records, child profiles and all of their activity, credentials and salts.
create or replace function public.purge_expired_demo_accounts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  d record;
  n integer := 0;
begin
  for d in select x.user_id from public.demo_accounts x where x.expires_at < now() order by x.expires_at limit 500 loop
    begin
      delete from auth.users u where u.id = d.user_id;
      insert into public.audit_log (actor_id, action, target_type, target_id) values (null, 'demo.purged', 'adult_account', d.user_id);
      n := n + 1;
    exception when others then
      raise warning 'demo purge failed for %: %', d.user_id, sqlerrm;
    end;
  end loop;
  return n;
end;
$$;

revoke execute on function
  public.demo_account_allowed(text),
  public.register_demo_account(uuid, text),
  public.is_demo_account(),
  public.purge_expired_demo_accounts()
from public, anon, authenticated;

grant execute on function public.is_demo_account() to authenticated;
grant execute on function
  public.demo_account_allowed(text),
  public.register_demo_account(uuid, text),
  public.purge_expired_demo_accounts()
to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('lf-purge-demo-accounts', '47 * * * *', 'select public.purge_expired_demo_accounts()');
  else
    raise warning 'pg_cron is unavailable: run public.purge_expired_demo_accounts() hourly from the server.';
  end if;
end;
$$;
