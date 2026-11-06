import { Check, FlaskConical, TrendingUp } from "lucide-react";

import { Section, SectionHeader } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { virtualCurrency } from "@/content/site";

const ideaSteps = ["Problem", "Solution", "Target customer", "Why it matters", "Name & logo"];

// Fictional example round: 20 pots made at 6 FB each, 16 sold at 12 FB.
const exampleRound = [
  { label: "Pots sold", value: "16 of 20" },
  { label: "Money in", value: "192 FB" },
  { label: "Costs", value: "120 FB" },
  { label: "Profit", value: "72 FB", highlight: true },
];

export function BuildSection() {
  return (
    <Section id="build" aria-labelledby="build-title" className="bg-mint-soft/60">
      <SectionHeader
        id="build-title"
        eyebrow="Build your first business"
        title="Turn an idea into a (pretend) business"
        description="Two hands-on tools let children apply what they learn — and see the results of their own decisions."
      />

      <div className="mt-14 grid gap-6 lg:grid-cols-2">
        {/* Idea Lab */}
        <article className="flex flex-col rounded-xl border-2 border-ink bg-surface p-6 sm:p-8">
          <Badge tone="sun" className="self-start">
            <FlaskConical aria-hidden="true" /> Idea Lab
          </Badge>
          <h3 className="mt-4 text-2xl font-bold text-ink">Guided steps from problem to plan</h3>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            A step-by-step guide helps children describe a problem, imagine a solution and decide who their
            customers are. Ideas are saved to their own private space to revisit and improve.
          </p>
          <div aria-hidden="true" className="mt-6 rounded-lg border-2 border-ink/15 bg-background p-5">
            <ol className="flex flex-wrap gap-2">
              {ideaSteps.map((step, i) => (
                <li
                  key={step}
                  className={
                    i < 2
                      ? "flex items-center gap-1.5 rounded-full border-2 border-ink bg-sun px-3 py-1 text-sm font-semibold text-ink"
                      : "rounded-full border-2 border-ink/20 px-3 py-1 text-sm font-semibold text-muted-foreground"
                  }
                >
                  {i < 2 ? <Check className="size-3.5" strokeWidth={3} /> : null}
                  {step}
                </li>
              ))}
            </ol>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">The problem</p>
            <p className="mt-1 rounded-md border-2 border-border bg-surface px-4 py-3 text-ink">
              Plants in our classroom dry out over the weekend.
            </p>
          </div>
        </article>

        {/* Startup Simulator */}
        <article className="flex flex-col rounded-xl border-2 border-ink bg-surface p-6 sm:p-8">
          <Badge tone="mint" className="self-start">
            <TrendingUp aria-hidden="true" /> Startup Simulator
          </Badge>
          <h3 className="mt-4 text-2xl font-bold text-ink">Make choices, see what happens</h3>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            Children start with a budget of {virtualCurrency.name}, choose how much to make and what to charge, then
            handle surprises like a rainy week. After every round, clear feedback explains what happened and why.
          </p>
          <div aria-hidden="true" className="mt-6 rounded-lg border-2 border-ink/15 bg-background p-5">
            <div className="flex items-center justify-between">
              <p className="font-display font-bold text-ink">Week 3 of 6</p>
              <p className="text-sm font-semibold text-muted-foreground">Price: 12 FB per pot</p>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {exampleRound.map((item) => (
                <div
                  key={item.label}
                  className={
                    item.highlight
                      ? "rounded-md border-2 border-ink bg-mint-soft p-3"
                      : "rounded-md border-2 border-border bg-surface p-3"
                  }
                >
                  <dt className="text-xs font-semibold text-muted-foreground">{item.label}</dt>
                  <dd className="mt-0.5 font-display text-lg font-extrabold text-ink">{item.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 rounded-md bg-sky-soft px-4 py-3 text-sm font-semibold text-ink">
              💡 Nice pricing! Most customers thought 12 FB felt fair, so you sold most of your pots.
            </p>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {virtualCurrency.name} ({virtualCurrency.symbol}) are pretend money for learning. No real money is ever
            used, earned or spent.
          </p>
        </article>
      </div>
    </Section>
  );
}
