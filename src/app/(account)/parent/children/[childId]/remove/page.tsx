import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { removeChildAction } from "@/app/(account)/actions";
import { FounderAvatar } from "@/components/illustrations/founder-avatar";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/form-controls";
import { requireParent } from "@/lib/auth/session";
import { getChild } from "@/lib/data/children";
import { uuidSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Remove child profile" };

export default function RemoveChildPage(props: PageProps<"/parent/children/[childId]/remove">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}

async function Content({ params }: PageProps<"/parent/children/[childId]/remove">) {
  await requireParent();
  const { childId } = await params;
  if (!uuidSchema.safeParse(childId).success) notFound();
  const child = await getChild(childId);
  if (!child) notFound();

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-12">
      <div className="rounded-xl border-2 border-ink bg-surface p-6 text-center shadow-[var(--shadow-sticker-lg)] sm:p-8">
        <FounderAvatar avatarKey={child.avatar_key} className="mx-auto size-20" />
        <h1 className="mt-4 text-3xl font-extrabold text-ink">Remove {child.nickname}&apos;s profile?</h1>
        <div className="mt-4 space-y-3 text-left text-muted-foreground">
          <p>When you remove this profile:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>It disappears from your dashboard and from Child Mode straight away.</li>
            <li>
              Everything linked to it — progress, ideas, simulations, pitches and badges — is{" "}
              <strong className="text-ink">permanently deleted after 30 days</strong>.
            </li>
            <li>Until then, you can restore it from Settings.</li>
          </ul>
        </div>
        <form action={removeChildAction} className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          <input type="hidden" name="childId" value={child.id} />
          <input type="hidden" name="confirm" value="remove" />
          <Link href={`/parent/children/${child.id}`} className={buttonVariants({ variant: "secondary" })}>
            Keep profile
          </Link>
          <SubmitButton pendingLabel="Removing…" className="bg-coral-ink border-coral-ink shadow-none">
            Yes, remove profile
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
