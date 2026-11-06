"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { ideaIcons } from "@/content/idea-lab";
import { pitchLimits, pitchPrivacyIssue, pitchSections, pitchThemes } from "@/content/pitch-studio";
import { requireChildMode } from "@/lib/auth/session";
import { getAchievementTitles } from "@/lib/data/academy";
import { getIdea } from "@/lib/data/ideas";
import { latestSimulationFor, prefillFromIdea } from "@/lib/data/pitch";
import { uuidSchema } from "@/lib/validation";

// Pitch Studio & Investor Room actions. Inputs are validated here; the database validates
// again (limits, privacy check, ownership from the account's active Child Mode), scores
// every investor answer and stores completed records as history.

const privateText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use ${max} characters or fewer.`)
    .refine((v) => !pitchPrivacyIssue(v), { message: "Please remove personal details, contact details or links." });

const fieldsSchema = z
  .object({
    title: privateText(pitchLimits.title),
    tagline: privateText(pitchLimits.tagline),
    icon_key: z.enum(ideaIcons),
    theme_key: z.enum(pitchThemes.map((t) => t.key) as [string, ...string[]]),
    ...Object.fromEntries(
      pitchSections.flatMap((s) => [
        [s.key, privateText(pitchLimits.main)],
        [`${s.key}_extra`, privateText(pitchLimits.extra)],
      ]),
    ),
  })
  .partial()
  .strict();

const messages: Record<string, string> = {
  invalid: "Something in your pitch doesn't look right. Check your answers and try again.",
  personal_info: "Please remove personal details, contact details or links — founders keep those private!",
  incomplete: "A few required parts still need a little more. Look for the sections marked to do.",
  not_found: "We couldn't find that pitch.",
  idea_required: "Pick one of your Idea Lab ideas to start a pitch.",
  limit_reached: `You already have ${pitchLimits.maxPitches} pitches. Keep improving one of those!`,
  rate_limited: "That's a lot of activity! Take a short break and come back.",
  pitch_not_finished: "Finish your pitch first, then the pretend investors can ask you questions.",
  already_completed: "This practice is finished — start a new one to try again.",
  out_of_order: "Let's answer the questions in order.",
  not_in_child_mode: "Child Mode has ended. Ask your grown-up to start it again.",
};

type Badge = { key: string; title: string; icon: string; description: string };

export async function startPitchAction(formData: FormData) {
  const { child, supabase } = await requireChildMode();
  const projectId = uuidSchema.safeParse(formData.get("projectId"));
  if (!projectId.success) redirect("/play/pitch?error=idea_required");
  // Only the active child's own idea can be used (the database checks this again).
  const idea = await getIdea(supabase, child.id, projectId.data);
  if (!idea) redirect("/play/pitch?error=idea_required");

  const prefill = prefillFromIdea(idea, await latestSimulationFor(supabase, child.id, idea.id));
  const { data } = await supabase.rpc("start_pitch", { project_id: idea.id, prefill });
  if (data?.status !== "ok") redirect(`/play/pitch?error=${encodeURIComponent(data?.status ?? "invalid")}`);
  revalidatePath("/play", "layout");
  redirect(data.resumed ? `/play/pitch/${data.id}` : `/play/pitch/${data.id}/edit?step=1&new=1`);
}

export type SavePitchResult =
  | { status: "ok"; deckStatus: "draft" | "ready"; version: number | null; badges: Badge[] }
  | { status: "error"; message: string; missing?: string[]; fieldErrors?: Record<string, string> };

export async function savePitchAction(deckId: string, fields: unknown, step: number, finish: boolean): Promise<SavePitchResult> {
  const { supabase } = await requireChildMode();
  const id = uuidSchema.safeParse(deckId);
  const body = fieldsSchema.safeParse(fields);
  const stepOk = Number.isInteger(step) && step >= 1 && step <= 6;
  if (!body.success) {
    const fieldErrors = Object.fromEntries(body.error.issues.map((i) => [String(i.path[0] ?? "form"), i.message]));
    const privacy = body.error.issues.some((i) => i.message.startsWith("Please remove"));
    return { status: "error", message: privacy ? messages.personal_info : messages.invalid, fieldErrors };
  }
  if (!id.success || !stepOk) return { status: "error", message: messages.invalid };

  const { data, error } = await supabase.rpc("save_pitch", { deck_id: id.data, fields: body.data, step, finish: Boolean(finish) });
  if (error || !data) return { status: "error", message: "Something went wrong. Please try again." };
  revalidatePath("/play", "layout");
  if (data.status !== "ok") {
    return { status: "error", message: messages[data.status] ?? messages.invalid, missing: data.missing ?? undefined };
  }
  return {
    status: "ok",
    deckStatus: data.deck_status,
    version: data.version ?? null,
    badges: await getAchievementTitles(supabase, data.achievements ?? []),
  };
}

export async function startPracticeAction(formData: FormData) {
  const { supabase } = await requireChildMode();
  const deckId = uuidSchema.safeParse(formData.get("deckId"));
  const persona = z.enum(["penny", "captain", "ivy", "sam"]).safeParse(formData.get("persona"));
  if (!deckId.success) redirect("/play/pitch");
  if (!persona.success) redirect(`/play/pitch/${deckId.data}/investor?error=invalid`);

  const { data } = await supabase.rpc("start_investor_practice", { deck_id: deckId.data, persona_key: persona.data });
  if (data?.status !== "ok") redirect(`/play/pitch/${deckId.data}/investor?error=${encodeURIComponent(data?.status ?? "invalid")}`);
  revalidatePath("/play", "layout");
  redirect(`/play/pitch/${deckId.data}/investor/${data.id}`);
}

export type AnswerResult =
  | {
      status: "ok";
      score: number;
      bonus: number;
      feedback: string;
      stronger: string | null;
      completed: boolean;
      badges: Badge[];
    }
  | { status: "error"; message: string };

export async function answerQuestionAction(sessionId: string, questionId: string, optionId: string, note: string): Promise<AnswerResult> {
  const { supabase } = await requireChildMode();
  const ids = z.tuple([uuidSchema, uuidSchema, uuidSchema]).safeParse([sessionId, questionId, optionId]);
  const text = privateText(pitchLimits.note).safeParse(note ?? "");
  if (!ids.success) return { status: "error", message: messages.invalid };
  if (!text.success) {
    const issue = text.error.issues[0]?.message ?? "";
    return { status: "error", message: issue.startsWith("Please remove") ? messages.personal_info : issue || messages.invalid };
  }

  const [session, question, option] = ids.data;
  const { data, error } = await supabase.rpc("answer_investor_question", {
    session_id: session,
    question_id: question,
    option_id: option,
    note: text.data,
  });
  if (error || !data) return { status: "error", message: "Something went wrong. Please try again." };
  if (data.status !== "ok") return { status: "error", message: messages[data.status] ?? messages.invalid };
  if (data.completed) revalidatePath("/play", "layout");
  return {
    status: "ok",
    score: data.score,
    bonus: data.bonus,
    feedback: data.feedback,
    stronger: data.stronger ?? null,
    completed: Boolean(data.completed),
    badges: data.completed ? await getAchievementTitles(supabase, data.achievements ?? []) : [],
  };
}
