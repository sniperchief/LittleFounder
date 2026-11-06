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

  console.log("\nStartup Simulator (Phase 5)");
  const scen = (await anon.from("simulator_scenarios").select("key, starting_budget").order("key")).data ?? [];
  check("EcoBottle and My idea challenges are published with a 1,000 FB budget", scen.map((s) => s.key).join() === "ecobottle,my-idea" && scen.every((s) => s.starting_budget === 1000));
  check("sessions cannot be inserted directly", Boolean((await B.client.from("simulator_sessions").insert({ child_id: childB, scenario_id: childB, seed: 0, starting_budget: 1000000 })).error));
  const runSim = (id, price, quantity, marketing_key) => call("run_simulation", { session_id: id, price, quantity, marketing_key });
  const sim = await call("start_simulation", { scenario_key: "ecobottle" });
  check("an EcoBottle attempt starts for the child in Child Mode", sim?.status === "ok" && sim.resumed === false, JSON.stringify(sim));
  check("starting again resumes the unfinished attempt", (await call("start_simulation", { scenario_key: "ecobottle" }))?.id === sim?.id);
  check("My idea needs a created idea", (await call("start_simulation", { scenario_key: "my-idea" }))?.status === "idea_required");
  check("draft choices are validated", (await call("save_simulation_draft", { session_id: sim?.id, draft: { price: 7 } }))?.status === "invalid" &&
    (await call("save_simulation_draft", { session_id: sim?.id, draft: { price: 10, step: 3 } }))?.status === "ok");
  const over = await runSim(sim?.id, 10, 250, "posters");
  check("spending beyond the budget is refused with the amount", over?.status === "over_budget" && over.over_by === 50, JSON.stringify(over));
  check("manipulated options are refused", (await runSim(sim?.id, 9999, 100, "none"))?.status === "invalid" && (await runSim(sim?.id, 10, 100, "billboard"))?.status === "invalid");
  const done = await runSim(sim?.id, 10, 100, "posters");
  check("the server calculates the documented result (550 FB profit, 1,550 FB cash)",
    done?.status === "ok" && done.units_sold === 100 && done.revenue === 1000 && done.total_cost === 450 && done.profit === 550 && done.cash_remaining === 1550);
  check("the first completed run awards First Business Run", done?.achievements?.includes("first-business-run"));
  check("a completed attempt cannot be run again", (await runSim(sim?.id, 6, 50, "none"))?.status === "already_completed");
  check("clients cannot change stored results", denied(await B.client.from("simulator_sessions").update({ final_summary: { profit: 999999 } }).eq("id", sim?.id).select()));
  check("the reflection is saved once", (await call("set_simulation_reflection", { session_id: sim?.id, reflection: "price" }))?.status === "ok" &&
    (await call("set_simulation_reflection", { session_id: sim?.id, reflection: "same" }))?.status === "already_answered");
  const sim2 = await call("start_simulation", { scenario_key: "ecobottle" });
  const loss = await runSim(sim2?.id, 15, 250, "none");
  check("a second attempt is kept separately and reports a loss", sim2?.id !== sim?.id && loss?.profit === -400 && loss?.outcome === "loss");
  check("repeat attempts don't award the badge again", loss?.achievements?.length === 0);
  const storedSims = (await B.client.from("simulator_sessions").select("id, status, final_summary, reflection").eq("child_id", childB).eq("status", "completed")).data ?? [];
  check("the parent can read both completed attempts with results", storedSims.length === 2 && storedSims.some((s) => s.final_summary?.profit === 550 && s.reflection === "price"));
  check("another family cannot read these simulations",
    (await A.client.from("simulator_sessions").select("id")).data?.length === 0 && (await A.client.from("simulator_rounds").select("id")).data?.length === 0);
  check("anon cannot run simulations", Boolean((await anon.rpc("run_simulation", { session_id: sim?.id, price: 10, quantity: 100, marketing_key: "none" })).error));

  console.log("\nPitch Studio & Investor Room (Phase 6)");
  const ideaB = (await B.client.from("startup_projects").select("id").eq("child_id", childB).limit(1).single()).data?.id;
  const savePitch = (deck_id, fields, step = null, finish = false) => call("save_pitch", { deck_id, fields, step, finish });
  check("pitch decks cannot be inserted directly", Boolean((await B.client.from("pitch_decks").insert({ child_id: childB, title: "Direct" })).error));
  const pitch = await call("start_pitch", { project_id: ideaB, prefill: { title: "Demo Puzzle Pup", problem: "Pets get bored when everyone is out" } });
  check("a pitch starts from the child's own idea with prefilled content", pitch?.status === "ok" && pitch.resumed === false &&
    (await B.client.from("pitch_slides").select("content").eq("deck_id", pitch.id).eq("section", "problem").single()).data?.content?.main === "Pets get bored when everyone is out",
    JSON.stringify(pitch));
  check("starting again for the same idea resumes it", (await call("start_pitch", { project_id: ideaB, prefill: {} }))?.id === pitch?.id);
  check("contact details and links are refused", (await savePitch(pitch?.id, { solution: "Email me at kid@example.com" }))?.status === "personal_info" &&
    (await savePitch(pitch?.id, { tagline: "www.puzzlepup.test" }))?.status === "personal_info");
  check("over-long text and unknown fields are refused", (await savePitch(pitch?.id, { problem: "x".repeat(281) }))?.status === "invalid" &&
    (await savePitch(pitch?.id, { child_id: childA }))?.status === "invalid");
  const notYet = await savePitch(pitch?.id, { solution: "A puzzle feeder made from boxes" }, 6, true);
  check("an incomplete pitch cannot be finished", notYet?.status === "incomplete" && notYet.missing?.join() === "customer,business_model", JSON.stringify(notYet));
  check("practice needs a finished pitch", (await call("start_investor_practice", { deck_id: pitch?.id, persona_key: "penny" }))?.status === "pitch_not_finished");
  const pitchDone = await savePitch(pitch?.id, { customer: "Pet owners with busy days", business_model: "Sell each feeder for more than it costs" }, 6, true);
  check("a complete pitch finishes as version 1 and awards First Pitch", pitchDone?.status === "ok" && pitchDone.version === 1 && pitchDone.achievements?.includes("first-pitch"), JSON.stringify(pitchDone));
  check("clients cannot change slides or versions directly",
    denied(await B.client.from("pitch_slides").update({ content: {} }).eq("deck_id", pitch?.id).select()) &&
    denied(await B.client.from("pitch_versions").update({ snapshot: {} }).eq("deck_id", pitch?.id).select()));
  check("investor answer scores and feedback are hidden",
    Boolean((await B.client.from("investor_answer_options").select("score")).error) && Boolean((await anon.from("investor_answer_options").select("feedback")).error));
  check("4 pretend investors are published", (await anon.from("investor_personas").select("key")).data?.length === 4);
  const pennyQs = (await admin.from("investor_questions").select("id, position, investor_personas!inner(key), investor_answer_options(id, score)")
    .eq("investor_personas.key", "penny").order("position")).data ?? [];
  const pick = (q, score) => q.investor_answer_options.find((o) => o.score === score).id;
  const practice = await call("start_investor_practice", { deck_id: pitch?.id, persona_key: "penny" });
  check("a practice starts with a pretend investor", practice?.status === "ok", JSON.stringify(practice));
  const ans = (q, score, note = "") => call("answer_investor_question", { session_id: practice?.id, question_id: q.id, option_id: pick(q, score), note });
  check("questions must be answered in order", (await ans(pennyQs[1], 3))?.status === "out_of_order");
  check("personal details in typed answers are refused", (await ans(pennyQs[0], 3, "Call me on 07700 900123"))?.status === "personal_info");
  const firstAnswer = await ans(pennyQs[0], 3, "I asked eight dog owners and six said yes");
  check("a strong answer in own words scores 3 + 1 with feedback", firstAnswer?.score === 3 && firstAnswer.bonus === 1 && firstAnswer.feedback?.length > 0);
  await ans(pennyQs[1], 1);
  await ans(pennyQs[2], 0);
  await ans(pennyQs[3], 3, "my price is more than the cost to make");
  const last = await ans(pennyQs[4], 3);
  check("the server scores the documented rubric (12/20 → 60, Promising)", last?.completed === true && last.points === 12 && last.total_score === 60 && last.band === "promising", JSON.stringify(last));
  check("the first practice awards Confident Founder", last?.achievements?.includes("confident-founder"));
  check("clients cannot change practice results", denied(await B.client.from("investor_sessions").update({ total_score: 100 }).eq("id", practice?.id).select()));
  const revised = await savePitch(pitch?.id, { problem: "Dogs chew things when bored at home" }, 1);
  check("editing a finished pitch marks it revising, keeping version 1 and its practice", revised?.deck_status === "draft" &&
    (await B.client.from("pitch_versions").select("snapshot").eq("deck_id", pitch?.id)).data?.[0]?.snapshot?.sections?.problem?.main === "Pets get bored when everyone is out" &&
    (await B.client.from("investor_sessions").select("total_score").eq("id", practice?.id).single()).data?.total_score === 60);
  const v2 = await savePitch(pitch?.id, {}, 6, true);
  check("finishing the revision saves version 2 without a duplicate badge", v2?.version === 2 && v2.achievements?.length === 0);
  check("the parent can read both versions and the practice answers",
    (await B.client.from("pitch_versions").select("id").eq("deck_id", pitch?.id)).data?.length === 2 &&
    (await B.client.from("investor_responses").select("score, review").eq("session_id", practice?.id)).data?.length === 5);
  check("another family cannot read this pitch or its practice",
    (await A.client.from("pitch_decks").select("id")).data?.length === 0 && (await A.client.from("pitch_versions").select("id")).data?.length === 0 &&
    (await A.client.from("investor_sessions").select("id")).data?.length === 0 && (await A.client.from("investor_responses").select("score")).data?.length === 0);
  check("another family cannot edit it", (await A.client.rpc("save_pitch", { deck_id: pitch?.id, fields: { problem: "Hijack attempt" } })).data?.status === "not_in_child_mode");
  check("anon cannot start pitches", Boolean((await anon.rpc("start_pitch", { project_id: ideaB })).error));
  console.log("\nHardening & credentials (Phase 7)");
  check("Child Mode cannot record consent directly",
    Boolean((await B.client.from("consent_records").insert({ guardian_id: B.id, consent_type: "core_processing", notice_version: "x", typed_name: "Child" })).error));
  check("Child Mode cannot rename or remove profiles directly", denied(await B.client.from("child_profiles").update({ nickname: "Hacked" }).eq("id", childB).select()));
  check("Child Mode cannot turn on credential anchoring",
    (await call("set_credential_anchoring", { child: childB, enable: true, typed_name: "Test Parent", notice_version: "credentials-2026-11-v1" }))?.status === "child_mode_active");
  const strong = await call("start_investor_practice", { deck_id: pitch?.id, persona_key: "penny" });
  let practiceEnd;
  for (const q of pennyQs) {
    practiceEnd = await call("answer_investor_question", { session_id: strong?.id, question_id: q.id, option_id: pick(q, 3), note: "I explained this part clearly with my own words" });
  }
  check("a 100/100 practice issues the Pitch Ready credential from server-side progress", practiceEnd?.total_score === 100, JSON.stringify(practiceEnd));
  check("parent B leaves Child Mode with the PIN", (await call("exit_child_mode", { pin: "2580" })) === "ok");

  const cred = (await B.client.from("certificates").select("id, verification_code, credential_hash, document, status, certificate_types(key)").eq("child_id", childB)).data ?? [];
  const pitchReady = cred.find((c) => c.certificate_types?.key === "pitch-ready");
  check("the credential has an id, type, hash, evidence document and active status",
    Boolean(pitchReady) && /^[0-9a-f]{64}$/.test(pitchReady.credential_hash) && pitchReady.document.credentialId === pitchReady.id &&
    pitchReady.document.evidence?.practiceScore === 100 && pitchReady.status === "active", JSON.stringify(cred).slice(0, 200));
  check("credential salts are never readable by clients", Boolean((await B.client.from("credential_secrets").select("salt")).error) &&
    denied(await anon.from("credential_secrets").select("salt")));
  check("credentials cannot be changed by clients", denied(await B.client.from("certificates").update({ status: "revoked" }).eq("id", pitchReady?.id).select()));
  check("anchoring consent cannot be inserted directly",
    Boolean((await B.client.from("consent_records").insert({ guardian_id: B.id, child_id: childB, consent_type: "onchain_credential", notice_version: "x", typed_name: "Test Parent" })).error));
  check("credentials_opt_in cannot be flipped directly", denied(await B.client.from("child_profiles").update({ credentials_opt_in: true }).eq("id", childB).select()));
  check("another family cannot change the setting or read the credential",
    (await A.client.rpc("set_credential_anchoring", { child: childB, enable: true, typed_name: "Intruder", notice_version: "credentials-2026-11-v1" })).data?.status === "not_found" &&
    (await A.client.from("certificates").select("id")).data?.length === 0);
  const on = await call("set_credential_anchoring", { child: childB, enable: true, typed_name: "Test Parent", notice_version: "credentials-2026-11-v1" });
  check("the parent turns anchoring on and the credential is queued", on?.status === "ok" && on.queued === 1, JSON.stringify(on));
  const consentRow = (await B.client.from("consent_records").select("granted_at, withdrawn_at, notice_version").eq("child_id", childB).eq("consent_type", "onchain_credential")).data ?? [];
  check("the explicit choice is recorded with a timestamp", consentRow.length === 1 && consentRow[0].granted_at && !consentRow[0].withdrawn_at);
  check("the anchoring worker is not callable by parents or anonymous visitors",
    Boolean((await B.client.rpc("claim_credential_anchor_jobs", { max_jobs: 1 })).error) && Boolean((await anon.rpc("claim_credential_anchor_jobs", { max_jobs: 1 })).error) &&
    Boolean((await B.client.rpc("record_credential_anchor", { issuance_id: pitchReady?.id, outcome: "confirmed", details: {} })).error));
  check("parents cannot mark anchoring records confirmed", denied(await B.client.from("credential_issuances").update({ status: "confirmed" }).eq("certificate_id", pitchReady?.id).select()));
  const v = (await anon.rpc("verify_credential", { code: pitchReady?.verification_code })).data;
  check("public verification confirms the credential and its hash", v?.status === "valid" && v.integrity?.hash_matches === true && v.credential?.title === "Pitch Ready Learning Milestone");
  check("public verification shows no child id, nickname, evidence or hash",
    !JSON.stringify(v).includes(childB) && !/Demo Ben/.test(JSON.stringify(v)) && !JSON.stringify(v).includes(pitchReady?.credential_hash) && !/evidence|subject/.test(JSON.stringify(v)));
  check("unknown codes reveal nothing", (await anon.rpc("verify_credential", { code: "zzzzzzzzzzzzzzzzzzzzzzzz" })).data?.status === "not_found");
  const off = await call("set_credential_anchoring", { child: childB, enable: false });
  check("withdrawing stops anchoring and cancels the unsent proof", off?.status === "ok" && off.withdrawn === true &&
    (await B.client.from("credential_issuances").select("status").eq("certificate_id", pitchReady?.id).single()).data?.status === "cancelled");
  check("the withdrawal is recorded, not deleted", (await B.client.from("consent_records").select("withdrawn_at").eq("child_id", childB).eq("consent_type", "onchain_credential")).data?.[0]?.withdrawn_at !== null);
  check("the credential stays valid after withdrawal", (await anon.rpc("verify_credential", { code: pitchReady?.verification_code })).data?.status === "valid");
  check("the real-child-data gate is still off (non-demo profiles refused)",
    Boolean((await B.client.from("child_profiles").insert({ guardian_id: B.id, nickname: "Real", age_band: "10-11", is_demo: false })).error));
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
