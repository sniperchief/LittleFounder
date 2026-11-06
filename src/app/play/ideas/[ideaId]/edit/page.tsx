import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BackLink, ChildPageSkeleton } from "@/components/academy/academy-ui";
import { IdeaWizard } from "@/components/ideas/idea-wizard";
import { requireChildMode } from "@/lib/auth/session";
import { getIdea, toFields } from "@/lib/data/ideas";
import { uuidSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Edit idea" };

export default function EditIdeaPage(props: PageProps<"/play/ideas/[ideaId]/edit">) {
  return (
    <Suspense fallback={<ChildPageSkeleton />}>
      <EditIdea {...props} />
    </Suspense>
  );
}

async function EditIdea({ params, searchParams }: PageProps<"/play/ideas/[ideaId]/edit">) {
  const [{ ideaId }, query, { child, supabase }] = await Promise.all([params, searchParams, requireChildMode()]);
  if (!uuidSchema.safeParse(ideaId).success) notFound();
  // Only the active child's own ideas (child id from Child Mode, not from the URL).
  const idea = await getIdea(supabase, child.id, ideaId);
  if (!idea) notFound();

  const requested = Number(query.step);
  const step = Number.isInteger(requested) && requested >= 1 && requested <= 6 ? requested : idea.wizard_step;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <BackLink href={idea.status === "ready" ? `/play/ideas/${idea.id}` : "/play/ideas"}>
        {idea.status === "ready" ? "Back to my idea" : "Idea Lab"}
      </BackLink>
      <h1 className="mt-4 text-4xl font-extrabold text-ink [overflow-wrap:anywhere]">
        {idea.status === "ready" ? `Edit ${idea.name}` : "Keep building your idea"}
      </h1>
      <p className="mt-1 text-lg text-ink/80">Jump to any step using the numbers. Your changes are saved when you continue.</p>
      <div className="mt-6">
        <IdeaWizard key={idea.id} ideaId={idea.id} initial={toFields(idea)} initialStep={step} status={idea.status} />
      </div>
    </div>
  );
}
