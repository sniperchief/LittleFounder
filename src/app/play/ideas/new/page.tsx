import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { BackLink, ChildPageSkeleton } from "@/components/academy/academy-ui";
import { IdeaWizard } from "@/components/ideas/idea-wizard";
import { buttonVariants } from "@/components/ui/button";
import { ideaLimits } from "@/content/idea-lab";
import { requireChildMode } from "@/lib/auth/session";
import { listIdeas, toFields } from "@/lib/data/ideas";

export const metadata: Metadata = { title: "New idea" };

export default function NewIdeaPage() {
  return (
    <Suspense fallback={<ChildPageSkeleton />}>
      <NewIdea />
    </Suspense>
  );
}

async function NewIdea() {
  const { child, supabase } = await requireChildMode();
  const ideas = await listIdeas(supabase, child.id);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <BackLink href="/play/ideas">Idea Lab</BackLink>
      <h1 className="mt-4 text-4xl font-extrabold text-ink">New idea</h1>
      <p className="mt-1 text-lg text-ink/80">Six short steps. Your progress is saved every time you continue.</p>
      <div className="mt-6">
        {ideas.length >= ideaLimits.maxActiveIdeas ? (
          <div className="rounded-2xl border-2 border-ink bg-sun-soft p-6">
            <p className="text-lg font-bold text-ink">You already have {ideaLimits.maxActiveIdeas} ideas.</p>
            <p className="text-ink/80">Delete one you don&apos;t need any more to make space for a new one.</p>
            <Link href="/play/ideas" className={buttonVariants({ className: "mt-4" })}>
              Back to my ideas
            </Link>
          </div>
        ) : (
          <IdeaWizard ideaId={null} initial={toFields(null)} initialStep={1} status="draft" />
        )}
      </div>
    </div>
  );
}
