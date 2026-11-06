"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireChildMode } from "@/lib/auth/session";
import { getAchievementTitles, type QuizResult } from "@/lib/data/academy";

// Founder Academy actions. Inputs are shape-checked here; scoring, unlocking and
// achievements are decided by SECURITY DEFINER functions in the database, which act
// only for the child in the account's active Child Mode.

const keySchema = z.string().regex(/^[a-z0-9-]{1,80}$/);
const responseSchema = z.union([
  z.object({ selected: z.array(z.number().int().min(0).max(20)).min(1).max(20) }).strict(),
  z.object({ placements: z.array(z.union([z.literal(0), z.literal(1)])).min(1).max(20) }).strict(),
  z.object({ value: z.number().finite().min(-1_000_000).max(1_000_000) }).strict(),
]);
const answersSchema = z.record(z.uuid(), z.uuid()).refine((a) => Object.keys(a).length <= 50);

export type ActivityResult =
  | { status: "ok"; correct: boolean; feedback: { option: number; correct: boolean; text: string }[]; wrong: number[]; explanation: string | null; hint: string | null }
  | { status: "error"; message: string };

const errorMessages: Record<string, string> = {
  locked: "Finish the lesson before this one first.",
  rate_limited: "Whoa, that's a lot of tries! Take a short break and come back.",
  invalid: "Something about that answer didn't look right. Try again.",
  not_in_child_mode: "Child Mode has ended. Ask your grown-up to start it again.",
  not_found: "We couldn't find that activity.",
  activity_required: "Solve the activity first, then finish the lesson.",
  incomplete: "Answer every question before you submit.",
};

export async function submitActivityAction(activityKey: string, response: unknown): Promise<ActivityResult> {
  const { supabase } = await requireChildMode();
  const key = keySchema.safeParse(activityKey);
  const body = responseSchema.safeParse(response);
  if (!key.success || !body.success) return { status: "error", message: errorMessages.invalid };

  const { data, error } = await supabase.rpc("submit_lesson_activity", { activity_key: key.data, response: body.data });
  if (error || !data) return { status: "error", message: "Something went wrong. Please try again." };
  if (data.status !== "ok") return { status: "error", message: errorMessages[data.status] ?? errorMessages.invalid };
  return {
    status: "ok",
    correct: Boolean(data.correct),
    feedback: data.feedback ?? [],
    wrong: data.wrong ?? [],
    explanation: data.explanation ?? null,
    hint: data.hint ?? null,
  };
}

export type EarnedBadge = { key: string; title: string; icon: string; description: string };

export type CompleteResult = { status: "ok"; badges: EarnedBadge[] } | { status: "error"; message: string };

export async function completeLessonAction(lessonKey: string): Promise<CompleteResult> {
  const { supabase } = await requireChildMode();
  const key = keySchema.safeParse(lessonKey);
  if (!key.success) return { status: "error", message: errorMessages.invalid };

  const { data, error } = await supabase.rpc("complete_lesson", { lesson_key: key.data });
  if (error || !data) return { status: "error", message: "Something went wrong. Please try again." };
  if (data.status !== "ok") return { status: "error", message: errorMessages[data.status] ?? errorMessages.invalid };

  revalidatePath("/play", "layout");
  return { status: "ok", badges: await getAchievementTitles(supabase, data.achievements ?? []) };
}

export type QuizSubmitResult = { status: "ok"; result: QuizResult; badges: EarnedBadge[] } | { status: "error"; message: string };

export async function submitQuizAction(moduleKey: string, answers: unknown): Promise<QuizSubmitResult> {
  const { supabase } = await requireChildMode();
  const key = keySchema.safeParse(moduleKey);
  const body = answersSchema.safeParse(answers);
  if (!key.success || !body.success) return { status: "error", message: errorMessages.invalid };

  const { data, error } = await supabase.rpc("submit_quiz", { module_key: key.data, answers: body.data });
  if (error || !data) return { status: "error", message: "Something went wrong. Please try again." };
  if (data.status !== "ok") return { status: "error", message: errorMessages[data.status] ?? errorMessages.invalid };

  revalidatePath("/play", "layout");
  return { status: "ok", result: data as QuizResult, badges: await getAchievementTitles(supabase, data.achievements ?? []) };
}
