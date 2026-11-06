# LITTLE FOUNDERS

**An entrepreneurship learning platform for children aged 10–13, with parents in charge.**

Children learn how businesses start by doing it: they spot a problem, shape an idea, run a pretend business, build a pitch and practise answering friendly (pretend) investors. Everything they achieve is collected in a **Founder Passport**. Big milestones become **verifiable credentials** that a parent can optionally back with an anonymous proof on **Base Sepolia**, without the child ever touching a wallet, token or blockchain.

**Live demo:** https://littlefounder.vercel.app

---

## Contents

1. [What judges should look at](#1-what-judges-should-look-at)
2. [Try it: a 15-minute walkthrough](#2-try-it-a-15-minute-walkthrough)
3. [Features](#3-features)
4. [Child safety and privacy by design](#4-child-safety-and-privacy-by-design)
5. [Credentials and Base (EAS)](#5-credentials-and-base-eas)
6. [Architecture](#6-architecture)
7. [Security and testing](#7-security-and-testing)
8. [Run it locally](#8-run-it-locally)
9. [Deploy to Vercel](#9-deploy-to-vercel)
10. [Project layout and documentation](#10-project-layout-and-documentation)
11. [Limitations and what's next](#11-limitations-and-whats-next)

---

## 1. What judges should look at

| | |
|---|---|
| **Learning journey** | Six Founder Academy modules → Idea Lab → Startup Simulator → Pitch Studio → Investor Room, all connected. An idea you create is used in the simulator and prefills your pitch. |
| **Parents in charge** | Only adults have accounts. Children use **Child Mode** on the parent's device, and leaving it needs the parent's PIN. Parents see everything in a read-only dashboard. |
| **No AI, no real money** | All feedback and scoring is deterministic and rule-based. The simulator uses clearly labelled pretend **Founder Bucks**. Investors are made-up characters giving *practice feedback*. |
| **Base, behind the scenes** | Credentials are issued and verifiable offchain. A parent may opt in to an anonymous EAS attestation on Base Sepolia, signed by a server-held platform key. Children never see blockchain terms. |
| **Safety enforced in the database** | Row-Level Security on every table, server-only scoring, immutable results, family and sibling isolation, and a database gate that blocks real child data until legal review. |

## 2. Try it: a 15-minute walkthrough

**Parent setup (30 seconds): use the demo button**
1. Open https://littlefounder.vercel.app/sign-up and press **Try the demo**.
2. You're signed straight in as a fictional demo parent with one demo child. No email is needed.
   - **Your parent PIN is `2580`.** You'll need it to leave Child Mode.
   - Each judge gets a fresh, separate demo account, deleted automatically after 48 hours.
3. *(Optional)* To try the full parent onboarding instead, sign up with your email. It needs an email confirmation, then walks you through consent, choosing a PIN and adding a child (nickname, age band and avatar only).

**Child Mode (10 min)**

4. On the Parent Dashboard, click **Start Child Mode**. You're now in *Founder HQ*, and there are no parent links anywhere.
5. **Founder Academy:** complete a lesson. Each has a short read, an interactive challenge (scored on the server) and a takeaway. Finish a module's quiz to earn a badge.
6. **Idea Lab:** build an idea in six guided steps: problem → solution → customers → name → one-sentence pitch → review.
7. **Startup Simulator:** run *EcoBottle* (or your own idea). Choose a price, a quantity and marketing within 1,000 pretend Founder Bucks, then see revenue, costs, profit or loss, and what to try next.
8. **Pitch Studio:** start a pitch from your idea (it's prefilled), complete the five sections and finish it. Open **Present my pitch** for a six-slide deck (arrow keys work).
9. **Investor Room:** choose a pretend investor (e.g. *Penny the Planner*) and answer five questions. For each, pick an answer and optionally add your own words. You get instant practice feedback and a rubric breakdown.
   - Score **70 or more** to earn the **Pitch Ready Learning Milestone** credential.
10. **Founder Passport:** see your badges, progress and **My certificates**. Click **Check it's real** on an earned certificate to open its public verification page.

**Back to the parent (3 min)**

11. Click **Grown-ups**, then enter the PIN (`2580` for demo accounts).
12. **Parent Dashboard → View activity:** a read-only view of lessons, quizzes, ideas, simulations, pitches and practice results.
13. **Credentials:** read the plain-language explanation of public proofs, and optionally turn them on for this child (three confirmations and your typed name). Click **Check progress** to see the proof sent and verified on Base Sepolia. Then **turn it off** to see that withdrawing stops new proofs while existing credentials stay valid.

## 3. Features

| Area | What it does |
|---|---|
| **Parent accounts and consent** | Email and password sign-in for adults only, recorded parental consent, up to 8 child profiles, and removal with a 30-day grace period followed by automatic permanent deletion. |
| **One-click demo accounts** | **Try the demo** creates a fresh, already-confirmed fictional parent with a demo child and signs you in. It's rate-limited (3 per visitor per hour, 200 per day), recorded server-side, deleted automatically after 48 hours, and switched on per deployment. |
| **Child Mode** | Child profiles have no login of their own. Child Mode is stored in the database, not a cookie. Exiting needs the parent PIN, which locks for 15 minutes after 5 wrong attempts. A forgotten PIN is reset with a fresh password sign-in. |
| **Founder Academy** | 6 modules, 18 lessons, 18 interactive challenges and 30 quiz questions. Lessons unlock in order. Answer keys never reach the browser. |
| **Founder Passport** | 15 badges, module stamps, progress statistics and certificates. Badges are awarded once, by the server, from stored progress. |
| **Idea Lab** | A guided six-step idea builder with preset choices, drafts and resume, and gentle privacy nudges. |
| **Startup Simulator** | A deterministic one-season business with fixed options and formulas, a budget check, attempt comparison and reflections. Completed attempts are immutable. Rules: [`docs/STARTUP_SIMULATOR.md`](docs/STARTUP_SIMULATOR.md). |
| **Pitch Studio** | A five-part guided pitch prefilled from the idea, a six-slide deck with a present mode, and **versions**: finishing again keeps earlier versions and their feedback. |
| **Investor Room** | 4 pretend investor personalities × 5 questions (one per rubric criterion). Fixed scores with an own-words bonus give a /100 practice score with strengths and tips. It never makes investment decisions. Rules: [`docs/PITCH_STUDIO.md`](docs/PITCH_STUDIO.md). |
| **Parent Dashboard** | A read-only view of all of the above, per child. Parents only ever see their own family. |
| **Credentials** | Two learning milestones (Founder Academy, Pitch Ready), each hashed and salted. They have a public verification page and an optional Base Sepolia proof. See [§5](#5-credentials-and-base-eas). |

## 4. Child safety and privacy by design

- **No real child data yet.** `app_settings.real_child_data_enabled = false` is enforced in the database. Only fictional demo profiles can be created until a professional privacy and legal review is done.
- **Minimal data.** We store a nickname, age band and preset avatar: no photos, birth dates, schools or contact details. Pitch text that looks like an email, phone number, address, link or social handle is **refused**.
- **Nothing public about children.** There are no profiles, search, leaderboards, sharing or messaging. The only public page is `/verify/<code>`, which shows the credential type and date, never the child.
- **Parent-only controls are enforced by the database too.** Child Mode runs on the parent's session, so the database refuses consent, profile, account and credential-setting writes while Child Mode is on. Password changes need a fresh reset email link and are blocked in Child Mode.
- **Results can't be faked.** Quizzes, challenges, simulations, investor practice, badges and credentials are scored and written only by server-side database functions. Clients can't write those tables.
- **No AI and no real money.** There are no external AI APIs, no payments, no tokens and no child wallets.

Full detail: [`docs/CHILD_SAFETY_AND_PRIVACY.md`](docs/CHILD_SAFETY_AND_PRIVACY.md).

## 5. Credentials and Base (EAS)

**Offchain first.** A credential is issued only from stored, server-verified progress:
- **Founder Academy Learning Milestone:** all six modules complete.
- **Pitch Ready Learning Milestone:** an Investor Room practice score of at least 70.

Each credential is a canonical JSON document with a **SHA-256 hash** and a **32-byte secret salt**. The salt never leaves the database. Each child holds each credential at most once, and issued credentials can't be edited. The `/verify/<code>` page recomputes the hash to prove the record hasn't changed. All of this works with no blockchain at all.

**Optional public proof (parent opt-in, per child, off by default).** If a parent turns it on, the server records an **EAS attestation on Base Sepolia** containing only:

| Field | Value |
|---|---|
| `credentialType` | `keccak256("little-founders:credential:<type>:v1")`, a public constant |
| `credentialProof` | `SHA-256(credential hash ‖ secret salt)`, which is unlinkable without our private records |
| `formatVersion` | `1` |
| recipient | `0x000…000` (no wallet for anyone) |

No names, ids, ages, answers or pitch content ever go on chain. A platform issuer key held only on the server signs the transaction and pays the (tiny) testnet gas. The worker stores the signed transaction before broadcasting, so a retry can't create a duplicate. A proof is marked anchored only after the attestation has been read back and checked on chain. Withdrawing consent stops new proofs and can't erase recorded ones, as the parent is told up front.

**Verified configuration (Base Sepolia, chain 84532)**

| | |
|---|---|
| EAS | `0x4200000000000000000000000000000000000021` (on-chain `version()` = `1.4.1-beta.3`) |
| SchemaRegistry | `0x4200000000000000000000000000000000000020` |
| Schema | `bytes32 credentialType,bytes32 credentialProof,uint16 formatVersion` (no resolver, revocable) |
| Schema UID | `0xc192be4ef3b5edd2f706f274676b137b8701659ec8d1903c244699e471ad5da2` |
| Schema registration | [`0xacfce3b6…09f163`](https://sepolia.basescan.org/tx/0xacfce3b680ae90610eb3a4a8b0a0116cb14726173bb954d3486676a0bb09f163), block 55386939, confirmed and read back on chain |
| Issuer (platform) | [`0xF474E304a7F9EF7949255590D4E5d23EfB4Dec3E`](https://sepolia.basescan.org/address/0xF474E304a7F9EF7949255590D4E5d23EfB4Dec3E) |

The addresses were checked against the official `@ethereum-attestation-service/eas-contracts` deployment records and with live on-chain calls. Run `npm run credentials -- check` to repeat the checks yourself.

Full specification: [`docs/CREDENTIALS.md`](docs/CREDENTIALS.md).

## 6. Architecture

```
Browser (parent or child on the parent's device)
   │  Next.js 16 App Router: server components + server actions (validated with zod)
   ▼
Next.js on Vercel ──────────────────────────────┐
   │  publishable key + parent session            │ server-only: issuer key, service role
   ▼                                              ▼
Supabase Postgres                           Base Sepolia (EAS)
 • Row-Level Security on every table         • attest() anonymous proofs
 • SECURITY DEFINER functions do all scoring • read back to verify
 • immutable results, versions, credentials
 • pg_cron hourly purge of removed profiles
```

**Stack:** Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS v4 · Supabase (Auth, Postgres, RLS, pg_cron) · viem 2 (Base Sepolia / EAS) · zod · Vercel. No AI SDKs and no wallet libraries.

**Key design choices**

- **The active child comes from the server.** Child Mode is a column in the database. Every child action derives the child from the signed-in parent's Child Mode, never from an id sent by the browser.
- **Scoring lives in the database.** Database functions validate every input against predefined options and calculate deterministically. The app can't award itself points.
- **History is immutable.** Simulator results, finished pitch versions, practice results, badges and credentials can't be changed after the fact, even by the server.

Detail: [`docs/TECHNICAL_ARCHITECTURE.md`](docs/TECHNICAL_ARCHITECTURE.md) · [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md).

## 7. Security and testing

| Check | Result (latest run) |
|---|---|
| `npm run lint` / `npm run typecheck` / `npm run build` | Pass |
| `npm run db:check`: all migrations + seed on an in-memory Postgres, with 372 security, calculation, scoring, credential and demo-account checks | **372 / 372 pass** |
| `npm run db:check:remote`: 145 checks against the real hosted Supabase (Auth, RLS, isolation, scoring, credentials, Child Mode hardening, demo accounts), using throwaway fictional accounts that are deleted afterwards | **145 / 145 pass** |
| `npm run test:e2e`: full browser journey (sign-up → Child Mode → every feature → credentials → family isolation → mobile layout) | Included; run it against a local production build |
| Secrets scan of the browser bundles | No service key, issuer key or signing code in client JavaScript |

The final hardening review fixed two issues:
- Child Mode could reach the password-reset page; it is now blocked, and resets need a fresh email link.
- Parent-only database writes were possible from Child Mode through the API; they are now refused by the database.

It also added clickjacking, MIME-sniffing and referrer protection headers.

## 8. Run it locally

**Requirements:** Node.js 20+ (tested on 24), npm, and a Supabase project.

```bash
git clone https://github.com/sniperchief/LittleFounder.git
cd LittleFounder
npm install
cp .env.example .env.local     # then fill in the values below
npm run db:push                # applies all migrations + the content seed to your Supabase project
npm run dev                    # http://localhost:3000
```

**Environment variables** (`.env.local`; see [`.env.example`](.env.example))

| Variable | Needed for | Public? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | the app | yes (protected by RLS) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the app | yes (protected by RLS) |
| `NEXT_PUBLIC_SITE_URL` | auth email links (e.g. `http://localhost:3000`) | yes |
| `REAL_CHILD_DATA_ENABLED` | keep `false` | — |
| `SUPABASE_SECRET_KEY` | the test scripts and the anchoring worker | **no, server only** |
| `SUPABASE_DB_URL` | `npm run db:push` only (session pooler URL) | **no, never deployed** |
| `CREDENTIAL_ANCHORING_ENABLED` | `true` to allow Base Sepolia proofs (default off) | no |
| `CREDENTIAL_ISSUER_PRIVATE_KEY` | Base Sepolia issuer key (`npm run credentials -- new-key` creates one) | **no, server only** |
| `BASE_SEPOLIA_RPC_URL` | optional dedicated RPC (defaults to `https://sepolia.base.org`) | no |
| `DEMO_ACCOUNTS_ENABLED` | `true` shows the **Try the demo** button (needs `SUPABASE_SECRET_KEY`; rebuild after changing) | no |

**Supabase dashboard setup**
1. **Authentication → URL Configuration:** set the Site URL, and add `http://localhost:3000/**` and your deployed URL with `/**` to Redirect URLs.
2. **Integrations → Cron:** confirm `lf-purge-deleted-children` and `lf-purge-demo-accounts` run hourly (the migrations schedule both).
3. **Email:** the built-in email service is for testing only. Configure custom SMTP before inviting real parents.

**Turning on Base Sepolia proofs** (optional):

```bash
npm run credentials -- new-key           # creates a testnet issuer key in .env.local, prints only the address
# fund that address with a little Base Sepolia test ETH (faucets: docs.base.org → Get Funds)
npm run credentials -- check             # network, contracts, schema, issuer balance
npm run credentials -- register-schema   # one-off (already done for the issuer above)
npm run credentials -- anchor            # processes queued proofs (also runs from the parent page)
```

**All scripts**

| Script | What it does |
|---|---|
| `npm run dev` / `npm run build` / `npm start` | Develop / production build / serve |
| `npm run lint` / `npm run typecheck` | ESLint / route types + `tsc --noEmit` |
| `npm run db:push` | Apply migrations and the idempotent content seed to Supabase |
| `npm run db:check` | Local database security and logic checks (PGlite, no Docker needed) |
| `npm run db:check:remote` | The same rules checked against the real hosted project |
| `npm run content:seed` | Regenerate `supabase/seed.sql` after editing lessons, quizzes or investor questions |
| `npm run credentials -- <check\|new-key\|register-schema\|anchor>` | Base Sepolia credential operations |
| `npm run test:e2e` | Browser end-to-end test (needs `npm run build && npm start` and Edge or Chrome) |

## 9. Deploy to Vercel

1. Import the GitHub repository into Vercel (framework: Next.js; defaults are fine).
2. Add the environment variables:
   - **Always:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` (e.g. `https://littlefounder.vercel.app`) and `REAL_CHILD_DATA_ENABLED=false`.
   - **For the demo button:** `DEMO_ACCOUNTS_ENABLED=true` plus `SUPABASE_SECRET_KEY` (marked **Sensitive**). Remove the flag and redeploy to switch the button off after judging.
   - **For Base Sepolia proofs:** `CREDENTIAL_ANCHORING_ENABLED=true`, plus `CREDENTIAL_ISSUER_PRIVATE_KEY` and `SUPABASE_SECRET_KEY`, both marked **Sensitive**.
   - **Never** set `SUPABASE_DB_URL` in Vercel, and never put a secret behind a `NEXT_PUBLIC_` prefix.
3. Add the Vercel URL to Supabase's Site URL and Redirect URLs (see §8).
4. Deploy. Redeploy whenever you change variables.

## 10. Project layout and documentation

```
src/app/(marketing)/      Public pages: landing, get started, privacy, /verify/[code]
src/app/(auth)/           Sign in / sign up / password reset
src/app/(account)/        Onboarding, profile picker, Parent Dashboard, settings, credentials
src/app/play/             Child Mode: Academy, Passport, Idea Lab, Simulator, Pitch Studio, Investor Room
src/content/              Curriculum, simulator model, pitch content, investor question bank
src/lib/                  Auth guards, data access, credentials (canonical hash, EAS), validation
supabase/migrations/      12 SQL migrations (schema, RLS, scoring functions, credentials, demo accounts)
supabase/seed.sql         Generated content seed (no personal data)
scripts/                  DB checks (local + hosted), seed generator, deploy, credentials CLI
tests/e2e/                Browser end-to-end test
docs/                     Specifications (below)
```

| Document | About |
|---|---|
| [`PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) | Users, features and decisions |
| [`TECHNICAL_ARCHITECTURE.md`](docs/TECHNICAL_ARCHITECTURE.md) | Stack, auth model, Web3 design |
| [`DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) | Every table, policy and function by phase |
| [`CHILD_SAFETY_AND_PRIVACY.md`](docs/CHILD_SAFETY_AND_PRIVACY.md) | Consent, data minimisation, retention, on-chain rules |
| [`STARTUP_SIMULATOR.md`](docs/STARTUP_SIMULATOR.md) | Simulator formulas and worked examples |
| [`PITCH_STUDIO.md`](docs/PITCH_STUDIO.md) | Pitch structure, investor personas, questions and rubric |
| [`CREDENTIALS.md`](docs/CREDENTIALS.md) | Credential format, hashing, consent, anchoring and verification |
| [`DEVELOPMENT_ROADMAP.md`](docs/DEVELOPMENT_ROADMAP.md) · [`PHASE_0_REPORT.md`](docs/PHASE_0_REPORT.md) | Plan and research |

## 11. Limitations and what's next

- **Testnet only.** Proofs are on Base Sepolia. Mainnet needs a legal review of permanent records about minors, a managed signer (KMS / CDP Server Wallet), balance alerts and a scheduled anchoring job.
- **Real child data stays off** until a professional privacy and legal review (age-verification and consent requirements).
- **Not built yet:** consent-withdrawal UI with account deletion, data export, revoking on-chain attestations when a child is deleted (today the proof becomes unlinkable but isn't revoked), educator accounts, and uploads.
- **Email:** production needs a custom SMTP provider.

**Out of scope by design:** child wallets, tokens or crypto rewards, real fundraising or investment, AI-generated content, and public child profiles.
