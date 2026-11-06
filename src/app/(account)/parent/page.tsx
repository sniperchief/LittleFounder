import type { Metadata } from "next";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { EnterChildModeButton } from "@/components/children/enter-child-mode-button";
import { StatTile } from "@/components/dashboard/activity-panels";
import { FounderAvatar } from "@/components/illustrations/founder-avatar";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requireParent } from "@/lib/auth/session";
import { getChildActivity, listChildren } from "@/lib/data/children";

export const metadata: Metadata = { title: "Parent Dashboard" };

const banners: Record<string, { tone: "success" | "info"; text: string }> = {
  welcome: { tone: "success", text: "You're all set up. Add a child profile to get started." },
  created: { tone: "success", text: "Profile created. Start Child Mode whenever your child is ready." },
  removed: { tone: "info", text: "Profile removed. You can restore it from Settings within 30 days." },
  restored: { tone: "success", text: "Profile restored." },
};

export default function ParentDashboardPage({ searchParams }: PageProps<"/parent">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/parent">["searchParams"] }) {
  const ctx = await requireParent();
  const [children, params] = await Promise.all([listChildren(), searchParams]);
  const activities = await Promise.all(children.map((c) => getChildActivity(c.id)));
  const bannerKey = Object.keys(banners).find((k) => params[k] === "1");
  const banner = bannerKey ? banners[bannerKey] : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">Parent Dashboard</p>
          <h1 className="mt-1 text-3xl font-extrabold text-ink sm:text-4xl">Hello, {ctx.displayName}</h1>
          <p className="mt-2 text-muted-foreground">See how each of your founders is getting on.</p>
        </div>
        {children.length > 0 && children.length < 8 ? (
          <Link href="/parent/children/new" className={buttonVariants({ variant: "secondary" })}>
            <Plus aria-hidden="true" /> Add child
          </Link>
        ) : null}
      </div>

      {banner ? (
        <Alert tone={banner.tone} className="mt-6">
          {banner.text}
        </Alert>
      ) : null}

      {children.length === 0 ? (
        <div className="mt-10 flex flex-col items-center rounded-xl border-2 border-dashed border-ink/25 bg-surface px-6 py-14 text-center">
          <div className="flex -space-x-3" aria-hidden="true">
            <FounderAvatar avatarKey="founder-1" className="size-14" />
            <FounderAvatar avatarKey="founder-3" className="size-14" />
            <FounderAvatar avatarKey="founder-6" className="size-14" />
          </div>
          <h2 className="mt-5 text-2xl font-bold text-ink">No child profiles yet</h2>
          <p className="mt-2 max-w-md text-muted-foreground">
            Add a profile for each child. You&apos;ll only need a nickname, an age range and an avatar.
          </p>
          <Link href="/parent/children/new" className={buttonVariants({ className: "mt-6" })}>
            <Plus aria-hidden="true" /> Add your first child
          </Link>
        </div>
      ) : (
        <ul className="mt-8 grid gap-5 md:grid-cols-2">
          {children.map((child, i) => {
            const a = activities[i];
            return (
              <li key={child.id} className="flex flex-col rounded-xl border-2 border-ink bg-surface p-6">
                <div className="flex items-center gap-4">
                  <FounderAvatar avatarKey={child.avatar_key} className="size-16" />
                  <div className="min-w-0">
                    <h2 className="truncate text-2xl font-bold text-ink">{child.nickname}</h2>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Badge tone="neutral">Age {child.age_band.replace("-", "–")}</Badge>
                      {child.is_demo ? <Badge tone="sun">Demo profile</Badge> : null}
                    </div>
                  </div>
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatTile label="Lessons" value={a.lessonsCompleted} tone="bg-sun-soft" />
                  <StatTile label="Ideas" value={a.ideas.length} tone="bg-coral-soft" />
                  <StatTile label="Pitches" value={a.pitchDecks.length} tone="bg-sky-soft" />
                  <StatTile label="Badges" value={a.achievements.length} tone="bg-rose-soft" />
                </dl>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href={`/parent/children/${child.id}`}
                    className={buttonVariants({ variant: "secondary", size: "sm", className: "flex-1" })}
                  >
                    View activity<span className="sr-only"> for {child.nickname}</span>
                  </Link>
                  <EnterChildModeButton childId={child.id} nickname={child.nickname} className="flex-1" />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
