import type { Metadata } from "next";
import { PartyPopper, RotateCcw } from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { startSimulationAction } from "@/app/play/simulator/actions";
import { BackLink, ChildPageSkeleton } from "@/components/academy/academy-ui";
import { BadgeList } from "@/components/academy/badge-list";
import { ReflectionForm } from "@/components/simulator/reflection-form";
import { fb, SimulationResultView } from "@/components/simulator/simulation-result";
import { SimulatorPlayer } from "@/components/simulator/simulator-player";
import { SubmitButton } from "@/components/ui/form-controls";
import { scenarios } from "@/content/simulator";
import { requireChildMode } from "@/lib/auth/session";
import { getAchievementTitles } from "@/lib/data/academy";
import { getSimulation, listSimulations, simulationName } from "@/lib/data/simulator";
import { uuidSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Simulation" };

export default function SimulationPage(props: PageProps<"/play/simulator/[sessionId]">) {
  return (
    <Suspense fallback={<ChildPageSkeleton />}>
      <Simulation {...props} />
    </Suspense>
  );
}

async function Simulation({ params, searchParams }: PageProps<"/play/simulator/[sessionId]">) {
  const [{ sessionId }, query, { child, supabase }] = await Promise.all([params, searchParams, requireChildMode()]);
  if (!uuidSchema.safeParse(sessionId).success) notFound();
  const sim = await getSimulation(supabase, child.id, sessionId);
  if (!sim || sim.status === "abandoned") notFound();

  const content = scenarios.find((s) => s.key === sim.scenarioKey) ?? scenarios[0];
  const name = simulationName(sim);
  const productPlural = sim.projectName ? "items" : content.productPlural;
  const product = sim.projectName ? "item" : content.product;

  if (sim.status === "active" || !sim.result) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <BackLink href="/play/simulator">Startup Simulator</BackLink>
        <h1 className="mt-4 text-4xl font-extrabold text-ink [overflow-wrap:anywhere]">{name}</h1>
        <div className="mt-6">
          <SimulatorPlayer
            sessionId={sim.id}
            model={sim.model}
            title={sim.projectName ?? content.title}
            intro={sim.projectName ? `${content.intro} You're selling ${sim.projectName}.` : content.intro}
            product={product}
            productPlural={productPlural}
            draft={sim.draft}
          />
        </div>
      </div>
    );
  }

  const badgeKeys = typeof query.badges === "string" ? query.badges.split(",").filter((k) => /^[a-z0-9-]{1,40}$/.test(k)).slice(0, 5) : [];
  const [badges, history] = await Promise.all([getAchievementTitles(supabase, badgeKeys), listSimulations(supabase, child.id)]);
  const comparable = history.filter(
    (s) => s.status === "completed" && s.result && s.scenarioKey === sim.scenarioKey && s.projectId === sim.projectId,
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <BackLink href="/play/simulator">Startup Simulator</BackLink>
      <h1 className="mt-4 text-4xl font-extrabold text-ink [overflow-wrap:anywhere]">{name}: your results</h1>

      {query.done === "1" ? (
        <div className="mt-5 space-y-4">
          <p className="flex items-center gap-2 rounded-xl bg-mint-soft px-4 py-3 text-lg font-bold text-ink">
            <PartyPopper className="size-6" aria-hidden="true" /> Season complete! Here&apos;s how your business did.
          </p>
          {badges.length > 0 ? <BadgeList badges={badges} heading="New badge unlocked!" /> : null}
        </div>
      ) : null}

      <div className="mt-6">
        <SimulationResultView result={sim.result} productPlural={productPlural} reflection={sim.reflection} />
      </div>

      {sim.reflection ? null : (
        <div className="mt-6">
          <ReflectionForm sessionId={sim.id} />
        </div>
      )}

      <form action={startSimulationAction} className="mt-6">
        <input type="hidden" name="scenario" value={sim.scenarioKey} />
        {sim.projectId ? <input type="hidden" name="projectId" value={sim.projectId} /> : null}
        <SubmitButton size="lg" pendingLabel="Starting…">
          <RotateCcw aria-hidden="true" /> Try another attempt
        </SubmitButton>
      </form>

      {comparable.length > 1 ? (
        <section aria-labelledby="compare" className="mt-10">
          <h2 id="compare" className="text-2xl font-bold text-ink">
            Compare your attempts
          </h2>
          <div className="mt-4 overflow-x-auto rounded-2xl border-2 border-ink">
            <table className="w-full min-w-[34rem] border-collapse text-left">
              <thead className="bg-muted">
                <tr>
                  {["Attempt", "Price", "Made", "Marketing", "Sold", "Profit"].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2 text-sm font-bold text-ink">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparable
                  .slice()
                  .reverse()
                  .map((s, i) => (
                    <tr key={s.id} className={s.id === sim.id ? "bg-sun-soft" : "bg-surface"}>
                      <th scope="row" className="border-t border-border px-3 py-2 font-semibold text-ink">
                        #{i + 1}
                        {s.id === sim.id ? " (this one)" : ""}
                      </th>
                      <td className="border-t border-border px-3 py-2 tabular-nums">{fb(s.result!.price)}</td>
                      <td className="border-t border-border px-3 py-2 tabular-nums">{s.result!.quantity}</td>
                      <td className="border-t border-border px-3 py-2">{s.result!.marketing_label}</td>
                      <td className="border-t border-border px-3 py-2 tabular-nums">{s.result!.units_sold}</td>
                      <td className="border-t border-border px-3 py-2 font-bold tabular-nums">{fb(s.result!.profit)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
