import { Lightbulb, TrendingDown, TrendingUp, Minus } from "lucide-react";

import { feedbackText, reflectionOptions, tryNextText } from "@/content/simulator";
import type { SimulationResult } from "@/lib/data/simulator";
import { cn } from "@/lib/utils";

// Results of one completed simulation. Server-safe (no actions), used by the child's
// results page and the parent's read-only view. Amounts are pretend Founder Bucks.

export const fb = (n: number) => `${n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("en")} FB`;

export function PretendLabel({ className }: { className?: string }) {
  return (
    <span className={cn("inline-block rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground", className)}>
      Pretend money
    </span>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-2 last:border-0">
      <dt className={cn("text-ink/80", strong && "font-bold text-ink")}>{label}</dt>
      <dd className={cn("shrink-0 font-display font-extrabold text-ink tabular-nums", strong ? "text-xl" : "text-lg")}>{value}</dd>
    </div>
  );
}

function Bar({ label, value, max, tone }: { label: string; value: number; max: number; tone: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((Math.abs(value) / max) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm font-semibold text-ink">
        <span>{label}</span>
        <span className="tabular-nums">{fb(value)}</span>
      </div>
      <div className="mt-1 h-4 overflow-hidden rounded-full border border-ink/15 bg-muted" aria-hidden="true">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

export function SimulationResultView({
  result,
  productPlural,
  reflection,
}: {
  result: SimulationResult;
  productPlural: string;
  reflection?: string | null;
}) {
  const r = result;
  const Icon = r.outcome === "profit" ? TrendingUp : r.outcome === "loss" ? TrendingDown : Minus;
  const maxBar = Math.max(r.starting_budget, r.revenue, r.total_cost, r.cash_remaining);
  const tips = r.feedback.map((k) => tryNextText[k]).filter(Boolean);
  const reflectionLabel = reflectionOptions.find((o) => o.key === reflection)?.label;

  return (
    <div className="space-y-6">
      <section
        className={cn(
          "rounded-3xl border-2 border-ink p-6 text-center shadow-[var(--shadow-sticker-lg)] sm:p-8",
          r.outcome === "profit" ? "bg-mint-soft" : r.outcome === "loss" ? "bg-coral-soft" : "bg-sun-soft",
        )}
      >
        <Icon className="mx-auto size-10 text-ink" aria-hidden="true" />
        <p className="mt-2 text-sm font-bold uppercase tracking-[0.14em] text-ink/70">
          {r.outcome === "profit" ? "Profit" : r.outcome === "loss" ? "Loss" : "Break-even"}
        </p>
        <p className="font-display text-5xl font-extrabold text-ink tabular-nums">{fb(r.profit)}</p>
        <p className="mx-auto mt-2 max-w-md text-ink/85">{feedbackText[r.outcome]}</p>
        <PretendLabel className="mt-3" />
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section aria-labelledby="decided" className="rounded-2xl border-2 border-ink bg-surface p-5">
          <h2 id="decided" className="text-xl font-bold text-ink">
            What you decided
          </h2>
          <dl className="mt-2">
            <Line label="Selling price" value={`${fb(r.price)} each`} />
            <Line label={`${productPlural[0].toUpperCase()}${productPlural.slice(1)} made`} value={String(r.quantity)} />
            <Line label="Cost to make one" value={fb(r.unit_cost)} />
            <Line label={`Making cost (${r.quantity} × ${r.unit_cost})`} value={fb(r.production_cost)} />
            <Line label={`Marketing: ${r.marketing_label}`} value={fb(r.marketing_cost)} />
          </dl>
        </section>
        <section aria-labelledby="happened" className="rounded-2xl border-2 border-ink bg-surface p-5">
          <h2 id="happened" className="text-xl font-bold text-ink">
            What happened
          </h2>
          <dl className="mt-2">
            <Line label="Customers who wanted one" value={String(r.interested)} />
            <Line label={`${productPlural[0].toUpperCase()}${productPlural.slice(1)} sold`} value={String(r.units_sold)} />
            <Line label="Left over (not sold)" value={String(r.unsold)} />
            <Line label="Customers you missed" value={String(r.missed_customers)} />
          </dl>
        </section>
      </div>

      <section aria-labelledby="money" className="rounded-2xl border-2 border-ink bg-surface p-5 sm:p-6">
        <h2 id="money" className="text-xl font-bold text-ink">
          Where the Founder Bucks went <PretendLabel className="ml-1 align-middle" />
        </h2>
        <div className="mt-4 space-y-3">
          <Bar label="Starting budget" value={r.starting_budget} max={maxBar} tone="bg-sky" />
          <Bar label="Total costs (making + marketing)" value={r.total_cost} max={maxBar} tone="bg-coral" />
          <Bar label={`Revenue (${r.units_sold} × ${fb(r.price)})`} value={r.revenue} max={maxBar} tone="bg-mint" />
          <Bar label="Cash remaining" value={r.cash_remaining} max={maxBar} tone="bg-sun" />
        </div>
        <dl className="mt-5 rounded-xl bg-muted/60 px-4 py-2">
          <Line label="Revenue" value={fb(r.revenue)} />
          <Line label="− Total costs" value={fb(r.total_cost)} />
          <Line label="= Profit" value={fb(r.profit)} strong />
        </dl>
        <p className="mt-4 flex gap-2 rounded-xl border-2 border-dashed border-ink/30 px-4 py-3 text-ink/85">
          <Lightbulb className="mt-0.5 size-5 shrink-0 text-ink" aria-hidden="true" />
          <span>
            <strong className="text-ink">Cash remaining isn&apos;t profit.</strong> You started with {fb(r.starting_budget)}, so cash
            remaining ({fb(r.cash_remaining)}) = starting budget + profit. Profit only counts what the business earned minus what it spent.
          </span>
        </p>
      </section>

      <section aria-labelledby="why" className="rounded-2xl border-2 border-ink bg-sun-soft p-5 sm:p-6">
        <h2 id="why" className="text-xl font-bold text-ink">
          Why it turned out this way
        </h2>
        <ul className="mt-3 space-y-2">
          {r.feedback
            .filter((k) => k !== r.outcome)
            .map((k) => (
              <li key={k} className="flex gap-2 text-ink">
                <span className="mt-2 size-2 shrink-0 rounded-full bg-coral" aria-hidden="true" />
                {feedbackText[k]}
              </li>
            ))}
        </ul>
        {tips.length > 0 ? (
          <>
            <h3 className="mt-5 font-bold text-ink">Ideas for your next attempt</h3>
            <ul className="mt-2 space-y-1.5">
              {tips.map((t) => (
                <li key={t} className="text-ink/85">
                  → {t}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <p className="mt-4 text-sm text-ink/70">
          This is a practice game with pretend numbers. Real businesses are more complicated — this result doesn&apos;t predict real success.
        </p>
      </section>

      {reflectionLabel ? (
        <p className="rounded-xl bg-grape-soft px-4 py-3 text-ink">
          <span className="font-bold">Reflection: </span>
          {reflectionLabel}
        </p>
      ) : null}
    </div>
  );
}
