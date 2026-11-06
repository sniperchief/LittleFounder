import type { Metadata } from "next";
import { Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BackLink, ChildPageSkeleton } from "@/components/academy/academy-ui";
import { PitchPresenter } from "@/components/pitch/pitch-presenter";
import { buttonVariants } from "@/components/ui/button";
import { requireChildMode } from "@/lib/auth/session";
import { getPitch } from "@/lib/data/pitch";
import { uuidSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Present my pitch" };

export default function PresentPitchPage(props: PageProps<"/play/pitch/[deckId]/present">) {
  return (
    <Suspense fallback={<ChildPageSkeleton />}>
      <PresentPitch {...props} />
    </Suspense>
  );
}

async function PresentPitch({ params, searchParams }: PageProps<"/play/pitch/[deckId]/present">) {
  const [{ deckId }, query, { child, supabase }] = await Promise.all([params, searchParams, requireChildMode()]);
  if (!uuidSchema.safeParse(deckId).success) notFound();
  const pitch = await getPitch(supabase, child.id, deckId);
  if (!pitch) notFound();

  // ?version=N shows a finished version; otherwise the pitch as currently saved.
  const requested = typeof query.version === "string" ? Number(query.version) : null;
  const version = requested !== null ? pitch.versions.find((v) => v.version === requested) : null;
  if (requested !== null && !version) notFound();
  const deck = version?.snapshot ?? pitch.current;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackLink href={`/play/pitch/${pitch.id}`}>Back to my pitch</BackLink>
        {version ? null : (
          <Link href={`/play/pitch/${pitch.id}/edit?step=1`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
            <Pencil aria-hidden="true" /> Edit slides
          </Link>
        )}
      </div>
      <h1 className="mt-4 text-2xl font-extrabold text-ink [overflow-wrap:anywhere] sm:text-3xl">
        {deck.title}: {version ? `version ${version.version}` : "presenting"}
      </h1>
      <p className="mt-1 text-muted-foreground">
        {version ? "A finished version, kept exactly as it was." : "Your latest saved answers. Practise saying each slide out loud!"}
      </p>
      <div className="mt-5">
        <PitchPresenter deck={deck} />
      </div>
    </div>
  );
}
