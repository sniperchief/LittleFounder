// End-to-end browser tests: parent accounts, onboarding, child profiles, Child Mode,
// Founder Academy, Founder Passport and the Parent Dashboard — against the running app
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
        if (a.config.multi) await option(wrongLabel).uncheck();
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
  check("Passport shows the badges actually earned", (await has(/3 of 12 badges collected/)) && (await has(/Earned/)));
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
  check("Academy progress and badges are intact alongside Idea Spark", (await has(/4 of 12 badges collected/)) && (await has(/3\/18/)));

  await go("/play/exit");
  await page.getByLabel("Parent PIN").fill("3691");
  await submit("Parent area");
  await go(`/parent/children/${ada.id}`);
  check("Parent Dashboard counts the child's ideas", (await has(/Ideas created/)) && (await has(/Puzzle Pup Pro/)) && (await has(/started/)));
  await page.getByRole("link", { name: /Puzzle Pup Pro/ }).click();
  check("parents can open a read-only view of the idea", (await has(/Read-only view/)) && (await has(/A puzzle feeder made from recycled boxes/)));
  await go(`/parent/children/${ben.id}`);
  check("the sibling has no ideas", await has(/No ideas saved yet/));

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
  await ctxB.close();

  console.log("\nResponsive (signed-in pages)");
  for (const w of [320, 390, 768]) {
    await page.setViewportSize({ width: w, height: 800 });
    for (const p of ["/parent", `/parent/children/${ada.id}`, "/parent/children/new", "/parent/settings", "/profiles"]) {
      await go(p);
      check(`${p.replace(/[0-9a-f-]{36}/, ":id")} @${w}px has no horizontal overflow`, !(await overflow()));
    }
  }
  await go("/profiles");
  await page.getByRole("button", { name: /Demo Adaeze/ }).first().click();
  await page.waitForURL("**/play", { timeout: 15000 }).catch(() => {});
  for (const w of [320, 390]) {
    await page.setViewportSize({ width: w, height: 800 });
    for (const p of ["/play", "/play/exit", "/play/academy", `/play/academy/${m1}`, lessonUrl(m1Lessons[1]), `/play/academy/${m1}/quiz`, "/play/passport", "/play/ideas", `/play/ideas/${ideaId}`, `/play/ideas/${ideaId}/edit?step=1`]) {
      await go(p);
      check(`${p} @${w}px has no horizontal overflow`, !(await overflow()));
    }
  }
  await page.setViewportSize({ width: 390, height: 800 });
  await go("/play/exit");
  await page.getByLabel("Parent PIN").fill("3691");
  await submit("Parent area");

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
