import type { Metadata } from "next";
import { ArrowRight, Droplets, FlaskConical, Play, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { startSimulationAction } from "@/app/play/simulator/actions";
import { BackLink, ChildPageSkeleton } from "@/components/academy/academy-ui";
import { IdeaIcon } from "@/components/ideas/idea-visuals";
import { fb, PretendLabel } from "@/components/simulator/simulation-result";
import { SubmitButton } from "@/components/ui/form-controls";
import { scenarios } from "@/content/simulator";
import { requireChildMode } from "@/lib/auth/session";
import { listIdeas } from "@/lib/data/ideas";
import { listSimulations, simulationName } from "@/lib/data/simulator";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Startup Simulator" };

const dateFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "short" });

const errors: Record<string, string> = {
  idea_required: "Pick one of your created ideas to try it in the simulator.",
  rate_limited: "That's a lot of new attempts! Take a short break and come back.",
};

export default function SimulatorHubPage(props: PageProps<"/play/simulator">) {
  return (
    <Suspense fallback={<ChildPageSkeleton />}>
      <SimulatorHub {...props} />
    </Suspense>
  );
}

async function SimulatorHub({ searchParams }: PageProps<"/play/simulator">) {
  const [{ child, supabase }, query] = await Promise.all([requireChildMode(), searchParams]);
  const [simulations, ideas] = await Promise.all([listSimulations(supabase, child.id), listIdeas(supabase, child.id)]);
  const createdIdeas = ideas.filter((i) => i.status === "ready");
  const eco = scenarios.find((s) => s.key === "ecobottle")!;
  const ecoActive = simulations.find((s) => s.scenarioKey === "ecobottle" && s.status === "active");
  const error = typeof query.error === "string" ? (errors[query.error] ?? "Something went wrong. Please try again.") : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <BackLink href="/play">Founder HQ</BackLink>

      <header className="mt-5 rounded-3xl border-2 border-ink bg-mint-soft p-6 shadow-[var(--shadow-sticker-lg)] sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <span className="flex size-20 shrink-0 items-center justify-center rounded-3xl border-2 border-ink bg-surface">
            <TrendingUp className="size-10 text-ink" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-4xl font-extrabold text-ink">Startup Simulator</h1>
            <p className="mt-1 text-lg text-ink/85">
              Run a pretend business for one season. Choose a price, decide how many to make, pick your marketing — then see what happens.
            </p>
          </div>
        </div>
        <ul className="mt-5 grid gap-2 text-sm text-ink/85 sm:grid-cols-3">
          <li className="rounded-xl bg-surface px-3 py-2"><strong className="text-ink">Learn:</strong> costs, pricing and production</li>
          <li className="rounded-xl bg-surface px-3 py-2"><strong className="text-ink">See:</strong> revenue, profit and loss</li>
          <li className="rounded-xl bg-surface px-3 py-2"><strong className="text-ink">Try again:</strong> compare different plans</li>
        </ul>
        <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-ink/80">
          <PretendLabel /> Founder Bucks (FB) are pretend, virtual units — not real money, crypto or prizes.
        </p>
      </header>

      {error ? (
        <p role="alert" className="mt-6 rounded-lg bg-coral-soft px-4 py-3 font-semibold text-ink">
          {error}
        </p>
      ) : null}

      <section aria-labelledby="challenges" className="mt-8">
        <h2 id="challenges" className="text-2xl font-bold text-ink">
          Choose a challenge
        </h2>
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <div className="flex flex-col rounded-3xl border-2 border-ink bg-surface p-6">
            <div className="flex items-center gap-3">
              <span className="flex size-14 items-center justify-center rounded-2xl border-2 border-ink bg-sky-soft">
                <Droplets className="size-7 text-ink" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-2xl font-bold text-ink">{eco.title}</h3>
                <p className="text-sm font-semibold text-muted-foreground">Starting budget {fb(1000)}</p>
              </div>
            </div>
            <p className="mt-3 flex-1 text-ink/85">{eco.intro}</p>
            <form action={startSimulationAction} className="mt-5">
              <input type="hidden" name="scenario" value="ecobottle" />
              <SubmitButton pendingLabel="Starting…" className="w-full sm:w-auto">
                <Play aria-hidden="true" /> {ecoActive ? "Continue EcoBottle" : "Play EcoBottle"}
              </SubmitButton>
            </form>
          </div>

          <div className="flex flex-col rounded-3xl border-2 border-ink bg-surface p-6">
            <div className="flex items-center gap-3">
              <span className="flex size-14 items-center justify-center rounded-2xl border-2 border-ink bg-coral-soft">
                <FlaskConical className="size-7 text-ink" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-2xl font-bold text-ink">Try my idea</h3>
                <p className="text-sm font-semibold text-muted-foreground">Same practice numbers as EcoBottle</p>
              </div>
            </div>
            {createdIdeas.length === 0 ? (
              <div className="mt-3 flex-1">
                <p className="text-ink/85">Create an idea in the Idea Lab first, then come back to test it here.</p>
                <Link href="/play/ideas" className="mt-4 inline-flex items-center gap-2 font-bold text-ink underline underline-offset-4">
                  Go to the Idea Lab <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                {createdIdeas.map((idea) => (
                  <li key={idea.id}>
                    <form action={startSimulationAction} className="flex items-center gap-3 rounded-xl border-2 border-border p-2 pl-3">
                      <input type="hidden" name="scenario" value="my-idea" />
                      <input type="hidden" name="projectId" value={idea.id} />
                      <IdeaIcon name={idea.icon_key} className="size-5 shrink-0 text-ink" aria-hidden="true" />
                      <span className="min-w-0 flex-1 font-semibold text-ink [overflow-wrap:anywhere]">{idea.name}</span>
                      <SubmitButton size="sm" variant="secondary" pendingLabel="…">
                        Try it<span className="sr-only"> with {idea.name}</span>
                      </SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="attempts" className="mt-10">
        <h2 id="attempts" className="text-2xl font-bold text-ink">
          My simulations
        </h2>
        {simulations.length === 0 ? (
          <p className="mt-3 rounded-2xl border-2 border-dashed border-ink/25 p-6 text-center text-ink/75">
            No simulations yet. Pick a challenge above to run your first business!
          </p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {simulations.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/play/simulator/${s.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border-2 border-ink/30 bg-surface px-5 py-3 hover:border-ink"
                >
                  <span className="min-w-0 flex-1 font-bold text-ink [overflow-wrap:anywhere]">{simulationName(s)}</span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.08em] text-ink",
                      s.status === "completed" ? "bg-mint" : "bg-sun-soft",
                    )}
                  >
                    {s.status === "completed" ? "Completed" : "In progress"}
                  </span>
                  <span className="text-sm font-semibold text-ink tabular-nums">
                    {s.result ? `${s.result.outcome === "loss" ? "Loss" : "Profit"} ${fb(s.result.profit)}` : "Not run yet"}
                  </span>
                  <span className="text-sm text-muted-foreground">{dateFormat.format(new Date(s.completedAt ?? s.createdAt))}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
