import type { Metadata } from "next";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { enterChildModeAction } from "@/app/(account)/actions";
import { FounderAvatar } from "@/components/illustrations/founder-avatar";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { requireParent } from "@/lib/auth/session";
import { listChildren } from "@/lib/data/children";

export const metadata: Metadata = { title: "Who's learning?" };

export default function ProfilesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await requireParent();
  const children = await listChildren();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12 text-center sm:py-16">
      <h1 className="text-4xl font-extrabold text-ink sm:text-5xl">Who&apos;s learning today?</h1>
      <p className="mx-auto mt-3 max-w-lg text-lg text-muted-foreground">
        Pick a founder to start Child Mode. You&apos;ll need your parent PIN to come back here.
      </p>

      {children.length === 0 ? (
        <div className="mt-10">
          <p className="text-muted-foreground">You haven&apos;t added any child profiles yet.</p>
          <Link href="/parent/children/new" className={buttonVariants({ className: "mt-4" })}>
            <Plus aria-hidden="true" /> Add a child profile
          </Link>
        </div>
      ) : (
        <ul className="mt-12 flex flex-wrap justify-center gap-6">
          {children.map((child) => (
            <li key={child.id}>
              <form action={enterChildModeAction}>
                <input type="hidden" name="childId" value={child.id} />
                <button
                  type="submit"
                  className="group flex w-40 flex-col items-center gap-3 rounded-2xl border-2 border-ink bg-surface p-5 transition-transform hover:-translate-y-1 hover:shadow-[var(--shadow-sticker-lg)] focus-visible:-translate-y-1"
                >
                  <FounderAvatar avatarKey={child.avatar_key} className="size-24" />
                  <span className="font-display text-xl font-extrabold text-ink">{child.nickname}</span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
