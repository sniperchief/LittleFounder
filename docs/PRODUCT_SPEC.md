# LITTLE FOUNDERS — Product Specification

Status: Phase 0 draft, for approval · Date: 2026-11-05

> Legend used across all Phase 0 documents
> - **[Fact]** verified against a cited source (see `PHASE_0_REPORT.md` → Sources)
> - **[Assumption]** something we believe but have not confirmed with the product owner
> - **[Recommendation]** our proposed decision, pending approval

---

## 0. Confirmed decisions (approved at Phase 1 kickoff, 2026-11-05)

These override any conflicting statement elsewhere in the Phase 0 documents.

| # | Decision |
|---|---|
| 1 | LITTLE FOUNDERS is a **global** entrepreneurship education platform (not Nigeria-first). |
| 2 | Target age: **10–13**. |
| 3 | **English** initially, using **globally relatable examples** (no single-country assumptions in content). |
| 4 | **Parents own accounts** and manage child profiles. |
| 5 | Parents monitor learning progress and projects through a **Parent Dashboard**. |
| 6 | Children use **Child Mode on the parent's device**. **No separate child login credentials.** |
| 7 | **No external AI API** dependency. |
| 8 | **No real fundraising, investments, or child wallets.** |
| 9 | Startup simulations use a **clearly labelled fictional virtual currency**. |
| 10 | Base credential infrastructure stays **behind the scenes**. |
| 11 | **Real child data collection is gated** pending professional privacy and legal review. |
| 12 | **Demo profiles must use fictional data.** |

Still open: educator accounts (deferred), pitch uploads (deferred), mainnet vs testnet, hosting region, content authoring owner.

## 1. Product summary

LITTLE FOUNDERS is a web-based entrepreneurship learning platform for children aged 10–13, designed for a global audience. Children learn to spot problems, shape ideas, understand customers and money, build a simple pitch, and practise answering questions from simulated investors. Progress is collected in a **Founder Passport** that can produce certificates and, optionally, a verifiable credential.

### Primary users

| User | Role | Account? |
|---|---|---|
| **Child (10–13)** | Learner. Uses Academy, Idea Lab, Simulator, Pitch Studio, Investor Room, Passport. | No independent account. A *child profile* owned by an adult. |
| **Parent / guardian** | Creates the account, gives consent, creates child profiles, monitors progress and projects in the **Parent Dashboard**, exports/deletes data. | Yes (email-verified). |
| **Educator** | Same as parent but for a group of children. | Yes — **deferred past MVP** [Recommendation] (see §7). |

### Design principles

1. **Learning first, tech invisible.** No crypto vocabulary, wallets, tokens, or prices shown to children.
2. **Private by default.** Nothing a child creates is visible to anyone except their supervising adult.
3. **No open communication.** No chat, comments, friend lists, public profiles, or search for other children.
4. **Deterministic and offline-friendly logic.** All scoring and feedback are rule-based; no external AI APIs.
5. **Short, concrete, playful.** Lessons of 3–7 minutes; every lesson ends with something the child *does*.

---

## 2. Core experiences

### 2.1 Founder Academy

Six modules, each with 3–4 short lessons, one practical activity per lesson, and a module quiz.

**Proposed module outline** [Recommendation — content owner to confirm]:

| # | Module | Learning outcome | Unlocks / feeds |
|---|---|---|---|
| 1 | Thinking Like a Founder | What entrepreneurs do; curiosity, persistence, ethics | — |
| 2 | Spotting Problems | Observe and describe a real problem | Idea Lab: Problem step |
| 3 | Knowing Your Customer | Who has the problem; simple interviews (with family only) | Idea Lab: Customer step |
| 4 | Building a Solution | From idea to simple prototype / MVP | Idea Lab: Solution step |
| 5 | Money Matters | Cost, price, revenue, profit, budget | Startup Simulator |
| 6 | Telling Your Story | Pitch structure, confidence, answering questions | Pitch Studio, Investor Room |

**Lesson anatomy:** intro card → 3–6 content cards (text + illustration) → one interactive activity (sort, match, fill-in, choose) → recap.

**Quizzes:** 5–8 questions per module; multiple choice, true/false, ordering. Pass mark 60% [Recommendation]; unlimited retries; feedback explains *why* each answer is right/wrong.

**Progress & achievements:** lesson completion, module completion, quiz pass, streak-free (we intentionally avoid daily-streak pressure mechanics) [Recommendation].

### 2.2 Idea Lab

A guided wizard that turns learning into a saved **startup project**:

1. **Problem** — "What problem did you notice? Who has it? How often?"
2. **Solution** — "What could you make or do to help?"
3. **Target customer** — pick from age/role/place chips + short description (no real names of people).
4. **Why it matters** — one sentence value statement.
5. **Name & emoji/logo** — chosen from a preset icon set (no uploads in MVP).

Children can create, edit, duplicate, archive, and delete projects. Limit of 10 active projects per child [Recommendation].

Free-text fields are length-limited and pass a local profanity/PII heuristic that *nudges* (e.g. "It looks like you typed a phone number — founders keep personal info private!") rather than blocks.

### 2.3 Startup Simulator

A turn-based, single-player business game using a **clearly labelled fictional virtual currency** (confirmed decision 9). Working name: **"Founder Coins" is avoided** (crypto connotation); use **"Founder Bucks (FB)"** or similar, always shown with a "pretend money" label. No real-world currency, no exchange, no link to Base.

- Child starts with a virtual budget (e.g. 1,000 FB).
- Selects a product (from their Idea Lab project or a preset scenario like "lemonade stand", "bead bracelets", "school snacks").
- Each **round** (= one simulated week), the child sets:
  - production quantity
  - unit price
  - optional spend on marketing
- The engine computes: cost of goods, units sold (demand curve with price elasticity + marketing effect + a seeded event), revenue, profit, remaining budget.
- **Decision challenges** appear on certain rounds (e.g. "A supplier raises prices 20%", "It rains all week", "A competitor opens nearby") with 2–3 choices.
- After each round: a results panel + **educational feedback** ("Your price was higher than most customers would pay, so fewer people bought").
- 6 rounds per session; end-of-game summary with a "founder lesson" and achievements.

All simulation math is **deterministic given a seed**, unit-testable, and runs client-side with the result persisted server-side [Recommendation].

### 2.4 Pitch Studio & Investor Room

**Pitch Studio** — a guided five-part pitch:

1. **Problem**
2. **Solution**
3. **Customer**
4. **Business model** (price, cost, profit — can import from Simulator)
5. **The Ask** (what help/resources they want)

Each part becomes one slide in a **simple deck builder**: preset layouts, preset colour themes, preset illustration library, text fields with character limits. Prefilled from the Idea Lab project where possible. Present mode (full-screen slides) and print/PDF export via the browser.

**Uploads of external presentations are not in MVP** [Recommendation — see `CHILD_SAFETY_AND_PRIVACY.md` §7].

**Investor Room** — the child presents their deck to one of 3–4 predefined investor personalities:

| Persona (working names) | Focus | Style |
|---|---|---|
| "Penny the Planner" | Money, costs, profit | Precise, friendly |
| "Captain Customer" | Who buys and why | Curious |
| "Inventor Ivy" | Solution & creativity | Enthusiastic |
| "Steady Sam" | Risks & feasibility | Calm, cautious |

Flow: choose investor → present slides → investor asks 4–5 questions drawn from a bank (tagged by pitch section & difficulty) → child answers by **choosing from structured options** and optionally adding a short note → **deterministic rubric** scores:

- Deck completeness (all five sections filled, minimum lengths)
- Consistency checks (e.g. price > unit cost; customer described)
- Answer quality (each option carries a rubric score and feedback text)
- Use of Simulator numbers (bonus if business model matches a completed session)

Output: score out of 100 mapped to friendly bands ("Ready to grow", "Promising", "Keep building"), per-persona decision ("I'd like to invest!" / "Come back after you…"), and 2–3 specific improvement tips. No harsh language; never "failed".

### 2.5 Founder Passport

The child's personal record:

- Modules and lessons completed
- Quizzes passed
- Projects created, simulator sessions completed, pitches delivered
- **Achievements** (badges) — ~20 for MVP
- **Certificates** — e.g. "Founder Academy Graduate" (all six modules), "Pitch Ready" (Investor Room score ≥ 70)
- **Verifiable credential (optional, adult-controlled)** — for certificates only, the supervising adult can opt in to have an attestation recorded on Base. The child never sees wallets, gas, or transactions; the UI just says "Verified certificate ✓" with a verification link. See `TECHNICAL_ARCHITECTURE.md` §5.

---

## 3. Key user flows

### 3.1 Adult onboarding
Landing → Sign up (email + password, or magic link) → verify email → adult profile (name, role, country) → **Parental consent screen** (plain-language notice + affirmative checkbox + typed full name) → Create first child profile (nickname, avatar, age band) → Hand device to child.

### 3.2 Child session
Adult signs in → "Who's learning?" profile picker → selects child → app enters **Child Mode** → child dashboard. Leaving Child Mode for the parent area requires the adult PIN or password re-entry.

### 3.3 Learning loop
Dashboard → Academy → Module → Lesson cards → Activity → Recap → (module end) Quiz → Achievement toast → Passport updated → Dashboard suggests next step (e.g. "Use what you learnt in Idea Lab!").

### 3.4 Build loop
Idea Lab project → Simulator session using that project → Pitch Studio deck from project + simulator results → Investor Room → feedback → improve deck → retry.

### 3.5 Credential flow (optional)
Child earns certificate → adult sees "Make this certificate verifiable?" in Parent area → adult opts in → server issues attestation → certificate shows verification link/QR → anyone with link sees *credential type + issue date + issuer*, never the child's name unless the adult chooses to print it on the PDF.

---

## 4. Non-functional requirements

| Area | Requirement |
|---|---|
| Devices | Works on laptop and tablet browsers; usable on large phones. Touch-friendly targets ≥ 44px. |
| Accessibility | WCAG 2.2 AA target; readable fonts, reading-level target ~ages 9–11, audio narration deferred. |
| Performance | First load < 3s on a mid-range Android over 4G [Assumption: global audience includes low-bandwidth regions]. |
| Bandwidth | Illustrations as optimised inline SVG/WebP; no autoplay video. |
| Localisation | English for MVP with globally relatable examples (lemonade stands, school snacks, crafts, apps); copy kept separable so other languages can be added later. |
| Availability | Hackathon MVP: best effort on Vercel + Supabase free/pro tiers. |
| Safety | See `CHILD_SAFETY_AND_PRIVACY.md`. |

---

## 5. Out of scope for MVP (explicitly)

- Child-to-child or child-to-adult messaging of any kind
- Public galleries / leaderboards of children's work
- Uploading external files (PPTX/PDF/images)
- Real money, payments, real fundraising or investment, real crypto, tokens, NFTs, child wallets
- Any real child data in demos (demo profiles are fictional)
- AI-generated feedback or content
- Independent child logins (email/password for children)
- Native mobile apps
- Educator classrooms (designed-for, deferred)

---

## 6. Success metrics (hackathon demo)

- A new parent can sign up, consent, create a child profile and reach the child dashboard in < 3 minutes.
- A child can complete one module end-to-end, create a project, play a simulator session, build a deck and receive investor feedback in a single ~30-minute demo.
- A certificate can be issued and verified via a public link that reveals no personal data.

## 7. Open product questions

See `PHASE_0_REPORT.md` §6 for the consolidated list requiring approval.
