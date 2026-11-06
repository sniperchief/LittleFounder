"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, Check, Factory, Lightbulb, Megaphone, Play, Tag, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";

import { runSimulationAction, saveSimulationDraftAction } from "@/app/play/simulator/actions";
import { fb, PretendLabel } from "@/components/simulator/simulation-result";
import { Button } from "@/components/ui/button";
import { estimateCosts, type SimulatorModel } from "@/content/simulator";
import { cn } from "@/lib/utils";

type Draft = { price?: number | null; quantity?: number | null; marketing?: string | null; step?: number };

type Props = {
  sessionId: string;
  model: SimulatorModel;
  title: string;
  intro: string;
  product: string;
  productPlural: string;
  draft: Draft;
};

const steps = ["Meet the challenge", "Set your price", "Make your stock", "Spread the word", "Check your plan"];

function Tip({ children }: { children: ReactNode }) {
  return (
    <aside className="flex gap-3 rounded-2xl border-2 border-ink bg-sun-soft p-4 text-ink/90">
      <Lightbulb className="mt-0.5 size-6 shrink-0 text-ink" aria-hidden="true" />
      <div>{children}</div>
    </aside>
  );
}

function Option({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      className={cn(
        "flex w-full flex-col items-start rounded-2xl border-2 px-4 py-3 text-left transition-colors",
        selected ? "border-ink bg-sun-soft shadow-[var(--shadow-sticker)]" : "border-border bg-surface hover:border-ink/60",
        disabled && "cursor-not-allowed opacity-55 hover:border-border",
      )}
    >
      {children}
    </button>
  );
}

function BudgetMeter({ model, quantity, marketing }: { model: SimulatorModel; quantity: number | null; marketing: string | null }) {
  const c = estimateCosts(model, quantity, marketing);
  const pct = Math.min(100, Math.round((c.total / model.startingBudget) * 100));
  return (
    <div className="rounded-2xl border-2 border-ink bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-bold text-ink">
          <Wallet className="size-5" aria-hidden="true" /> Budget: {fb(model.startingBudget)}
        </p>
        <PretendLabel />
      </div>
      <div
        role="meter"
        aria-label="Budget spent"
        aria-valuemin={0}
        aria-valuemax={model.startingBudget}
        aria-valuenow={Math.min(c.total, model.startingBudget)}
        className="mt-3 h-4 overflow-hidden rounded-full border border-ink/15 bg-muted"
      >
        <div className={cn("h-full rounded-full", c.overBudget ? "bg-coral" : "bg-mint")} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-sm font-semibold text-ink">
        Planned spending {fb(c.total)} · {c.overBudget ? <span className="text-coral-ink">over budget by {fb(-c.left)}</span> : <>left {fb(c.left)}</>}
      </p>
    </div>
  );
}

export function SimulatorPlayer({ sessionId, model, title, intro, product, productPlural, draft }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(Math.min(Math.max(draft.step ?? 1, 1), 5));
  const [price, setPrice] = useState<number | null>(draft.price ?? null);
  const [quantity, setQuantity] = useState<number | null>(draft.quantity ?? null);
  const [marketing, setMarketing] = useState<string | null>(draft.marketing ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const costs = estimateCosts(model, quantity, marketing);
  const canContinue = step === 1 || (step === 2 && price !== null) || (step === 3 && quantity !== null) || (step === 4 && marketing !== null);

  function go(next: number) {
    setError(null);
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Remember progress so the child can resume later (best effort).
    void saveSimulationDraftAction(sessionId, { price, quantity, marketing, step: next });
  }

  function run() {
    if (price === null || quantity === null || marketing === null) return;
    setError(null);
    startTransition(async () => {
      const res = await runSimulationAction(sessionId, { price, quantity, marketing });
      if (res.status === "error") {
        setError(res.message);
        return;
      }
      const badges = res.badges.map((b) => b.key).join(",");
      router.push(`/play/simulator/${sessionId}?done=1${badges ? `&badges=${badges}` : ""}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <ol className="grid grid-cols-5 gap-1.5" aria-label="Simulator steps">
        {steps.map((s, i) => (
          <li key={s} aria-current={i + 1 === step ? "step" : undefined} className="flex flex-col items-center gap-1 text-center">
            <span
              className={cn(
                "flex size-9 items-center justify-center rounded-full border-2 font-display font-extrabold",
                i + 1 === step ? "border-ink bg-sun text-ink" : i + 1 < step ? "border-ink bg-mint text-ink" : "border-ink/25 bg-surface text-ink/60",
              )}
            >
              {i + 1 < step ? <Check className="size-4" aria-hidden="true" /> : i + 1}
            </span>
            <span className="hidden text-xs font-bold text-muted-foreground sm:block">{s}</span>
          </li>
        ))}
      </ol>

      <section aria-labelledby="sim-step" className="rounded-3xl border-2 border-ink bg-surface p-5 shadow-[var(--shadow-sticker-lg)] sm:p-8">
        <p className="text-sm font-bold uppercase tracking-[0.12em] text-coral-ink">Step {step} of 5</p>
        <h2 id="sim-step" className="mt-1 text-3xl font-extrabold text-ink">
          {steps[step - 1]}
        </h2>

        <div className="mt-6 space-y-6">
          {step === 1 ? (
            <>
              <p className="text-lg text-ink/90">{intro}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border-2 border-ink bg-sky-soft p-4">
                  <Wallet className="size-6 text-ink" aria-hidden="true" />
                  <p className="mt-2 font-display text-2xl font-extrabold text-ink">{fb(model.startingBudget)}</p>
                  <p className="text-sm text-ink/80">Your starting budget</p>
                </div>
                <div className="rounded-2xl border-2 border-ink bg-coral-soft p-4">
                  <Factory className="size-6 text-ink" aria-hidden="true" />
                  <p className="mt-2 font-display text-2xl font-extrabold text-ink">{fb(model.unitCost)}</p>
                  <p className="text-sm text-ink/80">To make one {product}</p>
                </div>
                <div className="rounded-2xl border-2 border-ink bg-mint-soft p-4">
                  <Tag className="size-6 text-ink" aria-hidden="true" />
                  <p className="mt-2 font-display text-2xl font-extrabold text-ink">3 choices</p>
                  <p className="text-sm text-ink/80">Price, how many, marketing</p>
                </div>
              </div>
              <Tip>
                <p className="font-bold text-ink">Startup costs</p>
                Before you sell anything, you spend money making your {productPlural}. That&apos;s your cost. Money from customers is your{" "}
                <strong>revenue</strong>. If revenue is bigger than your costs, you made a <strong>profit</strong>.
              </Tip>
              <p className="flex items-start gap-2 rounded-xl bg-muted px-4 py-3 text-sm text-ink/85">
                <PretendLabel className="shrink-0" /> Founder Bucks (FB) are pretend, virtual units for learning. They aren&apos;t real money,
                crypto or prizes, and can&apos;t be swapped for anything.
              </p>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Tip>
                <p className="font-bold text-ink">Pricing</p>
                A higher price earns more from each {product}, but fewer people will buy. A lower price brings more buyers but less
                from each one. Each {product} costs {fb(model.unitCost)} to make.
              </Tip>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Selling price">
                {model.prices.map((p) => (
                  <Option key={p} selected={price === p} onClick={() => setPrice(p)}>
                    <span className="font-display text-2xl font-extrabold text-ink">{fb(p)}</span>
                    <span className="text-sm text-ink/75">
                      You keep {fb(p - model.unitCost)} per {product} after making it
                    </span>
                  </Option>
                ))}
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Tip>
                <p className="font-bold text-ink">Production</p>
                Every {product} you make costs {fb(model.unitCost)}, sold or not. Make too few and you miss customers; make too many and
                the leftovers are wasted money.
              </Tip>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="How many to make">
                {model.quantities.map((q) => (
                  <Option key={q} selected={quantity === q} onClick={() => setQuantity(q)}>
                    <span className="font-display text-2xl font-extrabold text-ink">{q} {productPlural}</span>
                    <span className="text-sm text-ink/75">
                      Costs {q} × {fb(model.unitCost)} = {fb(q * model.unitCost)}
                    </span>
                  </Option>
                ))}
              </div>
              <BudgetMeter model={model} quantity={quantity} marketing={null} />
            </>
          ) : null}

          {step === 4 ? (
            <>
              <Tip>
                <p className="font-bold text-ink">Marketing</p>
                Marketing tells more people about your {product}, so more customers want one. It costs Founder Bucks, so it only helps if
                the extra sales earn more than it costs — and if you made enough to sell!
              </Tip>
              <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Marketing">
                {model.marketing.map((m) => {
                  const total = (quantity ?? 0) * model.unitCost + m.cost;
                  const tooMuch = total > model.startingBudget;
                  return (
                    <Option key={m.key} selected={marketing === m.key} disabled={tooMuch} onClick={() => setMarketing(m.key)}>
                      <span className="flex items-center gap-2 font-bold text-ink">
                        <Megaphone className="size-4" aria-hidden="true" /> {m.label}
                      </span>
                      <span className="text-sm text-ink/75">
                        Costs {fb(m.cost)} · {m.reach > 0 ? `about ${m.reach} more interested customers` : "no extra customers"}
                      </span>
                      <span className="text-sm text-ink/75">{m.description}</span>
                      {tooMuch ? (
                        <span className="mt-1 text-sm font-bold text-coral-ink">
                          Too expensive: your plan would cost {fb(total)}, but your budget is {fb(model.startingBudget)}.
                        </span>
                      ) : null}
                    </Option>
                  );
                })}
              </div>
              <BudgetMeter model={model} quantity={quantity} marketing={marketing} />
            </>
          ) : null}

          {step === 5 ? (
            <>
              <dl className="divide-y divide-border rounded-2xl border-2 border-ink bg-surface px-5">
                {[
                  ["Selling price", price !== null ? `${fb(price)} each` : "Not chosen"],
                  [`${productPlural[0].toUpperCase()}${productPlural.slice(1)} to make`, quantity !== null ? String(quantity) : "Not chosen"],
                  ["Making cost", fb(costs.production)],
                  ["Marketing", `${model.marketing.find((m) => m.key === marketing)?.label ?? "Not chosen"} (${fb(costs.marketing)})`],
                  ["Total spending", fb(costs.total)],
                  ["Budget left before selling", fb(costs.left)],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-3 py-2.5">
                    <dt className="text-ink/80">{k}</dt>
                    <dd className="text-right font-bold text-ink tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
              {costs.overBudget ? (
                <p className="flex gap-2 rounded-xl bg-coral-soft px-4 py-3 font-semibold text-ink" role="alert">
                  <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" /> This plan costs {fb(costs.total)} — more than your{" "}
                  {fb(model.startingBudget)} budget. Go back and make fewer {productPlural} or pick cheaper marketing.
                </p>
              ) : (
                <Tip>
                  Ready? When you run your season, we&apos;ll work out how many customers buy, your revenue and your profit. You can always try
                  again with different choices.
                </Tip>
              )}
            </>
          ) : null}
        </div>

        <div aria-live="polite" className="mt-5">
          {error ? <p className="rounded-lg bg-coral-soft px-4 py-3 font-semibold text-ink">{error}</p> : null}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 border-t-2 border-dashed border-border pt-6 sm:flex-row sm:justify-between">
          {step > 1 ? (
            <Button type="button" variant="ghost" onClick={() => go(step - 1)} disabled={pending}>
              <ArrowLeft aria-hidden="true" /> Back
            </Button>
          ) : (
            <span />
          )}
          {step < 5 ? (
            <Button type="button" onClick={() => go(step + 1)} disabled={!canContinue || pending}>
              {step === 1 ? "Let's go" : "Next"} <ArrowRight aria-hidden="true" />
            </Button>
          ) : (
            <Button
              type="button"
              size="lg"
              onClick={run}
              disabled={pending || costs.overBudget || price === null || quantity === null || marketing === null}
            >
              <Play aria-hidden="true" /> {pending ? "Running your season…" : `Run ${title}'s season`}
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
