import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Suspense } from "react";

import { PreviewDataNotice } from "@/components/auth/auth-card";
import { ChildProfileForm } from "@/components/children/child-profile-form";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { requireParent } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Add a child profile" };

export default function NewChildPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  // requireParent() redirects to onboarding if consent hasn't been recorded,
  // and the database refuses the insert without consent as well.
  await requireParent();
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <Link href="/parent" className="inline-flex items-center gap-2 font-semibold text-muted-foreground hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" /> Dashboard
      </Link>
      <div className="mt-6 rounded-xl border-2 border-ink bg-surface p-6 shadow-[var(--shadow-sticker-lg)] sm:p-8">
        <h1 className="text-3xl font-extrabold text-ink">Add a child profile</h1>
        <p className="mt-2 text-muted-foreground">
          We only need a nickname, an age range and an avatar. No real names, birthdays, photos or school details.
        </p>
        <div className="mt-6 space-y-6">
          <PreviewDataNotice />
          <ChildProfileForm mode="create" />
        </div>
      </div>
    </div>
  );
}
