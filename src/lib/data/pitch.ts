import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { buyers, customerTags, firstSteps, labelOf, problemFrequencies, specialTags } from "@/content/idea-lab";
import { pitchLimits, pitchPrivacyIssue, pitchSections, type PitchSectionKey } from "@/content/pitch-studio";
import type { Idea } from "@/lib/data/ideas";

// Pitch Studio & Investor Room reads. Queries run as the signed-in parent (RLS limits rows
// to their family); Child Mode pages additionally filter by the active child's id, which comes
// from server-side Child Mode state — never from the browser.

export type SlideText = { main: string; extra: string };

export type PitchSnapshot = {
  title: string;
  tagline: string;
  icon_key: string;
  theme_key: string;
  sections: Record<PitchSectionKey, SlideText>;
  version?: number;
};

export type PitchVersion = { id: string; version: number; createdAt: string; snapshot: PitchSnapshot };

export type PracticeSummary = {
  id: string;
  deckId: string;
  personaKey: string;
  personaName: string;
  version: number | null;
  totalScore: number | null;
  band: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type Pitch = {
  id: string;
  status: "draft" | "ready";
  builderStep: number;
  projectId: string | null;
  projectName: string | null;
  createdAt: string;
  updatedAt: string;
  /** The deck as currently saved (may include changes since the latest finished version). */
  current: PitchSnapshot;
  versions: PitchVersion[];
  practices: PracticeSummary[];
};

export type PitchListItem = Omit<Pitch, "versions" | "practices"> & {
  versionCount: number;
  practicesCompleted: number;
  bestScore: number | null;
};

/** "draft" (never finished), "completed" (matches the latest version) or "revising". */
export function pitchState(p: { status: string; versionCount: number }) {
  if (p.status === "ready") return "completed" as const;
  return p.versionCount > 0 ? ("revising" as const) : ("draft" as const);
}

const emptySections = () =>
  Object.fromEntries(pitchSections.map((s) => [s.key, { main: "", extra: "" }])) as Record<PitchSectionKey, SlideText>;

export function normaliseSnapshot(raw: unknown): PitchSnapshot {
  const s = (raw ?? {}) as Partial<PitchSnapshot>;
  const sections = emptySections();
  for (const sec of pitchSections) {
    const v = s.sections?.[sec.key];
    sections[sec.key] = { main: v?.main ?? "", extra: v?.extra ?? "" };
  }
  return {
    title: s.title ?? "My pitch",
    tagline: s.tagline ?? "",
    icon_key: s.icon_key ?? "lightbulb",
    theme_key: s.theme_key ?? "sunrise",
    sections,
    version: s.version,
  };
}

type DeckRow = {
  id: string;
  title: string;
  tagline: string;
  icon_key: string;
  theme_key: string;
  status: "draft" | "ready";
  builder_step: number;
  project_id: string | null;
  created_at: string;
  updated_at: string;
  startup_projects: { name: string } | null;
};

const deckColumns = "id, title, tagline, icon_key, theme_key, status, builder_step, project_id, created_at, updated_at, startup_projects(name)";

function deckBase(row: DeckRow, slides: { section: string; content: Partial<SlideText> | null }[]) {
  const sections = emptySections();
  for (const s of slides) {
    if (s.section in sections) sections[s.section as PitchSectionKey] = { main: s.content?.main ?? "", extra: s.content?.extra ?? "" };
  }
  return {
    id: row.id,
    status: row.status,
    builderStep: row.builder_step,
    projectId: row.project_id,
    projectName: row.startup_projects?.name ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    current: { title: row.title, tagline: row.tagline, icon_key: row.icon_key, theme_key: row.theme_key, sections },
  };
}

type SessionRow = {
  id: string;
  deck_id: string;
  total_score: number | null;
  band: string | null;
  created_at: string;
  completed_at: string | null;
  deck_snapshot: { version?: number } | null;
  investor_personas: { key: string; name: string } | null;
};

const sessionListColumns = "id, deck_id, total_score, band, created_at, completed_at, deck_snapshot->version, investor_personas(key, name)";

function toPracticeSummary(row: SessionRow & { version?: number | null }): PracticeSummary {
  return {
    id: row.id,
    deckId: row.deck_id,
    personaKey: row.investor_personas?.key ?? "penny",
    personaName: row.investor_personas?.name ?? "Pretend investor",
    version: row.version ?? null,
    totalScore: row.total_score,
    band: row.band,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export async function listPitches(supabase: SupabaseClient, childId: string): Promise<PitchListItem[]> {
  const [decks, slides, versions, sessions] = await Promise.all([
    supabase.from("pitch_decks").select(deckColumns).eq("child_id", childId).order("updated_at", { ascending: false }).limit(pitchLimits.maxPitches),
    supabase.from("pitch_slides").select("deck_id, section, content, pitch_decks!inner(child_id)").eq("pitch_decks.child_id", childId),
    supabase.from("pitch_versions").select("deck_id").eq("child_id", childId),
    supabase.from("investor_sessions").select("deck_id, total_score").eq("child_id", childId).not("completed_at", "is", null),
  ]);
  if (decks.error || slides.error || versions.error || sessions.error) throw new Error("Could not load pitches.");
  return ((decks.data ?? []) as unknown as DeckRow[]).map((row) => {
    const done = (sessions.data ?? []).filter((s) => s.deck_id === row.id);
    return {
      ...deckBase(row, (slides.data ?? []).filter((s) => s.deck_id === row.id) as { section: string; content: SlideText }[]),
      versionCount: (versions.data ?? []).filter((v) => v.deck_id === row.id).length,
      practicesCompleted: done.length,
      bestScore: done.length ? Math.max(...done.map((s) => s.total_score as number)) : null,
    };
  });
}

export async function getPitch(supabase: SupabaseClient, childId: string, deckId: string): Promise<Pitch | null> {
  const { data: deck, error } = await supabase.from("pitch_decks").select(deckColumns).eq("id", deckId).eq("child_id", childId).maybeSingle();
  if (error || !deck) return null;
  const [slides, versions, sessions] = await Promise.all([
    supabase.from("pitch_slides").select("section, content").eq("deck_id", deckId),
    supabase.from("pitch_versions").select("id, version, created_at, snapshot").eq("deck_id", deckId).eq("child_id", childId).order("version", { ascending: false }),
    supabase.from("investor_sessions").select(sessionListColumns).eq("deck_id", deckId).eq("child_id", childId).order("created_at", { ascending: false }),
  ]);
  if (slides.error || versions.error || sessions.error) return null;
  return {
    ...deckBase(deck as unknown as DeckRow, (slides.data ?? []) as { section: string; content: SlideText }[]),
    versions: (versions.data ?? []).map((v) => ({ id: v.id, version: v.version, createdAt: v.created_at, snapshot: normaliseSnapshot(v.snapshot) })),
    practices: ((sessions.data ?? []) as unknown as (SessionRow & { version: number | null })[]).map(toPracticeSummary),
  };
}

export type PitchProgress = {
  pitchesCreated: number;
  pitchesCompleted: number;
  practicesCompleted: number;
  bestScore: number | null;
  recent: {
    deckId: string;
    title: string;
    state: ReturnType<typeof pitchState>;
    latestVersion: number | null;
    practices: number;
    bestScore: number | null;
    updatedAt: string;
  }[];
};

/** Counts for Founder Passport and the Parent Dashboard. Every number comes from stored rows. */
export async function getPitchProgress(supabase: SupabaseClient, childId: string): Promise<PitchProgress> {
  const [decks, versions, sessions] = await Promise.all([
    supabase.from("pitch_decks").select("id, title, status, updated_at").eq("child_id", childId).order("updated_at", { ascending: false }),
    supabase.from("pitch_versions").select("deck_id, version, created_at").eq("child_id", childId),
    supabase.from("investor_sessions").select("deck_id, total_score, completed_at").eq("child_id", childId).not("completed_at", "is", null),
  ]);
  if (decks.error || versions.error || sessions.error) throw new Error("Could not load pitch progress.");
  const v = versions.data ?? [];
  const s = sessions.data ?? [];
  const scores = s.map((x) => x.total_score as number);
  const recent = (decks.data ?? []).map((d) => {
    const mine = v.filter((x) => x.deck_id === d.id);
    const practices = s.filter((x) => x.deck_id === d.id);
    const touched = [d.updated_at, ...mine.map((x) => x.created_at), ...practices.map((x) => x.completed_at as string)].sort().at(-1) as string;
    return {
      deckId: d.id as string,
      title: d.title as string,
      state: pitchState({ status: d.status, versionCount: mine.length }),
      latestVersion: mine.length ? Math.max(...mine.map((x) => x.version as number)) : null,
      practices: practices.length,
      bestScore: practices.length ? Math.max(...practices.map((x) => x.total_score as number)) : null,
      updatedAt: touched,
    };
  });
  return {
    pitchesCreated: recent.length,
    pitchesCompleted: recent.filter((r) => r.latestVersion !== null).length,
    practicesCompleted: s.length,
    bestScore: scores.length ? Math.max(...scores) : null,
    recent: recent.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5),
  };
}

// ---------------------------------------------------------------------------
// Investor Room
// ---------------------------------------------------------------------------

export type Persona = { key: string; name: string; focus: string; style: string; intro: string };

export async function listPersonas(supabase: SupabaseClient): Promise<Persona[]> {
  const { data, error } = await supabase.from("investor_personas").select("key, name, focus, style, intro_text").order("position");
  if (error) throw new Error("Could not load the Investor Room.");
  return (data ?? []).map((p) => ({ key: p.key, name: p.name, focus: p.focus, style: p.style, intro: p.intro_text }));
}

export type PracticeReview = { section: PitchSectionKey; prompt: string; answer: string; feedback: string; stronger: string | null };

export type PracticeAnswer = { questionId: string; score: number; bonus: number; note: string | null; review: PracticeReview };

export type PracticeQuestion = {
  id: string;
  section: PitchSectionKey;
  prompt: string;
  hint: string;
  options: { id: string; label: string }[];
};

export type Practice = PracticeSummary & {
  persona: Persona;
  points: number | null;
  subScores: Partial<Record<PitchSectionKey, number>>;
  tips: string[];
  snapshot: PitchSnapshot;
  questions: PracticeQuestion[];
  answers: PracticeAnswer[];
};

export async function getPractice(supabase: SupabaseClient, childId: string, sessionId: string): Promise<Practice | null> {
  const { data: row, error } = await supabase
    .from("investor_sessions")
    .select(
      "id, deck_id, question_ids, total_score, points, sub_scores, band, tips_keys, deck_snapshot, created_at, completed_at, " +
        "investor_personas(key, name, focus, style, intro_text)",
    )
    .eq("id", sessionId)
    .eq("child_id", childId)
    .maybeSingle();
  if (error || !row) return null;
  const s = row as unknown as SessionRow & {
    question_ids: string[];
    points: number | null;
    sub_scores: Partial<Record<PitchSectionKey, number>> | null;
    tips_keys: string[];
    investor_personas: { key: string; name: string; focus: string; style: string; intro_text: string } | null;
  };

  const [answers, questions, options] = await Promise.all([
    supabase.from("investor_responses").select("question_id, score, bonus, note, review").eq("session_id", s.id).order("created_at"),
    supabase.from("investor_questions").select("id, section, prompt, hint").in("id", s.question_ids),
    supabase.from("investor_answer_options").select("id, question_id, position, label").in("question_id", s.question_ids).order("position"),
  ]);
  if (answers.error || questions.error || options.error) return null;

  const persona = s.investor_personas;
  const snapshot = normaliseSnapshot(s.deck_snapshot);
  return {
    ...toPracticeSummary({ ...s, version: snapshot.version ?? null }),
    persona: {
      key: persona?.key ?? "penny",
      name: persona?.name ?? "Pretend investor",
      focus: persona?.focus ?? "",
      style: persona?.style ?? "",
      intro: persona?.intro_text ?? "",
    },
    points: s.points,
    subScores: s.sub_scores ?? {},
    tips: s.tips_keys ?? [],
    snapshot,
    questions: s.question_ids.flatMap((id) => {
      const q = (questions.data ?? []).find((x) => x.id === id);
      if (!q) return [];
      return [{
        id: q.id,
        section: q.section as PitchSectionKey,
        prompt: q.prompt,
        hint: q.hint,
        options: (options.data ?? []).filter((o) => o.question_id === id).map((o) => ({ id: o.id, label: o.label })),
      }];
    }),
    answers: (answers.data ?? []).map((a) => ({
      questionId: a.question_id,
      score: a.score,
      bonus: a.bonus,
      note: a.note,
      review: a.review as PracticeReview,
    })),
  };
}

// ---------------------------------------------------------------------------
// Prefill from an Idea Lab idea (and its Simulator practice, if any)
// ---------------------------------------------------------------------------

type SimulationNumbers = { price: number; profit: number } | null;

const listJoin = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

/**
 * Builder fields worked out from an idea. Anything that would be refused (too long, or
 * looking like personal details — Idea Lab only nudges about those) is left out.
 */
export function prefillFromIdea(idea: Idea, sim: SimulationNumbers): Record<string, string> {
  const freq = labelOf(problemFrequencies, idea.problem_frequency);
  const who = idea.problem_who.trim();
  const tags = idea.target_customer_tags.map((t) => labelOf(customerTags, t)).filter((x): x is string => Boolean(x));
  const special = idea.special_tags.map((t) => labelOf(specialTags, t)?.toLowerCase()).filter((x): x is string => Boolean(x));
  const buyer = labelOf(buyers, idea.buyer);
  const step = labelOf(firstSteps, idea.first_step);

  const fields: Record<string, string> = {
    title: idea.name === "My new idea" ? "" : idea.name,
    tagline: idea.value_statement,
    icon_key: idea.icon_key,
    problem: idea.problem,
    problem_extra: [who && `Who has it: ${who}.`, freq && `How often: ${freq.toLowerCase()}.`].filter(Boolean).join(" "),
    solution: idea.solution,
    solution_extra: [idea.solution_benefit && `${idea.solution_benefit.replace(/[.!]$/, "")}.`, special.length > 0 && `It's ${listJoin(special)}.`]
      .filter(Boolean)
      .join(" "),
    customer: [tags.length > 0 && `${listJoin(tags)}.`, idea.target_customer_note].filter(Boolean).join(" "),
    customer_extra: "",
    business_model:
      idea.buyer === "free"
        ? "It would be free to use. A sponsor, charity or volunteers could cover the costs."
        : buyer
          ? `${buyer} would pay for it.`
          : "",
    business_model_extra: sim
      ? `In my Startup Simulator practice I ${sim.profit >= 0 ? `made ${sim.profit} FB profit` : `had a ${-sim.profit} FB loss`} selling at ${sim.price} FB each (pretend money).`
      : "",
    ask: step ? `My next step: ${step.charAt(0).toLowerCase()}${step.slice(1)}.` : "",
    ask_extra: "",
  };

  const limits: Record<string, number> = { title: pitchLimits.title, tagline: pitchLimits.tagline, icon_key: 20 };
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => {
      const max = limits[key] ?? (key.endsWith("_extra") ? pitchLimits.extra : pitchLimits.main);
      const clean = value.trim();
      return [key, clean.length > max || pitchPrivacyIssue(clean) ? "" : clean];
    }),
  );
}

export async function latestSimulationFor(supabase: SupabaseClient, childId: string, projectId: string): Promise<SimulationNumbers> {
  const { data } = await supabase
    .from("simulator_sessions")
    .select("final_summary")
    .eq("child_id", childId)
    .eq("project_id", projectId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const summary = data?.final_summary as { price?: number; profit?: number } | null;
  return summary && typeof summary.price === "number" && typeof summary.profit === "number" ? { price: summary.price, profit: summary.profit } : null;
}
