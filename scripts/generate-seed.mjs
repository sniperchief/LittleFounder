// Generates supabase/seed.sql from the Founder Academy curriculum in src/content/academy,
// the Simulator model (src/content/simulator.ts) and the Investor Room bank (src/content/investor-room.ts).
// Usage: npm run content:seed            (writes the file)
//        node scripts/generate-seed.mjs --check   (exits 1 if seed.sql is out of date)
//
// The seed is idempotent: it upserts by stable keys so ids (and children's progress)
// survive content edits, and removes content that no longer exists in the source.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const root = join(import.meta.dirname, "..");
const { academy, achievements, certificates } = await import("../src/content/academy/index.ts");
const { simulatorModel, scenarios } = await import("../src/content/simulator.ts");
const { investorPersonas } = await import("../src/content/investor-room.ts");

const errors = [];
const keyRe = /^[a-z0-9-]+$/;
const seen = new Set();
function uniqueKey(kind, key) {
  if (!keyRe.test(key)) errors.push(`${kind} key "${key}" must match ${keyRe}`);
  if (seen.has(`${kind}:${key}`)) errors.push(`duplicate ${kind} key "${key}"`);
  seen.add(`${kind}:${key}`);
}

// Deterministic shuffle so correct quiz answers aren't always in the same position.
function shuffled(items, seed) {
  const order = items.map((item, i) => ({
    item,
    sortKey: createHash("sha256").update(`${seed}:${i}`).digest("hex"),
  }));
  return order.sort((a, b) => a.sortKey.localeCompare(b.sortKey)).map((o) => o.item);
}

const lit = (value) => (value === null || value === undefined ? "null" : `'${String(value).replaceAll("'", "''")}'`);
const json = (value) => `${lit(JSON.stringify(value))}::jsonb`;
const list = (values) => values.map(lit).join(", ");

const modules = [];
const lessons = [];
const activities = [];
const quizzes = [];
const questions = [];
const options = [];

for (const m of academy) {
  uniqueKey("module", m.key);
  modules.push(`(${list([m.key])}, ${m.position}, ${list([m.title, m.summary, m.icon, m.tone])})`);
  if (m.lessons.length < 2) errors.push(`module ${m.key} needs at least 2 lessons`);

  m.lessons.forEach((l, i) => {
    uniqueKey("lesson", l.key);
    const body = { intro: l.intro, blocks: l.blocks, reflect: l.reflect, takeaway: l.takeaway };
    lessons.push(`(${list([m.key, l.key])}, ${i + 1}, ${lit(l.title)}, ${l.minutes}, ${json(body)})`);

    const a = l.activity;
    let config;
    let answerKey;
    if (a.kind === "choose") {
      const correct = a.options.flatMap((o, idx) => (o.correct ? [idx] : []));
      if (correct.length === 0) errors.push(`activity in ${l.key} has no correct option`);
      if (!a.multi && correct.length !== 1) errors.push(`single-choice activity in ${l.key} must have exactly 1 correct option`);
      config = { prompt: a.prompt, multi: Boolean(a.multi), options: a.options.map((o) => o.label) };
      answerKey = { correct, feedback: a.options.map((o) => o.feedback), explanation: a.explanation };
    } else if (a.kind === "sort") {
      config = { prompt: a.prompt, buckets: a.buckets, items: a.items.map((it) => it.label) };
      answerKey = { placements: a.items.map((it) => it.bucket), hint: a.hint, explanation: a.explanation };
    } else if (a.kind === "fill") {
      config = { prompt: a.prompt, prefix: a.prefix ?? null, suffix: a.suffix ?? null };
      answerKey = { answer: a.answer, hint: a.hint, explanation: a.explanation };
    } else {
      errors.push(`unknown activity kind in ${l.key}`);
      return;
    }
    activities.push(`(${list([l.key, `${l.key}-activity`, a.kind])}, ${json(config)}, ${json(answerKey)})`);
  });

  quizzes.push(`(${lit(m.key)}, ${m.quiz.passMark})`);
  m.quiz.questions.forEach((q, qi) => {
    uniqueKey("question", q.key);
    if (q.options.filter((o) => o.correct).length !== 1) errors.push(`question ${q.key} must have exactly 1 correct option`);
    questions.push(`(${list([m.key, q.key])}, ${qi + 1}, ${list([q.prompt, q.explanation])})`);
    shuffled(q.options, q.key).forEach((o, oi) => {
      options.push(`(${lit(q.key)}, ${oi + 1}, ${lit(o.label)}, ${o.correct ? "true" : "false"}, ${lit(o.feedback)})`);
    });
  });
}

// Investor Room: one question per pitch section (= rubric criterion) for every persona,
// each with three options and exactly one strong (3-point) answer.
const pitchSectionKeys = ["problem", "solution", "customer", "business_model", "ask"];
const personas = [];
const investorQuestions = [];
const investorOptions = [];
investorPersonas.forEach((p, pi) => {
  uniqueKey("persona", p.key);
  personas.push(`(${list([p.key, p.name, p.key, p.focus, p.style, p.intro])}, ${pi + 1})`);
  const sections = p.questions.map((q) => q.section);
  if (sections.join() !== pitchSectionKeys.join()) errors.push(`persona ${p.key} must ask one question per section, in order`);
  p.questions.forEach((q, qi) => {
    uniqueKey("investor question", q.key);
    if (q.options.length !== 3) errors.push(`investor question ${q.key} must have 3 options`);
    if (q.options.filter((o) => o.score === 3).length !== 1) errors.push(`investor question ${q.key} needs exactly one 3-point option`);
    if (q.options.some((o) => !Number.isInteger(o.score) || o.score < 0 || o.score > 3 || !o.feedback)) errors.push(`investor question ${q.key} has a bad option`);
    investorQuestions.push(`(${list([p.key, q.key])}, ${qi + 1}, ${list([q.section, q.prompt, q.hint])})`);
    shuffled(q.options, q.key).forEach((o, oi) => {
      investorOptions.push(`(${lit(q.key)}, ${oi + 1}, ${lit(o.label)}, ${o.score}, ${lit(o.feedback)})`);
    });
  });
});

for (const a of achievements) uniqueKey("achievement", a.key);
for (const c of certificates) uniqueKey("certificate", c.key);

if (errors.length) {
  console.error(`Curriculum errors:\n  ${errors.join("\n  ")}`);
  process.exit(1);
}

const keysOf = (items) => list(items.map((x) => x.key));
const allLessons = academy.flatMap((m) => m.lessons);
const allQuestions = academy.flatMap((m) => m.quiz.questions);
const allInvestorQuestions = investorPersonas.flatMap((p) => p.questions);

const sql = `-- LITTLE FOUNDERS · curriculum seed
-- GENERATED by scripts/generate-seed.mjs from src/content/academy — do not edit by hand.
-- Run \`npm run content:seed\` after changing the curriculum.
-- Contains NO child or adult data. Idempotent: upserts by stable keys.

-- Modules (positions are shifted first so reordering never collides)
delete from public.modules where key not in (${keysOf(academy)});
update public.modules set position = position + 20;
insert into public.modules (key, position, title, summary, icon_key, tone) values
  ${modules.join(",\n  ")}
on conflict (key) do update
  set position = excluded.position, title = excluded.title, summary = excluded.summary,
      icon_key = excluded.icon_key, tone = excluded.tone;

-- Lessons
delete from public.lessons where key not in (${keysOf(allLessons)});
update public.lessons set position = position + 100;
insert into public.lessons (module_id, key, position, title, est_minutes, body)
select m.id, v.key, v.position, v.title, v.est_minutes, v.body
from (values
  ${lessons.join(",\n  ")}
) as v(module_key, key, position, title, est_minutes, body)
join public.modules m on m.key = v.module_key
on conflict (key) do update
  set module_id = excluded.module_id, position = excluded.position, title = excluded.title,
      est_minutes = excluded.est_minutes, body = excluded.body;

-- Lesson activities (answer keys are hidden from clients by column grants)
delete from public.lesson_activities where key not in (${list(allLessons.map((l) => `${l.key}-activity`))});
insert into public.lesson_activities (lesson_id, key, kind, config, answer_key)
select l.id, v.key, v.kind, v.config, v.answer_key
from (values
  ${activities.join(",\n  ")}
) as v(lesson_key, key, kind, config, answer_key)
join public.lessons l on l.key = v.lesson_key
on conflict (key) do update
  set lesson_id = excluded.lesson_id, kind = excluded.kind, config = excluded.config, answer_key = excluded.answer_key;

-- Quizzes
insert into public.quizzes (module_id, pass_mark)
select m.id, v.pass_mark
from (values
  ${quizzes.join(",\n  ")}
) as v(module_key, pass_mark)
join public.modules m on m.key = v.module_key
on conflict (module_id) do update set pass_mark = excluded.pass_mark;

delete from public.quiz_questions where key is null or key not in (${keysOf(allQuestions)});
update public.quiz_questions set position = position + 100;
insert into public.quiz_questions (quiz_id, key, position, kind, prompt, explanation)
select q.id, v.key, v.position, 'single', v.prompt, v.explanation
from (values
  ${questions.join(",\n  ")}
) as v(module_key, key, position, prompt, explanation)
join public.modules m on m.key = v.module_key
join public.quizzes q on q.module_id = m.id
on conflict (key) do update
  set quiz_id = excluded.quiz_id, position = excluded.position, prompt = excluded.prompt,
      explanation = excluded.explanation;

delete from public.quiz_options o
using public.quiz_questions q
where q.id = o.question_id
  and (q.key, o.position) not in (select v.question_key, v.position from (values
  ${options.map((o) => o.replace(/^\((.*?), (\d+), .*$/, "($1, $2)")).join(",\n  ")}
) as v(question_key, position));
insert into public.quiz_options (question_id, position, label, is_correct, feedback)
select q.id, v.position, v.label, v.is_correct, v.feedback
from (values
  ${options.join(",\n  ")}
) as v(question_key, position, label, is_correct, feedback)
join public.quiz_questions q on q.key = v.question_key
on conflict (question_id, position) do update
  set label = excluded.label, is_correct = excluded.is_correct, feedback = excluded.feedback;

-- Founder Passport achievements (rules are evaluated by public.evaluate_achievements)
delete from public.achievements where key not in (${keysOf(achievements)});
insert into public.achievements (key, title, description, icon_key, rule, tier) values
  ${achievements.map((a) => `(${list([a.key, a.title, a.description, a.icon])}, ${json(a.rule)}, ${a.tier})`).join(",\n  ")}
on conflict (key) do update
  set title = excluded.title, description = excluded.description, icon_key = excluded.icon_key,
      rule = excluded.rule, tier = excluded.tier;

-- Certificates are learning milestones, not formal qualifications. Not on-chain (Phase 7).
insert into public.certificate_types (key, title, requirement, onchain_eligible) values
  ${certificates.map((c) => `(${list([c.key, c.title])}, ${json(c.requirement)}, false)`).join(",\n  ")}
on conflict (key) do update
  set title = excluded.title, requirement = excluded.requirement;

-- Startup Simulator challenges (Founder Bucks are pretend, virtual units). Rules: docs/STARTUP_SIMULATOR.md
insert into public.simulator_scenarios (key, title, product_kind, starting_budget, unit_cost_base, demand_params, rounds) values
  ${scenarios.map((sc) => `(${list([sc.key, sc.title, sc.product])}, ${simulatorModel.startingBudget}, ${simulatorModel.unitCost}, ${json({ ...simulatorModel, usesIdea: sc.usesIdea })}, 1)`).join(",\n  ")}
on conflict (key) do update
  set title = excluded.title, product_kind = excluded.product_kind, starting_budget = excluded.starting_budget,
      unit_cost_base = excluded.unit_cost_base, demand_params = excluded.demand_params, rounds = excluded.rounds;

-- Investor Room: pretend investor personas and their questions (scores and feedback are hidden
-- from clients by column grants). Rubric: docs/PITCH_STUDIO.md
delete from public.investor_personas where key not in (${keysOf(investorPersonas)});
insert into public.investor_personas (key, name, avatar_key, focus, style, intro_text, position) values
  ${personas.join(",\n  ")}
on conflict (key) do update
  set name = excluded.name, avatar_key = excluded.avatar_key, focus = excluded.focus, style = excluded.style,
      intro_text = excluded.intro_text, position = excluded.position;

delete from public.investor_questions where key is null or key not in (${keysOf(allInvestorQuestions)});
insert into public.investor_questions (persona_id, key, position, section, prompt, hint)
select p.id, v.key, v.position, v.section, v.prompt, v.hint
from (values
  ${investorQuestions.join(",\n  ")}
) as v(persona_key, key, position, section, prompt, hint)
join public.investor_personas p on p.key = v.persona_key
on conflict (key) do update
  set persona_id = excluded.persona_id, position = excluded.position, section = excluded.section,
      prompt = excluded.prompt, hint = excluded.hint;

delete from public.investor_answer_options o
using public.investor_questions q
where q.id = o.question_id
  and (q.key, o.position) not in (select v.question_key, v.position from (values
  ${investorOptions.map((o) => o.replace(/^\((.*?), (\d+), .*$/, "($1, $2)")).join(",\n  ")}
) as v(question_key, position));
insert into public.investor_answer_options (question_id, position, label, score, feedback)
select q.id, v.position, v.label, v.score, v.feedback
from (values
  ${investorOptions.join(",\n  ")}
) as v(question_key, position, label, score, feedback)
join public.investor_questions q on q.key = v.question_key
on conflict (question_id, position) do update
  set label = excluded.label, score = excluded.score, feedback = excluded.feedback;
`;

const target = join(root, "supabase", "seed.sql");
if (process.argv.includes("--check")) {
  const current = readFileSync(target, "utf8").replaceAll("\r\n", "\n");
  if (current !== sql) {
    console.error("supabase/seed.sql is out of date. Run `npm run content:seed`.");
    process.exit(1);
  }
  console.log("seed.sql is up to date.");
} else {
  writeFileSync(target, sql);
  console.log(
    `Wrote supabase/seed.sql: ${academy.length} modules, ${allLessons.length} lessons, ` +
      `${activities.length} activities, ${allQuestions.length} quiz questions, ${achievements.length} achievements, ` +
      `${investorPersonas.length} investor personas, ${allInvestorQuestions.length} investor questions.`,
  );
}
