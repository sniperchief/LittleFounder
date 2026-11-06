import {
  BadgeCheck,
  BarChart3,
  BookOpenText,
  Box,
  Brain,
  Calculator,
  CircleHelp,
  Handshake,
  Lightbulb,
  ListChecks,
  Megaphone,
  MessageCircleQuestion,
  Mic,
  PieChart,
  Search,
  Sparkles,
  Tag,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { Block } from "@/lib/data/academy";
import { cn } from "@/lib/utils";

// Renders lesson content from the database. Text is rendered as plain text (never HTML).

const scenes: Record<string, { icon: LucideIcon; accent: LucideIcon; tone: string }> = {
  magnifier: { icon: Search, accent: Sparkles, tone: "bg-sun-soft" },
  lightbulb: { icon: Lightbulb, accent: Sparkles, tone: "bg-sun-soft" },
  bridge: { icon: TrendingUp, accent: Sparkles, tone: "bg-mint-soft" },
  brainstorm: { icon: Brain, accent: Lightbulb, tone: "bg-coral-soft" },
  check: { icon: ListChecks, accent: BadgeCheck, tone: "bg-mint-soft" },
  prototype: { icon: Box, accent: Sparkles, tone: "bg-coral-soft" },
  people: { icon: Users, accent: MessageCircleQuestion, tone: "bg-sky-soft" },
  question: { icon: MessageCircleQuestion, accent: CircleHelp, tone: "bg-sky-soft" },
  chart: { icon: BarChart3, accent: Calculator, tone: "bg-sky-soft" },
  costs: { icon: Calculator, accent: Tag, tone: "bg-mint-soft" },
  "price-tag": { icon: Tag, accent: Sparkles, tone: "bg-mint-soft" },
  profit: { icon: TrendingUp, accent: Calculator, tone: "bg-mint-soft" },
  story: { icon: BookOpenText, accent: Sparkles, tone: "bg-grape-soft" },
  pitch: { icon: Megaphone, accent: Sparkles, tone: "bg-grape-soft" },
  stage: { icon: Mic, accent: Sparkles, tone: "bg-grape-soft" },
  investor: { icon: Handshake, accent: TrendingUp, tone: "bg-rose-soft" },
  pie: { icon: PieChart, accent: Sparkles, tone: "bg-rose-soft" },
  checklist: { icon: ListChecks, accent: BadgeCheck, tone: "bg-rose-soft" },
};

export function Scene({ scene, className }: { scene?: string; className?: string }) {
  const s = scenes[scene ?? ""] ?? scenes.lightbulb;
  const Icon = s.icon;
  const Accent = s.accent;
  return (
    <div
      aria-hidden="true"
      className={cn("relative flex size-24 shrink-0 items-center justify-center rounded-[2rem] border-2 border-ink", s.tone, className)}
    >
      <Icon className="size-11 text-ink" strokeWidth={2} />
      <span className="absolute -right-2 -top-2 flex size-9 items-center justify-center rounded-full border-2 border-ink bg-surface">
        <Accent className="size-4 text-ink" strokeWidth={2.4} />
      </span>
    </div>
  );
}

function Paragraphs({ text, className }: { text: string; className?: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <p key={i} className={cn("leading-relaxed", i > 0 && "mt-2", className)}>
          {line}
        </p>
      ))}
    </>
  );
}

export function LessonBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-6">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "text":
            return (
              <section key={i}>
                {block.heading ? <h2 className="text-2xl font-bold text-ink">{block.heading}</h2> : null}
                <div className={cn("text-lg text-ink/85", block.heading && "mt-2")}>
                  <Paragraphs text={block.body} />
                </div>
              </section>
            );
          case "example":
            return (
              <section key={i} className="flex flex-col gap-5 rounded-2xl border-2 border-ink bg-surface p-5 sm:flex-row sm:items-start sm:p-6">
                <Scene scene={block.scene} />
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-coral-ink">Example</p>
                  <h2 className="mt-1 text-xl font-bold text-ink">{block.title}</h2>
                  <div className="mt-2 text-ink/85">
                    <Paragraphs text={block.body} />
                  </div>
                </div>
              </section>
            );
          case "scenario":
            return (
              <section key={i} className="rounded-2xl border-2 border-dashed border-ink/40 bg-sky-soft/60 p-5 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink/70">What if…?</p>
                <h2 className="mt-1 text-xl font-bold text-ink">{block.title}</h2>
                <div className="mt-2 text-ink/85">
                  <Paragraphs text={block.body} />
                </div>
              </section>
            );
          case "keyIdea":
            return (
              <section key={i} className="flex items-start gap-3 rounded-2xl border-2 border-ink bg-sun p-5 shadow-[var(--shadow-sticker)]">
                <Lightbulb className="mt-0.5 size-6 shrink-0 text-ink" aria-hidden="true" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink/70">Key idea</p>
                  <p className="mt-1 text-lg font-bold text-ink">{block.body}</p>
                </div>
              </section>
            );
          case "list":
            return (
              <section key={i}>
                <h2 className="text-2xl font-bold text-ink">{block.heading}</h2>
                <ul className="mt-3 space-y-2">
                  {block.items.map((item) => (
                    <li key={item} className="flex gap-3 text-lg text-ink/85">
                      <span className="mt-2.5 size-2.5 shrink-0 rounded-full bg-coral" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          case "steps":
            return (
              <section key={i}>
                <h2 className="text-2xl font-bold text-ink">{block.heading}</h2>
                <ol className="mt-3 grid gap-3 sm:grid-cols-2">
                  {block.items.map((step, n) => (
                    <li key={step.title} className="flex gap-3 rounded-xl border-2 border-border bg-surface p-4">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-mint-soft font-display font-extrabold text-ink">
                        {n + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-ink">{step.title}</p>
                        <p className="text-ink/80">{step.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            );
          case "table":
            return (
              <section key={i}>
                <h2 className="text-2xl font-bold text-ink">{block.caption}</h2>
                <div className="mt-3 overflow-hidden rounded-xl border-2 border-ink">
                  <table className="w-full border-collapse text-left">
                    <thead className="bg-muted">
                      <tr>
                        {block.columns.map((c) => (
                          <th key={c} scope="col" className="px-4 py-2.5 text-sm font-bold text-ink">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {block.rows.map(([a, b]) => (
                        <tr key={a} className="border-t border-border bg-surface align-top">
                          <th scope="row" className="px-4 py-2.5 font-semibold text-ink">
                            {a}
                          </th>
                          <td className="px-4 py-2.5 text-ink/85">{b}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
