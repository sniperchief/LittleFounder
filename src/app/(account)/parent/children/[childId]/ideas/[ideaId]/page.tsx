import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { IdeaBadge, IdeaStatusChip, IdeaSummary } from "@/components/ideas/idea-visuals";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { requireParent } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getChild } from "@/lib/data/children";
import { getIdea } from "@/lib/data/ideas";
import { uuidSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Idea" };

const dateFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric" });

export default function ParentIdeaPage(props: PageProps<"/parent/children/[childId]/ideas/[ideaId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}

async function Content({ params }: PageProps<"/parent/children/[childId]/ideas/[ideaId]">) {
  await requireParent();
  const { childId, ideaId } = await params;
  if (!uuidSchema.safeParse(childId).success || !uuidSchema.safeParse(ideaId).success) notFound();

  // RLS returns nothing for another family's child or idea, so this is a 404 for them.
  const child = await getChild(childId);
  if (!child) notFound();
  const idea = await getIdea(await createClient(), child.id, ideaId);
  if (!idea) notFound();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href={`/parent/children/${child.id}`} className="inline-flex items-center gap-2 font-semibold text-muted-foreground hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" /> {child.nickname}&apos;s activity
      </Link>
      <header className="mt-6 flex flex-col gap-5 rounded-2xl border-2 border-ink bg-surface p-6 sm:flex-row sm:items-center">
        <IdeaBadge icon={idea.icon_key} className="size-16" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-extrabold text-ink [overflow-wrap:anywhere]">{idea.name}</h1>
            <IdeaStatusChip status={idea.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            By {child.nickname} · started {dateFormat.format(new Date(idea.created_at))} · last updated{" "}
            {dateFormat.format(new Date(idea.updated_at))}
          </p>
        </div>
      </header>
      <p className="mt-4 text-sm text-muted-foreground">
        Read-only view. Ideas are private to your family — they are never shared publicly. Your child edits ideas in Child Mode.
      </p>
      <div className="mt-6">
        <IdeaSummary idea={idea} />
      </div>
    </div>
  );
}
