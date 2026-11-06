"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  buyers,
  customerTags,
  firstSteps,
  ideaIcons,
  ideaLimits,
  problemCategories,
  problemFrequencies,
  solutionTypes,
  specialTags,
} from "@/content/idea-lab";
import { requireChildMode } from "@/lib/auth/session";
import { getAchievementTitles } from "@/lib/data/academy";
import { uuidSchema } from "@/lib/validation";

// Idea Lab actions. Inputs are validated here; the database (save_idea / delete_idea)
// validates again and decides ownership from the account's active Child Mode.

const keysOf = (list: readonly { key: string }[]) => list.map((x) => x.key) as [string, ...string[]];
const text = (max: number) => z.string().trim().max(max);
const choice = (list: readonly { key: string }[]) => z.enum(keysOf(list)).nullable();

const fieldsSchema = z
  .object({
    name: text(ideaLimits.name),
    icon_key: z.enum(ideaIcons),
    problem_category: z.enum([...keysOf(problemCategories), "other"]).nullable(),
    problem: text(ideaLimits.problem),
    problem_who: text(ideaLimits.problemWho),
    problem_frequency: choice(problemFrequencies),
    solution_type: choice(solutionTypes),
    solution: text(ideaLimits.solution),
    solution_benefit: text(ideaLimits.solutionBenefit),
    target_customer_tags: z.array(z.enum(keysOf(customerTags))).max(customerTags.length),
    buyer: choice(buyers),
    target_customer_note: text(ideaLimits.customerNote),
    value_statement: text(ideaLimits.valueStatement),
    special_tags: z.array(z.enum(keysOf(specialTags))).max(4),
    first_step: choice(firstSteps),
  })
  .partial()
  .strict();

export type SaveIdeaResult =
  | { status: "ok"; id: string; ideaStatus: string; badges: { key: string; title: string; icon: string; description: string }[] }
  | { status: "error"; message: string };

const messages: Record<string, string> = {
  invalid: "Something in your idea doesn't look right. Check your answers and try again.",
  incomplete: "A few parts are still missing. Go back and fill in the steps marked to do.",
  limit_reached: `You already have ${ideaLimits.maxActiveIdeas} ideas — delete one you don't need to make space.`,
  not_found: "We couldn't find that idea.",
  not_in_child_mode: "Child Mode has ended. Ask your grown-up to start it again.",
};

export async function saveIdeaAction(
  ideaId: string | null,
  fields: unknown,
  step: number,
  finish: boolean,
): Promise<SaveIdeaResult> {
  const { supabase } = await requireChildMode();
  const id = ideaId === null ? { success: true as const, data: null } : uuidSchema.safeParse(ideaId);
  const body = fieldsSchema.safeParse(fields);
  const stepOk = Number.isInteger(step) && step >= 1 && step <= 6;
  if (!id.success || !body.success || !stepOk) return { status: "error", message: messages.invalid };

  const { data, error } = await supabase.rpc("save_idea", {
    idea_id: id.data,
    fields: body.data,
    step,
    finish: Boolean(finish),
  });
  if (error || !data) return { status: "error", message: "Something went wrong. Please try again." };
  if (data.status !== "ok") return { status: "error", message: messages[data.status] ?? messages.invalid };

  revalidatePath("/play", "layout");
  return {
    status: "ok",
    id: data.id,
    ideaStatus: data.idea_status,
    badges: await getAchievementTitles(supabase, data.achievements ?? []),
  };
}

export async function deleteIdeaAction(formData: FormData) {
  const { supabase } = await requireChildMode();
  const id = uuidSchema.safeParse(formData.get("ideaId"));
  if (!id.success || formData.get("confirm") !== "delete") redirect("/play/ideas");
  await supabase.rpc("delete_idea", { idea_id: id.data });
  revalidatePath("/play", "layout");
  redirect("/play/ideas?deleted=1");
}
