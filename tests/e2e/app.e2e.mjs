// End-to-end browser tests: parent accounts, onboarding, child profiles, Child Mode,
// Founder Academy, Founder Passport, Idea Lab, Startup Simulator, Pitch Studio & Investor Room
// and the Parent Dashboard — against the running app
// and the hosted Supabase project in .env.local.
//
// Fictional accounts only (lf-e2e-<run>-*@example.com); everything is deleted at the end.
// The secret key is used only here, to create/confirm/delete test users and to read
// answer keys so the test can play as a perfect student. It never reaches the browser.
//
// Usage: npm run build && npm start   (in another terminal)
//        npm run test:e2e
// Env:   E2E_BASE_URL (default http://localhost:3000)
//        E2E_BROWSER_CHANNEL (default msedge on Windows, chrome elsewhere) — uses an installed browser.
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright-core";

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"]) {
  if (!process.env[key]) {
    console.error(`Missing ${key} (run via npm run test:e2e so .env.local is loaded).`);
    process.exit(2);
  }
}

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const run = randomBytes(3).toString("hex");
const emailA = `lf-e2e-${run}-a@example.com`;
const emailB = `lf-e2e-${run}-b@example.com`;
const pwA = `Demo-${randomBytes(9).toString("base64url")}`;
const pwA2 = `Demo-${randomBytes(9).toString("base64url")}`;
const pwB = `Demo-${randomBytes(9).toString("base64url")}`;
const createdUsers = [];
const consoleErrors = [];
let passed = 0, failed = 0;
let lastCheck = "start";
const notes = [];
function check(name, ok, detail = "") {
  lastCheck = name;
  if (ok) passed++;
  else failed++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}
const path = (page) => new URL(page.url()).pathname + new URL(page.url()).search;

const browser = await chromium.launch({
  channel: process.env.E2E_BROWSER_CHANNEL ?? (process.platform === "win32" ? "msedge" : "chrome"),
  headless: true,
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on("console", (m) => m.type() === "error" && consoleErrors.push(`${path(page)}: ${m.text()}`));
page.on("response", (r) => {
  if (r.status() < 400) return;
  const u = new URL(r.url());
  const params = [...u.searchParams.keys()].join(",");
  consoleErrors.push(`HTTP ${r.status()} ${r.request().method()} ${r.request().resourceType()} ${u.pathname.replace(/[0-9a-f-]{36}/g, ":id")}${params ? `?[${params}]` : ""} rsc=${r.request().headers()["rsc"] ?? "-"} (on ${path(page).replace(/[0-9a-f-]{36}/g, ":id")}, after "${lastCheck}")`);
});
page.on("pageerror", (e) => consoleErrors.push(`${path(page)}: ${e.message}`));

async function submit(label) {
  await Promise.all([page.waitForLoadState("networkidle"), page.getByRole("button", { name: label, exact: false }).first().click()]);
  await page.waitForLoadState("networkidle");
  // Wait until no submit button shows its pending label ("Saving…"), then for navigation to settle.
  await page.waitForTimeout(150);
  await page.waitForFunction(() => ![...document.querySelectorAll("button")].some((b) => b.textContent.includes("…")), null, { timeout: 30000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
}
async function go(p) {
  await page.goto(BASE + p, { waitUntil: "load" });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
}
const text = async () => page.locator("main").innerText().catch(() => page.locator("body").innerText());
// Wait (up to 10s) for streamed content to match.
const has = (re, p = page) => p.waitForFunction((src) => new RegExp(src, "i").test(document.body.innerText), re.source, { timeout: 10000 }).then(() => true, () => false);
const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

try {
  console.log(`Run ${run}\n\nSign-up & email confirmation`);
  await go("/sign-up");
  await page.getByLabel("Email").fill(emailA);
  await page.getByLabel("Password").fill(pwA);
  await submit("Create parent account");
  check("sign-up without the adult checkbox is rejected", /18|guardian/i.test(await text()) && path(page).startsWith("/sign-up"));
  await page.getByLabel("Password").fill(pwA);
  await page.getByRole("checkbox").check();
  await submit("Create parent account");
  await has(/Check .* for a link|confirmation email|create your account/);
  const signUpText = await text();
  // Supabase's built-in email service is rate-limited and only delivers to project team
  // addresses, so with test addresses the success path depends on project SMTP settings.
  const rateLimited = /send confirmation emails right now|send a confirmation email/.test(signUpText);
  if (rateLimited) {
    console.log("  – SKIPPED sign-up success path: Supabase built-in email service refused (app shows a clear message)");
    notes.push("UI sign-up hit Supabase over_email_send_rate_limit; friendly message shown; user created via admin generateLink instead.");
  } else {
    check("sign-up form submits and asks to confirm email", /Check .* for a link/.test(signUpText), signUpText.slice(0, 200));
  }

  // Email delivery isn't tested here: get the confirmation token directly (no email sent).
  // generateLink(signup) also creates the unconfirmed user if the UI sign-up was rate-limited.
  const link = await admin.auth.admin.generateLink({ type: "signup", email: emailA, password: pwA });
  if (link.error) throw new Error("generateLink: " + link.error.message);
  let userA = link.data.user;
  createdUsers.push(userA.id);
  check("parent user exists and is unconfirmed", !userA.email_confirmed_at);

  await go("/sign-in");
  await page.getByLabel("Email").fill(emailA);
  await page.getByLabel("Password").fill(pwA);
  await submit("Sign in");
  check("unconfirmed account cannot sign in yet", await has(/confirm your email/));
  await go(`/auth/callback?token_hash=${link.data.properties.hashed_token}&type=signup&next=/onboarding`);
  check("confirmation link signs the parent in and opens onboarding", path(page) === "/onboarding", path(page));
  const fresh = await browser.newContext(); const fp = await fresh.newPage();
  await fp.goto(BASE + `/auth/callback?token_hash=${link.data.properties.hashed_token}&type=signup&next=/onboarding`, { waitUntil: "networkidle" });
  const usedPath = new URL(fp.url()).pathname + new URL(fp.url()).search; await fresh.close();
  check("a used confirmation link is rejected", usedPath.startsWith("/sign-in?error=link"), usedPath);

  console.log("\nOnboarding & consent gate");
  await go("/parent");
  check("dashboard redirects to onboarding until set-up is done", path(page) === "/onboarding", path(page));
  await page.getByLabel("What should we call you?").fill("Demo Parent");
  await submit("Continue");
  check("display name saved → consent step", path(page) === "/onboarding/consent", path(page));
  check("consent page says it is not a verified consent check", await has(/not yet a verified parental-consent check/));
  await go("/parent/children/new");
  check("child creation is blocked before consent", path(page) === "/onboarding/consent", path(page));
  await submit("I agree");
  check("consent needs all boxes + typed name", path(page) === "/onboarding/consent" && (await page.locator("[aria-invalid=true]").count()) >= 1);
  for (const cb of await page.getByRole("checkbox").all()) await cb.check();
  await page.getByLabel("Type your full name to confirm").fill("Demo Parent");
  await submit("I agree");
  check("consent recorded → PIN step", path(page) === "/onboarding/pin", path(page));
  const consentRow = (await admin.from("consent_records").select("notice_version, typed_name, granted_at, guardian_id").eq("guardian_id", userA.id)).data?.[0];
  check("consent stored with version, timestamp and account", consentRow?.notice_version === "2026-11-preview-1" && Boolean(consentRow?.granted_at), JSON.stringify(consentRow));

  await page.getByLabel("New PIN", { exact: true }).fill("1111");
  await page.getByLabel("Confirm PIN").fill("1111");
  await submit("Save PIN");
  check("trivial PIN rejected in the UI", path(page) === "/onboarding/pin" && (await has(/too easy to guess/)));
  await page.getByLabel("New PIN", { exact: true }).fill("2580");
  await page.getByLabel("Confirm PIN").fill("2580");
  await submit("Save PIN");
  check("PIN saved → Parent Dashboard", path(page).startsWith("/parent"), path(page));
  const hash = (await admin.from("adult_accounts").select("pin_hash").eq("id", userA.id)).data?.[0]?.pin_hash ?? "";
  check("PIN stored as a bcrypt hash", /^\$2[aby]\$10\$/.test(hash) && !hash.includes("2580"));
  check("empty dashboard invites adding a child", await has(/Add (a|your first) child|Add child/));

  console.log("\nChild profiles");
  await go("/parent/children/new");
  await page.getByLabel(/nickname/i).fill("Ada Lovelace Smith");
  await page.getByLabel("10–11 years").check();
  await submit("Create profile");
  check("full-name-like nickname rejected", path(page) === "/parent/children/new" && (await page.locator("[aria-invalid=true]").count()) >= 1);
  await page.getByLabel(/nickname/i).fill("Ada 2014");
  await page.getByLabel("10–11 years").check();
  await submit("Create profile");
  check("nickname with a year/number rejected", path(page) === "/parent/children/new");
  await page.getByLabel(/nickname/i).fill("Demo Ada");
  await page.getByLabel("10–11 years").check();
  await page.locator('input[name="avatarKey"]').nth(1).check({ force: true });
  await submit("Create profile");
  const adaPath = path(page);
  check("child profile created", /^\/parent\/children\/[0-9a-f-]{36}$/.test(adaPath) || adaPath === "/parent?created=1", adaPath);
  const kids = (await admin.from("child_profiles").select("id, nickname, age_band, is_demo, avatar_key").eq("guardian_id", userA.id)).data ?? [];
  const ada = kids.find((k) => k.nickname === "Demo Ada");
  check("stored as demo profile with nickname + age band only", ada?.is_demo === true && ada?.age_band === "10-11");
  check("child id is not in the URL? (UUID only, no nickname/age)", !/ada|10-11/i.test(adaPath));

  await go("/parent/children/new");
  await page.getByLabel(/nickname/i).fill("Demo Ben");
  await page.getByLabel("12–13 years").check();
  await submit("Create profile");
  const ben = ((await admin.from("child_profiles").select("id, nickname").eq("guardian_id", userA.id)).data ?? []).find((k) => k.nickname === "Demo Ben");
  check("second child profile created", Boolean(ben));

  await go(`/parent/children/${ada.id}`);
  check("child page shows honest empty activity states", await has(/yet/));
  check("child switcher lists the sibling", (await page.getByRole("link", { name: /Demo Ben/ }).count()) >= 1);
  await page.getByRole("link", { name: /Demo Ben/ }).first().click();
  await page.waitForLoadState("networkidle");
  check("switching to the sibling works", path(page) === `/parent/children/${ben.id}`, path(page));

  await go(`/parent/children/${ada.id}/edit`);
  await page.getByLabel(/nickname/i).fill("Demo Adaeze");
  await submit("Save changes");
  check("child profile edited", ((await admin.from("child_profiles").select("nickname").eq("id", ada.id)).data?.[0]?.nickname) === "Demo Adaeze");

  await go(`/parent/children/${ben.id}/remove`);
  check("removal asks for confirmation", await has(/permanently deleted after 30 days/));
  await submit("Yes, remove profile");
  check("removed child disappears from the dashboard", path(page).startsWith("/parent") && (await has(/Demo Adaeze/)) && !/Demo Ben/.test(await text()), path(page));
  await go("/parent/settings");
  check("removed child listed for restore in settings", await has(/Demo Ben/));
  await submit("Restore");
  await go("/parent");
  check("restored child is back on the dashboard", await has(/Demo Ben/));

  console.log("\nChild Mode");
  await go("/profiles");
  await page.getByRole("button", { name: /Demo Adaeze/ }).first().click();
  await page.waitForURL("**/play", { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState("networkidle");
  check("picking a child starts Child Mode", path(page) === "/play", path(page));
  check("Child Mode greets the child by nickname", await has(/Hi, Demo Adaeze!/));
  for (const p of ["/parent", "/parent/settings", `/parent/children/${ada.id}`, `/parent/children/${ben.id}/remove`, "/profiles", "/onboarding/pin", "/parent/children/new"]) {
    await go(p);
    check(`direct URL ${p.replace(/[0-9a-f-]{36}/, ":id")} stays in Child Mode`, path(page) === "/play", path(page));
  }
  await page.goBack({ waitUntil: "networkidle" });
  check("Back button does not reveal parent pages", path(page) === "/play" || path(page) === "/play/exit", path(page));
  await go("/play/exit");
  await page.getByLabel("Parent PIN").fill("1357");
  await submit("Parent area");
  check("wrong PIN keeps Child Mode", (await has(/That PIN isn.t right/)) && path(page) === "/play/exit", path(page));
  await go("/parent");
  check("still locked after a wrong PIN", path(page) === "/play", path(page));
  await go("/play/exit");
  await page.getByLabel("Parent PIN").fill("2580");
  await submit("Parent area");
  check("correct PIN returns to the Parent Dashboard", path(page) === "/parent", path(page));

  console.log("\nPIN management");
  await go("/parent/settings");
  await page.getByLabel("Current PIN").fill("0000");
  await page.getByLabel("New PIN", { exact: true }).fill("4826");
  await page.getByLabel("Confirm new PIN").fill("4826");
  await submit("Change PIN");
  check("PIN change with wrong current PIN refused", await has(/current PIN isn.t right/));
  await page.getByLabel("Current PIN").fill("2580");
  await page.getByLabel("New PIN", { exact: true }).fill("4826");
  await page.getByLabel("Confirm new PIN").fill("4826");
  await submit("Change PIN");
  check("PIN changed with the current PIN", await has(/parent PIN has been changed/));

  console.log("\nForgotten PIN (password re-auth)");
  await go("/profiles");
  await page.getByRole("button", { name: /Demo Ben/ }).first().click();
  await page.waitForURL("**/play", { timeout: 15000 }).catch(() => {});
  await go("/play/exit");
  await submit("Forgot the PIN?");
  check("forgot PIN signs out to a password prompt", path(page).startsWith("/sign-in") && (await has(/Forgot your parent PIN/)), path(page));
  await go("/parent");
  check("signed out: parent area needs sign-in", path(page).startsWith("/sign-in"), path(page));
  await go("/sign-in?reset_pin=1");
  await page.getByLabel("Email").fill(emailA);
  await page.getByLabel("Password").fill(pwA);
  await submit("Sign in");
  check("fresh password sign-in → choose a new PIN", path(page).startsWith("/onboarding/pin"), path(page));
  await page.getByLabel("New PIN", { exact: true }).fill("3691");
  await page.getByLabel("Confirm PIN").fill("3691");
  await submit("Save PIN");
  check("new PIN saved, Child Mode cleared", path(page).startsWith("/parent"), path(page));

  console.log("\nSign-out, session & password reset");
  await go("/parent");
  check("session persists across navigation", path(page) === "/parent");
  await page.reload({ waitUntil: "networkidle" });
  check("session persists across reload", path(page) === "/parent");
  await Promise.all([page.waitForURL((u) => new URL(u).pathname === "/", { timeout: 20000 }), page.getByRole("button", { name: "Sign out" }).first().click()]);
  await go("/parent");
  check("sign-out ends the session", path(page).startsWith("/sign-in"), path(page));
  check("protected redirect keeps only a safe ?next path", /next=%2Fparent|next=\/parent/.test(page.url()), page.url());

  await go("/forgot-password");
  await page.getByLabel("Email").fill(emailA);
  await submit("Send");
  check("forgot-password responds without revealing account existence", await has(/If an account exists/));
  const rec = await admin.auth.admin.generateLink({ type: "recovery", email: emailA });
  await go(`/auth/callback?token_hash=${rec.data.properties.hashed_token}&type=recovery&next=/reset-password`);
  check("recovery link opens reset-password", path(page) === "/reset-password", path(page));
  await page.getByLabel(/^new password/i).fill(pwA2);
  await page.getByLabel("Confirm new password").fill(pwA2);
  await submit("password");
  check("password updated → dashboard", path(page) === "/parent", path(page));
  // Fresh sign-in: leave the signed-in page first so its background prefetches don't race the cleared session.
  await go("/");
  await ctx.clearCookies();
  await go("/sign-in");
  await page.getByLabel("Email").fill(emailA);
  await page.getByLabel("Password").fill(pwA);
  await submit("Sign in");
  check("old password no longer works", await has(/don.t match/));
  await page.getByLabel("Password").fill(pwA2);
  await submit("Sign in");
  check("new password signs in", path(page) === "/parent", path(page));

  console.log("\nChild Mode survives cookie clearing?");
  await go("/profiles");
  await page.getByRole("button", { name: /Demo Adaeze/ }).first().click();
  await page.waitForURL("**/play", { timeout: 15000 }).catch(() => {});
  await ctx.clearCookies();
  await go("/parent");
  check("clearing cookies in Child Mode signs out (no bypass to parent area)", path(page).startsWith("/sign-in"), path(page));
  await page.getByLabel("Email").fill(emailA);
  await page.getByLabel("Password").fill(pwA2);
  await submit("Sign in");
  await go("/parent");
  check("signing back in with the password still lands in Child Mode", path(page) === "/play", path(page));
  await go("/play/exit");
  await page.getByLabel("Parent PIN").fill("3691");
  await submit("Parent area");

  console.log("\nFounder Academy (Phase 3)");
  const m1 = "think-like-a-founder";
  const m1Lessons = (await admin.from("lessons").select("id, key, title, position, modules!inner(key)").eq("modules.key", m1).order("position")).data;
  const lessonUrl = (l) => `/play/academy/${m1}/${l.key}`;
  const activityFor = async (lesson) =>
    (await admin.from("lesson_activities").select("kind, config, answer_key").eq("lesson_id", lesson.id).single()).data;

  // Solve a lesson's activity through the UI (answers from the server-only key), then finish it.
  async function solveLesson(lesson, { wrongFirst = false } = {}) {
    await go(lessonUrl(lesson));
    const a = await activityFor(lesson);
    const option = (label) => page.locator("label", { hasText: label }).locator("input");
    if (a.kind === "choose") {
      if (wrongFirst) {
        const wrongLabel = a.config.options.find((_, i) => !a.answer_key.correct.includes(i));
        await option(wrongLabel).check();
        await page.getByRole("button", { name: "Check my answer" }).click();
        check("a wrong answer gets encouraging feedback", await has(/Not quite/));
        if (a.config.multi) {
          await option(wrongLabel).uncheck();
          await option(a.config.options[a.answer_key.correct[0]]).check();
          await page.getByRole("button", { name: /Check again/ }).click();
          check("ticking only some right answers says there's more (not 'Not quite')", (await has(/there.s more/)) && !(await text()).includes("Not quite"));
        }
      }
      for (const i of a.answer_key.correct) await option(a.config.options[i]).check();
    } else if (a.kind === "sort") {
      for (const [i, item] of a.config.items.entries()) {
        const bucket = a.config.buckets[a.answer_key.placements[i]];
        await page.getByRole("group", { name: item }).locator("label", { hasText: bucket }).click();
      }
    } else {
      await page.getByLabel("Your answer").fill(String(a.answer_key.answer));
    }
    await page.getByRole("button", { name: /Check/ }).click();
    const right = await has(/Brilliant — that.s right/);
    await page.getByRole("button", { name: /Finish lesson/ }).click();
    const done = await has(/Lesson complete!/);
    return right && done;
  }

  await go("/profiles");
  await page.getByRole("button", { name: /Demo Adaeze/ }).first().click();
  await page.waitForURL("**/play", { timeout: 15000 }).catch(() => {});
  check("Child Mode home shows where to start", await has(/Start learning/));
  await page.getByRole("link", { name: /Start learning/ }).click();
  await page.waitForURL(`**${lessonUrl(m1Lessons[0])}`, { timeout: 15000 }).catch(() => {});
  check("Start learning opens Module 1, Lesson 1", path(page) === lessonUrl(m1Lessons[0]), path(page));
  check("lesson has explanations, an example and a key idea", (await has(/Key idea/)) && (await has(/Example/)) && (await has(/Talk it over/)));
  const firstActivity = await activityFor(m1Lessons[0]);
  const lessonHtml = await (await page.request.get(BASE + lessonUrl(m1Lessons[0]))).text();
  check("answer keys and explanations are not sent to the browser",
    !lessonHtml.includes(firstActivity.answer_key.explanation) && !lessonHtml.includes(firstActivity.answer_key.feedback[1]) && !/answer_key/.test(lessonHtml));
  await go(lessonUrl(m1Lessons[1]));
  check("lesson 2 is locked until lesson 1 is finished", await has(/still locked/));
  await go(`/play/academy/${m1}/quiz`);
  check("the module quiz is locked until every lesson is done", await has(/quiz is locked/));

  check("lesson 1: activity solved and lesson completed", await solveLesson(m1Lessons[0], { wrongFirst: true }));
  check("completing lesson 1 unlocks the First Steps badge", await has(/First Steps/));
  await page.reload({ waitUntil: "networkidle" });
  check("lesson completion persists after refresh", (await has(/Lesson complete!/)) && (await has(/Completed/)));
  for (const lesson of m1Lessons.slice(1)) {
    check(`lesson ${lesson.position}: activity solved and lesson completed`, await solveLesson(lesson));
  }
  await go(`/play/academy/${m1}`);
  check("module page shows all lessons complete and the quiz ready", (await has(/3 of 3 lessons complete/)) && (await has(/Pass mark 60%/)));

  const quizQs = (await admin.from("quiz_questions").select("id, quizzes!inner(modules!inner(key)), quiz_options(id, is_correct)").eq("quizzes.modules.key", m1)).data;
  const answerQuiz = async (correct) => {
    for (const q of quizQs) {
      const opt = q.quiz_options.find((o) => o.is_correct === correct);
      await page.locator(`input[value="${opt.id}"]`).check();
    }
    await page.getByRole("button", { name: "Submit answers" }).click();
  };
  await go(`/play/academy/${m1}/quiz`);
  await answerQuiz(false);
  check("an all-wrong quiz is scored 0% by the server, with encouragement", (await has(/You need 60% to pass/)) && (await has(/0 of 5 correct/)));
  check("results explain why each answer is right or wrong", (await page.getByText("Why:").count()) === 5);
  await page.getByRole("button", { name: "Try again" }).click();
  await answerQuiz(true);
  check("a perfect quiz scores 100% and passes", (await has(/Perfect score/)) && (await has(/5 of 5 correct/)));
  check("passing unlocks Problem Spotter and Quiz Whiz", (await has(/Problem Spotter/)) && (await has(/Quiz Whiz/)));
  await go(`/play/academy/${m1}/quiz`);
  check("completed quiz results are shown again later", (await has(/100%/)) && (await has(/Your answers/)));

  await go("/play/passport");
  check("Passport shows the badges actually earned", (await has(/3 of 15 badges collected/)) && (await has(/Earned/)));
  check("Passport shows lessons and challenges", (await has(/3\/18/)) && (await has(/Challenges solved/)));
  check("milestone certificate is described as a learning milestone", (await has(/Complete all six modules/)));

  await ctx.clearCookies();
  await go("/sign-in");
  await page.getByLabel("Email").fill(emailA);
  await page.getByLabel("Password").fill(pwA2);
  await submit("Sign in");
  await go("/play/academy");
  check("Academy progress persists after signing back in", (await has(/3 of 18 lessons/)) && (await has(/Up next/)));
  check("resume points to the next incomplete lesson", await has(/Create Your Idea|Brainstorm like a founder/));

  await go("/play/exit");
  await page.getByLabel("Parent PIN").fill("3691");
  await submit("Parent area");
  await go(`/parent/children/${ada.id}`);
  check("Parent Dashboard shows the child's real lesson progress", (await has(/3\/3 lessons/)) && (await has(/Module complete/)));
  check("Parent Dashboard shows quiz attempts and scores", (await has(/Quizzes passed/)) && (await has(/100% best/)));
  check("Parent Dashboard lists earned achievements", (await has(/Problem Spotter/)) && (await has(/First Steps/)));
  await go(`/parent/children/${ben.id}`);
  check("each child's activity is separate (sibling has none)", (await has(/No lessons completed yet/)) && !(await text()).includes("Problem Spotter"));

  console.log("\nIdea Lab (Phase 4)");
  const click = async (name) => {
    await page.getByRole("button", { name }).first().click();
    await page.waitForTimeout(150);
  };
  const continueTo = async (stepNumber) => {
    await click(/Save & continue/);
    return has(new RegExp(`Step ${stepNumber} of 6`));
  };
  await go("/profiles");
  await page.getByRole("button", { name: /Demo Adaeze/ }).first().click();
  await page.waitForURL("**/play", { timeout: 15000 }).catch(() => {});
  await page.getByRole("link", { name: /Idea Lab/ }).first().click();
  await page.waitForURL("**/play/ideas", { timeout: 15000 }).catch(() => {});
  check("Idea Lab opens from Child Mode with an empty state", path(page) === "/play/ideas" && (await has(/No ideas yet/)));
  await page.getByRole("link", { name: /Create my first idea/ }).click();
  await page.waitForURL("**/play/ideas/new", { timeout: 15000 }).catch(() => {});
  check("step 1 explains what makes a problem worth solving", (await has(/Step 1 of 6/)) && (await has(/worth solving/)));
  await click(/Pets & animals/);
  await click("Pets get bored when everyone is out");
  check("choosing a prompt fills in the problem", (await page.getByLabel("The problem in your own words").inputValue()) === "Pets get bored when everyone is out");
  await page.getByLabel(/Who has this problem/).fill("Families with dogs");
  await click("Every day");
  check("step 1 saves and moves to step 2", await continueTo(2));
  await page.waitForURL(/\/play\/ideas\/[0-9a-f-]{36}\/edit\?step=2/, { timeout: 10000 }).catch(() => {});
  const ideaId = path(page).match(/[0-9a-f-]{36}/)?.[0];
  const draftRow = (await admin.from("startup_projects").select("child_id, status, wizard_step, problem_category").eq("id", ideaId).single()).data;
  check("a draft is saved to the database for this child", draftRow?.child_id === ada.id && draftRow.status === "draft" && draftRow.wizard_step === 2 && draftRow.problem_category === "pets");

  await go("/play/ideas");
  check("the draft is listed so it can be resumed", (await has(/Draft/)) && (await has(/Continue at step 2/)));
  await page.getByRole("link", { name: /Continue at step 2/ }).click();
  check("resuming opens the saved step", (await has(/Step 2 of 6/)) && (await has(/Create a solution/)));
  await click(/A thing you make/);
  await page.getByLabel("What's your idea?").fill("Call me on 0123 456 7890");
  check("personal details get a gentle privacy nudge", await has(/looks like a phone number/));
  await page.getByLabel("What's your idea?").fill("A puzzle feeder made from recycled boxes");
  await page.getByLabel(/Why would it help/).fill("Keeps dogs busy and happy");
  check("step 2 saves and moves to step 3", await continueTo(3));
  check("step 3 explains users and buyers", await has(/Users and buyers can be different people/));
  await click("Pet owners");
  await click("Families");
  await click(/Parents or carers/);
  check("step 3 saves and moves to step 4", await continueTo(4));
  await page.getByLabel("Your idea's name").fill("Puzzle Pup");
  await page.getByRole("radio", { name: "paw" }).click();
  check("step 4 saves and moves to step 5", await continueTo(5));
  await click(/Use my answers/);
  check("the sentence helper builds a description from the answers", (await page.getByLabel("Your idea in one sentence").inputValue()).startsWith("Puzzle Pup is"));
  await click("More fun");
  await click("Build a cardboard prototype");
  check("step 5 saves and moves to the review", await continueTo(6));
  check("the review summarises every part", (await has(/Puzzle Pup/)) && (await has(/A puzzle feeder made from recycled boxes/)) && (await has(/Everything is filled in/)));
  await page.getByRole("navigation", { name: "Idea steps" }).getByRole("button").first().click();
  check("you can jump back to an earlier step and your answers are kept", (await has(/Step 1 of 6/)) && (await page.getByLabel("The problem in your own words").inputValue()).includes("Pets get bored"));
  await page.getByRole("navigation", { name: "Idea steps" }).getByRole("button").nth(5).click();
  await click(/Create my idea/);
  await page.waitForURL(/\/play\/ideas\/[0-9a-f-]{36}\?created=1/, { timeout: 15000 }).catch(() => {});
  check("creating the idea shows a celebration and the Idea Spark badge", (await has(/Your idea is created!/)) && (await has(/Idea Spark/)));
  await page.reload({ waitUntil: "networkidle" });
  check("the workspace shows the saved idea after refresh", (await has(/Idea created/)) && (await has(/Puzzle Pup keeps|Puzzle Pup is/)) && (await has(/Learn more in the Academy/)));

  await page.getByRole("link", { name: /Edit idea/ }).click();
  await has(/Step 1 of 6/);
  await page.getByRole("navigation", { name: "Idea steps" }).getByRole("button").nth(3).click();
  await page.getByLabel("Your idea's name").fill("Puzzle Pup Pro");
  await page.getByRole("navigation", { name: "Idea steps" }).getByRole("button").nth(5).click();
  await click(/Save my idea/);
  await page.waitForURL(/\/play\/ideas\/[0-9a-f-]{36}\?saved=1/, { timeout: 15000 }).catch(() => {});
  check("editing a saved idea updates it", (await has(/Changes saved/)) && (await has(/Puzzle Pup Pro/)));

  await go("/play/ideas/new");
  await click(/School supplies/);
  await click(/Save draft/);
  check("an incomplete idea can be saved as a draft", await has(/Draft saved/));
  const draftId = path(page).match(/[0-9a-f-]{36}/)?.[0];
  await go(`/play/ideas/${draftId}/delete`);
  check("deleting asks for confirmation", await has(/can.t undo it/));
  await submit("Yes, delete it");
  check("the deleted idea is gone", (await has(/Idea deleted/)) && (await admin.from("startup_projects").select("id").eq("id", draftId)).data?.length === 0);
  check("the other idea is untouched", await has(/Puzzle Pup Pro/));
  await go("/play/passport");
  check("Academy progress and badges are intact alongside Idea Spark", (await has(/4 of 15 badges collected/)) && (await has(/3\/18/)));

  await go("/play/exit");
  await page.getByLabel("Parent PIN").fill("3691");
  await submit("Parent area");
  await go(`/parent/children/${ada.id}`);
  check("Parent Dashboard counts the child's ideas", (await has(/Ideas created/)) && (await has(/Puzzle Pup Pro/)) && (await has(/started/)));
  await page.getByRole("link", { name: /Puzzle Pup Pro/ }).click();
  check("parents can open a read-only view of the idea", (await has(/Read-only view/)) && (await has(/A puzzle feeder made from recycled boxes/)));
  await go(`/parent/children/${ben.id}`);
  check("the sibling has no ideas", await has(/No ideas saved yet/));

  console.log("\nStartup Simulator (Phase 5)");
  await go("/profiles");
  await page.getByRole("button", { name: /Demo Adaeze/ }).first().click();
  await page.waitForURL("**/play", { timeout: 15000 }).catch(() => {});
  await page.getByRole("link", { name: /Startup Simulator/ }).first().click();
  await page.waitForURL("**/play/simulator", { timeout: 15000 }).catch(() => {});
  check("the simulator explains itself and labels Founder Bucks as pretend", (await has(/Run a pretend business/)) && (await has(/Pretend money/)));
  check("the child's created idea can be used", await has(/Puzzle Pup Pro/));
  await page.getByRole("button", { name: /Play EcoBottle/ }).click();
  await page.waitForURL(/\/play\/simulator\/[0-9a-f-]{36}$/, { timeout: 15000 }).catch(() => {});
  const simId = path(page).match(/[0-9a-f-]{36}/)?.[0];
  check("an EcoBottle attempt starts at step 1", (await has(/Step 1 of 5/)) && (await has(/1,000 FB/)));
  await click(/Let.s go/);
  await page.getByRole("radio", { name: /^10 FB/ }).click();
  await click(/^Next/);
  await page.getByRole("radio", { name: /^100 bottles/ }).click();
  check("production cost and budget are shown", (await has(/Costs 100 × 4 FB = 400 FB/)) && (await has(/left 600 FB/)));
  await click(/^Next/);
  await page.goto(BASE + "/play/simulator", { waitUntil: "load" });
  check("the unfinished attempt is listed as in progress", await has(/In progress/));
  await page.getByRole("button", { name: /Continue EcoBottle/ }).click();
  await page.waitForURL(`**/play/simulator/${simId}`, { timeout: 15000 }).catch(() => {});
  check("resuming returns to the saved step", await has(/Step 4 of 5/));
  await page.getByRole("radio", { name: /Posters around town/ }).click();
  await click(/^Next/);
  check("the plan summary shows total spending and budget left", (await has(/Total spending/)) && (await has(/550 FB/)));
  await click(/Run .* season/);
  await page.waitForURL(/\/play\/simulator\/[0-9a-f-]{36}\?done=1/, { timeout: 15000 }).catch(() => {});
  check("results show profit, revenue, costs and cash remaining", (await has(/550 FB/)) && (await has(/1,000 FB/)) && (await has(/450 FB/)) && (await has(/1,550 FB/)));
  check("results explain that cash remaining isn't profit", await has(/Cash remaining isn.t profit/));
  check("the first run awards First Business Run", await has(/First Business Run/));
  await click(/I.d change my price/);
  await click(/Save my answer/);
  check("the reflection answer is saved", await has(/Your answer is saved/));
  await page.reload({ waitUntil: "networkidle" });
  check("the reflection persists with the attempt", await has(/Reflection: I.d change my price/));
  await click(/Try another attempt/);
  await page.waitForURL(/\/play\/simulator\/[0-9a-f-]{36}$/, { timeout: 15000 }).catch(() => {});
  const sim2Id = path(page).match(/[0-9a-f-]{36}/)?.[0];
  check("another attempt starts fresh", sim2Id && sim2Id !== simId && (await has(/Step 1 of 5/)));
  await click(/Let.s go/);
  await page.getByRole("radio", { name: /^15 FB/ }).click();
  await click(/^Next/);
  await page.getByRole("radio", { name: /^250 bottles/ }).click();
  await click(/^Next/);
  check("marketing that would break the budget is disabled with a reason", await has(/Too expensive: your plan would cost 1,050 FB/));
  await page.getByRole("radio", { name: /No marketing/ }).click();
  await click(/^Next/);
  await click(/Run .* season/);
  await page.waitForURL(/\?done=1/, { timeout: 15000 }).catch(() => {});
  check("a loss is shown as a loss", (await has(/Loss/)) && (await has(/−400 FB/)));
  check("attempts can be compared", (await has(/Compare your attempts/)) && (await has(/#2 \(this one\)/)));
  const passportBadges = (await admin.from("child_achievements").select("achievements!inner(key)").eq("child_id", ada.id).eq("achievements.key", "first-business-run")).data;
  check("First Business Run is not awarded twice", passportBadges?.length === 1);

  await go("/play/exit");
  await page.getByLabel("Parent PIN").fill("3691");
  await submit("Parent area");
  await go(`/parent/children/${ada.id}`);
  check("Parent Dashboard shows completed simulations with results", (await has(/Simulations/)) && (await has(/EcoBottle/)) && (await has(/Profit 550 FB/)) && (await has(/Loss -400 FB/)));
  await page.getByRole("link", { name: /EcoBottle/ }).last().click();
  check("parents can open a read-only result", (await has(/Read-only view/)) && (await has(/Cash remaining/)));

  console.log("\nPitch Studio & Investor Room (Phase 6)");
  await go("/profiles");
  await page.getByRole("button", { name: /Demo Adaeze/ }).first().click();
  await page.waitForURL("**/play", { timeout: 15000 }).catch(() => {});
  await page.getByRole("link", { name: /Pitch Studio/ }).first().click();
  await page.waitForURL("**/play/pitch", { timeout: 15000 }).catch(() => {});
  check("Pitch Studio explains pitching and asks for no personal details", (await has(/A pitch is a short talk/)) && (await has(/Never add your name/)));
  check("the child's Idea Lab idea is offered and the pretend investors are introduced", (await has(/Puzzle Pup Pro/)) && (await has(/Penny the Planner/)) && (await has(/no real money/)));
  await page.getByRole("button", { name: /Start pitch/ }).first().click();
  await page.waitForURL(/\/play\/pitch\/[0-9a-f-]{36}\/edit\?step=1&new=1/, { timeout: 15000 }).catch(() => {});
  const deckId = path(page).match(/[0-9a-f-]{36}/)?.[0];
  const problemBox = () => page.getByLabel(/What problem are you trying to solve/);
  check("a pitch starts from the idea with prefilled answers", (await has(/We filled in some parts/)) && (await problemBox().inputValue()) === "Pets get bored when everyone is out");
  check("extra details are prefilled from the idea", (await page.getByLabel(/Who has it, and how often/).inputValue()).includes("Families with dogs"));
  check("each section explains the idea with an example", (await has(/Every good pitch starts with a problem/)) && (await has(/Example:/)));
  await problemBox().fill("Text me on 0123 456 7890");
  check("contact details get a privacy nudge", await has(/looks like a phone number/));
  await click(/Save & continue/);
  check("contact details are not saved", (await has(/Please remove personal details/)) && (await has(/Step 1 of 6/)));
  await problemBox().fill("Pets get bored when everyone is out at school and work");
  await click(/Save & continue/);
  check("step 1 saves and moves to step 2", await has(/Step 2 of 6/));
  check("the solution is prefilled from the idea", (await page.getByLabel(/How does your idea solve the problem/).inputValue()) === "A puzzle feeder made from recycled boxes");
  const deckRow = (await admin.from("pitch_decks").select("child_id, project_id, builder_step, status").eq("id", deckId).single()).data;
  check("the draft is saved for this child and idea", deckRow?.child_id === ada.id && deckRow.project_id === ideaId && deckRow.builder_step === 2 && deckRow.status === "draft");
  await go("/play/pitch");
  check("the draft is listed so it can be resumed", (await has(/Draft/)) && (await has(/Continue at step 2/)));
  await page.getByRole("link", { name: /Continue at step 2/ }).click();
  check("resuming opens the saved step", await has(/Step 2 of 6/));
  await page.getByRole("navigation", { name: "Pitch steps" }).getByRole("button").nth(2).click();
  await has(/Step 3 of 6/);
  await page.getByLabel(/Who would use or buy it/).fill("");
  await page.getByRole("navigation", { name: "Pitch steps" }).getByRole("button").nth(5).click();
  check("the final step shows the title slide with the idea's name", (await has(/Your title slide/)) && (await page.getByLabel(/Business name/).inputValue()) === "Puzzle Pup Pro");
  check("the checklist marks required and optional parts", (await has(/Required, still to do/)) && (await has(/Optional/)));
  await click(/Finish my pitch/);
  check("a pitch with a required section missing cannot be finished", await has(/still need a little more/));
  await click(/Go to Your Customers/);
  check("the reminder links back to the missing section", await has(/Step 3 of 6/));
  await page.getByLabel(/Who would use or buy it/).fill("Dog owners with busy days");
  await page.getByRole("navigation", { name: "Pitch steps" }).getByRole("button").nth(5).click();
  await has(/Your title slide/);
  await page.getByRole("radio", { name: "Ocean" }).click();
  await click(/Finish my pitch/);
  await page.waitForURL(/\/play\/pitch\/[0-9a-f-]{36}\?finished=1/, { timeout: 15000 }).catch(() => {});
  check("finishing celebrates and awards First Pitch", (await has(/Your pitch is finished/)) && (await has(/First Pitch/)) && (await has(/Completed · v1/)));
  check("the deck has a title slide plus one slide per section", (await page.locator('[aria-label="Pitch deck slides"] > li').count()) === 6 &&
    (await has(/Dog owners with busy days/)) && (await has(/Puzzle Pup Pro/)));
  await page.getByRole("link", { name: /Present my pitch/ }).click();
  await page.waitForURL(/\/present$/, { timeout: 15000 }).catch(() => {});
  check("present mode opens on the title slide", (await has(/Slide 1 of 6/)) && (await has(/Made in Pitch Studio/)));
  await page.keyboard.press("ArrowRight");
  check("arrow keys move to the next slide", (await has(/Slide 2 of 6/)) && (await has(/at school and work/)));
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
  check("the last slide is the opportunity and Next stops there", (await has(/Slide 6 of 6/)) && (await page.getByRole("button", { name: /^Next/ }).isDisabled()));

  await go(`/play/pitch/${deckId}/investor`);
  check("the Investor Room shows four pretend investors with clear labels", (await has(/Captain Customer/)) && (await has(/Steady Sam/)) && (await has(/made-up characters for practice/)));
  await page.getByRole("button", { name: /Practise with Penny/ }).click();
  await page.waitForURL(/\/investor\/[0-9a-f-]{36}$/, { timeout: 15000 }).catch(() => {});
  const practiceId = path(page).match(/investor\/([0-9a-f-]{36})/)?.[1];
  check("Penny introduces herself as a pretend investor", (await has(/Meet Penny the Planner/)) && (await has(/Pretend investor/)));
  await click(/I.m ready/);
  const pennyQs = (await admin.from("investor_questions").select("position, investor_personas!inner(key), investor_answer_options(label, score)")
    .eq("investor_personas.key", "penny").order("position")).data ?? [];
  const labelFor = (i, score) => pennyQs[i].investor_answer_options.find((o) => o.score === score).label;
  const plan = [[3, "I asked eight dog owners and six said yes"], [1, ""], [0, ""], [3, "my price is more than the cost to make"], [3, ""]];
  for (const [i, [score, note]] of plan.entries()) {
    await has(new RegExp(`Question ${i + 1} of 5`));
    await page.getByRole("radio", { name: labelFor(i, score) }).click();
    if (i === 0) {
      await page.getByLabel(/Now say it in your own words/).fill("Call me on 07700 900123");
      check("typed answers get a privacy nudge and can't be sent", (await has(/looks like a phone number/)) && (await page.getByRole("button", { name: /Give my answer/ }).isDisabled()));
    }
    await page.getByLabel(/Now say it in your own words/).fill(note);
    if (i === 0) check("a long enough answer shows the bonus point", await has(/Bonus point ready/));
    await click(/Give my answer/);
    if (i === 0) check("a strong answer gets predefined feedback and the bonus", (await has(/Strong answer/)) && (await has(/\+1 own words/)));
    if (i === 1) check("a partial answer explains how to improve", (await has(/Good start/)) && (await has(/A stronger answer/)));
    await click(i === 4 ? /See my practice feedback/ : /Next question/);
  }
  await page.waitForURL(/\/investor\/[0-9a-f-]{36}\?done=1/, { timeout: 15000 }).catch(() => {});
  check("the practice result shows the documented score and band", (await has(/Practice complete/)) && (await has(/\b60\b/)) && (await has(/Promising/)) && (await has(/12 of 20 rubric points/)));
  check("the rubric breakdown, strengths and suggestions are shown", (await has(/Rubric breakdown/)) && (await has(/Problem clarity/)) && (await has(/What you explained well/)) && (await has(/Ideas to improve/)));
  check("results never imply a real investor or funding", (await has(/No real investor has seen your pitch/)) && !(await text()).match(/I'd like to invest|invest in you|we will fund/i));
  check("the first practice awards Confident Founder", await has(/Confident Founder/));

  await go(`/play/pitch/${deckId}/edit?step=1`);
  await problemBox().fill("Dogs chew things when they are bored at home all day");
  await page.getByRole("navigation", { name: "Pitch steps" }).getByRole("button").nth(5).click();
  await has(/Your title slide/);
  check("a finished pitch offers to save a new version", await has(/Save as a new version/));
  await click(/Save as a new version/);
  await page.waitForURL(/\?finished=2/, { timeout: 15000 }).catch(() => {});
  check("revising saves version 2 and keeps the earlier practice", (await has(/Version 2 is saved/)) && (await has(/60\/100/)) && (await has(/Version 1/)));
  const versions = (await admin.from("pitch_versions").select("version, snapshot").eq("deck_id", deckId).order("version")).data ?? [];
  const oldPractice = (await admin.from("investor_sessions").select("total_score, deck_snapshot").eq("id", practiceId).single()).data;
  check("version 1 and its evaluation are preserved unchanged", versions.length === 2 && versions[0].snapshot.sections.problem.main.includes("at school and work") &&
    oldPractice?.total_score === 60 && oldPractice.deck_snapshot.version === 1);
  const badgeRows = async (key) => (await admin.from("child_achievements").select("achievements!inner(key)").eq("child_id", ada.id).eq("achievements.key", key)).data?.length;
  check("First Pitch and Confident Founder are awarded once", (await badgeRows("first-pitch")) === 1 && (await badgeRows("confident-founder")) === 1);
  await go("/play/passport");
  check("Founder Passport shows pitch and Investor Room progress", (await has(/Pitches finished/)) && (await has(/1\/1/)) && (await has(/Investor Room practices/)) && (await has(/60\/100/)));

  await go("/play/exit");
  await page.getByLabel("Parent PIN").fill("3691");
  await submit("Parent area");
  await go(`/parent/children/${ada.id}`);
  check("Parent Dashboard counts pitches and practices with recent activity",
    (await has(/Pitches & Investor Room/)) && (await has(/Pitches created/)) && (await has(/Recent pitch activity/)) && (await has(/Completed \(v2\)/)));
  await page.getByRole("link", { name: /Puzzle Pup Pro/ }).last().click();
  await page.waitForURL(/\/pitches\/[0-9a-f-]{36}/, { timeout: 15000 }).catch(() => {});
  check("parents can open a read-only pitch with practice results", (await has(/Read-only view/)) && (await has(/Investor Room practice/)) && (await has(/60\/100/)) && (await has(/Rubric breakdown/)));
  check("the read-only view has no editing controls", (await page.getByRole("button", { name: /Save|Finish|Give my answer/ }).count()) === 0);
  await go(`/parent/children/${ben.id}`);
  check("the sibling has no pitches", await has(/No pitches created yet/));

  console.log("\nCredentials & hardening (Phase 7)");
  await go("/parent/settings");
  await go("/reset-password");
  await page.getByLabel(/^new password/i).fill(`${pwA2}-x`);
  await page.getByLabel("Confirm new password").fill(`${pwA2}-x`);
  await submit("password");
  check("an ordinary signed-in session cannot set a new password without a fresh reset link", await has(/open the password reset link from your email again/));
  await go("/profiles");
  await page.getByRole("button", { name: /Demo Adaeze/ }).first().click();
  await page.waitForURL("**/play", { timeout: 15000 }).catch(() => {});
  await go("/reset-password");
  await page.getByLabel(/^new password/i).fill(`${pwA2}-child`);
  await page.getByLabel("Confirm new password").fill(`${pwA2}-child`);
  await submit("password");
  check("Child Mode cannot change the parent's password", path(page).startsWith("/play"), path(page));
  const pwCheck = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  check("the parent's password is unchanged", !(await pwCheck.auth.signInWithPassword({ email: emailA, password: pwA2 })).error);
  await go(`/parent/children/${ada.id}/credentials`);
  check("Child Mode cannot open the parent credential settings", path(page).startsWith("/play"), path(page));

  await go("/play/passport");
  check("Passport lists both credentials, locked with progress", (await has(/My certificates/)) && (await has(/Founder Academy Learning Milestone/)) && (await has(/Your best practice score so far: 60\/100/)));
  await go(`/play/pitch/${deckId}/investor`);
  await page.getByRole("button", { name: /Practise with Inventor/ }).click();
  await page.waitForURL(/\/investor\/[0-9a-f-]{36}$/, { timeout: 15000 }).catch(() => {});
  await click(/I.m ready/);
  const ivyQs = (await admin.from("investor_questions").select("position, investor_personas!inner(key), investor_answer_options(label, score)")
    .eq("investor_personas.key", "ivy").order("position")).data ?? [];
  for (const [i, q] of ivyQs.entries()) {
    await has(new RegExp(`Question ${i + 1} of 5`));
    await page.getByRole("radio", { name: q.investor_answer_options.find((o) => o.score === 3).label }).click();
    await page.getByLabel(/Now say it in your own words/).fill("I can explain this part clearly in my own words");
    await click(/Give my answer/);
    await click(i === 4 ? /See my practice feedback/ : /Next question/);
  }
  await page.waitForURL(/\?done=1/, { timeout: 15000 }).catch(() => {});
  check("a 100/100 practice is shown as Ready to grow", (await has(/\b100\b/)) && (await has(/Ready to grow/)));
  const credRow = (await admin.from("certificates").select("id, verification_code, credential_hash, certificate_types!inner(key)").eq("child_id", ada.id).eq("certificate_types.key", "pitch-ready")).data?.[0];
  check("the Pitch Ready credential is issued by the server with a hash", Boolean(credRow) && /^[0-9a-f]{64}$/.test(credRow.credential_hash));
  await go("/play/passport");
  check("Passport shows the earned credential with child-friendly status", (await has(/Pitch Ready Learning Milestone/)) && (await has(/Checked & genuine/)) && (await has(/Check it.s real/)));
  check("Passport uses no blockchain jargon", !/blockchain|wallet|gas|token|transaction|attestation|Base Sepolia/i.test(await text()));
  await page.getByRole("link", { name: /Check it.s real/ }).first().click();
  await page.waitForURL(/\/verify\/[A-Za-z0-9]+$/, { timeout: 15000 }).catch(() => {});
  check("the verification page confirms the credential", (await has(/This credential is genuine/)) && (await has(/Pitch Ready Learning Milestone/)) && (await has(/matches its fingerprint/)));
  const verifyHtml = await page.content();
  check("the verification page shows no child name, id or hash", !/Adaeze|Demo Ada/.test(verifyHtml) && !verifyHtml.includes(ada.id) && !verifyHtml.includes(credRow.credential_hash));
  check("no public proof was requested yet", await has(/No public blockchain proof was requested/));
  const anonCtx = await browser.newContext();
  const anonPage = await anonCtx.newPage();
  await anonPage.goto(`${BASE}/verify/${credRow.verification_code}`, { waitUntil: "networkidle" });
  check("anyone with the link can verify it without signing in", await has(/This credential is genuine/, anonPage));
  await anonPage.goto(`${BASE}/verify/notarealcode000000`, { waitUntil: "networkidle" });
  check("an unknown code reveals nothing", await has(/couldn.t find that credential/, anonPage));
  await anonCtx.close();

  await go("/play/exit");
  await page.getByLabel("Parent PIN").fill("3691");
  await submit("Parent area");
  await go(`/parent/children/${ada.id}`);
  await page.getByRole("link", { name: /Credentials/ }).first().click();
  await page.waitForURL(/\/credentials$/, { timeout: 15000 }).catch(() => {});
  check("the parent credential page explains public proofs and starts switched off",
    (await has(/Public proofs \(optional\)/)) && (await has(/publicly viewable and may be permanent/)) && (await has(/no personal information/)) && (await has(/\bOff\b/)));
  check("the parent sees technical details (credential hash)", await has(new RegExp(credRow.credential_hash)));
  await submit("Turn on public proofs");
  check("turning on needs every confirmation and the parent's name", (await has(/understand the proof is public and permanent/)) && (await has(/Type your full name/)));
  for (const box of await page.getByRole("checkbox").all()) await box.check();
  await page.getByLabel("Type your full name to confirm").fill("Demo Parent A");
  await submit("Turn on public proofs");
  check("public proofs turn on and the credential is queued", (await has(/Public proofs are on/)) && (await has(/Queued|Sent|Anchored|Failed/)));
  const consentRows = (await admin.from("consent_records").select("granted_at, withdrawn_at, notice_version").eq("child_id", ada.id).eq("consent_type", "onchain_credential")).data ?? [];
  const issuance = (await admin.from("credential_issuances").select("status, tx_hash").eq("certificate_id", credRow.id).maybeSingle()).data;
  check("the opt-in is recorded with a timestamp and an anchoring record is created", consentRows.length === 1 && !consentRows[0].withdrawn_at && Boolean(issuance));
  notes.push(`anchoring record after opt-in: ${issuance?.status}${issuance?.tx_hash ? ` ${issuance.tx_hash}` : ""} (depends on CREDENTIAL_* server configuration)`);
  await page.getByRole("checkbox", { name: /Stop new public proofs/ }).check();
  await submit("Turn off public proofs");
  check("withdrawing stops new proofs and explains recorded ones stay", (await has(/Public proofs are off/)) && (await has(/stay on the public network/)));
  const after = (await admin.from("credential_issuances").select("status").eq("certificate_id", credRow.id).maybeSingle()).data;
  check("an unsent proof is cancelled; a sent or confirmed one is kept", ["cancelled", "submitted", "confirmed"].includes(after?.status));
  check("the consent history shows both choices", (await has(/Turned on/)) && (await has(/turned off/)));
  await go(`/verify/${credRow.verification_code}`);
  check("the credential stays valid after withdrawal", await has(/This credential is genuine/));

  console.log("\nFamily isolation in the browser");
  const { data: ub } = await admin.auth.admin.createUser({ email: emailB, password: pwB, email_confirm: true });
  createdUsers.push(ub.user.id);
  // Fully onboard fictional parent B (name, consent, PIN) through B's own session.
  const bClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  await bClient.auth.signInWithPassword({ email: emailB, password: pwB });
  await bClient.from("adult_accounts").update({ display_name: "Demo Parent B" }).eq("id", ub.user.id);
  await bClient.from("consent_records").insert({ guardian_id: ub.user.id, consent_type: "core_processing", notice_version: "test", typed_name: "Demo B" });
  await bClient.rpc("set_adult_pin", { new_pin: "2580" });
  const ctxB = await browser.newContext();
  const pB = await ctxB.newPage();
  await pB.goto(BASE + "/sign-in", { waitUntil: "networkidle" });
  await pB.getByLabel("Email").fill(emailB);
  await pB.getByLabel("Password").fill(pwB);
  await Promise.all([pB.waitForURL((u) => new URL(u).pathname === "/parent", { timeout: 20000 }), pB.getByRole("button", { name: "Sign in" }).click()]);
  check("parent B is signed in to their own dashboard", new URL(pB.url()).pathname === "/parent" && !(await pB.locator("body").innerText()).includes("Demo Adaeze"));
  const r2 = await pB.goto(BASE + `/parent/children/${ada.id}`, { waitUntil: "networkidle" });
  // Streamed (PPR) pages send 200 before notFound() runs; the not-found UI streams in instead.
  const html2 = await r2.text();
  check("parent B sees not-found for parent A's child (by direct URL)", (await has(/wandered off/, pB)) && !/Adaeze/.test(html2), `${new URL(pB.url()).pathname} ${r2.status()}`);
  const r3 = await pB.goto(BASE + `/parent/children/${ada.id}/edit`, { waitUntil: "networkidle" });
  check("parent B sees not-found when editing parent A's child", (await has(/wandered off/, pB)) && !/Adaeze/.test(await r3.text()), String(r3.status()));
  const r4 = await pB.goto(BASE + `/parent/children/${ada.id}/ideas/${ideaId}`, { waitUntil: "networkidle" });
  check("parent B cannot open parent A's child's idea", (await has(/wandered off/, pB)) && !/Puzzle Pup/.test(await r4.text()), String(r4.status()));
  const r5 = await pB.goto(BASE + `/parent/children/${ada.id}/simulations/${simId}`, { waitUntil: "networkidle" });
  check("parent B cannot open parent A's child's simulation", (await has(/wandered off/, pB)) && !/1,550 FB/.test(await r5.text()), String(r5.status()));
  const r6 = await pB.goto(BASE + `/parent/children/${ada.id}/pitches/${deckId}`, { waitUntil: "networkidle" });
  const r7 = await pB.goto(BASE + `/parent/children/${ada.id}/credentials`, { waitUntil: "networkidle" });
  check("parent B cannot open parent A's child's credentials", (await has(/wandered off/, pB)) && !/Pitch Ready/.test(await r7.text()), String(r7.status()));
  check("parent B cannot open parent A's child's pitch", (await has(/wandered off/, pB)) && !/Puzzle Pup|at home all day/.test(await r6.text()), String(r6.status()));
  await ctxB.close();

  console.log("\nResponsive (signed-in pages)");
  for (const w of [320, 390, 768]) {
    await page.setViewportSize({ width: w, height: 800 });
    for (const p of ["/parent", `/parent/children/${ada.id}`, `/parent/children/${ada.id}/pitches/${deckId}`, `/parent/children/${ada.id}/credentials`, "/parent/children/new", "/parent/settings", "/profiles"]) {
      await go(p);
      check(`${p.replace(/[0-9a-f-]{36}/, ":id")} @${w}px has no horizontal overflow`, !(await overflow()));
    }
  }
  await go("/profiles");
  await page.getByRole("button", { name: /Demo Adaeze/ }).first().click();
  await page.waitForURL("**/play", { timeout: 15000 }).catch(() => {});
  for (const w of [320, 390]) {
    await page.setViewportSize({ width: w, height: 800 });
    for (const p of ["/play", "/play/exit", "/play/academy", `/play/academy/${m1}`, lessonUrl(m1Lessons[1]), `/play/academy/${m1}/quiz`, "/play/passport", "/play/ideas", `/play/ideas/${ideaId}`, `/play/ideas/${ideaId}/edit?step=1`, "/play/simulator", `/play/simulator/${simId}`,
      "/play/pitch", `/play/pitch/${deckId}`, `/play/pitch/${deckId}/edit?step=1`, `/play/pitch/${deckId}/edit?step=6`, `/play/pitch/${deckId}/present`,
      `/play/pitch/${deckId}/investor`, `/play/pitch/${deckId}/investor/${practiceId}`]) {
      await go(p);
      check(`${p.replace(/[0-9a-f-]{36}/g, ":id")} @${w}px has no horizontal overflow`, !(await overflow()));
    }
  }
  await page.setViewportSize({ width: 390, height: 800 });
  await go("/play/exit");
  await page.getByLabel("Parent PIN").fill("3691");
  await submit("Parent area");

  console.log("\nOne-click demo account");
  const demoCtx = await browser.newContext();
  const demoPage = await demoCtx.newPage();
  await demoPage.goto(BASE + "/sign-up", { waitUntil: "networkidle" });
  if ((await demoPage.getByRole("button", { name: "Try the demo" }).count()) === 0) {
    notes.push("demo button not shown (DEMO_ACCOUNTS_ENABLED is not \"true\" in this build) — demo checks skipped");
  } else {
    await Promise.all([demoPage.waitForURL("**/parent?demo=1", { timeout: 30000 }), demoPage.getByRole("button", { name: "Try the demo" }).click()]);
    const demoRow = (await admin.from("demo_accounts").select("user_id").order("created_at", { ascending: false }).limit(1)).data?.[0];
    if (demoRow) createdUsers.push(demoRow.user_id);
    check("Try the demo signs straight into a ready demo account", (await has(/You.re using a demo account/, demoPage)) && (await has(/2580/, demoPage)));
    check("the demo account has one fictional demo child", (await has(/Demo (Nova|Kai|Zara|Leo|Mira|Theo)/, demoPage)) && (await has(/Demo profile/, demoPage)));
    await demoPage.getByRole("button", { name: /Start Child Mode/ }).first().click();
    await demoPage.waitForURL("**/play", { timeout: 15000 }).catch(() => {});
    await demoPage.goto(BASE + "/play/exit", { waitUntil: "networkidle" });
    check("the exit screen reminds demo users of the PIN", await has(/Demo account: the parent PIN is 2580/, demoPage));
    await demoPage.getByLabel("Parent PIN").fill("2580");
    await Promise.all([demoPage.waitForURL("**/parent**", { timeout: 15000 }), demoPage.getByRole("button", { name: /Parent area/ }).click()]);
    check("the demo PIN leaves Child Mode", new URL(demoPage.url()).pathname.startsWith("/parent"));
    const expiry = (await admin.from("demo_accounts").select("expires_at").eq("user_id", demoRow?.user_id).single()).data?.expires_at;
    check("the demo account is set to expire in about 48 hours", expiry && Math.abs(new Date(expiry) - Date.now() - 48 * 3600e3) < 10 * 60e3);
  }
  await demoCtx.close();

  console.log("\nNo sensitive data in URLs or console");
  check("no console errors", consoleErrors.length === 0, consoleErrors.slice(0, 12).join(" | "));
} catch (err) {
  failed++;
  console.error(`\n✗ Aborted at ${path(page)}: ${err.message.split("\n")[0]}`);
} finally {
  await browser.close();
  for (const id of createdUsers) {
    const kids = (await admin.from("child_profiles").select("id").eq("guardian_id", id)).data ?? [];
    await admin.from("audit_log").delete().eq("actor_id", id);
    for (const k of kids) await admin.from("audit_log").delete().eq("target_id", k.id);
    await admin.from("deletion_jobs").delete().eq("requested_by", id);
    await admin.auth.admin.deleteUser(id);
  }
  console.log(`\nCleaned up ${createdUsers.length} test accounts.`);
  notes.forEach((n) => console.log("note:", n));
  console.log(`${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
