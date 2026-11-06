"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { reflectionOptions, simulatorModel } from "@/content/simulator";
import { requireChildMode } from "@/lib/auth/session";
import { getAchievementTitles } from "@/lib/data/academy";
import type { SimulationResult } from "@/lib/data/simulator";
import { uuidSchema } from "@/lib/validation";

// Startup Simulator actions. Inputs are checked here; the database validates every option
// again, enforces the budget, calculates results and decides ownership from Child Mode.

const price = z.union(simulatorModel.prices.map((p) => z.literal(p)) as [z.ZodLiteral<number>, ...z.ZodLiteral<number>[]]);
const quantity = z.union(simulatorModel.quantities.map((q) => z.literal(q)) as [z.ZodLiteral<number>, ...z.ZodLiteral<number>[]]);
const marketing = z.enum(simulatorModel.marketing.map((m) => m.key) as [string, ...string[]]);
const draftSchema = z
  .object({ price: price.nullable(), quantity: quantity.nullable(), marketing: marketing.nullable(), step: z.number().int().min(1).max(5) })
  .partial()
  .strict();

const messages: Record<string, string> = {
  invalid: "That choice isn't one of the options. Please pick again.",
  over_budget: "That plan costs more than your 1,000 Founder Bucks. Make fewer bottles or choose cheaper marketing.",
  already_completed: "This attempt is finished — start a new one to try different choices.",
  not_found: "We couldn't find that simulation.",
  idea_required: "Pick one of your created ideas from the Idea Lab first.",
  rate_limited: "That's a lot of new attempts! Take a short break and come back.",
  not_in_child_mode: "Child Mode has ended. Ask your grown-up to start it again.",
  already_answered: "You've already answered this question.",
  not_completed: "Finish the simulation first.",
};

export async function startSimulationAction(formData: FormData) {
  const { supabase } = await requireChildMode();
  const scenario = z.enum(["ecobottle", "my-idea"]).safeParse(formData.get("scenario"));
  const rawProject = formData.get("projectId");
  const project = rawProject ? uuidSchema.safeParse(rawProject) : { success: true as const, data: null };
  if (!scenario.success || !project.success) redirect("/play/simulator?error=invalid");

  const { data } = await supabase.rpc("start_simulation", { scenario_key: scenario.data, project_id: project.data });
  if (data?.status !== "ok") redirect(`/play/simulator?error=${encodeURIComponent(data?.status ?? "invalid")}`);
  revalidatePath("/play", "layout");
  redirect(`/play/simulator/${data.id}`);
}

export async function saveSimulationDraftAction(sessionId: string, draft: unknown) {
  const { supabase } = await requireChildMode();
  const id = uuidSchema.safeParse(sessionId);
  const body = draftSchema.safeParse(draft);
  if (!id.success || !body.success) return { status: "error" as const };
  const { data } = await supabase.rpc("save_simulation_draft", { session_id: id.data, draft: body.data });
  return { status: data?.status === "ok" ? ("ok" as const) : ("error" as const) };
}

export type RunResult =
  | { status: "ok"; result: SimulationResult; badges: { key: string; title: string; icon: string; description: string }[] }
  | { status: "error"; message: string };

export async function runSimulationAction(sessionId: string, choice: unknown): Promise<RunResult> {
  const { supabase } = await requireChildMode();
  const id = uuidSchema.safeParse(sessionId);
  const body = z.object({ price, quantity, marketing }).strict().safeParse(choice);
  if (!id.success || !body.success) return { status: "error", message: messages.invalid };

  const { data, error } = await supabase.rpc("run_simulation", {
    session_id: id.data,
    price: body.data.price,
    quantity: body.data.quantity,
    marketing_key: body.data.marketing,
  });
  if (error || !data) return { status: "error", message: "Something went wrong. Please try again." };
  if (data.status !== "ok") return { status: "error", message: messages[data.status] ?? messages.invalid };

  revalidatePath("/play", "layout");
  return {
    status: "ok",
    result: data as SimulationResult,
    badges: await getAchievementTitles(supabase, data.achievements ?? []),
  };
}

export async function saveReflectionAction(sessionId: string, reflection: string) {
  const { supabase } = await requireChildMode();
  const id = uuidSchema.safeParse(sessionId);
  const choice = z.enum(reflectionOptions.map((r) => r.key) as [string, ...string[]]).safeParse(reflection);
  if (!id.success || !choice.success) return { status: "error" as const, message: messages.invalid };
  const { data } = await supabase.rpc("set_simulation_reflection", { session_id: id.data, reflection: choice.data });
  if (data?.status !== "ok") return { status: "error" as const, message: messages[data?.status ?? "invalid"] ?? messages.invalid };
  revalidatePath("/play", "layout");
  return { status: "ok" as const };
}
