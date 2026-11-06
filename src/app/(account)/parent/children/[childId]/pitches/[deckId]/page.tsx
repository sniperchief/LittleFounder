import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/layout/page-skeleton";
import { DeckGrid, formatDate, PracticeResultView } from "@/components/pitch/pitch-visuals";
import { bandOf } from "@/content/pitch-studio";
import { requireParent } from "@/lib/auth/session";
import { getChild } from "@/lib/data/children";
import { getPitch, getPractice } from "@/lib/data/pitch";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Pitch" };

export default function ParentPitchPage(props: PageProps<"/parent/children/[childId]/pitches/[deckId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}

async function Content({ params, searchParams }: PageProps<"/parent/children/[childId]/pitches/[deckId]">) {
  await requireParent();
  const [{ childId, deckId }, query] = await Promise.all([params, searchParams]);
  if (!uuidSchema.safeParse(childId).success || !uuidSchema.safeParse(deckId).success) notFound();

  // RLS returns nothing for another family's child or pitch, so this is a 404 for them.
  const child = await getChild(childId);
  if (!child) notFound();
  const supabase = await createClient();
  const pitch = await getPitch(supabase, child.id, deckId);
  if (!pitch || pitch.versions.length === 0) notFound();

  const requested = typeof query.version === "string" ? Number(query.version) : null;
  const shown = (requested !== null ? pitch.versions.find((v) => v.version === requested) : null) ?? pitch.versions[0];
  const completed = pitch.practices.filter((p) => p.completedAt).slice(0, 10);
  const practices = (await Promise.all(completed.map((p) => getPractice(supabase, child.id, p.id)))).filter((p) => p !== null);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href={`/parent/children/${child.id}`} className="inline-flex items-center gap-2 font-semibold text-muted-foreground hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" /> {child.nickname}&apos;s activity
      </Link>
      <h1 className="mt-6 text-3xl font-extrabold text-ink [overflow-wrap:anywhere]">{shown.snapshot.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Pitch Studio · version {shown.version} finished {formatDate(shown.createdAt)}. Read-only view. Pitches are private to your family and
        are never shared publicly.
      </p>

      {pitch.versions.length > 1 ? (
        <nav aria-label="Pitch versions" className="mt-4">
          <ul className="flex flex-wrap gap-2">
            {pitch.versions.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/parent/children/${child.id}/pitches/${pitch.id}?version=${v.version}`}
                  aria-current={v.version === shown.version ? "page" : undefined}
                  className={`inline-flex rounded-full border-2 px-3 py-1 text-sm font-semibold ${
                    v.version === shown.version ? "border-ink bg-sun-soft text-ink" : "border-border bg-surface text-muted-foreground hover:text-ink"
                  }`}
                >
                  Version {v.version} · {formatDate(v.createdAt)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <section aria-labelledby="deck" className="mt-6">
        <h2 id="deck" className="text-xl font-bold text-ink">
          Pitch deck
        </h2>
        <div className="mt-3">
          <DeckGrid deck={shown.snapshot} />
        </div>
      </section>

      <section aria-labelledby="practice" className="mt-10">
        <h2 id="practice" className="text-xl font-bold text-ink">
          Investor Room practice
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Practice with made-up, pretend investors. Scores come from fixed rules (see the rubric below). No real investor reviews the pitch and no
          money or investment is involved.
        </p>
        {practices.length === 0 ? (
          <p className="mt-3 rounded-lg border-2 border-dashed border-ink/20 px-4 py-5 text-center text-muted-foreground">No practice completed yet.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {practices.map((p, i) => (
              <details key={p.id} open={i === 0} className="rounded-xl border-2 border-ink bg-surface p-4 sm:p-5">
                <summary className="cursor-pointer font-bold text-ink">
                  {p.personaName} · version {p.version ?? 1} · {p.totalScore}/100 ({bandOf(p.band).label}) · {formatDate(p.completedAt ?? p.createdAt)}
                </summary>
                <div className="mt-4">
                  <PracticeResultView practice={p} />
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
