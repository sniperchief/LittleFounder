import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/layout/page-skeleton";
import { SimulationResultView } from "@/components/simulator/simulation-result";
import { scenarios } from "@/content/simulator";
import { requireParent } from "@/lib/auth/session";
import { getChild } from "@/lib/data/children";
import { getSimulation, simulationName } from "@/lib/data/simulator";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Simulation result" };

const dateFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric" });

export default function ParentSimulationPage(props: PageProps<"/parent/children/[childId]/simulations/[sessionId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}

async function Content({ params }: PageProps<"/parent/children/[childId]/simulations/[sessionId]">) {
  await requireParent();
  const { childId, sessionId } = await params;
  if (!uuidSchema.safeParse(childId).success || !uuidSchema.safeParse(sessionId).success) notFound();

  // RLS returns nothing for another family's child or simulation, so this is a 404 for them.
  const child = await getChild(childId);
  if (!child) notFound();
  const sim = await getSimulation(await createClient(), child.id, sessionId);
  if (!sim || sim.status !== "completed" || !sim.result) notFound();
  const content = scenarios.find((s) => s.key === sim.scenarioKey);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href={`/parent/children/${child.id}`} className="inline-flex items-center gap-2 font-semibold text-muted-foreground hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" /> {child.nickname}&apos;s activity
      </Link>
      <h1 className="mt-6 text-3xl font-extrabold text-ink [overflow-wrap:anywhere]">{simulationName(sim)}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Startup Simulator · completed {dateFormat.format(new Date(sim.completedAt ?? sim.createdAt))}. Read-only view. Founder Bucks are
        pretend, virtual units — this is a learning game, not a prediction of real business results.
      </p>
      <div className="mt-6">
        <SimulationResultView
          result={sim.result}
          productPlural={sim.projectName ? "items" : (content?.productPlural ?? "items")}
          reflection={sim.reflection}
        />
      </div>
    </div>
  );
}
