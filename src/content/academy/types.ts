// Founder Academy content model. Authored here, seeded into the database by
// `npm run content:seed` (scripts/generate-seed.mjs → supabase/seed.sql).
//
// These files contain answer keys. The app never imports them: lesson pages read
// content from the database, where answer keys, hints and explanations are hidden
// by column grants and only returned by the scoring functions after an attempt.
// (src/content/modules.ts holds the public module outline for the landing page.)
//
// Keep this file free of runtime code so Node can load it with type stripping.

export type ModuleTone = "sun" | "coral" | "sky" | "mint" | "grape" | "rose";
export type ModuleIcon = "lightbulb" | "sparkles" | "users" | "coins" | "presentation" | "handshake";

/** Illustrated callouts the lesson page knows how to draw. */
export type Scene =
  | "magnifier" | "lightbulb" | "bridge" | "brainstorm" | "check" | "prototype" | "people"
  | "question" | "chart" | "costs" | "price-tag" | "profit" | "story" | "pitch" | "stage"
  | "investor" | "pie" | "checklist";

export type Block =
  | { type: "text"; heading?: string; body: string }
  | { type: "example"; title: string; body: string; scene?: Scene }
  | { type: "scenario"; title: string; body: string }
  | { type: "keyIdea"; body: string }
  | { type: "list"; heading: string; items: string[] }
  | { type: "steps"; heading: string; items: { title: string; body: string }[] }
  | { type: "table"; caption: string; columns: [string, string]; rows: [string, string][] };

type ActivityBase = { prompt: string; explanation: string };

/** Pick the right option(s). Every option has feedback shown after it is chosen. */
export type ChooseActivity = ActivityBase & {
  kind: "choose";
  multi?: boolean;
  options: { label: string; correct?: true; feedback: string }[];
};

/** Put each card in one of two groups. */
export type SortActivity = ActivityBase & {
  kind: "sort";
  buckets: [string, string];
  items: { label: string; bucket: 0 | 1 }[];
  hint: string;
};

/** Work out a number. */
export type NumberActivity = ActivityBase & {
  kind: "fill";
  prefix?: string;
  suffix?: string;
  answer: number;
  hint: string;
};

export type Activity = ChooseActivity | SortActivity | NumberActivity;

export type Lesson = {
  key: string;
  title: string;
  minutes: number;
  intro: string;
  blocks: Block[];
  /** "Talk it over" prompt. Never collected — children are told not to type answers anywhere. */
  reflect: string;
  activity: Activity;
  takeaway: string;
};

export type QuizQuestion = {
  key: string;
  prompt: string;
  options: { label: string; correct?: true; feedback: string }[];
  explanation: string;
};

export type AcademyModuleContent = {
  key: string;
  position: number;
  title: string;
  summary: string;
  icon: ModuleIcon;
  tone: ModuleTone;
  badge: { key: string; title: string; description: string };
  lessons: Lesson[];
  quiz: { passMark: number; questions: QuizQuestion[] };
};

export type AchievementContent = {
  key: string;
  title: string;
  description: string;
  icon: string;
  tier: 1 | 2 | 3;
  rule:
    | { type: "lessons_completed"; count: number }
    | { type: "module_completed"; module: string }
    | { type: "modules_completed"; count: number }
    | { type: "perfect_quiz" }
    | { type: "ideas_created"; count: number }
    | { type: "simulations_completed"; count: number }
    | { type: "pitches_completed"; count: number }
    | { type: "practices_completed"; count: number };
};

/**
 * A Founder Passport credential: a learning milestone issued from stored, server-verified
 * progress (docs/CREDENTIALS.md). `anchorable` milestones may get an anonymous public proof
 * on Base Sepolia, but only after a parent opts in for that child.
 */
export type CertificateContent = {
  key: string;
  title: string;
  description: string;
  anchorable: boolean;
  requirement: { type: "modules_completed"; count: number } | { type: "practice_score"; min: number };
};
