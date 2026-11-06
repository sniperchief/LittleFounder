import type { Metadata } from "next";
import { ArrowRight, Award, BookOpen, FlaskConical, Presentation, TrendingUp, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { NextStepCard } from "@/components/academy/academy-ui";
import { ProgressBar } from "@/components/dashboard/activity-panels";
import { FounderAvatar } from "@/components/illustrations/founder-avatar";
import { requireChildMode } from "@/lib/auth/session";
import { getAcademyOverview } from "@/lib/data/academy";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Founder HQ" };

type Zone = { icon: LucideIcon; title: string; body: string; tone: string; href?: string };

const zones: Zone[] = [
  { icon: BookOpen, title: "Founder Academy", body: "Short lessons and quizzes about how businesses start.", tone: "bg-sun-soft", href: "/play/academy" },
  { icon: FlaskConical, title: "Idea Lab", body: "Turn a problem you've spotted into a real idea.", tone: "bg-coral-soft", href: "/play/ideas" },
  { icon: TrendingUp, title: "Startup Simulator", body: "Run a pretend business with Founder Bucks.", tone: "bg-mint-soft", href: "/play/simulator" },
  { icon: Presentation, title: "Pitch Studio", body: "Build a pitch and practise with pretend investors.", tone: "bg-sky-soft", href: "/play/pitch" },
];

export default function ChildHomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <ChildHome />
    </Suspense>
  );
}

function HomeSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="mx-auto max-w-5xl animate-pulse px-4 py-10 sm:px-6">
      <div className="h-40 rounded-2xl border-2 border-border bg-surface" />
    </div>
  );
}

async function ChildHome() {
  const { child, supabase } = await requireChildMode();
  const academy = await getAcademyOverview(supabase, child.id);
  const { count: badgeCount } = await supabase
    .from("child_achievements")
    .select("achievement_id", { count: "exact", head: true })
    .eq("child_id", child.id);
  const badges = badgeCount ?? 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <section
        aria-labelledby="hello"
        className="flex flex-col items-center gap-6 rounded-2xl border-2 border-ink bg-surface p-6 text-center shadow-[var(--shadow-sticker-lg)] sm:flex-row sm:p-8 sm:text-left"
      >
        <FounderAvatar avatarKey={child.avatar_key} className="size-28 sm:size-32" />
        <div className="flex-1">
          <p className="font-display text-lg font-bold text-coral-ink">Welcome back, founder!</p>
          <h1 id="hello" className="mt-1 text-4xl font-extrabold text-ink sm:text-5xl">
            Hi, {child.nickname}!
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">Every big business started as a small idea. What will yours be?</p>
        </div>
      </section>

      <div className="mt-8">
        <NextStepCard next={academy.next} />
      </div>

      <section aria-labelledby="journey" className="mt-5 grid gap-5 md:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border-2 border-ink bg-surface p-6">
          <h2 id="journey" className="text-2xl font-bold text-ink">
            Your founder journey
          </h2>
          <p className="mt-1 text-muted-foreground">
            {academy.lessonsCompleted} of {academy.lessonsTotal} lessons · {academy.modulesCompleted} of {academy.modules.length} modules complete
          </p>
          <div className="mt-4">
            <ProgressBar value={academy.lessonsCompleted} max={academy.lessonsTotal} label="Academy lessons completed" />
          </div>
          <Link href="/play/academy" className="mt-4 inline-flex items-center gap-2 font-bold text-ink underline underline-offset-4">
            Open the Founder Academy <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <Link href="/play/passport" className="rounded-2xl border-2 border-ink bg-surface p-6 transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-sticker-lg)]">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl border-2 border-ink bg-rose-soft">
              <Award className="size-5 text-ink" aria-hidden="true" />
            </span>
            <h2 className="text-2xl font-bold text-ink">Founder Passport</h2>
          </div>
          <p className="mt-3 font-display text-4xl font-extrabold text-ink">{badges}</p>
          <p className="text-muted-foreground">
            {badges === 1 ? "badge earned" : "badges earned"}
            {badges === 0 ? " — your first one is waiting for you!" : ""}
          </p>
          <p className="mt-3 inline-flex items-center gap-2 font-bold text-ink underline underline-offset-4">
            Open your Passport <ArrowRight className="size-4" aria-hidden="true" />
          </p>
        </Link>
      </section>

      <section aria-labelledby="zones" className="mt-10">
        <h2 id="zones" className="text-2xl font-bold text-ink">
          Founder zones
        </h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {zones.map(({ icon: Icon, title, body, tone, href }) => {
            const content = (
              <>
                <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-2xl border-2 border-ink", tone)}>
                  <Icon className="size-6 text-ink" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-ink">{title}</h3>
                  <p className="text-muted-foreground">{body}</p>
                  <p
                    className={cn(
                      "mt-2 inline-block rounded-full px-3 py-0.5 text-xs font-bold uppercase tracking-[0.12em]",
                      href ? "bg-mint text-ink" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {href ? "Open now" : "Opening soon"}
                  </p>
                </div>
              </>
            );
            return (
              <li key={title}>
                {href ? (
                  <Link
                    href={href}
                    className="flex h-full gap-4 rounded-2xl border-2 border-ink bg-surface p-5 transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-sticker-lg)]"
                  >
                    {content}
                  </Link>
                ) : (
                  <div className="flex h-full gap-4 rounded-2xl border-2 border-ink/20 bg-surface p-5">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
