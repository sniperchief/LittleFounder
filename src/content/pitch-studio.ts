// Pitch Studio & Investor Room public content (Phase 6). Rules: docs/PITCH_STUDIO.md.
//
// Used by the pitch builder in the browser, by server-side validation and by
// scripts/check-db.mjs (which checks these rules match the database functions in
// supabase/migrations/20261106001000_pitch_studio.sql — keep them in sync).
// No answer keys here: investor questions and their scores live in investor-room.ts,
// which only the seed generator reads. Keep this file free of imports (Node loads it).

export const pitchLimits = {
  title: 60,
  tagline: 160,
  main: 280,
  extra: 200,
  note: 200,
  /** Shortest answer that counts as "filled in" for a required section. */
  minRequired: 10,
  maxPitches: 20,
} as const;

export type PitchSectionKey = "problem" | "solution" | "customer" | "business_model" | "ask";

export type PitchSection = {
  key: PitchSectionKey;
  title: string;
  short: string;
  question: string;
  required: boolean;
  /** What this part of a pitch is, in child-friendly words. */
  explain: string;
  example: string;
  mainLabel: string;
  mainPlaceholder: string;
  extraLabel: string;
  extraPlaceholder: string;
  tone: string;
};

export const pitchSections: PitchSection[] = [
  {
    key: "problem",
    title: "The Problem",
    short: "Problem",
    question: "What problem are you trying to solve?",
    required: true,
    explain:
      "Every good pitch starts with a problem people really have. If listeners recognise the problem, they'll want to hear how you fix it.",
    example: "Lots of dogs get bored and chew things when their families are out at school and work.",
    mainLabel: "What problem are you trying to solve?",
    mainPlaceholder: "Describe the problem in a sentence or two",
    extraLabel: "Who has it, and how often?",
    extraPlaceholder: "e.g. Families with dogs, every weekday",
    tone: "bg-coral-soft",
  },
  {
    key: "solution",
    title: "Your Solution",
    short: "Solution",
    question: "How does your idea solve that problem?",
    required: true,
    explain:
      "Now explain your idea and how it fixes the problem. Keep it simple — if a friend could explain it back to you, you've nailed it.",
    example: "Puzzle Pup is a feeder made from recycled boxes. Dogs solve little puzzles to get treats, so they stay busy.",
    mainLabel: "How does your idea solve the problem?",
    mainPlaceholder: "Say what your idea is and how it works",
    extraLabel: "What makes it special?",
    extraPlaceholder: "e.g. It's cheaper and kinder to the planet than plastic toys",
    tone: "bg-sun-soft",
  },
  {
    key: "customer",
    title: "Your Customers",
    short: "Customers",
    question: "Who would use or buy your product?",
    required: true,
    explain:
      "Customers are the people your business is for. Sometimes the person who uses something isn't the person who pays for it — that's fine, just say who's who.",
    example: "Dog owners with busy days. Parents usually buy it, and dogs (and kids!) get to enjoy it.",
    mainLabel: "Who would use or buy it?",
    mainPlaceholder: "Describe your customers",
    extraLabel: "Why would they want it?",
    extraPlaceholder: "e.g. They want a happy dog and a tidy house",
    tone: "bg-sky-soft",
  },
  {
    key: "business_model",
    title: "Your Business Model",
    short: "Money",
    question: "How would the business make money?",
    required: true,
    explain:
      "A business model is your plan for money: what you charge, what it costs you, and what's left over. You don't need exact numbers — a sensible plan is enough.",
    example: "We'd sell each feeder for a price that's more than the boxes and treats cost, so every sale makes a little profit.",
    mainLabel: "How would your business make money?",
    mainPlaceholder: "Who pays, and roughly what would you charge?",
    extraLabel: "What would it cost to make or run?",
    extraPlaceholder: "e.g. Cardboard, glue and treats",
    tone: "bg-mint-soft",
  },
  {
    key: "ask",
    title: "Your Opportunity",
    short: "Next steps",
    question: "What would you do next, and what would you use pretend funding for?",
    required: false,
    explain:
      "Finish by showing where your idea could go next. Investors like a clear next step — and a sensible plan for any extra (pretend) funding.",
    example: "Next I'd test 10 feeders with friends' dogs. Pretend funding would buy better materials for a stronger design.",
    mainLabel: "What would you do next?",
    mainPlaceholder: "Your next steps",
    extraLabel: "What would you use pretend funding for?",
    extraPlaceholder: "e.g. Materials to build better prototypes",
    tone: "bg-grape-soft",
  },
];

export const pitchThemes = [
  { key: "sunrise", label: "Sunrise", slide: "bg-sun-soft", accent: "bg-sun" },
  { key: "ocean", label: "Ocean", slide: "bg-sky-soft", accent: "bg-sky" },
  { key: "meadow", label: "Meadow", slide: "bg-mint-soft", accent: "bg-mint" },
  { key: "berry", label: "Berry", slide: "bg-grape-soft", accent: "bg-grape" },
] as const;

export type PitchThemeKey = (typeof pitchThemes)[number]["key"];

/** Builder steps: the five sections, then the title slide and finish. */
export const pitchSteps = [...pitchSections.map((s) => ({ key: s.key, short: s.short, title: s.title })), { key: "finish", short: "Finish", title: "Title slide & finish" }];

/** The flat field names the builder saves (also the database allow-list). */
export const pitchTextFields = pitchSections.flatMap((s) => [s.key, `${s.key}_extra`]) as string[];

/**
 * Personal details check. Pitch Studio does not store anything that looks like contact
 * details: the builder shows the message as a nudge and the server refuses to save it.
 * Mirrors public.pitch_personal_info() in the database.
 */
export function pitchPrivacyIssue(text: string): string | null {
  if (/[a-z0-9._%+-]+@[a-z0-9-]+\.[a-z.]+/i.test(text)) return "That looks like an email address. Founders keep personal details private!";
  if (/(\+?\d[ -]?){7,}/.test(text)) return "That looks like a phone number. Founders keep personal details private!";
  if (/https?:\/\/|www\./i.test(text) || /\b[a-z0-9-]+\.(com|net|org|io|co|uk|app|dev|me|info|biz)\b/i.test(text))
    return "Links and website addresses aren't allowed here. Just describe your idea in your own words.";
  if (/\b\d{1,4}\s+[a-z]+\s+(street|st|road|rd|avenue|ave|lane|close|drive)\b/i.test(text))
    return "That looks like a home address. Founders keep personal details private!";
  if (/(^|\s)@[a-z0-9_]{2,}/i.test(text)) return "That looks like a social media name. Founders keep personal details private!";
  return null;
}

// ---------------------------------------------------------------------------
// Investor Room rubric (scoring happens only in the database)
// ---------------------------------------------------------------------------

/** "Own words" bonus: at least 6 words, at least 4 of them different. Mirrors the database. */
export const ownWordsRule = { minWords: 6, minDistinct: 4 } as const;

export function ownWordsCount(note: string) {
  const words = note
    .trim()
    .split(/\s+/)
    .filter((w) => /\p{L}/u.test(w));
  return { words: words.length, distinct: new Set(words.map((w) => w.toLowerCase())).size };
}

export function earnsOwnWordsBonus(note: string) {
  const { words, distinct } = ownWordsCount(note);
  return words >= ownWordsRule.minWords && distinct >= ownWordsRule.minDistinct;
}

/** The five rubric criteria, one per pitch section (each scored 0–4). */
export const rubricCriteria: { section: PitchSectionKey; label: string; strength: string; tip: string }[] = [
  {
    section: "problem",
    label: "Problem clarity",
    strength: "You explained clearly why the problem matters and who has it.",
    tip: "Make your problem specific: say who has it, how often, and how you know (for example, people you asked).",
  },
  {
    section: "solution",
    label: "Solution explanation",
    strength: "You explained how your solution works and why it's better.",
    tip: "Explain your solution step by step, and say one clear way it's better than what people do now.",
  },
  {
    section: "customer",
    label: "Customer understanding",
    strength: "You showed you understand your customers and what they want.",
    tip: "Find out what customers really want by asking a few of them — then use what they said in your pitch.",
  },
  {
    section: "business_model",
    label: "Business model understanding",
    strength: "You showed how the business would cover its costs and make money.",
    tip: "Compare your price with your costs. If the price is higher, every sale leaves a little profit.",
  },
  {
    section: "ask",
    label: "Next-step planning",
    strength: "You have a clear, sensible next step for your idea.",
    tip: "Pick one small next step you could actually do soon, like building a prototype or asking five people.",
  },
];

export const ownWordsTip = "Add your own words to each answer. Explaining in your own way earns a bonus point and builds confidence.";

export const bands = [
  { key: "ready_to_grow", label: "Ready to grow", min: 80, message: "Brilliant practice! Your answers were clear and well thought through." },
  { key: "promising", label: "Promising", min: 50, message: "Great effort! You've got strong answers, and a few areas to polish." },
  { key: "keep_building", label: "Keep building", min: 0, message: "Good start! Every founder practises lots — try the tips below and have another go." },
] as const;

export const bandOf = (key: string | null) => bands.find((b) => b.key === key) ?? bands[2];

export function answerLevel(points: number) {
  if (points >= 3) return { label: "Strong answer", tone: "bg-mint" };
  if (points >= 1) return { label: "Good start", tone: "bg-sun" };
  return { label: "Let's improve this", tone: "bg-coral-soft" };
}
