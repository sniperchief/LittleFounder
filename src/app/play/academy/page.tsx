import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";
import { Suspense } from "react";

import { BackLink, ChildPageSkeleton, ModuleCard, NextStepCard } from "@/components/academy/academy-ui";
import { ProgressBar } from "@/components/dashboard/activity-panels";
import { requireChildMode } from "@/lib/auth/session";
import { getAcademyOverview } from "@/lib/data/academy";

export const metadata: Metadata = { title: "Founder Academy" };

export default function AcademyPage() {
  return (
    <Suspense fallback={<ChildPageSkeleton />}>
      <Academy />
    </Suspense>
  );
}

async function Academy() {
  const { child, supabase } = await requireChildMode();
  const academy = await getAcademyOverview(supabase, child.id);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <BackLink href="/play">Founder HQ</BackLink>
      <header className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl border-2 border-ink bg-sun shadow-[var(--shadow-sticker)]">
            <GraduationCap className="size-8 text-ink" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-4xl font-extrabold text-ink">Founder Academy</h1>
            <p className="text-lg text-ink/75">Six modules. Short lessons. Real founder skills.</p>
          </div>
        </div>
        <div className="w-full max-w-xs">
          <p className="mb-1.5 text-sm font-bold text-ink">
            {academy.lessonsCompleted} of {academy.lessonsTotal} lessons · {academy.modulesCompleted} of {academy.modules.length} modules
          </p>
          <ProgressBar value={academy.lessonsCompleted} max={academy.lessonsTotal} label="Lessons completed" />
        </div>
      </header>

      <div className="mt-8">
        <NextStepCard next={academy.next} />
      </div>

      <h2 className="mt-10 text-2xl font-bold text-ink">All modules</h2>
      <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {academy.modules.map((m) => (
          <ModuleCard key={m.key} module={m} />
        ))}
      </ul>
    </div>
  );
}
