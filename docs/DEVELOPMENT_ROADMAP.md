# LITTLE FOUNDERS — Development Roadmap

Status: Phase 0 draft, for approval · Date: 2026-11-05

## 1. Changes to the proposed sequence

| Original | Revised | Why |
|---|---|---|
| Phase 1: Foundation and UI | **Phase 1: Foundation, design system, data model & content format** | RLS-protected schema and the content format are dependencies of every later phase; defining them first prevents rework. |
| Phase 2: Authentication and dashboards | **Phase 2: Adult auth, consent, child profiles, Child Mode, dashboards** | Consent and Child Mode are safety-critical and must exist before any child data is written. |
| Phase 3: Founder Academy | **Phase 3: Founder Academy + achievements engine + basic Passport** | Founder Passport wasn't in any phase. The achievements engine is needed as soon as lessons complete. |
| Phase 4: Idea Lab | Phase 4: Idea Lab | — |
| Phase 5: Startup Simulator | Phase 5: Startup Simulator | Engine can be built in parallel with Phase 3–4 (pure TS, no deps). |
| Phase 6: Pitch Studio & Investor Room | Phase 6: Pitch Studio & Investor Room | Depends on Idea Lab (prefill) and Simulator (business-model numbers). |
| Phase 7: Base integration, testing, deployment | **Phase 7: Certificates & verifiable credentials (off-chain first, then Base), hardening, launch** | Testing and deployment are *continuous* from Phase 1 (Vercel previews, CI). Phase 7 focuses on credentials + security/accessibility hardening. |

**Content authoring** (six modules of lessons/quizzes, simulator scenarios, investor question banks) is a separate **parallel workstream** starting in Phase 1. It is the largest hidden effort in the project.

```
Phase:     1 ──► 2 ──► 3 ──► 4 ──► 6 ──► 7
                        └─► 5 ─────┘
Engines:   simulator/investor engines can start in Phase 1–2 (pure TS)
Content:   ═══════════════ parallel throughout ═══════════════
Testing:   ═══════════════ continuous (CI + previews) ═════════
```

---

## 2. Phases

### Phase 1 — Foundation, design system, data model, content format
**Scope**
- Next.js (App Router, TS strict), Tailwind, shadcn/ui; ESLint/Prettier; Vitest; Playwright skeleton.
- Child-friendly theme tokens (type scale, colours, radii), core layout shells (marketing, parent, child).
- Marketing landing page (static), privacy/terms placeholder pages.
- Supabase project (dev), migrations for **all MVP tables** + RLS policies + cross-tenant RLS tests.
- Typed content schema (`zod`) for modules/lessons/quizzes/scenarios/personas/achievements + seed script; Module 1 sample content.
- CI on GitHub (lint, typecheck, tests); Vercel preview deployments.

**Deliverables:** running app shell on Vercel preview; migrations; seed; RLS test suite; design tokens; content schema.
**Dependencies:** approvals in `PHASE_0_REPORT.md` §6 (D1–D8); Supabase & Vercel accounts; region decision (D7).
**Acceptance criteria**
- `npm run build`, lint, typecheck, unit tests pass in CI.
- RLS tests prove Adult B reads 0 rows of Adult A's child data on every 🔴 table.
- Content seed is idempotent and validated by zod.
- Landing page scores ≥ 90 Lighthouse accessibility.

### Phase 2 — Adult auth, consent, child profiles, Child Mode, dashboards
**Scope**
- Sign up / sign in / magic link / reset; email verification.
- Adult onboarding, parental notice, consent capture (`consent_records`).
- Child profile CRUD (nickname, avatar, age band); adult PIN.
- Child Mode (signed cookie, middleware gating, PIN unlock).
- Child dashboard (empty states, next-step card) and Parent overview.
- Data export (JSON) and child deletion (soft → scheduled hard delete).

**Deliverables:** complete account lifecycle; `/profiles`, `/play`, `/parent`.
**Dependencies:** Phase 1 schema + RLS.
**Acceptance criteria**
- No child data can be written before a `core_processing` consent record exists (enforced server-side + test).
- Child Mode cannot reach `/parent/*` without PIN; PIN locks after 5 failures.
- Deleting a child removes all 🔴 rows after the grace period (tested).
- E2E: sign-up → consent → child → dashboard < 3 minutes.

### Phase 3 — Founder Academy + achievements + basic Passport
**Scope**
- Module list, lesson player (cards), 4 activity types (sort, match, choose, fill), module quizzes.
- Server-side quiz scoring; lesson/quiz progress.
- Achievements engine (event-driven, idempotent) and toasts.
- Passport page v1 (progress, badges).
- Content: all six modules authored (parallel stream must deliver by end of phase).

**Dependencies:** Phase 2 (child context); content stream.
**Acceptance criteria**
- A child can complete all six modules; progress persists across devices.
- Answer keys are not present in client payloads (verified by test).
- Achievement awards are idempotent (replaying events awards once).
- Lessons readable at target level; keyboard and screen-reader navigable.

### Phase 4 — Idea Lab
**Scope:** 5-step wizard, project CRUD, preset icons/customer chips, PII/profanity nudges, links from Academy modules 2–4.
**Dependencies:** Phase 2; Phase 3 for unlock hints (soft dependency).
**Acceptance criteria**
- Create/edit/archive/delete project; max 10 active.
- PII nudge triggers on phone/email/address patterns (unit-tested).
- `visibility` cannot be anything but `private` (DB constraint test).

### Phase 5 — Startup Simulator
**Scope:** pure engine (seeded PRNG, demand model, events), 3 preset scenarios + "use my project", round UI with charts, decision challenges, educational feedback, end summary, achievements.
**Dependencies:** Phase 2; engine may be built earlier; Idea Lab for project linkage (optional).
**Acceptance criteria**
- Engine unit tests: determinism (same seed+decisions ⇒ same results), no NaN/negative stock, bankruptcy handled gracefully.
- Server replay validates stored rounds.
- Every round shows at least one feedback explanation tied to a decision.

### Phase 6 — Pitch Studio & Investor Room
**Scope:** deck from project (5 fixed sections), layouts/themes/illustrations, present mode, print CSS; 4 personas, question banks, structured answers, rubric engine, results with tips; deck snapshot.
**Dependencies:** Phase 4 (prefill), Phase 5 (numbers, optional), achievements engine.
**Acceptance criteria**
- Deck always has exactly five sections; print output is legible on A4.
- Rubric engine deterministic and unit-tested; scores reproducible from snapshot.
- Feedback language reviewed: no negative/harsh phrasing; every result includes ≥ 2 actionable tips.

### Phase 7 — Certificates, verifiable credentials, hardening, launch
**Scope**
- Certificate rules, certificate view + printable PDF/print CSS.
- Off-chain verification page `/verify/[code]` (works without chain).
- EAS schema registration on **Base Sepolia**; server issuer; async issuance job; revocation; deletion → revoke + delete salt.
- Optional: mainnet switch (decision D3).
- Hardening: CSP, rate limits, security review, accessibility audit, privacy notice final copy, retention jobs scheduled.
- Production deployment; demo data set.

**Dependencies:** Phases 3 & 6 (certificate triggers); legal review outcome for on-chain issuance (⚖️ Q5); funded testnet issuer.
**Acceptance criteria**
- Credential issuance only after adult opt-in; no PII in attestation data (automated check decodes attestation and asserts fields).
- `/verify` shows valid/revoked status correctly; shows no personal data.
- If Base RPC is unavailable, certificates still issue off-chain and issuance retries later.
- Security checklist complete; no high-severity findings open.
- Production uses fictional demo profiles until legal sign-off.

---

## 3. Hackathon cut-line

If time is short, ship in this priority order and cut from the bottom:

1. Phase 1–2 (non-negotiable: safety foundations)
2. Academy with **3 fully-authored modules** + 3 placeholder modules
3. Idea Lab
4. Simulator with **1 scenario**
5. Pitch Studio + Investor Room with **2 personas**
6. Passport + off-chain certificate + `/verify`
7. Base Sepolia attestation
8. Polish: extra personas, scenarios, illustrations

## 4. Deferred (post-MVP)
Educator classrooms & independent child logins · uploads · parent wallets · Open Badges 3.0 export · localisation beyond English · audio narration · native apps · stronger consent verification · admin/support console · analytics.
