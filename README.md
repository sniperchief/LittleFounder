# LITTLE FOUNDERS

Entrepreneurship learning for children aged 10–13, with parents in charge.
Product and architecture decisions live in [`docs/`](docs/) — start with `docs/PHASE_0_REPORT.md`.

**Status:** Phase 6 (Pitch Studio & Investor Room — rules in `docs/PITCH_STUDIO.md`), Phase 5 (Startup Simulator — rules in `docs/STARTUP_SIMULATOR.md`) and Phase 4 (Idea Lab) on top of Phase 3 (Founder Academy and Founder Passport) and Phase 2 (parent accounts, consent, child profiles, Child Mode, Parent Dashboard).

## Stack

Next.js 16 (App Router, Turbopack, Cache Components) · TypeScript · Tailwind CSS v4 · shadcn-style components
(hand-written in `src/components/ui`) · Supabase (Postgres + RLS) · Vercel.

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
```

| Script | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate route types + `tsc --noEmit` |
| `npm run db:check` | Checks `seed.sql` matches the curriculum, then applies all migrations + seed to an in-memory Postgres (PGlite) with a stub of Supabase's roles and runs 285 security, calculation and scoring checks. A simulation, not real Supabase. |
| `npm run content:seed` | Regenerates `supabase/seed.sql` from `src/content/academy`, `src/content/simulator.ts` and `src/content/investor-room.ts` (run after editing lessons, quizzes or investor questions). |
| `npm run db:push` | Applies `supabase/migrations` to the hosted project in `SUPABASE_DB_URL`, then applies the (idempotent) curriculum seed. |
| `npm run db:check:remote` | 119 real end-to-end checks against the hosted project (Auth, RLS, purge, Academy scoring, Idea Lab, Simulator, Pitch Studio & Investor Room) using throwaway fictional accounts, deleted afterwards. |
| `npm run test:e2e` | Browser end-to-end test (needs `npm run build && npm start` running and an installed Edge/Chrome). Creates and deletes fictional accounts. |

## Supabase setup

1. Create a Supabase project (choose the region deliberately — see `docs/CHILD_SAFETY_AND_PRIVACY.md` §10).
2. `cp .env.example .env.local` and fill in all four values (URL, publishable key, secret key, Session-pooler DB URL).
3. `npm run db:push` — applies the six migrations and the curriculum seed. Migration 0005/0006 enable `pg_cron` and schedule the hourly purge where the extension is available (it is on hosted Supabase).
4. `npm run db:check:remote` — verifies the security rules against the real project.
5. Supabase dashboard → Authentication → URL Configuration: set the Site URL and add
   `http://localhost:3000/**` (and your Vercel URL) to Redirect URLs, so confirmation and password-reset links work.
6. Check the purge is scheduled: Integrations → Cron should list `lf-purge-deleted-children` (hourly). If `pg_cron`
   was unavailable, enable it and schedule `select public.purge_due_deletions()` hourly.
7. Email: Supabase's built-in email service is for testing only — it sends a few emails per hour and only to your
   project team's addresses. Configure custom SMTP (Authentication → Emails) before real parents sign up.

The secret key is used only by the test script; the app runs with the publishable key and RLS.
Never commit `.env.local` or expose the secret key to the browser.

## Project layout

```
docs/                     Phase 0 specs (product, architecture, schema, safety, roadmap)
scripts/check-db.mjs      Migration + RLS checks (PGlite)
supabase/migrations/      SQL migrations (0001 foundation … 0008 Idea Lab, 0009 Startup Simulator, 0010 Pitch Studio & Investor Room)
supabase/seed.sql         Curriculum seed (no personal data)
src/app/(marketing)/      Public pages: /, /get-started, /privacy
src/app/(auth)/           Sign in/up, password reset + auth server actions
src/app/(account)/        Onboarding, profile picker, Parent Dashboard, settings
src/app/play/             Child Mode (PIN-protected exit at /play/exit)
src/lib/auth/session.ts   Server-side guards: requireAdult / requireParent / requireChildMode
src/proxy.ts              Session refresh + optimistic sign-in redirect
src/components/ui/        Design-system primitives (button, card, badge, form fields)
src/components/layout/    Header, footer, container/section, status panel
src/components/marketing/ Landing page sections
src/content/              Typed product content (curriculum, Idea Lab, Simulator, Pitch Studio, investor bank)
src/lib/supabase/         Supabase browser/server clients
```

## Ground rules

- No real child data until the professional privacy/legal review is complete. Demo profiles are fictional.
- No external AI APIs, no real money, no child wallets. The Simulator uses pretend "Founder Bucks"; Investor Room characters are pretend investors giving rule-based practice feedback.
- Every new table gets RLS and a check in `scripts/check-db.mjs`.
