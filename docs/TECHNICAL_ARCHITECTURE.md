# LITTLE FOUNDERS — Technical Architecture

Status: Phase 0 draft, for approval · Date: 2026-11-05
Legend: **[Fact]** cited · **[Assumption]** · **[Recommendation]**

---

## 1. Architecture at a glance

```
                         ┌──────────────────────────────────────────┐
  Browser (adult or      │  Next.js (App Router, TypeScript)        │
  child on adult's  ───► │  hosted on Vercel                        │
  device)                │                                          │
                         │  • Server Components / Server Actions    │
                         │  • Route Handlers (/api/*)               │
                         │  • Middleware: session + Child Mode gate │
                         │  • Pure TS engines: quiz, simulator,     │
                         │    investor rubric, achievements         │
                         └───────────┬───────────────┬──────────────┘
                                     │               │ (server only,
                                     │               │  Phase 7, opt-in)
                       Supabase JS   │               ▼
                       (user JWT)    │      ┌──────────────────────┐
                                     ▼      │ Credential issuer    │
                  ┌──────────────────────┐  │ (server key, Base)   │
                  │ Supabase             │  │  → EAS predeploy     │
                  │ • Auth (adults only) │  │    on Base           │
                  │ • Postgres + RLS     │  └──────────────────────┘
                  │ • Storage (private)  │
                  └──────────────────────┘
```

- **Content** (modules, lessons, quizzes, simulator scenarios, investor personas & question banks, achievement definitions) lives **in the repository** as typed TypeScript/JSON and is **seeded** into read-only Postgres tables so that progress rows can reference it with foreign keys. [Recommendation]
- **User data** (adults, child profiles, consent, progress, projects, sessions, decks, evaluations, credentials) lives in Supabase Postgres protected by Row-Level Security.
- **Business logic engines** are pure TypeScript modules with no I/O, so they can be unit-tested and run on both client (instant feedback) and server (authoritative scoring).
- **Web3** is a single server-side issuer that writes optional attestations to Base's built-in EAS contracts. No custom smart contracts.

---

## 2. Evaluation of the proposed stack

| Choice | Verdict | Notes / risks | Alternative considered |
|---|---|---|---|
| **Next.js + TypeScript** | ✅ Keep | App Router + Server Actions fits well; middleware enables Child Mode gating. Risk: App Router caching surprises — use `dynamic = 'force-dynamic'` / no-store on per-user pages. | Remix, Vite SPA — no strong reason to switch. |
| **Tailwind CSS + shadcn/ui** | ✅ Keep, with caveat | shadcn gives accessible Radix primitives quickly. **Caveat:** its default look is "adult SaaS". Budget design time for a child-friendly theme (larger type, rounder shapes, illustration, colour). | Chakra / Mantine — no advantage. |
| **Supabase / Postgres** | ✅ Keep | Auth + Postgres + RLS + Storage in one, good Next.js support (`@supabase/ssr`). Risks: (1) RLS mistakes fail *silently* (return zero rows) — must test policies; (2) **data residency**: choose region deliberately (see Safety doc §10); (3) service-role key must never reach the browser. | Neon + Auth.js + Prisma — more pieces, no gain for MVP. |
| **Vercel** | ✅ Keep | Native Next.js host. Note: issuer private key for Base must be stored as an encrypted env var and only used in server routes; consider a separate signing service post-MVP. | Netlify / Fly — no gain. |
| **Base** | ✅ Keep, **narrowed** | Use the EAS contracts that are predeployed on Base; no custom deployment needed. [Fact] | Plain signed JSON credentials only (no chain) — viable fallback; see §5.6. |
| **Solidity "where necessary"** | ✅ **Not necessary for MVP** | EAS + a registered schema covers issuance, revocation, verification. Writing a contract adds audit/test burden with no MVP benefit. | Soulbound ERC-721/ERC-5192 — rejected, see §5.2. |

### Additional libraries [Recommendation — install only when the phase needs them]

| Need | Library | Phase |
|---|---|---|
| Supabase in Next.js | `@supabase/supabase-js`, `@supabase/ssr` | 2 |
| Validation | `zod` | 1 |
| Forms | `react-hook-form` + `@hookform/resolvers` | 2 |
| Tests | `vitest` (engines), `@playwright/test` (E2E) | 1+ |
| Charts in simulator | `recharts` (shadcn charts) | 5 |
| Base / EAS | `viem` + `@ethereum-attestation-service/eas-sdk` (or viem-only calls) | 7 |
| PDF certificate | browser print CSS first; `@react-pdf/renderer` only if needed | 7 |

No AI SDKs. No wallet-connection libraries (wagmi/RainbowKit/OnchainKit) are needed because no end-user wallet is connected in MVP.

---

## 3. Authentication & authorization model

### 3.1 Who authenticates
**Only adults have Supabase Auth users.** Children are rows in `child_profiles` owned by an adult. [Recommendation]

Rationale: avoids collecting any child contact data, aligns with parental-consent requirements (NDPA s.31, COPPA) and removes password-recovery problems for children.

### 3.2 Child Mode (as implemented in Phase 2)
1. Adult signs in (email + password; email verified).
2. Adult picks a child profile → `enter_child_mode(child)` (SECURITY DEFINER) checks guardianship and that a PIN exists, then sets `adult_accounts.child_mode_child_id`. **The state lives in the database, not a cookie**, so clearing cookies or typing parent URLs cannot bypass it (clearing cookies just signs the adult out; signing back in returns to Child Mode).
3. Every parent page and server action runs `requireParent()`, which redirects to `/play` while Child Mode is set. Leaving requires `exit_child_mode(pin)` (bcrypt, 5 tries → 15-minute lock) or, for a forgotten PIN, a fresh password sign-in (`amr` ≤ 5 min) that resets the PIN.
4. All child data queries run with the adult's JWT; RLS restricts rows to that adult's children.

> **Known limitation [Fact about this design]:** because the database identity is the adult, RLS cannot distinguish "child acting" from "adult acting". Child Mode is a safety boundary enforced by server guards plus database functions, not by RLS.

#### 3.2.1 Cross-device limitation and recommended fix (not yet implemented)

**Problem.** Child Mode is stored per *account*. If a parent starts Child Mode on a tablet, the parent's laptop and phone are also locked into Child Mode until the PIN is entered somewhere. That is safe but inconvenient, and it means one child's session can disrupt the parent on another device.

**Verified facts (hosted Supabase, 2026-11-06).** Every sign-in creates its own Auth session, and the access token carries a `session_id` claim. Two sign-ins for the same user get different `session_id`s; the value stays the same across token refreshes; signing out on one device (`scope: local`) leaves other sessions signed in.

**Recommendation: scope Child Mode to the Supabase Auth session (`session_id`), not to a cookie and not to the whole account.**

- New table `child_mode_sessions (session_id uuid primary key, adult_id uuid, child_id uuid, started_at timestamptz)`; RLS on, no client grants. Child Mode is active for a request iff a row exists for `auth.jwt() ->> 'session_id'`.
- `enter_child_mode` / `exit_child_mode` / `reset_pin_after_password_auth` key on the caller's `session_id` instead of the account row; PIN, lockout and audit stay account-wide (so 5 wrong tries on any device still lock the PIN).
- Removing a child deletes its `child_mode_sessions` rows; the purge job also deletes rows whose session no longer exists in `auth.sessions`.
- Parent Settings can list "Child Mode is active on another device" and end it (the parent is already authenticated in parent mode on that device).

| | Account-wide (current) | Signed device cookie | **Auth-session scoped (recommended)** |
|---|---|---|---|
| Other devices locked by one child | Yes | No | No |
| Bypass by clearing cookies | No (signs out; Child Mode remains) | **Yes** — cookie gone = Child Mode gone, and the Supabase session may survive in another cookie/storage | No — clearing cookies destroys the session itself; getting back in needs the password, which issues a *new* session that starts in parent mode only after a password sign-in (acceptable: the password proves an adult) |
| Bypass by signing in again | n/a | n/a | Requires the parent password — same strength as today's forgot-PIN path |
| Forged by the client | No | Only if signing key leaks | No — `session_id` comes from the signed JWT |
| Implementation cost | — | Low | Medium: 1 migration, 3 functions changed, guards read the claim, new tests |

**Trade-offs to accept with the recommendation.**
1. A child who clears cookies on their device ends up at the sign-in screen, not in Child Mode. Getting back in requires the parent's password, so this is not a bypass, but the child loses their Child Mode session (today they would also be signed out).
2. Session lifetime settings (Auth → Sessions: time-box / inactivity timeout) now also bound Child Mode. Recommend a generous inactivity timeout for family devices and document it.
3. Behaviour changes for parents who *rely* on the current account-wide lock (e.g. starting Child Mode on one device to lock all of them). We consider that unintended.

**Status.** Documented only; the architecture is unchanged in Phase 2. Proposed for the start of Phase 3 subject to approval.

### 3.3 Future: independent child sign-in (deferred)
For classrooms, children will need to sign in on shared devices. Options for later: educator-issued class code + picture password mapped to a Supabase user with a synthetic, non-routable identifier; or Supabase custom access-token hook adding a `child_profile_id` claim so RLS can enforce child-level isolation. Not in MVP.

### 3.4 Authorization rules (summary)
| Resource | Guardian of child | Other adults | Anonymous |
|---|---|---|---|
| Child profile & all child-owned data | read/write/delete | none | none |
| Content tables | read | read | read (marketing previews only) |
| Credential verification record | read | read | **public read of non-personal fields** via `/verify/[code]` route (server-rendered, not direct DB access) |

Service-role key used only in: seeding scripts, deletion jobs, credential issuer.

---

## 4. Application structure

### 4.1 Route map (App Router route groups)

```
app/
├─ (marketing)/
│  ├─ page.tsx                       /                 landing
│  ├─ for-parents/page.tsx           /for-parents
│  ├─ for-educators/page.tsx         /for-educators    (waitlist, no accounts)
│  ├─ privacy/page.tsx               /privacy          (adult + child-friendly versions)
│  └─ terms/page.tsx                 /terms
├─ (auth)/
│  ├─ sign-in/page.tsx               /sign-in
│  ├─ sign-up/page.tsx               /sign-up
│  ├─ verify/page.tsx                /verify-email
│  └─ reset/page.tsx                 /reset-password
├─ onboarding/
│  ├─ adult/page.tsx                 /onboarding/adult       name, role, country, PIN
│  ├─ consent/page.tsx               /onboarding/consent     parental notice + consent
│  └─ child/page.tsx                 /onboarding/child       create child profile
├─ profiles/page.tsx                 /profiles               "Who's learning?" picker
├─ play/                             (Child Mode only)
│  ├─ page.tsx                       /play                   child dashboard
│  ├─ academy/page.tsx               /play/academy
│  ├─ academy/[module]/page.tsx      /play/academy/[module]
│  ├─ academy/[module]/[lesson]/page.tsx   lesson player
│  ├─ academy/[module]/quiz/page.tsx       module quiz
│  ├─ ideas/page.tsx                 /play/ideas             Idea Lab list
│  ├─ ideas/new/page.tsx             /play/ideas/new         wizard
│  ├─ ideas/[projectId]/page.tsx
│  ├─ simulator/page.tsx             /play/simulator         pick scenario / project
│  ├─ simulator/[sessionId]/page.tsx game rounds
│  ├─ pitch/page.tsx                 /play/pitch             decks list
│  ├─ pitch/[deckId]/page.tsx        editor
│  ├─ pitch/[deckId]/present/page.tsx
│  ├─ investor-room/[deckId]/page.tsx  choose persona + Q&A + results
│  └─ passport/page.tsx              /play/passport
├─ parent/                           (adult only, unlock required if child mode active)
│  ├─ page.tsx                       /parent                 overview of all children
│  ├─ children/[childId]/page.tsx    progress, projects, decks (read-only view)
│  ├─ children/[childId]/privacy/page.tsx   export, delete, credential opt-in
│  ├─ consent/page.tsx               view / withdraw consent
│  └─ settings/page.tsx              account, PIN, delete account
├─ verify/[code]/page.tsx            public credential verification (no PII)
└─ api/
   ├─ child-mode/route.ts            enter/exit Child Mode
   ├─ credentials/issue/route.ts     server-only issuer (Phase 7)
   └─ export/[childId]/route.ts      JSON export
```

### 4.2 Navigation
- **Child Mode:** bottom tab bar on tablet/phone, left rail on desktop: *Home · Academy · Idea Lab · Simulator · Pitch · Passport*. Investor Room is entered from a deck. A lock-icon "Grown-ups" button leads to the PIN prompt.
- **Parent area:** top nav: *Overview · Children · Consent & Privacy · Settings*, plus "Start learning as…" button.

### 4.3 Code organisation
```
src/
├─ app/                 routes (above)
├─ components/ui/       shadcn primitives (themed)
├─ components/          feature components
├─ content/             modules, lessons, quizzes, scenarios, personas, achievements (typed)
├─ engines/             quiz.ts, simulator.ts, investor.ts, achievements.ts (pure, tested)
├─ lib/supabase/        server/client helpers
├─ lib/auth/            child-mode cookie signing, guards
├─ lib/safety/          text nudges (PII patterns, wordlist)
└─ lib/credentials/     (Phase 7) EAS encode / issue / verify
supabase/
├─ migrations/          (Phase 1+)
└─ seed/                content seed generated from src/content
```

---

## 5. Web3 / credential architecture

### 5.1 Requirements recap
- Children never hold wallets, buy crypto, or sign transactions.
- Credentials should be independently verifiable.
- No personal data publicly on-chain.
- Minimal gas and complexity.

### 5.2 Options evaluated

| Option | How | Pros | Cons | Verdict |
|---|---|---|---|---|
| **A. NFT (ERC-721/1155)** | Mint a token per achievement to a wallet | Familiar "collectible" | Needs a recipient wallet; transferable/tradable (marketplace exposure); "collecting" framing is wrong for children; custom contract | ❌ Reject |
| **B. Soulbound token (ERC-5192 etc.)** | Non-transferable NFT | Non-transferable | Still needs a wallet per child; custom contract + audit; revocation awkward | ❌ Reject for MVP |
| **C. EAS on-chain attestation** | Issuer calls `attest()` on Base's predeployed EAS with a registered schema | No custom contract; built-in revocation; public explorer (base.easscan.org); recipient can be zero address | Each attestation costs a small amount of gas; data is permanent → must contain no PII | ✅ **Recommended** |
| **D. EAS off-chain attestation** | Issuer signs EIP-712 attestation; we store it; optionally anchor a hash on-chain | Zero gas; same verification tooling | Verifier must trust our hosting of the signed object | ✅ Fallback / complement |
| **E. W3C VC 2.0 / Open Badges 3.0** | Signed JSON-LD credential, no chain | Education-sector standard; portable | More spec surface (DIDs, proof suites); verifier ecosystem less familiar to hackathon judges | ⏩ Defer; design schema so it can map to OB 3.0 later |

[Fact] EAS is predeployed on Base (and across the OP Stack Superchain) at `0x4200000000000000000000000000000000000021` (EAS) and `0x4200000000000000000000000000000000000020` (SchemaRegistry). *Verify against the official EAS deployment list before use.*

[Fact] Open Badges 3.0 (1EdTech) aligns with the W3C Verifiable Credentials Data Model v2.0, which became a W3C Recommendation in 2025.

### 5.3 Recommended MVP design

1. **Adult-managed issuer.** One LITTLE FOUNDERS issuer account (EOA) whose key lives server-side. It pays its own gas. Because the issuer is the only on-chain actor, **no paymaster, smart wallet, or account abstraction is needed.** [Recommendation]
   - [Fact] CDP Paymaster sponsorship applies to ERC-4337 smart accounts, not traditional EOAs — so it is irrelevant unless end users later get smart wallets.
2. **Certificates only, not every badge.** Attest only meaningful milestones (e.g. *Founder Academy Graduate*, *Pitch Ready*) — roughly 1–3 per child, and only after **adult opt-in**. Badges stay off-chain in Postgres.
3. **Schema (no PII):**
   ```
   bytes32 credentialType     // keccak256("LF_ACADEMY_GRADUATE_V1")
   bytes32 subjectCommitment  // keccak256(credentialId || serverSecretSalt)
   uint64  issuedAt
   uint16  contentVersion
   ```
   - `recipient` = `0x000…000` (no child address) **or** a parent-supplied address if the parent explicitly wants one (deferred).
   - `revocable = true`.
   - Child name, nickname, age, country, school, project content — **never on-chain**.
4. **Verification.** Certificate shows a URL/QR `/verify/<code>`. The server looks up the attestation UID, reads it from Base, and shows: credential type, issue date, issuer, status (valid/revoked) and an explorer link. The child's name appears only on the printable PDF the parent holds, never on the public page.
5. **Erasure compatibility.** On deletion request: revoke the attestation, delete the salt & mapping row. The on-chain record then remains but is an unlinkable hash of random data. (*Whether this satisfies erasure obligations is flagged for legal review.*)
6. **Network.** Base **Sepolia** for the hackathon demo; Base mainnet after approval (decision D3). Mainnet costs are expected to be fractions of a cent per attestation [Assumption — measure on Sepolia/mainnet before committing].
7. **Async issuance.** Issuance runs as a server job with a status (`pending → submitted → confirmed | failed`) so the UI never blocks on the chain; retries are idempotent via the `credential_issuances` row.

### 5.3.1 As implemented (Phase 7)
Built as recommended, with two deliberate refinements (full spec in `docs/CREDENTIALS.md`):
- The commitment is **SHA-256(credential hash ‖ salt)**, not keccak256, so the database can recompute and check it during verification without exporting the salt. The credential hash is SHA-256 over canonical JSON (`LF-CANON-1`).
- The schema is `bytes32 credentialType,bytes32 credentialProof,uint16 formatVersion`. `issuedAt` is dropped because the attestation already carries the block time; less data on-chain.
- Verified addresses on Base Sepolia (84532): EAS `0x4200…0021`, SchemaRegistry `0x4200…0020` (official `eas-contracts` deployment records plus on-chain reads). viem 2.57.7 only; no EAS SDK and no wallet libraries.
- The issuer key is server-only (`CREDENTIAL_ISSUER_PRIVATE_KEY`, kill switch `CREDENTIAL_ANCHORING_ENABLED`). The worker uses the service role for two service-role-only functions. Transactions are signed locally and stored before broadcast, so retries can't duplicate them. Success is only recorded after the attestation is read back on-chain.
- Status 2026-11-06: offchain credentials and verification are live. On-chain anchoring is implemented and tested up to read-only/simulated chain calls; it is waiting for a funded testnet issuer key and schema registration.

### 5.4 Parent-controlled wallets (future)
If parents later want credentials in their own wallet: parent connects/creates a Base Account (smart wallet) in the Parent area only; issuer attests with `recipient = parentAddress` and the child is represented only by the commitment. A paymaster is still unnecessary because the issuer pays. Defer.

### 5.5 Security of the issuer key
- Separate testnet and mainnet keys; mainnet key in Vercel encrypted env var, least privilege (holds only a small gas float).
- Issuer route callable only by server code after verifying the certificate exists, the adult opted in, and the row is `pending`.
- Rate limit per adult; daily global cap; alert on balance drop.
- Post-MVP: move to a managed signer (KMS / CDP Server Wallet).

### 5.6 What if Base integration slips?
The Passport, certificates, and `/verify` page work fully off-chain (signed by our server, stored in Postgres). On-chain anchoring is an additive layer. This keeps the demo safe if RPC/testnet issues arise.

---

## 6. Deterministic engines

| Engine | Inputs | Output | Notes |
|---|---|---|---|
| `quiz` | question set, answers | score, per-question feedback key | Server re-scores before recording a pass (answer keys not trusted from client). |
| `simulator` | scenario, seed, round decisions | per-round state, events, feedback keys | Seeded PRNG (e.g. mulberry32); pure; full replay from decisions for verification. |
| `investor` | deck sections, selected answers, simulator summary, persona | total score, sub-scores, band, tips | Rubric weights per persona in content files. |
| `achievements` | domain events (lesson_completed, quiz_passed, …) | newly earned achievement keys | Idempotent; runs server-side after each write. |

All engines get exhaustive unit tests (Vitest) including boundary cases (negative profit, zero sales, budget exhausted).

---

## 7. Observability & operations
- Error tracking: Vercel logs for MVP; Sentry later with **PII scrubbing** and no session replay in Child Mode.
- **No third-party analytics or advertising SDKs** in Child Mode. If analytics are needed, first-party aggregate counts only.
- Backups: Supabase daily backups (plan-dependent) — confirm retention aligns with deletion policy.

## 8. Environments
| Env | Supabase | Chain | Notes |
|---|---|---|---|
| local | Supabase CLI local stack | Base Sepolia / none | seed content |
| preview (Vercel PRs) | shared dev project | Base Sepolia | no real child data |
| production | prod project (region per D7) | Base Sepolia → mainnet (D3) | real data only after legal sign-off |

**Real-data gate.** Phase 2 adds a server-only env flag (e.g. `REAL_CHILD_DATA_ENABLED=false` by default). While false, child-profile creation in production is limited to clearly marked fictional demo profiles. The flag is flipped only after the professional privacy/legal review is complete.

**Package manager:** npm (pnpm is not installed in the solo builder's environment).
