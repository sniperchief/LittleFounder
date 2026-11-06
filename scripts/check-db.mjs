// Applies supabase/migrations + seed to an in-memory Postgres (PGlite) with a
// minimal stub of Supabase's auth schema and roles, then checks family isolation
// and the other security rules from docs/DATABASE_SCHEMA.md §11.
//
// Not a substitute for testing against real Supabase (see README), but it runs
// anywhere without Docker. Usage: npm run db:check

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const root = join(import.meta.dirname, "..");
const migrationsDir = join(root, "supabase", "migrations");

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create schema extensions;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
  $$;
  grant usage on schema extensions to anon, authenticated, service_role;
  grant execute on function auth.jwt() to anon, authenticated, service_role;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "bbbbbbbb-0000-4000-8000-000000000002";

const db = new PGlite({ extensions: { pgcrypto } });
let passed = 0;
let failed = 0;

function check(name, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function as(role, userId, fn, claims = {}) {
  const jwt = JSON.stringify({ sub: userId ?? undefined, ...claims }).replaceAll("'", "''");
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${userId ?? ""}', false);
                 select set_config('request.jwt.claims', '${jwt}', false);`);
  await db.exec(`set role ${role};`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role;");
  }
}

async function expectError(name, fn, pattern) {
  try {
    await fn();
    check(name, false, "expected an error but the statement succeeded");
  } catch (err) {
    const ok = pattern ? pattern.test(err.message) : true;
    check(name, ok, ok ? "" : `unexpected error: ${err.message}`);
  }
}

async function rows(sql, params) {
  return (await db.query(sql, params)).rows;
}

// ---------------------------------------------------------------------------

console.log("Applying Supabase stub, migrations and seed…");
await db.exec(SUPABASE_STUB);
for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
  await db.exec(readFileSync(join(migrationsDir, file), "utf8"));
  console.log(`  applied ${file}`);
}
await db.exec(readFileSync(join(root, "supabase", "seed.sql"), "utf8"));
await db.exec(readFileSync(join(root, "supabase", "seed.sql"), "utf8")); // idempotent

console.log("\nTest harness");
await as("authenticated", A, async () => {
  const [{ user, sub }] = await rows("select current_user as user, auth.uid()::text as sub");
  check("queries run as the non-superuser `authenticated` role with a JWT subject", user === "authenticated" && sub === A);
});

console.log("\nAccounts & consent");
await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@example.test'), ('${B}', 'b@example.test');`);
check("auth signup creates adult_accounts rows", (await rows("select id from public.adult_accounts")).length === 2);

await as("authenticated", A, () =>
  expectError(
    "child profile cannot be created before parental consent",
    () => db.query(`insert into public.child_profiles (guardian_id, nickname, age_band, is_demo) values ($1, 'Demo Ada', '10-11', true)`, [A]),
    /row-level security/,
  ),
);

const consentSql = `insert into public.consent_records (guardian_id, consent_type, notice_version, typed_name)
                    values ($1, 'core_processing', 'v0-demo', 'Demo Parent')`;
await as("authenticated", A, () => db.query(consentSql, [A]));
await as("authenticated", B, () => db.query(consentSql, [B]));

const childA = await as("authenticated", A, async () =>
  (await rows(`insert into public.child_profiles (guardian_id, nickname, age_band, is_demo)
               values ($1, 'Demo Ada', '10-11', true) returning id`, [A]))[0].id,
);
const childB = await as("authenticated", B, async () =>
  (await rows(`insert into public.child_profiles (guardian_id, nickname, age_band, is_demo)
               values ($1, 'Demo Ben', '12-13', true) returning id`, [B]))[0].id,
);
check("child profile can be created after consent", Boolean(childA && childB));

await as("authenticated", A, () =>
  expectError(
    "adult cannot create a child profile under another guardian",
    () => db.query(`insert into public.child_profiles (guardian_id, nickname, age_band) values ($1, 'Sneaky', '10-11')`, [B]),
    /row-level security/,
  ),
);
await as("authenticated", A, () =>
  expectError("consent records are append-only", () =>
    db.query(`update public.consent_records set withdrawn_at = now()`), /permission denied/),
);
await as("authenticated", A, () =>
  expectError("adult PIN hash is never readable by clients", () =>
    db.query(`select pin_hash from public.adult_accounts`), /permission denied/),
);
await as("authenticated", A, () =>
  expectError("guardians cannot hard-delete child profiles directly", () =>
    db.query(`delete from public.child_profiles where id = $1`, [childA]), /permission denied/),
);

console.log("\nFamily isolation");
await as("authenticated", A, async () => {
  const kids = await rows("select id from public.child_profiles");
  check("adult A sees exactly one child (their own)", kids.length === 1 && kids[0].id === childA);
  check("adult A sees only their own adult account", (await rows("select id from public.adult_accounts")).length === 1);
  check("adult A sees only their own consent", (await rows("select id from public.consent_records")).length === 1);
});

// Since Phase 4, projects are written only through save_idea(); seed one directly (superuser).
const projectB = (await rows(`insert into public.startup_projects (child_id, name) values ($1, 'Demo Plant Pals') returning id`, [childB]))[0].id;
await as("authenticated", A, async () => {
  check("adult A cannot read B's projects", (await rows("select id from public.startup_projects")).length === 0);
  await expectError(
    "adult A cannot create a project for B's child",
    () => db.query(`insert into public.startup_projects (child_id, name) values ($1, 'Intruder')`, [childB]),
    /row-level security|permission denied/,
  );
  await expectError(
    "adult A cannot link a deck to B's project (composite FK)",
    () => db.query(`insert into public.pitch_decks (child_id, project_id, title) values ($1, $2, 'Deck')`, [childA, projectB]),
    /foreign key|row-level security|permission denied/,
  );
  await expectError("adult A cannot modify B's project", () =>
    db.query(`update public.startup_projects set name = 'Hijacked' where id = $1`, [projectB]), /permission denied/);
});

console.log("\nPrivacy & integrity rules");
await expectError(
  "projects cannot be made public (even by the server)",
  () => db.query(`insert into public.startup_projects (child_id, name, visibility) values ($1, 'X', 'public')`, [childA]),
  /check constraint/,
);
for (let i = 1; i <= 10; i++) {
  await db.query(`insert into public.startup_projects (child_id, name) values ($1, $2)`, [childA, `Demo idea ${i}`]);
}
await expectError(
  "max 10 active projects per child",
  () => db.query(`insert into public.startup_projects (child_id, name) values ($1, 'Eleventh')`, [childA]),
  /at most 10 active projects/,
);
await as("authenticated", A, async () => {
  await expectError("quiz attempts are server-written only", () =>
    db.query(`insert into public.quiz_attempts (child_id, quiz_id, score, passed) values ($1, gen_random_uuid(), 100, true)`, [childA]),
    /permission denied/);
  await expectError("achievements are server-written only", () =>
    db.query(`insert into public.child_achievements (child_id, achievement_id, source_event) values ($1, gen_random_uuid(), 'x')`, [childA]),
    /permission denied/);
  await expectError("credential secrets are inaccessible to clients", () =>
    db.query(`select * from public.credential_secrets`), /permission denied/);
});

console.log("\nPublic content & anonymous access");
await as("anon", null, async () => {
  check("anon can read the six seeded modules", (await rows("select key from public.modules")).length === 6);
  await expectError("anon cannot read child profiles", () => db.query("select * from public.child_profiles"), /permission denied/);
  await expectError("anon cannot read projects", () => db.query("select * from public.startup_projects"), /permission denied/);
  await expectError("quiz answer keys are hidden", () => db.query("select is_correct from public.quiz_options"), /permission denied/);
  await expectError("investor rubric scores are hidden", () => db.query("select score from public.investor_answer_options"), /permission denied/);
  await expectError("activity answer keys are hidden", () => db.query("select answer_key from public.lesson_activities"), /permission denied/);
  await expectError("anon cannot write content", () =>
    db.query(`insert into public.modules (key, position, title, summary, icon_key) values ('x', 9, 'x', 'x', 'x')`), /permission denied/);
});

console.log("\nParent PIN & Child Mode (Phase 2)");
const rpc = async (sql, params) => (await rows(sql, params))[0].r;
await as("authenticated", A, async () => {
  check("trivial PINs are rejected", (await rpc("select public.set_adult_pin('1111') as r")) === "too_simple");
  check("child mode needs a PIN first", (await rpc("select public.enter_child_mode($1) as r", [childA])) === "pin_required");
  check("PIN can be set", (await rpc("select public.set_adult_pin('2580') as r")) === "ok");
  check("adult_has_pin() reports the PIN", (await rpc("select public.adult_has_pin() as r")) === true);
  check("changing the PIN needs the current PIN", (await rpc("select public.set_adult_pin('3691', '0000') as r")) === "wrong_pin");
  check("PIN change with the current PIN works", (await rpc("select public.set_adult_pin('3691', '2580') as r")) === "ok");
  check("cannot enter child mode for another family's child", (await rpc("select public.enter_child_mode($1) as r", [childB])) === "not_found");
  check("can enter child mode for own child", (await rpc("select public.enter_child_mode($1) as r", [childA])) === "ok");
  await expectError("child mode cannot be cleared by a direct update", () =>
    db.query("update public.adult_accounts set child_mode_child_id = null"), /permission denied/);
  check("PIN cannot be changed during child mode", (await rpc("select public.set_adult_pin('4826', '3691') as r")) === "child_mode_active");
  const results = [];
  for (let i = 0; i < 5; i++) results.push(await rpc("select public.exit_child_mode('9999') as r"));
  check("wrong PINs are rejected, then locked after 5 tries", results.slice(0, 4).every((r) => r === "wrong_pin") && results[4] === "locked");
  check("correct PIN is refused while locked", (await rpc("select public.exit_child_mode('3691') as r")) === "locked");
  check("PIN reset needs a fresh password sign-in", (await rpc("select public.reset_pin_after_password_auth() as r")) === "reauth_required");
});
const now = Math.floor(Date.now() / 1000);
await as("authenticated", A, async () => {
  check("fresh password sign-in resets PIN and leaves child mode", (await rpc("select public.reset_pin_after_password_auth() as r")) === "ok");
  const [acct] = await rows("select child_mode_child_id from public.adult_accounts");
  check("child mode is cleared after re-auth", acct.child_mode_child_id === null);
}, { amr: [{ method: "password", timestamp: now }] });
await as("authenticated", A, async () => {
  await db.query("select public.set_adult_pin('3691')");
  await db.query("select public.enter_child_mode($1)", [childA]);
  check("exit with the correct PIN works", (await rpc("select public.exit_child_mode('3691') as r")) === "ok");
});
await as("anon", null, () =>
  expectError("anonymous visitors cannot call child-mode functions", () =>
    db.query("select public.enter_child_mode($1)", [childA]), /permission denied/),
);

console.log("\nReal-data gate & profile rules (Phase 2)");
await as("authenticated", A, async () => {
  await expectError("non-demo child profiles are blocked while real data is gated", () =>
    db.query(`insert into public.child_profiles (guardian_id, nickname, age_band, is_demo) values ($1, 'Real', '10-11', false)`, [A]),
    /row-level security/);
  await expectError("is_demo cannot be changed by clients", () =>
    db.query("update public.child_profiles set is_demo = false where id = $1", [childA]), /permission denied/);
  await expectError("guardian_id cannot be changed by clients", () =>
    db.query("update public.child_profiles set guardian_id = $2 where id = $1", [childA, B]), /permission denied/);
  for (let i = 2; i <= 8; i++) {
    await db.query(`insert into public.child_profiles (guardian_id, nickname, age_band, is_demo) values ($1, $2, '12-13', true)`, [A, `Demo Kid ${i}`]);
  }
  await expectError("max 8 child profiles per family", () =>
    db.query(`insert into public.child_profiles (guardian_id, nickname, age_band, is_demo) values ($1, 'Ninth', '12-13', true)`, [A]),
    /at most 8 child profiles/);
});

console.log("\nSoft delete, restore & purge (Phase 2)");
const extra = await as("authenticated", A, async () =>
  (await rows("select id from public.child_profiles where nickname = 'Demo Kid 8'"))[0].id);
await as("authenticated", A, async () => {
  await db.query("update public.child_profiles set deleted_at = '2000-01-01' where id = $1", [extra]);
  const [p] = await rows("select deleted_at from public.child_profiles where id = $1", [extra]);
  check("soft delete uses the server clock", new Date(p.deleted_at).getFullYear() >= 2026);
  check("removed child's data is no longer reachable", (await rows("select public.is_guardian_of($1) as g", [extra]))[0].g === false);
  await db.query("update public.child_profiles set deleted_at = null where id = $1", [extra]);
  check("removed child can be restored within the grace period", (await rows("select public.is_guardian_of($1) as g", [extra]))[0].g === true);
  await db.query("update public.child_profiles set deleted_at = now() where id = $1", [extra]);
  await expectError("clients cannot run the purge", () => db.query("select public.purge_due_deletions()"), /permission denied/);
});
const [job] = await rows("select scheduled_for - now() > interval '29 days' as ok from public.deletion_jobs where target_id = $1 and executed_at is null", [extra]);
check("removal schedules permanent deletion 30 days out", job?.ok === true);
await db.query("update public.deletion_jobs set scheduled_for = now() - interval '1 minute' where target_id = $1", [extra]);
await db.query("select public.purge_due_deletions()");
check("purge permanently deletes due profiles", (await rows("select 1 from public.child_profiles where id = $1", [extra])).length === 0);
const actions = (await rows("select action from public.audit_log")).map((r) => r.action);
check("audit log records consent, creation, removal, restore and purge",
  ["consent.granted", "child.created", "child.removed", "child.restored", "child.purged", "pin.set"].every((a) => actions.includes(a)));

console.log("\nReliable purge (0006)");
const demoChild = async (nickname) =>
  (await rows(`insert into public.child_profiles (guardian_id, nickname, age_band, is_demo)
               values ($1, $2, '12-13', true) returning id`, [B, nickname]))[0].id;
const [orphan, restored, failing, healthy] = [
  await demoChild("Demo Orphan"), await demoChild("Demo Restored"),
  await demoChild("Demo Failing"), await demoChild("Demo Healthy"),
];
// Orphan: removed 31 days ago but its deletion job is missing (bypass triggers to set this up).
await db.exec(`set session_replication_role = replica;
  update public.child_profiles set deleted_at = now() - interval '31 days' where id = '${orphan}';
  set session_replication_role = default;`);
// Restored profile with a stale due job left behind.
await db.query(`insert into public.deletion_jobs (target_type, target_id, requested_by, scheduled_for)
                values ('child_profile', $1, $2, now() - interval '1 day')`, [restored, B]);
// Two due removals; one will fail.
for (const id of [failing, healthy]) {
  await as("authenticated", B, () => db.query("update public.child_profiles set deleted_at = now() where id = $1", [id]));
}
await db.query("update public.deletion_jobs set scheduled_for = now() - interval '1 minute' where target_id = any($1)", [[failing, healthy]]);
await db.exec(`create function pg_temp.fail_purge() returns trigger language plpgsql as $$
    begin raise exception 'simulated storage failure'; end $$;
  create trigger lf_test_fail before delete on public.child_profiles
    for each row when (old.id = '${failing}') execute function pg_temp.fail_purge();`);
await expectError(
  "duplicate pending deletion jobs are rejected",
  () => db.query(`insert into public.deletion_jobs (target_type, target_id, scheduled_for) values ('child_profile', $1, now())`, [healthy]),
  /duplicate key/,
);

const purgedCount = await as("service_role", null, async () => (await rows("select public.purge_due_deletions() as n"))[0].n);
const exists = async (id) => (await rows("select 1 from public.child_profiles where id = $1", [id])).length === 1;
check("server role can run the purge", purgedCount === 2, `purged ${purgedCount}`);
check("safety net purges a removed profile whose job was missing", !(await exists(orphan)));
check("a restored profile is never purged (stale job discarded)",
  (await exists(restored)) && (await rows("select 1 from public.deletion_jobs where target_id = $1", [restored])).length === 0);
check("one failing job does not block the others", !(await exists(healthy)) && (await exists(failing)));
const [failJob] = await rows("select attempts, last_error, executed_at from public.deletion_jobs where target_id = $1", [failing]);
check("failure is recorded for retry", failJob.attempts === 1 && /simulated/.test(failJob.last_error) && failJob.executed_at === null);
const health = await as("service_role", null, async () => (await rows("select public.deletion_health() as h"))[0].h);
check("deletion_health() reports the failing job", health.failing === 1 && health.scheduler.scheduled === false);
await db.exec("drop trigger lf_test_fail on public.child_profiles;");
await as("service_role", null, () => db.query("select public.purge_due_deletions()"));
check("failed job succeeds on the next run", !(await exists(failing)));
const after = await as("service_role", null, async () => (await rows("select public.deletion_health() as h"))[0].h);
check("no failing or overdue jobs remain", after.failing === 0 && after.overdue === 0);
await as("authenticated", B, () =>
  expectError("parents cannot read deletion health", () => db.query("select public.deletion_health()"), /permission denied/));
await as("anon", null, () =>
  expectError("anonymous visitors cannot run the purge", () => db.query("select public.purge_due_deletions()"), /permission denied/));

console.log("\nFounder Academy content (Phase 3)");
const [counts] = await rows(`select
  (select count(*)::int from public.modules) modules, (select count(*)::int from public.lessons) lessons,
  (select count(*)::int from public.lesson_activities) activities, (select count(*)::int from public.quiz_questions) questions,
  (select count(*)::int from public.achievements) achievements, (select count(*)::int from public.certificate_types) certs,
  (select count(*)::int from public.quiz_questions q where (select count(*) from public.quiz_options o where o.question_id = q.id and o.is_correct) <> 1) bad_questions`);
check("curriculum seeded: 6 modules, 18 lessons, 18 activities, 30 questions",
  counts.modules === 6 && counts.lessons === 18 && counts.activities === 18 && counts.questions === 30, JSON.stringify(counts));
check("every quiz question has exactly one correct option", counts.bad_questions === 0);
check("15 achievements and 2 credential milestones seeded", counts.achievements === 15 && counts.certs === 2);
for (const role of ["anon", "authenticated"]) {
  await as(role, role === "anon" ? null : B, async () => {
    check(`${role} can read lessons and activity prompts`, (await rows("select l.key, a.config from public.lessons l join public.lesson_activities a on a.lesson_id = l.id")).length === 18);
    await expectError(`${role} cannot read activity answer keys`, () => db.query("select answer_key from public.lesson_activities"), /permission denied/);
    await expectError(`${role} cannot read quiz explanations before scoring`, () => db.query("select explanation from public.quiz_questions"), /permission denied/);
    await expectError(`${role} cannot read option feedback`, () => db.query("select feedback from public.quiz_options"), /permission denied/);
  });
}

console.log("\nLessons, activities & quizzes (Phase 3)");
const solution = async (lessonKey) => {
  const [a] = await rows("select a.key, a.kind, a.answer_key from public.lesson_activities a join public.lessons l on l.id = a.lesson_id where l.key = $1", [lessonKey]);
  const response = a.kind === "choose" ? { selected: a.answer_key.correct }
    : a.kind === "sort" ? { placements: a.answer_key.placements } : { value: a.answer_key.answer };
  return { key: a.key, kind: a.kind, response, answerKey: a.answer_key };
};
const fn = async (sql, params) => (await rows(sql, params))[0].r;
const submitActivity = (key, response) => fn("select public.submit_lesson_activity($1, $2::jsonb) as r", [key, JSON.stringify(response)]);
const completeLesson = (key) => fn("select public.complete_lesson($1) as r", [key]);
const correctAnswers = async (moduleKey) => Object.fromEntries((await rows(
  `select q.id::text qid, o.id::text oid from public.quiz_questions q join public.quizzes z on z.id = q.quiz_id
   join public.modules m on m.id = z.module_id join public.quiz_options o on o.question_id = q.id and o.is_correct where m.key = $1`, [moduleKey])).map((r) => [r.qid, r.oid]));
const wrongAnswers = async (moduleKey) => Object.fromEntries((await rows(
  `select distinct on (q.id) q.id::text qid, o.id::text oid from public.quiz_questions q join public.quizzes z on z.id = q.quiz_id
   join public.modules m on m.id = z.module_id join public.quiz_options o on o.question_id = q.id and not o.is_correct where m.key = $1`, [moduleKey])).map((r) => [r.qid, r.oid]));
const lessonKeys = async (moduleKey) => (await rows(
  "select l.key from public.lessons l join public.modules m on m.id = l.module_id where m.key = $1 order by l.position", [moduleKey])).map((r) => r.key);
// Answer keys are read up front as the superuser — clients can never read them.
const moduleKeys = (await rows("select key from public.modules order by position")).map((r) => r.key);
const plan = {};
for (const m of moduleKeys) {
  const keys = await lessonKeys(m);
  plan[m] = { lessons: await Promise.all(keys.map(async (k) => ({ key: k, ...(await solution(k)) }))), right: await correctAnswers(m) };
}
const m1 = "think-like-a-founder";
const [l1, l2] = await lessonKeys(m1);
const s1 = await solution(l1);
const m1Right = await correctAnswers(m1);
const m1Wrong = await wrongAnswers(m1);

await as("authenticated", B, async () => {
  check("activities need active Child Mode", (await submitActivity(s1.key, s1.response)).status === "not_in_child_mode");
  check("lesson completion needs active Child Mode", (await completeLesson(l1)).status === "not_in_child_mode");
  await expectError("progress cannot be written directly by clients", () =>
    db.query("insert into public.lesson_progress (child_id, lesson_id, status, completed_at) select $1, id, 'completed', now() from public.lessons limit 1", [childB]), /permission denied/);
  await expectError("activity results cannot be written directly", () =>
    db.query("insert into public.activity_responses (child_id, activity_id, response, is_correct) select $1, id, '{}', true from public.lesson_activities limit 1", [childB]), /permission denied/);
  await expectError("achievements cannot be granted by clients", () =>
    db.query("insert into public.child_achievements (child_id, achievement_id, source_event) select $1, id, 'forged' from public.achievements limit 1", [childB]), /permission denied/);
  await expectError("internal achievement evaluation is not callable", () =>
    db.query("select public.evaluate_achievements($1, 'x')", [childB]), /permission denied/);
  await db.query("select public.set_adult_pin('2580')");
  check("B enters Child Mode", (await fn("select public.enter_child_mode($1) as r", [childB])) === "ok");

  check("lesson 2 is locked until lesson 1 is complete", (await completeLesson(l2)).status === "locked");
  check("lesson cannot be completed before its activity is solved", (await completeLesson(l1)).status === "activity_required");
  check("malformed activity responses are rejected", (await submitActivity(s1.key, { selected: ["x"] })).status === "invalid");
  const wrong = await submitActivity(s1.key, { selected: [1] });
  check("wrong activity answer gets a hint, not the explanation", wrong.status === "ok" && wrong.correct === false && wrong.hint === null && wrong.explanation === null && wrong.feedback.length === 1);
  const right = await submitActivity(s1.key, s1.response);
  check("correct activity answer is accepted with an explanation", right.correct === true && typeof right.explanation === "string");
  const done = await completeLesson(l1);
  check("lesson completes and awards First Steps", done.status === "ok" && done.achievements.includes("first-steps"), JSON.stringify(done));
  check("re-completing a lesson awards nothing new", (await completeLesson(l1)).achievements.length === 0);
  check("quiz is locked until the module's lessons are done", (await fn("select public.submit_quiz($1, $2::jsonb) as r", [m1, JSON.stringify(m1Right)])).status === "locked");
  for (const s of plan[m1].lessons.slice(1)) {
    await submitActivity(s.key, s.response);
    await completeLesson(s.key.replace(/-activity$/, ""));
  }
  check("module lessons recorded as completed", (await rows("select count(*)::int n from public.lesson_progress where child_id = $1 and status = 'completed'", [childB]))[0].n === 3);

  const partial = Object.fromEntries(Object.entries(m1Right).slice(0, 2));
  check("incomplete quiz submissions are rejected", (await fn("select public.submit_quiz($1, $2::jsonb) as r", [m1, JSON.stringify(partial)])).status === "incomplete");
  const forged = Object.fromEntries(Object.keys(m1Right).map((q, i, all) => [q, m1Right[all[(i + 1) % all.length]]]));
  check("options from other questions are rejected", (await fn("select public.submit_quiz($1, $2::jsonb) as r", [m1, JSON.stringify(forged)])).status === "incomplete");
  await expectError("clients cannot write quiz scores directly", () =>
    db.query("insert into public.quiz_attempts (child_id, quiz_id, score, passed) select $1, id, 100, true from public.quizzes limit 1", [childB]), /permission denied/);
  const fail = await fn("select public.submit_quiz($1, $2::jsonb) as r", [m1, JSON.stringify(m1Wrong)]);
  check("all-wrong quiz scores 0 on the server and does not pass", fail.score === 0 && fail.passed === false && fail.results.length === 5);
  check("scored results include the correct answer and explanation", fail.results.every((r) => r.correct_option_id && r.explanation && r.is_correct === false));
  check("failed quiz awards no module badge", !fail.achievements.includes("problem-spotter"));
  const pass = await fn("select public.submit_quiz($1, $2::jsonb) as r", [m1, JSON.stringify(m1Right)]);
  check("all-correct quiz scores 100 and passes", pass.score === 100 && pass.passed === true);
  check("passing awards Problem Spotter and Quiz Whiz", ["problem-spotter", "quiz-whiz"].every((k) => pass.achievements.includes(k)), JSON.stringify(pass.achievements));
  const review = await fn("select public.quiz_review($1) as r", [m1]);
  check("quiz review returns the latest stored attempt", review.status === "ok" && review.score === 100 && review.correct === 5);
  check("both attempts stored", (await rows("select count(*)::int n from public.quiz_attempts where child_id = $1", [childB]))[0].n === 2);
});

await as("authenticated", A, async () => {
  check("another family cannot see B's progress, attempts or badges",
    (await rows("select 1 from public.lesson_progress union all select 1 from public.quiz_attempts union all select 1 from public.child_achievements")).length === 0);
  check("A cannot review B's quiz (not in Child Mode)", (await fn("select public.quiz_review($1) as r", [m1])).status === "not_in_child_mode");
});
await as("anon", null, () =>
  expectError("anonymous visitors cannot submit quizzes", () => db.query("select public.submit_quiz('x', '{}')"), /permission denied/));

await as("authenticated", B, async () => {
  for (const m of moduleKeys.filter((k) => k !== m1)) {
    for (const s of plan[m].lessons) {
      await submitActivity(s.key, s.response);
      await completeLesson(s.key.replace(/-activity$/, ""));
    }
    await fn("select public.submit_quiz($1, $2::jsonb) as r", [m, JSON.stringify(plan[m].right)]);
  }
  const earned = (await rows("select a.key from public.child_achievements ca join public.achievements a on a.id = ca.achievement_id where ca.child_id = $1", [childB])).map((r) => r.key);
  check("completing the Academy awards all 11 Academy badges", earned.length === 11 && earned.includes("academy-graduate") && earned.includes("young-investor-scholar") && !earned.includes("idea-spark"), earned.join(","));
  const certs = await rows("select verification_code from public.certificates where child_id = $1", [childB]);
  check("Academy completion issues one learning-milestone certificate", certs.length === 1 && /^[0-9a-f]{24}$/.test(certs[0].verification_code));
  check("exit Child Mode", (await fn("select public.exit_child_mode('2580') as r")) === "ok");
});

console.log("\nIdea Lab (Phase 4)");
const saveIdea = (id, fields, step = null, finish = false) =>
  fn("select public.save_idea($1, $2::jsonb, $3::smallint, $4) as r", [id, JSON.stringify(fields), step, finish]);
const completeIdea = {
  problem_category: "pets", problem: "Pets get bored when everyone is out", problem_who: "Families with dogs",
  problem_frequency: "daily", solution_type: "product", solution: "A puzzle feeder made from recycled boxes",
  solution_benefit: "Keeps dogs busy and happy", target_customer_tags: ["pet-owners", "families"], buyer: "parents",
  target_customer_note: "", name: "Puzzle Pup", icon_key: "paw", value_statement: "Puzzle Pup keeps bored dogs busy",
  special_tags: ["eco-friendly", "more-fun"], first_step: "prototype",
};
// A sibling's idea in the same family (seeded directly) and another family's idea.
const siblingIdea = (await rows("insert into public.startup_projects (child_id, name) values ($1, 'Sibling idea') returning id", [restored]))[0].id;
const otherFamilyIdea = (await rows("select id from public.startup_projects where child_id = $1 limit 1", [childA]))[0].id;

await as("authenticated", B, async () => {
  check("saving an idea needs active Child Mode", (await saveIdea(null, { problem: "x" })).status === "not_in_child_mode");
  await expectError("ideas cannot be inserted directly", () =>
    db.query("insert into public.startup_projects (child_id, name) values ($1, 'Direct')", [childB]), /permission denied/);
  await expectError("ideas cannot be deleted directly", () =>
    db.query("delete from public.startup_projects where child_id = $1", [childB]), /permission denied/);
  check("B enters Child Mode for Phase 4", (await fn("select public.enter_child_mode($1) as r", [childB])) === "ok");

  const before = (await rows("select count(*)::int n from public.startup_projects")).at(0).n;
  check("unknown fields are rejected", (await saveIdea(null, { child_id: childA, problem: "x" })).status === "invalid");
  check("values outside the preset lists are rejected", (await saveIdea(null, { problem_category: "weapons" })).status === "invalid");
  check("over-long text is rejected", (await saveIdea(null, { problem: "x".repeat(201) })).status === "invalid");
  check("rejected saves create nothing", (await rows("select count(*)::int n from public.startup_projects")).at(0).n === before);

  const draft = await saveIdea(null, { problem_category: "pets", problem: "Pets get bored" }, 2);
  check("a draft is created for the active child (no child id sent)", draft.status === "ok" && draft.created === true && draft.idea_status === "draft");
  const [row] = await rows("select child_id, wizard_step, name from public.startup_projects where id = $1", [draft.id]);
  check("draft belongs to the child in Child Mode and remembers its step", row.child_id === childB && row.wizard_step === 2 && row.name === "My new idea");
  check("an incomplete idea cannot be marked as created", (await saveIdea(draft.id, { solution: "A toy" }, 6, true)).status === "incomplete");
  check("it stays a draft", (await rows("select status from public.startup_projects where id = $1", [draft.id]))[0].status === "draft");
  const done = await saveIdea(draft.id, completeIdea, 6, true);
  check("a complete idea is created", done.status === "ok" && done.idea_status === "ready");
  check("creating the first idea awards Idea Spark", done.achievements.includes("idea-spark"), JSON.stringify(done.achievements));
  check("editing a created idea keeps it created", (await saveIdea(draft.id, { name: "Puzzle Pup 2" }, 4)).idea_status === "ready");
  check("a created idea cannot be emptied", (await saveIdea(draft.id, { problem: "" }, 1)).status === "incomplete");
  check("a sibling's idea cannot be edited from this child's Child Mode", (await saveIdea(siblingIdea, { name: "Hijack" })).status === "not_found");
  check("another family's idea cannot be edited", (await saveIdea(otherFamilyIdea, { name: "Hijack" })).status === "not_found");
  check("another family's idea cannot be deleted", (await fn("select public.delete_idea($1) as r", [otherFamilyIdea])).status === "not_found");
  for (let i = 0; i < 9; i++) await saveIdea(null, { name: `Demo draft ${i}` });
  check("the 11th active idea is refused (limit 10)", (await saveIdea(null, { name: "One too many" })).status === "limit_reached");
  check("a deleted idea is gone", (await fn("select public.delete_idea($1) as r", [draft.id])).status === "ok" &&
    (await rows("select 1 from public.startup_projects where id = $1", [draft.id])).length === 0);
  check("after deleting, a new idea fits again", (await saveIdea(null, { name: "Fits again" })).status === "ok");
  check("Idea Spark stays earned after deleting the idea",
    (await rows("select 1 from public.child_achievements ca join public.achievements a on a.id = ca.achievement_id where ca.child_id = $1 and a.key = 'idea-spark'", [childB])).length === 1);
  check("exit Child Mode (Phase 4)", (await fn("select public.exit_child_mode('2580') as r")) === "ok");
});
await as("authenticated", A, async () => {
  check("another family cannot read B's ideas", (await rows("select 1 from public.startup_projects where child_id = $1", [childB])).length === 0);
});
await as("anon", null, () =>
  expectError("anonymous visitors cannot save ideas", () => db.query("select public.save_idea(null, '{}')"), /permission denied/));

console.log("\nStartup Simulator: calculation model (Phase 5)");
const [eco] = await rows("select id, demand_params as p from public.simulator_scenarios where key = 'ecobottle'");
check("EcoBottle and My idea challenges are seeded with a 1,000 FB budget",
  (await rows("select key from public.simulator_scenarios where starting_budget = 1000 order by key")).map((r) => r.key).join() === "ecobottle,my-idea");
// Independent reference implementation of docs/STARTUP_SIMULATOR.md (not shared with the app).
const PRICES = [6, 8, 10, 12, 15];
const QUANTITIES = [50, 100, 150, 200, 250];
const INTEREST = { 6: 160, 8: 130, 10: 100, 12: 70, 15: 40 };
const MARKETING = { none: [0, 0], posters: [50, 20], "fair-stall": [100, 45], radio: [200, 80] };
const reference = (price, quantity, mk) => {
  const [mCost, reach] = MARKETING[mk];
  const total = quantity * 4 + mCost;
  if (total > 1000) return { status: "over_budget", total_cost: total, over_by: total - 1000 };
  const interested = INTEREST[price] + reach;
  const sold = Math.min(quantity, interested);
  const revenue = sold * price;
  return { status: "ok", interested, units_sold: sold, unsold: quantity - sold, revenue, production_cost: quantity * 4,
    marketing_cost: mCost, total_cost: total, profit: revenue - total, cash_remaining: 1000 - total + revenue };
};
const outcome = async (price, quantity, mk) =>
  (await rows("select public.simulator_outcome($1::jsonb, $2, $3, $4) as r", [JSON.stringify(eco.p), price, quantity, mk]))[0].r;
let comboMismatches = [];
let combos = 0, overBudget = 0, cashIsBudgetPlusProfit = true, soldWithinBounds = true, flagsConsistent = true;
for (const price of PRICES) for (const quantity of QUANTITIES) for (const mk of Object.keys(MARKETING)) {
  combos++;
  const got = await outcome(price, quantity, mk);
  const want = reference(price, quantity, mk);
  const keys = want.status === "ok" ? Object.keys(want) : ["status", "total_cost", "over_by"];
  if (keys.some((k) => got[k] !== want[k])) comboMismatches.push(`${price}/${quantity}/${mk}`);
  if (got.status === "over_budget") { overBudget++; continue; }
  if (got.cash_remaining - got.profit !== 1000) cashIsBudgetPlusProfit = false;
  if (got.units_sold > quantity || got.units_sold > got.interested) soldWithinBounds = false;
  const fb = got.feedback;
  if ((got.interested > quantity) !== fb.includes("sold-out") || (quantity > got.interested) !== fb.includes("leftover")
      || fb[0] !== got.outcome || (got.profit > 0 ? "profit" : got.profit < 0 ? "loss" : "break-even") !== got.outcome) flagsConsistent = false;
}
check("all 100 predefined option combinations match the documented formulas", combos === 100 && comboMismatches.length === 0, comboMismatches.slice(0, 5).join(" "));
check("exactly the 15 combinations costing over 1,000 FB are refused as over budget", overBudget === 15);
check("cash remaining = starting budget + profit (never shown as profit)", cashIsBudgetPlusProfit);
check("units sold never exceed bottles made or interested customers", soldWithinBounds);
check("outcome and sold-out / leftover feedback are consistent", flagsConsistent);
const ex1 = await outcome(10, 100, "posters");
check("worked example: 10 FB × 100 bottles + posters → 550 FB profit, 1,550 FB cash",
  ex1.units_sold === 100 && ex1.revenue === 1000 && ex1.total_cost === 450 && ex1.profit === 550 && ex1.cash_remaining === 1550 && ex1.feedback.includes("sold-out"));
const ex2 = await outcome(15, 250, "none");
check("worked example: 15 FB × 250 bottles → 40 sold, 400 FB loss, 600 FB cash",
  ex2.units_sold === 40 && ex2.profit === -400 && ex2.cash_remaining === 600 && ex2.outcome === "loss" && ex2.feedback.includes("leftover") && ex2.feedback.includes("price-high"));
const ex3 = await outcome(6, 200, "radio");
check("worked example: 6 FB × 200 bottles + radio → sold out, 200 FB profit",
  ex3.interested === 240 && ex3.units_sold === 200 && ex3.profit === 200 && ex3.feedback.includes("price-low") && ex3.feedback.includes("marketing-paid-off"));
const ex4 = await outcome(12, 50, "radio");
check("marketing that brings no extra sales is flagged as not worth it", ex4.units_sold === 50 && ex4.feedback.includes("marketing-not-worth-it"));
const ex5 = await outcome(10, 250, "posters");
check("over-budget result explains by how much", ex5.status === "over_budget" && ex5.total_cost === 1050 && ex5.over_by === 50);
for (const [label, args] of [["price not on the list", [7, 100, "none"]], ["quantity not on the list", [10, 75, "none"]],
  ["unknown marketing", [10, 100, "tv-advert"]], ["missing values", [null, 100, "none"]], ["negative quantity", [10, -50, "none"]]]) {
  check(`invalid input refused: ${label}`, (await outcome(...args)).status === "invalid");
}

console.log("\nStartup Simulator: attempts & security (Phase 5)");
const runSim = (id, price, quantity, mk) => fn("select public.run_simulation($1, $2, $3, $4) as r", [id, price, quantity, mk]);
const startSim = (key, project = null) => fn("select public.start_simulation($1, $2) as r", [key, project]);
// Give B's child one created idea to simulate (seeded directly; Idea Lab writes go through save_idea).
await db.query(`update public.startup_projects set problem_category = 'pets', problem = 'Pets get bored', solution_type = 'product',
  solution = 'A puzzle feeder', target_customer_tags = '{pet-owners}', buyer = 'parents', value_statement = 'Keeps dogs busy',
  status = 'ready' where id = $1`, [projectB]);
await as("authenticated", B, async () => {
  check("starting a simulation needs active Child Mode", (await startSim("ecobottle")).status === "not_in_child_mode");
  await expectError("sessions cannot be inserted directly", () =>
    db.query("insert into public.simulator_sessions (child_id, scenario_id, seed, starting_budget) values ($1, $2, 0, 1000000)", [childB, eco.id]), /permission denied/);
  check("B enters Child Mode for Phase 5", (await fn("select public.enter_child_mode($1) as r", [childB])) === "ok");
  const s1 = await startSim("ecobottle");
  check("EcoBottle attempt starts for the active child", s1.status === "ok" && s1.resumed === false);
  check("starting again resumes the unfinished attempt", (await startSim("ecobottle")).id === s1.id);
  check("EcoBottle cannot be tied to a project", (await startSim("ecobottle", projectB)).status === "invalid");
  check("My idea needs one of the child's created ideas", (await startSim("my-idea")).status === "idea_required");
  check("another family's idea cannot be used", (await startSim("my-idea", otherFamilyIdea)).status === "idea_required");
  check("a sibling's idea cannot be used", (await startSim("my-idea", siblingIdea)).status === "idea_required");
  const ideaRun = await startSim("my-idea", projectB);
  check("My idea attempt starts from the child's own created idea", ideaRun.status === "ok");
  const [sessRow] = await rows("select child_id, starting_budget from public.simulator_sessions where id = $1", [s1.id]);
  check("session belongs to the active child with the 1,000 FB budget", sessRow.child_id === childB && sessRow.starting_budget === 1000);
  check("valid draft choices are saved", (await fn("select public.save_simulation_draft($1, $2::jsonb) as r", [s1.id, JSON.stringify({ price: 10, quantity: 100, step: 3 })])).status === "ok");
  check("draft values outside the options are refused", (await fn("select public.save_simulation_draft($1, $2::jsonb) as r", [s1.id, JSON.stringify({ price: 7 })])).status === "invalid");
  check("unknown draft fields are refused", (await fn("select public.save_simulation_draft($1, $2::jsonb) as r", [s1.id, JSON.stringify({ budget: 999999 })])).status === "invalid");
  check("spending beyond the budget is refused", (await runSim(s1.id, 15, 250, "radio")).status === "over_budget");
  check("manipulated price is refused", (await runSim(s1.id, 1000, 100, "none")).status === "invalid");
  check("manipulated quantity is refused", (await runSim(s1.id, 10, 1, "none")).status === "invalid");
  check("refused runs leave the attempt open", (await rows("select status from public.simulator_sessions where id = $1", [s1.id]))[0].status === "active");
  check("reflection waits until the attempt is complete", (await fn("select public.set_simulation_reflection($1, 'price') as r", [s1.id])).status === "not_completed");
  const r1 = await runSim(s1.id, 10, 100, "posters");
  check("a valid run completes with server-calculated results", r1.status === "ok" && r1.profit === 550 && r1.cash_remaining === 1550);
  check("the first completed run awards First Business Run", r1.achievements.includes("first-business-run"), JSON.stringify(r1.achievements));
  const [stored] = await rows("select s.status, s.final_summary, r.units_sold, r.revenue::int, r.profit::int, r.budget_after::int, r.feedback_keys from public.simulator_sessions s join public.simulator_rounds r on r.session_id = s.id where s.id = $1", [s1.id]);
  check("results are stored on the attempt and its round", stored.status === "completed" && stored.final_summary.profit === 550 && stored.units_sold === 100 && stored.revenue === 1000 && stored.profit === 550 && stored.budget_after === 1550);
  check("a completed attempt cannot be run again", (await runSim(s1.id, 6, 50, "none")).status === "already_completed");
  check("a completed attempt's draft cannot be changed", (await fn("select public.save_simulation_draft($1, $2::jsonb) as r", [s1.id, JSON.stringify({ price: 6 })])).status === "already_completed");
  check("reflection choices are validated", (await fn("select public.set_simulation_reflection($1, 'my phone number') as r", [s1.id])).status === "invalid");
  check("the reflection is saved", (await fn("select public.set_simulation_reflection($1, 'price') as r", [s1.id])).status === "ok");
  check("the reflection cannot be changed afterwards", (await fn("select public.set_simulation_reflection($1, 'same') as r", [s1.id])).status === "already_answered");
  await expectError("clients cannot update attempts directly", () =>
    db.query("update public.simulator_sessions set final_summary = '{}' where id = $1", [s1.id]), /permission denied/);
  const s2 = await startSim("ecobottle");
  check("a new attempt starts after completing one", s2.status === "ok" && s2.id !== s1.id && s2.resumed === false);
  const r2 = await runSim(s2.id, 15, 250, "none");
  check("a loss is reported as a loss", r2.status === "ok" && r2.profit === -400 && r2.outcome === "loss");
  check("repeat attempts don't award duplicate badges", r2.achievements.length === 0 &&
    (await rows("select count(*)::int n from public.child_achievements ca join public.achievements a on a.id = ca.achievement_id where ca.child_id = $1 and a.key = 'first-business-run'", [childB]))[0].n === 1);
  check("both attempts are kept for comparison", (await rows("select count(*)::int n from public.simulator_sessions where child_id = $1 and status = 'completed'", [childB]))[0].n === 2);
  check("exit Child Mode (Phase 5)", (await fn("select public.exit_child_mode('2580') as r")) === "ok");
  check("the parent can read their child's simulation history (read-only)", (await rows("select id from public.simulator_sessions where child_id = $1", [childB])).length === 3);
  globalThis.__s1 = s1.id;
});
await expectError("completed attempts are immutable even for the server", () =>
  db.query("update public.simulator_sessions set final_summary = '{\"profit\": 999999}' where id = $1", [globalThis.__s1]), /cannot be changed/);
await expectError("stored round results are immutable", () =>
  db.query("update public.simulator_rounds set profit = 999999 where session_id = $1", [globalThis.__s1]), /cannot be changed/);
check("the reflection survives (no silent changes)", (await rows("select reflection from public.simulator_sessions where id = $1", [globalThis.__s1]))[0].reflection === "price");
await as("authenticated", A, async () => {
  check("another family cannot read B's simulations", (await rows("select 1 from public.simulator_sessions union all select 1 from public.simulator_rounds")).length === 0);
  check("another family cannot run B's attempt outside Child Mode", (await runSim(globalThis.__s1, 10, 100, "none")).status === "not_in_child_mode");
});
await db.query("insert into public.simulator_sessions (child_id, scenario_id, seed, starting_budget, status) select $1, $2, 0, 1000, 'abandoned' from generate_series(1, 20)", [childB, eco.id]);
await as("authenticated", B, async () => {
  await db.query("select public.enter_child_mode($1)", [childB]);
  check("starting attempts is rate-limited (20 per hour)", (await startSim("ecobottle")).status === "rate_limited");
  await db.query("select public.exit_child_mode('2580')");
});
await as("anon", null, () =>
  expectError("anonymous visitors cannot run simulations", () => db.query("select public.run_simulation(gen_random_uuid(), 10, 100, 'none')"), /permission denied/));

console.log("\nPitch Studio & Investor Room: rules match the app (Phase 6)");
const { pitchPrivacyIssue, earnsOwnWordsBonus } = await import("../src/content/pitch-studio.ts");
const privacySamples = [
  ["Email me at kid@example.com", true], ["Call 0123 456 7890", true], ["Text +44 7700 900123", true],
  ["See www.puzzlepup.test", true], ["Visit https://example.org/shop", true], ["Find us at puzzlepup.com", true],
  ["I live at 12 Oak Street", true], ["Follow @puzzlepup for updates", true],
  ["We'd sell 100 feeders for 10 FB each", false], ["Dogs get bored when everyone is out", false],
  ["It costs 4 FB to make, e.g. cardboard", false], ["Mr. Lee's class would love it", false], ["", false],
];
const privacyMismatch = [];
for (const [text, expected] of privacySamples) {
  const sql = (await rows("select public.pitch_personal_info($1) as r", [text]))[0].r;
  if (sql !== expected || Boolean(pitchPrivacyIssue(text)) !== expected) privacyMismatch.push(text);
}
check("personal-details check flags emails, phones, links, addresses and handles (database = app)", privacyMismatch.length === 0, privacyMismatch.join(" | "));
const bonusSamples = [
  ["", 0], ["It keeps dogs busy", 0], ["dogs dogs dogs dogs dogs dogs", 0], ["12 34 56 78 90 11", 0],
  ["I asked eight dog owners and six said yes", 1], ["one two three four five six", 1], ["a a b b c c d", 1],
];
const bonusMismatch = [];
for (const [text, expected] of bonusSamples) {
  const sql = (await rows("select public.own_words_bonus($1) as r", [text]))[0].r;
  if (sql !== expected || (earnsOwnWordsBonus(text) ? 1 : 0) !== expected) bonusMismatch.push(text || "(empty)");
}
check("own-words bonus rule (6+ words, 4+ different) matches in the database and the app", bonusMismatch.length === 0, bonusMismatch.join(" | "));
const [bank] = await rows(`select (select count(*)::int from public.investor_personas) personas,
  (select count(*)::int from public.investor_questions) questions,
  (select count(*)::int from public.investor_personas p where (select string_agg(q.section, ',' order by q.position) from public.investor_questions q where q.persona_id = p.id)
     <> 'problem,solution,customer,business_model,ask') bad_personas,
  (select count(*)::int from public.investor_questions q where (select count(*) from public.investor_answer_options o where o.question_id = q.id and o.score = 3) <> 1
     or (select count(*) from public.investor_answer_options o where o.question_id = q.id) <> 3) bad_questions`);
check("4 pretend investors seeded, each asking one question per rubric criterion", bank.personas === 4 && bank.questions === 20 && bank.bad_personas === 0);
check("every investor question has 3 answers with exactly one strong answer", bank.bad_questions === 0);
for (const role of ["anon", "authenticated"]) {
  await as(role, role === "anon" ? null : B, async () => {
    check(`${role} can read personas, questions and answer labels`,
      (await rows("select o.label from public.investor_answer_options o join public.investor_questions q on q.id = o.question_id")).length === 60);
    await expectError(`${role} cannot read investor answer scores`, () => db.query("select score from public.investor_answer_options"), /permission denied/);
    await expectError(`${role} cannot read investor feedback before answering`, () => db.query("select feedback from public.investor_answer_options"), /permission denied/);
  });
}

console.log("\nPitch Studio: building, versions & security (Phase 6)");
const startPitch = (project, prefill = {}) => fn("select public.start_pitch($1, $2::jsonb) as r", [project, JSON.stringify(prefill)]);
const savePitch = (id, fields, step = null, finish = false) =>
  fn("select public.save_pitch($1, $2::jsonb, $3::smallint, $4) as r", [id, JSON.stringify(fields), step, finish]);
const startPractice = (deck, persona) => fn("select public.start_investor_practice($1, $2) as r", [deck, persona]);
const answer = (sess, q, o, note = "") => fn("select public.answer_investor_question($1, $2, $3, $4) as r", [sess, q, o, note]);
const badgeCount = async (key) => (await rows(
  "select count(*)::int n from public.child_achievements ca join public.achievements a on a.id = ca.achievement_id where ca.child_id = $1 and a.key = $2", [childB, key]))[0].n;
// Answer keys are read up front as the superuser — clients can never read them.
const answerKey = async (persona) => (await rows(
  `select q.id::text qid, q.section, json_agg(json_build_object('id', o.id, 'score', o.score) order by o.position) opts
   from public.investor_questions q join public.investor_personas p on p.id = q.persona_id
   join public.investor_answer_options o on o.question_id = q.id where p.key = $1 group by q.id, q.section, q.position order by q.position`, [persona]));
const penny = await answerKey("penny");
const ivy = await answerKey("ivy");
const opt = (q, score) => q.opts.find((o) => o.score === score).id;
const draftIdeaB = (await rows("select id from public.startup_projects where child_id = $1 and status = 'draft' limit 1", [childB]))[0].id;
const prefill = {
  title: "Plant Pals", tagline: "Plant Pals keeps pets busy", icon_key: "paw", problem: "Pets get bored when everyone is out",
  problem_extra: "Who has it: families with dogs.", solution: "", business_model: "Parents or carers would pay for it.",
};
const fullPitch = {
  solution: "A puzzle feeder made from recycled boxes", customer: "Pet owners and families with busy days",
  business_model: "We sell each feeder for more than it costs to make", ask: "Test ten feeders with friends' dogs",
};
let deck, practice1;
await as("authenticated", B, async () => {
  check("starting a pitch needs active Child Mode", (await startPitch(projectB)).status === "not_in_child_mode");
  await expectError("pitch decks cannot be inserted directly", () =>
    db.query("insert into public.pitch_decks (child_id, project_id, title) values ($1, $2, 'Direct')", [childB, projectB]), /permission denied/);
  await expectError("pitch versions cannot be written directly", () =>
    db.query("insert into public.pitch_versions (deck_id, child_id, version, snapshot) values (gen_random_uuid(), $1, 1, '{}')", [childB]), /permission denied/);
  await expectError("practice results cannot be written directly", () =>
    db.query("insert into public.investor_sessions (child_id, deck_id, persona_id, pitch_version_id, deck_snapshot) values ($1, gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), '{}')", [childB]), /permission denied/);
  check("B enters Child Mode for Phase 6", (await fn("select public.enter_child_mode($1) as r", [childB])) === "ok");

  check("another family's idea cannot be pitched", (await startPitch(otherFamilyIdea)).status === "idea_required");
  check("a sibling's idea cannot be pitched", (await startPitch(siblingIdea)).status === "idea_required");
  check("a prefill containing a phone number is refused", (await startPitch(projectB, { problem: "Call 0123 456 7890" })).status === "personal_info");
  check("a prefill with unknown fields is refused", (await startPitch(projectB, { child_id: childA })).status === "invalid");
  check("refused starts create nothing", (await rows("select count(*)::int n from public.pitch_decks")).at(0).n === 0);
  const started = await startPitch(projectB, prefill);
  deck = started.id;
  check("a pitch starts from the child's own Idea Lab idea", started.status === "ok" && started.resumed === false);
  const [d] = await rows("select child_id, project_id, status, title, tagline, icon_key from public.pitch_decks where id = $1", [deck]);
  const slides = await rows("select section, content from public.pitch_slides where deck_id = $1 order by position", [deck]);
  check("the pitch belongs to the active child and is linked to the idea", d.child_id === childB && d.project_id === projectB && d.status === "draft");
  check("five section slides are created with the prefilled content",
    slides.map((s) => s.section).join() === "problem,solution,customer,business_model,ask" && d.title === "Plant Pals" && d.icon_key === "paw" &&
    slides[0].content.main === prefill.problem && slides[0].content.extra === prefill.problem_extra && slides[3].content.main === prefill.business_model);
  check("starting again for the same idea resumes the same pitch", (await startPitch(projectB, prefill)).id === deck);

  check("over-long section text is refused", (await savePitch(deck, { problem: "x".repeat(281) })).status === "invalid");
  check("over-long extra text is refused", (await savePitch(deck, { problem_extra: "x".repeat(201) })).status === "invalid");
  check("contact details are refused (email)", (await savePitch(deck, { solution: "Email a@b.co to order" })).status === "personal_info");
  check("links are refused", (await savePitch(deck, { tagline: "See puzzlepup.com" })).status === "personal_info");
  check("unknown fields are refused (e.g. child_id)", (await savePitch(deck, { child_id: childA })).status === "invalid");
  check("non-text values are refused", (await savePitch(deck, { problem: 5 })).status === "invalid");
  check("icons and colours must be on the preset lists", (await savePitch(deck, { icon_key: "skull" })).status === "invalid" &&
    (await savePitch(deck, { theme_key: "neon" })).status === "invalid");
  check("steps outside 1–6 are refused", (await savePitch(deck, {}, 7)).status === "invalid");
  const saved = await savePitch(deck, { solution: fullPitch.solution }, 3);
  check("a draft section saves and remembers the step", saved.status === "ok" && saved.deck_status === "draft" &&
    (await rows("select builder_step from public.pitch_decks where id = $1", [deck]))[0].builder_step === 3);
  const incomplete = await savePitch(deck, {}, 6, true);
  check("finishing needs every required section", incomplete.status === "incomplete" &&
    incomplete.missing.join() === "customer" && !incomplete.missing.includes("ask"));
  check("finishing an incomplete pitch creates no version", (await rows("select count(*)::int n from public.pitch_versions where deck_id = $1", [deck]))[0].n === 0);
  check("progress is kept after a refused finish", (await rows("select content->>'main' m from public.pitch_slides where deck_id = $1 and section = 'solution'", [deck]))[0].m === fullPitch.solution);
  check("a too-short required answer still counts as missing", (await savePitch(deck, { customer: "Kids" }, 6, true)).missing?.join() === "customer");
  check("practice needs a finished pitch", (await startPractice(deck, "penny")).status === "pitch_not_finished");
  const done = await savePitch(deck, { ...fullPitch, ask: "" }, 6, true);
  check("a complete pitch finishes as version 1 (the optional section can be empty)", done.status === "ok" && done.version === 1 && done.deck_status === "ready");
  check("the first finished pitch awards First Pitch", done.achievements.includes("first-pitch"), JSON.stringify(done.achievements));
  const again = await savePitch(deck, {}, 6, true);
  check("finishing again without changes adds no version or badge", again.version === 1 && again.achievements.length === 0 &&
    (await rows("select count(*)::int n from public.pitch_versions where deck_id = $1", [deck]))[0].n === 1);

  check("unknown pretend investors are refused", (await startPractice(deck, "dragon")).status === "invalid");
  const p1 = await startPractice(deck, "penny");
  practice1 = p1.id;
  check("a practice starts with Penny on version 1", p1.status === "ok" && p1.resumed === false);
  check("starting again resumes the unfinished practice", (await startPractice(deck, "penny")).id === practice1);
  const [sess] = await rows("select child_id, question_ids, deck_snapshot, decision from public.investor_sessions where id = $1", [practice1]);
  check("the practice asks Penny's 5 questions in order and keeps a copy of the pitch",
    sess.child_id === childB && sess.question_ids.join() === penny.map((q) => q.qid).join() && sess.deck_snapshot.version === 1 &&
    sess.deck_snapshot.sections.solution.main === fullPitch.solution && sess.decision === null);
  check("questions must be answered in order", (await answer(practice1, penny[1].qid, opt(penny[1], 3))).status === "out_of_order");
  check("another investor's question is refused", (await answer(practice1, ivy[0].qid, opt(ivy[0], 3))).status === "invalid");
  check("an answer from a different question is refused", (await answer(practice1, penny[0].qid, opt(penny[1], 3))).status === "invalid");
  check("personal details in a typed answer are refused", (await answer(practice1, penny[0].qid, opt(penny[0], 3), "Ring me on 07700 900123")).status === "personal_info");
  check("over-long typed answers are refused", (await answer(practice1, penny[0].qid, opt(penny[0], 3), "word ".repeat(45))).status === "invalid");
  check("refused answers store nothing", (await rows("select count(*)::int n from public.investor_responses where session_id = $1", [practice1]))[0].n === 0);
  const a1 = await answer(practice1, penny[0].qid, opt(penny[0], 3), "I asked eight dog owners and six said yes");
  check("a strong answer with own words scores 3 + 1 bonus, with feedback", a1.status === "ok" && a1.score === 3 && a1.bonus === 1 && a1.feedback.length > 0 && a1.stronger === null && a1.completed === false);
  check("an answered question cannot be answered again", (await answer(practice1, penny[0].qid, opt(penny[0], 0))).status === "out_of_order");
  const a2 = await answer(practice1, penny[1].qid, opt(penny[1], 1));
  check("a partial answer scores 1 and shows a stronger answer", a2.score === 1 && a2.bonus === 0 && typeof a2.stronger === "string");
  const a3 = await answer(practice1, penny[2].qid, opt(penny[2], 0), "dogs dogs dogs dogs dogs dogs");
  check("repeating one word doesn't earn the own-words bonus", a3.score === 0 && a3.bonus === 0);
  await answer(practice1, penny[3].qid, opt(penny[3], 3), "my price is more than the cost to make");
  const a5 = await answer(practice1, penny[4].qid, opt(penny[4], 3));
  // Independent reference: criteria 4, 1, 0, 4, 3 → 12 of 20 points → 60 → "promising".
  check("the last answer completes the practice with the documented rubric score",
    a5.completed === true && a5.points === 12 && a5.total_score === 60 && a5.band === "promising" &&
    JSON.stringify(a5.sub_scores) === JSON.stringify({ ask: 3, problem: 4, customer: 0, solution: 1, business_model: 4 }), JSON.stringify(a5));
  check("the first completed practice awards Confident Founder", a5.achievements.includes("confident-founder"), JSON.stringify(a5.achievements));
  const [stored] = await rows("select points, total_score, band, tips_keys, sub_scores, decision, completed_at from public.investor_sessions where id = $1", [practice1]);
  check("the result is stored with improvement tips for weaker criteria",
    stored.points === 12 && stored.total_score === 60 && stored.tips_keys.join() === "solution,customer,own-words" && stored.completed_at !== null);
  check("pretend investors never record an investment decision", stored.decision === null);
  const reviews = await rows("select score, bonus, note, review from public.investor_responses where session_id = $1 order by created_at", [practice1]);
  check("each answer keeps its question, choice and feedback for history",
    reviews.length === 5 && reviews.every((r) => r.review.prompt && r.review.answer && r.review.feedback) && reviews[0].note.startsWith("I asked"));
  check("a completed practice cannot be answered again", (await answer(practice1, penny[4].qid, opt(penny[4], 3))).status === "already_completed");
  await expectError("clients cannot change practice results", () =>
    db.query("update public.investor_sessions set total_score = 100 where id = $1", [practice1]), /permission denied/);
  await expectError("clients cannot change pitch slides directly", () =>
    db.query("update public.pitch_slides set content = '{}' where deck_id = $1", [deck]), /permission denied/);

  // Revising a finished pitch.
  const edit = await savePitch(deck, { problem: "Dogs chew things when they're bored at home" }, 1);
  check("editing a finished pitch marks it as revising (no silent overwrite)", edit.deck_status === "draft" && edit.version === 1);
  const [v1] = await rows("select snapshot from public.pitch_versions where deck_id = $1 and version = 1", [deck]);
  check("version 1 keeps the original content", v1.snapshot.sections.problem.main === prefill.problem);
  check("the earlier practice keeps its score and its copy of version 1",
    (await rows("select total_score, deck_snapshot->'sections'->'problem'->>'main' p from public.investor_sessions where id = $1", [practice1]))
      .every((r) => r.total_score === 60 && r.p === prefill.problem));
  check("undoing the edit makes the pitch completed again", (await savePitch(deck, { problem: prefill.problem }, 1)).deck_status === "ready");
  await savePitch(deck, { problem: "Dogs chew things when they're bored at home" }, 6);
  const v2 = await savePitch(deck, {}, 6, true);
  check("finishing the revision saves version 2", v2.status === "ok" && v2.version === 2 && v2.achievements.length === 0);
  check("both versions are kept", (await rows("select version from public.pitch_versions where deck_id = $1 order by version", [deck])).map((r) => r.version).join() === "1,2");
  const p2 = await startPractice(deck, "penny");
  check("a new practice uses the latest version", p2.id !== practice1 && p2.resumed === false &&
    (await rows("select deck_snapshot->>'version' v from public.investor_sessions where id = $1", [p2.id]))[0].v === "2");
  const note = "I explained this part clearly with my own words";
  for (const q of penny) await answer(p2.id, q.qid, opt(q, 3), note);
  const [best] = await rows("select points, total_score, band, tips_keys from public.investor_sessions where id = $1", [p2.id]);
  check("all strong answers with own words score 20/20 → 100, Ready to grow, no tips", best.points === 20 && best.total_score === 100 && best.band === "ready_to_grow" && best.tips_keys.length === 0);
  check("repeat pitches and practices don't award duplicate badges", (await badgeCount("first-pitch")) === 1 && (await badgeCount("confident-founder")) === 1);
  check("both practices are kept as history", (await rows("select count(*)::int n from public.investor_sessions where deck_id = $1 and completed_at is not null", [deck]))[0].n === 2);
  const unfinished = await startPractice(deck, "sam");
  globalThis.__unfinished = unfinished.id;

  const otherDeck = await startPitch(draftIdeaB, {});
  check("a pitch can start from a draft idea too", otherDeck.status === "ok" && otherDeck.id !== deck);
  check("an unfinished pitch can't be practised", (await startPractice(otherDeck.id, "ivy")).status === "pitch_not_finished");
  check("exit Child Mode (Phase 6)", (await fn("select public.exit_child_mode('2580') as r")) === "ok");
  check("a parent outside Child Mode cannot edit pitches", (await savePitch(deck, { problem: "Hijack attempt here" })).status === "not_in_child_mode");
  check("the parent can read the child's pitch, versions and practice (read-only)",
    (await rows("select 1 from public.pitch_decks where child_id = $1", [childB])).length === 2 &&
    (await rows("select 1 from public.pitch_versions where deck_id = $1", [deck])).length === 2 &&
    (await rows("select 1 from public.investor_responses r join public.investor_sessions s on s.id = r.session_id where s.deck_id = $1", [deck])).length === 10);
});

// A sibling's pitch in the same family and another family's pitch (seeded directly).
const siblingDeck = (await rows("insert into public.pitch_decks (child_id, title) values ($1, 'Sibling pitch') returning id", [restored]))[0].id;
const otherFamilyDeck = (await rows("insert into public.pitch_decks (child_id, title) values ($1, 'Other pitch') returning id", [childA]))[0].id;
await as("authenticated", B, async () => {
  await db.query("select public.enter_child_mode($1)", [childB]);
  check("a sibling's pitch cannot be edited from this child's Child Mode", (await savePitch(siblingDeck, { problem: "Hijack attempt here" })).status === "not_found");
  check("a sibling's pitch cannot be practised", (await startPractice(siblingDeck, "penny")).status === "not_found");
  check("another family's pitch cannot be edited", (await savePitch(otherFamilyDeck, { problem: "Hijack attempt here" })).status === "not_found");
  check("another family's pitch cannot be practised", (await startPractice(otherFamilyDeck, "penny")).status === "not_found");
  await db.query("select public.exit_child_mode('2580')");
});
await as("authenticated", A, async () => {
  check("another family cannot read B's pitches, versions or practice",
    (await rows(`select 1 from public.pitch_decks where child_id = $1 union all select 1 from public.pitch_versions
                 union all select 1 from public.pitch_slides s join public.pitch_decks d on d.id = s.deck_id where d.child_id = $1
                 union all select 1 from public.investor_sessions union all select 1 from public.investor_responses`, [childB])).length === 0);
  await db.query("select public.enter_child_mode($1)", [childA]);
  check("another family cannot answer B's practice from their own Child Mode", (await answer(globalThis.__unfinished, penny[0].qid, opt(penny[0], 3))).status === "not_found");
  check("another family cannot start practice on B's pitch", (await startPractice(deck, "penny")).status === "not_found");
  await db.query("select public.exit_child_mode('3691')");
});
await expectError("finished pitch versions are immutable even for the server", () =>
  db.query("update public.pitch_versions set snapshot = '{}' where deck_id = $1", [deck]), /cannot be changed/);
await expectError("completed practice results are immutable even for the server", () =>
  db.query("update public.investor_sessions set total_score = 100 where id = $1", [practice1]), /cannot be changed/);
await expectError("stored answers are immutable", () =>
  db.query("update public.investor_responses set score = 3 where session_id = $1", [practice1]), /cannot be changed/);
await expectError("pretend investors can never record an investment decision", () =>
  db.query("update public.investor_sessions set decision = 'invest' where id = $1", [globalThis.__unfinished]), /no_decisions|check constraint/);
await db.query(`insert into public.investor_sessions (child_id, deck_id, persona_id, pitch_version_id, deck_snapshot)
  select $1, $2, (select id from public.investor_personas where key = 'ivy'), (select id from public.pitch_versions where deck_id = $2 and version = 2), '{}'
  from generate_series(1, 20)`, [childB, deck]);
await as("authenticated", B, async () => {
  await db.query("select public.enter_child_mode($1)", [childB]);
  check("starting practices is rate-limited (20 per hour)", (await startPractice(deck, "captain")).status === "rate_limited");
  await db.query("select public.exit_child_mode('2580')");
});
await as("anon", null, async () => {
  await expectError("anonymous visitors cannot start pitches", () => db.query("select public.start_pitch(gen_random_uuid())"), /permission denied/);
  await expectError("anonymous visitors cannot read pitches", () => db.query("select * from public.pitch_versions"), /permission denied/);
});

console.log("\nHardening: parent-only writes are refused during Child Mode (Phase 7)");
await as("authenticated", B, async () => {
  await db.query("select public.enter_child_mode($1)", [childB]);
  await expectError("Child Mode cannot record consent directly", () =>
    db.query(`insert into public.consent_records (guardian_id, consent_type, notice_version, typed_name) values ($1, 'core_processing', 'x', 'Child')`, [B]),
    /row-level security/);
  check("Child Mode cannot rename or remove profiles directly",
    (await rows("update public.child_profiles set nickname = 'Hacked', deleted_at = now() where id = $1 returning id", [childB])).length === 0);
  check("Child Mode cannot change the parent account directly",
    (await rows("update public.adult_accounts set display_name = 'Hacked' where id = $1 returning id", [B])).length === 0);
  await expectError("Child Mode cannot add a child profile directly", () =>
    db.query(`insert into public.child_profiles (guardian_id, nickname, age_band, is_demo) values ($1, 'Sneaky', '10-11', true)`, [B]),
    /row-level security/);
  check("Child Mode cannot turn on credential anchoring", (await fn("select public.set_credential_anchoring($1, true, 'Demo Parent B', 'credentials-2026-11-v1') as r", [childB])).status === "child_mode_active");
  await db.query("select public.exit_child_mode('2580')");
  check("outside Child Mode the parent can still rename the profile",
    (await rows("update public.child_profiles set nickname = 'Demo Ben' where id = $1 returning id", [childB])).length === 1);
  await expectError("anchoring consent cannot be inserted directly (even by the parent)", () =>
    db.query(`insert into public.consent_records (guardian_id, child_id, consent_type, notice_version, typed_name) values ($1, $2, 'onchain_credential', 'x', 'Demo Parent B')`, [B, childB]),
    /row-level security/);
  await expectError("credentials_opt_in cannot be set directly", () =>
    db.query("update public.child_profiles set credentials_opt_in = true where id = $1", [childB]), /permission denied/);
});
check("the real-child-data gate is still off", (await rows("select real_child_data_enabled r from public.app_settings"))[0].r === false &&
  (await rows("select count(*)::int n from public.child_profiles where not is_demo"))[0].n === 0);

console.log("\nCredentials: canonical form & hashing (Phase 7)");
const { canonicalJson, credentialHash, credentialProof } = await import("../src/lib/credentials/canonical.ts");
const canonSamples = [
  { b: 1, a: { d: [3, 1, { z: true, y: null }], c: "x" } },
  { "é": "café ☕", Z: "quote \" backslash \\ slash /", a: "tab\tnewline\ncontrol\u0001" },
  { credentialId: "00000000-0000-4000-8000-000000000000", evidence: {}, formatVersion: 1, issuedAt: "2026-11-06T12:00:00Z", list: [] },
];
const canonMismatch = [];
for (const doc of canonSamples) {
  const [r] = await rows("select public.canonical_json($1::jsonb) c, public.credential_hash_of($1::jsonb) h", [JSON.stringify(doc)]);
  if (r.c !== canonicalJson(doc) || r.h !== credentialHash(doc)) canonMismatch.push(`${r.c} ≠ ${canonicalJson(doc)}`);
}
check("canonical JSON and SHA-256 hash are identical in the database and the app", canonMismatch.length === 0, canonMismatch.join(" | "));
check("canonical form sorts keys and removes whitespace", canonicalJson(canonSamples[0]) === '{"a":{"c":"x","d":[3,1,{"y":null,"z":true}]},"b":1}');
await expectError("non-integer numbers are refused by the canonical form", () => db.query("select public.canonical_json('{\"x\": 1.5}'::jsonb)"), /only integers/);

console.log("\nCredentials: issuance from verified progress (Phase 7)");
const credsB = await rows(`select c.*, t.key type_key, s.salt from public.certificates c join public.certificate_types t on t.id = c.certificate_type_id
  join public.credential_secrets s on s.certificate_id = c.id where c.child_id = $1 order by t.key`, [childB]);
const academyCred = credsB.find((c) => c.type_key === "founder-academy-milestone");
const pitchCred = credsB.find((c) => c.type_key === "pitch-ready");
check("Academy completion and a 70+ practice issued exactly two credentials", credsB.length === 2 && academyCred && pitchCred, credsB.map((c) => c.type_key).join());
check("the Academy credential records verified evidence", academyCred.evidence.modulesCompleted === 6 && academyCred.evidence.lessonsCompleted === 18 && academyCred.evidence.quizzesPassed === 6);
check("the Pitch Ready credential records the qualifying practice", pitchCred.evidence.practiceScore === 100 && pitchCred.evidence.minimumScore === 70 && pitchCred.evidence.pitchVersion === 2);
check("each credential document has id, type, title, issuer, issue time, evidence and the offchain subject",
  credsB.every((c) => c.document.credentialId === c.id && c.document.type === c.type_key && c.document.issuer === "Little Founders" &&
    c.document.subject === childB && c.document.formatVersion === 1 && c.document.issuedAt === new Date(c.issued_at).toISOString().replace(".000Z", "Z")));
check("the stored hash matches an independent recomputation of the document", credsB.every((c) => c.credential_hash === credentialHash(c.document)));
check("each credential has its own 32-byte random salt", credsB.every((c) => c.salt.length === 32) && Buffer.compare(Buffer.from(credsB[0].salt), Buffer.from(credsB[1].salt)) !== 0);
check("a child who hasn't earned them has no credentials", (await rows("select 1 from public.certificates where child_id = $1", [restored])).length === 0);
await db.query("select public.evaluate_achievements($1, 'recheck')", [childB]);
check("re-evaluating progress never issues a duplicate", (await rows("select count(*)::int n from public.certificates where child_id = $1", [childB]))[0].n === 2);
await expectError("issued credential documents are immutable even for the server", () =>
  db.query("update public.certificates set document = document || '{\"title\":\"Forged\"}' where id = $1", [academyCred.id]), /cannot be changed/);
await expectError("credential salts are immutable", () =>
  db.query("update public.credential_secrets set salt = extensions.gen_random_bytes(32) where certificate_id = $1", [academyCred.id]), /cannot be changed/);
await as("authenticated", B, async () => {
  const mine = await rows("select id, credential_hash, verification_code from public.certificates where child_id = $1", [childB]);
  check("the parent can read their child's credentials", mine.length === 2);
  await expectError("salts are never readable by clients", () => db.query("select salt from public.credential_secrets"), /permission denied/);
  await expectError("credentials cannot be issued by clients", () =>
    db.query("insert into public.certificates (child_id, certificate_type_id, verification_code, evidence, document, credential_hash) select $1, id, 'abcdefabcdef12', '{}', '{}', repeat('a', 64) from public.certificate_types limit 1", [childB]), /permission denied/);
  await expectError("credential internals are not callable", () => db.query("select public.issue_credential($1, gen_random_uuid(), '{}')", [childB]), /permission denied/);
  await expectError("salted proofs are not callable by clients", () => db.query("select public.credential_proof($1)", [academyCred.id]), /permission denied/);
});
await as("authenticated", A, async () => {
  check("another family cannot read B's credentials", (await rows("select 1 from public.certificates union all select 1 from public.credential_issuances")).length === 0);
});

console.log("\nCredentials: parent consent for anchoring (Phase 7)");
const setAnchoring = (child, enable, name = null, version = null) =>
  fn("select public.set_credential_anchoring($1, $2, $3, $4) as r", [child, enable, name, version]);
await as("authenticated", A, async () => {
  check("another family cannot change B's anchoring setting", (await setAnchoring(childB, true, "Intruder", "credentials-2026-11-v1")).status === "not_found");
});
await as("authenticated", B, async () => {
  check("anchoring is off by default", (await rows("select credentials_opt_in from public.child_profiles where id = $1", [childB]))[0].credentials_opt_in === false &&
    (await rows("select 1 from public.credential_issuances")).length === 0);
  check("turning it on needs the typed name", (await setAnchoring(childB, true, "", "credentials-2026-11-v1")).status === "invalid");
  check("turning it on needs the current notice version", (await setAnchoring(childB, true, "Demo Parent B", "old-notice")).status === "invalid");
  const on = await setAnchoring(childB, true, "Demo Parent B", "credentials-2026-11-v1");
  check("the parent turns anchoring on and both eligible credentials are queued", on.status === "ok" && on.queued === 2);
  const [rec] = await rows("select consent_type, child_id, notice_version, typed_name, granted_at, withdrawn_at from public.consent_records where consent_type = 'onchain_credential'");
  check("the explicit choice is recorded with a timestamp, separate from core consent",
    rec.child_id === childB && rec.notice_version === "credentials-2026-11-v1" && rec.typed_name === "Demo Parent B" && rec.granted_at && rec.withdrawn_at === null);
  check("turning it on twice doesn't duplicate the consent", (await setAnchoring(childB, true, "Demo Parent B", "credentials-2026-11-v1")).already === true &&
    (await rows("select count(*)::int n from public.consent_records where consent_type = 'onchain_credential'"))[0].n === 1);
  check("queued records are pending with nothing sent yet",
    (await rows("select status, tx_hash from public.credential_issuances")).every((r) => r.status === "pending" && r.tx_hash === null));
  await expectError("clients cannot write anchoring records", () =>
    db.query("update public.credential_issuances set status = 'confirmed'"), /permission denied/);
  await expectError("parents cannot run the anchoring worker", () => db.query("select public.claim_credential_anchor_jobs(5)"), /permission denied/);
  await expectError("parents cannot record anchoring results", () =>
    db.query("select public.record_credential_anchor(gen_random_uuid(), 'confirmed', '{}')"), /permission denied/);
});
await as("anon", null, async () => {
  await expectError("anonymous visitors cannot change anchoring", () => db.query("select public.set_credential_anchoring(gen_random_uuid(), true)"), /permission denied/);
  await expectError("anonymous visitors cannot run the worker", () => db.query("select public.claim_credential_anchor_jobs(1)"), /permission denied/);
});

console.log("\nCredentials: anchoring state machine (Phase 7; simulated chain values, no network)");
const fakeHex = (n) => `0x${String(n).repeat(64).slice(0, 64)}`;
const claimed = await as("service_role", null, async () => (await rows("select public.claim_credential_anchor_jobs(5) as r"))[0].r);
const expectedProofs = Object.fromEntries(credsB.map((c) => [c.id, credentialProof(c.credential_hash, c.salt)]));
check("the worker gets both jobs with the salted proof (= SHA-256(hash || salt), checked independently)",
  claimed.length === 2 && claimed.every((j) => j.status === "pending" && j.proof === expectedProofs[j.certificate_id]));
check("the proof sent on-chain contains only a type key and a 32-byte value — no child data",
  claimed.every((j) => /^0x[0-9a-f]{64}$/.test(j.proof) && !JSON.stringify(j).includes(childB) && !/Demo Ben/.test(JSON.stringify(j))));
check("claimed jobs are leased so a second worker can't double-send", (await as("service_role", null, async () => (await rows("select public.claim_credential_anchor_jobs(5) as r"))[0].r)).length === 0);
const rec = (id, outcome, details) => as("service_role", null, async () =>
  (await rows("select public.record_credential_anchor($1, $2, $3::jsonb) as r", [id, outcome, JSON.stringify(details)]))[0].r);
const [jobA, jobP] = [claimed.find((j) => j.credential_type === "founder-academy-milestone"), claimed.find((j) => j.credential_type === "pitch-ready")];
const issuer = "0x1111111111111111111111111111111111111111";
const schemaUidFake = fakeHex("c");
check("a record cannot jump from queued to confirmed", (await rec(jobA.id, "confirmed", { tx_hash: fakeHex("a") })).status === "invalid_transition");
check("a submission with the wrong proof is refused", (await rec(jobA.id, "submitted", { tx_hash: fakeHex("a"), raw_tx: "0x02ab", nonce: 7, issuer_address: issuer, schema_uid: schemaUidFake, proof: fakeHex("9") })).status === "proof_mismatch");
check("the tx hash is stored before broadcasting", (await rec(jobA.id, "submitted", { tx_hash: fakeHex("a"), raw_tx: "0x02ab", nonce: 7, issuer_address: issuer, schema_uid: schemaUidFake, proof: jobA.proof })).status === "ok");
check("a submitted record can't be submitted again (no duplicate transaction)", (await rec(jobA.id, "submitted", { tx_hash: fakeHex("b"), raw_tx: "0x02cd", nonce: 8, proof: jobA.proof })).status === "invalid_transition");
check("confirmation must match the stored transaction and proof", (await rec(jobA.id, "confirmed", { tx_hash: fakeHex("b"), attestation_uid: fakeHex("d"), block_number: 1, schema_uid: schemaUidFake, proof: jobA.proof })).status === "proof_mismatch");
check("a verified attestation marks the record confirmed", (await rec(jobA.id, "confirmed", { tx_hash: fakeHex("a"), attestation_uid: fakeHex("d"), block_number: 123, schema_uid: schemaUidFake, proof: jobA.proof })).status === "ok");
check("a confirmed record can't be marked failed", (await rec(jobA.id, "failed", { error: "x" })).status === "invalid_transition");
await expectError("confirmed anchoring records are immutable", () =>
  db.query("update public.credential_issuances set tx_hash = $2 where id = $1", [jobA.id, fakeHex("e")]), /cannot be changed/);
check("a failed attempt keeps the offchain credential valid", (await rec(jobP.id, "failed", { error: "simulated RPC failure" })).status === "ok" &&
  (await rows("select status from public.certificates where id = $1", [jobP.certificate_id]))[0].status === "active");
await as("authenticated", B, async () => {
  check("the parent can ask for a retry", (await fn("select public.retry_credential_anchoring($1) as r", [jobP.certificate_id])).status === "ok");
  check("only failed records can be retried", (await fn("select public.retry_credential_anchoring($1) as r", [jobA.certificate_id])).status === "not_retryable");
});

console.log("\nCredentials: public verification (Phase 7)");
const verify = (code) => as("anon", null, async () => (await rows("select public.verify_credential($1) as r", [code]))[0].r);
const vA = await verify(academyCred.verification_code);
check("verification confirms a valid credential with a matching hash", vA.status === "valid" && vA.integrity.hash_matches === true && vA.credential.title === "Founder Academy Learning Milestone");
check("verification shows the recorded anchor and that its proof matches", vA.anchor?.status === "confirmed" && vA.anchor.proof_matches === true && vA.anchor.tx_hash === fakeHex("a"));
const exposed = JSON.stringify(vA);
check("verification exposes no child id, nickname, salt, hash or evidence",
  !exposed.includes(childB) && !/Demo Ben/.test(exposed) && !exposed.includes(academyCred.credential_hash) && !/salt|evidence|subject|modulesCompleted/.test(exposed));
check("a queued (unsent) proof is not shown publicly", (await verify(pitchCred.verification_code)).anchor === null);
check("unknown and malformed codes reveal nothing", (await verify("zzzzzzzzzzzzzzzzzzzzzzzz")).status === "not_found" && (await verify("'; drop table x; --")).status === "not_found");
await db.exec(`set session_replication_role = replica;
  update public.certificates set document = jsonb_set(document, '{title}', '"Forged title"') where id = '${pitchCred.id}';
  set session_replication_role = default;`);
check("a tampered record fails the integrity check", (await verify(pitchCred.verification_code)).status === "integrity_failed");
await db.exec(`set session_replication_role = replica;
  update public.certificates set document = jsonb_set(document, '{title}', to_jsonb('Pitch Ready Learning Milestone'::text)) where id = '${pitchCred.id}';
  set session_replication_role = default;`);
check("restoring the original data passes again", (await verify(pitchCred.verification_code)).status === "valid");

console.log("\nCredentials: withdrawing consent (Phase 7)");
await as("authenticated", B, async () => {
  const off = await setAnchoring(childB, false);
  check("withdrawing reports that one proof is already public", off.status === "ok" && off.withdrawn === true && off.already_public === 1);
  check("the consent record is marked withdrawn (not deleted)",
    (await rows("select withdrawn_at from public.consent_records where consent_type = 'onchain_credential'")).every((r) => r.withdrawn_at !== null));
  check("not-yet-sent proofs are cancelled; the confirmed one is kept",
    (await rows("select status from public.credential_issuances order by status")).map((r) => r.status).join() === "cancelled,confirmed");
  check("retry is refused without consent", (await fn("select public.retry_credential_anchoring($1) as r", [jobP.certificate_id])).status === "consent_required");
});
check("the worker picks up nothing after withdrawal", (await as("service_role", null, async () => (await rows("select public.claim_credential_anchor_jobs(5) as r"))[0].r)).length === 0);
check("both credentials stay valid after withdrawal", (await verify(academyCred.verification_code)).status === "valid" && (await verify(pitchCred.verification_code)).status === "valid");
check("withdrawal is in the audit log", (await rows("select 1 from public.audit_log where action = 'consent.withdrawn.onchain_credential' and target_id = $1", [childB])).length === 1);
await as("authenticated", B, async () => {
  const again = await setAnchoring(childB, true, "Demo Parent B", "credentials-2026-11-v1");
  check("turning it back on re-queues only the cancelled proof", again.status === "ok" && again.queued === 1 &&
    (await rows("select status from public.credential_issuances order by status")).map((r) => r.status).join() === "confirmed,pending");
  await setAnchoring(childB, false);
});

console.log("\nOne-click demo accounts (0012)");
const hashOf = (c) => c.repeat(64);
await as("authenticated", B, async () => {
  check("a normal parent is not a demo account", (await rows("select public.is_demo_account() as r"))[0].r === false);
  for (const [label, sql] of [["check demo limits", "select public.demo_account_allowed($1)"], ["register demo accounts", "select public.register_demo_account(gen_random_uuid(), $1)"]]) {
    await expectError(`parents cannot ${label}`, () => db.query(sql, [hashOf("a")]), /permission denied/);
  }
  await expectError("parents cannot run the demo purge", () => db.query("select public.purge_expired_demo_accounts()"), /permission denied/);
  await expectError("demo account records are not readable by clients", () => db.query("select * from public.demo_accounts"), /permission denied/);
});
await as("anon", null, () =>
  expectError("anonymous visitors cannot register demo accounts", () => db.query("select public.register_demo_account(gen_random_uuid(), $1)", [hashOf("a")]), /permission denied/));
const demoUser = async (email) => {
  const id = (await rows("insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id", [email]))[0].id;
  return id;
};
const svc = async (sql, params) => as("service_role", null, async () => (await rows(sql, params))[0].r);
const D1 = await demoUser("demo-1@example.test");
check("a new demo account is registered", (await svc("select public.register_demo_account($1, $2) as r", [D1, hashOf("b")])) === "ok");
check("a malformed visitor hash is refused", (await svc("select public.register_demo_account($1, $2) as r", [D1, "not-a-hash"])) === "invalid");
check("an unknown user can't be registered", (await svc("select public.register_demo_account(gen_random_uuid(), $1) as r", [hashOf("b")])) === "not_found");
await db.query("update public.adult_accounts set created_at = now() - interval '1 hour' where id = $1", [B]);
check("an existing (older) account can't be turned into a demo account", (await svc("select public.register_demo_account($1, $2) as r", [B, hashOf("b")])) === "too_old");
await as("authenticated", D1, async () => {
  check("the demo parent is recognised as a demo account", (await rows("select public.is_demo_account() as r"))[0].r === true);
});
for (const email of ["demo-2@example.test", "demo-3@example.test"]) {
  await svc("select public.register_demo_account($1, $2) as r", [await demoUser(email), hashOf("b")]);
}
check("3 demo accounts per visitor per hour", (await svc("select public.demo_account_allowed($1) as r", [hashOf("b")])) === "rate_limited");
check("another visitor can still make one", (await svc("select public.demo_account_allowed($1) as r", [hashOf("c")])) === "ok");
await db.query(`insert into public.consent_records (guardian_id, consent_type, notice_version, typed_name) values ($1, 'core_processing', 'demo-account', 'Demo Parent')`, [D1]);
const demoKid = (await rows(`insert into public.child_profiles (guardian_id, nickname, age_band, is_demo) values ($1, 'Demo Nova', '10-11', true) returning id`, [D1]))[0].id;
await db.query("update public.demo_accounts set expires_at = now() - interval '1 minute' where user_id = $1", [D1]);
const purgedDemo = await svc("select public.purge_expired_demo_accounts() as r");
check("expired demo accounts are purged (only the expired one)", purgedDemo === 1, String(purgedDemo));
check("the purge removes the demo parent, consent and child",
  (await rows("select 1 from auth.users where id = $1 union all select 1 from public.adult_accounts where id = $1 union all select 1 from public.consent_records where guardian_id = $1 union all select 1 from public.child_profiles where id = $2", [D1, demoKid])).length === 0);
check("unexpired demo accounts and real parents are untouched",
  (await rows("select count(*)::int n from public.demo_accounts"))[0].n === 2 && (await rows("select 1 from public.adult_accounts where id = $1", [B])).length === 1);
check("the purge is in the audit log", (await rows("select 1 from public.audit_log where action = 'demo.purged' and target_id = $1", [D1])).length === 1);

console.log("\nDeletion");
await db.query("delete from public.child_profiles where id = $1", [childA]); // server/service path
check("deleting a child cascades to all their projects",
  (await rows("select count(*)::int as n from public.startup_projects where child_id = $1", [childA]))[0].n === 0);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
