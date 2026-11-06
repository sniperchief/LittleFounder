import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { SimulatorModel } from "@/content/simulator";

// Startup Simulator reads. RLS limits rows to the signed-in parent's family; Child Mode
// pages also filter by the active child's id from server-side Child Mode state.

export type SimulationResult = {
  starting_budget: number;
  unit_cost: number;
  price: number;
  quantity: number;
  marketing_key: string;
  marketing_label: string;
  marketing_cost: number;
  marketing_reach: number;
  interested: number;
  units_sold: number;
  unsold: number;
  missed_customers: number;
  production_cost: number;
  total_cost: number;
  revenue: number;
  profit: number;
  cash_remaining: number;
  outcome: "profit" | "loss" | "break-even";
  feedback: string[];
};

export type Simulation = {
  id: string;
  status: "active" | "completed" | "abandoned";
  scenarioKey: string;
  scenarioTitle: string;
  product: string;
  projectId: string | null;
  projectName: string | null;
  model: SimulatorModel;
  draft: { price?: number | null; quantity?: number | null; marketing?: string | null; step?: number };
  result: SimulationResult | null;
  reflection: string | null;
  createdAt: string;
  completedAt: string | null;
};

const columns =
  "id, status, project_id, draft, final_summary, reflection, created_at, completed_at, " +
  "simulator_scenarios(key, title, product_kind, demand_params), startup_projects(name)";

type Row = {
  id: string;
  status: Simulation["status"];
  project_id: string | null;
  draft: Simulation["draft"];
  final_summary: SimulationResult | null;
  reflection: string | null;
  created_at: string;
  completed_at: string | null;
  simulator_scenarios: { key: string; title: string; product_kind: string; demand_params: SimulatorModel } | null;
  startup_projects: { name: string } | null;
};

function toSimulation(row: Row): Simulation {
  const scenario = row.simulator_scenarios;
  return {
    id: row.id,
    status: row.status,
    scenarioKey: scenario?.key ?? "",
    scenarioTitle: scenario?.title ?? "Simulation",
    product: scenario?.product_kind ?? "product",
    projectId: row.project_id,
    projectName: row.startup_projects?.name ?? null,
    model: scenario?.demand_params as SimulatorModel,
    draft: row.draft ?? {},
    result: row.final_summary,
    reflection: row.reflection,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export async function listSimulations(supabase: SupabaseClient, childId: string): Promise<Simulation[]> {
  const { data, error } = await supabase
    .from("simulator_sessions")
    .select(columns)
    .eq("child_id", childId)
    .in("status", ["active", "completed"])
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error("Could not load simulations.");
  return ((data ?? []) as unknown as Row[]).map(toSimulation);
}

export async function getSimulation(supabase: SupabaseClient, childId: string, id: string): Promise<Simulation | null> {
  const { data, error } = await supabase
    .from("simulator_sessions")
    .select(columns)
    .eq("id", id)
    .eq("child_id", childId)
    .maybeSingle();
  if (error || !data) return null;
  return toSimulation(data as unknown as Row);
}

/** Display name for a simulation: the challenge, or the child's idea for "My idea". */
export function simulationName(s: Pick<Simulation, "scenarioTitle" | "projectName">) {
  return s.projectName ? `${s.projectName} (practice numbers)` : s.scenarioTitle;
}
