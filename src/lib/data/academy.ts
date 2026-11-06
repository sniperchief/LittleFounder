import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { asTone, type Tone } from "@/components/academy/module-visuals";

// Founder Academy reads for Child Mode. Queries run as the signed-in parent (RLS limits
// progress to their family). Content comes from the database, where answer keys,
// hints, explanations and feedback are not readable by clients.

export type LessonStatus = "completed" | "available" | "locked";

export type LessonSummary = {
  id: string;
  key: string;
  title: string;
  position: number;
  minutes: number;
  status: LessonStatus;
};

export type ModuleOverview = {
  id: string;
  key: string;
  position: number;
  title: string;
  summary: string;
  icon: string;
  tone: Tone;
  lessons: LessonSummary[];
  completedLessons: number;
  quiz: { id: string; passMark: number; unlocked: boolean; attempts: number; bestScore: number | null; passed: boolean } | null;
  completed: boolean;
};

export type NextStep =
  | { kind: "lesson"; module: ModuleOverview; lesson: LessonSummary }
  | { kind: "quiz"; module: ModuleOverview }
  | { kind: "done" };

export type AcademyOverview = {
  modules: ModuleOverview[];
  lessonsCompleted: number;
  lessonsTotal: number;
  modulesCompleted: number;
  next: NextStep;
};

export async function getAcademyOverview(supabase: SupabaseClient, childId: string): Promise<AcademyOverview> {
  const [modules, lessons, progress, quizzes, attempts] = await Promise.all([
    supabase.from("modules").select("id, key, position, title, summary, icon_key, tone").order("position"),
    supabase.from("lessons").select("id, module_id, key, title, position, est_minutes").order("position"),
    supabase.from("lesson_progress").select("lesson_id").eq("child_id", childId).eq("status", "completed"),
    supabase.from("quizzes").select("id, module_id, pass_mark"),
    supabase.from("quiz_attempts").select("quiz_id, score, passed").eq("child_id", childId).not("submitted_at", "is", null),
  ]);
  const failed = [modules, lessons, progress, quizzes, attempts].find((r) => r.error);
  if (failed) throw new Error("Could not load the Founder Academy.");

  const done = new Set((progress.data ?? []).map((p) => p.lesson_id as string));

  const overview: ModuleOverview[] = (modules.data ?? []).map((m) => {
    let previousDone = true;
    const moduleLessons: LessonSummary[] = (lessons.data ?? [])
      .filter((l) => l.module_id === m.id)
      .map((l) => {
        const completed = done.has(l.id);
        const status: LessonStatus = completed ? "completed" : previousDone ? "available" : "locked";
        previousDone = completed;
        return { id: l.id, key: l.key, title: l.title, position: l.position, minutes: l.est_minutes, status };
      });
    const completedLessons = moduleLessons.filter((l) => l.status === "completed").length;
    const allLessonsDone = moduleLessons.length > 0 && completedLessons === moduleLessons.length;
    const quizRow = (quizzes.data ?? []).find((q) => q.module_id === m.id);
    const quizAttempts = (attempts.data ?? []).filter((a) => quizRow && a.quiz_id === quizRow.id);
    const scores = quizAttempts.map((a) => a.score as number);
    const quiz = quizRow
      ? {
          id: quizRow.id as string,
          passMark: quizRow.pass_mark as number,
          unlocked: allLessonsDone,
          attempts: quizAttempts.length,
          bestScore: scores.length ? Math.max(...scores) : null,
          passed: quizAttempts.some((a) => a.passed),
        }
      : null;
    return {
      id: m.id,
      key: m.key,
      position: m.position,
      title: m.title,
      summary: m.summary,
      icon: m.icon_key,
      tone: asTone(m.tone),
      lessons: moduleLessons,
      completedLessons,
      quiz,
      completed: allLessonsDone && (quiz ? quiz.passed : true),
    };
  });

  let next: NextStep = { kind: "done" };
  for (const m of overview) {
    const lesson = m.lessons.find((l) => l.status === "available");
    if (lesson) {
      next = { kind: "lesson", module: m, lesson };
      break;
    }
    if (m.quiz && m.quiz.unlocked && !m.quiz.passed) {
      next = { kind: "quiz", module: m };
      break;
    }
  }

  return {
    modules: overview,
    lessonsCompleted: overview.reduce((n, m) => n + m.completedLessons, 0),
    lessonsTotal: overview.reduce((n, m) => n + m.lessons.length, 0),
    modulesCompleted: overview.filter((m) => m.completed).length,
    next,
  };
}

// ---------------------------------------------------------------------------
// Lesson content
// ---------------------------------------------------------------------------

export type Block =
  | { type: "text"; heading?: string; body: string }
  | { type: "example"; title: string; body: string; scene?: string }
  | { type: "scenario"; title: string; body: string }
  | { type: "keyIdea"; body: string }
  | { type: "list"; heading: string; items: string[] }
  | { type: "steps"; heading: string; items: { title: string; body: string }[] }
  | { type: "table"; caption: string; columns: [string, string]; rows: [string, string][] };

export type LessonBody = { intro: string; blocks: Block[]; reflect: string; takeaway: string };

/** Activity as the browser sees it: prompt and labels only, never the answer key. */
export type PublicActivity =
  | { key: string; kind: "choose"; prompt: string; multi: boolean; options: string[] }
  | { key: string; kind: "sort"; prompt: string; buckets: [string, string]; items: string[] }
  | { key: string; kind: "fill"; prompt: string; prefix: string | null; suffix: string | null };

export type LessonPage = {
  module: ModuleOverview;
  lesson: LessonSummary;
  body: LessonBody;
  activity: PublicActivity | null;
  activitySolved: boolean;
  previous: LessonSummary | null;
  next: LessonSummary | null;
};

export async function getLessonPage(
  supabase: SupabaseClient,
  childId: string,
  moduleKey: string,
  lessonKey: string,
): Promise<LessonPage | null> {
  const overview = await getAcademyOverview(supabase, childId);
  const academyModule = overview.modules.find((m) => m.key === moduleKey);
  const index = academyModule?.lessons.findIndex((l) => l.key === lessonKey) ?? -1;
  if (!academyModule || index < 0) return null;
  const lesson = academyModule.lessons[index];

  const [content, activity] = await Promise.all([
    supabase.from("lessons").select("body").eq("id", lesson.id).single(),
    supabase.from("lesson_activities").select("id, key, kind, config").eq("lesson_id", lesson.id).maybeSingle(),
  ]);
  if (content.error || activity.error) throw new Error("Could not load the lesson.");

  let activitySolved = false;
  if (activity.data) {
    const solved = await supabase
      .from("activity_responses")
      .select("id")
      .eq("child_id", childId)
      .eq("activity_id", activity.data.id)
      .eq("is_correct", true)
      .limit(1);
    activitySolved = (solved.data?.length ?? 0) > 0;
  }

  return {
    module: academyModule,
    lesson,
    body: content.data.body as LessonBody,
    activity: activity.data ? toPublicActivity(activity.data.key, activity.data.kind, activity.data.config) : null,
    activitySolved,
    previous: academyModule.lessons[index - 1] ?? null,
    next: academyModule.lessons[index + 1] ?? null,
  };
}

function toPublicActivity(key: string, kind: string, config: Record<string, unknown>): PublicActivity | null {
  const prompt = String(config.prompt ?? "");
  if (kind === "choose") {
    return { key, kind, prompt, multi: Boolean(config.multi), options: (config.options as string[]) ?? [] };
  }
  if (kind === "sort") {
    return { key, kind, prompt, buckets: config.buckets as [string, string], items: (config.items as string[]) ?? [] };
  }
  if (kind === "fill") {
    return { key, kind, prompt, prefix: (config.prefix as string | null) ?? null, suffix: (config.suffix as string | null) ?? null };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------

export type QuizQuestionPublic = { id: string; position: number; prompt: string; options: { id: string; label: string }[] };

export async function getQuizQuestions(supabase: SupabaseClient, quizId: string): Promise<QuizQuestionPublic[]> {
  const { data: questions, error } = await supabase
    .from("quiz_questions")
    .select("id, position, prompt")
    .eq("quiz_id", quizId)
    .order("position");
  if (error) throw new Error("Could not load the quiz.");
  const ids = (questions ?? []).map((q) => q.id as string);
  const { data: options, error: optionsError } = await supabase
    .from("quiz_options")
    .select("id, question_id, position, label")
    .in("question_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
    .order("position");
  if (optionsError) throw new Error("Could not load the quiz.");
  return (questions ?? []).map((q) => ({
    id: q.id,
    position: q.position,
    prompt: q.prompt,
    options: (options ?? []).filter((o) => o.question_id === q.id).map((o) => ({ id: o.id, label: o.label })),
  }));
}

export type QuizResult = {
  status: string;
  score: number;
  passed: boolean;
  correct: number;
  total: number;
  pass_mark: number;
  results: {
    question_id: string;
    chosen_option_id: string | null;
    correct_option_id: string;
    is_correct: boolean;
    feedback: string | null;
    explanation: string;
  }[];
  achievements?: string[];
};

// ---------------------------------------------------------------------------
// Founder Passport
// ---------------------------------------------------------------------------

export type Badge = {
  key: string;
  title: string;
  description: string;
  icon: string;
  tier: number;
  earnedAt: string | null;
};

export type Passport = {
  badges: Badge[];
  certificates: { title: string; issuedAt: string; code: string }[];
  activitiesSolved: number;
  quizzesPassed: number;
  perfectQuizzes: number;
};

export async function getPassport(supabase: SupabaseClient, childId: string): Promise<Passport> {
  const [catalogue, earned, certificates, solved, attempts] = await Promise.all([
    supabase.from("achievements").select("id, key, title, description, icon_key, tier"),
    supabase.from("child_achievements").select("achievement_id, earned_at").eq("child_id", childId),
    supabase
      .from("certificates")
      .select("issued_at, verification_code, certificate_types(title)")
      .eq("child_id", childId)
      .eq("status", "active"),
    supabase.from("activity_responses").select("activity_id").eq("child_id", childId).eq("is_correct", true),
    supabase.from("quiz_attempts").select("quiz_id, score, passed").eq("child_id", childId).not("submitted_at", "is", null),
  ]);
  const failed = [catalogue, earned, certificates, solved, attempts].find((r) => r.error);
  if (failed) throw new Error("Could not load the Founder Passport.");

  const earnedAt = new Map((earned.data ?? []).map((e) => [e.achievement_id as string, e.earned_at as string]));
  const badges: Badge[] = (catalogue.data ?? []).map((a) => ({
    key: a.key,
    title: a.title,
    description: a.description,
    icon: a.icon_key,
    tier: a.tier,
    earnedAt: earnedAt.get(a.id) ?? null,
  }));

  return {
    badges,
    certificates: (certificates.data ?? []).flatMap((c) => {
      const type = Array.isArray(c.certificate_types) ? c.certificate_types[0] : c.certificate_types;
      return type ? [{ title: type.title as string, issuedAt: c.issued_at as string, code: c.verification_code as string }] : [];
    }),
    activitiesSolved: new Set((solved.data ?? []).map((s) => s.activity_id as string)).size,
    quizzesPassed: new Set((attempts.data ?? []).filter((a) => a.passed).map((a) => a.quiz_id as string)).size,
    perfectQuizzes: new Set((attempts.data ?? []).filter((a) => a.score === 100).map((a) => a.quiz_id as string)).size,
  };
}

/** Titles for achievement keys returned by the scoring functions. */
export async function getAchievementTitles(supabase: SupabaseClient, keys: string[]) {
  if (keys.length === 0) return [];
  const { data } = await supabase.from("achievements").select("key, title, icon_key, description").in("key", keys);
  return (data ?? []).map((a) => ({ key: a.key as string, title: a.title as string, icon: a.icon_key as string, description: a.description as string }));
}
