import type { Metadata } from "next";
import { Mic, PartyPopper, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BackLink, ChildPageSkeleton } from "@/components/academy/academy-ui";
import { BadgeList } from "@/components/academy/badge-list";
import { InvestorPractice } from "@/components/pitch/investor-practice";
import { formatDate, PracticeResultView } from "@/components/pitch/pitch-visuals";
import { buttonVariants } from "@/components/ui/button";
import { requireChildMode } from "@/lib/auth/session";
import { getAchievementTitles } from "@/lib/data/academy";
import { getPractice } from "@/lib/data/pitch";
import { uuidSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Investor Room practice" };

export default function PracticePage(props: PageProps<"/play/pitch/[deckId]/investor/[sessionId]">) {
  return (
    <Suspense fallback={<ChildPageSkeleton />}>
      <Practice {...props} />
    </Suspense>
  );
}

async function Practice({ params, searchParams }: PageProps<"/play/pitch/[deckId]/investor/[sessionId]">) {
  const [{ deckId, sessionId }, query, { child, supabase }] = await Promise.all([params, searchParams, requireChildMode()]);
  if (!uuidSchema.safeParse(deckId).success || !uuidSchema.safeParse(sessionId).success) notFound();
  // Only the active child's own practice (child id from Child Mode, not from the URL).
  const practice = await getPractice(supabase, child.id, sessionId);
  if (!practice || practice.deckId !== deckId) notFound();

  if (!practice.completedAt) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <BackLink href={`/play/pitch/${deckId}/investor`}>Investor Room</BackLink>
        <h1 className="mt-4 text-3xl font-extrabold text-ink [overflow-wrap:anywhere] sm:text-4xl">
          Practise {practice.snapshot.title} with {practice.persona.name}
        </h1>
        <div className="mt-6">
          <InvestorPractice
            sessionId={practice.id}
            deckId={deckId}
            persona={practice.persona}
            questions={practice.questions}
            answered={practice.answers.length}
            deck={practice.snapshot}
          />
        </div>
      </div>
    );
  }

  const badgeKeys = typeof query.badges === "string" ? query.badges.split(",").filter((k) => /^[a-z0-9-]{1,40}$/.test(k)).slice(0, 5) : [];
  const badges = await getAchievementTitles(supabase, badgeKeys);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <BackLink href={`/play/pitch/${deckId}`}>Back to my pitch</BackLink>
      <h1 className="mt-4 text-3xl font-extrabold text-ink [overflow-wrap:anywhere] sm:text-4xl">Your practice feedback</h1>
      <p className="mt-1 text-muted-foreground">
        {practice.snapshot.title} (version {practice.version ?? 1}) with {practice.persona.name} · {formatDate(practice.completedAt)}
      </p>

      {query.done === "1" ? (
        <div className="mt-5 space-y-4">
          <p className="flex items-center gap-2 rounded-xl bg-mint-soft px-4 py-3 text-lg font-bold text-ink">
            <PartyPopper className="size-6 shrink-0" aria-hidden="true" /> Practice complete! You answered every question.
          </p>
          {badges.length > 0 ? <BadgeList badges={badges} heading="New badge unlocked!" /> : null}
        </div>
      ) : null}

      <div className="mt-6">
        <PracticeResultView practice={practice} />
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={`/play/pitch/${deckId}/edit?step=1`} className={buttonVariants({ size: "lg" })}>
          <Pencil aria-hidden="true" /> Improve my pitch
        </Link>
        <Link href={`/play/pitch/${deckId}/investor`} className={buttonVariants({ variant: "secondary", size: "lg" })}>
          <Mic aria-hidden="true" /> Practise again
        </Link>
      </div>
    </div>
  );
}
