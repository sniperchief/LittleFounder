import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { deleteIdeaAction } from "@/app/play/ideas/actions";
import { ChildPageSkeleton } from "@/components/academy/academy-ui";
import { IdeaBadge } from "@/components/ideas/idea-visuals";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/form-controls";
import { requireChildMode } from "@/lib/auth/session";
import { getIdea } from "@/lib/data/ideas";
import { uuidSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Delete idea" };

export default function DeleteIdeaPage(props: PageProps<"/play/ideas/[ideaId]/delete">) {
  return (
    <Suspense fallback={<ChildPageSkeleton />}>
      <DeleteIdea {...props} />
    </Suspense>
  );
}

async function DeleteIdea({ params }: PageProps<"/play/ideas/[ideaId]/delete">) {
  const [{ ideaId }, { child, supabase }] = await Promise.all([params, requireChildMode()]);
  if (!uuidSchema.safeParse(ideaId).success) notFound();
  const idea = await getIdea(supabase, child.id, ideaId);
  if (!idea) notFound();

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-12 sm:px-6">
      <div className="rounded-3xl border-2 border-ink bg-surface p-6 text-center shadow-[var(--shadow-sticker-lg)] sm:p-8">
        <IdeaBadge icon={idea.icon_key} className="mx-auto size-16" />
        <h1 className="mt-4 text-3xl font-extrabold text-ink [overflow-wrap:anywhere]">Delete “{idea.name}”?</h1>
        <p className="mt-2 text-lg text-ink/80">This removes the idea and all its answers for good. You can&apos;t undo it.</p>
        <form action={deleteIdeaAction} className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          <input type="hidden" name="ideaId" value={idea.id} />
          <input type="hidden" name="confirm" value="delete" />
          <Link href={`/play/ideas/${idea.id}`} className={buttonVariants({ variant: "secondary" })}>
            Keep my idea
          </Link>
          <SubmitButton pendingLabel="Deleting…" className="border-coral-ink bg-coral-ink shadow-none">
            <Trash2 aria-hidden="true" /> Yes, delete it
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
