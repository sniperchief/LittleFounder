import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

// Idea Lab reads. Queries run as the signed-in parent (RLS limits rows to their family);
// Child Mode pages additionally filter by the active child's id, which comes from the
// server-side Child Mode state — never from the browser.

export type Idea = {
  id: string;
  name: string;
  icon_key: string;
  status: "draft" | "ready" | "archived";
  problem_category: string | null;
  problem: string;
  problem_who: string;
  problem_frequency: string | null;
  solution_type: string | null;
  solution: string;
  solution_benefit: string;
  target_customer_tags: string[];
  buyer: string | null;
  target_customer_note: string;
  value_statement: string;
  special_tags: string[];
  first_step: string | null;
  wizard_step: number;
  created_at: string;
  updated_at: string;
};

const columns =
  "id, name, icon_key, status, problem_category, problem, problem_who, problem_frequency, solution_type, solution, " +
  "solution_benefit, target_customer_tags, buyer, target_customer_note, value_statement, special_tags, first_step, " +
  "wizard_step, created_at, updated_at";

export async function listIdeas(supabase: SupabaseClient, childId: string): Promise<Idea[]> {
  const { data, error } = await supabase
    .from("startup_projects")
    .select(columns)
    .eq("child_id", childId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });
  if (error) throw new Error("Could not load ideas.");
  return (data ?? []) as unknown as Idea[];
}

export async function getIdea(supabase: SupabaseClient, childId: string, ideaId: string): Promise<Idea | null> {
  const { data, error } = await supabase
    .from("startup_projects")
    .select(columns)
    .eq("id", ideaId)
    .eq("child_id", childId)
    .neq("status", "archived")
    .maybeSingle();
  if (error) return null;
  return (data as unknown as Idea | null) ?? null;
}

/** Fields the wizard edits (also the server action's allow-list). */
export const ideaFieldKeys = [
  "name",
  "icon_key",
  "problem_category",
  "problem",
  "problem_who",
  "problem_frequency",
  "solution_type",
  "solution",
  "solution_benefit",
  "target_customer_tags",
  "buyer",
  "target_customer_note",
  "value_statement",
  "special_tags",
  "first_step",
] as const;

export type IdeaFields = Pick<Idea, (typeof ideaFieldKeys)[number]>;

export function toFields(idea: Idea | null): IdeaFields {
  return {
    name: idea && idea.name !== "My new idea" ? idea.name : "",
    icon_key: idea?.icon_key ?? "lightbulb",
    problem_category: idea?.problem_category ?? null,
    problem: idea?.problem ?? "",
    problem_who: idea?.problem_who ?? "",
    problem_frequency: idea?.problem_frequency ?? null,
    solution_type: idea?.solution_type ?? null,
    solution: idea?.solution ?? "",
    solution_benefit: idea?.solution_benefit ?? "",
    target_customer_tags: idea?.target_customer_tags ?? [],
    buyer: idea?.buyer ?? null,
    target_customer_note: idea?.target_customer_note ?? "",
    value_statement: idea?.value_statement ?? "",
    special_tags: idea?.special_tags ?? [],
    first_step: idea?.first_step ?? null,
  };
}
