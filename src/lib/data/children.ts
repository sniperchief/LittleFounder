import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

// Read helpers for the Parent Dashboard. All queries run as the signed-in parent,
// so Row-Level Security limits every result to their own family.
// Callers must have passed requireParent() first.

export type ChildSummary = {
  id: string;
  nickname: string;
  avatar_key: string;
  age_band: "10-11" | "12-13";
  is_demo: boolean;
  created_at: string;
};

export type RemovedChild = { id: string; nickname: string; deleted_at: string };

export const listChildren = cache(async (): Promise<ChildSummary[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("child_profiles")
    .select("id, nickname, avatar_key, age_band, is_demo, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error("Could not load child profiles.");
  return data as ChildSummary[];
});

export async function listRemovedChildren(): Promise<RemovedChild[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("child_profiles")
    .select("id, nickname, deleted_at")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  if (error) throw new Error("Could not load removed profiles.");
  return data as RemovedChild[];
}

export async function getChild(id: string): Promise<ChildSummary | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("child_profiles")
    .select("id, nickname, avatar_key, age_band, is_demo, created_at")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return (data as ChildSummary | null) ?? null;
}

export type ModuleProgress = {
  key: string;
  title: string;
  position: number;
  totalLessons: number;
  completedLessons: number;
  quizPassed: boolean;
  quizAttempts: number;
  quizBestScore: number | null;
  quizLastAt: string | null;
};

export type ChildActivity = {
  modules: ModuleProgress[];
  lessonsCompleted: number;
  lessonsAvailable: number;
  modulesCompleted: number;
  quiz: { attempts: number; passed: number; bestScore: number | null; averageScore: number | null };
  ideas: { id: string; name: string; status: string; icon_key: string; created_at: string; updated_at: string }[];
  simulationsCompleted: number;
  simulationsStarted: number;
  pitchDecks: { id: string; title: string; status: string; updated_at: string }[];
  achievements: { key: string; title: string; earned_at: string }[];
  certificates: { title: string; issued_at: string }[];
  lastActivityAt: string | null;
};

/** Real activity for one child. Every number comes from stored rows; nothing is invented. */
export async function getChildActivity(childId: string): Promise<ChildActivity> {
  const supabase = await createClient();

  const [modules, lessons, progress, quizzes, attempts, ideas, sims, decks, achievements, certificates] = await Promise.all([
    supabase.from("modules").select("id, key, title, position").order("position"),
    supabase.from("lessons").select("id, module_id"),
    supabase.from("lesson_progress").select("lesson_id, status, completed_at").eq("child_id", childId),
    supabase.from("quizzes").select("id, module_id"),
    supabase.from("quiz_attempts").select("quiz_id, score, passed, submitted_at").eq("child_id", childId),
    supabase
      .from("startup_projects")
      .select("id, name, status, icon_key, created_at, updated_at")
      .eq("child_id", childId)
      .neq("status", "archived")
      .order("updated_at", { ascending: false }),
    supabase.from("simulator_sessions").select("status").eq("child_id", childId),
    supabase
      .from("pitch_decks")
      .select("id, title, status, updated_at")
      .eq("child_id", childId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("child_achievements")
      .select("earned_at, achievements(key, title)")
      .eq("child_id", childId)
      .order("earned_at", { ascending: false }),
    supabase
      .from("certificates")
      .select("issued_at, certificate_types(title)")
      .eq("child_id", childId)
      .eq("status", "active"),
  ]);

  const failed = [modules, lessons, progress, quizzes, attempts, ideas, sims, decks, achievements, certificates].find(
    (r) => r.error,
  );
  if (failed) throw new Error("Could not load activity.");

  const completedLessonIds = new Set(
    (progress.data ?? []).filter((p) => p.status === "completed").map((p) => p.lesson_id as string),
  );
  const submitted = (attempts.data ?? []).filter((a) => a.submitted_at && a.score !== null);
  const passedQuizIds = new Set(submitted.filter((a) => a.passed).map((a) => a.quiz_id as string));

  const moduleProgress: ModuleProgress[] = (modules.data ?? []).map((m) => {
    const moduleLessons = (lessons.data ?? []).filter((l) => l.module_id === m.id);
    const quiz = (quizzes.data ?? []).find((q) => q.module_id === m.id);
    const quizAttempts = quiz ? submitted.filter((a) => a.quiz_id === quiz.id) : [];
    return {
      key: m.key,
      title: m.title,
      position: m.position,
      totalLessons: moduleLessons.length,
      completedLessons: moduleLessons.filter((l) => completedLessonIds.has(l.id)).length,
      quizPassed: quiz ? passedQuizIds.has(quiz.id) : false,
      quizAttempts: quizAttempts.length,
      quizBestScore: quizAttempts.length ? Math.max(...quizAttempts.map((a) => a.score as number)) : null,
      quizLastAt: quizAttempts.map((a) => a.submitted_at as string).sort().at(-1) ?? null,
    };
  });

  const scores = submitted.map((a) => a.score as number);
  const timestamps = [
    ...(progress.data ?? []).map((p) => p.completed_at as string | null),
    ...submitted.map((a) => a.submitted_at as string | null),
  ].filter((t): t is string => Boolean(t));

  return {
    modules: moduleProgress,
    lessonsCompleted: completedLessonIds.size,
    lessonsAvailable: (lessons.data ?? []).length,
    modulesCompleted: moduleProgress.filter(
      (m) => m.totalLessons > 0 && m.completedLessons === m.totalLessons && m.quizPassed,
    ).length,
    quiz: {
      attempts: submitted.length,
      passed: passedQuizIds.size,
      bestScore: scores.length ? Math.max(...scores) : null,
      averageScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    },
    ideas: ideas.data ?? [],
    simulationsCompleted: (sims.data ?? []).filter((s) => s.status === "completed").length,
    simulationsStarted: (sims.data ?? []).length,
    pitchDecks: decks.data ?? [],
    achievements: (achievements.data ?? []).flatMap((a) => {
      const ach = Array.isArray(a.achievements) ? a.achievements[0] : a.achievements;
      return ach ? [{ key: ach.key as string, title: ach.title as string, earned_at: a.earned_at as string }] : [];
    }),
    certificates: (certificates.data ?? []).flatMap((c) => {
      const type = Array.isArray(c.certificate_types) ? c.certificate_types[0] : c.certificate_types;
      return type ? [{ title: type.title as string, issued_at: c.issued_at as string }] : [];
    }),
    lastActivityAt: timestamps.sort().at(-1) ?? null,
  };
}
