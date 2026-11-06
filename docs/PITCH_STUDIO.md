# LITTLE FOUNDERS — Pitch Studio & Investor Room rules (Phase 6)

Children turn one of their Idea Lab ideas into a five-part pitch, see it as a six-slide deck, then practise answering questions from friendly **pretend investors**. Everything is deterministic: there is no AI and no external service. The deck is drawn only from the child's saved answers, and practice feedback comes from fixed scores and predefined messages.

The investors are made-up characters. They never make investment decisions, promise funding, mention real money or imply a real person has reviewed the idea. Every Investor Room screen says "pretend investor" and "practice feedback".

Sources of truth:

| What | Where |
|---|---|
| Sections, limits, privacy check, own-words rule, rubric labels, tips, bands | `src/content/pitch-studio.ts` (public; used by the app) |
| Personas, questions, answer options, **scores** and feedback | `src/content/investor-room.ts` (seed only; the app never imports it) |
| All validation, scoring and history rules | `supabase/migrations/20261106001000_pitch_studio.sql` |

`npm run content:seed` copies the investor bank into `investor_personas`, `investor_questions` and `investor_answer_options`. Option scores and feedback are hidden from clients by column grants until the child has answered. `npm run db:check` verifies that the TypeScript and SQL versions of the privacy check and the own-words rule agree.

## 1. Pitch structure

| # | Section (key) | Question | Required? | Main answer | Extra (always optional) |
|---|---|---|---|---|---|
| 1 | The Problem (`problem`) | What problem are you trying to solve? | **Required** | ≤ 280 chars | Who has it, and how often? (≤ 200) |
| 2 | Your Solution (`solution`) | How does your idea solve that problem? | **Required** | ≤ 280 | What makes it special? (≤ 200) |
| 3 | Your Customers (`customer`) | Who would use or buy your product? | **Required** | ≤ 280 | Why would they want it? (≤ 200) |
| 4 | Your Business Model (`business_model`) | How would the business make money? | **Required** | ≤ 280 | What would it cost to make or run? (≤ 200) |
| 5 | Your Opportunity (`ask`) | What would you do next, and what would you use pretend funding for? | Optional | ≤ 280 | What would you use pretend funding for? (≤ 200) |

The title slide has a **business name** (required, 2–60 chars), a **short description** (optional, ≤ 160), a preset **icon** (the Idea Lab icon list) and a preset **colour theme** (`sunrise`, `ocean`, `meadow`, `berry`).

A required section counts as filled in when its main answer has at least **10 characters** (after trimming). Each builder step shows a child-friendly explanation, an example and a live preview of that slide.

### Prefill from the Idea Lab idea

Any of the child's ideas (draft or created) can start a pitch. One pitch per idea: starting again opens the existing pitch.

| Pitch field | Filled from |
|---|---|
| Business name, icon | Idea name, idea icon |
| Short description | Idea "in one sentence" (`value_statement`) |
| Problem / extra | `problem` / "Who has it: {problem_who}. How often: {frequency}." |
| Solution / extra | `solution` / "{solution_benefit}. It's {special tags}." |
| Customers | "{customer tags}." + `target_customer_note` |
| Business model | "{Buyer} would pay for it." (or the sponsor sentence when the idea is free) |
| Business model extra | Latest completed **Startup Simulator "My idea"** run for this idea, if any: "In my Startup Simulator practice I made X FB profit selling at Y FB each (pretend money)." |
| Opportunity | "My next step: {first step}." |

Anything that would be refused (too long, or matching the privacy check; Idea Lab only nudges about personal details, it doesn't block them) is left blank instead. The child can edit everything.

### Privacy check (blocking)

Pitch text and typed investor answers are **refused** (the builder shows a nudge first and won't send) when they look like:

- an email address, e.g. `name@example.com`
- a phone number: 7 or more digits, optionally separated by spaces or hyphens
- a link: `http://`, `https://`, `www.` or a bare domain ending `.com .net .org .io .co .uk .app .dev .me .info .biz`
- a street address: 1–4 digits, a word, then street/st/road/rd/avenue/ave/lane/close/drive
- a social handle: `@` followed by 2+ letters, digits or underscores

Same patterns in `pitchPrivacyIssue()` (TS) and `public.pitch_personal_info()` (SQL). The builder never asks for names, contact details or uploads.

### Drafts, finishing and versions

- Every step change or "Save draft" stores the answers and the current step (`pitch_decks.builder_step`), so the child can resume later.
- **Finish** checks the name and the four required sections. If anything is missing, the answers are still saved and the child sees which parts to complete.
- Finishing stores an immutable **version** (`pitch_versions`: v1, v2, …) holding a full snapshot. Finishing again with no changes adds nothing.
- Editing a finished pitch marks it **Revising** (`status = draft` with at least one version). Earlier versions and their practice results are never changed. Undoing the edits makes it **Completed** again. Finishing the revision saves the next version.

## 2. Pitch deck

Generated from the saved pitch, never from AI: a **title slide** (icon, name, short description) plus **one slide per section** (question, main answer, extra answer panel). Empty optional sections show "Not added yet".

- Overview grid on the pitch page (the latest finished version, or the draft).
- **Present mode** (`/play/pitch/[id]/present`): one slide at a time, Previous/Next, slide dots, arrow keys and a full-screen button. `?version=N` shows a finished version exactly as it was.
- "Edit slides" returns to the builder. There are no uploads, exports to other services or public links.

## 3. Investor Room

Needs a finished pitch and always uses the **latest finished version**. The practice stores a copy of that version (`investor_sessions.deck_snapshot`), so later edits never change it. The child picks one of four pretend investors. Each asks **five questions, one per rubric criterion, always in the same order**. For each question the child:

1. picks one of three predefined answers (shuffled into a fixed order by the seed), and
2. may add their own words (optional, ≤ 200 characters, privacy-checked).

Feedback appears straight away: a level ("Strong answer", "Good start", "Let's improve this"), the option's predefined feedback, the strongest answer when they didn't pick it, and whether they earned the own-words point. Answers are stored once and can't be changed. To try again, the child starts a new practice; unfinished practices resume.

## 4. Scoring rubric (deterministic)

Per question (= per criterion):

| Part | Points |
|---|---|
| Chosen answer | **3** strong · **1** partial · **0** off-track (fixed per option) |
| Own-words bonus | **+1** if the typed answer has **at least 6 words and at least 4 different words** (a word = whitespace-separated text containing a letter; capitals ignored) |

Each criterion scores **0–4**. Five criteria give **0–20 rubric points**, and the **practice score = round(points × 100 / 20)** (= points × 5).

| Criterion | Section |
|---|---|
| Problem clarity | `problem` |
| Solution explanation | `solution` |
| Customer understanding | `customer` |
| Business model understanding | `business_model` |
| Next-step planning | `ask` |

| Band | Practice score | Message |
|---|---|---|
| Ready to grow (`ready_to_grow`) | 80–100 | "Brilliant practice! Your answers were clear and well thought through." |
| Promising (`promising`) | 50–79 | "Great effort! You've got strong answers, and a few areas to polish." |
| Keep building (`keep_building`) | 0–49 | "Good start! Every founder practises lots — try the tips below and have another go." |

Feedback rules (all messages predefined in `src/content/pitch-studio.ts`):

- **What you explained well**: every criterion scoring **3 or 4** shows its strength message (or a "you finished, that takes courage" message if none).
- **Ideas to improve**: every criterion scoring **0–2** adds its tip, in question order (stored as `tips_keys`), followed by the own-words tip if any answer missed the bonus. Up to three are shown.
- Each answer's review keeps the question, the chosen answer, its feedback and the stronger answer (`investor_responses.review`), so history reads the same even if content is edited later.

Worked example (used in `db:check`, `db:check:remote` and the browser test), with Penny: strong + own words (4), partial (1), off-track with "dogs dogs dogs dogs dogs dogs" (0, the repeated word earns no bonus), strong + own words (4), strong (3). That's **12/20 → 60 → Promising**, with tips for Solution explanation, Customer understanding and own words. All strong answers with own words score 20/20 → 100 → Ready to grow.

`investor_sessions.decision` is constrained to `null`: pretend investors never record "invest" decisions.

## 5. Investor personalities and question sets

Option order on screen is a fixed shuffle. Scores are shown here for reviewers only.

### Penny the Planner (`penny`)

Focus: Money, costs and profit. Style: Precise and friendly.

> Hello! I'm Penny, a pretend investor who loves a good plan. I like to see how the numbers fit together — don't worry about being exact, I just want to see you've thought about it.

| # | Criterion | Question | Answer options (score) |
|---|---|---|---|
| 1 | Problem clarity | How do you know this problem is worth solving? | I asked people who have the problem, and most of them said it happens often. (**3**)<br>I think it's a problem because it annoys me. (**1**)<br>Every single person in the world has this problem. (**0**) |
| 2 | Solution explanation | What would it cost to make or run your solution? | I listed what I'd need, like materials and time, and guessed the cost of each. (**3**)<br>It wouldn't cost much, I think. (**1**)<br>Costs don't matter if the idea is good enough. (**0**) |
| 3 | Customer understanding | How many customers could you realistically reach at first? | A small group I can really reach, like my class or a club, then grow from there. (**3**)<br>Probably millions, once it becomes famous. (**1**)<br>I haven't thought about who would buy it. (**0**) |
| 4 | Business model understanding | How will your price cover your costs? | My price is more than each one costs to make, so every sale leaves some profit. (**3**)<br>I'd set my price the same as my costs. (**1**)<br>I'd charge whatever people feel like and work it out later. (**0**) |
| 5 | Next-step planning | If you had some pretend funding, what would you spend it on first? | Something that helps me test or improve my idea, like materials for a better prototype. (**3**)<br>A big launch party to celebrate. (**1**)<br>I'm not sure. I'd probably just keep it. (**0**) |

### Captain Customer (`captain`)

Focus: Who buys, and why. Style: Curious.

> Ahoy! I'm Captain Customer, a pretend investor. I'm always curious about the people your idea is for — let's find out how well you know them!

| # | Criterion | Question | Answer options (score) |
|---|---|---|---|
| 1 | Problem clarity | Who has this problem the most? | A specific group, like children who walk dogs before school, and I can explain why. (**3**)<br>Lots of different people, probably. (**1**)<br>I don't really know who has it. (**0**) |
| 2 | Solution explanation | Why would customers choose your idea instead of what they do now? | Mine is better in one clear way, like quicker or cheaper, and I can say how. (**3**)<br>Because mine is new. (**1**)<br>They wouldn't have any other choice. (**0**) |
| 3 | Customer understanding | How did you find out what your customers want? | I asked a few people who might use it what they think, and listened to their answers. (**3**)<br>I guessed, based on what I would want. (**1**)<br>Customers will want whatever I make. (**0**) |
| 4 | Business model understanding | Who pays: the person who uses it, or someone else? | I know who pays and why they'd be happy to, even if they're not the user. (**3**)<br>Whoever wants to, I suppose. (**1**)<br>I haven't decided if anyone pays. (**0**) |
| 5 | Next-step planning | What would you do next to learn more about your customers? | Let a few people try a simple version, then ask what they'd change. (**3**)<br>Make lots of them straight away and see what happens. (**1**)<br>Nothing. I already know enough. (**0**) |

### Inventor Ivy (`ivy`)

Focus: Solutions and creativity. Style: Enthusiastic.

> Hi hi! I'm Inventor Ivy, a pretend investor who loves clever ideas. I want to hear all about how your invention works and how you'll make it even better!

| # | Criterion | Question | Answer options (score) |
|---|---|---|---|
| 1 | Problem clarity | What made you notice this problem? | I saw it happen in real life, and I can describe a time it happened. (**3**)<br>Someone told me it might be a problem. (**1**)<br>I picked it because it sounded exciting. (**0**) |
| 2 | Solution explanation | How does your solution actually work? | I can explain it step by step, from start to finish. (**3**)<br>It's hard to explain, but it's really cool. (**1**)<br>I'll work out how it works later. (**0**) |
| 3 | Customer understanding | What would customers say after using your idea? | They'd say it fixed their problem, because I designed it around what they need. (**3**)<br>They'd say it looks nice. (**1**)<br>I don't know what they'd think. (**0**) |
| 4 | Business model understanding | How could your clever idea make money? | By selling it for a price people are happy to pay, which is more than it costs to make. (**3**)<br>It's so clever that money will just come in. (**1**)<br>Money isn't important for an invention. (**0**) |
| 5 | Next-step planning | How would you make your idea even better? | Build a prototype, test it and improve it based on what I learn. (**3**)<br>Add lots of extra features straight away. (**1**)<br>It's already perfect. (**0**) |

### Steady Sam (`sam`)

Focus: Risks and next steps. Style: Calm and careful.

> Hello there. I'm Steady Sam, a pretend investor. I like to think carefully about what could go wrong and what comes next. Take your time — there are no trick questions.

| # | Criterion | Question | Answer options (score) |
|---|---|---|---|
| 1 | Problem clarity | What happens if nobody solves this problem? | People keep losing time, money or fun, and I can give an example. (**3**)<br>Nothing much, but it would be nice to fix. (**1**)<br>I don't know. (**0**) |
| 2 | Solution explanation | What could go wrong with your solution, and what would you do? | I've thought of one thing that might go wrong and a way to handle it. (**3**)<br>Something might go wrong, but I'll worry about it later. (**1**)<br>Nothing could ever go wrong. (**0**) |
| 3 | Customer understanding | What would you do if your first customers didn't like it? | Ask them why, then change my idea using what they said. (**3**)<br>Look for different customers who might like it. (**1**)<br>Give up on the idea. (**0**) |
| 4 | Business model understanding | What would you do if it cost more to make than you expected? | Look for cheaper materials or change my price, then check the numbers again. (**3**)<br>Keep going and hope it works out. (**1**)<br>Just spend more without checking the numbers. (**0**) |
| 5 | Next-step planning | What is the very next small step you would take? | One small, clear step I could do this week, like sketching it or asking five people. (**3**)<br>Start a huge company straight away. (**1**)<br>Wait until someone else does it first. (**0**) |

## 6. Achievements

| Badge | Rule (`evaluate_achievements`) |
|---|---|
| **First Pitch** (`first-pitch`) | `pitches_completed ≥ 1`: at least one pitch with a finished version |
| **Confident Founder** (`confident-founder`) | `practices_completed ≥ 1`: at least one completed Investor Room practice |

Badges are inserted once per child (`child_achievements` primary key + `on conflict do nothing`); repeat pitches and practices never award them again. Founder Passport also shows pitches finished, practices completed and the best practice score.

## 7. Security and data integrity

- `pitch_decks`, `pitch_slides`, `pitch_versions`, `investor_sessions` and `investor_responses` are **read-only to clients**. Parents read their own family's rows through RLS (`is_guardian_of`).
- All writes go through `start_pitch`, `save_pitch`, `start_investor_practice` and `answer_investor_question` (SECURITY DEFINER). Each acts for `learning_child()`, the child in the caller's **active Child Mode**. No child id is accepted from the browser, and a sibling's or another family's pitch returns `not_found`.
- Fields are allow-listed, type- and length-checked, and privacy-checked in the server action (zod) **and** in the database.
- Triggers make finished versions, completed practices and stored answers immutable. Answers must follow the session's question order, and options must belong to their question.
- Limits: 20 pitches per child, 10 new pitches per hour, 10 finished versions per hour (30 per pitch), 20 practice starts per hour.
- Nothing is public: no sharing links, discovery, messaging or uploads. Nothing goes onchain.
- Deleting a child profile cascades to all pitch and practice rows.
