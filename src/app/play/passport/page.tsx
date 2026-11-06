import type { Metadata } from "next";
import { Award, Lock, ScrollText } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { BackLink, ChildPageSkeleton, moduleHref } from "@/components/academy/academy-ui";
import { AppIcon, toneSoft } from "@/components/academy/module-visuals";
import { ProgressBar } from "@/components/dashboard/activity-panels";
import { FounderAvatar } from "@/components/illustrations/founder-avatar";
import { requireChildMode } from "@/lib/auth/session";
import { getAcademyOverview, getPassport } from "@/lib/data/academy";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Founder Passport" };

const dateFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric" });

export default function PassportPage() {
  return (
    <Suspense fallback={<ChildPageSkeleton />}>
      <Passport />
    </Suspense>
  );
}

async function Passport() {
  const { child, supabase } = await requireChildMode();
  const [academy, passport] = await Promise.all([getAcademyOverview(supabase, child.id), getPassport(supabase, child.id)]);
  const earned = passport.badges.filter((b) => b.earnedAt);
  const stats = [
    { label: "Lessons completed", value: `${academy.lessonsCompleted}/${academy.lessonsTotal}` },
    { label: "Modules completed", value: `${academy.modulesCompleted}/${academy.modules.length}` },
    { label: "Quizzes passed", value: passport.quizzesPassed },
    { label: "Challenges solved", value: passport.activitiesSolved },
  ];
  const certificate = passport.certificates[0];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <BackLink href="/play">Founder HQ</BackLink>

      <header className="mt-5 overflow-hidden rounded-3xl border-2 border-ink bg-grape-soft shadow-[var(--shadow-sticker-lg)]">
        <div className="flex flex-col items-center gap-5 p-6 text-center sm:flex-row sm:p-8 sm:text-left">
          <FounderAvatar avatarKey={child.avatar_key} className="size-24 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-ink/70">Founder Passport</p>
            <h1 className="text-4xl font-extrabold text-ink">{child.nickname}</h1>
            <p className="mt-1 text-ink/80">
              {earned.length} of {passport.badges.length} badges collected
            </p>
            <div className="mx-auto mt-3 max-w-sm sm:mx-0">
              <ProgressBar value={academy.lessonsCompleted} max={academy.lessonsTotal} label="Overall learning progress" />
            </div>
          </div>
        </div>
        <dl className="grid grid-cols-2 border-t-2 border-ink bg-surface sm:grid-cols-4">
          {stats.map((s, i) => (
            <div key={s.label} className={cn("flex flex-col-reverse p-4 text-center", i % 2 === 1 && "border-l-2 border-ink/10", i >= 2 && "border-t-2 border-ink/10 sm:border-t-0", i > 0 && "sm:border-l-2")}>
              <dt className="text-sm font-semibold text-ink/70">{s.label}</dt>
              <dd className="font-display text-3xl font-extrabold text-ink">{s.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <section aria-labelledby="stamps" className="mt-10">
        <h2 id="stamps" className="text-2xl font-bold text-ink">
          Module stamps
        </h2>
        <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {academy.modules.map((m) => {
            return (
              <li key={m.key}>
                <Link href={moduleHref(m.key)} className="flex flex-col items-center gap-2 rounded-2xl p-2 text-center hover:bg-surface">
                  <span
                    className={cn(
                      "flex size-20 items-center justify-center rounded-full border-[3px]",
                      m.completed ? cn("rotate-[-6deg] border-ink shadow-[var(--shadow-sticker)]", toneSoft[m.tone]) : "border-dashed border-ink/25 bg-surface",
                    )}
                  >
                    <AppIcon name={m.icon} className={cn("size-8", m.completed ? "text-ink" : "text-ink/25")} aria-hidden="true" />
                  </span>
                  <span className={cn("text-sm font-bold", m.completed ? "text-ink" : "text-muted-foreground")}>{m.title}</span>
                  <span className="sr-only">{m.completed ? "Completed" : "Not completed yet"}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="badges" className="mt-10">
        <h2 id="badges" className="text-2xl font-bold text-ink">
          Badges
        </h2>
        {earned.length === 0 ? (
          <p className="mt-2 text-ink/75">Your first badge is waiting — finish a lesson to earn First Steps!</p>
        ) : null}
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {passport.badges.map((b) => {
            return (
              <li
                key={b.key}
                className={cn(
                  "flex items-center gap-4 rounded-2xl border-2 p-4",
                  b.earnedAt ? "border-ink bg-surface" : "border-dashed border-ink/20 bg-surface/60",
                )}
              >
                <span
                  className={cn(
                    "flex size-14 shrink-0 items-center justify-center rounded-full border-2",
                    b.earnedAt ? "border-ink bg-sun shadow-[var(--shadow-sticker)]" : "border-ink/20 bg-muted",
                  )}
                >
                  {b.earnedAt ? (
                    <AppIcon name={b.icon} className="size-6 text-ink" aria-hidden="true" />
                  ) : (
                    <Lock className="size-6 text-ink/30" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className={cn("font-bold", b.earnedAt ? "text-ink" : "text-muted-foreground")}>{b.title}</p>
                  <p className="text-sm text-ink/70">{b.description}</p>
                  <p className="mt-0.5 text-xs font-semibold text-ink/60">
                    {b.earnedAt ? `Earned ${dateFormat.format(new Date(b.earnedAt))}` : "Not earned yet"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="milestones" className="mt-10">
        <h2 id="milestones" className="text-2xl font-bold text-ink">
          Milestones
        </h2>
        {certificate ? (
          <div className="mt-4 rounded-3xl border-[3px] border-double border-ink bg-sun-soft p-6 text-center sm:p-8">
            <ScrollText className="mx-auto size-10 text-ink" aria-hidden="true" />
            <p className="mt-2 text-sm font-bold uppercase tracking-[0.16em] text-ink/70">Learning milestone</p>
            <p className="mt-1 text-2xl font-extrabold text-ink sm:text-3xl">{certificate.title}</p>
            <p className="mt-2 text-lg text-ink">Awarded to {child.nickname}</p>
            <p className="text-ink/75">for completing all six Founder Academy modules · {dateFormat.format(new Date(certificate.issuedAt))}</p>
            <p className="mx-auto mt-4 max-w-md text-sm text-ink/70">
              This celebrates learning inside Little Founders. It is a learning milestone, not a formal educational qualification.
            </p>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-4 rounded-2xl border-2 border-dashed border-ink/25 p-5">
            <Award className="size-10 shrink-0 text-ink/30" aria-hidden="true" />
            <div>
              <p className="font-bold text-ink">Founder Academy Learning Milestone</p>
              <p className="text-ink/75">
                Complete all six modules (every lesson and quiz) to unlock it. {academy.modulesCompleted} of {academy.modules.length} done so far.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
