import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BackLink, ChildPageSkeleton } from "@/components/academy/academy-ui";
import { PitchBuilder } from "@/components/pitch/pitch-builder";
import { requireChildMode } from "@/lib/auth/session";
import { getPitch, pitchState } from "@/lib/data/pitch";
import { uuidSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Build my pitch" };

export default function EditPitchPage(props: PageProps<"/play/pitch/[deckId]/edit">) {
  return (
    <Suspense fallback={<ChildPageSkeleton />}>
      <EditPitch {...props} />
    </Suspense>
  );
}

async function EditPitch({ params, searchParams }: PageProps<"/play/pitch/[deckId]/edit">) {
  const [{ deckId }, query, { child, supabase }] = await Promise.all([params, searchParams, requireChildMode()]);
  if (!uuidSchema.safeParse(deckId).success) notFound();
  // Only the active child's own pitch (child id from Child Mode, not from the URL).
  const pitch = await getPitch(supabase, child.id, deckId);
  if (!pitch) notFound();

  const requested = Number(query.step);
  const step = Number.isInteger(requested) && requested >= 1 && requested <= 6 ? requested : pitch.builderStep;
  const state = pitchState({ status: pitch.status, versionCount: pitch.versions.length });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <BackLink href={state === "draft" ? "/play/pitch" : `/play/pitch/${pitch.id}`}>{state === "draft" ? "Pitch Studio" : "Back to my pitch"}</BackLink>
      <h1 className="mt-4 text-4xl font-extrabold text-ink [overflow-wrap:anywhere]">
        {state === "draft" ? "Build your pitch" : `Improve ${pitch.current.title}`}
      </h1>
      <p className="mt-1 text-lg text-ink/80">Jump to any part using the numbers. Your answers are saved each time you move on.</p>
      <div className="mt-6">
        <PitchBuilder
          key={pitch.id}
          deckId={pitch.id}
          initial={pitch.current}
          initialStep={step}
          versionCount={pitch.versions.length}
          prefilled={query.new === "1"}
        />
      </div>
    </div>
  );
}
