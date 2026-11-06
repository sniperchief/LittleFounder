import type { Metadata } from "next";
import { ArrowLeft, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { EnterChildModeButton } from "@/components/children/enter-child-mode-button";
import {
  AchievementsPanel,
  IdeasPanel,
  LearningPanel,
  PitchesPanel,
  QuizPanel,
  SimulationsPanel,
} from "@/components/dashboard/activity-panels";
import { FounderAvatar } from "@/components/illustrations/founder-avatar";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requireParent } from "@/lib/auth/session";
import { getChild, getChildActivity, listChildren } from "@/lib/data/children";
import { cn } from "@/lib/utils";
import { uuidSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Child activity" };

export default function ChildActivityPage(props: PageProps<"/parent/children/[childId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}

async function Content({ params, searchParams }: PageProps<"/parent/children/[childId]">) {
  await requireParent();
  const [{ childId }, query] = await Promise.all([params, searchParams]);
  if (!uuidSchema.safeParse(childId).success) notFound();

  // RLS returns nothing for another family's child, so this is a 404 for them.
  const [child, siblings] = await Promise.all([getChild(childId), listChildren()]);
  if (!child) notFound();
  const activity = await getChildActivity(child.id);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href="/parent" className="inline-flex items-center gap-2 font-semibold text-muted-foreground hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" /> Dashboard
      </Link>

      {siblings.length > 1 ? (
        <nav aria-label="Choose a child" className="mt-6">
          <ul className="flex flex-wrap gap-2">
            {siblings.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/parent/children/${s.id}`}
                  aria-current={s.id === child.id ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border-2 py-1 pl-1 pr-4 font-semibold",
                    s.id === child.id ? "border-ink bg-sun-soft text-ink" : "border-border bg-surface text-muted-foreground hover:text-ink",
                  )}
                >
                  <FounderAvatar avatarKey={s.avatar_key} className="size-8" />
                  {s.nickname}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {query.updated === "1" ? (
        <Alert tone="success" className="mt-6">
          Profile updated.
        </Alert>
      ) : null}

      <div className="mt-6 flex flex-col gap-5 rounded-xl border-2 border-ink bg-surface p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <FounderAvatar avatarKey={child.avatar_key} className="size-20" />
          <div>
            <h1 className="text-3xl font-extrabold text-ink">{child.nickname}</h1>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <Badge>Age {child.age_band.replace("-", "–")}</Badge>
              {child.is_demo ? <Badge tone="sun">Demo profile</Badge> : null}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <EnterChildModeButton childId={child.id} nickname={child.nickname} />
          <Link href={`/parent/children/${child.id}/credentials`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
            <ShieldCheck aria-hidden="true" /> Credentials
          </Link>
          <Link href={`/parent/children/${child.id}/edit`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
            <Pencil aria-hidden="true" /> Edit
          </Link>
          <Link href={`/parent/children/${child.id}/remove`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <Trash2 aria-hidden="true" /> Remove
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <LearningPanel activity={activity} />
        <QuizPanel activity={activity} />
        <AchievementsPanel activity={activity} />
        <IdeasPanel activity={activity} childId={child.id} />
        <SimulationsPanel activity={activity} childId={child.id} />
        <PitchesPanel activity={activity} childId={child.id} />
      </div>
    </div>
  );
}
