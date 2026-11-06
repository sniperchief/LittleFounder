import {
  Bike,
  BookOpen,
  Heart,
  House,
  Leaf,
  Lightbulb,
  Music,
  Palette,
  PawPrint,
  Recycle,
  Rocket,
  Star,
  type LucideIcon,
} from "lucide-react";
import { createElement, type ComponentProps, type ReactNode } from "react";

import {
  buyers,
  customerTags,
  firstSteps,
  labelOf,
  problemCategories,
  problemFrequencies,
  solutionTypes,
  specialTags,
} from "@/content/idea-lab";
import { cn } from "@/lib/utils";

const icons: Record<string, LucideIcon> = {
  lightbulb: Lightbulb,
  rocket: Rocket,
  leaf: Leaf,
  paw: PawPrint,
  book: BookOpen,
  palette: Palette,
  bike: Bike,
  recycle: Recycle,
  heart: Heart,
  star: Star,
  music: Music,
  house: House,
};

export function IdeaIcon({ name, ...props }: { name: string } & ComponentProps<LucideIcon>) {
  return createElement(icons[name] ?? Lightbulb, props);
}

export function IdeaBadge({ icon, className }: { icon: string; className?: string }) {
  return (
    <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-2xl border-2 border-ink bg-coral-soft", className)}>
      <IdeaIcon name={icon} className="size-7 text-ink" aria-hidden="true" />
    </span>
  );
}

export function IdeaStatusChip({ status }: { status: string }) {
  const ready = status === "ready";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.08em] text-ink",
        ready ? "bg-mint" : "bg-sun-soft",
      )}
    >
      {ready ? "Idea created" : "Draft"}
    </span>
  );
}

type SummaryFields = {
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
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-sm font-bold text-ink/70">{label}</dt>
      <dd className="min-w-0 text-ink [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

const missing = <span className="italic text-muted-foreground">Not filled in yet</span>;

/** Read-only summary of an idea (wizard review, child workspace, parent view). Plain text only. */
export function IdeaSummary({ idea, headingLevel = "h2" }: { idea: SummaryFields; headingLevel?: "h2" | "h3" }) {
  const H = headingLevel;
  const category = problemCategories.find((c) => c.key === idea.problem_category);
  const sections = [
    {
      title: "The problem",
      tone: "bg-sun-soft",
      rows: [
        { label: "Topic", value: category ? `${category.emoji} ${category.label}` : idea.problem_category === "other" ? "Something else" : null },
        { label: "Problem", value: idea.problem || null },
        { label: "Who has it", value: idea.problem_who || null },
        { label: "How often", value: labelOf(problemFrequencies, idea.problem_frequency) },
      ],
    },
    {
      title: "The solution",
      tone: "bg-coral-soft",
      rows: [
        { label: "Type", value: labelOf(solutionTypes, idea.solution_type) },
        { label: "Idea", value: idea.solution || null },
        { label: "Why it helps", value: idea.solution_benefit || null },
      ],
    },
    {
      title: "The customers",
      tone: "bg-sky-soft",
      rows: [
        {
          label: "Who uses it",
          value: idea.target_customer_tags.length ? idea.target_customer_tags.map((t) => labelOf(customerTags, t) ?? t).join(", ") : null,
        },
        { label: "Who pays", value: labelOf(buyers, idea.buyer) },
        { label: "More about them", value: idea.target_customer_note || null },
      ],
    },
    {
      title: "The idea in a sentence",
      tone: "bg-grape-soft",
      rows: [
        { label: "Description", value: idea.value_statement || null },
        { label: "What makes it special", value: idea.special_tags.length ? idea.special_tags.map((t) => labelOf(specialTags, t) ?? t).join(", ") : null },
        { label: "First thing to test", value: labelOf(firstSteps, idea.first_step) },
      ],
    },
  ];
  return (
    <div className="grid gap-4">
      {sections.map((s) => (
        <section key={s.title} className="rounded-2xl border-2 border-ink bg-surface">
          <H className={cn("rounded-t-[0.9rem] border-b-2 border-ink px-5 py-2.5 text-lg font-bold text-ink", s.tone)}>{s.title}</H>
          <dl className="grid gap-3 px-5 py-4">
            {s.rows.map((r) => (
              <Row key={r.label} label={r.label}>
                {r.value ?? missing}
              </Row>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

/** Mirrors the database rule for marking an idea as created (startup_projects_ready_complete). */
export function missingParts(f: SummaryFields & { name: string }) {
  const parts: { step: number; label: string }[] = [];
  if (!f.problem_category) parts.push({ step: 1, label: "Pick a problem topic" });
  if (f.problem.trim().length < 3) parts.push({ step: 1, label: "Describe the problem" });
  if (!f.solution_type) parts.push({ step: 2, label: "Choose what kind of solution it is" });
  if (f.solution.trim().length < 3) parts.push({ step: 2, label: "Describe your solution" });
  if (f.target_customer_tags.length === 0) parts.push({ step: 3, label: "Choose who would use it" });
  if (!f.buyer) parts.push({ step: 3, label: "Choose who would pay" });
  if (f.name.trim().length < 2) parts.push({ step: 4, label: "Give your idea a name" });
  if (f.value_statement.trim().length < 3) parts.push({ step: 5, label: "Describe your idea in one sentence" });
  return parts;
}
