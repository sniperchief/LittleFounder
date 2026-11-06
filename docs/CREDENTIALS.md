# LITTLE FOUNDERS — Founder Passport credentials & Base Sepolia anchoring (Phase 7)

Credentials celebrate big learning milestones. They are **issued and verifiable entirely offchain**, in Supabase. A parent may *optionally* add an anonymous public proof of each credential to **Base Sepolia** (a test network) through the Ethereum Attestation Service (EAS). Children never see wallets, gas, tokens or contracts; Passport only says "Checked & genuine" and "Extra proof added".

| What | Where |
|---|---|
| Milestone definitions | `src/content/academy/achievements.ts` (`certificates`) → seeded into `certificate_types` |
| Issuance, hashing, consent, worker state machine, verification | `supabase/migrations/20261106001100_credentials.sql` |
| Canonical JSON + hash (app mirror) | `src/lib/credentials/canonical.ts` |
| EAS / Base Sepolia (encoding, worker, on-chain checks) | `src/lib/credentials/eas.ts`, ABI fragments in `eas-abi.ts` |
| Server wiring (env, service-role worker client) | `src/lib/credentials/server.ts` |
| Operator CLI | `scripts/credentials.mjs` (`npm run credentials -- check | register-schema | anchor`) |
| UI | Passport (`/play/passport`), parent page (`/parent/children/[id]/credentials`), public check (`/verify/[code]`) |

## 1. Credential types

Only these milestones are credentials. Badges are never anchored.

| Key | Title | Earned when (checked from stored records) | Evidence stored |
|---|---|---|---|
| `founder-academy-milestone` | Founder Academy Learning Milestone | All six modules complete (every lesson + passed quiz) | `modulesCompleted`, `lessonsCompleted`, `quizzesPassed` |
| `pitch-ready` | Pitch Ready Learning Milestone | A completed Investor Room practice scoring **≥ 70** (product spec §2.5) | `practiceId`, `practiceScore`, `minimumScore`, `pitchVersion` |

Issuance happens only inside `public.evaluate_achievements` (called by the scoring functions after server-verified progress) via `public.issue_credential`. Nothing the browser sends can create one. `unique (child_id, certificate_type_id)` plus `on conflict do nothing` mean a child holds each credential at most once.

Each `certificates` row has: `id` (unique credential id), `child_id` (internal profile reference, offchain only), type, `issued_at` (whole seconds, UTC), `evidence`, `document`, `credential_hash`, `format_version`, `status` (`active` | `revoked`) and `verification_code` (24 random hex characters, used by `/verify`).

## 2. Credential document, canonicalization and hash

```json
{
  "credentialId": "<certificate uuid>",
  "evidence": { … },
  "formatVersion": 1,
  "issuedAt": "2026-11-06T12:34:56Z",
  "issuer": "Little Founders",
  "subject": "<child profile uuid — offchain only>",
  "title": "Pitch Ready Learning Milestone",
  "type": "pitch-ready"
}
```

**Canonical form `LF-CANON-1`** (implemented identically in `public.canonical_json` and `canonicalJson()`; `db:check` compares them):

1. Objects: keys sorted by code point (keys are ASCII), written as `{"k":v,…}` with no whitespace.
2. Arrays keep their order, `[a,b]`.
3. Strings use standard JSON escaping (`\"`, `\\`, `\b\f\n\r\t`, other control characters as lowercase `\u00xx`; everything else, including non-ASCII, as UTF-8).
4. Numbers must be integers (no floats, so formatting can't differ); `true`, `false`, `null` as usual.

**Credential hash** = `SHA-256(UTF-8 bytes of the canonical form)`, lowercase hex (`certificates.credential_hash`).

**Salt** = 32 random bytes per credential (`credential_secrets.salt`). No client role can read that table, and the salt never leaves the database: even the anchoring worker only receives the proof.

**Public proof** = `SHA-256(hash bytes ‖ salt)` as `0x…` bytes32 (`public.credential_proof`). Because of the secret salt, the proof can't be guessed or linked to a child from public data, and deleting the salt makes an on-chain proof permanently unlinkable.

Issued documents, hashes, evidence and salts are immutable (triggers `certificates_guard`, `credential_secrets_guard`). The only allowed change is `status` from `active` to `revoked`.

## 3. Parent consent model

- **Separate and off by default.** Core platform consent never implies anchoring consent. `child_profiles.credentials_opt_in` defaults to `false`, clients can't write it, and clients may only insert `core_processing` consent rows themselves.
- **Per child, parent only.** `set_credential_anchoring(child, enable, typed_name, notice_version)` checks: signed-in adult, **not in Child Mode**, active core consent, guardian of that child. Turning it on requires ticking three plain-language statements (proof is public and may be permanent; no personal information; withdrawing can't erase recorded proofs), typing the parent's name, and the current notice version `credentials-2026-11-v1`.
- **Recorded.** Each opt-in is a `consent_records` row (`consent_type = 'onchain_credential'`, `child_id`, `notice_version`, `typed_name`, `granted_at`). The audit log records `consent.granted`. Rate limit: 10 opt-ins per parent per hour.
- **Withdrawal.** Sets `withdrawn_at` on the active record (history kept), clears `credentials_opt_in`, cancels every proof not yet sent (`pending`/`failed` → `cancelled`), and writes `consent.withdrawn.onchain_credential` to the audit log. Proofs already `submitted`/`confirmed` stay public; the UI says so. Credentials remain valid either way.
- Turning it on again re-queues cancelled proofs only.

## 4. Base Sepolia & EAS configuration (verified 2026-11-06)

| Item | Value | How it was verified |
|---|---|---|
| Network | Base Sepolia, chain id **84532** | docs.base.org network information; `eth_chainId` = `0x14a34` |
| Default RPC | `https://sepolia.base.org` (public, rate-limited; set `BASE_SEPOLIA_RPC_URL` for production) | docs.base.org |
| EAS | `0x4200000000000000000000000000000000000021` (OP-stack predeploy) | `@ethereum-attestation-service/eas-contracts@1.9.0` `deployments/base-sepolia/EAS.json`; on-chain `version()` = `1.4.1-beta.3` |
| SchemaRegistry | `0x4200000000000000000000000000000000000020` | same package `SchemaRegistry.json`; `EAS.getSchemaRegistry()` returns it |
| ABI | `attest`, `getAttestation`, `Attested`, `register`, `getSchema` copied by script from those artifacts | `src/lib/credentials/eas-abi.ts` |
| Explorer | `https://sepolia.basescan.org` | linked in the EAS package README |

**Schema** (no resolver, revocable): `bytes32 credentialType,bytes32 credentialProof,uint16 formatVersion`

**Schema UID** `0xc192be4ef3b5edd2f706f274676b137b8701659ec8d1903c244699e471ad5da2`, i.e. `keccak256(abi.encodePacked(schema, address(0), true))`, the formula in `SchemaRegistry._getUID`. `npm run credentials -- check` simulated `register` on Base Sepolia and the contract returned the same UID. **Status 2026-11-06: not yet registered** (needs a funded issuer key; see §8).

**Onchain data per credential** (nothing else):

| Field | Value |
|---|---|
| `recipient` | `0x000…000` (no child or parent wallet) |
| `expirationTime` / `refUID` / `value` | `0` / `0x0…0` / `0` |
| `revocable` | `true` |
| `credentialType` | `keccak256("little-founders:credential:<type key>:v1")` (a public constant per milestone) |
| `credentialProof` | the salted proof from §2 |
| `formatVersion` | `1` |

Never on-chain: names, nicknames, ages, dates of birth, profile or credential ids, verification codes, hashes without salt, evidence, answers, pitch content, emails or IPs (`CHILD_SAFETY_AND_PRIVACY.md` §11).

## 5. Anchoring process (server only)

A platform-controlled **issuer key** (an EOA) signs and pays gas. It lives only in the server environment variable `CREDENTIAL_ISSUER_PRIVATE_KEY` and is never sent to the browser (the build is checked for it). Neither children nor parents need a wallet or pay anything.

The queue lives in `credential_issuances` (one row per credential). It is processed by `runAnchorJobs` (`src/lib/credentials/eas.ts`), which uses a service-role client and only two service-role-only database functions:

1. `claim_credential_anchor_jobs(max)` hands out up to 20 records with a **2-minute lease** (`for update skip locked`). It hands out `pending` records only while the parent's consent is active, and `submitted` records always, since those are already broadcast. Each job contains only the type key and the proof.
2. For a `pending` job, the worker builds `attest(...)`, estimates gas, then **signs locally** and calls `record_credential_anchor(id, 'submitted', {tx_hash, raw_tx, nonce, …})` **before broadcasting**. Only then does it send the raw transaction. If estimation fails (schema not registered, no funds, RPC down), nothing is sent and the job is released with the reason.
3. For a `submitted` job, the worker reads the receipt and **verifies on-chain** (`verifyAnchor`):
   - the receipt status is success;
   - an `Attested` event came from the EAS address with our schema and our issuer;
   - `getAttestation(uid)` has the same schema, attester and zero recipient;
   - the decoded data equals the expected type id, proof and version.

   Only then does it call `record_credential_anchor(id, 'confirmed', {attestation_uid, block_number, …})`.
4. **Retries can't duplicate.** If the transaction isn't mined yet, the worker re-broadcasts the same signed bytes (same hash), so a second attestation can't be created. It's marked `failed` only if the transaction reverted, didn't produce the expected attestation, or its nonce was used by a different transaction.
5. `record_credential_anchor` enforces the state machine: pending → submitted → confirmed, pending or submitted → failed, release. Proof, tx hash and schema must match what was stored. Confirmed records are immutable except for revocation (`credential_issuances_guard`).

```
pending ──sign+store──▶ submitted ──verified on-chain──▶ confirmed
   │  ▲                     │
   │  └── parent "Try again" (≤ 5 attempts, consent needed) ◀── failed
   └── consent withdrawn ──▶ cancelled (re-queued if consent is given again)
```

**When it runs:** right after a parent turns proofs on or presses "Try again"/"Check progress" (Next.js `after()`, so the page never waits), and via `npm run credentials -- anchor` on a schedule (e.g. every few minutes on the server). The offchain credential is valid and visible whatever the anchoring state.

## 6. Verification

`/verify/[code]` (public, `noindex`, `Referrer-Policy: no-referrer`, no listing or search) calls `public.verify_credential(code)`, which returns only:

- the type, title and description, the issue **date**, and the issuer;
- `integrity`: whether `credential_hash` = SHA-256(canonical(stored document)) and the document's id and type match the record;
- `status`: `valid`, `revoked`, `integrity_failed` or `not_found` (a removed child's credentials are `not_found`);
- for submitted or confirmed proofs only: chain id, tx hash, attestation UID, schema UID, issuer address, the proof, and whether the proof equals SHA-256(hash ‖ salt) recomputed in the database.

If there is a proof, the page also checks it live on Base Sepolia using the same `verifyAnchor` checks as the worker. It never shows a name, nickname, profile id, evidence, hash or salt. Anyone can independently confirm the attestation on Basescan or with the EAS contract `getAttestation(uid)`.

## 7. Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `CREDENTIAL_ANCHORING_ENABLED` | server only | Kill switch; must be `"true"` for any transaction to be sent. Default off. |
| `CREDENTIAL_ISSUER_PRIVATE_KEY` | server only | Base Sepolia issuer key (`0x` + 64 hex). Testnet only, small balance. |
| `BASE_SEPOLIA_RPC_URL` | server only, optional | Dedicated RPC; defaults to `https://sepolia.base.org`. |
| `SUPABASE_SECRET_KEY` | server only | Service role, used by the worker for the two worker functions only. |

None may carry a `NEXT_PUBLIC_` prefix. A missing configuration only pauses anchoring; issuance and verification keep working.

## 8. Setup to anchor for real (not yet done)

1. Create a **new, dedicated** Base Sepolia key (never reuse a mainnet key): `npm run credentials -- new-key` writes it to `.env.local` with `CREDENTIAL_ANCHORING_ENABLED=true` and prints only the address. In hosting, put it in the provider's encrypted env as `CREDENTIAL_ISSUER_PRIVATE_KEY`.
2. Fund it with a small amount of Base Sepolia test ETH from a faucet listed in the Base docs.
3. `npm run credentials -- check` should show the issuer and its balance.
4. Set `CREDENTIAL_ANCHORING_ENABLED=true`, then run `npm run credentials -- register-schema`. This registers the schema above, checks the on-chain UID and prints the transaction.
5. As a parent, turn on proofs for a demo child, then press "Check progress" or run `npm run credentials -- anchor`. Confirm the transaction on Basescan and that `/verify/<code>` shows "Public proof found and checked".

## 9. Remaining mainnet requirements

- Professional privacy/legal review (`CHILD_SAFETY_AND_PRIVACY.md` §12, especially whether permanent records about minors are acceptable at all, and whether revoke + salt deletion satisfies erasure).
- **Revoke on deletion:** before a child profile is purged, revoke its confirmed attestations (EAS `revoke`) and delete the salt. Today the purge cascades the offchain rows (making proofs unlinkable) but does not revoke on-chain.
- Managed signer (KMS / CDP Server Wallet) instead of a raw env key; separate mainnet key with a minimal balance, balance alerts, a daily global cap and per-family rate limits.
- A scheduled anchoring job in production (cron), monitoring of `failed` records, and a dedicated RPC provider.
- A mainnet schema registration (same UID formula) and an explicit `chain_id = 8453` path. The code currently only accepts 84532.
