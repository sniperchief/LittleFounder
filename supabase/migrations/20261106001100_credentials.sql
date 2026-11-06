-- LITTLE FOUNDERS · 0011 Founder Passport credentials & Base Sepolia anchoring (Phase 7)
-- Format, hashing, consent and anchoring rules: docs/CREDENTIALS.md.
--
-- Builds on 0004 (certificates, credential_issuances, credential_secrets).
--   * Credentials are issued ONLY here, from stored progress (public.evaluate_achievements).
--     Each one gets a canonical JSON document, a SHA-256 hash of it, and a 32-byte random salt.
--     The salt lives in credential_secrets, which no client role can read.
--   * The public proof = SHA-256(hash || salt). Only that (plus a credential type id) may ever be
--     sent on-chain, and only for a child whose parent has explicitly opted in.
--   * Issued credentials, salts and confirmed anchoring records are immutable.
--   * Anchoring is done by a server process with the service role (never a browser); the
--     functions it uses validate every state transition.
--   * Hardening: parent-only writes (consent, profiles, account) are refused while the account
--     is in Child Mode, at the database level too.

-- ---------------------------------------------------------------------------
-- Hardening: parent-only writes are refused during Child Mode
-- ---------------------------------------------------------------------------

create or replace function public.in_child_mode()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select a.child_mode_child_id is not null from public.adult_accounts a where a.id = (select auth.uid())), false);
$$;

drop policy adult_accounts_update_own on public.adult_accounts;
create policy adult_accounts_update_own on public.adult_accounts
  for update to authenticated
  using (id = (select auth.uid()) and not public.in_child_mode())
  with check (id = (select auth.uid()));

-- Clients may only record core consent themselves; credential-anchoring consent goes through
-- set_credential_anchoring() below.
drop policy consent_records_insert_own on public.consent_records;
create policy consent_records_insert_own on public.consent_records
  for insert to authenticated
  with check (
    guardian_id = (select auth.uid())
    and consent_type = 'core_processing'
    and withdrawn_at is null
    and (child_id is null or public.is_guardian_of(child_id))
    and not public.in_child_mode()
  );

drop policy child_profiles_insert_own on public.child_profiles;
create policy child_profiles_insert_own on public.child_profiles
  for insert to authenticated
  with check (
    guardian_id = (select auth.uid())
    and public.has_core_consent((select auth.uid()))
    and (is_demo or public.real_child_data_enabled())
    and deleted_at is null
    and credentials_opt_in = false
    and not public.in_child_mode()
  );

drop policy child_profiles_update_own on public.child_profiles;
create policy child_profiles_update_own on public.child_profiles
  for update to authenticated
  using (guardian_id = (select auth.uid()) and not public.in_child_mode())
  with check (guardian_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Credential content and records
-- ---------------------------------------------------------------------------

alter table public.certificate_types
  add column description text not null default '';

alter table public.certificates
  add column format_version   smallint not null default 1 check (format_version = 1),
  add column evidence         jsonb,
  add column document         jsonb,
  add column credential_hash  text check (credential_hash ~ '^[0-9a-f]{64}$');

alter table public.credential_issuances
  drop constraint credential_issuances_status_check,
  add constraint credential_issuances_status_check
    check (status in ('pending', 'submitted', 'confirmed', 'failed', 'cancelled', 'revoked')),
  add constraint credential_issuances_error_length check (char_length(error) <= 500),
  add column issuer_address  text check (issuer_address ~ '^0x[0-9a-fA-F]{40}$'),
  add column nonce           bigint check (nonce >= 0),
  add column raw_tx          text check (raw_tx ~ '^0x[0-9a-f]+$' and char_length(raw_tx) <= 20000),
  add column block_number    bigint,
  add column attempts        smallint not null default 0 check (attempts between 0 and 100),
  add column locked_until    timestamptz,
  add column updated_at      timestamptz not null default now(),
  add constraint credential_issuances_confirmed_shape check (
    status <> 'confirmed' or (attestation_uid is not null and tx_hash is not null and schema_uid is not null
                              and subject_commitment is not null and confirmed_at is not null)
  ),
  add constraint credential_issuances_submitted_shape check (
    status <> 'submitted' or (tx_hash is not null and raw_tx is not null and nonce is not null and subject_commitment is not null)
  );

-- Canonical JSON (format "LF-CANON-1", mirrored by src/lib/credentials/canonical.ts):
-- object keys sorted by code point, no whitespace, strings JSON-escaped, integers only.
create or replace function public.canonical_json(j jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  case jsonb_typeof(j)
    when 'object' then
      return '{' || coalesce((select string_agg(to_json(e.key)::text || ':' || public.canonical_json(e.value), ',' order by e.key collate "C")
                              from jsonb_each(j) e), '') || '}';
    when 'array' then
      return '[' || coalesce((select string_agg(public.canonical_json(a.value), ',' order by a.ordinality)
                              from jsonb_array_elements(j) with ordinality a), '') || ']';
    when 'string' then
      return to_json(j #>> '{}')::text;
    when 'number' then
      if j::text !~ '^-?(0|[1-9][0-9]*)$' then
        raise exception 'canonical_json: only integers are allowed' using errcode = 'check_violation';
      end if;
      return j::text;
    else
      return j::text;  -- true, false, null
  end case;
end;
$$;

create or replace function public.credential_hash_of(doc jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(convert_to(public.canonical_json(doc), 'UTF8'), 'sha256'), 'hex');
$$;

-- Public proof for a credential: SHA-256(hash bytes || salt), as 0x-prefixed hex (bytes32).
create or replace function public.credential_proof(p_certificate uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select '0x' || encode(extensions.digest(decode(c.credential_hash, 'hex') || s.salt, 'sha256'), 'hex')
  from public.certificates c join public.credential_secrets s on s.certificate_id = c.id
  where c.id = p_certificate;
$$;

-- Issue one credential (idempotent per child and type). Returns the certificate id when newly
-- issued, null when the child already holds it.
create or replace function public.issue_credential(p_child uuid, p_type uuid, p_evidence jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.certificate_types%rowtype;
  cert_id uuid := gen_random_uuid();
  issued timestamptz := date_trunc('second', now());
  doc jsonb;
begin
  select * into t from public.certificate_types where id = p_type;
  doc := jsonb_build_object(
    'credentialId', cert_id,
    'evidence', coalesce(p_evidence, '{}'::jsonb),
    'formatVersion', 1,
    'issuedAt', to_char(issued at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'issuer', 'Little Founders',
    'subject', p_child,
    'title', t.title,
    'type', t.key
  );
  insert into public.certificates (id, child_id, certificate_type_id, issued_at, verification_code, evidence, document, credential_hash)
    values (cert_id, p_child, t.id, issued, encode(extensions.gen_random_bytes(12), 'hex'), coalesce(p_evidence, '{}'::jsonb),
            doc, public.credential_hash_of(doc))
    on conflict (child_id, certificate_type_id) do nothing;
  if not found then
    return null;
  end if;
  insert into public.credential_secrets (certificate_id, salt) values (cert_id, extensions.gen_random_bytes(32));
  -- Already opted in to anchoring: queue it (the server worker re-checks consent before sending).
  if t.onchain_eligible and exists (select 1 from public.child_profiles p where p.id = p_child and p.credentials_opt_in) then
    insert into public.credential_issuances (certificate_id, chain_id, status) values (cert_id, 84532, 'pending')
      on conflict (certificate_id) do nothing;
  end if;
  return cert_id;
end;
$$;

-- Backfill credentials issued before this migration (fictional demo profiles only exist).
do $$
declare
  c record;
  doc jsonb;
begin
  for c in select x.*, t.key, t.title from public.certificates x join public.certificate_types t on t.id = x.certificate_type_id
           where x.document is null loop
    doc := jsonb_build_object(
      'credentialId', c.id, 'evidence', '{"backfilled": true}'::jsonb, 'formatVersion', 1,
      'issuedAt', to_char(date_trunc('second', c.issued_at) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'issuer', 'Little Founders', 'subject', c.child_id, 'title', c.title, 'type', c.key);
    update public.certificates set issued_at = date_trunc('second', issued_at), evidence = doc -> 'evidence', document = doc,
      credential_hash = public.credential_hash_of(doc) where id = c.id;
    insert into public.credential_secrets (certificate_id, salt) values (c.id, extensions.gen_random_bytes(32))
      on conflict (certificate_id) do nothing;
  end loop;
end;
$$;

alter table public.certificates
  alter column evidence set not null,
  alter column document set not null,
  alter column credential_hash set not null;

-- ---------------------------------------------------------------------------
-- Immutability
-- ---------------------------------------------------------------------------

create or replace function public.certificates_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.child_id is distinct from old.child_id
     or new.certificate_type_id is distinct from old.certificate_type_id or new.issued_at is distinct from old.issued_at
     or new.verification_code is distinct from old.verification_code or new.format_version is distinct from old.format_version
     or new.evidence is distinct from old.evidence or new.document is distinct from old.document
     or new.credential_hash is distinct from old.credential_hash
     or (old.status = 'revoked' and new.status <> 'revoked') then
    raise exception 'Issued credentials cannot be changed' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger certificates_immutable
  before update on public.certificates
  for each row execute function public.certificates_guard();

create or replace function public.credential_secrets_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Credential salts cannot be changed' using errcode = 'check_violation';
end;
$$;

create trigger credential_secrets_immutable
  before update on public.credential_secrets
  for each row execute function public.credential_secrets_guard();

-- Anchoring records: identity fields never change; a confirmed record can only become revoked.
create or replace function public.credential_issuances_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.certificate_id is distinct from old.certificate_id or new.chain_id is distinct from old.chain_id then
    raise exception 'Anchoring records cannot be moved' using errcode = 'check_violation';
  end if;
  if old.status = 'confirmed' and (new.status not in ('confirmed', 'revoked')
       or new.attestation_uid is distinct from old.attestation_uid or new.tx_hash is distinct from old.tx_hash
       or new.subject_commitment is distinct from old.subject_commitment or new.schema_uid is distinct from old.schema_uid) then
    raise exception 'Confirmed anchoring records cannot be changed' using errcode = 'check_violation';
  end if;
  if old.status = 'submitted' and new.tx_hash is distinct from old.tx_hash and new.status <> 'failed' then
    raise exception 'A submitted transaction cannot be replaced' using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger credential_issuances_guarded
  before update on public.credential_issuances
  for each row execute function public.credential_issuances_guard();

-- ---------------------------------------------------------------------------
-- Achievements & credentials: same as 0010, with credential issuance for both milestone types
-- (modules_completed → Founder Academy; practice_score → Pitch Ready).
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
  bp_id uuid;
  bp_score smallint;
  bp_version smallint;
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
      perform public.issue_credential(p_child, cert.id, jsonb_build_object(
        'modulesCompleted', modules_done, 'lessonsCompleted', lessons_done,
        'quizzesPassed', (select count(distinct qa.quiz_id) from public.quiz_attempts qa where qa.child_id = p_child and qa.passed)));
    elsif cert.requirement ->> 'type' = 'practice_score' then
      bp_id := null;
      select s.id, s.total_score, v.version into bp_id, bp_score, bp_version
        from public.investor_sessions s join public.pitch_versions v on v.id = s.pitch_version_id
        where s.child_id = p_child and s.completed_at is not null and s.total_score >= (cert.requirement ->> 'min')::integer
        order by s.total_score desc, s.completed_at limit 1;
      if bp_id is not null then
        perform public.issue_credential(p_child, cert.id, jsonb_build_object(
          'practiceId', bp_id, 'practiceScore', bp_score,
          'minimumScore', (cert.requirement ->> 'min')::integer, 'pitchVersion', bp_version));
      end if;
    end if;
  end loop;

  return earned;
end;
$$;

-- ---------------------------------------------------------------------------
-- Parent-controlled anchoring consent (per child; default off)
-- ---------------------------------------------------------------------------

create or replace function public.has_anchoring_consent(p_child uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.child_profiles p
    join public.consent_records c on c.child_id = p.id and c.guardian_id = p.guardian_id
    where p.id = p_child and p.deleted_at is null and p.credentials_opt_in
      and c.consent_type = 'onchain_credential' and c.withdrawn_at is null
  );
$$;

-- enable = true needs the parent's typed name and the current notice version
-- (src/lib/credentials/canonical.ts → ANCHORING_NOTICE_VERSION).
create or replace function public.set_credential_anchoring(child uuid, enable boolean, typed_name text default null, notice_version text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  n integer;
  kept integer;
begin
  if me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if public.in_child_mode() then
    return jsonb_build_object('status', 'child_mode_active');
  end if;
  if not public.has_core_consent(me) then
    return jsonb_build_object('status', 'consent_required');
  end if;
  if child is null or not public.is_guardian_of(child) then
    return jsonb_build_object('status', 'not_found');
  end if;
  perform 1 from public.child_profiles p where p.id = child for update;

  if enable then
    if typed_name is null or char_length(btrim(typed_name)) not between 2 and 120
       or notice_version is distinct from 'credentials-2026-11-v1' then
      return jsonb_build_object('status', 'invalid');
    end if;
    if public.has_anchoring_consent(child) then
      return jsonb_build_object('status', 'ok', 'already', true, 'queued', 0);
    end if;
    if (select count(*) from public.consent_records c where c.guardian_id = me and c.consent_type = 'onchain_credential'
        and c.granted_at > now() - interval '1 hour') >= 10 then
      return jsonb_build_object('status', 'rate_limited');
    end if;
    insert into public.consent_records (guardian_id, child_id, consent_type, notice_version, typed_name)
      values (me, child, 'onchain_credential', notice_version, btrim(typed_name));
    update public.child_profiles p set credentials_opt_in = true where p.id = child;
    insert into public.credential_issuances (certificate_id, chain_id, status)
      select c.id, 84532, 'pending' from public.certificates c join public.certificate_types t on t.id = c.certificate_type_id
      where c.child_id = child and c.status = 'active' and t.onchain_eligible
      on conflict (certificate_id) do update set status = 'pending', error = null, locked_until = null
        where public.credential_issuances.status in ('cancelled', 'failed');
    get diagnostics n = row_count;
    return jsonb_build_object('status', 'ok', 'already', false, 'queued', n);
  end if;

  update public.consent_records c set withdrawn_at = now()
    where c.guardian_id = me and c.child_id = child and c.consent_type = 'onchain_credential' and c.withdrawn_at is null;
  get diagnostics n = row_count;
  update public.child_profiles p set credentials_opt_in = false where p.id = child;
  update public.credential_issuances i set status = 'cancelled', locked_until = null
    from public.certificates c
    where c.id = i.certificate_id and c.child_id = child and i.status in ('pending', 'failed');
  select count(*) into kept from public.credential_issuances i join public.certificates c on c.id = i.certificate_id
    where c.child_id = child and i.status in ('submitted', 'confirmed');
  if n > 0 then
    insert into public.audit_log (actor_id, action, target_type, target_id)
      values (me, 'consent.withdrawn.onchain_credential', 'child_profile', child);
  end if;
  return jsonb_build_object('status', 'ok', 'withdrawn', n > 0, 'already_public', kept);
end;
$$;

-- Parent asks for another try after a failed anchoring attempt.
create or replace function public.retry_credential_anchoring(certificate_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  iss public.credential_issuances%rowtype;
  child uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if public.in_child_mode() then
    return jsonb_build_object('status', 'child_mode_active');
  end if;
  select c.child_id into child from public.certificates c where c.id = retry_credential_anchoring.certificate_id;
  if child is null or not public.is_guardian_of(child) then
    return jsonb_build_object('status', 'not_found');
  end if;
  if not public.has_anchoring_consent(child) then
    return jsonb_build_object('status', 'consent_required');
  end if;
  select * into iss from public.credential_issuances i where i.certificate_id = retry_credential_anchoring.certificate_id for update;
  if not found or iss.status <> 'failed' then
    return jsonb_build_object('status', 'not_retryable');
  end if;
  if iss.attempts >= 5 then
    return jsonb_build_object('status', 'too_many_attempts');
  end if;
  update public.credential_issuances i set status = 'pending', error = null, locked_until = null where i.id = iss.id;
  return jsonb_build_object('status', 'ok');
end;
$$;

-- ---------------------------------------------------------------------------
-- Anchoring worker (service role only). See docs/CREDENTIALS.md §5 for the state machine.
-- ---------------------------------------------------------------------------

-- Claim up to max_jobs records to work on (2-minute lease). Pending records are only handed out
-- while the parent's consent is active; submitted ones are always followed up (already broadcast).
create or replace function public.claim_credential_anchor_jobs(max_jobs integer default 5)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  jobs jsonb;
begin
  with picked as (
    select i.id from public.credential_issuances i
    join public.certificates c on c.id = i.certificate_id
    where i.chain_id = 84532
      and (i.locked_until is null or i.locked_until < now())
      and ((i.status = 'pending' and c.status = 'active' and public.has_anchoring_consent(c.child_id)) or i.status = 'submitted')
    order by i.created_at
    limit least(greatest(coalesce(max_jobs, 5), 1), 20)
    for update of i skip locked
  ), claimed as (
    update public.credential_issuances i
      set locked_until = now() + interval '2 minutes',
          subject_commitment = coalesce(i.subject_commitment, public.credential_proof(i.certificate_id))
      from picked where i.id = picked.id
      returning i.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', cl.id, 'status', cl.status, 'certificate_id', cl.certificate_id, 'credential_type', t.key,
      'proof', cl.subject_commitment, 'tx_hash', cl.tx_hash, 'raw_tx', cl.raw_tx, 'nonce', cl.nonce,
      'attempts', cl.attempts) order by cl.created_at), '[]'::jsonb)
    into jobs
    from claimed cl join public.certificates c on c.id = cl.certificate_id join public.certificate_types t on t.id = c.certificate_type_id;
  return jobs;
end;
$$;

-- Record the outcome of one step. outcome: 'submitted' | 'confirmed' | 'failed' | 'release'.
create or replace function public.record_credential_anchor(issuance_id uuid, outcome text, details jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  iss public.credential_issuances%rowtype;
  d jsonb := coalesce(details, '{}'::jsonb);
begin
  select * into iss from public.credential_issuances i where i.id = record_credential_anchor.issuance_id for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if outcome = 'submitted' and iss.status = 'pending' then
    if d ->> 'proof' is distinct from iss.subject_commitment then
      return jsonb_build_object('status', 'proof_mismatch');
    end if;
    update public.credential_issuances i set status = 'submitted', tx_hash = d ->> 'tx_hash', raw_tx = d ->> 'raw_tx',
      nonce = (d ->> 'nonce')::bigint, issuer_address = d ->> 'issuer_address', schema_uid = d ->> 'schema_uid',
      attempts = i.attempts + 1, error = null
      where i.id = iss.id;
  elsif outcome = 'confirmed' and iss.status = 'submitted' then
    if d ->> 'tx_hash' is distinct from iss.tx_hash or d ->> 'proof' is distinct from iss.subject_commitment
       or d ->> 'schema_uid' is distinct from iss.schema_uid then
      return jsonb_build_object('status', 'proof_mismatch');
    end if;
    update public.credential_issuances i set status = 'confirmed', attestation_uid = d ->> 'attestation_uid',
      block_number = (d ->> 'block_number')::bigint, confirmed_at = now(), locked_until = null, error = null
      where i.id = iss.id;
  elsif outcome = 'failed' and iss.status in ('pending', 'submitted') then
    update public.credential_issuances i set status = 'failed', error = left(coalesce(d ->> 'error', 'Anchoring failed'), 500),
      locked_until = null, raw_tx = null, nonce = null
      where i.id = iss.id;
  elsif outcome = 'release' and iss.status in ('pending', 'submitted') then
    update public.credential_issuances i set locked_until = null, error = left(d ->> 'error', 500) where i.id = iss.id;
  else
    return jsonb_build_object('status', 'invalid_transition', 'current', iss.status);
  end if;
  return jsonb_build_object('status', 'ok');
end;
$$;

-- ---------------------------------------------------------------------------
-- Public verification (no personal data). Anyone with the unguessable code may call it.
-- ---------------------------------------------------------------------------
create or replace function public.verify_credential(code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c record;
  iss public.credential_issuances%rowtype;
  matches boolean;
begin
  if code is null or code !~ '^[A-Za-z0-9]{12,32}$' then
    return jsonb_build_object('status', 'not_found');
  end if;
  select x.*, t.key as type_key, t.title as type_title, t.description as type_description
    into c from public.certificates x join public.certificate_types t on t.id = x.certificate_type_id
    join public.child_profiles p on p.id = x.child_id
    where x.verification_code = code and p.deleted_at is null;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  matches := c.credential_hash = public.credential_hash_of(c.document)
             and c.document ->> 'credentialId' = c.id::text and c.document ->> 'type' = c.type_key;
  select * into iss from public.credential_issuances i where i.certificate_id = c.id;
  return jsonb_build_object(
    'status', case when not matches then 'integrity_failed' when c.status = 'revoked' then 'revoked' else 'valid' end,
    'credential', jsonb_build_object('type', c.type_key, 'title', c.type_title, 'description', c.type_description,
                                     'issued_on', to_char(c.issued_at at time zone 'UTC', 'YYYY-MM-DD'),
                                     'issuer', 'Little Founders', 'format_version', c.format_version),
    'integrity', jsonb_build_object('hash_matches', matches, 'algorithm', 'sha256', 'canonicalization', 'LF-CANON-1'),
    'anchor', case when iss.status in ('submitted', 'confirmed', 'revoked') then jsonb_build_object(
        'status', iss.status, 'chain_id', iss.chain_id, 'tx_hash', iss.tx_hash, 'attestation_uid', iss.attestation_uid,
        'schema_uid', iss.schema_uid, 'issuer_address', iss.issuer_address, 'proof', iss.subject_commitment,
        'proof_matches', iss.subject_commitment = public.credential_proof(c.id),
        'confirmed_at', iss.confirmed_at) end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke execute on function
  public.in_child_mode(),
  public.canonical_json(jsonb),
  public.credential_hash_of(jsonb),
  public.credential_proof(uuid),
  public.issue_credential(uuid, uuid, jsonb),
  public.certificates_guard(),
  public.credential_secrets_guard(),
  public.credential_issuances_guard(),
  public.evaluate_achievements(uuid, text),
  public.has_anchoring_consent(uuid),
  public.set_credential_anchoring(uuid, boolean, text, text),
  public.retry_credential_anchoring(uuid),
  public.claim_credential_anchor_jobs(integer),
  public.record_credential_anchor(uuid, text, jsonb),
  public.verify_credential(text)
from public, anon, authenticated;

grant execute on function public.in_child_mode() to authenticated;  -- evaluated inside RLS policies
grant execute on function
  public.set_credential_anchoring(uuid, boolean, text, text),
  public.retry_credential_anchoring(uuid)
to authenticated;
grant execute on function public.verify_credential(text) to anon, authenticated;
grant execute on function
  public.claim_credential_anchor_jobs(integer),
  public.record_credential_anchor(uuid, text, jsonb),
  public.verify_credential(text)
to service_role;
