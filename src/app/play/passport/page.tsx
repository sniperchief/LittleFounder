import type { Metadata } from "next";
import { ArrowRight, Award, BadgeCheck, Lock, Mic, Presentation, ScrollText } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { BackLink, ChildPageSkeleton, moduleHref } from "@/components/academy/academy-ui";
import { AppIcon, toneSoft } from "@/components/academy/module-visuals";
import { ProgressBar } from "@/components/dashboard/activity-panels";
import { FounderAvatar } from "@/components/illustrations/founder-avatar";
import { requireChildMode } from "@/lib/auth/session";
import { getAcademyOverview, getPassport } from "@/lib/data/academy";
import { listCredentials, proofLabel } from "@/lib/data/credentials";
import { getPitchProgress } from "@/lib/data/pitch";
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
  const [academy, passport, pitch, credentials] = await Promise.all([
    getAcademyOverview(supabase, child.id),
    getPassport(supabase, child.id),
    getPitchProgress(supabase, child.id),
    listCredentials(supabase, child.id),
  ]);
  const earned = passport.badges.filter((b) => b.earnedAt);
  const stats = [
    { label: "Lessons completed", value: `${academy.lessonsCompleted}/${academy.lessonsTotal}` },
    { label: "Modules completed", value: `${academy.modulesCompleted}/${academy.modules.length}` },
    { label: "Quizzes passed", value: passport.quizzesPassed },
    { label: "Challenges solved", value: passport.activitiesSolved },
  ];

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

      <section aria-labelledby="pitching" className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="pitching" className="text-2xl font-bold text-ink">
            Pitch Studio &amp; Investor Room
          </h2>
          <Link href="/play/pitch" className="inline-flex items-center gap-1 font-bold text-ink underline underline-offset-4">
            Open Pitch Studio <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { icon: Presentation, label: "Pitches finished", value: `${pitch.pitchesCompleted}/${pitch.pitchesCreated}`, tone: "bg-sky-soft" },
            { icon: Mic, label: "Investor Room practices", value: pitch.practicesCompleted, tone: "bg-grape-soft" },
            { icon: Award, label: "Best practice score", value: pitch.bestScore === null ? "–" : `${pitch.bestScore}/100`, tone: "bg-sun-soft" },
          ].map(({ icon: Icon, label, value, tone }) => (
            <div key={label} className={cn("flex items-center gap-3 rounded-2xl border-2 border-ink p-4", tone)}>
              <Icon className="size-7 shrink-0 text-ink" aria-hidden="true" />
              <div className="flex flex-col-reverse">
                <dt className="text-sm font-semibold text-ink/75">{label}</dt>
                <dd className="font-display text-2xl font-extrabold text-ink">{value}</dd>
              </div>
            </div>
          ))}
        </dl>
        {pitch.pitchesCreated === 0 ? (
          <p className="mt-2 text-ink/75">Build your first pitch to earn the First Pitch badge!</p>
        ) : pitch.practicesCompleted === 0 && pitch.pitchesCompleted > 0 ? (
          <p className="mt-2 text-ink/75">Practise in the Investor Room to earn the Confident Founder badge!</p>
        ) : null}
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
          My certificates
        </h2>
        <p className="mt-1 text-ink/75">Certificates celebrate big learning milestones. Each one has a special link to show it&apos;s real.</p>
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {credentials.map((c) => {
            const earnedAt = c.earned?.issuedAt;
            const proof = c.earned ? proofLabel(c.earned.anchor) : null;
            const progress =
              c.requirement.type === "modules_completed"
                ? `${academy.modulesCompleted} of ${c.requirement.count} modules done so far.`
                : pitch.bestScore === null
                  ? "Practise in the Investor Room to start."
                  : `Your best practice score so far: ${pitch.bestScore}/100.`;
            return (
              <li key={c.key}>
                {c.earned && earnedAt ? (
                  <div className="h-full rounded-3xl border-[3px] border-double border-ink bg-sun-soft p-6 text-center">
                    <ScrollText className="mx-auto size-10 text-ink" aria-hidden="true" />
                    <p className="mt-2 text-sm font-bold uppercase tracking-[0.16em] text-ink/70">Learning milestone</p>
                    <p className="mt-1 text-2xl font-extrabold text-ink">{c.title}</p>
                    <p className="mt-2 text-lg text-ink">Awarded to {child.nickname}</p>
                    <p className="text-ink/75">
                      {c.description} · {dateFormat.format(new Date(earnedAt))}
                    </p>
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-mint px-3 py-0.5 text-xs font-bold uppercase tracking-[0.08em] text-ink">
                        <BadgeCheck className="size-3.5" aria-hidden="true" /> {c.earned.status === "active" ? "Checked & genuine" : "No longer valid"}
                      </span>
                      {proof ? (
                        <span className="rounded-full bg-grape-soft px-3 py-0.5 text-xs font-bold uppercase tracking-[0.08em] text-ink">{proof}</span>
                      ) : null}
                    </div>
                    <Link
                      href={`/verify/${c.earned.code}`}
                      className="mt-4 inline-flex items-center gap-1 font-bold text-ink underline underline-offset-4"
                    >
                      Check it&apos;s real <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                    <p className="mx-auto mt-3 max-w-md text-xs text-ink/70">
                      This celebrates learning inside Little Founders. It is a learning milestone, not a formal educational qualification.
                    </p>
                  </div>
                ) : (
                  <div className="flex h-full items-center gap-4 rounded-2xl border-2 border-dashed border-ink/25 p-5">
                    <Award className="size-10 shrink-0 text-ink/30" aria-hidden="true" />
                    <div>
                      <p className="font-bold text-ink">{c.title}</p>
                      <p className="text-ink/75">
                        {c.description} {progress}
                      </p>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
