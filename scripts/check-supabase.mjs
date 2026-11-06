// End-to-end security checks against a REAL Supabase project (Auth + PostgREST + RLS).
// Creates two fictional parent accounts, exercises the Phase 2 rules through the same
// public API the app uses, then deletes everything it created.
//
// Requires in .env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
// SUPABASE_SECRET_KEY (used only here, to create/delete the test users).
// Usage: npm run db:check:remote

import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !publishable || !secret) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or SUPABASE_SECRET_KEY.");
  process.exit(2);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secret, opts);
const anon = createClient(url, publishable, opts);

let passed = 0;
let failed = 0;
function check(name, ok, detail = "") {
  if (ok) passed++;
  else failed++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}
const denied = (res) => Boolean(res.error) || (Array.isArray(res.data) && res.data.length === 0);

const run = randomBytes(4).toString("hex");
const users = [];
const purgeTargets = [];

async function makeParent(label) {
  const email = `lf-test-${run}-${label}@example.com`;
  const password = randomBytes(18).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`createUser failed: ${error.message}`);
  users.push(data.user.id);
  const client = createClient(url, publishable, opts);
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`signIn failed: ${signIn.error.message}`);
  return { id: data.user.id, client };
}

try {
  console.log(`Run ${run} against ${new URL(url).host}\n`);
  const A = await makeParent("a");
  const B = await makeParent("b");

  console.log("Accounts & consent");
  const acct = await A.client.from("adult_accounts").select("id, display_name");
  check("signup trigger created the parent's adult_accounts row", acct.data?.length === 1 && acct.data[0].id === A.id, acct.error?.message);
  check("PIN hash column is not readable", Boolean((await A.client.from("adult_accounts").select("pin_hash")).error));

  const noConsent = await A.client.from("child_profiles").insert({ guardian_id: A.id, nickname: "Demo Ada", age_band: "10-11", is_demo: true });
  check("child profile is blocked before consent", Boolean(noConsent.error), "insert succeeded");

  for (const P of [A, B]) {
    const c = await P.client.from("consent_records").insert({
      guardian_id: P.id, consent_type: "core_processing", notice_version: "test", typed_name: "Test Parent",
    });
    if (c.error) throw new Error(`consent insert failed: ${c.error.message}`);
  }
  check("consent can be recorded", true);
  check("consent records are append-only", denied(await A.client.from("consent_records").update({ withdrawn_at: new Date().toISOString() }).eq("guardian_id", A.id).select()));

  const childA = (await A.client.from("child_profiles").insert({ guardian_id: A.id, nickname: "Demo Ada", age_band: "10-11", is_demo: true }).select("id").single()).data?.id;
  const childB = (await B.client.from("child_profiles").insert({ guardian_id: B.id, nickname: "Demo Ben", age_band: "12-13", is_demo: true }).select("id").single()).data?.id;
  check("demo child profiles can be created after consent", Boolean(childA && childB));
  check("non-demo (real) child profiles are blocked by the data gate",
    Boolean((await A.client.from("child_profiles").insert({ guardian_id: A.id, nickname: "Real", age_band: "10-11", is_demo: false })).error));
  check("is_demo cannot be flipped by the client", denied(await A.client.from("child_profiles").update({ is_demo: false }).eq("id", childA).select()));

  console.log("\nFamily isolation");
  const kidsA = await A.client.from("child_profiles").select("id");
  check("parent A sees only their own child", kidsA.data?.length === 1 && kidsA.data[0].id === childA);
  check("parent A cannot read B's child by id", (await A.client.from("child_profiles").select("id").eq("id", childB)).data?.length === 0);
  check("parent A cannot rename B's child", denied(await A.client.from("child_profiles").update({ nickname: "Hacked" }).eq("id", childB).select()));
  check("parent A cannot create a profile under B", Boolean((await A.client.from("child_profiles").insert({ guardian_id: B.id, nickname: "X", age_band: "10-11", is_demo: true })).error));
  // Projects are written only through save_idea() since Phase 4; seed one with the server key.
  const projB = (await admin.from("startup_projects").insert({ child_id: childB, name: "Demo Plant Pals" }).select("id").single()).data?.id;
  check("parents cannot insert projects directly", Boolean((await B.client.from("startup_projects").insert({ child_id: childB, name: "Direct" })).error));
  check("parent A cannot read B's projects", (await A.client.from("startup_projects").select("id")).data?.length === 0);
  check("parent A cannot add a project to B's child", Boolean((await A.client.from("startup_projects").insert({ child_id: childB, name: "Intruder" })).error));
  check("parent A cannot link a deck to B's project", Boolean((await A.client.from("pitch_decks").insert({ child_id: childA, project_id: projB, title: "Deck" })).error));
  check("quiz attempts cannot be written by clients", Boolean((await A.client.from("quiz_attempts").insert({ child_id: childA, quiz_id: childA, score: 100, passed: true })).error));

  console.log("\nParent PIN & Child Mode");
  const rpc = async (c, fn, args) => (await c.rpc(fn, args)).data;
  check("Child Mode requires a PIN first", (await rpc(A.client, "enter_child_mode", { child: childA })) === "pin_required");
  check("trivial PIN rejected", (await rpc(A.client, "set_adult_pin", { new_pin: "0000" })) === "too_simple");
  check("PIN can be set", (await rpc(A.client, "set_adult_pin", { new_pin: "2580" })) === "ok");
  check("cannot enter Child Mode for another family's child", (await rpc(A.client, "enter_child_mode", { child: childB })) === "not_found");
  check("can enter Child Mode for own child", (await rpc(A.client, "enter_child_mode", { child: childA })) === "ok");
  check("Child Mode cannot be cleared by a direct update", denied(await A.client.from("adult_accounts").update({ child_mode_child_id: null }).eq("id", A.id).select()));
  check("wrong PIN is refused", (await rpc(A.client, "exit_child_mode", { pin: "1357" })) === "wrong_pin");
  check("correct PIN leaves Child Mode", (await rpc(A.client, "exit_child_mode", { pin: "2580" })) === "ok");
  check("fresh password sign-in can reset a forgotten PIN (JWT amr claim)", (await rpc(A.client, "reset_pin_after_password_auth")) === "ok");

  console.log("\nAnonymous access");
  check("anon cannot read child profiles", denied(await anon.from("child_profiles").select("id")));
  check("anon cannot read consent records", denied(await anon.from("consent_records").select("id")));
  check("anon cannot call Child Mode functions", Boolean((await anon.rpc("enter_child_mode", { child: childA })).error));
  check("quiz answer keys are hidden", Boolean((await anon.from("quiz_options").select("is_correct")).error));
  const mods = await anon.from("modules").select("key");
  check("public curriculum is readable (seed applied)", (mods.data?.length ?? 0) === 6, mods.error?.message ?? `${mods.data?.length} modules`);

  console.log("\nRemoval & audit");
  await A.client.from("child_profiles").update({ deleted_at: new Date().toISOString() }).eq("id", childA);
  check("removed profile drops out of the family list", (await A.client.from("child_profiles").select("id").is("deleted_at", null)).data?.length === 0);
  const job = await admin.from("deletion_jobs").select("scheduled_for").eq("target_id", childA).is("executed_at", null);
  const days = job.data?.[0] ? (new Date(job.data[0].scheduled_for) - Date.now()) / 86400000 : 0;
  check("permanent deletion scheduled ~30 days out", days > 29 && days <= 30.1, job.error?.message);
  check("clients cannot run the purge", Boolean((await A.client.rpc("purge_due_deletions")).error));
  await A.client.from("child_profiles").update({ deleted_at: null }).eq("id", childA);
  check("profile can be restored in the grace period", (await A.client.from("child_profiles").select("id").is("deleted_at", null)).data?.length === 1);
  const audit = await admin.from("audit_log").select("action").eq("actor_id", A.id);
  const actions = new Set(audit.data?.map((r) => r.action));
  check("audit log captured consent, create, remove, restore, PIN",
    ["consent.granted", "child.created", "child.removed", "child.restored", "pin.set"].every((a) => actions.has(a)), [...actions].join(", "));

  console.log("\nPermanent deletion (0006)");
  const childC = (await A.client.from("child_profiles").insert({ guardian_id: A.id, nickname: "Demo Cleo", age_band: "12-13", is_demo: true }).select("id").single()).data?.id;
  purgeTargets.push(childC);
  const lemon = await admin.from("startup_projects").insert({ child_id: childC, name: "Demo Lemon Stand" }).select("id");
  check("fictional project exists before purge", lemon.data?.length === 1, lemon.error?.message);
  await A.client.from("child_profiles").update({ deleted_at: new Date().toISOString() }).eq("id", childC);
  // Simulate the 30 days passing for this fictional profile only.
  await admin.from("deletion_jobs").update({ scheduled_for: new Date(Date.now() - 60_000).toISOString() }).eq("target_id", childC);
  check("parents cannot read deletion health", Boolean((await A.client.rpc("deletion_health")).error));
  const purge = await admin.rpc("purge_due_deletions");
  check("server role can run the purge", !purge.error && purge.data >= 1, purge.error?.message ?? `purged ${purge.data}`);
  check("purged profile is permanently gone", (await admin.from("child_profiles").select("id").eq("id", childC)).data?.length === 0);
  check("purge cascaded to the child's projects", (await admin.from("startup_projects").select("id").eq("child_id", childC)).data?.length === 0);
  const doneJob = (await admin.from("deletion_jobs").select("executed_at, last_error").eq("target_id", childC)).data?.[0];
  check("deletion job marked executed", Boolean(doneJob?.executed_at) && !doneJob?.last_error);
  check("purge recorded in the audit log", (await admin.from("audit_log").select("id").eq("target_id", childC).eq("action", "child.purged")).data?.length === 1);
  const health = await admin.rpc("deletion_health");
  check("hourly purge is scheduled in pg_cron", health.data?.scheduler?.scheduled === true && health.data?.scheduler?.schedule === "17 * * * *",
    health.error?.message ?? JSON.stringify(health.data?.scheduler));
  check("no overdue or failing deletion jobs", health.data?.overdue === 0 && health.data?.failing === 0, JSON.stringify(health.data));

  console.log("\nFounder Academy (Phase 3)");
  const content = await anon.from("lessons").select("key, modules(key)").order("position");
  check("18 lessons are publicly readable", content.data?.length === 18, content.error?.message);
  check("activity answer keys are hidden", Boolean((await B.client.from("lesson_activities").select("answer_key")).error));
  check("quiz explanations are hidden before scoring", Boolean((await B.client.from("quiz_questions").select("explanation")).error));
  check("quiz correctness is hidden", Boolean((await B.client.from("quiz_options").select("is_correct")).error));

  // Answer keys via the secret key (server-only), to play as a perfect student.
  const m1 = "think-like-a-founder";
  const lessonsM1 = (await admin.from("lessons").select("id, key, position, modules!inner(key)").eq("modules.key", m1).order("position")).data ?? [];
  const solutions = {};
  for (const l of lessonsM1) {
    const a = (await admin.from("lesson_activities").select("key, kind, answer_key").eq("lesson_id", l.id).single()).data;
    solutions[l.key] = { key: a.key, response: a.kind === "choose" ? { selected: a.answer_key.correct } : a.kind === "sort" ? { placements: a.answer_key.placements } : { value: a.answer_key.answer } };
  }
  const quizQs = (await admin.from("quiz_questions").select("id, quizzes!inner(modules!inner(key)), quiz_options(id, is_correct)").eq("quizzes.modules.key", m1)).data ?? [];
  const right = Object.fromEntries(quizQs.map((q) => [q.id, q.quiz_options.find((o) => o.is_correct).id]));
  const wrong = Object.fromEntries(quizQs.map((q) => [q.id, q.quiz_options.find((o) => !o.is_correct).id]));
  const [first, second] = lessonsM1;

  const call = async (fn, args) => (await B.client.rpc(fn, args)).data;
  check("activities require Child Mode", (await call("submit_lesson_activity", { activity_key: solutions[first.key].key, response: solutions[first.key].response }))?.status === "not_in_child_mode");
  check("progress cannot be written directly", Boolean((await B.client.from("lesson_progress").insert({ child_id: childB, lesson_id: first.id, status: "completed", completed_at: new Date().toISOString() })).error));
  check("achievements cannot be written directly", Boolean((await B.client.from("child_achievements").insert({ child_id: childB, achievement_id: first.id, source_event: "forged" })).error));
  await call("set_adult_pin", { new_pin: "2580" });
  check("parent B enters Child Mode", (await call("enter_child_mode", { child: childB })) === "ok");
  check("lesson 2 is locked until lesson 1 is done", (await call("complete_lesson", { lesson_key: second.key }))?.status === "locked");
  const wrongTry = await call("submit_lesson_activity", { activity_key: solutions[first.key].key, response: { selected: [1] } });
  check("wrong activity answer is scored false with option feedback, no explanation",
    wrongTry?.correct === false && wrongTry?.feedback?.length === 1 && wrongTry?.explanation === null, JSON.stringify(wrongTry));
  check("correct activity answer is scored true", (await call("submit_lesson_activity", { activity_key: solutions[first.key].key, response: solutions[first.key].response }))?.correct === true);
  const firstDone = await call("complete_lesson", { lesson_key: first.key });
  check("completing lesson 1 awards First Steps", firstDone?.status === "ok" && firstDone.achievements.includes("first-steps"), JSON.stringify(firstDone));
  for (const l of lessonsM1.slice(1)) {
    await call("submit_lesson_activity", { activity_key: solutions[l.key].key, response: solutions[l.key].response });
    await call("complete_lesson", { lesson_key: l.key });
  }
  check("progress persisted for all module lessons", (await B.client.from("lesson_progress").select("lesson_id").eq("child_id", childB)).data?.length === lessonsM1.length);
  const failQuiz = await call("submit_quiz", { module_key: m1, answers: wrong });
  check("server scores an all-wrong quiz as 0 / not passed", failQuiz?.score === 0 && failQuiz?.passed === false, JSON.stringify(failQuiz)?.slice(0, 120));
  const passQuiz = await call("submit_quiz", { module_key: m1, answers: right });
  check("server scores an all-correct quiz as 100 / passed", passQuiz?.score === 100 && passQuiz?.passed === true);
  check("passing awards Problem Spotter + Quiz Whiz", ["problem-spotter", "quiz-whiz"].every((k) => passQuiz?.achievements?.includes(k)));
  check("quiz attempts stored (read-only to clients)", (await B.client.from("quiz_attempts").select("score").eq("child_id", childB)).data?.length === 2);
  check("quiz review returns the latest attempt", (await call("quiz_review", { module_key: m1 }))?.score === 100);
  check("another family cannot see this child's learning",
    (await A.client.from("lesson_progress").select("lesson_id")).data?.length === 0 &&
    (await A.client.from("quiz_attempts").select("id")).data?.length === 0 &&
    (await A.client.from("child_achievements").select("child_id")).data?.length === 0);
  check("anon cannot submit quizzes", Boolean((await anon.rpc("submit_quiz", { module_key: m1, answers: right })).error));
  console.log("\nIdea Lab (Phase 4)");
  const save = (id, fields, step = null, finish = false) => call("save_idea", { idea_id: id, fields, step, finish });
  const draft = await save(null, { problem_category: "pets", problem: "Pets get bored when everyone is out" }, 2);
  check("a draft idea is saved for the child in Child Mode", draft?.status === "ok" && draft.idea_status === "draft", JSON.stringify(draft));
  const stored = (await B.client.from("startup_projects").select("child_id, wizard_step").eq("id", draft?.id).single()).data;
  check("the draft belongs to the active child and remembers its step", stored?.child_id === childB && stored?.wizard_step === 2);
  check("unknown fields (e.g. child_id) are rejected", (await save(null, { child_id: childA, name: "x" }))?.status === "invalid");
  check("values outside the preset lists are rejected", (await save(draft?.id, { buyer: "investors" }))?.status === "invalid");
  check("an incomplete idea cannot be created", (await save(draft?.id, {}, 6, true))?.status === "incomplete");
  const finished = await save(draft?.id, {
    solution_type: "product", solution: "A puzzle feeder made from boxes", target_customer_tags: ["pet-owners"],
    buyer: "parents", name: "Puzzle Pup", icon_key: "paw", value_statement: "Puzzle Pup keeps bored dogs busy",
  }, 6, true);
  check("a complete idea is created and awards Idea Spark", finished?.idea_status === "ready" && finished.achievements.includes("idea-spark"), JSON.stringify(finished));
  check("a parent outside Child Mode cannot edit ideas", (await A.client.rpc("save_idea", { idea_id: draft?.id, fields: { name: "Hijack" } })).data?.status === "not_in_child_mode");
  check("another family cannot read this idea", (await A.client.from("startup_projects").select("id").eq("id", draft?.id)).data?.length === 0);
  for (let i = 0; i < 8; i++) await save(null, { name: `Demo draft ${i}` });
  check("the active-project limit (10) is enforced", (await save(null, { name: "One too many" }))?.status === "limit_reached");
  check("an idea can be deleted", (await call("delete_idea", { idea_id: draft?.id }))?.status === "ok" &&
    (await B.client.from("startup_projects").select("id").eq("id", draft?.id)).data?.length === 0);
  check("anon cannot save ideas", Boolean((await anon.rpc("save_idea", { idea_id: null, fields: {} })).error));
  check("parent B leaves Child Mode with the PIN", (await call("exit_child_mode", { pin: "2580" })) === "ok");
} catch (err) {
  failed++;
  console.error(`\n✗ Aborted: ${err.message}`);
} finally {
  for (const id of users) {
    await admin.from("audit_log").delete().eq("actor_id", id);
    await admin.from("deletion_jobs").delete().eq("requested_by", id);
    await admin.auth.admin.deleteUser(id);
  }
  for (const id of purgeTargets.filter(Boolean)) {
    await admin.from("audit_log").delete().eq("target_id", id);
    await admin.from("deletion_jobs").delete().eq("target_id", id);
  }
  console.log(`\nCleaned up ${users.length} test accounts.`);
  console.log(`${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
