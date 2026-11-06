import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ChildProfileForm } from "@/components/children/child-profile-form";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { requireParent } from "@/lib/auth/session";
import { getChild } from "@/lib/data/children";
import { uuidSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Edit child profile" };

export default function EditChildPage(props: PageProps<"/parent/children/[childId]/edit">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}

async function Content({ params }: PageProps<"/parent/children/[childId]/edit">) {
  await requireParent();
  const { childId } = await params;
  if (!uuidSchema.safeParse(childId).success) notFound();
  const child = await getChild(childId);
  if (!child) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <Link
        href={`/parent/children/${child.id}`}
        className="inline-flex items-center gap-2 font-semibold text-muted-foreground hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to {child.nickname}
      </Link>
      <div className="mt-6 rounded-xl border-2 border-ink bg-surface p-6 shadow-[var(--shadow-sticker-lg)] sm:p-8">
        <h1 className="text-3xl font-extrabold text-ink">Edit {child.nickname}&apos;s profile</h1>
        <div className="mt-6">
          <ChildProfileForm
            mode="edit"
            defaults={{
              childId: child.id,
              nickname: child.nickname,
              ageBand: child.age_band,
              avatarKey: child.avatar_key,
            }}
          />
        </div>
      </div>
    </div>
  );
}
