# LITTLE FOUNDERS — Database Schema (Design)

Status: Phase 0 design · **Implemented in Phase 1** as `supabase/migrations/20261105000100…000400` · Date: 2026-11-05

> **Phase 1 implementation notes** (differences from the design below):
> - `child_profiles.is_demo` added to mark fictional demo profiles.
> - Creating a child profile requires an active `core_processing` consent (enforced by RLS via `has_core_consent()`).
> - **Write model:** guardians (via Child Mode) may write `lesson_progress`, `activity_responses`, `startup_projects`, `pitch_decks`, `pitch_slides`. Scored/engine records (`quiz_attempts`, `simulator_sessions`, `simulator_rounds`, `investor_sessions`, `investor_responses`, `child_achievements`, `certificates`, `credential_issuances`) are **read-only to clients** and written by server code, so results cannot be forged.
> - Cross-child links use composite foreign keys `(id, child_id)`, so a deck cannot point at another child's project.
> - Answer keys / rubric scores are hidden with **column-level grants** instead of views.
> - An `auth.users` insert trigger creates the matching `adult_accounts` row.
> - Verified by `npm run db:check` (PGlite + Supabase role stub); still to be verified against a real Supabase project.
>
> **Phase 2 additions** (`…000500_parent_accounts_child_mode.sql`):
> - `adult_accounts`: `pin_failed_attempts`, `pin_locked_until`, `child_mode_child_id`, `child_mode_started_at`. Child Mode lives in the database so clearing cookies cannot bypass the PIN.
> - PIN functions (SECURITY DEFINER, bcrypt via pgcrypto): `set_adult_pin`, `enter_child_mode`, `exit_child_mode` (5 tries → 15-min lock), `reset_pin_after_password_auth` (requires a password sign-in ≤5 min old, read from the JWT `amr` claim), `adult_has_pin`.
> - `app_settings.real_child_data_enabled` (default **false**): the child-profile insert policy requires `is_demo = true` until it is switched on after legal review.
> - `child_profiles`: clients may update only `nickname`, `avatar_key`, `age_band`, `deleted_at`; max 8 active profiles per family.
> - Soft delete trigger: server-clock timestamp, `deletion_jobs` row 30 days out, ends Child Mode, audit entry. `purge_due_deletions()` (server/cron only) hard-deletes due profiles. Restores cancel the job.
> - Audit triggers for consent, child create/remove/restore/purge and PIN changes.
> - Explicit table grants for `authenticated`; anonymous visitors cannot execute any of these functions.
>
> **Phase 2 hardening** (`…20261106000600_reliable_purge.sql`):
> - `deletion_jobs`: `attempts`, `last_attempt_at`, `last_error`; at most one pending job per target (partial unique index); index on due jobs.
> - `purge_due_deletions()` rewritten: per-job sub-transaction (one failure is recorded and retried, others continue), safety net for removed profiles without a job, never purges a restored profile. Executable by `service_role` only.
> - `deletion_health()` (service role only): pending / overdue / failing counts and recent `pg_cron` runs.
> - `pg_cron` job `lf-purge-deleted-children` re-scheduled **hourly** (`17 * * * *`).
>
> **Phase 3 additions** (`…20261106000700_academy.sql`):
> - Curriculum source of truth is `src/content/academy/*.ts`; `npm run content:seed` generates `supabase/seed.sql` (idempotent upserts by stable keys). `modules.tone`, `quiz_questions.key`, one activity per lesson.
> - `quiz_questions.explanation` hidden from clients (column grants), alongside `lesson_activities.answer_key` and `quiz_options.is_correct/feedback`.
> - `lesson_progress` and `activity_responses` are now server-written only (client INSERT/UPDATE/DELETE revoked).
> - SECURITY DEFINER functions act for the child in the caller's active Child Mode: `submit_lesson_activity`, `complete_lesson` (sequential unlock + solved activity required), `submit_quiz` (server scoring, all lessons required, rate-limited), `quiz_review`. Internal: `learning_child`, `lesson_unlocked`, `module_completed`, `evaluate_achievements` (awards badges + the learning-milestone certificate from stored records).
>
> **Phase 4 additions** (`…20261106000800_idea_lab.sql`):
> - `startup_projects` gains structured Idea Lab columns: `problem_category`, `problem_who`, `problem_frequency`, `solution_type`, `solution_benefit`, `buyer`, `special_tags`, `first_step`, `wizard_step` (resume point). Preset value lists, icon and tag lists, and text lengths are CHECK constraints (mirroring `src/content/idea-lab.ts`).
> - `startup_projects_ready_complete`: status `ready` ("Idea created") requires problem, solution, users, buyer, name and description.
> - Client INSERT/UPDATE/DELETE on `startup_projects` revoked. Writes go through `save_idea(idea_id, fields, step, finish)` (allow-listed fields, atomic, 10-active-idea limit, ownership from `learning_child()`) and `delete_idea(idea_id)`. Guardians keep read access via RLS.
> - `evaluate_achievements` gains the `ideas_created` rule (Idea Spark badge).
>
> **Phase 5 additions** (`…20261106000900_startup_simulator.sql`, rules in `docs/STARTUP_SIMULATOR.md`):
> - `simulator_sessions` gains `draft` (resume choices) and `reflection` (predefined key). Scenarios `ecobottle` and `my-idea` are seeded with their options in `demand_params`.
> - `simulator_outcome()` (pure, deterministic) calculates results; `start_simulation`, `save_simulation_draft`, `run_simulation` (budget-enforced), `set_simulation_reflection` act for the child in Child Mode. Sessions and rounds stay read-only to clients.
> - Triggers make completed attempts and stored rounds immutable. `evaluate_achievements` gains `simulations_completed` (First Business Run).
>
> **Phase 6 additions** (`…20261106001000_pitch_studio.sql`, rules in `docs/PITCH_STUDIO.md`):
> - `pitch_decks` gains `tagline`, `icon_key`, `builder_step` (resume point) and a preset `theme_key` check; `pitch_slides.content` is `{main, extra}` with length checks. Client INSERT/UPDATE/DELETE on both revoked (guardian read-only policies replace the 0003 write policies).
> - New `pitch_versions` (immutable snapshots of each finished pitch, v1, v2, …; RLS guardian read).
> - `investor_sessions` gains `pitch_version_id` (composite FK) and `points`; `decision` must be null (pretend investors never decide); completed sessions are immutable. `investor_responses` gains `bonus` (own words) and `review` (question, answer, feedback snapshot) and is immutable.
> - Content: `investor_personas.position/style`, `investor_questions.key/position/hint`, seeded from `src/content/investor-room.ts` (scores and feedback hidden by column grants).
> - Functions acting for the child in Child Mode: `start_pitch`, `save_pitch` (allow-listed fields, privacy check, finish → version), `start_investor_practice`, `answer_investor_question` (deterministic rubric). Internal: `pitch_personal_info`, `own_words_bonus`, `pitch_snapshot`, `pitch_fields_problem`, `pitch_apply_fields`. `evaluate_achievements` gains `pitches_completed` (First Pitch) and `practices_completed` (Confident Founder).
>
> Applied to the hosted dev project on 2026-11-06 (0001–0010 + seed). See `docs/CHILD_SAFETY_AND_PRIVACY.md` §9.1.

Target: Supabase Postgres with Row-Level Security (RLS) on every table.

---

## 1. Conventions

- Primary keys: `uuid` (`gen_random_uuid()`), except content tables which use stable text `key`s plus a uuid.
- Timestamps: `created_at`, `updated_at` (`timestamptz`); soft delete `deleted_at` only where a grace period is needed.
- Enum-like values as Postgres `text` + `CHECK` constraints (easier to evolve than native enums).
- `jsonb` only for genuinely flexible payloads (slide content, simulator state); everything queried/filtered is a column.
- Every child-owned table has `child_id` → `child_profiles.id` `ON DELETE CASCADE` so deleting a child removes all their data in one statement.

### Data classification

| Class | Meaning | Examples |
|---|---|---|
| 🔴 **Private-Child** | Created by or about a child. Only the guardian can access. Never public, never on-chain, never sent to third parties. | child_profiles, projects, decks, answers, free text |
| 🟠 **Private-Adult** | Adult account & consent data. | adult_accounts, consent_records |
| 🟡 **Restricted-System** | Server-only secrets / issuance internals. No client access at all. | credential salts, issuer metadata, audit_log |
| 🟢 **Public-Content** | Curriculum content authored by us. | modules, lessons, quiz questions, personas |
| 🔵 **Public-Verification** | Deliberately non-personal fields exposed via `/verify`. | credential type, issue date, attestation UID, status |

---

## 2. Entity-relationship overview

```
auth.users 1─1 adult_accounts 1─* consent_records *─1 child_profiles
                     │                                    │
                     └──────────────1─*───────────────────┘ (guardian_id)
                                                          │
  ┌──────────────── child_profiles 1─* ───────────────────┼───────────────────────────┐
  │               │                │                      │                           │
lesson_progress  quiz_attempts   activity_responses    startup_projects          child_achievements
  │ *─1 lessons    │ *─1 quizzes                         │ 1─* simulator_sessions     │ *─1 achievements
                                                         │        1─* simulator_rounds
                                                         │ 1─* pitch_decks
                                                         │        1─* pitch_slides
                                                         │        1─* investor_sessions
                                                         │                 1─* investor_responses
                                                         │
                                                    certificates 1─0..1 credential_issuances
                                                                              1─1 credential_secrets (server-only)

Content (read-only, seeded from repo):
modules 1─* lessons 1─* lesson_activities
modules 1─1 quizzes 1─* quiz_questions 1─* quiz_options
simulator_scenarios 1─* simulator_events
investor_personas 1─* investor_questions 1─* investor_answer_options
achievements, certificate_types
```

---

## 3. Accounts, consent, profiles

### `adult_accounts` 🟠
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | = `auth.users.id` |
| display_name | text | |
| role | text | `parent` \| `educator` (educator features deferred) |
| country_code | text | ISO-3166 alpha-2; drives which privacy notice applies |
| pin_hash | text | adult unlock PIN, hashed (argon2/bcrypt) — **server only column** (exposed via view without it) |
| created_at / updated_at | timestamptz | |

### `child_profiles` 🔴
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| guardian_id | uuid FK → adult_accounts | owner |
| nickname | text | 2–20 chars; UI advises *not* using full real name |
| avatar_key | text | from preset avatar set (no photos) |
| age_band | text | `10-11` \| `12-13` — **no date of birth** |
| locale | text | default `en` |
| credentials_opt_in | boolean | default false; guardian-controlled |
| created_at / updated_at / deleted_at | timestamptz | `deleted_at` starts a 30-day hard-delete timer |

Not collected: real full name, DOB, school, photo, address, phone, email, gender, precise location.

### `consent_records` 🟠
Append-only evidence of parental consent.
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| guardian_id | uuid FK | |
| child_id | uuid FK nullable | consent can be account-level or per child |
| consent_type | text | `core_processing` \| `onchain_credential` \| (future) `educator_access` |
| notice_version | text | version of privacy notice shown |
| method | text | `email_verified_plus_affirmation` (MVP); future stronger methods |
| typed_name | text | adult's typed signature |
| granted_at | timestamptz | |
| withdrawn_at | timestamptz nullable | |
| ip_hash / user_agent_hash | text | optional evidence, hashed; retention-limited |

### (Deferred) `classrooms`, `classroom_members`
Educator-owned groups; designed for later, not created in MVP.

---

## 4. Content tables 🟢 (seeded from `src/content`, read-only to clients)

| Table | Key columns |
|---|---|
| `modules` | id, key (`m1-thinking-like-a-founder`), position, title, summary, icon_key, content_version |
| `lessons` | id, module_id FK, key, position, title, est_minutes, body jsonb (cards) |
| `lesson_activities` | id, lesson_id FK, key, kind (`sort`\|`match`\|`choose`\|`fill`), config jsonb, answer_key jsonb (**not exposed to client**; served via view without it) |
| `quizzes` | id, module_id FK (1-1), pass_mark |
| `quiz_questions` | id, quiz_id FK, position, kind, prompt, explanation |
| `quiz_options` | id, question_id FK, label, is_correct (**hidden from client view**), feedback |
| `simulator_scenarios` | id, key, title, product_kind, starting_budget, unit_cost_base, demand_params jsonb, rounds |
| `simulator_events` | id, scenario_id FK nullable (null = global), key, trigger_round, choices jsonb, effects jsonb, lesson_text |
| `investor_personas` | id, key, name, avatar_key, focus, rubric_weights jsonb, intro_text |
| `investor_questions` | id, persona_id FK nullable, section (`problem`\|`solution`\|`customer`\|`business_model`\|`ask`), difficulty, prompt |
| `investor_answer_options` | id, question_id FK, label, score (0–3), feedback |
| `achievements` | id, key, title, description, icon_key, rule jsonb, tier |
| `certificate_types` | id, key, title, requirement jsonb, onchain_eligible boolean |

Content changes are made in the repo, reviewed, and re-seeded; `content_version` lets old progress remain interpretable.

---

## 5. Learning progress 🔴

### `lesson_progress`
| child_id FK | lesson_id FK | status (`started`\|`completed`) | started_at | completed_at |
Unique (child_id, lesson_id).

### `activity_responses`
| id | child_id | activity_id | response jsonb | is_correct | created_at |
Keep latest N=3 per activity; older pruned.

### `quiz_attempts`
| id | child_id | quiz_id | answers jsonb (option ids) | score int | passed bool | started_at | submitted_at |
Score computed server-side.

Derived (view, not table): `module_progress_v` — % lessons complete, best quiz score, passed.

---

## 6. Idea Lab 🔴

### `startup_projects`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| child_id | uuid FK | |
| name | text (≤40) | |
| icon_key | text | preset |
| problem | text (≤400) | |
| solution | text (≤400) | |
| target_customer_tags | text[] | from preset chips |
| target_customer_note | text (≤200) | |
| value_statement | text (≤200) | |
| status | text | `draft` \| `ready` \| `archived` |
| visibility | text | **always `private`** in MVP (CHECK constraint); column exists to make the rule explicit |
| created_at / updated_at | | |

---

## 7. Startup Simulator 🔴

### `simulator_sessions`
| id | child_id | project_id FK nullable | scenario_id FK | seed int | starting_budget | current_round | status (`active`\|`completed`\|`abandoned`) | final_summary jsonb | created_at | completed_at |

### `simulator_rounds`
| id | session_id FK | round int | quantity int | unit_price numeric | marketing_spend numeric | event_key text nullable | event_choice text nullable | units_sold int | revenue | cost | profit | budget_after | feedback_keys text[] |
Unique (session_id, round). Server replays the engine from `seed` + decisions to validate stored outcomes.

---

## 8. Pitch Studio & Investor Room 🔴

### `pitch_decks`
| id | child_id | project_id FK nullable | title | tagline | icon_key | theme_key | builder_step | simulator_session_id FK nullable | status (`draft`\|`ready`) | created_at | updated_at |
`ready` = matches the latest finished version; `draft` with versions = revising. Server-written only (Phase 6).

### `pitch_slides`
| id | deck_id FK | section (`problem`\|`solution`\|`customer`\|`business_model`\|`ask`) | layout_key | content jsonb (`main` ≤ 280, `extra` ≤ 200) | position |
Unique (deck_id, section) — exactly five slides in MVP.

### `pitch_versions` (Phase 6)
| id | deck_id | child_id | version (1, 2, …) | snapshot jsonb (title, tagline, icon_key, theme_key, sections) | created_at |
Unique (deck_id, version); FK (deck_id, child_id) → pitch_decks. Immutable; guardian read-only.

### (Deferred) `pitch_uploads` — see Safety doc §7. Not created in MVP.

### `investor_sessions`
| id | child_id | deck_id FK | persona_id FK | pitch_version_id FK | question_ids uuid[] | points 0–20 | total_score 0–100 | sub_scores jsonb | band text | decision (always null) | tips_keys text[] | deck_snapshot jsonb | created_at | completed_at |
`deck_snapshot` freezes what was evaluated so later edits don't change historical feedback. Immutable once completed.

### `investor_responses`
| id | session_id FK | question_id FK | option_id FK | note text (≤200, optional; earns the own-words bonus) | score 0–3 | bonus 0–1 | review jsonb | created_at |

---

## 9. Achievements, certificates, credentials

### `child_achievements` 🔴
| child_id | achievement_id | earned_at | source_event | Unique (child_id, achievement_id) |

### `certificates` 🔴
| id | child_id | certificate_type_id | issued_at | verification_code text unique (random, 10+ chars, unguessable) | status (`active`\|`revoked`) |

### `credential_issuances` 🔵 (public-safe columns) / 🟡
| Column | Notes |
|---|---|
| id | |
| certificate_id FK unique | |
| chain_id | 84532 (Base Sepolia) / 8453 (Base mainnet) |
| schema_uid | registered EAS schema |
| attestation_uid | returned by EAS |
| tx_hash | |
| subject_commitment | bytes32 hex, as written on-chain |
| status | `pending`\|`submitted`\|`confirmed`\|`failed`\|`revoked` |
| error | text |
| created_at / confirmed_at / revoked_at | |

### `credential_secrets` 🟡 (service-role only; RLS denies all)
| certificate_id FK PK | salt bytea | created_at |
Deleting this row (on erasure) makes the on-chain commitment permanently unlinkable.

---

## 10. Operational tables 🟡

| Table | Purpose |
|---|---|
| `audit_log` | actor_id, action (`consent.granted`, `child.deleted`, `export.requested`, `credential.issued`…), target, at. No content payloads. |
| `deletion_jobs` | target_type, target_id, requested_by, scheduled_for, executed_at |

---

## 11. Row-Level Security plan

Helper (SQL function, `security definer`, stable):
```
is_guardian_of(child uuid) → boolean
  = exists(select 1 from child_profiles where id = child and guardian_id = auth.uid() and deleted_at is null)
```

| Table group | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| adult_accounts | `id = auth.uid()` | `id = auth.uid()` (pin_hash only via server action) |
| child_profiles | `guardian_id = auth.uid()` | same |
| consent_records | `guardian_id = auth.uid()` | insert only (append-only; no update/delete by client) |
| All 🔴 child-owned tables | `is_guardian_of(child_id)` (or via parent row join) | same |
| Content 🟢 | all authenticated (+anon for marketing previews) via **views excluding answer keys** | none (service role seeds) |
| certificates | guardian | server only |
| credential_issuances | guardian (all cols); public access only via server `/verify` route | server only |
| credential_secrets, audit_log, deletion_jobs | **deny all** | server only |

**Testing requirement:** each policy gets an automated test (pgTAP or a Vitest suite using two test adults) asserting adult B can see *zero* of adult A's data. RLS failures are silent — tests are the only safeguard.

## 12. Storage
MVP uses **no user upload buckets**. Static illustrations ship with the app. If uploads are later approved: private bucket `pitch-uploads`, path `{guardian_id}/{child_id}/{uuid}`, RLS on `storage.objects` by first path segment, short-lived signed URLs, size/type limits, server-side re-rendering to images. See Safety doc §7.

## 13. Retention summary
See `CHILD_SAFETY_AND_PRIVACY.md` §9 for the authoritative retention table.
