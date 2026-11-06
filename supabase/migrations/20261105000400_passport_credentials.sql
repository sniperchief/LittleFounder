-- LITTLE FOUNDERS · 0004 Founder Passport & credentials
-- Achievements, certificates, and (Phase 7) Base/EAS issuance records.
-- See docs/DATABASE_SCHEMA.md §9 and docs/TECHNICAL_ARCHITECTURE.md §5.
--
-- Nothing in this migration issues credentials. Issuance is server-only and lands
-- in Phase 7. No personal data is ever written on-chain: only a salted commitment.

create table public.child_achievements (
  child_id        uuid not null references public.child_profiles (id) on delete cascade,
  achievement_id  uuid not null references public.achievements (id) on delete cascade,
  earned_at       timestamptz not null default now(),
  source_event    text not null check (char_length(source_event) <= 60),
  primary key (child_id, achievement_id)
);

create table public.certificates (
  id                   uuid primary key default gen_random_uuid(),
  child_id             uuid not null references public.child_profiles (id) on delete cascade,
  certificate_type_id  uuid not null references public.certificate_types (id),
  issued_at            timestamptz not null default now(),
  -- Unguessable code used by the public /verify page (which shows no personal data).
  verification_code    text not null unique check (verification_code ~ '^[A-Za-z0-9]{12,32}$'),
  status               text not null default 'active' check (status in ('active', 'revoked')),
  unique (child_id, certificate_type_id)
);

create table public.credential_issuances (
  id                  uuid primary key default gen_random_uuid(),
  certificate_id      uuid not null unique references public.certificates (id) on delete cascade,
  chain_id            integer not null check (chain_id in (8453, 84532)),  -- Base, Base Sepolia
  schema_uid          text check (schema_uid ~ '^0x[0-9a-fA-F]{64}$'),
  attestation_uid     text check (attestation_uid ~ '^0x[0-9a-fA-F]{64}$'),
  tx_hash             text check (tx_hash ~ '^0x[0-9a-fA-F]{64}$'),
  subject_commitment  text check (subject_commitment ~ '^0x[0-9a-fA-F]{64}$'),
  status              text not null default 'pending'
                        check (status in ('pending', 'submitted', 'confirmed', 'failed', 'revoked')),
  error               text,
  created_at          timestamptz not null default now(),
  confirmed_at        timestamptz,
  revoked_at          timestamptz
);

-- Restricted-System: the salt that links an on-chain commitment to a certificate.
-- Deleting this row makes the on-chain record permanently unlinkable.
create table public.credential_secrets (
  certificate_id  uuid primary key references public.certificates (id) on delete cascade,
  salt            bytea not null check (octet_length(salt) >= 32),
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row-Level Security: guardians read; only the server writes.
-- ---------------------------------------------------------------------------

alter table public.child_achievements   enable row level security;
alter table public.certificates         enable row level security;
alter table public.credential_issuances enable row level security;
alter table public.credential_secrets   enable row level security;

revoke all on public.child_achievements, public.certificates, public.credential_issuances,
              public.credential_secrets
  from anon;
revoke insert, update, delete on public.child_achievements, public.certificates,
                                 public.credential_issuances
  from authenticated;
-- No policies and no grants: clients can never touch credential secrets.
revoke all on public.credential_secrets from authenticated;

create policy child_achievements_guardian_read on public.child_achievements
  for select to authenticated
  using (public.is_guardian_of(child_id));

create policy certificates_guardian_read on public.certificates
  for select to authenticated
  using (public.is_guardian_of(child_id));

create policy credential_issuances_guardian_read on public.credential_issuances
  for select to authenticated
  using (exists (
    select 1 from public.certificates c
    where c.id = certificate_id and public.is_guardian_of(c.child_id)
  ));
