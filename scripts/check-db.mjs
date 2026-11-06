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
    /foreign key|row-level security/,
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
check("12 achievements and 1 milestone certificate seeded", counts.achievements === 12 && counts.certs === 1);
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

console.log("\nDeletion");
await db.query("delete from public.child_profiles where id = $1", [childA]); // server/service path
check("deleting a child cascades to all their projects",
  (await rows("select count(*)::int as n from public.startup_projects where child_id = $1", [childA]))[0].n === 0);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
