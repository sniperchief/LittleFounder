# LITTLE FOUNDERS — Child Safety & Privacy Architecture

Status: Phase 0 draft, for approval · Date: 2026-11-05
Legend: **[Fact]** cited · **[Assumption]** · **[Recommendation]** · **⚖️ Legal review needed**

> **This document is an engineering design, not legal advice.** Items marked ⚖️ must be reviewed by a qualified data-protection professional (ideally Nigerian-qualified, plus any other target jurisdiction) before real children's data is collected in production.

---

## 1. Safety principles

1. **Data minimisation** — collect only what a feature strictly needs; prefer bands/presets to free data.
2. **Adult in control** — every child profile is created, consented to, supervised, exported and deleted by an adult.
3. **Private by default and by design** — no public surfaces showing child content.
4. **No contact** — no feature lets a child contact, or be contacted by, anyone.
5. **No dark patterns** — no streak pressure, loot boxes, paid unlocks, ads, or manipulative notifications.
6. **Immutable systems hold nothing personal** — the blockchain only ever receives non-personal, salted commitments.

---

## 2. Legal landscape (summary)

LITTLE FOUNDERS is a global product. The regimes below were researched as representative examples (Nigeria and the US in detail); they are not an exhaustive list of applicable law. ⚖️

### 2.1 Nigeria — NDPA 2023 + GAID 2025
- [Fact] The Nigeria Data Protection Act 2023 defines a child by reference to the Child's Rights Act — **any person under 18**. All our users 10–13 are therefore children under the NDPA.
- [Fact] **Section 31(1)**: where the data subject is a child, consent must be given by a **parent or legal guardian**.
- [Fact] **Sections 31(2)–(3)**: controllers must apply appropriate mechanisms to **verify age and the consent**, considering available technology.
- [Fact] **Section 31(5)** empowers the NDPC to make regulations for children aged 13 and above who directly access online services — so 13-year-olds may in future be treated differently. ⚖️
- [Fact] The NDPC issued the **GAID 2025** (issued 20 March 2025; reported effective 19 September 2025), which commentators report reinforces express parental consent, age verification and child-friendly privacy notices.
- Other NDPA duties likely relevant (from the Act's structure; ⚖️ confirm applicability and thresholds): lawful basis & consent records; data subject rights (access, rectification, erasure, portability, withdrawal of consent); security safeguards; breach notification to NDPC (72 hours); cross-border transfer conditions (Part VIII); **registration as a data controller/processor of major importance** depending on volume/sector; DPIA for high-risk processing (children's data at scale likely qualifies); appointment of a DPO.

> We only read secondary summaries (law-firm / Big-4 commentary) of the NDPA and GAID during Phase 0. ⚖️ **The primary texts from the NDPC must be checked** before production.

### 2.2 United States — COPPA (if US children can sign up)
- [Fact] COPPA applies to children **under 13**. The FTC's amended COPPA Rule took effect **23 June 2025**, with a compliance deadline of **22 April 2026** (now passed).
- [Fact] The amended rule requires a **written data retention policy** (disclosed in the privacy notice) and deletion of children's data when no longer reasonably necessary; indefinite retention is prohibited.
- COPPA requires *verifiable* parental consent (VPC) using an FTC-recognised method. Our MVP method (email-verified adult + affirmation) is **likely not sufficient VPC** for the US except under narrow exceptions. ⚖️

### 2.3 UK / EU (if applicable)
UK GDPR + Age Appropriate Design Code; EU GDPR Art. 8 (age of digital consent 13–16 by member state). Only relevant if we target these markets. ⚖️

### 2.4 Confirmed position (Phase 1 kickoff, 2026-11-05)
- **Scope is global.** Because families anywhere may sign up, we design to the **strictest common overlap** of the regimes above: verified parental consent, data minimisation, written retention policy, no behavioural advertising, no third-party trackers in Child Mode, child-friendly notices, easy deletion. NDPA, COPPA, UK GDPR/AADC and EU GDPR are all in scope for review. ⚖️
- **Real child data collection is gated** pending professional privacy and legal review. Until sign-off, production must not accept real child profiles (enforced in Phase 2 by a server-side feature flag; see `TECHNICAL_ARCHITECTURE.md` §8).
- **Demo profiles use fictional data only.**
- A global launch may still require per-country gating if counsel advises it (e.g. stronger VPC for US users) — this is an open question, not a decision.

---

## 3. Accounts and roles

| Role | Can do | Cannot do |
|---|---|---|
| Parent/guardian | Create/edit/delete child profiles; give/withdraw consent; view all child content; export; opt in to verifiable credentials | View any other family's data |
| Child (in Child Mode) | Use learning features for *their* profile | Access parent area, other profiles, settings, consent, deletion, credential opt-in |
| Educator (deferred) | Will need separate consent model (school as controller, or parent consent per child) ⚖️ | — |
| LITTLE FOUNDERS staff | Support access via audited admin tooling only (post-MVP) | Casual DB browsing of child data |

Authentication: Supabase Auth, adults only, verified email, password ≥ 10 chars (or magic link), rate-limited sign-in, optional TOTP MFA for adults post-MVP. Adult **unlock PIN** (4–6 digits, hashed, attempt-limited) separates child and parent areas on shared devices.

---

## 4. Consent & age-appropriate onboarding

### 4.1 Adult consent flow
1. Adult signs up, verifies email.
2. Adult declares they are 18+ and the parent/legal guardian (checkbox, not pre-ticked).
3. **Parental privacy notice** (short layered summary + full notice): what we collect, why, how long, who processes it (Supabase, Vercel), where it's stored, rights, contact.
4. Affirmative consent for **core processing** + typed full name as signature → `consent_records` row with `notice_version`.
5. **Separate, optional** consent for **verifiable credential (on-chain)**, offered only when a certificate is earned, with plain explanation that a non-personal record is permanent on a public network. *Implemented, Phase 7:* per child, off by default, parent-only (refused in Child Mode at the database level), three plain-language confirmations plus a typed name, recorded in `consent_records` (`onchain_credential`) with a timestamp. Withdrawal stops new proofs and can't erase recorded ones. See `docs/CREDENTIALS.md` §3.
6. Consent withdrawal available at any time from Parent Settings; withdrawal of core consent triggers the deletion flow. **Not yet built — requirements in §9.2.**

> MVP consent verification = email-verified adult account + attestation of guardianship. ⚖️ **Whether this meets NDPA s.31 "appropriate mechanisms to verify" and GAID age-verification expectations is the #1 compliance question.** Stronger options for later: small card-authorisation check, government-ID check via provider, school-mediated consent, or a signed consent form.

### 4.2 Child onboarding (in Child Mode)
- Friendly welcome: "This is *your* founder space. Only your grown-up can see your work."
- **Child-friendly privacy explainer** (3 cards, ~age 9 reading level): what we keep, why, "never type your full name, address, school or phone".
- Choose avatar from presets; nickname already set by adult.
- No age-gate questions to the child (the adult supplies the age band).

---

## 5. Child profile data minimisation

| Collected | Why | Not collected |
|---|---|---|
| Nickname | Personalisation | Legal name |
| Age band (10–11, 12–13) | Content difficulty & legal basis | Date of birth |
| Preset avatar key | Fun identity | Photos, voice, video |
| Locale | Language | Location / GPS / school |
| Learning activity & creations | Core service | Device IDs for tracking, advertising IDs |

---

## 6. Private-by-default projects & no public discovery

- All projects, decks, simulator sessions and investor feedback are visible only to the guardian (enforced by RLS, see `DATABASE_SCHEMA.md` §11).
- `visibility` column fixed to `private` by CHECK constraint in MVP.
- **No** public profile pages, user search, leaderboards, galleries, likes, follows, comments, chat, or share-to-social buttons.
- The only public route showing anything about a child is `/verify/[code]`, which exposes **no personal data** (credential type, date, issuer, status) and uses an unguessable code; it is `noindex`.
- Investor personas are scripted characters, not people; there is no live human interaction.
- Printing/exporting a deck is done by the adult or on the adult's device — sharing is a family decision outside the platform.

### Child Mode hardening (Phase 7)
Child Mode runs under the parent's session on the child's device, so the database also refuses parent-only writes while Child Mode is active (consent, profile create/rename/remove, account details, credential anchoring). Setting a new password needs a fresh password-reset link (`amr` = `otp`/`recovery` within 15 minutes) and is refused in Child Mode, so a child can't take over the parent account from `/reset-password`. Baseline headers: no framing (`X-Frame-Options: DENY`, `frame-ancestors 'none'`), `nosniff`, a strict referrer policy (`no-referrer` on `/verify`) and a restrictive `Permissions-Policy`.

### Free-text safeguards
Children type in Idea Lab, decks and investor notes. Even though content is private, children may accidentally disclose personal info. MVP safeguards [Recommendation]:
- Length limits on all fields.
- Client + server **PII pattern nudges** (phone numbers, emails, street-address patterns, "my school is…") with gentle prompts; not blocking.
  - *Implemented, Phase 6:* Pitch Studio and Investor Room typed answers go further: text that looks like an email, phone number, link/domain, street address or social handle is **refused** by the server action and the database, after a nudge in the builder (`docs/PITCH_STUDIO.md` §1).
- Small wordlist profanity filter → friendly nudge.
- No free text is scored or shown to anyone but the guardian.

---

## 7. Uploaded pitch presentations — recommendation: defer

The brief mentions "safe handling of uploaded pitch presentations". Uploads introduce: malware in PPTX/PDF, embedded personal photos/faces/names/school logos, metadata (author names, GPS in images), storage costs, and a moderation burden — all for a feature the built-in deck builder already covers.

**MVP: no uploads.** The Pitch Studio uses structured slides with a preset illustration library. [Recommendation — decision D4]

If uploads are approved later, the minimum controls are:
1. Adult-only upload action (not in Child Mode), with a warning about personal info.
2. Allow PDF and images only (no PPTX/macro formats); max 10 MB; MIME + magic-byte check.
3. Private bucket, per-guardian path, RLS-protected, short-lived signed URLs only.
4. Server-side processing: strip metadata (EXIF), malware scan, re-render pages to images; serve only the rendered images.
5. Retention: deleted with the deck or after 12 months of inactivity.
6. Never processed by external AI/OCR services.

---

## 8. Security architecture

| Threat | Control |
|---|---|
| Cross-family data access | RLS on every table + automated cross-tenant tests; app-layer child scoping |
| Service-role key leak | Server-only env var; never imported in client bundles (lint rule / `server-only` package) |
| Child accesses parent area | Child Mode cookie + PIN/password unlock with attempt limits |
| Session theft | HTTP-only, Secure, SameSite=Lax cookies; short child-mode TTL |
| XSS from child free text | React escaping; no `dangerouslySetInnerHTML`; strict CSP |
| CSRF on server actions | Next.js server-action origin checks + SameSite cookies |
| Brute-force sign-in | Supabase rate limits; captcha after failures (post-MVP) |
| Quiz/achievement tampering | Server-side scoring and engine replay |
| Credential issuer key theft | Server-only, minimal balance, rate limits, separate testnet/mainnet keys, alerting |
| Third-party tracking | No analytics/ads SDKs in Child Mode; no third-party fonts loaded at runtime (self-host) |
| Logging PII | Structured logs with IDs only; no request bodies containing child text |
| Breach | Incident response runbook, NDPC notification path (72h) ⚖️ |

---

## 9. Retention & deletion

[Recommendation — values to be confirmed ⚖️; published in privacy notice as the written retention policy]

| Data | Retention | Deletion trigger |
|---|---|---|
| Child profile + all child content | While account active | Guardian deletes child → soft delete, **hard delete after 30 days** (undo window) |
| Inactive accounts | 18 months of no sign-in | Email warning at 17 months, then deletion |
| Activity responses | Latest 3 per activity | Older pruned automatically |
| Quiz attempts, simulator rounds, investor sessions | Life of the child profile | With profile |
| Consent records | Life of account + 3 years (evidence of lawful processing) ⚖️ | Scheduled job |
| Audit log | 12 months | Scheduled job |
| Server logs (Vercel/Supabase) | Platform default; configure ≤ 30 days where possible | Platform |
| Backups | Rolling per Supabase plan (e.g. 7 days) — deletions propagate when backups expire; disclosed in notice | Expiry |
| On-chain attestation | **Permanent (cannot be deleted)** — contains no personal data | Revoke + delete salt & mapping → unlinkable ⚖️ |

**Data subject rights (guardian-exercised):** export (JSON download per child), rectification (edit), erasure (delete child / account), withdraw consent. Target fulfilment ≤ 30 days; MVP is self-service and immediate.

### 9.1 Permanent deletion — implemented (Phase 2, migrations 0005 + 0006)

- Removing a child sets `deleted_at` (server clock) and creates a `deletion_jobs` row due 30 days later; restoring within the window cancels it.
- `purge_due_deletions()` runs **hourly** via `pg_cron` (`lf-purge-deleted-children`, `17 * * * *`). Each job runs in its own sub-transaction: one failure is recorded (`attempts`, `last_error`) and retried next hour without blocking others. A safety net creates missing jobs for any removed profile; a restored profile is never purged.
- Deleting `child_profiles` cascades to every child-owned table (progress, responses, quiz attempts, projects, decks, simulator/investor sessions, achievements, certificates, credential rows).
- What remains after purge: `deletion_jobs` (target id + timestamps) and `audit_log` (`child.purged`, target id) — UUIDs only, no names or content.
- `deletion_health()` (service role only) reports pending/overdue/failing jobs and the last scheduler runs for monitoring.
- Verified on hosted Supabase 2026-11-06: a due fictional profile was purged by the scheduler itself (no manual call), cascading to its project, with the audit entry written.
- **Not covered yet:** adult-account deletion jobs (`target_type = 'adult_account'`), audit-log and consent-record retention pruning (§9 table), and backups (deleted data persists until Supabase backups roll over — must be disclosed).

### 9.2 Outstanding: consent withdrawal (required before real child data)

Status: **not implemented.** `consent_records.withdrawn_at` exists but clients cannot write it (append-only by design), and there is no UI.

Requirements:
1. **Where:** Parent Settings → "Your agreement", showing the notice version, date and typed name of each consent record, with "Withdraw consent". Must be as easy as giving consent (no extra hurdles beyond a confirmation step and, because it is destructive, the parent PIN or password).
2. **Mechanism:** a SECURITY DEFINER function `withdraw_consent(consent_type)` sets `withdrawn_at = now()` on the active record (never deletes it) and writes `audit_log` `consent.withdrawn`. Clients keep no direct UPDATE grant.
3. **Effect of withdrawing core consent:**
   - `has_core_consent()` becomes false immediately → existing RLS already blocks creating child profiles; Child Mode must also be blocked and ended.
   - All of the family's child profiles are soft-deleted and scheduled for permanent deletion (same 30-day path, so the parent can change their mind by consenting again within the window). ⚖️ Confirm whether withdrawal should instead delete immediately.
   - The parent account stays (so they can export data, re-consent, or delete the account).
4. **Optional consents** (future credential opt-in) withdraw independently and only stop that processing (e.g. revoke + unlink credentials per §11).
5. **Evidence:** keep withdrawn consent records for the consent-record retention period (§9 table) as proof of lawful processing.
6. **Tests:** withdrawal is append-only (no deletes), blocks new profiles and Child Mode, schedules deletions, and can't be performed for another family.

### 9.3 Outstanding: data export (required before real child data)

Status: **not implemented.**

Requirements:
1. **Scope:** per child, everything we hold: profile (nickname, age band, avatar, created date), lesson progress, activity responses, quiz attempts, projects, pitch decks/slides, simulator and investor sessions, achievements and certificates. Plus a parent-level export: account details and consent history.
2. **Format:** machine-readable JSON (portability) with a short human-readable README / HTML summary; dates in ISO 8601; no internal secrets (no `pin_hash`, `credential_secrets`, answer keys or rubric scores).
3. **Delivery:** generated on request from the Parent Dashboard (`/parent/children/[childId]/export` route handler) using the parent's own session so **RLS limits the export to their family**; served as a download with `Content-Disposition: attachment` and `Cache-Control: no-store`. No email attachments, no public URLs, no storage of export files.
4. **Access control:** blocked in Child Mode; requires a recent PIN or password confirmation; rate-limited (e.g. 5 per hour per account).
5. **Audit:** `audit_log` `export.requested` with child id only — never the content.
6. **Removed profiles:** exportable during the 30-day grace period from Settings.
7. **Tests:** isolation (parent A cannot export B's child by id), Child Mode blocked, secrets excluded, audit written.

Real child data remains disabled (`app_settings.real_child_data_enabled = false`, `REAL_CHILD_DATA_ENABLED=false`) until 9.2, 9.3 and the professional review in §12 are complete.

---

## 10. Processors & data location

| Processor | Data | Note |
|---|---|---|
| Supabase | All app data | Choose region deliberately. For a global audience any single region implies **cross-border transfers** for most users (e.g. under NDPA Part VIII, GDPR Chapter V). EU region is a reasonable default given GDPR-grade safeguards [Recommendation] ⚖️ |
| Vercel | Request processing, logs | Global edge/serverless — cross-border transfer ⚖️ |
| Email provider (Supabase default SMTP or e.g. Resend) | Adult email only | DPA required |
| Base (public blockchain) | Non-personal commitments only | Not a processor in the usual sense; public, global, immutable |

Data processing agreements (DPAs) must be in place with each processor before production ⚖️.

---

## 11. On-chain privacy rules (must never go on-chain)

Never: names/nicknames, age or age band, DOB, country/city/school, avatar, project names or text, deck content, scores tied to identity, email/addresses, IP, guardian identity, any value derivable from those by hashing without a secret salt (e.g. `hash(nickname)` is forbidden — it is dictionary-attackable).

Allowed: credential type identifier, issuer address, issue timestamp, content version, a salted commitment, revocation status.

*As implemented (Phase 7):* the only on-chain data is `credentialType` (`keccak256("little-founders:credential:<key>:v1")`), `credentialProof` = SHA-256(credential hash ‖ 32-byte secret salt) and `formatVersion = 1`, attested by the platform issuer to the zero address on Base Sepolia (block time is set by the chain). Salts never leave the database. See `docs/CREDENTIALS.md` §4.

---

## 12. Compliance questions requiring professional review ⚖️

1. Does email-verified adult + guardianship attestation satisfy NDPA s.31(2)–(3) and GAID age/consent verification for this risk level? If not, which method is proportionate?
2. Are we a "data controller of major importance" requiring NDPC registration, and at what user threshold?
3. Is a DPIA required before launch? (Likely yes — children's data.)
4. Cross-border transfer basis for hosting outside Nigeria (adequacy, contractual clauses, consent?).
5. Is a revoked on-chain attestation with a deleted salt sufficient for erasure obligations, or must on-chain issuance be avoided entirely for minors?
6. How should 13-year-olds be treated given NDPA s.31(5) and COPPA's under-13 scope?
7. With a global audience, which VPC (COPPA), AADC (UK) and GDPR Art. 8 obligations apply, and should any countries be gated at launch?
8. School/educator deployments: who is controller, and does school consent replace parental consent?
9. Required content of child-friendly privacy notice under GAID.
10. Retention periods for consent evidence and audit logs.
11. Do certificates bearing a child's name (printed by the parent) create any additional obligations?
