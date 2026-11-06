import { Lightbulb, Mic, Search, Store } from "lucide-react";

import { Section, SectionHeader } from "@/components/layout/container";
import { cn } from "@/lib/utils";

const steps = [
  {
    icon: Search,
    tone: "bg-coral-soft",
    title: "Spot a problem",
    body: "Look around home, school and the neighbourhood for things that could work better.",
  },
  {
    icon: Lightbulb,
    tone: "bg-sun-soft",
    title: "Shape an idea",
    body: "Describe the problem, a solution, and exactly who it would help.",
  },
  {
    icon: Store,
    tone: "bg-mint-soft",
    title: "Run a pretend business",
    body: "Set prices, plan costs and see what happens week by week — with pretend money.",
  },
  {
    icon: Mic,
    tone: "bg-grape-soft",
    title: "Pitch it with confidence",
    body: "Build a five-part pitch and practise answering questions from friendly investor characters.",
  },
];

export function HowItWorks() {
  return (
    <Section id="how-it-works" aria-labelledby="how-it-works-title" className="border-y-2 border-ink bg-surface">
      <SectionHeader
        id="how-it-works-title"
        eyebrow="How it works"
        title="From “that’s annoying” to “here’s my pitch”"
        description="Children follow the same journey real founders do — one small, achievable step at a time."
      />
      <div className="relative mt-14">
        <div
          aria-hidden="true"
          className="absolute left-0 right-0 top-8 hidden border-t-2 border-dashed border-ink/25 lg:block"
        />
        <ol className="relative grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, tone, title, body }, index) => (
            <li key={title} className="relative">
              <div className={cn("flex size-16 items-center justify-center rounded-2xl border-2 border-ink", tone)}>
                <Icon className="size-7 text-ink" aria-hidden="true" strokeWidth={2.2} />
              </div>
              <p className="mt-5 text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Step {index + 1}
              </p>
              <h3 className="mt-1 text-xl font-bold text-ink">{title}</h3>
              <p className="mt-2 leading-relaxed text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>
      </div>
      <p className="mx-auto mt-12 max-w-2xl rounded-full bg-muted px-6 py-3 text-center font-semibold text-ink">
        Along the way, the Founder Academy teaches the ideas behind each step, and the Founder Passport records every
        milestone.
      </p>
    </Section>
  );
}
